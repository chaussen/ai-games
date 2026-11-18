// Check for task 05 (the playtest log reader). Run: node tasks/checks/t05.mjs   (about 1 second)
// Runs lab/playlog.mjs on a small, known log (tasks/checks/fixtures/playlog.jsonl, written in the
// exact format `node server.js --log` writes) and compares the numbers.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

let ok = true;
const check = (c, m) => { console.log((c ? 'PASS ✓ ' : 'FAIL ✗ ') + m); if (!c) ok = false; };
const run = (...args) => spawnSync(process.execPath, ['lab/playlog.mjs', ...args], { encoding: 'utf8' });
const FIX = 'tasks/checks/fixtures/playlog.jsonl';

check(fs.existsSync('lab/playlog.mjs'), 'lab/playlog.mjs exists');
let out = null;
const j = run(FIX, '--json');
check(j.status === 0, 'node lab/playlog.mjs <log> --json exits 0' + (j.stderr ? ': ' + j.stderr.trim().split('\n')[0] : ''));
try { out = JSON.parse(j.stdout); } catch (e) { /* reported below */ }
check(!!out, '--json prints one JSON object and nothing else');
if (out) {
  check(out.lines === 17 && out.bad === 1, `it reads 17 events and counts 1 bad line, skipping the blank one (lines ${out.lines}, bad ${out.bad})`);
  check(out.sessions === 1, `it counts sessions by "sess" (sessions ${out.sessions})`);
  const g = out.groups || [];
  check(g.length === 2 && g[0].stage === 'dawn' && g[0].profile === 'relaxed' && g[1].stage === 'two-trees' && g[1].profile === 'standard',
    'one group per stage and profile, in the order they first appear');
  const want = [
    { tries: 4, forges: 1, triesPerForge: 4, norel: 2, mirror: 1, dud: 0, cooldown: 0, wrong: 0, failed: 3, handShare: 0.67, grammarShare: 0.33, firstForge: 28, wins: 1, winTime: 48, flags: ['triesPerForge', 'handShare'] },
    { tries: 4, forges: 2, triesPerForge: 2, norel: 0, mirror: 0, dud: 1, cooldown: 1, wrong: 1, failed: 1, handShare: 0, grammarShare: 0, firstForge: 12, wins: 0, winTime: null, flags: ['grammarShare'] }
  ];
  want.forEach((w, i) => {
    const got = g[i] || {};
    for (const [k, v] of Object.entries(w)) {
      const same = JSON.stringify(got[k]) === JSON.stringify(v);
      check(same, `${w === want[0] ? 'dawn' : 'two-trees'}: ${k} is ${JSON.stringify(v)}` + (same ? '' : ` (got ${JSON.stringify(got[k])})`));
    }
  });
}

const t = run(FIX);
check(t.status === 0 && /dawn/.test(t.stdout) && /two-trees/.test(t.stdout) && /relaxed/.test(t.stdout), 'without --json it prints a readable table naming each stage and profile');
check(/4\.0|4\b/.test(t.stdout) && /67%/.test(t.stdout) && /28/.test(t.stdout), 'the table shows tries per forge (4), shares as percents (67%) and seconds (28)');
check(!/p-x1/.test(t.stdout) && !(j.stdout || '').includes('p-x1'), 'it never prints player ids');
const miss = run('tasks/checks/fixtures/no-such-file.jsonl');
check(miss.status === 1 && /no-such-file/.test(miss.stdout + miss.stderr), 'a missing file: exit 1 and a message naming the file');
const none = run();
check(none.status === 2 && /usage/i.test(none.stdout + none.stderr), 'no file at all: exit 2 and a usage line');

console.log(ok ? '--- TASK 05 DONE ---' : '--- TASK 05 NOT DONE ---'); process.exit(ok ? 0 : 1);
