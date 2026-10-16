// static + dynamic string harvest -> keys.json
const fs = require('fs');
require('./data.js'); require('./talk.js'); require('./i18n.js'); const E = require('./engine.js');
I18N.force = true; I18N.setPlayer('Sam');
const raw = new Set();
const add = s => { if (typeof s === 'string' && /[A-Za-z]{3}/.test(s)) raw.add(s); };
const SKIP_T = new Set(['flag', 'rel', 'pop', 'grade', 'money', 'gossip', 'either', 'spill']);
const walk = (o, k) => {
  if (typeof o === 'string') { if (['n', 'b', 'g', 'f', 'k', 'l', 'who', 'role', 'sp', 'd', 'id'].includes(k) && !(k === 'd')) return; if (SKIP_T.has(o)) return; if (/^[A-Z_0-9]+$/.test(o)) return; if (/^\d{4}-\d\d-\d\d$/.test(o)) return; add(o); }
  else if (Array.isArray(o)) o.forEach(x => walk(x, k));
  else if (o && typeof o === 'object') Object.keys(o).forEach(kk => walk(o[kk], kk));
};
walk(DATA);
// character names must not be translated
DATA.chars.forEach(c => raw.delete(c.n));
// dialogue tables
const T = TALK;
Object.keys(T.R).forEach(k => T.R[k].forEach(cell => String(cell).split('|').forEach(v => v && add(v))));
Object.keys(T.DIR).forEach(k => T.DIR[k].forEach(d => d && add('Luna ' + d + ':')));
T.D0.forEach(d => add('Luna ' + d + ':'));
const wk = o => { if (typeof o === 'string') add(o); else if (Array.isArray(o)) o.forEach(wk); else if (o && typeof o === 'object') Object.keys(o).forEach(k => { if (k !== 'fx') wk(o[k]); }); };
wk(T.P); wk(T.FP);
// engine tables
['ENDINGS', 'SPECIAL', 'RAND', 'SHOP', 'JOBS', 'INTER'].forEach(k => { try { wk(E[k]); } catch (e) {} });
// flags (chips)
const flags = new Set(); const src = fs.readFileSync('engine.js', 'utf8') + fs.readFileSync('talk.js', 'utf8') + JSON.stringify(DATA);
(src.match(/f:([A-Z][A-Z_0-9]+)/g) || []).forEach(m => flags.add(m.slice(2))); (src.match(/"f":"([A-Z][A-Z_0-9]+)"/g) || []).forEach(m => flags.add(m.slice(5, -1)));
flags.forEach(f => add(f.toLowerCase().replace(/_/g, ' ')));
// dynamic: ball scenes under many states
for (let seed = 1; seed <= 40; seed++) {
  const S = E.newGame(seed); const r = E.mul(seed);
  E.KIDS.forEach(n => S.rel[n] = Math.floor(r() * 120) - 40);
  S.money = [0, 5, 30][seed % 3]; S.pop = 20 + Math.floor(r() * 70); S.grade = 30 + Math.floor(r() * 70);
  if (seed % 2) S.ballDate = E.KIDS[seed % 30]; if (seed % 3 === 0) { S.gossip = 2; S.hurt = { [E.KIDS[3]]: 1 }; }
  for (let st = 0; st < 5; st++) {
    S.pend = { kind: 'ball', st }; S.phase = 'event'; const ev = E.buildEvent(S);
    add(ev.title); add(ev.desc); ev.choices.forEach(c => { add(c.x); if (c.why) add(c.why); });
    for (let i = 0; i < ev.choices.length; i++) { const S2 = JSON.parse(JSON.stringify(S)); S2.pend = { kind: 'ball', st }; const rr = E.choose(S2, i); if (rr) (rr.lines || []).forEach(add); }
  }
}

const traces = process.argv.slice(2);
// composed journal/log sentences: items x templates, name lists x templates
const lc1 = x => x.charAt(0).toLowerCase() + x.slice(1);
const items = new Set(E.SHOP.map(x => x.n)); ['Comic book', 'Chocolate box', 'Hoodie', 'Poster', 'Concert ticket', 'Study guide', 'Calculator', 'Smartwatch', 'Houseplant', 'Notebook'].forEach(x => items.add(x));
traces.forEach(f => JSON.parse(fs.readFileSync(f, 'utf8')).forEach(s => { let m; if ((m = s.match(/^Bought (.+)$/)) || (m = s.match(/^Used (.+)$/)) || (m = s.match(/^Inside: (.+)\.$/)) || (m = s.match(/^Gave (.+) to /))) { if (m[1].length < 40 && !/[.{]/.test(m[1])) items.add(m[1].replace(/^./, c => c.toUpperCase())); } }));
items.forEach(it => { add('I treated myself and bought ' + lc1(it) + '.'); add('I used my ' + lc1(it) + '.'); add('I gave Luna a ' + lc1(it) + '. I hope they liked it.'); add('Gave ' + it + ' to Luna'); add('Gave ' + it + ' to Mom'); add('Bought ' + it); add('Used ' + it); add('Inside: ' + it + '.'); add('Bought: ' + it); });
E.JOBS.forEach(j => { add('I worked a shift today (' + lc1(j.n) + '). My feet hurt, but my wallet is happier.'); add('Worked: ' + j.n); });
const nl = [['Luna'], ['Luna', 'Max'], ['Luna', 'Max', 'Zara']]; const lj = a => a.length <= 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
nl.forEach(a => { const L = lj(a); const pl = a.length > 1;
  add('I feel much closer to ' + L + ' now.'); add('I became closer to ' + L + '.'); add(L + (pl ? ' were' : ' was') + ' a little friendlier with me.');
  add('I really hurt ' + L + ', and I know it.'); add('I think I upset ' + L + '.'); add(L + ' seemed a bit cooler toward me.'); });
// trace files
traces.forEach(f => JSON.parse(fs.readFileSync(f, 'utf8')).forEach(add));
const lits = require('../lits.json');
lits.forEach(l => { if (/[àâçéèêëîïôûùüÿœ«»]/.test(l) || /\b(le|la|les|des|une|est|pour|tu|je|ton|ta|vous|dans|avec|sur)\b/.test(l) || l === 'use strict' || /\{t\}/.test(l)) return; add(l.replace(/\{n\}|\{X\}|\{Y\}/g, 'Luna')); });
const RULEPAT = [/^Bought:? /, /^Used /, /^Gave .* to /, /^Inside: .*\.$/, /^Worked: /, /^I treated myself and bought /, /^I used my /, /^I gave .* an? .*\. I hope they liked it\.$/, /^I worked a shift today \(/];
const keys = new Map();
const itemKeys = new Set(); items.forEach(it => itemKeys.add(it)); E.JOBS.forEach(j => itemKeys.add(j.n)); itemKeys.forEach(it => raw.add(it));
for (const r of [...raw]) if (RULEPAT.some(p => p.test(r))) raw.delete(r);
raw.forEach(s => I18N.segments(s).forEach(sg => { if (/^[a-z_]+$/.test(sg.key) || /^[A-Za-z]+\(/.test(sg.key)) return; if (!sg.key.trim() || !/[A-Za-z]{2}/.test(sg.key.replace(/\{\d+\}/g, ''))) return; if (!keys.has(sg.key)) keys.set(sg.key, 1); }));
const arr = [...keys.keys()].sort();
fs.writeFileSync('../keys.json', JSON.stringify(arr));
console.log('raw', raw.size, 'keys', arr.length, 'chars', arr.reduce((a, k) => a + k.length, 0));
