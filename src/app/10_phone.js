/* app/10_phone.js — The phone: contacts, minigames, chats and threads. */
'use strict';
/* ---------- phone ---------- */
/* button labels for one-to-one texting actions [EN, FR] */
const PHL = {
  chat_school: ['Chat about school', "Parler de l'école"],
  chat_hobbies: ['Chat about hobbies', 'Parler de loisirs'],
  chat_daily: ['Chat about daily life', 'Parler du quotidien'],
  chat_rumor: ['Ask what they heard', "Demander ce qu'ils ont entendu"],
  compliment: ['Send a compliment', 'Envoyer un compliment'],
  message: ['Say hi', 'Dire salut'],
  askhelp: ['Ask for help', "Demander de l'aide"],
  advice: ['Ask for advice', 'Demander conseil'],
  cheer: ['Cheer them up', 'Remonter le moral'],
  tease: ['Send a joke', 'Envoyer une blague'],
  askmoney: ['Ask to borrow money', "Demander de l'argent"],
  lend: ['Offer to lend $5', 'Proposer de prêter 5 $'],
  apologize: ['Say sorry', 'Présenter des excuses'],
  boundary: ['Set a boundary', 'Poser une limite'],
};
const unkOn = () => !!S && !S.over && S.di >= 3;
const unkNew = () => unkOn() && !(S.phone && S.phone.unkSeen);
const phUnread = () => {
  const un = (S && S.phone && S.phone.un) || {};
  return Object.values(un).reduce((a, b) => a + b, 0) + (unkNew() ? 1 : 0);
};
const phLeft = () => Math.max(0, E.PHONE_CAP - ((S.today && S.today.ph) || 0));
function phBadge() {
  const n = phUnread();
  return n ? `<span class="phbadge">${n}</span>` : '';
}

/* ---------- phone minigames ---------- */
const RF = [
  [
    ['I bombed the test. I studied all night.', "J'ai raté le test. J'ai étudié toute la nuit."],
    [
      ['That is rough. Want to talk about it?', "C'est dur. Tu veux en parler ?"],
      ['You should have studied more.', 'Tu aurais dû étudier plus.'],
      ['lol ok', 'mdr ok'],
    ],
    0,
  ],
  [
    ['Guess who got the lead in the school play!', 'Devine qui a décroché le rôle principal à la pièce !'],
    [
      ['Congratulations! You earned it.', "Félicitations ! Tu l'as mérité."],
      ['Cool.', 'Cool.'],
      ['They must have run out of people.', 'Ils ont dû manquer de monde.'],
    ],
    0,
  ],
  [
    ['I think I lost my best friend today.', "Je crois que j'ai perdu mon meilleur ami aujourd'hui."],
    [
      ['Drama again?', 'Encore du drame ?'],
      ['I am here. Do you want to call?', "Je suis là. Tu veux m'appeler ?"],
      ['That is life.', "C'est la vie."],
    ],
    1,
  ],
  [
    ['I made cookies and they look like rocks.', "J'ai fait des biscuits et ils ressemblent à des cailloux."],
    [
      ['Honestly, I will still eat one.', "Honnêtement, j'en mangerais un quand même."],
      ['Wow. Do not quit your day job.', 'Wow. Ne démissionne pas.'],
      ['Gross.', 'Beurk.'],
    ],
    0,
  ],
  [
    ['Can I sit with you at lunch tomorrow?', "Je peux m'asseoir avec toi demain midi ?"],
    [
      ['Sure. I will save you a seat.', 'Bien sûr. Je te garde une place.'],
      ['Ask someone else.', "Demande à quelqu'un d'autre."],
      ['We will see.', 'On verra.'],
    ],
    0,
  ],
  [
    ['I am nervous about my presentation.', 'Je suis nerveux pour mon exposé.'],
    [
      ['Just do not mess up.', "Ne rate pas ça, c'est tout."],
      ['You will do great. Want to practise on me?', "Tu vas assurer. Tu veux t'entraîner devant moi ?"],
      ['Everyone gets nervous. Whatever.', 'Tout le monde stresse. Peu importe.'],
    ],
    1,
  ],
  [
    ['Someone laughed at my drawing.', "Quelqu'un s'est moqué de mon dessin."],
    [
      ['It is just a drawing.', "C'est juste un dessin."],
      ['Their loss. I like it a lot.', "Tant pis pour eux. Je l'aime beaucoup."],
      ['Who cares.', "On s'en fiche."],
    ],
    1,
  ],
  [
    ['I forgot your birthday. I am so sorry.', "J'ai oublié ton anniversaire. Je suis vraiment désolé."],
    [
      ['It is fine. Thanks for saying it.', "Ce n'est pas grave. Merci de me le dire."],
      ['Wow. Unbelievable.', 'Wow. Incroyable.'],
      ['Whatever.', 'Peu importe.'],
    ],
    0,
  ],
  [
    ['Our team lost the game and everyone is blaming me.', "Notre équipe a perdu et tout le monde m'accuse."],
    [
      ['Maybe they are right.', 'Ils ont peut-être raison.'],
      ['That is unfair. It was a team loss.', "C'est injuste. C'était une défaite d'équipe."],
      ['Sports are dumb anyway.', "Le sport, c'est nul de toute façon."],
    ],
    1,
  ],
  [
    ['Do you want to hang out this weekend?', "Tu veux qu'on se voie ce week-end ?"],
    [
      ['Yes! What should we do?', 'Oui ! On fait quoi ?'],
      ['I will think about it.', "J'y réfléchis."],
      ['Maybe if nothing better comes up.', 'Peut-être si rien de mieux ne se présente.'],
    ],
    0,
  ],
];
const WV = {
  Maya: 'warm',
  Ethan: 'shy',
  Chloe: 'cool',
  Liam: 'playful',
  Amira: 'warm',
  Noah: 'blunt',
  Sophie: 'warm',
  Lucas: 'playful',
  Zara: 'cool',
  Oliver: 'shy',
  Emma: 'warm',
  Jayden: 'blunt',
  Isabella: 'cool',
  Gabriel: 'blunt',
  Aaliyah: 'warm',
  Felix: 'playful',
  Aria: 'warm',
  Sebastian: 'playful',
  Yuki: 'shy',
  Daniel: 'playful',
  Evelyn: 'cool',
  Adrian: 'blunt',
  Luna: 'shy',
  Nathaniel: 'shy',
  Kiara: 'blunt',
  Theo: 'shy',
  Naomi: 'warm',
  Vincent: 'cool',
  Freya: 'warm',
  Axel: 'playful',
};
const WS = {
  shy: [
    ['um... hi. sorry to bother you', 'euh... salut. désolé de te déranger'],
    ['no worries if you are busy...', 'pas grave si tu es occupé...'],
    ['i finished the drawing. if you want to see.', "j'ai fini le dessin. si tu veux voir."],
  ],
  blunt: [
    ['Where were you. Class started.', "T'étais où. Le cours a commencé."],
    ['That was a bad idea. Just saying.', "C'était une mauvaise idée. Je dis ça comme ça."],
    ['Fine. I will do it myself.', 'Bon. Je le ferai moi-même.'],
  ],
  warm: [
    ['Hiii! How are you?? 💛', 'Coucou ! Comment ça va ?? 💛'],
    ['Thinking of you! Hope your day is lovely!', 'Je pense à toi ! Belle journée !'],
    ['Aww thank you so much!!', 'Oh merci beaucoup !!'],
  ],
  cool: [
    ['Noted.', 'Noté.'],
    ['We will see.', 'On verra.'],
    ['I suppose that was acceptable.', "Je suppose que c'était acceptable."],
  ],
  playful: [
    ['guess who just found a frog 🐸', 'devine qui vient de trouver une grenouille 🐸'],
    ['bet you cannot beat my score lol', 'je parie que tu ne battras pas mon score mdr'],
    ['plot twist: I forgot my lunch AGAIN', "rebondissement : j'ai encore oublié mon dîner"],
  ],
};
const EM = [
  [
    '🍕🎬',
    ['Movie night with pizza', 'Soirée cinéma avec pizza'],
    [
      ['Pizza delivery gone wrong', 'Livraison de pizza ratée'],
      ['A very long film class', 'Un très long cours de cinéma'],
      ['A cooking show', 'Une émission de cuisine'],
    ],
  ],
  [
    '📚😴',
    ['Falling asleep while studying', "S'endormir en étudiant"],
    [
      ['A very quiet library', 'Une bibliothèque très calme'],
      ['Reading a bedtime story', 'Lire une histoire du soir'],
      ['Book sale', 'Vente de livres'],
    ],
  ],
  [
    '🌧️🥾',
    ['A muddy walk in the rain', 'Une marche boueuse sous la pluie'],
    [
      ['Buying new boots', 'Acheter des bottes neuves'],
      ['Cancelled picnic', 'Pique-nique annulé'],
      ['A swimming lesson', 'Un cours de natation'],
    ],
  ],
  [
    '🎂🎈',
    ['Birthday party', "Fête d'anniversaire"],
    [
      ['A bakery opening', "L'ouverture d'une boulangerie"],
      ['A balloon shop', 'Une boutique de ballons'],
      ['Cooking class', 'Cours de cuisine'],
    ],
  ],
  [
    '🚲💨',
    ['Biking really fast', 'Rouler très vite à vélo'],
    [
      ['Lost bicycle', 'Vélo perdu'],
      ['Windy day', 'Journée venteuse'],
      ['Bike repair', 'Réparation de vélo'],
    ],
  ],
  [
    '🎤🐱',
    ['A cat who sings', 'Un chat qui chante'],
    [
      ['Cat in a pet shop', 'Chat dans une animalerie'],
      ['A noisy neighbour', 'Un voisin bruyant'],
      ['A music teacher', 'Un prof de musique'],
    ],
  ],
  [
    '🧪💥',
    ['Science experiment gone wrong', 'Expérience de sciences ratée'],
    [
      ['Fireworks show', "Feu d'artifice"],
      ['A new potion shop', 'Une boutique de potions'],
      ['Chemistry homework', 'Devoir de chimie'],
    ],
  ],
  [
    '🏀🏆',
    ['Winning the basketball final', 'Gagner la finale de basket'],
    [
      ['Buying a trophy', 'Acheter un trophée'],
      ['Gym class', "Cours d'éducation physique"],
      ['A broken hoop', 'Un panier cassé'],
    ],
  ],
  [
    '🌙📱',
    ['Texting late at night', 'Envoyer des textos tard la nuit'],
    [
      ['A broken phone', 'Un téléphone cassé'],
      ['Moon photo', 'Photo de la lune'],
      ['A phone store', 'Un magasin de téléphones'],
    ],
  ],
  [
    '☕📝',
    ['Studying at a café', 'Étudier dans un café'],
    [
      ['A coffee spill', 'Du café renversé'],
      ['Taking an order', 'Prendre une commande'],
      ['A diary', 'Un journal intime'],
    ],
  ],
];
function pgSeed() {
  return (S.seed ^ (S.di * 2654435761)) >>> 0;
}
function pgRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pgShuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pgStop() {
  if (V.pgT) clearInterval(V.pgT);
  if (V.pgTO) clearTimeout(V.pgTO);
  V.pgT = V.pgTO = null;
}
const PGI = {
  reply: [
    '⚡',
    'Reply fast',
    'Réponds vite',
    'Pick the kindest reply before the timer ends. Good answers help a friendship.',
    'Choisis la réponse la plus gentille avant la fin du chrono. Les bonnes réponses aident une amitié.',
  ],
  who: [
    '🕵️',
    'Who texted?',
    'Qui a écrit ?',
    'Match each message to the classmate who would write it. A good eye helps in class.',
    "Associe chaque message au camarade qui l'écrirait. Un bon œil aide en classe.",
  ],
  emoji: [
    '🧩',
    'Emoji decoder',
    "Décodeur d'émojis",
    'Guess what the emoji mean. Small prizes.',
    'Devine ce que veulent dire les émojis. Petits prix.',
  ],
  tap: [
    '🫧',
    'Bubble tap',
    'Bulles',
    'Pop as many bubbles as you can in 15 seconds. Small prizes.',
    'Éclate un maximum de bulles en 15 secondes. Petits prix.',
  ],
};
function pgStart(id) {
  if (S.today['pg_' + id]) {
    toast(L('You already played that today.', "Tu as déjà joué à ça aujourd'hui."));
    return;
  }
  const off = E.phoneOff(S);
  if (off) {
    toast(off);
    return;
  }
  pgStop();
  const r = pgRng(pgSeed() + id.length * 97 + (S.pgN || 0));
  const g = { id, i: 0, score: 0, ans: null, done: false, res: null };
  if (id === 'reply') g.q = pgShuffle(RF, r).slice(0, 5);
  else if (id === 'who') {
    const kids = E.metKids(S).filter(n => WV[n.split(' ')[0]]);
    g.q = pgShuffle(kids, r)
      .slice(0, 5)
      .map(n => {
        const v = WV[n.split(' ')[0]];
        const others = pgShuffle(
          kids.filter(k => WV[k.split(' ')[0]] !== v),
          r,
        ).slice(0, 2);
        const line = WS[v][Math.floor(r() * 3)];
        return { line, right: n, opts: pgShuffle([n].concat(others), r) };
      });
  } else if (id === 'emoji')
    g.q = pgShuffle(EM, r)
      .slice(0, 5)
      .map(e => ({ e: e[0], right: e[1], opts: pgShuffle([e[1]].concat(e[2].slice(0, 3)), r) }));
  else if (id === 'tap') {
    g.left = 15;
  }
  V.pg = g;
  V.ph = { name: '@play' };
  renderModal();
  pgArm();
}
function pgArm() {
  const g = V.pg;
  if (!g || g.done) return;
  pgStop();
  if (g.id === 'reply') {
    g.t = 8;
    V.pgT = setInterval(() => {
      g.t -= 0.1;
      const bar = document.getElementById('pgbar');
      if (bar) bar.style.width = Math.max(0, (g.t / 8) * 100) + '%';
      if (g.t <= 0) {
        pgAnswer(-1);
      }
    }, 100);
  }
  if (g.id === 'tap') {
    g.t0 = Date.now();
    let sp = 0;
    V.pgT = setInterval(() => {
      const ar = document.getElementById('pgarena');
      const left = Math.max(0, 15 - (Date.now() - g.t0) / 1000);
      const tm = document.getElementById('pgtime');
      if (tm) tm.textContent = Math.ceil(left) + 's';
      if (left <= 0) {
        pgFinish();
        return;
      }
      if (!ar) return;
      sp++;
      const b = document.createElement('button');
      b.className = 'bubble';
      b.type = 'button';
      b.setAttribute('aria-label', L('Pop', 'Éclater'));
      const w = ar.clientWidth - 48,
        h = ar.clientHeight - 48;
      b.style.left = Math.floor(Math.random() * Math.max(10, w)) + 'px';
      b.style.top = Math.floor(Math.random() * Math.max(10, h)) + 'px';
      const pop = ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (b.dataset.p) return;
        b.dataset.p = 1;
        g.score++;
        b.classList.add('pop');
        const sc = document.getElementById('pgscore');
        if (sc) sc.textContent = g.score;
        setTimeout(() => b.remove(), 120);
        SFX.tap();
      };
      b.addEventListener('pointerdown', pop);
      b.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') pop(ev);
      });
      ar.appendChild(b);
      setTimeout(() => {
        if (b.parentNode && !b.dataset.p) b.remove();
      }, 1500);
    }, 600);
  }
}
function pgAnswer(k) {
  const g = V.pg;
  if (!g || g.done || g.ans != null) return;
  pgStop();
  const q = g.q[g.i];
  const right = g.id === 'reply' ? q[2] : q.opts.indexOf(q.right);
  g.ans = k;
  if (k === right) g.score++;
  renderModal();
  V.pgTO = setTimeout(() => {
    g.i++;
    g.ans = null;
    if (g.i >= g.q.length) pgFinish();
    else {
      renderModal();
      pgArm();
    }
  }, 900);
}
function pgFinish() {
  const g = V.pg;
  if (!g || g.done) return;
  pgStop();
  g.done = true;
  const max = g.id === 'tap' ? 20 : 5;
  g.res = E.phoneGame(S, g.id, Math.min(g.score, g.id === 'tap' ? 40 : 5), max);
  g.max = max;
  try {
    Store.autosave(S);
  } catch (e) {}
  render();
  renderModal();
}
function pgHtml() {
  const g = V.pg;
  if (!g) return '';
  const info = PGI[g.id];
  const ttl = L(info[1], info[2]);
  const back = `<button class="btn ghost small" data-act="phgames">← ${L('Games', 'Jeux')}</button>`;
  if (g.done) {
    const r = g.res || {};
    if (r.err) return head(ttl, '') + `<p>${esc(r.err)}</p>` + back;
    const perfect = g.id === 'emoji' && g.score >= 5;
    return (
      head(ttl, '') +
      (`<p class="desc" style="font-size:1.15em"><b>` +
        (g.id === 'tap' ? g.score + ' ' + L('bubbles', 'bulles') : g.score + ' / ' + g.max) +
        `</b></p><div class="lines">` +
        (r.lines || []).map(x => `<p>${esc(x)}</p>`).join('') +
        `</div>${chips(r.chips)}` +
        (perfect
          ? `<p class="small" style="margin-top:10px">` +
            inkHtml(
              'k11',
              L('Whoever picked these emoji was not MC.', "Celui qui a choisi ces émojis n'était pas MC."),
            ) +
            `</p>`
          : '') +
        `<div class="row" style="margin-top:12px">${back}</div>`)
    );
  }
  if (g.id === 'tap')
    return (
      head(ttl, '') +
      (`<div class="row" style="justify-content:space-between"><b>${L('Score', 'Score')}: ` +
        `<span id="pgscore">${g.score}</span></b><b id="pgtime">15s</b></div><div id="pgarena" class="arena">` +
        `</div><p class="small muted">${L('Tap or press the bubbles.', 'Touche les bulles.')}</p>`)
    );
  const q = g.q[g.i];
  const prog = `<div class="small muted">${g.i + 1} / ${g.q.length}</div>`;
  if (g.id === 'reply') {
    const right = q[2];
    return (
      head(ttl, '') +
      prog +
      (`<div class="phthread" style="max-height:none"><div class="bub them">${esc(LX(q[0]))}</div></div>` +
        `<div class="pgtimer">` +
        `<div id="pgbar" style="width:${g.ans != null ? 0 : Math.max(0, (g.t / 8) * 100)}%"></div></div>\n    ` +
        `<div class="choices">` +
        q[1]
          .map(
            (o, k) =>
              `<button class="choice ${g.ans != null ? (k === right ? 'good' : k === g.ans ? 'bad' : 'dis') : ''}" data-act="pgans" data-v="${k}` +
              `"><span class="l">${'ABC'[k]}</span><span>${esc(LX(o))}</span></button>`,
          )
          .join('') +
        `</div>`)
    );
  }
  if (g.id === 'who')
    return (
      head(ttl, '') +
      prog +
      (`<div class="phthread" style="max-height:none"><div class="bub them">${esc(LX(q.line))}</div></div>` +
        `<p class="small muted">${L('Who wrote this?', 'Qui a écrit ça ?')}</p><div class="choices">` +
        q.opts
          .map(
            (n, k) =>
              `<button class="choice ${g.ans != null ? (n === q.right ? 'good' : k === g.ans ? 'bad' : 'dis') : ''}" data-act="pgans"` +
              ` data-v="${k}"><span class="l">${avatar(n, 26)}</span><span>${esc(n)}</span></button>`,
          )
          .join('') +
        `</div>`)
    );
  return (
    head(ttl, '') +
    prog +
    (`<div class="emoji">${q.e}</div><div class="choices">` +
      q.opts
        .map(
          (n, k) =>
            `<button class="choice ${g.ans != null ? (n === q.right ? 'good' : k === g.ans ? 'bad' : 'dis') : ''}" data-act="pgans"` +
            ` data-v="${k}"><span class="l">${'ABCD'[k]}</span><span>${esc(LX(n))}</span></button>`,
        )
        .join('') +
      `</div>`)
  );
}
function gamesHtml() {
  const off = E.phoneOff(S);
  const card = id => {
    const i = PGI[id];
    const played = !!S.today['pg_' + id];
    const ready = S.di - (S.pgLast && S.pgLast[id] != null ? S.pgLast[id] : -99) >= E.PG_GAP[id];
    return (
      `<div class="card" style="margin:0 0 10px">` +
      `<div class="row" style="justify-content:space-between;align-items:center">` +
      `<b>${i[0]} ${L(i[1], i[2])}</b><span class="small muted">` +
      (played
        ? '✔ ' + L('played today', "joué aujourd'hui")
        : ready
          ? '★ ' + L('prize ready', 'prix prêt')
          : L('just for fun', 'pour le plaisir')) +
      `</span></div><p class="small muted" style="margin:6px 0 8px">${L(i[3], i[4])}</p>` +
      `<button class="btn small ${played || off ? 'dis' : 'primary'}" data-act="pgstart"` +
      (` data-v="${id}" ` +
        (played
          ? `data-why="${ea(L('You already played that today.', "Tu as déjà joué à ça aujourd'hui."))}"`
          : off
            ? `data-why="${ea(off)}"`
            : '') +
        `>`) +
      `${L('Play', 'Jouer')}</button></div>`
    );
  };
  return (
    head(L('Games', 'Jeux'), '') +
    (`${phBack()}<p class="small muted" style="margin:10px 0">` +
      L(
        'One round of each game per day. Prizes are small and come back every few days.',
        'Une partie de chaque jeu par jour. Les prix sont petits et reviennent tous les quelques jours.',
      ) +
      `</p>${['reply', 'who', 'emoji', 'tap'].map(card).join('')}`)
  );
}

/* ---------- phone: chats and threads ---------- */
/* group chat button labels [EN, FR] and group names [EN, FR, icon] */
const GCL = {
  g_hi: ['Post a friendly message', 'Poster un message sympa'],
  g_joke: ['Post a joke', 'Poster une blague'],
  g_notes: ['Ask if anyone has notes', "Demander si quelqu'un a des notes"],
  f_hi: ['Say hi to everyone', 'Dire bonjour à tout le monde'],
  f_photo: ['Share a photo from today', 'Partager une photo du jour'],
  f_help: ['Ask who can help with homework', 'Demander qui peut aider pour les devoirs'],
};
const GCN = {
  '#class': ['Class group chat', 'Groupe de la classe', '👥'],
  '#fam': ['Family chat', 'Discussion familiale', '🏠'],
};
/* pieces shared by the phone screens */
const phBack = () => `<button class="btn ghost small" data-act="phback">← ${L('Chats', 'Discussions')}</button>`;
const textsLeft = () => `${L('Texts left today', "Textos restants aujourd'hui")}: <b>${phLeft()}/${E.PHONE_CAP}</b>`;
const threadTop = () =>
  `<div class="row" style="justify-content:space-between;align-items:center">${phBack()}` +
  `<span class="small muted">${textsLeft()}</span></div>`;
// the bubbles of one thread; the last unanswered message gets its quick-reply buttons. senders: show who wrote (group chats)
function threadHtml(th, senders) {
  let lastQ = -1;
  th.forEach((m, i) => {
    if (m.q && !m.done) lastQ = i;
  });
  const bub = (m, i) => {
    if (m.f === 'sys')
      return m.t || (m.c && m.c.length)
        ? `<div class="bub sys">${m.t ? esc(m.t) : ''}${m.c && m.c.length ? chips(m.c, 1) : ''}</div>`
        : '';
    return (
      `<div class="bub ${m.f}">` +
      (senders && m.f === 'them' && m.s ? `<b class="snd">${esc(m.s)}</b>` : '') +
      `${esc(m.t)}</div>` +
      (i === lastQ
        ? `<div class="qr">` +
          m.q
            .map((q, k) => `<button class="btn small" data-act="phreply" data-v="${k}">${esc(q[0])}</button>`)
            .join('') +
          `</div>`
        : '')
    );
  };
  return th.map(bub).join('');
}
function groupHtml(key, offB) {
  const P = E.phoneOf(S);
  const th = P.th[key] || [];
  P.un[key] = 0;
  const acts = E.phoneGroupList(S, key);
  return (
    head(LX(GCN[key]), '') +
    offB +
    (`${threadTop()}\n  <div class="phthread" id="phthread">` +
      (th.length
        ? threadHtml(th, true)
        : `<p class="small muted" style="margin:6px 0">` +
          L('Quiet in here. Say something.', "C'est calme ici. Dis quelque chose.") +
          `</p>`) +
      `</div>\n  <div class="ib">` +
      acts
        .map(
          a =>
            `<button class="btn small ${a.ok ? '' : 'dis'}" data-act="phgact" data-v="${a.id}" ${a.ok ? '' : `data-why="${ea(a.why)}"`}>` +
            `${LX(GCL[a.id])}</button>`,
        )
        .join('') +
      `</div>`)
  );
}

function phoneHtml() {
  const P = E.phoneOf(S);
  const nm = V.ph && V.ph.name;
  const OFF = E.phoneOff(S);
  const offB = OFF
    ? `<div class="warn" style="margin:0 0 10px">📵 ${esc(OFF)} ` +
      esc(L('Talk to people in person today.', "Parle aux gens en personne aujourd'hui.")) +
      `</div>`
    : '';
  if (nm === '@games') return gamesHtml();
  if (nm === '@play') return pgHtml();
  if (nm === '#class' || nm === '#fam') return groupHtml(nm, offB);
  if (nm === '?') {
    P.unkSeen = 1;
    const bub = (c, x) => `<div class="bub them">${x}</div>`;
    return (
      head(L('Unknown number', 'Numéro inconnu'), '') +
      (`${phBack()}\n    <div class="phthread">` +
        bub('', esc(L('Hey. Can you see this?', 'Hé. Tu vois ça ?'))) +
        bub(
          '',
          inkHtml(
            'k9',
            L(
              'Move over the pale words. That is how I reach you.',
              "Passe sur les mots pâles. C'est ainsi que je te joins.",
            ),
          ),
        ) +
        bub(
          '',
          inkHtml(
            'k10',
            L(
              'MC has never typed a single reply. Only you have.',
              "MC n'a jamais tapé une seule réponse. Il n'y a que toi.",
            ),
          ),
        ) +
        `</div>\n    <p class="small muted" style="margin:8px 0 0">` +
        L('This number cannot receive replies.', 'Ce numéro ne peut pas recevoir de réponses.') +
        `</p>`)
    );
  }
  if (nm) {
    const th = P.th[nm] || [];
    P.un[nm] = 0;
    const acts = E.phoneList(S, nm);
    return (
      head(nm, '') +
      offB +
      (`${threadTop()}\n    <div class="phthread" id="phthread">` +
        (th.length
          ? threadHtml(th, false)
          : `<p class="small muted" style="margin:6px 0">` +
            L('No messages yet. Say something.', "Aucun message pour l'instant. Dis quelque chose.") +
            `</p>`) +
        `</div>\n    <div class="ib">` +
        acts
          .map(
            a =>
              `<button class="btn small ${a.ok ? '' : 'dis'}" data-act="phact" data-v="${a.id}" ${a.ok ? '' : `data-why="${ea(a.why)}"`}>` +
              `${LX(PHL[a.id])}</button>`,
          )
          .join('') +
        `</div>\n    <div class="row" style="margin-top:10px">` +
        `<button class="btn ghost small" data-act="person" data-v="${ea(nm)}">${L('Open profile', 'Voir le profil')}` +
        `</button></div>`)
    );
  }
  const names = E.metOf(S, E.KIDS.concat(E.FAM));
  const act = names
    .filter(n => P.th[n] && P.th[n].length)
    .sort((a, b) => (P.un[b] || 0) - (P.un[a] || 0) || (P.last[b] || 0) - (P.last[a] || 0));
  const rest = names.filter(n => !act.includes(n));
  const prev = n => {
    const th = P.th[n] || [];
    const m = th[th.length - 1];
    if (!m) return '';
    const x = m.f === 'sys' ? m.t || '' : m.t;
    return (m.f === 'me' ? L('You: ', 'Toi : ') : '') + (x || '');
  };
  const row = n => {
    const u = P.un[n] || 0;
    return (
      `<button class="phrow" data-act="phopen" data-v="${ea(n)}">${avatar(n, 38)}<div class="pmid">` +
      `<div class="nm">${esc(n)}</div><div class="small muted phprev">${esc(prev(n))}</div></div>` +
      (u ? `<span class="phbadge">${u}</span>` : '') +
      `</button>`
    );
  };
  const unk = unkOn()
    ? `<button class="phrow" data-act="phopen" data-v="?"><span class="av unk">?</span><div class="pmid">` +
      `<div class="nm">${L('Unknown number', 'Numéro inconnu')}</div>` +
      `<div class="small muted phprev">${esc(L('Hey. Can you see this?', 'Hé. Tu vois ça ?'))}</div>` +
      `</div>${unkNew() ? '<span class="phbadge">1</span>' : ''}</button>`
    : '';
  const grow = key => {
    const th = P.th[key] || [];
    const m = th[th.length - 1];
    const u = P.un[key] || 0;
    const p = m ? (m.f === 'me' ? L('You: ', 'Toi : ') : m.s ? m.s + ': ' : '') + (m.t || '') : '';
    return (
      `<button class="phrow" data-act="phopen" data-v="${key}"><span class="av unk">${GCN[key][2]}</span>` +
      `<div class="pmid"><div class="nm">${esc(LX(GCN[key]))}</div>` +
      `<div class="small muted phprev">${esc(p)}</div></div>` +
      (u ? `<span class="phbadge">${u}</span>` : '') +
      `</button>`
    );
  };
  const gm =
    `<button class="phrow" data-act="phgames"><span class="av unk">🎮</span><div class="pmid">` +
    `<div class="nm">${L('Games', 'Jeux')}</div>` +
    `<div class="small muted phprev">${L('Four quick games', 'Quatre jeux rapides')}</div></div></button>`;
  return (
    head(L('Phone', 'Téléphone'), '') +
    offB +
    (`<p class="small muted" style="margin:-4px 0 8px">${textsLeft()} · ` +
      L(
        'In-person actions use time blocks; texts are free but limited.',
        'Les actions en personne utilisent des blocs de temps ; les textos sont gratuits mais limités.',
      ) +
      `</p>\n  ` +
      `<div class="card" style="padding:4px 12px">${unk}${S.di >= 1 ? grow('#class') + grow('#fam') : ''}${gm}${act.map(row).join('')}` +
      (act.length && rest.length
        ? `<div class="small muted" style="padding:8px 0 2px">${L('Contacts', 'Contacts')}</div>`
        : '') +
      `${rest.map(row).join('')}</div>`)
  );
}
function showPhone(name) {
  if (!S || S.over) return;
  V.ph = { name: name || null };
  V.person = null;
  V.sub = null;
  V.res = null;
  E.phoneOf(S).ping = null;
  V.modal = phoneHtml;
  renderModal();
  phScroll();
}
function phScroll() {
  const th = document.getElementById('phthread');
  if (th) th.scrollTop = th.scrollHeight;
}
function phDone(r) {
  if (r && r.err) {
    toast(r.err);
  }
  try {
    Store.autosave(S);
  } catch (e) {}
  render();
  phScroll();
}
