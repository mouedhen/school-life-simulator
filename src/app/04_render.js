/* app/04_render.js — render(), HUD and nav, the faint-ink mystery, the Today tab. */
'use strict';
/* ---------- render shell ---------- */
function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString(L('en-CA', 'fr-CA'), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
function hud() {
  const d = E.dayOf(S);
  const low = S.pop <= 20;
  const pips = Array.from(
    { length: Math.max(S.maxBlocks, S.blocks) },
    (_, i) => `<span class="pip ${i < S.blocks ? '' : 'off'}"></span>`,
  ).join('');
  return (
    `<div class="hud"><div class="hud-top"><div><div class="date">${esc(fmtDate(d.d))}</div>` +
    `<div class="sub">${t('Day')} ${S.di + 1} ${t('of')} ${DAYS.length}</div></div>\n  <div class="hr">` +
    `<button class="mute phbtn${E.phoneOff(S) ? ' off' : ''}" data-act="phone" aria-label="${L('Phone', 'Téléphone')}">📱${phBadge()}` +
    `</button>` +
    `<button class="mute" data-act="mute" aria-pressed="${!!PREF.muted}" aria-label="${L('Mute all sound', 'Couper tout le son')}">` +
    `${PREF.muted ? '🔇' : '🔊'}</button><div class="money">$${S.money}</div></div></div>\n  ` +
    `<div class="bars"><div class="bar"><div class="lab"><span>${t('POP')}</span><b>${S.pop}/100</b>` +
    `</div><div class="track"><div class="fill pop ${low ? 'low' : ''}" style="width:${S.pop}%"></div>` +
    `</div></div>\n  <div class="bar"><div class="lab"><span>${t('Grade')}</span><b>${S.grade}</b></div>` +
    `<div class="track"><div class="fill grade" style="width:${S.grade}%"></div></div></div><div></div>` +
    `</div>\n  ` +
    (S.phase === 'free' ? `<div class="blocks"><span>${t('Time blocks')}</span>${pips}</div>` : '') +
    `</div>` +
    (low
      ? `<div class="warn" style="margin-top:10px">⚠ POP ${S.pop}. ` +
        L('If it hits 0, the run is over.', 'Si elle tombe à 0, la partie est perdue.') +
        `</div>`
      : '')
  );
}
function nav() {
  const tabs = [
    ['today', 'Today', IC.today],
    ['people', 'People', IC.people],
    ['shop', 'Shop', IC.shop],
    ['work', 'Work', IC.work],
    ['cal', 'Calendar', IC.cal],
    ['journal', 'Journal', IC.journal],
    ['menu', 'Menu', IC.menu],
  ];
  return (
    `<div class="nav"><div class="nav-in">` +
    tabs
      .map(
        ([k, n, ic]) =>
          `<button data-act="tab" data-v="${k}" class="${V.tab === k ? 'on' : ''}">` +
          `<svg viewBox="0 0 24 24">${ic}</svg>${t(n)}</button>`,
      )
      .join('') +
    `</div></div>`
  );
}
function render() {
  metaSync();
  Music.set(musMood());
  if (S && S.phone && S.phone.ping) {
    const pk0 = String(S.phone.ping);
    const pg = GCN[pk0] ? LX(GCN[pk0]) : pk0.split(' ')[0];
    S.phone.ping = null;
    setTimeout(() => toast(L('📱 New message from ', '📱 Nouveau message de ') + pg), 500);
  }
  if (S && S.notice) {
    const nt = S.notice;
    S.notice = '';
    setTimeout(() => toast(nt), 400);
  }
  const root = $('#root');
  if (S && S.over && !V.overDone) {
    V.overDone = true;
    Store.del('auto');
    recordRun();
  }
  applyA11y();
  if (!S) {
    root.innerHTML = V.gate ? loginScreen() : titleScreen();
    return;
  }
  {
    const k = S.ending ? 'e' + S.ending.id : S.over ? 'o' : '';
    if (k && V.sfxKey !== k) {
      V.sfxKey = k;
      S.ending && !E.ENDBY[S.ending.id].bad ? SFX.endGood() : SFX.endBad();
      if (S.ending) setTimeout(() => Voice.say(endParts()), 900);
    } else if (!k) V.sfxKey = '';
  }
  if (V.jFinal && S && (S.over || S.phase === 'ending')) {
    root.innerHTML = `<div class="app"><main>${viewJournal()}</main></div>`;
    jUpdateNav();
    jFit($('#spread'));
    return;
  }
  let body = '';
  if (S.over) body = overScreen();
  else if (S.phase === 'ending') body = endingScreen();
  else
    body = {
      today: viewToday,
      people: viewPeople,
      shop: viewShop,
      work: viewWork,
      cal: viewCal,
      journal: viewJournal,
      menu: viewMenu,
    }[V.tab]();
  root.innerHTML =
    `<div class="app">${S.over || S.phase === 'ending' ? '' : hud()}<main>${body}</main>` +
    `</div>${S.over || S.phase === 'ending' ? '' : nav()}`;
  if (V.tab === 'journal' && !(S.over || S.phase === 'ending')) {
    jUpdateNav();
    jFit($('#spread'));
  }
  renderModal();
}

/* ---------- faint ink mystery ---------- */
/* the Player mystery: faint ink. Clue ids: k0..k11 fixed places, n:<date> / n:end journal notes. */
const CLUES = () => ({
  k0: L('Page one is not the first page.', "La page un n'est pas la première page."),
  k1: L('The rules were never only for MC.', "Les règles n'ont jamais été que pour MC."),
  k2: L('MC cannot press these buttons. You can.', 'MC ne peut pas appuyer sur ces boutons. Toi, si.'),
  k4: L(
    "Every coin was spent by a hand that is not MC's.",
    "Chaque pièce a été dépensée par une main qui n'est pas celle de MC.",
  ),
  k5: L('The calendar ends. Someone is still turning it.', "Le calendrier finit. Quelqu'un continue de le tourner."),
  k6: L('When they say your name, who looks up?', 'Quand ils disent ton nom, qui lève les yeux ?'),
  k7: L('A year ends. The pen does not.', 'Une année se termine. Le stylo, non.'),
  k8: L('Hello, you. Yes, you. Not MC.', 'Bonjour, toi. Oui, toi. Pas MC.'),
});
const plainMC = x => ea(x).replace(/\bMC\b/g, () => myName());
const FAINT = () => L('Faint writing', 'Écriture pâle');
function inkHtml(id, text) {
  const on = !!(V.clues && V.clues[id]);
  return (
    `<span class="fink${on ? ' on' : ''}" data-clue="${ea(id)}" tabindex="0" role="note">${plainMC(text)}` + `</span>`
  );
}
const clueN = () => {
  const ks = Object.keys(V.clues || {});
  const notes = ks.filter(k => k.charAt(0) === 'n').length;
  return ks.length - notes + [2, 5, 9].filter(x => notes >= x).length;
};
const metaSync = () => {
  try {
    if (S) S.meta = { clues: clueN() };
  } catch (e) {}
};
function revealInk(el) {
  if (!el || !el.dataset || !el.dataset.clue) return;
  const id = el.dataset.clue;
  el.classList.add('on');
  V.clues = V.clues || {};
  if (V.clues[id]) return;
  const before = clueN();
  V.clues[id] = 1;
  metaSync();
  try {
    if (S && !S.over) E.noteStrange(S);
  } catch (e) {}
  try {
    Store.prefs().then(p => Store.prefs(Object.assign({}, p, { clues: V.clues })));
  } catch (e) {}
  const n = clueN();
  toast(
    n >= E.REVEAL_AT && before < E.REVEAL_AT
      ? L('Something is about to change.', 'Quelque chose va changer.')
      : Object.keys(V.clues).length === 1
        ? L(
            'There is faint writing here. You are not sure why you can read it.',
            'Il y a une écriture très pâle ici. Tu ne sais pas pourquoi tu peux la lire.',
          )
        : n > before
          ? L('Another trace of faint ink.', "Une autre trace d'encre pâle.")
          : L('Faint writing, noted.', 'Écriture pâle, notée.'),
  );
  try {
    SFX.chime();
  } catch (e) {}
}
function inkStatHtml(p) {
  const r = (p.runs || []).length + 1;
  const n = clueN();
  const txt = L(
    'MC lives this year once. You have lived it ' + r + (r === 1 ? ' time.' : ' times.'),
    "MC vit cette année une seule fois. Toi, tu l'as vécue " + r + ' fois.',
  );
  return (
    `<p class="small" style="margin:0 0 8px">${inkHtml('k3', txt)}</p>` +
    (n
      ? `<div class="endrow"><span class="dot on"></span><div>` +
        `<b>${L('Faint writing found', 'Écriture pâle trouvée')}: ${n}</b>` +
        Object.keys(V.clues || {})
          .filter(k => /^k\d/.test(k))
          .sort()
          .map(
            k =>
              `<div class="small muted" style="font-style:italic;margin-top:2px">${plainMC(k === 'k3' ? txt : CLUES()[k] || '')}` +
              `</div>`,
          )
          .join('') +
        `</div></div>`
      : '')
  );
}
/* ---------- Today tab ---------- */
function viewToday() {
  const d = E.dayOf(S);
  let top = '';
  if (S.phase === 'event') {
    const pe = E.buildEvent(S) || { title: d.t, desc: d.s };
    top =
      `<div class="card"><span class="tag">${L('Event', 'Événement')}</span><h3>${esc(pe.title)}</h3>` +
      `<p class="muted" style="margin:6px 0 12px">${esc(pe.desc)}</p>` +
      `<button class="btn primary" data-act="openev">${t("Open today's event")}</button></div>`;
  } else {
    const work = `<button class="btn small" data-act="tab" data-v="work">💼 ${t('Work')}</button>`;
    top =
      `<div class="card"><span class="tag alt">${t('After school')}</span>` +
      `<h3>${L('What now?', 'Que fais-tu maintenant ?')}</h3>\n    ` +
      `<p class="muted small" style="margin:4px 0 10px">` +
      L(
        'Actions use time blocks. When you are done, end the day.',
        'Chaque action prend des blocs de temps. Quand tu as fini, termine la journée.',
      ) +
      (`</p>\n    <div class="row">` +
        `<button class="btn small" data-act="study" ${S.blocks < 1 ? 'disabled' : ''}>📚 ${t('Study')} (1)` +
        `</button><button class="btn small" data-act="tab" data-v="people">💬 ${t('People')}</button>` +
        `<button class="btn small" data-act="phone">📱 ${L('Phone', 'Téléphone')}${phBadge()}</button>` +
        `<button class="btn small" data-act="tab" data-v="shop">🛍 ${t('Shop')}</button>${work}</div>\n    ` +
        `<div class="row" style="margin-top:12px">` +
        `<button class="btn primary" data-act="endday">${t('End day')} →</button></div></div>`);
  }
  const lastE = S.log.slice(-1)[0];
  return (
    `${top}<button class="card" data-act="tab" data-v="journal" style="width:100%;text-align:left">` +
    `<h3>📖 ${t('Journal')}</h3><div class="muted small">${lastE ? esc(lastE.t) : t('Journal is empty')}` +
    `</div></button>`
  );
}
