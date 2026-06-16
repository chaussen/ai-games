/* ============================================================
   stroke-cell.js — Casey Chinese Series
   Canonical generator for the colored stroke-order character cell.

   Data source: makemeahanzi (https://github.com/skishore/makemeahanzi),
   the same SVG stroke-path + median data the zitu-cards pipeline uses.
   Combined per-character data lives in assets/data/stroke-data.json as
       { "口": { "s": [<svg path d> ...], "m": [[[x,y]...] ...] }, ... }
   where strokes are in makemeahanzi's 1024 Y-up coordinate space.

   The textbook PAGES ship STATIC, pre-rendered inline SVG in each
   .charcard__cell (built from this same function so print / PDF /
   standalone all work with zero JS). This file is the source of truth
   for that rendering and can be reused to regenerate cells.

   Style (locked with the user):
     • rainbow hue sweep, stroke 1 → N
     • plain order numbers, each matching its stroke colour, white halo,
       NO circle
     • numbers placed at each stroke's start, then relaxed apart so
       joining strokes don't overprint (readability > exact placement)
   ============================================================ */
(function (global) {
  function strokePalette(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? 0 : i / (n - 1);
      out.push(`hsl(${(8 + t * 282).toFixed(1)} 70% 45%)`);
    }
    return out;
  }

  // Place order numbers at each stroke's start (median[0]), then relax so
  // numbers that share a start point spread apart. Coords in 1024-space.
  function layoutNumbers(medians) {
    const orig = medians.map((m) => [m[0][0], 900 - m[0][1]]);
    const pos = orig.map((p) => [p[0], p[1]]);
    const R = 96;
    for (let it = 0; it < 90; it++) {
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          let dx = pos[j][0] - pos[i][0];
          let dy = pos[j][1] - pos[i][1];
          let dist = Math.hypot(dx, dy) || 0.01;
          if (dist < R) {
            const push = (R - dist) / 2;
            dx /= dist; dy /= dist;
            pos[i][0] -= dx * push; pos[i][1] -= dy * push;
            pos[j][0] += dx * push; pos[j][1] += dy * push;
          }
        }
      }
      for (let i = 0; i < pos.length; i++) {
        pos[i][0] += (orig[i][0] - pos[i][0]) * 0.06;
        pos[i][1] += (orig[i][1] - pos[i][1]) * 0.06;
      }
    }
    for (const p of pos) {
      p[0] = Math.max(48, Math.min(976, p[0]));
      p[1] = Math.max(48, Math.min(976, p[1]));
    }
    return pos;
  }

  // Returns an inline <svg> string for one character's stroke-order cell.
  function strokeCellSVG(ch, data) {
    const strokes = data.s, medians = data.m, n = strokes.length;
    const cols = strokePalette(n);
    let paths = "";
    strokes.forEach((p, i) => { paths += `<path d="${p}" fill="${cols[i]}"/>`; });
    const pos = layoutNumbers(medians);
    let nums = "";
    pos.forEach((p, i) => {
      nums += `<text x="${p[0].toFixed(0)}" y="${p[1].toFixed(0)}" text-anchor="middle" ` +
        `dominant-baseline="central" font-size="80" font-weight="800" ` +
        `font-family="'Schibsted Grotesk',system-ui,sans-serif" fill="${cols[i]}" ` +
        `stroke="#fffdf8" stroke-width="15" paint-order="stroke" stroke-linejoin="round">${i + 1}</text>`;
    });
    return `<svg class="strokediagram" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" ` +
      `role="img" aria-label="${ch} — stroke order"><g transform="translate(0,900) scale(1,-1)">${paths}</g>` +
      `<g class="nums">${nums}</g></svg>`;
  }

  // Optional runtime hydration: fill any .charcard__cell[data-char] that has
  // no SVG yet (pages normally ship pre-rendered, so this is a no-op there).
  async function hydrate(dataUrl) {
    const cells = [...document.querySelectorAll('.charcard__cell[data-char]')]
      .filter((c) => !c.querySelector('svg'));
    if (!cells.length) return;
    const DATA = await fetch(dataUrl || 'assets/data/stroke-data.json').then((r) => r.json());
    for (const c of cells) {
      const ch = c.getAttribute('data-char');
      if (DATA[ch]) c.insertAdjacentHTML('beforeend', strokeCellSVG(ch, DATA[ch]));
    }
  }

  global.StrokeCell = { strokeCellSVG, strokePalette, layoutNumbers, hydrate };
})(typeof window !== 'undefined' ? window : globalThis);
