// Check for task 06 (character batch 1). Run: node tasks/checks/t06.mjs   (about 2 minutes: it runs the suites)
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
const require = createRequire(import.meta.url);
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const runs = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return r.status === 0; };

// the batch, exactly as the card gives it
const ADD = {
  '口': ['kǒu', 'mouth', 'folk'], '十': ['shí', 'ten', 'folk'], '田': ['tián', 'field', 'folk'], '土': ['tǔ', 'earth', 'folk'],
  '呆': ['dāi', 'dull', 'folk'], '杏': ['xìng', 'apricot', 'wood', 'span', 3], '果': ['guǒ', 'fruit', 'wood', 'span', 3],
  '叶': ['yè', 'leaf', 'wood', 'span', 3], '古': ['gǔ', 'old', 'folk'], '早': ['zǎo', 'early', 'light'],
  '赤': ['chì', 'red', 'fire', 'reach', 1.3], '灶': ['zào', 'stove', 'fire', 'reach', 1.3]
};
const RECIPES = [['⿱', '口', '木', '呆'], ['⿱', '木', '口', '杏'], ['⿱', '田', '木', '果'], ['⿰', '口', '十', '叶'],
  ['⿱', '十', '口', '古'], ['⿱', '日', '十', '早'], ['⿱', '土', '火', '赤'], ['⿰', '火', '土', '灶']];
const OLD = '木林森火炎焚水沐淋日月明昌朋人从众休伙女子好杲杳';

try { execFileSync('node', ['tools/pack.mjs', '--check'], { stdio: 'pipe' }); check(true, 'content.js is up to date'); } catch (e) { check(false, 'content.js is up to date (run: node tools/pack.mjs)'); }
const raw = JSON.parse(fs.readFileSync('content/glyphs.json', 'utf8'));
const LV = require('../../levels.js');
for (const [ch, [py, en, el, k, v]] of Object.entries(ADD)) {
  const g = raw.glyphs[ch] || {};
  const keys = Object.keys(g).sort().join(',');
  const wantKeys = ['el', 'en', 'py'].concat(k ? [k] : []).sort().join(',');
  check(g.py === py && g.en === en && g.el === el && (!k || g[k] === v) && keys === wantKeys,
    `${ch} is {"py":"${py}","en":"${en}","el":"${el}"${k ? `,"${k}":${v}` : ''}} and nothing more`);
}
for (const [op, a, b, r] of RECIPES) check(LV.fuse(op, a, b) === r, `${a} ${op} ${b} makes ${r}`);
check(LV.fuse('⿰', '十', '口') === null && LV.fuse('⿱', '火', '土') === null, 'the other orders make nothing (口 must sit left of 十, 土 on top of 火)');
check([...OLD].every(ch => raw.glyphs[ch]) && Object.keys(raw.glyphs).length === OLD.length + Object.keys(ADD).length,
  `the 24 old characters are all still there and nothing else was added (${Object.keys(raw.glyphs).length} in all, want 36)`);
check(raw.recipes.length === 16 + RECIPES.length, `the 16 old recipes stay and 8 are added (${raw.recipes.length}, want 24)`);
check(runs('node', ['tools/recipes.mjs']), 'node tools/recipes.mjs: every recipe matches the MMAH dictionary');
const strokes = JSON.parse(fs.readFileSync('vendor/strokes.json', 'utf8'));
const noStroke = Object.keys(ADD).filter(ch => !(strokes.chars || {})[ch]);
check(noStroke.length === 0, 'vendor/strokes.json has stroke data for every new character (node tools/strokes.mjs --glyphs)' + (noStroke.length ? ': missing ' + noStroke.join('') : ''));
const py = fs.existsSync(os.homedir() + '/.venv/bin/python') ? os.homedir() + '/.venv/bin/python' : 'python3';
check(runs(py, ['tools/font.py', '--check']), 'tools/font.py --check: the brush font holds every character');
const stages = fs.readdirSync('content/stages').map(f => 'content/stages/' + f);
check(runs('node', ['tools/judge.mjs', ...stages]), 'every shipped stage still PASSes the judge');
for (const t of ['sim-test.mjs', 'smoke-test.mjs', 'judge-test.mjs', 'forge-test.mjs']) check(runs('node', [t]), `node ${t} still passes`);
console.log(ok ? '--- TASK 06 DONE ---' : '--- TASK 06 NOT DONE ---'); process.exit(ok ? 0 : 1);
