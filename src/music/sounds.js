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

import { clamp, lerp } from '../core/rng.js';

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

// los otros tipos (VARIEDAD, ver kit.js): relativos al hat del universo, con su color
export function hatKind(e, kind) {
  const h = e.hat, t = kind.tone;
  const decay = (t.open ? e.ohat.decay : h.decay) * t.decay;
  return recipe(
    {
      engine: 'metal',
      base: h.base * t.base,
      noiseMix: clamp(h.noiseMix + t.noise, 0.05, 0.95),
      bp: Math.min(16000, h.bp * t.bp),
      hp: Math.min(12000, h.hp * t.hp),
      atk: 0.0008, tau: decay / 3.5, len: decay * 2.6 + 0.02,
    },
    { gain: t.gain, tail: t.open ? { self: true } : {} },
  );
}

// ───────────────────────── PERCUSIÓN (un carril = un sonido)
// `so` = el sonido del carril (generators.js), `freq` = su altura ya resuelta en la escala
export function percSound(e, so, freq) {
  const P = e.perc;
  const d = so.decay * P.decayMul;
  const env = { atk: 0.001, tau: d / 4, len: d * 1.8 + 0.03 };
  const p = so.type === 'tone' ? { engine: 'tone', freq, bend: so.bend, bendT: 0.018 + d * 0.15, wave: so.wave, ...env }
    : so.type === 'fm' ? { engine: 'fm', freq, ratio: lerp(so.ratioI, so.ratioH, P.harmonic), index: so.index * P.fmIndex, idxTau: d / 5, ...env }
    : { engine: 'noise', freq: so.nfreq * P.pitchMul, q: so.q, ...env };
  return recipe(p, { gain: 0.9, pan: so.pan });
}
