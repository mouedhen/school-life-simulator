/* app/06_tabs.js — Avatars, the People, Shop, Work (kitchen, family, jobs), Calendar and Menu tabs. */
'use strict';
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
              `<div class="card" style="margin:0;padding:9px"><span class="ico">${itemIcon(k, 'perm')}` +
              `</span> <b>${esc(tr(k))}</b><div class="small muted">Permanent</div></div>`,
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
  const lvl = E.cookLevel(S),
    knife = !!S.perm['Cooking knife'];
  const rows = E.RECIPES.map(r => {
    const ok = E.recipeOk(S, r),
      price = E.cookPrice(S, r),
      can = ok && S.phase === 'free' && S.blocks >= 1 && S.money >= price;
    const hint = ok
      ? L('1 block · tastes ', '1 bloc · goût ') + '★'.repeat(r.q) + '☆'.repeat(5 - r.q)
      : L(
          'Mom teaches this when your relationship with her reaches ' +
            r.mom +
            (r.knife ? ', and you have her knife.' : '.'),
          "Maman te l'apprend quand ta relation avec elle atteint " +
            r.mom +
            (r.knife ? ', et que tu as son couteau.' : '.'),
        );
    return (
      `<div class="card item" style="margin:0"><div class="top"><span>${ok ? esc(tr(r.n)) : '🔒 ???'}` +
      `</span><span class="price">$${price}</span></div><div class="muted small">${hint}</div>` +
      `<div class="row">` +
      `<button class="btn small" data-act="cook" data-v="${r.id}" ${can ? '' : 'disabled'}>${L('Cook', 'Cuisiner')}` +
      `</button></div></div>`
    );
  }).join('');
  return (
    `<div class="card"><h3>${L('Kitchen', 'Cuisine')}</h3><p class="muted small">` +
    L(
      'Cook for yourself, your family or a friend. A good meal warms people up. Mom teaches you new recipes as your bond with her grows.',
      "Cuisine pour toi, ta famille ou un ami. Un bon repas rapproche les gens. Maman t'apprend de nouvelles recettes à mesure que votre lien grandit.",
    ) +
    `</p><p class="small" style="margin:0">${L('Cooking level', 'Niveau de cuisine')}: <b>${lvl}/5</b>` +
    (knife ? ' · 🔪 ' + L("Mom's cooking knife", 'Le couteau de cuisine de Maman') : '') +
    `</p></div><div class="grid2" style="grid-template-columns:1fr;margin-bottom:14px">${rows}</div>`
  );
}
function familyHtml() {
  const rows = ['Dad', 'Riley', 'Max', 'Oliver', 'Sophie']
    .map(n => {
      const B = E.BONDS[n],
        has = !!S.perm[B.item],
        n1 = B.acts.filter(a => E.bondOk(S, n, a)).length;
      return (
        `<div class="card item" style="margin:0"><div class="top"><span>${esc(n)}${has ? ' 🎁' : ''}</span>` +
        `<span class="price">${S.rel[n]}</span></div>` +
        `<div class="muted small">${relT(E.relLabel(S.rel[n]))} · ${n1}/5 ${L('activities', 'activités')}` +
        `${has ? ' · ' + esc(tr(B.item)) : ''}</div><div class="row">` +
        `<button class="btn small" data-act="bond" data-v="${ea(n)}" ${S.phase === 'free' ? '' : 'disabled'}>` +
        `${L('Spend time', 'Passer du temps')}</button></div></div>`
      );
    })
    .join('');
  return (
    `<div class="card"><h3>${L('Family time', 'En famille')}</h3><p class="muted small" style="margin:0">` +
    L(
      'Each family member has activities that open up as you grow closer. Reach 100 with someone and they may give you something special.',
      "Chaque membre de la famille a des activités qui s'ouvrent à mesure que vous vous rapprochez. À 100 avec quelqu'un, il pourrait te donner un objet spécial.",
    ) +
    (`</p><p class="small" style="margin:6px 0 0">${inkHtml('k6', CLUES().k6)}</p></div>` +
      `<div class="grid2" style="grid-template-columns:1fr;margin-bottom:14px">${rows}</div>`)
  );
}
function showBond(who) {
  const B = E.BONDS[who];
  if (!B) return;
  const rows = B.acts
    .map(a => {
      const ok = E.bondOk(S, who, a),
        can = ok && S.blocks >= 1 && S.money >= a.cost;
      const sub = ok
        ? `${a.cost ? '$' + a.cost + ' · ' : ''}${'★'.repeat(a.q)}${'☆'.repeat(5 - a.q)}`
        : a.item && S.rel[who] >= a.need
          ? L('Unlocks with their special gift.', 'Se débloque avec leur cadeau spécial.')
          : L('Unlocks at relationship ', 'Se débloque à la relation ') + a.need;
      return (
        `<button class="choice ${can ? '' : 'dis'}" data-act="bondfor"` +
        ` data-v="${ea(who + '|' + a.id)}" ${can ? '' : 'aria-disabled="true"'}><span class="lt">·</span>` +
        `<span>${ok ? esc(tr(a.n)) : '🔒 ???'} <span class="muted small">${sub}</span></span></button>`
      );
    })
    .join('');
  openModal(
    head(who, '') +
      (`<p class="desc">${L('Relationship', 'Relation')}: ${S.rel[who]} · ${relT(E.relLabel(S.rel[who]))}` +
        `</p><div class="choices">${rows}</div>`) +
      closeRow(),
  );
}
function showCook(rid) {
  const r = E.RECIPES.find(x => x.id === rid);
  if (!r) return;
  const friends = E.metKids(S)
    .slice()
    .filter(n => S.rel[n] >= 0)
    .sort((a, b) => S.rel[b] - S.rel[a])
    .slice(0, 8);
  const btn = (who, label, sub) =>
    `<button class="choice" data-act="cookfor" data-v="${ea(rid + '|' + who)}"><span class="lt">·</span>` +
    `<span>${label}` +
    (sub ? ` <span class="muted small">${sub}</span>` : '') +
    `</span></button>`;
  openModal(
    head(L('Cook ', 'Cuisiner ') + tr(r.n), '') +
      (`<p class="desc">${L('Who is it for?', 'Pour qui ?')}</p>` +
        `<div class="choices">${btn('self', L('Myself', 'Moi-même'), '')}${btn('family', L('The family', 'La famille'), '')}` +
        friends.map(n => btn(n, esc(n), relT(E.relLabel(S.rel[n])))).join('') +
        `</div>`) +
      closeRow(),
  );
}
function viewWork() {
  return (
    kitchenHtml() +
    familyHtml() +
    (`<div class="card"><h3>${t('Work')}</h3><p class="muted small">` +
      L('Earn money by spending after-school time blocks.', "Gagne de l'argent en échange de blocs de temps.") +
      `</p></div><div class="grid2" style="grid-template-columns:1fr">` +
      E.JOBS.map(j => {
        const can = S.phase === 'free' && S.blocks >= j.blocks && !(j.need && !(S.inv[j.need] > 0));
        return (
          `<div class="card item" style="margin:0"><div class="top"><span>${esc(j.n)}</span>` +
          `<span class="price">$${j.pay}</span></div>` +
          `<div class="muted small">${j.blocks} ${j.blocks > 1 ? t('blocks') : t('block')} · ${esc(j.note || '')}` +
          `${j.need ? ' · ' + t('Needs') + ' ' + esc(j.need) : ''}</div><div class="row">` +
          `<button class="btn small" data-act="work" data-v="${j.id}" ${can ? '' : 'disabled'}>${t('Do it')}` +
          `</button></div></div>`
        );
      }).join('') +
      `</div>`)
  );
}

/* ---------- Calendar tab ---------- */
const HOLI = {
  '2026-09-07': 'Labour Day',
  '2026-10-12': 'Thanksgiving',
  '2027-03-26': 'Good Friday',
  '2027-03-29': 'Easter Mon.',
  '2027-05-24': 'Victoria Day',
};
const EVTAG = {
  '2026-08-28': 'First day',
  '2026-10-23': 'Spirit day',
  '2026-10-30': 'Halloween',
  '2026-12-11': 'Concert',
  '2026-12-18': 'Winter party',
  '2027-01-04': 'Welcome back',
  '2027-02-12': 'Friendship',
  '2027-03-25': 'Spirit day',
  '2027-04-23': 'Earth Day',
  '2027-05-28': 'Final project',
  '2027-06-11': 'Finals',
  '2027-06-16': 'Ball plan',
  '2027-06-23': 'Last day',
};
const MONTHS = [
  [2026, 7],
  [2026, 8],
  [2026, 9],
  [2026, 10],
  [2026, 11],
  [2027, 0],
  [2027, 1],
  [2027, 2],
  [2027, 3],
  [2027, 4],
  [2027, 5],
];
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MNF = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
function viewCal() {
  const [y, m] = MONTHS[V.calM];
  const cur = E.dayOf(S).d;
  const first = new Date(Date.UTC(y, m, 1));
  const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const tabs = MONTHS.map(
    (mm, i) =>
      `<button class="${i === V.calM ? 'on' : ''}" data-act="calm" data-v="${i}">${MN[mm[1]].toUpperCase()}` +
      `</button>`,
  ).join('');
  let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<div class="wd">${x}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div></div>';
  const sched = {};
  DAYS.forEach(d => (sched[d.d] = d));
  for (let d = 1; d <= n; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const wd = new Date(iso + 'T12:00:00Z').getUTCDay();
    const wk = wd === 0 || wd === 6;
    const sd = sched[iso];
    let cls = 'cell';
    let tag = '';
    let extra = '';
    const sk = E.D.days && Object.keys(E.SPECIAL).find(k => E.SPECIAL[k].date === iso);
    if (HOLI[iso]) {
      cls += ' hol';
      tag = HOLI[iso];
    } else if (!sd || wk) {
      cls += ' off';
    }
    if (iso >= '2026-12-21' && iso <= '2027-01-01' && !wk) {
      cls += ' hol';
      tag = tag || 'Break';
    }
    if (iso >= '2027-03-01' && iso <= '2027-03-05') {
      cls += ' hol';
      tag = 'Spring break';
    }
    if (EVTAG[iso]) tag = EVTAG[iso];
    if (sk && iso !== '2027-03-01') tag = `<span class="pd">Pédago</span>`;
    if (iso === '2027-03-01') tag = `<span class="pd">Pédago</span>`;
    if (iso === cur) cls += ' today';
    const passed = iso < cur;
    if (passed) extra += `<svg class="x" viewBox="0 0 40 40"><path d="M6 7 L34 33 M34 7 L6 34"/></svg>`;
    if (iso === E.BALL_DAY)
      extra += `<svg class="ring" viewBox="0 0 40 40"><ellipse cx="20" cy="20" rx="17" ry="15"/></svg>`;
    cells += `<div class="${cls}">${d}${tag ? `<div class="tg">${tag}</div>` : ''}${extra}</div>`;
  }
  const title =
    LANG === 'fr'
      ? `${MNF[m]} ${y}`
      : `${new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
  return (
    `<div class="cal-tabs">${tabs}</div><div class="card"><h3 style="margin-bottom:10px">${esc(title)}` +
    `</h3><p class="small" style="margin:-4px 0 8px">${inkHtml('k5', CLUES().k5)}</p>` +
    `<div class="cal">${cells}</div><div class="legend"><span>✕ ${t('Crossed days')}</span><span>` +
    `<span class="pd" style="background:#3b6fd4;color:#fff;border-radius:3px;padding:0 4px;font-size:11px">${t('Pédago')}` +
    `</span></span><span>◯ ${t('The Ball')}</span><span>▒ ${t('Holiday')}</span></div></div>`
  );
}

/* ---------- Menu tab ---------- */
function viewMenu() {
  return (
    `<div class="card"><h3>${t('Menu')}</h3><div class="row" style="margin-top:8px">` +
    `<button class="btn" data-act="saves">${t('Saved games')}</button>` +
    `<button class="btn" data-act="endbook">${t('Endings')}</button>` +
    `<button class="btn" data-act="summary">${L('Run summary', 'Résumé')}</button>${noteMcBtn()}` +
    `<button class="btn" data-act="stats">${L('Stats', 'Statistiques')}</button>` +
    `<button class="btn" data-act="settings">${t('Settings')}</button>` +
    `<button class="btn" data-act="help">${t('Help')}</button></div>\n  ` +
    `<div class="row" style="margin-top:12px">${themeBtn('btn ghost')}${langBtn('btn ghost')}` +
    `<button class="btn ghost" data-act="newgame">${t('New game')}</button></div></div>\n  ` +
    `<div class="card"><h3>${t('Account')}</h3><p class="muted small" style="margin:0">` +
    (Store.cloud
      ? L(
          'Your saves are tied to your Claude account and follow you across devices.',
          "Tes sauvegardes sont liées à ton compte Claude et te suivent d'un appareil à l'autre.",
        )
      : L(
          'Not signed in here: saves stay in this browser only.',
          'Mode hors compte : les sauvegardes restent dans ce navigateur.',
        )) +
    (`${Store.cloudErr ? ' (cloud save failed once)' : ''}</p></div>\n  <div class="card">` +
      `<h3>${t('Final stats')}</h3>${statBoxes()}</div>`)
  );
}
