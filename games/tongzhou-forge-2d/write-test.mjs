// The recogniser the pad runs (vendor/recogniser.js on vendor/strokes.json), checked in node. docs/CONJURE.md §5.
// SYNTHETIC: drawings are the characters' own stroke medians, moved about, drawn backwards and out of order.
// Passing says the matcher and the data are wired right; it does NOT say children's writing is read (no real samples).
// Run: node write-test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const R = require('./vendor/recogniser.js');
const DATA = require('./vendor/strokes.json');
const RU = require('./rules.js');
const PAD_MIN = 0.65;   // app.js UI.padMinScore: below it the pad says it cannot read the drawing

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL ' + what); } };
let seed = 20261121;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const med = ch => DATA.chars[ch].m.map(st => st.map(([x, y]) => [x / 1024, (900 - y) / 1024]));
// a sloppy copy: every stroke shifted a little, every point shaken, some strokes reversed, maybe out of order
const sloppy = (ch, J, flip, shuffle) => {
  let s = med(ch).map(st => { const ox = (rnd() - 0.5) * J, oy = (rnd() - 0.5) * J; return st.map(([x, y]) => [x + ox + (rnd() - 0.5) * J * 0.5, y + oy + (rnd() - 0.5) * J * 0.5]); });
  if (flip) s = s.map((st, i) => i % 2 ? st.slice().reverse() : st);
  if (shuffle) s = s.slice().reverse();
  return s;
};

const glyphs = Object.keys(RU.GLYPHS);
ok(glyphs.every(ch => DATA.chars[ch] && DATA.chars[ch].m.length), 'strokes.json has every character in the game (missing: ' + glyphs.filter(ch => !DATA.chars[ch]).join('') + ')');
ok(/Arphic/.test(DATA._notice) && /LGPL/.test(DATA._notice), 'strokes.json says where it comes from and under which licences');

await R.load(glyphs);
let n = 0, first = 0, usable = 0;
for (const ch of glyphs) {
  for (const [J, flip, shuffle] of [[0.06, false, false], [0.06, true, false], [0.1, false, true], [0.12, true, true]]) {
    const m = R.match(sloppy(ch, J, flip, shuffle));
    n++;
    if (m[0] && m[0].ch === ch) first++;
    if (m[0] && m[0].ch === ch && m[0].score >= PAD_MIN) usable++;
  }
}
ok(first === n, `every character read first from a sloppy copy of itself (${first} / ${n})`);
ok(usable === n, `and scored at least ${PAD_MIN}, so the pad offers it (${usable} / ${n})`);

// scribbles: random strokes should mostly fall under the pad's threshold
let low = 0;
const N = 400;
for (let i = 0; i < N; i++) {
  const k = 1 + Math.floor(rnd() * 8);
  const s = [...Array(k)].map(() => [...Array(2 + Math.floor(rnd() * 4))].map(() => [rnd(), rnd()]));
  const m = R.match(s);
  if (!m[0] || m[0].score < PAD_MIN) low++;
}
ok(low / N >= 0.97, `random scribbles mostly unreadable (${low} / ${N} under ${PAD_MIN})`);
ok(R.match([]).length === 0 && R.match(null).length === 0, 'no strokes: no guesses');
const t0 = process.hrtime.bigint();
for (let i = 0; i < 20; i++) R.match(sloppy('森', 0.08));
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
ok(ms < 40, `one read against all ${glyphs.length} characters takes ${ms.toFixed(1)} ms (under 40 in node)`);

console.log(fail ? `WRITE TESTS: ${pass} passed, ${fail} FAILED` : `ALL ${pass} WRITE TESTS PASSED (synthetic: not a measure of real handwriting)`);
process.exit(fail ? 1 : 0);
