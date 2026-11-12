// ENTRADA DEL DROP — del intérprete, IGUAL EN TODOS LOS MOTORES (2026-11-12). Cómo entra un golpe
// (un viaje DE GOLPE, un INSTANTÁNEO, un CORTE, una versión AHORA DE GOLPE) y el HUECO ANTES DEL
// KICK no es del universo: es de la mesa. Se pone en cada Deck desde slots.js (como el aterrizaje
// de los viajes), sin tocar el código de los motores congelados: se apoya solo en lo que todos los
// Deck tienen (sus canales `ch`, sus transiciones `fx`, `pre`, `contrast`, `autoOn`).
//
// Tres cosas, medidas en la app con una grabación del usuario y con el código de antes:
//   1. ENTRAR YA COLOCADO. En un golpe, un canal que entra desde el silencio se deslizaba desde el
//      golpe (tc 6 ms). En Hz, eso es lento hacia abajo: el HP de entrada del kick y del bajo bajaba
//      desde ~7 kHz y el cuerpo del kick tardaba ~30 ms en salir (el primer kick del drop, 33 dB más
//      flojo en sus primeros 10 ms). Ahora su filtro se coloca en los 6 ms de antes (está a 0: no se
//      oye) y su volumen sube en ~1 ms justo en el golpe.
//   2. LO DEL VIAJE MUERE EN EL HUECO. Lo que se cortaba EN el 1 (riser y shh en su punto más alto,
//      el reverse en su pico, colas del redoble) reaparecía unos ms tras el silencio, encima del kick
//      (picos de −9 a −23 dBFS). Ahora va por un canal propio de cada viaje (lo que suena AL llegar,
//      golpes y platos, no) que se cierra dentro del silencio.
//   3. TODO EN SU SITIO ANTES DEL GOLPE. Dentro del hueco se sueltan el HP de tensión, el silencio
//      antes del drop, el MENOS VOLUMEN SIN KICK y los filtros y volúmenes de todos los canales: en
//      el golpe ya está todo abierto y solo entra lo nuevo. Un salto dentro del silencio no se oye.

const glide = (param, v, t, tc = 0.04) => param.setTargetAtTime(v, t, tc);
const clamp = (x) => Math.min(1, Math.max(0, x));
// una llamada a applyTransition con un `tc` así de corto es un golpe (los Deck piden 6 ms en la
// llegada DE GOLPE y en AHORA DE GOLPE); a ritmo de control no llevan `tc`
const HIT_TC = 0.01;

export function installDrop(d) {
  d.kickGap = kickGap;
  const init = d.initAudio;
  d.initAudio = function (...args) {
    const r = init.apply(this, args);
    for (const k in this.ch) Object.assign(this.ch[k], { applyTransition, setShape, settle });
    wireFx(this.fx);
    return r;
  };
  return d;
}

// ── 1. los canales (los mismos campos en todos los motores: hp, lp, fade, sweep, hpBase, last)
// progress 0..1 de la transición; mode 0 = volumen, 1 = filtro. Fuera de un golpe, exactamente igual
// que el Channel de los motores
function applyTransition(prog, mode, now, tc) {
  const f = 1 - mode * (1 - prog);
  const vp = clamp(prog / (1 - 0.85 * mode));
  const vol = Math.sin(vp * Math.PI / 2);
  const L = this.last;
  if (Math.abs(f - L.f) < 1e-4 && Math.abs(vol - L.vol) < 1e-4 && mode === L.m) return;
  const enters = tc != null && tc <= HIT_TC && L.vol >= 0 && L.vol < 1e-3;
  L.f = f; L.vol = vol; L.m = mode;
  if (enters) {
    this.setShape(now - 0.006, 0.0008);
    glide(this.fade.gain, vol, now - 0.0005, 0.0005);
  } else {
    this.setShape(now, tc);
    glide(this.fade.gain, vol, now, tc ?? 0.03);
  }
}

// el filtro de la transición hacia lo que dice `last`, desde `at`
function setShape(at, tc) {
  const { f, m } = this.last;
  const q = 0.707 + 5 * m * Math.sin(Math.PI * (1 - f));
  if (this.sweep === 'hp') {
    glide(this.hp.frequency, this.hpBase * Math.pow(900 * 20 / this.hpBase, 1 - f), at, tc);
    glide(this.hp.Q, q, at, tc);
  } else {
    glide(this.lp.frequency, 20000 * Math.pow(1 / 400, 1 - f), at, tc);
    glide(this.lp.Q, q, at, tc);
  }
}

// dentro del hueco: filtro y volumen ya donde van a estar en el golpe (también lo que ya sonaba)
function settle(at, tc) {
  if (this.last.vol < 0) return;
  this.setShape(at, tc);
  glide(this.fade.gain, this.last.vol, at, tc);
}

// ── 2. las transiciones: las voces que conducen al 1 se crean en step() y update() con `this.bus`;
// mientras corren, `bus` es el canal del viaje (uno por viaje, `lead`), que va al bus de verdad. En
// arrive() vuelve a ser el de verdad (los golpes de llegada no se cortan)
function wireFx(fx) {
  if (!fx || fx.leadOf) return;
  const bus = fx.bus;
  fx.leadOf = bus;
  let lead = null;
  const fresh = () => {
    const old = lead;
    lead = fx.ctx.createGain();
    lead.connect(bus);
    if (old) setTimeout(() => old.disconnect(), 15000); // (sus colas y apagados, como mucho ~4 s)
  };
  fresh();
  const via = (fn) => function (...args) {
    const prev = this.bus;
    this.bus = lead;
    try { return fn.apply(this, args); } finally { this.bus = prev; }
  };
  const { start, update, step, arrive } = fx;
  fx.start = function (...args) { fresh(); return start.apply(this, args); };
  fx.update = via(update);
  fx.step = via(step);
  fx.arrive = function (t) {
    const P = this.plan;
    const prev = this.bus;
    this.bus = bus;
    try { arrive.call(this, t); } finally { this.bus = prev; }
    const has = (type) => !!P?.layers.some((ly) => ly.type === type);
    this.landed = { t, lead, hp: has('tension'), gap: has('gap') };
  };
}

// ── 3. HUECO ANTES DEL KICK: el universo entero calla unos ms justo antes del primer golpe del kick
// que entra (psicoacústica: más pegada; no es un pre-drop). Se programa a la vez que ese golpe, así
// que ya no se puede deshacer: si el golpe suena, el hueco también. Baja en 4 ms, calla, vuelve en
// 2 ms y está entero en el ataque del kick. `this` = el Deck
function kickGap(t) {
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
  if (u - s < 0.001) return; // hueco demasiado corto para colocar nada dentro
  const m = (s + u) / 2;
  if (this.contrast && this.autoOn) this.contrast.gain.setValueAtTime(this.autoOn.contrast, m);
  const L = this.fx?.landed;
  if (L && t >= L.t - 1e-6 && t - L.t <= this.engine.barDur) {
    L.lead.gain.setValueAtTime(0, m);
    if (L.gap) this.fx.f.gap.gain.setValueAtTime(1, m);
    if (L.hp) this.fx.f.hp.frequency.setTargetAtTime(20, s, Math.min(0.004, (t - s) / 6));
  }
  for (const k in this.ch) this.ch[k].settle?.(s, (u - s) / 6);
}
