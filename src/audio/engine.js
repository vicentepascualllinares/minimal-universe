// MOTOR — el reloj común, el BPM, la tonalidad y la escala globales, los dos
// universos y la mesa de mezcla. Los universos comparten la misma rejilla, así
// que siempre van en fase.

import { makeNoise } from './voices.js';
import { Deck } from './deck.js';
import { Strip, faderGain } from './strip.js';
import { SCALES } from '../music/emotion.js';
import { PROFILE } from '../core/profile.js';

const LOOKAHEAD = PROFILE.lookahead; // s (más en móvil: aguanta tirones del hilo principal)
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const scaleIdx = (v) => Math.max(0, Math.min(SCALES.length - 1, Math.floor(((v + 1) / 2) * SCALES.length)));

export class Engine {
  constructor() {
    this.ready = false;
    this.playing = false;
    this.bpm = 124;
    this.rootMidi = 28 + Math.floor(Math.random() * 6); // E1..A1: el kick se afina aquí
    this.scaleI = 1;
    this.step = 0;
    this.glitches = 0;
    this.mode = 'dj'; // 'solo' = un universo | 'dj' = dos universos + mezcla
    this.decks = [
      new Deck(this, 'A', { x: 0.62, y: 0.14, v: -0.3, a: -0.25 }),
      new Deck(this, 'B', { x: 0.8, y: 0.55, v: 0.2, a: 0.15 }),
    ];
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

    // master: suma -> glue -> limitador
    this.sum = ctx.createGain();
    this.sum.gain.value = 0.85;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16; glue.ratio.value = 2.4; glue.knee.value = 8;
    glue.attack.value = 0.012; glue.release.value = 0.18;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.ratio.value = 20; limiter.knee.value = 0;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.sum.connect(glue).connect(limiter).connect(this.analyser).connect(ctx.destination);

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

  stop() { this.playing = false; }

  // Escala global: manda el universo que más se oye (valencia ponderada por fader).
  // Con histéresis para que no parpadee en las fronteras entre modos.
  updateScale() {
    const act = this.active;
    let w = 0, v = 0;
    act.forEach((d, i) => {
      const g = faderGain(this.mix[i].fader);
      w += g;
      v += g * d.emotion.v;
    });
    v = w > 1e-3 ? v / w : act.reduce((s, d) => s + d.emotion.v, 0) / act.length;
    const lo = scaleIdx(v - 0.06);
    const hi = scaleIdx(v + 0.06);
    if (lo === hi && lo !== this.scaleI) this.scaleI = lo;
  }

  // Detector de cortes (móvil): si el reloj de audio se queda atrás respecto al
  // reloj real, el audio se ha quedado sin datos = un corte que se oye.
  watchGlitches() {
    if (!this.ctx.getOutputTimestamp || !this.playing || document.visibilityState !== 'visible') {
      this.driftBase = undefined;
      return;
    }
    const ts = this.ctx.getOutputTimestamp();
    if (!ts.contextTime) return;
    const drift = ts.performanceTime / 1000 - ts.contextTime;
    if (this.driftBase === undefined || drift < this.driftBase) this.driftBase = drift;
    else if (drift - this.driftBase > 0.04) {
      this.glitches++;
      this.driftBase = drift;
    }
  }

  tick() {
    const now = this.ctx.currentTime;
    const dt = Math.min(0.1, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    if (PROFILE.lite) this.watchGlitches();

    this.updateScale();
    const nextBeat = this.playing ? this.nextGrid + ((4 - (this.step % 4)) % 4) * this.stepDur : now;
    const act = this.active;
    for (const d of act) d.update(now, dt, nextBeat);

    if (!this.playing) return;
    while (this.nextGrid < now + LOOKAHEAD) {
      for (const d of act) d.scheduleStep(this.step, this.nextGrid);
      this.nextGrid += this.stepDur;
      this.step++;
    }
  }
}
