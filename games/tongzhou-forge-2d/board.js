// The board page (board.html; README.md, "The board"): a QR code for phones on the same Wi-Fi. The look and profile chosen
// here go into the phone link (?art= and ?profile=, which the game reads before its saved settings). Together (the
// default, docs/CO-OP.md) adds ?crew=1: the phones join the server's crew, one isle for up to four, and the board
// shows who is in it and sets the crew's profile and what a thrown stone does to a friend (POST /crew).
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const cfg = window.F2D_CONFIG || {};
  const $ = s => document.querySelector(s);
  const ARTS = [
    { id: 'ink', g: '水墨', py: 'shuǐ mò', en: 'ink scroll' },
    { id: 'cut', g: '一笔', py: 'yī bǐ', en: 'One Stroke' },
    { id: 'greybox', g: '', py: '', en: 'greybox' },
  ];
  const PROFILES = ['relaxed', 'standard', 'strict'];
  const CREW = [{ id: '1', g: '同舟', py: 'tóng zhōu', en: 'together, one isle (up to 4)' }, { id: '0', en: 'each alone' }];
  const KNOCKS = [{ id: 'off', en: 'fly through friends' }, { id: 'push', en: 'knock a friend back' }, { id: 'loose', en: 'knock what they carry loose' }];
  const COLOURS = ['', '#c23a2b', '#3c8dbc', '#4aa27c', '#8c5cab'];   // ink.js PLAYERS
  const st = {
    crew: qs.get('crew') === '0' ? '0' : '1',
    knock: ['off', 'push', 'loose'].includes(qs.get('knock')) ? qs.get('knock') : 'off',
    art: ARTS.some(a => a.id === qs.get('art')) ? qs.get('art') : 'ink',
    profile: PROFILES.includes(qs.get('profile')) ? qs.get('profile') : 'standard',
    isle: qs.get('isle') || '',
  };
  // phones need this computer's Wi-Fi address, not localhost
  const loop = h => h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  const host = qs.get('host') || (loop(location.hostname) ? ((cfg.lanIPs || [])[0] || location.hostname) : location.hostname);
  const port = cfg.port || location.port || 80;

  function phoneURL() {
    const q = new URLSearchParams({ art: st.art, profile: st.profile });
    if (st.crew === '1') q.set('crew', '1');
    else if (st.isle) q.set('isle', st.isle);
    return 'http://' + host + ':' + port + '/?' + q;
  }
  function render() {
    const url = phoneURL();
    $('#url').textContent = url.replace(/^http:\/\//, '');
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(url); qr.make();
      $('#qr').innerHTML = qr.createImgTag(8, 0);
    } catch (e) { $('#qr').textContent = url; }
    for (const b of document.querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(st[b.dataset.k] === b.dataset.v));
    $('#here').href = './?' + new URL(url).search.slice(1);
    const q = new URLSearchParams(location.search); q.set('art', st.art); q.set('profile', st.profile); q.set('crew', st.crew); q.set('knock', st.knock);
    $('#how').textContent = st.crew === '1' ? 'Scan with a phone camera to join the crew: up to four on one isle, each writing their own.' : 'Scan with a phone camera. Every phone plays its own game, in the look below.';
    $('#roster').hidden = $('#knocks').hidden = st.crew !== '1';
    history.replaceState(null, '', '?' + q);
    const lan = (cfg.lanIPs || []).length;
    $('#note').innerHTML = loop(host) ? '<span class="warn">No Wi-Fi address found: phones cannot reach localhost.</span>'
      : lan > 1 ? 'More than one network here; open with ?host= to pick another.' : '';
  }
  function chips(sel, k, list) {
    for (const it of list) {
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.k = k; b.dataset.v = it.id || it;
      b.innerHTML = it.g ? '<span class="g">' + it.g + '</span>' + it.py + ' · ' + it.en : (it.en || it);
      b.addEventListener('click', () => { st[k] = b.dataset.v; render(); if (st.crew === '1' && (k === 'profile' || k === 'knock' || k === 'crew')) tell(); });
      $(sel).appendChild(b);
    }
  }
  // the crew: who is in it (every 2 s), and the board's choices for it
  function tell() {
    fetch('crew', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: st.profile, knock: st.knock }) }).catch(() => {});
  }
  function roster() {
    if (st.crew !== '1') return;
    fetch('crew.json', { cache: 'no-store' }).then(r => r.json()).then(c => {
      const dots = c.players.map(p => '<span class="pd" style="background:' + (p.here ? COLOURS[p.slot] : 'transparent') + ';border-color:' + COLOURS[p.slot] + '"></span>').join('');
      $('#roster').innerHTML = '<b>Crew</b>' + (c.players.length ? dots + ' ' + c.players.length + ' of 4' : 'nobody yet') + ' · isle ' + (c.isle + 1) + ', ' + c.name + ' <span style="font-family:var(--kai);font-size:1.3em">' + c.want + '</span>';
      // a phone may change them too (☰): the board follows
      if (c.knock !== st.knock || c.profile !== st.profile) { st.knock = c.knock; st.profile = c.profile; render(); }
    }).catch(() => { $('#roster').innerHTML = '<b>Crew</b><span class="warn">this server has no crew</span>'; });
  }
  chips('#crew', 'crew', CREW);
  chips('#arts', 'art', ARTS);
  chips('#profiles', 'profile', PROFILES);
  chips('#knocks', 'knock', KNOCKS);
  render();
  if (st.crew === '1') tell();
  roster(); setInterval(roster, 2000);
  window.F2DBoard = { st, phoneURL };
})();
