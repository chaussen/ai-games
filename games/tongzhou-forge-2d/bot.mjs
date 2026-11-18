// A scripted player for the tests: a list of steps, each run every frame until it says it is done.
// Steps only press what a person could press (stick x, JUMP held or not, GRAB); they never move
// bodies by hand. Used by sim-test.mjs to prove every isle can be won.
export const DT = 1 / 60;

export function run(w, id, steps, opt = {}) {
  const p = w.players.get(id), log = [];
  const all = [];
  let i = 0, t = 0, frames = 0, cursor = 0;
  // event steps consume events in order, so a second forge is not the first one again
  const take = (t) => { for (let j = cursor; j < all.length; j++) if (all[j].t === t) { cursor = j + 1; return all[j]; } return null; };
  const max = opt.max || 60 * 240;
  while (i < steps.length && frames < max) {
    const s = steps[i];
    const ctx = { w, p, t, ev: all, take };
    const r = s.fn(ctx);
    w.setInput(id, r && r.x || 0, !!(r && r.jump));
    if (r && r.press) for (const what of [].concat(r.press)) w.press(id, what);
    w.step(DT);
    const evs = w.drain();
    all.push(...evs);
    t += DT; frames++;
    if (r && r.done) { log.push(s.name + ' @' + t.toFixed(2)); i++; t = 0; continue; }
    if (t > (s.timeout || 8)) return { ok: false, at: s.name, log, p: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), hold: p.hold && p.hold.ch }, ev: all };
  }
  return { ok: i >= steps.length, log, ev: all, at: i < steps.length ? steps[i].name : null };
}

const toward = (p, x, slow = 0.6) => { const d = x - p.x; return Math.abs(d) < 0.05 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d) / slow + 0.15); };

export const S = {
  walk: (x, tol = 0.1) => ({ name: 'walk ' + x, fn: ({ p }) => ({ x: toward(p, x), done: Math.abs(p.x - x) < tol && p.grounded }) }),
  // run toward x at full speed (no slowing down), done when past it
  dash: (x) => ({ name: 'dash ' + x, fn: ({ p }) => ({ x: Math.sign(x - p.x) || 1, done: false }) }),
  face: (dir) => { let n = 0; return { name: 'face ' + dir, fn: () => ({ x: n++ < 2 ? dir * 0.25 : 0, done: n > 3 }) }; },
  grab: () => { let n = 0; return { name: 'grab', fn: () => ({ press: n++ === 0 ? 'grab' : [], done: n > 1 }) }; },
  // GRAB and check what the button said it would do
  grabAs: (mode, x = 0) => { let n = 0; return { name: 'grab as ' + mode, fn: ({ w, p }) => {
    if (n++ === 0) {
      w.setInput(p.id, x, false);
      const l = w.launch(p);
      if (l.mode !== mode) throw new Error('GRAB would ' + l.mode + ', wanted ' + mode + ' at x=' + p.x.toFixed(2) + ' y=' + p.y.toFixed(2));
      return { x, press: 'grab' };
    }
    return { x, done: true };
  } }; },
  // walk up to the stone `ch` on the side you are on (without pushing it), face it and pick it up
  take: (ch) => {
    let st = 0, n = 0;
    return { name: 'take ' + ch, timeout: 10, fn: ({ w, p }) => {
      const k = w.stones.filter(s => s.ch === ch && s.state === 'loose').sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (!k) return {};
      const side = Math.sign(p.x - k.x) || 1, x = k.x + side * 0.85;
      if (st === 0) { if (Math.abs(p.x - x) < 0.08 && p.grounded) st = 1; return { x: toward(p, x, 0.4) }; }
      if (st === 1) { if (n++ < 2) return { x: -side * 0.2 }; st = 2; return {}; }
      w.setInput(p.id, 0, false);
      const l = w.launch(p);
      if (l.mode !== 'grab' || l.k !== k) throw new Error('take ' + ch + ': GRAB would ' + l.mode + ' at x=' + p.x.toFixed(2));
      return { press: 'grab', done: true };
    } };
  },
  wait: (secs) => ({ name: 'wait ' + secs, fn: ({ t }) => ({ done: t >= secs }) }),
  until: (name, cond, x = 0, timeout = 8) => ({ name, timeout, fn: (c) => ({ x: typeof x === 'function' ? x(c) : x, done: cond(c) }) }),
  event: (t, timeout = 8) => ({ name: 'event ' + t, timeout, fn: ({ take }) => ({ done: !!take(t) }) }),
  // jump moving in dir; leap at the given rise speed (vy below it, going up or down) up to n times;
  // keep moving until landed. Optional `stopAt` x: let go of the stick once past it.
  hop: (dir, opt = {}) => {
    let stage = 0, leaps = 0, frames = 0, pressed = false;
    const leapAt = opt.leapAt === undefined ? 1.5 : opt.leapAt, n = opt.leaps || 0;
    return { name: 'hop ' + dir + ' x' + n + (opt.grabAs ? ' grab as ' + opt.grabAs : ''), timeout: opt.timeout || 6, fn: ({ w, p }) => {
      frames++;
      let x = dir;
      if (opt.stopAt !== undefined && (p.x - opt.stopAt) * dir > 0) x = 0;
      if (opt.steer) x = opt.steer(p, x);
      if (stage === 0) { stage = 1; return { x, jump: true, press: 'jump' }; }
      if (stage === 1 && frames > 2 && p.grounded) {
        if (opt.grabAs && !pressed) throw new Error('hop: GRAB never offered ' + opt.grabAs + ' in the air (x=' + p.x.toFixed(2) + ')');
        return { x: 0, done: true };
      }
      // GRAB in mid-air once the button offers the wanted mode (ON TOP above a stone)
      if (opt.grabAs && !pressed && !p.grounded) { w.setInput(p.id, x, true); if (w.launch(p).mode === opt.grabAs) { pressed = true; return { x, jump: true, press: 'grab' }; } }
      if (leaps < n && !p.grounded && p.vy < leapAt && p.qi > 0) { leaps++; return { x, jump: true, press: 'jump' }; }
      return { x, jump: true };
    } };
  },
};
