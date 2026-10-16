// Golden master for the engine: plays seeded bot years and fingerprints everything the engine
// returns (events, choices, action results, lists the UI shows, the final state and ending).
// A pure refactor must leave every fingerprint unchanged.
//   node tests/golden.js record   -> writes tests/golden.json (the reference)
//   node tests/golden.js [N]      -> compares the first N seeds (default: all) with the reference
require('../src/data.js'); require('../src/talk.js'); const E = require('../src/engine.js');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = path.join(__dirname, 'golden.json');
const SEEDS = 160;
const NICE = ['talk', 'compliment', 'hangout', 'group', 'study', 'askhelp', 'lend', 'share', 'defend', 'apologize', 'advice', 'lunch', 'message', 'cheer', 'collab', 'reconcile', 'secret', 'talkabout', 'joingroup', 'investigate', 'boundary'];

function run(seed) {
  const h = crypto.createHash('sha1'); const put = (tag, v) => h.update(tag + ':' + JSON.stringify(v === undefined ? null : v) + '\n');
  const S = E.newGame(seed, seed % 5 === 0); const R = E.mul(seed * 977 + 13); const phone = seed % 2 === 1;
  // seed % 4: 0 kind, 1 mean, 2 mixed, 3 hermit (studies and works, rarely talks)
  const style = seed % 4; const kind = [0.95, 0.1, R(), 0.6][style], social = style === 3 ? 0.05 : R(), study = style === 3 ? 0.9 : R(), work = R(), shop = R();
  const evBias = R();
  const favs = E.KIDS.slice().sort(() => R() - .5).slice(0, 3 + Math.floor(R() * 7));
  const pickOf = a => a[Math.floor(R() * a.length)];
  let guard = 0;
  while (!S.over && S.phase !== 'ending' && guard++ < 6000) {
    if (S.phase === 'event') {
      const ev = E.buildEvent(S); put('ev', ev);
      if (/exam|test|quiz/i.test(ev.title || '')) put('quiz', E.quiz(S, ev.title));
      const ok = ev.choices.map((c, i) => i).filter(i => !ev.choices[i].disabled);
      const i = R() < 0.2 ? pickOf(ok) : (R() < kind ? ok[Math.round(evBias * (ok.length - 1))] : ok[Math.round((1 - evBias) * (ok.length - 1))]); const c = ev.choices[i];
      const gi = E.giftItems(S);
      const extra = c.gift ? (gi[0] && gi[0].n) : R() < .3 ? { mg: { q: pickOf([0.3, 0.7, 1]), label: 'golden' } } : undefined;
      put('choose', E.choose(S, i, extra));
    } else if (S.phase === 'free') {
      put('stats', E.stats(S));
      let n = 0;
      while (S.blocks > 0 && n++ < 8) {
        const x = R();
        if (x < study * .3) { const r = E.study(S); put('study', r); if (r && r.err) break; continue; }
        if (x < study * .3 + work * .2) { put('work', E.work(S, Math.floor(R() * E.JOBS.length))); continue; }
        if (x < .55 && R() < .4) { const who = pickOf(Object.keys(E.BONDS)); const a = pickOf(E.BONDS[who].acts); put('bond', E.bond(S, who, a.id)); continue; }
        if (x < .6 && R() < .3) { const r = pickOf(E.RECIPES); put('cook', E.cook(S, r.id, pickOf(['self', 'family', pickOf(favs)]))); continue; }
        if (R() > social + .1) break;
        const nm = pickOf(R() < .6 ? favs : E.KIDS);
        const l = E.interactionList(S, nm); put('ilist', l);
        const nice = R() < kind; const ok = l.filter(q => q.ok && q.cost > 0 && NICE.includes(q.id) === nice);
        if (!ok.length) { if (R() < .5) break; continue; }
        put('interact', E.interact(S, nm, pickOf(ok).id, 'school'));
      }
      if (phone) {
        for (let k = 0; k < 3; k++) { const nm = pickOf(R() < .6 ? favs : E.KIDS.concat(E.FAM)); const l = E.phoneList(S, nm); put('plist', l); const ok = l.filter(a => a.ok); if (ok.length) put('pact', E.phoneAct(S, nm, pickOf(ok).id)); }
        const key = R() < .7 ? '#class' : '#fam'; const gl = E.phoneGroupList(S, key); put('glist', gl); const gok = gl.filter(a => a.ok); if (gok.length && R() < .6) put('gact', E.phoneGroupAct(S, key, pickOf(gok).id));
        Object.keys((S.phone && S.phone.th) || {}).forEach(k => { const m = [...S.phone.th[k]].reverse().find(x => x.q && !x.done); if (m && R() < .7) put('preply', E.phoneReply(S, k, Math.floor(R() * m.q.length))); });
        if (R() < .5) { const g = pickOf(['reply', 'who', 'emoji', 'tap']); put('pgame', E.phoneGame(S, g, R() < .5 ? 5 : 3, g === 'tap' ? 20 : 5)); }
      }
      if (R() < shop * .25) { const it = pickOf(E.SHOP); put('buy', E.buy(S, it.n)); }
      const inv = Object.keys(S.inv || {}).filter(k => S.inv[k] > 0);
      if (inv.length && R() < .15) put('use', E.useItem(S, pickOf(inv)));
      if (inv.length && R() < .1) put('give', E.giveGift(S, pickOf(favs), pickOf(inv)));
      put('end', E.endDay(S));
    } else break;
  }
  put('final', S); put('ending', S.ending ? E.evaluateEnding(S) : S.over);
  return { h: h.digest('hex').slice(0, 16), end: S.ending ? S.ending.id : 'over:' + S.over, di: S.di };
}

const mode = process.argv[2];
if (mode === 'record') {
  const out = {}; for (let s = 1; s <= SEEDS; s++) out[s] = run(s);
  fs.writeFileSync(FILE, JSON.stringify(out, null, 0).replace(/},"/g, '},\n"') + '\n');
  const ends = new Set(Object.values(out).map(o => o.end));
  console.log('recorded', SEEDS, 'seeds,', ends.size, 'distinct endings ->', path.relative(process.cwd(), FILE));
} else {
  const ref = JSON.parse(fs.readFileSync(FILE, 'utf8')); const n = Math.min(+mode || SEEDS, SEEDS); let bad = 0;
  for (let s = 1; s <= n; s++) { const r = run(s), g = ref[s]; if (r.h !== g.h) { bad++; if (bad <= 10) console.log('DIFF seed', s, 'ref', g.end, 'day', g.di, '-> now', r.end, 'day', r.di); } }
  console.log(bad ? 'FAIL ' + bad + '/' + n + ' seeds differ' : 'OK ' + n + ' seeds identical');
  process.exit(bad ? 1 : 0);
}
