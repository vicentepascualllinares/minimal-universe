// MIXER: un fader de volumen por instrumento y, al lado, cuánto suena ahora (medidor).
// En UN UNIVERSO, una fila; en DJ, A y B en cada instrumento y VINCULADOS por defecto: mover
// un instrumento en un universo lo mueve igual en el otro (conservando la diferencia que
// tuvieran, como un grupo de faders). El botón VINCULADOS los separa.
// 0 dB = el pico máximo del instrumento en 0 dBFS. Arriba, el PRESET de mezcla (MINIMAL por
// defecto, PLANO = todo a 0 dB; ver mix.js): elegirlo mueve todos los faders, y si luego se
// toca alguno, marca RETOCADA. Doble clic en un fader = el valor del preset; RESTABLECER = el
// preset entero (y el máster a 0 dB).
// (Guardar la mezcla de cada persona vendrá con las cuentas.)

import { VSlider } from './slider.js';
import { INSTRUMENTS } from '../music/arrangement.js';
import { toDb, fmtDb as fmt, paintMaster } from './meters.js';
import { FADER_ZERO as DEF, faderDb, dbFader, dbGain } from '../core/fader.js';
import { MIX_PRESETS } from '../audio/mix.js';

const LABEL = { kick: 'KICK', bass: 'BASS', hat: 'HAT', perc: 'PERC', clap: 'CLAP', ohat: 'OPEN', chord: 'CHORD', pad: 'PAD' };
const MASTER_TOP = 12; // el MÁSTER sube hasta +12 dB (para empujar contra el limitador)
// posición del fader de un instrumento según su ganancia en el motor
const posOf = (g) => (g <= 0 ? 0 : dbFader(20 * Math.log10(g)));
// posición del fader `k` ('fx' o un instrumento) en el preset que manda ahora
export const presetPos = (engine, k) => dbFader(MIX_PRESETS[engine.mixPreset].db[k]);
export { faderDb };
// medidor de un instrumento o de FX: el pico (lineal) puesto en la escala del fader (0 dB a 3/4,
// +6 arriba, −48 abajo). Un NaN cuenta como silencio
const levelPos = (p) => (!(p > 1e-4) ? 0 : Math.min(1, dbFader(toDb(p))));
// IMÁN: al soltar a menos de 0,75 dB de 0 dB, el fader se va a 0 dB (+0,12 o −0,5 no tienen sentido)
const MAGNET_DB = 0.75;
export const snap = (v, top) => (Math.abs(faderDb(v, top)) < MAGNET_DB ? DEF : v);
// faders de instrumento y de FX: también imán al valor del preset
export const snapMix = (engine, k, v) => {
  const p = MIX_PRESETS[engine.mixPreset].db[k];
  return Math.abs(faderDb(v) - p) < MAGNET_DB ? dbFader(p) : snap(v);
};
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
  const val = [{}, {}]; // posición de cada fader (se lee del motor al dibujar y al cambiar de preset)
  const load = () => {
    for (const i of [0, 1]) {
      for (const k of INSTRUMENTS) val[i][k] = posOf(engine.inst[i][k]);
      val[i].fx = engine.fxPos[i];
    }
  };
  load();
  let mixSeen = engine.mixVersion;
  let masterVal = DEF;

  const fader = (i, dj) => `
    <div class="im-fd" data-i="${i}">
      <div class="im-fdrow">
        <div class="im-meter"><i></i></div>
        <div class="fader"><div class="t-track"><div class="t-line"></div><i class="im-zero"></i><div class="t-handle"></div></div></div>
      </div>
      <div class="im-ms">
        <button class="im-mute" title="MUTE: silenciar este canal (el fader no se mueve)">M</button>
        <button class="im-solo" title="SOLO: oír solo los canales en SOLO (de los dos universos)">S</button>
      </div>
      ${dj ? `<span class="im-u">${'AB'[i]}</span>` : ''}
    </div>`;

  // se dibuja al elegir el modo (en DJ, A y B)
  function render() {
    load();
    const dj = engine.mode === 'dj';
    const decks = dj ? [0, 1] : [0];
    root.classList.toggle('dj', dj);
    root.innerHTML = `
      <div class="im-head">
        <span class="im-title">MIXER</span>
        <span class="im-sub">volumen de cada instrumento${dj ? ' · A y B' : ''} · y del máster</span>
        <div class="im-presets">
          <span class="im-plab">MEZCLA</span>
          ${Object.entries(MIX_PRESETS).map(([p, P]) => `<button class="im-preset" data-p="${p}" title="${P.desc}">${P.label}</button>`).join('')}
          <span class="im-touched">RETOCADA</span>
        </div>
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
        // `moved` = fuera de lo que dice el preset
        c.show = (v) => {
          db.textContent = fmt(faderDb(v));
          db.classList.toggle('moved', Math.abs(v - presetPos(engine, k)) > 0.004);
        };
        c.apply = (v) => {
          val[i][k] = v;
          c.show(v);
          if (fx) setFxFader(engine, i, v);
          else engine.setInst(i, k, dbGain(faderDb(v)));
          showPresets();
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
            const v = snapMix(engine, k, val[x.i][k]);
            if (v === val[x.i][k]) continue;
            x.apply(v);
            x.s.glideTo(v);
          }
        };
        c.s = new VSlider(el, { value: val[i][k], onChange: move, onEnd: release });
        // MUTE y SOLO (vinculados, los dos; los FX nunca)
        for (const which of ['mute', 'solo']) {
          el.querySelector(`.im-${which}`).addEventListener('click', () => {
            const on = !engine[which][i].has(k);
            for (const x of pair ? [c, find(1 - i, k)] : [c]) engine.setMuteSolo(which, x.i, k, on);
            showMS();
          });
        }
        // doble clic: vuelve a lo que dice el preset (vinculados, los dos)
        el.querySelector('.t-track').addEventListener('dblclick', () => {
          const v = presetPos(engine, k);
          for (const x of pair ? [c, find(1 - i, k)] : [c]) { x.s.set(v); x.apply(v); }
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
    // PRESET: mueve todos los faders (instrumentos y FX, los dos universos)
    for (const b of root.querySelectorAll('.im-preset')) {
      b.addEventListener('click', () => { engine.applyMix(b.dataset.p); sync(); });
    }
    // RESTABLECER: el preset que manda, entero, y el máster a 0 dB
    root.querySelector('.im-reset').addEventListener('click', () => {
      engine.clearMuteSolo();
      engine.applyMix(engine.mixPreset);
      sync();
      master.s.set(DEF); master.apply(DEF);
    });
    showPresets();
    showMS();
    root.querySelector('.im-close').addEventListener('click', onClose);
  }
  // los faders siguen al motor (tras elegir un preset)
  function sync() {
    mixSeen = engine.mixVersion;
    load();
    for (const c of chans) { c.s.set(val[c.i][c.k]); c.show(val[c.i][c.k]); }
    showPresets();
    showMS();
  }

  // MUTE / SOLO encendidos, y apagado (gris) el canal que no se oye por el SOLO de otro
  function showMS() {
    for (const c of chans) {
      c.el.querySelector('.im-mute').classList.toggle('on', engine.mute[c.i].has(c.k));
      c.el.querySelector('.im-solo').classList.toggle('on', engine.solo[c.i].has(c.k));
      c.el.classList.toggle('im-off', !engine.heard(c.i, c.k));
    }
  }

  // el preset que manda, encendido; RETOCADA si algún fader a la vista no está donde dice
  function showPresets() {
    for (const b of root.querySelectorAll('.im-preset')) b.classList.toggle('on', b.dataset.p === engine.mixPreset);
    const touched = chans.some((c) => Math.abs(val[c.i][c.k] - presetPos(engine, c.k)) > 0.004);
    root.querySelector('.im-touched')?.classList.toggle('on', touched);
  }

  render();

  return {
    render,
    // con el panel abierto: los medidores siguen a lo que suena (caída suave).
    // `mm` = el máster de este fotograma (ver masterMeter en meters.js)
    frame(mm) {
      if (!engine.ready) return;
      if (engine.mixVersion !== mixSeen) sync();
      paintMaster(master.el, mm);
      for (const c of chans) {
        const d = engine.decks[c.i];
        if (c.k === 'fx' && val[c.i].fx !== engine.fxPos[c.i]) { // lo movieron desde el universo
          val[c.i].fx = engine.fxPos[c.i];
          c.s.set(val[c.i].fx);
          c.show(val[c.i].fx);
          showPresets();
        }
        // en la MISMA escala que el fader: el pico de un instrumento llega justo a la altura de su
        // fader (cada canal tiene su pico máximo en 0 dB antes del fader)
        const p = levelPos(c.k === 'fx' ? d.fx?.level() ?? 0 : d.instLevel(c.k));
        c.lv = Math.max(p, c.lv * 0.9);
        c.meter.style.transform = `scaleY(${c.lv.toFixed(3)})`;
      }
    },
  };
}
