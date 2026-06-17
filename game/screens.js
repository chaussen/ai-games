/* game/screens.js — the four new full-screen surfaces
   文 Store (§8.1) · Parts Deck (§5.6) · Review Hub (§5.6) · Teacher Console (§8.2).
   Each slides up over the scroll; closing re-renders the header so the wallet,
   deck ring and 复习 badge stay in sync. */
(function (G) {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  var S, C;

  function host(){
    var h=$('#panel');
    if(!h){ h=document.createElement('div'); h.id='panel'; h.className='screen';
      h.innerHTML='<div class="screen-head"><button class="sh-back" id="pn-back">‹</button>'+
        '<div class="sh-titles"><h2 id="pn-title"></h2><p id="pn-sub"></p></div>'+
        '<div class="sh-wallet" id="pn-wallet"></div></div>'+
        '<div class="screen-body"><div class="wrap" id="pn-body"></div></div>';
      document.body.appendChild(h);
      $('#pn-back',h).addEventListener('click', close);
    }
    return h;
  }
  function walletChip(){ var st=S.get();
    return '<button class="chip wenchip" id="pn-walletchip">'+G.Scroll.wenCoin()+'<span class="chip-txt"><b>'+st.wen+'</b><small><span class="zh">文</span> wallet</small></span></button>'; }

  var current=null;
  function open(type){
    S=G.State; C=G.Content; current=type; var h=host();
    if(type==='store') renderStore();
    else if(type==='deck') renderDeck();
    else if(type==='review') renderReview();
    else if(type==='teacher') renderTeacher();
    h.classList.add('open');
  }
  function close(){ var h=$('#panel'); if(h) h.classList.remove('open'); current=null; G.Scroll.render(); }
  function refresh(){ if(current) open(current); }

  function setHead(title, sub, wallet){ $('#pn-title').innerHTML=title; $('#pn-sub').textContent=sub||'';
    $('#pn-wallet').innerHTML=wallet!==false?walletChip():''; }

  // ───────── 文 STORE ─────────
  function renderStore(){
    var st=S.get(), rk=S.rankFor(st.xp);
    setHead('<span class="zh">文</span> Store', 'Spend 文 on awards · rank-only prestige can’t be bought');
    var tiers=[ {key:'everyday',name:'Everyday',cn:'平价',note:'~30 文 · reachable in week 1'},
      {key:'treasure',name:'Treasure',cn:'珍品',note:'~150 文 · about two weeks’ diligence'},
      {key:'prestige',name:'Prestige',cn:'荣誉',note:'earned by rank — never bought'} ];
    var html='';
    var pending=st.claims.filter(function(c){return c.status==='pending';});
    if (st.claims.length){
      html+='<div class="claims-strip"><div class="tier-head"><h3>Your claim tickets</h3><span class="tier-note">show these to your teacher</span></div>'+
        st.claims.slice(0,6).map(function(c){ return '<div class="claim" data-status="'+c.status+'"><span class="cl-icon">🎟️</span>'+
          '<div class="cl-main">'+esc(c.name)+' <span class="zh">'+esc(c.zh||'')+'</span><span>−'+c.wen+' 文 · '+new Date(c.ts).toLocaleDateString()+'</span></div>'+
          '<span class="cl-status">'+c.status+'</span></div>'; }).join('')+'</div>';
    }
    tiers.forEach(function(t){
      var items=S.storeItems().filter(function(i){return i.tier===t.key;});
      html+='<div class="store-tier"><div class="tier-head"><h3>'+t.name+' <span class="tier-cn zh">'+t.cn+'</span></h3><span class="tier-note">'+t.note+'</span></div><div class="store-grid">'+
        items.map(function(i){
          var affordable=S.canAfford(i), btn;
          if (i.tier==='prestige'){ var ok=rk.lv>=(i.rankMin||8);
            btn='<button class="si-buy prestige" disabled>'+(ok?'Unlocked':'rank '+(i.rankMin||8)+'+' )+'</button>'; }
          else btn='<button class="si-buy" data-buy="'+i.id+'"'+(affordable?'':' disabled')+'>'+(affordable?'Redeem':'Need more')+'</button>';
          var price = i.tier==='prestige' ? '<span class="si-locked-note">rank reward</span>'
            : '<span class="si-price">'+G.Scroll.wenCoin()+i.price+'</span>';
          return '<div class="store-item" data-tier="'+i.tier+'"><div class="si-art">'+i.art+'</div>'+
            '<div class="si-name">'+esc(i.name)+' <span class="zh">'+esc(i.zh)+'</span></div>'+
            '<div class="si-foot">'+price+btn+'</div></div>';
        }).join('')+'</div></div>';
    });
    $('#pn-body').innerHTML=html;
    $$('#pn-body [data-buy]').forEach(function(b){ b.addEventListener('click', function(){
      var item=S.storeItems().filter(function(i){return i.id===b.dataset.buy;})[0];
      var res=S.redeem(item);
      if(res.ok){ G.App.toast('Redeemed '+item.name+' · −'+item.price+' 文 · ticket created'); renderStore(); }
      else G.App.toast('Not enough 文 yet — keep forging!');
    }); });
  }

  // ───────── PARTS DECK ─────────
  function bookComponents(){
    var seen={}, list=[];
    C.units().forEach(function(u){ u.writeChars.forEach(function(w){ var c=C.charInfo(w); if(!c) return;
      (c.components||[]).forEach(function(comp){ if(!seen[comp.char]){ seen[comp.char]=true; list.push(comp.char); } }); }); });
    return list;
  }
  function buildsWith(comp){ var out=[]; var raw=C.raw().chars;
    for(var k in raw){ if((raw[k].components||[]).some(function(x){return x.char===comp;})){ out.push(k); if(out.length>=8) break; } } return out; }
  function renderDeck(){
    var st=S.get(); setHead('<span class="zh">部件</span> Parts Deck', 'Owned components — they gate the wholes and seed the decoys');
    var all=bookComponents(); var owned=all.filter(function(c){return st.owned[c];});
    var html='<div class="deck-meta">'+
      '<div class="deck-stat"><b>'+owned.length+'</b><span>parts owned</span></div>'+
      '<div class="deck-stat"><b>'+all.length+'</b><span>parts in this book</span></div>'+
      '<div class="deck-stat"><b>'+Math.round(owned.length/Math.max(1,all.length)*100)+'%</b><span>collected</span></div></div>';
    html+='<div class="deck-grid">'+all.map(function(c){
      var info=C.compInfo(c), isOwned=!!st.owned[c], bound=info.standalone===false;
      var builds=buildsWith(c);
      return '<div class="partcard '+(isOwned?'owned':'unowned')+'" data-part="'+esc(c)+'" title="'+esc(builds.join(' '))+'">'+
        (bound?'<span class="pc-bound">部</span>':'')+
        '<span class="pc-ch zh">'+esc(c)+'</span>'+
        '<span class="pc-py">'+esc(info.pinyin||'')+'</span>'+
        '<span class="pc-mn">'+esc(info.meaning||'')+'</span>'+
        '<span class="pc-builds">'+(isOwned?'builds '+builds.length:'not yet')+'</span></div>';
    }).join('')+'</div>';
    $('#pn-body').innerHTML=html;
    $$('#pn-body .partcard').forEach(function(b){ b.addEventListener('click', function(){
      var c=b.dataset.part, builds=buildsWith(c);
      G.App.toast('<span class="zh">'+c+'</span> '+(C.compInfo(c).meaning||'')+(builds.length?' → builds '+builds.slice(0,6).join(' '):''));
    }); });
  }

  // ───────── REVIEW HUB ─────────
  function renderReview(){
    setHead('<span class="zh">复习</span> Review Hub', 'Faded ink, grouped by how overdue — refresh to re-ink and earn 文', false);
    var due=S.dueChars(), st=S.get(), nowt=Date.now();
    if(!due.length){ $('#pn-body').innerHTML='<div class="review-empty"><div class="big">🪶</div><h3>Nothing faded right now</h3><p class="muted">Your scroll is vivid. Come back when characters are due.</p></div>'; return; }
    function overdueDays(c){ var s=st.sched[c]; return s?Math.floor((nowt-s.dueTs)/864e5):0; }
    var urgent=due.filter(function(c){return overdueDays(c)>=3;}), soon=due.filter(function(c){return overdueDays(c)<3;});
    var html='';
    function group(list,cls,title,sub){ if(!list.length) return '';
      return '<div class="review-group '+cls+'"><h3>'+title+'</h3><p class="rg-sub">'+sub+'</p><div class="review-chars">'+
        list.map(function(c){ var m=S.masteryOf(c); var fade=m<=1?'faded':'faded2';
          return '<div class="rchar '+fade+'"><span class="rc-ch zh">'+esc(c)+'</span><span class="cp-tag">'+esc(C.pinyinOf(c)||'')+'</span></div>'; }).join('')+'</div></div>'; }
    html+=group(urgent,'urgent','Long overdue','The ink is nearly gone — review these first.');
    html+=group(soon,'','Due now','A quick refresh keeps them strong.');
    var cfg=st.config;
    html+='<div class="cta-row"><button class="jbtn solid" id="rv-refresh" style="flex:0 0 auto;padding:14px 26px"><span class="zh">复习</span> Refresh all '+due.length+' · +'+cfg.dueWen+' 文 each ›</button></div>';
    $('#pn-body').innerHTML=html;
    $('#rv-refresh').addEventListener('click', function(){ G.App.reviewRun(due); });
  }

  // ───────── TEACHER CONSOLE ─────────
  var tcTab='config';
  function renderTeacher(){
    setHead('<span class="zh">师</span> Teacher Console', 'Tune the economy · grant 文 · see the roster', false);
    var html='<div class="tc-tabs">'+
      ['config:Scoring','catalogue:Catalogue','grant:Grant','roster:Roster'].map(function(t){ var p=t.split(':');
        return '<button class="tc-tab '+(tcTab===p[0]?'on':'')+'" data-tab="'+p[0]+'">'+p[1]+'</button>'; }).join('')+'</div>'+
      '<div id="tc-panes"></div>';
    $('#pn-body').innerHTML=html;
    $$('#pn-body .tc-tab').forEach(function(b){ b.addEventListener('click', function(){ tcTab=b.dataset.tab; renderTeacher(); }); });
    ({config:tcConfig, catalogue:tcCatalogue, grant:tcGrant, roster:tcRoster})[tcTab]();
  }
  function tcConfig(){
    var st=S.get(), cfg=st.config;
    var dials=[ ['completionWen','Stage completion 文','flat per first clear',0,30],
      ['sealWen','Chapter seal 文','milestone bonus',0,80],
      ['dueWen','Due review 文','only the schedule decides due-ness',0,20],
      ['floorWen','Weekly attendance floor','guaranteed for showing up',0,40],
      ['weeklyCap','Weekly 文 cap (practice)','grinding past this earns XP only',40,150],
      ['xpPerChar','XP per character','status track',5,20],
      ['sealXp','Chapter seal XP','usually tips a rank-up',50,200] ];
    var html='<div class="tc-card"><h3>Scoring presets</h3><p class="tc-hint">Pick a baseline, then fine-tune the dials.</p>'+
      '<div class="preset-row">'+['standard','generous','strict'].map(function(p){ return '<button class="preset-btn '+(st.settings.preset===p?'on':'')+'" data-preset="'+p+'">'+p+'</button>'; }).join('')+
      (st.settings.preset==='custom'?'<button class="preset-btn on" disabled>custom</button>':'')+'</div>'+
      dials.map(function(d){ return '<div class="dial"><div class="dl-label">'+d[1]+'<small>'+d[2]+'</small></div>'+
        '<input type="range" min="'+d[3]+'" max="'+d[4]+'" value="'+cfg[d[0]]+'" data-cfg="'+d[0]+'"><span class="dl-val" id="val-'+d[0]+'">'+cfg[d[0]]+'</span></div>'; }).join('')+
      '</div>';
    var pane=document.createElement('div'); pane.className='tc-section on'; pane.innerHTML=html;
    $('#tc-panes').innerHTML=''; $('#tc-panes').appendChild(pane);
    $$('#tc-panes [data-preset]').forEach(function(b){ b.addEventListener('click', function(){ S.applyPreset(b.dataset.preset); renderTeacher(); }); });
    $$('#tc-panes [data-cfg]').forEach(function(inp){ inp.addEventListener('input', function(){ var v=+inp.value;
      $('#val-'+inp.dataset.cfg).textContent=v; S.setConfig(inp.dataset.cfg, v); }); });
  }
  function tcCatalogue(){
    var html='<div class="tc-card"><h3>Award catalogue</h3><p class="tc-hint">The store is a teacher-editable list. (v1 ships the seed catalogue; editing prices is wired through the scoring config.)</p>'+
      '<table class="roster"><thead><tr><th>Item</th><th>Tier</th><th>Price (文)</th></tr></thead><tbody>'+
      S.storeItems().map(function(i){ return '<tr><td>'+i.art+' '+esc(i.name)+' <span class="zh">'+esc(i.zh)+'</span></td><td>'+i.tier+'</td><td>'+(i.tier==='prestige'?'rank '+(i.rankMin||8)+'+':i.price)+'</td></tr>'; }).join('')+
      '</tbody></table></div>';
    var pane=document.createElement('div'); pane.className='tc-section on'; pane.innerHTML=html; $('#tc-panes').innerHTML=''; $('#tc-panes').appendChild(pane);
  }
  function tcGrant(){
    var roster=S.roster();
    var html='<div class="tc-card"><h3>Grant 文 / bonus quest</h3><p class="tc-hint">Covers home &amp; offline work the app can’t see (拓展, helping a peer).</p>'+
      '<div class="grant-row">'+
        '<div class="fld"><label>Student</label><select id="g-student">'+roster.map(function(r){return '<option value="'+r.id+'">'+esc(r.name)+'</option>';}).join('')+'</select></div>'+
        '<div class="fld"><label>Amount (文)</label><input id="g-amt" type="number" value="10" min="1" max="50" style="width:90px"></div>'+
        '<button class="jbtn solid" id="g-go" style="flex:0 0 auto;padding:11px 20px">Grant ›</button>'+
      '</div></div>';
    var pane=document.createElement('div'); pane.className='tc-section on'; pane.innerHTML=html; $('#tc-panes').innerHTML=''; $('#tc-panes').appendChild(pane);
    $('#g-go').addEventListener('click', function(){ var sid=$('#g-student').value, amt=Math.max(1,+$('#g-amt').value||0);
      S.grant(sid, amt); G.App.toast('Granted +'+amt+' 文 to '+$('#g-student').selectedOptions[0].text); });
  }
  function tcRoster(){
    var roster=S.roster();
    var html='<div class="tc-card"><h3>Class roster</h3><p class="tc-hint">Per-student rank, XP, 文 balance, streak, due reviews, pending claims.</p>'+
      '<table class="roster"><thead><tr><th>Student</th><th>Rank</th><th>XP</th><th>文</th><th>Streak</th><th>Due</th><th>Claims</th></tr></thead><tbody>'+
      roster.map(function(r){ return '<tr class="'+(r.you?'you':'')+'"><td>'+esc(r.name)+'</td><td class="r-rank zh">'+r.rank.cn+'</td><td>'+r.xp+'</td><td class="r-wen">'+r.wen+'</td><td>'+r.streak+'d</td><td>'+r.due+'</td><td>'+r.claims+'</td></tr>'; }).join('')+
      '</tbody></table></div>';
    var pane=document.createElement('div'); pane.className='tc-section on'; pane.innerHTML=html; $('#tc-panes').innerHTML=''; $('#tc-panes').appendChild(pane);
  }

  G.Screens={ open:open, close:close, refresh:refresh };
})(window.GAME = window.GAME || {});
