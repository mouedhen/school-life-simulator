"""Touch check (emulated phone with real touch events): a single tap on the faint ink must reveal it
and store the clue; the title-screen blot must also respond to a tap. Not a substitute for a real device."""
import sys
from playwright.sync_api import sync_playwright
from ui_helpers import *
fails = []
def ok(c, m):
    print('ok  ' if c else 'FAIL', m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = launch(p)
    ctx = b.new_context(viewport={'width': 390, 'height': 780}, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.evaluate("()=>localStorage.setItem('sls_prefs',JSON.stringify({tut:1,lang:'en'}))"); pg.reload(); pg.wait_for_timeout(300)
    pg.click('[data-act=enter]'); pg.wait_for_timeout(300)
    blot = pg.query_selector('[data-reveal]')
    ok(blot is not None, 'title blot present')
    if blot:
        blot.tap(); pg.wait_for_timeout(600)
        ok(pg.evaluate("()=>Object.keys(window.__V.clues||{}).length") >= 1, 'tapping the title blot stores a clue')
    pg.click('[data-act=start]'); pg.fill('#pname', 'Sam'); pg.click('[data-act=begin]'); pg.wait_for_timeout(300)
    pg.evaluate("()=>{const c=document.querySelector('#ov [data-act=close]');if(c)c.click()}")
    pg.evaluate(ADV, 1)
    for _ in range(12):
        if not pg.query_selector('#ov'): break
        for sel in ['[data-act=evnext]', '#ov .choice:not(.dis)', '[data-act=close]']:
            e = pg.query_selector(sel)
            if e: e.click(); pg.wait_for_timeout(150); break
    pg.evaluate("()=>{window.__V.clues={}}")
    pg.click('.nav [data-act=tab][data-v=journal]'); pg.wait_for_timeout(600)
    pg.tap('[data-act=jopen]'); pg.wait_for_timeout(900)
    for _ in range(6):
        if pg.query_selector('.pl.fink'): break
        if pg.query_selector('[data-act=jprev]'): pg.evaluate("document.querySelector('[data-act=jprev]').click()"); pg.wait_for_timeout(700)
    pg.wait_for_timeout(1500)
    el = pg.locator('.pl.fink').first; ok(el.count() > 0, 'the real journal shows faint ink')
    before = pg.evaluate("()=>getComputedStyle(document.querySelector('.pl.fink')).color")
    el.tap(timeout=5000); pg.wait_for_timeout(800)
    after = pg.evaluate("()=>getComputedStyle(document.querySelector('.pl.fink')).color")
    ok(before != after, 'one tap reveals the ink')
    ok(pg.evaluate("()=>Object.keys(window.__V.clues||{}).length") >= 1, 'the tap stores the clue')
    ok(not errs, 'no page errors ' + str(errs[:2]))
    b.close()
sys.exit(1 if fails else 0)
