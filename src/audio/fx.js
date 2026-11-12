// VOCES DE TRANSICIÓN — riser, shh, redoble, kick que sube, impacto, platos, reverse y caída.
// Todo sintetizado, cero samples. `p` = la paleta del universo (music/transitions.js).
// Las voces de un golpe se programan en un tiempo exacto `t`; el riser es una voz
// sostenida que el universo mueve compás a compás con set(progreso).

import * as V from './voices.js';

const METAL = [1, 1.4826, 1.8003, 2.5461, 2.6303, 3.8968];
const nz = (ctx, noise, loop = false) => {
  const n = ctx.createBufferSource();
  n.buffer = noise;
  n.loop = loop;
  return n;
};
const off = (noise) => Math.random() * (noise.duration - 0.8);
const filt = (ctx, type, f, q) => {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  if (q !== undefined) b.Q.value = q;
  return b;
};

// ───────────────────────── RISER (sostenido)
// Ruido que se abre y/o un tono que sube; el volumen crece con la tensión.
// `noiseOnly`: transiciones cortas, solo un soplo de ruido.
export function riser(ctx, out, t, p, root, noise, level = 1, noiseOnly = false) {
  const g = ctx.createGain();
  g.gain.value = 0;
  const srcs = [];
  let dest = g;
  let lfo = null;
  if (p.wobble) { // trémolo que acelera: 2 → 16 Hz
    const am = ctx.createGain();
    am.gain.value = 0.6;
    lfo = ctx.createOscillator();
    lfo.frequency.value = 2;
    const lg = ctx.createGain();
    lg.gain.value = 0.4;
    lfo.connect(lg).connect(am.gain);
    am.connect(g);
    dest = am;
    srcs.push(lfo);
  }
  g.connect(out);

  const useNoise = noiseOnly || p.riser !== 'tone';
  const useTone = !noiseOnly && p.riser !== 'noise';
  let bp = null, oscs = [], lp = null;
  if (useNoise) {
    const n = nz(ctx, noise, true);
    bp = filt(ctx, 'bandpass', 400, p.noiseQ);
    const ng = ctx.createGain();
    ng.gain.value = useTone ? 0.4 : 0.6;
    n.connect(bp).connect(ng).connect(dest);
    srcs.push(n);
  }
  const f0 = root * Math.pow(2, p.riseOct);
  if (useTone) {
    lp = filt(ctx, 'lowpass', 900, 4);
    const tg = ctx.createGain();
    tg.gain.value = useNoise ? 0.12 : 0.18;
    for (const d of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = p.wave;
      o.frequency.value = f0;
      o.detune.value = d;
      o.connect(tg);
      oscs.push(o);
      srcs.push(o);
    }
    tg.connect(lp).connect(dest);
  }
  for (const s of srcs) s.start(t, s.buffer ? Math.random() * noise.duration : 0);

  let ended = false;
  const stop = (at, tc) => {
    if (ended) return;
    ended = true;
    g.gain.setTargetAtTime(0, at, tc);
    for (const s of srcs) s.stop(at + tc * 8 + 0.02);
  };
  return {
    // p 0..1: lo que llevamos de riser
    set(q, now) {
      if (ended) return;
      const tc = 0.06;
      if (bp) bp.frequency.setTargetAtTime(400 * Math.pow(22, q), now, tc);
      if (oscs.length) {
        const f = f0 * Math.pow(2, (p.riseSemis * Math.pow(q, 1.2)) / 12);
        for (const o of oscs) o.frequency.setTargetAtTime(f, now, tc);
        lp.frequency.setTargetAtTime(900 * Math.pow(9, q), now, tc);
      }
      if (lfo) lfo.frequency.setTargetAtTime(2 + 14 * q * q, now, tc);
      // `p.riseFloor`: el volumen al empezar (los viajes largos empiezan ya audibles)
      const fl = p.riseFloor ?? 0.04;
      g.gain.setTargetAtTime(level * (fl + (1 - fl) * Math.pow(q, p.riseCurve ?? 1.8)), now, tc);
    },
    end(at) { stop(at, 0.004); }, // corte seco: el riser muere justo en el 1
    kill(at) { stop(at, 0.05); },
  };
}

// ───────────────────────── REDOBLE (un golpe)
// q = 0..1 avance del redoble: sube el tono si la paleta lo pide
export function rollHit(ctx, out, t, vel, p, q, noise) {
  const pm = Math.pow(2, (p.rollRise * q) / 12);
  const g = ctx.createGain();
  g.connect(out);
  const d = p.rollDecay;
  const env = (node, v, dec) => {
    node.gain.setValueAtTime(0, t);
    node.gain.linearRampToValueAtTime(v, t + 0.001);
    node.gain.setTargetAtTime(0, t + 0.001, dec / 4);
  };
  const end = t + d * 2 + 0.03;
  if (p.roll === 'tom') {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(p.rollTone * 1.6 * pm, t);
    o.frequency.exponentialRampToValueAtTime(p.rollTone * pm, t + 0.04);
    const og = ctx.createGain();
    env(og, vel * 0.5, d * 1.3);
    o.connect(og).connect(g);
    o.start(t);
    o.stop(end);
    return;
  }
  const n = nz(ctx, noise);
  const ng = ctx.createGain();
  if (p.roll === 'clap') {
    const bp = filt(ctx, 'bandpass', 1100 * pm, 1.4);
    env(ng, vel * 1.3, d);
    n.connect(bp).connect(filt(ctx, 'highpass', 400)).connect(ng).connect(g);
  } else if (p.roll === 'rim') {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = p.rollTone * 3.2 * pm;
    const og = ctx.createGain();
    env(og, vel * 0.15, 0.03);
    o.connect(filt(ctx, 'bandpass', p.rollTone * 3.2 * pm, 3)).connect(og).connect(g);
    o.start(t);
    o.stop(t + 0.1);
    env(ng, vel * 0.3, 0.025);
    n.connect(filt(ctx, 'highpass', 3000)).connect(ng).connect(g);
  } else { // snare: cuerpo + bordón
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(p.rollTone * 1.5 * pm, t);
    o.frequency.exponentialRampToValueAtTime(p.rollTone * pm, t + 0.03);
    const og = ctx.createGain();
    env(og, vel * 0.3, d * 0.6);
    o.connect(og).connect(g);
    o.start(t);
    o.stop(end);
    env(ng, vel * 0.4, d);
    n.connect(filt(ctx, 'highpass', 900)).connect(filt(ctx, 'peaking', p.snap * pm, 1)).connect(ng).connect(g);
  }
  n.start(t, off(noise));
  n.stop(end);
}

// ───────────────────────── SHH (sostenido y a ritmo): el riser de ruido blanco al compás
// «shh shh shh»: ruido que late en la rejilla. El universo lo mueve con set(q) (el filtro se
// abre, el volumen sube) y le marca cada golpe con hit(t, dur). Según `p.shh`:
//   bombeo  como con sidechain: se hunde en cada golpe y vuelve a crecer hasta el siguiente
//   golpe   un soplo en cada golpe que se apaga antes del siguiente
//   contra  el soplo, a contratiempo (lo coloca quien llama)
// `floor`: el volumen al empezar (0..1 del final); `curve`: cómo crece
export function shh(ctx, out, t, p, noise, level = 1, floor = 0.08, curve = 1.6) {
  const n = nz(ctx, noise, true);
  const tone = p.shhTone ?? 1;
  const hp = filt(ctx, 'highpass', 450 * tone, 0.7);
  const lp = filt(ctx, 'lowpass', 3000 * tone, 0.7);
  const pump = ctx.createGain();
  const pumped = p.shh === 'bombeo';
  pump.gain.value = pumped ? 1 : 0;
  const g = ctx.createGain();
  g.gain.value = 0;
  n.connect(hp).connect(lp).connect(pump).connect(g).connect(out);
  n.start(t, Math.random() * (noise.duration - 0.1));
  let ended = false;
  const stop = (at, tc) => {
    if (ended) return;
    ended = true;
    g.gain.cancelScheduledValues(at);
    g.gain.setTargetAtTime(0, at, tc);
    n.stop(at + tc * 8 + 0.02);
  };
  return {
    set(q, now) {
      if (ended) return;
      const tc = 0.06;
      hp.frequency.setTargetAtTime(450 * tone * Math.pow(5, q), now, tc);       // 450 → 2,2 kHz
      lp.frequency.setTargetAtTime(Math.min(18000, 3000 * tone * Math.pow(5, q)), now, tc); // 3 → 15 kHz
      g.gain.setTargetAtTime(0.4 * level * (floor + (1 - floor) * Math.pow(q, curve)), now, tc);
    },
    // un golpe en `at`; `dur` = lo que falta para el siguiente (s)
    hit(at, dur, vel = 1) {
      if (ended) return;
      const P = pump.gain;
      if (pumped) {
        P.setTargetAtTime(0.03, at, 0.004);
        P.setTargetAtTime(vel, at + dur * 0.12, dur * 0.26);
      } else {
        P.setTargetAtTime(vel, at, 0.003);
        P.setTargetAtTime(0, at + Math.min(0.02, dur * 0.1), dur * 0.2);
      }
    },
    end(at) { stop(at, 0.004); }, // corte seco en el 1
    kill(at) { stop(at, 0.04); },
  };
}

// ───────────────────────── KICK QUE SUBE (un golpe)
// El kick del universo, a una rejilla que acelera, subiendo de tono y abriéndose: lejano y
// apagado al principio, entero al final. q = 0..1 avance; `hz` = su nota (la NOTA del kick)
// ya subida; `dur` = hasta el siguiente golpe (s): la cola no se pisa con él
export function kickRise(ctx, out, t, vel, kickP, hz, q, dur, noise) {
  const lp = filt(ctx, 'lowpass', 220 * Math.pow(60, q), 0.7); // 220 Hz → 13 kHz
  lp.connect(out);
  const decay = Math.min(kickP.decay, Math.max(0.05, dur * 0.8));
  V.kick(ctx, lp, t, vel, { ...kickP, hold: Math.min(kickP.hold, dur * 0.25), decay }, hz, noise);
}

// ───────────────────────── REDOBLE CON LA VOZ PROPIA: el clap del universo (su color), más corto
// y subiendo de tono si la paleta lo pide
export function selfHit(ctx, out, t, vel, p, q, clapP, noise) {
  const pm = Math.pow(2, (p.rollRise * q) / 12);
  V.clap(ctx, out, t, vel * 1.1, { ...clapP, freq: clapP.freq * pm, decay: Math.min(clapP.decay, 0.06 + 0.08 * (1 - q)), spread: clapP.spread * 0.6 }, noise);
}

// ───────────────────────── IMPACTO CON EL KICK DEL UNIVERSO: su kick, con más caída y más cola
export function kickImpact(ctx, out, t, vel, kickP, root, noise) {
  V.kick(ctx, out, t, vel * 0.6, {
    ...kickP, punch: kickP.punch * 1.5, pitchDecay: kickP.pitchDecay * 4, hold: kickP.hold * 2, decay: kickP.decay * 2.5,
  }, root, noise);
}

// ───────────────────────── IMPACTO (al llegar)
// boom: seno que cae hasta la tónica del kick (siempre afinado) · thud: ruido sordo
export function impact(ctx, out, t, vel, p, root, noise) {
  const end = t + p.boomDecay * 2 + 0.1;
  if (p.boom) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(root * p.boomDrop, t);
    o.frequency.exponentialRampToValueAtTime(root, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.55, t + 0.003);
    g.gain.setTargetAtTime(0, t + 0.04, p.boomDecay / 4);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(end);
  }
  if (p.thud) {
    const n = nz(ctx, noise);
    const lp = filt(ctx, 'lowpass', 1400, 1);
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.9, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.002, 0.09);
    n.connect(lp).connect(g).connect(out);
    n.start(t, off(noise));
    n.stop(t + 0.6);
  }
}

// ───────────────────────── PLATO (crash)
function metalNoise(ctx, noise, p, metalAmt, dest, t, end) {
  const metal = ctx.createGain();
  metal.gain.value = metalAmt * 0.12;
  const oscs = METAL.map((r) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = p.crashBase * r;
    o.connect(metal);
    return o;
  });
  const n = nz(ctx, noise, true); // el búfer de ruido dura 2 s: en bucle para colas largas
  const ng = ctx.createGain();
  ng.gain.value = (1 - metalAmt) * 0.9;
  n.connect(ng);
  const hp = filt(ctx, 'highpass', 4200, 0.5);
  metal.connect(hp);
  ng.connect(hp);
  hp.connect(dest);
  for (const o of oscs) { o.start(t); o.stop(end); }
  n.start(t, off(noise));
  n.stop(end);
  return hp;
}

export function crash(ctx, out, t, vel, p, noise) {
  const g = ctx.createGain();
  g.connect(out);
  const end = t + p.crashDecay * 1.8 + 0.05;
  metalNoise(ctx, noise, p, p.crashMetal, g, t, end);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.002);
  g.gain.setTargetAtTime(vel * 0.45, t + 0.002, 0.06);
  g.gain.setTargetAtTime(0, t + 0.08, p.crashDecay / 4);
}

// ───────────────────────── REVERSE (plato al revés que termina en t + dur)
export function reverse(ctx, out, t, dur, vel, p, noise) {
  const g = ctx.createGain();
  const lp = filt(ctx, 'lowpass', 1800, 0.7);
  lp.connect(g).connect(out);
  const end = t + dur;
  metalNoise(ctx, noise, p, p.crashMetal * 0.6, lp, t, end + 0.03);
  lp.frequency.setValueAtTime(1800, t);
  lp.frequency.exponentialRampToValueAtTime(16000, end);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, end);
  g.gain.linearRampToValueAtTime(0, end + 0.006); // corte seco al llegar
  return {
    end,
    // cortar a medias: hay que SUJETAR el volumen donde va. cancelScheduledValues a
    // secas borra la rampa en curso y el volumen salta de golpe a 0,0001 (chasquido)
    kill(at) {
      if (at >= end) return;
      if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(at);
      else { // Firefox: se calcula dónde iba la rampa exponencial
        const q = Math.min(1, Math.max(0, (at - t) / (end - t)));
        g.gain.cancelScheduledValues(at);
        g.gain.setValueAtTime(0.0001 * Math.pow(vel / 0.0001, q), at);
      }
      g.gain.setTargetAtTime(0, at, 0.03);
    },
  };
}

// ───────────────────────── CAÍDA (downlifter: ruido que baja, después de llegar)
export function downlifter(ctx, out, t, dur, vel, p, noise) {
  const n = nz(ctx, noise, true);
  const bp = filt(ctx, 'bandpass', 6000, 1.2);
  bp.frequency.setValueAtTime(6000, t);
  bp.frequency.exponentialRampToValueAtTime(220, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.01);
  g.gain.setTargetAtTime(0, t + 0.01, dur / 3.5);
  n.connect(bp).connect(g).connect(out);
  n.start(t, off(noise));
  n.stop(t + 0.01 + dur * 2.6); // ~9 constantes de tiempo: se para ya en silencio (antes, al 1 %: clic)
}
