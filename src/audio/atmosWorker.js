// CRUJIDO Y RUIDO · el que graba (atmosSynth.js) fuera del hilo principal: una cama tarda de 0,1 a 5 s y
// nunca puede parar el reloj ni la pantalla. Los búferes viajan transferidos, sin copiarse.
import { renderLayer, renderSong } from './atmosSynth.js';

self.onmessage = (e) => {
  const { id, kind, P, N, seed, v } = e.data;
  try {
    const chans = kind === 'song' ? [renderSong(P, v)] : renderLayer(kind, P, N, seed).out;
    self.postMessage({ id, chans }, chans ? chans.map((a) => a.buffer) : []);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
