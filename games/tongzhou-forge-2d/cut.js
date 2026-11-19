// Glyph Isles 2D: the One Stroke look (paper, ink and vermilion; docs/ART-BRIEF-ONE-STROKE.md).
// Drawn from Claude Design's round 2 boards (docs/design/one-stroke/): flat fills only, no gradients,
// no texture, no blur, no glow. Warm paper, black ink, vermilion, and one accent per isle. Mountains are
// stacked triangles and arches, the river is rows of scale arcs, the play layer is solid ink with a
// bare-paper line inside every walkable top and cut lines on cliff faces only. The hero is a character:
// a dot and the strokes of the character for "big", bending at the joints, with a vermilion sash.
// Stones are paper squares in a cut ink border. Renderer only: it reads the same world as the other looks.
(function (root) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hash = (n, s) => { const x = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- tokens (docs/design/one-stroke/tokens.json) ----------
  const K = {
    paper: '#f1e6d0', paper2: '#f8f1e2', ink: '#171513', cutLine: '#423f39', ink30: '#b0a797', ink45: '#8f887b',
    vermilion: '#cc3524', gamboge: '#e0a526', shadow: '#847e72',
  };
  const TIME = {
    night: { sky: '#5d7182', orb: K.paper, far: '#d3cfc0', water: '#5d7182', ghost: '#eac3ae' },
    daybreak: { sky: '#e9c16d', orb: K.vermilion, far: '#e0d5c1', water: '#8f887b', ghost: '#e39a87' },
  };
  const timeOf = pal => pal === 'night' ? TIME.night : TIME.daybreak;
  const FONT = '900 {px}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "Noto Serif CJK SC", "Tongzhou Brush", serif';
  const font = px => FONT.replace('{px}', px.toFixed(1));
  const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ---------- the hero: the nine poses of docs/design/one-stroke/Hero.dc.html ----------
  // viewBox -29 -88 58 104, feet at y = 0, facing right. arms / torso / legs are strokes that bend at the
  // joints; dot is the head; tails and sash are the vermilion sash with its two ribbon tails.
  const POSES = {
    stand: { arms: 'M-15,-26 L-8,-30 L0,-30 L8,-30 L15,-26', torso: 'M0,-30 L0,-17', legs: 'M0,-17 L-5,-9 L-10,0 M0,-17 L5,-9 L10,0', dot: [0, -37], tails: ['M3,-20.4 C8,-19 9,-14 13,-12', 'M2.6,-20 C6,-16 5,-12 8,-8'], sash: 'M-3.6,-19.6 L3.6,-20.8', dy: 0 },
    run1: { arms: 'M-10,-21 L-4,-25 L4,-29 L10,-25 L14,-30', torso: 'M4,-29 L-1,-16', legs: 'M-1,-16 L6,-10 L8,-1 M-1,-16 L-6,-10 L-12,-7', dot: [7, -35], tails: ['M-2.6,-21.6 C-8,-23 -12,-18 -18,-19.6', 'M-2.6,-21 C-8,-18 -12,-15 -17,-13'], sash: 'M-2.9,-22 L4.5,-19.2', dy: 0 },
    run2: { arms: 'M-6,-30 L-2,-27 L4,-29 L8,-24 L12,-22', torso: 'M4,-29 L0,-16', legs: 'M0,-16 L2,-8 L1,0 M0,-16 L-4,-9 L-9,-12', dot: [6, -35], tails: ['M-2,-21.4 C-7,-22 -11,-18 -17,-19', 'M-2,-21 C-7,-18 -11,-16 -16,-14'], sash: 'M-2.4,-21.8 L5.2,-19.4', dy: 0 },
    jump: { arms: 'M-12,-44 L-8,-37 L0,-31 L8,-37 L12,-44', torso: 'M0,-31 L0,-18', legs: 'M0,-18 L-6,-12 L-3,-6 M0,-18 L6,-12 L3,-6', dot: [0, -38], tails: ['M-3,-21 C-6,-15 -4,-10 -7,-5', 'M-2.4,-20.6 C-3,-14 -8,-11 -9,-7'], sash: 'M-3.6,-21 L3.6,-22.2', dy: 4 },
    leap: { arms: 'M-12,-27 L-5,-28 L3,-30 L-4,-24 L-11,-22', torso: 'M3,-30 L-1,-20 L-8,-10 L-15,-3', legs: 'M-1,-20 L6,-12 L12,-6', dot: [6, -37], tails: ['M-1.6,-24 C-8,-27 -13,-21 -19,-23', 'M-1.6,-23.4 C-8,-20 -13,-17 -19,-16'], sash: 'M-1.9,-24.5 L5.5,-21.5', dy: 0 },
    wall: { arms: 'M-15,-37 L-9,-33 L-2,-29 L-3,-36 L-7,-41', torso: 'M-2,-29 L3,-17', legs: 'M3,-17 L8,-14 L12,-17 L12,-21 M3,-17 L-1,-10 L-5,-6', dot: [-4, -35], tails: ['M3.6,-24 C6,-20 3,-14 5,-9', 'M3.4,-23.4 C1,-18 0,-14 2,-9'], sash: 'M-3.3,-21.5 L4.1,-24.5', dy: 4 },
    carry: { arms: 'M-14,-46 L-13,-34 L-6,-31 L0,-31 L6,-31 L13,-34 L14,-46', torso: 'M0,-31 L0,-17', legs: 'M0,-17 L-6,-9 L-11,0 M0,-17 L6,-9 L11,0', dot: [0, -38], tails: ['M3,-20.4 C8,-19 9,-14 13,-12', 'M2.6,-20 C6,-16 5,-12 8,-8'], sash: 'M-3.6,-19.6 L3.6,-20.8', dy: 0 },
    land: { arms: 'M-17,-13 L-10,-18 L0,-20 L10,-18 L17,-13', torso: 'M0,-20 L0,-11', legs: 'M0,-11 L-8,-6 L-10,0 M0,-11 L8,-6 L10,0', dot: [0, -27], tails: ['M3,-13.4 C7,-17 10,-15 13,-21', 'M2.6,-13 C7,-13 10,-10 15,-12'], sash: 'M-3.6,-13 L3.6,-14', dy: 0 },
    fall: { arms: 'M-13,-41 L-10,-34 L0,-29 L9,-33 L14,-39', torso: 'M0,-29 L1,-16', legs: 'M1,-16 L-2,-8 L-5,-1 M1,-16 L5,-9 L6,0', dot: [-1, -36], tails: ['M-2.6,-19.8 C-8,-23 -10,-28 -16,-31', 'M-2.6,-19.6 C-6,-25 -6,-29 -10,-34'], sash: 'M-2.6,-19.6 L4.6,-21', dy: 0 },
  };
  const P2 = {};
  const path = d => P2[d] || (P2[d] = new Path2D(d));
  const startOf = d => { const m = /^M\s*(-?[\d.]+)[ ,](-?[\d.]+)/.exec(d); return m ? [+m[1], +m[2]] : [0, 0]; };
  // the sky curl: one cut shape (a lucky cloud), 46 units wide
  const CURL = 'M-30,6 C-18,2 -8,4 0,0 C0,-10 14,-12 16,-3 C18,5 8,7 7,0 C6,-5 13,-5 12,-1';

  function create() {
    // ---------- the river: scale arcs on paper, one small pattern tile, made once per size ----------
    const pats = {};
    function wavePattern(ctx, D, u, color) {
      const tw = Math.max(2, Math.round(20 * u * D)), th = Math.max(2, Math.round(10 * u * D));
      const key = [tw, th, color].join();
      if (pats[key]) return pats[key];
      for (const k in pats) if (k.endsWith(color)) delete pats[k];
      const c = document.createElement('canvas'); c.width = tw; c.height = th;
      const g = c.getContext('2d');
      g.scale(tw / 20, th / 10);
      g.strokeStyle = color; g.lineWidth = Math.max(1.1, 1.4); g.lineCap = 'butt';
      const arc = new Path2D('M0,10 A10,10 0 0 1 20,10 M-10,5 A10,10 0 0 1 10,5 M10,5 A10,10 0 0 1 30,5');
      g.stroke(arc);
      const pat = ctx.createPattern(c, 'repeat');
      pat.setTransform(new DOMMatrix([20 * u / tw, 0, 0, 10 * u / th, 0, 0]));
      return (pats[key] = { pat, tw: 20 * u, th: 10 * u });
    }

    function draw(v) {
      const { ctx, W, H, S, X, Y, world, cam, anchorY } = v;
      const c = timeOf(world.L.pal);
      v.c = c;
      ctx.setTransform(v.DPR, 0, 0, v.DPR, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // every band stands on one baseline a cell above the ground, drifting a tenth as fast as the camera
      const base = anchorY - S + (cam.y - 2) * 0.1 * S;
      ctx.fillStyle = K.paper; ctx.fillRect(0, 0, W, H);
      if (base > 0) { ctx.fillStyle = c.sky; ctx.fillRect(0, 0, W, Math.min(H, base)); }
      // the moon is a hole cut in the sky; the sun is a vermilion disc
      ctx.fillStyle = c.orb; ctx.beginPath(); ctx.arc(W * 0.62 - cam.x * S * 0.1, base - 3.1 * S, S * 0.85, 0, Math.PI * 2); ctx.fill();
      skyCurls(v, base);
      mountains(v, base);
      ctx.fillStyle = K.paper; ctx.fillRect(0, Math.max(0, base), W, H);   // the bare-paper strip, always there
      water(v);
      beam(v);
      tiles(v);
      clouds(v);
      for (const g of world.gems) if (!g.got) gem(v, g, false);
      pavilion(v);
      if (v.duskF > 0.01) {
        ctx.fillStyle = 'rgba(23,21,19,' + (0.34 * v.duskF).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
        for (const g of world.glow) if (!g.got) gem(v, g, true);
      }
      v.frames2();
      stones(v, false);
      v.ghost();
      hero(v);
      stones(v, true);
      v.particles();
      if (v.wonF > 0.01) { ctx.fillStyle = 'rgba(248,241,226,' + (0.22 * v.wonF).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      v.offscreen();
    }

    // visible indices of a band that repeats every `sp` world units, at parallax f
    function eachN(v, f, sp, fn) {
      const { W, S, cam } = v;
      const n0 = Math.floor((cam.x * f - W / 2 / S) / sp) - 2, n1 = Math.ceil((cam.x * f + W / 2 / S) / sp) + 2;
      for (let n = n0; n <= n1; n++) fn(n, u => W / 2 + (u - cam.x * f) * S);
    }
    function skyCurls(v, base) {
      const { ctx, S } = v, f = 0.16, k = S / 36;
      ctx.strokeStyle = K.paper; ctx.lineWidth = Math.max(3, 4 * k);
      eachN(v, f, 6, (n, sx) => {
        if (hash(n, 61) < 0.2) return;
        const x = sx(n * 6 + hash(n, 62) * 4), y = base - (2.2 + hash(n, 63) * 7) * S, d = hash(n, 64) < 0.5 ? -1 : 1;
        ctx.save(); ctx.translate(x, y); ctx.scale(k * d, k); ctx.lineWidth = Math.max(3, 4 * k) / k; ctx.stroke(path(CURL)); ctx.restore();
      });
    }
    function mountains(v, base) {
      const { ctx, S } = v;
      // far: flat stacked triangles
      ctx.fillStyle = v.c.far; ctx.beginPath();
      eachN(v, 0.1, 1.5, (n, sx) => {
        const cu = n * 1.5 + (hash(n, 3) - 0.5) * 0.6, hw = (0.75 + hash(n, 4) * 0.35), h = 1.9 + hash(n, 5) * 1.0;
        ctx.moveTo(sx(cu - hw), base + 1); ctx.lineTo(sx(cu), base - h * S); ctx.lineTo(sx(cu + hw), base + 1); ctx.closePath();
      });
      ctx.fill();
      // middle: arches (a column ending in a half circle), ink 30%, and nearer ones at ink 45%
      for (const [f, sp, color, seed, wr, hr] of [[0.25, 1.7, K.ink30, 7, [0.4, 0.62], [0.35, 0.95]], [0.4, 2.1, K.ink45, 13, [0.3, 0.46], [0.15, 0.55]]]) {
        ctx.fillStyle = color; ctx.beginPath();
        eachN(v, f, sp, (n, sx) => {
          if (hash(n, seed + 5) < 0.22) return;
          const cu = n * sp + (hash(n, seed) - 0.5) * sp * 0.5, r = (wr[0] + hash(n, seed + 1) * (wr[1] - wr[0])) * S, h = (hr[0] + hash(n, seed + 2) * (hr[1] - hr[0])) * S;
          const xc = sx(cu), yc = base - h - r;
          ctx.moveTo(xc - r, base + 1); ctx.lineTo(xc - r, yc); ctx.arc(xc, yc, r, Math.PI, 0); ctx.lineTo(xc + r, base + 1); ctx.closePath();
        });
        ctx.fill();
      }
    }

    // the river: paper with scale arcs in the isle's accent, a 2 px line at the surface; clearly lower than any ground
    function water(v) {
      const { ctx, W, H, S, Y, cam, t, c } = v;
      const top = Y(1);
      if (top >= H) return;
      const u = S / 40, wp = wavePattern(ctx, v.DPR, u, c.water);
      const off = (((-cam.x * S + t * S * 0.06) % wp.tw) + wp.tw) % wp.tw;
      ctx.save();
      ctx.translate(off - wp.tw, top);
      ctx.fillStyle = wp.pat; ctx.fillRect(0, 0, W + 2 * wp.tw, H - top + 2);
      ctx.restore();
      ctx.fillStyle = c.water; ctx.fillRect(0, top - 1, W, 2);
    }
    // the goal is visible from anywhere on the isle: a flat strip of vermilion 20% over the pavilion
    function beam(v) {
      const { ctx, S, X, Y, world, c } = v;
      if (world.phase !== 'play') return;
      const x = X(world.pav.x), y = Y(world.pav.y);
      ctx.fillStyle = c.ghost; ctx.fillRect(x - S * 0.17, y - S * 10, S * 0.34, S * 7.4);
    }

    // the play layer: solid ink; a bare-paper line inside every walkable top; cut lines on cliff faces only
    function tiles(v) {
      const { ctx, W, S, X, Y, cam, world } = v;
      const x0 = Math.max(0, Math.floor(cam.x - W / 2 / S) - 1), x1 = Math.min(world.w - 1, Math.ceil(cam.x + W / 2 / S) + 1);
      const open = ch => ch !== '#' && ch !== 'b';
      const rims = [], cuts = [];
      ctx.fillStyle = K.ink;
      ctx.beginPath();
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = 0; cy < world.h; cy++) {
          if (world.cell(cx, cy) !== '#') continue;
          let top = cy;
          while (top + 1 < world.h && world.cell(cx, top + 1) === '#') top++;
          ctx.rect(Math.floor(X(cx)) - 0.5, Math.floor(Y(top + 1)), Math.ceil(S) + 1, Math.ceil((top + 1 - cy) * S) + 1);
          const walk = open(world.cell(cx, top + 1));
          if (walk) rims.push([cx, top + 1]);
          for (let y = cy; y <= top; y++) {
            const topCell = y === top && walk, odd = (cx + y) & 1;
            // two short dashes per cell, staggered; never in the top of a cell you can stand on
            if (!topCell) cuts.push([cx + (odd ? 0.5 : 0.12), y + 0.7, 0.34]);
            cuts.push([cx + (odd ? 0.12 : 0.5), y + 0.3, 0.34]);
          }
          cy = top;
        }
      }
      ctx.fill();
      ctx.strokeStyle = K.cutLine; ctx.lineWidth = Math.max(1, S * 0.032); ctx.lineCap = 'butt';
      ctx.beginPath();
      for (const [x, y, l] of cuts) { const sx = X(x), sy = Y(y); ctx.moveTo(sx, sy); ctx.lineTo(sx + l * S, sy); }
      ctx.stroke();
      ctx.lineCap = 'round';
      // the rim: a line of bare paper just inside the top edge
      const lw = Math.max(2, S * 0.05), inset = Math.max(2, S * 0.07);
      ctx.fillStyle = K.paper;
      for (const [cx, y] of rims) ctx.fillRect(X(cx) - 1, Y(y) + inset, S + 2, lw);
      for (let cx = x0; cx <= x1; cx++) for (let cy = 0; cy < world.h; cy++) {
        const ch = world.cell(cx, cy);
        if (ch === 'T' && world.cell(cx, cy - 1) !== 'T') thorns(v, cx, cy);
        else if (ch === '=') bridgeCell(v, cx, cy);
      }
      boats(v);
      for (const b of world.burnt) {
        const age = world.clock - b.t;
        if (age > 3) continue;
        ctx.fillStyle = K.ink30;
        ctx.beginPath(); ctx.ellipse(X(b.x0 + 0.5), Y(b.y0 + 0.08), S * 0.55 * (1 - age / 4), S * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // a thorn hedge: a row of black triangles, no paper line, so it never reads as a ledge
    function thorns(v, cx, cy) {
      const { ctx, S, X, Y, world } = v;
      let top = cy; while (world.cell(cx, top + 1) === 'T') top++;
      const x = X(cx), yb = Y(cy), yt = Y(top + 1), tooth = Math.min(S * 0.55, (yb - yt) * 0.6), n = 3;
      ctx.fillStyle = K.ink;
      ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x, yt + tooth);
      for (let i = 0; i < n; i++) { ctx.lineTo(x + S * (i + 0.5) / n, yt); ctx.lineTo(x + S * (i + 1) / n, yt + tooth); }
      ctx.lineTo(x + S, yb); ctx.closePath(); ctx.fill();
    }
    // wood grown into a plank bridge: an ink bar with a paper line and short plank dashes; earth into a mound
    function bridgeCell(v, cx, cy) {
      const { ctx, S, X, Y, world } = v;
      const b = world.bridges.find(b => cx >= b.x0 && cx < b.x1 && cy + 1 === b.y);
      const age = b ? world.clock - b.t : 9, n = b ? b.x1 - b.x0 : 1, i = b ? cx - b.x0 : 0;
      const grow = clamp(age / 0.5 * n - i, 0, 1);
      if (grow <= 0) return;
      const x = X(cx), y = Y(cy + 1), th = S * 0.34;
      ctx.fillStyle = K.ink; ctx.fillRect(x, y, S * grow + 0.5, th);
      ctx.fillStyle = K.paper; ctx.fillRect(x, y + Math.max(2, S * 0.06), S * grow, Math.max(1.5, S * 0.04));
      ctx.strokeStyle = K.cutLine; ctx.lineWidth = Math.max(1, S * 0.032); ctx.lineCap = 'butt';
      ctx.beginPath(); for (let k = 0.08; k < grow - 0.2; k += 0.5) { ctx.moveTo(x + S * k, y + th * 0.72); ctx.lineTo(x + S * (k + 0.34), y + th * 0.72); } ctx.stroke();
      ctx.lineCap = 'round';
      if (b && i === 0) tag(ctx, x + S * 0.5, y + th + S * 0.2, S * 0.3, b.ch);
    }
    // a small vermilion tag with a paper glyph (the words stay on the thing)
    function tag(ctx, cx, cy, s, ch) {
      ctx.fillStyle = K.vermilion; ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      ctx.fillStyle = K.paper2; ctx.font = font(s * 0.74); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, cx, cy + s * 0.03);
    }
    // the boat at the start: a flat hull with a paper line, an awning in ink 45%, a punt pole
    function boats(v) {
      const { ctx, S, X, Y, world } = v;
      for (let cy = 0; cy < world.h; cy++) {
        let cx = 0;
        while (cx < world.w) {
          if (world.cell(cx, cy) !== 'b') { cx++; continue; }
          let e = cx; while (world.cell(e + 1, cy) === 'b') e++;
          const x0 = X(cx) - S * 0.3, x1 = X(e + 1) + S * 0.4, top = Y(cy + 1), bot = Y(cy + 0.45), w = x1 - x0;
          ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(2, S * 0.06);
          ctx.beginPath(); ctx.moveTo(x1 - w * 0.06, top - S * 1.4); ctx.lineTo(x1 + w * 0.03, Y(0.2)); ctx.stroke();
          const ax = x0 + w * 0.2, aw = w * 0.36, ah = Math.min(S * 0.7, aw * 0.6);
          ctx.fillStyle = K.ink45;
          ctx.beginPath(); ctx.moveTo(ax, top); ctx.ellipse(ax + aw / 2, top, aw / 2, ah, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = K.ink;
          ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x1, top); ctx.lineTo(x1 - w * 0.08, bot); ctx.lineTo(x0 + w * 0.08, bot); ctx.closePath(); ctx.fill();
          const lw = Math.max(2, S * 0.05), inset = Math.max(2, S * 0.07);
          ctx.fillStyle = K.paper;
          ctx.fillRect(x0 + w * 0.02, top + inset, ax - x0 - w * 0.02, lw); ctx.fillRect(ax + aw, top + inset, x1 - ax - aw - w * 0.02, lw);
          cx = e + 1;
        }
      }
    }

    // lucky clouds you can leap off: one lobed paper shape with an ink outline and a curl; hollow once used
    function clouds(v) {
      const { ctx, S, X, Y, world, t } = v;
      const p = v.me();
      for (const cl of world.clouds) {
        const used = p.src.has(cl.id) && !p.grounded;
        const pulse = cl.t > 0 ? 1 + cl.t * 0.4 : 1;
        const x = X(cl.x), y = Y(cl.y), r = S * 0.3 * pulse;
        ctx.lineWidth = Math.max(1.5, S * 0.04);
        ctx.fillStyle = K.paper2; ctx.strokeStyle = used ? K.ink30 : K.ink;
        ctx.beginPath();
        ctx.moveTo(x - r * 1.7, y + r * 0.45);
        ctx.bezierCurveTo(x - r * 2.0, y - r * 0.2, x - r * 1.2, y - r * 0.6, x - r * 0.75, y - r * 0.25);
        ctx.bezierCurveTo(x - r * 0.6, y - r * 1.2, x + r * 0.6, y - r * 1.2, x + r * 0.65, y - r * 0.3);
        ctx.bezierCurveTo(x + r * 1.2, y - r * 0.7, x + r * 2.0, y - r * 0.1, x + r * 1.7, y + r * 0.45);
        ctx.closePath(); if (!used) ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - r * 0.05, y - r * 0.25, r * 0.32, Math.PI * 0.1, Math.PI * 1.7); ctx.stroke();
      }
    }
    // gems: a paper disc with a hole, in an ink outline; at dusk the glowing ones are vermilion
    function gem(v, g, glows) {
      const { ctx, S, X, Y, t } = v;
      const sx = X(g.x), sy = Y(g.y) + Math.sin(t * 2 + g.x) * S * 0.05, r = S * 0.17;
      ctx.fillStyle = glows ? K.vermilion : K.paper2; ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(1.5, S * 0.035);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = K.ink; ctx.beginPath(); ctx.arc(sx, sy, r * 0.32, 0, Math.PI * 2); ctx.fill();
    }

    // the pavilion (Main.dc.html): two pillars, a vermilion beam, a cut-paper roof with upswept eaves, a vermilion finial
    const ROOF = new Path2D('M682,226 Q702,238 726,232 L744,210 L760,210 L778,232 Q802,238 822,226 L810,244 L694,244 Z');
    function pavilion(v) {
      const { ctx, S, X, Y, world, c } = v;
      const x = X(world.pav.x), y = Y(world.pav.y), k = S * 0.8 / 31;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-752, -281);
      ctx.fillStyle = K.ink; ctx.fillRect(712, 242, 6, 39); ctx.fillRect(786, 242, 6, 39);
      ctx.fillStyle = K.vermilion; ctx.fillRect(712, 244, 80, 4);
      ctx.fillStyle = K.ink; ctx.fill(ROOF);
      ctx.fillStyle = K.vermilion; ctx.beginPath(); ctx.arc(752, 204, 3, 0, Math.PI * 2); ctx.fill();
      if (world.phase === 'play') {
        // the character it wants, ghosted in vermilion 20%
        ctx.font = font(46); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = c.ghost; ctx.fillText(world.L.want, 752, 168);
      }
      ctx.restore();
    }

    // ---------- the stones: a paper square in a cut ink border ----------
    // The block keeps the stone's box exactly: what you see is what you hit.
    function block(ctx, sx, sy, s, ch, color, hi) {
      const i = s * 3 / 32, n = s * 3 / 32;
      if (hi) { const d = Math.max(2, s * 0.08); ctx.fillStyle = K.gamboge; ctx.fillRect(sx - d, sy - d, s + 2 * d, s + 2 * d); }
      ctx.fillStyle = K.ink; ctx.fillRect(sx, sy, s, s);
      ctx.fillStyle = K.paper2;
      ctx.beginPath();
      ctx.moveTo(sx + i, sy + i + n); ctx.lineTo(sx + i + n, sy + i); ctx.lineTo(sx + s - i - n, sy + i); ctx.lineTo(sx + s - i, sy + i + n);
      ctx.lineTo(sx + s - i, sy + s - i - n); ctx.lineTo(sx + s - i - n, sy + s - i); ctx.lineTo(sx + i + n, sy + s - i); ctx.lineTo(sx + i, sy + s - i - n);
      ctx.closePath(); ctx.fill();
      ctx.font = font(s * 0.66); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(ch, sx + s / 2, sy + s * 0.52);
    }
    // the paper slip under a stone on the ground, with its pinyin (13 px or more)
    function slip(ctx, cx, y, text, px, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '600 ' + px.toFixed(0) + 'px ' + SANS;
      const w = ctx.measureText(text).width + px * 0.9, h = px * 1.45;
      ctx.fillStyle = K.paper2; ctx.strokeStyle = K.ink; ctx.lineWidth = 1.2;
      ctx.fillRect(cx - w / 2, y, w, h); ctx.strokeRect(cx - w / 2, y, w, h);
      ctx.fillStyle = K.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, y + h * 0.54);
      ctx.restore();
    }
    // pieces made by a recipe (forged characters) keep a vermilion glyph; the base elements their own colour
    const made = {};
    function isMade(ch) {
      if (made[ch] === undefined) made[ch] = !!(root.WRules && root.WRules.RECIPE_LIST.some(r => r[3] === ch));
      return made[ch];
    }
    function stones(v, heldOnly) {
      const { ctx, S, X, Y, world } = v;
      const p = v.me(), l = world.launch(p), [mpx] = v.posOf(p, v.a);
      const SW = v.SW, SH = v.SH;
      for (const k of world.stones) {
        if (k.state === 'gone' || (k.state === 'held') !== heldOnly) continue;
        let [x, y] = v.posOf(k, v.a);
        if (k.state === 'held') { const [hx, hy] = v.posOf(k.holder, v.a); x = hx; y = hy + v.HOLD_Y; }
        const sx = X(x - SW), sy = Y(y + SH), s = SH * S;
        block(ctx, sx, sy, s, v.shapeOf(k), isMade(k.ch) ? K.vermilion : v.elOf(k.ch).b, l.mode === 'grab' && l.k === k);
        let label = 0;
        if (k.state === 'loose' && k.grounded && !k.support && v.labels !== 'card') {
          label = v.labels === 'near' ? clamp(1 - (Math.abs(x - mpx) - 3) / 3, 0, 1) : 1;
        }
        if (label > 0.02) slip(ctx, sx + s / 2, Y(y) - s * 0.08, v.words(k.ch).py, Math.max(13, S * 0.26), label);
      }
    }

    // ---------- the hero ----------
    function heroPose(v, p) {
      if (p.hold) return 'carry';
      if (!p.grounded) {
        if (p.wall) return 'wall';
        if (p.leapt && p.vy > -1.5) return 'leap';
        if (p.vy < -5) return 'fall';
        return 'jump';
      }
      if (v.land > 0) return 'land';
      if (Math.abs(p.vx) > 0.5) return 'run';
      return 'stand';
    }
    // one pose, stroked twice: gamboge at 7.6 units then ink at 5, so a 1.3 unit rim is left; then the sash
    function paintPose(g, P, t, sp) {
      for (const [col, w, r] of [[K.gamboge, 7.6, 4.2], [K.ink, 5, 2.9]]) {
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w;
        g.stroke(path(P.arms)); g.stroke(path(P.torso)); g.stroke(path(P.legs));
        g.beginPath(); g.arc(P.dot[0], P.dot[1], r, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = K.vermilion; g.lineWidth = 1.4;
      P.tails.forEach((d, i) => {
        const [px, py] = startOf(d);
        g.save(); g.translate(px, py); g.rotate(Math.sin(t * (6 + sp) + i * 2) * (0.04 + Math.min(0.1, sp * 0.012))); g.translate(-px, -py);
        g.stroke(path(d)); g.restore();
      });
      g.lineWidth = 3.4; g.stroke(path(P.sash));
    }
    function hero(v) {
      const { ctx, S, X, Y, world, t } = v;
      const p = v.me();
      const [x, y] = v.posOf(p, v.a);
      // where you will land: a dotted ink line and a shadow; over water a vermilion line and a ring
      if (!p.grounded) {
        const fy = world.floorUnder(x, v.PW, y);
        const wet = fy < 1.01, gy = wet ? 1 : fy, h = y - gy;
        const col = wet ? K.vermilion : K.ink;
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.8, S * 0.04);
        ctx.setLineDash([0, Math.max(5, S * 0.12)]); ctx.beginPath(); ctx.moveTo(X(x), Y(y) + 2); ctx.lineTo(X(x), Y(gy) - 3); ctx.stroke(); ctx.setLineDash([]);
        const rx = S * 0.3 * (1 - Math.min(0.5, h / 10));
        ctx.beginPath(); ctx.ellipse(X(x), Y(gy) + 1, rx, S * 0.08, 0, 0, Math.PI * 2);
        if (wet) { ctx.lineWidth = Math.max(1.5, S * 0.03); ctx.stroke(); } else { ctx.fillStyle = K.shadow; ctx.fill(); }
      }
      // leap ready: a gamboge ring under your feet while you can still leap
      const cap = p.hold ? world.qi.carry : world.qi.chain;
      if (!p.grounded && p.qi > 0 && p.chain < cap) {
        ctx.strokeStyle = K.gamboge; ctx.lineWidth = Math.max(2, S * 0.05);
        ctx.beginPath(); ctx.ellipse(X(x), Y(y) + 2, S * 0.3, S * 0.085, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.leapt && p.vy > 0 && Math.random() < 0.7) v.fx.push({ x: x - p.face * 0.15 + (Math.random() - 0.5) * 0.2, y: y + 0.45, vx: 0, vy: -0.4, life: 0.45, max: 0.45, kind: 'wisp', size: 0.07, g: 0 });
      const pose = heroPose(v, p);
      const key = pose === 'run' ? (Math.floor(t * 8) % 2 ? 'run2' : 'run1') : pose;
      const P = POSES[key];
      const k = v.PH * S / 40;
      const shake = p.stun > 0 ? Math.sin(t * 60) * 1.2 : 0;
      const face = pose === 'wall' ? p.wall : p.face;
      ctx.save();
      ctx.translate(X(x) + shake, Y(y)); ctx.scale(k * face, k);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.translate(0, P.dy);
      if (pose === 'land') {
        ctx.strokeStyle = K.shadow; ctx.lineWidth = 1.2;
        ctx.stroke(path('M-19,-2 L-14,-2 M14,-2 L19,-2 M-17,-5 L-13,-4 M13,-4 L17,-5'));
      }
      paintPose(ctx, P, t, Math.hypot(p.vx, p.vy));
      ctx.restore();
    }

    return { draw, heroPose, block, font };
  }

  root.WCut = { create, TIME, K, POSES, font };
})(window);
