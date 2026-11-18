// Check for task 07 (candidate isle "old-leaf"). Run: node tasks/checks/t07.mjs   (under a minute)
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { lint } from '../../tools/judge/lint.mjs';
const require = createRequire(import.meta.url);
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const FILE = 'content/candidates/old-leaf.json';

const LV = require('../../levels.js');
check(LV.fuse('⿱', '十', '口') === '古' && LV.fuse('⿰', '口', '十') === '叶', 'task 06 is done first (十 on 口 makes 古, 口 beside 十 makes 叶)');
let L = null;
try { L = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* reported below */ }
check(!!L, FILE + ' exists and is valid JSON');
if (L) {
  check(L.id === 'old-leaf' && L.want === '古', 'its id is "old-leaf" and it wants 古');
  const pieces = (L.stones || []).map(s => s[0]);
  check(pieces.includes('十') && pieces.includes('口') && pieces.every(p => p === '十' || p === '口') && pieces.length >= 2 && pieces.length <= 4,
    `its stones are 十 and 口 only, 2 to 4 of them (${pieces.join(' ')})`);
  check(L.regrow === true, '"regrow": true (stones are used up; forge stages regrow, FG-D012)');
  check(!L.strict || L.strict === 'standard', 'the profile is standard (leave "strict" out or set it to "standard")');
  const problems = await lint(L);
  check(problems.length === 0, 'the lint finds no problems' + (problems.length ? ': ' + problems.map(p => p.code + ' ' + p.msg).slice(0, 3).join(' | ') : ''));
  const shipped = fs.readdirSync('content/stages').map(f => JSON.parse(fs.readFileSync('content/stages/' + f, 'utf8')));
  check(shipped.every(s => JSON.stringify(s.map) !== JSON.stringify(L.map)), 'its map is its own, not a copy of a shipped stage');
  check(shipped.every(s => s.id !== 'old-leaf') && !fs.readFileSync('content/order.json', 'utf8').includes('old-leaf'), 'it stays a candidate: not in content/stages/ and not in content/order.json');
  const j = spawnSync(process.execPath, ['tools/judge.mjs', FILE, '--json'], { encoding: 'utf8' });
  let v = null; try { v = JSON.parse(j.stdout)[0]; } catch (e) { /* reported below */ }
  check(v && v.pass, 'the judge PASSes it (node tools/judge.mjs ' + FILE + ')' + (v && !v.pass ? ': ' + (v.problems || []).map(p => p.msg).slice(0, 2).join(' | ') : ''));
  check(v && v.routes.length >= 2, `the judge finds two different routes (${v ? v.routes.length : 0})`);
  check(v && v.routes.some(r => r.steps.some(s => /sets 十 on top of 口/.test(s))), 'a route sets 十 on top of 口');
}
console.log(ok ? '--- TASK 07 DONE ---' : '--- TASK 07 NOT DONE ---'); process.exit(ok ? 0 : 1);
