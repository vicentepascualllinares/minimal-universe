// mide el UNIVERSO PARECIDO (similar.js): node similar.mjs <srcDir> [universos]
// Para cada par (mantener SONIDO, mantener MÚSICA): cuánto del bajo y de la percusión suena igual que
// en el original (notas en los mismos pasos, 32 compases) y cuánto del sonido sigue igual (timbres
// de percusión, tipos de hat, modo del bajo, color). 100/100 tiene que dar exactamente el original
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const src = path.resolve(process.argv[2]);
const NS = +(process.argv[3] ?? 150);
const imp = (p) => import(pathToFileURL(path.join(src, p)).href);
const { makeGenerators } = await imp('music/generators.js');
const { rollStyle } = await imp('music/styles.js');
const { shapeComplexity } = await imp('music/complexity.js');
const { Rng } = await imp('core/rng.js');
const U = await imp('music/universe.js');
const { birthUniverse, blendUniverse } = await imp('music/similar.js');
const mixOf = () => null;
// un universo cargado (como Deck.loadUniverse): estilo + lo del estilo, generadores + su estado
const load = (u) => {
  const sty = u.style ? rollStyle(u.seed, u.style.t, u.style.name, u.style.purity) : rollStyle(u.seed, 0);
  U.applyStyleData(sty, u.styleData);
  return { sty, G: U.applyGenState(makeGenerators(u.seed, sty), u.gen) };
};
const bars = (u, n = 32) => {
  const { sty, G } = load(u);
  const cx = shapeComplexity({ ...u.cx, global: 0.8 }, sty);
  const out = [];
  for (let b = 0; b < n; b++) {
    const eB = { gen: cx.bass.gen, cx: cx.bass.cx }, eP = { gen: cx.perc.gen, cx: cx.perc.cx, kit: u.kit.perc };
    out.push({ bass: G.bass.bar(b, 0.75, eB).map((x) => (x ? x.deg : null)), perc: G.perc.bar(b, 0.7, eP, b * 16).map((x) => (x ? x.map((h) => h.n).join('') : null)) });
  }
  return out;
};
const same = (a, b, k) => { let eq = 0, n = 0; a.forEach((x, i) => x[k].forEach((v, s) => { if (v !== null || b[i][k][s] !== null) { n++; if (v === b[i][k][s]) eq++; } })); return n ? eq / n : 1; };
const sound = (A, X) => {
  const pa = A.gen.perc.lanes.map((l) => l.sound.timbre), px = X.gen.perc.lanes.map((l) => l.sound.timbre);
  const ha = A.gen.hat.kinds.map((k) => JSON.stringify(k.tone)), hx = X.gen.hat.kinds.map((k) => JSON.stringify(k.tone));
  return {
    perc: px.filter((t) => pa.includes(t)).length / px.length,
    hat: hx.filter((t, i) => t === ha[i]).length / hx.length,
    dColor: Math.abs(A.color.v - X.color.v) + Math.abs(A.color.a - X.color.a),
  };
};
const grid = process.env.CURVA ? [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0].map((k) => [1, k]) : [[1, 1], [1, 0.5], [0.5, 1], [1, 0], [0, 1], [0.5, 0.5], [0, 0]];
const r0 = new Rng(99);
const acc = Object.fromEntries(grid.map((g) => [g.join('/'), { bass: 0, perc: 0, sPerc: 0, sHat: 0, dColor: 0, exact: 0 }]));
for (let n = 0; n < NS; n++) {
  const seed = r0.int(0, 2e9);
  const A = birthUniverse(seed, { name: 'rominimal', t: 1, purity: 1 }, mixOf);
  const B = birthUniverse(r0.int(0, 2e9), A.style, mixOf);
  const bA = bars(A);
  for (const [ks, km] of grid) {
    const X = blendUniverse(A, B, ks, km, new Rng(seed ^ 0x3c6ef372));
    const bX = bars(X), S = sound(A, X), a = acc[`${ks}/${km}`];
    a.bass += same(bA, bX, 'bass'); a.perc += same(bA, bX, 'perc');
    a.sPerc += S.perc; a.sHat += S.hat; a.dColor += S.dColor;
    if (ks === 1 && km === 1) {
      const { G } = load(X);
      if (JSON.stringify(U.genState(G)) === JSON.stringify(A.gen) && JSON.stringify(X.styleData) === JSON.stringify(A.styleData)) a.exact++;
    }
  }
}
const f = (x) => Math.round((100 * x) / NS);
console.log('SONIDO/MÚSICA mantenidos · notas del bajo iguales · golpes de percusión iguales · timbres de percusión iguales · sonidos de hat iguales · distancia de color');
for (const [k, a] of Object.entries(acc)) console.log(k.padEnd(8), `bajo ${f(a.bass)} %`.padEnd(12), `perc ${f(a.perc)} %`.padEnd(12), `timbres perc ${f(a.sPerc)} %`.padEnd(18), `hats ${f(a.sHat)} %`.padEnd(11), `color ${(a.dColor / NS).toFixed(2)}`, k === '1/1' ? `· idéntico en ${a.exact}/${NS}` : '');
