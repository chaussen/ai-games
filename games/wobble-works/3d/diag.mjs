// 6-puppet replica of the browser capture scenario
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3462;

const proc = spawn(process.execPath, ['../server.js', '--mode=3d'], {
  cwd: __dirname, env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});
proc.stderr.on('data', d => console.error(d.toString()));
await new Promise(r => setTimeout(r, 900));

function client(name, isBoard) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { name, ws, id: null, snap: null, fx: [], msgs: 0 };
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name, board: !!isBoard }));
    ws.onclose = () => { c.closed = true; };
    ws.onerror = (e) => { c.err = String(e && e.message || e); };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'joined') { c.id = m.id; resolve(c); }
      else if (m.type === 'state') { c.snap = m; c.msgs++; }
      else if (m.type === 'fx') c.fx.push(m.event);
    };
    setTimeout(() => reject(new Error('timeout ' + name)), 3000);
  });
}

const board = await client('TV', true);
const targets = [
  ['Tower Tina', 20, -20], ['Bounce Bo', -25, -25], ['Fortress Fred', -22, 22],
  ['Sleepy Sal', 0, 32], ['Meadow Mia', 0, 38], ['Plaza Pat', 3, 3]
];
const puppets = [];
for (const t of targets) {
  const p = await client(t[0], false);
  p.tx = t[1]; p.tz = t[2];
  puppets.push(p);
}

const steerIv = setInterval(() => {
  for (const p of puppets) {
    const me = p.snap && p.snap.players.find(q => q.id === p.id);
    if (!me) continue;
    const dx = p.tx - me.x, dz = p.tz - me.z;
    const d = Math.hypot(dx, dz);
    p.ws.send(JSON.stringify({ type: 'input', x: d > 0.7 ? dx / d : 0, z: d > 0.7 ? dz / d : 0 }));
  }
}, 50);

for (let s = 1; s <= 4; s++) {
  await new Promise(r => setTimeout(r, 5000));
  const dists = puppets.map(p => {
    if (!p.snap) return p.name.split(' ')[0] + ':NO-SNAP(msgs=' + p.msgs + ' closed=' + !!p.closed + ' err=' + (p.err || '-') + ')';
    const me = p.snap.players.find(q => q.id === p.id);
    if (!me) return p.name.split(' ')[0] + ':NOT-IN-SNAPSHOT';
    const d = Math.hypot(p.tx - me.x, p.tz - me.z);
    return p.name.split(' ')[0] + ':' + d.toFixed(1) + 'm(y' + me.y.toFixed(1) + ')';
  });
  console.log('t=' + (s * 5) + 's  ' + dists.join('  '));
}
clearInterval(steerIv);

// then bot scores
for (let i = 0; i < 4; i++) board.ws.send(JSON.stringify({ type: 'nextGoal' }));
board.ws.send(JSON.stringify({ type: 'addBot' }));
const tB = Date.now();
let scored = false;
while (Date.now() - tB < 40000) {
  await new Promise(r => setTimeout(r, 500));
  if (board.fx.some(e => e.type === 'goalScored')) { scored = true; break; }
}
console.log('BOT SCORED MEADOW:', scored, '(' + ((Date.now() - tB) / 1000).toFixed(1) + 's)');
const ev = board.fx.find(e => e.type === 'goalScored');
if (ev) console.log('scorer:', ev.scorer, '| assist:', ev.assist || 'none', '| next goal:', board.snap.goal.name);

puppets.forEach(p => p.ws.close()); board.ws.close();
proc.kill();
process.exit(0);