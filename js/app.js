// ---- Template, measured from the DesignMonks Figma source ----
const F = {
  wide:  { w:1252, h:438,  text:{ mode:'left', left:96, maxW:340, maxH:300, size:62 },
           shade:{ axis:'x', from:-61, to:441 }, strips:{ axis:'x', start:-41.96, step:47.738, size:48.776, count:14 } },
  thumb: { w:610,  h:350,  text:{ mode:'left', left:40, maxW:215, maxH:230, size:40 },
           shade:{ axis:'x', from:-118, to:290 }, strips:{ axis:'x', start:-25.1, step:38.783, size:39.627, count:12 } },
  tall:  { w:1080, h:1920, text:{ mode:'center', top:205, maxW:940, maxH:480, size:93 },
           shade:{ axis:'y', from:1923, to:1271 }, strips:{ axis:'y', start:1847.6, step:-57.63, size:56.4, count:14 },
           cta:{ x:372, y:1719, w:335.7, h:78.6 } },
};
const KINDS = ['wide','thumb','tall'];
const LH = 1.04;
const RH = '"Red Hat Display"', PF = '"Playfair Display"';
const ramp = n => Array.from({length:n},(_,i)=>[1,.8,.6,.4,.2,.1][Math.max(0,i-(n-6))]);

const S = {
  hero:null, heroURL:'', heroName:'', isSample:true,
  base:'#0A8F4C', shade:'#04492A', colorsAuto:true, candidates:[],
  adj:{ wide:{dx:0,dy:0,s:1,t:1}, thumb:{dx:0,dy:0,s:1,t:1}, tall:{dx:0,dy:0,s:1,t:1} },
};
const $ = id => document.getElementById(id);

// ---- Title parsing: words tagged italic or not; lines from Enter or auto-balance ----
function parseTitle(src){
  let ital=false; const lines=[];
  for(const raw of src.replace(/\r/g,'').split('\n')){
    const words=[]; let cur='', curI=ital;
    const flush=()=>{ if(cur){ words.push({t:cur,i:curI}); cur=''; } };
    for(const ch of raw){
      if(ch==='*'){ flush(); ital=!ital; curI=ital; continue; }
      if(ch===' '){ flush(); curI=ital; continue; }
      if(!cur) curI=ital;
      cur+=ch;
    }
    flush();
    if(words.length) lines.push(words);
  }
  return lines;
}
function fontFor(w,size){ return w.i ? `italic 700 ${size}px ${PF}` : `700 ${size}px ${RH}`; }
const mctx = document.createElement('canvas').getContext('2d');
function measureWords(words,size){
  // returns width of a line, with spaces measured in the font of the following word
  let x=0;
  words.forEach((w,j)=>{
    mctx.font=fontFor(w,size); setLS(mctx,w,size);
    if(j>0) x+=mctx.measureText(' ').width;
    x+=mctx.measureText(w.t).width;
  });
  return x;
}
function setLS(ctx,w,size){ if('letterSpacing' in ctx) ctx.letterSpacing = w.i ? '0px' : (-0.01*size)+'px'; }
function balance(words,maxW,size){
  // fewest lines (2-4) whose longest line is within 25% of the zone (the size then shrinks to fit),
  // never splitting the italic phrase, avoiding lines that end on a small word ("In", "of")
  const n=words.length, small=/^(in|for|the|a|an|and|&|to|with|on|vs\.?)$/i;
  const better=(x,y)=>!y || x.ib<y.ib || (x.ib===y.ib && x.cost<y.cost);
  let overall=null;
  for(let k=Math.min(2,n);k<=Math.min(4,n);k++){
    let best=null;
    const rec=(start,left,acc)=>{
      if(left===1){ const l=acc.concat([words.slice(start)]); const m=Math.max(...l.map(x=>measureWords(x,size)));
        let ib=0, pen=0;
        for(let q=1;q<l.length;q++){ const last=l[q-1][l[q-1].length-1], first=l[q][0];
          if(last.i && first.i) ib++;
          if(small.test(last.t)) pen++;
          if(l[q].length===1 && small.test(first.t)) pen+=2; }
        const c={l,m,ib,cost:m+pen*maxW*.35}; if(better(c,best)) best=c; return; }
      for(let e=start+1;e<=n-left+1;e++) rec(e,left-1,acc.concat([words.slice(start,e)]));
    };
    rec(0,k,[]);
    if(best && !best.ib && best.m<=maxW*1.25) return best.l;
    if(better(best,overall)) overall=best;
  }
  return overall?overall.l:[words];
}
// ---- Emphasis: which words get Playfair italic ----
// Pattern from the DesignMonks covers: one contiguous 2-3 word phrase, the topic or payoff of the title,
// never the list number or the lead-in ("7 Best", "Importance of").
const EMPH_EXAMPLES = [
  ['7 Best Healthcare App Design Agency','Healthcare App Design'],
  ['UX Yes/No Buttons Best Practices','Best Practices'],
  ["HIPAA's Healthcare Design Compliance",'Design Compliance'],
  ['Fixing Healthcare App Onboarding','Healthcare App'],
  ['Trusted Healthcare App Agencies','App Agencies'],
  ['Best HIPAA-Ready Design Agencies','Design Agencies'],
  ['5 Budget-Friendly Healthcare App Agencies','Healthcare App Agencies'],
];
const E = { claude:{}, src:'rule' };   // cache of Claude's picks per title
const clean = t => t.replace(/\*/g,'').replace(/\s+/g,' ').trim();
function rulePhrase(title){
  const words=clean(title).split(' ');
  const lead=/^(\d+|best|top|the|a|an|how|why|what|importance|of|ultimate|complete)$/i;
  const tail=/^(explained|guide|examples|tips|trends|agency|in|for|and|&|20\d\d)$/i;
  const stop=/^(of|in|for|the|a|an|and|&|to|with|on|vs\.?)$/i;
  let i=0,j=words.length; const bare=w=>w.replace(/[^\w&'-]/g,'');
  while(i<j-1 && lead.test(bare(words[i]))) i++;
  while(j-1>i && tail.test(bare(words[j-1]))) j--;
  let core=words.slice(i,j);
  if(core.length>3){ core=core.slice(-2); }
  while(core.length>1 && stop.test(bare(core[0]))) core.shift();
  return core.join(' ');
}
function phraseFor(title){ const t=clean(title); return E.claude[t] || rulePhrase(t); }
// find the phrase in the typed title, ignoring case, extra spaces and line breaks inside it
function phraseRegex(p){ const words=clean(p).split(' ').filter(Boolean).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')); return words.length? new RegExp(words.join('\\s+'),'i') : null; }
function applyEmphasis(src){
  if(src.includes('*')) return src;                       // designer typed asterisks
  if(E.mode==='manual'){ syncWords(); return markWords(src,(i)=>E.sel.has(i)); }
  const re=phraseRegex(phraseFor(src)); if(!re) return src;
  const m=src.match(re); if(!m) return src;
  return src.slice(0,m.index)+'*'+m[0]+'*'+src.slice(m.index+m[0].length);
}
// ---- Manual mode: the designer clicks title words to set them in italic ----
E.mode='auto'; E.sel=new Set(); E.words=[];
const normW = w => w.toLowerCase().replace(/[^\p{L}\p{N}&'-]/gu,'');
const titleWords = src => src.replace(/\*/g,'').split(/\s+/).filter(Boolean);
// wrap runs of chosen words in asterisks, keeping the designer's own line breaks
function markWords(src, pick){
  let i=0, out='', open=false;
  const parts=src.replace(/\*/g,'').split(/(\s+)/);
  parts.forEach((t,j)=>{
    if(!t) return;
    if(/^\s+$/.test(t)){ out+=t; return; }
    const on=pick(i,t);
    if(on && !open){ out+='*'; open=true; }
    if(!on && open){ out=out.replace(/(\s*)$/,'*$1'); open=false; }
    out+=t; i++;
  });
  if(open) out+='*';
  return out;
}
function syncWords(){
  const words=titleWords($('title').value);
  if(words.join(' ')!==E.words.join(' ')){
    const keep=new Set(); E.sel.forEach(i=>{ if(words[i]!==undefined && words[i]===E.words[i]) keep.add(i); });
    E.sel=keep; E.words=words;
  }
}
function autoIndices(){
  const words=titleWords($('title').value), p=titleWords(phraseFor($('title').value)).map(normW), sel=new Set();
  if(!p.length) return sel;
  for(let i=0;i+p.length<=words.length;i++){ if(p.every((w,k)=>normW(words[i+k])===w)){ for(let k=0;k<p.length;k++) sel.add(i+k); break; } }
  return sel;
}
function buildChips(){
  syncWords(); const box=$('chips'); box.textContent='';
  E.words.forEach((w,i)=>{ const b=document.createElement('button'); b.type='button'; b.textContent=w;
    b.setAttribute('aria-pressed',E.sel.has(i)?'true':'false');
    b.onclick=()=>{ E.sel.has(i)?E.sel.delete(i):E.sel.add(i); b.setAttribute('aria-pressed',E.sel.has(i)?'true':'false'); render(); };
    box.appendChild(b); });
}
function setMode(m){
  if(m===E.mode) return;
  if(m==='manual'){ syncWords(); E.sel = $('title').value.includes('*') ? new Set() : autoIndices(); }
  E.mode=m; $('modeAuto').setAttribute('aria-pressed',m==='auto'); $('modeManual').setAttribute('aria-pressed',m==='manual');
  updateEmphUI(); render();
}
$('modeAuto').onclick=()=>setMode('auto'); $('modeManual').onclick=()=>setMode('manual');
function updateEmphUI(){
  const man=E.mode==='manual';
  $('emphBox').hidden=man; $('chips').hidden=!man;
  $('emphHint').textContent = man ? 'Click the words to set in Playfair italic. Click again to remove. The thumbnail uses the same words.' : 'Auto picks the words for Playfair italic. Switch to Manual to choose them yourself. Press Enter in the title to force a line break.';
  if(man){ buildChips(); return; }
  const src=$('title').value, manual=src.includes('*');
  $('emphPhrase').textContent = manual ? (src.match(/\*([^*]+)\*/)||[,''])[1] : phraseFor(src);
  $('emphSrc').textContent = manual ? 'Chosen by you (asterisks)' : (E.claude[clean(src)] ? 'Chosen by Claude' : 'Chosen by the studio rule');
  $('emphAsk').hidden = manual || !SAMPLE;
}
let SAMPLE=null, asking=null;
async function askClaude(fresh){
  const title=clean($('title').value);
  if(E.mode==='manual' || !SAMPLE || !title || $('title').value.includes('*') || (E.claude[title] && !fresh)) return;
  if(asking) asking.abort(); asking=new AbortController();
  $('emphSrc').textContent='Claude is choosing…'; $('emphAsk').disabled=true;
  const prompt=`You choose which words of a blog cover title are set in Playfair Display Bold Italic for the DesignMonks design agency. The rest is set in a plain sans serif.
Rules: pick ONE contiguous phrase of 1 to 3 words, copied exactly from the title (same spelling, case and punctuation). It is the topic or payoff of the title: the words a reader should notice first. Never pick the list number or a lead-in like "7 Best", "Top 10", "Importance of", "How to". Prefer phrases that read naturally on their own line.
Past covers (title -> italic phrase):
${EMPH_EXAMPLES.map(([t,p])=>`- "${t}" -> "${p}"`).join('\n')}
Title: "${title}"
Answer with JSON only: {"phrase": "..."}`;
  try{
    const r=await SAMPLE.json(prompt,{modelTier:'quick',signal:asking.signal,cache:!fresh});
    const raw=(r&&typeof r.phrase==='string')?r.phrase:(typeof r==='string'?r:'');
    const p=clean(raw.replace(/["“”*_]/g,''));
    const re=p && phraseRegex(p), hit=re && title.match(re);
    if(hit && p.split(' ').length<=4){ E.claude[title]=hit[0]; }
    else $('status').textContent='Claude returned a phrase that is not in the title, so the studio rule is used.';
  }catch(e){
    if(e?.code!=='cancelled') $('status').textContent = e?.code==='not_granted' ? 'Claude was not allowed, so the studio rule picks the italic.' : 'Claude could not answer just now. The studio rule picks the italic.';
    if(e?.code==='not_granted'){ SAMPLE=null; }
  }finally{ $('emphAsk').disabled=false; updateEmphUI(); render(); }
}
$('emphAsk').onclick=()=>askClaude(true);
$('title').addEventListener('change',()=>askClaude(false));
$('thumbTitle').addEventListener('change',()=>{ const t=clean($('thumbTitle').value); if(t && !$('thumbTitle').value.includes('*') && !phraseIn(t)) render(); });
function phraseIn(t){ const p=phraseFor($('title').value); return p && t.includes(p); }

function linesFor(kind){
  const tt=$('thumbTitle').value.trim();
  let src;
  if(kind==='thumb' && tt && E.mode==='manual' && !tt.includes('*')){
    syncWords(); const chosen=new Set([...E.sel].map(i=>normW(E.words[i]||'')));
    src=markWords(tt,(i,w)=>chosen.has(normW(w)));
  } else if(kind==='thumb' && tt){
    // thumbnail keeps the main title's emphasis when the phrase survives the shortening
    const p=phraseFor($('title').value), main=$('title').value;
    src = tt.includes('*') ? tt : (main.includes('*') ? (()=>{ const m=main.match(/\*([^*]+)\*/); return m && tt.includes(m[1]) ? tt.replace(m[1],'*'+m[1]+'*') : applyEmphasis(tt); })()
          : (()=>{ const re=p&&phraseRegex(p), m=re&&tt.match(re); return m ? tt.slice(0,m.index)+'*'+m[0]+'*'+tt.slice(m.index+m[0].length) : applyEmphasis(tt); })());
  } else src = applyEmphasis($('title').value);
  let lines=parseTitle(src);
  if(lines.length===1 && lines[0].length>2){ const T = kind==='thumb' ? F.thumb.text : F.wide.text; lines=balance(lines[0],T.maxW,T.size*.92); }
  return lines;
}
function fitSize(lines,T){
  let s=T.size;
  while(s>12){
    const mw=Math.max(...lines.map(l=>measureWords(l,s)));
    if(mw<=T.maxW && lines.length*s*LH<=T.maxH) break;
    s-=1;
  }
  return s;
}
let RH_MET=null;
function metrics(size){
  if(!RH_MET){ mctx.font=`700 100px ${RH}`; const m=mctx.measureText('Hg'); RH_MET={a:(m.fontBoundingBoxAscent||101)/100,d:(m.fontBoundingBoxDescent||31)/100}; }
  const L=size*LH; return { L, base:(L-(RH_MET.a+RH_MET.d)*size)/2 + RH_MET.a*size };
}
// Title layout per format: size, line boxes (top, x, width)
function layoutTitle(kind){
  const fr=F[kind], T=fr.text, lines=linesFor(kind), size=Math.max(10,Math.round(fitSize(lines,T)*(S.adj[kind].t||1))), {L,base}=metrics(size);
  const top = T.mode==='left' ? (fr.h - lines.length*L)/2 : T.top;
  const out=lines.map((l,i)=>{ const w=measureWords(l,size); return { words:l, w, top:top+i*L, base:top+i*L+base, x: T.mode==='left'? T.left : (fr.w-w)/2 }; });
  const right=Math.max(...out.map(o=>o.x+o.w)), bottom=top+lines.length*L;
  return { size, L, lines:out, right, bottom, top };
}

// ---- Auto placement: fit the trimmed hero into the space the title leaves ----
function autoPlace(kind,tl){
  const fr=F[kind], a=S.hero.width/S.hero.height;
  let box;
  if(kind==='wide')  box={ l:Math.max(tl.right+56,470), r:fr.w+20, t:30, b:fr.h+30 };
  if(kind==='thumb') box={ l:Math.max(tl.right+22,235), r:fr.w+28, t:38, b:fr.h+22 };
  if(kind==='tall')  box={ l:-40, r:fr.w+40, t:tl.bottom+70, b:1650 };
  const bw=box.r-box.l, bh=box.b-box.t;
  let w=bw, h=w/a; if(h>bh){ h=bh; w=h*a; }
  const x = kind==='tall' ? (fr.w-w)/2 : box.l + (bw-w)*0.35;
  // story: the hero's lower part reaches the full-strength frosted strips (below y 1385), like the Figma story
  const y = kind==='tall' ? Math.min(box.b-h, Math.max(box.t, 1480 - h)) : box.t + (bh-h)/2;
  return { x, y, w, h };
}
function heroRect(kind,tl){
  const p=autoPlace(kind,tl), A=S.adj[kind];
  const w=p.w*A.s, h=p.h*A.s;
  return { x:p.x+(p.w-w)/2+A.dx, y:p.y+(p.h-h)/2+A.dy, w, h };
}

// ---- Rendering (same code for preview and export) ----
function draw(ctx,kind,scale){
  const fr=F[kind]; ctx.save(); ctx.setTransform(scale,0,0,scale,0,0);
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  ctx.fillStyle=S.base; ctx.fillRect(0,0,fr.w,fr.h);
  if(kind==='tall'){ const g=ctx.createRadialGradient(fr.w*.45,0,0,fr.w*.45,0,fr.w*1.1); g.addColorStop(0,'rgba(255,255,255,.07)'); g.addColorStop(.7,'rgba(255,255,255,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,fr.w,fr.h); }
  const sh=fr.shade, g = sh.axis==='x' ? ctx.createLinearGradient(sh.from,0,sh.to,0) : ctx.createLinearGradient(0,sh.from,0,sh.to);
  g.addColorStop(0,S.shade); g.addColorStop(1,hexA(S.shade,0)); ctx.fillStyle=g; ctx.fillRect(0,0,fr.w,fr.h);
  const tl=layoutTitle(kind);
  const drawHero=()=>{ if(S.hero){ const r=heroRect(kind,tl); ctx.drawImage(S.hero,r.x,r.y,r.w,r.h); } };
  // Story: the strips sit ABOVE the hero and frost it (25px background blur), as in the Figma source.
  // Blog hero and thumbnail: the strips stay behind the hero.
  const frost = kind==='tall';
  let blurred=null;
  if(frost){ drawHero();
    const ys=ramp(fr.strips.count).map((_,i)=>fr.strips.start+i*fr.strips.step);
    blurred=blurBand(ctx.canvas, 25*scale, Math.min(...ys)*scale, (Math.max(...ys)+fr.strips.size)*scale); }
  // curtain strips: #211E1E peak at 76%, 20% opacity, overlay
  ramp(fr.strips.count).forEach((op,i)=>{
    const p=fr.strips.start+i*fr.strips.step, sz=fr.strips.size;
    const rect = fr.strips.axis==='x' ? [p,0,sz,fr.h] : [0,p,fr.w,sz];
    if(blurred){
      ctx.save(); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=op;
      ctx.beginPath(); ctx.rect(...rect); ctx.clip();
      ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingQuality='high'; ctx.drawImage(blurred.c,0,blurred.top,blurred.w,blurred.h); ctx.restore();
    }
    const sg = fr.strips.axis==='x' ? ctx.createLinearGradient(p,0,p+sz,0) : ctx.createLinearGradient(0,p+sz,0,p);
    sg.addColorStop(0,'rgba(33,30,30,0)'); sg.addColorStop(.76,'rgba(33,30,30,1)'); sg.addColorStop(1,'rgba(33,30,30,0)');
    ctx.globalCompositeOperation='overlay'; ctx.globalAlpha=.2*op; ctx.fillStyle=sg; ctx.fillRect(...rect);
  });
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  if(!frost) drawHero();
  ctx.fillStyle='#fff'; ctx.textBaseline='alphabetic';
  tl.lines.forEach(ln=>{
    let x=ln.x;
    ln.words.forEach((w,j)=>{
      ctx.font=fontFor(w,tl.size); setLS(ctx,w,tl.size);
      if(j>0) x+=ctx.measureText(' ').width;
      ctx.fillText(w.t,x,ln.base); x+=ctx.measureText(w.t).width;
    });
  });
  if(fr.cta && $('cta').value.trim()){
    const c=fr.cta; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.roundRect(c.x,c.y,c.w,c.h,c.h/2); ctx.fill();
    ctx.fillStyle='#0B0B0B'; ctx.font=`700 38px ${RH}`; if('letterSpacing' in ctx) ctx.letterSpacing='0px';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText($('cta').value.trim(),c.x+c.w/2,c.y+c.h/2+2); ctx.textAlign='left';
  }
  ctx.restore();
  return tl;
}
// Blurred copy of the canvas so far (the backdrop the frosted strips show)
const CAN_FILTER=(()=>{ try{ const t=document.createElement('canvas').getContext('2d'); t.filter='blur(2px)'; return t.filter==='blur(2px)'; }catch(e){ return false; } })();
function blurBand(src,radius,y0,y1){
  // blur only the strip band, at quarter resolution (the blur hides the lost detail), then scale back up
  const pad=Math.round(radius*2), top=Math.max(0,Math.floor(y0-pad)), bot=Math.min(src.height,Math.ceil(y1+pad)), h=bot-top, d=4;
  const m=document.createElement('canvas'); m.width=Math.max(1,Math.round(src.width/d)); m.height=Math.max(1,Math.round(h/d));
  const mx=m.getContext('2d'); mx.imageSmoothingQuality='high';
  if(CAN_FILTER){ mx.filter=`blur(${radius/d}px)`; mx.drawImage(src,0,top,src.width,h,0,0,m.width,m.height); }
  else { const k=document.createElement('canvas'); k.width=Math.max(1,Math.round(m.width/3)); k.height=Math.max(1,Math.round(m.height/3));
         k.getContext('2d').drawImage(src,0,top,src.width,h,0,0,k.width,k.height); mx.drawImage(k,0,0,m.width,m.height); }
  return { c:m, top, h, w:src.width };
}
const CV={}; KINDS.forEach(k=>{ const c=$('cv-'+k); c.width=F[k].w; c.height=F[k].h; CV[k]=c; });
let raf=0;
function render(){ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>KINDS.forEach(k=>{ const tl=draw(CV[k].getContext('2d'),k,1); const o=document.querySelector(`[data-tout="${k}"]`); if(o) o.textContent=tl.size+'px'; })); }

// ---- Color: sample the hero, keep white text legible ----
function hexA(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function hslHex(h,s,l){ s/=100; l/=100; const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l), f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))); return '#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''); }
function lum(hex){ const n=parseInt(hex.slice(1),16); return [n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0); }
const contrastW = hex => 1.05/(lum(hex)+.05);
function paletteFor(h){
  let l=48; while(l>18 && contrastW(hslHex(h,100,l))<4.5) l-=1;
  return { base:hslHex(h,100,l), shade:hslHex(h,95,Math.round(l*.52)) };
}
function sampleHues(img){
  const c=document.createElement('canvas'), k=Math.min(1,200/Math.max(img.width,img.height));
  c.width=Math.max(1,Math.round(img.width*k)); c.height=Math.max(1,Math.round(img.height*k));
  const x=c.getContext('2d'); x.drawImage(img,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height).data, bins=new Array(36).fill(0), sum=new Array(36).fill(0);
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<200) continue;
    const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), dl=mx-mn;
    const s=mx?dl/mx:0; if(s<.2||mx<.2) continue;
    let h= mx===r?((g-b)/dl)%6 : mx===g?(b-r)/dl+2 : (r-g)/dl+4; h=(h*60+360)%360;
    const bi=Math.floor(h/10)%36; bins[bi]+=s; sum[bi]+=h*s;
  }
  // group neighbouring hues (+-20deg) so a colour spread over several shades still wins
  const win=i=>{ let v=0,hs=0,ws=0; for(let o=-2;o<=2;o++){ const j=(i+o+36)%36; if(!bins[j]) continue; let h=sum[j]/bins[j]; const ref=i*10+5; if(h-ref>180)h-=360; if(ref-h>180)h+=360; v+=bins[j]; hs+=h*bins[j]; } return {v,h:v?((hs/v)+360)%360:0}; };
  const peaks=bins.map((_,i)=>win(i)).map((p,i)=>({...p,i})).sort((a,b)=>b.v-a.v);
  if(!peaks.length||!peaks[0].v) return [265];
  const top=peaks[0], picked=[top.h];
  for(const p of peaks){ if(p.v<top.v*.15) break; if(picked.every(h=>Math.min(Math.abs(h-p.h),360-Math.abs(h-p.h))>40)) picked.push(p.h); if(picked.length===3) break; }
  // fill with close neighbours of the main colour, so there is always a choice
  for(const off of [18,-18]) if(picked.length<3) picked.push((top.h+off+360)%360);
  return picked;
}
function setColors(base,shade,auto){
  S.base=base; S.shade=shade; if(auto!==undefined) S.colorsAuto=auto;
  $('cBase').value=base; $('cShade').value=shade; $('cBaseHex').textContent=base.toUpperCase(); $('cShadeHex').textContent=shade.toUpperCase();
  const cr=contrastW(base);
  $('contrast').innerHTML = `White title contrast <b style="color:${cr>=4.5?'var(--ok)':'var(--warn-ink)'}">${cr.toFixed(1)}:1</b>${cr<4.5?' (aim for 4.5:1 or more)':''}`;
  [...$('swatches').children].forEach(b=>b.setAttribute('aria-pressed', b.dataset.base===base?'true':'false'));
  render();
}
function buildSwatches(){
  const box=$('swatches'); box.textContent='';
  S.candidates.forEach((h,i)=>{
    const p=paletteFor(h), b=document.createElement('button');
    b.type='button'; b.className='sw'; b.dataset.base=p.base; b.style.background=`linear-gradient(135deg,${p.base} 55%,${p.shade} 55%)`;
    b.title=i===0?'Main color in the hero':'Other color in the hero'; b.setAttribute('aria-label',(i===0?'Main hero color ':'Alternative hero color ')+p.base);
    b.onclick=()=>setColors(p.base,p.shade,true); box.appendChild(b);
  });
}

// ---- Hero loading: trim transparent margins, warn about common export mistakes ----
function loadHero(src,name,isSample){
  const img=new Image();
  img.onload=()=>{
    const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
    const x=c.getContext('2d'); x.drawImage(img,0,0); const d=x.getImageData(0,0,c.width,c.height).data;
    let x0=c.width,y0=c.height,x1=-1,y1=-1, transparent=0;
    for(let y=0;y<c.height;y+=1){ for(let xx=0;xx<c.width;xx+=1){ const a=d[(y*c.width+xx)*4+3]; if(a<250) transparent++; if(a>8){ if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(y<y0)y0=y; if(y>y1)y1=y; } } }
    const warns=[];
    if(transparent < c.width*c.height*0.02) warns.push('This image has no transparent background, so it will show as a box on the cover. Ask for a PNG exported with the background hidden.');
    if(img.naturalWidth<1600 && !isSample) warns.push(`The image is ${img.naturalWidth}px wide. Use 1600px or wider so the story version stays sharp.`);
    if(x1<0){ x0=0;y0=0;x1=c.width-1;y1=c.height-1; }
    const t=document.createElement('canvas'); t.width=x1-x0+1; t.height=y1-y0+1; t.getContext('2d').drawImage(c,x0,y0,t.width,t.height,0,0,t.width,t.height);
    S.hero=t; S.heroURL=t.toDataURL('image/png'); S.heroName=name; S.isSample=isSample;
    $('heroThumb').src=S.heroURL; $('heroName').textContent=name; $('sampleTag').hidden=!isSample;
    $('heroWarn').hidden=!warns.length; $('heroWarn').textContent=warns.join(' ');
    S.candidates=sampleHues(t); buildSwatches();
    const p=paletteFor(S.candidates[0]); resetAdj(); setColors(p.base,p.shade,true);
  };
  img.onerror=()=>{ $('heroWarn').hidden=false; $('heroWarn').textContent='That file could not be read as an image. Use a PNG.'; };
  img.src=src;
}
function useFile(f){
  if(!f) return; const r=new FileReader();
  r.onload=()=>{ loadHero(r.result,f.name,false); if(!$('slug').dataset.touched) $('slug').value=slugify($('title').value)||'blog-cover'; };
  r.readAsDataURL(f);
}
const drop=$('drop');
$('heroFile').onchange=e=>useFile(e.target.files[0]);
drop.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); $('heroFile').click(); } });
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>useFile(e.dataTransfer.files[0]));
document.addEventListener('paste',e=>{ const f=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/')); if(f) useFile(f); });

// ---- Per-format adjustments: drag to move, slider to resize ----
function resetAdj(k){ (k?[k]:KINDS).forEach(kk=>{ S.adj[kk]={dx:0,dy:0,s:1,t:1}; const r=document.querySelector(`[data-scale="${kk}"]`); r.value=100; document.querySelector(`[data-out="${kk}"]`).textContent='100%'; document.querySelector(`[data-text="${kk}"]`).value=100; }); }
document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{ resetAdj(b.dataset.reset); render(); });
document.querySelectorAll('[data-text]').forEach(r=>r.oninput=()=>{ S.adj[r.dataset.text].t=r.value/100; render(); });
document.querySelectorAll('[data-scale]').forEach(r=>r.oninput=()=>{ const k=r.dataset.scale; S.adj[k].s=r.value/100; document.querySelector(`[data-out="${k}"]`).textContent=r.value+'%'; render(); });
KINDS.forEach(k=>{
  const c=CV[k]; let st=null;
  c.addEventListener('pointerdown',e=>{ c.setPointerCapture(e.pointerId); c.classList.add('dragging'); st={x:e.clientX,y:e.clientY,dx:S.adj[k].dx,dy:S.adj[k].dy,ratio:F[k].w/c.getBoundingClientRect().width}; });
  c.addEventListener('pointermove',e=>{ if(!st) return; S.adj[k].dx=st.dx+(e.clientX-st.x)*st.ratio; S.adj[k].dy=st.dy+(e.clientY-st.y)*st.ratio; render(); });
  const end=()=>{ st=null; c.classList.remove('dragging'); };
  c.addEventListener('pointerup',end); c.addEventListener('pointercancel',end);
});

['title','thumbTitle','cta'].forEach(id=>$(id).addEventListener('input',()=>{ updateEmphUI(); render(); }));
$('cBase').oninput=e=>setColors(e.target.value,S.shade,false);
$('cShade').oninput=e=>setColors(S.base,e.target.value,false);
$('slug').addEventListener('input',()=>$('slug').dataset.touched='1');
const slugify=s=>s.replace(/\*/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);

// ---- Export ----
function pngBlob(kind){ return new Promise(res=>{ const c=document.createElement('canvas'); c.width=F[kind].w*2; c.height=F[kind].h*2; draw(c.getContext('2d'),kind,2); c.toBlob(res,'image/png'); }); }
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
// Story frost for the Figma file: the frosted strips rendered as one transparent image layer, so Figma
// shows exactly what the PNG shows (CSS background blur only samples inside each 56px strip and looks weaker).
function frostLayerHTML(){
  const fr=F.tall, sc=2, c=document.createElement('canvas'); c.width=fr.w*sc; c.height=fr.h*sc;
  const x=c.getContext('2d'); x.setTransform(sc,0,0,sc,0,0);
  x.fillStyle=S.base; x.fillRect(0,0,fr.w,fr.h);
  const rg=x.createRadialGradient(fr.w*.45,0,0,fr.w*.45,0,fr.w*1.1); rg.addColorStop(0,'rgba(255,255,255,.07)'); rg.addColorStop(.7,'rgba(255,255,255,0)'); x.fillStyle=rg; x.fillRect(0,0,fr.w,fr.h);
  const g=x.createLinearGradient(0,fr.shade.from,0,fr.shade.to); g.addColorStop(0,S.shade); g.addColorStop(1,hexA(S.shade,0)); x.fillStyle=g; x.fillRect(0,0,fr.w,fr.h);
  const r=heroRect('tall',layoutTitle('tall')); x.drawImage(S.hero,r.x,r.y,r.w,r.h);
  const ys=ramp(fr.strips.count).map((_,i)=>fr.strips.start+i*fr.strips.step), top=Math.min(...ys), bot=Math.max(...ys)+fr.strips.size;
  const bl=blurBand(c,25*sc,top*sc,bot*sc);
  const o=document.createElement('canvas'); o.width=fr.w*sc; o.height=Math.ceil((bot-top)*sc); const ox=o.getContext('2d');
  ramp(fr.strips.count).forEach((op,i)=>{ const p=ys[i]; ox.save(); ox.globalAlpha=op; ox.beginPath(); ox.rect(0,(p-top)*sc,o.width,fr.strips.size*sc); ox.clip();
    ox.drawImage(bl.c,0,bl.top-top*sc,bl.w,bl.h); ox.restore(); });
  return `<img class="frost" alt="frost" src="${o.toDataURL('image/png')}" style="left:0;top:${top.toFixed(1)}px;width:${fr.w}px;height:${(bot-top).toFixed(1)}px">`;
}
function figmaHTML(){
  const frames=KINDS.map(k=>{
    const fr=F[k], tl=layoutTitle(k);
    const strips=ramp(fr.strips.count).map((op,i)=>{ const p=fr.strips.start+i*fr.strips.step, sz=fr.strips.size;
      return fr.strips.axis==='x'
        ? `<div class="strip" style="left:${p}px;top:0;width:${sz}px;height:100%;background:linear-gradient(to right,rgba(33,30,30,0),#211E1E 76%,rgba(33,30,30,0));opacity:${(.2*op).toFixed(3)}"></div>`
        : `<div class="strip" style="left:0;top:${p}px;width:100%;height:${sz}px;background:linear-gradient(to top,rgba(33,30,30,0),#211E1E 76%,rgba(33,30,30,0));opacity:${(.2*op).toFixed(3)}"></div>`; }).join('');
    const sh=fr.shade, shadeCSS = sh.axis==='x' ? `linear-gradient(to right,var(--shade) ${sh.from}px,transparent ${sh.to}px)` : `linear-gradient(to top,var(--shade) ${fr.h-sh.from}px,transparent ${fr.h-sh.to}px)`;
    const r=S.hero?heroRect(k,tl):null;
    const lines=tl.lines.map(ln=>`<div class="ln" style="top:${ln.top.toFixed(1)}px;left:${ln.x.toFixed(1)}px;font-size:${tl.size}px;line-height:${tl.L.toFixed(2)}px">${
      ln.words.map((w,j)=>(j?' ':'')+(w.i?`<em class="pf">${esc(w.t)}</em>`:`<span class="rh">${esc(w.t)}</span>`)).join('').replace(/<\/em> <em class="pf">/g,' ')}</div>`).join('');
    const cta = fr.cta && $('cta').value.trim() ? `<div class="cta" style="left:${fr.cta.x}px;top:${fr.cta.y}px;width:${fr.cta.w}px;height:${fr.cta.h}px">${esc($('cta').value.trim())}</div>` : '';
    return `<section class="frame" data-frame="${k}" style="width:${fr.w}px;height:${fr.h}px">
<div class="bg"></div><div class="shade" style="background:${shadeCSS}"></div>${k==='tall'?'':strips}
${r?`<img class="hero" src="HERO_SRC" style="left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px">`:''}${k==='tall'&&r?frostLayerHTML():''}${k==='tall'?strips:''}
${lines}${cta}</section>`; }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc($('slug').value)} cover</title>
<style>@font-face{font-family:"Red Hat Display";font-weight:700;src:url(data:font/woff2;base64,${EMBED.redHat700}) format("woff2")}@font-face{font-family:"Playfair Display";font-style:italic;font-weight:700;src:url(data:font/woff2;base64,${EMBED.playfairItalic700}) format("woff2")}</style>
<style>:root{--brand:${S.base};--shade:${S.shade}}body{margin:0;background:#262626;padding:40px;display:flex;flex-direction:column;gap:40px;align-items:flex-start}
.frame{position:relative;overflow:hidden;flex:none}.frame>*{position:absolute}.bg{inset:0;background:var(--brand)}.shade{inset:0}
.strip{mix-blend-mode:overlay}.frost{pointer-events:none}.ln{color:#fff;white-space:nowrap;font-family:"Red Hat Display",sans-serif}
.rh{font-family:"Red Hat Display",sans-serif;font-weight:700;letter-spacing:-.01em}.pf{font-family:"Playfair Display",serif;font-style:italic;font-weight:700}
.cta{background:#fff;border-radius:999px;display:flex;align-items:center;justify-content:center;font:700 38px/1 "Red Hat Display",sans-serif;color:#0B0B0B}</style></head><body>
${frames}</body></html>`.replace(/HERO_SRC/g,S.heroURL);
}
(async()=>{ try{ SAMPLE = window.claude ? await window.claude.use('sample') : null; }catch(e){ SAMPLE=null; } updateEmphUI(); })();
let downloads=null;
(async()=>{ try{ downloads = window.claude ? await window.claude.use('downloads') : null; }catch(e){ downloads=null; } })();
async function save(filename,data){
  if(downloads){
    try{ await downloads.save({filename,data}); $('status').textContent=`Saved ${filename}`; }
    catch(e){ $('status').textContent = e?.code==='declined' ? 'Download cancelled.' : e?.code==='rate_limited' ? 'Another download prompt is open. Try again in a moment.' : `Could not save ${filename}.`; }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data],{type: filename.endsWith('.html')?'text/html':'application/octet-stream'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=filename; a.style.display='none'; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },4000);
  $('status').textContent=`Downloaded ${filename}`;
}
const name=()=> (slugify($('slug').value)||'blog-cover');
document.querySelectorAll('[data-dl]').forEach(b=>b.onclick=async()=>{ const k=b.dataset.dl; save(`${name()}-${k==='tall'?'story':k}.png`, await pngBlob(k)); });
$('dlAll').onclick=async()=>{ try{
  $('status').textContent='Preparing files…';
  const zip=new JSZip(), n=name();
  for(const k of KINDS) zip.file(`${n}-${k==='tall'?'story':k}.png`, await pngBlob(k));
  zip.file(`${n}-figma.html`, figmaHTML());
  await save(`${n}.zip`, await zip.generateAsync({type:'blob'}));
  }catch(e){ $('status').textContent='Could not build the zip. Download the PNGs one by one instead.'; console.error(e); }
};

// ---- Start with the sample loaded ----
document.fonts.load(`700 40px ${RH}`).then(()=>document.fonts.load(`italic 700 40px ${PF}`)).finally(()=>{ RH_MET=null; loadHero(EMBED.sampleHero,'fintech-hero.png (sample)',true); updateEmphUI();
  if(!document.fonts.check(`italic 700 40px ${PF}`)) $('status').textContent='Playfair Display did not load, so the italic shows in a fallback font. Check the network and reload before exporting.'; });
document.fonts.addEventListener?.('loadingdone',()=>{ RH_MET=null; render(); });
