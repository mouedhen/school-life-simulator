"""UI snapshot guard for refactors of src/app.js (browser, Playwright).
Plays a fixed, seeded path in EN and FR, visits every tab and the main modals, and stores the HTML of
#root and #ov for each screen. Math.random is replaced by a seeded generator and web fonts are blocked,
so two runs of the same app.js give the same HTML.
Usage:  python tests/ui_snapshot.py record   -> writes tests/ui_snapshot.json
        python tests/ui_snapshot.py          -> compares with tests/ui_snapshot.json, prints the first difference"""
import sys, json, pathlib, difflib
from playwright.sync_api import sync_playwright
from ui_helpers import URL, launch, ADV, TOFREE

SNAP = pathlib.Path(__file__).resolve().parent / 'ui_snapshot.json'
RECORD = len(sys.argv) > 1 and sys.argv[1] == 'record'

# seeded Math.random (mulberry32), installed before any page script runs
SEEDED = '''(()=>{let a=12345;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};})();'''
GRAB = "()=>({miss:window.__miss||'',root:(document.getElementById('root')||{}).innerHTML||'',ov:(document.getElementById('ov')||{}).innerHTML||''})"


def run(b, lang):
    shots = []
    ctx = b.new_context(viewport={'width': 420, 'height': 820})
    ctx.add_init_script(SEEDED)
    ctx.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    def shot(name, wait=150):
        pg.wait_for_timeout(wait)
        s = pg.evaluate(GRAB); s['name'] = lang + ':' + name; shots.append(s)

    def click(sel, wait=150):
        pg.click(sel); pg.wait_for_timeout(wait)

    def act(a, v=None, wait=150):  # click a data-act button through the DOM (works for hidden/overlay buttons too)
        sel = '[data-act=%s]' % a + ('[data-v="%s"]' % v if v is not None else '')
        pg.evaluate("s=>{const b=document.querySelector('#ov '+s)||document.querySelector(s);if(b)b.click();else window.__miss=(window.__miss||'')+s+';'}", sel)
        pg.wait_for_timeout(wait)

    pg.goto(URL)
    pg.evaluate("p=>localStorage.setItem('sls_prefs',JSON.stringify(p))", {'tut': 1, 'lang': lang, 'muted': True})
    pg.reload(); pg.wait_for_timeout(400)
    shot('login')
    click('[data-act=enter]'); shot('title')
    act('settings'); shot('settings-title'); act('close')
    click('[data-act=start]'); shot('newgame')
    act('trait', 'sch'); shot('trait-sch'); act('trait', 'bal')
    pg.fill('#pname', 'Sam'); click('[data-act=begin]', 300); shot('event1')
    pg.evaluate("()=>document.querySelector('#ov .choice:not(.dis)').click()"); shot('result1')
    pg.evaluate(TOFREE); shot('free1')
    # tabs
    for tab in ['people', 'shop', 'work', 'cal', 'journal', 'menu', 'today']:
        act('tab', tab, 200); shot('tab-' + tab)
    act('tab', 'people'); act('sort', 'best'); shot('people-best'); act('filter', 'kid'); shot('people-kid')
    act('sort', 'def'); act('filter', 'all')
    first = pg.evaluate("()=>document.querySelector('.person').dataset.v")
    act('person', first); shot('profile')
    act('inter', 'hangout'); shot('sub-hangout')
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=go]');if(b)b.click()}"); shot('hangout-result'); act('presback')
    for x in ['gift', 'lend', 'share', 'investigate', 'fight', 'apologize']:
        act('inter', x); shot('sub-' + x); act('subback')
    act('inter', 'talkabout'); shot('sub-about')
    pg.evaluate("()=>document.querySelector('#ov [data-act=aboutpick]').click()"); shot('sub-about-pick'); act('subback')
    act('close')
    act('tab', 'work'); act('bond', 'Dad'); shot('bond-dad')
    pg.evaluate("()=>{const b=document.querySelector('#ov .choice:not(.dis)');if(b)b.click()}"); shot('bond-result'); act('close')
    pg.evaluate("()=>{const b=document.querySelector('[data-act=cook]:not([disabled])');if(b)b.click()}"); pg.wait_for_timeout(150); shot('cook')
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=cookfor]');if(b)b.click()}"); shot('cook-result'); act('close')
    act('tab', 'cal'); act('calm', '3'); shot('cal-nov')
    act('tab', 'journal'); act('jopen', wait=1200); shot('journal-open'); act('jprev', wait=1200); shot('journal-prev'); act('jclose')
    act('tab', 'menu')
    for m in ['settings', 'help', 'stats', 'endbook', 'saves', 'summary', 'newgame']:
        act(m, wait=300); shot('modal-' + m); act('close')
    act('help'); act('tutopen'); shot('tut1'); act('tutnext'); shot('tut2'); act('tutskip', wait=300)
    act('theme', wait=300); shot('theme-light'); act('theme', wait=200); act('theme', wait=200)
    # a few days, then the phone
    for _ in range(5):
        pg.evaluate("()=>{const b=document.querySelector('[data-act=openev]');if(b)b.click()}"); pg.wait_for_timeout(100)
        pg.evaluate(ADV, 1); pg.evaluate(TOFREE)
    pg.wait_for_timeout(600); shot('day6')
    act('phone'); shot('phone')
    act('phopen', first); shot('phone-thread')
    act('phback'); act('phopen', '#class'); shot('phone-class')
    act('phback'); act('phopen', '?'); shot('phone-unknown')
    act('phback'); act('phgames'); shot('phone-games')
    act('pgstart', 'emoji'); shot('pg-emoji')
    act('close')
    act('tab', 'people'); act('person', first); shot('profile-day6'); act('close'); act('tab', 'today')
    # the rest of the year
    pg.evaluate(ADV, 400); pg.wait_for_timeout(2500)
    shot('end')
    if pg.evaluate("()=>!!document.querySelector('[data-act=readj]')"):
        act('readj', wait=600); shot('end-journal'); act('jprev', wait=1200); shot('end-journal-prev')
        act('jclose', wait=300); shot('end-back')
    act('endbook', wait=400); shot('end-endbook'); act('close')
    # game over screen
    pg.evaluate("()=>{const S=__S();S.over=1;S.ending=null;S.phase='free';__dbg.render()}"); shot('over', 600)
    ctx.close()
    if errs:
        shots.append({'name': lang + ':errors', 'root': '\n'.join(errs), 'ov': ''})
    return shots


with sync_playwright() as p:
    b = launch(p)
    shots = run(b, 'en') + run(b, 'fr')
    b.close()

if RECORD:
    SNAP.write_text(json.dumps(shots, ensure_ascii=False, indent=0), encoding='utf-8')
    print('recorded %d screens to %s' % (len(shots), SNAP.name))
    sys.exit(0)

old = json.loads(SNAP.read_text(encoding='utf-8'))
on = [s['name'] for s in old]; nn = [s['name'] for s in shots]
if on != nn:
    print('DIFF screen list differs:', [x for x in on if x not in nn], [x for x in nn if x not in on], on[:3] if not nn else '')
    for a, c in zip(on, nn):
        if a != c: print('DIFF first mismatch', a, c); break
    sys.exit(1)
for a, c in zip(old, shots):
    for part in ('miss', 'root', 'ov'):
        if a[part] != c[part]:
            print('DIFF in screen', a['name'], part)
            x, y = a[part], c[part]
            i = next((k for k in range(min(len(x), len(y))) if x[k] != y[k]), min(len(x), len(y)))
            print('  old:', repr(x[max(0, i - 150):i + 250]))
            print('  new:', repr(y[max(0, i - 150):i + 250]))
            sys.exit(1)
print('ALL PASSED: %d screens identical' % len(shots))
