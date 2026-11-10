// TALLER DE PERCUSIÓN — síntesis de hats y percs en JS puro (sin Web Audio, sin DOM).
// Cada sonido se GRABA una vez en un búfer (ver soundBank.js, que lo hace en un Worker) y cada
// golpe solo lo reproduce: 2 nodos por golpe, cueste lo que cueste el motor. Al ser JS puro:
//   · no hay límites de Web Audio (ecos de < 3 ms, bits, cualquier DSP);
//   · se prueba en Node, es determinista (semilla por variante);
//   · es el mismo código que un día correrá en el AudioWorklet (RENDIMIENTO.md §4.3).
//
// Los motores reproducen a la muestra lo que hacían los nodos de Web Audio (mismas fórmulas de
// filtro que la especificación, osciladores limitados en banda, mismas envolventes), así el paso
// al taller no cambió el sonido (medido, ver README → "Taller de percusión").
//
// `render(p, sr, seed, soft)` → Float32Array a ganancia 1 (la velocidad la pone el golpe).
//   p.engine   'metal' (6 cuadradas inarmónicas + ruido: el hat tipo 808) · 'tone' (tono con caída
//              de altura) · 'fm' (2 operadores) · 'noise' (ruido por un filtro de banda)
//   p.len      duración (s) · p.atk ataque lineal (s) · p.tau constante de la caída (s)
//   Etapas comunes (en neutro no hacen nada; ver COMMON):
//   p.click    { amt, hp }  palo: ráfaga de ruido de 1,5 ms al principio
//   p.fenv     { oct, tau } envolvente de filtro: el filtro arranca `oct` octavas más arriba y baja
//   p.gate     s: a partir de ahí la cola se cierra en ~4 ms (0 = suena entera)
//   p.drive    saturación (0 = limpia) · p.bits (0 = sin reducir) · p.down (1 = sin bajar muestreo)
//   p.velTone  0..1: con `soft` (golpe flojo) más oscuro y más corto
//   p.jitter   0..1: cada variante, un poco distinta de altura y de largo

export const COMMON = { click: null, fenv: null, gate: 0, drive: 0, bits: 0, down: 1, velTone: 0, jitter: 0 };

// azar con semilla (mulberry32): la misma variante suena siempre igual
export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────── filtros (fórmulas de la especificación de Web Audio)
// Paso alto y paso bajo: Q en dB. Paso banda: Q lineal. Coeficientes recalculables en marcha
// (envolvente de filtro) sin perder el estado.
class Biquad {
  constructor(type, sr) { this.type = type; this.sr = sr; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(f, q) {
    const w = (2 * Math.PI * Math.min(f, this.sr * 0.499)) / this.sr;
    const cw = Math.cos(w), sw = Math.sin(w);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === 'bandpass') {
      const al = sw / (2 * q);
      b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    } else {
      const al = sw / (2 * Math.pow(10, q / 20));
      const s = this.type === 'highpass' ? 1 : -1;
      b0 = (1 + s * cw) / 2; b1 = -s * (1 + s * cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ───────────────────────── osciladores limitados en banda (como los de Web Audio: suma de
// armónicos hasta Nyquist, sin aliasing)
// Cuadrada de amplitud 1 por serie de Fourier: (4/π) Σ sin(kφ)/k, k impar. Web Audio normaliza su
// cuadrada (RMS 0,845 en vez de ~1): SQUARE_NORM iguala el nivel. Medido contra Chrome a 200, 330
// y 500 Hz: el hat solo de metal salía +1,54 dB en las tres, siempre igual
const SQUARE_NORM = 0.8375;
function addSquare(out, f, amp, sr) {
  const n = out.length, nyq = sr / 2;
  for (let k = 1; k * f < nyq; k += 2) {
    const d = (2 * Math.PI * k * f) / sr;
    const cd = Math.cos(d), sd = Math.sin(d);
    const a = ((4 / Math.PI) * amp * SQUARE_NORM) / k;
    let s = 0, c = 1; // sin y cos de kφ, rotando
    for (let i = 0; i < n; i++) {
      out[i] += a * s;
      const s2 = s * cd + c * sd;
      c = c * cd - s * sd;
      s = s2;
    }
  }
}
// una muestra de seno o de triángulo limitado en banda a fase `ph` y frecuencia `f`
function waveAt(wave, ph, f, nyq) {
  if (wave !== 'triangle') return Math.sin(ph);
  // triángulo: (8/π²) Σ (−1)^((k−1)/2) sin(kφ)/k², k impar; sin(kφ) por recurrencia de Chebyshev
  const s1 = Math.sin(ph), c2 = 2 * Math.cos(2 * ph);
  let prev = -s1, cur = s1, sum = 0, sign = 1; // sin(−φ), sin(φ)
  for (let k = 1; k * f < nyq; k += 2) {
    sum += (sign * cur) / (k * k);
    const nx = c2 * cur - prev;
    prev = cur; cur = nx; sign = -sign;
  }
  return (8 / (Math.PI * Math.PI)) * sum;
}

// ───────────────────────── motores: llenan `x` (la señal antes de la envolvente de volumen)
const METAL = [1, 1.4826, 1.8003, 2.5461, 2.6303, 3.8968]; // proporciones tipo 808

// el metal de la última grabación (ver renderSet): las variantes solo cambian el ruido
let metalMemo = null;
function metalOf(p, n, sr) {
  const id = `${p.base}|${(p.ratios || METAL).join(',')}|${n}|${sr}`;
  if (metalMemo?.id === id) return metalMemo.m;
  const m = new Float32Array(n);
  for (const r of p.ratios || METAL) addSquare(m, p.base * r, 1, sr);
  metalMemo = { id, m };
  return m;
}

const ENGINES = {
  // HAT: 6 cuadradas + ruido → paso banda → paso alto
  metal(x, p, sr, rnd, fe) {
    const n = x.length;
    const m = metalOf(p, n, sr);
    const mg = (1 - p.noiseMix) * 0.16, ng = p.noiseMix * 0.9;
    const bp = new Biquad('bandpass', sr).set(p.bp, p.bpQ ?? 0.7);
    const hp = new Biquad('highpass', sr).set(p.hp, p.hpQ ?? 1);
    for (let i = 0; i < n; i++) {
      if (fe && (i & 31) === 0) { const k = fe(i); bp.set(p.bp * k, p.bpQ ?? 0.7); hp.set(p.hp * k, p.hpQ ?? 1); }
      x[i] = hp.run(bp.run(m[i] * mg + (rnd() * 2 - 1) * ng));
    }
  },
  // tono con caída de altura (exponencial de freq·(1+bend) a freq en `bendT`)
  tone(x, p, sr) {
    const nyq = sr / 2, f0 = p.freq * (1 + p.bend), bt = p.bendT;
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / sr;
      const f = t < bt ? f0 * Math.pow(p.freq / f0, t / bt) : p.freq;
      x[i] = waveAt(p.wave, ph, f, nyq);
      ph += (2 * Math.PI * f) / sr;
      if (ph > 2 * Math.PI) ph -= 2 * Math.PI;
    }
  },
  // FM: portadora seno, moduladora seno a freq·ratio con índice que cae (τ = idxTau)
  fm(x, p, sr) {
    const fm = p.freq * p.ratio, dev0 = p.freq * p.index;
    let pc = 0, pm = 0;
    for (let i = 0; i < x.length; i++) {
      x[i] = Math.sin(pc);
      const fc = p.freq + dev0 * Math.exp(-(i / sr) / p.idxTau) * Math.sin(pm);
      pc += (2 * Math.PI * fc) / sr;
      pm += (2 * Math.PI * fm) / sr;
    }
  },
  // ruido por un paso banda estrecho (con su compensación de nivel)
  noise(x, p, sr, rnd, fe) {
    const bp = new Biquad('bandpass', sr).set(p.freq, p.q);
    const mk = 1 + p.q * 0.35;
    for (let i = 0; i < x.length; i++) {
      if (fe && (i & 31) === 0) bp.set(p.freq * fe(i), p.q);
      x[i] = bp.run(rnd() * 2 - 1) * mk;
    }
  },
};
export const ENGINE_NAMES = Object.keys(ENGINES);
// ¿la variante cambia algo? (los motores sin ruido salen iguales: basta una grabación)
export const isRandom = (p) => p.engine === 'metal' || p.engine === 'noise' || !!p.click?.amt || !!p.jitter;

// golpe flojo (velTone): más oscuro y más corto · jitter: cada variante algo distinta
function shape(p, rnd, soft) {
  const q = { ...COMMON, ...p };
  const dark = soft && q.velTone ? Math.pow(2, -1.2 * q.velTone) : 1;
  const j = q.jitter ? (rnd() * 2 - 1) * q.jitter : 0;
  const pitch = Math.pow(2, (j * 0.6) / 12); // hasta ±0,6 semitonos
  const len = 1 - 0.3 * (soft ? q.velTone : 0) + 0.12 * j;
  if (q.base) q.base *= pitch;
  if (q.freq) q.freq *= pitch;
  if (q.engine === 'metal') { q.bp *= dark; q.hp *= dark; }
  if (q.engine === 'noise') q.freq *= dark;
  if (q.engine === 'tone') q.bend *= dark;
  if (q.engine === 'fm') q.index *= dark;
  q.tau *= len;
  return q;
}

export function render(p0, sr, seed = 1, soft = false) {
  const rnd = rngOf(seed);
  const p = shape(p0, rnd, soft);
  const n = Math.max(1, Math.ceil(p.len * sr));
  const x = new Float32Array(n);
  const fe = p.fenv?.oct ? (i) => Math.pow(2, p.fenv.oct * Math.exp(-(i / sr) / p.fenv.tau)) : null;
  ENGINES[p.engine](x, p, sr, rnd, fe);

  // volumen: rampa lineal hasta 1 en `atk` y caída exponencial (setTargetAtTime) con `tau`;
  // con `gate`, la cola se cierra en ~4 ms desde ahí. Los últimos 2 ms, a cero (sin clic al final)
  const atk = Math.max(1, Math.round(p.atk * sr));
  const fadeN = Math.min(n, Math.round(0.002 * sr));
  const gateN = p.gate ? Math.round(p.gate * sr) : Infinity;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let g = i < atk ? i / atk : Math.exp(-(t - p.atk) / p.tau);
    if (i > gateN) g *= Math.exp(-((i - gateN) / sr) / 0.004);
    if (i >= n - fadeN) g *= (n - i) / fadeN;
    x[i] *= g;
  }
  // palo: una ráfaga de ruido muy corta y brillante encima del ataque
  if (p.click?.amt) {
    const hp = new Biquad('highpass', sr).set(p.click.hp || 3000, 0);
    const cn = Math.round(0.0015 * sr);
    for (let i = 0; i < Math.min(n, cn * 3); i++) x[i] += hp.run(rnd() * 2 - 1) * p.click.amt * Math.exp(-i / cn);
  }
  if (p.drive) {
    const k = 1 + 6 * p.drive, norm = 1 / Math.tanh(k);
    for (let i = 0; i < n; i++) x[i] = Math.tanh(x[i] * k) * norm;
  }
  if (p.down > 1) { // bajar el muestreo: mantener cada muestra `down` veces (el grano digital)
    for (let i = 0; i < n; i++) if (i % p.down) x[i] = x[i - (i % p.down)];
  }
  if (p.bits) {
    const L = Math.pow(2, p.bits - 1);
    for (let i = 0; i < n; i++) x[i] = Math.round(x[i] * L) / L;
  }
  // VIGILANTE: una sola muestra no numérica deja mudo el máster para siempre (RENDIMIENTO.md §10):
  // con parámetros raros (una caída de 0 s...) la grabación sale en silencio, nunca con NaN
  for (let i = 0; i < n; i++) if (!Number.isFinite(x[i])) { x.fill(0); break; }
  return x;
}

// las variantes de un sonido (y sus dos capas si responde a la velocidad): capa 0 = golpe flojo.
// El metal (6 cuadradas, lo más caro) es igual en todas las variantes: se calcula una vez
export function renderSet(p, sr, seed, variants) {
  const layers = p.velTone > 0 ? 2 : 1;
  const n = isRandom(p) ? variants : 1;
  const out = [];
  metalMemo = null;
  for (let l = 0; l < layers; l++) {
    const row = [];
    for (let v = 0; v < n; v++) row.push(render(p, sr, seed + v * 7919 + l * 104729, layers === 2 && l === 0));
    out.push(row);
  }
  metalMemo = null;
  return out;
}
