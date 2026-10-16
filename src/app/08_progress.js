/* app/08_progress.js — Run records, tutorial, starting traits, achievements and stats. */
'use strict';
/* ---------- run records (stored in prefs.runs, used for achievements and memories of past runs) ---------- */
function runRecord() {
  const kids = E.KIDS.slice().sort((a, b) => S.rel[b] - S.rel[a]);
  const en = S.ending ? E.ENDBY[S.ending.id] : null;
  return {
    id: S.ending ? S.ending.id : 'over',
    epi: S.ending ? S.ending.epi : [],
    over: S.ending ? 0 : 1,
    bad: !S.ending || en.bad ? 1 : 0,
    pop: S.pop,
    grade: S.grade,
    money: S.money,
    friends: kids.filter(n => S.rel[n] >= 40).slice(0, 3),
    foes: kids
      .slice()
      .reverse()
      .filter(n => S.rel[n] <= -25)
      .slice(0, 3),
    cook: S.cookN || 0,
    sig: S.flags.COOKED_SIG ? 1 : 0,
    knife: S.perm['Cooking knife'] ? 1 : 0,
  };
}
async function recordRun() {
  if (!S || S.recorded || !(S.ending || S.over)) return;
  S.recorded = 1;
  const p = await Store.prefs();
  const runs = (p.runs || []).concat([runRecord()]).slice(-12);
  const before = new Set(p.ach || []);
  const c = achCtx(Object.assign({}, p, { runs }));
  const now = ACH()
    .filter(a => a[3](c))
    .map(a => a[0]);
  const fresh = ACH().filter(a => now.includes(a[0]) && !before.has(a[0]));
  await Store.prefs(Object.assign({}, p, { runs, ach: now }));
  if (fresh.length)
    setTimeout(() => toast('🏆 ' + L('Achievement', 'Succès') + ': ' + fresh.map(a => a[1]).join(', ')), 1500);
}
function memOf(runs) {
  if (!runs || !runs.length) return null;
  const last = runs[runs.length - 1];
  const uniq = k => {
    const o = [];
    runs
      .slice()
      .reverse()
      .forEach(r =>
        (r[k] || []).forEach(n => {
          if (!o.includes(n)) o.push(n);
        }),
      );
    return o;
  };
  return {
    n: runs.length,
    last: { id: last.id, bad: last.bad, over: last.over },
    foes: uniq('foes'),
    friends: uniq('friends'),
  };
}
async function markEnding() {
  if (!S.ending) return;
  const p = await Store.prefs();
  const seen = new Set(p.seen || []);
  seen.add(S.ending.id);
  S.ending.epi.forEach(i => seen.add(i));
  V.seen = [...seen];
  await Store.prefs(Object.assign({}, p, { seen: V.seen, lang: LANG, theme: THEME }));
  await recordRun();
  Store.put('auto', S);
}

/* ---------- tutorial ---------- */
const TUT = () => [
  {
    t: L('Your goal', 'Ton but'),
    b: L(
      'Survive one school year, from Aug 28 to Jun 23. Keep <b>POP</b> (popularity) above 0: if it hits 0 the run ends at once. Otherwise you get an ending shaped by your stats, your friendships and the choices people remember.',
      'Survivre à une année scolaire, du 28 août au 23 juin. Garde ta <b>POP</b> (popularité) au-dessus de 0 : si elle tombe à 0, la partie se termine tout de suite. Sinon tu obtiens une fin qui dépend de tes stats, de tes amitiés et des choix dont les gens se souviennent.',
    ),
  },
  {
    t: L('Every school day starts with an event', 'Chaque journée commence par un événement'),
    b: L(
      'Read the scene and pick a choice. Some choices are checks (grades help), some are risky, and some are just kind. Keys <b>A, B, C…</b> or <b>1, 2, 3…</b> pick a choice.',
      "Lis la scène et choisis. Certains choix sont des épreuves (tes notes aident), d'autres sont risqués, d'autres sont simplement gentils. Les touches <b>A, B, C…</b> ou <b>1, 2, 3…</b> choisissent.",
    ),
  },
  {
    t: L('After school: 3 time blocks', 'Après les cours : 3 blocs de temps'),
    b: L(
      'Each action (talking, studying, working, shopping) uses a block. When you are done, press <b>End day</b>. Surprises, personal events and birthdays can happen in the evening.',
      'Chaque action (parler, étudier, travailler, magasiner) utilise un bloc. Quand tu as fini, appuie sur <b>Finir la journée</b>. Des imprévus, des événements personnels et des anniversaires peuvent survenir le soir.',
    ),
  },
  {
    t: L('People, Shop, Work, Calendar', 'Gens, boutique, travail, calendrier'),
    b: L(
      '<b>People</b>: 40 characters, each with a relationship from −100 to +100. Talk, share, tease, give gifts. <b>Shop</b> and <b>Work</b> change your money and your options. <b>Calendar</b> shows holidays, birthdays and big days.',
      '<b>Gens</b> : 40 personnages, chacun avec une relation de −100 à +100. Parle, confie-toi, taquine, offre des cadeaux. La <b>boutique</b> et le <b>travail</b> changent ton argent et tes options. Le <b>calendrier</b> montre les congés, les anniversaires et les grands jours.',
    ),
  },
  {
    t: L('Risks and memory', 'Risques et mémoire'),
    b: L(
      'Cheating can get you caught. Rumors can reach their target, get disproven, and cost popularity. People remember what you did, and helping or hurting someone also moves their friends a little.',
      "Tricher peut te faire prendre. Les rumeurs peuvent atteindre leur cible, être démenties, et te coûter de la popularité. Les gens se souviennent de ce que tu as fait, et aider ou blesser quelqu'un touche aussi un peu ses amis.",
    ),
  },
  {
    t: L('Journal, saving, sound', 'Journal, sauvegarde, son'),
    b: L(
      'Your <b>Journal</b> writes itself as you play. The game autosaves; <b>Menu → Saved games</b> has 3 manual slots. Press <b>M</b> or tap 🔊 to mute everything; <b>Settings</b> has volume sliders, text size and more.',
      "Ton <b>journal</b> s'écrit tout seul pendant que tu joues. Le jeu se sauvegarde automatiquement ; <b>Menu → Parties sauvegardées</b> offre 3 emplacements manuels. Appuie sur <b>M</b> ou touche 🔊 pour tout couper ; les <b>Réglages</b> ont des curseurs de volume, la taille du texte et plus.",
    ),
  },
];
const tutHtml = () => {
  const T = TUT(),
    i = V.tut,
    st = T[i];
  return (
    head(L('Quick tour', 'Visite rapide'), `<span class="tag">${i + 1}/${T.length}</span>`) +
    (`<div class="lines"><p><b>${st.t}</b></p><p>${st.b}</p></div><div class="tutdots" aria-hidden="true">` +
      T.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('') +
      `</div><div class="row" style="margin-top:14px">` +
      (i > 0 ? `<button class="btn ghost" data-act="tutprev">${L('Back', 'Retour')}</button>` : '') +
      `<button class="btn primary" data-act="tutnext">` +
      (i === T.length - 1 ? L('Start playing', 'Jouer') : L('Next', 'Suivant')) +
      `</button><button class="btn ghost" data-act="tutskip">${L('Skip', 'Passer')}</button></div>`)
  );
};
function startTut(first) {
  V.tut = 0;
  V.tutFirst = !!first;
  openModal(tutHtml);
}
async function endTut() {
  const f = V.tutFirst;
  V.tut = null;
  V.tutFirst = false;
  closeModal();
  try {
    const p = await Store.prefs();
    if (!p.tut) Store.prefs(Object.assign({}, p, { tut: 1 }));
  } catch (e) {}
  if (f) showEvent();
  else if (S) render();
}

/* ---------- starting traits ---------- */
const TRAITS = () => [
  [
    'bal',
    L('Balanced', 'Équilibré'),
    L('The standard start.', 'Le départ habituel.'),
    { pop: 50, money: 50, grade: 55 },
  ],
  [
    'sch',
    L('Scholar', 'Bûcheur'),
    L('Strong grades, less money and fewer admirers.', "Bonnes notes, moins d'argent et de popularité."),
    { pop: 40, money: 30, grade: 70 },
  ],
  [
    'soc',
    L('Social', 'Social'),
    L('Popular, but behind in class.', 'Populaire, mais en retard en classe.'),
    { pop: 62, money: 40, grade: 45 },
  ],
  [
    'hus',
    L('Hustler', 'Débrouillard'),
    L('Cash in your pocket, average at everything else.', "De l'argent en poche, moyen partout ailleurs."),
    { pop: 45, money: 110, grade: 50 },
  ],
  [
    'rnd',
    L('Surprise me', 'Surprends-moi'),
    L(
      'A random year: random stats and a few random first impressions of classmates.',
      'Une année au hasard : stats aléatoires et quelques premières impressions de camarades au hasard.',
    ),
    null,
  ],
];
function applyTrait(S, id, p, ngp) {
  const T = TRAITS();
  let tr = T.find(x => x[0] === id) || T[0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
  let st = tr[3];
  if (!st) {
    const pool = T.filter(x => x[3]);
    st = Object.assign({}, pool[Math.floor(Math.random() * pool.length)][3]);
    st.pop = clamp(st.pop + (Math.random() * 12 - 6), 35, 70);
    st.money = clamp(st.money + (Math.random() * 30 - 15), 20, 130);
    st.grade = clamp(st.grade + (Math.random() * 12 - 6), 40, 75);
    const kids = E.metKids(S)
      .slice()
      .sort(() => Math.random() - 0.5);
    kids.slice(0, 3).forEach(n => {
      S.rel[n] += 12;
      S.min[n] = Math.min(S.min[n], S.rel[n]);
    });
    kids.slice(3, 5).forEach(n => {
      S.rel[n] -= 8;
      S.min[n] = Math.min(S.min[n], S.rel[n]);
    });
  }
  S.pop = st.pop;
  S.money = st.money;
  S.grade = st.grade;
  S.startGrade = st.grade;
  S.trait = tr[0];
  if (ngp && p && p.runs && p.runs.length) {
    S.money += 20;
    const f = (p.runs[p.runs.length - 1].friends || [])[0];
    if (f && S.rel[f] != null) {
      S.rel[f] += 20;
      S.min[f] = Math.min(S.min[f], S.rel[f]);
    }
    S.ngBonus = 1;
  }
}
/* ---------- achievements & stats ---------- */
const ACH = () => [
  ['first', L('First year', 'Première année'), L('Finish a run.', 'Terminer une partie.'), c => c.runs.length >= 1],
  [
    'survivor',
    L('Survivor', 'Survivant'),
    L('Reach the end of the school year.', "Arriver à la fin de l'année scolaire."),
    c => c.runs.some(r => !r.over),
  ],
  [
    'rock',
    L('Rock bottom', 'Le fond du trou'),
    L('Hit 0 popularity.', 'Tomber à 0 de popularité.'),
    c => c.runs.some(r => r.over),
  ],
  [
    'straight',
    L('Straight A', 'Premier de classe'),
    L('End a year with a grade of 90 or more.', "Finir l'année avec une note de 90 ou plus."),
    c => c.runs.some(r => r.grade >= 90),
  ],
  [
    'popular',
    L('Everybody knows you', 'Tout le monde te connaît'),
    L('End a year with 90 popularity or more.', "Finir l'année avec 90 de popularité ou plus."),
    c => c.runs.some(r => !r.over && r.pop >= 90),
  ],
  [
    'rich',
    L('Piggy bank', 'Tirelire'),
    L('End a year with $300 or more.', "Finir l'année avec 300 $ ou plus."),
    c => c.runs.some(r => r.money >= 300),
  ],
  [
    'crew',
    L('A real crew', 'Une vraie bande'),
    L('End a year with 3 close friends.', "Finir l'année avec 3 amis proches."),
    c => c.runs.some(r => (r.friends || []).length >= 3),
  ],
  [
    'both',
    L('Both sides', 'Les deux côtés'),
    L('See a good ending and a hard ending.', 'Voir une bonne fin et une fin difficile.'),
    c => c.good >= 1 && c.bad >= 1,
  ],
  ['c10', L('Ten endings', 'Dix fins'), L('Unlock 10 endings.', 'Débloquer 10 fins.'), c => c.seen >= 10],
  [
    'c25',
    L('Twenty-five endings', 'Vingt-cinq fins'),
    L('Unlock 25 endings.', 'Débloquer 25 fins.'),
    c => c.seen >= 25,
  ],
  ['c50', L('Fifty endings', 'Cinquante fins'), L('Unlock 50 endings.', 'Débloquer 50 fins.'), c => c.seen >= 50],
  [
    'all',
    L('Completionist', 'Complétiste'),
    L('Unlock every ending.', 'Débloquer toutes les fins.'),
    c => c.seen >= E.ENDINGS.length,
  ],
  [
    'knife',
    L('A good knife', 'Un bon couteau'),
    L("Receive Mom's cooking knife.", 'Recevoir le couteau de cuisine de Maman.'),
    c => c.runs.some(r => r.knife),
  ],
  [
    'chef',
    L('Little chef', 'Petit chef'),
    L('Cook the signature dish.', 'Cuisiner le plat signature.'),
    c => c.runs.some(r => r.sig),
  ],
  ['ink', L('Faint ink', 'Encre pâle'), L('Keep your eyes open.', "Garde l'œil ouvert."), c => c.clues >= 1],
  ['pen', L('Who holds the pen?', 'Qui tient le stylo ?'), '???', c => c.clues >= E.REVEAL_AT],
  [
    'again',
    L('Just one more year', 'Encore une année'),
    L('Finish 5 runs.', 'Terminer 5 parties.'),
    c => c.runs.length >= 5,
  ],
];
function achCtx(p) {
  const seen = new Set((p.seen || []).concat(V.seen || []));
  const list = E.ENDINGS.filter(e => seen.has(e.id));
  return {
    clues: clueN(),
    runs: p.runs || [],
    seen: list.length,
    good: list.filter(e => !e.bad).length,
    bad: list.filter(e => e.bad).length,
  };
}
async function showStats() {
  const p = await Store.prefs();
  const c = achCtx(p);
  const runs = c.runs;
  const mx = k => (runs.length ? Math.max(...runs.map(r => r[k] || 0)) : 0);
  const done = ACH().filter(a => a[3](c)).length;
  let cur = '';
  if (S && !S.over) {
    const tn = (TRAITS().find(x => x[0] === S.trait) || [])[1];
    cur =
      `<h3 style="margin:14px 0 6px">${L('This run', 'Cette partie')}</h3><div class="stats3"><div>` +
      `<b>${S.di + 1}/${DAYS.length}</b>${t('Day')}</div><div><b>${S.studies || 0}` +
      `</b>${L('Study sessions', "Séances d'étude")}</div><div><b>${S.jobsDone || 0}` +
      `</b>${L('Shifts worked', 'Quarts travaillés')}</div></div>` +
      `<p class="small muted" style="margin:6px 0 0">${L('Earned', 'Gagné')} $${S.earned || 0} · ${L('Spent', 'Dépensé')} $` +
      `${S.spent || 0} · ${L('Gifts', 'Cadeaux')} ${S.giftN || 0}${tn ? ' · ' + L('Start', 'Départ') + ': ' + esc(tn) : ''}` +
      `</p>`;
  }
  const best = runs.length
    ? `<div class="stats3"><div><b>${runs.length}</b>${L('Runs finished', 'Parties finies')}</div><div>` +
      `<b>${mx('grade')}</b>${L('Best grade', 'Meilleure note')}</div><div><b>${mx('pop')}` +
      `</b>${L('Best POP', 'Meilleure POP')}</div></div>` +
      `<p class="small muted" style="margin:6px 0 0">${L('Most money', "Plus d'argent")}: $${mx('money')}` +
      `</p>`
    : `<p class="muted small">` +
      L('Finish a run to see your records here.', 'Termine une partie pour voir tes records ici.') +
      `</p>`;
  const fr_ = {};
  runs.forEach(r =>
    (r.friends || []).forEach(n => {
      fr_[n] = (fr_[n] || 0) + 1;
    }),
  );
  const top = Object.entries(fr_)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const frh = top.length
    ? `<p class="small muted" style="margin:6px 0 0">${L('Most loyal friends', 'Amis les plus fidèles')}: ` +
      top.map(x => esc(x[0]) + ' ×' + x[1]).join(', ') +
      `</p>`
    : '';
  const ach =
    inkStatHtml(p) +
    ACH()
      .map(a => {
        const ok = a[3](c);
        return (
          `<div class="endrow"><span class="dot ${ok ? 'on' : ''}"></span><div><b>${ok ? esc(a[1]) : '???'}</b>` +
          `<div class="small muted">${esc(a[2])}</div></div></div>`
        );
      })
      .join('');
  openModal(
    head(L('Stats', 'Statistiques'), '') +
      (`<h3 style="margin:0 0 6px">${L('Records', 'Records')}</h3>${best}${frh}` +
        `<p class="small muted" style="margin:6px 0 0">${L('Endings', 'Fins')}: ${c.seen}/${E.ENDINGS.length} (${c.good} ` +
        `${L('good', 'bonnes')}, ${c.bad} ${L('hard', 'difficiles')})</p>${cur}` +
        `<h3 style="margin:14px 0 4px">${L('Achievements', 'Succès')} · ${done}/${ACH().length}</h3>${ach}`),
  );
}
