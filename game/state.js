/* game/state.js — persistence + the two-currency scoring engine + SRS
   One number cannot be both a score and a wallet, so we split them (spec §1):
     经验 XP → 科举 rank   (status; never spent, never decays)
     文 wén                (wallet; the only currency the award store accepts)
   Also owns: per-character mastery + spaced-review schedule, the Parts Deck
   (owned components), chapter seals, store claims, settings, teacher dials,
   and a small simulated class roster for the teacher console. */
(function (G) {
  "use strict";

  // ───────── the book = Casey Band 1, grouped into 4 seal-bearing chapters ─────────
  // Band 1 has flat units; the Chapter is the teacher-defined cluster (spec §2.1).
  // We cluster 2 units per chapter so the 4 seasons / seals / rank ceremonies land.
  var CHAPTERS = [
    { id:'c1', vol:'卷一', season:'春', name:'Spring · First Words',  sub:'春',
      rc:'#3E8E72', soft:'#BCDDD1', tint:'#E4F1EC', units:['b1-u1','b1-u2'] },
    { id:'c2', vol:'卷二', season:'夏', name:'Summer · Numbers & Body', sub:'夏',
      rc:'#2F7DA6', soft:'#BBD7E6', tint:'#E3EFF4', units:['b1-u3','b1-u4'] },
    { id:'c3', vol:'卷三', season:'秋', name:'Autumn · Animals & Food', sub:'秋',
      rc:'#C2603A', soft:'#F0C9B4', tint:'#FBEAE0', units:['b1-u5','b1-u6'] },
    { id:'c4', vol:'卷四', season:'冬', name:'Winter · Class & Festival', sub:'冬',
      rc:'#7E4B86', soft:'#D8C4DB', tint:'#F1E8F2', units:['b1-u7','b1-u8'] }
  ];

  // ───────── 科举 rank ladder (XP thresholds) ─────────
  var RANKS = [
    { lv:1, cn:'学童', py:'xuétóng',    en:'Schoolchild',         min:0 },
    { lv:2, cn:'蒙生', py:'méngshēng',  en:'Pupil',               min:80 },
    { lv:3, cn:'书生', py:'shūshēng',   en:'Scholar',             min:180 },
    { lv:4, cn:'秀才', py:'xiùcái',     en:'Licentiate',          min:300 },
    { lv:5, cn:'举人', py:'jǔrén',      en:'Provincial Graduate', min:460 },
    { lv:6, cn:'贡士', py:'gòngshì',    en:'Tribute Scholar',     min:660 },
    { lv:7, cn:'进士', py:'jìnshì',     en:'Imperial Graduate',   min:900 },
    { lv:8, cn:'状元', py:'zhuàngyuán', en:'Top Scholar',         min:1200 }
  ];
  function rankFor(xp){ var r=RANKS[0]; for(var i=0;i<RANKS.length;i++) if(xp>=RANKS[i].min) r=RANKS[i]; return r; }
  function nextRank(r){ return RANKS[Math.min(RANKS.length-1, r.lv)]; }

  // ───────── teacher-configurable scoring (spec §6 / §8.2) ─────────
  var PRESETS = {
    standard:{ completionWen:10, sealWen:40, dueWen:8, nonDueWen:1, floorWen:20, streakWen:5,
               welcomeWen:10, weeklyCap:80, xpPerChar:10, star2:5, star3:15, sealXp:100, decay:[1,3,7,21] },
    generous:{ completionWen:14, sealWen:55, dueWen:10, nonDueWen:2, floorWen:25, streakWen:7,
               welcomeWen:15, weeklyCap:110, xpPerChar:12, star2:6, star3:18, sealXp:120, decay:[2,4,9,25] },
    strict:{   completionWen:8,  sealWen:30, dueWen:6,  nonDueWen:1, floorWen:15, streakWen:4,
               welcomeWen:8,  weeklyCap:60, xpPerChar:9,  star2:4, star3:12, sealXp:90,  decay:[1,2,5,16] }
  };

  // ───────── default store catalogue (teacher-editable) ─────────
  var STORE = [
    { id:'sticker',  name:'Sticker',          zh:'贴纸', tier:'everyday', price:30,  art:'🌟' },
    { id:'stamp',    name:'Ink stamp',        zh:'印章', tier:'everyday', price:30,  art:'🔖' },
    { id:'eraser',   name:'Eraser',           zh:'橡皮', tier:'everyday', price:35,  art:'🧼' },
    { id:'song',     name:'Choose the song',  zh:'点歌', tier:'everyday', price:40,  art:'🎵' },
    { id:'pencil',   name:'Nice pencil',      zh:'铅笔', tier:'treasure', price:140, art:'✏️' },
    { id:'bookmark', name:'Bookmark set',     zh:'书签', tier:'treasure', price:150, art:'📑' },
    { id:'cert',     name:'Certificate',      zh:'奖状', tier:'treasure', price:160, art:'📜' },
    { id:'honour',   name:'状元 Honour board', zh:'状元榜', tier:'prestige', price:0, rankMin:8, art:'🏵️' },
    { id:'badge',    name:'Rank badge',       zh:'徽章', tier:'prestige', price:0, rankMin:4, art:'🎖️' }
  ];

  // ───────── persistence ─────────
  var LS='ccs-game-v1';
  function isoWeek(d){ d=new Date(d); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-((d.getDay()+6)%7));
    var w1=new Date(d.getFullYear(),0,4); var wk=1+Math.round(((d-w1)/864e5-3+((w1.getDay()+6)%7))/7);
    return d.getFullYear()+'-W'+(wk<10?'0':'')+wk; }
  function today(){ return new Date().toISOString().slice(0,10); }
  function now(){ return Date.now(); }

  function fresh(){
    return {
      book:'b1', xp:0, wen:0,
      wenWeek:{ iso:isoWeek(now()), fromPractice:0 },
      streak:1, lastSession:today(),
      cleared:{}, stars:{},
      mastery:{}, sched:{},                 // sched[char] = { level, dueTs }
      owned:{}, seals:[], claims:[],
      current:'b1-u1',
      settings:{ previewMs:3000, cueLevel:'normal', difficulty:'normal', sound:true, preset:'standard' },
      config:JSON.parse(JSON.stringify(PRESETS.standard))
    };
  }

  // a lightly pre-filled demo state so the scroll opens mid-journey
  function seeded(){
    var s=fresh();
    s.xp=210; s.wen=46; s.streak=5;
    s.wenWeek.fromPractice=34;
    s.cleared={ 'b1-u1':3, 'b1-u2':2, 'b1-u3':3 };
    s.stars=s.cleared;
    s.seals=['c1'];
    s.current='b1-u4';
    // own the parts of cleared units + mark a couple of chars due for review
    ['口','大','人','你','好','女','子','妈','爸','家','一','二','三'].forEach(function(c){ s.owned[c]=true; });
    var dueChars=['你','好','口'];
    dueChars.forEach(function(c){ s.mastery[c]=1; s.sched[c]={ level:1, dueTs:now()-864e5 }; });
    ['大','人','女','子','一'].forEach(function(c){ s.mastery[c]=3; s.sched[c]={ level:2, dueTs:now()+5*864e5 }; });
    return s;
  }

  var store;
  function load(){
    try{ var s=JSON.parse(localStorage.getItem(LS)); store = (s&&s.book) ? s : seeded(); }
    catch(e){ store = seeded(); }
    rollWeek();
    return store;
  }
  function save(){ try{ localStorage.setItem(LS, JSON.stringify(store)); }catch(e){} }
  function get(){ return store; }
  function reset(){ store=seeded(); save(); return store; }
  function hardReset(){ store=fresh(); save(); return store; }

  function rollWeek(){ var wk=isoWeek(now()); if(store.wenWeek.iso!==wk){ store.wenWeek={ iso:wk, fromPractice:0 }; } }

  // ───────── 文 wallet (with weekly cap + anti-farm) ─────────
  // capped sources count toward the ~80/wk practice cap; milestones are exempt.
  function addWen(amount, opts){
    opts=opts||{}; rollWeek();
    var amt=amount;
    if (opts.capped){
      var room=Math.max(0, store.config.weeklyCap - store.wenWeek.fromPractice);
      amt=Math.min(amt, room);
      store.wenWeek.fromPractice += amt;
    }
    store.wen += amt; save();
    return amt;
  }

  // ───────── XP / rank ─────────
  function addXp(amount){ var before=rankFor(store.xp); store.xp+=amount; save();
    var after=rankFor(store.xp); return { ranked: after.lv>before.lv, rank:after }; }

  // ───────── chapter / progression helpers ─────────
  function chapters(){ return CHAPTERS; }
  function chapterOf(unitId){ for(var i=0;i<CHAPTERS.length;i++) if(CHAPTERS[i].units.indexOf(unitId)>=0) return CHAPTERS[i]; return CHAPTERS[0]; }
  function chapterById(id){ for(var i=0;i<CHAPTERS.length;i++) if(CHAPTERS[i].id===id) return CHAPTERS[i]; return null; }
  function chapterUnlocked(id){ var i=indexOfChapter(id); return i===0 || store.seals.indexOf(CHAPTERS[i-1].id)>=0; }
  function indexOfChapter(id){ for(var i=0;i<CHAPTERS.length;i++) if(CHAPTERS[i].id===id) return i; return 0; }
  function chapterCleared(id){ var c=chapterById(id); return c.units.every(function(u){ return store.cleared[u]!=null; }); }
  function unitCleared(u){ return store.cleared[u]!=null; }
  function unitState(u){
    var ch=chapterOf(u);
    if (store.cleared[u]!=null) return 'done';
    if (store.current===u && chapterUnlocked(ch.id)) return 'current';
    // a unit is current-eligible if all earlier units in unlocked chapters are done
    return 'locked';
  }

  // ───────── SRS (ink fade) ─────────
  function masteryOf(ch){ if(store.mastery[ch]==null) return store.owned[ch]?3:0; return store.mastery[ch]; }
  function isCharDue(ch){ var s=store.sched[ch]; return !!(s && now()>=s.dueTs); }
  function dueChars(){ var out=[]; for(var c in store.sched){ if(isCharDue(c)) out.push(c); } return out; }
  function unitDue(u){
    var content=G.Content; if(!content) return false;
    var unit=content.unitById(u); if(!unit) return false;
    return unit.writeChars.some(function(c){ return isCharDue(c); });
  }
  // set a char to full strength + schedule its first/next fade
  function inkChar(ch, advance){
    var s=store.sched[ch]||{ level:0, dueTs:0 };
    if (advance) s.level=Math.min(3, s.level+1);
    var days=store.config.decay[Math.min(s.level, store.config.decay.length-1)];
    s.dueTs = now() + days*864e5;
    store.sched[ch]=s; store.mastery[ch]=3; save();
  }
  function ownPart(ch){ if(!store.owned[ch]){ store.owned[ch]=true; save(); return true; } return false; }

  // ───────── streak / attendance ─────────
  function logSession(){
    var t=today();
    if (store.lastSession===t) return { floor:0, streak:0, welcome:0 };
    var prev=new Date(store.lastSession), cur=new Date(t);
    var gap=Math.round((cur-prev)/864e5);
    var welcome=0;
    if (gap===1) store.streak+=1; else { store.streak=1; }
    if (gap>3 && dueChars().length) welcome=store.config.welcomeWen; // welcome-back after absence
    store.lastSession=t;
    var floor=addWen(store.config.floorWen, { capped:false });       // attendance floor (exempt)
    var streakW=addWen(store.config.streakWen, { capped:true });     // streak (capped)
    if (welcome) addWen(welcome, { capped:false });
    save();
    return { floor:floor, streak:streakW, welcome:welcome };
  }

  // ───────── store / claims ─────────
  function storeItems(){ return STORE; }
  function canAfford(item){ return store.wen>=item.price; }
  function redeem(item){
    if (item.tier==='prestige') return { ok:false, reason:'prestige' };
    if (store.wen<item.price) return { ok:false, reason:'funds' };
    store.wen-=item.price;
    store.claims.unshift({ item:item.id, name:item.name, zh:item.zh, wen:item.price, status:'pending', ts:now() });
    save();
    return { ok:true };
  }
  function fulfillClaim(ts){ var c=store.claims.filter(function(x){return x.ts===ts;})[0]; if(c){ c.status='fulfilled'; save(); } }

  // ───────── teacher config ─────────
  function applyPreset(name){ if(PRESETS[name]){ store.config=JSON.parse(JSON.stringify(PRESETS[name])); store.settings.preset=name; save(); } }
  function setConfig(key, val){ store.config[key]=val; store.settings.preset='custom'; save(); }

  // ───────── simulated class roster (teacher console) ─────────
  var ROSTER=[
    { id:'you', name:'You', you:true },
    { id:'mei', name:'美玲 Mei', xp:380, wen:62, streak:6, due:1 },
    { id:'kai', name:'凯文 Kevin', xp:150, wen:48, streak:2, due:4 },
    { id:'ann', name:'安娜 Anna', xp:640, wen:90, streak:9, due:0 },
    { id:'leo', name:'李欧 Leo', xp:95, wen:24, streak:1, due:6 },
    { id:'sun', name:'孙小宝 Bao', xp:300, wen:55, streak:4, due:2 }
  ];
  function roster(){
    return ROSTER.map(function(r){
      if (r.you){ var rk=rankFor(store.xp);
        return { id:'you', name:'You', you:true, rank:rk, xp:store.xp, wen:store.wen, streak:store.streak,
                 due:dueChars().length, claims:store.claims.filter(function(c){return c.status==='pending';}).length };
      }
      return { id:r.id, name:r.name, rank:rankFor(r.xp), xp:r.xp, wen:r.wen, streak:r.streak, due:r.due, claims:0 };
    });
  }
  function grant(studentId, amount){
    if (studentId==='you'){ addWen(amount, { capped:false }); }
    else { var r=ROSTER.filter(function(x){return x.id===studentId;})[0]; if(r) r.wen+=amount; }
  }

  G.State = {
    load:load, save:save, get:get, reset:reset, hardReset:hardReset,
    RANKS:RANKS, rankFor:rankFor, nextRank:nextRank, PRESETS:PRESETS,
    addWen:addWen, addXp:addXp,
    chapters:chapters, chapterOf:chapterOf, chapterById:chapterById, chapterUnlocked:chapterUnlocked,
    chapterCleared:chapterCleared, unitCleared:unitCleared, unitState:unitState,
    masteryOf:masteryOf, isCharDue:isCharDue, dueChars:dueChars, unitDue:unitDue,
    inkChar:inkChar, ownPart:ownPart, logSession:logSession,
    storeItems:storeItems, canAfford:canAfford, redeem:redeem, fulfillClaim:fulfillClaim,
    applyPreset:applyPreset, setConfig:setConfig, roster:roster, grant:grant
  };
})(window.GAME = window.GAME || {});
