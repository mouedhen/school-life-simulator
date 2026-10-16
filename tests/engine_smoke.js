const path = require('path'), R = p => path.join(__dirname, '..', 'src', p);
require(R('data.js')); require(R('talk.js')); const E = require(R('engine.js'));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const kinds = {}, acts = {}; let errs = 0, reveal = 0, notices = 0, apology = 0, echo = 0, loans = 0, gifts = 0;
for (let seed = 1; seed <= 40; seed++) {
  const S = E.newGame(seed); S.meta = { clues: seed % 12 }; if (seed % 3 === 0) S.strange = seed % 9; let g = 0; const r = E.mul(seed * 5 + 1);
  while (!S.over && S.phase !== 'ending' && g++ < 4000) {
    try {
      if (S.phase === 'event') {
        const ev = E.buildEvent(S); if (!ev) throw new Error('no event ' + JSON.stringify(S.pend));
        kinds[ev.kind] = (kinds[ev.kind] || 0) + 1;
        if (ev.title === 'The Page Gets Thin') reveal++; if (ev.kind === 'notice') notices++;
        if (S.pend.act === 'apology') apology++; if (S.pend.act === 'echo') echo++;
        const okc = ev.choices.map((c, i) => i).filter(i => !ev.choices[i].disabled);
        E.choose(S, okc[Math.floor(r() * okc.length)]);
      } else if (S.phase === 'free') E.endDay(S); else break;
    } catch (e) { errs++; console.log('ERR seed', seed, e.message.slice(0, 120)); break; }
  }
  loans += (S.loans || []).length; gifts += Object.keys(S.giftFrom || {}).length;
}
ok(errs === 0, '40 seeded years, no engine errors');
ok(kinds.npc > 500, 'NPC acts fire often enough (' + kinds.npc + ')');
ok(notices >= 5, 'family notice scenes fire (' + notices + ')');
ok(reveal >= 1 && reveal <= 40, 'the reveal fires at most once per run (' + reveal + ' in 40 runs)');
ok(apology > 0 && echo > 0, 'follow-ups appear (apology ' + apology + ', echo ' + echo + ')');
ok(gifts > 0, 'gifts are tracked per giver (' + gifts + ')');
// direct checks
{
  const S = E.newGame(5); S.meta = { clues: 9 }; S.di = 30; S.flags.REVEAL_DONE = 1; S.pend = E.advance && null; E.advance(S);
  ok(!(S.pend && S.pend.id === 'reveal'), 'no second reveal once REVEAL_DONE is set');
}
{
  const S = E.newGame(5); S.rel.Dad = 80; S.money = 20; S.pend = { kind: 'npc', who: 'Dad', act: 'gift' }; const ev = E.buildEvent(S);
  E.choose(S, 0); ok(S.money === 25 && S.giftFrom.Dad[0] === '$5', 'Dad gives $5 and it is tracked');
}
{
  const S = E.newGame(5); const kid = E.KIDS[0]; S.rel[kid] = 30; S.money = 20; S.pend = { kind: 'npc', who: kid, act: 'borrow' }; E.buildEvent(S);
  E.choose(S, 0); ok(S.money === 15 && S.loans.length === 1, 'lending $5 creates a loan');
}
{
  const S = E.newGame(5); const kid = E.KIDS[0]; S.rel[kid] = -20; S.last[kid] = 1; S.pend = { kind: 'npc', who: kid, act: 'gossip' }; E.buildEvent(S);
  E.choose(S, 0); ok((S.follow || []).some(x => x.who === kid && x.act === 'apology'), 'asking calmly schedules an apology follow-up');
}
{
  const S = E.newGame(5); let g = 0; while (S.phase !== 'free' && g++ < 50) { const ev = E.buildEvent(S); E.choose(S, ev.choices.findIndex(c => !c.disabled)); }
  const kid = E.KIDS[0]; S.rel[kid] = 30; const b = S.blocks;
  ok(E.phoneList(S, kid).some(a => a.id === 'chat_school' && a.ok), 'phone lists text actions');
  for (let i = 0; i < 4; i++) E.phoneAct(S, kid, i % 2 ? 'chat_daily' : 'chat_school');
  ok(S.blocks === b, 'texting costs no time blocks');
  const r5 = E.phoneAct(S, kid, 'chat_hobbies'); ok(r5 && r5.err && S.today.ph === 4, 'the daily cap of 4 texts holds');
  ok(E.phoneList(S, 'Ms. Harper Ellis').length === 0, 'teachers cannot be texted');
  S.phase = 'free'; E.endDay(S); let n = 0; for (let d = 0; d < 30 && !S.over; d++) { while (S.phase === 'event') { const ev = E.buildEvent(S); E.choose(S, ev.choices.findIndex(c => !c.disabled)); } if (S.phone && S.phone.ping) { n++; S.phone.ping = null; } S.phase = 'free'; E.endDay(S); }
  ok(n >= 5, 'friends text first now and then (' + n + ' in 30 days)');
  const who = Object.keys(S.phone.th).find(k => S.phone.th[k].some(m => m.q && !m.done));
  if (who) { const before = S.rel[who]; const rr = E.phoneReply(S, who, 0); ok(rr && !rr.err, 'quick replies apply'); }
}
{
  const mk = f => { const S = E.newGame(11); S.pop = 60; S.ih = S.ih || {}; f(S); return E.evaluateEnding(S).all; };
  ok(mk(S => { S.phoneN = 600; }).includes('ph_screen'), 'ending: The Screen Between Us');
  ok(!mk(S => { S.phoneN = 600; S.ih.X = { hangout: 5 }; }).includes('ph_screen'), '... not if you hang out in person');
  ok(mk(S => { S.gcN = 70; S.gcDef = 7; S.gcLaugh = 0; }).includes('ph_keeper'), 'ending: The Keeper of the Group Chat');
  ok(!mk(S => { S.gcN = 70; S.gcDef = 7; S.gcLaugh = 3; }).includes('ph_keeper'), '... not if you laugh along at gossip');
  ok(mk(S => { S.gcLaugh = 6; E.KIDS.slice(0, 2).forEach(n => S.rel[n] = -30); }).includes('ph_screenshot'), 'ending: Seen at 11:42 PM');
  ok(mk(S => { S.phIgn = 7; E.KIDS.slice(0, 2).forEach(n => S.rel[n] = -15); }).includes('ph_read'), 'ending: Left on Read');
  ok(mk(S => { S.flags.REVEAL_DONE = 1; S.meta = { clues: 13 }; S.phoneN = 120; }).includes('ph_line'), 'ending: The Other End of the Line');
  ok(!mk(S => { S.flags.REVEAL_DONE = 1; S.meta = { clues: 13 }; S.phoneN = 20; }).includes('ph_line'), '... needs real texting');
  ok(mk(S => { S.pgN = 120; S.pgPerf = 45; }).includes('ph_score'), 'ending: High Score');
  ok(mk(S => { S.phoneN = 10; S.ih.A = { hangout: 25 }; E.KIDS.slice(0, 9).forEach(n => S.rel[n] = 45); }).includes('ph_face'), 'ending: The Face-to-Face Year');
  ok(E.ENDINGS.filter(e => e.id.startsWith('ph_')).length === 7, 'seven phone endings exist');
}
{
  // meeting people: the circle grows through day events; old saves know everyone
  const S = E.newGame(21); const n0 = Object.keys(S.met).length;
  ok(n0 === 14 && E.FAM.every(n => S.met[n]) && S.met['Maya Bennett'], 'start: family, Maya and 7 classmates are known (' + n0 + ')');
  ok(E.metKids(S).length === 8 && E.KIDS.length === 30, 'metKids(S) lists the 8 known classmates');
  let g = 0, firstNew = null; while (!S.over && S.phase !== 'ending' && g++ < 3000 && S.di < 60) {
    if (S.phase === 'event') { const ev = E.buildEvent(S); if (ev.met && ev.met.length && !firstNew) firstNew = [S.di, ev.met[0]]; if (ev.choices) E.choose(S, Math.max(0, ev.choices.findIndex(c => !c.disabled && !c.hide))); else E.finishEvent(S, ev); }
    else E.endDay(S);
  }
  ok(firstNew && firstNew[0] >= 2, 'the first new classmate appears from day 3 (' + JSON.stringify(firstNew) + ')');
  ok(Object.keys(S.met).length >= 24, 'about one new person every 4-5 days (' + Object.keys(S.met).length + ' by day 60)');
  const un = E.KIDS.find(n => !S.met[n]);
  if (un) { ok(!E.phoneCan(S, un), 'unmet people cannot be texted'); ok(!!(E.interact(S, un, 'talk') || {}).err, 'unmet people cannot be talked to'); }
  const old = E.newGame(22); delete old.met; ok(E.metKids(old).length === 30 && E.isMet(old, 'Zara Khan' in E.CH ? 'Zara Khan' : E.KIDS[3]), 'old saves without S.met know everyone');
}
{
  // event-unlocked shop items
  const S = E.newGame(23); S.money = 300; const it = E.SHOP.find(x => x.n === 'Club badge');
  ok(it && E.itemLocked(S, it), 'Club badge starts locked');
  ok(!!(E.buy(S, it.id) || {}).err, 'a locked item cannot be bought');
  const ch = []; E.applyFx(S, E.fxs('f:CLUB_MEMBER'), { T: 'Maya Bennett' }, ch);
  ok(ch.some(c => c.k === 'unlock' && c.n === 'Club badge'), 'the event that sets CLUB_MEMBER shows an unlock chip');
  ok(!E.itemLocked(S, it) && !(E.buy(S, it.id) || {}).err && S.inv['Club badge'] === 1, 'after the event it can be bought');
  ok(E.SHOP.filter(x => x.flag).length === 14 && E.SHOP.every(x => x.kind), 'fourteen event items, all with a kind');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
