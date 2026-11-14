// Discriminator: pong (unicast) + toasts (small broadcast) vs state (big broadcast)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3463;

const proc = spawn(process.execPath, ['../server.js', '--mode=3d'], {
  cwd: __dirname, env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});
proc.stderr.on('data', d => console.error('SRV:', d.toString().slice(0, 300)));
await new Promise(r => setTimeout(r, 900));

const board = await new Promise((resolve, reject) => {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name: 'TV', board: true }));
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.type === 'joined') resolve(ws); };
  setTimeout(() => reject(new Error('board timeout')), 3000);
});

const puppet = await new Promise((resolve, reject) => {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
  const c = { ws, states: 0, toasts: 0, pongs: 0 };
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name: 'Solo', board: false }));
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.type === 'joined') resolve(c);
    else if (m.type === 'state') c.states++;
    else if (m.type === 'toast') c.toasts++;
    else if (m.type === 'pong') c.pongs++;
  };
  setTimeout(() => reject(new Error('puppet timeout')), 3000);
});

for (let i = 0; i < 10; i++) {
  puppet.ws.send(JSON.stringify({ type: 'ping', c0: Date.now() }));
  await new Promise(r => setTimeout(r, 300));
}
console.log('puppet counters:', JSON.stringify(puppet));

board.close(); puppet.ws.close();
proc.kill();
process.exit(0);