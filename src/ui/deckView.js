// Vista de un UNIVERSO: pads, transición, loop, nuevo universo e instrumentos.
// Se instancia dos veces (izquierda y derecha) sobre el mismo Deck API.

import { XYPad } from './xypad.js';
import { VSlider } from './slider.js';
import { INSTRUMENTS, CORNER_WEIGHTS } from '../music/arrangement.js';

const LABEL = { kick: 'KICK', bass: 'BASS', hat: 'HAT', perc: 'PERC', clap: 'CLAP', ohat: 'OPEN' };

const opts = (cls, values, on) =>
  `<div class="opts ${cls}">${values.map((v) => `<button data-v="${v[0]}"${v[0] === on ? ' class="on"' : ''}>${v[1]}</button>`).join('')}</div>`;
const nums = (arr) => arr.map((n) => [String(n), String(n)]);

function template(label) {
  return `
  <div class="deck-head">
    <span class="deck-name">${label}</span>
    <button class="seed">NUEVO UNIVERSO</button>
  </div>
  <div class="rows">
  <div class="row">
    <section class="pad p-struct">
      <div class="pad-title">ESTRUCTURA</div>
      <div class="pad-box"><canvas></canvas>
        <span class="corner tl" data-c="nodeep">NO DEEP</span><span class="corner tr" data-c="todo">TODO</span>
        <span class="corner bl" data-c="nada">NADA</span><span class="corner br" data-c="deep">DEEP</span>
      </div>
    </section>
    <section class="col trans">
      <div class="col-title">TRANSICIÓN</div>
      <div class="t-lab top">FILTRO</div>
      <div class="t-track"><div class="t-line"></div><div class="t-handle"></div></div>
      <div class="t-lab bot">VOLUMEN</div>
      ${opts('t-len', nums([1, 2, 4, 8, 16]), '4')}
      <div class="unit">COMPASES</div>
    </section>
  </div>
  <div class="row">
    <section class="pad p-emo">
      <div class="pad-title">EMOCIÓN</div>
      <div class="pad-box"><canvas></canvas>
        <span class="corner tl" data-c="tension">TENSIÓN</span><span class="corner tr" data-c="euphoria">EUFORIA</span>
        <span class="corner bl" data-c="abyss">ABISMO</span><span class="corner br" data-c="warmth">CALIDEZ</span>
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

// color de la emoción (frío/violeta -> ámbar cálido; poca activación = más gris)
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
  const emoPad = new XYPad(q('.p-emo'), {
    value: { x: (deck.emotion.tv + 1) / 2, y: (deck.emotion.ta + 1) / 2 },
    onChange: (x, y) => deck.emotion.setTarget(x * 2 - 1, y * 2 - 1),
  });
  new VSlider(q('.trans'), { value: deck.transitionMode, onChange: (v) => (deck.transitionMode = v) });

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
  const emoCorners = [...root.querySelectorAll('.p-emo .corner')];

  return {
    color: '200,200,205',
    frame(engine) {
      const em = deck.emotion;
      const col = emoColor(em.v, em.a);
      this.color = col;
      emoPad.follow = { x: (em.v + 1) / 2, y: (em.a + 1) / 2 };
      emoPad.color = col;
      root.style.setProperty('--glow', col);

      const cw = CORNER_WEIGHTS(deck.arr.x, deck.arr.y);
      structCorners.forEach((el) => (el.style.opacity = 0.2 + 0.8 * cw[el.dataset.c]));
      const vx = (em.v + 1) / 2;
      const ay = (em.a + 1) / 2;
      const ew = { abyss: (1 - vx) * (1 - ay), warmth: vx * (1 - ay), tension: (1 - vx) * ay, euphoria: vx * ay };
      emoCorners.forEach((el) => (el.style.opacity = 0.2 + 0.8 * ew[el.dataset.c]));

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
      emoPad.ghost = L ? { x: (L.frozen.v + 1) / 2, y: (L.frozen.a + 1) / 2 } : null;
      seedBtn.classList.toggle('pending', deck.pendingSeed !== null);

      structPad.draw();
      emoPad.draw();

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
