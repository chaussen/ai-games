import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 3415;
try { fs.unlinkSync('.wobble-save.json'); } catch (e) {}
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
const ctrls = [await client('Mia',false), await client('Dad',false), await client('Nana',false)];
board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'addBot' }));
board.ws.send(JSON.stringify({ type: 'start' }));
const drive = setInterval(() => {
  const s = board.last; if (!s) return;
  const core = s.bodies.find(b => b.kind === 'core'); if (!core) return;
  ctrls.forEach((c) => {
    const me = s.players.find(p => p.name === c.name); if (!me) return;
    const ahead = me.x > core.x + 25;
    const right = ahead ? true : me.x < core.x - 20;
    c.ws.send(JSON.stringify({ type:'input', left:false, right, jump:false, grabL:false, grabR:false }));
  });
}, 45);
let won = null;
for (let i = 0; i < 28; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const s = board.last, core = s.bodies.find(b => b.kind === 'core');
  if (i % 3 === 0 || s.phase === 'won') console.log('t=' + (i+1) + ' coreX=' + Math.round(core.x) + ' plate=' + s.bodies.find(b=>b.kind==='plate').pressed + ' gate=' + s.bodies.find(b=>b.kind==='gate').open + ' phase=' + s.phase);
  if (s.phase === 'won') { won = i+1; break; }
}
clearInterval(drive);
console.log('WON AT t=' + won);
console.log('WIN:', JSON.stringify(board.wins));
console.log('SAVE:', fs.existsSync('.wobble-save.json') ? fs.readFileSync('.wobble-save.json','utf8') : 'NONE');
proc.kill();
