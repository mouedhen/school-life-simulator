/* engine/01_core.js — Character lookups, seeded random numbers, the effect DSL and the school calendar. */
'use strict';
/* ---------- core lookups ---------- */
const D = globalThis.DATA;
const CH = {}; // character by full name: { n, role: 'kid' | 'fam' | 'teach', pop, ap, mo, b, rum, ... }
D.chars.forEach(c => CH[c.n] = c);
const KIDS = D.chars.filter(c => c.role === 'kid').map(c => c.n);
const FAM = D.chars.filter(c => c.role === 'fam').map(c => c.n);
const TEACH = D.chars.filter(c => c.role === 'teach').map(c => c.n);
const MAYA = 'Maya Bennett'; // the classmate you always know from day 1
const NDAYS = () => DAYS.length; // (unused)

/* ---------- rng ---------- */
// FNV-1a string hash: a stable number for a string (used to pick variants without using the RNG)
function hash(s) {
  let h = 2166136261;
  s = String(s);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// mulberry32: the state advances by MUL_STEP, then mulOut() turns the new state into a number in [0, 1).
const MUL_STEP = 0x6D2B79F5;
function mulOut(a) {
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
// a local generator (does not touch S): used for things that must look random but stay
// fixed for a given seed and day (who plays which role, quiz questions...)
function mul(a) {
  return function () {
    a |= 0;
    a = a + MUL_STEP | 0;
    return mulOut(a);
  };
}
// the game's main generator: advances S.rs, so every call changes what comes next
function rnd(S) {
  S.rs = (S.rs + MUL_STEP) | 0;
  return mulOut(S.rs);
}
const ri = (S, a, b) => a + Math.floor(rnd(S) * (b - a + 1)); // random integer a..b (inclusive)
const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Fisher-Yates on a copy, with a local generator r
function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- effect DSL ---------- */
// Example: "p+2;r:C+3?.5;m-5;g+1;f:FLAG;gos+1"
// A string of tokens separated by ';'. Each token becomes one effect object:
//   p+N / p-N        popularity            -> { t: 'pop', v }
//   g+N / g-N        grade                 -> { t: 'grade', v }   (gains are scaled x0.6 in applyFx)
//   m+N / m-N        money                 -> { t: 'money', v }
//   r:ROLE+N         relationship          -> { t: 'rel', who: ROLE, v }
//                    ROLE is a role key (T, H, C, TM, TM1, G, TEACH, DATE, TOP, RIVAL, MAYA,
//                    MOM, DAD, PARENTS, RILEY, MAX, OLIVER, SOPHIE) or a character's full name;
//                    see roleKey() / resolve() in "day context".
//   f:FLAG           set a flag (S.flags[FLAG] += 1) -> { t: 'flag', f }
//   gos+N            gossip counter        -> { t: 'gossip', v }
// Any token can end with ?P (0..1): it only happens with probability P, e.g. "p-8?.4".
// 'gos' is tested before 'g' on purpose: "gos+1" must not be read as a grade change.
// Effects built by data.js can also have t: 'spill' / 'either' and g: 'ex' (see applyFx).
// An unknown token throws an error.
function fxs(str) {
  if (!str) return [];
  return str.split(';').map(s => s.trim()).filter(Boolean).map(tok => {
    let p;
    const q = tok.indexOf('?');
    if (q > 0) {
      p = parseFloat(tok.slice(q + 1));
      tok = tok.slice(0, q);
    }
    let o;
    if (tok.startsWith('f:')) o = { t: 'flag', f: tok.slice(2) };
    else if (tok.startsWith('r:')) {
      const m = tok.slice(2).match(/^(.*?)([+-]\d+)$/);
      o = { t: 'rel', who: m[1], v: +m[2] };
    }
    else if (tok.startsWith('gos')) o = { t: 'gossip', v: +tok.slice(3) };
    else if (tok.startsWith('p')) o = { t: 'pop', v: +tok.slice(1) };
    else if (tok.startsWith('m')) o = { t: 'money', v: +tok.slice(1) };
    else if (tok.startsWith('g')) o = { t: 'grade', v: +tok.slice(1) };
    else throw new Error('bad fx ' + tok);
    if (p != null) o.p = p;
    return o;
  });
}

/* ---------- calendar ---------- */
const DAYS = D.days.slice(); // { d: 'YYYY-MM-DD', t: title, s: description, c: choices, brk?: no school }
// spring break: the guide puts one event in Mar 1-5; we insert a virtual day
(function () {
  const i = DAYS.findIndex(d => d.d > '2027-03-01');
  DAYS.splice(i, 0, { d: '2027-03-01', t: 'Spring break', s: 'No classes this week. Messages light up your phone.', c: [], brk: true });
})();
const DAYIDX = {}; // date -> index in DAYS
DAYS.forEach((d, i) => DAYIDX[d.d] = i);
const BALL_DAY = '2027-06-18';
