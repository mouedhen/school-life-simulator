/* engine/07_choices.js — choose(): resolving a choice, the Ball invitation, the Ball night, what comes after an event. */
'use strict';
/* ---------- choosing ---------- */
// what every action returns: chips = visible changes ({ k: 'rel' | 'pop' | 'grade' | 'money' |
// 'flag' | 'gossip' | 'unlock' | 'ripple', ... }), lines = sentences to show
function result(chips, lines) { return { chips, lines: lines || [] }; }
const LOG_MAX = 400; // diary entries kept
function logAdd(S, text, chips, kind) {
  S.log.push({ d: dayOf(S).d, k: kind || 'ev', t: text, c: (chips || []).filter(c => c.k !== 'ripple').slice(0, 8) });
  if (S.log.length > LOG_MAX) S.log.splice(0, S.log.length - LOG_MAX);
}
// Resolves choice number idx of the pending event. extra: the gift item for a gift choice,
// or { mg: { q, label } } when the UI played a mini-game for a study check (q = score 0..1).
function choose(S, idx, extra) {
  const ev = buildEvent(S);
  if (!ev) return null;
  const c = ev.choices[idx];
  if (!c || c.disabled) return null;
  const ctx = ev.ctx;
  const ch = [];
  const lines = [];
  S.today.ev = 1;
  if (ev.kind === 'ballinvite') return chooseBall(S, c, ev);
  if (ev.kind === 'ball') return chooseBallScene(S, c, ev);
  if (c.block) S.blocks = Math.max(0, S.blocks - c.block); // block cost for personal helps
  if (c.gift && extra != null) return giveGift(S, ctx.T, extra, ev, true);
  if (c.say) lines.push(c.say);
  choiceExtras(S, ev, c, ctx, ch, lines);
  // c.ex: chance of being found out; then the g: 'ex' effects apply too
  const ex = c.ex != null ? (rnd(S) < c.ex) : false;
  if (c.ex != null) lines.push(ex ? 'You were found out!' : 'Nobody noticed.');
  if (c.sp === 'academic') studyCheck(S, c, ctx, ch, lines, ex, extra);
  else if (c.sp === 'cheat') cheatCheck(S, c, ctx, ch, lines);
  else if (c.sp === 'team') teamGame(S, c, ctx, ch, lines);
  else {
    applyFx(S, c.fx, ctx, ch, { exposed: ex });
    if (ex) S.caught++;
  }
  if (ev.kind === 'holiday') {
    setFlag(S, 'HOL_' + S.pend.id);
    const gi = GIFTS.find(g => g[0] === S.pend.id);
    if (gi) S.perm[gi[2]] = 1; // a family gift scene gives its item
  }
  if (ev.kind === 'rand') {
    S.lastRand = S.di;
    S.nrand++;
  }
  if (c.note && ev.kind === 'rand') lines.unshift(c.note);
  if (ev.pedago && ev.title.indexOf('Tribunal') >= 0 && S.pend.id === 'tribunal') S.tribT = ctx.T;
  const th = /^(day|rand|personal|npc|special|holiday|notice)$/.test(ev.kind) ? mcThought(S) : null;
  logAdd(S, ev.title + ' — ' + stripEnd(c.x), ch);
  finishEvent(S, ev);
  const res = result(ch, lines);
  if (th) res.thought = th;
  return res;
}
// the extra fields a choice can carry (NPC acts, personal events...); T is the event's target
function choiceExtras(S, ev, c, ctx, ch, lines) {
  if (c.get) { // an item you receive
    bump(S.inv, c.get);
    lines.push('Received: ' + c.get + '.');
  }
  if (c.get || c.gave) { // remembered for the profile
    S.giftFrom = S.giftFrom || {};
    (S.giftFrom[ctx.T] = S.giftFrom[ctx.T] || []).push(c.get || c.gave);
  }
  if (c.follow) (S.follow = S.follow || []).push({ who: ctx.T, act: c.follow, due: S.di + 3 }); // NPC scene in 3 days
  if (c.loan) {
    S.loans.push({ who: ctx.T, amt: c.loan, due: S.di + 7 });
    lines.push('They promise to pay you back soon.');
  }
  if (c.check) { // "ask a friend what really happened"
    if (rnd(S) < 0.6) {
      lines.push('Your friend says it was a misunderstanding.');
      addRel(S, ctx.T, 3, ch);
    } else {
      lines.push('Your friend admits other people heard it too.');
      addPop(S, -1, ch);
    }
  }
  if (c.secretDone) {
    S.secretDone = S.secretDone || {};
    S.secretDone[ctx.T] = 1;
  }
  if (ev.kind === 'personal') { // counters read by the endings
    const fl = (c.fx || []).filter(f => f.t === 'flag').map(f => f.f);
    if (fl.includes('RECONCILE_TRIED') || fl.includes('REFUSED_BLAME')) {
      S.recon = S.recon || {};
      bump(S.recon, ctx.T);
    }
    if (fl.includes('PUBLIC_JAB')) bump(S, 'retal');
    if (fl.includes('REFUSED_BLAME')) bump(S, 'boundaryN');
  }
  if (c.hurt) {
    S.hurt = S.hurt || {};
    bump(S.hurt, ctx.T);
  }
}
// sp: 'academic'. Uses up the study item and the preparation; a mini-game score replaces the dice.
function studyCheck(S, c, ctx, ch, lines, ex, extra) {
  const chance = acadChance(S);
  const pi = prepItem(S);
  if (pi) {
    S.inv[pi[0]]--;
    lines.push('Your ' + pi[0].toLowerCase() + ' helped.');
  }
  S.prep = 0;
  S.luck = 0;
  const mg = extra && extra.mg;
  let ok;
  if (mg) {
    ok = mg.q >= 0.6;
    lines.push('Mini-game: ' + mg.label + (ok ? ' - passed.' : ' - not enough.'));
  } else {
    ok = rnd(S) * 100 < chance;
    lines.push(ok ? 'Study check passed (' + chance + '%).' : 'Study check failed (' + chance + '%).');
  }
  if (mg && ok && mg.q >= 0.999) addGrade(S, 1, ch); // perfect mini-game bonus
  applyFx(S, c.fx, ctx, ch, { exposed: ex });
  applyFx(S, ok ? c.pass : c.fail, ctx, ch, { exposed: ex });
}
// sp: 'cheat'. Risk 25%, +20 if the teacher watches (25%), +15 if caught before, +10 if a
// classmate sees (30%), -10 for a subtle choice, -10 with the lucky charm; 5..95.
function cheatCheck(S, c, ctx, ch, lines) {
  let chance = 25;
  const mods = [];
  if (rnd(S) < 0.25) { chance += 20; mods.push('teacher watching +20'); }
  if (S.caught > 0) { chance += 15; mods.push('already warned +15'); }
  if (rnd(S) < 0.3) { chance += 10; mods.push('a classmate sees +10'); }
  if (/subtle|quiet|glance|careful/i.test(c.x || '')) { chance -= 10; mods.push('subtle -10'); }
  if (S.luck) { chance -= 10; mods.push('lucky charm -10'); S.luck = 0; }
  chance = clamp(chance, 5, 95);
  const caught = rnd(S) * 100 < chance;
  lines.push((caught ? 'Caught! ' : 'Got away with it. ') + '(' + chance + '% risk' + (mods.length ? ': ' + mods.join(', ') : '') + ')');
  applyFx(S, c.fx, ctx, ch);
  if (caught) {
    S.caught++;
    setFlag(S, 'CAUGHT_CHEATING');
    addGrade(S, -8, ch);
    addPop(S, -3, ch);
    addRel(S, ctx.teacher, -10, ch);
  } else applyFx(S, c.ok, ctx, ch);
}
// sp: 'team'
function teamGame(S, c, ctx, ch, lines) {
  const chance = teamChance(S, ctx);
  const win = rnd(S) * 100 < chance;
  lines.push(win ? 'Your team won! (' + chance + '%)' : 'Your team lost. (' + chance + '%)');
  applyFx(S, c.fx, ctx, ch);
  applyFx(S, win ? c.win : c.lose, ctx, ch);
}
const stripEnd = s => String(s || '').replace(/[.\s]+$/, ''); // drops the final period for the diary

/* ---------- ball invitation ---------- */
// Two tries at most; a yes, going alone, or a second no ends the invitations.
function chooseBall(S, c, ev) {
  const ch = [];
  const lines = [];
  S.ballTry++;
  if (c.alone) {
    setFlag(S, 'BALL_INVITED_DONE');
    lines.push('You decide to go on your own terms.');
    logAdd(S, 'Ball — going alone', []);
    S.ballDone = 1;
  } else {
    const n = c.who;
    const chance = ballChance(S, n);
    const ok = rnd(S) * 100 < chance;
    const rel = S.rel[n];
    addRel(S, n, 3, ch); // a sincere invitation always helps a little
    if (ok) {
      S.ballDate = n;
      setFlag(S, 'BALL_INVITED_DONE');
      S.ballDone = 1;
      addRel(S, n, rel >= 60 ? 5 : 2, ch);
      lines.push(n + ' said yes!');
      logAdd(S, 'Ball — ' + n + ' accepted your invitation', ch);
    } else {
      lines.push(n + ' politely declined.');
      logAdd(S, 'Ball — ' + n + ' declined', ch);
      if (S.ballTry >= 2) {
        setFlag(S, 'BALL_INVITED_DONE');
        S.ballDone = 1;
        lines.push('Maybe you will go alone, or with friends.');
      }
    }
  }
  if (S.ballDone || S.ballTry >= 2) {
    S.pend = { kind: 'day' };
    S.phase = 'event';
  } else {
    S.pend = { kind: 'ballinvite' };
    S.phase = 'event';
  }
  S.ballDone = 0;
  return result(ch, lines);
}

/* ---------- the Ball ---------- */
// A five-scene night (outfit, dance floor, rumour, photos, last dance) on BALL_DAY.
// Choice rows: [text, effects, extra fields]; extra fields handled by chooseBallScene:
//   dis / req: why the choice is disabled; dance / gossip / blame / hide: special outcomes;
//   appol: counts as an apology to that person.
const BALL_STAGES = 5;
function ballFoe(S) {
  const lo = lowestKid(S);
  return S.rel[lo] < -10 ? lo : null;
}
function ballFriend(S) { return S.ballDate || knownRank(S, metKids(S))[0]; }
function ballScene(S, st) {
  const ctx = makeCtx(S, 'ball' + st, '');
  const fr = ballFriend(S);
  const foe = ballFoe(S);
  ctx.T = st === 2 ? (foe || ctx.T) : ctx.T; // the rumour is about your foe if you have one
  const dateTxt = S.ballDate ? S.ballDate + ' is with you tonight.' : 'You came without a date.';
  const mk = (title, desc, rows, who) => ({
    kind: 'ball', st, title, desc, ctx, who: who || [],
    choices: rows.map((r, i) => Object.assign({ l: letter(i), x: r[0], fx: fxs(r[1] || '') }, r[2] || {})),
  });
  if (st === 0) {
    const lend = knownRank(S, metKids(S)).find(n => S.rel[n] >= 20);
    const desc = 'Ball night. The gym is full of paper lanterns and the smell of hairspray. Nobody should miss tonight over money, and everybody knows it. ' + dateTxt;
    return mk('The Ball — What to wear', desc, [
      ['Buy a new outfit or accessory ($15)', 'm-15;p+1;f:BALL_OUTFIT_BOUGHT', { dis: S.money < 15 ? 'Needs $15' : null }],
      ['Wear something you already own, and own it', 'f:BALL_OWN_OUTFIT'],
      lend ? ['Borrow an outfit from ' + lend, 'r:' + lend + '+3;f:BALL_BORROWED'] : ['Borrow something from your sibling or parent', 'f:BALL_BORROWED'],
      ['Take something from the free swap table the parents set up', 'f:BALL_SWAP_TABLE'],
      ['Skip the outfit: help decorate and set up instead', 'r:G+3;f:BALL_BACKSTAGE;f:BALL_SETUP_HELP'],
    ]);
  }
  if (st === 1) {
    const other = ctx.T === fr ? ctx.C : ctx.T;
    const desc = 'The music starts. Some people dance, some hover by the snack table, and a few stand at the edge pretending to read their phones. ' + dateTxt;
    return mk('The Ball — The dance floor', desc, [
      ['Ask ' + fr + ' to dance', '', { dance: fr }],
      ['Pull a shy classmate (' + other + ') into the group dance', 'r:' + other + '+6;p-1?.4;f:INCLUDED_SOMEONE;f:BALL_INCLUDED_ONE'],
      ['Request the song everybody knows and lead the floor', 'p+2;r:G+1;f:BALL_CROWD_PLEASER'],
      ['Hang by the snack table with friends', 'r:' + fr + '+3'],
      ['Stay near the wall and enjoy watching', 'f:BALL_WALLFLOWER'],
    ], [{ role: 'Around you', names: [fr, other] }]);
  }
  if (st === 2) {
    const T = ctx.T;
    const oldMistake = S.gossip > 0 || F(S, 'GOSSIP') || F(S, 'PUBLIC_JAB') || F(S, 'BLAME_SHIFT');
    const desc = (foe ? foe + ' is across the room and the air feels tense. ' : '')
      + 'Someone starts a rumour about ' + T + ', and heads turn toward you to see what you will do.';
    return mk('The Ball — Whispers at the punch table', desc, [
      ['Add a juicy detail to the story', '', { gossip: T }],
      ['Shut it down: "That is not our business."', 'r:' + T + '+6;p-1?.4;f:STOOD_UP'],
      ['Blame someone else when the talk comes back to you', '', { blame: T }],
      ['Own your part in an old mess, in front of everyone', 'r:' + T + '+5;p-1;f:PUBLIC_ACCOUNTABILITY;f:APOLOGIZED_SPECIFIC', { req: oldMistake ? null : 'Needs an old mistake to own' }],
      ['Walk away from it', ''],
    ], [{ role: 'Rumour about', names: [T] }]);
  }
  if (st === 3) {
    const sp = knownRank(S, metKids(S)).slice(0, 3);
    const awardReq = S.pop >= 55 || S.grade >= 75 ? null : 'Needs Pop 55 or Grade 75';
    const desc = 'The photographer waves everyone over, and the principal announces a Class Spirit award with a short speech. The spotlight swings around the room.';
    return mk('The Ball — Photos and spotlight', desc, [
      ['Gather everyone for one big group photo', 'r:G+3;f:INCLUSIVE_PHOTO'],
      ['Pose only with the popular group', 'p+2;r:G-3;f:PHOTO_CLIQUE'],
      ['Accept the award and thank everyone by name', 'p+1;r:TOP+3;f:SHARED_SPOTLIGHT', { req: awardReq }],
      ['Accept the award and take all the credit', 'p+3;r:G-5;f:STOLE_CREDIT', { req: awardReq }],
      ['Skip the spotlight and support a friend quietly', 'r:' + sp[0] + '+4;f:QUIET_SUPPORT'],
    ]);
  }
  // last dance: someone you hurt (and who is still below +30), or your foe, leaves alone
  const hurt = Object.keys(S.hurt || {}).filter(n => S.hurt[n] > 0 && S.rel[n] < 30)[0] || foe;
  const desc = 'The lights dim. The last slow song fades. People drift to the coats. '
    + (hurt ? hurt + ' is putting a coat on, alone.' : 'Everyone is putting coats on.');
  return mk('The Ball — Last dance', desc, [
    [
      hurt ? 'Apologize to ' + hurt + ' before leaving' : 'Thank the organizers before leaving',
      hurt ? 'r:' + hurt + '+8;f:APOLOGIZED_SPECIFIC;f:BALL_REPAIR;f:LAST_DAY_APOLOGY' : 'r:G+3',
      { appol: hurt },
    ],
    ['Walk ' + ballFriend(S) + ' home and say thank you', 'r:' + ballFriend(S) + '+5'],
    ['Stay and help clean up the gym', 'r:G+3;f:BALL_CLEANUP;f:BALL_BACKSTAGE'],
    ['Smooth over what you said earlier and hide the contradictions', '', { hide: true }],
    ['Slip out quietly', ''],
  ]);
}
// lowers several relationships by v (negative) until `cap` points in total are lost; no ripple
function hitEach(S, names, v, cap, ch) {
  let tot = 0;
  names.forEach(n => {
    if (tot < cap) {
      addRel(S, n, v, ch, false, true);
      tot -= v;
    }
  });
}
function ballEnd(S) {
  S.pend = null;
  S.phase = 'free';
}
function chooseBallScene(S, c, ev) {
  const ch = [], lines = [];
  const ctx = ev.ctx;
  // up to 4 kids who would hear about n: your friends and n's friends
  const witnesses = n => metKids(S).filter(k => k !== n && (S.rel[k] > 0 || (LINKS[n] || []).some(l => l[0] === k))).slice(0, 4);
  if (c.dance) {
    const n = c.dance;
    const chance = S.rel[n] >= 60 ? 95 : clamp(55 + S.rel[n], 10, 90);
    if (rnd(S) * 100 < chance) {
      addRel(S, n, 6, ch);
      addPop(S, 1, ch);
      setFlag(S, 'BALL_DANCE');
      lines.push(n + ' laughed and took your hand. A song later you were both out of breath.');
    } else {
      addRel(S, n, 1, ch);
      lines.push(n + ' smiled and said maybe the next one. No hard feelings.');
    }
  } else if (c.gossip) {
    const T = c.gossip;
    applyFx(S, fxs('gos+1'), ctx, ch);
    if (rnd(S) < 0.55) { // it reaches T: T's close friends take sides
      addRel(S, T, -10, ch);
      hitEach(S, (LINKS[T] || []).filter(l => l[1] >= 2 && CH[l[0]].role === 'kid').map(l => l[0]), -5, 30, ch);
      addPop(S, 2, ch);
      setFlag(S, 'GOSSIP');
      lines.push('It reached ' + T + ' before the song ended. Close friends took sides.');
    } else {
      addPop(S, 1, ch);
      lines.push('The story fizzled. Nobody repeated it.');
    }
  } else if (c.blame) {
    const T = c.blame;
    setFlag(S, 'BLAME_SHIFT');
    if (rnd(S) < 0.3) { // found out
      addRel(S, T, -15, ch);
      hitEach(S, witnesses(T), -10, 30, ch);
      addPop(S, -3, ch);
      setFlag(S, 'HYPOCRISY');
      lines.push('Someone had the screenshot. The blame bounced right back onto you.');
    } else {
      addPop(S, 1, ch);
      lines.push('The blame stuck to someone else. It feels worse than you expected.');
    }
  } else if (c.hide) {
    if (rnd(S) < 0.5) {
      hitEach(S, witnesses(ev.ctx.T), -10, 80, ch);
      addPop(S, -2, ch);
      setFlag(S, 'HYPOCRISY');
      lines.push('Two people compared notes. The versions did not match.');
    } else lines.push('Nobody connected the dots tonight.');
  } else applyFx(S, c.fx, ctx, ch);
  if (c.appol) {
    S.apol = S.apol || {};
    bump(S.apol, c.appol);
    bump(S, 'apolN');
  }
  logAdd(S, ev.title + ' — ' + stripEnd(c.x), ch);
  if (ev.st >= BALL_STAGES - 1) ballEnd(S);
  else {
    S.pend = { kind: 'ball', st: ev.st + 1 };
    S.phase = 'event';
  }
  return result(ch, lines);
}

/* ---------- after an event ---------- */
// What comes after an event: free time (day, special), the day's event (holiday), or the next
// day (evening events). The Ball follows the day event on BALL_DAY; the tribunal has a day 2.
function finishEvent(S, ev) {
  if (S.over) {
    S.pend = null;
    return;
  }
  const k = ev.kind;
  if (k === 'day' || k === 'special') {
    if (k === 'special' && S.pend.id === 'tribunal') {
      S.pend = null;
      S.phase = 'free';
      S.tribNext = 1;
      return;
    }
    S.pend = null;
    S.phase = 'free';
    if (k === 'day' && dayOf(S).d === BALL_DAY) {
      S.pend = { kind: 'ball', st: 0 };
      S.phase = 'event';
    }
  } else if (k === 'holiday') {
    S.pend = preDayEvent(S);
  } else if (k === 'rand' || k === 'personal' || k === 'birthday' || k === 'npc' || k === 'notice') {
    S.pend = null;
    advance(S);
  }
}
