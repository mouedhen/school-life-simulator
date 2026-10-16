/* app/09_screens.js — Person profile, title / ending / game-over screens, saved games and endings book. */
'use strict';
/* ---------- person profile ---------- */
function showPerson(name) {
  V.person = name;
  V.sub = null;
  V.res = null;
  V.modal = () => personHtml(name);
  renderModal();
}
function stars(n) {
  return '●'.repeat(n) + '○'.repeat(5 - n);
}
function personHtml(name) {
  const c = CH[name];
  const v = S.rel[name];
  const lab = E.relLabel(v);
  if (V.res) {
    const r = V.res;
    return (
      head(name, `<span class="tag alt">${t(V.resTitle || 'Done')}</span>`) +
      (`<div class="lines">${(r.lines || []).map(lineHtml).join('')}` +
        (r.err ? `<p>${esc(r.err)}</p>` : '') +
        `</div>${chips(r.chips)}<div class="row" style="margin-top:14px">` +
        `<button class="btn primary" data-act="presback">${t('Continue')}</button></div>`)
    );
  }
  if (V.sub) return subHtml(name);
  const rum = E.rumorsFor(S, name);
  const gf = (S.giftFrom && S.giftFrom[name]) || [];
  const gfc = {};
  gf.forEach(x => {
    gfc[x] = (gfc[x] || 0) + 1;
  });
  const known = rum.filter(r => r.known);
  const list = E.interactionList(S, name);
  return (
    head(name, '') +
    (`<div class="avbig">${avatar(name, 76)}</div><div class="muted small" style="margin:-4px 0 10px">` +
      (c.role === 'kid' ? t('Classmates') : c.role === 'fam' ? t('Family') : t('Teachers')) +
      ` · ${t('Age')} ${c.a} · ${t('Birthday')}: ${esc(c.b)}</div>\n  ` +
      `<p style="margin:0 0 10px">${esc(c.pers)}</p>\n  <div class="card" style="padding:10px">` +
      `<div class="row" style="justify-content:space-between"><b>${t('Relationship')}</b>` +
      `<span class="pill ${lab}">${relT(lab)} · ${signed(v)}</span></div>${relBar(v)}\n  ` +
      `<div class="row" style="justify-content:space-between;margin-top:8px" >` +
      `<span class="small muted">${t('Approachability')} ${stars(c.ap)}</span>` +
      (c.pop != null ? `<span class="small muted">${t('Popularity')} ${c.pop}</span>` : '') +
      `</div></div>\n  ` +
      (gf.length
        ? `<p class="small muted" style="margin:0 0 10px">${L('They gave you', 'Cadeaux reçus de cette personne')}: ` +
          Object.keys(gfc)
            .map(k => esc(k) + (gfc[k] > 1 ? ' ×' + gfc[k] : ''))
            .join(', ') +
          `</p>`
        : '') +
      `\n  <div class="card" style="padding:10px"><b>${t('Rumors')}</b>` +
      (known.length
        ? known.map(r => `<p class="small" style="margin:6px 0 0">“${esc(r.t)}”</p>`).join('')
        : `<p class="small muted" style="margin:6px 0 0">` +
          L(
            'Nothing heard yet. Listen for rumors while talking.',
            "Rien d'entendu pour l'instant. Écoute des rumeurs en parlant.",
          ) +
          `</p>`) +
      `</div>\n  <div class="ib">` +
      (E.phoneList(S, name).length && !E.phoneOff(S)
        ? `<button class="btn small primary" data-act="phtext" data-v="${ea(name)}">📱 ${L('Text', 'Texter')}` +
          `<small>${phLeft()}/${E.PHONE_CAP}</small></button>`
        : '') +
      list
        .filter(i => E.phoneOff(S) || !E.PHONE_HIDE.has(i.id))
        .map(
          i =>
            `<button class="btn small ${i.ok ? '' : 'dis'}" data-act="inter" data-v="${i.id}" ${i.ok ? '' : `data-why="${ea(i.why)}"`}>` +
            `${esc(t(i.n))}<small>${i.cost ? i.cost + ' ' + t('block') : '—'}</small></button>`,
        )
        .join('') +
      `</div>`)
  );
}
function subHtml(name) {
  const s = V.sub;
  const c = CH[name];
  const back =
    `<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="subback">${t('Back')}` +
    `</button></div>`;
  const btn = (act, v, label, small) =>
    `<button class="btn" data-act="${act}" data-v="${ea(v)}">${esc(label)}` +
    (small ? `<small>${esc(small)}</small>` : '') +
    `</button>`;
  if (s.type === 'about') {
    if (!s.subject) {
      const names = Object.keys(CH).filter(n => n !== name && CH[n].role !== 'teach');
      return (
        head(name, `<span class="tag alt">${t('Talk about someone')}</span>`) +
        (`<p class="desc">` +
          L('Who do you want to talk about?', 'De qui veux-tu parler ?') +
          `</p><div class="ib">` +
          names
            .map(
              n =>
                `<button class="btn" data-act="aboutpick" data-v="${ea(n)}">${esc(n)}` +
                `<small>${relT(E.relLabel(S.rel[n]))} ${signed(S.rel[n])}</small></button>`,
            )
            .join('') +
          `</div>`) +
        back
      );
    }
    return (
      head(name, `<span class="tag alt">${t('Talk about someone')}</span>`) +
      (`<p class="desc">${L('What do you say about ', 'Que dis-tu sur ')}<b>${esc(s.subject)}</b>?</p>` +
        `<div class="choices">\n    <button class="choice" data-act="go" data-v="${ea(s.subject)}|bad">` +
        `<span class="l">−</span><span>` +
        L('Speak badly behind their back', 'Dire du mal dans son dos') +
        `<small>` +
        L('Risky: it can get back to them', 'Risqué : peut revenir à ses oreilles') +
        `</small></span></button>\n    <button class="choice" data-act="go" data-v="${ea(s.subject)}|good">` +
        `<span class="l">+</span><span>${L('Say good things about them', 'En dire du bien')}</span>` +
        `</button>\n    <button class="choice" data-act="go" data-v="${ea(s.subject)}|neutral">` +
        `<span class="l">·</span><span>${L('Just mention them', 'Le mentionner simplement')}</span></button>` +
        `</div>`) +
      back
    );
  }
  if (s.type === 'talk')
    return (
      head(name, `<span class="tag alt">${t('Topic')}</span>`) +
      (`<div class="ib">${btn('go', 'school', t('School'))}${btn('go', 'hobbies', t('Hobbies'))}${btn('go', 'daily', t('Daily life'))}` +
        `${btn('go', 'rumor', t('Listen for a rumor'))}</div>`) +
      back
    );
  if (s.type === 'gift')
    return (
      head(name, `<span class="tag alt">${t('Give a gift')}</span>`) +
      (`<div class="ib">` +
        E.giftItems(S)
          .map(it => btn('go', it.n, it.n, '×' + (S.inv[it.n] || 0)))
          .join('') +
        `</div>`) +
      back
    );
  if (s.type === 'hangout') {
    const boost = ['Movie ticket', 'Café drink', 'Fancy snack box', 'Concert ticket']
      .filter(k => S.inv[k] > 0)
      .concat(['Sports ball', 'Sketchbook'].filter(k => S.perm[k]));
    return (
      head(name, `<span class="tag alt">${t('Hang out')}</span>`) +
      `<div class="ib">${btn('go', '', t('No booster'))}${boost.map(k => btn('go', k, k)).join('')}</div>` +
      back
    );
  }
  if (s.type === 'lend')
    return (
      head(name, `<span class="tag alt">${t('Offer to lend money')}</span>`) +
      (`<div class="ib">` +
        [5, 10, 20]
          .map(a => `<button class="btn" data-act="go" data-v="${a}" ${S.money < a ? 'disabled' : ''}>$${a}</button>`)
          .join('') +
        `</div>`) +
      back
    );
  if (s.type === 'rumor')
    return (
      head(name, `<span class="tag alt">${s.id === 'share' ? t('Share a rumor') : t('Investigate a rumor')}</span>`) +
      (E.rumorsFor(S, name).filter(r => r.known).length
        ? `<div class="choices">` +
          E.rumorsFor(S, name)
            .filter(r => r.known)
            .map(
              r =>
                `<button class="choice" data-act="go" data-v="${r.i}">` +
                `<span class="l">${r.k === 'neg' ? '−' : r.k === 'pos' ? '+' : '·'}</span><span>${esc(r.t)}</span>` +
                `</button>`,
            )
            .join('') +
          `</div>`
        : `<p class="muted">` +
          L(
            'You have not heard any rumor about them yet. Talk to them first (topic: rumor).',
            "Tu n'as encore entendu aucune rumeur sur cette personne. Parle-lui d'abord (sujet : rumeur).",
          ) +
          `</p>`) +
      back
    );
  if (s.type === 'fight')
    return (
      head(name, `<span class="tag alt">${t('Fight / confrontation')}</span>`) +
      (`<div class="ib">` +
        btn('go', 'confront', L('Confront', 'Confronter'), '-rep / -trust') +
        btn('go', 'deescalate', L('De-escalate', 'Désamorcer'), L('safer', 'plus sûr')) +
        `</div>`) +
      back
    );
  if (s.type === 'apologize')
    return (
      head(name, `<span class="tag alt">${t('Apologize')}</span>`) +
      (`<div class="ib">` +
        btn(
          'go',
          'specific',
          L('Name exactly what I did', "Nommer précisément ce que j'ai fait"),
          L('works best', 'meilleur'),
        ) +
        `${btn('go', 'vague', L('A vague sorry', 'Excuses vagues'))}</div>`) +
      back
    );
  return '';
}

/* ---------- screens ---------- */
function loginScreen() {
  const me = Store.me || {};
  const nm = V.prefName || '';
  const av = me.avatarUrl
    ? `<img class="av" alt="" src="${ea(me.avatarUrl)}" ${me.color ? `style="border-color:${esc(me.color)}"` : ''}>`
    : '';
  const body = Store.cloud
    ? `<p class="muted" style="margin:0;max-width:44ch">` +
      L(
        'Signed in with your Claude account. Your games, your journal and the memory of your past runs follow you from device to device.',
        "Connecté avec ton compte Claude. Tes parties, ton journal et la mémoire de tes runs te suivent d'un appareil à l'autre.",
      ) +
      `</p>\n       <div class="row">` +
      `<button class="btn primary" data-act="enter">${L('Enter', 'Entrer')}${nm ? ' · ' + esc(nm) : ''}` +
      `</button></div>`
    : `<p class="muted" style="margin:0;max-width:44ch">` +
      L(
        'No account detected here. You can play as a guest: saves stay on this device. Open the game from your Claude account to sync them.',
        'Aucun compte détecté ici. Tu peux jouer en invité : les sauvegardes restent sur cet appareil. Ouvre le jeu depuis ton compte Claude pour les synchroniser.',
      ) +
      `</p>\n       <div class="row">` +
      `<button class="btn primary" data-act="enter">${L('Play as guest', 'Jouer en invité')}</button></div>`;
  return (
    `<div class="app"><div class="title-screen"><div class="brand">savepoint</div>${av}<h1>` +
    (nm
      ? L('Welcome back', 'Content de te revoir') + ',<br><span class="ink">' + esc(nm) + '</span>'
      : 'School Life<br><span class="ink">Simulator</span>') +
    `</h1>\n  <div class="card" style="display:flex;flex-direction:column;gap:12px"><b>` +
    (Store.cloud ? '☁ ' + L('Claude account', 'Compte Claude') : L('Guest', 'Invité')) +
    `</b>${body}</div>\n  <div class="row">${themeBtn('btn ghost small')}${langBtn('btn ghost small')}` +
    `</div></div></div>`
  );
}
function titleScreen() {
  const has = V.hasAuto;
  return (
    `<div class="app"><div class="title-screen"><div class="brand">savepoint` +
    (V.clues && V.clues.k0 ? '' : ' <i class="blot" data-reveal="k0" aria-hidden="true"></i>') +
    `</div>` +
    (V.clues && V.clues.k0 ? `<p class="small" style="margin:0">${inkHtml('k0', CLUES().k0)}</p>` : '') +
    `<h1>School Life<br><span class="ink">Simulator</span></h1>\n  ` +
    `<p class="muted" style="max-width:46ch;margin:0">` +
    L(
      'One school year. 194 days. Popularity, money, friendships, rumors. Do not hit zero.',
      'Une année scolaire. 194 jours. Popularité, argent, amitiés, rumeurs. Ne tombe pas à zéro.',
    ) +
    `</p>` +
    (clueN() >= 6 ? `<p class="small" style="margin:0">${inkHtml('k8', CLUES().k8)}</p>` : '') +
    `\n  <div class="row">` +
    (has ? `<button class="btn primary" data-act="continue">${t('Continue game')}</button>` : '') +
    `<button class="btn ${has ? '' : 'primary'}" data-act="start">${t('New game')}</button>` +
    `<button class="btn ghost" data-act="saves0">${t('Saved games')}</button>` +
    `<button class="btn ghost" data-act="endbook">${t('Endings')}</button></div>\n  <div class="row">` +
    `<button class="btn ghost small" data-act="settings">${t('Settings')}` +
    `</button>${themeBtn('btn ghost small')}${langBtn('btn ghost small')}` +
    `<button class="btn ghost small" data-act="help">${t('Help')}</button>` +
    `<button class="btn ghost small" data-act="stats">${L('Stats', 'Stats')}</button>` +
    `<button class="btn ghost small" data-act="mute" aria-pressed="${!!PREF.muted}">${PREF.muted ? '🔇' : '🔊'} ${L('Sound', 'Son')}` +
    `</button></div>\n  ` +
    (has ? `<p class="small muted" style="margin:0">${Store.cloud ? '☁ ' : ''}${esc(V.autoInfo || '')}</p>` : '') +
    `</div></div>`
  );
}
function overScreen() {
  const last = S.log.slice(-3).reverse().map(logRow).join('');
  return (
    `<div class="app"><div class="over"><div class="brand">${t('Game over')}</div><h1>` +
    L("You fell off everyone's radar.", 'Tu as disparu des radars.') +
    `</h1>` +
    `<p class="muted">${t('Your popularity hit zero.')} ${fmtDate(E.dayOf(S).d)} · ${t('Day')} ${S.di + 1}` +
    `</p>\n  <div class="row" style="justify-content:center">` +
    `<button class="btn" data-act="readj">📖 ${t('Journal')}</button>` +
    `<button class="btn primary" data-act="newgame2">${t('Play again')}</button>` +
    `<button class="btn" data-act="saves0">${t('Load')}</button></div></div></div>`
  );
}
const lineHtml = l => (/^[^:]{1,40}: “/.test(l) ? `<p class="say">${esc(l)}</p>` : `<p>${esc(l)}</p>`);
function endingScreen() {
  const en = E.ENDBY[S.ending.id];
  const x = E.stats(S);
  const epi = S.ending.epi.map(id => E.ENDBY[id]).filter(Boolean);
  const top = E.metKids(S)
    .slice()
    .sort((a, b) => S.rel[b] - S.rel[a])
    .slice(0, 4);
  return (
    `<div class="app"><div class="over" style="text-align:left">` +
    `<div class="brand">${t('Your ending')} · ${fmtDate(E.dayOf(S).d)}</div>` +
    `<h1 style="color:${en.bad ? 'var(--bad)' : 'var(--fg)'};margin:8px 0">${esc(en.n)}</h1>\n  ` +
    `<div class="end-quote">${esc(en.q)}</div>` +
    (en.body ? `<p>${esc(en.body)}</p>` : '') +
    `<p class="muted"><i>Moral: ${esc(en.moral)}</i></p><p class="small">${inkHtml('k7', CLUES().k7)}` +
    `</p>\n  ` +
    epi
      .map(
        e =>
          `<div class="card"><b>${esc(e.n)}</b><div class="end-quote" style="font-size:.95em">${esc(e.q)}</div>` +
          `<div class="small muted"><i>${esc(e.moral)}</i></div></div>`,
      )
      .join('') +
    `\n  <div class="card"><h3>${t('Final stats')}</h3>${statBoxes()}\n  ` +
    `<p class="small muted" style="margin:10px 0 0">` +
    top.map(n => esc(n.split(' ')[0]) + ' ' + signed(S.rel[n])).join(' · ') +
    `</p></div>\n  <div class="row"><button class="btn primary" data-act="newgame2">${t('Play again')}` +
    `</button><button class="btn" data-act="readj">📖 ${t('Journal')}</button>` +
    `<button class="btn" data-act="endbook">${t('Endings')}</button>` +
    `<button class="btn" data-act="summary">${L('Run summary', 'Résumé')}` +
    `</button>${noteMcBtn()}${listenBtn()}<button class="btn ghost" data-act="saves0">${t('Load')}` +
    `</button></div></div></div>`
  );
}

/* ---------- dialogs: saved games, endings book ---------- */
async function showSaves(fromTitle) {
  const m = await Store.metas();
  const row = (k, label) => {
    const x = m[k];
    return (
      `<div class="slot"><div><b>${label}</b><div class="small muted">` +
      (x
        ? `${fmtDate(x.date)} · POP ${x.pop} · $${x.money} · ${t('Grade')} ${x.grade}${x.over ? ' · ' + t('Game over') : ''}` +
          `${x.ending ? ' · ' + esc(E.ENDBY[x.ending].n) : ''}`
        : t('Empty slot')) +
      `</div></div><div class="row">` +
      (!fromTitle && k !== 'auto' && S && !S.over && S.phase !== 'ending'
        ? `<button class="btn small" data-act="saveto" data-v="${k}">${t('Save')}</button>`
        : '') +
      (x
        ? `<button class="btn small" data-act="loadfrom" data-v="${k}">${t('Load')}</button>` +
          `<button class="btn small ghost" data-act="delslot" data-v="${k}">✕</button>`
        : '') +
      `</div></div>`
    );
  };
  const acc = Store.cloud
    ? '☁ ' + L('Saved to your Claude account', 'Liées à ton compte Claude')
    : L('On this device only', 'Sur cet appareil');
  V.savesOpen = true;
  openModal(
    head(t('Saved games'), `<span class="tag alt">${acc}</span>`) +
      row('auto', t('Autosave')) +
      row('s1', 'Slot 1') +
      row('s2', 'Slot 2') +
      row('s3', 'Slot 3'),
  );
}
async function showEndBook() {
  const p = await Store.prefs();
  const seen = new Set((p.seen || []).concat(V.seen || []));
  const row = e => {
    const on = seen.has(e.id);
    return (
      `<div class="endrow"><span class="dot ${on ? 'on' : ''}"></span><div>` +
      `<b${on && e.bad ? ' style="color:var(--bad)"' : ''}>${on ? esc(e.n) : '???'}</b>` +
      `<div class="small muted">${on ? esc(e.q) : esc(e.hint)}</div>` +
      (on ? `<div class="small muted"><i>${esc(e.moral)}</i></div>` : '') +
      `</div></div>`
    );
  };
  const good = E.ENDINGS.filter(e => !e.bad),
    bad = E.ENDINGS.filter(e => e.bad);
  const n = l => l.filter(e => seen.has(e.id)).length;
  openModal(
    head(t('Endings'), '') +
      (`<p class="muted small">${seen.size}/${E.ENDINGS.length} ${t('unlocked')}</p>` +
        `<h3 style="margin:10px 0 0">${t('Good endings')} · ${n(good)}/${good.length}` +
        `</h3>${good.map(row).join('')}` +
        `<h3 style="margin:14px 0 0">${t('Hard endings')} · ${n(bad)}/${bad.length}` +
        `</h3>${bad.map(row).join('')}`),
  );
}
