import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = os.environ.get('SLS_URL') or 'file://' + str(ROOT / 'dist' / 'index.html')

def launch(p):
    exe = os.environ.get('CHROMIUM')
    return p.chromium.launch(executable_path=exe, args=['--no-sandbox']) if exe else p.chromium.launch(args=['--no-sandbox'])

def new_game(b, lang='en', prefs=None, w=420, h=820):
    import json
    pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.goto(URL); pr = {'tut': 1, 'lang': lang}; pr.update(prefs or {})
    pg.evaluate("p=>localStorage.setItem('sls_prefs',JSON.stringify(p))", pr); pg.reload(); pg.wait_for_timeout(300)
    pg.click('[data-act=enter]'); pg.click('[data-act=start]'); pg.fill('#pname', 'Sam'); pg.click('[data-act=begin]'); pg.wait_for_timeout(300)
    return pg, errs

# plays N days with a random bot; returns the distinct event "TAG|title" strings it met
ADV = '''(n)=>{const q=x=>document.querySelector(x),qa=x=>[...document.querySelectorAll(x)];const rd=a=>a[Math.floor(Math.random()*a.length)];let days=0,kinds=[];
 for(let st=0;st<6000&&days<n;st++){
  if(q('#ov')){let b;if(b=q('[data-act=evnext]')){b.click();continue}if(b=q('[data-act=presback]')){b.click();continue}
   const t=q('#ov h2'),tag=q('#ov .tag');if(t&&tag){const k=tag.innerText+'|'+t.innerText;if(kinds[kinds.length-1]!==k)kinds.push(k)}
   let b2;if(b2=q('[data-act=mgfinish]')){b2.click();continue}if(b2=q('[data-act=mgnext]')){b2.click();continue}
   let ma=qa('[data-act=mgans]');if(ma.length){rd(ma).click();continue}let mf=qa('[data-act=mgflip]');if(mf.length){const s=q('[data-act=mgskip]');if(s)s.click();else rd(mf).click();continue}
   let ch=qa('#ov .choice:not(.dis)');if(ch.length){rd(ch).click();continue}
   ch=qa('#ov [data-act=go]:not([disabled])');if(ch.length){rd(ch).click();continue}
   if(b=q('[data-act=evgift]')){b.click();continue}if(b=q('[data-act=subback]')){b.click();continue}if(b=q('[data-act=evback]')){b.click();continue}
   q('#ov [data-act=close]').click();continue}
  if(!q('.nav'))break;let b;if(b=q('[data-act=openev]')){b.click();continue}
  if(b=q('[data-act=endday]')){b.click();days++;continue}q('[data-act=tab][data-v=today]').click();}
 return kinds}'''

TOFREE = '''()=>{const q=x=>document.querySelector(x),qa=x=>[...document.querySelectorAll(x)];const rd=a=>a[Math.floor(Math.random()*a.length)];let days=0,kinds=[];
 for(let st=0;st<600;st++){
  if(!q('#ov'))return true;
  if(q('#ov')){let b;if(b=q('[data-act=evnext]')){b.click();continue}if(b=q('[data-act=presback]')){b.click();continue}
   const t=q('#ov h2'),tag=q('#ov .tag');if(t&&tag){const k=tag.innerText+'|'+t.innerText;if(kinds[kinds.length-1]!==k)kinds.push(k)}
   let b2;if(b2=q('[data-act=mgfinish]')){b2.click();continue}if(b2=q('[data-act=mgnext]')){b2.click();continue}
   let ma=qa('[data-act=mgans]');if(ma.length){rd(ma).click();continue}let mf=qa('[data-act=mgflip]');if(mf.length){const s=q('[data-act=mgskip]');if(s)s.click();else rd(mf).click();continue}
   let ch=qa('#ov .choice:not(.dis)');if(ch.length){rd(ch).click();continue}
   ch=qa('#ov [data-act=go]:not([disabled])');if(ch.length){rd(ch).click();continue}
   if(b=q('[data-act=evgift]')){b.click();continue}if(b=q('[data-act=subback]')){b.click();continue}if(b=q('[data-act=evback]')){b.click();continue}
   q('#ov [data-act=close]').click();continue}
 }
 return false}'''
