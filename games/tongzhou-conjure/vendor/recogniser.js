// WRecog: offline Chinese handwriting recogniser for a closed set
// Conforms to SPEC.md section 7:
// WRecog.load(allowedChars) -> Promise<void>
// WRecog.match(strokes)     -> [{ch, score}, ...]  best first, at most 5, score 0..1
//
// Templates (ROADMAP card B4): stroke medians from vendor/strokes.json (Make Me a Hanzi, built by
// tools/strokes.mjs; licences in vendor/MMAH-LICENSE.txt). The 12 hand-made TEMPLATES below are
// only a fallback for a character missing from that file.
//
// Order-tolerant matching (OPEN-SET.md §2): every drawn stroke is paired with its best template
// stroke by optimal assignment (Hungarian), so stroke order does not matter; a stroke drawn
// backwards costs a little; missing / extra strokes cost more; keeping the textbook order is only a
// small bonus.
(function (root) {
  'use strict';

  // Canonical stroke templates for the spike set in normalized [0..1] coordinates:
  // Each character is an array of strokes, each stroke is an array of [x, y] points.
  const TEMPLATES = {
    '木': [
      [[0.15, 0.40], [0.85, 0.40]],                     // 横
      [[0.50, 0.10], [0.50, 0.90]],                     // 竖
      [[0.50, 0.45], [0.18, 0.82]],                     // 撇
      [[0.50, 0.45], [0.82, 0.82]]                      // 捺
    ],
    '林': [
      [[0.10, 0.42], [0.45, 0.40]],
      [[0.30, 0.15], [0.30, 0.85]],
      [[0.30, 0.45], [0.12, 0.78]],
      [[0.30, 0.55], [0.42, 0.75]],
      [[0.55, 0.38], [0.92, 0.38]],
      [[0.72, 0.10], [0.72, 0.90]],
      [[0.72, 0.42], [0.52, 0.80]],
      [[0.72, 0.42], [0.90, 0.82]]
    ],
    '火': [
      [[0.22, 0.35], [0.32, 0.55]],                     // 点
      [[0.78, 0.35], [0.68, 0.55]],                     // 撇 (left-falling)
      [[0.50, 0.15], [0.45, 0.55], [0.22, 0.88]],       // 竖撇
      [[0.50, 0.48], [0.82, 0.88]]                      // 捺
    ],
    '水': [
      [[0.50, 0.10], [0.50, 0.85], [0.42, 0.80]],       // 竖钩
      [[0.18, 0.35], [0.35, 0.45], [0.20, 0.70]],       // 横撇
      [[0.82, 0.28], [0.65, 0.48]],                     // 撇
      [[0.52, 0.48], [0.85, 0.82]]                      // 捺
    ],
    '日': [
      [[0.22, 0.15], [0.22, 0.85]],                     // 竖
      [[0.22, 0.18], [0.78, 0.18], [0.78, 0.85]],       // 横折
      [[0.24, 0.50], [0.76, 0.50]],                     // 横
      [[0.22, 0.85], [0.78, 0.85]]                      // 横
    ],
    '月': [
      [[0.25, 0.15], [0.22, 0.90]],                     // 撇
      [[0.25, 0.18], [0.75, 0.18], [0.75, 0.88], [0.65, 0.82]], // 横折钩
      [[0.25, 0.42], [0.75, 0.42]],                     // 横
      [[0.25, 0.65], [0.75, 0.65]]                      // 横
    ],
    '明': [
      [[0.12, 0.25], [0.12, 0.75]],
      [[0.12, 0.28], [0.42, 0.28], [0.42, 0.75]],
      [[0.14, 0.50], [0.40, 0.50]],
      [[0.12, 0.75], [0.42, 0.75]],
      [[0.58, 0.15], [0.55, 0.90]],
      [[0.58, 0.18], [0.88, 0.18], [0.88, 0.88], [0.80, 0.82]],
      [[0.58, 0.42], [0.88, 0.42]],
      [[0.58, 0.65], [0.88, 0.65]]
    ],
    '人': [
      [[0.50, 0.15], [0.20, 0.85]],                     // 撇
      [[0.42, 0.42], [0.80, 0.85]]                      // 捺
    ],
    '休': [
      [[0.25, 0.18], [0.12, 0.55]],
      [[0.20, 0.42], [0.20, 0.88]],
      [[0.42, 0.42], [0.90, 0.42]],
      [[0.65, 0.12], [0.65, 0.90]],
      [[0.65, 0.45], [0.42, 0.80]],
      [[0.65, 0.45], [0.88, 0.82]]
    ],
    '女': [
      [[0.50, 0.15], [0.30, 0.55], [0.75, 0.58]],       // 撇点
      [[0.65, 0.32], [0.22, 0.88]],                     // 撇
      [[0.12, 0.50], [0.88, 0.50]]                      // 横
    ],
    '子': [
      [[0.30, 0.20], [0.68, 0.20], [0.45, 0.45]],       // 横撇
      [[0.48, 0.45], [0.50, 0.85], [0.38, 0.80]],       // 弯钩
      [[0.15, 0.50], [0.85, 0.50]]                      // 横
    ],
    '好': [
      [[0.32, 0.20], [0.20, 0.55], [0.45, 0.58]],
      [[0.40, 0.35], [0.15, 0.85]],
      [[0.10, 0.50], [0.48, 0.50]],
      [[0.60, 0.25], [0.85, 0.25], [0.70, 0.45]],
      [[0.72, 0.45], [0.75, 0.82], [0.65, 0.78]],
      [[0.52, 0.50], [0.92, 0.50]]
    ]
  };

  // Matching constants (tune against real samples, lab/NOTES.md)
  const N_PTS = 12;          // points per resampled stroke
  const REVERSE_COST = 0.04; // a stroke drawn in the wrong direction
  const MISS_BASE = 0.10;    // an unmatched stroke (missing or extra) …
  const MISS_LEN = 0.10;     // … plus this times its length (a missed dot costs less than a missed 横)
  const ORDER_WEIGHT = 0.03; // the whole order bonus: textbook order saves at most this much
  const SCORE_SLOPE = 2.2;   // score = 1 - SCORE_SLOPE * cost

  let strokeData = null;     // { ch: { m: medians, … } } from vendor/strokes.json
  let dataPromise = null;
  let activeTemplates = {};

  // Resample a stroke to N points evenly spaced along path length
  function resampleStroke(pts, n = N_PTS) {
    if (!pts || pts.length === 0) return [];
    if (pts.length === 1) return Array(n).fill(pts[0]);
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const total = lens[lens.length - 1];
    if (total <= 1e-6) return Array(n).fill(pts[0]);
    const out = [];
    let idx = 0;
    for (let k = 0; k < n; k++) {
      const target = (k / (n - 1)) * total;
      while (idx < lens.length - 2 && lens[idx + 1] < target) idx++;
      const segLen = lens[idx + 1] - lens[idx];
      const t = segLen > 0 ? (target - lens[idx]) / segLen : 0;
      out.push([pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * t, pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * t]);
    }
    return out;
  }

  // Normalise bounding box to [0..1] with aspect ratio preserved (centred)
  function normaliseStrokes(strokes) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const st of strokes) {
      for (const [x, y] of st) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const w = maxX - minX || 1e-4, h = maxY - minY || 1e-4;
    const maxDim = Math.max(w, h);
    const ox = (maxDim - w) / 2, oy = (maxDim - h) / 2;
    return strokes.map(st => st.map(([x, y]) => [(x - minX + ox) / maxDim, (y - minY + oy) / maxDim]));
  }

  function pathLength(st) {
    let L = 0;
    for (let i = 1; i < st.length; i++) L += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
    return L;
  }

  // Mean point distance between two resampled strokes; the reverse direction is allowed at a cost.
  function strokeCost(a, b) {
    let fwd = 0, rev = 0;
    const n = a.length, m = b.length - 1;
    for (let i = 0; i < n; i++) {
      fwd += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]);
      rev += Math.hypot(a[i][0] - b[m - i][0], a[i][1] - b[m - i][1]);
    }
    return Math.min(fwd / n, rev / n + REVERSE_COST);
  }

  // Minimum-cost assignment on a square matrix (Hungarian, O(n^3)). Returns col for each row.
  function hungarian(cost) {
    const n = cost.length;
    const u = new Float64Array(n + 1), v = new Float64Array(n + 1);
    const p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(n + 1).fill(Infinity);
      const used = new Uint8Array(n + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const rowToCol = new Array(n);
    for (let j = 1; j <= n; j++) rowToCol[p[j] - 1] = j - 1;
    return rowToCol;
  }

  // Cost of a drawing against one template: 0 is perfect; roughly 0.45+ is no match.
  function charCost(drawn, drawnLen, tmpl) {
    const a = drawn.length, b = tmpl.strokes.length;
    const n = Math.max(a, b);
    // Square matrix: real rows/cols are strokes, padding is "unmatched" at the stroke's miss cost.
    const cost = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(n);
      for (let j = 0; j < n; j++) {
        if (i < a && j < b) row[j] = strokeCost(drawn[i], tmpl.strokes[j]);
        else if (i < a) row[j] = MISS_BASE + MISS_LEN * drawnLen[i];
        else if (j < b) row[j] = MISS_BASE + MISS_LEN * tmpl.lens[j];
        else row[j] = 0;
      }
      cost.push(row);
    }
    const assign = hungarian(cost);
    let total = 0, pairs = 0, inOrder = 0, prev = -1;
    for (let i = 0; i < n; i++) {
      total += cost[i][assign[i]];
      if (i < a && assign[i] < b) {
        pairs++;
        if (assign[i] > prev) inOrder++;
        prev = assign[i];
      }
    }
    const orderPenalty = pairs > 1 ? ORDER_WEIGHT * (1 - inOrder / pairs) : 0;
    // Averaged over the template's strokes so long characters are not punished for length.
    return total / Math.max(b, 1) + orderPenalty;
  }

  function buildTemplate(strokes, src) {
    const norm = normaliseStrokes(strokes);
    return {
      src,
      strokes: norm.map(st => resampleStroke(st, N_PTS)),
      lens: norm.map(pathLength),
      count: strokes.length
    };
  }

  // Make Me a Hanzi medians: 1024 box, Y up -> 0..1, Y down
  function fromMedians(m) {
    return m.map(st => st.map(([x, y]) => [x / 1024, (900 - y) / 1024]));
  }

  function loadData() {
    if (strokeData) return Promise.resolve(strokeData);
    if (dataPromise) return dataPromise;
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function' && typeof window === 'undefined') {
      try {
        const fs = require('fs'), path = require('path');
        const doc = JSON.parse(fs.readFileSync(path.join(__dirname, 'strokes.json'), 'utf8'));
        strokeData = doc.chars || {};
      } catch (e) { strokeData = {}; }
      return Promise.resolve(strokeData);
    }
    // Browser: strokes.json sits next to this script, wherever the page is (lab/ or root).
    const src = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || 'vendor/recogniser.js';
    const url = new URL('strokes.json', new URL(src, typeof location !== 'undefined' ? location.href : undefined)).href;
    dataPromise = fetch(url)
      .then(r => (r.ok ? r.json() : { chars: {} }))
      .then(doc => { strokeData = doc.chars || {}; return strokeData; })
      .catch(() => { strokeData = {}; return strokeData; });
    return dataPromise;
  }
  // Start the fetch now: document.currentScript only exists while this script runs.
  if (typeof document !== 'undefined') loadData();

  const WRecog = {
    TEMPLATES,

    // Use a stroke-data object instead of vendor/strokes.json (tests, lab benches).
    setData(chars) { strokeData = chars || {}; dataPromise = null; },

    // The active template for ch (0..1, Y down, resampled), or null. For the lab and tests.
    template(ch) { return activeTemplates[ch] || null; },

    async load(allowedChars) {
      const data = await loadData();
      const list = allowedChars || Object.keys(data).concat(Object.keys(TEMPLATES));
      const next = {};
      for (const ch of list) {
        if (next[ch]) continue;
        if (data[ch] && Array.isArray(data[ch].m) && data[ch].m.length) next[ch] = buildTemplate(fromMedians(data[ch].m), 'mmah');
        else if (TEMPLATES[ch]) next[ch] = buildTemplate(TEMPLATES[ch], 'hand');
      }
      activeTemplates = next;
    },

    match(inputStrokes) {
      if (!Array.isArray(inputStrokes)) return [];
      const strokes = inputStrokes.filter(st => Array.isArray(st) && st.length > 0);
      if (strokes.length === 0) return [];
      const norm = normaliseStrokes(strokes);
      const drawn = norm.map(st => resampleStroke(st, N_PTS));
      const drawnLen = norm.map(pathLength);

      const candidates = [];
      for (const ch of Object.keys(activeTemplates)) {
        const tmpl = activeTemplates[ch];
        // Children join or split strokes; allow a few, but not a different character size.
        const countDiff = Math.abs(drawn.length - tmpl.count);
        if (countDiff > Math.max(2, Math.ceil(tmpl.count * 0.34))) continue;
        const score = Math.max(0, Math.min(1, 1 - charCost(drawn, drawnLen, tmpl) * SCORE_SLOPE));
        if (score > 0.05) candidates.push({ ch, score: Math.round(score * 100) / 100, _s: score });
      }
      candidates.sort((x, y) => y._s - x._s);
      return candidates.slice(0, 5).map(({ ch, score }) => ({ ch, score }));
    }
  };

  // Pre-load the hand-made set synchronously so match() works before load() is called.
  for (const ch of Object.keys(TEMPLATES)) activeTemplates[ch] = buildTemplate(TEMPLATES[ch], 'hand');

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WRecog;
  } else {
    root.WRecog = WRecog;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
