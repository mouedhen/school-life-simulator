/* engine/09_family.js — Family bonds (Dad, siblings), cooking with Mom, using items and giving gifts. */
'use strict';
/* ---------- family bonds ---------- */
// GIFTS: [HOLIDAYS scene id, family member, permanent item]. At relationship 100 the scene
// plays once (preDayEvent) and gives the item (choose).
const GIFTS = [
  ['knife', 'Mom', 'Cooking knife'],
  ['gift_dad', 'Dad', 'Dad\'s toolbox'],
  ['gift_riley', 'Riley', 'Riley\'s hidden card'],
  ['gift_max', 'Max', 'Max\'s lucky controller'],
  ['gift_oliver', 'Oliver', 'Oliver\'s varsity jacket'],
  ['gift_sophie', 'Sophie', 'Sophie\'s planner'],
];
// Activities with family, unlocked at relationship `need` (the last one also needs their gift
// item). cost in $, q = relationship gained, g / p = grade / POP, fam = +1 with the rest of the family.
const BONDS = {
  Dad: { item: 'Dad\'s toolbox', acts: [
    { id: 'flash', n: 'Hold the flashlight', cost: 0, need: 0, q: 1 },
    { id: 'bike', n: 'Fix a bike chain together', cost: 2, need: 25, q: 2 },
    { id: 'bird', n: 'Build a birdhouse', cost: 5, need: 50, q: 3, g: 1 },
    { id: 'pizza', n: 'Homemade pizza night', cost: 8, need: 75, q: 4, fam: 1 },
    { id: 'shelf', n: 'Build a bookshelf for your room', cost: 12, need: 100, q: 5, p: 1, item: 1 },
  ] },
  Riley: { item: 'Riley\'s hidden card', acts: [
    { id: 'draw', n: 'Draw together', cost: 0, need: 0, q: 1 },
    { id: 'fort', n: 'Build a blanket fort', cost: 1, need: 25, q: 2 },
    { id: 'trick', n: 'Teach the pet a new trick', cost: 0, need: 50, q: 3 },
    { id: 'stickers', n: 'Decorate your school supplies with stickers', cost: 3, need: 75, q: 4, p: 1 },
    { id: 'cards', n: 'Make cards for the whole family', cost: 4, need: 100, q: 5, fam: 1, item: 1 },
  ] },
  Max: { item: 'Max\'s lucky controller', acts: [
    { id: 'coop', n: 'Play a co-op game', cost: 0, need: 0, q: 1 },
    { id: 'dance', n: 'Learn his silly dance', cost: 0, need: 25, q: 2, p: 1 },
    { id: 'snack', n: 'Run a snack taste test', cost: 3, need: 50, q: 3 },
    { id: 'score', n: 'Chase his high score', cost: 0, need: 75, q: 4 },
    { id: 'tourney', n: 'Host a family game tournament', cost: 5, need: 100, q: 5, fam: 1, item: 1 },
  ] },
  Oliver: { item: 'Oliver\'s varsity jacket', acts: [
    { id: 'walk', n: 'Walk to school together', cost: 0, need: 0, q: 1 },
    { id: 'hoops', n: 'Shoot hoops', cost: 0, need: 25, q: 2, p: 1 },
    { id: 'meal', n: 'Make a meal together', cost: 5, need: 50, q: 3 },
    { id: 'plan', n: 'Plan a game night', cost: 6, need: 75, q: 4, p: 1 },
    { id: 'game', n: 'Go to the big game together', cost: 10, need: 100, q: 5, p: 2, item: 1 },
  ] },
  Sophie: { item: 'Sophie\'s planner', acts: [
    { id: 'hair', n: 'Try a hairstyle tutorial', cost: 0, need: 0, q: 1 },
    { id: 'room', n: 'Help with the room makeover', cost: 2, need: 25, q: 2 },
    { id: 'study', n: 'Study side by side', cost: 0, need: 50, q: 3, g: 1 },
    { id: 'talk', n: 'Have a late-night talk', cost: 2, need: 75, q: 4 },
    { id: 'term', n: 'Plan the whole term together', cost: 0, need: 100, q: 5, g: 1, item: 1 },
  ] },
};
const bondOk = (S, who, a) => S.rel[who] >= a.need && (!a.item || !!S.perm[BONDS[who].item]);
// one activity per family member per day, 1 time block
function bond(S, who, aid) {
  if (S.phase !== 'free') return null;
  const B = BONDS[who];
  if (!B) return null;
  const a = B.acts.find(x => x.id === aid);
  if (!a) return null;
  if (!bondOk(S, who, a)) return { err: 'You are not close enough for that yet.' };
  S.bondDay = S.bondDay || {};
  if (S.bondDay[who] === S.di) return { err: 'You already spent time together today.' };
  if (S.money < a.cost) return { err: 'Not enough money for that.' };
  if (S.blocks < 1) return { err: 'No time blocks left.' };
  const before = B.acts.filter(x => bondOk(S, who, x)).length;
  S.blocks -= 1;
  S.bondDay[who] = S.di;
  S.bondN = S.bondN || {};
  bump(S.bondN, who);
  const ch = [];
  if (a.cost) addMoney(S, -a.cost, ch);
  addRel(S, who, a.q, ch);
  if (a.g) addGrade(S, a.g, ch);
  if (a.p) addPop(S, a.p, ch);
  if (a.fam) ['Mom', 'Dad', 'Riley', 'Max', 'Oliver', 'Sophie'].filter(n => n !== who).forEach(n => addRel(S, n, 1, ch, true));
  setFlag(S, 'TIME_WITH_FAMILY');
  logAdd(S, 'Spent time with ' + who + ': ' + a.n, ch);
  const lines = ['You had a good time together.'];
  if (B.acts.filter(x => bondOk(S, who, x)).length > before) lines.push('A new activity with ' + who + ' is now unlocked.');
  return result(ch, lines);
}

/* ---------- cooking ---------- */
// Recipes unlock with Mom's relationship (mom); the signature dish also needs her knife.
// cost = ingredients in $, q = relationship gained by whoever eats it.
const RECIPES = [
  { id: 'eggs', n: 'Scrambled eggs', cost: 3, mom: 0, q: 1 },
  { id: 'pasta', n: 'Tomato pasta', cost: 6, mom: 25, q: 2 },
  { id: 'soup', n: 'Chicken soup', cost: 8, mom: 50, q: 3 },
  { id: 'stew', n: 'Slow-cooked stew', cost: 12, mom: 75, q: 4 },
  { id: 'sig', n: 'Mom\'s signature dish', cost: 15, mom: 100, q: 5, knife: 1 },
];
const cookLevel = S => Math.min(5, Math.floor((S.cookN || 0) / 3)); // +1 level every 3 dishes
const cookPrice = (S, r) => Math.max(1, r.cost - (S.perm['Cooking knife'] ? 2 : 0));
const recipeOk = (S, r) => S.rel.Mom >= r.mom && (!r.knife || !!S.perm['Cooking knife']);
// who: 'self' (grade +1), 'family' (Mom and Dad) or a classmate's name; once per day each
function cook(S, rid, who) {
  if (S.phase !== 'free') return null;
  const r = RECIPES.find(x => x.id === rid);
  if (!r) return null;
  if (who !== 'self' && who !== 'family' && !(CH[who] && CH[who].role === 'kid')) return null;
  if (!recipeOk(S, r)) return { err: 'Mom has not taught you this recipe yet.' };
  S.cookDay = S.cookDay || {};
  if (S.cookDay[who] === S.di) return { err: 'You already cooked for them today.' };
  const price = cookPrice(S, r);
  if (S.money < price) return { err: 'Not enough money for the ingredients.' };
  if (S.blocks < 1) return { err: 'No time blocks left.' };
  S.blocks -= 1;
  S.cookDay[who] = S.di;
  const ch = [];
  addMoney(S, -price, ch);
  const lvl = cookLevel(S);
  // burn chance: 30% at level 0, -6% per level, at least 4%; 4% with the knife
  const burnt = rnd(S) < (S.perm['Cooking knife'] ? 0.04 : Math.max(0.04, 0.3 - 0.06 * lvl));
  bump(S, 'cookN');
  const v = burnt ? 1 : r.q + (lvl >= 3 ? 1 : 0);
  if (who === 'self') {
    if (!burnt) addGrade(S, 1, ch);
  } else if (who === 'family') {
    addRel(S, 'Mom', v, ch);
    addRel(S, 'Dad', v, ch);
  } else addRel(S, who, v, ch);
  setFlag(S, 'COOKED');
  if (r.id === 'sig') setFlag(S, 'COOKED_SIG');
  if (burnt) setFlag(S, 'COOKED_BURNT');
  logAdd(S, 'Cooked ' + r.n + ' for ' + (who === 'self' ? 'myself' : who === 'family' ? 'the family' : who), ch);
  const lines = [burnt ? 'It burned a little, but it still got eaten.' : 'It turned out well.'];
  if (S.cookN % 3 === 0 && cookLevel(S) <= 5) lines.push('Your cooking is getting better.');
  return result(ch, lines);
}

/* ---------- items and gifts ---------- */
// items of these kinds that are used, not given
const NOT_GIFTS = ['Mystery box', 'Bicycle tune-up', 'Craft kit', 'Tutoring session', 'Lucky charm', 'Friendship bracelet kit'];
// what you can give from your bag
function giftItems(S) {
  const out = [];
  SHOP.forEach(it => {
    if (!['gift', 'cosmetic', 'use'].includes(it.kind)) return;
    if (NOT_GIFTS.includes(it.n)) return;
    if ((S.inv[it.n] || 0) > 0) out.push(it);
  });
  if (S.inv['Handmade gift'] > 0) out.push({ n: 'Handmade gift', id: 'hm', kind: 'gift' });
  return out;
}
const MYSTERY_ITEMS = ['Sticker pack', 'Snack', 'Phone charm', 'Café drink', 'Used paperback'];
function useItem(S, name) {
  const it = SHOPBYNAME[name];
  if (!it || !(S.inv[name] > 0)) return { err: 'You do not have that.' };
  const ch = [];
  const lines = [];
  if (name === 'Used paperback') {
    S.inv[name]--;
    addGrade(S, 1, ch);
    setFlag(S, 'BOOK_BOND');
    lines.push('You read it cover to cover.');
  } else if (name === 'Craft kit') {
    S.inv[name]--;
    bump(S.inv, 'Handmade gift');
    setFlag(S, 'CREATIVE_SHARE');
    lines.push('You made a handmade gift.');
  } else if (name === 'Bicycle tune-up') {
    S.inv[name]--;
    S.bike = 7;
    S.blocks++;
    S.maxBlocks++;
    lines.push('Extra time block for 7 days.');
  } else if (name === 'Tutoring session') {
    S.inv[name]--;
    addGrade(S, 2, ch);
    S.prep = Math.min(PREP_MAX_STUDY, S.prep + 20);
    setFlag(S, 'ASKED_FOR_HELP');
    lines.push('A tutor walks you through the tricky parts.');
  } else if (name === 'Lucky charm') {
    S.inv[name]--;
    S.luck = 1;
    lines.push('You feel a little luckier.');
  } else if (name === 'Friendship bracelet kit') {
    S.inv[name]--;
    bump(S.inv, 'Handmade gift', 2);
    setFlag(S, 'CREATIVE_SHARE');
    lines.push('You made two handmade bracelets.');
  } else if (name === 'Mystery box') {
    S.inv[name]--;
    const r = rnd(S);
    if (r < 0.35) {
      const m = ri(S, 3, 15);
      addMoney(S, m, ch);
      lines.push('Inside: $' + m + '.');
    } else if (r < 0.75) {
      const g = pick(S, MYSTERY_ITEMS);
      bump(S.inv, g);
      lines.push('Inside: ' + g + '.');
    } else {
      addPop(S, 1, ch);
      lines.push('Inside: a cool collectible. You show it off.');
    }
  } else if (it.kind === 'cosmetic') {
    if (S.worn[name]) return { err: 'Already wearing it.' };
    S.worn[name] = 1;
    addPop(S, ({ Hoodie: 2, 'Stylish backpack': 2 })[name] || 1, ch);
    lines.push('You look sharp.');
  } else return { err: 'Use it in a gift or a hangout.' };
  logAdd(S, 'Used ' + name, ch, 'sys');
  return result(ch, lines);
}
function likeScore(name, item) { return hash(name + '|' + item) % 3; } // 0 meh, 1 ok, 2 loves
// relationship gain 1..5: 1 + how much they like it, +2 gift card or handmade, +1 handmade or plush
function giveGift(S, name, item, ev, fromEvent) {
  if (!(S.inv[item] > 0)) return { err: 'You do not have that.' };
  const ch = [];
  const c = CH[name];
  S.inv[item]--;
  // (the c.ap term adds 0 either way)
  let g = 1 + likeScore(name, item) + (item === 'Gift card' ? 2 : item === 'Handmade gift' ? 2 : 0) + (c.ap >= 4 ? 0 : 0);
  if (item === 'Handmade gift' || item === 'Small plush') g += 1;
  g = clamp(g, 1, 5);
  addRel(S, name, g, ch);
  setFlag(S, 'GIFT_GIVEN');
  S.last[name] = S.di;
  bump(S, 'giftN');
  (S.giftTo = S.giftTo || {})[name] = 1;
  logAdd(S, 'Gave ' + item + ' to ' + name, ch);
  const gq = globalThis.TALK && globalThis.TALK.say(name, c.role, S.rel[name] - g, 'gift', hash(name + item + S.di));
  const like = likeScore(name, item);
  const reaction = like === 2 ? name + ' loves it!' : like === 0 ? name + ' smiles politely.' : name + ' says thanks.';
  const lines = (gq ? [gq] : []).concat([reaction]);
  if (fromEvent) finishEvent(S, ev);
  return result(ch, lines);
}
