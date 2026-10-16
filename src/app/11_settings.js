/* app/11_settings.js — Run summary, note for MC, settings and help. */
'use strict';
/* ---------- run summary (for feedback) & note for MC ---------- */
async function summaryText() {
  const p = await Store.prefs();
  const lines = [];
  lines.push('School Life Simulator — run summary (' + L('EN', 'FR') + ')');
  if (S) {
    const kids = E.metKids(S)
      .slice()
      .sort((a, b) => S.rel[b] - S.rel[a]);
    const sg = n => signed(S.rel[n]);
    lines.push('Date in game: ' + E.dayOf(S).d + ' (day ' + (S.di + 1) + '/' + E.DAYS.length + ')');
    lines.push('POP ' + S.pop + ' · Grade ' + S.grade + ' · $' + S.money);
    lines.push(
      'Status: ' +
        (S.ending ? 'ending "' + E.ENDBY[S.ending.id].n + '"' : S.over ? 'game over (POP 0)' : 'in progress'),
    );
    lines.push(
      'Closest: ' +
        kids
          .slice(0, 3)
          .map(n => n.split(' ')[0] + ' ' + sg(n))
          .join(', '),
    );
    lines.push(
      'Furthest: ' +
        kids
          .slice(-2)
          .map(n => n.split(' ')[0] + ' ' + sg(n))
          .join(', '),
    );
    lines.push('Strange moments this run: ' + (S.strange || 0));
  } else lines.push('No game in progress.');
  lines.push('Faint-ink clues found: ' + clueN() + '/15' + (V.revealed ? ' (reveal seen)' : ''));
  lines.push(
    'Runs finished: ' + (p.runs || []).length + ' · Endings seen: ' + (V.seen || []).length + '/' + E.ENDINGS.length,
  );
  lines.push(
    'Screen: ' + window.innerWidth + 'x' + window.innerHeight + ' · ' + ('ontouchstart' in window ? 'touch' : 'mouse'),
  );
  lines.push('What did you think? (what was fun, confusing, too hard/easy, any bug):');
  return lines.join('\n');
}
async function showSummary() {
  const txt = await summaryText();
  V.sumTxt = txt;
  openModal(
    () =>
      head(L('Run summary', 'Résumé de la partie'), '') +
      (`<p class="small muted">` +
        L(
          'Copy this and paste it into a message to the person who sent you the game, with your thoughts.',
          "Copie ce texte et colle-le dans un message à la personne qui t'a envoyé le jeu, avec ton avis.",
        ) +
        `</p><textarea id="sumbox" class="notebox" rows="10" readonly>${ea(V.sumTxt)}</textarea>` +
        `<div class="row" style="margin-top:10px">` +
        `<button class="btn primary" data-act="copysum">${L('Copy', 'Copier')}</button></div>`),
  );
}
async function copySummary() {
  const box = $('#sumbox');
  const txt = V.sumTxt || (box && box.value) || '';
  try {
    await navigator.clipboard.writeText(txt);
    toast(L('Copied.', 'Copié.'));
  } catch (e) {
    if (box) {
      box.focus();
      box.select();
    }
    toast(L('Select the text and copy it.', 'Sélectionne le texte et copie-le.'));
  }
}
async function showNoteMC() {
  const p = await Store.prefs();
  V.noteVal = p.note || '';
  openModal(
    () =>
      head(L('A note for MC', 'Un mot pour MC'), '') +
      (`<p class="small muted">` +
        L(
          'MC knows someone is holding the pen. Write one short line. In your next run, MC will find it on the first page.',
          "MC sait que quelqu'un tient le stylo. Écris une courte ligne. Dans ta prochaine partie, MC la trouvera sur la première page.",
        ) +
        `</p>` +
        `<textarea id="notebox" class="notebox" rows="3" maxlength="120"` +
        (` placeholder="` +
          ea(
            L(
              'For example: I will try to be gentler with you.',
              "Par exemple : j'essaierai d'être plus doux avec toi.",
            ),
          ) +
          `">`) +
        `${ea(V.noteVal)}</textarea><div class="row" style="margin-top:10px">` +
        `<button class="btn primary" data-act="savenote">${L('Leave the note', 'Laisser le mot')}</button>` +
        (V.noteVal ? `<button class="btn" data-act="clearnote">${L('Remove it', "L'enlever")}</button>` : '') +
        `</div>`),
  );
}
async function saveNote(clear) {
  const box = $('#notebox');
  const v = clear
    ? ''
    : ((box && box.value) || '')
        .replace(/[<>&"]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
  const p = await Store.prefs();
  Store.prefs(Object.assign({}, p, { note: v }));
  V.noteVal = v;
  toast(
    v
      ? L('The note is waiting on the first page.', 'Le mot attend sur la première page.')
      : L('Note removed.', 'Mot retiré.'),
  );
  closeModal();
  if (S) render();
}
/* ---------- settings & help ---------- */
function showSettings() {
  openModal(() => {
    const fs = ['Normal', 'Large', 'Extra large']
      .map(
        (n, i) =>
          `<button class="btn ${PREF.fs === i ? 'primary' : ''}" data-act="fs" data-v="${i}" aria-pressed="${PREF.fs === i}">${t(n)}` +
          `</button>`,
      )
      .join('');
    const sw = (act, on) =>
      `<button class="btn ${on ? 'primary' : ''}" data-act="${act}" aria-pressed="${on}">${on ? t('On') : t('Off')}` +
      `</button>`;
    return (
      head(t('Settings'), '') +
      (`<div class="card"><h3>${t('Text size')}</h3><div class="row">${fs}</div></div>\n       ` +
        `<div class="card"><h3>${t('Reduced motion')}</h3><div class="row">${sw('rm', RM_ON())}</div>` +
        `<p class="small muted" style="margin:8px 0 0">` +
        L(
          'Turns off animations, including the journal page turns.',
          'Coupe les animations, dont le tournage des pages du journal.',
        ) +
        `</p></div>\n       <div class="card"><h3>${t('Sound')}</h3><div class="row">${sw('snd', PREF.snd)}` +
        `<input type="range" class="vol" data-vol="vs" min="0" max="100" value="${PREF.vs}" aria-label="${L('Volume', 'Volume')}">` +
        `</div><p class="small muted" style="margin:8px 0 0">` +
        L(
          'Soft sounds: taps, results, page turns, the Ball, endings.',
          'Petits sons doux : clics, résultats, pages, bal, fins.',
        ) +
        `</p></div>\n       <div class="card"><h3>${t('Music')}</h3><div class="row">${sw('mus', PREF.mus)}` +
        `<input type="range" class="vol" data-vol="vm" min="0" max="100" value="${PREF.vm}" aria-label="${L('Volume', 'Volume')}">` +
        `</div><p class="small muted" style="margin:8px 0 0">` +
        L(
          'Soft background music generated live by your browser: calm in class, brighter at the Ball and on holidays, darker when things go badly.',
          'Musique douce de fond, composée en direct par ton navigateur : calme en classe, plus vive au bal et aux congés, plus sombre quand ça va mal.',
        ) +
        `</p></div>\n       <div class="card"><h3>${t('Voice')}</h3><div class="row">` +
        (Voice.ok()
          ? sw('voice', PREF.voice) +
            `<input type="range" class="vol" data-vol="vv" min="0" max="100" value="${PREF.vv}" aria-label="${L('Volume', 'Volume')}">`
          : '') +
        `</div><p class="small muted" style="margin:8px 0 0">` +
        (Voice.ok()
          ? L(
              "A few scenes are read aloud (the Ball, big school moments, endings) using your browser's built-in voices. These are synthetic, not recordings.",
              'Quelques scènes sont lues à voix haute (bal, grands moments, fins) avec les voix de synthèse de ton navigateur. Ce ne sont pas des enregistrements.',
            )
          : L(
              'Read-aloud is not available in this browser.',
              "La lecture à voix haute n'est pas disponible dans ce navigateur.",
            )) +
        `</p></div>\n       <div class="card"><h3>${L('Faint text contrast', 'Contraste du texte pâle')}</h3>` +
        `<div class="row">${sw('ink', !!PREF.ink)}</div><p class="small muted" style="margin:8px 0 0">` +
        L(
          'Raises the contrast of very faint text and subtle details.',
          'Augmente le contraste des textes très pâles et des détails discrets.',
        ) +
        `</p><p class="small" style="margin:8px 0 0">${inkHtml('k2', CLUES().k2)}</p></div>\n       ` +
        `<div class="card"><h3>${L('Share feedback', 'Donner un avis')}</h3><div class="row">` +
        `<button class="btn" data-act="summary">${L('Copy run summary', 'Copier le résumé')}` +
        `</button>${noteMcBtn()}</div><p class="small muted" style="margin:8px 0 0">` +
        L(
          'A short text with your stats and progress, to paste in a message with your thoughts.',
          'Un court texte avec tes stats et ta progression, à coller dans un message avec ton avis.',
        ) +
        `</p></div>\n       <div class="card"><h3>${t('Keyboard')}</h3>` +
        `<p class="small muted" style="margin:0">` +
        L(
          'In an event: 1–6 or A–F to choose, Enter to continue, Esc to close. Journal: left and right arrows. With nothing open: 1–7 switch tabs.',
          "Dans un événement : 1–6 ou A–F pour choisir, Entrée pour continuer, Échap pour fermer. Journal : flèches gauche et droite. Sans fenêtre ouverte : 1–7 pour changer d'onglet.",
        ) +
        `</p></div>`)
    );
  });
}
function showHelp() {
  const en =
    `<div class="lines"><p><b>Goal.</b> Survive the school year (Aug 28 → Jun 23). If <b>POP` +
    `</b> reaches 0 the run ends immediately. Otherwise you get an ending based on your stats, relationships and remembered choices.` +
    `</p>\n  <p><b>Each day.</b> A school event with choices. Then 3 after-school <i>time blocks` +
    `</i> to talk with people, study, work, or shop. Press <i>End day` +
    `</i>` +
    ` when done; random events, personal events and birthdays can happen in the evening. Classmates and family may also surprise you: compliments, small gifts, invitations, or word that someone has been talking about you.` +
    `</p>\n  <p><b>Phone.` +
    `</b>` +
    ` The 📱 button opens your phone. Texting is free (no time block) but limited to 4 texts a day: chat, compliment, ask for help or advice, cheer someone up, apologise, borrow or lend a little money. Friends also text you first, sometimes with quick replies. Hanging out, studying, gifts and rumours still happen in person.` +
    `</p>\n  <p><b>Stats.` +
    `</b>` +
    ` POP (0–100), Money, Grade, and a relationship (−100…+100) with each of the 40 characters. Helping or hurting someone also moves their friends a little.` +
    `</p>\n  <p><b>Risks.` +
    `</b>` +
    ` Study checks depend on your Grade and prep. Cheating can get you caught. Rumors can reach their target, get disproven, and cost you popularity.` +
    `</p>\n  <p><b>Save.</b> Autosave runs every few seconds. Use Menu → Saved games for 3 manual slots.` +
    `</p>\n  ` +
    `<p class="muted small">Story text is in English; menus can be switched to French in the menu.</p>` +
    `</div>`;
  const fr =
    `<div class="lines"><p><b>But.</b> Survivre à l'année scolaire (28 août → 23 juin). Si la <b>POP` +
    `</b>` +
    ` tombe à 0, la partie est perdue immédiatement. Sinon, tu obtiens une fin selon tes statistiques, tes relations et tes choix mémorisés.` +
    `</p>\n  <p><b>Chaque jour.` +
    `</b>` +
    ` Un événement scolaire avec des choix, puis 3 blocs de temps après les cours : parler aux gens, étudier, travailler ou magasiner. Appuie sur ` +
    `<i>Finir la journée` +
    `</i>` +
    ` ; des événements aléatoires, personnels ou des anniversaires peuvent survenir le soir. Camarades et famille peuvent aussi te surprendre : compliments, petits cadeaux, invitations, ou rumeur que quelqu'un parle de toi dans ton dos.` +
    `</p>\n  <p><b>Téléphone.` +
    `</b>` +
    ` Le bouton 📱 ouvre ton téléphone. Les textos sont gratuits (aucun bloc de temps) mais limités à 4 par jour : discuter, faire un compliment, demander de l'aide ou un conseil, remonter le moral, s'excuser, emprunter ou prêter un peu d'argent. Tes amis t'écrivent aussi en premier, parfois avec des réponses rapides. Sortir, étudier, les cadeaux et les rumeurs se passent toujours en personne.` +
    `</p>\n  <p><b>Statistiques.` +
    `</b> POP (0–100), argent, note, et une relation (−100…+100) avec chacun des 40 personnages.</p>\n  ` +
    `<p class="muted small">` +
    `Tout le jeu (histoire, dialogues, journal) est disponible en français et en anglais ; change la langue depuis le menu.` +
    `</p></div>`;
  openModal(
    head(t('Help'), '') +
      L(en, fr) +
      (`<p class="small" style="margin:12px 0 0">${inkHtml('k1', CLUES().k1)}</p>` +
        `<div class="row" style="margin-top:12px">` +
        `<button class="btn" data-act="tutopen">${L('Replay the quick tour', 'Revoir la visite rapide')}` +
        `</button></div>`),
  );
}
