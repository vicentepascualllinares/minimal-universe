// ESTRUCTURA — el pad XY izquierdo decide QUIÉN suena.
//   +X+Y  TODO      +X-Y  DEEP (kick + bass)
//   -X-Y  NADA      -X+Y  NO DEEP (todo menos kick y bass)
// Cada instrumento tiene una "presencia" 0..1 (interpolación bilineal entre
// esquinas). Si supera su umbral entra; lo que sobra del umbral es su densidad.

import { clamp } from '../core/rng.js';

export const INSTRUMENTS = ['kick', 'bass', 'hat', 'perc', 'clap', 'ohat'];

const CORNERS = {
  //        nada  deep  nodeep todo
  kick: [0, 1, 0, 1],
  bass: [0, 1, 0, 1],
  hat:  [0, 0, 1, 1],
  perc: [0, 0, 1, 1],
  clap: [0, 0, 1, 1],
  ohat: [0, 0, 1, 1],
};

// orden de entrada: el kick primero, el open hat el último
const THRESHOLD = { kick: 0.12, bass: 0.3, hat: 0.22, perc: 0.38, clap: 0.48, ohat: 0.6 };
const HYST = 0.035;

export function presence(x, y) {
  const w = [(1 - x) * (1 - y), x * (1 - y), (1 - x) * y, x * y];
  const out = {};
  for (const k of INSTRUMENTS) {
    const c = CORNERS[k];
    out[k] = c[0] * w[0] + c[1] * w[1] + c[2] * w[2] + c[3] * w[3];
  }
  return out;
}

const wants = (k, current, p) => (current ? p > THRESHOLD[k] - HYST : p > THRESHOLD[k] + HYST);
const densityOf = (k, p) => clamp(((p - THRESHOLD[k]) / (1 - THRESHOLD[k])) * 1.15 + 0.1);

export const CORNER_WEIGHTS = (x, y) => ({
  nada: (1 - x) * (1 - y), deep: x * (1 - y), nodeep: (1 - x) * y, todo: x * y,
});

export class Arrangement {
  constructor() {
    this.x = 0.62; this.y = 0.14;
    this.state = {};
    for (const k of INSTRUMENTS) {
      this.state[k] = { target: false, pending: false, progress: 0, startAt: Infinity, density: 0, presence: 0, bars: 4 };
    }
  }
  set(x, y) { this.x = clamp(x); this.y = clamp(y); }

  // `nextBeat` = tiempo de la siguiente negra: las entradas/salidas se cuantizan ahí.
  // `bars` = duración de las transiciones que empiecen ahora (cada canal recuerda la suya).
  update(now, dt, barDur, bars, nextBeat) {
    const p = presence(this.x, this.y);
    for (const k of INSTRUMENTS) {
      const s = this.state[k];
      s.presence = p[k];
      const want = wants(k, s.target, p[k]);
      s.pending = want;
      if (want !== s.target) {
        s.target = want;
        s.bars = bars;
        const resting = s.progress <= 0 || s.progress >= 1;
        s.startAt = resting ? nextBeat : now; // si estaba a medias, invierte ya
      }
      s.density = densityOf(k, p[k]);
      if (now >= s.startAt) {
        const rate = dt / (barDur * s.bars);
        s.progress = clamp(s.progress + (s.target ? rate : -rate));
      }
    }
  }

  // Durante un LOOP: se calcula lo que pasaría, pero no se toca lo que suena.
  preview() {
    const p = presence(this.x, this.y);
    for (const k of INSTRUMENTS) {
      const s = this.state[k];
      s.presence = p[k];
      s.pending = wants(k, s.target, p[k]);
    }
  }

  // Salida instantánea del loop: todo salta a su sitio sin transición.
  snap() {
    const p = presence(this.x, this.y);
    for (const k of INSTRUMENTS) {
      const s = this.state[k];
      s.presence = p[k];
      s.target = s.pending = p[k] > THRESHOLD[k];
      s.progress = s.target ? 1 : 0;
      s.startAt = Infinity;
      s.density = densityOf(k, p[k]);
    }
  }

  // ¿debe programar notas este instrumento en el tiempo t?
  audible(k, t) {
    const s = this.state[k];
    return s.progress > 0.001 || (s.target && t >= s.startAt);
  }
}
