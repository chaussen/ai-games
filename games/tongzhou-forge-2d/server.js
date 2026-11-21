// 同舟 · Glyph Isles 2D — zero-install static server for the greybox. The game runs in the page
// (one player); the server only hands out files and prints the address phones can use.
//   node server.js              port 3300
//   PORT=3000 node server.js    on a machine where only 3000 is open (phone playtests here)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 3300);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
};
// only what the page needs is served; tests, docs and tools stay on the computer
const PUBLIC = new Set(['index.html', 'style.css', 'app.js', 'ink.js', 'cut.js', 'things.js', 'sim.js', 'rules.js', 'isles.js', 'content.js']);

function lanIPs() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|virbr|vnet|veth|tun|tap|wg|tailscale|zt|lxc|podman)/i.test(name)) continue;
    for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end('bad request'); return; }
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (p === '/') p = '/index.html';
  const rel = p.replace(/^\/+/, '');
  const ok = PUBLIC.has(rel) || (/^vendor\/[\w.-]+\.(woff2|txt|js|json)$/.test(rel));
  const file = path.join(ROOT, rel);
  if (!ok || !file.startsWith(ROOT + path.sep)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

server.listen(PORT, HOST, () => {
  console.log('Glyph Isles 2D on http://localhost:' + PORT + '/');
  for (const ip of lanIPs()) console.log('Phones (Wi-Fi): http://' + ip + ':' + PORT + '/');
});
module.exports = server;
