#!/usr/bin/env node
// Wobble Works — one entry point for both builds.
//   node server.js              -> 2D side-view original (default)
//   node server.js --mode=3d    -> 3D arena experiment
//   WOBBLE_MODE=3d PORT=3100 node server.js
// Each build keeps its own game code in 2d/ or 3d/; this launcher only picks which one runs.
'use strict';
const arg = process.argv.slice(2).map(a => a.match(/^--mode(?:=(.*))?$/)).find(Boolean);
const argv = process.argv.slice(2);
let mode = process.env.WOBBLE_MODE || '2d';
if (arg) mode = arg[1] || argv[argv.indexOf('--mode') + 1] || mode;
mode = String(mode).toLowerCase();
if (mode !== '2d' && mode !== '3d') {
  console.error('Unknown mode "' + mode + '" — use 2d or 3d.');
  process.exit(1);
}
console.log('  Wobble Works mode: ' + mode.toUpperCase());
require('./' + mode + '/server.js');
