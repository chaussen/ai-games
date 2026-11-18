// Read a playtest log (node server.js --log) and print the G1 numbers from docs/forge/PLAYTEST.md §4.
//   node lab/playlog.mjs logs/playtest-<date>.jsonl          a table for people
//   node lab/playlog.mjs logs/playtest-<date>.jsonl --json   one JSON object
// Never prints player ids: the report does not need them.
import fs from 'node:fs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const file = args.find(a => a !== '--json');
if (!file) { console.error('usage: node lab/playlog.mjs <playtest.jsonl> [--json]'); process.exit(2); }
if (!fs.existsSync(file)) { console.error(`no such log file: ${file}`); process.exit(1); }

const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

let lines = 0, bad = 0;
const sessions = new Set();
const groups = new Map();      // "stage\u0000profile" -> group
const visits = new Map();      // sess -> current visit
const WHY = ['norel', 'mirror', 'dud', 'cooldown', 'wrong'];

const groupOf = e => {
  const key = e.stage + '\u0000' + e.profile;
  if (!groups.has(key)) groups.set(key, { stage: e.stage, profile: e.profile, tries: 0, forges: 0, why: {}, firstForges: [], winTimes: [] });
  return groups.get(key);
};

for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!raw.trim()) continue;
  let e;
  try { e = JSON.parse(raw); } catch (err) { bad++; continue; }
  if (!e || typeof e !== 'object') { bad++; continue; }
  lines++;
  if (e.sess != null) sessions.add(e.sess);
  const g = groupOf(e);
  if (e.t === 'stage') { visits.set(e.sess, { start: e.ts, g, forged: false, won: false }); continue; }
  const v = visits.get(e.sess);
  if (e.t === 'try') { g.tries++; if (WHY.includes(e.why)) g.why[e.why] = (g.why[e.why] || 0) + 1; }
  else if (e.t === 'forge') {
    g.forges++;
    if (v && !v.forged) { v.forged = true; v.g.firstForges.push((e.ts - v.start) / 1000); }
  } else if (e.t === 'win') {
    if (v && !v.won) { v.won = true; v.g.winTimes.push((e.ts - v.start) / 1000); }
  }
}

const out = { lines, bad, sessions: sessions.size, groups: [] };
for (const g of groups.values()) {
  if (g.stage == null) continue;
  const c = w => g.why[w] || 0;
  const failed = c('norel') + c('mirror') + c('dud');
  const row = {
    stage: g.stage, profile: g.profile,
    tries: g.tries, forges: g.forges,
    triesPerForge: g.forges ? r2(g.tries / g.forges) : null,
    norel: c('norel'), mirror: c('mirror'), dud: c('dud'), cooldown: c('cooldown'), wrong: c('wrong'),
    failed,
    handShare: failed ? r2(c('norel') / failed) : null,
    grammarShare: failed ? r2(c('mirror') / failed) : null,
    firstForge: g.firstForges.length ? r1(avg(g.firstForges)) : null,
    wins: g.winTimes.length,
    winTime: g.winTimes.length ? r1(avg(g.winTimes)) : null,
    flags: []
  };
  if (row.triesPerForge != null && (row.triesPerForge < 1.2 || row.triesPerForge > 3)) row.flags.push('triesPerForge');
  if (row.handShare != null && row.handShare >= 0.4) row.flags.push('handShare');
  if (row.grammarShare != null && (row.grammarShare < 0.2 || row.grammarShare > 0.6)) row.flags.push('grammarShare');
  if (row.firstForge != null && row.firstForge >= 60) row.flags.push('firstForge');
  out.groups.push(row);
}

if (json) { console.log(JSON.stringify(out)); process.exit(0); }

const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
const num = (v, d) => v == null ? '—' : v.toFixed(d);
console.log(`${file}: ${lines} events, ${bad} bad lines, ${out.sessions} session(s)`);
console.log('');
const head = ['stage', 'profile', 'tries/forge', 'hand', 'grammar', '1st forge s', 'wins', 'win s', 'flags'];
const rows = out.groups.map(g => [g.stage, g.profile, num(g.triesPerForge, 1), pct(g.handShare), pct(g.grammarShare),
  num(g.firstForge, 1), String(g.wins), num(g.winTime, 1), g.flags.length ? g.flags.join(', ') : 'ok']);
const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
const line = r => r.map((c, i) => c.padEnd(w[i])).join('  ');
console.log(line(head));
console.log(w.map(n => '-'.repeat(n)).join('  '));
for (const r of rows) console.log(line(r));
console.log('');
console.log('Healthy (PLAYTEST §4): tries/forge 1.2–3, hand < 40%, grammar 20–60%, first forge < 60 s.');
