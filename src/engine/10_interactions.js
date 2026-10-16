/* engine/10_interactions.js — interactionList() and interact(): everything you can do with a person; rumours. */
'use strict';
/* ---------- interactions ---------- */
// interactionList(S, name): every INTER action with { ok, why } for the People screen.
// interact(S, name, id, arg): does it. arg depends on the action: talk topic ('school', 'hobbies',
// 'daily', 'rumor'), gift item, hangout booster item, rumour index (share / investigate),
// lend amount, 'specific' apology, 'deescalate' fight, 'Name|bad|good|neutral' for talkabout.
// While S._ph is 1 (a phone text), time blocks are not needed or spent.

// why an action is not possible with this person right now ('' = possible)
function gateWhy(S, c, v, id) {
  switch (id) {
    case 'gift':
      if (v < -10) return 'They will not accept gifts right now.';
      if (!giftItems(S).length) return 'You have nothing to give. Visit the shop.';
      return '';
    case 'hangout': case 'group': case 'prank':
      return v < 20 ? 'Needs Friend (+20).' : '';
    case 'study':
      return c.role !== 'kid' && v < 20 ? 'Classmates or friends only.' : '';
    case 'askmoney': case 'lend': {
      let why = '';
      if (!(v >= 20 || c.role === 'fam')) why = 'Needs Friend (+20) or family.';
      if (id === 'lend' && S.money < 5) why = 'You need at least $5.';
      return why;
    }
    case 'apologize': return v >= 10 ? 'No conflict to apologize for.' : '';
    case 'debate': return v < -9 ? 'Too tense for a friendly debate.' : '';
    case 'fight': return v > -40 ? 'Only with high conflict (-40).' : '';
    case 'secret': return v < 20 ? 'Needs Friend (+20).' : '';
    case 'tease': return v < 10 ? 'Needs a warm relationship (+10).' : '';
    case 'advice': case 'cheer': return v < -20 ? 'Too much conflict right now.' : '';
    case 'collab': return v < 5 ? 'Needs a little rapport (+5).' : '';
    case 'joingroup':
      if (!(c.pop >= 60)) return 'Only popular groups (their POP 60+).';
      if (v < 0) return 'They need to like you first.';
      return '';
    case 'reconcile': return v > -10 ? 'Only when tense or enemies.' : '';
  }
  return '';
}
function interactionList(S, name) {
  const c = CH[name];
  const v = S.rel[name];
  const out = [];
  INTER.forEach(it => {
    if (c.role === 'teach' && !TEACHER_OK.has(it.id)) return;
    if (c.role === 'fam' && FAMILY_NO.has(it.id)) return;
    let why = gateWhy(S, c, v, it.id);
    let ok = !why;
    if (!S._ph && it.cost > S.blocks && ok) { ok = false; why = 'No time blocks left.'; }
    if (it.daily && (S.today['i_' + name + it.id] || 0) >= it.daily && ok) { ok = false; why = 'Already done today.'; }
    if (S.phase !== 'free') { ok = false; why = 'Not now.'; }
    out.push({ id: it.id, n: it.n, cost: it.cost, ok, why });
  });
  return out;
}
const todayN = (S, k) => S.today[k] || 0; // (unused)
// the same action with the same person on the same day: full effect, then half, then nothing
function diminish(S, name, id) {
  const k = 'g_' + name + id;
  const n = S.today[k] || 0;
  S.today[k] = n + 1;
  return n === 0 ? 1 : n === 1 ? 0.5 : 0;
}
function interact(S, name, id, arg) {
  if (!isMet(S, name)) return { err: 'You have not met them yet.' };
  if (S.phase !== 'free') return { err: 'Not now.' };
  const it = INTERBY[id];
  const c = CH[name];
  if (!it || !c) return null;
  const list = interactionList(S, name).find(x => x.id === id);
  if (!list || !list.ok) return { err: list ? list.why : 'Not available.' };
  const ch = [];
  const lines = [];
  const v = S.rel[name]; // relationship before the action
  const ctx = makeCtx(S, 'i' + S.di + name + id, ''); // (not used by the actions)
  S.ih = S.ih || {};
  S.hurt = S.hurt || {};
  S.giftTo = S.giftTo || {};
  const IH = (S.ih[name] = S.ih[name] || {});
  bump(IH, id);
  if (it.cost && !S._ph) S.blocks -= it.cost;
  bump(S.today, 'i_' + name + id);
  if (id !== 'end' && id !== 'boundary') S.last[name] = S.di;
  const dm = diminish(S, name, id);
  const damp = clamp(1 - Math.max(0, v) / 110, 0.3, 1); // the closer you are, the less small talk adds
  // scales a relationship gain: repeats today, closeness, phone (x0.7); at least 1 unless repeated too often
  const scale = x => dm <= 0 ? 0 : Math.max(1, pround(S, x * dm * damp * (S._ph ? 0.7 : 1)));
  const x = { S, name, id, arg, it, c, v, ch, lines, scale, logt: it.n + ' — ' + name };
  const early = ACTIONS[id](x); // an action returns something only to stop here (error, gift)
  if (early) return early;
  // counters read by the endings
  if (id === 'insult' || id === 'fight') bump(S, 'retal');
  if (id === 'lend') bump(S, 'lentN');
  if ((id === 'reconcile' || id === 'apologize') && S.rel[name] - v >= 3) {
    S.recon = S.recon || {};
    bump(S.recon, name);
  }
  if (id !== 'end' && id !== 'boundary') logAdd(S, x.logt, ch);
  // a spoken line from talk.js, for success or failure ("key-")
  const T = globalThis.TALK;
  if (T) {
    const dlt = S.rel[name] - v;
    const jt = lines.join(' ');
    let key = id === 'fight' && arg === 'deescalate' ? 'deesc' : id;
    const failRe = /cannot|did not line up|not ready|full today|heated|flopped|landed wrong|uneasy|says no/i;
    let bad = failRe.test(jt) || (['apologize', 'tease', 'prank', 'secret', 'debate'].includes(id) && dlt < 0) || (id === 'apologize' && S.rel[name] < -10);
    if (bad && T.R[key + '-']) key += '-';
    const q = T.say(name, c.role, v, key, hash(name + id + S.di + (IH[id] || 0)));
    if (q) lines.unshift(q);
  }
  return result(ch, lines);
}
// One function per INTER id. x = { S, name, id, arg, it, c (character), v (relationship before),
// ch, lines, scale, logt (diary text, may be changed) }.
const ACTIONS = {
  talk({ S, name, arg, c, v, ch, lines, scale }) {
    const topic = arg || 'school';
    let g = ri(S, 0, 2) + (c.ap >= 4 && rnd(S) < 0.5 ? 1 : 0) - (c.ap <= 2 && v < 10 ? 1 : 0);
    if (v >= 40) {
      g = 0;
      lines.push('Talking only gets you so far. Hang out for a closer bond.');
    }
    if (rnd(S) < 0.4) {
      g += 1;
      lines.push('You discover a shared interest.');
    }
    if (topic === 'rumor') { // you learn the next rumour about them
      const idx = c.rum.findIndex((r, i) => !(S.heard[name] || []).includes(i));
      if (idx >= 0) {
        (S.heard[name] = S.heard[name] || []).push(idx);
        lines.push('You hear something: "' + c.rum[idx][1] + '"');
      } else lines.push('Nothing new to hear about them.');
      g = Math.max(0, g - 1);
    } else lines.push(name + ' chats about ' + (topic === 'hobbies' ? 'hobbies' : topic === 'daily' ? 'daily life' : 'school') + '.');
    if (v < -30 && rnd(S) < 0.5) {
      g = 0;
      lines.push(name + ' barely answers you.');
    }
    addRel(S, name, scale(g), ch);
  },
  compliment({ S, name, v, ch, lines }) {
    if (v < -30 && rnd(S) < 0.5) lines.push(name + ' does not believe you.');
    else addRel(S, name, 2, ch);
  },
  gift({ S, name, arg }) {
    return giveGift(S, name, arg);
  },
  hangout({ S, name, arg, c, ch, lines, scale }) {
    let g = ri(S, 3, 6);
    const bits = [];
    // one booster item (used up) or permanent item can make it better
    if (arg === 'Movie ticket' && S.inv['Movie ticket'] > 0) { S.inv['Movie ticket']--; g += 2; bits.push('movie'); }
    else if (arg === 'Café drink' && S.inv['Café drink'] > 0) { S.inv['Café drink']--; g += 1; bits.push('café'); }
    else if (arg === 'Fancy snack box' && S.inv['Fancy snack box'] > 0) { S.inv['Fancy snack box']--; g += 2; bits.push('snacks'); }
    else if (arg === 'Concert ticket' && S.inv['Concert ticket'] > 0) { S.inv['Concert ticket']--; g += 4; bits.push('concert'); }
    else if (arg === 'Sports ball' && S.perm['Sports ball']) { g += 2; bits.push('catch'); }
    else if (arg === 'Sketchbook' && S.perm['Sketchbook']) { g += 2; bits.push('drawing'); }
    else S.freeActs++; // a free hangout
    if (c.role === 'kid' && c.pop > 85 && g > 5 && rnd(S) < 0.4) addPop(S, 1, ch);
    addRel(S, name, scale(g), ch);
    lines.push('You and ' + name + ' hang out' + (bits.length ? ' (' + bits.join(', ') + ')' : '') + '.');
  },
  group({ S, name, v, ch, lines, scale }) {
    let g = ri(S, 2, 4) + (S.perm['Board game'] ? 2 : 0);
    const ok = rnd(S) * 100 < clamp(55 + v / 2, 20, 90);
    if (!ok) {
      lines.push('Schedules did not line up.');
      g = 1;
    } else {
      lines.push('A fun group activity!');
      // two other classmates join (+1 each)
      const others = shuffle(metKids(S).filter(n => n !== name && S.rel[n] > -10), mul(hash(S.seed + 'g' + S.di + name))).slice(0, 2);
      others.forEach(o => addRel(S, o, 1, ch, false, true));
      if (rnd(S) < 0.4) addPop(S, 1, ch);
      S.freeActs++;
    }
    addRel(S, name, scale(g), ch);
  },
  study({ S, name, ch, lines }) {
    const ok = rnd(S) < 0.7;
    addGrade(S, rnd(S) < 0.6 ? 1 : 0, ch);
    S.prep = Math.min(30, S.prep + 5);
    setFlag(S, 'STUDIED');
    if (ok) {
      addRel(S, name, 2, ch);
      lines.push('It went well.');
    } else lines.push('Mostly off-topic, but you got something done.');
  },
  askhelp({ S, name, c, v, ch, lines }) {
    const ok = rnd(S) * 100 < clamp(40 + v / 2 + (c.ap - 3) * 5, 10, 90);
    if (ok) {
      setFlag(S, 'ASKED_FOR_HELP');
      S.prep = Math.min(30, S.prep + 10);
      addRel(S, name, 1, ch);
      lines.push(name + ' helps. Next study check +10%.');
    } else {
      addRel(S, name, -1, ch);
      lines.push(name + ' cannot help right now.');
    }
  },
  askmoney({ S, name, c, ch, lines }) {
    // each new ask lowers the chance (80%, 60%, 40%... at least 15%); c.mo = their pocket money
    const n = bump(S.asks, name);
    const ok = c.mo > 5 && rnd(S) < Math.max(0.15, 0.8 - 0.2 * (n - 1));
    if (ok) {
      const amt = clamp(Math.round(c.mo / 12) + ri(S, 0, 4), 1, 20);
      addMoney(S, amt, ch);
      lines.push(name + ' hands you $' + amt + '.');
      if (n >= 3) addRel(S, name, -2, ch);
    } else {
      addRel(S, name, -2, ch);
      lines.push(name + ' says no. Asking again and again costs trust.');
    }
  },
  lend({ S, name, arg, ch, lines }) {
    const amt = +arg || 5;
    if (S.money < amt) return { err: 'Not enough money.' };
    addMoney(S, -amt, ch);
    addRel(S, name, 2, ch);
    S.loans.push({ who: name, amt, due: S.di + 6 });
    lines.push('They promise to pay you back soon.');
  },
  share({ S, name, arg, it, c, ch, lines }) {
    const idx = +arg;
    const r = c.rum[idx];
    if (!r) {
      S.blocks += it.cost; // refund
      return { err: 'Pick a rumor.' };
    }
    shareRumor(S, name, r, ch, lines, false);
  },
  start({ S, name, v, ch, lines }) {
    bump(S.hurt, name);
    lines.push('You invent a story about ' + name + '.');
    S.started++;
    setFlag(S, 'STARTED_RUMOR');
    addPop(S, 2, ch);
    addGossip(S, 1, ch);
    if (v >= 15) setFlag(S, 'HYPOCRISY');
    const reach = rumorReach(S, name, 0, 85);
    if (rnd(S) * 100 < reach) {
      addRel(S, name, -ri(S, 8, 15), ch);
      lines.push('It reaches ' + name + '.');
      if (rnd(S) < 0.4) {
        addPop(S, -ri(S, 5, 15), ch);
        setFlag(S, 'RUMOR_DISPROVEN');
        S.caught++;
        lines.push('The story falls apart and people know it was you.');
      }
    }
  },
  investigate({ S, name, arg, c, ch, lines }) {
    const idx = arg != null ? +arg : 0;
    const r = c.rum[idx] || c.rum[0];
    setFlag(S, 'INVESTIGATED_RUMOUR');
    // fixed per rumour: negative rumours are true 35% of the time, others 80%
    const truth = hash(name + idx) % 100 < (r[0] === 'neg' ? 35 : 80);
    lines.push(truth ? 'After checking, it seems to be true.' : 'You find no evidence at all: the rumor looks false.');
    bump(S, 'investN');
    if (!truth) bump(S, 'corrected');
    if (!truth) {
      addRel(S, name, 3, ch);
      if (r[0] === 'neg') addPop(S, 1, ch);
    } else addRel(S, name, 1, ch);
  },
  defend({ S, name, c, ch, lines }) {
    addRel(S, name, ri(S, 2, 4), ch);
    setFlag(S, 'STOOD_UP');
    if (rnd(S) < 0.35 && c.pop < 50) addPop(S, -1, ch);
    lines.push('You speak up for ' + name + '.');
  },
  apologize({ S, name, arg, ch, lines }) {
    const base = Math.max(1, ri(S, 2, 6) + (arg === 'specific' ? 3 : 0) - (S._ph ? 2 : 0));
    bump(S.apol, name);
    bump(S, 'apolN');
    if (arg === 'specific') setFlag(S, 'APOLOGIZED_SPECIFIC');
    else bump(S, 'vague');
    addRel(S, name, base, ch);
    if (S.rel[name] >= -10) bump(S, 'accepted');
    else bump(S, 'refused');
    lines.push('You name exactly what you did and say sorry.');
  },
  insult({ S, name, c, ch, lines }) {
    bump(S.hurt, name);
    addRel(S, name, -ri(S, 3, 10), ch);
    setFlag(S, 'PUBLIC_JAB');
    if (rnd(S) < 0.3) {
      addPop(S, -1, ch);
      lines.push('It turns into an argument.');
    } else if (c.pop < 30 && rnd(S) < 0.4) addPop(S, 1, ch);
  },
  debate({ S, name, v, ch, lines }) {
    if (v >= 0 || rnd(S) < 0.5) {
      addRel(S, name, ri(S, 2, 4), ch);
      lines.push('A respectful debate builds respect.');
    } else {
      addRel(S, name, -2, ch);
      lines.push('It got a little heated.');
    }
  },
  prank({ S, name, ch, lines }) {
    if (rnd(S) < 0.7) {
      addRel(S, name, 3, ch);
      addPop(S, 1, ch);
      lines.push('They laugh. Harmless and reversible.');
      setFlag(S, 'HARMLESS_JOKE');
    } else {
      addRel(S, name, -2, ch);
      lines.push('The joke flopped.');
    }
  },
  fight({ S, name, arg, ch, lines }) {
    if (arg === 'deescalate') {
      if (rnd(S) < 0.6) {
        addRel(S, name, 5, ch);
        lines.push('You calm things down.');
        setFlag(S, 'DEESCALATED');
      } else {
        addRel(S, name, -2, ch);
        lines.push('They were not ready to listen.');
      }
    } else {
      bump(S.hurt, name);
      addRel(S, name, -5, ch);
      addPop(S, -2, ch);
      setFlag(S, 'FOUGHT');
      lines.push('A tense confrontation. You lose face.');
    }
  },
  // arg = 'Subject Name|tone', tone: 'bad' (gossip), 'good', or neutral
  talkabout(x) {
    const { S, name, id, it, ch, lines } = x;
    const parts = String(x.arg || '').split('|');
    const subj = parts[0], tone = parts[1] || 'neutral';
    const B = CH[subj];
    if (!B || subj === name) { // undo the time and daily count
      S.blocks += it.cost;
      S.today['i_' + name + id]--;
      return { err: 'Pick someone else to talk about.' };
    }
    const link = (LINKS[name] || []).find(l => l[0] === subj);
    const k = link ? link[1] : 0; // how `name` feels about subj (see LINKS)
    const rb = S.rel[subj];
    x.logt = 'Talked about ' + subj + ' with ' + name;
    if (tone === 'bad') {
      addGossip(S, 1, ch);
      S.talked = S.talked || {};
      bump(S.talked, subj);
      bump(S.hurt, subj);
      if (rb >= 15) {
        setFlag(S, 'HYPOCRISY');
        lines.push('You smile at ' + subj + ' in person, but here you are tearing them apart.');
      }
      if (k < 0) {
        addRel(S, name, 3, ch);
        addPop(S, 1, ch);
        lines.push(name + ' laughs. They do not like ' + subj + ' either.');
      } else if (k >= 2) {
        addRel(S, name, -3, ch);
        lines.push(name + ' frowns. ' + subj + ' is a close friend of theirs.');
      } else {
        addRel(S, name, 1, ch);
        lines.push(name + ' listens with interest.');
      }
      const reach = rumorReach(S, subj, k >= 2 ? 20 : 0, 90);
      if (rnd(S) * 100 < reach) {
        addRel(S, subj, -ri(S, 5, 15), ch);
        lines.push('Word gets back to ' + subj + '.');
        if (F(S, 'HYPOCRISY') && rb >= 15 && rnd(S) < 0.4) {
          setFlag(S, 'HYPOCRISY_EXPOSED');
          S.caught++;
          addPop(S, -3, ch);
          lines.push('They know you said it while acting like a friend. People notice.');
        }
      } else lines.push('For now, ' + subj + ' has no idea.');
    } else if (tone === 'good') {
      addRel(S, name, 1, ch);
      setFlag(S, 'SPOKE_WELL');
      if (rnd(S) < 0.5) {
        addRel(S, subj, 2, ch);
        lines.push('It gets back to ' + subj + ' and they are touched.');
      } else lines.push('You say good things about ' + subj + '.');
    } else {
      addRel(S, name, 1, ch);
      lines.push('You mention ' + subj + ' in passing. Nothing comes of it.');
    }
  },
  secret({ S, name, v, ch, lines }) {
    if (rnd(S) < 0.8) {
      addRel(S, name, 4, ch);
      setFlag(S, 'SHARED_SECRET');
      lines.push(name + ' keeps it safe and shares one back.');
    } else if (v < 40 && rnd(S) < 0.5) {
      addRel(S, name, -3, ch);
      lines.push(name + ' seemed uneasy, and you feel exposed.');
    } else {
      addRel(S, name, 2, ch);
      lines.push('A quiet moment.');
    }
  },
  advice({ S, name, ch, lines }) {
    addRel(S, name, 1, ch);
    if (rnd(S) < 0.35) {
      addGrade(S, 1, ch);
      lines.push(name + ' gives you a tip that actually helps.');
    } else lines.push(name + ' shares an opinion.');
  },
  lunch({ S, name, c, ch, lines, scale }) {
    let g = ri(S, 2, 3);
    let bit = '';
    if (S.inv['Lunch voucher'] > 0) { // always used when you have one
      S.inv['Lunch voucher']--;
      g += 2;
      bit = ' (lunch voucher)';
    }
    addRel(S, name, scale(g), ch);
    lines.push('You sit together at lunch' + bit + '.');
    if (c.pop >= 70 && rnd(S) < 0.6) addPop(S, 1, ch);
    if (c.pop < 20 && S.pop > 60 && rnd(S) < 0.35) {
      addPop(S, -1, ch);
      lines.push('A few people notice who you sat with.');
    }
    if (c.pop < 30) setFlag(S, 'INCLUDED_SOMEONE');
  },
  message({ S, name, ch, lines }) {
    addRel(S, name, rnd(S) < 0.25 ? 2 : 1, ch);
    lines.push('You text ' + name + '.');
  },
  tease({ S, name, ch, lines }) {
    if (rnd(S) < 0.65) {
      addRel(S, name, 2, ch);
      lines.push('They laugh and tease you back.');
    } else {
      addRel(S, name, -3, ch);
      lines.push('That landed wrong.');
    }
  },
  cheer({ S, name, ch, lines }) {
    addRel(S, name, ri(S, 3, 5), ch);
    setFlag(S, 'ENCOURAGEMENT');
    lines.push('You help ' + name + ' feel better.');
  },
  collab({ S, name, ch, lines }) {
    addGrade(S, rnd(S) < 0.6 ? 1 : 0, ch);
    addRel(S, name, 2, ch);
    S.prep = Math.min(30, S.prep + 5);
    setFlag(S, 'FAIR_WORK');
    lines.push('You split the work fairly.');
  },
  joingroup({ S, name, v, ch, lines }) {
    const ok = rnd(S) * 100 < clamp(45 + v / 2, 15, 85);
    if (ok) {
      addPop(S, 2, ch);
      addRel(S, name, 2, ch);
      lines.push('You are welcome at their table.');
    } else {
      addRel(S, name, -1, ch);
      lines.push('They say the group is full today.');
    }
  },
  boundary({ S, name, lines }) {
    bump(S, 'boundaryN');
    S.cool[name] = S.di + 2; // no personal event with them for a while
    lines.push('You protect your space. No penalty.');
  },
  end({ lines }) {
    lines.push('You leave politely.');
  },
  reconcile({ S, name, c, ch, lines }) {
    const ok = rnd(S) * 100 < clamp(40 + c.ap * 5 + (S.apol[name] ? 15 : 0), 20, 85);
    setFlag(S, 'RECONCILE_TRIED');
    if (ok) {
      addRel(S, name, ri(S, 3, 10), ch);
      lines.push('A calm conversation clears the air.');
    } else {
      addRel(S, name, -1, ch);
      lines.push('They are not ready yet.');
    }
  },
};
// closeFriends: how many close friends (link 2+) someone has
function closeFriends(S, name) { return (LINKS[name] || []).filter(([o, k]) => k >= 2).length; }
// % chance that talk about `name` gets back to them: more close friends, faster spread
function rumorReach(S, name, bonus, max) { return clamp(55 + 10 * Math.min(3, closeFriends(S, name)) + bonus, 0, max); }
// r = [type 'neg' | 'pos' | other, text]
function shareRumor(S, name, r, ch, lines, quiet) {
  const typ = r[0];
  setFlag(S, 'REPEATED_RUMOUR');
  if (typ === 'neg') {
    bump(S.hurt, name);
    addGossip(S, 1, ch);
    if (S.rel[name] >= 15) {
      setFlag(S, 'HYPOCRISY');
      lines.push('You talk behind the back of someone you call a friend.');
    }
    addPop(S, 1, ch);
    const reach = rumorReach(S, name, 0, 85);
    if (rnd(S) * 100 < reach) {
      addRel(S, name, -ri(S, 5, 15), ch);
      lines.push('It reaches ' + name + '.');
    } else lines.push('It spreads, but not to ' + name + '.');
    if (rnd(S) < 0.2) {
      addPop(S, -2, ch);
      S.caught++;
      lines.push('People think you are a gossip.');
    }
  } else {
    lines.push('You pass along something harmless.');
    if (typ === 'pos') {
      if (rnd(S) < 0.5) addRel(S, name, -2, ch);
      else addRel(S, name, 1, ch);
    }
    addPop(S, rnd(S) < 0.3 ? 1 : 0, ch);
  }
}
