// 同舟 · Glyph Isles — tests for the judge (tools/judge). It must pass every shipped
// stage, replay the routes it claims, and reject broken stages with the right reason.
// Run with: node judge-test.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { judge } from './tools/judge/index.mjs';
import { replay, calibrate } from './tools/judge/solve.mjs';

let failed = 0;
const check = (cond, msg) => { console.log((cond ? 'PASS ✓ ' : 'FAIL ✗ ') + msg); if (!cond) { failed++; process.exitCode = 1; } };
const load = id => JSON.parse(fs.readFileSync(new URL('./content/stages/' + id + '.json', import.meta.url), 'utf8'));
const order = JSON.parse(fs.readFileSync(new URL('./content/order.json', import.meta.url), 'utf8'));
const codes = v => v.problems.map(p => p.code);

try { execFileSync('node', ['tools/pack.mjs', '--check'], { cwd: new URL('.', import.meta.url), stdio: 'pipe' }); check(true, 'content.js matches content/*.json'); }
catch (e) { check(false, 'content.js matches content/*.json (run node tools/pack.mjs)'); }

const cal = calibrate();
check(cal.jumpGap >= 1 && cal.jumpGapCarry >= 1 && cal.leapGap > cal.jumpGap && cal.boostLand > 3, `the bots measured their own moves in the sim (jump ${cal.jumpGap}, with a stone ${cal.jumpGapCarry}, leap ${cal.leapGap}, boost ${cal.boostLand.toFixed(1)})`);

for (const id of order) {
  const L = load(id), v = await judge(L);
  check(v.pass, `${id}: passes the judge` + (v.pass ? '' : ' — ' + codes(v).join(', ')));
  check(v.routes.length >= 2, `${id}: has two different ways (${v.routes.map(r => r.needs.join('+')).join(' | ')})`);
  check(v.routes.every(r => replay(L, r.log)), `${id}: every recorded route wins when replayed on a fresh game`);
}

// ---- stages that must be rejected, each for one reason ----
const base = load('two-trees');
const broken = (change) => { const L = JSON.parse(JSON.stringify(base)); change(L); return L; };
const expect = async (name, L, code) => { const v = await judge(L); check(!v.pass && codes(v).includes(code), `rejected: ${name} → [${code}]` + (codes(v).includes(code) ? '' : ' but got [' + codes(v).join(', ') + ']')); return v; };

await expect('a field the game does not know', broken(L => { L.enemies = []; }), 'unknown-field');
await expect('a missing pavilion', broken(L => { delete L.beacon; }), 'missing-field');
await expect('a character the game does not have', broken(L => { L.stones[0][0] = '龍'; }), 'bad-value');
await expect('a stone standing on water', broken(L => { L.stones[0] = ['木', 5.5, 2.5]; }), 'off-floor');
await expect('a pavilion that wants what cannot be made', broken(L => { L.want = '明'; }), 'want-unmakeable');
await expect('a hint that shows characters not on the isle', broken(L => { L.hint = 'Bring 明 to the pavilion and the mist will lift for you.'; }), 'hint-stranger');
await expect('a boat that touches no landing', broken(L => { L.boat.rect = [16, 1, 3, 3]; }), 'boat-adrift');
await expect('a thorn wall with no fire stone', broken(L => { L.map = L.map.map(r => r.slice(0, 11) + '.' + r.slice(12)); L.spawn = [13.5, 2.5]; L.trees = []; L.gems = []; L.movers = [{ id: 'h', kind: 'thorn', rect: [11, 1, 1, 3], from: 3.6, to: 1 }]; }), 'wall-without-key');
await expect('a flat isle with nothing in the way', broken(L => { L.map = ['22............', '11111111111111', '11111111111111', '11111111111111', '...........11.']; L.gems = []; }), 'no-obstacle');

const plateau = { id: 'plateau', name: 'High Shrine', cn: '高台', par: 90, pal: 'dusk', want: '林',
  hint: 'The pavilion stands on a cliff. Ride the lift while a friend holds the plate.',
  map: ['333.111111', '333.111111', '333.111111'], spawn: [8.5, 1.5], beacon: [0.5, 1.5],
  boat: { rect: [10, 0, 3, 3], from: [0, 11], to: [0, -15] },
  plates: [{ id: 'P', at: [6, 1], c: 0 }], movers: [{ id: 'lift', rect: [3, 1, 1, 1], from: 1, to: 3, when: ['P'], c: 0 }],
  stones: [['木', 7.5, 0.5], ['木', 7.5, 2.5]] };
const one = await expect('a cliff with only a lift', plateau, 'one-way');
check(one.routes.length === 1 && one.routes[0].needs.join() === 'plate', 'the bots ride a lift while a friend holds the plate');
await expect('a cliff with no lift at all', Object.assign({}, plateau, { plates: [], movers: [] }), 'unsolved');

// ---- the generate → judge → repair loop, against a stand-in for the local model ----
{
  const http = await import('node:http'), os = await import('node:os'), path = await import('node:path');
  const { execFile } = await import('node:child_process');
  const good = broken(L => { L.id = 'mock-isle'; L.name = 'Mock Isle'; });
  const bad = broken(L => { L.id = 'mock-isle'; L.want = '明'; });
  const asked = [];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      asked.push(JSON.parse(body));
      const text = asked.length === 1 ? 'Here is the stage:\n```json\n' + JSON.stringify(bad) + '\n```' : JSON.stringify(good);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'isles-gen-'));
  const log = await new Promise(r => execFile('node', ['tools/gen-stages.mjs', '--url', `http://127.0.0.1:${srv.address().port}/v1`, '--n', '1', '--out', out, '--seed', '7'],
    { cwd: new URL('.', import.meta.url) }, (err, stdout, stderr) => r(stdout + stderr)));
  srv.close();
  check(asked.length === 2, 'generator: a rejected stage is sent back to the model once' + (asked.length === 2 ? '' : '\n' + log));
  check(asked.length > 1 && /cannot|can never make/.test(asked[1].messages[asked[1].messages.length - 1].content), 'generator: the model is told, in words, what the judge found');
  check(fs.existsSync(path.join(out, 'mock-isle.json')) && fs.existsSync(path.join(out, 'mock-isle.verdict.json')), 'generator: the repaired stage and its verdict are saved as a candidate');
  fs.rmSync(out, { recursive: true, force: true });
}

console.log(failed ? `--- ${failed} JUDGE CHECK(S) FAILED ---` : '--- ALL JUDGE CHECKS PASSED ---');
