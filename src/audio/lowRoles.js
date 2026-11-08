// EASY EQ · GRAVES — la perilla LOW no es una banda: reparte dos PAPELES, KICK y BAJO.
//
// Una mesa normal solo ve frecuencias; aquí cada universo tiene su kick y su bajo por
// separado. En la mezcla suena como mucho UN kick y UN bajo:
//   - si un papel solo lo tiene un universo, suena (y sigue la curva de la banda LOW, sin hueco)
//   - si lo tienen los dos, suena solo el de su DUEÑO. El dueño cambia en un punto de la
//     perilla que depende del sentido de giro: de A a B, primero el bajo (40 %) y luego el kick
//     (60 %); de B a A, igual pero al revés (el bajo de A vuelve en el 60 %, el kick en el 40 %).
//     Así el centro nunca choca: el kick del que se va con el bajo del que llega.
//   - el cambio espera al siguiente tiempo (nunca se pisan ni entra a destiempo)
//   - SIDECHAIN CRUZADO: el kick que suena empuja al bajo que suena, venga de donde venga
// Sin EASY EQ (o en UN UNIVERSO) todo es como siempre: cada universo con lo suyo.

import { easyGains } from './strip.js';

const ROLES = ['kick', 'bass'];
const SWAP = { bass: 0.4, kick: 0.6 }; // girando de A a B; de B a A, en 1 − SWAP
const HAS = 0.05; // un universo "tiene" un papel si su instrumento suena por encima de esto

export class LowRoles {
  constructor(engine) {
    this.E = engine;
    this.x = 0;                        // posición de la perilla LOW
    this.owner = { kick: 0, bass: 0 }; // dueño de cada papel cuando lo tienen los dos (0 = A, 1 = B)
    this.applied = null;               // ganancias de papel que suenan: [{kick, bass}, {kick, bass}]
  }

  // la perilla se mueve: solo cambia de dueño hacia donde se gira
  move(x) {
    if (x > this.x) { for (const r of ROLES) if (x >= SWAP[r]) this.owner[r] = 1; }
    else if (x < this.x) { for (const r of ROLES) if (x <= 1 - SWAP[r]) this.owner[r] = 0; }
    this.x = x;
  }

  has(d, r) { return d.arr.state[r].progress > HAS; }

  // ganancia de papel que toca a cada universo ahora
  desired() {
    const E = this.E, D = E.decks;
    const g = [{ kick: 1, bass: 1 }, { kick: 1, bass: 1 }];
    if (!E.easyOn) return g;
    for (const r of ROLES) {
      if (!this.has(D[0], r) || !this.has(D[1], r)) continue;
      const o = this.owner[r];
      g[1 - o][r] = 0;
    }
    return g;
  }

  // en cada tiempo (o ya, si no suena): los papeles pedidos pasan a sonar, con rampa corta
  apply(t) {
    if (this.E.mode !== 'dj') return;
    const want = this.desired();
    this.E.decks.forEach((d, i) => {
      for (const r of ROLES) {
        if (this.applied && this.applied[i][r] === want[i][r]) continue;
        d.ch?.[r].role.gain.setTargetAtTime(want[i][r], t, 0.003);
      }
    });
    this.applied = want;
  }

  // se rehízo el audio: los nodos nuevos empiezan en 1, hay que volver a escribirlo todo
  reset() { this.applied = null; }

  // ¿hay un cambio de dueño esperando al siguiente tiempo?
  pending() {
    if (!this.applied) return false;
    const w = this.desired();
    return w.some((g, i) => ROLES.some((r) => g[r] !== this.applied[i][r]));
  }

  // cuánto suena el kick de un universo en la mezcla (papel × banda LOW)
  kickLevel(d) {
    const E = this.E;
    if (!E.easyOn) return 1;
    const i = E.decks.indexOf(d);
    return (this.applied?.[i].kick ?? 1) * easyGains('lo', E.xf.lo)[i];
  }

  // SIDECHAIN: el kick de `from` (con profundidad `depth`) empuja al bajo que suena
  duck(from, t, depth) {
    const E = this.E;
    if (!E.easyOn) return from.duckBass(t, depth);
    const lv = this.kickLevel(from);
    E.decks.forEach((d, i) => {
      if ((this.applied?.[i].bass ?? 1) <= 0 || !this.has(d, 'bass')) return;
      d.duckBass(t, depth * lv);
    });
  }

  // para la vista: de dónde sale cada papel ahora ('A', 'B' o '')
  info() {
    const E = this.E, D = E.decks;
    const g = this.applied ?? this.desired();
    const band = easyGains('lo', E.xf.lo);
    const src = (r) => [0, 1].filter((i) => this.has(D[i], r) && g[i][r] > 0 && band[i] > 0.01).map((i) => 'AB'[i]).join('+');
    return { kick: src('kick'), bass: src('bass'), pending: this.pending() };
  }
}
