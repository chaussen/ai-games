/* game/trial.js — Holiday free-trial mode (Book 1 only)
   Loaded *only* by trial.html, which sets window.GAME_TRIAL before the other
   scripts run. It does three things, all guarded behind that flag so the class
   build (index.html) is untouched:
     1. Replaces the class-code keypad with a warm, bilingual welcome gate —
        parents have no class code, so the trial just opens.
     2. Keeps a per-device 14-day clock in localStorage; when it runs out the
        gate becomes a gentle "see you in class" wall instead of a Start button.
     3. Paints a persistent ribbon explaining this is Book 1 only and that the
        full game is unlocked in class.
   The Book-1 content scoping itself lives in data.js (units() narrows to the
   trial band) — everything downstream (scroll, deck, totals) follows from that.

   NOTE: a true "max N players" cap can't be enforced from a static page; that
   needs the planned accounts backend. The 14-day device clock is the honest,
   no-backend stand-in (and is trivially resettable — which is fine for a trial). */
(function (G) {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var CFG = window.GAME_TRIAL || {};
  var DAYS = CFG.days || 14;
  var K_START = 'ccs-trial-start-v1';
  var DAY = 864e5;
  var onPlay = null;

  function on(){ return !!(window.GAME_TRIAL && window.GAME_TRIAL.on); }

  // ── the 14-day device clock ──
  function startDate(){
    var v = null;
    try { v = localStorage.getItem(K_START); } catch (e) {}
    if (!v){ v = String(Date.now()); try { localStorage.setItem(K_START, v); } catch (e) {} }
    return +v;
  }
  function daysLeft(){
    var used = Math.floor((Date.now() - startDate()) / DAY);
    return Math.max(0, DAYS - used);
  }
  function expired(){ return daysLeft() <= 0; }

  // ── gate (rendered into the existing #lockgate full-screen layer) ──
  function gate(){ return $('#lockgate'); }

  function showWelcome(){
    var g = gate(); if (!g) return;
    var left = daysLeft();
    g.classList.remove('hidden');
    g.innerHTML =
      '<div class="lg-seal zh">字</div>' +
      '<h1><span class="zh">学字坊</span><br>' +
        '<span style="font-family:var(--serif);font-size:.6em;font-style:italic">The Character Game</span></h1>' +
      '<div class="trial-badge"><span class="zh">假期免费试用</span> · Holiday Free Trial</div>' +
      '<div class="trial-intro">' +
        '<p><span class="zh">欢迎来到《学字坊》！这是<b>第一册</b>的假期免费试用版，让孩子在家也能体验汉字闯关的乐趣。</span></p>' +
        '<p>Welcome! This is a free holiday trial of <b>Book 1</b>, so your child can enjoy learning Chinese characters at home.</p>' +
        '<p class="trial-note"><span class="zh">完整版（全四册）将在课堂上解锁。</span> The full game (all four books) is unlocked in class.</p>' +
      '</div>' +
      '<button class="jbtn solid" id="trial-start" style="display:inline-flex;flex:0 0 auto;padding:14px 32px;margin-top:4px">' +
        '<span class="zh">开始试用</span> Start ›</button>' +
      '<p class="trial-left"><span class="zh">试用还剩 ' + left + ' 天</span> · ' + left + ' day' + (left===1?'':'s') + ' left</p>';
    $('#trial-start').addEventListener('click', play);
  }

  function showExpired(){
    var g = gate(); if (!g) return;
    g.classList.remove('hidden');
    g.innerHTML =
      '<div class="lg-seal zh" style="background:var(--ink-soft)">字</div>' +
      '<h1><span class="zh">试用结束</span><br>' +
        '<span style="font-family:var(--serif);font-size:.6em;font-style:italic">Trial ended</span></h1>' +
      '<div class="trial-intro">' +
        '<p><span class="zh">' + DAYS + ' 天的免费试用已经结束啦。完整版《学字坊》在课堂上等着你——快来上课继续闯关吧！</span></p>' +
        '<p>Your ' + DAYS + '-day free trial has ended. The full Character Game is waiting in class — come along to keep playing and unlock all four books!</p>' +
        '<p class="trial-note"><span class="zh">谢谢你的体验，课堂见！</span> Thank you for trying it — see you in class!</p>' +
      '</div>';
  }

  // ── persistent ribbon at the top of the app shell ──
  function ensureRibbon(){
    if ($('#trial-bar')) { updateRibbon(); return; }
    var app = $('.app'); if (!app) return;
    var bar = document.createElement('div');
    bar.className = 'trial-bar'; bar.id = 'trial-bar';
    bar.innerHTML =
      '<span class="tb-tag zh">试用</span>' +
      '<span class="tb-msg"><span class="zh">假期试用版 · 仅第一册，完整版在课堂上解锁</span>' +
        '<span class="tb-en">Holiday trial · Book 1 only — unlock the full game in class</span></span>' +
      '<span class="tb-days" id="tb-days"></span>' +
      '<button class="tb-info" id="tb-info" title="About this trial" aria-label="About this trial">ⓘ</button>';
    app.insertBefore(bar, app.firstChild);
    $('#tb-info').addEventListener('click', relock);
    updateRibbon();
  }
  function updateRibbon(){
    var el = $('#tb-days'); if (!el) return;
    var left = daysLeft();
    el.innerHTML = '<span class="zh">剩 ' + left + ' 天</span> · ' + left + 'd left';
  }

  // ── flow ──
  function play(){
    if (expired()){ showExpired(); return; }
    if (typeof onPlay === 'function') onPlay();   // existing unlock(): hides gate, logs session, renders
    ensureRibbon();
  }
  function start(opts){
    opts = opts || {};
    onPlay = opts.onPlay || null;
    startDate();                                   // begin the clock on first open
    if (expired()) showExpired(); else showWelcome();
  }
  function relock(){
    if (expired()) showExpired(); else showWelcome();
  }

  G.Trial = { on:on, start:start, relock:relock, daysLeft:daysLeft, expired:expired };
})(window.GAME = window.GAME || {});
