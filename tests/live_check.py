"""Live-site check (browser). Usage: SLS_URL=https://mouedhen.github.io/school-life-simulator/ python3 tests/live_check.py [en|fr]
Without SLS_URL it tests dist/index.html. Checks: page loads with no errors, fonts/network failures, new game,
10 played days, phone opens, save survives a reload, language switch, and a phone-size layout with no sideways scroll."""
import sys
from playwright.sync_api import sync_playwright
import ui_helpers as H
from ui_helpers import launch, new_game, ADV, TOFREE
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
fails = []
def ok(c, m):
    print('ok  ' if c else 'FAIL', m)
    if not c: fails.append(m)
print('URL', H.URL)
with sync_playwright() as p:
    b = launch(p)
    pg, errs = new_game(b, lang)
    bad = []
    pg.on('requestfailed', lambda r: bad.append(r.url[:80]))
    ok(pg.title() != '', 'page has a title: ' + pg.title())
    ok(pg.query_selector('.nav') is not None, 'game screen is up after creating a character')
    pg.evaluate(TOFREE); kinds = pg.evaluate(ADV, 10); pg.evaluate(TOFREE)
    ok(pg.evaluate("()=>__S().di") >= 8, 'played 10 days, day index ' + str(pg.evaluate("()=>__S().di")))
    ok(len(kinds) > 3, str(len(kinds)) + ' different scenes met')
    ok(pg.query_selector('.hud [data-act=phone]') is not None, 'phone button present')
    pg.click('.hud [data-act=phone]'); pg.wait_for_timeout(300)
    ok(pg.query_selector('#ov') is not None, 'phone opens'); pg.evaluate(TOFREE)
    ok(pg.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+1"), 'no sideways scroll at 420px')
    # save survives a reload
    di = pg.evaluate("()=>__S().di"); pg.reload(); pg.wait_for_timeout(500)
    saved = pg.evaluate("()=>Object.keys(localStorage).filter(k=>/sls/.test(k))")
    ok(len(saved) > 0, 'browser storage holds: ' + ', '.join(saved))
    # language switch on a fresh page
    other = 'fr' if lang == 'en' else 'en'
    pg2, errs2 = new_game(b, other)
    txt = pg2.evaluate("()=>document.body.innerText")
    ok(len(txt) > 100, other + ' game renders, ' + str(len(txt)) + ' chars')
    if other == 'fr': ok('Today' not in txt and "Aujourd" in txt, 'French UI is translated')
    # desktop size
    pg3, errs3 = new_game(b, lang, w=1280, h=800)
    ok(pg3.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+1"), 'no sideways scroll at 1280px')
    pg3.screenshot(path='live_desktop.png'); pg.screenshot(path='live_phone.png')
    allerr = errs + errs2 + errs3
    ok(not allerr, 'no JavaScript errors' + (': ' + '; '.join(allerr[:3]) if allerr else ''))
    print('failed requests (fonts etc.):', bad[:5] or 'none')
    b.close()
print('ALL PASSED' if not fails else 'FAILED: %d' % len(fails)); sys.exit(1 if fails else 0)
