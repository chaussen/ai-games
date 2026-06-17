/* game/scroll.js — The Scroll (home base) + the 3-band Stage Sheet
   The integration host: the handscroll from the Journey, now driven by the
   book playlists + the two-currency State. Header carries rank/XP AND the 文
   wallet (spec §5.1); the mastery ring → Parts Deck, the 文 chip → Store, the
   复习 badge → Review Hub. Tapping a stage opens the 3-band arc (§3.2). */
(function (G) {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  var S, C;

  function ruby(ch){ var py=C.pinyinOf(ch)||''; return '<ruby>'+esc(ch)+'<rt>'+esc(py)+'</rt></ruby>'; }

  // 文 cash-coin SVG (spec §10): round coin, square hole, 文 glyph above the hole
  function wenCoin(cls){
    return '<svg class="wencoin '+(cls||'')+'" viewBox="0 0 40 40" aria-label="wén coin">'+
      '<circle cx="20" cy="20" r="19" fill="#E9B85A"/>'+
      '<circle cx="20" cy="20" r="19" fill="none" stroke="#B97F25" stroke-width="1.5"/>'+
      '<circle cx="20" cy="20" r="15" fill="none" stroke="#C98E2E" stroke-width="1"/>'+
      '<rect x="14.5" y="14.5" width="11" height="11" rx="1.5" fill="#FFF8F0" stroke="#B97F25" stroke-width="1"/>'+
      '<text x="20" y="11.5" text-anchor="middle" font-family="Noto Serif SC,serif" font-weight="700" font-size="9" fill="#6E4A12">文</text>'+
      '</svg>';
  }

  // ───────── HEADER ─────────
  function renderHeader(){
    var st=S.get(), rk=S.rankFor(st.xp), nx=S.nextRank(rk);
    var span=nx.min-rk.min, into=st.xp-rk.min, pct=span>0?Math.min(100,Math.round(into/span*100)):100;
    var TOTAL=totalChars(), mc=masteredChars(), mpct=TOTAL?Math.round(mc/TOTAL*100):0;
    var dueN=S.dueChars().length;
    // With many chapters the tray would overflow — show earned seals + the next
    // target only (the full journey lives in the scroll + minimap).
    var allCh=S.chapters(), firstUnearned=-1;
    for(var si=0;si<allCh.length;si++){ if(st.seals.indexOf(allCh[si].id)<0){ firstUnearned=si; break; } }
    var shownCh = firstUnearned<0 ? allCh : allCh.slice(0, firstUnearned+1);
    var seals=shownCh.map(function(c){ var got=st.seals.indexOf(c.id)>=0;
      return '<span class="seal '+(got?'got':'')+'" title="'+esc(c.name)+'" style="--rc:'+c.rc+'"><span class="zh">'+c.season+'</span></span>'; }).join('');
    var streakDots=[0,1,2,3,4,5,6].map(function(d){ return '<i class="'+(d<Math.min(7,st.streak)?'on':'')+'"></i>'; }).join('');
    $('#jhead').innerHTML=
      '<button class="brandseal" id="j-lock" title="Lock for next student"><span class="zh">卷</span></button>'+
      '<div class="rankbox">'+
        '<div class="rankname"><span class="zh">'+rk.cn+'</span> <em>'+esc(rk.en)+'</em></div>'+
        '<div class="xpline"><div class="xpbar"><i style="width:'+pct+'%"></i></div>'+
          '<span class="xpnum">'+st.xp+(rk.lv<8?' / '+nx.min:'')+' <span class="zh">经验</span></span></div>'+
      '</div>'+
      '<div class="headchips">'+
        '<button class="chip wenchip" id="chip-store" title="文 wallet → Store">'+wenCoin()+
          '<span class="chip-txt"><b id="wen-v">'+st.wen+'</b><small><span class="zh">文</span> store</small></span></button>'+
        '<button class="chip deckchip" id="chip-deck" title="Parts Deck">'+
          '<div class="mastery"><svg viewBox="0 0 40 40" class="ring"><circle class="r-bg" cx="20" cy="20" r="16"/>'+
          '<circle class="r-fg" cx="20" cy="20" r="16" stroke-dasharray="'+(mpct/100*100.5).toFixed(1)+' 100.5"/></svg>'+
          '<div class="mtxt"><b>'+mc+'</b><span>/ '+TOTAL+'</span></div></div>'+
          '<span class="chip-txt"><small>偏旁部首</small><small>deck</small></span></button>'+
        (dueN?'<button class="chip reviewchip" id="chip-review" title="Review Hub"><span class="zh">复习</span><span class="chip-txt"><b>'+dueN+'</b><small>due</small></span></button>':'')+
      '</div>'+
      '<div class="hstats">'+
        '<div class="streak" title="Day streak"><div class="dots">'+streakDots+'</div><span><b>'+st.streak+'</b>-day</span></div>'+
      '</div>'+
      '<div class="sealtray" title="Chapter seals">'+seals+'</div>';
    $('#j-lock').addEventListener('click', function(){ G.App.lock(); });
    $('#chip-store').addEventListener('click', function(){ G.Screens.open('store'); });
    $('#chip-deck').addEventListener('click', function(){ G.Screens.open('deck'); });
    var rc=$('#chip-review'); if(rc) rc.addEventListener('click', function(){ G.Screens.open('review'); });
  }
  function totalChars(){ return C.units().reduce(function(a,u){ return a+u.writeChars.length; },0); }
  function masteredChars(){ var st=S.get(), n=0; C.units().forEach(function(u){ if(st.cleared[u.id]!=null) n+=u.writeChars.length; }); return n; }

  // ───────── node sequence ─────────
  var NODES=[];
  function buildNodes(){ NODES=[]; S.chapters().forEach(function(c){ c.units.forEach(function(u){ NODES.push({kind:'unit',ch:c.id,u:u}); }); NODES.push({kind:'gate',ch:c.id}); }); }
  function nodeKey(nd){ return nd.kind==='gate'?'G'+nd.ch:nd.u; }

  function unitState(u){
    var st=S.get(), ch=S.chapterOf(u);
    if (st.cleared[u]!=null) return 'done';
    if (!S.chapterUnlocked(ch.id)) return 'locked';
    // current = earliest uncleared unit in unlocked chapters
    return u===earliestOpen()?'current':'locked';
  }
  function earliestOpen(){
    var st=S.get(), chs=S.chapters();
    for(var i=0;i<chs.length;i++){ if(!S.chapterUnlocked(chs[i].id)) break;
      for(var j=0;j<chs[i].units.length;j++){ var u=chs[i].units[j]; if(st.cleared[u]==null) return u; } }
    return null;
  }
  function gateState(id){ var st=S.get(); if(st.seals.indexOf(id)>=0) return 'done';
    if(S.chapterUnlocked(id)&&S.chapterCleared(id)) return 'current'; return 'locked'; }

  // ───────── build scroll DOM ─────────
  var STEP=300, START=190, ENDPAD=240, Wtotal=0, layoutPts=[];
  function nodeHTML(nd){
    if(nd.kind==='gate'){ var c=S.chapterById(nd.ch), gs=gateState(nd.ch);
      return '<button class="node gate" data-key="G'+nd.ch+'" data-kind="gate" data-ch="'+nd.ch+'" data-state="'+gs+'" style="--rc:'+c.rc+';--rc-soft:'+c.soft+';--rc-tint:'+c.tint+'">'+
        '<span class="gateseal"><span class="zh">'+(gs==='locked'?'关':c.season)+'</span>'+(gs==='done'?'<span class="tick">✓</span>':'')+'</span>'+
        '<span class="cap"><span class="num"><span class="zh">'+c.season+'印</span> · Chapter seal</span>'+
          '<span class="th">'+(gs==='done'?'Earned':gs==='current'?'Claim it':'Sealed')+'</span></span></button>'; }
    var c2=S.chapterOf(nd.u), unit=C.unitById(nd.u), st=unitState(nd.u), stars=S.get().stars[nd.u], due=S.unitDue(nd.u)&&st==='done';
    var glyph=unit.writeChars[0]||'字';
    var inner = st==='locked'?'<span class="lock">🔒</span>':'<span class="g zh">'+esc(glyph)+'</span>';
    var starRow=''; if(st==='done'){ var sr=''; for(var i=0;i<3;i++) sr+='<i class="'+(i<stars?'on':'')+'">★</i>'; starRow='<div class="stars">'+sr+'</div>'; }
    var pin = st==='current'?'<span class="youare"><span class="zh">你在这里</span><em>start here</em></span>':'';
    var begin = st==='current'?'<span class="startpill"><span class="zh">开始</span></span>':'';
    var dueBadge = due?'<span class="duebadge" title="Due for review">复习</span>':'';
    var uno=unit.id.split('-u')[1];
    return '<button class="node'+(due?' faded':'')+'" data-key="'+nd.u+'" data-kind="unit" data-u="'+nd.u+'" data-state="'+st+'" style="--rc:'+c2.rc+';--rc-soft:'+c2.soft+';--rc-tint:'+c2.tint+'">'+
      pin+'<span class="seal2">'+inner+begin+dueBadge+'</span>'+
      '<span class="cap"><span class="num"><span class="zh">第'+uno+'单元</span></span>'+
        (st==='locked'?'':'<span class="th"><span class="zh">'+esc(unit.theme.zh)+'</span> · '+esc(unit.theme.en)+'</span>')+starRow+'</span></button>';
  }

  // The chapter's lead theme — the "动物" half of "秋之卷 · 动物朋友" — so the
  // scroll wording always reads as a named volume, not a bare season glyph.
  function leadTheme(c){ var u=C.unitById(c.units[0]); return (u&&u.theme)||null; }

  function renderScroll(){
    buildNodes();
    var canvas=$('#canvas');
    Wtotal=START+(NODES.length-1)*STEP+ENDPAD; canvas.style.width=Wtotal+'px';
    var panels=''; var chs=S.chapters();
    chs.forEach(function(c){
      var unlocked=S.chapterUnlocked(c.id), state=unlocked?(S.chapterCleared(c.id)&&gateState(c.id)==='done'?'done':'open'):'locked';
      var lt=leadTheme(c);
      var sname=lt?(esc(lt.zh)+' · '+esc(lt.en)):esc(c.name);
      panels+='<div class="scene" data-ch="'+c.id+'" data-state="'+state+'" style="--rc:'+c.rc+';--rc-soft:'+c.soft+';--rc-tint:'+c.tint+'">'+
        '<div class="scene-wash"></div><div class="scene-glyph zh">'+c.season+'</div>'+
        '<div class="cartouche"><span class="vol zh">'+c.vol+'</span><span class="ssub zh">'+c.sub+'之卷</span><span class="sname">'+sname+'</span></div></div>';
    });
    canvas.innerHTML='<svg class="road" id="road" preserveAspectRatio="none"><path class="road-base"/><path class="road-done"/></svg>'+
      '<div class="scenes" id="scenes">'+panels+'</div>'+
      '<div class="nodes" id="nodes">'+NODES.map(nodeHTML).join('')+'</div>';
    bindNodes(); layout(); renderMiniMap();
  }

  function layout(){
    var stage=$('#stage'), H=stage.clientHeight||600, canvas=$('#canvas'); canvas.style.height=H+'px';
    var midY=H*0.5, amp=Math.min(H*0.17,132); layoutPts=[];
    $$('#nodes .node').forEach(function(el,i){ var x=START+i*STEP, y=midY+amp*Math.sin(i*0.66+0.6); el.style.left=x+'px'; el.style.top=y+'px'; layoutPts.push([x,y]); });
    var sceneEls=$$('#scenes .scene'), idx=0, chs=S.chapters();
    chs.forEach(function(c,si){ var firstI=idx, lastI=idx+c.units.length; idx=lastI+1;
      var leftX=si===0?0:(layoutPts[firstI-1][0]+layoutPts[firstI][0])/2;
      var rightX=si===chs.length-1?Wtotal:(layoutPts[lastI][0]+layoutPts[lastI+1][0])/2;
      var p=sceneEls[si]; p.style.left=leftX+'px'; p.style.width=(rightX-leftX)+'px'; });
    var svg=$('#road'); svg.setAttribute('width',Wtotal); svg.setAttribute('height',H); svg.setAttribute('viewBox','0 0 '+Wtotal+' '+H);
    $('.road-base',svg).setAttribute('d', pathThrough(layoutPts));
    var ci=currentIndex(); $('.road-done',svg).setAttribute('d', ci>0?pathThrough(layoutPts.slice(0,ci+1)):'');
    updateViewport();
  }
  function pathThrough(pts){ if(!pts.length) return ''; var d='M '+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
    for(var i=1;i<pts.length;i++){ var a=pts[i-1],b=pts[i]; var c1=[a[0]+(b[0]-a[0])*0.5,a[1]],c2=[b[0]-(b[0]-a[0])*0.5,b[1]];
      d+=' C '+c1[0].toFixed(1)+' '+c1[1].toFixed(1)+', '+c2[0].toFixed(1)+' '+c2[1].toFixed(1)+', '+b[0].toFixed(1)+' '+b[1].toFixed(1); } return d; }
  function currentIndex(){ for(var i=0;i<NODES.length;i++){ var nd=NODES[i];
      if(nd.kind==='unit'&&unitState(nd.u)==='current') return i;
      if(nd.kind==='gate'&&gateState(nd.ch)==='current') return i; }
    var last=0; for(var j=0;j<NODES.length;j++){ var d=NODES[j];
      if((d.kind==='unit'&&unitState(d.u)==='done')||(d.kind==='gate'&&gateState(d.ch)==='done')) last=j; } return last; }

  function bindNodes(){ $$('#nodes .node').forEach(function(n){ n.addEventListener('click', function(){ if(dragMoved) return;
    if(n.dataset.kind==='gate') openGate(n.dataset.ch); else openStage(n.dataset.u); }); }); }

  // ───────── minimap ─────────
  function renderMiniMap(){
    var mm=$('#minimap'), Wb=mm.clientWidth||800, scale=Wb/Wtotal, segs='', dots='', idx=0, chs=S.chapters();
    chs.forEach(function(c,si){ var firstI=idx, lastI=idx+c.units.length; idx=lastI+1;
      var leftX=si===0?0:(layoutPts[firstI-1][0]+layoutPts[firstI][0])/2;
      var rightX=si===chs.length-1?Wtotal:(layoutPts[lastI][0]+layoutPts[lastI+1][0])/2;
      segs+='<div class="mm-seg" style="left:'+(leftX*scale)+'px;width:'+((rightX-leftX)*scale)+'px;background:'+c.tint+';border-color:'+c.soft+'"></div>'; });
    NODES.forEach(function(nd,i){ var st=nd.kind==='gate'?gateState(nd.ch):unitState(nd.u);
      var rc=S.chapterById(nd.ch).rc; var cls='mm-dot'+(nd.kind==='gate'?' gate':'')+(st==='current'?' cur':'')+(st==='locked'?' lk':'');
      var style='left:'+(layoutPts[i][0]*scale)+'px'+(st==='current'?';box-shadow:0 0 0 3px '+rc:'');
      dots+='<span class="'+cls+'" style="'+style+'"></span>'; });
    mm.innerHTML='<div class="mm-track">'+segs+dots+'<div class="mm-window" id="mm-window"></div></div>';
    $('.mm-track',mm).addEventListener('pointerdown', function(e){ var rect=this.getBoundingClientRect(); var x=e.clientX-rect.left;
      var stage=$('#stage'); stage.scrollLeft=(x/rect.width)*Wtotal-stage.clientWidth/2; mmDragging=true; });
    mm.addEventListener('pointermove', function(e){ if(!mmDragging) return; var rect=$('.mm-track',mm).getBoundingClientRect(); var x=e.clientX-rect.left; var stage=$('#stage'); stage.scrollLeft=(x/rect.width)*Wtotal-stage.clientWidth/2; });
    window.addEventListener('pointerup', function(){ mmDragging=false; });
    updateViewport();
  }
  var mmDragging=false;
  function updateViewport(){ var mm=$('#minimap'); if(!mm||!$('#mm-window')) return; var Wb=mm.clientWidth||800, scale=Wb/Wtotal, stage=$('#stage');
    var w=$('#mm-window'); w.style.left=(stage.scrollLeft*scale)+'px'; w.style.width=(stage.clientWidth*scale)+'px'; }
  function scrollToNode(key, smooth){ var i=-1; NODES.forEach(function(nd,k){ if(nodeKey(nd)===key) i=k; }); if(i<0) return;
    var stage=$('#stage'); stage.scrollTo({ left:layoutPts[i][0]-stage.clientWidth/2, behavior:smooth?'smooth':'auto' }); }

  // ───────── THE 3-BAND STAGE SHEET ─────────
  function applyRC(c){ var r=document.documentElement.style; r.setProperty('--rc',c.rc); r.setProperty('--rc-soft',c.soft); r.setProperty('--rc-tint',c.tint); }
  function openStage(u){
    var st=S.get(), unit=C.unitById(u), c=S.chapterOf(u), state=unitState(u), due=S.unitDue(u)&&state==='done'; applyRC(c);
    var arc=C.resolveStage(u, st.owned);
    var head='<div class="sh-eyebrow"><span class="dot"></span><span class="zh" style="margin-right:7px">'+c.sub+'之卷</span>'+esc(c.name)+'</div>'+
      '<h2><span class="zh">'+esc(unit.theme.zh)+'</span> · '+esc(unit.theme.en)+'</h2>'+
      '<p class="sh-sub">'+unit.writeChars.length+' target characters · '+arc.bands.parts.length+' parts · the forging arc below</p>';
    var body=bandRail(arc, state);
    var cfg=S.get().config, foot;
    if (state==='locked'){
      body+='<div class="sh-locked">🔒 Clear the stage before this one to unroll <span class="zh">'+esc(unit.theme.zh)+'</span>.</div>';
      foot='<button class="jbtn ghost" data-act="close">Back</button>';
    } else if (due){
      body+='<div class="sh-reward"><div class="rewardchip">+'+cfg.dueWen+' <span class="zh">文</span></div><span>The ink on some characters has <b>faded</b>. A quick review re-inks them and pays <b>'+cfg.dueWen+' 文</b> each due character.</span></div>';
      foot='<button class="jbtn ghost" data-act="close">Later</button><button class="jbtn solid" data-act="review"><span class="zh">复习</span> Refresh ink ›</button>';
    } else if (state==='done'){
      var sr=''; for(var i=0;i<3;i++) sr+='<i class="'+(i<st.stars[u]?'on':'')+'">★</i>';
      body+='<div class="sh-reward"><div class="bigstars">'+sr+'</div><span>Cleared with <b>'+st.stars[u]+' / 3 stars</b>. Re-practising a cleared stage pays just <b>+'+cfg.nonDueWen+' 文</b> (only due reviews pay full).</span></div>';
      foot='<button class="jbtn ghost" data-act="close">Back</button><button class="jbtn solid" data-act="begin">↻ Practise again</button>';
    } else {
      body+='<div class="sh-reward"><div class="rewardchip">+'+cfg.completionWen+' <span class="zh">文</span></div><span>Clear the arc for <b>+'+cfg.completionWen+' 文</b> (any stars), up to <b>★★★</b> XP, and ink '+arc.bands.wholes.length+' characters onto your scroll.</span></div>';
      foot='<button class="jbtn ghost" data-act="close">Not now</button><button class="jbtn solid" data-act="begin">Begin <span class="zh">开始</span> ›</button>';
    }
    showSheet(head, body, foot, function(act){ if(act==='begin') G.App.beginStage(u,false); else if(act==='review') G.App.beginStage(u,true); else closeSheet(); });
  }

  function bandRail(arc, state){
    var bands=[
      { key:'parts', no:1, zh:'偏旁部首', en:'Parts', sub:'stroke atoms & sub-builds', items:arc.bands.parts.map(function(p){
          var sObj=S.get(); var owned=sObj.owned[p.char]; var stt = owned?(S.isCharDue(p.char)?'review':'owned'):'new';
          return { ch:p.char, tag:C.grainLabel(p.grain).zh, st:stt }; }) },
      { key:'wholes', no:2, zh:'合字', en:'Wholes', sub:'this stage’s characters', items:arc.bands.wholes.map(function(w){
          var sObj=S.get(); var done=sObj.cleared[arc.id]!=null; var stt= done?(S.isCharDue(w.char)?'review':'owned'):(state==='locked'?'locked':'new');
          return { ch:w.char, tag:C.grainLabel(w.grain).zh, st:stt }; }) },
      { key:'use', no:3, zh:'应用', en:'Use', sub:'word · sentence', items:arc.bands.use.map(function(uu){
          return { ch:uu.text, tag:uu.type, st:state==='locked'?'locked':'new', wide:true }; }) }
    ];
    var rail=bands.map(function(b){
      var cps=b.items.length? b.items.map(function(it){
        var chHtml = it.wide ? '<span class="cp-ch zh" style="font-size:20px">'+esc(it.ch)+'</span>' : '<span class="cp-ch zh">'+ruby(it.ch)+'</span>';
        return '<div class="cp" data-st="'+it.st+'"'+(it.wide?' style="min-width:auto;padding:8px 12px"':'')+'>'+chHtml+'<span class="cp-tag">'+esc(it.tag)+'</span></div>';
      }).join('') : '<div class="band-empty">— built from owned parts —</div>';
      return '<div class="band" data-band="'+b.key+'"><div class="band-head"><span class="band-no">'+b.no+'</span>'+
        '<span class="band-title"><span class="zh">'+b.zh+'</span>'+b.en+'</span><span class="band-sub">'+b.sub+'</span></div>'+
        '<div class="cps">'+cps+'</div></div>';
    }).join('');
    return '<div class="bandrail">'+rail+'</div>';
  }

  function openGate(id){
    var c=S.chapterById(id), st=gateState(id); applyRC(c); var cfg=S.get().config;
    var head='<div class="sh-eyebrow"><span class="dot"></span>'+(st==='done'?'Seal earned':st==='current'?'Chapter checkpoint':'Sealed chapter')+'</div>'+
      '<h2><span class="zh">'+c.season+'印</span> · '+esc(c.name)+'</h2>'+
      '<p class="sh-sub">'+c.vol+' · clear all stages to earn the seal.</p>';
    var body='<div class="gateart"><span class="gs zh" style="color:'+c.rc+'">'+c.season+'</span></div>', foot;
    if(st==='done'){ body+='<div class="sh-reward"><span>Seal collected — the next chapter is open.</span></div>'; foot='<button class="jbtn solid" data-act="close">Continue</button>'; }
    else if(st==='current'){ body+='<div class="sh-reward"><div class="rewardchip">+'+cfg.sealWen+' <span class="zh">文</span></div><span>All stages cleared. Claim the seal for <b>+'+cfg.sealWen+' 文</b>, <b>+'+cfg.sealXp+' XP</b>, and unroll the next chapter.</span></div>'; foot='<button class="jbtn solid" data-act="claim">Claim the <span class="zh">'+c.season+'</span> seal</button>'; }
    else { var done=c.units.filter(function(u){return S.get().cleared[u]!=null;}).length; body+='<div class="sh-locked">🔒 Clear all '+c.units.length+' stages first — <b>'+done+' / '+c.units.length+'</b> done.</div>'; foot='<button class="jbtn ghost" data-act="close">Back</button>'; }
    showSheet(head, body, foot, function(act){ if(act==='claim') G.App.claimSeal(id); else closeSheet(); });
  }

  function showSheet(head, body, foot, onAct){
    var el=$('#sheet'); $('.sheet__head',el).innerHTML=head; $('.sheet__body',el).innerHTML=body; $('.sheet__foot',el).innerHTML=foot;
    $$('.sheet__foot [data-act]',el).forEach(function(b){ b.addEventListener('click', function(){ onAct(b.dataset.act); }); });
    el.classList.add('open'); $('#scrim').classList.add('on');
  }
  function closeSheet(){ $('#sheet').classList.remove('open'); $('#scrim').classList.remove('on'); }

  // ───────── pan / nav ─────────
  var dragMoved=false;
  function initPan(){
    var stage=$('#stage');
    stage.addEventListener('wheel', function(e){ if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){ stage.scrollLeft+=e.deltaY; e.preventDefault(); } },{passive:false});
    var down=false,sx=0,sl=0;
    stage.addEventListener('pointerdown', function(e){ if(e.target.closest('.node')){down=false;return;} down=true; dragMoved=false; sx=e.clientX; sl=stage.scrollLeft; stage.classList.add('grabbing'); });
    window.addEventListener('pointermove', function(e){ if(!down) return; var dx=e.clientX-sx; if(Math.abs(dx)>4) dragMoved=true; stage.scrollLeft=sl-dx; });
    window.addEventListener('pointerup', function(){ down=false; stage.classList.remove('grabbing'); setTimeout(function(){dragMoved=false;},30); });
    stage.addEventListener('scroll', updateViewport);
    $('#nav-prev').addEventListener('click', function(){ stepChapter(-1); });
    $('#nav-next').addEventListener('click', function(){ stepChapter(1); });
    $('#nav-here').addEventListener('click', function(){ var o=earliestOpen(); scrollToNode(o||'G'+S.chapters()[0].id, true); });
  }
  function stepChapter(dir){
    var stage=$('#stage'), cx=stage.scrollLeft+stage.clientWidth/2, chs=S.chapters(), starts=[], k=0;
    chs.forEach(function(c){ starts.push(layoutPts[k][0]); k+=c.units.length+1; });
    var ci=0; for(var i=0;i<starts.length;i++) if(cx>=starts[i]-150) ci=i;
    var ni=Math.max(0,Math.min(chs.length-1,ci+dir)); scrollToNode(chs[ni].units[0], true);
  }

  // ───────── public ─────────
  function render(){ renderHeader(); renderScroll(); }
  function init(){
    S=G.State; C=G.Content; render(); initPan();
    document.addEventListener('click', function(e){ if(e.target&&e.target.id==='scrim') closeSheet(); });
    var rT; window.addEventListener('resize', function(){ cancelAnimationFrame(rT); rT=requestAnimationFrame(function(){ layout(); renderMiniMap(); }); });
    var o=earliestOpen();
    function restore(){ scrollToNode(o||'G'+S.chapters()[0].id, false); updateViewport(); }
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ layout(); renderMiniMap(); restore(); });
    setTimeout(function(){ layout(); renderMiniMap(); restore(); },300);
  }
  G.Scroll={ init:init, render:render, closeSheet:closeSheet, scrollToNode:scrollToNode, wenCoin:wenCoin };
})(window.GAME = window.GAME || {});
