// The board page (board.html): a QR code for phones on the same Wi-Fi. The profile and the friends knob
// chosen here are the room's (POST /crew, the living-room rule). Copied in pattern from forge-2d's board.
(function () {
  'use strict';
  const cfg = window.SB_CONFIG || {};
  const $ = s => document.querySelector(s);
  const PROFILES = ['relaxed', 'standard', 'strict'];
  const BODIES = [{ id: 'off', en: 'untouchable' }, { id: 'playful', en: 'playful' }, { id: 'rough', en: 'rough' }];
  const COLOURS = ['#c94f30', '#3e7fae', '#5d9155', '#b98a2e'];   // app.js PLAYER_COLOR
  const st = { profile: 'standard', body: 'playful' };

  // phones need this computer's Wi-Fi address, not localhost
  const loop = h => h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  const host = loop(location.hostname) ? ((cfg.lanIPs || [])[0] || location.hostname) : location.hostname;
  const port = cfg.port || location.port || 80;

  function render() {
    const url = 'http://' + host + ':' + port + '/';
    $('#url').textContent = url.replace(/^http:\/\//, '');
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(url); qr.make();
      $('#qr').innerHTML = qr.createImgTag(8, 0);
    } catch (e) { $('#qr').textContent = url; }
    for (const b of document.querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(st[b.dataset.k] === b.dataset.v));
    const lan = (cfg.lanIPs || []).length;
    if (loop(host)) $('#roster').innerHTML = '<span class="warn">No Wi-Fi address found: phones cannot reach localhost.</span>';
    else if (lan > 1) $('#roster').innerHTML = 'More than one network here; the QR uses ' + host + '. Open /board?host= to pick another.';
  }
  function chips(sel, k, list) {
    for (const it of list) {
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.k = k; b.dataset.v = it.id || it;
      b.textContent = it.en || it;
      b.addEventListener('click', () => { st[k] = b.dataset.v; render(); tell(); });
      $(sel).appendChild(b);
    }
  }
  function tell() {
    fetch('crew', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(st) }).catch(() => {});
  }
  function roster() {
    fetch('crew.json', { cache: 'no-store' }).then(r => r.json()).then(c => {
      const dots = c.players.map(p => '<span class="pd" style="background:' + (p.here ? COLOURS[(p.slot | 0) % 4] : 'transparent') + ';border-color:' + COLOURS[(p.slot | 0) % 4] + '"></span>').join('');
      $('#roster').innerHTML = '<b>Crew</b> ' + (c.players.length ? dots + ' ' + c.players.length + ' of ' + c.max : 'nobody yet') +
        ' · play ' + c.profile + ', friends ' + c.body;
      if (c.profile !== st.profile || c.body !== st.body) { st.profile = c.profile; st.body = c.body; render(); }
    }).catch(() => {});
  }
  chips('#profiles', 'profile', PROFILES);
  chips('#bodies', 'body', BODIES);
  render();
  setInterval(roster, 2000); roster();
})();
