// MIXER global: un fader de volumen por instrumento, igual para todos los
// universos. Parte siempre de 0 dB = el perfil de mezcla por defecto (dsp.js).
// (Guardar la mezcla de cada persona vendrá con las cuentas.)

import { VSlider } from './slider.js';
import { INSTRUMENTS } from '../music/arrangement.js';

const LABEL = { kick: 'KICK', bass: 'BASS', hat: 'HAT', perc: 'PERC', clap: 'CLAP', ohat: 'OPEN', chord: 'CHORD', pad: 'PAD' };
const DEF = 0.75; // posición del fader = 0 dB

// recorrido: arriba +6 dB, 3/4 = 0 dB, abajo hasta -48 dB y silencio
export function faderDb(v) {
  if (v >= DEF) return ((v - DEF) / (1 - DEF)) * 6;
  if (v <= 0.005) return -Infinity;
  return -48 * Math.pow((DEF - v) / DEF, 1.5);
}
const fmt = (db) => (db === -Infinity ? '−∞' : `${db > 0.05 ? '+' : db < -0.05 ? '−' : ''}${Math.abs(db).toFixed(1)}`);

export function instMixer(root, engine, onClose) {
  root.innerHTML = `
    <div class="im-head">
      <span class="im-title">MIXER</span>
      <span class="im-sub">volumen de cada instrumento · todos los universos</span>
    </div>
    <div class="im-row">${INSTRUMENTS.map((k) => `
      <div class="im-ch" data-k="${k}">
        <span class="im-db">0.0</span>
        <div class="fader"><div class="t-track"><div class="t-line"></div><i class="im-zero"></i><div class="t-handle"></div></div></div>
        <span class="im-name">${LABEL[k]}</span>
      </div>`).join('')}
    </div>
    <div class="im-foot">
      <button class="im-reset">RESTABLECER</button>
      <button class="im-close">CERRAR</button>
    </div>`;

  const faders = {};
  for (const el of root.querySelectorAll('.im-ch')) {
    const k = el.dataset.k;
    const db = el.querySelector('.im-db');
    const apply = (v) => {
      const d = faderDb(v);
      db.textContent = fmt(d);
      el.classList.toggle('moved', Math.abs(v - DEF) > 0.004);
      engine.setInst(k, d === -Infinity ? 0 : Math.pow(10, d / 20));
    };
    const s = new VSlider(el, { value: DEF, onChange: apply });
    // doble clic: vuelve a 0 dB
    el.querySelector('.t-track').addEventListener('dblclick', () => { s.set(DEF); apply(DEF); });
    faders[k] = { s, apply };
  }
  root.querySelector('.im-reset').addEventListener('click', () => {
    for (const { s, apply } of Object.values(faders)) { s.set(DEF); apply(DEF); }
  });
  root.querySelector('.im-close').addEventListener('click', onClose);
}
