// Check for task 03. Run: node tasks/checks/t03.mjs
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
try { execFileSync('node', ['tools/pack.mjs', '--check'], { stdio: 'pipe' }); check(true, 'content.js is up to date'); } catch (e) { check(false, 'content.js is up to date (run: node tools/pack.mjs)'); }
const LV = require('../../levels.js');
const want = { '女': ['nǚ', 'woman'], '子': ['zǐ', 'child'], '好': ['hǎo', 'good'] };
for (const [ch, [py, en]] of Object.entries(want)) {
  const g = LV.GLYPHS[ch];
  check(g && g.py === py && g.en === en && g.el === 'folk', `${ch} exists with py "${py}", en "${en}", el "folk"`);
}
check(LV.fuse('女', '子') === '好' && LV.fuse('子', '女') === '好', '女 + 子 = 好, in either order');
check(Object.keys(LV.GLYPHS).length === 22, 'nothing else was added or removed (22 characters in all)');
try { execFileSync('node', ['sim-test.mjs'], { stdio: 'pipe' }); check(true, 'node sim-test.mjs still passes'); } catch (e) { check(false, 'node sim-test.mjs still passes'); }
console.log(ok ? '--- TASK 03 DONE ---' : '--- TASK 03 NOT DONE ---'); process.exit(ok ? 0 : 1);
