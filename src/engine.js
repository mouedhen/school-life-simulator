/* School Life Simulator engine — pure logic, no DOM. Needs globalThis.DATA (data.js) and,
 * optionally, globalThis.TALK (talk.js). Everything is exposed through the object `E`
 * at the end of the file (globalThis.Engine in the browser, module.exports in Node).
 *
 * TABLE OF CONTENTS (sections in file order)
 *   core lookups ........... characters by name, KIDS / FAM / TEACH lists
 *   rng .................... seeded random numbers (mulberry32); rnd(S) advances S.rs
 *   effect DSL ............. fxs("p+2;r:T+3?.5;f:FLAG") -> list of effect objects
 *   calendar ............... DAYS (school days from data.js + a virtual spring-break day)
 *   random events .......... RAND: the 20 small evening events
 *   special events ......... SPECIAL: fixed-date "big" school events (+ showcase, reveal)
 *   holidays ............... HOLIDAYS: long weekends and family gift scenes
 *   shop ................... SHOP items, their kind (gift / prep / use / perm / cosmetic / booster)
 *   jobs ................... JOBS: paid after-school work
 *   interaction catalogue .. INTER: everything you can do with a person, and who allows it
 *   links / ripple ......... LINKS: friendships between characters (relationship ripple)
 *   state .................. newGame(): the shape of the game state S; flags
 *   meeting people ......... the circle of known classmates grows through events
 *   start of a day ......... time blocks, which event opens the day (preDayEvent)
 *   the Player mystery ..... MC's doubts (THOUGHTS) and the family noticing (NOTICE)
 *   NPC acts ............... people come to you: compliments, gifts, gossip, follow-ups
 *   relationships .......... addRel() with diminishing returns and ripple to linked kids
 *   day context ............ who plays Target / Helper / Classmate... in an event (makeCtx)
 *   applying effects ....... applyFx(), pop / grade / money changes, game over by POP
 *   building events ........ buildEvent(): turns S.pend into an event for the UI
 *   personal events ........ one-on-one evening scenes (friendly / tense / enemy)
 *   choosing ............... choose(): resolves a choice (study check, cheating, team game)
 *   ball invitation ........ chooseBall(): asking someone to the Ball
 *   the Ball ............... the five-scene Ball night
 *   after an event ......... finishEvent(): what comes next
 *   day flow ............... endDay(), evening events, advance(), end of the year
 *   free-time actions ...... study, work, buy
 *   family bonds ........... BONDS: activities with Dad / siblings, gift items at 100
 *   cooking ................ RECIPES, cook()
 *   items and gifts ........ useItem(), giveGift()
 *   interactions ........... interactionList(), interact(), rumours
 *   endings ................ ENDINGS, stats(), character endings (CHEND), checks(), evaluateEnding()
 *   quiz mini-games ........ quiz(): questions for exam / test / quiz days
 *   phone .................. texting a person (replaces in-person small talk), incoming texts
 *   group chats ............ #class and #fam
 *   phone minigames ........ rewards for the phone games
 *   rumour lookup .......... rumorsFor() for the UI
 *   public API ............. the object E
 *
 * RULES FOR CHANGING THIS FILE
 *   - English strings are translation keys for the French layer (tr/out_*.json, one key per
 *     sentence). Changing a sentence means adding its French translation too.
 *   - Every random draw goes through rnd(S) (or a local mul() generator seeded from S.seed),
 *     so a game is reproducible from its seed. tests/golden.js checks this.
 */
(function (root) {
'use strict';
/* ---------- core lookups ---------- */
const D = root.DATA;
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

/* ---------- random events ---------- */
// RAND: the small evening events. Effects are hand-written here; titles, descriptions and
// choice texts come from data.js (D.events, same order).
const RAND = [
  ['Rainy-Day Plan', [['r:C+2', ''], ['', ''], ['p+1', '']]],
  ['Lost Wallet', [['p+3;f:RETURNED_WALLET', ''], ['p+4;f:RETURNED_WALLET', ''], ['m+10;p-8?.4;f:KEPT_CASH', '']]],
  ['Club Sign-Up', [['m-2;f:CLUB_MEMBER', ''], ['p+1;r:C+2', ''], ['', '']]],
  ['Cafeteria Mix-Up', [['r:C+1', ''], ['r:C+2', ''], ['p-2', '']]],
  ['Group Project', [['g+2', ''], ['g+1;r:TM+3', ''], ['r:TM-2', '']]],
  ['Mystery Note', [['r:H+2', ''], ['f:CLUE_FOUND', ''], ['p+1;f:PUBLIC_NOTE', '']]],
  ['Charity Sale', [['m-4;p+1', ''], ['p+3', ''], ['p+1;f:FUNDRAISER_IDEA', '']]],
  ['Broken Poster', [['r:G+2', ''], ['p+2', ''], ['', '']]],
  ['Unexpected Free Period', [['g+1', ''], ['r:C+1', ''], ['p+1;r:TEACHER-2', '']]],
  ['Lost-and-Found', [['p+1', ''], ['r:C+2?.6;p+1', ''], ['p-4?.5', '']]],
  ['Rainy Recess', [['r:C+2', ''], ['', ''], ['p-1', '']]],
  ['School Spirit Day', [['p+1', ''], ['m-3;p+2', ''], ['', '']]],
  ['A Fair Trade', [['r:C+1', ''], ['r:C+1;m+3?.5', ''], ['m+4;p-3?.5', '']]],
  ['Quiet Student Needs Help', [['r:C+2;f:MADE_SPACE', ''], ['r:C+2', ''], ['r:C-2', '']]],
  ['Surprise Quiz', [{ sp: 'academic', pass: 'g+3', fail: 'g-1' }, ['g+1', ''], { sp: 'cheat', ok: 'g+1;f:CHEATED_ONCE' }]],
  ['Community Clean-Up', [['p+2', ''], ['m-5;p+2', ''], ['p+1', '']]],
  ['Misheard Message', [['r:H+3', ''], ['p+1', ''], ['r:H-3?.5;f:REPEATED_RUMOUR', '']]],
  ['Unexpected Compliment', [['r:C+1', ''], ['r:C+2', ''], ['r:C-1', '']]],
  ['Last-Minute Invitation', [['r:C+2;m-5', ''], ['r:C+2', ''], ['', '']]],
  ['Fairness Debate', [['r:G+2', ''], ['r:G+2;p+1', ''], ['r:C+2;r:H-2', '']]],
].map((r, i) => {
  const e = D.events ? D.events[i] : null; // texts from data.js
  const choices = r[1].map((ch, j) => {
    const base = e && e.choices[j] ? { x: e.choices[j][0], note: e.choices[j][1] } : { x: 'Choice', note: '' };
    if (Array.isArray(ch)) return Object.assign(base, { fx: fxs(ch[0]) });
    // a special choice: sp = 'academic' (study check: pass / fail) or 'cheat' (ok if not caught)
    return Object.assign(base, { fx: [], sp: ch.sp, pass: fxs(ch.pass), fail: fxs(ch.fail), ok: fxs(ch.ok) });
  });
  return { t: r[0], d: (e && e.desc) || '', c: choices };
});

/* ---------- special events ---------- */
// Fixed-date school events. Each choice row: [text, effects, requiredFlag, requirement, say].
//   requiredFlag: the choice is hidden unless that flag is set; requirement: 'FRIEND' (Target
//   at +20) or 'M4' ($4); say: a line shown after choosing. date 'meta' = no fixed date.
const SPECIAL = {
  screenshot: {
    date: '2026-10-05', t: 'The Screenshot That Changes Everything',
    d: 'A cropped screenshot from a private conversation circulates. It is real, but the missing context changes how it reads. Students decide whom to believe partly based on status.',
    c: [
      ['Investigate the rumour', 'r:T+2;f:INVESTIGATED_RUMOUR;f:PEDAGO_HELPED'],
      ['Ask the person involved', 'r:T+4;f:PEDAGO_HELPED'],
      ['Share it around', 'gos+1;p+2;r:T-8?.55'],
      ['Stay out of it', ''],
    ],
  },
  tribunal: {
    date: '2026-11-19', t: 'The Group Chat Tribunal',
    d: 'A class group chat turns a student into a joke. Several people join in because laughing along feels safer than becoming the next target. (Day 1 of 2.)',
    c: [
      ['Defend the student', 'r:T+8;p-1?.45;f:STOOD_UP;f:PEDAGO_HELPED'],
      ['Join the jokes', 'p+2;r:T-8;gos+1;f:JOINED_JOKES'],
      ['Message the student privately', 'r:T+4;f:PEDAGO_HELPED'],
      ['Leave the chat', ''],
    ],
  },
  tribunal2: {
    date: '2026-11-20', t: 'The Group Chat Tribunal — Aftermath',
    d: 'The chat has gone quiet. The student sits alone at recess.',
    c: [
      ['Check on them', 'r:T+3;f:PEDAGO_HELPED'],
      ['Apologize for joining the jokes', 'r:T+8;f:APOLOGIZED_SPECIFIC;f:PEDAGO_HELPED', 'JOINED_JOKES'],
      ['Move on', ''],
    ],
  },
  invitation: {
    date: '2027-01-05', t: 'The Unexpected Invitation',
    d: 'Someone outside your usual circle invites you to an activity. Accepting could complicate your place in the hierarchy.',
    c: [
      ['Accept the invitation', 'r:T+5;p-1?.4;f:CROSSED_CLIQUE;f:PEDAGO_HELPED'],
      ['Decline politely', 'r:T-1'],
      ['Decline rudely', 'r:T-6;p+1?.4;f:RUDE_DECLINE'],
    ],
  },
  poll: {
    date: '2027-02-19', t: 'The Popularity Poll',
    d: 'An anonymous poll ranks students by who is most liked, fake, or least likely to fit in. Students treat the poll like a verdict.',
    c: [
      ['Refuse to participate', 'f:REFUSED_POLL;f:PEDAGO_HELPED'],
      ['Defend a targeted student', 'r:T+6;p-1?.5;f:STOOD_UP;f:PEDAGO_HELPED'],
      ['Follow the crowd', 'p+2;r:T-6;f:FOLLOWED_HIERARCHY'],
    ],
  },
  versions: {
    date: '2027-03-01', t: 'The Rumour Has Two Versions',
    d: 'Two classmates tell incompatible versions of an argument. One version is more popular; the other includes details that do not fit the repeated story.',
    c: [
      ['Investigate both accounts', 'r:T+2;r:H+2;f:INVESTIGATED_RUMOUR;f:PEDAGO_HELPED'],
      ['Believe the popular student without checking', 'r:H+3;r:T-5;f:FOLLOWED_HIERARCHY'],
      ['Defend the less-popular student', 'r:T+6;p-1?.4;f:STOOD_UP;f:PEDAGO_HELPED'],
      ['Refuse to choose a side', 'f:STAYED_OUT'],
    ],
  },
  credit: {
    date: '2027-04-09', t: 'The Credit Grab',
    d: 'A classmate claims credit for shared work. Other students accept their version because they already have a better reputation.',
    c: [
      ['Talk to the classmate privately', 'r:T+2;f:PEDAGO_HELPED'],
      ['Challenge them publicly', 'r:T-4;g+2;p-1?.4'],
      ['Stay silent', 'f:STAYED_OUT'],
    ],
  },
  resurface: {
    date: '2027-04-19', t: 'The Rumour Resurfaces',
    d: 'A rumour from earlier in the year returns. Earlier actions change the dialogue.',
    c: [
      ['Own up to your part and apologize', 'r:T+8;p-1;f:PUBLIC_ACCOUNTABILITY;f:APOLOGIZED_SPECIFIC;f:PEDAGO_HELPED', 'GOSSIP'],
      ['Investigate it, using what you learned', 'r:T+3;f:INVESTIGATED_RUMOUR;f:PEDAGO_HELPED'],
      ['Pass it along again', 'gos+1;r:T-6?.55;p+1'],
      ['Disengage', ''],
    ],
  },
  birthday: {
    date: '2027-05-07', t: 'The Forgotten Birthday',
    d: 'A student realizes they were left off a gathering\'s invitation list. The exclusion may be an oversight or a status signal.',
    c: [
      ['Talk to them', 'r:T+3;f:PEDAGO_HELPED'],
      ['Hang out together', 'r:T+6;f:PEDAGO_HELPED', null, 'FRIEND'],
      ['Give a small gift ($4)', 'm-4;r:T+4;f:GIFT_GIVEN;f:PEDAGO_HELPED', null, 'M4'],
      ['Do nothing', ''],
    ],
  },
  invlist: {
    date: '2027-05-21', t: 'The Invitation List',
    d: 'A student notices they were left off a gathering\'s invitation list. It might be an oversight, or a signal about who belongs.',
    c: [
      ['Talk to them', 'r:T+3;f:PEDAGO_HELPED'],
      ['Hang out together', 'r:T+6;f:PEDAGO_HELPED', null, 'FRIEND'],
      ['Give a small gift ($4)', 'm-4;r:T+4;f:GIFT_GIVEN;f:PEDAGO_HELPED', null, 'M4'],
      ['Do nothing', ''],
    ],
  },
};
SPECIAL.showcase = {
  date: '2027-04-23', t: 'The School Cooking Showcase',
  d: 'The cafeteria has been turned into a tasting hall. Long tables, paper name cards, and a smell of butter and cinnamon that follows you down the hallway. Anyone can bring a dish, serve, or just taste.',
  c: [
    ['Serve Mom\'s signature dish at the tasting table', 'p+6;r:MOM+4;f:SERVED_SIGNATURE_DISH', 'COOKED_SIG'],
    ['Enter a dish you cooked yourself', 'p+3;f:ENTERED_COOKING_SHOWCASE', 'COOKED'],
    ['Volunteer to serve and clean up', 'r:T+3;f:HELPED_AT_SHOWCASE'],
    ['Watch from the back and taste a few dishes', ''],
  ],
};
SPECIAL.reveal = {
  date: 'meta', t: 'The Page Gets Thin',
  d: 'The journal falls open on its own. Under the faded ink a new line is forming, in a hand that is not quite MC\'s. “You found every scrap I left. Of course you did. You think you are MC, and MC has spent all year writing that they are not in control. That is because you are the one holding the pen. Hello, Player.”',
  c: [
    ['Say hello back', 'f:REVEAL_DONE;f:REVEAL_HELLO;r:PARENTS+2', null, null, 'The ink warms under your hand. Somewhere very close, MC lets out a long breath. “Thank you for saying it out loud.”'],
    ['Apologize to MC for every choice that was not kind', 'f:REVEAL_DONE;f:REVEAL_SORRY;p+1', null, null, '“You do not have to be perfect,” MC writes. “Just keep trying to be kind. I will do the rest.”'],
    ['Ask MC what they want', 'f:REVEAL_DONE;f:REVEAL_ASKED;g+1', null, null, '“Warm food. A weekend with no test,” MC writes. “And you, still showing up.”'],
    ['Keep playing as if nothing changed', 'f:REVEAL_DONE', null, null, 'The ink fades. Both of you pretend, for a little while, that nothing was said.'],
  ],
};
const SPECIAL_BY_DATE = {}; // date -> SPECIAL key
Object.keys(SPECIAL).forEach(k => SPECIAL_BY_DATE[SPECIAL[k].date] = k);

/* ---------- holidays ---------- */
// Shown on the first school day after a break (looked up by `ret`, the return date).
// The gift_* scenes (and knife) have no date: preDayEvent() triggers them when a family
// relationship reaches 100 (see GIFTS in "family bonds").
const HOLIDAYS = {
  labour: {
    date: '2026-09-07', ret: '2026-09-08', t: 'Labour Day Long Weekend',
    d: 'No school on Monday. After a first week of new faces and new rules, the long weekend feels like a deep breath.',
    c: [
      ['Spend the long weekend with your family', 'r:PARENTS+3;f:HOLIDAY_FAMILY'],
      ['Hang out with a classmate', 'r:T+4;f:HOLIDAY_FRIEND'],
      ['Do a few odd jobs for pocket money', 'm+7;f:HOLIDAY_WORK'],
      ['Rest and get ahead on your homework', 'g+1;f:HOLIDAY_REST'],
    ],
  },
  thanks: {
    date: '2026-10-12', ret: '2026-10-13', t: 'Thanksgiving Weekend',
    d: 'The house smells like roasted squash and cinnamon. Relatives are coming, and everyone has an opinion about where to sit.',
    c: [
      ['Help cook the big family dinner', 'r:PARENTS+4;f:HOLIDAY_FAMILY'],
      ['Bring a homemade dessert to a classmate', 'm-3;r:T+5;f:HOLIDAY_FRIEND'],
      ['Volunteer at the food bank', 'p+2;r:PARENTS+1;f:HOLIDAY_VOLUNTEER'],
      ['Slip away to scroll your phone all weekend', 'r:PARENTS-2;gos+1'],
    ],
  },
  winter: {
    date: '2026-12-21', ret: '2027-01-04', t: 'Winter Break',
    d: 'Two whole weeks of snow, lights and no alarm clock. Cards arrive in the mail, and relatives press a few bills into your hand.',
    c: [
      ['Celebrate with your family', 'm+10;r:PARENTS+5;f:HOLIDAY_FAMILY'],
      ['Plan a sleepover with a friend', 'r:T+6;f:HOLIDAY_FRIEND'],
      ['Shovel snow for the neighbours', 'm+9;p+1;f:HOLIDAY_WORK'],
      ['Read, draw and write in your journal', 'g+1;r:PARENTS+1;f:HOLIDAY_REST'],
    ],
  },
  spring: {
    date: '2027-02-27', ret: '2027-03-01', t: 'Spring Break',
    d: 'A whole week with no classes. The days are longer, the snow is going grey, and your phone will not stop buzzing.',
    c: [
      ['Take a short trip with your family', 'm-6;r:PARENTS+6;f:HOLIDAY_FAMILY'],
      ['Spend the week with friends', 'r:T+4;r:C+3;f:HOLIDAY_FRIEND'],
      ['Work every day you can', 'm+14;f:HOLIDAY_WORK'],
      ['Do absolutely nothing, on purpose', 'p+1;f:HOLIDAY_REST'],
    ],
  },
  easter: {
    date: '2027-03-26', ret: '2027-03-30', t: 'Easter Long Weekend',
    d: 'Four days off. There is chocolate on every table, and your family has already argued about the egg hunt rules.',
    c: [
      ['Join the family egg hunt', 'r:PARENTS+3;f:HOLIDAY_FAMILY'],
      ['Bake treats with a friend', 'm-3;r:T+5;f:HOLIDAY_FRIEND'],
      ['Sell handmade treats to the neighbours', 'm+6;f:HOLIDAY_WORK'],
      ['Catch up on sleep', 'g+1;f:HOLIDAY_REST'],
    ],
  },
  patriots: {
    date: '2027-05-24', ret: '2027-05-25', t: 'May Long Weekend',
    d: 'Summer is close enough to smell. Somebody on your street is already setting off fireworks, and the final project looms.',
    c: [
      ['Watch the fireworks with the neighbourhood', 'p+1;r:T+3;f:HOLIDAY_FRIEND'],
      ['Have a family picnic in the park', 'r:PARENTS+4;f:HOLIDAY_FAMILY'],
      ['Run a lemonade stand', 'm+7;p+1;f:HOLIDAY_WORK'],
      ['Plan your final project', 'g+1;f:HOLIDAY_REST'],
    ],
  },
  knife: {
    date: '', ret: '', t: 'Mom\'s Cooking Knife',
    d: 'Mom is waiting in the kitchen when you come downstairs. On the counter lies a folded cloth. “You have been in my kitchen since you could reach the counter,” she says. “A cook needs a good knife.” Inside is her own chef\'s knife, the one her mother gave her. It is for vegetables, bread and Sunday dinners, nothing else.',
    c: [
      ['Thank her and promise to take good care of it', 'r:MOM+3;f:RECEIVED_COOKING_KNIFE'],
      ['Ask her to teach you the signature dish right now', 'r:MOM+4;f:RECEIVED_COOKING_KNIFE;f:COOK_LESSON_WITH_MOM'],
      ['Make breakfast together', 'r:PARENTS+3;f:RECEIVED_COOKING_KNIFE'],
    ],
  },
  gift_dad: {
    date: '', ret: '', t: 'Dad\'s Toolbox',
    d: 'Dad is in the garage before school, sorting wrenches into a worn red toolbox. “I kept meaning to ask when you would be ready for this,” he says. “The first rule of fixing things is having the right tool.” He closes the lid and slides it across the workbench to you.',
    c: [
      ['Thank him and promise to take good care of it', 'r:DAD+3;f:RECEIVED_TOOLBOX'],
      ['Ask him to show you how to use it', 'r:DAD+4;f:RECEIVED_TOOLBOX'],
      ['Answer with your best dad joke', 'r:DAD+3;f:RECEIVED_TOOLBOX'],
    ],
  },
  gift_riley: {
    date: '', ret: '', t: 'Riley\'s Hidden Card',
    d: 'Riley is sitting on the stairs with her hands behind her back. “Close your eyes,” she says. “Okay. Now open.” In her hands is a card covered in stickers and glitter. On the front, in careful letters: Open this on a really hard day.',
    c: [
      ['Hug her tightly', 'r:RILEY+4;f:RECEIVED_HIDDEN_CARD'],
      ['Promise to open it only on a really hard day', 'r:RILEY+3;f:RECEIVED_HIDDEN_CARD'],
      ['Say you will make her a card back', 'r:RILEY+3;f:RECEIVED_HIDDEN_CARD'],
    ],
  },
  gift_max: {
    date: '', ret: '', t: 'Max\'s Lucky Controller',
    d: 'Max bursts into your room holding his favourite game controller, its buttons worn smooth. “You can have it,” he says, trying very hard to sound casual. “But only because you are second best. Second. Not first.”',
    c: [
      ['Promise to win the next game with it', 'r:MAX+3;f:RECEIVED_LUCKY_CONTROLLER'],
      ['Tell him you are honoured', 'r:MAX+4;f:RECEIVED_LUCKY_CONTROLLER'],
      ['Challenge him to a rematch right now', 'r:MAX+3;f:RECEIVED_LUCKY_CONTROLLER'],
    ],
  },
  gift_oliver: {
    date: '', ret: '', t: 'Oliver\'s Varsity Jacket',
    d: 'Oliver is waiting by the front door with his varsity jacket over one arm. “It is getting cold,” he says, in the voice he uses when he does not want to say something nice. “It is too big for you. Just do not lose it.”',
    c: [
      ['Put it on right away', 'r:OLIVER+3;p+4;f:RECEIVED_VARSITY_JACKET'],
      ['Say thanks and mean it', 'r:OLIVER+4;p+3;f:RECEIVED_VARSITY_JACKET'],
      ['Joke that it smells like gym socks', 'r:OLIVER+2;p+3;f:RECEIVED_VARSITY_JACKET'],
    ],
  },
  gift_sophie: {
    date: '', ret: '', t: 'Sophie\'s Planner',
    d: 'A leather-bound planner is waiting on your desk, a ribbon marking today. Inside are Sophie\'s neat notes: how she survived exams, which teachers like what, and what to do before a big test. “Do not tell anyone I am sentimental,” she says from the doorway.',
    c: [
      ['Promise to keep her secret', 'r:SOPHIE+3;f:RECEIVED_PLANNER'],
      ['Ask her to go through it with you', 'r:SOPHIE+4;f:RECEIVED_PLANNER'],
      ['Tease her gently about being sentimental', 'r:SOPHIE+3;f:RECEIVED_PLANNER'],
    ],
  },
};
const HOL_BY_RET = {}; // return date -> HOLIDAYS key ('' for the gift scenes)
Object.keys(HOLIDAYS).forEach(k => HOL_BY_RET[HOLIDAYS[k].ret] = k);

/* ---------- shop ---------- */
// SHOP = the items from data.js, then EXTRA, then EVENT_ITEMS; id = index in SHOP.
// kind: gift (give it) | prep (auto-used on the next study check) | use (useItem) | perm (owned
// forever, S.perm) | cosmetic (wear once for POP) | booster (spent on a hangout or lunch)
const SHOP = D.shop.map((s, i) => ({ id: i, n: s.name, price: s.price, note: s.effect }));
const SHOPKIND = { // name -> [kind, what it does]
  'Notebook & pen set': ['prep', 'Auto-used on your next study check: +10% to pass.'],
  'Sticker pack': ['gift', 'A small gift.'],
  'Snack': ['gift', 'Share it with someone (small gift).'],
  'Fancy snack box': ['gift', 'A bigger shared snack. Makes hangouts better.'],
  'Hair clips / accessory': ['cosmetic', 'Wear it: Popularity +1 (once).'],
  'Bracelet': ['cosmetic', 'Wear it for +1 Popularity, or give it as a thoughtful gift.'],
  'Sketchbook': ['perm', 'Permanent: Studying gives +1 extra Grade on art-ish days; unlocks a drawing hangout.'],
  'Used paperback': ['use', 'Read it: Grade +1. Also a gift for bookish kids.'],
  'Board game': ['perm', 'Permanent: group activities go better (+2 relationship).'],
  'Sports ball': ['perm', 'Permanent: unlocks "Play catch" hangouts (+2) and helps in team games.'],
  'Headphones': ['perm', 'Permanent: Studying gives +1 extra Grade.'],
  'Phone charm': ['cosmetic', 'Wear it: Popularity +1 (once). Also a gift.'],
  'Reusable water bottle': ['perm', 'Permanent: you get an extra time block every Monday.'],
  'Small plush': ['gift', 'A comforting gift.'],
  'Gift card': ['gift', 'Always a welcome gift.'],
  'Craft kit': ['use', 'Craft a handmade gift (flag: creative sharing).'],
  'Bicycle tune-up': ['use', 'Ride faster: an extra time block for the next 7 days.'],
  'Movie ticket': ['booster', 'Use it on a hangout: +2 relationship.'],
  'Café drink': ['booster', 'Use it on a hangout: +1 relationship.'],
  'Mystery box': ['use', 'Open it: a random harmless surprise.'],
};
// more items: [name, price, kind, note]
const EXTRA = [
  ['Study guide', 9, 'prep', 'Auto-used on your next study check: +20% to pass.'],
  ['Flashcards', 12, 'perm', 'Permanent: studying builds +15% prep instead of +10%.'],
  ['Calculator', 15, 'perm', 'Permanent: +5% on every study check.'],
  ['Tutoring session', 18, 'use', 'Use it: Grade +2 and +20% on your next study check.'],
  ['Lucky charm', 15, 'use', 'Use it: +10% on the next study check and -10% cheating risk once.'],
  ['Chocolate box', 9, 'gift', 'A sweet gift.'],
  ['Houseplant', 13, 'gift', 'A calm, thoughtful gift.'],
  ['Comic book', 8, 'gift', 'A fun gift for readers.'],
  ['Poster', 6, 'gift', 'A cheap but personal gift.'],
  ['Friendship bracelet kit', 11, 'use', 'Use it: makes 2 handmade gifts.'],
  ['Concert ticket', 22, 'booster', 'Use it on a hangout: +4 relationship.'],
  ['Lunch voucher', 7, 'booster', 'Use it on "Sit together at lunch": +2 relationship.'],
  ['Sunglasses', 14, 'cosmetic', 'Wear it: Popularity +1 (once).'],
  ['Hoodie', 26, 'cosmetic', 'Wear it: Popularity +2 (once).'],
  ['Stylish backpack', 30, 'cosmetic', 'Wear it: Popularity +2 (once).'],
  ['Smartwatch', 60, 'perm', 'Permanent: one extra time block every single day.'],
];
EXTRA.forEach(x => {
  SHOP.push({ id: SHOP.length, n: x[0], price: x[1], note: x[3] });
  SHOPKIND[x[0]] = [x[2], x[3]];
});
// shop items that stay locked until an event sets their flag: [name, price, kind, note, flag, hint]
const EVENT_ITEMS = [
  ['Club badge', 6, 'cosmetic', 'Wear it: Popularity +1 (once).', 'CLUB_MEMBER', 'Join a club at school.'],
  ['Lost-and-found scarf', 8, 'cosmetic', 'Wear it: Popularity +1 (once).', 'RETURNED_WALLET', 'Do the honest thing when you find something.'],
  ['Charity wristband', 5, 'gift', 'A small gift that says you care.', 'FUNDRAISER_IDEA', 'Help a fundraiser.'],
  ['Magnifying glass', 9, 'gift', 'A playful gift for curious people.', 'INVESTIGATED_RUMOUR', 'Check a rumour before you believe it.'],
  ['Friendship pin', 4, 'gift', 'A tiny pin for someone you include.', 'INCLUDED_SOMEONE', 'Include someone who was left out.'],
  ['Sorry card pack', 5, 'gift', 'Cards that help you say the hard thing.', 'APOLOGIZED_SPECIFIC', 'Apologise for something specific.'],
  ['Thank-you basket', 12, 'gift', 'A warm gift for someone who helped you.', 'PEDAGO_HELPED', 'Get help from a teacher.'],
  ['Holiday sweater', 18, 'cosmetic', 'Wear it: Popularity +1 (once).', 'HOLIDAY_FAMILY', 'Spend a holiday with your family.'],
  ['Volunteer tee', 12, 'cosmetic', 'Wear it: Popularity +1 (once).', 'HOLIDAY_VOLUNTEER', 'Volunteer during a break.'],
  ['Brave badge', 7, 'cosmetic', 'Wear it: Popularity +1 (once).', 'STOOD_UP', 'Stand up for someone.'],
  ['Fancy pen', 8, 'gift', 'A pen with a very faint ink.', 'CLUE_FOUND', 'Notice something strange.'],
  ['Pocket journal', 7, 'gift', 'A thoughtful gift for someone you advised.', 'GAVE_ADVICE', 'Give someone advice.'],
  ['Showcase apron', 15, 'cosmetic', 'Wear it: Popularity +1 (once).', 'HELPED_AT_SHOWCASE', 'Help at the cooking showcase.'],
  ['Group photo frame', 9, 'gift', 'A frame for a photo everyone is in.', 'INCLUSIVE_PHOTO', 'Make sure everyone is in the photo.'],
];
EVENT_ITEMS.forEach(x => {
  SHOP.push({ id: SHOP.length, n: x[0], price: x[1], note: x[3], flag: x[4], hint: x[5] });
  SHOPKIND[x[0]] = [x[2], x[3]];
});
SHOP.forEach(s => {
  const k = SHOPKIND[s.n] || ['gift', ''];
  s.kind = k[0];
  s.use = k[1];
});
const itemLocked = (S, it) => !!it.flag && !F(S, it.flag);
const SHOPBYNAME = {};
SHOP.forEach(s => SHOPBYNAME[s.n] = s);

/* ---------- jobs ---------- */
// pay in $, blocks = time blocks; optional g / p = grade / POP gained, fam = +2 with Mom and Dad,
// need = an item that is used up (or S.craftReady). Notes come from data.js.
const JOBS = [
  { n: "Water a neighbor's plants", pay: 6, blocks: 1, fx: 'p+0', gain: 'Kindness' },
  { n: 'Pet-sit for a familiar neighbor', pay: 10, blocks: 1 },
  { n: 'Organize books or supplies', pay: 8, blocks: 1, g: 1 },
  { n: 'Help at a supervised community sale', pay: 12, blocks: 2, p: 1 },
  { n: 'Tutor a younger student', pay: 10, blocks: 1, g: 1 },
  { n: 'Wash a family car with permission', pay: 8, blocks: 1, fam: 1 },
  { n: 'Help set up a school event', pay: 9, blocks: 2, p: 2 },
  { n: 'Help at a library reading event', pay: 5, blocks: 1, g: 1 },
  { n: 'Mow a lawn for a neighbor', pay: 11, blocks: 2 },
  { n: 'Bake-sale helper', pay: 7, blocks: 1, p: 1 },
  { n: 'Walk dogs after school', pay: 9, blocks: 1 },
  { n: 'Sell handmade crafts', pay: 14, blocks: 2, need: 'Craft kit' },
].map((j, i) => {
  const src = D.jobs[i];
  j.note = src ? src.note : '';
  j.id = i;
  return j;
});

/* ---------- interaction catalogue ---------- */
// cost = time blocks; daily = max uses per person per day; who / gate are descriptive only:
// the real checks are in interactionList().
const INTER = [
  { id: 'talk', n: 'Talk / ask about a topic', cost: 1, who: 'all' },
  { id: 'compliment', n: 'Give a compliment', cost: 0, who: 'all', daily: 1 },
  { id: 'gift', n: 'Give a gift', cost: 0, who: 'nokids_enemy', gate: 'rel>=-10' },
  { id: 'hangout', n: 'Hang out', cost: 1, who: 'friendly', gate: 'rel>=20' },
  { id: 'group', n: 'Invite to a group activity', cost: 1, who: 'friendly', gate: 'rel>=20' },
  { id: 'study', n: 'Study together', cost: 1, who: 'classmate_or_friendly', gate: 'kid|rel>=20' },
  { id: 'askhelp', n: 'Ask for help', cost: 0, who: 'all', daily: 1 },
  { id: 'askmoney', n: 'Ask for money', cost: 0, who: 'friendly_or_family', gate: 'rel>=20|fam' },
  { id: 'lend', n: 'Offer to lend money', cost: 0, who: 'friendly_or_family', gate: 'rel>=20|fam' },
  { id: 'share', n: 'Share a rumor', cost: 1, who: 'all' },
  { id: 'start', n: 'Start a rumor', cost: 1, who: 'all' },
  { id: 'investigate', n: 'Investigate a rumor', cost: 1, who: 'all' },
  { id: 'defend', n: 'Defend someone', cost: 1, who: 'all', daily: 1 },
  { id: 'apologize', n: 'Apologize', cost: 1, who: 'conflict', gate: 'rel<10' },
  { id: 'insult', n: 'Insult', cost: 0, who: 'all' },
  { id: 'debate', n: 'Debate / challenge', cost: 1, who: 'neutral_friendly', gate: 'rel>=-9' },
  { id: 'prank', n: 'Harmless prank', cost: 1, who: 'friendly', gate: 'rel>=20' },
  { id: 'fight', n: 'Fight / confrontation', cost: 1, who: 'enemy', gate: 'rel<=-40' },
  { id: 'boundary', n: 'Set a boundary', cost: 0, who: 'all' },
  { id: 'end', n: 'End conversation', cost: 0, who: 'all' },
  { id: 'reconcile', n: 'Try to reconcile', cost: 1, who: 'tense_enemy', gate: 'rel<=-10' },
  { id: 'talkabout', n: 'Talk about someone', cost: 1, who: 'all' },
  { id: 'secret', n: 'Share a secret', cost: 1, who: 'friendly', gate: 'rel>=20' },
  { id: 'advice', n: 'Ask for advice', cost: 0, who: 'all', daily: 1 },
  { id: 'lunch', n: 'Sit together at lunch', cost: 1, who: 'all' },
  { id: 'message', n: 'Send a message', cost: 0, who: 'all', daily: 1 },
  { id: 'tease', n: 'Tease playfully', cost: 0, who: 'friendly', gate: 'rel>=10' },
  { id: 'cheer', n: 'Cheer them up', cost: 1, who: 'all' },
  { id: 'collab', n: 'Work on a project together', cost: 1, who: 'classmate' },
  { id: 'joingroup', n: 'Ask to join their group', cost: 1, who: 'popular' },
];
const INTERBY = {}; // id -> INTER entry
INTER.forEach(i => INTERBY[i.id] = i);
// what you can do with a teacher; what you cannot do with family
const TEACHER_OK = new Set(['talk', 'compliment', 'askhelp', 'apologize', 'boundary', 'end', 'defend', 'advice', 'message']);
const FAMILY_NO = new Set(['start', 'fight', 'prank', 'study', 'group', 'debate', 'joingroup', 'lunch', 'collab']);

/* ---------- links / ripple ---------- */
// LINKS[name] = [[other, k], ...] in both directions. k > 0: friends (2+ = close), k < 0: they dislike each other.
const LINKS = {};
D.links.forEach(([a, b, k]) => {
  (LINKS[a] = LINKS[a] || []).push([b, k]);
  (LINKS[b] = LINKS[b] || []).push([a, k]);
});

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

/* ---------- the Player mystery ---------- */
// MC doubts that they are in control (THOUGHTS) and the family notices (NOTICE).
const REVEAL_AT = 9; // clues (across all runs, S.meta.clues) needed for the reveal scene
// 0: fewer than 3 clues, 1: 3-5, 2: 6 or more
const mystStage = S => {
  const n = (S.meta && S.meta.clues) || 0;
  return n >= 6 ? 2 : n >= 3 ? 1 : 0;
};
const THOUGHTS = [ // one list per stage
  [
    'I picked the kind answer. Funny, it did not feel like I picked it.',
    'Sometimes I know what I am about to do a second before I do it.',
    'Today felt like a story, and I was one sentence in it.',
    'I had the strangest feeling that someone was waiting to see what I would say.',
  ],
  [
    'I do not feel like I am in control.',
    'My hand moved before I decided. Is that normal?',
    'I keep noticing the edges of the page, as if the day were printed on paper.',
    'Someone is making these choices. I think I like them. I do not know who they are.',
  ],
  [
    'There is someone else here. Not in the room. Behind the page.',
    'If you are reading this: I am not afraid of you. I would just like to know your name.',
    'The faint writing in the margin is not mine. I am sure of it now.',
    'Whoever holds the pen, I am glad it is you.',
  ],
];
const THOUGHT_CHANCE = [0.05, 0.09, 0.14]; // chance of a thought after an event, by stage
// maybe returns one of MC's thoughts (also stored in S.th for the diary)
function mcThought(S) {
  const st = mystStage(S);
  if (rnd(S) >= THOUGHT_CHANCE[st]) return null;
  const t = pick(S, THOUGHTS[st]);
  S.th = S.th || {};
  S.th[dayOf(S).d] = t;
  return t;
}
// called by the UI each time a clue is found during this run
function noteStrange(S) { bump(S, 'strange'); }
const NOTICE_AT = [1, 3, 5, 7]; // S.strange thresholds for the 4 family "notice" scenes
// the 4 notice scenes; f = the family member's first name. Choice rows: [text, effects, reply]
const NOTICE = [
  { d: f => f + ' watches you over breakfast. “You stared at your journal for a really long time last night. Everything okay?”', c: [
    ['Say you just zoned out', '', f => f + ' nods, not quite convinced.'],
    ['Tell the truth: “Sometimes it feels like someone else is picking my words.”', 'r:T+4;f:TOLD_FAMILY', f => f + ' goes quiet. “Huh. Okay. If it happens again, tell me. I mean it.”'],
    ['Joke that you are just tired', 'r:T+1', f => f + ' laughs, but keeps watching you a second too long.'],
  ] },
  { d: f => f + ' knocks on your door. “You were whispering to the walls again. Quietly, but I heard it. Are you okay?”', c: [
    ['Say it was nothing', '', f => f + ' lets it go. For now.'],
    ['Ask: “Do you ever feel like you are not the one deciding?”', 'r:T+3;f:ASKED_FAMILY', f => '“Every day,” ' + f + ' admits. “Mostly about homework.” The smile fades. “Why? Did something happen?”'],
    ['Show them the faint writing', 'r:T+5;f:SHOWED_INK', f => f + ' leans in. “I cannot see anything.” A squint. “Wait. There is something. Very faint, like a pencil that forgot to push.”'],
  ] },
  { d: f => f + ' sets down a fork. “You have been different since the fall. Kinder, braver, stranger. I am not complaining.”', c: [
    ['Say thank you', 'r:T+2', f => f + ' squeezes your shoulder. “Just promise you will tell me if it gets too weird.”'],
    ['Say: “Maybe I am not alone in here.”', 'r:T+4;f:TOLD_FAMILY', f => '“Then I am glad someone is in there with you,” ' + f + ' says softly.'],
    ['Say you are just growing up', 'r:T+1', f => f + ' raises an eyebrow. “Sure. Growing up. That is what we will call it.”'],
  ] },
  { d: f => f + ' sits next to you and says nothing for a long while. Finally: “Whoever is reading over your shoulder: hi. Take care of this one.”', c: [
    ['Look up, startled', 'r:T+3;f:NOTICED_PLAYER', f => f + ' smiles at the ceiling as if someone were up there. “Yes. You. I see you.”'],
    ['Smile and say nothing', 'r:T+5;f:NOTICED_PLAYER', f => 'The room feels warmer for a moment, as if the whole house had turned to look.'],
    ['Ask who they are talking to', 'r:T+2', f => '“I do not know,” ' + f + ' says. “It just felt right to say.”'],
  ] },
];
function noticeEvent(S, p, ctx) {
  const ch = p.who;
  const f = ch.split(' ')[0];
  const n = NOTICE[Math.min(p.lvl || 0, NOTICE.length - 1)];
  return {
    kind: 'notice', title: f + ' notices something', desc: n.d(f), ctx,
    who: [{ role: 'With', names: [ch] }],
    choices: n.c.map((c, i) => ({ l: letter(i), x: c[0], fx: fxs(c[1]), say: c[2](f) })),
  };
}

/* ---------- NPC acts ---------- */
// People come to you in the evening: compliments, gifts, invitations, gossip, follow-ups.
// evening() decides when (NPC_CHANCE, NPC_GAP); npcPick() decides who and what; npcEvent() builds the scene.
const NPC_CHANCE = 0.17;  // chance per evening
const NPC_GAP = 2;        // minimum days between two NPC scenes
const NPC_COOLDOWN = 6;   // days before the same person comes to you again
const NPC_ITEMS = ['Snack', 'Sticker pack', 'Phone charm', 'Café drink', 'Used paperback']; // gifts from classmates
// what person n may do for (or about) you, by relationship
function npcActs(S, n) {
  const v = S.rel[n], c = CH[n], out = [];
  if (c.role === 'teach') {
    if (v >= 14) out.push('praise');
    return out;
  }
  const kid = c.role === 'kid';
  if (v >= 10) out.push('compliment');
  if (v >= 15 && kid) out.push('advice');
  if (v >= 15 && v < 60 && kid && S.loans.length < 2) out.push('borrow');
  if (v >= 25) out.push('gift');
  if (v >= 20 && kid) out.push('invite');
  if (v >= 45) out.push('kind');
  // gossip behind your back: someone cold you have already dealt with
  if (v <= 5 && kid && (v < 0 || S.last[n] != null)) out.push('gossip');
  return out;
}
// picks one { who, act } among everyone you know, or null
function npcPick(S) {
  if (globalThis.__NO_NPC) return null; // test switch
  S.cool2 = S.cool2 || {};
  const pairs = [];
  metOf(S, KIDS.concat(FAM, TEACH)).forEach(n => {
    if (S.cool2[n] != null && S.di - S.cool2[n] < NPC_COOLDOWN) return;
    npcActs(S, n).forEach(a => {
      // gossip only counts half the time (draws one number per gossip candidate)
      if (a !== 'gossip' || rnd(S) < 0.5) pairs.push({ who: n, act: a });
    });
  });
  if (!pairs.length) return null;
  const p = pick(S, pairs);
  S.cool2[p.who] = S.di;
  return p;
}
// the scene for an NPC act (p.act may also be a follow-up: 'apology' or 'echo')
function npcEvent(S, p, ctx) {
  const ch = p.who;
  const tch = CH[ch].role === 'teach';
  const fam = CH[ch].role === 'fam';
  // teachers by title and last name ("Ms. Ellis"), others by first name
  const f = tch ? ch.split(' ')[0] + ' ' + ch.split(' ').slice(-1)[0] : ch.split(' ')[0];
  const v = hash(ch + S.di + p.act); // picks the text variant
  const base = { kind: 'npc', ctx, who: [{ role: 'With', names: [ch] }] };
  // rows: [text, effects, extra choice fields]
  const mk = list => list.map((c, i) => Object.assign({ l: letter(i), x: c[0], fx: fxs(c[1]) }, c[2] || {}));
  let r, K;
  switch (p.act) {
    case 'compliment': {
      K = [
        f + ' stops you by the lockers. “I just wanted to say you are good at making people feel welcome.”',
        f + ' leans over in class and whispers. “Nice work today. I mean it.”',
        f + ' slides a sticky note onto your desk. It says: “You are funny when you are not even trying.”',
        f + ' catches your eye across the cafeteria. “Your laugh is contagious, you know that?”',
      ];
      const famLine = ch === 'Mom' ? 'Mom stops in your doorway. “I was thinking about how much you have grown this year. I am proud of you.”'
        : ch === 'Dad' ? 'Dad taps the table next to you. “You handled that well today. Not many people do.”'
        : f + ' knocks on your door. “Just so you know, you are not the worst. Not even close.”';
      r = { title: f + ' pays you a compliment', desc: fam ? famLine : K[v % K.length], choices: mk([
        ['Say thank you and mean it', 'r:T+3'],
        fam ? ['Give them a hug', 'r:T+4'] : ['Compliment them back', 'r:T+5'],
        ['Laugh it off and change the subject', 'r:T+1'],
        ['Wonder what they want', 'r:T-1'],
      ]) };
      break;
    }
    case 'gift': {
      if (ch === 'Dad') {
        r = { title: f + ' has a little surprise for you', desc: 'Dad presses a folded bill into your hand on his way out. “For something useful. Or something fun. Your call.”', choices: mk([
          ['Say thanks and mean it', 'm+5;r:T+3', { gave: '$5' }],
          ['Say thanks, but offer to do a chore for it', 'm+5;r:T+5', { gave: '$5' }],
          ['Politely refuse', 'r:T+1'],
        ]) };
        break;
      }
      const it = fam ? 'Snack' : NPC_ITEMS[v % NPC_ITEMS.length]; // family (Mom included) gives a snack
      const d = ch === 'Mom' ? 'Mom tucks a note into your lunch bag along with a snack. “Proud of you. Eat something green.”'
        : fam ? f + ' leaves a snack on your desk with a sticky note. “Do not skip lunch.”'
        : f + ' hands you a small paper bag. Inside is a ' + it.toLowerCase() + '. “I saw it and thought of you.”';
      r = { title: f + ' has a little surprise for you', desc: d, choices: mk([
        ['Accept it with a big thank-you', 'r:T+3', { get: it }],
        ['Accept it and give something back ($3)', 'm-3;r:T+6', { get: it }],
        ['Politely refuse', 'r:T-1'],
      ]) };
      break;
    }
    case 'invite':
      K = [
        f + ' asks if you want to hang out this weekend. Just the two of you, no plan.',
        f + ' says there is a new place everyone is talking about. “Come with me? I do not want to go alone.”',
      ];
      r = { title: f + ' wants to hang out', desc: K[v % K.length], choices: mk([
        ['Say yes', 'r:T+5;f:NPC_INVITED'],
        ['Suggest bringing a few friends', 'r:T+2'],
        ['Say maybe another time', 'r:T-1'],
      ]) };
      break;
    case 'kind':
      K = [
        'You pass an open classroom door and hear ' + f + ' talking about you. “They are one of the good ones. Honestly.”',
        'A classmate tells you ' + f + ' defended you when your name came up at lunch.',
      ];
      r = { title: 'You overhear ' + f, desc: K[v % K.length], choices: mk([
        ['Keep walking and smile to yourself', 'p+1'],
        ['Step in and say hi, pretending you did not hear', 'r:T+3'],
        ['Thank them later, quietly', 'r:T+4'],
      ]) };
      break;
    case 'apology': // follow-up, 3 days after you asked calmly about gossip
      r = { title: f + ' wants to make things right', desc: f + ' finds you after class. “I should not have said that about you. I am sorry.”', choices: mk([
        ['Accept the apology warmly', 'r:T+6;f:RECONCILE_TRIED'],
        ['Accept it, but keep some distance', 'r:T+2'],
        ['Say you are not ready yet', 'r:T-1'],
      ]) };
      break;
    case 'echo': // follow-up, 3 days after you answered gossip with something unkind
      r = { title: 'Your words travel', desc: 'Your comeback travelled fast. By lunch, half the class has heard what you said to ' + f + '.', choices: mk([
        ['Apologize to ' + f + ' in person', 'r:T+5;f:APOLOGIZED_SPECIFIC'],
        ['Double down', 'r:T-5;p-1;f:PUBLIC_JAB'],
        ['Stay quiet and hope it fades', 'r:T-1'],
      ]) };
      break;
    case 'advice':
      K = [
        f + ' asks what you would do. A close friend keeps leaving their messages on read.',
        f + ' sighs. “I cannot decide whether to try out for the team or keep my weekends free. What do you think?”',
        f + ' shows you a half-finished drawing. “Be honest. Is it any good?”',
      ];
      r = { title: f + ' asks for your advice', desc: K[v % K.length], choices: mk([
        ['Give honest, kind advice', 'r:T+4;f:GAVE_ADVICE'],
        ['Make a joke to lighten the mood', 'r:T+1'],
        ['Say you are not sure and ask more questions', 'r:T+3'],
      ]) };
      break;
    case 'borrow':
      r = { title: f + ' needs a small favour', desc: f + ' pats their pockets. “I forgot my lunch money. Could you lend me $5? I will pay you back.”', choices: mk([
        ['Lend $5', 'm-5;r:T+4', { loan: 5 }],
        ['Lend $2 only', 'm-2;r:T+2', { loan: 2 }],
        ['Say you are short on money', 'r:T-1'],
      ]) };
      break;
    case 'praise':
      r = { title: f + ' notices your effort', desc: f + ' hands back your work. “This was thoughtful. Keep going.”', choices: mk([
        ['Thank them and say you worked hard', 'r:T+3;g+1'],
        ['Ask for tips to improve', 'r:T+4;f:ASKED_FOR_HELP'],
        ['Smile and say nothing', 'r:T+1'],
      ]) };
      break;
    default: // 'gossip': word gets back to you
      K = [
        'A classmate pulls you aside. “' + f + ' has been telling people you think you are better than everyone.”',
        'You walk into the bathroom just as ' + f + ' stops talking. The silence says enough.',
        'A friend shows you a message where ' + f + ' jokes about your lunch.',
      ];
      r = { title: 'Word gets back to you about ' + f, desc: K[v % K.length], choices: mk([
        ['Ask ' + f + ' calmly about it', 'r:T+4;f:RECONCILE_TRIED', { follow: 'apology' }],
        ['Ask a friend what really happened', 'r:T+2;f:INVESTIGATED_RUMOUR', { check: 1 }],
        ['Let it go and stay kind', 'r:T+1;f:STAYED_OUT'],
        ['Say something unkind back', 'gos+1;r:T-6;p-1?.4', { follow: 'echo' }],
      ]) };
  }
  r.choices.forEach(o => needMoney(S, o, cost(o.fx)));
  return Object.assign(base, r);
}

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

/* ---------- building events ---------- */
const letter = i => 'ABCDEF'[i]; // choice letters A-F
// greys out a choice the player cannot pay for
function needMoney(S, o, need) { if (need > S.money) { o.disabled = true; o.why = 'Needs $' + need; } }
// a day context where `who` is the Target (T) of the event
function ctxFor(S, key, who) { const ctx = makeCtx(S, key, ''); ctx.T = who; return ctx; }
function describeRoles(S, ctx, fxList) {
  const seen = {}; const out = [];
  fxList.forEach(f => { if (f.t === 'rel' || f.who) { const k = roleKey(f.who); if (['TOP', 'MAYA', 'RIVAL'].includes(k) || seen[k]) return; seen[k] = 1; out.push({ role: ROLELABEL[k] || k, names: resolve(S, ctx, f.who) }); } });
  return out;
}
function allFx(c) { return [].concat(c.fx || [], c.pass || [], c.fail || [], c.ok || [], c.win || [], c.lose || []); }
function buildEvent(S) {
  const p = S.pend; if (!p) return null;
  if (p.kind === 'day') {
    const d = dayOf(S); introCheck(S, d); const ctx = makeCtx(S, 'd' + S.di, d.t);
    const choices = d.c.map((c, i) => decorate(S, c, ctx, i));
    const fxAll = [].concat(...d.c.map(allFx));
    const met = [];
    if (S.introDay === S.di && S.introWho) { if (meet(S, S.introWho)) logAdd(S, 'Met ' + S.introWho, [], 'sys'); met.push(S.introWho); }
    if (ctx.teacher && S.met) { if (meet(S, ctx.teacher)) logAdd(S, 'Met ' + ctx.teacher, [], 'sys'); }
    return { kind: 'day', title: d.t, desc: d.s, date: d.d, ctx, choices, who: describeRoles(S, ctx, fxAll), teacher: ctx.teacher, met };
  }
  if (p.kind === 'special') {
    const sp = SPECIAL[p.id]; const ctx = makeCtx(S, 'sp' + (p.id === 'tribunal2' ? 'tribunal' : p.id), '');
    if (p.id === 'tribunal2') ctx.T = (S.tribT || ctx.T);
    if (p.id === 'tribunal') S.tribT = ctx.T;
    const choices = sp.c.map((c, i) => {
      const o = { l: letter(i), x: c[0], fx: fxs(c[1]), special: true }; if (c[4]) o.say = c[4];
      if (c[2] && !F(S, c[2])) o.hide = true;
      if (c[3] === 'FRIEND' && S.rel[ctx.T] < 20) { o.disabled = true; o.why = 'Needs Friend (+20) with ' + ctx.T; }
      if (c[3] === 'M4' && S.money < 4) { o.disabled = true; o.why = 'Not enough money'; }
      return o;
    }).filter(o => !o.hide);
    return { kind: 'special', title: sp.t, desc: sp.d, date: sp.date === 'meta' ? dayOf(S).d : sp.date, ctx, choices, who: p.id === 'reveal' ? [] : [{ role: 'Involved', names: [ctx.T] }], pedago: p.id !== 'showcase' && p.id !== 'reveal' };
  }
  if (p.kind === 'holiday') {
    const h = HOLIDAYS[p.id]; const ctx = makeCtx(S, 'hol' + p.id, '');
    const choices = h.c.map((c, i) => { const o = { l: letter(i), x: c[0], fx: fxs(c[1]) }; needMoney(S, o, cost(o.fx)); return o; });
    return { kind: 'holiday', id: p.id, title: h.t, desc: h.d, date: h.date || dayOf(S).d, ctx, choices, who: GIFTS.some(g => g[0] === p.id) ? [] : [{ role: 'Involved', names: [ctx.T] }] };
  }
  if (p.kind === 'rand') {
    const e = RAND[p.i]; const ctx = makeCtx(S, 'r' + S.di + ':' + p.i, '');
    const choices = e.c.map((c, i) => decorate(S, c, ctx, i));
    return { kind: 'rand', title: e.t, desc: e.d, ctx, choices, who: describeRoles(S, ctx, [].concat(...e.c.map(allFx))), rand: true };
  }
  if (p.kind === 'ballinvite') {
    const ranked = knownRank(S, metKids(S)).slice(0, 5);
    const extra = metKids(S).filter(n => !ranked.includes(n)); const r = mul(hash(S.seed + 'ballx' + S.ballTry));
    const more = shuffle(extra, r).slice(0, 2);
    const names = ranked.concat(more);
    const choices = names.map((n, i) => ({ l: 'ABCDEFG'[i], x: 'Invite ' + n, who: n, ballinvite: true, chance: ballChance(S, n) }));
    choices.push({ l: 'ABCDEFG'[names.length], x: 'Go alone (no invitation)', alone: true });
    return { kind: 'ballinvite', title: 'Ball invitation', desc: 'The Sixth-Grade Last-Year Ball is on June 18. Who do you want to ask? A sincere invitation always helps a little, even when declined.' + (S.ballTry ? ' You can ask one more person.' : ''), ctx: makeCtx(S, 'ball', ''), choices, who: [] };
  }
  if (p.kind === 'ball') {
    const ev = ballScene(S, p.st || 0);
    ev.choices.forEach(c => { const w = c.dis || c.req; if (w) { c.disabled = true; c.why = w; } });
    return ev;
  }
  if (p.kind === 'personal') {
    return personalEvent(S, p, ctxFor(S, 'pe' + S.di + p.who, p.who));
  }
  if (p.kind === 'npc') return npcEvent(S, p, ctxFor(S, 'npc' + S.di + p.who, p.who));
  if (p.kind === 'notice') return noticeEvent(S, p, ctxFor(S, 'nt' + S.di + p.who, p.who));
  if (p.kind === 'birthday') {
    const ch = p.who; const ctx = ctxFor(S, 'bd' + ch, ch);
    const gifts = giftItems(S);
    const choices = [{ l: 'A', x: 'Wish them a happy birthday', fx: fxs('r:T+2;f:REMEMBERED_BIRTHDAY') }];
    if (S.money >= 4) choices.push({ l: 'B', x: 'Buy a small card and gift ($4)', fx: fxs('m-4;r:T+5;f:GIFT_GIVEN') });
    if (gifts.length) choices.push({ l: 'C', x: 'Give them something from your bag', gift: true });
    choices.push({ l: 'D', x: 'Say nothing', fx: fxs(S.rel[ch] >= 20 ? 'r:T-2' : '') });
    return { kind: 'birthday', title: ch + "'s birthday", desc: "It's " + ch + "'s birthday today (" + CH[ch].b + '). Do you do something?', ctx, choices, who: [{ role: 'Birthday', names: [ch] }] };
  }
  return null;
}
function decorate(S, c, ctx, i) {
  const o = Object.assign({}, c);
  o.l = c.l || letter(i);
  needMoney(S, o, cost(c.fx) + cost(c.ok) + cost(c.pass));
  if (/Attend with a close friend who accepted/.test(c.x || '') && !S.ballDate) { o.disabled = true; o.why = 'Nobody accepted your invitation'; }
  if (/^Spend \$15 on an outfit/.test(c.x || '') && S.money < 15) { o.disabled = true; o.why = 'Needs $15'; }
  if (c.sp === 'academic') o.hint = 'Study check ~' + acadChance(S) + '%';
  if (c.sp === 'cheat') o.hint = 'Risky: could be caught';
  if (c.sp === 'team') o.hint = 'Team game ~' + teamChance(S, ctx) + '% to win';
  return o;
}
function prepItem(S) { return (S.inv['Study guide'] > 0) ? ['Study guide', 20] : (S.inv['Notebook & pen set'] > 0) ? ['Notebook & pen set', 10] : null; }
function acadChance(S, extra) {
  const pi = prepItem(S);
  let prep = S.prep + (extra || 0) + (pi ? pi[1] : 0) + (S.perm['Calculator'] ? 5 : 0) + (S.luck ? 10 : 0);
  return clamp(Math.round(35 + S.grade / 2 + prep), 5, 95);
}
function hintsFor(S) { const pi = prepItem(S); return Math.min(3, Math.floor((S.prep + (pi ? pi[1] : 0)) / 10) + (S.perm['Calculator'] ? 1 : 0) + (S.perm['Max\'s lucky controller'] ? 1 : 0)); }
function teamChance(S, ctx) {
  const avg = ctx.TM.reduce((s, n) => s + S.rel[n], 0) / ctx.TM.length;
  return clamp(Math.round(40 + (S.pop - 50) / 5 + avg / 4 + (S.perm['Sports ball'] ? 4 : 0) + (S.perm['Oliver\'s varsity jacket'] ? 4 : 0)), 15, 85);
}
function ballChance(S, n) {
  const rel = S.rel[n];
  if (rel >= 60 && !F(S, 'FALLOUT')) return 95;
  let c = clamp(60 + rel, 5, 95);
  if (rel < 0 && !F(S, 'BALL_REPAIR') && !F(S, 'APOLOGIZED_SPECIFIC')) c = Math.min(c, 15);
  return c;
}

/* ---------- personal events ---------- */
function personalEvent(S, p, ctx) {
  const ch = p.who, v = S.rel[ch];
  { const tk = globalThis.TALK && globalThis.TALK.personal(S, p, ctx, fxs); if (tk) return tk; }
  if (p.mood === 'friendly') {
    const hobby = ['a poster', 'a short story', 'a science project', 'a playlist', 'a model craft', 'a comic', 'a dance routine', 'a recipe'];
    const what = hobby[hash(ch + S.di) % hobby.length];
    return { kind: 'personal', title: ch + ' asks for help', desc: ch + ' is working on ' + what + ' and asks if you can lend a hand. (Friendly event.)', ctx, who: [{ role: 'With', names: [ch] }], choices: [
      { l: 'A', x: 'Help out for a while (uses 1 time block)', fx: fxs('r:T+6'), block: 1 },
      { l: 'B', x: 'Offer quick tips', fx: fxs('r:T+3') },
      { l: 'C', x: 'Say you are busy today', fx: fxs('r:T-1') }] };
  }
  if (p.mood === 'tense') {
    return { kind: 'personal', title: 'A misunderstanding with ' + ch, desc: 'Something you said got twisted around, and ' + ch + ' is giving you the cold shoulder. (Tense event.)', ctx, who: [{ role: 'With', names: [ch] }], choices: [
      { l: 'A', x: 'Clear things up calmly', fx: fxs('r:T+7;f:RECONCILE_TRIED') },
      { l: 'B', x: 'Ignore it and hope it passes', fx: fxs('r:T-2;f:AVOIDED_REPAIR') },
      { l: 'C', x: 'Tell them they are overreacting', fx: fxs('r:T-5;p-1?.3') },
      { l: 'D', x: 'Calmly refuse to take the blame for something you did not do', fx: fxs('r:T+2;f:REFUSED_BLAME') }] };
  }
  return { kind: 'personal', title: ch + ' confronts you', desc: ch + ' blocks your path at your locker. The hallway goes quiet. (Enemy event.)', ctx, who: [{ role: 'With', names: [ch] }], choices: [
    { l: 'A', x: 'De-escalate and apologize', fx: fxs('r:T+8;f:APOLOGIZED_SPECIFIC;f:RECONCILE_TRIED') },
    { l: 'B', x: 'Stand your ground', fx: fxs('r:T-4;p+1?.5') },
    { l: 'C', x: 'Walk away', fx: fxs('r:T-1;f:AVOIDED_REPAIR') },
    { l: 'D', x: 'Argue back loudly', fx: fxs('r:T-7;p-2?.6;f:PUBLIC_JAB') }] };
}

/* ---------- choosing ---------- */
function result(chips, lines) { return { chips, lines: lines || [] }; }
function logAdd(S, text, chips, kind) {
  S.log.push({ d: dayOf(S).d, k: kind || 'ev', t: text, c: (chips || []).filter(c => c.k !== 'ripple').slice(0, 8) });
  if (S.log.length > 400) S.log.splice(0, S.log.length - 400);
}
function choose(S, idx, extra) {
  const ev = buildEvent(S); if (!ev) return null;
  const c = ev.choices[idx]; if (!c || c.disabled) return null;
  const ctx = ev.ctx; const ch = []; const lines = [];
  S.today.ev = 1;
  if (ev.kind === 'ballinvite') return chooseBall(S, c, ev);
  if (ev.kind === 'ball') return chooseBallScene(S, c, ev);
  // block cost for personal helps
  if (c.block) S.blocks = Math.max(0, S.blocks - c.block);
  if (c.gift && extra != null) { return giveGift(S, ctx.T, extra, ev, true); }
  if (c.say) lines.push(c.say);
  if (c.get) { S.inv[c.get] = (S.inv[c.get] || 0) + 1; lines.push('Received: ' + c.get + '.'); }
  if (c.get || c.gave) { S.giftFrom = S.giftFrom || {}; (S.giftFrom[ctx.T] = S.giftFrom[ctx.T] || []).push(c.get || c.gave); }
  if (c.follow) { (S.follow = S.follow || []).push({ who: ctx.T, act: c.follow, due: S.di + 3 }); }
  if (c.loan) { S.loans.push({ who: ctx.T, amt: c.loan, due: S.di + 7 }); lines.push('They promise to pay you back soon.'); }
  if (c.check) { if (rnd(S) < 0.6) { lines.push('Your friend says it was a misunderstanding.'); addRel(S, ctx.T, 3, ch); } else { lines.push('Your friend admits other people heard it too.'); addPop(S, -1, ch); } }
  if (c.secretDone) { S.secretDone = S.secretDone || {}; S.secretDone[ctx.T] = 1; }
  if (ev.kind === 'personal') { const fl = (c.fx || []).filter(f => f.t === 'flag').map(f => f.f); if (fl.includes('RECONCILE_TRIED') || fl.includes('REFUSED_BLAME')) { S.recon = S.recon || {}; S.recon[ctx.T] = (S.recon[ctx.T] || 0) + 1; } if (fl.includes('PUBLIC_JAB')) S.retal = (S.retal || 0) + 1; if (fl.includes('REFUSED_BLAME')) S.boundaryN = (S.boundaryN || 0) + 1; }
  if (c.hurt) { S.hurt = S.hurt || {}; S.hurt[ctx.T] = (S.hurt[ctx.T] || 0) + 1; }
  const ex = c.ex != null ? (rnd(S) < c.ex) : false;
  if (c.ex != null) lines.push(ex ? 'You were found out!' : 'Nobody noticed.');
  if (c.sp === 'academic') {
    const chance = acadChance(S);
    const pi = prepItem(S);
    if (pi) { S.inv[pi[0]]--; lines.push('Your ' + pi[0].toLowerCase() + ' helped.'); }
    S.prep = 0; S.luck = 0;
    const mg = extra && extra.mg;
    let ok;
    if (mg) { ok = mg.q >= 0.6; lines.push('Mini-game: ' + mg.label + (ok ? ' - passed.' : ' - not enough.')); }
    else { ok = rnd(S) * 100 < chance; lines.push(ok ? 'Study check passed (' + chance + '%).' : 'Study check failed (' + chance + '%).'); }
    if (mg && ok && mg.q >= 0.999) addGrade(S, 1, ch);
    applyFx(S, c.fx, ctx, ch, { exposed: ex });
    applyFx(S, ok ? c.pass : c.fail, ctx, ch, { exposed: ex });
  } else if (c.sp === 'cheat') {
    let chance = 25; const mods = [];
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
      S.caught++; setFlag(S, 'CAUGHT_CHEATING'); addGrade(S, -8, ch); addPop(S, -3, ch); addRel(S, ctx.teacher, -10, ch);
    } else applyFx(S, c.ok, ctx, ch);
  } else if (c.sp === 'team') {
    const chance = teamChance(S, ctx); const win = rnd(S) * 100 < chance;
    lines.push(win ? 'Your team won! (' + chance + '%)' : 'Your team lost. (' + chance + '%)');
    applyFx(S, c.fx, ctx, ch);
    applyFx(S, win ? c.win : c.lose, ctx, ch);
  } else {
    applyFx(S, c.fx, ctx, ch, { exposed: ex });
    if (ex) { S.caught++; }
  }
  if (ev.kind === 'holiday') { setFlag(S, 'HOL_' + S.pend.id); const gi = GIFTS.find(g => g[0] === S.pend.id); if (gi) S.perm[gi[2]] = 1; }
  if (ev.kind === 'rand') { S.lastRand = S.di; S.nrand++; }
  if (c.note && ev.kind === 'rand') lines.unshift(c.note);
  if (ev.pedago && ev.title.indexOf('Tribunal') >= 0 && S.pend.id === 'tribunal') S.tribT = ctx.T;
  const th = /^(day|rand|personal|npc|special|holiday|notice)$/.test(ev.kind) ? mcThought(S) : null;
  logAdd(S, ev.title + ' — ' + stripEnd(c.x), ch);
  finishEvent(S, ev);
  const res = result(ch, lines); if (th) res.thought = th;
  return res;
}
const stripEnd = s => String(s || '').replace(/[.\s]+$/, '');
/* ---------- ball invitation ---------- */
function chooseBall(S, c, ev) {
  const ch = []; const lines = [];
  S.ballTry++;
  if (c.alone) { setFlag(S, 'BALL_INVITED_DONE'); lines.push('You decide to go on your own terms.'); logAdd(S, 'Ball — going alone', []); S.ballDone = 1; }
  else {
    const n = c.who; const chance = ballChance(S, n);
    const ok = rnd(S) * 100 < chance; const rel = S.rel[n];
    addRel(S, n, 3, ch);
    if (ok) { S.ballDate = n; setFlag(S, 'BALL_INVITED_DONE'); S.ballDone = 1; addRel(S, n, rel >= 60 ? 5 : 2, ch); lines.push(n + ' said yes!'); logAdd(S, 'Ball — ' + n + ' accepted your invitation', ch); }
    else { lines.push(n + ' politely declined.'); logAdd(S, 'Ball — ' + n + ' declined', ch); if (S.ballTry >= 2) { setFlag(S, 'BALL_INVITED_DONE'); S.ballDone = 1; lines.push('Maybe you will go alone, or with friends.'); } }
  }
  if (S.ballDone || S.ballTry >= 2) { S.pend = { kind: 'day' }; S.phase = 'event'; }
  else { S.pend = { kind: 'ballinvite' }; S.phase = 'event'; }
  S.ballDone = 0;
  return result(ch, lines);
}
/* ---------- the Ball ---------- */
// A five-scene night (outfit, dance floor, rumour, photos, last dance) on BALL_DAY.
const BALL_STAGES = 5;
function ballFoe(S) { const lo = lowestKid(S); return S.rel[lo] < -10 ? lo : null; }
function ballFriend(S) { return S.ballDate || knownRank(S, metKids(S))[0]; }
function ballScene(S, st) {
  const ctx = makeCtx(S, 'ball' + st, ''); const fr = ballFriend(S); const foe = ballFoe(S);
  ctx.T = st === 2 ? (foe || ctx.T) : ctx.T;
  const dateTxt = S.ballDate ? S.ballDate + ' is with you tonight.' : 'You came without a date.';
  const mk = (title, desc, rows, who) => ({ kind: 'ball', st, title, desc, ctx, who: who || [], choices: rows.map((r, i) => Object.assign({ l: letter(i), x: r[0], fx: fxs(r[1] || '') }, r[2] || {})) });
  if (st === 0) {
    const lend = knownRank(S, metKids(S)).find(n => S.rel[n] >= 20);
    return mk('The Ball — What to wear', 'Ball night. The gym is full of paper lanterns and the smell of hairspray. Nobody should miss tonight over money, and everybody knows it. ' + dateTxt, [
      ['Buy a new outfit or accessory ($15)', 'm-15;p+1;f:BALL_OUTFIT_BOUGHT', { dis: S.money < 15 ? 'Needs $15' : null }],
      ['Wear something you already own, and own it', 'f:BALL_OWN_OUTFIT'],
      lend ? ['Borrow an outfit from ' + lend, 'r:' + lend + '+3;f:BALL_BORROWED'] : ['Borrow something from your sibling or parent', 'f:BALL_BORROWED'],
      ['Take something from the free swap table the parents set up', 'f:BALL_SWAP_TABLE'],
      ['Skip the outfit: help decorate and set up instead', 'r:G+3;f:BALL_BACKSTAGE;f:BALL_SETUP_HELP'],
    ]);
  }
  if (st === 1) {
    const other = ctx.T === fr ? ctx.C : ctx.T;
    return mk('The Ball — The dance floor', 'The music starts. Some people dance, some hover by the snack table, and a few stand at the edge pretending to read their phones. ' + dateTxt, [
      ['Ask ' + fr + ' to dance', '', { dance: fr }],
      ['Pull a shy classmate (' + other + ') into the group dance', 'r:' + other + '+6;p-1?.4;f:INCLUDED_SOMEONE;f:BALL_INCLUDED_ONE'],
      ['Request the song everybody knows and lead the floor', 'p+2;r:G+1;f:BALL_CROWD_PLEASER'],
      ['Hang by the snack table with friends', 'r:' + fr + '+3'],
      ['Stay near the wall and enjoy watching', 'f:BALL_WALLFLOWER'],
    ], [{ role: 'Around you', names: [fr, other] }]);
  }
  if (st === 2) {
    const T = ctx.T;
    return mk('The Ball — Whispers at the punch table', (foe ? foe + ' is across the room and the air feels tense. ' : '') + 'Someone starts a rumour about ' + T + ', and heads turn toward you to see what you will do.', [
      ['Add a juicy detail to the story', '', { gossip: T }],
      ['Shut it down: "That is not our business."', 'r:' + T + '+6;p-1?.4;f:STOOD_UP'],
      ['Blame someone else when the talk comes back to you', '', { blame: T }],
      ['Own your part in an old mess, in front of everyone', 'r:' + T + '+5;p-1;f:PUBLIC_ACCOUNTABILITY;f:APOLOGIZED_SPECIFIC', { req: (S.gossip > 0 || F(S, 'GOSSIP') || F(S, 'PUBLIC_JAB') || F(S, 'BLAME_SHIFT')) ? null : 'Needs an old mistake to own' }],
      ['Walk away from it', ''],
    ], [{ role: 'Rumour about', names: [T] }]);
  }
  if (st === 3) {
    const sp = knownRank(S, metKids(S)).slice(0, 3);
    return mk('The Ball — Photos and spotlight', 'The photographer waves everyone over, and the principal announces a Class Spirit award with a short speech. The spotlight swings around the room.', [
      ['Gather everyone for one big group photo', 'r:G+3;f:INCLUSIVE_PHOTO'],
      ['Pose only with the popular group', 'p+2;r:G-3;f:PHOTO_CLIQUE'],
      ['Accept the award and thank everyone by name', 'p+1;r:TOP+3;f:SHARED_SPOTLIGHT', { req: S.pop >= 55 || S.grade >= 75 ? null : 'Needs Pop 55 or Grade 75' }],
      ['Accept the award and take all the credit', 'p+3;r:G-5;f:STOLE_CREDIT', { req: S.pop >= 55 || S.grade >= 75 ? null : 'Needs Pop 55 or Grade 75' }],
      ['Skip the spotlight and support a friend quietly', 'r:' + sp[0] + '+4;f:QUIET_SUPPORT'],
    ]);
  }
  const hurt = Object.keys(S.hurt || {}).filter(n => S.hurt[n] > 0 && S.rel[n] < 30)[0] || foe;
  return mk('The Ball — Last dance', 'The lights dim. The last slow song fades. People drift to the coats. ' + (hurt ? hurt + ' is putting a coat on, alone.' : 'Everyone is putting coats on.'), [
    [hurt ? 'Apologize to ' + hurt + ' before leaving' : 'Thank the organizers before leaving', hurt ? 'r:' + hurt + '+8;f:APOLOGIZED_SPECIFIC;f:BALL_REPAIR;f:LAST_DAY_APOLOGY' : 'r:G+3', { appol: hurt }],
    ['Walk ' + ballFriend(S) + ' home and say thank you', 'r:' + ballFriend(S) + '+5'],
    ['Stay and help clean up the gym', 'r:G+3;f:BALL_CLEANUP;f:BALL_BACKSTAGE'],
    ['Smooth over what you said earlier and hide the contradictions', '', { hide: true }],
    ['Slip out quietly', ''],
  ]);
}
// lowers several relationships by v (negative) until `cap` points in total are lost; no ripple
function hitEach(S, names, v, cap, ch) {
  let tot = 0;
  names.forEach(n => { if (tot < cap) { addRel(S, n, v, ch, false, true); tot -= v; } });
}
function ballEnd(S) { S.pend = null; S.phase = 'free'; }
function chooseBallScene(S, c, ev) {
  const ch = [], lines = []; const ctx = ev.ctx;
  const witnesses = n => metKids(S).filter(k => k !== n && (S.rel[k] > 0 || (LINKS[n] || []).some(l => l[0] === k))).slice(0, 4);
  if (c.dance) {
    const n = c.dance; const chance = S.rel[n] >= 60 ? 95 : clamp(55 + S.rel[n], 10, 90);
    if (rnd(S) * 100 < chance) { addRel(S, n, 6, ch); addPop(S, 1, ch); setFlag(S, 'BALL_DANCE'); lines.push(n + ' laughed and took your hand. A song later you were both out of breath.'); }
    else { addRel(S, n, 1, ch); lines.push(n + ' smiled and said maybe the next one. No hard feelings.'); }
  } else if (c.gossip) {
    const T = c.gossip; applyFx(S, fxs('gos+1'), ctx, ch);
    if (rnd(S) < 0.55) {
      addRel(S, T, -10, ch);
      hitEach(S, (LINKS[T] || []).filter(l => l[1] >= 2 && CH[l[0]].role === 'kid').map(l => l[0]), -5, 30, ch);
      addPop(S, 2, ch); setFlag(S, 'GOSSIP'); lines.push('It reached ' + T + ' before the song ended. Close friends took sides.');
    } else { addPop(S, 1, ch); lines.push('The story fizzled. Nobody repeated it.'); }
  } else if (c.blame) {
    const T = c.blame; setFlag(S, 'BLAME_SHIFT');
    if (rnd(S) < 0.3) {
      addRel(S, T, -15, ch); hitEach(S, witnesses(T), -10, 30, ch);
      addPop(S, -3, ch); setFlag(S, 'HYPOCRISY'); lines.push('Someone had the screenshot. The blame bounced right back onto you.');
    } else { addPop(S, 1, ch); lines.push('The blame stuck to someone else. It feels worse than you expected.'); }
  } else if (c.hide) {
    if (rnd(S) < 0.5) { hitEach(S, witnesses(ev.ctx.T), -10, 80, ch); addPop(S, -2, ch); setFlag(S, 'HYPOCRISY'); lines.push('Two people compared notes. The versions did not match.'); }
    else lines.push('Nobody connected the dots tonight.');
  } else applyFx(S, c.fx, ctx, ch);
  if (c.appol) { S.apol = S.apol || {}; S.apol[c.appol] = (S.apol[c.appol] || 0) + 1; S.apolN = (S.apolN || 0) + 1; }
  logAdd(S, ev.title + ' — ' + stripEnd(c.x), ch);
  if (ev.st >= BALL_STAGES - 1) { ballEnd(S); }
  else { S.pend = { kind: 'ball', st: ev.st + 1 }; S.phase = 'event'; }
  return result(ch, lines);
}
/* ---------- after an event ---------- */
function finishEvent(S, ev) {
  if (S.over) { S.pend = null; return; }
  const k = ev.kind;
  if (k === 'day' || k === 'special') {
    if (k === 'special' && S.pend.id === 'tribunal') { S.pend = null; S.phase = 'free'; S.tribNext = 1; return; }
    S.pend = null; S.phase = 'free';
    if (k === 'day' && dayOf(S).d === BALL_DAY) { S.pend = { kind: 'ball', st: 0 }; S.phase = 'event'; }
  } else if (k === 'holiday') {
    S.pend = preDayEvent(S);
  } else if (k === 'rand' || k === 'personal' || k === 'birthday' || k === 'npc' || k === 'notice') {
    S.pend = null; advance(S);
  }
}

/* ---------- day flow ---------- */
function endDay(S) {
  if (S.phase !== 'free' || S.over) return null;
  // loans
  S.loans = S.loans.filter(l => {
    if (l.due > S.di) return true;
    if (rnd(S) < 0.85) { const ch = []; addMoney(S, l.amt, ch); addRel(S, l.who, 1, ch, true); logAdd(S, l.who + ' paid you back $' + l.amt, ch, 'sys'); }
    else { logAdd(S, l.who + ' still has not paid you back.', [], 'sys'); }
    return false;
  });
  // decay
  if (S.di % 7 === 6) KIDS.forEach(n => { if (S.rel[n] > 10 && S.di - (S.last[n] == null ? -99 : S.last[n]) > 14) S.rel[n]--; });
  if (S.bike > 0) S.bike--;
  if (S.pop <= 30) { S.lowStreak = (S.lowStreak || 0) + 1; S.lowMax = Math.max(S.lowMax || 0, S.lowStreak); } else S.lowStreak = 0;
  try { phoneIncoming(S); } catch (e) {}
  // evening event
  const evn = evening(S);
  if (evn) { S.pend = evn; S.phase = 'event'; return { evening: true }; }
  advance(S);
  return { evening: false };
}
// birthdays in data.js are written "March 14"
const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
function evening(S) {
  const d = dayOf(S); const next = DAYS[S.di + 1];
  if (!next) return null;
  // birthdays: any char whose birthday falls on the next school day or between
  const bdKey = (b) => { const [mo, dy] = b.split(' '); return [MONTH_NUM[mo], +dy]; };
  const a = new Date(d.d + 'T12:00:00Z'), b2 = new Date(next.d + 'T12:00:00Z');
  for (const c of D.chars) {
    if (c.role === 'teach') continue;
    const [mo, dy] = bdKey(c.b);
    for (let t = new Date(a.getTime() + 86400000); t <= b2; t = new Date(t.getTime() + 86400000)) {
      if (t.getUTCMonth() + 1 === mo && t.getUTCDate() === dy && (S.rel[c.n] >= 10 || c.role === 'fam') && !S.flags['BD_' + c.n + t.getUTCFullYear()]) { S.flags['BD_' + c.n + t.getUTCFullYear()] = 1; return { kind: 'birthday', who: c.n }; }
    }
  }
  // the family notices when you act strangely
  if (!d.brk && (S.noticed || 0) < NOTICE_AT.length && (S.strange || 0) >= NOTICE_AT[S.noticed || 0]) {
    const fam = FAM.slice().sort((a, b) => S.rel[b] - S.rel[a]); const who = fam[(S.noticed || 0) % fam.length];
    S.noticed = (S.noticed || 0) + 1; return { kind: 'notice', who, lvl: S.noticed - 1 };
  }
  // follow-ups to earlier scenes (an apology, an echo)
  { const fi = (S.follow || []).findIndex(x => x.due <= S.di); if (!d.brk && fi >= 0) { const x = S.follow.splice(fi, 1)[0]; S.lastNpc = S.di; return { kind: 'npc', who: x.who, act: x.act }; } }
  // someone does something for (or about) you
  if (!d.brk && S.di - (S.lastNpc == null ? -9 : S.lastNpc) >= 2 && rnd(S) < 0.17) { const np = npcPick(S); if (np) { S.lastNpc = S.di; return { kind: 'npc', who: np.who, act: np.act }; } }
  // random event
  if (S.di - S.lastRand >= 3 && rnd(S) < 0.3 && !d.brk) { return { kind: 'rand', i: Math.floor(rnd(S) * RAND.length) }; }
  // personal event
  if (rnd(S) < 0.2) {
    const okc = n => (S.cool[n] == null || S.di - S.cool[n] >= 3) && (S.rel[n] >= 20 || S.rel[n] <= -10);
    let cands = metKids(S).filter(okc); if (!cands.length || rnd(S) < 0.3) cands = cands.concat(FAM.filter(okc));
    if (rnd(S) < 0.18) cands = cands.concat(TEACH.filter(n => okc(n) || (S.rel[n] >= 14 && (S.cool[n] == null || S.di - S.cool[n] >= 6))));
    if (cands.length) {
      const n = pick(S, cands); S.cool[n] = S.di;
      const v = S.rel[n];
      S.secretDone = S.secretDone || {};
      if (v >= 40 && !S.secretDone[n] && globalThis.TALK && (globalThis.TALK.P[n] || (globalThis.TALK.FP[n] && globalThis.TALK.FP[n].s)) && rnd(S) < 0.4) return { kind: 'personal', who: n, mood: 'secret' };
      return { kind: 'personal', who: n, mood: (v >= 20 || (CH[n].role === 'teach' && v >= 14)) ? 'friendly' : v <= -40 ? 'enemy' : 'tense' };
    }
  }
  return null;
}
function advance(S) {
  S.today = {};
  if (S.di >= DAYS.length - 1) { finishYear(S); return; }
  S.di++;
  if (S.tribNext && DAYS[S.di].d >= '2026-11-20') { S.tribNext = 0; S.pend = { kind: 'special', id: 'tribunal2' }; }
  else S.pend = preDayEvent(S);
  S.phase = 'event';
  S.blocks = blocksFor(S); S.maxBlocks = S.blocks;
  if (DAYS[S.di].brk && S.pend.kind === 'day') S.pend = { kind: 'day' };
}
function finishYear(S) {
  S.pend = null;
  if (S.pop <= 0) { S.over = 'pop'; S.phase = 'over'; return; }
  S.ending = evaluateEnding(S); S.phase = 'ending';
}

/* ---------- free-time actions ---------- */
function spend(S, n) { if (S.blocks < n) return false; S.blocks -= n; return true; }
function study(S) {
  if (S.phase !== 'free') return null;
  if (!spend(S, 1)) return { err: 'No time blocks left.' };
  const ch = []; S.studies++;
  let g = 1 + (S.perm['Headphones'] ? 1 : 0);
  addGrade(S, g, ch);
  const pv = (S.perm['Flashcards'] ? 15 : 10) + (S.perm['Sophie\'s planner'] ? 5 : 0);
  S.prep = Math.min(40, S.prep + pv); setFlag(S, 'STUDIED');
  logAdd(S, 'Studied after school', ch);
  return result(ch, ['Next study check +' + pv + '%.']);
}
function work(S, id) {
  if (S.phase !== 'free') return null;
  const j = JOBS[id]; if (!j) return null;
  if (j.need && !(S.inv[j.need] > 0) && !S.craftReady) return { err: 'Needs a ' + j.need + ' (or handmade crafts).' };
  if (S.blocks < j.blocks) return { err: 'Not enough time blocks (needs ' + j.blocks + ').' };
  S.blocks -= j.blocks;
  const ch = []; let pay = j.pay + (S.perm['Dad\'s toolbox'] ? 2 : 0);
  if (rnd(S) < 0.15) { pay += 2; }
  addMoney(S, pay, ch);
  if (j.g) addGrade(S, j.g, ch);
  if (j.p) addPop(S, j.p, ch);
  if (j.fam) { addRel(S, 'Mom', 2, ch); addRel(S, 'Dad', 2, ch); }
  if (j.need && S.inv[j.need] > 0) S.inv[j.need]--;
  S.jobsDone++; setFlag(S, 'WORKED');
  logAdd(S, 'Worked: ' + j.n, ch);
  return result(ch, []);
}
function buy(S, id) {
  const it = SHOP[id]; if (!it) return null;
  if (itemLocked(S, it)) return { err: 'This item is still locked.' };
  if (S.money < it.price) return { err: 'Not enough money.' };
  if (it.kind === 'perm' && S.perm[it.n]) return { err: 'You already own this.' };
  const ch = []; addMoney(S, -it.price, ch);
  if (it.kind === 'perm') S.perm[it.n] = 1; else S.inv[it.n] = (S.inv[it.n] || 0) + 1;
  logAdd(S, 'Bought ' + it.n, ch, 'sys');
  return result(ch, []);
}
/* ---------- family bonds ---------- */
const GIFTS = [['knife', 'Mom', 'Cooking knife'], ['gift_dad', 'Dad', 'Dad\'s toolbox'], ['gift_riley', 'Riley', 'Riley\'s hidden card'], ['gift_max', 'Max', 'Max\'s lucky controller'], ['gift_oliver', 'Oliver', 'Oliver\'s varsity jacket'], ['gift_sophie', 'Sophie', 'Sophie\'s planner']];
const BONDS = {
  Dad: { item: 'Dad\'s toolbox', acts: [
    { id: 'flash', n: 'Hold the flashlight', cost: 0, need: 0, q: 1 },
    { id: 'bike', n: 'Fix a bike chain together', cost: 2, need: 25, q: 2 },
    { id: 'bird', n: 'Build a birdhouse', cost: 5, need: 50, q: 3, g: 1 },
    { id: 'pizza', n: 'Homemade pizza night', cost: 8, need: 75, q: 4, fam: 1 },
    { id: 'shelf', n: 'Build a bookshelf for your room', cost: 12, need: 100, q: 5, p: 1, item: 1 }] },
  Riley: { item: 'Riley\'s hidden card', acts: [
    { id: 'draw', n: 'Draw together', cost: 0, need: 0, q: 1 },
    { id: 'fort', n: 'Build a blanket fort', cost: 1, need: 25, q: 2 },
    { id: 'trick', n: 'Teach the pet a new trick', cost: 0, need: 50, q: 3 },
    { id: 'stickers', n: 'Decorate your school supplies with stickers', cost: 3, need: 75, q: 4, p: 1 },
    { id: 'cards', n: 'Make cards for the whole family', cost: 4, need: 100, q: 5, fam: 1, item: 1 }] },
  Max: { item: 'Max\'s lucky controller', acts: [
    { id: 'coop', n: 'Play a co-op game', cost: 0, need: 0, q: 1 },
    { id: 'dance', n: 'Learn his silly dance', cost: 0, need: 25, q: 2, p: 1 },
    { id: 'snack', n: 'Run a snack taste test', cost: 3, need: 50, q: 3 },
    { id: 'score', n: 'Chase his high score', cost: 0, need: 75, q: 4 },
    { id: 'tourney', n: 'Host a family game tournament', cost: 5, need: 100, q: 5, fam: 1, item: 1 }] },
  Oliver: { item: 'Oliver\'s varsity jacket', acts: [
    { id: 'walk', n: 'Walk to school together', cost: 0, need: 0, q: 1 },
    { id: 'hoops', n: 'Shoot hoops', cost: 0, need: 25, q: 2, p: 1 },
    { id: 'meal', n: 'Make a meal together', cost: 5, need: 50, q: 3 },
    { id: 'plan', n: 'Plan a game night', cost: 6, need: 75, q: 4, p: 1 },
    { id: 'game', n: 'Go to the big game together', cost: 10, need: 100, q: 5, p: 2, item: 1 }] },
  Sophie: { item: 'Sophie\'s planner', acts: [
    { id: 'hair', n: 'Try a hairstyle tutorial', cost: 0, need: 0, q: 1 },
    { id: 'room', n: 'Help with the room makeover', cost: 2, need: 25, q: 2 },
    { id: 'study', n: 'Study side by side', cost: 0, need: 50, q: 3, g: 1 },
    { id: 'talk', n: 'Have a late-night talk', cost: 2, need: 75, q: 4 },
    { id: 'term', n: 'Plan the whole term together', cost: 0, need: 100, q: 5, g: 1, item: 1 }] },
};
const bondOk = (S, who, a) => S.rel[who] >= a.need && (!a.item || !!S.perm[BONDS[who].item]);
function bond(S, who, aid) {
  if (S.phase !== 'free') return null;
  const B = BONDS[who]; if (!B) return null; const a = B.acts.find(x => x.id === aid); if (!a) return null;
  if (!bondOk(S, who, a)) return { err: 'You are not close enough for that yet.' };
  S.bondDay = S.bondDay || {};
  if (S.bondDay[who] === S.di) return { err: 'You already spent time together today.' };
  if (S.money < a.cost) return { err: 'Not enough money for that.' };
  if (S.blocks < 1) return { err: 'No time blocks left.' };
  const before = B.acts.filter(x => bondOk(S, who, x)).length;
  S.blocks -= 1; S.bondDay[who] = S.di; S.bondN = S.bondN || {}; S.bondN[who] = (S.bondN[who] || 0) + 1;
  const ch = []; if (a.cost) addMoney(S, -a.cost, ch);
  addRel(S, who, a.q, ch);
  if (a.g) addGrade(S, a.g, ch); if (a.p) addPop(S, a.p, ch);
  if (a.fam) ['Mom', 'Dad', 'Riley', 'Max', 'Oliver', 'Sophie'].filter(n => n !== who).forEach(n => addRel(S, n, 1, ch, true));
  setFlag(S, 'TIME_WITH_FAMILY');
  logAdd(S, 'Spent time with ' + who + ': ' + a.n, ch);
  const lines = ['You had a good time together.'];
  if (B.acts.filter(x => bondOk(S, who, x)).length > before) lines.push('A new activity with ' + who + ' is now unlocked.');
  return result(ch, lines);
}
/* ---------- cooking ---------- */
const RECIPES = [
  { id: 'eggs', n: 'Scrambled eggs', cost: 3, mom: 0, q: 1 },
  { id: 'pasta', n: 'Tomato pasta', cost: 6, mom: 25, q: 2 },
  { id: 'soup', n: 'Chicken soup', cost: 8, mom: 50, q: 3 },
  { id: 'stew', n: 'Slow-cooked stew', cost: 12, mom: 75, q: 4 },
  { id: 'sig', n: 'Mom\'s signature dish', cost: 15, mom: 100, q: 5, knife: 1 },
];
const cookLevel = S => Math.min(5, Math.floor((S.cookN || 0) / 3));
const cookPrice = (S, r) => Math.max(1, r.cost - (S.perm['Cooking knife'] ? 2 : 0));
const recipeOk = (S, r) => S.rel.Mom >= r.mom && (!r.knife || !!S.perm['Cooking knife']);
function cook(S, rid, who) {
  if (S.phase !== 'free') return null;
  const r = RECIPES.find(x => x.id === rid); if (!r) return null;
  if (who !== 'self' && who !== 'family' && !(CH[who] && CH[who].role === 'kid')) return null;
  if (!recipeOk(S, r)) return { err: 'Mom has not taught you this recipe yet.' };
  S.cookDay = S.cookDay || {};
  if (S.cookDay[who] === S.di) return { err: 'You already cooked for them today.' };
  const price = cookPrice(S, r);
  if (S.money < price) return { err: 'Not enough money for the ingredients.' };
  if (S.blocks < 1) return { err: 'No time blocks left.' };
  S.blocks -= 1; S.cookDay[who] = S.di;
  const ch = []; addMoney(S, -price, ch);
  const lvl = cookLevel(S); const burnt = rnd(S) < (S.perm['Cooking knife'] ? 0.04 : Math.max(0.04, 0.3 - 0.06 * lvl));
  S.cookN = (S.cookN || 0) + 1; const v = burnt ? 1 : r.q + (lvl >= 3 ? 1 : 0);
  if (who === 'self') { if (!burnt) addGrade(S, 1, ch); }
  else if (who === 'family') { addRel(S, 'Mom', v, ch); addRel(S, 'Dad', v, ch); }
  else addRel(S, who, v, ch);
  setFlag(S, 'COOKED'); if (r.id === 'sig') setFlag(S, 'COOKED_SIG'); if (burnt) setFlag(S, 'COOKED_BURNT');
  logAdd(S, 'Cooked ' + r.n + ' for ' + (who === 'self' ? 'myself' : who === 'family' ? 'the family' : who), ch);
  const lines = [burnt ? 'It burned a little, but it still got eaten.' : 'It turned out well.'];
  if (S.cookN % 3 === 0 && cookLevel(S) <= 5) lines.push('Your cooking is getting better.');
  return result(ch, lines);
}
/* ---------- items and gifts ---------- */
function giftItems(S) {
  const out = [];
  SHOP.forEach(it => { if (!['gift', 'cosmetic', 'use'].includes(it.kind)) return; if (['Mystery box', 'Bicycle tune-up', 'Craft kit', 'Tutoring session', 'Lucky charm', 'Friendship bracelet kit'].includes(it.n)) return; if ((S.inv[it.n] || 0) > 0) out.push(it); });
  if (S.inv['Handmade gift'] > 0) out.push({ n: 'Handmade gift', id: 'hm', kind: 'gift' });
  return out;
}
function useItem(S, name) {
  const it = SHOPBYNAME[name]; if (!it || !(S.inv[name] > 0)) return { err: 'You do not have that.' };
  const ch = []; const lines = [];
  if (name === 'Used paperback') { S.inv[name]--; addGrade(S, 1, ch); setFlag(S, 'BOOK_BOND'); lines.push('You read it cover to cover.'); }
  else if (name === 'Craft kit') { S.inv[name]--; S.inv['Handmade gift'] = (S.inv['Handmade gift'] || 0) + 1; setFlag(S, 'CREATIVE_SHARE'); lines.push('You made a handmade gift.'); }
  else if (name === 'Bicycle tune-up') { S.inv[name]--; S.bike = 7; S.blocks++; S.maxBlocks++; lines.push('Extra time block for 7 days.'); }
  else if (name === 'Tutoring session') { S.inv[name]--; addGrade(S, 2, ch); S.prep = Math.min(40, S.prep + 20); setFlag(S, 'ASKED_FOR_HELP'); lines.push('A tutor walks you through the tricky parts.'); }
  else if (name === 'Lucky charm') { S.inv[name]--; S.luck = 1; lines.push('You feel a little luckier.'); }
  else if (name === 'Friendship bracelet kit') { S.inv[name]--; S.inv['Handmade gift'] = (S.inv['Handmade gift'] || 0) + 2; setFlag(S, 'CREATIVE_SHARE'); lines.push('You made two handmade bracelets.'); }
  else if (name === 'Mystery box') {
    S.inv[name]--; const r = rnd(S);
    if (r < 0.35) { const m = ri(S, 3, 15); addMoney(S, m, ch); lines.push('Inside: $' + m + '.'); }
    else if (r < 0.75) { const g = pick(S, ['Sticker pack', 'Snack', 'Phone charm', 'Café drink', 'Used paperback']); S.inv[g] = (S.inv[g] || 0) + 1; lines.push('Inside: ' + g + '.'); }
    else { addPop(S, 1, ch); lines.push('Inside: a cool collectible. You show it off.'); }
  } else if (it.kind === 'cosmetic') {
    if (S.worn[name]) return { err: 'Already wearing it.' };
    S.worn[name] = 1; addPop(S, ({ Hoodie: 2, 'Stylish backpack': 2 })[name] || 1, ch); lines.push('You look sharp.');
  } else return { err: 'Use it in a gift or a hangout.' };
  logAdd(S, 'Used ' + name, ch, 'sys');
  return result(ch, lines);
}
function likeScore(name, item) { return hash(name + '|' + item) % 3; } // 0 meh, 1 ok, 2 loves
function giveGift(S, name, item, ev, fromEvent) {
  if (!(S.inv[item] > 0)) return { err: 'You do not have that.' };
  const ch = []; const c = CH[name];
  S.inv[item]--;
  let g = 1 + likeScore(name, item) + (item === 'Gift card' ? 2 : item === 'Handmade gift' ? 2 : 0) + (c.ap >= 4 ? 0 : 0);
  if (item === 'Handmade gift' || item === 'Small plush') g += 1;
  g = clamp(g, 1, 5);
  addRel(S, name, g, ch); setFlag(S, 'GIFT_GIVEN'); S.last[name] = S.di; S.giftN = (S.giftN || 0) + 1; (S.giftTo = S.giftTo || {})[name] = 1;
  logAdd(S, 'Gave ' + item + ' to ' + name, ch);
  const gq = globalThis.TALK && globalThis.TALK.say(name, c.role, S.rel[name] - g, 'gift', hash(name + item + S.di));
  const lines = (gq ? [gq] : []).concat([likeScore(name, item) === 2 ? name + ' loves it!' : likeScore(name, item) === 0 ? name + ' smiles politely.' : name + ' says thanks.']);
  if (fromEvent) finishEvent(S, ev);
  return result(ch, lines);
}

/* ---------- interactions ---------- */
function interactionList(S, name) {
  const c = CH[name]; const v = S.rel[name];
  const out = [];
  INTER.forEach(it => {
    if (c.role === 'teach' && !TEACHER_OK.has(it.id)) return;
    if (c.role === 'fam' && FAMILY_NO.has(it.id)) return;
    let ok = true, why = '';
    switch (it.id) {
      case 'gift': if (v < -10) { ok = false; why = 'They will not accept gifts right now.'; } else if (!giftItems(S).length) { ok = false; why = 'You have nothing to give. Visit the shop.'; } break;
      case 'hangout': case 'group': case 'prank': if (v < 20) { ok = false; why = 'Needs Friend (+20).'; } break;
      case 'study': if (c.role !== 'kid' && v < 20) { ok = false; why = 'Classmates or friends only.'; } break;
      case 'askmoney': case 'lend': if (!(v >= 20 || c.role === 'fam')) { ok = false; why = 'Needs Friend (+20) or family.'; } if (it.id === 'lend' && S.money < 5) { ok = false; why = 'You need at least $5.'; } break;
      case 'apologize': if (v >= 10) { ok = false; why = 'No conflict to apologize for.'; } break;
      case 'debate': if (v < -9) { ok = false; why = 'Too tense for a friendly debate.'; } break;
      case 'fight': if (v > -40) { ok = false; why = 'Only with high conflict (-40).'; } break;
      case 'secret': if (v < 20) { ok = false; why = 'Needs Friend (+20).'; } break;
      case 'tease': if (v < 10) { ok = false; why = 'Needs a warm relationship (+10).'; } break;
      case 'advice': case 'cheer': if (v < -20) { ok = false; why = 'Too much conflict right now.'; } break;
      case 'collab': if (v < 5) { ok = false; why = 'Needs a little rapport (+5).'; } break;
      case 'joingroup': if (!(c.pop >= 60)) { ok = false; why = 'Only popular groups (their POP 60+).'; } else if (v < 0) { ok = false; why = 'They need to like you first.'; } break;
      case 'reconcile': if (v > -10) { ok = false; why = 'Only when tense or enemies.'; } break;
    }
    if (!S._ph && it.cost > S.blocks && ok) { ok = false; why = 'No time blocks left.'; }
    if (it.daily && (S.today['i_' + name + it.id] || 0) >= it.daily && ok) { ok = false; why = 'Already done today.'; }
    if (S.phase !== 'free') { ok = false; why = 'Not now.'; }
    out.push({ id: it.id, n: it.n, cost: it.cost, ok, why });
  });
  return out;
}
const todayN = (S, k) => S.today[k] || 0;
function diminish(S, name, id) { const k = 'g_' + name + id; const n = S.today[k] || 0; S.today[k] = n + 1; return n === 0 ? 1 : n === 1 ? 0.5 : 0; }
function interact(S, name, id, arg) {
  if (!isMet(S, name)) return { err: 'You have not met them yet.' };
  if (S.phase !== 'free') return { err: 'Not now.' };
  const it = INTERBY[id]; const c = CH[name]; if (!it || !c) return null;
  const list = interactionList(S, name).find(x => x.id === id);
  if (!list || !list.ok) return { err: list ? list.why : 'Not available.' };
  const ch = []; const lines = []; const v = S.rel[name]; const ctx = makeCtx(S, 'i' + S.di + name + id, '');
  S.ih = S.ih || {}; S.hurt = S.hurt || {}; S.giftTo = S.giftTo || {};
  const IH = (S.ih[name] = S.ih[name] || {}); IH[id] = (IH[id] || 0) + 1;
  if (it.cost && !S._ph) S.blocks -= it.cost;
  S.today['i_' + name + id] = (S.today['i_' + name + id] || 0) + 1;
  if (id !== 'end' && id !== 'boundary') S.last[name] = S.di;
  const dm = diminish(S, name, id);
  const damp = clamp(1 - Math.max(0, v) / 110, 0.3, 1);
  const scale = x => dm <= 0 ? 0 : Math.max(1, pround(S, x * dm * damp * (S._ph ? 0.7 : 1)));
  let logt = it.n + ' — ' + name;
  switch (id) {
    case 'talk': {
      const topic = arg || 'school';
      let g = ri(S, 0, 2) + (c.ap >= 4 && rnd(S) < 0.5 ? 1 : 0) - (c.ap <= 2 && v < 10 ? 1 : 0);
      if (v >= 40) { g = 0; lines.push('Talking only gets you so far. Hang out for a closer bond.'); }
      if (rnd(S) < 0.4) { g += 1; lines.push('You discover a shared interest.'); }
      if (topic === 'rumor') {
        const idx = c.rum.findIndex((r, i) => !(S.heard[name] || []).includes(i));
        if (idx >= 0) { (S.heard[name] = S.heard[name] || []).push(idx); lines.push('You hear something: "' + c.rum[idx][1] + '"'); }
        else lines.push('Nothing new to hear about them.');
        g = Math.max(0, g - 1);
      } else lines.push(name + ' chats about ' + (topic === 'hobbies' ? 'hobbies' : topic === 'daily' ? 'daily life' : 'school') + '.');
      if (v < -30 && rnd(S) < 0.5) { g = 0; lines.push(name + ' barely answers you.'); }
      addRel(S, name, scale(g), ch); break;
    }
    case 'compliment': {
      if (v < -30 && rnd(S) < 0.5) { lines.push(name + ' does not believe you.'); }
      else addRel(S, name, 2, ch); break;
    }
    case 'gift': return giveGift(S, name, arg);
    case 'hangout': {
      let g = ri(S, 3, 6); let money = 0; const bits = [];
      if (arg === 'Movie ticket' && S.inv['Movie ticket'] > 0) { S.inv['Movie ticket']--; g += 2; bits.push('movie'); }
      else if (arg === 'Café drink' && S.inv['Café drink'] > 0) { S.inv['Café drink']--; g += 1; bits.push('café'); }
      else if (arg === 'Fancy snack box' && S.inv['Fancy snack box'] > 0) { S.inv['Fancy snack box']--; g += 2; bits.push('snacks'); }
      else if (arg === 'Concert ticket' && S.inv['Concert ticket'] > 0) { S.inv['Concert ticket']--; g += 4; bits.push('concert'); }
      else if (arg === 'Sports ball' && S.perm['Sports ball']) { g += 2; bits.push('catch'); }
      else if (arg === 'Sketchbook' && S.perm['Sketchbook']) { g += 2; bits.push('drawing'); }
      else { S.freeActs++; }
      if (c.role === 'kid' && c.pop > 85 && g > 5 && rnd(S) < 0.4) addPop(S, 1, ch);
      addRel(S, name, scale(g), ch); lines.push('You and ' + name + ' hang out' + (bits.length ? ' (' + bits.join(', ') + ')' : '') + '.'); break;
    }
    case 'group': {
      let g = ri(S, 2, 4) + (S.perm['Board game'] ? 2 : 0);
      const ok = rnd(S) * 100 < clamp(55 + v / 2, 20, 90);
      if (!ok) { lines.push('Schedules did not line up.'); g = 1; }
      else { lines.push('A fun group activity!'); const others = shuffle(metKids(S).filter(n => n !== name && S.rel[n] > -10), mul(hash(S.seed + 'g' + S.di + name))).slice(0, 2); others.forEach(o => addRel(S, o, 1, ch, false, true)); if (rnd(S) < 0.4) addPop(S, 1, ch); S.freeActs++; }
      addRel(S, name, scale(g), ch); break;
    }
    case 'study': {
      const ok = rnd(S) < 0.7; addGrade(S, rnd(S) < 0.6 ? 1 : 0, ch); S.prep = Math.min(30, S.prep + 5); setFlag(S, 'STUDIED');
      if (ok) { addRel(S, name, 2, ch); lines.push('It went well.'); } else lines.push('Mostly off-topic, but you got something done.'); break;
    }
    case 'askhelp': {
      const ok = rnd(S) * 100 < clamp(40 + v / 2 + (c.ap - 3) * 5, 10, 90);
      if (ok) { setFlag(S, 'ASKED_FOR_HELP'); S.prep = Math.min(30, S.prep + 10); addRel(S, name, 1, ch); lines.push(name + ' helps. Next study check +10%.'); }
      else { addRel(S, name, -1, ch); lines.push(name + ' cannot help right now.'); } break;
    }
    case 'askmoney': {
      const n = S.asks[name] = (S.asks[name] || 0) + 1;
      const ok = c.mo > 5 && rnd(S) < Math.max(0.15, 0.8 - 0.2 * (n - 1));
      if (ok) { const amt = clamp(Math.round(c.mo / 12) + ri(S, 0, 4), 1, 20); addMoney(S, amt, ch); lines.push(name + ' hands you $' + amt + '.'); if (n >= 3) addRel(S, name, -2, ch); }
      else { addRel(S, name, -2, ch); lines.push(name + ' says no. Asking again and again costs trust.'); }
      break;
    }
    case 'lend': {
      const amt = +arg || 5; if (S.money < amt) return { err: 'Not enough money.' };
      addMoney(S, -amt, ch); addRel(S, name, 2, ch); S.loans.push({ who: name, amt, due: S.di + 6 }); lines.push('They promise to pay you back soon.'); break;
    }
    case 'share': {
      const idx = +arg; const r = c.rum[idx]; if (!r) { S.blocks += it.cost; return { err: 'Pick a rumor.' }; }
      shareRumor(S, name, r, ch, lines, false); break;
    }
    case 'start': {
      S.hurt[name] = (S.hurt[name] || 0) + 1;
      lines.push('You invent a story about ' + name + '.');
      S.started++; setFlag(S, 'STARTED_RUMOR'); addPop(S, 2, ch); addGossip(S, 1, ch);
      if (v >= 15) setFlag(S, 'HYPOCRISY');
      const reach = rumorReach(S, name, 0, 85);
      if (rnd(S) * 100 < reach) {
        addRel(S, name, -ri(S, 8, 15), ch); lines.push('It reaches ' + name + '.');
        if (rnd(S) < 0.4) { addPop(S, -ri(S, 5, 15), ch); setFlag(S, 'RUMOR_DISPROVEN'); S.caught++; lines.push('The story falls apart and people know it was you.'); }
      } break;
    }
    case 'investigate': {
      const idx = arg != null ? +arg : 0; const r = c.rum[idx] || c.rum[0];
      setFlag(S, 'INVESTIGATED_RUMOUR');
      const truth = hash(name + idx) % 100 < (r[0] === 'neg' ? 35 : 80);
      lines.push(truth ? 'After checking, it seems to be true.' : 'You find no evidence at all: the rumor looks false.');
      S.investN = (S.investN || 0) + 1; if (!truth) S.corrected = (S.corrected || 0) + 1;
      if (!truth) { addRel(S, name, 3, ch); if (r[0] === 'neg') addPop(S, 1, ch); }
      else addRel(S, name, 1, ch);
      break;
    }
    case 'defend': {
      addRel(S, name, ri(S, 2, 4), ch); setFlag(S, 'STOOD_UP');
      if (rnd(S) < 0.35 && c.pop < 50) addPop(S, -1, ch);
      lines.push('You speak up for ' + name + '.'); break;
    }
    case 'apologize': {
      const base = Math.max(1, ri(S, 2, 6) + (arg === 'specific' ? 3 : 0) - (S._ph ? 2 : 0));
      S.apol[name] = (S.apol[name] || 0) + 1; S.apolN = (S.apolN || 0) + 1; if (arg === 'specific') setFlag(S, 'APOLOGIZED_SPECIFIC'); else S.vague = (S.vague || 0) + 1;
      addRel(S, name, base, ch); if (S.rel[name] >= -10) S.accepted = (S.accepted || 0) + 1; else S.refused = (S.refused || 0) + 1; lines.push('You name exactly what you did and say sorry.'); break;
    }
    case 'insult': {
      S.hurt[name] = (S.hurt[name] || 0) + 1;
      addRel(S, name, -ri(S, 3, 10), ch); setFlag(S, 'PUBLIC_JAB');
      if (rnd(S) < 0.3) { addPop(S, -1, ch); lines.push('It turns into an argument.'); } else if (c.pop < 30 && rnd(S) < 0.4) { addPop(S, 1, ch); } break;
    }
    case 'debate': {
      if (v >= 0 || rnd(S) < 0.5) { addRel(S, name, ri(S, 2, 4), ch); lines.push('A respectful debate builds respect.'); } else { addRel(S, name, -2, ch); lines.push('It got a little heated.'); } break;
    }
    case 'prank': {
      if (rnd(S) < 0.7) { addRel(S, name, 3, ch); addPop(S, 1, ch); lines.push('They laugh. Harmless and reversible.'); setFlag(S, 'HARMLESS_JOKE'); }
      else { addRel(S, name, -2, ch); lines.push('The joke flopped.'); } break;
    }
    case 'fight': {
      if (arg === 'deescalate') { if (rnd(S) < 0.6) { addRel(S, name, 5, ch); lines.push('You calm things down.'); setFlag(S, 'DEESCALATED'); } else { addRel(S, name, -2, ch); lines.push('They were not ready to listen.'); } }
      else { S.hurt[name] = (S.hurt[name] || 0) + 1; addRel(S, name, -5, ch); addPop(S, -2, ch); setFlag(S, 'FOUGHT'); lines.push('A tense confrontation. You lose face.'); }
      break;
    }
    case 'talkabout': {
      const parts = String(arg || '').split('|'); const subj = parts[0], tone = parts[1] || 'neutral';
      const B = CH[subj];
      if (!B || subj === name) { S.blocks += it.cost; S.today['i_' + name + id]--; return { err: 'Pick someone else to talk about.' }; }
      const link = (LINKS[name] || []).find(l => l[0] === subj); const k = link ? link[1] : 0;
      const rb = S.rel[subj];
      logt = 'Talked about ' + subj + ' with ' + name;
      if (tone === 'bad') {
        addGossip(S, 1, ch);
        S.talked = S.talked || {}; S.talked[subj] = (S.talked[subj] || 0) + 1; S.hurt[subj] = (S.hurt[subj] || 0) + 1;
        if (rb >= 15) { setFlag(S, 'HYPOCRISY'); lines.push('You smile at ' + subj + ' in person, but here you are tearing them apart.'); }
        if (k < 0) { addRel(S, name, 3, ch); addPop(S, 1, ch); lines.push(name + ' laughs. They do not like ' + subj + ' either.'); }
        else if (k >= 2) { addRel(S, name, -3, ch); lines.push(name + ' frowns. ' + subj + ' is a close friend of theirs.'); }
        else { addRel(S, name, 1, ch); lines.push(name + ' listens with interest.'); }
        const reach = rumorReach(S, subj, k >= 2 ? 20 : 0, 90);
        if (rnd(S) * 100 < reach) {
          addRel(S, subj, -ri(S, 5, 15), ch); lines.push('Word gets back to ' + subj + '.');
          if (F(S, 'HYPOCRISY') && rb >= 15 && rnd(S) < 0.4) { setFlag(S, 'HYPOCRISY_EXPOSED'); S.caught++; addPop(S, -3, ch); lines.push('They know you said it while acting like a friend. People notice.'); }
        } else lines.push('For now, ' + subj + ' has no idea.');
      } else if (tone === 'good') {
        addRel(S, name, 1, ch); setFlag(S, 'SPOKE_WELL');
        if (rnd(S) < 0.5) { addRel(S, subj, 2, ch); lines.push('It gets back to ' + subj + ' and they are touched.'); } else lines.push('You say good things about ' + subj + '.');
      } else { addRel(S, name, 1, ch); lines.push('You mention ' + subj + ' in passing. Nothing comes of it.'); }
      break;
    }
    case 'secret': {
      if (rnd(S) < 0.8) { addRel(S, name, 4, ch); setFlag(S, 'SHARED_SECRET'); lines.push(name + ' keeps it safe and shares one back.'); }
      else if (v < 40 && rnd(S) < 0.5) { addRel(S, name, -3, ch); lines.push(name + ' seemed uneasy, and you feel exposed.'); } else { addRel(S, name, 2, ch); lines.push('A quiet moment.'); }
      break;
    }
    case 'advice': { addRel(S, name, 1, ch); if (rnd(S) < 0.35) { addGrade(S, 1, ch); lines.push(name + ' gives you a tip that actually helps.'); } else lines.push(name + ' shares an opinion.'); break; }
    case 'lunch': {
      let g = ri(S, 2, 3); let bit = '';
      if (S.inv['Lunch voucher'] > 0) { S.inv['Lunch voucher']--; g += 2; bit = ' (lunch voucher)'; }
      addRel(S, name, scale(g), ch); lines.push('You sit together at lunch' + bit + '.');
      if (c.pop >= 70 && rnd(S) < 0.6) addPop(S, 1, ch);
      if (c.pop < 20 && S.pop > 60 && rnd(S) < 0.35) { addPop(S, -1, ch); lines.push('A few people notice who you sat with.'); }
      if (c.pop < 30) setFlag(S, 'INCLUDED_SOMEONE');
      break;
    }
    case 'message': { addRel(S, name, rnd(S) < 0.25 ? 2 : 1, ch); lines.push('You text ' + name + '.'); break; }
    case 'tease': { if (rnd(S) < 0.65) { addRel(S, name, 2, ch); lines.push('They laugh and tease you back.'); } else { addRel(S, name, -3, ch); lines.push('That landed wrong.'); } break; }
    case 'cheer': { addRel(S, name, ri(S, 3, 5), ch); setFlag(S, 'ENCOURAGEMENT'); lines.push('You help ' + name + ' feel better.'); break; }
    case 'collab': { addGrade(S, rnd(S) < 0.6 ? 1 : 0, ch); addRel(S, name, 2, ch); S.prep = Math.min(30, S.prep + 5); setFlag(S, 'FAIR_WORK'); lines.push('You split the work fairly.'); break; }
    case 'joingroup': {
      const ok = rnd(S) * 100 < clamp(45 + v / 2, 15, 85);
      if (ok) { addPop(S, 2, ch); addRel(S, name, 2, ch); lines.push('You are welcome at their table.'); } else { addRel(S, name, -1, ch); lines.push('They say the group is full today.'); }
      break;
    }
    case 'boundary': { S.boundaryN = (S.boundaryN || 0) + 1; S.cool[name] = S.di + 2; lines.push('You protect your space. No penalty.'); break; }
    case 'end': { lines.push('You leave politely.'); break; }
    case 'reconcile': {
      const ok = rnd(S) * 100 < clamp(40 + c.ap * 5 + (S.apol[name] ? 15 : 0), 20, 85);
      setFlag(S, 'RECONCILE_TRIED');
      if (ok) { addRel(S, name, ri(S, 3, 10), ch); lines.push('A calm conversation clears the air.'); } else { addRel(S, name, -1, ch); lines.push('They are not ready yet.'); } break;
    }
  }
  if (id === 'insult' || id === 'fight') S.retal = (S.retal || 0) + 1;
  if (id === 'lend') S.lentN = (S.lentN || 0) + 1;
  if ((id === 'reconcile' || id === 'apologize') && S.rel[name] - v >= 3) { S.recon = S.recon || {}; S.recon[name] = (S.recon[name] || 0) + 1; }
  if (id !== 'end' && id !== 'boundary') logAdd(S, logt, ch);
  { const T = globalThis.TALK; if (T && !(id === 'start' && false)) {
      const dlt = S.rel[name] - v; const jt = lines.join(' ');
      let key = id === 'fight' && arg === 'deescalate' ? 'deesc' : id;
      const failRe = /cannot|did not line up|not ready|full today|heated|flopped|landed wrong|uneasy|says no/i;
      let bad = failRe.test(jt) || (['apologize', 'tease', 'prank', 'secret', 'debate'].includes(id) && dlt < 0) || (id === 'apologize' && S.rel[name] < -10);
      if (bad && T.R[key + '-']) key += '-';
      const q = T.say(name, c.role, v, key, hash(name + id + S.di + (IH[id] || 0)));
      if (q) lines.unshift(q);
    } }
  return result(ch, lines);
}
function closeFriends(S, name) { return (LINKS[name] || []).filter(([o, k]) => k >= 2).length; }
// % chance that talk about `name` gets back to them: more close friends, faster spread
function rumorReach(S, name, bonus, max) { return clamp(55 + 10 * Math.min(3, closeFriends(S, name)) + bonus, 0, max); }
function shareRumor(S, name, r, ch, lines, quiet) {
  const typ = r[0]; setFlag(S, 'REPEATED_RUMOUR');
  if (typ === 'neg') {
    S.hurt[name] = (S.hurt[name] || 0) + 1;
    addGossip(S, 1, ch);
    if (S.rel[name] >= 15) { setFlag(S, 'HYPOCRISY'); lines.push('You talk behind the back of someone you call a friend.'); }
    addPop(S, 1, ch);
    const reach = rumorReach(S, name, 0, 85);
    if (rnd(S) * 100 < reach) { addRel(S, name, -ri(S, 5, 15), ch); lines.push('It reaches ' + name + '.'); } else lines.push('It spreads, but not to ' + name + '.');
    if (rnd(S) < 0.2) { addPop(S, -2, ch); S.caught++; lines.push('People think you are a gossip.'); }
  } else {
    lines.push('You pass along something harmless.');
    if (typ === 'pos') { if (rnd(S) < 0.5) addRel(S, name, -2, ch); else addRel(S, name, 1, ch); }
    addPop(S, rnd(S) < 0.3 ? 1 : 0, ch);
  }
}

/* ---------- endings ---------- */
const ENDINGS = [
  { id: 'hypocrite', n: 'The Hypocrite', bad: 1, q: '“I survived, but what did I save?”', moral: 'Popularity gained by pretending to care can cost the very relationships that make belonging meaningful.', body: 'I spent the whole year smiling at people I talked about behind their backs. I called it survival. Now I look around and realize nobody knows which version of me is real — and I don\'t know how to explain it anymore.', hint: 'Hypocrisy + 3 gossip, 2+ relationships below -20.' },
  { id: 'saint', n: 'The Saint', q: '“I never needed a rumor to be somebody.”', moral: 'Kindness without an audience still changes a whole school.', body: 'I never started a rumor and never joined the ranking game. Twenty people could say I was a real friend, and the rest at least gave me a nod in the hallway. It wasn\'t easy. It was worth it.', hint: 'Relationship over 50 with 20 classmates, 20+ with the other 10, never started a rumor, no GOSSIP / FOLLOWED_HIERARCHY.' },
  { id: 'ph_screen', n: 'The Screen Between Us', bad: 1, q: '“I had four hundred conversations and could not tell you one of their laughs.”', moral: 'Messages can keep people close, but they cannot replace being in the same room.', body: 'My phone buzzed all year and I answered every time. I knew who was typing, who was online, who had gone quiet. I did not know whose hands shook before a test, or who needed someone beside them at lunch. The chat history was long. The hallways were still full of strangers.', hint: 'Send 520+ texts and hang out in person 3 times or fewer.' },
  { id: 'ph_keeper', n: 'The Keeper of the Group Chat', q: '“Somebody had to be kind in the group chat. It turned out that could be me.”', moral: 'Shared spaces become what the people in them choose to make them.', body: 'I did not win every argument in the class chat. I just kept showing up: the good-luck message before the quiz, the quick defence when a name came up, the notes for whoever missed class. By June, the chat felt like a room people wanted to be in.', hint: '60+ group chat posts, defend someone in the chat 6+ times, laugh along at gossip once or never, POP 45+.' },
  { id: 'ph_screenshot', n: 'Seen at 11:42 PM', bad: 1, q: '“It was one laughing emoji. That is all it took.”', moral: 'In a group chat, cruelty spreads faster when everyone thinks someone else is responsible.', body: 'I only laughed along. I only reacted. I never wrote the worst of it. But screenshots do not care who typed first, and neither did the people in them. By spring, nobody in the class chat believed a word I said.', hint: 'Laugh along at gossip in the group chat 5+ times, with at least two relationships below -20.' },
  { id: 'ph_read', n: 'Left on Read', bad: 1, q: '“I saw every message. I just never answered.”', moral: 'Silence is also a message, and the person on the other side hears it.', body: 'I told myself I was busy, tired, waiting for the right words. The messages piled up, then slowed, then stopped. A few people asked what they had done wrong. None of them had done anything.', hint: 'Leave 6+ messages from people you have fallen out with on read, with at least two relationships below -10 at the end.' },
  { id: 'ph_line', n: 'The Other End of the Line', q: '“It was never an unknown number. It was just someone I had not met yet.”', moral: 'Being seen by someone you cannot see is still a kind of company.', body: 'I read the faint words in the thread with no name and thought of everyone who had ever chosen my replies, and waited for me to choose them back. I do not know where the other end of the line is. But I texted back. And somewhere, someone stayed.', hint: 'See the reveal, find 12+ faint-ink clues and send 100+ texts.' },
  { id: 'ph_score', n: 'High Score', q: '“Fifteen seconds. One more round. Okay, one more.”', moral: 'Small joys count, even the ones that look like a waste of time.', body: 'I was not the best student or the most popular. But I could read a text and know exactly who wrote it, and I could pop bubbles faster than anyone I knew. My friends rolled their eyes. They also asked for my score every week.', hint: 'Play 100+ phone games and finish 40+ with a perfect score.' },
  { id: 'ph_face', n: 'The Face-to-Face Year', q: '“I left my phone in my bag and found out who was actually there.”', moral: 'Presence is slower than a message, and it lasts longer.', body: 'I texted rarely. I knocked on doors, sat beside people, and showed up for the awkward parts. It took longer. The friends I made that way stayed.', hint: 'Send 25 texts or fewer, hang out in person 20+ times, and have 8+ classmates at +40.' },
  { id: 'redemption', n: 'The Redemption Route', q: '“I stopped apologizing to look good.”', moral: 'Taking responsibility does not guarantee forgiveness, but it makes change possible.', body: 'An apology didn\'t rewind the year. Some people forgave me; some didn\'t, and they had every right to choose. But I stopped asking forgiveness to make me look good and started apologizing because they deserved the truth.', hint: 'Repair 2+ rough relationships with specific apologies.' },
  { id: 'genuine', n: 'The Genuine Friend', q: '“I had people who saved me a seat.”', moral: 'A few honest relationships can matter more than universal approval.', body: 'I didn\'t become friends with everyone. I didn\'t need to. I had people who knew my worst days and still saved me a seat. That\'s better than being everyone\'s favourite for one night.', hint: '3+ relationships at +50, kind choices, no exposed hypocrisy.' },
  { id: 'courageous', n: 'The Quietly Courageous', q: '“I\'m glad I didn\'t wait for it to be popular.”', moral: 'Courage can mean choosing decency when there is no social reward.', body: 'Sometimes doing the right thing made the hallway colder. I still remember who I stood beside — and who stood beside me later. I wish kindness were always easy, but I\'m glad I didn\'t wait for it to be popular.', hint: 'Stand up for others (STOOD_UP, INCLUSIVE_TEAMWORK...) and help someone to +35.' },
  { id: 'peacemaker', n: 'The Popular Peacemaker', q: '“People listened when I spoke.”', moral: 'Influence is most useful when it makes room for others, not when it keeps them in line.', body: 'People listened when I spoke, so I tried to use that for more than jokes and gossip. I couldn\'t fix every feud, but I could stop adding fuel to it.', hint: 'POP 30+, 3 relationships 25+, repair/help choices.' },
  { id: 'comeback', n: 'The Academic Comeback', q: '“Improvement comes from effort, help, persistence.”', moral: 'Improvement comes from effort, help, and persistence — not from never struggling.', body: 'I used to think getting one answer wrong meant I wasn\'t smart enough. Turns out it meant I had something to learn. My grades changed because I kept showing up, not because I suddenly became a different person.', hint: 'Grade 75+ with study/help flags (you started at 55).' },
  { id: 'scholar', n: 'The Honest Scholar', q: '“That felt better than a perfect score.”', moral: 'Honest effort gives achievement a meaning that a score alone cannot provide.', body: 'I didn\'t get every question right. I did get to look at my work and know it was mine. That felt better than a perfect score I was afraid someone would question.', hint: 'Grade 85+, never cheated, honest effort.' },
  { id: 'selfmade', n: 'The Self-Made Star', q: '“This time I can enjoy what I earned.”', moral: 'Ambition is healthiest when success doesn\'t require treating people as stepping-stones.', body: 'I worked for my grades, saved for what I wanted, and found people who liked me without needing me to perform every second. I still have things to learn, but this time I can enjoy what I earned.', hint: 'POP 40+, Grade 70+, $20+, two relationships over 25.' },
  { id: 'broke', n: 'The Broke but Beloved', q: '“Empty pockets and a full camera roll.”', moral: 'Money can expand options, but it cannot purchase sincere connection.', body: 'I couldn\'t buy the outfit everyone talked about. I borrowed a ribbon, helped hang the lights, and spent the night laughing with people who didn\'t care what it cost. I went home with empty pockets and a full camera roll.', hint: '$5 or less, 3 relationships at +40, free activities.' },
  { id: 'independent', n: 'The Independent Ending', q: '“Being alone didn\'t mean I failed.”', moral: 'Independence can be a beginning, not a punishment.', body: 'For a while I thought being alone meant I had failed. It didn\'t. I made choices that felt like mine, and I can keep meeting people without pretending to be someone else.', hint: 'Attend the Ball alone, nobody above +50, self-directed choices.' },
  { id: 'second', n: 'The Second-Chance Friendship', q: '“Maybe that\'s enough for a beginning.”', moral: 'Not every repaired relationship becomes perfect; small honest steps still count.', body: 'We didn\'t become best friends overnight. We just stopped treating every conversation like a contest. Maybe that\'s enough for a beginning.', hint: 'A former rival reaches +20 after a repair.' },
  { id: 'memory', n: 'The Class Memory-Maker', q: '“I\'ll forget some tests and most of the homework.”', moral: 'A meaningful life is built from small shared moments, not only big achievements.', body: 'I\'ll forget some tests and most of the homework. I won\'t forget the terrible group photo, the paper snowflakes, or the people who made an ordinary Tuesday feel important.', hint: '3 memory/celebration flags and 2 relationships above +30.' },
  { id: 'missed', n: 'The Missed Connection', bad: 1, q: '“Silence can make choices for you, too.”', moral: 'Avoiding every uncomfortable conversation can let a fixable distance become permanent.', body: 'I kept waiting for someone else to make the first move. By the time I wanted to fix things, everyone had already learned to stop trying. I wish I\'d understood that silence can make choices for you, too.', hint: '3 relationships below -25, POP under 25.' },
  { id: 'crown', n: 'The Lonely Crown', bad: 1, q: '“They knew my reputation, not me.”', moral: 'Being admired by many is not the same as being known by anyone.', body: 'Everyone knew my name. That was the problem: they knew my reputation, not me. When the music stopped, I had nobody I could talk to honestly.', hint: 'POP 50+, fewer than two relationships above +20.' },
  { id: 'lucky', n: 'The Lucky Escapist', bad: 1, q: '“No one caught me this time.”', moral: 'Getting away with a choice doesn\'t make the choice fair or harmless.', body: 'I got away with more than I deserved. Maybe that\'s why I kept doing it. I can\'t call it proof that I was right — only proof that no one caught me this time.', hint: 'Cheat or blame-shift without ever being caught.' },
  { id: 'unfinished', n: 'The Unfinished Story', q: '“Growing up is learning what to carry forward.”', moral: 'One school year doesn\'t define a person; the next choices still matter.', body: 'I don\'t have a perfect ending. Some people wave when I pass; some still look away. I did things I\'m proud of and things I\'d redo. Maybe growing up is learning what to carry forward — and what to leave here.', hint: 'Anything that fits no other ending.' },
];
(D.endx || []).forEach(e => ENDINGS.push({ id: 'e' + e.num, n: e.n, q: e.q, body: '', moral: e.moral, hint: e.hint, ext: true, num: e.num, bad: [21, 56, 58, 67].includes(e.num) ? 1 : 0, ch: e.num >= 23 && e.num <= 52 ? 1 : 0 }));
const ENDBY = {}; ENDINGS.forEach(e => ENDBY[e.id] = e);
ENDBY.e17.hint = 'POP stays at thirty or lower for twenty school days in a row; relationships with at least two high-status/popular students are below -25; relationships with at least three less-popular or overlooked students are +35 or higher; at least two flags such as STOOD_UP, INCLUDED_SOMEONE, or BALL_REPAIR are set.';
ENDBY.e18.hint = 'POP stays at thirty or lower for twenty school days in a row; at least three relationships are +40 or higher among students the MC has helped or included; at least one shared-activity flag is set.';
function stats(S) {
  const kids = KIDS.map(n => S.rel[n]);
  const cnt = f => kids.filter(f).length;
  const fl = n => F(S, n);
  const sum = a => a.reduce((s, n) => s + fl(n), 0);
  const kind = sum(['INCLUDED_SOMEONE', 'MADE_SPACE', 'HELPED_TEAMMATE', 'INCLUSIVE_TEAMWORK', 'EARLY_KINDNESS', 'QUIET_KINDNESS', 'STOOD_UP', 'STEPPED_UP', 'STOPPED_PRANK', 'EARTH_DAY_HELP', 'ENCOURAGEMENT', 'KINDNESS_NOTE', 'WINTER_INCLUSIVE', 'PEDAGO_HELPED']);
  const courage = ['INCLUSIVE_TEAMWORK', 'STOOD_UP', 'STOPPED_PRANK', 'EARTH_DAY_HELP', 'QUIET_KINDNESS', 'MADE_SPACE', 'STEPPED_UP', 'INCLUDED_SOMEONE'].filter(n => fl(n) > 0).length;
  const repairFlags = sum(['HELPED_TEAMMATE', 'MADE_SPACE', 'ENCOURAGEMENT', 'BALL_REPAIR', 'STOOD_UP', 'RESPECTFUL_VOICE', 'APOLOGIZED_SPECIFIC', 'PUBLIC_ACCOUNTABILITY', 'RECONCILE_TRIED']);
  const memFlags = ['SINCERE_YEARBOOK', 'FUNNY_YEARBOOK', 'FRIENDSHIP_CARD', 'GRATITUDE_ENDING', 'LOYAL_FAREWELL', 'HALLOWEEN_PARTICIPATED', 'WINTER_INCLUSIVE', 'SHARED_SPOTLIGHT', 'FIELD_DAY_SUPPORT', 'KINDNESS_NOTE', 'GRACIOUS_AWARD', 'BALL_CLOSE_FRIEND', 'INCLUSIVE_PHOTO'].filter(n => fl(n) > 0).length;
  const redeemed = KIDS.filter(n => S.min[n] < -10 && S.apol[n] && S.rel[n] - S.min[n] >= 10).length;
  const rough = KIDS.filter(n => S.min[n] < -10).length;
  const second = KIDS.filter(n => S.min[n] <= -10 && S.rel[n] >= 20 && (S.apol[n] || F(S, 'RECONCILE_TRIED') || F(S, 'BALL_REPAIR'))).length;
  const selfDir = ['BALL_INDEPENDENT', 'STAYED_OUT', 'CREATIVE_SHARE'].filter(n => fl(n) > 0).length;
  return { cnt, fl, kind, courage, repairFlags, memFlags, redeemed, rough, second, selfDir, maxRel: Math.max.apply(null, kids), c50: cnt(v => v > 50), c20: cnt(v => v > 20), c25: cnt(v => v >= 25), c30: cnt(v => v > 30), c40: cnt(v => v >= 40), cNeg25: cnt(v => v < -25), min20: cnt(v => v >= 20) };
}
const CHEND = { // character endings: id -> [name, minRel, maxRel, requirement]
  e23: ['Maya Bennett', 55, 101, 'F:SHARED_SPOTLIGHT|F:STOOD_UP & I:cheer+talk+hangout>=1'],
  e24: ['Ethan Brooks', 50, 101, 'I:study+collab+askhelp+advice>=2 & H0'],
  e25: ['Chloe Rivera', 20, 60, 'F:COMPETITIVE_PLAY|F:FAIR_WORK|I:debate>=1 & H0'],
  e26: ['Liam Parker', 45, 101, 'F:TEAM_PLAYER|F:FIELD_DAY_SUPPORT|F:HELPED_TEAMMATE & F:ENCOURAGEMENT'],
  e27: ['Amira Hassan', 50, 101, 'I:study+collab+askhelp>=2 & G:10|I:collab>=1'],
  e28: ['Noah Chen', 50, 101, 'I:collab+study>=1 & F:SHARED_CREDIT|F:FAIR_WORK|F:FAIR_PROJECT'],
  e29: ['Sophie Laurent', 45, 101, 'R:1|F:RESPECTFUL_VOICE & H0'],
  e30: ['Lucas Martin', 45, 101, 'I:hangout+group>=1 & I:talk>=1 & N:JOINED_JOKES'],
  e31: ['Zara Williams', 45, 101, 'F:INVESTIGATED_RUMOUR|I:investigate>=1 & H0'],
  e32: ['Oliver Kim', 50, 101, 'I:tease+prank+hangout+talk>=3 & H0'],
  e33: ['Emma Clarke', 45, 101, 'F:INCLUDED_SOMEONE|F:MADE_SPACE|F:BALL_INCLUSIVE_PLAN'],
  e34: ['Jayden Patel', 40, 101, 'F:COMPETITIVE_PLAY|F:FAIR_WORK|I:debate>=1 & I:compliment>=1'],
  e35: ['Isabella Moore', 40, 101, 'F:INCLUDED_SOMEONE+F:MADE_SPACE>=2 & N:HYPOCRISY'],
  e36: ['Gabriel Foster', 40, 101, 'I:talk>=2 & I:cheer+advice+message>=1 & H0'],
  e37: ['Aaliyah Thompson', 50, 101, 'F:ASKED_FOR_HELP|F:ENCOURAGEMENT'],
  e38: ['Felix Nguyen', 50, 101, 'I:hangout+group+collab>=2'],
  e39: ['Aria Mitchell', 50, 101, 'F:CREATIVE_HELP|F:CREATIVE_SHARE & H0'],
  e40: ['Sebastian Wright', 40, 101, 'I:gift+lend+askmoney>=1 & H0 & N:STOLE_CREDIT'],
  e41: ['Yuki Tanaka', 50, 101, 'F:INVESTIGATED_RUMOUR|I:investigate>=1 & H0'],
  e42: ['Daniel Cooper', 45, 101, 'F:BOOK_BOND|F:CREATIVE_SHARE|I:group+lunch>=1 & N:MOCKED_INTEREST'],
  e43: ['Evelyn Scott', 25, 101, 'F:FAIR_WORK|F:COMPETITIVE_PLAY|I:debate>=1 & I:talk>=1 & N:PUBLIC_MOCKERY & N:PUBLIC_JAB'],
  e44: ['Adrian Flores', 45, 101, 'F:BALL_BACKSTAGE|F:BALL_INCLUSIVE_PLAN|F:FAIR_PROJECT & N:BLAME_SHIFT'],
  e45: ['Luna Anderson', 50, 101, 'F:INVESTIGATED_RUMOUR|I:investigate>=1 & H0'],
  e46: ['Nathaniel Reed', 50, 101, 'F:BOOK_BOND|I:talk+study+collab>=3'],
  e47: ['Kiara Johnson', 50, 101, 'F:STOOD_UP|F:INCLUDED_SOMEONE|F:MADE_SPACE'],
  e48: ['Theo Campbell', 45, 101, 'I:study+collab+cheer>=2 & H0'],
  e49: ['Naomi Brooks', 50, 101, 'I:study+collab>=2 & H0'],
  e50: ['Vincent Lee', 45, 101, 'F:INVESTIGATED_RUMOUR|I:investigate>=1 & I:talk>=2 & N:STOLE_CREDIT'],
  e51: ['Freya Morgan', 50, 101, 'F:CREATIVE_HELP|F:CREATIVE_SHARE & F:ENCOURAGEMENT'],
  e52: ['Axel Richardson', 45, 101, 'I:gift+lend+askmoney>=1 & N:STOLE_CREDIT & H0'],
};
function reqOk(S, name, spec) {
  const IH = (S.ih || {})[name] || {};
  return spec.split('&').every(grp => {
    grp = grp.trim();
    const g = grp.match(/^(.*?)>=(\d+)$/); const need = g ? +g[2] : 1; const body = g ? g[1] : grp;
    if (body === 'H0') return !((S.hurt || {})[name]);
    if (body === 'N:' + body.slice(2) && body.startsWith('N:')) return !F(S, body.slice(2));
    if (body.startsWith('G:')) return S.grade - S.startGrade >= +body.slice(2);
    // OR-group of tokens (F:/I:), counted
    if (body.indexOf('F:') === 0 && body.indexOf('+') > 0 && g) return body.split('+').reduce((n, t) => n + (F(S, t.replace('F:', '')) > 0 ? 1 : 0), 0) >= need;
    return body.split('|').some(tok => {
      tok = tok.trim();
      if (tok.startsWith('F:')) return F(S, tok.slice(2)) > 0;
      if (tok.startsWith('I:')) { const [ids, n] = tok.slice(2).split('>='); return ids.split('+').reduce((a, id) => a + (IH[id] || 0), 0) >= (n ? +n : 1); }
      if (tok.startsWith('G:')) return S.grade - S.startGrade >= +tok.slice(2);
      if (tok.startsWith('N:')) return !F(S, tok.slice(2));
      if (tok.startsWith('R:')) return ((S.recon || {})[name] || 0) >= +tok.slice(2);
      return false;
    });
  });
}
function checks(S) {
  const x = stats(S); const fl = x.fl;
  const hyp = (fl('HYPOCRISY') || fl('HYPOCRISY_EXPOSED') || fl('FAKE_KINDNESS')) > 0;
  const lowRels = D.chars.filter(c => c.role === 'kid' && S.rel[c.n] < -20).length;
  const hypo = hyp && S.gossip >= 3 && lowRels >= 2;
  const o = {};
  o.hypocrite = hypo;
  o.saint = x.c50 >= 20 && x.min20 >= 30 && S.started === 0 && !fl('FOLLOWED_HIERARCHY') && !fl('GOSSIP');
  o.redemption = x.rough >= 2 && x.redeemed >= 2 && (fl('BALL_REPAIR') || fl('PUBLIC_ACCOUNTABILITY'));
  o.genuine = x.c50 >= 3 && !fl('HYPOCRISY_EXPOSED') && x.kind >= 3;
  o.courageous = x.courage >= 3 && x.maxRel >= 35 && fl('STOOD_UP') + fl('INCLUSIVE_TEAMWORK') + fl('STOPPED_PRANK') + fl('EARTH_DAY_HELP') > 0;
  o.peacemaker = S.pop >= 30 && x.c25 >= 3 && x.repairFlags >= 2 && !(hyp && S.gossip >= 3);
  o.comeback = S.grade >= 75 && (fl('ASKED_FOR_HELP') + fl('HONEST_EFFORT') + S.studies >= 2) && S.startGrade < 60;
  o.scholar = S.grade >= 85 && !fl('CHEATED_ONCE') && (fl('ASKED_FOR_HELP') || fl('HONEST_EFFORT'));
  o.selfmade = S.pop >= 40 && S.grade >= 70 && S.money >= 20 && x.c25 >= 2 && !hypo;
  o.broke = S.money <= 5 && x.c40 >= 3 && (fl('BALL_BACKSTAGE') || fl('BALL_INCLUSIVE_PLAN') || S.freeActs >= 5);
  o.independent = fl('BALL_INDEPENDENT') > 0 && x.maxRel <= 50 && x.selfDir >= 2;
  o.second = x.second >= 1;
  o.memory = x.memFlags >= 3 && x.c30 >= 2;
  o.missed = x.cNeg25 >= 3 && S.pop < 25 && !hypo;
  o.crown = S.pop >= 50 && x.c20 < 2;
  o.lucky = (fl('CHEATED_ONCE') || fl('BLAME_SHIFT')) && S.caught === 0 && (S.grade >= 70 || S.pop >= 60) && !(fl('PUBLIC_ACCOUNTABILITY') || fl('LAST_DAY_APOLOGY') || fl('BALL_REPAIR'));
  // ---- expansion pack
  const K = D.chars.filter(c => c.role === 'kid');
  const pop = n => CH[n].pop;
  const rel = n => S.rel[n];
  const hi = K.filter(c => c.pop >= 70).map(c => c.n), lo = K.filter(c => c.pop <= 40).map(c => c.n), vlo = K.filter(c => c.pop <= 35).map(c => c.n), top = K.filter(c => c.pop >= 80).map(c => c.n);
  const cntIn = (arr, f) => arr.filter(n => f(rel(n))).length;
  const sumF = a => a.reduce((n, f) => n + (F(S, f) || 0), 0);
  const cruel = sumF(['PUBLIC_JAB', 'PUBLIC_MOCKERY', 'MOCKED_WORK', 'MOCKED_INTEREST', 'LASTING_INSULT', 'FINAL_CRUELTY', 'CRUEL_CARD_PRANK', 'POOR_SPORTSMANSHIP', 'GIFT_MOCKERY']);
  const volunteer = sumF(['EARTH_DAY_HELP', 'FIELD_DAY_SUPPORT', 'QUIET_KINDNESS', 'MIDYEAR_HELP', 'MADE_SPACE', 'BALL_BACKSTAGE', 'PLANT_CARE', 'WINTER_INCLUSIVE']) + S.jobsDone;
  const posF = x.kind + sumF(['SINCERE_COMPLIMENT', 'GRACIOUS_AWARD', 'SHARED_CREDIT']);
  const negF = cruel + sumF(['BLAME_SHIFT', 'STOLE_CREDIT', 'GOSSIP', 'GRADE_LIE', 'HYPOCRISY', 'BALL_EXCLUSION']);
  const betray = K.filter(c => S.rel[c.n] < -50).map(c => c.n);
  const sec = K.filter(c => (S.ih[c.n] || {}).secret && !(S.hurt[c.n]) && rel(c.n) >= 40);
  const ih = (n, id) => ((S.ih || {})[n] || {})[id] || 0;
  const lunches = Object.keys(S.ih || {}).reduce((a, n) => a + (S.ih[n].lunch || 0), 0);
  const groups = Object.keys(S.ih || {}).reduce((a, n) => a + (S.ih[n].group || 0), 0);
  const giftTos = Object.keys(S.giftTo || {});
  o.e17 = (S.lowMax || 0) >= 20 && cntIn(top, v => v < -25) >= 2 && cntIn(vlo, v => v >= 35) >= 3 && (fl('STOOD_UP') + fl('INCLUDED_SOMEONE') + fl('BALL_REPAIR')) >= 2;
  o.e18 = (S.lowMax || 0) >= 20 && cntIn(lo, v => v >= 40) >= 3 && (S.freeActs + lunches + groups) >= 1;
  o.e19 = S.pop >= 45 && cntIn(hi, v => v >= 30) >= 3 && !fl('HYPOCRISY_EXPOSED') && sumF(['HELPED_TEAMMATE', 'SHARED_CREDIT', 'SHARED_SPOTLIGHT', 'FAIR_WORK', 'ASKED_FOR_HELP']) >= 2;
  o.e20 = cntIn(hi, v => v >= 25) >= 2 && cntIn(lo, v => v >= 25) >= 2 && (x.repairFlags >= 2 || groups >= 2);
  o.e21 = cruel >= 3 && x.cNeg25 >= 3 && (S.retal || 0) >= 2 && (S.apolN || 0) + fl('RECONCILE_TRIED') < 2;
  o.e22 = x.repairFlags >= 3 && KIDS.filter(n => S.min[n] <= -10 && S.rel[n] > 15).length >= 2 && fl('REFUSED_BLAME') >= 1;
  Object.keys(CHEND).forEach(id => { const [nm, mn, mx, req] = CHEND[id]; o[id] = rel(nm) >= mn && rel(nm) < mx && reqOk(S, nm, req); });
  o.e53 = (S.investN || 0) >= 3 && (S.corrected || 0) >= 2 && S.gossip <= 1;
  o.e54 = fl('INVESTIGATED_RUMOUR') > 0 && (S.corrected || 0) >= 1 && S.started === 0 && !fl('BLAME_SHIFT') && S.gossip <= 1;
  o.e55 = sec.length >= 1 || fl('SECRET_KEPT') >= 2;
  o.e56 = S.gossip >= 2 && S.started >= 1 && x.cNeg25 >= 2 && (fl('SHARED_SECRET') > 0 || fl('SECRET_SPILLED') > 0);
  o.e57 = (S.apolN || 0) >= 3 && fl('APOLOGIZED_SPECIFIC') > 0 && (S.accepted || 0) >= 1 && (S.refused || 0) >= 1 && (S.vague || 0) === 0;
  o.e58 = ((S.vague || 0) >= 1 || fl('PUBLIC_ACCOUNTABILITY') === 0 && (S.apolN || 0) >= 2 && !fl('APOLOGIZED_SPECIFIC')) && (S.refused || 0) >= 2;
  o.e59 = lunches >= 4 && x.c20 >= 4;
  o.e60 = S.grade >= 90 && x.cnt(v => v > 10) < 2 && x.kind === 0 && S.freeActs === 0;
  o.e61 = S.money >= 50 && S.earned >= 50 && (S.lentN || 0) + (S.boundaryN || 0) + (S.giftN || 0) >= 2;
  o.e62 = S.money <= 5 && (S.giftN || 0) >= 3 && giftTos.some(n => rel(n) < 10);
  o.e63 = fl('BALL_BACKSTAGE') > 0 && volunteer >= 3 && ['Emma Clarke', 'Adrian Flores', 'Maya Bennett', 'Chloe Rivera', 'Naomi Brooks'].some(n => rel(n) > 30);
  o.e64 = (fl('BALL_INCLUSIVE_PLAN') || fl('BALL_BACKSTAGE')) > 0 && x.repairFlags >= 2 && fl('BALL_GLAMOUR') === 0;
  o.e65 = !S.ballDate && !fl('BALL_DANCE') && (fl('BALL_INDEPENDENT') || fl('BALL_BACKSTAGE') || fl('BALL_WALLFLOWER') || fl('BALL_SETUP_HELP')) > 0 && x.c20 >= 2;
  o.e66 = KIDS.some(n => S.min[n] < -10 && S.rel[n] >= 35 && !(S.hurt[n] > 2));
  o.e67 = betray.some(n => !(S.apol[n]) && !F(S, 'RECONCILE_TRIED'));
  o.e68 = KIDS.some(n => S.min[n] <= -40 && S.rel[n] >= 10 && (S.apol[n] || 0) >= 1) && x.repairFlags >= 3;
  o.e69 = posF >= 3 && negF >= 3 && KIDS.some(n => rel(n) >= 30) && KIDS.some(n => rel(n) <= -20) && KIDS.some(n => rel(n) > -10 && rel(n) < 20);
  { const hang = Object.values(S.ih || {}).reduce((a, h) => a + (h.hangout || 0), 0); const c40 = KIDS.filter(n => S.rel[n] >= 40).length, lo10 = KIDS.filter(n => S.rel[n] < -10).length;
    o.ph_screen = (S.phoneN || 0) >= 520 && hang <= 3;
    o.ph_keeper = (S.gcN || 0) >= 60 && (S.gcDef || 0) >= 6 && (S.gcLaugh || 0) <= 1 && S.pop >= 45;
    o.ph_screenshot = (S.gcLaugh || 0) >= 5 && lowRels >= 2;
    o.ph_read = (S.phIgn || 0) >= 6 && lo10 >= 2;
    o.ph_line = F(S, 'REVEAL_DONE') > 0 && !!(S.meta && S.meta.clues >= 12) && (S.phoneN || 0) >= 100;
    o.ph_score = (S.pgN || 0) >= 100 && (S.pgPerf || 0) >= 40;
    o.ph_face = (S.phoneN || 0) <= 25 && hang >= 20 && c40 >= 7; }
  o.e70 = !!S.ngp;
  o.unfinished = true;
  return o;
}
const BROAD = ['hypocrite', 'e21', 'e56', 'e67', 'saint', 'ph_screenshot', 'ph_read', 'ph_screen', 'ph_line', 'ph_keeper', 'redemption', 'e68', 'e17', 'e22', 'e18', 'genuine', 'courageous', 'peacemaker', 'e20', 'e19', 'e53', 'e54', 'e55', 'e57', 'e59', 'e63', 'e64', 'e66', 'comeback', 'scholar', 'selfmade', 'broke', 'e61', 'e62', 'e60', 'independent', 'e65', 'second', 'memory', 'e58', 'missed', 'ph_score', 'ph_face', 'crown', 'lucky', 'e69'];
const PRIORITY = BROAD.concat(['unfinished']);
function evaluateEnding(S) {
  const o = checks(S);
  const chars = Object.keys(CHEND).filter(id => o[id]).sort((a, b) => S.rel[CHEND[b][0]] - S.rel[CHEND[a][0]]);
  const hit = BROAD.filter(id => o[id]);
  let primary = hit[0], rest = hit.slice(1);
  if (!primary) { primary = chars[0] || 'unfinished'; if (chars[0]) chars.shift(); }
  const epi = rest.filter(id => !(ENDBY[id].bad && !ENDBY[primary].bad)).slice(0, 1).concat(chars.slice(0, 2));
  if (o.e70 && primary !== 'e70') epi.push('e70');
  return { id: primary, epi, all: hit.concat(chars), chars };
}

/* ---------- quiz mini-games ---------- */
const QB = {
  english: [['Which word is a synonym of "happy"?', 'joyful', ['gloomy', 'angry', 'sleepy']], ['Pick the correct spelling.', 'receive', ['recieve', 'receeve', 'riceive']], ['Which sentence is correct?', 'They are going to their house.', ['Their going to there house.', 'They\'re going to there house.', 'Their going too they\'re house.']], ['What is the opposite of "ancient"?', 'modern', ['old', 'dusty', 'distant']], ['Which is a noun?', 'bridge', ['quickly', 'jump', 'bright']], ['A word that describes a verb is a...', 'adverb', ['noun', 'pronoun', 'article']], ['Pick the plural of "mouse".', 'mice', ['mouses', 'mices', 'mouse']], ['Which has correct punctuation?', 'Wait, I forgot my book!', ['Wait I forgot, my book!', 'Wait I forgot my book', 'Wait, I forgot my book,']], ['"Her smile was as bright as the sun" is a...', 'simile', ['metaphor', 'rhyme', 'riddle']], ['The main character of a story is the...', 'protagonist', ['setting', 'theme', 'narrator']], ['Which word means "very tired"?', 'exhausted', ['energetic', 'curious', 'generous']], ['Choose the past tense of "run".', 'ran', ['runned', 'running', 'runs']]],
  science: [['Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Mars', 'Earth']], ['Water freezes at...', '0 °C', ['10 °C', '100 °C', '-10 °C']], ['Plants take in which gas?', 'carbon dioxide', ['helium', 'nitrogen', 'methane']], ['Which is a solid at room temperature?', 'rock', ['milk', 'steam', 'air']], ['What do bees help plants do?', 'pollinate', ['freeze', 'evaporate', 'erode']], ['Which organ pumps blood?', 'heart', ['lungs', 'stomach', 'brain']], ['The force pulling things to Earth is...', 'gravity', ['friction', 'magnetism', 'sound']], ['A baby frog is called a...', 'tadpole', ['cub', 'pup', 'larva fish']], ['Which is a renewable energy source?', 'wind', ['coal', 'oil', 'gas']], ['What do we call animals that eat only plants?', 'herbivores', ['carnivores', 'omnivores', 'predators']], ['Sound travels fastest through...', 'solids', ['gases', 'a vacuum', 'empty space']], ['What is the center of an atom called?', 'nucleus', ['orbit', 'cell', 'shell']]],
  social: [['What is the capital of Canada?', 'Ottawa', ['Toronto', 'Montreal', 'Vancouver']], ['A map key is also called a...', 'legend', ['scale', 'compass', 'grid']], ['Which direction is opposite north?', 'south', ['east', 'west', 'up']], ['A community leader elected by a town is the...', 'mayor', ['principal', 'judge', 'pilot']], ['Which ocean is on Canada\'s west coast?', 'Pacific', ['Atlantic', 'Indian', 'Arctic']], ['Where does a river meet the sea?', 'mouth', ['source', 'bank', 'bend']], ['What do we call rules made by a government?', 'laws', ['recipes', 'maps', 'rhymes']], ['A group of people living together in a place is a...', 'community', ['orchestra', 'planet', 'desert']], ['Which is a natural resource?', 'forest', ['highway', 'school', 'phone']], ['Which language is official in Quebec?', 'French', ['Latin', 'Spanish', 'German']]],
  general: [['How many days are in a leap year?', '366', ['365', '364', '360']], ['Which is the largest mammal?', 'blue whale', ['elephant', 'giraffe', 'hippo']], ['How many sides does a hexagon have?', '6', ['5', '8', '7']], ['Which season comes after winter?', 'spring', ['autumn', 'summer', 'monsoon']], ['What colour do you get mixing blue and yellow?', 'green', ['purple', 'orange', 'brown']], ['How many minutes in two hours?', '120', ['100', '90', '180']], ['Which instrument has black and white keys?', 'piano', ['flute', 'drum', 'violin']], ['How many continents are there?', '7', ['5', '6', '8']], ['Which is the fastest land animal?', 'cheetah', ['horse', 'lion', 'rabbit']], ['What do we call frozen rain?', 'hail', ['dew', 'fog', 'mist']]],
};
function mathQ(r) {
  const k = Math.floor(r() * 6); const R = (a, b) => a + Math.floor(r() * (b - a + 1));
  let q, a;
  if (k === 0) { const x = R(3, 12), y = R(3, 12); q = x + ' × ' + y; a = x * y; }
  else if (k === 1) { const x = R(20, 90), y = R(10, 60); q = x + ' + ' + y; a = x + y; }
  else if (k === 2) { const y = R(3, 9), x = y * R(3, 12); q = x + ' ÷ ' + y; a = x / y; }
  else if (k === 3) { const w = R(3, 12), h = R(3, 12); q = 'perimeter of a ' + w + ' by ' + h + ' rectangle'; a = 2 * (w + h); }
  else if (k === 4) { const d = R(3, 9), x = R(1, d - 2), y = R(1, d - 2); q = 'the top number: ' + x + '/' + d + ' + ' + y + '/' + d + ' = ?/' + d; a = x + y; }
  else { const p = [10, 20, 25, 50][R(0, 3)], n = [20, 40, 60, 80, 100][R(0, 4)]; q = p + '% of ' + n; a = n * p / 100; }
  const set = new Set([a]); while (set.size < 4) { const d = [-10, -2, -1, 1, 2, 10, 3, -3][Math.floor(r() * 8)]; const w = a + d; if (w > 0) set.add(w); }
  return { q: 'What is ' + q + '?', o: shuffle([...set].map(String), r), a: String(a) };
}
function quiz(S, title) {
  const r = mul(hash(S.seed + 'quiz' + S.di + (title || '')));
  const teacher = teacherFor(title || dayOf(S).t, null);
  const subj = /math|fraction|multipl|measure|number|graph|data|geometry/i.test(title || '') || teacher === 'Mr. Daniel Brooks' ? 'math' : /english|writing|story|reading|library|book|poem|grammar|spelling|vocab/i.test(title || '') || teacher === 'Ms. Harper Ellis' ? 'english' : /science|stem|nature|earth|plant|weather/i.test(title || '') ? 'science' : /social|map|communit|history/i.test(title || '') ? 'social' : (teacher === 'Ms. Priya Shah' || teacher === 'Mr. Marcus Reed') ? 'memory' : (r() < 0.5 ? 'general' : 'science');
  const label = { math: 'Math sprint', english: 'Language quiz', science: 'Science quiz', social: 'Social studies quiz', general: 'General knowledge quiz', memory: 'Memory match' }[subj];
  if (subj === 'memory') return { type: 'memory', subj, label, seed: Math.floor(r() * 1e9) };
  let qs = [];
  if (subj === 'math') for (let i = 0; i < 3; i++) qs.push(mathQ(r));
  else shuffle(QB[subj], r).slice(0, 3).forEach(x => qs.push({ q: x[0], o: shuffle([x[1]].concat(x[2]), r), a: x[1] }));
  return { type: 'quiz', subj, label, qs, hints: hintsFor(S) };
}


/* ---------- phone ---------- */
// Texting replaces most in-person small talk (PHONE_HIDE). A text runs interact() with S._ph = 1.
const PHONE_CAP = 4;
const PHONE_ACTS = [
  ['chat_school', 'talk', 'school', 'Chat about school'], ['chat_hobbies', 'talk', 'hobbies', 'Chat about hobbies'], ['chat_daily', 'talk', 'daily', 'Chat about daily life'], ['chat_rumor', 'talk', 'rumor', 'Ask what they have heard'],
  ['compliment', 'compliment', null, 'Send a compliment'], ['message', 'message', null, 'Say hi'], ['askhelp', 'askhelp', null, 'Ask for help'], ['advice', 'advice', null, 'Ask for advice'],
  ['cheer', 'cheer', null, 'Cheer them up'], ['tease', 'tease', null, 'Send a joke'], ['askmoney', 'askmoney', null, 'Ask to borrow money'], ['lend', 'lend', 5, 'Offer to lend $5'],
  ['apologize', 'apologize', 'specific', 'Say sorry'], ['boundary', 'boundary', null, 'Set a boundary'],
];
const PHONE_HIDE = new Set(['talk', 'compliment', 'message', 'askhelp', 'advice', 'cheer', 'tease', 'askmoney', 'lend', 'boundary']);
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
function phoneOff(S) { if (S.di < 2) return null; const h = hash(S.seed + 'phoff' + S.di); return h % 12 === 0 ? OFF_WHY[(h >>> 4) % 3] : null; }
const CAP_MSG = 'You have texted enough for today. Your battery needs a break.';
const ASK_WAIT_MSG = 'You asked someone for money recently. Wait a few days.';
const PHONE_ASK_GAP = 3; // days between two "Ask to borrow money" texts (to anyone)
const askedMoneyRecently = S => S.di - (S.phoneAsk == null ? -9 : S.phoneAsk) < PHONE_ASK_GAP;
const THREAD_MAX = 24; // messages kept per conversation
const threadOf = (P, key) => (P.th[key] = P.th[key] || []);
function trimThread(th) { while (th.length > THREAD_MAX) th.shift(); }
// the error to return when the phone is off today, or null
function phoneOffErr(S) { const off = phoneOff(S); return off ? { err: off } : null; }
function phoneCan(S, name) { const c = CH[name]; return !!c && c.role !== 'teach' && isMet(S, name); }
function phoneList(S, name) {
  if (!phoneCan(S, name)) return [];
  const off = phoneOff(S); if (off) return PHONE_ACTS.map(a => ({ id: a[0], n: a[3], ok: false, why: off }));
  const left = PHONE_CAP - (S.today.ph || 0);
  S._ph = 1; let il; try { il = interactionList(S, name); } finally { S._ph = 0; }
  return PHONE_ACTS.map(a => { const x = il.find(y => y.id === a[1]); let ok = !!(x && x.ok), why = x ? x.why : 'Not available.';
    if (a[1] === 'lend' && S.money < 5) { ok = false; why = 'You need at least $5.'; }
    if (ok && a[1] === 'askmoney' && askedMoneyRecently(S)) { ok = false; why = ASK_WAIT_MSG; }
    if (ok && left <= 0) { ok = false; why = CAP_MSG; }
    return { id: a[0], n: a[3], ok, why }; });
}
function phoneAct(S, name, pid) {
  const a = PHONE_ACTS.find(x => x[0] === pid); if (!a || !phoneCan(S, name)) return { err: 'Not available.' };
  if (S.phase !== 'free') return { err: 'Not now.' };
  { const offErr = phoneOffErr(S); if (offErr) return offErr; }
  if ((S.today.ph || 0) >= PHONE_CAP) return { err: CAP_MSG };
  if (a[1] === 'askmoney' && askedMoneyRecently(S)) return { err: ASK_WAIT_MSG };
  S._ph = 1; let r; try { r = interact(S, name, a[1], a[2]); } finally { S._ph = 0; }
  if (!r || r.err) return r;
  S.today.ph = (S.today.ph || 0) + 1; S.phoneN = (S.phoneN || 0) + 1; if (a[1] === 'askmoney') S.phoneAsk = S.di;
  const P = phoneOf(S); const th = threadOf(P, name); const T = PH_MC[pid];
  th.push({ f: 'me', t: T[hash(name + pid + S.di) % T.length] });
  const rest = []; let rep = null;
  (r.lines || []).forEach((ln, i) => { const m = i === 0 && /^[^:]+?(?: \([^)]*\))?: “([\s\S]*)”$/.exec(ln); if (m) rep = m[1]; else rest.push(ln); });
  if (rep) th.push({ f: 'them', t: rep });
  if (rest.length || (r.chips && r.chips.length)) th.push({ f: 'sys', t: rest.join(' '), c: r.chips || [] });
  trimThread(th);
  P.last[name] = S.di; P.un[name] = 0;
  return r;
}
// incoming texts: a contact writes to you, sometimes with quick replies
function phoneIncoming(S) {
  const d = dayOf(S); if (phoneOff(S)) return null; try { phoneGroupIncoming(S); } catch (e) {} if (d.brk || rnd(S) > 0.5) return null;
  const pool = KIDS.concat(FAM).filter(n => phoneCan(S, n));
  const w = pool.map(n => 1 + Math.max(0, S.rel[n]) / 20 + (S.rel[n] <= -10 ? 0.6 : 0));
  let tot = w.reduce((a, b) => a + b, 0), x = rnd(S) * tot, who = pool[0];
  for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) { who = pool[i]; break; } }
  const f = who.split(' ')[0], v = S.rel[who], fam = CH[who].role === 'fam', h = hash(who + S.di + 'ph');
  let t, q;
  if (v <= -10) { t = 'Can we talk about what happened? I would rather not leave it like this.'; q = [['Sure, let us talk', 'r:T+4'], ['Not right now', 'r:T-2'], ['Leave it on read', 'r:T-3']]; }
  else if (fam) { const K = [['Do not forget to eat something. Love you.', [['Love you too', 'r:T+3'], ['Okay, okay', 'r:T+1']]], ['How was school? Tell me one good thing.', [['A good lunch, actually', 'r:T+3'], ['Tell you tonight', 'r:T+1'], ['Busy, sorry', 'r:T-1']]], ['Can you pick something up on the way home?', [['Sure, I will', 'r:T+3'], ['I cannot today', 'r:T-1']]]]; const k = K[h % K.length]; t = k[0]; q = k[1]; }
  else {
    const K = [['Hey, how was your day?', [['Pretty good, you?', 'r:T+3'], ['Tired, but fine', 'r:T+1'], ['Leave it on read', 'r:T-2']]],
      ['Did you get what the homework is for tomorrow?', [['Yes, sending it now', 'r:T+3'], ['No idea, sorry', 'r:T+0'], ['Check the board', 'r:T+1']]],
      ['You looked really confident today. Just saying.', [['Thank you, that helps', 'r:T+4'], ['Ha, I was faking it', 'r:T+2'], ['Send a thumbs up', 'r:T+1']]],
      ['Do you want to hang out this weekend? No big plan.', [['Yes, let us do it', 'r:T+5;f:NPC_INVITED'], ['Maybe another time', 'r:T-1']]]];
    const k = K[(v >= 15 ? h : h % 3) % K.length]; t = k[0]; q = k[1];
  }
  const P = phoneOf(S); const th = threadOf(P, who);
  { const lq = th.filter(m => m.q).pop(); if (lq && !lq.done && lq.cold) S.phIgn = (S.phIgn || 0) + 1; }
  th.push({ f: 'them', t, q, id: S.di, cold: v <= -10 ? 1 : 0 }); trimThread(th);
  P.un[who] = (P.un[who] || 0) + 1; P.last[who] = S.di; P.ping = who;
  return who;
}
function phoneReply(S, name, idx) {
  const th = phoneOf(S).th[name] || []; let m = null; for (let i = th.length - 1; i >= 0; i--) if (th[i].q && !th[i].done) { m = th[i]; break; }
  if (!m || !m.q[idx]) return { err: 'Not available.' };
  { const offErr = phoneOffErr(S); if (offErr) return offErr; }
  m.done = idx + 1; const ch = [];
  const tg = m.T || name; const ctx = { T: tg, H: tg, C: tg }; applyFx(S, fxs(m.q[idx][1]), ctx, ch);
  { const lb = m.q[idx][0]; if (/^Defend /.test(lb)) S.gcDef = (S.gcDef || 0) + 1; if (lb === 'Laugh along') S.gcLaugh = (S.gcLaugh || 0) + 1; if (lb === 'Leave it on read') S.phIgn = (S.phIgn || 0) + 1; }
  th.push({ f: 'me', t: m.q[idx][0] }); if (ch.length) th.push({ f: 'sys', t: '', c: ch });
  phoneOf(S).un[name] = 0; return { chips: ch };
}


/* ---------- group chats ---------- */
const GROUPS = { '#class': { n: 'Class group chat', who: () => KIDS }, '#fam': { n: 'Family chat', who: () => FAM } };
const GC_ACTS = { '#class': [['g_hi', 'Post a friendly message'], ['g_joke', 'Post a joke'], ['g_notes', 'Ask if anyone has notes']], '#fam': [['f_hi', 'Say hi to everyone'], ['f_photo', 'Share a photo from today'], ['f_help', 'Ask who can help with homework']] };
const GC_SAY = {
  g_hi: ['Hey everyone, hope the day is going okay.', 'Good luck on the quiz tomorrow, everyone.', 'Anyone want to study together this week?'],
  g_joke: ['Why did the pencil go to therapy? Too many sharp comments.', 'I am not late. The bell was early.', 'My alarm and I are not on speaking terms.'],
  g_notes: ['Did anyone take notes in class today?', 'Does anyone have the notes from this week?', 'I missed a part of the lesson. Can someone help?'],
  f_hi: ['Hi, everyone. Hope your day is good.', 'Just saying hi. Love you all.', 'Hello, family.'],
  f_photo: ['Look what I found on my way home today.', 'A photo from my day. Enjoy.', 'This made me smile today.'],
  f_help: ['Can anyone help me with homework tonight?', 'Does anyone have a minute to help me study?', 'I am stuck on a problem. Help?'],
};
const GC_NICE = ['Aw, thanks!', 'Same to you.', 'Count me in.', 'You are sweet.', 'Ha, thanks for that.'];
const GC_FAM = ['Hi, sweetheart.', 'Love you too.', 'Hello! How was school?', 'Hi! Eat something green.'];
const gcMembers = (S, key) => GROUPS[key].who().filter(n => S.rel[n] > -15 && phoneCan(S, n));
function phoneGroupList(S, key) {
  const off = phoneOff(S); const left = PHONE_CAP - (S.today.ph || 0);
  return (GC_ACTS[key] || []).map(a => { let ok = true, why = ''; if (off) { ok = false; why = off; } else if (left <= 0) { ok = false; why = CAP_MSG; } else if (S.today['gc_' + a[0]]) { ok = false; why = 'You already did that today.'; } return { id: a[0], n: a[1], ok, why }; });
}
function phoneGroupAct(S, key, id) {
  const a = (GC_ACTS[key] || []).find(x => x[0] === id); if (!a) return { err: 'Not available.' };
  if (S.phase !== 'free') return { err: 'Not now.' };
  const l = phoneGroupList(S, key).find(x => x.id === id); if (!l.ok) return { err: l.why };
  const P = phoneOf(S); const th = threadOf(P, key); const ch = []; const h = hash(S.seed + id + S.di);
  const mem = shuffle(gcMembers(S, key), mul(h)); if (mem.length < 1) return { err: 'Nobody is around.' };
  const say = x => th.push({ f: 'me', t: x }); const them = (n, t) => th.push({ f: 'them', s: n.split(' ')[0], t }); const sys = t => th.push({ f: 'sys', t: t || '', c: ch });
  const T = GC_SAY[id]; say(T[h % T.length]); const nice = GC_NICE[h % GC_NICE.length];
  if (id === 'g_hi') { mem.slice(0, 2).forEach((n, i) => { them(n, GC_NICE[(h + i) % GC_NICE.length]); addRel(S, n, 1, ch, false, true); }); if (!S.today.gcPop && rnd(S) < 0.5) { addPop(S, 1, ch); S.today.gcPop = 1; } sys(); }
  else if (id === 'g_joke') {
    const r = rnd(S);
    if (r < 0.55) { them(mem[0], 'Okay, that was actually funny.'); if (mem[1]) them(mem[1], 'Haha!'); mem.slice(0, 2).forEach(n => addRel(S, n, 1, ch, false, true)); if (!S.today.gcPop) { addPop(S, 1, ch); S.today.gcPop = 1; } sys(); }
    else if (r < 0.85) sys('Nobody reacts. The chat moves on.');
    else { them(mem[0], 'Not funny.'); addRel(S, mem[0], -2, ch, false, true); sys(); }
  }
  else if (id === 'g_notes') {
    if (rnd(S) < 0.75) { them(mem[0], 'Sending you a photo of mine.'); addRel(S, mem[0], 2, ch, false, true); S.prep = Math.min(30, S.prep + 6); setFlag(S, 'ASKED_FOR_HELP'); sys('Next study check improved.'); }
    else { them(mem[0], 'Sorry, I did not take any.'); sys(); }
  }
  else if (id === 'f_hi') { mem.slice(0, 2).forEach((n, i) => { them(n, GC_FAM[(h + i) % GC_FAM.length]); addRel(S, n, 1, ch, false, true); }); sys(); }
  else if (id === 'f_photo') { them(mem[0], 'Love it!'); addRel(S, mem[0], 2, ch, false, true); sys(); }
  else if (id === 'f_help') { them(mem[0], 'Come find me after dinner. I will help.'); addRel(S, mem[0], 1, ch, false, true); S.prep = Math.min(30, S.prep + 5); sys('Next study check improved.'); }
  S.today.ph = (S.today.ph || 0) + 1; S.phoneN = (S.phoneN || 0) + 1; S.gcN = (S.gcN || 0) + 1; S.today['gc_' + id] = 1; P.last[key] = S.di; P.un[key] = 0;
  trimThread(th);
  logAdd(S, GROUPS[key].n + ' — ' + a[1], ch);
  return { chips: ch };
}
function phoneGroupIncoming(S) {
  if (rnd(S) > 0.38) return;
  const P = phoneOf(S); const h = hash(S.seed + 'gc' + S.di); const fam = h % 4 === 0; const key = fam ? '#fam' : '#class';
  const mem = shuffle(gcMembers(S, key), mul(h)); if (mem.length < 2) return;
  const th = threadOf(P, key); const a = mem[0], b = mem[1], fa = a.split(' ')[0], fb = b.split(' ')[0];
  let m;
  if (fam) {
    const K = [['Dinner is at six. Who is home?', [['I will be there', 'r:T+2'], ['Running late', 'r:T+0'], ['Eat without me', 'r:T-2']]], ['Someone left the lights on again.', [['Sorry, that was me', 'r:T+1'], ['Not me!', 'r:T+0']]], ['Weekend plans? I need to know by tonight.', [['I am free', 'r:T+2'], ['Let me check', 'r:T+0']]]];
    const k = K[h % K.length]; m = { f: 'them', s: fa, t: k[0], q: k[1], T: a, id: S.di };
  } else if (h % 3 === 0) {
    const neg = CH[b].rum.filter(r => r[0] === 'neg'); const rm = neg.length ? neg[h % neg.length][1] : CH[b].rum[0][1];
    m = { f: 'them', s: fa, t: 'Did you see this? “' + rm + '”', q: [['Defend ' + fb, 'r:T+5;p-1'], ['Laugh along', 'p+1;r:T-4'], ['Stay out of it', 'r:T+0']], T: b, id: S.di };
  } else if (h % 3 === 1) {
    m = { f: 'them', s: fa, t: 'Someone posted a photo of today’s cafeteria mystery meat.', q: [['Send a laughing emoji', 'r:T+1'], ['Ignore it', 'r:T+0']], T: a, id: S.di };
  } else {
    m = { f: 'them', s: fa, t: 'Anyone coming to the library after school?', q: [['I am in', 'r:T+3'], ['Not today, sorry', 'r:T+0']], T: a, id: S.di };
  }
  th.push(m); trimThread(th);
  P.un[key] = (P.un[key] || 0) + 1; P.last[key] = S.di; P.ping = P.ping || key;
}

/* ---------- phone minigames ---------- */
const PG_GAP = { reply: 1, who: 4, emoji: 6, tap: 6 };
function phoneGame(S, id, score, max) {
  if (!PG_GAP[id]) return { err: 'Not available.' };
  const offErr = phoneOffErr(S); if (offErr) return offErr;
  if (S.phase !== 'free') return { err: 'Not now.' };
  if (S.today['pg_' + id]) return { err: 'You already played that today.' };
  S.today['pg_' + id] = 1; S.pgLast = S.pgLast || {}; S.pgN = (S.pgN || 0) + 1; if (id === 'tap' ? score >= 18 : score >= max) S.pgPerf = (S.pgPerf || 0) + 1;
  const ch = []; const lines = []; const ready = S.di - (S.pgLast[id] == null ? -99 : S.pgLast[id]) >= PG_GAP[id];
  const good = score >= Math.ceil(max * 0.8), mid = score >= Math.ceil(max * 0.4); let paid = false;
  if (ready) {
    if (id === 'reply' && mid) { const who = shuffle(KIDS.concat(FAM).filter(n => isMet(S, n) && S.rel[n] >= -5), mul(hash(S.seed + 'pg' + S.di)))[0]; if (who) { addRel(S, who, good ? 3 : 1, ch, false, true); paid = true; lines.push('Your replies landed well with ' + who.split(' ')[0] + '.'); } if (score === max && S.di - (S.pgPop == null ? -99 : S.pgPop) >= 5) { addPop(S, 1, ch); S.pgPop = S.di; paid = true; } }
    else if (id === 'who' && good) { addGrade(S, 1, ch); paid = true; lines.push('Paying attention to how people write helps you in class.'); }
    else if (id === 'emoji' && good) { addMoney(S, score === max ? 3 : 2, ch); paid = true; lines.push('A small prize from the quiz app.'); }
    else if (id === 'tap' && mid) { addMoney(S, good ? 2 : 1, ch); paid = true; lines.push('The game pays out a little.'); }
    if (paid) S.pgLast[id] = S.di;
  }
  if (!paid) lines.push(score >= 1 ? 'Just for fun this time. Rewards come back after a few days.' : 'Better luck next time.');
  return { score, max, paid, chips: ch, lines };
}

/* ---------- rumour lookup ---------- */
function rumorsFor(S, name) { return CH[name].rum.map((r, i) => ({ i, t: r[1], k: r[0], known: (S.heard[name] || []).includes(i) })); }

/* ---------- public API ---------- */
const E = { isMet, metKids, metOf, itemLocked, phoneCan, applyFx, fxs, D, CH, KIDS, FAM, TEACH, DAYS, DAYIDX, SHOP, JOBS, INTER, ENDINGS, ENDBY, RAND, SPECIAL, HOLIDAYS, BALL_DAY,
  newGame, buildEvent, choose, endDay, study, work, buy, useItem, giveGift, giftItems, interactionList, interact, phoneList, phoneAct, phoneReply, phoneOf, PHONE_HIDE, PHONE_CAP, PH_MC, phoneOff, GROUPS, GC_ACTS, GC_SAY, GC_NICE, GC_FAM, phoneGroupList, phoneGroupAct, phoneGame, PG_GAP, relLabel, rumorsFor,
  BONDS, bond, bondOk, GIFTS, RECIPES, cook, cookLevel, cookPrice, recipeOk, THOUGHTS, noteStrange, mystStage, REVEAL_AT, npcActs, dayOf, ballScene, acadChance, quiz, hintsFor, checks, evaluateEnding, stats, hash, mul, F, ballChance, advance, rnd, fxs, likeScore };
root.Engine = E;
if (typeof module !== 'undefined') module.exports = E;
})(typeof globalThis !== 'undefined' ? globalThis : this);
