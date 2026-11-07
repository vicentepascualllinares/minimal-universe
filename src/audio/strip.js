// CANAL DE MEZCLA — EQ de 3 bandas (con corte casi total), filtro DJ y fader.
// Todos los valores de control van de 0 a 1; 0.5 = neutro en EQ y filtro.

import { glide } from './dsp.js';

// EQ: centro 0 dB, derecha hasta +6 dB, izquierda hasta -40 dB (casi kill)
export const eqDb = (v) => (v >= 0.5 ? ((v - 0.5) / 0.5) * 6 : -40 * Math.pow((0.5 - v) / 0.5, 1.5));

// fader con curva suave (la mitad del recorrido ≈ -11 dB)
export const faderGain = (v) => (v <= 0 ? 0 : Math.pow(v, 1.8));

const DEAD = 0.04; // zona muerta del filtro alrededor del centro

export class Strip {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.lo = ctx.createBiquadFilter();
    this.lo.type = 'lowshelf'; this.lo.frequency.value = 220;
    this.mid = ctx.createBiquadFilter();
    this.mid.type = 'peaking'; this.mid.frequency.value = 1100; this.mid.Q.value = 0.7;
    this.hi = ctx.createBiquadFilter();
    this.hi.type = 'highshelf'; this.hi.frequency.value = 3800;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass'; this.lp.frequency.value = 20000;
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass'; this.hp.frequency.value = 20;
    this.fader = ctx.createGain();
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 512;
    this.buf = new Float32Array(this.meter.fftSize);
    this.input.connect(this.lo).connect(this.mid).connect(this.hi).connect(this.lp).connect(this.hp)
      .connect(this.fader).connect(dest);
    this.fader.connect(this.meter);
  }

  set(key, v) {
    const t = this.ctx.currentTime;
    if (key === 'lo' || key === 'mid' || key === 'hi') {
      glide(this[key].gain, eqDb(v), t, 0.02);
    } else if (key === 'fader') {
      glide(this.fader.gain, faderGain(v), t, 0.015);
    } else if (key === 'filter') {
      const d = (v - 0.5) * 2;
      const amt = Math.max(0, (Math.abs(d) - DEAD) / (1 - DEAD));
      const q = 0.707 + 2.2 * amt;
      if (d < 0 && amt > 0) {            // izquierda: low pass
        glide(this.lp.frequency, 20000 * Math.pow(70 / 20000, amt), t, 0.03);
        glide(this.lp.Q, q, t, 0.03);
        glide(this.hp.frequency, 20, t, 0.03);
        glide(this.hp.Q, 0.707, t, 0.03);
      } else if (d > 0 && amt > 0) {     // derecha: high pass
        glide(this.hp.frequency, 20 * Math.pow(9000 / 20, amt), t, 0.03);
        glide(this.hp.Q, q, t, 0.03);
        glide(this.lp.frequency, 20000, t, 0.03);
        glide(this.lp.Q, 0.707, t, 0.03);
      } else {                           // centro: filtro abierto
        glide(this.lp.frequency, 20000, t, 0.03);
        glide(this.hp.frequency, 20, t, 0.03);
        glide(this.lp.Q, 0.707, t, 0.03);
        glide(this.hp.Q, 0.707, t, 0.03);
      }
    }
  }

  level() {
    this.meter.getFloatTimeDomainData(this.buf);
    let p = 0;
    for (let i = 0; i < this.buf.length; i++) p = Math.max(p, Math.abs(this.buf[i]));
    return p;
  }
}
