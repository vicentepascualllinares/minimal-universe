// MIXER: un fader de volumen por instrumento y, al lado, cuánto suena ahora (medidor).
// En UN UNIVERSO, una fila; en DJ, A y B en cada instrumento y VINCULADOS por defecto: mover
// un instrumento en un universo lo mueve igual en el otro (conservando la diferencia que
// tuvieran, como un grupo de faders). El botón VINCULADOS los separa.
// Parte siempre de 0 dB = el perfil de mezcla por defecto (dsp.js).
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
// IMÁN: al soltar a menos de 0,75 dB de 0 dB, el fader se va a 0 dB (+0,12 o −0,5 no tienen sentido)
const MAGNET_DB = 0.75;
const snap = (v) => (Math.abs(faderDb(v)) < MAGNET_DB ? DEF : v);
const fmt = (db) => (db === -Infinity ? '−∞' : `${db > 0.05 ? '+' : db < -0.05 ? '−' : ''}${Math.abs(db).toFixed(1)}`);

// medidor: pico en dBFS de −60 a 0 → 0..1
const meterPos = (p) => (p <= 1e-4 ? 0 : Math.min(1, Math.max(0, (20 * Math.log10(p) + 60) / 60)));

export function instMixer(root, engine, onClose) {
  let linked = true;
  let chans = []; // { i, k, s, apply, el, meter, lv }
  const val = [{}, {}]; // posición de cada fader (se conserva al volver a dibujar)
  for (const k of INSTRUMENTS) { val[0][k] = DEF; val[1][k] = DEF; }

  const fader = (i, dj) => `
    <div class="im-fd" data-i="${i}">
      <div class="im-fdrow">
        <div class="im-meter"><i></i></div>
        <div class="fader"><div class="t-track"><div class="t-line"></div><i class="im-zero"></i><div class="t-handle"></div></div></div>
      </div>
      ${dj ? `<span class="im-u">${'AB'[i]}</span>` : ''}
    </div>`;

  // se dibuja al elegir el modo (en DJ, A y B)
  function render() {
    const dj = engine.mode === 'dj';
    const decks = dj ? [0, 1] : [0];
    root.classList.toggle('dj', dj);
    root.innerHTML = `
      <div class="im-head">
        <span class="im-title">MIXER</span>
        <span class="im-sub">volumen de cada instrumento${dj ? ' · A y B' : ''}</span>
        ${dj ? `<button class="im-link${linked ? ' on' : ''}" title="vinculados: mover un instrumento en un universo lo mueve igual en el otro">VINCULADOS</button>` : ''}
      </div>
      <div class="im-row">${INSTRUMENTS.map((k) => `
        <div class="im-ch" data-k="${k}">
          <div class="im-dbs">${decks.map((i) => `<span class="im-db" data-i="${i}">0.0</span>`).join('')}</div>
          <div class="im-pair">${decks.map((i) => fader(i, dj)).join('')}</div>
          <span class="im-name">${LABEL[k]}</span>
        </div>`).join('')}
      </div>
      <div class="im-foot">
        <button class="im-reset">RESTABLECER</button>
        <button class="im-close">CERRAR</button>
      </div>`;

    chans = [];
    const find = (i, k) => chans.find((c) => c.i === i && c.k === k);
    for (const ch of root.querySelectorAll('.im-ch')) {
      const k = ch.dataset.k;
      for (const el of ch.querySelectorAll('.im-fd')) {
        const i = Number(el.dataset.i);
        const db = ch.querySelector(`.im-db[data-i="${i}"]`);
        const c = { i, k, el, meter: el.querySelector('.im-meter i'), lv: 0 };
        c.apply = (v) => {
          val[i][k] = v;
          const d = faderDb(v);
          db.textContent = fmt(d);
          db.classList.toggle('moved', Math.abs(v - DEF) > 0.004);
          engine.setInst(i, k, d === -Infinity ? 0 : Math.pow(10, d / 20));
        };
        // vinculados: el otro se mueve lo mismo (conserva la diferencia)
        const move = (v) => {
          const delta = v - val[i][k];
          c.apply(v);
          const o = dj && linked ? find(1 - i, k) : null;
          if (!o) return;
          const ov = Math.min(1, Math.max(0, val[o.i][k] + delta));
          o.s.set(ov);
          o.apply(ov);
        };
        // IMÁN al soltar: el sonido va a 0 dB ya; el mando se desliza unas milésimas
        const release = () => {
          for (const x of dj && linked ? [c, find(1 - i, k)] : [c]) {
            const v = snap(val[x.i][k]);
            if (v === val[x.i][k]) continue;
            x.apply(v);
            x.s.glideTo(v);
          }
        };
        c.s = new VSlider(el, { value: val[i][k], onChange: move, onEnd: release });
        // doble clic: vuelve a 0 dB (vinculados, los dos)
        el.querySelector('.t-track').addEventListener('dblclick', () => {
          for (const x of dj && linked ? [c, find(1 - i, k)] : [c]) { x.s.set(DEF); x.apply(DEF); }
        });
        c.apply(val[i][k]);
        chans.push(c);
      }
    }
    root.querySelector('.im-link')?.addEventListener('click', (ev) => {
      linked = !linked;
      ev.currentTarget.classList.toggle('on', linked);
    });
    root.querySelector('.im-reset').addEventListener('click', () => {
      for (const c of chans) { c.s.set(DEF); c.apply(DEF); }
    });
    root.querySelector('.im-close').addEventListener('click', onClose);
  }
  render();

  return {
    render,
    // con el panel abierto: los medidores siguen a lo que suena (caída suave)
    frame() {
      if (!engine.ready) return;
      for (const c of chans) {
        const p = meterPos(engine.decks[c.i].instLevel(c.k));
        c.lv = Math.max(p, c.lv * 0.9);
        c.meter.style.transform = `scaleY(${c.lv.toFixed(3)})`;
      }
    },
  };
}
