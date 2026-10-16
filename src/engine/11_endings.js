/* engine/11_endings.js — ENDINGS, stats(), character endings (CHEND), checks() and evaluateEnding(). */
'use strict';
/* ---------- endings ---------- */
const ENDINGS = [
  {
    id: 'hypocrite', n: 'The Hypocrite', bad: 1,
    q: '“I survived, but what did I save?”',
    moral: 'Popularity gained by pretending to care can cost the very relationships that make belonging meaningful.',
    body: 'I spent the whole year smiling at people I talked about behind their backs. I called it survival. Now I look around and realize nobody knows which version of me is real — and I don\'t know how to explain it anymore.',
    hint: 'Hypocrisy + 3 gossip, 2+ relationships below -20.',
  },
  {
    id: 'saint', n: 'The Saint',
    q: '“I never needed a rumor to be somebody.”',
    moral: 'Kindness without an audience still changes a whole school.',
    body: 'I never started a rumor and never joined the ranking game. Twenty people could say I was a real friend, and the rest at least gave me a nod in the hallway. It wasn\'t easy. It was worth it.',
    hint: 'Relationship over 50 with 20 classmates, 20+ with the other 10, never started a rumor, no GOSSIP / FOLLOWED_HIERARCHY.',
  },
  {
    id: 'ph_screen', n: 'The Screen Between Us', bad: 1,
    q: '“I had four hundred conversations and could not tell you one of their laughs.”',
    moral: 'Messages can keep people close, but they cannot replace being in the same room.',
    body: 'My phone buzzed all year and I answered every time. I knew who was typing, who was online, who had gone quiet. I did not know whose hands shook before a test, or who needed someone beside them at lunch. The chat history was long. The hallways were still full of strangers.',
    hint: 'Send 520+ texts and hang out in person 3 times or fewer.',
  },
  {
    id: 'ph_keeper', n: 'The Keeper of the Group Chat',
    q: '“Somebody had to be kind in the group chat. It turned out that could be me.”',
    moral: 'Shared spaces become what the people in them choose to make them.',
    body: 'I did not win every argument in the class chat. I just kept showing up: the good-luck message before the quiz, the quick defence when a name came up, the notes for whoever missed class. By June, the chat felt like a room people wanted to be in.',
    hint: '60+ group chat posts, defend someone in the chat 6+ times, laugh along at gossip once or never, POP 45+.',
  },
  {
    id: 'ph_screenshot', n: 'Seen at 11:42 PM', bad: 1,
    q: '“It was one laughing emoji. That is all it took.”',
    moral: 'In a group chat, cruelty spreads faster when everyone thinks someone else is responsible.',
    body: 'I only laughed along. I only reacted. I never wrote the worst of it. But screenshots do not care who typed first, and neither did the people in them. By spring, nobody in the class chat believed a word I said.',
    hint: 'Laugh along at gossip in the group chat 5+ times, with at least two relationships below -20.',
  },
  {
    id: 'ph_read', n: 'Left on Read', bad: 1,
    q: '“I saw every message. I just never answered.”',
    moral: 'Silence is also a message, and the person on the other side hears it.',
    body: 'I told myself I was busy, tired, waiting for the right words. The messages piled up, then slowed, then stopped. A few people asked what they had done wrong. None of them had done anything.',
    hint: 'Leave 6+ messages from people you have fallen out with on read, with at least two relationships below -10 at the end.',
  },
  {
    id: 'ph_line', n: 'The Other End of the Line',
    q: '“It was never an unknown number. It was just someone I had not met yet.”',
    moral: 'Being seen by someone you cannot see is still a kind of company.',
    body: 'I read the faint words in the thread with no name and thought of everyone who had ever chosen my replies, and waited for me to choose them back. I do not know where the other end of the line is. But I texted back. And somewhere, someone stayed.',
    hint: 'See the reveal, find 12+ faint-ink clues and send 100+ texts.',
  },
  {
    id: 'ph_score', n: 'High Score',
    q: '“Fifteen seconds. One more round. Okay, one more.”',
    moral: 'Small joys count, even the ones that look like a waste of time.',
    body: 'I was not the best student or the most popular. But I could read a text and know exactly who wrote it, and I could pop bubbles faster than anyone I knew. My friends rolled their eyes. They also asked for my score every week.',
    hint: 'Play 100+ phone games and finish 40+ with a perfect score.',
  },
  {
    id: 'ph_face', n: 'The Face-to-Face Year',
    q: '“I left my phone in my bag and found out who was actually there.”',
    moral: 'Presence is slower than a message, and it lasts longer.',
    body: 'I texted rarely. I knocked on doors, sat beside people, and showed up for the awkward parts. It took longer. The friends I made that way stayed.',
    hint: 'Send 25 texts or fewer, hang out in person 20+ times, and have 8+ classmates at +40.',
  },
  {
    id: 'redemption', n: 'The Redemption Route',
    q: '“I stopped apologizing to look good.”',
    moral: 'Taking responsibility does not guarantee forgiveness, but it makes change possible.',
    body: 'An apology didn\'t rewind the year. Some people forgave me; some didn\'t, and they had every right to choose. But I stopped asking forgiveness to make me look good and started apologizing because they deserved the truth.',
    hint: 'Repair 2+ rough relationships with specific apologies.',
  },
  {
    id: 'genuine', n: 'The Genuine Friend',
    q: '“I had people who saved me a seat.”',
    moral: 'A few honest relationships can matter more than universal approval.',
    body: 'I didn\'t become friends with everyone. I didn\'t need to. I had people who knew my worst days and still saved me a seat. That\'s better than being everyone\'s favourite for one night.',
    hint: '3+ relationships at +50, kind choices, no exposed hypocrisy.',
  },
  {
    id: 'courageous', n: 'The Quietly Courageous',
    q: '“I\'m glad I didn\'t wait for it to be popular.”',
    moral: 'Courage can mean choosing decency when there is no social reward.',
    body: 'Sometimes doing the right thing made the hallway colder. I still remember who I stood beside — and who stood beside me later. I wish kindness were always easy, but I\'m glad I didn\'t wait for it to be popular.',
    hint: 'Stand up for others (STOOD_UP, INCLUSIVE_TEAMWORK...) and help someone to +35.',
  },
  {
    id: 'peacemaker', n: 'The Popular Peacemaker',
    q: '“People listened when I spoke.”',
    moral: 'Influence is most useful when it makes room for others, not when it keeps them in line.',
    body: 'People listened when I spoke, so I tried to use that for more than jokes and gossip. I couldn\'t fix every feud, but I could stop adding fuel to it.',
    hint: 'POP 30+, 3 relationships 25+, repair/help choices.',
  },
  {
    id: 'comeback', n: 'The Academic Comeback',
    q: '“Improvement comes from effort, help, persistence.”',
    moral: 'Improvement comes from effort, help, and persistence — not from never struggling.',
    body: 'I used to think getting one answer wrong meant I wasn\'t smart enough. Turns out it meant I had something to learn. My grades changed because I kept showing up, not because I suddenly became a different person.',
    hint: 'Grade 75+ with study/help flags (you started at 55).',
  },
  {
    id: 'scholar', n: 'The Honest Scholar',
    q: '“That felt better than a perfect score.”',
    moral: 'Honest effort gives achievement a meaning that a score alone cannot provide.',
    body: 'I didn\'t get every question right. I did get to look at my work and know it was mine. That felt better than a perfect score I was afraid someone would question.',
    hint: 'Grade 85+, never cheated, honest effort.',
  },
  {
    id: 'selfmade', n: 'The Self-Made Star',
    q: '“This time I can enjoy what I earned.”',
    moral: 'Ambition is healthiest when success doesn\'t require treating people as stepping-stones.',
    body: 'I worked for my grades, saved for what I wanted, and found people who liked me without needing me to perform every second. I still have things to learn, but this time I can enjoy what I earned.',
    hint: 'POP 40+, Grade 70+, $20+, two relationships over 25.',
  },
  {
    id: 'broke', n: 'The Broke but Beloved',
    q: '“Empty pockets and a full camera roll.”',
    moral: 'Money can expand options, but it cannot purchase sincere connection.',
    body: 'I couldn\'t buy the outfit everyone talked about. I borrowed a ribbon, helped hang the lights, and spent the night laughing with people who didn\'t care what it cost. I went home with empty pockets and a full camera roll.',
    hint: '$5 or less, 3 relationships at +40, free activities.',
  },
  {
    id: 'independent', n: 'The Independent Ending',
    q: '“Being alone didn\'t mean I failed.”',
    moral: 'Independence can be a beginning, not a punishment.',
    body: 'For a while I thought being alone meant I had failed. It didn\'t. I made choices that felt like mine, and I can keep meeting people without pretending to be someone else.',
    hint: 'Attend the Ball alone, nobody above +50, self-directed choices.',
  },
  {
    id: 'second', n: 'The Second-Chance Friendship',
    q: '“Maybe that\'s enough for a beginning.”',
    moral: 'Not every repaired relationship becomes perfect; small honest steps still count.',
    body: 'We didn\'t become best friends overnight. We just stopped treating every conversation like a contest. Maybe that\'s enough for a beginning.',
    hint: 'A former rival reaches +20 after a repair.',
  },
  {
    id: 'memory', n: 'The Class Memory-Maker',
    q: '“I\'ll forget some tests and most of the homework.”',
    moral: 'A meaningful life is built from small shared moments, not only big achievements.',
    body: 'I\'ll forget some tests and most of the homework. I won\'t forget the terrible group photo, the paper snowflakes, or the people who made an ordinary Tuesday feel important.',
    hint: '3 memory/celebration flags and 2 relationships above +30.',
  },
  {
    id: 'missed', n: 'The Missed Connection', bad: 1,
    q: '“Silence can make choices for you, too.”',
    moral: 'Avoiding every uncomfortable conversation can let a fixable distance become permanent.',
    body: 'I kept waiting for someone else to make the first move. By the time I wanted to fix things, everyone had already learned to stop trying. I wish I\'d understood that silence can make choices for you, too.',
    hint: '3 relationships below -25, POP under 25.',
  },
  {
    id: 'crown', n: 'The Lonely Crown', bad: 1,
    q: '“They knew my reputation, not me.”',
    moral: 'Being admired by many is not the same as being known by anyone.',
    body: 'Everyone knew my name. That was the problem: they knew my reputation, not me. When the music stopped, I had nobody I could talk to honestly.',
    hint: 'POP 50+, fewer than two relationships above +20.',
  },
  {
    id: 'lucky', n: 'The Lucky Escapist', bad: 1,
    q: '“No one caught me this time.”',
    moral: 'Getting away with a choice doesn\'t make the choice fair or harmless.',
    body: 'I got away with more than I deserved. Maybe that\'s why I kept doing it. I can\'t call it proof that I was right — only proof that no one caught me this time.',
    hint: 'Cheat or blame-shift without ever being caught.',
  },
  {
    id: 'unfinished', n: 'The Unfinished Story',
    q: '“Growing up is learning what to carry forward.”',
    moral: 'One school year doesn\'t define a person; the next choices still matter.',
    body: 'I don\'t have a perfect ending. Some people wave when I pass; some still look away. I did things I\'m proud of and things I\'d redo. Maybe growing up is learning what to carry forward — and what to leave here.',
    hint: 'Anything that fits no other ending.',
  },
];
// the "expansion" endings e17..e70 come from data.js; e23..e52 are character endings (ch: 1, see CHEND)
const BAD_EXT = [21, 56, 58, 67]; // expansion endings that are "hard" endings
(D.endx || []).forEach(e => ENDINGS.push({
  id: 'e' + e.num, n: e.n, q: e.q, body: '', moral: e.moral, hint: e.hint, ext: true, num: e.num,
  bad: BAD_EXT.includes(e.num) ? 1 : 0, ch: e.num >= 23 && e.num <= 52 ? 1 : 0,
}));
const ENDBY = {}; // id -> ending
ENDINGS.forEach(e => ENDBY[e.id] = e);
ENDBY.e17.hint = 'POP stays at thirty or lower for twenty school days in a row; relationships with at least two high-status/popular students are below -25; relationships with at least three less-popular or overlooked students are +35 or higher; at least two flags such as STOOD_UP, INCLUDED_SOMEONE, or BALL_REPAIR are set.';
ENDBY.e18.hint = 'POP stays at thirty or lower for twenty school days in a row; at least three relationships are +40 or higher among students the MC has helped or included; at least one shared-activity flag is set.';
// Numbers the endings are built on. cnt(f) counts classmates whose relationship passes f;
// fl(FLAG) reads a flag; c50 = classmates above +50, c25 = at +25 or more, etc.
function stats(S) {
  const kids = KIDS.map(n => S.rel[n]);
  const cnt = f => kids.filter(f).length;
  const fl = n => F(S, n);
  const sum = a => a.reduce((s, n) => s + fl(n), 0); // total times these flags were set
  const kind = sum([
    'INCLUDED_SOMEONE', 'MADE_SPACE', 'HELPED_TEAMMATE', 'INCLUSIVE_TEAMWORK', 'EARLY_KINDNESS', 'QUIET_KINDNESS', 'STOOD_UP',
    'STEPPED_UP', 'STOPPED_PRANK', 'EARTH_DAY_HELP', 'ENCOURAGEMENT', 'KINDNESS_NOTE', 'WINTER_INCLUSIVE', 'PEDAGO_HELPED',
  ]);
  // number of different flags set
  const courage = [
    'INCLUSIVE_TEAMWORK', 'STOOD_UP', 'STOPPED_PRANK', 'EARTH_DAY_HELP', 'QUIET_KINDNESS', 'MADE_SPACE', 'STEPPED_UP', 'INCLUDED_SOMEONE',
  ].filter(n => fl(n) > 0).length;
  const repairFlags = sum([
    'HELPED_TEAMMATE', 'MADE_SPACE', 'ENCOURAGEMENT', 'BALL_REPAIR', 'STOOD_UP', 'RESPECTFUL_VOICE', 'APOLOGIZED_SPECIFIC',
    'PUBLIC_ACCOUNTABILITY', 'RECONCILE_TRIED',
  ]);
  const memFlags = [
    'SINCERE_YEARBOOK', 'FUNNY_YEARBOOK', 'FRIENDSHIP_CARD', 'GRATITUDE_ENDING', 'LOYAL_FAREWELL', 'HALLOWEEN_PARTICIPATED',
    'WINTER_INCLUSIVE', 'SHARED_SPOTLIGHT', 'FIELD_DAY_SUPPORT', 'KINDNESS_NOTE', 'GRACIOUS_AWARD', 'BALL_CLOSE_FRIEND', 'INCLUSIVE_PHOTO',
  ].filter(n => fl(n) > 0).length;
  // rough = relationships that once fell below -10; redeemed = of those, apologized to and up 10+ since
  const redeemed = KIDS.filter(n => S.min[n] < -10 && S.apol[n] && S.rel[n] - S.min[n] >= 10).length;
  const rough = KIDS.filter(n => S.min[n] < -10).length;
  const second = KIDS.filter(n => S.min[n] <= -10 && S.rel[n] >= 20 && (S.apol[n] || F(S, 'RECONCILE_TRIED') || F(S, 'BALL_REPAIR'))).length;
  const selfDir = ['BALL_INDEPENDENT', 'STAYED_OUT', 'CREATIVE_SHARE'].filter(n => fl(n) > 0).length;
  return {
    cnt, fl, kind, courage, repairFlags, memFlags, redeemed, rough, second, selfDir,
    maxRel: Math.max.apply(null, kids),
    c50: cnt(v => v > 50), c20: cnt(v => v > 20), c25: cnt(v => v >= 25), c30: cnt(v => v > 30), c40: cnt(v => v >= 40),
    cNeg25: cnt(v => v < -25), min20: cnt(v => v >= 20),
  };
}
// Character endings: id -> [name, minRel, maxRel (excluded), requirement]. The requirement is
// read by reqOk(): groups joined by '&' must all be true. In a group:
//   F:FLAG  flag set          I:a+b>=N  interactions a + b with them (see the note in reqOk)
//   N:FLAG  flag never set    H0        you never hurt them
//   G:N     grade up N+ since day 1     R:N  N+ reconciliations with them
//   x|y     either one        F:A+F:B>=N  at least N of these flags
const CHEND = {
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
// Note: a trailing ">=N" is first taken off the whole group (as `need`), and `need` is only used
// by the "F:A+F:B>=N" form. So in "I:a+b>=2" the I: token is then read without its ">=2" and
// counts as ">=1". This is how the game currently behaves.
function reqOk(S, name, spec) {
  const IH = (S.ih || {})[name] || {};
  return spec.split('&').every(grp => {
    grp = grp.trim();
    const g = grp.match(/^(.*?)>=(\d+)$/);
    const need = g ? +g[2] : 1;
    const body = g ? g[1] : grp;
    if (body === 'H0') return !((S.hurt || {})[name]);
    if (body === 'N:' + body.slice(2) && body.startsWith('N:')) return !F(S, body.slice(2));
    if (body.startsWith('G:')) return S.grade - S.startGrade >= +body.slice(2);
    // "F:A+F:B>=N": count the flags that are set
    if (body.indexOf('F:') === 0 && body.indexOf('+') > 0 && g) {
      return body.split('+').reduce((n, t) => n + (F(S, t.replace('F:', '')) > 0 ? 1 : 0), 0) >= need;
    }
    // OR-group of tokens
    return body.split('|').some(tok => {
      tok = tok.trim();
      if (tok.startsWith('F:')) return F(S, tok.slice(2)) > 0;
      if (tok.startsWith('I:')) {
        const [ids, n] = tok.slice(2).split('>=');
        return ids.split('+').reduce((a, id) => a + (IH[id] || 0), 0) >= (n ? +n : 1);
      }
      if (tok.startsWith('G:')) return S.grade - S.startGrade >= +tok.slice(2);
      if (tok.startsWith('N:')) return !F(S, tok.slice(2));
      if (tok.startsWith('R:')) return ((S.recon || {})[name] || 0) >= +tok.slice(2);
      return false;
    });
  });
}
// Every ending's condition, as { id: truthy / falsy }. The key order is kept stable on purpose.
function checks(S) {
  const x = stats(S);
  const fl = x.fl;
  const hyp = (fl('HYPOCRISY') || fl('HYPOCRISY_EXPOSED') || fl('FAKE_KINDNESS')) > 0;
  const lowRels = D.chars.filter(c => c.role === 'kid' && S.rel[c.n] < -20).length;
  const hypo = hyp && S.gossip >= 3 && lowRels >= 2;
  const o = {};
  o.hypocrite = hypo;
  o.saint = x.c50 >= 20 && x.min20 >= 30 && S.started === 0 && !fl('FOLLOWED_HIERARCHY') && !fl('GOSSIP');
  o.redemption = x.rough >= 2 && x.redeemed >= 2 && (fl('BALL_REPAIR') || fl('PUBLIC_ACCOUNTABILITY'));
  o.genuine = x.c50 >= 3 && !fl('HYPOCRISY_EXPOSED') && x.kind >= 3;
  o.courageous = x.courage >= 3 && x.maxRel >= 35
    && fl('STOOD_UP') + fl('INCLUSIVE_TEAMWORK') + fl('STOPPED_PRANK') + fl('EARTH_DAY_HELP') > 0;
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
  o.lucky = (fl('CHEATED_ONCE') || fl('BLAME_SHIFT')) && S.caught === 0 && (S.grade >= 70 || S.pop >= 60)
    && !(fl('PUBLIC_ACCOUNTABILITY') || fl('LAST_DAY_APOLOGY') || fl('BALL_REPAIR'));
  // ---- expansion pack
  const K = D.chars.filter(c => c.role === 'kid');
  const rel = n => S.rel[n];
  // classmates by their own popularity
  const hi = K.filter(c => c.pop >= 70).map(c => c.n);
  const lo = K.filter(c => c.pop <= 40).map(c => c.n);
  const vlo = K.filter(c => c.pop <= 35).map(c => c.n);
  const top = K.filter(c => c.pop >= 80).map(c => c.n);
  const cntIn = (arr, f) => arr.filter(n => f(rel(n))).length;
  const sumF = a => a.reduce((n, f) => n + (F(S, f) || 0), 0);
  const cruel = sumF([
    'PUBLIC_JAB', 'PUBLIC_MOCKERY', 'MOCKED_WORK', 'MOCKED_INTEREST', 'LASTING_INSULT', 'FINAL_CRUELTY', 'CRUEL_CARD_PRANK',
    'POOR_SPORTSMANSHIP', 'GIFT_MOCKERY',
  ]);
  const volunteer = sumF([
    'EARTH_DAY_HELP', 'FIELD_DAY_SUPPORT', 'QUIET_KINDNESS', 'MIDYEAR_HELP', 'MADE_SPACE', 'BALL_BACKSTAGE', 'PLANT_CARE', 'WINTER_INCLUSIVE',
  ]) + S.jobsDone;
  const posF = x.kind + sumF(['SINCERE_COMPLIMENT', 'GRACIOUS_AWARD', 'SHARED_CREDIT']);
  const negF = cruel + sumF(['BLAME_SHIFT', 'STOLE_CREDIT', 'GOSSIP', 'GRADE_LIE', 'HYPOCRISY', 'BALL_EXCLUSION']);
  const betray = K.filter(c => S.rel[c.n] < -50).map(c => c.n);
  const sec = K.filter(c => (S.ih[c.n] || {}).secret && !(S.hurt[c.n]) && rel(c.n) >= 40); // shared a secret, never hurt, 40+
  const lunches = Object.keys(S.ih || {}).reduce((a, n) => a + (S.ih[n].lunch || 0), 0);
  const groups = Object.keys(S.ih || {}).reduce((a, n) => a + (S.ih[n].group || 0), 0);
  const giftTos = Object.keys(S.giftTo || {});
  o.e17 = (S.lowMax || 0) >= 20 && cntIn(top, v => v < -25) >= 2 && cntIn(vlo, v => v >= 35) >= 3
    && (fl('STOOD_UP') + fl('INCLUDED_SOMEONE') + fl('BALL_REPAIR')) >= 2;
  o.e18 = (S.lowMax || 0) >= 20 && cntIn(lo, v => v >= 40) >= 3 && (S.freeActs + lunches + groups) >= 1;
  o.e19 = S.pop >= 45 && cntIn(hi, v => v >= 30) >= 3 && !fl('HYPOCRISY_EXPOSED')
    && sumF(['HELPED_TEAMMATE', 'SHARED_CREDIT', 'SHARED_SPOTLIGHT', 'FAIR_WORK', 'ASKED_FOR_HELP']) >= 2;
  o.e20 = cntIn(hi, v => v >= 25) >= 2 && cntIn(lo, v => v >= 25) >= 2 && (x.repairFlags >= 2 || groups >= 2);
  o.e21 = cruel >= 3 && x.cNeg25 >= 3 && (S.retal || 0) >= 2 && (S.apolN || 0) + fl('RECONCILE_TRIED') < 2;
  o.e22 = x.repairFlags >= 3 && KIDS.filter(n => S.min[n] <= -10 && S.rel[n] > 15).length >= 2 && fl('REFUSED_BLAME') >= 1;
  // character endings e23..e52
  Object.keys(CHEND).forEach(id => {
    const [nm, mn, mx, req] = CHEND[id];
    o[id] = rel(nm) >= mn && rel(nm) < mx && reqOk(S, nm, req);
  });
  o.e53 = (S.investN || 0) >= 3 && (S.corrected || 0) >= 2 && S.gossip <= 1;
  o.e54 = fl('INVESTIGATED_RUMOUR') > 0 && (S.corrected || 0) >= 1 && S.started === 0 && !fl('BLAME_SHIFT') && S.gossip <= 1;
  o.e55 = sec.length >= 1 || fl('SECRET_KEPT') >= 2;
  o.e56 = S.gossip >= 2 && S.started >= 1 && x.cNeg25 >= 2 && (fl('SHARED_SECRET') > 0 || fl('SECRET_SPILLED') > 0);
  o.e57 = (S.apolN || 0) >= 3 && fl('APOLOGIZED_SPECIFIC') > 0 && (S.accepted || 0) >= 1 && (S.refused || 0) >= 1 && (S.vague || 0) === 0;
  // (&& binds tighter than ||: vague >= 1, OR [no public accountability and 2+ apologies, none specific])
  o.e58 = ((S.vague || 0) >= 1 || fl('PUBLIC_ACCOUNTABILITY') === 0 && (S.apolN || 0) >= 2 && !fl('APOLOGIZED_SPECIFIC'))
    && (S.refused || 0) >= 2;
  o.e59 = lunches >= 4 && x.c20 >= 4;
  o.e60 = S.grade >= 90 && x.cnt(v => v > 10) < 2 && x.kind === 0 && S.freeActs === 0;
  o.e61 = S.money >= 50 && S.earned >= 50 && (S.lentN || 0) + (S.boundaryN || 0) + (S.giftN || 0) >= 2;
  o.e62 = S.money <= 5 && (S.giftN || 0) >= 3 && giftTos.some(n => rel(n) < 10);
  o.e63 = fl('BALL_BACKSTAGE') > 0 && volunteer >= 3
    && ['Emma Clarke', 'Adrian Flores', 'Maya Bennett', 'Chloe Rivera', 'Naomi Brooks'].some(n => rel(n) > 30);
  o.e64 = (fl('BALL_INCLUSIVE_PLAN') || fl('BALL_BACKSTAGE')) > 0 && x.repairFlags >= 2 && fl('BALL_GLAMOUR') === 0;
  o.e65 = !S.ballDate && !fl('BALL_DANCE')
    && (fl('BALL_INDEPENDENT') || fl('BALL_BACKSTAGE') || fl('BALL_WALLFLOWER') || fl('BALL_SETUP_HELP')) > 0 && x.c20 >= 2;
  o.e66 = KIDS.some(n => S.min[n] < -10 && S.rel[n] >= 35 && !(S.hurt[n] > 2));
  o.e67 = betray.some(n => !(S.apol[n]) && !F(S, 'RECONCILE_TRIED'));
  o.e68 = KIDS.some(n => S.min[n] <= -40 && S.rel[n] >= 10 && (S.apol[n] || 0) >= 1) && x.repairFlags >= 3;
  o.e69 = posF >= 3 && negF >= 3 && KIDS.some(n => rel(n) >= 30) && KIDS.some(n => rel(n) <= -20)
    && KIDS.some(n => rel(n) > -10 && rel(n) < 20);
  // phone endings
  const hang = Object.values(S.ih || {}).reduce((a, h) => a + (h.hangout || 0), 0);
  const c40 = KIDS.filter(n => S.rel[n] >= 40).length, lo10 = KIDS.filter(n => S.rel[n] < -10).length;
  o.ph_screen = (S.phoneN || 0) >= 520 && hang <= 3;
  o.ph_keeper = (S.gcN || 0) >= 60 && (S.gcDef || 0) >= 6 && (S.gcLaugh || 0) <= 1 && S.pop >= 45;
  o.ph_screenshot = (S.gcLaugh || 0) >= 5 && lowRels >= 2;
  o.ph_read = (S.phIgn || 0) >= 6 && lo10 >= 2;
  o.ph_line = F(S, 'REVEAL_DONE') > 0 && !!(S.meta && S.meta.clues >= 12) && (S.phoneN || 0) >= 100;
  o.ph_score = (S.pgN || 0) >= 100 && (S.pgPerf || 0) >= 40;
  o.ph_face = (S.phoneN || 0) <= 25 && hang >= 20 && c40 >= 7;
  o.e70 = !!S.ngp;
  o.unfinished = true;
  return o;
}
// General endings, by priority: the first one that is true becomes the main ending.
const BROAD = [
  'hypocrite', 'e21', 'e56', 'e67', 'saint', 'ph_screenshot', 'ph_read', 'ph_screen', 'ph_line', 'ph_keeper',
  'redemption', 'e68', 'e17', 'e22', 'e18', 'genuine', 'courageous', 'peacemaker', 'e20', 'e19',
  'e53', 'e54', 'e55', 'e57', 'e59', 'e63', 'e64', 'e66', 'comeback', 'scholar',
  'selfmade', 'broke', 'e61', 'e62', 'e60', 'independent', 'e65', 'second', 'memory', 'e58',
  'missed', 'ph_score', 'ph_face', 'crown', 'lucky', 'e69',
];
const PRIORITY = BROAD.concat(['unfinished']); // (unused)
// The year's ending: the first true BROAD ending, else the best character ending, else
// 'unfinished'. epi (epilogue) = one more general ending (not a hard one after a good one),
// two character endings (best relationship first), and e70 (New Game+) when it applies.
function evaluateEnding(S) {
  const o = checks(S);
  const chars = Object.keys(CHEND).filter(id => o[id]).sort((a, b) => S.rel[CHEND[b][0]] - S.rel[CHEND[a][0]]);
  const hit = BROAD.filter(id => o[id]);
  let primary = hit[0], rest = hit.slice(1);
  if (!primary) {
    primary = chars[0] || 'unfinished';
    if (chars[0]) chars.shift();
  }
  const epi = rest.filter(id => !(ENDBY[id].bad && !ENDBY[primary].bad)).slice(0, 1).concat(chars.slice(0, 2));
  if (o.e70 && primary !== 'e70') epi.push('e70');
  return { id: primary, epi, all: hit.concat(chars), chars };
}
