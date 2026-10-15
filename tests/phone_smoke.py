"""Phone check (browser): chat list, unread badge, texting costs no time block, the 4-text daily cap,
quick replies to incoming texts, the unknown-number thread (faint ink clues), and the People profile
showing a Text button instead of the replaced options. Usage: python3 tests/phone_smoke.py [en|fr]"""
import sys
from playwright.sync_api import sync_playwright
from ui_helpers import *
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
fails = []
def ok(c, m):
    print('ok  ' if c else 'FAIL', m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = launch(p); pg, errs = new_game(b, lang)
    pg.evaluate(TOFREE); pg.evaluate(ADV, 5); pg.evaluate(TOFREE)
    ok(pg.evaluate("()=>!document.querySelector('#ov')"), 'back to the free phase')
    ok(pg.query_selector('.hud [data-act=phone]') is not None, 'phone button in the header')
    ok(pg.evaluate("()=>__S().di")>=3, 'day 4+ reached')
    pg.evaluate("()=>{const S=__S();for(let k=1;k<500;k++){S.seed=k;if(!Engine.phoneOff(S))break}}")
    pg.click('.hud [data-act=phone]'); pg.wait_for_timeout(300)
    ok(pg.query_selector('#ov [data-act=phopen][data-v="?"]') is not None, 'unknown number appears from day 4')
    ok(pg.query_selector('#ov .phbadge') is not None, 'unread badge on the list')
    # unknown thread: tap the faint ink
    pg.click('#ov [data-act=phopen][data-v="?"]'); pg.wait_for_timeout(300)
    el = pg.query_selector('#ov .fink'); ok(el is not None, 'unknown number has faint ink')
    n0 = pg.evaluate("()=>Object.keys(__V.clues||{}).length"); el.dispatch_event('mouseover'); pg.wait_for_timeout(500)
    ok(pg.evaluate("()=>Object.keys(__V.clues||{}).length") == n0 + 1, 'ink in the phone stores a clue')
    pg.click('#ov [data-act=phback]'); pg.wait_for_timeout(200)
    # a normal chat
    pg.evaluate("()=>{const S=__S();S.rel['Maya Bennett']=30}")
    pg.click('#ov [data-act=phopen][data-v="Maya Bennett"]'); pg.wait_for_timeout(300)
    blocks = pg.evaluate("()=>__S().blocks")
    pg.click('#ov [data-act=phact]:not(.dis) >> nth=0'); pg.wait_for_timeout(300)
    ok(pg.evaluate("()=>__S().blocks") == blocks, 'texting costs no time block')
    ok(pg.evaluate("()=>document.querySelectorAll('#ov .bub.me').length") == 1 and pg.evaluate("()=>document.querySelectorAll('#ov .bub.them').length") >= 1, 'my text and their reply appear')
    for i in range(4):
        pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=phact]:not(.dis)');if(b)b.click()}"); pg.wait_for_timeout(150)
    ok(pg.evaluate("()=>__S().today.ph") == 4, 'the daily cap stops at 4 texts')
    ok(pg.evaluate("()=>document.querySelectorAll('#ov [data-act=phact]:not(.dis)').length") == 0, 'every action is locked at the cap')
    # incoming text with quick replies
    pg.evaluate("()=>{const S=__S();const P=Engine?0:0}") if False else None
    pg.evaluate("""()=>{const S=__S();S.phone.th['Maya Bennett'].push({f:'them',t:'Hey, how was your day?',q:[['Pretty good, you?','r:T+3'],['Tired, but fine','r:T+1']],id:S.di});S.phone.un['Maya Bennett']=1}""")
    pg.click('#ov [data-act=phback]'); pg.click('#ov [data-act=phopen][data-v="Maya Bennett"]'); pg.wait_for_timeout(300)
    r0 = pg.evaluate("()=>__S().rel['Maya Bennett']")
    pg.click('#ov [data-act=phreply][data-v="0"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("()=>__S().rel['Maya Bennett']") > r0, 'a quick reply changes the relationship')
    ok(pg.query_selector('#ov [data-act=phreply]') is None, 'the quick replies disappear once answered')
    # profile
    pg.click('#ov .close'); pg.wait_for_timeout(200)
    pg.evaluate("()=>{document.querySelector('.nav [data-act=tab][data-v=people]').click()}"); pg.wait_for_timeout(200)
    pg.click('.person >> nth=0'); pg.wait_for_timeout(300)
    inter = pg.evaluate("()=>[...document.querySelectorAll('#ov [data-act=inter]')].map(e=>e.dataset.v)")
    ok('talk' not in inter and 'compliment' not in inter, 'profile no longer lists the replaced options')
    ok(pg.query_selector('#ov [data-act=phtext]') is not None and 'hangout' in inter, 'profile has a Text button and keeps in-person options')
    ok(not errs, 'no page errors ' + str(errs[:2]))
    b.close()
sys.exit(1 if fails else 0)
