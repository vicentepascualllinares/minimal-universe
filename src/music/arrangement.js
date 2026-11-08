// ESTRUCTURA — el pad XY izquierdo: los MOMENTOS de un tema.
//
//   SIN DRUMS ┌───────────┐ TODO          X = ritmo   (derecha: drums)
//             │           │               Y = música  (arriba: bajo, acordes, pad)
//   BREAK     └───────────┘ SOLO DRUMS
//
// Cada borde es una transición típica: subida (derecha), quitar el kick
// (arriba), quedarse en la atmósfera (izquierda), entrada del groove (abajo).
//
// Cada instrumento tiene una presencia 0..1 (mezcla bilineal de las esquinas).
// Al pasar su umbral NO entra de golpe: su cantidad crece poco a poco (filtro
// o volumen, según TRANSICIÓN, y densidad) hasta llegar a la esquina.
//
// La posición que suena (x, y) persigue al cursor (tx, ty). Al pulsar el
// nombre de una esquina, viaja hasta ella en N compases (se puede pausar);
// mover el cursor cancela el viaje.

import { clamp } from '../core/rng.js';

export const INSTRUMENTS = ['kick', 'bass', 'hat', 'perc', 'clap', 'ohat', 'chord', 'pad'];

// posición de cada esquina en el pad
export const CORNERS = {
  break: { x: 0, y: 0, label: 'BREAK' },
  drums: { x: 1, y: 0, label: 'SOLO DRUMS' },
  sindrums: { x: 0, y: 1, label: 'SIN DRUMS' },
  todo: { x: 1, y: 1, label: 'TODO' },
};

// cuánto de cada instrumento hay en cada esquina
const MIX = {
  //      break drums sindrums todo
  kick:  [0,    1,    0,    1],
  hat:   [0.3,  1,    0,    1],     // en el break queda un hat lejano y filtrado
  clap:  [0,    0.9,  0,    1],
  ohat:  [0,    0.75, 0,    1],
  perc:  [0.5,  1,    0,    1],     // la percusión da movimiento al break
  bass:  [0,    0,    1,    1],
  chord: [0.35, 0,    1,    0.9],
  pad:   [1,    0,    0.85, 0.6],   // manda en el break, se aparta cuando entra todo
};

// [umbral donde empieza a oírse, presencia en la que llega a tope]
const RAMP = {
  kick: [0.1, 0.8], bass: [0.12, 0.8], hat: [0.15, 0.9], perc: [0.22, 0.95],
  clap: [0.35, 0.95], ohat: [0.4, 0.95], chord: [0.25, 0.95], pad: [0.2, 0.95],
};

const weights = (x, y) => [(1 - x) * (1 - y), x * (1 - y), (1 - x) * y, x * y];

export function presence(x, y) {
  const w = weights(x, y);
  const out = {};
  for (const k of INSTRUMENTS) {
    const c = MIX[k];
    out[k] = c[0] * w[0] + c[1] * w[1] + c[2] * w[2] + c[3] * w[3];
  }
  return out;
}

export const CORNER_WEIGHTS = (x, y) => {
  const w = weights(x, y);
  return { break: w[0], drums: w[1], sindrums: w[2], todo: w[3] };
};

const smooth = (t) => t * t * (3 - 2 * t);
// cantidad 0..1: crece de forma progresiva desde el umbral hasta la esquina
const amountOf = (k, p) => {
  const [thr, full] = RAMP[k];
  return smooth(clamp((p - thr) / (full - thr)));
};
const densityOf = (a) => clamp(0.15 + 0.95 * a);

const FOLLOW = 0.12; // s: el sonido sigue al cursor casi al instante, sin saltos

export class Arrangement {
  constructor() {
    this.x = this.tx = 0.85; // arranca cerca de SOLO DRUMS, con algo de bajo
    this.y = this.ty = 0.25;
    this.travel = null;
    this.frozen = false; // LOOP: lo que suena no se mueve
    this.state = {};
    for (const k of INSTRUMENTS) {
      this.state[k] = { progress: 0, density: 0, presence: 0, target: false, pending: false };
    }
    this.compute();
  }

  // el cursor se movió a mano: cancela cualquier viaje
  set(x, y) {
    this.tx = clamp(x); this.ty = clamp(y);
    this.travel = null;
  }

  // viajar a una esquina en `bars` compases (0 = instantáneo), empezando en `startAt`
  goTo(name, bars, startAt) {
    const c = CORNERS[name];
    this.tx = c.x; this.ty = c.y;
    this.travel = {
      name, bars, startAt, done: 0, paused: false,
      from: { x: this.x, y: this.y }, to: { x: c.x, y: c.y },
    };
  }
  // viaje a la posición del cursor (salida progresiva del LOOP)
  travelToTarget(bars, startAt) {
    this.travel = {
      name: null, bars, startAt, done: 0, paused: false,
      from: { x: this.x, y: this.y }, to: { x: this.tx, y: this.ty },
    };
  }
  togglePause() { if (this.travel && this.travel.bars > 0) this.travel.paused = !this.travel.paused; }

  // salida instantánea del LOOP: salta al cursor
  snap() {
    this.travel = null;
    this.x = this.tx; this.y = this.ty;
    this.compute();
  }

  // `dt` = tiempo real; `playDt` = 0 en pausa (los viajes solo avanzan sonando)
  update(now, dt, playDt, barDur) {
    if (!this.frozen) {
      const T = this.travel;
      if (T) {
        if (now >= T.startAt) {
          if (T.bars === 0) {
            this.x = T.to.x; this.y = T.to.y;
            this.travel = null;
          } else {
            if (!T.paused) T.done = Math.min(1, T.done + playDt / (barDur * T.bars));
            const s = smooth(T.done);
            this.x = T.from.x + (T.to.x - T.from.x) * s;
            this.y = T.from.y + (T.to.y - T.from.y) * s;
            if (T.done >= 1) this.travel = null;
          }
        }
      } else {
        const k = 1 - Math.exp(-dt / FOLLOW);
        this.x += (this.tx - this.x) * k;
        this.y += (this.ty - this.y) * k;
      }
    }
    this.compute();
  }

  compute() {
    const p = presence(this.x, this.y);
    const pt = presence(this.tx, this.ty);
    for (const k of INSTRUMENTS) {
      const s = this.state[k];
      const a = amountOf(k, p[k]);
      s.presence = p[k];
      s.progress = a;
      s.density = densityOf(a);
      s.target = a > 0.001;
      s.pending = amountOf(k, pt[k]) > 0.001; // lo que sonará al llegar al cursor
    }
  }

  // ¿debe programar notas este instrumento?
  audible(k) { return this.state[k].progress > 0.001; }
}
