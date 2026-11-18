// The judge: one stage in, one verdict out.
//   { id, pass, problems: [{ code, where, msg }], warnings: [...], routes: [{ needs, steps, seconds, log }] }
// `problems` are written to be read by the model that made the stage: what is wrong, and what to change.
import { lint } from './lint.mjs';
import { routes, replay, FORGING } from './solve.mjs';

const WAY_ROUND = {
  bridge: 'a gap of 1-5 cells that a friend can be boosted over or the boat can reach round',
  burn: 'another way past the thorns, e.g. water the boat can row along to the far side',
  douse: 'another way past the flames, e.g. water the boat can row along to the far side',
  boost: 'a 木 stone so the gap can be bridged instead',
  leap: 'a 木 stone so the gap can be bridged instead',
  plate: 'steps of height 1 beside the lift',
  row: 'a gap narrow enough to bridge with 木 (3 cells), or thorns with a 火 stone',
  ground: 'two players holding the pieces can forge them in hand (stand side by side, or one on the other\'s head)',
  body: 'room to set one stone beside or on top of another'
};

export async function judge(stage, opts = {}) {
  const out = { id: stage && stage.id, pass: false, problems: await lint(stage), warnings: [], routes: [] };
  if (out.problems.length) return out;
  const r = routes(stage, opts);
  out.routes = r.routes;
  if (!r.solved) {
    out.problems.push({ code: 'unsolved', where: '', msg: 'Two players cannot bring ' + stage.want + ' to the pavilion. They tried walking, jumping (1 up, 2 cells across, 1 cell with a stone), leaping, joining stones, bridges, burning thorns, dousing flames, boosting, plates with lifts, and rowing the boat. Check that every stone can be reached, that walls have a matching fire or water stone on the near side, and that the pavilion is not on a ledge more than 1 above its neighbours.' });
    return out;
  }
  for (const route of r.routes) if (!replay(stage, route.log)) out.problems.push({ code: 'judge-bug', where: '', msg: 'A recorded route did not replay. This is a bug in the judge, not in the stage: report it.' });
  const first = r.routes[0];
  if (!r.routes.some(x => x.needs.some(m => !FORGING.includes(m)))) out.problems.push({ code: 'no-obstacle', where: 'map', msg: 'Nothing stands between the crew and the pavilion: they just carry the stone there. Put a gap, thorns, flames or a lift on the way.' });
  else if (r.routes.filter(x => !x.extra).length < 2) out.problems.push({ code: 'one-way', where: 'map', msg: `There is only one way through (it needs: ${first.needs.join(', ')}). Every isle must have a second way. Add ${first.needs.filter(m => !FORGING.includes(m)).map(m => WAY_ROUND[m]).join('; or ')}.` });
  const slow = Math.max(...r.routes.filter(x => !x.extra).map(x => x.seconds));
  if (stage.par < slow * 1.5) out.warnings.push({ code: 'par-tight', where: 'par', msg: `par is ${stage.par}s but a careful crew of two needs about ${slow}s for the slower route. Use about ${Math.ceil(slow * 2.5 / 5) * 5}.` });
  out.pass = !out.problems.length;
  return out;
}

export function report(v) {
  const lines = [(v.pass ? 'PASS ✓ ' : 'FAIL ✗ ') + v.id];
  for (const p of v.problems) lines.push(`  [${p.code}] ${p.where ? p.where + ': ' : ''}${p.msg}`);
  for (const p of v.warnings) lines.push(`  (warning: ${p.code}) ${p.msg}`);
  v.routes.forEach((r, i) => { lines.push(`  ${r.extra ? 'also' : 'way ' + (i + 1)}: needs ${r.needs.join(' + ') || 'nothing'}, about ${r.seconds}s`); for (const s of r.steps) lines.push('      ' + s); });
  return lines.join('\n');
}
