(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var params = new URLSearchParams(location.search);
var isBoard = params.get('board') === '1';
var cfg = window.WOBBLE_CONFIG || { lanIPs: [], port: Number(location.port) || 3000 };
// Trust the address the browser actually reached us on when it is a LAN address;
// otherwise use the server-detected NIC. ?host= overrides a wrong auto-guess.
function isLoopback(h) { return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h === '0.0.0.0'; }
var joinHost = params.get('host') || (isLoopback(location.hostname) ? (cfg.lanIPs[0] || location.hostname) : location.hostname);
var joinURL = 'http://' + joinHost + ':' + (params.get('port') || cfg.port) + '/';
var EMOJIS = ['🙂','🦊','🐻','🐱','🐼','🐸','🦄','🐙','🐧','🌻','⚡','🍊'];
var LEVEL_TABS = [
  { id: 1, name: 'THE DOOR', cn: '门', tier: 'SCRIPTED' },
  { id: 2, name: 'SEE-SAW', cn: '跷跷板', tier: 'SEMI-SCRIPTED' },
  { id: 3, name: 'THE GAP', cn: '深沟', tier: 'SEMI-OPEN' },
  { id: 4, name: 'BELL ISLAND', cn: '灯塔岛', tier: 'OPEN' },
  { id: 5, name: 'FREE PLAY', cn: '沙盒', tier: 'SANDBOX' }
];

var ws = null, me = null, state = null, fitView = isBoard, rtt = 0;
var input = { left: false, right: false, jump: false, grabL: false, grabR: false };
var render = new Map(), coreTrail = [], seenWin = null, toastTimer = 0;
var lastFrame = 0;

// ---------- connection ----------
function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function sendInput() { send({ type: 'input', left: input.left, right: input.right, jump: input.jump, grabL: input.grabL, grabR: input.grabR }); }
function connect() {
  ws = new WebSocket('ws://' + location.host + '/ws');
  ws.onopen = function () {
    var nm = localStorage.getItem('ww-name') || (isBoard ? 'HOST' : 'Wobbler');
    send({ type: 'join', name: nm, emoji: localStorage.getItem('ww-emoji') || '🙂', board: isBoard });
    setInterval(function () { send({ type: 'ping', c0: Date.now() }); }, 2500);
  };
  ws.onmessage = function (ev) {
    var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.type === 'welcome') onWelcome(m);
    else if (m.type === 'state') { state = m; updateHUD(); }
    else if (m.type === 'pong') { rtt = Math.max(0, Math.min(300, Date.now() - Number(m.c0 || Date.now()))); }
    else if (m.type === 'win') showWin(m.win);
    else if (m.type === 'toast') showToast(m.text);
    else if (m.type === 'levelChanged') { seenWin = null; render.clear(); coreTrail = []; hideWin(); }
  };
  ws.onclose = function () { setTimeout(connect, 1200); };
  ws.onerror = function () {};
}
function onWelcome(m) {
  me = m;
  if (!isBoard) {
    $('c-me').textContent = m.emoji + ' ' + m.name;
    $('join-gate').classList.add('hidden');
  }
}
function showGate() {
  var g = $('join-gate'); g.classList.remove('hidden');
  $('gate-name').value = localStorage.getItem('ww-name') || '';
  var row = $('gate-emojis'); row.innerHTML = '';
  EMOJIS.forEach(function (e) {
    var b = document.createElement('button'); b.className = 'emoji'; b.textContent = e;
    if (e === (localStorage.getItem('ww-emoji') || EMOJIS[0])) b.classList.add('sel');
    b.onclick = function () { row.querySelectorAll('.emoji').forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); b.dataset.pick = '1'; row.dataset.emoji = e; };
    row.appendChild(b);
  });
  row.dataset.emoji = localStorage.getItem('ww-emoji') || EMOJIS[0];
  $('gate-note').textContent = 'You are joining ' + joinURL;
  $('gate-go').onclick = function () {
    var n = ($('gate-name').value || 'Wobbler').trim().slice(0, 12);
    localStorage.setItem('ww-name', n); localStorage.setItem('ww-emoji', row.dataset.emoji || EMOJIS[0]);
    g.classList.add('hidden'); connect();
  };
}

// ---------- inputs ----------
var KEYMAP = { a: 'left', A: 'left', ArrowLeft: 'left', d: 'right', D: 'right', ArrowRight: 'right', ' ': 'jump', w: 'jump', W: 'jump', ArrowUp: 'jump', j: 'grabL', J: 'grabL', k: 'grabR', K: 'grabR' };
document.addEventListener('keydown', function (e) {
  if (e.target && e.target.tagName === 'INPUT') return;
  var k = KEYMAP[e.key];
  if (k) { e.preventDefault(); if (!input[k]) { input[k] = true; sendInput(); } }
  if (isBoard && e.key >= '1' && e.key <= '5') send({ type: 'setLevel', id: Number(e.key) });
  if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
    var calls = ['📍 HERE','🙋 MINE','💪 PUSH','😂 LOL'];
    send({ type: 'call', text: calls[Number(e.key) - 1] });
  }
  if (isBoard && (e.key === 'h' || e.key === 'H')) send({ type: 'hint' });
  if (isBoard && (e.key === 'b' || e.key === 'B')) send({ type: 'addBot' });
});
document.addEventListener('keyup', function (e) {
  var k = KEYMAP[e.key]; if (k) { e.preventDefault(); input[k] = false; sendInput(); }
});
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { input.left = input.right = input.jump = input.grabL = input.grabR = false; sendInput(); }
});
function bindHold(id, key) {
  var el = $(id); if (!el) return;
  el.addEventListener('pointerdown', function (e) { e.preventDefault(); input[key] = true; el.classList.add('held'); sendInput(); });
  var up = function (e) { e.preventDefault(); input[key] = false; el.classList.remove('held'); sendInput(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
setInterval(sendInput, 33);

// ---------- board UI ----------
function buildTabs() {
  var box = $('b-levels'); if (!box) return;
  box.innerHTML = '';
  LEVEL_TABS.forEach(function (l) {
    var b = document.createElement('button');
    b.className = 'tab'; b.dataset.id = l.id;
    b.innerHTML = '<b>' + l.id + '</b> ' + l.name + '<small>' + l.cn + ' · ' + l.tier + '</small>';
    b.onclick = function () { send({ type: 'setLevel', id: l.id }); };
    box.appendChild(b);
  });
}
function buildQR() {
  var port = params.get('port') || cfg.port;
  if ($('lan-port-cmd')) $('lan-port-cmd').textContent = 'sudo firewall-cmd --zone=public --add-port=' + port + '/tcp';
  if ($('lan-port-num')) $('lan-port-num').textContent = 'port ' + port;
  var el = $('qr'); if (!el || typeof window.qrcode !== 'function') return;
  try {
    var qr = qrcode(0, 'M'); qr.addData(joinURL); qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 1 });
    $('join-url').textContent = joinURL;
  } catch (e) { $('join-url').textContent = joinURL; }
}
function boardBinds() {
  $('copy-url').onclick = function () {
    var done = function () { showToast('Link copied ✓'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(joinURL).then(done, fallback);
    else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = joinURL; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { showToast(joinURL); }
      document.body.removeChild(t);
    }
  };
  $('btn-start').onclick = function () { send({ type: 'start' }); };
  $('btn-reset').onclick = function () { send({ type: 'reset' }); };
  $('btn-bot').onclick = function () { send({ type: 'addBot' }); };
  $('btn-kickbot').onclick = function () { send({ type: 'removeBots' }); };
  $('btn-hint').onclick = function () { send({ type: 'hint' }); };
  $('btn-wide').onclick = function () { fitView = !fitView; showToast(fitView ? 'Wide workshop view' : 'Follow your wobbler'); };
  $('btn-next').onclick = function () { send({ type: 'next' }); };
  $('btn-replay').onclick = function () { send({ type: 'setLevel', id: state ? state.level.id : 1 }); };
  $('btn-scrap').onclick = openScrap;
  $('scrap-close').onclick = function () { $('scrapbook').classList.add('hidden'); };
  document.querySelectorAll('.tool').forEach(function (b) { b.onclick = function () { send({ type: 'spawnTool', kind: b.dataset.tool }); }; });
}
function controllerBinds() {
  bindHold('btn-left', 'left'); bindHold('btn-right', 'right'); bindHold('btn-jump', 'jump');
  bindHold('btn-grabL', 'grabL'); bindHold('btn-grabR', 'grabR');
  document.querySelectorAll('.call').forEach(function (b) { b.onclick = function () { send({ type: 'call', text: b.dataset.call }); }; });
  document.querySelectorAll('.ctool[data-tool]').forEach(function (b) { b.onclick = function () { send({ type: 'spawnTool', kind: b.dataset.tool }); }; });
  $('btn-cwide').onclick = function () { fitView = !fitView; $('btn-cwide').classList.toggle('on', !fitView); showToast(fitView ? 'Wide view' : 'Follow camera'); };
}

// ---------- HUD ----------
function fmtTime(ms) { var s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function updateHUD() {
  if (!state) return;
  var L = state.level;
  if (isBoard) {
    $('b-time').textContent = '⏱ ' + fmtTime(state.elapsed);
    $('b-players').textContent = '👥 ' + state.players.length;
    $('b-push').textContent = '💪 TEAM PUSH ' + state.pushCount;
    $('b-tools').textContent = '🧰 ' + state.toolsLeft + ' / ' + L.toolBudget;
    $('b-rtt').textContent = '📶 ' + rtt + ' ms';
    $('b-tier').textContent = L.tier;
    $('b-objective').innerHTML = '<b>' + L.cn + ' · ' + L.name + '</b><span>' + L.subtitle + ' — ' + L.brief + '</span>';
    $('b-pushbar').style.width = Math.min(100, state.pushCount / Math.max(1, state.players.length) * 100) + '%';
    $('tool-count').textContent = state.toolsLeft + ' left';
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', Number(t.dataset.id) === L.id); });
    renderCalls();
  } else {
    $('c-objective').innerHTML = '<b>CH.' + L.id + ' · ' + L.name + '</b><small>' + L.cn + ' · ' + L.tier + '</small><span>' + L.subtitle + '</span>';
    updateDirection();
  }
  if (state.win && seenWin !== state.win.medal.name + state.win.levelId) showWin(state.win);
}
function updateDirection() {
  if (!state || !me) return;
  var p = state.players.find(function (q) { return q.id === me.id; });
  var core = state.bodies.find(function (b) { return b.kind === 'core'; });
  var el = $('c-direction'); if (!p || !core) { el.textContent = ''; return; }
  var dx = Math.round(core.x - p.x), dy = Math.round(core.y - p.y);
  var arrow = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '→' : '←') : (dy > 0 ? '↓' : '↑');
  var goalTxt = '';
  if (state.goal) {
    var gd = Math.round(Math.hypot(core.x - state.goal.x, core.y - state.goal.y));
    goalTxt = ' · BEACON ' + gd + 'px';
  }
  el.textContent = '✦ CORE ' + arrow + ' ' + Math.abs(dx) + 'px' + goalTxt;
}
function renderCalls() {
  var layer = $('b-calls'); if (!layer) return;
  var calls = state.fx.filter(function (f) { return f.kind === 'call'; });
  layer.innerHTML = calls.slice(-3).map(function (c) { return '<span class="call-chip">' + c.who + ': ' + c.text + '</span>'; }).join('');
}
function showToast(t) {
  var el = isBoard ? $('b-toast') : $('c-toast'); if (!el) return;
  el.textContent = t; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
}
function showWin(w) {
  seenWin = w.medal.name + w.levelId;
  if (isBoard) {
    $('win-overlay').classList.remove('hidden');
    $('win-medal').textContent = { chain: '🤝', catapult: '🚀', bridge: '🌉', rope: '🤸', carry: '🪵', chaos: '🌪' }[w.medal.key] || '✦';
    $('win-title').textContent = w.medal.name;
    $('win-line').textContent = w.medal.line;
    $('win-time').textContent = '⏱ ' + fmtTime(w.elapsed * 1000);
    $('win-stamps').textContent = '✦ ' + w.stamps + ' stamp' + (w.stamps === 1 ? '' : 's');
    $('btn-next').textContent = w.next === 5 ? '→ FREE PLAY' : 'NEXT CHAPTER →';
  } else {
    $('c-win').classList.remove('hidden');
    $('c-win-title').textContent = w.medal.name;
    $('c-win-line').textContent = w.medal.line;
  }
}
function hideWin() {
  $('win-overlay').classList.add('hidden'); $('c-win').classList.add('hidden'); $('c-wontag').classList.add('hidden');
}
function openScrap() {
  var grid = $('scrap-grid'); grid.innerHTML = '';
  var stamps = (state && state.stamps) || [];
  if (!stamps.length) grid.innerHTML = '<p class="muted">No stamps yet - finish a chapter to earn the first one.</p>';
  stamps.forEach(function (s) {
    var d = document.createElement('div'); d.className = 'stamp';
    d.innerHTML = '<div class="stamp-icon">' + ({ chain: '🤝', catapult: '🚀', bridge: '🌉', rope: '🤸', carry: '🪵', chaos: '🌪' }[s.medal] || '✦') + '</div>' +
      '<b>' + s.medalName + '</b><small>CH.' + s.level + ' · ' + s.name + '</small><span>' + fmtTime(s.elapsed * 1000) + ' · ' + s.respawns + ' poofs</span>';
    grid.appendChild(d);
  });
  $('scrapbook').classList.remove('hidden');
}

// ---------- rendering helpers ----------
function smooth(id, x, y, a) {
  var r = render.get(id);
  if (!r) { r = { x: x, y: y, a: a || 0, hx: x, hy: y - 30 }; render.set(id, r); }
  r.x += (x - r.x) * 0.32; r.y += (y - r.y) * 0.32; r.a += ((a || 0) - r.a) * 0.3;
  return r;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function drawBackground(ctx, cw, ch) {
  var g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, '#fbf6ea'); g.addColorStop(1, '#eee3cd');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = 'rgba(30,42,68,.055)'; ctx.lineWidth = 1;
  for (var x = 0; x < cw; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
  for (var y = 0; y < ch; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(58,166,160,.09)';
  ctx.beginPath(); ctx.ellipse(cw * 0.2, ch * 0.86, cw * 0.4, ch * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cw * 0.82, ch * 0.9, cw * 0.34, ch * 0.2, 0, 0, Math.PI * 2); ctx.fill();
}
function camera(L, cw, ch) {
  if (fitView) {
    var s = Math.min(cw / L.width, ch / L.height) * 0.95;
    return { x: L.width / 2, y: L.height / 2 - 10, s: s, fit: true };
  }
  var p = me && state ? state.players.find(function (q) { return q.id === me.id; }) : null;
  var s = Math.max(0.72, Math.min(cw / 700, ch / 520, 1.5));
  var cx = p ? p.x : L.width / 2, cy = p ? p.y - 40 : L.height / 2;
  var halfW = cw / (2 * s), halfH = ch / (2 * s);
  cx = Math.max(halfW, Math.min(L.width - halfW, cx));
  cy = Math.max(halfH, Math.min(L.height - halfH, cy));
  return { x: cx, y: cy, s: s, fit: false };
}
function drawGround(ctx, b) {
  var w = b.w, h = b.h;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a || 0);
  ctx.fillStyle = '#b8803f'; roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
  ctx.fillStyle = '#e0b273'; ctx.fillRect(-w / 2, -h / 2, w, 8);
  ctx.strokeStyle = 'rgba(80,50,20,.18)'; ctx.lineWidth = 2;
  for (var i = -w / 2 + 14; i < w / 2; i += 34) { ctx.beginPath(); ctx.moveTo(i, -h / 2 + 10); ctx.lineTo(i + 12, h / 2 - 4); ctx.stroke(); }
  ctx.restore();
}
function drawPlank(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a || 0);
  ctx.fillStyle = '#e2ac69'; roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 4); ctx.fill();
  ctx.strokeStyle = '#a9703a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(120,75,30,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-b.w / 2 + 8, 0); ctx.lineTo(b.w / 2 - 8, 0); ctx.stroke();
  ctx.restore();
}
function drawCrate(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a || 0);
  ctx.fillStyle = '#d99a5b'; roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 6); ctx.fill();
  ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 3; ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(-b.w / 2 + 6, -b.h / 2 + 6); ctx.lineTo(b.w / 2 - 6, b.h / 2 - 6);
  ctx.moveTo(b.w / 2 - 6, -b.h / 2 + 6); ctx.lineTo(-b.w / 2 + 6, b.h / 2 - 6); ctx.stroke();
  ctx.restore();
}
function drawBarrel(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a || 0);
  ctx.fillStyle = '#bd7639'; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6f4420'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, b.r - 8, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function drawCore(ctx, b, now) {
  var pulse = 1 + Math.sin(now / 340) * 0.06;
  ctx.save(); ctx.translate(b.x, b.y);
  var g = ctx.createRadialGradient(-8, -10, 3, 0, 0, b.r * 1.5 * pulse);
  g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.45, '#f2b544'); g.addColorStop(1, '#e07a35');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, b.r * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, b.r + 6 + Math.sin(now / 500) * 3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff6d8';
  for (var i = 0; i < 3; i++) {
    var a = now / 700 + i * 2.1, rr = b.r + 14 + (i * 5);
    ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function drawPlate(ctx, b) {
  var pressed = !!b.pressed;
  ctx.save(); ctx.translate(b.x, b.y + (pressed ? 5 : 0));
  ctx.fillStyle = pressed ? '#ef6f5b' : '#8b6fd4';
  roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(30,42,68,.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(pressed ? '● PRESSED' : 'PLATE', 0, b.h / 2 + 16);
  ctx.restore();
}
function drawGate(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y);
  var open = !!b.open;
  ctx.globalAlpha = open ? 0.24 : 1;
  ctx.fillStyle = '#4a5b7a'; roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 5); ctx.fill();
  ctx.strokeStyle = open ? '#3aa6a0' : '#1e2a44'; ctx.lineWidth = 3; ctx.setLineDash(open ? [7, 7] : []);
  roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 5); ctx.stroke(); ctx.setLineDash([]);
  if (!open) {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (var y = -b.h / 2 + 20; y < b.h / 2; y += 40) { ctx.beginPath(); ctx.moveTo(-b.w / 2 + 3, y); ctx.lineTo(b.w / 2 - 3, y); ctx.stroke(); }
  }
  ctx.restore();
}
function drawSign(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = '#8a5a2c'; ctx.fillRect(-3, -b.h / 2, 6, b.h);
  ctx.fillStyle = '#f2b544'; roundRect(ctx, -22, -b.h / 2 - 4, 44, 22, 5); ctx.fill();
  ctx.fillStyle = '#1e2a44'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('?', 0, -b.h / 2 + 11);
  ctx.restore();
}
function drawWater(ctx, r, now) {
  ctx.save(); ctx.beginPath(); ctx.rect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h); ctx.clip();
  ctx.fillStyle = 'rgba(90,190,220,.55)'; ctx.fillRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h);
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
  for (var i = 0; i < 4; i++) {
    ctx.beginPath();
    for (var x = r.x - r.w / 2; x < r.x + r.w / 2; x += 12) {
      var yy = r.y - r.h / 2 + 14 + i * 26 + Math.sin((x + now / 40) / 28) * 5;
      if (x === r.x - r.w / 2) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function drawWind(ctx, r, now) {
  ctx.save(); ctx.strokeStyle = 'rgba(58,166,160,.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
  ctx.strokeRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(58,166,160,.55)'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  for (var i = 0; i < 3; i++) {
    var xx = r.x - r.w / 3 + ((now / 22 + i * r.w / 3) % (r.w * 1.1));
    ctx.fillText('➜', xx, r.y - r.h / 3 + i * 22);
  }
  ctx.fillText('WIND', r.x, r.y - r.h / 2 - 8);
  ctx.restore();
}
function drawBeacon(ctx, g, now) {
  if (!g) return;
  ctx.save(); ctx.translate(g.x, g.y);
  var pulse = 0.5 + Math.sin(now / 420) * 0.18;
  ctx.strokeStyle = 'rgba(242,181,68,' + pulse + ')'; ctx.lineWidth = 5; ctx.setLineDash([9, 8]);
  ctx.beginPath(); ctx.arc(0, 0, g.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4 + now / 3000;
    ctx.strokeStyle = 'rgba(242,181,68,.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * (g.r + 8), Math.sin(a) * (g.r + 8));
    ctx.lineTo(Math.cos(a) * (g.r + 26), Math.sin(a) * (g.r + 26)); ctx.stroke();
  }
  ctx.fillStyle = '#1e2a44'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('✦ ' + (g.label || 'BEACON'), 0, -g.r - 14);
  ctx.restore();
}
function drawRopes(ctx, bodies) {
  var groups = {};
  bodies.forEach(function (b) {
    if (b.kind !== 'rope') return;
    if (!groups[b.ropeGroup]) groups[b.ropeGroup] = [];
    groups[b.ropeGroup].push(b);
  });
  Object.keys(groups).forEach(function (k) {
    var arr = groups[k].sort(function (a, b) { return a.ropeIndex - b.ropeIndex; });
    ctx.strokeStyle = '#7b5b3a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); arr.forEach(function (b, i) { var r = smooth('rope-' + b.id, b.x, b.y, 0); if (i === 0) ctx.moveTo(r.x, r.y); else ctx.lineTo(r.x, r.y); }); ctx.stroke();
    arr.forEach(function (b) { var r = smooth('rope-' + b.id, b.x, b.y, 0); ctx.fillStyle = '#a8794a'; ctx.beginPath(); ctx.arc(r.x, r.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
  });
}
function drawSeesaws(ctx, arr) {
  arr.forEach(function (s) {
    ctx.fillStyle = '#8a5a2c'; ctx.beginPath();
    ctx.moveTo(s.x, s.y + 4); ctx.lineTo(s.x - 22, s.y + 34); ctx.lineTo(s.x + 22, s.y + 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1e2a44'; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
  });
}
function drawWobbler(ctx, p, now) {
  var r = smooth('p-' + p.id, p.x, p.y, p.a);
  var hx = smooth('h-' + p.id + '-0', p.hx[0], p.hy[0], 0);
  var hy = smooth('h-' + p.id + '-1', p.hx[1], p.hy[1], 0);
  var hd = smooth('head-' + p.id, p.headX, p.headY, 0);
  var moving = Math.abs(p.vx) > 0.35;
  var swing = moving ? Math.sin(now / 95 + p.id.length) : 0;
  // legs
  ctx.strokeStyle = '#1e2a44'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(r.x - 8, r.y + 19); ctx.lineTo(r.x - 8 + swing * 9, r.y + 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r.x + 8, r.y + 19); ctx.lineTo(r.x + 8 - swing * 9, r.y + 32); ctx.stroke();
  // arms to hands
  ctx.lineWidth = 7; ctx.strokeStyle = p.color;
  ctx.beginPath(); ctx.moveTo(r.x - 13, r.y - 6); ctx.lineTo(hx.x, hx.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r.x + 13, r.y - 6); ctx.lineTo(hy.x, hy.y); ctx.stroke();
  // torso
  ctx.fillStyle = p.color; ctx.strokeStyle = '#1e2a44'; ctx.lineWidth = 3;
  roundRect(ctx, r.x - 15, r.y - 23, 30, 46, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; roundRect(ctx, r.x - 9, r.y - 16, 18, 9, 4); ctx.fill();
  // hands
  [hx, hy].forEach(function (h, i) {
    ctx.fillStyle = p.grab[i] ? '#f2b544' : '#ffe0bd'; ctx.strokeStyle = '#1e2a44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (p.grab[i]) { ctx.strokeStyle = '#f2b544'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y, 13, 0, Math.PI * 2); ctx.stroke(); }
  });
  // head with eyes
  var look = Math.max(-4, Math.min(4, p.vx * 2));
  ctx.fillStyle = '#ffe0bd'; ctx.strokeStyle = '#1e2a44'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(hd.x, hd.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hd.x - 4.5 + look, hd.y - 1, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hd.x + 4.5 + look, hd.y - 1, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e2a44'; ctx.beginPath(); ctx.arc(hd.x - 4.5 + look * 1.6, hd.y - 1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hd.x + 4.5 + look * 1.6, hd.y - 1, 2, 0, Math.PI * 2); ctx.fill();
  // name pill (stagger labels so a crowded team stays readable)
  var lift = 40 + ((p.id.charCodeAt(1) || 0) % 3) * 15;
  var shift = (((p.id.charCodeAt(p.id.length - 1) || 0) % 5) - 2) * 15;
  var lx = hd.x + shift;
  var label = p.emoji + ' ' + p.name + (p.bot ? ' 🤖' : '');
  ctx.font = 'bold 11px system-ui'; var tw = ctx.measureText(label).width + 16;
  ctx.fillStyle = 'rgba(255,255,255,.92)'; roundRect(ctx, lx - tw / 2, hd.y - lift, tw, 20, 10); ctx.fill();
  ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1e2a44'; ctx.textAlign = 'center'; ctx.fillText(label, lx, hd.y - lift + 14);
  // speech bubble
  if (p.bubble) {
    ctx.font = 'bold 13px system-ui'; var bw = ctx.measureText(p.bubble).width + 22;
    ctx.fillStyle = '#1e2a44'; roundRect(ctx, lx - bw / 2, hd.y - lift - 34, bw, 26, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(p.bubble, lx, hd.y - lift - 16);
  }
}
function drawCoreTrail(ctx) {
  if (coreTrail.length < 2) return;
  ctx.save(); ctx.strokeStyle = 'rgba(242,181,68,.35)'; ctx.lineWidth = 3; ctx.setLineDash([3, 9]);
  ctx.beginPath(); coreTrail.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}
function drawFx(ctx, now) {
  state.fx.forEach(function (f) {
    var age = (Date.now() - f.at) / 1000, alpha = Math.max(0, 1 - age / 2.2);
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    if (f.kind === 'poof' || f.kind === 'splash') {
      var col = f.kind === 'splash' ? '#5ac8e8' : '#ffffff';
      ctx.strokeStyle = col; ctx.lineWidth = 4;
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 + age;
        ctx.beginPath(); ctx.arc(f.x, f.y, 12 + age * 34, a, a + 0.5); ctx.stroke();
      }
      ctx.fillStyle = '#1e2a44'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(f.kind === 'splash' ? 'SPLASH!' : 'poof', f.x, f.y - 30 - age * 22);
    } else if (f.kind === 'plate') {
      ctx.strokeStyle = '#ef6f5b'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(f.x, f.y - 12, 14 + age * 60, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'drop') {
      ctx.fillStyle = '#1e2a44'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('+ ' + f.kind.toUpperCase() + ' by ' + f.who, f.x, f.y - 20 - age * 20);
    } else if (f.kind === 'jump') {
      ctx.strokeStyle = 'rgba(30,42,68,.4)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 24, 10 + age * 22, 4 + age * 7, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'call') {
      ctx.fillStyle = '#1e2a44'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y - age * 18);
    } else if (f.kind === 'win') {
      for (var j = 0; j < 14; j++) {
        ctx.fillStyle = ['#ef6f5b','#3aa6a0','#f2b544','#8b6fd4'][j % 4];
        var xx = f.x || 700, yy = f.y || 300;
        ctx.fillRect(xx - 220 + j * 32, yy - 120 + (j * 37 + age * 90) % 240, 7, 12);
      }
    }
    ctx.restore();
  });
}
function drawWorld(ctx, L, now) {
  state.water.forEach(function (r) { drawWater(ctx, r, now); });
  state.wind.forEach(function (r) { drawWind(ctx, r, now); });
  drawCoreTrail(ctx);
  drawSeesaws(ctx, state.seesaws || []);
  // static + simple bodies
  state.bodies.forEach(function (b) {
    if (b.kind === 'rope' || b.kind === 'core') return;
    var r = smooth('b-' + b.id, b.x, b.y, b.a);
    var bb = Object.assign({}, b, { x: r.x, y: r.y, a: r.a });
    if (b.kind === 'ground' || b.kind === 'deck') drawGround(ctx, bb);
    else if (b.kind === 'wall') { ctx.fillStyle = '#3a4761'; ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a); ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore(); }
    else if (b.kind === 'ledge' || b.kind === 'slope') drawPlank(ctx, Object.assign({}, bb, { w: b.w, h: b.h || 22 }));
    else if (b.kind === 'sign') drawSign(ctx, bb);
    else if (b.kind === 'plate') drawPlate(ctx, bb);
    else if (b.kind === 'gate') drawGate(ctx, bb);
    else if (b.kind === 'plank') drawPlank(ctx, bb);
    else if (b.kind === 'crate') drawCrate(ctx, bb);
    else if (b.kind === 'barrel') drawBarrel(ctx, bb);
  });
  drawRopes(ctx, state.bodies);
  drawBeacon(ctx, state.goal, now);
  var core = state.bodies.find(function (b) { return b.kind === 'core'; });
  if (core) {
    var cr = smooth('b-' + core.id, core.x, core.y, core.a);
    drawCore(ctx, Object.assign({}, core, { x: cr.x, y: cr.y }), now);
    coreTrail.push({ x: cr.x, y: cr.y }); if (coreTrail.length > 34) coreTrail.shift();
  }
  state.players.forEach(function (p) { drawWobbler(ctx, p, now); });
  drawFx(ctx, now);
}
function draw() {
  requestAnimationFrame(draw);
  if (!state) return;
  var canvas = isBoard ? $('stage') : $('mini'); if (!canvas) return;
  var cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch) return;
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, ch);
  drawBackground(ctx, cw, ch);
  var cam = camera(state.level, cw, ch), now = Date.now();
  ctx.save();
  ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (cw / 2 - cam.x * cam.s), dpr * (ch / 2 - cam.y * cam.s));
  drawWorld(ctx, state.level, now);
  ctx.restore();
}

// ---------- boot ----------
if (isBoard) { $('board').classList.add('active'); buildTabs(); buildQR(); boardBinds(); }
else { $('controller').classList.add('active'); controllerBinds(); }
if (!isBoard && !localStorage.getItem('ww-name')) showGate(); else connect();
requestAnimationFrame(draw);
})();
