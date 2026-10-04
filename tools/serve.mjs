import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicFiles = new Set(['/index.html', '/styles.css', '/app.mjs', '/simulation.mjs']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const route = path === '/' ? '/index.html' : path;
    if (!publicFiles.has(route)) { res.writeHead(404); res.end('Not found'); return; }
    const target = resolve(root, '.' + route);
    if (!target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Unable to load the garden'); }
}).listen(port, '127.0.0.1', () => console.log(`Starborne Garden: http://127.0.0.1:${port}`));
