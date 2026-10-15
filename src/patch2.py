p='engine.js';s=open(p).read()
def rep(a,b,f='s'):
    global s
    assert a in s,a[:60]; s=s.replace(a,b,1)
rep("q = 'Perimeter of a ' + w + ' by ' + h + ' rectangle'; a = 2 * (w + h); }","q = 'perimeter of a ' + w + ' by ' + h + ' rectangle'; a = 2 * (w + h); }")
rep("q = x + '/' + d + ' + ' + y + '/' + d + ' = ?/' + d; a = x + y; }","q = 'the top number: ' + x + '/' + d + ' + ' + y + '/' + d + ' = ?/' + d; a = x + y; }")
open(p,'w').write(s)

p='app.js';s=open(p).read()
rep("  'Theme': 'Thème', 'Menu title': 'Menu',","  'Theme': 'Thème', 'Menu title': 'Menu',\n  'Talk about someone': 'Parler de quelqu\\'un', 'Share a secret': 'Partager un secret', 'Ask for advice': 'Demander conseil', 'Sit together at lunch': 'Manger ensemble', 'Send a message': 'Envoyer un message', 'Tease playfully': 'Taquiner', 'Cheer them up': 'Remonter le moral', 'Work on a project together': 'Projet en équipe', 'Ask to join their group': 'Rejoindre leur groupe',")
# inter types
rep("const types = { talk: 'talk',","const types = { talkabout: 'about', talk: 'talk',")
# subHtml about
rep("  if (s.type === 'talk') return head(","""  if (s.type === 'about') {
    if (!s.subject) {
      const names = Object.keys(CH).filter(n => n !== name && CH[n].role !== 'teach');
      return head(name, `<span class="tag alt">${t('Talk about someone')}</span>`) + `<p class="desc">${LANG === 'fr' ? 'De qui veux-tu parler ?' : 'Who do you want to talk about?'}</p><div class="ib">${names.map(n => `<button class="btn" data-act="aboutpick" data-v="${esc(n)}">${esc(n)}<small>${relT(E.relLabel(S.rel[n]))} ${S.rel[n] > 0 ? '+' : ''}${S.rel[n]}</small></button>`).join('')}</div>` + back;
    }
    return head(name, `<span class="tag alt">${t('Talk about someone')}</span>`) + `<p class="desc">${LANG === 'fr' ? 'Que dis-tu sur ' : 'What do you say about '}<b>${esc(s.subject)}</b>?</p><div class="choices">
    <button class="choice" data-act="go" data-v="${esc(s.subject)}|bad"><span class="l">−</span><span>${LANG === 'fr' ? 'Dire du mal dans son dos' : 'Speak badly behind their back'}<small>${LANG === 'fr' ? 'Risqué : peut revenir à ses oreilles' : 'Risky: it can get back to them'}</small></span></button>
    <button class="choice" data-act="go" data-v="${esc(s.subject)}|good"><span class="l">+</span><span>${LANG === 'fr' ? 'En dire du bien' : 'Say good things about them'}</span></button>
    <button class="choice" data-act="go" data-v="${esc(s.subject)}|neutral"><span class="l">·</span><span>${LANG === 'fr' ? 'Le mentionner simplement' : 'Just mention them'}</span></button></div>` + back;
  }
  if (s.type === 'talk') return head(""")
rep("const boost = ['Movie ticket', 'Café drink', 'Fancy snack box']","const boost = ['Movie ticket', 'Café drink', 'Fancy snack box', 'Concert ticket']")
rep("    case 'subback': V.sub = null; renderModal(); break;","    case 'subback': V.sub = null; renderModal(); break;\n    case 'aboutpick': V.sub.subject = v; renderModal(); break;")
# pick -> minigame
rep("      if (c.gift) { V.sub = { type: 'gift' }; V.evPick = +v; renderModal(); break; }","      if (c.gift) { V.sub = { type: 'gift' }; V.evPick = +v; renderModal(); break; }\n      if (c.sp === 'academic') { V.evPick = +v; V.mg = newMg(ev); renderModal(); break; }")
rep("    if (V.res) return resultHtml(ev);\n","    if (V.mg) return mgHtml(ev);\n    if (V.res) return resultHtml(ev);\n")
rep("function closeModal() { V.modal = null;","function closeModal() { V.mg = null; V.modal = null;")
# mg actions
rep("    case 'evgift':","""    case 'mgans': { const m = V.mg; if (m.ans == null) { m.ans = v; if (v === m.def.qs[m.i].a) m.ok++; } renderModal(); break; }
    case 'mghint': { const m = V.mg; if (m.hints > 0 && m.ans == null) { const q = m.def.qs[m.i]; m.rem = q.o.filter(o => o !== q.a).slice(0, 2); m.hints--; } renderModal(); break; }
    case 'mgnext': { const m = V.mg; m.i++; m.ans = null; m.rem = []; if (m.i >= m.def.qs.length) m.done = true; renderModal(); break; }
    case 'mgflip': mgFlip(+v); break;
    case 'mgfinish': { const m = V.mg; let q, label; if (m.def.type === 'quiz') { q = m.ok / m.def.qs.length; label = m.def.label + ' ' + m.ok + '/' + m.def.qs.length; } else { q = m.misses <= 4 ? 1 : m.misses <= 7 ? 0.7 : 0.3; label = m.def.label + ' (' + m.misses + ' misses)'; } V.mg = null; V.res = E.choose(S, V.evPick, { mg: { q, label } }); render(); renderModal(); break; }
    case 'mgskip': { V.mg = null; V.res = E.choose(S, V.evPick); render(); renderModal(); break; }
    case 'evgift':""")
# mg functions before showEvent
rep("function showEvent() {","""function newMg(ev) {
  const def = E.quiz(S, ev.title);
  if (def.type === 'quiz') return { def, i: 0, ok: 0, ans: null, rem: [], hints: def.hints, done: false };
  let a = def.seed >>> 0; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const em = ['🍎', '🎨', '⚽', '📚']; const cards = em.concat(em); for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return { def, cards, flipped: [], matched: [], misses: 0, lock: false, done: false };
}
function mgFlip(i) {
  const m = V.mg; if (!m || m.lock || m.matched.includes(i) || m.flipped.includes(i)) return;
  m.flipped.push(i);
  if (m.flipped.length === 2) {
    const [x, y] = m.flipped;
    if (m.cards[x] === m.cards[y]) { m.matched.push(x, y); m.flipped = []; if (m.matched.length === m.cards.length) m.done = true; }
    else { m.misses++; m.lock = true; setTimeout(() => { if (V.mg === m) { m.flipped = []; m.lock = false; renderModal(); } }, 650); }
  }
  renderModal();
}
function mgHtml(ev) {
  const m = V.mg; const d = m.def;
  const sk = `<div class="row" style="margin-top:12px"><button class="btn ghost small" data-act="mgskip">${LANG === 'fr' ? 'Passer (au hasard)' : 'Skip (roll the dice)'}</button></div>`;
  const h = head(d.label, `<span class="tag">${LANG === 'fr' ? 'Mini-jeu' : 'Mini-game'}</span>`);
  if (d.type === 'memory') {
    if (m.done) return h + `<p class="desc">${LANG === 'fr' ? 'Terminé' : 'Done'}: ${m.misses} ${LANG === 'fr' ? 'erreurs' : 'misses'}.</p><div class="row"><button class="btn primary" data-act="mgfinish">${t('Continue')}</button></div>`;
    return h + `<p class="desc">${LANG === 'fr' ? 'Retrouve les 4 paires. Moins de 5 erreurs pour réussir à coup sûr.' : 'Find all 4 pairs. Under 5 misses is a clean pass.'} <b>${m.misses}</b> ${LANG === 'fr' ? 'erreurs' : 'misses'}</p><div class="ib" style="grid-template-columns:repeat(4,1fr)">${m.cards.map((c, i) => { const up = m.flipped.includes(i) || m.matched.includes(i); return `<button class="btn" style="height:72px;font-size:30px;text-align:center;padding:0" data-act="mgflip" data-v="${i}">${up ? c : '?'}</button>`; }).join('')}</div>` + sk;
  }
  if (m.done) { const pass = m.ok / d.qs.length >= 0.6; return h + `<p class="desc">${m.ok}/${d.qs.length} — ${pass ? (LANG === 'fr' ? 'Bien joué !' : 'Nice work!') : (LANG === 'fr' ? 'Pas assez cette fois.' : 'Not enough this time.')}</p><div class="row"><button class="btn primary" data-act="mgfinish">${t('Continue')}</button></div>`; }
  const q = d.qs[m.i];
  return h + `<p class="sub">${LANG === 'fr' ? 'Question' : 'Question'} ${m.i + 1}/${d.qs.length}</p><p class="desc" style="font-size:18px">${esc(q.q)}</p><div class="choices">${q.o.map(o => { const gone = m.rem.includes(o); const st = m.ans != null ? (o === q.a ? 'style="border-color:var(--good)"' : o === m.ans ? 'style="border-color:var(--bad)"' : '') : ''; return `<button class="choice ${gone ? 'dis' : ''}" ${st} data-act="${gone ? '' : 'mgans'}" data-v="${esc(o)}"><span class="l">•</span><span>${esc(o)}</span></button>`; }).join('')}</div>
  <div class="row" style="margin-top:12px">${m.ans != null ? `<button class="btn primary" data-act="mgnext">${t('Continue')}</button>` : (m.hints > 0 ? `<button class="btn small" data-act="mghint">💡 50/50 (${m.hints})</button>` : '')}</div><p class="small muted" style="margin:8px 0 0">${LANG === 'fr' ? 'Les cahiers, guides d\\'étude et l\\'aide donnent des indices.' : 'Study prep, notebooks and guides give you hints.'}</p>` + sk;
}
function showEvent() {""")
open(p,'w').write(s)
