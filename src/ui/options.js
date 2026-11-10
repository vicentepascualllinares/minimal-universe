// OPCIONES: preferencias del instrumento, por apartados (DJ, AUTO-ARREGLOS, RENDIMIENTO).
// Se abre encima del escenario como el MIXER; la música sigue sonando.
// Calidad, búfer, margen y salida de audio se guardan en este navegador (son del aparato);
// el resto todavía no se guarda: vendrá con las cuentas.

import { EQ_TYPES } from '../audio/strip.js';
import { BUFFER_MODES, MARGIN_MODES } from '../audio/engine.js';
import { QUALITY_MODES } from '../audio/quality.js';

const choice = (attr, k, t) => `<button class="op-choice" ${attr}="${k}"><b>${t.label}</b><small>${t.desc}</small></button>`;
// RENDIMIENTO: sin texto, solo el nombre (la descripción queda al pasar el ratón) y en orden
// de menos a más calidad; AUTO, que se mueve solo por la escala, al final
const plain = (attr, k, t) => `<button class="op-choice op-plain" ${attr}="${k}" title="${t.desc}"><b>${t.label}</b></button>`;
const inOrder = (modes, keys, attr) => keys.map((k) => plain(attr, k, modes[k])).join('');
const ms = (s) => `${Math.round(s * 1000)} ms`;
const dB = (v) => `${String(v).replace('.', ',').replace('-', '−')} dB`;

// AUTO-ARREGLOS: un interruptor por truco (ver Deck.autoArrange y Deck.kickGap)
const AUTOS = [
  { k: 'kickGap', label: 'HUECO ANTES DEL KICK', amount: (o) => ms(o.kickGapS),
    desc: 'cuando entra el kick de golpe (venía de una escena sin kick), el universo calla un instante justo antes de su primer golpe: más pegada' },
  { k: 'kickDrop', label: 'CAÍDA DEL KICK AL FINAL DE FRASE', amount: (o) => `ÚLTIMO TIEMPO · CADA ${o.kickDropBars} COMPASES`,
    desc: 'el kick calla el último tiempo del último compás de cada tramo: respira y marca que empieza otro' },
  { k: 'bassOut', label: 'BAJO FUERA ANTES DEL DROP', amount: () => 'ÚLTIMO TIEMPO',
    desc: 'el bajo calla el último tiempo antes del drop y vuelve con el kick en el 1' },
  { k: 'lowsDip', label: 'GRAVES QUE BAJAN ANTES DEL DROP', amount: (o) => `${dB(o.lowsDb)} · ÚLTIMO COMPÁS`,
    desc: 'durante el último compás antes del drop los graves (por debajo de ~200 Hz) bajan poco a poco; vuelven enteros en el 1' },
  { k: 'breakDip', label: 'MENOS VOLUMEN SIN KICK', amount: (o) => dB(o.breakDb),
    desc: 'mientras no hay kick el universo suena un poco más bajo; al entrar el kick recupera el nivel: el drop parece más grande' },
];

export function optionsPanel(root, engine, onClose) {
  root.innerHTML = `
    <div class="im-head">
      <span class="im-title">OPCIONES</span>
    </div>
    <div class="op-sec">
      <div class="op-sec-title">DJ</div>
      <div class="op-row">
        <span class="op-lab">EQ DE LA MESA · HI · MID · LOW</span>
        <div class="op-choices">${Object.entries(EQ_TYPES).map(([k, t]) => choice('data-v', k, t)).join('')}</div>
        <span class="op-note">como «EQ Type» en rekordbox · afecta a los dos universos del modo DJ</span>
      </div>
    </div>
    <div class="op-sec">
      <div class="op-sec-title">ENTRADA DE AUDIO</div>
      <div class="op-row">
        <span class="op-lab">FUENTE · <b class="op-in-state">NADA</b></span>
        <div class="op-out-row">
          <button class="op-mini op-in-screen" title="el navegador deja elegir: una PESTAÑA (solo su audio; la pestaña se queda en silencio y se oye solo aquí) o la PANTALLA entera marcando «compartir audio del sistema» (todo el ordenador)">PESTAÑA / ORDENADOR</button>
          <select class="op-select op-in-dev" title="una entrada de audio de Windows (micro, interfaz o cable virtual)"></select>
          <button class="op-mini op-in-dev-go">USAR</button>
          <button class="op-mini op-in-stop">QUITAR</button>
        </div>
        <span class="op-note op-in-note"></span>
      </div>
      <div class="op-row">
        <span class="op-lab">NIVEL · <b class="op-in-db"></b> · ENTRA <b class="op-in-peak">−∞</b></span>
        <input type="range" class="op-in-gain" min="-40" max="12" step="0.5" />
        <span class="op-note">entra en general (no en un universo), antes del limitador del máster: GRABAR también lo coge · para elegir apps concretas y que no suenen por su lado: un cable virtual (VB-CABLE) como salida de esas apps en Windows (Sonido → Mezclador de volumen) y aquí, como dispositivo, «CABLE Output»</span>
      </div>
    </div>
    <div class="op-sec">
      <div class="op-sec-title">AUTO-ARREGLOS</div>
      ${AUTOS.map((a) => `
      <div class="op-row">
        <span class="op-lab">${a.label}</span>
        <div class="op-choices">
          <button class="op-choice" data-a="${a.k}"><b></b><small>${a.desc}</small></button>
        </div>
      </div>`).join('')}
      <span class="op-note">trucos que en producción se hacen a mano; aquí, en vivo · pulsa cada uno para encenderlo o apagarlo · «drop» = un viaje DE GOLPE en el que entra el kick</span>
    </div>
    <div class="op-sec">
      <div class="op-sec-title">RENDIMIENTO</div>
      <div class="op-row">
        <span class="op-lab">CALIDAD</span>
        <div class="op-choices">${inOrder(QUALITY_MODES, ['ligera', 'normal', 'alta'], 'data-q')}</div>
      </div>
      <div class="op-row">
        <span class="op-lab">BÚFER</span>
        <div class="op-choices">${inOrder(BUFFER_MODES, ['bajo', 'estable', 'maximo', 'auto'], 'data-b')}</div>
        <span class="op-note op-lat"></span>
      </div>
      <div class="op-row">
        <span class="op-lab">MARGEN</span>
        <div class="op-choices">${inOrder(MARGIN_MODES, ['corto', 'normal', 'largo', 'auto'], 'data-g')}</div>
      </div>
      <div class="op-row op-out" hidden>
        <span class="op-lab">SALIDA DE AUDIO</span>
        <div class="op-out-row">
          <select class="op-select"></select>
          <button class="op-mini op-names" hidden title="el navegador solo enseña las salidas si das permiso de micrófono: es solo para ver los nombres, no se graba nada">VER NOMBRES</button>
        </div>
        <span class="op-note op-out-note"></span>
      </div>
      <div class="op-row">
        <span class="op-lab">MEDIDORES</span>
        <div class="op-choices op-meters">
          <button class="op-choice op-plain" data-m="cortes" title="el audio se quedó sin datos: huecos o chasquidos"><b>CORTES</b></button>
          <button class="op-choice op-plain" data-m="tarde" title="notas que salieron fuera de tiempo: el ordenador se atascó"><b>TARDE</b></button>
        </div>
      </div>
      <div class="op-row">
        <span class="op-lab">INCIDENCIAS</span>
        <div class="op-inc"></div>
        <span class="op-note">fallos del audio que el programa ha visto (y, si pudo, arreglado solo) · se guardan en este navegador · <button class="op-mini op-inc-clear">BORRAR</button></span>
      </div>
    </div>
    <div class="im-foot">
      <button class="im-close">CERRAR</button>
    </div>`;

  const q = (s) => root.querySelector(s);
  const eqs = [...root.querySelectorAll('.op-choice[data-v]')];
  const meters = [...root.querySelectorAll('.op-choice[data-m]')];
  const buffers = [...root.querySelectorAll('.op-choice[data-b]')];
  const qualities = [...root.querySelectorAll('.op-choice[data-q]')];
  const margins = [...root.querySelectorAll('.op-choice[data-g]')];
  const autos = [...root.querySelectorAll('.op-choice[data-a]')];
  const show = () => {
    for (const b of autos) {
      const on = !!engine.auto[b.dataset.a];
      b.classList.toggle('on', on);
      const txt = on ? `ENCENDIDO · ${AUTOS.find((a) => a.k === b.dataset.a).amount(engine.auto)}` : 'APAGADO';
      if (b.firstChild.textContent !== txt) b.firstChild.textContent = txt;
    }
    eqs.forEach((b) => b.classList.toggle('on', b.dataset.v === engine.eqType));
    meters.forEach((b) => b.classList.toggle('on', engine.meters[b.dataset.m]));
    buffers.forEach((b) => b.classList.toggle('on', b.dataset.b === engine.bufferMode));
    qualities.forEach((b) => b.classList.toggle('on', b.dataset.q === engine.qualityMode));
    margins.forEach((b) => b.classList.toggle('on', b.dataset.g === engine.marginMode));
  };
  for (const b of eqs) {
    b.addEventListener('click', () => { engine.setEqType(b.dataset.v); show(); });
  }
  for (const b of autos) {
    b.addEventListener('click', () => { engine.auto[b.dataset.a] = !engine.auto[b.dataset.a]; show(); });
  }
  // cada medidor se enciende o se apaga por separado
  for (const b of meters) {
    b.addEventListener('click', () => { engine.meters[b.dataset.m] = !engine.meters[b.dataset.m]; show(); });
  }
  for (const b of buffers) {
    b.addEventListener('click', () => {
      if (b.dataset.b === engine.bufferMode && b.dataset.b !== 'auto') return;
      engine.setBufferMode(b.dataset.b);
      show();
    });
  }

  for (const b of qualities) b.addEventListener('click', () => { engine.setQualityMode(b.dataset.q); show(); });
  for (const b of margins) b.addEventListener('click', () => { engine.setMarginMode(b.dataset.g); show(); });

  // ── SALIDA DE AUDIO (solo donde el navegador lo permite: Chrome / Edge)
  const outRow = q('.op-out');
  const sel = q('.op-select');
  const namesBtn = q('.op-names');
  const outNote = q('.op-out-note');
  const listOutputs = async () => {
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput'); } catch {}
    // sin permiso, el navegador esconde los nombres (y casi todas las salidas)
    const hidden = !devs.some((d) => d.label);
    const opts = [['', 'LA DEL SISTEMA']];
    for (const d of devs) if (d.deviceId && d.deviceId !== 'default' && d.label) opts.push([d.deviceId, d.label]);
    if (engine.sinkId && !opts.some(([id]) => id === engine.sinkId)) opts.push([engine.sinkId, 'LA ELEGIDA ANTES']);
    sel.innerHTML = opts.map(([id, l]) => `<option value="${id}">${l}</option>`).join('');
    sel.value = engine.sinkId;
    namesBtn.hidden = !hidden;
    outNote.textContent = ''; // solo para avisar si una salida falla
  };
  if (engine.canPickOutput && navigator.mediaDevices?.enumerateDevices) {
    outRow.hidden = false;
    listOutputs();
    navigator.mediaDevices.addEventListener?.('devicechange', listOutputs);
    sel.addEventListener('change', async () => {
      try { await engine.setOutput(sel.value); }
      catch { outNote.textContent = 'no se pudo usar esa salida'; sel.value = engine.sinkId; }
    });
    namesBtn.addEventListener('click', async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop()); // solo era para desbloquear los nombres
      } catch {}
      listOutputs();
    });
  }

  // ── ENTRADA DE AUDIO (ver lineIn.js)
  const li = engine.lineIn;
  const inState = q('.op-in-state');
  const inNote = q('.op-in-note');
  const inDev = q('.op-in-dev');
  const inGain = q('.op-in-gain');
  const inDb = q('.op-in-db');
  const inPeak = q('.op-in-peak');
  const showIn = (err) => {
    inState.textContent = li.on ? li.kind === 'dispositivo' ? (li.label || 'DISPOSITIVO').toUpperCase() : li.label : 'NADA';
    inNote.textContent = err || li.note;
    inDb.textContent = li.gainDb <= -40 ? 'APAGADO' : dB(li.gainDb > 0 ? `+${li.gainDb}` : li.gainDb);
  };
  li.onChange = () => showIn();
  const listInputs = async () => {
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'); } catch {}
    const opts = [['', 'ENTRADA DEL SISTEMA']];
    devs.forEach((d, i) => { if (d.deviceId && d.deviceId !== 'default') opts.push([d.deviceId, d.label || `ENTRADA ${i + 1}`]); });
    inDev.innerHTML = opts.map(([id, l]) => `<option value="${id}">${l}</option>`).join('');
    inDev.value = opts.some(([id]) => id === li.deviceId) ? li.deviceId : '';
  };
  const tryIn = async (fn) => {
    try { await fn(); showIn(); }
    catch (e) {
      const msg = e?.name === 'NotAllowedError' ? 'cancelado o sin permiso'
        : e?.message === 'sin audio' ? 'eso no traía audio: en una pestaña marca «compartir audio»; en la pantalla, «compartir audio del sistema»'
        : `no se pudo: ${e?.message || e}`;
      showIn(msg);
    }
    listInputs(); // con permiso ya se ven los nombres
  };
  if (navigator.mediaDevices?.getDisplayMedia) q('.op-in-screen').addEventListener('click', () => tryIn(() => li.fromScreen()));
  else q('.op-in-screen').hidden = true;
  q('.op-in-dev-go').addEventListener('click', () => tryIn(() => li.fromDevice(inDev.value)));
  q('.op-in-stop').addEventListener('click', () => { li.stop(); showIn(); });
  inGain.value = li.gainDb;
  inGain.addEventListener('input', () => { li.setGainDb(+inGain.value); showIn(); });
  if (navigator.mediaDevices?.enumerateDevices) {
    listInputs();
    navigator.mediaDevices.addEventListener?.('devicechange', listInputs);
  }
  showIn();

  root.querySelector('.im-close').addEventListener('click', onClose);
  show();

  // REGISTRO DE INCIDENCIAS: las más recientes arriba (ver logIncident en engine.js)
  const inc = q('.op-inc');
  let incShown = -1;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const showIncidents = () => {
    const list = engine.incidents;
    if (list.length === incShown && (list.at(-1)?.t ?? '') === inc.dataset.last) return;
    incShown = list.length;
    inc.dataset.last = list.at(-1)?.t ?? '';
    inc.innerHTML = list.length
      ? list.slice(-8).reverse().map((it) => {
        const d = new Date(it.t);
        const when = `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-ES')}`;
        return `<div class="op-inc-it" title="${esc(it.ctx)}"><b>${when} · ${esc(it.type.toUpperCase())}</b> ${esc(it.detail)}</div>`;
      }).join('')
      : '<div class="op-inc-none">ninguna</div>';
  };
  q('.op-inc-clear').addEventListener('click', () => { engine.clearIncidents(); showIncidents(); });
  showIncidents();

  // lo que ha dado de verdad este equipo (se refresca mientras el panel está abierto)
  const lat = q('.op-lat');
  return {
    frame() {
      show();
      showIncidents();
      const pk = li.peakDb();
      const pTxt = pk > -60 ? `${pk.toFixed(1).replace('.', ',').replace('-', '−')} dB` : '−∞';
      if (inPeak.textContent !== pTxt) inPeak.textContent = pTxt;
      const L = engine.latencyInfo();
      const txt = engine.rebuilding ? 'rehaciendo el audio…'
        : !L ? ''
        : !L.out ? 'midiendo…' // el navegador tarda un instante en saber la latencia de salida
        : `ahora: búfer ${ms(L.base)} · salida ${ms(L.out)} · margen ${ms(L.lookahead)} · respuesta al tocar ≈ ${L.total.toFixed(2).replace('.', ',')} s`
          + (engine.bufferNote ? ` · ${engine.bufferNote}` : '');
      if (lat.textContent !== txt) lat.textContent = txt;
    },
  };
}
