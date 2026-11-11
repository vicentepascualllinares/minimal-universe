// mide el BAJO por compás: node bass.mjs <srcDir> [t] [universos]
// Notas, cuánto del compás suena, ligadas, deslizamientos, notas largas, pregunta-respuesta (el compás
// distinto del anterior e igual al de 2 antes) y repetición (igual al de 4 antes); por modo del bajo
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const src = path.resolve(process.argv[2]);
const T = +(process.argv[3] ?? 1), NS = +(process.argv[4] ?? 300);
const imp = (p) => import(pathToFileURL(path.join(src, p)).href);
const { makeGenerators } = await imp('music/generators.js');
const { rollStyle, styleColor, bassSweep } = await imp('music/styles.js');
const { shapeComplexity, randomComplexity, randomOsc } = await imp('music/complexity.js');
const { mapEmotion, degreeToSemis } = await imp('music/emotion.js');
// en Hz y ms: 125 BPM, tónica del kick E1..A1 (midi 28–33, como el motor) y modo eólico
const SD = 60 / 125 / 4, AEOL = { steps: [0, 2, 3, 5, 7, 8, 10] };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const HZ = { notes: [], durs: [], peaks: [] };
const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
const { Rng, lerp } = await imp('core/rng.js');
const BARS = 64;
const by = {};
for (let n = 0; n < NS; n++) {
  const seed = (n * 2654435761 + 12345) >>> 0;
  const S = rollStyle(seed, T);
  const G = makeGenerators(seed, S);
  const r = new Rng(seed ^ 0x9e3779b9);
  const range = (a, b, R) => (S.t && R ? r.float(lerp(a, R[0], S.t), lerp(b, R[1], S.t)) : r.float(a, b));
  const v = range(-0.8, 0.8, S.v), a = range(-0.7, 0.7, S.a);
  const cxv = { ...randomComplexity(r, S), global: 0.8 };
  randomOsc(r, cxv, S);
  const e0 = styleColor(mapEmotion(v, a, 0), S.t ? S.color : null);
  const key = S.t ? S.bassMode : 'normal';
  const rootHz = hz(28 + (n % 6));
  const A = (by[key] ??= { lv: {}, u: 0, bars: 0, notes: 0, sound: 0, lenMul: 0, tie: 0, gl: 0, hold: 0, pitches: 0, ans: 0, rep: 0, sweep: 0 });
  A.u++;
  const sigs = [];
  let sMin = 0, sMax = 0;
  for (let b = 0; b < BARS; b++) {
    const cx = shapeComplexity(cxv, S);
    if (b > 0 && b % 8 === 0 && G.rng.chance(cx.bass.gen.mutation * 0.7)) G.bass.mutate();
    const st = G.bass.bar(b, 0.75, { ...e0, gen: cx.bass.gen, cx: cx.bass.cx });
    const pit = new Set();
    const lvl = (A.lv[cx.bass.cx.bassPitches] ??= { j: 0, rich: 0, iv: {} });
    let prevDeg = null;
    const jump = (dg) => { if (prevDeg !== null && dg !== prevDeg) { const iv = dg - prevDeg; lvl.j++; lvl.iv[iv] = (lvl.iv[iv] || 0) + 1; if (Math.abs(iv) % 7 !== 0) lvl.rich++; } prevDeg = dg; };
    for (const ev of st) {
      if (!ev) continue;
      A.notes++;
      A.sound += Math.min(ev.len, 16) * (ev.tie ? 1 : e0.bass.lenMul);
      if (ev.tie) A.tie++;
      if (ev.gl) A.gl += ev.gl.length;
      if (ev.tie && ev.len >= 4 && !ev.gl) A.hold++;
      pit.add(ev.deg); jump(ev.deg);
      const F = G.bass.feel;
      let fq = rootHz * Math.pow(2, (degreeToSemis(ev.deg, AEOL) + 12) / 12);
      if (F?.range && !(ev.oct && fq <= F.octaveMax)) { while (fq > F.range[1]) fq /= 2; while (fq < F.range[0]) fq *= 2; }
      HZ.notes.push(fq);
      HZ.durs.push(1000 * (ev.tie ? ev.len * SD - 0.012 : Math.max(SD * 0.55, ev.len * SD * e0.bass.lenMul - 0.01)));
      const oct = G.bass.feel && bassSweep ? bassSweep(G.bass.feel, b) : 0;
      // el pico del filtro de la nota y, si hay, el paso bajo fijo detrás (lo que de verdad pasa)
      HZ.peaks.push(Math.min(16000, e0.bass.cutoff * Math.pow(2, oct) * (1 + e0.bass.env * Math.pow(2, oct * (F?.range ? 0.5 : 0)) * ev.vel), F?.post ?? 16000));
      ev.gl?.forEach((g) => { pit.add(g.deg); jump(g.deg); });
    }
    A.pitches += pit.size;
    const sig = st.map((ev) => (ev ? `${ev.deg}.${ev.len}.${ev.gl?.map((g) => g.o + ':' + g.deg).join(',') ?? ''}` : '')).join('|');
    if (b >= 2 && sig !== sigs[b - 1] && sig === sigs[b - 2]) A.ans++;
    if (b >= 4 && sig === sigs[b - 4]) A.rep++;
    sigs.push(sig);
    if (G.bass.feel) for (let s = 0; s < 16; s += 4) { const o = bassSweep(G.bass.feel, b + s / 16); sMin = Math.min(sMin, o); sMax = Math.max(sMax, o); }
    A.bars++;
  }
  A.sweep += sMax - sMin;
}
const f = (x) => +x.toFixed(2);
for (const [k, A] of Object.entries(by)) {
  console.log(k.padEnd(7), JSON.stringify({
    universos: A.u, 'notas/compás': f(A.notes / A.bars), 'suena % del compás': f((100 * A.sound) / (16 * A.bars)),
    'ligadas %': f((100 * A.tie) / A.notes), 'deslizamientos/compás': f(A.gl / A.bars), 'largas/compás': f(A.hold / A.bars),
    'alturas/compás': f(A.pitches / A.bars), 'respuesta % (≠1 antes, =2 antes)': f((100 * A.ans) / (A.bars - 2 * A.u)),
    '= 4 antes %': f((100 * A.rep) / (A.bars - 4 * A.u)), 'filtro lento (octavas en 64 c.)': f(A.sweep / A.u),
  }));
  // por nivel de alturas de la complejidad (root = baja, few = media, all = alta): los SALTOS entre
  // notas seguidas, en grados (7 = octava); «no octava» = cualquier salto que no sea la misma nota
  // en otra octava
  for (const [l, L] of Object.entries(A.lv)) {
    const top = Object.entries(L.iv).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([iv, n]) => `${iv}:${Math.round((100 * n) / L.j)}%`).join(' ');
    console.log('   complejidad', l.padEnd(4), `saltos que no son octava: ${f((100 * L.rich) / Math.max(1, L.j))} %`, '· más usados (grados):', top);
  }
}

const P = (a) => [0.05, 0.5, 0.95].map((p) => Math.round(pct(a, p)));
console.log('TODOS', JSON.stringify({
  'nota Hz p5·p50·p95': P(HZ.notes), 'notas > 150 Hz %': f((100 * HZ.notes.filter((x) => x > 150).length) / HZ.notes.length),
  'duración ms p5·p50·p95': P(HZ.durs), 'notas > 600 ms %': f((100 * HZ.durs.filter((x) => x > 600).length) / HZ.durs.length),
  'pico del filtro Hz p5·p50·p95': P(HZ.peaks), 'picos > 1 kHz %': f((100 * HZ.peaks.filter((x) => x > 1000).length) / HZ.peaks.length),
}));
