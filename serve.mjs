// Servidor estático mínimo, sin dependencias:  node serve.mjs [--open]  ->  http://localhost:5317
import http from 'node:http';
import { exec } from 'node:child_process';
import os from 'node:os';
import { readFile, readdir, writeFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 5317;
const url = `http://localhost:${port}`;
const open = process.argv.includes('--open');
// --lan: accesible desde el móvil en la misma wifi (si no, solo este ordenador)
const lan = process.argv.includes('--lan');
const lanUrls = () =>
  Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${port}`);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

function openBrowser() {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

// ───────── UNIVERSOS GUARDADOS (la biblioteca de la app: src/ui/universeIO.js)
// Cada universo es un archivo .json en universos/ o en una CARPETA dentro (un nivel: p. ej. una
// familia de versiones de una semilla). El formato es el de src/music/universe.js, con su «name».
// Solo se toca esa carpeta, solo archivos .json y nombres limpios. Borrar NO borra: mueve a
// universos/papelera/ (de ahí se puede recuperar a mano). Un universo se nombra por su ruta
// relativa: «archivo.json» o «carpeta/archivo.json».
//   GET    /api/universos             { folders: [{ name, count }], items: [{ file, folder, name, seed, code,
//                                      style, global, saved, similar, motor }] }
//   POST   /api/universos             { name, universe, folder } → lo guarda (nombre repetido: «-2»...)
//   PATCH  /api/universos/<ruta>      { name?, folder? } → cambia el nombre y/o lo mueve de carpeta
//   DELETE /api/universos/<ruta>      → a la papelera
//   POST   /api/carpetas              { name } → crea una carpeta
//   PATCH  /api/carpetas/<carpeta>    { name } → le cambia el nombre
//   DELETE /api/carpetas/<carpeta>    → a la papelera, con lo que tenga dentro
const uniDir = join(root, 'universos');
const TRASH = 'papelera';
const trashDir = join(uniDir, TRASH);
const MAX_BODY = 2 * 1024 * 1024;
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/#/g, 's').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'universo';
const BAD = /[\\/:*?"<>|\x00-\x1f]/;
const safeFile = (f) => (f && !BAD.test(f) && /\.json$/i.test(f) && !f.startsWith('.') ? f : null);
// el nombre de una carpeta: el que se escribe, sin lo que no vale en un nombre de carpeta
const cleanFolder = (n) => String(n ?? '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 60);
const safeFolder = (f) => (f === '' ? '' : f && !BAD.test(f) && !f.startsWith('.') && f.toLowerCase() !== TRASH ? f : null);
const dirOf = (folder) => (folder ? join(uniDir, folder) : uniDir);
// «carpeta/archivo.json» o «archivo.json» → { folder, file } (null si no vale)
const splitRel = (rel) => {
  const p = String(rel).split('/');
  if (p.length > 2) return null;
  const folder = p.length === 2 ? safeFolder(p[0]) : '';
  const file = safeFile(p[p.length - 1]);
  return folder === null || !file ? null : { folder, file };
};
const freeName = async (dir, base, except) => {
  const have = new Set(await readdir(dir));
  let f = `${base}.json`;
  for (let i = 2; have.has(f) && f !== except; i++) f = `${base}-${i}.json`;
  return f;
};
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const readBody = (req) => new Promise((ok, ko) => {
  let n = 0;
  const parts = [];
  req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { ko(new Error('demasiado grande')); req.destroy(); } else parts.push(c); });
  req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch (e) { ko(e); } });
  req.on('error', ko);
});
const sendJson = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
const isDir = async (p) => { try { return (await stat(p)).isDirectory(); } catch { return false; } };
// los universos de una carpeta ('' = sin carpeta)
async function listDir(folder) {
  const out = [];
  for (const f of await readdir(dirOf(folder))) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    try {
      const u = JSON.parse(await readFile(join(dirOf(folder), f), 'utf8'));
      if (!(u && typeof u === 'object' && u.seed >= 0 && u.gen)) continue; // solo universos (no fotos en bruto)
      out.push({ file: folder ? `${folder}/${f}` : f, folder, name: u.name || null, seed: u.seed, code: u.code ?? null, style: u.style ?? null, global: u.global ?? null, saved: u.saved ?? null, similar: u.similar ?? null, motor: u.motor ?? 1 });
    } catch {}
  }
  return out;
}
async function universesApi(req, res, rest) {
  await mkdir(uniDir, { recursive: true });
  if (req.method === 'GET' && !rest) {
    const items = await listDir('');
    const folders = [];
    for (const d of await readdir(uniDir)) {
      if (d.toLowerCase() === TRASH || d.startsWith('.') || !(await isDir(join(uniDir, d)))) continue;
      const inside = await listDir(d);
      folders.push({ name: d, count: inside.length });
      items.push(...inside);
    }
    folders.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    items.sort((a, b) => String(b.saved ?? '').localeCompare(String(a.saved ?? '')));
    return sendJson(res, 200, { folders, items });
  }
  if (req.method === 'POST' && !rest) {
    const { name, universe, folder = '' } = await readBody(req);
    if (!universe || !(universe.seed >= 0) || !universe.gen) return sendJson(res, 400, { error: 'no es un universo' });
    const fo = safeFolder(cleanFolder(folder));
    if (fo === null) return sendJson(res, 400, { error: 'carpeta no válida' });
    await mkdir(dirOf(fo), { recursive: true });
    const nm = String(name || universe.code || 'universo').trim().slice(0, 80);
    const file = await freeName(dirOf(fo), slug(nm));
    await writeFile(join(dirOf(fo), file), JSON.stringify({ ...universe, name: nm }, null, 1));
    return sendJson(res, 200, { file: fo ? `${fo}/${file}` : file, name: nm, folder: fo });
  }
  const at = splitRel(rest);
  if (!at) return sendJson(res, 400, { error: 'archivo no válido' });
  const path = join(dirOf(at.folder), at.file);
  if (req.method === 'PATCH') {
    const body = await readBody(req);
    const u = JSON.parse(await readFile(path, 'utf8'));
    const renaming = body.name !== undefined;
    const nm = renaming ? String(body.name).trim().slice(0, 80) : u.name;
    if (renaming && !nm) return sendJson(res, 400, { error: 'falta el nombre' });
    const fo = body.folder === undefined ? at.folder : safeFolder(cleanFolder(body.folder));
    if (fo === null) return sendJson(res, 400, { error: 'carpeta no válida' });
    await mkdir(dirOf(fo), { recursive: true });
    const sameDir = fo === at.folder;
    const base = renaming ? slug(nm) : at.file.replace(/\.json$/i, '');
    const to = await freeName(dirOf(fo), base, sameDir ? at.file : undefined);
    await writeFile(join(dirOf(fo), to), JSON.stringify({ ...u, name: nm }, null, 1));
    if (!(sameDir && to === at.file)) await rm(path);
    return sendJson(res, 200, { file: fo ? `${fo}/${to}` : to, name: nm, folder: fo });
  }
  if (req.method === 'DELETE') {
    await mkdir(trashDir, { recursive: true });
    await rename(path, join(trashDir, `${at.folder ? `${at.folder} - ` : ''}${at.file.replace(/\.json$/i, '')}-${stamp()}.json`));
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'método no permitido' });
}
async function foldersApi(req, res, rest) {
  await mkdir(uniDir, { recursive: true });
  if (req.method === 'POST' && !rest) {
    const { name } = await readBody(req);
    const fo = safeFolder(cleanFolder(name));
    if (!fo) return sendJson(res, 400, { error: 'nombre de carpeta no válido' });
    if (await isDir(dirOf(fo))) return sendJson(res, 409, { error: 'ya existe esa carpeta' });
    await mkdir(dirOf(fo));
    return sendJson(res, 200, { name: fo });
  }
  const fo = safeFolder(rest);
  if (!fo || !(await isDir(dirOf(fo)))) return sendJson(res, 404, { error: 'no existe esa carpeta' });
  if (req.method === 'PATCH') {
    const to = safeFolder(cleanFolder((await readBody(req)).name));
    if (!to) return sendJson(res, 400, { error: 'nombre de carpeta no válido' });
    if (to === fo) return sendJson(res, 200, { name: to });
    if (await isDir(dirOf(to))) return sendJson(res, 409, { error: 'ya existe esa carpeta' });
    await rename(dirOf(fo), dirOf(to));
    return sendJson(res, 200, { name: to });
  }
  if (req.method === 'DELETE') {
    await mkdir(trashDir, { recursive: true });
    await rename(dirOf(fo), join(trashDir, `${fo}-${stamp()}`));
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 405, { error: 'método no permitido' });
}

const server = http.createServer(async (req, res) => {
  const route = new URL(req.url, 'http://x').pathname;
  for (const [base, fn] of [['/api/universos', universesApi], ['/api/carpetas', foldersApi]]) {
    if (route !== base && !route.startsWith(`${base}/`)) continue;
    try { await fn(req, res, decodeURIComponent(route.slice(base.length + 1))); }
    catch (e) { sendJson(res, e.code === 'ENOENT' ? 404 : 500, { error: e.code === 'ENOENT' ? 'no existe' : String(e.message || e) }); }
    return;
  }
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/])+/, '');
  if (path.startsWith('..')) { res.writeHead(403).end(); return; }
  try {
    const file = join(root, path || 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('404');
  }
});

server.on('error', (err) => {
  // ya hay otro MINIMAL UNIVERSE sirviendo: solo abrimos el navegador
  if (err.code === 'EADDRINUSE') {
    console.log(`Ya estaba en marcha en ${url}`);
    if (lan) console.log('Para el móvil, cierra antes la otra ventana de MINIMAL UNIVERSE y vuelve a abrir este archivo.');
    if (open) openBrowser();
    setTimeout(() => process.exit(0), 500);
  } else throw err;
});

server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`MINIMAL UNIVERSE  ->  ${url}`);
  if (lan) {
    console.log('\nDesde el móvil (misma wifi), abre:');
    for (const u of lanUrls()) console.log(`   ${u}`);
    console.log('');
  }
  console.log('Deja esta ventana abierta mientras tocas. Ciérrala para apagar.');
  if (open) openBrowser();
});
