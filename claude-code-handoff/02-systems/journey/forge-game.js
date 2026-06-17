/* forge-game.js — 炼字坊 · The Forge (a game, not a tutorial)
   Three rounds, three grains of forging — escalating challenge:
     1) STROKE forge   日  — tap the strokes in correct writing order
     2) COMPONENT forge 明  — pick the right meaning-parts (decoys are lookalikes)
     3) RADICAL forge   妈  — pick the MEANING radical (recall) + the SOUND part (match pinyin)
   Real decisions, wrong picks crack the iron, a heat bar sets the pace,
   stars reward speed + accuracy. Vanilla JS. Stroke data: makemeahanzi. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SD = window.FORGE_STROKES || {};

  // rainbow stroke palette (matches the textbook stroke-cell generator)
  function strokePalette(n){ var o=[]; for(var i=0;i<n;i++){ var t=n<=1?0:i/(n-1); o.push('hsl('+(8+t*282).toFixed(1)+' 70% 45%)'); } return o; }
  function ghostSVG(ch){ var d=SD[ch]; if(!d) return '';
    var paths=d.s.map(function(p){ return '<path d="'+p+'" fill="#E7D9D0"/>'; }).join('');
    return tianzi()+'<g transform="translate(0,900) scale(1,-1)">'+paths+'</g>';
  }
  function strokePathColored(ch, i, col){ var d=SD[ch]; if(!d) return '';
    return '<g transform="translate(0,900) scale(1,-1)"><path d="'+d.s[i]+'" fill="'+col+'"/></g>'; }
  function strokePieceSVG(ch, i, col){ var d=SD[ch]; if(!d) return '';
    return '<svg viewBox="0 0 1024 1024"><g transform="translate(0,900) scale(1,-1)"><path d="'+d.s[i]+'" fill="'+col+'"/></g></svg>'; }
  function tianzi(){ return '<rect x="6" y="6" width="1012" height="1012" rx="14" fill="none" stroke="#EFDDD5" stroke-width="6"/>'+
    '<line x1="512" y1="6" x2="512" y2="1018" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>'+
    '<line x1="6" y1="512" x2="1018" y2="512" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>'; }

  // ───────── rounds ─────────
  var ROUNDS = [
    { grain:'stroke', accent:'#C2603A', soft:'#F0C9B4', tint:'#FBEAE0',
      char:'日', py:'rì', meaning:'sun · day', cat:'象形', catEn:'Pictograph',
      teach:'A pictograph is drawn in one piece — so you forge it stroke by stroke. Write them in the right order.' },
    { grain:'component', accent:'#2F7DA6', soft:'#BBD7E6', tint:'#E3EFF4',
      char:'明', py:'míng', meaning:'bright', cat:'会意', catEn:'Compound idea',
      teach:'Two meanings combine. Pick the two parts whose <b>meanings</b> add up to “bright”. Watch the look-alikes.',
      slots:[{type:'meaning',label:'义 meaning'},{type:'meaning',label:'义 meaning'}],
      pool:[
        {ch:'日',meaning:'sun',correct:true,slot:0,mine:true},
        {ch:'月',meaning:'moon',correct:true,slot:1},
        {ch:'目',meaning:'eye',correct:false},
        {ch:'田',meaning:'field',correct:false},
        {ch:'肉',meaning:'meat',correct:false} ] },
    { grain:'radical', accent:'#7E4B86', soft:'#D8C4DB', tint:'#F1E8F2',
      char:'妈', py:'mā', meaning:'mother', cat:'形声', catEn:'Sound + meaning',
      teach:'You know it’s said <b>mā</b>. Pick the radical that gives the <b>meaning</b>, then the part that gives the <b>sound</b>.',
      slots:[{type:'meaning',label:'形 meaning'},{type:'sound',label:'声 sound'}],
      pool:[
        {ch:'女',meaning:'woman',type:'meaning',correct:true,slot:0},
        {ch:'母',meaning:'mother',type:'meaning',correct:false},
        {ch:'子',meaning:'child',type:'meaning',correct:false},
        {ch:'马',py:'mǎ',type:'sound',correct:true,slot:1},
        {ch:'鸟',py:'niǎo',type:'sound',correct:false},
        {ch:'与',py:'yǔ',type:'sound',correct:false} ] },
  ];

  // ───────── state ─────────
  var LS='ccs-forgegame-v1';
  var sessionBest;
  try{ sessionBest=JSON.parse(localStorage.getItem(LS))||{best:0,runs:0}; }catch(e){ sessionBest={best:0,runs:0}; }
  var G;  // live run
  function newRun(){ return { i:0, score:0, combo:0, maxCombo:0, forged:[], stars:[], heat:100, cracks:0, placed:[], slotFill:[], done:false, timer:null, t0:0 }; }
  var opts={ hints:true, sound:true };

  function applyAccent(r){ var s=document.documentElement.style; s.setProperty('--rc',r.accent); s.setProperty('--rc-soft',r.soft); s.setProperty('--rc-tint',r.tint); }

  // ───────── header ─────────
  function renderHUD(){
    var r=ROUNDS[G.i];
    $('#hud').innerHTML =
      '<div class="hud-round"><span class="hr-step">Round '+(G.i+1)+' / '+ROUNDS.length+'</span>'+
        '<span class="hr-cat"><span class="zh">'+r.cat+'</span> · '+r.catEn+'</span></div>'+
      '<div class="hud-mid">'+
        '<div class="combo '+(G.combo>1?'on':'')+'">×'+Math.max(1,G.combo)+' <span>combo</span></div>'+
        '<div class="heatwrap" title="The iron is cooling — forge fast for more stars">'+
          '<div class="heatbar"><i id="heatfill" style="width:'+G.heat+'%"></i></div>'+
          '<span class="heatlbl zh">火</span></div>'+
      '</div>'+
      '<div class="hud-score"><b id="scorev">'+G.score+'</b><span>score</span></div>';
  }
  function renderRail(){
    $('#rail').innerHTML = ROUNDS.map(function(r,i){
      var st = i<G.i?'done':(i===G.i?'cur':'todo');
      var stars = G.stars[i];
      var sv=''; if(st==='done'){ for(var k=0;k<3;k++) sv+='<i class="'+(k<stars?'on':'')+'">★</i>'; }
      return '<div class="railnode '+st+'" style="--rc:'+r.accent+'"><span class="rn-ch zh">'+(st==='todo'?'?':r.char)+'</span>'+
        '<span class="rn-grain">'+r.grain+'</span>'+(sv?'<span class="rn-stars">'+sv+'</span>':'')+'</div>';
    }).join('<span class="raillink"></span>');
  }

  // ───────── heat ─────────
  function startHeat(){
    G.t0=Date.now(); G.heat=100;
    clearInterval(G.timer);
    G.timer=setInterval(function(){
      if(G.done) return;
      G.heat=Math.max(0, G.heat-0.55);
      var f=$('#heatfill'); if(f){ f.style.width=G.heat+'px'; f.parentNode.dataset.zone=heatZone(); f.style.width=G.heat+'%'; }
      var hw=$('.heatwrap'); if(hw) hw.dataset.zone=heatZone();
    },90);
  }
  function heatZone(){ return G.heat>62?'hot':G.heat>30?'warm':'cool'; }
  function starsFromHeat(){ var s=G.heat>62?3:G.heat>26?2:1; s-=Math.min(2,Math.floor(G.cracks/2)); return Math.max(1,s); }
  function crack(){ G.combo=0; G.cracks++; G.heat=Math.max(4,G.heat-14); renderHUD(); shake(); }
  function reward(base){ G.combo++; G.maxCombo=Math.max(G.maxCombo,G.combo); var pts=base*Math.max(1,G.combo); G.score+=pts; renderHUD(); return pts; }

  // ───────── render round ─────────
  function renderRound(){
    var r=ROUNDS[G.i]; applyAccent(r);
    G.placed=[]; G.slotFill=(r.slots||[]).map(function(){return null;}); G.done=false;
    renderHUD(); renderRail();
    $('#teach').innerHTML='<span class="tc-target"><span class="tc-ch zh">'+r.char+'</span><span class="tc-meta"><b>'+r.py+'</b> · '+r.meaning+'</span></span>'+
      '<span class="tc-idea">'+r.teach+'</span>';
    if(r.grain==='stroke') renderStroke(r); else renderParts(r);
    startHeat();
  }

  // ── STROKE ──
  function renderStroke(r){
    var n=SD[r.char].s.length, cols=strokePalette(n);
    G.order=[]; for(var k=0;k<n;k++) G.order.push(k);
    // scrambled tray
    var tray=G.order.slice(); for(var a=tray.length-1;a>0;a--){ var b=Math.floor(Math.random()*(a+1)); var t=tray[a];tray[a]=tray[b];tray[b]=t; }
    G.next=0;
    var pieces=tray.map(function(i){ return '<button class="spiece" data-i="'+i+'">'+strokePieceSVG(r.char,i,cols[i])+
      (opts.hints?'<span class="sp-num">'+(i+1)+'</span>':'')+'</button>'; }).join('');
    $('#arena').innerHTML =
      '<div class="stroke-stage">'+
        '<div class="canvaswrap"><svg class="charcanvas" id="charcanvas" viewBox="0 0 1024 1024">'+ghostSVG(r.char)+'</svg></div>'+
        '<div class="tray" id="tray">'+pieces+'</div>'+
      '</div>'+
      '<div class="howto" id="howto">Tap the strokes in <b>writing order</b> — 1, 2, 3…</div>';
    $$('#tray .spiece').forEach(function(b){ b.addEventListener('click', function(){ tapStroke(r, +b.dataset.i, b, cols); }); });
  }
  function tapStroke(r, i, btn, cols){
    if(G.done) return;
    if(i===G.order[G.next]){
      // correct: ink it onto the canvas
      $('#charcanvas').insertAdjacentHTML('beforeend', strokePathColored(r.char, i, cols[i]));
      var paths=$$('#charcanvas g'); var g=paths[paths.length-1]; g.classList.add('inkpop');
      btn.classList.add('used'); btn.disabled=true;
      G.next++; reward(20);
      if(G.next>=G.order.length){ winRound(r); }
    } else {
      crack(); btn.classList.add('rej'); setTimeout(function(){ btn.classList.remove('rej'); },360);
      var h=$('#howto'); if(h){ h.innerHTML='Not next — find stroke <b>'+(G.order[G.next]+1)+'</b>.'; }
    }
  }

  // ── COMPONENT / RADICAL (parts) ──
  function renderParts(r){
    var slots=r.slots.map(function(s,i){ return '<div class="slot" data-s="'+i+'" data-type="'+s.type+'"><span class="slot-lbl zh">'+s.label+'</span></div>'; }).join('<span class="slot-plus">＋</span>');
    var pool=r.pool.slice(); for(var a=pool.length-1;a>0;a--){ var b=Math.floor(Math.random()*(a+1)); var t=pool[a];pool[a]=pool[b];pool[b]=t; }
    var cards=pool.map(function(p,idx){
      var py=p.py?'<span class="pc-py">'+p.py+'</span>':'';
      var mn=(r.grain==='component')?'':''; // meanings hidden — recall required
      return '<button class="pcard" data-ch="'+p.ch+'" data-correct="'+(p.correct?1:0)+'" data-slot="'+(p.slot!=null?p.slot:'')+'" data-type="'+(p.type||'meaning')+'">'+
        (p.mine?'<span class="pc-mine" title="from your forge">炼</span>':'')+
        '<span class="pc-ch zh">'+p.ch+'</span>'+py+'</button>';
    }).join('');
    $('#arena').innerHTML =
      '<div class="parts-stage">'+
        '<div class="anvil2">'+slots+'<span class="eq">=</span><span class="target zh">'+r.char+'</span></div>'+
        '<div class="pool" id="pool">'+cards+'</div>'+
      '</div>'+
      '<div class="howto" id="howto">'+(r.grain==='radical'
        ? 'Fill <b>义/形 meaning</b> by recalling what each radical means — then match the <b>声 sound</b> to “'+r.py+'”.'
        : 'Tap the two parts whose meanings make “'+r.meaning+'”.')+'</div>';
    $$('#pool .pcard').forEach(function(b){ b.addEventListener('click', function(){ tapPart(r, b); }); });
  }
  function tapPart(r, btn){
    if(G.done || btn.disabled) return;
    var correct=btn.dataset.correct==='1';
    if(correct){
      var slotIdx=+btn.dataset.slot;
      var slot=$('.slot[data-s="'+slotIdx+'"]');
      if(G.slotFill[slotIdx]){ return; }
      G.slotFill[slotIdx]=btn.dataset.ch;
      slot.classList.add('filled');
      slot.innerHTML='<span class="slot-ch zh">'+btn.dataset.ch+'</span>'+(btn.dataset.type==='sound'?'<span class="slot-tag">声</span>':'<span class="slot-tag">'+(r.grain==='radical'?'形':'义')+'</span>');
      btn.classList.add('used'); btn.disabled=true; reward(30);
      if(G.slotFill.every(function(x){return x;})) winRound(r);
    } else {
      crack(); btn.classList.add('rej'); setTimeout(function(){ btn.classList.remove('rej'); },380);
      // teaching nudge on a tempting decoy
      var h=$('#howto');
      if(h && btn.dataset.ch==='母'){ h.innerHTML='Tempting — 母 <em>means</em> mother, but the radical in 妈 is the broader <b>女 (woman)</b>.'; }
      else if(h && (btn.dataset.ch==='目'||btn.dataset.ch==='田')){ h.innerHTML='Look closer — that’s <b>'+(btn.dataset.ch==='目'?'目 eye':'田 field')+'</b>, not 日 sun.'; }
    }
  }

  // ───────── win round ─────────
  function winRound(r){
    G.done=true; clearInterval(G.timer);
    var stars=starsFromHeat(); G.stars[G.i]=stars;
    if(G.forged.indexOf(r.char)<0) G.forged.push(r.char);
    var timeBonus=Math.round(G.heat); G.score+=timeBonus + stars*40;
    renderHUD(); renderRail();
    if(opts.sound) speak(r.char);
    showWin(r, stars, timeBonus);
  }
  function showWin(r, stars, timeBonus){
    var ov=$('#overlay'); ov.className='overlay show';
    var sv=''; for(var k=0;k<3;k++) sv+='<i class="'+(k<stars?'on':'')+'">★</i>';
    var last=G.i>=ROUNDS.length-1;
    ov.innerHTML='<div class="ov-card" style="--rc:'+r.accent+';--rc-soft:'+r.soft+';--rc-tint:'+r.tint+'">'+
      '<div class="ov-eyebrow"><span class="dot"></span>Forged · <span class="zh">炼成</span> · <span class="zh">'+r.cat+'</span></div>'+
      '<div class="ov-stars">'+sv+'</div>'+
      '<div class="ov-ch zh">'+r.char+'</div><div class="ov-py">'+r.py+'</div><div class="ov-en">'+r.meaning+'</div>'+
      '<div class="ov-tally"><span>heat bonus <b>+'+timeBonus+'</b></span><span>combo ×'+Math.max(1,G.maxCombo)+'</span>'+(G.cracks?'<span class="bad">cracks '+G.cracks+'</span>':'<span class="good">flawless</span>')+'</div>'+
      '<button class="gbtn solid" id="ov-go">'+(last?'See your run <span class="zh">完成</span>':'Next round <span class="zh">继续</span>')+' ›</button>'+
    '</div>';
    confetti(ov,[r.accent,r.soft,'#E0A23A','#fff']);
    $('#ov-go').addEventListener('click', function(){ ov.className='overlay'; if(last) finishRun(); else { G.i++; G.combo=0; G.cracks=0; G.maxCombo=Math.max(G.maxCombo,0); renderRound(); } });
  }

  // ───────── finish ─────────
  function finishRun(){
    var totalStars=G.stars.reduce(function(a,b){return a+(b||0);},0);
    sessionBest.runs=(sessionBest.runs||0)+1; sessionBest.best=Math.max(sessionBest.best||0,G.score);
    try{ localStorage.setItem(LS, JSON.stringify(sessionBest)); }catch(e){}
    var strip=ROUNDS.map(function(r,i){ var sv=''; for(var k=0;k<3;k++) sv+='<i class="'+(k<(G.stars[i]||0)?'on':'')+'">★</i>';
      return '<div class="fin-item" style="--rc:'+r.accent+'"><span class="zh">'+r.char+'</span><span class="fi-grain">'+r.grain+'</span><span class="fi-stars">'+sv+'</span></div>'; }).join('');
    var ov=$('#overlay'); ov.className='overlay show finish';
    ov.innerHTML='<div class="ov-card finish-card">'+
      '<div class="ov-eyebrow"><span class="dot"></span>Run complete · <span class="zh">炼字坊</span></div>'+
      '<div class="fin-score">'+G.score+'<span>points</span></div>'+
      '<div class="fin-starline">'+(function(){var s='';for(var k=0;k<totalStars;k++)s+='★';for(var j=totalStars;j<9;j++)s+='<em>★</em>';return s;})()+'</div>'+
      '<div class="fin-strip">'+strip+'</div>'+
      '<p class="fin-note">Three grains of forging — strokes, components, and a sound+meaning radical. '+(G.score>=(sessionBest.best||0)?'New best!':'Best: '+sessionBest.best)+'</p>'+
      '<div class="ov-actions"><button class="gbtn ghost" id="ov-again">↻ Forge again</button><button class="gbtn solid" id="ov-done">Add to my scroll <span class="zh">收</span></button></div>'+
    '</div>';
    confetti(ov,['#C2603A','#2F7DA6','#7E4B86','#E0A23A']);
    $('#ov-again').addEventListener('click', startRun);
    $('#ov-done').addEventListener('click', function(){ ov.className='overlay'; toast('In the real app these would join your handscroll.'); });
  }

  // ───────── fx ─────────
  function shake(){ var a=$('#arena'); if(!a) return; a.classList.remove('shaking'); void a.offsetWidth; a.classList.add('shaking'); }
  function confetti(host, colors){ var f=document.createDocumentFragment();
    for(var i=0;i<42;i++){ var b=document.createElement('i'); b.className='confetti-bit'; b.style.left=(Math.random()*100)+'%'; b.style.background=colors[i%colors.length]; b.style.animationDelay=(Math.random()*0.4)+'s'; b.style.animationDuration=(1.5+Math.random()*1.3)+'s'; b.style.width=b.style.height=(6+Math.random()*7)+'px'; f.appendChild(b); }
    host.appendChild(f); setTimeout(function(){ $$('.confetti-bit',host).forEach(function(x){x.remove();}); },3200);
  }
  var toastT; function toast(msg){ var t=$('#gtoast'); t.innerHTML=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('on'); },2600); }
  function speak(ch){ try{ if(!window.speechSynthesis) return; var u=new SpeechSynthesisUtterance(ch); u.lang='zh-CN'; u.rate=.8; var vs=speechSynthesis.getVoices(); var zh=vs.filter(function(v){return /zh|Chinese/i.test(v.lang+v.name);})[0]; if(zh)u.voice=zh; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch(e){} }

  // ───────── run control ─────────
  function startRun(){ var ov=$('#overlay'); if(ov) ov.className='overlay'; G=newRun(); renderRound(); }
  function applyTweaks(t){ opts.hints=t.hints!==false; opts.sound=!!t.sound; document.body.dataset.bigtext=t.bigtext?'on':'off'; if(G&&!G.done) renderRound(); }
  function reset(){ startRun(); toast('New run'); }

  function init(){
    if(!Object.keys(SD).length){ $('#arena').innerHTML='<div class="howto">Stroke data failed to load.</div>'; return; }
    startRun();
  }
  window.JOURNEY={ applyTweaks:applyTweaks, reset:reset, redraw:function(){} };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
