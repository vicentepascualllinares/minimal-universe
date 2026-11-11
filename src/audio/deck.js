// UNIVERSO — un mundo musical completo: sus instrumentos, su emoción, su
// estructura y su ESPACIO (delay y reverb propios, ver music/space.js). El reloj, el BPM
// y la tonalidad los pone el Engine (globales), así dos universos siempre encajan.

import * as V from './voices.js';
import { DrumSlots } from './drumSlots.js';
import { Channel, Saturator, glide, fixChannels, compMakeup } from './dsp.js';
import { makeGenerators, trimLens } from '../music/generators.js';
import { EmotionState, mapEmotion, degreeToSemis } from '../music/emotion.js';
import { Arrangement, INSTRUMENTS, mixOf } from '../music/arrangement.js';
import { classify, makePalette, PHRASE } from '../music/transitions.js';
import { TransitionFx } from './transitionFx.js';
import { SpaceFx } from './spaceFx.js';
import { blockRate } from './quality.js';
import { shapeComplexity, shareDensity, randomComplexity, randomOsc, GROUPS, newOsc, oscAt, layerCells, applyGesture, compileOsc } from '../music/complexity.js';
import { newKit, randomKit } from '../music/kit.js';
import { hatMain, hatKind, percSound, foleySound } from '../music/sounds.js';
import { NORMAL, rollStyle, styleColor, sValue } from '../music/styles.js';
import { makeSpace, SENDS } from '../music/space.js';
import { Rng, makeDrift, lerp } from '../core/rng.js';
import { PROFILE } from '../core/profile.js';
import { dbGain } from '../core/fader.js';

const glideAll = glide;

// BUS DE PERCUSIÓN (ver initAudio y setBus): quién va por él. El clap NO: con el sidechain del kick
// desaparecería (cae en el mismo tiempo que el kick) y en minimal marca sin esconderse
export const PERC_BUS = ['hat', 'ohat', 'perc', 'foley'];
// el retraso del compresor del navegador (6 ms de «lookahead», medido: 264 muestras a 44,1 kHz,
// 288 a 48 kHz)
const busLatency = (sr) => Math.floor(0.006 * sr) / sr;
// GROOVE (ver grooveTime): el dibujo de quién sigue cada instrumento (el open, el de los hats; el
// foley, el de la percusión). Kick, clap y pad no están: van con la rejilla
const GROOVE_OF = { hat: 'hat', ohat: 'hat', perc: 'perc', foley: 'perc', bass: 'bass', chord: 'chord' };

const newSeed = () => (Math.random() * 1e9) | 0;

// un pad apoyado más que esto = CORTE. Los teclados que distinguen tocar de mantener usan
// 200 ms por defecto (QMK, TAPPING_TERM) y quien toca rápido lo baja; un clic o un toque
// normal dura ~100 ms. Los sistemas (400–500 ms) son para menús, demasiado lento para tocar.
// El CORTE suena tras esto + hasta una corchea
export const HOLD_MS = 150;

export class Deck {
  constructor(engine, id, { scene, v, a }) {
    this.engine = engine;
    this.id = id;
    // FORMA de los viajes (para los dos gestos): 'golpe' = se aguanta y cambia todo en el 1;
    // 'prog' = cambia a lo largo del viaje, 'suave' (todos a la vez) o 'escalonado' (uno a uno)
    this.form = 'prog';
    this.flow = 'suave';
    // los dos gestos de ESTRUCTURA y si llevan efectos. CLIC = cambiar de escena: un viaje de
    // `bars` compases (0 = INSTANTÁNEO, en la siguiente negra). CORTE = mantener pulsado: dura lo que
    // dura el dedo y es siempre instantáneo, en la siguiente corchea (nunca a mitad de un
    // golpe). `quant` = rejilla de lo instantáneo, en pasos: 4 = negra, 2 = corchea
    this.gesture = {
      click: { bars: 4, fx: true, quant: 4 },
      cut: { bars: 0, fx: false, quant: 2 },
    };
    this.held = [];        // escenas mantenidas ahora mismo (manda la última)
    this.pads = {};        // pads apoyados ahora mismo (ver down / up)
    this.pressHome = null; // escena elegida antes de la última pulsación
    // COMPLEJIDAD por grupos (0 simple .. 1 complejo) y un GLOBAL que los escala.
    // Se aplica compás a compás. NUEVO UNIVERSO los cambia (luego se tocan a mano).
    this.cx = { kick: 0.3, perc: 0.6, bass: 0.5, inst: 0.5, global: 0.8 };
    this.cxVersion = 0; // la vista sabe cuándo los cambió el universo y no el usuario
    // OSCILADORES de complejidad, uno por grupo (ver complexity.js). NUEVO UNIVERSO los sortea;
    // oscMuted = todos en silencio (se preparan por debajo): eso sí lo recuerda el universo
    this.osc = Object.fromEntries(GROUPS.map((g) => [g, newOsc()]));
    this.oscMuted = false;
    // KIT: CANTIDAD y VARIEDAD de hats y percs (ver kit.js). NUEVO UNIVERSO también los sortea
    // (cxVersion avisa a la vista igual que con la complejidad)
    this.kit = newKit();
    // ESTILO (styles.js): `styleNext` = el fader de la cabecera (0 = NORMAL .. 1 = ROMINIMAL), con el
    // que nacerá el PRÓXIMO universo; `sty` = el estilo con el que nació el que suena. No se guarda
    // (como el resto de OPCIONES, vendrá con las cuentas): cada sesión empieza en NORMAL
    this.styleNext = 0;
    this.sty = NORMAL;
    this.pendingSty = null;
    this.waitStyle = 0; // el estilo con el que se sorteó el universo que espera al primer GENERAR (ver styleWaiting)
    this.emotion = new EmotionState(v, a);
    this.arr = new Arrangement(scene);
    this.events = [];
    this.seed = newSeed();
    this.gen = makeGenerators(this.seed);
    this.pendingSeed = null;
    this.pendingGen = null; // los generadores del universo que viene (sus sonidos se graban antes)
    this.bars = {};
    // HATS Y PERCS: una ranura por sonido, con su grabación en el banco y sus colas (drumSlots.js)
    this.drums = new DrumSlots(this);
    this.soundsAt = -1; // cuándo se actualizaron las recetas por última vez (ver updateSound)
    this.drift = makeDrift(new Rng(this.seed ^ 0x5bd1e995));
    this.e = mapEmotion(v, a);
    this.newFxPalette(this.seed);
    this.newSpace(this.seed);
    this.pendingSpace = null;
  }

  // ESPACIO (music/space.js): el delay y la reverb del universo, de su semilla y su estilo. Los
  // THROWS tiran de su propio dado (no tocan ninguno de los de siempre)
  newSpace(seed, space = makeSpace(seed, this.sty)) {
    this.space = space;
    this.spaceRng = new Rng((seed ^ 0x510e527f) >>> 0);
  }

  // un canal del MIXER: un instrumento o un retorno (DELAY, REVERB)
  mixChannel(k) { return this.ch?.[k] ?? this.spaceFx?.ret[k]; }

  // TRANSICIONES: la paleta (qué riser, redoble, golpes...) sale de la semilla (y del estilo)
  newFxPalette(seed) {
    this.fxPal = makePalette(seed, this.sty);
    this.fxRng = new Rng(seed ^ 0x6a09e667);
  }

  // el COLOR que suena: el del universo (valencia, activación y deriva lenta) llevado a los rangos de
  // su ESTILO (styleColor: con inercia, como el color)
  colorAt(now) {
    const em = this.emotion;
    return styleColor(mapEmotion(em.v, em.a, this.drift(now)), em.sx);
  }

  // monta el audio del universo. Se vuelve a llamar si el motor rehace el audio
  // (cambio de búfer): lo que sonaba en el contexto viejo se olvida, la música no.
  initAudio(ctx, out) {
    this.ctx = ctx;
    this.padVoice = null;
    this.events = [];
    this.sum = ctx.createGain();
    this.sum.gain.value = 0.8;
    // SIEMPRE estéreo. Si no, la suma pasaba de estéreo a mono cuando acababa el último golpe
    // de percusión (la única voz con paneo) y Chrome REINICIABA la saturación de detrás: tiraba
    // los ~4 ms de sonido que tiene dentro el sobremuestreo → chasquido (medido en una
    // grabación: dos huecos de 4,0 ms por compás). Ver fixChannels en dsp.js.
    fixChannels(this.sum, 2);
    // saturación del universo entero (sin recortes ni saltos: ver Saturator en dsp.js)
    const Q = this.engine.q; // CALIDAD DEL MOTOR (ver quality.js)
    this.sat = new Saturator(ctx, Q.oversample ? '4x' : 'none', 0.5);
    // tensión de las transiciones: HP (build), LP (downfilter) y silencio antes del drop.
    // Las voces de transición van aparte, directas a la salida: no se filtran.
    const tHp = ctx.createBiquadFilter();
    tHp.type = 'highpass'; tHp.frequency.value = 20; tHp.Q.value = 3;
    const tLp = ctx.createBiquadFilter();
    tLp.type = 'lowpass'; tLp.frequency.value = 20000; tLp.Q.value = 4;
    const gap = ctx.createGain();
    // AUTO-ARREGLOS (ver autoArrange y kickGap):
    //   lows      graves que bajan en el último compás antes del drop (estante grave; a 0 dB no hace nada)
    //   contrast  el universo algo más bajo mientras no hay kick
    //   pre       hueco antes del kick. Al final del universo, con las voces de transición
    //             dentro: el silencio es de todo lo que suena en este universo
    this.lows = ctx.createBiquadFilter();
    this.lows.type = 'lowshelf';
    this.lows.frequency.value = 200;
    this.lows.gain.value = 0;
    this.contrast = ctx.createGain();
    this.pre = ctx.createGain();
    this.pre.connect(out);
    this.kickWas = 1;          // presencia del kick en el paso anterior (ver scheduleStep)
    this.kickEntry = false;    // el kick acaba de entrar de golpe: el hueco va antes de su primer golpe
    this.autoOn = { bass: false, lows: false, contrast: 1 }; // lo que está haciendo ahora cada auto-arreglo
    this.sum.connect(this.sat.input);
    this.sat.output.connect(tHp).connect(tLp).connect(this.lows).connect(gap).connect(this.contrast).connect(this.pre);
    this.fx = new TransitionFx(this, ctx, this.pre, { hp: tHp, lp: tLp, gap });

    // BUS DE PERCUSIÓN (hats, open, percs y foley; NUNCA el clap ni el kick): una compresión de bus
    // suave que los pega y doma los golpes más puntiagudos, para que se sienten detrás del kick (ver
    // setBus). Dos caminos al mismo sitio: directo (NORMAL: exactamente como antes) y por el compresor
    // (con ESTILO). El compresor del navegador mira 6 ms por delante (los retrasa: BUS_LAT): con él
    // encendido, sus golpes y su sidechain se programan esos ms antes y llegan a tiempo con el kick
    this.pbIn = fixChannels(ctx.createGain(), 2);
    this.pbDirect = ctx.createGain();
    this.pbComp = ctx.createDynamicsCompressor();
    this.pbWet = ctx.createGain();
    this.pbWet.gain.value = 0;
    this.pbIn.connect(this.pbDirect).connect(this.sum);
    this.pbIn.connect(this.pbComp).connect(this.pbWet).connect(this.sum);
    this.busLat = 0;
    this.busOn = false;

    this.ch = {};
    for (const k of INSTRUMENTS) {
      this.ch[k] = new Channel(ctx, k, PERC_BUS.includes(k) ? this.pbIn : this.sum, Q.oversample ? '2x' : 'none');
      this.ch[k].user.gain.value = this.engine.instGain(this, k); // MIXER (fader, MUTE y SOLO)
    }

    // ESPACIO: delay y reverb, con un envío de cada instrumento que los usa (tras su fader) y de
    // los efectos de transición (solo a la reverb). Los retornos, en el MIXER como un canal más
    this.spaceFx = new SpaceFx(ctx, this.sum, Q);
    // las perillas de ENVÍOS del MIXER
    for (const fx in this.engine.sendTrim) for (const k in this.engine.sendTrim[fx]) this.spaceFx.trim[fx][k] = dbGain(this.engine.sendTrim[fx][k]);
    for (const k of SENDS) this.spaceFx.wire(k, this.ch[k].out);
    this.spaceFx.wire('fx', this.fx.bus);
    for (const k in this.spaceFx.ret) this.spaceFx.ret[k].user.gain.value = this.engine.instGain(this, k);
    this.spaceFx.set(this.space, ctx.currentTime, this.engine.stepDur, true);
    this.setBus(this.sty ?? NORMAL, ctx.currentTime, true); // (audio rehecho: el bus como estaba)

    // hats y percs: ranuras nuevas sobre los canales nuevos (las grabaciones siguen en el banco)
    this.drums.init(ctx);
    this.refreshSounds();
    // móvil: no reenviar a los parámetros valores que no cambian (ahorra hilo principal)
    this.paramCache = PROFILE.lite ? new Map() : null;
  }

  // RECETAS de hats y percs con el color de ahora → ranuras (las que cambian se graban de nuevo;
  // mientras, suena la versión anterior). Con `gen` de otro universo (el que viene) solo se piden
  // al banco, para tenerlas grabadas antes de que suene (ver reseed)
  // Cuándo se vuelve a grabar por el COLOR: si viaja (universo nuevo: llega a su color con una
  // inercia de 2,2 s), cada ranura cada medio segundo (el cambio se oye gradual). Con la deriva
  // lenta sola, una vez cada 4 s: en ese tiempo se mueve menos de 1/96 de octava y no se oye.
  // Lo que cambia de verdad (un carril que muta, otro universo, otra tónica o escala) entra
  // siempre al momento: ver DrumSlots.set
  refreshSounds(gen = this.gen, warm = false) {
    const e = this.e;
    const root = this.engine.rootHz;
    const scale = this.engine.scale;
    const em = this.emotion;
    const gap = em.sxMoving || Math.abs(em.tv - em.v) + Math.abs(em.ta - em.a) > 0.03 ? 0.5 : 4;
    const put = (id, ch, rec, src) => {
      if (warm) this.engine.bank.want(`${this.id}:pre:${id}`, rec.key, rec.p, true); // urgente: sonará en el próximo compás
      else this.drums.set(id, ch, rec, gap, src);
    };
    put('hat', 'hat', hatMain(e, false), []);
    put('ohat', 'ohat', hatMain(e, true), []);
    gen.hat.kinds.forEach((k, i) => put(`k${i}`, k.ch, hatKind(e, k), [k]));
    gen.perc.lanes.forEach((l, n) => {
      const so = l.sound;
      const semis = degreeToSemis(so.deg, scale) + 12 * so.oct;
      put(`p${n}`, 'perc', percSound(e, so, root * Math.pow(2, semis / 12) * e.perc.pitchMul), [so, root, scale]);
    });
    gen.foley.lanes.forEach((l, n) => put(`f${n}`, 'foley', foleySound(e, l.sound), [l.sound]));
  }

  // móvil: no reenviar a un parámetro el valor que ya tiene
  glideLite(param, v, now, tc) {
    const last = this.paramCache.get(param);
    if (last !== undefined && Math.abs(last - v) <= Math.abs(v) * 0.002 + 1e-4) return;
    this.paramCache.set(param, v);
    glide(param, v, now, tc);
  }

  // NUEVO UNIVERSO: entra en el siguiente compás, con el ESTILO que marca ahora el fader. Sus hats y
  // percs se graban ya, así suenan desde el primer golpe
  reseed() {
    this.rollPending();
    if (this.ctx) this.refreshSounds(this.pendingGen, true);
  }
  // el universo que viene: semilla, ESTILO (el del fader ahora), generadores y espacio
  rollPending() {
    this.pendingSeed = newSeed();
    this.pendingSty = rollStyle(this.pendingSeed, this.styleNext);
    this.pendingGen = makeGenerators(this.pendingSeed, this.pendingSty);
    this.pendingSpace = makeSpace(this.pendingSeed, this.pendingSty);
    this.spaceFx?.prepare(this.pendingSpace); // su sala y su fondo se calculan ya (fuera del reloj)
  }

  // ANTES DEL PRIMER GENERAR: el universo que espera nace ya con el ESTILO que marca el fader (NORMAL,
  // ROMINIMAL o lo de en medio). Antes el primero salía siempre NORMAL y había que pulsar NUEVO
  // UNIVERSO para que el fader contara. Parado no suena nada: entra al momento y con su color ya
  // puesto (sin la inercia de ~2 s). Lo llama la vista al mover el fader y el motor al pulsar GENERAR
  // (por si no dio tiempo). Devuelve si ha cambiado algo
  styleWaiting() {
    if (this.engine.generated || !this.ctx || this.waitStyle === this.styleNext) return false;
    this.waitStyle = this.styleNext;
    this.rollPending();
    const now = this.ctx.currentTime;
    this.enterPending(now);
    this.emotion.snap();
    this.e = this.colorAt(now);
    this.refreshSounds(this.gen, true); // sus hats y percs, a grabar ya (urgente)
    return true;
  }

  // entra el universo que esperaba (NUEVO UNIVERSO), en `t0`: el 1 de un compás
  enterPending(t0) {
    this.seed = this.pendingSeed;
    this.pendingSeed = null;
    this.sty = this.pendingSty ?? NORMAL; // el ESTILO con el que nace (el fader al pulsar)
    this.pendingSty = null;
    this.gen = this.pendingGen ?? makeGenerators(this.seed, this.sty); // (ya creados en reseed: sus sonidos están grabados)
    this.pendingGen = null;
    this.newCharacter(this.seed);
    this.newFxPalette(this.seed);
    this.newSpace(this.seed, this.pendingSpace ?? undefined); // y su ESPACIO, desde el 1 de este compás
    this.pendingSpace = null;
    this.spaceFx?.set(this.space, t0, this.engine.stepDur);
    // con estilo, nace también con su MEZCLA (faders y MUTE), en el 1 de este compás. En NORMAL el
    // MIXER no se toca, como siempre, salvo para devolver la mezcla de antes si el universo que se
    // va la traía de un estilo (ver Engine.styleMix)
    this.engine.styleMix(this, this.sty, t0);
    this.setBus(this.sty, t0);
  }

  // CARÁCTER del universo (sale de la semilla y de su ESTILO): color del sonido y complejidad
  // de cada grupo. Sustituye al antiguo pad de EMOCIÓN: el timbre cambia con
  // inercia (~2 s); el global no se toca (es del intérprete).
  newCharacter(seed) {
    const r = new Rng(seed ^ 0x9e3779b9);
    const S = this.sty, t = S.t;
    // con estilo, el color se sortea en su zona (mismas dos tiradas)
    const range = (a, b, R) => (t && R ? r.float(lerp(a, R[0], t), lerp(b, R[1], t)) : r.float(a, b));
    this.emotion.setTarget(range(-0.8, 0.8, S.v), range(-0.7, 0.7, S.a));
    this.emotion.setStyle(t ? S.color : null); // y el timbre, a los rangos del estilo
    Object.assign(this.cx, randomComplexity(r, S));
    this.osc = randomOsc(r, this.cx, S);
    this.kit = randomKit(r, S); // al final: la misma semilla sigue dando el mismo color y complejidad
    this.cxVersion++;
  }
  setComplexity(group, v) { this.cx[group] = v; }
  // KIT: `group` = 'hat' | 'perc' | 'foley', `key` = 'amt' (CANTIDAD) | 'vary' (VARIEDAD). En el siguiente compás
  setKit(group, key, v) { this.kit[group][key] = v; }
  // OSCILADOR: encendido, marca B (null = sin oscilar), GESTO y GUÍA DE TIEMPOS (velocidad y
  // tramo de la frase); volver a la variante del gesto; volver al gesto (borra lo retocado)
  setOscOn(group, on) { this.osc[group].on = on; }
  setOscMuted(m) { this.oscMuted = m; }
  setOscB(group, v) { this.osc[group].b = v; }
  setGesture(group, i) { applyGesture(this.osc[group], i); }
  setOscTime(group, rate, zone) { Object.assign(this.osc[group], { rate, zone }); compileOsc(this.osc[group]); }
  resetOscTime(group) { applyGesture(this.osc[group], this.osc[group].gest); }
  resetGesture(group) { compileOsc(this.osc[group]); }
  // EDITOR (retoque a mano de los dos niveles, `li` = 0 o 1): encendido, unidad, patrón
  // (borra lo pintado), pintar una casilla, volver al patrón. Marca el gesto como retocado
  editLayer(group, li, f) {
    f(this.osc[group].layers[li]);
    this.osc[group].edited = true;
  }
  setLayerOn(group, li, on) { this.editLayer(group, li, (L) => (L.on = on)); }
  setOscUnit(group, li, unit) { this.editLayer(group, li, (L) => (L.unit = unit)); }
  setOscPattern(group, li, i) { this.editLayer(group, li, (L) => Object.assign(L, { pat: i, custom: null })); }
  paintOsc(group, li, i, v) {
    this.editLayer(group, li, (L) => {
      L.custom = [...layerCells(L)];
      L.custom[i] = v;
    });
  }
  resetOsc(group, li) { this.editLayer(group, li, (L) => (L.custom = null)); }
  // lo que marca ahora cada grupo con su oscilador (0..1, antes del GLOBAL)
  // (con los osciladores en silencio, el fader)
  cxNow(group, step) { return this.oscMuted ? this.cx[group] : oscAt(this.osc[group], this.cx[group], step); }

  // paso de la rejilla que suena ahora (fraccionario); null en pausa
  pos(now = this.ctx?.currentTime) {
    const E = this.engine;
    return E.playing ? E.step - (E.nextGrid - now) / E.stepDur : null;
  }

  // dónde empieza un viaje de `bars` compases para ATERRIZAR EN FRASE:
  // la llegada cae en el primer inicio de frase posible. Instantáneo (0 compases): en el
  // siguiente paso múltiplo de `quant` (4 = negra, 2 = corchea).
  startStepFor(bars, quant = 4) {
    const s = this.engine.step; // el siguiente paso aún sin programar
    if (bars === 0) return s + ((quant - (s % quant)) % quant);
    const P = PHRASE(bars) * 16;
    const earliest = Math.ceil(s / 16) * 16;
    return Math.ceil((earliest + bars * 16) / P) * P - bars * 16;
  }

  // ── ESTRUCTURA: CLIC y CORTE
  // Entrada única para cualquier mando (pantalla, teclado, MIDI): `down` al apoyar
  // el pad de una escena y `up` al soltarlo. Un controlador MIDI solo tiene que
  // llamar a down en note-on y a up en note-off (ver RENDIMIENTO.md).
  down(name) {
    if (this.pads[name]) return;
    const p = (this.pads[name] = { timer: null, holding: false });
    if (this.press(name) === 'go') {
      p.timer = setTimeout(() => { p.timer = null; p.holding = true; this.hold(name); }, HOLD_MS);
    }
  }
  up(name) {
    const p = this.pads[name];
    if (!p) return;
    delete this.pads[name];
    clearTimeout(p.timer);
    if (p.holding) this.unhold(name);
  }

  // Al apoyar el dedo en una escena es un CLIC: se cambia a ella (instantáneo o viaje).
  // Si el dedo sigue apoyado, la vista llama a hold() y pasa a ser un CORTE (al soltar,
  // unhold()): suena
  // mientras se mantiene y al soltar vuelve a la escena elegida. Cada gesto tiene sus
  // compases y su FX. Pulsar el destino de un viaje a mitad = pausa / sigue.
  // Devuelve 'pause' si la pulsación solo pausó o reanudó (entonces no hay corte).
  press(name) {
    const A = this.arr;
    const T = A.travel;
    if (T && T.name === name && T.bars > 0 && !this.held.length && this.engine.playing) {
      this.toggleTravelPause();
      return 'pause';
    }
    this.pressHome = A.home;
    A.home = name;
    this.goScene(name, this.gesture.click);
    return 'go';
  }

  // el dedo sigue apoyado: era un CORTE. La escena elegida no cambia y, si el CORTE
  // tiene otros compases u otro FX que el CLIC, el viaje se rehace con los suyos
  hold(name) {
    if (this.arr.home === name && this.pressHome !== null) this.arr.home = this.pressHome;
    this.held.push(name);
    const c = this.gesture.click, k = this.gesture.cut;
    if (c.bars !== k.bars || c.fx !== k.fx || c.quant !== k.quant) this.goScene(name, k, true);
  }

  // soltar un CORTE: vuelve a la escena elegida (o al último corte que siga mantenido)
  unhold(name) {
    const i = this.held.lastIndexOf(name);
    if (i < 0) return;
    const top = i === this.held.length - 1;
    this.held.splice(i, 1);
    if (!top) return;
    const back = this.held.length ? this.held[this.held.length - 1] : this.arr.home;
    this.goScene(back, this.gesture.cut);
  }

  // ir a una escena con un gesto { bars, fx }. `force`: rehacer aunque ya vaya ahí
  goScene(name, g, force = false) {
    const A = this.arr;
    // parado (antes del primer GENERAR o en PAUSA) no hay nada que viajar: se salta directo
    // y la música empieza (o sigue) desde ahí
    // (la misma parte con LUEGO en otra versión no es «ya está»: se va a esa versión)
    const same = A.target === name && A.vNow === A.vNext;
    if (!this.engine.playing) {
      if (same && !A.travel) return;
      A.goTo(name, 0, 0);
      this.fx?.cancel(this.ctx?.currentTime ?? 0);
      return A.land();
    }
    if (!force && same && (!A.travel || A.travel.bars === g.bars)) return; // ya está (o ya va)
    const kind = classify(A.cur, mixOf(name, A.vNext));
    // la FORMA solo cuenta en los viajes: lo instantáneo (el CORTE, o CLIC en INSTANTÁNEO) salta
    const cut = this.form === 'golpe' && g.bars > 0;
    const stagger = !cut && g.bars > 0 && this.flow === 'escalonado' ? this.fxPal.order : null;
    A.goTo(name, g.bars, this.startStepFor(g.bars, g.quant), { drop: cut, stagger });
    this.fx?.start(A.travel, g.fx ? kind : 'none', this.fxPal, this.fxRng, cut);
  }

  // ── VERSIONES (1 · 2): dos posibilidades de cada parte, siempre en el mismo orden (la 1 con
  // menos elementos, la 2 con más). Dos botones, para guiar sabiendo qué va a pasar:
  //   AHORA  la versión de la parte que SUENA
  //   LUEGO  la del destino del viaje; quieto, la de la próxima parte que pulses
  // Cuando solo suena una parte (al llegar), las dos quedan en la de esa parte: de BREAK 1 a
  // DROP 2, al llegar AHORA = 2 y LUEGO = 2. Un mando cualquiera (pantalla, teclado, MIDI)
  // llama a toggleNow / toggleNext.

  // ¿se puede tocar AHORA? Quieto, sí; en un viaje, mientras aún suena entera la parte de
  // origen (esperando la frase, o DE GOLPE). No a mitad de un viaje progresivo
  canNow() { return this.arr.canMorph(); }

  // AHORA: la parte que suena cambia de versión en el SIGUIENTE COMPÁS: DE GOLPE, de golpe en ese
  // 1; PROGRESIVA, en 1 compás (SUAVE o ESCALONADA). Sin FX: es la misma parte de otra forma.
  // Quieto, LUEGO la sigue (solo suena una parte). Parado, salta directo. Dos clics antes de que
  // empiece el cambio lo anulan
  toggleNow() {
    const A = this.arr;
    if (!this.canNow()) return;
    A.vNow = 1 - A.vNow;
    if (!A.travel) A.vNext = A.vNow;
    if (!this.engine.playing && !A.travel) {
      A.morph = null;
      A.cur = { ...mixOf(A.target, A.vNow) };
      return A.compute();
    }
    const golpe = this.form === 'golpe';
    const bar = Math.ceil(this.engine.step / 16) * 16;
    A.startMorph(bar, golpe ? 0 : 16, !golpe && this.flow === 'escalonado' ? this.fxPal.order : null);
    A.compute();
  }

  // LUEGO: en un viaje (esperando la frase o a medias), el viaje sigue igual y llega a la otra
  // versión, sin saltos (ver Arrangement.retarget). Quieto, elige la versión de la próxima parte
  // que pulses (lo que suena no cambia)
  toggleNext() {
    const A = this.arr;
    A.vNext = 1 - A.vNext;
    if (A.travel) A.retarget();
    A.compute();
  }

  toggleTravelPause() {
    const T = this.arr.travel;
    if (!T.paused) {
      T.paused = true;
      if (this.ctx) this.fx.pause(this.ctx.currentTime);
      return;
    }
    T.paused = false;
    const pos = this.pos();
    if (pos === null) return;
    if (T.done <= 0) T.startStep = this.startStepFor(T.bars); // aún no había empezado: frase nueva
    else T.startStep = Math.round((pos - T.done * T.bars * 16) / 4) * 4; // sigue desde donde iba, a tiempo
  }

  // DROP: el destino entra de golpe en el tiempo exacto `t` (lo llama la transición)
  land(t) {
    this.arr.land();
    for (const k of INSTRUMENTS) this.ch[k].applyTransition(this.arr.state[k].progress, this.fxPal.how[k], t, 0.006);
  }

  // para la vista, antes de pulsar: compases que faltan para que EMPIECE un viaje de
  // `bars` compases (0 = ya), y en qué compás de la frase estamos
  previewStart(bars) {
    const pos = this.pos() ?? this.engine.step;
    const P = PHRASE(bars);
    return {
      wait: bars === 0 ? 0 : Math.max(0, (this.startStepFor(bars) - pos) / 16),
      phrase: P,
      bar: Math.floor(Math.max(0, pos) / 16) % P,
    };
  }

  // para la vista: a dónde va, cuántos compases faltan para llegar y si aún espera la frase
  travelInfo() {
    const T = this.arr.travel;
    if (!T || !T.name || T.bars === 0) return null;
    const pos = this.pos() ?? this.engine.step;
    if (T.paused) return { name: T.name, paused: true, left: T.bars * (1 - T.done) };
    return {
      name: T.name,
      left: Math.max(0, (T.startStep + T.bars * 16 - pos) / 16),
      wait: Math.max(0, (T.startStep - pos) / 16),
    };
  }

  // control (≈50 Hz): emoción, estructura, transiciones y sonido
  update(now, dt) {
    const pos = this.pos(now);
    this.emotion.update(dt);
    this.e = this.colorAt(now);
    this.arr.update(pos);
    this.fx.update(now, pos);
    for (const k of INSTRUMENTS) {
      this.ch[k].applyTransition(this.arr.state[k].progress, this.fxPal.how[k], now);
    }
    this.updateSound(now);
    this.spaceFx?.tempo(this.engine.stepDur, now); // el delay sigue al BPM
  }

  updateSound(now) {
    const e = this.e;
    const glide = PROFILE.lite ? this.glideLite.bind(this) : glideAll;
    // hats y percs siguen al color (cuánto y cada cuánto: ver refreshSounds)
    if (now - this.soundsAt > 0.1 || now < this.soundsAt) {
      this.soundsAt = now;
      this.refreshSounds();
    }
    const m = e.master;
    const C = this.ch;
    C.kick.setDrive(e.kick.drive);
    C.clap.setDrive(e.clap.drive);
    C.hat.setDrive(e.hat.drive);
    C.ohat.setDrive(e.hat.drive);
    C.perc.setDrive(e.perc.drive);
    C.foley.setDrive(e.foley.drive);
    C.bass.setDrive(e.bass.drive);
    C.chord.setDrive(e.chord.drive);
    C.pad.setDrive(e.pad.drive);
    const tc = 0.25;
    glide(C.pad.out.gain, C.pad.level * e.pad.level, now, 0.6);
    // el pad que está sonando sigue a la emoción en vivo
    const pv = this.padVoice;
    if (pv && pv.end > now) {
      glideAll(pv.filter.frequency, e.pad.cutoff, now, 0.5);
      glideAll(pv.lfoGain.gain, e.pad.cutoff * e.pad.lfoDepth, now, 0.5);
      glideAll(pv.airGain.gain, e.pad.air, now, 0.5);
    }

    this.sat.set(m.drive * 0.6);
  }

  prepareBar(b, absStep, t0) {
    if (this.pendingSeed !== null) this.enterPending(t0);
    const G = this.gen;
    // la complejidad de los faders (A): manda en la mutación, la armonía y el protagonismo.
    // Lo que se toca sale de los OSCILADORES (ver byPulse, abajo)
    const cx = shapeComplexity(this.cx, this.sty);
    // cada generador ve el carácter del universo (this.e) con la complejidad de su grupo
    // (estas, las del fader: para mutar y para el pad)
    const eP = { ...this.e, gen: cx.perc.gen, cx: cx.perc.cx };
    const eB = { ...this.e, gen: cx.bass.gen, cx: cx.bass.cx };
    const eI = { ...this.e, gen: cx.inst.gen, cx: cx.inst.cx };
    const r = G.rng;
    const muP = eP.gen.mutation;
    // ESTILO: cada cuántos compases puede mutar la percusión (en ROMINIMAL, solo al empezar frase:
    // el loop aguanta) y cuánto (× la mutación de siempre). Sin estilo, lo de siempre
    const Sy = this.sty;
    const mutEvery = Sy.t ? Sy.k['mut.every'] ?? 4 : 4;
    if (b > 0 && b % mutEvery === 0) {
      if (r.chance(muP * sValue(Sy, 'mut.perc', 1))) G.perc.mutate(1);
      if (r.chance(muP * 0.5 * sValue(Sy, 'mut.hat', 1))) G.hat.mutate();
      if (r.chance(muP * 0.6 * sValue(Sy, 'mut.foley', 1))) G.foley.mutate(1);
    }
    if (b > 0 && b % 8 === 0) {
      if (r.chance(eB.gen.mutation * 0.7)) G.bass.mutate();
      if (r.chance(muP * 0.35)) G.clap.mutate();
      if (r.chance(muP * 0.4)) G.ohat.mutate();
    }
    // la mutación fuerte de cada 32 compases; con estilo, solo a veces (sin estilo, sin tirada)
    if (b > 0 && b % 32 === 0 && cx.eff.perc > 0.3 && !(Sy.t && !r.chance(sValue(Sy, 'mut.force', 1)))) G.perc.mutate(2);
    if (b > 0 && b % 16 === 0 && r.chance(eI.gen.mutation * 0.6)) G.harmony.mutate();

    // protagonismo: si hay más instrumentos de los que la complejidad admite, ceden densidad
    const S = this.arr.state;
    const dens = {}, prog = {};
    for (const k of INSTRUMENTS) {
      dens[k] = S[k].density;
      prog[k] = S[k].progress;
    }
    const shared = shareDensity(dens, prog, cx.budget);
    const d = (k) => shared[k];
    const withCx = (sh) => ({ ...this.e, gen: sh.gen, cx: sh.cx });
    // los acordes oscilan en ritmo y número de notas, pero la progresión es la del fader
    const chordCx = (sh) => ({ ...sh, cx: { ...sh.cx, progression: cx.inst.cx.progression } });
    this.bars = {
      ...this.byPulse('kick', absStep, cx, [G.kick], (sh) => ({ kick: G.kick.bar(b, d('kick'), withCx(sh)) })),
      ...this.byPulse('perc', absStep, cx, [G.clap, G.hat, G.ohat, G.perc, G.foley], (sh) => {
        const e = withCx(sh);
        // hats, percs y foley con su CANTIDAD y VARIEDAD (las perillas bajo su nombre)
        const eH = { ...e, kit: this.kit.hat };
        const out = {
          clap: G.clap.bar(b, d('clap'), e),
          hat: G.hat.bar(b, d('hat'), eH),
          ohat: G.ohat.bar(b, d('ohat'), eH),
          perc: G.perc.bar(b, d('perc'), { ...e, kit: this.kit.perc }, absStep),
        };
        // el foley no pisa a la percusión (solo si suena: si no, tiene todos los pasos)
        out.foley = G.foley.bar(b, d('foley'), { ...e, kit: this.kit.foley }, absStep, prog.perc > 0 ? out.perc : null);
        G.hat.kindsBar({ hat: d('hat'), ohat: d('ohat') }, eH, out);
        return out;
      }),
      ...this.byPulse('bass', absStep, cx, [G.bass], (sh) => ({ bass: G.bass.bar(b, d('bass'), withCx(sh)) })),
      ...this.byPulse('inst', absStep, cx, [G.harmony], (sh) => ({ chord: G.harmony.chordBar(b, d('chord'), withCx(chordCx(sh))) })),
      pad: G.harmony.padBar(b, d('pad'), eI), // una nota larga por compás: sigue al fader
    };
    if (cx.avoid) this.takeTurns(this.bars, prog);
    this.kickDrop(b);
    this.dubThrow(b, t0);
    this.refreshSounds(); // un carril que mutó (u otro universo) pide ya su sonido nuevo
  }

  // BUS DE PERCUSIÓN con el ESTILO del universo (`bus` en styles.js; sin él, el camino directo de
  // siempre). Cambia justo antes del 1 del compás en que entra el universo (`t`), con un fundido
  // corto entre los dos caminos: sin clic, y los golpes de ese 1 (que se programan BUS_LAT antes)
  // ya van por el camino nuevo. `now` = ya, sin fundido (audio recién montado)
  setBus(sty, t, now = false) {
    const B = sty.t ? sty.k['bus'] : null;
    const on = !!B;
    const c = this.pbComp;
    const at = now ? t : Math.max(this.ctx.currentTime, t - 0.012);
    // salida del compresor: sin su ganancia de compensación (compMakeup), comprime y NO sube
    let wet = 0;
    if (on) {
      const u = sty.t;
      const thr = lerp(0, B.thr, u), ratio = lerp(1, B.ratio, u);
      c.threshold.setValueAtTime(thr, at);
      c.ratio.setValueAtTime(ratio, at);
      c.knee.setValueAtTime(B.knee, at);
      c.attack.setValueAtTime(B.attack, at);
      c.release.setValueAtTime(B.release, at);
      wet = 1 / compMakeup(thr, B.knee, ratio);
    }
    if (now) {
      this.pbDirect.gain.value = on ? 0 : 1;
      this.pbWet.gain.value = wet;
    } else if (on !== this.busOn || on) {
      this.pbDirect.gain.setTargetAtTime(on ? 0 : 1, at, 0.003);
      this.pbWet.gain.setTargetAtTime(wet, at, 0.003);
    }
    this.busOn = on;
    this.busLat = on ? busLatency(this.ctx.sampleRate) : 0;
  }

  // GROOVE (styles.js, `groove`; solo con ESTILO): cuándo suena el paso `s` de un instrumento.
  // Su swing (el del universo más el suyo, hasta 68 %) y su dibujo (entero adelantado o atrasado,
  // empuje-tirón y huella, fijos por paso), con el fader del estilo. Kick, clap y pad, y todo sin
  // estilo: la rejilla con el swing del universo, lo de siempre
  grooveTime(k, s, gridT) {
    const sd = this.engine.stepDur, sw0 = this.e.groove.swing;
    const G = this.sty.t ? this.sty.k.groove?.[GROOVE_OF[k]] : null;
    if (!G) return gridT + (s % 2 === 1 ? (sw0 - 0.5) * 2 * sd : 0);
    const u = this.sty.t;
    const sw = Math.min(0.68, sw0 + G.sw * u);
    return gridT + (s % 2 === 1 ? (sw - 0.5) * 2 * sd : 0) + G.tm[s] * u;
  }

  // THROW (el gesto dub del ESPACIO): en el último compás de algunas frases, el envío al delay del
  // PROTAGONISTA del eco se abre para su último golpe del compás (desde el 2º tiempo) y los ecos
  // caen sobre el 1 de la frase siguiente
  dubThrow(b, t0) {
    const D = this.space.dly;
    if (!D.throwP || !this.spaceFx || b % D.throwEvery !== D.throwEvery - 1) return;
    if (!this.spaceRng.chance(D.throwP)) return;
    const steps = this.bars[D.focus];
    let s = 15;
    while (s >= 4 && !steps?.[s]) s--;
    if (s < 4) return;
    const sd = this.engine.stepDur;
    const t = this.sty.t ? this.grooveTime(D.focus, s, t0 + s * sd) : t0 + s * sd + (s % 2 === 1 ? (this.e.groove.swing - 0.5) * 2 * sd : 0);
    // (el envío sale del canal, antes del BUS: para los del bus, el golpe sale `busLat` antes)
    const lat = PERC_BUS.includes(D.focus) ? this.busLat : 0;
    this.spaceFx.throwHit(D.focus, t - lat, Math.min(0.2, sd * 1.5));
  }

  // OSCILADOR: genera los pasos de un grupo con la complejidad de cada pulso y los cose.
  // Cada versión tira el mismo "dado" (se repite el estado aleatorio de sus generadores):
  // un golpe fantasma o un redoble que sale en una versión sale en la otra, y lo que cambia
  // es cuánto suena. Sin oscilar (o con unidad de compás o más) es un solo compás, como antes.
  // `make(shape)` = { instrumento: pasos } con la forma de complejidad de ese grupo.
  byPulse(g, absStep, base, gens, make) {
    const vals = [0, 4, 8, 12].map((s) => this.cxNow(g, absStep + s));
    const shapeOf = (v) => (v === this.cx[g] ? base : shapeComplexity({ ...this.cx, [g]: v }, this.sty))[g];
    const uniq = [...new Set(vals)];
    if (uniq.length === 1) return make(shapeOf(uniq[0]));
    const saved = gens.map((x) => x.rng.save());
    const out = new Map();
    for (const v of uniq) {
      gens.forEach((x, i) => x.rng.restore(saved[i]));
      out.set(v, make(shapeOf(v)));
    }
    const res = {};
    for (const k in out.get(uniq[0])) {
      res[k] = Array.from({ length: 16 }, (_, s) => out.get(vals[s >> 2])[k][s]);
      if (k === 'bass' || k === 'chord') trimLens(res[k]); // una nota de un pulso no pisa la del siguiente
    }
    return res;
  }

  // AUTO-ARREGLOS · CAÍDA DEL KICK AL FINAL DE FRASE: en el último compás de cada tramo de
  // `kickDropBars` compases (16 = cada dos frases de 8) el kick calla el último tiempo (el paso
  // 12; los fantasmas de después se quedan). Siempre en el mismo sitio: es un gesto de
  // arreglo, no de complejidad
  kickDrop(b) {
    const O = this.engine.auto;
    if (!O.kickDrop || b % O.kickDropBars !== O.kickDropBars - 1 || !this.bars.kick[12]) return;
    this.bars.kick = [...this.bars.kick];
    this.bars.kick[12] = null;
  }

  // TURNOS (complejidad baja): los acordes esquivan al bajo y la percusión deja
  // libres los golpes de acordes y clap. Menos choques = cada cosa se oye.
  takeTurns(B, prog) {
    if (prog.chord > 0 && prog.bass > 0) {
      for (let s = 0; s < 16; s++) {
        if (!B.chord[s] || !B.bass[s]) continue;
        const ev = B.chord[s];
        B.chord[s] = null;
        const t = s + 2; // una corchea más tarde, si está libre: respuesta en vez de choque
        if (t < 16 && !B.bass[t] && !B.chord[t] && !B.chord[t + 1] && !B.chord[t + 2]) {
          B.chord[t] = ev;
          s = t;
        }
      }
      trimLens(B.chord); // recalcular duraciones
    }
    if (prog.perc > 0) {
      for (let s = 0; s < 16; s++) {
        if ((prog.chord > 0 && B.chord[s]) || (prog.clap > 0 && B.clap[s])) B.perc[s] = null;
      }
    }
  }

  scheduleStep(n, gridT) {
    const s = n % 16;
    const b = Math.floor(n / 16);
    this.fx.step(n, gridT); // antes que las notas: en la llegada de un viaje DE GOLPE, el DROP
    // AHORA DE GOLPE: la parte que suena cambia de versión exacta en el 1 del compás
    const M = this.arr.morph;
    if (M && !M.len && n >= M.startStep) {
      this.arr.endMorph();
      for (const k of INSTRUMENTS) this.ch[k].applyTransition(this.arr.state[k].progress, this.fxPal.how[k], gridT, 0.006);
    }
    if (s === 0 || !this.bars.kick) this.prepareBar(b, n - s, gridT);
    // ¿ENTRA EL KICK DE GOLPE? En el paso anterior no sonaba y ahora está entero: un DROP DE
    // GOLPE, un cambio INSTANTÁNEO o un CORTE. Si entra poco a poco
    // (PROGRESIVA) no hay una entrada que marcar
    const kp = this.arr.state.kick.progress;
    const entered = this.kickWas <= 0.001 && kp >= 0.9;
    if (entered) this.kickEntry = true;
    else if (kp <= 0.001) this.kickEntry = false; // se fue antes de sonar
    this.kickWas = kp;
    this.autoArrange(n, gridT, kp, entered);
    const ctx = this.ctx;
    const noise = this.engine.noise;
    const e = this.e;
    const sd = this.engine.stepDur;
    const t = gridT + (s % 2 === 1 ? (e.groove.swing - 0.5) * 2 * sd : 0);
    const hum = () => (Math.random() - 0.5) * 2 * e.groove.humanize;
    const A = this.arr;
    const C = this.ch;
    const B = this.bars;
    const root = this.engine.rootHz;
    const scale = this.engine.scale;
    const emit = (k, time, vel) => this.events.push({ k, t: time, vel });
    // GROOVE por instrumento (solo con ESTILO: ver grooveTime). Sin estilo, todos en `t`, como siempre
    const tg = this.sty.t ? (k) => this.grooveTime(k, s, gridT) : () => t;

    let ev;
    if ((ev = B.kick[s]) && A.audible('kick', t)) {
      if (this.kickEntry) {
        this.kickEntry = false;
        if (this.engine.auto.kickGap) this.kickGap(t);
      }
      V.kick(ctx, C.kick.input, t, ev.vel, e.kick, root, noise);
      const depth = e.kick.duck * ev.vel * A.state.kick.progress;
      // SIDECHAIN al bajo: el suyo o, con EASY EQ en DJ, el bajo que suene en la mezcla
      const low = this.engine.low;
      if (low) low.duck(this, t, depth);
      else this.duckBass(t, depth);
      // un poco de bombeo en la armonía (sidechain), si este kick suena en la mezcla
      const lv = low ? low.kickLevel(this) : 1;
      for (const [k, amt] of [['chord', 0.25], ['pad', 0.35]]) {
        const dk = depth * lv * amt * A.state[k].progress;
        if (dk < 0.01) continue;
        C[k].duck.gain.setTargetAtTime(1 - dk, t, 0.004);
        C[k].duck.gain.setTargetAtTime(1, t + 0.05, 0.09);
      }
      // ESTILO: SIDECHAIN del kick a hats, percs y foley (`duck.*` en styles.js; el clap NO): el
      // kick asoma y la percusión se sienta detrás, entre golpe y golpe. Van por el BUS: su
      // bajada se programa BUS_LAT antes, como sus golpes
      const Sy = this.sty;
      if (Sy.t) {
        const td = t - this.busLat;
        for (const k of PERC_BUS) {
          const amt = Sy.k[`duck.${k}`];
          const dk = amt ? Math.min(0.6, depth * lv * amt * Sy.t * A.state[k].progress) : 0;
          if (dk < 0.01) continue;
          C[k].duck.gain.setTargetAtTime(1 - dk, td, 0.003);
          C[k].duck.gain.setTargetAtTime(1, td + 0.06, 0.07);
        }
      }
      emit('kick', t, ev.vel);
    }
    if ((ev = B.clap[s]) && A.audible('clap', t)) {
      const tc = t + e.groove.clapNudge + hum();
      V.clap(ctx, C.clap.input, tc, ev.vel, e.clap, noise);
      emit('clap', tc, ev.vel);
    }
    // HATS Y PERCS: cada golpe va a su ranura (drumSlots.js), que sabe su sonido y sus colas.
    // `ty` = tipo de hat de la VARIEDAD (1..4); sin él, el hat del universo.
    // Van por el BUS DE PERCUSIÓN: con su compresor encendido salen `lat` antes (llegan a tiempo)
    const lat = this.busLat;
    if ((ev = B.hat[s]) && A.audible('hat', t)) {
      const th = Math.max(tg('hat') + hum() - lat, ctx.currentTime);
      if (this.drums.hit(ev.ty ? `k${ev.ty - 1}` : 'hat', th, ev.vel)) emit('hat', th + lat, ev.vel);
    }
    if ((ev = B.ohat[s]) && A.audible('ohat', t)) {
      const th = Math.max(tg('ohat') + hum() * 0.5 - lat, ctx.currentTime);
      if (this.drums.hit(ev.ty ? `k${ev.ty - 1}` : 'ohat', th, ev.vel)) emit('ohat', th + lat, ev.vel);
    }
    if ((ev = B.perc[s]) && A.audible('perc', t)) {
      const tq = tg('perc');
      for (const h of ev) {
        const tp = Math.max(tq + hum() - lat, ctx.currentTime);
        if (this.drums.hit(`p${h.n}`, tp, h.vel)) emit('perc', tp + lat, h.vel);
      }
    }
    // FOLEY: en su paso, sin humanizar (el gesto ya lleva su tiempo dentro del sonido)
    if ((ev = B.foley[s]) && A.audible('foley', t)) {
      const tf = Math.max(tg('foley') - lat, ctx.currentTime);
      for (const h of ev) if (this.drums.hit(`f${h.n}`, tf, h.vel)) emit('foley', tf + lat, h.vel);
    }
    if ((ev = B.bass[s]) && A.audible('bass', t)) {
      const semis = degreeToSemis(ev.deg, scale) + 12;
      const dur = Math.max(sd * 0.55, ev.len * sd * e.bass.lenMul - 0.01);
      const tb = tg('bass');
      V.bass(ctx, C.bass.input, tb, ev.vel, root * Math.pow(2, semis / 12), dur, e.bass, this.engine.q.lean);
      emit('bass', tb, ev.vel);
    }
    // acordes y pad: dos octavas sobre la tónica del kick
    const freqsOf = (notes) => notes.map((d) => root * Math.pow(2, (degreeToSemis(d, scale) + 24) / 12));
    if ((ev = B.chord[s]) && A.audible('chord', t)) {
      const dur = Math.max(sd * 0.5, ev.len * sd * e.chord.lenMul - 0.01);
      const tc = tg('chord');
      V.chord(ctx, C.chord.input, tc, ev.vel, freqsOf(ev.notes), dur, e.chord, this.engine.q.lean);
      emit('chord', tc, ev.vel);
    }
    if ((ev = B.pad[s]) && A.audible('pad', t)) {
      const freqs = freqsOf(ev.notes); // sin tónica grave: esa octava es del bajo
      const key = freqs.map((f) => f.toFixed(2)).join('|');
      const pv = this.padVoice;
      // si ya suena este mismo acorde, se deja sonar; si no, fundido al nuevo
      if (!pv || pv.key !== key || pv.holdEnd <= t + 0.01) {
        if (pv) pv.release(t, Math.max(0.4, e.pad.attack));
        const hold = ev.bars * this.engine.barDur;
        this.padVoice = V.pad(ctx, C.pad.input, t, ev.vel, freqs, hold, e.pad, noise, this.engine.q.lean);
        if (this.engine.q.blockFilters) blockRate(this.padVoice.filter); // CALIDAD: el filtro lento del pad, por bloques
        this.padVoice.key = key;
        emit('pad', t, ev.vel);
      }
    }
  }

  // MIXER: nivel de pico de un instrumento ahora (lo que sale de su canal). El medidor se crea
  // la primera vez que se pide: sin el MIXER abierto no cuesta nada
  instLevel(k) {
    const ch = this.mixChannel(k);
    if (!ch) return 0;
    if (!ch.meter) {
      ch.meter = this.ctx.createAnalyser();
      ch.meter.fftSize = 256;
      ch.meterBuf = new Float32Array(ch.meter.fftSize);
      ch.out.connect(ch.meter);
    }
    ch.meter.getFloatTimeDomainData(ch.meterBuf);
    let p = 0;
    for (const v of ch.meterBuf) p = Math.max(p, Math.abs(v));
    return p;
  }

  // paso en el que cae un DROP que se sabe por adelantado: un viaje DE GOLPE en el que entra
  // el kick (ahora no suena y en el destino sí). null si no hay. Lo instantáneo (INSTANTÁNEO,
  // CORTE) no se puede anticipar, y en un viaje progresivo el kick ya suena antes de llegar
  dropStep() {
    const T = this.arr.travel;
    if (!T || !T.drop || !T.bars || T.paused) return null;
    if (this.arr.state.kick.progress > 0.001 || T.to.kick < 0.5) return null;
    return T.startStep + T.bars * 16;
  }

  // AUTO-ARREGLOS que dependen del momento del tema (en cada paso, exactos a la muestra en gridT):
  //   BAJO FUERA        el bajo calla el último tiempo antes del drop y vuelve en el 1
  //   GRAVES QUE BAJAN  durante el último compás antes del drop los graves bajan poco a poco
  //                     (estante en 200 Hz) y vuelven en el 1
  //   MENOS VOLUMEN SIN KICK  sin kick el universo suena algo más bajo; al entrar el kick
  //                     recupera el nivel (de golpe si entra de golpe): el drop parece más grande
  // Si el viaje se cancela, se pausa o se apaga la opción, todo vuelve a su sitio desde ese paso.
  autoArrange(n, t, kp, entered) {
    const O = this.engine.auto, S = this.autoOn;
    const sd = this.engine.stepDur;
    const N = this.dropStep();
    const left = N === null ? Infinity : N - n; // pasos que faltan para el drop

    const bass = O.bassOut && left > 0 && left <= 4;
    if (bass !== S.bass) {
      S.bass = bass;
      // baja en 4 ms acabando justo en el último tiempo; vuelve en 2 ms acabando en el 1
      this.rampTo(this.ch.bass.auto.gain, bass ? 1 : 0, bass ? 0 : 1, t - (bass ? 0.004 : 0.002), t);
    }

    const lows = O.lowsDip && left > 0 && left <= 16;
    if (lows !== S.lows) {
      S.lows = lows;
      if (lows) this.rampTo(this.lows.gain, 0, O.lowsDb, t, t + left * sd - 0.005); // hasta justo antes del 1
      else this.rampTo(this.lows.gain, O.lowsDb, 0, t - 0.005, t);
    }

    const low = O.breakDip ? Math.pow(10, O.breakDb / 20) : 1;
    const g = low + (1 - low) * kp;
    if (Math.abs(g - S.contrast) > 1e-3) {
      // entra de golpe: casi seco en ese paso; baja despacio; sube con el kick progresivo
      const tc = entered ? 0.003 : g < S.contrast ? 0.4 : 0.05;
      S.contrast = g;
      this.contrast.gain.setTargetAtTime(g, t, tc);
    }
  }

  // rampa lineal hasta `to` entre a y b, cortando lo que hubiera programado desde a. Parte del
  // valor que tendría el parámetro en a según la última rampa (se apunta en `this.ramps`), con un
  // punto fijo en a. No se usa cancelAndHold: en Chrome, sin eventos previos, la rampa que va
  // detrás empezaba antes de tiempo (medido: el bajo se cortaba ~60 ms antes del último tiempo)
  rampTo(param, from, to, a, b) {
    const now = this.ctx.currentTime;
    a = Math.max(now, a);
    b = Math.max(a + 0.001, b);
    const R = (this.ramps ||= new Map());
    const r = R.get(param);
    const v = !r ? from : a >= r.b ? r.v1 : a <= r.a ? r.v0 : r.v0 + (r.v1 - r.v0) * (a - r.a) / (r.b - r.a);
    param.cancelScheduledValues(a);
    param.setValueAtTime(v, a);
    param.linearRampToValueAtTime(to, b);
    R.set(param, { v0: v, v1: to, a, b });
  }

  // AUTO-ARREGLOS · HUECO ANTES DEL KICK: el universo entero calla unos milisegundos justo
  // antes del primer golpe del kick que entra (lo de cortar la cola antes del drop, en vivo).
  // Se programa a la vez que ese golpe, así que ya no se puede deshacer: si el golpe suena,
  // el hueco también. Rampas cortas a los dos lados (sin clics): baja en 4 ms y vuelve en
  // 2 ms, entero justo en el ataque del kick
  kickGap(t) {
    const g = this.pre.gain;
    const now = this.ctx.currentTime;
    const len = this.engine.auto.kickGapS;
    const down = 0.004, up = 0.002;
    const a = Math.max(now, t - len - down); // empieza a bajar (si va tarde, ya)
    const s = Math.max(a + 0.001, t - len);  // en silencio
    const u = Math.max(s, t - up);           // empieza a volver
    if (u <= now) return; // demasiado tarde para que se oiga: mejor nada que un salto
    g.cancelScheduledValues(a);
    g.setValueAtTime(1, a);
    g.linearRampToValueAtTime(0, s);
    g.setValueAtTime(0, u);
    g.linearRampToValueAtTime(1, t);
  }

  // SIDECHAIN: un kick (de este universo o, con EASY EQ, del otro) empuja a este bajo
  duckBass(t, depth) {
    if (depth < 0.001) return;
    const g = this.ch.bass.duck.gain;
    g.setTargetAtTime(1 - depth, t, 0.003);
    g.setTargetAtTime(1, t + 0.045, 0.055);
  }

  // pausa: soltar lo que se sostiene (el pad)
  release(at) {
    this.fx.kill(at);
    if (this.padVoice) this.padVoice.release(at, 1.2);
    this.padVoice = null;
  }
}
