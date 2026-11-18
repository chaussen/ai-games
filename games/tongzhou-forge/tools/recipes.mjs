// Checks every recipe in content/glyphs.json against the Make Me a Hanzi dictionary
// (build-pipeline/data/dictionary.txt, read only). SPEC §2.
//
//   node tools/recipes.mjs                 check; exits 1 on a mismatch, printing the dictionary IDS
//   node tools/recipes.mjs --pairs 日月木口  every two-piece character MMAH builds from these pieces,
//                                          grouped by piece set; minimal pairs are marked
//
// tools/pack.mjs imports checkRecipes() and refuses to write content.js while it reports a problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const DICT = path.join(root, '..', '..', 'build-pipeline', 'data', 'dictionary.txt');

// Variant forms MMAH writes as their own components. Recipes always use the base piece.
const VARIANTS = { '忄': '心', '氵': '水', '亻': '人' };
// Components MMAH tells apart but the game treats as the same piece. Each needs a reason.
const ALIASES = {
  '曰': '日', // 昌 is ⿱日曰 in MMAH; the lower 日 is drawn wider and flatter but is the same piece in play
};
const norm = s => [...s].map(c => VARIANTS[c] || ALIASES[c] || c).join('');
const TWO = ['⿰', '⿱', '⿴', '⿵'];

let dictCache = null;
export function dictionary() {
  if (dictCache) return dictCache;
  if (!fs.existsSync(DICT)) throw new Error('recipes: MMAH dictionary not found at ' + DICT);
  dictCache = new Map();
  for (const line of fs.readFileSync(DICT, 'utf8').split('\n')) {
    if (!line) continue;
    const e = JSON.parse(line);
    dictCache.set(e.character, e.decomposition || '');
  }
  return dictCache;
}

// The IDS strings a recipe may match. A piece that is itself a recipe result may also appear
// expanded (森 = ⿱木林 matches ⿱木⿰木木). A pyramid [⿱⿰, top, "XY", r] is ⿱top⿰XY.
function accepted(r, recipes) {
  const [op, a, b] = r;
  if (op === '⿱⿰') return [norm('⿱' + a + '⿰' + b)];
  const spell = ch => [ch, ...recipes.filter(q => q[3] === ch && q[0] !== '⿱⿰').map(q => q[0] + q[1] + q[2])];
  const out = [];
  for (const x of spell(a)) for (const y of spell(b)) out.push(norm(op + x + y));
  return out;
}

// Returns a list of problems (empty when every recipe matches the dictionary).
export function checkRecipes(recipes) {
  const dict = dictionary(), bad = [];
  for (const r of recipes) {
    const ids = dict.get(r[3]);
    if (ids === undefined) { bad.push(JSON.stringify(r) + ': ' + r[3] + ' is not in the MMAH dictionary'); continue; }
    const want = accepted(r, recipes);
    if (!want.includes(norm(ids))) bad.push(JSON.stringify(r) + ': MMAH has ' + r[3] + ' = ' + ids + ', the recipe says ' + want[0]);
  }
  return bad;
}

// Every character MMAH decomposes as op + x + y with x and y among `pieces` (after normalising).
export function pairs(pieces) {
  const set = new Set([...pieces].map(norm)), groups = new Map();
  for (const [ch, ids] of dictionary()) {
    const n = [...norm(ids)];
    if (n.length !== 3 || !TWO.includes(n[0]) || !set.has(n[1]) || !set.has(n[2])) continue;
    const key = [n[1], n[2]].sort().join('');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ op: n[0], a: n[1], b: n[2], ch, ids });
  }
  return [...groups.entries()].sort((p, q) => q[1].length - p[1].length || (p[0] < q[0] ? -1 : 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--pairs');
  if (i >= 0) {
    const pieces = process.argv[i + 1];
    if (!pieces) { console.error('usage: node tools/recipes.mjs --pairs <pieces>'); process.exit(2); }
    const groups = pairs(pieces);
    let minimal = 0;
    for (const [key, list] of groups) {
      const mark = list.length > 1 ? '  ← minimal pair' : '';
      if (list.length > 1) minimal++;
      console.log([...key].join(' + ') + mark);
      for (const e of list) console.log('   ' + e.a + ' ' + e.op + ' ' + e.b + ' = ' + e.ch + (norm(e.ids) !== e.ids ? '   (MMAH ' + e.ids + ')' : ''));
    }
    console.log(groups.length + ' piece sets, ' + minimal + ' with a minimal pair');
    process.exit(0);
  }
  const recipes = JSON.parse(fs.readFileSync(path.join(root, 'content', 'glyphs.json'), 'utf8')).recipes;
  const bad = checkRecipes(recipes);
  for (const b of bad) console.error('MISMATCH ' + b);
  if (bad.length) { console.error(bad.length + ' of ' + recipes.length + ' recipes do not match the dictionary'); process.exit(1); }
  console.log('all ' + recipes.length + ' recipes match the MMAH dictionary');
}
