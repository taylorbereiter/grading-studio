// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, saveSoon, store, idbDo, ownGrade, fmtNum } from './gcore.js';
import { madeFromWord, scrub, nameFold, anonOn, SORT_STOP, AT_START, ID_RX, latinRx, isLatin, anyRx, wordOk, bounded, alt, runAlts, latinParts, initialAlts, altsRx, namesNow, ownNames, AT_END, FILE_SEP } from './gdraw.js';
import { moveFileNow, REF_KEY, underId, paperGet, goneNow, hasSheet, gradeHasWork } from './gopen.js';
import { sameBytes } from './greport.js';

// src/app/files.js
function setDocIn(st, d, on) {
  if (st.layout) { const t = st.layout.find(x => x === d || (x.name === d.name && JSON.stringify(x.pages) === JSON.stringify(d.pages))); if (t) t.out = !on; }
  else { st.inc = st.inc || {}; st.inc[d.file] = on; }
  saveSoon();
}
// src/app/library.js
let fresh = store.get('gs.lib', null) == null;   // a browser nobody has used yet: it gets the welcome, and nothing of anyone's
// src/app/replace.js
const markCount = f => Object.values(f.marks || {}).reduce((n, a) => n + a.length, 0);
// src/app/replace.js
const replacedOf = f => { const st = batch && batch.students[cur]; if (!st || !batch.removed) return null; const p = Object.keys(batch.removed).find(k => batch.removed[k].by === f.path && !batch.removed[k].back); return p ? ((st.gone || []).find(g => g.path === p) || { name: p.slice(p.lastIndexOf('/') + 1) }) : null; };
// src/app/bringin.js
const sortTag = r => r.i === -2 ? '<span class="muted">Skipped</span>' : r.i < 0 ? '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Choose</span>'
  : r.set ? '<span class="muted">Chosen by you</span>' : r.sure ? '<span style="color:var(--ok);font-size:13px;font-weight:600">Matched by name</span>' : '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Check</span>';
// src/names.js
function fileAlts(parts) {
  const out = [], L = latinParts(parts);
  for (const p of parts) if (wordOk(p)) {
    const w = nameFold(p), latin = isLatin(p);
    out.push(alt(w.length, latin && w.length >= 3 && !SORT_STOP.has(w) ? anyRx(p) : bounded(p, anyRx(p))));
    if (latin && w.length < 3) out.push(alt(w.length, '(?<!\\p{Lu})' + latinRx(w, true) + '(?!\\p{Ll})'));   // MyEssay, EssayMy
  }
  for (const a of L) for (const b of L) if (a !== b && nameFold(b).length >= 2) out.push(alt(nameFold(b).length + 2, AT_START + latinRx(nameFold(b)) + FILE_SEP + latinRx(nameFold(a)[0]) + AT_END));
  if (L.length >= 2) out.push(alt(2, AT_START + L.map(p => latinRx(nameFold(p)[0])).join('') + AT_END));
  return out;
}
// src/names.js
function fileRx(st) {
  const N = namesNow(); let rx = N.file.get(st.key);
  if (!rx) N.file.set(st.key, rx = new RegExp([ID_RX, altsRx(ownNames(st).map(p => [...runAlts(p), ...initialAlts(p), ...fileAlts(p)])), N.classSrc].filter(Boolean).join('|'), 'gu'));
  return rx;
}
// src/names.js
const fileShown = (st, name) => anonOn() && st ? scrub(name, fileRx(st)) : name;
// src/grades.js
const STATUS_LABEL = { missing: 'Missing', excused: 'Excused', late: 'Late' };
// src/grades.js
function gradeWords(st) {
  const g = st.grade, own = ownGrade(st).total, out = [];
  if (own != null && !isNaN(own)) out.push('a score of ' + fmtNum(own));
  else if (hasSheet(g)) out.push('a score of ' + g.sheet);
  else if ((g.rubric || []).some(v => v != null) || (g.points != null && g.points !== '')) out.push('a score');
  if (g.comment) out.push('a comment');
  if (g.status) out.push('the status ' + STATUS_LABEL[g.status]);
  return out;
}
// src/grades.js
const wordsJoin = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
// src/carryover.js
const nfc = s => String(s).normalize('NFC');
// src/intake.js
async function freshRows(rows) {
  const here = batch.students.flatMap(st => st.files.filter(f => f.kind !== 'img' && !f.virtual && f.data).map(f => ({ path: f.path, data: f.data })));
  try { const rec = await paperGet(batch.id); if (rec && rec.entries) here.push(...rec.entries.filter(e => e.data)); } catch {}
  try { here.push(...((await idbDo('readonly', o => o.getAll(underId(batch.id)))) || []).filter(r => r.bid === batch.id && r.key !== REF_KEY && r.data)); } catch {}
  const sizes = new Set(here.map(x => x.data.length)), fresh = [];
  let dups = 0;
  for (const r of rows) {
    let same = false;
    if (sizes.has(r.e.file.size)) {
      const bytes = new Uint8Array(await r.e.file.arrayBuffer());
      same = here.some(x => sameBytes(x.data, bytes) && (r.i < 0 || !batch.students[r.i] || batch.students[r.i].files.some(f => nfc(f.path) === nfc(x.path))));
    }
    if (same) dups++; else fresh.push(r);
  }
  return { fresh, dups };
}
// src/intake.js
const guessNewName = path => { const p = path.split('/').filter(Boolean); return (p.length > 2 ? p[p.length - 2] : p.length > 1 ? p[0] : p[0].replace(/\.[^.]+$/, '')).trim(); };
export { goneNow, markCount, replacedOf, freshRows, guessNewName, fileShown, sortTag, madeFromWord, setDocIn, gradeWords, wordsJoin, moveFileNow, gradeHasWork };
