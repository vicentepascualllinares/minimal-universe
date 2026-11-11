// FADER de volumen (MIXER, VOLUMEN DE FX, MÁSTER): posición 0..1 ↔ dB.
// Recorrido: arriba +6 dB (máster: +12), 3/4 = 0 dB, abajo hasta −70 dB y silencio, como en
// Ableton. (2026-11-11: antes acababa en −48 y un canal a −40, como el pad de ROMINIMAL, quedaba
// pegado al fondo: su medidor, que va en la misma escala, casi no se veía.)
// Lo usan las vistas y el motor (los presets de mezcla se escriben en dB).

export const FADER_ZERO = 0.75; // posición del fader = 0 dB
const FLOOR = 70;  // dB del fondo (por debajo, silencio)
const CURVE = 1.6; // más recorrido arriba (donde se mezcla), más apretado abajo

export function faderDb(v, top = 6) {
  if (v >= FADER_ZERO) return ((v - FADER_ZERO) / (1 - FADER_ZERO)) * top;
  if (v <= 0.005) return -Infinity;
  return -FLOOR * Math.pow((FADER_ZERO - v) / FADER_ZERO, CURVE);
}

// la inversa: dónde queda el fader para `db` dB
export function dbFader(db, top = 6) {
  if (db === -Infinity || db <= -FLOOR) return 0;
  if (db >= 0) return FADER_ZERO + (Math.min(db, top) / top) * (1 - FADER_ZERO);
  return FADER_ZERO - FADER_ZERO * Math.pow(-db / FLOOR, 1 / CURVE);
}

export const dbGain = (d) => (d === -Infinity ? 0 : Math.pow(10, d / 20));
