// CRUJIDO Y RUIDO (antes TEXTURA y AMBIENTE): medir lo que sale de la síntesis (src/audio/atmosSynth.js) contra los datos de
// los que sale cada sonido. Sin navegador: graba las camas y los cantos como lo haría el Worker.
//
//   node atmos.mjs ../src            un resumen de 40 universos ROMINIMAL y las comprobaciones
//   node atmos.mjs ../src --wav <dir>  además, escribe unos .wav para escucharlos fuera de la app
//
// Qué mira (y contra qué):
//   VINILO   clics por segundo (de ~3 a ~90/s según el desgaste [GA]) y que entre clic y clic haya silencio
//   FUEGO    chasquidos por segundo, su banda (1,5–16 kHz) y dónde está la energía [FF]
//   CINTA    la pendiente por encima del codo de la ecualización: +6 dB/octava [CAS]
//   SALA     el nivel por octava contra la curva NC del universo (la forma, relativa a 1 kHz) [NC]
//   CIUDAD   el nivel por octava contra lo previsto (tráfico sin A − aire − edificios) [TR, ISO]
//   LLUVIA   reparto de energía (graves / medios / agudos) según la superficie [FA]
//   VIENTO   cuánto se mueve la velocidad y a qué ritmo (seno de ~0,1 Hz + ráfagas) [FA]
//   PÁJAROS  duración de los cantos y la frecuencia de cada sílaba (2–7 kHz) [BD]
//   BUCLE    que no haya costura: el salto del final al principio, como uno cualquiera de dentro
//   CAPAS    cuántas capas sale (1–4) y de qué; lo que cuesta grabar cada cosa (ms) y su RMS y pico
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const src = path.resolve(process.argv[2] ?? '../src');
const flag = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const imp = (p) => import(pathToFileURL(path.join(src, p)).href);
const { rollStyle } = await imp('music/styles.js');
const { rollAtmos, describeAtmos } = await imp('music/atmos.js');
const S = await imp('audio/atmosSynth.js');
const { ATMOS_SR: SR } = S;

const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
const pk = (a) => { let p = 0; for (const x of a) p = Math.max(p, Math.abs(x)); return p; };

// nivel por octava (dB, relativo) de una señal periódica de N muestras
function octaves(a, centers) {
  const N = a.length, re = Float64Array.from(a), im = new Float64Array(N);
  S.fft(re, im);
  return centers.map((fc) => {
    const lo = fc / Math.SQRT2, hi = fc * Math.SQRT2;
    let s = 0;
    for (let k = Math.ceil(lo * N / SR); k <= Math.min(N / 2 - 1, Math.floor(hi * N / SR)); k++) s += re[k] * re[k] + im[k] * im[k];
    return 10 * Math.log10(s + 1e-30);
  });
}
const rel = (arr, i) => arr.map((x) => x - arr[i]);
// el salto en la costura del bucle frente a los saltos de dentro: el percentil en el que cae (50 % = un
// salto cualquiera; una costura se notaría como un salto de los más grandes, ~100 %)
function seam(a) {
  const j = Math.abs(a[0] - a[a.length - 1]);
  let below = 0;
  for (let i = 1; i < a.length; i++) if (Math.abs(a[i] - a[i - 1]) < j) below++;
  return 100 * below / (a.length - 1);
}

function wav(file, chans, sr = SR) {
  const n = chans[0].length, c = chans.length, b = Buffer.alloc(44 + n * c * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * c * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(c, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * c * 2, 28); b.writeUInt16LE(c * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * c * 2, 40);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(chans[k][i] * 32767))), 44 + (i * c + k) * 2);
  fs.writeFileSync(file, b);
}

const N = 1 << 19;
const OCT = [63, 125, 250, 500, 1000, 2000, 4000, 8000];

// ── 1. comprobaciones de cada sonido, una a una
console.log('── COMPROBACIONES (contra los datos)');
{
  // VINILO (desde 2026-11-13, sin siseo): entre clic y clic, silencio. La mediana de |x| frente al pico
  // (con ruido de fondo quedaría a −40/−60 dB; sin él, mucho más abajo) y los clics por segundo
  for (const wear of [0.1, 0.8]) {
    const t0 = performance.now();
    const v = S.renderLayer('vinilo', { rpm: 100 / 3, wear, scratches: 0 }, N, 1);
    const a = Float32Array.from(v.out[0], Math.abs).sort();
    console.log(`VINILO desgaste ${wear}: ${f1(v.info.rate)} clics/s · mediana ${f1(dB(a[a.length >> 1]) - dB(a[a.length - 1]))} dB bajo el pico · el 10 % más bajo, ${f1(dB(a[a.length / 10 | 0]) - dB(a[a.length - 1]))} dB   (${Math.round(performance.now() - t0)} ms)`);
  }
}
{
  const v = S.renderLayer('cinta', { tau: 120e-6, lp: 14000 }, N, 2);
  const o = octaves(v.out[0], [2000, 4000, 8000]);
  const eq = (f) => 10 * Math.log10(1 + (2 * Math.PI * f * 120e-6) ** 2) - 10 * Math.log10(1 + (f / 14000) ** 4);
  console.log(`CINTA 120 µs: de 2 a 4 kHz ${f1(o[1] - o[0] - 3)} dB/oct, de 4 a 8 kHz ${f1(o[2] - o[1] - 3)} dB/oct (sin los +3 del ruido por octava) · la curva: ${f1(eq(4000) - eq(2000))} y ${f1(eq(8000) - eq(4000))} (tiende a +6 por encima del codo de 1326 Hz)`);
}
{
  for (const nc of [20, 35]) {
    const v = S.renderLayer('sala', { nc }, N, 3);
    const o = rel(octaves(v.out[0], OCT), 4), want = rel(S.ncCurve(nc), 4);
    console.log(`SALA NC-${nc}: medido ${o.map(f1).join(' ')}\n            curva  ${want.map(f1).join(' ')}`);
  }
}
{
  for (const dist of [400, 2000]) {
    const v = S.renderLayer('ciudad', { dist, swell: 0 }, N, 4);
    const o = rel(octaves(v.out[0], OCT), 2);
    const want = rel(OCT.map((f) => { let s = 0; for (let x = f / Math.SQRT2; x < f * Math.SQRT2; x += f / 200) s += Math.pow(10, S.cityDb(x, dist) / 10) * f / 200; return 10 * Math.log10(s); }), 2);
    console.log(`CIUDAD a ${dist} m (rel. 250 Hz): medido ${o.map(f1).join(' ')}\n                          previsto ${want.map(f1).join(' ')}`);
  }
  console.log(`  aire (ISO 9613-1, 15 °C, 70 %): ${[500, 1000, 2000, 4000, 8000].map((f) => `${f} Hz ${f1(S.airAbsorption(f) * 1000)} dB/km`).join(' · ')}`);
}
{
  for (const surface of ['hojas', 'tejado', 'charco', 'tierra']) {
    const t0 = performance.now();
    const v = S.renderLayer('lluvia', { inten: 0.5, surface, near: 6 }, N, 5);
    const o = octaves(v.out[0], OCT), tot = 10 * Math.log10(o.reduce((a, x) => a + 10 ** (x / 10), 0));
    const band = (a, b) => f1(10 * Math.log10(o.slice(a, b).reduce((s, x) => s + 10 ** (x / 10), 0)) - tot);
    console.log(`LLUVIA ${surface.padEnd(6)}: graves (63–250) ${band(0, 3)} dB · medios (500–2k) ${band(3, 6)} · agudos (4–8k) ${band(6, 8)}   (${Math.round(performance.now() - t0)} ms)`);
  }
}
{
  const v = S.renderLayer('viento', { speed: 0.5, gust: 0.8, howl: true, leaves: true }, N, 6);
  const sp = v.info.speed;
  let mn = 1, mx = 0, m = 0;
  for (const x of sp) { mn = Math.min(mn, x); mx = Math.max(mx, x); m += x; }
  m /= sp.length;
  const o = octaves(Float32Array.from(sp, (x) => x - m), []);
  // el ritmo de la velocidad: dónde está su energía
  const re = Float64Array.from(sp, (x) => x - m), im = new Float64Array(sp.length);
  S.fft(re, im);
  const e = (lo, hi) => { let s = 0; for (let k = Math.ceil(lo * N / SR); k <= hi * N / SR; k++) s += re[k] ** 2 + im[k] ** 2; return s; };
  const tot = e(0.01, 20);
  console.log(`VIENTO velocidad: media ${m.toFixed(2)}, de ${mn.toFixed(2)} a ${mx.toFixed(2)} · energía: < 0,2 Hz ${Math.round(100 * e(0.01, 0.2) / tot)} % · 0,2–1 Hz ${Math.round(100 * e(0.2, 1) / tot)} % · 1–5 Hz ${Math.round(100 * e(1, 5) / tot)} %`);
}
{
  for (const thr of [1.2, 0.4]) for (const gens of [2, 4]) {
    const t0 = performance.now();
    const v = S.renderLayer('fuego', { gens, thr, hiss: 0.3, lap: 0.6 }, N, 7);
    const o = octaves(v.out[0], OCT), tot = 10 * Math.log10(o.reduce((a, x) => a + 10 ** (x / 10), 0));
    const band = (a, b) => f1(10 * Math.log10(o.slice(a, b).reduce((s, x) => s + 10 ** (x / 10), 0)) - tot);
    console.log(`FUEGO umbral ${thr}, ${gens} fogones: ${f1(v.info.crackles)} chasquidos/s · graves (63–250) ${band(0, 3)} dB · medios (500–2k) ${band(3, 6)} · agudos (4–8k) ${band(6, 8)} · RMS/pico ${f1(dB(S.rms(v.out[0])))}/${f1(dB(pk(v.out[0])))} dBFS   (${Math.round(performance.now() - t0)} ms)`);
  }
}

// ── 2. cuarenta universos ROMINIMAL como nacerían
console.log('\n── 40 UNIVERSOS ROMINIMAL 100');
const out = flag('--wav');
if (out) fs.mkdirSync(out, { recursive: true });
const count = {}, nLayers = [0, 0, 0, 0, 0];
let worst = 0, tMax = 0, songs = 0, songLen = [], sylF = [], gated = 0;
// (lo mismo que atmosFx.js: largo de cada bucle y semilla de cada capa)
const LONG = { lluvia: true, viento: true, ciudad: true };
const lenOf = (k) => (LONG[k] ? N * 2 : N);
const layerSeed = (A, i) => (A.seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
for (let n = 0; n < 40; n++) {
  const seed = (n * 2654435761 + 777) >>> 0;
  const sty = rollStyle(seed, 1);
  const A = rollAtmos(seed, sty);
  nLayers[A.layers.length]++;
  const parts = [];
  let tU = 0;
  for (const [i, L] of A.layers.entries()) {
    count[L.kind] = (count[L.kind] || 0) + 1;
    if (L.gate) gated++;
    if (L.kind === 'pajaros') {
      for (const [j, sp] of L.P.species.entries()) {
        for (let v = 0; v < 3; v++) { const s = S.renderSong(sp, seed + j * 7 + v); songs++; songLen.push(s.length / SR); if (out && n < 6 && v === 0) wav(path.join(out, `${n}-pajaro-${j}.wav`), [s]); }
        for (const y of sp.syl) sylF.push(y.f1, y.f2);
      }
      parts.push(`${L.ch} pájaros`);
      continue;
    }
    if (L.kind === 'dron') { parts.push(`${L.ch} dron`); continue; }
    const t0 = performance.now();
    const R = S.renderLayer(L.kind, L.P, lenOf(L.kind), layerSeed(A, i));
    const ms = performance.now() - t0;
    tU += ms;
    worst = Math.max(worst, seam(R.out[0]));
    parts.push(`${L.ch} ${L.kind} ${f1(dB(S.rms(R.out[0])))}/${f1(dB(pk(R.out[0])))} dBFS ${Math.round(ms)} ms${L.gate ? ` (entra ${L.gate.on}/sale ${L.gate.off})` : ''}`);
    if (out && n < 6) wav(path.join(out, `${n}-${L.ch}-${L.kind}.wav`), R.out);
  }
  tMax = Math.max(tMax, tU);
  if (n < 12) console.log(`${String(seed).padStart(10)} ${sty.archLabel.padEnd(9)} ${describeAtmos(A)}\n             ${parts.join(' · ')}`);
}
console.log(`capas por universo: ${nLayers.slice(1).map((c, i) => `${i + 1}: ${c}`).join(' · ')} (de 40) · ${gated} capas que entran y salen`);
console.log(`sonidos: ${Object.entries(count).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`costura del bucle: la peor cae en el percentil ${worst.toFixed(0)} de los saltos de dentro (un salto cualquiera: sin costura)`);
console.log(`grabar todas las camas de un universo: hasta ${Math.round(tMax)} ms`);
if (songs) console.log(`pájaros: ${songs} cantos de ${f1(Math.min(...songLen))}–${f1(Math.max(...songLen))} s · sílabas de ${Math.round(Math.min(...sylF))} a ${Math.round(Math.max(...sylF))} Hz`);
if (out) console.log(`.wav en ${out}`);
