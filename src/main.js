import { Engine } from './audio/engine.js';
import { VSlider } from './ui/slider.js';
import { Knob } from './ui/knob.js';
import { deckView } from './ui/deckView.js';
import { instMixer } from './ui/instMixer.js';
import { optionsPanel } from './ui/options.js';
import { masterMeter, paintMaster } from './ui/meters.js';
import { PROFILE } from './core/profile.js';
import { SCALES } from './music/emotion.js';

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const engine = new Engine();
window.MU = engine; // para depurar desde la consola
// cualquier error del programa queda en el REGISTRO DE INCIDENCIAS (OPCIONES → RENDIMIENTO)
window.addEventListener('error', (e) => engine.logIncident('error', `${e.message} · ${e.filename?.split('/').pop()}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => engine.logIncident('error', `${e.reason?.message || e.reason}`));

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
document.body.classList.toggle('lite', PROFILE.lite); // perfil móvil
let views = [];

// ───────── global: BPM y tónica (arrastrar en vertical o rueda)
function dragNumber(el, get, set, pxPerUnit) {
  let pid = null;
  let y0 = 0;
  let v0 = 0;
  el.addEventListener('pointerdown', (ev) => {
    if (pid !== null) return;
    pid = ev.pointerId;
    y0 = ev.clientY;
    v0 = get();
    el.setPointerCapture(pid);
  });
  el.addEventListener('pointermove', (e) => e.pointerId === pid && set(v0 + (y0 - e.clientY) / pxPerUnit));
  const up = (e) => { if (e.pointerId === pid) pid = null; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (ev) => { ev.preventDefault(); set(get() - Math.sign(ev.deltaY) * (6 / pxPerUnit)); }, { passive: false });
}
dragNumber($('#bpm'), () => engine.bpm, (v) => {
  engine.bpm = Math.round(Math.min(140, Math.max(100, v)) * 2) / 2;
  $('#bpm').textContent = engine.bpm % 1 ? engine.bpm.toFixed(1) : engine.bpm;
}, 6);
dragNumber($('#key'), () => engine.rootMidi, (v) => {
  engine.rootMidi = Math.round(Math.min(35, Math.max(28, v))); // E1..B1
}, 14);

// ───────── transporte
const toggle = async () => {
  if (!engine.ready) return;
  if (engine.playing) engine.stop();
  else await engine.play();
};
$('#state').addEventListener('click', toggle);
$('#mode').addEventListener('click', () => engine.cycleScale());
$('#health').addEventListener('click', () => { engine.glitches = 0; engine.late = 0; }); // poner a cero para medir
// GRABAR: armar (empieza en el primer sonido) / parar y guardar el WAV
const toggleRec = () => engine.rec.toggle();
$('#rec').addEventListener('click', toggleRec);

// ───────── MIXER global (volumen por instrumento)
// ───────── paneles encima del escenario: MIXER y OPCIONES (solo uno a la vez)
const mixPanel = $('#instmix');
const optPanel = $('#options');
const setPanel = (panel, open) => {
  for (const [p, btn] of [[mixPanel, '#mixbtn'], [optPanel, '#optbtn']]) {
    const on = p === panel && open;
    p.hidden = !on;
    $(btn).classList.toggle('on', on);
  }
};
const setMixer = (open) => setPanel(mixPanel, open);
const toggleMixer = () => setMixer(mixPanel.hidden);
const closePanels = () => setPanel(null, false);
const mixView = instMixer(mixPanel, engine, closePanels);
const optView = optionsPanel(optPanel, engine, closePanels);
$('#mixbtn').addEventListener('click', toggleMixer);
$('#optbtn').addEventListener('click', () => setPanel(optPanel, optPanel.hidden));

const [A, B] = engine.decks;
const KEYS = {
  solo: { Space: toggle, KeyR: toggleRec, KeyM: toggleMixer, Escape: closePanels, KeyN: () => A.reseed(), KeyW: () => A.reseed() },
  dj: { Space: toggle, KeyR: toggleRec, KeyM: toggleMixer, Escape: closePanels, KeyW: () => A.reseed(), KeyO: () => B.reseed() },
};
window.addEventListener('keydown', (ev) => {
  const k = KEYS[engine.mode][ev.code];
  if (ev.repeat || !k || !engine.ready) return;
  ev.preventDefault();
  k();
});

// ───────── pestañas (solo se ven en pantallas pequeñas en modo DJ)
$('#tabs').addEventListener('pointerdown', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  $('#stage').dataset.tab = b.dataset.tab;
  $('#tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
});

// ───────── entrada: elegir modo
let lastMode = 'solo';
try { lastMode = localStorage.getItem('mu.mode') || 'solo'; } catch {}
document.querySelectorAll('.mode-opt').forEach((b) => b.classList.toggle('last', b.dataset.mode === lastMode));

$('#modes')?.addEventListener('click', async (ev) => {
  const b = ev.target.closest('.mode-opt');
  if (!b || engine.ready) return;
  const mode = b.dataset.mode;
  try { localStorage.setItem('mu.mode', mode); } catch {}
  start(mode);
  $('#enter').classList.add('gone');
  // dentro del clic (el navegador lo permite) se prepara el audio, pero NO se genera música
  // hasta pulsar GENERAR: así se puede armar GRABAR antes y no grabar silencio
  await engine.prepare();
});

function start(mode) {
  engine.setMode(mode);
  mixView.render(); // MIXER: en DJ, A y B
  document.body.classList.add(`mode-${mode}`);
  if (mode === 'solo') {
    views = [deckView($('#deckA'), A, 'UNIVERSO', { panel: true })]; // (la GENERACIÓN, en su panel a la derecha)
  } else {
    views = [deckView($('#deckA'), A), deckView($('#deckB'), B)];
    const eqKnobs = [...document.querySelectorAll('.mx-grid [data-k]')].map((el) => {
      const d = Number(el.dataset.d);
      const k = el.dataset.k;
      return { d, k, knob: new Knob(el, { value: engine.mix[d][k], onChange: (v) => engine.setMix(d, k, v) }) };
    });
    // EASY EQ: una perilla por banda de A (izquierda) a B (derecha); doble clic = los dos
    const xfKnobs = [...document.querySelectorAll('.mx-grid [data-x]')].map((el) => {
      const k = el.dataset.x;
      return { k, knob: new Knob(el, { value: engine.xf[k], onChange: (v) => engine.setXf(k, v) }) };
    });
    const faders = [...document.querySelectorAll('#mixer .fader')].map((el) => {
      const d = Number(el.dataset.d);
      return new VSlider(el, { value: engine.mix[d].fader, onChange: (v) => engine.setMix(d, 'fader', v) });
    });
    const easyBtn = $('.mx-easy-btn');
    const showEasy = () => {
      $('#mixer').classList.toggle('easy', engine.easyEq);
      easyBtn.classList.toggle('on', engine.easyEq);
    };
    // al cambiar, el motor traduce lo que suena (ver setEasyEq): los mandos lo siguen
    easyBtn.addEventListener('pointerdown', () => {
      engine.setEasyEq(!engine.easyEq);
      eqKnobs.forEach((o) => o.knob.set(engine.mix[o.d][o.k]));
      xfKnobs.forEach((o) => o.knob.set(engine.xf[o.k]));
      faders.forEach((f, d) => f.set(engine.mix[d].fader));
      showEasy();
    });
    showEasy();
  }
  requestAnimationFrame(frame);
}

// ───────── bucle de dibujo
const meters = [...document.querySelectorAll('.meter i')];
const meterLv = [0, 0];
const scope = $('#scope');
const sg = scope.getContext('2d');
let scopeBuf = null;
const mm = masterMeter(engine); // el máster, leído una vez por fotograma (mesa DJ y MIXER)
const mxMaster = $('.mx-mstr');
const mixerEl = $('#mixer'); // barras del máster entre los faders y cifras debajo: se pintan juntas

function frame() {
  views.forEach((v) => v.frame(engine));
  if (!optPanel.hidden) optView.frame();
  const djMaster = engine.ready && engine.mode === 'dj' && mxMaster.offsetParent !== null; // la mesa se ve
  if (engine.ready && (djMaster || !mixPanel.hidden)) mm.update();
  if (!mixPanel.hidden) mixView.frame(mm);
  if (djMaster) paintMaster(mixerEl, mm);
  root.style.setProperty('--glowA', views[0].color);
  root.style.setProperty('--ga', engine.mix[0].fader);
  if (views[1]) {
    root.style.setProperty('--glowB', views[1].color);
    root.style.setProperty('--gb', engine.mix[1].fader);
  }

  $('#key').textContent = NOTE[engine.rootMidi % 12];
  // (el BPM también puede cambiarlo un UNIVERSO GUARDADO al entrar: ver Engine.universeLoaded)
  const bpmTxt = String(engine.bpm % 1 ? engine.bpm.toFixed(1) : engine.bpm);
  if ($('#bpm').textContent !== bpmTxt) $('#bpm').textContent = bpmTxt;
  const nextScale = engine.scaleNext !== null ? SCALES[engine.scaleNext] : null;
  const modeTxt = (nextScale || engine.scale).name.toUpperCase();
  if ($('#mode').textContent !== modeTxt) $('#mode').textContent = modeTxt;
  $('#mode').classList.toggle('pending', !!nextScale);
  const st = Math.max(0, engine.step - 1);
  $('#pos').textContent = `${String(Math.floor(st / 16) + 1).padStart(3, '0')}.${Math.floor((st % 16) / 4) + 1}`;
  { // medidor de salud del audio (ver RENDIMIENTO.md): CORTES = el audio sin datos, TARDE = notas fuera de tiempo.
    // En OPCIONES → RENDIMIENTO se elige cuáles se ven; sin ninguno, desaparece de la cabecera.
    const M = engine.meters;
    const g = M.cortes ? engine.glitches : 0, l = M.tarde ? engine.late : 0;
    // AUTO acaba de subir el búfer (el hueco que se oyó): se avisa unos segundos
    const autoUp = engine.bufferNoteAt && performance.now() - engine.bufferNoteAt < 6000;
    // el VIGILANTE acaba de rehacer el audio por un fallo (ver OPCIONES → RENDIMIENTO → INCIDENCIAS)
    const healed = engine.recoveredAt && performance.now() - engine.recoveredAt < 8000;
    const txt = engine.rebuilding ? 'REHACIENDO AUDIO…'
      : healed ? 'AUDIO RECUPERADO'
      : autoUp ? 'AUTO: BÚFER ↑'
      : g || l ? [g && `CORTES ${g}`, l && `TARDE ${l}`].filter(Boolean).join(' · ') : 'AUDIO OK';
    const h = $('#health');
    if (h.textContent !== txt) h.textContent = txt;
    h.classList.toggle('bad', g + l > 0 || autoUp || healed);
    const shown = M.cortes || M.tarde || autoUp || healed || engine.rebuilding;
    h.hidden = !shown;
    $('#health-sep').hidden = !shown;
  }
  if (engine.easyOn) { // EASY EQ · GRAVES: de qué universo sale el kick y el bajo (parpadea si va a cambiar)
    const L = engine.low.info();
    for (const r of ['kick', 'bass']) {
      const el = $(`.r-${r}`), t = L[r] || '–';
      if (el.textContent !== t) el.textContent = t;
    }
    $('.mx-roles').classList.toggle('pending', L.pending);
  } else if (engine.mode === 'dj') { // EQ normal: papeles heredados de EASY que siguen forzados
    const h = engine.low.heldInfo().map((t) => `<span>${t}</span>`).join('');
    const el = $('.mx-held');
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  const sState = $('#state');
  const stTxt = engine.playing ? 'EN VIVO' : engine.generated ? 'PAUSA' : 'GENERAR';
  if (sState.textContent !== stTxt) sState.textContent = stTxt;
  sState.classList.toggle('live', engine.playing);
  sState.classList.toggle('go', !engine.generated && engine.ready); // aún sin empezar: que se vea
  // GRABAR
  const R = engine.rec;
  const t = Math.floor(R.seconds);
  const recTxt = R.state === 'armed' ? '● ESPERANDO SONIDO'
    : R.state === 'rec' ? `■ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · ${(R.bytes / 1048576).toFixed(1).replace('.', ',')} MB`
    : R.state === 'saving' ? 'GUARDANDO…' : '● GRABAR';
  const rb = $('#rec');
  if (rb.textContent !== recTxt) rb.textContent = recTxt;
  rb.classList.toggle('armed', R.state === 'armed');
  rb.classList.toggle('on', R.state === 'rec');

  if (engine.ready && engine.mode === 'dj') {
    engine.strips.forEach((s, i) => {
      const lv = Math.min(1, s.level() || 0); // NaN → 0: si no, el medidor se quedaba clavado
      meterLv[i] = Math.max(lv, meterLv[i] * 0.9); // caída suave
      meters[i].style.transform = `scaleY(${meterLv[i]})`;
    });

    if (!PROFILE.lite && scope.clientWidth) {
      const w = (scope.width = scope.clientWidth * devicePixelRatio);
      const h = (scope.height = scope.clientHeight * devicePixelRatio);
      scopeBuf ||= new Float32Array(engine.analyser.fftSize);
      engine.analyser.getFloatTimeDomainData(scopeBuf);
      sg.strokeStyle = 'rgba(217,217,222,0.8)';
      sg.lineWidth = devicePixelRatio;
      sg.beginPath();
      const n = scopeBuf.length;
      for (let i = 0; i < n; i += 4) {
        const x = (i / n) * w;
        const y = h / 2 - scopeBuf[i] * h * 0.45;
        i ? sg.lineTo(x, y) : sg.moveTo(x, y);
      }
      sg.stroke();
    }
  }
  requestAnimationFrame(frame);
}
