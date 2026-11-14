import { spawn } from 'node:child_process';
const PORT = 3412;
const proc = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore','pipe','pipe'] });
proc.stderr.on('data', d => process.stderr.write(d));
await new Promise(r => setTimeout(r, 600));
async function client(name, board) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { name, ws, last: null, wins: [] };
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name, emoji: '🙂', board }));
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.type === 'state') c.last = m; if (m.type === 'win') c.wins.push(m.win); if (m.type === 'welcome') resolve(c); };
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
}
const board = await client('TV', true);
const list = [];
for (const n of ['A','B','C','D']) list.push(await client(n, false));
board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'start' }));
const drive = setInterval(() => { const m = JSON.stringify({ type:'input', left:false, right:true, jump:false, grabL:false, grabR:false }); list.forEach(c => c.ws.send(m)); }, 40);
let wonAt = null, firstPlate = null, gateAt = null;
for (let i = 0; i < 34; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const s = board.last;
  const core = s.bodies.find(x => x.kind === 'core');
  const plate = s.bodies.find(x => x.kind === 'plate');
  const gate = s.bodies.find(x => x.kind === 'gate');
  if (plate.pressed && firstPlate === null) firstPlate = { t: i+1, x: Math.round(core.x) };
  if (gate.open && gateAt === null) gateAt = i+1;
  if (i % 4 === 0 || i > 25) console.log('t=' + (i+1) + ' coreX=' + Math.round(core.x) + ' plate=' + plate.pressed + ' gate=' + gate.open + ' phase=' + s.phase);
  if (s.phase === 'won') { wonAt = i+1; break; }
}
clearInterval(drive);
console.log('RESULT firstPlate=' + JSON.stringify(firstPlate) + ' gateAt=' + gateAt + ' wonAt=' + wonAt + ' wins=' + JSON.stringify(board.wins));
// single pusher comparison
const single = await client('Solo', false);
board.ws.send(JSON.stringify({ type: 'setLevel', id: 1 }));
await new Promise(r => setTimeout(r, 400));
board.ws.send(JSON.stringify({ type: 'start' }));
const s0 = board.last.bodies.find(x => x.kind === 'core').x;
const soloDrive = setInterval(() => single.ws.send(JSON.stringify({ type:'input', left:false, right:true, jump:false, grabL:false, grabR:false })), 40);
await new Promise(r => setTimeout(r, 6000));
clearInterval(soloDrive);
const s1 = board.last.bodies.find(x => x.kind === 'core').x;
console.log('SOLO 6s core displacement =', Math.round(s1 - s0), 'px');
proc.kill();
