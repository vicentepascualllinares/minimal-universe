// Knob: arrastrar en vertical (Shift = fino), rueda, doble clic = volver al centro.
// value 0..1. Bipolar: el arco se dibuja desde el centro (EQ y filtro).

const R = 14;
const C = 20;
const pt = (deg, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};
const arc = (a1, a2) => {
  if (Math.abs(a2 - a1) < 0.5) return '';
  const [x1, y1] = pt(a1);
  const [x2, y2] = pt(a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${large} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};
const ang = (v) => -135 + 270 * v;

export class Knob {
  constructor(el, { value = 0.5, def = 0.5, bipolar = true, onChange }) {
    this.el = el;
    this.def = def;
    this.bipolar = bipolar;
    this.onChange = onChange;
    el.classList.add('knob');
    el.innerHTML =
      `<svg viewBox="0 0 40 40"><path class="k-track" d="${arc(-135, 135)}"/>` +
      `<path class="k-val"/><line class="k-ptr"/></svg>`;
    this.val = el.querySelector('.k-val');
    this.ptr = el.querySelector('.k-ptr');

    // multitáctil: el knob sigue solo al dedo que lo tocó
    let pid = null;
    let y = 0;
    let lastDown = 0;
    el.addEventListener('pointerdown', (ev) => {
      if (pid !== null) return;
      // doble toque / doble clic = volver al centro (dblclick no es fiable en móvil)
      const t = performance.now();
      if (t - lastDown < 300) this.change(this.def);
      lastDown = t;
      pid = ev.pointerId;
      y = ev.clientY;
      el.setPointerCapture(pid);
      el.classList.add('active');
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      const k = e.shiftKey ? 0.0012 : e.pointerType === 'touch' ? 0.007 : 0.0055;
      this.change(this.value + (y - e.clientY) * k);
      y = e.clientY;
    });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      el.classList.remove('active');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.change(this.value - Math.sign(ev.deltaY) * 0.02);
    }, { passive: false });
    this.set(value);
  }

  change(v) {
    // imán suave al centro: es fácil dejarlo neutro
    v = Math.min(1, Math.max(0, v));
    if (this.bipolar && Math.abs(v - 0.5) < 0.012) v = 0.5;
    this.set(v);
    this.onChange?.(v);
  }

  set(v) {
    this.value = v;
    const a = ang(v);
    const from = this.bipolar ? 0 : -135;
    this.val.setAttribute('d', a >= from ? arc(from, a) : arc(a, from));
    const [x1, y1] = pt(a, 5);
    const [x2, y2] = pt(a, 11);
    this.ptr.setAttribute('x1', x1); this.ptr.setAttribute('y1', y1);
    this.ptr.setAttribute('x2', x2); this.ptr.setAttribute('y2', y2);
    this.el.classList.toggle('off-center', this.bipolar && v !== 0.5);
  }
}
