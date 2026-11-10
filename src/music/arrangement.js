// ESTRUCTURA — 8 PARTES: los momentos de un tema, uno por botón. Se llaman por lo que son en
// la estructura (minimal, rominimal, deep house, techno, experimental), no por lo que suena:
// más adelante la parte decidirá también arreglos, mezcla y transiciones.
//
//   sin kick  │ BREAK   DRIFT   BUILD   KICK-OUT
//   con kick  │ INTRO   GROOVE  MAIN    DROP
//
// Rejilla 2×4, como los pads de un controlador (8 por universo). Arriba no hay kick y abajo sí
// (bajar = entra el kick). Parejas: KICK-OUT es el DROP sin kick y BUILD, el MAIN sin graves.
//   INTRO     la pista de entrada (y de salida): batería seca para mezclar
//   GROOVE    el «roller» hipnótico, el corazón del rominimal: donde el tema vive más tiempo
//   MAIN      el groove lleno antes del pico: todo el ritmo y los acordes asomando, sin pad
//   DROP      el pico: todo dentro
//   BREAK     el breakdown: cae la batería y manda la atmósfera
//   DRIFT     lo experimental / ambient: flota sin rejilla marcada, bajo y armonía suspendidos
//   BUILD     la subida: sin graves, arriba el ritmo; pide un drop
//   KICK-OUT  el bajo sigue rodando sin kick: tensión antes de que vuelva
//
// Cada escena dice cuánto suena cada instrumento (presencia 0..1). Lo que suena
// (`cur`) viaja de una escena a otra en N compases (o al instante); en el viaje
// la presencia se interpola y cada instrumento entra o sale poco a poco: al pasar
// su umbral su cantidad crece (con filtro o volumen, a su manera, y densidad).
// El viaje se mide en pasos de la rejilla (16 por compás) y aterriza siempre en
// el inicio de una frase. Tres FORMAS de viaje (las elige TRANSICIÓN):
//   SUAVE       todos a la vez, a lo largo de todo el viaje
//   ESCALONADA  uno tras otro, cada uno con su barrido corto y llegando en su compás
//               (ver stagger): primero lo que sale, luego lo que entra; de adorno a cimiento
//   DE GOLPE    (`drop`) aguanta el origen y salta al destino de golpe en el 1

import { clamp } from '../core/rng.js';

export const INSTRUMENTS = ['kick', 'bass', 'hat', 'perc', 'clap', 'ohat', 'chord', 'pad'];

const ALL_DRUMS = { kick: 1, hat: 1, perc: 1, clap: 1, ohat: 1 };
const NO_DRUMS = { kick: 0, hat: 0, perc: 0, clap: 0, ohat: 0 };
const TOPS = { hat: 1, perc: 1, clap: 0.9, ohat: 0.75 };

const EMPTY = { kick: 0, bass: 0, hat: 0, perc: 0, clap: 0, ohat: 0, chord: 0, pad: 0 };
// una parte = su nombre y sus DOS VERSIONES (1 y 2): dos posibilidades del mismo momento del
// tema. La 1 es la de siempre. Lo que no se nombra en una versión NO suena en ella (presencia 0)
const scene = (label, v1, v2) => ({ label, mixes: [{ ...EMPTY, ...v1 }, { ...EMPTY, ...v2 }] });

export const SCENES = {
  // ── sin kick
  break: scene('BREAK',
    { pad: 1, chord: 0.45, hat: 0.3 },                                  // manda el pad: acordes flojos y un hat lejano
    { pad: 1, chord: 1, hat: 0.3, perc: 0.6 }),                         // acordes enteros y algo de percusión
  drift: scene('DRIFT',
    { bass: 1, chord: 1, pad: 0.85 },                                   // bajo y armonía flotando, sin batería
    { bass: 1, chord: 1, pad: 0.85, hat: 0.4, perc: 0.6 }),             // con pulso: hats lejanos y percusión
  build: scene('BUILD',
    { ...TOPS, chord: 0.9, pad: 0.6 },                                  // el ritmo arriba, sin kick ni bajo
    { hat: 1, perc: 1, chord: 0.9, pad: 0.6 }),                         // sin clap ni open hat
  kickout: scene('KICK-OUT',
    { ...ALL_DRUMS, kick: 0, bass: 1, chord: 0.9, pad: 0.6 },           // el DROP sin kick
    { bass: 1, hat: 1, perc: 1, chord: 0.9 }),                          // bajo, hats, percusión y acordes
  // ── con kick
  intro: scene('INTRO',
    { kick: 1, hat: 0.85, perc: 0.4 },                                  // kick y hats secos, algo de percusión
    { kick: 1, ...TOPS }),                                              // toda la batería (el antiguo SOLO DRUMS)
  groove: scene('GROOVE',
    { kick: 1, bass: 1, hat: 1, perc: 0.5 },                            // el roller: kick, bajo, hats
    { kick: 1, bass: 1, ...TOPS }),                                     // toda la batería y bajo, sin música
  main: scene('MAIN',
    { ...ALL_DRUMS, bass: 1, clap: 0.9, ohat: 0.75, chord: 0.6 },       // todo el ritmo, acordes suaves, sin pad
    { ...ALL_DRUMS, bass: 1, clap: 0.9, ohat: 0.75, chord: 0.95 }),     // acordes enteros, aún sin pad
  drop: scene('DROP',
    { ...ALL_DRUMS, bass: 1, chord: 0.9, pad: 0.6 },                    // todo
    { ...ALL_DRUMS, bass: 1, chord: 1, pad: 0.95 }),                    // todo, con acordes y pad enteros
};

// mezcla de una parte en una versión (0 = la 1, 1 = la 2)
export const mixOf = (name, v = 0) => SCENES[name].mixes[v];

// orden de los botones: fila de arriba (sin kick) y fila de abajo (con kick)
export const GRID = [
  ['break', 'drift', 'build', 'kickout'],
  ['intro', 'groove', 'main', 'drop'],
];

// capas que tiene una parte en una versión (para pintar K B T M en su botón)
export const LAYERS = (name, v = 0) => {
  const m = mixOf(name, v);
  return {
    K: m.kick > 0.5,
    B: m.bass > 0.5,
    T: Math.max(m.hat, m.perc, m.clap, m.ohat) > 0.5,
    M: Math.max(m.chord, m.pad) > 0.5,
  };
};

// cuánto se parece una presencia a una parte en una versión (1 = es esa)
export function likeness(p, name, v = 0) {
  const m = mixOf(name, v);
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

// ESCALONADA: orden en que cambian, de adorno a cimiento (el kick, el último)
const ORDER = { pad: 0, ohat: 1, perc: 2, chord: 3, hat: 4, clap: 5, bass: 6, kick: 7 };

// Plan de un viaje ESCALONADO de `bars` compases: para cada instrumento que cambia,
// [empieza, llega] en fracción del viaje. Los que cambian se reparten en tramos (uno por
// compás si caben; en viajes de 1–2 compases, medios compases) y cada uno barre al final de
// su tramo: llega justo en su límite. `nudge` = empujón al orden (sale de la paleta).
export function stagger(from, to, bars, nudge = {}) {
  const ch = INSTRUMENTS.filter((k) => Math.abs(to[k] - from[k]) > 0.05)
    .map((k) => ({ k, w: (to[k] < from[k] ? 0 : 10) + ORDER[k] + (nudge[k] || 0) }))
    .sort((a, b) => a.w - b.w);
  const n = ch.length;
  const plan = {};
  if (!n || !bars) return plan;
  const unit = bars >= 4 ? 1 : 0.5;
  const S = Math.min(n, bars / unit);
  const edge = (j) => Math.round((j * bars) / S / unit) * unit; // límites de tramo, en compases
  ch.forEach(({ k }, i) => {
    const j = Math.floor((i * S) / n);
    const a = edge(j), b = edge(j + 1);
    const sweep = Math.min(b - a, Math.max(1, (b - a) / 4));
    plan[k] = [(b - sweep) / bars, b / bars];
  });
  return plan;
}

export class Arrangement {
  constructor(name = 'drop') {
    this.home = name;    // la escena elegida (el último clic); al soltar un CORTE se vuelve aquí
    this.target = name;  // a dónde va lo que suena (en LOOP: lo que entrará al soltar)
    // VERSIÓN (0 = la 1, 1 = la 2): la del universo entero; cualquier parte a la que se vaya
    // llega en esta versión (ver Deck.setVersion)
    this.version = 0;
    this.cur = { ...mixOf(name) }; // presencia que suena ahora
    this.travel = null;
    this.frozen = false; // LOOP: lo que suena no se mueve
    this.state = {};
    for (const k of INSTRUMENTS) {
      this.state[k] = { progress: 0, density: 0, presence: 0, target: false, pending: false };
    }
    this.compute();
  }

  // viajar a una escena en `bars` compases (0 = instantáneo), empezando en el paso `startStep`.
  // `drop` (DE GOLPE): no se mueve durante el viaje; salta al destino de golpe al llegar.
  // `stagger` (ESCALONADA): el empujón al orden de la paleta; null = SUAVE
  goTo(name, bars, startStep, { drop = false, stagger: nudge = null } = {}) {
    this.target = name;
    const from = { ...this.cur }, to = { ...mixOf(name, this.version) };
    this.travel = {
      name, bars, startStep, done: 0, paused: false, drop, from, to,
      steps: nudge && !drop ? stagger(from, to, bars, nudge) : null,
    };
  }

  // VERSIÓN cambiada a mitad de un viaje: el viaje sigue (mismo inicio, misma duración, mismos
  // FX) pero llega a la otra versión. Sin saltos: cada instrumento sigue desde donde está ahora.
  //   aún no ha empezado a moverse  → solo cambia a dónde va
  //   a medio camino                → se recalcula de dónde «venía» para que la curva pase por
  //                                   donde está y acabe en el destino nuevo
  //   ya había llegado (ESCALONADA) → se mueve otra vez, en lo que queda de viaje
  // DE GOLPE: no se mueve hasta llegar; solo cambia el destino
  retarget() {
    const T = this.travel;
    if (!T) return;
    const to = mixOf(T.name, this.version);
    if (!T.drop) {
      for (const k of INSTRUMENTS) {
        if (Math.abs(to[k] - T.to[k]) < 1e-6) continue;
        const w = T.steps?.[k];
        const x = w ? clamp((T.done - w[0]) / (w[1] - w[0])) : T.done;
        const sx = smooth(x);
        if (sx <= 0) continue;
        if (sx < 1 - 1e-3) { T.from[k] = (this.cur[k] - to[k] * sx) / (1 - sx); continue; }
        T.from[k] = this.cur[k];
        T.steps ||= {};
        T.steps[k] = [T.done, Math.max(1, T.done + 1e-3)];
      }
    }
    T.to = { ...to };
  }

  // ¿el viaje aún no ha movido nada y acaba donde ya suena? (p. ej. VERSIÓN pulsada dos veces
  // antes de empezar): entonces sobra
  idleTravel() {
    const T = this.travel;
    if (!T || T.done > 0) return false;
    return INSTRUMENTS.every((k) => Math.abs(T.to[k] - this.cur[k]) < 1e-3);
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
    this.cur = { ...mixOf(this.target, this.version) };
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
        for (const k of INSTRUMENTS) {
          const w = T.steps?.[k]; // ESCALONADA: cada uno en su tramo
          const x = w ? clamp((T.done - w[0]) / (w[1] - w[0])) : T.done;
          this.cur[k] = T.from[k] + (T.to[k] - T.from[k]) * smooth(x);
        }
        if (T.done >= 1) this.travel = null;
      } else if (T.done >= 1) return this.land(); // por si el paso de llegada no lo hizo
    }
    this.compute();
  }

  compute() {
    const pt = mixOf(this.target, this.version);
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
