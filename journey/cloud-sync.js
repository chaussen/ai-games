/* cloud-sync.js — mirrors the three game-progress localStorage keys to
   Firestore, keyed by a student chosen once per device from the class
   roster. The three engines (forge.js, scroll.js, forge-game.js) wait on
   CloudSync.ready before they load/init, so cloud state (if newer) is in
   localStorage before each engine's own load() runs.

   Falls back to local-only silently if journey/firebase-config.js hasn't
   been filled in yet or the Firebase SDK isn't loaded. */
(function () {
  "use strict";
  var KEYS = ['ccs-forgegame-v2', 'ccs-forge-v1', 'ccs-scroll-v1'];
  var STUDENT_KEY = 'ccs-student-id';
  var META_KEY = 'ccs-cloud-meta-v1';
  var POLL_MS = 5000;

  function readJSON(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function snapshot() { var s = {}; KEYS.forEach(function (k) { var v = localStorage.getItem(k); if (v != null) s[k] = v; }); return s; }

  var meta = readJSON(META_KEY) || { lastLocalChangeMs: 0 };
  function saveMeta() { writeJSON(META_KEY, meta); }

  var db, docRef;
  var lastSnapshotStr = JSON.stringify(snapshot());

  function ensureFirebase() {
    if (!window.firebase || !window.CCS_FIREBASE_CONFIG || window.CCS_FIREBASE_CONFIG.apiKey === 'PASTE_ME') return false;
    if (!firebase.apps.length) firebase.initializeApp(window.CCS_FIREBASE_CONFIG);
    db = firebase.firestore();
    return true;
  }

  // ---------- student picker ----------
  function pickStudent(roster) {
    return new Promise(function (resolve) {
      var existing = localStorage.getItem(STUDENT_KEY);
      if (existing && roster.some(function (s) { return s.id === existing; })) { resolve(existing); return; }
      var ov = document.createElement('div');
      ov.id = 'ccs-student-picker';
      ov.style.cssText = 'position:fixed;inset:0;background:#1c1410f0;z-index:99999;display:flex;' +
        'align-items:center;justify-content:center;font-family:system-ui,sans-serif;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#fffaf2;border-radius:16px;padding:28px 24px;max-width:420px;' +
        'width:90%;text-align:center;box-shadow:0 12px 40px #0006;';
      box.innerHTML = '<h2 style="margin:0 0 6px;font-size:20px;color:#2b2017;">Who’s playing?</h2>' +
        '<p style="margin:0 0 16px;font-size:14px;color:#7a6a58;">Pick your name so your progress saves.</p>';
      var list = document.createElement('div');
      list.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
      roster.forEach(function (s) {
        var b = document.createElement('button');
        b.textContent = s.name;
        b.style.cssText = 'padding:12px 8px;border-radius:10px;border:1px solid #e0d3c0;background:#fff;' +
          'font-size:15px;cursor:pointer;color:#2b2017;';
        b.addEventListener('click', function () {
          localStorage.setItem(STUDENT_KEY, s.id);
          ov.remove();
          resolve(s.id);
        });
        list.appendChild(b);
      });
      box.appendChild(list);
      ov.appendChild(box);
      document.body.appendChild(ov);
    });
  }

  function addSwitchStudentLink() {
    var b = document.createElement('button');
    b.textContent = 'Switch student';
    b.style.cssText = 'position:fixed;bottom:6px;right:6px;z-index:9998;font-size:11px;opacity:.4;' +
      'background:none;border:none;color:inherit;cursor:pointer;padding:4px 6px;';
    b.addEventListener('click', function () {
      localStorage.removeItem(STUDENT_KEY);
      location.reload();
    });
    document.body.appendChild(b);
  }

  // ---------- sync ----------
  function pushToCloud(studentName) {
    if (!docRef) return;
    docRef.set({
      name: studentName,
      state: snapshot(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function (e) { console.warn('[CloudSync] push failed', e); });
  }

  function applyCloudState(state) {
    KEYS.forEach(function (k) {
      if (state && state[k] != null) localStorage.setItem(k, state[k]);
    });
  }

  function startPolling(studentName) {
    setInterval(function () {
      var cur = JSON.stringify(snapshot());
      if (cur !== lastSnapshotStr) {
        lastSnapshotStr = cur;
        meta.lastLocalChangeMs = Date.now();
        saveMeta();
        pushToCloud(studentName);
      }
    }, POLL_MS);
    window.addEventListener('pagehide', function () {
      var cur = JSON.stringify(snapshot());
      if (cur !== lastSnapshotStr) pushToCloud(studentName);
    });
  }

  function init() {
    if (!ensureFirebase()) return Promise.resolve();
    return fetch('assets/data/roster.json').then(function (r) { return r.json(); }).then(function (roster) {
      return pickStudent(roster).then(function (id) {
        var entry = roster.filter(function (s) { return s.id === id; })[0];
        var studentName = entry ? entry.name : id;
        docRef = db.collection('students').doc(id);
        addSwitchStudentLink();
        return firebase.auth().signInAnonymously().then(function () { return docRef.get(); }).then(function (doc) {
          if (!doc.exists) {
            pushToCloud(studentName);
          } else {
            var data = doc.data();
            var cloudMs = data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0;
            if (cloudMs > meta.lastLocalChangeMs) {
              applyCloudState(data.state);
              meta.lastLocalChangeMs = cloudMs;
              saveMeta();
              lastSnapshotStr = JSON.stringify(snapshot());
            } else {
              pushToCloud(studentName);
            }
          }
          startPolling(studentName);
        });
      });
    }).catch(function (e) {
      console.warn('[CloudSync] init failed, running local-only', e);
    });
  }

  window.CloudSync = { ready: init() };
})();
