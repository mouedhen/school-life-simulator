/* engine/06_events.js — buildEvent(): turns S.pend into an event for the UI, including personal evening scenes. */
'use strict';
/* ---------- building events ---------- */
// buildEvent(S) turns the pending event S.pend into what the UI shows:
//   { kind, title, desc, date?, ctx, choices: [{ l, x, fx, disabled?, why?, hint?, ... }], who: [{ role, names }] }
// It is called again by choose(), so it must give the same event for the same state.
const letter = i => 'ABCDEF'[i]; // choice letters A-F
// greys out a choice the player cannot pay for
function needMoney(S, o, need) {
  if (need > S.money) {
    o.disabled = true;
    o.why = 'Needs $' + need;
  }
}
// a day context where `who` is the Target (T) of the event
function ctxFor(S, key, who) {
  const ctx = makeCtx(S, key, '');
  ctx.T = who;
  return ctx;
}
// the "who is involved" list of an event, from the roles its effects mention
function describeRoles(S, ctx, fxList) {
  const seen = {};
  const out = [];
  fxList.forEach(f => {
    if (f.t === 'rel' || f.who) {
      const k = roleKey(f.who);
      if (['TOP', 'MAYA', 'RIVAL'].includes(k) || seen[k]) return;
      seen[k] = 1;
      out.push({ role: ROLELABEL[k] || k, names: resolve(S, ctx, f.who) });
    }
  });
  return out;
}
// every effect a choice can have, whatever the outcome
function allFx(c) { return [].concat(c.fx || [], c.pass || [], c.fail || [], c.ok || [], c.win || [], c.lose || []); }
function buildEvent(S) {
  const p = S.pend;
  if (!p) return null;
  switch (p.kind) {
    case 'day': return buildDay(S);
    case 'special': return buildSpecial(S, p);
    case 'holiday': return buildHoliday(S, p);
    case 'rand': return buildRand(S, p);
    case 'ballinvite': return buildBallInvite(S);
    case 'ball': {
      const ev = ballScene(S, p.st || 0);
      ev.choices.forEach(c => {
        const w = c.dis || c.req; // why the choice is not possible
        if (w) {
          c.disabled = true;
          c.why = w;
        }
      });
      return ev;
    }
    case 'personal': return personalEvent(S, p, ctxFor(S, 'pe' + S.di + p.who, p.who));
    case 'npc': return npcEvent(S, p, ctxFor(S, 'npc' + S.di + p.who, p.who));
    case 'notice': return noticeEvent(S, p, ctxFor(S, 'nt' + S.di + p.who, p.who));
    case 'birthday': return buildBirthday(S, p);
  }
  return null;
}
// the school day's main event (from data.js); may introduce a new classmate and a teacher
function buildDay(S) {
  const d = dayOf(S);
  introCheck(S, d);
  const ctx = makeCtx(S, 'd' + S.di, d.t);
  const choices = d.c.map((c, i) => decorate(S, c, ctx, i));
  const fxAll = [].concat(...d.c.map(allFx));
  const met = [];
  if (S.introDay === S.di && S.introWho) {
    if (meet(S, S.introWho)) logAdd(S, 'Met ' + S.introWho, [], 'sys');
    met.push(S.introWho);
  }
  if (ctx.teacher && S.met) {
    if (meet(S, ctx.teacher)) logAdd(S, 'Met ' + ctx.teacher, [], 'sys');
  }
  return { kind: 'day', title: d.t, desc: d.s, date: d.d, ctx, choices, who: describeRoles(S, ctx, fxAll), teacher: ctx.teacher, met };
}
function buildSpecial(S, p) {
  const sp = SPECIAL[p.id];
  // day 2 of the tribunal reuses day 1's cast and target
  const ctx = makeCtx(S, 'sp' + (p.id === 'tribunal2' ? 'tribunal' : p.id), '');
  if (p.id === 'tribunal2') ctx.T = (S.tribT || ctx.T);
  if (p.id === 'tribunal') S.tribT = ctx.T;
  const choices = sp.c.map((c, i) => {
    const o = { l: letter(i), x: c[0], fx: fxs(c[1]), special: true };
    if (c[4]) o.say = c[4];
    if (c[2] && !F(S, c[2])) o.hide = true;
    if (c[3] === 'FRIEND' && S.rel[ctx.T] < 20) {
      o.disabled = true;
      o.why = 'Needs Friend (+20) with ' + ctx.T;
    }
    if (c[3] === 'M4' && S.money < 4) {
      o.disabled = true;
      o.why = 'Not enough money';
    }
    return o;
  }).filter(o => !o.hide);
  return {
    kind: 'special', title: sp.t, desc: sp.d, date: sp.date === 'meta' ? dayOf(S).d : sp.date, ctx, choices,
    who: p.id === 'reveal' ? [] : [{ role: 'Involved', names: [ctx.T] }],
    pedago: p.id !== 'showcase' && p.id !== 'reveal', // the pedagogical events
  };
}
function buildHoliday(S, p) {
  const h = HOLIDAYS[p.id];
  const ctx = makeCtx(S, 'hol' + p.id, '');
  const choices = h.c.map((c, i) => {
    const o = { l: letter(i), x: c[0], fx: fxs(c[1]) };
    needMoney(S, o, cost(o.fx));
    return o;
  });
  const giftScene = GIFTS.some(g => g[0] === p.id);
  return {
    kind: 'holiday', id: p.id, title: h.t, desc: h.d, date: h.date || dayOf(S).d, ctx, choices,
    who: giftScene ? [] : [{ role: 'Involved', names: [ctx.T] }],
  };
}
function buildRand(S, p) {
  const e = RAND[p.i];
  const ctx = makeCtx(S, 'r' + S.di + ':' + p.i, '');
  const choices = e.c.map((c, i) => decorate(S, c, ctx, i));
  return { kind: 'rand', title: e.t, desc: e.d, ctx, choices, who: describeRoles(S, ctx, [].concat(...e.c.map(allFx))), rand: true };
}
// choices: your 5 best friends, 2 other classmates, or going alone
function buildBallInvite(S) {
  const ranked = knownRank(S, metKids(S)).slice(0, 5);
  const extra = metKids(S).filter(n => !ranked.includes(n));
  const r = mul(hash(S.seed + 'ballx' + S.ballTry));
  const more = shuffle(extra, r).slice(0, 2);
  const names = ranked.concat(more);
  const choices = names.map((n, i) => ({ l: 'ABCDEFG'[i], x: 'Invite ' + n, who: n, ballinvite: true, chance: ballChance(S, n) }));
  choices.push({ l: 'ABCDEFG'[names.length], x: 'Go alone (no invitation)', alone: true });
  const desc = 'The Sixth-Grade Last-Year Ball is on June 18. Who do you want to ask? A sincere invitation always helps a little, even when declined.'
    + (S.ballTry ? ' You can ask one more person.' : '');
  return { kind: 'ballinvite', title: 'Ball invitation', desc, ctx: makeCtx(S, 'ball', ''), choices, who: [] };
}
function buildBirthday(S, p) {
  const ch = p.who;
  const ctx = ctxFor(S, 'bd' + ch, ch);
  const gifts = giftItems(S);
  const choices = [{ l: 'A', x: 'Wish them a happy birthday', fx: fxs('r:T+2;f:REMEMBERED_BIRTHDAY') }];
  if (S.money >= 4) choices.push({ l: 'B', x: 'Buy a small card and gift ($4)', fx: fxs('m-4;r:T+5;f:GIFT_GIVEN') });
  if (gifts.length) choices.push({ l: 'C', x: 'Give them something from your bag', gift: true });
  choices.push({ l: 'D', x: 'Say nothing', fx: fxs(S.rel[ch] >= 20 ? 'r:T-2' : '') }); // a friend notices
  return {
    kind: 'birthday', title: ch + "'s birthday", desc: "It's " + ch + "'s birthday today (" + CH[ch].b + '). Do you do something?',
    ctx, choices, who: [{ role: 'Birthday', names: [ch] }],
  };
}
// adds the letter, the money check and hints to a choice from data.js / RAND
function decorate(S, c, ctx, i) {
  const o = Object.assign({}, c);
  o.l = c.l || letter(i);
  needMoney(S, o, cost(c.fx) + cost(c.ok) + cost(c.pass));
  if (/Attend with a close friend who accepted/.test(c.x || '') && !S.ballDate) {
    o.disabled = true;
    o.why = 'Nobody accepted your invitation';
  }
  if (/^Spend \$15 on an outfit/.test(c.x || '') && S.money < 15) {
    o.disabled = true;
    o.why = 'Needs $15';
  }
  if (c.sp === 'academic') o.hint = 'Study check ~' + acadChance(S) + '%';
  if (c.sp === 'cheat') o.hint = 'Risky: could be caught';
  if (c.sp === 'team') o.hint = 'Team game ~' + teamChance(S, ctx) + '% to win';
  return o;
}
// the study item used up by the next study check: [name, bonus %]
function prepItem(S) {
  if (S.inv['Study guide'] > 0) return ['Study guide', 20];
  if (S.inv['Notebook & pen set'] > 0) return ['Notebook & pen set', 10];
  return null;
}
// % chance to pass a study check: 35 + grade / 2 + preparation, 5..95
function acadChance(S, extra) {
  const pi = prepItem(S);
  let prep = S.prep + (extra || 0) + (pi ? pi[1] : 0) + (S.perm['Calculator'] ? 5 : 0) + (S.luck ? 10 : 0);
  return clamp(Math.round(35 + S.grade / 2 + prep), 5, 95);
}
// quiz hints (0-3): one per 10% of preparation, +1 calculator, +1 Max's controller
function hintsFor(S) {
  const pi = prepItem(S);
  const fromPrep = Math.floor((S.prep + (pi ? pi[1] : 0)) / 10);
  return Math.min(3, fromPrep + (S.perm['Calculator'] ? 1 : 0) + (S.perm['Max\'s lucky controller'] ? 1 : 0));
}
// % chance to win a team game: POP, how much you like your teammates, items; 15..85
function teamChance(S, ctx) {
  const avg = ctx.TM.reduce((s, n) => s + S.rel[n], 0) / ctx.TM.length;
  const items = (S.perm['Sports ball'] ? 4 : 0) + (S.perm['Oliver\'s varsity jacket'] ? 4 : 0);
  return clamp(Math.round(40 + (S.pop - 50) / 5 + avg / 4 + items), 15, 85);
}
// % chance that n says yes to the Ball
function ballChance(S, n) {
  const rel = S.rel[n];
  if (rel >= 60 && !F(S, 'FALLOUT')) return 95;
  let c = clamp(60 + rel, 5, 95);
  if (rel < 0 && !F(S, 'BALL_REPAIR') && !F(S, 'APOLOGIZED_SPECIFIC')) c = Math.min(c, 15);
  return c;
}

/* ---------- personal events ---------- */
// One-on-one evening scenes. talk.js (TALK.personal) may provide a richer scene; otherwise a
// generic one by mood: 'friendly', 'tense', or anything else = 'enemy'.
function personalEvent(S, p, ctx) {
  const ch = p.who;
  const tk = globalThis.TALK && globalThis.TALK.personal(S, p, ctx, fxs);
  if (tk) return tk;
  const who = [{ role: 'With', names: [ch] }];
  if (p.mood === 'friendly') {
    const hobby = ['a poster', 'a short story', 'a science project', 'a playlist', 'a model craft', 'a comic', 'a dance routine', 'a recipe'];
    const what = hobby[hash(ch + S.di) % hobby.length];
    return {
      kind: 'personal', title: ch + ' asks for help',
      desc: ch + ' is working on ' + what + ' and asks if you can lend a hand. (Friendly event.)',
      ctx, who, choices: [
        { l: 'A', x: 'Help out for a while (uses 1 time block)', fx: fxs('r:T+6'), block: 1 },
        { l: 'B', x: 'Offer quick tips', fx: fxs('r:T+3') },
        { l: 'C', x: 'Say you are busy today', fx: fxs('r:T-1') },
      ],
    };
  }
  if (p.mood === 'tense') {
    return {
      kind: 'personal', title: 'A misunderstanding with ' + ch,
      desc: 'Something you said got twisted around, and ' + ch + ' is giving you the cold shoulder. (Tense event.)',
      ctx, who, choices: [
        { l: 'A', x: 'Clear things up calmly', fx: fxs('r:T+7;f:RECONCILE_TRIED') },
        { l: 'B', x: 'Ignore it and hope it passes', fx: fxs('r:T-2;f:AVOIDED_REPAIR') },
        { l: 'C', x: 'Tell them they are overreacting', fx: fxs('r:T-5;p-1?.3') },
        { l: 'D', x: 'Calmly refuse to take the blame for something you did not do', fx: fxs('r:T+2;f:REFUSED_BLAME') },
      ],
    };
  }
  return {
    kind: 'personal', title: ch + ' confronts you',
    desc: ch + ' blocks your path at your locker. The hallway goes quiet. (Enemy event.)',
    ctx, who, choices: [
      { l: 'A', x: 'De-escalate and apologize', fx: fxs('r:T+8;f:APOLOGIZED_SPECIFIC;f:RECONCILE_TRIED') },
      { l: 'B', x: 'Stand your ground', fx: fxs('r:T-4;p+1?.5') },
      { l: 'C', x: 'Walk away', fx: fxs('r:T-1;f:AVOIDED_REPAIR') },
      { l: 'D', x: 'Argue back loudly', fx: fxs('r:T-7;p-2?.6;f:PUBLIC_JAB') },
    ],
  };
}
