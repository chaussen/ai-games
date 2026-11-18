// Headless check for lab/draw.html (Card 1.2 check)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'draw.html');

if (!fs.existsSync(htmlPath)) {
  console.error('FAIL: lab/draw.html does not exist');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const checks = [
  ['pointerdown', 'handles pointerdown'],
  ['pointermove', 'handles pointermove'],
  ['pointerup', 'handles pointerup'],
  ['touch-action: none', 'disables browser gesture defaults'],
  ['WRecog.match', 'calls recogniser match'],
  ['JSON.stringify', 'exports strokes as JSON']
];

let failed = 0;
for (const [substr, desc] of checks) {
  if (html.includes(substr)) {
    console.log('PASS ✓ ' + desc);
  } else {
    console.error('FAIL ✗ ' + desc);
    failed++;
  }
}

if (failed === 0) {
  console.log('DONE');
} else {
  process.exit(1);
}
