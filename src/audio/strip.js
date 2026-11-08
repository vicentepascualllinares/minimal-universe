// CANAL DE MEZCLA (modo DJ) — EQ de 3 bandas, filtro DJ y fader.
// Todos los valores de control van de 0 a 1; 0.5 = neutro en EQ y filtro.
//
// EQ como en rekordbox (Preferencias → Mixer → EQ Type), dos tipos:
//   'iso' ISOLATOR: a la izquierda del todo la banda desaparece (−∞ … +6 dB)
//   'eq'  EQ:       atenúa hasta −26 dB (−26 … +6 dB), como un DJM en modo EQ
// Las tres bandas salen de un crossover Linkwitz-Riley de 4.º orden: con los
// tres knobs en el centro suma plano, y cada banda se puede quitar entera.

import { glide, fixChannels } from './dsp.js';

export const EQ_TYPES = {
  iso: { label: 'ISOLATOR', floor: -Infinity, desc: 'a la izquierda del todo, la banda se silencia (−∞ … +6 dB)' },
  eq: { label: 'EQ', floor: -26, desc: 'atenúa sin llegar a silenciar (−26 … +6 dB)' },
};

const LOW_X = 250;   // Hz: LOW | MID
const HIGH_X = 3500; // Hz: MID | HIGH
const MAX_DB = 6;

// ganancia lineal de una banda para la posición v del knob (0..1, centro = 0 dB)
export function bandGain(v, type) {
  if (v >= 0.5) return Math.pow(10, (((v - 0.5) / 0.5) * MAX_DB) / 20);
  const x = (0.5 - v) / 0.5; // 0 en el centro .. 1 a la izquierda del todo
  if (type === 'iso') return Math.pow(1 - x, 2); // cae suave y llega a silencio (−∞)
  return Math.pow(10, (EQ_TYPES.eq.floor * x) / 20); // lineal en dB hasta −26
}

// EASY EQ: una perilla por banda que cruza de A (x = 0) a B (x = 1); en el centro, los dos.
// Como el "Frequency Mix" del Pioneer DJM-2000. Las tres bandas, sin hueco: en el centro los
// dos enteros; cada lado solo baja el otro (a 3/4 del recorrido, el que se va está a −3 dB).
// En LOW, además, nunca suenan dos kicks ni dos bajos a la vez: eso lo reparte lowRoles.js
// (por instrumento, no por frecuencia).
export function easyGains(band, x) {
  const q = Math.PI / 2;
  return [x <= 0.5 ? 1 : Math.cos(((x - 0.5) / 0.5) * q), x >= 0.5 ? 1 : Math.cos(((0.5 - x) / 0.5) * q)];
}

// fader con curva suave (la mitad del recorrido ≈ -11 dB)
export const faderGain = (v) => (v <= 0 ? 0 : Math.pow(v, 1.8));

const DEAD = 0.04; // zona muerta del filtro alrededor del centro

export class Strip {
  constructor(ctx, dest, eqType = 'iso') {
    this.ctx = ctx;
    this.eqType = eqType;
    this.eqVal = { lo: 0.5, mid: 0.5, hi: 0.5 };
    // canales fijos: el universo es estéreo y las voces de transición mono (ver fixChannels)
    this.input = fixChannels(ctx.createGain(), 2);
    // Butterworth (Q = 1/√2). Ojo: en Web Audio la Q de lowpass/highpass va en dB
    // (−3,01 dB = 1/√2); en allpass es lineal.
    const bq = (type, f) => {
      const n = ctx.createBiquadFilter();
      n.type = type; n.frequency.value = f;
      n.Q.value = type === 'allpass' ? Math.SQRT1_2 : -3.0103;
      return n;
    };
    const chain = (src, ...nodes) => nodes.reduce((a, n) => a.connect(n), src);

    // crossover LR4: low = LP·LP (+ allpass para alinear fase con el resto),
    // mid = HP·HP·LP·LP, high = HP·HP·HP·HP
    this.lo = ctx.createGain();
    this.mid = ctx.createGain();
    this.hi = ctx.createGain();
    const bands = ctx.createGain();
    chain(this.input, bq('lowpass', LOW_X), bq('lowpass', LOW_X), bq('allpass', HIGH_X), this.lo).connect(bands);
    const rest = chain(this.input, bq('highpass', LOW_X), bq('highpass', LOW_X));
    chain(rest, bq('lowpass', HIGH_X), bq('lowpass', HIGH_X), this.mid).connect(bands);
    chain(rest, bq('highpass', HIGH_X), bq('highpass', HIGH_X), this.hi).connect(bands);

    this.lp = bq('lowpass', 20000);
    this.hp = bq('highpass', 20);
    this.fader = ctx.createGain();
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 512;
    this.buf = new Float32Array(this.meter.fftSize);
    bands.connect(this.lp).connect(this.hp).connect(this.fader).connect(dest);
    this.fader.connect(this.meter);
  }

  // EASY EQ: la ganancia de una banda la pone la mesa (ver easyGains), no el knob del canal
  setBandGain(key, g) { glide(this[key].gain, g, this.ctx.currentTime, 0.02); }

  setEqType(type) {
    this.eqType = type;
    for (const k of ['lo', 'mid', 'hi']) this.set(k, this.eqVal[k]);
  }

  set(key, v) {
    const t = this.ctx.currentTime;
    if (key === 'lo' || key === 'mid' || key === 'hi') {
      this.eqVal[key] = v;
      glide(this[key].gain, bandGain(v, this.eqType), t, 0.02);
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
