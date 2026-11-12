// Reproduce el plan de una TRANSICIÓN (music/transitions.js) sobre un universo.
//
// El viaje se mide en pasos de la rejilla (T.startStep, 16 por compás):
//   step(n, t)   — en cada paso programado: redobles, kick que sube, golpes del shh, reverse,
//                  silencio, llegada. Exacto a la muestra. En un viaje DE GOLPE, la llegada es el DROP.
//   update(now)  — a ritmo de control: lo sostenido (riser, shh, filtros de tensión).
// Nada suena antes de que el viaje empiece a contar (u < 0: la espera de la rejilla).
// Si el viaje se cancela (otra escena, volver a pulsar) todo se apaga en unos milisegundos:
// cada capa de golpes va por su propio canal, que se cierra entero (también las colas).

import * as FX from './fx.js';
import { planTransition, varyPalette } from '../music/transitions.js';
import { glide } from './dsp.js';

// nivel del bus de transiciones: como cada instrumento, con el PICO MÁXIMO EN 0 dBFS antes de su
// fader (VOLUMEN DE FX). Medido (2026-11-10) con el nivel de antes (0,5) en 9 viajes de 4
// compases con FX en 3 universos: pico más alto −4,0 dBFS (los golpes de llegada cuando entra
// el kick). El balance lo pone el fader (presets en mix.js)
const FX_LEVEL = 0.5 / Math.pow(10, -4.0 / 20);

// ── ESCALERAS de los golpes que aceleran. Intervalos en pasos de semicorchea: 16 = uno por
// compás, 8 = blancas, 4 = negras, 2 = corcheas, 1 = semicorcheas, 0,5 = fusas.
// Cada peldaño dura la MITAD que el anterior (el último, lo mismo que el penúltimo), así que se
// estiran con el viaje: un redoble de 32 compases va 16 a golpe por compás, 8 a blancas, 4 a
// negras... y acaba en fusas. `CAP`: como mucho, cuántos compases antes del final empieza ese
// peldaño (que en uno largo los rápidos no se coman 8 compases)
const CAP = { 2: 4, 1: 1, 0.5: 0.5 };
const LADDER = [16, 8, 4, 2, 1, 0.5];
const from = (top, last = 0.5) => LADDER.slice(LADDER.indexOf(top), LADDER.indexOf(last) + 1);
// el redoble: la LÍDER empieza lenta (cuanto más largo, más); el que entra al final, en negras
const rollLadder = (len, lead) => from(lead ? (len >= 16 ? 16 : len >= 8 ? 8 : 4) : len >= 4 ? 4 : len >= 1 ? 2 : 1);
// el kick que sube: hasta semicorcheas
const kickLadder = (len) => from(len >= 16 ? 16 : len >= 8 ? 8 : 4, 1);
// el shh: en negras casi todo el viaje; corcheas y semicorcheas al final
const SHH_LADDER = [4, 2, 1];

// intervalo que toca con `left` compases por delante en una capa de `len` compases
function ivAt(q, len, ladder) {
  const left = len * (1 - q) - 1e-9;
  let k = 0;
  for (let i = 1; i < ladder.length; i++) if (left < Math.min(len / 2 ** i, CAP[ladder[i]] ?? Infinity)) k = i;
  return ladder[k];
}

// golpes que caen dentro del paso k (contado desde que empieza el viaje) en la rejilla de
// intervalo `iv`, desplazada `shift` pasos: desfases dentro del paso (0 ≤ off < 1)
function hits(k, iv, shift = 0) {
  const out = [];
  for (let j = Math.ceil((k - shift) / iv - 1e-9); j * iv + shift < k + 1 - 1e-9; j++) out.push(j * iv + shift - k);
  return out;
}

// volumen con el que empieza lo sostenido (0..1 del final): los viajes largos ya se oyen al empezar
// (2026-11-12, medido en la app: con 0,2 un riser de 8 empezaba 27 dB por debajo de la llegada y
// no se oía; con 0,4, ~8 dB por debajo de su final)
const floorFor = (len) => (len >= 8 ? 0.4 : len >= 4 ? 0.2 : 0.04);
// capas que suenan a la vez al final: con 3 o más, cada una algo más baja (que la suma no pase de pico)
const STACKED = ['riser', 'shh', 'roll', 'kick'];

export class TransitionFx {
  // `filters` = { hp, lp, gap }: los nodos de tensión del universo (entre su suma y su salida)
  constructor(deck, ctx, out, filters) {
    this.deck = deck;
    this.ctx = ctx;
    this.f = filters;
    this.bus = ctx.createGain();
    // × el VOLUMEN DE FX del universo (fader en su columna TRANSICIÓN y en el MIXER)
    this.bus.gain.value = FX_LEVEL * deck.engine.fxLevel(deck); // (con el MUTE / SOLO del MIXER)
    this.bus.connect(out);
    this.plan = null;
    this.live = []; // reverses en curso (se pueden cortar)
    this.recent = []; // VARIACIÓN: las últimas combinaciones (no se repiten; ver varyPalette)
  }

  // sin efectos (FX apagado o nada que contar) el plan va vacío: solo marca la llegada,
  // para que un viaje instantáneo caiga exacto en su tiempo.
  // Cada transición con efectos tira su propia variación de la paleta (ver varyPalette)
  start(T, kind, pal, rng, cut = false) {
    this.cancel(this.ctx.currentTime);
    const v = kind === 'none' ? pal : varyPalette(pal, rng, this.recent);
    const P = planTransition(kind, T.bars, v, rng, cut) || { kind: 'none', L: T.bars, layers: [], arrived: false };
    P.T = T;
    P.pal = v;
    P.lvl = 0.6 + 0.4 * pal.amount;
    if (P.layers.filter((ly) => STACKED.includes(ly.type)).length >= 3) {
      for (const ly of P.layers) {
        if (!STACKED.includes(ly.type)) continue;
        if (ly.gain) ly.gain *= 0.8;
        if (ly.vel) ly.vel *= 0.8;
      }
    }
    this.plan = P;
  }

  // REDOBLE: un golpe con la voz de la paleta o con la PROPIA (el clap del universo)
  hit(P, out, t, vel, q) {
    const E = this.engine;
    if (P.pal.roll === 'self') FX.selfHit(this.ctx, out, t, vel, P.pal, q, this.deck.e.clap, E.noise);
    else FX.rollHit(this.ctx, out, t, vel, P.pal, q, E.noise);
  }

  // el CANAL de una capa de golpes (redoble, kick): todo lo suyo pasa por él, colas incluidas,
  // para poder cerrarlo entero si el viaje se cancela
  lane(ly) {
    if (!ly.lane) {
      ly.lane = this.ctx.createGain();
      ly.lane.connect(this.bus);
    }
    return ly.lane;
  }

  // soltar el canal: `fade` = cerrarlo ya (cancelado); si no, que suenen las colas
  dropLane(ly, at, fade) {
    const g = ly.lane;
    if (!g) return;
    ly.lane = null;
    if (fade) {
      g.gain.cancelScheduledValues(at);
      g.gain.setTargetAtTime(0, at, 0.03);
    }
    const wait = Math.max(0, at - this.ctx.currentTime) + (fade ? 0.4 : 4);
    setTimeout(() => g.disconnect(), wait * 1000);
  }

  get engine() { return this.deck.engine; }

  // VOLUMEN DE FX (1 = 0 dB = como sonaba). Solo las voces de transición (riser, shh, redoble,
  // kick, golpes, platos, reverse, caída): los filtros de tensión y el silencio antes del drop son
  // la música (`at` = desde cuándo; por defecto, ya)
  setLevel(g, at = this.ctx.currentTime) { glide(this.bus.gain, FX_LEVEL * g, Math.max(at, this.ctx.currentTime), 0.02); }

  // MIXER: pico de lo que suenan ahora los efectos (el medidor se crea la primera vez)
  level() {
    if (!this.meter) {
      this.meter = this.ctx.createAnalyser();
      this.meter.fftSize = 256;
      this.meterBuf = new Float32Array(256);
      this.bus.connect(this.meter);
    }
    this.meter.getFloatTimeDomainData(this.meterBuf);
    let p = 0;
    for (const v of this.meterBuf) p = Math.max(p, Math.abs(v));
    return p;
  }

  // a ritmo de control: riser, shh y filtros siguen al progreso del viaje
  update(now, pos) {
    const P = this.plan;
    if (!P) return;
    const T = P.T;
    if (this.deck.arr.travel !== T) return this.cancel(now); // otra escena
    if (T.paused || pos === null) return;
    const u = (pos - T.startStep) / 16;
    const E = this.engine;
    for (const ly of P.layers) {
      if (u < ly.a || u >= ly.b) continue;
      const len = ly.b - ly.a;
      const q = (u - ly.a) / len;
      if (ly.type === 'riser') {
        if (ly.ended) continue;
        if (!ly.voice) {
          // los largos empiezan ya audibles y crecen más parejo (no todo se guarda para el final)
          const p = { ...P.pal, riseFloor: floorFor(len), riseCurve: len >= 8 ? Math.min(P.pal.riseCurve, 1.6) : P.pal.riseCurve };
          ly.voice = FX.riser(this.ctx, this.bus, now, p, E.rootHz, E.noise, ly.gain * P.lvl, ly.noiseOnly);
        }
        ly.voice.set(q, now);
      } else if (ly.type === 'shh') {
        if (!ly.ended) ly.voice?.set(q, now); // (la voz nace en step, en su golpe)
      } else if (ly.type === 'tension') {
        glide(this.f.hp.frequency, 20 * Math.pow(P.pal.tensionHz / 20, Math.pow(q, 1.5)), now, 0.06);
      } else if (ly.type === 'down') {
        glide(this.f.lp.frequency, 20000 * Math.pow(P.pal.downHz / 20000, Math.pow(q, 1.3)), now, 0.06);
      }
    }
  }

  // en cada paso de la rejilla (antes de que el universo programe sus notas)
  step(n, t) {
    const P = this.plan;
    if (!P || P.arrived) return;
    const T = P.T;
    if (this.deck.arr.travel !== T || T.paused) return;
    const k = n - T.startStep; // pasos desde que empezó a contar el viaje
    const u = k / 16;
    if (u < 0) return;
    const E = this.engine;
    const ctx = this.ctx;
    const sd = E.stepDur;
    for (const ly of P.layers) {
      const len = ly.b - ly.a;
      const inside = u >= ly.a && u < ly.b;
      const q = (u - ly.a) / len;
      const qAt = (off) => Math.min(1, (u + off / 16 - ly.a) / len);
      switch (ly.type) {
        case 'riser':
          if (ly.voice && !ly.ended && u >= ly.b) { ly.voice.end(t); ly.ended = true; }
          break;
        case 'shh': {
          if (ly.voice && !ly.ended && u >= ly.b) { ly.voice.end(t); ly.ended = true; }
          if (!inside || ly.ended) break;
          ly.voice ||= FX.shh(ctx, this.bus, t, P.pal, E.noise, ly.gain * P.lvl, floorFor(len) + 0.05, len >= 8 ? 1.5 : 1.8);
          const iv = ivAt(q, len, SHH_LADDER);
          // CONTRA: a contratiempo (en semicorcheas ya no hay contratiempo: todos)
          const shift = P.pal.shh === 'contra' && iv >= 2 ? iv / 2 : 0;
          for (const off of hits(k, iv, shift)) ly.voice.hit(t + off * sd, iv * sd);
          break;
        }
        case 'roll': {
          if (!inside) break;
          const pat = ly.pat || 'acelera';
          const iv = pat === 'recto' || pat === 'fantasma' ? 1
            : pat === 'tresillo' ? (q < 0.5 ? 4 / 3 : 2 / 3)
            : ivAt(q, len, rollLadder(len, ly.lead));
          for (const off of hits(k, iv)) {
            const qh = qAt(off);
            let vel = (0.3 + 0.7 * Math.pow(qh, 1.3)) * ly.vel * P.lvl;
            // FANTASMAS: acento en los tiempos, el resto flojo (y alguno se salta, salvo al final)
            if (pat === 'fantasma' && (k + off) % 4 !== 0) {
              if (qh < 0.75 && this.deck.fxRng.chance(0.25)) continue;
              vel *= 0.35;
            }
            this.hit(P, this.lane(ly), t + off * sd, off ? vel * 0.9 : vel, qh);
          }
          break;
        }
        case 'kick': { // KICK QUE SUBE: el del universo, en su NOTA, subiendo hasta el último golpe
          if (!inside) break;
          const iv = ivAt(q, len, kickLadder(len));
          const hz = this.deck.kickNote().hz;
          for (const off of hits(k, iv)) {
            const qh = qAt(off);
            const f = hz * Math.pow(2, (P.pal.kickRise * Math.pow(qh, 1.4)) / 12);
            // (medido: un build DE GOLPE de 8 con kick, riser y redoble pica a −1 dBFS antes del fader con 0,55)
            const vel = (0.3 + 0.7 * Math.pow(qh, 1.2)) * 0.48 * ly.gain * P.lvl;
            FX.kickRise(ctx, this.lane(ly), t + off * sd, vel, this.deck.e.kick, f, qh, iv * sd, E.noise);
          }
          break;
        }
        case 'reverse':
          if (!ly.started && u >= ly.a) {
            ly.started = true;
            const dur = (ly.b - u) * 16 * sd;
            if (dur > 0.05) this.live.push(FX.reverse(ctx, this.bus, t, dur, ly.vel * P.lvl * 0.75, P.pal, E.noise));
          }
          break;
        case 'gap':
          if (!ly.started && u >= ly.a) {
            ly.started = true;
            this.f.gap.gain.setTargetAtTime(0, t, 0.004);
          }
          break;
      }
    }
    if (u >= P.L) this.arrive(t);
  }

  // LLEGADA: corta lo sostenido, suelta los filtros, golpes y (DE GOLPE) DROP
  arrive(t) {
    const P = this.plan;
    const T = P.T;
    P.arrived = true;
    this.plan = null;
    const E = this.engine;
    const ctx = this.ctx;
    const beat = E.stepDur * 4;
    for (const ly of P.layers) {
      this.dropLane(ly, t, false); // las colas del redoble y del kick suenan
      switch (ly.type) {
        case 'riser': case 'shh': ly.voice?.end(t); break;
        case 'tension': this.f.hp.frequency.setTargetAtTime(20, t, 0.004); break;
        case 'down': this.f.lp.frequency.setTargetAtTime(20000, t, beat * 0.35); break;
        case 'gap': this.f.gap.gain.setTargetAtTime(1, t, 0.002); break;
        case 'impact': { // el de la variación: boom / thud / los dos, o el KICK del universo alargado.
          // Afinado en la NOTA del kick (tune.js; por defecto, la tónica)
          const kHz = this.deck.kickNote().hz;
          if (P.pal.kickImpact) FX.kickImpact(ctx, this.bus, t, ly.vel * P.lvl, this.deck.e.kick, kHz, E.noise);
          else FX.impact(ctx, this.bus, t, ly.vel * P.lvl, P.pal, kHz, E.noise);
          break;
        }
        case 'crash': FX.crash(ctx, this.bus, t, ly.vel * P.lvl * 0.8, P.pal, E.noise); break;
        case 'downlifter': FX.downlifter(ctx, this.bus, t, ly.bars * E.barDur, ly.vel * P.lvl * 0.7, P.pal, E.noise); break;
      }
    }
    if (T.drop || T.bars === 0) this.deck.land(t);
    this.live = this.live.filter((v) => v.end > ctx.currentTime);
  }

  // PAUSA del transporte: se apaga lo que suena; el plan sigue (riser y shh vuelven al tocar)
  kill(at) {
    const P = this.plan;
    if (P) {
      for (const ly of P.layers) {
        if (ly.voice && !ly.ended) { ly.voice.kill(at); ly.voice = null; }
        this.dropLane(ly, at, true);
      }
    }
    for (const v of this.live) v.kill(at);
    this.live = [];
    // el silencio antes del drop se programa por adelantado (hasta ~0,12 s). Si se corta
    // justo entre programarlo y que suene, "volver a 1" quedaba ANTES que "bajar a 0" y
    // el universo se quedaba mudo hasta la siguiente transición. Se borra lo pendiente.
    this.f.gap.gain.cancelScheduledValues(at);
    this.f.gap.gain.setTargetAtTime(1, at, 0.02);
  }

  // pausa del viaje (pulsar la misma esquina): se apaga lo que suena; al seguir, vuelve
  pause(at) { this.kill(at); }

  // viaje cancelado: fuera todo, filtros a cero
  cancel(at) {
    this.kill(at);
    this.plan = null;
    glide(this.f.hp.frequency, 20, at, 0.08);
    glide(this.f.lp.frequency, 20000, at, 0.08);
  }
}
