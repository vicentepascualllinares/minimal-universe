// mide percusión / foley / hats por compás: node measure.mjs <srcDir> [t] [scene] [seeds]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const src = path.resolve(process.argv[2]);
const T = +(process.argv[3] ?? 1), SCENE = process.argv[4] ?? 'groove:1', NS = +(process.argv[5] ?? 300);
const imp = (p) => import(pathToFileURL(path.join(src, p)).href);
const { makeGenerators } = await imp('music/generators.js');
const { rollStyle, styleColor, sValue: sV } = await imp('music/styles.js');const sValue = sV ?? ((S,k,v)=>v);
const { shapeComplexity, shareDensity, randomComplexity, randomOsc } = await imp('music/complexity.js');
const { randomKit } = await imp('music/kit.js');
const { mapEmotion } = await imp('music/emotion.js');
const { Rng, lerp } = await imp('core/rng.js');
const { mixOf, INSTRUMENTS } = await imp('music/arrangement.js');
const { MIX_PRESETS, DEFAULT_MIX } = await imp('audio/mix.js');
const [sc, ver] = SCENE.split(':');
const pres = mixOf(sc, +ver);
const BARS = 64;
const acc = { perc: 0, foley: 0, hat: 0, lanes: 0, percE: 0, foleyE: 0, hatE: 0, kickE: 0, mutP: 0, repeat: 0, repN: 0, archs: {} };
for (let n = 0; n < NS; n++) {
  const seed = (n * 2654435761 + 12345) >>> 0;
  const sty = rollStyle(seed, T);
  const G = makeGenerators(seed, sty); if (process.env.P1) { G.perc.lanes.forEach(l=>l.prob=1); G.foley.lanes.forEach(l=>l.prob=1); } if (process.env.NOFX) { G.perc.mutate=()=>{}; G.foley.mutate=()=>{}; }
  const r = new Rng(seed ^ 0x9e3779b9);
  const S = sty;
  const range = (a, b, R) => (S.t && R ? r.float(lerp(a, R[0], S.t), lerp(b, R[1], S.t)) : r.float(a, b));
  const v = range(-0.8, 0.8, S.v), a = range(-0.7, 0.7, S.a);
  const cxv = { ...randomComplexity(r, S), global: 0.8 };
  randomOsc(r, cxv, S);
  const kit = randomKit(r, S);
  const e0 = styleColor(mapEmotion(v, a, 0), S.t ? S.color : null);
  const mutes = S.mutes ?? [];
  const P = MIX_PRESETS[DEFAULT_MIX].db;
  const db = (k) => (S.t ? P[k] + (S.mix[k] - P[k]) * S.t : P[k]);
  const g2 = (k) => (mutes.includes(k) ? 0 : 10 ** (db(k) / 10));
  if (S.t) acc.archs[S.arch] = (acc.archs[S.arch] || 0) + 1;
  let abs = 0, mut = 0;
  const sigs = [];
  for (let b = 0; b < BARS; b++, abs += 16) {
    const cx = shapeComplexity(cxv, S);
    const muP = cx.perc.gen.mutation, rr = G.rng;
    const ev = S.t ? S.k['mut.every'] ?? 4 : 4; if (b > 0 && b % ev === 0) { if (rr.chance(muP*sValue(S,'mut.perc',1))) { G.perc.mutate(1); mut++; } if (rr.chance(muP * 0.5*sValue(S,'mut.hat',1))) G.hat.mutate(); if (rr.chance(muP * 0.6*sValue(S,'mut.foley',1))) { G.foley.mutate(1); mut++; } }
    if (b > 0 && b % 8 === 0) { if (rr.chance(cx.bass.gen.mutation * 0.7)) G.bass.mutate(); if (rr.chance(muP * 0.35)) G.clap.mutate(); if (rr.chance(muP * 0.4)) G.ohat.mutate(); }
    if (b > 0 && b % 32 === 0 && cx.eff.perc > 0.3 && !(S.t && !rr.chance(sValue(S,'mut.force',1)))) { G.perc.mutate(2); mut++; }
    const dens = {}, prog = {};
    for (const k of INSTRUMENTS) { dens[k] = pres[k]; prog[k] = pres[k] > 0 ? 1 : 0; }
    const sh = shareDensity(dens, prog, cx.budget);
    const e = { ...e0, gen: cx.perc.gen, cx: cx.perc.cx };
    const eH = { ...e, kit: kit.hat };
    const out = { hat: G.hat.bar(b, sh.hat, eH), ohat: G.ohat.bar(b, sh.ohat, eH), perc: G.perc.bar(b, sh.perc, { ...e, kit: kit.perc }, abs) };
    out.foley = G.foley.bar(b, sh.foley, { ...e, kit: kit.foley }, abs, prog.perc > 0 ? out.perc : null);
    G.hat.kindsBar({ hat: sh.hat, ohat: sh.ohat }, eH, out);
    const cnt = (st, k) => { let c = 0, en = 0; if (!pres[k]) return [0, 0]; for (const x of st) if (x) for (const ev of [].concat(x)) { c++; en += ev.vel ** 2; } return [c, en]; };
    const [pc, pe] = cnt(out.perc, 'perc'), [fc, fe] = cnt(out.foley, 'foley');
    const [hc, he] = cnt(out.hat, 'hat'), [oc, oe] = cnt(out.ohat, 'ohat');
    acc.perc += pc; acc.foley += fc; acc.hat += hc + oc;
    acc.percE += pe * g2('perc'); acc.foleyE += fe * g2('foley'); acc.hatE += he * g2('hat') + oe * g2('ohat');
    acc.kickE += pres.kick ? (1 + 3 * 0.9) * g2('kick') : 0;
    const lanes = new Set(); out.perc.forEach((x) => x && x.forEach((ev) => lanes.add(ev.n))); acc.lanes += lanes.size;
    // repetición: el compás de perc+foley igual al de 4 compases antes (mismo paso, mismo carril)
    const sig = (process.env.ONLY==='perc'?[out.perc]:process.env.ONLY==='foley'?[out.foley]:[out.perc, out.foley]).map((st) => st.map((x) => (x ? x.map((ev) => ev.n).sort().join('') : '')).join('|')).join('/');
    const L=+(process.env.LAG||4); if (b >= L) { acc.repN++; if (sig === sigs[b - L]) acc.repeat++; }
    sigs.push(sig);
  }
  acc.mutP += mut;
}
const nb = NS * BARS, f = (x) => +(x).toFixed(2);
const toDb = (x) => f(10 * Math.log10(x / nb));
console.log(JSON.stringify({
  t: T, scene: SCENE,
  'perc golpes/compás': f(acc.perc / nb), 'foley golpes/compás': f(acc.foley / nb), 'hats golpes/compás': f(acc.hat / nb),
  'carriles perc sonando': f(acc.lanes / nb),
  'energía perc dB': toDb(acc.percE), 'energía foley dB': toDb(acc.foleyE), 'energía hats dB': toDb(acc.hatE), 'energía kick dB': toDb(acc.kickE),
  'mutaciones perc+foley /64 compases': f(acc.mutP / NS), 'compases = al de 4 antes %': f((100 * acc.repeat) / acc.repN),
  archs: acc.archs,
}));
