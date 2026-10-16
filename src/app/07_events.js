/* app/07_events.js — Modals, school minigames (memory pairs, quizzes) and the event dialog. */
'use strict';
/* ---------- modals ---------- */
function openModal(html) {
  V.modal = html;
  renderModal();
}
function closeModal() {
  pgStop();
  V.pg = null;
  V.mg = null;
  V.modal = null;
  V.res = null;
  V.sub = null;
  V.evIdx = null;
  V.person = null;
  V.evCur = null;
  V.savesOpen = false;
  renderModal();
}
function renderModal() {
  Music.set(musMood());
  let o = document.getElementById('ov');
  if (!V.modal) {
    if (o) o.remove();
    return;
  }
  if (!o) {
    o = document.createElement('div');
    o.id = 'ov';
    o.className = 'overlay';
    document.body.appendChild(o);
    o.addEventListener('click', ev => {
      ev.stopPropagation();
      onClick(ev);
    });
  }
  const keep = o.querySelector('.modal');
  const st = keep ? keep.scrollTop : 0;
  o.innerHTML =
    `<div class="modal" role="dialog" aria-modal="true" tabindex="-1">${typeof V.modal === 'function' ? V.modal() : V.modal}` +
    `</div>`;
  o.querySelector('.modal').scrollTop = st;
  if (!keep) {
    try {
      o.querySelector('.modal').focus({ preventScroll: true });
    } catch (e) {}
  }
  {
    const ev = V.evCur;
    if (V.res && V.res !== V.sfxRes) {
      V.sfxRes = V.res;
      SFX.forRes(V.res);
      if (isVoiced(ev)) Voice.say(resParts(ev, V.res));
    } else if (ev && !V.res && V.voiceEv !== ev) {
      V.voiceEv = ev;
      if (ev.kind === 'ball') SFX.chime();
      if (isVoiced(ev)) Voice.say(evParts(ev));
    }
  }
}
const head = (title, tag) =>
  `<div class="m-head"><div>${tag || ''}<h2>${esc(title)}</h2></div>` +
  `<button class="close" data-act="close" aria-label="Close">×</button></div>`;

/* ---------- school minigames (memory pairs and quizzes inside academic events) ---------- */
function newMg(ev) {
  const def = E.quiz(S, ev.title);
  if (def.type === 'quiz') return { def, i: 0, ok: 0, ans: null, rem: [], hints: def.hints, done: false };
  let a = def.seed >>> 0;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  const em = ['🍎', '🎨', '⚽', '📚'];
  const cards = em.concat(em);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { def, cards, flipped: [], matched: [], misses: 0, lock: false, done: false };
}
function mgFlip(i) {
  const m = V.mg;
  if (!m || m.lock || m.matched.includes(i) || m.flipped.includes(i)) return;
  m.flipped.push(i);
  if (m.flipped.length === 2) {
    const [x, y] = m.flipped;
    if (m.cards[x] === m.cards[y]) {
      m.matched.push(x, y);
      m.flipped = [];
      if (m.matched.length === m.cards.length) m.done = true;
    } else {
      m.misses++;
      m.lock = true;
      setTimeout(() => {
        if (V.mg === m) {
          m.flipped = [];
          m.lock = false;
          renderModal();
        }
      }, 650);
    }
  }
  renderModal();
}
function mgHtml(ev) {
  const m = V.mg;
  const d = m.def;
  const sk =
    `<div class="row" style="margin-top:12px">` +
    `<button class="btn ghost small" data-act="mgskip">${L('Skip (roll the dice)', 'Passer (au hasard)')}` +
    `</button></div>`;
  const h = head(d.label, `<span class="tag">${L('Mini-game', 'Mini-jeu')}</span>`);
  if (d.type === 'memory') {
    if (m.done)
      return (
        h +
        (`<p class="desc">${L('Done', 'Terminé')}: ${m.misses} ${L('misses', 'erreurs')}.</p><div class="row">` +
          `<button class="btn primary" data-act="mgfinish">${t('Continue')}</button></div>`)
      );
    return (
      h +
      (`<p class="desc">` +
        L(
          'Find all 4 pairs. Under 5 misses is a clean pass.',
          'Retrouve les 4 paires. Moins de 5 erreurs pour réussir à coup sûr.',
        ) +
        ` <b>${m.misses}</b> ${L('misses', 'erreurs')}</p>` +
        `<div class="ib" style="grid-template-columns:repeat(4,1fr)">` +
        m.cards
          .map((c, i) => {
            const up = m.flipped.includes(i) || m.matched.includes(i);
            return (
              `<button class="btn" style="height:72px;font-size:30px;text-align:center;padding:0" data-act="mgflip" data-v="${i}">${up ? c : '?'}` +
              `</button>`
            );
          })
          .join('') +
        `</div>`) +
      sk
    );
  }
  if (m.done) {
    const pass = m.ok / d.qs.length >= 0.6;
    return (
      h +
      (`<p class="desc">${m.ok}/${d.qs.length} — ` +
        (pass ? L('Nice work!', 'Bien joué !') : L('Not enough this time.', 'Pas assez cette fois.')) +
        `</p><div class="row"><button class="btn primary" data-act="mgfinish">${t('Continue')}</button></div>`)
    );
  }
  const q = d.qs[m.i];
  return (
    h +
    (`<p class="sub">${L('Question', 'Question')} ${m.i + 1}/${d.qs.length}</p>` +
      `<p class="desc" style="font-size:18px">${esc(q.q)}</p><div class="choices">` +
      q.o
        .map(o => {
          const gone = m.rem.includes(o);
          const st =
            m.ans != null
              ? o === q.a
                ? 'style="border-color:var(--good)"'
                : o === m.ans
                  ? 'style="border-color:var(--bad)"'
                  : ''
              : '';
          return (
            `<button class="choice ${gone ? 'dis' : ''}" ${st} data-act="${gone ? '' : 'mgans'}" data-v="${ea(o)}">` +
            `<span class="l">•</span><span>${esc(o)}</span></button>`
          );
        })
        .join('') +
      `</div>\n  <div class="row" style="margin-top:12px">` +
      (m.ans != null
        ? `<button class="btn primary" data-act="mgnext">${t('Continue')}</button>`
        : m.hints > 0
          ? `<button class="btn small" data-act="mghint">💡 50/50 (${m.hints})</button>`
          : '') +
      `</div><p class="small muted" style="margin:8px 0 0">` +
      L(
        'Study prep, notebooks and guides give you hints.',
        "Les cahiers, guides d'étude et l'aide donnent des indices.",
      ) +
      `</p>`) +
    sk
  );
}
/* ---------- events ---------- */
function showEvent() {
  const ev = E.buildEvent(S);
  if (!ev) {
    render();
    return;
  }
  V.res = null;
  const tag = ev.pedago
    ? `<span class="tag">Pédago</span>`
    : ev.rand
      ? `<span class="tag alt">${L('Random event', 'Imprévu')}</span>`
      : ev.kind === 'personal'
        ? `<span class="tag alt">${L('Personal', 'Personnel')}</span>`
        : ev.kind === 'ballinvite' || ev.kind === 'ball'
          ? `<span class="tag">${t('The Ball')}</span>`
          : ev.kind === 'holiday'
            ? `<span class="tag alt">` +
              (/^(knife|gift_)/.test(ev.id || '') ? L('Family', 'Famille') : L('Holiday', 'Congé')) +
              `</span>`
            : ev.kind === 'npc'
              ? `<span class="tag alt">${L('Encounter', 'Rencontre')}</span>`
              : ev.kind === 'notice'
                ? `<span class="tag alt">${L('Family', 'Famille')}</span>`
                : ev.kind === 'birthday'
                  ? `<span class="tag alt">${t('Birthday')}</span>`
                  : `<span class="tag">${fmtDate(E.dayOf(S).d)}</span>`;
  V.modal = () => {
    if (V.mg) return mgHtml(ev);
    if (V.res) return resultHtml(ev);
    if (V.sub && V.sub.type === 'gift')
      return (
        head(ev.title, tag) +
        (`<p class="desc">${L('Pick an item.', 'Choisis un objet.')}</p><div class="ib">` +
          E.giftItems(S)
            .map(
              it =>
                `<button class="btn" data-act="evgift" data-v="${ea(it.n)}">${itemIcon(it.n, it.kind)} ${esc(it.n)}` +
                `<small>×${S.inv[it.n]}</small></button>`,
            )
            .join('') +
          `</div><div class="row" style="margin-top:12px">` +
          `<button class="btn ghost" data-act="evback">${t('Back')}</button></div>`)
      );
    const newf =
      ev.met && ev.met.length
        ? `<div class="newface">👋 ${L('New contact', 'Nouveau contact')}: <b>${ev.met.map(esc).join(', ')}</b>` +
          `</div>`
        : '';
    const who =
      newf +
      (ev.who && ev.who.length
        ? `<div class="who">` +
          ev.who.map(w => `<span><b>${esc(w.role)}</b>${esc(w.names.join(', '))}</span>`).join('') +
          `</div>`
        : '');
    return (
      head(ev.title, tag) +
      (`<p class="desc">${esc(ev.desc)}</p>` +
        (isVoiced(ev) ? `<div class="row" style="margin-bottom:8px">${listenBtn()}</div>` : '') +
        `${who}<div class="choices">` +
        ev.choices
          .map(
            (c, i) =>
              `<button class="choice ${c.disabled ? 'dis' : ''}" data-act="pick" data-v="${i}" ${c.disabled ? 'aria-disabled="true"' : ''}>` +
              `<span class="l">${c.l}</span><span>${esc(c.x)}` +
              (c.chance != null
                ? `<small>~${c.chance}% ${L('chance to accept', "de chances qu'il/elle accepte")}</small>`
                : '') +
              (c.hint ? `<span class="hint">${esc(c.hint)}</span>` : '') +
              (c.disabled ? `<small>${esc(c.why || '')}</small>` : '') +
              `</span></button>`,
          )
          .join('') +
        `</div>`)
    );
  };
  V.evCur = ev;
  renderModal();
}
function resultHtml(ev) {
  const r = V.res;
  return (
    head(ev.title, `<span class="tag alt">${L('What happened', 'Résultat')}</span>`) +
    (`<div class="lines">${(r.lines || []).map(lineHtml).join('')}</div>` +
      (r.thought ? `<p class="thought">${esc(r.thought)}</p>` : '') +
      `${chips(r.chips)}<div class="row" style="margin-top:16px">` +
      `<button class="btn primary" data-act="evnext">${t('Continue')}` +
      `</button>${isVoiced(ev) ? listenBtn() : ''}</div>`)
  );
}
function afterEvent() {
  closeModal();
  if (S && S.flags && S.flags.REVEAL_DONE && !V.revealed) {
    V.revealed = 1;
    applyA11y();
    try {
      Store.prefs().then(p => Store.prefs(Object.assign({}, p, { revealed: 1 })));
    } catch (e) {}
    setTimeout(() => toast(L('The faint ink stays visible now.', "L'encre pâle reste visible, désormais.")), 600);
  }
  Store.autosave(S);
  if (S.phase === 'ending') {
    markEnding();
  }
  render();
  if (!S.over && S.phase === 'event') showEvent();
}
