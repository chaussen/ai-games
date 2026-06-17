/* game/forge.js — the Forge Run engine (PREVIEW → FORGE → REVEAL)
   Consumes fully-resolved round objects (from Content.buildRound) — NO hard-coded
   rounds, NO runtime decomposition. Four grains: stroke / component(会意) /
   radical(形声) / use(应用). Heat, combo, cracks, stars, progressive hint ladder
   (spec §4.1–§4.2, §8). On finish it hands a result back to the app, which applies
   the two-currency scoring and ceremonies. Framework-free; tap interactions. */
(function (G) {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t;} return a; }

  function strokePalette(n){ var o=[]; for(var i=0;i<n;i++){ var t=n<=1?0:i/(n-1); o.push('hsl('+(8+t*282).toFixed(1)+' 70% 45%)'); } return o; }
  function tianzi(){ return '<rect x="6" y="6" width="1012" height="1012" rx="14" fill="none" stroke="#EFDDD5" stroke-width="6"/>'+
    '<line x1="512" y1="6" x2="512" y2="1018" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>'+
    '<line x1="6" y1="512" x2="1018" y2="512" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>'; }
  function ghostSVG(sd){ if(!sd) return ''; var paths=sd.s.map(function(p){return '<path d="'+p+'" fill="#EBDDD4"/>';}).join('');
    return tianzi()+'<g transform="translate(0,900) scale(1,-1)">'+paths+'</g>'; }
  function strokePathColored(sd,i,col){ return '<g transform="translate(0,900) scale(1,-1)"><path d="'+sd.s[i]+'" fill="'+col+'"/></g>'; }
  function strokePieceSVG(sd,i,col){ return '<svg class="sp-svg" viewBox="0 0 1024 1024"><g transform="translate(0,900) scale(1,-1)"><path d="'+sd.s[i]+'" fill="'+col+'"/></g></svg>'; }

  // ───────── run state ─────────
  var RUN=null;       // { rounds, i, settings, title, onDone, onCharForged, score, forged, parts, stars, cracksTotal }
  var R=null;         // per-round live state

  function host(){
    var h=$('#forge-screen');
    if(!h){
      h=document.createElement('div'); h.id='forge-screen'; h.className='screen';
      h.innerHTML=
        '<div class="topbar">'+
          '<button class="brandseal" id="fg-quit" title="Leave run">‹</button>'+
          '<div class="hud-info"><b id="fg-title">Forge</b><span id="fg-band"></span></div>'+
          '<div class="hud-round-info"><span id="fg-step"></span><span class="hud-cat" id="fg-cat"></span></div>'+
          '<div class="hud-right"><div class="hud-stats"><div class="hud-stat"><b id="fg-score">0</b><span>score</span></div></div></div>'+
        '</div>'+
        '<div class="arena-head" id="fg-head"></div>'+
        '<div class="main"><div id="fg-arena" style="display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;"></div></div>'+
        '<div class="footer">'+
          '<div class="heatbar-row"><div class="combo" id="fg-combo"><b>×1</b><span>combo</span></div>'+
            '<div class="heatwrap" id="fg-heatwrap"><i id="fg-heat" style="width:100%"></i></div>'+
            '<span class="heatlbl zh">火</span><span class="heatzone" id="fg-zone">HOT</span></div>'+
          '<div class="footbar"><div class="rail" id="fg-rail"></div></div>'+
        '</div>'+
        '<div class="reveal" id="fg-reveal"></div>';
      document.body.appendChild(h);
      $('#fg-quit', h).addEventListener('click', function(){ quit(); });
    }
    return h;
  }

  // ───────── public entry ─────────
  function run(rounds, opts, onDone){
    opts=opts||{};
    RUN={ rounds:rounds, i:0, settings:opts.settings||{}, title:opts.title||'Forge run',
          onDone:opts.onDone||onDone||function(){}, onCharForged:opts.onCharForged||function(){},
          score:0, forged:[], parts:[], stars:{}, cracksTotal:0 };
    var h=host(); h.classList.add('open');
    $('#fg-title',h).textContent=opts.title||'Forge run';
    renderRound();
  }
  function quit(){ if(R&&R.timer) clearInterval(R.timer); var h=$('#forge-screen'); if(h) h.classList.remove('open');
    if(RUN&&RUN.onDone) RUN.onDone({ aborted:true }); RUN=null; R=null; }

  function curRound(){ return RUN.rounds[RUN.i]; }

  function applyAccent(rd){ var h=$('#forge-screen'); var s=h.style;
    s.setProperty('--rc',rd.accent); s.setProperty('--rc-soft',rd.soft); s.setProperty('--rc-tint',rd.tint); }

  function renderRound(){
    var rd=curRound(); applyAccent(rd);
    R={ phase:'preview', heat:100, combo:0, maxCombo:0, cracks:0, done:false, timer:null,
        next:0, order:[], slotFill:[], skipped:false, hintLevel:0 };
    $('#fg-step').textContent='Round '+(RUN.i+1)+' / '+RUN.rounds.length;
    $('#fg-cat').innerHTML='<span class="zh">'+rd.cat+'</span> · '+esc(rd.catEn);
    $('#fg-band').textContent=({parts:'部件 · Parts',wholes:'合字 · Wholes',use:'应用 · Use'})[rd.band]||'';
    $('#fg-score').textContent=RUN.score;
    renderRail(); renderCombo(); setHeatUI();
    renderPreview(rd);
  }

  function renderRail(){
    $('#fg-rail').innerHTML = RUN.rounds.map(function(rd,i){
      var st=i<RUN.i?'done':(i===RUN.i?'cur':'todo');
      var stars=RUN.stars[rd.char]||0, sv='';
      if(st==='done'){ for(var k=0;k<3;k++) sv+='<i class="'+(k<stars?'on':'')+'">★</i>'; }
      var label = rd.grain==='use' ? '词' : rd.char;
      return '<div class="railnode '+st+'" style="--rc:'+rd.accent+'"><span class="rn-ch zh">'+(st==='todo'?'?':label)+'</span>'+
        '<span class="rn-grain">'+rd.grain+'</span>'+(sv?'<span class="rn-stars">'+sv+'</span>':'')+'</div>';
    }).join('<span class="raillink"></span>');
  }
  function renderCombo(){ var c=$('#fg-combo'); c.className='combo'+(R.combo>1?' on':''); c.querySelector('b').textContent='×'+Math.max(1,R.combo); }

  // ───────── PREVIEW ─────────
  function renderPreview(rd){
    var ms = RUN.settings.previewMs!=null ? RUN.settings.previewMs : 3000;
    $('#fg-head').innerHTML='';
    var glyph = rd.grain==='use' ? rd.word : rd.char;
    var meta = rd.grain==='use'
      ? '<span class="pv-en">'+esc(rd.meaning||'a word to build')+'</span>'
      : '<span class="pv-py">'+esc(rd.pinyin||'')+'</span><span class="pv-en">'+esc(rd.meaning||'')+'</span>';
    var cueText = ({ stroke:'Memorise the strokes — you’ll write it from memory.',
      component:'Two meanings combine. Remember which parts.',
      radical:'One part gives the meaning, one gives the sound.',
      use:'You’ll assemble this word from its characters.' })[rd.grain];
    $('#fg-arena').innerHTML=
      '<div class="preview-stage">'+
        '<div class="pv-round-badge">'+({parts:'部件 PART',wholes:'合字 WHOLE',use:'应用 USE'})[rd.band]+' · forge from memory</div>'+
        '<div class="pv-glyph-wrap"><div class="pv-glyph zh">'+esc(glyph)+'</div><div class="pv-meta">'+meta+'</div></div>'+
        '<div class="pv-cue">'+cueText+'</div>'+
        (ms>0?'<div class="pv-countdown" id="pv-cd"><svg class="pv-ring-svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="var(--rc-soft)" stroke-width="5"/><circle id="pv-arc" cx="32" cy="32" r="28" fill="none" stroke="var(--rc)" stroke-width="5" stroke-linecap="round" transform="rotate(-90 32 32)" stroke-dasharray="175.9" stroke-dashoffset="0"/></svg><span class="pv-cd-num" id="pv-num"></span></div>'+
          '<div class="pv-skip-hint">tap to start now ›</div>' : '')+
      '</div>';
    if (RUN.settings.sound!==false) speak(rd.grain==='use'?rd.word:rd.char);
    if (ms<=0){ startForge(rd,false); return; }
    var cd=$('#pv-cd'); cd.addEventListener('click', function(){ startForge(rd,true); });
    var t0=Date.now(), C=175.9;
    R.timer=setInterval(function(){
      var el=Date.now()-t0, frac=Math.max(0,1-el/ms);
      var arc=$('#pv-arc'), num=$('#pv-num');
      if(arc) arc.setAttribute('stroke-dashoffset', (C*(1-frac)).toFixed(1));
      if(num) num.textContent=Math.ceil(frac*ms/1000);
      if(el>=ms){ startForge(rd,false); }
    },60);
  }

  function startForge(rd, skipped){
    clearInterval(R.timer); R.timer=null; R.phase='forge'; R.skipped=skipped;
    if (skipped) RUN.score+=15;              // speed/confidence bonus
    renderForge(rd);
    startHeat();
  }

  // ───────── FORGE ─────────
  function renderForge(rd){
    // minimal cue (spec §4.2)
    var cue='';
    if (rd.grain==='stroke'){
      cue='<div class="forge-cue"><span class="fc-grain-badge zh" style="color:var(--rc);font-weight:700">'+rd.cat+'</span><span class="fc-prompt">Tap the strokes in <b>writing order</b></span></div>';
    } else if (rd.grain==='use'){
      cue='<div class="forge-cue"><span class="fc-meaning">“'+esc(rd.meaning||'')+'”</span><span class="fc-prompt">build the word in order</span></div>';
    } else {
      cue='<div class="forge-cue"><span class="fc-meaning">“'+esc(rd.meaning)+'”</span>'+
        (rd.cue.pinyin?'<span class="fc-pinyin">'+esc(rd.pinyin)+'</span>':'')+
        '<span class="fc-prompt">'+(rd.grain==='radical'?'pick the meaning + the sound':'pick the meaning parts')+'</span></div>';
    }
    $('#fg-head').innerHTML=cue;
    if (rd.grain==='stroke') renderStroke(rd);
    else if (rd.grain==='use') renderUse(rd);
    else renderParts(rd);
  }

  // ── STROKE ──
  function renderStroke(rd){
    var sd=rd.strokeData, n=sd.s.length, cols=strokePalette(n);
    R.order=[]; for(var k=0;k<n;k++) R.order.push(k); R.next=0;
    var tray=shuffle(R.order.slice());
    var pieces=tray.map(function(i){ return '<button class="spiece" data-i="'+i+'">'+strokePieceSVG(sd,i,cols[i])+'</button>'; }).join('');
    $('#fg-arena').innerHTML=
      '<div class="stroke-stage">'+
        '<div class="canvaswrap"><svg class="charcanvas" id="fg-canvas" viewBox="0 0 1024 1024">'+(rd.ghost?ghostSVG(sd):tianzi())+'</svg></div>'+
        '<div class="tray" id="fg-tray">'+pieces+'</div></div>'+
      '<div class="howto" id="fg-howto">Forge from memory — 1, 2, 3…</div>';
    $$('#fg-tray .spiece').forEach(function(b){ b.addEventListener('click', function(){ tapStroke(rd,+b.dataset.i,b,cols); }); });
  }
  function tapStroke(rd,i,btn,cols){
    if(R.done) return;
    if(i===R.order[R.next]){
      $('#fg-canvas').insertAdjacentHTML('beforeend', strokePathColored(rd.strokeData,i,cols[i]));
      btn.classList.add('used'); btn.disabled=true; R.next++; reward(20);
      if(R.next>=R.order.length) winRound(rd);
    } else { crack(); btn.classList.add('rej'); setTimeout(function(){btn.classList.remove('rej');},360); strokeHint(rd); }
  }
  function strokeHint(rd){
    var h=$('#fg-howto');
    if (R.cracks>=4){ // reveal next piece, cap stars
      var want=R.order[R.next]; var pc=$$('#fg-tray .spiece').filter(function(b){return +b.dataset.i===want;})[0];
      if(pc){ pc.classList.add('hint-glow'); if(!pc.querySelector('.sp-num')) pc.insertAdjacentHTML('beforeend','<span class="sp-num">'+(want+1)+'</span>'); }
      if(h) h.innerHTML='Here it is — stroke <b>'+(R.order[R.next]+1)+'</b> (★ capped).';
    } else if (R.cracks>=2){ if(h) h.innerHTML='Hint: you need stroke <b>'+(R.order[R.next]+1)+'</b> next.'; }
    else if(h) h.innerHTML='Not next — keep the order.';
  }

  // ── PARTS (component / radical) ──
  function renderParts(rd){
    R.slotFill=rd.slots.map(function(){return null;});
    var slots=rd.slots.map(function(s,i){ return '<div class="slot" data-s="'+i+'" data-type="'+s.type+'"><span class="slot-lbl zh">'+s.label+'</span></div>'; }).join('<span class="slot-plus">＋</span>');
    var cards=rd.pool.map(function(p){
      var py=p.py?'<span class="pc-py">'+esc(p.py)+'</span>':'';
      return '<button class="pcard" data-ch="'+esc(p.ch)+'" data-correct="'+(p.correct?1:0)+'" data-slot="'+(p.slot!=null?p.slot:'')+'" data-role="'+(p.role||'meaning')+'">'+
        '<span class="pc-ch zh">'+esc(p.ch)+'</span>'+py+'</button>';
    }).join('');
    $('#fg-arena').innerHTML=
      '<div class="parts-stage">'+
        '<div class="anvil2">'+slots+'<span class="eq-label">=</span><span class="eq-target target-hidden">?</span></div>'+
        '<div class="pool" id="fg-pool">'+cards+'</div></div>'+
      '<div class="howto" id="fg-howto">'+(rd.grain==='radical'?'Recall the <b>meaning</b> part, then match the <b>sound</b>.':'Pick the parts whose meanings combine.')+'</div>';
    $$('#fg-pool .pcard').forEach(function(b){ b.addEventListener('click', function(){ tapPart(rd,b); }); });
  }
  function tapPart(rd,btn){
    if(R.done||btn.disabled) return;
    if(btn.dataset.correct==='1'){
      var si=+btn.dataset.slot, slot=$('.slot[data-s="'+si+'"]');
      if(R.slotFill[si]) return;
      R.slotFill[si]=btn.dataset.ch; slot.classList.add('filled');
      var tag = btn.dataset.role==='sound'?'声':(rd.grain==='radical'?'形':'义');
      slot.innerHTML='<span class="slot-ch zh">'+esc(btn.dataset.ch)+'</span><span class="slot-tag">'+tag+'</span>';
      btn.classList.add('used'); btn.disabled=true; reward(30);
      if(R.slotFill.every(function(x){return x;})) winRound(rd);
    } else { crack(); btn.classList.add('rej'); setTimeout(function(){btn.classList.remove('rej');},380); partHint(rd,btn); }
  }
  function partHint(rd,badBtn){
    var h=$('#fg-howto');
    if (R.cracks>=4){
      $$('#fg-pool .pcard').forEach(function(b){ if(b.dataset.correct==='1'&&!b.disabled) b.classList.add('hint-glow'); });
      if(h) h.innerHTML='The right parts are lit (★ capped).';
    } else if (R.cracks>=2){
      $$('#fg-pool .pcard').forEach(function(b){ if(b.dataset.correct!=='1') b.style.opacity=.4; });
      if(h) h.innerHTML='Some look-alikes dimmed — recall the true part.';
    } else {
      if(h){ if(badBtn.dataset.role==='sound') h.innerHTML='That sound doesn’t match — listen again.'; else h.innerHTML='Close — that’s a look-alike, not the part.'; }
    }
  }

  // ── USE (assemble the word) ──
  function renderUse(rd){
    R.order=rd.sequence.slice(); R.next=0;
    var slots=rd.sequence.map(function(ch,i){ return '<div class="slot" data-s="'+i+'" style="width:80px;height:80px"><span class="slot-lbl zh">'+(i+1)+'</span></div>'; }).join('<span class="slot-plus">·</span>');
    var cards=rd.tiles.map(function(t,idx){ return '<button class="pcard" data-ch="'+esc(t.ch)+'" data-correct="'+(t.correct?1:0)+'" data-idx="'+(t.idx!=null?t.idx:'')+'"><span class="pc-ch zh">'+esc(t.ch)+'</span></button>'; }).join('');
    $('#fg-arena').innerHTML=
      '<div class="parts-stage">'+
        '<div class="anvil2">'+slots+'</div>'+
        '<div class="pool" id="fg-pool">'+cards+'</div></div>'+
      '<div class="howto" id="fg-howto">Tap the characters <b>in order</b> to write “'+esc(rd.meaning)+'”.</div>';
    $$('#fg-pool .pcard').forEach(function(b){ b.addEventListener('click', function(){ tapUse(rd,b); }); });
  }
  function tapUse(rd,btn){
    if(R.done||btn.disabled) return;
    var wantIdx=R.next, wantCh=rd.sequence[wantIdx];
    if(btn.dataset.correct==='1' && btn.dataset.ch===wantCh && +btn.dataset.idx===wantIdx){
      var slot=$('.slot[data-s="'+wantIdx+'"]'); slot.classList.add('filled');
      slot.innerHTML='<span class="slot-ch zh" style="font-size:38px">'+esc(wantCh)+'</span>';
      btn.classList.add('used'); btn.disabled=true; R.next++; reward(25);
      if(R.next>=rd.sequence.length) winRound(rd);
    } else { crack(); btn.classList.add('rej'); setTimeout(function(){btn.classList.remove('rej');},380);
      var h=$('#fg-howto'); if(h) h.innerHTML='Not next — you need <b>'+esc(wantCh)+'</b>.'; }
  }

  // ───────── heat / scoring ─────────
  function startHeat(){
    R.heat=100; clearInterval(R.timer);
    var rate = ({easy:0.40,normal:0.55,hard:0.78,expert:0.85})[RUN.settings.difficulty]||0.55;
    R.timer=setInterval(function(){ if(R.done) return; R.heat=Math.max(0,R.heat-rate); setHeatUI(); },90);
  }
  function heatZone(){ return R.heat>62?'hot':R.heat>30?'warm':'cool'; }
  function setHeatUI(){ var f=$('#fg-heat'); if(f) f.style.width=R.heat+'%';
    var w=$('#fg-heatwrap'); if(w){ w.className='heatwrap '+heatZone(); }
    var z=$('#fg-zone'); if(z) z.textContent=heatZone().toUpperCase(); }
  function starsFromHeat(){ var s=R.heat>62?3:R.heat>26?2:1; s-=Math.min(2,Math.floor(R.cracks/2));
    if(R.cracks>=4) s=Math.min(s,1); return Math.max(1,s); }
  function crack(){ R.combo=0; R.cracks++; RUN.cracksTotal++; R.heat=Math.max(4,R.heat-14); renderCombo(); setHeatUI(); shake(); }
  function reward(base){ R.combo++; R.maxCombo=Math.max(R.maxCombo,R.combo); RUN.score+=base*Math.max(1,R.combo);
    $('#fg-score').textContent=RUN.score; renderCombo(); }

  function winRound(rd){
    R.done=true; clearInterval(R.timer);
    var stars=starsFromHeat(); RUN.stars[rd.char]=stars;
    var timeBonus=Math.round(R.heat); RUN.score+=timeBonus+stars*40; $('#fg-score').textContent=RUN.score;
    if (RUN.forged.indexOf(rd.char)<0) RUN.forged.push(rd.char);
    if (rd.band==='parts' && RUN.parts.indexOf(rd.char)<0) RUN.parts.push(rd.char);
    RUN.onCharForged(rd, stars);
    renderRail();
    if (RUN.settings.sound!==false && rd.grain!=='use') speak(rd.char);
    showReveal(rd, stars, timeBonus);
  }

  function showReveal(rd, stars, timeBonus){
    var ov=$('#fg-reveal'); ov.className='reveal show';
    var sv=''; for(var k=0;k<3;k++) sv+='<i class="'+(k<stars?'on':'')+'">★</i>';
    var last=RUN.i>=RUN.rounds.length-1;
    var glyph = rd.grain==='use'?rd.word:rd.char;
    ov.innerHTML='<div class="rv-card" style="--rc:'+rd.accent+';--rc-soft:'+rd.soft+';--rc-tint:'+rd.tint+'">'+
      '<div class="rv-eyebrow"><span class="dot"></span>Forged · <span class="zh">炼成</span> · <span class="zh">'+rd.cat+'</span></div>'+
      '<div class="rv-stars">'+sv+'</div>'+
      '<div class="rv-ch zh">'+esc(glyph)+'</div>'+
      (rd.pinyin?'<div class="rv-py">'+esc(rd.pinyin)+'</div>':'')+
      '<div class="rv-en">'+esc(rd.meaning||'')+'</div>'+
      '<div class="rv-tally"><span>heat <b>+'+timeBonus+'</b></span><span>combo ×'+Math.max(1,R.maxCombo)+'</span>'+
        (R.cracks?'<span class="bad">cracks '+R.cracks+'</span>':'<span class="good">flawless</span>')+
        (R.skipped?'<span class="good">+speed</span>':'')+'</div>'+
      '<div class="rv-actions"><button class="gbtn solid" id="rv-go">'+(last?'Finish stage <span class="zh">完成</span>':'Next <span class="zh">继续</span>')+' ›</button></div>'+
    '</div>';
    confetti(ov,[rd.accent,rd.soft,'#E0A23A','#fff']);
    $('#rv-go').addEventListener('click', function(){ ov.className='reveal'; if(last) finish(); else { RUN.i++; renderRound(); } });
  }

  function finish(){
    var h=$('#forge-screen'); if(h) h.classList.remove('open');
    var result={ score:RUN.score, stars:RUN.stars, forged:RUN.forged.slice(), parts:RUN.parts.slice(),
                 cracks:RUN.cracksTotal, totalStars:0, rounds:RUN.rounds.length };
    for(var c in RUN.stars) result.totalStars+=RUN.stars[c];
    var cb=RUN.onDone; RUN=null; R=null; cb(result);
  }

  // ───────── fx ─────────
  function shake(){ var a=$('#fg-arena'); if(!a) return; a.classList.remove('shaking'); void a.offsetWidth; a.classList.add('shaking'); }
  function confetti(hostEl, colors){ var f=document.createDocumentFragment();
    for(var i=0;i<40;i++){ var b=document.createElement('i'); b.className='confetti-bit'; b.style.left=(Math.random()*100)+'%';
      b.style.background=colors[i%colors.length]; b.style.animationDelay=(Math.random()*0.4)+'s';
      b.style.animationDuration=(1.5+Math.random()*1.3)+'s'; b.style.width=b.style.height=(6+Math.random()*7)+'px'; f.appendChild(b); }
    hostEl.appendChild(f); setTimeout(function(){ $$('.confetti-bit',hostEl).forEach(function(x){x.remove();}); },3200); }
  function speak(ch){ try{ if(!window.speechSynthesis) return; var u=new SpeechSynthesisUtterance(ch); u.lang='zh-CN'; u.rate=.8;
    var vs=speechSynthesis.getVoices(); var zh=vs.filter(function(v){return /zh|Chinese/i.test(v.lang+v.name);})[0]; if(zh)u.voice=zh;
    speechSynthesis.cancel(); speechSynthesis.speak(u);}catch(e){} }

  G.Forge = { run:run };
})(window.GAME = window.GAME || {});
