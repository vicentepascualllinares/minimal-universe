// COMPLEJIDAD — cuánta información musical dice cada parte del universo.
// No toca el sonido. Cuatro grupos con su propio fader y un GLOBAL que los
// escala a todos en proporción (bajar el global simplifica el universo entero
// sin perder su carácter: unos percs juguetones siguen siendo lo más movido).
//
//   KICK   simple: negras rectas            máximo: kicks fantasma y caídas de frase
//   PERCS  simple: hat en contratiempo      máximo: semicorcheas, 4 capas, redobles
//   BASS   simple: tónica y octava          máximo: todas las notas, variaciones
//   INSTR. simple: un acorde de 2 notas     máximo: progresión, 4 notas, stabs seguidos

import { clamp } from '../core/rng.js';

export const GROUPS = ['kick', 'perc', 'bass', 'inst'];
export const GROUP_LABEL = { kick: 'KICK', perc: 'PERCS', bass: 'BASS', inst: 'INSTR.' };
// qué instrumentos pertenecen a cada grupo
export const GROUP_OF = { kick: 'kick', hat: 'perc', ohat: 'perc', clap: 'perc', perc: 'perc', bass: 'bass', chord: 'inst', pad: 'inst' };

// instrumentos que compiten por la atención (el kick es el suelo y el pad el fondo)
// y cuánto ceden cuando hay demasiados a la vez (1 = cede todo lo necesario)
const YIELD = { perc: 1, chord: 0.9, ohat: 0.8, clap: 0.45, hat: 0.4, bass: 0.25 };

const dens = (c) => clamp(0.35 + 0.65 * c);

// `cx` = { kick, perc, bass, inst, global } (0..1, lo que marcan los faders)
export function shapeComplexity(cx) {
  const G = cx.global;
  const eff = (g) => clamp(cx[g] * G); // lo que de verdad se aplica
  const k = eff('kick'), p = eff('perc'), b = eff('bass'), i = eff('inst');
  return {
    eff: { kick: k, perc: p, bass: b, inst: i },
    kick: {
      gen: { density: 1, fills: 0.6 * k, mutation: 0, ghostKick: 0.55 * clamp((k - 0.35) / 0.65) },
      cx: { doubleGhost: k > 0.8 },
    },
    perc: {
      gen: { density: dens(p), fills: clamp(p * 1.2), mutation: 0.06 + 0.45 * p },
      cx: {
        fast: 1 - p,                                         // castigo a las semicorcheas
        percLanes: 1 + Math.round(3 * clamp((p - 0.1) / 0.8)), // 1..4 capas de polimetría
        clapExtras: p > 0.45,                                // fantasmas y estilos desplazados
        clapRolls: p > 0.5,                                  // redobles al final de frase
        longRolls: p > 0.8,                                  // redoble largo de semicorcheas
        ohatExtra: p > 0.55,
      },
    },
    bass: {
      gen: { density: dens(b), mutation: 0.04 + 0.4 * b },
      cx: {
        fast: 1 - b,
        bassVariant: b > 0.3,
        bassPitches: b < 0.3 ? 'root' : b < 0.55 ? 'few' : 'all',
      },
    },
    inst: {
      gen: { density: dens(i), mutation: 0.04 + 0.4 * i },
      cx: {
        fast: 1 - i,
        chordNotes: i < 0.25 ? 2 : i < 0.6 ? 3 : 4,
        chordGap: Math.round(2 + 6 * (1 - i)), // pasos mínimos entre stabs
        progression: i > 0.35,                  // con poca complejidad, un solo acorde
        padStretch: i < 0.4 ? 2 : 1,            // el pad respira más despacio
      },
    },
    // protagonismo: cuántos instrumentos pueden ir "a tope" a la vez
    budget: 1.6 + 4.6 * G,
    // turnos: con poca complejidad global, acordes y percusión esquivan los golpes de otros
    avoid: G < 0.6,
  };
}

// Reparte la densidad cuando hay más protagonistas que presupuesto.
// `dens` y `prog` = densidad y progreso (0..1) por instrumento.
export function shareDensity(densIn, prog, budget) {
  let crowd = 0;
  for (const k in YIELD) crowd += prog[k] * Math.min(1, densIn[k] * 1.4);
  const f = crowd > budget ? budget / crowd : 1;
  const out = { ...densIn };
  for (const k in YIELD) out[k] = densIn[k] * (1 - YIELD[k] * (1 - f));
  return out;
}

// NUEVO UNIVERSO: cada grupo sale con su propio carácter
export function randomComplexity(rng) {
  return {
    kick: rng.float(0.05, 0.75),
    perc: rng.float(0.2, 0.95),
    bass: rng.float(0.15, 0.9),
    inst: rng.float(0.15, 0.85),
  };
}
