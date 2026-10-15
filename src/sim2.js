require('./data.js'); require('./talk.js'); const E=require('./engine.js');
const NICE=['talk','compliment','hangout','group','study','askhelp','lend','share','defend','apologize','advice','lunch','message','cheer','collab','reconcile','secret','talkabout','joingroup','investigate','boundary'];
const MEAN=['insult','prank','fight','tease','start','end','debate','askmoney'];
function run(seed){
  const S=E.newGame(seed); const R=E.mul(seed*131+7); let guard=0;
  const kind=R(), social=R(), study=R(), work=R(), shop=R(), focus=R();
  const favs=E.KIDS.slice().sort(()=>R()-.5).slice(0, 2+Math.floor(focus*8));
  const evBias=R(); // 0 = last choice, 1 = first
  while(!S.over && S.phase!=='ending' && guard++<6000){
    if(S.phase==='event'){
      const ev=E.buildEvent(S); const ok=ev.choices.map((c,i)=>i).filter(i=>!ev.choices[i].disabled);
      let i; const r=R();
      if(r<.15) i=ok[Math.floor(R()*ok.length)]; else { const k=Math.round((1-(R()<kind?evBias:1-evBias))*(ok.length-1)); i=ok[Math.max(0,Math.min(ok.length-1,k))]; }
      E.choose(S,i,ev.choices[i].gift?E.giftItems(S)[0].n:undefined);
    } else if(S.phase==='free'){
      let n=0;
      while(S.blocks>0 && n++<8){
        const x=R();
        if(x<study*.35){ const r=E.study(S); if(r&&r.err) break; continue; }
        if(x<study*.35+work*.2){ const r=E.work(S,Math.floor(R()*8)); if(r&&r.err){} continue; }
        if(R()>social+.1) break;
        const pool=R()<.6?favs:E.KIDS; const nm=pool[Math.floor(R()*pool.length)];
        const l=E.interactionList(S,nm).filter(q=>q.ok&&q.cost>0&&(R()<kind?NICE:MEAN).includes(q.id));
        if(!l.length) { if(R()<.5) break; continue; }
        const q=l[Math.floor(R()*l.length)]; const r=E.interact(S,nm,q.id,'school'); if(r&&r.err) break;
      }
      if(R()<shop*.1){ try{ const it=E.SHOP[Math.floor(R()*E.SHOP.length)]; E.buy(S,it.n||it[0]);}catch(e){} }
      E.endDay(S);
    } else break;
  }
  return S;
}
const N=+process.argv[2]||600; const res={}, any={}; let over=0;
for(let s=1;s<=N;s++){ const S=run(s); if(S.over){over++;continue;} const id=S.ending.id; res[id]=(res[id]||0)+1; S.ending.all.forEach(a=>any[a]=(any[a]||0)+1); }
const ids=E.ENDINGS.map(e=>e.id); const never=ids.filter(i=>!any[i]);
console.log('runs',N,'gameover',over); console.log(Object.entries(res).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' ')); console.log('ANY:',Object.entries(any).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' '));console.log('NEVER ('+never.length+'/'+ids.length+'):',never.join(' '));
