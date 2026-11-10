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
//   p.engine   'metal' (6 cuadradas inarmónicas + ruido: el hat tipo 808; `ratios` = otro juego)
//              · 'tone' (tono con caída de altura) · 'fm' (2 operadores) · 'noise' (ruido por un
//              filtro de banda). Fase 2 (cada uno explicado sobre su función): hats 'fmhat',
//              'hiss' (909/707), 'cymbal' (resonadores), 'grains' (shaker); percs 'reso' (rim,
//              clave, conga), 'bell' (cowbell), 'modal' (madera, barra, tubo), 'ks'
//              (Karplus-Strong), 'glitch' (clics y ráfagas) y 'grains'
//   p.len      duración (s) · p.atk ataque lineal (s) · p.tau constante de la caída (s)
//   p.lvl      NIVEL (solo motores nuevos): RMS del tramo de 10 ms más fuerte (ver level)
//   Etapas comunes (en neutro no hacen nada; ver COMMON):
//   p.click    { amt, hp }  palo: ráfaga de ruido de 1,5 ms al principio
//   p.fenv     { oct, tau } envolvente de filtro: el filtro arranca `oct` octavas más arriba y baja
//   p.gate     s: a partir de ahí la cola se cierra en ~4 ms (0 = suena entera)
//   p.drive    saturación (0 = limpia)
//   p.bits · p.down  bits (0 = sin reducir) y muestreo (1 = sin bajar) reducidos, ANTES de la
//              envolvente (como el 909: la cola nunca crepita)
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
const TAU = 2 * Math.PI;

// la parte sin ruido de la última grabación (el metal, el FM; ver renderSet): las variantes
// solo cambian el ruido, así que se calcula una vez
let memoed = null;
function memo(id, make) {
  if (memoed?.id !== id) memoed = { id, m: make() };
  return memoed.m;
}
function metalOf(p, n, sr) {
  return memo(`${p.base}|${(p.ratios || METAL).join(',')}|${n}|${sr}`, () => {
    const m = new Float32Array(n);
    for (const r of p.ratios || METAL) addSquare(m, p.base * r, 1, sr);
    return m;
  });
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

  // ─────────── FASE 2: motores nuevos. Salen con su nivel igualado (p.lvl, ver render)

  // HAT FM: 2 osciladores en fase modulada a proporción inarmónica, con índice alto (casi ruido
  // metálico), un poco de ruido y paso alto fuerte (24 dB). Se calcula a 2× de muestreo para que
  // las bandas laterales no se doblen (sin aliasing)
  fmhat(x, p, sr, rnd, fe) {
    const n = x.length;
    const m = memo(`fm|${p.freq}|${p.ratio}|${p.index}|${n}|${sr}`, () => {
      const sr2 = sr * 2, o = new Float32Array(n);
      const lp1 = new Biquad('lowpass', sr2).set(sr * 0.45, -5.33), lp2 = new Biquad('lowpass', sr2).set(sr * 0.45, 2.33);
      const dc = (TAU * p.freq) / sr2, dm = (TAU * p.freq * p.ratio) / sr2;
      let pc = 0, pm = 0;
      for (let i = 0; i < n; i++) {
        lp2.run(lp1.run(Math.sin(pc + p.index * Math.sin(pm)))); // la muestra de en medio se descarta
        pc += dc; pm += dm;
        o[i] = lp2.run(lp1.run(Math.sin(pc + p.index * Math.sin(pm))));
        pc += dc; pm += dm;
        if (pc > 1e3) { pc %= TAU; pm %= TAU; }
      }
      return o;
    });
    const hp1 = new Biquad('highpass', sr).set(p.hp, 0), hp2 = new Biquad('highpass', sr).set(p.hp, p.hpQ ?? 2);
    const ng = p.noise ?? 0;
    for (let i = 0; i < n; i++) {
      if (fe && (i & 31) === 0) { const k = fe(i); hp1.set(p.hp * k, 0); hp2.set(p.hp * k, p.hpQ ?? 2); }
      x[i] = hp2.run(hp1.run(m[i] * (1 - ng) + (rnd() * 2 - 1) * ng));
    }
  },
  // HAT RUIDO tipo 909/707: ruido blanco por un paso alto doble, el segundo resonante (`res`,
  // en dB), y un pico de paso banda en `bp` (`peak` = cuánto). Los 6 bits del 909 van en `bits`
  hiss(x, p, sr, rnd, fe) {
    const hp1 = new Biquad('highpass', sr).set(p.hp, 0), hp2 = new Biquad('highpass', sr).set(p.hp, p.res);
    const bp = new Biquad('bandpass', sr).set(p.bp, 3);
    for (let i = 0; i < x.length; i++) {
      if (fe && (i & 31) === 0) { const k = fe(i); hp1.set(p.hp * k, 0); hp2.set(p.hp * k, p.res); bp.set(p.bp * k, 3); }
      const w = rnd() * 2 - 1;
      x[i] = hp2.run(hp1.run(w)) + bp.run(w) * p.peak;
    }
  },
  // HAT RESONADORES (plato "real", mcld): una ráfaga de ruido a 14 resonadores repartidos en
  // escala exponencial desde `lo` hasta 18 kHz. `plate` = la semilla del plato: sus frecuencias y
  // caídas son las mismas en todas las variantes (solo cambia el ruido que lo golpea). `ring` =
  // caída media de los resonadores, `tilt` = más agudos (+) o más graves (−), `wash` = ruido
  // directo encima (el "shhh"), `exc` = largo de la ráfaga
  cymbal(x, p, sr, rnd, fe) {
    const pr = rngOf(p.plate), N = 14, hi = Math.min(18000, sr * 0.45);
    const bank = [];
    for (let k = 0; k < N; k++) {
      const f = p.lo * Math.pow(hi / p.lo, (k + (pr() - 0.5) * 0.8) / (N - 1));
      bank.push({ g: Math.pow(f / p.lo, p.tilt), r: new Biquad('bandpass', sr).set(f, Math.max(1, Math.PI * f * p.ring * (0.5 + pr()))) });
    }
    const hp1 = new Biquad('highpass', sr).set(p.hp, 0), hp2 = new Biquad('highpass', sr).set(p.hp, 1);
    const ed = Math.exp(-1 / (p.exc * sr));
    let ex = 1;
    for (let i = 0; i < x.length; i++) {
      if (fe && (i & 31) === 0) { const k = fe(i); hp1.set(p.hp * k, 0); hp2.set(p.hp * k, 1); }
      const w = rnd() * 2 - 1;
      const e = w * ex;
      ex *= ed;
      let y = 0;
      for (let k = 0; k < N; k++) y += bank[k].g * bank[k].r.run(e);
      x[i] = hp2.run(hp1.run(y + w * p.wash * 0.02));
    }
  },
  // GRANOS (shaker, cabasa, semillas: PhISEM de Perry Cook): granos de ruido al azar, más
  // densos al principio (la energía de la sacudida cae con `shake`), cada uno se apaga en `gtau`,
  // todo por un resonador en `freq` con `q`. El primer grano va siempre al principio
  grains(x, p, sr, rnd) {
    const bp = new Biquad('bandpass', sr).set(p.freq, p.q);
    const bp2 = p.freq2 ? new Biquad('bandpass', sr).set(p.freq2, p.q) : null;
    const gd = Math.exp(-1 / (p.gtau * sr)), ed = Math.exp(-1 / (p.shake * sr)), pr = p.rate / sr;
    let lvl = 1, en = 1;
    for (let i = 0; i < x.length; i++) {
      if (rnd() < pr * en) lvl += 0.3 + 0.7 * rnd();
      en *= ed;
      lvl *= gd;
      const s = lvl * (rnd() * 2 - 1);
      x[i] = bp.run(s) + (bp2 ? 0.6 * bp2.run(s) : 0);
    }
  },
  // PERC RESONADOR (el puente en T de la 808: rim, clave, conga): un impulso corto (medio seno
  // de `excW` s: más ancho = más blando) a 1–3 resonadores estrechos en freq·ratios, cada uno con
  // su ganancia y su caída (ring·decays). `bend` = la altura cae de freq·(1+bend) en `bendT`
  reso(x, p, sr, rnd) {
    const W = Math.max(2, Math.round(p.excW * sr));
    const modes = p.ratios.map((r, k) => ({ r, g: p.gains[k], T: p.ring * p.decays[k], bq: new Biquad('bandpass', sr) }));
    const tune = (k) => { for (const m of modes) { const f = p.freq * m.r * k; m.bq.set(f, Math.max(1, Math.PI * f * m.T)); } };
    tune(1 + (p.bend || 0));
    for (let i = 0; i < x.length; i++) {
      if (p.bend && (i & 15) === 0) tune(1 + p.bend * Math.exp(-(i / sr) / p.bendT));
      const e = i < W ? Math.sin((Math.PI * i) / W) : 0;
      let y = 0;
      for (const m of modes) y += m.g * m.bq.run(e);
      x[i] = y;
    }
  },
  // COWBELL 808: dos cuadradas (sin aliasing) a freq y freq·ratio (587 y 845 Hz → 1,44) por un
  // paso banda; `punch` = cuánto del golpe se va en los primeros ~8 ms (la caída en dos tramos)
  bell(x, p, sr) {
    const n = x.length;
    addSquare(x, p.freq, 1, sr);
    addSquare(x, p.freq * p.ratio, 0.8, sr);
    const bp = new Biquad('bandpass', sr).set(p.bp, p.q);
    const pd = Math.exp(-1 / (0.008 * sr));
    let k = 1;
    for (let i = 0; i < n; i++) {
      x[i] = bp.run(x[i]) * (p.punch * k + 1 - p.punch);
      k *= pd;
    }
  },
  // MODAL (madera, barra, tubo: Elements, Plonk): suma de senos que se apagan, uno por modo
  // (freq·ratios, ganancias, caídas ring·decays). `hard` = dureza de la baqueta: cuánto suenan
  // los modos altos (cada uno, hard veces el anterior)
  modal(x, p, sr) {
    const nyq = sr * 0.45;
    p.ratios.forEach((r, k) => {
      const f = p.freq * r;
      if (f >= nyq) return;
      const a = p.gains[k] * Math.pow(p.hard, k);
      const d = (TAU * f) / sr, cd = Math.cos(d), sd = Math.sin(d), dec = Math.exp(-1 / (p.ring * p.decays[k] * sr));
      let s = 0, c = 1, env = a;
      for (let i = 0; i < x.length; i++) {
        x[i] += env * s;
        const s2 = s * cd + c * sd;
        c = c * cd - s * sd;
        s = s2;
        env *= dec;
      }
    });
  },
  // KARPLUS-STRONG (madera aguda): una ráfaga de ruido (más o menos brillante: `bright`) da
  // vueltas en una línea de retardo afinada a `freq` y se apaga con la caída `ring`. Con poca
  // realimentación, un tic de madera afinado
  ks(x, p, sr, rnd) {
    const n = x.length, D = sr / p.freq - 0.5;
    const P = Math.max(2, Math.round(sr / p.freq));
    const g = Math.exp(-1 / (p.freq * p.ring)); // pérdida por vuelta
    const y = new Float64Array(n);
    const at = (t) => { // y en una posición fraccionaria (0 antes del principio)
      if (t < 0) return 0;
      const i = Math.floor(t), f = t - i;
      return y[i] + (i + 1 < n ? (y[i + 1] - y[i]) * f : 0);
    };
    let lp = 0;
    for (let i = 0; i < n; i++) {
      let e = 0;
      if (i < P) { lp += p.bright * ((rnd() * 2 - 1) - lp); e = lp; }
      y[i] = e + g * 0.5 * (at(i - D) + at(i - D - 1));
      x[i] = y[i];
    }
  },
  // GLITCH (microhouse): de 1 a `n` ráfagas de 1–`blen` ms repartidas en `spread` s: clic
  // (pulso cuadrado), ruido o un pitido a freq (hasta 2 octavas más arriba). Cada variante, otra
  // ráfaga. Sin continua (paso alto a 30 Hz)
  glitch(x, p, sr, rnd) {
    const n = x.length;
    for (let e = 0; e < p.n; e++) {
      const st = e === 0 ? 0 : Math.floor(rnd() * p.spread * sr);
      const L = Math.round((0.001 + rnd() * (p.blen - 0.001)) * sr);
      const a = e === 0 ? 1 : 0.3 + 0.7 * rnd();
      const kind = rnd(), f = p.freq * Math.pow(2, rnd() * 2), half = Math.max(2, Math.round(L / (2 + rnd() * 4)));
      for (let i = 0; i < L && st + i < n; i++) {
        const v = kind < 0.33 ? (Math.floor(i / half) % 2 ? -1 : 1) : kind < 0.66 ? rnd() * 2 - 1 : Math.sin((TAU * f * i) / sr);
        const ramp = Math.min(1, i / 3, (L - i) / 3); // 3 muestras: sigue siendo un clic, sin continua
        x[st + i] += a * v * ramp;
      }
    }
    const hp = new Biquad('highpass', sr).set(30, 0);
    for (let i = 0; i < n; i++) x[i] = hp.run(x[i]);
  },
};
export const ENGINE_NAMES = Object.keys(ENGINES);
// ¿la variante cambia algo? (los motores sin ruido salen iguales: basta una grabación)
const NOISY = new Set(['metal', 'noise', 'fmhat', 'hiss', 'cymbal', 'grains', 'ks', 'glitch']);
export const isRandom = (p) => NOISY.has(p.engine) || !!p.click?.amt || !!p.jitter;

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
  // motores nuevos: el golpe flojo, más oscuro (y más blando en los resonadores y la baqueta)
  if (q.engine === 'fmhat' || q.engine === 'cymbal') q.hp *= dark;
  if (q.engine === 'hiss') { q.hp *= dark; q.bp *= dark; }
  if (q.engine === 'grains') q.freq *= Math.sqrt(dark);
  if (q.engine === 'reso') q.excW /= dark;
  if (q.engine === 'bell') q.bp *= dark;
  if (q.engine === 'modal') q.hard *= dark;
  if (q.engine === 'ks') q.bright *= dark;
  q.tau *= len;
  return q;
}

// NIVEL de los motores nuevos: el tramo de 10 ms más fuerte del golpe a `lvl` de RMS (lo que se
// oye como "volumen" en un golpe corto), sin pasar de un pico de 0,9. Así un motor nuevo suena
// tan fuerte como los de antes sea cual sea su ganancia interna (un resonador estrecho sale
// muy flojo, un clic muy picudo). Los motores de antes no lo usan: siguen idénticos
function level(x, lvl, sr) {
  const W = Math.max(1, Math.round(0.01 * sr));
  let sum = 0, best = 0, peak = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    sum += v * v;
    if (i >= W) sum -= x[i - W] * x[i - W];
    if (sum > best) best = sum;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  if (!(best > 0) || !(peak > 0)) return;
  const k = Math.min(lvl / Math.sqrt(best / W), 0.9 / peak);
  for (let i = 0; i < x.length; i++) x[i] *= k;
}

export function render(p0, sr, seed = 1, soft = false) {
  const rnd = rngOf(seed);
  const p = shape(p0, rnd, soft);
  const n = Math.max(1, Math.ceil(p.len * sr));
  const x = new Float32Array(n);
  const fe = p.fenv?.oct ? (i) => Math.pow(2, p.fenv.oct * Math.exp(-(i / sr) / p.fenv.tau)) : null;
  ENGINES[p.engine](x, p, sr, rnd, fe);
  // muestreo y bits reducidos ANTES de la envolvente, como en las máquinas (el 909 guarda sus
  // platos en 6 bits y la caída la pone después, en analógico): la cola baja suave y nunca
  // crepita al acercarse al último escalón. Se reduce la señal llevada a pico 1. `down` =
  // mantener cada muestra `down` veces (el grano digital)
  if (p.down > 1 || p.bits) {
    let pk = 0;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(x[i]));
    const k = pk > 0 ? 1 / pk : 1;
    const L = p.bits ? Math.pow(2, p.bits - 1) : 0;
    for (let i = 0; i < n; i++) {
      if (p.down > 1 && i % p.down) { x[i] = x[i - (i % p.down)]; continue; } // (ya escalada y reducida)
      const v = x[i] * k;
      x[i] = L ? Math.round(v * L) / L : v;
    }
  }

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
  if (p.lvl) level(x, p.lvl, sr);
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
  memoed = null;
  for (let l = 0; l < layers; l++) {
    const row = [];
    for (let v = 0; v < n; v++) row.push(render(p, sr, seed + v * 7919 + l * 104729, layers === 2 && l === 0));
    out.push(row);
  }
  memoed = null;
  return out;
}
