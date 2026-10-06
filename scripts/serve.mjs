#!/usr/bin/env node
/* Local preview of drill.html.  node scripts/serve.mjs [port]   (default 8126)
   drill.html is an Artifact fragment: it has no <!doctype>, because the Artifact host wraps it in a
   document skeleton at publish time. Served raw it would render in quirks mode, so this adds the same
   kind of skeleton. It lives in the repo so a launcher config can never point at a deleted temp file. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || process.env.PORT || 8126);
const HEAD = '<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n';

createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];
  // /raw = the file exactly as on disk with no charset anywhere, which is what a browser gets when
  // drill.html is opened by double-clicking it. Use it to check the page survives that.
  if (path === '/raw') {
    const bytes = await readFile(join(ROOT, 'drill.html'));
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end(bytes); return;
  }
  if (path !== '/' && path !== '/drill.html') { res.writeHead(404); res.end('not found'); return; }
  try {
    const body = await readFile(join(ROOT, 'drill.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(HEAD + body + '\n</body></html>');
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log(`tmua-drill preview on http://localhost:${PORT}/`));
