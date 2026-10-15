p='engine.js';s=open(p).read()
def rep(a,b):
    global s
    assert a in s, 'MISSING: '+a[:70]
    s=s.replace(a,b,1)

# ---- shop extras
rep("SHOP.forEach(s => { const k = SHOPKIND[s.n] || ['gift', '']; s.kind = k[0]; s.use = k[1]; });",
"""const EXTRA = [
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
EXTRA.forEach(x => { SHOP.push({ id: SHOP.length, n: x[0], price: x[1], note: x[3] }); SHOPKIND[x[0]] = [x[2], x[3]]; });
SHOP.forEach(s => { const k = SHOPKIND[s.n] || ['gift', '']; s.kind = k[0]; s.use = k[1]; });""")

# ---- interactions list
rep("  { id: 'reconcile', n: 'Try to reconcile', cost: 1, who: 'tense_enemy', gate: 'rel<=-10' },\n];",
"""  { id: 'reconcile', n: 'Try to reconcile', cost: 1, who: 'tense_enemy', gate: 'rel<=-10' },
  { id: 'talkabout', n: 'Talk about someone', cost: 1, who: 'all' },
  { id: 'secret', n: 'Share a secret', cost: 1, who: 'friendly', gate: 'rel>=20' },
  { id: 'advice', n: 'Ask for advice', cost: 0, who: 'all', daily: 1 },
  { id: 'lunch', n: 'Sit together at lunch', cost: 1, who: 'all' },
  { id: 'message', n: 'Send a message', cost: 0, who: 'all', daily: 1 },
  { id: 'tease', n: 'Tease playfully', cost: 0, who: 'friendly', gate: 'rel>=10' },
  { id: 'cheer', n: 'Cheer them up', cost: 1, who: 'all' },
  { id: 'collab', n: 'Work on a project together', cost: 1, who: 'classmate' },
  { id: 'joingroup', n: 'Ask to join their group', cost: 1, who: 'popular' },
];""")
rep("const TEACHER_OK = new Set(['talk', 'compliment', 'askhelp', 'apologize', 'boundary', 'end', 'defend']);","const TEACHER_OK = new Set(['talk', 'compliment', 'askhelp', 'apologize', 'boundary', 'end', 'defend', 'advice', 'message']);")
rep("const FAMILY_NO = new Set(['start', 'fight', 'prank', 'study', 'group', 'debate']);","const FAMILY_NO = new Set(['start', 'fight', 'prank', 'study', 'group', 'debate', 'joingroup', 'lunch', 'collab']);")
rep("      case 'fight': if (v > -40) { ok = false; why = 'Only with high conflict (-40).'; } break;",
"""      case 'fight': if (v > -40) { ok = false; why = 'Only with high conflict (-40).'; } break;
      case 'secret': if (v < 20) { ok = false; why = 'Needs Friend (+20).'; } break;
      case 'tease': if (v < 10) { ok = false; why = 'Needs a warm relationship (+10).'; } break;
      case 'advice': case 'cheer': if (v < -20) { ok = false; why = 'Too much conflict right now.'; } break;
      case 'collab': if (v < 5) { ok = false; why = 'Needs a little rapport (+5).'; } break;
      case 'joingroup': if (!(c.pop >= 60)) { ok = false; why = 'Only popular groups (their POP 60+).'; } else if (v < 0) { ok = false; why = 'They need to like you first.'; } break;""")

# ---- boosters in hangout
rep("      else if (arg === 'Fancy snack box' && S.inv['Fancy snack box'] > 0) { S.inv['Fancy snack box']--; g += 2; bits.push('snacks'); }",
"      else if (arg === 'Fancy snack box' && S.inv['Fancy snack box'] > 0) { S.inv['Fancy snack box']--; g += 2; bits.push('snacks'); }\n      else if (arg === 'Concert ticket' && S.inv['Concert ticket'] > 0) { S.inv['Concert ticket']--; g += 4; bits.push('concert'); }")

# ---- new interaction cases (insert before case 'boundary')
rep("    case 'boundary': {","""    case 'talkabout': {
      const parts = String(arg || '').split('|'); const subj = parts[0], tone = parts[1] || 'neutral';
      const B = CH[subj];
      if (!B || subj === name) { S.blocks += it.cost; S.today['i_' + name + id]--; return { err: 'Pick someone else to talk about.' }; }
      const link = (LINKS[name] || []).find(l => l[0] === subj); const k = link ? link[1] : 0;
      const rb = S.rel[subj];
      logt = 'Talked about ' + subj + ' with ' + name;
      if (tone === 'bad') {
        S.gossip++; setFlag(S, 'GOSSIP'); ch.push({ k: 'gossip', v: 1 });
        S.talked = S.talked || {}; S.talked[subj] = (S.talked[subj] || 0) + 1;
        if (rb >= 15) { setFlag(S, 'HYPOCRISY'); lines.push('You smile at ' + subj + ' in person, but here you are tearing them apart.'); }
        if (k < 0) { addRel(S, name, 3, ch); addPop(S, 1, ch); lines.push(name + ' laughs. They do not like ' + subj + ' either.'); }
        else if (k >= 2) { addRel(S, name, -3, ch); lines.push(name + ' frowns. ' + subj + ' is a close friend of theirs.'); }
        else { addRel(S, name, 1, ch); lines.push(name + ' listens with interest.'); }
        const reach = clamp(55 + 10 * Math.min(3, closeFriends(S, subj)) + (k >= 2 ? 20 : 0), 0, 90);
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
    case 'boundary': {""")

# ---- prep helpers and academic
rep("""function acadChance(S, extra) {
  let prep = S.prep + (extra || 0) + ((S.inv['Notebook & pen set'] || 0) > 0 ? 10 : 0);
  return clamp(Math.round(35 + S.grade / 2 + prep), 5, 95);
}""","""function prepItem(S) { return (S.inv['Study guide'] > 0) ? ['Study guide', 20] : (S.inv['Notebook & pen set'] > 0) ? ['Notebook & pen set', 10] : null; }
function acadChance(S, extra) {
  const pi = prepItem(S);
  let prep = S.prep + (extra || 0) + (pi ? pi[1] : 0) + (S.perm['Calculator'] ? 5 : 0) + (S.luck ? 10 : 0);
  return clamp(Math.round(35 + S.grade / 2 + prep), 5, 95);
}
function hintsFor(S) { const pi = prepItem(S); return Math.min(3, Math.floor((S.prep + (pi ? pi[1] : 0)) / 10) + (S.perm['Calculator'] ? 1 : 0)); }""")
rep("""    const chance = acadChance(S);
    if ((S.inv['Notebook & pen set'] || 0) > 0) { S.inv['Notebook & pen set']--; lines.push('Your notebook & pen set helped.'); }
    S.prep = 0;
    const ok = rnd(S) * 100 < chance;
    lines.push(ok ? 'Study check passed (' + chance + '%).' : 'Study check failed (' + chance + '%).');""","""    const chance = acadChance(S);
    const pi = prepItem(S);
    if (pi) { S.inv[pi[0]]--; lines.push('Your ' + pi[0].toLowerCase() + ' helped.'); }
    S.prep = 0; S.luck = 0;
    const mg = extra && extra.mg;
    let ok;
    if (mg) { ok = mg.q >= 0.6; lines.push('Mini-game: ' + mg.label + (ok ? ' - passed.' : ' - not enough.')); }
    else { ok = rnd(S) * 100 < chance; lines.push(ok ? 'Study check passed (' + chance + '%).' : 'Study check failed (' + chance + '%).'); }
    if (mg && ok && mg.q >= 0.999) addGrade(S, 1, ch);""")
rep("    if (/subtle|quiet|glance|careful/i.test(c.x || '')) { chance -= 10; mods.push('subtle -10'); }","    if (/subtle|quiet|glance|careful/i.test(c.x || '')) { chance -= 10; mods.push('subtle -10'); }\n    if (S.luck) { chance -= 10; mods.push('lucky charm -10'); S.luck = 0; }")
rep("  S.prep = Math.min(30, S.prep + 10); setFlag(S, 'STUDIED');\n  logAdd(S, 'Studied after school', ch);\n  return result(ch, ['Next study check +10%.']);","  const pv = S.perm['Flashcards'] ? 15 : 10;\n  S.prep = Math.min(40, S.prep + pv); setFlag(S, 'STUDIED');\n  logAdd(S, 'Studied after school', ch);\n  return result(ch, ['Next study check +' + pv + '%.']);")
rep("  if (dow === 1 && S.perm['Reusable water bottle']) b++;","  if (dow === 1 && S.perm['Reusable water bottle']) b++;\n  if (S.perm['Smartwatch']) b++;")
# gift items exclusion and use
rep("if (it.n === 'Mystery box' || it.n === 'Bicycle tune-up' || it.n === 'Craft kit') return;","if (['Mystery box', 'Bicycle tune-up', 'Craft kit', 'Tutoring session', 'Lucky charm', 'Friendship bracelet kit'].includes(it.n)) return;")
rep("  else if (name === 'Mystery box') {","""  else if (name === 'Tutoring session') { S.inv[name]--; addGrade(S, 2, ch); S.prep = Math.min(40, S.prep + 20); setFlag(S, 'ASKED_FOR_HELP'); lines.push('A tutor walks you through the tricky parts.'); }
  else if (name === 'Lucky charm') { S.inv[name]--; S.luck = 1; lines.push('You feel a little luckier.'); }
  else if (name === 'Friendship bracelet kit') { S.inv[name]--; S.inv['Handmade gift'] = (S.inv['Handmade gift'] || 0) + 2; setFlag(S, 'CREATIVE_SHARE'); lines.push('You made two handmade bracelets.'); }
  else if (name === 'Mystery box') {""")
rep("S.worn[name] = 1; addPop(S, 1, ch); lines.push('You look sharp.');","S.worn[name] = 1; addPop(S, ({ Hoodie: 2, 'Stylish backpack': 2 })[name] || 1, ch); lines.push('You look sharp.');")
# study interaction prep & talk to others unaffected
# ---- quiz generator
rep("/* ---------- rumor lookup for UI ---------- */","""/* ---------- mini-games ---------- */
const QB = {
  english: [['Which word is a synonym of "happy"?', 'joyful', ['gloomy', 'angry', 'sleepy']], ['Pick the correct spelling.', 'receive', ['recieve', 'receeve', 'riceive']], ['Which sentence is correct?', 'They are going to their house.', ['Their going to there house.', 'They\\'re going to there house.', 'Their going too they\\'re house.']], ['What is the opposite of "ancient"?', 'modern', ['old', 'dusty', 'distant']], ['Which is a noun?', 'bridge', ['quickly', 'jump', 'bright']], ['A word that describes a verb is a...', 'adverb', ['noun', 'pronoun', 'article']], ['Pick the plural of "mouse".', 'mice', ['mouses', 'mices', 'mouse']], ['Which has correct punctuation?', 'Wait, I forgot my book!', ['Wait I forgot, my book!', 'Wait I forgot my book', 'Wait, I forgot my book,']], ['"Her smile was as bright as the sun" is a...', 'simile', ['metaphor', 'rhyme', 'riddle']], ['The main character of a story is the...', 'protagonist', ['setting', 'theme', 'narrator']], ['Which word means "very tired"?', 'exhausted', ['energetic', 'curious', 'generous']], ['Choose the past tense of "run".', 'ran', ['runned', 'running', 'runs']]],
  science: [['Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Mars', 'Earth']], ['Water freezes at...', '0 °C', ['10 °C', '100 °C', '-10 °C']], ['Plants take in which gas?', 'carbon dioxide', ['helium', 'nitrogen', 'methane']], ['Which is a solid at room temperature?', 'rock', ['milk', 'steam', 'air']], ['What do bees help plants do?', 'pollinate', ['freeze', 'evaporate', 'erode']], ['Which organ pumps blood?', 'heart', ['lungs', 'stomach', 'brain']], ['The force pulling things to Earth is...', 'gravity', ['friction', 'magnetism', 'sound']], ['A baby frog is called a...', 'tadpole', ['cub', 'pup', 'larva fish']], ['Which is a renewable energy source?', 'wind', ['coal', 'oil', 'gas']], ['What do we call animals that eat only plants?', 'herbivores', ['carnivores', 'omnivores', 'predators']], ['Sound travels fastest through...', 'solids', ['gases', 'a vacuum', 'empty space']], ['What is the center of an atom called?', 'nucleus', ['orbit', 'cell', 'shell']]],
  social: [['What is the capital of Canada?', 'Ottawa', ['Toronto', 'Montreal', 'Vancouver']], ['A map key is also called a...', 'legend', ['scale', 'compass', 'grid']], ['Which direction is opposite north?', 'south', ['east', 'west', 'up']], ['A community leader elected by a town is the...', 'mayor', ['principal', 'judge', 'pilot']], ['Which ocean is on Canada\\'s west coast?', 'Pacific', ['Atlantic', 'Indian', 'Arctic']], ['Where does a river meet the sea?', 'mouth', ['source', 'bank', 'bend']], ['What do we call rules made by a government?', 'laws', ['recipes', 'maps', 'rhymes']], ['A group of people living together in a place is a...', 'community', ['orchestra', 'planet', 'desert']], ['Which is a natural resource?', 'forest', ['highway', 'school', 'phone']], ['Which language is official in Quebec?', 'French', ['Latin', 'Spanish', 'German']]],
  general: [['How many days are in a leap year?', '366', ['365', '364', '360']], ['Which is the largest mammal?', 'blue whale', ['elephant', 'giraffe', 'hippo']], ['How many sides does a hexagon have?', '6', ['5', '8', '7']], ['Which season comes after winter?', 'spring', ['autumn', 'summer', 'monsoon']], ['What colour do you get mixing blue and yellow?', 'green', ['purple', 'orange', 'brown']], ['How many minutes in two hours?', '120', ['100', '90', '180']], ['Which instrument has black and white keys?', 'piano', ['flute', 'drum', 'violin']], ['How many continents are there?', '7', ['5', '6', '8']], ['Which is the fastest land animal?', 'cheetah', ['horse', 'lion', 'rabbit']], ['What do we call frozen rain?', 'hail', ['dew', 'fog', 'mist']]],
};
function mathQ(r) {
  const k = Math.floor(r() * 6); const R = (a, b) => a + Math.floor(r() * (b - a + 1));
  let q, a;
  if (k === 0) { const x = R(3, 12), y = R(3, 12); q = x + ' × ' + y; a = x * y; }
  else if (k === 1) { const x = R(20, 90), y = R(10, 60); q = x + ' + ' + y; a = x + y; }
  else if (k === 2) { const y = R(3, 9), x = y * R(3, 12); q = x + ' ÷ ' + y; a = x / y; }
  else if (k === 3) { const w = R(3, 12), h = R(3, 12); q = 'Perimeter of a ' + w + ' by ' + h + ' rectangle'; a = 2 * (w + h); }
  else if (k === 4) { const d = R(3, 9), x = R(1, d - 2), y = R(1, d - 2); q = x + '/' + d + ' + ' + y + '/' + d + ' = ?/' + d; a = x + y; }
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

/* ---------- rumor lookup for UI ---------- */""")
rep("dayOf, acadChance,","dayOf, acadChance, quiz, hintsFor,")
open(p,'w').write(s)
