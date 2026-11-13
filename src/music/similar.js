// UNIVERSO PARECIDO (2026-11-11): un universo nuevo que MANTIENE una parte del que suena.
//
// Dos cantidades (0..1): cuánto se MANTIENE el SONIDO y cuánto se mantiene la MÚSICA. Las dos a 1 =
// el mismo universo, exacto (tal como suena ahora, con lo mutado y lo tocado). Las dos a 0 = un
// universo nuevo del todo. Siempre con el ESTILO y la PUREZA del que suena: el otro universo, del que
// sale lo que cambia, se sortea con los mismos, y todo lo que se mezcla está dentro de lo que el
// estilo permite (cada pieza sale entera de uno o de otro, o es un punto entre dos valores válidos).
//
// Qué es cada cosa (las PIEZAS; cada una se queda con probabilidad = cuánto se mantiene, o viene del
// otro universo; lo continuo se interpola):
//   SONIDO   el COLOR (valencia y activación: el timbre de todos los sintes, interpolado), los rangos
//            de timbre de cada instrumento (los da el estilo con sus modos y su pureza), el MODO del
//            bajo (con su envolvente, paso bajo, altura al atacar, caídas, deslizamiento y filtro
//            lento) y el de los acordes, el sonido de cada tipo de hat, el TIMBRE de cada percusión y
//            de cada foley, el ESPACIO (delay, reverb y fondo con sus envíos), los sonidos de las
//            TRANSICIONES y la MEZCLA (faders y FX, interpolados en dB)
//   MÚSICA   el BAJO (cada paso del motivo y de su variante, la respuesta, la celda de alturas, la
//            frase, el remate, deslizamientos, ligados y la nota larga), los RITMOS de hats, open,
//            clap, percusión y foley (cada carril), la ALTURA de cada percusión (su micro-melodía),
//            la ARMONÍA, el GROOVE de cada instrumento, el salto del kick, los MUTE, los dados de cada
//            generador, y la COMPLEJIDAD, CANT · VAR (interpolados) y los OSCILADORES
// La estructura, los viajes y BPM, tónica y modo no cambian: son del intérprete.
//
// Trabaja con universos en el formato de archivo (universe.js): el que suena (captureUniverse) y uno
// recién nacido (birthUniverse). El resultado se carga como cualquier universo guardado; lo que del
// estilo ya no sale de la semilla va en `styleData`.

import { Rng, lerp } from '../core/rng.js';
import { rollStyle, COLOR_PARAMS } from './styles.js';
import { makeGenerators } from './generators.js';
import { makeSpace } from './space.js';
import { makePalette } from './transitions.js';
import { genState, rollCharacter, seedCode, styleDataOf } from './universe.js';
import { INSTRUMENTS, MIX_CHANNELS } from './arrangement.js';
import { ATMOS_CH } from './atmos.js';

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const gainDb = (g) => (g > 0 ? 20 * Math.log10(g) : -120);
const dbToGain = (d) => (d <= -119 ? 0 : Math.pow(10, d / 20));

// UN UNIVERSO RECIÉN NACIDO, en formato de archivo (como lo dejaría NUEVO UNIVERSO). `mixOf(sty)` =
// la mezcla con la que nace (la pone el motor: depende del preset del MIXER)
// (`style` null = NORMAL)
export function birthUniverse(seed, style, mixOf) {
  // (con la marca de CRUJIDO y RUIDO si la lleva: el PARECIDO de uno que los tiene, también)
  const sty = style ? rollStyle(seed, style.t, style.name, style.purity, { atmos: style.atmos }) : rollStyle(seed, 0);
  const ch = rollCharacter(seed, sty);
  const { sty: _s, ...fxPal } = makePalette(seed, sty);
  const u = {
    seed, style: style ? { ...style } : null,
    gen: genState(makeGenerators(seed, sty)),
    cx: ch.cx, osc: ch.osc, kit: ch.kit, color: { v: ch.v, a: ch.a },
    space: clone(makeSpace(seed, sty)), spaceRng: new Rng((seed ^ 0x510e527f) >>> 0).a,
    fxPal: clone(fxPal), fxRng: new Rng(seed ^ 0x6a09e667).a,
    mix: mixOf(sty),
    styleData: sty.t > 0 ? styleDataOf(sty) : null,
  };
  return u;
}

// EL PARECIDO: `A` = el que suena, `B` = el recién nacido (mismo estilo y pureza), `keepS` y `keepM`
// = cuánto se mantiene el sonido y la música; `r` = el dado (de la semilla de B)
// La MÚSICA va CALIBRADA: sus piezas no son independientes (la complejidad, los dados o la frase
// mueven todas las notas a la vez), y mantener cada pieza con probabilidad k dejaba igual una parte
// mucho menor de lo que suena. Medido (herramientas/similar.mjs, 150 universos, notas del bajo y
// golpes de percusión iguales, quitando el ~8 % en que coinciden dos universos al azar): ≈ k^2,1
// (k 0,5 → 26 %, 0,7 → 47 %, 0,9 → 80 %). Por eso cada pieza se mantiene con k = MÚSICA^0,48: la
// perilla a 50 % deja igual más o menos la mitad de lo que suena. El SONIDO no lo necesita (sus
// piezas son casi independientes: a 50 %, la mitad de los timbres)
export function blendUniverse(A, B, keepS, keepMusic, r) {
  const keepM = keepMusic >= 1 ? 1 : Math.pow(Math.max(0, keepMusic), 0.48);
  const sameS = keepS >= 1, sameM = keepM >= 1;
  // ¿se queda esta pieza? (con 1, siempre, sin tirar; con 0, nunca)
  const keep = (k) => (k >= 1 ? true : k <= 0 ? false : r.next() < k);
  const pick = (k, a, b) => (keep(k) ? clone(a) : clone(b));
  const mixNum = (k, a, b) => (k >= 1 ? a : lerp(b, a, k));
  const U = clone(A);
  U.similar = { of: A.code ?? seedCode(A), with: B.seed, sound: keepS, music: keepMusic };
  if (sameS && sameM) return U; // las dos a 100 %: el mismo universo, exacto

  // (sin estilo, NORMAL, no hay rangos ni modos que mezclar: solo lo de los generadores y el color)
  const SA = A.styleData, SB = B.styleData;
  const S = SA && SB ? clone(SA) : null;
  const gA = A.gen, gB = B.gen, G = U.gen;

  // ── SONIDO
  // el color del universo (interpolado) y los rangos de timbre, por instrumento
  U.color = { v: mixNum(keepS, A.color.v, B.color.v), a: mixNum(keepS, A.color.a, B.color.a) };
  const groups = S ? [...new Set(COLOR_PARAMS.map((p) => p.split('.')[0]))].filter((g) => g !== 'groove') : [];
  const bassFromB = !keep(keepS), chordFromB = !keep(keepS);
  for (const g of groups) {
    const fromB = g === 'bass' ? bassFromB : g === 'chord' ? chordFromB : !keep(keepS);
    if (!fromB) continue;
    COLOR_PARAMS.forEach((p, n) => {
      if (p.split('.')[0] !== g) return;
      S.color[1 + 2 * n] = SB.color[1 + 2 * n];
      S.color[2 + 2 * n] = SB.color[2 + 2 * n];
    });
  }
  // el MODO del bajo con su sonido (lo de cómo se toca va con la música, abajo) y el de los acordes
  const FA = SA?.k['bass.feel'], FB = SB?.k['bass.feel'], F = S?.k['bass.feel'];
  if (S && FA && FB && bassFromB) {
    S.bassMode = SB.bassMode;
    for (const f of ['sus', 'dec', 'post', 'pitch', 'fall', 'glideTau', 'sweep', 'range', 'octaveMax']) if (FB?.[f] !== undefined) F[f] = clone(FB[f]);
    if (F.fall && FA?.fall) F.fall.p = FA.fall.p; // (en qué pasos cae es de la música)
  }
  if (S && chordFromB) S.chordMode = SB.chordMode;
  // el sonido de cada tipo de hat (su ritmo, abajo)
  G.hat.kinds = gA.hat.kinds.map((k, i) => {
    const kb = gB.hat.kinds[i % gB.hat.kinds.length];
    return keep(keepS) ? clone(k) : { ...clone(k), name: kb.name, ch: kb.ch, tone: clone(kb.tone), eng: clone(kb.eng) };
  });
  // percusión y foley: el timbre de cada carril (su altura y su ritmo, abajo)
  const lanesSound = (LA, LB) => LA.map((l, i) => {
    if (keep(keepS)) return l;
    const s = clone(LB[i % LB.length].sound);
    if ('deg' in l.sound) { s.deg = l.sound.deg; s.oct = l.sound.oct; }
    return { ...l, sound: s };
  });
  // el espacio: delay, reverb y fondo, cada uno entero (con sus envíos); cuánto espacio, interpolado
  U.space.amt = mixNum(keepS, A.space.amt, B.space.amt);
  for (const fx of ['dly', 'rev', 'bg']) {
    if (keep(keepS)) continue;
    U.space[fx] = clone(B.space[fx]);
    if (U.space.gen && B.space.gen?.[fx]) U.space.gen[fx] = clone(B.space.gen[fx]);
  }
  // las transiciones: cada rasgo de su paleta
  for (const f of Object.keys(B.fxPal)) if (!keep(keepS)) U.fxPal[f] = clone(B.fxPal[f]);
  // la mezcla: cada canal, interpolado en dB
  if (A.mix && B.mix) {
    for (const k of MIX_CHANNELS) {
      const a = A.mix.inst?.[k], b = B.mix.inst?.[k];
      if (a !== undefined && b !== undefined) U.mix.inst[k] = dbToGain(mixNum(keepS, gainDb(a), gainDb(b)));
    }
    U.mix.fxPos = mixNum(keepS, A.mix.fxPos, B.mix.fxPos);
    U.mix.fxGain = dbToGain(mixNum(keepS, gainDb(A.mix.fxGain), gainDb(B.mix.fxGain)));
    if (S) for (const k of INSTRUMENTS) S.mix[k] = mixNum(keepS, SA.mix[k], SB.mix[k]);
  }

  // ── MÚSICA
  // el bajo: cada paso del motivo y de la variante, la respuesta, las marcas de cada paso
  const steps = (a, b) => (!a || !b ? a : a.map((x, i) => pick(keepM, x, b[i] ?? x)));
  G.bass.home = steps(gA.bass.home, gB.bass.home);
  G.bass.variant = steps(gA.bass.variant, gB.bass.variant);
  if (gA.bass.flags && gB.bass.flags) G.bass.flags = steps(gA.bass.flags, gB.bass.flags);
  if (gA.bass.ans && gB.bass.ans) {
    const ans = { deg: {}, w: {} };
    for (let s = 8; s < 16; s++) {
      const src = keep(keepM) ? gA.bass.ans : gB.bass.ans;
      if (s in src.deg) ans.deg[s] = src.deg[s];
      if (s in src.w) ans.w[s] = src.w[s];
    }
    G.bass.ans = ans;
  }
  if (S && FA && FB) {
    for (const f of ['cell', 'phrase', 'walk', 'walkEvery', 'long', 'glide', 'legato', 'cellLoose']) if (!keep(keepM)) F[f] = clone(FB[f]);
    if (!keep(keepM) && FB.fall) F.fall.p = FB.fall.p;
  }
  // los ritmos: hats (cada paso), el ritmo de cada tipo de hat, open, clap
  G.hat.w = steps(gA.hat.w, gB.hat.w);
  G.hat.acc = steps(gA.hat.acc, gB.hat.acc);
  G.hat.sure = steps(gA.hat.sure, gB.hat.sure);
  G.hat.kinds = G.hat.kinds.map((k, i) => {
    if (keep(keepM)) return k;
    const kb = gB.hat.kinds[i % gB.hat.kinds.length];
    return { ...k, w: clone(kb.w), acc: clone(kb.acc) };
  });
  if (!keep(keepM)) { G.ohat.w = clone(gB.ohat.w); G.ohat.extra = gB.ohat.extra; }
  if (!keep(keepM)) G.clap.style = gB.clap.style;
  // percusión y foley: cada carril (su ritmo y la altura de la percusión); los que sobran o faltan
  // (los dos universos no tienen los mismos carriles) entran o salen con la misma probabilidad, y uno
  // que entra suena como uno de los que ya había (si el sonido se mantiene)
  const RH = ['len', 'k', 'rot', 'rank', 'acc', 'prob'];
  const lanesMusic = (LA, LB) => {
    const out = [];
    for (let i = 0; i < Math.max(LA.length, LB.length); i++) {
      const a = LA[i], b = LB[i];
      if (a && b) {
        if (keep(keepM)) { out.push(a); continue; }
        const l = clone(a);
        for (const f of RH) l[f] = clone(b[f]);
        if ('deg' in l.sound) { l.sound.deg = b.sound.deg; l.sound.oct = b.sound.oct; }
        out.push(l);
      } else if (a) {
        if (keep(keepM)) out.push(a);
      } else if (!keep(keepM)) {
        const l = clone(b);
        if (keep(keepS) && LA.length) { const like = LA[i % LA.length].sound; l.sound = { ...clone(like), ...('deg' in b.sound ? { deg: b.sound.deg, oct: b.sound.oct } : {}) }; }
        out.push(l);
      }
    }
    if (!out.length) out.push(LA[0] ?? LB[0]);
    out.forEach((l, i) => { if ('lead' in l) l.lead = i === 0; }); // la principal, la primera
    return out;
  };
  G.perc.lanes = lanesMusic(lanesSound(gA.perc.lanes, gB.perc.lanes), gB.perc.lanes);
  G.foley.lanes = lanesMusic(lanesSound(gA.foley.lanes, gB.foley.lanes), gB.foley.lanes);
  // la armonía: cada rasgo, y cada paso de su ritmo
  for (const f of ['voicing', 'prog', 'alt', 'padEvery']) if (!keep(keepM)) G.harmony[f] = clone(gB.harmony[f]);
  G.harmony.w = steps(gA.harmony.w, gB.harmony.w);
  G.harmony.len = steps(gA.harmony.len, gB.harmony.len);
  // los dados de cada generador (golpes fantasma, redobles, lo que suena o no al azar)
  for (const k of Object.keys(G)) {
    if (keep(keepM)) continue;
    if ('rng' in G[k] && typeof G[k].rng === 'number') G[k].rng = gB[k].rng;
    else if (G[k].rng && gB[k]?.rng) G[k].rng = clone(gB[k].rng);
  }
  // complejidad, CANT · VAR (interpolados) y osciladores (cada grupo)
  for (const g of Object.keys(A.cx)) if (g !== 'global' && B.cx[g] !== undefined) U.cx[g] = mixNum(keepM, A.cx[g], B.cx[g]);
  for (const g of Object.keys(A.kit)) for (const q of ['amt', 'vary']) U.kit[g][q] = mixNum(keepM, A.kit[g][q], B.kit[g][q]);
  for (const g of Object.keys(A.osc)) if (!keep(keepM)) U.osc[g] = clone(B.osc[g]);
  if (S) {
    // del estilo: MUTE (cada instrumento), groove (cada instrumento) y sus rangos, el salto del kick, el
    // loop de la percusión, la percusión de fondo
    S.mutes = INSTRUMENTS.filter((k) => (keep(keepM) ? SA.mutes : SB.mutes).includes(k));
    if (S.mutes.includes('perc') && S.mutes.includes('foley')) S.mutes.splice(S.mutes.indexOf('foley'), 1);
    if (U.mix) U.mix.mute = [...S.mutes];
    if (SA.k.groove && SB.k.groove) for (const g of Object.keys(SA.k.groove)) if (!keep(keepM)) S.k.groove[g] = clone(SB.k.groove[g]);
    if (!keep(keepM)) COLOR_PARAMS.forEach((p, n) => {
      if (!p.startsWith('groove.')) return;
      S.color[1 + 2 * n] = SB.color[1 + 2 * n];
      S.color[2 + 2 * n] = SB.color[2 + 2 * n];
    });
    for (const f of ['kick.skip', 'kick.pickup', 'perc.back']) if (SA.k[f] !== undefined) S.k[f] = mixNum(keepM, SA.k[f], SB.k[f]);
    if (!keep(keepM)) S.k['loop.bars'] = SB.k['loop.bars'];
    if (keepM < 0.5) Object.assign(S, { arch: SB.arch, archLabel: SB.archLabel, archDesc: SB.archDesc }); // el nombre: el que más pesa
    // CRUJIDO y RUIDO (2026-11-13): son SONIDO; todas sus capas, de uno o de otro (cada capa va con su
    // canal, sus envíos y su entrar y salir: no se mezclan sueltas). Al final y solo si el universo los
    // lleva: el PARECIDO de uno de antes tira los mismos dados que antes
    if (SA.atmos && SB.atmos) {
      const src = keep(keepS) ? A : B;
      S.atmos = clone(src.styleData.atmos);
      for (const fx of ['dly', 'rev', 'bg']) for (const ch of ATMOS_CH) {
        delete U.space[fx].send[ch];
        if (src.space[fx].send[ch] !== undefined) U.space[fx].send[ch] = src.space[fx].send[ch];
      }
    }

}
  U.styleData = S;
  return U;
}
