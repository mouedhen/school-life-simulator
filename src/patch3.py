p='engine.js';s=open(p).read()
def rep(a,b):
    global s
    assert a in s,'MISSING '+a[:60]; s=s.replace(a,b,1)
# counters init
rep("log: [], over: null, ending: null,","ih: {}, hurt: {}, giftN: 0, apolN: 0, accepted: 0, refused: 0, vague: 0, investN: 0, corrected: 0, boundaryN: 0, ngp: 0, giftTo: {},\n    log: [], over: null, ending: null,")
rep("function newGame(seed) {","function newGame(seed, ngp) {")
rep("    v: 1, seed, rs:","    v: 1, ngp: ngp ? 1 : 0, seed, rs:")
# interact tracking
rep("  if (it.cost) S.blocks -= it.cost;\n  S.today['i_' + name + id]","  S.ih = S.ih || {}; S.hurt = S.hurt || {}; S.giftTo = S.giftTo || {};\n  const IH = (S.ih[name] = S.ih[name] || {}); IH[id] = (IH[id] || 0) + 1;\n  if (it.cost) S.blocks -= it.cost;\n  S.today['i_' + name + id]")
# gift count
rep("  addRel(S, name, g, ch); setFlag(S, 'GIFT_GIVEN'); S.last[name] = S.di;","  addRel(S, name, g, ch); setFlag(S, 'GIFT_GIVEN'); S.last[name] = S.di; S.giftN = (S.giftN || 0) + 1; (S.giftTo = S.giftTo || {})[name] = 1;")
# hurt tracking
rep("    case 'start': {\n      lines.push('You invent a story about ' + name + '.');","    case 'start': {\n      S.hurt[name] = (S.hurt[name] || 0) + 1;\n      lines.push('You invent a story about ' + name + '.');")
rep("    case 'insult': {\n","    case 'insult': {\n      S.hurt[name] = (S.hurt[name] || 0) + 1;\n")
rep("        S.talked = S.talked || {}; S.talked[subj] = (S.talked[subj] || 0) + 1;","        S.talked = S.talked || {}; S.talked[subj] = (S.talked[subj] || 0) + 1; S.hurt[subj] = (S.hurt[subj] || 0) + 1;")
rep("      else { addRel(S, name, -5, ch); addPop(S, -2, ch); setFlag(S, 'FOUGHT');","      else { S.hurt[name] = (S.hurt[name] || 0) + 1; addRel(S, name, -5, ch); addPop(S, -2, ch); setFlag(S, 'FOUGHT');")
rep("      S.apol[name] = (S.apol[name] || 0) + 1; setFlag(S, 'APOLOGIZED_SPECIFIC');\n      addRel(S, name, base, ch);","      S.apol[name] = (S.apol[name] || 0) + 1; S.apolN = (S.apolN || 0) + 1; if (arg === 'specific') setFlag(S, 'APOLOGIZED_SPECIFIC'); else S.vague = (S.vague || 0) + 1;\n      addRel(S, name, base, ch); if (S.rel[name] >= -10) S.accepted = (S.accepted || 0) + 1; else S.refused = (S.refused || 0) + 1;")
rep("      if (!truth) { addRel(S, name, 3, ch);","      S.investN = (S.investN || 0) + 1; if (!truth) S.corrected = (S.corrected || 0) + 1;\n      if (!truth) { addRel(S, name, 3, ch);")
rep("    case 'boundary': { S.cool[name] = S.di + 2;","    case 'boundary': { S.boundaryN = (S.boundaryN || 0) + 1; S.cool[name] = S.di + 2;")
# share neg hurt
rep("  const typ = r[0]; setFlag(S, 'REPEATED_RUMOUR');\n  if (typ === 'neg') {","  const typ = r[0]; setFlag(S, 'REPEATED_RUMOUR');\n  if (typ === 'neg') {\n    S.hurt[name] = (S.hurt[name] || 0) + 1;")

# ---- extended endings
rep("const ENDBY = {}; ENDINGS.forEach(e => ENDBY[e.id] = e);","""(D.endx || []).forEach(e => ENDINGS.push({ id: 'e' + e.num, n: e.n, q: e.q, body: '', moral: e.moral, hint: e.hint, ext: true, num: e.num, bad: [21, 56, 58, 67].includes(e.num) ? 1 : 0, ch: e.num >= 23 && e.num <= 52 ? 1 : 0 }));
const ENDBY = {}; ENDINGS.forEach(e => ENDBY[e.id] = e);""")
rep("function checks(S) {","""const CHEND = { // character endings: id -> [name, minRel, maxRel, requirement]
  e23: ['Maya Bennett', 55, 101, 'F:SHARED_SPOTLIGHT|F:STOOD_UP & I:cheer+talk+hangout>=1'],
  e24: ['Ethan Brooks', 50, 101, 'I:study+collab+askhelp+advice>=2 & H0'],
  e25: ['Chloe Rivera', 20, 60, 'F:COMPETITIVE_PLAY|F:FAIR_WORK|I:debate>=1 & H0'],
  e26: ['Liam Parker', 45, 101, 'F:TEAM_PLAYER|F:FIELD_DAY_SUPPORT|F:HELPED_TEAMMATE & F:ENCOURAGEMENT'],
  e27: ['Amira Hassan', 50, 101, 'I:study+collab+askhelp>=2 & G:10|I:collab>=1'],
  e28: ['Noah Chen', 50, 101, 'I:collab+study>=1 & F:SHARED_CREDIT|F:FAIR_WORK|F:FAIR_PROJECT'],
  e29: ['Sophie Laurent', 45, 101, 'I:talk>=3|F:RESPECTFUL_VOICE & H0'],
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
    const g = grp.match(/^(.*?)>=(\\d+)$/); const need = g ? +g[2] : 1; const body = g ? g[1] : grp;
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
      return false;
    });
  });
}
function checks(S) {""")
# new checks inside checks(): append before 'o.unfinished = true;'
rep("  o.unfinished = true;\n  return o;","""  // ---- expansion pack
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
  o.e17 = S.pop <= 25 && cntIn(top, v => v < -25) >= 2 && cntIn(vlo, v => v >= 35) >= 3 && (fl('STOOD_UP') + fl('INCLUDED_SOMEONE') + fl('BALL_REPAIR')) >= 2;
  o.e18 = S.pop < 25 && cntIn(lo, v => v >= 40) >= 3 && (S.freeActs + lunches + groups) >= 1;
  o.e19 = S.pop >= 45 && cntIn(hi, v => v >= 30) >= 3 && !fl('HYPOCRISY_EXPOSED') && sumF(['HELPED_TEAMMATE', 'SHARED_CREDIT', 'SHARED_SPOTLIGHT', 'FAIR_WORK', 'ASKED_FOR_HELP']) >= 2;
  o.e20 = cntIn(hi, v => v >= 25) >= 2 && cntIn(lo, v => v >= 25) >= 2 && (x.repairFlags >= 2 || groups >= 2);
  o.e21 = cruel >= 3 && x.cNeg25 >= 3 && (S.apolN || 0) + fl('RECONCILE_TRIED') < 2;
  o.e22 = x.repairFlags >= 3 && KIDS.filter(n => S.min[n] <= -10 && S.rel[n] > 15).length >= 2 && (S.boundaryN || 0) >= 1;
  Object.keys(CHEND).forEach(id => { const [nm, mn, mx, req] = CHEND[id]; o[id] = rel(nm) >= mn && rel(nm) < mx && reqOk(S, nm, req); });
  o.e53 = (S.investN || 0) >= 3 && (S.corrected || 0) >= 2 && S.gossip <= 1;
  o.e54 = fl('INVESTIGATED_RUMOUR') > 0 && (S.corrected || 0) >= 1 && S.started === 0 && !fl('BLAME_SHIFT') && S.gossip <= 1;
  o.e55 = sec.length >= 1;
  o.e56 = S.gossip >= 2 && S.started >= 1 && x.cNeg25 >= 2 && (fl('SHARED_SECRET') > 0);
  o.e57 = (S.apolN || 0) >= 3 && fl('APOLOGIZED_SPECIFIC') > 0 && (S.accepted || 0) >= 1 && (S.refused || 0) >= 1 && (S.vague || 0) === 0;
  o.e58 = ((S.vague || 0) >= 1 || fl('PUBLIC_ACCOUNTABILITY') === 0 && (S.apolN || 0) >= 2 && !fl('APOLOGIZED_SPECIFIC')) && (S.refused || 0) >= 2;
  o.e59 = lunches >= 4 && x.c20 >= 4;
  o.e60 = S.grade >= 90 && x.cnt(v => v > 10) < 2 && x.kind === 0 && S.freeActs === 0;
  o.e61 = S.money >= 50 && S.earned >= 50 && ((S.loans || []).length >= 1 || (S.boundaryN || 0) >= 1 || Object.keys(S.asks || {}).length >= 0 && (S.boundaryN || 0) >= 1);
  o.e62 = S.money <= 5 && (S.giftN || 0) >= 3 && giftTos.some(n => rel(n) < 10);
  o.e63 = fl('BALL_BACKSTAGE') > 0 && volunteer >= 3 && ['Emma Clarke', 'Adrian Flores', 'Maya Bennett', 'Chloe Rivera', 'Naomi Brooks'].some(n => rel(n) > 30);
  o.e64 = (fl('BALL_INCLUSIVE_PLAN') || fl('BALL_BACKSTAGE')) > 0 && x.repairFlags >= 2 && fl('BALL_GLAMOUR') === 0;
  o.e65 = !S.ballDate && (fl('BALL_INDEPENDENT') || fl('BALL_BACKSTAGE')) > 0 && x.c20 >= 2;
  o.e66 = KIDS.some(n => S.min[n] < -10 && S.rel[n] >= 35 && !(S.hurt[n] > 2));
  o.e67 = betray.some(n => !(S.apol[n]) && !F(S, 'RECONCILE_TRIED'));
  o.e68 = KIDS.some(n => S.min[n] <= -40 && S.rel[n] >= 10 && (S.apol[n] || 0) >= 1) && x.repairFlags >= 3;
  o.e69 = posF >= 3 && negF >= 3 && KIDS.some(n => rel(n) >= 30) && KIDS.some(n => rel(n) <= -20) && KIDS.some(n => rel(n) > -10 && rel(n) < 20);
  o.e70 = !!S.ngp;
  o.unfinished = true;
  return o;""")
# priority + evaluation
a=s.index("const PRIORITY = [")
b=s.index("\n",s.index("function evaluateEnding"))
b=s.index("\n}\n",a)+3
new="""const BROAD = ['hypocrite', 'e21', 'e56', 'e67', 'saint', 'redemption', 'e68', 'e17', 'e19', 'e20', 'e22', 'e18', 'genuine', 'courageous', 'peacemaker', 'e53', 'e54', 'e55', 'e57', 'e59', 'e63', 'e64', 'e66', 'comeback', 'scholar', 'selfmade', 'broke', 'e61', 'e62', 'e60', 'independent', 'e65', 'second', 'memory', 'e58', 'missed', 'crown', 'lucky', 'e69'];
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
"""
s=s[:a]+new+s[b:]
open(p,'w').write(s)
