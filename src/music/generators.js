// GENERADORES — cada instrumento tiene un "motivo" estable (memoria) que muta
// lentamente. La densidad nunca sortea golpes nuevos: activa pesos ya fijados,
// así subir y bajar la densidad es reversible y el groove no se rompe.
//
// Cada generador devuelve, por compás, un array de 16 pasos: null | evento.
// `e` llega con `e.gen` ya ajustado por la COMPLEJIDAD y con `e.cx` (ver complexity.js).

import { Rng, euclid, clamp } from '../core/rng.js';

const isDown = (s) => s % 4 === 0;
const isOff8 = (s) => s % 4 === 2;
// complejidad baja: las semicorcheas pesan más (entran tarde o nunca)
const fastPenalty = (s, f, amt) => (s % 2 === 1 ? amt * f : 0);

// ───────────────────────── KICK
export class KickGen {
  constructor(rng) { this.rng = rng; }
  bar(b, d, e) {
    const st = new Array(16).fill(null);
    for (const s of [0, 4, 8, 12]) st[s] = { vel: s === 0 ? 1 : 0.94 };
    const r = this.rng;
    // final de frase de 8: la clásica caída del kick en el último tiempo
    if (b % 8 === 7 && r.chance(e.gen.fills)) st[12] = null; // simple = negras sin caídas
    // kicks fantasma (tensión / euforia): groove roto
    if (r.chance(e.gen.ghostKick * 0.7)) st[r.pick([7, 10, 14, 15])] = { vel: 0.42 };
    if (e.cx.doubleGhost && r.chance(e.gen.ghostKick * 0.5)) st[r.pick([3, 6, 11])] = { vel: 0.36 };
    if (d < 0.25 && b % 2 === 1) st[8] = null; // muy poca presencia: respira
    return st;
  }
}

// ───────────────────────── CLAP
export class ClapGen {
  constructor(rng) {
    this.rng = rng;
    this.style = rng.weighted(['24', '4', '24ghost', 'late'], [5, 2, 2, 1.5]);
  }
  mutate() { this.style = this.rng.weighted(['24', '4', '24ghost', 'late'], [5, 2, 2, 1.5]); }
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

// ───────────────────────── HAT CERRADO
export class HatGen {
  constructor(rng) {
    this.rng = rng;
    this.roll();
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
  }
  bar(b, d, e) {
    const thr = 0.1 + 0.75 * d * e.gen.density; // nunca los 16 pasos: siempre huecos
    const st = new Array(16).fill(null);
    const f = e.cx.fast;
    for (let s = 0; s < 16; s++) {
      // simple = el "tss" en contratiempo; complejo = semicorcheas
      const w = this.w[s] + fastPenalty(s, f, 0.6) - (isOff8(s) ? 0.3 * f : 0);
      if (w < thr) st[s] = { vel: 1 - e.hat.accent * (1 - this.acc[s]) };
    }
    if (b % 8 === 7 && this.rng.chance(e.gen.fills * 0.6)) {
      for (let s = 12; s < 16; s++) st[s] = { vel: 0.35 + (s - 12) * 0.15 };
    }
    return st;
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
    const thr = 0.2 + 0.8 * d;
    [2, 6, 10, 14].forEach((s, i) => { if (this.w[i] < thr) st[s] = { vel: 0.85 + 0.15 * this.w[i] }; });
    if (this.extra !== null && e.cx.ohatExtra && d > 0.6) st[this.extra] = { vel: 0.5 };
    return st;
  }
}

// ───────────────────────── PERCUSIÓN GENERATIVA (polimetría)
// Hasta 4 carriles con longitudes distintas (16, 12, 7, 5...) que giran sobre
// el compás: el patrón resultante tarda mucho en repetirse = hipnosis.
function makePercSound(r) {
  const type = r.weighted(['tone', 'fm', 'noise'], [3, 4, 2.5]);
  return {
    type,
    deg: r.pick([0, 0, 2, 4, 4, 6, 7, 9, 11]),
    oct: r.pick([2, 3, 3, 4]),
    wave: r.pick(['sine', 'triangle', 'sine']),
    bend: r.float(0.15, 1.2),
    ratioH: r.pick([1, 2, 3, 0.5, 4]),
    ratioI: r.pick([1.414, 2.76, 3.53, 1.19, 4.33, 5.4]),
    index: r.float(0.5, 2),
    decay: type === 'noise' ? r.float(0.02, 0.07) : r.float(0.04, 0.22),
    nfreq: r.float(900, 6000),
    q: r.float(2, 14),
    pan: r.float(-0.75, 0.75),
  };
}

function makeLane(r, minD) {
  const len = r.weighted([16, 12, 10, 7, 6, 5, 3], [4, 2, 1, 2, 1, 1.5, 0.8]);
  const k = clamp(r.int(1, Math.ceil(len / 2)), 1, len);
  return {
    len, k, rot: r.int(0, len - 1), minD,
    hits: null, sound: makePercSound(r),
    acc: Array.from({ length: len }, () => r.float(0.4, 1)),
    prob: r.float(0.75, 1),
  };
}

export class PercGen {
  constructor(rng) {
    this.rng = rng;
    this.lanes = [0, 0.3, 0.55, 0.8].map((m) => makeLane(rng, m));
    this.lanes.forEach((l) => (l.hits = euclid(l.k, l.len, l.rot)));
  }
  mutate(strength = 1) {
    const r = this.rng;
    const l = r.pick(this.lanes);
    const op = r.weighted(['rot', 'k', 'sound', 'len'], [4, 3, 1.2 * strength, 0.8 * strength]);
    if (op === 'rot') l.rot = (l.rot + r.pick([1, -1, 2, 3])) % l.len;
    else if (op === 'k') l.k = clamp(l.k + r.pick([1, -1]), 1, Math.ceil(l.len * 0.6));
    else if (op === 'sound') l.sound = makePercSound(r);
    else {
      const nl = makeLane(r, l.minD);
      Object.assign(l, nl);
    }
    l.hits = euclid(l.k, l.len, l.rot);
  }
  // `abs` = número absoluto del primer paso del compás (para la polimetría)
  bar(b, d, e, abs) {
    const st = new Array(16).fill(null);
    const dd = d * (0.55 + 0.45 * e.gen.density);
    const fill = b % 8 === 7 && this.rng.chance(e.gen.fills * 0.7);
    const lanes = this.lanes.slice(0, e.cx.percLanes); // complejidad = cuántas capas de polimetría
    const f = e.cx.fast;
    for (let s = 0; s < 16; s++) {
      const evs = [];
      for (const l of lanes) {
        if (dd < l.minD) continue;
        const i = (abs + s) % l.len;
        if (s % 2 === 1 && l.acc[i] < 0.4 + 0.6 * f) continue; // menos semicorcheas
        const hit = l.hits[i] || (fill && s >= 12 && l === this.lanes[0] && this.rng.chance(0.6));
        if (hit && this.rng.chance(l.prob)) evs.push({ lane: l, vel: l.acc[i] });
      }
      if (evs.length) st[s] = evs;
    }
    return st;
  }
}

// ───────────────────────── BASS
// El motivo guarda GRADOS de escala, no notas: si la emoción cambia el modo
// (frigio → dórico...), la misma frase se recolorea sin perder identidad.
function makeBassMotif(r) {
  return Array.from({ length: 16 }, (_, s) => {
    const cat = isOff8(s) ? 0.3 : s % 2 === 1 ? 0.5 : s === 0 ? 1.1 : 0.85;
    return {
      w: clamp(cat + r.float(-0.28, 0.28), 0, 1.2),
      deg: r.weighted([0, 7, 4, 6, 2, 1, 3, -3], [10, 3.5, 2.5, 2, 1.5, 1, 1, 1]),
      len: r.weighted([1, 2, 3], [6, 2.5, 1]),
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
  constructor(rng) {
    this.rng = rng;
    this.home = makeBassMotif(rng);
    const first = this.home.find((n) => n.w < 0.5); // la primera nota fuerte, tónica
    if (first) first.deg = 0;
    this.variant = this.derive(this.home, 2);
  }
  derive(m, changes) {
    const r = this.rng;
    const v = m.map((n) => ({ ...n }));
    for (let i = 0; i < changes; i++) {
      const s = r.int(1, 15);
      if (r.chance(0.6)) v[s].deg = r.pick([0, 7, 4, 6, 2, 9, 11]);
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
    // recortar duraciones para que no se solapen (bajo monofónico)
    let prev = null;
    for (let s = 0; s < 16; s++) {
      if (!st[s]) continue;
      if (prev !== null) st[prev].len = Math.min(st[prev].len, s - prev);
      prev = s;
    }
    return st;
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

export class HarmonyGen {
  constructor(rng) {
    this.rng = rng;
    this.voicing = rng.pick(VOICINGS);
    this.prog = rng.weighted(PROGS, PROG_W);
    this.alt = rng.weighted(ALTS, ALT_W);
    this.padEvery = rng.pick([2, 4, 4]); // cada cuántos compases respira el pad
    this.rollRhythm();
  }
  // ritmo de los stabs: los contratiempos entran antes, el tiempo fuerte lo deja al kick
  rollRhythm() {
    const r = this.rng;
    this.w = Array.from({ length: 16 }, (_, s) => {
      const cat = isOff8(s) ? 0.25 : s % 2 === 1 ? 0.55 : isDown(s) ? 0.9 : 0.6;
      return clamp(cat + r.float(-0.3, 0.3));
    });
    this.len = Array.from({ length: 16 }, () => r.weighted([1, 2, 3, 6], [5, 3, 1.5, 0.7]));
  }
  mutate() {
    const r = this.rng;
    const op = r.weighted(['rhythm', 'alt', 'prog', 'voicing'], [4, 2, 1.5, 0.8]);
    if (op === 'rhythm') {
      for (let i = 0; i < 2; i++) {
        const s = r.int(0, 15);
        this.w[s] = clamp(this.w[s] + r.float(-0.35, 0.35));
        this.len[s] = r.weighted([1, 2, 3, 6], [5, 3, 1.5, 0.7]);
      }
    } else if (op === 'alt') this.alt = r.weighted(ALTS, ALT_W);
    else if (op === 'prog') this.prog = r.weighted(PROGS, PROG_W);
    else this.voicing = r.pick(VOICINGS);
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
    let prev = null;
    for (let s = 0; s < 16; s++) {
      if (!st[s]) continue;
      if (prev !== null) st[prev].len = Math.min(st[prev].len, s - prev);
      prev = s;
    }
    return st;
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

export function makeGenerators(seed) {
  const root = new Rng(seed);
  return {
    kick: new KickGen(root.fork()),
    clap: new ClapGen(root.fork()),
    hat: new HatGen(root.fork()),
    ohat: new OHatGen(root.fork()),
    perc: new PercGen(root.fork()),
    bass: new BassGen(root.fork()),
    harmony: new HarmonyGen(root.fork()),
    rng: root.fork(),
  };
}
