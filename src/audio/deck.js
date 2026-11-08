// UNIVERSO — un mundo musical completo: sus instrumentos, su emoción, su
// estructura y su loop. Sin reverb ni delay: todo seco. El reloj, el BPM y la tonalidad
// los pone el Engine (globales), así dos universos siempre encajan.

import * as V from './voices.js';
import { Channel, Saturator, glide, fixChannels } from './dsp.js';
import { makeGenerators } from '../music/generators.js';
import { EmotionState, mapEmotion, degreeToSemis } from '../music/emotion.js';
import { Arrangement, INSTRUMENTS, SCENES } from '../music/arrangement.js';
import { classify, makePalette, PHRASE } from '../music/transitions.js';
import { TransitionFx } from './transitionFx.js';
import { blockRate } from './quality.js';
import { shapeComplexity, shareDensity, randomComplexity, GROUPS } from '../music/complexity.js';
import { Rng, makeDrift, lerp } from '../core/rng.js';
import { PROFILE } from '../core/profile.js';

const glideAll = glide;

const newSeed = () => (Math.random() * 1e9) | 0;

// un pad apoyado más que esto = CORTE. 200 ms es lo que usan los teclados que distinguen tocar
// de mantener (QMK, TAPPING_TERM): un toque normal dura menos. Los sistemas (400–500 ms)
// son para menús, demasiado lento para tocar. El CORTE suena tras esto + hasta una corchea
export const HOLD_MS = 200;

export class Deck {
  constructor(engine, id, { scene, v, a }) {
    this.engine = engine;
    this.id = id;
    // FORMA de los viajes (para los dos gestos): 'golpe' = se aguanta y cambia todo en el 1;
    // 'prog' = cambia a lo largo del viaje, 'suave' (todos a la vez) o 'escalonado' (uno a uno)
    this.form = 'prog';
    this.flow = 'suave';
    // los dos gestos de ESTRUCTURA y si llevan efectos. CLIC = cambiar de escena: un viaje de
    // `bars` compases (0 = INSTANTÁNEO, en la siguiente negra). CORTE = mantener pulsado: dura lo que
    // dura el dedo y es siempre instantáneo, en la siguiente corchea (nunca a mitad de un
    // golpe). `quant` = rejilla de lo instantáneo, en pasos: 4 = negra, 2 = corchea
    this.gesture = {
      click: { bars: 4, fx: true, quant: 4 },
      cut: { bars: 0, fx: false, quant: 2 },
    };
    this.held = [];        // escenas mantenidas ahora mismo (manda la última)
    this.pads = {};        // pads apoyados ahora mismo (ver down / up)
    this.pressHome = null; // escena elegida antes de la última pulsación
    // COMPLEJIDAD por grupos (0 simple .. 1 complejo) y un GLOBAL que los escala.
    // Se aplica compás a compás. NUEVO UNIVERSO los cambia (luego se tocan a mano).
    this.cx = { kick: 0.3, perc: 0.6, bass: 0.5, inst: 0.5, global: 0.8 };
    this.cxVersion = 0; // la vista sabe cuándo los cambió el universo y no el usuario
    this.emotion = new EmotionState(v, a);
    this.arr = new Arrangement(scene);
    this.events = [];
    this.seed = newSeed();
    this.gen = makeGenerators(this.seed);
    this.pendingSeed = null;
    this.bars = {};
    this.lastOpen = null;
    // LOOP: repite los últimos compases que han sonado con el estado congelado;
    // por debajo puedes mover todo y no se oye hasta que lo sueltas.
    this.loopLen = 2;            // compases
    this.releaseMode = 'prog';   // 'instant' | 'prog'
    this.releaseBars = 4;        // duración de la salida progresiva
    this.loop = null;
    this.history = [];
    this.lastPrepared = -1;
    this.drift = makeDrift(new Rng(this.seed ^ 0x5bd1e995));
    this.e = mapEmotion(v, a);
    this.newFxPalette(this.seed);
  }

  // TRANSICIONES: la paleta (qué riser, redoble, golpes...) sale de la semilla
  newFxPalette(seed) {
    this.fxPal = makePalette(seed);
    this.fxRng = new Rng(seed ^ 0x6a09e667);
  }

  // monta el audio del universo. Se vuelve a llamar si el motor rehace el audio
  // (cambio de búfer): lo que sonaba en el contexto viejo se olvida, la música no.
  initAudio(ctx, out) {
    this.ctx = ctx;
    this.padVoice = null;
    this.lastOpen = null;
    this.events = [];
    this.sum = ctx.createGain();
    this.sum.gain.value = 0.8;
    // SIEMPRE estéreo. Si no, la suma pasaba de estéreo a mono cuando acababa el último golpe
    // de percusión (la única voz con paneo) y Chrome REINICIABA la saturación de detrás: tiraba
    // los ~4 ms de sonido que tiene dentro el sobremuestreo → chasquido (medido en una
    // grabación: dos huecos de 4,0 ms por compás). Ver fixChannels en dsp.js.
    fixChannels(this.sum, 2);
    // saturación del universo entero (sin recortes ni saltos: ver Saturator en dsp.js)
    const Q = this.engine.q; // CALIDAD DEL MOTOR (ver quality.js)
    this.sat = new Saturator(ctx, Q.oversample ? '4x' : 'none', 0.5);
    // tensión de las transiciones: HP (build), LP (downfilter) y silencio antes del drop.
    // Las voces de transición van aparte, directas a la salida: no se filtran.
    const tHp = ctx.createBiquadFilter();
    tHp.type = 'highpass'; tHp.frequency.value = 20; tHp.Q.value = 3;
    const tLp = ctx.createBiquadFilter();
    tLp.type = 'lowpass'; tLp.frequency.value = 20000; tLp.Q.value = 4;
    const gap = ctx.createGain();
    this.sum.connect(this.sat.input);
    this.sat.output.connect(tHp).connect(tLp).connect(gap).connect(out);
    this.fx = new TransitionFx(this, ctx, out, { hp: tHp, lp: tLp, gap });

    this.ch = {};
    for (const k of INSTRUMENTS) {
      this.ch[k] = new Channel(ctx, k, this.sum, Q.oversample ? '2x' : 'none');
      this.ch[k].user.gain.value = this.engine.inst[k];
    }

    // CALIDAD: hats grabados (sampler) y, en LIGERA, un panorama fijo por carril de percusión
    this.hats = Q.hatSampler ? new V.HatSampler(ctx, this.engine.noise) : null;
    this.lanePans = Q.lean ? new Map() : null;
    // móvil: no reenviar a los parámetros valores que no cambian (ahorra hilo principal)
    this.paramCache = PROFILE.lite ? new Map() : null;
  }

  // móvil: no reenviar a un parámetro el valor que ya tiene
  glideLite(param, v, now, tc) {
    const last = this.paramCache.get(param);
    if (last !== undefined && Math.abs(last - v) <= Math.abs(v) * 0.002 + 1e-4) return;
    this.paramCache.set(param, v);
    glide(param, v, now, tc);
  }

  // `t` = cuándo suena el golpe. Si el carril cambió de panorama, se mueve con una rampa
  // corta en ese momento: el golpe anterior aún suena por aquí y un salto sería un clic
  lanePan(lane, pan, t) {
    let p = this.lanePans.get(lane);
    if (!p) {
      p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(this.ch.perc.input);
      this.lanePans.set(lane, { node: p, pan });
      return p;
    }
    if (p.pan !== pan) { p.pan = pan; p.node.pan.setTargetAtTime(pan, t, 0.004); }
    return p.node;
  }

  reseed() { this.pendingSeed = newSeed(); }

  // CARÁCTER del universo (sale de la semilla): color del sonido y complejidad
  // de cada grupo. Sustituye al antiguo pad de EMOCIÓN: el timbre cambia con
  // inercia (~2 s); el global no se toca (es del intérprete).
  newCharacter(seed) {
    const r = new Rng(seed ^ 0x9e3779b9);
    this.emotion.setTarget(r.float(-0.8, 0.8), r.float(-0.7, 0.7));
    Object.assign(this.cx, randomComplexity(r));
    this.cxVersion++;
  }
  setComplexity(group, v) { this.cx[group] = v; }

  // paso de la rejilla que suena ahora (fraccionario); null en pausa
  pos(now = this.ctx?.currentTime) {
    const E = this.engine;
    return E.playing ? E.step - (E.nextGrid - now) / E.stepDur : null;
  }

  // dónde empieza un viaje de `bars` compases para ATERRIZAR EN FRASE:
  // la llegada cae en el primer inicio de frase posible. Instantáneo (0 compases): en el
  // siguiente paso múltiplo de `quant` (4 = negra, 2 = corchea).
  startStepFor(bars, quant = 4) {
    const s = this.engine.step; // el siguiente paso aún sin programar
    if (bars === 0) return s + ((quant - (s % quant)) % quant);
    const P = PHRASE(bars) * 16;
    const earliest = Math.ceil(s / 16) * 16;
    return Math.ceil((earliest + bars * 16) / P) * P - bars * 16;
  }

  // ── ESTRUCTURA: CLIC y CORTE
  // Entrada única para cualquier mando (pantalla, teclado, MIDI): `down` al apoyar
  // el pad de una escena y `up` al soltarlo. Un controlador MIDI solo tiene que
  // llamar a down en note-on y a up en note-off (ver RENDIMIENTO.md).
  down(name) {
    if (this.pads[name]) return;
    const p = (this.pads[name] = { timer: null, holding: false });
    if (this.press(name) === 'go') {
      p.timer = setTimeout(() => { p.timer = null; p.holding = true; this.hold(name); }, HOLD_MS);
    }
  }
  up(name) {
    const p = this.pads[name];
    if (!p) return;
    delete this.pads[name];
    clearTimeout(p.timer);
    if (p.holding) this.unhold(name);
  }

  // Al apoyar el dedo en una escena es un CLIC: se cambia a ella (instantáneo o viaje).
  // Si el dedo sigue apoyado, la vista llama a hold() y pasa a ser un CORTE (al soltar,
  // unhold()): suena
  // mientras se mantiene y al soltar vuelve a la escena elegida. Cada gesto tiene sus
  // compases y su FX. Pulsar el destino de un viaje a mitad = pausa / sigue.
  // Devuelve 'pause' si la pulsación solo pausó o reanudó (entonces no hay corte).
  press(name) {
    const A = this.arr;
    if (this.loop) { // LOOP: solo se deja pendiente
      A.setTarget(name);
      A.home = name;
      return 'loop';
    }
    const T = A.travel;
    if (T && T.name === name && T.bars > 0 && !this.held.length) {
      this.toggleTravelPause();
      return 'pause';
    }
    this.pressHome = A.home;
    A.home = name;
    this.goScene(name, this.gesture.click);
    return 'go';
  }

  // el dedo sigue apoyado: era un CORTE. La escena elegida no cambia y, si el CORTE
  // tiene otros compases u otro FX que el CLIC, el viaje se rehace con los suyos
  hold(name) {
    if (this.loop) return;
    if (this.arr.home === name && this.pressHome !== null) this.arr.home = this.pressHome;
    this.held.push(name);
    const c = this.gesture.click, k = this.gesture.cut;
    if (c.bars !== k.bars || c.fx !== k.fx || c.quant !== k.quant) this.goScene(name, k, true);
  }

  // soltar un CORTE: vuelve a la escena elegida (o al último corte que siga mantenido)
  unhold(name) {
    const i = this.held.lastIndexOf(name);
    if (i < 0) return;
    const top = i === this.held.length - 1;
    this.held.splice(i, 1);
    if (!top) return;
    const back = this.held.length ? this.held[this.held.length - 1] : this.arr.home;
    this.goScene(back, this.gesture.cut);
  }

  // ir a una escena con un gesto { bars, fx }. `force`: rehacer aunque ya vaya ahí
  goScene(name, g, force = false) {
    const A = this.arr;
    if (this.loop) return A.setTarget(name);
    if (!force && A.target === name && (!A.travel || A.travel.bars === g.bars)) return; // ya está (o ya va)
    const kind = classify(A.cur, SCENES[name].mix);
    const cut = this.form === 'golpe' && g.bars > 0;
    const stagger = !cut && this.flow === 'escalonado' ? this.fxPal.order : null;
    A.goTo(name, g.bars, this.startStepFor(g.bars, g.quant), { drop: cut, stagger });
    if (g.bars === 0 && !this.engine.playing) return A.land(); // parado e instantáneo: salta sin transición
    this.fx?.start(A.travel, g.fx ? kind : 'none', this.fxPal, this.fxRng, cut);
  }

  toggleTravelPause() {
    const T = this.arr.travel;
    if (!T.paused) {
      T.paused = true;
      if (this.ctx) this.fx.pause(this.ctx.currentTime);
      return;
    }
    T.paused = false;
    const pos = this.pos();
    if (pos === null) return;
    if (T.done <= 0) T.startStep = this.startStepFor(T.bars); // aún no había empezado: frase nueva
    else T.startStep = Math.round((pos - T.done * T.bars * 16) / 4) * 4; // sigue desde donde iba, a tiempo
  }

  // DROP: el destino entra de golpe en el tiempo exacto `t` (lo llama la transición)
  land(t) {
    this.arr.land();
    for (const k of INSTRUMENTS) this.ch[k].applyTransition(this.arr.state[k].progress, this.fxPal.how[k], t, 0.006);
  }

  // para la vista, antes de pulsar: compases que faltan para que EMPIECE un viaje de
  // `bars` compases (0 = ya), y en qué compás de la frase estamos
  previewStart(bars) {
    const pos = this.pos() ?? this.engine.step;
    const P = PHRASE(bars);
    return {
      wait: bars === 0 ? 0 : Math.max(0, (this.startStepFor(bars) - pos) / 16),
      phrase: P,
      bar: Math.floor(Math.max(0, pos) / 16) % P,
    };
  }

  // para la vista: a dónde va, cuántos compases faltan para llegar y si aún espera la frase
  travelInfo() {
    const T = this.arr.travel;
    if (!T || !T.name || T.bars === 0) return null;
    const pos = this.pos() ?? this.engine.step;
    if (T.paused) return { name: T.name, paused: true, left: T.bars * (1 - T.done) };
    return {
      name: T.name,
      left: Math.max(0, (T.startStep + T.bars * 16 - pos) / 16),
      wait: Math.max(0, (T.startStep - pos) / 16),
    };
  }

  toggleLoop() {
    if (this.loop) this.loop.releasing = !this.loop.releasing; // segundo clic antes del compás: cancela
    else this.engageLoop();
  }

  engageLoop() {
    if (!this.ctx || !this.history.length) return;
    const n = Math.min(this.loopLen, this.history.length);
    this.emotion.ramp = null;
    this.loop = {
      n,
      bars: this.history.slice(-n).map((h) => h.bars),
      startBar: this.lastPrepared + 1,
      scale: this.engine.scale,
      frozen: { cur: { ...this.arr.cur }, v: this.emotion.v, a: this.emotion.a },
      releasing: false,
    };
    this.arr.frozen = true;
    this.fx.cancel(this.ctx.currentTime); // el loop congela: la transición en curso se apaga
  }

  // se ejecuta en el primer paso del compás b siguiente a soltar el loop (t0 = su tiempo)
  finishLoop(t0, b) {
    this.loop = null;
    this.arr.frozen = false;
    const now = this.ctx.currentTime;
    if (this.releaseMode === 'instant') {
      this.emotion.snap();
      this.e = mapEmotion(this.emotion.v, this.emotion.a, this.drift(now));
      this.arr.snap();
      for (const k of INSTRUMENTS) this.ch[k].applyTransition(this.arr.state[k].progress, this.fxPal.how[k], t0);
    } else {
      this.emotion.rampTo(this.releaseBars * this.engine.barDur, t0 - now);
      this.arr.travelToTarget(this.releaseBars, b * 16);
    }
  }

  // control (≈50 Hz): emoción, estructura, transiciones y sonido
  update(now, dt) {
    const pos = this.pos(now);
    if (this.loop) {
      this.arr.update(pos); // congelado: solo se previsualiza lo pendiente
    } else {
      this.emotion.update(dt);
      this.e = mapEmotion(this.emotion.v, this.emotion.a, this.drift(now));
      this.arr.update(pos);
      this.fx.update(now, pos);
      for (const k of INSTRUMENTS) {
        this.ch[k].applyTransition(this.arr.state[k].progress, this.fxPal.how[k], now);
      }
    }
    this.updateSound(now);
  }

  updateSound(now) {
    const e = this.e;
    const glide = PROFILE.lite ? this.glideLite.bind(this) : glideAll;
    if (this.hats) {
      this.hats.update('closed', e.hat, e.hat.decay);
      this.hats.update('open', e.hat, e.ohat.decay);
    }
    const m = e.master;
    const C = this.ch;
    C.kick.setDrive(e.kick.drive);
    C.clap.setDrive(e.clap.drive);
    C.hat.setDrive(e.hat.drive);
    C.ohat.setDrive(e.hat.drive);
    C.perc.setDrive(e.perc.drive);
    C.bass.setDrive(e.bass.drive);
    C.chord.setDrive(e.chord.drive);
    C.pad.setDrive(e.pad.drive);
    const tc = 0.25;
    glide(C.pad.out.gain, C.pad.level * e.pad.level, now, 0.6);
    // el pad que está sonando sigue a la emoción en vivo
    const pv = this.padVoice;
    if (pv && pv.end > now) {
      glideAll(pv.filter.frequency, e.pad.cutoff, now, 0.5);
      glideAll(pv.lfoGain.gain, e.pad.cutoff * e.pad.lfoDepth, now, 0.5);
      glideAll(pv.airGain.gain, e.pad.air, now, 0.5);
    }

    this.sat.set(m.drive * 0.6);
  }

  prepareBar(b, absStep, t0) {
    this.lastPrepared = b;
    const L = this.loop;
    if (L) {
      if (L.releasing) this.finishLoop(t0, b);
      else {
        const i = (((b - L.startBar) % L.n) + L.n) % L.n;
        this.bars = L.bars[i];
        return;
      }
    }
    if (this.pendingSeed !== null) {
      this.seed = this.pendingSeed;
      this.pendingSeed = null;
      this.gen = makeGenerators(this.seed);
      this.newCharacter(this.seed);
      this.newFxPalette(this.seed);
      if (this.lanePans) { // LIGERA: soltar los panoramas de los carriles viejos...
        const old = [...this.lanePans.values()];
        this.lanePans.clear();
        // ...cuando sus últimos golpes ya hayan sonado: desconectarlos ya los cortaría en seco
        setTimeout(() => old.forEach((p) => p.node.disconnect()), 4000);
      }
    }
    const G = this.gen;
    const cx = shapeComplexity(this.cx);
    // cada generador ve el carácter del universo (this.e) con la complejidad de su grupo
    const eK = { ...this.e, gen: cx.kick.gen, cx: cx.kick.cx };
    const eP = { ...this.e, gen: cx.perc.gen, cx: cx.perc.cx };
    const eB = { ...this.e, gen: cx.bass.gen, cx: cx.bass.cx };
    const eI = { ...this.e, gen: cx.inst.gen, cx: cx.inst.cx };
    const r = G.rng;
    const muP = eP.gen.mutation;
    if (b > 0 && b % 4 === 0) {
      if (r.chance(muP)) G.perc.mutate(1);
      if (r.chance(muP * 0.5)) G.hat.mutate();
    }
    if (b > 0 && b % 8 === 0) {
      if (r.chance(eB.gen.mutation * 0.7)) G.bass.mutate();
      if (r.chance(muP * 0.35)) G.clap.mutate();
      if (r.chance(muP * 0.4)) G.ohat.mutate();
    }
    if (b > 0 && b % 32 === 0 && cx.eff.perc > 0.3) G.perc.mutate(2);
    if (b > 0 && b % 16 === 0 && r.chance(eI.gen.mutation * 0.6)) G.harmony.mutate();

    // protagonismo: si hay más instrumentos de los que la complejidad admite, ceden densidad
    const S = this.arr.state;
    const dens = {}, prog = {};
    for (const k of INSTRUMENTS) {
      dens[k] = S[k].density;
      prog[k] = S[k].progress;
    }
    const shared = shareDensity(dens, prog, cx.budget);
    const d = (k) => shared[k];
    this.bars = {
      kick: G.kick.bar(b, d('kick'), eK),
      clap: G.clap.bar(b, d('clap'), eP),
      hat: G.hat.bar(b, d('hat'), eP),
      ohat: G.ohat.bar(b, d('ohat'), eP),
      perc: G.perc.bar(b, d('perc'), eP, absStep),
      bass: G.bass.bar(b, d('bass'), eB),
      chord: G.harmony.chordBar(b, d('chord'), eI),
      pad: G.harmony.padBar(b, d('pad'), eI),
    };
    if (cx.avoid) this.takeTurns(this.bars, prog);
    this.history.push({ b, bars: this.bars });
    if (this.history.length > 16) this.history.shift();
  }

  // TURNOS (complejidad baja): los acordes esquivan al bajo y la percusión deja
  // libres los golpes de acordes y clap. Menos choques = cada cosa se oye.
  takeTurns(B, prog) {
    if (prog.chord > 0 && prog.bass > 0) {
      for (let s = 0; s < 16; s++) {
        if (!B.chord[s] || !B.bass[s]) continue;
        const ev = B.chord[s];
        B.chord[s] = null;
        const t = s + 2; // una corchea más tarde, si está libre: respuesta en vez de choque
        if (t < 16 && !B.bass[t] && !B.chord[t] && !B.chord[t + 1] && !B.chord[t + 2]) {
          B.chord[t] = ev;
          s = t;
        }
      }
      let prev = null; // recalcular duraciones
      for (let s = 0; s < 16; s++) {
        if (!B.chord[s]) continue;
        if (prev !== null) B.chord[prev] = { ...B.chord[prev], len: Math.min(B.chord[prev].len, s - prev) };
        prev = s;
      }
    }
    if (prog.perc > 0) {
      for (let s = 0; s < 16; s++) {
        if ((prog.chord > 0 && B.chord[s]) || (prog.clap > 0 && B.clap[s])) B.perc[s] = null;
      }
    }
  }

  scheduleStep(n, gridT) {
    const s = n % 16;
    const b = Math.floor(n / 16);
    this.fx.step(n, gridT); // antes que las notas: en la llegada de un viaje DE GOLPE, el DROP
    if (s === 0 || !this.bars.kick) this.prepareBar(b, n - s, gridT);
    const ctx = this.ctx;
    const noise = this.engine.noise;
    const e = this.e;
    const sd = this.engine.stepDur;
    const t = gridT + (s % 2 === 1 ? (e.groove.swing - 0.5) * 2 * sd : 0);
    const hum = () => (Math.random() - 0.5) * 2 * e.groove.humanize;
    const A = this.arr;
    const C = this.ch;
    const B = this.bars;
    const root = this.engine.rootHz;
    const scale = this.loop ? this.loop.scale : this.engine.scale;
    const emit = (k, time, vel) => this.events.push({ k, t: time, vel });

    let ev;
    if ((ev = B.kick[s]) && A.audible('kick', t)) {
      V.kick(ctx, C.kick.input, t, ev.vel, e.kick, root, noise);
      const depth = e.kick.duck * ev.vel * A.state.kick.progress;
      C.bass.duck.gain.setTargetAtTime(1 - depth, t, 0.003);
      C.bass.duck.gain.setTargetAtTime(1, t + 0.045, 0.055);
      // un poco de bombeo en la armonía (sidechain)
      for (const [k, amt] of [['chord', 0.25], ['pad', 0.35]]) {
        const dk = depth * amt * A.state[k].progress;
        if (dk < 0.01) continue;
        C[k].duck.gain.setTargetAtTime(1 - dk, t, 0.004);
        C[k].duck.gain.setTargetAtTime(1, t + 0.05, 0.09);
      }
      emit('kick', t, ev.vel);
    }
    if ((ev = B.clap[s]) && A.audible('clap', t)) {
      const tc = t + e.groove.clapNudge + hum();
      V.clap(ctx, C.clap.input, tc, ev.vel, e.clap, noise);
      emit('clap', tc, ev.vel);
    }
    if ((ev = B.hat[s]) && A.audible('hat', t)) {
      const th = Math.max(t + hum(), ctx.currentTime);
      if (this.lastOpen && this.lastOpen.end > th) this.lastOpen.gain.setTargetAtTime(0, th, 0.007);
      // grabado si la CALIDAD lo pide y ya está listo; si no, sintetizado (mismo sonido)
      if (!this.hats?.play('closed', C.hat.input, th, ev.vel)) V.hat(ctx, C.hat.input, th, ev.vel, e.hat, e.hat.decay, noise);
      emit('hat', th, ev.vel);
    }
    if ((ev = B.ohat[s]) && A.audible('ohat', t)) {
      const th = t + hum() * 0.5;
      this.lastOpen = this.hats?.play('open', C.ohat.input, th, ev.vel)
        || V.hat(ctx, C.ohat.input, th, ev.vel, e.hat, e.ohat.decay, noise);
      emit('ohat', th, ev.vel);
    }
    if ((ev = B.perc[s]) && A.audible('perc', t)) {
      const P = e.perc;
      for (const h of ev) {
        const so = h.lane.sound;
        const semis = degreeToSemis(so.deg, scale) + 12 * so.oct;
        const sound = {
          type: so.type,
          wave: so.wave,
          bend: so.bend,
          freq: so.type === 'noise' ? so.nfreq * P.pitchMul : root * Math.pow(2, semis / 12) * P.pitchMul,
          ratio: lerp(so.ratioI, so.ratioH, P.harmonic),
          index: so.index * P.fmIndex,
          decay: so.decay * P.decayMul,
          q: so.q,
          pan: so.pan,
        };
        const tp = Math.max(t + hum(), ctx.currentTime);
        const pn = this.lanePans ? this.lanePan(h.lane, so.pan, tp) : null;
        V.perc(ctx, C.perc.input, tp, h.vel * 0.9, sound, noise, pn);
        emit('perc', tp, h.vel);
      }
    }
    if ((ev = B.bass[s]) && A.audible('bass', t)) {
      const semis = degreeToSemis(ev.deg, scale) + 12;
      const dur = Math.max(sd * 0.55, ev.len * sd * e.bass.lenMul - 0.01);
      V.bass(ctx, C.bass.input, t, ev.vel, root * Math.pow(2, semis / 12), dur, e.bass, this.engine.q.lean);
      emit('bass', t, ev.vel);
    }
    // acordes y pad: dos octavas sobre la tónica del kick
    const freqsOf = (notes) => notes.map((d) => root * Math.pow(2, (degreeToSemis(d, scale) + 24) / 12));
    if ((ev = B.chord[s]) && A.audible('chord', t)) {
      const dur = Math.max(sd * 0.5, ev.len * sd * e.chord.lenMul - 0.01);
      V.chord(ctx, C.chord.input, t, ev.vel, freqsOf(ev.notes), dur, e.chord, this.engine.q.lean);
      emit('chord', t, ev.vel);
    }
    if ((ev = B.pad[s]) && A.audible('pad', t)) {
      const freqs = freqsOf(ev.notes); // sin tónica grave: esa octava es del bajo
      const key = freqs.map((f) => f.toFixed(2)).join('|');
      const pv = this.padVoice;
      // si ya suena este mismo acorde, se deja sonar; si no, fundido al nuevo
      if (!pv || pv.key !== key || pv.holdEnd <= t + 0.01) {
        if (pv) pv.release(t, Math.max(0.4, e.pad.attack));
        const hold = ev.bars * this.engine.barDur;
        this.padVoice = V.pad(ctx, C.pad.input, t, ev.vel, freqs, hold, e.pad, noise, this.engine.q.lean);
        if (this.engine.q.blockFilters) blockRate(this.padVoice.filter); // CALIDAD: el filtro lento del pad, por bloques
        this.padVoice.key = key;
        emit('pad', t, ev.vel);
      }
    }
  }

  // pausa: soltar lo que se sostiene (el pad)
  release(at) {
    this.fx.kill(at);
    if (this.padVoice) this.padVoice.release(at, 1.2);
    this.padVoice = null;
  }
}
