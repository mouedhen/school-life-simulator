"""People tab and shop (browser): the circle grows with events, the 4 sort orders, new-contact banner, locked event items,
icons in the shop, and French. Usage: python3 tests/people_shop.py [en|fr]"""
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
    pg.evaluate(TOFREE)
    n0 = pg.evaluate("()=>Object.keys(__S().met).length")
    pg.evaluate("()=>{window.__nb=0;new MutationObserver(()=>{if(document.querySelector('.newface'))window.__nb=1}).observe(document.body,{childList:true,subtree:true})}")
    banner = False
    for i in range(30):                      # play day by day and look for the new-contact banner
        pg.evaluate("()=>{const b=document.querySelector('[data-act=openev]');if(b)b.click()}"); pg.wait_for_timeout(120)
        pg.evaluate(ADV, 1); pg.evaluate(TOFREE)
    banner = pg.evaluate('()=>window.__nb===1')
    ok(banner, 'a "new contact" banner shows when someone is introduced')
    n1 = pg.evaluate("()=>Object.keys(__S().met).length"); ok(n1 >= n0 + 5, 'the circle grows: %d -> %d people after ~30 days' % (n0, n1))
    pg.click('[data-act=tab][data-v=people]'); pg.wait_for_timeout(250)
    ok(pg.evaluate("()=>document.querySelectorAll('.person').length") == n1, 'People tab lists exactly the people you have met')
    ok(pg.evaluate("()=>/40/.test(document.body.innerText)"), 'a note says how many people you know out of 40')
    ok(pg.evaluate("()=>document.querySelectorAll('.sortseg button').length") == 5, 'five sort buttons')
    ok(pg.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+1"), 'sort buttons do not cause sideways scroll')
    # give distinct relationships so the order is checkable
    pg.evaluate("()=>{const S=__S();Object.keys(S.met).forEach((n,i)=>{if(!['Mom','Dad'].includes(n))S.rel[n]=(i*7)%61-30})}")
    def order(k):
        pg.click('[data-act=sort][data-v=%s]' % k); pg.wait_for_timeout(200)
        return pg.evaluate("()=>[...document.querySelectorAll('.person')].map(e=>e.dataset.v)")
    rel = pg.evaluate("()=>__S().rel"); pop = pg.evaluate("()=>Object.fromEntries(Engine.D.chars.map(c=>[c.n,c.pop]))")
    best = order('best'); ok(all(rel[a] >= rel[b2] for a, b2 in zip(best, best[1:])), 'best relationship first')
    worst = order('worst'); ok(all(rel[a] <= rel[b2] for a, b2 in zip(worst, worst[1:])), 'worst relationship first')
    mp = order('pop'); kp = [pop[n] for n in mp if pop[n] is not None]; ok(kp == sorted(kp, reverse=True) and all(pop[n] is None for n in mp[len(kp):]), 'most popular first (family and teachers last)')
    lp = order('unpop'); kq = [pop[n] for n in lp if pop[n] is not None]; ok(kq == sorted(kq) and all(pop[n] is None for n in lp[len(kq):]), 'least popular first (family and teachers last)')
    pg.click('[data-act=filter][data-v=kid]'); pg.wait_for_timeout(200)
    ok(pg.evaluate("()=>document.querySelectorAll('.person').length") < n1, 'sort works together with the Classmates filter')
    # shop
    pg.click('[data-act=tab][data-v=shop]'); pg.wait_for_timeout(250)
    ok(pg.evaluate("()=>document.querySelectorAll('.card.item .ico').length")  >= 30, 'every shop item has an icon')
    pg.evaluate("()=>{delete __S().flags.CLUB_MEMBER}"); pg.click('[data-act=tab][data-v=work]'); pg.click('[data-act=tab][data-v=shop]'); pg.wait_for_timeout(200)
    exp = pg.evaluate("()=>Engine.SHOP.filter(it=>it.flag&&!__S().flags[it.flag]).length"); nl = pg.evaluate("()=>document.querySelectorAll('.card.item.locked').length")
    ok(nl == exp and 1 <= nl <= 14, 'locked items match the event flags not yet earned (%d of 14)' % nl)
    ok(pg.evaluate("()=>[...document.querySelectorAll('.card.item.locked')].every(e=>!/Badge|badge|Scarf|Écharpe/.test(e.innerText))"), 'locked items hide their names')
    pg.evaluate("()=>{const S=__S();S.flags.CLUB_MEMBER=1;S.money=60}"); pg.click('[data-act=tab][data-v=work]'); pg.click('[data-act=tab][data-v=shop]'); pg.wait_for_timeout(250)
    ok(pg.evaluate("()=>document.querySelectorAll('.card.item.locked').length") == nl - 1, 'an event flag unlocks an item in the shop')
    pg.evaluate("()=>{const b=[...document.querySelectorAll('.grid2 .card.item')].find(e=>/Club badge|Badge de club/.test(e.innerText));b.querySelector('[data-act=buy]').click()}"); pg.wait_for_timeout(250)
    ok(pg.evaluate("()=>__S().inv['Club badge']===1"), 'the unlocked item can be bought')
    ok(pg.evaluate("()=>/🏅/.test(document.querySelector('.ib').innerText)"), 'the bag shows the item icon')
    if lang == 'fr':
        txt = pg.evaluate("()=>document.body.innerText")
        ok("Rejoins un club" in txt or "Se débloque" in txt, 'locked hints are in French')
        ok(not any(w in txt for w in ['Unlocks through', 'Join a club']), 'no English left in the shop')
    ok(not errs, 'no JavaScript errors' + (str(errs[:2]) if errs else ''))
    b.close()
print('ALL PASSED' if not fails else 'FAILED %d' % len(fails)); sys.exit(1 if fails else 0)
