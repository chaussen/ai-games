// 同舟 · Glyph Isles 2D — the 水墨江湖 "ink jianghu" look (docs/ART-DIRECTION.md, FG-D020).
// Drawn from Claude Design's boards (docs/design/): a Song handscroll in ink and 青绿 on silk, karst
// pillars in two parallax bands, a mist band of bare silk, the play layer in full ink with axe-cut
// texture on cliff faces only, a hero of few brush strokes (斗笠, robe, vermilion sash and ribbons,
// a gamboge rim for "you"), and stones as 活字 type blocks with a paper slip for the pinyin.
// Renderer only: it reads the same world as the greybox. No sword (John, 2026-11-19).
(function (root) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hash = (n, s) => { const x = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- tokens (docs/design/tokens.json) ----------
  const K = {
    ink: '#1d1b1a', vermilion: '#c23a2b', gamboge: '#e0a526', gilt: '#c9a24a', ochre: '#a0603a', umber: 'rgba(90,61,28,.35)',
    stone: { face: '#f3e4c0', grain: '#dcc596', side: '#b8956a', bottom: '#9a774c', slip: '#f5ecd6' },
  };
  const TIME = {
    night: {
      base: '#d5cbb2', sky0: '#64767f', sky1: '#a3aca7', orb: '#f5edd8', halo: '#f5edd8', refl: '#f5edd8',
      far0: '#94a6a6', far1: '#b2b6aa', mid0: '#4a7383', mid1: '#5e8774', mid2: '#88836d', mid3: '#ddd3ba',
      mist: '#e5dbc3', cloud: '#e8dec7', pine: '#3c5a50',
      water0: '#2f6f8f', water1: '#1c4866', wline: '#86b3c4', wcrest: '#dbe4da',
      face: '#20292e', cun: '#3e5058', rim: '#ece0c6',
    },
    daybreak: {
      base: '#eadbbb', sky0: '#b5c3c0', sky1: '#f0d6a4', orb: '#e9a062', halo: '#f2c27e', refl: '#f2c27e',
      far0: '#a5c0b0', far1: '#cbcbb2', mid0: '#2f6f8f', mid1: '#4f9a7a', mid2: '#a3865d', mid3: '#efe2c6',
      mist: '#f3e9d2', cloud: '#f6ecd6', pine: '#2f5a48',
      water0: '#2f6f8f', water1: '#235e7e', wline: '#a8ccd8', wcrest: '#f4ecd8',
      face: '#252c2f', cun: '#4b5c62', rim: '#f3e7cc',
    },
  };
  const timeOf = pal => pal === 'night' ? TIME.night : TIME.daybreak;

  // ---------- the hero: Design's pose sheet, in its own units (44 tall, feet at 0, facing right) ----------
  // s = ink stroke, r = ribbon (vermilion stroke that flutters), f = fill, c = head, h = hat
  const RIB1 = 1.6, RIB2 = 1.3;
  const SASH_STAND = 'M-5.3,-21.5 C-1.5,-22.4 1.5,-22.4 5.3,-21.5 L5.5,-19 C1.6,-19.8 -1.6,-19.8 -5.5,-19 Z';
  const SASH_AIR = 'M-5.4,-21.6 C-1.6,-22.4 1.6,-22.4 5.4,-21.6 L5.6,-19.2 C1.7,-20 -1.7,-20 -5.6,-19.2 Z';
  const ROBE_STAND = 'M-4.4,-30 C-5.6,-24 -5.8,-15 -7.6,-4 C-2,-3 3,-3 7.6,-4.2 C5.8,-15 5.6,-24 4.4,-30 C1.5,-31.4 -1.5,-31.4 -4.4,-30 Z';
  const POSES = {
    stand: [
      ['r', 'M3,-20 C8,-16 6,-10 9,-5', RIB1], ['r', 'M2.6,-19.6 C5.5,-14 3.4,-9 5.6,-3.8', RIB2],
      ['s', 'M-3.8,-29 C-6,-25 -7,-21 -6.6,-17', 3.2],
      ['s', 'M-2.6,-5 L-2.8,-0.6 L0,-0.4 M2.4,-5 L2.8,-0.6 L5.6,-0.4', 2.3],
      ['f', ROBE_STAND], ['s', 'M1,-27 C2,-20 1,-12 2.5,-5', 0.6, '#4a4540'],
      ['s', 'M3.8,-29 C6,-25 6.8,-21 6.2,-16.5', 3.4], ['f', SASH_STAND, K.vermilion],
      ['c', 0.4, -33.6], ['h', 0.4, -34.4, -3],
    ],
    run: [
      ['r', 'M-5,-19 C-10,-21 -14,-16 -20,-18.5', RIB1], ['r', 'M-5,-18 C-10,-15 -14,-12 -19,-12.8', RIB2],
      ['s', 'M-1.5,-27.5 L-6,-23 L-9.5,-24.5', 3],
      ['L', 'M-1.5,-9 L-5.5,-5 L-10,-6.5', 'M1.5,-9 L6,-5.5 L7,-0.6 L10,-0.5'],
      ['f', 'M-2.6,-29 C-5,-23 -7,-16 -10,-9 C-5,-8 0,-8.6 4,-9.6 C5.4,-16 6.4,-23 6.4,-29.4 C3.6,-30.8 0,-30.6 -2.6,-29 Z'],
      ['f', 'M-5.4,-20.4 C-1.2,-21.8 2.6,-21.8 5.8,-21 L5.6,-18.6 C2.4,-19.2 -1,-19.2 -6,-17.8 Z', K.vermilion],
      ['s', 'M5,-27.5 L9.5,-23.5 L12.4,-26', 3],
      ['c', 4, -33], ['h', 4, -33.8, 8],
    ],
    jump: [
      ['r', 'M-4,-19.6 C-7,-13 -5,-7 -8,-1', RIB1], ['r', 'M-3.6,-19 C-4,-12 -9,-8 -10,-3', RIB2],
      ['s', 'M-1.6,-8 L-3.4,-4 L0,-1.4 M2,-8 L5.8,-5 L3.4,-1.8', 2.4],
      ['f', 'M-4.2,-30 C-6,-24 -7,-17 -9,-9 C-3,-7 3,-7 7,-8.6 C6,-16 5.6,-24 4.2,-30 C1.4,-31.4 -1.4,-31.4 -4.2,-30 Z'],
      ['s', 'M-3.5,-28.5 L-7.5,-33 L-8.4,-37.4 M3.5,-28.5 L8,-32 L11,-35.4', 3],
      ['f', SASH_AIR, K.vermilion], ['c', 0.6, -33.6], ['h', 0.6, -34.4, -4],
    ],
    leap: [
      ['r', 'M-3,-17 C-10,-22 -16,-16 -24,-21 C-28,-23.4 -31,-20.6 -34,-22.4', RIB1], ['r', 'M-3,-16 C-10,-14 -17,-9 -26,-12', RIB2],
      ['s', 'M-2,-14 L-10,-10.6 L-16,-11.6', 2.4], ['s', 'M0,-14 L-2.4,-7.6 L-6.6,-5.4', 2.4],
      ['s', 'M2.5,-28 L-4,-30.2 L-10.4,-33.6', 3], ['f', 'M-10.4,-33.6 l-3.4,-0.4 l2,2.8 Z'],
      ['f', 'M1.6,-30 C-1,-25 -4,-19 -9,-13 C-5,-11 -1,-11 2,-12.5 C4.6,-18 7,-23 9.4,-28 C7,-30.6 4,-31.4 1.6,-30 Z'],
      ['f', 'M-3.2,-17.6 C0,-20 3,-20.6 5.8,-20 L4.8,-17.6 C2,-18 -0.6,-17.4 -4.4,-15.4 Z', K.vermilion],
      ['s', 'M7.5,-27.5 L13,-26 L18.4,-28.6', 3], ['f', 'M18.4,-28.6 l3.4,-1.2 l-1.4,3 Z'],
      ['c', 8, -33], ['h', 8.4, -33.8, 14],
    ],
    wall: [
      ['r', 'M2,-20 C4,-14 1,-9 3,-4', RIB1], ['r', 'M1.6,-19.5 C-1,-14 -2,-10 0,-5', RIB2],
      ['s', 'M2,-12 L6,-10.4 L8.4,-12.6', 2.4], ['s', 'M8.4,-15 L8.4,-10.6', 2], ['s', 'M0,-12 L-3.6,-7.4 L0.6,-4.6', 2.4],
      ['R', -14, 2, -12, [
        ['f', 'M-0.4,-31 C-2.4,-26 -2.6,-20 -2.4,-12.4 C0.4,-11 3.4,-11 5.8,-12.4 C5,-20 5,-26 4.4,-31 C2.8,-32.2 1,-32.2 -0.4,-31 Z'],
        ['f', 'M-2.6,-21.4 C0,-22.2 2.6,-22.2 5.2,-21.4 L5.2,-19 C2.6,-19.8 0,-19.8 -2.6,-19 Z', K.vermilion],
        ['s', 'M0.4,-29 L-5,-31.6 L-9.4,-34.6 M3.6,-29 L-0.6,-33.4 L-4,-37.6', 3],
        ['c', 1, -34], ['h', 1, -34.8, -12],
      ]],
    ],
    carry: [
      ['r', 'M3,-20 C8,-16 6,-10 9,-5', RIB1], ['r', 'M2.6,-19.6 C5.5,-14 3.4,-9 5.6,-3.8', RIB2],
      ['s', 'M-2.4,-5 L-4,-0.6 L-1.4,-0.4 M2.4,-5 L4,-0.6 L6.6,-0.4', 2.3],
      ['f', ROBE_STAND], ['f', SASH_STAND, K.vermilion],
      ['s', 'M-3.6,-29 L-6.4,-37 L-5.8,-44.6 M3.6,-29 L6.4,-37 L5.8,-44.6', 3],
      ['c', 0.4, -33.6], ['h', 0.4, -34.4, 0],
    ],
    land: [
      ['r', 'M4,-15.4 C8,-20 12,-18 15,-24', RIB1], ['r', 'M3.6,-15 C8,-16 11,-12 16,-15', RIB2],
      ['s', 'M-1.5,-9 L-6,-4.6 L-5,-0.6 L-8,-0.5 M1.5,-9 L6,-5 L5.4,-0.6 L8.4,-0.5', 2.4],
      ['f', 'M-4,-24 C-6,-19 -8,-13 -10,-5 C-3,-4 4,-4 9.6,-5.4 C7,-13 6,-19 4.4,-24 C1.4,-25.4 -1.4,-25.4 -4,-24 Z'],
      ['s', 'M-3.4,-23 L-9,-20 L-13,-17.6 M3.6,-23 L9,-21 L13,-19', 3],
      ['f', 'M-5.4,-16.6 C-1.6,-17.4 1.6,-17.4 5.6,-16.6 L5.8,-14.2 C1.8,-15 -1.8,-15 -5.8,-14.2 Z', K.vermilion],
      ['c', 0.6, -27.6], ['h', 0.6, -28.4, 4],
    ],
    fall: [
      ['r', 'M-3,-21 C-6,-28 -3,-34 -6,-42', RIB1], ['r', 'M-2.4,-21 C-1,-29 -4,-36 -1,-44', RIB2],
      ['s', 'M-1.6,-8 L-2.6,-2.4 L-4.4,0.6 M2,-8 L3.6,-2.6 L6.2,-1.2', 2.4],
      ['f', 'M-4.2,-30 C-6,-25 -7,-19 -8.6,-10 C-3,-11.6 3,-11.6 8.4,-10 C7,-19 6,-25 4.2,-30 C1.4,-31.4 -1.4,-31.4 -4.2,-30 Z'],
      ['s', 'M-3.6,-28.6 L-8.6,-33 L-9.6,-39 M3.6,-28.6 L9,-31 L13,-35.4', 3],
      ['f', SASH_AIR, K.vermilion], ['c', 0, -33.6], ['h', 0, -36.2, -10],
    ],
  };
  // the run cycle's second frame: the legs swap (Design drew one frame; two read as running)
  const RUN_LEGS = [['M-1.5,-9 L-5.5,-5 L-10,-6.5', 'M1.5,-9 L6,-5.5 L7,-0.6 L10,-0.5'], ['M-1.5,-9 L-2.6,-4.6 L-1,-0.6 L2,-0.5', 'M1.5,-9 L6.6,-7.6 L4.6,-3.2']];
  const HAT = new Path2D('M-11,-1.5 L0,-9.5 L11,-1.5 Q0,0.4 -11,-1.5 Z');
  const HAT_RIBS = new Path2D('M0,-9.3 L-5.5,-1 M0,-9.3 L5.5,-1 M0,-9.3 L0,-0.6');
  const P2 = {};
  const path = d => P2[d] || (P2[d] = new Path2D(d));
  const startOf = d => { const m = /^M\s*(-?[\d.]+)[ ,](-?[\d.]+)/.exec(d); return m ? [+m[1], +m[2]] : [0, 0]; };

  function create() {
    let silkPat = null;
    // Big gradient fills are slow to rasterise on phones (a full-screen one cost ~40 ms a frame in
    // headless Chrome). A vertical gradient is painted once into a thin strip and stretched instead.
    const strips = {};
    function strip(stops) {
      const key = stops.join('|');
      if (strips[key]) return strips[key];
      const c = document.createElement('canvas'); c.width = 4; c.height = 256;
      const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      for (const [k, col] of stops) gr.addColorStop(k, col);
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
      return (strips[key] = c);
    }
    function vfill(ctx, stops, x, y0, w, y1) { if (y1 > y0) ctx.drawImage(strip(stops), 0, 0, 4, 256, x, y0, w, y1 - y0); }
    // a full-width band of vertical gradient at its exact size in device pixels, copied unscaled
    const bands = {};
    function vband(ctx, D, stops, W, y0, h) {
      const key = stops.join('|') + W + 'x' + h + '@' + D;
      let c = bands[key];
      if (!c) {
        for (const k in bands) if (k.startsWith(stops.join('|'))) delete bands[k];
        c = bands[key] = document.createElement('canvas');
        c.width = Math.ceil(W * D); c.height = Math.max(1, Math.ceil(h * D));
        const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, c.height);
        for (const [k, col] of stops) gr.addColorStop(k, col);
        g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c, 0, Math.round(y0 * D)); ctx.setTransform(D, 0, 0, D, 0, 0);
    }

    // a sheet of silk: fine horizontal fibres, made once
    function silk(ctx) {
      if (silkPat) return silkPat;
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      // fibres that leave one edge come back in at the other, so the tile has no seam
      for (let i = 0; i < 900; i++) {
        const x = hash(i, 1) * 256, y = hash(i, 2) * 256, l = 4 + hash(i, 3) * 22, dy = (hash(i, 6) - 0.5) * 1.2;
        g.strokeStyle = 'rgba(82,64,36,' + (0.025 + hash(i, 4) * 0.05).toFixed(3) + ')';
        g.lineWidth = 0.5 + hash(i, 5) * 0.5;
        for (const ox of [0, -256]) for (const oy of [0, -256]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + l, y + oy + dy); g.stroke(); }
      }
      for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(82,64,36,' + (0.03 + hash(i, 7) * 0.05).toFixed(3) + ')'; g.fillRect(hash(i, 8) * 256, hash(i, 9) * 256, 1, 1); }
      silkPat = ctx.createPattern(c, 'repeat');
      return silkPat;
    }

    // Baked layers (ART-DIRECTION §5): the sky with the far band, and the middle band, are painted
    // once into canvases a margin wider than the screen and slid for parallax. They are repainted only when the slide runs out of margin,
    // the screen changes, or the isle's time of day does.
    const baked = {};
    function layer(v, name, f, key, paint) {
      const { ctx, W, H, S, cam } = v;
      const mx = Math.ceil(W * 0.3), my = Math.ceil(H * 0.3), q = v.DPR;
      let L = baked[name];
      const dx = L ? (cam.x - L.cx) * f * S : 0, dy = L ? (cam.y - L.cy) * f * S : 0;
      if (!L || L.key !== key || Math.abs(dx) > mx - 2 || Math.abs(dy) > my - 2) {
        L = baked[name] = L && L.key === key ? L : { cv: document.createElement('canvas'), key };
        L.cv.width = Math.ceil((W + 2 * mx) * q); L.cv.height = Math.ceil((H + 2 * my) * q);
        L.cx = cam.x; L.cy = cam.y;
        const b = L.cv.getContext('2d');
        b.setTransform(q, 0, 0, q, mx * q, my * q);
        b.lineCap = 'round'; b.lineJoin = 'round';
        paint({ ...v, ctx: b, mx, my });
        return layer(v, name, f, key, paint);
      }
      // unscaled, on whole device pixels: a plain copy, the cheapest thing a canvas can do (a
      // stretched copy cost three times the whole greybox frame in headless Chrome)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(L.cv, Math.round((-mx - dx) * q), Math.round((-my + dy) * q));
      ctx.setTransform(q, 0, 0, q, 0, 0);
    }

    function draw(v) {
      const { ctx, W, H, S, X, Y, world, cam } = v;
      const c = timeOf(world.L.pal);
      v.c = c;
      ctx.setTransform(v.DPR, 0, 0, v.DPR, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const g0 = 2;                                   // the ground most isles stand on
      const key = [world.L.pal, W, H, S, v.anchorY].join();
      const ox = W * 0.62 - cam.x * S * 0.1;          // the moon, also over its reflection
      layer(v, 'back', 0.1, key, b => {
        const { ctx: g, mx, my } = b, f = 0.1;
        g.fillStyle = c.base; g.fillRect(-mx, -my, W + 2 * mx, H + 2 * my);
        // the sky wash ends at the far band's foot
        const skyBot = b.anchorY - (g0 + 0.2 - cam.y * f) * S;
        vfill(g, [[0, c.sky0], [0.45, c.sky1], [1, c.base]], -mx, Math.min(-my, skyBot - 8 * S), W + 2 * mx, skyBot);
        // the moon (or the low sun): a disc of bare silk, far away
        const oy = b.anchorY - (g0 + 5.6 - cam.y * f) * S, orr = S * 0.62;
        const halo = g.createRadialGradient(ox, oy, 0, ox, oy, orr * 2.5);
        halo.addColorStop(0, hexA(c.halo, 0.8)); halo.addColorStop(0.45, hexA(c.halo, 0.32)); halo.addColorStop(1, hexA(c.halo, 0));
        g.fillStyle = halo; g.beginPath(); g.arc(ox, oy, orr * 2.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = c.orb; g.beginPath(); g.arc(ox, oy, orr, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(29,27,26,.12)'; g.lineWidth = 0.8; g.stroke();
        // 平远: the far band of karst pillars, a sea of mist under it
        band(b, { f, sp: 1.25, seed: 3, yb: g0 + 1.0, h: [2.4, 4.8], w: [0.55, 0.95], stops: [[0, c.far0], [0.55, c.far1], [1, c.base]], under: c.base });
        // silk grain and an aged edge, on the far things only (the play layer stays crisp)
        g.fillStyle = silk(g); g.fillRect(-mx, -my, W + 2 * mx, H + 2 * my);
        const vg = g.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, Math.hypot(W, H) * 0.62);
        vg.addColorStop(0.55, 'rgba(122,95,58,0)'); vg.addColorStop(1, 'rgba(122,95,58,.22)');
        g.fillStyle = vg; g.fillRect(-mx, -my, W + 2 * mx, H + 2 * my);
      });
      // 深远: the middle band, malachite pillars with hemp strokes, pines and cloud wisps
      layer(v, 'mid', 0.3, key, b => band(b, { f: 0.3, sp: 2.3, seed: 9, yb: g0 - 0.25, h: [2.0, 3.8], w: [0.7, 1.35], gaps: 0.28, stops: [[0, c.mid0], [0.3, c.mid1], [0.68, c.mid2], [1, c.mid3]], under: c.mist, mid: true }));
      // 留白: the mist band of bare silk between the middle band and the play layer
      const m0 = Y(g0 + 1.75), m1 = Y(g0 - 0.6);
      vband(ctx, v.DPR, [[0, hexA(c.mist, 0)], [0.42, hexA(c.mist, 0.97)], [1, c.mist]], W, m0, m1 - m0);
      if (m1 < H) { ctx.fillStyle = c.mist; ctx.fillRect(0, m1, W, H - m1); }
      water(v, ox);
      tiles(v);
      clouds(v); for (const g of world.gems) if (!g.got) jade(v, g, '#4f9a7a', false);
      pavilion(v);
      if (v.duskF > 0.01) { ctx.fillStyle = 'rgba(31,30,70,' + (0.42 * v.duskF).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); for (const g of world.glow) if (!g.got) jade(v, g, '#b9a6ff', true); }
      v.frames2();
      stones(v, false);
      v.ghost();
      hero(v);
      stones(v, true);
      v.particles();
      if (v.wonF > 0.01) { ctx.fillStyle = 'rgba(255,250,236,' + (0.2 * v.wonF).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      v.offscreen();
    }

    // a band of pillars at parallax f; each pillar is Design's tower: steep sides, a rounded cap
    function band(v, o) {
      const { ctx, W, H, S, cam, anchorY } = v;
      const base = anchorY - (o.yb - cam.y * o.f) * S;
      const top = base - o.h[1] * S;
      const gr = ctx.createLinearGradient(0, top, 0, base);
      for (const [k, col] of o.stops) gr.addColorStop(k, col);
      const mx = v.mx || 0, my = v.my || 0;
      const u0 = (-W / 2 - mx) / S + cam.x * o.f, u1 = (W / 2 + mx) / S + cam.x * o.f;
      const n0 = Math.floor(u0 / o.sp) - 2, n1 = Math.ceil(u1 / o.sp) + 2;
      const sx = u => W / 2 + (u - cam.x * o.f) * S;
      const tops = [];
      ctx.fillStyle = gr;
      ctx.beginPath();
      for (let n = n0; n <= n1; n++) {
        if (o.gaps && hash(n, o.seed + 5) < o.gaps) continue;
        const cu = n * o.sp + (hash(n, o.seed) - 0.5) * o.sp * 0.5;
        const hw = (o.w[0] + hash(n, o.seed + 1) * (o.w[1] - o.w[0])) * (o.mid ? 1 : 0.9);
        const h = o.h[0] + hash(n, o.seed + 2) * (o.h[1] - o.h[0]);
        const x0 = sx(cu - hw), x1 = sx(cu + hw), xc = sx(cu), ty = base - h * S, w = x1 - x0;
        ctx.moveTo(x0, base + 1);
        ctx.bezierCurveTo(x0 + w * 0.04, ty + (base - ty) * 0.25, x0 + w * 0.2, ty, xc, ty);
        ctx.bezierCurveTo(x1 - w * 0.2, ty, x1 - w * 0.04, ty + (base - ty) * 0.25, x1, base + 1);
        ctx.closePath();
        tops.push([n, xc, ty, w, base]);
      }
      ctx.fill();
      ctx.fillStyle = o.under; ctx.fillRect(-mx, base, W + 2 * mx, H + my - base);
      if (!o.mid) return;
      const c = v.c;
      // 披麻皴: a few hemp-fibre strokes down some pillars; a pine on a few caps
      ctx.strokeStyle = hexA(c.mid0, 0.5); ctx.lineWidth = Math.max(0.8, S * 0.025);
      ctx.beginPath();
      for (const [n, xc, ty, w, b] of tops) {
        if (hash(n, 21) < 0.45) continue;
        for (const k of [-0.18, 0.14]) {
          const x = xc + w * k, y0 = ty + (b - ty) * 0.12, y1 = ty + (b - ty) * 0.55;
          ctx.moveTo(x, y0); ctx.bezierCurveTo(x - w * 0.03, y0 + (y1 - y0) * 0.3, x + w * 0.03, y0 + (y1 - y0) * 0.6, x - w * 0.02, y1);
        }
      }
      ctx.stroke();
      ctx.fillStyle = c.pine; ctx.strokeStyle = c.pine; ctx.lineWidth = Math.max(1, S * 0.04);
      for (const [n, xc, ty] of tops) {
        if (hash(n, 33) < 0.6) continue;
        const d = hash(n, 34) < 0.5 ? -1 : 1, k = S / 31;
        ctx.beginPath(); ctx.moveTo(xc, ty + 1); ctx.quadraticCurveTo(xc + d * 6 * k, ty - 6 * k, xc + d * 16 * k, ty - 9 * k); ctx.stroke();
        for (const [ex, ey, rx, ry] of [[18, -10.4, 7, 2], [11, -6, 5, 1.7], [5, -2.5, 3.4, 1.4]]) {
          ctx.beginPath(); ctx.ellipse(xc + d * ex * k, ty + ey * k, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      // long cloud wisps drifting between the pillars
      ctx.fillStyle = hexA(c.cloud, 0.9);
      for (let n = Math.floor(n0 / 3); n <= Math.ceil(n1 / 3); n++) {
        if (hash(n, 41) < 0.35) continue;
        const cu = n * o.sp * 3 + hash(n, 42) * o.sp, x = sx(cu);
        const y = base - (1.2 + hash(n, 43) * 1.2) * S, len = (2.2 + hash(n, 44) * 2.5) * S, th = S * 0.18;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.bezierCurveTo(x + len * 0.3, y - th, x + len * 0.7, y - th * 0.4, x + len, y - th * 0.6);
        ctx.bezierCurveTo(x + len * 0.8, y + th * 0.2, x + len * 0.4, y + th * 0.9, x + len * 0.12, y + th * 0.7);
        ctx.closePath(); ctx.fill();
      }
    }

    // the 石青 river: drawn as Ma Yuan drew water, rows of line patterns, with the moon's reflection
    function water(v, ox) {
      const { ctx, W, H, S, Y, cam, t, c } = { ...v, c: v.c };
      const top = Y(1);
      if (top >= H) return;
      vband(ctx, v.DPR, [[0, c.water0], [1, c.water1]], W, top, 2.2 * S);
      if (top + 2.2 * S < H) { ctx.fillStyle = c.water1; ctx.fillRect(0, top + 2.2 * S, W, H - top - 2.2 * S); }
      const ww = S * 1.25, rh = S * 0.31, off = ((cam.x * S) % ww + ww) % ww;
      ctx.strokeStyle = c.wline; ctx.lineWidth = Math.max(0.8, S * 0.026);
      let row = 0;
      for (let y = top + rh * 0.55; y < H + rh; y += rh, row++) {
        const drift = Math.sin(t * 0.8 + row) * ww * 0.06 + (row % 2) * ww * 0.5;
        for (const [dy, a, s] of [[-0.24, 0.75, -1], [0.26, 0.55, 1]]) {
          ctx.globalAlpha = a * (row === 0 ? 1 : 0.9);
          ctx.beginPath();
          for (let x = -ww - off + drift; x < W + ww; x += ww) {
            const yy = y + dy * rh;
            ctx.moveTo(x, yy);
            ctx.quadraticCurveTo(x + ww / 4, yy + s * rh * 0.36, x + ww / 2, yy);
            ctx.quadraticCurveTo(x + ww * 3 / 4, yy - s * rh * 0.36, x + ww, yy);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // the crest along the top of the river
      ctx.strokeStyle = c.wcrest; ctx.lineWidth = Math.max(1, S * 0.035); ctx.globalAlpha = 0.85;
      ctx.beginPath();
      const cw = ww / 2;
      for (let x = -cw - ((cam.x * S) % cw + cw) % cw; x < W + cw; x += cw) {
        ctx.moveTo(x, top + 2); ctx.quadraticCurveTo(x + cw / 4, top - S * 0.06, x + cw / 2, top + 2); ctx.quadraticCurveTo(x + cw * 3 / 4, top + S * 0.08, x + cw, top + 2);
      }
      ctx.stroke();
      // the reflection: short strokes of bare silk under the disc
      ctx.strokeStyle = c.refl; ctx.lineWidth = Math.max(1.2, S * 0.045);
      ctx.beginPath();
      [[0.75, 0.4], [0.5, 0.6], [0.7, 0.8], [0.35, 1.0]].forEach(([w, dy], i) => { const y = top + dy * S * 0.55, hw = w * S * 0.38; ctx.moveTo(ox - hw + Math.sin(t + i) * 2, y); ctx.lineTo(ox + hw + Math.sin(t + i) * 2, y); });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // the play layer: rock in full ink, 斧劈皴 on the faces, a bare-silk rim on every walkable top
    function tiles(v) {
      const { ctx, W, S, X, Y, cam, world, c } = v;
      const x0 = Math.max(0, Math.floor(cam.x - W / 2 / S) - 1), x1 = Math.min(world.w - 1, Math.ceil(cam.x + W / 2 / S) + 1);
      const lw = Math.max(2, S * 0.07);
      const rock = ctx.createLinearGradient(0, Y(cam.y + 5), 0, Y(0));
      rock.addColorStop(0, K.ink); rock.addColorStop(1, c.face);
      const open = ch => ch !== '#' && ch !== 'b';
      const cun = [], rims = [], sides = [];
      ctx.fillStyle = rock;
      ctx.beginPath();
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = 0; cy < world.h; cy++) {
          if (world.cell(cx, cy) !== '#') continue;
          let top = cy;
          while (top + 1 < world.h && world.cell(cx, top + 1) === '#') top++;
          ctx.rect(Math.floor(X(cx)) - 0.5, Math.floor(Y(top + 1)), Math.ceil(S) + 1, Math.ceil((top + 1 - cy) * S) + 1);
          if (open(world.cell(cx, top + 1))) rims.push([cx, top + 1]);
          for (let y = cy; y <= top; y++) {
            for (const d of [-1, 1]) if (open(world.cell(cx + d, y)) && world.cell(cx + d, y) !== '=') sides.push([cx, y, d]);
            // axe-cut texture: never in the top quarter of a cell you can stand on
            if (hash(cx * 31 + y, 7) < 0.55) {
              const fy = y === top && open(world.cell(cx, top + 1)) ? 0.35 + hash(cx, y) * 0.35 : 0.1 + hash(cx, y) * 0.6;
              cun.push([cx + 0.15 + hash(cx, y + 9) * 0.6, y + 1 - fy, 0.5 + hash(cx + y, 3) * 0.6, hash(cx * 3 + y, 11) < 0.3]);
            }
          }
          cy = top;
        }
      }
      ctx.fill();
      ctx.fillStyle = c.cun; ctx.strokeStyle = c.cun; ctx.lineWidth = Math.max(1, S * 0.035);
      for (const [x, y, k, line] of cun) {
        const sx = X(x), sy = Y(y), u = S * 0.3 * k;
        if (line) { ctx.beginPath(); ctx.moveTo(sx - u * 0.8, sy + u * 0.15); ctx.lineTo(sx + u * 0.9, sy); ctx.stroke(); continue; }
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + u * 0.6, sy + u); ctx.lineTo(sx + u * 0.38, sy + u * 1.05); ctx.closePath(); ctx.fill();
      }
      // rims: bare silk on tops; a thinner line on cliff faces (you always see the edge)
      ctx.fillStyle = c.rim;
      for (const [cx, y] of rims) ctx.fillRect(X(cx) - 1, Y(y), S + 2, lw);
      ctx.globalAlpha = 0.55;
      for (const [cx, y, d] of sides) ctx.fillRect(d < 0 ? X(cx) : X(cx + 1) - lw * 0.5, Y(y + 1), lw * 0.5, S);
      ctx.globalAlpha = 1;
      for (let cx = x0; cx <= x1; cx++) for (let cy = 0; cy < world.h; cy++) {
        const ch = world.cell(cx, cy);
        if (ch === 'T' && world.cell(cx, cy - 1) !== 'T') thorns(v, cx, cy);
        else if (ch === '=') bridgeCell(v, cx, cy);
      }
      boats(v);
      for (const b of world.burnt) {
        const age = world.clock - b.t;
        if (age > 3) continue;
        ctx.fillStyle = 'rgba(40,24,16,' + (0.6 * (1 - age / 3)).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(X(b.x0 + 0.5), Y(b.y0 + 0.08), S * 0.55, S * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // a thorn hedge: an ink bush with spikes and ochre berries; no rim, so it never reads as a ledge
    function thorns(v, cx, cy) {
      const { ctx, S, X, Y, world } = v;
      let top = cy; while (world.cell(cx, top + 1) === 'T') top++;
      const x = X(cx), w = S, yb = Y(cy), yt = Y(top + 1);
      ctx.fillStyle = K.ink;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.04, yb);
      ctx.lineTo(x + w * 0.06, yt + S * 0.3);
      const lobes = 3;
      for (let i = 0; i < lobes; i++) {
        const a = x + w * (0.06 + i * 0.3), b = x + w * (0.06 + (i + 1) * 0.3);
        ctx.quadraticCurveTo((a + b) / 2, yt - S * (0.05 + (i % 2) * 0.1), b, yt + S * 0.28);
      }
      ctx.lineTo(x + w * 0.96, yb); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(1, S * 0.035);
      ctx.beginPath();
      const n = 6 + (top - cy) * 5;
      for (let i = 0; i < n; i++) {
        const side = i % 3, f = hash(cx * 7 + i, cy);
        let px, py, dx, dy;
        if (side === 0) { px = x + w * (0.1 + f * 0.8); py = yt + S * 0.12; dx = (f - 0.5) * S * 0.2; dy = -S * 0.2; }
        else { const s = side === 1 ? -1 : 1; px = x + w * (s < 0 ? 0.06 : 0.94); py = yt + S * 0.3 + f * (yb - yt - S * 0.4); dx = s * S * 0.18; dy = -S * 0.08; }
        ctx.moveTo(px, py); ctx.lineTo(px + dx, py + dy);
      }
      ctx.stroke();
      ctx.fillStyle = K.ochre;
      for (let i = 0; i < 4 + (top - cy) * 3; i++) {
        const f = hash(cx + i, cy * 5 + 1), g = hash(cx * 2 + i, cy + 3);
        ctx.beginPath(); ctx.arc(x + w * (0.15 + f * 0.7), yt + S * 0.15 + g * (yb - yt - S * 0.3), Math.max(1, S * 0.035), 0, Math.PI * 2); ctx.fill();
      }
    }
    // 木 grown into a plank bridge (ochre planks, rope lashings); 土 into a mound
    function bridgeCell(v, cx, cy) {
      const { ctx, S, X, Y, world, c } = v;
      const b = world.bridges.find(b => cx >= b.x0 && cx < b.x1 && cy + 1 === b.y);
      const age = b ? world.clock - b.t : 9, n = b ? b.x1 - b.x0 : 1, i = b ? cx - b.x0 : 0;
      const grow = clamp(age / 0.5 * n - i, 0, 1);
      if (grow <= 0) return;
      const x = X(cx), y = Y(cy + 1), earth = b && b.el === 'earth', th = S * 0.36;
      ctx.fillStyle = earth ? '#8a6a3e' : '#7a5230';
      ctx.fillRect(x, y, S * grow + 0.5, th);
      ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.beginPath();
      for (let k = 0.25; k < grow; k += 0.25) { ctx.moveTo(x + S * k, y); ctx.lineTo(x + S * k, y + th); }
      ctx.moveTo(x, y + th); ctx.lineTo(x + S * grow, y + th);
      ctx.stroke();
      if (!earth) {
        ctx.strokeStyle = '#d8c79e'; ctx.lineWidth = Math.max(1, S * 0.025);
        ctx.beginPath(); for (let k = 0.12; k < grow; k += 0.5) { ctx.moveTo(x + S * k, y + th * 0.2); ctx.lineTo(x + S * (k + 0.06), y + th * 0.8); } ctx.stroke();
      }
      ctx.fillStyle = c.rim; ctx.fillRect(x, y, S * grow, Math.max(2, S * 0.06));
      if (b && i === 0) {
        ctx.fillStyle = 'rgba(245,236,214,0.9)'; ctx.font = v.font(S * 0.28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.ch, x + S * 0.5, y + th * 0.6);
      }
    }
    // the 乌篷船 at the start: an ink hull with a bare-silk deck line, a woven awning, a punt pole
    function boats(v) {
      const { ctx, S, X, Y, world, c } = v;
      for (let cy = 0; cy < world.h; cy++) {
        let cx = 0;
        while (cx < world.w) {
          if (world.cell(cx, cy) !== 'b') { cx++; continue; }
          let e = cx; while (world.cell(e + 1, cy) === 'b') e++;
          const x0 = X(cx) - S * 0.3, x1 = X(e + 1) + S * 0.4, top = Y(cy + 1), bot = Y(cy + 0.45), w = x1 - x0;
          // the pole, behind the hull
          ctx.strokeStyle = K.ink; ctx.lineWidth = Math.max(1.5, S * 0.07);
          ctx.beginPath(); ctx.moveTo(x1 - w * 0.06, top - S * 1.4); ctx.lineTo(x1 + w * 0.03, Y(0.2)); ctx.stroke();
          // the awning near the stern (not solid: no rim)
          const ax = x0 + w * 0.12, aw = w * 0.36;
          ctx.fillStyle = '#3a3530';
          ctx.beginPath(); ctx.moveTo(ax, top); ctx.bezierCurveTo(ax + aw * 0.05, top - S * 0.55, ax + aw * 0.95, top - S * 0.55, ax + aw, top); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#6b6157'; ctx.lineWidth = Math.max(0.8, S * 0.025);
          ctx.beginPath(); for (const k of [0.3, 0.5, 0.7]) { ctx.moveTo(ax + aw * k, top); ctx.lineTo(ax + aw * (k + (k - 0.5) * 0.3), top - S * 0.4); } ctx.stroke();
          // the hull: a crescent
          ctx.fillStyle = K.ink;
          ctx.beginPath();
          ctx.moveTo(x0, top - S * 0.08);
          ctx.bezierCurveTo(x0 + w * 0.17, top + S * 0.05, x1 - w * 0.3, top + S * 0.05, x1, top - S * 0.18);
          ctx.lineTo(x1 - w * 0.05, top + S * 0.12);
          ctx.bezierCurveTo(x1 - w * 0.3, bot, x0 + w * 0.2, bot, x0 + w * 0.03, top + S * 0.18);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = c.rim; ctx.lineWidth = Math.max(2, S * 0.06);
          ctx.beginPath(); ctx.moveTo(X(cx) - S * 0.1, top + 1); ctx.lineTo(X(e + 1) + S * 0.1, top + 1); ctx.stroke();
          cx = e + 1;
        }
      }
    }

    // 轻功 clouds: 祥云, a lobed cloud of bare silk outlined in ink with a curl; faint once used
    function clouds(v) {
      const { ctx, S, X, Y, world, t, c } = v;
      const p = v.me();
      for (const cl of world.clouds) {
        const used = p.src.has(cl.id) && !p.grounded;
        const pulse = cl.t > 0 ? 1 + cl.t * 0.4 : 1 + Math.sin(t * 1.5 + cl.x) * 0.03;
        const x = X(cl.x), y = Y(cl.y), r = S * 0.3 * pulse;
        ctx.globalAlpha = used ? 0.3 : 0.95;
        ctx.fillStyle = c.cloud; ctx.strokeStyle = 'rgba(29,27,26,.6)'; ctx.lineWidth = Math.max(1, S * 0.03);
        ctx.beginPath();
        ctx.moveTo(x - r * 1.7, y + r * 0.45);
        ctx.bezierCurveTo(x - r * 2.0, y - r * 0.2, x - r * 1.2, y - r * 0.6, x - r * 0.75, y - r * 0.25);
        ctx.bezierCurveTo(x - r * 0.6, y - r * 1.2, x + r * 0.6, y - r * 1.2, x + r * 0.65, y - r * 0.3);
        ctx.bezierCurveTo(x + r * 1.2, y - r * 0.7, x + r * 2.0, y - r * 0.1, x + r * 1.7, y + r * 0.45);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - r * 0.05, y - r * 0.25, r * 0.32, Math.PI * 0.1, Math.PI * 1.7); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + r * 1.15, y + r * 0.1, r * 0.2, Math.PI * 1.1, Math.PI * 2.6); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // gems: discs of jade (璧) with a hole; the dusk ones glow
    function jade(v, g, col, glows) {
      const { ctx, S, X, Y, t } = v;
      const sx = X(g.x), sy = Y(g.y) + Math.sin(t * 2 + g.x) * S * 0.05, r = S * 0.16;
      ctx.save();
      if (glows) { ctx.globalAlpha = v.duskF; ctx.shadowColor = '#c9b6ff'; ctx.shadowBlur = S * 0.6; }
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(29,27,26,.75)'; ctx.lineWidth = Math.max(1, S * 0.025);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.arc(sx, sy, r * 0.36, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.36, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(sx, sy, r * 0.7, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      ctx.restore();
    }

    // the pavilion (亭): upswept eaves edged in gilt, a gilt finial and lantern; the character it wants
    // hangs above it as a ghost, and a faint gilt beam marks it from anywhere on the isle
    const PAV = {
      roof: new Path2D('M678,236 C694,236 712,232 728,222 C738,215 744,206 748,198 L756,198 C760,206 766,215 776,222 C792,232 810,236 826,236 C820,240 812,242 804,242 L700,242 C692,242 684,240 678,236 Z'),
      curls: new Path2D('M678,236 c-3,-1 -5,-4 -4,-7 M826,236 c3,-1 5,-4 4,-7'),
      edge: new Path2D('M684,240.2 C690,241.6 696,242 700,242 L804,242 C808,242 816,241.6 822,239.8'),
      rafters: new Path2D('M716,230 L748,203 M788,230 L756,203 M736,232 L750,206 M768,232 L754,206'),
      rails: new Path2D('M712,264 L792,264 M712,270.5 L792,270.5'),
      balusters: new Path2D('M720,264 V289 M728,264 V289 M736,264 V289 M768,264 V289 M776,264 V289 M784,264 V289'),
    };
    function pavilion(v) {
      const { ctx, S, X, Y, world, t } = v;
      const x = X(world.pav.x), y = Y(world.pav.y), k = S * 0.8 / 31, want = world.L.want;
      if (world.phase === 'play') {
        const g = ctx.createLinearGradient(0, y - S * 9, 0, y - S * 2.4);
        g.addColorStop(0, 'rgba(233,196,106,0)'); g.addColorStop(1, 'rgba(233,196,106,.5)');
        ctx.globalAlpha = 0.35 + Math.sin(t * 2) * 0.06; ctx.fillStyle = g; ctx.fillRect(x - S * 0.4, y - S * 9, S * 0.8, S * 6.6); ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-752, -289);
      glow(ctx, 752, 252, 28, 0.6);
      ctx.fillStyle = K.ink; ctx.fillRect(710, 240, 4.2, 49); ctx.fillRect(790, 240, 4.2, 49);
      ctx.strokeStyle = K.ink; ctx.lineWidth = 1.4; ctx.stroke(PAV.rails);
      ctx.lineWidth = 0.9; ctx.stroke(PAV.balusters);
      ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(752, 242); ctx.lineTo(752, 246.5); ctx.stroke();
      ctx.fillStyle = K.gilt; ctx.beginPath(); ctx.ellipse(752, 252, 4, 5.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = K.ink; ctx.fill(PAV.roof);
      ctx.lineWidth = 1.6; ctx.stroke(PAV.curls);
      ctx.strokeStyle = K.gilt; ctx.lineWidth = 1.2; ctx.stroke(PAV.edge);
      ctx.strokeStyle = '#4a443c'; ctx.lineWidth = 0.7; ctx.stroke(PAV.rafters);
      ctx.strokeStyle = K.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(752, 198); ctx.lineTo(752, 189); ctx.stroke();
      ctx.fillStyle = K.gilt; ctx.beginPath(); ctx.arc(752, 187, 2.6, 0, Math.PI * 2); ctx.fill();
      if (world.phase === 'play') {
        glow(ctx, 752, 152, 36, 0.6);
        ctx.font = v.font(46); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.22; ctx.fillStyle = K.vermilion; ctx.fillText(want, 752, 152); ctx.globalAlpha = 0.9;
        ctx.setLineDash([2, 2.4]); ctx.strokeStyle = K.gilt; ctx.lineWidth = 0.8; ctx.strokeText(want, 752, 152); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    function glow(ctx, x, y, r, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(233,196,106,' + a + ')'); g.addColorStop(1, 'rgba(233,196,106,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // ---------- the stones: 活字 type blocks ----------
    // The block keeps the stone's box exactly (the bevel is inside it): what you see is what you hit.
    function block(ctx, sx, sy, s, ch, color, o) {
      const d = s * 4 / 36, f = s - d, lw = Math.max(1, s / 36);
      ctx.lineJoin = 'round';
      ctx.fillStyle = K.stone.side; ctx.strokeStyle = K.ink; ctx.lineWidth = lw * 0.8;
      ctx.beginPath(); ctx.moveTo(sx + f, sy); ctx.lineTo(sx + s, sy + d); ctx.lineTo(sx + s, sy + s); ctx.lineTo(sx + f, sy + f); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = K.stone.bottom;
      ctx.beginPath(); ctx.moveTo(sx, sy + f); ctx.lineTo(sx + f, sy + f); ctx.lineTo(sx + s, sy + s); ctx.lineTo(sx + d, sy + s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = K.stone.face;
      rr(ctx, sx, sy, f, f, f / 16); ctx.fill();
      ctx.strokeStyle = o.hi ? K.gamboge : K.ink; ctx.lineWidth = o.hi ? Math.max(2.5, s * 0.075) : lw; ctx.stroke();
      ctx.strokeStyle = K.stone.grain; ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.beginPath();
      ctx.moveTo(sx + f * 0.1, sy + f * 0.19); ctx.bezierCurveTo(sx + f * 0.35, sy + f * 0.16, sx + f * 0.6, sy + f * 0.22, sx + f * 0.9, sy + f * 0.17);
      ctx.moveTo(sx + f * 0.1, sy + f * 0.75); ctx.bezierCurveTo(sx + f * 0.4, sy + f * 0.71, sx + f * 0.6, sy + f * 0.78, sx + f * 0.9, sy + f * 0.73);
      ctx.stroke();
      ctx.font = o.font(f * 0.84); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const off = Math.max(1, f / 32);
      ctx.fillStyle = K.umber; ctx.fillText(ch, sx + f / 2 + off, sy + f * 0.52 + off);
      ctx.fillStyle = color; ctx.fillText(ch, sx + f / 2, sy + f * 0.52);
    }
    // the paper slip under a stone on the ground, tilted a little, with the pinyin (13 px or more)
    function slip(ctx, cx, y, text, tilt, px, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '500 ' + px.toFixed(0) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
      const w = ctx.measureText(text).width + px * 0.8, h = px * 1.45;
      ctx.translate(cx, y + h * 0.42); ctx.rotate(tilt);
      ctx.fillStyle = K.stone.slip; ctx.strokeStyle = K.ink; ctx.lineWidth = 0.8;
      ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = K.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, h * 0.04);
      ctx.restore();
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
        // things (§3.7): a thrown stone opens into its thing in the air and folds back as it lands
        const f = root.WThings ? root.WThings.fold(k, v) : 0;
        // level 2 (overhead pose only in this look): the thing you carry stands on your hands
        if (k.state === 'held' && root.WThings && k.holder === p) {
          const kk = v.PH * S / 44 / 0.68, shake = p.stun > 0 ? Math.sin(v.t * 60) * 1.2 : 0;
          const o = { t: v.t, ink: K.ink, paper: K.stone.slip, el: v.elOf(k.ch), red: K.vermilion, gold: K.gamboge, font: v.font };
          if (root.WThings.carried(ctx, k.ch, 'carry', X(x) + shake, Y(y - v.HOLD_Y), kk, p.face, o)) continue;
        }
        if (f > 0) {
          const o = { t: v.t, ink: K.ink, paper: K.stone.slip, el: v.elOf(k.ch), red: K.vermilion, gold: K.gamboge, font: v.font };
          const cx = sx + s / 2, cy = sy + s / 2;
          if (f < 1) { const q = s * (1 - f); block(ctx, cx - q / 2, cy - q / 2, q, v.shapeOf(k), v.elOf(k.ch).b, { hi: false, font: v.font }); }
          root.WThings.draw(ctx, k.ch, cx, cy, s * 1.15 * f, o);
          if (f > 0.5) root.WThings.tag(ctx, k.ch, cx, cy, s * f, o);
          continue;
        }
        block(ctx, sx, sy, s, v.shapeOf(k), v.elOf(k.ch).b, { hi: l.mode === 'grab' && l.k === k, font: v.font });
        let label = 0;
        if (k.state === 'loose' && k.grounded && !k.support && v.labels !== 'card') {
          label = v.labels === 'near' ? clamp(1 - (Math.abs(x - mpx) - 3) / 3, 0, 1) : 1;
        }
        if (label > 0.02) slip(ctx, sx + s / 2, Y(y) - s * 0.06, v.words(k.ch).py, (hash(k.id || 1, 5) - 0.5) * 0.1, Math.max(12, S * 0.24), label);
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
    // One pose, drawn twice: first fattened by `rim` in gamboge (the "you" outline), then in ink.
    function paint(g, ops, t, sp, runFrame, rim) {
      const ink = col => rim ? K.gamboge : (col || K.ink);
      const lw = w => w + 2 * rim;
      for (const op of ops) {
        const [kind] = op;
        if (kind === 'R') { g.save(); g.translate(op[2], op[3]); g.rotate(op[1] * Math.PI / 180); g.translate(-op[2], -op[3]); paint(g, op[4], t, sp, runFrame, rim); g.restore(); continue; }
        if (kind === 'f') {
          g.fillStyle = ink(op[2]); g.fill(path(op[1]));
          if (rim) { g.strokeStyle = K.gamboge; g.lineWidth = 2 * rim; g.stroke(path(op[1])); }
          continue;
        }
        if (kind === 's') { g.strokeStyle = ink(op[3]); g.lineWidth = lw(op[2]); g.stroke(path(op[1])); continue; }
        if (kind === 'L') { const legs = RUN_LEGS[runFrame]; g.strokeStyle = ink(); g.lineWidth = lw(2.4); g.stroke(path(legs[0])); g.stroke(path(legs[1])); continue; }
        if (kind === 'r') {
          // the ribbons carry the 轻功: they flutter with speed, from the sash knot
          const [px, py] = startOf(op[1]);
          g.save(); g.translate(px, py); g.rotate(Math.sin(t * (6 + sp) + op[2] * 3) * (0.05 + Math.min(0.12, sp * 0.015))); g.translate(-px, -py);
          g.strokeStyle = ink(K.vermilion); g.lineWidth = lw(op[2]); g.stroke(path(op[1])); g.restore(); continue;
        }
        if (kind === 'c') { g.fillStyle = ink(); g.beginPath(); g.arc(op[1], op[2], 3.4 + rim, 0, Math.PI * 2); g.fill(); continue; }
        if (kind === 'h') {
          g.save(); g.translate(op[1], op[2]); g.rotate(op[3] * Math.PI / 180);
          g.fillStyle = ink('#24211e'); g.fill(HAT);
          if (rim) { g.strokeStyle = K.gamboge; g.lineWidth = 2 * rim; g.stroke(HAT); } else { g.strokeStyle = '#8b6b45'; g.lineWidth = 0.6; g.stroke(HAT_RIBS); }
          g.restore();
        }
      }
    }
    function hero(v) {
      const { ctx, S, X, Y, world, t } = v;
      const p = v.me();
      const [x, y] = v.posOf(p, v.a);
      // where you will land: an ink shadow ringed in gamboge and a dotted gamboge line; over water, vermilion
      if (!p.grounded) {
        const fy = world.floorUnder(x, v.PW, y);
        const wet = fy < 1.01, gy = wet ? 1 : fy, h = y - gy;
        const col = wet ? K.vermilion : K.gamboge;
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, S * 0.035); ctx.lineCap = 'round';
        ctx.setLineDash([0, Math.max(4, S * 0.11)]); ctx.beginPath(); ctx.moveTo(X(x), Y(y) + 2); ctx.lineTo(X(x), Y(gy) - 3); ctx.stroke(); ctx.setLineDash([]);
        const rx = S * 0.3 * (1 - Math.min(0.5, h / 10));
        ctx.fillStyle = wet ? 'rgba(194,58,43,.75)' : K.ink; ctx.lineWidth = Math.max(1, S * 0.02);
        ctx.beginPath(); ctx.ellipse(X(x), Y(gy) + 1, rx, S * 0.075, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // 轻功 ready: a gamboge ring under your feet while you can still leap
      const cap = p.hold ? world.qi.carry : world.qi.chain;
      if (!p.grounded && p.qi > 0 && p.chain < cap) {
        ctx.strokeStyle = 'rgba(224,165,38,.9)'; ctx.lineWidth = Math.max(1.5, S * 0.045);
        ctx.beginPath(); ctx.ellipse(X(x), Y(y) + 2, S * 0.3, S * 0.085, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.leapt && p.vy > 0 && Math.random() < 0.7) v.fx.push({ x: x - p.face * 0.15 + (Math.random() - 0.5) * 0.2, y: y + 0.45, vx: 0, vy: -0.4, life: 0.45, max: 0.45, kind: 'wisp', size: 0.07, g: 0 });
      // the figure, with a gamboge rim round its silhouette: "you"
      const pose = heroPose(v, p);
      const k = v.PH * S / 44;
      const shake = p.stun > 0 ? Math.sin(t * 60) * 1.2 : 0;
      const face = pose === 'wall' ? p.wall : p.face;
      ctx.save();
      ctx.translate(X(x) + shake, Y(y)); ctx.scale(k * face, k);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (pose === 'wall') ctx.translate(2.4, 4);
      if (pose === 'leap') ctx.translate(0, 6);
      const runFrame = Math.floor(t * 8) % 2, sp = Math.hypot(p.vx, p.vy);
      const rim = Math.max(1.5, S * 0.034) / k;
      paint(ctx, POSES[pose], t, sp, runFrame, rim);
      paint(ctx, POSES[pose], t, sp, runFrame, 0);
      if (pose === 'land') { ctx.fillStyle = 'rgba(236,224,198,.8)'; ctx.beginPath(); ctx.ellipse(-12, -1.2, 4.6, 1.4, 0, 0, Math.PI * 2); ctx.ellipse(12.4, -1, 4, 1.2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }

    return { draw, heroPose, block };
  }

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  root.WInk = { create, TIME, K, POSES };
})(window);
