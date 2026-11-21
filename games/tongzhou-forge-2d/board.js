// The board page (board.html; README.md, "The board"): a QR code for phones on the same Wi-Fi. The look and profile chosen
// here go into the phone link (?art= and ?profile=, which the game reads before its saved settings). One player per
// phone: there are no rooms yet, so the board shows no roster.
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
  const st = {
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
    if (st.isle) q.set('isle', st.isle);
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
    const q = new URLSearchParams(location.search); q.set('art', st.art); q.set('profile', st.profile);
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
      b.addEventListener('click', () => { st[k] = b.dataset.v; render(); });
      $(sel).appendChild(b);
    }
  }
  chips('#arts', 'art', ARTS);
  chips('#profiles', 'profile', PROFILES);
  render();
  window.F2DBoard = { st, phoneURL };
})();
