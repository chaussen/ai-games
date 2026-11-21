// Session 4 of docs/AUTOTEST.md: the search mind (mind.mjs) plays the REAL page, through the browser's own
// touch path, one frame at a time, and every frame checks that the page shows what the sim knows.
//
//   node lab/autotest/page-mind.mjs <isle-id|all> [persona] [seed] [--phone] [--art=ink|cut|greybox]
//        [--every=N] [--shots=DIR] [--max=SECONDS] [--size=844x390] [--dump=FILE]
//   (server first: PORT=3491 HOST=127.0.0.1 node server.js, a test port, never 3000)
//
// How one frame goes:
//   1. The mind decides from its copy of the world (the "shadow", a Node World). With a persona, its wishes
//      go through human.mjs (late, spread, missed taps) exactly as in the sim runs.
//   2. What the thumbs do becomes CDP touches on the measured stick and buttons: a thumb that stays on the
//      stick (it floats: it starts where the thumb lands), a finger on JUMP while it is held, a tap on GRAB.
//   3. The page runs exactly one frame (?lockstep=1: one sim step per frame, drawn where the sim is). Its
//      requestAnimationFrame is replaced by a test clock, so the page waits for us, however slow the check.
//   4. The shadow replays the calls the page's world received (stick value, presses, steps, restarts) and
//      must then be bit-for-bit the page's world (state check). The page sim and the lab sim are the same
//      code; a difference means the page did something to the world that the lab doesn't model.
//   5. Render check: for the hero and every stone, hide it, redraw (WF2D.redraw), and see which pixels were
//      it. They must be where the sim puts it (tolerances below), and there must be some.
//      GRAB label check: the button says what GRAB would do now (world.launch).
//   The run must reach the same end as the mind in the sim (mind-zero / mind-personas).
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { headless, android, adb } from './cdp.mjs';
import { mind, DT } from './mind.mjs';
import { humanize, PERSONAS } from './human.mjs';
const require = createRequire(import.meta.url);
const SIM = require('../../sim.js');
const IS = require('../../isles.js');
const { PW, PH, SW, SH } = SIM.consts;

const argv = process.argv.slice(2);
const flag = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k)); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const pos = argv.filter((a) => !a.startsWith('--'));
const ISLE = pos[0] || 'two-trees', PERSONA = pos[1] || 'ideal', SEED = +(pos[2] || 1);
const PHONE = !!flag('phone', false), ART = flag('art', 'ink'), EVERY = +flag('every', 1), SHOTS = flag('shots', null);
const VERB = !!flag('v', false);
const MAXS = +flag('max', 180), PORT = +(process.env.PORT || 3491), DUMP = flag('dump', null);
const [VW, VH] = String(flag('size', '844x390')).split('x').map(Number);

// ---------- what runs in the page ----------
// the page's requestAnimationFrame waits for us: __tick() runs one frame
// Chrome holds touch moves until its next real frame (rAF-aligned input): 159 of 200 moves in a probe arrived
// only then, so a move landed before or after a sim step by chance and runs drifted apart (Forest won in 26.8 s
// once and 26.4 s the next). __flush waits for one real frame, after which every touch sent has arrived.
const CLOCK = `(() => { const q = []; let t = 0; const real = window.requestAnimationFrame.bind(window);
  window.__flush = () => new Promise((ok) => real(() => ok(1)));
  window.__evs = []; for (const k of ['touchstart', 'touchend', 'touchcancel', 'pointerdown', 'pointerup', 'pointercancel'])
    addEventListener(k, (e) => { if (__evs.length < 40) __evs.push(k + ':' + (e.pointerType || '') + (e.pointerId !== undefined ? '#' + e.pointerId : '') + '@' + ((e.target && (e.target.id || e.target.tagName)) || '?') + (e.clientX !== undefined ? ' ' + Math.round(e.clientX) + ',' + Math.round(e.clientY) : '')); }, true);
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; }; window.cancelAnimationFrame = () => {};
  window.__tick = () => { t += 1000 / 60; const c = q.splice(0); for (const f of c) f(t); return c.length; }; })();`;
// the state signature: the same function in the page and in Node, every number at full precision
const SIG = `(w) => { const p = w.players.get('me'), n = (v) => typeof v === 'number' ? v.toPrecision(17) : String(v);
  const a = [w.index, w.clock, w.phase, p.x, p.y, p.vx, p.vy, p.grounded, p.hold && p.hold.id, p.qi, p.chain, p.face, w.dusk];
  for (const k of w.stones) a.push(k.id, k.ch, k.state, k.x, k.y);
  for (const h of w.hedges) a.push(h.done); for (const g of w.gems) a.push(g.got);
  return a.map(n).join(','); }`;
const sigOf = eval(SIG);
const PAGE = `(() => {
  const W = WF2D.world, log = [], sig = ${SIG};
  const wrap = (k, f) => { const o = W[k].bind(W); W[k] = (...a) => { f(...a); return o(...a); }; };
  wrap('setInput', (id, x, j) => log.push(['in', +x || 0, !!j]));
  wrap('press', (id, w) => log.push(['press', w]));
  wrap('step', () => log.push(['step']));
  wrap('load', (i) => log.push(['load', i]));
  wrap('setProfile', (n) => log.push(['profile', n]));
  const cv = document.querySelector('#world'), cx = cv.getContext('2d');
  const grab = document.querySelector('#grab'), stickEl = document.querySelector('#stick');
  const { PW, PH, SW, SH } = WSim.consts;
  function render() {
    const S = WF2D.scale(), p = WF2D.me(), f = WF2D.feet(), D = cv.width / innerWidth;
    const sx = (x) => f.x + (x - p.x) * S, sy = (y) => f.y - (y - p.y) * S;
    const things = [{ o: p, id: 'hero', kind: 'hero', box: [p.x - PW, p.y, p.x + PW, p.y + PH] }];
    for (const k of W.stones) if (k.state !== 'gone')
      things.push({ o: k, id: k.ch + k.id, kind: k.state === 'held' ? 'held' : k.flying ? 'flying' : k.grounded ? 'rest' : 'air',
        box: [k.x - SW, k.y, k.x + SW, k.y + SH] });
    // pinyin tags off while measuring: a tag is drawn under a resting stone, and on pale mist it has more
    // contrast than the stone's cream face, so it pulled the window down 0.27 u (Red Earth, Old Leaf, S4)
    // effects aside too: One Stroke's forge stamp draws the new character over its stone for 15 frames, so
    // hiding the stone changed only its bottom strip (every isle in the cut look, S4)
    const tags = WF2D.ui.labels, fx = WF2D.fx.splice(0); WF2D.ui.labels = 'card'; WF2D.redraw();
    const full = cx.getImageData(0, 0, cv.width, cv.height).data, CW = cv.width, CH = cv.height;
    const L = W.launch(p); W.launch = () => L;            // what GRAB would do stays as it was while things hide
    const out = [];
    for (const t of things) {
      const [x0, y0, x1, y1] = t.box, m = 0.8 * S;
      const r = { id: t.id, kind: t.kind, box: [sx(x0), sy(y1), sx(x1), sy(y0)] };
      const a0 = Math.max(0, Math.floor((r.box[0] - m) * D)), b0 = Math.max(0, Math.floor((r.box[1] - m) * D));
      const a1 = Math.min(CW, Math.ceil((r.box[2] + m) * D)), b1 = Math.min(CH, Math.ceil((r.box[3] + m) * D));
      // how much of the box is on the screen: nothing to see if none of it is
      const vw = Math.max(0, Math.min(innerWidth, r.box[2]) - Math.max(0, r.box[0])), vh = Math.max(0, Math.min(innerHeight, r.box[3]) - Math.max(0, r.box[1]));
      r.vis = vw * vh / ((r.box[2] - r.box[0]) * (r.box[3] - r.box[1]));
      if (r.vis <= 0 || a1 <= a0 || b1 <= b0) { r.off = true; out.push(r); continue; }
      // hide it: NaN coordinates draw nothing. A carried stone is drawn from its holder's place, so it
      // hides behind a stand-in holder that is nowhere
      const o = t.o, sv = { x: o.x, _px: o._px, holder: o.holder };
      if (t.kind === 'held') o.holder = { ...o.holder, x: NaN, _px: NaN, y: NaN, _py: NaN };
      else { o.x = NaN; o._px = NaN; }
      WF2D.redraw();
      o.x = sv.x; o._px = sv._px; if (t.kind === 'held') o.holder = sv.holder;
      const d = cx.getImageData(a0, b0, a1 - a0, b1 - b0).data, RW = a1 - a0, RH = b1 - b0;
      // the mask of pixels that were this thing, and its integral image (for the sliding window below)
      const I = new Int32Array((RW + 1) * (RH + 1));
      let n = 0, nIn = 0, u0 = 1e9, v0 = 1e9, u1 = -1e9, v1 = -1e9;
      for (let v = b0; v < b1; v++) { let row = 0; for (let u = a0; u < a1; u++) {
        const i = ((v - b0) * RW + (u - a0)) * 4, j = (v * CW + u) * 4;
        const on = Math.abs(d[i] - full[j]) + Math.abs(d[i + 1] - full[j + 1]) + Math.abs(d[i + 2] - full[j + 2]) >= 24;
        row += on; I[(v - b0 + 1) * (RW + 1) + (u - a0 + 1)] = I[(v - b0) * (RW + 1) + (u - a0 + 1)] + row;
        if (!on) continue;
        n++; const X = u / D, Y = v / D;
        if (X >= r.box[0] && X <= r.box[2] && Y >= r.box[1] && Y <= r.box[3]) nIn++;
        if (X < u0) u0 = X; if (X > u1) u1 = X; if (Y < v0) v0 = Y; if (Y > v1) v1 = Y;
      } }
      // where is it drawn? the box-sized window holding the most of it; ties go to the one nearest the sim box
      const bw = Math.round((r.box[2] - r.box[0]) * D), bh = Math.round((r.box[3] - r.box[1]) * D);
      const ex = Math.round(r.box[0] * D) - a0, ey = Math.round(r.box[1] * D) - b0;
      let best = -1, bx = 0, by = 0;
      if (r.vis >= 0.999 && n) for (let y = 0; y + bh <= RH; y++) for (let x = 0; x + bw <= RW; x++) {
        const c = I[(y + bh) * (RW + 1) + x + bw] - I[y * (RW + 1) + x + bw] - I[(y + bh) * (RW + 1) + x] + I[y * (RW + 1) + x];
        if (c > best || (c === best && Math.hypot(x - ex, y - ey) < Math.hypot(bx - ex, by - ey))) { best = c; bx = x; by = y; }
      }
      if (best >= 0) { r.shift = [(bx - ex) / D / S, (by - ey) / D / S]; r.fill = best / (bw * bh); }
      r.n = n; r.nIn = nIn; r.area = vw * vh * D * D;    // the visible part of the box, in canvas pixels
      r.edgeHit = n > 0 && (u0 * D <= a0 + 1 || u1 * D >= a1 - 2 || v0 * D <= b0 + 1 || v1 * D >= b1 - 2);
      if (n) r.got = [u0, v0, u1, v1];
      out.push(r);
    }
    delete W.launch;
    WF2D.ui.labels = tags; WF2D.fx.push(...fx); WF2D.redraw();
    return { S, out, screen: [innerWidth, innerHeight] };
  }
  window.__pm = {
    frame(check) {
      const ran = __tick();
      const l = W.launch(WF2D.me());
      const r = { calls: log.splice(0), sig: sig(W), grab: grab.dataset.mode || 'none', mode: l.mode, ran,
        stick: stickEl.classList.contains('live'), drawer: !document.querySelector('#drawer').hidden };
      if (check) r.render = render();
      return r;
    },
    calls: () => log.splice(0),
    sig: () => sig(W),
    rect: (sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height } : null; },
    info: () => ({ isle: W.L.id, index: W.index, profile: W.profileOverride, art: WF2D.art(), lock: WF2D.lockstep, W: innerWidth, H: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent }),
  };
  return true;
})()`;

// ---------- render verdict (tolerances in world units; see AUTOTEST.md §5, S4) ----------
function verdict(r) {
  const bad = [];
  const S = r.S;
  for (const o of r.out) {
    // off the screen, or a sliver at its edge (under 5% of it, a few pixels: Stove f247 had 1.6 x 0.6 px)
    if (o.off || o.vis < 0.05) continue;
    if (!o.n) { bad.push(`${o.id} (${o.kind}) not drawn: no pixel changes when it is hidden`); continue; }
    if (o.vis < 0.999) {
      // partly off the screen: the drawn part is cut too, so only "some of it is drawn, inside its box"
      // (15%: a stone's top quarter rising into view is mostly its pale face; Old Leaf f258 drew 29% of it,
      // its top row 1 px from the sim's)
      if (o.nIn < 0.15 * o.area) bad.push(`${o.id} (${o.kind}, ${Math.round(100 * o.vis)}% on screen) only ${Math.round(100 * o.nIn / o.area)}% of its visible box drawn`);
    } else {
      // where the box-sized window holding the most of its pixels sits, against the sim box (in units)
      const [dx, dy] = o.shift, at = `${dx.toFixed(2)}, ${(-dy).toFixed(2)} u`;
      if (o.kind === 'rest' || o.kind === 'air') {
        // a stone at rest is a block that keeps its box exactly ("what you see is what you hit")
        // (the pinyin slip and a landing mark beside it move the window by up to 0.10 u: Sun and Moon, S4)
        if (Math.hypot(dx, dy) > 0.15) bad.push(`${o.id} (${o.kind}) drawn ${at} off its sim box`);
        // the hero in front covers part of it (46% seen on Two Trees): only a stone mostly missing fails
        if (o.fill < 0.3) bad.push(`${o.id} (${o.kind}) fills only ${Math.round(100 * o.fill)}% of its box`);
      } else if (o.kind === 'hero') {
        // a figure about its box. Its pixels include the landing mark below it in the air (window up to 0.5 u
        // lower) and the thing it carries above its head (0.5 to 0.7 u higher): measured on Two Trees, S4.
        // A mid-air 轻功 step is drawn tucked, feet on the box floor, with its cloud ring under the feet:
        // 0.70 u lower on Forest f336, so lower is allowed to 0.8 u
        const up = -dy, carrying = r.out.some((x) => x.kind === 'held');
        if (Math.abs(dx) > 0.3 || up < -0.8 || up > (carrying ? 0.9 : 0.2)) bad.push(`hero drawn ${at} off its sim box${carrying ? ' (carrying)' : ''}`);
        if (o.fill < 0.2) bad.push(`hero fills only ${Math.round(100 * o.fill)}% of its box`);
      } else {
        // held or in flight: the stone shows its thing (a tree on your shoulder, a log when thrown), round
        // the stone's spot, a little lower when held (the renderer's choice, README). One Stroke draws a
        // carried thing in the hand for its pose, not over the head: 0.85-0.89 u away (Blaze, Friends, Partner)
        if (Math.hypot(dx, dy) > (o.kind === 'held' ? 1.0 : 0.75)) bad.push(`${o.id} (${o.kind}) drawn ${at} from its sim spot`);
      }
    }
  }
  return bad;
}

// ---------- the thumbs: what the hands do becomes touches ----------
// touch ids are never reused: on the phone the same tab plays isle after isle, and a finger id still down
// from the last isle makes the next isle's first touch a move, not a press, so the stick never woke (a later
// isle in landscape, three times; the first isle in the tab always played)
let nid = 1;
function thumbs(page, scr) {
  const ox = Math.min(150, scr.W * 0.3), oy = scr.H - 80;  // where the stick thumb lands (lower left, not on a button)
  const down = new Map();                                  // finger -> {id, x, y}
  let jumpAt = null, grabAt = null;
  const pts = () => [...down.values()].map((p) => ({ ...p }));   // a snapshot: later moves must not change a queued event
  return {
    async setButtons(j, g) { jumpAt = j; grabAt = g; },
    async deliver(x, jump, taps) {
      const ev = [];
      // lift: GRAB taps last one frame; JUMP lifts when let go, or lifts and lands again for a fresh press
      if (down.has('grab')) { ev.push(['touchEnd', [down.get('grab')]]); down.delete('grab'); }
      if (down.has('jump') && (!jump || taps.includes('jump'))) { ev.push(['touchEnd', [down.get('jump')]]); down.delete('jump'); }
      // the stick thumb: lands at its origin, then slides to x (the stick floats; 40 px is full tilt)
      if (!down.has('stick')) { down.set('stick', { id: nid++, x: ox, y: oy }); ev.push(['touchStart', pts()]); }
      const sxp = ox + 40 * Math.max(-1, Math.min(1, x));
      if (down.get('stick').x !== sxp) { down.get('stick').x = sxp; ev.push(['touchMove', pts()]); }
      if ((jump || taps.includes('jump')) && !down.has('jump')) { down.set('jump', { id: nid++, x: jumpAt.x, y: jumpAt.y }); ev.push(['touchStart', pts()]); }
      if (taps.includes('grab')) { down.set('grab', { id: nid++, x: grabAt.x, y: grabAt.y }); ev.push(['touchStart', pts()]); }
      for (const [t, p] of ev) await page.touch(t, p);
      if (ev.length) await page.eval('__flush()');
    },
    async liftAll() { if (down.size) { await page.touch('touchEnd', []); await page.eval('__flush()'); } down.clear(); },
    async tap(at) { await page.touch('touchStart', [{ id: nid++, x: at.x, y: at.y }]); await page.touch('touchEnd', []); await page.eval('__flush()'); },
  };
}

// ---------- one run ----------
async function runIsle(browser, isleId) {
  const idx = IS.ISLES.findIndex((L) => L.id === isleId);
  if (idx < 0) throw new Error('no isle ' + isleId);
  const url = `http://127.0.0.1:${PORT}/?lockstep=1&mute=1&touch=1&labels=all&art=${ART}&isle=${isleId}`;
  const page = await browser.open(url, CLOCK);
  const errs = [];
  page.on('Runtime.exceptionThrown', (e) => errs.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  // let the page start (fonts, first frames): the game's loop begins on the second tick
  for (let i = 0; i < 100 && !(await page.eval('typeof WF2D !== "undefined"')); i++) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, PHONE ? 1600 : 400));
  // Phone: where a real tap on the page's lower left lands on the glass (content sits at the bottom right of
  // the screen: status and address bars above, the navigation bar at the left in landscape). Used only when a
  // run's touches stop arriving, to see whether a real one does (finding T9)
  let tapAt = null;
  if (PHONE) {
    const v = await page.eval('({ W: innerWidth, H: innerHeight, d: devicePixelRatio })');
    const [a, b] = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)/).slice(1).map(Number);
    const [PWd, PHt] = v.W > v.H ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)];
    const x = Math.round(PWd - v.W * v.d + v.W * 0.12 * v.d), y = Math.round(PHt - v.H * v.d + v.H * 0.8 * v.d);
    tapAt = [x, y];
  }
  await page.eval(PAGE);
  if (await page.eval('document.visibilityState') !== 'visible') throw new Error('the page is not in front: Chrome would not draw it or deliver touches');
  const info = await page.eval('__pm.info()');
  if (!info.lock) throw new Error('page is not in lockstep');
  for (let i = 0; i < 3; i++) await page.eval('__pm.frame(false)');
  // the shadow: the same world the page built (new World, load, addPlayer), then the calls it has seen
  const sh = new SIM.World(); sh.load(info.index); sh.addPlayer('me', 'you');
  if (info.profile) sh.setProfile(info.profile);
  sh.drain();
  const replay = (calls) => { for (const c of calls) {
    if (c[0] === 'in') sh.setInput('me', c[1], c[2]); else if (c[0] === 'press') sh.press('me', c[1]);
    else if (c[0] === 'step') sh.step(DT); else if (c[0] === 'load') sh.load(c[1]); else if (c[0] === 'profile') sh.setProfile(c[1]);
  } };
  // the frames before we started (the page already ran a few) are replayed too: the check starts at 0
  replay((await page.eval('__pm.calls()')));
  const s0 = await page.eval('__pm.sig()');
  // a page that ran frames before the wrap gets them as a fresh shadow from its own clock
  if (sigOf(sh) !== s0) {
    const steps = Math.round(+s0.split(',')[1] / DT);
    const sh2 = new SIM.World(); sh2.load(info.index); sh2.addPlayer('me', 'you'); if (info.profile) sh2.setProfile(info.profile);
    for (let i = 0; i < steps; i++) { sh2.setInput('me', 0, false); sh2.step(DT); }
    if (sigOf(sh2) !== s0) throw new Error('shadow does not start equal to the page:\n page ' + s0.slice(0, 200) + '\n lab  ' + sigOf(sh2).slice(0, 200));
    Object.assign(sh, sh2); sh.players = sh2.players;
  }
  sh.drain();
  const scr = { W: info.W, H: info.H };
  const th = thumbs(page, scr);
  try { await page.touch('touchEnd', []); await page.eval('__flush()'); } catch (_) {}   // no finger left from before
  const jumpAt = await page.eval('__pm.rect("#jump")'), grabAt = await page.eval('__pm.rect("#grab")');
  await th.setButtons(jumpAt, grabAt);
  // the mind and its hands (the same channel as the sim runs)
  const want = { x: 0, jump: false, taps: [] };
  const TW = new Proxy(sh, { get(t, k) {
    if (k === 'setInput') return (id, x, j) => { want.x = +x || 0; want.jump = !!j; };
    if (k === 'press') return (id, w) => { want.taps.push(w); };
    if (k === 'step') return () => {};
    const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
  } });
  const H = PERSONAS[PERSONA];
  const hw = H ? humanize(TW, 'me', H, SEED) : TW;
  const opt = { hands: H ? { d: Math.round(H.t * 60), leap: Math.ceil(Math.max(H.t, H.retap ?? 0.07) * 60 - 1e-9) } : null };
  let m = mind(sh, 'me', opt); const nav = m.nav;
  const PROGRESS = new Set(['forge', 'bridge', 'burn', 'douse', 'dispel', 'offer']);
  const lost = (d) => d && d.startsWith('wait') && !/grow back|watching/.test(d);
  let deadStick = 0, stuck = 0, same = 0, lastDesc = '', lastGood = 0, before = 0;
  const restarts = [], ev = [], fails = [], grabSeen = [];
  let renderChecks = 0, renderBad = 0, stateBad = 0, labelBad = 0, prevLabel = 'none';
  const t0 = Date.now();
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const max = MAXS * 60;
  let f = 0;
  for (; f < max && sh.phase === 'play'; f++) {
    const o = m.tick();
    want.taps = [];
    hw.setInput('me', o.x, o.jump);
    for (const k of o.press) hw.press('me', k);
    hw.step(DT);          // the channel decides what the thumbs deliver this frame (into `want`)
    if (want.taps.includes('grab')) grabSeen.push({ f, label: prevLabel });
    await th.deliver(want.x, want.jump, want.taps);
    if (VERB && f % 30 === 0) { const p = sh.players.get('me'); console.log(`  f${f} x ${p.x.toFixed(2)} y ${p.y.toFixed(2)} g ${p.grounded} want ${want.x.toFixed(2)}/${want.jump}/${want.taps} o ${o.x.toFixed(2)}/${o.jump}/${o.press}  plan ${m.plan && m.plan.desc} | ${m.choice}`); }
    const check = f % EVERY === 0;
    const r = await page.eval(`__pm.frame(${check})`);
    replay(r.calls);
    if (VERB && f < 4) console.log("  ran", r.ran, "calls", JSON.stringify(r.calls), "stick live", r.stick, "drawer", r.drawer);
    const evs = sh.drain();
    for (const e of evs) { ev.push({ f, ...e }); if (PROGRESS.has(e.t)) lastGood = f; }
    // state check
    const ss = sigOf(sh);
    if (ss !== r.sig) {
      stateBad++;
      if (stateBad <= 3) fails.push(`f${f} state: page and lab differ\n   page ${r.sig.slice(0, 160)}\n   lab  ${ss.slice(0, 160)}`);
      // the page is the truth: rebuild nothing, stop (the mind would play a different game)
      break;
    }
    // GRAB label check: the button says what GRAB does now
    const lm = sh.launch(sh.players.get('me')).mode;
    if (r.grab !== lm && r.grab !== (lm === 'none' ? '' : lm)) { labelBad++; if (labelBad <= 5) fails.push(`f${f} GRAB label "${r.grab}" but GRAB would ${lm}`); }
    prevLabel = r.grab;
    // the stick thumb is down and tilted but the page has no live stick: touches are not arriving (a tab in
    // the background, a touch the page took for something else). Stop after 10 frames rather than step on
    deadStick = !r.stick && want.x !== 0 ? deadStick + 1 : 0;
    if (deadStick === 10) {
      let more = '';
      if (PHONE) {     // does a real tap reach the page now, after 10 drawn frames? and what is on the glass?
        adb('shell', 'input', 'tap', String(tapAt[0]), String(tapAt[1])); await new Promise((r) => setTimeout(r, 1000)); await page.eval('__flush()');
        more = '; after a real tap ' + JSON.stringify(await page.eval('__evs.slice(-4)'));
        if (SHOTS) { const { execFileSync } = await import('child_process'); writeFileSync(`${SHOTS}/${isleId}-dead-glass.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'])); }
      }
      fails.push(`f${f} the stick thumb has been down 10 frames but the page's stick is not live: stopped; the page got ` + JSON.stringify(await page.eval('__evs')) + more); break;
    }
    // render check
    if (r.render) {
      renderChecks++;
      const bad = verdict(r.render);
      if (bad.length) { renderBad++; if (renderBad <= 8) fails.push(`f${f} render: ${bad.join('; ')}`); }
      if (DUMP) (runIsle.dump ||= []).push({ f, isle: isleId, ...r.render });
      if (SHOTS && (bad.length && renderBad <= 3)) await page.shot(`${SHOTS}/${isleId}-f${f}-bad.png`);
    }
    if (SHOTS && f % 300 === 0) await page.shot(`${SHOTS}/${isleId}-f${f}.png`);
    // a person who sees no way on restarts from the menu (the rules of mind.mjs play())
    const desc = m.plan && m.plan.desc;
    stuck = lost(desc) ? stuck + 1 : 0;
    same = desc === lastDesc && !/grow back|watching/.test(desc || '') ? same + 1 : 0; lastDesc = desc;
    if (stuck >= 15 * 60 || same >= 40 * 60 || f - lastGood >= 75 * 60) {
      const p = sh.players.get('me');
      restarts.push({ t: +(f * DT).toFixed(1), why: desc, at: [+p.x.toFixed(1), +p.y.toFixed(1)] });
      before += sh.time;
      await th.liftAll();
      await th.tap(await page.eval('__pm.rect("#menu")'));
      await page.eval('__pm.frame(false)').then((x) => replay(x.calls));
      const rb = await page.eval('__pm.rect("#drawer [data-act=restart]")');
      if (!rb) { fails.push(`f${f} restart: the menu did not open`); break; }
      await th.tap(rb);
      for (let i = 0; i < 2; i++) replay((await page.eval('__pm.frame(false)')).calls);
      sh.drain();
      m = mind(sh, 'me', { ...opt, nav, jitter: restarts.length });
      stuck = 0; same = 0; lastGood = f;
    }
  }
  // the win card: the page shows it after winDelay; check it says the character
  let card = null;
  if (sh.phase === 'won') {
    for (let i = 0; i < 120; i++) { const r = await page.eval('__pm.frame(false)'); replay(r.calls); }
    card = await page.eval(`(() => { const e = document.querySelector('#win'); return e.hidden ? null : e.querySelector('.g').textContent; })()`);
    if (card !== sh.result.ch) fails.push(`win card shows ${card}, the world made ${sh.result.ch}`);
    if (SHOTS) await page.shot(`${SHOTS}/${isleId}-won.png`);
  }
  if (errs.length) fails.push('page errors: ' + errs.slice(0, 3).join(' | '));
  const wall = (Date.now() - t0) / 1000;
  await th.liftAll();
  await page.close?.();
  const time = sh.result ? Math.round((before + sh.result.time) * 10) / 10 : null;
  return { isle: isleId, won: sh.phase === 'won', time, frames: f, restarts, renderChecks, renderBad, stateBad, labelBad,
    grabs: grabSeen.length, fails, wall, info, log: m.log };
}

// ---------- main ----------
const browser = PHONE ? await android(PORT) : await headless({ width: VW, height: VH, dpr: 2 });
if (PHONE) console.log(`phone: ${browser.model}, ${browser.version.Browser}`);
const isles = ISLE === 'all' ? IS.ISLES.map((L) => L.id) : ISLE.split(',');
const results = [];
let wake = null;
if (PHONE) { try { wake = adb('shell', 'settings', 'get', 'global', 'stay_on_while_plugged_in'); adb('shell', 'svc', 'power', 'stayon', 'usb'); } catch (_) {} }
try {
  for (const id of isles) {
    const r = await runIsle(browser, id);
    results.push(r);
    console.log(`${id.padEnd(14)} ${PERSONA}/${SEED} ${r.won ? 'WON ' + String(r.time).padStart(5) + ' s' : 'NOT WON'}  frames ${r.frames}` +
      `  render ${r.renderChecks - r.renderBad}/${r.renderChecks} ok  state ${r.stateBad ? 'DIFFERS' : 'equal'}  label ${r.labelBad ? r.labelBad + ' wrong' : 'ok'}` +
      `  grabs ${r.grabs}  restarts ${r.restarts.length}  [${r.wall.toFixed(0)} s wall, ${r.info.W}x${r.info.H} ${r.info.art}]`);
    for (const x of r.fails) console.log('   ! ' + x);
    if (!r.won) console.log('   ' + r.log.slice(-12).join('\n   '));
  }
} finally {
  if (PHONE && wake !== null) { try { adb('shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', wake === 'null' ? '0' : wake); } catch (_) {} }
  await browser.close();
}
if (DUMP) writeFileSync(DUMP, JSON.stringify(runIsle.dump || []));
const ok = results.filter((r) => r.won && !r.renderBad && !r.stateBad && !r.labelBad && !r.fails.length).length;
console.log(`\n${ok} / ${results.length} isles: won, and every check passed`);
process.exitCode = ok === results.length ? 0 : 1;
