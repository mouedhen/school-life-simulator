/* UI layer (src/app/*.js)
 *
 * Everything the player sees: screens, tabs, modals, sound, journal, phone. The files in src/app/ are pieces of
 * one script: build.py pastes them in name order inside one function, after data.js, talk.js, fr.js, i18n.js and
 * the engine. The engine (window.Engine, here `E`) owns the game rules and the seeded RNG; the UI only renders
 * and reacts to clicks. Never call engine functions "just to look": many of them advance the seeded RNG.
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
 * Files and sections: see src/app/README.md.
 */
/* app/01_base.js — Small helpers, the UI translation table (t, L, FR), preferences and accessibility. */
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
