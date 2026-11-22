// A student's files changed on the marking screen, as the current app changes them (src/app/kept.js addFiles, src/app/replace.js
// removeFile, bringBack, replaceFile and replaceDo): a file added to a student, one taken off (it waits under Removed files with its
// marks, for Bring back), and one put in another's place. What each does to the student's files, pages and the download's removed
// list is the current app's; a file she added is kept in this browser through students/write.js keepAdded. Each change is one
// step on the one undo list. Loaded as a part of its own (router.js PARTS.change).
// Not here yet: a group's shared paper and a partner's video changing with it (sameCopies) comes with group work.
import { state, noScore, use, tryGrade, roundPct, maxPoints } from '../../engines/gcore.js';
import * as D from '../../engines/gdraw.js';
import * as E from '../../engines/gopen.js';
import * as F from '../../engines/gfiles.js';
import * as K from '../../engines/gmark.js';
import * as V from '../../engines/gmedia.js';
import * as G from '../../engines/ggroup.js';
import { set as setState } from '../../engines/gcore.js';
import { PARTS } from '../router.js';
import { libs } from './paper.js';
import { prefs } from '../../students/prefs.js';
import { heicSay } from './heic.js';

const prefsGet = k => !!prefs.get(k, false);

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
  // a photo becomes a PDF page (makeFile, pictureToPdf), which needs pdf-lib
  if (!state().PDFLib && list.some(e => /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif)$/i.test(e.path))) use({ PDFLib: await PARTS.pdflib() });
  heicSay(list.map(e => e.path));
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
  // the paper opens again so the added files show at once (they showed only after another student was opened)
  tell(); if (made.length) show(-1);
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
// What the Replace box shows of the two files: pages and marks on the old one, pages on the new one. A video link put in a link's
// place says what each is instead: a video file, from Google Drive, or the address itself (askReplace about).
const vidSay = bytes => (V.vidRef(bytes) ? { k: 'file' } : V.drvRef(bytes) ? { k: 'drive' } : { k: 'addr', s: (u => u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) + (u.length > 56 ? '…' : ''))(V.linkOf(bytes) || '') });
export async function about(st, path, file) {
  const old = D.fileByPath(st, path); let np = 0;
  const link = old.kind === 'link' && /\.(url|webloc)$/i.test(file.name);
  if (link) return { link, oldName: V.linkTitle(old), oldSay: vidSay(old.data), newName: V.linkTitle(old), newSay: vidSay(new Uint8Array(await file.arrayBuffer())), marks: 0 };
  if (/\.pdf$/i.test(file.name)) try { const pdfjs = await libs(), d = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; np = d.numPages; d.destroy(); } catch {}
  return { oldName: F.fileShown(st, old.name), oldPages: old.numPages || 0, marks: F.markCount(old), newName: file.name, newPages: np };
}
// The same file on other students, which changes with this one: partners sharing a video link, or the copies of a group's paper
// (src/app/replace.js sameCopies). [[student, their file]]
const groupOfSt = st => (b().groups || []).find(g => g.k.includes(st.key)) || null;
export function sameCopies(st, f) {
  const g = groupOfSt(st), mates = G.groupMates(st);
  if (f.kind === 'link') { const k = V.linkKey(f); return mates.map(s => [s, s.files.find(x => x.kind === 'link' && V.linkKey(x) === k)]).filter(([, x]) => x); }
  if (g && g.p && g.p[st.key] === f.path) return mates.map(s => [s, E.groupFileOf(g, s)]).filter(([, x]) => x);
  return [];
}
export const groupPaperOf = (st, f) => { const g = groupOfSt(st); return !!(g && g.p && g.p[st.key] === f.path); };
export const namesOf = list => G.groupNames(list);
// The new link, a video file (kept in this browser where the current app keeps them) or a video picked in Drive, as the file that
// takes a video link's place, named as the old link (openReplace named, vkPut, drvBytes).
export function linkFile(old, url) { return new File([V.linkBytes(url)], V.linkTitle(old) + '.url'); }
export function driveVideoFile(old, d) { return new File([drvBytes(d)], V.linkTitle(old) + '.url'); }
export async function videoFile(old, file) {
  const W = await PARTS.write(); let id = null;
  try { id = await W.keepVideo(file); } catch (e) { if (e && e.name !== 'NotThere') throw e; }
  return id ? new File([V.vidBytes(id, file.name, file.size)], V.linkTitle(old) + '.url') : new File([file], V.linkTitle(old) + '.' + V.extOf(file.name), { type: file.type });
}
// One replace, with the partners' copies when also is set (a group's shared paper always changes for everyone): one undo step puts
// every file, the group's paper and the clips back as they were (replaceDo). Returns { nf, who: the partners it changed for }.
export async function replaceDo(st, path, file, also) {
  const old = D.fileByPath(st, path); if (!old) return null;
  const copies = also || groupPaperOf(st, old) ? sameCopies(st, old) : [];
  if (!copies.length) { const nf = await replaceFile(st, path, file); return nf ? { nf, who: [] } : null; }
  const bb = b(), oldKey = old.kind === 'link' ? V.linkKey(old) : '', gc0 = [J(bb.groups || null), J(bb.clips || null)], steps = [];
  const was = [[st, path], ...copies.map(([s, f]) => [s, f.path])];
  for (const [s, p] of was) await replaceFile(s, p, s === st ? file : new File([file], file.name, { type: file.type }), steps);
  if (!steps.length) return null;
  const nf = steps[0].nf, g = groupOfSt(st);
  if (g && g.p) for (const x of steps) { const w = was.find(([s]) => s === x.st); if (w && g.p[x.st.key] === w[1]) g.p[x.st.key] = x.nf.path; }
  if (bb.clips) {
    const left = oldKey && bb.students.some(s => s.files.some(f => f.kind === 'link' && V.linkKey(f) === oldKey));
    for (const c of bb.clips) { if (oldKey && !left && c.u === oldKey && nf.kind === 'link') c.u = V.linkKey(nf); if (c.p === path) c.p = nf.path; }
  }
  G.groupSync();
  const gc1 = [J(bb.groups || null), J(bb.clips || null)], i = () => bb.students.indexOf(st);
  const gc = ([g, c]) => { if (g) bb.groups = J(g); else delete bb.groups; if (c) bb.clips = J(c); else delete bb.clips; G.groupSync(); };
  step(() => { for (const x of steps.slice().reverse()) x.back(); gc(gc0); tell(); show(i(), path); }, () => { for (const x of steps) x.again(); gc(gc1); tell(); show(i(), nf.path); }, 'replaced ' + F.fileShown(st, old.name));
  tell(); show(i(), nf.path);
  return { nf, who: steps.slice(1).map(x => x.st) };
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
export const redo = () => M && M.redo();
// Typed notes (mark/typed.jsx): a student's grade changed by the notes, saved and shown; a setting of the assignment's setup changed as
// one undo step, after() run each way (the setup kept and the bar drawn again).
// Clips to show the class (mark/clips.jsx): fn changes batch.clips, as one undo step.
export function clipsChange(fn) { K.fieldSnap(b(), ['clips'], () => tell(), 'clips'); fn(b()); tell(); }
export function touched(st) { K.touchGrade(st); tell(); }
export function setupStep(keys, fn, after) { K.fieldSnap(state().setup, keys, () => { after(); tell(); }, 'setup'); fn(); after(); tell(); }

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
  // a page that can't be written as words is drawn as a picture instead, as the current app does (and mammoth reads a Word file
  // the app's own reader can't open)
  try { await O.wordTools(); } catch (e) { console.error(e); }
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

// Pasted text (src/pastetext.js pasteTextAdd): the text becomes a PDF added to the student like any added file. Text the PDF's own font
// can write is real text; anything else is a picture of each page, so marks still work.
export const pasteClean = s => F.pasteClean(s);
export async function pasteAdd(st, title, text) {
  if (!F.pasteClean(text)) return null;
  await (await PARTS.outEngine()).load();
  const name = F.pasteName(title) + '.pdf', { bytes, typed } = await F.pasteTextPdf(title, text);
  await addFiles(st, [{ path: name, file: new File([bytes], name, { type: 'application/pdf' }) }]);
  return { name, typed };
}

// Mark late (intake.js markLate): nothing is taken off; each is one step on the undo list.
export function markLate(list) { for (const st of list) if (st.grade.status !== 'late') { K.gradeSnap(st); K.setStatus(st, 'late'); } tell(); }
// A file flagged new or changed since the older copy of this download (carryover.js): Looks fine takes the flag off.
export function carryOk(path) { const c = b().carry; if (!c || !c.flags[path]) return; const was = c.flags[path]; delete c.flags[path]; step(() => { c.flags[path] = was; tell(); show(-1); }, () => { delete c.flags[path]; tell(); show(-1); }, 'looks fine'); tell(); show(-1); }

// Arrange pages (src/app/arrange.js openArrange): the student's papers as files of pages, with the pages taken out waiting in a tray,
// and the order of whole files when Word or other files sit among them. What the dialog changes stays in it until Save.
export function arrangeStart(st) {
  const L = D.layoutOf(st).map(d => ({ name: d.name, file: d.file, pages: d.pages.map(x => x.slice()), out: D.docAuto(st, d) ? null : !D.docIn(st, d) }));
  const strip = D.fileSeq(st).map(it => it.f ? 'f:' + it.f.path : L[it.di]);
  return { L, tray: F.outPages(st).map(x => x.slice()), strip, lp: { ...(b().lightPg || {}) }, lit: D.lightLive(st), many: st.files.filter(D.viewable).length > 1 };
}
// Back to how it was turned in (data-reset): the paper as the files came, and the files in their own order.
export function arrangeReset(st) {
  const L = D.defaultLayout(st).map(d => ({ ...d, pages: d.pages.map(x => x.slice()), out: null }));
  const keep = st.forder; st.forder = null;
  const strip = D.fileSeq(st).map(it => it.f ? 'f:' + it.f.path : L[it.di]); st.forder = keep;
  return { L, strip };
}
// The strip of whole files, with files of pages that came or went since it was drawn (drawStrip).
export const stripNow = (L, strip) => { const s = strip.filter(x => typeof x === 'string' || L.includes(x)); for (const d of L) if (!s.includes(d)) s.push(d); return s; };
// Save (data-save): one undo step puts every student's pages and file order, and the page lighting, back as they were. Pages turned in
// the dialog are turned after, each a step of its own, as in the current app. Returns how many students got the same order.
export async function arrangeSave(st, { L, strip, everyone, lp, turns }) {
  K.commitEditors();
  const bb = b(), was = { lp: J(bb.lightPg), s: bb.students.map(o => ({ layout: J(o.layout), forder: J(o.forder) })) };
  strip = stripNow(L, strip);
  const inStrip = strip.filter(x => typeof x !== 'string' && x.pages.length);
  L = inStrip.concat(L.filter(d => !inStrip.includes(d) && d.pages.length));
  const ord = strip.filter(x => typeof x === 'string' || L.includes(x)).map(x => typeof x === 'string' ? x : 'd' + L.indexOf(x));
  L = L.filter(d => d.pages.length).map(d => ({ name: (d.name.trim() || 'File').replace(/(\.pdf)?$/i, '.pdf'), file: d.file, pages: d.pages, out: d.out }));
  const def = D.defaultLayout(st);
  const same = L.length === def.length && L.every((d, k) => d.file === def[k].file && d.name === def[k].name && JSON.stringify(d.pages) === JSON.stringify(def[k].pages) && d.out == null);
  st.layout = same ? null : L.map(d => ({ ...d, out: d.out == null ? undefined : d.out }));
  if (st.layout) for (const d of st.layout) if (d.out === undefined) delete d.out;
  const plain = D.fileSeq({ ...st, forder: null }).map(it => it.id);
  st.forder = JSON.stringify(ord) === JSON.stringify(plain) ? null : ord;
  let n = 0;
  if (everyone) {   // line the others up the same way, matching files by kind
    const tmpl = D.fileSeq(st).map(it => D.seqSig(st, it));
    for (const o of bb.students) {
      if (o === st) continue;
      const used = new Set(), sq = D.fileSeq({ ...o, forder: null });
      const at = it => { const sig = D.seqSig(o, it); for (let k = 0; k < tmpl.length; k++) if (tmpl[k] === sig && !used.has(k)) { used.add(k); return k; } return tmpl.length; };
      const ranked = sq.map((it, k) => [at(it), k, it]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(x => x[2].id);
      o.forder = JSON.stringify(ranked) === JSON.stringify(sq.map(it => it.id)) ? null : ranked; n++;
    }
  }
  bb.lightPg = lp;
  const now = { lp: J(bb.lightPg), s: bb.students.map(o => ({ layout: J(o.layout), forder: J(o.forder) })) };
  const put = v => { bb.lightPg = J(v.lp); bb.students.forEach((o, k) => { o.layout = J(v.s[k].layout); o.forder = J(v.s[k].forder); }); tell(); show(-1); };
  step(() => put(was), () => put(now), 'arranged pages');
  tell(); show(-1);
  for (const [key, q] of [...(turns || new Map())].filter(([, x]) => x)) {
    const i = key.lastIndexOf('|'), f = D.fileByPath(st, key.slice(0, i));
    for (let k = 0; k < q; k++) await turnPages(f, [+key.slice(i + 1)], 1);
  }
  return everyone ? n + 1 : 0;
}
// The × on a page (takePageOut): the page leaves the paper and the export, and waits in Arrange pages' tray. One undo step.
export function takePageOut(st, path, p) {
  K.commitEditors();
  const was = J(st.layout);
  const now = J(D.layoutOf(st)).map(d => ({ ...d, pages: d.pages.filter(([q, k]) => !(q === path && k === p)) })).filter(d => d.pages.length);
  const put = v => { st.layout = J(v); tell(); show(-1); };
  step(() => put(was), () => put(now), 'page taken out');
  put(now);
}
// Bring back a page taken out (bringPageBack): among the same file's pages in page order, or a file of its own if none are left.
export function bringPageBack(st, path, p) {
  const f = D.fileByPath(st, path); if (!f || !st.layout) return;
  K.commitEditors();
  const was = J(st.layout), L = J(st.layout), su = state().setup;
  let d = L.find(x => x.file === path) || L.find(x => x.pages.some(([q]) => q === path));
  if (!d && f.virtual && L.length) d = L[su.rubricPos === 'start' ? 0 : L.length - 1];
  if (!d) L.push({ name: f.name, file: path, pages: [[path, p]] });
  else {
    const k = d.pages.findIndex(([q, n]) => q === path && n > p), last = d.pages.map(([q]) => q).lastIndexOf(path);
    d.pages.splice(k >= 0 ? k : last >= 0 ? last + 1 : (f.virtual && su.rubricPos === 'start' ? 0 : d.pages.length), 0, [path, p]);
  }
  const def = D.defaultLayout(st);
  const now = L.length === def.length && L.every((x, k) => x.file === def[k].file && x.name === def[k].name && x.out == null && JSON.stringify(x.pages) === JSON.stringify(def[k].pages)) ? null : L;
  const put = v => { st.layout = J(v); tell(); show(-1); };
  step(() => put(was), () => put(now), 'page brought back');
  put(now);
}
export const outPages = st => F.outPages(st);

// Marks from other apps (src/imported.js): pen, highlights, typed text and comments a PDF came in with (Kami, Acrobat, Preview), made
// into her own marks (impConvert), or put back as the file had them (impPutBack). The file she was sent is never changed. As in the
// current app these are not undo steps: Put back is the way back, and the file's earlier undo steps go, since they would bring back
// marks that no longer match what's drawn (impForgetUndo).
export const impCount = f => F.impCount(f);
function impForget(f) {
  const { undoStack: u, redoStack: r } = state();
  for (const s of [u, r]) { const keep = s.filter(x => x.file !== f); s.splice(0, s.length, ...keep); }
  if (state().selected && state().selected.page && state().selected.page.file === f) use({ selected: null });
}
export async function impMake(f, read) {
  await libs(); await (await PARTS.outEngine()).load();
  const r = read || await F.impRead(f);
  if (!r.n) return { n: 0, keep: r.keep, locked: r.locked };
  f.imp ||= {};
  for (const [p, list] of Object.entries(r.pages)) { const marks = (f.marks[p] ||= []); for (const it of list) { marks.push(...it.marks); (f.imp[p] ||= []).push(it.id); } }
  delete f.impNo;
  f.impNew = { n: r.n, keep: r.keep };
  impForget(f); tell();
  return { n: r.n, keep: r.keep };
}
export function impBack(f) {
  for (const p of Object.keys(f.marks)) f.marks[p] = f.marks[p].filter(m => !m.imp);
  delete f.imp; delete f.view; delete f.viewOf; delete f.viewKey; delete f.impNew;
  f.impNo = 1;
  impForget(f); tell();
}
export function impNo(f) { f.impNo = 1; tell(); }
// After a change (impAfter): read again (a grade in a comment is hers now) and draw again.
export async function impAfter(f, again = true) {
  K.thumbCache.clear();
  await rescan(f);
  if (state().gradeMarksChanged) state().gradeMarksChanged(f);
  tell(); if (again) show(-1);
}
// Every paper's marks from other apps, read for the dialog (openImported). each(i, n): progress.
export async function impReadAll(each, live) {
  await libs(); await (await PARTS.outEngine()).load();
  const files = b().students.flatMap(st => st.files.filter(f => f.kind === 'pdf' && !f.virtual && !f.bad && !f.impNo)), reads = new Map(), kinds = {};
  let total = 0, keep = 0;
  for (let i = 0; i < files.length; i++) {
    if (!live()) return null;
    each(i, files.length);
    let r; try { r = await F.impRead(files[i]); } catch (e) { console.error(e); continue; }
    if (!r.n) continue;
    reads.set(files[i], r); total += r.n; keep += r.keep;
    for (const [k, v] of Object.entries(r.kinds)) kinds[k] = (kinds[k] || 0) + v;
  }
  return { reads, total, keep, kinds };
}
export async function impMakeAll(reads, each) {
  let n = 0, i = 0, bad = 0;
  for (const [f, r] of reads) { each(++i, reads.size); try { n += (await impMake(f, r)).n; K.thumbCache.clear(); await rescan(f); } catch (e) { console.error(e); bad++; } }
  tell(); show(-1);
  return { n, bad };
}
// As a paper opens, when she asked for it (impAuto).
export async function impAuto(f) {
  if (!prefsGet('gs.impAuto') || f.impNo || f.virtual || f.kind !== 'pdf' || !F.impCount(f)) return false;
  const r = await impMake(f); if (!r.n) return false;
  K.thumbCache.clear(); await rescan(f); tell();
  return true;
}
export const gsFlat = (f, doc) => F.gsFlatCheck(f, doc);
// For the other file tools (mark/light.jsx): the download changed (saved soon), and the paper opened again.
export const changed = () => tell();
export const reopen = (i = -1) => show(i);

// Scanned pages (src/scans.js): the strip above a page and its choices (scanNote and its clicks), the ⚑ flag for a rescan (scanFlag),
// the list of pages waiting on one (scanRescans), and what the scan split decided, taken as the papers open (scanHintsAll). The turn
// and the straightening are the current app's own scanTurn and scanStraighten (lifted), each one undo step.
export function scanFlag(pg) {
  const f = pg.file; if (f.virtual) return null;
  K.fieldSnap(f, ['sc'], () => { tell(); show(-1); }, 'rescan flag');
  const r = (f.sc ||= {})[pg.idx] ||= { later: 1 };
  if (r.re) delete r.re; else r.re = 1;
  tell(); show(-1);
  return !!r.re;
}
const lits = rec => b().students.flatMap(s => s.files.flatMap(f => Object.values(f.sc || {}))).filter(r => r.lit && r !== rec);
export function scanAct(pg, a) {
  const f = pg.file, p = pg.idx, r = f.sc && f.sc[p]; if (!r) return;
  const off = r.off ||= {};
  K.commitEditors();
  if (a === 'back') { if (r.didTurn && D.rotOf(f, p) === r.didTurn) { off.turn = 1; F.scanTurn(pg, (360 - r.didTurn) % 360); } if (D.skewOf(f, p)) { off.skew = 1; F.scanStraighten(pg, 0); } }
  else if (a === 'done') off.done = 1;
  else if (a === 'turn') F.scanTurn(pg, r.turn);
  else if (a === 'left') F.scanTurn(pg, 270);
  else if (a === 'right') F.scanTurn(pg, 90);
  else if (a === 'skew') F.scanStraighten(pg, r.skew);
  else if (a === 'unskew') { off.skew = 1; F.scanStraighten(pg, 0); }
  else if (a === 'light') F.scanLight(pg, r);
  else if (a === 'unlit') { off.faint = 1; F.scanLightBack(r); }
  else if (a === 'unre') { K.fieldSnap(f, ['sc'], () => { tell(); show(-1); }, 'rescan flag'); delete f.sc[p].re; }
  else if (a === 'lit') { delete r.lit; off.faint = 1; for (const o of lits(r)) o.lit.on = true; }   // she wants Lighting on now, whichever page goes back
  else off[a.slice(2)] = 1;   // noturn, noskew, noblank, nofaint
  K.thumbCache.clear();
  tell(); show(-1);
}
export const rescans = () => F.scanRescans();
// The split hands over what goes with the download once it opens: { id, wide (the whole scan's lighting), cls (the class she picked) },
// or StartNotes its videos and partners (pv: { groups, own }, D-022).
let fromSplit = null;
export const afterSplit = p => { fromSplit = p; };
export function takeSplit() {
  const bb = b(); if (!bb || !fromSplit || fromSplit.id !== bb.id) return false;
  const { wide, cls, lit, pv } = fromSplit; fromSplit = null;
  if (pv) partnersApply(pv.groups, pv.own).catch(e => console.error(e));
  if (wide) { bb.light = { ...(bb.light || {}), '*': { ...wide } }; bb.lightOpt = { ...D.lightOpts(), on: true }; }
  F.scanHintsAll();
  if (cls != null && cls !== '') bb.classId = cls;
  if (wide || lit) state().lightPagesChanged();
  tell(); show(-1);
  return true;
}

// Video and audio papers (src/app/media.js, src/video.js): the time in the comment, a video turned for one filmed sideways, a
// transcript put on or taken off (partners with the same video share it), and a notes page added beside a video. Each one undo step.
export function addStamp(st, t) {
  K.gradeSnap(st);
  const tag = '[' + V.fmtTime(t) + '] ';
  st.grade.comment = (st.grade.comment && !/\s$/.test(st.grade.comment) ? st.grade.comment + '\n' : st.grade.comment || '') + tag;
  K.touchGrade(st);
  tell();
}
export function vidTurn(f) {
  const bb = b(), k = V.vrotKey(f), d = (V.vrotOf(f) + 90) % 360;
  K.fieldSnap(bb, ['vrot'], () => tell(), 'video turn');
  bb.vrot ||= {}; if (d) bb.vrot[k] = d; else delete bb.vrot[k];
  if (!Object.keys(bb.vrot).length) delete bb.vrot;
  tell();
}
const trSame = f => { const same = f.kind === 'link' && b() ? b().students.flatMap(s => s.files).filter(x => x.kind === 'link' && V.linkKey(x) === V.linkKey(f)) : []; return same.includes(f) ? same : same.concat(f); };
export function trSet(f, tr) {
  const all = trSame(f), was = all.map(x => x.tr);
  const put = list => { all.forEach((x, i) => { if (list[i]) x.tr = list[i]; else delete x.tr; }); tell(); };
  step(() => put(was), () => put(all.map(() => tr)), tr ? 'transcript' : 'transcript taken off');
  put(all.map(() => tr));
}
// A recording's transcript made in this browser (transcribeFile): bytes, the recording itself. The screen is kept awake while it is
// made, so a long one doesn't stop when the laptop sleeps (src/app/media.js wakeLock; H-074).
export async function trMake(f, bytes, say, stop) {
  let lock = null; try { lock = await navigator.wakeLock.request('screen'); } catch {}
  let w; try { w = await V.transcribe(bytes, say, stop); } finally { try { if (lock) lock.release(); } catch {} }
  if (stop && stop.on) return false;
  trSet(f, { w });
  return true;
}
export async function notesAdd(st, kind, name) {
  const rows = V.npRows(state().setup), PDFLib = await PARTS.pdflib(); use({ PDFLib });
  const bytes = await V.notesPdf(kind, b().name, rows), file = V.npFileName(name) + '.pdf';
  return addFiles(st, [{ path: file, file: new File([bytes], file, { type: 'application/pdf' }) }]);
}
// Add, A video… (openAddVideo, videoAdd): a link, or a video file kept in this browser, and a notes page if she wants one. A video
// already there (the same link however it was written) isn't added twice. A browser where the current app has never kept a video has
// no store for one yet (the new app doesn't make the current app's databases), so the file is added to the student as it is.
// A video picked in Drive, as the shortcut the current app writes (src/video.js drvBytes): only the link and its name and size.
const drvBytes = d => new TextEncoder().encode('[InternetShortcut]\r\nURL=https://drive.google.com/file/d/' + d.id + '/view\r\nGsDrive=' + d.id + '\r\nName=' + String(d.name || '').replace(/[\r\n]+/g, ' ').slice(0, 120) + '\r\nSize=' + (d.size || 0) + '\r\n');
export async function videoAdd(st, o) {
  const had = V.sameVideo(st, o), list = [];
  if (!had) {
    if (o.file) {
      const W = await PARTS.write();
      let id = null; try { id = await W.keepVideo(o.file); } catch (e) { if (e && e.name !== 'NotThere') throw e; }
      if (id) list.push({ path: o.name + '.url', file: new File([V.vidBytes(id, o.file.name, o.file.size)], o.name + '.url') });
      else list.push({ path: o.name + '.' + V.extOf(o.file.name), file: new File([o.file], o.name + '.' + V.extOf(o.file.name), { type: o.file.type }) });
    } else if (o.drive) list.push({ path: o.name + '.url', file: new File([drvBytes(o.drive)], o.name + '.url') });
    else list.push({ path: o.name + '.url', file: new File([V.linkBytes(o.url)], o.name + '.url') });
  }
  if (o.kind) {
    const PDFLib = await PARTS.pdflib(); use({ PDFLib });
    const n = V.npFileName(o.name.replace(/\s*video$/i, '') + ' notes') + '.pdf';
    list.push({ path: n, file: new File([await V.notesPdf(o.kind, b().name, V.npRows(state().setup))], n, { type: 'application/pdf' }) });
  }
  const made = list.length ? await addFiles(st, list) : [];
  return { had, made };
}

// Group work (src/groups.js): partners put together on one paper, a partner graded on their own, the way the group is graded, and a
// scan's shared pages made one group. Each is one undo step that puts back the groups, the partners' grades and the shared marks
// whole (the current app asks first before some of these; here they happen at once, with Undo).
function groupKeep(sts) {
  const bb = b(), groups = J(bb.groups || null), grades = sts.map(s => [s, J(s.grade)]), files = sts.flatMap(s => s.files);
  const uniq = [...new Set(files.map(f => f.marks).filter(Boolean))], marks = uniq.map(J), fm = files.map(f => [f, f.marks ? uniq.indexOf(f.marks) : -1]);
  return () => {
    if (groups) bb.groups = J(groups); else delete bb.groups;
    for (const [st, g] of grades) st.grade = J(g);
    const fresh = marks.map(J); for (const [f, i] of fm) { if (i >= 0) f.marks = fresh[i]; else delete f.marks; }
  };
}
const groupWho = (...sts) => [...new Set(sts.flatMap(st => [st, ...G.groupMates(st), ...G.splitMates(st).map(o => o.s)]).filter(Boolean))];
function groupDo(sts, fn, what) {
  const back = groupKeep(sts); fn(); const after = groupKeep(sts);
  const done = () => { K.thumbCache.clear(); tell(); show(-1); };
  step(() => { back(); done(); }, () => { after(); done(); }, what);
  done();
}
// mode: 0 one grade for everyone, 2 a group score adjusted for one partner, 1 own scores with the notes shared
export function groupMode(st, mode) { groupDo(groupWho(st), () => G.groupSetOwn(st, mode), 'group'); }
export function groupOut(st) { groupDo(groupWho(st), () => G.groupLeave(st, true), 'group'); }
export function groupJoinSplit(st) { groupDo(groupWho(st), () => G.groupFromSplit(st), 'group'); }
// Both, or Just them: what is done now goes to every partner, or only to this one (their comment is always their own)
export function groupJustSet(key) { setState.groupJust(key); tell(); }
export const groupJustNow = () => state().groupJust;
// Group work… on a file: the partner gets their own copy of it (and of the group's video), and, marked once, joins the group.
const copyOf = (st, f, to) => to.files.find(x => x.from === st.key && x.name === f.name);
export async function groupGive(st, f, to, once, own) {
  if (!copyOf(st, f, to)) await addFiles(to, [{ path: f.name, file: new File([f.data], f.name), from: st.key }]);
  if (once) for (const lf of st.files.filter(x => x.kind === 'link')) if (!to.files.some(x => x.kind === 'link' && V.linkKey(x) === V.linkKey(lf))) await addFiles(to, [{ path: lf.name, file: new File([lf.data], lf.name), from: st.key }]);
  if (once) groupDo(groupWho(st, to), () => { G.groupAdd(st, f, to, copyOf(st, f, to)); if (own) G.groupSetOwn(st, true); }, 'group');
  else tell();
}
// Setup > Partners and videos… (src/video.js openPartners, pvApply): for each group, the video added to the one it belongs to, the
// partners given their own copies (a notes page they have is used), and then every group made at once, one undo step.
// groups: [{ k: [keys, the first is the one whose video and paper the group shares], url, file }]. own: partners get their own scores.
const fileOfGroup = st => { const g = (b().groups || []).find(x => x.k.includes(st.key)), p = g && g.p && g.p[st.key]; return p ? st.files.find(f => f.path === p) || null : null; };
async function partnerCopy(st, f, to) {
  if (f.kind === 'link') { const have = to.files.find(x => x.kind === 'link' && V.linkKey(x) === V.linkKey(f)); if (have) return have; }
  const have = copyOf(st, f, to); if (have) return have;
  return (await addFiles(to, [{ path: f.name, file: new File([f.data], f.name), from: st.key }]))[0] || null;
}
export async function partnersApply(groups, own) {
  const bb = b(), stOf = k => bb.students.find(s => s.key === k), joins = [];
  for (const g of groups) {
    const all = g.k.map(stOf).filter(Boolean); if (!all.length) continue;
    let st = all[0];
    if (!g.url && !g.file && !g.drive && !(V.notesFileOf(st) || G.groupPaper(st))) st = all.find(s => V.notesFileOf(s) || G.groupPaper(s)) || st;
    const partners = all.filter(s => s !== st && !G.groupMates(st).includes(s));
    if (g.url || g.file || g.drive) await videoAdd(st, { url: g.url, file: g.file, drive: g.drive || null, name: 'Presentation video', kind: '' });
    const links = st.files.filter(f => f.kind === 'link');
    const anchor = fileOfGroup(st) || V.notesFileOf(st) || G.groupPaper(st) || links[0] || st.files.find(f => f.kind === 'media');
    if (!anchor) continue;
    const pairs = [];
    for (const to of partners) {
      for (const f of links) if (f !== anchor) await partnerCopy(st, f, to);
      const theirs = anchor.kind === 'media' ? null : (V.isNotes(anchor.data) && !anchor.added && V.notesFileOf(to)) || await partnerCopy(st, anchor, to);
      pairs.push([to, theirs]);
    }
    joins.push({ st, anchor, pairs });
  }
  const sts = joins.flatMap(j => [j.st, ...j.pairs.map(p => p[0])]);
  if (sts.length) groupDo(groupWho(...sts), () => { for (const j of joins) { for (const [to, theirs] of j.pairs) G.groupAdd(j.st, j.anchor, to, theirs); if (own && j.pairs.length) G.groupSetOwn(j.st, true); } G.groupSync(); }, 'group');
  else tell();
  return groups.length;
}
// The switch Mark and grade once for the group: on, everyone with a copy joins; off, everyone is graded on their own again.
export function groupOnce(st, f, on, own) {
  const has = G.shareCopies(st, f);
  groupDo(groupWho(st, ...has), () => {
    if (on) { for (const s of has) G.groupAdd(st, f, s, copyOf(st, f, s)); if (own && G.groupMates(st).length) G.groupSetOwn(st, true); }
    else for (const s of G.groupMates(st)) G.groupLeave(s, true);
  }, 'group');
}

// Rubric setup's Save (src/app/dialogs.js openSetup), as one undo step: the setup, the whole score's goal, and every score that sits on
// a row by its place (rowsTakenOut: when a row goes, the scores after it move up with their rows, each keeping its time). page: the new
// rubric file { bytes, name }, null when it comes off, undefined when it stays. from: where each draft row came from (null: new), n0:
// how many rows there were. Her rubric file is kept under a new id before the step; the one before stays, so Undo can bring it back.
export async function setupSave(draft, { page, from, n0, goal }) {
  const s = state(), bb = b(), W = await PARTS.write();
  const J0 = { setup: J(s.setup), goal: bb ? bb.goal : undefined, g: bb ? bb.students.map(st => J({ rubric: st.grade.rubric, atR: st.grade.atR })) : [] };
  const d = J(draft);
  if (page === null) d.rubricPage = null;
  else if (page) {
    const id = Math.random().toString(36).slice(2, 10);
    let bin = ''; for (let i = 0; i < page.bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, page.bytes.subarray(i, i + 0x8000));
    W.keepRubricPage(id, btoa(bin));   // throws CannotSave('room'): nothing has changed yet
    d.rubricPage = { id, name: page.name };
  }
  const gone = [...Array(n0).keys()].filter(i => !from.includes(i));
  const pageChanged = JSON.stringify(d.rubricPage) !== JSON.stringify(s.setup.rubricPage) || d.rubricPos !== s.setup.rubricPos;
  const apply = async (su, gl, grades) => {
    use({ setup: su });
    if (bb) {
      if (gl) bb.goal = gl; else delete bb.goal;
      bb.students.forEach((st, k) => { if (grades) { st.grade.rubric = J(grades[k].rubric) || []; if (grades[k].atR) st.grade.atR = J(grades[k].atR); else delete st.grade.atR; K.touchGrade(st); } });
      if (pageChanged) { await libs(); await E.applyRubricPage(); }
      bb.students.forEach(st => s.refound(st));
    }
    await M.keepSetup();
    tell(); if (bb) show(state().cur);
  };
  // the scores that move up when rows go, as rowsTakenOut moves them
  let after = null;
  if (bb && gone.length) {
    const low = gone[0], left = k => k - gone.filter(x => k > x).length;
    after = bb.students.map(st => {
      const g = st.grade, keys = Object.keys(g.atR || {}).filter(k => k !== 'points').map(Number);
      if (g.rubric.length <= low && !keys.some(k => k >= low)) return { rubric: g.rubric, atR: g.atR };
      return { rubric: Array.from(g.rubric, v => (v == null ? null : v)).filter((_, k) => !gone.includes(k)), atR: g.atR ? Object.fromEntries(keys.filter(k => !gone.includes(k)).map(k => [left(k), g.atR[k]]).concat(g.atR.points ? [['points', g.atR.points]] : [])) : undefined };
    });
  }
  const goalNow = goal === undefined ? J0.goal : goal;
  await apply(d, goalNow, after);
  step(() => apply(J(J0.setup), J0.goal, J0.g), () => apply(J(d), goalNow, after), 'setup');
  return d;
}

// An IB MYP class's task (src/ib.js ibTaskApply): its rows become the criteria ticked, in the class's order, each scored 0 to 8. Levels
// given for a criterion that stays are kept, with what each level means and its goal; the rest go (the current app asks first; here
// it goes at once, one undo step, with Undo). Before, a task scored as a total loses that total.
export async function ibTaskApply(c, keys, S) {
  const s = state(), bb = b(), su0 = s.setup, crit = S.ibCrit(c).filter(x => keys.includes(x.k));
  if (!crit.length || !bb) return false;
  const had = !!(su0.mode === 'rubric' && Array.isArray(su0.ib) && su0.ib.some(Boolean)), old = had ? su0.ib : [], from = crit.map(x => old.indexOf(x.k));
  const pick = a => (Array.isArray(a) ? from.map(i => (i >= 0 && a[i] != null ? a[i] : null)) : null);
  const su = { ...J(su0), mode: 'rubric', criteria: crit.map((x, n) => (from[n] >= 0 ? su0.criteria[from[n]] : x.k + ' ' + x.name)), ib: crit.map(x => x.k), top: S.IB_TOP, half: false, scale: null };
  delete su.tops;
  const lv = pick(su0.levels), gl = pick(su0.goals);
  if (lv && lv.some(Boolean)) su.levels = lv.map(x => x || []); else delete su.levels;
  if (gl && gl.some(Boolean)) su.goals = gl.map(x => x || ''); else delete su.goals;
  const keep = st => J({ rubric: st.grade.rubric, atR: st.grade.atR, points: st.grade.points, qAuto: st.grade.qAuto });
  const before = bb.students.map(keep), now = Date.now();
  const after = bb.students.map(st => {
    const g = st.grade, r = g.rubric || [], at = g.atR || {}, nat = {};
    from.forEach((i, n) => { nat[n] = i >= 0 && at[i] ? at[i] : now; }); if (at.points) nat.points = now;
    return { rubric: from.map(i => (i >= 0 && r[i] != null ? r[i] : null)), atR: nat, points: had ? g.points : '', qAuto: had ? g.qAuto : undefined };
  });
  const apply = async (setup, grades) => {
    use({ setup });
    bb.students.forEach((st, k) => { const x = grades[k]; st.grade.rubric = J(x.rubric) || []; if (x.atR) st.grade.atR = J(x.atR); else delete st.grade.atR; st.grade.points = x.points ?? ''; if (x.qAuto != null) st.grade.qAuto = x.qAuto; else delete st.grade.qAuto; K.touchGrade(st); s.refound(st); });
    await M.keepSetup(true);   // and to the linked copies with no rubric yet
    tell(); show(state().cur);
  };
  await apply(su, after);
  step(() => apply(J(su0), before), () => apply(J(su), after), 'setup');
  return true;
}

/* Anchor papers (src/anchors.js): the high, middle and low paper a school keeps from a summative. One paper each: tagging a second
   paper High takes High off the first, and one undo step puts both back. Stored on the paper's grade as grade.anchor. */
export const ANCHOR_LV = ['high', 'mid', 'low'];
// Shown on summatives, the teacher's own counted types and assignments with no type; not on in-class, formative or extra-credit work (anchorsHere).
export function anchorsHere() { const a = b().assignment, f = a && E.findItem(a.id), ty = ((f && f.it) || a || {}).type || ''; return ty !== 'ic' && ty !== 'fm' && ty !== 'xc'; }
export const anchorOf = lv => b().students.findIndex(s => s.grade.anchor === lv);
export function setAnchor(st, lv) {
  const others = b().students.filter(s => s !== st && s.grade.anchor === lv);
  K.pushUndo(K.groupStep([K.gradeStep(st), ...others.map(K.gradeStep)], 'anchor paper'));
  if (st.grade.anchor === lv) delete st.grade.anchor;
  else { for (const s of others) { delete s.grade.anchor; K.touchGrade(s); } st.grade.anchor = lv; }
  K.touchGrade(st); tell();
  return st.grade.anchor || '';
}

/* The ⋯ under the score (src/grades.js): leave out of the average, extra credit, a percent as the score, and retakes. Each one undo step. */
// Left out of the average: the score stays and still copies (setOutAvg).
export function outAvg(st) { K.gradeSnap(st); if (st.grade.outAvg) delete st.grade.outAvg; else st.grade.outAvg = true; K.touchGrade(st); tell(); }
// Extra credit (xcSet): half points on top of the score, or percentage points with xcU 'pct'. u: the unit showing, for a new one.
export function setXc(st, raw, u) {
  const v = raw === '' || raw == null || isNaN(+raw) ? 0 : Math.max(0, Math.round(+raw * 2) / 2);
  if ((+st.grade.xc || 0) === v) return;
  K.gradeSnap(st);
  if (v) { if (!(+st.grade.xc > 0)) { if (u === 'pct') st.grade.xcU = 'pct'; else delete st.grade.xcU; } st.grade.xc = v; }
  else { delete st.grade.xc; delete st.grade.xcU; }
  K.touchGrade(st); tell();
}
// Points or %: the number stays, what it means changes (xcUnitSet); the unit picked is kept on this computer for the next paper.
export function setXcUnit(st, u) {
  prefs.set('gs.xcU', u);
  if (st.grade.xc) { K.gradeSnap(st); if (u === 'pct') st.grade.xcU = 'pct'; else delete st.grade.xcU; K.touchGrade(st); }
  tell();
}
export const xcUnitNow = () => (prefs.get('gs.xcU', 'pts') === 'pct' ? 'pct' : 'pts');
// A percent as the score (pctSet): "73", "73%" or nothing; whole percents, halves up. It stays the score; rubric rows don't change it.
export function setPk(st, raw) {
  const s = String(raw == null ? '' : raw).replace('%', '').replace(',', '.').trim(), v = s === '' || isNaN(+s) || +s < 0 ? null : roundPct(+s);
  if (s !== '' && v == null) return false;
  if (v === (st.grade.pk == null ? null : st.grade.pk)) return true;
  K.gradeSnap(st);
  if (v == null) delete st.grade.pk; else st.grade.pk = v;
  K.scoreTouched(st); tell();
  return true;
}
// Retakes (retakeStart, retakeOff): a second try keeps the first, its score, comment and papers; which try counts is retakeRule.
const TRY_KEEP = ['rubric', 'points', 'pk', 'sheet', 'xc', 'xcU', 'q', 'qAuto', 'qAutoL', 'comment'];
function triesStep(st, fn, what) {
  const was = J(st.grade); fn(); const now = J(st.grade), i = b().students.indexOf(st);
  const put = g => { st.grade = J(g); K.touchGrade(st); if (st.found !== undefined) state().refound(st); tell(); show(i); };
  step(() => put(was), () => put(now), what);
  K.touchGrade(st); if (st.found !== undefined) state().refound(st); tell(); show(i);
}
// Returns null when the paper has no full score yet (nothing to keep), else the try kept.
export function retakeStart(st) {
  const g = st.grade, r = tryGrade(st);
  if (noScore(st) || r.pct == null || !r.done || r.partial) return null;
  const was = { t: Date.now(), total: r.total, max: r.outOf != null ? r.outOf : maxPoints(), pct: r.pct };
  if (g.status === 'late') was.late = 1;
  for (const k of TRY_KEEP) if (g[k] != null && g[k] !== '' && !(Array.isArray(g[k]) && !g[k].length)) was[k] = J(g[k]);
  // the papers here now were the earlier try's; a file a newer download brought ("New in this download") is taken to be the retake itself
  const bb = b(), tryOf = f => { const ts = g.tries; if (!ts || !ts.length) return 0; const k = ts.findIndex(x => (x.files || []).includes(f.path)); return k < 0 ? 0 : k + 1; };
  was.files = st.files.filter(f => !tryOf(f) && !(bb.carry && bb.carry.flags && bb.carry.flags[f.path] === 'new') && (!f.virtual || (f.kind === 'docx' && (f.edited || (f.wscore && f.wscore.total != null))))).map(f => f.path);
  triesStep(st, () => {
    (g.tries ||= []).push(was);
    g.rubric = []; g.points = ''; g.comment = '';
    for (const k of ['pk', 'sheet', 'xc', 'xcU', 'q', 'qAuto', 'qAutoL', 'atR']) delete g[k];
    if (g.status === 'late') g.status = '';
  }, 'retake');
  return was;
}
// Taken off at once: the try before it is the score again, and Undo brings the retake back (the current app asks with a second click).
export function retakeOff(st) {
  const g = st.grade, ts = g.tries; if (!ts || !ts.length) return;
  triesStep(st, () => {
    const was = ts.pop(); if (!ts.length) delete g.tries;
    g.rubric = []; g.points = ''; g.comment = '';
    for (const k of ['pk', 'sheet', 'xc', 'xcU', 'q', 'qAuto', 'qAutoL', 'atR']) delete g[k];
    for (const k of TRY_KEEP) if (was[k] != null) g[k] = was[k];
    if (was.late && !g.status) g.status = 'late';
  }, 'retake off');
}
// Which try counts, for every class and assignment (retakeRuleSet): kept on the library (lib.book.retake), one undo step.
export async function retakeRuleSet(k) {
  const L = state().lib, was = (L.book && L.book.retake) || null, W = await PARTS.write();
  const put = async v => { L.book = { ...(L.book || {}) }; if (v) L.book.retake = v; else delete L.book.retake; await W.saveLibrary(l => { l.book = { ...(l.book || {}) }; if (v) l.book.retake = v; else delete l.book.retake; }); tell(); show(state().cur); };
  await put(k);
  step(() => put(was), () => put(k), 'retake rule');
}

/* Quick mark (src/quiz.js): a paper quiz marked answer by answer. Each mark, comment, moved mark or lined-up page is one undo step for
   the papers it touched and the quiz's own spots and shifts; Give the rest is one step for all of them. Saving the boxes is one step
   too: the quiz, the score out of its points (a rubric download changes to points at once, with Undo, where the current app asks
   first), and every paper's marks redrawn for the boxes as they are now. */
const quickKeep = sts => {
  const bb = b(), q = J(bb.quiz), su = J(state().setup), gs = sts.map(st => [st, J(st.grade), st.files.map(f => [f, J(f.marks)])]);
  return () => { if (q) bb.quiz = J(q); else delete bb.quiz; use({ setup: J(su) }); for (const [st, g, fs] of gs) { st.grade = J(g); for (const [f, m] of fs) { if (m) f.marks = J(m); else delete f.marks; } } };
};
// fn changes the papers of sts (async). after: what the screen redraws once the step is done or taken back.
export async function quickDo(sts, fn, after) {
  const back = quickKeep(sts); await fn(); const again = quickKeep(sts);
  const done = () => { K.thumbCache.clear(); tell(); if (after) after(); };
  step(() => { back(); done(); }, () => { again(); done(); }, 'marks');
  done();
}
// Q: the quiz as the boxes editor left it. Z: the lifted quiz engine (engines/gquiz.js). S: engines/gsetup.js, for an MYP class.
// Returns what changed about the score: 'points' (it is out of the quiz's points now), 'rubric' (and rubric scores stopped counting).
export async function quickBoxesSave(Q, ansBack, Z, S) {
  const s = state(), bb = b(), all = bb.students, back = quickKeep(all), su0 = s.setup;
  let say = '';
  bb.quiz = Q;
  const max = Z.quizMax(), c = S.ibTaskClass();
  if (max && c) {
    for (const q of Q.qs) q.ib = Z.ibQzOf(q, c);
    const used = Z.ibQzUsed(Q, c), now = su0.mode === 'rubric' && Array.isArray(su0.ib) ? su0.ib.filter(Boolean) : [];
    if (!used.every(k => now.includes(k))) await ibTaskApply(c, [...now, ...used], S);   // its own step, before this one
  } else if (max && !(su0.mode === 'points' && +su0.outOf === max)) {
    say = su0.mode === 'rubric' && all.some(st => (st.grade.rubric || []).some(v => v != null)) ? 'rubric' : 'points';
    use({ setup: { ...J(su0), mode: 'points', outOf: max } });
    all.forEach(st => s.refound(st));
  }
  Z.qzDropGone(new Set(Q.qs.map(q => q.id)));
  if (ansBack) for (const st of all) for (const f of st.files) for (const l of Object.values(f.marks || {})) for (const m of l) if (Z.qzMoved(m)) { delete m.qzm; m.qzp = [m.ax, m.ay]; }
  Z.qzForget();
  for (const st of all) if (st.grade.q && Object.keys(st.grade.q).length) { await Z.qzRedoPaper(st); Z.quizScore(st); }
  const again = quickKeep(all);
  const done = async () => { K.thumbCache.clear(); await M.keepSetup(); Z.qzForget(); tell(); show(state().cur); };
  step(async () => { back(); await done(); }, async () => { again(); await done(); }, 'setup');
  await done();
  return say;
}
