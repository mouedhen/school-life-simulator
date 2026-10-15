require('./data.js'); const E=require('./engine.js');
const S=E.newGame(5);let n=0;const rnd=E.mul(9);let guard=0;const cnt={};
while(!S.over&&S.phase!=='ending'&&guard++<4000){
 if(S.phase==='event'){const ev=E.buildEvent(S);E.choose(S,ev.choices.findIndex(c=>!c.disabled));}
 else{ while(S.blocks>0){const k=E.KIDS.slice().sort((a,b)=>S.rel[a]-S.rel[b]); const nm=k[Math.floor(rnd()*30)];
   const l=E.interactionList(S,nm).filter(x=>x.ok&&x.cost>0&&['talk','hangout','study','group'].includes(x.id)); if(!l.length)break;
   const p=l[Math.floor(rnd()*l.length)]; const r=E.interact(S,nm,p.id,'school'); if(r&&r.err)break; cnt[p.id]=(cnt[p.id]||0)+1;} E.endDay(S);}
}
console.log(cnt, E.KIDS.map(n=>S.rel[n]).sort((a,b)=>a-b).join(','));
