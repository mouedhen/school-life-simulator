/* app/03_state.js — Icons, saving (Store: localStorage + optional cloud), the UI state V. */
'use strict';
/* ---------- icons ---------- */
const IC = {
  today: '<path d="M4 5h16v14H4z"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M16 14.2c2.8.2 5 2.4 5 5.8"/>',
  shop: '<path d="M4 8h16l-1.2 11H5.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  work: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14l2 2 3-3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  journal: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M10 8h6M10 12h6"/>',
};

/* ---------- storage / accounts ---------- */
const Store = {
  cloud: false,
  db: null,
  uid: null,
  busy: false,
  queue: null,
  async init() {
    try {
      if (typeof claude !== 'undefined' && claude.use) {
        const db = await claude.use('db');
        const user = await claude.use('user');
        if (user) {
          try {
            this.me = await user.me();
          } catch (e) {}
        }
        if (db && user) {
          this.uid = await user.id();
          if (this.uid) {
            this.db = db;
            this.cloud = true;
          }
        }
      }
    } catch (e) {}
  },
  col() {
    return this.db.collection('data/users/' + this.uid);
  },
  lsKey: k => 'sls_save_' + k,
  meta(S) {
    const d = E.dayOf(S);
    return {
      date: d.d,
      di: S.di,
      pop: S.pop,
      money: S.money,
      grade: S.grade,
      at: Date.now(),
      ending: S.ending ? S.ending.id : null,
      over: S.over || null,
    };
  },
  async put(slot, S) {
    const meta = this.meta(S);
    const json = JSON.stringify(S);
    try {
      localStorage.setItem(this.lsKey(slot), JSON.stringify({ meta, json }));
    } catch (e) {}
    if (this.cloud) {
      try {
        await this.col()
          .doc('save_' + slot)
          .set({ meta, json });
      } catch (e) {
        this.cloudErr = true;
      }
    }
    return meta;
  },
  async get(slot) {
    if (this.cloud) {
      try {
        const s = await this.col()
          .doc('save_' + slot)
          .get();
        if (s.exists) {
          const d = s.data();
          return { meta: d.meta, S: JSON.parse(d.json) };
        }
      } catch (e) {}
    }
    try {
      const v = JSON.parse(localStorage.getItem(this.lsKey(slot)));
      if (v) return { meta: v.meta, S: JSON.parse(v.json) };
    } catch (e) {}
    return null;
  },
  async metas() {
    const out = {};
    for (const k of ['auto', 's1', 's2', 's3']) {
      let m = null;
      if (this.cloud) {
        try {
          const s = await this.col()
            .doc('save_' + k)
            .get();
          if (s.exists) m = s.data().meta;
        } catch (e) {}
      }
      if (!m) {
        try {
          const v = JSON.parse(localStorage.getItem(this.lsKey(k)));
          if (v) m = v.meta;
        } catch (e) {}
      }
      out[k] = m;
    }
    return out;
  },
  async del(slot) {
    try {
      localStorage.removeItem(this.lsKey(slot));
    } catch (e) {}
    if (this.cloud) {
      try {
        await this.col()
          .doc('save_' + slot)
          .delete();
      } catch (e) {}
    }
  },
  async prefs(set) {
    if (set) {
      try {
        localStorage.setItem('sls_prefs', JSON.stringify(set));
      } catch (e) {}
      if (this.cloud) {
        try {
          await this.col().doc('prefs').set(set);
        } catch (e) {}
      }
      return set;
    }
    let p = null;
    if (this.cloud) {
      try {
        const s = await this.col().doc('prefs').get();
        if (s.exists) p = s.data();
      } catch (e) {}
    }
    if (!p) {
      try {
        p = JSON.parse(localStorage.getItem('sls_prefs'));
      } catch (e) {}
    }
    return p || {};
  },
  autosave(S) {
    if (!S || S.over) return;
    this.queue = S;
    if (this.busy) return;
    this.busy = true;
    setTimeout(async () => {
      const q = this.queue;
      this.queue = null;
      try {
        await this.put('auto', q);
      } catch (e) {}
      this.busy = false;
      if (this.queue) this.autosave(this.queue);
    }, 800);
  },
};

/* ---------- app state ---------- */
/* S: the saved game, created by E.newGame() and loaded by Store.get(); null on the title screen.
   V: UI-only state, never saved with a game. Fields (most are created on first use):
     navigation .... tab (current tab), filter / sort / q (People tab), calM (month index in Calendar),
                     gate (login screen still shown), hasAuto / autoInfo (title-screen Continue button)
     modal ......... modal (HTML string or function drawing the overlay; null when closed), savesOpen
     events ........ evCur (event on screen), evPick (choice index waiting for a minigame or gift),
                     res (result of the last choice or interaction), resTitle, mg (school minigame), evIdx (unused)
     people ........ person (open profile), sub (open sub-menu: {type, id, subject})
     phone ......... ph ({name}: thread, '#class', '#fam', '?', '@games' or '@play'), pg (phone minigame),
                     pgT / pgTO (its interval and timeout)
     journal ....... jS (current spread, -1 cover, 101 back cover, null = closed), jFinal (journal opened from the
                     end screen), pens (ink colour per person)
     sound/voice ... sfxKey / sfxRes / voiceEv (what was already played, so it does not repeat), speaking
     prefs mirror .. clues (faint ink found), revealed, seen (endings seen), prefName
     new game ...... trait, ngpOn (New Game+ bonus), tut / tutFirst (tutorial step), overDone (game over recorded)
     dialogs ....... sumTxt (run summary), noteVal (note for MC) */
let S = null;
const V = {
  tab: 'today',
  modal: null,
  filter: 'all',
  sort: 'def',
  q: '',
  calM: 0,
  res: null,
  evIdx: null,
  sub: null,
  seen: [],
};
window.__V = V;
window.__S = () => S;

/* result chips (POP +2, Grade −1, ★ flag...) and the toast message */
function pretty(f) {
  return String(f).toLowerCase().replace(/_/g, ' ');
}
function chipHtml(c) {
  switch (c.k) {
    case 'pop':
      return `<span class="chip ${c.v > 0 ? 'up' : 'down'}">POP ${signed(c.v)}</span>`;
    case 'grade':
      return `<span class="chip ${c.v > 0 ? 'up' : 'down'}">${t('Grade')} ${signed(c.v)}</span>`;
    case 'money':
      return `<span class="chip ${c.v > 0 ? 'up' : 'down'}">$${c.v > 0 ? '+' : '−'}${Math.abs(c.v)}</span>`;
    case 'rel':
      return (
        `<span class="chip ${c.v > 0 ? 'up' : 'down'}">` +
        esc(c.n.split(' ')[0] === 'Ms.' || c.n.split(' ')[0] === 'Mr.' ? c.n : c.n.split(' ')[0]) +
        ` ${signed(c.v)}</span>`
      );
    case 'ripple':
      return `<span class="chip rip">${esc(c.n.split(' ')[0])} ${signed(c.v)}</span>`;
    case 'gossip':
      return `<span class="chip down">Gossip +${c.v}</span>`;
    case 'flag':
      return `<span class="chip flag">★ ${esc(pretty(c.n))}</span>`;
    case 'unlock':
      return `<span class="chip flag">🔓 ${L('Shop', 'Boutique')}: ${esc(tr(c.n))}</span>`;
  }
  return '';
}
function chips(arr, max) {
  if (!arr || !arr.length) return '';
  const main = arr.filter(c => c.k !== 'ripple');
  const rip = arr.filter(c => c.k === 'ripple').slice(0, 3);
  return `<div class="chips">${main
    .concat(max ? [] : rip)
    .map(chipHtml)
    .join('')}</div>`;
}
/* small pieces of UI used on several screens */
const signed = v => (v > 0 ? '+' : '') + v; // "+5", "0", "-3"
const statBoxes = () =>
  `<div class="stats3"><div><b>${S.pop}</b>POP</div><div><b>${S.grade}</b>${t('Grade')}</div><div>` +
  `<b>$${S.money}</b>${t('Money')}</div></div>`;
const themeBtn = cls => `<button class="${cls}" data-act="theme">Mode: ${THEME_L()}</button>`;
const langBtn = cls => `<button class="${cls}" data-act="lang">${t('Language')}: ${L('English', 'Français')}</button>`;
const noteMcBtn = () =>
  V.revealed ? `<button class="btn" data-act="notemc">${L('Note for MC', 'Mot pour MC')}</button>` : '';
const closeRow = () =>
  `<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="close">${t('Close')}` +
  `</button></div>`;
// lines + chips of an action's result, with an OK button (family time, cooking)
const outcomeHtml = r =>
  `${chips(r.chips)}<div class="lines">` +
  r.lines.map(l => `<p>${esc(tr(l))}</p>`).join('') +
  (`</div><div class="row" style="margin-top:12px"><button class="btn primary" data-act="close">OK` +
    `</button></div>`);
function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.setAttribute('role', 'status');
  d.textContent = tr(msg);
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}
