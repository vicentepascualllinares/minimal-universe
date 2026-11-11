// ESTILOS — un GÉNERO como perfil de generación. Un fader por universo (cabecera, junto a NUEVO
// UNIVERSO): a la izquierda NORMAL, lo de siempre (idéntico: con la misma semilla sale el mismo
// universo, tirada por tirada), y a la derecha el estilo puro (de momento ROMINIMAL). En medio, los
// valores intermedios. Solo cuenta al GENERAR: cada NUEVO UNIVERSO nace con el estilo que marca el
// fader en ese momento; el que suena no cambia.
//
// Un estilo es DATOS, no código:
//   k        rangos, pesos y probabilidades que sustituyen a los de siempre EN EL MISMO SORTEO (la
//            cantidad de tiradas no cambia: el universo se parece al que habría salido sin estilo)
//   color    rangos de TIMBRE: cada parámetro del color (emotion.js) se lleva a su rango del género,
//            conservando dónde caía el universo dentro de lo suyo (uno oscuro sigue siendo oscuro)
//   modos    cómo es el bajo (pluck, sub, redondo, ácido) y cómo son los acordes (dub, teclas, órgano)
//   arch     ARQUETIPOS: las combinaciones del género (más percs que hats, solo foley y un poco de
//            hats, sin acordes, sin pad...). Cada uno con sus MUTE, su mezcla, su CANT · VAR, su
//            complejidad y sus sonidos preferidos. «Es en los límites y combinaciones donde está el
//            género»
//   mix      la MEZCLA con la que nace (faders de sus instrumentos y de FX, en dB)
// Lo que solo existe con estilo (arquetipo, modos, MUTE, mezcla) sale de un DADO APARTE: nunca toca
// los dados de siempre.
//
// El fader t (0..1) interpola: rangos y pesos de lo normal a lo del estilo, probabilidad de cada MUTE
// × t (con más t, los mismos MUTE y alguno más), la mezcla del preset a la del estilo. Con t = 0 todo
// es la llamada de siempre (NORMAL) y NUEVO UNIVERSO no toca el MIXER.
//
// La investigación detrás de cada número (fuentes, rasgos por dimensión, cómo se relacionan y qué
// falta en el motor): ROMINIMAL.md. Añadir otro género = otro objeto como ROMINIMAL en STYLES.

import { Rng, clamp, lerp } from '../core/rng.js';
import { mapEmotion } from './emotion.js';
import { INSTRUMENTS, RETURNS } from './arrangement.js';

// sin estilo: todas las tiradas, las de siempre
export const NORMAL = Object.freeze({ t: 0, k: Object.freeze({}), name: null, mutes: [], mix: null, color: null });

// ───────────────────────── SORTEOS CON ESTILO
// Con t = 0 (o sin dato del estilo) son exactamente la llamada de siempre. Un dato del estilo es
// un array (alineado con `items`) o un objeto { item: peso } (lo que no nombra queda como siempre)
const specW = (spec, items, w0) => (Array.isArray(spec) ? spec : items.map((it, i) => spec[it] ?? w0[i]));
export const mixW = (w0, w1, t) => w0.map((w, i) => w + (w1[i] - w) * t);
const spec = (sty, key) => (sty.t ? sty.k[key] : undefined);

// ───────────────────────── PUREZA (2026-11-11)
// Una perilla aparte del fader de ESTILO: el fader dice QUÉ estilo (un punto entre NORMAL y el
// género); la PUREZA, CUÁNTO lo respeta el universo que nace. 100 % = el estilo estricto (lo de
// siempre). Con menos, cada regla se afloja una cantidad propia, fija para ese universo (unas casi
// nada, otras mucho: «saltarse alguna regla»), hasta (1 − pureza) × 1,5:
//   elecciones (pesos)  se aplanan: entra lo que el estilo casi prohibía
//   rangos              se ensanchan hacia todo lo que el motor sabe hacer (lo normal y lo del estilo)
//   probabilidades      se desvían hacia un valor propio de cada regla
// `sty.loose` = 1 − pureza; `sty.lseed` = el dado de qué regla se afloja cuánto
const keyU = (seed, key) => {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x5bd1e995) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
// cuánto se afloja la regla `key` en este universo (0 = estricta)
export const looseOf = (sty, key) => (sty.loose ? Math.min(1, sty.loose * 1.5 * keyU(sty.lseed, key)) : 0);
const flatten = (w, L) => {
  const m = w.reduce((a, x) => a + x, 0) / w.length;
  return w.map((x) => x + (m - x) * L);
};

export function sWeighted(r, sty, key, items, w0) {
  const s = spec(sty, key);
  if (!s) return r.weighted(items, w0);
  const w = mixW(w0, specW(s, items, w0), sty.t), L = looseOf(sty, key);
  return r.weighted(items, L ? flatten(w, L) : w);
}
export function sPick(r, sty, key, items) {
  const s = spec(sty, key);
  if (!s) return r.pick(items);
  const ones = items.map(() => 1);
  const w = mixW(ones, specW(s, items, ones), sty.t), L = looseOf(sty, key);
  return r.weighted(items, L ? flatten(w, L) : w);
}
export function sFloat(r, sty, key, a, b) {
  const s = spec(sty, key);
  if (!s) return r.float(a, b);
  let lo = lerp(a, s[0], sty.t), hi = lerp(b, s[1], sty.t);
  const L = looseOf(sty, key);
  if (L) { lo = lerp(lo, Math.min(a, s[0]), L); hi = lerp(hi, Math.max(b, s[1]), L); }
  return r.float(lo, hi);
}
export function sChance(r, sty, key, p) {
  const s = spec(sty, key);
  if (s === undefined) return r.chance(p);
  const q = lerp(p, s, sty.t), L = looseOf(sty, key);
  return r.chance(L ? lerp(q, keyU(sty.lseed, key + '!'), L * 0.7) : q);
}
export function sValue(sty, key, v) {
  const s = spec(sty, key);
  return s === undefined ? v : lerp(v, s, sty.t);
}

// ───────────────────────── COLOR (timbre) con estilo
// Los parámetros del color (mapEmotion) que el estilo lleva a su rango. Cada uno se recoloca: su
// posición dentro de lo que da el color de siempre (`natural`, medido sobre todo el rango del color)
// pasa al mismo sitio dentro del rango del estilo; t mezcla lo de siempre con eso
export const COLOR_PARAMS = [
  'kick.punch', 'kick.pitchDecay', 'kick.hold', 'kick.decay', 'kick.click', 'kick.clickFreq', 'kick.drive', 'kick.duck',
  'clap.freq', 'clap.q', 'clap.spread', 'clap.decay', 'clap.drive',
  'hat.base', 'hat.noiseMix', 'hat.bp', 'hat.hp', 'hat.decay', 'hat.accent', 'hat.drive',
  'ohat.decay',
  'perc.harmonic', 'perc.decayMul', 'perc.pitchMul', 'perc.fmIndex', 'perc.drive',
  'foley.bright', 'foley.decayMul', 'foley.drive',
  'bass.cutoff', 'bass.env', 'bass.res', 'bass.filtDecay', 'bass.release', 'bass.saw', 'bass.square', 'bass.sub',
  'bass.detune', 'bass.drive', 'bass.lenMul',
  'chord.cutoff', 'chord.env', 'chord.res', 'chord.filtDecay', 'chord.decay', 'chord.sustain', 'chord.release',
  'chord.lenMul', 'chord.detune', 'chord.drive',
  'pad.cutoff', 'pad.lfo', 'pad.lfoDepth', 'pad.attack', 'pad.release', 'pad.detune', 'pad.air', 'pad.level', 'pad.drive',
  'master.drive',
  'groove.swing', 'groove.humanize', 'groove.clapNudge',
];
const PATH = COLOR_PARAMS.map((p) => p.split('.'));

// lo que da el color de siempre: mínimo y máximo de cada parámetro sobre todo el rango de NUEVO
// UNIVERSO (valencia −0,8..0,8, activación −0,7..0,7, deriva −1..1). Se mide una vez, así sigue
// siendo cierto aunque cambie emotion.js
let NAT = null;
function natural() {
  if (NAT) return NAT;
  NAT = PATH.map(() => [Infinity, -Infinity]);
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      for (const d of [-1, 0, 1]) {
        const e = mapEmotion(-0.8 + (1.6 * i) / 8, -0.7 + (1.4 * j) / 8, d);
        PATH.forEach(([g, k], n) => {
          NAT[n][0] = Math.min(NAT[n][0], e[g][k]);
          NAT[n][1] = Math.max(NAT[n][1], e[g][k]);
        });
      }
    }
  }
  return NAT;
}

// `sx` = el estilo del color que suena (EmotionState.sx: [cuánto, lo0, hi0, lo1, hi1...], con
// inercia). Cambia `e` (el objeto que acaba de dar mapEmotion) y lo devuelve
export function styleColor(e, sx) {
  const amt = sx ? sx[0] : 0;
  if (!(amt > 1e-4)) return e;
  const N = natural();
  for (let n = 0; n < PATH.length; n++) {
    const [g, k] = PATH[n];
    const x = e[g][k];
    const [a, b] = N[n];
    const u = b > a ? clamp((x - a) / (b - a)) : 0.5;
    const lo = sx[1 + 2 * n], hi = sx[2 + 2 * n];
    e[g][k] = x + (lo + u * (hi - lo) - x) * amt;
  }
  return e;
}

// ───────────────────────── ROMINIMAL
// Las fuentes de cada rasgo están en ROMINIMAL.md (entre corchetes, la abreviatura que usa allí).
export const ROMINIMAL = {
  label: 'ROMINIMAL',
  code: 'RO', // en el CÓDIGO DE SEMILLA (universe.js): «968782145-RO100»
  // COLOR del universo (valencia y activación, como NUEVO UNIVERSO): de oscuro a algo cálido, de
  // quieto a medio; nunca el extremo intenso ni el muy luminoso. «smoky, smooth and understated»
  // [RA fabric 72], «hypnotic, meditative» [RMC], «dark and trippy, floaty» [Caia]
  v: [-0.6, 0.45],
  a: [-0.55, 0.3],

  // TIMBRE: el rango de cada parámetro del color (ver COLOR_PARAMS)
  color: {
    // KICK: corto, seco, «low and dry — not punchy» [RMC]; un seno con saturación (overdrive /
    // foldback) [RMC], el chasquido hacia 1 kHz [GS] y un sidechain sutil, «without pumping» [MD]
    'kick.punch': [2.4, 4.2], 'kick.pitchDecay': [0.018, 0.04], 'kick.hold': [0.008, 0.025],
    'kick.decay': [0.15, 0.27], 'kick.click': [0.04, 0.2], 'kick.clickFreq': [1100, 2800],
    'kick.drive': [0.25, 0.5], 'kick.duck': [0.18, 0.32],
    // CLAP: corto, más chasquido que palmada: en rominimal mandan rims y clics («shakers, rim shots,
    // clicks» [RMC]); cuando hay clap, el clásico, sin protagonismo («classic hi-hat and clap» [RA Mihigh])
    'clap.freq': [1100, 1900], 'clap.q': [1.3, 2.4], 'clap.spread': [0.006, 0.0105], 'clap.decay': [0.07, 0.16],
    'clap.drive': [0.05, 0.25],
    // HATS: cortos, nítidos, con grano: «crackle with vinyl grain» [RMC], «crisp» [MD]
    'hat.base': [300, 420], 'hat.noiseMix': [0.4, 0.8], 'hat.bp': [9000, 12500], 'hat.hp': [6500, 9500],
    'hat.decay': [0.016, 0.042], 'hat.accent': [0.45, 0.8], 'hat.drive': [0.04, 0.2],
    'ohat.decay': [0.12, 0.28],
    // PERCS: madera, cortas y secas: «clicky drums» [EB], «woody» [RMC], «delicate percussion ghosts» [MD]
    'perc.harmonic': [0.55, 0.95], 'perc.decayMul': [0.5, 0.95], 'perc.pitchMul': [0.9, 1.15],
    'perc.fmIndex': [0.6, 1.8], 'perc.drive': [0.05, 0.25],
    // FOLEY: «found sounds» [RMC], «faint room ambiences, foley» [MD]
    // (gestos más cortos desde 2026-11-11: un detalle, no media frase; el gesto dura × √decayMul)
    'foley.bright': [0.85, 1.2], 'foley.decayMul': [0.4, 0.75], 'foley.drive': [0.02, 0.12],
    // BASS: subgrave y con poca nota, que «empuja» sin «muro de subgrave» [RMC], «elastic, subby» [MD]
    // (los MODOS lo afinan: pluck, sub, redondo, ácido)
    'bass.cutoff': [110, 420], 'bass.env': [1.5, 4.5], 'bass.res': [1, 4], 'bass.filtDecay': [0.04, 0.12],
    'bass.release': [0.025, 0.08], 'bass.saw': [0.12, 0.45], 'bass.square': [0.05, 0.3], 'bass.sub': [0.85, 1],
    'bass.detune': [2, 6], 'bass.drive': [0.12, 0.35], 'bass.lenMul': [0.6, 1],
    // CHORD: el stab dub corto y oscuro («dubby» [EB], «short chord stabs» [MD]); los MODOS lo cambian
    'chord.cutoff': [380, 1500], 'chord.env': [2, 4.5], 'chord.res': [1.5, 5], 'chord.filtDecay': [0.06, 0.2],
    'chord.decay': [0.06, 0.16], 'chord.sustain': [0.04, 0.18], 'chord.release': [0.08, 0.3], 'chord.lenMul': [0.5, 0.9],
    'chord.detune': [5, 14], 'chord.drive': [0.05, 0.3],
    // PAD: oscuro, lento, «subtle, emotive pads that eventually rise from the low end» [EB], con aire
    'pad.cutoff': [320, 1200], 'pad.lfo': [0.03, 0.1], 'pad.lfoDepth': [0.25, 0.5], 'pad.attack': [1.2, 3],
    'pad.release': [1.5, 3.5], 'pad.detune': [6, 14], 'pad.air': [0.12, 0.32], 'pad.level': [0.5, 0.85],
    'pad.drive': [0.02, 0.12],
    // saturación del universo: calor, sin apretar (los másters son de vinilo, sin limitar a tope) [RMC]
    'master.drive': [0.1, 0.28],
    // GROOVE: el swing es «the most recognisable quality» [RMC]: arriba (sin pasar del 58 %: lo que
    // cada instrumento swinguea de más lo pone `groove`, abajo), el clap detrás. El temblor al azar,
    // poco (2026-11-11): el empuje-tirón ya es un DIBUJO fijo por paso (`groove.tm`), no ruido
    'groove.swing': [0.55, 0.58], 'groove.humanize': [0.0006, 0.0015], 'groove.clapNudge': [0.008, 0.018],
  },

  // MODOS del bajo y de los acordes (cada universo saca uno; el arquetipo cambia las probabilidades)
  bassModeW: { pluck: 3, round: 2.5, sub: 2, acid: 1 },
  bassModes: {
    // «walking warm plucky sounds» [ST], «plucky, randomly pitched bass tone» [RA Semantics]
    pluck: {
      color: { 'bass.env': [2.5, 5], 'bass.filtDecay': [0.03, 0.08], 'bass.release': [0.02, 0.05], 'bass.lenMul': [0.55, 0.8], 'bass.cutoff': [140, 380] },
      k: { 'bass.len': { 1: 8, 2: 2, 3: 0.6 } },
    },
    // «bulbous, monotone sub-bass» [RA Mihigh], «deep sine tones» [ST]
    sub: {
      color: { 'bass.env': [1, 2.2], 'bass.cutoff': [90, 220], 'bass.saw': [0.05, 0.2], 'bass.sub': [0.95, 1], 'bass.lenMul': [0.9, 1.3], 'bass.release': [0.05, 0.12] },
      k: { 'bass.len': { 1: 3, 2: 3, 3: 2 } },
    },
    // el redondo de siempre en el rango del estilo: «dubby», «swinging basslines» [EB]
    round: { color: {}, k: { 'bass.len': { 1: 6, 2: 3, 3: 1 } } },
    // el 303 de Melodie o SIT: «mellow acid squelches» [RA Melodie], «acid techno bassline» [SIT]
    acid: {
      color: { 'bass.res': [5, 8.5], 'bass.env': [3.5, 6], 'bass.cutoff': [180, 520], 'bass.saw': [0.5, 0.8], 'bass.filtDecay': [0.06, 0.15], 'bass.square': [0, 0.1] },
      k: { 'bass.len': { 1: 7, 2: 2.5, 3: 0.8 } },
    },
  },
  // CÓMO SE TOCA EL BAJO (2026-11-11, ROMINIMAL.md §6 «El bajo»). Rehecho el mismo día al escucharlo
  // («notas muy largas sin intención, siempre el mismo bajo sostenido, legato muy rápido, notas muy
  // altas») con NÚMEROS de las fuentes [Slow Techno Bible, Producer School sub, Open303, Attack
  // Immaterial, soundbridge]. Por modo:
  //   glide     probabilidad de DESLIZAR hasta un paso (como mucho uno por compás, nunca a la
  //             semicorchea siguiente); glideTau = constante de tiempo (s): llega al 90 % en ~2,3 ×.
  //             303: RC de 200 kΩ y 220 nF, τ calculada ~0,15 s, «completo a los ~60 ms» medido a oído
  //             [Open303]; recetas de minimal 30–40 ms [Bible]. Antes τ = 12–40 ms (sonaba a salto)
  //   legato    probabilidad de que una nota llegue a la siguiente (solo si está a 2 pasos o menos)
  //   long      la NOTA LARGA con intención: probabilidad de que el universo la tenga, en un
  //             contratiempo fijo, 3–4 pasos (360–480 ms a 125 BPM: «event duration 300–600 ms»
  //             [Bible]), en la respuesta (o en todos los compases, en el sub)
  //   sus, dec  la ENVOLVENTE: nivel que sostiene y lo que tarda en llegar (s). Arquetipos [Bible]:
  //             pluck D 800 ms S 0; acento D 300 ms S 60 %; bloom D 2 s S 40 %. Antes, siempre 75 % en 50 ms
  //   post      PASO BAJO fijo de 24 dB/oct (Hz) al final: que solo queden graves. «LP at 300 Hz» tras
  //             saturar el sub; sierra filtrada 250–400 Hz; 200–500 Hz «classic techno body», 500–1200
  //             «nasal, tension» [Bible]; tech house, 150 Hz [soundbridge]
  //   sweep     el FILTRO LENTO (± octavas del corte) y su periodo en compases: LFO de minimal
  //             0,1–0,3 Hz, profundidad 5–15 %, ciclos de 4–8 compases [Bible] (antes ±0,3–1,8 oct)
  //   pitch     ENVOLVENTE DE ALTURA al atacar: none · blip (empieza arriba y cae: «a few semitones,
  //             very short decay» [Violet, Jatari], decay 80–125 ms [Attack Immaterial]) · scoop (entra
  //             desde abajo); semitonos y τ (s)
  //   fall      CAÍDA al final de nota: probabilidad por paso (fija), semitonos y lo que dura (s)
  //   cells     qué CELDA de alturas toca (abajo, `bassCells`): probabilidades
  bassFeel: {
    pluck: {
      glide: 0.05, legato: 0.05, long: 0.15, glideTau: [0.04, 0.06],
      sus: [0, 0.15], dec: [0.12, 0.25], post: [300, 450], sweep: [0.2, 0.45],
      pitch: { none: 1, blip: 2, scoop: 0.5 }, blip: [2, 7], scoop: [1, 2], pitchTau: [0.012, 0.03],
      fall: 0.1, fallSemis: [3, 12], fallDur: [0.06, 0.12],
      cells: { octava: 2, quinta: 2, septima: 2, cuarta: 1.5, tercera: 1.5, segunda: 1, sexta: 0.7, novena: 0.3, quintaBaja: 1, unisono: 0.5 },
    },
    round: {
      glide: 0.2, legato: 0.15, long: 0.35, glideTau: [0.045, 0.075],
      sus: [0.3, 0.55], dec: [0.18, 0.35], post: [260, 400], sweep: [0.2, 0.5],
      pitch: { none: 1.5, blip: 1.5, scoop: 1 }, blip: [1, 4], scoop: [1, 2], pitchTau: [0.015, 0.035],
      fall: 0.15, fallSemis: [2, 7], fallDur: [0.08, 0.15],
      cells: { octava: 2, quinta: 2.5, septima: 2, cuarta: 2, tercera: 1, segunda: 0.5, sexta: 1, novena: 0.3, quintaBaja: 1.5, unisono: 0.5 },
    },
    sub: {
      glide: 0.1, legato: 0.2, long: 0.6, glideTau: [0.05, 0.08],
      sus: [0.5, 0.75], dec: [0.3, 0.6], post: [160, 260], sweep: [0.1, 0.3],
      pitch: { none: 2, blip: 1, scoop: 1 }, blip: [1, 3], scoop: [1, 2], pitchTau: [0.02, 0.04],
      fall: 0.2, fallSemis: [2, 5], fallDur: [0.1, 0.2],
      cells: { octava: 2, quinta: 1.5, septima: 1, cuarta: 1.5, tercera: 0.5, segunda: 0.5, sexta: 1, novena: 0.1, quintaBaja: 2.5, unisono: 2 },
    },
    acid: {
      glide: 0.5, legato: 0.15, long: 0.1, glideTau: [0.04, 0.06],
      sus: [0.25, 0.45], dec: [0.15, 0.25], post: [450, 800], sweep: [0.4, 0.8],
      pitch: { none: 3, blip: 0.5, scoop: 0.5 }, blip: [1, 3], scoop: [1, 2], pitchTau: [0.01, 0.025],
      fall: 0.05, fallSemis: [5, 12], fallDur: [0.06, 0.1],
      cells: { octava: 1.5, quinta: 1, septima: 2, cuarta: 1, tercera: 2, segunda: 2, sexta: 1, novena: 0.3, quintaBaja: 0.5, unisono: 0.3 },
    },
  },
  // REGISTRO del bajo (Hz de la fundamental): lo que pase del techo baja una octava y lo que no llegue
  // al suelo sube; la OCTAVA de la tónica puede pasar (el salto 1–8 de siempre) pero corta. Bajo de
  // tech house: fundamental 40–80 Hz; un club reproduce 30–100 Hz [Producer School sub]. Medido antes
  // de esto: 27 % de las notas por encima de 150 Hz, hasta 250. La octava corta, hasta 200 Hz (con la tónica en E–F#; en G y A baja a la tónica)
  bassRange: [40, 140], bassOctaveMax: 200,
  // CELDAS de alturas del bajo (2026-11-11, al escucharlo: «que la complejidad sea baja no tiene que
  // limitar el salto entre notas»). Cada universo toca una: «one or two core tones» [MD], pero no
  // siempre tónica y octava. En GRADOS del modo (0 tónica, 1 2ª, 2 3ª, 3 4ª, 4 5ª, 5 6ª, 6 7ª, 7
  // octava, 8 novena, −3 la 5ª grave): con el modo menor de siempre, la 7ª y la 3ª son menores.
  //   dos   las DOS alturas de la complejidad baja (pocas notas y pocas veces, pero el salto es el
  //         de la celda: 1–7, 1–4, 5–4…)
  //   todas la celda entera (complejidad media); con complejidad alta, además, notas de paso
  //   color qué altura va en los contratiempos (la tónica cae con el kick)
  // De los tutoriales [Attack «5 tips», Producer School, Splice]: 1–5–8, 1–5–9, 1–7–8 («jumps from
  // the seventh to the octave»), 1–3–7, 1–b3–5; la 2ª menor frigia para oscurecer; y el bajo de
  // una sola altura en contratiempo (Villalobos, «Dexter» [Attack]: «insistent blippy bass sequence on
  // the offbeats»), el «monotone sub-bass» [RA Mihigh]
  bassCells: {
    octava: { dos: [0, 7], todas: [0, 7, 4], color: 7 },
    quinta: { dos: [0, 4], todas: [0, 4, 7], color: 4 },
    quintaBaja: { dos: [0, -3], todas: [0, -3, 7], color: -3 },
    septima: { dos: [0, 6], todas: [0, 6, 7, 4], color: 6 },
    cuarta: { dos: [0, 3], todas: [0, 3, 4], color: 3 },
    tercera: { dos: [0, 2], todas: [0, 2, 4, 6], color: 2 },
    segunda: { dos: [0, 1], todas: [0, 1, -3], color: 1 },
    sexta: { dos: [0, 5], todas: [0, 5, 4], color: 5 },
    novena: { dos: [0, 8], todas: [0, 4, 8], color: 8 },
    unisono: { dos: [0], todas: [0, 7], color: 0 },
  },
  // REMATE al final de frase (el «fill» del 4º compás que camina hasta la tónica del siguiente
  // [Producer School]: la 5ª, 6ª y 7ª que suben, o la 4ª, 3ª y 2ª que bajan): cada cuántos compases
  bassWalkEvery: { 4: 1, 8: 2 },
  // FRASE del bajo (pregunta y respuesta, ROMINIMAL.md §7 punto 2): A = el motivo, B = la respuesta
  // (la 1ª mitad igual, la 2ª contesta), C = una variante de la respuesta. Cada 4 compases
  bassPhrase: { ABAB: 3, AAAB: 2, ABAC: 2 },
  // el periodo del filtro lento (compases): dos senos, el segundo más corto y sin múltiplo. Ciclos de
  // 4–8 compases [Bible] el corto; el largo, una frase larga (antes 16–48)
  bassSweepBars: [12, 32],
  chordModeW: { dub: 4, keys: 1.5, organ: 1 },
  chordModes: {
    dub: { color: {}, k: { 'chord.len': { 1: 7, 2: 2.5, 3: 0.8, 6: 0.3 } } },
    // «foggy keys» [SIT], «fragile piano chords» [RA Mihigh], Rhodes [Amorf]: blando, poca resonancia
    // (`mix`: suena más lleno que el stab: medido, RMS hasta +1,5 dB → su fader algo más abajo)
    keys: {
      color: { 'chord.env': [0.8, 2.2], 'chord.res': [0.7, 1.6], 'chord.sustain': [0.15, 0.3], 'chord.decay': [0.15, 0.35], 'chord.release': [0.2, 0.45], 'chord.lenMul': [0.7, 1.1], 'chord.cutoff': [500, 1400] },
      k: { 'chord.len': { 1: 4, 2: 3, 3: 1.5, 6: 0.6 } },
      mix: { chord: -1 },
    },
    // «a soft, melancholic organ» [RA Mihigh]: sostenido (medido: RMS hasta +2,5 dB y pico +0,7 dB
    // sobre el acorde normal más fuerte → −2,5 dB en su fader)
    organ: {
      color: { 'chord.env': [0.3, 1.2], 'chord.res': [0.7, 1.4], 'chord.sustain': [0.45, 0.7], 'chord.decay': [0.25, 0.45], 'chord.release': [0.15, 0.4], 'chord.lenMul': [0.9, 1.4], 'chord.cutoff': [600, 1600] },
      k: { 'chord.len': { 1: 2, 2: 3, 3: 2, 6: 1.2 } },
      mix: { chord: -2.5 },
    },
  },

  // GENERACIÓN: lo que sustituye a lo de siempre (en generators.js, complexity.js, kit.js y
  // transitions.js se ve qué tirada es cada uno)
  k: {
    // KICK: 4/4 quieto («static rhythmic construction» [Villalobos]) con la 1ª mitad del compás más
    // fuerte: «a swinging or skipping momentum» [EB 2017, Vid]. Fantasmas sobre todo en la 1ª mitad
    'kick.vel': [1, 0.97, 0.88, 0.92],
    'kick.ghost': { 7: 2.5, 10: 0.6, 14: 1, 15: 1.2 },
    // CLAP: menos «en 2 y 4», más «solo en el 4» y atrasado
    'clap.style': { 24: 2.5, 4: 3, '24ghost': 1.2, late: 3 },
    // HATS: shaker (granos), ruido con bits (el grano «de vinilo»), clics FM; poco plato
    'hatEng.fino': { grains: 4, hiss: 1.8, fm: 0.6, metal: 0.5 },
    'hatEng.oscuro': { metal: 1.5, fm: 1, cymbal: 0.6, hiss: 1.2 },
    'hatEng.tick': { fm: 2, hiss: 1.8, metal: 1, cymbal: 0.3 },
    'hatEng.medio': { hiss: 2.2, metal: 1.4, cymbal: 0.9, fm: 0.6 },
    'hiss.bits': { 0: 1, 6: 1.5, 8: 2 },
    // PERCS: madera, rim, conga, clave, clics y granos; casi nada de cowbell (eso es house)
    'perc.type': { tone: 2.5, fm: 2, noise: 1.5, reso: 4, bell: 0.3, modal: 3.5, ks: 3, glitch: 2.5, grains: 2.5 },
    'perc.lead': { tone: 2.5, fm: 2, reso: 4, modal: 3.5, ks: 3 },
    // alturas: tónica, 5ª, 7ª y octava, y también 2ª, 4ª y 6ª: las «micro-melodies» modales [EB]
    'perc.deg': { 0: 3, 2: 1, 4: 2, 6: 1.5, 7: 1.5, 9: 0.6, 11: 0.6, 1: 0.7, 3: 0.9, 5: 0.5 },
    // LOOPS que se repiten (2026-11-11, al escucharlo): el disco real aguanta el mismo loop 16, 32 o
    // 64 compases y lo que se mueve es pequeño. Antes: carriles impares por todas partes (7, 5, 3) y
    // un 3–32 % de golpes que no salían al azar en cada compás → ni un compás igual al de 4 antes
    // (0,1 %): sonaba a «generativo», no a groove. Ahora: carriles de compás y FRASES DE DOS
    // COMPASES (pregunta y respuesta), alguna polimetría que cierra pronto (12, 6, 3) y casi ningún
    // golpe al azar
    'perc.len': { 16: 4, 12: 2, 10: 0.4, 7: 0.8, 6: 2, 5: 0.6, 3: 1.2 },
    'lead.len': { 16: 4, 12: 1.2, 8: 1.5, 6: 0.6 },
    'perc.phrase': 0.4,  // un carril de 16 pasa a ser una frase de 2 compases (32)
    'lead.phrase': 0.6,  // la percusión principal, casi siempre: es el gancho
    'perc.decay': [0.03, 0.14],   // cortas y secas
    'perc.pan': [-0.85, 0.85],    // más abiertas: cada una en su sitio
    'perc.acc': [0.3, 1],         // más diferencia entre golpes: micro-dinámica
    'perc.prob': [0.93, 1],       // casi todos los golpes salen: el loop se reconoce
    'loop.sure': 0.6,             // y los fuertes (acento ≥ 0,6), siempre: solo varían los fantasmas
    // (`loop.bars`, cada cuántos compases vuelven a empezar los carriles, lo sortea cada universo:
    // ver loopBars, abajo)
    // al mutar: girar y quitar/poner golpes (micro-variación), casi nunca otro sonido
    'perc.mut': { rot: 5, k: 4, sound: 0.5, len: 0.3 },
    // MUTACIÓN (deck.js): solo al empezar frase (cada 8 compases) y menos; la fuerte de cada 32, a veces
    'mut.every': 8, 'mut.perc': 0.7, 'mut.hat': 0.6, 'mut.foley': 0.5, 'mut.force': 0.5,
    // FOLEY: «creak, click, croak, pitter-patter and tock» [EB, Barac]: madera, arena, agua, papel
    'foley.mat': { papel: 1.2, plastico: 0.8, aluminio: 0.6, tela: 1, madera: 1.6, metal: 0.9, vidrio: 1, arena: 1.3, agua: 1.2 },
    'foley.mut': { rot: 4, k: 3, sound: 0.6 },
    // EAR CANDY (generators.js, FoleyGen.candyBar; 2026-11-11, al escucharlo): el foley NO es un
    // carril del loop sino un detalle que aparece de vez en cuando («faint room ambiences, foley» [MD],
    // ear candy que se deja caer en una reverb o un eco [Audient, KVR]): por compás, esta probabilidad
    // × CANTIDAD (más al final de frase); a veces con una respuesta. Como carril sonaba en el 77 % de
    // los compases y ocupaba la mitad de cada uno: hacía de ritmo
    'candy.rate': 0.15, 'candy.pair': 0.3,
    // (los carriles siguen existiendo: de ellos sale qué objeto suena)
    'foley.len': { 32: 3, 24: 0.5, 20: 0.3, 16: 3, 12: 0.8, 10: 0.2, 7: 0.2 },
    'foley.prob': [0.85, 1],
    // BASS: en los huecos del kick (el 1 y los tiempos pesan más), semicorcheas que ruedan [MD, PML];
    // una o dos alturas: «one or two core tones» [MD]
    'bass.cat': [0.28, 0.4, 1.15, 0.95], // corchea en contratiempo · semicorchea · el 1 · los otros tiempos
    'bass.deg': { 0: 14, 7: 4, 4: 1.2, 6: 0.8, 2: 0.6, 1: 1.4, 3: 0.6, '-3': 1.6 },
    'bass.derive': { 0: 4, 7: 2, 4: 0.6, 6: 0.4, 2: 0.3, 9: 0.6, 11: 0.3 },
    // la RESPUESTA (2º compás de la frase): contesta sobre todo con la octava y la quinta
    'bass.answer': { 7: 3, 4: 2, '-3': 2, 0: 1.5, 1: 0.7, 2: 0.5, 6: 0.5 },
    'bass.pitch': [0.42, 0.8], // umbrales de la complejidad del bajo: solo tónica · pocas notas (antes 0,3 · 0,55)
    // ARMONÍA: casi siempre un solo acorde; voicings abiertos (dub: 5ª, 7ª, 9ª sin 3ª) y huecos
    'harm.voicing': [1.5, 4, 2, 0.8, 2.5], // séptima · abierto dub · cuartas · add9 · 5ª + 10ª
    'harm.prog': [9, 2, 1, 0.4],
    'harm.alt': { 3: 3, 5: 1.5, '-2': 1.5, '-1': 2.5, 4: 2 },
    'harm.padEvery': { 2: 0.3, 4: 2, 8: 0.6 },
    'harm.mut': { rhythm: 5, alt: 1.5, prog: 0.8, voicing: 0.4 },
    // COMPLEJIDAD (NUEVO UNIVERSO): kick quieto, percusión rica, bajo que rueda, armonía escasa
    // (PERCS más bajo desde 2026-11-11: con 0,45–0,85 la percusión llenaba casi todas las semicorcheas)
    'cx.kick': [0.05, 0.45], 'cx.perc': [0.35, 0.7], 'cx.bass': [0.3, 0.7], 'cx.inst': [0.1, 0.45],
    // OSCILADORES: más encendidos (micro-variación) pero cortos y lentos: «peaks and troughs barely
    // perceptible» [RA Mihigh]
    'oscOn.kick': 0.15, 'oscOn.perc': 0.75, 'oscOn.bass': 0.5, 'oscOn.inst': 0.35,
    'osc.b': [0.08, 0.25],
    'osc.gest': [0, 1, 3.5, 1.5, 1, 2.5, 3], // — · REMATE · RESPIRA · PREGUNTA · BAILA · CRECE · OLA
    'osc.slow': { bar2: 2.2, bar: 1.6, half: 0.6, beat: 0.35 }, // variantes: las lentas
    // CANT · VAR: hats que ciclan sus 4 o 5 sonidos («cycle four or five samples» [RMC]) pero sin
    // llenar todos los pasos; percusión y foley con POCOS golpes (2026-11-11: antes ~13 golpes de
    // percusión y 16 de hats por compás, una pared): «only what is essential»
    'kit.hat.amt': [0.35, 0.6], 'kit.hat.vary': [0.5, 0.9],
    'kit.perc.amt': [0.3, 0.55], 'kit.perc.vary': [0.3, 0.7],
    'kit.foley.amt': [0.25, 0.5], 'kit.foley.vary': [0.25, 0.6],
    // TRANSICIONES sobrias: «It's not about moments or big drops» [Livio & Roby, XLR8R]
    'fx.amount': [0.25, 0.55], 'fx.riser': { noise: 4, tone: 1, both: 1.5 }, 'fx.wobble': 0.12,
    'fx.boom': 0.55, 'fx.thud': 0.65, 'fx.gapP': 0.12, 'fx.down': 0.8,
    'fx.crashDecay': [0.8, 1.6], 'fx.tensionHz': [180, 450], 'fx.downHz': [600, 1600],
    'fx.vRiser': { noise: 3, tone: 0.6, both: 1, tonal: 1.2 },
    'fx.vRoll': { snare: 0.6, clap: 0.6, rim: 2.5, tom: 1.2, self: 2 },
    'fx.vPattern': { acelera: 1.2, recto: 1.5, tresillo: 1.5, fantasma: 4 },

    // MEZCLA DE LA PERCUSIÓN (deck.js; 2026-11-11, al escucharlo: percs y foley con demasiado
    // protagonismo). Como en un estudio: hats, percs y foley en un BUS sin el kick, comprimido
    // suave (lo pega y doma los golpes puntiagudos) y con SIDECHAIN del kick, para que el kick
    // asome entre ellos [Attack bus, MusicRadar mix]. El CLAP fuera de los dos: cae con el kick y
    // con el sidechain desaparecería
    bus: { thr: -26, ratio: 3, knee: 8, attack: 0.003, release: 0.12 },
    // cuánto baja cada uno con cada kick (× el sidechain del universo, kick.duck ≈ 0,18–0,32): la
    // percusión ≈ −3…−5 dB, los hats algo, el foley como la percusión
    'duck.perc': 1.6, 'duck.foley': 1.4, 'duck.hat': 0.8, 'duck.ohat': 0.9,

    // ESPACIO (space.js): los efectos creativos. En minimal el delay es PARTE DEL RITMO, no un
    // adorno [MusicRadar]: ecos dub de corchea en stabs y percusión, ping-pong [Attack]; la reverb,
    // «corta y deliberada»: salas, nada de colas lavadas [RMC], «carefully tuned reverbs» [MD]
    'space.amt': [0.6, 1],
    'dly.on': 0.95,
    // corchea y corchea con puntillo (el eco dub que rueda); negra con puntillo a veces
    'dly.div': { '8': 2.5, '8.': 4, '4': 0.5, '4.': 1.5, '8T': 0.4 },
    'dly.pingpong': 0.7,
    // repeticiones largas que se oscurecen y adelgazan: cada eco más lejos («dubby», [EB])
    'dly.fb': [0.35, 0.6], 'dly.tone': [1100, 3200], 'dly.hp': [300, 750],
    // cinta: algo de saturación y de vaivén («a bit of movement here and there» [Caia])
    'dly.drive': [0.15, 0.45], 'dly.wow': [0.0004, 0.0018], 'dly.wowHz': [0.2, 0.6],
    'dly.rev': [0.12, 0.35],
    // a quién: los stabs (dub) y la percusión (rims que rebotan); hats casi secos (nítidos)
    // (el CLAP nunca, desde 2026-11-11: al escucharlo, demasiado clap en el eco y en la sala)
    'dly.focus': { chord: 4, perc: 3.5, clap: 0, hat: 0.4, foley: 1.2 },
    'dly.focusSend': [0.25, 0.45],
    'dly.hat': [0, 0.03], 'dly.ohat': [0, 0.04], 'dly.perc': [0.02, 0.14], 'dly.clap': [0, 0.03],
    'dly.foley': [0.06, 0.18], 'dly.chord': [0.05, 0.22], 'dly.pad': [0, 0.06],
    // THROWS: al final de frase, mejor un eco que un riser (ROMINIMAL.md §7)
    'dly.throw': [0.3, 0.65], 'dly.throwAmt': [0.55, 0.9], 'dly.throwEvery': { 8: 2, 16: 1.2 },
    // la SALA: corta, cálida, con carácter de habitación (reflexiones tempranas)
    'rev.decay': [0.3, 0.9], 'rev.pre': [0.004, 0.02], 'rev.damp': [2200, 5500], 'rev.early': [0.4, 0.8],
    'rev.width': [0.7, 1], 'rev.hp': [250, 450],
    // a quién: la percusión, el clap y el foley en la misma habitación («faint room ambiences,
    // foley» [MD]); hats secos; armonía y pad algo; las transiciones, poco (sobrias)
    // (el CLAP casi seco desde 2026-11-11: con 0,14–0,3 era lo más mojado de la batería y, fuera del
    // bus y del sidechain, sonaba lejos y grande; ahora un poco de sala, nada de eco)
    'rev.hat': [0, 0.06], 'rev.perc': [0.1, 0.26], 'rev.clap': [0.03, 0.1], 'rev.ohat': [0, 0.1],
    'rev.foley': [0.2, 0.4], 'rev.chord': [0.06, 0.2], 'rev.pad': [0.12, 0.3], 'rev.fx': [0.1, 0.25],
    // FONDO (2026-11-11): el colchón. Casi siempre; más largo y más oscuro que en NORMAL. El foley y
    // las transiciones se funden en él (el «faint room ambience» que no se sabe de dónde sale);
    // percusión y hats apenas lo tocan (nítidos delante). (Los envíos salen tras el fader: el pad, a
    // −40, aporta poco; sube si se sube su fader)
    'bg.on': 0.95,
    'bg.decay': [5, 9], 'bg.pre': [0.03, 0.08], 'bg.damp': [1000, 2200], 'bg.lp': [1800, 3600],
    'bg.hp': [250, 450], 'bg.comp': [0.7, 1],
    'bg.hat': [0, 0.03], 'bg.perc': [0.02, 0.1], 'bg.ohat': [0.02, 0.1], 'bg.foley': [0.35, 0.7],
    'bg.chord': [0.03, 0.15], 'bg.pad': [0.25, 0.5], 'bg.fx': [0.4, 0.75],
  },
  // el «salto» del kick (fantasma en la 1ª mitad) y el golpe «en medio de un loop de 4 compases»
  // [XLR8R]: probabilidad por compás de cada universo
  kickSkip: [0.1, 0.35],
  kickPickup: [0, 0.25],
  // la POLIMETRÍA CIERRA (generators.js, loopPos): los carriles de percusión y foley vuelven a empezar
  // cada 2 o 4 compases (el «master length» de una caja de ritmos). Antes giraban sin fin y ningún
  // compás era igual al de 4 antes: sonaba a azar, no a loop
  loopBars: { 2: 1, 4: 2 },
  // JERARQUÍA de la percusión (generators.js, PercGen.bar): la principal delante y las otras detrás,
  // de −4 a −8 dB (× velocidad: los golpes flojos usan además la capa floja de su sonido). Antes
  // sonaban todas igual y competían: «enough to give the impression of ambience, but not so much
  // that they bury your core drum sounds» [MusicRadar mix]
  percBack: [0.4, 0.63],

  // GROOVE por instrumento (deck.js, grooveTime; 2026-11-11, la sesión 16 de la HOJA_DE_RUTA). Lo
  // de siempre es UN swing para todo y un temblor al azar. Un baterista (o una MPC con su plantilla)
  // no es eso: cada instrumento tiene su swing y su sitio, y el empuje-tirón es un DIBUJO que se
  // repite cada compás, no ruido [RMC: «push-and-pull of a jazz drummer, not programmed funk»,
  // hats unos ms antes o después (Barac), cuantizar al 70–80 %; Attack: swing de MPC al 60 % en
  // minimal; RA: «skippy drums», «screwface-inducing shuffle»]. Cada universo sortea:
  //   sw    swing de cada uno SOBRE el del universo (color: 55–58 %): hats y percs más (hasta ~65 %,
  //         la «cojera» del género), bajo y acordes menos (el suelo, más recto). El kick, recto
  //   off   cada uno entero adelantado o atrasado (s): hats delante o detrás, percs algo detrás,
  //         acordes perezosos (los stabs que caen tarde)
  //   lay8  hats y percs: la corchea a contratiempo algo detrás (el «tss» que se deja caer)
  //   push  hats y percs: la semicorchea antes del tiempo algo delante (empuja hacia el 1)
  //   fine  la HUELLA: cada paso con un desvío pequeño FIJO (igual en cada compás). Con el temblor
  //         al azar, ya poco, es el «cuantizar al 70–80 %»
  groove: {
    sw: { hat: [0.01, 0.05], perc: [0.02, 0.07], bass: [-0.03, 0], chord: [-0.02, 0.02] },
    off: { hat: [-0.004, 0.005], perc: [-0.002, 0.006], bass: [-0.002, 0.003], chord: [0, 0.008] },
    lay8: [0, 0.004], push: [-0.004, 0.001], fine: 0.0015,
  },

  // MEZCLA con la que nace (dB del fader, como los presets de mix.js): la percusión delante, los hats
  // presentes sin morder, el kick «sin dominar» [RMC], armonía y pad al fondo, transiciones apenas
  // (DELAY y REVERB a 0 dB: cuánto efecto lleva ya está en sus envíos)
  // (2026-11-11: percusión −9 → −11 y foley −10,5 → −14 → −17. Con 3 o 4 carriles a la vez, la
  // percusión sumaba casi lo que el kick; el foley es «faint», ear candy que se descubre: medido, a
  // −14 sus gestos picaban como la percusión)
  // (2026-11-11: pad −17 → −40. En este género el pad es solo un colchón: se nota si falta, no se
  // oye. Igual irán los elementos de atmósfera que vengan)
  // (2026-11-11, al escucharlo: percusión −11 → −22, por detrás, y el open −17 → −10)
  // (2026-11-11, después: LA MEZCLA DEL USUARIO, la que dejó a oído en el navegador con un universo
  // ROMINIMAL a tope (DUB). Es también el preset ROMINIMAL del MIXER (mix.js), el de por defecto)
  mix: { kick: -4.4, bass: -9.2, hat: -13.9, perc: -23.4, clap: -14, ohat: -10.1, foley: -14.1, chord: -22.2, pad: -54.7, dly: 0, rev: 0, bg: -6.4, fx: -11.8 },

  // ENVÍOS: el recorte del usuario (dB) sobre lo que sortea cada universo, por efecto e instrumento.
  // Lo ajustó a oído con las perillas de ENVÍOS del MIXER (2026-11-11, mismo universo DUB). Se
  // aplica al final de makeSpace (space.js), así sirve para cualquier arquetipo y también al
  // protagonista del eco y a sus throws. Con el fader a medias, a medias (en ganancia); en NORMAL, nada
  sendTrim: {
    dly: { perc: -2.8, chord: -14.6, ohat: -Infinity },
    rev: { perc: -6.5, chord: -5.5 },
    bg: { hat: -26.6, perc: -24.9, ohat: -25.9, foley: -4.4, chord: -22.6 },
  },

  // ARQUETIPOS: `w` = probabilidad · `mute` = probabilidad de nacer en MUTE (× t; kick y bajo nunca) ·
  // `mix` = dB sobre la mezcla del estilo · `k` = sustituye datos de arriba · `mul` = multiplica pesos ·
  // bassModes / chordModes = probabilidades de cada modo · kickSkip = el salto del kick
  arch: {
    rodante: {
      w: 3, label: 'RODANTE',
      desc: 'la percusión rueda y manda, con un bajo que rueda: el «roller» clásico ([a:rpia:r], Raresh, Arapu)',
      mute: { clap: 0.35, ohat: 0.45, chord: 0.5, pad: 0.5, foley: 0.1 },
      mix: { perc: 1, chord: -1, pad: -1 },
      k: {
        'kit.perc.amt': [0.4, 0.65], 'kit.perc.vary': [0.45, 0.8], 'kit.hat.amt': [0.35, 0.55], 'kit.hat.vary': [0.45, 0.85],
        'kit.foley.amt': [0.2, 0.45], 'kit.foley.vary': [0.2, 0.5], 'cx.perc': [0.45, 0.75], 'cx.bass': [0.4, 0.75],
      },
      mul: { 'perc.type': { reso: 1.3, tone: 1.2, modal: 1.1 }, 'dly.focus': { perc: 2, chord: 0.6 } },
      bassModes: { pluck: 3, round: 3, sub: 1, acid: 1 },
      percBack: [0.5, 0.7], // la percusión rueda entera: las de atrás, menos atrás
    },
    esqueleto: {
      w: 2, label: 'ESQUELETO',
      desc: 'kick, bajo, hats y una o dos percusiones: lo mínimo, «stripped-back» (Dan Andrei)',
      mute: { clap: 0.55, ohat: 0.6, chord: 0.8, pad: 0.75, foley: 0.4 },
      mix: { hat: 1, bass: 0.5, foley: -2 },
      k: {
        'kit.perc.amt': [0.25, 0.45], 'kit.perc.vary': [0, 0.3], 'kit.hat.amt': [0.4, 0.62], 'kit.hat.vary': [0.5, 0.9],
        'kit.foley.amt': [0.2, 0.4], 'kit.foley.vary': [0.1, 0.35], 'cx.perc': [0.25, 0.5], 'cx.bass': [0.25, 0.6], 'cx.inst': [0.05, 0.3],
        // casi seco: lo mínimo también en el espacio
        'space.amt': [0.35, 0.65], 'rev.decay': [0.25, 0.6],
      },
      mul: { 'dly.focus': { perc: 1.5, chord: 0.4 } },
      bassModes: { sub: 3, pluck: 2, round: 1.5, acid: 0.5 },
      kickSkip: [0.05, 0.2],
    },
    bosque: {
      w: 1.5, label: 'BOSQUE',
      desc: 'foley y un poco de hats: crujidos, golpecitos, gotas («a little rainforest», Barac)',
      mute: { perc: 0.7, clap: 0.7, ohat: 0.7, chord: 0.5, pad: 0.35 },
      mix: { foley: 3, hat: -1, perc: -2 },
      k: {
        'kit.foley.amt': [0.45, 0.7], 'kit.foley.vary': [0.5, 0.85], 'kit.hat.amt': [0.3, 0.5], 'kit.hat.vary': [0.25, 0.6],
        'kit.perc.amt': [0.25, 0.45], 'kit.perc.vary': [0.1, 0.35], 'cx.perc': [0.3, 0.6], 'cx.inst': [0.1, 0.4],
        // el foley dentro de su habitación (algo más grande) y rebotando
        'rev.foley': [0.25, 0.45], 'rev.decay': [0.5, 1.1],
        // aquí el foley es lo que pasa: aparece a menudo (casi un compás de cada dos) y contesta más
        'candy.rate': 0.5, 'candy.pair': 0.6,
      },
      mul: {
        'dly.focus': { foley: 4, chord: 0.5 },
        'perc.type': { grains: 1.4, ks: 1.3, modal: 1.2 },
        'foley.mat': { madera: 1.4, agua: 1.7, arena: 1.4, vidrio: 1.3, tela: 1.2, plastico: 0.7, aluminio: 0.7 },
      },
      bassModes: { sub: 2, pluck: 2, round: 2, acid: 0.5 },
    },
    dub: {
      w: 1.5, label: 'DUB',
      desc: 'acordes dub y bajo redondo, más hondo y más grave (Sublee, Priku, los «dubby basslines»)',
      mute: { clap: 0.35, ohat: 0.5, pad: 0.4, foley: 0.3, perc: 0.1 },
      mix: { chord: 2.5, bass: 0.5, perc: -1 },
      k: {
        'cx.bass': [0.2, 0.55], 'cx.inst': [0.25, 0.55], 'cx.perc': [0.3, 0.6], 'kit.perc.vary': [0.25, 0.55],
        // el eco manda: stabs que se repiten mucho y se oscurecen, y más throws
        'dly.fb': [0.5, 0.66], 'dly.tone': [900, 2400], 'dly.focusSend': [0.32, 0.5], 'dly.throw': [0.5, 0.85],
      },
      mul: { 'perc.type': { fm: 1.2, tone: 1.2, noise: 1.3 }, 'dly.focus': { chord: 2.5 } },
      bassModes: { sub: 3, round: 3, pluck: 1, acid: 0.3 },
      chordModes: { dub: 6, keys: 1, organ: 0.5 },
      // los stabs, perezosos: caen detrás del tiempo, como en el dub
      groove: { off: { hat: [-0.004, 0.005], perc: [-0.002, 0.006], bass: [-0.002, 0.003], chord: [0.004, 0.012] } },
    },
    organico: {
      w: 1.5, label: 'ORGÁNICO',
      desc: 'un pad que sube despacio, acordes como teclas, madera y objetos (Petre Inspirescu, Amorf)',
      mute: { clap: 0.5, ohat: 0.5, chord: 0.4 },
      mix: { pad: 2.5, chord: 1, foley: 1, perc: -1, hat: -1 },
      k: {
        'cx.inst': [0.25, 0.6], 'cx.perc': [0.35, 0.65], 'kit.foley.amt': [0.35, 0.6], 'kit.foley.vary': [0.4, 0.7],
        'kit.hat.amt': [0.3, 0.5],
        // la sala algo más grande, con el pad y las teclas dentro
        'rev.decay': [0.6, 1.3], 'rev.pad': [0.2, 0.38], 'rev.chord': [0.12, 0.28],
        'candy.rate': 0.25, // los objetos asoman algo más
      },
      mul: {
        'dly.focus': { chord: 1.3, foley: 1.5 },
        'perc.type': { modal: 1.6, ks: 1.4, reso: 1.2, glitch: 0.5, fm: 0.6 },
        'hatEng.fino': { grains: 1.5 },
        'foley.mat': { madera: 1.3, agua: 1.3, tela: 1.4, plastico: 0.5, aluminio: 0.6 },
      },
      bassModes: { round: 3, sub: 2, pluck: 2, acid: 0.3 },
      chordModes: { keys: 3, organ: 2.5, dub: 1 },
    },
    clics: {
      w: 1.5, label: 'CLICS',
      desc: 'clics, granos y chasquidos sobre un bajo seco: la escuela Villalobos / Perlon («squelch and click»)',
      mute: { clap: 0.45, ohat: 0.5, chord: 0.65, pad: 0.75, foley: 0.1 },
      mix: { perc: 0.5, hat: 0.5, foley: 1, bass: -0.5 },
      k: {
        'cx.perc': [0.5, 0.8], 'cx.kick': [0.1, 0.55], 'kit.hat.amt': [0.4, 0.65], 'kit.hat.vary': [0.6, 1],
        'kit.perc.amt': [0.4, 0.65], 'kit.perc.vary': [0.45, 0.85],
        // ecos cortos de clics (corchea, tresillo) y una sala mínima
        'dly.div': { '8': 3, '8.': 2.5, '4': 0.3, '4.': 0.5, '8T': 1.5 }, 'dly.fb': [0.25, 0.5], 'rev.decay': [0.2, 0.55],
      },
      mul: {
        'dly.focus': { perc: 2, hat: 3 },
        'perc.type': { glitch: 2.2, grains: 1.6, ks: 1.3, tone: 0.7, modal: 0.7 },
        'hatEng.tick': { hiss: 1.6, fm: 1.3 },
        'hatEng.fino': { hiss: 1.4, grains: 1.2 },
        'foley.mat': { papel: 1.7, plastico: 2, aluminio: 2.2, metal: 1.3, agua: 0.4, tela: 0.6 },
      },
      bassModes: { pluck: 3, acid: 2.5, round: 1, sub: 1 },
      kickSkip: [0.15, 0.45],
      percBack: [0.5, 0.7], // el juego de clics es de todas
      // más cojo: «skippy drums», la escuela Villalobos / Perlon
      groove: { sw: { hat: [0.03, 0.07], perc: [0.04, 0.09], bass: [-0.03, 0], chord: [-0.02, 0.02] } },
    },
  },
};

export const STYLES = { rominimal: ROMINIMAL };
export const DEFAULT_STYLE = 'rominimal';

// ───────────────────────── EL ESTILO DE UN UNIVERSO
// De la semilla del universo y del fader `t`: arquetipo, modos, MUTE, mezcla, datos de generación y
// rangos de color. Con su propio dado (la semilla con otra sal): los de siempre no se tocan, y la
// misma semilla con el mismo t da siempre lo mismo. Las tiradas no dependen de t (con más t, las
// mismas decisiones pesan más): moverlo un poco no cambia de arquetipo ni de MUTE de golpe
// `purity` (0..1, PUREZA): cuánto respeta el universo su estilo (ver «PUREZA», arriba). Con 1, sin
// aflojar nada (las mismas tiradas que antes de existir la perilla)
export function rollStyle(seed, t, name = DEFAULT_STYLE, purity = 1) {
  t = clamp(t);
  const P = STYLES[name];
  if (!(t > 0) || !P) return NORMAL;
  const r = new Rng((seed ^ 0x2c1b3c6d) >>> 0);
  const Lq = { loose: 1 - clamp(purity), lseed: (seed ^ 0x7a3d91c5) >>> 0 };
  const loose = (key, w) => { const L = looseOf(Lq, key); return L ? flatten(w, L) : w; };
  const names = Object.keys(P.arch);
  const arch = r.weighted(names, loose('arch', names.map((n) => P.arch[n].w)));
  const A = P.arch[arch];
  const mode = (modes, w, key) => {
    const ks = Object.keys(modes);
    return r.weighted(ks, loose(key, ks.map((m) => w[m] ?? 0)));
  };
  const bassMode = mode(P.bassModes, A.bassModes ?? P.bassModeW, 'mode.bass');
  const chordMode = mode(P.chordModes, A.chordModes ?? P.chordModeW, 'mode.chord');
  // MUTE: una tirada por instrumento, siempre en el mismo orden; suena con probabilidad × t (con
  // menos PUREZA, cada probabilidad se desvía hacia la suya)
  const mutes = [];
  for (const k of INSTRUMENTS) {
    const p = (A.mute[k] ?? 0) * t, L = k === 'kick' || k === 'bass' ? 0 : looseOf(Lq, `mute.${k}`) * 0.7;
    if (r.next() < (L ? lerp(p, 0.6 * keyU(Lq.lseed, `mute.${k}!`), L) : p)) mutes.push(k);
  }
  if (mutes.includes('perc') && mutes.includes('foley')) mutes.splice(mutes.indexOf('foley'), 1); // siempre queda algo de percusión
  // MEZCLA: la del estilo, lo del arquetipo, lo de los modos (un modo más lleno, algo más abajo) y
  // ±1 dB de cada universo (nunca por encima de 0 dB; con menos PUREZA, hasta ±3 dB)
  const BM = P.bassModes[bassMode].mix || {}, CM = P.chordModes[chordMode].mix || {};
  const mix = {}, mixVar = Lq.loose ? 1 + 2 * Lq.loose : 1;
  for (const k of [...INSTRUMENTS, 'fx']) mix[k] = Math.min(0, P.mix[k] + (A.mix?.[k] ?? 0) + (BM[k] ?? 0) + (CM[k] ?? 0) + r.float(-1, 1) * mixVar);
  // los RETORNOS (DELAY, REVERB) sin tirada: cuánto efecto lleva ya está en sus envíos (space.js)
  for (const k of RETURNS) mix[k] = Math.min(0, (P.mix[k] ?? 0) + (A.mix?.[k] ?? 0));
  // GENERACIÓN: lo del estilo, lo que sustituye el arquetipo, los modos y lo que multiplica
  const k = { ...P.k, ...(A.k || {}), ...P.bassModes[bassMode].k, ...P.chordModes[chordMode].k };
  for (const [key, m] of Object.entries(A.mul || {})) {
    for (const kk of key === 'perc.type' ? ['perc.type', 'perc.lead'] : [key]) {
      const base = k[kk];
      k[kk] = Object.fromEntries(Object.entries(base).map(([it, w]) => [it, w * (m[it] ?? 1)]));
    }
  }
  k['kick.skip'] = r.float(...(A.kickSkip ?? P.kickSkip));
  k['kick.pickup'] = r.float(...(A.kickPickup ?? P.kickPickup));
  if (P.loopBars) {
    const LB = A.loopBars ?? P.loopBars, lens = Object.keys(LB);
    k['loop.bars'] = +r.weighted(lens, lens.map((x) => LB[x]));
  }
  if (P.percBack) k['perc.back'] = r.float(...(A.percBack ?? P.percBack));
  if (P.groove) k['groove'] = rollGroove(r, { ...P.groove, ...(A.groove || {}) });
  if (P.bassFeel) k['bass.feel'] = rollBassFeel(r, P, bassMode, t, Lq);
  // COLOR: [t, lo0, hi0, lo1, hi1...] en el orden de COLOR_PARAMS (con menos PUREZA, cada rango se
  // ensancha hacia lo que da el color de siempre)
  const C = { ...P.color, ...P.bassModes[bassMode].color, ...P.chordModes[chordMode].color };
  const color = new Float64Array(1 + 2 * COLOR_PARAMS.length);
  color[0] = t;
  const N = Lq.loose ? natural() : null;
  COLOR_PARAMS.forEach((p, n) => {
    let [lo, hi] = C[p];
    const L = N ? looseOf(Lq, `color.${p}`) : 0;
    if (L) { lo = lerp(lo, Math.min(lo, N[n][0]), L); hi = lerp(hi, Math.max(hi, N[n][1]), L); }
    color[1 + 2 * n] = lo;
    color[2 + 2 * n] = hi;
  });
  // ENVÍOS: el recorte del estilo (`sendTrim`) en ganancia, a medias con el fader (1 = como siempre)
  const sends = {};
  for (const [fx, ks] of Object.entries(P.sendTrim || {})) {
    sends[fx] = {};
    for (const [kk, d] of Object.entries(ks)) sends[fx][kk] = 1 + ((d === -Infinity ? 0 : Math.pow(10, d / 20)) - 1) * t;
  }
  return { name, label: P.label, t, arch, archLabel: A.label, archDesc: A.desc, bassMode, chordMode, mutes, mix, k, color, v: P.v, a: P.a, sends, purity: 1 - Lq.loose, loose: Lq.loose, lseed: Lq.lseed };
}

// GROOVE de un universo (ver `groove` en ROMINIMAL): por instrumento, su swing de más (`sw`) y su
// dibujo de 16 pasos (`tm`, s: entero + empuje-tirón + huella). Siempre las mismas tiradas, en orden
export const GROOVE_INST = ['hat', 'perc', 'bass', 'chord'];
function rollGroove(r, G) {
  const lay8 = r.float(...G.lay8), push = r.float(...G.push);
  const out = {};
  for (const inst of GROOVE_INST) {
    const sw = r.float(...G.sw[inst]), off = r.float(...G.off[inst]);
    const drum = inst === 'hat' || inst === 'perc';
    // en el tiempo (paso 0, 4, 8, 12) solo el entero: ahí manda el kick
    const tm = Array.from({ length: 16 }, (_, s) => {
      const q = s % 4;
      return off + (drum ? (q === 2 ? lay8 : q === 3 ? push : 0) : 0) + (q ? r.float(-G.fine, G.fine) : 0);
    });
    out[inst] = { sw, tm };
  }
  return out;
}

// CÓMO SE TOCA EL BAJO de un universo (`bassFeel`, `bassPhrase`): probabilidades × t (a medio fader,
// menos deslizamientos y notas largas; con t bajo, a veces sin respuesta: lo de siempre), la frase,
// el filtro lento y una semilla para lo que el BassGen fija por paso (generators.js)
// (con menos PUREZA, `Lq`: las probabilidades de cada paso se desvían, todas las celdas y frases
// entran, y el motivo deja más notas fuera de la celda: `cellLoose`, ver generators.js cellMotif)
function rollBassFeel(r, P, mode, t, Lq) {
  const F = P.bassFeel[mode], PW = P.bassPhrase, ph = Object.keys(PW);
  const lw = (key, w) => { const L = looseOf(Lq, key); return L ? flatten(w, L) : w; };
  const lp = (key, p) => { const L = looseOf(Lq, key) * 0.7; return L ? lerp(p, 0.5 * keyU(Lq.lseed, key + '!'), L) : p; };
  const phrase = r.weighted(ph, lw('bass.phrase', ph.map((p) => PW[p])));
  const answer = r.next() < t;
  const [b0, b1] = P.bassSweepBars;
  const p1 = r.float(b0, b1);
  const PK = Object.keys(F.pitch);
  const pitchKind = r.weighted(PK, lw('bass.pitchKind', PK.map((k) => F.pitch[k])));
  const pitchAmt = pitchKind === 'blip' ? r.float(...F.blip) : pitchKind === 'scoop' ? -r.float(...F.scoop) : 0;
  return {
    phrase: answer ? phrase : null,
    glide: lp('bass.glide', F.glide) * t, legato: lp('bass.legato', F.legato) * t,
    cellLoose: looseOf(Lq, 'bass.cell'),
    glideTau: r.float(...F.glideTau),
    // la NOTA LARGA con intención: en qué contratiempo, cuántos pasos y en qué compases (null: no hay)
    long: r.next() < lp('bass.long', F.long) * t ? { step: r.pick([2, 6, 10, 14]), len: r.pick([3, 4]), every: mode === 'sub' } : null,
    // el SONIDO de cada nota (con t, desde el de siempre: sostiene 75 %, sin paso bajo, sin altura)
    sus: lerp(0.75, r.float(...F.sus), t), dec: lerp(0.15, r.float(...F.dec), t),
    post: Math.exp(lerp(Math.log(16000), Math.log(r.float(...F.post)), t)),
    pitch: { kind: pitchKind, semis: pitchAmt * t, tau: r.float(...F.pitchTau) },
    fall: { p: lp('bass.fall', F.fall) * t, semis: r.float(...F.fallSemis), dur: r.float(...F.fallDur) },
    range: P.bassRange, octaveMax: P.bassOctaveMax,
    sweep: {
      oct: r.float(...F.sweep) * t,
      p1, p2: p1 * r.float(0.31, 0.43), ph1: r.next(), ph2: r.next(),
    },
    seed: Math.floor(r.next() * 4294967296),
    // la CELDA de alturas y el REMATE de final de frase (dirección y cada cuántos compases)
    cell: P.bassCells[r.weighted(Object.keys(F.cells), lw('bass.cells', Object.values(F.cells)))],
    walk: r.pick(['up', 'down', 'down']),
    walkEvery: +r.weighted(Object.keys(P.bassWalkEvery), Object.values(P.bassWalkEvery)),
  };
}

// el FILTRO LENTO del bajo en el compás `x` (con decimales): cuántas octavas se mueve el corte
export function bassSweep(F, x) {
  const S = F.sweep;
  return S.oct * (0.65 * Math.sin(2 * Math.PI * (x / S.p1 + S.ph1)) + 0.35 * Math.sin(2 * Math.PI * (x / S.p2 + S.ph2)));
}

// para enseñarlo: «ROMINIMAL 70 % · RODANTE»
// (con PUREZA por debajo del 100 %, también la pureza)
export const styleName = (sty) => (sty.t > 0
  ? `${sty.label} ${Math.round(sty.t * 100)} % · ${sty.archLabel}${sty.purity < 1 ? ` · PUREZA ${Math.round(sty.purity * 100)} %` : ''}`
  : 'NORMAL');
