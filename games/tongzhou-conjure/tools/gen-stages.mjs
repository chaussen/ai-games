#!/usr/bin/env node
// Ask a local model for new stages, judge each one, and send the judge's words back
// until it passes or the tries run out. Passing stages land in content/candidates/.
//
//   node tools/gen-stages.mjs --model qwen3.8-flash --n 10
//   --url     OpenAI-compatible endpoint (default http://127.0.0.1:11434/v1: Ollama, llama.cpp, LM Studio)
//   --n       how many stages to try for (default 5)      --tries  repair rounds per stage (default 5)
//   --seed    number, for the same briefs again           --brief  your own brief instead of a drawn one
//   --out     where passing stages go (default content/candidates)
// Nothing here touches the game. `node tools/judge.mjs` is the only thing that says yes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { judge } from './judge/index.mjs';
import { calibrate } from './judge/solve.mjs';
const require = createRequire(import.meta.url);
const LV = require('../levels.js');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : dflt; };
const url = arg('url', process.env.GEN_URL || 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
const model = arg('model', process.env.GEN_MODEL || 'qwen3.8-flash');
const want = Number(arg('n', 5)), tries = Number(arg('tries', 5));
const outDir = path.resolve(arg('out', path.join(root, 'content', 'candidates')));
let seed = Number(arg('seed', Date.now() % 100000));
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];

// The code decides WHAT the isle teaches; the model decides where things go.
const OBSTACLES = ['a gap of 3 water cells across the whole isle', 'a thorn wall across the whole isle', 'a flame wall across the whole isle', 'a gap of 2 water cells and, further on, a thorn wall'];
function brief() {
  const made = [...new Set(Object.values(LV.RECIPES))];
  const ch = pick(made), parts = [...Object.keys(LV.RECIPES).find(k => LV.RECIPES[k] === ch)];
  return `The pavilion wants ${ch} (${LV.GLYPHS[ch].en}), made from ${parts.join(' + ')}. Between the landing and the pavilion put ${pick(OBSTACLES)}. ` +
    `Palette: ${pick(['dawn', 'mint', 'dusk', 'citrus', 'night'])}. Map about ${14 + Math.floor(rnd() * 6)} columns by ${5 + Math.floor(rnd() * 3)} rows.`;
}

const taken = new Set([...fs.readdirSync(path.join(root, 'content', 'stages')), ...(fs.existsSync(outDir) ? fs.readdirSync(outDir) : [])].map(f => f.replace(/\.json$/, '')));
function prompt(b) {
  const cal = calibrate();
  const read = id => fs.readFileSync(path.join(root, 'content', 'stages', id + '.json'), 'utf8').trim();
  return fs.readFileSync(path.join(root, 'tools', 'gen-prompt.md'), 'utf8')
    .replace('{{LEAP}}', cal.leapGap)
    .replace('{{GLYPHS}}', Object.entries(LV.GLYPHS).map(([c, g]) => `${c} ${g.py} "${g.en}" (${g.el})`).join('\n'))
    .replace('{{RECIPES}}', [...new Set(Object.keys(LV.RECIPES).map(k => [...k].sort().join(' + ') + ' = ' + LV.RECIPES[k]))].join('\n'))
    .replace('{{BRIEF}}', b + ` Do not reuse these ids: ${[...taken].join(', ')}.`)
    .replace('{{EXAMPLES}}', read('two-trees') + '\n\n' + read('sun-and-moon'));
}

async function ask(messages) {
  const res = await fetch(url + '/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.8, stream: false })
  });
  if (!res.ok) throw new Error('model endpoint answered ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return (await res.json()).choices[0].message.content || '';
}
// models wrap JSON in prose, fences and "thinking": take the outermost { ... }
function extract(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON object in the answer');
  return JSON.parse(text.slice(a, b + 1));
}

fs.mkdirSync(outDir, { recursive: true });
const tally = { asked: 0, passed: 0, rounds: 0, reasons: {} };
for (let n = 0; n < want; n++) {
  const b = arg('brief') || brief();
  console.log(`\n[${n + 1}/${want}] ${b}`);
  const messages = [{ role: 'user', content: prompt(b) }];
  tally.asked++;
  for (let t = 1; t <= tries; t++) {
    tally.rounds++;
    let stage, verdict;
    const answer = await ask(messages);
    try { stage = extract(answer); } catch (e) { verdict = { pass: false, problems: [{ code: 'bad-json', where: '', msg: 'Your answer was not one JSON object: ' + e.message }], routes: [] }; }
    if (stage && taken.has(stage.id)) verdict = { pass: false, problems: [{ code: 'id-taken', where: 'id', msg: `The id "${stage.id}" is already used. Choose a new one.` }], routes: [] };
    if (!verdict) verdict = await judge(stage);
    if (verdict.pass) {
      taken.add(stage.id);
      fs.writeFileSync(path.join(outDir, stage.id + '.json'), JSON.stringify(stage, null, 1) + '\n');
      fs.writeFileSync(path.join(outDir, stage.id + '.verdict.json'), JSON.stringify({ brief: b, model, tries: t, routes: verdict.routes.map(r => ({ needs: r.needs, steps: r.steps, seconds: r.seconds })), warnings: verdict.warnings }, null, 1) + '\n');
      console.log(`  try ${t}: PASS → ${stage.id} (${verdict.routes.map(r => r.needs.join('+')).join(' | ')})`);
      tally.passed++;
      break;
    }
    for (const p of verdict.problems) tally.reasons[p.code] = (tally.reasons[p.code] || 0) + 1;
    console.log(`  try ${t}: ${verdict.problems.map(p => p.code).join(', ')}`);
    messages.push({ role: 'assistant', content: answer.slice(0, 6000) });
    messages.push({ role: 'user', content: 'The judge rejected that stage:\n' + verdict.problems.slice(0, 8).map(p => `- ${p.where ? p.where + ': ' : ''}${p.msg}`).join('\n') + '\nFix exactly these problems and answer with the whole corrected JSON object.' });
  }
}
console.log(`\n${tally.passed} of ${tally.asked} briefs produced a passing stage in ${tally.rounds} model calls.`);
console.log('Why stages were rejected: ' + (Object.entries(tally.reasons).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ×${k}`).join(', ') || 'never'));
