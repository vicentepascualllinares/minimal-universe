// MOTOR — el reloj común, el BPM, la tonalidad y la escala globales, los dos
// universos y la mesa de mezcla. Los universos comparten la misma rejilla, así
// que siempre van en fase.

import { makeNoise } from './voices.js';
import { SoundBank } from './soundBank.js';
import { Deck } from './deck.js';
import { makeSlot, inSlot } from './slots.js';
import { Strip, easyGains, easyX, bandGain, bandValue, faderGain } from './strip.js';
import { LowRoles } from './lowRoles.js';
import { SCALES } from '../music/emotion.js';
import { INSTRUMENTS, MIX_CHANNELS } from '../music/arrangement.js';
import { glide, ceiling } from './dsp.js';
import { PROFILE } from '../core/profile.js';
import { QUALITY_MODES } from './quality.js';
import { Recorder } from './recorder.js';
import { MIX_PRESETS, DEFAULT_MIX } from './mix.js';
import { FADER_ZERO, dbFader, dbGain } from '../core/fader.js';

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// headroom de la suma: con la GANANCIA DEL MÁSTER a 0 dB, el máster ronda −12 LUFS y los picos
// quedan por debajo de −1 dBFS
const HEADROOM = 0.72;

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
  // `motors` = el registro de MOTORES (src/motores/index.js): qué Deck y qué banco de sonidos hace
  // sonar cada universo. Sin él (las herramientas de Node, o la copia congelada de un motor corriendo
  // sola), un solo motor: el de esta carpeta
  constructor({ motors, dev } = {}) {
    this.motors = motors ?? { 0: { Deck, SoundBank } };
    this.multi = !!motors;
    this.devMotor = dev ?? Math.max(...Object.keys(this.motors).map(Number)); // el de NUEVO UNIVERSO de partida
    this.banks = {}; // un BANCO DE SONIDOS por motor (ver bankOf)
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
    // OPCIONES → AUTO-ARREGLOS: trucos de producción que el programa hace solo, en vivo.
    // kickGap = HUECO ANTES DEL KICK (ver Deck.kickGap); kickDrop = CAÍDA DEL KICK AL FINAL DE
    // FRASE (ver Deck.kickDrop); bassOut, lowsDip y breakDip, ver Deck.autoArrange.
    // Aún no se guardan: vendrá con las cuentas
    this.auto = {
      kickGap: true, kickGapS: 0.03,
      kickDrop: true, kickDropBars: 16,
      bassOut: true,
      lowsDip: true, lowsDb: -6,
      breakDip: true, breakDb: -1.5,
    };
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
    // los dos PUESTOS (slots.js): cada uno con el Deck del motor del universo que suena
    this.decks = [
      // los dos arrancan en INTRO: la entrada natural de un tema (y para mezclar)
      makeSlot(this, 0, 'A', { scene: 'intro', v: -0.3, a: -0.25 }, this.devMotor),
      makeSlot(this, 1, 'B', { scene: 'intro', v: 0.2, a: 0.15 }, this.devMotor),
    ];
    this.decks[1].newCharacter(this.decks[1].seed); // B arranca con su propio carácter
    this.eqType = 'iso'; // EQ de la mesa DJ: 'iso' (silencia, −∞) | 'eq' (atenúa, −26 dB)
    // MIXER: ganancia por instrumento de cada universo (1 = 0 dB = el pico máximo del
    // instrumento en 0 dBFS). Arranca con el preset por defecto (ver mix.js y applyMix).
    // En DJ van vinculados por defecto (lo decide la vista: ver instMixer)
    this.inst = [0, 1].map(() => Object.fromEntries(MIX_CHANNELS.map((k) => [k, 1]))); // (y los retornos DELAY y REVERB)
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
    // GANANCIA DEL MÁSTER (MIXER): antes del limitador, empuja la mezcla contra él (1 = 0 dB = como
    // sonaba siempre). Como el resto del MIXER, aún no se guarda (vendrá con las cuentas)
    this.masterGain = 1;
    // VOLUMEN DE FX por universo: ganancia (1 = 0 dB) y la posición de su fader, que comparten
    // la columna TRANSICIÓN del universo y el MIXER (ver setFxFader en instMixer.js)
    this.fxGain = [1, 1];
    this.mute = [new Set(), new Set()]; // MIXER: MUTE y SOLO (ver heard)
    this.solo = [new Set(), new Set()];
    this.fxPos = [FADER_ZERO, FADER_ZERO];
    this.applyMix(DEFAULT_MIX);
    // REGISTRO DE INCIDENCIAS (ver logIncident)
    try { this.incidents = JSON.parse(store.get('mu.incidents') || '[]'); } catch { this.incidents = []; }
    if (!Array.isArray(this.incidents)) this.incidents = [];
  }

  // MOTORES: un Deck del motor `m` (lo crea el puesto: slots.js)
  newDeck(m, id, opts) {
    const d = new this.motors[m].Deck(this, id, opts);
    d.motor = m;
    return d;
  }
  // en qué puesto suena (o espera) un Deck: 0 = A, 1 = B, −1 = ninguno
  slotOf(deck) { return this.decks.findIndex((p) => inSlot(p, deck)); }
  // el BANCO DE SONIDOS del motor de un Deck (soundBank.js de ese motor: graba con su drumsynth). Lo
  // comparten los universos del mismo motor; se crea al primer uso
  bankOf(deck) {
    const m = deck.motor ?? this.devMotor;
    let b = this.banks[m];
    if (!b) {
      b = this.banks[m] = new this.motors[m].SoundBank(this.ctx?.sampleRate ?? 48000);
      b.inUse = (k) => this.decks.some((p) => [p.slot?.inner ?? p, p.slot?.next].some((d) => d && d.motor === m && d.drums.uses(k)));
    }
    return b;
  }
  // un puesto acaba de cambiar de Deck (otro motor): sus canales, con el MIXER de ahora
  applySlotMix(i) {
    for (const k of MIX_CHANNELS) this.setInst(i, k, this.inst[i][k]);
    this.setFxGain(i, this.fxGain[i]);
  }

  // PRESET DE MEZCLA del MIXER (mix.js): pone los faders de los instrumentos y de FX de los dos
  // universos. El máster no lo toca. `mixVersion` avisa a las vistas para que sigan a los faders
  applyMix(name) {
    const P = MIX_PRESETS[name];
    if (!P) return;
    this.mixPreset = name;
    this.styleSaved = [null, null]; // la mezcla vuelve a ser tuya: un universo NORMAL ya no la restaura (ver styleMix)
    for (const i of [0, 1]) {
      for (const k of MIX_CHANNELS) this.setInst(i, k, dbGain(P.db[k]));
      this.fxPos[i] = dbFader(P.db.fx);
      this.setFxGain(i, dbGain(P.db.fx));
    }
    this.mixVersion = (this.mixVersion || 0) + 1;
  }

  // VOLUMEN DE FX de un universo (0 = A, 1 = B): sus efectos de transición (`at` = desde cuándo)
  setFxGain(i, g, at) {
    this.fxGain[i] = g;
    if (this.ready) this.decks[i].fx?.setLevel(g * this.heard(i, 'fx'), at);
  }

  // ESTILO (styles.js): la MEZCLA con la que nace un universo con estilo: los faders de sus
  // instrumentos y de FX (del preset que manda a la del estilo, según cuánto estilo) y sus MUTE (los
  // de sus instrumentos: los que pide el estilo y ninguno más; el de FX y los SOLO no se tocan). En el
  // tiempo `at`: el 1 del compás en que entra. El MIXER lo enseña (RETOCADA, los MUTE encendidos).
  // La mezcla que había ANTES del estilo se guarda: si luego nace un universo NORMAL, vuelve (faders
  // y MUTE de los instrumentos), así lo normal suena como siempre y no hereda los MUTE del estilo.
  // Elegir un preset en el MIXER la olvida: la mezcla vuelve a ser tuya (ver applyMix)
  styleMix(deck, sty, at) {
    const i = this.slotOf(deck);
    if (i < 0) return;
    const saved = (this.styleSaved ||= [null, null]);
    if (!(sty.t > 0)) {
      const S = saved[i];
      if (!S) return; // NORMAL tras NORMAL: el MIXER no se toca, como siempre
      saved[i] = null;
      for (const k of INSTRUMENTS) this.mute[i][S.mute.includes(k) ? 'add' : 'delete'](k);
      for (const k of MIX_CHANNELS) this.setInst(i, k, S.inst[k], at);
      this.fxPos[i] = S.fxPos;
      this.setFxGain(i, S.fxGain, at);
      this.mixVersion = (this.mixVersion || 0) + 1;
      return;
    }
    if (!saved[i]) saved[i] = { inst: { ...this.inst[i] }, mute: [...this.mute[i]], fxPos: this.fxPos[i], fxGain: this.fxGain[i] };
    const P = MIX_PRESETS[this.mixPreset].db;
    const lerpDb = (k) => P[k] + (sty.mix[k] - P[k]) * sty.t;
    for (const k of INSTRUMENTS) this.mute[i][sty.mutes.includes(k) ? 'add' : 'delete'](k);
    for (const k of MIX_CHANNELS) this.setInst(i, k, dbGain(lerpDb(k)), at);
    this.fxPos[i] = dbFader(lerpDb('fx'));
    this.setFxGain(i, dbGain(lerpDb('fx')), at);
    this.mixVersion = (this.mixVersion || 0) + 1; // las vistas del MIXER y el fader de FX lo siguen
  }

  // la MEZCLA con la que nacería un universo de estilo `sty` (como styleMix; para el PARECIDO,
  // similar.js). NORMAL no toca el MIXER: null
  bornMix(sty) {
    if (!(sty.t > 0)) return null;
    const P = MIX_PRESETS[this.mixPreset].db;
    const lerpDb = (k) => P[k] + (sty.mix[k] - P[k]) * sty.t;
    return {
      inst: Object.fromEntries(MIX_CHANNELS.map((k) => [k, dbGain(lerpDb(k))])),
      mute: [...sty.mutes], fxPos: dbFader(lerpDb('fx')), fxGain: dbGain(lerpDb('fx')),
    };
  }

  // UNIVERSO GUARDADO (Deck.loadUniverse, universe.js): al entrar, su MIXER (faders, MUTE de sus
  // instrumentos, FX) en el 1 de su compás. Tempo, tónica y modo, aparte (applyGlobals)
  universeLoaded(deck, u, at) {
    const i = this.slotOf(deck);
    if (i < 0) return;
    const M = u.mix;
    if (M) {
      for (const k of INSTRUMENTS) this.mute[i][M.mute?.includes(k) ? 'add' : 'delete'](k);
      for (const k of MIX_CHANNELS) if (M.inst?.[k] !== undefined) this.setInst(i, k, M.inst[k], at);
      if (M.fxPos !== undefined) this.fxPos[i] = M.fxPos;
      if (M.fxGain !== undefined) this.setFxGain(i, M.fxGain, at);
      this.mixVersion = (this.mixVersion || 0) + 1;
    }
  }
  // TEMPO, TÓNICA y MODO de un universo traído (solo si se pidió: Deck.loadUniverse). Al entrar, en el
  // 1 de su compás: el modo cambia ya (no en el compás siguiente). En DJ cambian para los dos
  applyGlobals(G) {
    if (G.bpm) this.bpm = G.bpm;
    if (G.rootMidi !== undefined) this.rootMidi = G.rootMidi;
    if (G.scaleI !== undefined) { this.scaleI = G.scaleI; this.scaleNext = null; }
  }

  // MUTE y SOLO del MIXER, por universo e instrumento (`k` = un instrumento o 'fx'). Solo "en su
  // sitio": si hay alguno en SOLO, se oyen solo esos (de los dos universos). Actúan después del
  // fader (no lo mueven) y con una rampa corta: sin clics. No se guardan
  heard(i, k) {
    const anySolo = this.solo[0].size + this.solo[1].size > 0;
    return !this.mute[i].has(k) && (!anySolo || this.solo[i].has(k)) ? 1 : 0;
  }
  // ENVÍO (perillas del MIXER): cuánto manda el elemento `k` del universo `i` al efecto `fx`
  // ('dly' | 'rev' | 'bg'), en ganancia. Se escribe en el espacio del universo que suena: el
  // siguiente nace con los suyos (como los faders con la mezcla del estilo)
  setSend(i, fx, k, g) {
    const d = this.decks[i];
    d.space[fx].send[k] = g;
    if (this.ready) d.spaceFx?.updateSend(fx, k);
  }
  // `which` = 'mute' | 'solo'; `on` = encender o apagar
  setMuteSolo(which, i, k, on) {
    this[which][i][on ? 'add' : 'delete'](k);
    this.applyHeard();
  }
  clearMuteSolo() {
    for (const s of [...this.mute, ...this.solo]) s.clear();
    this.applyHeard();
  }
  applyHeard() {
    for (const i of [0, 1]) {
      for (const k of MIX_CHANNELS) this.setInst(i, k, this.inst[i][k]);
      this.setFxGain(i, this.fxGain[i]);
    }
    this.mixVersion = (this.mixVersion || 0) + 1; // las vistas del MIXER se redibujan
  }

  setMasterGain(g) {
    this.masterGain = g;
    if (this.ready) glide(this.sum.gain, HEADROOM * g, this.ctx.currentTime, 0.02);
  }

  // MEDIDOR DEL MÁSTER: pico de L y R de lo que sale de verdad (tras el techo)
  masterPeaks() {
    if (!this.ready) return [0, 0];
    return this.outMeters.map((a) => {
      a.getFloatTimeDomainData(this.outBuf);
      let p = 0;
      for (let i = 0; i < this.outBuf.length; i++) p = Math.max(p, Math.abs(this.outBuf[i]));
      return p;
    });
  }

  // lo que está quitando ahora el limitador del máster (dB, ≥ 0). PROVISIONAL: en la sesión de
  // mezcla y máster (cadenas de clippers y limitadores) hay que replantear qué se mide aquí
  limiterGr() {
    if (!this.ready) return 0;
    const r = this.limiter.reduction;
    return Math.max(0, -(typeof r === 'number' ? r : r.value)); // en navegadores viejos era un AudioParam
  }

  get easyOn() { return this.easyEq && this.mode === 'dj'; }

  // EASY EQ sí / no. Al cambiar se traduce lo que suena, para que no salte:
  //   EASY → normal: la EQ de cada canal da la misma ganancia que daban las perillas; los
  //     silencios de papel de LOW se heredan hasta que dejan de hacer falta (ver lowRoles)
  //   normal → EASY: cada perilla, donde da la misma proporción A : B (fader × EQ); los dos
  //     faders, al del universo que más sonaba; si sonaban dos bajos (o dos kicks), se queda
  //     el del universo con más graves y el otro se va en el siguiente tiempo
  // EASY no puede expresar "los dos recortados" ni realces: ahí se conserva la proporción.
  setEasyEq(on) {
    if (on === this.easyEq) return;
    const BANDS = ['hi', 'mid', 'lo'];
    if (on) {
      const lv = (i, k) => faderGain(this.mix[i].fader) * bandGain(this.mix[i][k], this.eqType);
      for (const k of BANDS) this.xf[k] = easyX(lv(0, k), lv(1, k), this.xf[k]);
      const F = Math.max(this.mix[0].fader, this.mix[1].fader);
      for (let i = 0; i < 2; i++) this.setMix(i, 'fader', F);
      this.low.enterEasy(lv(0, 'lo'), lv(1, 'lo'));
    } else {
      for (const k of BANDS) {
        const g = easyGains(k, this.xf[k]);
        for (let i = 0; i < 2; i++) this.mix[i][k] = bandValue(g[i], this.eqType);
      }
      this.low.leaveEasy();
    }
    this.easyEq = on;
    store.set('mu.easyEq', on ? '1' : '0');
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
    if (m === 'dj' && this.easyEq) this.mix[1].fader = 1; // EASY EQ: faders a tope, mandan las perillas (en A)
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
    // si la salida de audio se ha quedado colgada, cerrar puede no acabar nunca: como mucho 1 s
    try { await Promise.race([this.ctx.close(), new Promise((r) => setTimeout(r, 1000))]); } catch {}
    try {
      // un fallo al montar el audio dejaba el programa mudo para siempre: se reintenta una vez
      try { await this.init(); }
      catch (e) {
        this.logIncident('error', `al rehacer el audio: ${e?.message || e} · se reintenta`);
        await new Promise((r) => setTimeout(r, 500));
        await this.init();
      }
      this.glitchTimes = [];
      this.lastRebuild = performance.now();
      if (wasPlaying) await this.play();
    } finally {
      this.rebuilding = false;
    }
  }

  // ── VIGILANTE DEL AUDIO (ver RENDIMIENTO.md §10)
  // Un solo valor no numérico (NaN) en cualquier punto de la cadena se queda atrapado para
  // siempre en los nodos con memoria que suenan sin parar (filtros de transición, EQ de la mesa,
  // glue, limitador, sobremuestreo de la saturación): el máster queda MUDO aunque todo lo demás
  // siga funcionando. Comprobado: una muestra NaN en el bajo de A silencia todo. No hay forma de
  // vaciar esos nodos: se rehace el audio (la música sigue en el siguiente compás).
  // También: el reloj del audio parado o el contexto suspendido por el sistema.
  watchAudio(now) {
    const w = performance.now();
    if (this.rebuilding || w < (this.settleUntil || 0)) return;
    // 1) NaN en la salida: una vez atrapado lo llena todo, basta mirar tres muestras
    const a = this.outMeters[0];
    a.getFloatTimeDomainData(this.outBuf);
    const b = this.outBuf;
    if (!Number.isFinite(b[0]) || !Number.isFinite(b[1024]) || !Number.isFinite(b[2047])) {
      return this.recover('nan', 'la salida dejó de dar números (NaN)');
    }
    // 2) el contexto, suspendido o interrumpido por el sistema mientras suena
    if (this.playing && this.ctx.state !== 'running') {
      if (!this.resumeAt) {
        this.resumeAt = w;
        this.logIncident('estado', `el sistema puso el audio en «${this.ctx.state}» · se reanuda`);
        this.ctx.resume().catch(() => {});
      } else if (w - this.resumeAt > 3000) {
        this.resumeAt = 0;
        this.recover('estado', `el audio sigue en «${this.ctx.state}» tras reanudar`);
      }
      return;
    }
    this.resumeAt = 0;
    // 3) el reloj del audio parado (el contexto dice que va, pero no avanza)
    if (now !== this.clockLast) { this.clockLast = now; this.clockAt = w; }
    else if (this.playing && document.visibilityState === 'visible' && w - this.clockAt > 1500) {
      this.clockAt = w;
      this.recover('reloj', 'el reloj del audio se paró');
    }
  }

  // rehacer el audio por un fallo, apuntando dónde estaba (si se repite enseguida, espera:
  // no se rehace en bucle)
  async recover(type, detail) {
    const w = performance.now();
    if (this.rebuilding || w - (this.recoverAt || 0) < 5000) return;
    this.recoverAt = w;
    const where = type === 'nan' ? await this.findNaN() : '';
    this.logIncident(type, detail + (where ? ` · atascado en: ${where}` : '') + ' · audio rehecho');
    this.recoveredAt = performance.now(); // la cabecera lo avisa unos segundos
    this.rebuildAudio();
  }

  // dónde está atrapado el NaN, de lo primero a lo último de la cadena (para saber de dónde vino)
  async findNaN() {
    const ctx = this.ctx;
    const pts = [];
    this.active.forEach((d, i) => {
      const id = 'AB'[i];
      for (const k of Object.keys(d.ch)) pts.push([`${id} ${k}`, d.ch[k].out]);
      for (const k of Object.keys(d.spaceFx.ret)) pts.push([`${id} retorno ${k}`, d.spaceFx.ret[k].out]);
      pts.push([`${id} saturación`, d.sat.output], [`${id} transición`, d.fx.f.gap], [`${id} mesa`, this.strips[i].fader]);
    });
    pts.push(['máster suma', this.sum], ['glue', this.glue], ['limitador', this.limiter]);
    const probes = pts.map(([name, node]) => {
      const a = ctx.createAnalyser();
      a.fftSize = 256;
      node.connect(a);
      return { name, a, node };
    });
    await new Promise((r) => setTimeout(r, 80)); // que pase sonido por las sondas
    const buf = new Float32Array(256);
    const bad = probes.filter(({ a }) => { a.getFloatTimeDomainData(buf); return buf.some((v) => !Number.isFinite(v)); });
    probes.forEach(({ a, node }) => { try { node.disconnect(a); } catch {} });
    return bad.map((p) => p.name).join(', ');
  }

  // REGISTRO DE INCIDENCIAS: fallos del audio, con la hora y lo que sonaba. Se guarda en este
  // navegador (las últimas 30) y se ve en OPCIONES → RENDIMIENTO. Sirve para saber qué pasó
  // cuando algo suena mal y no se pudo ver en el momento.
  logIncident(type, detail) {
    const d = this.decks.map((x) => `${x.id}:${x.arr?.home ?? '?'}`).join(' ');
    const g = this.masterGain > 0 ? 20 * Math.log10(this.masterGain) : -Infinity;
    const ctxInfo = `${this.mode} · ${d} · búfer ${this.bufferMode} · calidad ${this.qualityMode} · máster ${g.toFixed(1)} dB · cortes ${this.glitches} · tarde ${this.late}`;
    const it = { t: new Date().toISOString(), type, detail, ctx: ctxInfo };
    this.incidents.push(it);
    while (this.incidents.length > 30) this.incidents.shift();
    store.set('mu.incidents', JSON.stringify(this.incidents));
    console.warn(`[INCIDENCIA] ${type}: ${detail} (${ctxInfo})`);
  }
  clearIncidents() {
    this.incidents = [];
    store.set('mu.incidents', '[]');
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
    this.logIncident('cortes', this.bufferNote);
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
    // BANCOS DE SONIDOS de hats y percs (soundBank.js; uno por motor, ver bankOf): para los dos
    // universos. Sobreviven a rehacer el audio; solo se rehacen si cambia la frecuencia de muestreo
    if (Object.values(this.banks).some((b) => b.sr !== ctx.sampleRate)) {
      for (const b of Object.values(this.banks)) b.dispose();
      this.banks = {};
    }

    // master: suma -> graves en mono -> glue -> limitador
    this.sum = ctx.createGain();
    this.sum.gain.value = HEADROOM * this.masterGain; // con la GANANCIA DEL MÁSTER
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
    // MEDIDOR DEL MÁSTER: L y R por separado (un analizador solo mezclaría los dos a mono)
    const split = ctx.createChannelSplitter(2);
    ceil.output.connect(split);
    this.outMeters = [0, 1].map((c) => {
      const a = ctx.createAnalyser();
      a.fftSize = 2048; // ~43 ms: más que un fotograma, no se escapa ningún pico
      split.connect(a, c);
      return a;
    });
    this.outBuf = new Float32Array(2048);

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

  // MIXER: volumen de un instrumento (o de un retorno: DELAY, REVERB) en el universo i (0 = A,
  // 1 = B). `at` = desde cuándo (por defecto, ya; un universo que nace con estilo lo pone en el 1 de
  // su compás)
  setInst(i, k, gain, at) {
    this.inst[i][k] = gain;
    const c = this.decks[i].mixChannel(k);
    if (this.ready && c) glide(c.user.gain, gain * this.heard(i, k), Math.max(at ?? 0, this.ctx.currentTime), 0.02);
  }
  // lo que deja pasar el MIXER en un canal: el fader por el MUTE / SOLO
  instGain(deck, k) {
    const i = this.slotOf(deck);
    return this.inst[i][k] * this.heard(i, k);
  }
  fxLevel(deck) {
    const i = this.slotOf(deck);
    return (this.fxGain[i] ?? 1) * this.heard(i, 'fx');
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
    // el PRIMER GENERAR: cada universo nace con el ESTILO que marca su fader (normalmente ya lo hizo
    // al moverlo: ver Deck.styleWaiting). Si le toca hacerlo ahora, se espera un poco más a empezar
    // para que sus hats y percs estén grabados
    let restyled = false;
    for (const d of this.active) if (d.styleWaiting()) restyled = true;
    this.generated = true;
    // retomar siempre en el inicio de un compás: las frases siguen alineadas
    this.step = Math.ceil(this.step / 16) * 16;
    this.nextGrid = this.ctx.currentTime + (restyled ? 0.3 : 0.08);
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
    this.watchAudio(now); // VIGILANTE: NaN, contexto suspendido, reloj parado
    if (!this.ready) return; // el vigilante acaba de mandar rehacer el audio

    // Un error en un universo no puede parar el reloj: antes, una excepción aquí dejaba el paso
    // sin avanzar (el mismo paso repetido o nada nuevo sonando) mientras la pantalla seguía.
    // Se apunta en el registro y la rejilla sigue.
    const act = this.active;
    for (const d of act) this.safe(() => d.update(now, dt), `${d.id} update`);

    if (!this.playing) return this.safe(() => this.low.apply(now), 'low');
    while (this.nextGrid < now + this.lookahead) {
      // TARDE: el hilo principal se atascó y este paso ya debería estar sonando
      // (sus notas salen desplazadas). Distinto de un CORTE (el audio sin datos).
      if (this.nextGrid < now) this.late++;
      if (this.step % 16 === 0 && this.scaleNext !== null) { this.scaleI = this.scaleNext; this.scaleNext = null; }
      // EASY EQ · GRAVES: un cambio de dueño del kick o del bajo entra en el tiempo, antes de sus notas
      if (this.step % 4 === 0) this.safe(() => this.low.apply(this.nextGrid), 'low');
      for (const d of act) this.safe(() => d.scheduleStep(this.step, this.nextGrid), `${d.id} paso`);
      this.nextGrid += this.stepDur;
      this.step++;
    }
  }

  // ejecutar una parte del reloj sin que un error lo pare; cada error distinto se apunta una vez
  safe(fn, where) {
    try { return fn(); }
    catch (e) {
      const msg = `${where}: ${e?.message || e}`;
      this.errSeen ||= new Set();
      if (!this.errSeen.has(msg)) {
        this.errSeen.add(msg);
        this.logIncident('error', `${msg} · ${String(e?.stack || '').split('\n')[1]?.trim() || ''}`);
      }
    }
  }
}
