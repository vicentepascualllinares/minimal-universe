// TRANSICIONES — lo que pasa entre dos momentos de la ESTRUCTURA.
//
// Al pulsar una escena el universo ya sabe de dónde sale, a dónde va y
// cuántos compases dura el viaje: con eso compone la transición (riser, ruido,
// redoble, impacto, platos, filtros). Todo sintetizado. Qué sonidos usa y
// cuánto los usa sale de la semilla del universo: su PALETA. Cada gesto (CLIC /
// CORTE) puede llevar o no estos efectos (botón FX).
//
// Tipo de transición, según el kick y la música (bajo/acordes) de origen y destino:
//   build  entra el kick                → tensión creciente: HP, riser, redoble, impacto
//                                         (DE GOLPE: a veces, además, silencio antes del 1)
//   lift   sigue el kick, entra música  → riser, redoble corto y plato
//   fall   se va el kick                → downfilter, reverse, golpe y caída
//   strip  sigue el kick, se va música  → reverse corto, redoble y plato
//   drift  sin kick en los dos lados    → solo un barrido suave
//
// La FORMA del viaje (DE GOLPE / PROGRESIVA, y ESCALONADA / SUAVE) va aparte: los efectos
// son los mismos, cambia cómo se mueve la música debajo (ver arrangement).
//
// Cuantos más compases dura el viaje, más capas. El plan se escribe en
// COMPASES DEL VIAJE: u = 0 al empezar, u = L al llegar. El viaje siempre
// aterriza en el inicio de una frase (ver PHRASE).

import { Rng, clamp } from '../core/rng.js';
import { INSTRUMENTS } from './arrangement.js';
import { NORMAL, sFloat, sWeighted, sChance } from './styles.js';

// CÓMO ENTRA Y SALE CADA INSTRUMENTO en un viaje progresivo: 1 = con filtro (HP en kick y
// bajo, LP con resonancia en el resto), 0 = con volumen. Todos, además, con densidad (de pocas
// notas a todas). La paleta de cada universo lo mueve un poco.
const HOW = { kick: 0.85, bass: 0.9, hat: 0.25, perc: 0.35, clap: 0.3, ohat: 0.4, foley: 0.3, chord: 1, pad: 0.2 };

// frase en la que aterriza un viaje de `bars` compases (en compases). OJO: desde 2026-11-12 la app no
// la usa: dónde aterriza un viaje es del intérprete y va igual en todos los motores (LANDING, en
// src/audio/slots.js, que pone su startStepFor y su previewStart a cada Deck)
export const PHRASE = (bars) => (bars <= 2 ? 4 : 8);

// `from` / `to` = presencia de cada instrumento (ver arrangement: SCENES)
export function classify(from, to) {
  const k0 = from.kick, k1 = to.kick;
  if (k1 - k0 > 0.5) return 'build';
  if (k0 - k1 > 0.5) return 'fall';
  // música = bajo y acordes por separado: quitar solo el bajo también es quitar música
  const dm = (to.bass - from.bass) + (to.chord - from.chord);
  if (k1 > 0.5) return dm > 0.3 ? 'lift' : dm < -0.3 ? 'strip' : 'none';
  return Math.abs(dm) > 0.3 || Math.abs(to.pad - from.pad) > 0.3 ? 'drift' : 'none';
}

// PALETA del universo: qué riser, qué redoble, qué golpe, cuánta tensión.
// `sty` = el ESTILO del universo (styles.js): en ROMINIMAL, sobria («not about moments or big drops»)
export function makePalette(seed, sty = NORMAL) {
  const r = new Rng(seed ^ 0x2545f491);
  const pal = {
    amount: sFloat(r, sty, 'fx.amount', 0.55, 1),      // universos sobrios .. intensos
    riser: sWeighted(r, sty, 'fx.riser', ['noise', 'tone', 'both'], [3, 2, 3]),
    wave: r.pick(['sawtooth', 'sawtooth', 'square', 'triangle']),
    riseOct: r.pick([3, 3, 4]),                        // octavas sobre la tónica del kick
    riseSemis: r.pick([12, 12, 19, 24]),               // cuánto sube el riser
    noiseQ: r.float(0.7, 3.5),
    wobble: sChance(r, sty, 'fx.wobble', 0.35),        // el riser late cada vez más rápido
    roll: r.weighted(['snare', 'clap', 'rim', 'tom'], [4, 2, 2, 2]),
    rollTone: r.float(150, 300),
    rollRise: r.pick([0, 0, 5, 7, 12]),                // semitonos que sube el redoble
    rollDecay: r.float(0.07, 0.16),
    snap: r.float(1500, 4500),
    boom: sChance(r, sty, 'fx.boom', 0.75),            // golpe grave afinado en la tónica
    thud: sChance(r, sty, 'fx.thud', 0.6),             // golpe de ruido sordo
    boomDrop: r.float(3, 8),
    boomDecay: r.float(0.6, 1.5),
    crashBase: r.float(320, 520),
    crashDecay: sFloat(r, sty, 'fx.crashDecay', 1.1, 2.4),
    crashMetal: r.float(0.2, 0.6),                     // metal .. ruido
    tensionHz: sFloat(r, sty, 'fx.tensionHz', 250, 800), // hasta dónde sube el HP en un build
    downHz: sFloat(r, sty, 'fx.downHz', 350, 1200),    // hasta dónde baja el LP en un fall
    gap: sChance(r, sty, 'fx.gapP', 0.45) ? r.pick([0.5, 1, 1, 2]) : 0, // tiempos de silencio antes del drop
    down: sChance(r, sty, 'fx.down', 0.65),            // caída de ruido al llegar a un fall
  };
  pal.sty = sty; // cada transición tira alrededor de la paleta con los pesos del estilo (varyPalette)
  if (!pal.boom && !pal.thud) pal.boom = true;
  // (al final, para que lo de arriba no cambie con la misma semilla)
  pal.how = {};   // cómo entra cada instrumento (ver HOW)
  pal.order = {}; // ESCALONADA: empujón al orden en que cambian (ver arrangement: ORDER)
  for (const k of INSTRUMENTS) {
    pal.how[k] = clamp(HOW[k] + r.float(-0.15, 0.15));
    pal.order[k] = r.float(-0.7, 0.7);
  }
  return pal;
}

// ── VARIACIÓN POR TRANSICIÓN
// La paleta es la FAMILIA del universo (su ADN de transiciones), no un sonido fijo: cada
// transición tira sus propios detalles alrededor de ella. El universo se reconoce, pero dos
// builds nunca suenan idénticos. Con MEMORIA: la combinación principal (riser · voz del
// redoble · patrón · impacto) no repite ninguna de las últimas `RECENT`.
//
//   riser   ruido / tono / los dos / TONAL (arpegio en la escala del momento que sube y
//           acelera, con un soplo de ruido debajo). Manda el de la paleta (≈ la mitad)
//   redoble voz: la de la paleta o la PROPIA (el clap del universo, con su color) ·
//           patrón: ACELERA (negras → fusas) / RECTO / TRESILLOS / FANTASMAS
//   impacto BOOM (seno afinado) / THUD (ruido sordo) / KICK (el kick del universo, alargado)
//   el resto (afinaciones, colas, filtros) se mueve un poco alrededor de la paleta
const RECENT = 3;
const RISERS = ['noise', 'tone', 'both', 'tonal'];
const ROLLS = ['snare', 'clap', 'rim', 'tom', 'self'];
export const ROLL_PATTERNS = ['acelera', 'recto', 'tresillo', 'fantasma'];
const ARPS = ['escala', 'acorde', 'quintas'];

export function varyPalette(pal, r, recent = []) {
  const around = (v, amt) => v * (1 + r.float(-amt, amt));
  const S = pal.sty || NORMAL;
  let v, sig;
  for (let tries = 0; tries < 8; tries++) {
    v = { ...pal };
    v.riser = r.chance(0.4) ? pal.riser : sWeighted(r, S, 'fx.vRiser', RISERS, [1, 1, 1, 3]); // el tonal, el más buscado
    v.arp = r.pick(ARPS);
    v.roll = r.chance(0.4) ? pal.roll : sWeighted(r, S, 'fx.vRoll', ROLLS, [1, 1, 1, 1, 3]); // la voz propia, la más buscada
    v.rollPattern = sWeighted(r, S, 'fx.vPattern', ROLL_PATTERNS, [4, 2, 2, 2]);
    const imp = r.weighted(['boom', 'thud', 'both', 'kick'], [pal.boom ? 3 : 1, pal.thud ? 3 : 1, 2, 3]);
    v.boom = imp === 'boom' || imp === 'both';
    v.thud = imp === 'thud' || imp === 'both';
    v.kickImpact = imp === 'kick';
    sig = `${v.riser}|${v.roll}|${v.rollPattern}|${imp}`;
    if (!recent.includes(sig)) break;
  }
  recent.push(sig);
  while (recent.length > RECENT) recent.shift();
  // detalles alrededor de la paleta
  // la onda del riser de tono (y del tonal): la de la paleta o otra, con la SENOIDAL pura (el
  // clásico tono limpio que sube) como la más probable
  v.wave = r.chance(0.6) ? pal.wave : r.pick(['sine', 'sine', 'sawtooth', 'square', 'triangle']);
  v.wobble = r.chance(0.75) ? pal.wobble : !pal.wobble;
  v.riseSemis = r.chance(0.6) ? pal.riseSemis : r.pick([7, 12, 19, 24]);
  v.riseCurve = r.float(1.3, 2.4);           // cómo crece el volumen del riser (más alto = se guarda para el final)
  v.noiseQ = around(pal.noiseQ, 0.3);
  v.rollTone = around(pal.rollTone, 0.15);
  v.rollRise = r.chance(0.6) ? pal.rollRise : r.pick([0, 5, 7, 12]);
  v.rollDecay = around(pal.rollDecay, 0.25);
  v.snap = around(pal.snap, 0.2);
  v.boomDrop = around(pal.boomDrop, 0.2);
  v.boomDecay = around(pal.boomDecay, 0.2);
  v.crashBase = around(pal.crashBase, 0.12);
  v.crashDecay = around(pal.crashDecay, 0.2);
  v.crashMetal = clamp(pal.crashMetal + r.float(-0.15, 0.15), 0.1, 0.7);
  v.tensionHz = around(pal.tensionHz, 0.25);
  v.downHz = around(pal.downHz, 0.25);
  v.sig = sig;
  return v;
}

// Capas (u en compases del viaje):
//   riser / tension / down   sostenidas entre a y b
//   roll                     golpes que aceleran entre a y b
//   reverse                  plato al revés que termina en b
//   gap                      silencio entre a y la llegada
//   impact / crash / downlifter   al llegar
// `cut` = viaje DE GOLPE (la música se aguanta y cambia en el 1): solo entonces cabe
// el silencio antes de la llegada
export function planTransition(kind, L, pal, r, cut = false) {
  if (kind === 'none') return null;
  const layers = [];
  const add = (o) => layers.push(o);
  const opt = (p) => r.chance(p * (0.5 + 0.5 * pal.amount)); // capas opcionales: los sobrios usan menos
  const tier = L === 0 ? 0 : L <= 2 ? 1 : L <= 4 ? 2 : 3;

  if (kind === 'build') {
    const gap = cut && tier >= 2 && pal.gap ? pal.gap / 4 : 0;
    const end = L - gap;
    if (tier >= 1) {
      add({ type: 'riser', a: L - Math.min(L, 16), b: end, gain: 1, noiseOnly: tier === 1 });
      const roll = tier === 1 ? (L === 1 ? 0.5 : 1) : tier === 2 ? r.pick([1, 2]) : Math.min(4, L / 2);
      add({ type: 'roll', a: L - roll, b: end, vel: 1 });
    }
    if (tier >= 2) add({ type: 'tension', a: L - Math.min(L, 8), b: L });
    if (gap) add({ type: 'gap', a: end });
    add({ type: 'impact', vel: 1 });
    add({ type: 'crash', vel: 1 });
  } else if (kind === 'lift') {
    if (tier >= 2) add({ type: 'riser', a: L - Math.min(L, tier === 2 ? 2 : 8), b: L, gain: 0.7 });
    if (tier >= 1) add({ type: 'roll', a: L - (tier === 1 ? 0.25 : tier === 2 ? 0.5 : 1), b: L, vel: 0.7 });
    add({ type: 'crash', vel: 0.9 });
    if (tier >= 2 && opt(0.6)) add({ type: 'impact', vel: 0.5 });
  } else if (kind === 'fall') {
    if (tier >= 2) add({ type: 'down', a: L - Math.min(L, tier === 2 ? 2 : 4), b: L });
    if (tier >= 1) add({ type: 'reverse', a: L - Math.min(L, tier === 3 && L >= 8 ? 2 : 1), b: L, vel: 0.9 });
    add({ type: 'impact', vel: 0.7 });
    if (tier >= 1 && pal.down) add({ type: 'downlifter', bars: tier === 1 ? 1 : tier === 2 ? 2 : 4, vel: 0.8 });
  } else if (kind === 'strip') {
    if (tier >= 2) add({ type: 'reverse', a: L - 1, b: L, vel: 0.6 });
    if (tier >= 1) add({ type: 'roll', a: L - 0.25, b: L, vel: 0.55 });
    if (tier >= 1 || opt(0.5)) add({ type: 'crash', vel: 0.7 });
  } else if (kind === 'drift') {
    if (tier >= 1) add({ type: 'reverse', a: L - Math.min(L, tier === 3 ? 2 : 1), b: L, vel: 0.55 });
    if (tier >= 1 && opt(0.5)) add({ type: 'downlifter', bars: 2, vel: 0.5 });
  }
  return layers.length ? { kind, L, layers, arrived: false } : null;
}
