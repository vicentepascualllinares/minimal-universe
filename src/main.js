import { Engine } from './audio/engine.js';
import { VSlider } from './ui/slider.js';
import { Knob } from './ui/knob.js';
import { deckView } from './ui/deckView.js';
import { instMixer } from './ui/instMixer.js';
import { optionsPanel } from './ui/options.js';
import { PROFILE } from './core/profile.js';
import { SCALES } from './music/emotion.js';

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const engine = new Engine();
window.MU = engine; // para depurar desde la consola

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
instMixer(mixPanel, engine, closePanels);
optionsPanel(optPanel, engine, closePanels);
$('#mixbtn').addEventListener('click', toggleMixer);
$('#optbtn').addEventListener('click', () => setPanel(optPanel, optPanel.hidden));

const [A, B] = engine.decks;
const KEYS = {
  solo: { Space: toggle, KeyM: toggleMixer, Escape: closePanels, KeyL: () => A.toggleLoop(), KeyN: () => A.reseed(), KeyQ: () => A.toggleLoop(), KeyW: () => A.reseed() },
  dj: { Space: toggle, KeyM: toggleMixer, Escape: closePanels, KeyQ: () => A.toggleLoop(), KeyW: () => A.reseed(), KeyO: () => B.reseed(), KeyP: () => B.toggleLoop() },
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
  await engine.play(); // dentro del clic: el navegador permite arrancar el audio
});

function start(mode) {
  engine.setMode(mode);
  document.body.classList.add(`mode-${mode}`);
  if (mode === 'solo') {
    views = [deckView($('#deckA'), A, 'UNIVERSO')];
  } else {
    views = [deckView($('#deckA'), A), deckView($('#deckB'), B)];
    document.querySelectorAll('.mx-grid [data-k]').forEach((el) => {
      const d = Number(el.dataset.d);
      const k = el.dataset.k;
      new Knob(el, { value: engine.mix[d][k], onChange: (v) => engine.setMix(d, k, v) });
    });
    document.querySelectorAll('#mixer .fader').forEach((el) => {
      const d = Number(el.dataset.d);
      new VSlider(el, { value: engine.mix[d].fader, onChange: (v) => engine.setMix(d, 'fader', v) });
    });
  }
  requestAnimationFrame(frame);
}

// ───────── bucle de dibujo
const meters = [...document.querySelectorAll('.meter i')];
const meterLv = [0, 0];
const scope = $('#scope');
const sg = scope.getContext('2d');
let scopeBuf = null;

function frame() {
  views.forEach((v) => v.frame(engine));
  root.style.setProperty('--glowA', views[0].color);
  root.style.setProperty('--ga', engine.mix[0].fader);
  if (views[1]) {
    root.style.setProperty('--glowB', views[1].color);
    root.style.setProperty('--gb', engine.mix[1].fader);
  }

  $('#key').textContent = NOTE[engine.rootMidi % 12];
  const nextScale = engine.scaleNext !== null ? SCALES[engine.scaleNext] : null;
  const modeTxt = (nextScale || engine.scale).name.toUpperCase();
  if ($('#mode').textContent !== modeTxt) $('#mode').textContent = modeTxt;
  $('#mode').classList.toggle('pending', !!nextScale);
  const st = Math.max(0, engine.step - 1);
  $('#pos').textContent = `${String(Math.floor(st / 16) + 1).padStart(3, '0')}.${Math.floor((st % 16) / 4) + 1}`;
  if (PROFILE.lite) {
    const h = $('#health');
    const g = engine.glitches;
    h.textContent = g ? `CORTES ${g}` : 'AUDIO OK';
    h.classList.toggle('bad', g > 0);
  }
  const sState = $('#state');
  sState.textContent = engine.playing ? 'EN VIVO' : 'PAUSA';
  sState.classList.toggle('live', engine.playing);

  if (engine.ready && engine.mode === 'dj') {
    engine.strips.forEach((s, i) => {
      const lv = Math.min(1, s.level());
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
