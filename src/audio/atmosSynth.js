// CRUJIDO Y RUIDO (antes TEXTURA y AMBIENTE) · LA SÍNTESIS (sin audio del navegador: números →
// muestras). Corre en un Worker (atmosWorker.js) y en Node (herramientas/atmos.mjs, para medirlo). Qué
// decide cada universo: music/atmos.js. Cómo se monta: atmosFx.js.
//
// LAS CAMAS (una por capa: vinilo, lluvia, fuego, cinta, sala, viento, ciudad) se graban UNA vez por
// universo como un BUCLE estéreo de N muestras (2^19 o 2^20 a 32 kHz: 16 o 33 s) PERIÓDICO POR CONSTRUCCIÓN: el ruido
// se hace en frecuencia (una FFT de N puntos es periódica en N), los sucesos (clics, gotas) caen
// «módulo N» y los filtros recursivos se pasan dos vueltas (la segunda empieza con la memoria de la
// primera). Así el bucle no tiene costura y no hace falta fundido. Cada universo, su bucle: no se oye
// que se repita bajo la música (y el VINILO se repite de verdad: cada vuelta del disco).
// LOS PÁJAROS se graban canto a canto (sucesos sueltos, nunca en bucle). El DRON es en vivo (sigue a la
// tónica): atmosFx.js.
//
// FUENTES (los números de cada cosa; ver también ROMINIMAL.md §7):
//  [GA]  M. González, «Digital Audio Antiquing», tesis, Aalto (TKK) 2007, cap. 5.1 (LP de vinilo):
//        duración de los clics Weibull (a = 10,69 muestras a 44,1 kHz, b = 1,06); tiempo entre clics Gamma
//        (forma 0,2, escala 2433,8 muestras: medio 11 ms ≈ 90 clics/s en un disco muy gastado; la forma
//        < 1 = a ráfagas); amplitud lognormal (µ −3,63, σ 0,74) con media 0,2; cada clic por un paso bajo
//        Butterworth de orden 3 con el corte al azar, uniforme entre 0,1 y 0,5 de Nyquist, por tramos de
//        1000 muestras; banda del disco hasta 9–12 kHz; rayas: un golpe sordo cada vuelta (60/33 s).
//  [MO]  E. Moliner, V. Välimäki, «Realistic gramophone noise synthesis using a diffusion model»,
//        DAFx 2022: clics de < 20 µs a 4 ms; «thump» = discontinuidad de < 2 ms + cola de oscilaciones
//        amortiguadas de frecuencia que cae (el brazo), > 50 ms: s(n) = A·e^(−n/fs·τe)·sin(2π·f·n/fs),
//        f = (fmax − fmin)·e^(−n/fs·τf) + fmin.
//  [CAS] casete: ecualización de reproducción IEC de 120 µs (tipo I, 1326 Hz) o 70 µs (2274 Hz): por
//        encima del codo el soplido SUBE 6 dB/octava (por eso «sopla»); tipo I, unos −50 dB.
//  [NC]  curvas NC (Beranek; ANSI S12.2), niveles por octava de 63 Hz a 8 kHz: el aire de una sala.
//  [FA]  A. Farnell, «Designing Sound» (MIT Press 2010), prácticas 15 (lluvia: pulsos parabólicos,
//        paso alto en 900 Hz; lluvia ruidosa, paso alto en 2 kHz; lluvia en hojas: 2 pasos altos en 500 Hz y
//        paso bajo en 4 kHz) y 18 (viento: velocidad con un seno de 0,1 Hz, RÁFAGAS = ruido por un paso
//        bajo de 0,5 Hz, TURBONADAS = ruido por un paso bajo de 3 Hz por encima de 0,4 × 8; el cuerpo, ruido
//        por un paso banda de 800 Hz y Q 1 con +0,2; el aullido, un filtro resonante de Q 60 en
//        600 + 400 × velocidad, dos, en 0,28 y 0,64 del panorama; las hojas, paso alto 200 y bajo 4000
//        con la velocidad por un paso bajo de 0,07 Hz).
//  [VD]  K. van den Doel, «Physically based models for liquid sounds», ACM TAP 2005: burbuja =
//        a·sin(2πft)·e^(−dt), f = 3/r (r en m, Minnaert), d = 0,13/r + 0,0072·r^(−3/2); al subir, f(t) =
//        f0·(1 + ξ·d·t) con ξ ≈ 0,1 para gotas; a = D·r^1,5, D = rnd^γ (γ ≈ 10 suena mejor); radios de
//        2–7 mm = «una gota de agua»; hasta 1000 burbujas/s = goteo o lluvia ligera, 10000/s = densa.
//  [FF]  Farnell, práctica 11 (fuego): CHASQUIDOS = ruido por un paso banda de Q 1 centrado en
//        1500 + 500 × su caída (la caída al azar, 0–29 ms: los cortos, graves; los largos, agudos) con la
//        envolvente al cuadrado, disparados cuando un ruido lento (paso bajo de 1 Hz) cruza un umbral;
//        SISEO = ruido por encima de 1 kHz por 600·(10 × ruido lento)^4 (casi siempre callado, a golpes);
//        LAMIDO = ruido por un paso banda de 30 Hz y Q 5, ×100, dos pasos altos de 25 Hz, recortado a
//        ±0,9, ×0,6. Mezcla 0,2 / 0,3 / 0,6. Una hoguera: cuatro de esos, cada uno por su banda (paso alto
//        de 1 kHz; paso banda de 1200 Hz Q 0,6; 2600 Hz Q 0,4; 600 Hz Q 0,2), × 0,2.
//  [BD]  cantos: sílabas de 10–300 ms con la fundamental entre 2 y 7 kHz (Scholarpedia, «Models of
//        birdsong»; Stowell & Plumbley, EUSIPCO 2012: barridos lineales en 2–8 kHz); trinos = sílabas
//        repetidas; currucas: 10–20 s entre cantos (Ayres, UVM 2025).
//  [TR]  EN 1793-3, espectro normalizado de tráfico (tercios de octava, ponderado A, de 100 Hz a 5 kHz;
//        máximo en 1 kHz). Los valores de la tabla 1 tal como se citan (la norma es de pago: sin
//        comprobar contra el original).
//  [ISO] ISO 9613-1: absorción del aire (dB/m) según frecuencia, temperatura y humedad: la ciudad lejana
//        pierde los agudos. [MK] Maekawa: una pantalla (edificios) quita más cuanto más agudo (~3 dB/oct).

import { Rng } from '../core/rng.js';

export const ATMOS_SR = 32000; // las camas, a 32 kHz (hasta 16 kHz: de sobra para soplidos, lluvia y clics a 9–15 kHz)
export const RMS_DB = -24;     // cada capa sale con su RMS aquí, o menos si el pico pasaría de −1 dBFS (el MIXER las baja: faders a −46, y vinilo, cinta y sala 18 dB más)

// ───────────────────────── HERRAMIENTAS
const TAU = 2 * Math.PI;
const db = (x) => Math.pow(10, x / 20);

// FFT compleja, en el sitio (radix 2). `inv` = inversa (sin dividir por N)
export function fft(re, im, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? TAU : -TAU) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

// DOS ruidos independientes con el mismo espectro |mag(f)|, periódicos en N (de una sola FFT: la parte
// real y la imaginaria de la inversa de un espectro de fase al azar). RMS 1 cada uno
export function shapedNoise2(N, sr, mag, rng) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let k = 1; k < N; k++) {
    const f = (k <= N / 2 ? k : N - k) * sr / N;
    const m = mag(f);
    if (!(m > 0)) continue;
    const ph = rng.next() * TAU;
    re[k] = m * Math.cos(ph); im[k] = m * Math.sin(ph);
  }
  fft(re, im, true);
  return [toF32(re), toF32(im)].map((a) => scaleTo(a, 1));
}
const toF32 = (a) => Float32Array.from(a);
export function rms(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }
function scaleTo(a, target) { const r = rms(a); if (r > 0) { const g = target / r; for (let i = 0; i < a.length; i++) a[i] *= g; } return a; }
// mezcla `b` en `a` con ganancia g
function addTo(a, b, g = 1) { for (let i = 0; i < a.length; i++) a[i] += b[i] * g; return a; }
// estéreo con correlación c (0 = independientes, 1 = mono) a partir de dos ruidos independientes
function correlate(a, b, c) { const s = Math.sqrt(1 - c * c); const R = new Float32Array(a.length); for (let i = 0; i < a.length; i++) R[i] = c * a[i] + s * b[i]; return [a, R]; }

// respuestas de filtros analógicos (módulo), para dar forma en frecuencia
const lp2 = (f, fc) => 1 / Math.sqrt(1 + Math.pow(f / fc, 4));      // Butterworth 2
const hp2 = (f, fc) => 1 / Math.sqrt(1 + Math.pow(fc / f, 4));
const bp = (f, f0, q) => { const x = q * (f / f0 - f0 / f); return 1 / Math.sqrt(1 + x * x); };
const pole = (f, tau) => 1 / Math.sqrt(1 + Math.pow(TAU * f * tau, 2));
const zero = (f, tau) => Math.sqrt(1 + Math.pow(TAU * f * tau, 2));

// BIQUAD (RBJ) con estado; `set` cambia coeficientes sin tocar la memoria (barridos sin clic)
class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, f, q, sr) {
    const w = TAU * Math.min(f, sr * 0.49) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; } // paso banda, 0 dB en el centro
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
    return this;
  }
  tick(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
// un paso bajo de 1 polo con estado
class OnePole {
  constructor() { this.y = 0; }
  set(f, sr) { this.a = Math.exp(-TAU * f / sr); return this; }
  tick(x) { this.y = x + this.a * (this.y - x); return this.y; }
}

// sorteos
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(TAU * r.next());
const logn = (r, mu, s) => Math.exp(mu + s * gauss(r));
const weibull = (r, a, b) => a * Math.pow(-Math.log(1 - r.next()), 1 / b);
// Gamma(forma k, escala θ) — Marsaglia y Tsang; con k < 1, el truco de U^(1/k)
function gamma(r, k, th) {
  if (k < 1) return gamma(r, k + 1, th) * Math.pow(r.next(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = gauss(r); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = r.next();
    if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * th;
  }
}
// panorama de igual potencia (−1..1)
const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

// RMS a −24 dBFS y los picos por debajo de −1 dBFS con una rodilla suave. `peakCap` (vinilo y fuego, lo
// crujiente a sucesos sueltos; desde 2026-11-13): además, nunca con el pico por encima de −1 dBFS: su
// RMS queda más abajo en vez de aplastar los clics, y sin rodilla. Lluvia, viento, ciudad, cinta y sala,
// como el usuario los oyó al poner sus faders
export function normalize([L, R], peakCap = false) {
  let pk = 0;
  if (peakCap) for (const a of [L, R]) for (let i = 0; i < a.length; i++) pk = Math.max(pk, Math.abs(a[i]));
  let g = db(RMS_DB) / Math.max(1e-9, Math.sqrt((rms(L) ** 2 + rms(R) ** 2) / 2));
  if (peakCap) g = Math.min(g, db(-1) / Math.max(1e-9, pk));
  const knee = db(-7), top = db(-1);
  for (const a of [L, R]) for (let i = 0; i < a.length; i++) {
    let x = a[i] * g;
    const ax = Math.abs(x);
    if (!peakCap && ax > knee) x = Math.sign(x) * (knee + (top - knee) * Math.tanh((ax - knee) / (top - knee))); // (con tope, sin rodilla: nada se aplasta)
    a[i] = x;
  }
  return [L, R];
}

// ───────────────────────── ISO 9613-1: absorción del aire (dB por metro)
export function airAbsorption(f, tempC = 15, hr = 70, pa = 101.325) {
  const T = tempC + 273.15, T0 = 293.15, T01 = 273.16, pr = 101.325;
  const C = -6.8346 * Math.pow(T01 / T, 1.261) + 4.6151;
  const h = hr * Math.pow(10, C) * (pr / pa);
  const frO = (pa / pr) * (24 + 4.04e4 * h * (0.02 + h) / (0.391 + h));
  const frN = (pa / pr) * Math.pow(T / T0, -0.5) * (9 + 280 * h * Math.exp(-4.170 * (Math.pow(T / T0, -1 / 3) - 1)));
  return 8.686 * f * f * (1.84e-11 * (pr / pa) * Math.sqrt(T / T0)
    + Math.pow(T / T0, -2.5) * (0.01275 * Math.exp(-2239.1 / T) / (frO + f * f / frO) + 0.1068 * Math.exp(-3352 / T) / (frN + f * f / frN)));
}

// interpolar una tabla por bandas (frecuencias centrales, dB) en escala logarítmica, con pendiente
// fuera de la tabla: `lowSlope` = dB por octava hacia abajo, `highSlope` = dB por octava hacia arriba
function bandDb(f, F, D, lowSlope = 0, highSlope = -6) {
  if (f <= F[0]) return D[0] + lowSlope * Math.log2(F[0] / f);
  const n = F.length - 1;
  if (f >= F[n]) return D[n] + highSlope * Math.log2(f / F[n]);
  let i = 0;
  while (f > F[i + 1]) i++;
  const u = Math.log(f / F[i]) / Math.log(F[i + 1] / F[i]);
  return D[i] + (D[i + 1] - D[i]) * u;
}

// ───────────────────────── LAS CAPAS
// VINILO [GA, MO]: crujido (clics a ráfagas) + rayas (un golpe sordo por vuelta). SIN siseo de ruido
// (2026-11-13, el usuario: «vinilo no tiene ruido blanco»; antes llevaba el de surco por la curva RIAA).
// El bucle dura un número entero de VUELTAS del disco: la raya cae siempre en su sitio
function vinyl(P, N, sr, r) {
  const T = N / sr;
  const revs = Math.max(1, Math.round(T / (60 / P.rpm)));
  const rev = T / revs; // (la vuelta, ajustada al bucle: < 2 % de la velocidad nominal)
  // crujido [GA]: de ~3 clics/s (disco limpio) a ~90/s (muy gastado), a ráfagas (Gamma de forma 0,2)
  const rate = 3 * Math.pow(90.6 / 3, P.wear);
  const sr44 = sr / 44100;
  const cl = [new Float32Array(N), new Float32Array(N)];
  const meanLogn = Math.exp(-3.6267 + 0.7421 * 0.7421 / 2);
  let t = r.next() * sr / rate, clicks = 0;
  while (t < N) {
    const dur = Math.max(1, Math.round(weibull(r, 10.6907, 1.0606) * sr44));
    const amp = logn(r, -3.6267, 0.7421) / meanLogn * (r.next() < 0.5 ? 1 : -1);
    // una pared del surco (un canal, el otro algo) o las dos
    const one = r.next() < 0.6, side = r.next() < 0.5;
    const gL = one ? (side ? 1 : r.float(0.15, 0.4)) : r.float(0.8, 1);
    const gR = one ? (side ? r.float(0.15, 0.4) : 1) : r.float(0.8, 1);
    const t0 = Math.floor(t);
    for (let i = 0; i < dur; i++) {
      const w = Math.sin(Math.PI * (i + 0.5) / dur); // ventana: sin escalón
      const x = amp * w * (r.next() * 2 - 1) * 1.7;
      const k = (t0 + i) % N;
      cl[0][k] += x * gL; cl[1][k] += x * gR;
    }
    clicks++;
    t += Math.max(1, gamma(r, 0.2, sr / rate / 0.2));
  }
  // cada tramo de 1000 muestras (a 44,1 kHz) con su corte: Butterworth 3 = 1 polo + biquad de Q 1
  const frame = Math.round(1000 * sr44);
  const fcs = Array.from({ length: Math.ceil(N / frame) }, () => r.float(0.1, 0.5) * 22050);
  for (const a of cl) {
    const p1 = new OnePole(), b = new Biquad();
    const out = new Float32Array(N);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        if (i % frame === 0) { const fc = fcs[(i / frame) | 0]; p1.set(fc, sr); b.set('lp', fc, 1, sr); }
        const y = b.tick(p1.tick(a[i]));
        if (pass) out[i] = y;
      }
    }
    a.set(out);
  }
  // rayas [GA, MO]: cada una, en su sitio de la vuelta, durante 5–9 vueltas seguidas
  const th = [new Float32Array(N), new Float32Array(N)];
  for (let s = 0; s < P.scratches; s++) {
    const at = r.next() * rev, len = Math.min(revs, r.int(5, 9)), first = r.int(0, revs - 1);
    const A = r.float(3, 8), fmax = r.float(60, 110), fmin = r.float(9, 14);
    const te = r.float(0.06, 0.12), tf = r.float(0.03, 0.05);
    for (let v = 0; v < len; v++) {
      const k0 = Math.floor(((first + v) % revs) * rev * sr + at * sr);
      const a = A * r.float(0.85, 1.1);
      const n = Math.floor(6 * te * sr);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const tt = i / sr;
        const f = (fmax - fmin) * Math.exp(-tt / tf) + fmin;
        ph += TAU * f / sr;
        let x = a * Math.exp(-tt / te) * Math.sin(ph);
        if (tt < 0.0015) x += a * 1.5 * (r.next() * 2 - 1) * (1 - tt / 0.0015); // la discontinuidad (< 2 ms)
        th[0][(k0 + i) % N] += x; th[1][(k0 + i) % N] += x * 0.9;
      }
    }
  }
  const L = new Float32Array(N), R = new Float32Array(N);
  addTo(L, cl[0]); addTo(R, cl[1]);
  addTo(L, th[0], 0.35); addTo(R, th[1], 0.35);
  return { out: [L, R], info: { revs, rev, rate, clicks } };
}

// CINTA [CAS]: soplido plano hasta el codo de la ecualización y +6 dB/octava por encima, hasta el
// corte de la cabeza (10–14 kHz). Pistas independientes
function tape(P, N, sr, r) {
  return shapedNoise2(N, sr, (f) => zero(f, P.tau) * hp2(f, 40) * lp2(f, P.lp), r); // (ya independientes)
}

// SALA [NC]: el aire de una habitación, con la forma de su curva NC por octavas (63 Hz – 8 kHz)
const NC_F = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
const NC = {
  15: [47, 36, 29, 22, 17, 14, 12, 11], 20: [51, 40, 33, 26, 22, 19, 17, 16], 25: [54, 44, 37, 31, 27, 24, 22, 21],
  30: [57, 48, 41, 35, 31, 29, 28, 27], 35: [60, 52, 45, 40, 36, 34, 33, 32], 40: [64, 56, 50, 45, 41, 39, 38, 37],
};
export function ncCurve(nc) {
  const ks = Object.keys(NC).map(Number);
  const lo = Math.max(...ks.filter((k) => k <= nc)), hi = Math.min(...ks.filter((k) => k >= nc));
  const u = hi === lo ? 0 : (nc - lo) / (hi - lo);
  return NC[lo].map((v, i) => v + (NC[hi][i] - v) * u);
}
function room(P, N, sr, r) {
  const D = ncCurve(P.nc);
  // nivel de banda de octava → densidad por Hz (ancho de una octava ≈ 0,707 f)
  const mag = (f) => db(bandDb(f, NC_F, D, 4, -3) - 10 * Math.log10(0.707 * f)) * hp2(f, 25);
  const [a, b] = shapedNoise2(N, sr, mag, r);
  return correlate(a, b, 0.4);
}

// un proceso lento periódico (ruido por un paso bajo de 2 polos en `fc` Hz), desviación 1
function slowNoise(N, sr, fc, r) { return shapedNoise2(N, sr, (f) => 1 / (1 + (f / fc) ** 2), r)[0]; }

// FUEGO [FF]: `gens` fogones (de 2 a 4; Farnell junta 4), cada uno con sus chasquidos, su siseo y su
// lamido, por su banda y en su sitio del panorama. Los niveles de Pd (ruido de ±1 a 44,1 kHz) se
// reproducen tal cual: el ruido lento de Pd (lop~ 1 de noise~) tiene una desviación de ~0,0049
const PD_SLOW = 0.0049;
const FIRE_BANDS = [['hp', 1000, 0.707], ['bp', 1200, 0.6], ['bp', 2600, 0.4], ['bp', 600, 0.2]];
function fire(P, N, sr, r) {
  const L = new Float32Array(N), R = new Float32Array(N);
  const block = Math.round(1024 * sr / 44100); // el env~ de Pd: un valor cada 1024 muestras
  let crackles = 0;
  for (let g = 0; g < P.gens; g++) {
    const out = new Float32Array(N);
    // CHASQUIDOS: cada bloque en el que el ruido lento cae en la franja del umbral (1 dB), uno
    const slow = slowNoise(N, sr, 1, r);
    for (let b = 0; b < N; b += block) {
      const x = Math.abs(slow[b]);
      if (x < P.thr || x > P.thr * 1.122) continue;
      const T = Math.max(0.001, r.next() * 0.029);                       // caída: 0–29 ms
      const f0 = Math.min(15000, 1500 + 500 * T * 1000);                 // y su banda
      const bq = new Biquad().set('bp', f0, 1, sr);
      const n = Math.floor((T + 0.004) * sr);
      for (let i = 0; i < n; i++) {
        const u = i / (T * sr), e = u < 1 ? (1 - u) * (1 - u) : 0;
        out[(b + i) % N] += 0.2 * bq.tick(e * (r.next() * 2 - 1));
      }
      crackles++;
    }
    // SISEO: por encima de 1 kHz, a golpes (la cuarta potencia de un ruido lento)
    const [h] = shapedNoise2(N, sr, (f) => hp2(f, 1000), r);
    const m = slowNoise(N, sr, 1, r);
    for (let i = 0; i < N; i++) out[i] += 0.3 * h[i] * 0.577 * 600 * Math.pow(10 * PD_SLOW * m[i], 4);
    // LAMIDO: el ruido por 30 Hz (Q 5), muy arriba y recortado (el temblor grave de la llama)
    const [w] = shapedNoise2(N, sr, (f) => bp(f, 30, 5) * hp2(f, 25) * hp2(f, 25), r);
    const lapRms = 0.577 * Math.sqrt((Math.PI / 2 * 30 / 5) / 22050) * 100; // (lo que da en Pd: ~1,2)
    for (let i = 0; i < N; i++) out[i] += P.lap * 0.6 * Math.max(-0.9, Math.min(0.9, w[i] * lapRms));
    // la banda de este fogón y su sitio
    const [type, f, q] = FIRE_BANDS[g % FIRE_BANDS.length];
    filterChain(out, [[type, f, q]], sr);
    const [gl, gr] = panLR(-0.6 + 1.2 * (P.gens > 1 ? g / (P.gens - 1) : 0.5));
    addTo(L, out, 0.2 * gl); addTo(R, out, 0.2 * gr);
  }
  return { out: [L, R], info: { crackles: crackles / (N / sr) } };
}

// ───────────────────────── UNA CAPA (una cama grabada; pájaros y dron, aparte)
// Cada capa, con su RMS en −24 dBFS (ver normalize); lo crujiente a sucesos sueltos (vinilo, fuego), con
// tope de pico y sin aplastar nada
export function renderLayer(kind, P, N, seed, sr = ATMOS_SR) {
  const r = new Rng(seed >>> 0);
  let res;
  switch (kind) {
    case 'vinilo': res = vinyl(P, N, sr, r); break;
    case 'fuego': res = fire(P, N, sr, r); break;
    case 'lluvia': res = { out: rain(P, N, sr, r) }; break;
    case 'cinta': res = { out: tape(P, N, sr, r) }; break;
    case 'sala': res = { out: room(P, N, sr, r) }; break;
    case 'viento': { const w = wind(P, N, sr, r); res = { out: w.out, info: { speed: w.speed } }; break; }
    case 'ciudad': res = { out: city(P, N, sr, r) }; break;
    default: return { out: null, info: {} };
  }
  return { out: normalize(res.out, kind === 'vinilo' || kind === 'fuego'), info: res.info ?? {} };
}

// LLUVIA [FA, VD]: un lavado de muchas gotas pequeñas (de 1000/s a 10000/s según la intensidad), unas
// gotas cercanas que se distinguen y, en un charco, burbujas de Minnaert que suben. La superficie da
// el color (filtros de Farnell)
function rain(P, N, sr, r) {
  const L = new Float32Array(N), R = new Float32Array(N);
  const water = P.surface === 'charco';
  // una burbuja [VD]: radio en m; devuelve muestras escritas
  const bubble = (k0, rad, a, xi, gl, gr) => {
    const f0 = 3 / rad, d = 0.13 / rad + 0.0072 * Math.pow(rad, -1.5);
    const n = Math.min(Math.floor(6.9 / d * sr), sr);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += TAU * f0 * (1 + xi * d * t) / sr;
      if (ph > TAU) ph -= TAU;
      const x = a * Math.sin(ph) * Math.exp(-d * t);
      const k = (k0 + i) % N;
      L[k] += x * gl; R[k] += x * gr;
    }
  };
  // un impacto [FA]: un pulso parabólico corto (más corto = más agudo)
  const impact = (k0, len, a, gl, gr) => {
    for (let i = 0; i < len; i++) {
      const u = (i + 0.5) / len, x = a * (1 - 4 * (u - 0.5) ** 2);
      const k = (k0 + i) % N;
      L[k] += x * gl; R[k] += x * gr;
    }
  };
  // el lavado
  const rate = 1000 * Math.pow(10, P.inten);
  for (let t = r.next() * sr / rate; t < N; t += -Math.log(1 - r.next()) * sr / rate) {
    const [gl, gr] = panLR(r.float(-1, 1));
    const k0 = Math.floor(t);
    if (water && r.next() < 0.5) {
      // radios del lavado: 0,2–2 mm, más los pequeños (1/r); a = D·r^1,5, D = rnd^10 [VD]
      const rad = Math.exp(r.float(Math.log(0.2e-3), Math.log(2e-3)));
      const D = Math.pow(r.next(), 10);
      bubble(k0, rad, 0.3 * D * Math.pow(rad / 1e-3, 1.5), D > 0.5 ? 0.1 : 0, gl, gr);
    } else impact(k0, Math.max(2, Math.round(r.float(0.1, 0.6) * sr / 1000)), logn(r, -1.2, 0.9) * 0.12, gl, gr);
  }
  // las cercanas: más fuertes; en el charco, burbujas de 2–7 mm (las que suenan a «gota») que suben
  const near = [new Float32Array(N), new Float32Array(N)];
  for (let t = r.next() * sr / P.near; t < N; t += -Math.log(1 - r.next()) * sr / P.near) {
    const [gl, gr] = panLR(r.float(-0.8, 0.8));
    const k0 = Math.floor(t);
    const a = logn(r, -0.3, 0.6);
    if (water) {
      // (se escriben en la cama con el lavado: las dos cosas pasan por el mismo filtro de superficie)
      bubble(k0, r.float(2e-3, 7e-3), a * 0.5, 0.1, gl, gr);
      impact(k0, Math.round(r.float(0.2, 0.5) * sr / 1000), a * 0.6, gl, gr);
    } else {
      // el golpe en la superficie: un pulso y la resonancia de lo que golpea (hoja, chapa, tierra)
      const [f0, dmp] = P.surface === 'hojas' ? [r.float(1500, 4000), 280] : P.surface === 'tejado' ? [r.float(600, 1500), 150] : [r.float(300, 800), 220];
      const n = Math.floor(6.9 / dmp * sr);
      for (let i = 0; i < n; i++) {
        const tt = i / sr, x = a * 0.4 * Math.sin(TAU * f0 * tt) * Math.exp(-dmp * tt);
        const k = (k0 + i) % N;
        near[0][k] += x * gl; near[1][k] += x * gr;
      }
      impact(k0, Math.round(r.float(0.15, 0.5) * sr / 1000), a * 0.8, gl, gr);
    }
  }
  // el color de la superficie [FA]: hojas = 2 pasos altos 500 + paso bajo 4 kHz; tejado = paso alto
  // 900; tierra = paso alto 900 y apagada (paso bajo 5 kHz); charco = paso alto 300 (las burbujas graves)
  const F = { hojas: [['hp', 500], ['hp', 500], ['lp', 4000]], tejado: [['hp', 900], ['lp', 9000]], tierra: [['hp', 900], ['lp', 5000]], charco: [['hp', 300], ['lp', 10000]] }[P.surface];
  for (const a of [L, R]) filterChain(a, F, sr);
  addTo(L, near[0]); addTo(R, near[1]);
  // y el siseo de la lluvia ruidosa [FA]: ruido por encima de 2 kHz, más con más intensidad
  const [n1, n2] = shapedNoise2(N, sr, (f) => hp2(f, 2000) * lp2(f, 9000), r);
  const hiss = 0.25 * rms(L) * (0.3 + P.inten);
  addTo(L, n1, hiss); addTo(R, n2, hiss);
  return [L, R];
}
// una cadena de biquads fijos, dos vueltas (bucle sin costura)
function filterChain(a, F, sr) {
  const fs = F.map(([type, f, q]) => new Biquad().set(type, f, q ?? 0.707, sr));
  const out = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < a.length; i++) {
    let x = a[i];
    for (const b of fs) x = b.tick(x);
    if (pass) out[i] = x;
  }
  a.set(out);
}

// VIENTO [FA, práctica 18]: la velocidad (un seno lento de 0,1 Hz + RÁFAGAS + TURBONADAS) mueve el
// cuerpo (ruido por un paso banda de 800 Hz), el aullido (resonante de Q 60 en 600–1000 Hz) y las hojas
function wind(P, N, sr, r) {
  const T = N / sr;
  const k0 = Math.max(1, Math.round(0.1 * T)), ph0 = r.next() * TAU; // ~0,1 Hz, entero en el bucle
  const gust = slowNoise(N, sr, 0.5, r), squall = slowNoise(N, sr, 3, r), leafS = slowNoise(N, sr, 0.07, r);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const slow = 0.25 * (1 + Math.sin(TAU * k0 * i / N + ph0));
    const s = P.speed * (0.55 + 0.9 * slow) + 0.18 * P.gust * gust[i] + 0.12 * P.gust * Math.max(0, squall[i] - 0.4) * 8 / 3;
    speed[i] = Math.min(1, Math.max(0, s));
  }
  const L = new Float32Array(N), R = new Float32Array(N);
  // el cuerpo: ruido en banda (800 Hz, Q 1) × (velocidad + 0,2) [FA wind1]
  const [b1, b2] = shapedNoise2(N, sr, (f) => bp(f, 800, 1), r);
  for (let i = 0; i < N; i++) { const g = 0.3 * (speed[i] + 0.2); L[i] += b1[i] * g; R[i] += b2[i] * g; }
  // el aullido: dos filtros resonantes que siguen a la velocidad con retraso (0,1 y 1 s) [FA wind2]
  if (P.howl) {
    const [w1, w2] = shapedNoise2(N, sr, () => 1, r);
    [[0.1, -0.44, 2, w1], [1, 0.28, 1.2, w2]].forEach(([dl, pan, gain, src]) => {
      const f = new Biquad(), d = Math.round(dl * sr), [gl, gr] = panLR(pan);
      const out = new Float32Array(N);
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
        const sp = speed[(i - d + N) % N];
        if (i % 32 === 0) f.set('bp', 600 + 400 * sp, 60, sr);
        const y = f.tick(src[i]) * gain * Math.max(0, sp - 0.12) ** 2;
        if (pass) out[i] = y;
      }
      scaleTo(out, 0.18 * rms(b1));
      addTo(L, out, gl * 1.4); addTo(R, out, gr * 1.4);
    });
  }
  // las hojas: ruido de 200 Hz a 4 kHz, con la velocidad lenta (0,07 Hz) por encima de un umbral, y
  // un aleteo rápido [FA wind4]
  if (P.leaves) {
    const [l1, l2] = shapedNoise2(N, sr, (f) => hp2(f, 200) * lp2(f, 4000), r);
    const flutter = slowNoise(N, sr, 18, r);
    const [gl, gr] = panLR(0.42);
    for (let i = 0; i < N; i++) {
      const g = Math.max(0, 0.4 * (speed[i] + 0.3 + 0.3 * leafS[i]) - 0.2) * (0.6 + 0.4 * Math.abs(flutter[i]));
      L[i] += l1[i] * g * gl * 0.5; R[i] += l2[i] * g * gr * 0.5;
    }
  }
  return { out: [L, R], speed };
}

// CIUDAD lejana [TR, ISO, MK]: el espectro del tráfico, sin la ponderación A, menos lo que se come el
// aire en `dist` metros y lo que tapan los edificios; y oleadas lentas (los coches que pasan, lejos)
const TR_F = [100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000];
const TR_DB = [-20, -20, -18, -16, -15, -14, -13, -12, -11, -9, -8, -9, -10, -11, -13, -15, -16, -18];
// ponderación A (IEC 61672), dB
export function aWeight(f) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * Math.log10(ra) + 2;
}
export function cityDb(f, dist) {
  // nivel por tercio de octava, sin la A. Por debajo de 100 Hz la tabla sigue cayendo con la A (−10 dB/oct
  // ponderado): sin ponderar queda casi plano, ~7 dB sobre 1 kHz (el motor y la rodadura, en grave)
  const band = bandDb(f, TR_F, TR_DB, -10, -6) - aWeight(f);
  const perHz = band - 10 * Math.log10(0.2316 * f);
  const screen = f > 400 ? -3 * Math.log2(f / 400) : 0;     // edificios en medio (~3 dB/oct) [MK]
  return perHz - airAbsorption(f) * dist + screen;
}
function city(P, N, sr, r) {
  const [a, b] = shapedNoise2(N, sr, (f) => db(cityDb(f, P.dist)) * hp2(f, 28), r);
  const [L, R] = correlate(a, b, 0.6);
  const sw = slowNoise(N, sr, 0.08, r);
  for (let i = 0; i < N; i++) { const g = db(4 * P.swell * sw[i]); L[i] *= g; R[i] *= g; }
  return [L, R];
}

// ───────────────────────── PÁJAROS [BD]
// un canto de una especie (mono): su frase con variaciones (`v` = qué variante), lejos (`dist` m: más
// bajo y sin agudos por el aire, ISO 9613-1)
export function renderSong(sp, v, sr = ATMOS_SR) {
  const r = new Rng((v * 2654435761) >>> 0);
  const fmul = r.float(0.97, 1.03), tmul = r.float(0.9, 1.1);
  const drop = r.int(0, Math.min(2, sp.phrase.length - 1));
  const notes = sp.phrase.slice(0, sp.phrase.length - drop);
  let len = 0.05;
  for (const n of notes) len += n.rep * (sp.syl[n.s].dur * tmul + n.gap);
  const out = new Float32Array(Math.ceil((len * 1.2 + 0.05) * sr)); // (holgura: duraciones y huecos varían ±15 %)
  let t = 0.02;
  for (const n of notes) {
    const S = sp.syl[n.s];
    for (let k = 0; k < n.rep; k++) {
      const dur = S.dur * tmul * r.float(0.95, 1.05), k0 = Math.floor(t * sr), m = Math.floor(dur * sr);
      let ph = 0, ph2 = 0;
      const a = r.float(0.75, 1), h2 = db(S.h2);
      for (let i = 0; i < m; i++) {
        const u = i / m;
        const c = S.curve === 'up' ? u * u : S.curve === 'down' ? 1 - (1 - u) ** 2 : S.curve === 'arch' ? Math.sin(Math.PI * u) : u;
        let f = (S.f1 + (S.f2 - S.f1) * c) * fmul;
        if (S.fm) f *= 1 + S.fm.depth * Math.sin(TAU * S.fm.hz * i / sr);
        ph += TAU * f / sr; ph2 += TAU * 2 * f / sr;
        const env = Math.pow(Math.sin(Math.PI * u), 0.7);
        out[k0 + i] += a * env * (Math.sin(ph) + h2 * Math.sin(ph2));
      }
      t += dur + n.gap * r.float(0.85, 1.15);
    }
  }
  // la distancia: el aire se come los agudos (un polo donde la absorción llega a 3 dB)
  let fc = 16000;
  for (let f = 1000; f < 16000; f *= 1.05) if (airAbsorption(f, 15, 70) * sp.dist > 3) { fc = f; break; }
  const lp = new OnePole().set(fc, sr);
  for (let i = 0; i < out.length; i++) out[i] = lp.tick(out[i]);
  let pk = 0;
  for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  // pico: −12 dBFS a 20 m y 6 dB menos cada vez que se dobla la distancia
  const g = db(-12 - 20 * Math.log10(sp.dist / 20)) / Math.max(1e-9, pk);
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}
