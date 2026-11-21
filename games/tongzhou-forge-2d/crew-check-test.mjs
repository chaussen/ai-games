// Boots the real server on a test port (3490, never 3000) and runs crew-check.py: four headless phones in one crew
// (docs/CO-OP.md), driven by real touches. Needs Python Playwright and /usr/bin/chromium.
// Usage: node crew-check-test.mjs [outdir]
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3490;
const out = process.argv[2] || path.join(here, 'screenshots', 'crew');
const srv = spawn(process.execPath, [path.join(here, 'server.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 500));
const r = spawnSync('python3', [path.join(here, 'crew-check.py'), String(PORT), out], { stdio: 'inherit', timeout: 300000 });
srv.kill();
process.exit(r.status === 0 ? 0 : 1);
