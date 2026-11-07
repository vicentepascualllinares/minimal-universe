// PERFIL DE RENDIMIENTO
// Ordenador: el motor completo, tal cual.
// Móvil (Android / iPhone / iPad): misma música, pero optimizado para que el
// audio no se corte: búfer grande, hats sobre un banco de osciladores fijo,
// menos nodos por nota, reverb más corta, sin sobremuestreo, interfaz más ligera.
//
// Forzar a mano para probar:  ?movil   o   ?pc   en la dirección.

const q = new URLSearchParams(location.search);
const ua = navigator.userAgent;
const isMobileDevice =
  navigator.userAgentData?.mobile === true ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
  (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS se hace pasar por Mac

const lite = q.has('movil') ? true : q.has('pc') ? false : isMobileDevice;

export const PROFILE = {
  lite,
  name: lite ? 'movil' : 'pc',
  // búfer de salida: en móvil ~45 ms (equilibrio). Con ?estable, el máximo (más latencia, cero cortes)
  latencyHint: lite ? (q.has('estable') ? 'playback' : 0.045) : 'interactive',
  // s que se programan por adelantado. En móvil se adapta solo entre min y max
  lookahead: lite ? 0.15 : 0.12,
  lookaheadMax: lite ? 0.3 : 0.12,
  tickMs: lite ? 25 : 20,
  oversample: lite ? 'none' : null,               // null = lo que use cada nodo en PC
  irSeconds: lite ? 2.0 : 3.6,
  maxDpr: lite ? 1.5 : Infinity,                  // resolución de los canvas
};
