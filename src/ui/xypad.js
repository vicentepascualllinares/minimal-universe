import { PROFILE } from '../core/profile.js';

// Pad XY en canvas. value = {x, y} en 0..1 (y = 1 arriba).
// `follow` = punto real (con inercia) que persigue al objetivo.

export class XYPad {
  constructor(el, { value, onChange }) {
    this.el = el;
    this.canvas = el.querySelector('canvas');
    this.g = this.canvas.getContext('2d');
    this.value = { ...value };
    this.follow = null;
    this.ghost = null;
    this.trail = [];
    this.color = '220,220,225';
    this.onChange = onChange;
    this.pid = null; // multitáctil: cada control sigue solo a su dedo

    const pos = (ev) => {
      const r = this.canvas.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, 1 - (ev.clientY - r.top) / r.height));
      this.value = { x, y };
      this.onChange?.(x, y);
    };
    this.canvas.addEventListener('pointerdown', (ev) => {
      if (this.pid !== null) return;
      this.pid = ev.pointerId;
      try { this.canvas.setPointerCapture(ev.pointerId); } catch {} // algunos navegadores fallan con punteros sintéticos
      this.el.classList.add('active');
      pos(ev);
    });
    this.canvas.addEventListener('pointermove', (ev) => ev.pointerId === this.pid && pos(ev));
    const up = (ev) => {
      if (ev.pointerId !== this.pid) return;
      this.pid = null;
      this.el.classList.remove('active');
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);

    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, PROFILE.maxDpr); // móvil: menos píxeles que pintar
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw() {
    const { g, w, h } = this;
    if (!w) return;
    g.clearRect(0, 0, w, h);

    // rejilla mínima
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 1; i < 8; i++) {
      for (let j = 1; j < 8; j++) g.fillRect((i / 8) * w - 0.5, (j / 8) * h - 0.5, 1, 1);
    }
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w / 2, h);
    g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.stroke();

    const tx = this.value.x * w;
    const ty = (1 - this.value.y) * h;

    // cruz del objetivo
    g.strokeStyle = `rgba(${this.color},0.09)`;
    g.beginPath();
    g.moveTo(tx, 0); g.lineTo(tx, h);
    g.moveTo(0, ty); g.lineTo(w, ty);
    g.stroke();

    // estela del punto real
    const f = this.follow || this.value;
    const fx = f.x * w;
    const fy = (1 - f.y) * h;
    this.trail.push([f.x, f.y]); // normalizado: sobrevive a cambios de tamaño
    if (this.trail.length > 90) this.trail.shift();
    if (this.trail.length > 2) {
      g.beginPath();
      this.trail.forEach(([x, y], i) => (i ? g.lineTo(x * w, (1 - y) * h) : g.moveTo(x * w, (1 - y) * h)));
      g.strokeStyle = `rgba(${this.color},0.18)`;
      g.stroke();
    }

    // fantasma: lo que está sonando (loop) vs. lo que llegará al soltar
    if (this.ghost) {
      const gx = this.ghost.x * w;
      const gy = (1 - this.ghost.y) * h;
      g.setLineDash([3, 4]);
      g.strokeStyle = `rgba(${this.color},0.45)`;
      g.beginPath();
      g.moveTo(gx, gy); g.lineTo(tx, ty);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = `rgba(${this.color},0.8)`;
      g.strokeRect(gx - 4.5, gy - 4.5, 9, 9);
    }

    // halo
    const R = Math.min(w, h) * 0.22;
    const grd = g.createRadialGradient(fx, fy, 0, fx, fy, R);
    grd.addColorStop(0, `rgba(${this.color},0.16)`);
    grd.addColorStop(1, `rgba(${this.color},0)`);
    g.fillStyle = grd;
    g.fillRect(fx - R, fy - R, R * 2, R * 2);

    // anillo objetivo + punto real
    g.strokeStyle = `rgba(${this.color},${this.pid !== null ? 0.75 : 0.4})`;
    g.beginPath();
    g.arc(tx, ty, 10, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = `rgba(${this.color},0.95)`;
    g.beginPath();
    g.arc(fx, fy, 3.2, 0, Math.PI * 2);
    g.fill();
  }
}
