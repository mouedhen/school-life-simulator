/* engine/04_mystery_npc.js — The Player mystery (MC's doubts, the family noticing) and NPC acts (people coming to you). */
'use strict';
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
