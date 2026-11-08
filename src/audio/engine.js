// MOTOR — el reloj común, el BPM, la tonalidad y la escala globales, los dos
// universos y la mesa de mezcla. Los universos comparten la misma rejilla, así
// que siempre van en fase.

import { makeNoise } from './voices.js';
import { Deck } from './deck.js';
import { Strip } from './strip.js';
import { SCALES } from '../music/emotion.js';
import { INSTRUMENTS } from '../music/arrangement.js';
import { glide } from './dsp.js';
import { PROFILE } from '../core/profile.js';

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Engine {
  constructor() {
    this.ready = false;
    this.playing = false;
    this.bpm = 124;
    this.rootMidi = 28 + Math.floor(Math.random() * 6); // E1..A1: el kick se afina aquí
    this.scaleI = 1;          // eólico
    this.scaleNext = null;    // cambio de modo pedido: entra al empezar el siguiente compás
    this.step = 0;
    this.glitches = 0;
    this.lookahead = PROFILE.lookahead; // s programados por adelantado (adaptativo en móvil)
    this.mode = 'dj'; // 'solo' = un universo | 'dj' = dos universos + mezcla
    this.decks = [
      new Deck(this, 'A', { x: 0.7, y: 0.3, v: -0.3, a: -0.25 }), // casi SOLO DRUMS, con un poco de bajo
      new Deck(this, 'B', { x: 0.7, y: 0.7, v: 0.2, a: 0.15 }),
    ];
    this.decks[1].newCharacter(this.decks[1].seed); // B arranca con su propio carácter
    // MIXER global: ganancia por instrumento, igual para todos los universos (1 = 0 dB = el perfil por defecto)
    this.inst = Object.fromEntries(INSTRUMENTS.map((k) => [k, 1]));
    // estado de la mesa (lo que muestran los controles)
    this.mix = [
      { fader: 1, hi: 0.5, mid: 0.5, lo: 0.5, filter: 0.5 },
      { fader: 0, hi: 0.5, mid: 0.5, lo: 0.5, filter: 0.5 },
    ];
  }

  get stepDur() { return 60 / this.bpm / 4; }
  get barDur() { return this.stepDur * 16; }
  get rootHz() { return midiHz(this.rootMidi); }
  get scale() { return SCALES[this.scaleI]; }
  // universos que existen en este modo (en solo, B ni se crea: no gasta CPU)
  get active() { return this.mode === 'solo' ? [this.decks[0]] : this.decks; }

  setMode(m) {
    if (this.ready) return; // el modo se elige al entrar
    this.mode = m;
    if (m === 'solo') this.mix[0].fader = 1;
  }

  async init() {
    if (this.ready) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: PROFILE.latencyHint }));
    this.noise = makeNoise(ctx);

    // master: suma -> graves en mono -> glue -> limitador
    this.sum = ctx.createGain();
    this.sum.gain.value = 0.72; // headroom: el master ronda -12 LUFS, picos por debajo de -1 dBFS
    this.sum.channelCount = 2;
    this.sum.channelCountMode = 'explicit';     // lo mono se reparte a L y R antes del M/S
    this.sum.channelInterpretation = 'speakers';
    const monoLow = this.monoBelow(ctx, this.sum, 120);
    // glue: compresión de bus suave (≈1–2 dB), ataque lento para dejar pasar el golpe del kick
    const glue = (this.glue = ctx.createDynamicsCompressor());
    glue.threshold.value = -16; glue.ratio.value = 2; glue.knee.value = 6;
    glue.attack.value = 0.02; glue.release.value = 0.15;
    // limitador de seguridad: techo ≈ -1 dBFS (estándar -1 dBTP)
    const limiter = (this.limiter = ctx.createDynamicsCompressor());
    limiter.threshold.value = -2; limiter.ratio.value = 20; limiter.knee.value = 0;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    monoLow.connect(glue).connect(limiter).connect(this.analyser).connect(ctx.destination);

    this.strips = this.active.map((d, i) => {
      const s = new Strip(ctx, this.sum);
      for (const [k, v] of Object.entries(this.mix[i])) s.set(k, v);
      d.initAudio(ctx, s.input);
      return s;
    });

    // reloj en un Worker: no se para si la pestaña pierde el foco
    const src = `let id=null;onmessage=e=>{if(e.data==="go"){if(!id)id=setInterval(()=>postMessage(0),${PROFILE.tickMs})}else{clearInterval(id);id=null}}`;
    this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    this.worker.onmessage = () => this.tick();
    this.lastNow = ctx.currentTime;
    this.ready = true;
    this.worker.postMessage('go');
  }

  // Mid/Side: la parte lateral (L−R) pasa por un high-pass, así por debajo de
  // `hz` todo es mono (los equipos de club suman los graves; nada se cancela).
  monoBelow(ctx, input, hz) {
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    input.connect(split);
    const mid = g(1), side = g(1);
    const lm = g(0.5), rm = g(0.5), ls = g(0.5), rs = g(-0.5);
    split.connect(lm, 0); split.connect(rm, 1); split.connect(ls, 0); split.connect(rs, 1);
    lm.connect(mid); rm.connect(mid); ls.connect(side); rs.connect(side);
    let s = side;
    for (let i = 0; i < 2; i++) { // 24 dB/oct
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = hz; hp.Q.value = 0.707;
      s = s.connect(hp);
    }
    const neg = g(-1);
    s.connect(neg);
    mid.connect(merge, 0, 0); mid.connect(merge, 0, 1);
    s.connect(merge, 0, 0); neg.connect(merge, 0, 1);
    return merge;
  }

  // MIXER global: volumen de un instrumento en todos los universos
  setInst(k, gain) {
    this.inst[k] = gain;
    if (!this.ready) return;
    for (const d of this.active) glide(d.ch[k].user.gain, gain, this.ctx.currentTime, 0.02);
  }

  setMix(i, key, v) {
    this.mix[i][key] = v;
    if (this.ready) this.strips[i].set(key, v);
  }

  async play() {
    await this.init();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    if (this.playing) return;
    // retomar siempre en el inicio de un compás: las frases siguen alineadas
    this.step = Math.ceil(this.step / 16) * 16;
    this.nextGrid = this.ctx.currentTime + 0.08;
    this.driftBase = undefined;
    this.playing = true;
  }

  stop() {
    this.playing = false;
    if (this.ready) for (const d of this.active) d.release(this.ctx.currentTime);
  }

  // MODO global (cabecera): igual para todos los universos, así nunca chocan.
  // Cada clic pasa al siguiente; entra al empezar el siguiente compás.
  cycleScale() {
    const n = ((this.scaleNext ?? this.scaleI) + 1) % SCALES.length;
    if (this.playing) this.scaleNext = n === this.scaleI ? null : n;
    else { this.scaleI = n; this.scaleNext = null; }
  }

  // Detector de cortes (móvil): si el audio se queda sin datos, su reloj se
  // queda atrás respecto al reloj real PARA SIEMPRE. La marca de tiempo tiene
  // un temblor de hasta ~1 búfer (solo hacia arriba), así que se compara el
  // MÍNIMO de cada ventana de ~0,5 s: el temblor no lo mueve, un corte sí.
  watchGlitches() {
    if (!this.ctx.getOutputTimestamp || !this.playing || document.visibilityState !== 'visible') {
      this.driftBase = undefined;
      this.driftWin = [];
      return;
    }
    const ts = this.ctx.getOutputTimestamp();
    if (!ts.contextTime) return;
    const drift = ts.performanceTime / 1000 - ts.contextTime;
    this.driftWin = this.driftWin || [];
    this.driftWin.push(drift);
    if (this.driftWin.length < 20) return;
    const winMin = Math.min(...this.driftWin);
    this.driftWin = [];
    if (this.driftBase === undefined || winMin < this.driftBase) this.driftBase = winMin;
    else if (winMin - this.driftBase > 0.02) {
      this.glitches++;
      this.driftBase = winMin;
    }
  }

  // Margen adaptativo (móvil): si el hilo principal se atasca y el reloj llega
  // tarde, programa más por adelantado; tras 20 s tranquilos, vuelve a bajar.
  adaptLookahead() {
    const w = performance.now();
    const gap = this.lastWall ? w - this.lastWall : 0;
    this.lastWall = w;
    if (document.visibilityState !== 'visible') return;
    if (gap > PROFILE.tickMs * 3) {
      this.lookahead = Math.min(PROFILE.lookaheadMax, this.lookahead + 0.05);
      this.calmSince = w;
    } else if (w - (this.calmSince || 0) > 20000 && this.lookahead > PROFILE.lookahead) {
      this.lookahead = Math.max(PROFILE.lookahead, this.lookahead - 0.025);
      this.calmSince = w;
    }
  }

  tick() {
    const now = this.ctx.currentTime;
    const dt = Math.min(0.1, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    if (PROFILE.lite) {
      this.watchGlitches();
      this.adaptLookahead();
    }

    const nextBeat = this.playing ? this.nextGrid + ((4 - (this.step % 4)) % 4) * this.stepDur : now;
    const act = this.active;
    for (const d of act) d.update(now, dt, nextBeat);

    if (!this.playing) return;
    while (this.nextGrid < now + this.lookahead) {
      if (this.step % 16 === 0 && this.scaleNext !== null) { this.scaleI = this.scaleNext; this.scaleNext = null; }
      for (const d of act) d.scheduleStep(this.step, this.nextGrid);
      this.nextGrid += this.stepDur;
      this.step++;
    }
  }
}
