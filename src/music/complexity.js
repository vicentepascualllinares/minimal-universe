// COMPLEJIDAD — un control global por universo (0 simple .. 1 complejo).
// No toca el sonido: decide cuánta información musical hay. Con poca
// complejidad cada instrumento dice menos (menos notas, rejilla más lenta,
// menos variación) y los instrumentos se reparten el protagonismo; con mucha,
// semicorcheas, polimetría completa, progresiones y adornos.

import { clamp } from '../core/rng.js';

// instrumentos que compiten por la atención (el kick es el suelo y el pad el fondo)
// y cuánto ceden cuando hay demasiados a la vez (1 = cede todo lo necesario)
const YIELD = { perc: 1, chord: 0.9, ohat: 0.8, clap: 0.45, hat: 0.4, bass: 0.25 };

export function shapeComplexity(c, e) {
  const lo = 1 - c;
  const up = clamp(c * 2);              // 0 .. 1 en la mitad baja; a partir de 0.5, todo
  return {
    c,
    // 'emoción ajustada': lo que los generadores ya leían de e.gen
    gen: {
      density: clamp(e.gen.density * (0.6 + 0.8 * c)),
      fills: e.gen.fills * up,
      mutation: e.gen.mutation * (0.25 + 1.5 * c),
      ghostKick: e.gen.ghostKick * clamp(c * 2 - 0.4),
    },
    fast: lo,                            // castigo a las semicorcheas (rejilla rápida)
    percLanes: 1 + Math.round(3 * clamp((c - 0.1) / 0.8)), // 1..4 carriles de polimetría
    bassVariant: c > 0.3,                // variación del bajo cada 4 compases
    bassPitches: c < 0.3 ? 'root' : c < 0.55 ? 'few' : 'all',
    chordNotes: c < 0.25 ? 2 : c < 0.6 ? 3 : 4,
    chordGap: Math.round(2 + 4 * lo),    // pasos mínimos entre stabs
    progression: c > 0.35,               // con poca complejidad, un solo acorde
    padStretch: c < 0.4 ? 2 : 1,         // el pad respira más despacio
    clapExtras: c > 0.45,                // fantasmas y estilos raros del clap
    ohatExtra: c > 0.55,
    // protagonismo: cuántos instrumentos pueden ir "a tope" a la vez
    budget: 1.6 + 4.6 * c,
    // turnos: con poca complejidad, acordes y percusión esquivan los golpes de otros
    avoid: c < 0.6,
  };
}

// Reparte la densidad cuando hay más protagonistas que presupuesto.
// `dens` y `prog` = densidad y progreso (0..1) por instrumento.
export function shareDensity(dens, prog, budget) {
  let crowd = 0;
  for (const k in YIELD) crowd += prog[k] * Math.min(1, dens[k] * 1.4);
  const f = crowd > budget ? budget / crowd : 1;
  const out = { ...dens };
  for (const k in YIELD) out[k] = dens[k] * (1 - YIELD[k] * (1 - f));
  return out;
}
