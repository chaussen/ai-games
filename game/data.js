/* game/data.js — ContentService + Scheduler
   Loads the generated character graph (characters.json / components.json /
   stroke-data.json) and the book playlists, then resolves each stage into the
   3-band checkpoint arc (Parts → Wholes → Use) and produces fully-resolved
   forge round objects with graph-driven decoys. The forge engine never
   decomposes or hand-authors anything — it consumes what this returns. */
(function (G) {
  "use strict";

  var DATA = { chars:{}, comps:{}, strokes:{}, units:[], content:null };
  var ready = false;

  function fetchJSON(url){ return fetch(url).then(function(r){ if(!r.ok) throw new Error(url+' '+r.status); return r.json(); }); }

  function load(){
    if (ready) return Promise.resolve(DATA);
    return Promise.all([
      fetchJSON('assets/data/characters.json'),
      fetchJSON('assets/data/components.json'),
      fetchJSON('assets/data/stroke-data.json'),
      fetchJSON('assets/data/playlists/b1-lessons.json'),
      fetchJSON('assets/data/content-b1.json').catch(function(){ return null; })
    ]).then(function(res){
      DATA.chars = res[0]; DATA.comps = res[1]; DATA.strokes = res[2];
      DATA.units = res[3]; DATA.content = res[4];
      ready = true;
      return DATA;
    });
  }

  // ───────── lookups ─────────
  function charInfo(ch){ return DATA.chars[ch] || null; }
  function compInfo(ch){
    if (DATA.comps[ch]) return DATA.comps[ch];
    var c = DATA.chars[ch];
    if (c) return { char:ch, standalone:true, pinyin:c.pinyin, meaning:c.meaning };
    return { char:ch, standalone:true, pinyin:'', meaning:'' };
  }
  function hasStrokes(ch){ return !!DATA.strokes[ch]; }
  function strokesOf(ch){ return DATA.strokes[ch]; }
  function meaningOf(ch){ var c=DATA.chars[ch]; if(c) return c.meaning; var p=DATA.comps[ch]; return p?p.meaning:''; }
  function pinyinOf(ch){ var c=DATA.chars[ch]; if(c) return c.pinyin; var p=DATA.comps[ch]; return p?p.pinyin:''; }

  // every vocabulary char taught later than this unit (for preview-atom tagging)
  function vocabAfter(unitIdx){
    var set={};
    for (var i=unitIdx+1;i<DATA.units.length;i++){
      DATA.units[i].writeChars.forEach(function(c){ set[c]=true; });
    }
    return set;
  }
  function isVocabSomewhere(ch){
    for (var i=0;i<DATA.units.length;i++){
      if (DATA.units[i].writeChars.indexOf(ch)>=0) return true;
      if (DATA.units[i].recogniseChars.indexOf(ch)>=0) return true;
    }
    return false;
  }

  // ───────── book ─────────
  function units(){ return DATA.units; }
  function unitAt(i){ return DATA.units[i]; }
  function unitById(id){ for(var i=0;i<DATA.units.length;i++) if(DATA.units[i].id===id) return DATA.units[i]; return null; }

  // ───────── 3-band resolution ─────────
  // owned = set of components the student already owns (from state).
  function resolveStage(unitId, owned){
    owned = owned || {};
    var idx=-1; for(var i=0;i<DATA.units.length;i++) if(DATA.units[i].id===unitId){ idx=i; break; }
    var unit = DATA.units[idx]; if(!unit) return null;
    var later = vocabAfter(idx);

    // wholes = the unit's write characters (the syllabus targets)
    var wholes = unit.writeChars.filter(function(ch){ return DATA.chars[ch] && hasStrokes(ch); });

    // parts = the union of components referenced by the wholes, that are not
    // themselves a whole in this stage. Each component is forged at stroke grain.
    var partSet = {}; var partOrder = [];
    wholes.forEach(function(w){
      var c = DATA.chars[w]; if(!c) return;
      (c.components||[]).forEach(function(comp){
        var p = comp.char;
        if (wholes.indexOf(p)>=0) return;            // it's a target this stage → not a "part"
        if (!partSet[p]){ partSet[p]=true; partOrder.push({ char:p, role:comp.role }); }
      });
    });

    var parts = partOrder.map(function(p){
      var ch=p.char, status, kind, gloss;
      if (owned[ch]) status='review';
      else status='new';
      if (later[ch]) kind='preview-atom';            // a real char taught later
      else if (!isVocabSomewhere(ch)) kind='building-block';   // bound radical / phonetic
      else kind='atom';
      gloss = compInfo(ch).meaning || meaningOf(ch);
      return { char:ch, status:status, kind:kind, gloss:gloss,
               pinyin:pinyinOf(ch), grain:'stroke', forgeable:hasStrokes(ch) };
    });

    // use band = a 词语 (word) + a 句子 (sentence) pulled from the lesson content
    var use = useBand(unit, idx);

    return { id:unit.id, idx:idx, unit:unit, theme:unit.theme,
             bands:{ parts:parts, wholes:wholes.map(wholeCp), use:use } };

    function wholeCp(ch){
      var c=DATA.chars[ch];
      return { char:ch, grain:c.grain, pinyin:c.pinyin, meaning:c.meaning,
               components:c.components||[], etym:c.etymologyType };
    }
  }

  function useBand(unit, idx){
    var out=[];
    if (DATA.content && DATA.content.units && DATA.content.units[idx]){
      var cu = DATA.content.units[idx];
      var wc = (cu.core && cu.core.writeChars) || [];
      // gather a 组词 word and a 句子 sentence from the content facts
      var word=null, sent=null;
      wc.forEach(function(w){
        (w.facts||[]).forEach(function(f){
          if (!word && f.term==='组词' && f.zh){ word={ zh:(f.zh.split('·')[0]||f.zh).trim(), en:(f.en||'').split('·')[0].trim() }; }
          if (!sent && f.term==='句子' && f.zh){ sent={ zh:f.zh.trim(), en:(f.en||'').trim() }; }
        });
      });
      if (word) out.push({ type:'word', text:word.zh, en:word.en });
      if (sent) out.push({ type:'sentence', text:sent.zh, en:sent.en });
    }
    if (!out.length){
      // fallback: a doubled-character word from the first whole + the theme
      var w0=unit.writeChars[0];
      out.push({ type:'word', text:w0+w0, en:(meaningOf(w0)||'')+' (word)' });
    }
    return out;
  }

  // ───────── round building (graph → resolved forge round) ─────────
  // checkpoint = { char, band:'parts'|'wholes'|'use', ... }  difficulty knobs from settings
  var PAL = {
    stroke:{ accent:'#C2603A', soft:'#F0C9B4', tint:'#FBEAE0', cat:'象形', catEn:'Stroke order' },
    component:{ accent:'#2F7DA6', soft:'#BBD7E6', tint:'#E3EFF4', cat:'会意', catEn:'Compound idea' },
    radical:{ accent:'#7E4B86', soft:'#D8C4DB', tint:'#F1E8F2', cat:'形声', catEn:'Sound + meaning' },
    use:{ accent:'#3E8E72', soft:'#BCDDD1', tint:'#E4F1EC', cat:'应用', catEn:'Use it' }
  };

  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }

  function buildRound(cp, settings){
    settings = settings || {};
    if (cp.band==='use') return buildUseRound(cp, settings);
    var c = DATA.chars[cp.char];
    var grain = cp.band==='parts' ? 'stroke' : (c ? c.grain : 'stroke');
    if (grain==='stroke' || !c) return buildStrokeRound(cp, settings);
    return buildPartsRound(cp, c, grain, settings);
  }

  function buildStrokeRound(cp, settings){
    var ch=cp.char, info=DATA.chars[ch]||compInfo(ch), p=PAL.stroke;
    return {
      grain:'stroke', char:ch, band:cp.band,
      pinyin:(info&&info.pinyin)||pinyinOf(ch), meaning:(info&&info.meaning)||meaningOf(ch),
      accent:p.accent, soft:p.soft, tint:p.tint, cat:p.cat, catEn:p.catEn,
      strokeData:strokesOf(ch),
      ghost:(settings.difficulty==='easy'),          // §8: ghost only at easy
      cue:{ meaning:false, pinyin:false }            // stroke cue = ghost + audio only
    };
  }

  function buildPartsRound(cp, c, grain, settings){
    var p = PAL[grain];
    var slots=[], pool=[], correctChars={};
    var decoN = settings.difficulty==='easy'?1 : settings.difficulty==='hard'?4 : settings.difficulty==='expert'?5 : 2;

    if (grain==='component'){
      (c.components||[]).forEach(function(comp,i){
        slots.push({ type:'meaning', label:'义 meaning', want:comp.char });
        pool.push({ ch:comp.char, role:'meaning', correct:true, slot:i, gloss:meaningOf(comp.char) });
        correctChars[comp.char]=true;
      });
      meaningDecoys(c, correctChars, decoN).forEach(function(d){ pool.push(d); });
    } else { // radical (形声): one phonetic slot + semantic slot(s)
      (c.components||[]).forEach(function(comp,i){
        if (comp.role==='phonetic'){
          slots.push({ type:'sound', label:'声 sound', want:comp.char });
          pool.push({ ch:comp.char, role:'sound', correct:true, slot:i, py:comp.pinyin||pinyinOf(comp.char) });
        } else {
          slots.push({ type:'meaning', label:'形 meaning', want:comp.char });
          pool.push({ ch:comp.char, role:'meaning', correct:true, slot:i, gloss:meaningOf(comp.char) });
        }
        correctChars[comp.char]=true;
      });
      meaningDecoys(c, correctChars, Math.max(1,decoN-1)).forEach(function(d){ pool.push(d); });
      soundDecoys(c, correctChars, Math.max(1,decoN-1), settings).forEach(function(d){ pool.push(d); });
    }
    shuffle(pool);
    return {
      grain:grain, char:cp.char, band:cp.band,
      pinyin:c.pinyin, meaning:c.meaning,
      accent:p.accent, soft:p.soft, tint:p.tint, cat:p.cat, catEn:p.catEn,
      slots:slots, pool:pool,
      cue:{ meaning:true, pinyin:(grain==='radical') }   // §4.2 cue policy
    };
  }

  // meaning-slot decoys: visually-similar + semantically-adjacent from graph hints
  function meaningDecoys(c, exclude, n){
    var pool=[]; var seen={};
    var hints=c.hints||{};
    var cands=[].concat(hints.visuallySimilar||[], hints.semanticallyAdjacent||[]);
    // siblings sharing a component
    (c.components||[]).forEach(function(comp){
      var sibs = byComponent(comp.char);
      cands = cands.concat(sibs);
    });
    shuffle(cands);
    for (var i=0;i<cands.length && pool.length<n;i++){
      var d=cands[i];
      if (exclude[d]||seen[d]||!d) continue;
      seen[d]=true;
      pool.push({ ch:d, role:'meaning', correct:false, gloss:meaningOf(d) });
    }
    // top up from common components if still short
    var common=['日','月','女','子','口','木','人','马','心','水','火','土','目','田'];
    for (var k=0;k<common.length && pool.length<n;k++){
      var cc=common[k]; if(exclude[cc]||seen[cc]) continue; seen[cc]=true;
      pool.push({ ch:cc, role:'meaning', correct:false, gloss:meaningOf(cc) });
    }
    return pool;
  }

  // sound-slot decoys: phonetics with a different syllable (or tone-variant at hard)
  function soundDecoys(c, exclude, n, settings){
    var pool=[]; var seen={};
    var target = (c.components||[]).filter(function(x){return x.role==='phonetic';})[0];
    var tpy = target ? syllable(target.pinyin||pinyinOf(target.char)) : '';
    var cands = phoneticPool();
    shuffle(cands);
    var allowTone = (settings.difficulty==='hard'||settings.difficulty==='expert');
    for (var i=0;i<cands.length && pool.length<n;i++){
      var d=cands[i]; if(exclude[d.ch]||seen[d.ch]) continue;
      var same = syllable(d.py)===tpy;
      if (same && !allowTone) continue;               // easy/normal: different syllable only
      seen[d.ch]=true;
      pool.push({ ch:d.ch, role:'sound', correct:false, py:d.py });
    }
    return pool;
  }

  var _byComp=null;
  function byComponent(comp){
    if(!_byComp){ _byComp={}; for(var k in DATA.chars){ var c=DATA.chars[k]; (c.components||[]).forEach(function(x){ (_byComp[x.char]=_byComp[x.char]||[]).push(k); }); } }
    return _byComp[comp]||[];
  }
  var _phon=null;
  function phoneticPool(){
    if(_phon) return _phon;
    var seen={}; _phon=[];
    for (var k in DATA.chars){
      (DATA.chars[k].components||[]).forEach(function(x){
        if (x.role==='phonetic' && x.char && !seen[x.char] && (x.pinyin||pinyinOf(x.char))){
          seen[x.char]=true; _phon.push({ ch:x.char, py:x.pinyin||pinyinOf(x.char) });
        }
      });
    }
    return _phon;
  }
  function syllable(py){ return String(py||'').toLowerCase().replace(/[āáǎàa]/g,'a').replace(/[ēéěè]/g,'e').replace(/[īíǐì]/g,'i').replace(/[ōóǒò]/g,'o').replace(/[ūúǔù]/g,'u').replace(/[ǖǘǚǜü]/g,'v').replace(/[^a-z]/g,''); }

  // ── USE round: assemble the word's characters in order ──
  function buildUseRound(cp, settings){
    var p=PAL.use, text=cp.text||'', chars=text.split('');
    var decoy = pickUseDecoy(chars);
    var tiles = chars.map(function(ch,i){ return { ch:ch, idx:i, correct:true }; });
    if (decoy) tiles.push({ ch:decoy, correct:false });
    shuffle(tiles);
    return {
      grain:'use', char:text, band:'use', word:text, sequence:chars,
      pinyin:'', meaning:cp.en||'',
      accent:p.accent, soft:p.soft, tint:p.tint, cat:p.cat, catEn:p.catEn,
      tiles:tiles,
      cue:{ meaning:true, pinyin:false }
    };
  }
  function pickUseDecoy(chars){
    var common=['的','是','我','你','不','人','口','大','小','子','女','日','月'];
    shuffle(common);
    for (var i=0;i<common.length;i++) if(chars.indexOf(common[i])<0) return common[i];
    return null;
  }

  G.Content = {
    load:load, ready:function(){ return ready; },
    units:units, unitAt:unitAt, unitById:unitById,
    charInfo:charInfo, compInfo:compInfo, hasStrokes:hasStrokes, strokesOf:strokesOf,
    meaningOf:meaningOf, pinyinOf:pinyinOf, isVocabSomewhere:isVocabSomewhere,
    resolveStage:resolveStage, buildRound:buildRound, PAL:PAL,
    raw:function(){ return DATA; }
  };
})(window.GAME = window.GAME || {});
