"""Records a scripted tour of the game (phone-size video). Usage: python3 demo/make_demo.py [en|fr] ; output demo/out/demo-<lang>.mp4
SLS_URL overrides the page (default: dist/index.html)."""
import os, sys, pathlib, json, subprocess, glob
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = os.environ.get('SLS_URL') or 'file://' + str(ROOT / 'dist' / 'index.html')
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
OUT = ROOT / 'demo' / 'out'; OUT.mkdir(exist_ok=True)
W, H = 420, 820
FX = """()=>{const d=document.createElement('div');d.style.cssText='position:fixed;z-index:99999;width:26px;height:26px;border-radius:50%;border:3px solid #ff5a7a;background:rgba(255,90,122,.25);pointer-events:none;transform:translate(-50%,-50%) scale(.4);opacity:0;transition:transform .35s,opacity .35s';document.body.appendChild(d);
document.addEventListener('click',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';d.style.transition='none';d.style.transform='translate(-50%,-50%) scale(.4)';d.style.opacity='1';requestAnimationFrame(()=>requestAnimationFrame(()=>{d.style.transition='transform .35s,opacity .45s';d.style.transform='translate(-50%,-50%) scale(1.5)';d.style.opacity='0'}))},true)}"""
STEP = """()=>{const q=x=>document.querySelector(x),qa=x=>[...document.querySelectorAll(x)];const rd=a=>a[Math.floor(Math.random()*a.length)];
 if(q('#ov')){let b;if(b=q('[data-act=evnext]')){b.click();return 'next'}if(b=q('[data-act=presback]')){b.click();return 'x'}
  if(b=q('[data-act=mgfinish]')){b.click();return 'x'}if(b=q('[data-act=mgnext]')){b.click();return 'x'}
  let ma=qa('[data-act=mgans]');if(ma.length){rd(ma).click();return 'quiz'}let mf=qa('[data-act=mgflip]');if(mf.length){const s=q('[data-act=mgskip]');if(s)s.click();else rd(mf).click();return 'x'}
  let ch=qa('#ov .choice:not(.dis)');if(ch.length){rd(ch).click();return 'choice'}
  ch=qa('#ov [data-act=go]:not([disabled])');if(ch.length){rd(ch).click();return 'x'}
  if(b=q('[data-act=evgift]')){b.click();return 'x'}if(b=q('[data-act=subback]')){b.click();return 'x'}if(b=q('[data-act=evback]')){b.click();return 'x'}
  q('#ov [data-act=close]').click();return 'x'}
 return 'free'}"""
def clear(pg, pause=650, cap=60):
    for _ in range(cap):
        r = pg.evaluate(STEP)
        if r == 'free': return
        pg.wait_for_timeout(pause)
with sync_playwright() as p:
    exe = os.environ.get('CHROMIUM')
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox']) if exe else p.chromium.launch(args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, record_video_dir=str(OUT / 'raw'), record_video_size={'width': W, 'height': H}, has_touch=False)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.evaluate("p=>localStorage.setItem('sls_prefs',JSON.stringify(p))", {'tut': 1, 'lang': lang}); pg.reload(); pg.evaluate(FX)
    w = pg.wait_for_timeout
    w(1800)                                            # title gate
    pg.click('[data-act=enter]'); w(1400)
    pg.click('[data-act=start]'); w(1200)
    pg.type('#pname', 'Sam', delay=160); w(700)
    pg.click('[data-act=begin]'); w(2200)              # day 1
    clear(pg, 800, 30); w(900)
    for i in range(3):                                 # a few days at a readable pace
        pg.evaluate("()=>{const b=document.querySelector('[data-act=endday]');if(b)b.click()}"); w(900); clear(pg, 800, 40)
    w(600)
    pg.click('[data-act=tab][data-v=people]'); w(1600)
    for k in ('pop', 'best', 'worst'):
        pg.click('[data-act=sort][data-v=%s]' % k); w(1300)
    pg.click('[data-act=sort][data-v=def]'); w(500)
    pg.evaluate("()=>{const b=document.querySelector('[data-act=person]');if(b)b.click()}"); w(2200)
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=close]')||document.querySelector('[data-act=close]');if(b)b.click()}"); w(700)
    pg.click('[data-act=tab][data-v=shop]'); w(1800)
    pg.mouse.wheel(0, 900); w(1800)
    pg.click('[data-act=tab][data-v=work]'); w(1500)
    pg.click('[data-act=tab][data-v=journal]'); w(1500)
    pg.evaluate("()=>{const b=document.querySelector('[data-act=jopen]');if(b)b.click()}"); w(2500)
    pg.evaluate("()=>{const b=document.querySelector('[data-act=jclose]');if(b)b.click()}"); w(800)
    pg.click('[data-act=tab][data-v=today]'); w(900)
    # play on to day 5 so the unknown number exists, then the phone
    for i in range(3):
        pg.evaluate("()=>{const b=document.querySelector('[data-act=endday]');if(b)b.click()}"); w(500); clear(pg, 600, 40)
    pg.evaluate("()=>{const S=__S();for(let k=1;k<500;k++){S.seed=k;if(!Engine.phoneOff(S))break}}")
    pg.click('.hud [data-act=phone]'); w(1800)
    pg.evaluate("()=>{const S=__S();S.rel['Maya Bennett']=Math.max(S.rel['Maya Bennett']||0,30)}")
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=phopen]:not([data-v=\"?\"])');if(b)b.click()}"); w(1500)
    for i in range(3):
        pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=phact]:not(.dis)');if(b)b.click()}"); w(1700)
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=phback]');if(b)b.click()}"); w(1000)
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=phopen][data-v=\"?\"]');if(b)b.click()}"); w(1800)
    pg.evaluate("()=>{const e=document.querySelector('#ov .fink');if(e){e.dispatchEvent(new Event('mouseover'))}}"); w(2600)
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=phback]');if(b)b.click()}"); w(900)
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=phgames]');if(b)b.click()}"); w(1800)
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=pgstart]');if(b)b.click()}"); w(1800)
    for i in range(5):
        pg.evaluate("()=>{const a=[...document.querySelectorAll('#ov [data-act=pgans]')];if(a.length)a[0].click()}"); w(1400)
    pg.evaluate(STEP); w(1200)
    pg.evaluate("()=>{const b=document.querySelector('#ov [data-act=close]');if(b)b.click()}"); w(600)
    clear(pg, 300, 10)
    pg.evaluate("()=>{const b=document.querySelector('[data-act=lang]');if(b)b.click()}"); w(2600)
    path = pg.video.path(); ctx.close(); b.close()
mp4 = OUT / f'demo-{lang}.mp4'
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-vf', 'scale=iw*2:ih*2:flags=lanczos', str(mp4)], check=True)
for f in glob.glob(str(OUT / 'raw' / '*.webm')): os.remove(f)
print('wrote', mp4, 'JS errors:', errs or 'none')
