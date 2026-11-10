// ESPACIO — los EFECTOS CREATIVOS de cada universo: un DELAY que es parte del ritmo (ecos en la
// rejilla, a lo dub) y una REVERB (la sala donde suena). Como el color, salen de la SEMILLA y del
// ESTILO al generar: el intérprete no toca parámetros de sonido. Lo único suyo es el volumen de cada
// retorno en el MIXER (DELAY y REVERB, con su MUTE y su SOLO).
//
// Qué decide cada universo:
//   DELAY   la división (corchea, corchea con puntillo, negra, negra con puntillo, tresillo), si va
//           en PING-PONG (un eco a cada lado) o centrado, cuánto se repite (realimentación), cómo se
//           oscurece y adelgaza cada repetición (filtros dentro del bucle, como un eco de cinta), un
//           poco de saturación de cinta y de «wow» (la cinta que no gira perfecta), cuánto pasa a la
//           reverb y A QUIÉN: un instrumento PROTAGONISTA del eco (los stabs, la percusión, el clap...)
//           y los demás con poco o nada.
//   THROWS  el gesto dub: al final de algunas frases, el envío del protagonista se abre de golpe para
//           UN golpe y sus ecos se quedan sonando sobre el 1 de la frase siguiente.
//   REVERB  la sala: largo de la cola, predelay, cuánto se apagan los agudos al final, reflexiones
//           tempranas (el «carácter» de la habitación), anchura y el paso alto del retorno. A quién
//           y cuánto, instrumento por instrumento, y también a los efectos de transición (platos,
//           golpes, risers: los que más lo pedían).
// Kick y bajo, siempre secos: los graves del club, limpios.
//
// Con su propio dado (la semilla con otra sal): no toca ninguna tirada de las de siempre, así un
// universo NORMAL sigue saliendo idéntico en todo lo demás. Todo se sortea siempre en el mismo orden
// (el fader del estilo cambia los rangos, no qué se tira). Los rangos por estilo: `dly.*` y `rev.*`
// en styles.js (ROMINIMAL.md §6). Aquí no hay audio: lo monta audio/spaceFx.js.

import { Rng } from '../core/rng.js';
import { sFloat, sWeighted, sChance } from './styles.js';

// instrumentos que pueden mandar a los efectos (kick y bajo, nunca)
export const SENDS = ['hat', 'perc', 'clap', 'ohat', 'foley', 'chord', 'pad'];

// DIVISIONES del delay, en pasos de semicorchea (16 por compás)
export const DIVS = { '8': 2, '8.': 3, '4': 4, '4.': 6, '8T': 8 / 3 };
const DIV_NAMES = Object.keys(DIVS);
const DIV_LABEL = { '8': '1/8', '8.': '1/8 con puntillo', '4': '1/4', '4.': '1/4 con puntillo', '8T': '1/8 tresillo' };

// quién puede ser el PROTAGONISTA del eco
const FOCUS = ['chord', 'perc', 'clap', 'hat', 'foley'];

// LO DE SIEMPRE (NORMAL): rangos de cada envío [min, max] (ganancia lineal, antes del `amt`)
const DLY0 = { hat: [0, 0.06], perc: [0, 0.14], clap: [0, 0.14], ohat: [0, 0.08], foley: [0, 0.12], chord: [0, 0.18], pad: [0, 0.1] };
const REV0 = { hat: [0, 0.12], perc: [0.05, 0.28], clap: [0.1, 0.35], ohat: [0.02, 0.2], foley: [0.05, 0.3], chord: [0.08, 0.32], pad: [0.1, 0.38], fx: [0.15, 0.4] };

export function makeSpace(seed, sty) {
  const r = new Rng((seed ^ 0x3c6ef372) >>> 0);
  const f = (key, a, b) => sFloat(r, sty, key, a, b);
  // cuánto efecto lleva el universo en general (de casi seco a mojado)
  const amt = f('space.amt', 0.45, 1.1);

  // ── DELAY
  const dlyOn = sChance(r, sty, 'dly.on', 0.85);
  const div = sWeighted(r, sty, 'dly.div', DIV_NAMES, [1.5, 3, 1.5, 1, 0.6]);
  const pingpong = sChance(r, sty, 'dly.pingpong', 0.5);
  const fb = f('dly.fb', 0.2, 0.55);
  const tone = f('dly.tone', 1800, 6500);   // paso bajo dentro del bucle: cada eco, más oscuro
  const thin = f('dly.hp', 180, 600);       // paso alto dentro del bucle: cada eco, más fino
  const drive = f('dly.drive', 0, 0.35);    // saturación de cinta en el bucle
  const wow = f('dly.wow', 0, 0.0015);      // s de vaivén del tiempo (la cinta)
  const wowHz = f('dly.wowHz', 0.25, 0.9);
  const toRev = f('dly.rev', 0, 0.3);       // los ecos, a la sala
  const focus = sWeighted(r, sty, 'dly.focus', FOCUS, [3, 2.5, 1.5, 0.8, 1]);
  const focusSend = f('dly.focusSend', 0.22, 0.45);
  const dly = {};
  for (const k of SENDS) {
    const v = f(`dly.${k}`, ...DLY0[k]);
    dly[k] = dlyOn ? amt * (k === focus ? Math.max(v, focusSend) : v) : 0;
  }
  // THROWS: probabilidad por final de frase, cuánto se abre el envío y cada cuántos compases
  const throwP = f('dly.throw', 0.1, 0.45);
  const throwAmt = f('dly.throwAmt', 0.5, 0.85);
  const throwEvery = Number(sWeighted(r, sty, 'dly.throwEvery', ['8', '16'], [2, 1]));

  // ── REVERB
  const decay = f('rev.decay', 0.5, 2.2);   // la cola hasta −60 dB (s)
  const pre = f('rev.pre', 0.002, 0.03);    // predelay (s)
  const damp = f('rev.damp', 2500, 9000);   // agudos al final de la cola (Hz)
  const early = f('rev.early', 0.15, 0.6);  // reflexiones tempranas: el carácter de la sala
  const width = f('rev.width', 0.6, 1);
  const low = f('rev.hp', 180, 400);        // paso alto del retorno
  const rev = {};
  for (const k of [...SENDS, 'fx']) rev[k] = amt * f(`rev.${k}`, ...REV0[k]);
  const irSeed = r.int(1, 2 ** 30);

  return {
    amt,
    dly: {
      on: dlyOn, div, steps: DIVS[div], pingpong, fb, tone, thin, drive, wow, wowHz, toRev, focus,
      send: dly, throwP: dlyOn ? throwP : 0, throwAmt: amt * throwAmt, throwEvery,
    },
    rev: { decay, pre, damp, early, width, low, send: rev, irSeed },
  };
}

// para enseñarlo: «DELAY 1/8 con puntillo, ping-pong, protagonista CHORD · REVERB 0,6 s»
const NAME = { chord: 'CHORD', perc: 'PERC', clap: 'CLAP', hat: 'HAT', foley: 'FOLEY' };
export function describeSpace(S) {
  const D = S.dly;
  const d = D.on
    ? `DELAY ${DIV_LABEL[D.div]}${D.pingpong ? ', ping-pong' : ''}, ${Math.round(D.fb * 100)} % de repetición, protagonista ${NAME[D.focus]}`
    : 'sin DELAY';
  return `${d} · REVERB ${S.rev.decay.toFixed(1).replace('.', ',')} s`;
}
