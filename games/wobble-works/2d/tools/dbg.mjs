import { spawn } from 'node:child_process';
const PORT = 3417;
const proc = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore','pipe','pipe'] });
proc.stderr.on('data', d => process.stderr.write('ERR:' + d.toString()));
await new Promise(r => setTimeout(r, 500));
const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
let last = null;
ws.onopen = () => ws.send(JSON.stringify({ type:'join', name:'TV', board:true }));
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.type==='state') last=m; };
await new Promise(r => setTimeout(r, 350));
for (let i=0;i<4;i++) ws.send(JSON.stringify({ type:'addBot' }));
ws.send(JSON.stringify({ type:'start' }));
for (let i=0;i<8;i++) {
  await new Promise(r => setTimeout(r, 1000));
  const core = last.bodies.find(b=>b.kind==='core');
  console.log('t=' + (i+1) + ' core=' + Math.round(core.x) + ',' + Math.round(core.y) + ' players=' + JSON.stringify(last.players.map(p => ({n:p.name, x:Math.round(p.x), y:Math.round(p.y), vx:p.vx, bot:p.bot, grab:p.grab}))));
}
proc.kill();
