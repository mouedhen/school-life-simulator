/* app/05_journal.js — The handwritten journal: diary text, page layout (jFit), the book and page flips. */
'use strict';
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
    (`</span><span class="sub">savepoint</span><span class="strap"></span>` +
      `<span class="hint">${L('Tap to open', 'Touche pour ouvrir')}</span></button>`);
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
