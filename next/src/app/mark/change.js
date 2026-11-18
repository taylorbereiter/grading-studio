// A student's files changed on the marking screen, as the current app changes them (src/app/kept.js addFiles, src/app/replace.js
// removeFile, bringBack, replaceFile and replaceDo): a file added to a student, one taken off (it waits under Removed files with its
// marks, for Bring back), and one put in another's place. What each does to the student's files, pages and the download's removed
// list is the current app's; a file she added is kept in this browser through students/write.js keepAdded. Each change is one
// step on the one undo list. Loaded as a part of its own (router.js PARTS.change).
// Not here yet: a group's shared paper and a partner's video changing with it (sameCopies) comes with group work.
import { state, noScore, use } from '../../engines/gcore.js';
import * as D from '../../engines/gdraw.js';
import * as E from '../../engines/gopen.js';
import * as F from '../../engines/gfiles.js';
import * as K from '../../engines/gmark.js';
import { PARTS } from '../router.js';
import { libs } from './paper.js';

let M = null, show = () => {};
// m: the marking code (mark/marking.js); open(i, path): show this student (and file) on screen.
export function wire(m, open) { M = m; show = open; use({ rescanFile: rescan }); }
const b = () => state().batch;
const tell = () => M && M.changedNow();
const step = (back, again, what) => K.pushUndo({ act: { back, again }, what });
const J = v => (v == null ? null : JSON.parse(JSON.stringify(v)));

// Files from this computer added to a student (addFiles). list: [{ path, file }]. Returns the files made.
export async function addFiles(st, list) {
  list = list.filter(e => e.file && !E.junk(e.path) && !E.houseFile(e.path));
  if (!list.length) return [];
  K.commitEditors();
  const pdfjs = await libs(), X = (await PARTS.outEngine()).X, W = await PARTS.write(), bb = b(), made = [];
  for (const e of list) {
    const bytes = new Uint8Array(await e.file.arrayBuffer());
    const name = e.file.name.replace(/[\\/]+/g, '-'), base = st.key + '/' + name;
    let path = base, k = 2;
    while (st.files.some(f => f.path === path) || (st.gone || []).some(f => f.path === path)) path = base.replace(/(\.[^./]+)?$/, ' (added ' + k++ + ')$1');
    const f = await E.makeFile(path, bytes); f.added = Date.now(); f.akey = st.key; if (e.from) f.from = e.from;
    if (f.photoTurn) f.rot = { 0: f.photoTurn };
    if (D.viewable(f)) {
      try { const d = await pdfjs.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise; f.numPages = d.numPages; d.destroy(); } catch {}
      if (st.layout && f.numPages) st.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
      try { f.scan = await X.scanFile(f, f.hand || state().setup.spot || null); f.kami = f.scan.kami; } catch {}
    }
    st.files.push(f); made.push(f);
    try { await W.keepAdded(bb.id, { bid: bb.id, key: st.key, path: f.path, name: f.name, data: bytes, added: f.added, ...(f.from ? { from: f.from } : {}) }, bb.id + '|' + st.key + '|' + f.path); }
    catch (er) { console.error(er); made.notKept = (made.notKept || []).concat(f.name); }
  }
  tell();
  return made;
}

// Remove: the file and its marks leave the paper and the export, and wait under Removed files (removeFile, bringBack).
export function marksOn(st, path) { const f = D.fileByPath(st, path); return f ? F.markCount(f) : 0; }
export async function removeFile(st, path, again) {
  const f = D.fileByPath(st, path); if (!f) return;
  if (!again) await M.saveNowDone();   // boxes highlighted a moment ago count (not on redo: nothing is waiting then)
  K.commitEditors();
  const was = { L: J(st.layout), o: st.forder ? st.forder.slice() : null };
  F.goneNow(st, f);
  (b().removed ||= {})[path] = { t: Date.now() };
  if (!again) step(() => bringBack(st, path, was, true), () => removeFile(st, path, true), 'removed ' + F.fileShown(st, f.name));
  tell(); show(b().students.indexOf(st));
  return f;
}
export function bringBack(st, path, was, undoing) {
  const f = (st.gone || []).find(g => g.path === path); if (!f) return;
  if (!undoing) step(() => { const L = J(st.layout), o = st.forder ? st.forder.slice() : null; F.goneNow(st, f); b().removed[path] = { t: Date.now() }; tell(); show(b().students.indexOf(st)); return { L, o }; }, () => bringBack(st, path, null, true), 'brought back ' + F.fileShown(st, f.name));
  st.gone.splice(st.gone.indexOf(f), 1); st.files.push(f);
  if (was && was.L !== undefined) { st.layout = was.L; st.forder = was.o; if (!st.forder) delete st.forder; }
  else if (st.layout && D.viewable(f) && f.numPages) st.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
  const r = b().removed; if (r && r[path]) r[path] = { back: Date.now() };
  tell(); show(b().students.indexOf(st), path);
  return f;
}

// Replace: the new file takes the old one's place on the paper and in the export; the old one, with its marks, waits under Removed
// files. The score is on the student, so it stays. Undo puts every file back as it was (replaceDo, rplSnap, rplPut).
function snap(st, paths) {
  const bb = b();
  return { files: st.files.slice(), gone: (st.gone || []).slice(), layout: J(st.layout), forder: st.forder ? st.forder.slice() : null, inc: J(st.inc),
    tries: ((st.grade && st.grade.tries) || []).map(t => (t.files || []).slice()), rm: Object.fromEntries(paths.map(p => [p, J((bb.removed || {})[p])])) };
}
function put(st, o, made) {
  const bb = b();
  st.files = o.files.slice(); st.gone = o.gone.slice(); st.layout = J(o.layout);
  if (o.forder) st.forder = o.forder.slice(); else delete st.forder;
  if (o.inc) st.inc = J(o.inc); else delete st.inc;
  ((st.grade && st.grade.tries) || []).forEach((t, i) => { if (o.tries[i]) t.files = o.tries[i].slice(); });
  bb.removed ||= {};
  for (const [p, r] of Object.entries(o.rm)) if (r) bb.removed[p] = r; else delete bb.removed[p];
  // undone: the new file waits under Removed files (it is kept, so it mustn't come back by itself when the download opens again)
  if (made && !st.files.includes(made) && !st.gone.includes(made)) { st.gone.push(made); bb.removed[made.path] = { t: Date.now() }; }
  tell();
}
// steps: when given, the undo step goes there instead (Convert to PDF makes one step of many files).
export async function replaceFile(st, path, file, steps) {
  const old = D.fileByPath(st, path); if (!old) return null;
  await M.saveNowDone();
  K.commitEditors();
  const before = snap(st, [path]);
  // where the old file sat, so the new one goes in the same place
  const at = st.layout ? st.layout.findIndex(d => d.pages.some(([q]) => q === path)) : -1, oi = st.forder ? st.forder.indexOf('f:' + path) : -1;
  const [nf] = await addFiles(st, [{ path: file.name, file }]); if (!nf) return null;
  if (at >= 0) { const k = st.layout.findIndex(d => d.file === nf.path); if (k >= 0) { const [d] = st.layout.splice(k, 1); st.layout.splice(Math.min(at, st.layout.length), 0, d); } }
  if (oi >= 0) st.forder.splice(oi, 0, 'f:' + nf.path);
  if (st.inc && st.inc[path] != null) st.inc[nf.path] = st.inc[path];
  for (const t of (st.grade && st.grade.tries) || []) if ((t.files || []).includes(path)) t.files.push(nf.path);   // an earlier try's paper stays that try's
  F.goneNow(st, old);
  (b().removed ||= {})[path] = { t: Date.now(), by: nf.path };
  const after = snap(st, [path, nf.path]), i = () => b().students.indexOf(st);
  const back = () => put(st, before, nf), again = () => put(st, after);
  if (steps) steps.push({ back, again, st, nf });
  else step(() => { back(); show(i(), path); }, () => { again(); show(i(), nf.path); }, 'replaced ' + F.fileShown(st, old.name));
  tell(); show(i(), nf.path);
  return nf;
}
// What the Replace box shows of the two files: pages and marks on the old one, pages on the new one.
export async function about(st, path, file) {
  const old = D.fileByPath(st, path); let np = 0;
  if (/\.pdf$/i.test(file.name)) try { const pdfjs = await libs(), d = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; np = d.numPages; d.destroy(); } catch {}
  return { oldName: F.fileShown(st, old.name), oldPages: old.numPages || 0, marks: F.markCount(old), newName: file.name, newPages: np };
}
export const shown = (st, name) => F.fileShown(st, name);
// The tag on a file she added, or one that replaced another (addTag): who it came from and when.
export function tagOf(st, f) {
  if (!f.added) return null;
  const bb = b(), p = bb.removed && Object.keys(bb.removed).find(k => bb.removed[k].by === f.path && !bb.removed[k].back);
  const was = p ? ((st.gone || []).find(g => g.path === p) || { name: p.slice(p.lastIndexOf('/') + 1) }) : null;
  return { replaced: was ? F.fileShown(st, was.name) : null, word: !!was && F.madeFromWord(f), from: f.from || null, t: f.added };
}
export const undo = () => M && M.undo();

// Leave out: the file stays with the student but off the screen and out of what goes back; Bring back undoes it (setDocIn).
export function setIn(st, d, on) { const was = D.docIn(st, d); F.setDocIn(st, d, on); step(() => { F.setDocIn(st, d, was); tell(); show(b().students.indexOf(st)); }, () => { F.setDocIn(st, d, on); tell(); show(b().students.indexOf(st)); }, on ? 'brought back' : 'left out'); tell(); show(b().students.indexOf(st)); }

// Move to…: a file that belongs to someone else goes to the right student with her marks on it (src/app/files.js moveFile). Her score,
// comment and status may be about this file or another the student keeps, so ask(said, others) says whether they go too; what is
// already on the other student is never written over. Returns what to tell her: { name, to, took, kept }.
export async function moveFile(st, path, dst, ask) {
  const bb = b(), f0 = D.fileByPath(st, path);
  if (!f0 || st === dst || dst.files.some(f => f.path === path)) return { already: dst.files.some(f => f.path === path) };
  await M.saveNowDone();   // boxes highlighted a moment ago count
  const Wd = await import('../../engines/gword.js');
  const before = [st, dst].map(s => [s, { files: s.files.slice(), layout: J(s.layout), inc: J(s.inc), forder: s.forder ? s.forder.slice() : null, grade: J(s.grade) }]), moved0 = J(bb.moved);
  // a scored Word rubric that was in the wrong folder takes its score with it, if there's room for it there
  const ws = Wd.wordScore(f0), carried = !!ws && ws.total != null && Wd.ownGrade(st).total === ws.total && !Wd.hasOwnScore(dst) && !noScore(dst);
  if (carried) { st.grade.points = ''; st.grade.rubric.forEach((_, k) => K.touchGrade(st, k)); st.grade.rubric = []; K.touchGrade(st); }
  const said = F.gradeWords(st), others = st.files.filter(x => !x.virtual && x !== f0).length, clash = said.length > 0 && F.gradeHasWork(dst.grade);
  const take = said.length > 0 && !clash && await ask(F.wordsJoin(said), said.length, others);
  const L0 = D.layoutOf(st), m = F.moveFileNow(path, dst.key);
  if (!m) return {};
  const { f } = m;
  if (take) {   // answers about what's written on the papers stay with both, since she may keep another paper
    const g = st.grade;
    dst.grade = g; st.grade = { rubric: [], points: '', comment: '', ...(g.reads ? { reads: { ...g.reads } } : {}) };
    K.touchGrade(st);
    // her Word rubric copy holds the score as highlights; left behind it would give the score straight back, so the two copies change places
    const c = st.files.find(x => x.virtual && x.kind === 'docx'), c2 = dst.files.find(x => x.virtual && x.kind === 'docx');
    if (c && c.edited) for (const [x, to] of [[c, dst], [c2, st]]) if (x && F.moveFileNow(x.path, to.key)) (bb.moved ||= {})[x.path] = to.key;
  }
  if (carried && !f0.virtual) (dst.grade.reads ||= {})[Wd.readKey(Wd.wordTableRead(f0))] = 1;
  if (st.layout || L0.some(d => d.pages.some(([q]) => q !== path) && d.pages.some(([q]) => q === path))) {
    st.layout = L0.map(d => ({ ...d, pages: d.pages.filter(([q]) => q !== path) })).filter(d => d.pages.length);
    if (!st.layout.length) st.layout = null;
  }
  if (dst.layout && D.viewable(f) && f.numPages) dst.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
  if (st.inc && st.inc[path] != null) { (dst.inc ||= {})[path] = st.inc[path]; delete st.inc[path]; }
  if (st.forder) st.forder = st.forder.filter(x => x !== 'f:' + path);
  for (const lm of [bb.lightPg, bb.lightPgL]) if (lm) for (const k of Object.keys(lm)) if (k.startsWith(st.key + '|' + path + '|')) { lm[dst.key + k.slice(st.key.length)] = lm[k]; delete lm[k]; }
  (bb.moved ||= {})[path] = dst.key;
  const after = [st, dst].map(s => [s, { files: s.files.slice(), layout: J(s.layout), inc: J(s.inc), forder: s.forder ? s.forder.slice() : null, grade: J(s.grade) }]), moved1 = J(bb.moved);
  const putAll = (list, mv) => { for (const [s, o] of list) { s.files = o.files.slice(); s.layout = J(o.layout); if (o.inc) s.inc = J(o.inc); else delete s.inc; if (o.forder) s.forder = o.forder.slice(); else delete s.forder; s.grade = J(o.grade); } if (mv) bb.moved = J(mv); else delete bb.moved; tell(); show(bb.students.indexOf(st)); };
  step(() => putAll(before, moved0), () => putAll(after, moved1), 'moved ' + F.fileShown(st, f.name));
  state().refound(st); state().refound(dst);
  if ([st, dst].some(s => s.files.some(x => x.kind === 'docx'))) await (await PARTS.word()).scoresAll(M);
  tell(); show(bb.students.indexOf(st));
  return { name: F.fileShown(st, f.name), took: take ? F.wordsJoin(said) : '', kept: clash ? F.wordsJoin(said) : '' };
}

// Convert to PDF (src/wordpdf.js): a student's Word file drawn as pages she can mark anywhere, put in the Word file's place the way Replace
// does; the Word file waits under Removed files with Bring back and never changes. Her rubric copy and a group copy stay Word files.
export const canPdf = f => !!f && f.kind === 'docx' && !f.virtual && !f.rubric && !f.from && !!f.data;
export async function pdfLists(st0, f0) {
  const Wd = await import('../../engines/gword.js'), bb = b();
  const used = (st, f) => Wd.wordFound(f, st).some(g => (st.grade.reads || {})[Wd.readKey(g)] === 1);
  const shared = (st, f) => bb.students.some(s => s !== st && s.files.some(x => x.from === st.key && x.name === f.name));
  // the ones that can go without asking: nothing of hers is on the Word file yet, and she hasn't brought it back from a conversion
  const free = ({ st, f }) => !f.edited && !f.hand && !used(st, f) && !((bb.removed || {})[f.path] || {}).back && !shared(st, f);
  const all = bb.students.flatMap(st => st.files.filter(canPdf).map(f => ({ st, f }))), ok = all.filter(free);
  return { all, free: ok, used: st0 ? used(st0, f0) : false, others: ok.filter(x => x.f !== f0).length, kept: all.length - ok.length - (st0 && free({ st: st0, f: f0 }) ? 0 : 1) };
}
let pdfBusy = false;
export const pdfBusyNow = () => pdfBusy;
// Converts these one after another; each(i) says how far it is. One undo step for all of them. Returns { done, long, bad }.
export async function toPdf(list, each = () => {}) {
  if (pdfBusy || !b()) return null;
  const bb = b(), steps = [], O = await PARTS.outEngine(); let long = 0, bad = 0;
  await O.load();
  // a page that can't be written as words is drawn as a picture instead, as the current app does
  if (!state().html2canvas) try { const h = await PARTS.h2c(); use({ html2canvas: h.default || h }); } catch (e) { console.error(e); }
  pdfBusy = true;
  try {
    await M.saveNowDone();   // what she typed a moment ago is in the file first
    for (const [i, { st, f }] of list.entries()) {
      if (b() !== bb) break;
      if (!st.files.includes(f)) continue;
      each(i);
      try {
        const bytes = await O.X.wordPagesPdf(f);
        const nf = await replaceFile(st, f.path, new File([bytes], f.name.replace(D.WORD_RX, '') + '.pdf', { type: 'application/pdf' }), steps);
        if (!nf) bad++;
      } catch (e) { if (/too long/.test(String(e && e.message))) long++; else { console.error(e); bad++; } }
    }
  } finally { pdfBusy = false; }
  if (steps.length) {
    const here = () => { const st = bb.students[state().cur]; show(state().cur, (steps.find(s => s.st === st) || {}).nf?.path); };
    step(() => { for (const s of steps.slice().reverse()) s.back(); tell(); here(); }, () => { for (const s of steps) s.again(); tell(); here(); }, 'converted to PDF');
    if ([...new Set(steps.map(s => s.st))].some(st => st.files.some(x => x.kind === 'docx'))) await (await PARTS.word()).scoresAll(M);
  }
  return { done: steps.length, long, bad };
}

// Turning pages a quarter turn (src/app/paper.js turnPages): the marks turn with the page, each page is one undo step as in the
// current app, and the page is read again for notes and grades (rescanFile).
export async function turnPages(f, list, dir) {
  if (!f || !D.viewable(f)) return;
  K.commitEditors();
  if (!list) list = [...Array(f.numPages || 0).keys()];
  const { pages, docMap } = state(), steps = [];
  for (const p of list) {
    const pg = pages.find(q => q.file === f && q.idx === p);
    let W = pg && pg.W, H = pg && pg.H;
    if (!pg && docMap.get(f.path)) { try { const vp = D.vpRot(f, p, await docMap.get(f.path).getPage(p + 1), 1); W = vp.width; H = vp.height; } catch {} }
    steps.push(K.stepOf(f, p, true));
    if (W && f.marks[p] && f.marks[p].length) K.turnMarks(f.marks[p], W, H, dir);
    K.setRot(f, p, D.rotOf(f, p) + 90 * dir);
  }
  for (const u of steps) K.pushUndo(u);   // undo turns them back one page at a time
  use({ selected: null }); K.thumbCache.clear();
  tell(); show(-1);
  rescan(f);
}
// A paper's Turn all pages: every page of it, file by file (data-rotdoc).
export async function turnDoc(st, d) {
  const by = new Map(); for (const [path, p] of d.pages) { if (!by.has(path)) by.set(path, []); by.get(path).push(p); }
  for (const [path, list] of by) await turnPages(D.fileByPath(st, path), list, 1);
}
// rescanFile: Kami notes and typed grades found again on the turned page.
async function rescan(f) {
  const bb = b(), st = bb && bb.students.find(s => s.files.includes(f)); if (!st || !D.viewable(f)) return;
  const X = (await PARTS.outEngine()).X;
  try { f.scan = await X.scanFile(f, f.hand || state().setup.spot || null); if (f.hand) f.scan.hand = true; f.kami = f.scan.kami; } catch (e) { console.error(e); return; }
  state().refound(st); state().renderList(); state().gradeShown(st);
  for (const pg of state().pages) if (pg.file === f) { pg.extra = (f.kami && f.kami[pg.idx] && f.kami[pg.idx].notes) || []; D.draw(pg); }
}
