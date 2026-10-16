/* engine/03_state.js — The game state S (newGame), meeting new classmates, how a day starts. */
'use strict';
/* ---------- state ---------- */
// starting relationship by role (kids start at 0)
const START_REL_FAM = 30, START_REL_TEACH = 10;

// The whole game is one plain object S (saved as JSON by the UI). Field names are short and
// must not be renamed: saves depend on them. Key insertion order matters for tests/golden.js.
//
// Set by newGame():
//   v, ngp            save version; 1 when this is a New Game+ run
//   seed, rs          the seed and the current RNG state (advanced by rnd)
//   di                index of the current day in DAYS
//   phase             'event' (an event waits in S.pend) | 'free' (after-school actions)
//                     | 'over' (game over) | 'ending' (year finished, S.ending is set)
//   pend              the pending event: { kind: 'day' | 'special' | 'holiday' | 'rand' | 'ballinvite'
//                     | 'ball' | 'personal' | 'npc' | 'notice' | 'birthday', ...details }
//   pop, money, grade popularity 0-100, dollars, grade 0-100; startGrade = grade on day 1
//   rel[name]         relationship -100..100 with every character; min[name] = lowest ever
//   flags[FLAG]       how many times a story flag was set (read with F(S, FLAG))
//   gossip, started   rumours spread / rumours started; caught = times caught (cheating...)
//   prep              bonus % for the next study check (spent by the check)
//   apol[name]        apologies made; hurt[name] = times you hurt them; ih[name][id] = interaction counts
//   inv[item]         items in the bag (count); perm[item] = owned permanent items; worn[item] = cosmetics worn
//   loans             [{ who, amt, due }] money lent, paid back on day `due` (85% chance)
//   last[name]        day of the last contact (relationships above 10 decay after 14 days without)
//   today             per-day counters, emptied by advance()
//   cool[name]        day of the last personal event with that person
//   heard[name]       indexes of their rumours you have heard
//   blocks, maxBlocks time blocks left / available today; bike = days left of the bicycle bonus
//   freeActs, studies, jobsDone, earned, spent, giftN, giftTo, apolN, accepted, refused, vague,
//   investN, corrected, boundaryN, nrand: counters read by the endings
//   log               the diary entries [{ d, k, t, c }] (last 400)
//   over, ending      game-over reason ('pop') / the ending object from evaluateEnding()
//   lastRand          day of the last random event; asks[name] = times you asked them for money
//   ballTry           Ball invitations made; rcool, seenEnd: unused by the engine
//   met[name]         people you know; order = classmates still to meet; nextIntro = earliest intro day
// Added later, when first needed (old saves may lack them):
//   metN, introDay, introWho        meeting people
//   cool2, lastNpc, follow          NPC acts (per-person cooldown, last NPC day, pending follow-ups)
//   secretDone, recon, retal, talked, giftFrom, lentN, bondDay, bondN, cookDay, cookN
//   tribT, tribNext                 the two-day Group Chat Tribunal
//   ballDate, ballDone, cardUsed, luck, lowStreak, lowMax, notice (one-off message for the UI)
//   strange, noticed, th            the Player mystery (clue count this run, family notices, MC thoughts)
//   meta                            set by the UI: { clues } found across all runs
//   phone, phoneN, phoneAsk, gcN, gcDef, gcLaugh, phIgn, pgN, pgPerf, pgLast, pgPop   phone
//   _ph                             1 while a phone text runs interact() (never saved as 1)
function newGame(seed, ngp) {
  seed = seed == null ? (Math.random() * 2 ** 31) | 0 : seed;
  const S = {
    v: 1, ngp: ngp ? 1 : 0, seed, rs: seed ^ 0x9e3779b9, di: 0, phase: 'event', pend: { kind: 'day' },
    pop: 50, money: 50, grade: 55, startGrade: 55,
    rel: {}, flags: {}, gossip: 0, started: 0, caught: 0, prep: 0,
    min: {}, apol: {}, inv: {}, perm: {}, worn: {}, loans: [], last: {}, today: {}, cool: {}, heard: {},
    blocks: 3, maxBlocks: 3, bike: 0, freeActs: 0, studies: 0, jobsDone: 0, earned: 0, spent: 0,
    ih: {}, hurt: {}, giftN: 0, apolN: 0, accepted: 0, refused: 0, vague: 0, investN: 0, corrected: 0,
    boundaryN: 0, giftTo: {},
    log: [], over: null, ending: null, rcool: -9, lastRand: -9, asks: {}, ballTry: 0, nrand: 0, seenEnd: [],
  };
  D.chars.forEach(c => {
    S.rel[c.n] = c.role === 'fam' ? START_REL_FAM : c.role === 'teach' ? START_REL_TEACH : 0;
    S.min[c.n] = S.rel[c.n];
  });
  // you know your family, Maya, and START_KIDS - 1 other classmates; the rest are met later
  S.met = {};
  FAM.forEach(n => S.met[n] = 1);
  S.met[MAYA] = 1;
  S.order = shuffle(KIDS.filter(n => n !== MAYA), mul(hash(seed + ':met')));
  S.order.slice(0, START_KIDS - 1).forEach(n => S.met[n] = 1);
  S.order = S.order.filter(n => !S.met[n]);
  S.nextIntro = 2;
  S.pend = preDayEvent(S);
  S.blocks = blocksFor(S);
  S.maxBlocks = S.blocks;
  return S;
}
const F = (S, n) => S.flags[n] || 0; // how many times flag n was set (0 = never)
const setFlag = (S, n) => { S.flags[n] = (S.flags[n] || 0) + 1; };
// adds n to a counter that may not exist yet (o[k] starts at 0); returns the new value
const bump = (o, k, n = 1) => (o[k] = (o[k] || 0) + n);

/* ---------- meeting people ---------- */
// The circle of known classmates grows through events. Old saves without S.met know everyone.
const START_KIDS = 8; // classmates known on day 1, Maya included
const INTRO_GAP = 3;  // minimum school days between two introductions (plus 0-2 more)
const isMet = (S, n) => !S.met || !!S.met[n];
const metOf = (S, arr) => S.met ? arr.filter(n => S.met[n]) : arr;
const metKids = S => metOf(S, KIDS);
// returns true when n is new
function meet(S, n) {
  if (!S.met || S.met[n]) return false;
  S.met[n] = 1;
  bump(S, 'metN');
  return true;
}
// decides, once per day, whether this day's event introduces a new classmate
// (it then plays the Target role: see makeCtx)
function introCheck(S, d) {
  if (!S.met || S.introDay === S.di || S.di < (S.nextIntro || 0) || d.brk) return;
  const nxt = (S.order || []).find(n => !S.met[n]);
  if (!nxt) return;
  // the day must involve the target kid
  if (!d.c.some(c => allFx(c).some(f => f.t === 'rel' && roleKey(f.who) === 'T'))) return;
  S.introDay = S.di;
  S.introWho = nxt;
  S.nextIntro = S.di + INTRO_GAP + (hash(S.seed + 'ni' + S.di) % 3);
}

/* ---------- start of a day ---------- */
const dayOf = S => DAYS[Math.min(S.di, DAYS.length - 1)];
// time blocks for today: 3, +1 with the bicycle tune-up, +1 on Mondays with the water bottle,
// +1 with the smartwatch
function blocksFor(S) {
  let b = 3;
  if (S.bike > 0) b++;
  const dow = new Date(dayOf(S).d + 'T12:00:00Z').getUTCDay();
  if (dow === 1 && S.perm['Reusable water bottle']) b++;
  if (S.perm['Smartwatch']) b++;
  return b;
}
const REVEAL_FROM = '2026-09-14', REVEAL_UNTIL = '2027-06-10'; // the reveal can happen in this window
const BALL_INVITE_DAY = '2027-06-16';
// which event opens the day, by priority: a family gift scene (relationship 100), a holiday
// (first day back), a special school event, the reveal, the Ball invitation, else the normal day
function preDayEvent(S) {
  const d = dayOf(S);
  for (const g of GIFTS) {
    if (S.rel[g[1]] >= 100 && !S.perm[g[2]] && !F(S, 'HOL_' + g[0])) return { kind: 'holiday', id: g[0] };
  }
  const hk = HOL_BY_RET[d.d];
  if (hk && !F(S, 'HOL_' + hk)) return { kind: 'holiday', id: hk };
  const sk = SPECIAL_BY_DATE[d.d];
  if (sk) return { kind: 'special', id: sk };
  const revealDue = S.meta && S.meta.clues >= REVEAL_AT && !F(S, 'REVEAL_DONE');
  if (revealDue && d.d >= REVEAL_FROM && d.d < REVEAL_UNTIL && !d.brk) return { kind: 'special', id: 'reveal' };
  if (d.d === BALL_INVITE_DAY && !F(S, 'BALL_INVITED_DONE')) return { kind: 'ballinvite', then: 'day' };
  return { kind: 'day' };
}
