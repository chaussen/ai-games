// Reads Claude Design's hero pose sheet (docs/design/Hero.dc.html) and rewrites the block in ink.js between
// "// <hero-poses>" and "// </hero-poses>" with canvas draw ops. Run after a new Hero board lands:
//   node tools/hero-from-design.mjs            (rewrites ink.js)
//   node tools/hero-from-design.mjs --print    (prints the block, touches nothing)
// Op shapes (see paint() in ink.js): ['s', d, width, col] stroke, ['r', d, width, col] stroke that flutters,
// ['f', d, col, edge] fill (edge = hairline in the same colour), ['e', cx, cy, rx, ry, deg, col] ellipse,
// ['H', 'back'|'front'] where the player's hair goes. col: undefined = the player's ink, 'a' = the player's
// accent, anything else a literal colour (the gilt hairpin).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const html = fs.readFileSync(path.join(root, 'docs/design/Hero.dc.html'), 'utf8');

const group = id => {
  const m = new RegExp('<g id="' + id + '"[^>]*>([\\s\\S]*?)</g>').exec(html);
  if (!m) throw new Error('no <g id="' + id + '"> in Hero.dc.html');
  return m[1];
};
const attr = (tag, k) => { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(tag); return m ? m[1] : undefined; };
const num = s => +(+s).toFixed(2);
const INK = { p1: '#1d1b1a', p2: '#1c2836', p3: '#1b3027', p4: '#2c2034' };
const ACC = { p1: '#c23a2b', p2: '#3c8dbc', p3: '#4aa27c', p4: '#8c5cab' };
const GILT = '#c9a24a';
const hairRibbon = e => e.name === 'path' && e.stroke === ACC.p1 && (e.w === 0.9 || e.w === 0.75);   // the sash ribbons are 1.0 and 0.8

// one element of a group -> { op, kind }, colours normalised (player ink -> undefined, accent -> 'a')
function elements(id, pl) {
  const out = [];
  for (const tag of group(id).match(/<(path|ellipse|circle)\b[^>]*>/g) || []) {
    const col = c => (c === INK[pl] ? undefined : c === ACC[pl] ? 'a' : c);
    const name = /^<(\w+)/.exec(tag)[1];
    if (name === 'path') {
      const d = attr(tag, 'd'), stroke = attr(tag, 'stroke'), fill = attr(tag, 'fill'), w = attr(tag, 'stroke-width');
      if (fill && fill !== 'none') out.push({ op: ['f', d, col(fill), stroke ? num(w) : 0], stroke: stroke, w: num(w || 0), name });
      else out.push({ op: ['s', d, num(w), col(stroke)], stroke, w: num(w), name });
    } else if (name === 'circle') {
      const r = +attr(tag, 'r');
      out.push({ op: ['e', num(attr(tag, 'cx')), num(attr(tag, 'cy')), r, r, 0, col(attr(tag, 'fill'))], name, r, cx: +attr(tag, 'cx'), cy: +attr(tag, 'cy') });
    } else {
      const tr = /rotate\(([-\d.]+)/.exec(attr(tag, 'transform') || '');
      out.push({ op: ['e', num(attr(tag, 'cx')), num(attr(tag, 'cy')), num(attr(tag, 'rx')), num(attr(tag, 'ry')), tr ? +tr[1] : 0, col(attr(tag, 'fill'))], name, rx: +attr(tag, 'rx'), cx: +attr(tag, 'cx'), cy: +attr(tag, 'cy'), rot: tr ? +tr[1] : 0 });
    }
  }
  return out;
}

// split a pose into body ops, the head frame, and the player 1 hair (before the head = back, after = front)
function pose(id) {
  const els = elements(id, 'p1');
  const hi = els.findIndex(e => e.name === 'ellipse' && e.rx === 3.8);
  if (hi < 0) throw new Error(id + ': no head');
  const head = els[hi];
  const body = [], hair = { back: [], front: [] };
  let seenBack = false, seenFront = false;
  els.forEach((e, i) => {
    const isBack = i < hi && hairRibbon(e);
    const isFront = i > hi && ((e.name === 'ellipse' && e.rx === 2.1) || e.stroke === GILT);   // bun, hairpin
    if (isBack) { hair.back.push(['r', ...e.op.slice(1)]); if (!seenBack) { body.push(['H', 'back']); seenBack = true; } return; }
    if (isFront) { hair.front.push(e.op); if (!seenFront) { body.push(['H', 'front']); seenFront = true; } return; }
    // the sash ribbons flutter too
    if (e.name === 'path' && e.stroke === ACC.p1 && (e.w === 1 || e.w === 0.8)) { body.push(['r', ...e.op.slice(1)]); return; }
    body.push(e.op);
  });
  return { head: [num(head.cx), num(head.cy), head.rot], body, hair };
}

// hairstyles of players 2-4, in the head's own frame (the standing head, undone from the sheet)
function style(pl) {
  const stand = elements('H-' + pl + '-stand', pl), base = elements('H-stand', 'p1');
  const hi = stand.findIndex(e => e.name === 'ellipse' && e.rx === 3.8), head = stand[hi];
  const key = e => JSON.stringify(e.op).replace(/"#[0-9a-f]{6}"/g, 'C');
  const bodyKeys = new Set(base.filter(e => !hairRibbon(e) && e.rx !== 2.1 && e.stroke !== GILT).map(key));
  const back = [], front = [];
  const local = (x, y) => [num(x - head.cx), num(y - head.cy)];
  const move = d => d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => local(+x, +y).join(','));
  stand.forEach((e, i) => {
    if (i === hi) return;
    if (bodyKeys.has(key(e))) return;
    let op = e.op;
    if (op[0] === 'e') { const [x, y] = local(op[1], op[2]); op = ['e', x, y, op[3], op[4], 0, op[6]]; }
    else if (op[0] === 'f') op = ['f', move(op[1]), op[2], op[3]];
    else op = [op[0], move(op[1]), op[2], op[3]];
    if (i < hi) { if (op[0] === 's' && op[2] <= 0.9) op[0] = 'r'; back.push(op); } else front.push(op);
  });
  return { back, front };
}

const POSE_IDS = ['stand', 'run', 'jump', 'leap', 'wall', 'carry', 'land', 'fall'];
const poses = Object.fromEntries(POSE_IDS.map(n => [n, pose('H-' + n)]));
// the sheet draws one run frame; the second swaps the legs and the robe panels
{
  const r = poses.run, legIdx = [], panelIdx = [];
  r.body.forEach((o, i) => {
    if (o[0] === 's' && o[3] === undefined && (o[2] === 2.3 || o[2] === 1.9) && legIdx.length < 4) legIdx.push(i);
    else if (o[0] === 'f' && o[2] === undefined && panelIdx.length < 2) panelIdx.push(i);
  });
  if (legIdx.length !== 4 || panelIdx.length !== 2) throw new Error('run: expected 4 leg strokes and 2 panels, found ' + legIdx.length + ' and ' + panelIdx.length);
  const body = r.body.map(o => o.slice());
  const [a, b, c, d] = legIdx; [body[a], body[b], body[c], body[d]] = [r.body[c], r.body[d], r.body[a], r.body[b]];
  [body[panelIdx[0]], body[panelIdx[1]]] = [r.body[panelIdx[1]], r.body[panelIdx[0]]];
  poses.run2 = { head: r.head, body, hair: r.hair };
}
const styles = { 2: style('p2'), 3: style('p3'), 4: style('p4') };

const j = v => JSON.stringify(v).replace(/"/g, "'").replace(/,null/g, ',undefined');
const lines = [];
lines.push('// <hero-poses> generated by tools/hero-from-design.mjs from docs/design/Hero.dc.html; do not edit by hand');
lines.push('const POSES = {');
for (const [n, p] of Object.entries(poses)) {
  lines.push('  ' + n + ': { head: ' + j(p.head) + ',');
  lines.push('    ops: [' + p.body.map(j).join(', ') + '],');
  lines.push('    hair: { back: [' + p.hair.back.map(j).join(', ') + '], front: [' + p.hair.front.map(j).join(', ') + '] } },');
}
lines.push('};');
lines.push('// hairstyles of players 2-4 in the head\'s own frame (player 1\'s hair rides on its pose)');
lines.push('const STYLES = {');
for (const [n, s] of Object.entries(styles)) lines.push('  ' + n + ': { back: [' + s.back.map(j).join(', ') + '], front: [' + s.front.map(j).join(', ') + '] },');
lines.push('};');
lines.push('// </hero-poses>');
const block = lines.join('\n');

if (process.argv.includes('--print')) { console.log(block); process.exit(0); }
const file = path.join(root, 'ink.js');
const src = fs.readFileSync(file, 'utf8');
const re = /\/\/ <hero-poses>[\s\S]*?\/\/ <\/hero-poses>/;
if (!re.test(src)) throw new Error('ink.js has no <hero-poses> block to replace');
fs.writeFileSync(file, src.replace(re, () => block));
console.log('ink.js: hero poses rewritten from the sheet (' + Object.keys(poses).length + ' poses, 3 more hairstyles)');
