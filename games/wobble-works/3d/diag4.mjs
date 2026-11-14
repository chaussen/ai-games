// Instrumented scoring investigation: who gets points, and why?
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3464;

const proc = spawn(process.execPath, ['../server.js', '--mode=3d'], {
  cwd: __dirname, env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});
proc.stderr.on('data', d => console.error('SRV:', d.toString().slice(0, 400)));
await new Promise(r => setTimeout(r, 900));

function client(name, isBoard) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { name, ws, id: null, snap: null, fx: [], msgs: 0 };
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name, board: !!isBoard }));
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
const targets = [['Tower Tina',20,-20],['Bounce Bo',-25,-25],['Fortress Fred',-17,25],['Sleepy Sal',0,32],['Meadow Mia',0,38],['Plaza Pat',3,3]];
const pups = [];
for (const t of targets) {
  const p = await client(t[0], false);
  p.tx = t[1]; p.tz = t[2];
  pups.push(p);
}

setInterval(() => {
  for (const p of pups) {
    if (!p.snap) continue;
    const me = p.snap.players.find(q => q.id === p.id);
    if (!me) continue;
    const dx = p.tx - me.x, dz = p.tz - me.z, d = Math.hypot(dx, dz);
    p.ws.send(JSON.stringify({ type: 'input', x: d > 0.7 ? dx/d : 0, z: d > 0.7 ? dz/d : 0 }));
  }
}, 50);

await new Promise(r => setTimeout(r, 14000));
for (let i = 0; i < 4; i++) board.ws.send(JSON.stringify({ type: 'nextGoal' }));
board.ws.send(JSON.stringify({ type: 'addBot' }));

const seen = new Set();
for (let t = 0; t < 60; t++) {
  await new Promise(r => setTimeout(r, 1000));
  for (const e of board.fx) {
    if (e.type === 'tackle' && !seen.has(e.id)) {
      seen.add(e.id);
      console.log('  TACKLE t=' + t + 's ' + e.tackler + ' -> ' + e.victim);
    }
    if (e.type !== 'goalScored' || seen.has(e.id)) continue;
    seen.add(e.id);
    console.log('SCORE t=' + t + 's scorer=' + e.scorer + '(' + (e.scorerId||'?') + ') assist=' + (e.assist||'-') +
      ' goal=' + e.goalName + ' ballAt=' + e.x.toFixed(1) + ',' + e.y.toFixed(1) + ',' + e.z.toFixed(1));
  }
  if (t % 6 === 0 && board.snap) {
    const rows = board.snap.players.map(p => p.name + ':' + p.score + (p.carrying?'[CARRY]':'') +
      '(' + p.x.toFixed(0) + ',' + p.z.toFixed(0) + ')').join(' ');
    console.log('  t=' + t + 's ' + rows);
  }
}

pups.forEach(p => p.ws.close()); board.ws.close();
proc.kill();
process.exit(0);