import { spawn } from 'node:child_process';
const PORT = 3418;
const proc = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore','pipe','pipe'] });
proc.stderr.on('data', () => {});
await new Promise(r => setTimeout(r, 500));
async function cl(name, board) {
  return new Promise((res, rej) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { ws, last: null, wins: [] };
    ws.onopen = () => ws.send(JSON.stringify({type:'join', name, board}));
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.type==='state') c.last=m; if (m.type==='win') c.wins.push(m.win); if (m.type==='welcome') res(c); };
    setTimeout(() => rej(new Error('timeout')), 3000);
  });
}
const board = await cl('TV', true);
for (let i=0;i<4;i++) board.ws.send(JSON.stringify({type:'addBot'}));
board.ws.send(JSON.stringify({type:'start'}));
let won = null;
for (let i=0;i<22;i++) {
  await new Promise(r => setTimeout(r, 1000));
  const s = board.last, core = s.bodies.find(b=>b.kind==='core');
  if (i%2===0 || s.phase==='won') console.log('t=' + (i+1) + ' coreX=' + Math.round(core.x) + ' push=' + s.pushCount + ' grounded=' + s.coreGrounded + ' bots=' + JSON.stringify(s.players.filter(p=>p.bot).map(p=>Math.round(p.x)+'/'+Math.round(p.y))) + ' phase=' + s.phase);
  if (s.phase==='won') { won = i+1; break; }
}
console.log('WON=' + won + ' WIN=' + JSON.stringify(board.wins));
proc.kill();
