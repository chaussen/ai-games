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

  // ───────── stroke shape classification (feedback #5) ─────────
  // Coarse stroke type from its median, so genuinely identical strokes (e.g. the
  // three horizontals of 目) are interchangeable, but a horizontal can never
  // satisfy a vertical. Turning strokes stay unique ("true resemblance only").
  function angleChange(a,b,c){
    var v1x=b[0]-a[0], v1y=b[1]-a[1], v2x=c[0]-b[0], v2y=c[1]-b[1];
    var d=Math.hypot(v1x,v1y)*Math.hypot(v2x,v2y); if(d===0) return 0;
    var cos=(v1x*v2x+v1y*v2y)/d; cos=Math.max(-1,Math.min(1,cos));
    return Math.acos(cos)*180/Math.PI;
  }
  function classifyStroke(med){
    if(!med || med.length<2) return '?';
    var a=med[0], b=med[med.length-1], dx=b[0]-a[0], dy=b[1]-a[1];
    for(var i=1;i<med.length-1;i++){ if(angleChange(med[i-1],med[i],med[i+1])>48) return 'turn'; }
    var adx=Math.abs(dx), ady=Math.abs(dy), len=adx+ady;
    if(len<150) return 'dian';
    if(adx>ady*2) return 'heng';
    if(ady>adx*2) return 'shu';
    return dx<0 ? 'pie' : 'na';     // medians are y-up; downstroke either way
  }
  function strokeLen(med){ if(!med||med.length<2) return 0; var a=med[0], b=med[med.length-1]; return Math.abs(b[0]-a[0])+Math.abs(b[1]-a[1]); }
  // For each stroke, the set of stroke indices it is interchangeable with —
  // strokes a student would call "the same". Detection is shape-based across the
  // WHOLE glyph (not just neighbours), so e.g. 耳's top + bottom horizontals
  // group even though strokes sit between them (feedback #7). Two strokes match
  // when they share a simple type AND a similar length (within ~1.6×, so a short
  // tick never merges with a long sweep). Turning strokes stay unique — a 横折 is
  // never "the same" as anything else ("true resemblance only").
  function strokeGroups(sd){
    var meds=sd.m||[], n=sd.s.length, types=[], lens=[];
    for(var i=0;i<n;i++){ types.push(meds[i]?classifyStroke(meds[i]):'?'); lens.push(strokeLen(meds[i])); }
    var groupOf=new Array(n);
    var swappable={heng:1,shu:1,pie:1,na:1,dian:1};
    var byType={};
    for(var i=0;i<n;i++) if(swappable[types[i]]) (byType[types[i]]=byType[types[i]]||[]).push(i);
    for(var t in byType){
      // cluster same-type strokes by length: sort, then split where the jump >1.6×
      var idxs=byType[t].slice().sort(function(a,b){ return lens[a]-lens[b]; });
      var cluster=[idxs[0]];
      for(var k=1;k<idxs.length;k++){
        var prev=lens[idxs[k-1]], cur=lens[idxs[k]];
        if(prev>0 && cur/prev<=1.6) cluster.push(idxs[k]);
        else { var c1=cluster.slice(); cluster.forEach(function(ix){ groupOf[ix]=c1; }); cluster=[idxs[k]]; }
      }
      var c2=cluster.slice(); cluster.forEach(function(ix){ groupOf[ix]=c2; });
    }
    for(var i=0;i<n;i++) if(!groupOf[i]) groupOf[i]=[i];   // turns / unknown → singletons
    return groupOf;
  }

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
        next:0, placed:[], groups:[], zoneFill:{}, need:0, chunks:1, chunkSize:1, curChunk:0, skipped:false };
    $('#fg-step').textContent='Round '+(RUN.i+1)+' / '+RUN.rounds.length;
    $('#fg-cat').innerHTML='<span class="zh">'+rd.cat+'</span> · '+esc(rd.catEn);
    $('#fg-band').textContent=({parts:'偏旁部首 · Parts',wholes:'合字 · Wholes',use:'应用 · Use'})[rd.band]||'';
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
      // Only revealed (done) rounds show their glyph — showing the current round's
      // character in the rail would hand away what you're forging from memory.
      return '<div class="railnode '+st+'" style="--rc:'+rd.accent+'"><span class="rn-ch zh">'+(st==='done'?label:'?')+'</span>'+
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
        '<div class="pv-round-badge">'+({parts:'偏旁部首 PART',wholes:'合字 WHOLE',use:'应用 USE'})[rd.band]+' · forge from memory</div>'+
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
      var um = rd.prompt==='english' ? '“'+esc(rd.meaning||'')+'”' : '<span class="zh">'+esc(rd.pinyin||rd.meaning||'')+'</span>';
      cue='<div class="forge-cue"><span class="fc-meaning">'+um+'</span><span class="fc-prompt">write the word — drag the characters in order</span></div>';
    } else {
      cue='<div class="forge-cue">'+
        (rd.cue.meaning?'<span class="fc-meaning">“'+esc(rd.meaning)+'”</span>':'')+
        (rd.cue.pinyin?'<span class="fc-pinyin">'+esc(rd.pinyin)+'</span>':'')+
        '<span class="fc-prompt">'+(rd.grain==='radical'?'build it: meaning part + sound part':'build it from its parts')+'</span></div>';
    }
    $('#fg-head').innerHTML=cue+
      '<button class="peek-btn" id="fg-peek" type="button" title="See the target again">'+
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5C5 5 1.7 11.1 1.5 11.5c-.1.3-.1.7 0 1C1.7 12.9 5 19 12 19s10.3-6.1 10.5-6.5c.1-.3.1-.7 0-1C22.3 11.1 19 5 12 5zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/></svg>'+
        '<span>see it again</span></button>';
    var pk=$('#fg-peek'); if(pk) pk.addEventListener('click', function(){ peek(rd); });
    if (rd.grain==='stroke') renderStroke(rd);
    else if (rd.grain==='use') renderUse(rd);
    else renderParts(rd);
  }

  // Re-show the target glyph briefly — a distraction shouldn't cost the round when
  // navigation can't go back. A peek nibbles a little heat (lower star ceiling),
  // but never cracks and never touches the 文 wallet.
  function peek(rd){
    if(R.done) return;
    if($('.peek-overlay')) return;                  // one at a time
    R.heat=Math.max(4, R.heat-10); setHeatUI();
    var glyph = rd.grain==='use' ? rd.word : rd.char;
    var pk=document.createElement('div'); pk.className='peek-overlay';
    pk.innerHTML='<div class="peek-card">'+
      '<div class="peek-eyebrow">a peek · <span class="zh">再看一眼</span></div>'+
      '<div class="peek-glyph zh">'+esc(glyph)+'</div>'+
      (rd.pinyin && rd.grain!=='use' ? '<div class="peek-py zh">'+esc(rd.pinyin)+'</div>' : '')+
      (rd.meaning ? '<div class="peek-en">'+esc(rd.meaning)+'</div>' : '')+'</div>';
    $('#forge-screen').appendChild(pk);
    if (RUN.settings.sound!==false) speak(glyph);
    setTimeout(function(){ pk.classList.add('out'); setTimeout(function(){ if(pk.parentNode) pk.remove(); }, 280); }, 1500);
  }

  // ── STROKE ──
  function renderStroke(rd){
    var sd=rd.strokeData, n=sd.s.length, cols=strokePalette(n);
    R.placed=[]; for(var k=0;k<n;k++) R.placed.push(false);
    R.groups=strokeGroups(sd);
    R.chunks=Math.max(1, rd.chunks||1);
    R.chunkSize=Math.ceil(n/R.chunks); R.curChunk=0;
    var tray=shuffle(idxArray(n));
    var pieces=tray.map(function(i){
      var locked = chunkOf(i)>R.curChunk;
      return '<button class="spiece'+(locked?' chunk-locked':'')+'" data-i="'+i+'"'+(locked?' disabled':'')+'>'+strokePieceSVG(sd,i,cols[i])+'</button>';
    }).join('');
    var chunkBadge = R.chunks>1 ? '<div class="chunk-badge">Step <b>1</b> / '+R.chunks+' — write this group first</div>' : '';
    $('#fg-arena').innerHTML=
      '<div class="stroke-stage">'+
        '<div class="canvaswrap"><svg class="charcanvas" id="fg-canvas" viewBox="0 0 1024 1024">'+(rd.ghost?ghostSVG(sd):tianzi())+'</svg></div>'+
        chunkBadge+
        '<div class="tray" id="fg-tray">'+pieces+'</div></div>'+
      '<div class="howto" id="fg-howto">Forge from memory — same-shape strokes can go in any order.</div>';
    $$('#fg-tray .spiece').forEach(function(b){ b.addEventListener('click', function(){ tapStroke(rd,+b.dataset.i,b,cols); }); });
  }
  function idxArray(n){ var a=[]; for(var i=0;i<n;i++) a.push(i); return a; }
  function chunkOf(i){ return Math.floor(i/R.chunkSize); }
  function nextExpected(){ for(var i=0;i<R.placed.length;i++) if(!R.placed[i]) return i; return -1; }
  function tapStroke(rd,i,btn,cols){
    if(R.done || btn.disabled) return;
    var exp=nextExpected(); if(exp<0) return;
    var sameShape = R.groups[exp] && R.groups[exp].indexOf(i)>=0;   // identical-shape → order-free
    if(i===exp || sameShape){
      // Always fill the canonical next slot in writing order, regardless of which
      // identical tile was tapped — the grid must match (feedback #5). The tapped
      // tile is consumed; its interchangeable twin fills its slot later.
      $('#fg-canvas').insertAdjacentHTML('beforeend', strokePathColored(rd.strokeData,exp,cols[exp]));
      btn.classList.add('used'); btn.disabled=true; R.placed[exp]=true; reward(20);
      maybeAdvanceChunk(rd);
      if(R.placed.every(function(x){return x;})) winRound(rd);
    } else { crack(); btn.classList.add('rej'); setTimeout(function(){btn.classList.remove('rej');},360); strokeHint(rd); }
  }
  function maybeAdvanceChunk(rd){
    if(R.chunks<=1) return;
    var start=R.curChunk*R.chunkSize, end=Math.min(R.placed.length,start+R.chunkSize), all=true;
    for(var i=start;i<end;i++) if(!R.placed[i]) all=false;
    if(all && R.curChunk<R.chunks-1){
      R.curChunk++;
      $$('#fg-tray .spiece').forEach(function(b){ var i=+b.dataset.i; if(!R.placed[i] && chunkOf(i)<=R.curChunk){ b.disabled=false; b.classList.remove('chunk-locked'); } });
      var bdg=$('.chunk-badge'); if(bdg) bdg.innerHTML='Step <b>'+(R.curChunk+1)+'</b> / '+R.chunks+' — now this group';
    }
  }
  function strokeTypeName(rd, idx){
    var t=rd.strokeData.m&&rd.strokeData.m[idx]?classifyStroke(rd.strokeData.m[idx]):'?';
    return ({heng:'horizontal 横',shu:'vertical 竖',pie:'left-falling 撇',na:'right-falling 捺',dian:'dot 点',turn:'turning 折'})[t]||'next';
  }
  function strokeHint(rd){
    var h=$('#fg-howto'), exp=nextExpected();
    if (R.cracks>=4){
      var run=R.groups[exp]||[exp];
      $$('#fg-tray .spiece').forEach(function(b){ if(run.indexOf(+b.dataset.i)>=0 && !b.disabled) b.classList.add('hint-glow'); });
      if(h) h.innerHTML='Here — the next stroke is lit (★ capped).';
    } else if (R.cracks>=2){ if(h) h.innerHTML='Hint: a <b>'+strokeTypeName(rd,exp)+'</b> stroke comes next.'; }
    else if(h) h.innerHTML='Not next — but same-shape strokes are interchangeable.';
  }

  // ── PARTS (component / radical) → blank grid + positional drag (feedback #2/#3) ──
  // Same loop as stroke-forge: the target was shown then hidden; here you rebuild
  // it by dragging real components onto the area of a BLANK grid where they live
  // (left/right/top/bottom/inner — from the character's real structure), not into
  // a pre-drawn left-right formula.
  function layoutZones(rd){
    var byOp={
      '⿰':['left','right'], '⿱':['top','bottom'],
      '⿲':['left','middle','right'], '⿳':['top','middle','bottom'],
      '⿴':['outer','inner'],'⿵':['outer','inner'],'⿶':['outer','inner'],
      '⿷':['outer','inner'],'⿸':['outer','inner'],'⿹':['outer','inner'],
      '⿺':['outer','inner'],'⿻':['outer','inner']
    };
    if(rd.layout && byOp[rd.layout]) return byOp[rd.layout];
    var seen={}, out=[]; rd.slots.forEach(function(s){ if(s.pos && !seen[s.pos]){ seen[s.pos]=1; out.push(s.pos); } });
    return out.length?out:['left','right'];
  }
  function zoneLabel(p){ return ({left:'左',right:'右',top:'上',bottom:'下',middle:'中',outer:'外',inner:'内'})[p]||''; }

  // ── structure recall (feedback #2): before placing parts the student first
  //    names the character's shape. The labelled grid only appears once they
  //    pick correctly — so the structure is recalled, not handed to them. A
  //    wrong pick cracks like any other miss (in-round score/stars only; the
  //    flat 文 payout + rank XP are still applied once on completion by app.js,
  //    so currency stays consistent). Skipped when the layout is unknown.
  var STRUCT_LABEL = {
    '⿰':{zh:'左右',en:'left · right'}, '⿱':{zh:'上下',en:'top · bottom'},
    '⿴':{zh:'包围',en:'enclosure'}, '⿲':{zh:'左中右',en:'three across'},
    '⿳':{zh:'上中下',en:'three down'}
  };
  function structKey(layout){
    if(!layout) return null;
    if(layout==='⿰'||layout==='⿱'||layout==='⿲'||layout==='⿳') return layout;
    if('⿴⿵⿶⿷⿸⿹⿺'.indexOf(layout)>=0) return '⿴';
    return null;
  }
  function structIcon(op){
    var cls=({'⿰':'lr','⿲':'lr3','⿱':'tb','⿳':'tb3','⿴':'en'})[op]||'lr';
    var cells=({'⿰':'<i></i><i></i>','⿲':'<i></i><i></i><i></i>','⿱':'<i></i><i></i>',
      '⿳':'<i></i><i></i><i></i>','⿴':'<i class="o"></i><i class="in"></i>'})[op]||'<i></i><i></i>';
    return '<span class="sicon si-'+cls+'">'+cells+'</span>';
  }
  function structOptions(key, diff){
    var all=['⿰','⿱','⿴','⿲','⿳'];
    var nd = diff==='easy'?1 : diff==='hard'?3 : diff==='expert'?4 : 2;
    var decoys=shuffle(all.filter(function(o){ return o!==key; })).slice(0,nd);
    return shuffle([key].concat(decoys));
  }
  function renderParts(rd){
    R.zoneFill={}; R.need=rd.slots.length;
    var key=structKey(rd.layout);
    if(!key){ renderPartsGrid(rd); return; }
    R.structKey=key;
    var opts=structOptions(key, RUN.settings.difficulty);
    var optHtml=opts.map(function(o){
      return '<button class="structopt" data-op="'+o+'">'+structIcon(o)+
        '<span class="so-label zh">'+STRUCT_LABEL[o].zh+'</span><span class="so-en">'+STRUCT_LABEL[o].en+'</span></button>';
    }).join('');
    // The meaning/pinyin cue already lives in #fg-head (renderForge) — don't repeat
    // it here, or the structure page shows two stacked cues (feedback: duplicate pinyin).
    $('#fg-arena').innerHTML=
      '<div class="struct-stage">'+
        '<div class="struct-q">First — what is the <b>structure</b> of this character?</div>'+
        '<div class="struct-opts">'+optHtml+'</div></div>'+
      '<div class="howto" id="fg-howto">Recall its shape, then you’ll place the parts.</div>';
    $$('.structopt').forEach(function(b){ b.addEventListener('click', function(){ pickStruct(rd,b.dataset.op,b); }); });
  }
  function pickStruct(rd, op, btn){
    if(R.done || btn.disabled) return;
    if(op===R.structKey){ btn.classList.add('used'); reward(15); renderPartsGrid(rd); }
    else { crack(); btn.classList.add('rej'); setTimeout(function(){btn.classList.remove('rej');},380); structHint(); }
  }
  function structHint(){
    var h=$('#fg-howto');
    if(R.cracks>=4){ $$('.structopt').forEach(function(b){ if(b.dataset.op===R.structKey) b.classList.add('hint-glow'); });
      if(h) h.innerHTML='The right shape is lit (★ capped).'; }
    else if(R.cracks>=2){ if(h) h.innerHTML='Hint: picture where the parts sit — left/right? top/bottom? one around another?'; }
    else if(h){ h.innerHTML='Not that shape — picture how the parts fit together.'; }
  }
  function renderPartsGrid(rd){
    var zones=layoutZones(rd);
    var zoneHtml=zones.map(function(p){ return '<div class="bz" data-pos="'+p+'"><span class="bz-hint zh">'+zoneLabel(p)+'</span></div>'; }).join('');
    var tiles=rd.pool.map(function(p,i){
      var py=p.py?'<span class="pc-py">'+esc(p.py)+'</span>':'';
      return '<button class="pcard" data-ch="'+esc(p.ch)+'" data-correct="'+(p.correct?1:0)+'" data-pos="'+(p.pos||'')+'" data-role="'+(p.role||'meaning')+'" data-i="'+i+'">'+
        '<span class="pc-ch zh">'+esc(p.ch)+'</span>'+py+'</button>';
    }).join('');
    var prompt = rd.grain==='radical'
      ? 'Drag the <b>meaning</b> part and the <b>sound</b> part onto the grid.'
      : 'Drag each part onto the right area of the grid.';
    $('#fg-arena').innerHTML=
      '<div class="build-stage">'+
        '<div class="build-grid" data-n="'+zones.length+'" id="fg-grid">'+zoneHtml+'</div>'+
        '<div class="pool drag-pool" id="fg-pool">'+tiles+'</div></div>'+
      '<div class="howto" id="fg-howto">'+prompt+'</div>';
    $$('#fg-pool .pcard').forEach(function(b){ enableDrag(rd,b); });
  }
  function enableDrag(rd, tile){
    tile.addEventListener('pointerdown', function(e){
      if(R.done || tile.disabled) return;
      e.preventDefault();
      var ghost=tile.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.removeAttribute('disabled');
      document.body.appendChild(ghost);
      tile.classList.add('dragging');
      function move(ev){ ghost.style.left=ev.clientX+'px'; ghost.style.top=ev.clientY+'px';
        var z=zoneAt(ev.clientX,ev.clientY); $$('#fg-grid .bz').forEach(function(b){ b.classList.toggle('over', b===z); }); }
      function up(ev){
        window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up);
        ghost.remove(); tile.classList.remove('dragging'); $$('#fg-grid .bz').forEach(function(b){ b.classList.remove('over'); });
        var z=zoneAt(ev.clientX,ev.clientY); if(z) dropTile(rd, tile, z);
      }
      window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
      move(e);
    });
  }
  function zoneAt(x,y){ var el=document.elementFromPoint(x,y); return el?el.closest('.bz'):null; }
  function dropTile(rd, tile, zone){
    if(R.done || tile.disabled) return;
    var pos=zone.dataset.pos, want=tile.dataset.pos;
    if(tile.dataset.correct==='1' && want===pos && !R.zoneFill[pos]){
      R.zoneFill[pos]=tile.dataset.ch; zone.classList.add('filled');
      var tag = tile.dataset.role==='sound'?'声':(rd.grain==='radical'?'形':'义');
      zone.innerHTML='<span class="bz-ch zh">'+esc(tile.dataset.ch)+'</span><span class="bz-tag">'+tag+'</span>';
      tile.classList.add('used'); tile.disabled=true; reward(30);
      if(Object.keys(R.zoneFill).length>=R.need) winRound(rd);
    } else {
      crack(); tile.classList.add('rej'); setTimeout(function(){tile.classList.remove('rej');},380);
      zone.classList.add('rej'); setTimeout(function(){zone.classList.remove('rej');},380);
      partHint(rd, tile);
    }
  }
  function partHint(rd,badTile){
    var h=$('#fg-howto');
    if (R.cracks>=4){
      $$('#fg-pool .pcard').forEach(function(b){ if(b.dataset.correct==='1'&&!b.disabled) b.classList.add('hint-glow'); });
      $$('#fg-grid .bz').forEach(function(z){ if(!R.zoneFill[z.dataset.pos]) z.classList.add('hint-zone'); });
      if(h) h.innerHTML='The right parts and their areas are lit (★ capped).';
    } else if (R.cracks>=2){
      $$('#fg-pool .pcard').forEach(function(b){ if(b.dataset.correct!=='1') b.style.opacity=.4; });
      if(h) h.innerHTML='Some look-alikes dimmed — drag the true parts into place.';
    } else {
      if(h){ h.innerHTML = (badTile.dataset.correct!=='1') ? 'That’s a look-alike, not a real part.' : 'Right part — try a different area of the grid.'; }
    }
  }

  // ── USE (assemble the word) → one growing line, count never revealed (feedback #4) ──
  // Cue is the pinyin (pinyin→character) or the english (english→character), set
  // by level — the word itself was shown in preview, then hidden.
  function renderUse(rd){
    R.next=0;
    var cards=rd.tiles.map(function(t){ return '<button class="pcard" data-ch="'+esc(t.ch)+'" data-correct="'+(t.correct?1:0)+'" data-idx="'+(t.idx!=null?t.idx:'')+'"><span class="pc-ch zh">'+esc(t.ch)+'</span></button>'; }).join('');
    var promptHtml = rd.prompt==='english'
      ? '<span class="use-en">“'+esc(rd.meaning||'')+'”</span>'
      : '<span class="use-py zh">'+esc(rd.pinyin||rd.meaning||'')+'</span>';
    $('#fg-arena').innerHTML=
      '<div class="use-stage">'+
        '<div class="use-prompt">'+promptHtml+'</div>'+
        '<div class="use-line" id="fg-line"></div>'+
        '<div class="pool" id="fg-pool">'+cards+'</div></div>'+
      '<div class="howto" id="fg-howto">Tap the characters in order to build the word — the tray won’t tell you how long it is.</div>';
    $$('#fg-pool .pcard').forEach(function(b){ b.addEventListener('click', function(){ tapUse(rd,b); }); });
  }
  function tapUse(rd,btn){
    if(R.done||btn.disabled) return;
    var wantIdx=R.next, wantCh=rd.sequence[wantIdx];
    if(btn.dataset.correct==='1' && btn.dataset.ch===wantCh && +btn.dataset.idx===wantIdx){
      var line=$('#fg-line');
      var span=document.createElement('span'); span.className='use-ch zh'; span.textContent=wantCh;
      line.appendChild(span);
      btn.classList.add('used'); btn.disabled=true; R.next++; reward(25);
      if(R.next>=rd.sequence.length) winRound(rd);
    } else { crack(); btn.classList.add('rej'); setTimeout(function(){btn.classList.remove('rej');},380);
      var h=$('#fg-howto'); if(h) h.innerHTML='Not the next character in the word — try another.'; }
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
