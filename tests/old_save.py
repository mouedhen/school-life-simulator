"""Old-save check: builds a mid-year save, strips every field added by the NPC-acts / mystery work
(meta, follow, giftFrom, strange, noticed, note ...), loads it through the real UI ('Continue')
and plays on to an ending. Fails on any page error or if no ending is reached."""
import json, subprocess, sys, pathlib
from ui_helpers import launch, URL, ADV
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
NEW = ['meta', 'follow', 'giftFrom', 'strange', 'noticed', 'note', 'th', 'recon', 'secretDone', 'met', 'order', 'nextIntro', 'introDay', 'introWho']
js = r'''
require('./src/data.js'); const E=require('./src/engine.js'); const S=E.newGame(7); const rnd=E.mul(3);let g=0;
while(!S.over&&S.phase!=='ending'&&S.di<60&&g++<4000){
 if(S.phase==='event'){const ev=E.buildEvent(S);E.choose(S,ev.choices.findIndex(c=>!c.disabled));}
 else{while(S.blocks>0){const k=E.KIDS;const nm=k[Math.floor(rnd()*30)];const l=E.interactionList(S,nm).filter(x=>x.ok&&x.cost>0&&['talk','hangout','study'].includes(x.id));if(!l.length)break;const r=E.interact(S,nm,l[Math.floor(rnd()*l.length)].id,'school');if(r&&r.err)break;}E.endDay(S);}
}
const drop=%s;drop.forEach(k=>delete S[k]);S.log=S.log||[];
process.stdout.write(JSON.stringify(S));''' % json.dumps(NEW)
# data.js assigns `const DATA`; the engine reads it as a global, so run from a temp wrapper
wrapper = "globalThis.DATA=undefined;" 
out = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True)
if out.returncode: print(out.stderr[:800]); sys.exit(1)
S = json.loads(out.stdout); print('built save at day', S['di'] + 1, 'missing fields:', [k for k in NEW if k not in S])
meta = {'date': '2026-11-01', 'pop': S['pop'], 'money': S['money'], 'grade': S['grade']}
bad = 0
for lang in ['en', 'fr']:
    with sync_playwright() as p:
        b = launch(p); pg = b.new_page(viewport={'width': 420, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.goto(URL)
        pg.evaluate("([s,m,l])=>{localStorage.setItem('sls_prefs',JSON.stringify({tut:1,lang:l}));localStorage.setItem('sls_save_auto',JSON.stringify({meta:m,json:s}))}", [json.dumps(S), meta, lang])
        pg.reload(); pg.wait_for_timeout(400); pg.click('[data-act=enter]'); pg.wait_for_timeout(200)
        pg.click('[data-act=continue]'); pg.wait_for_timeout(400)
        ended = False
        for _ in range(60):
            pg.evaluate(ADV, 8)
            if pg.evaluate("!!(window.__S&&(__S().ending||__S().over))"): ended = True; break
        di = pg.evaluate("__S().di"); print(lang, 'continued to day', di + 1, 'ended' if ended else 'NOT ended', 'errors:', errs[:3])
        if errs or not ended: bad = 1
        b.close()
sys.exit(bad)
