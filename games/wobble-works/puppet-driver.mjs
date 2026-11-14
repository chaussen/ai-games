// Puppet driver: 6 scripted wobblers with steering brains, run from Node so the
// board page never has to think. Usage: node puppet-driver.mjs <port>
const PORT = Number(process.argv[2] || 3000);
const targets = [
  ['Tower Tina', 20, -20],
  ['Bounce Bo', -25, -25],
  ['Fortress Fred', -17, 25],   // ramp base -> climbs the fortress route
  ['Sleepy Sal', 0, 32],
  ['Meadow Mia', 0, 38],
  ['Plaza Pat', 3, 3]
];

const puppets = [];
let joined = 0;

function connect(t) {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
  const st = { name: t[0], tx: t[1], tz: t[2], id: null, x: 0, z: 0, ws };
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', name: st.name, board: false }));
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.type === 'joined') { st.id = m.id; joined++; console.log('joined:', st.name); }
    if (m.type === 'state' && st.id) {
      const me = m.players.find(p => p.id === st.id);
      if (me) {
        st.x = me.x; st.z = me.z;
        const dx = st.tx - st.x, dz = st.tz - st.z;
        const d = Math.hypot(dx, dz);
        ws.send(JSON.stringify({ type: 'input', x: d > 0.7 ? dx / d : 0, z: d > 0.7 ? dz / d : 0 }));
      }
    }
  };
  ws.onclose = () => { console.log('closed:', st.name); };
  puppets.push(st);
}
targets.forEach(connect);

// Sleepy Sal dozes off (AFK statue) 20 s in — before the orbit shot
setTimeout(() => {
  const sal = puppets[3];
  if (sal.ws && sal.ws.readyState === 1) {
    sal.ws.send(JSON.stringify({ type: 'visibility', hidden: true }));
    console.log('AFK: Sleepy Sal is now a sleeping statue');
  }
}, 20000);

// Progress heartbeat
setInterval(() => {
  const line = puppets.map(p => {
    if (!p.id) return p.name.split(' ')[0] + ':joining';
    return p.name.split(' ')[0] + ':' + Math.hypot(p.tx - p.x, p.tz - p.z).toFixed(1) + 'm';
  }).join('  ');
  console.log('t=' + Math.round(process.uptime()) + 's  ' + line);
}, 5000);

setTimeout(() => process.exit(0), 150000);