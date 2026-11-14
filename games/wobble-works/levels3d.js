// 3D Level Playground definition for Wobble Works 3D
// Dimensions are in meters (compatible with Cannon.js and Three.js)
// Coordinate system: Y is UP, X is RIGHT, Z is DEPTH.

const GOALS = [
  { id: 'summit', name: 'SUMMIT BELL', x: 26, y: 14.5, z: -26, r: 3.4, color: 0xffd700, desc: 'Top of the Spiral Tower' },
  { id: 'skyhoop', name: 'SKY HOOP', x: -25, y: 11.0, z: -25, r: 3.6, color: 0x00e5ff, desc: 'Floating above the Trampolines' },
  { id: 'fortress', name: 'FORTRESS CHALICE', x: -24, y: 9.2, z: 24, r: 3.4, color: 0xff4081, desc: 'High Fortress Battlement' },
  { id: 'seesaw', name: 'CHASM BEACON', x: 25, y: 7.5, z: 25, r: 3.4, color: 0x76ff03, desc: 'Across the See-Saw Chasm' },
  { id: 'meadow', name: 'MEADOW POST', x: 0, y: 2.2, z: 36, r: 3.6, color: 0xff9100, desc: 'Central Meadow Goal' }
];

const bounds = { minX: -46, maxX: 46, minZ: -46, maxZ: 46 };

const spawns = [
  [0, 1.2, 0], [2.5, 1.2, 2.5], [-2.5, 1.2, 2.5], [2.5, 1.2, -2.5], [-2.5, 1.2, -2.5],
  [5, 1.2, 0], [-5, 1.2, 0], [0, 1.2, 5], [0, 1.2, -5],
  [4, 1.2, 4], [-4, 1.2, 4], [4, 1.2, -4], [-4, 1.2, -4],
  [6, 1.2, 2], [-6, 1.2, 2], [6, 1.2, -2]
];

const ballSpawn = { x: 0, y: 3.0, z: 8 };

const statics = [
  // Ground, built as four slabs so ZONE 4 has an actual pit between the
  // platforms (x 20..30, z 20..30). A single plane made the "chasm" flat.
  { type: 'box', x: -15, y: -0.5, z: 0, sx: 70, sy: 1.0, sz: 100, mat: 'grass', name: 'Ground W' },
  { type: 'box', x: 40, y: -0.5, z: 0, sx: 20, sy: 1.0, sz: 100, mat: 'grass', name: 'Ground E' },
  { type: 'box', x: 25, y: -0.5, z: -15, sx: 10, sy: 1.0, sz: 70, mat: 'grass', name: 'Ground N' },
  { type: 'box', x: 25, y: -0.5, z: 40, sx: 10, sy: 1.0, sz: 20, mat: 'grass', name: 'Ground S' },
  // Pit floor, far below the -5 respawn line: decorative depth only.
  { type: 'box', x: 25, y: -9, z: 25, sx: 10.4, sy: 1.0, sz: 10.4, mat: 'abyss', name: 'Abyss Floor' },
  // Perimeter safety hedges
  { type: 'box', x: 0, y: 3, z: -48, sx: 96, sy: 6, sz: 2, mat: 'hedge' },
  { type: 'box', x: 0, y: 3, z: 48, sx: 96, sy: 6, sz: 2, mat: 'hedge' },
  { type: 'box', x: -48, y: 3, z: 0, sx: 2, sy: 6, sz: 96, mat: 'hedge' },
  { type: 'box', x: 48, y: 3, z: 0, sx: 2, sy: 6, sz: 96, mat: 'hedge' },

  // Central Plaza Stage
  { type: 'cylinder', x: 0, y: 0.25, z: 0, radiusTop: 7.5, radiusBottom: 8.0, height: 0.5, mat: 'stone' },

  // === ZONE 1: TOWER & SPIRAL (X: +26, Z: -26) ===
  { type: 'cylinder', x: 26, y: 7.0, z: -26, radiusTop: 3.5, radiusBottom: 4.0, height: 14.0, mat: 'tower' },
  { type: 'cylinder', x: 26, y: 14.0, z: -26, radiusTop: 6.0, radiusBottom: 6.0, height: 0.6, mat: 'wood' },
  // Spiral ramp steps winding up the tower
  { type: 'box', x: 26 + 5.2, y: 1.5, z: -26 + 0.0, sx: 3.5, sy: 0.4, sz: 3.2, rotY: 0, mat: 'wood' },
  { type: 'box', x: 26 + 4.2, y: 3.5, z: -26 + 3.8, sx: 3.5, sy: 0.4, sz: 3.2, rotY: -0.78, mat: 'wood' },
  { type: 'box', x: 26 + 0.0, y: 5.5, z: -26 + 5.2, sx: 3.5, sy: 0.4, sz: 3.2, rotY: -1.57, mat: 'wood' },
  { type: 'box', x: 26 - 3.8, y: 7.5, z: -26 + 4.2, sx: 3.5, sy: 0.4, sz: 3.2, rotY: -2.35, mat: 'wood' },
  { type: 'box', x: 26 - 5.2, y: 9.5, z: -26 + 0.0, sx: 3.5, sy: 0.4, sz: 3.2, rotY: -3.14, mat: 'wood' },
  { type: 'box', x: 26 - 4.2, y: 11.5, z: -26 - 3.8, sx: 3.5, sy: 0.4, sz: 3.2, rotY: 2.35, mat: 'wood' },
  { type: 'box', x: 26 - 0.0, y: 13.0, z: -26 - 5.2, sx: 3.5, sy: 0.4, sz: 3.2, rotY: 1.57, mat: 'wood' },

  // === ZONE 2: BOUNCE CANYON (X: -25, Z: -25) ===
  { type: 'box', x: -33, y: 3.0, z: -25, sx: 3, sy: 6, sz: 3, mat: 'stone' },
  { type: 'box', x: -17, y: 3.0, z: -25, sx: 3, sy: 6, sz: 3, mat: 'stone' },
  { type: 'box', x: -25, y: 3.0, z: -33, sx: 3, sy: 6, sz: 3, mat: 'stone' },
  { type: 'box', x: -25, y: 3.0, z: -17, sx: 3, sy: 6, sz: 3, mat: 'stone' },

  // === ZONE 3: FORTRESS & CRATES (X: -25, Z: +25) ===
  { type: 'box', x: -25, y: 2.0, z: 25, sx: 15, sy: 4.0, sz: 15, mat: 'stone' },
  { type: 'box', x: -25, y: 5.0, z: 25, sx: 11, sy: 2.0, sz: 11, mat: 'stone' },
  { type: 'box', x: -24, y: 7.5, z: 24, sx: 6, sy: 3.0, sz: 6, mat: 'stone' },
  { type: 'ramp', x: -16, y: 1.0, z: 25, sx: 6, sy: 0.4, sz: 4, rotZ: 0.25, mat: 'wood' },

  // === ZONE 4: SEE-SAW CHASM (X: +25, Z: +25) ===
  { type: 'box', x: 17, y: 1.5, z: 25, sx: 6, sy: 3.0, sz: 8, mat: 'stone' },
  { type: 'box', x: 33, y: 3.5, z: 25, sx: 8, sy: 7.0, sz: 8, mat: 'stone' },

  // === ZONE 5: MEADOW GOAL POST (X: 0, Z: +36) ===
  { type: 'box', x: -4, y: 2.5, z: 36, sx: 0.6, sy: 5.0, sz: 0.6, mat: 'wood' },
  { type: 'box', x: 4, y: 2.5, z: 36, sx: 0.6, sy: 5.0, sz: 0.6, mat: 'wood' },
  { type: 'box', x: 0, y: 5.0, z: 36, sx: 8.6, sy: 0.6, sz: 0.6, mat: 'wood' }
];

const bouncePads = [
  { id: 'b1', x: -25, y: 0.2, z: -25, sx: 5.0, sz: 5.0, impulse: 26.0, label: 'SUPER BOUNCE' },
  { id: 'b2', x: -31, y: 0.2, z: -31, sx: 3.5, sz: 3.5, impulse: 22.0, label: 'BOUNCE' },
  { id: 'b3', x: -19, y: 0.2, z: -19, sx: 3.5, sz: 3.5, impulse: 22.0, label: 'BOUNCE' },
  { id: 'b_tower', x: 26 + 6.0, y: 0.2, z: -26 + 6.0, sx: 3.5, sz: 3.5, impulse: 25.0, label: 'TOWER LAUNCHER' }
];

const crates = [
  { id: 'c1', x: -14, y: 1.0, z: 19, size: 1.6, mass: 18 },
  { id: 'c2', x: -16, y: 1.0, z: 22, size: 1.6, mass: 18 },
  { id: 'c3', x: -14, y: 1.0, z: 28, size: 1.6, mass: 18 },
  { id: 'c4', x: -12, y: 1.0, z: 24, size: 1.6, mass: 18 },
  { id: 'c5', x: 2, y: 1.0, z: -10, size: 1.6, mass: 18 },
  { id: 'c6', x: -4, y: 1.0, z: -10, size: 1.6, mass: 18 }
];

const seesaws = [
  { id: 'ss1', x: 25, y: 3.2, z: 25, length: 9.0, width: 3.0, thickness: 0.4, axis: 'z' }
];

const exportData = {
  bounds,
  spawns,
  ballSpawn,
  goals: GOALS,
  statics,
  bouncePads,
  crates,
  seesaws
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportData;
}
if (typeof window !== 'undefined') {
  window.LVL3D = exportData;
}