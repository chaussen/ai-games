/* teacher.js — read-only class dashboard. Signs in anonymously (same as the
   game pages), reads every roster student's Firestore doc, and renders their
   Forge + Scroll stats. Never writes anything. */
(function () {
  "use strict";
  var RANKS = [
    { lv:1, cn:'学童', en:'Schoolchild', min:0 },
    { lv:2, cn:'蒙生', en:'Pupil', min:80 },
    { lv:3, cn:'书生', en:'Scholar', min:180 },
    { lv:4, cn:'秀才', en:'Licentiate', min:300 },
    { lv:5, cn:'举人', en:'Provincial Graduate', min:460 },
    { lv:6, cn:'贡士', en:'Tribute Scholar', min:660 },
    { lv:7, cn:'进士', en:'Imperial Graduate', min:900 },
    { lv:8, cn:'状元', en:'Top Scholar', min:1200 }
  ];
  function rankFor(xp) { var r = RANKS[0]; for (var i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].min) r = RANKS[i]; return r; }

  function setStatus(msg, isErr) {
    var s = document.getElementById('status');
    s.textContent = msg;
    s.className = isErr ? 'err' : '';
  }

  function parseState(doc, key) {
    try { return JSON.parse((doc.state || {})[key] || 'null'); } catch (e) { return null; }
  }

  function fmtTime(updatedAt) {
    if (!updatedAt || !updatedAt.toDate) return '—';
    var d = updatedAt.toDate();
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function row(student, doc) {
    var forge = doc ? parseState(doc, 'ccs-forgegame-v2') : null;
    var scroll = doc ? parseState(doc, 'ccs-scroll-v1') : null;
    var cleared = scroll && scroll.cleared ? Object.keys(scroll.cleared).length : 0;
    var xp = scroll && typeof scroll.xp === 'number' ? scroll.xp : 0;
    var rank = rankFor(xp);
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="name">' + student.name + '</td>' +
      '<td>' + (forge ? (forge.owned || []).length : '—') + '</td>' +
      '<td>' + (forge ? (forge.best || 0) : '—') + '</td>' +
      '<td>' + (forge ? (forge.runs || 0) : '—') + '</td>' +
      '<td>' + (doc ? '<span class="pill">' + rank.cn + ' · ' + rank.en + '</span>' : '<span class="stale">not started</span>') + '</td>' +
      '<td>' + xp + '</td>' +
      '<td>' + cleared + '</td>' +
      '<td class="stale">' + (doc ? fmtTime(doc.updatedAt) : '—') + '</td>';
    return tr;
  }

  function init() {
    if (!window.firebase || !window.CCS_FIREBASE_CONFIG || window.CCS_FIREBASE_CONFIG.apiKey === 'PASTE_ME') {
      setStatus('Firebase isn’t configured yet — fill in journey/firebase-config.js first.', true);
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(window.CCS_FIREBASE_CONFIG);
    var db = firebase.firestore();

    firebase.auth().signInAnonymously().then(function () {
      return fetch('assets/data/roster.json').then(function (r) { return r.json(); });
    }).then(function (roster) {
      return Promise.all(roster.map(function (s) {
        return db.collection('students').doc(s.id).get().then(function (snap) {
          return { student: s, doc: snap.exists ? snap.data() : null };
        });
      })).then(function (results) {
        var tbody = document.getElementById('tbody');
        results.forEach(function (r) { tbody.appendChild(row(r.student, r.doc)); });
        document.getElementById('tbl').style.display = '';
        setStatus(results.length + ' students · refreshed ' + new Date().toLocaleTimeString());
      });
    }).catch(function (e) {
      console.error(e);
      setStatus('Could not load class data: ' + (e.message || e), true);
    });
  }

  init();
})();
