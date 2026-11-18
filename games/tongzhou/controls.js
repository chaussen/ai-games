// 同舟 V0.2 controls: all DOM (tray, forge, hold, lists, HUD) and all input.
// The river view is handed in by index.html and is only ever asked to render and pick.
import { createEngine, VERSION, T, tileById } from './engine.js';

export function start(createRenderer) {
  fetch('wild-seed.json').then(function (r) { return r.json(); }).then(function (wild) { boot(wild, createRenderer); });
}

function boot(wild, createRenderer) {
  const $ = function (id) { return document.getElementById(id); };
  const q = new URLSearchParams(location.search);
  const seed = Number(q.get('seed')) || (Date.now() % 99999) + 1;
  if (q.get('minutes')) T.runSeconds = Number(q.get('minutes')) * 60;
  let seen = false;
  try { seen = localStorage.getItem('tzSeen') === '1'; } catch (e) { seen = false; }
  const demo = !seen && !q.get('nodemo');
  const g = createEngine(wild, { seed: seed, demo: demo });
  const riverEl = $('river');
  const renderer = createRenderer(riverEl, {});
  // ui.tile = tray slot waiting for a position; ui.pos = position waiting for a tile; ui.hold = selected hold place
  const ui = { tile: null, pos: null, hold: null, replay: null, sig: '', prevTray: [], burnt: -1 };
  const doneFx = new WeakSet();
  $('ver').textContent = VERSION + ' · river ' + seed;
  window.tz = g;   // for poking at the engine from the console

  // ---- drawing the controls -------------------------------------------------------
  function tileEl(id, slot) {
    const d = document.createElement('div');
    d.className = 'tile'; d.textContent = tileById[id].base;
    if (slot !== undefined) d.dataset.slot = slot;
    return d;
  }

  function drawControls(view) {
    const S = g.S, forgeSlot = S.forge ? S.forge.slot : -1;
    const sig = [S.tray.join(), forgeSlot, ui.tile, ui.pos, ui.hold, ui.burnt,
      view.hold.map(function (h) { return h ? h.char : '-'; }).join(''),
      view.aboard.map(function (a) { return a.id + ':' + a.chips + ':' + a.drainMul; }).join(),
      view.incoming.map(function (a) { return a.id + a.kind; }).join()].join('|');
    if (sig === ui.sig) {   // only the distances moved: update them in place so taps are never lost
      view.incoming.forEach(function (a) {
        const el = document.querySelector('#ahead .thing[data-id="' + a.id + '"] small');
        if (el) el.textContent = Math.round(a.dist) + ' m';
      });
      return;
    }
    ui.sig = sig;

    const tray = $('tray'); tray.textContent = '';
    S.tray.forEach(function (id, i) {
      const d = tileEl(id, i);
      if (i === forgeSlot) d.classList.add('out');
      if (i === ui.tile) d.classList.add('sel');
      if (ui.prevTray.length && ui.prevTray[i] !== id) d.classList.add(i === ui.burnt ? 'burn' : 'new');
      tray.appendChild(d);
    });
    ui.prevTray = S.tray.slice(); ui.burnt = -1;

    const sq = $('square'), first = $('first');
    first.textContent = '';
    if (S.forge) first.appendChild(tileEl(S.tray[forgeSlot]));
    sq.classList.toggle('has', !!S.forge);
    sq.classList.toggle('pick', !!S.forge && ui.tile !== null);
    first.classList.toggle('target', !!S.forge && ui.tile !== null);
    sq.querySelectorAll('.ghost').forEach(function (el) {
      el.style.background = el.dataset.pos === ui.pos ? '#f6e3b4' : '';
    });

    const hold = $('hold'); hold.textContent = '';
    view.hold.forEach(function (h, i) {
      const d = document.createElement('div');
      d.className = 'slot' + (h ? ' full' : '') + (i === ui.hold ? ' sel' : '');
      d.dataset.hold = i;
      if (h) {
        const gl = document.createElement('span'); gl.className = 'g'; gl.textContent = h.char;
        const m = document.createElement('span'); m.className = 'm';
        const b = document.createElement('b'); b.textContent = h.pinyin + ' ' + h.picture;
        m.appendChild(b); m.appendChild(document.createTextNode(h.meaning.split(';')[0]));
        d.appendChild(gl); d.appendChild(m);
      }
      hold.appendChild(d);
    });
    $('overboard').hidden = ui.hold === null;

    const armed = ui.hold !== null;
    const list = function (el, items, canFn, extra) {
      el.textContent = '';
      items.forEach(function (a, n) {
        const d = document.createElement('span');
        d.className = 'thing' + (armed && canFn(n) ? ' can' : '') + (a.drainMul > 1.5 ? ' hot' : '') + (a.drainMul < 1 ? ' eased' : '');
        d.dataset.id = a.id;
        d.textContent = a.picture + ' ' + a.label + ' ';
        const s = document.createElement(extra === 'chips' ? 'span' : 'small');
        if (extra === 'chips') { s.className = 'chips'; s.textContent = '●'.repeat(a.chips) + '○'.repeat(T.chips - a.chips); }
        else s.textContent = Math.round(a.dist) + ' m';
        d.appendChild(s);
        el.appendChild(d);
      });
      if (!items.length) el.textContent = extra === 'chips' ? 'nothing: the boat runs free' : '…';
    };
    list($('aboard'), view.aboard, function () { return true; }, 'chips');
    list($('ahead'), view.incoming, function (n) { return n === 0; }, 'dist');
  }

  function drawHud(view) {
    const b = view.boat;
    let dots = '';
    for (let i = 1; i <= 10; i++) dots += '<i class="' + (b.qi >= i ? 'on' : (b.qi > i - 1 ? 'half' : '')) + '"></i>';
    if ($('qi').dataset.v !== dots) { $('qi').innerHTML = dots; $('qi').dataset.v = dots; }
    const arrows = Math.min(6, Math.ceil(b.speed / 2.2));
    $('speed').textContent = b.stopped ? '■ bogged' : '▶'.repeat(arrows) + ' ' + b.speed.toFixed(1) + ' m/s';
    $('speed').classList.toggle('stopped', b.stopped);
    $('dist').textContent = Math.round(b.distance) + ' m';
    const s = Math.ceil(view.timeLeft);
    $('time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function playFx(view) {
    for (const f of view.fx) {
      if (doneFx.has(f)) continue;
      doneFx.add(f);
      if (f.type === 'outcome') { $('say').textContent = f.text; $('say').className = f.result; }
      if (f.type === 'board') { $('say').textContent = 'Something has come aboard.'; $('say').className = ''; }
      if (f.type === 'burn') ui.burnt = f.slot;
      if (f.type === 'end') showEnd();
    }
  }

  function showReveal(e) {
    const rev = $('reveal'), a = tileById[e.parts[0]], b = tileById[e.parts[1]];
    // Variant by position: the left tile of a left-right character shows its side form (水 -> 氵).
    const left = e.structure === 'LR' && a.left ? a.left : a.base;
    $('revParts').textContent = left + ' + ' + b.base;
    $('revChar').textContent = e.char;
    $('revPinyin').textContent = e.pinyin;
    $('revMeaning').textContent = (e.picture ? e.picture + ' ' : '') + e.meaning;
    rev.hidden = true; void rev.offsetWidth; rev.hidden = false;
    clearTimeout(showReveal.t);
    showReveal.t = setTimeout(function () { rev.hidden = true; }, 2400);
  }

  function showEnd() {
    const S = g.S;
    $('endStats').textContent = Math.round(S.distance) + ' m travelled · ' + S.cleared + ' troubles cleared · ' + S.forged.length + ' characters made';
    const list = $('endList'); list.textContent = '';
    const made = document.createElement('div');
    made.textContent = 'Made: ' + (S.forged.join(' ') || 'none yet');
    list.appendChild(made);
    S.outcomes.forEach(function (o) {
      const d = document.createElement('div'); d.className = o.result; d.textContent = o.text; list.appendChild(d);
    });
    $('end').hidden = false;
  }

  // ---- actions --------------------------------------------------------------------
  function pulseHold() {
    document.querySelectorAll('#hold .slot').forEach(function (el) {
      el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    });
  }
  function place(j, pos) {
    const r = g.placeSecond(j, pos);
    ui.tile = null; ui.pos = null;
    if (r && r.bonded) showReveal(r.bonded);
    if (r && r.blocked) pulseHold();
  }
  function tapTile(i) {
    if (!g.S.forge) { g.placeFirst(i); return; }
    if (i === g.S.forge.slot) return;
    if (ui.pos) { place(i, ui.pos); return; }
    ui.tile = ui.tile === i ? null : i;
  }
  function tapGhost(pos) {
    if (!g.S.forge) return;
    if (ui.tile !== null) place(ui.tile, pos); else ui.pos = ui.pos === pos ? null : pos;
  }
  function tapFirst() {
    if (!g.S.forge) return;
    if (ui.tile !== null) place(ui.tile, 'inside');
    else { g.clearForge(); ui.pos = null; }
  }
  function tapTarget(id) {
    if (ui.hold === null) { if (g.S.hold.some(Boolean)) pulseHold(); return; }
    if (g.spend(ui.hold, id)) ui.hold = null;
  }

  // ---- input ----------------------------------------------------------------------
  let demoRunning = false;
  let drag = null;
  $('tray').addEventListener('pointerdown', function (ev) {
    const el = ev.target.closest('.tile');
    if (!el || ui.replay) return;
    drag = { slot: Number(el.dataset.slot), x: ev.clientX, y: ev.clientY, ghost: null, el: el };
    ev.preventDefault();
  });
  window.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    if (!drag.ghost && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 8) {
      drag.ghost = tileEl(g.S.tray[drag.slot]);
      drag.ghost.classList.add('drag');
      document.body.appendChild(drag.ghost);
      drag.el.style.opacity = '.25';
    }
    if (drag.ghost) {
      drag.ghost.style.left = (ev.clientX - 31) + 'px'; drag.ghost.style.top = (ev.clientY - 40) + 'px';
      $('square').classList.toggle('over', !!zoneAt(ev.clientX, ev.clientY));
    }
  });
  window.addEventListener('pointerup', function (ev) {
    if (!drag) return;
    const d = drag; drag = null;
    $('square').classList.remove('over');
    if (!d.ghost) { tapTile(d.slot); return; }
    d.ghost.remove(); ui.sig = '';
    const zone = zoneAt(ev.clientX, ev.clientY);
    if (!zone) return;
    if (!g.S.forge) g.placeFirst(d.slot);
    else if (d.slot !== g.S.forge.slot) place(d.slot, zone);
  });
  window.addEventListener('pointercancel', function () {
    if (drag && drag.ghost) drag.ghost.remove();
    drag = null; ui.sig = '';
  });
  // Where in the forge square a drop lands: the middle is "onto it", otherwise the nearest side.
  function zoneAt(x, y) {
    const r = $('square').getBoundingClientRect(), pad = 18;
    if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return null;
    const dx = (x - (r.left + r.width / 2)) / (r.width / 2), dy = (y - (r.top + r.height / 2)) / (r.height / 2);
    if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return 'inside';
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'above' : 'below');
  }

  $('square').addEventListener('click', function (ev) {
    const gh = ev.target.closest('.ghost');
    if (gh) tapGhost(gh.dataset.pos);
    else if (ev.target.closest('#first')) tapFirst();
  });
  $('hold').addEventListener('click', function (ev) {
    const el = ev.target.closest('.slot');
    if (!el) return;
    const i = Number(el.dataset.hold);
    if (g.S.hold[i]) ui.hold = ui.hold === i ? null : i;
  });
  $('overboard').addEventListener('click', function () {
    if (ui.hold !== null && g.spend(ui.hold, null)) ui.hold = null;
  });
  $('things').addEventListener('click', function (ev) {
    const el = ev.target.closest('.thing');
    if (el) tapTarget(Number(el.dataset.id));
  });
  riverEl.addEventListener('click', function (ev) {
    const r = riverEl.getBoundingClientRect();
    const id = renderer.pick(ev.clientX - r.left, ev.clientY - r.top);
    if (id !== null && id !== undefined) tapTarget(id);
  });
  $('again').addEventListener('click', function () {
    q.delete('seed'); location.search = q.toString();
  });

  // Debug toggles (B17) and record / replay (B18).
  $('dbgBtn').addEventListener('click', function () { $('debug').hidden = !$('debug').hidden; });
  $('dForgive').addEventListener('change', function (e) { g.dbg.forgive = e.target.checked; });
  $('dHitAll').addEventListener('change', function (e) { g.dbg.hitAll = e.target.checked; });
  $('dProvide').addEventListener('change', function (e) { g.dbg.provide = e.target.checked; });
  $('dRecord').addEventListener('change', function (e) { g.S.record = e.target.checked; });
  $('dSave').addEventListener('click', function () {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([g.exportRun()], { type: 'application/json' }));
    a.download = 'tongzhou-run-' + seed + '.json'; a.click();
  });
  $('dReplay').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(function (txt) {
      ui.replay = { frames: JSON.parse(txt).frames, t0: performance.now() };
      $('debug').hidden = true; $('say').textContent = 'Replaying a recorded run: no input.';
    });
  });

  // ---- first-load ghost hand (B15): drags 日, then 月 to its right. The bond is real. ----
  function runDemo() {
    const hand = $('hand');
    const at = function (el) {
      const r = el.getBoundingClientRect();
      hand.style.transform = 'translate(' + (r.left + r.width / 2 - 14) + 'px,' + (r.top + r.height / 2 - 4) + 'px)';
    };
    const tile = function (i) { return document.querySelector('#tray .tile[data-slot="' + i + '"]'); };
    const steps = [
      [700, function () { hand.hidden = false; at(tile(0)); }],
      [900, function () { at($('square')); }],
      [800, function () { tapTile(0); }],
      [350, function () { at(tile(1)); }],
      [900, function () { tapTile(1); at(document.querySelector('.ghost[data-pos=right]')); }],
      [900, function () { tapGhost('right'); }],
      [500, function () { hand.hidden = true; demoRunning = false; }]
    ];
    demoRunning = true;
    let i = 0;
    const next = function () {
      if (!demoRunning || i >= steps.length) { hand.hidden = true; return; }
      const s = steps[i++];
      setTimeout(function () { if (demoRunning) { s[1](); next(); } else hand.hidden = true; }, s[0]);
    };
    next();
    try { localStorage.setItem('tzSeen', '1'); } catch (e) { /* private mode: show it again next time */ }
    window.addEventListener('pointerdown', function () { demoRunning = false; }, { once: true });
  }

  // ---- loop -----------------------------------------------------------------------
  function fit() { renderer.resize(riverEl.clientWidth, riverEl.clientHeight); }
  new ResizeObserver(fit).observe(riverEl);
  fit();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (ui.replay) {
      const fr = ui.replay.frames, t = now - ui.replay.t0;
      let k = 0;
      while (k < fr.length - 1 && fr[k + 1].t <= t) k++;
      renderer.render(fr[k].view, t);
      drawHud(fr[k].view);
    } else {
      g.tick(dt);
      const view = g.view();
      playFx(view);
      renderer.render(view, g.nowMs());
      drawHud(view);
      drawControls(view);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (demo) runDemo();
}
