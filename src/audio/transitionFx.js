// Reproduce el plan de una TRANSICIÓN (music/transitions.js) sobre un universo.
//
// El viaje se mide en pasos de la rejilla (T.startStep, 16 por compás):
//   step(n, t)   — en cada paso programado: redobles, reverse, silencio, llegada.
//                  Exacto a la muestra. La llegada es el DROP del build.
//   update(now)  — a ritmo de control: lo sostenido (riser, filtros de tensión).
// Si el viaje se cancela (otra escena, LOOP) todo se apaga.

import * as FX from './fx.js';
import { planTransition } from '../music/transitions.js';
import { glide } from './dsp.js';

const FX_LEVEL = 0.5; // nivel del bus de transiciones respecto a los instrumentos

export class TransitionFx {
  // `filters` = { hp, lp, gap }: los nodos de tensión del universo (entre su suma y su salida)
  constructor(deck, ctx, out, filters) {
    this.deck = deck;
    this.ctx = ctx;
    this.f = filters;
    this.bus = ctx.createGain();
    this.bus.gain.value = FX_LEVEL;
    this.bus.connect(out);
    this.plan = null;
    this.live = []; // reverses en curso (se pueden cortar)
  }

  // sin efectos (FX apagado o nada que contar) el plan va vacío: solo marca la llegada,
  // para que un viaje instantáneo caiga exacto en su tiempo
  start(T, kind, pal, rng) {
    this.cancel(this.ctx.currentTime);
    const P = planTransition(kind, T.bars, pal, rng) || { kind: 'none', L: T.bars, layers: [], arrived: false };
    P.T = T;
    P.pal = pal;
    P.lvl = 0.6 + 0.4 * pal.amount;
    this.plan = P;
  }

  get engine() { return this.deck.engine; }

  // a ritmo de control: riser y filtros siguen al progreso del viaje
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
      const q = (u - ly.a) / (ly.b - ly.a);
      if (ly.type === 'riser') {
        if (ly.ended) continue;
        ly.voice ||= FX.riser(this.ctx, this.bus, now, P.pal, E.rootHz, E.noise, ly.gain * P.lvl, ly.noiseOnly);
        ly.voice.set(q, now);
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
    const u = (n - T.startStep) / 16;
    if (u < 0) return;
    const E = this.engine;
    const ctx = this.ctx;
    const sd = E.stepDur;
    for (const ly of P.layers) {
      switch (ly.type) {
        case 'riser':
          if (ly.voice && !ly.ended && u >= ly.b) { ly.voice.end(t); ly.ended = true; }
          break;
        case 'roll': {
          if (u < ly.a || u >= ly.b) break;
          const len = ly.b - ly.a;
          const q = (u - ly.a) / len;
          // acelera: negras → corcheas → semicorcheas → fusas
          const ladder = len >= 4 ? [4, 2, 1, 0.5] : len >= 1 ? [2, 1, 0.5] : [1, 0.5];
          const iv = ladder[Math.min(ladder.length - 1, Math.floor(q * ladder.length))];
          const k = n - Math.round(T.startStep + ly.a * 16);
          if (iv >= 1 && k % iv !== 0) break;
          const vel = (0.3 + 0.7 * Math.pow(q, 1.3)) * ly.vel * P.lvl;
          FX.rollHit(ctx, this.bus, t, vel, P.pal, q, E.noise);
          if (iv === 0.5) FX.rollHit(ctx, this.bus, t + sd / 2, vel * 0.9, P.pal, q, E.noise);
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

  // LLEGADA: corta lo sostenido, suelta los filtros, golpes y (build) DROP
  arrive(t) {
    const P = this.plan;
    const T = P.T;
    P.arrived = true;
    this.plan = null;
    const E = this.engine;
    const ctx = this.ctx;
    const beat = E.stepDur * 4;
    for (const ly of P.layers) {
      switch (ly.type) {
        case 'riser': ly.voice?.end(t); break;
        case 'tension': this.f.hp.frequency.setTargetAtTime(20, t, 0.004); break;
        case 'down': this.f.lp.frequency.setTargetAtTime(20000, t, beat * 0.35); break;
        case 'gap': this.f.gap.gain.setTargetAtTime(1, t, 0.002); break;
        case 'impact': FX.impact(ctx, this.bus, t, ly.vel * P.lvl, P.pal, E.rootHz, E.noise); break;
        case 'crash': FX.crash(ctx, this.bus, t, ly.vel * P.lvl * 0.8, P.pal, E.noise); break;
        case 'downlifter': FX.downlifter(ctx, this.bus, t, ly.bars * E.barDur, ly.vel * P.lvl * 0.7, P.pal, E.noise); break;
      }
    }
    if (T.drop || T.bars === 0) this.deck.land(t);
    this.live = this.live.filter((v) => v.end > ctx.currentTime);
  }

  // PAUSA del transporte: se apaga lo que suena; el plan sigue (el riser vuelve al tocar)
  kill(at) {
    const P = this.plan;
    if (P) for (const ly of P.layers) if (ly.voice && !ly.ended) { ly.voice.kill(at); ly.voice = null; }
    for (const v of this.live) v.kill(at);
    this.live = [];
    // el silencio antes del drop se programa por adelantado (hasta ~0,12 s). Si se corta
    // justo entre programarlo y que suene, "volver a 1" quedaba ANTES que "bajar a 0" y
    // el universo se quedaba mudo hasta la siguiente transición. Se borra lo pendiente.
    this.f.gap.gain.cancelScheduledValues(at);
    this.f.gap.gain.setTargetAtTime(1, at, 0.02);
  }

  // pausa del viaje (pulsar la misma esquina): se apaga lo que suena; al seguir, el riser vuelve
  pause(at) { this.kill(at); }

  // viaje cancelado: fuera todo, filtros a cero
  cancel(at) {
    this.kill(at);
    this.plan = null;
    glide(this.f.hp.frequency, 20, at, 0.08);
    glide(this.f.lp.frequency, 20000, at, 0.08);
  }
}
