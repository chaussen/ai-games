// app.js — the Shenbi phone page. The server steps the world (docs/CHARTER §2: authoritative, co-op a must);
// this page never steps: it restores() the snapshots it receives and draws them flat. The docked pad
// (docs/CHARTER §5) recognises locally (vendor/recogniser.js) and sends only the chosen character.
(function () {
  'use strict';
  const WSim = window.WSim, WReact = window.WReact, CARDS = window.WContent.cards;
  const $ = s => document.querySelector(s);
  const CARD = {}; for (const c of CARDS) CARD[c.ch] = c;

  const UI = {
    padWait: 0.5,          // s of stillness before the pad reads (forge-2d value; tune on phones)
    padMinScore: 0.65,     // a guess under this is not offered (write-test.mjs measured why)
    sendHz: 20,            // input messages a second
    viewH: 24,             // cells visible top to bottom (a knob, not per level)
    padShift: 0.5,         // of the pad width: how far the camera slides so the pad never covers you
  };

  // ---------- flat look (Phase 1C): one plain fill per thing, no gradients, no alpha ----------
  const MAT_COLOR = {
    air: '#f5efe0', dirt: '#8a5a33', stone: '#8d8b83', wood: '#a06a2c', plant: '#57913d',
    water: '#4a7fb5', fire: '#d4562a', ash: '#b9b3a8', steam: '#dcdcdc', mud: '#6b4a2f',
    ice: '#bfe3ef', metal: '#9aa2ab',
  };
  const PLAYER_COLOR = ['#c94f30', '#3e7fae', '#5d9155', '#b98a2e'];   // by seat slot
  const EVENT_TEXT = [
    [/^give (.)/, (ch) => ch + ' ' + py(ch) + ' · in your hand'],
    [/^throw (.)/, (ch) => ch + ' ' + py(ch) + ' · thrown'],
    [/^place (.)/, (ch) => ch + ' ' + py(ch) + ' · put down'],
    [/^pour (.)/, (m) => 'pouring ' + ({ water: '水 shuǐ' }[m] || m)],
    [/^R9/, () => 'singed! 烫 tàng'],
    [/^R10/, () => 'soaked 湿 shī'],
    [/^R27/, () => 'chilled 冷 lěng'],
    [/^R12/, () => 'bonk! 推 tuī'],
    [/^R11 land (.)/, (m) => ({ dirt: '土 tǔ', water: '水 shuǐ', fire: '火 huǒ', ice: '冰 bīng', stone: '石 shí' }[m] || m) + ' landed'],
    [/^R6/, () => '木 mù grows a tree!'],
    [/^R3/, () => 'wood burns! 燃 rán'],
    [/^R2/, () => 'pssssh — steam 汽 qì'],
  ];
  function py(ch) { const c = CARD[ch]; return c ? c.py : ch; }
  function en(ch) { const c = CARD[ch]; return c ? c.en : ''; }

  // ---------- state ----------
  let ws = null, me = null, slot = 0, world = null, crewMax = 4, joined = false;
  const input = { mx: 0, jump: false, calm: false };
  let aim = null, aimAge = 99;          // sticky aim (world units), sent with the next act
  const pending = { in: false, aim: false };
  let lastSent = { mx: 0, jump: false, calm: false };
  const evq = [];                        // events waiting to be shown as the msg line

  function makeWorld(info) {
    world = new WSim.World({ w: info.w, h: info.h, seed: info.seed || 11, cards: CARDS, profile: info.profile, body: info.body });
  }

  // ---------- connection ----------
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', id: myId() }));
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'joined') {
        me = m.id; slot = m.slot | 0; crewMax = m.max; joined = true;
        makeWorld(m);
        $('#join').hidden = true;
      } else if (m.t === 'full') {
        $('#join-tip').textContent = 'The crew is full — four seats. Wait for a friend to leave, then tap here.';
        $('#join').hidden = false; $('#join').onclick = () => location.reload();
      } else if (m.t === 'snap') {
        if (!world) makeWorld({ w: 160, h: 90, profile: 'standard', body: 'playful' });
        world.applyWire(m.s);
        for (const ev of (m.e || [])) evq.push(ev);
        if (!joined && me) { joined = true; $('#join').hidden = true; }
      } else if (m.t === 'roster') {
        drawCrew(m.players);
      } else if (m.t === 'wrote') {
        wrote(m);
      }
    };
    ws.onclose = () => {
      joined = false; me = null;
      $('#join').hidden = false;
      $('#join-tip').textContent = 'Lost the crew. Reconnecting…';
      setTimeout(connect, 1500);
    };
  }
  // a stable id so a refresh takes your seat back (the server keeps it 30 s)
  function myId() {
    let id = null;
    try { id = localStorage.getItem('shenbi-id'); } catch (e) {}
    if (!id) { id = 'p-' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem('shenbi-id', id); } catch (e) {} }
    return id;
  }
  function drawCrew(players) {
    const el = $('#crew');
    el.innerHTML = '';
    for (let i = 0; i < crewMax; i++) {
      const p = (players || []).find(q => (q.slot | 0) === i);
      const d = document.createElement('i');
      if (p && p.here) { d.className = 'here'; d.style.background = PLAYER_COLOR[i]; d.title = 'friend ' + (i + 1); }
      el.appendChild(d);
    }
  }

  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  function maybeSendIn() {
    if (!me) return;
    if (input.mx !== lastSent.mx || input.jump !== lastSent.jump || input.calm !== lastSent.calm || pending.in) {
      send({ t: 'in', mx: input.mx, jump: input.jump, calm: input.calm });
      lastSent = { mx: input.mx, jump: input.jump, calm: input.calm };
      pending.in = false;
    }
    if (aim && pending.aim) { send({ t: 'aim', ax: aim.x, ay: aim.y }); pending.aim = false; }
  }
  setInterval(maybeSendIn, 1000 / UI.sendHz);
  const act = (what) => { if (me) { send({ t: 'act', what }); if (aim) send({ t: 'aim', ax: aim.x, ay: aim.y }); } };

  // ---------- the stick, jump, verbs, keys ----------
  function stick(el) {
    const set = (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      input.mx = Math.max(-1, Math.min(1, dx * 1.4));
      el.style.setProperty('--dx', input.mx * (r.width / 2 - 26) + 'px');
    };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); set(e); });
    el.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure > 0) set(e); });
    const end = () => { input.mx = 0; el.style.setProperty('--dx', '0px'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  stick($('#stick'));
  const hold = (el, on, off) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); on(); });
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  };
  hold($('#jump'), () => { input.jump = true; }, () => { input.jump = false; });
  $('#calm').addEventListener('click', () => {
    input.calm = !input.calm;
    $('#calm').classList.toggle('on', input.calm);
    pending.in = true;
    msg(input.calm ? 'calm 静 jìng — friends cannot target you' : 'you can be played with again');
  });
  for (const b of document.querySelectorAll('#verbs button')) b.addEventListener('click', () => act(b.dataset.v));
  addEventListener('keydown', (e) => {
    if (padOpen) { padKey(e); return; }
    if (e.code === 'ArrowLeft') input.mx = -1;
    if (e.code === 'ArrowRight') input.mx = 1;
    if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
    if (e.code === 'Digit1') act('wield');
    if (e.code === 'Digit2') act('throw');
    if (e.code === 'Digit3') act('place');
    if (e.code === 'KeyC') openPad();
    if (e.code === 'KeyH') act('home');
    if (e.code === 'KeyX') $('#calm').click();
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' && input.mx < 0) input.mx = 0;
    if (e.code === 'ArrowRight' && input.mx > 0) input.mx = 0;
    if (e.code === 'Space') input.jump = false;
  });

  // ---------- aim by dragging the world ----------
  const canvas = $('#world');
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); aimFrom(e); });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons) aimFrom(e); });
  function aimFrom(e) {
    if (!me || !world) return;
    const p = world.player(me); if (!p) return;
    const [px, py_, scale] = camera();
    const wx = px + (e.clientX - innerWidth / 2) / scale, wy = py_ - (e.clientY - innerHeight / 2) / scale;
    const dx = wx - p.x, dy = wy - (p.y + 0.75), l = Math.hypot(dx, dy);
    if (l < 0.2) return;
    aim = { x: dx / l, y: dy / l }; aimAge = 0; pending.aim = true;
  }

  // ---------- the msg line ----------
  let msgTimer = 0;
  function msg(text) {
    const el = $('#msg');
    el.textContent = text; el.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function eventsTick() {
    while (evq.length) {
      const ev = evq.shift();
      for (const [re, say] of EVENT_TEXT) {
        const m = ev.match(re);
        if (m) { msg(say(m[1])); break; }
      }
    }
  }

  // ---------- camera + render ----------
  function camera() {
    const scale = Math.max(12, Math.min(40, innerHeight / UI.viewH));
    let cx = 80, cy = 16;
    const p = me && world && world.player(me);
    if (p) { cx = p.x; cy = p.y + 1.6; }
    if (padOpen) {
      // the pad covers the right side: slide the view centre right by half the pad width so the pad
      // never covers you (the drawn player moves left)
      const padPx = Math.min(innerWidth * 0.3, 330);
      cx += (padPx / 2) / scale;
    }
    return [cx, cy, scale];
  }
  function draw() {
    requestAnimationFrame(draw);
    eventsTick();
    aimAge++;
    if (!world) return;
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    if (canvas.width !== innerWidth * dpr) { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = MAT_COLOR.air; ctx.fillRect(0, 0, innerWidth, innerHeight);
    const [cx, cy, scale] = camera();
    const x0 = Math.floor(cx - innerWidth / 2 / scale) - 1, x1 = Math.ceil(cx + innerWidth / 2 / scale) + 1;
    const y1 = Math.ceil(cy + innerHeight / 2 / scale) + 1, y0 = Math.floor(cy - innerHeight / 2 / scale) - 1;
    const sx = (wx) => (wx - (cx - innerWidth / 2 / scale)) * scale;
    const sy = (wy) => innerHeight - (wy - (cy - innerHeight / 2 / scale)) * scale;
    // cells
    for (let y = Math.max(0, y0); y <= Math.min(world.H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(world.W - 1, x1); x++) {
        const m = world.mat[y * world.W + x];
        if (m === 0) continue;
        ctx.fillStyle = MAT_COLOR[WReact.MATERIALS[m].name];
        ctx.fillRect(sx(x), sy(y + 1), scale + 0.5, scale + 0.5);
      }
    }
    // objects: a word card with the character on it
    for (const o of world.objs) {
      const x = sx(o.x), y = sy(o.y + 0.8);
      if (x < -40 || x > innerWidth + 40 || y < -40 || y > innerHeight + 40) continue;
      ctx.fillStyle = o.st === 'fly' ? '#c94f30' : '#efe7d4';
      ctx.strokeStyle = '#54452d'; ctx.lineWidth = 2;
      const s = Math.max(16, scale * 0.9);
      roundRect(ctx, x - s / 2, y - s / 2, s, s, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#54452d';
      ctx.font = Math.round(s * 0.62) + 'px "Noto Sans CJK SC", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.ch, x, y + 1);
    }
    // players
    for (const p of world.players) {
      const mine = p.id === me;
      const col = PLAYER_COLOR[p.slot !== undefined ? p.slot % 4 : 0];
      const x = sx(p.x), yb = sy(p.y), h = 1.2 * scale;
      ctx.fillStyle = col;
      ctx.fillRect(x - 0.3 * scale, yb - 0.75 * scale, 0.6 * scale, 0.75 * scale);       // body
      ctx.beginPath(); ctx.arc(x, yb - h + 0.22 * scale, 0.21 * scale, 0, 7); ctx.fill(); // head
      if (mine) { ctx.strokeStyle = '#3a3226'; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (p.calm) { ctx.fillStyle = '#8fb4c9'; ctx.font = Math.round(scale * 0.4) + 'px sans-serif'; ctx.fillText('静', x, yb - h - 0.3 * scale); }
      let fx = '';
      if (p.fx.singed > 0) fx += '🔥'; if (p.fx.soaked > 0) fx += '💧'; if (p.fx.chilled > 0) fx += '❄';
      if (fx) { ctx.font = Math.round(scale * 0.42) + 'px sans-serif'; ctx.fillText(fx, x, yb - h - (p.calm ? 0.85 : 0.3) * scale); }
    }
    // the aim arrow
    const p = me && world.player(me);
    if (p && aim && aimAge < 60) {
      ctx.strokeStyle = '#3a3226'; ctx.lineWidth = 2.5; ctx.globalAlpha = Math.max(0, 1 - aimAge / 60);
      const ax = sx(p.x + aim.x * 2.2), ay = sy(p.y + 0.75 + aim.y * 2.2);
      ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y + 0.75)); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.beginPath(); ctx.arc(ax, ay, 4, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  requestAnimationFrame(draw);

  // ---------- the docked pad (CHARTER §5) ----------
  let padOpen = false, padStrokes = [], padCur = null, padTimer = 0, padBusy = false;
  const padCanvas = $('#pad-canvas'), padCtx = padCanvas.getContext('2d');

  function openPad() {
    if (!me) return;
    padOpen = true; padCur = null;
    $('#pad').hidden = false; document.body.classList.add('popen');
    sizePad(); drawPad(); updateInk(); renderIdeas();
  }
  function closePad(collapse) {
    padOpen = false;
    $('#pad').hidden = true; document.body.classList.remove('popen');
  }
  $('#write-open').addEventListener('click', openPad);
  $('#pad-collapse').addEventListener('click', () => closePad(true));
  function padKey(e) {
    if (e.code === 'Escape' || e.code === 'KeyC') { e.preventDefault(); closePad(); }
    if (e.code === 'Backspace' || e.code === 'Delete') { e.preventDefault(); clearPad(); }
  }
  function sizePad() {
    const r = $('#pad-square').getBoundingClientRect();
    padCanvas.width = Math.round(r.width * (devicePixelRatio || 1));
    padCanvas.height = Math.round(r.height * (devicePixelRatio || 1));
    drawPad();
  }
  addEventListener('resize', () => { if (padOpen) sizePad(); });

  function drawPad() {
    const w = padCanvas.width, h = padCanvas.height;
    if (!w) return;
    padCtx.setTransform(1, 0, 0, 1, 0, 0);
    padCtx.clearRect(0, 0, w, h);
    padCtx.strokeStyle = '#54452d'; padCtx.lineWidth = Math.max(2, w / 90); padCtx.lineCap = 'round'; padCtx.lineJoin = 'round';
    for (const st of padStrokes.concat(padCur ? [padCur] : [])) {
      padCtx.beginPath();
      st.forEach(([x, y], i) => { const px = x * w, py_ = (1 - y) * h; i ? padCtx.lineTo(px, py_) : padCtx.moveTo(px, py_); });
      padCtx.stroke();
    }
  }
  function padPoint(e) {
    const r = padCanvas.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))];
  }
  padCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); padCanvas.setPointerCapture(e.pointerId);
    padCur = [padPoint(e)]; clearTimeout(padTimer); setStatus('');
  });
  padCanvas.addEventListener('pointermove', (e) => {
    if (!padCur) return;
    const p = padPoint(e), q = padCur[padCur.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.008 && padCur.length < 600) { padCur.push(p); drawPad(); }
  });
  padCanvas.addEventListener('pointerup', () => {
    if (!padCur) return;
    padStrokes.push(padCur); padCur = null; drawPad();
    clearTimeout(padTimer); padTimer = setTimeout(readPad, UI.padWait * 1000);
  });

  function clearPad() {
    padStrokes = []; padCur = null; drawPad();
    setStatus(''); $('#pad-chips').innerHTML = '';
    clearTimeout(padTimer);
  }
  $('#pad-clear').addEventListener('click', clearPad);

  function setStatus(html) { $('#pad-status').innerHTML = html; }

  // read the drawing: the best guesses at or over padMinScore, at most three (RECOGNISER.md §4)
  function readPad() {
    if (!padOpen || padCur) return;
    if (!padStrokes.length) { $('#pad-chips').innerHTML = ''; return; }
    const m = window.WRecog.match(padStrokes).filter(g => g.score >= UI.padMinScore).slice(0, 3);
    if (!m.length) {
      const near = window.WRecog.match(padStrokes)[0];
      setStatus('the brush doesn\'t know this writing yet' + (near ? ' — closest: ' : '') +
        (near ? '<span class="weak">' + near.ch + ' ' + py(near.ch) + ' ' + (en(near.ch) || '') + '</span>' : ''));
      renderChips([], near);
      return;
    }
    setStatus('');
    renderChips(m, null);
  }
  function renderChips(m, weak) {
    const el = $('#pad-chips');
    el.innerHTML = '';
    for (const g of m) {
      const b = document.createElement('button');
      const carded = !!CARD[g.ch];
      b.className = carded ? '' : 'weak';
      b.innerHTML = '<b>' + g.ch + '</b><span class="py">' + py(g.ch) + '</span><span class="en">' + (en(g.ch) || 'not a thing yet') + '</span>';
      b.onclick = () => carded ? write(g.ch) : msg('the brush can\'t make ' + g.ch + ' ' + py(g.ch) + ' into a thing yet');
      el.appendChild(b);
    }
    if (!m.length && weak) {
      const b = document.createElement('button');
      b.className = 'weak';
      b.innerHTML = '<b>' + weak.ch + '</b><span class="py">' + py(weak.ch) + '</span><span class="en">' + (en(weak.ch) || '') + '</span>';
      b.onclick = () => msg('the brush can\'t make ' + weak.ch + ' ' + py(weak.ch) + ' into a thing yet');
      el.appendChild(b);
    }
  }
  // Ideas: everything the brush CAN make (the "use without drawing" pick, RECOGNISER.md §4)
  function renderIdeas() {
    const el = $('#pad-ideas');
    if (el.childElementCount) return;
    for (const c of CARDS) {
      const b = document.createElement('button');
      b.innerHTML = '<b>' + c.ch + '</b><span>' + c.py + '</span>';
      b.title = c.en;
      b.onclick = () => write(c.ch);
      el.appendChild(b);
    }
  }
  function write(ch) {
    if (!me || padBusy) return;
    padBusy = true;
    send({ t: 'write', ch });
    setTimeout(() => { padBusy = false; }, 250);
  }
  function wrote(m) {
    if (m.ok) {
      // one tap puts the object in hand and clears the pad for the next character (chained 很 火)
      clearPad();
      setStatus('<b>' + m.ch + '</b> ' + py(m.ch) + ' ' + en(m.ch) + ' — in your hand');
      updateInk();
    } else if (m.why === 'no-ink') setStatus('the ink is out — wait for it to come back 墨 mò');
    else if (m.why === 'cooling') setStatus('the brush rests a moment…');
    else if (m.why === 'unknown') setStatus('the brush doesn\'t know ' + m.ch + ' yet');
  }

  function updateInk() {
    const p = me && world && world.player(me);
    const max = p ? Math.max(1, Math.round(inkMax())) : 3;
    const ink = p ? p.ink : max;
    const html = Array.from({ length: max }, (_, i) => '<i class="' + (i < ink ? '' : 'off') + '"></i>').join('');
    $('#ink').innerHTML = html; $('#pad-ink').innerHTML = html;
  }
  function inkMax() {
    const conj = WReact.CONJURE[world ? world.profile : 'standard'];
    return conj.ink;
  }
  setInterval(updateInk, 300);

  // ---------- the menu (the living-room rule: anyone on the Wi-Fi may set the room's knobs) ----------
  $('#menu').addEventListener('click', () => { $('#menu-sheet').hidden = false; });
  $('#menu-sheet').addEventListener('click', (e) => {
    if (e.target.dataset && e.target.dataset.act === 'close') $('#menu-sheet').hidden = true;
  });
  for (const sel of document.querySelectorAll('#roomknobs select')) {
    sel.addEventListener('change', async () => {
      const body = {};
      body[sel.dataset.k] = sel.value;
      try { await fetch('/crew', { method: 'POST', body: JSON.stringify(body) }); } catch (e) {}
    });
  }
  // reflect the room's knobs when a snapshot tells us the profile changed
  setInterval(() => {
    if (!world) return;
    for (const sel of document.querySelectorAll('#roomknobs select'))
      if (sel.dataset.k === 'profile' && sel.value !== world.profile) sel.value = world.profile;
  }, 2000);
  // the body knob comes in joined messages; keep the select honest
  addEventListener('message', () => {});

  // start
  connect();
  $('#join').hidden = false;
  msg('write 书 shū to begin');

  // a small probe for the screen checks (screen-check.py) and the lab: read-only
  window.SB = {
    me: () => me, world: () => world, padOpen: () => padOpen, input: () => input,
    chips: () => [...document.querySelectorAll('#pad-chips button b')].map(b => b.textContent),
    status: () => $('#pad-status').textContent,
  };
})();
