if(process.env.NO_NPC)globalThis.__NO_NPC=1; require('../src/data.js'); require('../src/talk.js'); const E=require('../src/engine.js');
const NICE=['talk','compliment','hangout','group','study','askhelp','lend','share','defend','apologize','advice','lunch','message','cheer','collab','reconcile','secret','talkabout','joingroup','investigate','boundary'];
const MEAN=['insult','prank','fight','tease','start','end','debate','askmoney'];
function run(seed){
  const S=E.newGame(seed); const R=E.mul(seed*131+7); let guard=0;
  const kind=R(), social=R(), study=R(), work=R(), shop=R(), focus=R();
  const favs=E.KIDS.slice().sort(()=>R()-.5).slice(0, 2+Math.floor(focus*8));
  const phoneUse=R(); const evBias=R(); // 0 = last choice, 1 = first
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
        const l=E.interactionList(S,nm).filter(q=>q.ok&&q.cost>0&&(R()<kind?NICE:MEAN).includes(q.id)&&!(process.env.PHONE&&E.PHONE_HIDE.has(q.id)));
        if(!l.length) { if(R()<.5) break; continue; }
        const q=l[Math.floor(R()*l.length)]; const r=E.interact(S,nm,q.id,'school'); if(r&&r.err) break;
      }
      if(process.env.PHONE){
        for(let k=0;k<Math.floor(5*phoneUse);k++){ const pool=R()<.6?favs:E.KIDS.concat(E.FAM); const nm=pool[Math.floor(R()*pool.length)]; const l=E.phoneList(S,nm).filter(a=>a.ok&&(R()<kind?true:['tease','boundary'].includes(a.id)||R()<.2)); if(!l.length) continue; E.phoneAct(S,nm,l[Math.floor(R()*l.length)].id); }
        if(R()<phoneUse*.7){ const key=R()<.8?'#class':'#fam'; const l=E.phoneGroupList(S,key).filter(a=>a.ok); if(l.length) E.phoneGroupAct(S,key,l[Math.floor(R()*l.length)].id); }
        if(R()<phoneUse){ Object.keys((S.phone&&S.phone.th)||{}).forEach(k=>{ const th=S.phone.th[k]; const m=[...th].reverse().find(x=>x.q&&!x.done); if(m&&R()<.7){ const ix=R()<kind? 0 : Math.floor(R()*m.q.length); E.phoneReply(S,k,Math.min(ix,m.q.length-1)); } }); }
        if(R()<phoneUse*.6){ const g=['reply','who','emoji','tap'][Math.floor(R()*4)]; E.phoneGame(S,g,R()<.5?5:3,g==='tap'?20:5); }
      }
      if(R()<shop*.1){ try{ const it=E.SHOP[Math.floor(R()*E.SHOP.length)]; E.buy(S,it.n||it[0]);}catch(e){} }
      E.endDay(S);
    } else break;
  }
  return S;
}
const N=+process.argv[2]||600; const res={}, any={}; let over=0, money=0, pop=0, grade=0, n=0, npc=0;
const phEnd={}; for(let s=1;s<=N;s++){ const S=run(s); if(S.over){over++;continue;} n++; money+=S.money; pop+=S.pop; grade+=S.grade; npc+=Object.keys(S.giftFrom||{}).length; const id=S.ending.id; res[id]=(res[id]||0)+1; if(id.startsWith('ph_')) phEnd[id]=(phEnd[id]||0)+1; S.ending.all.forEach(a=>any[a]=(any[a]||0)+1); }
const ids=E.ENDINGS.map(e=>e.id); const never=ids.filter(i=>!any[i]);
console.log((process.env.PHONE?'PHONE ':'')+(globalThis.__NO_NPC?'NPC OFF':'NPC ON')+' runs',N,'gameover',over,'finished',n);
console.log('avg money',(money/n).toFixed(1),'pop',(pop/n).toFixed(1),'grade',(grade/n).toFixed(1),'avg givers',(npc/n).toFixed(1));
console.log('endings reached (any):',ids.length-never.length,'/',ids.length); console.log('never:',never.join(' '));
console.log('phone endings as primary:',JSON.stringify(phEnd),' any:',JSON.stringify(Object.fromEntries(Object.entries(any).filter(([k])=>k.startsWith('ph_')))));
const top={};Object.keys(res).forEach(k=>top[k]=res[k]);console.log('share of runs with a phone ending as primary:',(Object.values(phEnd).reduce((a,b)=>a+b,0)/n*100).toFixed(1)+'%');
