// KIT — CANTIDAD y VARIEDAD de HATS, PERCS y FOLEY, dos perillas por grupo bajo su nombre (abajo
// del universo). Independientes de la COMPLEJIDAD: ella decide CÓMO se toca (semicorcheas o
// corcheas, redobles, cuánto mutan los motivos, el clap); el kit decide CUÁNTO y CON QUÉ.
//
//   CANTIDAD  cuántos golpes da cada tipo de sonido. Centro = lo de siempre; izquierda, casi
//             nada (un golpe suelto); derecha, casi todos los pasos.
//   VARIEDAD  cuántos sonidos distintos (timbres) hay: de 1 a 5. El último en entrar lo hace
//             poco a poco (primero sus golpes más fuertes), así girarla nunca da saltos.
//             HATS: el hat del universo (cerrado + su abierto) y luego FINO, OSCURO, TICK y
//             MEDIO, en un orden que sale de la semilla. PERCS: los carriles de percusión
//             polimétrica (cada uno con su sonido y su longitud). FOLEY: los objetos (papel,
//             llaves, gota, tela, taza, clic de boca), cada uno en su carril escaso.
//
// Las dos son 0..1 con el centro arriba (0,5 = lo normal). NUEVO UNIVERSO las sortea alrededor
// del centro, como los faders de complejidad.

import { clamp, lerp } from '../core/rng.js';

export const KIT_GROUPS = ['hat', 'perc', 'foley'];
export const MAX_VARIETY = 5;

export const newKit = () => ({ hat: { amt: 0.5, vary: 0.5 }, perc: { amt: 0.5, vary: 0.5 }, foley: { amt: 0.5, vary: 0.5 } });

// CANTIDAD → multiplicador de densidad (centro = ×1)
export const amountMul = (a) => (a <= 0.5 ? lerp(0.15, 1, a / 0.5) : lerp(1, 1.9, (a - 0.5) / 0.5));

// VARIEDAD → cuántos timbres (1..5, continuo) y cuánto está cada uno (i = 0 siempre entero)
export const varietyCount = (v) => 1 + (MAX_VARIETY - 1) * v;
export const presence = (v, i) => clamp(varietyCount(v) - i);
// lo que se enseña: los que se oyen (el que entra cuenta desde que da algún golpe)
export const varietyShown = (v) => Math.min(MAX_VARIETY, Math.floor(varietyCount(v) - 0.35) + 1);

export function randomKit(r) {
  return {
    hat: { amt: r.float(0.3, 0.7), vary: r.float(0.1, 0.75) },
    perc: { amt: r.float(0.3, 0.7), vary: r.float(0.25, 0.85) },
    foley: { amt: r.float(0.3, 0.7), vary: r.float(0.15, 0.75) }, // (al final: lo demás sale igual)
  };
}

// ───────────────────────── TIPOS DE HAT (VARIEDAD)
// Cada universo saca los cuatro con su propio timbre (relativo al hat del universo, que se
// mueve con su color) y los ordena a su manera: en uno el 2º hat es un FINO, en otro un TICK.
//   ch    canal donde suena: 'hat' (cerrados) u 'ohat' (abiertos: se cortan a sí mismos)
//   cat   peso base de cada paso (bajo = entra antes): dónde vive en el compás
export const HAT_KINDS = {
  // semicorcheas finas y brillantes, casi ruido: el "shaker"
  fino: {
    ch: 'hat', label: 'FINO',
    cat: (s) => (s % 2 === 1 ? 0.3 : 0.75),
    tone: (r) => ({ base: r.float(1.2, 1.6), noise: r.float(0.15, 0.3), bp: r.float(1.15, 1.35), hp: r.float(1.1, 1.3), decay: r.float(0.45, 0.75), gain: r.float(0.5, 0.62) }),
  },
  // más grave y algo más largo, en negras y corcheas: el "chick" del pedal
  oscuro: {
    ch: 'hat', label: 'OSCURO',
    cat: (s) => (s % 4 === 0 ? 0.35 : s % 4 === 2 ? 0.55 : 0.85),
    tone: (r) => ({ base: r.float(0.55, 0.8), noise: r.float(-0.25, -0.1), bp: r.float(0.55, 0.75), hp: r.float(0.6, 0.75), decay: r.float(1.1, 1.6), gain: r.float(0.62, 0.75) }),
  },
  // un clic metálico cortísimo justo antes del tiempo
  tick: {
    ch: 'hat', label: 'TICK',
    cat: (s) => (s % 4 === 3 ? 0.3 : s % 4 === 1 ? 0.6 : 0.85),
    tone: (r) => ({ base: r.float(0.9, 1.3), noise: r.float(-0.5, -0.3), bp: r.float(0.8, 1.1), hp: r.float(0.9, 1.1), decay: r.float(0.35, 0.55), gain: r.float(0.55, 0.68) }),
  },
  // medio abierto, a contrapié: su cola la corta su siguiente golpe
  medio: {
    ch: 'ohat', label: 'MEDIO',
    cat: (s) => ([3, 7, 11, 14].includes(s) ? 0.3 : s % 2 === 1 ? 0.6 : 0.85),
    tone: (r) => ({ base: r.float(0.8, 1.2), noise: r.float(-0.15, 0.15), bp: r.float(0.8, 1.1), hp: r.float(0.85, 1), decay: r.float(0.35, 0.6), gain: r.float(0.5, 0.62), open: true }),
  },
};
// (su receta con el color de ahora: hatKind en sounds.js)

// ───────────────────────── MOTOR de cada tipo de hat (fase 2 del taller)
// Cada universo sortea con qué motor suena cada tipo, según su papel, y los números fijos de ese
// motor (los que no siguen al color). El hat del universo (el 1º) sigue siendo el metal 808.
//   metal   6 cuadradas inarmónicas: las del 808 o un juego propio del universo
//   fm      2 osciladores en FM a proporción inarmónica (Machinedrum, Noise Engineering)
//   hiss    ruido tipo 909/707 con resonancia, a veces con los 6 u 8 bits de las máquinas
//   cymbal  plato de resonadores (mcld): suena a plato "de verdad"
//   grains  granos de ruido (shaker, cabasa: PhISEM)
export const HAT_ENGINE_WEIGHTS = {
  fino: { metal: 1, fm: 1, hiss: 1.5, grains: 2.5 },
  oscuro: { metal: 2, fm: 1.5, cymbal: 1.2, hiss: 0.6 },
  tick: { metal: 1.5, fm: 2, hiss: 1.2, cymbal: 0.8 },
  medio: { metal: 1.5, cymbal: 2, hiss: 2, fm: 1 },
};

// un número al azar lejos de los enteros y de las mitades (proporciones inarmónicas)
const inharm = (r, a, b) => {
  for (;;) {
    const x = r.float(a, b);
    const f = (x * 2) % 1;
    if (f > 0.12 && f < 0.88) return Math.round(x * 1000) / 1000;
  }
};

export function drawHatEngine(r, name) {
  const W = HAT_ENGINE_WEIGHTS[name];
  const engine = r.weighted(Object.keys(W), Object.values(W));
  if (engine === 'metal') {
    // 808 (las de siempre) o un juego propio: 6 parciales entre 1 y ~4
    if (r.chance(0.4)) return { engine };
    const ratios = [1];
    for (let i = 1; i < 6; i++) ratios.push(Math.round((ratios[i - 1] + r.float(0.18, 0.75)) * 1000) / 1000);
    return { engine, ratios };
  }
  if (engine === 'fm') return { engine, cr: r.float(4, 9), ratio: inharm(r, 1.25, 3.8), index: r.float(1.8, 5.5), noise: r.float(0.04, 0.18) };
  if (engine === 'hiss') return { engine, res: r.float(2, 10), peak: r.float(0.2, 0.9), bits: r.weighted([0, 6, 8], [2, 1.5, 1]) };
  if (engine === 'cymbal') return { engine, plate: r.int(1, 2 ** 30), lo: r.float(0.35, 0.8), ring: r.float(0.6, 1.5), tilt: r.float(-0.2, 0.5), wash: r.float(0.1, 0.5), exc: r.float(0.001, 0.004) };
  return { engine, q: r.float(1.5, 6), f: r.float(0.45, 0.85), f2: r.chance(0.5) ? r.float(1.2, 1.6) : 0, rate: r.float(400, 1500), gtau: r.float(0.0005, 0.0015), shake: r.float(0.015, 0.035) };
}
