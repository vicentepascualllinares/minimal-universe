// REGISTRO DE MOTORES (ver LEEME.md, en esta carpeta): con qué motor puede sonar un universo.
//
// Cada motor es una copia CONGELADA del código que hace sonar los universos (src/motores/N/), menos
// el último, que es el de src/ (EN OBRAS: el que se sigue cambiando). Un universo guardado lleva su
// motor («-M1» en el código de semilla, `motor` en el archivo; sin nada, el 1) y suena con él.
import * as M1 from './1/motor.js';
import * as DEV from '../motor.js';

export const MOTORS = {
  1: {
    ...M1, label: 'MOTOR 1', frozen: true, since: '2026-11-11',
    desc: 'congelado el 2026-11-11: el de «Génesis» y los universos guardados hasta ese día. Suena siempre igual',
  },
  2: {
    ...DEV, label: 'MOTOR 2', frozen: false,
    desc: 'en obras: el que se sigue cambiando. Sus semillas pueden sonar distinto hasta que se congele',
  },
};
// el de NUEVO UNIVERSO de partida: el que está en obras
export const DEV_MOTOR = 2;
