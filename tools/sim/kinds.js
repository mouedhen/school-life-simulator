require('../../src/data.js'); const E=require('../../src/engine.js');
const S=E.newGame(11);const kinds={};const titles=new Set();let g=0;const rnd=E.mul(4);
while(!S.over&&S.phase!=='ending'&&g++<4000){
 if(S.phase==='event'){const ev=E.buildEvent(S);kinds[ev.kind]=(kinds[ev.kind]||0)+1;if(ev.kind!=='day'&&ev.kind!=='rand')titles.add(S.di+' '+E.dayOf(S).d+' '+ev.kind+':'+ev.title);
  const ok=ev.choices.map((c,i)=>i).filter(i=>!ev.choices[i].disabled);const i=ok[Math.floor(rnd()*ok.length)];E.choose(S,i,ev.choices[i].gift?E.giftItems(S)[0].n:undefined);}
 else E.endDay(S);}
console.log(kinds,[...titles].join('\n'),'\nend',S.ending&&S.ending.id,'over',S.over,'days',S.di);
