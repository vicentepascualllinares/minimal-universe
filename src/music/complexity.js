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

// ───────────────────────── OSCILADORES
// Cada grupo puede ir y venir entre su fader (A, el punto de partida) y una marca (B, el
// punto final; por encima o por debajo: el "al revés" lo da la marca). Solo cambia qué se
// toca, nunca la mutación ni la armonía.
//
// Se GUÍA, no se programa:
//  · un GESTO con nombre (REMATE, RESPIRA, PREGUNTA, BAILA, CRECE, OLA) = la forma
//  · la GUÍA DE TIEMPOS, dos ejes: VELOCIDAD (cada cuánto se mueve: 2 compases … pulso) y
//    TRAMO (en qué parte de la frase de 8 compases: toda, la 2ª mitad o el final)
// Cada gesto tiene variantes = puntos de partida de la guía; NUEVO UNIVERSO elige cuál.
//
// Por dentro todo se traduce a DOS NIVELES de 4 casillas que se multiplican (el 2º decide
// cuánto del 1º suena): nivel 1 = la forma a esa velocidad, nivel 2 = el tramo. Esas casillas
// se pueden retocar a mano en el editor (pulsación larga en la línea de la frase).
export const OSC_UNITS = {
  beat: { steps: 4, label: 'PULSO' },       // el ciclo dura 1 compás
  half: { steps: 8, label: '½ COMP.' },     // 2 compases
  bar: { steps: 16, label: 'COMPÁS' },      // 4 compases
  bar2: { steps: 32, label: '2 COMP.' },    // 8 compases: una frase
};
export const OSC_UNIT_ORDER = ['beat', 'half', 'bar', 'bar2'];
export const OSC_PATTERNS = [
  { name: 'A B A B', v: [0, 1, 0, 1] },
  { name: 'A A B B', v: [0, 0, 1, 1] },
  { name: 'A A A B', v: [0, 0, 0, 1] },
  { name: 'A B B B', v: [0, 1, 1, 1] },
  { name: 'RAMPA A → B', v: [0, 1 / 3, 2 / 3, 1] },
  { name: 'RAMPA B → A', v: [1, 2 / 3, 1 / 3, 0] },
  { name: 'TRIÁNGULO', v: [0, 0.5, 1, 0.5] },
];
// GUÍA DE TIEMPOS: velocidad (de lento a rápido) y tramo (de repartido a concentrado al final)
export const RATE_ORDER = ['bar2', 'bar', 'half', 'beat'];
export const ZONES = {
  all: { label: 'TODA LA FRASE', layer: null },
  half2: { label: '2ª MITAD', layer: { unit: 'bar2', pat: 1 } }, // A A B B cada 2 compases
  end: { label: 'FINAL', layer: { unit: 'bar2', pat: 2 } },       // A A A B: los 2 últimos
};
export const ZONE_ORDER = ['all', 'half2', 'end'];
// GESTOS: forma (patrón del nivel 1) y variantes [velocidad, tramo]
export const GESTURES = [
  { name: '—', shape: null, vars: [['bar2', 'all']] },
  { name: 'REMATE', shape: 2, vars: [['bar2', 'all'], ['bar', 'all'], ['beat', 'end']] },
  { name: 'RESPIRA', shape: 1, vars: [['bar2', 'all'], ['bar', 'all'], ['half', 'all']] },
  { name: 'PREGUNTA', shape: 0, vars: [['bar', 'all'], ['half', 'all']] },
  { name: 'BAILA', shape: 0, vars: [['beat', 'half2'], ['beat', 'end'], ['half', 'half2']] },
  { name: 'CRECE', shape: 4, vars: [['bar2', 'all'], ['bar', 'all']] },
  { name: 'OLA', shape: 6, vars: [['bar', 'all'], ['bar2', 'all'], ['beat', 'all']] },
];
// on = encendido (cada oscilador tiene su botón; el universo además puede silenciarlos todos).
// b = null: sin marca, la B sigue al fader y no oscila nada.
// gest = gesto · vars = qué variante toca de cada gesto en este universo · rate / zone = guía
// layers = los dos niveles que suenan: { on, unit, pat, custom } (custom = casillas pintadas a
// mano encima del patrón) · edited = retocado en el editor (se ve con un asterisco)
export function newOsc() {
  const o = { on: false, b: null, gest: 1, vars: GESTURES.map(() => 0), rate: 'bar2', zone: 'all', edited: false, layers: [] };
  return applyGesture(o, 1);
}
// traduce gesto + guía a los dos niveles (y borra lo retocado a mano)
export function compileOsc(o) {
  const G = GESTURES[o.gest];
  const Z = ZONES[o.zone].layer;
  o.layers = [
    { on: G.shape !== null, unit: o.rate, pat: G.shape ?? 0, custom: null },
    { on: G.shape !== null && !!Z, unit: Z ? Z.unit : 'bar2', pat: Z ? Z.pat : 2, custom: null },
  ];
  o.edited = false;
  return o;
}
// elegir gesto: la guía vuelve a la variante de este universo
export function applyGesture(o, i) {
  o.gest = i;
  const V = GESTURES[i].vars;
  [o.rate, o.zone] = V[o.vars[i] % V.length];
  return compileOsc(o);
}
export const layerCells = (L) => L.custom ?? OSC_PATTERNS[L.pat].v;
export const layerSlot = (L, step) => Math.floor(step / OSC_UNITS[L.unit].steps) % 4;
export const oscActive = (o) => o.on && o.b !== null && o.layers.some((L) => L.on);
// dónde está entre A (0) y B (1) en el paso absoluto `step`, aunque esté apagado
export function oscShape(o, step) {
  let w = 1, any = false;
  for (const L of o.layers) if (L.on) { w *= layerCells(L)[layerSlot(L, step)]; any = true; }
  return any ? w : 0;
}
// valor del fader del grupo en el paso absoluto `step` (a = el fader)
export function oscAt(o, a, step) {
  if (!oscActive(o)) return a;
  return a + (o.b - a) * oscShape(o, step);
}

// NUEVO UNIVERSO: cada grupo sale también con su oscilador: encendido o no, hacia dónde va B
// (arriba o abajo del fader nuevo), qué gesto y qué variante de cada gesto.
const GEST_IDX = GESTURES.map((_, i) => i);
const GEST_W = [0, 3, 2.5, 2, 2, 1.2, 1.2];
const ON_P = { kick: 0.3, perc: 0.55, bass: 0.45, inst: 0.45 };
export function randomOsc(rng, cx) {
  const out = {};
  for (const g of GROUPS) {
    const a = cx[g];
    const up = a < 0.3 ? true : a > 0.75 ? false : rng.chance(0.6);
    const o = {
      on: rng.chance(ON_P[g]),
      b: clamp(a + (up ? 1 : -1) * rng.float(0.2, 0.55)),
      vars: GESTURES.map((G) => rng.int(0, G.vars.length - 1)),
      edited: false,
      layers: [],
    };
    out[g] = applyGesture(o, rng.weighted(GEST_IDX, GEST_W));
  }
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
