// BANCO DE SONIDOS · el que graba: recibe una receta y devuelve sus variantes ya sintetizadas
// (ver drumsynth.js). Corre en un Worker: grabar nunca para el hilo principal (ni el reloj ni
// la pantalla). Los búferes viajan transferidos, sin copiarse.
import { renderSet } from './drumsynth.js';

self.onmessage = (e) => {
  const { id, key, p, sr, seed, variants } = e.data;
  try {
    const layers = renderSet(p, sr, seed, variants);
    self.postMessage({ id, key, layers }, layers.flat().map((a) => a.buffer));
  } catch (err) {
    self.postMessage({ id, key, error: String(err?.message || err) });
  }
};
