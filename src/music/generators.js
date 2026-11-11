// GENERADORES — cada instrumento tiene un "motivo" estable (memoria) que muta
// lentamente. La densidad nunca sortea golpes nuevos: activa pesos ya fijados,
// así subir y bajar la densidad es reversible y el groove no se rompe.
//
// Cada generador devuelve, por compás, un array de 16 pasos: null | evento.
// `e` llega con `e.gen` ya ajustado por la COMPLEJIDAD y con `e.cx` (ver complexity.js).
// Hats y percs además con `e.kit` = { amt, vary } de su grupo: CANTIDAD y VARIEDAD (ver kit.js).
// `sty` = el ESTILO con el que nació el universo (styles.js): cambia rangos y pesos de las tiradas
// de siempre (con NORMAL, exactamente las de siempre) y añade lo que solo existe con estilo.

import { Rng, euclid, clamp, lerp } from '../core/rng.js';
import { HAT_KINDS, amountMul, presence, drawHatEngine } from './kit.js';
import { FOLEY_KINDS } from './sounds.js';
import { NORMAL, sWeighted, sPick, sFloat, mixW } from './styles.js';

const isDown = (s) => s % 4 === 0;
const isOff8 = (s) => s % 4 === 2;
// complejidad baja: las semicorcheas pesan más (entran tarde o nunca)
const fastPenalty = (s, f, amt) => (s % 2 === 1 ? amt * f : 0);

// recortar duraciones para que una nota no se solape con la siguiente (bajo, acordes).
// Copia los eventos que recorta: pueden venir de otra versión del compás (OSCILADOR)
export function trimLens(st) {
  let prev = null;
  for (let s = 0; s < st.length; s++) {
    if (!st[s]) continue;
    if (prev !== null && st[prev].len > s - prev) st[prev] = { ...st[prev], len: s - prev };
    prev = s;
  }
  return st;
}

// ───────────────────────── KICK
const KICK_GHOST = [7, 10, 14, 15];
export class KickGen {
  constructor(rng, sty = NORMAL) { this.rng = rng; this.sty = sty; }
  bar(b, d, e) {
    const st = new Array(16).fill(null);
    const S = this.sty, t = S.t;
    // ESTILO: el peso de cada tiempo (en ROMINIMAL, la 1ª mitad del compás pesa más)
    const V = t ? S.k['kick.vel'] : null;
    for (const s of [0, 4, 8, 12]) {
      const v = s === 0 ? 1 : 0.94;
      st[s] = { vel: V ? lerp(v, V[s >> 2], t) : v };
    }
    const r = this.rng;
    // (la caída del último tiempo al final de frase es un AUTO-ARREGLO: ver Deck.kickDrop)
    // kicks fantasma (tensión / euforia): groove roto
    if (r.chance(e.gen.ghostKick * 0.7)) st[sPick(r, S, 'kick.ghost', KICK_GHOST)] = { vel: 0.42 };
    if (e.cx.doubleGhost && r.chance(e.gen.ghostKick * 0.5)) st[r.pick([3, 6, 11])] = { vel: 0.36 };
    if (t) {
      // ESTILO (no depende de la complejidad: es del género). El SALTO: un fantasma flojo en la 1ª
      // mitad del compás («a swinging or skipping momentum»); y el golpe que cae «en medio» de un
      // loop de 4 compases (al final del 2º). Solo donde no hay ya un golpe
      if (r.chance((S.k['kick.skip'] ?? 0) * t)) {
        const s = r.weighted([3, 6, 7], [1, 1.5, 2]);
        if (!st[s]) st[s] = { vel: r.float(0.3, 0.45) };
      }
      if (b % 4 === 1 && r.chance((S.k['kick.pickup'] ?? 0) * t)) {
        const s = r.pick([14, 15]);
        if (!st[s]) st[s] = { vel: 0.4 };
      }
    }
    if (d < 0.25 && b % 2 === 1) st[8] = null; // muy poca presencia: respira
    return st;
  }
}

// ───────────────────────── CLAP
const CLAP_STYLES = ['24', '4', '24ghost', 'late'];
const CLAP_W = [5, 2, 2, 1.5];
export class ClapGen {
  constructor(rng, sty = NORMAL) {
    this.rng = rng;
    this.sty = sty;
    this.style = sWeighted(rng, sty, 'clap.style', CLAP_STYLES, CLAP_W);
  }
  mutate() { this.style = sWeighted(this.rng, this.sty, 'clap.style', CLAP_STYLES, CLAP_W); }
  bar(b, d, e) {
    const st = new Array(16).fill(null);
    const r = this.rng;
    const lowD = d < 0.35;
    // poca complejidad: solo los estilos rectos
    const style = e.cx.clapExtras ? this.style : this.style === '4' ? '4' : '24';
    if (style === '4' || lowD) st[12] = { vel: 1 };
    else if (style === 'late') { st[4] = { vel: 0.9 }; st[13] = { vel: 0.95 }; }
    else { st[4] = { vel: 0.95 }; st[12] = { vel: 1 }; }
    if (style === '24ghost' && !lowD) st[r.pick([7, 15, 10])] = { vel: 0.35 };
    // redoble de tensión al final de frase
    if (b % 8 === 7 && e.cx.clapRolls && r.chance(e.gen.fills * 0.8)) {
      if (e.cx.longRolls && r.chance(0.6)) { // redoble largo: semicorcheas creciendo
        for (let s = 10; s < 16; s++) st[s] = { vel: 0.3 + (s - 10) * 0.12 };
      } else {
        st[13] = { vel: 0.4 }; st[14] = { vel: 0.55 }; st[15] = { vel: 0.7 };
      }
    }
    return st;
  }
}

// ───────────────────────── HATS
// El hat del universo (cerrado aquí, su abierto en OHatGen) y, con la VARIEDAD, hasta cuatro
// tipos más (ver HAT_KINDS en kit.js), cada uno con su sitio en el compás. Los eventos llevan
// `ty`: sin él, el hat del universo; 1..4, el tipo `this.kinds[ty - 1]`.
const HAT_DENS = 0.68; // la densidad de siempre con la CANTIDAD en el centro

export class HatGen {
  constructor(rng, sty = NORMAL) {
    this.rng = rng;
    this.roll();
    // después del motivo principal: la misma semilla sigue dando el mismo hat de antes
    // El orden sale de la semilla, pero el 2º sonido siempre es cerrado: el MEDIO (abierto) va
    // por el canal del open hat y no se oiría en las partes sin OPEN
    const r = rng;
    const names = ['fino', 'oscuro', 'tick'].map((n) => [n, r.next()]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    names.splice(r.int(1, 3), 0, 'medio');
    this.kinds = names.map((name) => {
      const K = HAT_KINDS[name];
      return {
        name, ch: K.ch, tone: K.tone(r),
        w: Array.from({ length: 16 }, (_, s) => clamp(K.cat(s) + r.float(-0.25, 0.25), 0.02, 1)),
        acc: Array.from({ length: 16 }, () => r.float(0.35, 1)),
      };
    });
    // el MOTOR de cada tipo (kit.js), de un dado aparte: la misma semilla da los mismos golpes
    const re = r.fork();
    this.kinds.forEach((k) => (k.eng = drawHatEngine(re, k.name, sty)));
  }
  roll() {
    const r = this.rng;
    // peso bajo = entra antes. Categorías musicales: offbeat 16 > downbeat > offbeat 8
    this.w = Array.from({ length: 16 }, (_, s) => {
      const cat = s % 2 === 1 ? 0.35 : isDown(s) ? 0.75 : 0.55;
      return clamp(cat + r.float(-0.3, 0.3));
    });
    this.acc = Array.from({ length: 16 }, (_, s) => (s % 2 === 1 ? r.float(0.6, 1) : r.float(0.25, 0.7)));
  }
  mutate() {
    const r = this.rng;
    for (let i = 0; i < 2; i++) {
      const s = r.int(0, 15);
      this.w[s] = clamp(this.w[s] + r.float(-0.35, 0.35));
      this.acc[s] = r.float(0.25, 1);
    }
    const k = r.pick(this.kinds); // y un paso de uno de los otros tipos
    const s = r.int(0, 15);
    k.w[s] = clamp(k.w[s] + r.float(-0.3, 0.3), 0.02, 1);
  }
  // umbral: densidad de la escena × CANTIDAD (nunca los 16 pasos: siempre huecos)
  thr(d, e) { return Math.min(0.97, 0.1 + 0.75 * d * HAT_DENS * amountMul(e.kit.amt)); }
  bar(b, d, e) {
    const thr = this.thr(d, e);
    const st = new Array(16).fill(null);
    const f = e.cx.fast;
    // `sure` = lo seguro que es cada golpe (peso / umbral: 0 = de lo más fuerte, casi 1 = justo
    // entra). Ver kindsBar
    this.sure = new Array(16).fill(1);
    for (let s = 0; s < 16; s++) {
      // simple = el "tss" en contratiempo; complejo = semicorcheas
      const w = this.w[s] + fastPenalty(s, f, 0.6) - (isOff8(s) ? 0.3 * f : 0);
      if (w < thr) {
        st[s] = { vel: 1 - e.hat.accent * (1 - this.acc[s]) };
        this.sure[s] = Math.max(0, w) / thr;
      }
    }
    if (b % 8 === 7 && this.rng.chance(e.gen.fills * 0.6)) {
      for (let s = 12; s < 16; s++) { st[s] = { vel: 0.35 + (s - 12) * 0.15 }; this.sure[s] = 0; }
    }
    return st;
  }
  // VARIEDAD: los otros tipos entran en su canal (`out` = { hat, ohat } ya hechos; `d` =
  // densidad de cada canal). Un paso es de quien lo tiene más seguro: así, con mucha CANTIDAD,
  // el hat principal no se lo come todo y los otros se siguen oyendo (sin amontonarse en el
  // mismo paso). El que está entrando suena solo en sus pasos más fuertes. Los redobles y el
  // open hat del universo no se tocan. La COMPLEJIDAD les toca igual: menos semicorcheas
  kindsBar(d, e, out) {
    const f = e.cx.fast;
    const sure = { hat: [...this.sure], ohat: out.ohat.map((x) => (x ? 0 : 1)) };
    this.kinds.forEach((k, i) => {
      const pres = presence(e.kit.vary, i + 1);
      if (pres <= 0) return;
      const st = out[k.ch];
      const thr = this.thr(d[k.ch], e) * pres;
      for (let s = 0; s < 16; s++) {
        const w = k.w[s] + fastPenalty(s, f, 0.5);
        if (w >= thr || w / thr >= sure[k.ch][s]) continue;
        st[s] = { vel: 1 - e.hat.accent * 0.8 * (1 - k.acc[s]), ty: i + 1 };
        sure[k.ch][s] = w / thr;
      }
    });
  }
}

// ───────────────────────── HAT ABIERTO
export class OHatGen {
  constructor(rng) {
    this.rng = rng;
    this.w = [2, 6, 10, 14].map(() => rng.float(0, 1));
    this.extra = rng.pick([null, 15, 7, 11]);
  }
  mutate() { this.extra = this.rng.pick([null, 15, 7, 11, 3]); }
  bar(b, d, e) {
    const st = new Array(16).fill(null);
    const thr = (0.2 + 0.8 * d) * amountMul(e.kit.amt); // CANTIDAD (centro = lo de siempre)
    [2, 6, 10, 14].forEach((s, i) => { if (this.w[i] < thr) st[s] = { vel: 0.85 + 0.15 * this.w[i] }; });
    if (this.extra !== null && e.cx.ohatExtra && d > 0.6) st[this.extra] = { vel: 0.5 };
    return st;
  }
}

// ───────────────────────── PERCUSIÓN GENERATIVA (polimetría)
// Hasta 5 carriles con longitudes distintas (16, 12, 7, 5...) que giran sobre
// el compás: el patrón resultante tarda mucho en repetirse = hipnosis.
// El 1º es la PERCUSIÓN PRINCIPAL: el único que suena con VARIEDAD 1, así que nunca puede salir
// casi mudo. Sonido con tono (nada de ruido estrecho, que apenas se oye), longitud par y giro par
// (sus golpes base caen en corcheas: la complejidad baja no se los quita) y al menos un golpe
// por cada cuatro pasos de su ciclo. Lo conserva al mutar.
// Tipos (motores del taller, ver percSound en sounds.js): tone y fm (los de siempre), noise (ruido
// estrecho), reso (rim, clave, conga), bell (cowbell), modal (madera, barra, tubo), ks (tic de
// madera afinado), glitch (clics y ráfagas) y grains (semillas). La principal, solo con tono.
const PERC_TYPES = ['tone', 'fm', 'noise', 'reso', 'bell', 'modal', 'ks', 'glitch', 'grains'];
const PERC_W = [3, 4, 2.5, 2.5, 1, 2, 2, 1.5, 1.5];
const LEAD_W = [3, 4, 0, 2.5, 0, 2.5, 2, 0, 0];
// alturas (grados de la escala): las de siempre, y con ESTILO también 2ª, 4ª y 6ª (las tres
// últimas, con peso 0 sin estilo). DEG_W = el reparto de siempre (el 0 y el 4 salían el doble)
const DEG = [0, 0, 2, 4, 4, 6, 7, 9, 11];
const DEG_ST = [0, 2, 4, 6, 7, 9, 11, 1, 3, 5];
const DEG_W = [2, 1, 2, 1, 1, 1, 1, 0, 0, 0];
function percDeg(r, sty) {
  const s = sty.t ? sty.k['perc.deg'] : null;
  if (!s) return r.pick(DEG);
  return r.weighted(DEG_ST, mixW(DEG_W, DEG_ST.map((d, i) => s[d] ?? DEG_W[i]), sty.t));
}
function makePercSound(r, lead = false, sty = NORMAL) {
  const type = sWeighted(r, sty, lead ? 'perc.lead' : 'perc.type', PERC_TYPES, lead ? LEAD_W : PERC_W);
  return {
    type,
    deg: percDeg(r, sty),
    oct: r.pick([2, 3, 3, 4]),
    wave: r.pick(['sine', 'triangle', 'sine']),
    bend: r.float(0.15, 1.2),
    ratioH: r.pick([1, 2, 3, 0.5, 4]),
    ratioI: r.pick([1.414, 2.76, 3.53, 1.19, 4.33, 5.4]),
    index: r.float(0.5, 2),
    decay: type === 'noise' ? r.float(0.02, 0.07) : sFloat(r, sty, 'perc.decay', 0.04, 0.22),
    nfreq: r.float(900, 6000),
    q: r.float(2, 14),
    pan: sFloat(r, sty, 'perc.pan', -0.75, 0.75),
    timbre: r.int(1, 2 ** 30), // semilla de los números fijos de su motor (sounds.js)
  };
}

const leadMinK = (l) => (l.lead ? Math.ceil(l.len / 4) : 1);

// dónde va cada carril (percusión y foley). Sin estilo, el paso absoluto: la polimetría gira sin fin.
// Con ESTILO (`loop.bars`), la POLIMETRÍA CIERRA: todos los carriles vuelven a empezar cada 2 o 4
// compases, como el «master length» de una caja de ritmos. Dentro de la frase el 3 contra 4 sigue
// tirando; la frase entera se repite y el loop se reconoce. Y `sure`: con estilo, los golpes fuertes
// (acento ≥ `loop.sure`) salen siempre; solo los flojos (los fantasmas) a veces sí y a veces no
function loopPos(sty, abs) {
  const L = sty.t ? sty.k['loop.bars'] : 0;
  const S = sty.t ? sty.k['loop.sure'] : undefined;
  // (el umbral va de «ninguno» —por encima del acento máximo, 1— al del estilo según el fader)
  return { pos: L ? abs % (16 * L) : abs, sure: S === undefined ? Infinity : lerp(1.01, S, sty.t) };
}

function makeLane(r, lead = false, sty = NORMAL) {
  let len = lead ? sWeighted(r, sty, 'lead.len', [16, 12, 8, 6], [3, 2, 1.5, 1])
    : sWeighted(r, sty, 'perc.len', [16, 12, 10, 7, 6, 5, 3], [4, 2, 1, 2, 1, 1.5, 0.8]);
  // ESTILO: un carril de compás puede ser una FRASE DE DOS COMPASES (32 pasos): el 2º compás
  // contesta al 1º (pregunta y respuesta) y el loop se repite cada dos. Sin estilo, ninguna tirada
  if (sty.t && len === 16) {
    const p = sty.k[lead ? 'lead.phrase' : 'perc.phrase'];
    if (p && r.chance(p * sty.t)) len = 32;
  }
  const k = lead ? r.int(Math.ceil(len / 4), Math.ceil(len / 2)) : clamp(r.int(1, Math.ceil(len / 2)), 1, len);
  return {
    lead, len, k, rot: lead ? 2 * r.int(0, len / 2 - 1) : r.int(0, len - 1),
    rank: null, sound: makePercSound(r, lead, sty),
    acc: Array.from({ length: len }, () => sFloat(r, sty, 'perc.acc', 0.4, 1)),
    prob: sFloat(r, sty, 'perc.prob', 0.75, 1),
  };
}

// al mutar, qué se hace: con ESTILO, los pesos del estilo (los de cambiar de sonido, × `strength`)
function mutOp(r, sty, key, ops, w0, strength) {
  const s = sty.t ? sty.k[key] : null;
  if (!s) return r.weighted(ops, w0);
  const w1 = ops.map((op, i) => (s[op] === undefined ? w0[i] : s[op] * (op === 'sound' || op === 'len' ? strength : 1)));
  return r.weighted(ops, mixW(w0, w1, sty.t));
}

// CANTIDAD de un carril: en qué orden entran sus golpes. Primero los del patrón euclídeo
// (k golpes repartidos: lo que suena con la perilla en el centro), luego los huecos más lejos
// de lo que ya suena. Quitar golpes = desandar el orden: subir y bajar es reversible.
// `rank[i]` = turno del paso i del carril
function laneRank(l) {
  const base = [], rest = [];
  euclid(l.k, l.len, l.rot).forEach((h, i) => (h ? base : rest).push(i));
  const order = [];
  const gap = (i) => {
    let m = Infinity;
    for (const j of order) { const d = Math.abs(i - j); m = Math.min(m, d, l.len - d); }
    return m;
  };
  for (const pool of [base, rest]) {
    while (pool.length) {
      let best = 0, bd = -1;
      pool.forEach((i, x) => { const g = gap(i); if (g > bd) { bd = g; best = x; } });
      order.push(pool.splice(best, 1)[0]);
    }
  }
  l.rank = new Array(l.len);
  order.forEach((i, n) => (l.rank[i] = n));
}

export class PercGen {
  constructor(rng, sty = NORMAL) {
    this.rng = rng;
    this.sty = sty;
    this.lanes = [0, 1, 2, 3, 4].map((n) => makeLane(rng, n === 0, sty));
    this.lanes.forEach(laneRank);
  }
  mutate(strength = 1) {
    const r = this.rng;
    const l = r.pick(this.lanes);
    const op = mutOp(r, this.sty, 'perc.mut', ['rot', 'k', 'sound', 'len'], [4, 3, 1.2 * strength, 0.8 * strength], strength);
    // la principal gira de dos en dos: sus golpes base siguen en corcheas
    if (op === 'rot') l.rot = (((l.rot + (l.lead ? r.pick([2, -2, 4]) : r.pick([1, -1, 2, 3]))) % l.len) + l.len) % l.len;
    else if (op === 'k') l.k = clamp(l.k + r.pick([1, -1]), leadMinK(l), Math.ceil(l.len * 0.6));
    else if (op === 'sound') l.sound = makePercSound(r, l.lead, this.sty);
    else Object.assign(l, makeLane(r, l.lead, this.sty));
    laneRank(l);
  }
  // `abs` = número absoluto del primer paso del compás (para la polimetría).
  // VARIEDAD = cuántos carriles (cada uno, su sonido); CANTIDAD × densidad de la escena = cuántos
  // golpes da cada uno (con poca densidad, los carriles de menos golpes callan antes)
  bar(b, d, e, abs) {
    const st = new Array(16).fill(null);
    const fill = b % 8 === 7 && this.rng.chance(e.gen.fills * 0.7);
    const mul = amountMul(e.kit.amt) * (0.35 + 0.65 * d);
    const ks = this.lanes.map((l, n) => {
      const x = l.k * mul * presence(e.kit.vary, n);
      // con la CANTIDAD al mínimo, un golpe suelto por carril; callan los que están entrando
      // (VARIEDAD) o con muy poca densidad de escena
      return x < 0.25 ? 0 : clamp(Math.round(x), 1, Math.ceil(l.len * 0.75));
    });
    const f = e.cx.fast;
    const { pos, sure } = loopPos(this.sty, abs);
    // JERARQUÍA (solo con ESTILO, `perc.back`): la percusión principal delante y las demás detrás,
    // acompañando (sin estilo, todas iguales: ×1)
    const back = this.sty.t && this.sty.k['perc.back'] ? lerp(1, this.sty.k['perc.back'], this.sty.t) : 1;
    for (let s = 0; s < 16; s++) {
      const evs = [];
      for (let n = 0; n < this.lanes.length; n++) {
        const l = this.lanes[n];
        if (!ks[n]) continue;
        const i = (pos + s) % l.len;
        if (s % 2 === 1 && l.acc[i] < 0.4 + 0.6 * f) continue; // menos semicorcheas
        const hit = l.rank[i] < ks[n] || (fill && s >= 12 && n === 0 && this.rng.chance(0.6));
        if (hit && (l.acc[i] >= sure || this.rng.chance(l.prob))) evs.push({ lane: l, n, vel: n ? l.acc[i] * back : l.acc[i] }); // n = su ranura de sonido (p0..p4)
      }
      if (evs.length) st[s] = evs;
    }
    return st;
  }
}

// ───────────────────────── FOLEY
// Objetos (un MATERIAL que alguien manipula con una ACCIÓN, nuevos en cada universo: ver
// foleySound en sounds.js) en
// carriles ESCASOS de longitudes distintas, como la percusión polimétrica pero con pocos golpes:
// aparecen de vez en cuando, no llevan el pulso. VARIEDAD = cuántos objetos (uno por carril,
// cada uno de un material distinto); CANTIDAD = cuántos golpes da cada uno (ver kit.js). Convive con la
// percusión: donde ya suena una perc, el foley calla salvo en sus golpes más fuertes
function foleyObject(r, mat) {
  return { mat, timbre: r.int(1, 2 ** 30), pan: r.float(-0.8, 0.8) };
}
function makeFoleyLane(r, kind, sty = NORMAL) {
  // largos (hasta dos compases): cada objeto aparece de vez en cuando, no en cada compás.
  // Con ESTILO, sus pesos (en ROMINIMAL, los que encajan en el loop de 1, 2 o 4 compases)
  const len = sWeighted(r, sty, 'foley.len', [32, 24, 20, 16, 12, 10, 7], [1.5, 1.5, 1, 3, 2, 1, 0.8]);
  return {
    // pocos golpes: cada gesto dura de medio a un compás entero y se solaparían
    len, k: r.int(1, Math.ceil(len / 8)), rot: r.int(0, len - 1), rank: null,
    acc: Array.from({ length: len }, () => r.float(0.45, 1)),
    prob: sFloat(r, sty, 'foley.prob', 0.7, 1),
    sound: foleyObject(r, kind),
  };
}

// en qué orden salen los materiales (los primeros, los carriles que entran antes con la VARIEDAD).
// Con ESTILO, barajado con peso: cada material con la llave (1 − u)^(1/peso), de mayor a menor (con
// todos los pesos a 1 es el mismo orden de siempre)
function foleyOrder(rng, sty) {
  const keyed = FOLEY_KINDS.map((k) => [k, rng.next()]);
  const s = sty.t ? sty.k['foley.mat'] : null;
  if (!s) return keyed.sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  const w = (k) => lerp(1, s[k] ?? 1, sty.t);
  return keyed.map(([k, u]) => [k, Math.pow(1 - u, 1 / w(k))]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}

export class FoleyGen {
  constructor(rng, sty = NORMAL) {
    this.rng = rng;
    this.sty = sty;
    const kinds = foleyOrder(rng, sty);
    this.lanes = [0, 1, 2, 3, 4].map((n) => makeFoleyLane(rng, kinds[n], sty));
    this.lanes.forEach(laneRank);
  }
  mutate(strength = 1) {
    const r = this.rng;
    const l = r.pick(this.lanes);
    const op = mutOp(r, this.sty, 'foley.mut', ['rot', 'k', 'sound'], [4, 3, strength], strength);
    if (op === 'rot') l.rot = (((l.rot + r.pick([1, -1, 2, 3])) % l.len) + l.len) % l.len;
    else if (op === 'k') l.k = clamp(l.k + r.pick([1, -1]), 1, Math.ceil(l.len / 4));
    else { // otro objeto, de un material que no esté en ningún carril
      const used = new Set(this.lanes.map((x) => x.sound.mat));
      l.sound = foleyObject(r, sPick(r, this.sty, 'foley.mat', FOLEY_KINDS.filter((k) => !used.has(k))));
    }
    laneRank(l);
  }
  // como PercGen.bar; `perc` = los pasos de la percusión de este compás (para no pisarla)
  bar(b, d, e, abs, perc) {
    if (this.sty.t && this.sty.k['candy.rate']) return this.candyBar(b, d, e);
    const st = new Array(16).fill(null);
    const mul = amountMul(e.kit.amt) * (0.35 + 0.65 * d);
    const ks = this.lanes.map((l, n) => {
      const x = l.k * mul * presence(e.kit.vary, n);
      return x < 0.25 ? 0 : clamp(Math.round(x), 1, Math.ceil(l.len * 0.75));
    });
    const f = e.cx.fast;
    const { pos, sure } = loopPos(this.sty, abs);
    for (let s = 0; s < 16; s++) {
      const evs = [];
      for (let n = 0; n < this.lanes.length; n++) {
        const l = this.lanes[n];
        if (!ks[n]) continue;
        const i = (pos + s) % l.len;
        if (l.rank[i] >= ks[n]) continue;
        if (s % 2 === 1 && l.acc[i] < 0.4 + 0.6 * f) continue; // menos semicorcheas
        if (perc?.[s] && l.acc[i] < 0.85) continue;           // ahí ya suena una perc
        if (l.acc[i] >= sure || this.rng.chance(l.prob)) evs.push({ n, vel: l.acc[i] }); // n = su ranura de sonido (f0..f4)
      }
      if (evs.length) st[s] = evs;
    }
    return st;
  }

  // EAR CANDY (solo con ESTILO, `candy.*`): el foley deja de ser un carril del loop y pasa a ser
  // un detalle que APARECE de vez en cuando: un objeto suelto, casi siempre al final de una frase,
  // en un sitio débil del compás (nunca encima del kick), y no vuelve en el mismo sitio. «Ear candy»
  // = sorpresa, no ritmo (2026-11-11: como carril sonaba en el 77 % de los compases y ocupaba la
  // mitad de cada uno). CANTIDAD = cuántas veces aparece; VARIEDAD = cuántos objetos se turnan.
  // Los carriles (y sus objetos y sonidos) siguen ahí: de ellos sale QUÉ suena
  candyBar(b, d, e) {
    const st = new Array(16).fill(null);
    const r = this.rng, K = this.sty.k;
    // probabilidad de este compás: la del universo × CANTIDAD × presencia de la escena; la frase
    // la reparte (final de frase arriba, su primer compás casi nunca)
    const ph = b % 8;
    const where = ph === 7 ? 2.4 : ph === 3 ? 1.6 : ph === 0 ? 0.3 : 0.8;
    const p = K['candy.rate'] * amountMul(e.kit.amt) * (0.4 + 0.6 * d) * where;
    if (!r.chance(Math.min(0.9, p))) return st;
    // qué objeto: uno de los que deja la VARIEDAD (el que entra, menos)
    const ws = this.lanes.map((_, n) => presence(e.kit.vary, n));
    const n = r.weighted(ws.map((_, i) => i), ws);
    // dónde: pasos débiles (contratiempos y semicorcheas), más al final del compás
    const s = r.weighted(CANDY_STEPS, CANDY_W);
    const vel = r.float(0.55, 0.95);
    st[s] = [{ n, vel }];
    // a veces, un segundo golpe del mismo objeto (una respuesta), más flojo
    if (r.chance(K['candy.pair'] ?? 0)) {
      const s2 = s + r.pick([2, 3, 4, 6]);
      if (s2 < 16 && s2 % 4) st[s2] = [{ n, vel: vel * r.float(0.5, 0.8) }]; // (nunca en un tiempo: ahí va el kick)
    }
    return st;
  }
}
const CANDY_STEPS = [2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15];
const CANDY_W = [1, 0.8, 0.5, 1, 1, 0.5, 1.2, 1, 0.8, 1.6, 1.2];

// ───────────────────────── BASS
// El motivo guarda GRADOS de escala, no notas: si la emoción cambia el modo
// (frigio → dórico...), la misma frase se recolorea sin perder identidad.
// `sty`: el ESTILO cambia el peso de cada sitio del compás (bass.cat: corchea en contratiempo,
// semicorchea, el 1, los otros tiempos), las alturas y los largos
const BASS_CAT = [0.3, 0.5, 1.1, 0.85];
function makeBassMotif(r, sty = NORMAL) {
  const C = sty.t ? sty.k['bass.cat'] : null;
  return Array.from({ length: 16 }, (_, s) => {
    const i = isOff8(s) ? 0 : s % 2 === 1 ? 1 : s === 0 ? 2 : 3;
    const cat = C ? lerp(BASS_CAT[i], C[i], sty.t) : BASS_CAT[i];
    return {
      w: clamp(cat + r.float(-0.28, 0.28), 0, 1.2),
      deg: sWeighted(r, sty, 'bass.deg', [0, 7, 4, 6, 2, 1, 3, -3], [10, 3.5, 2.5, 2, 1.5, 1, 1, 1]),
      len: sWeighted(r, sty, 'bass.len', [1, 2, 3], [6, 2.5, 1]),
      vel: r.float(0.7, 1),
    };
  });
}

// menos complejidad = menos alturas distintas (tónica, quinta, octava)
const FEW = new Set([0, 4, 7, -3]);
function simplifyDeg(deg, mode) {
  if (mode === 'all') return deg;
  if (mode === 'few') return FEW.has(deg) ? deg : 0;
  return deg === 7 ? 7 : 0;
}

export class BassGen {
  constructor(rng, sty = NORMAL) {
    this.rng = rng;
    this.sty = sty;
    this.home = makeBassMotif(rng, sty);
    const first = this.home.find((n) => n.w < 0.5); // la primera nota fuerte, tónica
    if (first) first.deg = 0;
    this.variant = this.derive(this.home, 2);
  }
  derive(m, changes) {
    const r = this.rng;
    const v = m.map((n) => ({ ...n }));
    for (let i = 0; i < changes; i++) {
      const s = r.int(1, 15);
      if (r.chance(0.6)) v[s].deg = sPick(r, this.sty, 'bass.derive', [0, 7, 4, 6, 2, 9, 11]);
      else v[s].w = clamp(v[s].w + r.float(-0.4, 0.4), 0, 1.2);
    }
    return v;
  }
  mutate() {
    this.home = this.derive(this.home, 1);
    this.variant = this.derive(this.home, this.rng.int(1, 3));
  }
  bar(b, d, e) {
    const cx = e.cx;
    const m = cx.bassVariant && b % 4 === 3 ? this.variant : this.home;
    // simple = corcheas en contratiempo (el bajo clásico); más complejidad = semicorcheas
    const thr = 0.12 + 0.5 * d * (0.6 + 0.4 * e.gen.density); // el bajo deja aire al kick
    const st = new Array(16).fill(null);
    let last = -10;
    for (let s = 0; s < 16; s++) {
      const n = m[s];
      if (n.w + fastPenalty(s, cx.fast, 0.4) >= thr || s - last < 1) continue;
      st[s] = { deg: simplifyDeg(n.deg, cx.bassPitches), len: n.len, vel: n.vel };
      last = s;
    }
    return trimLens(st); // bajo monofónico: sin solapes
  }
}

// ───────────────────────── ARMONÍA: acordes dub (stabs) + pad (atmósfera)
// Como el bajo, todo son GRADOS de escala: si el modo global cambia, los
// acordes se recolorean sin perder identidad. Acordes y pad comparten la misma
// progresión, así que nunca chocan entre sí.
const VOICINGS = [
  [0, 2, 4, 6], // séptima
  [0, 4, 6, 8], // abierto: 5ª, 7ª y 9ª, sin 3ª (el clásico acorde dub)
  [0, 3, 6],    // cuartas apiladas
  [0, 2, 4, 8], // add9
  [0, 4, 9],    // quinta + décima: hueco y profundo
];
// qué acorde suena en cada compás de una frase de 8 (0 = casa, 1 = el otro)
const PROGS = [
  [0, 0, 0, 0, 0, 0, 0, 0], // un solo acorde: lo más minimal
  [0, 0, 0, 0, 1, 1, 1, 1],
  [0, 0, 0, 1, 0, 0, 0, 1],
  [0, 0, 1, 1, 0, 0, 1, 1],
];
const PROG_W = [4, 2.5, 2, 1.5];
const ALTS = [3, 5, -2, -1, 4]; // iv, VI, VI grave, VII grave, v
const ALT_W = [3, 3, 2, 2, 1.5];

// cada cuántos compases respira el pad: 2 o 4 (el 4, el doble); con ESTILO también 8
const PAD_EVERY = [2, 4, 4];
function padEveryOf(r, sty) {
  const s = sty.t ? sty.k['harm.padEvery'] : null;
  if (!s) return r.pick(PAD_EVERY);
  const items = [2, 4, 8], w0 = [1, 2, 0];
  return r.weighted(items, mixW(w0, items.map((x, i) => s[x] ?? w0[i]), sty.t));
}
const CHORD_LEN = [1, 2, 3, 6];
const CHORD_LEN_W = [5, 3, 1.5, 0.7];

export class HarmonyGen {
  constructor(rng, sty = NORMAL) {
    this.rng = rng;
    this.sty = sty;
    this.voicing = sPick(rng, sty, 'harm.voicing', VOICINGS);
    this.prog = sWeighted(rng, sty, 'harm.prog', PROGS, PROG_W);
    this.alt = sWeighted(rng, sty, 'harm.alt', ALTS, ALT_W);
    this.padEvery = padEveryOf(rng, sty); // cada cuántos compases respira el pad
    this.rollRhythm();
  }
  // ritmo de los stabs: los contratiempos entran antes, el tiempo fuerte lo deja al kick
  rollRhythm() {
    const r = this.rng;
    this.w = Array.from({ length: 16 }, (_, s) => {
      const cat = isOff8(s) ? 0.25 : s % 2 === 1 ? 0.55 : isDown(s) ? 0.9 : 0.6;
      return clamp(cat + r.float(-0.3, 0.3));
    });
    this.len = Array.from({ length: 16 }, () => sWeighted(r, this.sty, 'chord.len', CHORD_LEN, CHORD_LEN_W));
  }
  mutate() {
    const r = this.rng, S = this.sty;
    const op = sWeighted(r, S, 'harm.mut', ['rhythm', 'alt', 'prog', 'voicing'], [4, 2, 1.5, 0.8]);
    if (op === 'rhythm') {
      for (let i = 0; i < 2; i++) {
        const s = r.int(0, 15);
        this.w[s] = clamp(this.w[s] + r.float(-0.35, 0.35));
        this.len[s] = sWeighted(r, S, 'chord.len', CHORD_LEN, CHORD_LEN_W);
      }
    } else if (op === 'alt') this.alt = sWeighted(r, S, 'harm.alt', ALTS, ALT_W);
    else if (op === 'prog') this.prog = sWeighted(r, S, 'harm.prog', PROGS, PROG_W);
    else this.voicing = sPick(r, S, 'harm.voicing', VOICINGS);
  }
  // `cx`: con poca complejidad, un solo acorde y menos notas
  chordAt(b, cx) {
    const root = cx.progression && this.prog[((b % 8) + 8) % 8] ? this.alt : 0;
    return { root, notes: this.voicing.slice(0, cx.chordNotes).map((d) => d + root) };
  }

  // stabs: densidad = cuántos golpes del motivo suenan
  chordBar(b, d, e) {
    const cx = e.cx;
    const ch = this.chordAt(b, cx);
    const thr = 0.1 + 0.5 * d * (0.5 + 0.5 * e.gen.density);
    const st = new Array(16).fill(null);
    let last = -10;
    for (let s = 0; s < 16; s++) {
      if (this.w[s] + fastPenalty(s, cx.fast, 0.5) >= thr || s - last < cx.chordGap) continue;
      st[s] = { notes: ch.notes, len: this.len[s], vel: 1 - 0.35 * this.w[s] };
      last = s;
    }
    // recién entrado (poca densidad): al menos un stab, en compases alternos
    if (last < 0 && (d > 0.2 || b % 2 === 0)) {
      const w = (s) => this.w[s] + fastPenalty(s, cx.fast, 0.5);
      let best = 2;
      for (let s = 0; s < 16; s++) if (w(s) < w(best)) best = s;
      st[best] = { notes: ch.notes, len: this.len[best], vel: 0.8 };
    }
    return trimLens(st);
  }

  // pad: un evento por compás con el acorde y cuántos compases dura hasta su
  // siguiente cambio; el Deck decide si re-ataca o deja sonar el que ya hay
  padBar(b, d, e) {
    const cx = e.cx;
    const ch = this.chordAt(b, cx);
    const every = this.padEvery * cx.padStretch;
    let n = 1;
    while (n < 8 && (b + n) % every !== 0 && this.chordAt(b + n, cx).root === ch.root) n++;
    const st = new Array(16).fill(null);
    st[0] = { notes: ch.notes, bars: n, vel: 0.75 + 0.25 * d };
    return st;
  }
}

// `sty` = el ESTILO del universo (styles.js: rollStyle). Sin él (NORMAL), lo de siempre
export function makeGenerators(seed, sty = NORMAL) {
  const root = new Rng(seed);
  return {
    kick: new KickGen(root.fork(), sty),
    clap: new ClapGen(root.fork(), sty),
    hat: new HatGen(root.fork(), sty),
    ohat: new OHatGen(root.fork()),
    perc: new PercGen(root.fork(), sty),
    bass: new BassGen(root.fork(), sty),
    harmony: new HarmonyGen(root.fork(), sty),
    rng: root.fork(),
    foley: new FoleyGen(root.fork(), sty), // al final: los demás siguen saliendo iguales con la misma semilla
  };
}
