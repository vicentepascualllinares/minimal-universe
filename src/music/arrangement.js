// ESTRUCTURA — 8 ESCENAS: los momentos de un tema, uno por botón.
//
//   sin kick  │ BREAK       SIN DRUMS    SIN GRAVES   SIN KICK
//   con kick  │ SOLO DRUMS  ESQUELETO    SIN BAJO     TODO
//
// Rejilla 2×4, como los pads de un controlador (8 por universo). Arriba no hay
// kick y abajo sí: en las dos columnas de la derecha, la de abajo es la de arriba
// con kick (bajar = DROP, subir = kick-out).
//
// Cada escena dice cuánto suena cada instrumento (presencia 0..1). Lo que suena
// (`cur`) viaja de una escena a otra en N compases (o al instante); en el viaje
// la presencia se interpola y cada instrumento entra o sale poco a poco: al pasar
// su umbral su cantidad crece (filtro o volumen, según TRANSICIÓN, y densidad).
// El viaje se mide en pasos de la rejilla (16 por compás) y aterriza siempre en
// el inicio de una frase. Un viaje `drop` (entra el kick) aguanta el origen y
// salta al destino de golpe en el 1.

import { clamp } from '../core/rng.js';

export const INSTRUMENTS = ['kick', 'bass', 'hat', 'perc', 'clap', 'ohat', 'chord', 'pad'];

const ALL_DRUMS = { kick: 1, hat: 1, perc: 1, clap: 1, ohat: 1 };
const NO_DRUMS = { kick: 0, hat: 0, perc: 0, clap: 0, ohat: 0 };
const TOPS = { hat: 1, perc: 1, clap: 0.9, ohat: 0.75 };

const scene = (label, mix) => ({ label, mix: { kick: 0, bass: 0, hat: 0, perc: 0, clap: 0, ohat: 0, chord: 0, pad: 0, ...mix } });

export const SCENES = {
  // ── sin kick
  break: scene('BREAK', { hat: 0.3, perc: 0.5, chord: 0.35, pad: 1 }),       // atmósfera: manda el pad, un hat lejano
  sindrums: scene('SIN DRUMS', { ...NO_DRUMS, bass: 1, chord: 1, pad: 0.85 }),
  singraves: scene('SIN GRAVES', { ...TOPS, chord: 0.9, pad: 0.75 }),        // el groove arriba, sin kick ni bajo
  sinkick: scene('SIN KICK', { ...ALL_DRUMS, kick: 0, bass: 1, chord: 0.9, pad: 0.6 }), // kick-out: el bajo sigue rodando
  // ── con kick
  drums: scene('SOLO DRUMS', { kick: 1, ...TOPS }),
  esqueleto: scene('ESQUELETO', { kick: 1, bass: 1, hat: 1, perc: 0.4 }),    // el núcleo del rominimal
  sinbajo: scene('SIN BAJO', { ...ALL_DRUMS, chord: 0.9, pad: 0.6 }),
  todo: scene('TODO', { ...ALL_DRUMS, bass: 1, chord: 0.9, pad: 0.6 }),
};

// orden de los botones: fila de arriba (sin kick) y fila de abajo (con kick)
export const GRID = [
  ['break', 'sindrums', 'singraves', 'sinkick'],
  ['drums', 'esqueleto', 'sinbajo', 'todo'],
];

// capas que tiene una escena (para pintar K B T M en su botón)
export const LAYERS = (name) => {
  const m = SCENES[name].mix;
  return {
    K: m.kick > 0.5,
    B: m.bass > 0.5,
    T: Math.max(m.hat, m.perc, m.clap, m.ohat) > 0.5,
    M: Math.max(m.chord, m.pad) > 0.5,
  };
};

// cuánto se parece una presencia a una escena (1 = es esa escena)
export function likeness(p, name) {
  const m = SCENES[name].mix;
  let d = 0;
  for (const k of INSTRUMENTS) d += Math.abs(p[k] - m[k]);
  return 1 - d / INSTRUMENTS.length;
}

// [umbral donde empieza a oírse, presencia en la que llega a tope]
const RAMP = {
  kick: [0.1, 0.8], bass: [0.12, 0.8], hat: [0.15, 0.9], perc: [0.22, 0.95],
  clap: [0.35, 0.95], ohat: [0.4, 0.95], chord: [0.25, 0.95], pad: [0.2, 0.95],
};

const smooth = (t) => t * t * (3 - 2 * t);
// cantidad 0..1: crece de forma progresiva desde el umbral hasta la escena
const amountOf = (k, p) => {
  const [thr, full] = RAMP[k];
  return smooth(clamp((p - thr) / (full - thr)));
};
const densityOf = (a) => clamp(0.15 + 0.95 * a);

export class Arrangement {
  constructor(name = 'todo') {
    this.home = name;    // la escena elegida (el último clic); al soltar un CORTE se vuelve aquí
    this.target = name;  // a dónde va lo que suena (en LOOP: lo que entrará al soltar)
    this.cur = { ...SCENES[name].mix }; // presencia que suena ahora
    this.travel = null;
    this.frozen = false; // LOOP: lo que suena no se mueve
    this.state = {};
    for (const k of INSTRUMENTS) {
      this.state[k] = { progress: 0, density: 0, presence: 0, target: false, pending: false };
    }
    this.compute();
  }

  // viajar a una escena en `bars` compases (0 = instantáneo), empezando en el paso `startStep`.
  // `drop`: no se mueve durante el viaje; salta al destino de golpe al llegar
  goTo(name, bars, startStep, drop = false) {
    this.target = name;
    this.travel = {
      name, bars, startStep, done: 0, paused: false, drop,
      from: { ...this.cur }, to: { ...SCENES[name].mix },
    };
  }

  // LOOP: solo cambia lo que entrará al soltar
  setTarget(name) {
    this.target = name;
    this.travel = null;
  }
  // salida progresiva del LOOP
  travelToTarget(bars, startStep) { this.goTo(this.target, bars, startStep); }
  // salida instantánea del LOOP
  snap() {
    this.travel = null;
    this.cur = { ...SCENES[this.target].mix };
    this.compute();
  }

  // llegada de golpe al destino del viaje (DROP / instantáneo)
  land() {
    const T = this.travel;
    if (!T) return;
    this.travel = null;
    this.cur = { ...T.to };
    this.compute();
  }

  // `pos` = paso de la rejilla que suena ahora (null en pausa: los viajes solo avanzan sonando)
  update(pos) {
    const T = this.travel;
    if (!this.frozen && T) {
      if (pos !== null && !T.paused && pos >= T.startStep) {
        if (T.bars === 0) return this.land();
        T.done = clamp((pos - T.startStep) / (T.bars * 16));
      }
      if (!T.drop) {
        const s = smooth(T.done);
        for (const k of INSTRUMENTS) this.cur[k] = T.from[k] + (T.to[k] - T.from[k]) * s;
        if (T.done >= 1) this.travel = null;
      } else if (T.done >= 1) return this.land(); // por si el paso de llegada no lo hizo
    }
    this.compute();
  }

  compute() {
    const pt = SCENES[this.target].mix;
    for (const k of INSTRUMENTS) {
      const s = this.state[k];
      const a = amountOf(k, this.cur[k]);
      s.presence = this.cur[k];
      s.progress = a;
      s.density = densityOf(a);
      s.target = a > 0.001;
      s.pending = amountOf(k, pt[k]) > 0.001; // lo que sonará al llegar
    }
  }

  // ¿debe programar notas este instrumento?
  audible(k) { return this.state[k].progress > 0.001; }
}
