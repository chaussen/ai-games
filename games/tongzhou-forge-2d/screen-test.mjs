// Boots the real server on a test port (3482, never 3000) and runs screen-check.py against it:
// eleven screens (phones upright and on their side, four iPads, three laptops), real multi-touch input, the
// screen budget, and screenshots. Needs Python Playwright and /usr/bin/chromium.
// Usage: node screen-test.mjs [outdir]   (default: screenshots/greybox)
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3482;
const out = process.argv[2] || path.join(here, 'screenshots', 'greybox');
const srv = spawn(process.execPath, [path.join(here, 'server.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 500));
const r = spawnSync('python3', [path.join(here, 'screen-check.py'), String(PORT), out], { stdio: 'inherit', timeout: 300000 });
srv.kill();
process.exit(r.status === 0 ? 0 : 1);
