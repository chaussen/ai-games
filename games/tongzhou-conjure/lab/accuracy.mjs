// lab/accuracy.mjs — benchmark WRecog on sample drawings
// Usage:
//   node lab/accuracy.mjs              real samples in lab/samples/ only; refuses to
//                                      print a gate result without them (exit code 2)
//   node lab/accuracy.mjs --synthetic  jittered copies of the templates, for a quick
//                                      smoke test of the matcher (never a gate result)
//
// Why the refusal: with an empty lab/samples/ this file used to report 100% by testing
// the templates against jittered copies of themselves. That number said nothing about
// real handwriting. See docs/conjure/OPEN-SET.md section 2 and ROADMAP card B1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WRecog = require('../vendor/recogniser.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(__dirname, 'samples');

const SYNTHETIC = process.argv.includes('--synthetic');
const NO_SAMPLES_MSG = 'NO REAL SAMPLES: run lab/draw.html and save drawings into lab/samples/';

// ---------- real samples ----------
const realSamples = [];
let sampleFiles = 0;
let unreadableFiles = 0;

if (fs.existsSync(samplesDir)) {
  const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.json'));
  sampleFiles = files.length;
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8'));
      if (Array.isArray(data)) {
        const usable = data.filter(d => d && d.ch && Array.isArray(d.strokes) && d.strokes.length > 0);
        if (usable.length === 0) unreadableFiles++;
        realSamples.push(...usable);
      } else if (data && data.ch && Array.isArray(data.strokes) && data.strokes.length > 0) {
        realSamples.push(data);
      } else {
        unreadableFiles++;
      }
    } catch (e) {
      unreadableFiles++;
    }
  }
}

// ---------- synthetic fixtures (never a gate result) ----------
function syntheticSamples() {
  const out = [];
  for (const ch of Object.keys(WRecog.TEMPLATES)) {
    const tmpl = WRecog.TEMPLATES[ch];
    out.push({ ch, who: 'canonical', strokes: tmpl });
    for (let s = 1; s <= 4; s++) {
      const noisy = tmpl.map(st =>
        st.map(([x, y]) => [
          Math.max(0, Math.min(1, x + (Math.random() - 0.5) * 0.04 * s)),
          Math.max(0, Math.min(1, y + (Math.random() - 0.5) * 0.04 * s))
        ])
      );
      out.push({ ch, who: `sim-user-${s}`, strokes: noisy });
    }
  }
  return out;
}

let samples;
if (SYNTHETIC) {
  samples = syntheticSamples();
  console.log('SYNTHETIC — NOT A GATE RESULT');
} else {
  if (realSamples.length === 0) {
    console.log(NO_SAMPLES_MSG);
    if (sampleFiles > 0) {
      console.log(`(${sampleFiles} .json file(s) in lab/samples/, ${unreadableFiles} without usable {ch, strokes} drawings)`);
    }
    process.exit(2);
  }
  samples = realSamples;
}

console.log(`Running accuracy test across ${samples.length} ${SYNTHETIC ? 'synthetic' : 'real'} sample drawings...`);

let top1 = 0, top3 = 0, total = samples.length;
const perChar = {};

for (const sample of samples) {
  const { ch, strokes } = sample;
  if (!perChar[ch]) perChar[ch] = { total: 0, top1: 0, top3: 0 };
  perChar[ch].total++;

  const matches = WRecog.match(strokes);
  if (matches.length > 0 && matches[0].ch === ch) {
    top1++;
    perChar[ch].top1++;
  }
  if (matches.slice(0, 3).some(m => m.ch === ch)) {
    top3++;
    perChar[ch].top3++;
  }
}

console.log('\nPer-character accuracy:');
for (const [ch, stat] of Object.entries(perChar)) {
  const p1 = Math.round((stat.top1 / stat.total) * 100);
  const p3 = Math.round((stat.top3 / stat.total) * 100);
  console.log(`  ${ch}: Top-1: ${p1}% (${stat.top1}/${stat.total}), Top-3: ${p3}% (${stat.top3}/${stat.total})`);
}

const overallTop1 = (top1 / total) * 100;
const overallTop3 = (top3 / total) * 100;
const pass = overallTop3 >= 90 && overallTop1 >= 70;

console.log(`\nOverall:`);
console.log(`  Top-1: ${overallTop1.toFixed(1)}% (gate: >= 70%)`);
console.log(`  Top-3: ${overallTop3.toFixed(1)}% (gate: >= 90%)`);

if (SYNTHETIC) {
  // Templates against jittered copies of themselves says nothing about handwriting.
  console.log(pass ? 'Synthetic run met the thresholds (still not a gate result).' : 'Synthetic run did NOT meet the thresholds.');
  console.log('SYNTHETIC — NOT A GATE RESULT');
  process.exit(0);
}

if (pass) {
  console.log('\nGATE PASSED ✓ (measured on real samples)');
} else {
  console.error('\nGATE FAILED ✗');
  process.exit(1);
}
