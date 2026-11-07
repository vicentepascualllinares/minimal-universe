// Piezas de DSP compartidas: saturación, reverb, y el canal de instrumento.

import { clamp } from '../core/rng.js';

export const glide = (param, v, t, tc = 0.04) => param.setTargetAtTime(v, t, tc);

export function driveCurve(amount) {
  const k = 1 + amount * 10;
  const n = 2048;
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return { curve: c, comp: Math.pow(norm / k, 0.72) };
}

export function makeIR(ctx, dur = 3.6, decay = 2.8) {
  const sr = ctx.sampleRate;
  const len = Math.floor(dur * sr);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const fadeIn = t < 0.015 ? t / 0.015 : 1;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / dur, decay) * fadeIn;
    }
  }
  return buf;
}

// cómo entra/sale cada instrumento cuando la transición es por filtro
const SWEEP = { kick: 'hp', bass: 'hp', clap: 'lp', hat: 'lp', ohat: 'lp', perc: 'lp' };
const LEVEL = { kick: 0.92, bass: 0.5, clap: 0.36, hat: 0.2, ohat: 0.14, perc: 0.3 };

export class Channel {
  constructor(ctx, name, dest, rev, dly) {
    this.name = name;
    this.sweep = SWEEP[name];
    this.input = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '2x';
    this.post = ctx.createGain();
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 20;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 20000;
    this.fade = ctx.createGain();
    this.fade.gain.value = 0;
    this.duck = ctx.createGain();
    this.out = ctx.createGain();
    this.out.gain.value = LEVEL[name];
    this.rev = ctx.createGain();
    this.rev.gain.value = 0;
    this.dly = ctx.createGain();
    this.dly.gain.value = 0;

    this.input.connect(this.shaper).connect(this.post).connect(this.hp).connect(this.lp)
      .connect(this.fade).connect(this.duck).connect(this.out).connect(dest);
    this.out.connect(this.rev).connect(rev);
    this.out.connect(this.dly).connect(dly);
    this.driveQ = -1;
    this.setDrive(0);
    this.last = { f: -1, vol: -1, m: -1 };
  }

  setDrive(amount) {
    const q = Math.round(clamp(amount) * 20) / 20;
    if (q === this.driveQ) return;
    this.driveQ = q;
    const { curve, comp } = driveCurve(q);
    this.shaper.curve = curve;
    this.post.gain.value = comp;
  }

  // progress 0..1 de la transición; mode 0 = volumen, 1 = filtro
  applyTransition(prog, mode, now) {
    const f = 1 - mode * (1 - prog);                          // apertura del filtro
    const vp = clamp(prog / (1 - 0.85 * mode));                // el volumen siempre llega a 0
    const vol = Math.sin(vp * Math.PI / 2);
    const L = this.last;
    if (Math.abs(f - L.f) < 1e-4 && Math.abs(vol - L.vol) < 1e-4 && mode === L.m) return;
    L.f = f; L.vol = vol; L.m = mode;
    const q = 0.707 + 5 * mode * Math.sin(Math.PI * (1 - f));
    if (this.sweep === 'hp') {
      glide(this.hp.frequency, 20 * Math.pow(900, 1 - f), now);
      glide(this.hp.Q, q, now);
    } else {
      glide(this.lp.frequency, 20000 * Math.pow(1 / 400, 1 - f), now);
      glide(this.lp.Q, q, now);
    }
    glide(this.fade.gain, vol, now, 0.03);
  }
}
