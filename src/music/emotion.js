// MODELO DE EMOCIÓN
// Basado en el modelo circumplejo del afecto (Russell):
//   X = valencia   (-1 oscuro / sombra   ->  +1 luminoso / cálido)
//   Y = activación (-1 quieto / hipnótico -> +1 intenso / físico)
// Esquinas:  TENSIÓN (-,+)  EUFORIA (+,+)  ABISMO (-,-)  CALIDEZ (+,-)
//
// Nada aquí es un "parámetro de sonido" para el usuario: la emoción se traduce
// a timbre, decay, saturación, densidad, swing y armonía de cada instrumento.

import { clamp, lerp } from '../core/rng.js';

export const SCALES = [
  { name: 'frigio', steps: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'eólico', steps: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'dórico', steps: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'mixolidio', steps: [0, 2, 4, 5, 7, 9, 10] },
];

export function scaleFor(v) {
  const i = clamp(Math.floor(((v + 1) / 2) * SCALES.length), 0, SCALES.length - 1);
  return SCALES[i];
}

// grado de escala (puede ser >7 o negativo) -> semitonos
export function degreeToSemis(deg, scale) {
  const n = scale.steps.length;
  const oct = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return scale.steps[i] + 12 * oct;
}

export class EmotionState {
  constructor(v = -0.3, a = -0.25) {
    this.tv = v; this.ta = a; // objetivo (donde está el ratón)
    this.v = v; this.a = a;   // valor real (con inercia, como un sistema analógico)
    this.inertia = 2.2;       // segundos (constante de tiempo)
    // ESTILO del color (ver styleColor en styles.js): [cuánto, lo0, hi0, lo1, hi1...]. Viaja con la
    // misma inercia que el color: un universo nuevo llega a su estilo a la vez que a su color.
    // null = nunca ha habido estilo (todo como siempre)
    this.sx = null; this.tsx = null;
    this.sxMoving = false;
  }
  setTarget(v, a) { this.tv = clamp(v, -1, 1); this.ta = clamp(a, -1, 1); }
  // `x` = el color del estilo del universo nuevo (rollStyle().color), o null (NORMAL: lo que hubiera
  // se va a 0 sin mover sus rangos)
  setStyle(x) {
    if (!x) {
      if (this.tsx) { this.tsx = Float64Array.from(this.tsx); this.tsx[0] = 0; }
      return;
    }
    if (!this.sx) { this.sx = Float64Array.from(x); this.sx[0] = 0; } // venía sin estilo: solo sube el cuánto
    this.tsx = Float64Array.from(x);
  }
  // al objetivo de golpe, sin inercia (el primer universo, antes de que suene nada)
  snap() {
    this.v = this.tv; this.a = this.ta;
    if (this.tsx) this.sx = Float64Array.from(this.tsx);
    this.sxMoving = false;
  }
  update(dt) {
    const k = 1 - Math.exp(-dt / this.inertia);
    this.v += (this.tv - this.v) * k;
    this.a += (this.ta - this.a) * k;
    if (this.tsx) {
      // ¿sigue viajando? (para el banco de sonidos: grabar a menudo mientras cambia, ver refreshSounds)
      let moving = false;
      for (let i = 0; i < this.sx.length; i++) {
        const d = this.tsx[i] - this.sx[i];
        this.sx[i] += d * k;
        if (Math.abs(d) > 0.004 * (Math.abs(this.tsx[i]) + 0.01)) moving = true;
      }
      this.sxMoving = moving;
    }
  }
}

// Traducción emoción -> mundo sonoro. `drift` aporta vida lenta (-1..1).
export function mapEmotion(v, a, drift = 0) {
  const vn = (v + 1) / 2;            // 0 oscuro .. 1 luminoso
  const an = (a + 1) / 2;            // 0 quieto .. 1 intenso
  const dark = Math.max(0, -v);
  const light = Math.max(0, v);
  const tense = Math.max(0, a);
  const calm = Math.max(0, -a);
  const tension = dark * tense;      // esquina TENSIÓN
  const euphoria = light * tense;    // esquina EUFORIA
  const abyss = dark * calm;         // esquina ABISMO
  const warmth = light * calm;       // esquina CALIDEZ

  return {
    vn, an, tension, euphoria, abyss, warmth,
    // la escala es global: la decide el Engine según el universo que más suena

    groove: {
      swing: Math.min(0.58, 0.535 + 0.035 * vn + 0.02 * warmth - 0.02 * tension), // 0.5 = recto, máx. 58 %
      humanize: 0.0015 + 0.004 * (1 - an),                        // segundos
      clapNudge: 0.004 + 0.012 * (1 - an),                        // clap "tarde", relajado
    },

    kick: {
      pitchRatio: 1,                               // siempre en la tónica: nunca choca con el bajo
      punch: 2.6 + 3.2 * an + 1.2 * tension,       // caída de pitch inicial
      pitchDecay: 0.022 + 0.05 * (1 - an) + 0.02 * abyss,
      hold: 0.02 + 0.03 * calm,
      decay: 0.24 + 0.22 * (1 - an) + 0.22 * abyss - 0.06 * euphoria,
      click: 0.06 + 0.5 * an * (0.4 + 0.6 * vn) + 0.2 * tension,
      clickFreq: 2500 + 4000 * vn,
      drive: 0.06 + 0.55 * tense + 0.25 * tension + 0.1 * dark,
      duck: 0.3 + 0.25 * an,                      // sidechain al bajo: ≈ -3 dB (quieto) .. -7 dB (intenso)
    },

    clap: {
      freq: 850 + 1000 * vn + 200 * drift,
      q: 1.1 + 1.6 * tension,
      spread: 0.0075 + 0.007 * (1 - an),
      decay: 0.11 + 0.32 * (1 - an) + 0.15 * abyss,
      drive: 0.05 + 0.5 * tense,
    },

    hat: {
      base: 330 * (0.78 + 0.5 * vn) * (1 + 0.03 * drift),
      noiseMix: 0.25 + 0.6 * vn - 0.15 * tension,
      bp: 7500 + 4500 * vn,
      hp: 5200 + 3800 * vn,
      decay: 0.022 + 0.04 * (1 - an) + 0.03 * warmth + 0.006 * drift,
      accent: 0.25 + 0.6 * an,
      drive: 0.04 + 0.3 * tension,
    },

    ohat: {
      decay: 0.16 + 0.28 * vn + 0.12 * euphoria + 0.08 * abyss,
    },

    perc: {
      harmonic: clamp(vn + 0.15 * drift),    // 0 metálico/inarmónico .. 1 madera/armónico
      decayMul: lerp(1.7, 0.6, an) * (1 + 0.6 * abyss),
      pitchMul: 0.85 + 0.35 * vn,
      fmIndex: 0.6 + 2.2 * tension + 1.0 * an,
      drive: 0.03 + 0.35 * tense,
    },

    // FOLEY: objetos (papel, llaves, gota...) más brillantes o apagados y más secos o largos
    foley: {
      bright: 0.75 + 0.5 * vn,                     // multiplica los filtros y la altura
      decayMul: lerp(1.5, 0.7, an) * (1 + 0.5 * abyss),
      drive: 0.02 + 0.2 * tense,
    },

    bass: {
      cutoff: 90 + 260 * vn + 700 * an * (0.4 + 0.6 * vn) + 60 * drift,
      env: 1.2 + 3.5 * an + 2 * tension,
      res: 0.8 + 7 * tension + 2 * euphoria,
      filtDecay: 0.05 + 0.14 * (1 - an),
      release: 0.03 + 0.12 * (1 - an) + 0.08 * abyss,
      saw: 0.15 + 0.55 * an + 0.2 * tension,
      square: 0.35 * warmth + 0.2 * abyss,
      sub: 0.9 - 0.2 * an,
      detune: 3 + 10 * tension,
      drive: 0.08 + 0.55 * tense + 0.2 * dark,
      lenMul: 0.7 + 0.9 * calm,
    },

    // acordes dub: stab corto con filtro que se cierra
    chord: {
      cutoff: 280 + 1400 * vn + 1600 * an * (0.3 + 0.7 * vn) + 150 * drift,
      env: 1.5 + 3 * an + 1.5 * tension,
      res: 1 + 5 * tension + 2 * abyss,
      filtDecay: 0.04 + 0.16 * (1 - an) + 0.1 * abyss,
      decay: 0.06 + 0.2 * (1 - an),
      sustain: 0.1 + 0.3 * calm,
      release: 0.05 + 0.25 * (1 - an) + 0.2 * abyss,
      lenMul: 0.6 + 0.8 * calm,
      detune: 5 + 12 * tension + 5 * abyss,
      wave2: tension > 0.25 || euphoria > 0.4 ? 'sawtooth' : 'square',
      drive: 0.04 + 0.4 * tense + 0.15 * tension,
    },

    // pad / atmósfera: sigue a la emoción en vivo mientras suena
    pad: {
      cutoff: 260 + 1400 * vn + 900 * an + 450 * abyss + 200 * drift,
      lfo: 0.05 + 0.2 * an,                 // Hz: respiración del filtro
      lfoDepth: 0.2 + 0.35 * calm,          // fracción del corte
      attack: 0.4 + 1.6 * (1 - an) + 0.6 * abyss,
      release: 0.8 + 2.2 * (1 - an) + 1 * abyss,
      detune: 6 + 10 * tension + 6 * abyss,
      wave: vn > 0.55 ? 'triangle' : 'sawtooth',
      air: 0.03 + 0.22 * abyss + 0.08 * calm, // ruido filtrado: el "aire" de la sala
      level: 0.45 + 0.55 * calm,            // al fondo cuando es intenso
      drive: 0.02 + 0.2 * tension,
    },

    master: {
      drive: 0.05 + 0.35 * tense,
    },

  };
}
