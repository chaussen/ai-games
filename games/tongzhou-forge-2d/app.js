// 同舟 · Glyph Isles 2D — the page: runs sim.js locally (one player), draws the isle side-on, and keeps
// the phone screen to its budget (docs/GREYBOX.md): one goal, one word card, one message line, the
// menu, the stick and two buttons. Two looks: 'ink' (ink.js, the 水墨江湖 art, default) and 'greybox'
// (the plain shapes below, kept for comparison): ?art=ink|greybox or ☰ → Look.
(function () {
  'use strict';
  const SIM = window.WSim, RU = window.WRules, IS = window.WIsles;
  const { SW, SH, PW, PH, HOLD_Y } = SIM.consts;
  const qs = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tzf2d.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('tzf2d.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---------- client knobs (the playtest moves these; SIDE-VIEW §2) ----------
  const UI = {
    labels: qs.get('labels') || store.get('labels', 'all'),   // pinyin on stones: all / near / card
    msg: 2.5, msgDud: 3.5,                                    // seconds a message line stays
    cardForge: 5,                                             // seconds a new character keeps the card
    winDelay: 1.4,                                            // see the world's answer before the card
    maxPx: 3.2e6,                                             // canvas pixels at most (a phone's worth): big iPads and Macs draw a little softer, not slower
    sound: qs.get('mute') === '1' ? false : store.get('sound', true),
    voice: qs.get('mute') === '1' ? false : store.get('voice', true),
  };
  const STEP = 1 / 60;
  let ART = ['ink', 'greybox'].includes(qs.get('art')) ? qs.get('art') : store.get('art', 'ink');
  const INK = window.WInk.create();
  function setArt(a) { ART = a === 'greybox' ? 'greybox' : 'ink'; document.documentElement.classList.toggle('ink', ART === 'ink'); }
  setArt(ART);

  // element colours (copied from the 3D client): a = light, b = dark ink of the element
  const EL = {
    wood: { a: '#4fb592', b: '#1c6b50' }, fire: { a: '#f0714f', b: '#c22f1c' }, water: { a: '#5aa3e0', b: '#1b5aa6' },
    light: { a: '#f2c14e', b: '#b06f06' }, folk: { a: '#8f7bb0', b: '#3a2c52' }, dusk: { a: '#5b4a8a', b: '#2a1f4a' },
    earth: { a: '#c08a4e', b: '#7a4a22' },
  };
  const elOf = ch => (RU.GLYPHS[ch] && EL[RU.GLYPHS[ch].el]) || EL.folk;
  // palettes: ink on paper, with 石青 water and a sky wash per isle
  const PAL = {
    night: { paper: '#e6e2d6', sky: ['#7d88a8', '#d9d6cc'], ridge: ['rgba(64,74,108,.20)', 'rgba(48,56,86,.30)', 'rgba(36,42,66,.40)'], ink: '#23222a', rim: '#f1ebdc', water: ['#4b7b8b', '#23434e'], orb: '#f6f1dc' },
    dusk:  { paper: '#f2e8d6', sky: ['#e2b79a', '#f2e8d6'], ridge: ['rgba(122,92,112,.16)', 'rgba(96,70,92,.26)', 'rgba(70,52,68,.34)'], ink: '#2a2523', rim: '#fcf4e2', water: ['#5b91a0', '#2f5e6b'], orb: '#e2583a' },
  };
  // how each root character was first drawn (copied from the 3D client)
  const PICTO = {
    '木': 'M50 12V90M22 30Q40 44 50 46Q60 44 78 30M24 88Q40 68 50 62Q60 68 76 88',
    '火': 'M14 86Q18 54 30 38Q36 60 43 66Q46 36 52 12Q58 38 59 66Q68 58 73 38Q84 58 88 86Q50 96 14 86',
    '水': 'M52 10Q36 30 52 49Q68 68 50 90M29 20Q22 31 29 42M25 58Q18 69 25 80M75 20Q82 31 75 42M78 58Q85 69 78 80',
    '日': 'M50 18A32 32 0 1 0 50.1 18M43 50H57',
    '月': 'M64 10Q20 28 25 60Q29 84 60 90Q44 70 46 50Q48 28 64 10M40 46Q46 50 44 60',
    '人': 'M58 10Q52 50 62 90M56 30Q38 44 26 68',
  };

  // ---------- the world ----------
  const world = new SIM.World();
  const ME = 'me';
  const prof = qs.get('profile') || store.get('profile', null);
  if (prof) world.setProfile(prof);
  const startIsle = (() => { const v = qs.get('isle'); if (v === null) return store.get('isle', 0); const i = IS.ISLES.findIndex(L => L.id === v); return i >= 0 ? i : (+v || 0); })();
  world.load(startIsle);
  world.addPlayer(ME, 'you');
  const me = () => world.players.get(ME);

  // ---------- canvas, scale and camera ----------
  const cv = $('#world'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, S = 40, anchorY = 0, portrait = true, touch = false;
  const cam = { x: 0, y: 2, ref: 2, ready: false };
  if (qs.get('touch') === '1' || matchMedia('(pointer: coarse)').matches) document.documentElement.classList.add('touch');

  function padRects() {
    return [...document.querySelectorAll('[data-pad]')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0);
  }
  function layout() {
    W = innerWidth; H = innerHeight; DPR = Math.min(3, devicePixelRatio || 1, Math.sqrt(UI.maxPx / (W * H)));
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    touch = document.documentElement.classList.contains('touch');
    portrait = H > W;
    if (portrait) S = Math.min(W / 7.2, H / 14);     // a 6" phone upright: about 7 units across (a tablet: 14 tall)
    else if (touch) S = Math.min(H / 7.2, W / 15);   // a phone on its side
    else S = Math.min(H / 11, W / 20);               // laptop or TV
    // the feet sit above the pad: upright, the whole band under the stick and buttons stays free
    const pads = padRects();
    const band = touch && pads.length ? Math.max(...pads.map(r => H - r.top)) + 10 : 0;
    anchorY = portrait ? H - band - 0.6 * S : touch ? H - Math.max(0.9 * S + 16, band * 0.45) : H - 2.4 * S;
  }
  addEventListener('resize', () => { layout(); cam.ready = false; });
  layout();

  const X = x => (x - cam.x) * S + W / 2;
  const Y = y => anchorY - (y - cam.y) * S;

  function updateCam(dt) {
    const p = me();
    const halfW = W / 2 / S;
    let tx = p.x + p.face * (portrait ? 0.7 : 1.4);
    tx = world.w > 2 * halfW - 1 ? clamp(tx, halfW - 0.6, world.w - halfW + 0.6) : world.w / 2;
    // hold the level you stand on; follow you up past a margin (轻功), and down at once
    if (p.grounded) cam.ref = p.y;
    const up = portrait ? 4.2 : 2.2;
    let ty = cam.ref;
    if (p.y > ty + up) ty = p.y - up;
    if (p.y < ty) ty = p.y;
    if (!cam.ready) { cam.x = tx; cam.y = ty; cam.ready = true; return; }
    cam.x += (tx - cam.x) * (1 - Math.exp(-dt * 5));
    cam.y += (ty - cam.y) * (1 - Math.exp(-dt * (ty < cam.y ? 10 : 4)));
  }

  // ---------- input ----------
  const input = { x: 0, jump: false, keys: new Set() };
  const keyX = () => (input.keys.has('right') ? 1 : 0) - (input.keys.has('left') ? 1 : 0);
  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'grab', KeyJ: 'grab', KeyE: 'grab', Enter: 'grab' };
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'SELECT') return;
    unlockAudio();
    const k = KEYS[e.code];
    if (e.code === 'Escape') { toggleDrawer(); return; }
    if (!$('#drawer').hidden) return;
    if (e.code === 'KeyR') { restart(); return; }
    if (e.code === 'KeyN') { goIsle(world.index + 1); return; }
    if (e.code === 'KeyP') { goIsle(world.index - 1); return; }
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    if (k === 'jump') { world.press(ME, 'jump'); input.jump = true; }
    else if (k === 'grab') world.press(ME, 'grab');
    else input.keys.add(k);
  });
  addEventListener('keyup', e => {
    const k = KEYS[e.code];
    if (k === 'jump') input.jump = false; else if (k) input.keys.delete(k);
  });

  // the stick floats: touch anywhere in the lower left and it starts there
  const stick = { id: null, ox: 0, oy: 0, x: 0 };
  const stickEl = $('#stick'), grabEl = $('#grab'), jumpEl = $('#jump');
  function stickHome() {
    stickEl.style.left = ''; stickEl.style.top = ''; stickEl.style.bottom = '';
    stickEl.classList.remove('live'); stickEl.style.setProperty('--sx', '0px');
  }
  addEventListener('pointerdown', e => {
    unlockAudio();
    if (e.pointerType === 'touch' && !touch) { document.documentElement.classList.add('touch'); layout(); }
    if (e.target.closest && e.target.closest('button, .sheet, select, input, label')) return;
    if (stick.id === null && e.clientX < W * 0.55 && e.clientY > H * 0.3) {
      stick.id = e.pointerId; stick.ox = clamp(e.clientX, 70, W * 0.55); stick.oy = clamp(e.clientY, H * 0.3, H - 60); stick.x = 0;
      stickEl.style.left = (stick.ox - 58) + 'px'; stickEl.style.top = (stick.oy - 58) + 'px'; stickEl.style.bottom = 'auto';
      stickEl.classList.add('live');
    }
  });
  addEventListener('pointermove', e => {
    if (e.pointerId !== stick.id) return;
    const d = clamp((e.clientX - stick.ox) / 40, -1, 1);
    stick.x = Math.abs(d) < 0.16 ? 0 : d;
    stickEl.style.setProperty('--sx', (d * 33) + 'px');
  });
  const stickUp = e => { if (e.pointerId === stick.id) { stick.id = null; stick.x = 0; stickHome(); } };
  addEventListener('pointerup', stickUp); addEventListener('pointercancel', stickUp);
  function holdButton(el, down, up) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); unlockAudio(); el.classList.add('down'); down(); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    const off = () => { el.classList.remove('down'); if (up) up(); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  }
  holdButton(jumpEl, () => { world.press(ME, 'jump'); input.jump = true; }, () => { input.jump = false; });
  holdButton(grabEl, () => world.press(ME, 'grab'));
  addEventListener('contextmenu', e => e.preventDefault());

  // ---------- sound: a few sine blips, no files ----------
  let AC = null;
  function unlockAudio() {
    if (!UI.sound) return;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = false; } }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function tone(f, dur, type, vol, slide, delay) {
    if (!UI.sound || !AC || AC.state !== 'running') return;
    const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }
  const sfx = {
    jump: () => tone(380, 0.13, 'sine', 0.08, 700),
    leap: n => tone(420 + n * 70, 0.3, 'sine', 0.08, 900 + n * 120),
    refill: () => tone(1320, 0.12, 'triangle', 0.05, 1760),
    land: () => tone(150, 0.08, 'triangle', 0.08, 80),
    grab: () => tone(520, 0.1, 'triangle', 0.09, 820),
    place: () => tone(260, 0.1, 'triangle', 0.09, 200),
    throw: () => tone(640, 0.16, 'sine', 0.07, 250),
    gem: () => { tone(988, 0.1, 'sine', 0.08); tone(1480, 0.2, 'sine', 0.08, null, 0.08); },
    forge: () => { tone(392, 0.5, 'sine', 0.09); tone(587, 0.5, 'sine', 0.08, null, 0.06); tone(880, 0.7, 'triangle', 0.08, null, 0.14); },
    dud: () => { tone(196, 0.18, 'square', 0.035, 150); tone(147, 0.22, 'square', 0.03, 110, 0.1); },
    near: () => tone(700, 0.07, 'triangle', 0.05),
    grow: () => [262, 330, 392, 523].forEach((f, k) => tone(f, 0.22, 'triangle', 0.07, f * 1.5, k * 0.07)),
    burn: () => { tone(220, 0.7, 'sawtooth', 0.04, 60); tone(900, 0.5, 'square', 0.02, 200, 0.05); },
    splash: () => { tone(900, 0.25, 'sine', 0.05, 160); tone(300, 0.3, 'triangle', 0.04, 90, 0.05); },
    ouch: () => tone(180, 0.12, 'square', 0.05, 110),
    dusk: () => { tone(330, 0.9, 'sine', 0.06, 196); tone(247, 1.1, 'triangle', 0.05, 147, 0.2); },
    dawn: () => [392, 523, 659, 784].forEach((f, k) => tone(f, 0.35, 'sine', 0.06, null, k * 0.06)),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.28, 'triangle', 0.09, null, k * 0.11)),
  };
  function speak(ch) {
    try {
      if (!UI.voice || !('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(ch);
      u.lang = 'zh-CN'; u.rate = 0.75;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---------- HUD: goal, word card, one message line ----------
  const words = ch => { const g = RU.GLYPHS[ch] || {}; return { py: g.py || '', en: g.en || '' }; };
  const B = ch => ART === 'ink' ? '<b style="color:' + elOf(ch).b + '">' + ch + '</b>' : '<b>' + ch + '</b>';
  function setGoal() {
    const ch = world.L.want, w = words(ch), el = $('#goal');
    el.querySelector('.g').textContent = ch;
    el.querySelector('.py').textContent = w.py;
    el.querySelector('.en').textContent = w.en;
    el.style.setProperty('--el', elOf(ch).b);
    el.classList.remove('made');
  }
  // the goal card turns vermilion and takes a 成 seal once the character exists on the isle
  function updateGoal() {
    const made = world.stones.some(k => k.ch === world.L.want && k.state !== 'gone');
    const el = $('#goal');
    if (el.classList.contains('made') !== made) el.classList.toggle('made', made);
  }
  let msgT = 0;
  function say(html, kind) {
    const el = $('#msg');
    el.innerHTML = html;
    el.className = 'on' + (kind ? ' ' + kind : '');
    msgT = kind === 'dud' ? UI.msgDud : UI.msg;
  }
  const card = { ch: null, fresh: 0, forced: null };
  function showCard(ch, fresh) {
    const el = $('#card');
    if (!ch) { if (!el.hidden) el.hidden = true; card.ch = null; return; }
    if (card.ch !== ch) {
      const w = words(ch);
      el.querySelector('.g').textContent = ch;
      el.querySelector('.py').textContent = w.py;
      el.querySelector('.en').textContent = w.en;
      el.style.setProperty('--el', elOf(ch).b);
      const pic = PICTO[ch];
      el.querySelector('.picto').style.display = pic ? '' : 'none';
      el.querySelector('.picto path').setAttribute('d', pic || '');
      card.ch = ch;
    }
    el.classList.toggle('fresh', !!fresh);
    el.hidden = false;
  }
  $('#card').addEventListener('click', () => { if (card.ch) { const v = UI.voice; UI.voice = true; speak(card.ch); UI.voice = v; } });

  // the stone the card is about: a new character first, then what you carry, then what GRAB would take,
  // then the nearest stone within reach of your eyes
  function pickCard(l) {
    const p = me();
    if (card.forced && card.forced.until > world.clock && world.stones.some(k => k.ch === card.forced.ch && k.state !== 'gone')) return [card.forced.ch, true];
    card.forced = null;
    if (p.hold) return [p.hold.ch, false];
    if (l.mode === 'grab') return [l.k.ch, false];
    let best = null, bd = 2.2;
    for (const k of world.stones) {
      if (k.state !== 'loose') continue;
      const d = Math.hypot(k.x - p.x, k.y + SH / 2 - (p.y + PH / 2));
      if (d < bd) { bd = d; best = k; }
    }
    return [best ? best.ch : null, false];
  }

  // Buttons carry one big character, with its pinyin and the English small under it. GRAB's
  // character names what the press will do (the placement, never what it makes: P9).
  const BTN = {
    jump: ['跳', 'tiào', 'JUMP'], grab: ['拿', 'ná', 'GRAB'], none: ['拿', 'ná', 'GRAB'],
    beside: ['旁', 'páng', 'BESIDE'], stack: ['上', 'shàng', 'ON TOP'], drop: ['上', 'shàng', 'ON TOP'],
    release: ['落', 'luò', 'DROP'], toss: ['扔', 'rēng', 'THROW'], place: ['放', 'fàng', 'SET DOWN'], offer: ['献', 'xiàn', 'OFFER'],
  };
  const btnHTML = ([ch, py, en]) => '<span class="g">' + ch + '</span><span class="py">' + py + '</span><span class="en">' + en + '</span>';
  jumpEl.innerHTML = btnHTML(BTN.jump);
  let grabMode = '';
  function updateGrab(l) {
    if (l.mode === grabMode) return;
    grabMode = l.mode;
    grabEl.className = 'mode-' + l.mode + (l.mode === 'none' ? ' idle' : '');
    grabEl.dataset.mode = l.mode;
    grabEl.innerHTML = btnHTML(BTN[l.mode] || BTN.grab);
  }

  // the title card shows only while you stand on the boat; the isle's tip shows once, tap to dismiss
  const title = { hidden: false };
  function updateTitle() {
    const p = me(), el = $('#title');
    const onBoat = p.grounded && world.cell(Math.floor(p.x), Math.round(p.y) - 1) === 'b';
    const show = onBoat && world.phase === 'play' && !title.hidden;
    if (show && el.hidden) {
      el.querySelector('.cn').textContent = world.L.cn;
      el.querySelector('.name').textContent = world.L.name;
      el.querySelector('.tip').textContent = store.get('tip.' + world.L.id, false) ? '' : (world.L.tip || '');
    }
    el.hidden = !show;
    if (!onBoat && !el.hidden) el.hidden = true;
  }
  $('#title').addEventListener('click', () => { store.set('tip.' + world.L.id, true); title.hidden = true; $('#title').hidden = true; });

  // ---------- the drawer (☰): everything that is not JUMP or GRAB lives here ----------
  const drawer = $('#drawer');
  const isleSel = drawer.querySelector('[data-k=isle]');
  IS.ISLES.forEach((L, i) => { const o = document.createElement('option'); o.value = i; o.textContent = (i + 1) + '. ' + L.name + ' · ' + L.cn; isleSel.appendChild(o); });
  function syncDrawer() {
    isleSel.value = world.index;
    drawer.querySelector('[data-k=profile]').value = world.k.profile;
    drawer.querySelector('[data-k=labels]').value = UI.labels;
    drawer.querySelector('[data-k=sound]').checked = UI.sound;
    drawer.querySelector('[data-k=voice]').checked = UI.voice;
    drawer.querySelector('[data-k=art]').value = ART;
  }
  function toggleDrawer(open) {
    const o = open === undefined ? drawer.hidden : open;
    drawer.hidden = !o;
    if (o) syncDrawer();
  }
  $('#menu').addEventListener('click', () => toggleDrawer());
  drawer.addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.act;
    if (a === 'restart') { restart(); toggleDrawer(false); }
    if (a === 'close') toggleDrawer(false);
  });
  drawer.addEventListener('change', e => {
    const k = e.target.dataset.k;
    if (k === 'isle') { goIsle(+e.target.value); toggleDrawer(false); }
    if (k === 'profile') { world.setProfile(e.target.value); store.set('profile', world.k.profile); say('Play: ' + world.k.profile); }
    if (k === 'labels') { UI.labels = e.target.value; store.set('labels', UI.labels); }
    if (k === 'sound') { UI.sound = e.target.checked; store.set('sound', UI.sound); unlockAudio(); }
    if (k === 'voice') { UI.voice = e.target.checked; store.set('voice', UI.voice); }
    if (k === 'art') { setArt(e.target.value); store.set('art', ART); }
  });
  $('#win').addEventListener('click', e => {
    const a = e.target.dataset && e.target.dataset.act;
    if (a === 'again') restart();
    if (a === 'next') goIsle(world.index + 1);
  });

  function onIsle() {
    store.set('isle', world.index);
    setGoal();
    fx.length = 0; flashes.length = 0; winAt = 0;
    $('#win').hidden = true; title.hidden = false; card.forced = null; msgT = 0; $('#msg').className = '';
    cam.ready = false; seenOuch = false; duskF = 0; wonF = 0;
  }
  function restart() { world.load(world.index); onIsle(); }
  function goIsle(i) { world.load(i); onIsle(); }

  // ---------- events → what you see and hear ----------
  const fx = [];            // particles, in world units
  const flashes = [];       // frames flashed red (dud) or dashed (near): { ia, ib, op, kind, until }
  let winAt = 0, seenOuch = false, duskF = 0, wonF = 0;
  const burst = (x, y, n, o) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (o.spin || 0); const v = (o.v || 2) * (0.6 + ((i * 37) % 10) / 25); fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + (o.up || 0), life: o.life || 0.7, max: o.life || 0.7, kind: o.kind || 'ink', color: o.color, size: o.size || 0.08, g: o.g === undefined ? 4 : o.g }); } };
  function handle(e) {
    const p = me();
    switch (e.t) {
      case 'jump': if (e.id === ME) sfx.jump(); break;
      case 'leap':
        if (e.id === ME) {
          sfx.leap(e.chain);
          if (ART === 'ink') fx.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.55, max: 0.55, kind: 'ring', g: 0 });   // 墨晕: ink blooms under the feet
          else burst(p.x, p.y, 10, { kind: 'wisp', v: 1.6, up: -1.5, life: 0.5, size: 0.12, g: 0 });
        }
        break;
      case 'refill': if (e.id === ME) { sfx.refill(); burst(p.x, p.y + PH / 2, 8, { kind: 'spark', color: '#e0a526', v: 2.2, life: 0.4, g: 0 }); } break;
      case 'land':
        if (e.id === ME) { sfx.land(); land = ART === 'ink' ? 0.16 : 0.12; if (ART === 'ink') burst(p.x, p.y + 0.04, 6, { kind: 'dust', v: 1.1, up: 0.4, life: 0.35, size: 0.06, g: 3 }); }
        break;
      case 'grab': sfx.grab(); break;
      case 'place': sfx.place(); break;
      case 'throw': sfx.throw(); break;
      case 'gem': sfx.gem(); { const g = (e.glow ? world.glow : world.gems)[e.i]; burst(g.x, g.y, 12, { kind: 'spark', color: e.glow ? '#b9a6ff' : '#7fe0b8', v: 2.5, life: 0.5, g: 0 }); } break;
      case 'cloud': { const c = world.clouds.find(c => c.id === e.c); if (c) burst(c.x, c.y, 10, { kind: 'wisp', v: 1.4, life: 0.6, size: 0.14, g: -0.5 }); } break;
      case 'forge': {
        sfx.forge();
        const el = elOf(e.ch);
        burst(e.x, e.y + SH / 2, 22, { kind: 'ink', color: ART === 'ink' ? '#1d1b1a' : el.b, v: 3.2, life: 0.8, size: 0.1 });
        // ink: the new character is printed in vermilion and sealed (印); greybox: it rises in its colour
        fx.push({ x: e.x, y: e.y + SH, vx: 0, vy: 1.2, life: 1.2, max: 1.2, kind: 'glyph', ch: e.ch, color: ART === 'ink' ? '#c23a2b' : el.b, g: 0 });
        if (ART === 'ink') fx.push({ x: e.x + 0.75, y: e.y + SH + 0.5, vx: 0, vy: 0.6, life: 1.4, max: 1.4, kind: 'seal', ch: '印', g: 0 });
        const how = e.op === '⿱' ? ' on ' : ' beside ';
        say((e.rescued ? 'Slid into place: ' : '') + B(e.a) + how + B(e.b) + ' makes ' + B(e.ch) + ' ' + words(e.ch).py);
        card.forced = { ch: e.ch, until: world.clock + UI.cardForge };
        speak(e.ch);
        break;
      }
      case 'dud': {
        sfx.dud();
        flashes.push({ ia: e.ia, ib: e.ib, op: e.op, kind: 'dud', until: world.clock + 2.5 });
        const k = world.stones.find(s => s.id === e.ia);
        if (k) burst(k.x + (e.op === '⿰' ? SW : 0), k.y + SH / 2, 10, { kind: 'ink', color: '#8a8173', v: 1.2, life: 0.6 });
        const what = e.op === '⿱' ? B(e.a) + ' on ' + B(e.b) : B(e.a) + ' left, ' + B(e.b) + ' right';
        say(what + ': makes nothing' + (e.other ? ' · they go together another way' : ''), 'dud');
        break;
      }
      case 'near':
        sfx.near();
        flashes.push({ ia: e.ia, ib: e.ib, op: e.op, kind: 'near', until: world.clock + 2.5 });
        say(e.op === '⿱' ? 'Not quite on top' : 'Not quite beside: closer to ' + B(e.a === (world.stones.find(s => s.id === e.ib) || {}).ch ? e.a : e.b));
        break;
      case 'bridge': {
        sfx.grow();
        const el = elOf(e.ch);
        for (let x = e.x0; x < e.x1; x++) burst(x + 0.5, e.y - 0.3, 5, { kind: 'ink', color: el.b, v: 1.5, up: 1, life: 0.6 });
        say(B(e.ch) + (e.el === 'earth' ? ' raises a mound in the gap' : ' grows into a bridge'));
        break;
      }
      case 'burn':
        sfx.burn();
        for (let i = 0; i < 26; i++) fx.push({ x: e.x - 0.4 + (i % 5) * 0.2, y: e.y - 1 + Math.floor(i / 5) * 0.4, vx: ((i * 13) % 7 - 3) * 0.15, vy: 1 + (i % 4) * 0.4, life: 1.2, max: 1.2, kind: 'ember', color: i % 3 ? '#f0714f' : '#f2c14e', size: 0.07, g: -0.4 });
        say(B(e.ch) + ' burns the thorns');
        break;
      case 'ouch':
        if (e.id === ME) { sfx.ouch(); if (!seenOuch) { seenOuch = true; say('The thorns throw you back'); } }
        break;
      case 'splash':
        sfx.splash();
        burst(e.x, 1.05, 14, { kind: 'drop', color: '#6aa6b6', v: 3, up: 3, life: 0.7, g: 9 });
        break;
      case 'stoneReturn': if (e.why === 'fell') say(B(e.ch) + ' floats home'); break;
      case 'dusk':
        if (e.on) { sfx.dusk(); say(B('杳') + ' yǎo, dim: dusk falls. A glow-gem shines'); }
        else { sfx.dawn(); say('Light again'); }
        break;
      case 'win':
        winAt = world.clock + UI.winDelay;
        sfx.win(); speak(e.ch);
        burst(world.pav.x, world.pav.y + 1.6, 30, { kind: 'spark', color: elOf(e.ch).a, v: 3.5, life: 1.1, g: 0 });
        break;
    }
  }

  function showWin() {
    const r = world.result, el = $('#win'), w = words(r.ch);
    el.querySelector('.g').textContent = r.ch;
    el.style.setProperty('--el', elOf(r.ch).b);
    el.querySelector('.py').textContent = w.py;
    el.querySelector('.en').textContent = w.en;
    el.querySelector('.stats').textContent = r.time + ' s · gems ' + r.gems + ' / ' + r.total;
    // the colophon: what it is made of, and a line in the brush, 日月为明
    const rec = RU.RECIPE_LIST.find(x => x[3] === r.ch);
    const part = ch => '<b style="color:' + elOf(ch).b + '">' + ch + '</b> ' + words(ch).py + ' ' + words(ch).en;
    el.querySelector('.recipe').innerHTML = rec ? part(rec[1]) + ' + ' + part(rec[2]) + '<br><small>' + (rec[0] === '⿱' ? rec[1] + ' on top of ' + rec[2] : 'set side by side') + '</small>' : '';
    el.querySelector('.inscr').textContent = rec ? rec[1] + rec[2] + '为' + r.ch : r.ch;
    el.querySelector('[data-act=next]').textContent = r.last ? 'Back to the first isle' : 'Next isle';
    el.hidden = false;
  }

  // ---------- the loop ----------
  let last = performance.now(), acc = 0, land = 0, frames = 0, paused = false;
  function stepOnce() {
    const p = me();
    p._px = p.x; p._py = p.y;
    for (const k of world.stones) { k._px = k.x; k._py = k.y; }
    world.setInput(ME, stick.id !== null ? stick.x : keyX(), input.jump);
    world.step(STEP);
    for (const e of world.drain()) handle(e);
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    paused = !drawer.hidden || document.hidden;
    if (!paused) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { stepOnce(); acc -= STEP; n++; }
      if (n === 6) acc = 0;
      if (msgT > 0 && (msgT -= dt) <= 0) $('#msg').className = '';
      if (land > 0) land -= dt;
      for (const f of fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= f.g * dt; }
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
      for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].until < world.clock) flashes.splice(i, 1);
      duskF += ((world.dusk > 0 ? 1 : 0) - duskF) * Math.min(1, dt * 2);
      wonF += ((world.phase === 'won' ? 1 : 0) - wonF) * Math.min(1, dt * 0.8);
      if (winAt && world.clock >= winAt) { winAt = 0; showWin(); }
    }
    updateCam(dt);
    const alpha = paused ? 1 : acc / STEP;
    draw(alpha, now / 1000);
    const l = world.launch(me());
    updateGrab(l);
    const [ch, fresh] = pickCard(l);
    showCard(UI.labels === 'none' ? null : ch, fresh);
    updateTitle();
    updateGoal();
    frames++;
    requestAnimationFrame(frame);
  }

  // ---------- drawing ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const posOf = (o, a) => [o._px === undefined ? o.x : lerp(o._px, o.x, a), o._py === undefined ? o.y : lerp(o._py, o.y, a)];
  const font = px => px.toFixed(1) + 'px "Tongzhou Brush", "Kaiti SC", "STKaiti", KaiTi, serif';
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function draw(a, t) {
    if (ART === 'ink') {
      INK.draw({ ctx, W, H, S, DPR, X, Y, cam, anchorY, world, a, t, duskF, wonF, land, fx, labels: UI.labels,
        me, posOf, words, elOf, font, shapeOf, SW, SH, PW, PH, HOLD_Y,
        frames2, ghost: () => ghost(a), particles, offscreen: () => offscreen(null, a) });
      return;
    }
    const P = PAL[world.L.pal] || PAL.dusk;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // paper and sky wash
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    sky.addColorStop(0, P.sky[0]); sky.addColorStop(1, P.sky[1]);
    ctx.globalAlpha = 1 - wonF * 0.6; ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    // the moon or the sun, far away (moves with the far ridges)
    ctx.fillStyle = P.orb; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(W * 0.72 - cam.x * S * 0.05, Y(cam.y * 0.95 + 9) , S * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    // shan-shui ridges: far layers move less (motion parallax is what makes depth read)
    ridge(0.12, 6.5, 3.2, 1.3, P.ridge[0]);
    ridge(0.3, 4.2, 2.4, 4.1, P.ridge[1]);
    ridge(0.55, 2.4, 1.2, 7.7, P.ridge[2]);
    mist(P);
    water(P, t);
    tiles(P, a);
    clouds(t);
    gems(t);
    pavilion(P, t);
    // dusk dims the isle, never you or the stones: you must always see where you are
    if (duskF > 0.01) { ctx.fillStyle = 'rgba(46,32,86,' + (0.42 * duskF).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); glowGems(t); }
    frames2();
    stones(P, a);
    ghost(a);
    player(P, a, t);
    particles();
    if (wonF > 0.01) { ctx.fillStyle = 'rgba(255,250,236,' + (0.22 * wonF).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    offscreen(P, a);
  }

  function ridge(f, base, amp, seed, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 10; sx += 10) {
      const u = (sx - W / 2) / S + cam.x * f;
      const h = base + amp * (0.55 * Math.sin(u * 0.29 + seed) + 0.3 * Math.sin(u * 0.77 + seed * 2.1) + 0.15 * Math.sin(u * 1.9 + seed * 0.7));
      ctx.lineTo(sx, anchorY - (h - cam.y * f) * S);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function mist(P) {
    const y0 = Y(3.2), y1 = Y(1);
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, P.paper);
    ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0); ctx.globalAlpha = 1;
  }
  // 石青 river: clearly lower and darker than any ground
  function water(P, t) {
    const top = Y(1), g = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, H));
    g.addColorStop(0, P.water[0]); g.addColorStop(1, P.water[1]);
    ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
    ctx.strokeStyle = 'rgba(230,244,246,0.55)'; ctx.lineWidth = Math.max(1, S * 0.03);
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      const yy = top + (0.12 + row * 0.32) * S;
      for (let sx = -20; sx <= W + 20; sx += 6) {
        const u = (sx - W / 2) / S + cam.x;
        const y = yy + Math.sin(u * 2.2 + t * (1.4 + row * 0.3) + row) * S * 0.04;
        if (sx === -20) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
      }
      ctx.globalAlpha = 0.7 - row * 0.2; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function tiles(P) {
    const x0 = Math.max(0, Math.floor(cam.x - W / 2 / S) - 1), x1 = Math.min(world.w - 1, Math.ceil(cam.x + W / 2 / S) + 1);
    const lw = Math.max(1.5, S * 0.06);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = 0; cy < world.h; cy++) {
        const c = world.cell(cx, cy);
        if (c === '#') {
          // merge a vertical run into one rect
          let top = cy;
          while (top + 1 < world.h && world.cell(cx, top + 1) === '#') top++;
          ctx.fillStyle = P.ink;
          ctx.fillRect(Math.floor(X(cx)) - 0.5, Math.floor(Y(top + 1)), Math.ceil(S) + 1, Math.ceil((top + 1 - cy) * S) + 1);
          // the edges you can walk on and fall off, drawn in bare paper
          ctx.fillStyle = P.rim;
          const open = ch => ch !== '#' && ch !== 'b';
          if (open(world.cell(cx, top + 1))) ctx.fillRect(X(cx) - 1, Y(top + 1), S + 2, lw);
          for (let y = cy; y <= top; y++) {
            if (open(world.cell(cx - 1, y)) && world.cell(cx - 1, y) !== '=') ctx.fillRect(X(cx), Y(y + 1), lw * 0.6, S);
            if (open(world.cell(cx + 1, y)) && world.cell(cx + 1, y) !== '=') ctx.fillRect(X(cx + 1) - lw * 0.6, Y(y + 1), lw * 0.6, S);
          }
          cy = top;
        } else if (c === 'T') thorn(cx, cy);
        else if (c === '=') bridgeCell(cx, cy, P);
      }
    }
    boats(P);
    for (const b of world.burnt) {
      const age = world.clock - b.t;
      if (age > 3) continue;
      ctx.fillStyle = 'rgba(60,30,20,' + (0.6 * (1 - age / 3)).toFixed(3) + ')';
      ctx.fillRect(X(b.x0), Y(b.y0 + 0.25), S, S * 0.25);
    }
  }
  function thorn(cx, cy) {
    const x = X(cx), y = Y(cy + 1);
    ctx.fillStyle = 'rgba(90,40,30,0.35)'; ctx.fillRect(x + S * 0.1, y, S * 0.8, S);
    ctx.strokeStyle = '#5a2a20'; ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const yy = y + S * (0.15 + i * 0.24);
      ctx.moveTo(x + S * 0.5, yy + S * 0.18); ctx.lineTo(x + S * (i % 2 ? 0.05 : 0.95), yy);
      ctx.moveTo(x + S * 0.5, yy + S * 0.18); ctx.lineTo(x + S * (i % 2 ? 0.85 : 0.2), yy - S * 0.08);
    }
    ctx.moveTo(x + S * 0.5, y + S); ctx.lineTo(x + S * 0.5, y);
    ctx.stroke();
  }
  function bridgeCell(cx, cy, P) {
    const b = world.bridges.find(b => cx >= b.x0 && cx < b.x1 && cy + 1 === b.y);
    const age = b ? world.clock - b.t : 9, n = b ? b.x1 - b.x0 : 1, i = b ? cx - b.x0 : 0;
    const grow = clamp(age / 0.5 * n - i, 0, 1);
    if (grow <= 0) return;
    const x = X(cx), y = Y(cy + 1), earth = b && b.el === 'earth';
    ctx.fillStyle = earth ? '#8a6a3e' : '#6b4a2b';
    ctx.fillRect(x, y, S * grow + 0.5, S * 0.42);
    ctx.strokeStyle = earth ? '#5b4426' : '#3e2a18'; ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.beginPath();
    for (let k = 0.25; k < grow; k += 0.25) { ctx.moveTo(x + S * k, y); ctx.lineTo(x + S * k, y + S * 0.42); }
    ctx.stroke();
    ctx.fillStyle = P.rim; ctx.fillRect(x, y, S * grow, Math.max(1.5, S * 0.05));
    if (b && i === 0) { // the glyph that became the bridge, small, on its first plank
      ctx.fillStyle = 'rgba(250,240,220,0.8)'; ctx.font = font(S * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.ch, x + S * 0.5, y + S * 0.22);
    }
  }
  function boats(P) {
    for (let cy = 0; cy < world.h; cy++) {
      let cx = 0;
      while (cx < world.w) {
        if (world.cell(cx, cy) !== 'b') { cx++; continue; }
        let e = cx; while (world.cell(e + 1, cy) === 'b') e++;
        const x0 = X(cx), x1 = X(e + 1), top = Y(cy + 1), bot = Y(cy - 0.15);
        ctx.fillStyle = '#4a3324';
        ctx.beginPath(); ctx.moveTo(x0 - S * 0.35, top); ctx.lineTo(x1 + S * 0.45, top - S * 0.12); ctx.lineTo(x1 - S * 0.2, bot); ctx.lineTo(x0 + S * 0.25, bot); ctx.closePath(); ctx.fill();
        ctx.fillStyle = P.rim; ctx.fillRect(x0 - S * 0.3, top, x1 - x0 + S * 0.6, Math.max(1.5, S * 0.05));
        // mast and a furled sail
        ctx.strokeStyle = '#3a281c'; ctx.lineWidth = Math.max(2, S * 0.07);
        ctx.beginPath(); ctx.moveTo(x0 + S * 1.2, top); ctx.lineTo(x0 + S * 1.2, top - S * 2.6); ctx.stroke();
        ctx.fillStyle = 'rgba(240,230,205,0.9)';
        ctx.beginPath(); ctx.moveTo(x0 + S * 1.25, top - S * 2.5); ctx.lineTo(x0 + S * 2.6, top - S * 0.8); ctx.lineTo(x0 + S * 1.25, top - S * 0.6); ctx.closePath(); ctx.fill();
        cx = e + 1;
      }
    }
  }
  function clouds(t) {
    const p = me();
    for (const c of world.clouds) {
      const used = p.src.has(c.id) && !p.grounded;
      const pulse = c.t > 0 ? 1 + c.t * 0.4 : 1 + Math.sin(t * 1.5 + c.x) * 0.03;
      const x = X(c.x), y = Y(c.y), r = S * 0.3 * pulse;
      ctx.globalAlpha = used ? 0.3 : 0.92;
      ctx.fillStyle = '#fbf7ee'; ctx.strokeStyle = 'rgba(52,58,80,0.55)'; ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.beginPath();
      ctx.arc(x - r * 0.9, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
      ctx.arc(x, y - r * 0.15, r, 0, Math.PI * 2);
      ctx.arc(x + r * 0.95, y + r * 0.15, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.45, Math.PI * 0.2, Math.PI * 1.6); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  function gem(x, y, color, t) {
    const sx = X(x), sy = Y(y) + Math.sin(t * 2 + x) * S * 0.05, r = S * 0.17;
    ctx.fillStyle = color; ctx.strokeStyle = 'rgba(20,40,30,0.6)'; ctx.lineWidth = Math.max(1, S * 0.025);
    ctx.beginPath(); ctx.moveTo(sx, sy - r * 1.3); ctx.lineTo(sx + r, sy); ctx.lineTo(sx, sy + r * 1.3); ctx.lineTo(sx - r, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(sx - r * 0.3, sy - r * 0.4, r * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  function gems(t) { for (const g of world.gems) if (!g.got) gem(g.x, g.y, '#3c9f84', t); }
  function glowGems(t) {
    for (const g of world.glow) if (!g.got) {
      ctx.save(); ctx.globalAlpha = duskF; ctx.shadowColor = '#c9b6ff'; ctx.shadowBlur = S * 0.6; gem(g.x, g.y, '#b9a6ff', t); ctx.restore();
    }
  }
  function pavilion(P, t) {
    const x = X(world.pav.x), y = Y(world.pav.y), want = world.L.want, el = elOf(want);
    // a beam over the pavilion: the goal is visible from anywhere on the isle
    if (world.phase === 'play') {
      const g = ctx.createLinearGradient(0, y - S * 9, 0, y - S * 1.6);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, el.a);
      ctx.globalAlpha = 0.32 + Math.sin(t * 2) * 0.05; ctx.fillStyle = g;
      ctx.fillRect(x - S * 0.45, y - S * 9, S * 0.9, S * 7.4); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(2, S * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - S * 0.75, y); ctx.lineTo(x - S * 0.75, y - S * 1.7); ctx.moveTo(x + S * 0.75, y); ctx.lineTo(x + S * 0.75, y - S * 1.7); ctx.stroke();
    ctx.fillStyle = P.ink;
    ctx.beginPath(); ctx.moveTo(x - S * 1.25, y - S * 1.62); ctx.quadraticCurveTo(x - S * 0.6, y - S * 1.75, x, y - S * 2.35);
    ctx.quadraticCurveTo(x + S * 0.6, y - S * 1.75, x + S * 1.25, y - S * 1.62); ctx.lineTo(x + S * 1.0, y - S * 1.82); ctx.lineTo(x - S * 1.0, y - S * 1.82); ctx.closePath(); ctx.fill();
    if (world.phase === 'play') {
      ctx.globalAlpha = 0.3; ctx.fillStyle = el.b; ctx.font = font(S * 0.8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(want, x, y - S * 0.85); ctx.globalAlpha = 1;
    }
  }

  // the frame round every resting placement: two columns for BESIDE, two rows for ON TOP; red with
  // a cross after a dud; dashed NOT QUITE after a near miss. Neutral otherwise: never a preview (P9).
  function frameBox(a, b, op, style) {
    const x0 = Math.min(a.x, b.x) - SW - 0.07, x1 = Math.max(a.x, b.x) + SW + 0.07;
    const y0 = Math.min(a.y, b.y) - 0.07, y1 = Math.max(a.y, b.y) + SH + 0.07;
    ctx.save();
    ctx.strokeStyle = style.color; ctx.lineWidth = Math.max(1.5, S * 0.04);
    if (style.dash) ctx.setLineDash([S * 0.12, S * 0.08]);
    rr(X(x0), Y(y1), (x1 - x0) * S, (y1 - y0) * S, S * 0.08); ctx.stroke();
    ctx.beginPath();
    if (op === '⿰') { const mx = X((a.x + b.x) / 2); ctx.moveTo(mx, Y(y1) + S * 0.08); ctx.lineTo(mx, Y(y0) - S * 0.08); }
    else { const my = Y(Math.max(a.y, b.y) - 0.0); ctx.moveTo(X(x0) + S * 0.08, my); ctx.lineTo(X(x1) - S * 0.08, my); }
    ctx.stroke();
    if (style.cross) {
      const cx = X((x0 + x1) / 2), cy = Y(y1) - S * 0.18, r = S * 0.13;
      ctx.setLineDash([]); ctx.lineWidth = Math.max(2, S * 0.06);
      ctx.beginPath(); ctx.moveTo(cx - r, cy - r - S * 0.12); ctx.lineTo(cx + r, cy + r - S * 0.12); ctx.moveTo(cx + r, cy - r - S * 0.12); ctx.lineTo(cx - r, cy + r - S * 0.12); ctx.stroke();
    }
    if (style.text) {
      ctx.fillStyle = style.color; ctx.font = '700 ' + Math.max(10, S * 0.2).toFixed(0) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(style.text, X((x0 + x1) / 2), Y(y1) - 3);
    }
    ctx.restore();
  }
  function frames2() {
    const byId = id => world.stones.find(s => s.id === id && s.state === 'loose');
    const shown = new Set();
    for (const f of flashes) {
      const a = byId(f.ia), b = byId(f.ib);
      if (!a || !b) continue;
      shown.add(Math.min(a.id, b.id) + ',' + Math.max(a.id, b.id));
      frameBox(a, b, f.op, f.kind === 'dud' ? { color: '#c8402c', cross: true } : { color: '#7a6f60', dash: true, text: 'NOT QUITE' });
    }
    for (const r of world.placements()) {
      const key = Math.min(r.a.id, r.b.id) + ',' + Math.max(r.a.id, r.b.id);
      if (!shown.has(key)) frameBox(r.a, r.b, r.op, { color: 'rgba(42,38,34,0.55)' });
    }
  }

  // the variant shape a stone shows where it sits (水 on the left draws as 氵)
  function shapeOf(k) {
    if (!world.fz.forms || k.state !== 'loose' || !k.grounded) return k.ch;
    for (const r of world.placements()) {
      if (r.a === k) return RU.form(k.ch, r.op, 1);
      if (r.b === k) return RU.form(k.ch, r.op, 2);
    }
    return k.ch;
  }
  function stoneAt(k, x, y, P, opt) {
    const el = elOf(k.ch), sx = X(x - SW), sy = Y(y + SH), s = SH * S;
    ctx.fillStyle = '#f8f0dc'; ctx.strokeStyle = opt.hi ? '#e0a526' : P.ink; ctx.lineWidth = Math.max(1.5, S * (opt.hi ? 0.075 : 0.045));
    rr(sx, sy, s, s, S * 0.1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = el.a; ctx.fillRect(sx + S * 0.08, sy + s - S * 0.1, s - S * 0.16, Math.max(2, S * 0.045));
    ctx.fillStyle = el.b; ctx.font = font(S * 0.64); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opt.shape || k.ch, sx + s / 2, sy + s * 0.47);
    // pinyin under the stone, on the ground, in bare paper (never on the stone itself)
    if (opt.label > 0.02) {
      ctx.globalAlpha = opt.label; ctx.fillStyle = P.rim; ctx.font = Math.max(10, S * 0.24).toFixed(0) + 'px system-ui, sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText(words(k.ch).py, sx + s / 2, Y(y) + Math.max(1.5, S * 0.06) + 2);
      ctx.globalAlpha = 1;
    }
  }
  function stones(P, a) {
    const p = me(), l = world.launch(p), [mpx] = posOf(p, a);
    for (const k of world.stones) {
      if (k.state === 'gone') continue;
      let [x, y] = posOf(k, a);
      if (k.state === 'held') { const [hx, hy] = posOf(k.holder, a); x = hx; y = hy + HOLD_Y; }
      let label = 0;
      if (k.state === 'loose' && k.grounded && !k.support && UI.labels !== 'card') {
        label = UI.labels === 'near' ? clamp(1 - (Math.abs(x - mpx) - 3) / 3, 0, 1) : 1;
      }
      stoneAt(k, x, y, P, { hi: l.mode === 'grab' && l.k === k, label, shape: shapeOf(k) });
    }
  }
  // where GRAB will put the stone you carry (placement only, never what it makes)
  function ghost() {
    const p = me();
    if (!p.hold || world.fz.assist === 'none') return;
    const l = world.launch(p);
    let x, y;
    if (l.mode === 'beside' || l.mode === 'stack' || l.mode === 'place') { x = l.x; y = l.y; }
    else if (l.mode === 'drop') { x = l.on.x; y = l.on.y + SH; }
    else return;
    ctx.save(); ctx.setLineDash([S * 0.1, S * 0.07]); ctx.strokeStyle = 'rgba(42,38,34,0.6)'; ctx.lineWidth = Math.max(1.5, S * 0.04);
    rr(X(x - SW), Y(y + SH), SH * S, SH * S, S * 0.1); ctx.stroke(); ctx.restore();
  }

  function player(P, a, t) {
    const p = me();
    const [x, y] = posOf(p, a);
    // where you will land: a shadow on whatever is under you, a thin line down to it; on water, red
    if (!p.grounded) {
      const fy = world.floorUnder(x, PW, y);
      const wet = fy < 1.01;
      const gy = wet ? 1 : fy, h = y - gy;
      ctx.strokeStyle = wet ? 'rgba(200,64,44,0.6)' : 'rgba(42,38,34,0.35)'; ctx.lineWidth = Math.max(1, S * 0.025);
      ctx.setLineDash([S * 0.06, S * 0.08]); ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(gy)); ctx.stroke(); ctx.setLineDash([]);
      const rx = S * 0.34 * (1 - Math.min(0.5, h / 10));
      ctx.fillStyle = wet ? 'rgba(200,64,44,0.65)' : 'rgba(20,18,16,0.5)';
      ctx.beginPath(); ctx.ellipse(X(x), Y(gy) + 1, rx, S * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 轻功 ready: a gold ring under your feet while you can still leap
    const cap = p.hold ? world.qi.carry : world.qi.chain;
    if (!p.grounded && p.qi > 0 && p.chain < cap) {
      ctx.strokeStyle = 'rgba(224,165,38,0.9)'; ctx.lineWidth = Math.max(1.5, S * 0.05);
      ctx.beginPath(); ctx.ellipse(X(x), Y(y) + 2, S * 0.3, S * 0.09, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.leapt && p.vy > 0 && Math.random() < 0.7) fx.push({ x: x + (Math.random() - 0.5) * 0.3, y: y + 0.2, vx: 0, vy: -0.6, life: 0.45, max: 0.45, kind: 'wisp', size: 0.1, g: 0 });
    // the body: an ink figure with a bright gold outline, so you always know which one is you
    const sq = land > 0 ? 1 - land * 1.2 : 1, stx = land > 0 ? 1 + land : 1;
    const shake = p.stun > 0 ? Math.sin(t * 60) * S * 0.04 : 0;
    const bx = X(x) + shake, by = Y(y);
    const bob = p.grounded && Math.abs(p.vx) > 0.5 ? Math.abs(Math.sin(t * 14)) * S * 0.04 : 0;
    const hw = PW * S * stx, bh = 0.78 * S * sq;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - hw * 1.05, by); ctx.lineTo(bx + hw * 1.05, by);
    ctx.lineTo(bx + hw * 0.62, by - bh - bob); ctx.lineTo(bx - hw * 0.62, by - bh - bob); ctx.closePath();
    ctx.fillStyle = '#2b2c38'; ctx.fill();
    ctx.strokeStyle = '#e0a526'; ctx.lineWidth = Math.max(2, S * 0.07); ctx.stroke();
    const hx = bx + p.face * S * 0.03, hy = by - bh - bob - S * 0.21 * sq;
    ctx.beginPath(); ctx.arc(hx, hy, S * 0.21, 0, Math.PI * 2);
    ctx.fillStyle = '#f6eedb'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2c38'; ctx.beginPath(); ctx.arc(hx + p.face * S * 0.09, hy - S * 0.02, Math.max(1.5, S * 0.035), 0, Math.PI * 2); ctx.fill();
    // a scarf that trails behind
    ctx.strokeStyle = '#c8402c'; ctx.lineWidth = Math.max(2, S * 0.06); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by - bh - bob + S * 0.06); ctx.quadraticCurveTo(bx - p.face * S * 0.3, by - bh + S * 0.05 - p.vy * S * 0.01, bx - p.face * S * (0.45 + Math.min(0.3, Math.abs(p.vx) * 0.06)), by - bh + S * 0.18 + Math.sin(t * 9) * S * 0.04); ctx.stroke();
    if (p.hold) {
      // arms up under the stone
      ctx.strokeStyle = '#2b2c38'; ctx.lineWidth = Math.max(2, S * 0.07);
      ctx.beginPath(); ctx.moveTo(bx - hw * 0.6, by - bh * 0.85); ctx.lineTo(bx - SW * S * 0.7, Y(y + HOLD_Y) + 2); ctx.moveTo(bx + hw * 0.6, by - bh * 0.85); ctx.lineTo(bx + SW * S * 0.7, Y(y + HOLD_Y) + 2); ctx.stroke();
    }
  }

  function particles() {
    for (const f of fx) {
      const k = Math.max(0, f.life / f.max);
      ctx.globalAlpha = k;
      if (f.kind === 'glyph') {
        ctx.fillStyle = f.color; ctx.font = font(S * (0.9 + (1 - k) * 0.8)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(f.ch, X(f.x), Y(f.y));
      } else if (f.kind === 'wisp') {
        ctx.fillStyle = ART === 'ink' ? 'rgba(29,27,26,0.32)' : 'rgba(80,80,100,0.5)'; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), S * f.size * (1.5 - k * 0.5), 0, Math.PI * 2); ctx.fill();
      } else if (f.kind === 'ring') {
        ctx.strokeStyle = '#1d1b1a'; ctx.lineWidth = Math.max(1, S * 0.08 * k);
        ctx.beginPath(); ctx.ellipse(X(f.x), Y(f.y), S * (0.25 + (1 - k) * 0.7), S * (0.07 + (1 - k) * 0.16), 0, 0, Math.PI * 2); ctx.stroke();
      } else if (f.kind === 'dust') {
        ctx.fillStyle = '#ece0c6'; ctx.beginPath(); ctx.ellipse(X(f.x), Y(f.y), S * f.size * 1.6, S * f.size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      } else if (f.kind === 'seal') {
        const r = S * 0.24, sx = X(f.x), sy = Y(f.y);
        ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = '#c23a2b'; ctx.fillRect(sx - r, sy - r, 2 * r, 2 * r);
        ctx.fillStyle = '#f1e7cf'; ctx.font = font(r * 1.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.ch, sx, sy + r * 0.05);
      } else {
        ctx.fillStyle = f.color || '#2a2622'; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), Math.max(1, S * f.size * (0.5 + k * 0.5)), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  // an arrow at the edge of the screen when you are off it
  function offscreen(P, a) {
    const p = me(), [x, y] = posOf(p, a), sx = X(x), sy = Y(y + PH / 2), m = 26;
    if (sx > 0 && sx < W && sy > 0 && sy < H) return;
    const cx = clamp(sx, m, W - m), cy = clamp(sy, m + 60, H - m), ang = Math.atan2(sy - cy, sx - cx);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = '#e0a526'; ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------- start ----------
  onIsle();
  const go = () => requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('40px "Tongzhou Brush"', '日月明杲'), new Promise(r => setTimeout(r, 1500))]).then(go, go);
  else go();

  // ---------- a small API for the headless checks (screen-check.py) ----------
  window.WF2D = {
    world, ui: UI, cam,
    me, frames: () => frames, scale: () => S,
    feet: () => { const p = me(); return { x: X(p.x), y: Y(p.y) }; },
    padRects: () => padRects().map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height })),
    visibleHud: () => [...document.querySelectorAll('[data-hud]')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return !e.hidden && r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; })
      .map(e => { const r = e.getBoundingClientRect(); return { name: e.dataset.hud, x: r.left, y: r.top, w: r.width, h: r.height }; }),
    say, restart, goIsle, toggleDrawer,
    art: () => ART, pose: () => INK.heroPose({ land }, me()),
    // contrast at every visible walkable top: rock just below the rim against what is just above it
    // (skipping tops with a stone, you, a cloud, a gem or the pavilion over them). WCAG ratio; the
    // plan (ART-DIRECTION §6) wants 3:1 or more.
    probe() {
      const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const px = (x, y) => ctx.getImageData(Math.round(x * DPR), Math.round(y * DPR), 1, 1).data;
      const near = (x, y) => world.stones.some(k => k.state !== 'gone' && Math.abs(k.x - x) < 0.9 && k.y > y - 0.2 && k.y < y + 1.6)
        || (() => { const p = me(); return Math.abs(p.x - x) < 0.8 && p.y > y - 0.2 && p.y < y + 2; })()
        || world.clouds.some(c => Math.abs(c.x - x) < 1.2 && c.y > y && c.y < y + 1.6) || world.gems.some(g => !g.got && Math.abs(g.x - x) < 0.6 && g.y > y && g.y < y + 1.4)
        || Math.abs(world.pav.x - x) < 2.6;
      let min = 99, n = 0, worst = null;
      for (let cx = 0; cx < world.w; cx++) for (let cy = 0; cy + 1 < world.h; cy++) {
        if (world.cell(cx, cy) !== '#' || world.cell(cx, cy + 1) !== '.') continue;
        const x = cx + 0.5, sx = X(x), above = Y(cy + 1.3), below = Y(cy + 0.7);
        if (sx < 4 || sx > W - 4 || above < 4 || below > H - 4 || near(x, cy + 1)) continue;
        if (padRects().some(r => sx > r.left - 4 && sx < r.right + 4 && below > r.top - 4)) continue;
        const a = lum(px(sx, above)), b = lum(px(sx, below)), cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        n++; if (cr < min) { min = cr; worst = [cx, cy]; }
      }
      return { n, min: n ? +min.toFixed(2) : null, worst };
    },
    // checks only: a thumb on the stick, as a number (the same value the stick's pointermove sets)
    setStick(x) { stick.id = x === null ? null : 'check'; stick.x = x || 0; },
    stepN(n) { for (let i = 0; i < n; i++) stepOnce(); },
  };
})();
