// BANCO DE SONIDOS — hats y percs grabados una vez y reproducidos en cada golpe.
//
// Una RECETA (ver src/music/sounds.js) es un objeto de números; su CLAVE, la receta redondeada en
// texto. El banco graba cada clave UNA vez (en el Worker de bankWorker.js, con drumsynth.js) en
// unas pocas variantes y, si responde a la velocidad, en dos capas (golpe flojo y fuerte). Lo
// comparten los dos universos y sobrevive a rehacer el audio (los AudioBuffer no son de un
// contexto); solo se vacía si cambia la frecuencia de muestreo.
//
// Cada golpe = BufferSource + ganancia (2 nodos), sea cual sea el motor: por eso se pueden usar
// motores caros sin gastar más al tocar. Es la decisión de RENDIMIENTO.md §4.1 (caché compartida,
// precargar fuera del golpe, presupuesto de memoria, tope de voces en DrumSlots).
//
// Cola: en el Worker hay como mucho un trabajo a la vez; lo pendiente se guarda aquí, uno por
// DUEÑO (una ranura de sonido de un universo): si el color cambia diez veces mientras graba, solo
// se graba la última. Lo URGENTE (lo que va a sonar y aún no existe) pasa delante de los retoques
// de color (ver want). Sin Worker de módulos (navegadores viejos), graba en el hilo principal a
// trocitos.

import { renderSet } from './drumsynth.js';
import { PROFILE } from '../core/profile.js';

export const VARIANTS = 4;              // golpes distintos de un mismo sonido (el ruido cambia)
// memoria de búferes (bytes); por encima, se olvida lo que hace más que no suena. Un universo
// entero ocupa ~3–4 MB (11 sonidos × 4 variantes); el resto son colores recientes
const BUDGET = (PROFILE.lite ? 16 : 48) * 1024 * 1024;

// semilla estable de una clave: la misma receta suena siempre igual (también tras recargar)
function seedOf(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class SoundBank {
  constructor(sr) {
    this.sr = sr;
    this.cache = new Map();   // clave -> { layers: [[AudioBuffer]], bytes, used }
    this.bytes = 0;
    this.queue = new Map();   // dueño -> { key, p } (lo último que pidió)
    this.urgent = new Map();  // lo mismo, lo que pasa delante (ver want)
    this.busy = null;         // clave que se está grabando
    this.inUse = () => false; // lo pone el motor: claves que suenan ahora (no se olvidan)
    this.errors = 0;
    this.jobs = 0;
    try {
      this.worker = new Worker(new URL('./bankWorker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this.done(e.data);
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; this.busy = null; this.next(); };
    } catch {
      this.worker = null; // sin Worker de módulos: se graba aquí (ver next)
    }
  }

  has(key) { return this.cache.has(key); }
  // las capas de un sonido (o null si aún no está); marca su uso para la memoria
  get(key) {
    const c = this.cache.get(key);
    if (c) c.used = performance.now();
    return c ? c.layers : null;
  }

  // pedir un sonido para un dueño. Barato si ya está o si ya es lo que pidió. URGENTE = algo que
  // se va a tocar y aún no existe (una ranura sin grabación, un carril que cambió de sonido, el
  // universo que viene): pasa delante de los retoques de color, que pueden esperar porque
  // mientras tanto suena la versión anterior
  want(owner, key, p, urgent = false) {
    if (this.cache.has(key) || this.busy === key) { this.queue.delete(owner); this.urgent.delete(owner); return; }
    if (urgent || this.urgent.has(owner)) { this.queue.delete(owner); this.urgent.set(owner, { key, p }); }
    else this.queue.set(owner, { key, p });
    this.next();
  }

  // lo pendiente, primero lo urgente
  *pending() {
    for (const q of [this.urgent, this.queue]) for (const [owner, job] of q) yield [owner, job, q];
  }

  next() {
    if (this.busy) return;
    for (const [owner, job, q] of this.pending()) {
      q.delete(owner);
      if (this.cache.has(job.key)) continue;
      this.busy = job.key;
      this.jobs++;
      const msg = { id: this.jobs, key: job.key, p: job.p, sr: this.sr, seed: seedOf(job.key), variants: VARIANTS };
      if (this.worker) this.worker.postMessage(msg);
      else setTimeout(() => {
        try { this.done({ key: msg.key, layers: renderSet(msg.p, msg.sr, msg.seed, msg.variants) }); }
        catch (err) { this.done({ key: msg.key, error: String(err) }); }
      }, 0);
      return;
    }
  }

  done({ key, layers, error }) {
    this.busy = null;
    if (error) this.errors++;
    else if (!this.cache.has(key)) {
      let bytes = 0;
      const bufs = layers.map((row) => row.map((a) => {
        const b = new AudioBuffer({ length: a.length, sampleRate: this.sr, numberOfChannels: 1 });
        b.copyToChannel(a, 0);
        bytes += a.length * 4;
        return b;
      }));
      this.cache.set(key, { layers: bufs, bytes, used: performance.now() });
      this.bytes += bytes;
      this.trim();
    }
    this.next();
  }

  // memoria: olvidar lo que hace más que no suena hasta quedar por debajo del presupuesto
  trim() {
    if (this.bytes <= BUDGET) return;
    const old = [...this.cache.entries()].filter(([k]) => !this.inUse(k)).sort((a, b) => a[1].used - b[1].used);
    for (const [k, c] of old) {
      if (this.bytes <= BUDGET * 0.8) break;
      this.cache.delete(k);
      this.bytes -= c.bytes;
    }
  }

  dispose() { this.worker?.terminate(); this.worker = null; this.queue.clear(); this.urgent.clear(); }
}
