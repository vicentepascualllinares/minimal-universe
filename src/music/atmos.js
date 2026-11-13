// CRUJIDO Y RUIDO (2026-11-13; antes TEXTURA y AMBIENTE, 2026-11-12) — las capas de fondo, solo en
// universos con ESTILO (ROMINIMAL). Cuatro canales en el MIXER, cada uno con UNA capa:
//
//   CRUJIDO 1 · 2  lo crujiente, a sucesos sueltos: VINILO (crujido y rayas, sin siseo), LLUVIA, FUEGO y
//                  PÁJAROS (sucesos sueltos también, aunque tonales)
//   RUIDO 1 · 2    lo continuo: CINTA (soplido), SALA (el aire de una habitación), VIENTO, CIUDAD lejana y
//                  el DRON (continuo también, aunque tonal: en la escala del universo)
//
// CUÁNTAS (investigado 2026-11-13, ver ROMINIMAL.md §7): de 1 a 4 capas por universo, como mucho dos de
// cada tipo; lo normal, 1 o 2 sonando a la vez. Las dos primeras suenan siempre (con la estructura); la
// 3.ª y la 4.ª ENTRAN Y SALEN solas cada 16–32 compases («un elemento entra o sale cada 8–16 compases»).
// Las dos siguen a la ESTRUCTURA (`ATM_PRESENCE`): lo crujiente mucho (manda en BREAK y DRIFT, casi se va
// con todo dentro), el ruido poco (como mucho −6 dB).
//
// NIVEL: nacen muy abajo, «para nada son protagonistas» (el usuario, 2026-11-13): los cuatro faders a
// −46 dB y, dentro, cada sonido con su recorte (`TRIM`): vinilo, cinta y sala 18 dB más abajo (−64 en
// total, lo que el usuario puso a la TEXTURA).
//
// LA MARCA (motor ALPHA sin quitar nada, src/motores/LEEME.md): solo los universos que nacen con ellas
// (Engine.novelties.atmos): `style.atmos = 2` y «-AT2» en el CÓDIGO DE SEMILLA. Un código o un archivo
// sin marca suena exactamente igual que antes (sin estos canales: ni se crean sus nodos). («-AT1», la
// primera versión, duró un día sin ningún universo guardado: se lee y suena como esta.)
//
// Aquí solo se DECIDE (datos, con su propio dado: la semilla con otra sal, sin mover ninguna tirada de
// las de siempre). Cómo suena cada cosa (los números investigados y sus fuentes): audio/atmosSynth.js.
// Cómo se monta y se toca: audio/atmosFx.js.

import { Rng, clamp } from '../core/rng.js';

export const ATMOS_V = 2; // versión de la marca (código «-AT2»)

export const CRUNCHY = ['vinilo', 'lluvia', 'fuego', 'pajaros'];
export const NOISY = ['cinta', 'sala', 'viento', 'ciudad', 'dron'];
export const KINDS = [...CRUNCHY, ...NOISY];
export const ATMOS_CH = ['cr1', 'cr2', 'ru1', 'ru2'];
export const LABEL = { vinilo: 'VINILO', lluvia: 'LLUVIA', fuego: 'FUEGO', pajaros: 'PÁJAROS', cinta: 'CINTA', sala: 'SALA', viento: 'VIENTO', ciudad: 'CIUDAD', dron: 'DRON' };
// recorte de cada sonido dentro de su canal (dB): los faders nacen a −46; vinilo, cinta y sala, a −64
// en total (2026-11-13, a oído del usuario). El fuego, sin oír: entre los dos
export const TRIM = { vinilo: -18, cinta: -18, sala: -18, lluvia: 0, fuego: -6, pajaros: 0, viento: 0, ciudad: 0, dron: 0 };
// los que suenan en la sala del universo (REVERB y FONDO); vinilo, cinta y sala son el SOPORTE: secos
export const WET = { lluvia: true, fuego: true, pajaros: true, viento: true, ciudad: true, dron: true };
// las CAMAS (bucles grabados); pájaros y dron, no (cantos sueltos y osciladores en vivo)
export const BED = { vinilo: true, lluvia: true, fuego: true, cinta: true, sala: true, viento: true, ciudad: true };

// cuánto de cada cosa por ARQUETIPO de ROMINIMAL (styles.js): `n` = peso de tener 1, 2, 3 o 4 capas;
// `w` = peso de cada sonido; `wear` = cuánto de gastado el vinilo. El vinilo, lo más común; BOSQUE pide
// pájaros y lluvia; DUB, vinilo, cinta y dron; ESQUELETO, pocas capas
const N_W = [3, 4, 2, 1];
const ARCH = {
  rodante: { w: { vinilo: 3, lluvia: 1.2, fuego: 0.6, pajaros: 0.4, cinta: 1, sala: 1, viento: 0.8, ciudad: 1.5, dron: 0.8 }, wear: [0.2, 0.6] },
  esqueleto: { n: [5, 3.5, 1.2, 0.3], w: { vinilo: 2, lluvia: 0.8, fuego: 0.4, pajaros: 0.3, cinta: 0.8, sala: 1.5, viento: 0.5, ciudad: 1, dron: 0.6 }, wear: [0.1, 0.45] },
  bosque: { w: { vinilo: 2, lluvia: 2, fuego: 1, pajaros: 3, cinta: 0.5, sala: 0.5, viento: 1.5, ciudad: 0.2, dron: 0.4 }, wear: [0.25, 0.7] },
  dub: { w: { vinilo: 3.5, lluvia: 2, fuego: 0.6, pajaros: 0.3, cinta: 1.5, sala: 0.6, viento: 0.6, ciudad: 0.8, dron: 2 }, wear: [0.35, 0.85] },
  organico: { w: { vinilo: 2.5, lluvia: 1.5, fuego: 1.5, pajaros: 2, cinta: 0.6, sala: 1.2, viento: 1, ciudad: 0.3, dron: 1.5 }, wear: [0.3, 0.75] },
  clics: { w: { vinilo: 2, lluvia: 1, fuego: 0.5, pajaros: 0.2, cinta: 1.5, sala: 0.8, viento: 0.5, ciudad: 1.5, dron: 1 }, wear: [0.15, 0.55] },
};
const ARCH0 = { w: Object.fromEntries(KINDS.map((k) => [k, 1])), wear: [0.2, 0.7] };

// PRESENCIA en cada parte (versión 1 y 2, como las escenas de arrangement.js): manda donde cae la
// batería (BREAK, DRIFT), asoma en las subidas y queda al fondo con todo dentro
export const ATM_PRESENCE = {
  break: [0.95, 1], drift: [1, 1], build: [0.5, 0.6], kickout: [0.55, 0.6],
  intro: [0.6, 0.5], groove: [0.45, 0.4], main: [0.3, 0.3], drop: [0.35, 0.45],
};
const SEND = { rev: [0.12, 0.3], bg: [0.3, 0.65] };

// `seed` = la del universo; `sty` = su estilo (rollStyle). Null si no lleva (NORMAL)
export function rollAtmos(seed, sty) {
  if (!(sty?.t > 0)) return null;
  const r = new Rng((seed ^ 0x4a7c15e3) >>> 0);
  const A = ARCH[sty.arch] ?? ARCH0;
  // PUREZA: con menos, los pesos se aplanan (entra lo que el arquetipo casi no pide)
  const L = clamp((sty.loose ?? 0) * 1.5);
  const flat = (w) => { if (!L) return w; const m = w.reduce((a, x) => a + x, 0) / w.length; return w.map((x) => x + (m - x) * L); };
  const n = r.weighted([1, 2, 3, 4], flat(A.n ?? N_W));
  // los sonidos, sin repetir y como mucho dos de cada tipo; en el orden en que salen (las dos primeras
  // capas, siempre; las otras, entran y salen)
  const picked = [];
  while (picked.length < n) {
    const free = KINDS.filter((k) => !picked.includes(k) && (CRUNCHY.includes(k) ? picked.filter((p) => CRUNCHY.includes(p)).length < 2 : picked.filter((p) => NOISY.includes(p)).length < 2));
    picked.push(r.weighted(free, flat(free.map((k) => A.w[k]))));
  }
  const wear = r.float(...A.wear);
  let cr = 0, ru = 0;
  const layers = picked.map((kind, i) => {
    const ch = CRUNCHY.includes(kind) ? `cr${++cr}` : `ru${++ru}`;
    // la 3.ª y la 4.ª entran y salen: tantos compases dentro, tantos fuera, desde un punto del ciclo
    const gate = i < 2 ? null : { on: r.weighted([16, 24, 32], [2, 1, 2]), off: r.weighted([16, 24, 32], [2, 1, 2]), at: r.int(0, 15) };
    return { ch, kind, P: rollKind(kind, r, wear, sty.arch), gate };
  });
  return {
    v: ATMOS_V, seed: (seed ^ 0x2d9e7a61) >>> 0, layers,
    send: { rev: r.float(...SEND.rev), bg: r.float(...SEND.bg) },
  };
}

// los números de cada sonido (qué significan: atmosSynth.js)
function rollKind(kind, r, wear, arch) {
  switch (kind) {
    case 'vinilo': return {
      rpm: r.next() < 0.85 ? 100 / 3 : 45,            // LP (33⅓) o maxi / single (45)
      wear,                                           // 0 = nuevo, 1 = muy gastado
      scratches: Math.round(wear * r.float(0, 3.2)),  // rayas: un golpe sordo por vuelta
    };
    case 'lluvia': {
      const inten = r.float(0.15, 0.85);
      return {
        inten,                                          // 0 = calabobos, 1 = aguacero
        surface: r.weighted(['hojas', 'tejado', 'charco', 'tierra'], arch === 'bosque' ? [3, 0.5, 1, 1.5] : [1.2, 1.5, 1.5, 1]),
        near: r.float(2, 10) * (0.5 + inten),           // gotas cercanas que se distinguen (por segundo)
      };
    }
    case 'fuego': return {
      gens: r.int(2, 4),                              // fogones (Farnell junta 4, cada uno por su banda)
      thr: r.float(0.3, 1.3),                         // umbral de los chasquidos (más bajo = más chasquidos)
      hiss: r.float(0.2, 0.4), lap: r.float(0.4, 0.8), // siseo y «lamido» grave (crujidos: 0,2, como Farnell)
    };
    case 'pajaros': return { species: Array.from({ length: r.int(1, 3) }, () => rollSpecies(r)) };
    case 'cinta': return { tau: r.next() < 0.6 ? 120e-6 : 70e-6, lp: r.float(10000, 14000) };
    case 'sala': return { nc: r.float(20, 35) };
    case 'viento': return {
      speed: r.float(0.3, 0.75),                      // viento medio (0..1)
      gust: r.float(0.3, 1),                          // cuánto racheado
      howl: r.next() < 0.4,                           // aullido (rendijas, cables)
      leaves: arch === 'bosque' || r.next() < 0.3,    // hojas que se mueven con las rachas
    };
    case 'ciudad': return { dist: r.float(400, 2200), swell: r.float(0.3, 1) };
    case 'dron': return {
      oct: r.next() < 0.6 ? 1 : 2,                    // octavas sobre la tónica del kick (E1..B1)
      second: r.weighted([4, 7, 2, null], [3, 2, 1, 1.5]), // la otra nota: quinta, octava, tercera (grado) o sola
      wave: r.next() < 0.6 ? 'triangle' : 'sine',
      cents: r.float(3, 9),                           // desafinación (latido lento)
      cutoff: r.float(350, 1100), lfo: r.float(0.05, 0.12), depth: r.float(0.2, 0.5),
    };
  }
  return {};
}

// UNA ESPECIE de pájaro: su canto es una frase de sílabas (barridos de 2–7 kHz, 10–300 ms; trinos =
// la misma sílaba repetida) que repite con variaciones, cada 6–25 s, lejos (20–150 m). Ver atmosSynth.js
function rollSpecies(r) {
  const syl = Array.from({ length: r.int(2, 4) }, () => {
    const f1 = r.float(2000, 6500), span = r.float(-0.6, 0.6);
    return {
      dur: r.float(0.012, 0.22),                       // s
      f1, f2: clamp(f1 * (1 + span), 1800, 7500),
      curve: r.weighted(['lin', 'up', 'down', 'arch'], [1, 1, 1, 1.2]),
      fm: r.next() < 0.35 ? { hz: r.float(25, 80), depth: r.float(0.02, 0.08) } : null, // gorjeo dentro de la sílaba
      h2: r.float(-28, -14),                           // el segundo armónico (dB)
    };
  });
  const phrase = [];
  const len = r.int(3, 7);
  for (let i = 0; i < len; i++) phrase.push({ s: r.int(0, syl.length - 1), rep: r.next() < 0.35 ? r.int(3, 9) : 1, gap: r.float(0.02, 0.09) });
  return { syl, phrase, every: r.float(6, 25), dist: r.float(20, 150), pan: r.float(-0.8, 0.8) };
}

// «CRUJIDO: VINILO + LLUVIA · RUIDO: CINTA (entra y sale)»
export function describeAtmos(A) {
  if (!A?.layers) return 'sin CRUJIDO ni RUIDO';
  const part = (pre) => A.layers.filter((l) => l.ch.startsWith(pre)).map((l) => LABEL[l.kind] + (l.gate ? ' (entra y sale)' : '')).join(' + ');
  return [['cr', 'CRUJIDO'], ['ru', 'RUIDO']].map(([p, name]) => (part(p) ? `${name}: ${part(p)}` : '')).filter(Boolean).join(' · ');
}

// presencia en una parte y versión
export const atmOf = (name, v = 0) => ATM_PRESENCE[name]?.[v] ?? 0.5;
// de presencia (0..1) a ganancia: lo CRUJIENTE entra por encima de 0,1 y llega entero en 0,9; el RUIDO,
// como mucho 6 dB por debajo
export const crunchGain = (p) => { const x = clamp((p - 0.1) / 0.8); return x * x * (3 - 2 * x); };
export const noiseGain = (p) => Math.pow(10, (-6 * (1 - clamp(p))) / 20);
