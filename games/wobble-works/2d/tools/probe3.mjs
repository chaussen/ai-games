import { spawn } from 'node:child_process';
const PORT = 3413;
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
const R = JSON.stringify({ type:'input', left:false, right:true, jump:false, grabL:false, grabR:false });
async function trial(label, nControllers, nBots, seconds) {
  // fresh world: reset level, keep only the clients we want to drive
  const board = await client('TV' + label, true);
  const ctrls = [];
  for (let i = 0; i < nControllers; i++) ctrls.push(await client(label + i, false));
  for (let i = 0; i < nBots; i++) board.ws.send(JSON.stringify({ type: 'addBot' }));
  board.ws.send(JSON.stringify({ type: 'setLevel', id: 1 }));
  await new Promise(r => setTimeout(r, 350));
  board.ws.send(JSON.stringify({ type: 'start' }));
  const x0 = board.last.bodies.find(b => b.kind === 'core').x;
  const drive = setInterval(() => ctrls.forEach(c => c.ws.send(R)), 40);
  let won = null;
  for (let i = 0; i < seconds; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const s = board.last;
    const core = s.bodies.find(b => b.kind === 'core');
    if (i === 5 || i === seconds - 1 || s.phase === 'won') console.log(label + ' t=' + (i+1) + ' coreX=' + Math.round(core.x) + ' dx=' + Math.round(core.x - x0) + ' phase=' + s.phase);
    if (s.phase === 'won') { won = i + 1; break; }
  }
  clearInterval(drive);
  console.log(label + ': 6s delta=' + Math.round(board.last.bodies.find(b => b.kind === 'core').x - x0) + 'px wonAt=' + won + ' wins=' + JSON.stringify(board.wins));
  for (const c of ctrls) c.ws.close();
  board.ws.close();
  await new Promise(r => setTimeout(r, 200));
}
// NOTE: clients persist on server, so each trial inherits previous participants; report cumulative players
await trial('SOLO-1', 1, 0, 8);
await trial('TEAM-3', 3, 0, 8);
await trial('TEAM-4+2BOT', 4, 2, 30);
proc.kill();
