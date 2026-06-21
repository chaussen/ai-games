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
      '<p class="trial-left"><span class="zh">试用还剩 ' + left + ' 天</span> · ' + left + ' day' + (left===1?'':'s') + ' left</p>' +
      '<button class="trial-reset" id="trial-reset"><span class="zh">重新开始</span> · Start over (clear progress)</button>';
    $('#trial-start').addEventListener('click', play);
    var rs=$('#trial-reset'); if(rs) rs.addEventListener('click', confirmReset);
  }

  // ── start over: clear progress + replay the tour (with a clear warning) ──
  function confirmReset(){
    if ($('#trial-confirm')) return;
    var d=document.createElement('div'); d.className='trial-confirm'; d.id='trial-confirm';
    d.innerHTML='<div class="tcf-box">'+
      '<div class="tcf-ic">⚠️</div>'+
      '<h3><span class="zh">重新开始？</span> Start over?</h3>'+
      '<p class="tcf-zh">这会清除<b>所有进度</b>：印章、文钱、等级和复习记录，<b>无法恢复</b>。新手引导会重新出现。</p>'+
      '<p class="tcf-en">This clears <b>all progress</b> — seals, 文 coins, rank and reviews — and <b>cannot be undone</b>. The guided tour will show again.</p>'+
      '<div class="tcf-btns">'+
        '<button class="jbtn ghost" id="tcf-cancel"><span class="zh">取消</span> Cancel</button>'+
        '<button class="jbtn danger" id="tcf-go"><span class="zh">清除并重新开始</span> Clear &amp; start over</button>'+
      '</div></div>';
    document.body.appendChild(d);
    $('#tcf-cancel').addEventListener('click', function(){ d.remove(); });
    $('#tcf-go').addEventListener('click', doReset);
    d.addEventListener('click', function(e){ if(e.target===d) d.remove(); });
  }
  function doReset(){
    try { localStorage.removeItem('ccs-game-v1'); localStorage.removeItem(K_TOUR); } catch (e) {}
    location.reload();   // reloads into a fresh state; welcome → tour shows again (trial clock kept)
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

  // ── first-run tour (spotlight coach-marks over the real UI) ──
  var K_TOUR = 'ccs-trial-toured-v1';
  function toured(){ try { return !!localStorage.getItem(K_TOUR); } catch (e) { return false; } }
  function markToured(){ try { localStorage.setItem(K_TOUR, '1'); } catch (e) {} }

  var STEPS = [
    { sel:'#stage', center:true,
      zh:'这是你的学习长卷', body_zh:'左右滑动，就能看到春·夏·秋·冬整段旅程。',
      en:'This is your scroll. Swipe sideways to travel through the whole journey — Spring, Summer, Autumn, Winter.' },
    { sel:'.node[data-state="current"]', scroll:true,
      zh:'从这里开始', body_zh:'点这个发光的关卡就能开始。每一关都从部件 → 合字 → 应用，一步步学。',
      en:'Tap the glowing stage to begin. Each stage builds a character step by step: parts → whole → use it.' },
    { sel:'#jhead',
      zh:'你的进度', body_zh:'上面是你的等级（经验）、可用的「文」钱，还有收集到的部首卡。',
      en:'Up here: your rank (经验), the 文 coins you earn, and the character parts you collect.' },
    { center:true, last:true,
      zh:'准备好了！', body_zh:'放心玩、慢慢写，感受汉字的乐趣。课堂见！',
      en:'That’s it — play, write, and enjoy. Tap any stage to start. See you in class!' }
  ];

  function clearTour(){ var t=$('#trial-tour'); if(t) t.remove(); }
  function showTour(i){
    var steps = STEPS.filter(function(s){ return s.center || $(s.sel); });   // skip steps whose target is absent
    if (i >= steps.length){ clearTour(); markToured(); return; }
    var step = steps[i];
    var target = step.sel ? $(step.sel) : null;
    if (target && step.scroll && target.scrollIntoView) target.scrollIntoView({ inline:'center', block:'nearest' });

    var t=$('#trial-tour');
    if(!t){ t=document.createElement('div'); t.className='trial-tour'; t.id='trial-tour';
      t.innerHTML='<div class="tt-ring" id="tt-ring"></div><div class="tt-card" id="tt-card"></div>';
      document.body.appendChild(t); }
    var ring=$('#tt-ring'), card=$('#tt-card');

    function place(){
      var r = (target && !step.center) ? target.getBoundingClientRect() : null;
      t.classList.toggle('centered', !(r && r.width && r.height));   // dim via backdrop when no spotlight
      if (r && r.width && r.height){
        var pad=8;
        ring.style.display='block';
        ring.style.left=(r.left-pad)+'px'; ring.style.top=(r.top-pad)+'px';
        ring.style.width=(r.width+pad*2)+'px'; ring.style.height=(r.height+pad*2)+'px';
      } else { ring.style.display='none'; }
      card.innerHTML=
        '<div class="tt-step">'+(i+1)+' / '+steps.length+'</div>'+
        '<h3><span class="zh">'+step.zh+'</span></h3>'+
        '<p class="tt-zh zh">'+step.body_zh+'</p>'+
        '<p class="tt-en">'+step.en+'</p>'+
        '<div class="tt-actions">'+
          (i>0?'<button class="tt-arrow" id="tt-back" aria-label="Back">‹</button>':'')+
          (step.last?'':'<button class="tt-skip" id="tt-skip">跳过 Skip</button>')+
          '<button class="jbtn solid tt-next" id="tt-next" style="flex:0 0 auto;padding:11px 22px">'+
            (step.last?'<span class="zh">开始</span> Start ›':'<span class="zh">下一步</span> Next ›')+'</button>'+
        '</div>';
      // Place the card on the OPPOSITE half from the highlighted target so it
      // never covers what it's pointing at. (Header is high → card low; a stage
      // node low → card high.) Centre/overview steps default to the bottom,
      // leaving the upper journey visible.
      var atTop = (r && r.width && r.height) ? ((r.top + r.height/2) > window.innerHeight*0.45) : false;
      card.classList.toggle('tt-top', atTop);
      card.classList.toggle('tt-bottom', !atTop);
      var nx=$('#tt-next'); if(nx) nx.addEventListener('click', function(){ showTour(i+1); });
      var bk=$('#tt-back'); if(bk) bk.addEventListener('click', function(){ showTour(i-1); });
      var sk=$('#tt-skip'); if(sk) sk.addEventListener('click', function(){ clearTour(); markToured(); });
    }
    // let scrollIntoView settle before measuring
    setTimeout(place, step.scroll?260:0);
  }
  function startTour(){ showTour(0); }

  // ── flow ──
  function play(){
    if (expired()){ showExpired(); return; }
    if (typeof onPlay === 'function') onPlay();   // existing unlock(): hides gate, logs session, renders
    ensureRibbon();
    if (!toured()) setTimeout(startTour, 500);     // gentle first-run tour
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
