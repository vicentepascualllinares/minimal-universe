// MIXER: un fader de volumen por instrumento y, al lado, cuánto suena ahora (medidor).
// En UN UNIVERSO, una fila; en DJ, A y B en cada instrumento y VINCULADOS por defecto: mover
// un instrumento en un universo lo mueve igual en el otro (conservando la diferencia que
// tuvieran, como un grupo de faders). El botón VINCULADOS los separa.
// Parte siempre de 0 dB = el perfil de mezcla por defecto (dsp.js).
// (Guardar la mezcla de cada persona vendrá con las cuentas.)

import { VSlider } from './slider.js';
import { INSTRUMENTS } from '../music/arrangement.js';
import { meterPos, fmtDb as fmt, paintMaster } from './meters.js';

const LABEL = { kick: 'KICK', bass: 'BASS', hat: 'HAT', perc: 'PERC', clap: 'CLAP', ohat: 'OPEN', chord: 'CHORD', pad: 'PAD' };
const DEF = 0.75; // posición del fader = 0 dB
const MASTER_TOP = 12; // el MÁSTER sube hasta +12 dB (para empujar contra el limitador)

// recorrido: arriba +6 dB (máster: +12), 3/4 = 0 dB, abajo hasta -48 dB y silencio
export function faderDb(v, top = 6) {
  if (v >= DEF) return ((v - DEF) / (1 - DEF)) * top;
  if (v <= 0.005) return -Infinity;
  return -48 * Math.pow((DEF - v) / DEF, 1.5);
}
const dbGain = (d) => (d === -Infinity ? 0 : Math.pow(10, d / 20));
// IMÁN: al soltar a menos de 0,75 dB de 0 dB, el fader se va a 0 dB (+0,12 o −0,5 no tienen sentido)
const MAGNET_DB = 0.75;
export const snap = (v, top) => (Math.abs(faderDb(v, top)) < MAGNET_DB ? DEF : v);
export { DEF as FADER_ZERO, fmt as fmtDb };

// VOLUMEN DE FX de un universo: lo mueven su columna TRANSICIÓN y el MIXER (la posición se guarda
// en el motor y cada vista la sigue)
export function setFxFader(engine, i, v) {
  engine.fxPos[i] = v;
  engine.setFxGain(i, dbGain(faderDb(v)));
}

// las columnas del MIXER: los instrumentos y, aparte, los EFECTOS DE TRANSICIÓN de cada universo
const COLS = [...INSTRUMENTS, 'fx'];
LABEL.fx = 'FX';

export function instMixer(root, engine, onClose) {
  let linked = true;
  let chans = []; // { i, k, s, apply, el, meter, lv }
  let master = null; // { s, apply, el }
  const val = [{}, {}]; // posición de cada fader (se conserva al volver a dibujar)
  for (const k of INSTRUMENTS) { val[0][k] = DEF; val[1][k] = DEF; }
  // (los de FX se leen del motor: también se mueven desde cada universo)
  let masterVal = DEF;

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
        <span class="im-sub">volumen de cada instrumento${dj ? ' · A y B' : ''} · y del máster</span>
        ${dj ? `<button class="im-link${linked ? ' on' : ''}" title="vinculados: mover un instrumento en un universo lo mueve igual en el otro">VINCULADOS</button>` : ''}
      </div>
      <div class="im-row">${COLS.map((k) => `
        <div class="im-ch${k === 'fx' ? ' im-fx' : ''}" data-k="${k}"${k === 'fx' ? ' title="EFECTOS DE TRANSICIÓN de cada universo: riser, redoble, golpes, platos, reverse, caída · nunca vinculados · también en la columna TRANSICIÓN de cada universo"' : ''}>
          <div class="im-dbs">${decks.map((i) => `<span class="im-db" data-i="${i}">0.0</span>`).join('')}</div>
          <div class="im-pair">${decks.map((i) => fader(i, dj)).join('')}</div>
          <span class="im-name">${LABEL[k]}</span>
        </div>`).join('')}
        <div class="im-ch im-master" title="MÁSTER: la ganancia empuja la mezcla contra el limitador · medidores: pico de L y R de lo que sale · LIM: lo que quita el limitador">
          <div class="im-dbs"><span class="im-db">0.0</span></div>
          <div class="im-pair">
            <div class="im-fd">
              <div class="im-fdrow">
                <div class="im-meter"><i class="m-l"></i></div>
                <div class="im-meter"><i class="m-r"></i></div>
                <div class="fader"><div class="t-track"><div class="t-line"></div><i class="im-zero"></i><div class="t-handle"></div></div></div>
                <div class="im-meter im-gr"><i class="m-gr"></i></div>
              </div>
              <span class="im-u im-read"><b class="m-peak">−∞</b><span><em class="im-lim">LIM </em><b class="m-grdb">0.0</b></span></span>
            </div>
          </div>
          <span class="im-name">MASTER</span>
        </div>
      </div>
      <div class="im-foot">
        <button class="im-reset">RESTABLECER</button>
        <button class="im-close">CERRAR</button>
      </div>`;

    chans = [];
    const find = (i, k) => chans.find((c) => c.i === i && c.k === k);
    for (const ch of root.querySelectorAll('.im-ch[data-k]')) {
      const k = ch.dataset.k;
      for (const el of ch.querySelectorAll('.im-fd')) {
        const i = Number(el.dataset.i);
        const db = ch.querySelector(`.im-db[data-i="${i}"]`);
        const fx = k === 'fx';
        const c = { i, k, el, meter: el.querySelector('.im-meter i'), lv: 0 };
        if (fx) val[i].fx = engine.fxPos[i];
        c.show = (v) => {
          db.textContent = fmt(faderDb(v));
          db.classList.toggle('moved', Math.abs(v - DEF) > 0.004);
        };
        c.apply = (v) => {
          val[i][k] = v;
          c.show(v);
          if (fx) setFxFader(engine, i, v);
          else engine.setInst(i, k, dbGain(faderDb(v)));
        };
        // vinculados: el otro se mueve lo mismo (conserva la diferencia). Los FX, nunca
        const pair = dj && linked && !fx;
        const move = (v) => {
          const delta = v - val[i][k];
          c.apply(v);
          const o = pair ? find(1 - i, k) : null;
          if (!o) return;
          const ov = Math.min(1, Math.max(0, val[o.i][k] + delta));
          o.s.set(ov);
          o.apply(ov);
        };
        // IMÁN al soltar: el sonido va a 0 dB ya; el mando se desliza unas milésimas
        const release = () => {
          for (const x of pair ? [c, find(1 - i, k)] : [c]) {
            const v = snap(val[x.i][k]);
            if (v === val[x.i][k]) continue;
            x.apply(v);
            x.s.glideTo(v);
          }
        };
        c.s = new VSlider(el, { value: val[i][k], onChange: move, onEnd: release });
        // doble clic: vuelve a 0 dB (vinculados, los dos)
        el.querySelector('.t-track').addEventListener('dblclick', () => {
          for (const x of pair ? [c, find(1 - i, k)] : [c]) { x.s.set(DEF); x.apply(DEF); }
        });
        c.apply(val[i][k]);
        chans.push(c);
      }
    }
    // MÁSTER: mismo fader (imán, doble clic = 0 dB) pero hasta +12 dB y nunca vinculado
    {
      const el = root.querySelector('.im-master');
      const db = el.querySelector('.im-db');
      const apply = (v) => {
        masterVal = v;
        const d = faderDb(v, MASTER_TOP);
        db.textContent = fmt(d);
        db.classList.toggle('moved', Math.abs(v - DEF) > 0.004);
        engine.setMasterGain(dbGain(d));
      };
      const s = new VSlider(el.querySelector('.fader'), {
        value: masterVal,
        onChange: apply,
        onEnd: () => { const v = snap(masterVal, MASTER_TOP); if (v !== masterVal) { apply(v); s.glideTo(v); } },
      });
      el.querySelector('.t-track').addEventListener('dblclick', () => { s.set(DEF); apply(DEF); });
      apply(masterVal);
      master = { el, s, apply };
    }
    root.querySelector('.im-link')?.addEventListener('click', (ev) => {
      linked = !linked;
      ev.currentTarget.classList.toggle('on', linked);
    });
    root.querySelector('.im-reset').addEventListener('click', () => {
      for (const c of chans) { c.s.set(DEF); c.apply(DEF); }
      master.s.set(DEF); master.apply(DEF);
    });
    root.querySelector('.im-close').addEventListener('click', onClose);
  }
  render();

  return {
    render,
    // con el panel abierto: los medidores siguen a lo que suena (caída suave).
    // `mm` = el máster de este fotograma (ver masterMeter en meters.js)
    frame(mm) {
      if (!engine.ready) return;
      paintMaster(master.el, mm);
      for (const c of chans) {
        const d = engine.decks[c.i];
        if (c.k === 'fx' && val[c.i].fx !== engine.fxPos[c.i]) { // lo movieron desde el universo
          val[c.i].fx = engine.fxPos[c.i];
          c.s.set(val[c.i].fx);
          c.show(val[c.i].fx);
        }
        const p = meterPos(c.k === 'fx' ? d.fx?.level() ?? 0 : d.instLevel(c.k));
        c.lv = Math.max(p, c.lv * 0.9);
        c.meter.style.transform = `scaleY(${c.lv.toFixed(3)})`;
      }
    },
  };
}
