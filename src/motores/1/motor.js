// MOTOR — la entrada de un motor: lo que hace sonar un universo (su Deck, con generadores, sintes,
// transiciones y espacio) y el banco que graba sus hats y percs. El registro de motores
// (src/motores/index.js) lee esto de cada carpeta: de src/ (el motor EN OBRAS) y de cada copia
// congelada (src/motores/N/). Ver src/motores/LEEME.md.
export { Deck } from './audio/deck.js';
export { SoundBank } from './audio/soundBank.js';
