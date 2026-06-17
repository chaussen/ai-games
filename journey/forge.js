/* forge.js — 学字坊 · The Character Forge
   The INSIDE of a stage. Six craft-stations, one per 六书 (the six ways a
   Chinese character is born). The way you forge each one mirrors how it was
   actually invented. Vanilla JS, pointer-drag. Reuses the Studio palette. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }

  // simple-shape motifs for the "comes alive" reward (squares/circles/triangles only)
  var MOTIF = {
    '山':'<svg viewBox="0 0 100 60"><polygon points="50,6 74,54 26,54" fill="currentColor"/><polygon points="24,20 44,54 4,54" fill="currentColor" opacity=".7"/><polygon points="76,20 96,54 56,54" fill="currentColor" opacity=".7"/></svg>',
    '本':'<svg viewBox="0 0 100 60"><circle cx="50" cy="22" r="18" fill="currentColor" opacity=".85"/><rect x="46" y="22" width="8" height="32" fill="currentColor"/></svg>',
    '明':'<svg viewBox="0 0 100 60"><circle cx="38" cy="30" r="17" fill="currentColor"/><path d="M78 14a18 18 0 1 0 0 32 14 14 0 0 1 0-32z" fill="currentColor" opacity=".7"/></svg>',
    '妈':'<svg viewBox="0 0 100 60"><circle cx="50" cy="18" r="11" fill="currentColor"/><path d="M30 56c0-14 9-24 20-24s20 10 20 24z" fill="currentColor" opacity=".85"/></svg>',
    '来':'<svg viewBox="0 0 100 60"><rect x="47" y="14" width="6" height="40" rx="3" fill="currentColor"/><circle cx="38" cy="22" r="6" fill="currentColor" opacity=".8"/><circle cx="62" cy="22" r="6" fill="currentColor" opacity=".8"/><circle cx="34" cy="34" r="6" fill="currentColor" opacity=".7"/><circle cx="66" cy="34" r="6" fill="currentColor" opacity=".7"/></svg>',
    '老':'<svg viewBox="0 0 100 60"><circle cx="50" cy="20" r="12" fill="currentColor"/><path d="M32 56c0-13 8-22 18-22s18 9 18 22z" fill="currentColor" opacity=".8"/></svg>'
  };

  // ───────── the six stations (六书) ─────────
  var STATIONS = [
    { cat:'象形', catPy:'xiàngxíng', en:'Pictograph', accent:'#3E8E72', soft:'#BCDDD1', tint:'#E4F1EC',
      char:'山', py:'shān', mean:'mountain', type:'align',
      idea:'The character <b>is a picture</b> of the thing itself.',
      align:{ picture:'<svg viewBox="0 0 240 150"><polygon points="120,18 184,134 56,134" fill="currentColor"/><polygon points="60,46 110,134 10,134" fill="currentColor" opacity=".65"/><polygon points="180,46 230,134 130,134" fill="currentColor" opacity=".65"/></svg>',
        pictureLabel:'three peaks against the sky' } },
    { cat:'指事', catPy:'zhǐshì', en:'Indicative', accent:'#C2603A', soft:'#F0C9B4', tint:'#FBEAE0',
      char:'本', py:'běn', mean:'root · origin', type:'mark',
      idea:'A simple <b>mark points</b> at an abstract idea.',
      mark:{ base:'木', baseLabel:'tree', tip:'末', tipPy:'mò', tipLabel:'tip', tipNote:'Put the mark up <b>top</b> instead and you’d forge 末 (mò) — the tip of the tree.' } },
    { cat:'会意', catPy:'huìyì', en:'Compound idea', accent:'#2F7DA6', soft:'#BBD7E6', tint:'#E3EFF4',
      char:'明', py:'míng', mean:'bright', type:'fuse',
      idea:'Two <b>meanings combine</b> into a brand-new one.',
      fuse:{ a:{ch:'日',label:'sun'}, b:{ch:'月',label:'moon'}, eq:'sun ☀ + moon ☾ = bright' } },
    { cat:'形声', catPy:'xíngshēng', en:'Sound + meaning', accent:'#7E4B86', soft:'#D8C4DB', tint:'#F1E8F2',
      char:'妈', py:'mā', mean:'mother', type:'fuse',
      idea:'One half gives the <b>meaning</b>, the other gives the <b>sound</b>. This is how ~80% of all characters work.',
      fuse:{ a:{ch:'女',label:'MEANING · woman'}, b:{ch:'马',label:'SOUND · mǎ'}, eq:'woman + (mǎ →) = mā', sound:true } },
    { cat:'假借', catPy:'jiǎjiè', en:'Phonetic loan', accent:'#B58A2E', soft:'#EAD8A6', tint:'#F7EFD8',
      char:'来', py:'lái', mean:'to come', type:'borrow',
      idea:'A spoken word had <b>no character</b>, so it borrowed one that sounded the same.',
      borrow:{ origin:'a stalk of wheat', originPy:'lái', word:'lái', wordEn:'“to come”' } },
    { cat:'转注', catPy:'zhuǎnzhù', en:'Mutual explanation', accent:'#5C708A', soft:'#C7D1DE', tint:'#E9EEF4',
      char:'老', py:'lǎo', mean:'old', type:'link',
      idea:'The rare, debated sixth: two characters grown from <b>one root</b> that explain each other.',
      link:{ pair:{ch:'考',py:'kǎo',mean:'aged · to test'}, root:'a bent figure with long hair & a staff' } },
  ];

  // ───────── state ─────────
  var LS='ccs-forge-v1';
  var DEFAULT={ step:0, forged:[], score:0 };
  var store;
  function load(){ try{ var s=JSON.parse(localStorage.getItem(LS)); store = s && s.forged ? s : JSON.parse(JSON.stringify(DEFAULT)); }catch(e){ store=JSON.parse(JSON.stringify(DEFAULT)); } }
  function save(){ try{ localStorage.setItem(LS, JSON.stringify(store)); }catch(e){} }
  function isForged(ch){ return store.forged.indexOf(ch)>=0; }

  var opts={ sound:true, hints:true };

  // ───────── theming ─────────
  function applyAccent(st){ var r=document.documentElement.style; r.setProperty('--rc',st.accent); r.setProperty('--rc-soft',st.soft); r.setProperty('--rc-tint',st.tint); }

  // ───────── header / codex / strip ─────────
  function renderChrome(){
    var stamps=STATIONS.map(function(st,i){ var done=isForged(st.char);
      return '<button class="codex-stamp '+(done?'done':'')+(i===store.step?' cur':'')+'" data-i="'+i+'" style="--rc:'+st.accent+';--rc-tint:'+st.tint+';--rc-soft:'+st.soft+'">'+
        '<span class="cs-cat zh">'+st.cat+'</span>'+
        '<span class="cs-ch zh">'+(done?st.char:'?')+'</span>'+
        '<span class="cs-en">'+esc(st.en)+'</span></button>';
    }).join('');
    $('#codex').innerHTML = stamps;
    $$('#codex .codex-stamp').forEach(function(b){ b.addEventListener('click', function(){ var i=+b.dataset.i; if(i<=maxReachable()){ store.step=i; save(); renderStation(); renderChrome(); } }); });
    $('#score-v').textContent = store.score;
    $('#forged-v').textContent = store.forged.length;
    renderStrip();
  }
  function maxReachable(){ return Math.min(STATIONS.length-1, store.forged.length); }
  function renderStrip(){
    var host=$('#strip');
    if(!store.forged.length){ host.innerHTML='<div class="strip-empty">Forge a character and watch it join your scroll →</div>'; return; }
    host.innerHTML = store.forged.map(function(ch){ var st=byChar(ch);
      return '<div class="strip-item" style="--rc:'+st.accent+';--rc-tint:'+st.tint+'"><div class="si-motif">'+(MOTIF[ch]||'')+'</div><div class="si-ch zh">'+ch+'</div><div class="si-py">'+st.py+'</div></div>';
    }).join('');
  }
  function byChar(ch){ for(var i=0;i<STATIONS.length;i++) if(STATIONS[i].char===ch) return STATIONS[i]; return null; }

  // ───────── station rendering ─────────
  function renderStation(){
    var st=STATIONS[store.step]; applyAccent(st);
    $('#dots').innerHTML = STATIONS.map(function(s,i){ return '<i class="'+(i<store.forged.length?'done':'')+(i===store.step?' cur':'')+'"></i>'; }).join('');
    var head='<div class="cat-badge"><span class="cb-zh zh">'+st.cat+'</span><span class="cb-py">'+st.catPy+'</span><span class="cb-en">'+esc(st.en)+'</span></div>'+
      '<p class="cat-idea">'+st.idea+'</p>';
    $('#arena-head').innerHTML = head;
    var done=isForged(st.char);
    var build = ({ align:buildAlign, mark:buildMark, fuse:buildFuse, borrow:buildBorrow, link:buildLink })[st.type](st, done);
    $('#arena').innerHTML = build.html;
    $('#next').style.display = done ? 'inline-flex' : 'none';
    $('#next').innerHTML = store.step>=STATIONS.length-1 ? 'See your scroll <span class="zh">完成</span> ›' : 'Next station <span class="zh">继续</span> ›';
    if (!done && build.wire) build.wire($('#arena'));
    if (done && build.showDone) build.showDone($('#arena'));
  }

  // shared: the forged result reveal block
  function resultHTML(st, extra){
    return '<div class="result"><div class="result-ch zh">'+st.char+'</div>'+
      '<div class="result-meta"><span class="result-py">'+st.py+'</span><span class="result-en">'+esc(st.mean)+'</span></div>'+
      (extra?'<div class="result-eq">'+extra+'</div>':'')+'</div>';
  }

  // ── ALIGN (象形): drag the glyph onto the real picture ──
  function buildAlign(st, done){
    if (done) return { html:'<div class="frame solo">'+resultHTML(st,'象形 · the glyph <b>is</b> the picture')+'</div>' };
    var html='<div class="align-wrap">'+
      '<div class="picframe"><div class="pic">'+st.align.picture+'</div><div class="dropzone" id="dz" data-zone="pic"></div>'+
        (opts.hints?'<div class="pic-cap">'+esc(st.align.pictureLabel)+'</div>':'')+'</div>'+
      '<div class="piece glyphpiece" id="pc"><span class="zh">'+st.char+'</span></div>'+
      '<div class="howto">Drag the glyph onto the picture — see it <b>become</b> the mountains.</div>'+
    '</div>';
    return { html:html, wire:function(c){
      draggable($('#pc',c), function(zone){ if(zone){ winAlign(st,c); return true; } return false; });
    }};
  }
  function winAlign(st,c){
    var pf=$('.picframe',c); pf.classList.add('aligned');
    $('#pc',c) && ($('#pc',c).style.display='none');
    pf.insertAdjacentHTML('beforeend','<div class="overlay-glyph zh">'+st.char+'</div>');
    setTimeout(function(){ forgeComplete(st, '象形 · the glyph <b>is</b> the picture'); }, 720);
  }

  // ── MARK (指事): place the indicator on the base glyph ──
  function buildMark(st, done){
    if (done) return { html:'<div class="frame solo">'+resultHTML(st,'指事 · 木 + a mark at the root = 本')+'</div>' };
    var m=st.mark;
    var html='<div class="mark-wrap">'+
      '<div class="markframe"><span class="basech zh">'+m.base+'</span>'+
        '<div class="dropzone mk top" data-zone="top">'+(opts.hints?'<span>top → 末</span>':'')+'</div>'+
        '<div class="dropzone mk base" data-zone="base">'+(opts.hints?'<span>root</span>':'')+'</div>'+
      '</div>'+
      '<div class="piece markpiece" id="pc"><span class="mark-bar"></span><em>the mark</em></div>'+
      '<div class="howto">A 木 is a tree. Drag the mark to its <b>root</b> to forge 本 (origin).</div>'+
    '</div>';
    return { html:html, wire:function(c){
      draggable($('#pc',c), function(zone){
        if(zone==='base'){ winMark(st,c); return true; }
        if(zone==='top'){ toast('That makes 末 (mò) — the tip! Try the <b>root</b> (bottom).'); return false; }
        return false;
      });
    }};
  }
  function winMark(st,c){
    var f=$('.markframe',c); f.classList.add('marked');
    $('#pc',c) && ($('#pc',c).style.display='none');
    setTimeout(function(){ forgeComplete(st, '指事 · 木 + a mark at the root = 本'+(st.mark.tipNote?'<br><span class="eq-note">'+st.mark.tipNote+'</span>':'')); }, 600);
  }

  // ── FUSE (会意 / 形声): drag two components onto the anvil ──
  function buildFuse(st, done){
    if (done) return { html:'<div class="frame solo">'+resultHTML(st, st.fuse.eq)+'</div>' };
    var f=st.fuse;
    var html='<div class="fuse-wrap">'+
      '<div class="comp" id="pa"><span class="comp-ch zh">'+f.a.ch+'</span><span class="comp-lb">'+esc(f.a.label)+'</span></div>'+
      '<div class="anvil" id="anvil"><span class="anvil-plus">＋</span><div class="dropzone" data-zone="anvil"></div></div>'+
      '<div class="comp" id="pb"><span class="comp-ch zh">'+f.b.ch+'</span><span class="comp-lb">'+esc(f.b.label)+'</span></div>'+
      '<div class="howto">Drag <b>both</b> parts onto the anvil to fuse them.</div>'+
    '</div>';
    var placed={};
    return { html:html, wire:function(c){
      ['pa','pb'].forEach(function(id){
        draggable($('#'+id,c), function(zone){
          if(zone==='anvil'){ placed[id]=true; var el=$('#'+id,c); el.classList.add('onanvil'); el.style.pointerEvents='none';
            if(placed.pa&&placed.pb){ winFuse(st,c); } return true; }
          return false;
        });
      });
    }};
  }
  function winFuse(st,c){
    var a=$('#pa',c), b=$('#pb',c), anvil=$('#anvil',c);
    [a,b].forEach(function(e){ if(e) e.classList.add('fusing'); });
    anvil.classList.add('fired');
    setTimeout(function(){ forgeComplete(st, st.fuse.eq); }, 760);
  }

  // ── BORROW (假借): lend a same-sound character to a wordless word ──
  function buildBorrow(st, done){
    if (done) return { html:'<div class="frame solo">'+resultHTML(st,'假借 · borrowed the wheat-glyph for the sound <b>lái</b>')+'</div>' };
    var b=st.borrow;
    var html='<div class="borrow-wrap">'+
      '<div class="bubble"><span class="bub-sound">「'+b.word+'」</span><span class="bub-en">'+esc(b.wordEn)+' — a word with <b>no character</b></span>'+
        '<div class="dropzone bub-slot" data-zone="slot"><span>？</span></div></div>'+
      '<div class="piece wheatpiece" id="pc"><span class="zh">'+st.char+'</span><span class="wheat-lb">'+esc(b.origin)+'<br><em>sounds like “'+b.originPy+'”</em></span></div>'+
      '<div class="howto">The wheat-glyph already sounds like <b>lái</b>. Drag it in to <b>lend</b> its sound.</div>'+
    '</div>';
    return { html:html, wire:function(c){
      draggable($('#pc',c), function(zone){ if(zone==='slot'){ winBorrow(st,c); return true; } return false; });
    }};
  }
  function winBorrow(st,c){
    var slot=$('.bub-slot',c); slot.classList.add('filled'); slot.innerHTML='<span class="zh">'+st.char+'</span>';
    $('#pc',c) && ($('#pc',c).style.display='none');
    setTimeout(function(){ forgeComplete(st, '假借 · borrowed the wheat-glyph for the sound <b>lái</b>'); }, 640);
  }

  // ── LINK (转注): connect two characters from one root ──
  function buildLink(st, done){
    var p=st.link.pair;
    if (done) return { html:'<div class="frame solo">'+resultHTML(st,'转注 · 老 ↔ 考, two branches of one root')+'</div>' };
    var html='<div class="link-wrap">'+
      '<div class="rootnote">one ancient root: '+esc(st.link.root)+'</div>'+
      '<div class="linkrow">'+
        '<div class="linkcard" id="lc-a"><span class="zh">'+st.char+'</span><span class="lc-py">'+st.py+'</span><span class="lc-en">'+esc(st.mean)+'</span></div>'+
        '<svg class="linksvg" id="linksvg" viewBox="0 0 200 60"><path id="linkpath" d="M10 30 H190" /></svg>'+
        '<div class="linkcard" id="lc-b"><span class="zh">'+p.ch+'</span><span class="lc-py">'+p.py+'</span><span class="lc-en">'+esc(p.mean)+'</span></div>'+
      '</div>'+
      '<button class="linkbtn" id="linkbtn">Trace their shared root <span class="zh">连</span></button>'+
    '</div>';
    return { html:html, wire:function(c){
      $('#linkbtn',c).addEventListener('click', function(){
        $('#linksvg',c).classList.add('drawn'); $('#lc-a',c).classList.add('lit'); $('#lc-b',c).classList.add('lit'); this.style.display='none';
        setTimeout(function(){ forgeComplete(st, '转注 · 老 ↔ 考, two branches of one root'); }, 720);
      });
    }};
  }

  // ───────── completion ─────────
  function forgeComplete(st, eq){
    if (!isForged(st.char)){ store.forged.push(st.char); store.score += 50; save(); }
    if (opts.sound) speak(st.char);
    renderChrome();
    showReveal(st, eq);
  }
  function showReveal(st, eq){
    var ov=$('#reveal'); ov.className='reveal show';
    ov.innerHTML='<div class="rv-card" style="--rc:'+st.accent+';--rc-soft:'+st.soft+';--rc-tint:'+st.tint+'">'+
      '<div class="rv-eyebrow"><span class="dot"></span>Forged · <span class="zh">炼成</span> · <span class="zh">'+st.cat+'</span> '+esc(st.en)+'</div>'+
      '<div class="rv-motif">'+(MOTIF[st.char]||'')+'</div>'+
      '<div class="rv-ch zh">'+st.char+'</div>'+
      '<div class="rv-py">'+st.py+'</div><div class="rv-en">'+esc(st.mean)+'</div>'+
      '<div class="rv-eq">'+eq+'</div>'+
      '<div class="rv-actions"><button class="fbtn ghost" id="rv-say"><span class="zh">听</span> Say it</button>'+
      '<button class="fbtn solid" id="rv-go">Add to my scroll <span class="zh">收</span></button></div>'+
    '</div>';
    confetti(ov,[st.accent,st.soft,'#E0A23A','#fff']);
    $('#rv-say').addEventListener('click', function(){ speak(st.char); });
    $('#rv-go').addEventListener('click', function(){ ov.className='reveal'; flyToStrip(st); });
  }
  function flyToStrip(st){
    // brief pop on the strip then advance availability (Next handles moving on)
    renderStrip();
    var items=$$('#strip .strip-item'); var last=items[items.length-1];
    if(last){ last.classList.add('pop'); setTimeout(function(){ last.classList.remove('pop'); }, 600); }
    renderStation();
    toast('<span class="zh">'+st.char+'</span> joined your scroll · +50');
  }

  // ───────── drag helper ─────────
  function draggable(el, onDrop){
    if(!el) return;
    var ox=0, oy=0, sx=0, sy=0, moving=false, home, ph;
    el.style.touchAction='none';
    el.addEventListener('pointerdown', function(e){
      if(moving) return;
      moving=true;
      var r=el.getBoundingClientRect();
      // leave a same-size placeholder so the flex row doesn't reflow/jump
      if(!ph){ ph=document.createElement('div'); ph.style.width=r.width+'px'; ph.style.height=r.height+'px'; ph.style.flex='0 0 auto'; ph.style.visibility='hidden'; el.parentNode.insertBefore(ph, el); }
      var pr=el.offsetParent.getBoundingClientRect();
      el.style.position='absolute'; el.style.margin='0'; el.style.left=(r.left-pr.left)+'px'; el.style.top=(r.top-pr.top)+'px';
      home={left:el.offsetLeft, top:el.offsetTop};
      el.style.zIndex=50; el.classList.add('dragging');
      sx=e.clientX; sy=e.clientY; ox=el.offsetLeft; oy=el.offsetTop;
      try{ el.setPointerCapture(e.pointerId); }catch(_){}
      e.preventDefault();
    });
    el.addEventListener('pointermove', function(e){ if(!moving) return; el.style.left=(ox+e.clientX-sx)+'px'; el.style.top=(oy+e.clientY-sy)+'px'; });
    el.addEventListener('pointerup', function(e){
      if(!moving) return; moving=false; el.classList.remove('dragging');
      var cx=el.getBoundingClientRect().left+el.offsetWidth/2, cy=el.getBoundingClientRect().top+el.offsetHeight/2;
      var zone=null;
      $$('.dropzone').forEach(function(z){ var r=z.getBoundingClientRect(); if(cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom) zone=z.dataset.zone; });
      var ok=onDrop(zone);
      if(!ok){ el.style.transition='left .25s,top .25s'; el.style.left=home.left+'px'; el.style.top=home.top+'px'; setTimeout(function(){ el.style.transition=''; el.style.zIndex=''; },260); }
      else if(ph&&ph.parentNode){ ph.parentNode.removeChild(ph); ph=null; }
    });
  }

  // ───────── audio (TTS) ─────────
  function speak(ch){ try{ if(!window.speechSynthesis) return; var u=new SpeechSynthesisUtterance(ch); u.lang='zh-CN'; u.rate=.8; var vs=speechSynthesis.getVoices(); var zh=vs.filter(function(v){return /zh|Chinese/i.test(v.lang+v.name);})[0]; if(zh)u.voice=zh; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }

  // ───────── confetti + toast ─────────
  function confetti(host, colors){ var f=document.createDocumentFragment();
    for(var i=0;i<40;i++){ var b=document.createElement('i'); b.className='confetti-bit'; b.style.left=(Math.random()*100)+'%'; b.style.background=colors[i%colors.length]; b.style.animationDelay=(Math.random()*0.4)+'s'; b.style.animationDuration=(1.5+Math.random()*1.3)+'s'; b.style.width=b.style.height=(6+Math.random()*7)+'px'; f.appendChild(b); }
    host.appendChild(f); setTimeout(function(){ $$('.confetti-bit',host).forEach(function(x){x.remove();}); },3200);
  }
  var toastT; function toast(msg){ var t=$('#ftoast'); t.innerHTML=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('on'); },2800); }

  // ───────── nav ─────────
  function next(){
    if (store.step < STATIONS.length-1){ store.step++; save(); renderStation(); renderChrome(); }
    else { showFinish(); }
  }
  function showFinish(){
    var ov=$('#reveal'); ov.className='reveal show finish';
    var strip=STATIONS.map(function(st){ return '<div class="fin-item" style="--rc:'+st.accent+'"><div class="si-motif">'+(MOTIF[st.char]||'')+'</div><span class="zh">'+st.char+'</span><em class="zh">'+st.cat+'</em></div>'; }).join('');
    ov.innerHTML='<div class="rv-card finish-card"><div class="rv-eyebrow"><span class="dot"></span>Stage complete · <span class="zh">六书</span> The six ways</div>'+
      '<h2 class="fin-h">You forged a character <em>six different ways</em>.</h2>'+
      '<p class="fin-p">Every Chinese character is born by one of these six methods. You just lived all of them — and six new characters joined your scroll.</p>'+
      '<div class="fin-strip">'+strip+'</div>'+
      '<div class="rv-actions"><button class="fbtn ghost" id="rv-reset">↻ Forge again</button><button class="fbtn solid" id="rv-go">Back to the journey <span class="zh">继续</span></button></div></div>';
    confetti(ov,['#3E8E72','#C2603A','#2F7DA6','#7E4B86','#B58A2E','#E0A23A']);
    $('#rv-go').addEventListener('click', function(){ ov.className='reveal'; toast('Stage cleared — in the real app this returns to the scroll map.'); });
    $('#rv-reset').addEventListener('click', function(){ ov.className='reveal'; reset(); });
  }

  // ───────── tweaks ─────────
  function applyTweaks(t){ opts.sound=!!t.sound; opts.hints=t.hints!==false; document.body.dataset.anim=t.anim?'on':'off'; renderStation(); }
  function reset(){ store=JSON.parse(JSON.stringify(DEFAULT)); save(); renderChrome(); renderStation(); toast('Forge reset'); }

  function init(){
    load(); if(store.step>maxReachable()) store.step=maxReachable();
    renderChrome(); renderStation();
    $('#next').addEventListener('click', next);
    if(window.speechSynthesis){ speechSynthesis.onvoiceschanged=function(){}; speechSynthesis.getVoices(); }
  }
  window.JOURNEY = { applyTweaks:applyTweaks, reset:reset, redraw:function(){} };
  function start(){ if (window.CloudSync && window.CloudSync.ready) window.CloudSync.ready.then(init); else init(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
