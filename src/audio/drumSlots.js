// RANURAS de hats, percs y foley de un universo: cada sonido que puede sonar tiene la suya, con su
// receta (src/music/sounds.js), su grabación en el banco (soundBank.js) y sus COLAS.
//
//   hat · ohat          el hat del universo, cerrado y abierto
//   k0 … k3             los otros tipos de hat (VARIEDAD), cada uno por el canal que le toca
//   p0 … p4             los carriles de percusión, cada uno con su panoramizador fijo
//   f0 … f4             los objetos de foley, igual
//
// Un golpe = BufferSource + ganancia hacia la salida de la ranura (2 nodos). Mientras se graba
// la versión nueva de un sonido (cambió el color, mutó el carril...), suena la anterior: nunca
// hay hueco. COLAS: `self` = el siguiente golpe corta la cola del anterior; `chokes` = corta
// las colas de otras ranuras. TOPE DE VOCES: si una ranura acumula demasiadas colas, la más
// vieja se apaga (7 ms, sin clic).

import { STEREO_IN } from './dsp.js';

const MAX_VOICES = 8;
const CUT_TC = 0.007; // constante de tiempo al cortar una cola (≈ 20 ms hasta el silencio)

export class DrumSlots {
  constructor(deck) {
    this.deck = deck;
    this.slots = new Map();
    this.misses = 0; // golpes que no sonaron porque su sonido aún no estaba grabado (debería ser 0)
  }

  // audio nuevo (o rehecho): las ranuras se vuelven a montar sobre los canales nuevos
  init(ctx) {
    this.ctx = ctx;
    this.slots.clear();
  }

  // dar (o cambiar) la receta de una ranura que suena por el canal `ch`. Pide la grabación
  // al banco si no la tiene; la ranura sigue sonando con la anterior mientras tanto.
  // `src` = de dónde sale el sonido (el carril, el tipo de hat, la tónica y la escala): si
  // cambia, el sonido nuevo entra al momento. Si solo cambia el color, como mucho una vez cada
  // `gap` s (ver Deck.refreshSounds)
  set(id, ch, rec, gap = 0, src = []) {
    let s = this.slots.get(id);
    // mismo origen = solo cambió el color (puede esperar); si no, es un sonido nuevo (urgente)
    const same = !!s && s.ch === ch && s.src.length === src.length && src.every((x, i) => x === s.src[i]);
    if (s && s.ch === ch) {
      if (s.key === rec.key) { s.rec = rec; return; }
      if (same && this.ctx.currentTime - s.changed < gap) return;
    }
    if (!s || s.ch !== ch) {
      const input = this.deck.ch[ch].input;
      let out = input, panner = null;
      if (STEREO_IN.has(ch)) { // percs y foley: panorama fijo por sonido (antes, uno nuevo en cada golpe)
        panner = this.ctx.createStereoPanner();
        panner.pan.value = rec.pan;
        panner.connect(input);
        out = panner;
      }
      s?.panner?.disconnect(); // (cambio de canal: no pasa con las ranuras de hoy)
      s = { id, ch, out, panner, pan: rec.pan, rec, key: null, ready: null, asked: [], voices: [] };
      this.slots.set(id, s);
    }
    s.rec = rec;
    s.key = rec.key;
    s.src = src;
    s.changed = this.ctx.currentTime;
    // las últimas recetas pedidas: si el color cambia otra vez antes de que se grabe la anterior,
    // suena la más reciente que ya esté grabada (ver hit)
    s.asked.push(rec.key);
    if (s.asked.length > 4) s.asked.shift();
    const bank = this.deck.bank;
    if (bank.has(rec.key)) s.ready = rec.key;
    else bank.want(`${this.deck.id}:${id}`, rec.key, rec.p, !s.ready || !same);
  }

  // ¿suena (o va a sonar) esta clave en alguna ranura? El banco no la olvida
  uses(key) {
    for (const s of this.slots.values()) if (s.ready === key || s.asked.includes(key)) return true;
    return false;
  }

  // la grabación más nueva que ya existe de lo que pidió la ranura
  fresh(s, bank) {
    for (let i = s.asked.length - 1; i >= 0; i--) {
      const k = s.asked[i];
      if (k === s.ready) return;
      if (bank.has(k)) { s.ready = k; return; }
    }
  }

  cut(s, t) {
    for (const v of s.voices) if (v.end > t) { v.g.gain.setTargetAtTime(0, t, CUT_TC); v.end = Math.min(v.end, t + 0.05); }
  }

  // un golpe de la ranura `id` en el tiempo `t` con velocidad `vel` (0..1)
  hit(id, t, vel) {
    const s = this.slots.get(id);
    const bank = this.deck.bank;
    if (s && s.key !== s.ready) this.fresh(s, bank);
    const layers = s?.ready && bank.get(s.ready);
    if (!layers) { this.misses++; return false; } // solo al arrancar, mientras se graba la primera vez
    const tail = s.rec.tail;
    if (tail.self) this.cut(s, t);
    if (tail.chokes) for (const c of tail.chokes) { const o = this.slots.get(c); if (o) this.cut(o, t); }
    // capa: con dos (responde a la velocidad), la floja para los golpes flojos
    const row = layers[layers.length > 1 && vel < 0.62 ? 0 : layers.length - 1];
    const buf = row[(Math.random() * row.length) | 0];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vel * s.rec.gain;
    if (s.panner && s.pan !== s.rec.pan) { // el carril cambió de panorama: rampa corta (la cola anterior aún suena)
      s.pan = s.rec.pan;
      s.panner.pan.setTargetAtTime(s.pan, t, 0.004);
    }
    src.connect(g).connect(s.out);
    src.start(t);
    // voces vivas: fuera las que ya acabaron; si son demasiadas, se apaga la más vieja
    s.voices = s.voices.filter((v) => v.end > t);
    s.voices.push({ g, end: t + buf.duration });
    if (s.voices.length > MAX_VOICES) {
      const v = s.voices.shift();
      v.g.gain.setTargetAtTime(0, t, CUT_TC);
    }
    return true;
  }
}
