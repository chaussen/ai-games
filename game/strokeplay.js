/* game/strokeplay.js — animated stroke-order playback (makemeahanzi style)
   Draws a character one stroke at a time, in rainbow stroke-order colours, by
   sweeping a thick rounded line along each stroke's *median* (centre-line) while
   clipping it to that stroke's real outline — so the growing line always has the
   exact shape of the stroke. When a stroke finishes it is "locked in" with the
   crisp outline fill. Used by the forge for the study clue (preview) and the
   replay on the reveal card. Same data + palette as assets/stroke-cell.js. */
(function (G) {
  "use strict";
  var UID = 0;

  function pal(n){
    if (window.StrokeCell && window.StrokeCell.strokePalette) return window.StrokeCell.strokePalette(n);
    var o=[]; for(var i=0;i<n;i++){ var t=n<=1?0:i/(n-1); o.push('hsl('+(8+t*282).toFixed(1)+' 70% 45%)'); } return o;
  }
  function tianzi(){
    return '<rect x="6" y="6" width="1012" height="1012" rx="14" fill="none" stroke="#EFDDD5" stroke-width="6"/>'+
      '<line x1="512" y1="6" x2="512" y2="1018" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>'+
      '<line x1="6" y1="512" x2="1018" y2="512" stroke="#F0C9B4" stroke-width="3" stroke-dasharray="14 18"/>';
  }
  // medians are in 1024 y-up space; flip to the normal y-down SVG space so the
  // line and the (transformed) clip outline land in the same user coordinates.
  function medianD(m){
    if(!m||!m.length) return '';
    var d='M '+m[0][0]+' '+(900-m[0][1]);
    for(var i=1;i<m.length;i++) d+=' L '+m[i][0]+' '+(900-m[i][1]);
    return d;
  }
  function numbersSVG(sd, cols){
    if(!(window.StrokeCell && sd.m && sd.m.length===sd.s.length)) return '';
    var pos=window.StrokeCell.layoutNumbers(sd.m);
    return pos.map(function(p,i){
      return '<text class="sp-num" data-i="'+i+'" x="'+p[0].toFixed(0)+'" y="'+p[1].toFixed(0)+'" '+
        'text-anchor="middle" dominant-baseline="central" font-size="78" font-weight="800" fill="'+cols[i]+'" '+
        'stroke="#fffdf8" stroke-width="15" paint-order="stroke" stroke-linejoin="round">'+(i+1)+'</text>';
    }).join('');
  }

  function shell(sd, opts){
    var n=sd.s.length, cols=pal(n), uid=opts.uid;
    var defs='<defs>'+sd.s.map(function(p,i){
      return '<clipPath id="'+uid+'-cp'+i+'" clipPathUnits="userSpaceOnUse">'+
        '<path d="'+p+'" transform="translate(0,900) scale(1,-1)"/></clipPath>'; }).join('')+'</defs>';
    var grid = opts.grid===false ? '' : tianzi();
    var ghost = opts.ghost
      ? '<g transform="translate(0,900) scale(1,-1)">'+sd.s.map(function(p){return '<path d="'+p+'" fill="#EBDDD4"/>';}).join('')+'</g>'
      : '';
    var fills='<g class="sp-fills" transform="translate(0,900) scale(1,-1)"></g>';
    var meds=sd.s.map(function(p,i){
      return '<path class="sp-med" data-i="'+i+'" d="'+medianD(sd.m&&sd.m[i])+'" fill="none" stroke="'+cols[i]+'" '+
        'stroke-width="'+(opts.width||215)+'" stroke-linecap="round" stroke-linejoin="round" '+
        'clip-path="url(#'+uid+'-cp'+i+')" visibility="hidden"/>'; }).join('');
    var nums = opts.numbers!==false ? '<g class="sp-nums">'+numbersSVG(sd,cols)+'</g>' : '';
    return '<svg class="sp-svg" viewBox="0 0 1024 1024" role="img" aria-label="stroke-order animation">'+
      defs+grid+ghost+fills+'<g class="sp-meds">'+meds+'</g>'+nums+'</svg>';
  }

  // mount + play. opts: { perStroke, gap, ghost, numbers, grid, width, loop, onDone }
  function mount(container, sd, opts){
    opts=opts||{}; opts.uid='sp'+(UID++);
    if(!sd||!sd.s||!sd.s.length){ return { cancel:function(){}, replay:function(){}, duration:0 }; }
    var n=sd.s.length, cols=pal(n);
    container.innerHTML=shell(sd, opts);
    var svg=container.querySelector('svg');
    var meds=Array.prototype.slice.call(svg.querySelectorAll('.sp-med'));
    var nums=Array.prototype.slice.call(svg.querySelectorAll('.sp-num'));
    var fills=svg.querySelector('.sp-fills');
    var per=opts.perStroke||650, gap=(opts.gap!=null?opts.gap:140);
    var timers=[], cancelled=false;

    function reset(){
      cancelled=false; timers.forEach(clearTimeout); timers=[];
      meds.forEach(function(m){ m.setAttribute('visibility','hidden'); m.style.transition='none'; m.style.strokeDasharray=''; m.style.strokeDashoffset=''; });
      nums.forEach(function(t){ t.style.opacity='0'; });
      fills.innerHTML='';
    }
    function drawStroke(i, cb){
      if(cancelled) return;
      var m=meds[i]; if(!m){ if(cb) cb(); return; }
      var len=0; try{ len=m.getTotalLength(); }catch(e){ len=0; }
      m.setAttribute('visibility','visible');
      if(nums[i]) nums[i].style.opacity='1';
      if(len>2){
        m.style.strokeDasharray=len; m.style.strokeDashoffset=len;
        void m.getBoundingClientRect();                 // commit the start state
        m.style.transition='stroke-dashoffset '+per+'ms linear';
        m.style.strokeDashoffset='0';
      }
      var t=setTimeout(function(){
        if(cancelled) return;
        fills.insertAdjacentHTML('beforeend','<path d="'+sd.s[i]+'" fill="'+cols[i]+'"/>');  // lock crisp outline
        if(cb) cb();
      }, per+20);
      timers.push(t);
    }
    function runFrom(i){
      if(cancelled) return;
      if(i>=n){
        if(opts.loop){ var tl=setTimeout(function(){ reset(); runFrom(0); }, 1300); timers.push(tl); }
        else if(opts.onDone) opts.onDone();
        return;
      }
      drawStroke(i, function(){ var t=setTimeout(function(){ runFrom(i+1); }, gap); timers.push(t); });
    }
    function cancel(){ cancelled=true; timers.forEach(clearTimeout); timers=[]; }
    function replay(){ reset(); runFrom(0); }

    reset(); runFrom(0);
    return { cancel:cancel, replay:replay, duration:n*per+(n>1?(n-1)*gap:0) };
  }

  // a small "重播 Replay" button (caller wires its click to controller.replay)
  function replayBtnHTML(id){
    return '<button class="sp-replay" id="'+id+'" type="button" aria-label="Replay stroke order">'+
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>'+
      '<span class="zh">重播</span> Replay</button>';
  }

  G.StrokePlay = { mount:mount, replayBtnHTML:replayBtnHTML };
})(window.GAME = window.GAME || {});
