/* Jednoduchý statický server pro vývoj: node tools/server.js [port]
   Poslouchá jen na 127.0.0.1. Pro přihlášení Google musí být http://localhost:<port> v „Authorized JavaScript origins“ OAuth klienta. */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOREN = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2]) || 8790;
const TYPY = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };

http.createServer(async (req, res) => {
  try {
    let cesta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (cesta.endsWith('/')) cesta += 'index.html';
    const soubor = normalize(join(KOREN, cesta));
    if (!soubor.startsWith(KOREN + sep)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(soubor)).isFile()) throw new Error('není soubor');
    res.writeHead(200, { 'Content-Type': TYPY[extname(soubor)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(soubor));
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nenalezeno');
  }
}).listen(PORT, '127.0.0.1', () => console.log('Finance: http://localhost:' + PORT + '/  (ukázka: http://localhost:' + PORT + '/?ukazka)'));
