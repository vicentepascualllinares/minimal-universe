// UNIVERSOS GUARDADOS (2026-11-11): volver a tener un universo que gustó.
//
// Dos maneras:
//   CÓDIGO DE SEMILLA  «968782145-RO100-124-F#EOL-M1» (semilla · estilo y cuánto · «-P60» si la PUREZA no
//                      es 100 % · TEMPO · TÓNICA y MODO con los que sonaba · MOTOR, ver src/motores/LEEME.md;
//                      sin «-M», el MOTOR 1: los códigos de antes de los motores): vuelve a generar el universo
//                      TAL COMO NACE (estilo, generadores, espacio, transiciones, color, complejidad,
//                      osciladores, CANT · VAR). Corto: se copia, se apunta, se escribe. Tempo y escala
//                      son opcionales al escribirlo, y al traerlo solo se aplican si se pide
//   ARCHIVO (.json)    el universo TAL COMO SUENA: además, lo que ha MUTADO mientras sonaba (los
//                      generadores y sus dados), lo que se ha TOCADO (complejidad, osciladores, CANT ·
//                      VAR, envíos, MIXER de ese universo) y los globales con los que sonaba (BPM,
//                      tónica y modo; como en el código, solo se aplican si se pide). Desde 2026-11-12,
//                      además (Engine.completeCapture, al guardar desde la app): MUTE y SOLO de todos
//                      sus canales, OSCILADORES en silencio, compases y FX del CLIC y, con los globales,
//                      el MÁSTER y el preset del MIXER. Para cargarlo se
//                      rehace desde su semilla y encima se pone lo guardado: lo que se deriva (el estilo,
//                      la respuesta del bajo...) no se guarda.
// La estructura (la escena, los viajes) no va en el universo: es del intérprete.
// Sin DOM ni audio: lo usan el Deck (cargar), la vista (guardar) y las herramientas de Node.

import { STYLES } from './styles.js';
import { MIX_CHANNELS } from './arrangement.js';
import { Rng, lerp } from '../core/rng.js';
import { randomComplexity, randomOsc } from './complexity.js';
import { randomKit } from './kit.js';
import { SCALES } from './emotion.js';

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
export const UNIVERSE_VERSION = 1;

// ───────────────────────── CÓDIGO DE SEMILLA
// el estilo con su abreviatura (`code` en el perfil; si no, sus dos primeras letras)
const styleCode = (name) => (STYLES[name]?.code ?? name.slice(0, 2)).toUpperCase();
const pct = (x) => String(Math.round(x * 1000) / 10).replace(/\.0$/, '');
// TÓNICA y MODO: la nota (la tónica del kick, E1..B1 en el motor) y las tres primeras letras del modo
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const modeCode = (i) => SCALES[i].name.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 3).toUpperCase();
const noteMidi = (pc) => (pc >= 4 ? 24 + pc : 36 + pc); // E1..B1 y, de C a D#, la octava de arriba
// «124 BPM · F# EÓLICO»
export const describeGlobal = (G) => [
  G?.bpm ? `${String(G.bpm).replace('.', ',')} BPM` : '',
  G?.rootMidi !== undefined && SCALES[G.scaleI] ? `${NOTES[G.rootMidi % 12]} ${SCALES[G.scaleI].name.toUpperCase()}` : '',
].filter(Boolean).join(' · ');

// `u` = { seed, style: { name, t, purity } | null, global?: { bpm, rootMidi, scaleI } }
export function seedCode(u) {
  const S = u.style, G = u.global;
  let c = String(u.seed >>> 0);
  if (S && S.t > 0 && S.name) c += `-${styleCode(S.name)}${pct(S.t)}${S.purity < 1 ? `-P${pct(S.purity)}` : ''}`;
  if (G?.bpm) c += `-${String(G.bpm)}`;
  if (G?.rootMidi !== undefined && SCALES[G.scaleI]) c += `-${NOTES[G.rootMidi % 12]}${modeCode(G.scaleI)}`;
  if (u.motor) c += `-M${u.motor}`;
  return c;
}

// lo contrario: null si no se entiende. Acepta espacios, «·» o «-» entre las partes, minúsculas y
// coma decimal («968782145 ro 73,5 p60 124 f# eol»). Sin estilo = NORMAL; sin tempo y escala, sin
// `global`. Las partes, en cualquier orden tras la semilla
export function parseSeedCode(str) {
  const toks = String(str).trim().toUpperCase().replace(/,/g, '.').replace(/[·\s]+/g, '-').split('-').filter(Boolean);
  if (!toks.length || !/^\d{1,10}$/.test(toks[0])) return null;
  const seed = Number(toks[0]);
  if (!(seed >= 0 && seed <= 0xffffffff)) return null;
  const out = { seed, style: null };
  const G = {};
  for (let i = 1; i < toks.length; i++) {
    let t = toks[i];
    // «RO 100» escrito separado: las letras de un estilo y su número
    if (/^[A-Z]{2,}$/.test(t) && /^\d+(\.\d+)?$/.test(toks[i + 1] ?? '') && Object.keys(STYLES).some((n) => styleCode(n) === t)) t += toks[++i];
    // y la tónica y el modo separados: «F# EOL»; y el motor: «M 1»
    if (/^[A-G]#?$/.test(t) && /^[A-Z]{3,}$/.test(toks[i + 1] ?? '')) t += toks[++i];
    if (t === 'M' && /^\d{1,3}$/.test(toks[i + 1] ?? '')) t += toks[++i];
    let m;
    if ((m = /^M(\d{1,3})$/.exec(t))) out.motor = Number(m[1]);
    else if ((m = /^P(\d+(?:\.\d+)?)$/.exec(t))) { if (!out.style) return null; out.style.purity = Math.min(1, Number(m[1]) / 100); }
    else if ((m = /^([A-Z]{2,})(\d+(?:\.\d+)?)$/.exec(t))) {
      const name = Object.keys(STYLES).find((n) => styleCode(n) === m[1]);
      if (!name) return null;
      out.style = { name, t: Math.min(1, Number(m[2]) / 100), purity: out.style?.purity ?? 1 };
    } else if ((m = /^(\d{2,3}(?:\.\d+)?)$/.exec(t))) G.bpm = Math.min(140, Math.max(100, Number(m[1])));
    else if ((m = /^([A-G]#?)([A-Z]{3,})$/.exec(t))) {
      const scaleI = SCALES.findIndex((_, k) => m[2].startsWith(modeCode(k)));
      if (scaleI < 0) return null;
      G.rootMidi = noteMidi(NOTES.indexOf(m[1]));
      G.scaleI = scaleI;
    } else return null;
  }
  if (G.bpm || G.rootMidi) out.global = G;
  return out;
}

// ───────────────────────── ESTADO DE LOS GENERADORES
// Lo que no se guarda porque sale del estilo o de otros campos (se rehace al cargar)
const DERIVED = new Set(['sty', 'feel', 'cell', 'answer']);
const isRng = (x) => x && typeof x.next === 'function' && 'a' in x;

export function genState(gen) {
  const out = {};
  for (const [k, g] of Object.entries(gen)) {
    if (isRng(g)) { out[k] = { rng: g.a }; continue; }
    const o = {};
    for (const [f, v] of Object.entries(g)) {
      if (DERIVED.has(f) || typeof v === 'function') continue;
      o[f] = isRng(v) ? { rngA: v.a } : clone(v);
    }
    out[k] = o;
  }
  return out;
}

// pone el estado guardado sobre unos generadores recién hechos con la misma semilla y estilo
export function applyGenState(gen, saved) {
  for (const [k, o] of Object.entries(saved)) {
    const g = gen[k];
    if (!g) continue;
    if (isRng(g)) { g.a = o.rng; continue; }
    for (const [f, v] of Object.entries(o)) {
      if (DERIVED.has(f)) continue;
      if (v && typeof v === 'object' && 'rngA' in v && isRng(g[f])) g[f].a = v.rngA;
      else g[f] = clone(v);
    }
    g.restored?.(); // lo derivado (la respuesta del bajo...)
  }
  return gen;
}

// ───────────────────────── EL CARÁCTER (lo que NUEVO UNIVERSO sortea aparte de los generadores)
// Color (valencia y activación, en la zona del estilo), complejidad de cada grupo, osciladores y
// CANT · VAR, de la semilla y el estilo. Lo usan Deck.newCharacter y el PARECIDO (similar.js)
export function rollCharacter(seed, S) {
  const r = new Rng(seed ^ 0x9e3779b9);
  const t = S.t;
  // con estilo, el color se sortea en su zona (mismas dos tiradas)
  const range = (a, b, R) => (t && R ? r.float(lerp(a, R[0], t), lerp(b, R[1], t)) : r.float(a, b));
  const v = range(-0.8, 0.8, S.v), a = range(-0.7, 0.7, S.a);
  const cx = randomComplexity(r, S);
  const osc = randomOsc(r, cx, S);
  const kit = randomKit(r, S); // al final: la misma semilla sigue dando el mismo color y complejidad
  return { v, a, cx, osc, kit };
}

// ───────────────────────── LO DEL ESTILO QUE NO SALE DE LA SEMILLA
// Un universo PARECIDO (similar.js) mezcla partes del estilo de dos universos: eso ya no saldría de
// su semilla y va en el archivo (`styleData`). Lo mezclable del estilo de un universo
export function styleDataOf(sty) {
  return {
    arch: sty.arch, archLabel: sty.archLabel, archDesc: sty.archDesc, bassMode: sty.bassMode, chordMode: sty.chordMode,
    color: Array.from(sty.color), mix: clone(sty.mix), mutes: [...sty.mutes],
    k: {
      'bass.feel': clone(sty.k['bass.feel']), groove: clone(sty.k.groove),
      'kick.skip': sty.k['kick.skip'], 'kick.pickup': sty.k['kick.pickup'], 'loop.bars': sty.k['loop.bars'], 'perc.back': sty.k['perc.back'],
    },
  };
}
// y ponerlo en un estilo recién sorteado (Deck.loadUniverse, antes de hacer los generadores)
export function applyStyleData(sty, D) {
  if (!D || !(sty.t > 0)) return sty;
  Object.assign(sty, { arch: D.arch, archLabel: D.archLabel, archDesc: D.archDesc, bassMode: D.bassMode, chordMode: D.chordMode });
  sty.color = Float64Array.from(D.color);
  sty.mix = clone(D.mix);
  sty.mutes = [...D.mutes];
  for (const [key, v] of Object.entries(D.k)) if (v !== undefined) sty.k[key] = clone(v);
  return sty;
}

// ───────────────────────── EL UNIVERSO QUE SUENA
// `deck` = el universo; `i` = su número en el motor (0 = A, 1 = B)
export function captureUniverse(deck, engine) {
  const i = engine.slotOf(deck);
  const S = deck.sty;
  const style = S.t > 0 ? { name: S.name, t: S.t, purity: S.purity ?? 1 } : null;
  const { sty, ...fxPal } = deck.fxPal;
  const u = {
    app: 'MINIMAL UNIVERSE', version: UNIVERSE_VERSION, saved: new Date().toISOString(),
    seed: deck.seed >>> 0, style,
    motor: deck.motor ?? undefined, // el MOTOR que lo hace sonar (src/motores/LEEME.md)
    global: { bpm: engine.bpm, rootMidi: engine.rootMidi, scaleI: engine.scaleNext ?? engine.scaleI },
    gen: genState(deck.gen),
    cx: clone(deck.cx), osc: clone(deck.osc), kit: clone(deck.kit),
    color: { v: deck.emotion.tv, a: deck.emotion.ta },
    space: clone(deck.space), spaceRng: deck.spaceRng.a,
    fxPal: clone(fxPal), fxRng: deck.fxRng.a,
    transition: { form: deck.form, flow: deck.flow },
    tune: clone(deck.tune), // AFINAR: TECHO, ZONA y el 8 del bajo, NOTA del kick (tune.js)
    mix: i < 0 ? null : {
      inst: Object.fromEntries(MIX_CHANNELS.map((k) => [k, engine.inst[i][k]])),
      mute: [...engine.mute[i]], fxPos: engine.fxPos[i], fxGain: engine.fxGain[i],
    },
    bars: Math.floor(engine.step / 16), // cuántos compases llevaba sonando (solo informativo)
    // lo del estilo (para el PARECIDO, y si ya era un parecido, lo suyo: no sale de la semilla)
    styleData: S.t > 0 ? styleDataOf(S) : null,
    similar: deck.similarOf ?? undefined,
  };
  // (un PARECIDO no se rehace con su semilla: su código lo dice, y su archivo no pisa al original)
  u.code = seedCode(u) + (deck.similarOf ? `-PARECIDO-${deck.similarOf.with}` : '');
  return u;
}

// un archivo leído: el universo si se entiende (con lo mínimo: semilla), si no null
export function readUniverse(text) {
  let u;
  try { u = JSON.parse(text); } catch { return null; }
  if (!u || typeof u !== 'object' || !(u.seed >= 0)) return null;
  if (u.style && !STYLES[u.style.name]) return null;
  return u;
}
export const universeFileName = (u) => `universo-${u.code ?? seedCode(u)}.json`;
