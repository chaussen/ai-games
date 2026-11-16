// A wobbler driven over the real WebSocket protocol. Shared by smoke-test.mjs and
// the screenshot puppets, so tests and captures play the game the way a phone does.
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function connect(port, opts = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const c = { ws, joined: null, snap: null, roster: [], events: [], calls: [], snaps: 0 };
    ws.onopen = () => ws.send(JSON.stringify(opts.board ? { type: 'join', board: true } : { type: 'join', name: opts.name, playerId: opts.playerId }));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'joined') { c.joined = m; resolve(c); }
      else if (m.type === 's') { c.snap = m; c.snaps++; if (m.e) c.events.push(...m.e); }
      else if (m.type === 'roster') c.roster = m.players;
      else if (m.type === 'call') c.calls.push(m);
    };
    ws.onerror = () => reject(new Error('socket error'));
    setTimeout(() => reject(new Error('join timeout')), 4000);
    c.send = m => ws.send(JSON.stringify(m));
    c.close = () => ws.close();
  });
}

export class Bot {
  constructor(c) { this.c = c; this.id = c.joined.id; }
  get me() { return this.c.snap && this.c.snap.p.find(p => p[0] === this.id); }
  get pos() { const m = this.me; return { x: m[1], y: m[2], z: m[3], grounded: !!(m[5] & 2), carrying: !!(m[5] & 1) }; }
  input(x, z) { this.c.send({ type: 'input', x, z }); }
  stop() { this.input(0, 0); }
  act(a) { this.c.send({ type: 'act', a }); }
  async go(x, z, timeout = 9000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const p = this.pos, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.14) { this.stop(); await sleep(90); return; }
      const m = Math.max(0.35, Math.min(1, d / 0.5));
      this.input(dx / d * m, dz / d * m);
      await sleep(30);
    }
    this.stop();
    const p = this.pos;
    throw new Error(`bot could not reach ${x},${z} (at ${p.x},${p.y},${p.z})`);
  }
  async hop(x, z) { this.act('jump'); await this.go(x, z, 4000); }
  async grab() { this.act('grab'); await sleep(120); }
  async hold(x, z, until, timeout = 8000) {
    const end = Date.now() + timeout;
    this.input(x, z);
    while (Date.now() < end) { if (until()) { this.stop(); await sleep(80); return; } await sleep(25); }
    this.stop();
    throw new Error('bot hold timed out');
  }
  async toss(x, z) { this.input(x, z); await sleep(110); this.act('grab'); await sleep(40); this.stop(); await sleep(800); }
  async leap(x, z, edge, landed) {
    await this.hold(x, z, edge, 5000);
    this.input(x, z); this.act('jump');
    await this.hold(x, z, () => landed() && this.pos.grounded, 3000);
  }
}
