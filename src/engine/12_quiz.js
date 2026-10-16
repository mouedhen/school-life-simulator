/* engine/12_quiz.js — quiz(): questions for exam / test / quiz days. */
'use strict';
/* ---------- quiz mini-games ---------- */
// QB: questions by subject: [question, right answer, [wrong answers]]
const QB = {
  english: [
    ['Which word is a synonym of "happy"?', 'joyful', ['gloomy', 'angry', 'sleepy']],
    ['Pick the correct spelling.', 'receive', ['recieve', 'receeve', 'riceive']],
    ['Which sentence is correct?', 'They are going to their house.', ['Their going to there house.', 'They\'re going to there house.', 'Their going too they\'re house.']],
    ['What is the opposite of "ancient"?', 'modern', ['old', 'dusty', 'distant']],
    ['Which is a noun?', 'bridge', ['quickly', 'jump', 'bright']],
    ['A word that describes a verb is a...', 'adverb', ['noun', 'pronoun', 'article']],
    ['Pick the plural of "mouse".', 'mice', ['mouses', 'mices', 'mouse']],
    ['Which has correct punctuation?', 'Wait, I forgot my book!', ['Wait I forgot, my book!', 'Wait I forgot my book', 'Wait, I forgot my book,']],
    ['"Her smile was as bright as the sun" is a...', 'simile', ['metaphor', 'rhyme', 'riddle']],
    ['The main character of a story is the...', 'protagonist', ['setting', 'theme', 'narrator']],
    ['Which word means "very tired"?', 'exhausted', ['energetic', 'curious', 'generous']],
    ['Choose the past tense of "run".', 'ran', ['runned', 'running', 'runs']],
  ],
  science: [
    ['Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Mars', 'Earth']],
    ['Water freezes at...', '0 °C', ['10 °C', '100 °C', '-10 °C']],
    ['Plants take in which gas?', 'carbon dioxide', ['helium', 'nitrogen', 'methane']],
    ['Which is a solid at room temperature?', 'rock', ['milk', 'steam', 'air']],
    ['What do bees help plants do?', 'pollinate', ['freeze', 'evaporate', 'erode']],
    ['Which organ pumps blood?', 'heart', ['lungs', 'stomach', 'brain']],
    ['The force pulling things to Earth is...', 'gravity', ['friction', 'magnetism', 'sound']],
    ['A baby frog is called a...', 'tadpole', ['cub', 'pup', 'larva fish']],
    ['Which is a renewable energy source?', 'wind', ['coal', 'oil', 'gas']],
    ['What do we call animals that eat only plants?', 'herbivores', ['carnivores', 'omnivores', 'predators']],
    ['Sound travels fastest through...', 'solids', ['gases', 'a vacuum', 'empty space']],
    ['What is the center of an atom called?', 'nucleus', ['orbit', 'cell', 'shell']],
  ],
  social: [
    ['What is the capital of Canada?', 'Ottawa', ['Toronto', 'Montreal', 'Vancouver']],
    ['A map key is also called a...', 'legend', ['scale', 'compass', 'grid']],
    ['Which direction is opposite north?', 'south', ['east', 'west', 'up']],
    ['A community leader elected by a town is the...', 'mayor', ['principal', 'judge', 'pilot']],
    ['Which ocean is on Canada\'s west coast?', 'Pacific', ['Atlantic', 'Indian', 'Arctic']],
    ['Where does a river meet the sea?', 'mouth', ['source', 'bank', 'bend']],
    ['What do we call rules made by a government?', 'laws', ['recipes', 'maps', 'rhymes']],
    ['A group of people living together in a place is a...', 'community', ['orchestra', 'planet', 'desert']],
    ['Which is a natural resource?', 'forest', ['highway', 'school', 'phone']],
    ['Which language is official in Quebec?', 'French', ['Latin', 'Spanish', 'German']],
  ],
  general: [
    ['How many days are in a leap year?', '366', ['365', '364', '360']],
    ['Which is the largest mammal?', 'blue whale', ['elephant', 'giraffe', 'hippo']],
    ['How many sides does a hexagon have?', '6', ['5', '8', '7']],
    ['Which season comes after winter?', 'spring', ['autumn', 'summer', 'monsoon']],
    ['What colour do you get mixing blue and yellow?', 'green', ['purple', 'orange', 'brown']],
    ['How many minutes in two hours?', '120', ['100', '90', '180']],
    ['Which instrument has black and white keys?', 'piano', ['flute', 'drum', 'violin']],
    ['How many continents are there?', '7', ['5', '6', '8']],
    ['Which is the fastest land animal?', 'cheetah', ['horse', 'lion', 'rabbit']],
    ['What do we call frozen rain?', 'hail', ['dew', 'fog', 'mist']],
  ],
};
// a random math question with 4 options (r = local generator)
function mathQ(r) {
  const k = Math.floor(r() * 6);
  const R = (a, b) => a + Math.floor(r() * (b - a + 1));
  let q, a;
  if (k === 0) {
    const x = R(3, 12), y = R(3, 12);
    q = x + ' × ' + y;
    a = x * y;
  } else if (k === 1) {
    const x = R(20, 90), y = R(10, 60);
    q = x + ' + ' + y;
    a = x + y;
  } else if (k === 2) {
    const y = R(3, 9), x = y * R(3, 12);
    q = x + ' ÷ ' + y;
    a = x / y;
  } else if (k === 3) {
    const w = R(3, 12), h = R(3, 12);
    q = 'perimeter of a ' + w + ' by ' + h + ' rectangle';
    a = 2 * (w + h);
  } else if (k === 4) {
    const d = R(3, 9), x = R(1, d - 2), y = R(1, d - 2);
    q = 'the top number: ' + x + '/' + d + ' + ' + y + '/' + d + ' = ?/' + d;
    a = x + y;
  } else {
    const p = [10, 20, 25, 50][R(0, 3)], n = [20, 40, 60, 80, 100][R(0, 4)];
    q = p + '% of ' + n;
    a = n * p / 100;
  }
  // three wrong answers near the right one
  const set = new Set([a]);
  while (set.size < 4) {
    const d = [-10, -2, -1, 1, 2, 10, 3, -3][Math.floor(r() * 8)];
    const w = a + d;
    if (w > 0) set.add(w);
  }
  return { q: 'What is ' + q + '?', o: shuffle([...set].map(String), r), a: String(a) };
}
// the quiz subject, from words in the title, else from the teacher of the day
function quizSubject(title, teacher, r) {
  const t = title || '';
  if (/math|fraction|multipl|measure|number|graph|data|geometry/i.test(t) || teacher === 'Mr. Daniel Brooks') return 'math';
  if (/english|writing|story|reading|library|book|poem|grammar|spelling|vocab/i.test(t) || teacher === 'Ms. Harper Ellis') return 'english';
  if (/science|stem|nature|earth|plant|weather/i.test(t)) return 'science';
  if (/social|map|communit|history/i.test(t)) return 'social';
  if (teacher === 'Ms. Priya Shah' || teacher === 'Mr. Marcus Reed') return 'memory';
  return r() < 0.5 ? 'general' : 'science';
}
const QUIZ_LABEL = { math: 'Math sprint', english: 'Language quiz', science: 'Science quiz', social: 'Social studies quiz', general: 'General knowledge quiz', memory: 'Memory match' };
// the mini-game for an exam / test / quiz event: 3 questions, or a memory game (art, PE).
// Fixed for a given seed, day and title.
function quiz(S, title) {
  const r = mul(hash(S.seed + 'quiz' + S.di + (title || '')));
  const teacher = teacherFor(title || dayOf(S).t, null);
  const subj = quizSubject(title, teacher, r);
  const label = QUIZ_LABEL[subj];
  if (subj === 'memory') return { type: 'memory', subj, label, seed: Math.floor(r() * 1e9) };
  let qs = [];
  if (subj === 'math') for (let i = 0; i < 3; i++) qs.push(mathQ(r));
  else shuffle(QB[subj], r).slice(0, 3).forEach(x => qs.push({ q: x[0], o: shuffle([x[1]].concat(x[2]), r), a: x[1] }));
  return { type: 'quiz', subj, label, qs, hints: hintsFor(S) };
}
