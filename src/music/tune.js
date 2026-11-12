// AFINAR — las perillas bajo BASS (TECHO, ZONA y el «8») y bajo KICK (NOTA). Desde 2026-11-12.
//
// En minimal el bajo es media canción: estas perillas mueven la línea que ha generado el universo
// sin cambiarla de escala. Todo en GRADOS de la escala del momento, como el resto del motor.
//
//   ZONA   mueve toda la línea dentro de la escala, de −7 a +7 grados: 1-3-7 con −1 es 7-2-6, con −2
//          6-1-5, con +1 2-4-1. Los saltos entre notas se mantienen (cada grado se mueve igual)
//   TECHO  la nota más alta que puede sonar, de 1 (la tónica) a 8 (su octava), o SIN TECHO. Lo que
//          pase del techo baja una octava (sigue siendo la misma nota de la escala); si al bajarla
//          pasara del límite grave, se queda en el techo
//   8      la octava de la tónica de la línea (el salto 1–8 de toda la vida; en ROMINIMAL, un golpe
//          corto): encendido, se salta el TECHO. Es siempre la misma nota (el 8 de la línea, también
//          con ZONA: se mueve con ella), así que se reconoce
//   NOTA   la nota del kick, de −4 a +4 grados alrededor de la tónica, dentro de KICK_HZ (lo que se
//          saldría se queda en el último grado que cabe). El golpe grave de las transiciones la sigue
//
// Por defecto (ZONA 0, SIN TECHO, NOTA 0) no cambia nada. Es del UNIVERSO: se guarda en su archivo,
// pasa al PARECIDO, y NUEVO UNIVERSO empieza en lo de por defecto.

export const ZONE_MAX = 7;
export const CEIL_MAX = 8;   // grados 1..8; null = sin techo
export const KICK_MAX = 4;
export const KICK_HZ = [32, 100]; // donde un kick tiene su fundamental (de sub a seco)

export const newTune = () => ({ zone: 0, ceil: null, free8: true, kick: 0 });
export const readTune = (t) => ({ ...newTune(), ...(t || {}) });

// el grado que suena de una nota del bajo de grado `deg`: ZONA y TECHO. `fOf(d)` = su frecuencia y
// `lo` = el límite grave (para no bajar del todo). El 8 (deg 7 antes de la ZONA) se salta el TECHO si
// `free8` está encendido
export function tuneBassDeg(deg, T, fOf, lo) {
  if (!T) return deg;
  const d = deg + T.zone;
  if (T.ceil === null || (deg === 7 && T.free8)) return d;
  const c = T.ceil - 1; // (grados de 0: el 5 es el 4)
  if (d <= c) return d;
  let x = d;
  while (x > c) x -= 7;
  return fOf(x) >= lo ? x : c;
}

// el grado del kick (NOTA) que cabe en KICK_HZ: si se sale, el último que cabe hacia la tónica
export function kickDeg(T, fOf) {
  let k = T ? T.kick : 0;
  while (k > 0 && fOf(k) > KICK_HZ[1]) k--;
  while (k < 0 && fOf(k) < KICK_HZ[0]) k++;
  return k;
}

// REGISTRO del bajo en NORMAL (desde 2026-11-12; antes no tenía y llegaba a ~470 Hz): el mismo que
// ROMINIMAL (styles.js, bassRange y bassOctaveMax): 40–140 Hz, y el 8 hasta 200 Hz
export const NORMAL_BASS_REG = { range: [40, 140], octaveMax: 200 };
