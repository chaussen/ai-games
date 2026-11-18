// The judge, part 1: is this stage well-formed? No simulation here, only the data.
// Every problem is { code, where, msg }. `msg` says what is wrong AND what to do,
// because it is fed straight back to the model that wrote the stage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const LV = require('../../levels.js');

export const PALETTES = ['dawn', 'mint', 'dusk', 'citrus', 'night'];
export const LIMITS = { rows: [3, 14], cols: [6, 26], stones: [1, 8], hint: [20, 200], par: [20, 600] };
const KEYS = ['id', 'name', 'cn', 'par', 'pal', 'dawn', 'want', 'hint', 'map', 'spawn', 'beacon', 'boat', 'plates', 'movers', 'crates', 'stones', 'gems', 'trees', 'conjure', 'regrow'];
const REQUIRED = ['id', 'name', 'cn', 'par', 'pal', 'want', 'hint', 'map', 'spawn', 'beacon', 'boat', 'stones'];

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isInt = v => Number.isInteger(v);
const isStr = v => typeof v === 'string';
const nums = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
const HAN = /[㐀-鿿]/g;

// Everything that can be made from these characters by joining them, any number of times.
// Placement is free (any piece can go left, right, on top or below), so the closure only asks
// whether every piece of a recipe is at hand, not in what order.
const pieces = r => r[0] === '⿱⿰' ? [r[1], ...r[2]] : [r[1], r[2]];
export function makeable(chars) {
  const have = new Set(chars);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of LV.RECIPE_LIST) if (!have.has(r[3]) && pieces(r).every(c => have.has(c))) { have.add(r[3]); grew = true; }
  }
  return have;
}

function shape(L, add) {
  if (!L || typeof L !== 'object' || Array.isArray(L)) { add('not-an-object', '', 'A stage is one JSON object.'); return false; }
  for (const k of Object.keys(L)) if (!KEYS.includes(k)) add('unknown-field', k, `Remove "${k}". Allowed fields: ${KEYS.join(', ')}.`);
  for (const k of REQUIRED) if (L[k] === undefined) add('missing-field', k, `Add the required field "${k}".`);
  let ok = REQUIRED.every(k => L[k] !== undefined);
  const bad = (where, msg) => { add('bad-value', where, msg); ok = false; };

  if (L.id !== undefined && !(isStr(L.id) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(L.id) && L.id.length >= 3 && L.id.length <= 32)) bad('id', 'id is 3-32 characters of a-z, 0-9 and single hyphens, e.g. "two-trees".');
  if (L.name !== undefined && !(isStr(L.name) && L.name.length >= 3 && L.name.length <= 24)) bad('name', 'name is an English title of 3-24 characters.');
  if (L.cn !== undefined && !(isStr(L.cn) && L.cn.length >= 1 && L.cn.length <= 6 && L.cn.replace(HAN, '') === '')) bad('cn', 'cn is 1-6 Chinese characters and nothing else.');
  if (L.par !== undefined && !(isNum(L.par) && L.par >= LIMITS.par[0] && L.par <= LIMITS.par[1])) bad('par', `par is the target time in seconds, ${LIMITS.par[0]}-${LIMITS.par[1]}.`);
  if (L.pal !== undefined && !PALETTES.includes(L.pal)) bad('pal', 'pal is one of: ' + PALETTES.join(', ') + '.');
  if (L.dawn !== undefined && !PALETTES.includes(L.dawn)) bad('dawn', 'dawn is one of: ' + PALETTES.join(', ') + ' (or leave it out).');
  if (L.want !== undefined && !(isStr(L.want) && LV.GLYPHS[L.want])) bad('want', `want must be one known character. Known: ${Object.keys(LV.GLYPHS).join(' ')}.`);
  if (L.hint !== undefined && !(isStr(L.hint) && L.hint.length >= LIMITS.hint[0] && L.hint.length <= LIMITS.hint[1])) bad('hint', `hint is ${LIMITS.hint[0]}-${LIMITS.hint[1]} characters of plain English.`);

  if (L.map !== undefined) {
    if (!(Array.isArray(L.map) && L.map.every(isStr))) bad('map', 'map is an array of strings, one string per row.');
    else {
      if (L.map.length < LIMITS.rows[0] || L.map.length > LIMITS.rows[1]) bad('map', `map has ${L.map.length} rows; use ${LIMITS.rows[0]}-${LIMITS.rows[1]}.`);
      const w = Math.max(0, ...L.map.map(r => r.length));
      if (w < LIMITS.cols[0] || w > LIMITS.cols[1]) bad('map', `the longest map row has ${w} cells; use ${LIMITS.cols[0]}-${LIMITS.cols[1]}.`);
      L.map.forEach((r, z) => { const m = r.match(/[^.1-9<>^v]/); if (m) bad(`map[${z}]`, `"${m[0]}" is not a map character. Use . for water, 1-9 for floor height, < > ^ v for ramps.`); });
    }
  }
  for (const k of ['spawn', 'beacon']) if (L[k] !== undefined && !nums(L[k], 2)) bad(k, `${k} is [x, z], two numbers.`);
  if (L.boat !== undefined) {
    const b = L.boat;
    if (!b || typeof b !== 'object' || !(Array.isArray(b.rect) && b.rect.length === 4 && b.rect.every(isInt)) || !nums(b.from, 2) || !nums(b.to, 2)) bad('boat', 'boat is { "rect": [x, z, w, d] (whole numbers), "from": [dx, dz], "to": [dx, dz] }.');
    else {
      if (b.rect[2] < 2 || b.rect[3] < 2 || b.rect[2] > 5 || b.rect[3] > 5) bad('boat.rect', 'the deck is 2-5 cells wide and 2-5 deep.');
      for (const k of Object.keys(b)) if (!['rect', 'from', 'to'].includes(k)) add('unknown-field', 'boat.' + k, `Remove "boat.${k}".`);
    }
  }
  const list = (k, each) => {
    if (L[k] === undefined) return;
    if (!Array.isArray(L[k])) return bad(k, k + ' is an array.');
    L[k].forEach((v, i) => each(v, `${k}[${i}]`));
  };
  list('stones', (v, w) => { if (!(Array.isArray(v) && v.length === 3 && isStr(v[0]) && isNum(v[1]) && isNum(v[2]))) bad(w, 'a stone is ["character", x, z].'); else if (!LV.GLYPHS[v[0]]) bad(w, `"${v[0]}" is not a known character. Known: ${Object.keys(LV.GLYPHS).join(' ')}.`); });
  list('crates', (v, w) => { if (!nums(v, 2)) bad(w, 'a crate is [x, z].'); });
  list('trees', (v, w) => { if (!nums(v, 2)) bad(w, 'a tree is [x, z].'); });
  list('gems', (v, w) => { if (!(nums(v, 2) || nums(v, 3))) bad(w, 'a gem is [x, z] or [x, z, y].'); });
  if (L.conjure !== undefined) {
    if (!Array.isArray(L.conjure) || !L.conjure.every(isStr)) bad('conjure', 'conjure is an array of character strings, e.g. ["木", "火"].');
    else {
      L.conjure.forEach((ch, i) => { if (!LV.GLYPHS[ch]) add('conjure-unknown', `conjure[${i}]`, `"${ch}" is not in content/glyphs.json. Add it there first or remove it from conjure.`); });
      // Stones are used up (they do not grow back unless "regrow": true), so conjuring is the only way to
      // replace a wasted stone. Every character lying on the isle must therefore be conjurable.
      if (L.regrow !== true && Array.isArray(L.stones)) {
        const miss = [...new Set(L.stones.filter(v => Array.isArray(v) && isStr(v[0])).map(v => v[0]).filter(ch => !L.conjure.includes(ch)))];
        if (miss.length) add('conjure-recover', 'conjure', `Stones are used up on this isle, so a crew that wastes one can only get it back by conjuring. Add ${miss.join(' ')} to conjure (or set "regrow": true).`);
      }
    }
  }
  if (L.regrow !== undefined && typeof L.regrow !== 'boolean') bad('regrow', 'regrow is true or false. Leave it out for the default (false: stones are used up).');
  list('plates', (v, w) => {
    if (!(v && typeof v === 'object' && isStr(v.id) && Array.isArray(v.at) && v.at.length === 2 && v.at.every(isInt))) bad(w, 'a plate is { "id": "A", "at": [cellX, cellZ], "c": 0-3 }.');
    else if (v.c !== undefined && ![0, 1, 2, 3].includes(v.c)) bad(w + '.c', 'c is a colour number 0-3.');
  });
  list('movers', (v, w) => {
    if (!(v && typeof v === 'object' && isStr(v.id) && Array.isArray(v.rect) && v.rect.length === 4 && v.rect.every(isInt) && isNum(v.from) && isNum(v.to))) return bad(w, 'a mover is { "id", "rect": [x, z, w, d] (whole numbers), "from", "to", then either "kind": "thorn"|"flame" or "when": ["plateId"] }.');
    for (const k of Object.keys(v)) if (!['id', 'kind', 'rect', 'from', 'to', 'when', 'all', 'c', 'speed'].includes(k)) add('unknown-field', w + '.' + k, `Remove "${k}" from this mover.`);
    if (v.kind !== undefined && !['thorn', 'flame'].includes(v.kind)) bad(w + '.kind', 'kind is "thorn" or "flame" (or leave it out for a lift).');
    if (v.when !== undefined && !(Array.isArray(v.when) && v.when.every(isStr))) bad(w + '.when', 'when is an array of plate ids.');
    if (v.speed !== undefined && !(isNum(v.speed) && v.speed >= 0.5 && v.speed <= 6)) bad(w + '.speed', 'speed is 0.5-6.');
    if (v.c !== undefined && ![0, 1, 2, 3].includes(v.c)) bad(w + '.c', 'c is a colour number 0-3.');
  });
  if (Array.isArray(L.stones) && (L.stones.length < LIMITS.stones[0] || L.stones.length > LIMITS.stones[1])) bad('stones', `use ${LIMITS.stones[0]}-${LIMITS.stones[1]} stones.`);
  return ok;
}

function meaning(L, add) {
  let grid;
  try { grid = LV.parse(L); } catch (e) { add('bad-ramp', 'map', e.message + '. Put a flat numbered cell on the low side of every ramp.'); return; }
  const flat = (x, z) => { const c = grid.at(Math.floor(x), Math.floor(z)); return c && !c.ramp ? c : null; };
  const movers = L.movers || [], plates = L.plates || [];
  const inRect = (r, x, z) => x >= r[0] && x < r[0] + r[2] && z >= r[1] && z < r[1] + r[3];
  const onFloor = (where, x, z, what) => {
    if (flat(x, z)) return true;
    add('off-floor', where, `${what} at [${x}, ${z}] is not on flat floor (map cell [${Math.floor(x)}, ${Math.floor(z)}] is "${(L.map[Math.floor(z)] || '')[Math.floor(x)] || '.'}"). Move it onto a numbered cell.`);
    return false;
  };
  const cellOf = v => Math.floor(v[0]) + ',' + Math.floor(v[1]);

  const spawnOk = onFloor('spawn', L.spawn[0], L.spawn[1], 'spawn');
  onFloor('beacon', L.beacon[0], L.beacon[1], 'the pavilion (beacon)');
  if (spawnOk) {
    // the crew needs room to stand: same flood the sim uses for spawn slots
    const sx = Math.floor(L.spawn[0]), sz = Math.floor(L.spawn[1]), h = grid.at(sx, sz).h;
    const seen = new Set([sx + ',' + sz]), q = [[sx, sz]];
    while (q.length) { const [x, z] = q.shift(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = grid.at(x + dx, z + dz), k = (x + dx) + ',' + (z + dz); if (c && !c.ramp && c.h === h && !seen.has(k)) { seen.add(k); q.push([x + dx, z + dz]); } } }
    if (seen.size < 6) add('small-landing', 'spawn', `only ${seen.size} flat cells of the same height connect to the spawn; a crew needs at least 6. Make the landing bigger.`);
    // the boat floats on water and touches the landing
    const r = L.boat.rect;
    let wet = true, touch = false;
    for (let z = r[1]; z < r[1] + r[3]; z++) for (let x = r[0]; x < r[0] + r[2]; x++) {
      if (grid.at(x, z)) wet = false;
      for (const m of movers) if (inRect(m.rect, x, z)) wet = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!inRect(r, x + dx, z + dz) && seen.has((x + dx) + ',' + (z + dz))) touch = true;
    }
    if (!wet) add('boat-on-land', 'boat.rect', 'every cell under boat.rect must be "." in the map, with no mover there.');
    if (!touch) add('boat-adrift', 'boat.rect', 'boat.rect must share an edge with the landing: the flat floor around the spawn, at the same height as the spawn.');
    if (Math.abs(L.boat.from[0]) + Math.abs(L.boat.from[1]) < 6 || Math.abs(L.boat.to[0]) + Math.abs(L.boat.to[1]) < 6) add('boat-path', 'boat', 'boat.from and boat.to are offsets of at least 6 cells along one axis, e.g. [0, 11] and [0, -15], so the boat is seen sailing in and away.');
  }

  const used = new Map();
  const claim = (where, v, what) => { const k = cellOf(v); if (used.has(k)) add('crowded', where, `${what} shares cell [${k}] with ${used.get(k)}. Give each its own cell.`); else used.set(k, what); };
  claim('beacon', L.beacon, 'the pavilion');
  (L.stones || []).forEach((s, i) => { if (onFloor(`stones[${i}]`, s[1], s[2], 'stone ' + s[0])) claim(`stones[${i}]`, [s[1], s[2]], 'stone ' + s[0]); });
  (L.crates || []).forEach((c, i) => { if (onFloor(`crates[${i}]`, c[0], c[1], 'a crate')) claim(`crates[${i}]`, c, 'a crate'); });
  (L.trees || []).forEach((t, i) => { if (onFloor(`trees[${i}]`, t[0], t[1], 'a tree')) claim(`trees[${i}]`, t, 'a tree'); });
  if (spawnOk && used.has(cellOf(L.spawn))) add('crowded', 'spawn', `the spawn cell also holds ${used.get(cellOf(L.spawn))}. Keep the spawn cell empty.`);
  (L.gems || []).forEach((g, i) => { if (!grid.at(Math.floor(g[0]), Math.floor(g[1])) && g[2] === undefined) add('off-floor', `gems[${i}]`, 'a gem over water needs a height: [x, z, y].'); });

  const ids = new Set();
  plates.forEach((p, i) => {
    if (ids.has(p.id)) add('duplicate-id', `plates[${i}]`, `two plates are called "${p.id}".`);
    ids.add(p.id);
    onFloor(`plates[${i}]`, p.at[0], p.at[1], 'plate ' + p.id);
    if (!movers.some(m => (m.when || []).includes(p.id))) add('idle-plate', `plates[${i}]`, `no mover lists plate "${p.id}" in its "when". Remove the plate or connect it.`);
  });
  const mids = new Set();
  movers.forEach((m, i) => {
    const w = `movers[${i}]`;
    if (mids.has(m.id)) add('duplicate-id', w, `two movers are called "${m.id}".`);
    mids.add(m.id);
    let dry = false;
    for (let z = m.rect[1]; z < m.rect[1] + m.rect[3]; z++) for (let x = m.rect[0]; x < m.rect[0] + m.rect[2]; x++) if (grid.at(x, z)) dry = true;
    if (dry) add('mover-on-floor', w, `the map must be "." under mover "${m.id}" (rect ${JSON.stringify(m.rect)}).`);
    if (m.rect[2] < 1 || m.rect[3] < 1 || m.rect[0] < 0 || m.rect[1] < 0 || m.rect[0] + m.rect[2] > grid.w || m.rect[1] + m.rect[3] > grid.d) add('mover-outside', w, `mover "${m.id}" must lie inside the map.`);
    if (m.kind) {
      if (m.when && m.when.length) add('wall-with-plate', w, 'a thorn or flame wall has no "when": only a fire or water stone opens it.');
      if (!(m.from - m.to >= 2.4)) add('low-wall', w, 'a wall stands at least 2.4 above the floor it sinks to, e.g. "from": 3.6, "to": 1.');
      const need = m.kind === 'thorn' ? 'fire' : 'water';
      if (!(L.stones || []).some(s => LV.GLYPHS[s[0]] && LV.GLYPHS[s[0]].el === need)) add('wall-without-key', w, `this ${m.kind} wall needs a ${need} stone (${Object.keys(LV.GLYPHS).filter(g => LV.GLYPHS[g].el === need).join(' ')}) somewhere in "stones".`);
    } else {
      if (!m.when || !m.when.length) add('lift-without-plate', w, `lift "${m.id}" needs "when": ["plateId"].`);
      for (const p of m.when || []) if (!ids.has(p)) add('unknown-plate', w, `lift "${m.id}" waits for plate "${p}", which does not exist.`);
    }
  });

  const can = makeable((L.stones || []).map(s => s[0]));
  if (!can.has(L.want)) {
    const recipe = LV.RECIPE_LIST.find(r => r[3] === L.want);
    add('want-unmakeable', 'want', `the pavilion wants ${L.want} but the stones here can never make it. ` + (recipe ? `${L.want} = ${pieces(recipe).join(' + ')} (${recipe[0]}): put those stones in "stones".` : `Put a ${L.want} stone in "stones".`));
  }
  // English first: the hint may only show characters the players can meet on this isle
  const strangers = [...new Set((L.hint.match(HAN) || []).filter(c => !can.has(c)))];
  if (strangers.length) add('hint-stranger', 'hint', `the hint shows ${strangers.join(' ')}, which cannot appear on this isle. Use only characters from "stones" or made from them, and say the rest in English.`);
}

// Extra rules live in tools/judge/rules/*.mjs, one file each: export default { id, check(stage, add) }.
async function extraRules() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rules');
  const out = [];
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort() : []) out.push((await import(pathToFileURL(path.join(dir, f)).href)).default);
  return out;
}

export async function lint(L) {
  const problems = [];
  const add = (code, where, msg) => problems.push({ code, where, msg });
  if (shape(L, add) && !problems.length) {
    meaning(L, add);
    for (const rule of await extraRules()) rule.check(L, (where, msg) => add(rule.id, where, msg));
  }
  return problems;
}
