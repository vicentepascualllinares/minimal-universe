// CRUJIDO Y RUIDO · EL AUDIO de un universo (qué decide cada uno: music/atmos.js; cómo suena cada cosa:
// atmosSynth.js). Se crea SOLO cuando entra un universo que los lleva (Deck.syncAtmos): un universo de
// antes no crea ni un nodo (la huella de ALPHA sigue IDÉNTICA).
//
// Cuatro canales (CRUJIDO 1 y 2, RUIDO 1 y 2), cada uno con UNA capa:
//   una CAMA     (vinilo, lluvia, fuego, cinta, sala, viento, ciudad): un bucle grabado
//   los PÁJAROS  cantos sueltos, cada especie en su sitio del panorama
//   el DRON      osciladores en vivo, en la escala del universo (sigue a la tónica)
// canal: entrada → PRESENCIA (la estructura: lo crujiente mucho, el ruido poco) → ENTRA Y SALE (la 3.ª y
// la 4.ª capa) → MIXER (fader, MUTE, SOLO) → suma del universo, y envíos a la REVERB y al FONDO (los
// sonidos de lugar; vinilo, cinta y sala, secos). Por la suma pasan por la saturación del universo, los
// filtros de las transiciones y el HUECO ANTES DEL KICK, como todo lo demás.
//
// Las camas se graban en un Worker (atmosWorker.js; 0,1–5 s): mientras, no suenan y luego entran con un
// fundido. Las comparte el motor (AtmosRenderer: lo mismo no se graba dos veces).

import { ATMOS_SR, renderLayer, renderSong } from './atmosSynth.js';
import { ATMOS_CH, TRIM, BED, crunchGain, noiseGain } from '../music/atmos.js';
import { degreeToSemis } from '../music/emotion.js';
import { fixChannels } from './dsp.js';
import { Rng } from '../core/rng.js';
import { PROFILE } from '../core/profile.js';

export { ATMOS_CH };
// muestras de cada bucle (a 32 kHz): 16,4 s; lluvia, viento y ciudad, 32,8 s (que no se note que se
// repiten). En móvil, todas de 16,4 s (memoria)
const LONG = { lluvia: true, viento: true, ciudad: true };
const lenOf = (kind) => (LONG[kind] && !PROFILE.lite ? 1 << 20 : 1 << 19);
const layerSeed = (A, i) => (A.seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
const SONG_VARIANTS = 3;
const FADE_IN = 1.5, FADE_OUT = 2; // s
const db = (x) => Math.pow(10, x / 20);

// ───────────────────────── GRABAR (compartido por el motor)
export class AtmosRenderer {
  constructor() {
    this.cache = new Map(); // clave → Promise<AudioBuffer | null>
    this.jobs = new Map();
    this.id = 0;
    try {
      this.worker = new Worker(new URL('./atmosWorker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this.done(e.data);
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; };
    } catch { this.worker = null; }
  }
  // `kind` = la capa ('vinilo', 'lluvia'...) o 'song'. Lo mismo pedido dos veces se graba una
  get(kind, P, N, seed, v = 0) {
    const key = `${kind}|${N}|${seed}|${v}|${JSON.stringify(P)}`;
    let p = this.cache.get(key);
    if (p) { this.cache.delete(key); this.cache.set(key, p); return p; } // (el más reciente, al final)
    p = new Promise((resolve) => {
      const id = ++this.id;
      this.jobs.set(id, resolve);
      const msg = { id, kind, P, N, seed, v };
      if (this.worker) this.worker.postMessage(msg);
      else setTimeout(() => { // sin Worker de módulos: aquí (para el hilo un momento, una vez por capa)
        try { this.done({ id, chans: kind === 'song' ? [renderSong(P, v)] : renderLayer(kind, P, N, seed).out }); }
        catch (err) { this.done({ id, error: String(err) }); }
      }, 0);
    });
    this.cache.set(key, p);
    // memoria: las camas pesan 4–8 MB; se guardan las 8 últimas (dos universos de 4 capas) y 60 cantos
    const beds = [...this.cache.keys()].filter((k) => !k.startsWith('song'));
    if (beds.length > 8) this.cache.delete(beds[0]);
    const songs = [...this.cache.keys()].filter((k) => k.startsWith('song'));
    if (songs.length > 60) this.cache.delete(songs[0]);
    return p;
  }
  done({ id, chans, error }) {
    const resolve = this.jobs.get(id);
    this.jobs.delete(id);
    if (!resolve) return;
    if (error || !chans) { if (error) console.warn('CRUJIDO / RUIDO:', error); return resolve(null); }
    const b = new AudioBuffer({ length: chans[0].length, numberOfChannels: chans.length, sampleRate: ATMOS_SR });
    chans.forEach((a, c) => b.copyToChannel(a, c));
    resolve(b);
  }
  bed(A, i) { const L = A.layers[i]; return this.get(L.kind, L.P, lenOf(L.kind), layerSeed(A, i)); }
  song(A, sp, v) { return this.get('song', sp, 0, 0, (A.seed + Math.round(sp.every * 1000) + v * 7919) >>> 0); }
  // pedir ya lo de un universo que va a entrar (que esté grabado cuando entre)
  prefetch(A) {
    A?.layers.forEach((L, i) => {
      if (BED[L.kind]) this.bed(A, i);
      if (L.kind === 'pajaros') for (const sp of L.P.species) for (let v = 0; v < SONG_VARIANTS; v++) this.song(A, sp, v);
    });
  }
}

// ───────────────────────── UN CANAL (ligero: sin saturación ni filtros de transición propios)
class AtmosChannel {
  constructor(ctx, dest) {
    this.input = fixChannels(ctx.createGain(), 2);
    this.fade = ctx.createGain();  // presencia en la estructura
    this.fade.gain.value = 0;
    this.gate = ctx.createGain();  // ENTRA Y SALE (la 3.ª y la 4.ª capa)
    this.user = ctx.createGain();  // MIXER: fader, MUTE y SOLO
    this.out = ctx.createGain();
    this.level = 1;
    this.input.connect(this.fade).connect(this.gate).connect(this.user).connect(this.out).connect(dest);
  }
}

// ───────────────────────── EL AUDIO DE UN UNIVERSO
export class Atmos {
  constructor(deck) {
    this.deck = deck;
    this.ctx = deck.ctx;
    const E = deck.engine;
    this.R = E.atmosRenderer ||= new AtmosRenderer();
    this.ch = {};
    for (const k of ATMOS_CH) {
      this.ch[k] = new AtmosChannel(this.ctx, deck.sum);
      this.ch[k].user.gain.value = E.instGain(deck, k);
      deck.spaceFx.wire(k, this.ch[k].out); // (cuánto manda cada uno: space.js, según su sonido)
      for (const fx of ['dly', 'rev', 'bg']) deck.spaceFx.updateSend(fx, k);
    }
    this.A = null;     // lo que suena (la receta de music/atmos.js)
    this.L = [];       // sus capas, con lo grabado: { ...capa, buf, bufs, next }
    this.voices = [];  // lo que suena: { src | oscs, g }
    this.playing = false;
    this.p = -1;
    this.barN = 0;
  }

  // entra otro universo (en `t0`, el 1 de su compás): lo de antes se va con un fundido y lo nuevo entra
  // en cuanto esté grabado. `A` = null: el universo nuevo no lleva (se queda en silencio)
  set(A, t0) {
    if (A === this.A) return;
    const at = Math.max(t0, this.ctx.currentTime);
    this.fadeOutAll(at, FADE_OUT);
    this.A = A;
    this.L = [];
    this.barN = 0;
    if (!A) return;
    this.rng = new Rng((A.seed ^ 0x6b43a9b5) >>> 0);
    const mine = () => this.A === A;
    this.L = A.layers.map((layer) => ({ ...layer, buf: null, bufs: [], next: null }));
    this.L.forEach((Ly, i) => {
      if (BED[Ly.kind]) this.R.bed(A, i).then((b) => { if (mine() && b) { Ly.buf = b; this.startBed(Ly, b); } });
      if (Ly.kind === 'pajaros') for (const sp of Ly.P.species) {
        const B = { sp, bufs: [], next: null };
        (Ly.birds ||= []).push(B);
        for (let v = 0; v < SONG_VARIANTS; v++) this.R.song(A, sp, v).then((b) => { if (mine() && b) B.bufs.push(b); });
      }
    });
    this.gates(at, true);
    if (this.playing) for (const Ly of this.L) if (Ly.kind === 'dron') this.startDrone(Ly, at);
  }

  // empieza a sonar (GENERAR / seguir): lo grabado, con un fundido corto
  play(t) {
    if (this.playing) return;
    this.playing = true;
    this.p = -1;
    for (const Ly of this.L) {
      if (Ly.buf) this.startBed(Ly, Ly.buf, t, 0.3);
      if (Ly.kind === 'dron') this.startDrone(Ly, t);
      for (const B of Ly.birds ?? []) B.next = null;
    }
  }
  // pausa: todo fuera (rápido, sin clic)
  stop(at) {
    this.playing = false;
    this.p = -1;
    this.fadeOutAll(at, 0.25);
  }

  // una CAMA en su canal, con el recorte de su sonido (TRIM)
  startBed(Ly, buf, t = this.ctx.currentTime, fade = FADE_IN) {
    if (!buf || !this.playing) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.ch[Ly.ch].input);
    const at = Math.max(t, ctx.currentTime);
    src.start(at, this.rng.next() * buf.duration); // (desde un sitio cualquiera del bucle)
    g.gain.setTargetAtTime(db(TRIM[Ly.kind] ?? 0), at, fade / 3);
    this.voices.push({ srcs: [src], g });
  }

  // el DRON: dos notas de la escala del universo (la tónica y su `second`), cada una con dos osciladores
  // desafinados ±cents/2 (el latido: 5 cents a 100 Hz ≈ 0,3 Hz) a los dos lados, por un paso bajo que
  // respira con un LFO lento (0,05–0,12 Hz)
  startDrone(Ly, at) {
    const D = Ly.P;
    if (Ly.drone || !this.playing) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = D.cutoff;
    filter.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = D.lfo;
    const lfoG = ctx.createGain();
    lfoG.gain.value = D.cutoff * D.depth;
    lfo.connect(lfoG).connect(filter.frequency);
    filter.connect(out).connect(this.ch[Ly.ch].input);
    const notes = D.second === null ? [0] : [0, D.second];
    const oscs = [];
    // el RMS del dron, a la altura de una cama (−24 dBFS); triángulo: RMS = pico/√3
    const n = notes.length * 2, crest = D.wave === 'triangle' ? Math.sqrt(3) : Math.SQRT2;
    const a = db(-24) * crest / Math.sqrt(n) * 1.6; // (×1,6: lo que quita el paso bajo)
    for (const deg of notes) for (const side of [-1, 1]) {
      const o = ctx.createOscillator();
      o.type = D.wave;
      o.detune.value = side * D.cents / 2;
      const p = ctx.createStereoPanner();
      p.pan.value = side * 0.35;
      const g = ctx.createGain();
      g.gain.value = a * (deg ? 0.7 : 1);
      o.connect(g).connect(p).connect(filter);
      oscs.push({ o, deg });
    }
    Ly.drone = { oscs, root: null, scale: null };
    this.tuneDrone(Ly, at, true);
    const srcs = [...oscs.map((x) => x.o), lfo];
    for (const x of srcs) x.start(at);
    out.gain.setTargetAtTime(db(TRIM.dron ?? 0), at, FADE_IN / 3);
    this.voices.push({ srcs, g: out, drone: Ly });
  }
  // el dron sigue a la tónica y al modo del universo (deslizando, como una cinta)
  tuneDrone(Ly, now, first = false) {
    const Dr = Ly.drone;
    if (!Dr) return;
    const E = this.deck.engine, root = E.rootHz, sc = E.scale;
    if (Dr.root === root && Dr.scale === sc) return;
    Dr.root = root; Dr.scale = sc;
    for (const { o, deg } of Dr.oscs) {
      const f = root * Math.pow(2, Ly.P.oct + degreeToSemis(deg, sc) / 12);
      if (first) o.frequency.value = f;
      else o.frequency.setTargetAtTime(f, now, 0.6);
    }
  }

  // control (≈50 Hz): la PRESENCIA sigue a la estructura (lo crujiente mucho, el ruido poco)
  update(now) {
    const p = this.playing ? this.deck.arr.cur.atm ?? 0.5 : -1;
    if (Math.abs(p - this.p) > 1e-3) {
      this.p = p;
      for (const k of ATMOS_CH) {
        const g = p < 0 ? 0 : k.startsWith('cr') ? crunchGain(p) : noiseGain(p);
        this.ch[k].fade.gain.setTargetAtTime(g, now, p < 0 ? 0.1 : 0.4);
      }
    }
    for (const Ly of this.L) if (Ly.drone) this.tuneDrone(Ly, now);
  }

  // ENTRA Y SALE: la 3.ª y la 4.ª capa, tantos compases dentro y tantos fuera (fundido de ~4 compases)
  gates(t, now = false, barDur = 2) {
    for (const Ly of this.L) {
      const G = Ly.gate, on = !G || (this.barN + G.at) % (G.on + G.off) < G.on;
      if (Ly.on === on && !now) continue;
      Ly.on = on;
      const g = this.ch[Ly.ch].gate.gain;
      if (now) { g.cancelScheduledValues(t); g.setValueAtTime(on ? 1 : 0, t); }
      else g.setTargetAtTime(on ? 1 : 0, t, barDur * 1.3);
    }
  }

  // en el 1 de cada compás: ENTRA Y SALE y los PÁJAROS. Cada especie canta cada `every` s (±40 %), en un
  // momento cualquiera del compás (no van a la rejilla), si el canal está lo bastante presente
  bar(t0, barDur) {
    if (!this.playing || !this.A) return;
    this.barN++;
    this.gates(t0, false, barDur);
    for (const Ly of this.L) for (const B of Ly.birds ?? []) {
      if (B.next === null) B.next = t0 + this.rng.float(0.2, 1) * B.sp.every;
      if (t0 + barDur < B.next) continue;
      const t = Math.max(t0, B.next) + this.rng.float(0, barDur * 0.9);
      B.next = t + B.sp.every * this.rng.float(0.6, 1.4);
      if (this.p < 0.25 || !Ly.on || !B.bufs.length) continue;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = B.bufs[(this.rng.next() * B.bufs.length) | 0];
      const g = ctx.createGain();
      g.gain.value = db((TRIM.pajaros ?? 0) + this.rng.float(-3, 1));
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, B.sp.pan + this.rng.float(-0.2, 0.2)));
      src.connect(g).connect(pan).connect(this.ch[Ly.ch].input);
      src.start(Math.max(t, ctx.currentTime));
    }
  }

  fadeOutAll(at, secs) {
    for (const V of this.voices) {
      V.g.gain.cancelScheduledValues(at);
      V.g.gain.setTargetAtTime(0, at, secs / 4);
      for (const s of V.srcs) try { s.stop(at + secs + 0.1); } catch {}
      if (V.drone) V.drone.drone = null;
    }
    this.voices = [];
  }
}
