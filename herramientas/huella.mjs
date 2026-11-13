// HUELLA DE UN MOTOR: todo lo que el motor programa en el audio, resumido en un hash.
//
//   node huella.mjs <srcDir> [motor] [--guardar <archivo>] [--comprobar <archivo>]
//
// Corre el motor de verdad (src/audio/engine.js de `srcDir`, con sus dos universos) sin navegador,
// con un audio de mentira que apunta CADA cosa que se le pide: cada nodo que se crea, cada conexión,
// cada valor y cada rampa de cada parámetro (con su tiempo), cada golpe que empieza y cada búfer
// (con su contenido: los hats y percs grabados, las salas). El azar (Math.random) va sembrado, así
// que el mismo código da siempre la misma huella. Si un solo golpe, una nota, un filtro o un
// volumen cambian, cambia el hash.
//
// Toca con los universos guardados de `universos/` y unas semillas fijas (NORMAL y ROMINIMAL), en DJ,
// con cambios de parte, un NUEVO UNIVERSO y un PARECIDO por medio. Sirve para:
//   - que un cambio en ALPHA (el motor de src/) NO QUITE NADA de lo que había: los universos de antes
//     tienen que sonar EXACTAMENTE igual. Su huella de referencia está en herramientas/referencias/
//     (ver --comprobar). Igual con un motor congelado (src/motores/<nombre>), si algún día lo hay
//   - que una reorganización del código que no debe cambiar el sonido no lo cambie (antes / después)
// `motor` (opcional): con qué motor nacen los universos, por su nombre (si `srcDir` sabe de motores).
// SINFX=1: los viajes sin efectos de transición (para comparar solo la música y el sonido).
// Variables: SEG=96 (segundos de cada caso), SOLO=nombre (un solo caso), VER=1 (cuenta lo apuntado).

import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const src = path.resolve(args[0] ?? '../src');
const motorArg = args[1] && !args[1].startsWith('--') ? args[1] : null;
const flag = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const SEG = Number(process.env.SEG ?? 96);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ───────────────────────── AZAR SEMBRADO
let rs = 0x9e3779b9;
const reseedRandom = (s) => { rs = s >>> 0; };
Math.random = () => {
  rs = (rs + 0x6d2b79f5) >>> 0;
  let t = rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ───────────────────────── LO APUNTADO
let H = crypto.createHash('sha256');
let lines = 0;
let bad = 0; // valores NaN o infinitos (un fallo siempre)
const tally = {};
const rec = (s) => {
  H.update(s); H.update('\n'); lines++;
  if (process.env.VER) { const k = s.replace(/[0-9.e+-]+/g, '#').replace(/\(.*$/, '(').slice(0, 40); tally[k] = (tally[k] || 0) + 1; }
};
const num = (x) => (typeof x === 'number' ? String(x) : x === undefined ? 'u' : x === null ? 'n' : String(x));
const sumArr = (a) => crypto.createHash('sha1').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex').slice(0, 16);

// ───────────────────────── AUDIO DE MENTIRA
let now = 0;
let nid = 0;
let bid = 0;

class FakeBuffer {
  constructor(o, len, sr) {
    if (typeof o === 'object') ({ numberOfChannels: o, length: len, sampleRate: sr } = o);
    this.id = `b${bid++}`;
    this.numberOfChannels = o; this.length = len; this.sampleRate = sr;
    this.duration = len / sr;
    this.data = Array.from({ length: o }, () => new Float32Array(len));
  }
  getChannelData(c) { return this.data[c]; }
  copyToChannel(a, c) { this.data[c].set(a); }
  sum() { return this.data.map(sumArr).join('+'); }
}
globalThis.AudioBuffer = FakeBuffer;

const PARAMS = new Set(['gain', 'frequency', 'Q', 'detune', 'playbackRate', 'delayTime', 'pan', 'threshold', 'ratio',
  'knee', 'attack', 'release', 'offset']);
const show = (v) => (v instanceof FakeBuffer ? `${v.id}:${v.sum()}` : ArrayBuffer.isView(v) ? `arr:${sumArr(v)}` : v && typeof v === 'object' && v.id ? v.id : num(v));

function fakeParam(owner, name, def = 0) {
  let value = def;
  const P = {
    get value() { return value; },
    set value(v) { value = v; rec(`${owner}.${name}=${num(v)}`); },
    defaultValue: def, minValue: -3.4e38, maxValue: 3.4e38,
  };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime',
    'cancelScheduledValues', 'cancelAndHoldAtTime']) {
    P[m] = (...a) => { rec(`${owner}.${name}.${m}(${a.map(num).join(',')})`); return P; };
  }
  P.setValueCurveAtTime = (arr, t, d) => { rec(`${owner}.${name}.curve(${sumArr(Float32Array.from(arr))},${t},${d})`); return P; };
  P.id = `${owner}.${name}`;
  return P;
}

function fakeNode(kind) {
  const id = `${kind}${nid++}`;
  rec(`new ${id}`);
  const store = { id };
  const self = new Proxy(store, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k !== 'string') return undefined;
      if (PARAMS.has(k)) return (o[k] = fakeParam(id, k, k === 'gain' ? 1 : 0));
      switch (k) {
        case 'connect': return (d, a, b) => { rec(`${id}>${d?.id}${a !== undefined ? `:${a}` : ''}${b !== undefined ? `:${b}` : ''}`); return d; };
        case 'disconnect': return (d) => rec(`${id} x ${d?.id ?? '*'}`);
        case 'start': return (t, off, dur) => rec(`${id}.start(${num(t)},${num(off)},${num(dur)})`);
        case 'stop': return (t) => rec(`${id}.stop(${num(t)})`);
        case 'getFloatTimeDomainData': case 'getFloatFrequencyData': case 'getByteTimeDomainData': return () => {};
        case 'reduction': return 0;
        case 'channelCount': return 2;
        case 'numberOfOutputs': return 1;
        case 'context': return ctx;
        default: return undefined;
      }
    },
    set(o, k, v) {
      o[k] = v;
      if (k !== 'onended' && k !== 'onaudioprocess') rec(`${id}.${String(k)}=${show(v)}`);
      return true;
    },
  });
  return self;
}

const ctx = {
  get currentTime() { return now; },
  sampleRate: 48000,
  state: 'running',
  baseLatency: 0.01, outputLatency: 0.02,
  resume: async () => {}, close: async () => {}, suspend: async () => {},
  createBuffer: (c, l, s) => new FakeBuffer(c, l, s),
};
for (const k of ['Gain', 'BiquadFilter', 'BufferSource', 'ChannelMerger', 'ChannelSplitter', 'Convolver', 'Delay',
  'DynamicsCompressor', 'Oscillator', 'ScriptProcessor', 'StereoPanner', 'WaveShaper', 'Analyser', 'ConstantSource']) {
  ctx[`create${k}`] = () => fakeNode(k);
}
ctx.destination = fakeNode('Destination');

// RELOJ SIMULADO: los temporizadores, performance.now y Date.now siguen al tiempo del audio de
// mentira (no al reloj de la máquina): si no, la huella cambiaría según lo rápido que vaya el ordenador
let timers = [];
let tseq = 0;
globalThis.setTimeout = (fn, ms = 0, ...a) => { const t = { at: now + Math.max(0, ms) / 1000, seq: tseq++, fn, a }; timers.push(t); return t; };
globalThis.clearTimeout = (t) => { timers = timers.filter((x) => x !== t); };
globalThis.setInterval = () => ({});
globalThis.clearInterval = () => {};
function runTimers() {
  for (;;) {
    const due = timers.filter((t) => t.at <= now + 1e-9);
    if (!due.length) return;
    due.sort((x, y) => x.at - y.at || x.seq - y.seq);
    const t = due[0];
    timers = timers.filter((x) => x !== t);
    t.fn(...t.a);
  }
}
Object.defineProperty(globalThis, 'performance', { value: { now: () => now * 1000 }, configurable: true });
Date.now = () => 1.7e12 + Math.round(now * 1000);

globalThis.window = globalThis;
globalThis.location = { search: '' }; // perfil de ordenador (core/profile.js)
globalThis.AudioContext = function () { return ctx; };
globalThis.document = { visibilityState: 'visible', createElement: () => ({ click() {}, style: {} }), body: { appendChild() {}, removeChild() {} } };
globalThis.Worker = class { constructor(u, o) { if (o?.type === 'module') throw new Error('sin Worker de módulos'); } postMessage() {} terminate() {} };
try { globalThis.localStorage = undefined; } catch {}

// ───────────────────────── EL MOTOR
const imp = (p) => import(pathToFileURL(path.join(src, p)).href);
const { Engine } = await imp('audio/engine.js');
const motors = await imp('motores/index.js').catch(() => null);

// lo que toca en este instante: los temporizadores vencidos y lo que el banco tenga pendiente (en
// Node graba en el hilo principal, con setTimeout 0: aquí todo lo pedido queda grabado ya)
function drain(E) {
  for (let i = 0; i < 100000; i++) {
    runTimers();
    const banks = E.banks ? Object.values(E.banks) : [E.bank];
    if (banks.every((b) => !b || (!b.busy && !b.queue.size && !b.urgent.size))) return;
  }
  throw new Error('el banco no acaba');
}

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
// los universos de los casos: una copia fija (herramientas/referencias/universos), así la huella no
// cambia porque se guarde o se borre algo en la biblioteca. Otra carpeta: --universos <carpeta>
const dir = path.resolve(flag('--universos') ?? path.join(ROOT, 'herramientas', 'referencias', 'universos'));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && read(path.join(dir, f)).seed >= 0).sort(); // (solo universos: con semilla)
const U = Object.fromEntries(files.map((f) => [f.replace(/\.json$/, ''), read(path.join(dir, f))]));
const seedU = (seed, t = 0, purity = 1) => ({ seed, style: t > 0 ? { name: 'rominimal', t, purity } : null });

// casos: [A, B, globales de A]. Los archivos, tal como sonaban (con su tempo y escala)
const names = Object.keys(U);
const CASES = [];
for (let i = 0; i < names.length; i += 2) CASES.push([`${names[i]} + ${names[i + 1] ?? 'semilla'}`, U[names[i]], U[names[i + 1]] ?? seedU(424242, 1)]);
CASES.push(['semillas ROMINIMAL 100 + NORMAL', seedU(968782145, 1), seedU(123456789, 0)]);
CASES.push(['semillas ROMINIMAL 60 P70 + ROMINIMAL 35', seedU(31337, 0.6, 0.7), seedU(2718281828, 0.35)]);

// lo que hace el intérprete: [compás, universo, acción, arg]
const SCRIPT = [
  [2, 0, 'press', 'groove'], [3, 1, 'press', 'groove'],
  [8, 0, 'press', 'main'], [10, 1, 'press', 'drift'],
  [14, 0, 'press', 'drop'], [16, 1, 'press', 'main'],
  [18, 1, 'reseed'], [22, 0, 'press', 'break'], [24, 0, 'press', 'drop'],
  [26, 0, 'similar'], [30, 1, 'press', 'drop'], [34, 0, 'press', 'kickout'], [36, 0, 'press', 'main'],
  [40, 0, 'reseed'], [44, 1, 'press', 'build'],
];
// MEZCLA=<motor> (cuando haya más de uno): además, cambios de MOTOR mientras suena (un universo de ese
// motor en B, NUEVO UNIVERSO con él en A, vuelta a un guardado del suyo y un guardado traído con ese:
// tal como nace). No es una referencia: comprueba que no falla nada
if (process.env.MEZCLA) {
  const g = U[names[0]], X = process.env.MEZCLA;
  SCRIPT.push([12, 1, 'load', { ...seedU(555, 1), motor: X }], [20, 0, 'motor', X], [20, 0, 'reseed'],
    [28, 0, 'load', g], [32, 1, 'load', { ...g, motor: undefined, forceMotor: X }], [38, 1, 'similar']);
  SCRIPT.sort((a, b) => a[0] - b[0]);
}

const results = {};
const all = crypto.createHash('sha256');
for (const [name, ua, ub] of CASES) {
  if (process.env.SOLO && !name.includes(process.env.SOLO)) continue;
  H = crypto.createHash('sha256'); lines = 0; bad = 0; now = 0; nid = 0; bid = 0; timers = []; tseq = 0;
  reseedRandom(0x1234567);
  const E = new Engine(motors ? { motors: motors.MOTORS, dev: motors.DEV_MOTOR, start: motorArg ?? undefined } : undefined);
  // los NUEVO UNIVERSO de los casos nacen como antes (sin lo nuevo del motor: Engine.novelties); lo nuevo
  // se mide aparte (atmos.mjs). Así la huella sigue comparando lo de siempre
  E.novelties = {};
  E.mode = 'dj';
  E.rootMidi = Number(process.env.ROOT ?? 30); E.bpm = 124; E.scaleI = 1; // ROOT = tónica (MIDI, 28..39)
  await E.prepare();
  const [A, B] = E.decks;
  const load = (d, u, g, m = motorArg) => (m && E.multi ? d.loadUniverse(u, g, m) : d.loadUniverse(u, g));
  if (motorArg && E.multi) for (const d of E.decks) d.motorNext = motorArg;
  load(A, ua, true);
  load(B, ub, false);
  await drain(E);
  await E.play();
  const errors = [];
  const origLog = E.logIncident.bind(E);
  E.logIncident = (type, detail) => { errors.push(`${type}: ${detail}`); try { origLog(type, detail); } catch {} };
  const dt = 0.02;
  let bar = -1;
  while (now < SEG) {
    now = Math.round((now + dt) * 1e6) / 1e6;
    E.tick();
    const b = Math.floor(E.step / 16);
    if (b !== bar) {
      bar = b;
      for (const [sb, di, act, arg] of SCRIPT) {
        if (sb !== b) continue;
        const d = E.decks[di];
        // SINFX=1: los viajes sin efectos de transición (para comparar solo la música y el sonido)
        if (process.env.SINFX) for (const g of Object.values(d.gesture)) g.fx = false;
        if (act === 'press') d.press(arg);
        else if (act === 'reseed') d.reseed();
        else if (act === 'similar') d.similarUniverse(0.5, 0.5);
        else if (act === 'load') load(d, arg, false, arg.forceMotor ?? arg.motor);
        else if (act === 'motor') d.motorNext = arg;
        if (process.env.MEZCLA) console.log(`  compás ${b} ${'AB'[di]} ${act}: suena ${d.motor}${d.nextMotor ? ` · espera ${d.nextMotor}` : ''} · semilla ${d.seed}`);
      }
    }
    await drain(E);
  }
  E.stop();
  const hash = H.digest('hex');
  results[name] = { hash, lines, compases: Math.floor(E.step / 16), errores: errors };
  all.update(hash);
  console.log(`${hash.slice(0, 16)}  ${String(lines).padStart(8)} cosas  ${name}${bad ? `  ${bad} VALORES NaN/INFINITOS` : ""}${errors.length ? `  ERRORES: ${errors.join(' | ')}` : ''}`);
  if (process.env.VER) {
    console.log(`  compases ${results[name].compases} · banco: ${(E.banks ? Object.values(E.banks) : [E.bank]).map((b) => b.cache.size).join('+')} sonidos grabados`);
    for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(v).padStart(7)}  ${k}`);
    for (const k in tally) delete tally[k];
  }
}
const total = all.digest('hex');
console.log(`TOTAL ${total}`);

const save = flag('--guardar');
if (save) {
  fs.mkdirSync(path.dirname(path.resolve(save)), { recursive: true });
  fs.writeFileSync(path.resolve(save), JSON.stringify({ src: path.relative(ROOT, src), motor: motorArg, seg: SEG, total, casos: results }, null, 2));
  console.log(`guardada en ${save}`);
}
const check = flag('--comprobar');
if (check) {
  const ref = read(path.resolve(check));
  let ok = ref.total === total;
  for (const [n, r] of Object.entries(ref.casos)) {
    const mine = results[n];
    if (!mine) { console.log(`FALTA el caso «${n}» (¿ha cambiado universos/?)`); ok = false; continue; }
    if (mine.hash !== r.hash) { console.log(`DISTINTO: «${n}»`); ok = false; }
  }
  console.log(ok ? 'IDÉNTICO a la referencia' : 'NO es idéntico a la referencia');
  process.exitCode = ok ? 0 : 1;
}
