// REGISTRO DE MOTORES (ver LEEME.md, en esta carpeta): con qué motor puede sonar un universo.
//
// Desde 2026-11-12 hay UN motor, ALPHA: el de src/ (el MOTOR 1 congelado y el MOTOR 2 en obras se
// unificaron en él: el 1 cabía entero en el 2). Se sigue cambiando sin congelar, con cambios que no
// quitan nada de lo que había (lo nuevo, apagado o en lo de antes en los universos de antes). Cuando
// haga falta un salto que sí lo quite, ALPHA se congela en src/motores/alpha/ y el nuevo lleva OTRO
// nombre (ver LEEME.md). Un universo lleva su motor («-ALPHA» en el código de semilla, `motor` en el
// archivo); los de antes («-M1», «-M2» o sin nada) suenan con ALPHA.
import * as ALPHA from '../motor.js';

export const MOTORS = {
  alpha: {
    ...ALPHA, label: 'ALPHA', frozen: false, since: '2026-11-12',
    desc: 'el motor de todos los universos (desde 2026-11-12: une el MOTOR 1 y el 2). Se sigue cambiando sin quitar nada de lo que había: lo de antes suena igual',
  },
};
// el de NUEVO UNIVERSO de partida
export const DEV_MOTOR = 'alpha';
