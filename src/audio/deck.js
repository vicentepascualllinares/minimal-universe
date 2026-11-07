// UNIVERSO — un mundo musical completo: sus 6 instrumentos, su emoción, su
// estructura, su loop, su reverb y su delay. El reloj, el BPM y la tonalidad
// los pone el Engine (globales), así dos universos siempre encajan.

import * as V from './voices.js';
import { Channel, driveCurve, makeIR, glide } from './dsp.js';
import { makeGenerators } from '../music/generators.js';
import { EmotionState, mapEmotion, degreeToSemis } from '../music/emotion.js';
import { Arrangement, INSTRUMENTS } from '../music/arrangement.js';
import { Rng, makeDrift, lerp } from '../core/rng.js';
import { PROFILE } from '../core/profile.js';

const glideAll = glide;

const newSeed = () => (Math.random() * 1e9) | 0;

export class Deck {
  constructor(engine, id, { x, y, v, a }) {
    this.engine = engine;
    this.id = id;
    this.transitionMode = 1;  // 1 filtro .. 0 volumen
    this.transitionBars = 4;
    this.emotion = new EmotionState(v, a);
    this.arr = new Arrangement();
    this.arr.set(x, y);
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
  }

  initAudio(ctx, out) {
    this.ctx = ctx;
    this.sum = ctx.createGain();
    this.sum.gain.value = 0.8;
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = PROFILE.oversample ?? '4x';
    this.post = ctx.createGain();
    this.driveQ = -1;
    this.sum.connect(this.shaper).connect(this.post).connect(out);

    // reverb propia: al bajar el fader, su cola se va con el universo
    this.revIn = ctx.createGain();
    const revHp = ctx.createBiquadFilter();
    revHp.type = 'highpass'; revHp.frequency.value = 200;
    const conv = ctx.createConvolver();
    conv.buffer = makeIR(ctx, PROFILE.irSeconds);
    this.revTone = ctx.createBiquadFilter();
    this.revTone.type = 'lowpass';
    this.revRet = ctx.createGain();
    this.revIn.connect(revHp).connect(conv).connect(this.revTone).connect(this.revRet).connect(this.sum);

    // delay dub
    this.dlyIn = ctx.createGain();
    this.delay = ctx.createDelay(3);
    this.dlyFb = ctx.createGain();
    this.dlyTone = ctx.createBiquadFilter();
    this.dlyTone.type = 'lowpass';
    const dlyHp = ctx.createBiquadFilter();
    dlyHp.type = 'highpass'; dlyHp.frequency.value = 300;
    const dlyRet = ctx.createGain();
    dlyRet.gain.value = 0.55;
    this.dlyIn.connect(this.delay);
    this.delay.connect(this.dlyTone).connect(dlyHp).connect(this.dlyFb).connect(this.delay);
    this.delay.connect(dlyRet).connect(this.sum);
    const dlyToRev = ctx.createGain();
    dlyToRev.gain.value = 0.3;
    dlyRet.connect(dlyToRev).connect(this.revIn);

    this.ch = {};
    for (const k of INSTRUMENTS) {
      this.ch[k] = new Channel(ctx, k, this.sum, this.revIn, this.dlyIn, PROFILE.oversample ?? '2x');
    }

    // perfil móvil: hats grabados (sampler) y un panorama fijo por carril de percusión
    if (PROFILE.lite) {
      this.hats = new V.HatSampler(ctx, this.engine.noise);
      this.lanePans = new Map();
      this.paramCache = new Map();
    }
  }

  // móvil: no reenviar a un parámetro el valor que ya tiene
  glideLite(param, v, now, tc) {
    const last = this.paramCache.get(param);
    if (last !== undefined && Math.abs(last - v) <= Math.abs(v) * 0.002 + 1e-4) return;
    this.paramCache.set(param, v);
    glide(param, v, now, tc);
  }

  lanePan(lane, pan) {
    let p = this.lanePans.get(lane);
    if (!p) {
      p = this.ctx.createStereoPanner();
      p.connect(this.ch.perc.input);
      this.lanePans.set(lane, p);
    }
    if (p.pan.value !== pan) p.pan.value = pan;
    return p;
  }

  reseed() { this.pendingSeed = newSeed(); }

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
      frozen: { x: this.arr.x, y: this.arr.y, v: this.emotion.v, a: this.emotion.a },
      releasing: false,
    };
  }

  // se ejecuta en el primer paso del compás siguiente a soltar el loop (t0 = su tiempo)
  finishLoop(t0) {
    this.loop = null;
    const now = this.ctx.currentTime;
    if (this.releaseMode === 'instant') {
      this.emotion.snap();
      this.e = mapEmotion(this.emotion.v, this.emotion.a, this.drift(now));
      this.arr.snap();
      for (const k of INSTRUMENTS) this.ch[k].applyTransition(this.arr.state[k].progress, this.transitionMode, t0);
    } else {
      const barDur = this.engine.barDur;
      this.emotion.rampTo(this.releaseBars * barDur, t0 - now);
      this.arr.update(now, 0, barDur, this.releaseBars, t0);
    }
  }

  // control (≈50 Hz): emoción, estructura, transiciones y sonido
  update(now, dt, nextBeat) {
    if (this.loop) {
      this.arr.preview(); // congelado: solo se previsualiza lo pendiente
    } else {
      this.emotion.update(dt);
      this.e = mapEmotion(this.emotion.v, this.emotion.a, this.drift(now));
      const playing = this.engine.playing;
      this.arr.update(now, playing ? dt : 0, this.engine.barDur, this.transitionBars, nextBeat);
      for (const k of INSTRUMENTS) {
        this.ch[k].applyTransition(this.arr.state[k].progress, this.transitionMode, now);
      }
    }
    this.updateSound(now);
  }

  updateSound(now) {
    const e = this.e;
    const glide = PROFILE.lite ? this.glideLite.bind(this) : glideAll;
    if (PROFILE.lite) {
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
    const tc = 0.25;
    glide(C.clap.rev.gain, e.clap.reverb, now, tc);
    glide(C.clap.dly.gain, e.clap.delay, now, tc);
    glide(C.hat.rev.gain, e.hat.reverb, now, tc);
    glide(C.hat.dly.gain, e.hat.delay, now, tc);
    glide(C.ohat.rev.gain, e.ohat.reverb, now, tc);
    glide(C.ohat.dly.gain, e.ohat.delay, now, tc);
    glide(C.perc.rev.gain, e.perc.reverb, now, tc);
    glide(C.perc.dly.gain, e.perc.delay, now, tc);
    glide(C.kick.rev.gain, 0.02 + 0.06 * e.abyss, now, tc);
    glide(C.bass.rev.gain, 0.03 * e.warmth, now, tc);

    glide(this.revRet.gain, m.reverbReturn, now, tc);
    glide(this.revTone.frequency, m.reverbTone, now, tc);
    glide(this.dlyFb.gain, m.delayFeedback, now, tc);
    glide(this.dlyTone.frequency, m.delayTone, now, tc);
    glide(this.delay.delayTime, (60 / this.engine.bpm) * m.delayBeats, now, 0.4);

    const q = Math.round(m.drive * 20) / 20;
    if (q !== this.driveQ) {
      this.driveQ = q;
      const { curve, comp } = driveCurve(q * 0.6);
      this.shaper.curve = curve;
      this.post.gain.value = comp;
    }
  }

  prepareBar(b, absStep, t0) {
    this.lastPrepared = b;
    const L = this.loop;
    if (L) {
      if (L.releasing) this.finishLoop(t0);
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
      if (this.lanePans) { // móvil: soltar los panoramas de los carriles viejos
        for (const p of this.lanePans.values()) p.disconnect();
        this.lanePans.clear();
      }
    }
    const G = this.gen;
    const e = this.e;
    const r = G.rng;
    const mu = e.gen.mutation;
    if (b > 0 && b % 4 === 0) {
      if (r.chance(mu)) G.perc.mutate(1);
      if (r.chance(mu * 0.5)) G.hat.mutate();
    }
    if (b > 0 && b % 8 === 0) {
      if (r.chance(mu * 0.7)) G.bass.mutate();
      if (r.chance(0.15)) G.clap.mutate();
      if (r.chance(0.2)) G.ohat.mutate();
    }
    if (b > 0 && b % 32 === 0) G.perc.mutate(2);

    const d = (k) => this.arr.state[k].density;
    this.bars = {
      kick: G.kick.bar(b, d('kick'), e),
      clap: G.clap.bar(b, d('clap'), e),
      hat: G.hat.bar(b, d('hat'), e),
      ohat: G.ohat.bar(b, d('ohat'), e),
      perc: G.perc.bar(b, d('perc'), e, absStep),
      bass: G.bass.bar(b, d('bass'), e),
    };
    this.history.push({ b, bars: this.bars });
    if (this.history.length > 16) this.history.shift();
  }

  scheduleStep(n, gridT) {
    const s = n % 16;
    const b = Math.floor(n / 16);
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
      if (PROFILE.lite) this.hats.play('closed', C.hat.input, th, ev.vel);
      else V.hat(ctx, C.hat.input, th, ev.vel, e.hat, e.hat.decay, noise);
      emit('hat', th, ev.vel);
    }
    if ((ev = B.ohat[s]) && A.audible('ohat', t)) {
      const th = t + hum() * 0.5;
      this.lastOpen = PROFILE.lite
        ? this.hats.play('open', C.ohat.input, th, ev.vel)
        : V.hat(ctx, C.ohat.input, th, ev.vel, e.hat, e.ohat.decay, noise);
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
        const pn = PROFILE.lite ? this.lanePan(h.lane, so.pan) : null;
        V.perc(ctx, C.perc.input, tp, h.vel * 0.9, sound, noise, pn);
        emit('perc', tp, h.vel);
      }
    }
    if ((ev = B.bass[s]) && A.audible('bass', t)) {
      const semis = degreeToSemis(ev.deg, scale) + 12;
      const dur = Math.max(sd * 0.55, ev.len * sd * e.bass.lenMul - 0.01);
      V.bass(ctx, C.bass.input, t, ev.vel, root * Math.pow(2, semis / 12), dur, e.bass, PROFILE.lite);
      emit('bass', t, ev.vel);
    }
  }
}
