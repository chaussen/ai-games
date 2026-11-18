// tools/strokes.mjs: vendor Make Me a Hanzi stroke data for a list of characters (ROADMAP card B3).
//
// BUILD TIME ONLY. Reads the repo's copy of Make Me a Hanzi in ../../build-pipeline/data/ and writes
// a small subset into this game's vendor/ folder. Nothing at runtime may read outside the game folder.
//
// Usage (from games/tongzhou-forge/):
//   node tools/strokes.mjs 木 火 水           exactly these characters
//   node tools/strokes.mjs --glyphs          every character in content/glyphs.json
//   node tools/strokes.mjs --glyphs 吗 不    both
//   node tools/strokes.mjs --file list.txt   characters from a file (any whitespace / JSON array)
//   … --out lab/bench-strokes.json           write elsewhere (lab benches; no licence copies, not shipped)
//
// Writes:
//   vendor/strokes.json    { _notice, _format, chars: { ch: { m, s, rad, py, en } } }
//   vendor/MMAH-LICENSE.txt, vendor/ARPHICPL.TXT, vendor/MMAH-LGPL.txt  (copied from tools/mmah-licence/)
//
// Licences (see tools/mmah-licence/COPYING):
//   m, s  come from graphics.txt   -> Arphic Public License. ARPHICPL.TXT must ship unaltered, and the
//                                     modified file must say how and when it was changed (_notice).
//   rad, py, en come from dictionary.txt -> LGPL 3 or later.
// Exit code 1 if any requested character is missing from either source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.resolve(root, '../../build-pipeline/data');
const vendor = path.join(root, 'vendor');
const licenceDir = path.join(root, 'tools', 'mmah-licence');

// ---------- the character list ----------
const args = process.argv.slice(2);
const want = [];
let outFile = null;
const add = s => { for (const ch of Array.from(String(s))) if (/\p{Script=Han}/u.test(ch) && !want.includes(ch)) want.push(ch); };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--glyphs') {
    const g = JSON.parse(fs.readFileSync(path.join(root, 'content', 'glyphs.json'), 'utf8'));
    for (const ch of Object.keys(g.glyphs || {})) add(ch);
  } else if (a === '--out') {
    outFile = path.resolve(args[++i]);
  } else if (a === '--file') {
    add(fs.readFileSync(path.resolve(args[++i]), 'utf8'));
  } else {
    add(a);
  }
}
if (want.length === 0) {
  console.error('usage: node tools/strokes.mjs <characters…> | --glyphs | --file <list>');
  process.exit(2);
}

// ---------- read only the lines we need ----------
function pick(file) {
  const need = new Set(want);
  const out = {};
  const text = fs.readFileSync(path.join(dataDir, file), 'utf8');
  let start = 0;
  while (start < text.length && need.size) {
    let end = text.indexOf('\n', start);
    if (end < 0) end = text.length;
    // Every line starts {"character":"X", so test the character before parsing 30 MB of JSON.
    const m = /^\{"character":"(.+?)"/u.exec(text.slice(start, Math.min(end, start + 24)));
    if (m && need.has(m[1])) {
      out[m[1]] = JSON.parse(text.slice(start, end));
      need.delete(m[1]);
    }
    start = end + 1;
  }
  return out;
}

const gfx = pick('graphics.txt');
const dict = pick('dictionary.txt');

// ---------- build entries ----------
const chars = {};
const missing = [];
for (const ch of want) {
  const g = gfx[ch], d = dict[ch];
  if (!g || !d) { missing.push(ch + (g ? ' (no dictionary entry)' : ' (no stroke data)')); continue; }
  chars[ch] = {
    m: g.medians,                       // per stroke: [[x, y], …] in MMAH 1024 space, Y up
    s: g.strokes,                       // per stroke: SVG outline path, same space
    rad: d.radical || '',
    py: Array.isArray(d.pinyin) ? (d.pinyin[0] || '') : '',
    en: d.definition || ''
  };
}

const today = new Date().toISOString().slice(0, 10);
const doc = {
  _notice: `Modified ${today} by tools/strokes.mjs: a subset of Make Me a Hanzi (https://github.com/skishore/makemeahanzi). ` +
    'm and s are copied unchanged from graphics.txt (Arphic Public License, see ARPHICPL.TXT); ' +
    'rad, py, en are the radical, first pinyin and definition from dictionary.txt (LGPL 3, see MMAH-LGPL.txt). ' +
    'Changes: characters selected, fields renamed, other fields dropped. See MMAH-LICENSE.txt.',
  _format: 'MMAH coordinates: a 1024 box with Y up. To get 0..1 with Y down: x / 1024, (900 - y) / 1024. ' +
    's paths render with transform="scale(1,-1) translate(0,-900)" in a 0 0 1024 1024 viewBox.',
  chars
};

const target = outFile || path.join(vendor, 'strokes.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(doc) + '\n');
if (!outFile) {
  for (const [from, to] of [['COPYING', 'MMAH-LICENSE.txt'], ['ARPHICPL.TXT', 'ARPHICPL.TXT'], ['LGPL', 'MMAH-LGPL.txt']]) {
    fs.copyFileSync(path.join(licenceDir, from), path.join(vendor, to));
  }
}

const n = Object.keys(chars).length;
const kb = (fs.statSync(target).size / 1024).toFixed(1);
console.log(`${path.relative(root, target)}: ${n} character(s), ${kb} KB`);
if (missing.length) {
  console.error('MISSING: ' + missing.join(', '));
  process.exit(1);
}
