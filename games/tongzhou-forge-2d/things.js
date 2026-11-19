// Glyph Isles 2D: things level 1 (docs/ART-DIRECTION.md §3.7). A stone is a square block at rest; when it is
// thrown, or when it acts, it opens into the thing it means: a log, a fireball, a sun, a crescent, a
// splash, a clod. One drawer for both painted looks (ink.js and cut.js); flat fills only, so it is safe
// for One Stroke. The glyph never disappears: it rides on a small vermilion tag. Renderer only.
(function (root) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // which characters have a thing (the forged ones stay blocks: 明 is offered, not thrown around)
  const THINGS = new Set(['木', '火', '日', '月', '水', '土']);
  const has = ch => THINGS.has(ch);

  // How open a thrown stone is: it opens quickly after leaving the hands and folds back as it comes down
  // to the ground. State lives here (per stone id), not in the sim.
  const born = new Map();
  function fold(k, v) {
    if (!k.flying || k.state !== 'loose' || !has(k.ch)) { born.delete(k.id); return 0; }
    if (!born.has(k.id)) born.set(k.id, v.t);
    const open = clamp((v.t - born.get(k.id)) / 0.1, 0, 1);
    const h = k.y - v.world.floorUnder(k.x, v.SW, k.y);
    return open * clamp((h - 0.15) / 0.7, 0, 1);
  }

  // The thing, centred on (cx, cy), about one stone big. o: { t, ink, paper, el: {a,b}, red, gold, spin }
  function draw(ctx, ch, cx, cy, s, o) {
    if (!has(ch)) return false;
    const u = s, t = o.t || 0, lw = Math.max(1.5, s * 0.06);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = o.ink;
    switch (ch) {
      case '木': {   // a log turning end over end
        ctx.rotate(t * 9);
        ctx.fillStyle = o.el.b; ctx.fillRect(-u * 0.5, -u * 0.17, u, u * 0.34); ctx.strokeRect(-u * 0.5, -u * 0.17, u, u * 0.34);
        ctx.fillStyle = o.paper;
        for (const sx of [-0.5, 0.5]) { ctx.beginPath(); ctx.ellipse(sx * u, 0, u * 0.07, u * 0.17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        break;
      }
      case '火': {   // a fireball with a short tail (it leans back from where it is going)
        ctx.rotate(-0.5 + Math.sin(t * 24) * 0.08);
        ctx.fillStyle = o.red;
        ctx.beginPath();
        ctx.moveTo(u * 0.4, 0); ctx.bezierCurveTo(u * 0.3, -u * 0.3, -u * 0.05, -u * 0.34, -u * 0.62, -u * 0.12);
        ctx.bezierCurveTo(-u * 0.3, -u * 0.04, -u * 0.34, u * 0.04, -u * 0.58, u * 0.16);
        ctx.bezierCurveTo(-u * 0.1, u * 0.34, u * 0.3, u * 0.3, u * 0.4, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = o.gold; ctx.beginPath(); ctx.ellipse(u * 0.1, 0, u * 0.18, u * 0.11, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case '日': {   // a little sun: a gamboge disc with ticks
        ctx.rotate(t * 2);
        ctx.strokeStyle = o.ink; ctx.lineWidth = lw * 0.8;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * u * 0.34, Math.sin(a) * u * 0.34); ctx.lineTo(Math.cos(a) * u * 0.5, Math.sin(a) * u * 0.5); ctx.stroke(); }
        ctx.lineWidth = lw; ctx.fillStyle = o.gold; ctx.beginPath(); ctx.arc(0, 0, u * 0.27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case '月': {   // a crescent, spinning
        ctx.rotate(t * 7);
        ctx.fillStyle = o.paper;
        // outer circle R, inner circle r centred d to the right: the crescent is what is left of the outer
        const R = u * 0.4, r = u * 0.34, d = u * 0.16;
        const ix = (R * R - r * r + d * d) / (2 * d), iy = Math.sqrt(R * R - ix * ix);
        ctx.beginPath(); ctx.arc(0, 0, R, Math.atan2(iy, ix), Math.atan2(-iy, ix), false);
        ctx.arc(d, 0, r, Math.atan2(-iy, ix - d), Math.atan2(iy, ix - d), true);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case '水': {   // a splash: one big drop and three small ones
        ctx.fillStyle = o.el.b;
        const drop = (x, y, r) => { ctx.beginPath(); ctx.moveTo(x, y - r * 1.5); ctx.bezierCurveTo(x + r * 0.2, y - r * 0.6, x + r, y - r * 0.5, x + r, y + r * 0.2); ctx.arc(x, y + r * 0.2, r, 0, Math.PI); ctx.bezierCurveTo(x - r, y - r * 0.5, x - r * 0.2, y - r * 0.6, x, y - r * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke(); };
        const w = Math.sin(t * 10) * 0.03;
        drop(0, u * 0.06, u * 0.2);
        drop(-u * 0.34, -u * 0.1 + w * u, u * 0.09); drop(u * 0.34, -u * 0.12 - w * u, u * 0.09); drop(u * 0.04, -u * 0.38, u * 0.08);
        break;
      }
      case '土': {   // a clod with two flecks
        ctx.rotate(t * 4);
        ctx.fillStyle = o.el.b;
        ctx.beginPath(); ctx.moveTo(-u * 0.34, u * 0.08); ctx.lineTo(-u * 0.2, -u * 0.26); ctx.lineTo(u * 0.1, -u * 0.32); ctx.lineTo(u * 0.36, -u * 0.04); ctx.lineTo(u * 0.22, u * 0.28); ctx.lineTo(-u * 0.14, u * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = o.paper; ctx.fillRect(-u * 0.12, -u * 0.1, u * 0.08, u * 0.08); ctx.fillRect(u * 0.1, u * 0.06, u * 0.07, u * 0.07);
        break;
      }
    }
    ctx.restore();
    return true;
  }

  // The glyph's own tag: an 11/32 vermilion square with the character in paper, on the thing's lower right.
  function tag(ctx, ch, cx, cy, s, o) {
    const w = Math.max(15, s * 11 / 32 * 1.4), x = cx + s * 0.18, y = cy + s * 0.1;
    ctx.fillStyle = o.red; ctx.fillRect(x, y, w, w);
    ctx.fillStyle = o.paper; ctx.font = o.font(w * 0.82); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x + w / 2, y + w * 0.54);
  }

  root.WThings = { has, fold, draw, tag };
})(window);
