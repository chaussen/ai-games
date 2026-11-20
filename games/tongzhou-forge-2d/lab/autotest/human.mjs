// A human "motor channel" between a test player's mind (the route bots in ../../bot.mjs) and the game
// (session 2 of docs/AUTOTEST.md). The mind decides what to press; the channel turns that into what a
// person's thumbs would actually deliver: late (timing error), a stick that sits where the thumb put it
// (placement noise, the page's dead zone), a JUMP held a little too long or short, and taps that miss the
// button (then, after noticing nothing happened, a second tap). Seeded: one seed = one exact run.
//
// The numbers in PERSONAS are first guesses, NOT measurements. They come from the shape of the research
// (coincidence-anticipation timing, FFitts-law touch spread), scaled to this game's buttons. They are what
// real family play would calibrate (AUTOTEST.md §4.6, the recorder).
//
// Usage: const hw = humanize(w, 'me', PERSONAS.kid, seed); run(hw, 'me', steps) — `hw` is the world with
// setInput / press / launch / step wrapped; everything else passes through. hw.human.stats has the counts.

export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (R) => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
const logn = (R, med, s) => med * Math.exp(s * gauss(R));

// Button radii in CSS px, measured from the real page (WF2D.padRects) on a phone in landscape (844×390 and
// 667×375 give the same): JUMP 66 px, GRAB 58 px across.
export const PADS = { jump: 33, grab: 29 };
// Chance a tap aimed at the centre lands inside a round button of radius r, thumb spread sigma (2-D normal).
export const pHit = (r, sigma) => sigma <= 0 ? 1 : 1 - Math.exp(-(r * r) / (2 * sigma * sigma));

// t: timing error of a planned press/stick change, lognormal (median s, log spread), always late of the
//    mind's moment (the route bots act at the early edge of each window, so late errors are the risky ones)
// servo: lag for small same-direction stick corrections (seeing and steering, not deciding)
// stick: thumb placement spread (stick units, 1 = full tilt); levels: the stick positions a thumb holds
// aim: tap spread in CSS px; notice: how long before a missed tap is noticed and tapped again
// hold: extra JUMP hold, lognormal multiplier spread (0 = exact)
export const PERSONAS = {
  ideal:  null,                                                   // no channel: the route bot as written
  steady: { t: 0.06, tS: 0.5, servo: 0.10, stick: 0.06, levels: [0, 0.3, 0.6, 1], aim: 9,  notice: 0.45, hold: 0.25 },
  rusher: { t: 0.04, tS: 0.5, servo: 0.08, stick: 0.04, levels: [0, 1],           aim: 13, notice: 0.35, hold: 0.15 },
  kid:    { t: 0.11, tS: 0.6, servo: 0.16, stick: 0.15, levels: [0, 0.5, 1],      aim: 16, notice: 0.8,  hold: 0.45 },
};

export function humanize(w, id, H, seed) {
  if (!H) return w;
  const R = rng(seed), p = w.players.get(id), DT = 1 / 60;
  let frame = 0; const now = () => frame * DT;
  let want = { x: 0, jump: false }, presses = [];
  let lastQ = 0, lastJ = false, tLast = 0;
  const cur = { x: 0, jump: false };
  const queue = [];
  const stats = { actions: 0, misses: 0, retries: 0, lagMax: 0 };
  const sched = (kind, v, lag) => {
    const t = Math.max(tLast, now() + lag); tLast = t;
    queue.push({ t, kind, v }); stats.lagMax = Math.max(stats.lagMax, lag);
  };
  const decide = () => H.t ? logn(R, H.t, H.tS) : 0;
  const quant = (x) => { const a = Math.abs(x); let best = 0; for (const l of H.levels) if (Math.abs(l - a) < Math.abs(best - a)) best = l; return Math.sign(x) * best; };
  const tap = (what, tries) => {
    stats.actions++;
    if (R() < pHit(PADS[what], H.aim)) return true;
    stats.misses++;
    if (tries < 2) { stats.retries++; sched(what === 'jump' ? 'jumpDown' : 'grab', tries + 1, H.notice * Math.exp(0.3 * gauss(R))); }
    return false;
  };
  const deliver = (e) => {
    if (e.kind === 'x') {
      const v = e.v === 0 ? 0 : Math.max(-1, Math.min(1, e.v + H.stick * gauss(R)));
      cur.x = Math.abs(v) < 0.16 ? 0 : v;                     // the page's stick dead zone
    } else if (e.kind === 'jumpDown') {
      // a retry only makes sense while the mind still wants that jump and you are still on the ground
      if (e.v > 0 && !(want.jump && (p.grounded || p.coyote > 0 || p.qi > 0))) return;
      if (tap('jump', e.v || 0)) { w.press(id, 'jump'); cur.jump = true; }
    } else if (e.kind === 'jumpUp') {
      cur.jump = false;
    } else if (e.kind === 'grab') {
      if (tap('grab', e.v || 0)) w.press(id, 'grab');
    }
  };
  const tick = () => {
    // the mind's wishes this frame become planned thumb movements
    const q = quant(want.x);
    if (q !== lastQ) {
      const flip = Math.sign(q) !== Math.sign(lastQ);
      sched('x', q, flip ? decide() : H.servo ? H.servo * Math.exp(0.3 * gauss(R)) : 0);
      lastQ = q;
    }
    const pj = presses.includes('jump');
    if (pj && lastJ) { sched('jumpUp', 0, decide()); sched('jumpDown', 0, H.retap ?? 0.07); }  // a leap: lift and tap again
    else if ((pj || want.jump) && !lastJ) sched('jumpDown', 0, decide());
    else if (!want.jump && lastJ) sched('jumpUp', 0, decide() * Math.exp(H.hold * gauss(R)));
    lastJ = want.jump || pj;
    if (presses.includes('grab')) sched('grab', 0, decide());
    presses = [];
    // what the thumbs deliver now
    queue.sort((a, b) => a.t - b.t);
    while (queue.length && queue[0].t <= now() + 1e-9) deliver(queue.shift());
    w.setInput(id, cur.x, cur.jump);
  };
  const hw = new Proxy(w, {
    get(target, k) {
      if (k === 'human') return { stats, H };
      if (k === 'setInput') return (i, x, jump) => { if (i !== id) return target.setInput(i, x, jump); want = { x: +x || 0, jump: !!jump }; };
      if (k === 'press') return (i, what) => { if (i !== id) return target.press(i, what); presses.push(what); };
      // the mind reads the GRAB label for the stick it is about to hold, as a person watches the button
      if (k === 'launch') return (pp) => {
        if (pp !== p) return target.launch(pp);
        const sx = p.in.x, sj = p.in.jump; p.in.x = want.x; p.in.jump = want.jump;
        try { return target.launch(pp); } finally { p.in.x = sx; p.in.jump = sj; }
      };
      if (k === 'step') return (dt) => { tick(); target.step(dt); frame++; };
      const v = target[k];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return hw;
}
