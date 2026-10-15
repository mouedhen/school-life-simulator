import sys
from playwright.sync_api import sync_playwright
from ui_helpers import *
lang, a, z = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
JS = '''(seed)=>{let s=seed;const rnd=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};
 const q=x=>document.querySelector(x),qa=x=>[...document.querySelectorAll(x)];const pickr=a=>a[Math.floor(rnd()*a.length)];let steps=0,days=0,errs=[];window.addEventListener('error',e=>errs.push(e.message));
 while(steps++<20000){
  if(q('.over h1')&&q('[data-act=newgame2]'))return{end:q('.over h1').innerText,steps,days,errs};
  if(q('#ov')){let b;if(b=q('[data-act=evnext]')){b.click();continue}if(b=q('[data-act=presback]')){b.click();continue}
   let b2;if(b2=q('[data-act=mgfinish]')){b2.click();continue}if(b2=q('[data-act=mgnext]')){b2.click();continue}
   let ma=qa('[data-act=mgans]');if(ma.length){pickr(ma).click();continue}
   let mf=qa('[data-act=mgflip]');if(mf.length){if(rnd()<.3)q('[data-act=mgskip]').click();else pickr(mf).click();continue}
   let ch=qa('#ov .choice:not(.dis)');if(ch.length){pickr(ch).click();continue}
   if(b2=q('[data-act=aboutpick]')){pickr(qa('[data-act=aboutpick]')).click();continue}
   ch=qa('#ov [data-act=go]:not([disabled])');if(ch.length){pickr(ch).click();continue}
   if(b=q('[data-act=evgift]')){b.click();continue}if(b=q('[data-act=subback]')){b.click();continue}if(b=q('[data-act=evback]')){b.click();continue}
   q('#ov [data-act=close]').click();continue}
  if(!q('.nav'))return{noNav:document.body.innerText.slice(0,200),steps,days,errs};
  const r=rnd();
  if(r<.15){for(const t of['people','shop','work','cal','menu'])q('[data-act=tab][data-v='+t+']').click();q('[data-act=tab][data-v=today]').click();}
  let b;if(b=q('[data-act=openev]')){b.click();continue}
  if(r<.55){q('[data-act=tab][data-v=people]').click();pickr(qa('.person')).click();const bt=qa('#ov [data-act=inter]');pickr(bt).click();continue}
  if(r<.65){q('[data-act=tab][data-v=shop]').click();const bb=qa('[data-act=buy]:not([disabled])');if(bb.length)pickr(bb).click();const u=q('[data-act=use]');if(u)u.click();q('[data-act=tab][data-v=today]').click();continue}
  if(r<.75){q('[data-act=tab][data-v=work]').click();const w=qa('[data-act=work]:not([disabled])');if(w.length)pickr(w).click();q('[data-act=tab][data-v=today]').click();continue}
  if(b=q('[data-act=endday]')){b.click();days++;continue}q('[data-act=tab][data-v=today]').click();}
 return{timeout:1,steps,days,errs}}'''
bad = 0
with sync_playwright() as p:
    b = launch(p)
    for seed in range(a, z):
        pg, errs = new_game(b, lang, {'clues': {'k0': 1, 'k1': 1, 'k2': 1, 'k3': 1, 'k4': 1, 'k5': 1, 'k6': 1, 'k7': 1, 'n:a': 1, 'n:b': 1, 'n:c': 1}} if seed % 2 else None, 400, 800)
        r = pg.evaluate(JS, seed * 7919); good = 'end' in r and not r['errs'] and not errs
        print(seed, 'OK ' if good else 'BAD', r, errs[:2], flush=True); bad += 0 if good else 1; pg.close()
sys.exit(1 if bad else 0)
