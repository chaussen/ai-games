// Text-only river view. Exists to prove the renderer contract (brief §5): load with ?renderer=text.
// Draws what it is given, knows no rules, takes no input.
export function createRenderer(container) {
  const pre = document.createElement('pre');
  container.appendChild(pre);
  let last = '';
  return {
    render: function (view, nowMs) {
      const b = view.boat, lines = [];
      lines.push('RIVER (text view)   气 ' + b.qi.toFixed(1) + '   ' + (b.stopped ? 'bogged' : b.speed.toFixed(1) + ' m/s') +
        '   ' + Math.round(b.distance) + ' m   clears in a row ' + b.streak);
      lines.push('');
      lines.push('AHEAD');
      view.incoming.slice().reverse().forEach(function (e) {
        lines.push('  ' + String(Math.round(e.dist)).padStart(4) + ' m  ' + e.picture + ' ' + e.label);
      });
      lines.push('ABOARD');
      view.aboard.forEach(function (e) {
        lines.push('  ' + e.picture + ' ' + e.label + '  chips ' + e.chips + '  drain x' + e.drainMul);
      });
      lines.push('HOLD  ' + view.hold.map(function (h) { return h ? h.char + ' ' + h.pinyin : '·'; }).join('   '));
      lines.push('');
      view.fx.filter(function (f) { return f.text && nowMs - f.at < 5000; }).slice(-3).forEach(function (f) { lines.push('> ' + f.text); });
      const txt = lines.join('\n');
      if (txt !== last) { pre.textContent = txt; last = txt; }
    },
    resize: function () {},
    pick: function () { return null; },
    dispose: function () { pre.remove(); }
  };
}
