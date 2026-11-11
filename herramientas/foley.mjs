import { pathToFileURL } from 'node:url';
import path from 'node:path';
const src = path.resolve(process.argv[2]); const T = +(process.argv[3] ?? 1);
const imp = (p) => import(pathToFileURL(path.join(src, p)).href);
const { makeGenerators } = await imp('music/generators.js');
const { rollStyle, styleColor } = await imp('music/styles.js');
const { shapeComplexity, randomComplexity, randomOsc } = await imp('music/complexity.js');
const { randomKit } = await imp('music/kit.js');
const { mapEmotion } = await imp('music/emotion.js');
const { foleySound } = await imp('music/sounds.js');
const { Rng, lerp } = await imp('core/rng.js');
const BAR = 60 / 125 * 4, NS = 300, BARS = 32;
let hits = 0, cover = 0, barsWith = 0, durs = [], muted = 0, gapMax = 0;
for (let n = 0; n < NS; n++) {
  const seed = (n * 2654435761 + 12345) >>> 0;
  const S = rollStyle(seed, T); const G = makeGenerators(seed, S);
  const r = new Rng(seed ^ 0x9e3779b9);
  const range = (a, b, R) => (S.t && R ? r.float(lerp(a, R[0], S.t), lerp(b, R[1], S.t)) : r.float(a, b));
  const v = range(-0.8, 0.8, S.v), a = range(-0.7, 0.7, S.a);
  const cxv = { ...randomComplexity(r, S), global: 0.8 }; randomOsc(r, cxv, S); const kit = randomKit(r, S);
  const e0 = styleColor(mapEmotion(v, a, 0), S.t ? S.color : null);
  if ((S.mutes || []).includes('foley')) { muted++; continue; }
  const cx = shapeComplexity(cxv, S); const e = { ...e0, gen: cx.perc.gen, cx: cx.perc.cx, kit: kit.foley };
  const perc = G.perc.bar(0, 1, { ...e, kit: kit.perc }, 0);
  for (let b = 0; b < BARS; b++) {
    const st = G.foley.bar(b, 0.8, e, b * 16, perc);
    let any = false;
    for (const x of st) if (x) for (const ev of x) { const d = foleySound(e0, G.foley.lanes[ev.n].sound); const dur = d.len ?? d.p?.len ?? d.g?.dur ?? JSON.stringify(Object.keys(d)); durs.push(dur); hits++; cover += dur; any = true; }
    if (any) barsWith++;
  }
}
const k = NS - muted;
console.log({ t: T, 'universos con foley': k, 'golpes/compás': +(hits / (k * BARS)).toFixed(2), 'compases con foley %': +(100 * barsWith / (k * BARS)).toFixed(1), 'segundos de foley por compás (de 1,92)': +(cover / (k * BARS)).toFixed(2), 'duración media gesto s': +(cover / hits).toFixed(2), ejemplo: durs[0] });
