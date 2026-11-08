// VOCES — todo sintetizado en tiempo real, cero samples.
// Cada función programa un golpe en el tiempo exacto `t` del AudioContext.

const METAL = [1, 1.4826, 1.8003, 2.5461, 2.6303, 3.8968]; // proporciones tipo 808

export function makeNoise(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseSrc(ctx, noise) {
  const n = ctx.createBufferSource();
  n.buffer = noise;
  return n;
}

const off = (noise) => Math.random() * (noise.duration - 0.8);

// ───────────────────────── KICK
export function kick(ctx, out, t, vel, p, root, noise) {
  const f1 = root * p.pitchRatio;
  const f0 = f1 * p.punch;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + p.pitchDecay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.0015);
  g.gain.setValueAtTime(vel, t + 0.0015 + p.hold);
  g.gain.setTargetAtTime(0, t + 0.0015 + p.hold, p.decay / 4);
  osc.connect(g).connect(out);
  const end = t + p.hold + p.decay * 1.6 + 0.05;
  osc.start(t);
  osc.stop(end);

  if (p.click > 0.02) {
    const n = noiseSrc(ctx, noise);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = p.clickFreq;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(vel * p.click, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
    n.connect(hp).connect(cg).connect(out);
    n.start(t, off(noise));
    n.stop(t + 0.02);
  }
}

// ───────────────────────── CLAP
export function clap(ctx, out, t, vel, p, noise) {
  const n = noiseSrc(ctx, noise);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = p.freq;
  bp.Q.value = p.q;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 380;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  const s = p.spread;
  for (let i = 0; i < 3; i++) {
    const ti = t + i * s;
    g.gain.setValueAtTime(vel * (0.95 - i * 0.12), ti);
    g.gain.exponentialRampToValueAtTime(vel * 0.12, ti + s * 0.92);
  }
  const tt = t + 3 * s;
  g.gain.setValueAtTime(vel * 0.8, tt);
  g.gain.setTargetAtTime(0, tt, p.decay / 4);
  n.connect(bp).connect(hp).connect(g).connect(out);
  n.start(t, off(noise));
  n.stop(tt + p.decay * 1.7 + 0.02);
}

// ───────────────────────── HATS (cerrado y abierto comparten motor)
export function hat(ctx, out, t, vel, p, decay, noise) {
  const metal = ctx.createGain();
  metal.gain.value = (1 - p.noiseMix) * 0.16;
  const oscs = METAL.map((r) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = p.base * r;
    o.connect(metal);
    return o;
  });
  const n = noiseSrc(ctx, noise);
  const ng = ctx.createGain();
  ng.gain.value = p.noiseMix * 0.9;
  n.connect(ng);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = p.bp;
  bp.Q.value = 0.7;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = p.hp;
  metal.connect(bp);
  ng.connect(bp);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.0008);
  g.gain.setTargetAtTime(0, t + 0.0008, decay / 3.5);
  bp.connect(hp).connect(g).connect(out);

  const end = t + decay * 2.6 + 0.02;
  for (const o of oscs) { o.start(t); o.stop(end); }
  n.start(t, off(noise));
  n.stop(end);
  return { gain: g.gain, end };
}

// ───────────────────────── HATS (perfil móvil): sampler
// Graba en segundo plano el MISMO hat del PC (`hat()`, 9 nodos) en 3 variantes
// de ruido y cada golpe solo reproduce la grabación (2 nodos). Suena idéntico.
// Si la emoción cambia el timbre, vuelve a grabar; mientras, usa la anterior.
const VARIANTS = 3;

function renderHat(sr, noise, p, decay) {
  const len = Math.ceil((decay * 2.6 + 0.03) * sr);
  const oc = new OfflineAudioContext(1, len, sr);
  hat(oc, oc.destination, 0, 1, p, decay, noise);
  return oc.startRendering();
}

const hatKey = (p, decay) =>
  [Math.round(Math.log2(p.base) * 48), Math.round(p.noiseMix * 20), Math.round(p.bp / 250),
   Math.round(p.hp / 250), Math.round(decay * 250)].join('|');

export class HatSampler {
  constructor(ctx, noise) {
    this.ctx = ctx;
    this.noise = noise;
    this.sets = {};   // tipo -> { key, bufs }
    this.want = {};
    this.busy = {};
  }

  // pedir el timbre actual (barato si no ha cambiado)
  update(kind, p, decay) {
    const key = hatKey(p, decay);
    if (this.sets[kind]?.key === key || this.want[kind]?.key === key) return;
    this.want[kind] = { key, p: { ...p }, decay };
    if (!this.busy[kind]) this.render(kind);
  }

  async render(kind) {
    this.busy[kind] = true;
    try {
      while (this.want[kind]) {
        const w = this.want[kind];
        this.want[kind] = null;
        const sr = this.ctx.sampleRate;
        const bufs = await Promise.all(Array.from({ length: VARIANTS }, () => renderHat(sr, this.noise, w.p, w.decay)));
        this.sets[kind] = { key: w.key, bufs };
      }
    } finally {
      this.busy[kind] = false;
    }
  }

  play(kind, out, t, vel) {
    const set = this.sets[kind];
    if (!set) return null; // aún grabando el primero (solo pasa al arrancar)
    const src = this.ctx.createBufferSource();
    src.buffer = set.bufs[(Math.random() * set.bufs.length) | 0];
    const g = this.ctx.createGain();
    g.gain.value = vel;
    src.connect(g).connect(out);
    src.start(t);
    return { gain: g.gain, end: t + src.buffer.duration };
  }
}

// ───────────────────────── PERCUSIÓN GENERATIVA
// s = sonido ya resuelto con la emoción: {type, freq, ratio, index, decay, q, pan}
// `panNode` (perfil móvil): panorama fijo del carril, en vez de uno nuevo por golpe
export function perc(ctx, out, t, vel, s, noise, panNode = null) {
  let pan = panNode;
  if (!pan) {
    pan = ctx.createStereoPanner();
    pan.pan.value = s.pan;
    pan.connect(out);
  }
  const g = ctx.createGain();
  g.connect(pan);
  const d = s.decay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.001);
  g.gain.setTargetAtTime(0, t + 0.001, d / 4);
  const end = t + d * 1.8 + 0.03;

  if (s.type === 'tone') {
    const o = ctx.createOscillator();
    o.type = s.wave;
    o.frequency.setValueAtTime(s.freq * (1 + s.bend), t);
    o.frequency.exponentialRampToValueAtTime(s.freq, t + 0.018 + d * 0.15);
    o.connect(g);
    o.start(t);
    o.stop(end);
  } else if (s.type === 'fm') {
    const c = ctx.createOscillator();
    const m = ctx.createOscillator();
    c.frequency.value = s.freq;
    m.frequency.value = s.freq * s.ratio;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(s.freq * s.index, t);
    mg.gain.setTargetAtTime(0, t, d / 5);
    m.connect(mg).connect(c.frequency);
    c.connect(g);
    c.start(t); m.start(t);
    c.stop(end); m.stop(end);
  } else {
    const n = noiseSrc(ctx, noise);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = s.freq;
    bp.Q.value = s.q;
    const mk = ctx.createGain();
    mk.gain.value = 1 + s.q * 0.35; // compensa el filtro estrecho
    n.connect(bp).connect(mk).connect(g);
    n.start(t, off(noise));
    n.stop(end);
  }
}

// ───────────────────────── BASS
// `lite` (perfil móvil): no crea el oscilador cuadrado si casi no se oye
export function bass(ctx, out, t, vel, freq, dur, p, lite = false) {
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = freq;
  saw.detune.value = p.detune;
  const useSq = !lite || p.square > 0.04;
  const sq = useSq ? ctx.createOscillator() : null;
  if (sq) {
    sq.type = 'square';
    sq.frequency.value = freq;
    sq.detune.value = -p.detune * 0.5;
  }
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = freq;

  const gs = ctx.createGain(); gs.gain.value = p.saw * 0.5;
  const gq = sq ? ctx.createGain() : null;
  if (gq) gq.gain.value = p.square * 0.35;
  const gb = ctx.createGain(); gb.gain.value = p.sub;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = p.res;
  const peak = Math.min(16000, p.cutoff * (1 + p.env * vel));
  lp.frequency.setValueAtTime(peak, t);
  lp.frequency.setTargetAtTime(p.cutoff, t, p.filtDecay / 3);

  saw.connect(gs).connect(lp);
  if (sq) sq.connect(gq).connect(lp);
  const g = ctx.createGain();
  sub.connect(gb).connect(g);
  lp.connect(g);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.setTargetAtTime(vel * 0.75, t + 0.004, 0.05);
  g.gain.setTargetAtTime(0, t + dur, p.release / 3.5);
  g.connect(out);

  const end = t + dur + p.release * 2 + 0.05;
  for (const o of [saw, sq, sub]) if (o) { o.start(t); o.stop(end); }
}

// ───────────────────────── ACORDES DUB (stab)
// `freqs` = las notas del acorde ya resueltas. Dos osciladores desafinados por
// nota (uno en móvil) -> un solo filtro con envolvente: el stab clásico.
export function chord(ctx, out, t, vel, freqs, dur, p, lite = false) {
  const mix = ctx.createGain();
  mix.gain.value = 0.42 / Math.sqrt(freqs.length);
  const oscs = [];
  for (const f of freqs) {
    for (let j = 0; j < (lite ? 1 : 2); j++) {
      const o = ctx.createOscillator();
      o.type = j === 0 ? 'sawtooth' : p.wave2;
      o.frequency.value = f;
      o.detune.value = (j === 0 ? 1 : -1) * p.detune * (lite ? 0 : 1);
      o.connect(mix);
      oscs.push(o);
    }
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = p.res;
  lp.frequency.setValueAtTime(Math.min(14000, p.cutoff * (1 + p.env * vel)), t);
  lp.frequency.setTargetAtTime(p.cutoff, t, p.filtDecay / 3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.003);
  g.gain.setTargetAtTime(vel * p.sustain, t + 0.003, p.decay / 3);
  g.gain.setTargetAtTime(0, t + dur, p.release / 3.5);
  mix.connect(lp).connect(g).connect(out);
  const end = t + dur + p.release * 2 + 0.05;
  for (const o of oscs) { o.start(t); o.stop(end); }
}

// ───────────────────────── PAD / ATMÓSFERA
// Una voz larga (varios compases) con ataque lento, filtro que respira (LFO) y
// un poco de "aire" (ruido filtrado). Devuelve sus controles para que el Deck
// la siga moviendo con la emoción y la suelte cuando llegue la siguiente.
export function pad(ctx, out, t, vel, freqs, hold, p, noise, lite = false) {
  const mix = ctx.createGain();
  mix.gain.value = 0.5 / Math.sqrt(freqs.length);
  const srcs = [];
  for (const f of freqs) {
    for (let j = 0; j < (lite ? 1 : 2); j++) {
      const o = ctx.createOscillator();
      o.type = p.wave;
      o.frequency.value = f;
      o.detune.value = (j === 0 ? 1 : -1) * p.detune * (lite ? 0.4 : 1);
      o.connect(mix);
      srcs.push(o);
    }
  }
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.9;
  filter.frequency.value = p.cutoff;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = p.lfo;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = p.cutoff * p.lfoDepth;
  lfo.connect(lfoGain).connect(filter.frequency);
  srcs.push(lfo);

  const g = ctx.createGain();
  g.gain.value = 0;
  mix.connect(filter).connect(g);

  const n = ctx.createBufferSource();
  n.buffer = noise;
  n.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900 + p.cutoff * 1.5;
  bp.Q.value = 0.7;
  const airGain = ctx.createGain();
  airGain.gain.value = p.air;
  n.connect(bp).connect(airGain).connect(g);
  srcs.push(n);

  g.gain.setValueAtTime(0, t);
  g.gain.setTargetAtTime(vel, t, p.attack / 3);
  g.gain.setTargetAtTime(0, t + hold, p.release / 3.5);
  g.connect(out);

  const voice = {
    filter, lfoGain, airGain,
    start: t,
    holdEnd: t + hold,
    end: t + hold + p.release * 2.5,
    // soltarla antes de tiempo (llega otro acorde, pausa...)
    release(at, rel = p.release) {
      at = Math.max(at, this.start + 0.005); // aún no había empezado: que no suene
      if (at >= this.holdEnd) return;
      g.gain.cancelScheduledValues(at);
      g.gain.setTargetAtTime(0, at, rel / 3.5);
      this.holdEnd = at;
      this.end = at + rel * 2.5;
      for (const s of srcs) s.stop(this.end);
    },
  };
  for (const s of srcs) s.start(t, s === n ? Math.random() * noise.duration : 0);
  for (const s of srcs) s.stop(voice.end);
  return voice;
}
