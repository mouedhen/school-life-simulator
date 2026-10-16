/* engine/05_effects.js — Relationship changes, who plays which role in an event (makeCtx), applying effects. */
'use strict';
/* ---------- relationships ---------- */
function relLabel(v) {
  return v >= 60 ? 'Close' : v >= 20 ? 'Friend' : v >= -9 ? 'Neutral' : v >= -39 ? 'Tense' : 'Enemy';
}
const REL_STEP_MAX = 15;      // one change is clamped to -15..+15
const RIPPLE_FACTOR = 0.12;   // share of a change that spreads to linked kids (times the link strength)
const RIPPLE_MAX = 4;         // a ripple moves another relationship by at most 4
// Changes the relationship with `name` by about v and returns the real change.
// - gains shrink above +20 (diminishing returns, at least 12% of v is kept);
// - ch (optional) collects the visible changes ("chips"); quiet = do not show this one;
// - a change of 3+ with a kid ripples to the kids linked to them (friends follow your
//   change, rivals move the other way), unless noRipple.
function addRel(S, name, v, ch, quiet, noRipple) {
  if (!name || !CH[name]) return 0;
  v = clamp(Math.round(v), -REL_STEP_MAX, REL_STEP_MAX);
  const old = S.rel[name];
  if (v > 0 && old > 20) v = pround(S, v * clamp(1 - (old - 20) / 45, 0.12, 1));
  S.rel[name] = clamp(old + v, -100, 100);
  const real = S.rel[name] - old;
  if (S.rel[name] < S.min[name]) S.min[name] = S.rel[name];
  if (!quiet && ch && real) ch.push({ k: 'rel', n: name, v: real });
  if (!noRipple && Math.abs(v) >= 3 && CH[name].role === 'kid') {
    (LINKS[name] || []).forEach(([o, k]) => {
      if (CH[o].role !== 'kid') return;
      let d = Math.round(v * RIPPLE_FACTOR * Math.abs(k));
      if (!d && Math.abs(v) >= 4) d = v > 0 ? 1 : -1;
      if (k < 0) d = -Math.sign(d) * Math.max(1, Math.abs(d) >> 1); // rivals: opposite, halved
      d = clamp(d, -RIPPLE_MAX, RIPPLE_MAX);
      if (d) {
        const before = S.rel[o];
        S.rel[o] = clamp(before + d, -100, 100);
        if (S.rel[o] < S.min[o]) S.min[o] = S.rel[o];
        if (ch) ch.push({ k: 'ripple', n: o, v: S.rel[o] - before });
      }
    });
  }
  return real;
}
// best relationship first
function knownRank(S, kids) { return kids.slice().sort((a, b) => S.rel[b] - S.rel[a]); }
// the known classmate you get on with worst
function lowestKid(S) { return metKids(S).slice().sort((a, b) => S.rel[a] - S.rel[b])[0]; }

/* ---------- day context ---------- */
// Who plays which role in an event. The cast is fixed for a given seed and key (no S.rs draw):
//   T target, H helper (a kind kid if possible), C classmate, TM two teammates,
//   G a group (C + the teammates), teacher (from the subject of the day).
function makeCtx(S, key, subject) {
  const r = mul(hash(S.seed + ':' + key));
  const pool = shuffle(metKids(S), r);
  const warm = pool.filter(n => S.rel[n] >= 20);
  // 30% of the time (when you have friends) the target is a friend
  let T = (warm.length && r() < 0.3) ? warm[Math.floor(r() * warm.length)] : pool[0];
  if (S.introDay === S.di && S.introWho && key === 'd' + S.di) T = S.introWho; // the new classmate of the day
  const rest = pool.filter(n => n !== T);
  const helpers = rest.filter(n => CH[n].ap >= 3);
  const H = helpers[Math.floor(r() * helpers.length)] || rest[0];
  const rest2 = rest.filter(n => n !== H);
  const C = rest2[0], TM = [rest2[1], rest2[2]], G = [C, rest2[1], rest2[2]];
  const teacher = teacherFor(subject || '', r);
  return { T, H, C, TM, G, teacher, key };
}
// the teacher of a subject, guessed from words in the title (random teacher otherwise)
function teacherFor(t, r) {
  if (/english|writing|story|reading|library|book|poem|grammar|journal|spelling|vocab/i.test(t)) return 'Ms. Harper Ellis';
  if (/math|fraction|multipl|measure|number|science|stem|graph|data|quiz|geometry/i.test(t)) return 'Mr. Daniel Brooks';
  if (/art|draw|colou?r|craft|paint|poster|music|concert|talent|design/i.test(t)) return 'Ms. Priya Shah';
  if (/\bpe\b|sport|field|gym|relay|hockey|basketball|game|olympic|fitness/i.test(t)) return 'Mr. Marcus Reed';
  return TEACH[Math.floor((r ? r() : 0) * 4)];
}
// role words used in data.js (lower case) -> role key
const ROLEMAP = {
  target: 'T', helper: 'H', maya: 'MAYA',
  classmate: 'C', 'invited classmate': 'C', 'new classmate': 'C', student: 'C', 'quieter student': 'C',
  recipient: 'C', winner: 'C', 'invited student': 'C', witness: 'C',
  'mistaken teammate': 'TM1', teammate: 'TM1', teacher: 'TEACH', rival: 'RIVAL', 'date/friend': 'DATE',
  teammates: 'TM', 'two classmates': 'TM',
  group: 'G', classmates: 'G', 'nearby classmates': 'G', 'classmates with shared interests': 'G', witnesses: 'G',
  organizers: 'G', 'excluded students': 'G', 'target team': 'G', 'classmates who compliment it': 'G',
  'closest friends': 'TOP', 'friend group': 'TOP', 'present friends': 'TOP', 'friends who check on you': 'TOP',
  'each thanked character': 'TOP', 'friends who': 'TOP',
};
// how a role is shown in the "who" list of an event
const ROLELABEL = { T: 'Target', H: 'Helper', C: 'Classmate', TM1: 'Teammate', TM: 'Teammates', G: 'Group', TEACH: 'Teacher', DATE: 'Ball date', RIVAL: 'Rival', MAYA: 'Maya' };
const ROLE_KEYS = ['T', 'H', 'C', 'TM', 'TM1', 'G', 'TEACH', 'TEACHER', 'DATE', 'TOP', 'MOM', 'DAD', 'PARENTS', 'RILEY', 'MAX', 'OLIVER', 'SOPHIE'];
// normalizes a role (key, data.js word, or anything else) to a role key; unknown -> 'C'
function roleKey(w) {
  if (!w) return 'C';
  const k = String(w).toLowerCase();
  if (ROLEMAP[k]) return ROLEMAP[k];
  if (ROLE_KEYS.includes(w)) return w === 'TEACHER' ? 'TEACH' : w;
  if (/friend|thanked|present/.test(k)) return 'TOP';
  if (/team/.test(k)) return 'TM';
  if (/group|class|student|witness|organi|excluded/.test(k)) return 'G';
  return 'C';
}
// the character names behind a role in this context
function resolve(S, ctx, who) {
  const k = roleKey(who);
  switch (k) {
    case 'T': return [ctx.T];
    case 'H': return [ctx.H];
    case 'C': return [ctx.C];
    case 'MAYA': return [MAYA];
    case 'RILEY': return ['Riley'];
    case 'MAX': return ['Max'];
    case 'OLIVER': return ['Oliver'];
    case 'SOPHIE': return ['Sophie'];
    case 'MOM': return ['Mom'];
    case 'DAD': return ['Dad'];
    case 'PARENTS': return ['Mom', 'Dad'];
    case 'TM1': return [ctx.TM[0]];
    case 'TM': return ctx.TM;
    case 'G': return ctx.G;
    case 'TEACH': return [ctx.teacher];
    case 'DATE': return [S.ballDate || knownRank(S, metKids(S))[0]];
    case 'RIVAL': { // your worst relationship if it is negative, else the target
      const lo = lowestKid(S);
      return [S.rel[lo] < 0 ? lo : ctx.T];
    }
    case 'TOP': { // up to 3 best friends (or the group if you have none)
      const t = knownRank(S, metKids(S)).filter(n => S.rel[n] > 0).slice(0, 3);
      return t.length ? t : ctx.G;
    }
  }
  return [ctx.C];
}

/* ---------- applying effects ---------- */
// Applies a list of effects (from fxs or data.js). opt.exposed: also apply the g: 'ex' effects
// (consequences when you were found out). ch collects the visible changes.
function applyFx(S, list, ctx, ch, opt) {
  opt = opt || {};
  (list || []).forEach(f => {
    if (f.g === 'ex' && !opt.exposed) return;
    if (f.p != null && rnd(S) >= f.p) return; // the effect did not happen this time
    switch (f.t) {
      case 'pop': addPop(S, f.v, ch); break;
      case 'grade': addGrade(S, f.v > 0 ? pround(S, f.v * 0.6) : f.v, ch); break;
      case 'money': addMoney(S, f.v, ch); break;
      case 'flag':
        setFlag(S, f.f);
        if (!/^(PEDAGO)/.test(f.f)) ch.push({ k: 'flag', n: f.f });
        // the first time a flag is set, the shop items it unlocks are announced
        if (F(S, f.f) === 1) SHOP.forEach(it => { if (it.flag === f.f) ch.push({ k: 'unlock', n: it.n }); });
        break;
      case 'gossip': addGossip(S, f.v, ch); break;
      case 'rel':
        resolve(S, ctx, f.who).forEach(n => {
          addRel(S, n, f.v, ch);
          S.last[n] = S.di;
        });
        break;
      case 'spill': { // the last person whose relationship changed tells two of their friends (+1..2)
        const t = lastRelTarget(ch);
        if (t) {
          (LINKS[t] || []).slice(0, 2).forEach(([o]) => {
            if (CH[o].role === 'kid') addRel(S, o, ri(S, 1, 2), ch, false, true);
          });
        }
        break;
      }
      case 'either': applyFx(S, [rnd(S) < 0.5 ? f.a : f.b], ctx, ch, opt); break;
    }
  });
}
function lastRelTarget(ch) {
  for (let i = ch.length - 1; i >= 0; i--) if (ch[i].k === 'rel') return ch[i].n;
  return null;
}
// probabilistic rounding: 2.3 -> 3 with 30% chance, else 2 (draws one number)
function pround(S, x) {
  const f = Math.floor(Math.abs(x));
  const fr = Math.abs(x) - f;
  return Math.sign(x) * (f + (rnd(S) < fr ? 1 : 0));
}
// POP gains shrink above 55; losses grow by 30% below 30
function addPop(S, v, ch) {
  const o = S.pop;
  if (v > 0 && S.pop > 55) v = pround(S, v * clamp((100 - S.pop) / 45, 0.25, 1));
  else if (v < 0 && S.pop < 30) v = pround(S, v * 1.3);
  S.pop = clamp(S.pop + v, 0, 100);
  if (ch && S.pop !== o) ch.push({ k: 'pop', v: S.pop - o });
  checkOver(S);
}
function addGossip(S, v, ch) {
  S.gossip += v;
  setFlag(S, 'GOSSIP');
  ch.push({ k: 'gossip', v });
}
function addGrade(S, v, ch) {
  const o = S.grade;
  S.grade = clamp(S.grade + v, 0, 100);
  if (ch && S.grade !== o) ch.push({ k: 'grade', v: S.grade - o });
}
function addMoney(S, v, ch) {
  const o = S.money;
  S.money = Math.max(0, S.money + v);
  if (v > 0) S.earned += v; else S.spent += -v;
  if (ch && S.money !== o) ch.push({ k: 'money', v: S.money - o });
}
// POP 0 ends the game, unless Riley's hidden card saves you (once)
function checkOver(S) {
  if (S.pop <= 0 && !S.over) {
    if (S.perm['Riley\'s hidden card'] && !S.cardUsed) {
      S.cardUsed = 1;
      S.pop = 10;
      S.notice = 'Riley\'s hidden card was waiting for you. Not today.';
      logAdd(S, 'Riley\'s hidden card', [], 'sys');
      return;
    }
    S.over = 'pop';
    S.phase = 'over';
  }
}
// money a choice surely costs (random losses do not count)
function cost(list) {
  return (list || []).reduce((s, f) => s + (f.t === 'money' && f.v < 0 && f.p == null ? -f.v : 0), 0);
}
