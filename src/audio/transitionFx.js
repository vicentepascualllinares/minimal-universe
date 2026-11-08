// Reproduce el plan de una TRANSICIÓN (music/transitions.js) sobre un universo.
//
// El viaje se mide en pasos de la rejilla (T.startStep, 16 por compás):
//   step(n, t)   — en cada paso programado: redobles, reverse, silencio, llegada.
//                  Exacto a la muestra. En un viaje DE GOLPE, la llegada es el DROP.
//   update(now)  — a ritmo de control: lo sostenido (riser, filtros de tensión).
// Si el viaje se cancela (otra escena, LOOP) todo se apaga.

import * as FX from './fx.js';
import { planTransition, varyPalette } from '../music/transitions.js';
import { degreeToSemis } from '../music/emotion.js';
import { glide } from './dsp.js';

const FX_LEVEL = 0.5; // nivel del bus de transiciones respecto a los instrumentos

export class TransitionFx {
  // `filters` = { hp, lp, gap }: los nodos de tensión del universo (entre su suma y su salida)
  constructor(deck, ctx, out, filters) {
    this.deck = deck;
    this.ctx = ctx;
    this.f = filters;
    this.bus = ctx.createGain();
    // × el VOLUMEN DE FX del universo (fader en su columna TRANSICIÓN y en el MIXER)
    this.bus.gain.value = FX_LEVEL * (deck.engine.fxGain?.[deck.engine.decks.indexOf(deck)] ?? 1);
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
    this.plan = P;
  }

  // REDOBLE: un golpe con la voz de la paleta o con la PROPIA (el clap del universo)
  hit(P, t, vel, q) {
    const E = this.engine;
    if (P.pal.roll === 'self') FX.selfHit(this.ctx, this.bus, t, vel, P.pal, q, this.deck.e.clap, E.noise);
    else FX.rollHit(this.ctx, this.bus, t, vel, P.pal, q, E.noise);
  }

  // RISER TONAL: la nota que toca en el avance q, por la escala del momento (dos octavas
  // sobre la tónica del kick + las de la paleta), subiendo según el arpegio de la variación
  arpFreq(P, q) {
    const E = this.engine;
    const n = E.scale.steps.length;
    // grados que recorre: lo que sube el riser de la paleta (7 … 24 semitonos ≈ 4 … 14 grados)
    // escala: grado a grado · acorde: la tríada de la escala · quintas: tónica y quinta.
    // Cambia por qué notas pasan; acorde y quintas recorren al menos octava y media (si no, con
    // una paleta que sube poco, eran 3 notas repetidas)
    const pat = P.pal.arp === 'acorde' ? [0, 2, 4] : P.pal.arp === 'quintas' ? [0, 4] : null;
    const top = Math.max(pat ? n + 4 : 4, Math.round((P.pal.riseSemis / 12) * n));
    const degs = [];
    for (let d = 0; d <= top; d++) if (!pat || pat.includes(d % n)) degs.push(d);
    const deg = degs[Math.min(degs.length - 1, Math.floor(q * degs.length))];
    const semis = degreeToSemis(deg, E.scale) + 12 * (P.pal.riseOct - 1);
    return Math.min(5000, E.rootHz * Math.pow(2, semis / 12));
  }

  get engine() { return this.deck.engine; }

  // VOLUMEN DE FX (1 = 0 dB = como sonaba). Solo las voces de transición (riser, redoble, golpes,
  // platos, reverse, caída): los filtros de tensión y el silencio antes del drop son la música
  setLevel(g) { glide(this.bus.gain, FX_LEVEL * g, this.ctx.currentTime, 0.02); }

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

  // golpes que caen dentro del paso k del redoble (desfases en pasos, 0 ≤ off < 1), según el
  // patrón. Intervalos en pasos de semicorchea: 4 = negra, 2 = corchea, 4/3 = tresillo de corchea
  //   acelera  la escalera de intervalos (`ladder`) según el avance q
  //   recto    semicorcheas todo el rato
  //   tresillo tresillos de corchea y, en la segunda mitad, de semicorchea
  //   fantasma semicorcheas (los acentos y los saltos los pone quien llama)
  hits(k, len, q, pat, ladder) {
    const iv = pat === 'recto' || pat === 'fantasma' ? 1
      : pat === 'tresillo' ? (q < 0.5 ? 4 / 3 : 2 / 3)
      : ladder[Math.min(ladder.length - 1, Math.floor(q * ladder.length))];
    const out = [];
    for (let j = Math.ceil(k / iv - 1e-9); j * iv < k + 1 - 1e-9; j++) out.push(j * iv - k);
    return out;
  }

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
        // TONAL: aquí solo el soplo de ruido de debajo (más flojo); las notas van en step()
        const tonal = P.pal.riser === 'tonal' && !ly.noiseOnly;
        ly.voice ||= FX.riser(this.ctx, this.bus, now, P.pal, E.rootHz, E.noise, ly.gain * P.lvl * (tonal ? 0.5 : 1), ly.noiseOnly || tonal);
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
          // RISER TONAL: notas en la rejilla que aceleran (corcheas → semicorcheas → fusas)
          if (P.pal.riser === 'tonal' && !ly.noiseOnly && u >= ly.a && u < ly.b) {
            const len = ly.b - ly.a;
            const k = n - Math.round(T.startStep + ly.a * 16);
            for (const off of this.hits(k, len, (u - ly.a) / len, 'acelera', [2, 1, 0.5])) {
              const q = Math.min(1, (u - ly.a + off / 16) / len);
              const vel = (0.08 + 0.32 * Math.pow(q, P.pal.riseCurve)) * ly.gain * P.lvl;
              FX.arpNote(ctx, this.bus, t + off * sd, this.arpFreq(P, q), vel, P.pal, q);
            }
          }
          break;
        case 'roll': {
          if (u < ly.a || u >= ly.b) break;
          const len = ly.b - ly.a;
          const q = (u - ly.a) / len;
          const k = n - Math.round(T.startStep + ly.a * 16);
          const pat = P.pal.rollPattern || 'acelera';
          const ladder = len >= 4 ? [4, 2, 1, 0.5] : len >= 1 ? [2, 1, 0.5] : [1, 0.5];
          for (const off of this.hits(k, len, q, pat, ladder)) {
            let vel = (0.3 + 0.7 * Math.pow(q, 1.3)) * ly.vel * P.lvl;
            // FANTASMAS: acento en los tiempos, el resto flojo (y alguno se salta, salvo al final)
            if (pat === 'fantasma' && (k + off) % 4 !== 0) {
              if (q < 0.75 && this.deck.fxRng.chance(0.25)) continue;
              vel *= 0.35;
            }
            this.hit(P, t + off * sd, off ? vel * 0.9 : vel, q);
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
      switch (ly.type) {
        case 'riser': ly.voice?.end(t); break;
        case 'tension': this.f.hp.frequency.setTargetAtTime(20, t, 0.004); break;
        case 'down': this.f.lp.frequency.setTargetAtTime(20000, t, beat * 0.35); break;
        case 'gap': this.f.gap.gain.setTargetAtTime(1, t, 0.002); break;
        case 'impact': // el de la variación: boom / thud / los dos, o el KICK del universo alargado
          if (P.pal.kickImpact) FX.kickImpact(ctx, this.bus, t, ly.vel * P.lvl, this.deck.e.kick, E.rootHz, E.noise);
          else FX.impact(ctx, this.bus, t, ly.vel * P.lvl, P.pal, E.rootHz, E.noise);
          break;
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
