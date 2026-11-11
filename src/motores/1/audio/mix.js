// PRESETS DE MEZCLA del MIXER: solo la posición de los faders de volumen (en dB).
// Cada instrumento sale de su canal con el pico máximo en 0 dBFS (LEVEL en dsp.js) y los
// efectos de transición, igual (FX_LEVEL en transitionFx.js). Lo que suene la mezcla al final
// (RMS, LUFS) es cosa de la futura cadena de mezcla y máster: esto es solo el balance.
//
// PLANO: todo a 0 dB. Cada canal con su pico en 0 dBFS: suena mucho más fuerte y la saturación
// del universo y el limitador trabajan bastante más. Es el punto de partida neutro.
//
// ROMINIMAL (por defecto; 2026-11-11, antes MINIMAL): la mezcla que dejó el usuario a oído en el
// navegador, con un universo ROMINIMAL a tope (arquetipo DUB). Es también la mezcla de serie del
// estilo ROMINIMAL (styles.js, `mix`), así un universo ROMINIMAL nace con estos faders (más lo que
// retoque su arquetipo y ±1 dB):
//   kick −4,4 · bass −9,2 · hat −13,9 · perc −23,4 · clap −14 · open −10,1 · foley −14,1 ·
//   chord −22,2 · pad −54,7 (un colchón: se nota si falta, no se oye) · DELAY y REVERB 0 ·
//   FONDO −6,4 · FX −11,8
// (Lo que había antes, MINIMAL: kick −4, bass −9, hat −13, perc −10, clap −12, open −15, foley −12,
// chord −14, pad −16, FX −7: el kick como ancla con margen, kick y bajo mandan, la percusión
// delante, armonía y pad de fondo, las transiciones insinuadas.)
//   DELAY · REVERB · FONDO: los RETORNOS del espacio del universo (music/space.js). A 0 dB suenan
//   como el universo los generó: cuánto manda cada instrumento ya viene en sus envíos. El fader
//   solo los sube o los baja todos a la vez

export const MIX_PRESETS = {
  rominimal: {
    label: 'ROMINIMAL',
    desc: 'la mezcla de rominimal: kick y bajo mandan, la percusión por detrás, acordes y pad de fondo, el FONDO como colchón',
    db: { kick: -4.4, bass: -9.2, hat: -13.9, perc: -23.4, clap: -14, ohat: -10.1, foley: -14.1, chord: -22.2, pad: -54.7, dly: 0, rev: 0, bg: -6.4, fx: -11.8 },
  },
  plano: {
    label: 'PLANO',
    desc: 'todo a 0 dB: cada instrumento con su pico máximo en 0 dBFS',
    db: { kick: 0, bass: 0, hat: 0, perc: 0, clap: 0, ohat: 0, foley: 0, chord: 0, pad: 0, dly: 0, rev: 0, bg: 0, fx: 0 },
  },
};

export const DEFAULT_MIX = 'rominimal';
