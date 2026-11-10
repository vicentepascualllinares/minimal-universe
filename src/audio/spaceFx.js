// ESPACIO (audio) — el DELAY y la REVERB de un universo, como envíos y retornos de una mesa. Qué
// suena (división, realimentación, sala, a quién...) lo decide el universo al nacer
// (music/space.js); aquí solo se monta.
//
//   canales ── envío (tras el fader del MIXER) ──► DELAY ──► retorno DELAY ─┐
//                                                    └──► (un poco) ──►     │
//   canales y transiciones ── envío ───────────────► REVERB ─► retorno REVERB ─┴─► suma del universo
//
// Los retornos van a la suma del universo ANTES de su saturación y de los filtros de tensión: los
// ecos y la sala son parte de la música (un build también los filtra; el hueco antes del kick
// también los calla). Los envíos salen DESPUÉS del fader, del MUTE y de la presencia en la
// estructura: un instrumento que se va deja sus ecos sonando, como en una mesa de verdad.
//
// DELAY: un eco de cinta. El primer eco sale entero; en la realimentación, paso alto y paso bajo
// (cada repetición más fina y más oscura, a lo dub). Una saturación que NO sube el volumen de lo
// pequeño (ganancia 1 abajo, solo redondea lo grande: el bucle nunca se embala). PING-PONG: un eco a cada lado. Centrado: los dos
// lados iguales, el derecho unos ms más tarde (abre un poco sin moverlo de sitio). Un vaivén lento
// del tiempo (wow) le da vida. El tiempo sigue al BPM (con un deslizamiento corto, como una cinta).
//
// REVERB: una convolución con una sala SINTETIZADA para cada universo (ver makeIR): ruido que cae
// −60 dB en `decay`, con los agudos apagándose a lo largo de la cola, reflexiones tempranas y
// anchura. Dos convolvers que se relevan al cambiar de universo: la sala nueva recibe desde el 1 del
// compás y la vieja se apaga con su propia cola (cambiar la sala de un convolver que suena la cortaría).

import { fixChannels, satCurveShared } from './dsp.js';
import { Rng } from '../core/rng.js';

const MAX_DELAY = 2.5; // s (negra con puntillo a 100 BPM = 0,9 s)
const HAAS = 0.011;    // s: el lado derecho del eco centrado
// NIVEL DE LOS RETORNOS (antes de su fader). Con la sala normalizada a energía 1, el envío es la
// proporción efecto / seco en RMS. Medido (2026-11-10, DJ, INTRO): con ganancia 1, la sala de la
// percusión quedaba ~17 dB por debajo de ella y ~39 dB bajo la suma del universo (casi no se oía).
// +6 dB a la reverb y +3 dB al delay: presentes sin lavar. El primer eco de un THROW nunca pasa del
// golpe seco (ver throwHit)
const RET_GAIN = { dly: 1.41, rev: 2 };

// ───────────────────────── LA SALA: respuesta al impulso sintetizada (estéreo)
// Ruido blanco por un paso bajo que se cierra con el tiempo (de ~15 kHz a `damp`), envolvente
// exponencial hasta −60 dB en `decay` y una subida de unos ms (la cola densa no empieza de golpe).
// Encima, 7 reflexiones tempranas por lado (cada lado en otros tiempos): su energía es `early` × la
// de la cola. Anchura con M/S. Normalizada a energía 1 (ruido que entra = ruido que sale, más o
// menos): el envío dice cuánto se oye. Las últimas muestras se funden a 0 (sin corte al final)
export function makeIR(R, sr, maxDecay = 3) {
  const T = Math.min(R.decay, maxDecay);
  const p0 = Math.round(R.pre * sr);
  const len = p0 + Math.ceil((T * 1.05 + 0.02) * sr);
  const rng = new Rng(R.irSeed);
  const k = 6.91 / T;
  const build = 0.003 + 0.012 * Math.min(1, T / 2);
  const out = [new Float32Array(len), new Float32Array(len)];
  for (const x of out) {
    let lp = 0, e = 0;
    for (let i = p0; i < len; i++) {
      const t = (i - p0) / sr;
      const fc = R.damp + (15000 - R.damp) * Math.exp(-t / (T * 0.25));
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      lp += a * (rng.float(-1, 1) - lp);
      const v = lp * Math.exp(-k * t) * (1 - Math.exp(-t / build));
      x[i] = v;
      e += v * v;
    }
    // reflexiones tempranas: golpecitos suaves (3 muestras) entre 3 ms y ~15–45 ms
    const n = 7, span = 0.012 + 0.033 * Math.min(1, T);
    const g = Math.sqrt((R.early * e) / n);
    for (let j = 0; j < n; j++) {
      const te = 0.003 + Math.pow(rng.next(), 1.3) * span;
      const idx = p0 + Math.round(te * sr);
      const amp = g * (rng.chance(0.5) ? 1 : -1) * Math.exp(-k * te) * (1 - (0.4 * j) / n);
      if (idx > 0 && idx < len - 1) {
        x[idx - 1] += amp * 0.5;
        x[idx] += amp;
        x[idx + 1] += amp * 0.5;
      }
    }
  }
  // anchura (M/S) y energía 1
  const [L, Rt] = out;
  let E = 0;
  for (let i = 0; i < len; i++) {
    const m = (L[i] + Rt[i]) / 2, s = ((L[i] - Rt[i]) / 2) * R.width;
    L[i] = m + s;
    Rt[i] = m - s;
    E += L[i] * L[i] + Rt[i] * Rt[i];
  }
  const norm = E > 0 ? 1 / Math.sqrt(E / 2) : 0;
  const fade = Math.min(len, Math.round(0.01 * sr));
  for (let i = 0; i < len; i++) {
    const f = i >= len - fade ? (len - i) / fade : 1;
    L[i] *= norm * f;
    Rt[i] *= norm * f;
  }
  return out;
}

export class SpaceFx {
  // `dest` = la suma del universo · `q` = la CALIDAD del motor (en LIGERA, salas de 1,2 s como mucho)
  constructor(ctx, dest, q) {
    this.ctx = ctx;
    this.maxDecay = q.lean ? 1.2 : 3;
    const g = (v = 1, ch) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return ch ? fixChannels(n, ch) : n;
    };
    const bq = (type, f, Q, ch) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = Q;
      return fixChannels(b, ch);
    };
    // RETORNOS: el fader del MIXER (`user`, con MUTE y SOLO) y la salida (para el medidor)
    const ret = (k) => {
      const user = g(1, 2), out = g(RET_GAIN[k], 2);
      user.connect(out).connect(dest);
      return { user, out };
    };
    this.ret = { dly: ret('dly'), rev: ret('rev') };

    // ── REVERB: dos convolvers que se relevan (ver setIR)
    this.rIn = g(1, 2);
    this.rHp = bq('highpass', 250, 0.6, 2);
    this.rHp.connect(this.ret.rev.user);
    this.conv = [0, 1].map(() => {
      const c = ctx.createConvolver();
      c.normalize = false;
      fixChannels(c, 2);
      const i = g(0, 2), o = g(1, 2);
      this.rIn.connect(i).connect(c).connect(o).connect(this.rHp);
      return { c, i, o, len: 0, busyUntil: 0 };
    });
    this.cur = 0;
    this.irKey = null;

    // ── DELAY (mono dentro: el eco no hereda el paneo; sale en estéreo)
    this.dIn = g(1, 1);
    this.dMix = g(1, 1);
    this.dL = fixChannels(ctx.createDelay(MAX_DELAY), 1);
    this.dR = fixChannels(ctx.createDelay(MAX_DELAY), 1);
    this.dHp = bq('highpass', 300, 0.6, 1);
    this.dLp = bq('lowpass', 3000, 0.7, 1);
    // cinta: pre → tanh → post = 1/pre (ganancia 1 en lo pequeño: el bucle nunca pasa de `fb`)
    this.tPre = g(1 / 48, 1);
    const sh = fixChannels(ctx.createWaveShaper(), 1);
    sh.curve = satCurveShared(); // tanh(48·u): con pre = k/48 es tanh(k·x)
    sh.oversample = q.oversample ? '2x' : 'none';
    this.tPost = g(1, 1);
    this.gLL = g(0, 1); // centrado: realimentación del mismo lado (× fb)
    this.gLR = g(0, 1); // ping-pong: izquierda → derecha (× fb)
    this.gCopy = g(0, 1); // centrado: el lado derecho es una copia del izquierdo (× 1)
    this.gRL = g(0, 1); // ping-pong: derecha → izquierda (× fb)
    // el primer eco sale entero (solo la cinta); los filtros van en la REALIMENTACIÓN: cada
    // repetición, más fina y más oscura (como un eco de cinta dub)
    this.dIn.connect(this.dMix).connect(this.dL).connect(this.tPre).connect(sh).connect(this.tPost);
    this.tPost.connect(this.dHp).connect(this.dLp);
    this.dLp.connect(this.gLL).connect(this.dMix);
    this.dLp.connect(this.gLR).connect(this.dR);
    this.tPost.connect(this.gCopy).connect(this.dR);
    this.dR.connect(this.gRL).connect(this.dMix);
    const merge = ctx.createChannelMerger(2);
    this.tPost.connect(merge, 0, 0);
    this.dR.connect(merge, 0, 1);
    merge.connect(this.ret.dly.user);
    this.toRev = g(0, 2); // los ecos, a la sala
    merge.connect(this.toRev).connect(this.rIn);
    // wow: vaivén lento del tiempo de los dos lados
    this.wow = ctx.createOscillator();
    this.wowG = g(0);
    this.wow.connect(this.wowG);
    this.wowG.connect(this.dL.delayTime);
    this.wowG.connect(this.dR.delayTime);
    this.wow.start();

    this.sendD = {};
    this.sendR = {};
    this.S = null;
    this.sd = 0;
  }

  // ENVÍOS de un canal (`node` = su salida, tras el fader). 'fx' (las transiciones): solo a la sala
  wire(k, node) {
    if (k !== 'fx') node.connect((this.sendD[k] = this.ctx.createGain())).connect(this.dIn);
    node.connect((this.sendR[k] = this.ctx.createGain())).connect(this.rIn);
    this.sendD[k] && (this.sendD[k].gain.value = 0);
    this.sendR[k].gain.value = 0;
  }

  // el ESPACIO de un universo (music/space.js), desde `at` (el 1 del compás en que nace).
  // `first`: al montar el audio, todo al momento (aún no suena nada)
  set(S, at, stepDur, first = false) {
    const now = this.ctx.currentTime;
    at = Math.max(at, now);
    this.S = S;
    const put = (p, v, tc = 0.05) => (first ? (p.value = v) : p.setTargetAtTime(v, at, tc));
    const D = S.dly;
    for (const k in this.sendD) put(this.sendD[k].gain, D.send[k] ?? 0);
    for (const k in this.sendR) put(this.sendR[k].gain, S.rev.send[k] ?? 0);
    put(this.toRev.gain, D.toRev);
    put(this.gLL.gain, D.pingpong ? 0 : D.fb);
    put(this.gLR.gain, D.pingpong ? D.fb : 0);
    put(this.gCopy.gain, D.pingpong ? 0 : 1);
    put(this.gRL.gain, D.pingpong ? D.fb : 0);
    put(this.dHp.frequency, D.thin);
    put(this.dLp.frequency, D.tone);
    const k = 1 + 3 * D.drive;
    put(this.tPre.gain, k / 48);
    put(this.tPost.gain, 1 / k);
    put(this.wowG.gain, D.wow, 0.3);
    put(this.wow.frequency, D.wowHz, 0.3);
    this.tempo(stepDur, at, true, first);
    put(this.rHp.frequency, S.rev.low);
    this.setIR(S.rev, at, first);
  }

  // el tiempo del delay sigue al BPM (deslizando, como una cinta). Solo si cambia
  tempo(stepDur, at, force = false, first = false) {
    if (!this.S || (!force && stepDur === this.sd)) return;
    this.sd = stepDur;
    const D = this.S.dly;
    const tl = D.steps * stepDur, tr = D.pingpong ? tl : HAAS;
    if (first) {
      this.dL.delayTime.value = tl;
      this.dR.delayTime.value = tr;
      return;
    }
    at = Math.max(at, this.ctx.currentTime);
    this.dL.delayTime.setTargetAtTime(tl, at, 0.06);
    this.dR.delayTime.setTargetAtTime(tr, at, 0.06);
  }

  // THROW: el envío al delay de `k` se abre para el golpe que suena en `t` (durante `hold` s) y
  // vuelve a lo suyo; los ecos se quedan sonando. Rampas de 5 y 30 ms: sin clics
  throwHit(k, t, hold) {
    const s = this.sendD[k];
    if (!s || !this.S) return;
    const D = this.S.dly;
    const base = D.send[k] ?? 0, top = Math.max(base, Math.min(D.throwAmt, 1 / RET_GAIN.dly));
    const p = s.gain;
    const a = Math.max(this.ctx.currentTime, t - 0.006);
    p.cancelScheduledValues(a);
    p.setValueAtTime(base, a);
    p.linearRampToValueAtTime(top, a + 0.005);
    p.setValueAtTime(top, t + hold);
    p.linearRampToValueAtTime(base, t + hold + 0.03);
  }

  // LA SALA: la nueva entra en el convolver que descansa y, en `at`, la música pasa a ese; el otro
  // se queda sonando su cola. Si el que descansa aún suena (dos universos muy seguidos), se apaga su
  // salida en ~20 ms antes de cambiarle la sala (cambiarla con cola la cortaría en seco)
  // calcular una sala (hasta ~30 ms para una de 2 s): se hace al pulsar NUEVO UNIVERSO (ver
  // Deck.reseed), no dentro del reloj, y se guarda hasta que entra
  prepare(R) {
    const key = `${R.irSeed}|${R.decay}|${R.pre}|${R.damp}|${R.early}|${R.width}`;
    if (this.ready?.key === key) return this.ready.buf;
    const ctx = this.ctx;
    const [L, Rt] = makeIR(R, ctx.sampleRate, this.maxDecay);
    const buf = ctx.createBuffer(2, L.length, ctx.sampleRate);
    buf.copyToChannel(L, 0);
    buf.copyToChannel(Rt, 1);
    this.ready = { key, buf };
    return buf;
  }

  setIR(R, at, first) {
    const buf = this.prepare(R);
    if (this.ready.key === this.irKey) return;
    this.irKey = this.ready.key;
    const ctx = this.ctx;
    if (first) {
      const A = this.conv[this.cur];
      A.c.buffer = buf;
      A.len = buf.duration;
      A.i.gain.value = 1;
      return;
    }
    const now = ctx.currentTime;
    const A = this.conv[this.cur], B = this.conv[1 - this.cur];
    this.cur = 1 - this.cur;
    const load = () => {
      B.c.buffer = buf;
      B.len = buf.duration;
    };
    if (B.busyUntil > now) {
      B.o.gain.setTargetAtTime(0, now, 0.005);
      setTimeout(() => {
        load();
        B.o.gain.cancelScheduledValues(0);
        B.o.gain.setValueAtTime(1, ctx.currentTime);
      }, 40);
    } else load();
    A.i.gain.setTargetAtTime(0, at, 0.006);
    B.i.gain.setTargetAtTime(1, at, 0.006);
    A.busyUntil = at + A.len + 0.1;
  }
}
