// RECETAS de hats y percs: qué es cada sonido, en números, con el color de ahora.
// Solo datos (nada de audio): el banco (src/audio/soundBank.js) las graba con el taller
// (src/audio/drumsynth.js) y cada golpe reproduce la grabación.
//
// Una receta = { p, key, tail, gain, pan }
//   p     parámetros del taller (motor + envolvente + etapas comunes; ver drumsynth.js)
//   key   p redondeado en texto: misma clave = mismo sonido = se graba una sola vez
//   tail  COLAS: { self } = su siguiente golpe corta la cola del anterior (el mismo plato);
//         { chokes: [ranuras] } = este golpe corta las colas de esas ranuras (el cerrado al abierto)
//   gain  nivel del golpe (lo pone la reproducción, no la grabación)
//   pan   panorama (lo pone la ranura: un panoramizador fijo por sonido)
//
// El REDONDEO va a la medida del oído: altura a 1/96 de octava (~6 cents), filtros y tiempos a
// 1/24 de octava (~3 %), el resto a ~2 %. No se oye, y la deriva lenta del color no vuelve a
// grabar el sonido a cada momento (además, una ranura cambia de grabación como mucho dos veces
// por segundo por el color: ver DrumSlots.set).

import { Rng, clamp, lerp } from '../core/rng.js';

const PITCH = new Set(['base', 'freq']);
const LOG24 = new Set(['bp', 'hp', 'len', 'atk', 'tau', 'bendT', 'idxTau', 'gate']);
const ABS = new Set(['noiseMix', 'velTone', 'jitter', 'drive', 'amt']); // 0..1: pasos de 0,02
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const qLog = (v, steps) => (v > 0 ? Math.pow(2, Math.round(Math.log2(v) * steps) / steps) : v < 0 ? -qLog(-v, steps) : 0);

function quantize(p) {
  const q = {};
  for (const k of Object.keys(p).sort()) {
    const v = p[k];
    if (typeof v !== 'number') q[k] = v && typeof v === 'object' && !Array.isArray(v) ? quantize(v) : v;
    else if (Number.isInteger(v)) q[k] = v; // bits, down...
    else q[k] = r6(PITCH.has(k) ? qLog(v, 96) : LOG24.has(k) ? qLog(v, 24) : ABS.has(k) ? Math.round(v * 50) / 50 : qLog(v, 36));
  }
  return q;
}
const keyOf = (p) => JSON.stringify(p);

function recipe(p, extra) {
  const q = quantize(p);
  return { p: q, key: keyOf(q), tail: {}, gain: 1, pan: 0, ...extra };
}

// ───────────────────────── HATS
// el hat del universo: cerrado y su abierto (el mismo plato: el cerrado le corta la cola)
export function hatMain(e, open) {
  const h = e.hat;
  const decay = open ? e.ohat.decay : h.decay;
  return recipe(
    { engine: 'metal', base: h.base, noiseMix: h.noiseMix, bp: h.bp, hp: h.hp, atk: 0.0008, tau: decay / 3.5, len: decay * 2.6 + 0.02 },
    { tail: open ? {} : { chokes: ['ohat'] } },
  );
}

// los otros tipos (VARIEDAD, ver kit.js): relativos al hat del universo, con su color, y cada uno
// con el motor que le tocó (kind.eng, ver drawHatEngine). Los motores nuevos salen a su nivel
// (KIND_LVL: el de los hats de antes de ese tipo, medido) y con dos capas: el golpe flojo, más
// oscuro y algo más corto
const KIND_LVL = { fino: 0.15, oscuro: 0.11, tick: 0.05, medio: 0.18 };
export function hatKind(e, kind) {
  const h = e.hat, t = kind.tone, g = kind.eng || { engine: 'metal' };
  const decay = (t.open ? e.ohat.decay : h.decay) * t.decay;
  const bp = Math.min(16000, h.bp * t.bp), hp = Math.min(12000, h.hp * t.hp);
  const env = { atk: 0.0008, tau: decay / 3.5, len: decay * 2.6 + 0.02 };
  const extra = { gain: t.gain, tail: t.open ? { self: true } : {} };
  if (g.engine === 'metal') {
    const p = { engine: 'metal', base: h.base * t.base, noiseMix: clamp(h.noiseMix + t.noise, 0.05, 0.95), bp, hp, ...env };
    if (g.ratios) p.ratios = g.ratios; // sin ratios: el 808 de siempre (idéntico a antes)
    return recipe(p, extra);
  }
  const lvl = KIND_LVL[kind.name], velTone = 0.4;
  const p = g.engine === 'fm' ? { engine: 'fmhat', freq: h.base * t.base * g.cr, ratio: g.ratio, index: g.index, noise: g.noise, hp, ...env }
    : g.engine === 'hiss' ? { engine: 'hiss', hp, res: g.res, bp, peak: g.peak, bits: g.bits, ...env }
    : g.engine === 'cymbal' ? { engine: 'cymbal', plate: g.plate, lo: hp * g.lo, hp: hp * 0.8, ring: decay * g.ring * 0.4, tilt: g.tilt, wash: g.wash, exc: g.exc, ...env, tau: decay / 2.8 }
    : grainsHat(h, g, bp);
  return recipe({ ...p, atk: p.atk ?? 0.0005, lvl, velTone }, extra);
}
// shaker / cabasa: su largo es el de la sacudida (no el del hat), que el color estira o encoge
function grainsHat(h, g, bp) {
  const shake = g.shake * Math.sqrt(h.decay / 0.05);
  const freq = Math.min(14000, bp * g.f);
  return { engine: 'grains', freq, freq2: g.f2 ? Math.min(16000, freq * g.f2) : 0, q: g.q, rate: g.rate, gtau: g.gtau, shake, atk: 0.003, tau: shake, len: shake * 4 + 0.02 };
}

// ───────────────────────── PERCUSIÓN (un carril = un sonido)
// `so` = el sonido del carril (generators.js), `freq` = su altura ya resuelta en la escala
export function percSound(e, so, freq) {
  const P = e.perc;
  const d = so.decay * P.decayMul;
  const env = { atk: 0.001, tau: d / 4, len: d * 1.8 + 0.03 };
  const p = so.type === 'tone' ? { engine: 'tone', freq, bend: so.bend, bendT: 0.018 + d * 0.15, wave: so.wave, ...env }
    : so.type === 'fm' ? { engine: 'fm', freq, ratio: lerp(so.ratioI, so.ratioH, P.harmonic), index: so.index * P.fmIndex, idxTau: d / 5, ...env }
    : so.type === 'noise' ? { engine: 'noise', freq: so.nfreq * P.pitchMul, q: so.q, ...env }
    : percNew(P, so, freq);
  return recipe(p, { gain: 0.9, pan: so.pan });
}

// ───────────────────────── PERCUSIÓN, motores nuevos (fase 2)
// Los números fijos de cada sonido salen de su semilla (`so.timbre`): el mismo carril suena
// siempre igual; el color mueve el largo (decayMul), la altura (pitchMul, ya en `freq`) y, en
// los modales, lo "madera" o "metal" (harmonic). La altura del carril (su grado de la escala) se
// lleva por octavas al registro de cada instrumento; el salto de octava se decide sin el color,
// así la deriva lenta nunca lo cruza (no salta una octava de golpe)
const PERC_LVL = 0.5;   // tonales: el nivel de las percs de tono y FM de antes, algo por debajo
const NOISY_LVL = 0.25; // ruido y clics: el de las de ruido de antes
function inReg(freq, pm, lo, hi) {
  let k = 1;
  const f0 = freq / pm;
  while (f0 * k < lo) k *= 2;
  while (f0 * k > hi && f0 * k / 2 >= lo) k /= 2;
  return freq * k;
}
function percNew(P, so, freq) {
  const r = new Rng(so.timbre);
  const dm = P.decayMul, pm = P.pitchMul;
  if (so.type === 'reso') {
    const voice = r.weighted(['rim', 'clave', 'conga'], [1, 1, 1.2]);
    if (voice === 'rim') { // dos modos (455 y 1667 Hz en la 808) + palo + algo de saturación
      const ring = r.float(0.012, 0.03) * dm;
      return { engine: 'reso', freq: inReg(freq, pm, 380, 640), ratios: [1, r.float(3.4, 3.9)], gains: [1, r.float(0.5, 0.9)], decays: [1, 0.6], ring, excW: 0.00015, click: { amt: r.float(0.15, 0.4), hp: 4000 }, drive: r.float(0.2, 0.5), atk: 0.0002, tau: ring * 2, len: Math.min(1, ring * 6 + 0.02), lvl: PERC_LVL, velTone: 0.5 };
    }
    if (voice === 'clave') {
      const ring = r.float(0.03, 0.07) * dm;
      return { engine: 'reso', freq: inReg(freq, pm, 1800, 3200), ratios: [1], gains: [1], decays: [1], ring, excW: 0.0002, atk: 0.0002, tau: ring * 2, len: Math.min(1, ring * 6 + 0.02), lvl: PERC_LVL, velTone: 0.5 };
    }
    const ring = r.float(0.08, 0.2) * dm; // conga: grave, con la altura que cae al golpear
    return { engine: 'reso', freq: inReg(freq, pm, 160, 420), ratios: [1, r.float(1.45, 1.6)], gains: [1, r.float(0.15, 0.35)], decays: [1, 0.5], ring, excW: r.float(0.0006, 0.0012), bend: r.float(0.12, 0.35), bendT: r.float(0.01, 0.03), atk: 0.0003, tau: ring * 2, len: Math.min(1, ring * 6 + 0.02), lvl: PERC_LVL, velTone: 0.5 };
  }
  if (so.type === 'bell') { // cowbell 808
    const f = inReg(freq, pm, 480, 760), tau = r.float(0.04, 0.1) * dm;
    return { engine: 'bell', freq: f, ratio: 1.4395, bp: f * r.float(1.3, 1.8), q: r.float(1.5, 3.5), punch: r.float(0.4, 0.75), atk: 0.0005, tau, len: tau * 5 + 0.02, lvl: PERC_LVL * 0.8 };
  }
  if (so.type === 'modal') {
    const mat = r.weighted(['madera', 'barra', 'tubo'], [2, 1.5, 1]);
    const M = {
      madera: { ratios: [1, 3.93, 9.2], decays: [1, 0.3, 0.12], ring: [0.02, 0.06], reg: [400, 1600] },
      barra: { ratios: [1, 4, 10], decays: [1, 0.4, 0.2], ring: [0.06, 0.18], reg: [250, 1000] },
      tubo: { ratios: [1, 2.76, 5.4, 8.93], decays: [1, 0.7, 0.5, 0.35], ring: [0.1, 0.3], reg: [300, 1400] },
    }[mat];
    const ring = r.float(...M.ring) * dm;
    const up = lerp(1.25, 0.55, P.harmonic); // metal: los modos altos duran más; madera, menos
    return { engine: 'modal', freq: inReg(freq, pm, ...M.reg), ratios: M.ratios, gains: M.ratios.map((_, k) => (k ? r.float(0.4, 0.9) : 1)), decays: M.decays.map((x, k) => (k ? x * up : x)), ring, hard: r.float(0.35, 0.9), atk: 0.0004, tau: ring * 2, len: Math.min(1.2, ring * 5 + 0.02), lvl: PERC_LVL, velTone: 0.5 };
  }
  if (so.type === 'ks') { // tic de madera afinado: poca realimentación
    const ring = r.float(0.012, 0.06) * dm;
    return { engine: 'ks', freq: inReg(freq, pm, 200, 1500), ring, bright: r.float(0.3, 0.9), drive: r.float(0.15, 0.4), atk: 0.0002, tau: ring * 3, len: ring * 6 + 0.02, lvl: PERC_LVL, velTone: 0.5 };
  }
  if (so.type === 'glitch') {
    const spread = r.float(0.003, 0.025);
    return { engine: 'glitch', freq: inReg(freq, pm, 1500, 6000), n: r.int(1, 5), spread, blen: r.float(0.002, 0.005), bits: r.weighted([0, 6, 8], [2, 1, 1]), down: r.weighted([1, 2, 3], [2, 1, 1]), atk: 0.0001, tau: 1, len: spread + 0.008, lvl: NOISY_LVL };
  }
  // grains: semillas, maraca
  const shake = r.float(0.02, 0.05) * dm;
  return { engine: 'grains', freq: inReg(freq, pm, 900, 5000), freq2: 0, q: r.float(3, 10), rate: r.float(300, 1500), gtau: r.float(0.0005, 0.002), shake, atk: 0.002, tau: shake, len: shake * 4 + 0.02, lvl: NOISY_LVL };
}
