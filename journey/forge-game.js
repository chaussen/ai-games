/* forge-game.js — 炼字坊 · The Forge
   ContentService → Scheduler → ForgeEngine → Renderer
   PREVIEW → FORGE → REVEAL state machine per round.
   Book-independent: reads characters.json + playlists.
   Vanilla JS, IIFE. Stroke data from makemeahanzi. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ================================================================
     CONFIG & DEFAULTS
     ================================================================ */
  var LS_KEY = 'ccs-forgegame-v2';
  var DEFAULT_SETTINGS = {
    previewMs: 3000,
    cueLevel: 'normal',    // normal | easy | hard
    difficulty: 'normal',  // easy | normal | hard | expert
    sound: true,
    hints: true,
    hskMax: 3              // MVP scope: forge through HSK 1–3 endlessly
  };
  var ROUNDS_PER_RUN = 4;
  var DIFFICULTY = {
    easy:    { previewMs: 5000, ghost: true,  strokeNums: 'first', decoyCount: 1, heatRate: 0.35, soundDecoy: 'diffSyllable' },
    normal:  { previewMs: 3000, ghost: false, strokeNums: 'crack2', decoyCount: 3, heatRate: 0.55, soundDecoy: 'diffSyllable' },
    hard:    { previewMs: 1500, ghost: false, strokeNums: 'crack3', decoyCount: 5, heatRate: 0.80, soundDecoy: 'toneVariant' },
    expert:  { previewMs: 0,    ghost: false, strokeNums: 'never',  decoyCount: 7, heatRate: 1.00, soundDecoy: 'toneVariant' }
  };

  /* ================================================================
     DATA STORES (populated by ContentService.load)
     ================================================================ */
  var characters = {};   // characters.json
  var components = {};   // components.json
  var strokeData = {};   // stroke-data.json
  var playlists = {};    // playlist name → { id, chars[] }
  var allLessons = [];   // array of lesson objects
  var dataLoaded = false;

  /* ================================================================
     PERSISTENCE
     ================================================================ */
  var progress;
  function loadProgress() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      progress = raw ? JSON.parse(raw) : null;
    } catch(e) { progress = null; }
    if (!progress || !progress.owned) {
      progress = {
        owned: [],
        mastery: {},
        best: 0,
        runs: 0,
        settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
      };
    }
    // ensure settings keys exist
    for (var k in DEFAULT_SETTINGS) {
      if (!(k in progress.settings)) progress.settings[k] = DEFAULT_SETTINGS[k];
    }
  }
  function saveProgress() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch(e) {}
  }
  function isOwned(ch) { return progress.owned.indexOf(ch) >= 0; }
  function markOwned(ch) {
    if (progress.owned.indexOf(ch) < 0) { progress.owned.push(ch); }
    progress.mastery[ch] = Math.min(3, (progress.mastery[ch] || 0) + 1);
    saveProgress();
  }
  function getSettings() { return progress.settings; }

  /** Count of forgeable curriculum chars within the current HSK scope, and how
   *  many have been forged. Used for the endless-mode progress readout. */
  function scopeProgress() {
    var hskMax = (progress.settings && progress.settings.hskMax) || 0;
    var total = 0, done = 0;
    for (var ch in characters) {
      var e = characters[ch];
      if (!e || !e.hsk) continue;                       // skip pure components
      if (hskMax && e.hsk > hskMax) continue;
      if (e.grain === 'stroke' && !strokeData[ch]) continue;
      if (!strokeData[ch] && !e.treatAsAtom) continue;
      total++;
      if (isOwned(ch)) done++;
    }
    return { done: done, total: total, hskMax: hskMax };
  }

  /* ================================================================
     CONTENT SERVICE — load & index graph data
     ================================================================ */
  var ContentService = {
    load: function () {
      return Promise.all([
        fetch('assets/data/characters.json').then(function(r){ return r.json(); }),
        fetch('assets/data/components.json').then(function(r){ return r.json(); }),
        fetch('assets/data/stroke-data.json').then(function(r){ return r.json(); }),
        fetch('assets/data/playlists/all-lessons.json').then(function(r){ return r.json(); })
      ]).then(function (results) {
        characters = results[0];
        components = results[1];
        strokeData = results[2];
        allLessons = results[3] || [];
        // Index playlists
        playlists = {};
        for (var i = 0; i < allLessons.length; i++) {
          var L = allLessons[i];
          playlists[L.id] = L;
        }
        dataLoaded = true;
        return { characters: characters, components: components, lessons: allLessons };
      }).catch(function (err) {
        console.error('ContentService load failed:', err);
        throw err;
      });
    },

    getCharacter: function (ch) { return characters[ch] || null; },
    getComponent: function (ch) { return components[ch] || null; },
    hasStrokes: function (ch) { return strokeData[ch] !== undefined; },

    /** Return all characters that can be forged (have stroke data or are atoms) */
    getForgableChars: function () {
      var result = [];
      for (var ch in characters) {
        if (strokeData[ch] || characters[ch].treatAsAtom) {
          result.push(ch);
        }
      }
      return result;
    }
  };

  /* ================================================================
     SCHEDULER — availability by ownership, order by depth+frequency
     ================================================================ */
  var Scheduler = {
    /** Which characters are available right now?
     *  Lenient mode: also includes chars whose components are known in the library
     *  (even if not yet owned) — warmupAtoms() will insert the missing atoms first. */
    available: function (filterPlaylist, hskMax) {
      var avail = [];
      var chars = filterPlaylist
        ? (playlists[filterPlaylist] ? playlists[filterPlaylist].allChars || playlists[filterPlaylist].writeChars || [] : filterPlaylist)
        : Object.keys(characters);

      // If a playlist name was given, resolve it
      if (typeof filterPlaylist === 'string' && playlists[filterPlaylist]) {
        chars = playlists[filterPlaylist].allChars || playlists[filterPlaylist].writeChars || [];
      }

      for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        var entry = characters[ch];
        if (!entry) continue;
        // Scope to the curriculum band (e.g. HSK 1–3). Components pulled in as
        // warm-up atoms are allowed through even if hsk is 0/out of band.
        if (hskMax && entry.hsk && entry.hsk > hskMax) continue;
        // Must have stroke data to forge (stroke grain) or known parts (parts grain)
        if (!strokeData[ch] && !entry.treatAsAtom) continue;
        if (entry.grain === 'stroke' && !strokeData[ch]) continue;
        // Check all components are known in the library (they will be
        // auto-introduced as warm-up atoms if not yet owned)
        var comps = entry.components || [];
        var allKnown = true;
        for (var j = 0; j < comps.length; j++) {
          var c = comps[j].char;
          // Component must exist in our library (or be the character itself)
          if (c !== ch && !characters[c]) { allKnown = false; break; }
        }
        if (allKnown && entry.hasStrokeData !== false) avail.push(entry);
      }
      // Sort by depth, then frequencyRank
      avail.sort(function (a, b) {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return (a.frequencyRank || 9999) - (b.frequencyRank || 9999);
      });
      return avail;
    },

    /** Pick N rounds from available chars, ensuring grain variety.
     *  Endless progression: characters not yet forged ("owned") come first, so
     *  each run advances through the pool; once everything is owned we fall back
     *  to the full pool for review. */
    pickRounds: function (n, filterPlaylist, hskMax) {
      var all = this.available(filterPlaylist, hskMax);
      if (all.length === 0) return [];

      var fresh = all.filter(function (e) { return !isOwned(e.char); });
      var avail = fresh.length ? fresh : all;

      // Try to pick a mix of grains
      var byGrain = { stroke: [], component: [], radical: [] };
      for (var i = 0; i < avail.length; i++) {
        var g = avail[i].grain || 'stroke';
        if (byGrain[g]) byGrain[g].push(avail[i]);
        else byGrain.stroke.push(avail[i]);
      }

      var rounds = [];
      var used = {};

      // Pick up to n, cycling through grains
      var grainOrder = ['stroke', 'component', 'radical'];
      var gi = 0;
      while (rounds.length < n) {
        var grain = grainOrder[gi % 3];
        var pool = byGrain[grain] || [];
        var picked = null;
        for (var j = 0; j < pool.length; j++) {
          if (!used[pool[j].char]) { picked = pool[j]; used[pool[j].char] = true; break; }
        }
        if (!picked) {
          // Fall back to any grain
          for (var k = 0; k < avail.length; k++) {
            if (!used[avail[k].char]) { picked = avail[k]; used[avail[k].char] = true; break; }
          }
        }
        if (picked) rounds.push(picked);
        else break; // no more unique chars
        gi++;
      }
      return rounds;
    },

    /** Ensure atoms are introduced before composites: auto-insert warm-up rounds */
    warmupAtoms: function (rounds) {
      var needed = [];
      var seen = {};
      for (var i = 0; i < rounds.length; i++) { seen[rounds[i].char] = true; }
      for (var i = 0; i < rounds.length; i++) {
        var comps = rounds[i].components || [];
        for (var j = 0; j < comps.length; j++) {
          var c = comps[j].char;
          if (!isOwned(c) && !seen[c] && characters[c] && (strokeData[c] || characters[c].treatAsAtom)) {
            needed.push(characters[c]);
            seen[c] = true;
          }
        }
      }
      // Insert warm-up atoms before the rounds that need them
      var result = [];
      for (var i = 0; i < needed.length; i++) {
        var atom = needed[i];
        atom._warmup = true;
        result.push(atom);
      }
      return result.concat(rounds);
    }
  };

  /* ================================================================
     DECOY GENERATOR — from graph data
     ================================================================ */
  var DecoyGenerator = {
    /** Generate decoy pool for a parts round */
    forPartsRound: function (entry, diff) {
      var comps = entry.components || [];
      var slots = [];
      var pool = [];

      // Build slots from components
      for (var i = 0; i < comps.length; i++) {
        var c = comps[i];
        var type = c.role === 'phonetic' ? 'sound' : 'meaning';
        slots.push({ type: type, label: type === 'sound' ? '声 sound' : '义 meaning' });
        pool.push({
          ch: c.char,
          correct: true,
          slot: i,
          type: type,
          pinyin: c.pinyin || (characters[c.char] ? characters[c.char].pinyin : ''),
          meaning: components[c.char] ? components[c.char].meaning : (characters[c.char] ? characters[c.char].meaning : '')
        });
      }

      // Generate decoys
      var hints = entry.hints || {};
      var visuallySimilar = hints.visuallySimilar || [];
      var semanticallyAdjacent = hints.semanticallyAdjacent || [];

      // Visual decoys for meaning slots
      for (var vi = 0; vi < Math.min(diff.decoyCount, visuallySimilar.length); vi++) {
        var vch = visuallySimilar[vi];
        if (vch && characters[vch] && pool.every(function(p){ return p.ch !== vch; })) {
          pool.push({
            ch: vch,
            correct: false,
            type: 'meaning',
            pinyin: characters[vch].pinyin || '',
            meaning: characters[vch].meaning || ''
          });
        }
      }

      // Semantic decoys
      for (var si = 0; si < Math.min(2, semanticallyAdjacent.length); si++) {
        var sch = semanticallyAdjacent[si];
        if (sch && characters[sch] && pool.every(function(p){ return p.ch !== sch; })) {
          pool.push({
            ch: sch,
            correct: false,
            type: 'meaning',
            pinyin: characters[sch].pinyin || '',
            meaning: characters[sch].meaning || ''
          });
        }
      }

      // Sound decoys: find characters with same type (phonetic) components
      if (slots.some(function(s){ return s.type === 'sound'; })) {
        var targetPinyin = entry.pinyin || '';
        var targetSyllable = targetPinyin.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, function(m){
          return 'aeiou'['āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'.indexOf(m) / 4 | 0] || m;
        }).replace(/[1-5]/g,'');

        // Find other radical-forge chars with different pinyin
        var soundDecoys = [];
        for (var chKey in characters) {
          var ce = characters[chKey];
          if (ce.grain === 'radical' && ce.char !== entry.char && soundDecoys.length < 4) {
            var cp = ce.pinyin || '';
            if (cp !== entry.pinyin && pool.every(function(p){ return p.ch !== ce.char; })) {
              soundDecoys.push({
                ch: ce.char,
                correct: false,
                type: 'sound',
                pinyin: cp,
                meaning: ce.meaning || ''
              });
            }
          }
        }
        // Pad with random phonetic-component chars
        for (var chKey2 in characters) {
          if (soundDecoys.length >= diff.decoyCount + 1) break;
          var ce2 = characters[chKey2];
          var comps2 = ce2.components || [];
          var hasPhon = comps2.some(function(c){ return c.role === 'phonetic'; });
          if (hasPhon && ce2.char !== entry.char && pool.every(function(p){ return p.ch !== ce2.char; })) {
            soundDecoys.push({
              ch: ce2.char,
              correct: false,
              type: 'sound',
              pinyin: ce2.pinyin || '',
              meaning: ce2.meaning || ''
            });
          }
        }
        pool = pool.concat(soundDecoys.slice(0, diff.decoyCount));
      }

      // Shuffle pool
      for (var a = pool.length - 1; a > 0; a--) {
        var b = Math.floor(Math.random() * (a + 1));
        var t = pool[a]; pool[a] = pool[b]; pool[b] = t;
      }

      return { slots: slots, pool: pool };
    }
  };

  /* ================================================================
     FORGE ENGINE — PREVIEW → FORGE → REVEAL
     ================================================================ */
  var G; // live run state
  function newRunState() {
    return {
      rounds: [],         // resolved round objects
      roundIdx: 0,
      phase: 'idle',      // idle | preview | forge | reveal | finish
      score: 0,
      combo: 0,
      maxCombo: 0,
      cracks: 0,
      roundCracks: 0,
      heat: 100,
      stars: [],
      forged: [],
      heatTimer: null,
      previewTimer: null,
      countdownRemaining: 0,
      hintLevel: 0,       // 0=none, 1=after 2 cracks, 2=after 4 cracks (reveal answer)
      strokeNext: 0,
      strokeOrder: [],
      slotFill: [],
      done: false,
      speedBonus: 0
    };
  }

  /* ---------- heat ---------- */
  function startHeat() {
    var diff = DIFFICULTY[progress.settings.difficulty] || DIFFICULTY.normal;
    G.heat = 100;
    stopHeat();
    G.heatTimer = setInterval(function () {
      if (G.done || G.phase !== 'forge') return;
      G.heat = Math.max(0, G.heat - diff.heatRate);
      updateHeatUI();
    }, 90);
  }
  function stopHeat() {
    if (G && G.heatTimer) { clearInterval(G.heatTimer); G.heatTimer = null; }
  }
  function heatZone() { return G.heat > 62 ? 'hot' : G.heat > 26 ? 'warm' : 'cool'; }
  function starsFromHeat() {
    var s = G.heat > 62 ? 3 : G.heat > 26 ? 2 : 1;
    s -= Math.min(2, Math.floor(G.roundCracks / 2));
    return Math.max(1, s);
  }

  /* ---------- scoring ---------- */
  function crack() {
    G.combo = 0; G.roundCracks++; G.cracks++;
    G.heat = Math.max(4, G.heat - 14);
    updateHeatUI();
    shake();
    // Check hint thresholds
    if (G.roundCracks >= 4) G.hintLevel = 2;
    else if (G.roundCracks >= 2) G.hintLevel = 1;
  }
  function reward(base) {
    G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
    var pts = base * Math.max(1, G.combo);
    G.score += pts;
    updateScoreUI();
    return pts;
  }

  /* ---------- phase: PREVIEW ---------- */
  function startPreview(round) {
    G.phase = 'preview';
    G.done = false;
    G.roundCracks = 0;
    G.hintLevel = 0;
    G.strokeNext = 0;
    G.strokeOrder = [];
    G.slotFill = (round._slots || []).map(function () { return null; });
    G.speedBonus = 0;
    G.combo = 0;

    var settings = progress.settings;
    var previewMs = settings.previewMs;
    if (previewMs === 0) { startForge(round); return; }

    renderPreview(round);
    G.countdownRemaining = previewMs;
    var startTime = Date.now();
    G.previewTimer = setInterval(function () {
      var elapsed = Date.now() - startTime;
      G.countdownRemaining = Math.max(0, previewMs - elapsed);
      updateCountdownUI();
      if (G.countdownRemaining <= 0) {
        clearInterval(G.previewTimer);
        G.previewTimer = null;
        startForge(round);
      }
    }, 50);
  }

  function skipPreview(round) {
    if (G.phase !== 'preview') return;
    if (G.previewTimer) { clearInterval(G.previewTimer); G.previewTimer = null; }
    G.speedBonus = Math.floor(G.countdownRemaining / 100); // up to ~30 pts
    startForge(round);
  }

  /* ---------- phase: FORGE ---------- */
  function startForge(round) {
    G.phase = 'forge';
    G.done = false;
    var diff = DIFFICULTY[progress.settings.difficulty] || DIFFICULTY.normal;

    applyRoundAccent(round);

    if (round.grain === 'stroke') {
      renderStrokeForge(round, diff);
    } else {
      renderPartsForge(round, diff);
    }
    startHeat();
    updateHeatUI();
    updateScoreUI();
  }

  /* ---------- phase: REVEAL ---------- */
  function winRound(round) {
    G.done = true;
    G.phase = 'reveal';
    stopHeat();
    var stars = starsFromHeat();
    G.stars[G.roundIdx] = stars;
    if (G.forged.indexOf(round.char) < 0) G.forged.push(round.char);
    markOwned(round.char);
    var timeBonus = Math.round(G.heat);
    G.score += timeBonus + stars * 40 + G.speedBonus;
    updateScoreUI();
    renderRail();
    if (progress.settings.sound) speak(round.char);
    showRevealOverlay(round, stars, timeBonus);
  }

  /* ---------- run finish ---------- */
  function finishRun() {
    G.phase = 'finish';
    stopHeat();
    progress.runs = (progress.runs || 0) + 1;
    progress.best = Math.max(progress.best || 0, G.score);
    saveProgress();
    showFinishOverlay();
  }

  /* ================================================================
     RENDERER
     ================================================================ */

  /* ---------- colour palette (from stroke-cell.js) ---------- */
  function strokePalette(n) {
    var o = [];
    for (var i = 0; i < n; i++) {
      var t = n <= 1 ? 0 : i / (n - 1);
      o.push('hsl(' + (8 + t * 282).toFixed(1) + ' 70% 45%)');
    }
    return o;
  }

  /* ---------- SVG helpers ---------- */
  function tianziGrid() {
    return '<rect x="6" y="6" width="1012" height="1012" rx="14" fill="none" stroke="#EFDDD5" stroke-width="6"/>' +
      '<line x1="512" y1="6" x2="512" y2="1018" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>' +
      '<line x1="6" y1="512" x2="1018" y2="512" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>';
  }

  function ghostSVG(ch) {
    var d = strokeData[ch];
    if (!d) return '';
    var paths = d.s.map(function (p) { return '<path d="' + p + '" fill="#E7D9D0"/>'; }).join('');
    return tianziGrid() + '<g transform="translate(0,900) scale(1,-1)">' + paths + '</g>';
  }

  function strokePathColored(ch, i, col) {
    var d = strokeData[ch];
    if (!d) return '';
    return '<g transform="translate(0,900) scale(1,-1)"><path d="' + d.s[i] + '" fill="' + col + '"/></g>';
  }

  function strokePieceSVG(ch, i, col) {
    var d = strokeData[ch];
    if (!d) return '';
    return '<svg viewBox="0 0 1024 1024" class="sp-svg"><g transform="translate(0,900) scale(1,-1)"><path d="' + d.s[i] + '" fill="' + col + '"/></g></svg>';
  }

  /* ---------- accent ---------- */
  function applyRoundAccent(round) {
    var grainAccents = {
      stroke:    { accent: '#C2603A', soft: '#F0C9B4', tint: '#FBEAE0', cat: '象形', catEn: 'Pictograph' },
      component: { accent: '#2F7DA6', soft: '#BBD7E6', tint: '#E3EFF4', cat: '会意', catEn: 'Compound idea' },
      radical:   { accent: '#7E4B86', soft: '#D8C4DB', tint: '#F1E8F2', cat: '形声', catEn: 'Sound + meaning' }
    };
    var g = grainAccents[round.grain] || grainAccents.stroke;
    var s = document.documentElement.style;
    s.setProperty('--rc', g.accent);
    s.setProperty('--rc-soft', g.soft);
    s.setProperty('--rc-tint', g.tint);
    round._accent = g;
  }

  /* ---------- HUD ---------- */
  function updateHeatUI() {
    var f = $('#heatfill'); if (f) { f.style.width = G.heat + '%'; }
    var hw = $('#heatwrap'); if (hw) { hw.className = 'heatwrap ' + heatZone(); }
    var z = $('#heatzone'); if (z) { z.textContent = heatZone() === 'hot' ? 'HOT' : heatZone() === 'warm' ? 'WARM' : 'COOL'; }
  }
  function updateScoreUI() {
    var sv = $('#scorev'); if (sv) sv.textContent = G.score;
    var cv = $('#combov'); if (cv) {
      cv.textContent = '×' + Math.max(1, G.combo);
      cv.parentNode.className = 'combo' + (G.combo > 1 ? ' on' : '');
    }
  }
  function updateProgressUI() {
    var p = scopeProgress();
    var fv = $('#forgedv'); if (fv) fv.textContent = p.done + '/' + p.total;
    var fl = $('#forgedlbl'); if (fl) fl.textContent = p.hskMax ? ('HSK 1–' + p.hskMax) : 'forged';
  }
  function updateCountdownUI() {
    var ring = $('#countdown-ring'); if (!ring) return;
    var settings = progress.settings;
    var total = settings.previewMs || 3000;
    var pct = Math.max(0, G.countdownRemaining / total);
    var circumference = 2 * Math.PI * 24;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference * (1 - pct);
    var txt = $('#countdown-txt'); if (txt) txt.textContent = Math.ceil(G.countdownRemaining / 1000);
  }

  /* ---------- header + rail ---------- */
  function renderHeader() {
    var r = G.rounds[G.roundIdx];
    if (!r) return;
    var g = r._accent || { cat: '', catEn: '' };
    var grainLabel = r.grain === 'stroke' ? 'Stroke forge' : r.grain === 'component' ? 'Component forge' : 'Radical forge';
    $('#hud-cat').innerHTML = '<span class="zh">' + g.cat + '</span> · ' + g.catEn;
    $('#hud-round').textContent = 'Round ' + (G.roundIdx + 1) + ' / ' + G.rounds.length;
    $('#hud-grain').textContent = grainLabel;
    document.body.dataset.grain = r.grain;
  }
  function renderRail() {
    var el = $('#rail');
    if (!el) return;
    el.innerHTML = G.rounds.map(function (r, i) {
      var st = i < G.roundIdx ? 'done' : (i === G.roundIdx ? 'cur' : 'todo');
      var stars = G.stars[i];
      var sv = '';
      if (st === 'done') {
        for (var k = 0; k < 3; k++) sv += '<i class="' + (k < stars ? 'on' : '') + '">★</i>';
      }
      var accent = (r._accent || {}).accent || 'var(--rc)';
      var displayCh = (st === 'todo') ? '?' : r.char;
      return '<div class="railnode ' + st + '" style="--rc:' + accent + '"><span class="rn-ch zh">' + displayCh + '</span>' +
        '<span class="rn-grain">' + r.grain + '</span>' + (sv ? '<span class="rn-stars">' + sv + '</span>' : '') + '</div>';
    }).join('<span class="raillink"></span>');
  }

  /* ================================================================
     PREVIEW PHASE RENDERING
     ================================================================ */
  function renderPreview(round) {
    renderHeader();
    var cue = getCueText(round);
    var rd = G.roundIdx;
    var total = G.rounds.length;
    var c = G.countdownRemaining;

    $('#arena-head').innerHTML =
      '<div class="preview-stage">' +
        '<div class="pv-round-badge">Round ' + (rd + 1) + ' of ' + total + '</div>' +
        '<div class="pv-glyph-wrap">' +
          '<div class="pv-glyph zh">' + round.char + '</div>' +
          '<div class="pv-meta"><span class="pv-py">' + (round.pinyin || '') + '</span><span class="pv-en">' + (round.meaning || '') + '</span></div>' +
        '</div>' +
        '<div class="pv-cue">' + cue + '</div>' +
        '<div class="pv-countdown" id="pv-countdown" title="Tap to skip">' +
          '<svg class="pv-ring-svg" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--rc-soft)" stroke-width="3"/><circle id="countdown-ring" cx="28" cy="28" r="24" fill="none" stroke="var(--rc)" stroke-width="3" stroke-linecap="round" transform="rotate(-90 28 28)"/></svg>' +
          '<span class="pv-cd-num" id="countdown-txt">' + Math.ceil(c / 1000) + '</span>' +
        '</div>' +
        '<div class="pv-skip-hint">Tap to skip — speed bonus</div>' +
      '</div>';

    $('#arena').innerHTML = '';
    $('#arena-head').style.display = '';
    updateCountdownUI();

    // Tap in the preview area or countdown to skip
    var previewStage = $('.preview-stage');
    var skipHandler = function (e) {
      // Only skip if tapping the preview content, not the header/footer
      if (e.target.closest('.preview-stage') || e.target.closest('#arena-head')) {
        skipPreview(round);
      }
    };
    document.addEventListener('click', skipHandler, { once: true });
    // Countdown ring is always skippable too
    var cd = $('#pv-countdown');
    if (cd) cd.addEventListener('click', function (e) { e.stopPropagation(); skipPreview(round); });
  }

  function getCueText(round) {
    if (round._warmup) return 'Learn this building block — you\'ll use it to forge a bigger character next.';
    if (round.grain === 'stroke') return 'You\'ll forge this character stroke by stroke — from memory.';
    if (round.grain === 'component') return 'Pick the parts whose meanings combine to make this character.';
    return 'Pick the meaning radical and match the sound part.';
  }

  /* ================================================================
     STROKE FORGE RENDERING
     ================================================================ */
  function renderStrokeForge(round, diff) {
    renderHeader();
    var d = strokeData[round.char];
    if (!d) { $('#arena').innerHTML = '<div class="howto">No stroke data for ' + round.char + '</div>'; return; }

    var n = d.s.length;
    var cols = strokePalette(n);
    G.strokeOrder = [];
    for (var k = 0; k < n; k++) G.strokeOrder.push(k);
    G.strokeNext = 0;

    // Scramble tray
    var tray = G.strokeOrder.slice();
    for (var a = tray.length - 1; a > 0; a--) {
      var b = Math.floor(Math.random() * (a + 1));
      var t = tray[a]; tray[a] = tray[b]; tray[b] = t;
    }

    var showGhost = diff.ghost;
    var showNums = diff.strokeNums === 'first' ||
      (diff.strokeNums === 'crack2' && G.hintLevel >= 1) ||
      (diff.strokeNums === 'crack3' && G.hintLevel >= 1) ||
      (diff.strokeNums === 'never' && false);

    var canvasHTML = '<svg class="charcanvas" id="charcanvas" viewBox="0 0 1024 1024">' +
      (showGhost ? ghostSVG(round.char) : tianziGrid()) + '</svg>';

    var piecesHTML = tray.map(function (i) {
      return '<button class="spiece" data-i="' + i + '">' +
        strokePieceSVG(round.char, i, cols[i]) +
        (showNums ? '<span class="sp-num">' + (i + 1) + '</span>' : '') +
        '</button>';
    }).join('');

    // Hint-level: after crack2, show next stroke number
    var howtoText = 'Tap the strokes in <b>writing order</b> — from memory.';
    if (G.hintLevel >= 1 && G.strokeNext < n) {
      howtoText = 'Hint: next stroke is <b>#' + (G.strokeOrder[G.strokeNext] + 1) + '</b>.';
    }
    if (G.hintLevel >= 2 && G.strokeNext < n) {
      // Reveal: highlight the correct piece
      howtoText = 'Answer: tap stroke <b>#' + (G.strokeOrder[G.strokeNext] + 1) + '</b>.';
    }

    $('#arena').innerHTML =
      '<div class="stroke-stage">' +
        '<div class="canvaswrap">' + canvasHTML + '</div>' +
        '<div class="tray" id="tray">' + piecesHTML + '</div>' +
      '</div>' +
      '<div class="howto" id="howto">' + howtoText + '</div>';

    // Show minimal cue (not the full char)
    $('#arena-head').innerHTML =
      '<div class="forge-cue">' +
        '<span class="fc-grain-badge" style="background:var(--rc-tint);border:1px solid var(--rc-soft);color:var(--rc);padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;">Stroke forge</span>' +
        '<span class="fc-prompt">Write the character from memory</span>' +
      '</div>';

    // Wire tap handlers
    $$('#tray .spiece').forEach(function (b) {
      b.addEventListener('click', function () { tapStroke(round, +b.dataset.i, b, cols, diff); });
    });
  }

  function tapStroke(round, i, btn, cols, diff) {
    if (G.done || G.phase !== 'forge') return;
    if (i === G.strokeOrder[G.strokeNext]) {
      // Correct
      $('#charcanvas').insertAdjacentHTML('beforeend', strokePathColored(round.char, i, cols[i]));
      btn.classList.add('used'); btn.disabled = true;
      G.strokeNext++;
      reward(20);
      if (G.strokeNext >= G.strokeOrder.length) {
        winRound(round);
      } else {
        // Update howto if in hint mode
        var ht = $('#howto');
        if (ht && G.hintLevel >= 1) {
          ht.innerHTML = 'Hint: next stroke is <b>#' + (G.strokeOrder[G.strokeNext] + 1) + '</b>.';
        }
      }
    } else {
      crack();
      btn.classList.add('rej');
      setTimeout(function () { btn.classList.remove('rej'); }, 360);
      var h = $('#howto');
      if (h) {
        if (G.hintLevel >= 2) {
          h.innerHTML = 'Answer: tap stroke <b>#' + (G.strokeOrder[G.strokeNext] + 1) + '</b>.';
        } else if (G.hintLevel >= 1) {
          h.innerHTML = 'Not next — find stroke <b>#' + (G.strokeOrder[G.strokeNext] + 1) + '</b>.';
        } else {
          h.innerHTML = 'Wrong stroke. Think about the <b>writing order</b>.';
        }
      }
    }
  }

  /* ================================================================
     PARTS (COMPONENT / RADICAL) FORGE RENDERING
     ================================================================ */
  function renderPartsForge(round, diff) {
    renderHeader();

    var slots = round._slots || [];
    var pool = round._pool || [];

    var showNumbers = diff.strokeNums === 'first' ||
      (diff.strokeNums === 'crack2' && G.hintLevel >= 1) ||
      (diff.strokeNums === 'crack3' && G.hintLevel >= 1);

    // Build slots HTML
    var slotsHTML = slots.map(function (s, i) {
      var filled = G.slotFill[i];
      return '<div class="slot' + (filled ? ' filled' : '') + '" data-s="' + i + '" data-type="' + s.type + '">' +
        (filled
          ? '<span class="slot-ch zh">' + filled + '</span><span class="slot-tag">' + (s.type === 'sound' ? '声' : '义') + '</span>'
          : '<span class="slot-lbl zh">' + s.label + '</span>') +
        '</div>';
    }).join('<span class="slot-plus">＋</span>');

    // Build pool cards
    var cardsHTML = pool.map(function (p, idx) {
      var py = p.pinyin ? '<span class="pc-py">' + p.pinyin + '</span>' : '';
      var meaningReveal = (G.hintLevel >= 1 && p.correct) || G.hintLevel >= 2;
      var mn = meaningReveal && p.meaning ? '<span class="pc-mn">' + p.meaning + '</span>' : '';
      return '<button class="pcard" data-ch="' + p.ch + '" data-correct="' + (p.correct ? 1 : 0) +
        '" data-slot="' + (p.slot != null ? p.slot : '') + '" data-type="' + (p.type || 'meaning') + '">' +
        '<span class="pc-ch zh">' + p.ch + '</span>' + py + mn + '</button>';
    }).join('');

    // Cue text per grain
    var cueEn = '';
    var cuePy = '';
    if (round.grain === 'component') {
      cueEn = round.meaning || '';
    } else if (round.grain === 'radical') {
      cueEn = round.meaning || '';
      cuePy = round.pinyin || '';
    }
    // Show progress at top
    var progressLabel = 'Parts remaining: <b>' + slots.filter(function (s, i) { return !G.slotFill[i]; }).length + '</b>';
    if (G.hintLevel >= 2) {
      // Reveal correct answers
      progressLabel = 'All answers revealed — tap any highlighted card.';
    }

    // During FORGE, the target glyph is "?" in the equation
    var eqHTML = round.grain === 'component'
      ? '<span class="eq-label">=</span><span class="eq-target target-hidden">?</span>'
      : '<span class="eq-label">=</span><span class="eq-target target-hidden">?</span>';

    $('#arena-head').innerHTML =
      '<div class="forge-cue">' +
        '<span class="fc-grain-badge" style="background:var(--rc-tint);border:1px solid var(--rc-soft);color:var(--rc);padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;">' +
          (round.grain === 'component' ? 'Component forge' : 'Radical forge') + '</span>' +
        (cueEn ? '<span class="fc-meaning">' + cueEn + '</span>' : '') +
        (cuePy ? '<span class="fc-pinyin">' + cuePy + '</span>' : '') +
      '</div>';

    $('#arena').innerHTML =
      '<div class="parts-stage">' +
        '<div class="anvil2">' + slotsHTML + eqHTML + '</div>' +
        '<div class="pool" id="pool">' + cardsHTML + '</div>' +
      '</div>' +
      '<div class="howto" id="howto">' + progressLabel + '</div>';

    // Wire tap handlers
    $$('#pool .pcard').forEach(function (b) {
      b.addEventListener('click', function () { tapPart(round, b, diff); });
    });

    // If hint level 2, highlight correct cards
    if (G.hintLevel >= 2) {
      $$('#pool .pcard[data-correct="1"]').forEach(function (b) {
        b.classList.add('hint-glow');
      });
    }
    // If hint level 1, dim wrong cards (after 2 cracks)
    if (G.hintLevel >= 1) {
      $$('#pool .pcard[data-correct="0"]').forEach(function (b) {
        b.style.opacity = '0.45';
      });
    }
  }

  function tapPart(round, btn, diff) {
    if (G.done || G.phase !== 'forge' || btn.disabled) return;
    var correct = btn.dataset.correct === '1';
    if (correct) {
      var slotIdx = +btn.dataset.slot;
      if (G.slotFill[slotIdx]) return;
      G.slotFill[slotIdx] = btn.dataset.ch;

      // Update slot UI
      var slot = $('.slot[data-s="' + slotIdx + '"]');
      if (slot) {
        slot.classList.add('filled');
        var type = btn.dataset.type;
        slot.innerHTML = '<span class="slot-ch zh">' + btn.dataset.ch + '</span>' +
          '<span class="slot-tag">' + (type === 'sound' ? '声' : (round.grain === 'radical' ? '形' : '义')) + '</span>';
      }
      btn.classList.add('used'); btn.disabled = true;
      reward(30);

      if (G.slotFill.every(function (x) { return x; })) {
        winRound(round);
      } else {
        // Update progress
        var unfilled = G.slotFill.filter(function (x) { return !x; }).length;
        var h = $('#howto');
        if (h) h.innerHTML = 'Parts remaining: <b>' + unfilled + '</b>.';
      }
    } else {
      crack();
      btn.classList.add('rej');
      setTimeout(function () { btn.classList.remove('rej'); }, 380);

      // Teaching nudge
      var h = $('#howto');
      if (h) {
        var ch = btn.dataset.ch;
        if (G.hintLevel >= 2) {
          h.innerHTML = 'That\'s <b>' + ch + '</b> — not the right part. Tap a glowing card.';
        } else {
          h.innerHTML = '<b>' + ch + '</b> isn\'t right. Try again.';
        }
      }

      // After 2 cracks, dim wrong cards
      if (G.roundCracks >= 2) {
        $$('#pool .pcard[data-correct="0"]').forEach(function (b) { b.style.opacity = '0.45'; });
      }
    }
  }

  /* ================================================================
     REVEAL OVERLAY
     ================================================================ */
  function showRevealOverlay(round, stars, timeBonus) {
    var ov = $('#reveal');
    var g = round._accent || {};
    ov.style.setProperty('--rc', g.accent || 'var(--rc)');
    ov.style.setProperty('--rc-soft', g.soft || 'var(--rc-soft)');
    ov.style.setProperty('--rc-tint', g.tint || 'var(--rc-tint)');

    var sv = '';
    for (var k = 0; k < 3; k++) sv += '<i class="' + (k < stars ? 'on' : '') + '">★</i>';

    var last = G.roundIdx >= G.rounds.length - 1;

    ov.innerHTML =
      '<div class="rv-card">' +
        '<div class="rv-eyebrow"><span class="dot"></span>Forged · <span class="zh">炼成</span> · <span class="zh">' + (g.cat || '') + '</span></div>' +
        '<div class="rv-stars">' + sv + '</div>' +
        '<div class="rv-ch zh">' + round.char + '</div>' +
        '<div class="rv-py">' + (round.pinyin || '') + '</div>' +
        '<div class="rv-en">' + (round.meaning || '') + '</div>' +
        '<div class="rv-tally">' +
          '<span>heat bonus <b>+' + timeBonus + '</b></span>' +
          (G.speedBonus ? '<span>speed bonus <b>+' + G.speedBonus + '</b></span>' : '') +
          '<span>combo ×' + Math.max(1, G.maxCombo) + '</span>' +
          (G.roundCracks ? '<span class="bad">cracks ' + G.roundCracks + '</span>' : '<span class="good">flawless</span>') +
        '</div>' +
        '<button class="gbtn solid" id="ov-go">' + (last ? 'See your run <span class="zh">完成</span>' : 'Next round <span class="zh">继续</span>') + ' ›</button>' +
      '</div>';

    ov.className = 'reveal show';
    confetti(ov, [g.accent || '#C2603A', g.soft || '#F0C9B4', '#E0A23A', '#fff']);

    $('#ov-go').addEventListener('click', function () {
      ov.className = 'reveal';
      if (last) {
        finishRun();
      } else {
        G.roundIdx++;
        startPreview(G.rounds[G.roundIdx]);
      }
    });
  }

  /* ---------- finish overlay ---------- */
  function showFinishOverlay() {
    var ov = $('#reveal');
    ov.style.removeProperty('--rc');
    ov.style.removeProperty('--rc-soft');
    ov.style.removeProperty('--rc-tint');

    var totalStars = G.stars.reduce(function (a, b) { return a + (b || 0); }, 0);
    var starLine = '';
    for (var k = 0; k < totalStars; k++) starLine += '★';
    for (var j = totalStars; j < G.rounds.length * 3; j++) starLine += '<em>★</em>';

    var stripHTML = G.rounds.map(function (r, i) {
      var sv = '';
      for (var k = 0; k < 3; k++) sv += '<i class="' + (k < (G.stars[i] || 0) ? 'on' : '') + '">★</i>';
      var accent = (r._accent || {}).accent || 'var(--rc)';
      return '<div class="fin-item" style="--rc:' + accent + '"><span class="zh">' + r.char + '</span><span class="fi-grain">' + r.grain + '</span><span class="fi-stars">' + sv + '</span></div>';
    }).join('');

    var isNewBest = G.score >= (progress.best || 0);

    ov.innerHTML =
      '<div class="rv-card finish-card">' +
        '<div class="rv-eyebrow"><span class="dot"></span>Run complete · <span class="zh">炼字坊</span></div>' +
        '<div class="fin-score">' + G.score + '<span>points</span></div>' +
        '<div class="fin-starline">' + starLine + '</div>' +
        '<div class="fin-strip">' + stripHTML + '</div>' +
        '<p class="fin-note">Characters forged: <b>' + G.forged.length + '</b>. ' +
          (isNewBest ? 'New best!' : 'Best: ' + (progress.best || 0)) + '</p>' +
        '<div class="rv-actions">' +
          '<button class="gbtn ghost" id="ov-again">↻ Forge again</button>' +
          '<button class="gbtn solid" id="ov-done">Back to journey <span class="zh">继续</span></button>' +
        '</div>' +
      '</div>';

    ov.className = 'reveal show finish';
    confetti(ov, ['#C2603A', '#2F7DA6', '#7E4B86', '#E0A23A']);

    $('#ov-again').addEventListener('click', function () { ov.className = 'reveal'; startRun(); });
    $('#ov-done').addEventListener('click', function () { ov.className = 'reveal'; });
  }

  /* ================================================================
     FX
     ================================================================ */
  function shake() {
    var a = $('#arena'); if (!a) return;
    a.classList.remove('shaking');
    void a.offsetWidth;
    a.classList.add('shaking');
  }

  function confetti(host, colors) {
    var f = document.createDocumentFragment();
    for (var i = 0; i < 42; i++) {
      var b = document.createElement('i');
      b.className = 'confetti-bit';
      b.style.left = (Math.random() * 100) + '%';
      b.style.background = colors[i % colors.length];
      b.style.animationDelay = (Math.random() * 0.4) + 's';
      b.style.animationDuration = (1.5 + Math.random() * 1.3) + 's';
      b.style.width = b.style.height = (6 + Math.random() * 7) + 'px';
      f.appendChild(b);
    }
    host.appendChild(f);
    setTimeout(function () { $$('.confetti-bit', host).forEach(function (x) { x.remove(); }); }, 3200);
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#ftoast'); if (!t) return;
    t.innerHTML = msg; t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  function speak(ch) {
    try {
      if (!window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(ch);
      u.lang = 'zh-CN'; u.rate = 0.8;
      var vs = speechSynthesis.getVoices();
      var zh = vs.filter(function (v) { return /zh|Chinese/i.test(v.lang + v.name); })[0];
      if (zh) u.voice = zh;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ================================================================
     RUN CONTROL
     ================================================================ */
  function startRun(filterPlaylist) {
    var ov = $('#reveal'); if (ov) ov.className = 'reveal';
    stopHeat();
    if (G && G.previewTimer) { clearInterval(G.previewTimer); G.previewTimer = null; }

    loadProgress();

    // Pick a batch from the scheduler (warmup atoms may increase total).
    // Endless mode: scope to HSK 1..hskMax and advance through unforged chars.
    var hskMax = progress.settings.hskMax || 0;
    var picked = Scheduler.pickRounds(ROUNDS_PER_RUN, filterPlaylist || null, hskMax);
    if (picked.length === 0) {
      $('#arena').innerHTML = '<div class="howto" style="text-align:center;padding:40px;"><p>No characters available yet.</p><p style="color:var(--ink-mute);">Complete some stroke-forge rounds to unlock more.</p></div>';
      return;
    }

    // Insert warm-up atoms (components not yet owned)
    picked = Scheduler.warmupAtoms(picked);
    if (picked.length > 8) picked = picked.slice(0, 8); // cap at 8 rounds

    G = newRunState();
    G.rounds = picked;

    // Resolve decoys for non-stroke rounds
    var diff = DIFFICULTY[progress.settings.difficulty] || DIFFICULTY.normal;
    for (var i = 0; i < G.rounds.length; i++) {
      var r = G.rounds[i];
      if (r.grain !== 'stroke') {
        var resolved = DecoyGenerator.forPartsRound(r, diff);
        r._slots = resolved.slots;
        r._pool = resolved.pool;
      } else {
        r._slots = [];
        r._pool = [];
      }
      // Initial accent info
      applyRoundAccent(r);
    }

    G.stars = new Array(G.rounds.length).fill(0);
    renderRail();

    // Start first round
    startPreview(G.rounds[0]);
  }

  /* ================================================================
     TWEAKS / SETTINGS
     ================================================================ */
  function applySettings(s) {
    loadProgress();
    for (var k in s) {
      if (k in progress.settings) progress.settings[k] = s[k];
    }
    saveProgress();
    // If currently playing and not done, re-render current phase
    if (G && !G.done && G.phase === 'forge') {
      var round = G.rounds[G.roundIdx];
      var diff = DIFFICULTY[progress.settings.difficulty] || DIFFICULTY.normal;
      if (round.grain === 'stroke') renderStrokeForge(round, diff);
      else renderPartsForge(round, diff);
    }
  }

  function applyTweaks(t) {
    progress.settings.sound = t.sound !== false;
    progress.settings.hints = t.hints !== false;
    saveProgress();
  }

  function resetProgress() {
    progress = {
      owned: [],
      mastery: {},
      best: 0,
      runs: 0,
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    };
    saveProgress();
    startRun();
  }

  function reset() { startRun(); }

  /* ================================================================
     PUBLIC API
     ================================================================ */
  window.ForgeGame = {
    start: startRun,
    reset: reset,
    resetProgress: resetProgress,
    applyTweaks: applyTweaks,
    applySettings: applySettings,
    getProgress: function () { return progress; },
    getCharacters: function () { return characters; },
    getPlaylists: function () { return allLessons; },
    isLoaded: function () { return dataLoaded; }
  };

  // Legacy compat for Tweaks panel
  window.JOURNEY = {
    applyTweaks: applyTweaks,
    reset: reset,
    redraw: function () {}
  };

  /* ================================================================
     INIT
     ================================================================ */
  function showFatal(title, detail) {
    var a = $('#arena');
    if (!a) return;
    a.innerHTML = '<div class="howto" style="text-align:center;padding:32px;max-width:480px;">' +
      '<p style="font-size:16px;color:var(--ink);"><b>' + title + '</b></p>' +
      '<p style="color:var(--ink-mute);font-weight:500;">' + detail + '</p></div>';
  }

  function isFileProtocol() {
    return typeof location !== 'undefined' && location.protocol === 'file:';
  }

  function init() {
    loadProgress();

    // Pre-flight: fetch() of local JSON is blocked under file:// in every browser.
    if (isFileProtocol()) {
      showFatal('Open this over a local server, not from a file',
        'Browsers block loading the character data when the page is opened directly ' +
        '(file://). Run <code>python3 -m http.server</code> in the project folder and open ' +
        '<code>http://localhost:8000/The%20Forge%20(game).html</code>.');
      console.error('[ForgeGame] Running under file:// — fetch() of local data is blocked. Use an HTTP server.');
      return;
    }

    // Step 1: load data. A failure here is genuinely a data/fetch problem.
    ContentService.load().then(function () {
      console.log('[ForgeGame] Data loaded: ' + Object.keys(characters).length + ' chars, ' +
        Object.keys(components).length + ' components, ' + allLessons.length + ' lessons');

      // Step 2: start the game. Do NOT chain this inside the load promise —
      // otherwise a render/runtime error here would be mis-reported as a data
      // load failure. Surface it on its own.
      try {
        startRun();
        var resetBtn = $('#btn-reset');
        if (resetBtn) resetBtn.addEventListener('click', function () { startRun(); });
      } catch (e) {
        console.error('[ForgeGame] Game start failed:', e);
        showFatal('The game hit an error while starting', (e && e.message ? e.message : String(e)));
      }
    }, function (err) {
      // Load rejected — report the real reason.
      console.error('[ForgeGame] Data load failed:', err);
      var msg = err && err.message ? err.message : String(err);
      showFatal('Could not load character data',
        'Fetch failed: ' + msg + '. Confirm the page is served over http:// and that ' +
        'assets/data/characters.json is reachable.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
