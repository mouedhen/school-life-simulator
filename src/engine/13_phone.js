/* engine/13_phone.js — Texting, incoming texts, group chats (#class, #fam), phone minigame rewards, rumour lookup for the UI. */
'use strict';
/* ---------- phone ---------- */
// Texting replaces most in-person small talk (PHONE_HIDE). A text runs interact() with S._ph = 1:
// no time block, gains x0.7, apologies -2. Conversations live in S.phone (phoneOf):
//   th[name or '#group'] = messages { f: 'me' | 'them' | 'sys', t: text, s?: sender, c?: chips,
//                          q?: quick replies [[label, effects]], done?: chosen reply + 1, T?: target }
//   un[key] = unread count, last[key] = day of the last message, ping = who wrote last
const PHONE_CAP = 4; // texts and group posts per day
// [phone action id, interaction id, arg for interact(), label]
const PHONE_ACTS = [
  ['chat_school', 'talk', 'school', 'Chat about school'],
  ['chat_hobbies', 'talk', 'hobbies', 'Chat about hobbies'],
  ['chat_daily', 'talk', 'daily', 'Chat about daily life'],
  ['chat_rumor', 'talk', 'rumor', 'Ask what they have heard'],
  ['compliment', 'compliment', null, 'Send a compliment'],
  ['message', 'message', null, 'Say hi'],
  ['askhelp', 'askhelp', null, 'Ask for help'],
  ['advice', 'advice', null, 'Ask for advice'],
  ['cheer', 'cheer', null, 'Cheer them up'],
  ['tease', 'tease', null, 'Send a joke'],
  ['askmoney', 'askmoney', null, 'Ask to borrow money'],
  ['lend', 'lend', 5, 'Offer to lend $5'],
  ['apologize', 'apologize', 'specific', 'Say sorry'],
  ['boundary', 'boundary', null, 'Set a boundary'],
];
// in-person options the People profile hides while the phone works
const PHONE_HIDE = new Set(['talk', 'compliment', 'message', 'askhelp', 'advice', 'cheer', 'tease', 'askmoney', 'lend', 'boundary']);
// what MC writes for each phone action (one picked by hash)
const PH_MC = {
  chat_school: ['How is school going for you this week?', 'Did you understand what we did in class today?', 'Is the homework as bad as it looks?'],
  chat_hobbies: ['What have you been into lately?', 'Tell me what you do for fun. I mean it.', 'Any new hobby I should know about?'],
  chat_daily: ['How was your day, really?', 'What did you have for lunch? Be honest.', 'Anything good happen today?'],
  chat_rumor: ['Have you heard anything interesting lately?', 'Anything going around that I should know about?', 'Hear any news today?'],
  compliment: ['I just wanted to say you are really good at what you do.', 'You made my day better earlier. Thanks.', 'You are kinder than you let people see.'],
  message: ['Hey, just checking in.', 'Hi! Thinking of you.', 'Hey. Hope your day is going okay.'],
  askhelp: ['Could you help me with something? I am a bit stuck.', 'Do you have a minute to help me study?', 'I could use a hand with something.'],
  advice: ['Can I ask your advice about something?', 'You always see things clearly. What would you do?', 'I am not sure what to do. Could you help me think?'],
  cheer: ['You seemed down. I am here if you want to talk.', 'Whatever today was, it does not define you.', 'Hey. You are not alone in this.'],
  tease: ['Okay but did you really think that would work?', 'I am not saying you are wrong. I am saying you are funny.', 'Nice try. Very bold. Very doomed.'],
  askmoney: ['Hey, could I borrow a few dollars? I will pay you back.', 'Any chance you could lend me some money until next week?', 'I am short on cash. Could you spot me?'],
  lend: ['If you need $5, I can lend it. No pressure.', 'I can help with $5 if it makes the week easier.', 'Want me to cover you with $5? You can pay me back later.'],
  apologize: ['I am sorry about what happened. I should have handled it better.', 'I have been thinking about it. I was wrong, and I am sorry.', 'I owe you an apology, and I mean it.'],
  boundary: ['I need to say something: I am not okay with how that went.', 'Can we agree to keep that off the table? It matters to me.', 'I want to be clear about what I can and cannot do.'],
};
const phoneOf = S => (S.phone = S.phone || { th: {}, un: {}, last: {} });
const OFF_WHY = ['You left your phone at home today.', 'Your battery died and there is no charger in sight.', 'Your phone is stuck on a software update.'];
const PHONE_OFF_EVERY = 12; // about one day in 12 (from day 2) the phone is off
// why the phone is off today, or null (fixed per seed and day)
function phoneOff(S) {
  if (S.di < 2) return null;
  const h = hash(S.seed + 'phoff' + S.di);
  return h % PHONE_OFF_EVERY === 0 ? OFF_WHY[(h >>> 4) % 3] : null;
}
const CAP_MSG = 'You have texted enough for today. Your battery needs a break.';
const ASK_WAIT_MSG = 'You asked someone for money recently. Wait a few days.';
const PHONE_ASK_GAP = 3; // days between two "Ask to borrow money" texts (to anyone)
const askedMoneyRecently = S => S.di - (S.phoneAsk == null ? -9 : S.phoneAsk) < PHONE_ASK_GAP;
const THREAD_MAX = 24; // messages kept per conversation
const threadOf = (P, key) => (P.th[key] = P.th[key] || []);
function trimThread(th) { while (th.length > THREAD_MAX) th.shift(); }
// the error to return when the phone is off today, or null
function phoneOffErr(S) {
  const off = phoneOff(S);
  return off ? { err: off } : null;
}
// you can text family and classmates you know (not teachers)
function phoneCan(S, name) {
  const c = CH[name];
  return !!c && c.role !== 'teach' && isMet(S, name);
}
// the phone actions for a person, with { ok, why } (built on interactionList in phone mode)
function phoneList(S, name) {
  if (!phoneCan(S, name)) return [];
  const off = phoneOff(S);
  if (off) return PHONE_ACTS.map(a => ({ id: a[0], n: a[3], ok: false, why: off }));
  const left = PHONE_CAP - (S.today.ph || 0);
  S._ph = 1;
  let il;
  try { il = interactionList(S, name); } finally { S._ph = 0; }
  return PHONE_ACTS.map(a => {
    const x = il.find(y => y.id === a[1]);
    let ok = !!(x && x.ok), why = x ? x.why : 'Not available.';
    if (a[1] === 'lend' && S.money < 5) { ok = false; why = 'You need at least $5.'; }
    if (ok && a[1] === 'askmoney' && askedMoneyRecently(S)) { ok = false; why = ASK_WAIT_MSG; }
    if (ok && left <= 0) { ok = false; why = CAP_MSG; }
    return { id: a[0], n: a[3], ok, why };
  });
}
// sends a text: runs the interaction, then writes MC's message, their reply (the quoted line
// from talk.js, "Name: “...”") and the rest as a system line into the thread
function phoneAct(S, name, pid) {
  const a = PHONE_ACTS.find(x => x[0] === pid);
  if (!a || !phoneCan(S, name)) return { err: 'Not available.' };
  if (S.phase !== 'free') return { err: 'Not now.' };
  const offErr = phoneOffErr(S);
  if (offErr) return offErr;
  if ((S.today.ph || 0) >= PHONE_CAP) return { err: CAP_MSG };
  if (a[1] === 'askmoney' && askedMoneyRecently(S)) return { err: ASK_WAIT_MSG };
  S._ph = 1;
  let r;
  try { r = interact(S, name, a[1], a[2]); } finally { S._ph = 0; }
  if (!r || r.err) return r;
  bump(S.today, 'ph');
  bump(S, 'phoneN');
  if (a[1] === 'askmoney') S.phoneAsk = S.di;
  const P = phoneOf(S);
  const th = threadOf(P, name);
  const T = PH_MC[pid];
  th.push({ f: 'me', t: T[hash(name + pid + S.di) % T.length] });
  const rest = [];
  let rep = null;
  (r.lines || []).forEach((ln, i) => {
    const m = i === 0 && /^[^:]+?(?: \([^)]*\))?: “([\s\S]*)”$/.exec(ln);
    if (m) rep = m[1];
    else rest.push(ln);
  });
  if (rep) th.push({ f: 'them', t: rep });
  if (rest.length || (r.chips && r.chips.length)) th.push({ f: 'sys', t: rest.join(' '), c: r.chips || [] });
  trimThread(th);
  P.last[name] = S.di;
  P.un[name] = 0;
  return r;
}
const TEXT_CHANCE = 0.5; // chance per evening that someone texts you (not on breaks)
// incoming texts: a contact writes to you, sometimes with quick replies (called by endDay)
function phoneIncoming(S) {
  const d = dayOf(S);
  if (phoneOff(S)) return null;
  try { phoneGroupIncoming(S); } catch (e) {}
  if (d.brk || rnd(S) > TEXT_CHANCE) return null;
  // who writes: weighted by friendship; people you are in conflict with write a bit more too
  const pool = KIDS.concat(FAM).filter(n => phoneCan(S, n));
  const w = pool.map(n => 1 + Math.max(0, S.rel[n]) / 20 + (S.rel[n] <= -10 ? 0.6 : 0));
  let tot = w.reduce((a, b) => a + b, 0), x = rnd(S) * tot, who = pool[0];
  for (let i = 0; i < pool.length; i++) {
    x -= w[i];
    if (x <= 0) {
      who = pool[i];
      break;
    }
  }
  const v = S.rel[who], fam = CH[who].role === 'fam', h = hash(who + S.di + 'ph');
  let t, q;
  if (v <= -10) { // a "cold" message: leaving it on read counts for the ph_read ending
    t = 'Can we talk about what happened? I would rather not leave it like this.';
    q = [['Sure, let us talk', 'r:T+4'], ['Not right now', 'r:T-2'], ['Leave it on read', 'r:T-3']];
  } else if (fam) {
    const K = [
      ['Do not forget to eat something. Love you.', [['Love you too', 'r:T+3'], ['Okay, okay', 'r:T+1']]],
      ['How was school? Tell me one good thing.', [['A good lunch, actually', 'r:T+3'], ['Tell you tonight', 'r:T+1'], ['Busy, sorry', 'r:T-1']]],
      ['Can you pick something up on the way home?', [['Sure, I will', 'r:T+3'], ['I cannot today', 'r:T-1']]],
    ];
    const k = K[h % K.length];
    t = k[0];
    q = k[1];
  } else {
    const K = [
      ['Hey, how was your day?', [['Pretty good, you?', 'r:T+3'], ['Tired, but fine', 'r:T+1'], ['Leave it on read', 'r:T-2']]],
      ['Did you get what the homework is for tomorrow?', [['Yes, sending it now', 'r:T+3'], ['No idea, sorry', 'r:T+0'], ['Check the board', 'r:T+1']]],
      ['You looked really confident today. Just saying.', [['Thank you, that helps', 'r:T+4'], ['Ha, I was faking it', 'r:T+2'], ['Send a thumbs up', 'r:T+1']]],
      ['Do you want to hang out this weekend? No big plan.', [['Yes, let us do it', 'r:T+5;f:NPC_INVITED'], ['Maybe another time', 'r:T-1']]],
    ];
    const k = K[(v >= 15 ? h : h % 3) % K.length]; // only friends (15+) invite you
    t = k[0];
    q = k[1];
  }
  const P = phoneOf(S);
  const th = threadOf(P, who);
  // the previous cold message was never answered: it was ignored
  const lq = th.filter(m => m.q).pop();
  if (lq && !lq.done && lq.cold) bump(S, 'phIgn');
  th.push({ f: 'them', t, q, id: S.di, cold: v <= -10 ? 1 : 0 });
  trimThread(th);
  bump(P.un, who);
  P.last[who] = S.di;
  P.ping = who;
  return who;
}
// answers the last unanswered message of a thread with quick reply number idx
function phoneReply(S, name, idx) {
  const th = phoneOf(S).th[name] || [];
  let m = null;
  for (let i = th.length - 1; i >= 0; i--) {
    if (th[i].q && !th[i].done) {
      m = th[i];
      break;
    }
  }
  if (!m || !m.q[idx]) return { err: 'Not available.' };
  const offErr = phoneOffErr(S);
  if (offErr) return offErr;
  m.done = idx + 1;
  const ch = [];
  const tg = m.T || name; // in group chats the message is about m.T
  const ctx = { T: tg, H: tg, C: tg };
  applyFx(S, fxs(m.q[idx][1]), ctx, ch);
  // counters for the phone endings
  const lb = m.q[idx][0];
  if (/^Defend /.test(lb)) bump(S, 'gcDef');
  if (lb === 'Laugh along') bump(S, 'gcLaugh');
  if (lb === 'Leave it on read') bump(S, 'phIgn');
  th.push({ f: 'me', t: m.q[idx][0] });
  if (ch.length) th.push({ f: 'sys', t: '', c: ch });
  phoneOf(S).un[name] = 0;
  return { chips: ch };
}

/* ---------- group chats ---------- */
const GROUPS = { '#class': { n: 'Class group chat', who: () => KIDS }, '#fam': { n: 'Family chat', who: () => FAM } };
// what you can post: [id, label]
const GC_ACTS = {
  '#class': [['g_hi', 'Post a friendly message'], ['g_joke', 'Post a joke'], ['g_notes', 'Ask if anyone has notes']],
  '#fam': [['f_hi', 'Say hi to everyone'], ['f_photo', 'Share a photo from today'], ['f_help', 'Ask who can help with homework']],
};
// what MC posts (one picked by hash)
const GC_SAY = {
  g_hi: ['Hey everyone, hope the day is going okay.', 'Good luck on the quiz tomorrow, everyone.', 'Anyone want to study together this week?'],
  g_joke: ['Why did the pencil go to therapy? Too many sharp comments.', 'I am not late. The bell was early.', 'My alarm and I are not on speaking terms.'],
  g_notes: ['Did anyone take notes in class today?', 'Does anyone have the notes from this week?', 'I missed a part of the lesson. Can someone help?'],
  f_hi: ['Hi, everyone. Hope your day is good.', 'Just saying hi. Love you all.', 'Hello, family.'],
  f_photo: ['Look what I found on my way home today.', 'A photo from my day. Enjoy.', 'This made me smile today.'],
  f_help: ['Can anyone help me with homework tonight?', 'Does anyone have a minute to help me study?', 'I am stuck on a problem. Help?'],
};
const GC_NICE = ['Aw, thanks!', 'Same to you.', 'Count me in.', 'You are sweet.', 'Ha, thanks for that.']; // classmates' answers
const GC_FAM = ['Hi, sweetheart.', 'Love you too.', 'Hello! How was school?', 'Hi! Eat something green.']; // family answers
// who reads a group: people you can text who do not dislike you too much
const gcMembers = (S, key) => GROUPS[key].who().filter(n => S.rel[n] > -15 && phoneCan(S, n));
function phoneGroupList(S, key) {
  const off = phoneOff(S);
  const left = PHONE_CAP - (S.today.ph || 0);
  return (GC_ACTS[key] || []).map(a => {
    let ok = true, why = '';
    if (off) { ok = false; why = off; }
    else if (left <= 0) { ok = false; why = CAP_MSG; }
    else if (S.today['gc_' + a[0]]) { ok = false; why = 'You already did that today.'; }
    return { id: a[0], n: a[1], ok, why };
  });
}
// posts in a group (each post once a day; counts toward PHONE_CAP)
function phoneGroupAct(S, key, id) {
  const a = (GC_ACTS[key] || []).find(x => x[0] === id);
  if (!a) return { err: 'Not available.' };
  if (S.phase !== 'free') return { err: 'Not now.' };
  const l = phoneGroupList(S, key).find(x => x.id === id);
  if (!l.ok) return { err: l.why };
  const P = phoneOf(S);
  const th = threadOf(P, key);
  const ch = [];
  const h = hash(S.seed + id + S.di);
  const mem = shuffle(gcMembers(S, key), mul(h)); // who answers, fixed per seed and day
  if (mem.length < 1) return { err: 'Nobody is around.' };
  const say = x => th.push({ f: 'me', t: x });
  const them = (n, t) => th.push({ f: 'them', s: n.split(' ')[0], t });
  const sys = t => th.push({ f: 'sys', t: t || '', c: ch });
  const T = GC_SAY[id];
  say(T[h % T.length]);
  if (id === 'g_hi') {
    mem.slice(0, 2).forEach((n, i) => {
      them(n, GC_NICE[(h + i) % GC_NICE.length]);
      addRel(S, n, 1, ch, false, true);
    });
    if (!S.today.gcPop && rnd(S) < 0.5) { // at most +1 POP a day from the class chat
      addPop(S, 1, ch);
      S.today.gcPop = 1;
    }
    sys();
  } else if (id === 'g_joke') {
    const r = rnd(S);
    if (r < 0.55) {
      them(mem[0], 'Okay, that was actually funny.');
      if (mem[1]) them(mem[1], 'Haha!');
      mem.slice(0, 2).forEach(n => addRel(S, n, 1, ch, false, true));
      if (!S.today.gcPop) {
        addPop(S, 1, ch);
        S.today.gcPop = 1;
      }
      sys();
    } else if (r < 0.85) sys('Nobody reacts. The chat moves on.');
    else {
      them(mem[0], 'Not funny.');
      addRel(S, mem[0], -2, ch, false, true);
      sys();
    }
  } else if (id === 'g_notes') {
    if (rnd(S) < 0.75) {
      them(mem[0], 'Sending you a photo of mine.');
      addRel(S, mem[0], 2, ch, false, true);
      S.prep = Math.min(30, S.prep + 6);
      setFlag(S, 'ASKED_FOR_HELP');
      sys('Next study check improved.');
    } else {
      them(mem[0], 'Sorry, I did not take any.');
      sys();
    }
  } else if (id === 'f_hi') {
    mem.slice(0, 2).forEach((n, i) => {
      them(n, GC_FAM[(h + i) % GC_FAM.length]);
      addRel(S, n, 1, ch, false, true);
    });
    sys();
  } else if (id === 'f_photo') {
    them(mem[0], 'Love it!');
    addRel(S, mem[0], 2, ch, false, true);
    sys();
  } else if (id === 'f_help') {
    them(mem[0], 'Come find me after dinner. I will help.');
    addRel(S, mem[0], 1, ch, false, true);
    S.prep = Math.min(30, S.prep + 5);
    sys('Next study check improved.');
  }
  bump(S.today, 'ph');
  bump(S, 'phoneN');
  bump(S, 'gcN');
  S.today['gc_' + id] = 1;
  P.last[key] = S.di;
  P.un[key] = 0;
  trimThread(th);
  logAdd(S, GROUPS[key].n + ' — ' + a[1], ch);
  return { chips: ch };
}
const GROUP_TEXT_CHANCE = 0.38; // chance per evening of a group message (1 in 4 from the family)
// an incoming group message with quick replies; T = who the replies are about
function phoneGroupIncoming(S) {
  if (rnd(S) > GROUP_TEXT_CHANCE) return;
  const P = phoneOf(S);
  const h = hash(S.seed + 'gc' + S.di);
  const fam = h % 4 === 0;
  const key = fam ? '#fam' : '#class';
  const mem = shuffle(gcMembers(S, key), mul(h));
  if (mem.length < 2) return;
  const th = threadOf(P, key);
  const a = mem[0], b = mem[1], fa = a.split(' ')[0], fb = b.split(' ')[0]; // a writes, sometimes about b
  let m;
  if (fam) {
    const K = [
      ['Dinner is at six. Who is home?', [['I will be there', 'r:T+2'], ['Running late', 'r:T+0'], ['Eat without me', 'r:T-2']]],
      ['Someone left the lights on again.', [['Sorry, that was me', 'r:T+1'], ['Not me!', 'r:T+0']]],
      ['Weekend plans? I need to know by tonight.', [['I am free', 'r:T+2'], ['Let me check', 'r:T+0']]],
    ];
    const k = K[h % K.length];
    m = { f: 'them', s: fa, t: k[0], q: k[1], T: a, id: S.di };
  } else if (h % 3 === 0) { // gossip about b: defend, laugh along, or stay out
    const neg = CH[b].rum.filter(r => r[0] === 'neg');
    const rm = neg.length ? neg[h % neg.length][1] : CH[b].rum[0][1];
    m = {
      f: 'them', s: fa, t: 'Did you see this? “' + rm + '”',
      q: [['Defend ' + fb, 'r:T+5;p-1'], ['Laugh along', 'p+1;r:T-4'], ['Stay out of it', 'r:T+0']],
      T: b, id: S.di,
    };
  } else if (h % 3 === 1) {
    m = {
      f: 'them', s: fa, t: 'Someone posted a photo of today’s cafeteria mystery meat.',
      q: [['Send a laughing emoji', 'r:T+1'], ['Ignore it', 'r:T+0']],
      T: a, id: S.di,
    };
  } else {
    m = {
      f: 'them', s: fa, t: 'Anyone coming to the library after school?',
      q: [['I am in', 'r:T+3'], ['Not today, sorry', 'r:T+0']],
      T: a, id: S.di,
    };
  }
  th.push(m);
  trimThread(th);
  bump(P.un, key);
  P.last[key] = S.di;
  P.ping = P.ping || key;
}

/* ---------- phone minigames ---------- */
// The games run in app.js; this gives the rewards. Each game once a day; a reward at most
// every PG_GAP[id] days. score / max: the player's result.
const PG_GAP = { reply: 1, who: 4, emoji: 6, tap: 6 };
function phoneGame(S, id, score, max) {
  if (!PG_GAP[id]) return { err: 'Not available.' };
  const offErr = phoneOffErr(S);
  if (offErr) return offErr;
  if (S.phase !== 'free') return { err: 'Not now.' };
  if (S.today['pg_' + id]) return { err: 'You already played that today.' };
  S.today['pg_' + id] = 1;
  S.pgLast = S.pgLast || {};
  bump(S, 'pgN');
  if (id === 'tap' ? score >= 18 : score >= max) bump(S, 'pgPerf'); // a perfect game
  const ch = [];
  const lines = [];
  const ready = S.di - (S.pgLast[id] == null ? -99 : S.pgLast[id]) >= PG_GAP[id];
  const good = score >= Math.ceil(max * 0.8), mid = score >= Math.ceil(max * 0.4);
  let paid = false;
  if (ready) {
    if (id === 'reply' && mid) {
      const who = shuffle(KIDS.concat(FAM).filter(n => isMet(S, n) && S.rel[n] >= -5), mul(hash(S.seed + 'pg' + S.di)))[0];
      if (who) {
        addRel(S, who, good ? 3 : 1, ch, false, true);
        paid = true;
        lines.push('Your replies landed well with ' + who.split(' ')[0] + '.');
      }
      if (score === max && S.di - (S.pgPop == null ? -99 : S.pgPop) >= 5) { // +1 POP at most every 5 days
        addPop(S, 1, ch);
        S.pgPop = S.di;
        paid = true;
      }
    } else if (id === 'who' && good) {
      addGrade(S, 1, ch);
      paid = true;
      lines.push('Paying attention to how people write helps you in class.');
    } else if (id === 'emoji' && good) {
      addMoney(S, score === max ? 3 : 2, ch);
      paid = true;
      lines.push('A small prize from the quiz app.');
    } else if (id === 'tap' && mid) {
      addMoney(S, good ? 2 : 1, ch);
      paid = true;
      lines.push('The game pays out a little.');
    }
    if (paid) S.pgLast[id] = S.di;
  }
  if (!paid) lines.push(score >= 1 ? 'Just for fun this time. Rewards come back after a few days.' : 'Better luck next time.');
  return { score, max, paid, chips: ch, lines };
}

/* ---------- rumour lookup ---------- */
// every rumour about a person, and whether you have heard it
function rumorsFor(S, name) {
  return CH[name].rum.map((r, i) => ({ i, t: r[1], k: r[0], known: (S.heard[name] || []).includes(i) }));
}
