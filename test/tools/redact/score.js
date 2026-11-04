// Scores redaction on made-up papers: what share of each kind of identifying detail gets fully covered, and how many ordinary words get covered by mistake.
// node test/tools/redact/score.js [dev|test|fresh|blind|blind2] [count]
// "roster" is the covering Grading Studio does today (src/names.js); "network" is the hand-written network (src/redact.js); "both" is the two together;
// "decision" is both, after the decision model (reviewCovers in src/redact.js) has looked at each class's covers together and taken some off.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { make } = require('./make-papers');
const root = path.join(__dirname, '../../..');

// src/names.js with just enough of the app around it to run outside the browser.
function rosterCover() {
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const grab = name => { const i = app.indexOf('const ' + name + ' ='); return app.slice(i, app.indexOf('\n', i)); };
  const ctx = { batch: null, console, window: { __gs: {} } };
  vm.createContext(ctx);
  vm.runInContext(grab('LETTER_PLAIN') + '\n' + grab('nameFold') + '\n' + grab('SORT_STOP') + '\n' + fs.readFileSync(path.join(root, 'src/names.js'), 'utf8').replace(/^Object\.assign\(window\.__gs.*$/m, '') +
    '\nfunction batchClass() { return { names: batch.roster }; }\nfunction rosterMatch(names) { return names.map(n => [n, { key: n }]); }\nthis.coverRx = coverRx; this.reset = () => { nameMemo = { sig: null }; };', ctx);
  return (p) => {
    if (!ctx.batch || ctx.batch.roster !== p.roster) { ctx.batch = { roster: p.roster, students: p.roster.map(key => ({ key })) }; ctx.reset(); }
    const rx = ctx.coverRx({ key: p.student }), out = [];
    for (const m of p.text.matchAll(rx)) if (m[0]) out.push([m.index, m.index + m[0].length]);
    return out;
  };
}

function covered(text, ranges) { const c = new Uint8Array(text.length); for (const [a, b] of ranges) c.fill(1, Math.max(0, a), Math.min(text.length, b)); return c; }
const LETTER = /[\p{L}\p{N}]/u;

// Taylor's definition (11/4): names, contact details, ID numbers, street addresses and birthdays identify a student;
// a town, team or school on its own doesn't, so covering one counts as a mistake. --places scores the older, wider definition.
let WIDE = false;
const kind = s => s.type === 'PLACE' ? (WIDE ? 'PLACE' : /\d/.test(s.value) ? 'ADDRESS' : 'PUBLIC') : s.type === 'SCHOOL' && !WIDE ? 'PUBLIC' : s.type;
function score(papers, system) {
  const tally = {}, miss = [], wrong = {}, perClass = new Map(); let words = 0, wrongWords = 0, publicWrong = 0, coveredWords = 0;
  for (const p of papers) {
    const cw = perClass.get(p.roster) || new Set(); perClass.set(p.roster, cw);
    const c = covered(p.text, system(p)), inSpan = new Uint8Array(p.text.length), isPublic = new Uint8Array(p.text.length);
    for (const s of p.spans) (kind(s) === 'PUBLIC' ? isPublic : inSpan).fill(1, s.start, s.end);
    for (const s of p.spans) {
      if (kind(s) === 'PUBLIC') continue;
      const k = s.type === 'PERSON' ? 'PERSON/' + s.who : kind(s), t = tally[k] ||= [0, 0];
      let ok = true; for (let i = s.start; i < s.end; i++) if (LETTER.test(p.text[i]) && !c[i]) { ok = false; break; }
      t[1]++; if (ok) t[0]++; else miss.push(k + ': ' + s.value + '  in  ' + p.text.slice(Math.max(0, s.start - 40), s.end + 30).replace(/\n/g, ' / '));
    }
    for (const m of p.text.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’.-]*/gu)) {
      const a = m.index, b = a + m[0].length; words++;
      let cov = false; for (let i = a; i < b; i++) if (c[i]) { cov = true; break; }
      if (!cov) continue; coveredWords++;
      let pii = false, pub = false; for (let i = a; i < b; i++) { if (inSpan[i]) pii = true; if (isPublic[i]) pub = true; }
      if (!pii) { wrongWords++; if (pub) publicWrong++; wrong[m[0]] = (wrong[m[0]] || 0) + 1; cw.add(m[0].replace(/[.'’]+$|['’]s$/g, '')); }
    }
  }
  // what a teacher would click to uncover, if one click uncovers a word for the whole class
  const toClick = [...perClass.values()].reduce((a, c) => a + c.size, 0) / Math.max(1, perClass.size);
  return { tally, miss, wrong, words, wrongWords, publicWrong, coveredWords, toClick };
}

function report(name, r) {
  const all = Object.values(r.tally).reduce((a, t) => [a[0] + t[0], a[1] + t[1]], [0, 0]);
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
  console.log('\n== ' + name + ' ==');
  console.log('Identifying details fully covered: ' + pct(...all) + ' (' + all[0] + ' of ' + all[1] + ')');
  for (const [k, t] of Object.entries(r.tally).sort()) console.log('  ' + k.padEnd(16) + pct(...t).padStart(7) + '  (' + t[0] + '/' + t[1] + ')');
  console.log('Ordinary words covered by mistake: ' + r.wrongWords + ' of ' + r.words + ' words (' + pct(r.wrongWords, r.coveredWords) + ' of all covers), ' + r.publicWrong + ' of them books, authors, characters or public places');
  console.log('Different words to uncover per class of 20: ' + r.toClick.toFixed(1));
  return all;
}

if (require.main === module) {
  const [split = 'dev', count = 500, ...flags] = process.argv.slice(2), seed = { dev: 1, test: 7, fresh: 13, blind: 29, blind2: 41 }[split];
  WIDE = flags.includes('--places');
  const papers = split === 'blind2' ? require('./blind2').make(+count, seed) : make(+count, seed, split);
  // the roster covering is slow outside the browser, so what it finds is kept in out/ between runs
  const cacheFile = path.join(root, 'out/redact-roster-' + split + '-' + count + '.json');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
  let live = null;
  const roster = p => cache[p.id] ||= (live ||= rosterCover())(p);
  let net = null; try { net = require(path.join(root, 'src/redact.js')); net.redactWords(fs.readFileSync(path.join(root, 'src/redact-words.txt'), 'utf8'), fs.readFileSync(path.join(root, 'src/redact-names.txt'), 'utf8')); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  const systems = { roster };
  if (net) {
    systems.network = p => net.findPrivate(p.text, { roster: p.roster, student: p.student, places: WIDE }).map(s => [s.start, s.end]);
    systems.both = p => roster(p).concat(systems.network(p));
    // the decision model looks at a class at a time: the papers that share a roster, and the class's task sheet when there is one
    const kept = new Map();
    systems.decision = p => {
      if (!kept.has(p.id)) {
        const cls = papers.filter(q => q.roster === p.roster);
        const r = net.reviewCovers(cls.map(q => ({ text: q.text, hits: net.findPrivate(q.text, { roster: q.roster, student: q.student, places: WIDE }), roster: q.roster })), { task: cls[0].task });
        cls.forEach((q, i) => kept.set(q.id, r[i].keep.map(s => [s.start, s.end])));
      }
      return roster(p).concat(kept.get(p.id));
    };
  }
  for (const p of papers) roster(p);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(cache));
  for (const [name, sys] of Object.entries(systems)) {
    const r = score(papers, sys);
    report(name, r);
    if (flags.includes('--why') && name === (net ? 'decision' : 'roster')) {
      console.log('\nMissed (first 60):'); r.miss.slice(0, 60).forEach(m => console.log('  ' + m));
      console.log('\nCovered by mistake, most often:'); console.log('  ' + Object.entries(r.wrong).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([w, n]) => w + ' ' + n).join(', '));
    }
  }
}
module.exports = { score, rosterCover, wide: w => { WIDE = w; } };
