// WRecog: offline Chinese handwriting recogniser for a closed set
// Conforms to SPEC.md section 7:
// WRecog.load(allowedChars) -> Promise<void>
// WRecog.match(strokes)     -> [{ch, score}, ...]  best first, at most 5, score 0..1
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

  let activeTemplates = {};

  // Resample a stroke to N points evenly spaced along path length
  function resampleStroke(pts, n = 12) {
    if (!pts || pts.length === 0) return [];
    if (pts.length === 1) return Array(n).fill(pts[0]);
    // Compute cumulative arc length
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const total = lens[lens.length - 1];
    if (total <= 1e-6) return Array(n).fill(pts[0]);

    const resampled = [];
    for (let k = 0; k < n; k++) {
      const target = (k / (n - 1)) * total;
      // binary or linear search for segment
      let idx = 0;
      while (idx < lens.length - 1 && lens[idx + 1] < target) idx++;
      const segLen = lens[idx + 1] - lens[idx];
      const t = segLen > 0 ? (target - lens[idx]) / segLen : 0;
      const x = pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * t;
      const y = pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * t;
      resampled.push([x, y]);
    }
    return resampled;
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

    return strokes.map(st =>
      st.map(([x, y]) => [
        (x - minX + ox) / maxDim,
        (y - minY + oy) / maxDim
      ])
    );
  }

  // Calculate distance between two resampled strokes
  function strokeDistance(s1, s2) {
    let sum = 0;
    const len = Math.min(s1.length, s2.length);
    for (let i = 0; i < len; i++) {
      sum += Math.hypot(s1[i][0] - s2[i][0], s1[i][1] - s2[i][1]);
    }
    return sum / len;
  }

  // Score distance: 0 -> 1.0 (exact match), >0.4 -> lower score
  function scoreFromDist(dist) {
    return Math.max(0, Math.min(1, 1 - dist * 2.2));
  }

  const WRecog = {
    TEMPLATES,

    async load(allowedChars) {
      activeTemplates = {};
      const list = allowedChars || Object.keys(TEMPLATES);
      for (const ch of list) {
        if (TEMPLATES[ch]) {
          activeTemplates[ch] = {
            strokes: TEMPLATES[ch].map(st => resampleStroke(st, 12)),
            count: TEMPLATES[ch].length
          };
        }
      }
    },

    match(inputStrokes) {
      if (!inputStrokes || inputStrokes.length === 0) return [];
      const norm = normaliseStrokes(inputStrokes);
      const resampled = norm.map(st => resampleStroke(st, 12));
      const inCount = resampled.length;

      const candidates = [];

      for (const [ch, tmpl] of Object.entries(activeTemplates)) {
        // Penalty for stroke count mismatch
        const countDiff = Math.abs(inCount - tmpl.count);
        if (countDiff > 2) continue; // Skip wild mismatches

        let totalDist = 0;
        const compareCount = Math.min(inCount, tmpl.count);
        for (let i = 0; i < compareCount; i++) {
          totalDist += strokeDistance(resampled[i], tmpl.strokes[i]);
        }
        let avgDist = totalDist / compareCount;
        if (countDiff > 0) avgDist += countDiff * 0.12;

        const score = scoreFromDist(avgDist);
        if (score > 0.05) {
          candidates.push({ ch, score: Math.round(score * 100) / 100 });
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      return candidates.slice(0, 5);
    }
  };

  // Pre-load default set
  WRecog.load(Object.keys(TEMPLATES));

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WRecog;
  } else {
    root.WRecog = WRecog;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
