// Vista de un UNIVERSO: estructura, transición, complejidad, loop, nuevo universo e instrumentos.
// Se instancia dos veces (izquierda y derecha) sobre el mismo Deck API.

import { VSlider, HSlider } from './slider.js';
import { INSTRUMENTS, SCENES, GRID, likeness } from '../music/arrangement.js';
import {
  GROUPS, GROUP_LABEL, OSC_PATTERNS, OSC_UNITS, OSC_UNIT_ORDER, GESTURES, RATE_ORDER, ZONES, ZONE_ORDER,
  layerCells, layerSlot, oscActive, oscShape,
} from '../music/complexity.js';
import { faderDb, snapMix, setFxFader, presetPos, fmtDb } from './instMixer.js';

const LABEL = { kick: 'KICK', bass: 'BASS', hat: 'HAT', perc: 'PERC', clap: 'CLAP', ohat: 'OPEN', chord: 'CHORD', pad: 'PAD' };

const opts = (cls, values, on) =>
  `<div class="opts ${cls}">${values.map((v) => `<button data-v="${v[0]}"${v[0] === on ? ' class="on"' : ''}>${v[1]}</button>`).join('')}</div>`;
const nums = (arr) => arr.map((n) => [String(n), String(n)]);

// botón de una parte: solo su nombre (lo que es en el tema, no qué instrumentos lleva)
const sceneBtn = (name) => {
  const text = SCENES[name].label.replace('KICK-OUT', 'KICK-&#8203;OUT'); // si no cabe, corta tras el guion
  return `<button class="scene" data-s="${name}" title="clic: ir aquí · mantener: corte (vuelve al soltar) · en un viaje, otra vez: pausa"><span class="sc-name">${text}</span></button>`;
};

function template(label) {
  return `
  <div class="deck-head">
    <span class="deck-name">${label}</span>
    <div class="cx" title="Complejidad global: escala a la vez los cuatro grupos de abajo">
      <span class="cx-lab lo">SIMPLE</span>
      <div class="h-track"><div class="h-line"></div><div class="h-fill"></div><div class="h-handle"></div></div>
      <span class="cx-lab hi">COMPLEJO</span>
    </div>
    <button class="seed">NUEVO UNIVERSO</button>
  </div>
  <div class="rows">
  <div class="row">
    <section class="pad p-struct">
      <div class="pad-title">ESTRUCTURA<span class="ph-ticks" title="la frase: un trazo por compás. Los viajes aterrizan al empezar la frase"></span><span class="p-status"></span></div>
      <div class="pad-box scenes">
        <div class="vers">
          <button class="ver ver-now" title="AHORA: versión de la parte que suena (1 = menos elementos, 2 = más) · cambia en el siguiente compás · no en un viaje progresivo en marcha ni en LOOP"><span class="ver-lab">AHORA</span><b data-v="0">1</b><b data-v="1">2</b></button>
          <button class="ver ver-next" title="LUEGO: versión del destino del viaje; quieto, la de la próxima parte que pulses · al llegar, AHORA pasa a ser esta"><span class="ver-lab">LUEGO</span><b data-v="0">1</b><b data-v="1">2</b></button>
        </div>
        ${GRID.flat().map(sceneBtn).join('')}
      </div>
    </section>
    <section class="col trans">
      <div class="col-title">TRANSICIÓN</div>
      ${opts('t-form stack', [['golpe', 'DE GOLPE'], ['prog', 'PROGRESIVA']], 'prog')}
      ${opts('t-flow stack', [['escalonado', 'ESCALONADA'], ['suave', 'SUAVE']], 'suave')}
      ${opts('t-len', [['0', 'INSTANTÁNEO'], ...nums([1, 2, 4, 8, 16, 32])], '4')}
      <button class="t-fx on" title="efectos de transición en el viaje: riser, redoble, platos, drop">FX</button>
      <div class="t-vol" title="VOLUMEN de los efectos de transición de este universo (también en el MIXER) · doble clic = 0 dB">
        <div class="fader"><div class="t-track"><div class="t-line"></div><i class="im-zero"></i><div class="t-handle"></div></div></div>
        <span class="t-vol-db">0.0</span>
      </div>
    </section>
  </div>
  <div class="row">
    <section class="pad p-cx">
      <div class="pad-title">COMPLEJIDAD<button class="osc-mute" title="OSCILADORES de este universo: encendidos / en silencio. En silencio suenan los faders y puedes preparar los osciladores por debajo">OSC</button></div>
      <div class="pad-box cx-box">${GROUPS.map((g) => `
        <div class="cxf" data-g="${g}">
          <span class="cxf-val"></span>
          <div class="fader"><div class="t-track"><div class="t-line"></div><i class="cxf-range"></i><i class="cxf-eff"></i><div class="t-handle"></div></div>
            <div class="cxf-lane" title="B: hasta dónde va el OSCILADOR (el fader es el punto de partida) · arrastrar · doble clic = quitar"><i class="cxf-b"></i></div></div>
          <span class="cxf-name"><button class="osc-on osc-sq" title="encender / apagar el OSCILADOR de este grupo"></button>${GROUP_LABEL[g]}</span>
          <div class="osc">
            <span class="osc-hint" hidden></span>
            <div class="osc-gest">
              <button class="osc-prev" title="gesto anterior">‹</button>
              <button class="osc-word" title="GESTO: qué hace este grupo en la frase · clic = el siguiente"></button>
              <button class="osc-next" title="gesto siguiente">›</button>
            </div>
            <div class="osc-line" title="LA FRASE (8 compases): dónde se abre hacia B y por dónde va&#10;arrastrar arriba / abajo = más rápido / más lento&#10;arrastrar de lado = en qué tramo (toda la frase, 2ª mitad, final)&#10;rueda = velocidad · doble clic = como el gesto · mantener = editor de casillas">${'<i><b></b></i>'.repeat(32)}</div>
          </div>
        </div>`).join('')}
        <div class="osc-ed" hidden>
          <div class="ed-head"><span class="ed-title"></span><button class="ed-close" title="cerrar (Esc)">✕</button></div>
          <div class="ed-layers">${[0, 1].map((li) => `
            <div class="osc-layer" data-l="${li}">
              <span class="ed-lab">${li ? 'NIVEL 2 · TRAMO' : 'NIVEL 1 · FORMA'}</span>
              <div class="osc-pat">
                <button class="osc-prev" title="patrón anterior (borra lo pintado)">‹</button>
                <span class="osc-cells">${'<i><b></b></i>'.repeat(4)}</span>
                <button class="osc-next" title="patrón siguiente (borra lo pintado)">›</button>
              </div>
              <div class="osc-foot">
                <button class="osc-lon osc-sq" title="${li ? 'NIVEL 2: encender / apagar. Multiplica al 1: decide cuánto del 1 suena en cada casilla' : 'NIVEL 1: encender / apagar'}"></button>
                <button class="osc-unit" title="cada casilla dura: un pulso, medio compás, un compás o dos compases"></button>
                <button class="osc-reset" title="borrar lo pintado: vuelve al patrón">↺</button>
              </div>
            </div>`).join('')}
          </div>
          <button class="ed-reset" title="borrar los retoques: vuelve al gesto con su guía de tiempos">↺ VOLVER AL GESTO</button>
          <div class="ed-help">el 2 multiplica al 1: decide cuánto del 1 suena<br>clic = llenar / vaciar · de lado = pintar<br>arriba / abajo o rueda = nivel intermedio</div>
        </div>
      </div>
    </section>
    <section class="col loopcol">
      <div class="col-title">LOOP</div>
      <button class="loop-btn"><span class="lb-text">LOOP</span><span class="lb-ticks"></span></button>
      <div class="unit">LONGITUD</div>
      ${opts('o-len', nums([1, 2, 4, 8]), '2')}
      <div class="spacer"></div>
      <div class="unit">SALIDA</div>
      ${opts('o-mode stack', [['instant', 'INSTANTÁNEA'], ['prog', 'PROGRESIVA']], 'prog')}
      ${opts('o-bars', nums([1, 2, 4, 8, 16]), '4')}
      <div class="unit">COMPASES</div>
    </section>
  </div>
  </div>
  <div class="strip"></div>`;
}

// color del carácter del universo (frío/violeta -> ámbar cálido; poca energía = más gris)
export function emoColor(v, a) {
  const vn = (v + 1) / 2;
  const an = (a + 1) / 2;
  const cold = [110, 125, 230];
  const warm = [240, 170, 95];
  const c = cold.map((x, i) => x + (warm[i] - x) * vn);
  const sat = 0.55 + 0.45 * an;
  const grey = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => Math.round(grey + (x - grey) * sat)).join(',');
}

export function deckView(root, deck, label = `UNIVERSO ${deck.id}`) {
  root.innerHTML = template(label);
  const q = (s) => root.querySelector(s);

  new HSlider(q('.cx'), { value: deck.cx.global, reset: 0.8, onChange: (v) => (deck.cx.global = v) });
  // COMPLEJIDAD por grupos: un fader cada uno; la barra fina = lo que de verdad suena (× global)
  const cxF = {};
  for (const el of root.querySelectorAll('.cxf')) {
    const g = el.dataset.g;
    const s = new VSlider(el, { value: deck.cx[g], onChange: (v) => deck.setComplexity(g, v) });
    el.querySelector('.t-track').addEventListener('dblclick', () => { s.set(0.5); deck.setComplexity(g, 0.5); });
    cxF[g] = { s, el, val: el.querySelector('.cxf-val'), eff: el.querySelector('.cxf-eff') };
  }
  let cxSeen = deck.cxVersion;
  // OSCILADORES: la marca B junto a cada fader, el GESTO y la línea de la frase (GUÍA DE TIEMPOS)
  const oscV = {};
  const NG = GESTURES.length;
  const timeLabel = (o) => `${OSC_UNITS[o.rate].label} · ${ZONES[o.zone].label}`;
  const gestName = (o) => GESTURES[o.gest].name + (o.edited ? '*' : '');
  // EDITOR de casillas (mantener la línea): los dos niveles del grupo, a mano.
  // PINTAR (0 = A, 1 = B): clic = llena / vacía · de lado = pinta lleno o vacío (lo contrario
  // de la primera casilla) · arriba / abajo = NIVEL intermedio (las casillas crecen para verlo;
  // sin soltar, de lado = ese nivel en las casillas por las que pasas) · rueda = nivel a pasos
  const ed = { el: q('.osc-ed'), g: null, seen: '' };
  const LVL_PX = 50; // recorrido de vacía a llena
  const setupLayer = (li, el) => {
    const L = () => deck.osc[ed.g].layers[li];
    const box = el.querySelector('.osc-cells');
    const cellEls = [...box.children];
    const set = (i, v) => { if (layerCells(L())[i] !== v) deck.paintOsc(ed.g, li, i, v); };
    const cellAt = (ev) => cellEls.indexOf(document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.osc-cells i'));
    let paint = null;
    box.addEventListener('pointerdown', (ev) => {
      const i = cellAt(ev);
      if (paint || i < 0 || !ed.g) return;
      paint = { pid: ev.pointerId, i0: i, v0: layerCells(L())[i], y0: ev.clientY, mode: null, v: 0, cells: new Set([i]) };
      try { box.setPointerCapture(ev.pointerId); } catch {}
    });
    box.addEventListener('pointermove', (ev) => {
      const P = paint;
      if (!P || ev.pointerId !== P.pid) return;
      const i = cellAt(ev);
      if (!P.mode) {
        if (Math.abs(ev.clientY - P.y0) > 4) { P.mode = 'lvl'; box.classList.add('lvl'); }
        else if (i >= 0 && i !== P.i0) { P.mode = 'bin'; P.v = P.v0 >= 0.5 ? 0 : 1; set(P.i0, P.v); }
        else return;
      }
      if (P.mode === 'lvl') {
        if (i >= 0) P.cells.add(i);
        P.v = Math.round(Math.min(1, Math.max(0, P.v0 + (P.y0 - ev.clientY) / LVL_PX)) * 20) / 20;
        for (const c of P.cells) set(c, P.v);
      } else if (i >= 0) set(i, P.v);
    });
    const upP = (ev) => {
      const P = paint;
      if (!P || ev.pointerId !== P.pid) return;
      if (!P.mode && ev.type === 'pointerup') set(P.i0, P.v0 >= 0.5 ? 0 : 1); // clic
      box.classList.remove('lvl');
      paint = null;
    };
    box.addEventListener('pointerup', upP);
    box.addEventListener('pointercancel', upP);
    box.addEventListener('wheel', (ev) => {
      const i = cellAt(ev);
      if (i < 0 || !ed.g) return;
      ev.preventDefault();
      const v = layerCells(L())[i] - Math.sign(ev.deltaY) * 0.1;
      set(i, Math.round(Math.min(1, Math.max(0, v)) * 20) / 20);
    }, { passive: false });
    const N = OSC_PATTERNS.length;
    const on = (sel, f) => el.querySelector(sel).addEventListener('pointerdown', () => ed.g && f());
    on('.osc-prev', () => deck.setOscPattern(ed.g, li, (L().pat + N - 1) % N));
    on('.osc-next', () => deck.setOscPattern(ed.g, li, (L().pat + 1) % N));
    on('.osc-unit', () => {
      const U = OSC_UNIT_ORDER;
      deck.setOscUnit(ed.g, li, U[(U.indexOf(L().unit) + 1) % U.length]);
    });
    on('.osc-reset', () => deck.resetOsc(ed.g, li));
    on('.osc-lon', () => deck.setLayerOn(ed.g, li, !L().on));
    const V = {
      el, box, cells: cellEls, fills: cellEls.map((c) => c.firstElementChild),
      unit: el.querySelector('.osc-unit'), reset: el.querySelector('.osc-reset'), onBtn: el.querySelector('.osc-lon'),
    };
    V.show = (step, live) => {
      const Ly = L();
      const cells = layerCells(Ly);
      const slot = step === null || !live || !Ly.on ? -1 : layerSlot(Ly, step);
      cells.forEach((v, i) => {
        V.fills[i].style.height = `${v * 100}%`;
        V.cells[i].classList.toggle('now', i === slot);
      });
      V.el.classList.toggle('idle', !Ly.on);
      V.onBtn.classList.toggle('on', Ly.on);
      V.box.title = Ly.custom ? '(pintado)' : OSC_PATTERNS[Ly.pat].name;
      V.unit.textContent = OSC_UNITS[Ly.unit].label;
      V.reset.classList.toggle('on', !!Ly.custom);
    };
    return V;
  };
  ed.layers = [...ed.el.querySelectorAll('.osc-layer')].map((x, li) => setupLayer(li, x));
  ed.title = ed.el.querySelector('.ed-title');
  const openEd = (g) => { ed.g = g; ed.seen = ''; ed.el.hidden = false; };
  const closeEd = () => { ed.g = null; ed.el.hidden = true; };
  ed.el.querySelector('.ed-close').addEventListener('pointerdown', closeEd);
  ed.el.querySelector('.ed-reset').addEventListener('pointerdown', () => ed.g && deck.resetGesture(ed.g));
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ed.g) closeEd(); });
  ed.show = (step) => {
    if (!ed.g) return;
    const o = deck.osc[ed.g];
    const live = oscActive(o);
    const key = `${ed.g}|${o.gest}|${o.edited}|${o.rate}|${o.zone}|${JSON.stringify(o.layers)}|${step === null ? -1 : step >> 2}|${live}`;
    if (key === ed.seen) return;
    ed.seen = key;
    ed.title.textContent = `${GROUP_LABEL[ed.g]} · ${gestName(o)}`;
    for (const Lv of ed.layers) Lv.show(step, live);
  };

  for (const g of GROUPS) {
    const el = cxF[g].el;
    const lane = el.querySelector('.cxf-lane');
    // marca B: se arrastra como un fader; doble clic, fuera (la B vuelve a seguir al fader)
    let pid = null;
    const setB = (ev) => {
      const r = lane.getBoundingClientRect();
      deck.setOscB(g, Math.min(1, Math.max(0, 1 - (ev.clientY - r.top) / r.height)));
    };
    lane.addEventListener('pointerdown', (ev) => {
      if (pid !== null) return;
      pid = ev.pointerId;
      try { lane.setPointerCapture(pid); } catch {}
      lane.classList.add('active');
      setB(ev);
    });
    lane.addEventListener('pointermove', (ev) => ev.pointerId === pid && setB(ev));
    const upB = (ev) => { if (ev.pointerId === pid) { pid = null; lane.classList.remove('active'); } };
    lane.addEventListener('pointerup', upB);
    lane.addEventListener('pointercancel', upB);
    lane.addEventListener('dblclick', () => deck.setOscB(g, null));
    el.querySelector('.osc-on').addEventListener('pointerdown', () => deck.setOscOn(g, !deck.osc[g].on));
    // GESTO: flechas o clic en la palabra (la guía de tiempos vuelve a la variante del gesto)
    const pick = (d) => deck.setGesture(g, (deck.osc[g].gest + d + NG) % NG);
    el.querySelector('.osc-gest .osc-prev').addEventListener('pointerdown', () => pick(-1));
    el.querySelector('.osc-gest .osc-next').addEventListener('pointerdown', () => pick(1));
    el.querySelector('.osc-word').addEventListener('pointerdown', () => pick(1));
    const V = {
      osc: el.querySelector('.osc'), lane, b: lane.firstElementChild, range: el.querySelector('.cxf-range'),
      onBtn: el.querySelector('.osc-on'), word: el.querySelector('.osc-word'), hint: el.querySelector('.osc-hint'),
      line: el.querySelector('.osc-line'), seen: '', shapeSeen: '', pulse: -2, hintText: null,
    };
    V.segs = [...V.line.children];
    V.fills = V.segs.map((x) => x.firstElementChild);
    oscV[g] = V;
    // GUÍA DE TIEMPOS sobre la línea de la frase: arriba / abajo = velocidad, de lado = tramo.
    // Se mueve a saltos (cada ~14 px) y el cartel dice dónde estás. Mantener sin mover = editor
    const STEP_PX = 14;
    const ix = (v, n) => Math.min(n - 1, Math.max(0, v));
    let drag = null;
    const line = V.line;
    const endDrag = () => {
      if (drag) clearTimeout(drag.t);
      drag = null;
      V.hintText = null;
    };
    line.addEventListener('pointerdown', (ev) => {
      if (drag) return;
      const o = deck.osc[g];
      drag = {
        pid: ev.pointerId, x0: ev.clientX, y0: ev.clientY, moved: false,
        r0: RATE_ORDER.indexOf(o.rate), z0: ZONE_ORDER.indexOf(o.zone),
        t: setTimeout(() => { if (drag && !drag.moved) { endDrag(); openEd(g); } }, 450),
      };
      try { line.setPointerCapture(ev.pointerId); } catch {}
    });
    line.addEventListener('pointermove', (ev) => {
      if (!drag || ev.pointerId !== drag.pid) return;
      const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      clearTimeout(drag.t);
      const o = deck.osc[g];
      if (GESTURES[o.gest].shape === null) return; // '—': nada que guiar
      const r = ix(drag.r0 + Math.round(-dy / STEP_PX), RATE_ORDER.length);
      const z = ix(drag.z0 + Math.round(dx / STEP_PX), ZONE_ORDER.length);
      if (RATE_ORDER[r] !== o.rate || ZONE_ORDER[z] !== o.zone) deck.setOscTime(g, RATE_ORDER[r], ZONE_ORDER[z]);
      V.hintText = timeLabel(deck.osc[g]);
    });
    const upL = (ev) => { if (drag && ev.pointerId === drag.pid) endDrag(); };
    line.addEventListener('pointerup', upL);
    line.addEventListener('pointercancel', upL);
    line.addEventListener('dblclick', () => deck.resetOscTime(g));
    line.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const o = deck.osc[g];
      if (GESTURES[o.gest].shape === null) return;
      const r = ix(RATE_ORDER.indexOf(o.rate) - Math.sign(ev.deltaY), RATE_ORDER.length);
      deck.setOscTime(g, RATE_ORDER[r], o.zone);
      V.hintText = timeLabel(deck.osc[g]);
      clearTimeout(V.wheelT);
      V.wheelT = setTimeout(() => (V.hintText = null), 700);
    }, { passive: false });
  }
  // silenciar todos los osciladores del universo (se siguen viendo y tocando: preparar por debajo)
  const muteBtn = q('.osc-mute');
  const cxBox = q('.cx-box');
  muteBtn.addEventListener('pointerdown', () => deck.setOscMuted(!deck.oscMuted));
  // pinta un oscilador solo si algo cambió (se llama en cada fotograma)
  const showOsc = (g, step) => {
    const o = deck.osc[g], a = deck.cx[g], V = oscV[g];
    const live = oscActive(o);
    const key = `${o.on}|${a}|${o.b}|${o.gest}|${o.edited}|${live}|${V.hintText}`;
    if (key !== V.seen) {
      V.seen = key;
      const noB = o.b === null;
      V.onBtn.classList.toggle('on', o.on);
      V.osc.classList.toggle('idle', !live);
      V.lane.classList.toggle('idle', !live);
      V.b.style.top = `${(1 - (noB ? a : o.b)) * 100}%`;
      V.range.style.display = live ? '' : 'none';
      if (live) {
        V.range.style.bottom = `${Math.min(a, o.b) * 100}%`;
        V.range.style.height = `${Math.abs(o.b - a) * 100}%`;
      }
      V.word.textContent = gestName(o);
      V.hint.hidden = !V.hintText;
      if (V.hintText) V.hint.textContent = V.hintText;
    }
    // la línea: 32 pulsos (8 compases), alto = cuánto se acerca a B
    const sk = JSON.stringify(o.layers);
    if (sk !== V.shapeSeen) {
      V.shapeSeen = sk;
      V.fills.forEach((f, p) => (f.style.height = `${oscShape(o, p * 4) * 100}%`));
      V.line.title = V.line.title.replace(/^[^\n]*/, `LA FRASE (8 compases) · ${timeLabel(o)}`);
    }
    const pulse = step === null || !live ? -1 : (step >> 2) % 32;
    if (pulse !== V.pulse) {
      if (V.pulse >= 0) V.segs[V.pulse].classList.remove('now');
      if (pulse >= 0) V.segs[pulse].classList.add('now');
      V.pulse = pulse;
    }
  };

  const options = (sel, onPick) => {
    const box = q(sel);
    // pointerdown: responde al instante y funciona con otro dedo ya apoyado
    box.addEventListener('pointerdown', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onPick(b.dataset.v);
    });
  };
  // TRANSICIÓN: compases y FX del CLIC (el CORTE no se ajusta: instantáneo, a la corchea, sin FX)
  const fxBtn = q('.t-fx');
  const showGesture = () => {
    const g = deck.gesture.click;
    q('.t-len').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === g.bars));
    fxBtn.classList.toggle('on', g.fx);
  };
  options('.t-len', (v) => (deck.gesture.click.bars = Number(v)));
  fxBtn.addEventListener('pointerdown', () => {
    deck.gesture.click.fx = !deck.gesture.click.fx;
    showGesture();
  });
  showGesture();
  // VOLUMEN DE FX: el mismo fader que en el MIXER (imán a 0 dB y al preset; doble clic, el preset); la posición vive en
  // el motor, así las dos vistas van juntas
  const di = deck.engine.decks.indexOf(deck);
  const fxDb = q('.t-vol-db');
  let fxSeen = deck.engine.fxPos[di];
  const showFx = (v) => {
    fxSeen = v;
    fxDb.textContent = fmtDb(faderDb(v));
    fxDb.classList.toggle('moved', Math.abs(v - presetPos(deck.engine, 'fx')) > 0.004);
  };
  const fxVol = new VSlider(q('.t-vol .fader'), {
    value: fxSeen,
    onChange: (v) => { setFxFader(deck.engine, di, v); showFx(v); },
    onEnd: (v) => { const s = snapMix(deck.engine, 'fx', v); if (s !== v) { setFxFader(deck.engine, di, s); showFx(s); fxVol.glideTo(s); } },
  });
  // doble clic: lo que dice el preset de mezcla del MIXER
  q('.t-vol .t-track').addEventListener('dblclick', () => {
    const p = presetPos(deck.engine, 'fx');
    fxVol.set(p); setFxFader(deck.engine, di, p); showFx(p);
  });
  showFx(fxSeen);
  // FORMA del viaje: DE GOLPE / PROGRESIVA; y, solo en progresiva, ESCALONADA / SUAVE
  const showForm = () => {
    for (const [sel, v] of [['.t-form', deck.form], ['.t-flow', deck.flow]]) {
      q(sel).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    }
    q('.t-flow').classList.toggle('off', deck.form === 'golpe');
  };
  // cada caja es un interruptor: pulsar en cualquier parte de ella cambia al otro
  q('.t-form').addEventListener('pointerdown', () => { deck.form = deck.form === 'golpe' ? 'prog' : 'golpe'; showForm(); });
  q('.t-flow').addEventListener('pointerdown', () => { deck.flow = deck.flow === 'suave' ? 'escalonado' : 'suave'; showForm(); });
  showForm();
  options('.o-len', (v) => (deck.loopLen = Number(v)));
  options('.o-bars', (v) => (deck.releaseBars = Number(v)));
  options('.o-mode', (v) => {
    deck.releaseMode = v;
    q('.o-bars').classList.toggle('off', v === 'instant');
  });

  const loopBtn = q('.loop-btn');
  const loopTicks = q('.lb-ticks');
  loopBtn.addEventListener('pointerdown', () => deck.toggleLoop());
  const seedBtn = q('.seed');
  seedBtn.addEventListener('pointerdown', () => deck.reseed());

  const cells = {};
  for (const k of INSTRUMENTS) {
    const el = document.createElement('div');
    el.className = 'inst';
    el.innerHTML = `<div class="irow"><span class="dot"></span><span class="name">${LABEL[k]}</span></div><div class="bar"><i></i><b></b></div>`;
    q('.strip').appendChild(el);
    cells[k] = { el, dot: el.querySelector('.dot'), bar: el.querySelector('i'), mark: el.querySelector('b'), flash: 0 };
  }

  // ESCENAS: apoyar = CLIC (ir ahí); seguir apoyado = CORTE (vuelve al soltar).
  // El gesto lo decide el universo (deck.down / deck.up), igual que hará el MIDI.
  // Cada botón sigue a su propio dedo: se pueden mantener varios a la vez.
  const sceneEls = [...root.querySelectorAll('.scene')];
  for (const el of sceneEls) {
    const name = el.dataset.s;
    let pid = null;
    el.addEventListener('pointerdown', (ev) => {
      if (pid !== null) return;
      pid = ev.pointerId;
      try { el.setPointerCapture(pid); } catch {} // algunos navegadores fallan con punteros sintéticos
      el.classList.add('press');
      deck.down(name);
    });
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      pid = null;
      el.classList.remove('press');
      deck.up(name);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault()); // mantener pulsado en el móvil
  }
  // VERSIONES: AHORA (la parte que suena) y LUEGO (el destino; quieto, la próxima parte). Al apoyar
  const nowBtn = q('.ver-now'), nextBtn = q('.ver-next');
  for (const [b, act] of [[nowBtn, () => deck.toggleNow()], [nextBtn, () => deck.toggleNext()]]) {
    b.addEventListener('pointerdown', () => { b.classList.add('press'); act(); });
    for (const e of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(e, () => b.classList.remove('press'));
    b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
  const mark = (b, v) => b.querySelectorAll('b').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) === v));
  let verSeen = '';
  const pStatus = q('.p-status');
  const phTicks = q('.ph-ticks');

  return {
    color: '200,200,205',
    frame(engine) {
      const em = deck.emotion;
      const col = emoColor(em.v, em.a);
      this.color = col;
      root.style.setProperty('--glow', col);
      // VOLUMEN DE FX movido desde el MIXER: el fader lo sigue
      if (engine.fxPos[di] !== fxSeen) { fxVol.set(engine.fxPos[di]); showFx(engine.fxPos[di]); }

      // complejidad: si NUEVO UNIVERSO cambió los valores, los faders los siguen
      if (cxSeen !== deck.cxVersion) {
        cxSeen = deck.cxVersion;
        for (const g of GROUPS) cxF[g].s.set(deck.cx[g]);
      }
      // lo que suena ahora (con su oscilador × global): número y línea fina
      const p = deck.loop ? null : deck.pos();
      const step = p === null ? null : Math.max(0, Math.floor(p));
      for (const g of GROUPS) {
        const v = step === null ? deck.cx[g] : deck.cxNow(g, step);
        const eff = Math.min(1, Math.max(0, v * deck.cx.global));
        const t = String(Math.round(eff * 100));
        if (cxF[g].val.textContent !== t) cxF[g].val.textContent = t;
        cxF[g].eff.style.height = `${eff * 100}%`;
        showOsc(g, step);
      }
      ed.show(step);
      muteBtn.classList.toggle('on', !deck.oscMuted);
      cxBox.classList.toggle('osc-muted', deck.oscMuted);

      const AR = deck.arr;
      const T = AR.travel;
      const L = deck.loop;
      // VERSIONES: AHORA y LUEGO, cada una con la suya encendida. AHORA se apaga cuando no se puede
      // tocar (viaje progresivo en marcha, LOOP); LUEGO se marca si, quieto, ya está elegida otra
      // para la próxima parte
      const canNow = deck.canNow();
      const vk = `${AR.vNow}${AR.vNext}${canNow ? 1 : 0}${AR.travel ? 1 : 0}`;
      if (verSeen !== vk) {
        verSeen = vk;
        mark(nowBtn, AR.vNow);
        mark(nextBtn, AR.vNext);
        nowBtn.classList.toggle('off', !canNow);
        nextBtn.classList.toggle('pre', !AR.travel && AR.vNext !== AR.vNow);
      }
      for (const el of sceneEls) {
        const name = el.dataset.s;
        // cuánto suena ahora esta parte, en cualquiera de sus dos versiones (en un viaje, se
        // encienden las dos a medias)
        const like = Math.max(likeness(AR.cur, name, 0), likeness(AR.cur, name, 1));
        const m = Math.pow(Math.max(0, 1 - 8 * (1 - like)), 1.5).toFixed(2);
        if (el.style.getPropertyValue('--m') !== m) el.style.setProperty('--m', m);
        const dest = !!T && T.name === name;
        el.classList.toggle('dest', dest && !T.paused);
        el.classList.toggle('paused', dest && T.paused);
        el.classList.toggle('home', AR.home === name);
        el.classList.toggle('held', deck.held.includes(name));
        el.classList.toggle('pend', !!L && AR.target === name); // LOOP: entrará al soltar
      }
      let st = '';
      const ti = deck.travelInfo();
      const pv = deck.previewStart(deck.gesture.click.bars);
      if (ti) {
        // el viaje espera al compás que le toca para aterrizar en frase
        const when = ti.paused ? 'PAUSA'
          : ti.wait > 0.02 ? `ENTRA EN ${Math.ceil(ti.wait)}`
          : ti.left < 0.95 ? 'ÚLTIMO COMPÁS' : `${Math.ceil(ti.left)} COMP.`;
        st = `→ ${SCENES[ti.name].label} ${AR.vNext + 1} · ${when}`;
      } else if (engine.ready) {
        // antes de pulsar: cuándo empezaría un viaje de CLIC con los compases elegidos
        st = deck.gesture.click.bars === 0 || pv.wait < 0.02 ? 'ENTRA YA' : `ENTRA EN ${Math.ceil(pv.wait)}`;
      }
      if (pStatus.textContent !== st) pStatus.textContent = st;
      pStatus.classList.toggle('preview', !ti);
      // la frase: un trazo por compás, el que suena encendido
      if (phTicks.childElementCount !== pv.phrase) phTicks.innerHTML = '<i></i>'.repeat(pv.phrase);
      [...phTicks.children].forEach((t, i) => t.classList.toggle('now', i === pv.bar));
      root.querySelector('.p-struct').classList.toggle('traveling', !!T && !T.paused);

      // loop
      const heardBar = Math.floor(Math.max(0, engine.step - 1) / 16);
      const armed = !!L && heardBar < L.startBar;
      loopBtn.classList.toggle('on', !!L);
      loopBtn.classList.toggle('armed', armed && !L.releasing);
      loopBtn.classList.toggle('releasing', !!L && L.releasing);
      root.classList.toggle('looping', !!L);
      const n = L ? L.n : deck.loopLen;
      if (loopTicks.childElementCount !== n) loopTicks.innerHTML = '<i></i>'.repeat(n);
      const cur = L && !armed ? (heardBar - L.startBar) % L.n : -1;
      [...loopTicks.children].forEach((t, i) => t.classList.toggle('now', i === cur));
      seedBtn.classList.toggle('pending', deck.pendingSeed !== null);

      // instrumentos: destellos sincronizados con el audio
      if (engine.ready) {
        const now = engine.ctx.currentTime;
        const keep = [];
        for (const x of deck.events) {
          if (x.t <= now) cells[x.k].flash = Math.max(cells[x.k].flash, x.vel);
          else keep.push(x);
        }
        deck.events = keep;
      }
      for (const k of INSTRUMENTS) {
        const c = cells[k];
        const s = deck.arr.state[k];
        c.bar.style.transform = `scaleX(${s.progress})`;
        c.mark.style.left = `${Math.min(100, s.presence * 100)}%`;
        c.el.classList.toggle('on', s.target);
        c.el.classList.toggle('pend', !!L && s.pending !== s.target);
        c.dot.style.opacity = 0.08 + 0.92 * c.flash;
        c.flash *= 0.86;
      }
    },
  };
}
