// Piezas de DSP compartidas: saturación y el canal de instrumento.

import { clamp } from '../core/rng.js';

export const glide = (param, v, t, tc = 0.04) => param.setTargetAtTime(v, t, tc);

// Fijar el número de canales de un nodo. Por defecto Chrome usa el máximo de lo que le
// llega en cada momento, y cuando ese número CAMBIA (p. ej. acaba la única voz estéreo)
// reinicia los nodos con memoria que hay detrás (WaveShaper con sobremuestreo, filtros):
// el WaveShaper tira el sonido que tenía dentro (2,7 ms con 2x, 4 ms con 4x) → chasquido.
// Todo lo que alimenta una saturación o un filtro tiene que tener un número fijo.
export function fixChannels(node, n) {
  node.channelCount = n;
  node.channelCountMode = 'explicit';
  node.channelInterpretation = 'speakers'; // mono → estéreo: igual en los dos lados
  return node;
}

// ── SATURACIÓN tanh, sin recortes y sin saltos
//   y = comp · tanh(k·x) / tanh(k)        k = 1 + 10·drive
// `comp` iguala el VOLUMEN (RMS) de una senoide de amplitud `ref` (el nivel típico de
// ese instrumento): saturar añade densidad y armónicos, no volumen.
//
// Antes había una curva por cada cantidad de drive y cambiar el drive era CAMBIAR LA
// CURVA DE GOLPE con el sonido pasando (chasquido al cambiar de universo). Y la curva
// solo cubría ±1: lo que pasaba de ahí se RECORTABA EN SECO (el pad llegaba a 1,5:
// sonido roto). Ahora hay UNA curva fija que cubre ±SAT_RANGE y el drive son dos
// ganancias con rampa alrededor de ella:
//   y = post · curva(pre · x),  pre = k / SAT_RANGE,  curva(u) = tanh(SAT_RANGE·u),
//   post = comp / tanh(k)
// Hasta ±1 es exactamente lo mismo que antes; por encima sigue saturando suave (sin
// recorte hasta ±SAT_RANGE/k: ≥ 4,3 veces el nivel máximo, +13 dB).
const SAT_RANGE = 48;
const SAT_POINTS = 16385; // con 16 385 puntos el error de la curva queda por debajo de −110 dB
let satCurve = null;
function satCurveShared() {
  if (!satCurve) {
    satCurve = new Float32Array(SAT_POINTS);
    for (let i = 0; i < SAT_POINTS; i++) satCurve[i] = Math.tanh(SAT_RANGE * ((i / (SAT_POINTS - 1)) * 2 - 1));
  }
  return satCurve;
}
export const driveK = (amount) => 1 + clamp(amount) * 10;
export function driveComp(k, ref = 0.5) {
  const norm = Math.tanh(k);
  let si = 0, so = 0;
  for (let i = 0; i < 64; i++) {
    const x = ref * Math.sin((i / 64) * 2 * Math.PI);
    const y = Math.tanh(k * x) / norm;
    si += x * x; so += y * y;
  }
  return Math.sqrt(si / so);
}

export class Saturator {
  constructor(ctx, oversample = '2x', ref = 0.5, amount = 0) {
    this.ctx = ctx;
    this.ref = ref;
    this.pre = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = satCurveShared();
    this.shaper.oversample = oversample;
    this.post = ctx.createGain();
    this.pre.connect(this.shaper).connect(this.post);
    this.input = this.pre;
    this.output = this.post;
    this.amount = -1;
    this.set(amount);
    this.fresh = true; // el primer valor que pida el universo entra al momento (aún no suena nada)
  }

  // cantidad de saturación 0..1. Con rampa (tc s): cambiar el color no hace clic
  set(amount, tc = 0.05) {
    amount = clamp(amount);
    if (Math.abs(amount - this.amount) < 0.002) return;
    const first = this.amount < 0 || this.fresh;
    this.fresh = false;
    this.amount = amount;
    const k = driveK(amount);
    const pre = k / SAT_RANGE;
    const post = driveComp(k, this.ref) / Math.tanh(k);
    if (first) { this.pre.gain.value = pre; this.post.gain.value = post; return; }
    const now = this.ctx.currentTime;
    glide(this.pre.gain, pre, now, tc);
    glide(this.post.gain, post, now, tc);
  }
}

// ── TECHO de la salida: transparente hasta ±0,95 y nunca pasa de ±1. Es la red de
// seguridad tras el limitador (que no es de muro): sin él, un pico de más se
// recortaría en seco en la tarjeta de sonido. Cubre hasta ±4 (12 dB de más).
const CEIL_RANGE = 4, CEIL_KNEE = 0.95;
export function ceiling(ctx) {
  const pre = ctx.createGain();
  pre.gain.value = 1 / CEIL_RANGE;
  const sh = ctx.createWaveShaper();
  const n = 16385;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * CEIL_RANGE;
    const a = Math.abs(x);
    c[i] = a <= CEIL_KNEE ? x : Math.sign(x) * (CEIL_KNEE + (1 - CEIL_KNEE) * Math.tanh((a - CEIL_KNEE) / (1 - CEIL_KNEE)));
  }
  sh.curve = c;
  sh.oversample = '2x'; // si llega a actuar, sin aliasing
  pre.connect(sh);
  return { input: pre, output: sh };
}

// nivel típico que llega a la saturación de cada canal (para igualar volumen)
const DRIVE_REF = { kick: 0.9, bass: 0.7, clap: 0.6, hat: 0.35, ohat: 0.35, perc: 0.5, chord: 0.4, pad: 0.35 };

// canales que reciben voces estéreo (la percusión lleva paneo); los demás son mono
const STEREO_IN = new Set(['perc']);

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
    // canales fijos (ver fixChannels): la percusión es estéreo (paneo por golpe), el resto mono
    this.input = fixChannels(ctx.createGain(), STEREO_IN.has(name) ? 2 : 1);
    this.sat = new Saturator(ctx, oversample, DRIVE_REF[name]);
    this.post = this.sat.output; // tras la saturación (para medir)
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

    this.input.connect(this.sat.input);
    let chain = this.sat.output.connect(this.hp).connect(this.lp);
    if (MUD[name]) {
      const [f, g, q] = MUD[name];
      this.mud = ctx.createBiquadFilter();
      this.mud.type = 'peaking';
      this.mud.frequency.value = f; this.mud.gain.value = g; this.mud.Q.value = q;
      chain = chain.connect(this.mud);
    }
    chain.connect(this.fade).connect(this.duck).connect(this.user).connect(this.out).connect(dest);
    this.last = { f: -1, vol: -1, m: -1 };
  }

  // saturación del canal (la pone el carácter del universo): continua y con rampa
  setDrive(amount) { this.sat.set(amount); }

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
