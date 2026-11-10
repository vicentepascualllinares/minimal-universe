// PRESETS DE MEZCLA del MIXER: solo la posición de los faders de volumen (en dB).
// Cada instrumento sale de su canal con el pico máximo en 0 dBFS (LEVEL en dsp.js) y los
// efectos de transición, igual (FX_LEVEL en transitionFx.js). Lo que suene la mezcla al final
// (RMS, LUFS) es cosa de la futura cadena de mezcla y máster: esto es solo el balance.
//
// PLANO: todo a 0 dB. Cada canal con su pico en 0 dBFS: suena mucho más fuerte y la saturación
// del universo y el limitador trabajan bastante más. Es el punto de partida neutro.
//
// MINIMAL (por defecto): minimal, deep house y rominimal. Parte de la mezcla que había (que ya
// seguía esas reglas, y que en estos dB es exactamente el `PEAK` de dsp.js) y la retoca:
//   kick   −4    el ancla. Por debajo de 0 a propósito: deja margen a la suma, como al
//                mezclar a mano (canal del kick entre −6 y −3 dBFS)
//   bass   −9    rodando justo bajo el kick (5 dB de pico menos: el bajo de onda pura tiene
//                más cuerpo con menos pico). Kick y bajo mandan
//   perc   −10   +1,6 dB: en rominimal la percusión es la protagonista (el groove es la
//                melodía), por encima de clap y hats
//   clap   −12   −1,3 dB: en minimal el clap marca, pero queda detrás, no golpea como en tech house
//   hat    −13   igual: presentes y sin morder
//   open   −15   −0,6 dB: es largo y se oye más de lo que marca el pico
//   chord  −14   −1,1 dB: los acordes de deep/minimal acompañan, no tapan el groove
//   pad    −16   −1,1 dB: es el fondo, se siente más que se oye
//   FX     −7    −3 dB: en minimal las transiciones se insinúan (riser y plato suaves); sin
//                retocar, los golpes de llegada sonaban casi como el kick
// El nivel total (sin FX) queda como antes, así la saturación del universo, el glue y el
// limitador trabajan igual que siempre.

export const MIX_PRESETS = {
  minimal: {
    label: 'MINIMAL',
    desc: 'minimal, deep house y rominimal: kick y bajo mandan, la percusión delante, armonía y pad de fondo',
    db: { kick: -4, bass: -9, hat: -13, perc: -10, clap: -12, ohat: -15, chord: -14, pad: -16, fx: -7 },
  },
  plano: {
    label: 'PLANO',
    desc: 'todo a 0 dB: cada instrumento con su pico máximo en 0 dBFS',
    db: { kick: 0, bass: 0, hat: 0, perc: 0, clap: 0, ohat: 0, chord: 0, pad: 0, fx: 0 },
  },
};

export const DEFAULT_MIX = 'minimal';
