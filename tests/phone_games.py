"""Phone extras (browser): group chats, the four minigames, daily limits and no-phone days.
Usage: python3 tests/phone_games.py [en|fr]   (the bubble game takes about 17 s)"""
import sys
from playwright.sync_api import sync_playwright
from ui_helpers import *
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
fails = []
def ok(c, m):
    print('ok  ' if c else 'FAIL', m)
    if not c: fails.append(m)
CORRECT = {
  'reply': "()=>{const g=__V.pg;return g.q[g.i][2]}",
  'who': "()=>{const g=__V.pg;const q=g.q[g.i];return q.opts.indexOf(q.right)}",
  'emoji': "()=>{const g=__V.pg;const q=g.q[g.i];return q.opts.indexOf(q.right)}",
}
with sync_playwright() as p:
    b = launch(p); pg, errs = new_game(b, lang)
    pg.evaluate(TOFREE); pg.evaluate(ADV, 4); pg.evaluate(TOFREE)
    # make sure the phone is on today
    pg.evaluate("()=>{const S=__S();for(let k=1;k<500;k++){S.seed=k;if(!Engine.phoneOff(S))break}}")
    pg.click('.hud [data-act=phone]'); pg.wait_for_timeout(300)
    ok(pg.query_selector('#ov [data-act=phopen][data-v="#class"]') is not None and pg.query_selector('#ov [data-act=phopen][data-v="#fam"]') is not None, 'class and family group chats are listed')
    pg.click('#ov [data-act=phopen][data-v="#class"]'); pg.wait_for_timeout(200)
    pg.click('#ov [data-act=phgact]:not(.dis) >> nth=0'); pg.wait_for_timeout(250)
    ok(pg.evaluate("()=>document.querySelectorAll('#ov .bub.me').length")>=1 and pg.evaluate("()=>document.querySelectorAll('#ov .bub.them .snd').length")>=1, 'posting in the group gets named replies')
    ok(pg.evaluate("()=>__S().today.ph")==1, 'a group post uses one of the 4 daily texts')
    # incoming gossip with quick replies
    pg.evaluate("""()=>{const S=__S();S.phone.th['#class'].push({f:'them',s:'Aria',t:'Did you see this?',q:[['Defend Noah','r:T+5;p-1'],['Stay out of it','r:T+0']],T:'Noah Chen',id:S.di});}""")
    pg.click('#ov [data-act=phback]'); pg.click('#ov [data-act=phopen][data-v="#class"]'); pg.wait_for_timeout(200)
    r0 = pg.evaluate("()=>__S().rel['Noah Chen']"); pg.click('#ov [data-act=phreply][data-v="0"]'); pg.wait_for_timeout(250)
    ok(pg.evaluate("()=>__S().rel['Noah Chen']")>r0, 'defending in the group changes that person\'s relationship')
    pg.click('#ov [data-act=phback]'); pg.click('#ov [data-act=phgames]'); pg.wait_for_timeout(250)
    for gid in ['reply','who','emoji']:
        pg.click('#ov [data-act=pgstart][data-v=%s]'%gid); pg.wait_for_timeout(250)
        for i in range(5):
            k = pg.evaluate(CORRECT[gid]); pg.click('#ov [data-act=pgans][data-v="%d"]'%k); pg.wait_for_timeout(1000)
        ok(pg.evaluate("()=>__V.pg&&__V.pg.done&&__V.pg.res&&__V.pg.res.score")==5, gid+': perfect score is recorded')
        ok(pg.evaluate("()=>!!__S().today['pg_%s']"%gid), gid+': marked as played today')
        pg.click('#ov [data-act=phgames]'); pg.wait_for_timeout(200)
        ok(pg.query_selector('#ov [data-act=pgstart][data-v=%s].dis'%gid) is not None, gid+': locked after playing')
    m0 = pg.evaluate("()=>__S().money")
    pg.click('#ov [data-act=pgstart][data-v=tap]'); pg.wait_for_timeout(2500)
    end = pg.evaluate("()=>Date.now()+16500"); import time; t0=time.time()
    while time.time()-t0 < 16.5:
        pg.evaluate("()=>document.querySelectorAll('#pgarena .bubble:not([data-p])').forEach(b=>b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})))"); pg.wait_for_timeout(250)
    pg.wait_for_timeout(1200)
    sc = pg.evaluate("()=>__V.pg&&__V.pg.done?__V.pg.score:-1"); ok(sc>=8, 'bubble game finished with a score (%d)'%sc)
    # no-phone day
    pg.click('#ov .close'); pg.evaluate("()=>{const S=__S();S.today={};for(let k=1;k<800;k++){S.seed=k;if(Engine.phoneOff(S))break}}")
    ok(pg.evaluate("()=>!!Engine.phoneOff(__S())"), 'found a no-phone day')
    pg.evaluate("()=>{window.render&&0}"); pg.click('.hud [data-act=phone]') if pg.query_selector('.hud [data-act=phone]') else None
    pg.wait_for_timeout(300)
    ok(pg.query_selector('#ov .warn') is not None, 'the phone shows why it is off')
    ok(pg.evaluate("()=>{const S=__S();return Engine.phoneList(S,'Maya Bennett').every(a=>!a.ok)}"), 'every text action is locked')
    pg.click('#ov .close'); pg.evaluate("()=>document.querySelector('.nav [data-act=tab][data-v=people]').click()"); pg.wait_for_timeout(200)
    pg.click('.person >> nth=0'); pg.wait_for_timeout(300)
    inter = pg.evaluate("()=>[...document.querySelectorAll('#ov [data-act=inter]')].map(e=>e.dataset.v)")
    ok('talk' in inter, 'on a no-phone day the in-person Talk option is back')
    ok(not errs, 'no page errors '+str(errs[:2]))
    b.close()
sys.exit(1 if fails else 0)
