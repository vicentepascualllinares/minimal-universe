// Servidor estático mínimo, sin dependencias:  node serve.mjs [--open]  ->  http://localhost:5317
import http from 'node:http';
import { exec } from 'node:child_process';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
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

const server = http.createServer(async (req, res) => {
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
