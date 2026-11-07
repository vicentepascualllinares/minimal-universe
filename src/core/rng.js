// Aleatoriedad con semilla: el mismo "universo" suena igual con la misma semilla.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(items, weights) {
    let sum = 0;
    for (const w of weights) sum += w;
    let r = this.next() * sum;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  fork() { return new Rng(Math.floor(this.next() * 4294967296)); }
}

// Ritmo euclídeo: k golpes repartidos lo más uniformemente posible en n pasos.
export function euclid(k, n, rot = 0) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = ((i * k) % n) < k ? 1 : 0;
  const r = ((rot % n) + n) % n;
  return out.slice(n - r).concat(out.slice(0, n - r));
}

// Deriva lenta y orgánica (suma de senos de periodos largos). Rango aprox. [-1, 1].
export function makeDrift(rng, speed = 1) {
  const ph = [rng.float(0, 6.283), rng.float(0, 6.283), rng.float(0, 6.283)];
  const fr = [rng.float(0.009, 0.019), rng.float(0.027, 0.051), rng.float(0.07, 0.12)].map((f) => f * speed);
  return (t) =>
    Math.sin(t * fr[0] * 6.283 + ph[0]) * 0.5 +
    Math.sin(t * fr[1] * 6.283 + ph[1]) * 0.33 +
    Math.sin(t * fr[2] * 6.283 + ph[2]) * 0.17;
}

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
