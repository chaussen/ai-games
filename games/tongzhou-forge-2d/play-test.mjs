// Boots the real server on a test port (3484, never 3000) and runs tools/play-check.py against it: the first
// scripted route of every isle, played inside the real page at real speed (renderer, messages, win card),
// failing on a lost isle or a console error. Needs Python Playwright and /usr/bin/chromium. About 8 minutes.
// Usage: [ART=ink|cut|greybox] [ISLES=rest,blaze] node play-test.mjs [outdir]   (default screenshots/play/<look>)
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3484;
const ART = process.env.ART || 'ink';
const out = process.argv[2] || path.join(here, 'screenshots', 'play', ART);
const srv = spawn(process.execPath, [path.join(here, 'server.js')], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 500));
const args = [path.join(here, 'tools', 'play-check.py'), String(PORT), ART, out].concat(process.env.ISLES ? [process.env.ISLES] : []);
const r = spawnSync('python3', args, { stdio: 'inherit', timeout: 1800000 });
srv.kill();
process.exit(r.status === 0 ? 0 : 1);
