// Boots the real server on a test port (3487, never 3000) and runs write-isle-check.py: the two writing isles
// (docs/CONJURE.md 7a) in all three looks, phone upright and sideways, written by real touches.
// Needs Python Playwright and /usr/bin/chromium. Usage: node write-isle-test.mjs [outdir]
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3487;
const out = process.argv[2] || path.join(here, 'screenshots', 'write-isles');
const srv = spawn(process.execPath, [path.join(here, 'server.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 500));
const r = spawnSync('python3', [path.join(here, 'write-isle-check.py'), String(PORT), out], { stdio: 'inherit', timeout: 600000 });
srv.kill();
process.exit(r.status === 0 ? 0 : 1);
