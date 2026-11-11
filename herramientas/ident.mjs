// traza NORMAL de un src: node ident.mjs <srcDir> [seeds]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const src = path.resolve(process.argv[2]); const NS = +(process.argv[3] ?? 300);
const imp = (p) => import(pathToFileURL(path.join(src, p)).href);
const { makeGenerators } = await imp('music/generators.js');
const { rollStyle, NORMAL } = await imp('music/styles.js');
const { randomComplexity, randomOsc } = await imp('music/complexity.js');
const { randomKit } = await imp('music/kit.js');
const { mapEmotion } = await imp('music/emotion.js');
const T = await imp('music/transitions.js');
const SPC = await imp('music/space.js');
const { Rng } = await imp('core/rng.js');
const h = crypto.createHash('sha256'); let checks = 0;
const put = (x) => { h.update(JSON.stringify(x, (k, v) => (k === 'lane' ? undefined : v))); checks++; };
for (let n = 0; n < NS; n++) {
  const seed = (n * 2654435761 + 777) >>> 0;
  const sty = rollStyle(seed, 0);
  if (sty !== NORMAL) throw new Error('t=0 no es NORMAL');
  const G = makeGenerators(seed, sty);
  put([G.perc.lanes, G.foley.lanes, G.hat.w, G.hat.kinds, G.bass.home, G.harmony.voicing, G.harmony.prog]);
  const r = new Rng(seed ^ 0x9e3779b9);
  const cx = { ...randomComplexity(r, sty), global: 0.8 };
  put(cx); put(randomOsc(r, cx, sty)); put(randomKit(r, sty));
  if (T.makePalette) put(T.makePalette(seed, sty));
  if (SPC.makeSpace && !process.env.NOSPACE) put(SPC.makeSpace(seed, sty));
  const kit = { hat: { amt: 0.5, vary: 0.7 }, perc: { amt: 0.6, vary: 0.8 }, foley: { amt: 0.6, vary: 0.8 } };
  const e0 = mapEmotion(r.float(-0.8, 0.8), r.float(-0.7, 0.7), 0);
  for (let b = 0, abs = 0; b < 96; b++, abs += 16) {
    const rr = G.rng, muP = 0.35;
    if (b > 0 && b % 4 === 0) { if (rr.chance(muP)) G.perc.mutate(1); if (rr.chance(muP * 0.5)) G.hat.mutate(); if (rr.chance(muP * 0.6)) G.foley.mutate(1); }
    if (b > 0 && b % 8 === 0) { if (rr.chance(0.3)) G.bass.mutate(); if (rr.chance(muP * 0.35)) G.clap.mutate(); if (rr.chance(muP * 0.4)) G.ohat.mutate(); }
    if (b > 0 && b % 32 === 0) G.perc.mutate(2);
    if (b > 0 && b % 16 === 0 && rr.chance(0.3)) G.harmony.mutate();
    const c = { fast: 0.4, clapExtras: true, clapRolls: true, longRolls: false, ohatExtra: true, bassVariant: true, bassPitches: 'few', chordNotes: 3, chordGap: 3, progression: true, padStretch: 1, doubleGhost: true };
    const e = { ...e0, gen: { density: 0.8, mutation: 0.3, ghostKick: 0.4, fills: 0.6 }, cx: c };
    const eH = { ...e, kit: kit.hat };
    const out = { kick: G.kick.bar(b, 1, e), clap: G.clap.bar(b, 0.9, e), hat: G.hat.bar(b, 1, eH), ohat: G.ohat.bar(b, 0.75, eH), perc: G.perc.bar(b, 1, { ...e, kit: kit.perc }, abs) };
    out.foley = G.foley.bar(b, 0.8, { ...e, kit: kit.foley }, abs, out.perc);
    G.hat.kindsBar({ hat: 1, ohat: 0.75 }, eH, out);
    out.bass = G.bass.bar(b, 1, e); out.chord = G.harmony.chordBar(b, 0.8, e); out.pad = G.harmony.padBar(b, 0.8, e);
    put(out);
  }
}
console.log(checks, h.digest('hex'));
