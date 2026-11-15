// WOBBLE WORKS - level data. Pure geometry; server.js turns this into Matter.js bodies.
// Coordinate system: +x right, +y down. Ground top is usually y = 760.

const G = 760; // ground top

const LEVELS = [
  {
    id: 1, key: 'door', tier: 'SCRIPTED', name: 'THE DOOR', cn: '第一课 · 门',
    subtitle: 'One heavy thing. One button. One door.',
    brief: 'The Glow Core is far too heavy for one wobbler. Roll it onto the pressure plate to open the gate, then get it over the wall: one of you climbs up, grabs it and hauls, the others heave from below.',
    width: 1500, height: 820, ground: G, toolBudget: 4,
    spawn: [[80,737],[130,737],[180,737],[230,737],[280,737],[330,737],[380,737],[430,737]],
    core: { x: 470, y: G - 34 },
    goal: { x: 1340, y: G - 60, r: 62, label: 'BEACON' },
    hints: [
      'Everyone get behind the Core and push at the same time.',
      'The plate stays down only while something heavy sits on it.',
      'The wall is low enough to jump onto. Grab the Core and hold JUMP to heave it up; walk away to pull it along.',
      'Two heavers beat one: one hauls from the top, one lifts from below.'
    ],
    statics: [
      { kind: 'ground', x: 750, y: G + 40, w: 1500, h: 80 },
      { kind: 'wall', x: -20, y: 410, w: 40, h: 820 },
      { kind: 'wall', x: 1520, y: 410, w: 40, h: 820 },
      { kind: 'ledge', x: 300, y: 560, w: 190, h: 22 },
      { kind: 'sign', x: 470, y: 600, w: 12, h: 70 },
      { kind: 'wall', x: 1160, y: G - 50, w: 160, h: 100 }
    ],
    // One Core, one plate, one gate, one low wall, one beacon.
    // No loose props - tools come from the dispenser.
    dynamics: [],
    plates: [{ id: 'p1', x: 720, y: G - 8, w: 180, h: 16, gate: 'g1' }],
    gates: [{ id: 'g1', x: 940, y: 600, w: 28, h: 320 }],
    water: [], wind: [], ropes: [], seesaws: [],
    checkpoints: [{ x: 470, y: G - 34 }]
  },
  {
    id: 2, key: 'seesaw', tier: 'SEMI-SCRIPTED', name: 'THE SEE-SAW', cn: '第二课 · 跷跷板',
    subtitle: 'Two hands, one plank, a very surprised Core.',
    brief: 'The beacon is up on the high deck. Put a crate on the plate to hold the ramp gate open, then lift the Core: carry it with a friend, lever it with the see-saw, or build a ramp from planks.',
    width: 1800, height: 860, ground: G, toolBudget: 6,
    spawn: [[70,737],[120,737],[170,737],[220,737],[270,737],[320,737],[370,737],[420,737]],
    core: { x: 300, y: G - 34 },
    goal: { x: 1620, y: 470, r: 62, label: 'HIGH BEACON' },
    hints: [
      'A plank is light when one wobbler carries it, but steady when two hold the ends.',
      'Drop a barrel on the high end of the see-saw while the Core sits on the low end.',
      'Hold a grab button to hang; press JUMP while hanging to climb up.'
    ],
    statics: [
      { kind: 'ground', x: 900, y: G + 40, w: 1800, h: 80 },
      { kind: 'wall', x: -20, y: 430, w: 40, h: 860 },
      { kind: 'wall', x: 1820, y: 430, w: 40, h: 860 },
      { kind: 'deck', x: 1450, y: 520, w: 700, h: 36 },
      { kind: 'ledge', x: 700, y: 590, w: 200, h: 22 },
      { kind: 'ledge', x: 1050, y: 430, w: 160, h: 20 }
    ],
    dynamics: [
      { kind: 'crate', x: 520, y: G - 32, w: 64, h: 64 },
      { kind: 'crate', x: 590, y: G - 32, w: 64, h: 64 },
      { kind: 'plank', x: 820, y: G - 8, w: 220, h: 16 },
      { kind: 'plank', x: 1080, y: G - 8, w: 220, h: 16 },
      { kind: 'barrel', x: 1290, y: G - 26, r: 26 }
    ],
    plates: [{ id: 'p1', x: 640, y: G - 8, w: 170, h: 16, gate: 'g1', latched: false }],
    gates: [{ id: 'g1', x: 960, y: 600, w: 28, h: 320 }],
    seesaws: [{ x: 1160, y: G - 26, w: 240, h: 16 }],
    water: [{ x: 900, y: 880, w: 420, h: 200 }],
    wind: [], ropes: [{ x: 1050, y: 400, segments: 8, length: 20 }],
    checkpoints: [{ x: 300, y: G - 34 }, { x: 1120, y: G - 34 }]
  },
  {
    id: 3, key: 'gap', tier: 'SEMI-OPEN', name: 'THE GAP', cn: '第三课 · 深沟',
    subtitle: 'Four good answers. None of them are marked.',
    brief: 'A chasm splits the workshop. Bridge it with planks, swing across on the rope, catapult the Core with the see-saw and a barrel, ride the wind, or link hands and make a human chain. Whatever works.',
    width: 2000, height: 900, ground: G, toolBudget: 10,
    spawn: [[70,737],[120,737],[170,737],[220,737],[270,737],[320,737],[370,737],[420,737]],
    core: { x: 380, y: G - 34 },
    goal: { x: 1800, y: G - 60, r: 66, label: 'BEACON' },
    hints: [
      'Two planks laid end to end make a bridge; two wobblers holding one plank make a steadier one.',
      'Grab the rope with one hand and JUMP to swing; let go at the top of the arc.',
      'The wind zone pushes everything to the right - including the Core.'
    ],
    statics: [
      { kind: 'ground', x: 300, y: G + 40, w: 600, h: 80 },
      { kind: 'ground', x: 1500, y: G + 40, w: 1000, h: 80 },
      { kind: 'wall', x: -20, y: 450, w: 40, h: 900 },
      { kind: 'wall', x: 2020, y: 450, w: 40, h: 900 },
      { kind: 'ledge', x: 800, y: 620, w: 120, h: 22 },
      { kind: 'ledge', x: 1000, y: 500, w: 120, h: 22 },
      { kind: 'ledge', x: 640, y: 500, w: 120, h: 22 },
      { kind: 'sign', x: 560, y: 640, w: 12, h: 70 }
    ],
    dynamics: [
      { kind: 'plank', x: 300, y: G - 8, w: 220, h: 16 },
      { kind: 'plank', x: 500, y: G - 8, w: 220, h: 16 },
      { kind: 'barrel', x: 560, y: G - 26, r: 26 },
      { kind: 'crate', x: 180, y: G - 32, w: 64, h: 64 }
    ],
    plates: [], gates: [],
    seesaws: [{ x: 520, y: G - 22, w: 200, h: 16 }],
    water: [{ x: 990, y: 900, w: 800, h: 200 }],
    wind: [{ x: 800, y: 520, w: 420, h: 260, fx: 0.00016, fy: 0 }],
    ropes: [{ x: 900, y: 280, segments: 13, length: 20 }],
    checkpoints: [{ x: 380, y: G - 34 }, { x: 1400, y: G - 34 }]
  },
  {
    id: 4, key: 'island', tier: 'OPEN', name: 'BELL ISLAND', cn: '第四课 · 灯塔岛',
    subtitle: 'One island, one bell, no instructions.',
    brief: 'The whole island is open from the first second. Split up, scout, build, throw things, throw each other. Get the Core to the summit beacon by any route you can invent. The tool dispenser is shared - decide together.',
    width: 2500, height: 1000, ground: G, toolBudget: 16,
    spawn: [[80,737],[130,737],[180,737],[230,737],[280,737],[330,737],[380,737],[430,737]],
    core: { x: 320, y: G - 34 },
    goal: { x: 2300, y: 240, r: 78, label: 'SUMMIT BELL' },
    hints: [
      'There is no order. Send two scouts ahead while the others move the Core.',
      'Anything you grab can become a tool - including another wobbler.',
      'Falling only costs you a poof. Try the ridiculous idea first.'
    ],
    statics: [
      { kind: 'ground', x: 350, y: G + 40, w: 700, h: 80 },
      { kind: 'ground', x: 1400, y: 660, w: 600, h: 60 },
      { kind: 'ground', x: 2200, y: 320, w: 600, h: 60 },
      { kind: 'wall', x: -20, y: 500, w: 40, h: 1000 },
      { kind: 'wall', x: 2520, y: 500, w: 40, h: 1000 },
      { kind: 'ledge', x: 800, y: 560, w: 160, h: 22 },
      { kind: 'ledge', x: 1150, y: 470, w: 160, h: 22 },
      { kind: 'ledge', x: 1700, y: 460, w: 160, h: 22 },
      { kind: 'ledge', x: 2000, y: 380, w: 160, h: 22 },
      { kind: 'ledge', x: 2150, y: 300, w: 140, h: 22 },
      { kind: 'slope', x: 1900, y: 560, w: 340, h: 24, angle: -0.62 },
      { kind: 'sign', x: 520, y: 630, w: 12, h: 70 }
    ],
    dynamics: [
      { kind: 'crate', x: 560, y: G - 32, w: 64, h: 64 },
      { kind: 'crate', x: 630, y: G - 32, w: 64, h: 64 },
      { kind: 'plank', x: 730, y: G - 8, w: 240, h: 16 },
      { kind: 'plank', x: 980, y: G - 8, w: 240, h: 16 },
      { kind: 'barrel', x: 1500, y: 600, r: 26 },
      { kind: 'barrel', x: 1560, y: 600, r: 26 },
      { kind: 'crate', x: 2050, y: 250, w: 64, h: 64 }
    ],
    plates: [], gates: [],
    seesaws: [{ x: 1250, y: 620, w: 240, h: 16 }],
    water: [{ x: 1000, y: 920, w: 500, h: 160 }, { x: 1800, y: 920, w: 300, h: 160 }],
    wind: [{ x: 1750, y: 300, w: 260, h: 420, fx: 0.00012, fy: -0.00006 }],
    ropes: [{ x: 900, y: 260, segments: 12, length: 20 }, { x: 1750, y: 200, segments: 11, length: 20 }],
    checkpoints: [{ x: 320, y: G - 34 }, { x: 1400, y: 600 }, { x: 2050, y: 260 }]
  }
];

const SANDBOX = {
  id: 5, key: 'sandbox', tier: 'SANDBOX', name: 'FREE PLAY', cn: '随便玩 · 沙盒',
  subtitle: 'No beacon. No clock. Just a big box of parts.',
  brief: 'Mess around. Build a tower, link hands into a chain, see how far you can fling a barrel. Tools are unlimited and placed objects are saved for next time.',
  width: 1800, height: 900, ground: G, toolBudget: 999,
  spawn: [[160,737],[240,737],[320,737],[400,737],[480,737],[560,737],[640,737],[720,737]],
  core: { x: 900, y: G - 34 },
  goal: null,
  hints: ['Try holding both grab buttons while standing on a friend.', 'Spawn a plank, then have two wobblers carry it.'],
  statics: [
    { kind: 'ground', x: 900, y: G + 40, w: 1800, h: 80 },
    { kind: 'wall', x: -20, y: 450, w: 40, h: 900 },
    { kind: 'wall', x: 1820, y: 450, w: 40, h: 900 },
    { kind: 'ledge', x: 600, y: 540, w: 240, h: 22 },
    { kind: 'ledge', x: 1200, y: 470, w: 240, h: 22 },
    { kind: 'ledge', x: 900, y: 360, w: 200, h: 22 }
  ],
  dynamics: [
    { kind: 'crate', x: 400, y: G - 32, w: 64, h: 64 },
    { kind: 'crate', x: 470, y: G - 32, w: 64, h: 64 },
    { kind: 'plank', x: 760, y: G - 8, w: 220, h: 16 },
    { kind: 'barrel', x: 1100, y: G - 26, r: 26 }
  ],
  plates: [], gates: [], seesaws: [{ x: 900, y: G - 24, w: 240, h: 16 }],
  water: [], wind: [], ropes: [{ x: 900, y: 220, segments: 10, length: 20 }],
  checkpoints: [{ x: 900, y: G - 34 }]
};

function getLevel(id) {
  if (id === 5 || id === 'sandbox') return SANDBOX;
  return LEVELS.find(function (l) { return l.id === Number(id) || l.key === id; }) || LEVELS[0];
}

module.exports = { LEVELS: LEVELS, SANDBOX: SANDBOX, getLevel: getLevel, GROUND_TOP: G };
