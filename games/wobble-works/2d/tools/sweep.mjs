import { spawn } from 'node:child_process';
const PORT = 3416;
async function trial(density, nBots, seconds) {
  const proc = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT), CORE_DENSITY: String(density) }, stdio: ['ignore','pipe','pipe'] });
  proc.stderr.on('data', () => {});
  await new Promise(r => setTimeout(r, 450));
  const board = await new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const c = { ws, last: null, wins: [] };
    ws.onopen = () => ws.send(JSON.stringify({ type:'join', name:'TV', board:true }));
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.type==='state') c.last=m; if (m.type==='win') c.wins.push(m.win); if (m.type==='welcome') resolve(c); };
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
  for (let i=0;i<nBots;i++) board.ws.send(JSON.stringify({ type:'addBot' }));
  board.ws.send(JSON.stringify({ type:'start' }));
  await new Promise(r => setTimeout(r, 300));
  const x0 = board.last.bodies.find(b=>b.kind==='core').x;
  let won = null;
  for (let i=0;i<seconds;i++) {
    await new Promise(r => setTimeout(r, 1000));
    const s = board.last;
    if (s.phase === 'won') { won = i+1; break; }
  }
  const x1 = board.last.bodies.find(b=>b.kind==='core').x;
  console.log('density=' + density + ' bots=' + nBots + ' x0=' + Math.round(x0) + ' x1=' + Math.round(x1) + ' dx=' + Math.round(x1-x0) + ' speed=' + Math.round((x1-x0)/seconds) + 'px/s wonAt=' + won + ' medal=' + (board.wins[0] ? board.wins[0].win.medal.name : '-'));
  proc.kill();
  await new Promise(r => setTimeout(r, 250));
}
for (const d of [0.0026, 0.0018, 0.0013]) { await trial(d, 1, 8); await trial(d, 4, 8); }
