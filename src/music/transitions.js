// TRANSICIONES — lo que pasa entre dos momentos de la ESTRUCTURA.
//
// Al pulsar una esquina el universo ya sabe de dónde sale, a dónde va y
// cuántos compases dura el viaje: con eso compone la transición (riser, ruido,
// redoble, impacto, platos, filtros). Todo sintetizado. Qué sonidos usa y
// cuánto los usa sale de la semilla del universo: su PALETA.
//
// Tipo de transición, según el kick y la música (bajo/acordes) de origen y destino:
//   build  entra el kick                → tensión creciente y DROP: la estructura se
//                                         aguanta y todo entra de golpe en el 1
//   lift   sigue el kick, entra música  → riser, redoble corto y plato (progresivo)
//   fall   se va el kick                → downfilter, reverse, golpe y caída (progresivo)
//   strip  sigue el kick, se va música  → reverse corto, redoble y plato (progresivo)
//   drift  sin kick (BREAK ↔ SIN DRUMS) → solo un barrido suave
//
// Cuantos más compases dura el viaje, más capas. El plan se escribe en
// COMPASES DEL VIAJE: u = 0 al empezar, u = L al llegar. El viaje siempre
// aterriza en el inicio de una frase (ver PHRASE).

import { Rng } from '../core/rng.js';

// frase en la que aterriza un viaje de `bars` compases (en compases)
export const PHRASE = (bars) => (bars <= 2 ? 4 : 8);

const music = (p) => Math.max(p.bass, p.chord);

// `from` / `to` = presencia de cada instrumento (ver arrangement.presence)
export function classify(from, to) {
  const k0 = from.kick, k1 = to.kick;
  const m0 = music(from), m1 = music(to);
  if (k1 - k0 > 0.5) return 'build';
  if (k0 - k1 > 0.5) return 'fall';
  if (k1 > 0.5) return m1 > m0 + 0.3 ? 'lift' : m0 > m1 + 0.3 ? 'strip' : 'none';
  return Math.abs(m1 - m0) > 0.3 || Math.abs(to.pad - from.pad) > 0.3 ? 'drift' : 'none';
}

// PALETA del universo: qué riser, qué redoble, qué golpe, cuánta tensión.
export function makePalette(seed) {
  const r = new Rng(seed ^ 0x2545f491);
  const pal = {
    amount: r.float(0.55, 1),                          // universos sobrios .. intensos
    riser: r.weighted(['noise', 'tone', 'both'], [3, 2, 3]),
    wave: r.pick(['sawtooth', 'sawtooth', 'square', 'triangle']),
    riseOct: r.pick([3, 3, 4]),                        // octavas sobre la tónica del kick
    riseSemis: r.pick([12, 12, 19, 24]),               // cuánto sube el riser
    noiseQ: r.float(0.7, 3.5),
    wobble: r.chance(0.35),                            // el riser late cada vez más rápido
    roll: r.weighted(['snare', 'clap', 'rim', 'tom'], [4, 2, 2, 2]),
    rollTone: r.float(150, 300),
    rollRise: r.pick([0, 0, 5, 7, 12]),                // semitonos que sube el redoble
    rollDecay: r.float(0.07, 0.16),
    snap: r.float(1500, 4500),
    boom: r.chance(0.75),                              // golpe grave afinado en la tónica
    thud: r.chance(0.6),                               // golpe de ruido sordo
    boomDrop: r.float(3, 8),
    boomDecay: r.float(0.6, 1.5),
    crashBase: r.float(320, 520),
    crashDecay: r.float(1.1, 2.4),
    crashMetal: r.float(0.2, 0.6),                     // metal .. ruido
    tensionHz: r.float(250, 800),                      // hasta dónde sube el HP en un build
    downHz: r.float(350, 1200),                        // hasta dónde baja el LP en un fall
    gap: r.chance(0.45) ? r.pick([0.5, 1, 1, 2]) : 0,  // tiempos de silencio antes del drop
    down: r.chance(0.65),                              // caída de ruido al llegar a un fall
  };
  if (!pal.boom && !pal.thud) pal.boom = true;
  return pal;
}

// Capas (u en compases del viaje):
//   riser / tension / down   sostenidas entre a y b
//   roll                     golpes que aceleran entre a y b
//   reverse                  plato al revés que termina en b
//   gap                      silencio entre a y la llegada
//   impact / crash / downlifter   al llegar
export function planTransition(kind, L, pal, r) {
  if (kind === 'none') return null;
  const layers = [];
  const add = (o) => layers.push(o);
  const opt = (p) => r.chance(p * (0.5 + 0.5 * pal.amount)); // capas opcionales: los sobrios usan menos
  const tier = L === 0 ? 0 : L <= 2 ? 1 : L <= 4 ? 2 : 3;

  if (kind === 'build') {
    const gap = tier >= 2 && pal.gap ? pal.gap / 4 : 0;
    const end = L - gap;
    if (tier >= 1) {
      add({ type: 'riser', a: L - Math.min(L, 16), b: end, gain: 1, noiseOnly: tier === 1 });
      const roll = tier === 1 ? (L === 1 ? 0.5 : 1) : tier === 2 ? r.pick([1, 2]) : Math.min(4, L / 2);
      add({ type: 'roll', a: L - roll, b: end, vel: 1 });
    }
    if (tier >= 2) add({ type: 'tension', a: L - Math.min(L, 8), b: L });
    if (gap) add({ type: 'gap', a: end });
    add({ type: 'impact', vel: 1 });
    add({ type: 'crash', vel: 1 });
  } else if (kind === 'lift') {
    if (tier >= 2) add({ type: 'riser', a: L - Math.min(L, tier === 2 ? 2 : 8), b: L, gain: 0.7 });
    if (tier >= 1) add({ type: 'roll', a: L - (tier === 1 ? 0.25 : tier === 2 ? 0.5 : 1), b: L, vel: 0.7 });
    add({ type: 'crash', vel: 0.9 });
    if (tier >= 2 && opt(0.6)) add({ type: 'impact', vel: 0.5 });
  } else if (kind === 'fall') {
    if (tier >= 2) add({ type: 'down', a: L - Math.min(L, tier === 2 ? 2 : 4), b: L });
    if (tier >= 1) add({ type: 'reverse', a: L - Math.min(L, tier === 3 && L >= 8 ? 2 : 1), b: L, vel: 0.9 });
    add({ type: 'impact', vel: 0.7 });
    if (tier >= 1 && pal.down) add({ type: 'downlifter', bars: tier === 1 ? 1 : tier === 2 ? 2 : 4, vel: 0.8 });
  } else if (kind === 'strip') {
    if (tier >= 2) add({ type: 'reverse', a: L - 1, b: L, vel: 0.6 });
    if (tier >= 1) add({ type: 'roll', a: L - 0.25, b: L, vel: 0.55 });
    if (tier >= 1 || opt(0.5)) add({ type: 'crash', vel: 0.7 });
  } else if (kind === 'drift') {
    if (tier >= 1) add({ type: 'reverse', a: L - Math.min(L, tier === 3 ? 2 : 1), b: L, vel: 0.55 });
    if (tier >= 1 && opt(0.5)) add({ type: 'downlifter', bars: 2, vel: 0.5 });
  }
  return layers.length ? { kind, L, layers, arrived: false } : null;
}
