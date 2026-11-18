#!/usr/bin/env node
// Judge stage files.   node tools/judge.mjs content/stages/two-trees.json [more.json ...]
//   --json        print the verdicts as JSON (routes without their input logs)
//   --all         look for every route, not just the first two (slow)
//   --cert <dir>  save each winning input log as <dir>/<id>.route<N>.json
// Exit code 0 only if every stage passes.
import fs from 'node:fs';
import path from 'node:path';
import { judge, report } from './judge/index.mjs';

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const json = flag('--json'), all = flag('--all');
let cert = null;
{ const i = args.indexOf('--cert'); if (i >= 0) { cert = args[i + 1]; args.splice(i, 2); } }
if (!args.length) { console.error('usage: node tools/judge.mjs <stage.json> [...] [--json] [--all] [--cert dir]'); process.exit(2); }

const verdicts = [];
for (const file of args) {
  let stage, v;
  try { stage = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { v = { id: path.basename(file), pass: false, problems: [{ code: 'bad-json', where: '', msg: 'This is not valid JSON: ' + e.message }], warnings: [], routes: [] }; }
  if (!v) v = await judge(stage, { all });
  if (cert && v.routes.length) { fs.mkdirSync(cert, { recursive: true }); v.routes.forEach((r, i) => fs.writeFileSync(path.join(cert, `${v.id}.route${i + 1}.json`), JSON.stringify({ stage: v.id, needs: r.needs, steps: r.steps, log: r.log }))); }
  verdicts.push(v);
  if (!json) console.log(report(v));
}
if (json) console.log(JSON.stringify(verdicts.map(v => Object.assign({}, v, { routes: v.routes.map(r => ({ needs: r.needs, steps: r.steps, seconds: r.seconds })) })), null, 1));
process.exit(verdicts.every(v => v.pass) ? 0 : 1);
