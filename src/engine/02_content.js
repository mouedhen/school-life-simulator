/* engine/02_content.js — Game content tables: random, special and holiday events, shop, jobs, interactions, friendship links. */
'use strict';
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
