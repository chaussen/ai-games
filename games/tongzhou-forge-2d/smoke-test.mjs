// Boots the real server on a test port (3481, never 3000) and checks what a phone gets: the page,
// every script and the font, nothing else (no tests, no docs, no path tricks), and that the page
// loads only local files. Then loads the sim the page runs and steps one isle.
// Run: node smoke-test.mjs
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PORT = 3481, base = 'http://127.0.0.1:' + PORT;
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL ' + what); } };

const srv = spawn(process.execPath, [path.join(here, 'server.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'inherit'] });
let out = '';
srv.stdout.on('data', d => { out += d; });
try {
  for (let i = 0; i < 50 && !out.includes('localhost:' + PORT); i++) await new Promise(r => setTimeout(r, 100));
  ok(out.includes('http://localhost:' + PORT + '/'), 'the server prints its address');
  const get = async (p) => { const r = await fetch(base + p); return { status: r.status, type: r.headers.get('content-type') || '', body: await r.text() }; };
  const page = await get('/');
  ok(page.status === 200 && page.type.startsWith('text/html'), 'GET / is the page');
  const refs = [...page.body.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  ok(refs.length >= 6 && refs.every(r => !/^(https?:)?\/\//.test(r)), 'the page loads only local files (' + refs.join(', ') + ')');
  for (const r of refs) {
    const g = await get('/' + r);
    ok(g.status === 200, 'GET /' + r + ' → ' + g.status);
    if (r.endsWith('.js')) ok(g.type.startsWith('text/javascript'), r + ' is served as JavaScript');
  }
  const font = await fetch(base + '/vendor/MaShanZheng-subset.woff2');
  ok(font.status === 200 && font.headers.get('content-type') === 'font/woff2', 'the brush font is served');
  ok((await fetch(base + '/favicon.ico')).status === 204, 'favicon: no content, no 404 in the console');
  for (const p of ['/sim-test.mjs', '/server.js', '/docs/GREYBOX.md', '/../CLAUDE.md', '/%2e%2e/CLAUDE.md', '/vendor/../sim.js.map'])
    ok((await get(p)).status === 404, 'not served: ' + p);
  // the font holds every character the page can show
  const chars = new Set(fs.readFileSync(path.join(here, 'vendor/MaShanZheng-subset.chars.txt'), 'utf8'));
  const han = new Set();
  for (const f of ['content.js', 'isles.js', 'app.js', 'ink.js', 'index.html']) for (const c of fs.readFileSync(path.join(here, f), 'utf8').match(/[一-鿿⺀-⿟]/gu) || []) han.add(c);
  const miss = [...han].filter(c => !chars.has(c));
  ok(!miss.length, 'the brush font covers every character shown (missing: ' + miss.join('') + ')');
  // the sim the page runs
  const { World } = require('./sim.js');
  const w = new World(); w.addPlayer('me');
  for (let i = 0; i < 120; i++) { w.setInput('me', -1, false); w.step(1 / 60); }
  ok(w.players.get('me').x < 42.5 && w.drain().some(e => e.t === 'start'), 'the sim runs and the player walks');
} finally {
  srv.kill();
}
console.log(fail ? `SMOKE: ${pass} passed, ${fail} FAILED` : `ALL ${pass} SMOKE CHECKS PASSED`);
process.exit(fail ? 1 : 0);
