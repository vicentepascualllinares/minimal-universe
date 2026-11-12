// PUESTOS — dónde suena cada universo (A y B) cuando hay varios MOTORES (src/motores/LEEME.md).
//
// Cada universo lo hace sonar el Deck de SU motor (generadores, sintes, transiciones, espacio: todo lo
// suyo). Un puesto tiene el Deck del universo que suena (`inner`) y, si el que espera es de otro
// motor, el Deck de ese motor ya preparado (`next`: sus sonidos grabados, su audio montado). En el 1
// del compás en que entra, el puesto pasa al Deck nuevo; el viejo suelta lo que sostiene, deja sonar
// sus colas (delay y sala) y se desconecta unos segundos después.
//
// Lo que es del INTÉRPRETE (la parte que suena y su viaje, lo que se mantiene pulsado, la forma de
// los viajes, el GLOBAL, el fader de ESTILO y la PUREZA, las perillas del PARECIDO) pasa de un Deck al
// otro: cambiar de motor no cambia lo que estás tocando. Lo que es del UNIVERSO lo pone el nuevo.
//
// El resto del programa (vista, MIXER, LOW) ve SIEMPRE el mismo objeto por puesto (un Proxy): no sabe
// de motores. Llamar a sus métodos o leer sus campos va al Deck que suena; lo del universo que espera
// (pending*, el fader de ESTILO...) al que espera, si es de otro motor.

import { installDrop } from './drop.js';

// lo del INTÉRPRETE que se mira al generar: se escribe en los dos Decks (el que suena y el que espera)
const GEN_KEYS = new Set(['styleNext', 'purityNext', 'keepSound', 'keepMusic']);
// lo del universo que espera: si espera en otro motor, se lee de ese Deck
const PENDING_KEYS = new Set(['pendingSeed', 'pendingSty', 'pendingGen', 'pendingSpace', 'pendingSnap', 'pendingGlobals',
  'styleNext', 'purityNext', 'waitStyle']);
// cuánto dejan sonar sus colas un Deck que se va (s) antes de desconectarlo
const TAIL_S = 12;
const OFF_S = 20;

// copia de datos (sin funciones ni clases: lo de dentro de un Arrangement o un EmotionState)
const copyData = (x) => { try { return structuredClone(x); } catch { return JSON.parse(JSON.stringify(x)); } };
// pasar los campos de datos de `from` a `to` (del mismo tipo en los dos motores, p. ej. el Arrangement)
function adopt(to, from) {
  for (const [k, v] of Object.entries(from)) if (typeof v !== 'function') to[k] = copyData(v);
}

// CANCELAR UN VIAJE (del intérprete: igual en todos los motores, por eso aquí y no en el Deck). Pulsar
// otra vez el destino de un viaje lo CANCELA. Antes lo pausaba y, al volver a pulsarlo, seguía con los
// compases de entonces aunque se hubieran cambiado en TRANSICIÓN. Ahora volver a pulsarlo es un viaje
// nuevo, con los compases que marque TRANSICIÓN y contado desde ese momento: un viaje de 4 cancelado
// y vuelto a marcar de 1 entra en cuanto le toca al de 1, no donde iba a entrar el de 4.
//   aún suena entera la parte de origen   se queda en ella, sin más: esperando su compás, o DE GOLPE
//                                         (el origen se aguanta hasta el 1). Los FX se apagan
//   PROGRESIVA a medias (ya suena mezcla) vuelve a la parte elegida antes, en lo mismo que llevaba
//                                         recorrido, desde el siguiente tiempo y sin FX
// Devuelve si lo ha cancelado (entonces la pulsación no hace nada más: ni viaje ni CORTE)
function cancelTravel(d, name) {
  const A = d.arr, T = A.travel, E = d.engine;
  if (!T || T.name !== name || !(T.bars > 0) || d.held.length || !E.playing) return false;
  if (A.canMorph()) {
    A.travel = null;
    A.target = A.home = T.fromName;
  } else {
    const back = [d.pressHome, T.fromName].find((n) => n && n !== name);
    if (!back) return true; // (no se sabe de dónde venía: sigue el viaje)
    const bars = Math.max(0.25, Math.round(T.done * T.bars * 4) / 4);
    const s = E.step;
    A.vNext = A.vNow; // vuelve a la versión que sonaba
    A.goTo(back, bars, s + ((4 - (s % 4)) % 4), { stagger: d.flow === 'escalonado' ? d.fxPal.order : null });
    A.home = back;
  }
  d.fx?.cancel(d.ctx?.currentTime ?? 0);
  A.compute();
  return true;
}

// ATERRIZAR (del intérprete, igual en todos los motores): un viaje de `bars` compases aterriza en una
// REJILLA DE SU TAMAÑO: el de 1 en cualquier compás, el de 2 cada 2, el de 4 cada 4 y los de 8 o más
// cada 8 (así uno de 16 o 32 no espera tanto). Rejilla común, contada desde el primer compás. Antes
// (hasta 2026-11-12): los de 1–2 cada 4 y los de 4 o más cada 8, y uno de 4 podía esperar 8 compases
export const LANDING = (bars) => Math.min(8, Math.max(1, bars));
// dónde empieza: la llegada cae en el primer inicio de rejilla posible, empezando como pronto en el
// siguiente compás. Instantáneo (0 compases): en el siguiente paso múltiplo de `quant` (4 = negra)
function startStepFor(d, bars, quant = 4) {
  const s = d.engine.step; // el siguiente paso aún sin programar
  if (bars === 0) return s + ((quant - (s % quant)) % quant);
  const P = LANDING(bars) * 16;
  const earliest = Math.ceil(s / 16) * 16;
  return Math.ceil((earliest + bars * 16) / P) * P - bars * 16;
}
// cada Deck, de cualquier motor, viaja con estas reglas: se ponen en el propio Deck (su goScene llama a
// this.startStepFor), sin tocar el código de los motores congelados. La vista: cuánto falta para que
// empiece un viaje de `bars` y en qué compás de la rejilla estamos (de 4 trazos como poco)
// La ENTRADA DEL DROP y el HUECO ANTES DEL KICK, también del intérprete: ver drop.js
function performer(d) {
  installDrop(d);
  d.startStepFor = (bars, quant) => startStepFor(d, bars, quant);
  d.previewStart = (bars) => {
    const pos = d.pos() ?? d.engine.step;
    const P = Math.max(4, LANDING(bars));
    return {
      wait: bars === 0 ? 0 : Math.max(0, (startStepFor(d, bars) - pos) / 16),
      phrase: P,
      bar: Math.floor(Math.max(0, pos) / 16) % P,
    };
  };
  return d;
}

export function makeSlot(engine, i, id, opts, motor) {
  const slot = { i, id, inner: performer(engine.newDeck(motor, id, opts, i)), next: null, motorNext: motor };
  const E = engine;
  const want = (m) => (E.motors[m] ? m : E.devMotor);

  // lo del intérprete al preparar el Deck de otro motor (lo que mira al generar y lo que se ve)
  const handGen = (from, to) => {
    for (const k of GEN_KEYS) to[k] = from[k];
    to.form = from.form;
    to.flow = from.flow;
    to.gesture = copyData(from.gesture);
    to.cx.global = from.cx.global;
    to.oscMuted = from.oscMuted;
  };
  // lo que está sonando, en el momento del cambio. Lo del fader de ESTILO y el PARECIDO no: ya está en
  // los dos (se escribe en los dos) y el universo que se trae pone los suyos. Si el nuevo ya entró
  // (parado: entra al momento), su color y la forma de sus viajes son los suyos: no se tocan
  const handPlay = (from, to) => {
    const entered = to.pendingSeed === null;
    if (!entered) {
      to.form = from.form;
      to.flow = from.flow;
      adopt(to.emotion, from.emotion); // (el color viaja desde el que sonaba, como siempre)
    }
    to.gesture = copyData(from.gesture);
    to.cx.global = from.cx.global;
    to.oscMuted = from.oscMuted;
    adopt(to.arr, from.arr);
    to.drift = from.drift;
    to.held = [...from.held];
    to.pressHome = from.pressHome;
    to.kickWas = from.kickWas;
    to.kickEntry = from.kickEntry;
    to.events = from.events;
    to.cxVersion = (from.cxVersion || 0) + (to.cxVersion || 0) + 1; // la vista vuelve a leer complejidad y kit
  };

  // el Deck donde va a nacer un universo del motor `m`: el que suena, si es el suyo; si no, uno nuevo
  // (o el que ya esperaba en ese motor)
  const prep = (m) => {
    if (m === slot.inner.motor) { drop(); return slot.inner; }
    if (slot.next?.motor === m) return slot.next;
    drop();
    const I = slot.inner;
    const d = performer(E.newDeck(m, id, { scene: I.arr.home, v: I.emotion.v, a: I.emotion.a }, slot.i));
    handGen(I, d);
    adopt(d.arr, I.arr);
    adopt(d.emotion, I.emotion);
    slot.next = d; // (antes de montar su audio: el MIXER lo busca en su puesto)
    if (E.ready && slot.out) d.initAudio(E.ctx, slot.out);
    return d;
  };
  // el que esperaba ya no hace falta (otro NUEVO, un PARECIDO del que suena...)
  const drop = () => {
    const d = slot.next;
    if (!d) return;
    slot.next = null;
    retire(d, E.ctx?.currentTime ?? 0, 0);
  };
  // un Deck que se va: suelta lo que sostiene en `t`, deja sonar sus colas y se desconecta
  const retire = (d, t, tail = TAIL_S) => {
    if (!d.ctx) return;
    try { d.release(t); } catch {}
    const g = d.pre?.gain;
    if (g) g.setTargetAtTime(0, t + tail, tail ? 1.5 : 0.01);
    const off = Math.max(0, t - d.ctx.currentTime) + (tail ? OFF_S : 0.2);
    setTimeout(() => { try { d.pre.disconnect(); } catch {} }, off * 1000);
  };
  // pasar al Deck que esperaba, en `t` (el 1 del compás, o ya si está parado)
  const swap = (t) => {
    const old = slot.inner, d = slot.next;
    slot.next = null;
    handPlay(old, d);
    slot.inner = d;
    if (E.ready) {
      E.applySlotMix(i); // sus canales, con el MIXER de ahora
      E.low.reset();
      retire(old, t);
    }
  };
  const swapIfStopped = () => { if (slot.next && !E.playing) swap(E.ctx?.currentTime ?? 0); };

  const methods = {
    // ESTRUCTURA: pulsar el destino de un viaje lo cancela (ver cancelTravel); lo demás, como siempre
    press(name) {
      return cancelTravel(slot.inner, name) ? 'cancel' : slot.inner.press(name);
    },
    down(name) {
      const d = slot.inner;
      if (d.pads[name]) return;
      if (cancelTravel(d, name)) { d.pads[name] = { timer: null, holding: false }; return; } // (para que up lo suelte)
      d.down(name);
    },
    // TRANSICIÓN: los compases del CLIC. Si hay un viaje de CLIC en el que aún suena entera la parte de
    // origen (esperando su compás, o DE GOLPE), se rehace solo con los nuevos, contado desde ahora: no
    // hace falta cancelarlo y volver a pulsar. Una PROGRESIVA ya en marcha sigue igual (los nuevos
    // compases, para el siguiente viaje)
    setClickBars(bars) {
      const d = slot.inner, A = d.arr, T = A.travel;
      d.gesture.click.bars = bars;
      if (!T || !(T.bars > 0) || T.bars === bars || d.held.length || !E.playing || !A.canMorph()) return;
      d.goScene(T.name, d.gesture.click, true);
    },
    // NUEVO UNIVERSO: en el motor elegido (MOTOR, junto al ESTILO)
    reseed() {
      prep(want(slot.motorNext)).reseed();
      swapIfStopped();
    },
    // UNIVERSO GUARDADO: con su motor o con el que se elija. En otro motor que el suyo se trae TAL COMO
    // NACE (su semilla, su estilo, su tempo y escala): lo que mutó o se tocó es de los generadores de su
    // motor y en otro no tiene por qué encajar. Uno de un motor que ya no está (los de antes de ALPHA:
    // sin motor, el 1 o el 2) es del de partida, ENTERO: ALPHA los une
    loadUniverse(u, withGlobals = false, motor) {
      const own = want(u.motor);
      const m = want(motor ?? own);
      if (E.multi && m !== own) u = { seed: u.seed, style: u.style ?? null, global: u.global, motor: m };
      slot.motorNext = m; // como el fader de ESTILO: lo que se trae deja el MOTOR en el suyo
      prep(m).loadUniverse(u, withGlobals);
      swapIfStopped();
    },
    // PARECIDO: siempre del que suena y en su motor
    similarUniverse(keepS, keepM) {
      drop();
      return slot.inner.similarUniverse(keepS, keepM);
    },
    // antes del primer GENERAR: el que espera nace con el ESTILO del fader... y con el MOTOR elegido
    styleWaiting() {
      const m = want(slot.motorNext);
      if (E.generated || !E.ready || m === slot.inner.motor) return slot.inner.styleWaiting();
      const d = prep(m);
      d.waitStyle = null; // (que lo vuelva a sortear)
      d.styleWaiting();
      swapIfStopped();
      return true;
    },
    // el reloj: en el 1 del compás, si espera un universo de otro motor, cambia de Deck antes de sus notas
    scheduleStep(n, gridT) {
      if (slot.next && n % 16 === 0) swap(gridT);
      return slot.inner.scheduleStep(n, gridT);
    },
    // el audio (al arrancar y al rehacerlo): también el del que espera
    initAudio(ctx, out) {
      slot.out = out;
      slot.inner.initAudio(ctx, out);
      slot.next?.initAudio(ctx, out);
    },
  };

  const bound = new WeakMap(); // Deck → { nombre: método atado a ese Deck }
  const proxy = new Proxy(slot, {
    get(_, k) {
      if (k === 'slot') return slot;
      if (k === 'motorNext') return slot.motorNext;
      if (k === 'nextMotor') return slot.next?.motor ?? null; // el motor del universo que espera, si es otro
      if (Object.hasOwn(methods, k)) return methods[k];
      const d = slot.next && PENDING_KEYS.has(k) ? slot.next : slot.inner;
      const v = d[k];
      if (typeof v !== 'function') return v;
      let m = bound.get(d);
      if (!m) bound.set(d, (m = {}));
      return (m[k] ||= v.bind(d));
    },
    set(_, k, v) {
      if (k === 'motorNext') { slot.motorNext = v; return true; }
      if (GEN_KEYS.has(k)) { slot.inner[k] = v; if (slot.next) slot.next[k] = v; return true; }
      (slot.next && PENDING_KEYS.has(k) ? slot.next : slot.inner)[k] = v;
      return true;
    },
    has(_, k) { return k in slot.inner; },
    getPrototypeOf() { return Object.getPrototypeOf(slot.inner); },
  });
  return proxy;
}

// ¿es `d` el Deck de este puesto (el que suena o el que espera) o el propio puesto?
export const inSlot = (p, d) => p === d || p.slot?.inner === d || p.slot?.next === d;
