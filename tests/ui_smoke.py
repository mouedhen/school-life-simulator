import sys
from playwright.sync_api import sync_playwright
from ui_helpers import *
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
fails = []
def ok(c, m):
    print('ok  ' if c else 'FAIL', m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = launch(p)
    # title screen: the blot hint is there until the first ink is found
    pg, errs = new_game(b, lang)
    pg.evaluate("()=>{const c=document.querySelector('#ov [data-act=close]');if(c)c.click()}")
    kinds = pg.evaluate(ADV, 120)
    tags = [k.split('|')[0].lower() for k in kinds]
    ok(any(t in ('encounter', 'rencontre') for t in tags), 'NPC encounters appear in 120 days')
    # ink in the journal: inject page 1, hover reveals and persists
    pg.evaluate("()=>{const d=document.createElement('div');d.id='tst';d.style.cssText='position:fixed;top:0;left:0;z-index:99999;background:#fff;color:#000;padding:20px;width:300px';d.innerHTML=window.__dbg.jPageHtml(0);document.body.appendChild(d)}")
    el = pg.query_selector('#tst .pl.fink'); ok(el is not None, 'journal page 1 has faint ink')
    ok(pg.query_selector('#tst .blot') is not None, 'the ink blot hint is shown before any ink is found')
    before = pg.evaluate("()=>getComputedStyle(document.querySelector('#tst .pl.fink')).color")
    el.dispatch_event('mouseover'); pg.wait_for_timeout(800)
    after = pg.evaluate("()=>getComputedStyle(document.querySelector('#tst .pl.fink')).color")
    ok(before != after, 'hovering reveals the ink')
    ok(pg.evaluate("()=>Object.keys(window.__V.clues).length") == 1, 'the clue is stored')
    ok((pg.evaluate("()=>window.__S().strange") or 0) >= 1, 'finding a clue makes MC act strangely')
    pg.evaluate("()=>{window.__S().strange=1; window.__S().noticed=0}")
    kinds = pg.evaluate(ADV, 8)
    ok(any(('remarque' in k.lower()) or ('notices' in k.lower()) for k in kinds), 'a family member notices')
    # reveal at 9 clues
    pg.evaluate("()=>{window.__V.clues={k0:1,k1:1,k2:1,k3:1,k4:1,k5:1,k6:1,k7:1,'n:a':1,'n:b':1,'n:c':1,'n:d':1,'n:e':1}}")
    pg.evaluate("document.querySelector('[data-act=tab][data-v=shop]').click()"); pg.wait_for_timeout(150)
    kinds = pg.evaluate(ADV, 4)
    ok(any(('page gets thin' in k.lower()) or ('amincit' in k.lower()) for k in kinds), 'the reveal scene plays')
    ok(pg.evaluate("()=>window.__V.revealed") == 1, 'ink stays visible after the reveal')
    for name in ['help', 'settings', 'stats']:
        pg.evaluate("document.querySelector('[data-act=tab][data-v=menu]').click()"); pg.wait_for_timeout(150)
        pg.evaluate("n=>{const b=document.querySelector('[data-act='+n+']');if(b)b.click()}", name); pg.wait_for_timeout(450)
        ok(pg.evaluate("()=>document.querySelectorAll('#ov .fink').length") >= 1, name + ' has its faint line')
        pg.evaluate("()=>{const c=document.querySelector('#ov [data-act=close]');if(c)c.click()}")
    ok(not errs, 'no page errors ' + str(errs[:2]))
print('FAILED: ' + str(len(fails)) if fails else 'ALL PASSED'); sys.exit(1 if fails else 0)
