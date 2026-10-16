/* engine/08_day.js — endDay(), evening events, advance() to the next day, end of the year; study / work / buy. */
'use strict';
/* ---------- day flow ---------- */
// A day: S.pend event(s) in the morning -> free time (phase 'free') -> endDay() -> maybe one
// evening event -> advance() to the next school day.
const LOAN_REPAY_CHANCE = 0.85; // a loan comes back on its due day, else it is lost
const DECAY_AFTER = 14;         // days without contact before a relationship above 10 starts to drop
const LOW_POP = 30;             // POP at or below this counts for the "low streak" endings
function endDay(S) {
  if (S.phase !== 'free' || S.over) return null;
  // loans that are due
  S.loans = S.loans.filter(l => {
    if (l.due > S.di) return true;
    if (rnd(S) < LOAN_REPAY_CHANCE) {
      const ch = [];
      addMoney(S, l.amt, ch);
      addRel(S, l.who, 1, ch, true);
      logAdd(S, l.who + ' paid you back $' + l.amt, ch, 'sys');
    } else {
      logAdd(S, l.who + ' still has not paid you back.', [], 'sys');
    }
    return false;
  });
  // once a week, friendships you neglect lose 1 point
  if (S.di % 7 === 6) {
    KIDS.forEach(n => {
      if (S.rel[n] > 10 && S.di - (S.last[n] == null ? -99 : S.last[n]) > DECAY_AFTER) S.rel[n]--;
    });
  }
  if (S.bike > 0) S.bike--;
  if (S.pop <= LOW_POP) {
    bump(S, 'lowStreak');
    S.lowMax = Math.max(S.lowMax || 0, S.lowStreak);
  } else S.lowStreak = 0;
  try { phoneIncoming(S); } catch (e) {}
  // evening event
  const evn = evening(S);
  if (evn) {
    S.pend = evn;
    S.phase = 'event';
    return { evening: true };
  }
  advance(S);
  return { evening: false };
}
// birthdays in data.js are written "March 14"
const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const RAND_GAP = 3;          // minimum days between two random events
const RAND_CHANCE = 0.3;     // chance of a random event per evening
const PERSONAL_CHANCE = 0.2; // chance of a personal event per evening
const DAY_MS = 86400000;
// The evening event, by priority (or null): a birthday, the family noticing, a follow-up,
// an NPC act, a random event, a personal event. Most of them do not happen during breaks.
function evening(S) {
  const d = dayOf(S);
  const next = DAYS[S.di + 1];
  if (!next) return null;
  // birthdays: anyone (not a teacher) whose birthday falls after today and up to the next
  // school day, if you are friendly (10+) or family; once a year each
  const bdKey = (b) => {
    const [mo, dy] = b.split(' ');
    return [MONTH_NUM[mo], +dy];
  };
  const a = new Date(d.d + 'T12:00:00Z'), b2 = new Date(next.d + 'T12:00:00Z');
  for (const c of D.chars) {
    if (c.role === 'teach') continue;
    const [mo, dy] = bdKey(c.b);
    for (let t = new Date(a.getTime() + DAY_MS); t <= b2; t = new Date(t.getTime() + DAY_MS)) {
      const key = 'BD_' + c.n + t.getUTCFullYear();
      if (t.getUTCMonth() + 1 === mo && t.getUTCDate() === dy && (S.rel[c.n] >= 10 || c.role === 'fam') && !S.flags[key]) {
        S.flags[key] = 1;
        return { kind: 'birthday', who: c.n };
      }
    }
  }
  // the family notices when you act strangely (closest family member first)
  if (!d.brk && (S.noticed || 0) < NOTICE_AT.length && (S.strange || 0) >= NOTICE_AT[S.noticed || 0]) {
    const fam = FAM.slice().sort((a, b) => S.rel[b] - S.rel[a]);
    const who = fam[(S.noticed || 0) % fam.length];
    bump(S, 'noticed');
    return { kind: 'notice', who, lvl: S.noticed - 1 };
  }
  // follow-ups to earlier scenes (an apology, an echo)
  const fi = (S.follow || []).findIndex(x => x.due <= S.di);
  if (!d.brk && fi >= 0) {
    const x = S.follow.splice(fi, 1)[0];
    S.lastNpc = S.di;
    return { kind: 'npc', who: x.who, act: x.act };
  }
  // someone does something for (or about) you
  if (!d.brk && S.di - (S.lastNpc == null ? -9 : S.lastNpc) >= NPC_GAP && rnd(S) < NPC_CHANCE) {
    const np = npcPick(S);
    if (np) {
      S.lastNpc = S.di;
      return { kind: 'npc', who: np.who, act: np.act };
    }
  }
  // random event (note: the chance is drawn before the break check)
  if (S.di - S.lastRand >= RAND_GAP && rnd(S) < RAND_CHANCE && !d.brk) {
    return { kind: 'rand', i: Math.floor(rnd(S) * RAND.length) };
  }
  // personal event
  if (rnd(S) < PERSONAL_CHANCE) return personalPick(S);
  return null;
}
// a personal event with someone you are close to (20+) or in conflict with (-10 or less);
// family sometimes, teachers rarely. 3 days between two with the same person.
function personalPick(S) {
  const okc = n => (S.cool[n] == null || S.di - S.cool[n] >= 3) && (S.rel[n] >= 20 || S.rel[n] <= -10);
  let cands = metKids(S).filter(okc);
  if (!cands.length || rnd(S) < 0.3) cands = cands.concat(FAM.filter(okc));
  if (rnd(S) < 0.18) cands = cands.concat(TEACH.filter(n => okc(n) || (S.rel[n] >= 14 && (S.cool[n] == null || S.di - S.cool[n] >= 6))));
  if (!cands.length) return null;
  const n = pick(S, cands);
  S.cool[n] = S.di;
  const v = S.rel[n];
  S.secretDone = S.secretDone || {};
  // a close friend with a secret scene in talk.js may share it (once)
  const T = globalThis.TALK;
  if (v >= 40 && !S.secretDone[n] && T && (T.P[n] || (T.FP[n] && T.FP[n].s)) && rnd(S) < 0.4) {
    return { kind: 'personal', who: n, mood: 'secret' };
  }
  const mood = (v >= 20 || (CH[n].role === 'teach' && v >= 14)) ? 'friendly' : v <= -40 ? 'enemy' : 'tense';
  return { kind: 'personal', who: n, mood };
}
// next school day (or the end of the year)
function advance(S) {
  S.today = {};
  if (S.di >= DAYS.length - 1) {
    finishYear(S);
    return;
  }
  S.di++;
  if (S.tribNext && DAYS[S.di].d >= '2026-11-20') { // day 2 of the Group Chat Tribunal
    S.tribNext = 0;
    S.pend = { kind: 'special', id: 'tribunal2' };
  } else S.pend = preDayEvent(S);
  S.phase = 'event';
  S.blocks = blocksFor(S);
  S.maxBlocks = S.blocks;
  if (DAYS[S.di].brk && S.pend.kind === 'day') S.pend = { kind: 'day' }; // (no effect: same value)
}
function finishYear(S) {
  S.pend = null;
  if (S.pop <= 0) {
    S.over = 'pop';
    S.phase = 'over';
    return;
  }
  S.ending = evaluateEnding(S);
  S.phase = 'ending';
}

/* ---------- free-time actions ---------- */
// Each action needs phase 'free', spends time blocks and returns result(chips, lines) or { err }.
function spend(S, n) {
  if (S.blocks < n) return false;
  S.blocks -= n;
  return true;
}
const PREP_MAX_STUDY = 40; // studying or tutoring can build up to 40% preparation (other ways stop at 30)
function study(S) {
  if (S.phase !== 'free') return null;
  if (!spend(S, 1)) return { err: 'No time blocks left.' };
  const ch = [];
  S.studies++;
  let g = 1 + (S.perm['Headphones'] ? 1 : 0);
  addGrade(S, g, ch);
  const pv = (S.perm['Flashcards'] ? 15 : 10) + (S.perm['Sophie\'s planner'] ? 5 : 0);
  S.prep = Math.min(PREP_MAX_STUDY, S.prep + pv);
  setFlag(S, 'STUDIED');
  logAdd(S, 'Studied after school', ch);
  return result(ch, ['Next study check +' + pv + '%.']);
}
function work(S, id) {
  if (S.phase !== 'free') return null;
  const j = JOBS[id];
  if (!j) return null;
  if (j.need && !(S.inv[j.need] > 0) && !S.craftReady) return { err: 'Needs a ' + j.need + ' (or handmade crafts).' };
  if (S.blocks < j.blocks) return { err: 'Not enough time blocks (needs ' + j.blocks + ').' };
  S.blocks -= j.blocks;
  const ch = [];
  let pay = j.pay + (S.perm['Dad\'s toolbox'] ? 2 : 0);
  if (rnd(S) < 0.15) pay += 2; // a tip
  addMoney(S, pay, ch);
  if (j.g) addGrade(S, j.g, ch);
  if (j.p) addPop(S, j.p, ch);
  if (j.fam) {
    addRel(S, 'Mom', 2, ch);
    addRel(S, 'Dad', 2, ch);
  }
  if (j.need && S.inv[j.need] > 0) S.inv[j.need]--;
  S.jobsDone++;
  setFlag(S, 'WORKED');
  logAdd(S, 'Worked: ' + j.n, ch);
  return result(ch, []);
}
function buy(S, id) {
  const it = SHOP[id];
  if (!it) return null;
  if (itemLocked(S, it)) return { err: 'This item is still locked.' };
  if (S.money < it.price) return { err: 'Not enough money.' };
  if (it.kind === 'perm' && S.perm[it.n]) return { err: 'You already own this.' };
  const ch = [];
  addMoney(S, -it.price, ch);
  if (it.kind === 'perm') S.perm[it.n] = 1;
  else bump(S.inv, it.n);
  logAdd(S, 'Bought ' + it.n, ch, 'sys');
  return result(ch, []);
}
