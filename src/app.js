/* UI layer (app.js)
 *
 * Everything the player sees: screens, tabs, modals, sound, journal, phone. Built as one IIFE that shares the
 * page's global scope with data.js, talk.js, fr.js, i18n.js and engine.js (concatenated by build.py, order matters).
 * The engine (window.Engine, here `E`) owns the game rules and the seeded RNG; this file only renders and reacts
 * to clicks. Never call engine functions "just to look": many of them advance the seeded RNG.
 *
 * How a click works: every button carries data-act="<action>" (and often data-v="<value>").
 * onClick() looks the action up in the ACTIONS table (section "click actions", near the end), runs it, then the handler
 * calls render() (the page behind) and/or renderModal() (the overlay).
 *
 * Two state objects:
 *   S  the saved game (engine state): day, stats, relationships, log, phone threads... Saved by Store, rebuilt by
 *      the engine, read here to draw screens. Only the engine should change game rules in it.
 *   V  the UI state (never saved with a game): which tab and modal are open, sort and filter choices, the
 *      current event and its result, minigame and journal positions, and a few values loaded from prefs.
 *      Its fields are listed next to its declaration in "app state" below.
 *
 * English strings are also the keys of the French layer (tr() translates sentence by sentence; t() and L()
 * pick UI words). Changing an English sentence breaks its French translation.
 *
 * Contents (sections in file order):
 *   helpers ................ $, tr, ea (escape attribute), esc (translate + escape)
 *   i18n ................... FR table of UI words, L(en, fr), t(key), LANG and THEME
 *   preferences & a11y ..... PREF (text size, motion, sound, voice, volumes), applyA11y, savePrefs
 *   sound effects .......... SFX: tiny WebAudio synth for clicks and results
 *   background music ....... Music: live-generated moods (calm, bright, exam, win, sad, dark, menu), musMood()
 *   voice .................. Voice: browser text-to-speech for the Ball, special events and endings
 *   icons .................. IC: nav bar SVG paths
 *   storage / accounts ..... Store: local or Claude-account saves, prefs, autosave
 *   app state .............. S, V, result chips, toast
 *   render shell ........... fmtDate, hud, nav, render() (draws #root, then the modal)
 *   faint ink mystery ...... CLUES, inkHtml, clueN, revealInk, inkStatHtml
 *   Today tab .............. viewToday
 *   journal: text .......... diary lines, day text, memories of past runs, French diary, the Player's notes
 *   journal: pages ......... day pages, farewells, ending pages
 *   journal: book .......... spreads, cover, page flips, fitting text on a page
 *   avatars ................ avatar(name, size): procedural SVG faces
 *   People tab ............. item icons, sort orders, viewPeople
 *   Shop tab ............... viewShop
 *   Work tab ............... kitchen, family time, bond and cook modals, jobs
 *   Calendar tab ........... viewCal
 *   Menu tab ............... viewMenu
 *   modals ................. openModal, closeModal, renderModal, head()
 *   school minigames ....... memory and quiz games inside events
 *   events ................. showEvent, resultHtml, afterEvent
 *   run records ............ runRecord, recordRun, memOf, markEnding
 *   tutorial ............... TUT, startTut, endTut
 *   starting traits ........ TRAITS, applyTrait
 *   achievements & stats ... ACH, achCtx, showStats
 *   person profile ......... showPerson, personHtml, subHtml
 *   screens ................ login, title, game over, ending
 *   dialogs ................ saved games, endings book
 *   phone .................. contacts, unread badge, minigames, group chats, threads, showPhone
 *   run summary & note ..... summary text for testers, note for MC
 *   settings & help ........ showSettings, showHelp
 *   game start & people .... startNew, beginGame, doInter
 *   click actions .......... ACTIONS table (grouped by area) and onClick
 *   keyboard ............... onKey
 *   boot ................... event listeners, prefs loading, first render
 */
(function () {
'use strict';

/* ---------- helpers ---------- */
const E = window.Engine,
  CH = E.CH,
  DAYS = E.DAYS;
const $ = s => document.querySelector(s);
const myName = () => {
  try {
    return (S && S.name) || 'MC';
  } catch (e) {
    return 'MC';
  }
};
const tr = s => {
  try {
    I18N.setPlayer(myName());
    if (window.__trace) window.__trace.push(String(s));
    return I18N.tr(s);
  } catch (e) {
    return s;
  }
};
const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escHtml = s => s.replace(/[&<>"']/g, c => HTML_ESC[c]);
// trMC: translate to the current language, then put the player's name where the text says "MC"
const trMC = s => tr(String(s == null ? '' : s)).replace(/\bMC\b/g, () => myName());
// ea: escape only (attributes, names, raw values). esc: trMC, then escape (any English sentence shown to the player)
const ea = s => escHtml(String(s == null ? '' : s));
const esc = s => escHtml(trMC(s));

/* ---------- i18n: UI table + sentence-level FR layer (i18n.js, fr.js) ---------- */
const FR = {
  'Today': "Aujourd'hui",
  'People': 'Gens',
  'Shop': 'Boutique',
  'Work': 'Travail',
  'Calendar': 'Calendrier',
  'Menu': 'Menu',
  'POP': 'POP',
  'Grade': 'Note',
  'Money': 'Argent',
  'Time blocks': 'Blocs de temps',
  'after school': 'après les cours',
  'Journal': 'Journal',
  'After school': 'Après les cours',
  'Study': 'Étudier',
  'End day': 'Finir la journée',
  "Open today's event": "Ouvrir l'événement du jour",
  'Continue': 'Continuer',
  'New game': 'Nouvelle partie',
  'Load': 'Charger',
  'Save': 'Sauvegarder',
  'Delete': 'Supprimer',
  'Close': 'Fermer',
  'Back': 'Retour',
  'All': 'Tous',
  'Classmates': 'Camarades',
  'Family': 'Famille',
  'Teachers': 'Profs',
  'Search': 'Rechercher',
  'Relationship': 'Relation',
  'Popularity': 'Popularité',
  'Approachability': 'Abordabilité',
  'Birthday': 'Anniversaire',
  'Age': 'Âge',
  'Rumors': 'Rumeurs',
  'Buy': 'Acheter',
  'Owned': 'Possédé',
  'Use': 'Utiliser',
  'Wear': 'Porter',
  'Do it': 'Le faire',
  'Bag': 'Sac à dos',
  'Empty': 'Vide',
  'Enemy': 'Ennemi',
  'Tense': 'Tendu',
  'Neutral': 'Neutre',
  'Friend': 'Ami',
  'Close': 'Proche', // careful: this second 'Close' replaces 'Fermer' above, so t('Close') gives "Proche" everywhere
  'Talk / ask about a topic': 'Parler / sujet',
  'Give a compliment': 'Faire un compliment',
  'Give a gift': 'Offrir un cadeau',
  'Hang out': 'Traîner ensemble',
  'Invite to a group activity': 'Inviter à une activité',
  'Study together': 'Étudier ensemble',
  'Ask for help': "Demander de l'aide",
  'Ask for money': "Demander de l'argent",
  'Offer to lend money': "Prêter de l'argent",
  'Share a rumor': 'Partager une rumeur',
  'Start a rumor': 'Lancer une rumeur',
  'Investigate a rumor': 'Enquêter sur une rumeur',
  'Defend someone': 'Défendre',
  'Apologize': "S'excuser",
  'Insult': 'Insulter',
  'Debate / challenge': 'Débattre / défier',
  'Harmless prank': 'Farce inoffensive',
  'Fight / confrontation': 'Confrontation',
  'Set a boundary': 'Poser une limite',
  'End conversation': 'Finir la conversation',
  'Try to reconcile': 'Tenter de se réconcilier',
  'Game over': 'Partie perdue',
  'Your popularity hit zero.': 'Ta popularité est tombée à zéro.',
  'Play again': 'Rejouer',
  'Endings': 'Fins',
  'Help': 'Aide',
  'Language': 'Langue',
  'Saved games': 'Parties sauvegardées',
  'Autosave': 'Sauvegarde auto',
  'Empty slot': 'Emplacement vide',
  'Account': 'Compte',
  'Level': 'Niveau',
  'Day': 'Jour',
  'of': 'sur',
  'Your ending': 'Ta fin',
  'Final stats': 'Statistiques finales',
  'Also': 'Aussi',
  'Not enough money.': "Pas assez d'argent.",
  'No time blocks left.': 'Plus de blocs de temps.',
  'Needs': 'Requiert',
  'Journal is empty': 'Le journal est vide',
  'Pay': 'Paie',
  'blocks': 'blocs',
  'block': 'bloc',
  'Continue game': 'Continuer',
  'Start': 'Commencer',
  'Saved.': 'Sauvegardé.',
  'Loaded.': 'Chargé.',
  'Done': 'Terminé',
  'Hang out with booster': 'Bonus pour la sortie',
  'No booster': 'Sans bonus',
  'Topic': 'Sujet',
  'School': 'École',
  'Hobbies': 'Loisirs',
  'Daily life': 'Vie quotidienne',
  'Listen for a rumor': 'Écouter une rumeur',
  'Unknown': 'Inconnu',
  'Crossed days': 'Jours barrés',
  'Pédago': 'Pédago',
  'The Ball': 'Le bal',
  'Holiday': 'Congé',
  'School day': 'Jour de classe',
  'Theme': 'Thème',
  'Menu title': 'Menu',
  'Settings': 'Réglages',
  'Text size': 'Taille du texte',
  'Reduced motion': 'Animations réduites',
  'Sound': 'Son',
  'Voice': 'Voix',
  'On': 'Activé',
  'Off': 'Désactivé',
  'Listen': 'Écouter',
  'Stop': 'Arrêter',
  'Keyboard': 'Clavier',
  'Normal': 'Normal',
  'Large': 'Grand',
  'Extra large': 'Très grand',
  'Good endings': 'Belles fins',
  'Hard endings': 'Fins difficiles',
  'unlocked': 'débloquées',
  'Talk about someone': "Parler de quelqu'un",
  'Share a secret': 'Partager un secret',
  'Ask for advice': 'Demander conseil',
  'Sit together at lunch': 'Manger ensemble',
  'Send a message': 'Envoyer un message',
  'Tease playfully': 'Taquiner',
  'Cheer them up': 'Remonter le moral',
  'Work on a project together': 'Projet en équipe',
  'Ask to join their group': 'Rejoindre leur groupe',
};
// L('English', 'Français'): pick by language. t('Key'): look a UI word up in FR (falls back to the key).
const L = (en, fr) => (typeof LANG !== 'undefined' && LANG === 'fr' ? fr : en);
const LX = p => (LANG === 'fr' ? p[1] : p[0]); // same as L() for an [en, fr] pair
let LANG = 'en';
let THEME = 'system';
window.__LANG = () => LANG;
function applyTheme() {
  try {
    const r = document.documentElement;
    if (THEME === 'system') r.removeAttribute('data-theme');
    else r.setAttribute('data-theme', THEME);
  } catch (e) {}
}
const THEME_L = () => ({ system: 'Auto', light: L('Light', 'Clair'), dark: L('Dark', 'Sombre') })[THEME];
const RELFR = { Enemy: 'Ennemi', Tense: 'Tendu', Neutral: 'Neutre', Friend: 'Ami', Close: 'Proche' };
const relT = l => (LANG === 'fr' ? RELFR[l] : l);
const t = k => (LANG === 'fr' && FR[k]) || k;

/* ---------- preferences: text size, reduced motion, sound, voice ---------- */
FR['Music'] = 'Musique';
const PREF = { ink: false, fs: 0, rm: null, snd: true, voice: true, mus: true, muted: false, vm: 80, vs: 80, vv: 90 };
function applyVol() {
  try {
    if (SFX.g) SFX.g.gain.value = (0.55 * PREF.vs) / 100;
    if (Music.master) Music.master.gain.value = PREF.vm / 100;
  } catch (e) {}
}
const RM_AUTO = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
};
const RM_ON = () => (PREF.rm == null ? RM_AUTO() : !!PREF.rm);
function applyA11y() {
  try {
    const r = document.documentElement;
    r.classList.toggle('rm', RM_ON());
    r.lang = L('en', 'fr-CA');
    document.body.classList.toggle('inkvis', !!PREF.ink || !!V.revealed);
    document.body.classList.remove('fs1', 'fs2');
    if (PREF.fs > 0) document.body.classList.add('fs' + PREF.fs);
  } catch (e) {}
}
async function savePrefs() {
  try {
    const p = await Store.prefs();
    Store.prefs(
      Object.assign({}, p, {
        ink: PREF.ink,
        fs: PREF.fs,
        rm: PREF.rm,
        snd: PREF.snd,
        voice: PREF.voice,
        mus: PREF.mus,
        muted: PREF.muted,
        vm: PREF.vm,
        vs: PREF.vs,
        vv: PREF.vv,
      }),
    );
  } catch (e) {}
}

/* ---------- sound effects (SFX) ---------- */
/* tiny WebAudio synth: no files, quiet, only after a click, and the player can turn it off */
const SFX = {
  c: null,
  g: null,
  ctx() {
    if (!PREF.snd || PREF.muted) return null;
    try {
      if (!this.c) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.c = new AC();
        this.g = this.c.createGain();
        this.g.gain.value = (0.55 * PREF.vs) / 100;
        this.g.connect(this.c.destination);
      }
      if (this.c.state === 'suspended') this.c.resume();
      return this.c;
    } catch (e) {
      return null;
    }
  },
  note(f, at, d, type, v) {
    const c = this.ctx();
    if (!c) return;
    try {
      const o = c.createOscillator(),
        g = c.createGain();
      const t0 = c.currentTime + (at || 0);
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v || 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g);
      g.connect(this.g);
      o.start(t0);
      o.stop(t0 + d + 0.05);
    } catch (e) {}
  },
  noise(at, d, f, v) {
    const c = this.ctx();
    if (!c) return;
    try {
      const n = Math.floor(c.sampleRate * d),
        b = c.createBuffer(1, n, c.sampleRate),
        a = b.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource();
      s.buffer = b;
      const fl = c.createBiquadFilter();
      fl.type = 'bandpass';
      fl.frequency.value = f;
      fl.Q.value = 0.8;
      const g = c.createGain();
      g.gain.value = v || 0.1;
      s.connect(fl);
      fl.connect(g);
      g.connect(this.g);
      s.start(c.currentTime + (at || 0));
    } catch (e) {}
  },
  tap() {
    this.note(660, 0, 0.05, 'triangle', 0.05);
  },
  up() {
    this.note(523, 0, 0.12, 'sine', 0.1);
    this.note(784, 0.09, 0.2, 'sine', 0.1);
  },
  down() {
    this.note(392, 0, 0.14, 'triangle', 0.09);
    this.note(294, 0.11, 0.26, 'triangle', 0.09);
  },
  coin() {
    this.note(988, 0, 0.08, 'square', 0.04);
    this.note(1319, 0.07, 0.18, 'square', 0.04);
  },
  page() {
    this.noise(0, 0.16, 1800, 0.07);
  },
  chime() {
    [523, 659, 784, 1046].forEach((f, i) => this.note(f, i * 0.13, 0.5, 'sine', 0.08));
  },
  endGood() {
    [523, 659, 784, 1046, 1319].forEach((f, i) => this.note(f, i * 0.16, 0.9, 'sine', 0.09));
  },
  endBad() {
    [440, 349, 294, 220].forEach((f, i) => this.note(f, i * 0.28, 0.9, 'triangle', 0.09));
  },
  forRes(r) {
    if (!r || !r.chips) return this.tap();
    let pos = 0,
      neg = 0,
      mon = 0;
    r.chips.forEach(c => {
      if (c.k === 'flag' || c.k === 'ripple') return;
      if (c.v > 0) {
        pos++;
        if (c.k === 'money') mon++;
      } else if (c.v < 0) neg++;
    });
    if (pos && !neg) mon && pos === mon ? this.coin() : this.up();
    else if (neg && !pos) this.down();
    else if (pos && neg) {
      this.up();
    } else this.tap();
  },
};

/* ---------- background music ---------- */
/* generated live in the browser (no files). Moods crossfade: calm (class), bright (Ball, holidays), exam (minigames, tests),
   win / sad (good / hard endings), dark (low popularity), menu (title and saved games). musMood() picks one. */
const Music = {
  c: null,
  grp: null,
  mood: '',
  timer: null,
  nt: 0,
  st: 0,
  seed: 7,
  started: false,
  // one mood per entry: bpm, ch = 4 bars of [bass note, chord notes] (MIDI numbers), sc = melody scale,
  // pw = wave, hat / arp / mel = chances of hi-hat, arpeggio and melody notes, echo / motif / pulse = extras
  // prettier-ignore
  M: {
    calm:   { bpm: 78,  ch: [[36, [60, 64, 67, 71]], [33, [57, 60, 64, 67]], [41, [57, 60, 65, 69]], [43, [59, 62, 67, 71]]],
              sc: [72, 74, 76, 79, 81, 84], pw: 'sine', hat: 0.018, arp: 0.5, mel: 0.34 },
    bright: { bpm: 104, ch: [[43, [59, 62, 67, 74]], [38, [57, 62, 66, 74]], [40, [59, 64, 67, 71]], [36, [60, 64, 67, 72]]],
              sc: [79, 81, 83, 86, 88, 91], pw: 'triangle', hat: 0.025, arp: 0.8, mel: 0.5 },
    menu:   { bpm: 58,  ch: [[40, [55, 59, 64]], [36, [55, 60, 64]], [43, [55, 59, 62]], [38, [57, 62, 66]]],
              sc: [], pw: 'sine', hat: 0, arp: 0.3, mel: 0, echo: 1,
              motif: [[[0, 76], [2, 79], [3, 83], [6, 81]], [[0, 79], [3, 76], [4, 72], [6, 76]], [[0, 74], [2, 79], [3, 83], [5, 86], [7, 83]], [[0, 81], [2, 78], [4, 74], [6, 78]]] },
    exam:   { bpm: 112, ch: [[38, [57, 62, 65]], [34, [58, 62, 65]], [41, [57, 60, 65]], [33, [57, 61, 64]]],
              sc: [74, 77, 79, 81, 84], pw: 'triangle', hat: 0.03, arp: 0.9, mel: 0.3, pulse: 1 },
    win:    { bpm: 76,  ch: [[36, [60, 64, 67]], [43, [59, 62, 67]], [33, [57, 60, 64]], [41, [60, 65, 69]]],
              sc: [], pw: 'sine', hat: 0, arp: 0.3, mel: 0, echo: 1,
              motif: [[[0, 76], [2, 79], [4, 84], [6, 83]], [[0, 79], [2, 74], [3, 79], [5, 83], [7, 86]], [[0, 81], [2, 84], [4, 81], [6, 76]], [[0, 77], [2, 81], [4, 84], [6, 88]]] },
    sad:    { bpm: 54,  ch: [[33, [57, 60, 64]], [29, [57, 60, 65]], [36, [55, 60, 64]], [40, [56, 59, 64]]],
              sc: [], pw: 'sine', hat: 0, arp: 0.18, mel: 0, echo: 1,
              motif: [[[0, 81], [3, 76], [6, 72]], [[0, 77], [3, 72], [6, 69]], [[0, 72], [2, 76], [5, 79]], [[0, 76], [4, 68]]] },
    dark:   { bpm: 62,  ch: [[33, [57, 60, 64]], [29, [57, 60, 65]], [36, [55, 60, 64]], [40, [56, 59, 64]]],
              sc: [69, 72, 74, 76, 79], pw: 'sine', hat: 0, arp: 0.22, mel: 0.2 },
  },
  rnd() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  },
  f(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  },
  ctx() {
    try {
      if (!this.c) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.c = new AC();
        this.master = this.c.createGain();
        this.master.gain.value = PREF.vm / 100;
        this.master.connect(this.c.destination);
      }
      if (this.c.state === 'suspended') this.c.resume();
      return this.c;
    } catch (e) {
      return null;
    }
  },
  voice(f, t0, d, type, v, lp) {
    const c = this.c,
      g = c.createGain();
    let last = g;
    try {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + (d > 1 ? Math.min(0.9, d / 4) : 0.015));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g);
      if (lp) {
        const fl = c.createBiquadFilter();
        fl.type = 'lowpass';
        fl.frequency.value = lp;
        g.connect(fl);
        last = fl;
      }
      last.connect(this.bus || this.grp);
      o.start(t0);
      o.stop(t0 + d + 0.05);
    } catch (e) {}
  },
  tick(t0, v) {
    const c = this.c;
    try {
      const n = Math.floor(c.sampleRate * 0.04),
        b = c.createBuffer(1, n, c.sampleRate),
        a = b.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource();
      s.buffer = b;
      const fl = c.createBiquadFilter();
      fl.type = 'highpass';
      fl.frequency.value = 6000;
      const g = c.createGain();
      g.gain.value = v;
      s.connect(fl);
      fl.connect(g);
      g.connect(this.grp);
      s.start(t0);
    } catch (e) {}
  },
  step(t0) {
    const m = this.M[this.mood];
    if (!m) return;
    const sd = 60 / m.bpm / 2;
    const bar = Math.floor(this.st / 8) % 4,
      k = this.st % 8;
    const ch = m.ch[bar];
    if (k === 0) {
      ch[1].forEach((n, i) =>
        this.voice(this.f(n), t0 + i * 0.03, sd * 8.2, this.mood === 'dark' ? 'triangle' : 'sine', 0.035, 1400),
      );
      this.voice(this.f(ch[0]), t0, sd * 3.6, 'sine', 0.11);
      if (this.mood !== 'dark') this.voice(this.f(ch[0]), t0 + sd * 4, sd * 3.4, 'sine', 0.08);
    }
    if (m.pulse && k % 2 === 0) this.voice(this.f(ch[0] + 12), t0, sd * 0.9, 'triangle', 0.05, 700);
    if (m.hat && k % 2 === 1) this.tick(t0, m.hat);
    if (this.rnd() < m.arp) {
      const n = ch[1][(k * 3 + bar) % ch[1].length] + 12;
      this.voice(this.f(n), t0, sd * 1.8, m.pw, 0.045, 3200);
    }
    if (m.motif)
      m.motif[bar].forEach(x => {
        if (x[0] === k) {
          this.voice(this.f(x[1]), t0, sd * 5, 'sine', 0.07, 5200);
          this.voice(this.f(x[1] + 12), t0, sd * 2, 'sine', 0.012);
        }
      });
    if ((k === 2 || k === 5 || k === 7) && this.rnd() < m.mel) {
      const n = m.sc[Math.floor(this.rnd() * m.sc.length)];
      this.voice(this.f(n), t0, sd * 3, m.pw, 0.05, 4200);
    }
    this.st++;
  },
  tickLoop() {
    const c = this.c;
    if (!c || !this.mood) return;
    if (this.nt < c.currentTime) this.nt = c.currentTime + 0.05;
    while (this.nt < c.currentTime + 0.5) {
      this.step(this.nt);
      this.nt += 60 / this.M[this.mood].bpm / 2;
    }
  },
  set(m) {
    if (!PREF.mus || PREF.muted || !this.started) {
      this.want = m;
      return;
    }
    this.want = m;
    if (m === this.mood) return;
    const c = this.ctx();
    if (!c) return;
    const old = this.grp,
      t = c.currentTime;
    if (old) {
      try {
        old.gain.cancelScheduledValues(t);
        old.gain.setValueAtTime(old.gain.value, t);
        old.gain.linearRampToValueAtTime(0, t + 2.2);
        setTimeout(() => {
          try {
            old.disconnect();
          } catch (e) {}
        }, 2600);
      } catch (e) {}
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 2.5);
    g.connect(this.master || c.destination);
    this.grp = g;
    this.bus = g;
    if (this.M[m].echo) {
      try {
        const bus = c.createGain(),
          dl = c.createDelay(1.5),
          fb = c.createGain(),
          wet = c.createGain();
        dl.delayTime.value = (60 / this.M[m].bpm) * 0.75;
        fb.gain.value = 0.4;
        wet.gain.value = 0.42;
        bus.connect(g);
        bus.connect(dl);
        dl.connect(wet);
        wet.connect(g);
        dl.connect(fb);
        fb.connect(dl);
        this.bus = bus;
      } catch (e) {}
    }
    this.mood = m;
    this.st = 0;
    this.nt = t + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tickLoop(), 120);
  },
  start() {
    if (!PREF.mus || PREF.muted) return;
    this.started = true;
    if (!this.ctx()) return;
    this.set(this.want || 'calm');
  },
  stop() {
    this.started = false;
    this.mood = '';
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const g = this.grp;
    this.grp = null;
    if (g && this.c) {
      try {
        const t = this.c.currentTime;
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.6);
        setTimeout(() => {
          try {
            g.disconnect();
          } catch (e) {}
        }, 800);
      } catch (e) {}
    }
  },
};
window.__Music = Music;
window.__PREF = PREF;
window.__musMood = () => musMood();
function musMood() {
  try {
    if (!S || V.savesOpen) return 'menu';
    if (S && S.ending) return E.ENDBY[S.ending.id].bad ? 'sad' : 'win';
    if (S && !S.over && (V.mg || (V.evCur && /exam|test|quiz|midterm|final|report card/i.test(V.evCur.title || ''))))
      return 'exam';
    if (V.evCur && (V.evCur.kind === 'ball' || V.evCur.kind === 'holiday')) return 'bright';
    if (S && S.pop <= 30) return 'dark';
  } catch (e) {}
  return 'calm';
}
document.addEventListener('visibilitychange', () => {
  try {
    if (Music.c) document.hidden ? Music.c.suspend() : PREF.mus && Music.c.resume();
  } catch (e) {}
});
document.addEventListener(
  'pointerdown',
  () => {
    if (PREF.mus && !PREF.muted && !Music.started) Music.start();
  },
  { capture: true },
);

/* ---------- voice ---------- */
/* browser text-to-speech for a few scenes (the Ball, the big school moments, the endings); synthetic voices, not recordings */
const Voice = {
  ok() {
    try {
      return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
    } catch (e) {
      return false;
    }
  },
  vs() {
    try {
      return window.speechSynthesis.getVoices() || [];
    } catch (e) {
      return [];
    }
  },
  gender(who) {
    const w = String(who || '').trim();
    if (!w) return null;
    const c = Object.keys(CH).find(
      n =>
        n === w ||
        n.split(' ')[0] === w.split(' ')[0] ||
        n.replace(/^(Ms|Mr)\.\s*/, '').split(' ')[0] === w.replace(/^(Ms|Mr)\.\s*/, '').split(' ')[0],
    );
    if (c) return CH[c].g;
    if (/^(Mom|Maman|Ms\.|Mme)/.test(w)) return 'F';
    if (/^(Dad|Papa|Mr\.|M\.)/.test(w)) return 'M';
    return null;
  },
  voiceFor(who, g) {
    const lang = L('en', 'fr');
    const all = this.vs().filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(lang));
    if (!all.length) return null;
    const fem =
        /female|woman|zira|samantha|susan|hazel|aria|jenny|julie|hortense|amelie|amélie|denise|karen|moira|tessa|victoria|siri.*female|google.*(uk english female|français)/i,
      mal = /\bmale\b|\bman\b|david|mark|daniel|george|thomas|paul|guy|fred|alex|google uk english male|henri/i;
    const pool =
      g === 'F'
        ? all.filter(v => fem.test(v.name) && !/\bmale\b/i.test(v.name))
        : g === 'M'
          ? all.filter(v => mal.test(v.name))
          : [];
    const list = pool.length ? pool : all;
    let h = 0;
    String(who || 'n')
      .split('')
      .forEach(ch => {
        h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      });
    return list[h % list.length];
  },
  plain(s) {
    return trMC(s).replace(/ /g, ' ');
  },
  parts(text, narrator) {
    const out = [];
    const src = this.plain(text);
    const re =
      /(?:((?:Ms\.|Mr\.|Mme|M\.)\s[\p{L}'’ -]{1,24}|\p{Lu}[\p{L}'’ -]{0,28}):\s*)?[“«"]\s*([^”»"]+?)\s*[”»"]/gu;
    let last = 0,
      m,
      who = null;
    while ((m = re.exec(src))) {
      const pre = src.slice(last, m.index).trim();
      if (pre) out.push({ t: pre, who: null });
      who = m[1] ? m[1].trim() : who;
      out.push({ t: m[2], who: who || 'x' });
      last = m.index + m[0].length;
    }
    const tail = src.slice(last).trim();
    if (tail) out.push({ t: tail, who: null });
    return out;
  },
  say(parts) {
    if (!PREF.voice || PREF.muted || !this.ok()) return;
    this.stop();
    try {
      parts.forEach(pt => {
        if (!pt.t) return;
        const u = new SpeechSynthesisUtterance(pt.t);
        u.lang = L('en-US', 'fr-CA');
        let h = 0;
        String(pt.who || 'n')
          .split('')
          .forEach(ch => {
            h = (h * 17 + ch.charCodeAt(0)) >>> 0;
          });
        if (pt.who) {
          const g = this.gender(pt.who);
          const v = this.voiceFor(pt.who, g);
          if (v) u.voice = v;
          u.pitch = g === 'F' ? 1.12 + (h % 20) / 100 : g === 'M' ? 0.78 + (h % 20) / 100 : 0.95 + (h % 25) / 100;
          u.rate = 0.96 + (h % 9) / 100;
        } else {
          const v = this.voiceFor('narrator', null);
          if (v) u.voice = v;
          u.pitch = 0.92;
          u.rate = 0.94;
        }
        u.volume = (0.9 * PREF.vv) / 100;
        window.speechSynthesis.speak(u);
      });
      V.speaking = true;
    } catch (e) {}
  },
  stop() {
    try {
      if (this.ok()) window.speechSynthesis.cancel();
    } catch (e) {}
    V.speaking = false;
  },
};
const isVoiced = ev => !!ev && (ev.kind === 'ball' || ev.kind === 'special');
const evParts = ev => {
  let a = Voice.parts(ev.title).map(x => x);
  a = [{ t: Voice.plain(ev.title) + '.', who: null }].concat(Voice.parts(ev.desc));
  return a;
};
const resParts = (ev, r) => [].concat(...(r.lines || []).map(l => Voice.parts(l)));
const endParts = () => {
  const en = E.ENDBY[S.ending.id];
  return [{ t: Voice.plain(en.n) + '.', who: null }]
    .concat(Voice.parts('“' + en.q.replace(/[“”]/g, '') + '”'))
    .concat(en.body ? Voice.parts(en.body) : [])
    .concat(Voice.parts(en.moral ? L('Moral: ', 'Morale : ') + en.moral : ''));
};
const listenBtn = () =>
  PREF.voice && Voice.ok()
    ? `<button class="btn ghost small" data-act="listen" aria-label="${t('Listen')}">🔊 ${t('Listen')}` + `</button>`
    : '';

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
  `</div><div class="row" style="margin-top:12px"><button class="btn primary" data-act="close">OK` +
  `</button></div>`;
function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.setAttribute('role', 'status');
  d.textContent = tr(msg);
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

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
    `<button class="mute" data-act="mute" aria-pressed="${!!PREF.muted}"` +
    ` aria-label="${L('Mute all sound', 'Couper tout le son')}">${PREF.muted ? '🔇' : '🔊'}</button>` +
    `<div class="money">$${S.money}</div></div></div>\n  <div class="bars"><div class="bar">` +
    `<div class="lab"><span>${t('POP')}</span><b>${S.pop}/100</b></div><div class="track">` +
    `<div class="fill pop ${low ? 'low' : ''}" style="width:${S.pop}%"></div></div></div>\n  ` +
    `<div class="bar"><div class="lab"><span>${t('Grade')}</span><b>${S.grade}</b></div>` +
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
      `</p>\n    <div class="row">` +
      `<button class="btn small" data-act="study" ${S.blocks < 1 ? 'disabled' : ''}>📚 ${t('Study')} (1)` +
      `</button><button class="btn small" data-act="tab" data-v="people">💬 ${t('People')}</button>` +
      `<button class="btn small" data-act="phone">📱 ${L('Phone', 'Téléphone')}${phBadge()}</button>` +
      `<button class="btn small" data-act="tab" data-v="shop">🛍 ${t('Shop')}</button>${work}</div>\n    ` +
      `<div class="row" style="margin-top:12px">` +
      `<button class="btn primary" data-act="endday">${t('End day')} →</button></div></div>`;
  }
  const lastE = S.log.slice(-1)[0];
  return (
    `${top}<button class="card" data-act="tab" data-v="journal" style="width:100%;text-align:left">` +
    `<h3>📖 ${t('Journal')}</h3><div class="muted small">${lastE ? esc(lastE.t) : t('Journal is empty')}` +
    `</div></button>`
  );
}
/* ---------- journal: text ---------- */
/* turns log entries ("Hang out — Maya Bennett") into first-person diary sentences */
const DI = {
  'Talk / ask about a topic': 'I had a long chat with {n} today.',
  'Give a compliment': 'I told {n} something kind, and I meant it.',
  'Hang out': '{n} and I hung out after school.',
  'Invite to a group activity': 'I invited {n} to do something with a group.',
  'Study together': '{n} and I studied together.',
  'Ask for help': 'I asked {n} for a hand.',
  'Ask for money': 'I asked {n} for some money. It felt awkward.',
  'Offer to lend money': 'I offered to lend {n} some money.',
  'Share a rumor': 'I passed a rumour on to {n}. Hmm.',
  'Start a rumor': 'I started a rumour about {n}. I hope it never comes back to me.',
  'Investigate a rumor': 'I looked into a rumour about {n}.',
  'Defend someone': 'I stood up for {n}.',
  'Apologize': 'I apologized to {n}.',
  'Insult': 'I said something harsh to {n}. I am not proud of it.',
  'Debate / challenge': '{n} and I got into a debate.',
  'Harmless prank': 'I pulled a harmless prank on {n}.',
  'Fight / confrontation': '{n} and I had a confrontation.',
  'Set a boundary': 'I set a boundary with {n}.',
  'Try to reconcile': 'I tried to make peace with {n}.',
  'Share a secret': 'I told {n} a secret.',
  'Ask for advice': 'I asked {n} for advice.',
  'Sit together at lunch': 'I sat with {n} at lunch.',
  'Send a message': 'I texted {n}.',
  'Tease playfully': 'I teased {n}, just for fun.',
  'Cheer them up': 'I tried to cheer {n} up.',
  'Work on a project together': '{n} and I worked on a project together.',
  'Ask to join their group': "I asked to join {n}'s group.",
};
const fn1 = n => (/^(Ms|Mr|Mrs|Dr)\./.test(n) ? n : String(n).split(' ')[0]);
const me = x =>
  String(x)
    .replace(/\byou are\b/gi, 'I am')
    .replace(
      /\byou (?=(previously|have|had|were|do|did|can|will|would|just|still|really|always|never|want|need|like|may|might|could|should)\b)/gi,
      'I ',
    )
    .replace(
      /\b(someone|somebody|anyone|anybody|everyone|everybody|person|friend|classmate|people|those|what|whom|who|that|than|when|where|because|if|while|before|after|until|since|though) you\b/gi,
      '$1 I',
    )
    .replace(/\byourself\b/gi, 'myself')
    .replace(/\byour\b/gi, 'my')
    .replace(/\byou\b/gi, 'me')
    .replace(/\bYou\b/g, 'I');
const lc1 = x => x.charAt(0).toLowerCase() + x.slice(1);
function diary(l) {
  const x = l.t;
  let m;
  if ((m = x.match(/^(.+?) — (.+)$/)) && DI[m[1]]) return DI[m[1]].replace('{n}', fn1(m[2]));
  if ((m = x.match(/^Talked about (.+) with (.+)$/)))
    return 'I talked about ' + fn1(m[1]) + ' with ' + fn1(m[2]) + '. Maybe I should not have.';
  if (x === 'Studied after school') return 'I stayed behind to study. My head is full of notes.';
  if ((m = x.match(/^Cooked (.+) for (myself|the family|.+)$/)))
    return (
      'I cooked ' +
      (/^Mom/.test(m[1]) ? m[1] : lc1(m[1])) +
      ' for ' +
      (m[2] === 'myself' || m[2] === 'the family' ? m[2] : fn1(m[2])) +
      '. The kitchen smelled wonderful.'
    );
  if ((m = x.match(/^Spent time with (.+?): (.+)$/)))
    return 'I spent time with ' + fn1(m[1]) + ': ' + lc1(m[2]) + '. It felt good to just be together.';
  if (x === "Riley's hidden card")
    return "I opened Riley's card on the worst day. It said exactly what I needed to hear.";
  if ((m = x.match(/^Worked: (.+)$/)))
    return 'I worked a shift today (' + lc1(m[1]) + '). My feet hurt, but my wallet is happier.';
  if ((m = x.match(/^Met (.+)$/))) return 'I met ' + fn1(m[1]) + ' today. Maybe we will get along.';
  if ((m = x.match(/^Bought (.+)$/))) return 'I treated myself and bought ' + lc1(m[1]) + '.';
  if ((m = x.match(/^Used (.+)$/))) return 'I used my ' + lc1(m[1]) + '.';
  if ((m = x.match(/^Gave (.+) to (.+)$/)))
    return 'I gave ' + fn1(m[2]) + ' a ' + lc1(m[1]) + '. I hope they liked it.';
  if (x === 'Ball — going alone') return 'The Ball: I decided to go on my own terms.';
  if ((m = x.match(/^Ball — (.+) accepted your invitation$/)))
    return fn1(m[1]) + ' said yes to the Ball! I am still smiling.';
  if ((m = x.match(/^Ball — (.+) declined$/))) return fn1(m[1]) + ' said no to the Ball. It stung a little.';
  if ((m = x.match(/^(.+) paid you back \$(\d+)$/))) return fn1(m[1]) + ' paid me back $' + m[2] + '. A promise kept.';
  if ((m = x.match(/^(.+) still has not paid you back\.$/))) return fn1(m[1]) + ' still has not paid me back.';
  if ((m = x.match(/^The Ball — (.+?) — (.+)$/))) {
    if (LANG === 'fr')
      return (
        'Au bal (' +
        tr(m[1]).replace(/^./, c => c.toLowerCase()) +
        ') : ' +
        frDe(pk(["j'ai décidé de", "j'ai choisi de", "j'ai pris la décision de"], m[2]), frAct(m[2])) +
        '.'
      );
    const pre = ['I decided to', 'I chose to', 'I made up my mind to'][m[2].length % 3];
    return 'At the Ball (' + lc1(m[1]) + '): ' + pre + ' ' + me(lc1(m[2])).replace(/\s*\([^)]*\)/g, '') + '.';
  }
  if ((m = x.match(/^(.+?) — (.+)$/))) {
    const pre = ['Today I decided to', 'I chose to', 'In the end, I decided to', 'I made up my mind to'][
      (l.t.length + (l.t.charCodeAt(2) || 0)) % 4
    ];
    const c = me(lc1(m[2])).replace(/\s*\([^)]*\)/g, '');
    return m[1].replace(/[.:!?]+$/, '') + '. ' + pre + ' ' + c + '.';
  }
  return me(x);
}
/* journal: 195 day pages + 5 ending pages. hsh/pk give stable "random" picks from a date or name. */
const JN = () => E.DAYS.length + 5;
const hsh = E.hash; // 32-bit FNV-1a of String(x), unsigned: the engine's hash (also used for avatars)
const pk = (arr, seed) => arr[hsh(seed) % arr.length];
const listJoin = a => (a.length <= 1 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const OPEN = [
  'Another day at school.',
  'I almost overslept this morning, and my hair shows it.',
  'The hallway smelled like floor wax and pencil shavings.',
  'It was one of those days where the clock moves slowly.',
  'I woke up with a funny feeling about today.',
  'My backpack feels heavier every week.',
  'The bus was loud, as usual, and I had my window seat.',
  'I packed my lunch twice and still forgot a spoon.',
  'The sky was grey, which somehow made everything feel more important.',
  'I can hardly believe how fast this year is going.',
];
const OPEN_MON = ['Monday again. My brain is still on the weekend.', 'Mondays are slow, but I got through it.'];
const OPEN_FRI = [
  'Friday at last! Everyone in the hallway was lighter somehow.',
  'It is Friday and the whole school feels like it is exhaling.',
];
const CLOSE_UP = [
  'I fell asleep smiling.',
  'I think that was a good day.',
  'I felt a little taller walking home.',
  'I want to remember this one.',
  'Today was kinder than I expected.',
];
const CLOSE_DN = [
  'I stared at the ceiling for a long time tonight.',
  'I wish I could take part of today back.',
  'I will try to do better tomorrow.',
  'Sleep will not come easily tonight.',
  'Some days sit heavy on my chest.',
];
const CLOSE_NEU = [
  'Tomorrow is another day.',
  'Nothing dramatic. Sometimes that is a nice thing.',
  'I am tired, in a good, ordinary way.',
  'Time to rest. Tomorrow will come on its own.',
  'Lights out. I will think about it in the morning.',
];
const TITLE_T = [
  "Today's big thing: {t}.",
  'At school it was {t}.',
  '{t}. That was the main event today.',
  'Today we had {t}.',
];
function dayText(i) {
  const date = E.DAYS[i].d;
  const L = S.log.filter(l => l.d === date);
  const wd = new Date(date + 'T12:00:00Z').getUTCDay();
  const out = [];
  if (L.length < 3)
    out.push(
      wd === 1 && hsh(date) % 2 ? pk(OPEN_MON, date) : wd === 5 && hsh(date) % 2 ? pk(OPEN_FRI, date) : pk(OPEN, date),
    );
  {
    const ml = memLine(i);
    if (ml) out.push(ml);
  }
  const pop = { v: 0 },
    gr = { v: 0 },
    mo = { v: 0 };
  const rel = {};
  let goss = 0,
    fl = [];
  L.forEach((l, li) => {
    if (li < 3) out.push(diaryDay(l));
    (l.c || []).forEach(c => {
      if (c.k === 'pop') pop.v += c.v;
      else if (c.k === 'grade') gr.v += c.v;
      else if (c.k === 'money') mo.v += c.v;
      else if (c.k === 'rel') rel[c.n] = (rel[c.n] || 0) + c.v;
      else if (c.k === 'gossip') goss += c.v;
    });
  });
  if (!L.length) out.push('Nothing worth writing down happened. I just kept my head down and got through the day.');
  const big = [],
    mid = [],
    sml = [],
    hurt = [],
    upset = [],
    cool = [];
  Object.keys(rel).forEach(n => {
    const v = rel[n],
      f = fn1(n);
    if (v >= 8) big.push(f);
    else if (v >= 3) mid.push(f);
    else if (v > 0) sml.push(f);
    else if (v <= -8) hurt.push(f);
    else if (v <= -3) upset.push(f);
    else if (v < 0) cool.push(f);
  });
  const eff = [];
  const cap = a => a.slice(0, 3);
  if (big.length) eff.push('I feel much closer to ' + listJoin(cap(big)) + ' now.');
  if (mid.length) eff.push('I became closer to ' + listJoin(cap(mid)) + '.');
  if (sml.length)
    if (!big.length && !mid.length)
      eff.push(listJoin(cap(sml)) + (sml.length > 1 ? ' were' : ' was') + ' a little friendlier with me.');
  if (hurt.length) eff.push('I really hurt ' + listJoin(cap(hurt)) + ', and I know it.');
  if (upset.length) eff.push('I think I upset ' + listJoin(cap(upset)) + '.');
  if (cool.length && !hurt.length && !upset.length) eff.push(listJoin(cap(cool)) + ' seemed a bit cooler toward me.');
  if (pop.v >= 4) eff.push('It felt like the whole class liked me more today.');
  else if (pop.v > 0) eff.push('A few people noticed me, in a good way.');
  else if (pop.v <= -4) eff.push('I could feel people pulling away from me.');
  else if (pop.v < 0) eff.push('I think I lost a little standing today.');
  if (gr.v >= 3) eff.push('My marks are climbing, and I can feel it.');
  else if (gr.v > 0) eff.push('I actually learned something.');
  else if (gr.v < 0) eff.push('My grades took a hit. Ugh.');
  if (mo.v > 0) eff.push('I earned $' + mo.v + '.');
  else if (mo.v < 0) eff.push('I spent $' + Math.abs(mo.v) + '.');
  if (goss) eff.push('I gossiped, and part of me regrets it.');
  if (eff.length > 3) eff.length = 3;
  const score = pop.v + gr.v + Object.keys(rel).reduce((a, n) => a + rel[n], 0);
  const cl = L.length
    ? score >= 4
      ? pk(CLOSE_UP, date)
      : score <= -4
        ? pk(CLOSE_DN, date)
        : pk(CLOSE_NEU, date)
    : pk(CLOSE_NEU, date);
  return { main: out, eff, cl };
}
const DEJA = [
  "I had the strangest feeling that I've lived this day before.",
  'Everything felt familiar, like a song I forgot I knew.',
  'For a second I knew exactly what the teacher would say. Then it slipped away.',
  'My hands moved before my head did, as if they remembered something.',
  'It is like I have walked this hallway a hundred times on different feet.',
  'I keep catching myself on the edge of a memory that is not mine.',
];
const FOEL = [
  'I keep wanting to apologize to {X} and I do not know why. We have hardly talked.',
  'Something about {X} makes my stomach drop. I could not tell you what I did.',
  'I looked at {X} and felt guilty, like I owe them something.',
];
const FRL = [
  'Being near {Y} feels like coming home, and we barely know each other yet.',
  'I trust {Y}, and I cannot explain it. It feels earned somewhere else.',
];
const ENDB = [
  'There is a heavy feeling in my chest about how this year ends, like a dream that left a stain.',
  'I am afraid of the last page of this year, and I do not know why.',
];
const ENDG = [
  'I have a quiet feeling that this year can end well, if I am careful.',
  'Something in me says the end of this year is worth reaching.',
];
const PRES = [
  'Sometimes it feels like someone else is deciding, and I am only the hand that writes it down.',
  'I get the sense I am being watched, gently. Like someone is waiting to see what I will choose.',
  'There is a pause before every choice, as if someone out there is thinking it over.',
  'I do not think I am the only one in this diary.',
];
const DIRL = [
  'If you are out there, the one who picks for me: be kind to me. I am trying to be kind to them.',
  'You keep coming back. I do not know who you are, but I am glad you do.',
  'Whoever you are, I want you to know none of this is your fault, and all of it matters.',
  'I notice when you hesitate. Thank you for taking your time with me.',
];
function memLine(i) {
  if (i === 0 && S.note)
    return (
      'On the first page, in handwriting that is not mine, someone left a line: “' +
      S.note +
      '” I read it twice. It felt like being looked after.'
    );
  const m = S.mem;
  if (!m) return null;
  const date = E.DAYS[i].d;
  const last = E.DAYS.length - 1;
  if (i === 0) return 'Today felt like a second try at something, though I could not say what.';
  if (i === last) return 'I have a feeling I have stood at this last bell before.';
  if (hsh(S.seed + 'm' + i) % 11 !== 0) return null;
  const pools = [DEJA, DEJA];
  if (m.foes.length) pools.push(FOEL);
  if (m.friends.length) pools.push(FRL);
  pools.push(m.last.bad ? ENDB : ENDG);
  if (m.n >= 2) pools.push(PRES, PRES);
  if (m.n >= 3) pools.push(DIRL, DIRL);
  const pool = pools[hsh(date + 'p') % pools.length];
  return pk(pool, date + 'q')
    .replace('{X}', fn1(pk(m.foes.length ? m.foes : ['someone'], date)))
    .replace('{Y}', fn1(pk(m.friends.length ? m.friends : ['someone'], date + 'y')));
}
const FR_TT = [
  'Le gros événement du jour : {t}.',
  "À l'école, c'était {t}.",
  "{t}. C'était l'événement principal aujourd'hui.",
  "Aujourd'hui, au programme : {t}.",
];
const FR_PRE = [
  "Aujourd'hui, j'ai décidé de",
  "J'ai choisi de",
  "Au final, j'ai décidé de",
  "J'ai pris la décision de",
];
const frYou = x =>
  x
    .replace(/\bs'/gi, "m'")
    .replace(/\bse /gi, 'me ')
    .replace(/\bsoi\b/gi, 'moi')
    .replace(/\btu es\b/gi, 'je suis')
    .replace(/\btu as\b/gi, "j'ai")
    .replace(/\bt'/gi, "m'")
    .replace(/\btu\b/gi, 'je')
    .replace(/\bton\b/gi, 'mon')
    .replace(/\bta\b/gi, 'ma')
    .replace(/\btes\b/gi, 'mes')
    .replace(/\bte\b/gi, 'me')
    .replace(/\btoi\b/gi, 'moi')
    .replace(/\bvotre\b/gi, 'mon');
const frDe = (pre, c) => (/^[aeiouyéèêàâîôûhAEIOUYÉ]/.test(c) ? pre.replace(/de$/, "d'") + c : pre + ' ' + c);
const frAct = x =>
  frYou(tr(x))
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[.\s]+$/, '')
    .replace(/^./, c => c.toLowerCase());
function diaryDay(l) {
  const x = l.t;
  let m;
  if (
    LANG === 'fr' &&
    (m = x.match(/^(.+?) — (.+)$/)) &&
    !DI[m[1]] &&
    !/^Ball$/.test(m[1]) &&
    !/^The Ball$/.test(m[1])
  ) {
    const ttl = tr(m[1].replace(/[.:!?]+$/, ''));
    return pk(FR_TT, x).replace('{t}', ttl) + ' ' + frDe(pk(FR_PRE, x + 'f'), frAct(m[2])) + '.';
  }
  if ((m = x.match(/^(.+?) — (.+)$/)) && !DI[m[1]] && !/^Ball$/.test(m[1]) && !/^The Ball$/.test(m[1])) {
    const c = me(lc1(m[2]))
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/[.\s]+$/, '');
    const ttl = m[1].replace(/[.:!?]+$/, '');
    const pre = pk(['Today I decided to', 'I chose to', 'In the end, I decided to', 'I made up my mind to'], x);
    return pk(TITLE_T, x).replace('{t}', ttl) + ' ' + pre + ' ' + c + '.';
  }
  return diary(l);
}
/* ---------- journal: pages ---------- */
const dayHead = d => {
  const dt = new Date(d + 'T12:00:00Z');
  return dt.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
};
const rot = s => ((hsh(s) % 9) - 4) / 10;
function pg(inner, num, cls, face) {
  return (
    `<div class="pg ${cls || ''} ${face ? 'f' + face : ''}"><div class="inner">${inner}</div>` +
    (num ? `<div class="pn">— ${num} —</div>` : '') +
    `</div>`
  );
}
const PEN = [
  '#1f4e8c',
  '#2e6b3a',
  '#6b2f8c',
  '#0f6b6b',
  '#a65a00',
  '#8c2f5a',
  '#3d3d9c',
  '#6b6b00',
  '#2b6f87',
  '#7a3b1d',
];
function penOf(name) {
  V.pens = V.pens || {};
  if (!V.pens[name]) V.pens[name] = PEN[Object.keys(V.pens).length % PEN.length];
  return V.pens[name];
}
/* the Player's own hand: pencil margin notes (a separate character from MC), written in faint ink */
const PL_UP = [
  'That felt right. I think.',
  'Good choice. I smiled at this one.',
  'Nice. Keep going, you are doing fine.',
  'I liked this day.',
];
const PL_DN = [
  'I am sorry. That one was on me.',
  'I was not sure about that choice. I should have waited.',
  'I wish I had picked differently.',
  'Rough day. I felt it too.',
];
const PL_NEU = [
  'A quiet day. I do not mind those.',
  'I was just watching today.',
  'Nothing dramatic. I like the quiet ones.',
  'Small days matter too.',
];
const PL_RUN = [
  'I remember this day. It went differently last time.',
  'I am trying something new this time.',
  'I know how this part goes. I hope I am kinder now.',
  'Last time I got this wrong. Sorry.',
];
const PL_REPLY = [
  'I hear you. I am here.',
  'I am sorry I keep coming back. I want to get it right.',
  'It matters. You matter.',
  'Thank you for writing to me.',
];
const PL_HOL = [
  'A day off. I think we both needed this.',
  'Holidays feel softer from where I sit.',
  'No bells today. I like how quiet it is.',
  'Rest is part of the story too.',
];
const PL_BD = [
  'Remembering a birthday is a small kind of magic.',
  'I like how you made someone feel seen today.',
  'Cake or no cake, it counted.',
];
const PL_WORK = [
  'You earned that yourself. I noticed.',
  'Hard work looks good on you.',
  'Pocket money feels different when you earn it.',
];
const PL_LOW = [
  'Your popularity is low right now. I am worried, and I am here.',
  'Take a breath. One kind choice can turn a week around.',
  'Do not give up on the people who are still here.',
];
const PL_BALL = [
  'Tonight is the one I have been waiting for. I hope you feel brave.',
  'Whatever happens at the Ball, I am proud of this year.',
];
const PL_FAM = [
  'Family days are the ones I remember longest.',
  'Your family noticed. I know they did.',
  'Home is part of the story too.',
];
const PL_TEST = [
  'Tests are scary. You were braver than you think.',
  'Whatever the score, you showed up.',
  'One result is not the whole year.',
];
function plNote(i, T, hasLog) {
  const date = E.DAYS[i].d;
  const m = S.mem;
  let t = null;
  const lg = hasLog
    ? S.log
        .filter(l => l.d === date)
        .map(l => l.t)
        .join(' | ')
    : '';
  if (i === 0)
    t = m
      ? 'Hello again, ' + myName() + '. I came back. — P.'
      : 'Hi. I am the one choosing. I will try to be good to you. — P.';
  else if (hasLog && date === E.BALL_DAY) t = pk(PL_BALL, date + 'pb') + ' — P.';
  else if (hasLog && Object.values(E.HOLIDAYS).some(h => lg.includes(h.t))) t = pk(PL_HOL, date + 'ph') + ' — P.';
  else if (hasLog && /birthday/i.test(lg)) t = pk(PL_BD, date + 'pd') + ' — P.';
  else if (hasLog && /Worked:/.test(lg) && hsh(date + 'pw') % 2 === 0) t = pk(PL_WORK, date + 'pw2') + ' — P.';
  else if (hasLog && S.pop <= 20 && i >= S.di - 6 && hsh(date + 'pl') % 2 === 0) t = pk(PL_LOW, date + 'pl2') + ' — P.';
  else if (hasLog && /\b(Mom|Dad)\b/.test(lg) && hsh(date + 'pf') % 3 === 0) t = pk(PL_FAM, date + 'pf2') + ' — P.';
  else if (hasLog && /test|quiz|exam|checkpoint/i.test(lg) && hsh(date + 'pt') % 3 === 0)
    t = pk(PL_TEST, date + 'pt2') + ' — P.';
  else if (hsh(S.seed + 'pl' + i) % 9 === 0 && hasLog) {
    const sc = T.cl;
    const up = CLOSE_UP.includes(sc),
      dn = CLOSE_DN.includes(sc);
    const pools = [up ? PL_UP : dn ? PL_DN : PL_NEU];
    if (m) pools.push(PL_RUN);
    if (m && m.n >= 3) pools.push(PL_REPLY);
    t = pk(pools[hsh(date + 'pp') % pools.length], date + 'pq') + ' — P.';
  }
  if (t && i === 0 && !(S.meta && S.meta.clues >= 3)) t = 'Can you read this?';
  else if (t) t = t.replace(/ — P\.$/, S.meta && S.meta.clues >= 6 ? ' — P.' : '');
  return t
    ? `<p class="pl fink${V.clues && V.clues['n:' + date] ? ' on' : ''}" data-clue="n:${date}" tabindex="0" role="note" data-opt="3"` +
        ` style="transform:rotate(${(rot(date + 'P') * 5).toFixed(1)}deg)">` +
        (Object.keys(V.clues || {}).length ? '' : '<i class="blot" aria-hidden="true"></i>') +
        `${esc(t)}</p>`
    : '';
}
function jPageHtml(i, face) {
  const nD = E.DAYS.length;
  const num = i + 1;
  if (i < nD) {
    const d = E.DAYS[i].d;
    const has = S.log.some(l => l.d === d);
    if (i > S.di) return pg(`<h4 class="pencil">${esc(dayHead(d))}</h4>`, num, 'future', face);
    if (!has && i === S.di)
      return pg(
        `<h4>${esc(dayHead(d))}</h4><p class="dd">${esc('Dear diary,')}</p><p class="hw faint">…</p>`,
        num,
        '',
        face,
      );
    const T = dayText(i);
    const body =
      `<h4>${esc(dayHead(d))}</h4><p class="dd">${esc('Dear diary,')}</p>` +
      T.main
        .map(
          (p, k) =>
            `<p class="hw" style="transform:rotate(${rot(d + k)}deg);margin-left:${hsh(d + k) % 4}px">${esc(p)}` +
            `</p>`,
        )
        .join('') +
      (S.th && S.th[d] ? `<p class="hw th" style="transform:rotate(${rot(d + 't')}deg)">${esc(S.th[d])}</p>` : '') +
      (T.eff.length
        ? `<p class="hw" style="transform:rotate(${rot(d + 'e')}deg)">` +
          T.eff.map((e, k) => `<span${k ? ' data-opt="1"' : ''}>${esc(e)}</span>`).join(' ') +
          `</p>`
        : '') +
      `<p class="hw" data-opt="2">${esc(T.cl)}</p><p class="hw sig">— ${esc(myName())}</p>` +
      plNote(i, T, has);
    return pg(body, num, '', face);
  }
  const k = i - nD;
  const done = S.ending || S.over;
  if (!done)
    return pg(
      `<h4 class="pencil">${k === 0 ? 'The last pages' : ''}</h4><p class="hw faint">` +
        (k === 0 ? 'These pages are still blank. Some stories can only be written once the year is over.' : '') +
        `</p>`,
      num,
      'future',
      face,
    );
  return pg(endPage(k), num, 'long', face);
}
const FARE = [
  [
    'I hope we are not in the same class next year.',
    'Do not expect a card from me.',
    'Let us just say we are done.',
    'Do not wave at me this summer.',
  ],
  [
    'Well. Have a nice summer, I guess.',
    'It was a year. That is all I will say.',
    'See you in the fall. Maybe.',
    'Good luck, I suppose.',
  ],
  ['See you around, {n}.', 'Have a good summer!', 'Take care, {n}.', 'Maybe we will talk next year.'],
  [
    'It was a good year with you, {n}.',
    'Text me this summer, okay?',
    'Thanks for being around, {n}.',
    'I had fun this year, {n}.',
  ],
  [
    'I am really glad we ended up friends, {n}.',
    'You made this year better, {n}.',
    'Promise you will not forget me, {n}?',
    'Best year ever, and a lot of it was you.',
  ],
];
function fare(name) {
  const v = S.rel[name];
  const t = v <= -40 ? 0 : v <= -10 ? 1 : v < 20 ? 2 : v < 60 ? 3 : 4;
  const f = pk(FARE[t], name + 'f' + S.pop).replace('{n}', myName());
  const col = penOf(name);
  return `<p class="hw" style="color:${col}"><span class="who">${esc(fn1(name))}:</span> “${esc(f)}”</p>`;
}
const nar = t => `<p class="hw nar">${esc(t)}</p>`,
  mcp = t => `<p class="hw mc">${esc(t)}</p>`;
function plEnd(good) {
  const m = S.mem;
  return (
    `<p class="pl fink${V.clues && V.clues['n:end'] ? ' on' : ''}" data-clue="n:end" tabindex="0" role="note"` +
    ` style="transform:rotate(-2deg);margin:0 0 .6em">` +
    esc(
      (good
        ? 'Thank you for letting me write this with you, ' + myName() + '.'
        : 'I am sorry, ' + myName() + '. I would like to try again, and do better by you.') +
        (m && m.n >= 2 ? ' This is not our first year together.' : '') +
        (S.meta && S.meta.clues >= 6 ? ' — P.' : ''),
    ) +
    `</p>`
  );
}
function endPage(k) {
  const x = E.stats(S);
  const nm = myName();
  const kids = E.metKids(S)
    .slice()
    .sort((a, b) => S.rel[b] - S.rel[a]);
  const best = kids[0],
    worst = kids[kids.length - 1];
  const day = E.dayOf(S).d;
  const over = S.over && !S.ending;
  const en = S.ending ? E.ENDBY[S.ending.id] : null;
  const epi = S.ending ? S.ending.epi.map(id => E.ENDBY[id]).filter(Boolean) : [];
  const h = t => `<h4 class="nar">${esc(t)}</h4>`;
  if (over) {
    if (k === 0)
      return (
        h('The day it all fell apart') +
        nar(
          'It was ' +
            dayHead(day) +
            '. ' +
            nm +
            ' looked around the hallway and realised that nobody was looking back. Popularity had run out, and with it, a place in this school.',
        ) +
        mcp('I did not see it happening until it was already done.')
      );
    if (k === 1)
      return (
        h('How it got there') +
        nar('There were ' + S.log.length + ' entries in this book. Each one looked small on the day it was written.') +
        mcp('Reading them again, I can see the moments where I could have chosen differently.') +
        mcp(
          worst && S.rel[worst] < 0
            ? fn1(worst) + ' and I never really made peace.'
            : 'Some people never knew the real me.',
        )
      );
    if (k === 2) return h('What they said') + nar('Nobody made a speech.') + fare(best) + fare(worst);
    if (k === 3)
      return (
        h('What might have been') +
        nar('Being liked and being known are two different things. ' + nm + ' learned that the hard way.') +
        mcp('I wish I had asked more people how they were. I wish I had said sorry sooner.')
      );
    return (
      h('The last line') +
      nar('The journal does not end here. The person writing in it does not have to either.') +
      mcp('This is not how I wanted my year to end. But I am still here, and I am still writing.') +
      `<p class="hw sig mc">— ${esc(nm)}</p>`
    );
  }
  if (k === 0)
    return (
      h('The last day') +
      nar(
        'It was ' +
          dayHead(day) +
          '. The last bell rang, and the hallways filled with a noise that sounded like summer. ' +
          nm +
          ' walked out with POP ' +
          S.pop +
          ', a grade of ' +
          S.grade +
          ' and $' +
          S.money +
          ' in a pocket.',
      ) +
      nar(best ? 'The person ' + nm + ' stayed closest to was ' + fn1(best) + '. ' : '') +
      nar(
        worst && S.rel[worst] < -10
          ? fn1(worst) + ' was the one thing left unfixed.'
          : 'No real enemy followed ' + nm + ' out of the gates.',
      ) +
      mcp("I flipped back through this journal tonight. It read like someone else's life, and also exactly like mine.")
    );
  if (k === 1) {
    const mq = en.q.replace(/^[“"]|[”"]$/g, '');
    return (
      h(en.n) +
      nar(en.moral) +
      (en.body
        ? mcp(en.body)
        : mcp(
            'That is what it came down to. Not one big moment, but a hundred small choices I did not even notice making.',
          )) +
      `<p class="hw mc big">“${esc(mq)}”</p>`
    );
  }
  if (k === 2) {
    const mine = kids.slice(0, 3).map(fare).join('');
    const bad = worst && S.rel[worst] < 0 ? fare(worst) : '';
    const mom = E.CH['Mom']
      ? `<p class="hw" style="color:${penOf('Mom')}"><span class="who">${esc('Mom')}:</span> “` +
        esc(S.pop >= 40 ? 'I am proud of you, ' + nm + '.' : 'Whatever happened, I am proud of you, ' + nm + '.') +
        `”</p>`
      : '';
    return h('What they said') + nar('At the gate, a few people stopped.') + mine + bad + mom;
  }
  if (k === 3) {
    if (!epi.length)
      return (
        h('Other things to remember') +
        nar('No other story stuck out as much as the main one.') +
        mcp(
          'Maybe that is how I know it was real. The smaller moments are still here, in the margins of the pages before this one.',
        )
      );
    return (
      h('Other things to remember') +
      epi
        .map(
          e =>
            `<p class="hw nar"><b>${esc(e.n)}</b></p><p class="hw mc">“${esc(e.q.replace(/^[“"]|[”"]$/g, ''))}”` +
            `</p><p class="hw nar">${esc(e.moral)}</p>`,
        )
        .join('')
    );
  }
  const good = !en.bad;
  return (
    h('What ' + nm + ' feels now') +
    mcp(
      good
        ? 'Strangely, I feel lighter than I thought I would. Not because everything went perfectly, but because I can look at what I did and recognise myself.'
        : 'I feel heavy, and a bit ashamed. I got what I wanted, and I am not sure I wanted the right thing.',
    ) +
    mcp(
      x.kind >= 3
        ? 'The kind things I did are the parts I would live again.'
        : 'I wish I had been braver about doing the kind thing more often.',
    ) +
    mcp(
      S.grade >= 80
        ? 'My grades turned out all right, and I earned them.'
        : S.grade < 50
          ? 'My grades were not my best work, and I know it.'
          : 'My grades were fine. Not amazing, not terrible.',
    ) +
    nar('And that was the year.') +
    (!S.mem
      ? mcp('Sometimes it felt like I was not the only one holding the pen.')
      : mcp(
          S.mem.last.id === (S.ending && S.ending.id)
            ? 'The same ending as last time. Maybe some things find us either way.'
            : 'It ended differently than I felt it would. I am glad.',
        )) +
    (S.mem && S.mem.n >= 2 ? mcp('To whoever keeps turning my pages: thank you for this year.') : '') +
    mcp('Next year is a new page.') +
    `<p class="hw sig mc">— ${esc(nm)}</p>` +
    plEnd(good)
  );
}
/* ---------- journal: book ---------- */
/* spreads: s=-1 front cover, 0..100 open spreads, 101 back cover. Spread 0: [endpaper | p1]; s: [p(2s) | p(2s+1)]; 100: [p200 | endpaper] */
const JS_MAX = 100;
const endpaperHtml = () => `<div class="pg endp"><div class="inner">✦</div></div>`;
const slotL = (s, f) => (s === 0 ? endpaperHtml() : jPageHtml(2 * s - 1, f));
const slotR = (s, f) => (s === JS_MAX ? endpaperHtml() : jPageHtml(2 * s, f));
const spreadOf = i => (i === 0 ? 0 : i % 2 === 1 ? (i + 1) / 2 : i / 2);
const curSpread = () => (V.jFinal ? spreadOf(E.DAYS.length) : spreadOf(Math.min(S.di, E.DAYS.length - 1)));
function viewJournal() {
  if (V.jS == null) V.jS = V.jFinal ? curSpread() : -1;
  const s = V.jS;
  const open = s >= 0 && s <= JS_MAX;
  const cover =
    `<button class="cover${open || s > JS_MAX ? ' gone' : ''}" data-act="jopen"` +
    ` aria-label="${L('Open the journal', 'Ouvrir le journal')}"><span class="spine"></span>` +
    `<span class="stitch"></span><span class="emb">✎</span><span class="ttl">` +
    (LANG === 'fr'
      ? 'Journal<br>' + (myName() === 'MC' ? 'scolaire' : 'de ' + ea(myName()))
      : esc(myName() === 'MC' ? 'School Life' : myName() + "'s") + '<br>Journal') +
    `</span><span class="sub">savepoint</span><span class="strap"></span>` +
    `<span class="hint">${L('Tap to open', 'Touche pour ouvrir')}</span></button>`;
  const back =
    `<div class="bcover${s > JS_MAX ? ' show' : ''}" id="bcover"><span class="stitch"></span>` +
    `<span class="ttl">${L('The End', 'Fin')}</span><span class="sub">${esc(myName())}, 2026–2027</span>` +
    `</div>`;
  const sp = open
    ? `<div class="slot sl" id="sl">${slotL(s)}</div><div class="slot sr" id="sr">${slotR(s)}</div>`
    : `<div class="slot sl" id="sl"></div><div class="slot sr" id="sr"></div>`;
  return (
    `<div class="jr"><div class="book" id="book"><div class="frame"></div>${cover}` +
    `<div class="spread" id="spread"${open ? '' : ' style="visibility:hidden"'}>${sp}</div>${back}` +
    `</div>\n  <div class="jnav"><button class="btn small" data-act="jprev" id="jprev">‹</button>` +
    `<span class="cnt" id="jcnt"></span><button class="btn small" data-act="jnext" id="jnext">›</button>` +
    `</div>\n  <div class="row" style="justify-content:center">` +
    `<button class="btn small" data-act="jtoday">` +
    (V.jFinal ? L('Last pages', 'Dernières pages') : L('Today', "Aujourd'hui")) +
    `</button><button class="btn ghost small" data-act="jclose">` +
    (V.jFinal ? L('Back', 'Retour') : L('Close the journal', 'Fermer le journal')) +
    `</button></div></div>`
  );
}
let jBusy = false;
function jLabel() {
  const s = V.jS;
  if (s < 0) return L('Cover', 'Couverture');
  if (s > JS_MAX) return L('The End', 'Fin');
  const a = s === 0 ? 1 : 2 * s,
    b = s === JS_MAX ? 200 : 2 * s + 1;
  const dl = i =>
    i >= 0 && i < E.DAYS.length
      ? fmtDate(E.DAYS[i].d)
          .replace(/, \d{4}$/, '')
          .replace(/^\w+, /, '')
      : '';
  const d1 = dl(a - 1),
    d2 = dl(b - 1);
  return (
    (a === b ? 'Page ' + a : 'Pages ' + a + '–' + b) +
    '/200' +
    (d1 ? ' · ' + d1 + (d2 && d2 !== d1 ? ' – ' + d2 : '') : '')
  );
}
function jUpdateNav() {
  const c = $('#jcnt');
  if (c) c.textContent = jLabel();
  const a = $('#jprev'),
    b = $('#jnext');
  if (a) a.disabled = V.jS <= -1;
  if (b) b.disabled = V.jS >= JS_MAX + 1;
}
function jFit(root) {
  (root || document).querySelectorAll('.pg:not(.endp)').forEach(pg => {
    const inn = pg.querySelector('.inner');
    if (!inn) return;
    const opts = [...pg.querySelectorAll('[data-opt]')].sort((a, b) => a.dataset.opt - b.dataset.opt);
    opts.forEach(o => {
      o.style.display = '';
    });
    pg.style.fontSize = '';
    const base = parseFloat(getComputedStyle(pg).fontSize);
    const over = () => inn.scrollHeight > inn.clientHeight + 1;
    const shrink = min => {
      let f = 1;
      pg.style.fontSize = '';
      while (over() && f > min) {
        f *= 0.96;
        pg.style.fontSize = base * f + 'px';
      }
      return !over();
    };
    if (shrink(0.88)) return;
    for (const o of opts) {
      o.style.display = 'none';
      if (shrink(0.88)) return;
    }
    shrink(0.62);
  });
}
function jLeaf(front, back, cls) {
  const d = document.createElement('div');
  d.className = 'leaf ' + cls;
  d.innerHTML = `<div class="face">${front}</div><div class="face bk">${back}</div>`;
  return d;
}
function jStep(dir) {
  const sp = $('#spread'),
    sl = $('#sl'),
    sr = $('#sr');
  if (!sp) return;
  const s = V.jS,
    n = s + dir;
  if (dir > 0 && s === JS_MAX) {
    jBusy = true;
    sp.style.visibility = 'hidden';
    $('#bcover').classList.add('show');
    V.jS = n;
    setTimeout(() => {
      jBusy = false;
    }, 460);
    return;
  }
  if (dir < 0 && s === JS_MAX + 1) {
    jBusy = true;
    $('#bcover').classList.remove('show');
    sp.style.visibility = 'visible';
    V.jS = n;
    setTimeout(() => {
      jBusy = false;
    }, 460);
    return;
  }
  jBusy = true;
  if (dir > 0) {
    const leaf = jLeaf(slotR(s, 'r'), slotL(n, 'l'), 'fout');
    sr.innerHTML = slotR(n);
    sp.appendChild(leaf);
    jFit(sp);
    setTimeout(() => {
      sl.innerHTML = slotL(n);
      leaf.remove();
      jFit(sp);
      jBusy = false;
    }, 880);
  } else {
    const leaf = jLeaf(slotR(n, 'r'), slotL(s, 'l'), 'fin');
    sl.innerHTML = slotL(n);
    sp.appendChild(leaf);
    jFit(sp);
    setTimeout(() => {
      sr.innerHTML = slotR(n);
      leaf.remove();
      jFit(sp);
      jBusy = false;
    }, 880);
  }
  V.jS = n;
}
function jFlip(dir, target) {
  if (jBusy) return;
  SFX.page();
  if (V.jS === -1) {
    if (dir > 0 || target != null) jOpen();
    return;
  }
  const to = target != null ? target : V.jS + dir;
  if (to === V.jS || to < -1 || to > JS_MAX + 1) return;
  if (to === -1) {
    const cv = $('.cover');
    if (cv) {
      $('#spread').style.visibility = 'hidden';
      cv.classList.remove('gone', 'opening');
    }
    V.jS = -1;
    jUpdateNav();
    return;
  }
  // jump: show the target as a single flip
  if (target != null && Math.abs(to - V.jS) > 1) {
    const dirn = to > V.jS ? 1 : -1;
    const sl = $('#sl'),
      sr = $('#sr'),
      sp = $('#spread');
    jBusy = true;
    if (dirn > 0) {
      const leaf = jLeaf(slotR(V.jS, 'r'), slotL(to, 'l'), 'fout');
      sr.innerHTML = slotR(to);
      sp.appendChild(leaf);
      jFit(sp);
      setTimeout(() => {
        sl.innerHTML = slotL(to);
        leaf.remove();
        jFit(sp);
        jBusy = false;
      }, 880);
    } else {
      const leaf = jLeaf(slotR(to, 'r'), slotL(V.jS, 'l'), 'fin');
      sl.innerHTML = slotL(to);
      sp.appendChild(leaf);
      jFit(sp);
      setTimeout(() => {
        sr.innerHTML = slotR(to);
        leaf.remove();
        jFit(sp);
        jBusy = false;
      }, 880);
    }
    V.jS = to;
    jUpdateNav();
    return;
  }
  jStep(to > V.jS ? 1 : -1);
  jUpdateNav();
}
function jOpen() {
  const cv = $('.cover'),
    sp = $('#spread');
  if (!cv || !sp) return;
  const s = curSpread();
  V.jS = s;
  $('#sl').innerHTML = slotL(s);
  $('#sr').innerHTML = slotR(s);
  sp.style.visibility = 'visible';
  jFit(sp);
  cv.classList.add('opening');
  jBusy = true;
  setTimeout(() => {
    cv.classList.add('gone');
    cv.classList.remove('opening');
    jBusy = false;
  }, 900);
  jUpdateNav();
}
function jClose() {
  V.jS = null;
  V.jFinal = false;
  render();
}
function logRow(l) {
  return `<div class="le"><span class="d">${esc(fmtDate(l.d))}</span>${esc(l.t)}${chips(l.c, true)}</div>`;
}

function relBar(v) {
  const w = Math.abs(v) / 2;
  const pos = v >= 0;
  return (
    `<div class="relbar"><span class="mid"></span>` +
    `<i style="${pos ? 'left:50%' : 'right:50%'};width:${w}%;background:${pos ? 'var(--good)' : 'var(--bad)'}">` +
    `</i></div>`
  );
}

/* ---------- avatars ---------- */
/* simple drawn avatars (procedural SVG, deterministic per name) */
const AVC = {
  skin: ['#f6d9c0', '#eec39f', '#d9a577', '#b57f55', '#8a5a3b', '#5f3d28'],
  hair: ['#2b1d17', '#4a2f20', '#7a4a2a', '#b07a3c', '#d9b05a', '#a8412a', '#3b3b44', '#c9c9d0'],
  bg: ['#cfe3f5', '#f5d6df', '#d9ecd1', '#f3e6bf', '#e0d6f2', '#d1ece8', '#f6dcc8'],
};
function avatar(name, size) {
  const c = CH[name] || {};
  const h = hsh(name);
  const pick = (arr, sh) => arr[(h >>> sh) % arr.length];
  const skin = pick(AVC.skin, 0),
    bg = pick(AVC.bg, 5),
    girl = c.g === 'F',
    adult = c.role === 'teach' || name === 'Mom' || name === 'Dad';
  let hair = pick(AVC.hair, 9);
  if (c.role === 'teach' && (h >>> 3) % 3 === 0) hair = '#a9a9b2';
  const style = (h >>> 12) % 4,
    eyeSt = (h >>> 15) % 3,
    acc = (h >>> 18) % 5;
  const fy = adult ? 0 : 1; // faces slightly rounder for kids
  let back = '',
    front = '';
  if (girl) {
    back = [
      `<path d="M14 40c0-18 8-26 18-26s18 8 18 26v14H14z" fill="${hair}"/>`,
      `<path d="M15 38c0-17 8-24 17-24s17 7 17 24c0 6 3 14 3 20H12c0-6 3-14 3-20z" fill="${hair}"/>`,
      `<path d="M14 40c0-18 8-26 18-26s18 8 18 26v8H14z" fill="${hair}"/>` +
        `<circle cx="14" cy="22" r="5" fill="${hair}"/><circle cx="50" cy="22" r="5" fill="${hair}"/>`,
      `<path d="M14 40c0-18 8-26 18-26s18 8 18 26v6H14z" fill="${hair}"/>` +
        `<circle cx="32" cy="12" r="6" fill="${hair}"/>`,
    ][style];
    front = `<path d="M18 31c4-9 10-12 14-12s10 3 14 12c-5-4-10-6-14-6s-9 2-14 6z" fill="${hair}"/>`;
  } else {
    back = '';
    front = [
      `<path d="M17 32c0-12 6-18 15-18s15 6 15 18c-4-5-9-8-15-8s-11 3-15 8z" fill="${hair}"/>`,
      `<path d="M16 33c-1-13 6-20 16-20s17 7 16 20c-2-6-4-9-8-10-4 2-14 2-18-1-3 2-5 5-6 11z" fill="${hair}"/>`,
      `<path d="M17 31c0-11 6-17 15-17s15 6 15 17l-3-4c-4-3-8-4-12-4s-9 1-12 4z" fill="${hair}"/>` +
        `<path d="M20 20c3-5 8-8 14-6l-4 5z" fill="${hair}"/>`,
      `<path d="M16 34c-2-14 5-21 16-21s18 7 16 21c-1-7-4-10-7-12-3 1-6 1-9 0-5 1-12 3-16 12z" fill="${hair}"/>`,
    ][style];
  }
  const ey =
    eyeSt === 0
      ? `<circle cx="26" cy="36" r="2.1" fill="#2a2323"/><circle cx="38" cy="36" r="2.1" fill="#2a2323"/>`
      : eyeSt === 1
        ? `<ellipse cx="26" cy="36" rx="2" ry="2.8" fill="#2a2323"/>` +
          `<ellipse cx="38" cy="36" rx="2" ry="2.8" fill="#2a2323"/>` +
          `<circle cx="26.7" cy="35" r=".7" fill="#fff"/><circle cx="38.7" cy="35" r=".7" fill="#fff"/>`
        : `<path d="M23.5 36.5q2.5-3 5 0M35.5 36.5q2.5-3 5 0" stroke="#2a2323" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  const mouth =
    (h >>> 21) % 3 === 0
      ? `<path d="M28 45q4 3 8 0" stroke="#7a3b3b" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
      : (h >>> 21) % 3 === 1
        ? `<path d="M29 45.5q3 2 6 0" stroke="#7a3b3b" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
        : `<path d="M28.5 45q3.5 4 7 0z" fill="#9a4a4a"/>`;
  const cheek =
    `<circle cx="22" cy="42" r="2.6" fill="#e8847a" opacity=".28"/>` +
    `<circle cx="42" cy="42" r="2.6" fill="#e8847a" opacity=".28"/>`;
  let ac = '';
  if (acc === 0)
    ac =
      `<g fill="none" stroke="#3a3a44" stroke-width="1.5"><circle cx="26" cy="36" r="5"/>` +
      `<circle cx="38" cy="36" r="5"/><path d="M31 36h2"/></g>`;
  else if (acc === 1 && !girl && adult)
    ac = `<path d="M24 46q8 8 16 0q-2 7-8 8q-6-1-8-8z" fill="${hair}" opacity=".9"/>`;
  else if (acc === 2 && girl)
    ac = `<path d="M40 17l5-3v8z M40 17l-5-3v8z" fill="#e45c7a"/>` + `<circle cx="40" cy="17" r="1.6" fill="#c23a5c"/>`;
  const neck = `<rect x="28" y="50" width="8" height="8" fill="${skin}"/>`;
  const shirt =
    `<path d="M8 66c0-10 9-14 24-14s24 4 24 14z"` +
    (` fill="` +
      (adult ? '#5b6b8c' : pick(['#e07a5f', '#81b29a', '#f2cc8f', '#6d8cc7', '#b185c9', '#e0a050'], 2)) +
      `"/>`);
  const ear = `<circle cx="17" cy="38" r="3" fill="${skin}"/><circle cx="47" cy="38" r="3" fill="${skin}"/>`;
  const face = `<ellipse cx="32" cy="${35 + fy}" rx="15" ry="${adult ? 17 : 16}" fill="${skin}"/>`;
  const sz = size || 44;
  return (
    `<svg class="av" role="img" aria-label="${ea(name)}" style="width:${sz}px;height:${sz}px" viewBox="0 0 64 64">` +
    `<clipPath id="avc${h}"><circle cx="32" cy="32" r="32"/></clipPath><g clip-path="url(#avc${h})">` +
    `<rect width="64" height="64" fill="${bg}"/>${back}${neck}${shirt}${ear}${face}${cheek}${ey}${mouth}${front}${ac}` +
    `</g></svg>`
  );
}

/* ---------- People tab ---------- */
/* item icons (also used by the Shop, the bag and event gifts) */
const ICON = {
  'Notebook & pen set': '📓',
  'Sticker pack': '⭐',
  'Snack': '🍪',
  'Fancy snack box': '🍱',
  'Hair clips / accessory': '🎀',
  'Bracelet': '📿',
  'Sketchbook': '🎨',
  'Used paperback': '📖',
  'Board game': '🎲',
  'Sports ball': '⚽',
  'Headphones': '🎧',
  'Phone charm': '🔑',
  'Reusable water bottle': '🧴',
  'Small plush': '🧸',
  'Gift card': '💳',
  'Craft kit': '✂️',
  'Bicycle tune-up': '🚲',
  'Movie ticket': '🎟️',
  'Café drink': '☕',
  'Mystery box': '🎁',
  'Study guide': '📘',
  'Flashcards': '🗂️',
  'Calculator': '🧮',
  'Tutoring session': '🧑‍🏫',
  'Lucky charm': '🍀',
  'Chocolate box': '🍫',
  'Houseplant': '🪴',
  'Comic book': '📚',
  'Poster': '🖼️',
  'Friendship bracelet kit': '🧵',
  'Concert ticket': '🎫',
  'Lunch voucher': '🥪',
  'Sunglasses': '🕶️',
  'Hoodie': '🧥',
  'Stylish backpack': '🎒',
  'Smartwatch': '⌚',
  'Handmade gift': '💝',
  'Cooking knife': '🔪',
  "Dad's toolbox": '🧰',
  "Riley's hidden card": '🃏',
  "Max's lucky controller": '🎮',
  "Oliver's varsity jacket": '🏀',
  "Sophie's planner": '📒',
  'Club badge': '🏅',
  'Lost-and-found scarf': '🧣',
  'Charity wristband': '🎗️',
  'Magnifying glass': '🔍',
  'Friendship pin': '📌',
  'Sorry card pack': '💌',
  'Thank-you basket': '🧺',
  'Holiday sweater': '🎄',
  'Volunteer tee': '👕',
  'Brave badge': '🛡️',
  'Fancy pen': '🖋️',
  'Pocket journal': '📔',
  'Showcase apron': '🍳',
  'Group photo frame': '📸',
};
const KIND_ICON = { gift: '🎁', cosmetic: '👕', perm: '⭐', use: '✨', booster: '🚀', prep: '📝' };
const itemIcon = (n, kind) => ICON[n] || KIND_ICON[kind] || '🎁';
const SORTS = [
  ['def', 'Default', 'Défaut'],
  ['pop', 'Most popular', 'Plus populaires'],
  ['unpop', 'Least popular', 'Moins populaires'],
  ['best', 'Best relationship', 'Meilleure relation'],
  ['worst', 'Worst relationship', 'Pire relation'],
];
function viewPeople() {
  const f = V.filter;
  const q = V.q.toLowerCase();
  const metAll = D().chars.filter(c => E.isMet(S, c.n));
  const unmet = D().chars.length - metAll.length;
  let list = metAll.filter(
    c =>
      (f === 'all' ||
        (f === 'kid' && c.role === 'kid') ||
        (f === 'fam' && c.role === 'fam') ||
        (f === 'teach' && c.role === 'teach')) &&
      (!q || c.n.toLowerCase().includes(q)),
  );
  const byPop = dir => (a, b) => (a.pop == null) - (b.pop == null) || (a.pop == null ? 0 : dir * (b.pop - a.pop)); // family and teachers have no school popularity: they go last
  if (V.sort === 'pop') list.sort(byPop(1));
  else if (V.sort === 'unpop') list.sort(byPop(-1));
  else if (V.sort === 'best') list.sort((a, b) => S.rel[b.n] - S.rel[a.n]);
  else if (V.sort === 'worst') list.sort((a, b) => S.rel[a.n] - S.rel[b.n]);
  const seg = [
    ['all', 'All'],
    ['kid', 'Classmates'],
    ['fam', 'Family'],
    ['teach', 'Teachers'],
  ]
    .map(([k, n]) => `<button class="${f === k ? 'on' : ''}" data-act="filter" data-v="${k}">${t(n)}</button>`)
    .join('');
  return (
    `<div class="seg">${seg}</div>` +
    `<input type="search" id="q" placeholder="${t('Search')}" value="${ea(V.q)}">\n  ` +
    `<div class="seg sortseg" aria-label="${L('Sort', 'Trier')}">` +
    SORTS.map(
      ([k, en, fr]) =>
        `<button class="${V.sort === k ? 'on' : ''}" data-act="sort" data-v="${k}">${L(en, fr)}</button>`,
    ).join('') +
    `</div>\n  <div class="card" style="padding:4px 12px">` +
    list
      .map(c => {
        const v = S.rel[c.n];
        const lab = E.relLabel(v);
        return (
          `<button class="person" data-act="person" data-v="${ea(c.n)}">${avatar(c.n, 40)}<div class="pmid">` +
          `<div class="nm">${esc(c.n)}</div><div class="pill ${lab}">${relT(lab)} · ${signed(v)}</div>` +
          `</div>${relBar(v)}</button>`
        );
      })
      .join('') +
    (list.length
      ? ''
      : `<p class="muted small" style="padding:10px 0">${L('Nobody matches.', 'Personne ne correspond.')}</p>`) +
    `</div>` +
    (unmet > 0
      ? `<p class="muted small" style="margin:10px 2px">👋 ` +
        L(
          'You know ' + metAll.length + ' of ' + D().chars.length + ' people. New faces show up as the days go by.',
          'Tu connais ' +
            metAll.length +
            ' personnes sur ' +
            D().chars.length +
            '. De nouveaux visages arrivent au fil des jours.',
        ) +
        `</p>`
      : '')
  );
}
const D = () => E.D;

/* ---------- Shop tab ---------- */
function viewShop() {
  const items = E.SHOP.map(it => {
    const owned = it.kind === 'perm' ? (S.perm[it.n] ? 1 : 0) : S.inv[it.n] || 0;
    const can = S.money >= it.price && !(it.kind === 'perm' && owned);
    if (E.itemLocked(S, it))
      return (
        `<div class="card item locked" style="margin:0"><div class="top"><span><span class="ico">🔒` +
        `</span> ???</span><span class="price">$${it.price}</span></div><div class="muted small">` +
        L('Unlocks through an event: ', 'Se débloque par un événement : ') +
        `${esc(tr(it.hint))}</div></div>`
      );
    return (
      `<div class="card item" style="margin:0"><div class="top"><span>` +
      `<span class="ico">${itemIcon(it.n, it.kind)}</span> ${esc(it.n)}</span>` +
      `<span class="price">$${it.price}</span></div><div class="muted small">${esc(it.use || it.note)}` +
      `</div>\n    <div class="row" style="align-items:center;justify-content:space-between">` +
      `<span class="small muted">${owned ? t('Owned') + ' ×' + owned : ''}</span>` +
      `<button class="btn small" data-act="buy" data-v="${it.id}" ${can ? '' : 'disabled'}>${t('Buy')}` +
      `</button></div></div>`
    );
  }).join('');
  const bag = Object.keys(S.inv).filter(k => S.inv[k] > 0);
  const perms = Object.keys(S.perm);
  const bagHtml =
    bag.length || perms.length
      ? `<div class="ib">` +
        bag
          .map(k => {
            const it = E.SHOP.find(x => x.n === k);
            const usable = it && ['use', 'cosmetic'].includes(it.kind) && !(it.kind === 'cosmetic' && S.worn[k]);
            return (
              `<div class="card" style="margin:0;padding:9px"><span class="ico">${itemIcon(k, it && it.kind)}` +
              `</span> <b>${esc(k)}</b> ×${S.inv[k]}` +
              (usable
                ? `<div class="row" style="margin-top:6px">` +
                  `<button class="btn small" data-act="use" data-v="${ea(k)}">${it.kind === 'cosmetic' ? t('Wear') : t('Use')}` +
                  `</button></div>`
                : `<div class="small muted">` +
                  (it && it.kind === 'prep' ? 'Auto-used on study checks' : 'Gift / hangout item') +
                  `</div>`) +
              `</div>`
            );
          })
          .join('') +
        perms
          .map(
            k =>
              `<div class="card" style="margin:0;padding:9px"><span class="ico">${itemIcon(k, 'perm')}</span> ` +
              `<b>${esc(tr(k))}</b><div class="small muted">Permanent</div></div>`,
          )
          .join('') +
        `</div>`
      : `<div class="muted">${t('Empty')}</div>`;
  return (
    `<div class="card"><h3>${t('Bag')}</h3>${bagHtml}</div><h3 style="margin:14px 0 8px">${t('Shop')}` +
    `</h3><div class="grid2">${items}</div>` +
    `<p class="small" style="margin:14px 0 0">${inkHtml('k4', CLUES().k4)}</p>`
  );
}

/* ---------- Work tab: kitchen, family time, jobs ---------- */
function kitchenHtml() {
  const lvl = E.cookLevel(S), knife = !!S.perm['Cooking knife'];
  const rows = E.RECIPES.map(r => {
    const ok = E.recipeOk(S, r), price = E.cookPrice(S, r), can = ok && S.phase === 'free' && S.blocks >= 1 && S.money >= price;
    const hint = ok ? L('1 block · tastes ', '1 bloc · goût ') + '★'.repeat(r.q) + '☆'.repeat(5 - r.q) : L('Mom teaches this when your relationship with her reaches ' + r.mom + (r.knife ? ', and you have her knife.' : '.'), 'Maman te l\'apprend quand ta relation avec elle atteint ' + r.mom + (r.knife ? ', et que tu as son couteau.' : '.'));
    return `<div class="card item" style="margin:0"><div class="top"><span>${ok ? esc(tr(r.n)) : '🔒 ???'}</span><span class="price">$${price}</span></div><div class="muted small">${hint}</div><div class="row"><button class="btn small" data-act="cook" data-v="${r.id}" ${can ? '' : 'disabled'}>${L('Cook', 'Cuisiner')}</button></div></div>`;
  }).join('');
  return `<div class="card"><h3>${L('Kitchen', 'Cuisine')}</h3><p class="muted small">${L('Cook for yourself, your family or a friend. A good meal warms people up. Mom teaches you new recipes as your bond with her grows.', 'Cuisine pour toi, ta famille ou un ami. Un bon repas rapproche les gens. Maman t\'apprend de nouvelles recettes à mesure que votre lien grandit.')}</p><p class="small" style="margin:0">${L('Cooking level', 'Niveau de cuisine')}: <b>${lvl}/5</b>${knife ? ' · 🔪 ' + L('Mom\'s cooking knife', 'Le couteau de cuisine de Maman') : ''}</p></div><div class="grid2" style="grid-template-columns:1fr;margin-bottom:14px">${rows}</div>`;
}
function familyHtml() {
  const rows = ['Dad', 'Riley', 'Max', 'Oliver', 'Sophie'].map(n => {
    const B = E.BONDS[n], has = !!S.perm[B.item], n1 = B.acts.filter(a => E.bondOk(S, n, a)).length;
    return `<div class="card item" style="margin:0"><div class="top"><span>${esc(n)}${has ? ' 🎁' : ''}</span><span class="price">${S.rel[n]}</span></div><div class="muted small">${relT(E.relLabel(S.rel[n]))} · ${n1}/5 ${L('activities', 'activités')}${has ? ' · ' + esc(tr(B.item)) : ''}</div><div class="row"><button class="btn small" data-act="bond" data-v="${ea(n)}" ${S.phase === 'free' ? '' : 'disabled'}>${L('Spend time', 'Passer du temps')}</button></div></div>`;
  }).join('');
  return `<div class="card"><h3>${L('Family time', 'En famille')}</h3><p class="muted small" style="margin:0">${L('Each family member has activities that open up as you grow closer. Reach 100 with someone and they may give you something special.', 'Chaque membre de la famille a des activités qui s\'ouvrent à mesure que vous vous rapprochez. À 100 avec quelqu\'un, il pourrait te donner un objet spécial.')}</p><p class="small" style="margin:6px 0 0">${inkHtml('k6', CLUES().k6)}</p></div><div class="grid2" style="grid-template-columns:1fr;margin-bottom:14px">${rows}</div>`;
}
function showBond(who) {
  const B = E.BONDS[who]; if (!B) return;
  const rows = B.acts.map(a => {
    const ok = E.bondOk(S, who, a), can = ok && S.blocks >= 1 && S.money >= a.cost;
    const sub = ok ? `${a.cost ? '$' + a.cost + ' · ' : ''}${'★'.repeat(a.q)}${'☆'.repeat(5 - a.q)}` : (a.item && S.rel[who] >= a.need ? L('Unlocks with their special gift.', 'Se débloque avec leur cadeau spécial.') : L('Unlocks at relationship ', 'Se débloque à la relation ') + a.need);
    return `<button class="choice ${can ? '' : 'dis'}" data-act="bondfor" data-v="${ea(who + '|' + a.id)}" ${can ? '' : 'aria-disabled="true"'}><span class="lt">·</span><span>${ok ? esc(tr(a.n)) : '🔒 ???'} <span class="muted small">${sub}</span></span></button>`;
  }).join('');
  openModal(head(who, '') + `<p class="desc">${L('Relationship', 'Relation')}: ${S.rel[who]} · ${relT(E.relLabel(S.rel[who]))}</p><div class="choices">${rows}</div>` + closeRow());
}
function showCook(rid) {
  const r = E.RECIPES.find(x => x.id === rid); if (!r) return;
  const friends = E.metKids(S).slice().filter(n => S.rel[n] >= 0).sort((a, b) => S.rel[b] - S.rel[a]).slice(0, 8);
  const btn = (who, label, sub) => `<button class="choice" data-act="cookfor" data-v="${ea(rid + '|' + who)}"><span class="lt">·</span><span>${label}${sub ? ` <span class="muted small">${sub}</span>` : ''}</span></button>`;
  openModal(head(L('Cook ', 'Cuisiner ') + tr(r.n), '') + `<p class="desc">${L('Who is it for?', 'Pour qui ?')}</p><div class="choices">${btn('self', L('Myself', 'Moi-même'), '')}${btn('family', L('The family', 'La famille'), '')}${friends.map(n => btn(n, esc(n), relT(E.relLabel(S.rel[n])))).join('')}</div>` + closeRow());
}
function viewWork() {
  return kitchenHtml() + familyHtml() + `<div class="card"><h3>${t('Work')}</h3><p class="muted small">${L('Earn money by spending after-school time blocks.', 'Gagne de l\'argent en échange de blocs de temps.')}</p></div><div class="grid2" style="grid-template-columns:1fr">${E.JOBS.map(j => {
    const can = S.phase === 'free' && S.blocks >= j.blocks && !(j.need && !(S.inv[j.need] > 0));
    return `<div class="card item" style="margin:0"><div class="top"><span>${esc(j.n)}</span><span class="price">$${j.pay}</span></div><div class="muted small">${j.blocks} ${j.blocks > 1 ? t('blocks') : t('block')} · ${esc(j.note || '')}${j.need ? ' · ' + t('Needs') + ' ' + esc(j.need) : ''}</div><div class="row"><button class="btn small" data-act="work" data-v="${j.id}" ${can ? '' : 'disabled'}>${t('Do it')}</button></div></div>`;
  }).join('')}</div>`;
}

/* ---------- Calendar tab ---------- */
const HOLI = { '2026-09-07': 'Labour Day', '2026-10-12': 'Thanksgiving', '2027-03-26': 'Good Friday', '2027-03-29': 'Easter Mon.', '2027-05-24': 'Victoria Day' };
const EVTAG = { '2026-08-28': 'First day', '2026-10-23': 'Spirit day', '2026-10-30': 'Halloween', '2026-12-11': 'Concert', '2026-12-18': 'Winter party', '2027-01-04': 'Welcome back', '2027-02-12': 'Friendship', '2027-03-25': 'Spirit day', '2027-04-23': 'Earth Day', '2027-05-28': 'Final project', '2027-06-11': 'Finals', '2027-06-16': 'Ball plan', '2027-06-23': 'Last day' };
const MONTHS = [[2026, 7], [2026, 8], [2026, 9], [2026, 10], [2026, 11], [2027, 0], [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5]];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MNF = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function viewCal() {
  const [y, m] = MONTHS[V.calM]; const cur = E.dayOf(S).d;
  const first = new Date(Date.UTC(y, m, 1)); const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const tabs = MONTHS.map((mm, i) => `<button class="${i === V.calM ? 'on' : ''}" data-act="calm" data-v="${i}">${MN[mm[1]].toUpperCase()}</button>`).join('');
  let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<div class="wd">${x}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div></div>';
  const sched = {}; DAYS.forEach(d => sched[d.d] = d);
  for (let d = 1; d <= n; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const wd = new Date(iso + 'T12:00:00Z').getUTCDay(); const wk = wd === 0 || wd === 6;
    const sd = sched[iso]; let cls = 'cell'; let tag = ''; let extra = '';
    const sk = E.D.days && Object.keys(E.SPECIAL).find(k => E.SPECIAL[k].date === iso);
    if (HOLI[iso]) { cls += ' hol'; tag = HOLI[iso]; } else if (!sd || wk) { cls += ' off'; }
    if (iso >= '2026-12-21' && iso <= '2027-01-01' && !wk) { cls += ' hol'; tag = tag || 'Break'; }
    if (iso >= '2027-03-01' && iso <= '2027-03-05') { cls += ' hol'; tag = 'Spring break'; }
    if (EVTAG[iso]) tag = EVTAG[iso];
    if (sk && iso !== '2027-03-01') tag = `<span class="pd">Pédago</span>`;
    if (iso === '2027-03-01') tag = `<span class="pd">Pédago</span>`;
    if (iso === cur) cls += ' today';
    const passed = iso < cur;
    if (passed) extra += `<svg class="x" viewBox="0 0 40 40"><path d="M6 7 L34 33 M34 7 L6 34"/></svg>`;
    if (iso === E.BALL_DAY) extra += `<svg class="ring" viewBox="0 0 40 40"><ellipse cx="20" cy="20" rx="17" ry="15"/></svg>`;
    cells += `<div class="${cls}">${d}${tag ? `<div class="tg">${tag}</div>` : ''}${extra}</div>`;
  }
  const title = LANG === 'fr' ? `${MNF[m]} ${y}` : `${new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
  return `<div class="cal-tabs">${tabs}</div><div class="card"><h3 style="margin-bottom:10px">${esc(title)}</h3><p class="small" style="margin:-4px 0 8px">${inkHtml('k5', CLUES().k5)}</p><div class="cal">${cells}</div><div class="legend"><span>✕ ${t('Crossed days')}</span><span><span class="pd" style="background:#3b6fd4;color:#fff;border-radius:3px;padding:0 4px;font-size:11px">${t('Pédago')}</span></span><span>◯ ${t('The Ball')}</span><span>▒ ${t('Holiday')}</span></div></div>`;
}

/* ---------- Menu tab ---------- */
function viewMenu() {
  return `<div class="card"><h3>${t('Menu')}</h3><div class="row" style="margin-top:8px"><button class="btn" data-act="saves">${t('Saved games')}</button><button class="btn" data-act="endbook">${t('Endings')}</button><button class="btn" data-act="summary">${L('Run summary', 'Résumé')}</button>${noteMcBtn()}<button class="btn" data-act="stats">${L('Stats', 'Statistiques')}</button><button class="btn" data-act="settings">${t('Settings')}</button><button class="btn" data-act="help">${t('Help')}</button></div>
  <div class="row" style="margin-top:12px">${themeBtn('btn ghost')}${langBtn('btn ghost')}<button class="btn ghost" data-act="newgame">${t('New game')}</button></div></div>
  <div class="card"><h3>${t('Account')}</h3><p class="muted small" style="margin:0">${Store.cloud ? L('Your saves are tied to your Claude account and follow you across devices.', 'Tes sauvegardes sont liées à ton compte Claude et te suivent d\'un appareil à l\'autre.') : L('Not signed in here: saves stay in this browser only.', 'Mode hors compte : les sauvegardes restent dans ce navigateur.')}${Store.cloudErr ? ' (cloud save failed once)' : ''}</p></div>
  <div class="card"><h3>${t('Final stats')}</h3>${statBoxes()}</div>`;
}

/* ---------- modals ---------- */
function openModal(html) { V.modal = html; renderModal(); }
function closeModal() { pgStop(); V.pg = null; V.mg = null; V.modal = null; V.res = null; V.sub = null; V.evIdx = null; V.person = null; V.evCur = null; V.savesOpen = false; renderModal(); }
function renderModal() {
  Music.set(musMood());
  let o = document.getElementById('ov');
  if (!V.modal) { if (o) o.remove(); return; }
  if (!o) { o = document.createElement('div'); o.id = 'ov'; o.className = 'overlay'; document.body.appendChild(o); o.addEventListener('click', ev => { ev.stopPropagation(); onClick(ev); }); }
  const keep = o.querySelector('.modal'); const st = keep ? keep.scrollTop : 0;
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" tabindex="-1">${typeof V.modal === 'function' ? V.modal() : V.modal}</div>`;
  o.querySelector('.modal').scrollTop = st;
  if (!keep) { try { o.querySelector('.modal').focus({ preventScroll: true }); } catch (e) {} }
  { const ev = V.evCur; if (V.res && V.res !== V.sfxRes) { V.sfxRes = V.res; SFX.forRes(V.res); if (isVoiced(ev)) Voice.say(resParts(ev, V.res)); } else if (ev && !V.res && V.voiceEv !== ev) { V.voiceEv = ev; if (ev.kind === 'ball') SFX.chime(); if (isVoiced(ev)) Voice.say(evParts(ev)); } }
}
const head = (title, tag) => `<div class="m-head"><div>${tag || ''}<h2>${esc(title)}</h2></div><button class="close" data-act="close" aria-label="Close">×</button></div>`;

/* ---------- school minigames (memory pairs and quizzes inside academic events) ---------- */
function newMg(ev) {
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
  const sk = `<div class="row" style="margin-top:12px"><button class="btn ghost small" data-act="mgskip">${L('Skip (roll the dice)', 'Passer (au hasard)')}</button></div>`;
  const h = head(d.label, `<span class="tag">${L('Mini-game', 'Mini-jeu')}</span>`);
  if (d.type === 'memory') {
    if (m.done) return h + `<p class="desc">${L('Done', 'Terminé')}: ${m.misses} ${L('misses', 'erreurs')}.</p><div class="row"><button class="btn primary" data-act="mgfinish">${t('Continue')}</button></div>`;
    return h + `<p class="desc">${L('Find all 4 pairs. Under 5 misses is a clean pass.', 'Retrouve les 4 paires. Moins de 5 erreurs pour réussir à coup sûr.')} <b>${m.misses}</b> ${L('misses', 'erreurs')}</p><div class="ib" style="grid-template-columns:repeat(4,1fr)">${m.cards.map((c, i) => { const up = m.flipped.includes(i) || m.matched.includes(i); return `<button class="btn" style="height:72px;font-size:30px;text-align:center;padding:0" data-act="mgflip" data-v="${i}">${up ? c : '?'}</button>`; }).join('')}</div>` + sk;
  }
  if (m.done) { const pass = m.ok / d.qs.length >= 0.6; return h + `<p class="desc">${m.ok}/${d.qs.length} — ${pass ? L('Nice work!', 'Bien joué !') : L('Not enough this time.', 'Pas assez cette fois.')}</p><div class="row"><button class="btn primary" data-act="mgfinish">${t('Continue')}</button></div>`; }
  const q = d.qs[m.i];
  return h + `<p class="sub">${L('Question', 'Question')} ${m.i + 1}/${d.qs.length}</p><p class="desc" style="font-size:18px">${esc(q.q)}</p><div class="choices">${q.o.map(o => { const gone = m.rem.includes(o); const st = m.ans != null ? (o === q.a ? 'style="border-color:var(--good)"' : o === m.ans ? 'style="border-color:var(--bad)"' : '') : ''; return `<button class="choice ${gone ? 'dis' : ''}" ${st} data-act="${gone ? '' : 'mgans'}" data-v="${ea(o)}"><span class="l">•</span><span>${esc(o)}</span></button>`; }).join('')}</div>
  <div class="row" style="margin-top:12px">${m.ans != null ? `<button class="btn primary" data-act="mgnext">${t('Continue')}</button>` : (m.hints > 0 ? `<button class="btn small" data-act="mghint">💡 50/50 (${m.hints})</button>` : '')}</div><p class="small muted" style="margin:8px 0 0">${L('Study prep, notebooks and guides give you hints.', 'Les cahiers, guides d\'étude et l\'aide donnent des indices.')}</p>` + sk;
}
/* ---------- events ---------- */
function showEvent() {
  const ev = E.buildEvent(S); if (!ev) { render(); return; }
  V.res = null;
  const tag = ev.pedago ? `<span class="tag">Pédago</span>` : ev.rand ? `<span class="tag alt">${L('Random event', 'Imprévu')}</span>` : ev.kind === 'personal' ? `<span class="tag alt">${L('Personal', 'Personnel')}</span>` : (ev.kind === 'ballinvite' || ev.kind === 'ball') ? `<span class="tag">${t('The Ball')}</span>` : ev.kind === 'holiday' ? `<span class="tag alt">${/^(knife|gift_)/.test(ev.id || '') ? L('Family', 'Famille') : L('Holiday', 'Congé')}</span>` : ev.kind === 'npc' ? `<span class="tag alt">${L('Encounter', 'Rencontre')}</span>` : ev.kind === 'notice' ? `<span class="tag alt">${L('Family', 'Famille')}</span>` : ev.kind === 'birthday' ? `<span class="tag alt">${t('Birthday')}</span>` : `<span class="tag">${fmtDate(E.dayOf(S).d)}</span>`;
  V.modal = () => {
    if (V.mg) return mgHtml(ev);
    if (V.res) return resultHtml(ev);
    if (V.sub && V.sub.type === 'gift') return head(ev.title, tag) + `<p class="desc">${L('Pick an item.', 'Choisis un objet.')}</p><div class="ib">${E.giftItems(S).map(it => `<button class="btn" data-act="evgift" data-v="${ea(it.n)}">${itemIcon(it.n, it.kind)} ${esc(it.n)}<small>×${S.inv[it.n]}</small></button>`).join('')}</div><div class="row" style="margin-top:12px"><button class="btn ghost" data-act="evback">${t('Back')}</button></div>`;
    const newf = ev.met && ev.met.length ? `<div class="newface">👋 ${L('New contact', 'Nouveau contact')}: <b>${ev.met.map(esc).join(', ')}</b></div>` : '';
    const who = newf + (ev.who && ev.who.length ? `<div class="who">${ev.who.map(w => `<span><b>${esc(w.role)}</b>${esc(w.names.join(', '))}</span>`).join('')}</div>` : '');
    return head(ev.title, tag) + `<p class="desc">${esc(ev.desc)}</p>${isVoiced(ev) ? `<div class="row" style="margin-bottom:8px">${listenBtn()}</div>` : ''}${who}<div class="choices">${ev.choices.map((c, i) => `<button class="choice ${c.disabled ? 'dis' : ''}" data-act="pick" data-v="${i}" ${c.disabled ? 'aria-disabled="true"' : ''}><span class="l">${c.l}</span><span>${esc(c.x)}${c.chance != null ? `<small>~${c.chance}% ${L('chance to accept', 'de chances qu\'il/elle accepte')}</small>` : ''}${c.hint ? `<span class="hint">${esc(c.hint)}</span>` : ''}${c.disabled ? `<small>${esc(c.why || '')}</small>` : ''}</span></button>`).join('')}</div>`;
  };
  V.evCur = ev;
  renderModal();
}
function resultHtml(ev) {
  const r = V.res;
  return head(ev.title, `<span class="tag alt">${L('What happened', 'Résultat')}</span>`) + `<div class="lines">${(r.lines || []).map(lineHtml).join('')}</div>${r.thought ? `<p class="thought">${esc(r.thought)}</p>` : ''}${chips(r.chips)}<div class="row" style="margin-top:16px"><button class="btn primary" data-act="evnext">${t('Continue')}</button>${isVoiced(ev) ? listenBtn() : ''}</div>`;
}
function afterEvent() {
  closeModal();
  if (S && S.flags && S.flags.REVEAL_DONE && !V.revealed) { V.revealed = 1; applyA11y(); try { Store.prefs().then(p => Store.prefs(Object.assign({}, p, { revealed: 1 }))); } catch (e) {} setTimeout(() => toast(L('The faint ink stays visible now.', 'L\'encre pâle reste visible, désormais.')), 600); }
  Store.autosave(S);
  if (S.phase === 'ending') { markEnding(); }
  render();
  if (!S.over && S.phase === 'event') showEvent();
}
/* ---------- run records (stored in prefs.runs, used for achievements and memories of past runs) ---------- */
function runRecord() {
  const kids = E.KIDS.slice().sort((a, b) => S.rel[b] - S.rel[a]); const en = S.ending ? E.ENDBY[S.ending.id] : null;
  return { id: S.ending ? S.ending.id : 'over', epi: S.ending ? S.ending.epi : [], over: S.ending ? 0 : 1, bad: (!S.ending || en.bad) ? 1 : 0, pop: S.pop, grade: S.grade, money: S.money, friends: kids.filter(n => S.rel[n] >= 40).slice(0, 3), foes: kids.slice().reverse().filter(n => S.rel[n] <= -25).slice(0, 3), cook: S.cookN || 0, sig: S.flags.COOKED_SIG ? 1 : 0, knife: S.perm['Cooking knife'] ? 1 : 0 };
}
async function recordRun() {
  if (!S || S.recorded || !(S.ending || S.over)) return; S.recorded = 1;
  const p = await Store.prefs(); const runs = (p.runs || []).concat([runRecord()]).slice(-12);
  const before = new Set(p.ach || []); const c = achCtx(Object.assign({}, p, { runs })); const now = ACH().filter(a => a[3](c)).map(a => a[0]); const fresh = ACH().filter(a => now.includes(a[0]) && !before.has(a[0]));
  await Store.prefs(Object.assign({}, p, { runs, ach: now }));
  if (fresh.length) setTimeout(() => toast('🏆 ' + L('Achievement', 'Succès') + ': ' + fresh.map(a => a[1]).join(', ')), 1500);
}
function memOf(runs) {
  if (!runs || !runs.length) return null; const last = runs[runs.length - 1];
  const uniq = k => { const o = []; runs.slice().reverse().forEach(r => (r[k] || []).forEach(n => { if (!o.includes(n)) o.push(n); })); return o; };
  return { n: runs.length, last: { id: last.id, bad: last.bad, over: last.over }, foes: uniq('foes'), friends: uniq('friends') };
}
async function markEnding() {
  if (!S.ending) return;
  const p = await Store.prefs(); const seen = new Set(p.seen || []); seen.add(S.ending.id); S.ending.epi.forEach(i => seen.add(i)); V.seen = [...seen];
  await Store.prefs(Object.assign({}, p, { seen: V.seen, lang: LANG, theme: THEME }));
  await recordRun();
  Store.put('auto', S);
}

/* ---------- tutorial ---------- */
const TUT = () => [
  { t: L('Your goal', 'Ton but'), b: L('Survive one school year, from Aug 28 to Jun 23. Keep <b>POP</b> (popularity) above 0: if it hits 0 the run ends at once. Otherwise you get an ending shaped by your stats, your friendships and the choices people remember.', 'Survivre à une année scolaire, du 28 août au 23 juin. Garde ta <b>POP</b> (popularité) au-dessus de 0 : si elle tombe à 0, la partie se termine tout de suite. Sinon tu obtiens une fin qui dépend de tes stats, de tes amitiés et des choix dont les gens se souviennent.') },
  { t: L('Every school day starts with an event', 'Chaque journée commence par un événement'), b: L('Read the scene and pick a choice. Some choices are checks (grades help), some are risky, and some are just kind. Keys <b>A, B, C…</b> or <b>1, 2, 3…</b> pick a choice.', 'Lis la scène et choisis. Certains choix sont des épreuves (tes notes aident), d\'autres sont risqués, d\'autres sont simplement gentils. Les touches <b>A, B, C…</b> ou <b>1, 2, 3…</b> choisissent.') },
  { t: L('After school: 3 time blocks', 'Après les cours : 3 blocs de temps'), b: L('Each action (talking, studying, working, shopping) uses a block. When you are done, press <b>End day</b>. Surprises, personal events and birthdays can happen in the evening.', 'Chaque action (parler, étudier, travailler, magasiner) utilise un bloc. Quand tu as fini, appuie sur <b>Finir la journée</b>. Des imprévus, des événements personnels et des anniversaires peuvent survenir le soir.') },
  { t: L('People, Shop, Work, Calendar', 'Gens, boutique, travail, calendrier'), b: L('<b>People</b>: 40 characters, each with a relationship from −100 to +100. Talk, share, tease, give gifts. <b>Shop</b> and <b>Work</b> change your money and your options. <b>Calendar</b> shows holidays, birthdays and big days.', '<b>Gens</b> : 40 personnages, chacun avec une relation de −100 à +100. Parle, confie-toi, taquine, offre des cadeaux. La <b>boutique</b> et le <b>travail</b> changent ton argent et tes options. Le <b>calendrier</b> montre les congés, les anniversaires et les grands jours.') },
  { t: L('Risks and memory', 'Risques et mémoire'), b: L('Cheating can get you caught. Rumors can reach their target, get disproven, and cost popularity. People remember what you did, and helping or hurting someone also moves their friends a little.', 'Tricher peut te faire prendre. Les rumeurs peuvent atteindre leur cible, être démenties, et te coûter de la popularité. Les gens se souviennent de ce que tu as fait, et aider ou blesser quelqu\'un touche aussi un peu ses amis.') },
  { t: L('Journal, saving, sound', 'Journal, sauvegarde, son'), b: L('Your <b>Journal</b> writes itself as you play. The game autosaves; <b>Menu → Saved games</b> has 3 manual slots. Press <b>M</b> or tap 🔊 to mute everything; <b>Settings</b> has volume sliders, text size and more.', 'Ton <b>journal</b> s\'écrit tout seul pendant que tu joues. Le jeu se sauvegarde automatiquement ; <b>Menu → Parties sauvegardées</b> offre 3 emplacements manuels. Appuie sur <b>M</b> ou touche 🔊 pour tout couper ; les <b>Réglages</b> ont des curseurs de volume, la taille du texte et plus.') },
];
const tutHtml = () => {
  const T = TUT(), i = V.tut, st = T[i];
  return head(L('Quick tour', 'Visite rapide'), `<span class="tag">${i + 1}/${T.length}</span>`) + `<div class="lines"><p><b>${st.t}</b></p><p>${st.b}</p></div><div class="tutdots" aria-hidden="true">${T.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div><div class="row" style="margin-top:14px">${i > 0 ? `<button class="btn ghost" data-act="tutprev">${L('Back', 'Retour')}</button>` : ''}<button class="btn primary" data-act="tutnext">${i === T.length - 1 ? L('Start playing', 'Jouer') : L('Next', 'Suivant')}</button><button class="btn ghost" data-act="tutskip">${L('Skip', 'Passer')}</button></div>`;
};
function startTut(first) { V.tut = 0; V.tutFirst = !!first; openModal(tutHtml); }
async function endTut() {
  const f = V.tutFirst; V.tut = null; V.tutFirst = false; closeModal();
  try { const p = await Store.prefs(); if (!p.tut) Store.prefs(Object.assign({}, p, { tut: 1 })); } catch (e) {}
  if (f) showEvent(); else if (S) render();
}

/* ---------- starting traits ---------- */
const TRAITS = () => [
  ['bal', L('Balanced', 'Équilibré'), L('The standard start.', 'Le départ habituel.'), { pop: 50, money: 50, grade: 55 }],
  ['sch', L('Scholar', 'Bûcheur'), L('Strong grades, less money and fewer admirers.', 'Bonnes notes, moins d\'argent et de popularité.'), { pop: 40, money: 30, grade: 70 }],
  ['soc', L('Social', 'Social'), L('Popular, but behind in class.', 'Populaire, mais en retard en classe.'), { pop: 62, money: 40, grade: 45 }],
  ['hus', L('Hustler', 'Débrouillard'), L('Cash in your pocket, average at everything else.', 'De l\'argent en poche, moyen partout ailleurs.'), { pop: 45, money: 110, grade: 50 }],
  ['rnd', L('Surprise me', 'Surprends-moi'), L('A random year: random stats and a few random first impressions of classmates.', 'Une année au hasard : stats aléatoires et quelques premières impressions de camarades au hasard.'), null],
];
function applyTrait(S, id, p, ngp) {
  const T = TRAITS(); let tr = T.find(x => x[0] === id) || T[0]; const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
  let st = tr[3];
  if (!st) {
    const pool = T.filter(x => x[3]); st = Object.assign({}, pool[Math.floor(Math.random() * pool.length)][3]);
    st.pop = clamp(st.pop + (Math.random() * 12 - 6), 35, 70); st.money = clamp(st.money + (Math.random() * 30 - 15), 20, 130); st.grade = clamp(st.grade + (Math.random() * 12 - 6), 40, 75);
    const kids = E.metKids(S).slice().sort(() => Math.random() - 0.5);
    kids.slice(0, 3).forEach(n => { S.rel[n] += 12; S.min[n] = Math.min(S.min[n], S.rel[n]); });
    kids.slice(3, 5).forEach(n => { S.rel[n] -= 8; S.min[n] = Math.min(S.min[n], S.rel[n]); });
  }
  S.pop = st.pop; S.money = st.money; S.grade = st.grade; S.startGrade = st.grade; S.trait = tr[0];
  if (ngp && p && p.runs && p.runs.length) {
    S.money += 20; const f = (p.runs[p.runs.length - 1].friends || [])[0];
    if (f && S.rel[f] != null) { S.rel[f] += 20; S.min[f] = Math.min(S.min[f], S.rel[f]); }
    S.ngBonus = 1;
  }
}
/* ---------- achievements & stats ---------- */
const ACH = () => [
  ['first', L('First year', 'Première année'), L('Finish a run.', 'Terminer une partie.'), c => c.runs.length >= 1],
  ['survivor', L('Survivor', 'Survivant'), L('Reach the end of the school year.', 'Arriver à la fin de l\'année scolaire.'), c => c.runs.some(r => !r.over)],
  ['rock', L('Rock bottom', 'Le fond du trou'), L('Hit 0 popularity.', 'Tomber à 0 de popularité.'), c => c.runs.some(r => r.over)],
  ['straight', L('Straight A', 'Premier de classe'), L('End a year with a grade of 90 or more.', 'Finir l\'année avec une note de 90 ou plus.'), c => c.runs.some(r => r.grade >= 90)],
  ['popular', L('Everybody knows you', 'Tout le monde te connaît'), L('End a year with 90 popularity or more.', 'Finir l\'année avec 90 de popularité ou plus.'), c => c.runs.some(r => !r.over && r.pop >= 90)],
  ['rich', L('Piggy bank', 'Tirelire'), L('End a year with $300 or more.', 'Finir l\'année avec 300 $ ou plus.'), c => c.runs.some(r => r.money >= 300)],
  ['crew', L('A real crew', 'Une vraie bande'), L('End a year with 3 close friends.', 'Finir l\'année avec 3 amis proches.'), c => c.runs.some(r => (r.friends || []).length >= 3)],
  ['both', L('Both sides', 'Les deux côtés'), L('See a good ending and a hard ending.', 'Voir une bonne fin et une fin difficile.'), c => c.good >= 1 && c.bad >= 1],
  ['c10', L('Ten endings', 'Dix fins'), L('Unlock 10 endings.', 'Débloquer 10 fins.'), c => c.seen >= 10],
  ['c25', L('Twenty-five endings', 'Vingt-cinq fins'), L('Unlock 25 endings.', 'Débloquer 25 fins.'), c => c.seen >= 25],
  ['c50', L('Fifty endings', 'Cinquante fins'), L('Unlock 50 endings.', 'Débloquer 50 fins.'), c => c.seen >= 50],
  ['all', L('Completionist', 'Complétiste'), L('Unlock every ending.', 'Débloquer toutes les fins.'), c => c.seen >= E.ENDINGS.length],
  ['knife', L('A good knife', 'Un bon couteau'), L('Receive Mom\'s cooking knife.', 'Recevoir le couteau de cuisine de Maman.'), c => c.runs.some(r => r.knife)],
  ['chef', L('Little chef', 'Petit chef'), L('Cook the signature dish.', 'Cuisiner le plat signature.'), c => c.runs.some(r => r.sig)],
  ['ink', L('Faint ink', 'Encre pâle'), L('Keep your eyes open.', 'Garde l\'œil ouvert.'), c => c.clues >= 1],
  ['pen', L('Who holds the pen?', 'Qui tient le stylo ?'), '???', c => c.clues >= E.REVEAL_AT],
  ['again', L('Just one more year', 'Encore une année'), L('Finish 5 runs.', 'Terminer 5 parties.'), c => c.runs.length >= 5],
];
function achCtx(p) {
  const seen = new Set((p.seen || []).concat(V.seen || [])); const list = E.ENDINGS.filter(e => seen.has(e.id));
  return { clues: clueN(), runs: p.runs || [], seen: list.length, good: list.filter(e => !e.bad).length, bad: list.filter(e => e.bad).length };
}
async function showStats() {
  const p = await Store.prefs(); const c = achCtx(p); const runs = c.runs; const mx = k => runs.length ? Math.max(...runs.map(r => r[k] || 0)) : 0;
  const done = ACH().filter(a => a[3](c)).length;
  let cur = '';
  if (S && !S.over) {
    const tn = (TRAITS().find(x => x[0] === S.trait) || [])[1];
    cur = `<h3 style="margin:14px 0 6px">${L('This run', 'Cette partie')}</h3><div class="stats3"><div><b>${S.di + 1}/${DAYS.length}</b>${t('Day')}</div><div><b>${S.studies || 0}</b>${L('Study sessions', 'Séances d\'étude')}</div><div><b>${S.jobsDone || 0}</b>${L('Shifts worked', 'Quarts travaillés')}</div></div><p class="small muted" style="margin:6px 0 0">${L('Earned', 'Gagné')} $${S.earned || 0} · ${L('Spent', 'Dépensé')} $${S.spent || 0} · ${L('Gifts', 'Cadeaux')} ${S.giftN || 0}${tn ? ' · ' + L('Start', 'Départ') + ': ' + esc(tn) : ''}</p>`;
  }
  const best = runs.length ? `<div class="stats3"><div><b>${runs.length}</b>${L('Runs finished', 'Parties finies')}</div><div><b>${mx('grade')}</b>${L('Best grade', 'Meilleure note')}</div><div><b>${mx('pop')}</b>${L('Best POP', 'Meilleure POP')}</div></div><p class="small muted" style="margin:6px 0 0">${L('Most money', 'Plus d\'argent')}: $${mx('money')}</p>` : `<p class="muted small">${L('Finish a run to see your records here.', 'Termine une partie pour voir tes records ici.')}</p>`;
  const fr_ = {}; runs.forEach(r => (r.friends || []).forEach(n => { fr_[n] = (fr_[n] || 0) + 1; })); const top = Object.entries(fr_).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const frh = top.length ? `<p class="small muted" style="margin:6px 0 0">${L('Most loyal friends', 'Amis les plus fidèles')}: ${top.map(x => esc(x[0]) + ' ×' + x[1]).join(', ')}</p>` : '';
  const ach = inkStatHtml(p) + ACH().map(a => { const ok = a[3](c); return `<div class="endrow"><span class="dot ${ok ? 'on' : ''}"></span><div><b>${ok ? esc(a[1]) : '???'}</b><div class="small muted">${esc(a[2])}</div></div></div>`; }).join('');
  openModal(head(L('Stats', 'Statistiques'), '') + `<h3 style="margin:0 0 6px">${L('Records', 'Records')}</h3>${best}${frh}<p class="small muted" style="margin:6px 0 0">${L('Endings', 'Fins')}: ${c.seen}/${E.ENDINGS.length} (${c.good} ${L('good', 'bonnes')}, ${c.bad} ${L('hard', 'difficiles')})</p>${cur}<h3 style="margin:14px 0 4px">${L('Achievements', 'Succès')} · ${done}/${ACH().length}</h3>${ach}`);
}

/* ---------- person profile ---------- */
function showPerson(name) {
  V.person = name; V.sub = null; V.res = null;
  V.modal = () => personHtml(name); renderModal();
}
function stars(n) { return '●'.repeat(n) + '○'.repeat(5 - n); }
function personHtml(name) {
  const c = CH[name]; const v = S.rel[name]; const lab = E.relLabel(v);
  if (V.res) {
    const r = V.res;
    return head(name, `<span class="tag alt">${t(V.resTitle || 'Done')}</span>`) + `<div class="lines">${(r.lines || []).map(lineHtml).join('')}${r.err ? `<p>${esc(r.err)}</p>` : ''}</div>${chips(r.chips)}<div class="row" style="margin-top:14px"><button class="btn primary" data-act="presback">${t('Continue')}</button></div>`;
  }
  if (V.sub) return subHtml(name);
  const rum = E.rumorsFor(S, name);
  const gf = (S.giftFrom && S.giftFrom[name]) || []; const gfc = {}; gf.forEach(x => { gfc[x] = (gfc[x] || 0) + 1; });
  const known = rum.filter(r => r.known);
  const list = E.interactionList(S, name);
  return head(name, '') + `<div class="avbig">${avatar(name, 76)}</div><div class="muted small" style="margin:-4px 0 10px">${c.role === 'kid' ? t('Classmates') : c.role === 'fam' ? t('Family') : t('Teachers')} · ${t('Age')} ${c.a} · ${t('Birthday')}: ${esc(c.b)}</div>
  <p style="margin:0 0 10px">${esc(c.pers)}</p>
  <div class="card" style="padding:10px"><div class="row" style="justify-content:space-between"><b>${t('Relationship')}</b><span class="pill ${lab}">${relT(lab)} · ${signed(v)}</span></div>${relBar(v)}
  <div class="row" style="justify-content:space-between;margin-top:8px" ><span class="small muted">${t('Approachability')} ${stars(c.ap)}</span>${c.pop != null ? `<span class="small muted">${t('Popularity')} ${c.pop}</span>` : ''}</div></div>
  ${gf.length ? `<p class="small muted" style="margin:0 0 10px">${L('They gave you', 'Cadeaux reçus de cette personne')}: ${Object.keys(gfc).map(k => esc(k) + (gfc[k] > 1 ? ' ×' + gfc[k] : '')).join(', ')}</p>` : ''}
  <div class="card" style="padding:10px"><b>${t('Rumors')}</b>${known.length ? known.map(r => `<p class="small" style="margin:6px 0 0">“${esc(r.t)}”</p>`).join('') : `<p class="small muted" style="margin:6px 0 0">${L('Nothing heard yet. Listen for rumors while talking.', 'Rien d\'entendu pour l\'instant. Écoute des rumeurs en parlant.')}</p>`}</div>
  <div class="ib">${E.phoneList(S, name).length && !E.phoneOff(S) ? `<button class="btn small primary" data-act="phtext" data-v="${ea(name)}">📱 ${L('Text', 'Texter')}<small>${phLeft()}/${E.PHONE_CAP}</small></button>` : ''}${list.filter(i => E.phoneOff(S) || !E.PHONE_HIDE.has(i.id)).map(i => `<button class="btn small ${i.ok ? '' : 'dis'}" data-act="inter" data-v="${i.id}" ${i.ok ? '' : `data-why="${ea(i.why)}"`}>${esc(t(i.n))}<small>${i.cost ? i.cost + ' ' + t('block') : '—'}</small></button>`).join('')}</div>`;
}
function subHtml(name) {
  const s = V.sub; const c = CH[name];
  const back = `<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="subback">${t('Back')}</button></div>`;
  const btn = (act, v, label, small) => `<button class="btn" data-act="${act}" data-v="${ea(v)}">${esc(label)}${small ? `<small>${esc(small)}</small>` : ''}</button>`;
  if (s.type === 'about') {
    if (!s.subject) {
      const names = Object.keys(CH).filter(n => n !== name && CH[n].role !== 'teach');
      return head(name, `<span class="tag alt">${t('Talk about someone')}</span>`) + `<p class="desc">${L('Who do you want to talk about?', 'De qui veux-tu parler ?')}</p><div class="ib">${names.map(n => `<button class="btn" data-act="aboutpick" data-v="${ea(n)}">${esc(n)}<small>${relT(E.relLabel(S.rel[n]))} ${signed(S.rel[n])}</small></button>`).join('')}</div>` + back;
    }
    return head(name, `<span class="tag alt">${t('Talk about someone')}</span>`) + `<p class="desc">${L('What do you say about ', 'Que dis-tu sur ')}<b>${esc(s.subject)}</b>?</p><div class="choices">
    <button class="choice" data-act="go" data-v="${ea(s.subject)}|bad"><span class="l">−</span><span>${L('Speak badly behind their back', 'Dire du mal dans son dos')}<small>${L('Risky: it can get back to them', 'Risqué : peut revenir à ses oreilles')}</small></span></button>
    <button class="choice" data-act="go" data-v="${ea(s.subject)}|good"><span class="l">+</span><span>${L('Say good things about them', 'En dire du bien')}</span></button>
    <button class="choice" data-act="go" data-v="${ea(s.subject)}|neutral"><span class="l">·</span><span>${L('Just mention them', 'Le mentionner simplement')}</span></button></div>` + back;
  }
  if (s.type === 'talk') return head(name, `<span class="tag alt">${t('Topic')}</span>`) + `<div class="ib">${btn('go', 'school', t('School'))}${btn('go', 'hobbies', t('Hobbies'))}${btn('go', 'daily', t('Daily life'))}${btn('go', 'rumor', t('Listen for a rumor'))}</div>` + back;
  if (s.type === 'gift') return head(name, `<span class="tag alt">${t('Give a gift')}</span>`) + `<div class="ib">${E.giftItems(S).map(it => btn('go', it.n, it.n, '×' + (S.inv[it.n] || 0))).join('')}</div>` + back;
  if (s.type === 'hangout') {
    const boost = ['Movie ticket', 'Café drink', 'Fancy snack box', 'Concert ticket'].filter(k => S.inv[k] > 0).concat(['Sports ball', 'Sketchbook'].filter(k => S.perm[k]));
    return head(name, `<span class="tag alt">${t('Hang out')}</span>`) + `<div class="ib">${btn('go', '', t('No booster'))}${boost.map(k => btn('go', k, k)).join('')}</div>` + back;
  }
  if (s.type === 'lend') return head(name, `<span class="tag alt">${t('Offer to lend money')}</span>`) + `<div class="ib">${[5, 10, 20].map(a => `<button class="btn" data-act="go" data-v="${a}" ${S.money < a ? 'disabled' : ''}>$${a}</button>`).join('')}</div>` + back;
  if (s.type === 'rumor') return head(name, `<span class="tag alt">${s.id === 'share' ? t('Share a rumor') : t('Investigate a rumor')}</span>`) + (E.rumorsFor(S, name).filter(r => r.known).length ? `<div class="choices">${E.rumorsFor(S, name).filter(r => r.known).map(r => `<button class="choice" data-act="go" data-v="${r.i}"><span class="l">${r.k === 'neg' ? '−' : r.k === 'pos' ? '+' : '·'}</span><span>${esc(r.t)}</span></button>`).join('')}</div>` : `<p class="muted">${L('You have not heard any rumor about them yet. Talk to them first (topic: rumor).', 'Tu n\'as encore entendu aucune rumeur sur cette personne. Parle-lui d\'abord (sujet : rumeur).')}</p>`) + back;
  if (s.type === 'fight') return head(name, `<span class="tag alt">${t('Fight / confrontation')}</span>`) + `<div class="ib">${btn('go', 'confront', L('Confront', 'Confronter'), '-rep / -trust')}${btn('go', 'deescalate', L('De-escalate', 'Désamorcer'), L('safer', 'plus sûr'))}</div>` + back;
  if (s.type === 'apologize') return head(name, `<span class="tag alt">${t('Apologize')}</span>`) + `<div class="ib">${btn('go', 'specific', L('Name exactly what I did', 'Nommer précisément ce que j\'ai fait'), L('works best', 'meilleur'))}${btn('go', 'vague', L('A vague sorry', 'Excuses vagues'))}</div>` + back;
  return '';
}

/* ---------- screens ---------- */
function loginScreen() {
  const me = Store.me || {}; const nm = V.prefName || '';
  const av = me.avatarUrl ? `<img class="av" alt="" src="${ea(me.avatarUrl)}" ${me.color ? `style="border-color:${esc(me.color)}"` : ''}>` : '';
  const body = Store.cloud
    ? `<p class="muted" style="margin:0;max-width:44ch">${L('Signed in with your Claude account. Your games, your journal and the memory of your past runs follow you from device to device.', 'Connecté avec ton compte Claude. Tes parties, ton journal et la mémoire de tes runs te suivent d\'un appareil à l\'autre.')}</p>
       <div class="row"><button class="btn primary" data-act="enter">${L('Enter', 'Entrer')}${nm ? ' · ' + esc(nm) : ''}</button></div>`
    : `<p class="muted" style="margin:0;max-width:44ch">${L('No account detected here. You can play as a guest: saves stay on this device. Open the game from your Claude account to sync them.', 'Aucun compte détecté ici. Tu peux jouer en invité : les sauvegardes restent sur cet appareil. Ouvre le jeu depuis ton compte Claude pour les synchroniser.')}</p>
       <div class="row"><button class="btn primary" data-act="enter">${L('Play as guest', 'Jouer en invité')}</button></div>`;
  return `<div class="app"><div class="title-screen"><div class="brand">savepoint</div>${av}<h1>${nm ? L('Welcome back', 'Content de te revoir') + ',<br><span class="ink">' + esc(nm) + '</span>' : 'School Life<br><span class="ink">Simulator</span>'}</h1>
  <div class="card" style="display:flex;flex-direction:column;gap:12px"><b>${Store.cloud ? '☁ ' + L('Claude account', 'Compte Claude') : L('Guest', 'Invité')}</b>${body}</div>
  <div class="row">${themeBtn('btn ghost small')}${langBtn('btn ghost small')}</div></div></div>`;
}
function titleScreen() {
  const has = V.hasAuto;
  return `<div class="app"><div class="title-screen"><div class="brand">savepoint${V.clues && V.clues.k0 ? '' : ' <i class="blot" data-reveal="k0" aria-hidden="true"></i>'}</div>${V.clues && V.clues.k0 ? `<p class="small" style="margin:0">${inkHtml('k0', CLUES().k0)}</p>` : ''}<h1>School Life<br><span class="ink">Simulator</span></h1>
  <p class="muted" style="max-width:46ch;margin:0">${L('One school year. 194 days. Popularity, money, friendships, rumors. Do not hit zero.', 'Une année scolaire. 194 jours. Popularité, argent, amitiés, rumeurs. Ne tombe pas à zéro.')}</p>${clueN() >= 6 ? `<p class="small" style="margin:0">${inkHtml('k8', CLUES().k8)}</p>` : ''}
  <div class="row">${has ? `<button class="btn primary" data-act="continue">${t('Continue game')}</button>` : ''}<button class="btn ${has ? '' : 'primary'}" data-act="start">${t('New game')}</button><button class="btn ghost" data-act="saves0">${t('Saved games')}</button><button class="btn ghost" data-act="endbook">${t('Endings')}</button></div>
  <div class="row"><button class="btn ghost small" data-act="settings">${t('Settings')}</button>${themeBtn('btn ghost small')}${langBtn('btn ghost small')}<button class="btn ghost small" data-act="help">${t('Help')}</button><button class="btn ghost small" data-act="stats">${L('Stats', 'Stats')}</button><button class="btn ghost small" data-act="mute" aria-pressed="${!!PREF.muted}">${PREF.muted ? '🔇' : '🔊'} ${L('Sound', 'Son')}</button></div>
  ${has ? `<p class="small muted" style="margin:0">${Store.cloud ? '☁ ' : ''}${esc(V.autoInfo || '')}</p>` : ''}</div></div>`;
}
function overScreen() {
  const last = S.log.slice(-3).reverse().map(logRow).join('');
  return `<div class="app"><div class="over"><div class="brand">${t('Game over')}</div><h1>${L('You fell off everyone\'s radar.', 'Tu as disparu des radars.')}</h1><p class="muted">${t('Your popularity hit zero.')} ${fmtDate(E.dayOf(S).d)} · ${t('Day')} ${S.di + 1}</p>
  <div class="row" style="justify-content:center"><button class="btn" data-act="readj">📖 ${t('Journal')}</button><button class="btn primary" data-act="newgame2">${t('Play again')}</button><button class="btn" data-act="saves0">${t('Load')}</button></div></div></div>`;
}
const lineHtml = l => /^[^:]{1,40}: “/.test(l) ? `<p class="say">${esc(l)}</p>` : `<p>${esc(l)}</p>`;
function endingScreen() {
  const en = E.ENDBY[S.ending.id]; const x = E.stats(S);
  const epi = S.ending.epi.map(id => E.ENDBY[id]).filter(Boolean);
  const top = E.metKids(S).slice().sort((a, b) => S.rel[b] - S.rel[a]).slice(0, 4);
  return `<div class="app"><div class="over" style="text-align:left"><div class="brand">${t('Your ending')} · ${fmtDate(E.dayOf(S).d)}</div><h1 style="color:${en.bad ? 'var(--bad)' : 'var(--fg)'};margin:8px 0">${esc(en.n)}</h1>
  <div class="end-quote">${esc(en.q)}</div>${en.body ? `<p>${esc(en.body)}</p>` : ''}<p class="muted"><i>Moral: ${esc(en.moral)}</i></p><p class="small">${inkHtml('k7', CLUES().k7)}</p>
  ${epi.map(e => `<div class="card"><b>${esc(e.n)}</b><div class="end-quote" style="font-size:.95em">${esc(e.q)}</div><div class="small muted"><i>${esc(e.moral)}</i></div></div>`).join('')}
  <div class="card"><h3>${t('Final stats')}</h3>${statBoxes()}
  <p class="small muted" style="margin:10px 0 0">${top.map(n => esc(n.split(' ')[0]) + ' ' + signed(S.rel[n])).join(' · ')}</p></div>
  <div class="row"><button class="btn primary" data-act="newgame2">${t('Play again')}</button><button class="btn" data-act="readj">📖 ${t('Journal')}</button><button class="btn" data-act="endbook">${t('Endings')}</button><button class="btn" data-act="summary">${L('Run summary', 'Résumé')}</button>${noteMcBtn()}${listenBtn()}<button class="btn ghost" data-act="saves0">${t('Load')}</button></div></div></div>`;
}

/* ---------- dialogs: saved games, endings book ---------- */
async function showSaves(fromTitle) {
  const m = await Store.metas();
  const row = (k, label) => {
    const x = m[k];
    return `<div class="slot"><div><b>${label}</b><div class="small muted">${x ? `${fmtDate(x.date)} · POP ${x.pop} · $${x.money} · ${t('Grade')} ${x.grade}${x.over ? ' · ' + t('Game over') : ''}${x.ending ? ' · ' + esc(E.ENDBY[x.ending].n) : ''}` : t('Empty slot')}</div></div><div class="row">${!fromTitle && k !== 'auto' && S && !S.over && S.phase !== 'ending' ? `<button class="btn small" data-act="saveto" data-v="${k}">${t('Save')}</button>` : ''}${x ? `<button class="btn small" data-act="loadfrom" data-v="${k}">${t('Load')}</button><button class="btn small ghost" data-act="delslot" data-v="${k}">✕</button>` : ''}</div></div>`;
  };
  const acc = Store.cloud ? '☁ ' + L('Saved to your Claude account', 'Liées à ton compte Claude') : L('On this device only', 'Sur cet appareil');
  V.savesOpen = true;
  openModal(head(t('Saved games'), `<span class="tag alt">${acc}</span>`) + row('auto', t('Autosave')) + row('s1', 'Slot 1') + row('s2', 'Slot 2') + row('s3', 'Slot 3'));
}
async function showEndBook() {
  const p = await Store.prefs(); const seen = new Set((p.seen || []).concat(V.seen || []));
  const row = e => { const on = seen.has(e.id); return `<div class="endrow"><span class="dot ${on ? 'on' : ''}"></span><div><b${on && e.bad ? ' style="color:var(--bad)"' : ''}>${on ? esc(e.n) : '???'}</b><div class="small muted">${on ? esc(e.q) : esc(e.hint)}</div>${on ? `<div class="small muted"><i>${esc(e.moral)}</i></div>` : ''}</div></div>`; };
  const good = E.ENDINGS.filter(e => !e.bad), bad = E.ENDINGS.filter(e => e.bad); const n = l => l.filter(e => seen.has(e.id)).length;
  openModal(head(t('Endings'), '') + `<p class="muted small">${seen.size}/${E.ENDINGS.length} ${t('unlocked')}</p><h3 style="margin:10px 0 0">${t('Good endings')} · ${n(good)}/${good.length}</h3>${good.map(row).join('')}<h3 style="margin:14px 0 0">${t('Hard endings')} · ${n(bad)}/${bad.length}</h3>${bad.map(row).join('')}`);
}


/* ---------- phone ---------- */
/* button labels for one-to-one texting actions [EN, FR] */
const PHL = { chat_school: ['Chat about school', 'Parler de l\'école'], chat_hobbies: ['Chat about hobbies', 'Parler de loisirs'], chat_daily: ['Chat about daily life', 'Parler du quotidien'], chat_rumor: ['Ask what they heard', 'Demander ce qu\'ils ont entendu'], compliment: ['Send a compliment', 'Envoyer un compliment'], message: ['Say hi', 'Dire salut'], askhelp: ['Ask for help', 'Demander de l\'aide'], advice: ['Ask for advice', 'Demander conseil'], cheer: ['Cheer them up', 'Remonter le moral'], tease: ['Send a joke', 'Envoyer une blague'], askmoney: ['Ask to borrow money', 'Demander de l\'argent'], lend: ['Offer to lend $5', 'Proposer de prêter 5 $'], apologize: ['Say sorry', 'Présenter des excuses'], boundary: ['Set a boundary', 'Poser une limite'] };
const unkOn = () => !!S && !S.over && S.di >= 3;
const unkNew = () => unkOn() && !(S.phone && S.phone.unkSeen);
const phUnread = () => { const un = (S && S.phone && S.phone.un) || {}; return Object.values(un).reduce((a, b) => a + b, 0) + (unkNew() ? 1 : 0); };
const phLeft = () => Math.max(0, E.PHONE_CAP - ((S.today && S.today.ph) || 0));
function phBadge() { const n = phUnread(); return n ? `<span class="phbadge">${n}</span>` : ''; }

/* ---------- phone minigames ---------- */
const RF = [
  [['I bombed the test. I studied all night.', 'J\'ai raté le test. J\'ai étudié toute la nuit.'], [['That is rough. Want to talk about it?', 'C\'est dur. Tu veux en parler ?'], ['You should have studied more.', 'Tu aurais dû étudier plus.'], ['lol ok', 'mdr ok']], 0],
  [['Guess who got the lead in the school play!', 'Devine qui a décroché le rôle principal à la pièce !'], [['Congratulations! You earned it.', 'Félicitations ! Tu l\'as mérité.'], ['Cool.', 'Cool.'], ['They must have run out of people.', 'Ils ont dû manquer de monde.']], 0],
  [['I think I lost my best friend today.', 'Je crois que j\'ai perdu mon meilleur ami aujourd\'hui.'], [['Drama again?', 'Encore du drame ?'], ['I am here. Do you want to call?', 'Je suis là. Tu veux m\'appeler ?'], ['That is life.', 'C\'est la vie.']], 1],
  [['I made cookies and they look like rocks.', 'J\'ai fait des biscuits et ils ressemblent à des cailloux.'], [['Honestly, I will still eat one.', 'Honnêtement, j\'en mangerais un quand même.'], ['Wow. Do not quit your day job.', 'Wow. Ne démissionne pas.'], ['Gross.', 'Beurk.']], 0],
  [['Can I sit with you at lunch tomorrow?', 'Je peux m\'asseoir avec toi demain midi ?'], [['Sure. I will save you a seat.', 'Bien sûr. Je te garde une place.'], ['Ask someone else.', 'Demande à quelqu\'un d\'autre.'], ['We will see.', 'On verra.']], 0],
  [['I am nervous about my presentation.', 'Je suis nerveux pour mon exposé.'], [['Just do not mess up.', 'Ne rate pas ça, c\'est tout.'], ['You will do great. Want to practise on me?', 'Tu vas assurer. Tu veux t\'entraîner devant moi ?'], ['Everyone gets nervous. Whatever.', 'Tout le monde stresse. Peu importe.']], 1],
  [['Someone laughed at my drawing.', 'Quelqu\'un s\'est moqué de mon dessin.'], [['It is just a drawing.', 'C\'est juste un dessin.'], ['Their loss. I like it a lot.', 'Tant pis pour eux. Je l\'aime beaucoup.'], ['Who cares.', 'On s\'en fiche.']], 1],
  [['I forgot your birthday. I am so sorry.', 'J\'ai oublié ton anniversaire. Je suis vraiment désolé.'], [['It is fine. Thanks for saying it.', 'Ce n\'est pas grave. Merci de me le dire.'], ['Wow. Unbelievable.', 'Wow. Incroyable.'], ['Whatever.', 'Peu importe.']], 0],
  [['Our team lost the game and everyone is blaming me.', 'Notre équipe a perdu et tout le monde m\'accuse.'], [['Maybe they are right.', 'Ils ont peut-être raison.'], ['That is unfair. It was a team loss.', 'C\'est injuste. C\'était une défaite d\'équipe.'], ['Sports are dumb anyway.', 'Le sport, c\'est nul de toute façon.']], 1],
  [['Do you want to hang out this weekend?', 'Tu veux qu\'on se voie ce week-end ?'], [['Yes! What should we do?', 'Oui ! On fait quoi ?'], ['I will think about it.', 'J\'y réfléchis.'], ['Maybe if nothing better comes up.', 'Peut-être si rien de mieux ne se présente.']], 0],
];
const WV = { Maya: 'warm', Ethan: 'shy', Chloe: 'cool', Liam: 'playful', Amira: 'warm', Noah: 'blunt', Sophie: 'warm', Lucas: 'playful', Zara: 'cool', Oliver: 'shy', Emma: 'warm', Jayden: 'blunt', Isabella: 'cool', Gabriel: 'blunt', Aaliyah: 'warm', Felix: 'playful', Aria: 'warm', Sebastian: 'playful', Yuki: 'shy', Daniel: 'playful', Evelyn: 'cool', Adrian: 'blunt', Luna: 'shy', Nathaniel: 'shy', Kiara: 'blunt', Theo: 'shy', Naomi: 'warm', Vincent: 'cool', Freya: 'warm', Axel: 'playful' };
const WS = {
  shy: [['um... hi. sorry to bother you', 'euh... salut. désolé de te déranger'], ['no worries if you are busy...', 'pas grave si tu es occupé...'], ['i finished the drawing. if you want to see.', 'j\'ai fini le dessin. si tu veux voir.']],
  blunt: [['Where were you. Class started.', 'T\'étais où. Le cours a commencé.'], ['That was a bad idea. Just saying.', 'C\'était une mauvaise idée. Je dis ça comme ça.'], ['Fine. I will do it myself.', 'Bon. Je le ferai moi-même.']],
  warm: [['Hiii! How are you?? 💛', 'Coucou ! Comment ça va ?? 💛'], ['Thinking of you! Hope your day is lovely!', 'Je pense à toi ! Belle journée !'], ['Aww thank you so much!!', 'Oh merci beaucoup !!']],
  cool: [['Noted.', 'Noté.'], ['We will see.', 'On verra.'], ['I suppose that was acceptable.', 'Je suppose que c\'était acceptable.']],
  playful: [['guess who just found a frog 🐸', 'devine qui vient de trouver une grenouille 🐸'], ['bet you cannot beat my score lol', 'je parie que tu ne battras pas mon score mdr'], ['plot twist: I forgot my lunch AGAIN', 'rebondissement : j\'ai encore oublié mon dîner']],
};
const EM = [
  ['🍕🎬', ['Movie night with pizza', 'Soirée cinéma avec pizza'], [['Pizza delivery gone wrong', 'Livraison de pizza ratée'], ['A very long film class', 'Un très long cours de cinéma'], ['A cooking show', 'Une émission de cuisine']]],
  ['📚😴', ['Falling asleep while studying', 'S\'endormir en étudiant'], [['A very quiet library', 'Une bibliothèque très calme'], ['Reading a bedtime story', 'Lire une histoire du soir'], ['Book sale', 'Vente de livres']]],
  ['🌧️🥾', ['A muddy walk in the rain', 'Une marche boueuse sous la pluie'], [['Buying new boots', 'Acheter des bottes neuves'], ['Cancelled picnic', 'Pique-nique annulé'], ['A swimming lesson', 'Un cours de natation']]],
  ['🎂🎈', ['Birthday party', 'Fête d\'anniversaire'], [['A bakery opening', 'L\'ouverture d\'une boulangerie'], ['A balloon shop', 'Une boutique de ballons'], ['Cooking class', 'Cours de cuisine']]],
  ['🚲💨', ['Biking really fast', 'Rouler très vite à vélo'], [['Lost bicycle', 'Vélo perdu'], ['Windy day', 'Journée venteuse'], ['Bike repair', 'Réparation de vélo']]],
  ['🎤🐱', ['A cat who sings', 'Un chat qui chante'], [['Cat in a pet shop', 'Chat dans une animalerie'], ['A noisy neighbour', 'Un voisin bruyant'], ['A music teacher', 'Un prof de musique']]],
  ['🧪💥', ['Science experiment gone wrong', 'Expérience de sciences ratée'], [['Fireworks show', 'Feu d\'artifice'], ['A new potion shop', 'Une boutique de potions'], ['Chemistry homework', 'Devoir de chimie']]],
  ['🏀🏆', ['Winning the basketball final', 'Gagner la finale de basket'], [['Buying a trophy', 'Acheter un trophée'], ['Gym class', 'Cours d\'éducation physique'], ['A broken hoop', 'Un panier cassé']]],
  ['🌙📱', ['Texting late at night', 'Envoyer des textos tard la nuit'], [['A broken phone', 'Un téléphone cassé'], ['Moon photo', 'Photo de la lune'], ['A phone store', 'Un magasin de téléphones']]],
  ['☕📝', ['Studying at a café', 'Étudier dans un café'], [['A coffee spill', 'Du café renversé'], ['Taking an order', 'Prendre une commande'], ['A diary', 'Un journal intime']]],
];
function pgSeed() { return (S.seed ^ (S.di * 2654435761)) >>> 0; }
function pgRng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pgShuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pgStop() { if (V.pgT) clearInterval(V.pgT); if (V.pgTO) clearTimeout(V.pgTO); V.pgT = V.pgTO = null; }
const PGI = { reply: ['⚡', 'Reply fast', 'Réponds vite', 'Pick the kindest reply before the timer ends. Good answers help a friendship.', 'Choisis la réponse la plus gentille avant la fin du chrono. Les bonnes réponses aident une amitié.'], who: ['🕵️', 'Who texted?', 'Qui a écrit ?', 'Match each message to the classmate who would write it. A good eye helps in class.', 'Associe chaque message au camarade qui l\'écrirait. Un bon œil aide en classe.'], emoji: ['🧩', 'Emoji decoder', 'Décodeur d\'émojis', 'Guess what the emoji mean. Small prizes.', 'Devine ce que veulent dire les émojis. Petits prix.'], tap: ['🫧', 'Bubble tap', 'Bulles', 'Pop as many bubbles as you can in 15 seconds. Small prizes.', 'Éclate un maximum de bulles en 15 secondes. Petits prix.'] };
function pgStart(id) {
  if (S.today['pg_' + id]) { toast(L('You already played that today.', 'Tu as déjà joué à ça aujourd\'hui.')); return; }
  const off = E.phoneOff(S); if (off) { toast(off); return; }
  pgStop(); const r = pgRng(pgSeed() + id.length * 97 + (S.pgN || 0)); const g = { id, i: 0, score: 0, ans: null, done: false, res: null };
  if (id === 'reply') g.q = pgShuffle(RF, r).slice(0, 5);
  else if (id === 'who') { const kids = E.metKids(S).filter(n => WV[n.split(' ')[0]]); g.q = pgShuffle(kids, r).slice(0, 5).map(n => { const v = WV[n.split(' ')[0]]; const others = pgShuffle(kids.filter(k => WV[k.split(' ')[0]] !== v), r).slice(0, 2); const line = WS[v][Math.floor(r() * 3)]; return { line, right: n, opts: pgShuffle([n].concat(others), r) }; }); }
  else if (id === 'emoji') g.q = pgShuffle(EM, r).slice(0, 5).map(e => ({ e: e[0], right: e[1], opts: pgShuffle([e[1]].concat(e[2].slice(0, 3)), r) }));
  else if (id === 'tap') { g.left = 15; }
  V.pg = g; V.ph = { name: '@play' }; renderModal(); pgArm();
}
function pgArm() {
  const g = V.pg; if (!g || g.done) return; pgStop();
  if (g.id === 'reply') { g.t = 8; V.pgT = setInterval(() => { g.t -= 0.1; const bar = document.getElementById('pgbar'); if (bar) bar.style.width = Math.max(0, g.t / 8 * 100) + '%'; if (g.t <= 0) { pgAnswer(-1); } }, 100); }
  if (g.id === 'tap') { g.t0 = Date.now(); let sp = 0; V.pgT = setInterval(() => { const ar = document.getElementById('pgarena'); const left = Math.max(0, 15 - (Date.now() - g.t0) / 1000); const tm = document.getElementById('pgtime'); if (tm) tm.textContent = Math.ceil(left) + 's'; if (left <= 0) { pgFinish(); return; } if (!ar) return; sp++; const b = document.createElement('button'); b.className = 'bubble'; b.type = 'button'; b.setAttribute('aria-label', L('Pop', 'Éclater')); const w = ar.clientWidth - 48, h = ar.clientHeight - 48; b.style.left = Math.floor(Math.random() * Math.max(10, w)) + 'px'; b.style.top = Math.floor(Math.random() * Math.max(10, h)) + 'px'; const pop = ev => { ev.preventDefault(); ev.stopPropagation(); if (b.dataset.p) return; b.dataset.p = 1; g.score++; b.classList.add('pop'); const sc = document.getElementById('pgscore'); if (sc) sc.textContent = g.score; setTimeout(() => b.remove(), 120); SFX.tap(); }; b.addEventListener('pointerdown', pop); b.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') pop(ev); }); ar.appendChild(b); setTimeout(() => { if (b.parentNode && !b.dataset.p) b.remove(); }, 1500); }, 600); }
}
function pgAnswer(k) {
  const g = V.pg; if (!g || g.done || g.ans != null) return; pgStop(); const q = g.q[g.i];
  const right = g.id === 'reply' ? q[2] : q.opts.indexOf(q.right); g.ans = k; if (k === right) g.score++;
  renderModal(); V.pgTO = setTimeout(() => { g.i++; g.ans = null; if (g.i >= g.q.length) pgFinish(); else { renderModal(); pgArm(); } }, 900);
}
function pgFinish() {
  const g = V.pg; if (!g || g.done) return; pgStop(); g.done = true; const max = g.id === 'tap' ? 20 : 5;
  g.res = E.phoneGame(S, g.id, Math.min(g.score, g.id === 'tap' ? 40 : 5), max); g.max = max;
  try { Store.autosave(S); } catch (e) {} render(); renderModal();
}
function pgHtml() {
  const g = V.pg; if (!g) return '';
  const info = PGI[g.id]; const ttl = L(info[1], info[2]);
  const back = `<button class="btn ghost small" data-act="phgames">← ${L('Games', 'Jeux')}</button>`;
  if (g.done) {
    const r = g.res || {}; if (r.err) return head(ttl, '') + `<p>${esc(r.err)}</p>` + back;
    const perfect = g.id === 'emoji' && g.score >= 5;
    return head(ttl, '') + `<p class="desc" style="font-size:1.15em"><b>${g.id === 'tap' ? g.score + ' ' + L('bubbles', 'bulles') : g.score + ' / ' + g.max}</b></p><div class="lines">${(r.lines || []).map(x => `<p>${esc(x)}</p>`).join('')}</div>${chips(r.chips)}${perfect ? `<p class="small" style="margin-top:10px">${inkHtml('k11', L('Whoever picked these emoji was not MC.', 'Celui qui a choisi ces émojis n\'était pas MC.'))}</p>` : ''}<div class="row" style="margin-top:12px">${back}</div>`;
  }
  if (g.id === 'tap') return head(ttl, '') + `<div class="row" style="justify-content:space-between"><b>${L('Score', 'Score')}: <span id="pgscore">${g.score}</span></b><b id="pgtime">15s</b></div><div id="pgarena" class="arena"></div><p class="small muted">${L('Tap or press the bubbles.', 'Touche les bulles.')}</p>`;
  const q = g.q[g.i]; const prog = `<div class="small muted">${g.i + 1} / ${g.q.length}</div>`;
  if (g.id === 'reply') {
    const right = q[2];
    return head(ttl, '') + prog + `<div class="phthread" style="max-height:none"><div class="bub them">${esc(LX(q[0]))}</div></div><div class="pgtimer"><div id="pgbar" style="width:${g.ans != null ? 0 : Math.max(0, g.t / 8 * 100)}%"></div></div>
    <div class="choices">${q[1].map((o, k) => `<button class="choice ${g.ans != null ? (k === right ? 'good' : k === g.ans ? 'bad' : 'dis') : ''}" data-act="pgans" data-v="${k}"><span class="l">${'ABC'[k]}</span><span>${esc(LX(o))}</span></button>`).join('')}</div>`;
  }
  if (g.id === 'who') return head(ttl, '') + prog + `<div class="phthread" style="max-height:none"><div class="bub them">${esc(LX(q.line))}</div></div><p class="small muted">${L('Who wrote this?', 'Qui a écrit ça ?')}</p><div class="choices">${q.opts.map((n, k) => `<button class="choice ${g.ans != null ? (n === q.right ? 'good' : k === g.ans ? 'bad' : 'dis') : ''}" data-act="pgans" data-v="${k}"><span class="l">${avatar(n, 26)}</span><span>${esc(n)}</span></button>`).join('')}</div>`;
  return head(ttl, '') + prog + `<div class="emoji">${q.e}</div><div class="choices">${q.opts.map((n, k) => `<button class="choice ${g.ans != null ? (n === q.right ? 'good' : k === g.ans ? 'bad' : 'dis') : ''}" data-act="pgans" data-v="${k}"><span class="l">${'ABCD'[k]}</span><span>${esc(LX(n))}</span></button>`).join('')}</div>`;
}
function gamesHtml() {
  const off = E.phoneOff(S);
  const card = id => { const i = PGI[id]; const played = !!S.today['pg_' + id]; const ready = S.di - ((S.pgLast && S.pgLast[id] != null) ? S.pgLast[id] : -99) >= E.PG_GAP[id];
    return `<div class="card" style="margin:0 0 10px"><div class="row" style="justify-content:space-between;align-items:center"><b>${i[0]} ${L(i[1], i[2])}</b><span class="small muted">${played ? '✔ ' + L('played today', 'joué aujourd\'hui') : ready ? '★ ' + L('prize ready', 'prix prêt') : L('just for fun', 'pour le plaisir')}</span></div><p class="small muted" style="margin:6px 0 8px">${L(i[3], i[4])}</p><button class="btn small ${played || off ? 'dis' : 'primary'}" data-act="pgstart" data-v="${id}" ${played ? `data-why="${ea(L('You already played that today.', 'Tu as déjà joué à ça aujourd\'hui.'))}"` : off ? `data-why="${ea(off)}"` : ''}>${L('Play', 'Jouer')}</button></div>`; };
  return head(L('Games', 'Jeux'), '') + `${phBack()}<p class="small muted" style="margin:10px 0">${L('One round of each game per day. Prizes are small and come back every few days.', 'Une partie de chaque jeu par jour. Les prix sont petits et reviennent tous les quelques jours.')}</p>${['reply', 'who', 'emoji', 'tap'].map(card).join('')}`;
}

const GCL = { g_hi: ['Post a friendly message', 'Poster un message sympa'], g_joke: ['Post a joke', 'Poster une blague'], g_notes: ['Ask if anyone has notes', 'Demander si quelqu\'un a des notes'], f_hi: ['Say hi to everyone', 'Dire bonjour à tout le monde'], f_photo: ['Share a photo from today', 'Partager une photo du jour'], f_help: ['Ask who can help with homework', 'Demander qui peut aider pour les devoirs'] };
const GCN = { '#class': ['Class group chat', 'Groupe de la classe', '👥'], '#fam': ['Family chat', 'Discussion familiale', '🏠'] };
/* pieces shared by the phone screens */
const phBack = () => `<button class="btn ghost small" data-act="phback">← ${L('Chats', 'Discussions')}</button>`;
const textsLeft = () => `${L('Texts left today', 'Textos restants aujourd\'hui')}: <b>${phLeft()}/${E.PHONE_CAP}</b>`;
const threadTop = () => `<div class="row" style="justify-content:space-between;align-items:center">${phBack()}<span class="small muted">${textsLeft()}</span></div>`;
// the bubbles of one thread; the last unanswered message gets its quick-reply buttons. senders: show who wrote (group chats)
function threadHtml(th, senders) {
  let lastQ = -1; th.forEach((m, i) => { if (m.q && !m.done) lastQ = i; });
  const bub = (m, i) => {
    if (m.f === 'sys') return (m.t || (m.c && m.c.length)) ? `<div class="bub sys">${m.t ? esc(m.t) : ''}${m.c && m.c.length ? chips(m.c, 1) : ''}</div>` : '';
    return `<div class="bub ${m.f}">${senders && m.f === 'them' && m.s ? `<b class="snd">${esc(m.s)}</b>` : ''}${esc(m.t)}</div>` + (i === lastQ ? `<div class="qr">${m.q.map((q, k) => `<button class="btn small" data-act="phreply" data-v="${k}">${esc(q[0])}</button>`).join('')}</div>` : '');
  };
  return th.map(bub).join('');
}
function groupHtml(key, offB) {
  const P = E.phoneOf(S); const th = P.th[key] || []; P.un[key] = 0;
  const acts = E.phoneGroupList(S, key);
  return head(LX(GCN[key]), '') + offB + `${threadTop()}
  <div class="phthread" id="phthread">${th.length ? threadHtml(th, true) : `<p class="small muted" style="margin:6px 0">${L('Quiet in here. Say something.', 'C\'est calme ici. Dis quelque chose.')}</p>`}</div>
  <div class="ib">${acts.map(a => `<button class="btn small ${a.ok ? '' : 'dis'}" data-act="phgact" data-v="${a.id}" ${a.ok ? '' : `data-why="${ea(a.why)}"`}>${LX(GCL[a.id])}</button>`).join('')}</div>`;
}

function phoneHtml() {
  const P = E.phoneOf(S); const nm = V.ph && V.ph.name; const OFF = E.phoneOff(S); const offB = OFF ? `<div class="warn" style="margin:0 0 10px">📵 ${esc(OFF)} ${esc(L('Talk to people in person today.', 'Parle aux gens en personne aujourd\'hui.'))}</div>` : '';
  if (nm === '@games') return gamesHtml();
  if (nm === '@play') return pgHtml();
  if (nm === '#class' || nm === '#fam') return groupHtml(nm, offB);
  if (nm === '?') {
    P.unkSeen = 1;
    const bub = (c, x) => `<div class="bub them">${x}</div>`;
    return head(L('Unknown number', 'Numéro inconnu'), '') + `${phBack()}
    <div class="phthread">${bub('', esc(L('Hey. Can you see this?', 'Hé. Tu vois ça ?')))}${bub('', inkHtml('k9', L('Move over the pale words. That is how I reach you.', 'Passe sur les mots pâles. C\'est ainsi que je te joins.')))}${bub('', inkHtml('k10', L('MC has never typed a single reply. Only you have.', 'MC n\'a jamais tapé une seule réponse. Il n\'y a que toi.')))}</div>
    <p class="small muted" style="margin:8px 0 0">${L('This number cannot receive replies.', 'Ce numéro ne peut pas recevoir de réponses.')}</p>`;
  }
  if (nm) {
    const th = P.th[nm] || []; P.un[nm] = 0;
    const acts = E.phoneList(S, nm);
    return head(nm, '') + offB + `${threadTop()}
    <div class="phthread" id="phthread">${th.length ? threadHtml(th, false) : `<p class="small muted" style="margin:6px 0">${L('No messages yet. Say something.', 'Aucun message pour l\'instant. Dis quelque chose.')}</p>`}</div>
    <div class="ib">${acts.map(a => `<button class="btn small ${a.ok ? '' : 'dis'}" data-act="phact" data-v="${a.id}" ${a.ok ? '' : `data-why="${ea(a.why)}"`}>${LX(PHL[a.id])}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="person" data-v="${ea(nm)}">${L('Open profile', 'Voir le profil')}</button></div>`;
  }
  const names = E.metOf(S, E.KIDS.concat(E.FAM));
  const act = names.filter(n => P.th[n] && P.th[n].length).sort((a, b) => (P.un[b] || 0) - (P.un[a] || 0) || (P.last[b] || 0) - (P.last[a] || 0));
  const rest = names.filter(n => !act.includes(n));
  const prev = n => { const th = P.th[n] || []; const m = th[th.length - 1]; if (!m) return ''; const x = m.f === 'sys' ? (m.t || '') : m.t; return (m.f === 'me' ? L('You: ', 'Toi : ') : '') + (x || ''); };
  const row = n => { const u = (P.un[n] || 0); return `<button class="phrow" data-act="phopen" data-v="${ea(n)}">${avatar(n, 38)}<div class="pmid"><div class="nm">${esc(n)}</div><div class="small muted phprev">${esc(prev(n))}</div></div>${u ? `<span class="phbadge">${u}</span>` : ''}</button>`; };
  const unk = unkOn() ? `<button class="phrow" data-act="phopen" data-v="?"><span class="av unk">?</span><div class="pmid"><div class="nm">${L('Unknown number', 'Numéro inconnu')}</div><div class="small muted phprev">${esc(L('Hey. Can you see this?', 'Hé. Tu vois ça ?'))}</div></div>${unkNew() ? '<span class="phbadge">1</span>' : ''}</button>` : '';
  const grow = key => { const th = P.th[key] || []; const m = th[th.length - 1]; const u = P.un[key] || 0; const p = m ? ((m.f === 'me' ? L('You: ', 'Toi : ') : m.s ? m.s + ': ' : '') + (m.t || '')) : ''; return `<button class="phrow" data-act="phopen" data-v="${key}"><span class="av unk">${GCN[key][2]}</span><div class="pmid"><div class="nm">${esc(LX(GCN[key]))}</div><div class="small muted phprev">${esc(p)}</div></div>${u ? `<span class="phbadge">${u}</span>` : ''}</button>`; };
  const gm = `<button class="phrow" data-act="phgames"><span class="av unk">🎮</span><div class="pmid"><div class="nm">${L('Games', 'Jeux')}</div><div class="small muted phprev">${L('Four quick games', 'Quatre jeux rapides')}</div></div></button>`;
  return head(L('Phone', 'Téléphone'), '') + offB + `<p class="small muted" style="margin:-4px 0 8px">${textsLeft()} · ${L('In-person actions use time blocks; texts are free but limited.', 'Les actions en personne utilisent des blocs de temps ; les textos sont gratuits mais limités.')}</p>
  <div class="card" style="padding:4px 12px">${unk}${S.di >= 1 ? grow('#class') + grow('#fam') : ''}${gm}${act.map(row).join('')}${act.length && rest.length ? `<div class="small muted" style="padding:8px 0 2px">${L('Contacts', 'Contacts')}</div>` : ''}${rest.map(row).join('')}</div>`;
}
function showPhone(name) { if (!S || S.over) return; V.ph = { name: name || null }; V.person = null; V.sub = null; V.res = null; E.phoneOf(S).ping = null; V.modal = phoneHtml; renderModal(); phScroll(); }
function phScroll() { const th = document.getElementById('phthread'); if (th) th.scrollTop = th.scrollHeight; }
function phDone(r) { if (r && r.err) { toast(r.err); } try { Store.autosave(S); } catch (e) {} render(); phScroll(); }

/* ---------- run summary (for feedback) & note for MC ---------- */
async function summaryText() {
  const p = await Store.prefs(); const lines = [];
  lines.push('School Life Simulator — run summary (' + L('EN', 'FR') + ')');
  if (S) {
    const kids = E.metKids(S).slice().sort((a, b) => S.rel[b] - S.rel[a]); const sg = n => signed(S.rel[n]);
    lines.push('Date in game: ' + E.dayOf(S).d + ' (day ' + (S.di + 1) + '/' + E.DAYS.length + ')');
    lines.push('POP ' + S.pop + ' · Grade ' + S.grade + ' · $' + S.money);
    lines.push('Status: ' + (S.ending ? 'ending "' + E.ENDBY[S.ending.id].n + '"' : S.over ? 'game over (POP 0)' : 'in progress'));
    lines.push('Closest: ' + kids.slice(0, 3).map(n => n.split(' ')[0] + ' ' + sg(n)).join(', '));
    lines.push('Furthest: ' + kids.slice(-2).map(n => n.split(' ')[0] + ' ' + sg(n)).join(', '));
    lines.push('Strange moments this run: ' + (S.strange || 0));
  } else lines.push('No game in progress.');
  lines.push('Faint-ink clues found: ' + clueN() + '/15' + (V.revealed ? ' (reveal seen)' : ''));
  lines.push('Runs finished: ' + ((p.runs || []).length) + ' · Endings seen: ' + ((V.seen || []).length) + '/' + E.ENDINGS.length);
  lines.push('Screen: ' + window.innerWidth + 'x' + window.innerHeight + ' · ' + ('ontouchstart' in window ? 'touch' : 'mouse'));
  lines.push('What did you think? (what was fun, confusing, too hard/easy, any bug):');
  return lines.join('\n');
}
async function showSummary() {
  const txt = await summaryText(); V.sumTxt = txt;
  openModal(() => head(L('Run summary', 'Résumé de la partie'), '') + `<p class="small muted">${L('Copy this and paste it into a message to the person who sent you the game, with your thoughts.', 'Copie ce texte et colle-le dans un message à la personne qui t\'a envoyé le jeu, avec ton avis.')}</p><textarea id="sumbox" class="notebox" rows="10" readonly>${ea(V.sumTxt)}</textarea><div class="row" style="margin-top:10px"><button class="btn primary" data-act="copysum">${L('Copy', 'Copier')}</button></div>`);
}
async function copySummary() {
  const box = $('#sumbox'); const txt = V.sumTxt || (box && box.value) || '';
  try { await navigator.clipboard.writeText(txt); toast(L('Copied.', 'Copié.')); } catch (e) { if (box) { box.focus(); box.select(); } toast(L('Select the text and copy it.', 'Sélectionne le texte et copie-le.')); }
}
async function showNoteMC() {
  const p = await Store.prefs(); V.noteVal = p.note || '';
  openModal(() => head(L('A note for MC', 'Un mot pour MC'), '') + `<p class="small muted">${L('MC knows someone is holding the pen. Write one short line. In your next run, MC will find it on the first page.', 'MC sait que quelqu\'un tient le stylo. Écris une courte ligne. Dans ta prochaine partie, MC la trouvera sur la première page.')}</p><textarea id="notebox" class="notebox" rows="3" maxlength="120" placeholder="${ea(L('For example: I will try to be gentler with you.', 'Par exemple : j\'essaierai d\'être plus doux avec toi.'))}">${ea(V.noteVal)}</textarea><div class="row" style="margin-top:10px"><button class="btn primary" data-act="savenote">${L('Leave the note', 'Laisser le mot')}</button>${V.noteVal ? `<button class="btn" data-act="clearnote">${L('Remove it', 'L\'enlever')}</button>` : ''}</div>`);
}
async function saveNote(clear) {
  const box = $('#notebox'); const v = clear ? '' : ((box && box.value) || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const p = await Store.prefs(); Store.prefs(Object.assign({}, p, { note: v })); V.noteVal = v;
  toast(v ? L('The note is waiting on the first page.', 'Le mot attend sur la première page.') : L('Note removed.', 'Mot retiré.')); closeModal(); if (S) render();
}
/* ---------- settings & help ---------- */
function showSettings() {
  openModal(() => {
    const fs = ['Normal', 'Large', 'Extra large'].map((n, i) => `<button class="btn ${PREF.fs === i ? 'primary' : ''}" data-act="fs" data-v="${i}" aria-pressed="${PREF.fs === i}">${t(n)}</button>`).join('');
    const sw = (act, on) => `<button class="btn ${on ? 'primary' : ''}" data-act="${act}" aria-pressed="${on}">${on ? t('On') : t('Off')}</button>`;
    return head(t('Settings'), '') +
      `<div class="card"><h3>${t('Text size')}</h3><div class="row">${fs}</div></div>
       <div class="card"><h3>${t('Reduced motion')}</h3><div class="row">${sw('rm', RM_ON())}</div><p class="small muted" style="margin:8px 0 0">${L('Turns off animations, including the journal page turns.', 'Coupe les animations, dont le tournage des pages du journal.')}</p></div>
       <div class="card"><h3>${t('Sound')}</h3><div class="row">${sw('snd', PREF.snd)}<input type="range" class="vol" data-vol="vs" min="0" max="100" value="${PREF.vs}" aria-label="${L('Volume', 'Volume')}"></div><p class="small muted" style="margin:8px 0 0">${L('Soft sounds: taps, results, page turns, the Ball, endings.', 'Petits sons doux : clics, résultats, pages, bal, fins.')}</p></div>
       <div class="card"><h3>${t('Music')}</h3><div class="row">${sw('mus', PREF.mus)}<input type="range" class="vol" data-vol="vm" min="0" max="100" value="${PREF.vm}" aria-label="${L('Volume', 'Volume')}"></div><p class="small muted" style="margin:8px 0 0">${L('Soft background music generated live by your browser: calm in class, brighter at the Ball and on holidays, darker when things go badly.', 'Musique douce de fond, composée en direct par ton navigateur : calme en classe, plus vive au bal et aux congés, plus sombre quand ça va mal.')}</p></div>
       <div class="card"><h3>${t('Voice')}</h3><div class="row">${Voice.ok() ? sw('voice', PREF.voice) + `<input type="range" class="vol" data-vol="vv" min="0" max="100" value="${PREF.vv}" aria-label="${L('Volume', 'Volume')}">` : ''}</div><p class="small muted" style="margin:8px 0 0">${Voice.ok() ? L('A few scenes are read aloud (the Ball, big school moments, endings) using your browser\'s built-in voices. These are synthetic, not recordings.', 'Quelques scènes sont lues à voix haute (bal, grands moments, fins) avec les voix de synthèse de ton navigateur. Ce ne sont pas des enregistrements.') : L('Read-aloud is not available in this browser.', 'La lecture à voix haute n\'est pas disponible dans ce navigateur.')}</p></div>
       <div class="card"><h3>${L('Faint text contrast', 'Contraste du texte pâle')}</h3><div class="row">${sw('ink', !!PREF.ink)}</div><p class="small muted" style="margin:8px 0 0">${L('Raises the contrast of very faint text and subtle details.', 'Augmente le contraste des textes très pâles et des détails discrets.')}</p><p class="small" style="margin:8px 0 0">${inkHtml('k2', CLUES().k2)}</p></div>
       <div class="card"><h3>${L('Share feedback', 'Donner un avis')}</h3><div class="row"><button class="btn" data-act="summary">${L('Copy run summary', 'Copier le résumé')}</button>${noteMcBtn()}</div><p class="small muted" style="margin:8px 0 0">${L('A short text with your stats and progress, to paste in a message with your thoughts.', 'Un court texte avec tes stats et ta progression, à coller dans un message avec ton avis.')}</p></div>
       <div class="card"><h3>${t('Keyboard')}</h3><p class="small muted" style="margin:0">${L('In an event: 1–6 or A–F to choose, Enter to continue, Esc to close. Journal: left and right arrows. With nothing open: 1–7 switch tabs.', 'Dans un événement : 1–6 ou A–F pour choisir, Entrée pour continuer, Échap pour fermer. Journal : flèches gauche et droite. Sans fenêtre ouverte : 1–7 pour changer d\'onglet.')}</p></div>`;
  });
}
function showHelp() {
  const en = `<div class="lines"><p><b>Goal.</b> Survive the school year (Aug 28 → Jun 23). If <b>POP</b> reaches 0 the run ends immediately. Otherwise you get an ending based on your stats, relationships and remembered choices.</p>
  <p><b>Each day.</b> A school event with choices. Then 3 after-school <i>time blocks</i> to talk with people, study, work, or shop. Press <i>End day</i> when done; random events, personal events and birthdays can happen in the evening. Classmates and family may also surprise you: compliments, small gifts, invitations, or word that someone has been talking about you.</p>
  <p><b>Phone.</b> The 📱 button opens your phone. Texting is free (no time block) but limited to 4 texts a day: chat, compliment, ask for help or advice, cheer someone up, apologise, borrow or lend a little money. Friends also text you first, sometimes with quick replies. Hanging out, studying, gifts and rumours still happen in person.</p>
  <p><b>Stats.</b> POP (0–100), Money, Grade, and a relationship (−100…+100) with each of the 40 characters. Helping or hurting someone also moves their friends a little.</p>
  <p><b>Risks.</b> Study checks depend on your Grade and prep. Cheating can get you caught. Rumors can reach their target, get disproven, and cost you popularity.</p>
  <p><b>Save.</b> Autosave runs every few seconds. Use Menu → Saved games for 3 manual slots.</p>
  <p class="muted small">Story text is in English; menus can be switched to French in the menu.</p></div>`;
  const fr = `<div class="lines"><p><b>But.</b> Survivre à l'année scolaire (28 août → 23 juin). Si la <b>POP</b> tombe à 0, la partie est perdue immédiatement. Sinon, tu obtiens une fin selon tes statistiques, tes relations et tes choix mémorisés.</p>
  <p><b>Chaque jour.</b> Un événement scolaire avec des choix, puis 3 blocs de temps après les cours : parler aux gens, étudier, travailler ou magasiner. Appuie sur <i>Finir la journée</i> ; des événements aléatoires, personnels ou des anniversaires peuvent survenir le soir. Camarades et famille peuvent aussi te surprendre : compliments, petits cadeaux, invitations, ou rumeur que quelqu'un parle de toi dans ton dos.</p>
  <p><b>Téléphone.</b> Le bouton 📱 ouvre ton téléphone. Les textos sont gratuits (aucun bloc de temps) mais limités à 4 par jour : discuter, faire un compliment, demander de l'aide ou un conseil, remonter le moral, s'excuser, emprunter ou prêter un peu d'argent. Tes amis t'écrivent aussi en premier, parfois avec des réponses rapides. Sortir, étudier, les cadeaux et les rumeurs se passent toujours en personne.</p>
  <p><b>Statistiques.</b> POP (0–100), argent, note, et une relation (−100…+100) avec chacun des 40 personnages.</p>
  <p class="muted small">Tout le jeu (histoire, dialogues, journal) est disponible en français et en anglais ; change la langue depuis le menu.</p></div>`;
  openModal(head(t('Help'), '') + L(en, fr) + `<p class="small" style="margin:12px 0 0">${inkHtml('k1', CLUES().k1)}</p><div class="row" style="margin-top:12px"><button class="btn" data-act="tutopen">${L('Replay the quick tour', 'Revoir la visite rapide')}</button></div>`);
}

/* ---------- game start & people interactions ---------- */
async function startNew() {
  const p = await Store.prefs(); const prev = p.name || ''; V.trait = 'bal'; V.ngpOn = false; const hasRuns = (p.runs || []).length > 0;
  const T = TRAITS(); const chips = T.map(x => `<button class="btn trait ${x[0] === 'bal' ? 'primary' : ''}" data-act="trait" data-v="${x[0]}" aria-pressed="${x[0] === 'bal'}">${x[1]}</button>`).join('');
  const dl = T.map(x => `<li><b>${x[1]}</b>: ${x[2]}</li>`).join('');
  openModal(head(L('Your name', 'Ton nom'), '') + `<p>${L('This is your character\'s name. They are not you: you are the one who decides for them. It replaces “MC” in what characters say.', 'C\'est le nom de ton personnage. Il n\'est pas toi : c\'est toi qui décides pour lui. Il remplace « MC » dans les dialogues.')}</p><input id="pname" class="nm-in" maxlength="16" autocomplete="off" placeholder="${L('Your name', 'Ton prénom')}" value="${ea(prev === 'MC' ? '' : prev)}">
  <h3 style="margin:14px 0 6px">${L('How does the year start?', 'Comment commence l\'année ?')}</h3><div class="row">${chips}</div><ul class="traitlist small muted">${dl}</ul>
  ${hasRuns ? `<div class="row" style="margin-top:6px"><button class="btn ghost" data-act="ngp" aria-pressed="false">${L('New Game+ bonus', 'Bonus Nouvelle partie+')}</button></div><p class="small muted" style="margin:6px 0 0">${L('+$20, and your closest friend from your last run starts the year at +20.', '+20 $, et ton meilleur ami de la dernière partie commence l\'année à +20.')}</p>` : ''}
  <div class="row" style="margin-top:14px"><button class="btn primary" data-act="begin">${L('Begin', 'Commencer')}</button><button class="btn ghost" data-act="close">${t('Close')}</button></div>`);
  setTimeout(() => { const i = $('#pname'); if (i) i.focus(); }, 60);
}
async function beginGame() {
  const i = $('#pname'); let nm = ((i && i.value) || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (!nm) { toast(L('Type a name first.', 'Écris un nom.')); return; }
  const p = await Store.prefs(); Store.prefs(Object.assign({}, p, { name: nm }));
  S = E.newGame(undefined, (V.seen || []).length > 0); S.name = nm; S.mem = memOf(p.runs); S.note = (V.revealed && p.note) ? String(p.note).slice(0, 120) : ''; applyTrait(S, V.trait, p, V.ngpOn); V.overDone = false; V.tab = 'today'; V.calM = 0; closeModal(); render(); if (!p.tut) startTut(true); else showEvent(); Store.put('auto', S);
}
function personAfter(r, title) { V.res = r; V.resTitle = title || 'Done'; if (r && r.err) { V.res = { chips: [], lines: [], err: r.err }; } Store.autosave(S); render(); renderModal(); }
function doInter(name, id, arg) {
  const r = E.interact(S, name, id, arg); V.sub = null;
  if (!r) return;
  if (r.err) { V.res = null; toast(r.err); renderModal(); return; }
  V.res = r; V.resTitle = 'Done';
  Store.autosave(S); renderBehind(); renderModal();
  if (S.over) { /* handled on close */ }
}
function renderBehind() { render(); }

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
      V.calM = Math.max(0, MONTHS.findIndex(([y, m]) => cur.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)));
    }
    closeModal(); render(); window.scrollTo(0, 0);
  },
  filter: v => { V.filter = v; render(); },
  sort: v => { V.sort = v; render(); },
  calm: v => { V.calM = +v; render(); },
  close: () => {
    Voice.stop();
    if (V.tut != null) { endTut(); return; }
    closeModal(); if (S) render();
  },
};

/* title screen, menu and dialogs */
const MENU_ACTIONS = {
  enter: () => { V.gate = false; render(); },
  settings: () => showSettings(),
  help: () => showHelp(),
  stats: () => { showStats(); },
  endbook: () => { showEndBook(); },
  summary: () => { showSummary(); },
  copysum: () => { copySummary(); },
  notemc: () => { showNoteMC(); },
  savenote: () => { saveNote(false); },
  clearnote: () => { saveNote(true); },
  theme: async () => {
    THEME = ({ system: 'light', light: 'dark', dark: 'system' })[THEME]; applyTheme();
    { const p = await Store.prefs(); Store.prefs(Object.assign({}, p, { theme: THEME })); }
    render(); renderModal();
  },
  lang: async () => {
    LANG = LANG === 'fr' ? 'en' : 'fr';
    { const p = await Store.prefs(); Store.prefs(Object.assign({}, p, { lang: LANG })); }
    render(); renderModal();
  },
};

/* settings toggles, sound and voice */
const SETTINGS_ACTIONS = {
  mute: () => {
    PREF.muted = !PREF.muted;
    if (PREF.muted) { Music.stop(); Voice.stop(); } else { Music.start(); SFX.tap(); }
    savePrefs(); render();
  },
  fs: v => { PREF.fs = +v; applyA11y(); savePrefs(); renderModal(); },
  ink: () => { PREF.ink = !PREF.ink; applyA11y(); savePrefs(); renderModal(); },
  rm: () => { PREF.rm = !RM_ON(); applyA11y(); savePrefs(); renderModal(); },
  snd: () => { PREF.snd = !PREF.snd; savePrefs(); renderModal(); if (PREF.snd) SFX.chime(); },
  mus: () => { PREF.mus = !PREF.mus; savePrefs(); if (PREF.mus) Music.start(); else Music.stop(); renderModal(); },
  voice: () => { PREF.voice = !PREF.voice; if (!PREF.voice) Voice.stop(); savePrefs(); renderModal(); },
  listen: () => {
    if (V.speaking) { Voice.stop(); }
    else if (S && S.ending && !V.evCur) Voice.say(endParts());
    else if (V.evCur) Voice.say(V.res ? resParts(V.evCur, V.res) : evParts(V.evCur));
  },
};

/* tutorial, new game, saved games */
const GAME_ACTIONS = {
  tutnext: () => { V.tut++; if (V.tut >= TUT().length) endTut(); else renderModal(); },
  tutprev: () => { V.tut = Math.max(0, V.tut - 1); renderModal(); },
  tutskip: () => { endTut(); },
  tutopen: () => startTut(false),
  start: () => { startNew(); },
  newgame2: () => { startNew(); },
  begin: () => { beginGame(); },
  trait: v => {
    V.trait = v;
    document.querySelectorAll('#ov [data-act=trait]').forEach(x => { const on = x.dataset.v === v; x.classList.toggle('primary', on); x.setAttribute('aria-pressed', on); });
  },
  ngp: (v, b) => { V.ngpOn = !V.ngpOn; b.classList.toggle('primary', V.ngpOn); b.setAttribute('aria-pressed', V.ngpOn); },
  newgame: () => openModal(head(t('New game'), '') + `<p>${L('Start over? Your current run stays in autosave until the new one replaces it.', 'Recommencer ? Ta partie actuelle reste dans la sauvegarde auto jusqu\'à ce qu\'elle soit remplacée.')}</p><div class="row"><button class="btn primary" data-act="start">${t('New game')}</button><button class="btn ghost" data-act="close">${t('Close')}</button></div>`),
  saves: (v, b, a) => { showSaves(a === 'saves0'); },
  saves0: (v, b, a) => { showSaves(a === 'saves0'); },
  continue: async () => {
    const x = await Store.get('auto');
    if (x) { S = x.S; V.overDone = false; V.tab = 'today'; render(); if (S.phase === 'event' && !S.over) showEvent(); }
  },
  saveto: async v => { await Store.put(v, S); toast(t('Saved.')); showSaves(false); },
  loadfrom: async v => {
    const x = await Store.get(v);
    if (x) { S = x.S; V.overDone = false; V.tab = 'today'; closeModal(); render(); toast(t('Loaded.')); if (S.phase === 'event' && !S.over) showEvent(); }
  },
  delslot: async v => { await Store.del(v); showSaves(!S); },
};

/* school events, gifts inside events, school minigames */
const EVENT_ACTIONS = {
  openev: () => showEvent(),
  pick: v => {
    const ev = V.evCur; const c = ev.choices[+v];
    if (c.disabled) { toast(c.why || ''); return; }
    if (c.gift) { V.sub = { type: 'gift' }; V.evPick = +v; renderModal(); return; }
    if (c.sp === 'academic') { V.evPick = +v; V.mg = newMg(ev); renderModal(); return; }
    V.res = E.choose(S, +v); V.res && (V.res.title = ev.title); render(); renderModal();
  },
  mgans: v => { const m = V.mg; if (m.ans == null) { m.ans = v; if (v === m.def.qs[m.i].a) m.ok++; } renderModal(); },
  mghint: () => {
    const m = V.mg;
    if (m.hints > 0 && m.ans == null) { const q = m.def.qs[m.i]; m.rem = q.o.filter(o => o !== q.a).slice(0, 2); m.hints--; }
    renderModal();
  },
  mgnext: () => { const m = V.mg; m.i++; m.ans = null; m.rem = []; if (m.i >= m.def.qs.length) m.done = true; renderModal(); },
  mgflip: v => mgFlip(+v),
  mgfinish: () => {
    const m = V.mg; let q, label;
    if (m.def.type === 'quiz') { q = m.ok / m.def.qs.length; label = m.def.label + ' ' + m.ok + '/' + m.def.qs.length; }
    else { q = m.misses <= 4 ? 1 : m.misses <= 7 ? 0.7 : 0.3; label = m.def.label + ' (' + m.misses + ' misses)'; }
    V.mg = null; V.res = E.choose(S, V.evPick, { mg: { q, label } }); render(); renderModal();
  },
  mgskip: () => { V.mg = null; V.res = E.choose(S, V.evPick); render(); renderModal(); },
  evgift: v => { V.res = E.choose(S, V.evPick, v); V.sub = null; render(); renderModal(); },
  evback: () => { V.sub = null; renderModal(); },
  evnext: () => { Voice.stop(); V.evCur = null; afterEvent(); },
};

/* after school: study, end the day, shop, jobs, kitchen and family time */
const DAY_ACTIONS = {
  study: () => {
    const r = E.study(S);
    if (r && r.err) toast(r.err);
    else { V.res = null; Store.autosave(S); render(); toast(L('Studied. +10% on your next check.', 'Tu as étudié. +10% au prochain test.')); }
  },
  endday: () => {
    const r = E.endDay(S); Store.autosave(S);
    if (S.phase === 'ending') { markEnding(); }
    render(); if (S.phase === 'event' && !S.over) showEvent();
  },
  buy: v => {
    const r = E.buy(S, +v);
    if (r && r.err) toast(r.err); else { Store.autosave(S); toast(L('Bought: ', 'Acheté : ') + tr(E.SHOP[+v].n)); }
    render();
  },
  use: v => { const r = E.useItem(S, v); if (r.err) toast(r.err); else toast((r.lines || [])[0] || 'Done'); Store.autosave(S); render(); },
  work: v => {
    const r = E.work(S, +v);
    if (r && r.err) toast(r.err); else { toast('+ $' + (r.chips.find(c => c.k === 'money') || { v: 0 }).v); Store.autosave(S); }
    render();
  },
  cook: v => showCook(v),
  bond: v => showBond(v),
  bondfor: (v, b) => {
    if (b.classList.contains('dis')) { toast(L('Not available right now.', 'Pas disponible pour le moment.')); return; }
    const [who, aid] = String(v).split('|'); const r = E.bond(S, who, aid);
    if (!r) return;
    if (r.err) { toast(r.err); return; }
    const ac = E.BONDS[who].acts.find(x => x.id === aid); Store.autosave(S);
    openModal(head(who, '') + `<p class="desc">${esc(tr(ac.n))}</p>` + outcomeHtml(r));
    render();
  },
  cookfor: v => {
    const [rid, who] = String(v).split('|'); const r = E.cook(S, rid, who);
    if (!r) return;
    if (r.err) { toast(r.err); return; }
    const rc = E.RECIPES.find(x => x.id === rid); const wl = who === 'self' ? L('yourself', 'toi-même') : who === 'family' ? L('your family', 'ta famille') : who; Store.autosave(S);
    openModal(head(L('Cooked ', 'Cuisiné : ') + tr(rc.n), '') + `<p class="desc">${L('You cooked for ', 'Tu as cuisiné pour ')}${esc(wl)}.</p>` + outcomeHtml(r));
    render();
  },
};

/* person profile: interactions and their sub-menus */
const PEOPLE_ACTIONS = {
  person: v => showPerson(v),
  presback: () => { V.res = null; V.sub = null; if (S.over) { closeModal(); render(); } else renderModal(); },
  subback: () => { V.sub = null; renderModal(); },
  aboutpick: v => { V.sub.subject = v; renderModal(); },
  inter: (v, b) => {
    if (b.dataset.why) { toast(b.dataset.why); return; }
    const name = V.person; const types = { talkabout: 'about', talk: 'talk', gift: 'gift', hangout: 'hangout', lend: 'lend', share: 'rumor', investigate: 'rumor', fight: 'fight', apologize: 'apologize' };
    if (types[v]) { V.sub = { type: types[v], id: v }; renderModal(); } else doInter(name, v);
  },
  go: v => { const s = V.sub; doInter(V.person, s.id, v); },
};

/* phone: threads, group chats, phone minigames */
const PHONE_ACTIONS = {
  phone: () => showPhone(),
  phtext: v => showPhone(v),
  phopen: v => { pgStop(); V.ph = { name: v }; renderModal(); phScroll(); },
  phback: () => { pgStop(); V.pg = null; V.ph = { name: null }; renderModal(); render(); },
  phgames: () => { pgStop(); V.pg = null; V.ph = { name: '@games' }; renderModal(); },
  pgstart: (v, b) => { if (b.dataset.why) { toast(b.dataset.why); return; } pgStart(v); },
  pgans: v => pgAnswer(+v),
  phgact: (v, b) => { if (b.dataset.why) { toast(b.dataset.why); return; } const r = E.phoneGroupAct(S, V.ph.name, v); phDone(r); renderModal(); phScroll(); },
  phact: (v, b) => { if (b.dataset.why) { toast(b.dataset.why); return; } const r = E.phoneAct(S, V.ph.name, v); phDone(r); renderModal(); phScroll(); },
  phreply: v => { const r = E.phoneReply(S, V.ph.name, +v); phDone(r); renderModal(); phScroll(); },
};

/* journal book */
const JOURNAL_ACTIONS = {
  jopen: () => jOpen(),
  jnext: () => jFlip(1),
  jprev: () => jFlip(-1),
  jtoday: () => jFlip(0, curSpread()),
  readj: () => { V.jFinal = true; V.jS = null; render(); },
  jclose: () => jClose(),
};

const ACTIONS = Object.assign({}, NAV_ACTIONS, MENU_ACTIONS, SETTINGS_ACTIONS, GAME_ACTIONS, EVENT_ACTIONS, DAY_ACTIONS, PEOPLE_ACTIONS, PHONE_ACTIONS, JOURNAL_ACTIONS);
const NO_TAP = new Set(['pick', 'inter']);

async function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) { if (e.target.id === 'ov' && V.modal && !V.evCur) closeModal(); return; }
  const a = b.dataset.act, v = b.dataset.v;
  if (!NO_TAP.has(a)) SFX.tap();
  if (Object.prototype.hasOwnProperty.call(ACTIONS, a)) await ACTIONS[a](v, b, a);
}

/* ---------- keyboard ---------- */
function onKey(e) {
  const tg = e.target; const typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA');
  if (e.key === 'Enter' && tg && tg.id === 'pname') { beginGame(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') { const mb = document.querySelector('[data-act=mute]'); if (mb) { e.preventDefault(); mb.click(); return; } }
  const ov = document.getElementById('ov'); const k = e.key; const onBtn = tg && tg.tagName === 'BUTTON';
  if (ov) {
    if (k === 'Escape') { const x = ov.querySelector('[data-act=close]'); if (x) { e.preventDefault(); x.click(); } return; }
    const ch = [...ov.querySelectorAll('.choice')]; const letter = k.length === 1 ? k.toUpperCase() : '';
    if (ch.length && letter) { const idx = /[1-9]/.test(letter) ? +letter - 1 : 'ABCDEFG'.indexOf(letter); if (idx >= 0 && ch[idx]) { e.preventDefault(); ch[idx].click(); return; } }
    if (k === 'Enter' && !onBtn) { const x = ov.querySelector('[data-act=evnext],[data-act=presback],[data-act=mgnext],[data-act=mgfinish]'); if (x) { e.preventDefault(); x.click(); } }
    return;
  }
  if (!S) return;
  if (V.tab === 'journal' && !(S.over || S.phase === 'ending')) { if (k === 'ArrowRight') { e.preventDefault(); jFlip(1); return; } if (k === 'ArrowLeft') { e.preventDefault(); jFlip(-1); return; } }
  if (/^[1-7]$/.test(k) && !(S.over || S.phase === 'ending')) { const tabs = document.querySelectorAll('.nav [data-act=tab]'); if (tabs[+k - 1]) tabs[+k - 1].click(); }
}

/* ---------- boot ---------- */
async function boot() {
  const root = $('#root');
  let jx = null;
  document.addEventListener('touchstart', e => { if (e.target.closest && e.target.closest('.spread')) jx = e.touches[0].clientX; else jx = null; }, { passive: true });
  document.addEventListener('touchend', e => { if (jx == null) return; const dx = e.changedTouches[0].clientX - jx; jx = null; if (Math.abs(dx) > 45) jFlip(dx < 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', onKey);
  const fk = e => { const t0 = e.target; if (!t0 || !t0.closest) return; const r = t0.closest('[data-reveal]'); if (r) { const id = r.dataset.reveal; V.clues = V.clues || {}; if (!V.clues[id]) { const ph = document.createElement('span'); ph.dataset.clue = id; revealInk(ph); render(); } return; } const k = t0.closest('.fink'); if (k) revealInk(k); };
  document.addEventListener('mouseover', fk); document.addEventListener('focusin', fk); document.addEventListener('click', fk);
  document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.vol; if (k) { PREF[k] = +e.target.value; applyVol(); } });
  document.addEventListener('change', e => { const k = e.target && e.target.dataset && e.target.dataset.vol; if (!k) return; savePrefs(); if (k === 'vs') SFX.chime(); else if (k === 'vv') Voice.say([{ t: L('This is how I sound.', 'Voici ma voix.'), who: null }]); });
  document.addEventListener('click', e => { if (!e.target.closest('#ov')) onClick(e); });
  document.addEventListener('input', e => { if (e.target.id === 'q') { V.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } } });
  try { if (document.fonts) { document.fonts.ready.then(() => { if ($('#spread')) jFit($('#spread')); }); document.fonts.addEventListener('loadingdone', () => { if ($('#spread')) jFit($('#spread')); }); } } catch (e) {}
  await Store.init();
  const p = await Store.prefs(); V.clues = p.clues || {}; V.revealed = !!p.revealed; if (p.ink != null) PREF.ink = p.ink; if (p.lang) LANG = p.lang; if (p.theme) THEME = p.theme; if (p.fs != null) PREF.fs = p.fs; if (p.rm != null) PREF.rm = p.rm; if (p.snd != null) PREF.snd = p.snd; if (p.voice != null) PREF.voice = p.voice; if (p.mus != null) PREF.mus = p.mus; if (p.muted != null) PREF.muted = p.muted; if (p.vm != null) PREF.vm = p.vm; if (p.vs != null) PREF.vs = p.vs; if (p.vv != null) PREF.vv = p.vv; applyTheme(); applyA11y(); V.seen = p.seen || []; V.prefName = p.name || ''; V.gate = true;
  const m = await Store.metas();
  if (m.auto && !m.auto.over && !m.auto.ending) { V.hasAuto = true; V.autoInfo = `${fmtDate(m.auto.date)} · POP ${m.auto.pop} · $${m.auto.money}`; }
  render();
}
window.__dbg = { jPageHtml, JN: () => JN(), jFit, render: () => render() };
window.addEventListener('DOMContentLoaded', boot);
})();

