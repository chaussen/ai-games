/* WOBBLE WORKS CLASSIC — canvas renderer + controller.
   Rebuilt for the side-view 2D build; talks to /ws2d. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var isBoard = params.get('board') === '1';

  var WS = null;
  var LVL = null;
  var snap = null;
  var myId = null;
  var myName = '';
  var joined = false;
  var hintIdx = 0;
  var TABS = null;
  var confetti = [];
  var winShown = false;
  var lastSent = { x: 0, jump: false, grabL: false, grabR: false };
  var sendTimer = null;

  var view = { x: 0, y: 0, zoom: 1 };
  var renderP = new Map();
  var renderD = new Map();
  var renderCore = { x: 0, y: 0, tx: 0, ty: 0, init: false };

  var cfg = window.WOBBLE_CONFIG || { lanIPs: [location.hostname], port: location.port || 3000 };

  // ---------------- helpers ----------------

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) {
    if (!isFinite(a) || !isFinite(b)) return isFinite(b) ? b : (isFinite(a) ? a : 0);
    return a + (b - a) * t;
  }

  function toast(el, text) {
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function hostForLinks() {
    var host = params.get('host');
    if (host) return host;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]') {
      return cfg.lanIPs && cfg.lanIPs.length ? cfg.lanIPs[0] : location.hostname;
    }
    return location.hostname;
  }

  // ---------------- networking ----------------

  function connect() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    WS = new WebSocket(proto + '//' + location.host + '/ws2d');
    WS.onopen = function () {
      if (isBoard) {
        send({ type: 'join', board: true });
      } else {
        send({ type: 'join', name: myName });
      }
    };
    WS.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      handle(msg);
    };
    WS.onclose = function () {
      joined = false;
      setTimeout(connect, 1200);
    };
  }

  function send(obj) {
    if (WS && WS.readyState === 1) WS.send(JSON.stringify(obj));
  }

  function handle(msg) {
    if (msg.type === 'joined') {
      joined = true;
      if (msg.level) setLevel(msg.level);
      if (msg.tabs) TABS = msg.tabs;
      if (msg.board) {
        buildTabs();
      } else {
        myId = msg.id;
        myName = msg.name;
        var nameEl = $('p-name');
        if (nameEl) nameEl.textContent = '😀 ' + msg.name;
        if (msg.color) document.documentElement.style.setProperty('--me', msg.color);
        startInputLoop();
      }
      return;
    }
    if (msg.type === 'level') { setLevel(msg.level); return; }
    if (msg.type === 'state') { absorb(msg); return; }
    if (msg.type === 'toast') { toast(isBoard ? $('b-toast') : $('p-toast'), msg.text); return; }
    if (msg.type === 'full') { toast(isBoard ? $('b-toast') : $('p-toast'), 'Room is full'); return; }
    if (msg.type === 'fx') { onEvent(msg.event); return; }
  }

  function onEvent(ev) {
    if (!ev) return;
    var toastEl = isBoard ? $('b-toast') : $('p-toast');
    if (ev.type === 'poof') toast(toastEl, '💨 ' + (ev.who || 'Someone') + ' fell in!');
    if (ev.type === 'splash') toast(toastEl, '💦 The Core went for a swim');
    if (ev.type === 'jump' && isBoard) { /* silent */ }
    if (ev.type === 'win') {
      showWin(ev.medal);
      burst();
    }
    if (ev.type === 'call') {
      if (ev.who && ev.text) toast(toastEl, ev.who + ': ' + ev.text);
    }
  }

  function showWin(medal) {
    if (winShown) return;
    winShown = true;
    if (!isBoard) { toast($('p-toast'), '🎉 Chapter clear! ' + (medal || '')); return; }
    var banner = $('win-banner');
    $('win-medal').textContent = medal || 'CHAOS GREMLINS';
    $('win-sub').textContent = 'The Core made it to the beacon.';
    banner.classList.remove('hidden');
    setTimeout(function () {
      banner.classList.add('hidden');
      winShown = false;
    }, 5200);
  }

  function setLevel(info) {
    LVL = info;
    renderP.clear();
    renderD.clear();
    if (!isBoard) return;
    $('b-title').textContent = info.name;
    $('b-cn').textContent = info.cn || '';
    $('b-text').textContent = info.brief || '';
    $('b-tier').textContent = (info.tier || '') + ' · Chapter ' + info.id;
    $('b-goal').textContent = info.goal
      ? 'Beacon at x=' + Math.round(info.goal.x) + ' · y=' + Math.round(info.goal.y)
      : 'Free play — no beacon, no rules.';
    buildTabs();
    updateTools();
  }

  function buildTabs() {
    var tabs = $('b-tabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    var list = TABS || [[1, 'THE DOOR'], [2, 'THE SEE-SAW'], [3, 'THE GAP'], [4, 'BELL ISLAND'], [5, 'FREE PLAY']];
    for (var i = 0; i < list.length; i++) {
      (function (entry) {
        var b = document.createElement('button');
        b.className = 'tab' + (LVL && LVL.id === entry[0] ? ' active' : '');
        b.textContent = entry[0] + ' · ' + entry[1].replace(/^THE /, '').replace(/ ISLAND$/, '');
        b.onclick = function () { send({ type: 'level', id: entry[0] }); };
        tabs.appendChild(b);
      })(list[i]);
    }
  }

  function updateTools() {
    var el = $('b-budget');
    if (el && snap) el.textContent = snap.toolsLeft + ' parts left';
  }

  function absorb(state) {
    snap = state;
    if (state.won && !winShown && isBoard) showWin(state.medal);

    var seen = {};
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      seen[p.id] = 1;
      var r = renderP.get(p.id);
      if (!r) {
        r = { x: p.x, y: p.y, a: p.a, tx: p.x, ty: p.y, ta: p.a, data: p };
        renderP.set(p.id, r);
      }
      r.tx = p.x; r.ty = p.y; r.ta = p.a; r.data = p;
    }
    renderP.forEach(function (v, k) { if (!seen[k]) renderP.delete(k); });

    var dseen = {};
    for (var j = 0; j < state.dyn.length; j++) {
      var d = state.dyn[j];
      dseen[d.id] = 1;
      var dr = renderD.get(d.id);
      if (!dr) { dr = { x: d.x, y: d.y, a: d.a, tx: d.x, ty: d.y, ta: d.a, kind: d.kind }; renderD.set(d.id, dr); }
      dr.tx = d.x; dr.ty = d.y; dr.ta = d.a; dr.kind = d.kind;
    }
    renderD.forEach(function (v, k) { if (!dseen[k]) renderD.delete(k); });

    if (!renderCore.init) {
      renderCore = { x: state.core.x, y: state.core.y, tx: state.core.x, ty: state.core.y, init: true };
    }
    renderCore.tx = state.core.x;
    renderCore.ty = state.core.y;

    var pl = $('b-players');
    if (pl) pl.textContent = '👥 ' + state.players.length + ' wobblers';
    var sc = $('p-score');
    if (sc && myId) {
      var me = null;
      for (var k = 0; k < state.players.length; k++) if (state.players[k].id === myId) me = state.players[k];
      if (me) sc.textContent = '⭐ ' + me.score;
    }
    updateTools();

    if (state.won) burst();
  }

  // ---------------- input ----------------

  function startInputLoop() {
    if (sendTimer) return;
    sendTimer = setInterval(function () {
      var cur = { x: input.x, jump: false, grabL: input.grabL, grabR: input.grabR };
      var changed = cur.x !== lastSent.x || cur.grabL !== lastSent.grabL || cur.grabR !== lastSent.grabR || input.jumpQueued;
      if (!changed && !input.jumpQueued) return;
      cur.jump = !!input.jumpQueued;
      input.jumpQueued = false;
      lastSent = { x: cur.x, jump: false, grabL: cur.grabL, grabR: cur.grabR };
      send({ type: 'input', x: cur.x, jump: cur.jump, grabL: cur.grabL, grabR: cur.grabR });
    }, 60);
  }

  var input = { x: 0, grabL: false, grabR: false, jumpQueued: false };
  var keys = {};

  function bindKeys() {
    window.addEventListener('keydown', function (e) {
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') { input.jumpQueued = true; e.preventDefault(); }
      syncKeys();
    });
    window.addEventListener('keyup', function (e) {
      keys[e.key.toLowerCase()] = false;
      syncKeys();
    });
  }

  function syncKeys() {
    var left = keys['a'] || keys['arrowleft'];
    var right = keys['d'] || keys['arrowright'];
    input.x = (right ? 1 : 0) - (left ? 1 : 0);
    input.grabL = !!(keys['j'] || keys['q']);
    input.grabR = !!(keys['k'] || keys['e']);
  }

  function bindButton(el, on, off) {
    if (!el) return;
    var down = function (e) { e.preventDefault(); el.classList.add('active'); on(); };
    var up = function (e) { e.preventDefault(); el.classList.remove('active'); if (off) off(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  function bindDeck() {
    var holdLeft = function (v) { return function () { input.x = v; }; };
    bindButton($('k-left'), holdLeft(-1), function () { if (input.x === -1) input.x = 0; });
    bindButton($('k-right'), holdLeft(1), function () { if (input.x === 1) input.x = 0; });
    bindButton($('k-jump'), function () { input.jumpQueued = true; });
    bindButton($('k-grabL'), function () { input.grabL = true; }, function () { input.grabL = false; });
    bindButton($('k-grabR'), function () { input.grabR = true; }, function () { input.grabR = false; });
    bindButton($('k-call1'), function () { send({ type: 'call', text: '👋' }); });
    bindButton($('k-call2'), function () { send({ type: 'call', text: '😱' }); });
  }

  // ---------------- rendering ----------------

  var canvas, ctx, dpr = 1, cw = 0, ch = 0;

  function sizeCanvas() {
    canvas = isBoard ? $('b-canvas') : $('p-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }

  function camera() {
    var focus;
    if (isBoard) {
      focus = { x: renderCore.x, y: renderCore.y };
    } else {
      var me = myId ? renderP.get(myId) : null;
      focus = me ? { x: me.x, y: me.y } : { x: renderCore.x, y: renderCore.y };
    }
    var baseW = isBoard ? 1900 : 560;
    var baseH = isBoard ? 1150 : 420;
    var zoom = Math.min(cw / baseW, ch / baseH);
    zoom = clamp(zoom, 0.25, 1.6);

    var halfW = cw / zoom / 2;
    var halfH = ch / zoom / 2;
    var lvW = LVL ? LVL.width : 1500;
    var lvH = LVL ? LVL.height : 860;
    var cx = focus.x;
    var cy = focus.y - 40;
    if (isBoard) {
      if (lvW > halfW * 2) cx = clamp(cx, halfW, lvW - halfW);
      else cx = lvW / 2;
      if (lvH > halfH * 2) cy = clamp(cy, halfH, lvH - halfH);
      else cy = lvH / 2 - 40;
    } else {
      // phone: keep the wobbler just below centre so the ground reads as ground
      cx = clamp(cx, halfW, Math.max(halfW, lvW - halfW));
      // keep the wobbler around three quarters down the screen so the ground
      // sits near the bottom edge and jumps get a lot of sky
      cy = focus.y - (ch / zoom) * 0.25;
      if (cy < -320) cy = -320;
      if (cy > lvH) cy = lvH;
    }

    if (!isFinite(cx)) cx = lvW / 2;
    if (!isFinite(cy)) cy = lvH / 2;
    if (!isFinite(view.x) || !isFinite(view.y)) { view.x = cx; view.y = cy; }
    view.zoom = zoom;
    view.x = lerp(view.x, cx, 0.18);
    view.y = lerp(view.y, cy, 0.18);
  }

  function w2s(x, y) { return { x: (x - view.x) * view.zoom + cw / 2, y: (y - view.y) * view.zoom + ch / 2 }; }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#bfe0f2');
    g.addColorStop(0.55, '#e8f0e2');
    g.addColorStop(1, '#f7e8c8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    // distant hills, parallax with the camera
    var px = -view.x * view.zoom * 0.12;
    ctx.fillStyle = 'rgba(123, 182, 97, 0.35)';
    ctx.beginPath();
    var base = ch * 0.72;
    ctx.moveTo(-100, ch);
    for (var i = -100; i < cw + 200; i += 40) {
      var h = Math.sin((i - px) * 0.004) * 40 + Math.cos((i - px) * 0.011) * 18;
      ctx.lineTo(i, base + h);
    }
    ctx.lineTo(cw + 200, ch);
    ctx.closePath();
    ctx.fill();
  }

  function drawStatics() {
    if (!LVL) return;
    for (var i = 0; i < LVL.statics.length; i++) {
      var s = LVL.statics[i];
      var p = w2s(s.x, s.y);
      var w = s.w * view.zoom;
      var h = s.h * view.zoom;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (s.angle) ctx.rotate(s.angle);
      if (s.kind === 'ground') {
        // the ground slab is the visible edge of a big block of earth
        var deep = h + 3000 * view.zoom;
        ctx.fillStyle = '#6b4a2f';
        ctx.fillRect(-w / 2, -h / 2, w, deep);
        ctx.fillStyle = '#7bb661';
        ctx.fillRect(-w / 2, -h / 2, w, Math.max(4, h * 0.16));
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        for (var k = 0; k < 26; k++) {
          var dx = -w / 2 + (k * 61) % w;
          var dy = -h / 2 + 18 + (k * 37) % 90;
          ctx.fillRect(dx, dy, 9 * view.zoom, 4 * view.zoom);
        }
      } else if (s.kind === 'wall') {
        ctx.fillStyle = '#8d8577';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = 'rgba(43,33,24,0.18)';
        ctx.lineWidth = 2;
        for (var y = -h / 2; y < h / 2; y += 46 * view.zoom) {
          ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke();
        }
      } else if (s.kind === 'sign') {
        ctx.fillStyle = '#8a5a30';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#c98f57';
        ctx.fillRect(-w / 2 - 2, -h / 2, w + 26 * view.zoom, 13 * view.zoom);
      } else {
        // ledge / deck / slope: wood
        ctx.fillStyle = '#b07a45';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(-w / 2, -h / 2, w, Math.max(2, h * 0.28));
        ctx.fillStyle = 'rgba(43,33,24,0.22)';
        ctx.fillRect(-w / 2, h / 2 - Math.max(2, h * 0.18), w, Math.max(2, h * 0.18));
      }
      ctx.restore();
    }
  }

  function drawRegion(r, fill, stroke) {
    var p = w2s(r.x, r.y);
    var w = r.w * view.zoom;
    var h = r.h * view.zoom;
    ctx.fillStyle = fill;
    ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
    }
  }

  function drawWater() {
    if (!LVL || !LVL.water) return;
    for (var i = 0; i < LVL.water.length; i++) {
      var w = LVL.water[i];
      var p = w2s(w.x, w.y);
      var ww = w.w * view.zoom;
      var hh = w.h * view.zoom;
      ctx.fillStyle = 'rgba(78, 160, 210, 0.62)';
      ctx.beginPath();
      ctx.moveTo(p.x - ww / 2, p.y - hh / 2);
      for (var x = -ww / 2; x <= ww / 2; x += 18) {
        ctx.lineTo(p.x + x, p.y - hh / 2 + Math.sin((x + Date.now() * 0.06) * 0.05) * 5);
      }
      ctx.lineTo(p.x + ww / 2, p.y + hh / 2);
      ctx.lineTo(p.x - ww / 2, p.y + hh / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawWind() {
    if (!LVL || !LVL.wind) return;
    for (var i = 0; i < LVL.wind.length; i++) {
      var w = LVL.wind[i];
      drawRegion(w, 'rgba(160, 220, 255, 0.16)', 'rgba(120, 190, 240, 0.4)');
      var p = w2s(w.x, w.y);
      var dir = w.fx > 0 ? 1 : -1;
      ctx.strokeStyle = 'rgba(120, 190, 240, 0.75)';
      ctx.lineWidth = 3;
      for (var k = 0; k < 6; k++) {
        var yy = p.y - w.h * view.zoom / 2 + 20 + k * (w.h * view.zoom / 6);
        var xx = p.x - 40 + ((Date.now() * 0.12 + k * 37) % 80);
        ctx.beginPath();
        ctx.moveTo(xx - 16 * dir, yy);
        ctx.lineTo(xx + 16 * dir, yy);
        ctx.stroke();
      }
    }
  }

  function drawGates() {
    if (!LVL || !LVL.gates || !snap) return;
    for (var i = 0; i < LVL.gates.length; i++) {
      var g = LVL.gates[i];
      var live = null;
      for (var k = 0; k < snap.gates.length; k++) if (snap.gates[k].id === g.id) live = snap.gates[k];
      var y = live ? live.y : g.y;
      var p = w2s(g.x, y);
      var w = g.w * view.zoom;
      var h = g.h * view.zoom;
      ctx.fillStyle = '#5c4a3a';
      ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
      ctx.fillStyle = '#c9a227';
      for (var b = -h / 2 + 10; b < h / 2; b += 34 * view.zoom) {
        ctx.fillRect(p.x - w / 2, p.y + b, w, 5 * view.zoom);
      }
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
    }
  }

  function drawPlates() {
    if (!LVL || !LVL.plates || !snap) return;
    for (var i = 0; i < LVL.plates.length; i++) {
      var pl = LVL.plates[i];
      var pressed = false;
      for (var k = 0; k < snap.plates.length; k++) if (snap.plates[k].id === pl.id) pressed = snap.plates[k].pressed;
      var p = w2s(pl.x, pl.y + (pressed ? 6 : 0));
      var w = pl.w * view.zoom;
      var h = pl.h * view.zoom;
      ctx.fillStyle = pressed ? '#7bd389' : '#d9c8a9';
      ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
      if (pressed) {
        ctx.fillStyle = 'rgba(123, 211, 137, 0.35)';
        ctx.fillRect(p.x - w / 2 - 4, p.y - h / 2 - 10, w + 8, h + 16);
      }
    }
  }

  function drawSeesaws() {
    if (!LVL || !LVL.seesaws || !snap) return;
    for (var i = 0; i < LVL.seesaws.length; i++) {
      var def = LVL.seesaws[i];
      var live = snap.seesaws[i];
      var x = live ? live.x : def.x;
      var y = live ? live.y : def.y;
      var a = live ? live.a : 0;
      var p = w2s(x, y);
      var w = def.w * view.zoom;
      var h = def.h * view.zoom;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      ctx.fillStyle = '#b07a45';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      // pivot
      ctx.fillStyle = '#6b5847';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 * view.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRopes() {
    if (!snap || !snap.ropes) return;
    for (var i = 0; i < snap.ropes.length; i++) {
      var r = snap.ropes[i];
      var pts = r.pts;
      ctx.strokeStyle = '#8a6b4a';
      ctx.lineWidth = 3 * view.zoom;
      ctx.beginPath();
      for (var k = 0; k < pts.length; k++) {
        var p = w2s(pts[k][0], pts[k][1]);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.fillStyle = '#c98f57';
      for (var j = 0; j < pts.length; j++) {
        var q = w2s(pts[j][0], pts[j][1]);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 4 * view.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawDynamics() {
    renderD.forEach(function (d) {
      var p = w2s(d.x, d.y);
      var z = view.zoom;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(d.a);
      if (d.kind === 'crate') {
        var s = 64 * z;
        ctx.fillStyle = '#c98f57';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = '#6b4a2f';
        ctx.lineWidth = 2;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.beginPath();
        ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2);
        ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2);
        ctx.stroke();
      } else if (d.kind === 'plank') {
        var w = 220 * z, h = 16 * z;
        ctx.fillStyle = '#b07a45';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#6b4a2f';
        ctx.lineWidth = 2;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      } else {
        var r = 26 * z;
        ctx.fillStyle = '#9b6b43';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6b4a2f';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawGoal() {
    if (!LVL || !LVL.goal) return;
    var g = LVL.goal;
    var p = w2s(g.x, g.y);
    var pulse = 1 + Math.sin(Date.now() * 0.004) * 0.06;
    var r = g.r * view.zoom * pulse;
    var grd = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r);
    grd.addColorStop(0, 'rgba(255, 209, 102, 0.55)');
    grd.addColorStop(1, 'rgba(255, 209, 102, 0.03)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 145, 0, 0.9)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8a5a30';
    ctx.font = '700 ' + Math.max(11, 13 * view.zoom) + 'px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⭐ ' + (g.label || 'BEACON'), p.x, p.y - r - 10);
  }

  function drawCore() {
    var p = w2s(renderCore.x, renderCore.y);
    var r = 34 * view.zoom;
    var grd = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.2, p.x, p.y, r);
    grd.addColorStop(0, '#fff3c4');
    grd.addColorStop(0.55, '#ffd166');
    grd.addColorStop(1, '#f0a12e');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  }

  function drawPlayers() {
    renderP.forEach(function (r) {
      var p = w2s(r.x, r.y);
      var z = view.zoom;
      var d = r.data || {};
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(r.a);
      // body
      ctx.fillStyle = d.afk ? '#9a9a9a' : (d.color || '#ff7a59');
      ctx.beginPath();
      ctx.arc(0, 0, 26 * z, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.arc(0, -44 * z, 17 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(43,33,24,0.35)';
      ctx.lineWidth = 2 * z;
      ctx.stroke();
      // eyes
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(5 * z, -47 * z, 2.6 * z, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(12 * z, -47 * z, 2.6 * z, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // name plate
      ctx.font = '700 ' + Math.max(9, 11 * z) + 'px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      var label = (d.afk ? '💤 ' : '') + (d.name || '');
      var tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(43,33,24,0.72)';
      ctx.fillRect(p.x - tw / 2 - 6, p.y - 84 * z - 12, tw + 12, 18);
      ctx.fillStyle = '#f6ecdc';
      ctx.fillText(label, p.x, p.y - 84 * z);

      if (d.carrying) {
        ctx.strokeStyle = '#7bd389';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 30 * z, 40 * z, -0.6, 0.6);
        ctx.stroke();
      }
    });
  }

  function burst() {
    for (var i = 0; i < 70; i++) {
      confetti.push({
        x: Math.random() * cw,
        y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 1.6 + Math.random() * 2.4,
        r: 3 + Math.random() * 5,
        c: ['#ff7a59', '#ffd166', '#4ecdc4', '#a06cd5', '#7bd389'][i % 5],
        a: Math.random() * 6
      });
    }
  }

  function drawConfetti() {
    for (var i = confetti.length - 1; i >= 0; i--) {
      var c = confetti[i];
      c.x += c.vx; c.y += c.vy; c.vy += 0.03; c.a += 0.08;
      if (c.y > ch + 40) { confetti.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.a);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.r / 2, -c.r / 2, c.r, c.r * 1.6);
      ctx.restore();
    }
  }

  var frameErrors = 0;

  function frame() {
    // never let one bad value kill the animation loop
    requestAnimationFrame(frame);
    try {
      drawFrame();
    } catch (e) {
      frameErrors++;
      if (frameErrors <= 3 && window.console) console.warn('classic frame error', e && e.message);
    }
  }

  function drawFrame() {
    if (!canvas) sizeCanvas();
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky();

    // interpolate render positions
    renderP.forEach(function (r) {
      r.x = lerp(r.x, r.tx, 0.35);
      r.y = lerp(r.y, r.ty, 0.35);
    });
    renderD.forEach(function (d) {
      d.x = lerp(d.x, d.tx, 0.35);
      d.y = lerp(d.y, d.ty, 0.35);
      d.a = lerp(d.a, d.ta, 0.35);
    });
    renderCore.x = lerp(renderCore.x, renderCore.tx, 0.35);
    renderCore.y = lerp(renderCore.y, renderCore.ty, 0.35);

    camera();
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-view.x, -view.y);
    drawStatics();
    drawWater();
    drawWind();
    drawGates();
    drawPlates();
    drawSeesaws();
    drawRopes();
    drawGoal();
    drawDynamics();
    drawCore();
    drawPlayers();
    ctx.restore();

    drawConfetti();
  }

  // ---------------- board wiring ----------------

  function buildQR() {
    var port = location.port ? ':' + location.port : '';
    var url = 'http://' + hostForLinks() + port + '/classic/';
    var el = $('join-url');
    if (el) el.textContent = url;
    if (window.qrcode) {
      try {
        var qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        $('qr').innerHTML = qr.createImgTag(4, 8);
      } catch (e) { $('qr').textContent = url; }
    } else {
      $('qr').textContent = url;
    }
  }

  function bindBoard() {
    var hint = $('b-hint');
    if (hint) hint.onclick = function () {
      if (!LVL || !LVL.hints || !LVL.hints.length) return;
      hintIdx = (hintIdx + 1) % LVL.hints.length;
      toast($('b-toast'), '💡 ' + LVL.hints[hintIdx]);
    };
    var next = $('b-next');
    if (next) next.onclick = function () { send({ type: 'nextLevel' }); };
    var reset = $('b-reset');
    if (reset) reset.onclick = function () { send({ type: 'reset' }); };
    var tools = document.querySelectorAll('[data-tool]');
    for (var i = 0; i < tools.length; i++) {
      (function (btn) {
        btn.onclick = function () { send({ type: 'tool', kind: btn.getAttribute('data-tool') }); };
      })(tools[i]);
    }
  }

  // ---------------- boot ----------------

  function boot() {
    if (isBoard) {
      $('board').classList.remove('hidden');
      $('phone').classList.add('hidden');
      buildQR();
      bindBoard();
      sizeCanvas();
      connect();
      bindKeys();
      requestAnimationFrame(frame);
    } else {
      $('phone').classList.remove('hidden');
      $('board').classList.add('hidden');
      sizeCanvas();
      bindDeck();
      bindKeys();
      requestAnimationFrame(frame);

      var saved = localStorage.getItem('ww2d-name');
      var inputEl = $('name-input');
      if (saved) inputEl.value = saved;
      var go = function () {
        var name = (inputEl.value || '').trim() || ('Wobbler ' + Math.floor(Math.random() * 90 + 10));
        localStorage.setItem('ww2d-name', name);
        myName = name;
        $('join-card').classList.add('hidden');
        connect();
      };
      $('join-go').onclick = go;
      inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

      document.addEventListener('visibilitychange', function () {
        send({ type: 'visibility', hidden: document.hidden });
      });
    }
    window.addEventListener('resize', sizeCanvas);
  }

  // debug hook used by the screenshot script and by anyone poking at the page
  window.__classic = {
    get level() { return LVL; },
    get snap() { return snap; },
    get view() { return view; },
    get size() { return { cw: cw, ch: ch, zoom: view.zoom }; },
    get players() { return Array.from(renderP.keys()); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
