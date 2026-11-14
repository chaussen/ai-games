'use strict';
(function () {
  // ── setup ───────────────────────────────────────────────────────────────
  var params = new URLSearchParams(location.search);
  var isBoard = params.get('board') === '1';
  var EMOJIS = ['🦊','🐻','🐼','🐨','🦉','🐢','🐙','🦋','🐳','🌙','⭐','🍄'];
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var ws = null, me = null, state = null, connected = false;
  var clockOffset = 0, samples = [];
  var name = '', emoji = EMOJIS[0];
  var lanternEls = {}, lanternSig = '', pos = {}, lines = [];
  var shownTurnStart = 0, pendingFrom = null, currentTarget = null, lastLevel = 1;
  var audio = null, lastTapAt = 0, toastTimer = null, starFrame = 0;
  var sctx = null, sw = 0, sh = 0, stars = [];
  var cfg = window.FIREFLY_CONFIG || { lanIPs: [], port: location.port };
  var joinURL = 'http://' + (cfg.lanIPs[0] || location.hostname) + ':' + cfg.port + '/';

  function serverNow() { return Date.now() + clockOffset; }
  function stamp() { return Date.now() + clockOffset; }
  function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
  function playerById(id) { return state && state.players.filter(function (p) { return p.id === id; })[0]; }
  function mePlayer() { return playerById(me); }

  // ── tiny offline sound (created on first user gesture) ──────────────────
  function ensureAudio() {
    if (audio) return;
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  function tone(freq, dur, type, vol, delay) {
    if (!audio) return;
    try {
      if (audio.state === 'suspended') audio.resume();
      var t0 = audio.currentTime + (delay || 0);
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) { /* ignore */ }
  }
  function sfx(kind) {
    if (kind === 'hit') { tone(660, 0.16, 'sine', 0.10); tone(990, 0.22, 'sine', 0.055, 0.05); }
    else if (kind === 'chorus') { tone(523, 0.30, 'sine', 0.09); tone(659, 0.30, 'sine', 0.09, 0.04); tone(784, 0.36, 'sine', 0.09, 0.08); }
    else if (kind === 'miss') tone(190, 0.28, 'sine', 0.07);
    else if (kind === 'count') tone(520, 0.12, 'triangle', 0.07);
    else if (kind === 'round') { tone(523, 0.25, 'sine', 0.09); tone(784, 0.42, 'sine', 0.09, 0.12); }
    else if (kind === 'tap') tone(330, 0.07, 'sine', 0.045);
  }

  // ── connection + clock sync ─────────────────────────────────────────────
  function sendHello() {
    send({ t: 'hello', role: isBoard ? 'board' : 'controller', name: name, emoji: emoji });
  }
  function doPings() {
    samples = [];
    for (var i = 0; i < 4; i++) {
      (function (k) { setTimeout(function () { send({ t: 'ping', c0: Date.now() }); }, k * 160); })(i);
    }
  }
  function updateConn() {
    var e = $('c-conn'); if (!e) return;
    e.className = 'conn' + (connected ? '' : ' off');
    e.title = connected ? 'connected to the LAN host' : 'reconnecting…';
  }
  function connect() {
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws');
    ws.onopen = function () {
      connected = true; updateConn(); doPings();
      if (isBoard || name) sendHello();
    };
    ws.onmessage = function (e) {
      var msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
      onMessage(msg);
    };
    ws.onclose = function () { connected = false; updateConn(); setTimeout(connect, 1500); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }

  function onMessage(msg) {
    switch (msg.t) {
      case 'pong': {
        var c1 = Date.now();
        var rtt = (c1 - msg.c0) - (msg.s2 - msg.s1);
        var off = ((msg.s1 - msg.c0) + (msg.s2 - c1)) / 2;
        samples.push({ rtt: rtt, off: off });
        var best = samples[0];
        samples.forEach(function (s) { if (s.rtt < best.rtt) best = s; });
        clockOffset = best.off;
        break;
      }
      case 'welcome':
        me = msg.you; trackTurn(msg.state); state = msg.state; lastLevel = state.level; render();
        if (isBoard) setTimeout(layoutLanterns, 30);
        break;
      case 'state':
        trackTurn(msg); state = msg; render();
        break;
      case 'countdown': showCount(msg.n); break;
      case 'turnResult': onTurnResult(msg); break;
      case 'roundEnd': showRoundEnd(msg); break;
      case 'fx':
        if (msg.kind === 'hit' && !isBoard) popOrb();
        break;
    }
  }
  function trackTurn(s) {
    if (!s) return;
    var t = s.turn;
    if (t && !t.resolved && t.startAt !== shownTurnStart) {
      pendingFrom = currentTarget;
      currentTarget = t.targets[0];
      shownTurnStart = t.startAt;
    }
  }

  // ── starfield + persistent "family sky" ─────────────────────────────────
  function resizeStars() {
    var c = $('stars'); if (!c) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    sw = c.clientWidth; sh = c.clientHeight;
    c.width = Math.max(1, sw * dpr); c.height = Math.max(1, sh * dpr);
    sctx = c.getContext('2d'); sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function initStars() {
    resizeStars();
    window.addEventListener('resize', resizeStars);
    for (var i = 0; i < 130; i++) {
      stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.3,
                   a: Math.random() * 6.28, s: Math.random() * 0.0016 + 0.0004 });
    }
  }
  function drawStars(ts) {
    if (!sctx) return;
    sctx.clearRect(0, 0, sw, sh);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], a = 0.22 + 0.42 * (0.5 + 0.5 * Math.sin(ts * s.s + s.a));
      sctx.fillStyle = 'rgba(214,226,255,' + a.toFixed(3) + ')';
      sctx.beginPath(); sctx.arc(s.x * sw, s.y * sh, s.r, 0, 6.283); sctx.fill();
    }
    var n = state && state.sky ? Math.min(state.sky.stars || 0, 70) : 0;
    for (var k = 0; k < n; k++) {
      var x = (((k * 73 + 11) % 97) / 97) * sw;
      var y = (((k * 41 + 7) % 89) / 89) * sh * 0.82 + 8;
      var tw = 0.65 + 0.35 * Math.sin(ts * 0.002 + k);
      sctx.fillStyle = 'rgba(255,209,102,' + (tw * 0.9).toFixed(3) + ')';
      sctx.beginPath(); sctx.arc(x, y, 2.1, 0, 6.283); sctx.fill();
      sctx.fillStyle = 'rgba(255,209,102,' + (tw * 0.13).toFixed(3) + ')';
      sctx.beginPath(); sctx.arc(x, y, 8, 0, 6.283); sctx.fill();
    }
  }

  // ── BOARD rendering ─────────────────────────────────────────────────────
  function syncLanterns() {
    var sig = state.players.map(function (p) { return p.id + ':' + p.name + ':' + p.color + ':' + p.emoji; }).join('|');
    if (sig === lanternSig) return;
    lanternSig = sig;
    var wrap = $('lanterns'); wrap.innerHTML = ''; lanternEls = {};
    state.players.forEach(function (p) {
      var d = el('div', 'lantern'); d.style.setProperty('--c', p.color); d.dataset.id = p.id;
      var ring = el('div', 'ring'), bulb = el('div', 'bulb', p.emoji);
      var nm = el('div', 'name', p.name), tag = el('div', 'tag', p.bot ? 'DEMO FIREFLY' : 'LANTERN');
      d.appendChild(ring); d.appendChild(bulb); d.appendChild(nm); d.appendChild(tag);
      wrap.appendChild(d);
      lanternEls[p.id] = { root: d, ring: ring, bulb: bulb };
    });
    layoutLanterns();
  }
  function layoutLanterns() {
    var st = $('stage'); if (!st || !state) return;
    var w = st.clientWidth, h = st.clientHeight, n = state.players.length;
    if (!w || !h || !n) return;
    var r = Math.min(w, h) * (n <= 3 ? 0.30 : 0.355), cx = w / 2, cy = h / 2;
    pos = {};
    state.players.forEach(function (p, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      var x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      var e = lanternEls[p.id];
      if (e) { e.root.style.left = x + 'px'; e.root.style.top = y + 'px'; }
    });
    // Anchor the spark and constellation lines to the glowing bulb itself,
    // not the whole lantern block (which also contains a name + tag).
    var sr = st.getBoundingClientRect();
    state.players.forEach(function (p) {
      var e = lanternEls[p.id]; if (!e) return;
      var br = e.bulb.getBoundingClientRect();
      pos[p.id] = { x: br.left + br.width / 2 - sr.left, y: br.top + br.height / 2 - sr.top };
    });
    var svg = $('constellation');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    redrawLines(); updateSpark();
  }
  function redrawLines() {
    lines.forEach(function (l) {
      if (!pos[l.a] || !pos[l.b]) return;
      l.el.setAttribute('x1', pos[l.a].x); l.el.setAttribute('y1', pos[l.a].y);
      l.el.setAttribute('x2', pos[l.b].x); l.el.setAttribute('y2', pos[l.b].y);
    });
  }
  function clearLines() {
    var svg = $('constellation');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    lines = [];
  }
  function drawLine(a, b) {
    if (a == null || b == null || !pos[a] || !pos[b]) return;
    var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', pos[a].x); ln.setAttribute('y1', pos[a].y);
    ln.setAttribute('x2', pos[b].x); ln.setAttribute('y2', pos[b].y);
    ln.setAttribute('stroke', 'rgba(255,222,150,.6)');
    ln.setAttribute('stroke-width', '2'); ln.setAttribute('stroke-linecap', 'round');
    ln.style.filter = 'drop-shadow(0 0 5px rgba(255,209,102,.9))';
    ln.style.opacity = '0'; ln.style.transition = 'opacity .4s';
    $('constellation').appendChild(ln);
    lines.push({ a: a, b: b, el: ln });
    requestAnimationFrame(function () { ln.style.opacity = '1'; });
    while (lines.length > 18) { var old = lines.shift(); if (old.el.parentNode) old.el.parentNode.removeChild(old.el); }
  }
  function updateSpark() {
    var sp = $('spark'), t = state && state.turn;
    if (!t || t.resolved || !t.targets.length || !pos[t.targets[0]]) { sp.classList.remove('on'); return; }
    var p = pos[t.targets[0]];
    sp.style.left = p.x + 'px'; sp.style.top = p.y + 'px'; sp.classList.add('on');
  }
  function flashLantern(id) {
    var e = lanternEls[id]; if (!e) return;
    e.root.classList.add('hit'); setTimeout(function () { e.root.classList.remove('hit'); }, 420);
  }
  function renderBoard() {
    $('b-time').textContent = state.timeLeft;
    $('b-score').textContent = fmt(state.score);
    $('b-combo').textContent = '×' + state.combo;
    $('b-level').textContent = state.level;
    $('b-light').style.width = state.light + '%';
    $('b-light-num').textContent = state.light + '%';
    $('b-stars').textContent = state.sky ? (state.sky.stars || 0) : 0;
    $('join-url').textContent = joinURL;

    $('lobby').classList.toggle('hidden', state.phase !== 'lobby');
    if (state.phase !== 'roundEnd') $('roundend').classList.add('hidden');
    if (state.phase === 'playing') $('countdown').classList.add('hidden');

    var chips = $('lobby-players'); chips.innerHTML = '';
    if (!state.players.length) chips.appendChild(el('div', 'chip empty', 'No lanterns yet — scan the code'));
    state.players.forEach(function (p) {
      var c = el('div', 'chip' + (p.bot ? ' bot' : ''), p.emoji + '  ' + p.name + (p.bot ? ' (demo)' : ''));
      c.style.setProperty('--c', p.color); chips.appendChild(c);
    });

    syncLanterns();
    var t = state.turn, active = (t && !t.resolved) ? t.targets : [];
    state.players.forEach(function (p) {
      var e = lanternEls[p.id]; if (!e) return;
      var on = active.indexOf(p.id) >= 0;
      e.root.classList.toggle('active', on);
      e.root.classList.toggle('dim', state.phase === 'playing' && !on);
    });
    $('stage').classList.toggle('chorus', !!(t && !t.resolved && t.type === 'chorus'));
    updateSpark();

    var cap = '', sub = '';
    if (state.phase === 'lobby') { cap = 'Get everyone on the same Wi-Fi'; sub = 'One tap is the whole game'; }
    else if (state.phase === 'countdown') { cap = 'Get ready…'; sub = 'Round starting'; }
    else if (state.phase === 'playing') {
      if (!t || t.resolved) { cap = 'Keep the chain alive…'; sub = 'Chain ×' + state.combo + ' · next lantern lighting up'; }
      else if (t.type === 'chorus') { cap = 'HARMONY — EVERYONE TAP!'; sub = 'All lanterns at once · double points'; }
      else { var p = playerById(t.targets[0]); cap = (p ? p.name : 'Someone') + ', your turn!'; sub = 'Tap before the ring closes'; }
    } else { cap = 'The sky got brighter'; sub = 'One more round?'; }
    $('b-caption').textContent = cap; $('b-subcaption').textContent = sub;
    $('b-status').textContent = state.phase === 'playing'
      ? 'Level ' + state.level + ' · ' + state.passes + ' passes · ' + state.players.length + ' lanterns'
      : (state.phase === 'lobby' ? 'Lobby · ' + state.players.length + ' lanterns connected' : 'Round complete · press play again');
  }

  // ── CONTROLLER rendering ────────────────────────────────────────────────
  function renderController() {
    var p = mePlayer();
    if (p) {
      document.documentElement.style.setProperty('--me', p.color);
      $('c-avatar').textContent = p.emoji; $('c-name').textContent = p.name;
    }
    $('c-combo').textContent = '×' + state.combo;
    $('c-score').textContent = fmt(state.score);
    $('c-hits').textContent = p ? p.hits : 0;
    $('c-streak').textContent = (p && p.streak >= 3) ? '🔥 ' + p.streak + ' in a row for you!' : '';
    $('c-roundend').classList.toggle('hidden', state.phase !== 'roundEnd');

    var t = state.turn;
    var myTurn = state.phase === 'playing' && t && !t.resolved && t.targets.indexOf(me) >= 0;
    var already = t && t.hits.indexOf(me) >= 0;
    var btn = $('tap-btn'), label = $('tap-label'), sub = $('tap-sub');

    if (state.phase === 'lobby') {
      $('c-sub').textContent = 'You are lantern ' + (p ? p.color : '✦');
      $('c-prompt').textContent = 'Get comfy ✦';
      $('c-hint').textContent = 'Look at the big screen. Your lantern will light up.';
      btn.className = 'tap-btn idle'; label.textContent = 'READY'; sub.textContent = 'the host starts the round';
    } else if (state.phase === 'countdown') {
      $('c-prompt').textContent = 'Get ready…'; $('c-hint').textContent = 'Here comes the first glow';
      btn.className = 'tap-btn idle'; label.textContent = 'READY'; sub.textContent = 'almost…';
    } else if (state.phase === 'roundEnd') {
      $('c-sub').textContent = 'Round complete';
    } else if (myTurn && already) {
      btn.className = 'tap-btn idle'; label.textContent = '✓ GOT IT'; sub.textContent = 'waiting for everyone';
      $('c-prompt').textContent = 'Nice! ✦'; $('c-hint').textContent = 'Hold tight — the chain keeps going.';
    } else if (myTurn) {
      btn.className = 'tap-btn ready';
      label.textContent = t.type === 'chorus' ? 'TAP TOGETHER!' : 'TAP NOW!';
      sub.textContent = t.type === 'chorus' ? 'everyone at once' : 'your lantern is glowing';
      $('c-prompt').textContent = t.type === 'chorus' ? 'HARMONY!' : 'YOUR LANTERN IS GLOWING';
      $('c-hint').textContent = 'Tap before the ring closes.';
      $('c-sub').textContent = 'Go! · level ' + state.level;
    } else {
      btn.className = 'tap-btn idle'; label.textContent = 'WAIT'; sub.textContent = 'watch the big screen';
      var nx = (t && !t.resolved) ? playerById(t.targets[0]) : null;
      $('c-prompt').textContent = 'Watch the big screen…';
      $('c-hint').textContent = nx ? (nx.name + ' is up — cheer them on!') : 'Your lantern will light up soon.';
      $('c-sub').textContent = 'Chain ×' + state.combo;
    }
  }
  function render() { if (!state) return; if (isBoard) renderBoard(); else renderController(); }

  // ── events / effects ────────────────────────────────────────────────────
  function popOrb() {
    var o = $('c-orb'); if (!o) return;
    o.classList.remove('pop'); void o.offsetWidth; o.classList.add('pop');
  }
  function showToast(text, miss) {
    var t = $('c-toast'); t.textContent = text;
    t.className = 'toast show' + (miss ? ' miss' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, 1150);
  }
  function showCount(n) {
    var ov = $('countdown');
    if (n <= 0) { ov.classList.add('hidden'); return; }
    if (isBoard) {
      ov.classList.remove('hidden');
      var d = $('count-num'); d.textContent = n;
      d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
      sfx('count');
      if (n === 3) { clearLines(); shownTurnStart = 0; currentTarget = null; pendingFrom = null; }
    } else {
      $('c-prompt').textContent = 'Get ready…';
      $('c-hint').textContent = 'Round starting in ' + n;
    }
  }
  function onTurnResult(msg) {
    if (msg.ok) {
      if (isBoard) {
        if (msg.type === 'chorus') {
          msg.targets.forEach(function (id) { drawLine(pendingFrom, id); flashLantern(id); });
        } else {
          drawLine(pendingFrom, currentTarget);
          msg.hits.forEach(flashLantern);
        }
      } else if (msg.hits.indexOf(me) >= 0) {
        // Only your own hit gets a toast — teammates' passes are already
        // visible on the shared board, so phones stay calm.
        popOrb(); showToast(msg.kind === 'chorus' ? 'HARMONY +' + fmt(msg.gain) : '+' + fmt(msg.gain));
      }
      sfx(msg.kind === 'chorus' ? 'chorus' : 'hit');
      if (msg.level > lastLevel && isBoard) {
        var f = $('level-flash'); f.textContent = 'LEVEL ' + msg.level;
        f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
        sfx('round');
        setTimeout(function () { f.classList.remove('go'); }, 1150);
      }
    } else {
      sfx('miss');
      if (!isBoard) showToast('The glow slipped — it comes right back', true);
    }
    lastLevel = msg.level;
  }
  function showRoundEnd(msg) {
    sfx('round');
    if (!isBoard) return;
    $('roundend').classList.remove('hidden');
    $('end-title').textContent = msg.reason === 'faded' ? 'The glow faded — relight it?' : 'The sky got brighter';
    $('end-sub').textContent = 'Every round adds a star to your family sky.';
    $('end-score').textContent = fmt(msg.score);
    $('end-combo').textContent = '×' + msg.bestCombo;
    $('end-passes').textContent = msg.passes;
    $('end-stars').textContent = msg.sky.stars;
    var wrap = $('end-team'); wrap.innerHTML = '';
    msg.stats.forEach(function (p) {
      var c = el('div', 'chip' + (p.bot ? ' bot' : ''), p.emoji + '  ' + p.name + ' · ' + p.hits + ' passes');
      c.style.setProperty('--c', p.color); wrap.appendChild(c);
    });
  }
  function tap() {
    var now = Date.now(); if (now - lastTapAt < 130) return;
    lastTapAt = now; ensureAudio(); sfx('tap');
    if (navigator.vibrate) navigator.vibrate(18);
    send({ t: 'tap', sentAt: stamp() });
    popOrb();
  }

  // ── animation loop: timing rings + window bar + stars ───────────────────
  function loop(ts) {
    starFrame++;
    if (starFrame % 2 === 0) drawStars(ts);
    var t = state && state.turn, playing = state && state.phase === 'playing';
    var progress = 1;
    if (playing && t && !t.resolved) progress = clamp((serverNow() - t.startAt) / t.windowMs, 0, 1);
    var active = (playing && t && !t.resolved) ? t.targets : [];
    if (isBoard) {
      Object.keys(lanternEls).forEach(function (id) {
        var e = lanternEls[id];
        if (active.indexOf(Number(id)) >= 0) {
          e.ring.style.opacity = String(0.9 - 0.25 * progress);
          e.ring.style.transform = 'translate(-50%,-50%) scale(' + (1.85 - 0.85 * progress).toFixed(3) + ')';
        } else e.ring.style.opacity = '0';
      });
    } else {
      var myTurn = playing && t && !t.resolved && t.targets.indexOf(me) >= 0 && t.hits.indexOf(me) < 0;
      $('window-fill').style.width = myTurn ? ((1 - progress) * 100).toFixed(1) + '%' : '0%';
    }
    requestAnimationFrame(loop);
  }

  // ── bindings ────────────────────────────────────────────────────────────
  function buildEmojiPicker() {
    var wrap = $('emoji-pick'); wrap.innerHTML = '';
    EMOJIS.forEach(function (em) {
      var b = el('button', em === emoji ? 'sel' : '', em); b.type = 'button';
      b.onclick = function () {
        emoji = em;
        Array.prototype.forEach.call(wrap.children, function (c) { c.className = ''; });
        b.className = 'sel';
      };
      wrap.appendChild(b);
    });
  }
  function join() {
    name = ($('name-input').value || 'Friend').trim().slice(0, 14) || 'Friend';
    try { localStorage.setItem('fr-name', name); localStorage.setItem('fr-emoji', emoji); } catch (e) {}
    $('join-gate').classList.add('hidden');
    ensureAudio();
    sendHello();
  }
  function bind() {
    if (isBoard) {
      var qr = qrcode(0, 'M');
      qr.addData(joinURL); qr.make();
      $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 1 });
      $('copy-url').onclick = function () {
        ensureAudio();
        if (navigator.clipboard) navigator.clipboard.writeText(joinURL).then(function () {
          $('copy-url').textContent = 'Copied!'; setTimeout(function () { $('copy-url').textContent = 'Copy link'; }, 1400);
        });
      };
      $('btn-start').onclick = function () { ensureAudio(); send({ t: 'start' }); };
      $('btn-again').onclick = function () { ensureAudio(); send({ t: 'start' }); };
      $('btn-bot').onclick = function () { ensureAudio(); send({ t: 'addBot' }); };
      $('btn-kickbot').onclick = function () { send({ t: 'kickBot' }); };
      $('btn-reset-sky').onclick = function () { send({ t: 'resetSky' }); };
      window.addEventListener('resize', layoutLanterns);
    } else {
      $('join-btn').onclick = join;
      $('name-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') join(); });
      $('change-name').onclick = function () { $('join-gate').classList.remove('hidden'); };
      $('c-avatar').onclick = function () { buildEmojiPicker(); $('name-input').value = name; $('join-gate').classList.remove('hidden'); };
      $('ctrl-body').addEventListener('pointerdown', function (e) { e.preventDefault(); tap(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); }
      });
    }
  }
  function boot() {
    $('board').classList.toggle('hidden', !isBoard);
    $('controller').classList.toggle('hidden', isBoard);
    try {
      name = localStorage.getItem('fr-name') || '';
      emoji = localStorage.getItem('fr-emoji') || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    } catch (e) { name = ''; emoji = EMOJIS[0]; }
    initStars(); buildEmojiPicker(); bind();
    if (!isBoard && !name) $('join-gate').classList.remove('hidden');
    connect();
    requestAnimationFrame(loop);
  }
  boot();
})();
