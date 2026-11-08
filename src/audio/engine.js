// MOTOR — el reloj común, el BPM, la tonalidad y la escala globales, los dos
// universos y la mesa de mezcla. Los universos comparten la misma rejilla, así
// que siempre van en fase.

import { makeNoise } from './voices.js';
import { Deck } from './deck.js';
import { Strip, easyGains } from './strip.js';
import { LowRoles } from './lowRoles.js';
import { SCALES } from '../music/emotion.js';
import { INSTRUMENTS } from '../music/arrangement.js';
import { glide, ceiling } from './dsp.js';
import { PROFILE } from '../core/profile.js';
import { QUALITY_MODES } from './quality.js';
import { Recorder } from './recorder.js';

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ── BÚFER DE AUDIO (OPCIONES → RENDIMIENTO)
// El navegador fija el búfer al crear el contexto de audio y no deja cambiarlo
// después. Para cambiarlo se rehace solo el audio (como Ableton al cambiar el
// búfer): la música (universos, escenas, mezcla) sigue igual y vuelve en un compás.
// AUTO empieza en ESTABLE y sube un escalón si hay cortes seguidos; nunca baja solo.
// Lo elegido se guarda en ESE navegador: es un ajuste del aparato, no de la cuenta.
export const BUFFER_MODES = {
  auto: { label: 'AUTO', desc: 'se ajusta solo: empieza estable y sube si hay cortes' },
  bajo: { label: 'BAJO', desc: '~10 ms · ordenadores potentes y MIDI · puede dar cortes' },
  estable: { label: 'ESTABLE', desc: '~50 ms · el equilibrio · no se nota al tocar' },
  maximo: { label: 'MÁXIMO', desc: '~170 ms · ordenadores flojos · más retraso al tocar' },
};
// MÁXIMO en número, no 'playback': en Chrome para Windows 'playback' da ~21 ms (menos que
// ESTABLE). Pedir 0,2 s da el tope del equipo (~171 ms en el PC de desarrollo).
const MAX_HINT = 0.2;
const AUTO_STEPS = [PROFILE.stableHint, 0.1, MAX_HINT]; // escalones de AUTO
const AUTO_TRIGGER = { cortes: 3, window: 60000, calm: 10000 }; // 3 cortes en 60 s; 10 s de gracia tras rehacer

// MARGEN DE PROGRAMACIÓN (OPCIONES → RENDIMIENTO): cuánto se adelanta el programa al
// preparar las notas. Más margen = aguanta mejor que el ordenador se atasque (menos TARDE),
// pero un gesto tarda más en oírse. AUTO empieza en el del perfil y sube solo si hay atascos.
export const MARGIN_MODES = {
  auto: { label: 'AUTO', desc: 'empieza en ~120 ms y sube solo si el ordenador se atasca' },
  corto: { label: 'CORTO', desc: '60 ms · responde antes · más riesgo de notas TARDE' },
  normal: { label: 'NORMAL', desc: '120 ms · el de siempre' },
  largo: { label: 'LARGO', desc: '250 ms · ordenadores que se atascan' },
};
const MARGIN_S = { corto: 0.06, normal: 0.12, largo: 0.25 };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

export class Engine {
  constructor() {
    this.ready = false;
    this.playing = false;
    this.bpm = 124;
    this.rootMidi = 28 + Math.floor(Math.random() * 6); // E1..A1: el kick se afina aquí
    this.scaleI = 1;          // eólico
    this.scaleNext = null;    // cambio de modo pedido: entra al empezar el siguiente compás
    this.step = 0;
    this.glitches = 0;  // CORTES: el audio se quedó sin datos (DSP demasiado pesado)
    this.late = 0;      // TARDE: pasos programados tarde (hilo principal atascado)
    this.rec = new Recorder(); // GRABAR (ver recorder.js)
    this.generated = false;    // ¿se ha pulsado GENERAR alguna vez? (hasta entonces no suena nada)
    this.meters = { cortes: true, tarde: true }; // OPCIONES → RENDIMIENTO: qué se ve en la cabecera (miden siempre)
    // búfer y salida de audio (ver BUFFER_MODES)
    const bm = store.get('mu.buffer');
    this.bufferMode = PROFILE.forceMaxBuffer ? 'maximo' : BUFFER_MODES[bm] ? bm : 'auto';
    this.autoStep = Math.min(AUTO_STEPS.length - 1, Math.max(0, Number(store.get('mu.bufferAuto')) || 0));
    this.bufferNote = '';     // aviso para OPCIONES (p. ej. AUTO subió)
    this.glitchTimes = [];    // cuándo hubo cortes (para AUTO)
    this.lastRebuild = 0;
    this.rebuilding = false;
    this.sinkId = store.get('mu.sink') || ''; // salida de audio ('' = la del sistema)
    // CALIDAD DEL MOTOR (ver quality.js): NORMAL en ordenador, LIGERA en móvil. Se guarda en el navegador
    const qm = store.get('mu.quality');
    this.qualityMode = QUALITY_MODES[qm] ? qm : PROFILE.lite ? 'ligera' : 'normal';
    const mm = store.get('mu.margin');
    this.marginMode = MARGIN_MODES[mm] ? mm : 'auto';
    this.lookahead = MARGIN_S[this.marginMode] ?? PROFILE.lookahead; // s programados por adelantado
    this.mode = 'dj'; // 'solo' = un universo | 'dj' = dos universos + mezcla
    this.decks = [
      // los dos arrancan en SOLO DRUMS: la entrada natural de un tema (y para mezclar)
      new Deck(this, 'A', { scene: 'drums', v: -0.3, a: -0.25 }),
      new Deck(this, 'B', { scene: 'drums', v: 0.2, a: 0.15 }),
    ];
    this.decks[1].newCharacter(this.decks[1].seed); // B arranca con su propio carácter
    this.eqType = 'iso'; // EQ de la mesa DJ: 'iso' (silencia, −∞) | 'eq' (atenúa, −26 dB)
    // MIXER global: ganancia por instrumento, igual para todos los universos (1 = 0 dB = el perfil por defecto)
    this.inst = Object.fromEntries(INSTRUMENTS.map((k) => [k, 1]));
    // estado de la mesa (lo que muestran los controles)
    this.mix = [
      { fader: 1, hi: 0.5, mid: 0.5, lo: 0.5, filter: 0.5 },
      { fader: 0, hi: 0.5, mid: 0.5, lo: 0.5, filter: 0.5 },
    ];
    // EASY EQ (DJ): en vez de la EQ de cada canal, una perilla por banda que cruza de A (0) a
    // B (1). Empieza todo en A, como los faders de siempre. Se recuerda entre sesiones.
    this.easyEq = store.get('mu.easyEq') !== '0';
    this.xf = { hi: 0, mid: 0, lo: 0 };
    this.low = new LowRoles(this); // LOW reparte los papeles KICK y BAJO (ver lowRoles.js)
  }

  get easyOn() { return this.easyEq && this.mode === 'dj'; }

  // EASY EQ sí / no. Al encenderlo, los faders suben a tope: mandan las perillas
  setEasyEq(on) {
    this.easyEq = on;
    store.set('mu.easyEq', on ? '1' : '0');
    if (on) for (let i = 0; i < 2; i++) this.setMix(i, 'fader', 1);
    this.applyEq();
  }

  setXf(band, x) {
    if (band === 'lo') this.low.move(x);
    this.xf[band] = x;
    this.applyEq([band]);
  }

  // la ganancia de cada banda en los canales: de las perillas EASY EQ o de la EQ de cada uno
  applyEq(bands = ['hi', 'mid', 'lo']) {
    if (!this.ready) return;
    for (const k of bands) {
      if (this.easyOn) {
        const g = easyGains(k, this.xf[k]);
        this.strips.forEach((s, i) => s.setBandGain(k, g[i]));
      } else {
        this.strips.forEach((s, i) => s.set(k, this.mix[i][k]));
      }
    }
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

  // qué se le pide al navegador según el modo de búfer
  latencyHint() {
    const m = this.bufferMode;
    if (m === 'bajo') return 'interactive';
    if (m === 'maximo') return MAX_HINT;
    if (m === 'estable') return PROFILE.stableHint;
    return AUTO_STEPS[this.autoStep];
  }

  // elegir modo de búfer en OPCIONES: se guarda y se rehace el audio
  setBufferMode(m) {
    if (!BUFFER_MODES[m]) return;
    this.bufferMode = m;
    store.set('mu.buffer', m);
    if (m === 'auto') { // elegir AUTO a mano: vuelve a aprender desde ESTABLE
      this.autoStep = 0;
      store.set('mu.bufferAuto', '0');
    }
    this.bufferNote = '';
    this.rebuildAudio();
  }

  get q() { return QUALITY_MODES[this.qualityMode]; }

  // elegir MARGEN en OPCIONES: se aplica al momento (no hace falta rehacer el audio)
  setMarginMode(m) {
    if (!MARGIN_MODES[m]) return;
    this.marginMode = m;
    store.set('mu.margin', m);
    this.lookahead = MARGIN_S[m] ?? PROFILE.lookahead;
  }

  // elegir CALIDAD en OPCIONES: se guarda y se rehace el audio (como el búfer)
  setQualityMode(m) {
    if (!QUALITY_MODES[m] || m === this.qualityMode) return;
    this.qualityMode = m;
    store.set('mu.quality', m);
    this.rebuildAudio();
  }

  // lo que ha dado de verdad este equipo (s); null si aún no hay audio
  latencyInfo() {
    if (!this.ready) return null;
    const base = this.ctx.baseLatency || 0;
    const out = this.ctx.outputLatency || 0;
    return { base, out, lookahead: this.lookahead, total: base + out + this.lookahead };
  }

  // SALIDA DE AUDIO (Chrome / Edge): tarjeta o auriculares. '' = la del sistema
  get canPickOutput() { return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype; }
  async setOutput(id) {
    this.sinkId = id;
    store.set('mu.sink', id);
    if (this.ready && this.ctx.setSinkId) await this.ctx.setSinkId(id);
  }

  // Rehacer el audio con el búfer actual sin tocar la música: se cierra el contexto
  // de audio, se crea otro y cada universo vuelve a montar sus canales. Si sonaba,
  // vuelve a sonar al empezar el siguiente compás (hueco de unas décimas).
  async rebuildAudio() {
    if (!this.ready || this.rebuilding) return;
    this.rebuilding = true;
    const wasPlaying = this.playing;
    this.playing = false;
    this.ready = false;
    this.worker.postMessage('stop');
    this.worker.terminate();
    try { await this.ctx.close(); } catch {}
    try {
      await this.init();
      this.glitchTimes = [];
      this.lastRebuild = performance.now();
      if (wasPlaying) await this.play();
    } finally {
      this.rebuilding = false;
    }
  }

  // AUTO: varios cortes seguidos = subir un escalón de búfer
  autoBuffer() {
    const now = performance.now();
    if (this.bufferMode !== 'auto' || now - this.lastRebuild < AUTO_TRIGGER.calm) return;
    this.glitchTimes = this.glitchTimes.filter((t) => now - t < AUTO_TRIGGER.window);
    this.glitchTimes.push(now);
    if (this.glitchTimes.length < AUTO_TRIGGER.cortes || this.autoStep >= AUTO_STEPS.length - 1) return;
    this.autoStep++;
    store.set('mu.bufferAuto', String(this.autoStep));
    this.bufferNote = `AUTO subió el búfer por cortes (escalón ${this.autoStep + 1} de ${AUTO_STEPS.length})`;
    this.bufferNoteAt = performance.now(); // la cabecera lo avisa unos segundos: el hueco no es un fallo
    this.rebuildAudio();
  }

  async init() {
    if (this.ready) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: this.latencyHint() }));
    // salida elegida antes (si ya no existe, vuelve a la del sistema)
    if (this.sinkId && ctx.setSinkId) ctx.setSinkId(this.sinkId).catch(() => { this.sinkId = ''; store.set('mu.sink', ''); });
    this.driftBase = undefined;
    this.driftWin = [];
    this.lastWall = 0; // el MARGEN en AUTO no cuenta como atasco el hueco de rehacer el audio
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
    // TECHO: red de seguridad tras el limitador (ver dsp.js): nunca pasa de ±1
    const ceil = ceiling(ctx);
    monoLow.connect(glue).connect(limiter).connect(ceil.input);
    ceil.output.connect(this.analyser).connect(ctx.destination);
    this.rec.attach(ctx, ceil.output); // GRABAR escucha justo lo que sale

    this.strips = this.active.map((d, i) => {
      const s = new Strip(ctx, this.sum, this.eqType);
      for (const [k, v] of Object.entries(this.mix[i])) {
        if (this.easyOn && k in this.xf) s.setBandGain(k, easyGains(k, this.xf[k])[i]); // EASY EQ
        else s.set(k, v);
      }
      d.initAudio(ctx, s.input);
      return s;
    });
    this.low.reset(); // canales nuevos: los papeles de graves se vuelven a escribir

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

  // OPCIONES → DJ: tipo de EQ de la mesa (como en rekordbox)
  setEqType(t) {
    this.eqType = t;
    if (this.ready) this.strips.forEach((s) => s.setEqType(t));
    if (this.easyOn) this.applyEq(); // con EASY EQ mandan sus perillas
  }

  setMix(i, key, v) {
    this.mix[i][key] = v;
    if (!this.ready) return;
    if (this.easyOn && key in this.xf) return; // con EASY EQ la EQ del canal no suena
    this.strips[i].set(key, v);
  }

  // preparar el audio SIN generar música (al elegir modo): así se puede armar GRABAR antes
  async prepare() {
    await this.init();
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  // GENERAR / seguir
  async play() {
    await this.prepare();
    if (this.playing) return;
    this.generated = true;
    // retomar siempre en el inicio de un compás: las frases siguen alineadas
    this.step = Math.ceil(this.step / 16) * 16;
    this.nextGrid = this.ctx.currentTime + 0.08;
    this.driftBase = undefined;
    this.settleUntil = performance.now() + 2000; // el detector de CORTES espera a que se asiente
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

  // Detector de cortes: si el audio se queda sin datos, su reloj se
  // queda atrás respecto al reloj real PARA SIEMPRE. La marca de tiempo tiene
  // un temblor de hasta ~1 búfer (solo hacia arriba), así que se compara el
  // MÍNIMO de cada ventana de ~0,5 s: el temblor no lo mueve, un corte sí.
  watchGlitches() {
    // (también los 2 s después de arrancar o rehacer el audio: mientras se asienta, el reloj
    // salta y daría un CORTE falso)
    if (!this.ctx.getOutputTimestamp || !this.playing || document.visibilityState !== 'visible'
        || performance.now() < this.settleUntil) {
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
      this.autoBuffer();
    }
  }

  // MARGEN en AUTO: si el hilo principal se atasca y el reloj llega
  // tarde, programa más por adelantado; tras 20 s tranquilos, vuelve a bajar.
  adaptLookahead() {
    const w = performance.now();
    const gap = this.lastWall ? w - this.lastWall : 0;
    this.lastWall = w;
    // pestaña oculta o recién arrancado (el arranque atasca un instante y no es un problema)
    if (document.visibilityState !== 'visible' || w < (this.settleUntil || 0)) return;
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
    this.watchGlitches(); // en todos los perfiles: el medidor de la cabecera (ver RENDIMIENTO.md)
    if (this.marginMode === 'auto') this.adaptLookahead();

    const act = this.active;
    for (const d of act) d.update(now, dt);

    if (!this.playing) return this.low.apply(now); // parado: los papeles de graves, ya
    while (this.nextGrid < now + this.lookahead) {
      // TARDE: el hilo principal se atascó y este paso ya debería estar sonando
      // (sus notas salen desplazadas). Distinto de un CORTE (el audio sin datos).
      if (this.nextGrid < now) this.late++;
      if (this.step % 16 === 0 && this.scaleNext !== null) { this.scaleI = this.scaleNext; this.scaleNext = null; }
      // EASY EQ · GRAVES: un cambio de dueño del kick o del bajo entra en el tiempo, antes de sus notas
      if (this.step % 4 === 0) this.low.apply(this.nextGrid);
      for (const d of act) d.scheduleStep(this.step, this.nextGrid);
      this.nextGrid += this.stepDur;
      this.step++;
    }
  }
}
