// TRAER y GUARDAR universos (universe.js) desde la interfaz: el MULTIVERSO del panel de UN UNIVERSO
// (bindMultiverse, abajo) y OPCIONES → UNIVERSOS (bindImporter y bindSaver).
//
// LA BIBLIOTECA: los universos guardados viven en la carpeta universos/ del proyecto, como archivos
// .json, sueltos o en CARPETAS (un nivel: p. ej. una familia de versiones de una semilla), y el
// servidor de la app (serve.mjs, /api/universos y /api/carpetas) los lista, guarda, renombra, mueve y
// borra (borrar = a universos/papelera/). Así no dependen del navegador y valen también desde el
// móvil. La lista se lee de la carpeta cada vez: lo guardado aparece al momento, sin reiniciar.
//
// TRAER: uno de la lista GUARDADOS, una semilla escrita (o pegada) o un archivo de fuera. Antes de
// traerlo se ve qué es y con qué TEMPO y ESCALA se guardó (y cuáles suenan ahora); el interruptor CON
// SU TEMPO Y ESCALA decide si se aplican al entrar (apagado: no cambian solos). Entra en el 1 del
// compás siguiente, como NUEVO UNIVERSO; parado, ya.
//
// GUARDAR: el que suena, tal como suena, con el nombre que se escriba (vacío = uno descriptivo) y en
// la carpeta que se elija (se recuerda la última: para guardar seguidas las versiones de una familia).

import { seedCode, parseSeedCode, readUniverse, universeFileName, describeGlobal, NOTES } from '../music/universe.js';
import { STYLES } from '../music/styles.js';
import { SCALES } from '../music/emotion.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const styleTxt = (S) => (S && S.t > 0 ? `${STYLES[S.name]?.label ?? S.name} ${Math.round(S.t * 100)} %${S.purity < 1 ? ` · PUREZA ${Math.round(S.purity * 100)} %` : ''}` : 'NORMAL');
const nowGlobal = (engine) => ({ bpm: engine.bpm, rootMidi: engine.rootMidi, scaleI: engine.scaleNext ?? engine.scaleI });
const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
};
// las vistas abiertas (panel, OPCIONES) se enteran de que la biblioteca ha cambiado
const changed = () => window.dispatchEvent(new Event('mu-universos'));
// lo que comparten todas las vistas: la última carpeta en la que se guardó y las carpetas abiertas
const shared = { lastFolder: '', open: new Set() };

// ───────────────────────── LA BIBLIOTECA (servidor)
async function api(path, opts = {}) {
  const r = await fetch(path, { cache: 'no-store', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `error ${r.status}`), { status: r.status });
  return j;
}
const relUrl = (rel) => rel.split('/').map(encodeURIComponent).join('/');
const send = (method, body) => ({ method, body: body && JSON.stringify(body) });
// { folders: [{ name, count }], items: [...] } (un servidor de antes daba solo la lista)
export async function listUniverses() {
  const j = await api('/api/universos');
  return Array.isArray(j) ? { folders: [], items: j } : j;
}
export async function fetchUniverse(rel) {
  const r = await fetch(`/universos/${relUrl(rel)}`, { cache: 'no-store' });
  return r.ok ? readUniverse(await r.text()) : null;
}
const patchUniverse = (rel, body) => api(`/api/universos/${relUrl(rel)}`, send('PATCH', body));
const deleteUniverse = (rel) => api(`/api/universos/${relUrl(rel)}`, send('DELETE'));
const createFolder = (name) => api('/api/carpetas', send('POST', { name }));
const renameFolder = (name, to) => api(`/api/carpetas/${encodeURIComponent(name)}`, send('PATCH', { name: to }));
const deleteFolder = (name) => api(`/api/carpetas/${encodeURIComponent(name)}`, send('DELETE'));

// el nombre que se propone al guardar: arquetipo, código, tempo y escala
export const suggestName = (deck, engine) => [
  deck.sty.t > 0 ? deck.sty.archLabel : 'NORMAL', currentCode(deck, engine, false).replace(' · PARECIDO', ''), describeGlobal(nowGlobal(engine)),
].join(' · ') + (deck.similarOf ? ' · PARECIDO' : '');

// GUARDAR el que suena en la biblioteca, con su nombre y en su carpeta ('' = sin carpeta). Si no hay
// biblioteca (un servidor antiguo), se descarga el archivo
export async function saveUniverse(deck, engine, name, folder = '') {
  const universe = engine.completeCapture(deck, deck.capture()); // (y SOLO, MÁSTER, osciladores, CLIC: ver Engine)
  try {
    const r = await api('/api/universos', send('POST', { name: name || suggestName(deck, engine), universe, folder }));
    shared.lastFolder = r.folder ?? folder;
    if (shared.lastFolder) shared.open.add(shared.lastFolder);
    changed();
    return `guardado: «${r.name}»${r.folder ? ` en ${r.folder}` : ''}`;
  } catch {
    return `no se pudo guardar en la biblioteca (¿hay que volver a abrir MINIMAL UNIVERSE?): descargado como ${downloadUniverse(deck, engine)}`;
  }
}

// ───────────────────────── GUARDAR (con nombre y carpeta)
const NEW = '__nueva__'; // (la opción «+ NUEVA CARPETA…» del desplegable)
export const saverHTML = () => `
  <div class="ui-line">
    <input class="ui-name" type="text" spellcheck="false" autocomplete="off" maxlength="80" placeholder="nombre (vacío: uno automático)">
    <button class="ui-save" title="guardar el universo TAL COMO SUENA en la biblioteca (lo que ha mutado, lo que has tocado, su tempo y escala)">GUARDAR</button>
  </div>
  <div class="ui-line">
    <span class="ui-lab">EN</span>
    <select class="ui-folder" title="en qué carpeta se guarda (se recuerda la última)"></select>
    <input class="ui-newfolder" type="text" spellcheck="false" autocomplete="off" maxlength="60" placeholder="nombre de la carpeta nueva" hidden>
  </div>
  <span class="ui-saved"></span>`;
export function bindSaver(root, engine, deck) {
  const $ = (s) => root.querySelector(s);
  const name = $('.ui-name'), out = $('.ui-saved'), sel = $('.ui-folder'), nf = $('.ui-newfolder');
  let folders = [];
  const fill = () => {
    const want = sel.value === NEW ? NEW : shared.lastFolder;
    sel.innerHTML = [['', 'SIN CARPETA'], ...folders.map((f) => [f.name, f.name]), [NEW, '+ NUEVA CARPETA…']]
      .map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
    sel.value = want === NEW || folders.some((f) => f.name === want) ? want : '';
    nf.hidden = sel.value !== NEW;
  };
  const load = () => listUniverses().then((L) => { folders = L.folders; fill(); }).catch(() => { folders = []; fill(); });
  sel.addEventListener('change', () => {
    nf.hidden = sel.value !== NEW;
    if (sel.value !== NEW) shared.lastFolder = sel.value;
    else nf.focus();
  });
  const save = async () => {
    let folder = sel.value;
    if (folder === NEW) {
      const fn = nf.value.trim();
      if (!fn) { out.textContent = 'escribe el nombre de la carpeta nueva'; nf.focus(); return; }
      try { folder = (await createFolder(fn)).name; }
      catch (e) { if (e.status === 409) folder = fn; else { out.textContent = `no se pudo crear la carpeta: ${e.message}`; return; } }
      nf.value = '';
    }
    out.textContent = 'guardando…';
    out.textContent = await saveUniverse(deck(), engine, name.value.trim(), folder);
    name.value = '';
    sel.value = shared.lastFolder;
  };
  $('.ui-save').addEventListener('click', save);
  for (const f of [name, nf]) f.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') save(); });
  window.addEventListener('mu-universos', load);
  window.addEventListener('focus', load);
  load();
  return { frame() { const s = suggestName(deck(), engine); if (name.placeholder !== s) name.placeholder = s; } };
}

// ───────────────────────── MOTOR AL TRAER (src/motores/LEEME.md)
// Cada universo apunta a su motor («-ALPHA» en la semilla, `motor` en el archivo) y se trae con él. Los
// de antes de ALPHA (sin motor, el 1 o el 2) son de ALPHA: el de partida. Con más de un motor se puede
// elegir otro para comparar: en otro motor se trae TAL COMO NACE (la misma semilla, estilo, tempo y
// escala), porque lo que mutó o se tocó es de los generadores de su motor y en otro no tiene por qué
// encajar. Con uno solo (hoy, ALPHA) la línea no se ve
const motorPickHTML = '<div class="ui-line ui-motline"><span class="ui-lab">MOTOR</span><div class="mots ui-mots"></div><span class="ui-motnote"></span></div>';
function motorPicker(line, engine) {
  const box = line.querySelector('.ui-mots'), noteEl = line.querySelector('.ui-motnote');
  const M = engine.motors, ids = engine.multi ? Object.keys(M) : [];
  const ownOf = (u) => (M[u.motor] ? u.motor : engine.devMotor);
  line.hidden = ids.length < 2;
  let own = engine.devMotor, pick = own, seedOnly = false;
  box.innerHTML = ids.map((m) => `<button data-m="${m}"${M[m].frozen ? '' : ' class="dev"'}>${M[m].label}</button>`).join('');
  const paint = () => {
    for (const b of box.children) {
      const m = b.dataset.m;
      b.classList.toggle('on', m === pick);
      b.classList.toggle('now', m === own);
      b.title = `${M[m].label}: ${M[m].desc}${m === own ? '\n(el suyo: el punto)' : ''}`;
    }
    noteEl.textContent = pick === own ? 'el suyo' : seedOnly ? 'otro motor: la misma semilla, para comparar' : 'otro motor: tal como nace (lo que mutó es del suyo)';
  };
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    pick = b.dataset.m;
    paint();
  });
  return {
    set(u, onlySeed) { own = pick = ownOf(u); seedOnly = !!onlySeed; paint(); },
    get: () => (ids.length > 1 ? pick : undefined),
    note: (u) => (ids.length > 1 && pick !== ownOf(u) ? ` · con el MOTOR ${M[pick].label}` : ''),
  };
}

// ───────────────────────── TRAER
export const importerHTML = () => `
  <button class="ui-libbtn" title="los universos guardados en la biblioteca (la carpeta universos/)">GUARDADOS <b class="ui-count"></b><i class="ui-arrow">▾</i></button>
  <div class="ui-lib" hidden></div>
  <div class="ui-line">
    <input class="ui-in" type="text" spellcheck="false" autocomplete="off" placeholder="o una semilla · 968782145-RO100-124-F#EOL-ALPHA">
    <button class="ui-open" title="abrir un archivo de universo (.json) de fuera de la biblioteca">ARCHIVO</button>
    <input class="ui-file" type="file" accept=".json,application/json" hidden>
  </div>
  <div class="ui-found" hidden>
    <span class="ui-what"></span>
    <span class="ui-glob-txt"></span>
    <div class="ui-line">
      <button class="ui-glob" title="al entrar, poner también su tempo, tónica y modo, y el MÁSTER y el preset del MIXER (si no, siguen los de ahora)">CON SU TEMPO Y ESCALA</button>
      <button class="ui-go">TRAER</button>
    </div>
    ${motorPickHTML}
  </div>
  <span class="ui-note"></span>`;

// `root` = donde está importerHTML(); `deck()` = el universo al que se trae
export function bindImporter(root, engine, deck) {
  const $ = (s) => root.querySelector(s);
  const input = $('.ui-in'), file = $('.ui-file'), found = $('.ui-found'), what = $('.ui-what');
  const globTxt = $('.ui-glob-txt'), globBtn = $('.ui-glob'), note = $('.ui-note');
  const libBtn = $('.ui-libbtn'), lib = $('.ui-lib'), count = $('.ui-count');
  let cand = null, candFile = null, withGlobals = false;
  const mp = motorPicker($('.ui-motline'), engine);
  const say = (t) => { note.textContent = t; };
  const show = (u, from, label) => {
    cand = u;
    found.hidden = !u;
    if (!u) return;
    mp.set(u, from === 'semilla');
    const how = from === 'semilla' ? 'tal como nace' : 'tal como sonaba';
    what.textContent = `${label ? `«${label}» · ` : ''}${from !== 'semilla' && u.code ? u.code : seedCode(u)} · ${styleTxt(u.style)} · ${how}`;
    const G = u.global;
    globTxt.textContent = G ? `guardado con ${describeGlobal(G)} · ahora ${describeGlobal(nowGlobal(engine))}` : 'sin tempo ni escala: se queda con los de ahora';
    globBtn.hidden = !G;
    globBtn.classList.toggle('on', withGlobals);
  };
  const pickNone = () => { candFile = null; lib.querySelectorAll('.ui-it').forEach((x) => x.classList.remove('on')); };

  // ── la lista GUARDADOS: carpetas plegables (crear, renombrar, borrar) y universos (elegir,
  // renombrar ✎, mover de carpeta ⇢, borrar ✕). Borrar pide confirmación y va a la papelera
  let L = { folders: [], items: [] };
  const itemRow = (it) => `
      <div class="ui-it${it.file === candFile ? ' on' : ''}${it.folder ? ' in' : ''}" data-f="${esc(it.file)}">
        <button class="ui-pick" title="elegirlo (luego, TRAER)"><b>${esc(it.name || it.code || it.file)}</b>
          <small>${esc([styleTxt(it.style), describeGlobal(it.global), when(it.saved), it.similar ? 'parecido' : ''].filter(Boolean).join(' · '))}</small></button>
        <button class="ui-ren" title="cambiar el nombre">✎</button>
        <button class="ui-mv" title="moverlo a otra carpeta">⇢</button>
        <button class="ui-del" title="borrar (pide confirmación; va a la papelera)">✕</button>
      </div>`;
  const render = () => {
    count.textContent = L.items.length ? String(L.items.length) : '';
    const loose = L.items.filter((it) => !it.folder);
    lib.innerHTML = `<div class="ui-tools"><button class="ui-mkdir" title="crear una carpeta (p. ej. para las versiones de una semilla)">+ CARPETA</button></div>`
      + L.folders.map((f) => {
        const open = shared.open.has(f.name);
        return `
      <div class="ui-fo${open ? ' open' : ''}" data-fo="${esc(f.name)}">
        <button class="ui-fo-open" title="abrir / cerrar la carpeta"><i>${open ? '▾' : '▸'}</i><b>${esc(f.name)}</b><small>${f.count}</small></button>
        <button class="ui-fo-ren" title="cambiar el nombre de la carpeta">✎</button>
        <button class="ui-fo-del" title="borrar la carpeta con lo que tenga dentro (pide confirmación; va a la papelera)">✕</button>
      </div>${open ? (L.items.filter((it) => it.folder === f.name).map(itemRow).join('') || '<span class="ui-empty in">vacía: al GUARDAR, elige esta carpeta (o ⇢ en un universo)</span>') : ''}`;
      }).join('')
      + loose.map(itemRow).join('')
      + (L.items.length || L.folders.length ? '' : '<span class="ui-empty">no hay universos guardados: GUARDAR (en EL QUE SUENA) guarda el que suena</span>');
  };
  const refresh = async () => {
    try { L = await listUniverses(); } catch { L = { folders: [], items: [] }; lib.innerHTML = '<span class="ui-empty">no se puede leer la biblioteca (¿hay que volver a abrir MINIMAL UNIVERSE?)</span>'; count.textContent = ''; return; }
    render();
  };
  libBtn.addEventListener('click', () => {
    lib.hidden = !lib.hidden;
    libBtn.classList.toggle('open', !lib.hidden);
    if (!lib.hidden) refresh();
  });
  // La lista se lee de la carpeta cada vez (nunca hace falta reiniciar nada): al abrirla, al guardar,
  // renombrar, mover o borrar desde cualquier vista, y al volver a la app (por si se ha metido un
  // archivo a mano en universos/ o se ha guardado desde otro aparato)
  const recount = () => {
    if (!lib.hidden) { refresh(); return; }
    listUniverses().then((l) => { L = l; count.textContent = l.items.length ? String(l.items.length) : ''; }).catch(() => {});
  };
  window.addEventListener('mu-universos', recount);
  window.addEventListener('focus', recount);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') recount(); });
  recount();

  // un campo dentro de una fila (nombre nuevo, carpeta nueva): Enter u OK = hacer, Esc o ✕ = dejarlo
  const inlineEdit = (row, value, onOk, placeholder = '') => {
    row.innerHTML = `<input class="ui-rename" type="text" maxlength="80" value="${esc(value)}" placeholder="${esc(placeholder)}"><button class="ui-ren-ok">OK</button><button class="ui-ren-no" title="dejarlo como estaba">✕</button>`;
    row.classList.add('editing');
    const f = row.querySelector('.ui-rename');
    f.focus();
    f.select();
    const ok = () => { const v = f.value.trim(); if (v && v !== value) onOk(v); else render(); };
    f.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') render(); });
    row.querySelector('.ui-ren-ok').addEventListener('click', ok);
    row.querySelector('.ui-ren-no').addEventListener('click', render);
  };
  // una pregunta con SÍ / NO en la fila
  const confirmRow = (row, text, yes, onYes) => {
    row.innerHTML = `<span class="ui-ask">${esc(text)}</span><button class="ui-del-yes">${yes}</button><button class="ui-del-no">NO</button>`;
    row.classList.add('asking');
    row.querySelector('.ui-del-no').addEventListener('click', render);
    row.querySelector('.ui-del-yes').addEventListener('click', onYes);
  };
  const act = async (fn, ok) => {
    try { await fn(); if (ok) say(ok); changed(); } catch (e) { say(`no se pudo: ${e.message}`); }
    await refresh();
  };
  lib.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn || btn.closest('.editing, .asking')) return;
    const c = btn.classList;
    // ── carpetas
    if (c.contains('ui-mkdir')) {
      const row = btn.parentElement;
      inlineEdit(row, '', (nm) => act(async () => { const r = await createFolder(nm); shared.open.add(r.name); }, `carpeta «${nm}» creada`), 'nombre de la carpeta');
      return;
    }
    const fo = btn.closest('.ui-fo');
    if (fo) {
      const name = fo.dataset.fo, n = L.folders.find((f) => f.name === name)?.count ?? 0;
      if (c.contains('ui-fo-open')) {
        if (shared.open.has(name)) shared.open.delete(name); else shared.open.add(name);
        render();
      } else if (c.contains('ui-fo-ren')) {
        inlineEdit(fo, name, (to) => act(async () => {
          const r = await renameFolder(name, to);
          if (shared.open.delete(name)) shared.open.add(r.name);
          if (shared.lastFolder === name) shared.lastFolder = r.name;
          if (candFile?.startsWith(`${name}/`)) candFile = `${r.name}/${candFile.slice(name.length + 1)}`;
        }, `la carpeta ahora se llama «${to}»`));
      } else if (c.contains('ui-fo-del')) {
        confirmRow(fo, `¿Borrar la carpeta «${name}»${n ? ` y sus ${n} universo${n === 1 ? '' : 's'}` : ''}?`, 'SÍ, BORRAR', () => act(async () => {
          await deleteFolder(name);
          shared.open.delete(name);
          if (shared.lastFolder === name) shared.lastFolder = '';
          if (candFile?.startsWith(`${name}/`)) { pickNone(); show(null); }
        }, `carpeta «${name}» borrada (está en universos/papelera, por si acaso)`));
      }
      return;
    }
    // ── universos
    const row = btn.closest('.ui-it');
    if (!row) return;
    const it = L.items.find((x) => x.file === row.dataset.f);
    if (!it) return;
    const label = it.name || it.code || it.file;
    if (c.contains('ui-pick')) {
      const u = await fetchUniverse(it.file);
      if (!u) { say(`${it.file}: no se pudo leer`); return; }
      input.value = '';
      candFile = it.file;
      lib.querySelectorAll('.ui-it').forEach((x) => x.classList.toggle('on', x === row));
      show(u, 'guardado', it.name || null);
      say(it.folder ? `en la carpeta ${it.folder}` : '');
    } else if (c.contains('ui-ren')) {
      inlineEdit(row, it.name || it.code || '', (nm) => act(async () => {
        const r = await patchUniverse(it.file, { name: nm });
        if (candFile === it.file) candFile = r.file;
      }, `ahora se llama «${nm}»`));
    } else if (c.contains('ui-mv')) {
      // MOVER: a otra carpeta o fuera de las carpetas
      const opts = [['', 'SIN CARPETA'], ...L.folders.map((f) => [f.name, f.name])];
      row.innerHTML = `<span class="ui-ask">mover «${esc(label)}» a</span><select class="ui-mv-to">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === it.folder ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select><button class="ui-ren-ok">OK</button><button class="ui-ren-no" title="dejarlo donde está">✕</button>`;
      row.classList.add('editing');
      row.querySelector('.ui-ren-no').addEventListener('click', render);
      row.querySelector('.ui-ren-ok').addEventListener('click', () => {
        const to = row.querySelector('.ui-mv-to').value;
        if (to === it.folder) { render(); return; }
        act(async () => {
          const r = await patchUniverse(it.file, { folder: to });
          if (to) shared.open.add(to);
          if (candFile === it.file) candFile = r.file;
        }, `«${label}» ${to ? `ahora está en ${to}` : 'ya no está en ninguna carpeta'}`);
      });
    } else if (c.contains('ui-del')) {
      confirmRow(row, `¿Borrar «${label}»?`, 'SÍ, BORRAR', () => act(async () => {
        await deleteUniverse(it.file);
        if (candFile === it.file) { pickNone(); show(null); }
      }, `borrado «${label}» (está en universos/papelera, por si acaso)`));
    }
  });

  // ── una semilla escrita
  input.addEventListener('input', () => {
    const v = input.value.trim();
    const u = v ? parseSeedCode(v) : null;
    pickNone();
    show(u, 'semilla');
    say(v && !u ? 'no entiendo esa semilla: p. ej. 968782145, 968782145-RO100 o 968782145-RO70-P60-124-F#EOL' : '');
  });
  // (las teclas del campo no son atajos: N, W, R, M, ESPACIO...)
  input.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') go(); });
  // ── un archivo de fuera
  $('.ui-open').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    const u = readUniverse(await f.text());
    if (!u) { show(null); say(`${f.name}: no es un universo de MINIMAL UNIVERSE`); return; }
    input.value = '';
    pickNone();
    show(u, 'archivo', u.name || null);
    say(f.name);
  });
  globBtn.addEventListener('click', () => { withGlobals = !withGlobals; globBtn.classList.toggle('on', withGlobals); });
  const go = () => {
    if (!cand) return;
    deck().loadUniverse(cand, withGlobals, mp.get());
    say(`${cand.name ? `«${cand.name}»` : seedCode(cand)}${withGlobals && cand.global ? ' (con su tempo y escala)' : ''}${mp.note(cand)}: ${engine.generated ? 'entra en el 1 del compás siguiente' : 'listo: suena al GENERAR'}`);
  };
  $('.ui-go').addEventListener('click', go);
  // lo de «ahora» cambia si se mueve el tempo o el modo
  return {
    frame() {
      if (!cand?.global) return;
      const t = `guardado con ${describeGlobal(cand.global)} · ahora ${describeGlobal(nowGlobal(engine))}`;
      if (globTxt.textContent !== t) globTxt.textContent = t;
    },
  };
}

// ───────────────────────── MULTIVERSO (el panel de UN UNIVERSO)
// SONANDO: el que suena, con su nombre (vacío = uno automático), GUARDAR y la carpeta en la que se
// guarda. EN COLA: el que se ha elegido (doble clic en la BIBLIOTECA) y espera a IMPORTAR (entra en
// el 1 del compás siguiente, como NUEVO). BIBLIOTECA: las carpetas en cuadrícula; al pulsar una, su
// lista (nombre, escala, BPM y semilla). Renombrar, mover y borrar: en OPCIONES → UNIVERSOS.
const LOOSE = '*'; // (la «carpeta» de los que no están en ninguna: «*» no vale en un nombre de carpeta)
const scaleTxt = (G) => (G?.rootMidi !== undefined && SCALES[G.scaleI] ? `${NOTES[G.rootMidi % 12]} ${SCALES[G.scaleI].name.toUpperCase()}` : '—');
const bpmTxt = (G) => (G?.bpm ? String(G.bpm).replace('.', ',') : '—');
// la semilla (con su estilo, sin tempo ni escala: esos van en sus columnas)
const seedTxt = (it) => {
  const seed = it.seed ?? parseInt(it.code, 10);
  return Number.isFinite(seed) ? seedCode({ seed, style: it.style, motor: it.motor }) : '—';
};
export const multiverseHTML = (codeBtn) => `
  <div class="gp mv-now">
    <div class="ui-line"><span class="mv-lab">SONANDO</span>
      <input class="ui-name" type="text" spellcheck="false" autocomplete="off" maxlength="80" placeholder="nombre (vacío: uno automático)" title="el nombre con el que se GUARDA (vacío: uno automático)">
      <button class="ui-save" title="guardar el universo TAL COMO SUENA en la biblioteca (lo que ha mutado, lo que has tocado, su tempo y escala)">GUARDAR</button>
    </div>
    <div class="ui-line mv-sub">${codeBtn}</div>
    <div class="ui-line mv-sub">
      <span class="ui-lab">EN</span>
      <select class="ui-folder" title="en qué carpeta se guarda (se recuerda la última)"></select>
      <input class="ui-newfolder" type="text" spellcheck="false" autocomplete="off" maxlength="60" placeholder="nombre de la carpeta nueva" hidden>
    </div>
    <span class="ui-saved"></span>
    <div class="mv-queue" hidden>
      <span class="mv-lab">EN COLA</span>
      <div class="mv-q-what"></div>
      <div class="ui-line">
        <button class="ui-glob" title="al entrar, poner también su tempo, tónica y modo, y el MÁSTER y el preset del MIXER (si no, siguen los de ahora)">CON SU TEMPO Y ESCALA</button>
        <button class="mv-q-x" title="quitarlo de la cola">✕</button>
        <button class="mv-import" title="lanzarlo: entra en el 1 del compás siguiente (parado, al GENERAR)">IMPORTAR</button>
      </div>
      ${motorPickHTML}
    </div>
    <span class="ui-note mv-note"></span>
  </div>
  <button class="mv-libbtn" title="los universos guardados (la carpeta universos/)">BIBLIOTECA <b class="ui-count"></b><i class="ui-arrow">▾</i></button>
  <div class="mv-lib" hidden></div>`;

export function bindMultiverse(root, engine, deck) {
  const $ = (s) => root.querySelector(s);
  const saver = bindSaver($('.mv-now'), engine, deck);
  const queue = $('.mv-queue'), qWhat = $('.mv-q-what'), globBtn = $('.ui-glob'), note = $('.mv-note');
  const libBtn = $('.mv-libbtn'), lib = $('.mv-lib'), count = $('.ui-count');
  const say = (t) => { note.textContent = t; };
  let L = { folders: [], items: [] };
  let folder = null;   // la carpeta abierta (null = la cuadrícula de carpetas)
  let sel = null;      // el universo marcado en la lista (su archivo)
  let queued = null;   // EN COLA: { u, it }
  let withGlobals = false;
  let lastTap = { file: null, t: 0 };
  const mp = motorPicker($('.mv-queue .ui-motline'), engine);

  const inFolder = (fo) => L.items.filter((it) => (fo === LOOSE ? !it.folder : it.folder === fo));
  const grid = () => {
    const loose = inFolder(LOOSE).length;
    const tiles = [...L.folders.map((f) => [f.name, f.name, f.count]), ...(loose ? [[LOOSE, 'SIN CARPETA', loose]] : [])];
    return `<div class="mv-grid">${tiles.map(([k, t, n]) => `<button class="mv-fo${k === LOOSE ? ' loose' : ''}" data-fo="${esc(k)}" title="abrir la carpeta"><b>${esc(t)}</b><small>${n}</small></button>`).join('')}
      <button class="mv-mkdir" title="crear una carpeta (p. ej. para las versiones de una semilla)">+ CARPETA</button></div>`
      + (tiles.length ? '' : '<span class="ui-empty">no hay universos guardados: GUARDAR (junto a SONANDO) guarda el que suena</span>');
  };
  const list = () => {
    const items = inFolder(folder);
    // la carpeta (si es una de verdad) se renombra ✎ y se borra ✕; cada universo, ✎ ⇢ ✕
    const foTools = folder === LOOSE ? '' : '<button class="mv-fo-ren mv-tool" title="cambiar el nombre de la carpeta">✎</button><button class="mv-fo-del mv-tool" title="borrar la carpeta con lo que tenga dentro (pide confirmación; va a la papelera)">✕</button>';
    return `<div class="mv-head"><button class="mv-back" title="volver a las carpetas">‹</button><b>${esc(folder === LOOSE ? 'SIN CARPETA' : folder)}</b><small>${items.length}</small>${foTools}</div>
      <div class="mv-list">
        <div class="mv-row mv-cols"><span>NOMBRE</span><span>ESCALA</span><span>BPM</span><span>SEMILLA</span></div>
        ${items.map((it) => `<div class="mv-row mv-it${it.file === sel ? ' on' : ''}${it.file === queued?.it.file ? ' queued' : ''}" data-f="${esc(it.file)}" title="doble clic: a la cola (luego, IMPORTAR)">
          <span class="mv-top"><span class="mv-name">${esc(it.name || it.code || it.file)}</span><button class="mv-ren mv-tool" title="cambiar el nombre">✎</button><button class="mv-mv mv-tool" title="moverlo a otra carpeta">⇢</button><button class="mv-del mv-tool" title="borrar (pide confirmación; va a la papelera)">✕</button></span><span>${esc(scaleTxt(it.global))}</span><span>${esc(bpmTxt(it.global))}</span><span class="mv-seed">${esc(seedTxt(it))}</span>
        </div>`).join('') || '<span class="ui-empty">vacía: al GUARDAR, elige esta carpeta</span>'}
      </div>`;
  };
  const render = () => {
    count.textContent = L.items.length ? String(L.items.length) : '';
    if (folder !== null && folder !== LOOSE && !L.folders.some((f) => f.name === folder)) folder = null;
    if (folder === LOOSE && !inFolder(LOOSE).length) folder = null;
    if (!lib.hidden) lib.innerHTML = folder === null ? grid() : list();
  };
  const refresh = async () => {
    try { L = await listUniverses(); } catch {
      L = { folders: [], items: [] };
      if (!lib.hidden) lib.innerHTML = '<span class="ui-empty">no se puede leer la biblioteca (¿hay que volver a abrir MINIMAL UNIVERSE?)</span>';
      count.textContent = '';
      return;
    }
    render();
  };
  // la lista se lee de la carpeta cada vez: al abrirla, al guardar y al volver a la app
  window.addEventListener('mu-universos', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  refresh();
  libBtn.addEventListener('click', () => {
    lib.hidden = !lib.hidden;
    libBtn.classList.toggle('open', !lib.hidden);
    if (!lib.hidden) refresh();
  });

  // EN COLA
  const showQueue = () => {
    queue.hidden = !queued;
    if (!queued) return;
    const { u, it } = queued, G = u.global;
    qWhat.innerHTML = `<b>${esc(it.name || u.name || seedCode(u))}</b><small>${esc([scaleTxt(G), G?.bpm ? `${bpmTxt(G)} BPM` : '', seedTxt(it)].filter((x) => x && x !== '—').join(' · '))}</small>`;
    globBtn.hidden = !G;
    globBtn.classList.toggle('on', withGlobals);
    globBtn.title = G ? `al entrar, poner también su tempo y escala (${describeGlobal(G)}; ahora ${describeGlobal(nowGlobal(engine))}) y el MÁSTER del MIXER. Si no, siguen los de ahora` : '';
  };
  const enqueue = async (it) => {
    const u = await fetchUniverse(it.file);
    if (!u) { say(`${it.file}: no se pudo leer`); return; }
    queued = { u, it };
    mp.set(u, false);
    say('');
    showQueue();
    render();
  };
  globBtn.addEventListener('click', () => { withGlobals = !withGlobals; showQueue(); });
  $('.mv-q-x').addEventListener('click', () => { queued = null; showQueue(); render(); });
  $('.mv-import').addEventListener('click', () => {
    if (!queued) return;
    const { u, it } = queued;
    deck().loadUniverse(u, withGlobals, mp.get());
    say(`«${it.name || u.name || seedCode(u)}»${withGlobals && u.global ? ' (con su tempo y escala)' : ''}${mp.note(u)}: ${engine.generated ? 'entra en el 1 del compás siguiente' : 'listo: suena al GENERAR'}`);
    queued = null;
    showQueue();
    render();
  });

  // RENOMBRAR, MOVER y BORRAR en la propia fila (o en la cabecera, la carpeta): un campo o una
  // pregunta con SÍ / NO; Enter u OK = hacer, Esc o ✕ / NO = dejarlo. Borrar va a la papelera
  const act = async (fn, ok) => {
    try { await fn(); if (ok) say(ok); changed(); } catch (e) { say(`no se pudo: ${e.message}`); }
    await refresh();
  };
  const editRow = (row, inner, onOk) => {
    row.innerHTML = `${inner}<button class="ui-ren-ok">OK</button><button class="ui-ren-no" title="dejarlo como estaba">✕</button>`;
    row.classList.add('editing');
    const f = row.querySelector('input, select');
    f.focus();
    f.select?.();
    row.querySelector('.ui-ren-ok').addEventListener('click', () => onOk(f.value.trim()));
    row.querySelector('.ui-ren-no').addEventListener('click', render);
    f.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') onOk(f.value.trim()); if (e.key === 'Escape') render(); });
  };
  const askRow = (row, text, onYes) => {
    row.innerHTML = `<span class="ui-ask">${esc(text)}</span><button class="ui-del-yes">SÍ, BORRAR</button><button class="ui-del-no">NO</button>`;
    row.classList.add('editing');
    row.querySelector('.ui-del-no').addEventListener('click', render);
    row.querySelector('.ui-del-yes').addEventListener('click', onYes);
  };
  const tools = (b) => {
    const c = b.classList;
    // ── la carpeta abierta
    if (c.contains('mv-fo-ren') || c.contains('mv-fo-del')) {
      const head = b.closest('.mv-head'), name = folder, n = inFolder(name).length;
      if (c.contains('mv-fo-ren')) {
        editRow(head, `<input class="ui-rename" type="text" maxlength="60" value="${esc(name)}">`, (to) => {
          if (!to || to === name) { render(); return; }
          act(async () => {
            const r = await renameFolder(name, to);
            folder = r.name;
            if (shared.open.delete(name)) shared.open.add(r.name);
            if (shared.lastFolder === name) shared.lastFolder = r.name;
          }, `la carpeta ahora se llama «${to}»`);
        });
      } else {
        askRow(head, `¿Borrar la carpeta «${name}»${n ? ` y sus ${n} universo${n === 1 ? '' : 's'}` : ''}?`, () => act(async () => {
          await deleteFolder(name);
          folder = null;
          shared.open.delete(name);
          if (shared.lastFolder === name) shared.lastFolder = '';
        }, `carpeta «${name}» borrada (está en universos/papelera, por si acaso)`));
      }
      return;
    }
    // ── un universo
    const row = b.closest('.mv-it');
    const it = row && L.items.find((x) => x.file === row.dataset.f);
    if (!it) return;
    const label = it.name || it.code || it.file;
    const follow = (r) => { if (sel === it.file) sel = r.file; if (queued?.it.file === it.file) queued.it = { ...queued.it, file: r.file, name: r.name, folder: r.folder }; showQueue(); };
    if (c.contains('mv-ren')) {
      editRow(row, `<input class="ui-rename" type="text" maxlength="80" value="${esc(it.name || it.code || '')}">`, (nm) => {
        if (!nm || nm === (it.name || it.code)) { render(); return; }
        act(async () => follow(await patchUniverse(it.file, { name: nm })), `ahora se llama «${nm}»`);
      });
    } else if (c.contains('mv-mv')) {
      const opts = [['', 'SIN CARPETA'], ...L.folders.map((f) => [f.name, f.name])];
      editRow(row, `<span class="ui-ask">mover «${esc(label)}» a</span><select class="ui-mv-to">${opts.map(([v, t]) => `<option value="${esc(v)}"${v === it.folder ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`, () => {
        const to = row.querySelector('.ui-mv-to').value;
        if (to === it.folder) { render(); return; }
        act(async () => follow(await patchUniverse(it.file, { folder: to })), `«${label}» ${to ? `ahora está en ${to}` : 'ya no está en ninguna carpeta'}`);
      });
    } else if (c.contains('mv-del')) {
      askRow(row, `¿Borrar «${label}»?`, () => act(async () => {
        await deleteUniverse(it.file);
        if (sel === it.file) sel = null;
      }, `borrado «${label}» (está en universos/papelera, por si acaso)`));
    }
  };

  lib.addEventListener('click', (ev) => {
    if (ev.target.closest('.editing')) return; // (una fila con su campo o su pregunta abiertos)
    const b = ev.target.closest('button, .mv-it');
    if (!b) return;
    if (b.classList.contains('mv-tool')) { tools(b); return; }
    if (b.classList.contains('mv-fo')) { folder = b.dataset.fo; sel = null; render(); return; }
    if (b.classList.contains('mv-back')) { folder = null; render(); return; }
    if (b.classList.contains('mv-mkdir')) {
      b.outerHTML = '<span class="mv-mk"><input class="ui-rename" type="text" maxlength="60" placeholder="nombre"><button class="ui-ren-ok">OK</button></span>';
      const box = lib.querySelector('.mv-mk'), f = box.querySelector('input');
      f.focus();
      const ok = async () => {
        const nm = f.value.trim();
        if (!nm) { render(); return; }
        try { const r = await createFolder(nm); shared.lastFolder = r.name; say(`carpeta «${r.name}» creada`); changed(); } catch (e) { say(`no se pudo: ${e.message}`); }
        await refresh();
      };
      f.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') render(); });
      box.querySelector('button').addEventListener('click', ok);
      return;
    }
    if (b.classList.contains('mv-it')) {
      const it = L.items.find((x) => x.file === b.dataset.f);
      if (!it) return;
      // doble clic (o doble toque en el móvil) = a la cola; uno = marcarlo
      const t = performance.now();
      const dbl = lastTap.file === it.file && t - lastTap.t < 400;
      lastTap = dbl ? { file: null, t: 0 } : { file: it.file, t };
      sel = it.file;
      lib.querySelectorAll('.mv-it').forEach((x) => x.classList.toggle('on', x === b));
      if (dbl) enqueue(it);
    }
  });

  return {
    frame() {
      saver.frame();
      if (queued?.u.global && !globBtn.hidden) {
        const t = `al entrar, poner también su tempo y escala (${describeGlobal(queued.u.global)}; ahora ${describeGlobal(nowGlobal(engine))}) y el MÁSTER del MIXER. Si no, siguen los de ahora`;
        if (globBtn.title !== t) globBtn.title = t;
      }
    },
  };
}

// DESCARGAR: el universo tal como suena, como archivo (para llevarlo a otro sitio)
export function downloadUniverse(deck, engine) {
  const u = engine.completeCapture(deck, deck.capture());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(u, null, 1)], { type: 'application/json' }));
  a.download = universeFileName(u);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return a.download;
}

// el código del universo que suena (con su tempo y escala, si `withGlobal`)
export const currentCode = (deck, engine, withGlobal = true) => seedCode({
  seed: deck.seed,
  // (con la marca de CRUJIDO y RUIDO, «-AT2», si nació con ellos: sin ella, el código los perdería)
  style: deck.sty.t > 0 ? { name: deck.sty.name, t: deck.sty.t, purity: deck.sty.purity ?? 1, atmos: deck.sty.atmos?.v } : null,
  global: withGlobal ? nowGlobal(engine) : null,
  motor: deck.motor, // (MOTORES: «-ALPHA»; ver src/motores/LEEME.md)
}) + (deck.similarOf ? ' · PARECIDO' : '');
