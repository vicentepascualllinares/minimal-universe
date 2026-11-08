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
// Sin EASY EQ (o en UN UNIVERSO) todo es como siempre: cada universo con lo suyo. Salvo dos
// cosas. Una: SIDECHAIN CRUZADO también con la EQ normal, cuando un universo tiene un bajo
// sonando sin kick propio y el otro un kick sonando (ver duck). Otra: al pasar de EASY a la EQ normal, los silencios de papel que había (p. ej. el bajo de A
// callado porque suena el de B) se HEREDAN, porque la EQ normal no puede expresar "kick de A +
// bajo de B". Cada uno se suelta, en el siguiente tiempo, cuando el otro universo deja de
// sonar en ese papel (bajas su LOW o su fader, o cambia a una escena sin él): así el cambio
// de bajo hecho a mano lo completa el programa. También si mueves el LOW del universo callado
// (lo reclamas: quieres oírlo). Si no se toca nada, suena igual siempre. Con la música
// parada (antes de GENERAR o en PAUSA) no se hereda nada: cada universo vuelve a lo suyo.

import { easyGains, bandGain, faderGain } from './strip.js';

const LABEL = { kick: 'KICK', bass: 'BAJO' };

const ROLES = ['kick', 'bass'];
const SWAP = { bass: 0.4, kick: 0.6 }; // girando de A a B; de B a A, en 1 − SWAP
const HAS = 0.05; // un universo "tiene" un papel si su instrumento suena por encima de esto

export class LowRoles {
  constructor(engine) {
    this.E = engine;
    this.x = 0;                        // posición de la perilla LOW
    this.owner = { kick: 0, bass: 0 }; // dueño de cada papel cuando lo tienen los dos (0 = A, 1 = B)
    this.applied = null;               // ganancias de papel que suenan: [{kick, bass}, {kick, bass}]
    this.held = [];                    // silencios heredados de EASY en la EQ normal: [{ i, r }]
  }

  // EASY → normal: los papeles callados se heredan
  leaveEasy() {
    this.held = [];
    if (!this.E.playing) return; // parado (antes de GENERAR o en PAUSA): no hay nada que respetar
    const lo = this.E.mix.map((m) => m.lo); // LOW de cada canal ya traducido
    this.applied?.forEach((g, i) => { for (const r of ROLES) if (g[r] <= 0) this.held.push({ i, r, v: lo[i] }); });
  }

  // normal → EASY: la perilla ya está traducida (E.xf.lo); `la`, `lb` = graves de A y de B.
  // Si los dos suenan en un papel, su dueño es el de más graves (empate: kick A, bajo B)
  enterEasy(la, lb) {
    const E = this.E, D = E.decks;
    this.held = [];
    this.x = E.xf.lo;
    for (const r of ROLES) {
      const both = this.has(D[0], r) && this.has(D[1], r) && la > 0.05 && lb > 0.05;
      if (!both) this.owner[r] = this.x > 0.5 ? 1 : 0;
      else if (Math.abs(la - lb) < 0.05 * Math.max(la, lb)) this.owner[r] = r === 'kick' ? 0 : 1;
      else this.owner[r] = la > lb ? 0 : 1;
    }
  }

  // con la EQ normal: ¿el universo o suena en el papel r? (lo tiene, no está callado y su
  // banda LOW y su fader lo dejan oír)
  soundsIn(o, r) {
    const E = this.E, m = E.mix[o];
    return this.has(E.decks[o], r) && (this.applied?.[o][r] ?? 1) > 0
      && faderGain(m.fader) * bandGain(m.lo, E.eqType) > 0.05;
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
    if (!E.easyOn) { // EQ normal: solo los silencios heredados que aún hacen falta (el otro
      // sigue sonando en ese papel) y que nadie ha reclamado (tocar el LOW del callado lo suelta)
      this.held = this.held.filter((h) => this.soundsIn(1 - h.i, h.r) && Math.abs(E.mix[h.i].lo - h.v) < 0.02);
      for (const h of this.held) g[h.i][h.r] = 0;
      return g;
    }
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

  // cuánto suena el kick de un universo en la mezcla (papel × banda LOW de EASY)
  kickLevel(d) {
    const E = this.E;
    const i = E.decks.indexOf(d);
    const role = E.mode === 'dj' ? (this.applied?.[i].kick ?? 1) : 1;
    return E.easyOn ? role * easyGains('lo', E.xf.lo)[i] : role;
  }

  // cuánto deja oír la mesa (EQ normal) los graves del universo o: fader × banda LOW, hasta 1
  mixLow(o) {
    const m = this.E.mix[o];
    return Math.min(1, faderGain(m.fader) * bandGain(m.lo, this.E.eqType));
  }

  // SIDECHAIN: el kick de `from` (con profundidad `depth`) empuja al bajo que suena. Cruzado
  // con EASY o con papeles heredados. Con la EQ normal, cada universo empuja su bajo y, además,
  // SIDECHAIN CRUZADO: si el otro universo tiene un bajo sonando SIN kick propio en la mezcla
  // (p. ej. A solo kick y B solo bajo), el kick que suena también lo empuja. Como el sonido lo
  // generamos nosotros, se sabe qué es kick y qué es bajo: una mesa de verdad no podría.
  // Va en proporción a lo que la mesa deja oír de este kick (fader y LOW).
  duck(from, t, depth) {
    const E = this.E;
    if (!E.easyOn && !this.held.length) {
      from.duckBass(t, depth);
      if (E.mode !== 'dj') return;
      const i = E.decks.indexOf(from), o = 1 - i;
      if (this.soundsIn(i, 'kick') && this.soundsIn(o, 'bass') && !this.soundsIn(o, 'kick')) {
        E.decks[o].duckBass(t, depth * this.mixLow(i));
      }
      return;
    }
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

  // para la vista con la EQ normal: qué papeles siguen forzados (p. ej. ['BAJO B'])
  heldInfo() {
    this.desired(); // suelta los que ya no hacen falta
    return this.held.map((h) => `${LABEL[h.r]} ${'AB'[1 - h.i]}`);
  }
}
