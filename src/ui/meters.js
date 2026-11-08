// MEDIDORES compartidos: escala de los medidores de nivel y el MÁSTER (lo que sale y lo que
// quita su limitador). El máster se lee una sola vez por fotograma (update) y lo pintan la
// mesa DJ y el MIXER.

export const toDb = (p) => (p > 1e-6 ? 20 * Math.log10(p) : -Infinity);
// medidor de nivel: pico en dBFS de −60 a 0 → 0..1 (un NaN cuenta como silencio: si no, la barra
// se quedaba congelada en el último valor y parecía que todo sonaba)
export const meterPos = (p) => (!(p > 1e-4) ? 0 : Math.min(1, Math.max(0, (toDb(p) + 60) / 60)));
// medidor del limitador: 0 a 12 dB quitados → 0..1
const GR_RANGE = 12;
const HOLD_MS = 1500; // las cifras se quedan en el máximo este rato (si no, no da tiempo a leerlas)
const FALL = 0.9;     // caída suave de las barras, como el resto de medidores

export const fmtDb = (db) => (db === -Infinity ? '−∞' : `${db > 0.05 ? '+' : db < -0.05 ? '−' : ''}${Math.abs(db).toFixed(1)}`);

export function masterMeter(engine) {
  const m = { l: 0, r: 0, gr: 0, peakDb: -Infinity, grDb: 0 };
  let peakT = 0, grT = 0;
  m.update = () => {
    const [pl, pr] = engine.masterPeaks();
    const gr = engine.limiterGr() || 0; // NaN → 0
    m.l = Math.max(meterPos(pl), m.l * FALL);
    m.r = Math.max(meterPos(pr), m.r * FALL);
    m.gr = Math.max(Math.min(1, gr / GR_RANGE), m.gr * FALL);
    const now = performance.now();
    const pk = toDb(Math.max(pl, pr));
    if (pk >= m.peakDb || now - peakT > HOLD_MS) { m.peakDb = pk; peakT = now; }
    if (gr >= m.grDb || now - grT > HOLD_MS) { m.grDb = gr; grT = now; }
    return m;
  };
  return m;
}

// pinta el máster en un bloque con .m-l, .m-r, .m-gr (barras) y .m-peak, .m-grdb (cifras).
// Barras verticales, en la mesa DJ y en el MIXER
export function paintMaster(root, m) {
  const q = (s) => root.querySelector(s);
  q('.m-l').style.transform = `scaleY(${m.l.toFixed(3)})`;
  q('.m-r').style.transform = `scaleY(${m.r.toFixed(3)})`;
  q('.m-gr').style.transform = `scaleY(${m.gr.toFixed(3)})`;
  const pk = fmtDb(m.peakDb < -60 ? -Infinity : m.peakDb);
  const gr = m.grDb < 0.05 ? '0.0' : `−${m.grDb.toFixed(1)}`;
  const elP = q('.m-peak'), elG = q('.m-grdb');
  if (elP.textContent !== pk) elP.textContent = pk;
  if (elG.textContent !== gr) elG.textContent = gr;
  elG.classList.toggle('on', m.grDb >= 0.05);
}
