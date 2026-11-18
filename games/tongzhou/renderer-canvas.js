// River view on a plain 2D canvas, fake 3D by perspective scaling. Placeholder look at full
// device resolution (no pixel-ratio cap). Draws what it is given; holds no game rules.
const INK = '#23201b', PAPER = '#efe7d6', SEAL = '#b23a2b';
const TONE = { solve: '#2f7d5b', partial: '#b7791f', backfire: '#b23a2b', flavour: '#4a4438' };
const FONT = '"Noto Serif CJK SC","Songti SC","Noto Serif SC",Georgia,serif';

export function createRenderer(container) {
  const cv = document.createElement('canvas');
  container.appendChild(cv);
  const c = cv.getContext('2d');
  let W = 300, H = 200, dpr = 1;
  let hits = [];              // { id, x, y, r } from the last frame, for pick()
  const seenAt = new Map();   // id -> last drawn position, so effects can land where a thing was
  const ridges = [0, 1, 2].map(function (k) {
    const pts = [];
    let y = 0.5;
    for (let i = 0; i <= 60; i++) {
      y += (Math.sin(i * (1.7 + k) + k * 9) + Math.sin(i * 0.37 * (k + 2))) * 0.09;
      y = Math.max(0.1, Math.min(0.95, y));
      pts.push(y);
    }
    return pts;
  });

  function resize(w, h) {
    dpr = window.devicePixelRatio || 1;
    W = Math.max(50, w); H = Math.max(50, h);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }

  // Depth: 0 m is the boat, 480 m is the horizon. p is 1 at the boat and shrinks with distance.
  function proj(dist, lane) {
    const hy = H * 0.3, by = H * 0.74;
    const p = 1 / (1 + Math.max(0, dist) / 95);
    return { x: W / 2 + lane * W * 0.36 * p, y: hy + (by - hy) * p, p: p };
  }
  function lane(id) { return ((id * 7) % 5 - 2) / 2.6; }

  function disc(x, y, r, picture, alpha) {
    c.globalAlpha = alpha;
    c.fillStyle = 'rgba(35,32,27,.22)';
    c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.9, r * 0.22, 0, 0, 7); c.fill();
    c.fillStyle = '#fbf7ec'; c.strokeStyle = INK; c.lineWidth = Math.max(1, r * 0.07);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
    c.font = Math.round(r * 1.15) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = INK;
    c.fillText(picture, x, y + r * 0.06);
    c.globalAlpha = 1;
  }
  function label(text, x, y, size, color) {
    c.font = '600 ' + size + 'px ui-sans-serif,system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + size;
    c.fillStyle = 'rgba(251,247,236,.9)';
    c.fillRect(x - w / 2, y - size * 0.8, w, size * 1.6);
    c.fillStyle = color || INK;
    c.fillText(text, x, y);
  }

  function render(view, now) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    hits = [];
    const b = view.boat, hy = H * 0.3;
    const dark = view.aboard.some(function (a) { return a.kind === 'night'; });
    const foggy = view.aboard.some(function (a) { return a.kind === 'fog'; });

    // sky and far mountains
    let g = c.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, dark ? '#3b3f52' : '#e8dfca'); g.addColorStop(1, dark ? '#6c6f80' : '#d6cfbb');
    c.fillStyle = g; c.fillRect(0, 0, W, hy + 1);
    c.fillStyle = dark ? '#f1ead4' : SEAL;
    c.beginPath(); c.arc(W * 0.78, hy * 0.38, Math.min(W, H) * 0.05, 0, 7); c.fill();
    ridges.forEach(function (pts, k) {
      const shift = (b.distance * (0.004 + k * 0.004)) % 1;
      c.fillStyle = 'rgba(35,32,27,' + (0.1 + k * 0.1) + ')';
      c.beginPath(); c.moveTo(0, hy);
      for (let i = 0; i <= 60; i++) {
        const x = (i / 40 - shift) * W;
        c.lineTo(x, hy - pts[i] * hy * (0.75 - k * 0.2));
      }
      c.lineTo(W * 1.6, hy); c.closePath(); c.fill();
    });

    // banks and river
    c.fillStyle = dark ? '#7d7a6d' : '#cfc6ae'; c.fillRect(0, hy, W, H - hy);
    const farW = W * 0.05, nearW = W * 0.62;
    g = c.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, dark ? '#55616b' : '#b9cbc7'); g.addColorStop(1, dark ? '#2e4650' : '#5d8a8c');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(W / 2 - farW, hy); c.lineTo(W / 2 + farW, hy);
    c.lineTo(W / 2 + nearW, H); c.lineTo(W / 2 - nearW, H); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(35,32,27,.55)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W / 2 - farW, hy); c.lineTo(W / 2 - nearW, H);
    c.moveTo(W / 2 + farW, hy); c.lineTo(W / 2 + nearW, H); c.stroke();

    // ripples and bank reeds scroll with distance: this is what makes speed readable
    for (let k = 0; k < 16; k++) {
      const d = k * 34 - (b.distance % 34) - 20;
      if (d < -18) continue;
      const side = k % 2 ? 1 : -1, off = ((k * 37) % 10) / 10 - 0.5;
      const q = proj(d, off * 1.4);
      c.strokeStyle = 'rgba(251,247,236,' + (0.5 * q.p + 0.1) + ')'; c.lineWidth = 1 + 2 * q.p;
      c.beginPath(); c.moveTo(q.x - 34 * q.p, q.y); c.quadraticCurveTo(q.x, q.y - 5 * q.p, q.x + 34 * q.p, q.y); c.stroke();
      const r = proj(d + 12, side * 2.05);
      c.strokeStyle = 'rgba(35,32,27,' + (0.25 + 0.45 * r.p) + ')'; c.lineWidth = 1 + 2.5 * r.p;
      c.beginPath(); c.moveTo(r.x, r.y); c.lineTo(r.x + side * 4 * r.p, r.y - 30 * r.p);
      c.moveTo(r.x + 5 * r.p, r.y); c.lineTo(r.x - side * 3 * r.p, r.y - 22 * r.p); c.stroke();
    }

    // incoming things, far to near
    const inc = view.incoming.slice().sort(function (a, z) { return z.dist - a.dist; });
    const nearest = view.incoming.reduce(function (m, e) { return !m || e.dist < m.dist ? e : m; }, null);
    inc.forEach(function (e) {
      const q = proj(e.dist, lane(e.id) * 0.8), r = Math.max(7, Math.min(W, H) * 0.115 * q.p + 3);
      const y = q.y - r;
      disc(q.x, y, r, e.picture, e.kind === 'veiled' ? 0.55 : 1);
      if (e === nearest) {
        c.strokeStyle = SEAL; c.lineWidth = 2; c.setLineDash([5, 4]);
        c.beginPath(); c.arc(q.x, y, r + 5 + Math.sin(now / 260) * 1.5, 0, 7); c.stroke(); c.setLineDash([]);
      }
      if (e.label && r > 13) label(e.label + ' · ' + Math.round(e.dist) + ' m', q.x, y - r - 12, Math.max(10, Math.min(14, r * 0.5)));
      seenAt.set(e.id, { x: q.x, y: y });
      hits.push({ id: e.id, x: q.x, y: y, r: Math.max(24, r + 8) });
    });

    // the boat
    const bx = W / 2, by = H * 0.8, bw = Math.min(W * 0.46, 330), bh = Math.min(H * 0.2, 70);
    const bob = b.stopped ? 0 : Math.sin(now / 420) * 2.5;
    c.save(); c.translate(bx, by + bob);
    c.fillStyle = 'rgba(35,32,27,.25)';
    c.beginPath(); c.ellipse(0, bh * 0.55, bw * 0.55, bh * 0.2, 0, 0, 7); c.fill();
    c.fillStyle = '#6e4a2f'; c.strokeStyle = INK; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-bw / 2, -bh * 0.1); c.quadraticCurveTo(0, bh * 0.25, bw / 2, -bh * 0.1);
    c.quadraticCurveTo(bw * 0.42, bh * 0.55, bw * 0.3, bh * 0.55); c.lineTo(-bw * 0.3, bh * 0.55);
    c.quadraticCurveTo(-bw * 0.42, bh * 0.55, -bw / 2, -bh * 0.1); c.closePath(); c.fill(); c.stroke();
    // mast with the hold as three banners
    const mastH = Math.min(H * 0.36, 150);
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-bw * 0.36, bh * 0.05); c.lineTo(-bw * 0.36, -mastH); c.stroke();
    view.hold.forEach(function (h, i) {
      const s = Math.min(mastH / 3.4, 40), y = -mastH + i * (s + 3);
      c.fillStyle = h ? '#fbf7ec' : 'rgba(251,247,236,.25)'; c.strokeStyle = INK; c.lineWidth = 1.5;
      c.fillRect(-bw * 0.36 + 3, y, s, s); c.strokeRect(-bw * 0.36 + 3, y, s, s);
      if (h) {
        c.fillStyle = INK; c.font = Math.round(s * 0.74) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(h.char, -bw * 0.36 + 3 + s / 2, y + s / 2 + 1);
      }
    });
    // lantern: its glow is the 气
    c.fillStyle = 'rgba(233,196,106,' + (0.15 + 0.07 * b.qi) + ')';
    c.beginPath(); c.arc(bw * 0.4, -bh * 0.5, 6 + b.qi * 1.4, 0, 7); c.fill();
    c.fillStyle = b.qi > 0.05 ? '#e9c46a' : '#7a7466';
    c.beginPath(); c.arc(bw * 0.4, -bh * 0.5, 5, 0, 7); c.fill();
    c.restore();

    // troubles aboard, sitting on the deck with their chip marks
    const n = view.aboard.length, tr = Math.min(bh * 0.52, bw / Math.max(4, n + 1) / 2.2, 30);
    view.aboard.forEach(function (a, i) {
      const x = bx - bw * 0.14 + (i - (n - 1) / 2) * tr * 2.3 + bw * 0.08, y = by + bob - tr * 0.75;
      if (a.drainMul > 1.5) {
        c.strokeStyle = SEAL; c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, tr + 4 + Math.sin(now / 120) * 2, 0, 7); c.stroke();
      }
      disc(x, y, tr, a.picture, a.drainMul < 1 ? 0.7 : 1);
      for (let k = 0; k < 3; k++) {
        c.fillStyle = k < a.chips ? SEAL : 'rgba(35,32,27,.25)';
        c.beginPath(); c.arc(x + (k - 1) * tr * 0.5, y + tr + 7, 3, 0, 7); c.fill();
      }
      seenAt.set(a.id, { x: x, y: y });
      hits.push({ id: a.id, x: x, y: y, r: Math.max(24, tr + 6) });
    });

    // fog aboard dims the far half; night darkens everything
    if (foggy) {
      g = c.createLinearGradient(0, hy - 10, 0, H * 0.62);
      g.addColorStop(0, 'rgba(236,232,222,.92)'); g.addColorStop(1, 'rgba(236,232,222,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H * 0.62);
    }
    if (dark) { c.fillStyle = 'rgba(18,20,34,.34)'; c.fillRect(0, 0, W, H); }
    if (b.stopped) label('the boat is bogged', bx, H - 12, 12, SEAL);

    // effects
    view.fx.forEach(function (f) {
      const age = now - f.at, at = seenAt.get(f.targetId) || { x: bx, y: H * 0.5 };
      if (f.type === 'cast' && age < 700) {
        const k = age / 700, size = Math.min(W, H) * (0.5 - 0.3 * k);
        c.globalAlpha = 0.95; c.fillStyle = INK; c.font = Math.round(size) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(f.char, bx + (at.x - bx) * k, -size * 0.3 + (at.y + size * 0.3) * k * k);
        c.globalAlpha = 1;
      }
      if (f.type === 'outcome' && age > 550 && age < 4200) {
        c.globalAlpha = Math.min(1, (4200 - age) / 600);
        const size = Math.max(12, Math.min(17, W / 34));
        c.font = '600 ' + size + 'px ui-sans-serif,system-ui,sans-serif';
        const text = c.measureText(f.text).width > W * 0.92 ? f.text.slice(0, Math.floor(f.text.length * W * 0.9 / c.measureText(f.text).width)) + '…' : f.text;
        label(text, W / 2, hy * 0.5 - (age - 550) * 0.004, size, TONE[f.result]);
        c.globalAlpha = 1;
      }
      if (f.type === 'clear' && age < 900) {
        c.strokeStyle = TONE.solve; c.lineWidth = 4 * (1 - age / 900);
        c.beginPath(); c.arc(at.x, at.y, 14 + age * 0.09, 0, 7); c.stroke();
      }
      if (f.type === 'board' && age < 500) {
        c.fillStyle = 'rgba(178,58,43,' + 0.28 * (1 - age / 500) + ')'; c.fillRect(0, 0, W, H);
      }
      if (f.type === 'bond' && age < 1100) {
        const k = age / 1100;
        c.globalAlpha = 1 - k; c.fillStyle = '#e9c46a'; c.font = Math.round(30 + 30 * k) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(f.char, bx - bw * 0.3, by - 40 - 70 * k);
        c.globalAlpha = 1;
      }
    });
  }

  function pick(x, y) {
    let best = null, bd = 1e9;
    hits.forEach(function (h) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= h.r && d < bd) { best = h.id; bd = d; }
    });
    return best;
  }

  return { render: render, resize: resize, pick: pick, dispose: function () { cv.remove(); } };
}
