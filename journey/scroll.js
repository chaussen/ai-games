/* scroll.js — 千字长卷 · The Thousand-Character Scroll
   A handscroll game-layer prototype for Character Studio, built to SCALE.
   A book's characters unroll left→right as a painted scroll through the four
   seasons; lessons are stages; each chapter (卷) ends in a seal + rank-up.
   Input data: 中文 Book 1, Lesson set (143 characters / 12 lessons). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }

  // ───────── pinyin for the 中文 Book 1 character set ─────────
  var PY = {"一":"yī","二":"èr","三":"sān","四":"sì","五":"wǔ","六":"liù","七":"qī","八":"bā","九":"jiǔ","十":"shí","百":"bǎi","千":"qiān",
    "人":"rén","头":"tóu","目":"mù","耳":"ěr","口":"kǒu","牙":"yá","心":"xīn","手":"shǒu","足":"zú","大":"dà","小":"xiǎo","多":"duō","少":"shǎo",
    "上":"shàng","下":"xià","左":"zuǒ","右":"yòu","中":"zhōng","来":"lái","去":"qù","出":"chū","入":"rù","座":"zuò","立":"lì","走":"zǒu",
    "日":"rì","月":"yuè","天":"tiān","地":"dì","东":"dōng","南":"nán","西":"xī","北":"běi","父":"fù","母":"mǔ","子":"zǐ","女":"nǚ",
    "风":"fēng","云":"yún","雨":"yǔ","电":"diàn","山":"shān","石":"shí","田":"tián","禾":"hé","金":"jīn","木":"mù","水":"shuǐ","火":"huǒ","土":"tǔ",
    "马":"mǎ","牛":"niú","羊":"yáng","鸟":"niǎo","虫":"chóng","鱼":"yú","衣":"yī","米":"mǐ","门":"mén","车":"chē","瓜":"guā","果":"guǒ",
    "学":"xué","生":"shēng","家":"jiā","好":"hǎo","我":"wǒ","叫":"jiào","今":"jīn","年":"nián","岁":"suì","是":"shì","喜":"xǐ","欢":"huān","习":"xí","文":"wén",
    "的":"de","有":"yǒu","爸":"bà","妈":"mā","哥":"gē","姐":"jiě","妹":"mèi","和":"hé","爱":"ài",
    "校":"xiào","开":"kāi","了":"le","真":"zhēn","高":"gāo","兴":"xìng","见":"jiàn","老":"lǎo","师":"shī","说":"shuō","早":"zǎo","同":"tóng","你":"nǐ","们":"men",
    "认":"rèn","方":"fāng","向":"xiàng","起":"qǐ","面":"miàn","太":"tài","阳":"yáng","前":"qián","后":"hòu","个":"gè",
    "季":"jì","春":"chūn","夏":"xià","秋":"qiū","冬":"dōng","花":"huā","知":"zhī","唱":"chàng","树":"shù","叶":"yè","黄":"huáng","雪":"xuě","飞":"fēi",
    "新":"xīn","到":"dào","热":"rè","闹":"nào","穿":"chuān","戴":"dài","帽":"mào","祝":"zhù","身":"shēn","体":"tǐ"};
  function ruby(ch){ return '<ruby>'+esc(ch)+'<rt>'+esc(PY[ch]||'')+'</rt></ruby>'; }

  // ───────── the lessons (the stages) ─────────
  function L(n, glyph, theme, themeEn, chars){ return { n:n, id:'L'+n, glyph:glyph, theme:theme, themeEn:themeEn, chars:chars.split('') }; }
  var LESSONS = [
    L(1,'十','数字','Numbers','一二三四五六七八九十百千'),
    L(2,'人','身体','Body & senses','人头目耳口牙心手足大小多少'),
    L(3,'上','方位','Here & there','上下左右中来去出入座立走'),
    L(4,'日','天地','Sky & earth','日月天地东南西北父母子女'),
    L(5,'山','自然','Nature','风云雨电山石田禾金木水火土'),
    L(6,'马','动物','Animals & things','马牛羊鸟虫鱼衣米门车瓜果'),
    L(7,'学','上学','School & me','学生家好我叫今年岁是喜欢习文'),
    L(8,'爱','家人','My family','的有爸妈哥姐妹和爱'),
    L(9,'师','学校','At school','校开了真高兴见老师说早同你们'),
    L(10,'向','方向','Directions','认方向起面太阳前后个'),
    L(11,'季','四季','Seasons','季春夏秋冬花知唱树叶黄雪飞'),
    L(12,'祝','过节','Festival','新到热闹穿戴帽祝身体'),
  ];
  function lessonById(id){ for(var i=0;i<LESSONS.length;i++) if(LESSONS[i].id===id) return LESSONS[i]; return null; }
  var TOTAL_CHARS = LESSONS.reduce(function(s,l){ return s+l.chars.length; },0);

  // ───────── the four chapters (卷) — one season each ─────────
  var SCENES = [
    { id:'S1', vol:'卷一', season:'春', name:'Spring Hills',     sub:'青山', rc:'#3E8E72', soft:'#BCDDD1', tint:'#E4F1EC', lessons:[1,2,3] },
    { id:'S2', vol:'卷二', season:'夏', name:'Summer Waters',    sub:'夏水', rc:'#2F7DA6', soft:'#BBD7E6', tint:'#E3EFF4', lessons:[4,5,6] },
    { id:'S3', vol:'卷三', season:'秋', name:'Autumn Academy',   sub:'秋院', rc:'#C2603A', soft:'#F0C9B4', tint:'#FBEAE0', lessons:[7,8,9] },
    { id:'S4', vol:'卷四', season:'冬', name:'Winter Festival',  sub:'冬节', rc:'#7E4B86', soft:'#D8C4DB', tint:'#F1E8F2', lessons:[10,11,12] },
  ];
  function sceneById(id){ for(var i=0;i<SCENES.length;i++) if(SCENES[i].id===id) return SCENES[i]; return null; }
  function sceneOfLesson(n){ for(var i=0;i<SCENES.length;i++) if(SCENES[i].lessons.indexOf(n)>=0) return SCENES[i]; return SCENES[0]; }

  // ───────── rank ladder (科举) ─────────
  var RANKS = [
    { lv:1, cn:'学童', py:'xuétóng',    en:'Schoolchild',         min:0 },
    { lv:2, cn:'蒙生', py:'méngshēng',  en:'Pupil',               min:80 },
    { lv:3, cn:'书生', py:'shūshēng',   en:'Scholar',             min:180 },
    { lv:4, cn:'秀才', py:'xiùcái',     en:'Licentiate',          min:300 },
    { lv:5, cn:'举人', py:'jǔrén',      en:'Provincial Graduate', min:460 },
    { lv:6, cn:'贡士', py:'gòngshì',    en:'Tribute Scholar',     min:660 },
    { lv:7, cn:'进士', py:'jìnshì',     en:'Imperial Graduate',   min:900 },
    { lv:8, cn:'状元', py:'zhuàngyuán', en:'Top Scholar',         min:1200 },
  ];
  function rankFor(xp){ var r=RANKS[0]; for(var i=0;i<RANKS.length;i++) if(xp>=RANKS[i].min) r=RANKS[i]; return r; }
  function nextRank(r){ return RANKS[Math.min(RANKS.length-1, r.lv)]; }

  // ───────── persistence ─────────
  var LS = 'ccs-scroll-v1';
  var DEFAULT = { cleared:{ 'L1':3,'L2':3,'L3':2,'L4':3 }, current:'L5', xp:245, seals:['S1'], due:['L2'], scrollX:0 };
  var store;
  function load(){ try{ var s=JSON.parse(localStorage.getItem(LS)); store = s && s.cleared ? s : JSON.parse(JSON.stringify(DEFAULT)); }catch(e){ store = JSON.parse(JSON.stringify(DEFAULT)); } }
  function save(){ try{ localStorage.setItem(LS, JSON.stringify(store)); }catch(e){} }

  function sceneUnlocked(id){ var i=SCENES.indexOf(sceneById(id)); return i===0 || store.seals.indexOf(SCENES[i-1].id)>=0; }
  function lessonState(n){
    var s=sceneOfLesson(n);
    if (store.cleared['L'+n]!=null) return 'done';
    if (store.current==='L'+n && sceneUnlocked(s.id)) return 'current';
    return 'locked';
  }
  function sceneCleared(id){ var s=sceneById(id); for(var i=0;i<s.lessons.length;i++) if(store.cleared['L'+s.lessons[i]]==null) return false; return true; }
  function gateState(id){
    if (store.seals.indexOf(id)>=0) return 'done';
    if (sceneUnlocked(id) && sceneCleared(id)) return 'current';
    return 'locked';
  }
  function isDue(n){ return store.due.indexOf('L'+n)>=0; }
  function masteredChars(){ var c=0; for(var k in store.cleared){ var l=lessonById(k); if(l) c+=l.chars.length; } return c; }
  function clearedScene(id){ var s=sceneById(id), c=0; for(var i=0;i<s.lessons.length;i++) if(store.cleared['L'+s.lessons[i]]!=null) c++; return c; }

  // per-character mastery 0..3 (deterministic; shows depth + decay)
  function charMastery(n, i){
    var st=lessonState(n);
    if (st==='locked') return 0;
    if (st==='current') return i===0?2:(i<3?1:0);
    if (isDue(n)) return (i%3===0)?1:2;     // faded — due for review
    return 3;                               // solid
  }

  // ───────── flat node sequence (for the path + minimap) ─────────
  var NODES = [];
  function buildNodes(){
    NODES = [];
    SCENES.forEach(function(s){
      s.lessons.forEach(function(n){ NODES.push({ kind:'lesson', scene:s.id, n:n }); });
      NODES.push({ kind:'gate', scene:s.id });
    });
  }
  function nodeKey(nd){ return nd.kind==='gate' ? 'G'+nd.scene : 'L'+nd.n; }
  function currentIndex(){
    for (var i=0;i<NODES.length;i++){
      var nd=NODES[i];
      if (nd.kind==='lesson' && store.current==='L'+nd.n) return i;
      if (nd.kind==='gate' && gateState(nd.scene)==='current') return i;
    }
    // fall back to last done
    var last=0; for (var j=0;j<NODES.length;j++){ var d=NODES[j]; if((d.kind==='lesson'&&lessonState(d.n)==='done')||(d.kind==='gate'&&gateState(d.scene)==='done')) last=j; }
    return last;
  }

  // ───────── HEADER ─────────
  function renderHeader(){
    var rk=rankFor(store.xp), nx=nextRank(rk);
    var span=nx.min-rk.min, into=store.xp-rk.min, pct=span>0?Math.min(100,Math.round(into/span*100)):100;
    var mc=masteredChars(), mpct=Math.round(mc/TOTAL_CHARS*100);
    var seals=SCENES.map(function(s){ var got=store.seals.indexOf(s.id)>=0;
      return '<span class="seal '+(got?'got':'')+'" title="'+esc(s.name)+'" style="--rc:'+s.rc+'"><span class="zh">'+s.season+'</span></span>'; }).join('');
    $('#jhead').innerHTML =
      '<button class="brandseal" id="j-lock" title="Lock"><span class="zh">卷</span></button>'+
      '<div class="rankbox">'+
        '<div class="rankname"><span class="zh">'+rk.cn+'</span> <em>'+esc(rk.en)+'</em></div>'+
        '<div class="xpline"><div class="xpbar"><i style="width:'+pct+'%"></i></div>'+
          '<span class="xpnum">'+store.xp+(rk.lv<8?' / '+nx.min:'')+' <span class="zh">经验</span></span></div>'+
      '</div>'+
      '<div class="hstats">'+
        '<div class="mastery" title="Characters mastered in this book">'+
          '<svg viewBox="0 0 40 40" class="ring"><circle class="r-bg" cx="20" cy="20" r="16"/>'+
          '<circle class="r-fg" cx="20" cy="20" r="16" stroke-dasharray="'+(mpct/100*100.5).toFixed(1)+' 100.5"/></svg>'+
          '<div class="mtxt"><b>'+mc+'</b><span>/ '+TOTAL_CHARS+'</span></div></div>'+
        '<div class="streak" title="Day streak"><div class="dots">'+[0,1,2,3,4,5,6].map(function(d){return '<i class="'+(d<5?'on':'')+'"></i>';}).join('')+'</div><span><b>5</b>-day</span></div>'+
      '</div>'+
      '<div class="sealtray" title="Chapter seals — one per 卷 completed">'+seals+'</div>';
    $('#j-lock').addEventListener('click', function(){ toast('Locked for the next student (demo)'); });
  }

  // ───────── BUILD THE SCROLL ─────────
  var STEP=300, START=190, ENDPAD=240, GAP_SCENE=70;
  function nodeHTML(nd){
    if (nd.kind==='gate'){
      var s=sceneById(nd.scene), gs=gateState(nd.scene);
      return '<button class="node gate" data-key="G'+nd.scene+'" data-kind="gate" data-scene="'+nd.scene+'" data-state="'+gs+'" style="--rc:'+s.rc+';--rc-soft:'+s.soft+';--rc-tint:'+s.tint+'">'+
        '<span class="gateseal"><span class="zh">'+(gs==='locked'?'关':s.season)+'</span>'+(gs==='done'?'<span class="tick">✓</span>':'')+'</span>'+
        '<span class="cap"><span class="num"><span class="zh">'+s.season+'印</span> · Chapter seal</span>'+
          '<span class="th">'+(gs==='done'?'Earned':gs==='current'?'Claim it':'Sealed')+'</span></span>'+
      '</button>';
    }
    var s2=sceneOfLesson(nd.n), l=lessonById('L'+nd.n), st=lessonState(nd.n), stars=store.cleared['L'+nd.n], due=isDue(nd.n)&&st==='done';
    var inner = st==='locked' ? '<span class="lock">🔒</span>' : '<span class="g zh">'+l.glyph+'</span>';
    var starRow=''; if (st==='done'){ var sr=''; for(var i=0;i<3;i++) sr+='<i class="'+(i<stars?'on':'')+'">★</i>'; starRow='<div class="stars">'+sr+'</div>'; }
    var pin = st==='current' ? '<span class="youare"><span class="zh">你在这里</span><em>start here</em></span>' : '';
    var begin = st==='current' ? '<span class="startpill"><span class="zh">开始</span></span>' : '';
    var dueBadge = due ? '<span class="duebadge" title="Due for review">复习</span>' : '';
    return '<button class="node'+(due?' faded':'')+'" data-key="L'+nd.n+'" data-kind="lesson" data-n="'+nd.n+'" data-state="'+st+'" style="--rc:'+s2.rc+';--rc-soft:'+s2.soft+';--rc-tint:'+s2.tint+'">'+
      pin+'<span class="seal2">'+inner+begin+dueBadge+'</span>'+
      '<span class="cap"><span class="num"><span class="zh">第'+nd.n+'课</span></span>'+
        (st==='locked'?'':'<span class="th"><span class="zh">'+l.theme+'</span> · '+esc(l.themeEn)+'</span>')+starRow+'</span>'+
    '</button>';
  }

  var Wtotal=0, layoutPts=[];
  function renderScroll(){
    buildNodes();
    var canvas=$('#canvas');
    Wtotal = START + (NODES.length-1)*STEP + ENDPAD;
    canvas.style.width = Wtotal+'px';
    // scene panels
    var panels='';
    SCENES.forEach(function(s, si){
      panels += '<div class="scene" data-scene="'+s.id+'" data-state="'+(sceneUnlocked(s.id)?(sceneCleared(s.id)&&gateState(s.id)==='done'?'done':'open'):'locked')+'" '+
        'style="--rc:'+s.rc+';--rc-soft:'+s.soft+';--rc-tint:'+s.tint+'">'+
          '<div class="scene-wash"></div><div class="scene-glyph zh">'+s.season+'</div>'+
          '<div class="cartouche"><span class="vol zh">'+s.vol+'</span><span class="ssub zh">'+s.sub+'</span><span class="sname">'+esc(s.name)+'</span></div>'+
        '</div>';
    });
    canvas.innerHTML = '<svg class="road" id="road" preserveAspectRatio="none"><path class="road-base"/><path class="road-done"/></svg>'+
      '<div class="scenes" id="scenes">'+panels+'</div>'+
      '<div class="nodes" id="nodes">'+NODES.map(nodeHTML).join('')+'</div>';
    bindNodes();
    layout();
    renderMiniMap();
  }

  function layout(){
    var stage=$('#stage'), H=stage.clientHeight || 600;
    var canvas=$('#canvas'); canvas.style.height=H+'px';
    var midY=H*0.5, amp=Math.min(H*0.17, 132);
    layoutPts=[];
    var nodeEls=$$('#nodes .node');
    nodeEls.forEach(function(el, i){
      var x=START + i*STEP, y=midY + amp*Math.sin(i*0.66 + 0.6);
      el.style.left=x+'px'; el.style.top=y+'px';
      layoutPts.push([x,y]);
    });
    // scene panels span midpoints between boundary nodes
    var sceneEls=$$('#scenes .scene');
    var idx=0;
    SCENES.forEach(function(s, si){
      var firstI=idx, lastI=idx + s.lessons.length; // gate is last node of scene
      idx = lastI + 1;
      var leftX = si===0 ? 0 : (layoutPts[firstI-1][0]+layoutPts[firstI][0])/2;
      var rightX = si===SCENES.length-1 ? Wtotal : (layoutPts[lastI][0]+layoutPts[lastI+1][0])/2;
      var p=sceneEls[si]; p.style.left=leftX+'px'; p.style.width=(rightX-leftX)+'px';
    });
    // road
    var svg=$('#road'); svg.setAttribute('width',Wtotal); svg.setAttribute('height',H); svg.setAttribute('viewBox','0 0 '+Wtotal+' '+H);
    $('.road-base',svg).setAttribute('d', pathThrough(layoutPts));
    var ci=currentIndex();
    $('.road-done',svg).setAttribute('d', ci>0 ? pathThrough(layoutPts.slice(0, ci+1)) : '');
    updateViewport();
  }
  function pathThrough(pts){
    if(!pts.length) return '';
    var d='M '+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
    for(var i=1;i<pts.length;i++){ var a=pts[i-1],b=pts[i];
      var c1=[a[0]+(b[0]-a[0])*0.5, a[1]], c2=[b[0]-(b[0]-a[0])*0.5, b[1]];
      d+=' C '+c1[0].toFixed(1)+' '+c1[1].toFixed(1)+', '+c2[0].toFixed(1)+' '+c2[1].toFixed(1)+', '+b[0].toFixed(1)+' '+b[1].toFixed(1);
    }
    return d;
  }

  function bindNodes(){
    $$('#nodes .node').forEach(function(n){
      n.addEventListener('click', function(){
        if (dragMoved) return;
        if (n.dataset.kind==='gate') openGate(n.dataset.scene);
        else openLesson(+n.dataset.n);
      });
    });
  }

  // ───────── MINIMAP ─────────
  function renderMiniMap(){
    var mm=$('#minimap'); var Wb=mm.clientWidth||800; var scale=Wb/Wtotal;
    var segs='', dots='';
    var idx=0;
    SCENES.forEach(function(s, si){
      var firstI=idx, lastI=idx+s.lessons.length; idx=lastI+1;
      var leftX = si===0?0:(layoutPts[firstI-1][0]+layoutPts[firstI][0])/2;
      var rightX = si===SCENES.length-1?Wtotal:(layoutPts[lastI][0]+layoutPts[lastI+1][0])/2;
      segs += '<div class="mm-seg" data-scene="'+s.id+'" style="left:'+(leftX*scale)+'px;width:'+((rightX-leftX)*scale)+'px;background:'+s.tint+';border-color:'+s.soft+'"></div>';
    });
    NODES.forEach(function(nd, i){
      var st = nd.kind==='gate'?gateState(nd.scene):lessonState(nd.n);
      var col = st==='done'?'var(--ink)':st==='current'?sceneOfLesson(nd.kind==='gate'?sceneById(nd.scene).lessons[0]:nd.n).rc:'transparent';
      var cls = 'mm-dot'+(nd.kind==='gate'?' gate':'')+(st==='current'?' cur':'')+(st==='locked'?' lk':'');
      dots += '<span class="'+cls+'" style="left:'+(layoutPts[i][0]*scale)+'px"></span>';
    });
    mm.innerHTML = '<div class="mm-track">'+segs+dots+'<div class="mm-window" id="mm-window"></div></div>';
    // click to jump
    $('.mm-track', mm).addEventListener('pointerdown', function(e){
      var rect=this.getBoundingClientRect(); var x=e.clientX-rect.left;
      var stage=$('#stage'); stage.scrollLeft = (x/rect.width)*Wtotal - stage.clientWidth/2;
      mmDragging=true; e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    });
    mm.addEventListener('pointermove', function(e){ if(!mmDragging) return; var rect=$('.mm-track',mm).getBoundingClientRect(); var x=e.clientX-rect.left; var stage=$('#stage'); stage.scrollLeft=(x/rect.width)*Wtotal - stage.clientWidth/2; });
    window.addEventListener('pointerup', function(){ mmDragging=false; });
    updateViewport();
  }
  var mmDragging=false;
  function updateViewport(){
    var mm=$('#minimap'); if(!mm||!$('#mm-window')) return;
    var Wb=mm.clientWidth||800; var scale=Wb/Wtotal; var stage=$('#stage');
    var w=$('#mm-window'); w.style.left=(stage.scrollLeft*scale)+'px'; w.style.width=(stage.clientWidth*scale)+'px';
  }

  function scrollToNode(key, smooth){
    var i=-1; NODES.forEach(function(nd,k){ if(nodeKey(nd)===key) i=k; });
    if(i<0) return; var stage=$('#stage');
    stage.scrollTo({ left: layoutPts[i][0]-stage.clientWidth/2, behavior: smooth?'smooth':'auto' });
  }

  // ───────── SHEET ─────────
  function applyRC(s){ var r=document.documentElement.style; r.setProperty('--rc',s.rc); r.setProperty('--rc-soft',s.soft); r.setProperty('--rc-tint',s.tint); }
  function pips(m){ var h=''; for(var i=0;i<3;i++) h+='<i class="'+(i<m?'on':'')+'"></i>'; return '<span class="pips">'+h+'</span>'; }
  function openLesson(n){
    var l=lessonById('L'+n), s=sceneOfLesson(n), st=lessonState(n), due=isDue(n)&&st==='done'; applyRC(s);
    var tiles=l.chars.map(function(ch,i){ var m=charMastery(n,i);
      return '<span class="ctile m'+m+'"><span class="cz zh">'+ruby(ch)+'</span>'+pips(m)+'</span>'; }).join('');
    var head='<div class="sh-eyebrow"><span class="dot"></span><span class="zh" style="margin-right:7px">'+s.vol+'</span>'+esc(s.name)+'</div>'+
      '<h2><span class="zh">第'+n+'课</span> · '+esc(l.themeEn)+' <span class="zh small">'+l.theme+'</span></h2>'+
      '<p class="sh-sub">'+l.chars.length+' characters · Lesson '+n+' of '+LESSONS.length+'</p>';
    var body='<div class="ctiles">'+tiles+'</div>', foot;
    if (due){
      body+='<div class="sh-reward"><div class="rewardchip">+30 <span class="zh">经验</span></div><span>The ink on these has <b>faded</b>. A quick review re-inks them and keeps your scroll vivid.</span></div>';
      foot='<button class="jbtn ghost" data-act="close">Later</button><button class="jbtn solid" data-act="refresh"><span class="zh">复习</span> Refresh ink ›</button>';
    } else if (st==='done'){
      var sr=''; for(var i=0;i<3;i++) sr+='<i class="'+(i<store.cleared['L'+n]?'on':'')+'">★</i>';
      body+='<div class="sh-reward"><div class="bigstars">'+sr+'</div><span>Cleared with <b>'+store.cleared['L'+n]+' / 3 stars</b>. Every character here is at full strength.</span></div>';
      foot='<button class="jbtn ghost" data-act="close">Back</button><button class="jbtn solid" data-act="review">↻ Practise again</button>';
    } else if (st==='current'){
      body+='<div class="sh-reward"><div class="rewardchip">+'+(l.chars.length*10+30)+' <span class="zh">经验</span></div><span>Clear all '+l.chars.length+' characters to win up to <b>★★★</b> and unroll the next stretch of scroll.</span></div>';
      foot='<button class="jbtn ghost" data-act="close">Not now</button><button class="jbtn solid" data-act="begin">Begin lesson <span class="zh">开始</span> ›</button>';
    } else {
      body+='<div class="sh-locked">🔒 Clear the lesson before this one to unroll <span class="zh">'+l.theme+'</span>.</div>';
      foot='<button class="jbtn ghost" data-act="close">Back</button>';
    }
    showSheet(head, body, foot, function(act){ if(act==='begin') doClear(n); else if(act==='refresh') doRefresh(n); else closeSheet(); });
  }
  function openGate(id){
    var s=sceneById(id), st=gateState(id); applyRC(s);
    var head='<div class="sh-eyebrow"><span class="dot"></span>'+(st==='done'?'Seal earned':st==='current'?'Chapter checkpoint':'Sealed chapter')+'</div>'+
      '<h2><span class="zh">'+s.season+'印</span> · '+esc(s.name)+'</h2>'+
      '<p class="sh-sub">'+s.vol+' · the keeper rewards scholars who clear all three lessons.</p>';
    var body='<div class="gateart"><span class="gs zh" style="color:'+s.rc+'">'+s.season+'</span></div>', foot;
    if (st==='done'){ body+='<div class="sh-reward"><span>Seal collected — the next chapter of the scroll is open.</span></div>'; foot='<button class="jbtn solid" data-act="close">Continue</button>'; }
    else if (st==='current'){ body+='<div class="sh-reward"><div class="rewardchip">+100 <span class="zh">经验</span></div><span>All lessons cleared. Claim the seal to level up and unroll the next chapter.</span></div>'; foot='<button class="jbtn solid" data-act="claim">Claim the <span class="zh">'+s.season+'</span> seal</button>'; }
    else { var c=clearedScene(id); body+='<div class="sh-locked">🔒 Clear all 3 lessons first — <b>'+c+' / 3</b> done.</div>'; foot='<button class="jbtn ghost" data-act="close">Back</button>'; }
    showSheet(head, body, foot, function(act){ if(act==='claim') doClaim(id); else closeSheet(); });
  }
  function showSheet(head, body, foot, onAct){
    var el=$('#sheet'); $('.sheet__head',el).innerHTML=head; $('.sheet__body',el).innerHTML=body; $('.sheet__foot',el).innerHTML=foot;
    $$('.sheet__foot [data-act]',el).forEach(function(b){ b.addEventListener('click', function(){ onAct(b.dataset.act); }); });
    el.classList.add('open'); $('#scrim').classList.add('on');
  }
  function closeSheet(){ $('#sheet').classList.remove('open'); $('#scrim').classList.remove('on'); }

  // ───────── progression ─────────
  function doClear(n){
    var l=lessonById('L'+n), before=rankFor(store.xp);
    store.cleared['L'+n]=3; store.xp += l.chars.length*10+30;
    var s=sceneOfLesson(n), li=s.lessons.indexOf(n);
    if (li < s.lessons.length-1) store.current='L'+s.lessons[li+1];
    else store.current='G'+s.id; // all lessons done → gate becomes current
    save(); closeSheet(); renderHeader(); renderScroll();
    toast('Lesson cleared · +'+(l.chars.length*10+30)+' XP · ★★★');
    setTimeout(function(){ scrollToNode('L'+n, true); }, 60);
    var after=rankFor(store.xp); if(after.lv>before.lv) setTimeout(function(){ showLevelUp(after); }, 560);
  }
  function doRefresh(n){
    store.due = store.due.filter(function(x){ return x!=='L'+n; }); store.xp+=30;
    save(); closeSheet(); renderHeader(); renderScroll();
    toast('Ink refreshed · +30 XP — the scroll is vivid again');
  }
  function doClaim(id){
    var s=sceneById(id), before=rankFor(store.xp);
    if (store.seals.indexOf(id)<0) store.seals.push(id);
    store.xp+=100;
    var si=SCENES.indexOf(s);
    if (si<SCENES.length-1) store.current='L'+SCENES[si+1].lessons[0];
    save(); closeSheet(); renderHeader(); renderScroll();
    showSealGet(s);
    var after=rankFor(store.xp); if(after.lv>before.lv) setTimeout(function(){ showLevelUp(after); }, 1500);
  }

  // ───────── celebrations ─────────
  function confetti(host, colors){
    var f=document.createDocumentFragment();
    for(var i=0;i<48;i++){ var b=document.createElement('i'); b.className='confetti-bit';
      b.style.left=(Math.random()*100)+'%'; b.style.background=colors[i%colors.length];
      b.style.animationDelay=(Math.random()*0.5)+'s'; b.style.animationDuration=(1.6+Math.random()*1.4)+'s';
      b.style.width=b.style.height=(6+Math.random()*8)+'px'; f.appendChild(b); }
    host.appendChild(f); setTimeout(function(){ $$('.confetti-bit',host).forEach(function(x){x.remove();}); }, 3400);
  }
  function showLevelUp(rank){
    var ov=$('#overlay'); ov.className='overlay show';
    ov.innerHTML='<div class="ov-card"><div class="ov-eyebrow"><span class="dot"></span>Rank up · <span class="zh">升级</span></div>'+
      '<div class="ov-rankseal zh">'+rank.cn.charAt(0)+'</div>'+
      '<div class="ov-big"><span class="zh">'+rank.cn+'</span></div><div class="ov-py">'+esc(rank.py)+'</div>'+
      '<div class="ov-en">You are now a <b>'+esc(rank.en)+'</b> · level '+rank.lv+'</div>'+
      '<button class="jbtn solid" id="ov-go">Continue <span class="zh">继续</span></button></div>';
    confetti(ov, ['#3E8E72','#2F7DA6','#C2603A','#7E4B86','#E0A23A']);
    $('#ov-go').addEventListener('click', function(){ ov.className='overlay'; });
  }
  function showSealGet(s){
    var ov=$('#overlay'); ov.className='overlay show';
    ov.innerHTML='<div class="ov-card"><div class="ov-eyebrow"><span class="dot"></span>Chapter sealed · <span class="zh">得印</span></div>'+
      '<div class="ov-rankseal big zh" style="background:'+s.rc+'">'+s.season+'</div>'+
      '<div class="ov-big"><span class="zh">'+s.sub+'</span> '+esc(s.name)+'</div>'+
      '<div class="ov-en">'+s.vol+' complete. A new chapter unrolls on your scroll.</div>'+
      '<button class="jbtn solid" id="ov-go">Onward <span class="zh">继续</span></button></div>';
    confetti(ov, [s.rc, s.soft, '#E0A23A', '#fff']);
    $('#ov-go').addEventListener('click', function(){ ov.className='overlay'; });
  }

  var toastT; function toast(msg){ var t=$('#jtoast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('on'); },2600); }

  // ───────── tweaks ─────────
  function applyTweaks(t){
    var b=document.body;
    b.dataset.node=t.nodeStyle||'seal'; b.dataset.path=t.pathStyle||'trail';
    b.dataset.scenery=t.scenery?'on':'off'; b.dataset.bob=t.motion?'on':'off';
    b.dataset.pinyin=t.pinyin?'on':'off'; b.dataset.fade=t.fade?'on':'off';
    requestAnimationFrame(layout);
  }
  function reset(){ store=JSON.parse(JSON.stringify(DEFAULT)); save(); renderHeader(); renderScroll(); var st=$('#stage'); st.scrollLeft=0; toast('Demo progress reset'); }

  // ───────── navigation: wheel + drag pan + buttons ─────────
  var dragMoved=false;
  function initPan(){
    var stage=$('#stage');
    stage.addEventListener('wheel', function(e){ if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){ stage.scrollLeft+=e.deltaY; e.preventDefault(); } }, {passive:false});
    var down=false, sx=0, sl=0;
    stage.addEventListener('pointerdown', function(e){ if(e.target.closest('.node')) {down=false;return;} down=true; dragMoved=false; sx=e.clientX; sl=stage.scrollLeft; stage.classList.add('grabbing'); });
    window.addEventListener('pointermove', function(e){ if(!down) return; var dx=e.clientX-sx; if(Math.abs(dx)>4) dragMoved=true; stage.scrollLeft=sl-dx; });
    window.addEventListener('pointerup', function(){ down=false; stage.classList.remove('grabbing'); setTimeout(function(){dragMoved=false;},30); });
    stage.addEventListener('scroll', function(){ updateViewport(); clearTimeout(stage._st); stage._st=setTimeout(function(){ store.scrollX=stage.scrollLeft; save(); }, 250); });
    $('#nav-prev').addEventListener('click', function(){ stepScene(-1); });
    $('#nav-next').addEventListener('click', function(){ stepScene(1); });
    $('#nav-here').addEventListener('click', function(){ scrollToNode(store.current.charAt(0)==='G'?store.current:('L'+store.current.slice(1)), true); });
  }
  function stepScene(dir){
    var stage=$('#stage'), cx=stage.scrollLeft+stage.clientWidth/2;
    // find scene whose panel contains center, move to neighbour's first lesson node
    var idx=0, curScene=0; SCENES.forEach(function(s,si){ var fi=idx; idx+=s.lessons.length+1; });
    // simpler: use node x positions
    var target=null, sceneStarts=[]; var k=0;
    SCENES.forEach(function(s){ sceneStarts.push(layoutPts[k][0]); k+=s.lessons.length+1; });
    var ci=0; for(var i=0;i<sceneStarts.length;i++){ if(cx>=sceneStarts[i]-150) ci=i; }
    var ni=Math.max(0,Math.min(SCENES.length-1, ci+dir));
    scrollToNode('L'+SCENES[ni].lessons[0], true);
  }

  // ───────── init ─────────
  var rT; window.addEventListener('resize', function(){ cancelAnimationFrame(rT); rT=requestAnimationFrame(function(){ layout(); renderMiniMap(); }); });
  function init(){
    load(); renderHeader(); renderScroll(); initPan();
    document.addEventListener('click', function(e){ if(e.target&&e.target.id==='scrim') closeSheet(); });
    var stage=$('#stage');
    function restore(){ if(store.scrollX) stage.scrollLeft=store.scrollX; else scrollToNode(store.current.charAt(0)==='G'?store.current:('L'+store.current.slice(1)), false); updateViewport(); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ layout(); renderMiniMap(); restore(); });
    setTimeout(function(){ layout(); renderMiniMap(); restore(); }, 360);
  }
  window.JOURNEY = { applyTweaks:applyTweaks, reset:reset, redraw:function(){ layout(); renderMiniMap(); } };
  function start(){ if (window.CloudSync && window.CloudSync.ready) window.CloudSync.ready.then(init); else init(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
