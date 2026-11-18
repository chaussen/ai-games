// Check for task 01. Run: node tasks/checks/t01.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
const out = path.join(os.tmpdir(), 'isles-gallery-' + process.pid + '.html');
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
try { execFileSync('node', ['tools/gallery.mjs', '--out', out], { stdio: 'pipe' }); } catch (e) { check(false, 'node tools/gallery.mjs --out <file> runs without error: ' + String(e.stderr || e.message).slice(0, 300)); process.exit(1); }
const html = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
check(html.length > 0, 'it writes the file given after --out');
for (const f of fs.readdirSync('content/stages')) {
  const L = JSON.parse(fs.readFileSync('content/stages/' + f, 'utf8'));
  check(html.includes('<h2>' + L.name + '</h2>'), `the page has <h2>${L.name}</h2>`);
  check(html.includes('id="' + L.id + '"'), `the section for ${L.id} has id="${L.id}"`);
}
const two = html.slice(html.indexOf('id="two-trees"'), html.indexOf('</section>', html.indexOf('id="two-trees"')));
check((two.match(/class="cell /g) || []).length === 70, 'two-trees is drawn as 70 cells (5 rows of 14), each with class="cell ..."');
check((two.match(/class="cell water"/g) || []).length === 33, 'its 33 water cells have class="cell water"');
check(!/https?:\/\//.test(html), 'the page loads nothing from the internet');
fs.rmSync(out, { force: true });
console.log(ok ? '--- TASK 01 DONE ---' : '--- TASK 01 NOT DONE ---'); process.exit(ok ? 0 : 1);
