// Piezas de DSP compartidas: saturación y el canal de instrumento.

import { clamp } from '../core/rng.js';

export const glide = (param, v, t, tc = 0.04) => param.setTargetAtTime(v, t, tc);

// Saturación tanh. `comp` iguala el VOLUMEN (RMS) de una senoide de amplitud
// `ref` (el nivel típico de ese instrumento): saturar añade densidad y
// armónicos, no volumen. Así la emoción cambia el color, no el balance.
export function driveCurve(amount, ref = 0.5) {
  const k = 1 + amount * 10;
  const n = 2048;
  const c = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  let si = 0, so = 0;
  for (let i = 0; i < 64; i++) {
    const x = ref * Math.sin((i / 64) * 2 * Math.PI);
    const y = Math.tanh(k * x) / norm;
    si += x * x; so += y * y;
  }
  return { curve: c, comp: Math.sqrt(si / so) };
}

// nivel típico que llega a la saturación de cada canal (para igualar volumen)
const DRIVE_REF = { kick: 0.9, bass: 0.7, clap: 0.6, hat: 0.35, ohat: 0.35, perc: 0.5, chord: 0.4, pad: 0.35 };

// cómo entra/sale cada instrumento cuando la transición es por filtro
const SWEEP = { kick: 'hp', bass: 'hp', clap: 'lp', hat: 'lp', ohat: 'lp', perc: 'lp', chord: 'lp', pad: 'lp' };

// PERFIL DE MEZCLA (igual en todos los universos: es el mismo género).
// Referencia = el kick. Medido con todo sonando y emoción neutra:
//   bass  picos ≈ 3–4 dB bajo el kick, loudness ≈ 5 LU por debajo (kick y bass mandan)
//   clap  picos ≈ 6 dB bajo el kick     · perc / acordes ≈ 10 dB
//   hats  picos ≈ 12–15 dB bajo el kick · pad (fondo) ≈ 16 LU por debajo
export const LEVEL = { kick: 0.59, bass: 0.4, clap: 0.6, hat: 0.44, ohat: 0.34, perc: 0.3, chord: 0.28, pad: 0.26 };

// LIMPIEZA: high-pass fijo para que solo kick y bass vivan en los graves (club = mono abajo)
const CLEAN_HP = { kick: 28, bass: 30, clap: 160, hat: 300, ohat: 300, perc: 150, chord: 150, pad: 140 };
// EQ de "barro" (200–600 Hz): donde se emborronan acordes y pads
const MUD = { chord: [550, -5, 0.8], pad: [380, -3, 0.7] };

export class Channel {
  constructor(ctx, name, dest, oversample = '2x') {
    this.name = name;
    this.sweep = SWEEP[name];
    this.input = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = oversample;
    this.post = ctx.createGain();
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hpBase = CLEAN_HP[name] ?? 20;
    this.hp.frequency.value = this.hpBase;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 20000;
    this.fade = ctx.createGain();
    this.fade.gain.value = 0;
    this.duck = ctx.createGain();
    this.user = ctx.createGain(); // volumen del MIXER global (0 dB por defecto)
    this.out = ctx.createGain();
    this.level = LEVEL[name];
    this.out.gain.value = this.level;

    let chain = this.input.connect(this.shaper).connect(this.post).connect(this.hp).connect(this.lp);
    if (MUD[name]) {
      const [f, g, q] = MUD[name];
      this.mud = ctx.createBiquadFilter();
      this.mud.type = 'peaking';
      this.mud.frequency.value = f; this.mud.gain.value = g; this.mud.Q.value = q;
      chain = chain.connect(this.mud);
    }
    chain.connect(this.fade).connect(this.duck).connect(this.user).connect(this.out).connect(dest);
    this.driveQ = -1;
    this.setDrive(0);
    this.last = { f: -1, vol: -1, m: -1 };
  }

  setDrive(amount) {
    const q = Math.round(clamp(amount) * 20) / 20;
    if (q === this.driveQ) return;
    this.driveQ = q;
    const { curve, comp } = driveCurve(q, DRIVE_REF[this.name]);
    this.shaper.curve = curve;
    this.post.gain.value = comp;
  }

  // progress 0..1 de la transición; mode 0 = volumen, 1 = filtro
  // `tc` (opcional) = rapidez del cambio: el DROP lo pide casi seco
  applyTransition(prog, mode, now, tc) {
    const f = 1 - mode * (1 - prog);                          // apertura del filtro
    const vp = clamp(prog / (1 - 0.85 * mode));                // el volumen siempre llega a 0
    const vol = Math.sin(vp * Math.PI / 2);
    const L = this.last;
    if (Math.abs(f - L.f) < 1e-4 && Math.abs(vol - L.vol) < 1e-4 && mode === L.m) return;
    L.f = f; L.vol = vol; L.m = mode;
    const q = 0.707 + 5 * mode * Math.sin(Math.PI * (1 - f));
    if (this.sweep === 'hp') {
      glide(this.hp.frequency, this.hpBase * Math.pow(900 * 20 / this.hpBase, 1 - f), now, tc);
      glide(this.hp.Q, q, now, tc);
    } else {
      glide(this.lp.frequency, 20000 * Math.pow(1 / 400, 1 - f), now, tc);
      glide(this.lp.Q, q, now, tc);
    }
    glide(this.fade.gain, vol, now, tc ?? 0.03);
  }
}
