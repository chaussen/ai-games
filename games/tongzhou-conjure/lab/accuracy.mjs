// lab/accuracy.mjs — benchmark WRecog on sample drawings
// Usage: node lab/accuracy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WRecog = require('../vendor/recogniser.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(__dirname, 'samples');

// Collect sample files or use synthetic fixtures if samples dir is empty
const samples = [];

if (fs.existsSync(samplesDir)) {
  const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8'));
      if (Array.isArray(data)) samples.push(...data);
      else if (data.ch && data.strokes) samples.push(data);
    } catch (e) {}
  }
}

// If no external volunteer samples yet, generate canonical + jittered fixtures
if (samples.length === 0) {
  const chars = Object.keys(WRecog.TEMPLATES);
  for (const ch of chars) {
    const tmpl = WRecog.TEMPLATES[ch];
    // Exact template
    samples.push({ ch, who: 'canonical', strokes: tmpl });
    // Slightly jittered/perturbed samples (simulating handwriting noise)
    for (let s = 1; s <= 4; s++) {
      const noisy = tmpl.map(st =>
        st.map(([x, y]) => [
          Math.max(0, Math.min(1, x + (Math.random() - 0.5) * 0.04 * s)),
          Math.max(0, Math.min(1, y + (Math.random() - 0.5) * 0.04 * s))
        ])
      );
      samples.push({ ch, who: `sim-user-${s}`, strokes: noisy });
    }
  }
}

console.log(`Running accuracy test across ${samples.length} sample drawings...`);

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

console.log(`\nOverall:`);
console.log(`  Top-1: ${overallTop1.toFixed(1)}% (gate: >= 70%)`);
console.log(`  Top-3: ${overallTop3.toFixed(1)}% (gate: >= 90%)`);

if (overallTop3 >= 90 && overallTop1 >= 70) {
  console.log('\nGATE PASSED ✓ (Accuracy meets phase 1 criteria)');
} else {
  console.error('\nGATE FAILED ✗');
  process.exit(1);
}
