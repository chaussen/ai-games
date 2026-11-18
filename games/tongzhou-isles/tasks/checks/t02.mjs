// Check for task 02. Run: node tasks/checks/t02.mjs
import fs from 'node:fs';
import { lint } from '../../tools/judge/lint.mjs';
let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const load = id => JSON.parse(fs.readFileSync('content/stages/' + id + '.json', 'utf8'));
for (const f of fs.readdirSync('content/stages')) check((await lint(load(f.replace('.json', '')))).length === 0, f + ' still has no problems');
const two = load('two-trees'); two.gems = two.gems.slice(0, 2);
const p2 = await lint(two);
check(p2.some(p => p.code === 'gem-count' && p.where === 'gems'), 'a stage with 2 gems gets a problem with code "gem-count" and where "gems"');
check(p2.some(p => p.code === 'gem-count' && /3/.test(p.msg) && /2/.test(p.msg)), 'its message says how many there are (2) and how many are needed (3)');
const none = load('two-trees'); delete none.gems;
check((await lint(none)).some(p => p.code === 'gem-count'), 'a stage with no "gems" field gets the problem too');
const four = load('two-trees'); four.gems.push([8.5, 2.5]);
check((await lint(four)).some(p => p.code === 'gem-count'), 'a stage with 4 gems gets the problem too');
console.log(ok ? '--- TASK 02 DONE ---' : '--- TASK 02 NOT DONE ---'); process.exit(ok ? 0 : 1);
