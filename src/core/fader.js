// FADER de volumen (MIXER, VOLUMEN DE FX, MÁSTER): posición 0..1 ↔ dB.
// Recorrido: arriba +6 dB (máster: +12), 3/4 = 0 dB, abajo hasta −48 dB y silencio.
// Lo usan las vistas y el motor (los presets de mezcla se escriben en dB).

export const FADER_ZERO = 0.75; // posición del fader = 0 dB

export function faderDb(v, top = 6) {
  if (v >= FADER_ZERO) return ((v - FADER_ZERO) / (1 - FADER_ZERO)) * top;
  if (v <= 0.005) return -Infinity;
  return -48 * Math.pow((FADER_ZERO - v) / FADER_ZERO, 1.5);
}

// la inversa: dónde queda el fader para `db` dB
export function dbFader(db, top = 6) {
  if (db === -Infinity || db <= -48) return 0;
  if (db >= 0) return FADER_ZERO + (Math.min(db, top) / top) * (1 - FADER_ZERO);
  return FADER_ZERO - FADER_ZERO * Math.pow(-db / 48, 1 / 1.5);
}

export const dbGain = (d) => (d === -Infinity ? 0 : Math.pow(10, d / 20));
