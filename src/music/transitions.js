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
//   líder   la capa que arranca en cuanto empieza a contar el viaje (ver planTransition):
//           RISER / SHH / REDOBLE / KICK (este, solo si entra el kick)
//   riser   ruido / tono / los dos. Manda el de la paleta (≈ la mitad)
//   shh     ruido blanco a ritmo: BOMBEO (se hunde en cada tiempo y vuelve a crecer, como con
//           sidechain) / GOLPE (un soplo en cada tiempo) / CONTRA (el soplo, a contratiempo)
//   redoble voz: la de la paleta o la PROPIA (el clap del universo, con su color) ·
//           patrón: ACELERA (redonda → fusas) / RECTO / TRESILLOS / FANTASMAS
//   impacto BOOM (seno afinado) / THUD (ruido sordo) / KICK (el kick del universo, alargado)
//   el resto (afinaciones, colas, filtros) se mueve un poco alrededor de la paleta
// (2026-11-12: fuera el riser TONAL, el arpegio de notas cortas que subía: no convencía)
const RECENT = 3;
const RISERS = ['noise', 'tone', 'both'];
const ROLLS = ['snare', 'clap', 'rim', 'tom', 'self'];
export const ROLL_PATTERNS = ['acelera', 'recto', 'tresillo', 'fantasma'];
export const SHH = ['bombeo', 'golpe', 'contra'];
export const LEADS = ['riser', 'shh', 'roll', 'kick'];

export function varyPalette(pal, r, recent = []) {
  const around = (v, amt) => v * (1 + r.float(-amt, amt));
  const S = pal.sty || NORMAL;
  let v, sig;
  for (let tries = 0; tries < 8; tries++) {
    v = { ...pal };
    v.lead = sWeighted(r, S, 'fx.vLead', LEADS, [3, 3, 2, 2]);
    v.riser = r.chance(0.4) ? pal.riser : sWeighted(r, S, 'fx.vRiser', RISERS, [1, 1, 1]);
    v.shh = sWeighted(r, S, 'fx.vShh', SHH, [3, 2, 2]);
    v.roll = r.chance(0.4) ? pal.roll : sWeighted(r, S, 'fx.vRoll', ROLLS, [1, 1, 1, 1, 3]); // la voz propia, la más buscada
    v.rollPattern = sWeighted(r, S, 'fx.vPattern', ROLL_PATTERNS, [4, 2, 2, 2]);
    const imp = r.weighted(['boom', 'thud', 'both', 'kick'], [pal.boom ? 3 : 1, pal.thud ? 3 : 1, 2, 3]);
    v.boom = imp === 'boom' || imp === 'both';
    v.thud = imp === 'thud' || imp === 'both';
    v.kickImpact = imp === 'kick';
    sig = `${v.lead}|${v.riser}|${v.shh}|${v.roll}|${v.rollPattern}|${imp}`;
    if (!recent.includes(sig)) break;
  }
  recent.push(sig);
  while (recent.length > RECENT) recent.shift();
  // detalles alrededor de la paleta
  // la onda del riser de tono: la de la paleta o otra, con la SENOIDAL pura (el clásico tono
  // limpio que sube) como la más probable
  v.wave = r.chance(0.6) ? pal.wave : r.pick(['sine', 'sine', 'sawtooth', 'square', 'triangle']);
  v.wobble = r.chance(0.75) ? pal.wobble : !pal.wobble;
  v.riseSemis = r.chance(0.6) ? pal.riseSemis : r.pick([7, 12, 19, 24]);
  v.riseCurve = r.float(1.3, 2.4);           // cómo crece el volumen del riser (más alto = se guarda para el final)
  v.shhTone = r.float(0.7, 1.4);             // SHH: más oscuro .. más brillante
  v.kickRise = r.pick([5, 7, 12, 12]);       // KICK QUE SUBE: semitonos que sube hasta el último golpe
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
//   riser / shh / tension / down   sostenidas entre a y b
//   roll / kick              golpes que aceleran entre a y b (el redoble y el KICK QUE SUBE)
//   reverse                  plato al revés que termina en b
//   gap                      silencio entre a y la llegada
//   impact / crash / downlifter   al llegar
// `cut` = viaje DE GOLPE (la música se aguanta y cambia en el 1): solo entonces cabe
// el silencio antes de la llegada
//
// LOS COMPASES CUENTAN (2026-11-12): en un viaje de 4 o más, la capa LÍDER (la de la variación)
// arranca en cuanto empieza a contar el viaje (u = 0; antes, en la espera de la rejilla, nada) y
// crece hasta la llegada. Las demás se suman por el camino: a la mitad, en los últimos compases.
// Así uno de 16 o 32 se oye venir desde el principio, y cuanto más largo, más recorrido. Las
// escaleras de los golpes (redoble, kick, shh) también se estiran con el viaje (ver TransitionFx)
export function planTransition(kind, L, pal, r, cut = false) {
  if (kind === 'none') return null;
  const layers = [];
  const add = (o) => layers.push(o);
  const opt = (p) => r.chance(p * (0.5 + 0.5 * pal.amount)); // capas opcionales: los sobrios usan menos
  const tier = L === 0 ? 0 : L <= 2 ? 1 : L <= 4 ? 2 : 3;
  // la LÍDER, según lo que cabe en cada tipo: el kick que sube solo si entra el kick; sin kick a
  // ningún lado (drift), solo el riser; en una caída (fall), el redoble deja paso al FILTRO que cierra
  // El KICK QUE SUBE, solo DE GOLPE: en PROGRESIVA el kick de verdad ya va entrando poco a poco
  // (con filtro y pocas notas) y los dos se pisarían; ahí tira el redoble
  let lead = pal.lead || 'riser';
  if (lead === 'kick' && kind === 'build' && !cut) lead = 'roll';
  if (lead === 'kick' && kind !== 'build') lead = 'shh';
  if (kind === 'fall' && (lead === 'roll' || lead === 'kick')) lead = 'down';
  if (kind === 'drift') lead = 'riser';
  const from = (who, a) => (lead === who ? 0 : a); // la líder, desde el principio
  // REDOBLE de `len` compases hasta `b`: el ACELERA, todo lo que dure; los otros patrones, como
  // mucho 4 compases (16 de semicorcheas seguidas cansan). La líder siempre acelera
  const roll = (len, b, vel, isLead = false) => {
    const pat = isLead ? 'acelera' : pal.rollPattern || 'acelera';
    const l = pat === 'acelera' ? len : Math.min(len, 4);
    add({ type: 'roll', a: b - l, b, vel, pat, lead: isLead });
  };

  if (kind === 'build') {
    const gap = cut && tier >= 2 && pal.gap ? pal.gap / 4 : 0;
    const end = L - gap;
    if (tier === 1) {
      add({ type: 'riser', a: 0, b: end, gain: 1, noiseOnly: true });
      roll(L === 1 ? 0.5 : 1, end, 1);
      if (opt(0.3)) add({ type: 'shh', a: 0, b: end, gain: 0.7 });
    } else if (tier >= 2) {
      if (lead === 'riser' || opt(0.7)) add({ type: 'riser', a: from('riser', L / 2), b: end, gain: 1 });
      if (lead === 'shh' || opt(0.4)) add({ type: 'shh', a: from('shh', L / 2), b: end, gain: 0.9 });
      if (lead === 'kick' || (cut && tier >= 3 && opt(0.3))) add({ type: 'kick', a: from('kick', L / 2), b: end, gain: 1 });
      if (lead === 'roll') roll(end, end, 1, true);
      else roll(tier === 2 ? r.pick([1, 2]) : Math.min(L / 2, 8), end, lead === 'kick' ? 0.8 : 1);
      add({ type: 'tension', a: L - Math.min(L, Math.max(8, L / 2)), b: L });
    }
    if (gap) add({ type: 'gap', a: end });
    add({ type: 'impact', vel: 1 });
    add({ type: 'crash', vel: 1 });
  } else if (kind === 'lift') {
    if (tier >= 2) {
      if (lead === 'riser' || opt(0.6)) add({ type: 'riser', a: from('riser', L - Math.min(L / 2, 8)), b: L, gain: 0.7 });
      if (lead === 'shh' || opt(0.4)) add({ type: 'shh', a: from('shh', L / 2), b: L, gain: 0.75 });
      if (lead === 'roll') roll(L, L, 0.7, true);
      else roll(tier === 2 ? 0.5 : Math.min(L / 4, 2), L, 0.7);
      if (tier >= 3 && opt(0.3)) add({ type: 'tension', a: L - Math.min(L, 4), b: L });
    } else if (tier === 1) roll(0.25, L, 0.7);
    add({ type: 'crash', vel: 0.9 });
    if (tier >= 2 && opt(0.6)) add({ type: 'impact', vel: 0.5 });
  } else if (kind === 'fall') {
    if (tier >= 2) {
      // el filtro que cierra: líder, todo el viaje; si no, la mitad final (en uno de 4, los 2 últimos)
      add({ type: 'down', a: from('down', L - Math.min(L, tier === 2 ? 2 : Math.max(4, L / 2))), b: L });
      if (lead === 'riser') add({ type: 'riser', a: 0, b: L, gain: 0.65 });
      if (lead === 'shh') add({ type: 'shh', a: 0, b: L, gain: 0.6 });
    }
    if (tier >= 1) add({ type: 'reverse', a: L - Math.min(L, tier === 3 ? 2 : 1), b: L, vel: 0.9 });
    add({ type: 'impact', vel: 0.7 });
    if (tier >= 1 && pal.down) add({ type: 'downlifter', bars: tier === 1 ? 1 : tier === 2 ? 2 : 4, vel: 0.8 });
  } else if (kind === 'strip') {
    if (tier >= 2) {
      if (lead === 'riser') add({ type: 'riser', a: 0, b: L, gain: 0.65 });
      if (lead === 'shh') add({ type: 'shh', a: 0, b: L, gain: 0.6 });
      add({ type: 'reverse', a: L - 1, b: L, vel: 0.6 });
    }
    if (lead === 'roll' && tier >= 2) roll(L, L, 0.55, true);
    else if (tier >= 1) roll(tier === 3 ? 0.5 : 0.25, L, 0.55);
    if (tier >= 1 || opt(0.5)) add({ type: 'crash', vel: 0.7 });
  } else if (kind === 'drift') {
    if (tier >= 2) add({ type: 'riser', a: 0, b: L, gain: 0.55, noiseOnly: true });
    if (tier >= 1) add({ type: 'reverse', a: L - Math.min(L, tier === 3 ? 2 : 1), b: L, vel: 0.55 });
    if (tier >= 1 && opt(0.5)) add({ type: 'downlifter', bars: 2, vel: 0.5 });
  }
  return layers.length ? { kind, L, layers, arrived: false } : null;
}
