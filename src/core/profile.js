// PERFIL DE RENDIMIENTO
// Ordenador o móvil (Android / iPhone / iPad). Decide los valores de partida:
// búfer, margen de programación, CALIDAD por defecto (NORMAL en PC, LIGERA en
// móvil; ver audio/quality.js) e interfaz más ligera en móvil.
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
  // búfer ESTABLE (el punto de partida; se elige en OPCIONES → RENDIMIENTO, ver engine.js).
  // PC ~50 ms: con el mínimo ('interactive', ~11 ms) el modo DJ en TODO daba 11–17 CORTES
  // cada 30 s; con ~32 ms, 1; con ~50 ms, 0 (ver RENDIMIENTO.md §5). Móvil ~45 ms.
  stableHint: lite ? 0.045 : 0.05,
  forceMaxBuffer: q.has('estable'), // ?estable: búfer MÁXIMO (más latencia, cero cortes; no se guarda)
  // s que se programan por adelantado (MARGEN). En AUTO se adapta solo entre este y el tope
  lookahead: lite ? 0.15 : 0.12,
  lookaheadMax: 0.3, // tope del MARGEN en AUTO (OPCIONES → RENDIMIENTO)
  tickMs: lite ? 25 : 20,
  maxDpr: lite ? 1.5 : Infinity,                  // resolución de los canvas
};
