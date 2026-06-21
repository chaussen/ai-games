/* game/app.js — orchestrator + router + ceremonies + the two-currency wiring
   Boots the data graph + state, runs the class-code lock, turns a Stage Sheet
   "Begin" into a resolved Forge run, then applies the spec §6 scoring on finish:
   文 to the wallet (capped, anti-farm), XP to rank, mastery/ink scheduling, parts
   into the Deck — and fires the Stage Clear / Chapter Seal / Rank-up ceremonies. */
(function (G) {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  var S, C;

  // ───────── settings for a forge run ─────────
  // The cue policy is "Both": a progression baseline (which chapter the stage is
  // in) nudged by the teacher difficulty dial. English is generous early and is
  // kept OUT of the structure forge later; english→character only ever appears
  // as its own Use exercise, never mixed in (overall guide, feedback #4).
  function forgeSettings(unitId){
    var st=S.get(), diff=st.settings.difficulty||'normal';
    var pv = st.settings.previewMs!=null ? st.settings.previewMs : ({easy:5000,normal:3000,hard:1500,expert:0})[diff];
    var chapterIdx=0;
    if (unitId!=null){ var chs=S.chapters(); chapterIdx=Math.max(0, chs.indexOf(S.chapterOf(unitId))); }
    var earlyChapter = chapterIdx<=1;                 // first two chapters = generous baseline
    var structureEnglish = (diff==='expert') ? false : (earlyChapter || diff==='easy');
    var usePrompt = (diff==='expert' || chapterIdx>=3) ? 'english' : 'pinyin';
    return { difficulty:diff, previewMs:pv, cueLevel:st.settings.cueLevel||'normal', sound:st.settings.sound!==false,
             level:chapterIdx, cuePolicy:{ structureEnglish:structureEnglish, usePrompt:usePrompt } };
  }

  // ───────── begin a stage (the 3-band arc → a forge run) ─────────
  function beginStage(u, isReview){
    var st=S.get(), unit=C.unitById(u), arc=C.resolveStage(u, st.owned), settings=forgeSettings(u);
    var rounds=[];
    if (isReview){
      unit.writeChars.filter(function(ch){return S.isCharDue(ch);}).forEach(function(ch){ var w=DATA(arc,ch); rounds.push(C.buildRound({char:ch, band:'wholes', grain:w&&w.grain}, settings)); });
    } else {
      arc.bands.parts.forEach(function(p){ if(!st.owned[p.char] && p.forgeable) rounds.push(C.buildRound({char:p.char, band:'parts', grain:p.grain, chunks:p.chunks}, settings)); });
      arc.bands.wholes.forEach(function(w){ rounds.push(C.buildRound({char:w.char, band:'wholes', grain:w.grain}, settings)); });
      arc.bands.use.forEach(function(uu){ rounds.push(C.buildRound({band:'use', text:uu.text, en:uu.en}, settings)); });
    }
    function DATA(arc,ch){ for(var i=0;i<arc.bands.wholes.length;i++) if(arc.bands.wholes[i].char===ch) return arc.bands.wholes[i]; return null; }
    if(!rounds.length){ toast('Nothing due to forge here.'); return; }
    G.Scroll.closeSheet();
    var alreadyDone = st.cleared[u]!=null;
    G.Forge.run(rounds, {
      settings:settings, title:(isReview?'复习 · ':'')+unit.theme.zh+' · '+unit.theme.en,
      onCharForged:onForged,
      onDone:function(res){ onStageDone(u, isReview, alreadyDone, res); }
    }, null);
  }

  function onForged(rd, stars){
    if (rd.grain==='use') return;
    if (rd.band==='parts'){ S.ownPart(rd.char); S.inkChar(rd.char, false); }
    else { S.inkChar(rd.char, false); }       // wholes ink onto the scroll at full strength
  }

  function onStageDone(u, isReview, alreadyDone, res){
    if (res.aborted){ G.Scroll.render(); return; }
    var st=S.get(), unit=C.unitById(u), cfg=st.config;
    var roundsN=res.rounds, avg=Math.max(1, Math.round(res.totalStars/Math.max(1,roundsN)));

    var wenGain=0, xpGain=0, rankRes={ranked:false};
    if (isReview){
      var dueCleared=unit.writeChars.filter(function(ch){ return res.stars[ch]; });
      dueCleared.forEach(function(ch){ S.inkChar(ch, true); wenGain+=S.addWen(cfg.dueWen,{capped:true}); });
      xpGain=Math.round(cfg.xpPerChar*0.5*dueCleared.length); rankRes=S.addXp(xpGain);
      ceremonyStageClear(unit, avg, wenGain, xpGain, true, function(){ afterClear(u, rankRes); });
      return;
    }

    var wholes=unit.writeChars.length;
    if (!alreadyDone){
      st.cleared[u]=avg; st.stars[u]=avg;
      // 文: flat completion (capped per anti-farm); XP: by chars + stars
      wenGain=S.addWen(cfg.completionWen,{capped:true});
      xpGain=cfg.xpPerChar*wholes + (avg>=3?cfg.star3:avg>=2?cfg.star2:0);
      rankRes=S.addXp(xpGain);
      advanceCurrent(u);
    } else {
      // re-practice of a cleared stage → token-starved (+1), still earns XP & mastery
      wenGain=S.addWen(cfg.nonDueWen,{capped:true});
      xpGain=Math.round(cfg.xpPerChar*0.3*wholes); rankRes=S.addXp(xpGain);
      if (avg>(st.stars[u]||0)){ st.cleared[u]=avg; st.stars[u]=avg; }
    }
    S.save();
    ceremonyStageClear(unit, avg, wenGain, xpGain, false, function(){ afterClear(u, rankRes); });
  }

  function advanceCurrent(u){
    var st=S.get(), chs=S.chapters();
    for(var i=0;i<chs.length;i++){ if(!S.chapterUnlocked(chs[i].id)) break;
      for(var j=0;j<chs[i].units.length;j++){ var v=chs[i].units[j]; if(st.cleared[v]==null){ st.current=v; S.save(); return; } } }
  }

  function afterClear(u, rankRes){
    G.Scroll.render();
    var ch=S.chapterOf(u);
    if (S.chapterCleared(ch.id) && S.get().seals.indexOf(ch.id)<0){
      toast('Chapter complete — tap the <span class="zh">'+ch.season+'印</span> seal to claim it!');
      setTimeout(function(){ G.Scroll.scrollToNode('G'+ch.id, true); }, 400);
    }
    if (rankRes.ranked) setTimeout(function(){ ceremonyRankUp(rankRes.rank); }, 500);
  }

  // ───────── review run launched from the hub ─────────
  function reviewRun(dueList){
    var settings=forgeSettings(), rounds=dueList.map(function(ch){ var c=C.charInfo(ch); return C.buildRound({char:ch, band:'wholes', grain:c&&c.grain}, settings); });
    G.Screens.close();
    G.Forge.run(rounds, { settings:settings, title:'复习 · Review', onCharForged:onForged, onDone:function(res){
      if(res.aborted){ G.Scroll.render(); return; }
      var cfg=S.get().config, wen=0, n=0;
      dueList.forEach(function(ch){ if(res.stars[ch]){ S.inkChar(ch, true); wen+=S.addWen(cfg.dueWen,{capped:true}); n++; } });
      var xp=Math.round(cfg.xpPerChar*0.5*n), rk=S.addXp(xp);
      G.Scroll.render();
      ceremonyReview(n, wen, xp, function(){ if(rk.ranked) ceremonyRankUp(rk.rank); });
    }}, null);
  }

  // ───────── claim a chapter seal ─────────
  function claimSeal(id){
    var st=S.get(); if(st.seals.indexOf(id)>=0){ G.Scroll.closeSheet(); return; }
    var c=S.chapterById(id), cfg=st.config;
    st.seals.push(id);
    var wen=S.addWen(cfg.sealWen,{capped:false});       // milestone — exempt from the cap
    var rk=S.addXp(cfg.sealXp);
    G.Scroll.closeSheet(); G.Scroll.render();
    ceremonySeal(c, wen, cfg.sealXp, function(){ if(rk.ranked) setTimeout(function(){ ceremonyRankUp(rk.rank); }, 200); });
  }

  // ───────── ceremonies ─────────
  function ov(){ return $('#overlay'); }
  var CONFETTI_EMOJI=['⭐','✨','🎉','🌟','🎈','💫','🎊'];
  function confetti(host, colors){ var f=document.createDocumentFragment();
    for(var i=0;i<80;i++){ var b=document.createElement('i'); b.className='confetti-bit';
      b.style.left=(Math.random()*100)+'%';
      b.style.setProperty('--dx',((Math.random()*2-1)*130).toFixed(0)+'px');
      b.style.setProperty('--rot',(360+Math.random()*620).toFixed(0)+'deg');
      b.style.animationDelay=(Math.random()*0.6)+'s';
      b.style.animationDuration=(1.9+Math.random()*1.7)+'s';
      if(i%4===0){ b.className='confetti-bit emoji'; b.textContent=CONFETTI_EMOJI[i%CONFETTI_EMOJI.length]; b.style.fontSize=(15+Math.random()*15)+'px'; }
      else { b.style.background=colors[i%colors.length]; var sz=(7+Math.random()*9);
        b.style.width=sz+'px'; b.style.height=(Math.random()<0.3?sz*2.2:sz)+'px'; }
      f.appendChild(b); }
    host.appendChild(f); setTimeout(function(){ $$('.confetti-bit',host).forEach(function(x){x.remove();}); },3900); }

  // ── celebration helpers (reduced-motion, gentle sound, coin rain, count-up) ──
  var GOLD='#D9A93E';
  function reduceMotion(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }

  // gentle, short WebAudio stings — additive, honor the mute setting, ≤1.2s.
  var _ac=null;
  function actx(){ if(_ac) return _ac; try{ _ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ _ac=null; } return _ac; }
  function soundOn(){ try{ return S.get().settings.sound!==false; }catch(e){ return false; } }
  function tone(freq, delay, dur, type, gain){
    if(!soundOn()) return; var ac=actx(); if(!ac) return;
    try{ if(ac.state==='suspended') ac.resume(); }catch(e){}
    var o=ac.createOscillator(), g=ac.createGain(); o.type=type||'sine'; o.frequency.value=freq;
    o.connect(g); g.connect(ac.destination); var t=ac.currentTime+(delay||0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain||0.1, t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur); o.start(t); o.stop(t+dur+0.03);
  }
  function sGong(){ tone(196,0,1.1,'sine',0.16); tone(294,0,0.9,'sine',0.07); tone(392,0,0.6,'sine',0.04); }
  function sStar(i){ tone(523.25*Math.pow(2,(i*3)/12), 0, 0.32,'triangle',0.13); }   // rises per star
  function sCoins(){ for(var k=0;k<6;k++) tone(1000+k*150, k*0.05, 0.16,'triangle',0.045); }
  function sClink(){ tone(1320,0,0.5,'triangle',0.12); tone(1976,0.02,0.4,'sine',0.05); }
  function sFanfare(){ [0,4,7,12,16].forEach(function(st,idx){ tone(392*Math.pow(2,st/12), idx*0.13, 0.55,'sawtooth',0.06); }); }

  // 文 coins + gold flecks rain from the top edge and fade (the in-aesthetic confetti)
  function coinRain(host, n){
    var f=document.createDocumentFragment();
    for(var i=0;i<n;i++){ var c=document.createElement('div'); c.className='coinrain'+(i%3===0?' fleck':'');
      c.style.left=(Math.random()*100)+'%';
      c.style.setProperty('--dx',((Math.random()*2-1)*70).toFixed(0)+'px');
      c.style.animationDelay=(Math.random()*0.8)+'s';
      c.style.animationDuration=(1.7+Math.random()*1.3)+'s';
      if(i%3===0){ var s=(7+Math.random()*7); c.style.width=c.style.height=s+'px'; }
      else { c.innerHTML=G.Scroll.wenCoin(); var sz=(22+Math.random()*14); c.style.width=c.style.height=sz+'px'; }
      f.appendChild(c); }
    host.appendChild(f);
    setTimeout(function(){ $$('.coinrain',host).forEach(function(x){x.remove();}); }, 3600);
  }
  function countUp(el, target, suffix){
    if(!el) return;
    if(reduceMotion()||target<=0){ el.textContent='+'+target+suffix; return; }
    var t0=null, dur=750;
    function step(ts){ if(t0===null) t0=ts; var p=Math.min(1,(ts-t0)/dur);
      el.textContent='+'+Math.round(target*p)+suffix; if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  // a medal/seal flies up to the header seal tray on collect
  function flyToSealTray(el){
    var tray=$('.sealtray'); if(!el||!tray) return;
    var r=el.getBoundingClientRect(), tr=tray.getBoundingClientRect();
    var fly=el.cloneNode(true); fly.className='award-fly'; document.body.appendChild(fly);
    fly.style.left=r.left+'px'; fly.style.top=r.top+'px'; fly.style.width=r.width+'px'; fly.style.height=r.height+'px';
    requestAnimationFrame(function(){
      fly.style.transform='translate('+(tr.left+tr.width/2-r.left-r.width/2)+'px,'+(tr.top+tr.height/2-r.top-r.height/2)+'px) scale(.28)';
      fly.style.opacity='0.15';
    });
    setTimeout(function(){ fly.remove(); }, 720);
  }

  // ── STAGE CLEAR (priority #1): banner → gold self-paint + seal → coins → stars → tally ──
  function ceremonyStageClear(unit, stars, wen, xp, isReview, onGo){
    var o=ov(); o.className='overlay show celebrate';
    var glyph=(unit.writeChars&&unit.writeChars[0])||'字';
    var sd=(C.hasStrokes&&C.hasStrokes(glyph))?C.strokesOf(glyph):null;
    var nStars=Math.max(0,Math.min(3,stars|0)), reduce=reduceMotion();
    o.innerHTML=
      '<div class="cc-banner"><span class="zh">'+(isReview?'复习完成':'关卡完成')+'</span><em>'+(isReview?'Review done':'Stage Clear')+'</em></div>'+
      '<div class="ov-card cc-card" id="cc-card">'+
        '<div class="cc-glyphwrap">'+
          (sd?'<div class="cc-glyph" id="cc-glyph"></div>':'<div class="cc-glyph cc-glyph-fallback zh" style="color:'+GOLD+'">'+esc(glyph)+'</div>')+
          '<span class="cc-seal zh" id="cc-seal">印</span></div>'+
        '<div class="ov-big"><span class="zh">'+esc(unit.theme.zh)+'</span></div><div class="ov-py">'+esc(unit.theme.en)+'</div>'+
        '<div class="bigstars cc-stars" id="cc-stars"><i>★</i><i>★</i><i>★</i></div>'+
        '<div class="ov-en"><b id="cc-wen">+0 文</b> · <b id="cc-xp">+0 经验</b></div>'+
        '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 30px">'+
          (isReview?'<span class="zh">继续</span>':'<span class="zh">下一关</span> Next')+' ›</button></div>';
    var starsEls=$$('#cc-stars i'), sealEl=$('#cc-seal'), done=false, anim=null, timers=[], autoT=null;
    function clearTimers(){ timers.forEach(clearTimeout); timers=[]; }
    function finalState(){
      clearTimers(); if(anim){ try{anim.cancel();}catch(e){} anim=null; }
      starsEls.forEach(function(el,k){ el.classList.toggle('on', k<nStars); });
      if(sealEl) sealEl.classList.add('stamped');
      var w=$('#cc-wen'), x=$('#cc-xp'); if(w) w.textContent='+'+wen+' 文'; if(x) x.textContent='+'+xp+' 经验';
      var gh=$('#cc-glyph'); if(sd && gh){ gh.innerHTML=''; G.StrokePlay.mount(gh, sd, {color:GOLD, numbers:false, grid:false, perStroke:1, gap:0}); }
    }
    function go(){ if(done) return; done=true; clearTimers(); if(autoT) clearTimeout(autoT); flyCoins(wen); o.className='overlay'; if(onGo) onGo(); }
    $('#ov-go').addEventListener('click', function(e){ e.stopPropagation(); go(); });
    o.onclick=function(e){ if(e.target===o) finalState(); };   // tap bg = skip to final state
    function punch(){ var card=$('#cc-card'); if(card){ card.classList.remove('cc-punch'); void card.offsetWidth; card.classList.add('cc-punch'); } }
    function afterPaint(){
      if(done) return;
      if(sealEl) sealEl.classList.add('stamped'); sClink();
      coinRain(o, 10+nStars*7); sCoins();
      for(var k=0;k<nStars;k++){ (function(k){ timers.push(setTimeout(function(){
        if(done) return; starsEls[k].classList.add('on'); sStar(k); if(k===nStars-1) punch(); }, 220+k*340)); })(k); }
      timers.push(setTimeout(function(){ if(done) return; countUp($('#cc-wen'),wen,' 文'); countUp($('#cc-xp'),xp,' 经验'); }, 240+nStars*340));
    }
    if(reduce){ finalState(); autoT=setTimeout(go, 8000); return; }
    sGong();
    if(sd){ anim=G.StrokePlay.mount($('#cc-glyph'), sd, {color:GOLD, numbers:false, grid:false, perStroke:330, gap:90, onDone:afterPaint}); }
    else { timers.push(setTimeout(afterPaint, 500)); }
    autoT=setTimeout(go, 8500);
  }
  function ceremonyReview(n, wen, xp, onGo){
    var o=ov(); o.className='overlay show'; o.onclick=null;
    o.innerHTML='<div class="ov-card"><div class="ov-eyebrow"><span class="dot"></span>Review complete · <span class="zh">复习</span></div>'+
      '<div class="ov-rankseal zh">复</div>'+
      '<div class="ov-en"><b>'+n+'</b> characters re-inked · <b>+'+wen+' 文</b> · <b>+'+xp+' 经验</b></div>'+
      '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 28px">Back to scroll <span class="zh">继续</span></button></div>';
    confetti(o, ['#E0A23A','#3E8E72','#fff']);
    $('#ov-go').addEventListener('click', function(){ flyCoins(wen); o.className='overlay'; if(onGo) onGo(); });
  }
  // ── AWARD / SEAL UNLOCK (priority #2): spotlight dim → medal arrival + rays → collect-flies-home ──
  function ceremonySeal(c, wen, xp, onGo){
    var o=ov(); o.className='overlay show spotlight'; o.onclick=null; var reduce=reduceMotion(), done=false, autoT=null;
    o.innerHTML='<div class="ov-card award-card">'+
      '<div class="ov-eyebrow"><span class="dot"></span><span class="zh">新印章</span> · Award unlocked</div>'+
      '<div class="award-medalwrap"><div class="award-rays"></div>'+
        '<div class="award-medal zh" id="aw-medal" style="background:'+c.rc+'">'+c.season+'</div></div>'+
      '<div class="ov-big"><span class="zh">'+c.sub+'印</span> '+esc(c.name)+'</div>'+
      '<div class="ov-en">'+c.vol+' complete · <b>+'+wen+' 文</b> · <b>+'+xp+' 经验</b>. A new chapter unrolls.</div>'+
      '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 30px"><span class="zh">收下</span> Collect ✦</button></div>';
    function go(){ if(done) return; done=true; if(autoT) clearTimeout(autoT); flyToSealTray($('#aw-medal')); flyCoins(wen); o.className='overlay'; if(onGo) onGo(); }
    $('#ov-go').addEventListener('click', function(e){ e.stopPropagation(); go(); });
    if(!reduce) sClink();
    autoT=setTimeout(go, 8000);
  }
  // ── LEVEL-UP / RANK PROMOTION (priority #3): spotlight + rays + fanfare ──
  function ceremonyRankUp(rank){
    var o=ov(); o.className='overlay show spotlight rankup'; o.onclick=null; var reduce=reduceMotion(), done=false, autoT=null;
    o.innerHTML='<div class="ov-card rank-card">'+
      '<div class="ov-eyebrow"><span class="dot"></span><span class="zh">科举晋升</span> · Rank up</div>'+
      '<div class="award-medalwrap"><div class="award-rays gold"></div>'+
        '<div class="ov-rankseal zh">'+rank.cn.charAt(0)+'</div></div>'+
      '<div class="ov-big"><span class="zh">'+rank.cn+'</span></div><div class="ov-py">'+esc(rank.py)+'</div>'+
      '<div class="ov-en">You are now a <b>'+esc(rank.en)+'</b> · level '+rank.lv+'</div>'+
      '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 30px"><span class="zh">继续</span> Continue ›</button></div>';
    function go(){ if(done) return; done=true; if(autoT) clearTimeout(autoT); o.className='overlay'; }
    $('#ov-go').addEventListener('click', function(e){ e.stopPropagation(); go(); });
    if(!reduce){ confetti(o, ['#E0A23A', GOLD, '#C2603A', '#fff']); sFanfare(); }
    autoT=setTimeout(go, 8000);
  }

  // 文 coins fly from center into the wallet chip (spec §10 motion)
  function flyCoins(n){
    var target=$('#chip-store'); if(!target||n<=0) return;
    var tr=target.getBoundingClientRect(), tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
    var count=Math.min(8, Math.max(3, Math.round(n/8)));
    for (var i=0;i<count;i++){ (function(k){
      var c=document.createElement('div'); c.className='coinfly'; c.innerHTML=G.Scroll.wenCoin();
      c.style.left=(window.innerWidth/2-15)+'px'; c.style.top=(window.innerHeight/2-15)+'px';
      document.body.appendChild(c);
      requestAnimationFrame(function(){ setTimeout(function(){
        c.style.transform='translate('+(tx-window.innerWidth/2+15)+'px,'+(ty-window.innerHeight/2+15)+'px) scale(.5)';
        c.style.opacity='0.2';
      }, k*70); });
      setTimeout(function(){ c.remove(); }, 1000+k*70);
    })(i); }
  }

  // ───────── toast ─────────
  var toastT; function toast(msg){ var t=$('#jtoast'); t.innerHTML=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('on'); },2800); }

  // ───────── class-code lock gate ─────────
  var STUDENT_CODE='2580', TEACHER_CODE='1357', codeBuf='';
  function buildLock(){
    var g=$('#lockgate');
    g.innerHTML='<div class="lg-seal zh">字</div>'+
      '<h1><span class="zh">学字坊</span><br><span style="font-family:var(--serif);font-size:.6em;font-style:italic">The Character Game</span></h1>'+
      '<p>Enter your class code to begin</p>'+
      '<div class="code-dots" id="lg-dots"><i></i><i></i><i></i><i></i></div>'+
      '<div class="lg-err" id="lg-err"></div>'+
      '<div class="keypad" id="lg-pad">'+[1,2,3,4,5,6,7,8,9].map(function(d){return '<button data-k="'+d+'">'+d+'</button>';}).join('')+
        '<button data-k="x">⌫</button><button data-k="0">0</button><button data-k="ok">✓</button></div>'+
      '<div class="lg-teacher" id="lg-teacher">I’m the teacher</div>';
    $$('#lg-pad button').forEach(function(b){ b.addEventListener('click', function(){ press(b.dataset.k); }); });
    $('#lg-teacher').addEventListener('click', function(){ $('#lg-err').textContent='Teacher code: 1357 (demo)'; });
  }
  function press(k){
    if(k==='x'){ codeBuf=codeBuf.slice(0,-1); }
    else if(k==='ok'){ return submit(); }
    else if(codeBuf.length<4){ codeBuf+=k; }
    $$('#lg-dots i').forEach(function(d,i){ d.classList.toggle('on', i<codeBuf.length); });
    if(codeBuf.length===4) submit();
  }
  function submit(){
    if(codeBuf===STUDENT_CODE){ unlock(false); }
    else if(codeBuf===TEACHER_CODE){ unlock(true); }
    else { $('#lg-err').textContent='Not the right code — try again.'; codeBuf=''; $$('#lg-dots i').forEach(function(d){d.classList.remove('on');}); }
  }
  function unlock(isTeacher){
    $('#lockgate').classList.add('hidden');
    var welcome=S.logSession();
    G.Scroll.render();
    if (welcome.welcome) toast('Welcome back! +'+welcome.welcome+' 文 for clearing your dues');
    else if (welcome.floor) toast('Checked in · +'+welcome.floor+' 文 attendance · '+S.get().streak+'-day streak');
    if (isTeacher) setTimeout(function(){ G.Screens.open('teacher'); }, 400);
  }
  function lock(){
    if (G.Trial && G.Trial.on()){ G.Trial.relock(); return; }   // trial has no class code — return to the trial gate
    codeBuf=''; buildLock(); $('#lockgate').classList.remove('hidden');
  }

  // ───────── boot ─────────
  function boot(){
    S=G.State; C=G.Content;
    var loadEl=$('#loading');
    C.load().then(function(){
      S.load();
      G.Scroll.init();
      if(loadEl) loadEl.style.display='none';
      if (G.Trial && G.Trial.on()) G.Trial.start({ onPlay:unlock }); else buildLock();
    }).catch(function(err){
      if(loadEl) loadEl.innerHTML='<div style="padding:40px;text-align:center;color:#8E7F79">'+
        '<h2 style="font-family:var(--serif)">Couldn’t load the character graph</h2>'+
        '<p>Run this from a local server (file:// blocks fetch):</p>'+
        '<pre style="background:#FBEFE9;padding:14px;border-radius:10px;display:inline-block">cd '+location.pathname.replace(/\/[^/]*$/,'')+'\npython3 -m http.server 8000</pre>'+
        '<p style="font-size:12px">'+esc(String(err))+'</p></div>';
      console.error(err);
    });
  }

  G.App={ beginStage:beginStage, claimSeal:claimSeal, reviewRun:reviewRun, toast:toast, lock:lock, boot:boot };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.GAME = window.GAME || {});
