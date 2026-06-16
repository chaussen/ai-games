#!/usr/bin/env node
/**
 * build-characters.js — The Forge character-graph build pipeline (v2)
 *
 * v2 uses REAL decomposition + stroke data from makemeahanzi, instead of the
 * old string-split heuristics (which could not decompose single-codepoint
 * hanzi at all — every 形声 character collapsed to its radical only).
 *
 * Reads:
 *   assets/character-library.json          (design-time HSK ledger: B1-B4)
 *   build-pipeline/data/dictionary.txt     (makemeahanzi: decomposition IDS + etymology)
 *   build-pipeline/data/graphics.txt       (makemeahanzi: stroke paths + medians)
 *   assets/data/content-b{1..4}.json       (lesson content)
 *
 * Produces:
 *   assets/data/characters.json   (character graph per SRS §6.1)
 *   assets/data/components.json   (component inventory per SRS §6.2)
 *   assets/data/stroke-data.json  (stroke paths for every node in the graph)
 *   assets/data/playlists/{b1,all}-lessons.json
 *
 * To refresh the makemeahanzi inputs:
 *   curl -sS https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt \
 *     -o build-pipeline/data/dictionary.txt
 *   curl -sS https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt \
 *     -o build-pipeline/data/graphics.txt
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'data');
const PLAYLIST_DIR = path.join(OUT_DIR, 'playlists');
const MMAH_DIR = path.join(__dirname, 'data');

// ──────────────────────────────────────────────
// 1. Load inputs
// ──────────────────────────────────────────────
console.log('Loading character-library.json …');
const charLib = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets', 'character-library.json'), 'utf-8')
);

function loadJSONL(file) {
  const map = {};
  const text = fs.readFileSync(file, 'utf-8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t);
      if (o.character) map[o.character] = o;
    } catch (e) { /* skip malformed line */ }
  }
  return map;
}

console.log('Loading makemeahanzi dictionary.txt …');
const mmDict = loadJSONL(path.join(MMAH_DIR, 'dictionary.txt'));
console.log(`  → ${Object.keys(mmDict).length} dictionary entries`);

console.log('Loading makemeahanzi graphics.txt …');
const mmGraphics = loadJSONL(path.join(MMAH_DIR, 'graphics.txt'));
console.log(`  → ${Object.keys(mmGraphics).length} graphics entries`);

function loadContent(band) {
  const fp = path.join(ROOT, 'assets', 'data', `content-${band.toLowerCase()}.json`);
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : null;
}
const contentByBand = { B1: loadContent('b1'), B2: loadContent('b2'), B3: loadContent('b3'), B4: loadContent('b4') };

// ──────────────────────────────────────────────
// 2. Flatten the HSK ledger into a curriculum map
// ──────────────────────────────────────────────
const BANDS = ['B1', 'B2', 'B3', 'B4'];
const BAND_ORDER = { B1: 1, B2: 2, B3: 3, B4: 4 };

const curriculum = {};  // ch → { ch, py, en, strokes, radical, status, bands[] }

function mergeField(obj, key, val) {
  if (val !== undefined && val !== null && val !== '' &&
      (obj[key] === undefined || obj[key] === null || obj[key] === '')) {
    obj[key] = val;
  }
}

for (const band of BANDS) {
  const bandData = charLib.bands[band];
  if (!bandData) continue;

  if (Array.isArray(bandData.write)) {
    for (const e of bandData.write) {
      const ch = e.ch;
      if (!ch) continue;
      if (!curriculum[ch]) {
        curriculum[ch] = { ch, py: e.py || '', en: e.en || '', strokes: e.strokes || 0, radical: e.radical || '', status: 'W', bands: [band] };
      } else {
        const c = curriculum[ch];
        mergeField(c, 'py', e.py); mergeField(c, 'en', e.en); mergeField(c, 'strokes', e.strokes); mergeField(c, 'radical', e.radical);
        if (!c.bands.includes(band)) c.bands.push(band);
        c.status = 'W';
      }
    }
  }

  if (bandData.characters && typeof bandData.characters === 'object') {
    for (const [ch, info] of Object.entries(bandData.characters)) {
      if (!ch) continue;
      if (!curriculum[ch]) {
        curriculum[ch] = { ch, py: info.pinyin || '', en: info.meaning || '', strokes: info.strokes || 0, radical: info.radical || '', status: info.status || 'R', bands: [band] };
      } else {
        const c = curriculum[ch];
        mergeField(c, 'py', info.pinyin); mergeField(c, 'en', info.meaning); mergeField(c, 'strokes', info.strokes); mergeField(c, 'radical', info.radical);
        if (!c.bands.includes(band)) c.bands.push(band);
        if (info.status === 'W') c.status = 'W';
        else if (info.status === 'R' && c.status === 'S') c.status = 'R';
      }
    }
  }
}
console.log(`Extracted ${Object.keys(curriculum).length} curriculum characters from the HSK ledger`);

// ──────────────────────────────────────────────
// 3. IDS decomposition (real)
// ──────────────────────────────────────────────
const IDS_BINARY = new Set(['⿰', '⿱', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻', '⿼', '⿽', '⿾', '⿿']);
const IDS_TERNARY = new Set(['⿲', '⿳']);

function parseIDS(chars, i) {
  const c = chars[i];
  if (c === undefined) return [{ leaf: '？' }, i];
  if (IDS_TERNARY.has(c)) {
    let a, b, d; [a, i] = parseIDS(chars, i + 1); [b, i] = parseIDS(chars, i); [d, i] = parseIDS(chars, i);
    return [{ op: c, children: [a, b, d] }, i];
  }
  if (IDS_BINARY.has(c)) {
    let a, b; [a, i] = parseIDS(chars, i + 1); [b, i] = parseIDS(chars, i);
    return [{ op: c, children: [a, b] }, i];
  }
  return [{ leaf: c }, i + 1];
}

function nodeToIDS(node) {
  return node.leaf ? node.leaf : node.op + node.children.map(nodeToIDS).join('');
}

// Reverse map: decomposition string → character, so composite operands can be
// resolved to their named character (e.g. an operand "⿰木目" → 相).
const idsToChar = {};
for (const [ch, d] of Object.entries(mmDict)) {
  const dec = d.decomposition;
  if (dec && dec !== ch && !idsToChar[dec]) idsToChar[dec] = ch;
}

/** Return the direct (top-level) component characters of ch, or [] if atomic. */
function directComponents(ch) {
  const d = mmDict[ch];
  if (!d || !d.decomposition) return [];
  let dec = d.decomposition;
  // makemeahanzi marks unknown leaves with '？'; bail if present at top.
  if (dec === ch) return [];
  const chars = Array.from(dec);
  if (chars.length <= 1) return [];
  const [root] = parseIDS(chars, 0);
  if (!root.op) return [];

  const out = [];
  for (const child of root.children) {
    if (child.leaf) {
      if (child.leaf === '？' || child.leaf === ch) return []; // unresolved/self → atomic
      out.push(child.leaf);
    } else {
      const sub = nodeToIDS(child);
      const named = idsToChar[sub];
      if (named && named !== ch) out.push(named);
      else return []; // composite operand we cannot name → treat whole char as atom
    }
  }
  // de-dupe while preserving order
  return out.filter((c, i) => out.indexOf(c) === i);
}

// ──────────────────────────────────────────────
// 4. Role + grain classification
// ──────────────────────────────────────────────
// Product-owner overrides: characters makemeahanzi tags "ideographic" but that
// the curriculum treats as 形声 (sound + meaning). Maps char → phonetic component.
const PHONETIC_OVERRIDE = {
  '你': '尔',   // 亻 (person) + 尔 (sound)
  '字': '子',   // 宀 (roof) + 子 (sound) — etymology hint notes 子 gives the sound
};

const BOUND_GLOSS = {
  '亻': 'person (radical)', '氵': 'water (radical)', '艹': 'grass (radical)', '扌': 'hand (radical)',
  '讠': 'speech (radical)', '纟': 'silk (radical)', '饣': 'food (radical)', '钅': 'metal (radical)',
  '礻': 'spirit (radical)', '衤': 'clothing (radical)', '忄': 'heart (radical)', '犭': 'dog (radical)',
  '辶': 'walk (radical)', '宀': 'roof (radical)', '灬': 'fire (radical)', '彳': 'step (radical)',
  '攵': 'tap (radical)', '冫': 'ice (radical)', '阝': 'mound/city (radical)', '⻊': 'foot (radical)',
};

/**
 * Decide components + roles + grain for a character.
 * Returns { components:[{char,role}], grain, etymologyType }
 */
function classify(ch) {
  const d = mmDict[ch] || {};
  const etym = d.etymology || {};
  const comps = directComponents(ch);

  if (comps.length < 2) {
    return { components: [], grain: 'stroke', etymologyType: etym.type || 'pictographic' };
  }

  // Determine the phonetic component, if any.
  let phonetic = null;
  if (etym.type === 'pictophonetic' && etym.phonetic) phonetic = etym.phonetic;
  if (PHONETIC_OVERRIDE[ch]) phonetic = PHONETIC_OVERRIDE[ch];
  if (phonetic && comps.indexOf(phonetic) < 0) phonetic = null; // must be a real direct component

  const components = comps.map(c => ({
    char: c,
    role: (phonetic && c === phonetic) ? 'phonetic' : 'semantic',
  }));

  const hasPhonetic = components.some(c => c.role === 'phonetic');
  const hasSemantic = components.some(c => c.role === 'semantic');
  let grain;
  if (hasPhonetic && hasSemantic) grain = 'radical';     // 形声
  else grain = 'component';                              // 会意 (all semantic)

  const etymologyType = etym.type || (hasPhonetic ? 'pictophonetic' : 'ideographic');
  return { components, grain, etymologyType };
}

// ──────────────────────────────────────────────
// 5. Assemble the node graph (curriculum + every referenced component)
// ──────────────────────────────────────────────
const nodes = {};   // ch → classify() result + metadata
const queue = Object.keys(curriculum);
const queued = new Set(queue);

function glossFor(ch) {
  const d = mmDict[ch] || {};
  const cur = curriculum[ch];
  let en = (cur && cur.en) || BOUND_GLOSS[ch] || (d.definition ? d.definition.split(/[,;]/)[0].trim() : '');
  let py = (cur && cur.py) || (Array.isArray(d.pinyin) ? d.pinyin[0] : '') || '';
  return { en, py };
}

while (queue.length) {
  const ch = queue.shift();
  if (nodes[ch]) continue;
  const cls = classify(ch);
  nodes[ch] = cls;
  for (const c of cls.components) {
    if (!queued.has(c.char)) { queued.add(c.char); queue.push(c.char); }
  }
}
console.log(`Graph assembled: ${Object.keys(nodes).length} nodes (curriculum + components)`);

// ──────────────────────────────────────────────
// 6. Depth (from the real component tree)
// ──────────────────────────────────────────────
const depth = {};
function computeDepth(ch, stack) {
  if (depth[ch] !== undefined) return depth[ch];
  if (stack.has(ch)) return 0; // cycle guard
  const comps = (nodes[ch] && nodes[ch].components) || [];
  if (comps.length === 0) { depth[ch] = 0; return 0; }
  stack.add(ch);
  let max = 0;
  for (const c of comps) max = Math.max(max, computeDepth(c.char, stack));
  stack.delete(ch);
  depth[ch] = max + 1;
  return depth[ch];
}
for (const ch of Object.keys(nodes)) computeDepth(ch, new Set());

// ──────────────────────────────────────────────
// 7. Frequency-rank approximation (band-based, as before)
// ──────────────────────────────────────────────
function frequencyRank(ch) {
  const cur = curriculum[ch];
  let score = 10000;
  const bandScores = { B1: 100, B2: 300, B3: 600, B4: 1000 };
  if (cur && cur.bands) for (const b of cur.bands) score = Math.min(score, bandScores[b] || 1000);
  if (cur && cur.status === 'W') score -= 50;
  else if (cur && cur.status === 'R') score += 200;
  else if (cur && cur.status === 'S') score += 500;
  return score;
}

// ──────────────────────────────────────────────
// 8. Hints (visual / semantic confusables)
// ──────────────────────────────────────────────
// Visual: characters sharing a top-level component. Semantic: shared first gloss word.
const byComponent = {};
const byMeaning = {};
for (const [ch, cls] of Object.entries(nodes)) {
  for (const c of cls.components) {
    (byComponent[c.char] = byComponent[c.char] || []).push(ch);
  }
  const g = glossFor(ch).en;
  const cat = (g || '').split(/[,;·\s]+/)[0].toLowerCase();
  if (cat && cat.length > 1) (byMeaning[cat] = byMeaning[cat] || []).push(ch);
}
function hintsFor(ch) {
  const cls = nodes[ch];
  const vis = new Set();
  for (const c of cls.components) {
    for (const sib of (byComponent[c.char] || [])) if (sib !== ch) vis.add(sib);
  }
  const cat = (glossFor(ch).en || '').split(/[,;·\s]+/)[0].toLowerCase();
  const sem = (byMeaning[cat] || []).filter(c => c !== ch);
  return {
    visuallySimilar: Array.from(vis).slice(0, 6),
    semanticallyAdjacent: Array.from(new Set(sem)).slice(0, 5),
  };
}

// ──────────────────────────────────────────────
// 9. Emit characters.json + components.json + stroke-data.json
// ──────────────────────────────────────────────
console.log('Building output …');

const charactersOut = {};
const componentsOut = {};
const strokeOut = {};

function addStroke(ch) {
  if (strokeOut[ch]) return true;
  const g = mmGraphics[ch];
  if (!g || !g.strokes) return false;
  strokeOut[ch] = { s: g.strokes };
  if (g.medians) strokeOut[ch].m = g.medians;
  return true;
}

for (const [ch, cls] of Object.entries(nodes)) {
  const cur = curriculum[ch];
  const { en, py } = glossFor(ch);
  const hasStroke = addStroke(ch);
  const g = mmGraphics[ch];
  const strokeCount = (cur && cur.strokes) || (g && g.strokes ? g.strokes.length : 0);
  const isAtom = cls.components.length === 0;

  charactersOut[ch] = {
    char: ch,
    pinyin: py,
    meaning: en,
    strokeCount,
    grain: cls.grain,
    etymologyType: cls.etymologyType,
    components: cls.components.map(c => {
      const cg = glossFor(c.char);
      return { char: c.char, role: c.role, pinyin: cg.py };
    }),
    depth: depth[ch] || 0,
    frequencyRank: frequencyRank(ch),
    hsk: cur && cur.bands ? Math.min(...cur.bands.map(b => BAND_ORDER[b])) : 0,
    treatAsAtom: isAtom,
    bands: (cur && cur.bands) || [],
    status: (cur && cur.status) || 'C',  // C = component-only (not in HSK ledger)
    hasStrokeData: hasStroke,
    hints: hintsFor(ch),
  };

  // Component inventory entry for anything used as a part.
  for (const c of cls.components) {
    if (!componentsOut[c.char]) {
      const cg = glossFor(c.char);
      const bound = BOUND_GLOSS[c.char] !== undefined;
      componentsOut[c.char] = {
        char: c.char,
        standalone: !bound,
        pinyin: cg.py || undefined,
        meaning: cg.en || undefined,
      };
    }
  }
}

// ──────────────────────────────────────────────
// 10. Playlists (unchanged: from lesson content)
// ──────────────────────────────────────────────
function extractLessons(contentData, bandName) {
  if (!contentData || !contentData.units) return [];
  const lessons = [];
  for (const unit of contentData.units) {
    if (!unit.core) continue;
    const writeChars = (unit.core.writeChars || []).map(e => (typeof e === 'string' ? e : e.char)).filter(Boolean);
    const recogniseChars = (unit.core.recognise || []).map(e => (typeof e === 'string' ? e : e.char)).filter(Boolean);
    if (!writeChars.length && !recogniseChars.length) continue;
    lessons.push({
      id: `${bandName.toLowerCase()}-u${unit.n}`,
      band: bandName, unit: unit.n,
      theme: unit.theme || { zh: '', en: '' },
      writeChars, recogniseChars,
      allChars: [...new Set([...writeChars, ...recogniseChars])],
    });
  }
  return lessons;
}
const lessonsByBand = BANDS.map(b => extractLessons(contentByBand[b], b));
const allLessons = [].concat(...lessonsByBand);

// ──────────────────────────────────────────────
// 11. Write
// ──────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PLAYLIST_DIR, { recursive: true });

const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 1), 'utf-8');
write(path.join(OUT_DIR, 'characters.json'), charactersOut);
write(path.join(OUT_DIR, 'components.json'), componentsOut);
write(path.join(OUT_DIR, 'stroke-data.json'), strokeOut);
write(path.join(PLAYLIST_DIR, 'b1-lessons.json'), lessonsByBand[0]);
write(path.join(PLAYLIST_DIR, 'all-lessons.json'), allLessons);

// ──────────────────────────────────────────────
// 12. Summary
// ──────────────────────────────────────────────
const grainCounts = {};
let withStroke = 0;
for (const c of Object.values(charactersOut)) {
  grainCounts[c.grain] = (grainCounts[c.grain] || 0) + 1;
  if (c.hasStrokeData) withStroke++;
}
console.log('\n=== Build Summary ===');
console.log(`Characters:        ${Object.keys(charactersOut).length}`);
console.log(`  stroke / 象形:   ${grainCounts.stroke || 0}`);
console.log(`  component / 会意: ${grainCounts.component || 0}`);
console.log(`  radical / 形声:  ${grainCounts.radical || 0}`);
console.log(`  with stroke data: ${withStroke}`);
console.log(`Components:         ${Object.keys(componentsOut).length}`);
console.log(`Stroke entries:    ${Object.keys(strokeOut).length}`);
console.log(`Lessons:           ${allLessons.length}`);

console.log('\n=== Sample ===');
for (const s of ['你', '妈', '好', '明', '请', '字']) {
  const c = charactersOut[s];
  if (c) console.log(`${s}: grain=${c.grain} type=${c.etymologyType} depth=${c.depth} comps=${JSON.stringify(c.components.map(x => x.char + ':' + x.role)).replace(/"/g, '')}`);
}
