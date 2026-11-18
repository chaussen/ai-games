// lab/bench.mjs: how the matcher holds up as the candidate set grows (ROADMAP card B4).
//
// SYNTHETIC — NOT A GATE RESULT. The drawings are Make Me a Hanzi medians put through the
// mistakes children make (wrong stroke order, a stroke drawn backwards, two strokes joined,
// a slanted / squashed character, a shaky hand). It answers "does order tolerance work, and how
// fast does confusion grow with 30 / 100 / 300 candidates?". Only real phone drawings
// (card B2, lab/accuracy.mjs) can pass the gate in PLAN.md §5.
//
// Setup (build time, once):
//   node tools/strokes.mjs --glyphs 不 吗 和 --file <(grep -v '^#' lab/common.txt) --out lab/bench-strokes.json
// Run:
//   node lab/bench.mjs [--per 20] [--seed 1]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WRecog = require('../vendor/recogniser.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const PER = arg('per', 20);
let seed = arg('seed', 1) >>> 0 || 1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

const benchFile = path.join(here, 'bench-strokes.json');
if (!fs.existsSync(benchFile)) {
  console.log('No lab/bench-strokes.json. Build it first (see the top of this file).');
  process.exit(2);
}
const data = JSON.parse(fs.readFileSync(benchFile, 'utf8')).chars;
const glyphs = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'content', 'glyphs.json'), 'utf8')).glyphs);
const common = fs.readFileSync(path.join(here, 'common.txt'), 'utf8').split('\n')
  .filter(l => !l.startsWith('#')).join('');
const order = [];
for (const ch of [...glyphs, ...Array.from(common)]) if (data[ch] && !order.includes(ch)) order.push(ch);

// The characters we test are the game's own; the rest are distractors.
const targets = glyphs.filter(ch => data[ch]);
const medians = ch => data[ch].m.map(st => st.map(([x, y]) => [x / 1024, (900 - y) / 1024]));

// ---------- one child-like drawing ----------
const MISTAKES = ['clean', 'order', 'reverse', 'join', 'slant', 'shaky', 'all'];
function draw(ch, kind) {
  let st = medians(ch).map(s => s.map(p => p.slice()));
  const doIt = k => kind === k || kind === 'all';
  if (doIt('order') && st.length > 1) {                       // swap two or three strokes
    for (let k = 0; k < 1 + Math.floor(rnd() * 2); k++) {
      const i = Math.floor(rnd() * st.length), j = Math.floor(rnd() * st.length);
      [st[i], st[j]] = [st[j], st[i]];
    }
  }
  if (doIt('reverse')) {                                      // one stroke drawn backwards
    const i = Math.floor(rnd() * st.length);
    st[i] = st[i].slice().reverse();
  }
  if (doIt('join') && st.length > 2) {                        // two strokes written as one
    const i = Math.floor(rnd() * (st.length - 1));
    st.splice(i, 2, st[i].concat(st[i + 1]));
  }
  if (doIt('slant')) {                                        // squashed, sheared, a little rotated
    const sx = 0.8 + rnd() * 0.4, sy = 0.8 + rnd() * 0.4, sh = (rnd() - 0.5) * 0.3, r = (rnd() - 0.5) * 0.15;
    const c = Math.cos(r), s = Math.sin(r);
    st = st.map(q => q.map(([x, y]) => {
      x = (x - 0.5) * sx + (y - 0.5) * sh; y = (y - 0.5) * sy;
      return [0.5 + x * c - y * s, 0.5 + x * s + y * c];
    }));
  }
  const sigma = doIt('shaky') ? 0.03 : 0.01;
  return st.map(q => q.map(([x, y]) => [x + gauss() * sigma, y + gauss() * sigma]));
}

// ---------- run ----------
console.log('SYNTHETIC — NOT A GATE RESULT');
console.log(`${targets.length} target characters × ${PER} drawings per mistake type; distractors from lab/common.txt\n`);
WRecog.setData(data);
const sizes = [30, 100, 300].filter(n => n <= order.length);
const rows = [];
for (const n of sizes) {
  await WRecog.load(order.slice(0, n));
  const line = { n };
  let ms = 0, calls = 0;
  for (const kind of MISTAKES) {
    let t1 = 0, t3 = 0, tot = 0;
    for (const ch of targets) {
      for (let k = 0; k < PER; k++) {
        const d = draw(ch, kind);
        const t0 = performance.now();
        const res = WRecog.match(d);
        ms += performance.now() - t0; calls++;
        const rank = res.findIndex(r => r.ch === ch);
        if (rank === 0) t1++;
        if (rank >= 0 && rank < 3) t3++;
        tot++;
      }
    }
    line[kind] = [Math.round((100 * t1) / tot), Math.round((100 * t3) / tot)];
  }
  line.ms = (ms / calls).toFixed(2);
  rows.push(line);
}

const pad = (s, w) => String(s).padEnd(w);
console.log(pad('candidates', 12) + MISTAKES.map(k => pad(k, 10)).join('') + 'ms/match (this PC)');
for (const r of rows) {
  console.log(pad(r.n, 12) + MISTAKES.map(k => pad(r[k][0] + '/' + r[k][1], 10)).join('') + r.ms);
}
console.log('\ncells are top-1 % / top-3 %. Gate (real samples only): top-1 >= 70, top-3 >= 90, < 200 ms on a mid-range phone.');
console.log('SYNTHETIC — NOT A GATE RESULT');
