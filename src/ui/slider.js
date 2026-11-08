// Control vertical (transición y faders). value 0..1 (1 = arriba).
// Multitáctil: cada slider sigue solo al dedo que lo tocó.

export class VSlider {
  constructor(el, { value, onChange }) {
    this.el = el;
    this.track = el.querySelector('.t-track');
    this.handle = el.querySelector('.t-handle');
    this.value = value;
    this.onChange = onChange;
    this.pid = null;
    const pos = (ev) => {
      const r = this.track.getBoundingClientRect();
      const v = Math.min(1, Math.max(0, 1 - (ev.clientY - r.top) / r.height));
      this.set(v);
      this.onChange?.(this.value);
    };
    this.track.addEventListener('pointerdown', (ev) => {
      if (this.pid !== null) return;
      this.pid = ev.pointerId;
      try { this.track.setPointerCapture(ev.pointerId); } catch {} // algunos navegadores fallan con punteros sintéticos
      el.classList.add('active');
      pos(ev);
    });
    this.track.addEventListener('pointermove', (ev) => ev.pointerId === this.pid && pos(ev));
    const up = (ev) => {
      if (ev.pointerId !== this.pid) return;
      this.pid = null;
      el.classList.remove('active');
    };
    this.track.addEventListener('pointerup', up);
    this.track.addEventListener('pointercancel', up);
    this.set(value);
  }
  set(v) {
    this.value = v;
    this.handle.style.top = `${(1 - v) * 100}%`;
    this.el.style.setProperty('--v', v);
  }
}

// Control horizontal (complejidad). value 0..1 (1 = derecha). Mismo multitáctil.
// Rueda: pasos finos. Doble clic: vuelve al valor por defecto.
export class HSlider {
  constructor(el, { value, onChange, reset = value }) {
    this.el = el;
    this.track = el.querySelector('.h-track');
    this.handle = el.querySelector('.h-handle');
    this.onChange = onChange;
    this.pid = null;
    const emit = (v) => { this.set(v); this.onChange?.(this.value); };
    const pos = (ev) => {
      const r = this.track.getBoundingClientRect();
      emit(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)));
    };
    this.track.addEventListener('pointerdown', (ev) => {
      if (this.pid !== null) return;
      this.pid = ev.pointerId;
      try { this.track.setPointerCapture(ev.pointerId); } catch {} // algunos navegadores fallan con punteros sintéticos
      el.classList.add('active');
      pos(ev);
    });
    this.track.addEventListener('pointermove', (ev) => ev.pointerId === this.pid && pos(ev));
    const up = (ev) => {
      if (ev.pointerId !== this.pid) return;
      this.pid = null;
      el.classList.remove('active');
    };
    this.track.addEventListener('pointerup', up);
    this.track.addEventListener('pointercancel', up);
    this.track.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      emit(Math.min(1, Math.max(0, this.value - Math.sign(ev.deltaY) * 0.04)));
    }, { passive: false });
    this.track.addEventListener('dblclick', () => emit(reset));
    this.set(value);
  }
  set(v) {
    this.value = v;
    this.handle.style.left = `${v * 100}%`;
    this.el.style.setProperty('--v', v);
  }
}
