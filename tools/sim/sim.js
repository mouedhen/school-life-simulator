require('../../src/data.js'); require('../../src/talk.js'); const E=require('../../src/engine.js');
function run(seed, bot){
  const S=E.newGame(seed); let guard=0;
  const rnd=E.mul(seed*7+3);
  while(!S.over && S.phase!=='ending' && guard++<5000){
    if(S.phase==='event'){
      const ev=E.buildEvent(S); if(!ev) throw new Error('no event '+JSON.stringify(S.pend)+' phase '+S.phase);
      const ok=ev.choices.map((c,i)=>i).filter(i=>!ev.choices[i].disabled);
      let i;
      if(bot==='random') i=ok[Math.floor(rnd()*ok.length)];
      else if(bot==='kind'||bot==='saint') i=ok[0];
      else if(bot==='mean') i=ok[ok.length-1];
      else i=ok[Math.floor(rnd()*ok.length)];
      E.choose(S,i,ev.choices[i].gift?E.giftItems(S)[0].n:undefined);
    } else if(S.phase==='free'){
      if(bot==='saint'){
        while(S.blocks>0){ const kids=E.KIDS.filter(k=>S.rel[k]<60).sort((a,b)=>S.rel[a]-S.rel[b]); const n=kids[0]||E.KIDS[0];
          const l=E.interactionList(S,n).filter(x=>x.ok&&x.cost>0&&['hangout','talk','group'].includes(x.id)); let pick=l.find(x=>x.id==='hangout')||l.find(x=>x.id==='group')||l[0]; if(!pick) {const l2=E.KIDS.filter(k=>E.interactionList(S,k).some(x=>x.ok&&x.cost>0&&x.id==='talk'));if(!l2.length)break; E.interact(S,l2[0],'talk','school');continue;}
          const r=E.interact(S,n,pick.id,'school'); if(r&&r.err) break; }
      } else if(bot==='kind'){ // talk to people, study, work a bit
        const kids=E.KIDS.slice().sort((a,b)=>S.rel[a]-S.rel[b]);
        while(S.blocks>0){ const n=kids[Math.floor(rnd()*kids.length)];
          const l=E.interactionList(S,n).filter(x=>x.ok&&x.cost>0&&['talk','hangout','study','group'].includes(x.id));
          if(!l.length) break; const pickI=l[Math.floor(rnd()*l.length)]; const r=E.interact(S,n,pickI.id,'school'); if(r&&r.err) break; }
        if(rnd()<.3) E.work(S,Math.floor(rnd()*8));
      } else if(bot==='mean'){
        const kids=E.KIDS;
        while(S.blocks>0){ const n=kids[Math.floor(rnd()*kids.length)]; const r=E.interact(S,n,rnd()<.5?'start':'share',0); if(r&&r.err)break; }
      }
      E.endDay(S);
    } else break;
  }
  return S;
}
const bots=process.argv[2]?[process.argv[2]]:['random','kind','mean'];
for(const bot of bots){
  const res={};let over=0,pops=[],grades=[],mon=[];
  for(let s=1;s<=60;s++){const S=run(s,bot); if(S.over){over++; res['GAME OVER pop@day'+Math.round(S.di/20)*20]=(res['GAME OVER pop@day'+Math.round(S.di/20)*20]||0)+1;} else {const id=S.ending.id; res[id]=(res[id]||0)+1; pops.push(S.pop);grades.push(S.grade);mon.push(S.money);} }
  const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
  console.log(bot,'over',over,'/60','avgPop',avg(pops),'avgGrade',avg(grades),'avgMoney',avg(mon)); console.log(res);
}
