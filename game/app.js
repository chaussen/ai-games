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
  function confetti(host, colors){ var f=document.createDocumentFragment();
    for(var i=0;i<48;i++){ var b=document.createElement('i'); b.className='confetti-bit'; b.style.left=(Math.random()*100)+'%';
      b.style.background=colors[i%colors.length]; b.style.animationDelay=(Math.random()*0.5)+'s';
      b.style.animationDuration=(1.6+Math.random()*1.4)+'s'; b.style.width=b.style.height=(6+Math.random()*8)+'px'; f.appendChild(b); }
    host.appendChild(f); setTimeout(function(){ $$('.confetti-bit',host).forEach(function(x){x.remove();}); },3400); }

  function ceremonyStageClear(unit, stars, wen, xp, isReview, onGo){
    var o=ov(); o.className='overlay show';
    var sr=''; for(var k=0;k<3;k++) sr+='<i class="'+(k<stars?'on':'')+'">★</i>';
    o.innerHTML='<div class="ov-card">'+
      '<div class="ov-eyebrow"><span class="dot"></span>'+(isReview?'Ink refreshed · 复习':'Stage clear · <span class="zh">炼成</span>')+'</div>'+
      '<div class="bigstars" style="font-size:34px;margin:0 auto 14px">'+sr+'</div>'+
      '<div class="ov-big"><span class="zh">'+esc(unit.theme.zh)+'</span></div><div class="ov-py">'+esc(unit.theme.en)+'</div>'+
      '<div class="ov-en"><b>+'+wen+' 文</b> to your wallet · <b>+'+xp+' 经验</b> to rank</div>'+
      '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 28px">Collect <span class="zh">收</span> ›</button></div>';
    confetti(o, ['#3E8E72','#2F7DA6','#C2603A','#7E4B86','#E0A23A']);
    $('#ov-go').addEventListener('click', function(){ flyCoins(wen); o.className='overlay'; if(onGo) onGo(); });
  }
  function ceremonyReview(n, wen, xp, onGo){
    var o=ov(); o.className='overlay show';
    o.innerHTML='<div class="ov-card"><div class="ov-eyebrow"><span class="dot"></span>Review complete · <span class="zh">复习</span></div>'+
      '<div class="ov-rankseal zh">复</div>'+
      '<div class="ov-en"><b>'+n+'</b> characters re-inked · <b>+'+wen+' 文</b> · <b>+'+xp+' 经验</b></div>'+
      '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 28px">Back to scroll <span class="zh">继续</span></button></div>';
    confetti(o, ['#E0A23A','#3E8E72','#fff']);
    $('#ov-go').addEventListener('click', function(){ flyCoins(wen); o.className='overlay'; if(onGo) onGo(); });
  }
  function ceremonySeal(c, wen, xp, onGo){
    var o=ov(); o.className='overlay show';
    o.innerHTML='<div class="ov-card"><div class="ov-eyebrow"><span class="dot"></span>Chapter sealed · <span class="zh">得印</span></div>'+
      '<div class="ov-rankseal big zh" style="background:'+c.rc+'">'+c.season+'</div>'+
      '<div class="ov-big"><span class="zh">'+c.sub+'印</span> '+esc(c.name)+'</div>'+
      '<div class="ov-en">'+c.vol+' complete · <b>+'+wen+' 文</b> · <b>+'+xp+' 经验</b>. A new chapter unrolls.</div>'+
      '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 28px">Onward <span class="zh">继续</span></button></div>';
    confetti(o, [c.rc, c.soft, '#E0A23A', '#fff']);
    $('#ov-go').addEventListener('click', function(){ flyCoins(wen); o.className='overlay'; if(onGo) onGo(); });
  }
  function ceremonyRankUp(rank){
    var o=ov(); o.className='overlay show';
    o.innerHTML='<div class="ov-card"><div class="ov-eyebrow"><span class="dot"></span>Rank up · <span class="zh">升级</span></div>'+
      '<div class="ov-rankseal zh">'+rank.cn.charAt(0)+'</div>'+
      '<div class="ov-big"><span class="zh">'+rank.cn+'</span></div><div class="ov-py">'+esc(rank.py)+'</div>'+
      '<div class="ov-en">You are now a <b>'+esc(rank.en)+'</b> · level '+rank.lv+'</div>'+
      '<button class="jbtn solid" id="ov-go" style="display:inline-flex;flex:0 0 auto;padding:14px 28px">Continue <span class="zh">继续</span></button></div>';
    confetti(o, ['#3E8E72','#2F7DA6','#C2603A','#7E4B86','#E0A23A']);
    $('#ov-go').addEventListener('click', function(){ o.className='overlay'; });
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
  function lock(){ codeBuf=''; buildLock(); $('#lockgate').classList.remove('hidden'); }

  // ───────── boot ─────────
  function boot(){
    S=G.State; C=G.Content;
    var loadEl=$('#loading');
    C.load().then(function(){
      S.load();
      G.Scroll.init();
      if(loadEl) loadEl.style.display='none';
      buildLock();
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
