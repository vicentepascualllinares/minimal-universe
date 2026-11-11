// ESPACIO (audio) — el DELAY y la REVERB de un universo, como envíos y retornos de una mesa. Qué
// suena (división, realimentación, sala, a quién...) lo decide el universo al nacer
// (music/space.js); aquí solo se monta.
//
//   canales ── envío (tras el fader del MIXER) ──► DELAY ──► retorno DELAY ─┐
//                                                    └──► (un poco) ──►     │
//   canales y transiciones ── envío ───────────────► REVERB ─► retorno REVERB ─┤
//   (sin clap)             ── envío ───────────────► FONDO ──► retorno FONDO ──┴─► suma del universo
//
// FONDO (2026-11-11): una segunda reverb, el colchón: cola ALGORÍTMICA larga y oscura (FdnTail), paso alto y
// paso bajo en el retorno, y un compresor que la aplasta (ver el constructor).
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
// FONDO (medido 2026-11-11, ROMINIMAL, MAIN, con foley, acordes y una transición): la cola llega al
// compresor muy baja (una cola larga reparte la energía de cada golpe en segundos): `BG_PRE` la sube
// +29,5 dB a la zona donde trabaja y luego se baja lo mismo. La compensación automática del compresor
// SÍ se queda: es la que levanta lo flojo de la cola (el colchón). Con la cola algorítmica: ~8 dB de
// reducción de media y ~14 en los picos (bastante comprimido) y, con ×2,8, el retorno ~24 dB bajo la
// suma del universo: se nota como fondo sin tapar. El fader FONDO del MIXER hace el resto
const RET_GAIN = { dly: 1.41, rev: 2, bg: 2.8 };
const BG_PRE = 30;

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
  return finishIR(out, R.width, sr);
}

// anchura (M/S), energía 1 y las últimas muestras fundidas a 0
function finishIR(out, width, sr) {
  const [L, Rt] = out;
  const len = L.length;
  let E = 0;
  for (let i = 0; i < len; i++) {
    const m = (L[i] + Rt[i]) / 2, s = ((L[i] - Rt[i]) / 2) * width;
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

// ───────────────────────── EL FONDO: una cola ALGORÍTMICA, larga y oscura
// Primero se probó como la sala (convolución con una cola sintetizada de 4–9 s) y no aguanta: medido
// (2026-11-11, DJ, búfer ESTABLE), UNA cola así sonando en cada universo daba ~1 CORTE por segundo
// sin tocar nada (sin ella, 0), y cargar una de 9 s bloqueaba ~100 ms. Así que el fondo es una RED
// DE RETARDOS REALIMENTADA (FDN), lo de las reverbs de hardware: casi no gasta, su largo cambia en
// vivo (sin cargar nada al cambiar de universo) y se oscurece sola al apagarse.
//
//   entrada ─► DIFUSOR (convolución de ~0,15 s: convierte cada golpe en un soplo de ruido, así un
//              clic del foley no hace sonar la red como un muelle) ─► predelay ─► 8 LÍNEAS:
//   cada línea: retardo (37–109 ms, sin divisores comunes) ─► paso bajo (`damp`) ─► realimentación
//   (lo que pierde en cada vuelta para caer −60 dB en `decay`) ─► vuelve a su línea y a la MEZCLA de
//   Householder (todas le dan a todas: −2/8 de la suma), que reparte la energía sin perderla.
//   Las pares salen por la izquierda y las impares por la derecha. Un vaivén lento de los retardos
//   (dos LFO, ±0,6 ms) evita que las resonancias se queden fijas.

const FDN_MS = [37, 43, 53, 61, 71, 83, 97, 109];

// el DIFUSOR: ruido que cae −60 dB en 0,15 s, estéreo (cada lado su ruido), energía 1. Igual para
// todos los universos: se calcula una vez por frecuencia de muestreo
const diffCache = new Map();
function diffuserIR(ctx) {
  const sr = ctx.sampleRate;
  if (diffCache.has(sr)) return diffCache.get(sr);
  const len = Math.round(0.15 * sr), rng = new Rng(0x2f1d7b);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const x = new Float32Array(len);
    let e = 0, env = 1, lp = 0;
    const dk = Math.exp(-6.91 / (0.15 * sr));
    for (let i = 0; i < len; i++) {
      lp += 0.5 * (rng.next() * 2 - 1 - lp); // algo de paso bajo: un soplo, no un siseo
      x[i] = lp * env * Math.min(1, i / (0.002 * sr));
      env *= dk;
      e += x[i] * x[i];
    }
    const n = 1 / Math.sqrt(e);
    for (let i = 0; i < len; i++) x[i] *= n;
    buf.copyToChannel(x, ch);
  }
  diffCache.set(sr, buf);
  return buf;
}

class FdnTail {
  constructor(ctx, input, output) {
    this.ctx = ctx;
    const g = (v, ch) => { const n = ctx.createGain(); n.gain.value = v; return ch ? fixChannels(n, ch) : n; };
    const diff = fixChannels(ctx.createConvolver(), 2);
    diff.normalize = false;
    diff.buffer = diffuserIR(ctx);
    this.pre = fixChannels(ctx.createDelay(0.2), 2);
    input.connect(diff).connect(this.pre);
    const split = ctx.createChannelSplitter(2);
    this.pre.connect(split);
    const merge = ctx.createChannelMerger(2);
    this.out = g(1, 2);
    merge.connect(this.out).connect(output);
    const N = FDN_MS.length;
    const mix = g(-2 / N, 1); // Householder: −2/N de la suma vuelve a todas
    this.lines = FDN_MS.map((ms, i) => {
      const d = fixChannels(ctx.createDelay(0.2), 1);
      d.delayTime.value = ms / 1000;
      const lp = fixChannels(ctx.createBiquadFilter(), 1);
      lp.type = 'lowpass';
      lp.Q.value = -4; // en dB (Web Audio): por debajo de −3 no hay pico, la vuelta nunca gana (con +0,5 la cola se disparaba)
      const fb = g(0, 1);
      split.connect(d, i % 2); // pares desde la izquierda, impares desde la derecha
      d.connect(lp).connect(fb);
      fb.connect(d);   // a su línea
      fb.connect(mix); // y a la mezcla
      mix.connect(d);
      lp.connect(merge, 0, i % 2);
      return { d, lp, fb, s: ms / 1000 };
    });
    // vaivén: dos LFO lentos, cada línea con uno y un signo
    this.lfos = [0.11, 0.17].map((hz) => {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      o.start();
      return o;
    });
    this.lines.forEach((L, i) => {
      const m = g(0.0006 * (i % 4 < 2 ? 1 : -1));
      this.lfos[i % 2].connect(m).connect(L.d.delayTime);
    });
  }

  // el fondo de un universo, desde `at`: largo, oscuridad y predelay. Un universo sin fondo deja la
  // red sin entrada (sus envíos ya están a 0) y la cola que hubiera se apaga sola
  set(B, at, first) {
    const put = (p, v, tc = 0.08) => (first ? (p.value = v) : p.setTargetAtTime(v, at, tc));
    const T = Math.max(0.5, B.decay);
    let e = 0;
    for (const L of this.lines) {
      // −60 dB en T segundos (× 1,25: el paso bajo de cada vuelta ya quita algo; medido, sin esto caía en ~0,8 T)
      const gi = Math.pow(10, (-3 * L.s) / (T * 1.25));
      put(L.fb.gain, gi);
      put(L.lp.frequency, B.damp);
      e += gi * gi;
    }
    put(this.pre.delayTime, B.pre);
    // nivel parejo entre colas cortas y largas (una cola larga acumula más energía): sin esto, la de
    // 9 s sonaría ~3 dB más que la de 4 s
    put(this.out.gain, Math.sqrt(1 - e / this.lines.length) * 1.6);
  }
}

// DOS CONVOLVERS QUE SE RELEVAN (la sala): la respuesta nueva entra en el que descansa y,
// en `at`, la música pasa a ese; el otro se queda sonando su cola. Si el que descansa aún suena (dos
// universos muy seguidos), se apaga su salida en ~20 ms antes de cambiarle la respuesta (cambiarla
// con cola la cortaría en seco). `make` = makeIR
class Relay {
  constructor(ctx, input, output, make, maxDecay) {
    this.ctx = ctx;
    this.make = make;
    this.maxDecay = maxDecay;
    this.conv = [0, 1].map(() => {
      const c = ctx.createConvolver();
      c.normalize = false;
      fixChannels(c, 2);
      const i = fixChannels(ctx.createGain(), 2), o = fixChannels(ctx.createGain(), 2);
      i.gain.value = 0;
      input.connect(i).connect(c).connect(o).connect(output);
      return { c, i, o, len: 0, busyUntil: 0 };
    });
    this.cur = 0;
    this.key = null;
    this.ready = null;
  }

  // calcular una respuesta: se hace al pulsar NUEVO UNIVERSO (ver Deck.reseed), no dentro del reloj,
  // y se guarda hasta que entra
  prepare(R) {
    const key = `${R.irSeed}|${R.decay}|${R.pre}|${R.damp}|${R.early}|${R.width}`;
    if (this.ready?.key === key) return this.ready.buf;
    const ctx = this.ctx;
    const [L, Rt] = this.make(R, ctx.sampleRate, this.maxDecay);
    const buf = ctx.createBuffer(2, L.length, ctx.sampleRate);
    buf.copyToChannel(L, 0);
    buf.copyToChannel(Rt, 1);
    this.ready = { key, buf };
    return buf;
  }

  set(R, at, first) {
    const buf = this.prepare(R);
    if (this.ready.key === this.key) return;
    this.key = this.ready.key;
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

export class SpaceFx {
  // `dest` = la suma del universo · `q` = la CALIDAD del motor (en LIGERA, salas de 1,2 s como mucho)
  constructor(ctx, dest, q) {
    this.ctx = ctx;
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
    this.ret = { dly: ret('dly'), rev: ret('rev'), bg: ret('bg') };

    // ── REVERB: dos convolvers que se relevan (ver Relay)
    this.rIn = g(1, 2);
    this.rHp = bq('highpass', 250, 0.6, 2);
    this.rHp.connect(this.ret.rev.user);
    this.room = new Relay(ctx, this.rIn, this.rHp, makeIR, q.lean ? 1.2 : 3);

    // ── FONDO: la cola algorítmica (FdnTail, larga y oscura) → paso alto y paso bajo → compresor.
    // `bPre` sube la cola a la zona del compresor y `bPost` deshace esa subida (no la compensación
    // del compresor): lo fuerte se aplasta y lo flojo sube, la cola queda pareja, un colchón sin picos
    this.bIn = g(1, 2);
    this.bHp = bq('highpass', 300, 0.6, 2);
    this.bLp = bq('lowpass', 4000, 0.6, 2);
    this.bPre = g(BG_PRE, 2);
    this.bComp = fixChannels(ctx.createDynamicsCompressor(), 2);
    this.bComp.knee.value = 8;
    this.bComp.attack.value = 0.02;
    this.bComp.release.value = 0.35;
    this.bPost = g(1 / BG_PRE, 2);
    this.bHp.connect(this.bLp).connect(this.bPre).connect(this.bComp).connect(this.bPost).connect(this.ret.bg.user);
    this.bg = new FdnTail(ctx, this.bIn, this.bHp);

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
    this.sendB = {};
    this.sends = { dly: this.sendD, rev: this.sendR, bg: this.sendB };
    this.S = null;
    this.sd = 0;
  }

  // ENVÍOS de un canal (`node` = su salida, tras el fader) a los tres efectos. Todos los elementos
  // (y las transiciones, 'fx') tienen los tres: los que el universo no usa (kick y bajo, el clap al
  // fondo, las transiciones al delay) nacen a 0 y se pueden subir con las perillas del MIXER
  wire(k, node) {
    node.connect((this.sendD[k] = this.ctx.createGain())).connect(this.dIn);
    node.connect((this.sendR[k] = this.ctx.createGain())).connect(this.rIn);
    node.connect((this.sendB[k] = this.ctx.createGain())).connect(this.bIn);
    for (const s of [this.sendD[k], this.sendR[k], this.sendB[k]]) s.gain.value = 0;
  }

  // el ESPACIO de un universo (music/space.js), desde `at` (el 1 del compás en que nace).
  // `first`: al montar el audio, todo al momento (aún no suena nada)
  set(S, at, stepDur, first = false) {
    const now = this.ctx.currentTime;
    at = Math.max(at, now);
    this.S = S;
    const put = (p, v, tc = 0.05) => (first ? (p.value = v) : p.setTargetAtTime(v, at, tc));
    const D = S.dly;
    for (const k in this.sendD) put(this.sendD[k].gain, this.sendLevel('dly', k));
    for (const k in this.sendR) put(this.sendR[k].gain, this.sendLevel('rev', k));
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
    this.room.set(S.rev, at, first);
    // FONDO: envíos, filtros y cuánto comprime (umbral −16 a −30 dB y ratio 3 a 8 con la cola
    // subida BG_PRE; ver el constructor)
    const B = S.bg;
    for (const k in this.sendB) put(this.sendB[k].gain, this.sendLevel('bg', k));
    put(this.bHp.frequency, B.low);
    put(this.bLp.frequency, B.lp);
    const thr = -16 - 14 * B.comp, ratio = 3 + 5 * B.comp;
    put(this.bComp.threshold, thr);
    put(this.bComp.ratio, ratio);
    this.bg.set(B, at, first);
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

  // cuánto manda `k` al efecto `fx` ('dly', 'rev', 'bg') en el universo que suena (ganancia lineal)
  sendLevel(fx, k) { return this.S?.[fx].send[k] ?? 0; }

  // una perilla de ENVÍO del MIXER cambió el envío de `k` a `fx` (ya escrito en el espacio del
  // universo: ver Engine.setSend): suena ya, con una rampa corta
  updateSend(fx, k) {
    const s = this.sends[fx][k];
    if (s && this.S) s.gain.setTargetAtTime(this.sendLevel(fx, k), this.ctx.currentTime, 0.03);
  }

  // THROW: el envío al delay de `k` se abre para el golpe que suena en `t` (durante `hold` s) y
  // vuelve a lo suyo; los ecos se quedan sonando. Rampas de 5 y 30 ms: sin clics
  throwHit(k, t, hold) {
    const s = this.sendD[k];
    if (!s || !this.S) return;
    const D = this.S.dly;
    // (con su envío al delay a −∞, ni eco ni throw)
    const base = this.sendLevel('dly', k);
    if (!(base > 0)) return;
    const top = Math.max(base, Math.min(D.throwAmt, 1 / RET_GAIN.dly));
    const p = s.gain;
    const a = Math.max(this.ctx.currentTime, t - 0.006);
    p.cancelScheduledValues(a);
    p.setValueAtTime(base, a);
    p.linearRampToValueAtTime(top, a + 0.005);
    p.setValueAtTime(top, t + hold);
    p.linearRampToValueAtTime(base, t + hold + 0.03);
  }

  // calcular la sala de un universo (hasta ~30 ms la de 2 s): se hace al pulsar NUEVO UNIVERSO
  // (ver Deck.reseed), no dentro del reloj, y se guarda hasta que entra. (El fondo no carga nada)
  prepare(S) {
    this.room.prepare(S.rev);
  }
}
