// Vista de un UNIVERSO: estructura, transición, complejidad, loop, nuevo universo e instrumentos.
// Se instancia dos veces (izquierda y derecha) sobre el mismo Deck API.

import { XYPad } from './xypad.js';
import { VSlider, HSlider } from './slider.js';
import { INSTRUMENTS, CORNER_WEIGHTS, CORNERS } from '../music/arrangement.js';
import { GROUPS, GROUP_LABEL, shapeComplexity } from '../music/complexity.js';

const LABEL = { kick: 'KICK', bass: 'BASS', hat: 'HAT', perc: 'PERC', clap: 'CLAP', ohat: 'OPEN', chord: 'CHORD', pad: 'PAD' };

const opts = (cls, values, on) =>
  `<div class="opts ${cls}">${values.map((v) => `<button data-v="${v[0]}"${v[0] === on ? ' class="on"' : ''}>${v[1]}</button>`).join('')}</div>`;
const nums = (arr) => arr.map((n) => [String(n), String(n)]);

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
      <div class="pad-box"><canvas></canvas>
        <button class="corner go tl" data-c="sindrums" title="ir aquí (otra vez: pausa)">SIN DRUMS</button><button class="corner go tr" data-c="todo" title="ir aquí (otra vez: pausa)">TODO</button>
        <button class="corner go bl" data-c="break" title="ir aquí (otra vez: pausa)">BREAK</button><button class="corner go br" data-c="drums" title="ir aquí (otra vez: pausa)">SOLO DRUMS</button>
      </div>
    </section>
    <section class="col trans">
      <div class="col-title">TRANSICIÓN</div>
      <div class="t-lab top">FILTRO</div>
      <div class="t-track"><div class="t-line"></div><div class="t-handle"></div></div>
      <div class="t-lab bot">VOLUMEN</div>
      ${opts('t-len', [['0', 'YA'], ...nums([1, 2, 4, 8, 16, 32])], '4')}
      <div class="unit">A ESQUINA</div>
    </section>
  </div>
  <div class="row">
    <section class="pad p-cx">
      <div class="pad-title">COMPLEJIDAD</div>
      <div class="pad-box cx-box">${GROUPS.map((g) => `
        <div class="cxf" data-g="${g}">
          <span class="cxf-val"></span>
          <div class="fader"><div class="t-track"><div class="t-line"></div><i class="cxf-eff"></i><div class="t-handle"></div></div></div>
          <span class="cxf-name">${GROUP_LABEL[g]}</span>
        </div>`).join('')}
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

  const structPad = new XYPad(q('.p-struct'), {
    value: { x: deck.arr.x, y: deck.arr.y },
    onChange: (x, y) => deck.arr.set(x, y),
  });
  new VSlider(q('.trans'), { value: deck.transitionMode, onChange: (v) => (deck.transitionMode = v) });
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
  options('.t-len', (v) => (deck.transitionBars = Number(v)));
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
  const structCorners = [...root.querySelectorAll('.p-struct .corner')];
  // pulsar una esquina: viajar ahí en los compases elegidos (otra vez = pausa / sigue)
  for (const el of structCorners) {
    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      deck.goCorner(el.dataset.c);
    });
  }
  const pStatus = q('.p-status');
  const phTicks = q('.ph-ticks');

  return {
    color: '200,200,205',
    frame(engine) {
      const em = deck.emotion;
      const col = emoColor(em.v, em.a);
      this.color = col;
      root.style.setProperty('--glow', col);

      // complejidad: si NUEVO UNIVERSO cambió los valores, los faders los siguen
      if (cxSeen !== deck.cxVersion) {
        cxSeen = deck.cxVersion;
        for (const g of GROUPS) cxF[g].s.set(deck.cx[g]);
      }
      const eff = shapeComplexity(deck.cx).eff;
      for (const g of GROUPS) {
        const t = String(Math.round(eff[g] * 100));
        if (cxF[g].val.textContent !== t) cxF[g].val.textContent = t;
        cxF[g].eff.style.height = `${eff[g] * 100}%`;
      }

      const AR = deck.arr;
      const T = AR.travel;
      const cw = CORNER_WEIGHTS(AR.x, AR.y);
      structCorners.forEach((el) => {
        el.style.opacity = 0.3 + 0.7 * cw[el.dataset.c];
        const dest = !!T && T.name === el.dataset.c;
        el.classList.toggle('dest', dest && !T.paused);
        el.classList.toggle('paused', dest && T.paused);
      });
      structPad.value = { x: AR.tx, y: AR.ty };
      structPad.follow = AR.shown();
      let st = '';
      const ti = deck.travelInfo();
      const pv = deck.previewStart(deck.transitionBars);
      if (ti) {
        // el viaje espera al compás que le toca para aterrizar en frase
        const when = ti.paused ? 'PAUSA'
          : ti.wait > 0.02 ? `ENTRA EN ${Math.ceil(ti.wait)}`
          : ti.left < 0.95 ? 'ÚLTIMO COMPÁS' : `${Math.ceil(ti.left)} COMP.`;
        st = `→ ${CORNERS[ti.name].label} · ${when}`;
      } else if (engine.ready) {
        // antes de pulsar: cuándo empezaría un viaje con los compases elegidos
        st = deck.transitionBars === 0 || pv.wait < 0.02 ? 'ENTRA YA' : `ENTRA EN ${Math.ceil(pv.wait)}`;
      }
      if (pStatus.textContent !== st) pStatus.textContent = st;
      pStatus.classList.toggle('preview', !ti);
      // la frase: un trazo por compás, el que suena encendido
      if (phTicks.childElementCount !== pv.phrase) phTicks.innerHTML = '<i></i>'.repeat(pv.phrase);
      [...phTicks.children].forEach((t, i) => t.classList.toggle('now', i === pv.bar));
      root.querySelector('.p-struct').classList.toggle('traveling', !!T && !T.paused);

      // loop
      const L = deck.loop;
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
      structPad.ghost = L ? { x: L.frozen.x, y: L.frozen.y } : null;
      seedBtn.classList.toggle('pending', deck.pendingSeed !== null);

      structPad.draw();

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
