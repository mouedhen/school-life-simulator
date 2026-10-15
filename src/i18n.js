/* Sentence-level French layer: protects names/numbers as tokens, translates sentence by sentence via FRX. */
(function (root) {
  const D = root.DATA; const FRX = () => root.FRX || {};
  const nameSet = new Map(); // surface -> {kind}
  D.chars.forEach(c => {
    if (c.role === 'kid') { nameSet.set(c.n, 1); nameSet.set(c.n.split(' ')[0], 1); }
    else if (c.role === 'fam') { nameSet.set(c.n, 1); }
    else if (c.role === 'teach') { nameSet.set(c.n, 1); const p = c.n.split(' '); nameSet.set(p[0] + ' ' + p[p.length - 1], 1); }
  });
  nameSet.set('Mom', 1); nameSet.set('Dad', 1);
  const esc1 = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const build = extra => { const arr = [...nameSet.keys()]; if (extra) arr.push(extra); arr.sort((a, b) => b.length - a.length); return new RegExp('(?<![A-Za-z])(' + arr.map(esc1).join('|') + ')(?![A-Za-z])', 'g'); };
  let NAMERE = build(); let curPlayer = ''; const cache = new Map();
  const A = '', B = '';
  const MON = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const DATERE = new RegExp('(?:(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,? )?(?:' + MON + ') \\d{1,2}(?!\\d)', 'g');
  const FRD = { Monday: 'lundi', Tuesday: 'mardi', Wednesday: 'mercredi', Thursday: 'jeudi', Friday: 'vendredi', Saturday: 'samedi', Sunday: 'dimanche', January: 'janvier', February: 'février', March: 'mars', April: 'avril', May: 'mai', June: 'juin', July: 'juillet', August: 'août', September: 'septembre', October: 'octobre', November: 'novembre', December: 'décembre' };
  const frDate = v => { const m = v.match(new RegExp('^(?:(\\w+day),? )?(' + MON + ') (\\d{1,2})$')); if (!m) return v; return (m[1] ? FRD[m[1]] + ' ' : '') + (m[3] === '1' ? '1er' : m[3]) + ' ' + FRD[m[2]]; };
  const frName = v => v === 'Mom' ? 'Maman' : v === 'Dad' ? 'Papa' : /^Ms\. /.test(v) ? 'Mme ' + v.slice(4) : /^Mr\. /.test(v) ? 'M. ' + v.slice(4) : v;
  function setPlayer(n) { if (n === curPlayer) return; curPlayer = n; cache.clear(); NAMERE = build(n && n.length > 1 && n !== 'MC' ? n : null); }
  const enc = n => String(n).replace(/\d/g, d => 'abcdefghij'[d]); const dec = z => +z.replace(/[a-j]/g, c => 'abcdefghij'.indexOf(c));
  function protect(text) {
    const vals = [];
    let s = text.replace(DATERE, m => { vals.push(m); return A + enc(vals.length - 1) + B; });
    s = s.replace(/[$]?\d+(?:[.,]\d+)?%?/g, m => { vals.push(m); return A + enc(vals.length - 1) + B; });
    s = s.replace(NAMERE, m => { vals.push(m); return A + enc(vals.length - 1) + B; });
    return { s, vals };
  }
  const SPLIT = /((?<=[.!?…]["”’)]?)\s+|(?<=:)\s+(?=["“])| — |, (?=(?:teacher watching|already warned|a classmate sees|subtle|lucky charm))|(?<=risk:)\s+)/;
  function segments(text) {
    const { s, vals } = protect(String(text));
    const bits = s.split(SPLIT); const parts = [], seps = [];
    bits.forEach((b, i) => { if (i % 2 === 0) parts.push(b); else seps.push(b); });
    return parts.map((p, pi) => {
      const m = p.match(/^([“"‘'(\s—*-]*)([\s\S]*?)([”"’')\s*]*)$/); let pre = m[1], core = m[2], post = m[3];
      if (post.indexOf(')') >= 0 && pre.indexOf('(') < 0) { const k = post.indexOf(')'); core += post.slice(0, k + 1); post = post.slice(k + 1); }
      if (pre.indexOf('(') >= 0 && post.indexOf(')') < 0) { /* keep */ }
      const order = []; const key = core.replace(new RegExp(A + '([a-j]+)' + B, 'g'), (x, z) => { const i = dec(z); let k = order.indexOf(i); if (k < 0) { order.push(i); k = order.length - 1; } return '{' + k + '}'; });
      return { pre, post, key, sep: seps[pi] == null ? '' : seps[pi], vals: order.map(i => vals[i]) };
    });
  }
  const fq = x => x.replace(/[“"]/g, '« ').replace(/[”"]/g, ' »');
  function fill(fr, vals) {
    return fr.replace(/(\b(?:de|que|De|Que) )?\{(\d+)\}/g, (m, pre, i) => {
      let v = frDate(frName(vals[+i] == null ? '' : vals[+i]));
      if (pre) { if (/^[AEIOUYÉÈÂÎÔÛ]/.test(v) && !/^\d|^\$/.test(v)) return (pre[0] === 'd' || pre[0] === 'D' ? pre[0] + "'" : pre[0] + "qu'".slice(1)) + v; return pre + v; }
      return v;
    });
  }
  const miss = new Set();
  const cap = x => x.charAt(0).toUpperCase() + x.slice(1), low = x => x.charAt(0).toLowerCase() + x.slice(1);
  const item = x => { const F = FRX(); x = String(x).replace(/\.$/, ''); return F[x] || F[cap(x)] || x; };
  const RULES = [
    [/^Bought: (.+)$/, m => 'Acheté : ' + item(m[1])],
    [/^Bought (.+)$/, m => 'Acheté : ' + item(m[1])],
    [/^Used (.+)$/, m => 'Utilisé : ' + item(m[1])],
    [/^On the first page, in handwriting that is not mine, someone left a line: “(.+)” I read it twice\. It felt like being looked after\.$/, m => 'Sur la première page, d\'une écriture qui n\'est pas la mienne, quelqu\'un a laissé une ligne : « ' + m[1] + ' » Je l\'ai lue deux fois. J\'ai eu l\'impression qu\'on prenait soin de moi.'],
    [/^Received: (.+)\.$/, m => 'Reçu : ' + item(m[1]) + '.'],
    [/^Gave (.+) to (.+)$/, m => 'Offert à ' + frName(m[2]) + ' : ' + item(m[1])],
    [/^Inside: (.+)\.$/, m => 'Dedans : ' + item(m[1]) + '.'],
    [/^Worked: (.+)$/, m => 'Travaillé : ' + item(m[1])],
    [/^I treated myself and bought (.+)\.$/, m => 'Je me suis fait plaisir : ' + low(item(m[1])) + '.'],
    [/^I used my (.+)\.$/, m => "J'ai utilisé : " + low(item(m[1])) + '.'],
    [/^I gave (.+?) an? (.+)\. I hope they liked it\.$/, m => "J'ai offert à " + frName(m[1]) + ' : ' + low(item(m[2])) + ". J'espère que ça a plu."],
    [/^I worked a shift today \((.+)\)\. My feet hurt, but my wallet is happier\.$/, m => "J'ai fait un quart de travail aujourd'hui (" + low(item(m[1])) + "). J'ai mal aux pieds, mais mon portefeuille est content."],
  ];
  function tr(text) {
    if (!(root.__LANG && root.__LANG() === 'fr') && !(root.I18N && root.I18N.force)) return text;
    if (text == null || text === '') return text;
    const k0 = String(text); if (cache.has(k0)) return cache.get(k0);
    const F = FRX(); for (const [re, fn] of RULES) { const mm = k0.match(re); if (mm) { const r0 = fn(mm); cache.set(k0, r0); return r0; } }
    const segs = segments(k0); let any = false;
    const out = segs.map(sg => {
      if (!sg.key.trim() || !/[A-Za-z]{2}/.test(sg.key.replace(/\{\d+\}/g, ''))) return sg.pre + fill(sg.key, sg.vals) + sg.post + sg.sep;
      let fr = F[sg.key]; if (fr == null && /[.!]$/.test(sg.key) && F[sg.key.slice(0, -1)] != null) fr = F[sg.key.slice(0, -1)] + sg.key.slice(-1); if (fr == null) { miss.add(sg.key); return sg.pre + fill(sg.key, sg.vals) + sg.post + sg.sep; }
      any = true; return fq(sg.pre) + fill(fr, sg.vals) + fq(sg.post) + sg.sep;
    }).join('');
    let r = out.replace(/ ?([?!;])(?=\s|$|[”»"])/g, ' $1').replace(/([A-Za-zÀ-ÿ)»]) ?:(?= )/g, '$1 :');
    r = r.replace(/  /g, ' ');
    cache.set(k0, r); return r;
  }
  root.I18N = { tr, segments, setPlayer, miss, force: false, clear: () => cache.clear() };
  if (typeof module !== 'undefined') module.exports = root.I18N;
})(globalThis);
