// tools/handwriting.mjs: the synthetic handwriting generator for the recogniser tests (docs/RECOGNISER.md §2).
// Phase 1B. Real children's handwriting has never been measured (RECOGNISER.md §1), so the confusion matrix runs
// on synthetic drawings: the character's own Make Me a Hanzi medians, deformed the ways a finger on a small pad
// deforms writing — jitter, wobble, tilt, stretch, rounded (sloppy) corners, strokes drawn backwards or out of
// order, strokes missing, joined or split, and an extra stroke.
//
// BUILD TIME / TEST ONLY (imported by write-test.mjs). The generator is seeded: the same seed gives the same
// drawings, so test runs are reproducible. It never reads anything but vendor/strokes.json.
//
//   import { drawings, PRESETS } from './tools/handwriting.mjs';
//   drawings('火', 10, 'child', 42)  ->  10 sloppy copies of 火 (strokes in 0..1, Y down, as the pad emits)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../vendor/strokes.json'), 'utf8'));

// ---------- a small seeded rng (mulberry32): reproducible noise, no Math.random in tests ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// medians -> 0..1 with Y down (the pad's coordinates; MMAH is a 1024 box with Y up)
function medians(ch) {
  const m = DATA.chars[ch] && DATA.chars[ch].m;
  if (!m) throw new Error('no stroke data for ' + ch);
  return m.map(st => st.map(([x, y]) => [x / 1024, (900 - y) / 1024]));
}

// ---------- deformations ----------
const lerp = (a, b, t) => a + (b - a) * t;

// low-frequency drift along a stroke: a shaky hand, not per-point noise
function wobbleStroke(st, amp, rand) {
  const dirX = rand() * 2 - 1, dirY = rand() * 2 - 1;
  const l = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / l, ny = dirY / l;
  const phase = rand() * Math.PI * 2, freq = 1.5 + rand() * 2;
  return st.map(([x, y], i, a) => {
    const t = a.length > 1 ? i / (a.length - 1) : 0;
    const d = amp * Math.sin(phase + freq * Math.PI * t);
    return [x + nx * d, y + ny * d];
  });
}

function jitterStroke(st, amp, rand) {
  return st.map(([x, y]) => [x + (rand() * 2 - 1) * amp, y + (rand() * 2 - 1) * amp]);
}

// rotate about the centre of the whole drawing
function rotateAll(strokes, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  let mx = 0, my = 0, n = 0;
  for (const st of strokes) for (const [x, y] of st) { mx += x; my += y; n++; }
  mx /= n || 1; my /= n || 1;
  return strokes.map(st => st.map(([x, y]) => {
    const dx = x - mx, dy = y - my;
    return [mx + dx * c - dy * s, my + dx * s + dy * c];
  }));
}

// non-uniform stretch about the centre: what survives normalisation (a pure scale does not)
function stretchAll(strokes, sx, sy) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const st of strokes) for (const [x, y] of st) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return strokes.map(st => st.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]));
}

// one smoothing pass rounds the corners (a sloppy corner is a cut or rounded corner)
function smoothStroke(st) {
  if (st.length < 3) return st;
  return st.map((p, i) => (i === 0 || i === st.length - 1) ? p
    : [lerp(p[0], (st[i - 1][0] + st[i + 1][0]) / 2, 0.6), lerp(p[1], (st[i - 1][1] + st[i + 1][1]) / 2, 0.6)]);
}

// a child simplifies a long stroke to a few points, which rounds corners further
function decimate(st, keep) {
  if (st.length <= keep) return st;
  const out = [];
  for (let i = 0; i < keep - 1; i++) out.push(st[Math.round(i * (st.length - 1) / (keep - 2))]);
  out.push(st[st.length - 1]);
  return out;
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- the presets (RECOGNISER.md §2.1): clean, child, wild ----------
export const PRESETS = {
  // a careful copy on a desk: slight noise, everything in order
  clean: { jitter: 0.008, wobble: 0.010, rot: 4, stretch: 0.04, smooth: 1, decimate: 0, reverse: 0.10, shuffleP: 0, dropP: 0, extraP: 0, joinP: 0 },
  // a child on a phone with one finger: wobbly, tilted, corners gone, some strokes backwards or out of order
  child: { jitter: 0.020, wobble: 0.030, rot: 9, stretch: 0.08, smooth: 2, decimate: 6, reverse: 0.30, shuffleP: 0.20, dropP: 0.05, extraP: 0.05, joinP: 0.05 },
  // a wild scribble that is still recognisably the character: everything at once, heavier
  wild: { jitter: 0.035, wobble: 0.050, rot: 15, stretch: 0.12, smooth: 3, decimate: 4, reverse: 0.50, shuffleP: 0.40, dropP: 0.12, extraP: 0.10, joinP: 0.10 }
};

// one sloppy copy of ch at the given preset; seed decides every random choice
export function drawing(ch, preset, seed) {
  const P = typeof preset === 'string' ? PRESETS[preset] : (preset || PRESETS.child);
  const rand = rng(seed);
  let strokes = medians(ch).map(st => decimate(st, Math.max(3, P.decimate)));
  strokes = strokes.map(st => smoothStroke(st));
  for (let i = 1; i < P.smooth; i++) strokes = strokes.map(smoothStroke);
  strokes = wobbleAll(strokes, P.wobble, rand);
  strokes = strokes.map(st => jitterStroke(st, P.jitter, rand));
  strokes = rotateAll(strokes, (rand() * 2 - 1) * P.rot * Math.PI / 180);
  const s = P.stretch;
  strokes = stretchAll(strokes, 1 + (rand() * 2 - 1) * s, 1 + (rand() * 2 - 1) * s);
  // backwards strokes
  if (P.reverse) strokes = strokes.map(st => rand() < P.reverse ? st.slice().reverse() : st);
  // order noise: the whole drawing out of order
  if (P.shuffleP && rand() < P.shuffleP) strokes = shuffle(strokes, rand);
  // a stroke missing: children drop dots (the shortest strokes) most often
  if (P.dropP && rand() < P.dropP && strokes.length > 2) {
    let shortest = 0, L = Infinity;
    strokes.forEach((st, i) => { const l = st.reduce((a, p, j) => j ? a + Math.hypot(p[0] - st[j - 1][0], p[1] - st[j - 1][1]) : 0, 0); if (l < L) { L = l; shortest = i; } });
    if (rand() < 0.6) strokes = strokes.filter((_, i) => i !== shortest);      // usually the dot
    else strokes = strokes.filter((_, i) => i !== Math.floor(rand() * strokes.length));
  }
  // an extra stroke: a short stray mark
  if (P.extraP && rand() < P.extraP) {
    const x = rand(), y = rand(), l = 0.05 + rand() * 0.1, a = rand() * Math.PI * 2;
    strokes.push([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]]);
  }
  // two strokes joined into one (a finger does not lift)
  if (P.joinP && rand() < P.joinP && strokes.length > 2) {
    const i = Math.floor(rand() * strokes.length);
    let j = Math.floor(rand() * strokes.length);
    if (j === i) j = (i + 1) % strokes.length;
    const a = strokes[i].slice(), b = strokes[j].slice();
    if (rand() < 0.5) b.reverse();
    strokes = strokes.filter((_, k) => k !== i && k !== j);
    strokes.push(a.concat(b));
  }
  return strokes;
}

function wobbleAll(strokes, amp, rand) {
  return strokes.map(st => wobbleStroke(st, amp, rand));
}

// many drawings of one character: seed, seed+1, …
export function drawings(ch, n, preset, seed) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(drawing(ch, preset, (seed + i) >>> 0));
  return out;
}

// every character in the set, for coverage checks
export function allChars() { return Object.keys(DATA.chars); }
export function hasChar(ch) { return !!(DATA.chars[ch] && DATA.chars[ch].m && DATA.chars[ch].m.length); }
