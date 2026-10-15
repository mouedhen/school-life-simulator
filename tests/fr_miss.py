import json, subprocess, sys, pathlib
from playwright.sync_api import sync_playwright
from ui_helpers import *
ROOT = pathlib.Path(__file__).resolve().parent.parent
js = r'''
const path=require('path');const R=p=>path.join(process.argv[1],'src',p);require(R('data.js'));require(R('talk.js'));const E=require(R('engine.js'));
const out=new Set();const add=x=>{if(x)out.add(String(x))};const h=ev=>{add(ev.title);add(ev.desc);ev.choices.forEach(c=>{add(c.x);add(c.say);add(c.why)})};
const acts=['compliment','gift','kind','invite','gossip','apology','echo','advice','borrow','praise'];
const people=E.KIDS.slice(0,8).concat(['Mom','Dad','Riley','Max','Oliver','Sophie','Ms. Harper Ellis','Mr. Daniel Brooks']);
for(const w of people)for(const act of acts)for(let d=0;d<3;d++){const S=E.newGame(7+d);S.di=10+d*3;S.rel[w]=80;S.money=50;S.pend={kind:'npc',who:w,act};const ev=E.buildEvent(S);if(ev)h(ev)}
for(let l=0;l<4;l++){const S=E.newGame(5);S.pend={kind:'notice',who:'Riley',lvl:l};h(E.buildEvent(S))}
{const S=E.newGame(5);S.meta={clues:9};S.di=30;S.pend={kind:'special',id:'reveal'};h(E.buildEvent(S))}
for(const t of E.THOUGHTS||[])t.forEach(add);
for(let seed=1;seed<=40;seed++){const S=E.newGame(seed);S.meta={clues:seed%12};let g=0;const r=E.mul(seed*3);while(!S.over&&S.phase!=='ending'&&g++<3000){if(S.phase==='event'){const ev=E.buildEvent(S);if(ev.kind==='npc'||ev.kind==='notice')h(ev);const ok=ev.choices.map((c,i)=>i).filter(i=>!ev.choices[i].disabled);const res=E.choose(S,ok[Math.floor(r()*ok.length)]);if(res){if(ev.kind==='npc'||ev.kind==='notice')(res.lines||[]).forEach(add);if(res.thought)add(res.thought)}}else if(S.phase==='free')E.endDay(S);else break}}
console.log(JSON.stringify([...out]));
'''
strs = json.loads(subprocess.check_output(['node', '-e', js, str(ROOT)]).decode())
with sync_playwright() as p:
    b = launch(p); pg = b.new_page(); pg.goto(URL); pg.wait_for_timeout(500)
    pg.evaluate("I18N.force=true;I18N.clear()")
    miss = pg.evaluate("a=>{a.forEach(s=>I18N.tr(s));return [...I18N.miss]}", strs)
print(len(strs), 'strings checked;', len(miss), 'missing')
for m in miss: print('  ', m)
sys.exit(1 if miss else 0)
