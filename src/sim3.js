require('./data.js'); require('./talk.js'); const E=require('./engine.js');
function hermit(seed){const S=E.newGame(seed);let g=0;
 while(!S.over&&S.phase!=='ending'&&g++<5000){
  if(S.phase==='event'){const ev=E.buildEvent(S);const ok=ev.choices.map((c,i)=>i).filter(i=>!ev.choices[i].disabled);
   const cost=c=>(c.fx||[]).length;const sc=j=>{const c=ev.choices[j];return (c.fx||[]).concat(c.pass||[],c.win||[]).reduce((a,f)=>a+(f.t==='rel'&&f.v>0?f.v:0)+(f.t==='flag'&&/KIND|INCLUD|SPACE|HELP|STOOD|STEPPED|STOPPED|ENCOUR|QUIET|EARTH|TEAMWORK/.test(f.f)?9:0),0)+(c.sp==='academic'?-1:0)};let i=ok.slice().sort((a,b)=>sc(a)-sc(b))[0];
   E.choose(S,i,undefined);}
  else if(S.phase==='free'){while(S.blocks>0){const r=E.study(S);if(r&&r.err)break;}E.endDay(S);}else break;}
 return S;}
const res={};for(let s=1;s<=60;s++){const S=hermit(s);const id=S.over?'OVER':S.ending.id;res[id]=(res[id]||0)+1;if(s<4&&!S.over){const x=E.stats(S);console.log(S.grade,x.cnt(v=>v>10),x.kind,S.freeActs,S.ending.id)}}
console.log(res);
