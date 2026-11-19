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

// What a person sees ahead while walking toward x: the top of the ground or wall in the next column,
// counting walls of thorns, flames and shade as rock (you jump them or wait for the right stone).
const topAt = (w, x, below) => { const cx = Math.floor(x); for (let cy = Math.min(w.h - 1, Math.floor(below) - 1); cy >= 0; cy--) if (w.solid(cx, cy)) return cy + 1; return 0; };
const colTop = (w, x, from) => { const cx = Math.floor(x); let y = Math.floor(from + 0.01); if (!w.solid(cx, y)) return null; while (w.solid(cx, y + 1)) y++; return y + 1; };
const stoneAhead = (w, p, dir) => w.stones.find(s => s.state === 'loose' && s.grounded && (s.x - p.x) * dir > 0 && (s.x - p.x) * dir < 1.0 && s.y < p.y + 0.9 && s.y + 0.9 > p.y + 0.05);

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
  // (near: pick the `ch` nearest that x instead of nearest you; far away, walk there like S.go)
  take: (ch, near) => {
    let st = 0, n = 0, nav = null, navX = null;
    return { name: 'take ' + ch, timeout: 14, fn: (c) => {
      const { w, p } = c;
      const from = near === undefined ? p.x : near;
      const k = w.stones.filter(s => s.ch === ch && s.state === 'loose').sort((a, b) => Math.abs(a.x - from) - Math.abs(b.x - from))[0];
      if (!k) return {};
      const side = Math.sign(p.x - k.x) || 1, x = k.x + side * 0.85;
      if (st === 0 && (Math.abs(p.x - x) > 1.0 || !p.grounded || Math.abs(p.y - k.y) > 0.3)) {
        const gx = k.x + side * 1.4;
        if (!nav || Math.abs(navX - gx) > 0.3) { nav = S.go(gx, { land: k.y, tol: 0.4 }); navX = gx; }
        const r = nav.fn(c);
        if (!r.done) return r;
        nav = null;
      }
      if (st === 0) { if (Math.abs(p.x - x) < 0.08 && p.grounded) st = 1; return { x: toward(p, x, 0.4) }; }
      if (st === 1) { if (n++ < 2) return { x: -side * 0.2 }; st = 2; return {}; }
      w.setInput(p.id, 0, false);
      const l = w.launch(p);
      if (l.mode !== 'grab' || l.k !== k) throw new Error('take ' + ch + ': GRAB would ' + l.mode + ' at x=' + p.x.toFixed(2));
      return { press: 'grab', done: true };
    } };
  },
  // Walk to x like a person would: jump a step, a wall, a stone or a gap in the way; leap (轻功) when
  // a jump will not do (a tall wall ahead, or falling toward water); press into walls to climb them.
  // `land` (optional): the height you mean to end at (stops on a tower top rather than below it).
  go: (tx, opt = {}) => {
    let jumped = 0, air = 0;
    return { name: 'go ' + tx, timeout: opt.timeout || 14, fn: ({ w, p }) => {
      const d = tx - p.x, dir = Math.sign(d) || 1, tol = opt.tol || 0.12;
      if (Math.abs(d) < tol && p.grounded && (opt.land === undefined || p.y > opt.land - 0.3)) return { x: 0, done: true };
      let x = Math.abs(d) < tol ? 0 : Math.abs(d) < 0.5 ? toward(p, tx, 0.4) : dir;
      if (p.grounded) {
        air = 0;
        if (jumped > 0) jumped--;
        if (Math.abs(d) < 0.6) return { x };
        const ahead = p.x + dir * 0.62, wallTop = colTop(w, ahead, p.y), far = colTop(w, p.x + dir * 1.9, p.y);
        // a wall two or more high: take off earlier, so the leap clears it before you reach it
        const tall = far !== null && far - p.y > 1.4 && Math.abs(d) > 2.0;
        const ground = topAt(w, p.x + dir * 0.55, p.y + 0.5);
        const block = wallTop !== null && wallTop > p.y + 0.05 && wallTop - p.y > (w.as.nudge || 0) + 0.02;
        const stone = stoneAhead(w, p, dir) && !opt.push;
        const drop = ground < p.y - 0.05 && ground <= 1.05;            // water (or the river bed) ahead
        const want = opt.land !== undefined && opt.land > p.y + 0.3 && Math.abs(d) < 2.2;
        if ((block || tall || stone || drop || want) && jumped === 0) { jumped = 4; return { x, jump: true, press: 'jump' }; }
        return { x };
      }
      air++;
      // in the air: keep holding JUMP while rising; leap when it would not otherwise make it
      const wallTop = Math.max(colTop(w, p.x + dir * 0.45, p.y + 0.1) || -1, colTop(w, p.x + dir * 1.1, p.y + 0.1) || -1);
      const under = topAt(w, p.x, p.y + 0.1), next = topAt(w, p.x + dir * 1.6, p.y + 3);
      const wallHigh = wallTop > p.y + 0.3;
      const overWater = under <= 1.05 && next < p.y - 0.4 ? true : under <= 1.05 && p.y < 2.6;
      const short = opt.land !== undefined && p.y < opt.land + 0.2 && Math.abs(d) < 1.5;
      const leapAt = opt.leapAt === undefined ? 0.6 : opt.leapAt;
      if (p.qi > 0 && air > 3 && ((wallHigh && p.vy < 3) || ((overWater || short) && p.vy < leapAt))) return { x, jump: true, press: 'jump' };
      return { x, jump: p.vy > 0 };
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
