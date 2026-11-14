import { spawn } from 'node:child_process';
const PORT = 3411;
const proc = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore','pipe','pipe'] });
let log = '';
proc.stdout.on('data', d => { log += d.toString(); });
proc.stderr.on('data', d => { log += 'ERR ' + d.toString(); });
await new Promise(r => setTimeout(r, 700));

function client(name, emoji, board) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { name, ws, states: 0, last: null, wins: [], errors: [] };
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name, emoji, board: !!board }));
    ws.onerror = e => { c.errors.push(String(e)); };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'state') { c.states++; c.last = m; }
      if (m.type === 'win') c.wins.push(m.win);
      if (m.type === 'welcome') resolve(c);
    };
    setTimeout(() => reject(new Error('timeout ' + name)), 4000);
  });
}
const board = await client('TV', '📺', true);
const a = await client('Mia', '🦊', false);
const b = await client('Dad', '🐻', false);
const c = await client('Nana', '🐱', false);
console.log('joined:', board.last ? 'states flowing' : 'no state yet');
board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'start' }));
// everyone walk right the whole time
const drive = setInterval(() => {
  const m = JSON.stringify({ type: 'input', left: false, right: true, jump: false, grabL: false, grabR: false });
  a.ws.send(m); b.ws.send(m); c.ws.send(m);
}, 40);
const samples = [];
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const s = board.last;
  const core = s.bodies.find(x => x.kind === 'core');
  const plate = s.bodies.find(x => x.kind === 'plate');
  const gate = s.bodies.find(x => x.kind === 'gate');
  samples.push({ t: i + 1, phase: s.phase, coreX: Math.round(core.x), coreY: Math.round(core.y), plate: plate.pressed, gate: gate.open, players: s.players.length, p0x: Math.round(s.players[0].x), tools: s.toolsUsed });
  if (s.phase === 'won') break;
}
clearInterval(drive);
console.log(JSON.stringify(samples, null, 0));
console.log('WINS:', JSON.stringify(board.wins));
console.log('SERVER LOG:', log.slice(0, 1500));
proc.kill();
