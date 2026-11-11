import { pathToFileURL } from 'node:url';
import path from 'node:path';
const src = path.resolve(process.argv[2]);
const { rollStyle } = await import(pathToFileURL(path.join(src, 'music/styles.js')).href);
const sd = 60 / 125 / 4;
const st = {}; const add = (k, v) => (st[k] ||= []).push(v);
for (let n = 0; n < 2000; n++) {
  const S = rollStyle((n * 2654435761 + 3) >>> 0, 1); const G = S.k.groove;
  const sw0 = 0.55 + 0.03 * ((n * 7919) % 100) / 100; // swing del color: 55–58 %
  for (const i of ['hat', 'perc', 'bass', 'chord']) {
    const sw = Math.min(0.68, sw0 + G[i].sw);
    add(`${i} swing %`, sw * 100);
    add(`${i} retraso semicorchea ms`, (sw - 0.5) * 2 * sd * 1000);
    add(`${i} entero ms`, G[i].tm[0] * 1000);
    add(`${i} rango dibujo ms`, (Math.max(...G[i].tm) - Math.min(...G[i].tm)) * 1000);
  }
}
const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
for (const [k, a] of Object.entries(st)) console.log(k.padEnd(30), 'min', q(a, 0).toFixed(1), ' mediana', q(a, 0.5).toFixed(1), ' max', q(a, 1).toFixed(1));
