/* app/12_input.js — Starting a game, people interactions, the ACTIONS table for clicks, keyboard. */
'use strict';
/* ---------- game start & people interactions ---------- */
async function startNew() {
  const p = await Store.prefs();
  const prev = p.name || '';
  V.trait = 'bal';
  V.ngpOn = false;
  const hasRuns = (p.runs || []).length > 0;
  const T = TRAITS();
  const chips = T.map(
    x =>
      `<button class="btn trait ${x[0] === 'bal' ? 'primary' : ''}" data-act="trait" data-v="${x[0]}" aria-pressed="${x[0] === 'bal'}">` +
      `${x[1]}</button>`,
  ).join('');
  const dl = T.map(x => `<li><b>${x[1]}</b>: ${x[2]}</li>`).join('');
  openModal(
    head(L('Your name', 'Ton nom'), '') +
      (`<p>` +
        L(
          "This is your character's name. They are not you: you are the one who decides for them. It replaces “MC” in what characters say.",
          "C'est le nom de ton personnage. Il n'est pas toi : c'est toi qui décides pour lui. Il remplace « MC » dans les dialogues.",
        ) +
        `</p>` +
        `<input id="pname" class="nm-in" maxlength="16" autocomplete="off" placeholder="${L('Your name', 'Ton prénom')}"` +
        ` value="${ea(prev === 'MC' ? '' : prev)}">\n  ` +
        `<h3 style="margin:14px 0 6px">${L('How does the year start?', "Comment commence l'année ?")}</h3>` +
        `<div class="row">${chips}</div><ul class="traitlist small muted">${dl}</ul>\n  ` +
        (hasRuns
          ? `<div class="row" style="margin-top:6px">` +
            `<button class="btn ghost" data-act="ngp" aria-pressed="false">${L('New Game+ bonus', 'Bonus Nouvelle partie+')}` +
            `</button></div><p class="small muted" style="margin:6px 0 0">` +
            L(
              '+$20, and your closest friend from your last run starts the year at +20.',
              "+20 $, et ton meilleur ami de la dernière partie commence l'année à +20.",
            ) +
            `</p>`
          : '') +
        `\n  <div class="row" style="margin-top:14px">` +
        `<button class="btn primary" data-act="begin">${L('Begin', 'Commencer')}</button>` +
        `<button class="btn ghost" data-act="close">${t('Close')}</button></div>`),
  );
  setTimeout(() => {
    const i = $('#pname');
    if (i) i.focus();
  }, 60);
}
async function beginGame() {
  const i = $('#pname');
  let nm = ((i && i.value) || '')
    .replace(/[<>&"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  if (!nm) {
    toast(L('Type a name first.', 'Écris un nom.'));
    return;
  }
  const p = await Store.prefs();
  Store.prefs(Object.assign({}, p, { name: nm }));
  S = E.newGame(undefined, (V.seen || []).length > 0);
  S.name = nm;
  S.mem = memOf(p.runs);
  S.note = V.revealed && p.note ? String(p.note).slice(0, 120) : '';
  applyTrait(S, V.trait, p, V.ngpOn);
  V.overDone = false;
  V.tab = 'today';
  V.calM = 0;
  closeModal();
  render();
  if (!p.tut) startTut(true);
  else showEvent();
  Store.put('auto', S);
}
function personAfter(r, title) {
  V.res = r;
  V.resTitle = title || 'Done';
  if (r && r.err) {
    V.res = { chips: [], lines: [], err: r.err };
  }
  Store.autosave(S);
  render();
  renderModal();
}
function doInter(name, id, arg) {
  const r = E.interact(S, name, id, arg);
  V.sub = null;
  if (!r) return;
  if (r.err) {
    V.res = null;
    toast(r.err);
    renderModal();
    return;
  }
  V.res = r;
  V.resTitle = 'Done';
  Store.autosave(S);
  renderBehind();
  renderModal();
  if (S.over) {
    /* handled on close */
  }
}
function renderBehind() {
  render();
}

/* ---------- click actions ---------- */
/* Every clickable element has data-act="<name>" and often data-v="<value>". onClick() finds the action
   in ACTIONS and calls it as handler(v, b, a): v = data-v (a string or undefined), b = the clicked element,
   a = the action name (lets one handler serve two names, e.g. saves / saves0).
   Rules kept from the old switch:
   - every click plays SFX.tap() first, except 'pick' and 'inter' (their result plays its own sound);
   - an unknown action does nothing (after the tap);
   - a handler that only calls an async function does not return its promise (braces), as before;
     handlers that awaited before are async and are awaited by onClick. */

/* navigation: tabs, People list, calendar month */
const NAV_ACTIONS = {
  tab: v => {
    V.tab = v;
    if (v === 'journal') V.jS = null;
    if (v === 'cal') {
      const cur = E.dayOf(S).d;
      V.calM = Math.max(
        0,
        MONTHS.findIndex(([y, m]) => cur.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)),
      );
    }
    closeModal();
    render();
    window.scrollTo(0, 0);
  },
  filter: v => {
    V.filter = v;
    render();
  },
  sort: v => {
    V.sort = v;
    render();
  },
  calm: v => {
    V.calM = +v;
    render();
  },
  close: () => {
    Voice.stop();
    if (V.tut != null) {
      endTut();
      return;
    }
    closeModal();
    if (S) render();
  },
};

/* title screen, menu and dialogs */
const MENU_ACTIONS = {
  enter: () => {
    V.gate = false;
    render();
  },
  settings: () => showSettings(),
  help: () => showHelp(),
  stats: () => {
    showStats();
  },
  endbook: () => {
    showEndBook();
  },
  summary: () => {
    showSummary();
  },
  copysum: () => {
    copySummary();
  },
  notemc: () => {
    showNoteMC();
  },
  savenote: () => {
    saveNote(false);
  },
  clearnote: () => {
    saveNote(true);
  },
  theme: async () => {
    THEME = { system: 'light', light: 'dark', dark: 'system' }[THEME];
    applyTheme();
    {
      const p = await Store.prefs();
      Store.prefs(Object.assign({}, p, { theme: THEME }));
    }
    render();
    renderModal();
  },
  lang: async () => {
    LANG = LANG === 'fr' ? 'en' : 'fr';
    {
      const p = await Store.prefs();
      Store.prefs(Object.assign({}, p, { lang: LANG }));
    }
    render();
    renderModal();
  },
};

/* settings toggles, sound and voice */
const SETTINGS_ACTIONS = {
  mute: () => {
    PREF.muted = !PREF.muted;
    if (PREF.muted) {
      Music.stop();
      Voice.stop();
    } else {
      Music.start();
      SFX.tap();
    }
    savePrefs();
    render();
  },
  fs: v => {
    PREF.fs = +v;
    applyA11y();
    savePrefs();
    renderModal();
  },
  ink: () => {
    PREF.ink = !PREF.ink;
    applyA11y();
    savePrefs();
    renderModal();
  },
  rm: () => {
    PREF.rm = !RM_ON();
    applyA11y();
    savePrefs();
    renderModal();
  },
  snd: () => {
    PREF.snd = !PREF.snd;
    savePrefs();
    renderModal();
    if (PREF.snd) SFX.chime();
  },
  mus: () => {
    PREF.mus = !PREF.mus;
    savePrefs();
    if (PREF.mus) Music.start();
    else Music.stop();
    renderModal();
  },
  voice: () => {
    PREF.voice = !PREF.voice;
    if (!PREF.voice) Voice.stop();
    savePrefs();
    renderModal();
  },
  listen: () => {
    if (V.speaking) {
      Voice.stop();
    } else if (S && S.ending && !V.evCur) Voice.say(endParts());
    else if (V.evCur) Voice.say(V.res ? resParts(V.evCur, V.res) : evParts(V.evCur));
  },
};

/* tutorial, new game, saved games */
const GAME_ACTIONS = {
  tutnext: () => {
    V.tut++;
    if (V.tut >= TUT().length) endTut();
    else renderModal();
  },
  tutprev: () => {
    V.tut = Math.max(0, V.tut - 1);
    renderModal();
  },
  tutskip: () => {
    endTut();
  },
  tutopen: () => startTut(false),
  start: () => {
    startNew();
  },
  newgame2: () => {
    startNew();
  },
  begin: () => {
    beginGame();
  },
  trait: v => {
    V.trait = v;
    document.querySelectorAll('#ov [data-act=trait]').forEach(x => {
      const on = x.dataset.v === v;
      x.classList.toggle('primary', on);
      x.setAttribute('aria-pressed', on);
    });
  },
  ngp: (v, b) => {
    V.ngpOn = !V.ngpOn;
    b.classList.toggle('primary', V.ngpOn);
    b.setAttribute('aria-pressed', V.ngpOn);
  },
  newgame: () =>
    openModal(
      head(t('New game'), '') +
        (`<p>` +
          L(
            'Start over? Your current run stays in autosave until the new one replaces it.',
            "Recommencer ? Ta partie actuelle reste dans la sauvegarde auto jusqu'à ce qu'elle soit remplacée.",
          ) +
          `</p><div class="row"><button class="btn primary" data-act="start">${t('New game')}</button>` +
          `<button class="btn ghost" data-act="close">${t('Close')}</button></div>`),
    ),
  saves: (v, b, a) => {
    showSaves(a === 'saves0');
  },
  saves0: (v, b, a) => {
    showSaves(a === 'saves0');
  },
  continue: async () => {
    const x = await Store.get('auto');
    if (x) {
      S = x.S;
      V.overDone = false;
      V.tab = 'today';
      render();
      if (S.phase === 'event' && !S.over) showEvent();
    }
  },
  saveto: async v => {
    await Store.put(v, S);
    toast(t('Saved.'));
    showSaves(false);
  },
  loadfrom: async v => {
    const x = await Store.get(v);
    if (x) {
      S = x.S;
      V.overDone = false;
      V.tab = 'today';
      closeModal();
      render();
      toast(t('Loaded.'));
      if (S.phase === 'event' && !S.over) showEvent();
    }
  },
  delslot: async v => {
    await Store.del(v);
    showSaves(!S);
  },
};

/* school events, gifts inside events, school minigames */
const EVENT_ACTIONS = {
  openev: () => showEvent(),
  pick: v => {
    const ev = V.evCur;
    const c = ev.choices[+v];
    if (c.disabled) {
      toast(c.why || '');
      return;
    }
    if (c.gift) {
      V.sub = { type: 'gift' };
      V.evPick = +v;
      renderModal();
      return;
    }
    if (c.sp === 'academic') {
      V.evPick = +v;
      V.mg = newMg(ev);
      renderModal();
      return;
    }
    V.res = E.choose(S, +v);
    V.res && (V.res.title = ev.title);
    render();
    renderModal();
  },
  mgans: v => {
    const m = V.mg;
    if (m.ans == null) {
      m.ans = v;
      if (v === m.def.qs[m.i].a) m.ok++;
    }
    renderModal();
  },
  mghint: () => {
    const m = V.mg;
    if (m.hints > 0 && m.ans == null) {
      const q = m.def.qs[m.i];
      m.rem = q.o.filter(o => o !== q.a).slice(0, 2);
      m.hints--;
    }
    renderModal();
  },
  mgnext: () => {
    const m = V.mg;
    m.i++;
    m.ans = null;
    m.rem = [];
    if (m.i >= m.def.qs.length) m.done = true;
    renderModal();
  },
  mgflip: v => mgFlip(+v),
  mgfinish: () => {
    const m = V.mg;
    let q, label;
    if (m.def.type === 'quiz') {
      q = m.ok / m.def.qs.length;
      label = m.def.label + ' ' + m.ok + '/' + m.def.qs.length;
    } else {
      q = m.misses <= 4 ? 1 : m.misses <= 7 ? 0.7 : 0.3;
      label = m.def.label + ' (' + m.misses + ' misses)';
    }
    V.mg = null;
    V.res = E.choose(S, V.evPick, { mg: { q, label } });
    render();
    renderModal();
  },
  mgskip: () => {
    V.mg = null;
    V.res = E.choose(S, V.evPick);
    render();
    renderModal();
  },
  evgift: v => {
    V.res = E.choose(S, V.evPick, v);
    V.sub = null;
    render();
    renderModal();
  },
  evback: () => {
    V.sub = null;
    renderModal();
  },
  evnext: () => {
    Voice.stop();
    V.evCur = null;
    afterEvent();
  },
};

/* after school: study, end the day, shop, jobs, kitchen and family time */
const DAY_ACTIONS = {
  study: () => {
    const r = E.study(S);
    if (r && r.err) toast(r.err);
    else {
      V.res = null;
      Store.autosave(S);
      render();
      toast(L('Studied. +10% on your next check.', 'Tu as étudié. +10% au prochain test.'));
    }
  },
  endday: () => {
    const r = E.endDay(S);
    Store.autosave(S);
    if (S.phase === 'ending') {
      markEnding();
    }
    render();
    if (S.phase === 'event' && !S.over) showEvent();
  },
  buy: v => {
    const r = E.buy(S, +v);
    if (r && r.err) toast(r.err);
    else {
      Store.autosave(S);
      toast(L('Bought: ', 'Acheté : ') + tr(E.SHOP[+v].n));
    }
    render();
  },
  use: v => {
    const r = E.useItem(S, v);
    if (r.err) toast(r.err);
    else toast((r.lines || [])[0] || 'Done');
    Store.autosave(S);
    render();
  },
  work: v => {
    const r = E.work(S, +v);
    if (r && r.err) toast(r.err);
    else {
      toast('+ $' + (r.chips.find(c => c.k === 'money') || { v: 0 }).v);
      Store.autosave(S);
    }
    render();
  },
  cook: v => showCook(v),
  bond: v => showBond(v),
  bondfor: (v, b) => {
    if (b.classList.contains('dis')) {
      toast(L('Not available right now.', 'Pas disponible pour le moment.'));
      return;
    }
    const [who, aid] = String(v).split('|');
    const r = E.bond(S, who, aid);
    if (!r) return;
    if (r.err) {
      toast(r.err);
      return;
    }
    const ac = E.BONDS[who].acts.find(x => x.id === aid);
    Store.autosave(S);
    openModal(head(who, '') + `<p class="desc">${esc(tr(ac.n))}</p>` + outcomeHtml(r));
    render();
  },
  cookfor: v => {
    const [rid, who] = String(v).split('|');
    const r = E.cook(S, rid, who);
    if (!r) return;
    if (r.err) {
      toast(r.err);
      return;
    }
    const rc = E.RECIPES.find(x => x.id === rid);
    const wl = who === 'self' ? L('yourself', 'toi-même') : who === 'family' ? L('your family', 'ta famille') : who;
    Store.autosave(S);
    openModal(
      head(L('Cooked ', 'Cuisiné : ') + tr(rc.n), '') +
        `<p class="desc">${L('You cooked for ', 'Tu as cuisiné pour ')}${esc(wl)}.</p>` +
        outcomeHtml(r),
    );
    render();
  },
};

/* person profile: interactions and their sub-menus */
const PEOPLE_ACTIONS = {
  person: v => showPerson(v),
  presback: () => {
    V.res = null;
    V.sub = null;
    if (S.over) {
      closeModal();
      render();
    } else renderModal();
  },
  subback: () => {
    V.sub = null;
    renderModal();
  },
  aboutpick: v => {
    V.sub.subject = v;
    renderModal();
  },
  inter: (v, b) => {
    if (b.dataset.why) {
      toast(b.dataset.why);
      return;
    }
    const name = V.person;
    const types = {
      talkabout: 'about',
      talk: 'talk',
      gift: 'gift',
      hangout: 'hangout',
      lend: 'lend',
      share: 'rumor',
      investigate: 'rumor',
      fight: 'fight',
      apologize: 'apologize',
    };
    if (types[v]) {
      V.sub = { type: types[v], id: v };
      renderModal();
    } else doInter(name, v);
  },
  go: v => {
    const s = V.sub;
    doInter(V.person, s.id, v);
  },
};

/* phone: threads, group chats, phone minigames */
const PHONE_ACTIONS = {
  phone: () => showPhone(),
  phtext: v => showPhone(v),
  phopen: v => {
    pgStop();
    V.ph = { name: v };
    renderModal();
    phScroll();
  },
  phback: () => {
    pgStop();
    V.pg = null;
    V.ph = { name: null };
    renderModal();
    render();
  },
  phgames: () => {
    pgStop();
    V.pg = null;
    V.ph = { name: '@games' };
    renderModal();
  },
  pgstart: (v, b) => {
    if (b.dataset.why) {
      toast(b.dataset.why);
      return;
    }
    pgStart(v);
  },
  pgans: v => pgAnswer(+v),
  phgact: (v, b) => {
    if (b.dataset.why) {
      toast(b.dataset.why);
      return;
    }
    const r = E.phoneGroupAct(S, V.ph.name, v);
    phDone(r);
    renderModal();
    phScroll();
  },
  phact: (v, b) => {
    if (b.dataset.why) {
      toast(b.dataset.why);
      return;
    }
    const r = E.phoneAct(S, V.ph.name, v);
    phDone(r);
    renderModal();
    phScroll();
  },
  phreply: v => {
    const r = E.phoneReply(S, V.ph.name, +v);
    phDone(r);
    renderModal();
    phScroll();
  },
};

/* journal book */
const JOURNAL_ACTIONS = {
  jopen: () => jOpen(),
  jnext: () => jFlip(1),
  jprev: () => jFlip(-1),
  jtoday: () => jFlip(0, curSpread()),
  readj: () => {
    V.jFinal = true;
    V.jS = null;
    render();
  },
  jclose: () => jClose(),
};

const ACTIONS = Object.assign(
  {},
  NAV_ACTIONS,
  MENU_ACTIONS,
  SETTINGS_ACTIONS,
  GAME_ACTIONS,
  EVENT_ACTIONS,
  DAY_ACTIONS,
  PEOPLE_ACTIONS,
  PHONE_ACTIONS,
  JOURNAL_ACTIONS,
);
const NO_TAP = new Set(['pick', 'inter']);

async function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) {
    if (e.target.id === 'ov' && V.modal && !V.evCur) closeModal();
    return;
  }
  const a = b.dataset.act,
    v = b.dataset.v;
  if (!NO_TAP.has(a)) SFX.tap();
  if (Object.prototype.hasOwnProperty.call(ACTIONS, a)) await ACTIONS[a](v, b, a);
}

/* ---------- keyboard ---------- */
function onKey(e) {
  const tg = e.target;
  const typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA');
  if (e.key === 'Enter' && tg && tg.id === 'pname') {
    beginGame();
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') {
    const mb = document.querySelector('[data-act=mute]');
    if (mb) {
      e.preventDefault();
      mb.click();
      return;
    }
  }
  const ov = document.getElementById('ov');
  const k = e.key;
  const onBtn = tg && tg.tagName === 'BUTTON';
  if (ov) {
    if (k === 'Escape') {
      const x = ov.querySelector('[data-act=close]');
      if (x) {
        e.preventDefault();
        x.click();
      }
      return;
    }
    const ch = [...ov.querySelectorAll('.choice')];
    const letter = k.length === 1 ? k.toUpperCase() : '';
    if (ch.length && letter) {
      const idx = /[1-9]/.test(letter) ? +letter - 1 : 'ABCDEFG'.indexOf(letter);
      if (idx >= 0 && ch[idx]) {
        e.preventDefault();
        ch[idx].click();
        return;
      }
    }
    if (k === 'Enter' && !onBtn) {
      const x = ov.querySelector('[data-act=evnext],[data-act=presback],[data-act=mgnext],[data-act=mgfinish]');
      if (x) {
        e.preventDefault();
        x.click();
      }
    }
    return;
  }
  if (!S) return;
  if (V.tab === 'journal' && !(S.over || S.phase === 'ending')) {
    if (k === 'ArrowRight') {
      e.preventDefault();
      jFlip(1);
      return;
    }
    if (k === 'ArrowLeft') {
      e.preventDefault();
      jFlip(-1);
      return;
    }
  }
  if (/^[1-7]$/.test(k) && !(S.over || S.phase === 'ending')) {
    const tabs = document.querySelectorAll('.nav [data-act=tab]');
    if (tabs[+k - 1]) tabs[+k - 1].click();
  }
}
