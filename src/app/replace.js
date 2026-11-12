/* ---------------- remove or replace any file on a student's paper ---------------- */
// Nothing is thrown away: a removed file leaves the paper and the export, and waits in st.gone with its marks for Bring back.
// batch.removed = { path: { t, by } } keeps it off when the download opens again; by is the file that replaced it. Bring back leaves { back: t }, so a merge can tell.
const markCount = f => Object.values(f.marks || {}).reduce((n, a) => n + a.length, 0);
const replacedOf = f => { const st = batch && batch.students[cur]; if (!st || !batch.removed) return null; const p = Object.keys(batch.removed).find(k => batch.removed[k].by === f.path && !batch.removed[k].back); return p ? ((st.gone || []).find(g => g.path === p) || { name: p.slice(p.lastIndexOf('/') + 1) }) : null; };
const removeLink = (f, css) => '<button class="link" style="font-size:13px;' + (css || '') + '" data-rmfile="' + esc(f.path) + '" title="Take this file off this student. It waits at the bottom of the paper, with Bring back.">Remove</button>';
const replaceLink = f => '<button class="link" style="font-size:13px;margin-right:10px" data-rplfile="' + esc(f.path) + '" title="Put a different file in its place, like a rescan or a corrected copy">Replace…</button>';
const fileLinks = f => f.virtual || f.rubric ? '' : replaceLink(f) + removeLink(f);
function goneNow(st, f) {
  if (!f) return;
  st.files.splice(st.files.indexOf(f), 1); (st.gone ||= []).push(f);
  if (st.layout) { st.layout = st.layout.map(d => ({ ...d, pages: d.pages.filter(([q]) => q !== f.path) })).filter(d => d.pages.length); if (!st.layout.length) st.layout = null; }
  if (st.forder) st.forder = st.forder.filter(x => x !== 'f:' + f.path);
}
async function removeFile(st, path, quiet) {
  const f = fileByPath(st, path); if (!f) return;
  await Promise.all([...wordSaves].map(s => s()));   // boxes highlighted a moment ago count
  const n = markCount(f), nm = fileShown(st, f.name);
  if (n && !quiet && !await askDlg('Remove ' + nm + '?\n\nYou have ' + n + (n === 1 ? ' mark' : ' marks') + ' on it. The file and its marks leave this paper and the export. Bring back, at the bottom of the paper, puts both back.', { ok: 'Remove', danger: true })) return;
  commitEditors();
  const L0 = st.layout && JSON.parse(JSON.stringify(st.layout)), o0 = st.forder && st.forder.slice();
  goneNow(st, f);
  (batch.removed ||= {})[path] = { t: Date.now() };
  refound(st); wordScoresAll(); saveNow(); renderList(); openStudent(cur);
  if (!quiet) toastDo('Removed ' + nm, 'Undo', () => bringBack(st, path, { L: L0, o: o0 }));
}
async function bringBack(st, path, was) {
  const f = (st.gone || []).find(g => g.path === path); if (!f) return;
  st.gone.splice(st.gone.indexOf(f), 1); st.files.push(f);
  if (was && was.L !== undefined) { st.layout = was.L; st.forder = was.o; }
  else if (st.layout && viewable(f) && f.numPages) st.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
  if (batch.removed && batch.removed[path]) batch.removed[path] = { back: Date.now() };
  refound(st); wordScoresAll(); saveNow(); renderList(); openStudent(cur, path);
  toast('Brought back ' + fileShown(st, f.name));
}
function pickReplace(st, path) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.onchange = () => { if (inp.files[0]) askReplace(st, path, inp.files[0]); };
  inp.click();
}
async function askReplace(st, path, file) {
  const old = fileByPath(st, path); if (!old) return;
  const n = markCount(old), pg = k => k ? k + (k === 1 ? ' page' : ' pages') : '';
  let np = 0;
  if (/\.pdf$/i.test(file.name)) try { await workerReady; const d = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; np = d.numPages; d.destroy(); } catch {}
  const card = (name, said) => '<div style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px;min-width:0"><b style="overflow-wrap:anywhere">' + esc(name) + '</b><div class="muted">' + said + '</div></div>';
  openDlg('<div class="bh"><h2>Replace this file?</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:0 0 12px">' +
      card(fileShown(st, old.name), [pg(old.numPages), n ? n + (n === 1 ? ' mark' : ' marks') : 'no marks'].filter(Boolean).join(' · ')) + '<span class="muted">→</span>' + card(file.name, [pg(np), 'new'].filter(Boolean).join(' · ')) + '</div>' +
    '<p style="margin:0">The new file takes the old one’s place on the paper and in the export. ' + (n ? 'Marks can’t move onto different pages, so the old file keeps its ' + n + (n === 1 ? ' mark' : ' marks') + '. It waits under Removed files, so you can bring it back.' : 'The old file waits under Removed files, so you can bring it back.') + '</p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Replace</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    closeDlg();
    await replaceFile(st, path, file);
  };
}
async function replaceFile(st, path, file, quiet) {
  const old = fileByPath(st, path); if (!old) return;
  commitEditors();
  // where the old file sat, so the new one goes in the same place
  const at = st.layout ? st.layout.findIndex(d => d.pages.some(([q]) => q === path)) : -1, oi = st.forder ? st.forder.indexOf('f:' + path) : -1;
  const had = new Set(st.files);
  await addFiles(st, [{ path: file.name, file }], true);
  const nf = st.files.find(f => !had.has(f)); if (!nf) return;
  if (at >= 0) { const k = st.layout.findIndex(d => d.file === nf.path); if (k >= 0) { const [d] = st.layout.splice(k, 1); st.layout.splice(Math.min(at, st.layout.length), 0, d); } }
  if (oi >= 0) st.forder.splice(oi, 0, 'f:' + nf.path);
  if (st.inc && st.inc[path] != null) st.inc[nf.path] = st.inc[path];
  goneNow(st, old);
  (batch.removed ||= {})[path] = { t: Date.now(), by: nf.path };
  refound(st); wordScoresAll(); saveNow(); renderList();
  if (quiet) return nf;   // a Word paper made into PDF pages (wordpdf.js) says so itself
  openStudent(cur, nf.path);
  toast('Replaced ' + fileShown(st, old.name) + ' with ' + nf.name);
  return nf;
}
// Pages taken out of the paper (here with × or in Arrange pages): every page of a file on the paper that isn't in the layout.
function outPages(st) {
  if (!st.layout) return [];
  const has = new Set(st.layout.flatMap(d => d.pages.map(([q, p]) => q + '|' + p))), out = [];
  for (const f of st.files) if (viewable(f) && f.numPages) for (let p = 0; p < f.numPages; p++) if (!has.has(f.path + '|' + p)) out.push([f.path, p]);
  return out;
}
function takePageOut(st, path, p) {
  commitEditors();
  const L0 = JSON.parse(JSON.stringify(layoutOf(st))), was = st.layout && JSON.parse(JSON.stringify(st.layout));
  st.layout = L0.map(d => ({ ...d, pages: d.pages.filter(([q, n]) => !(q === path && n === p)) })).filter(d => d.pages.length);
  const f = fileByPath(st, path);
  saveNow(); renderList(); openStudent(cur);
  toastDo('Took out ' + fileShown(st, (f || { name: path }).name) + ', page ' + (p + 1), 'Undo', () => { st.layout = was; saveNow(); renderList(); openStudent(cur, path); });
}
// Back where it was: among the same file's pages in page order, or as a file of its own if none of them are left.
function bringPageBack(st, path, p) {
  const f = fileByPath(st, path); if (!f || !st.layout) return;
  let d = st.layout.find(x => x.file === path) || st.layout.find(x => x.pages.some(([q]) => q === path));
  if (!d && f.virtual && st.layout.length) d = st.layout[setup.rubricPos === 'start' ? 0 : st.layout.length - 1];
  if (!d) { st.layout.push({ name: f.name, file: path, pages: [[path, p]] }); }
  else {
    const k = d.pages.findIndex(([q, n]) => q === path && n > p), last = d.pages.map(([q]) => q).lastIndexOf(path);
    d.pages.splice(k >= 0 ? k : last >= 0 ? last + 1 : (f.virtual && setup.rubricPos === 'start' ? 0 : d.pages.length), 0, [path, p]);
  }
  const def = defaultLayout(st);
  if (st.layout.length === def.length && st.layout.every((x, k) => x.file === def[k].file && x.name === def[k].name && x.out == null && JSON.stringify(x.pages) === JSON.stringify(def[k].pages))) st.layout = null;
  saveNow(); renderList(); openStudent(cur, path);
  toast('Brought back ' + fileShown(st, f.name) + ', page ' + (p + 1));
}
function goneList(st) {
  const op = outPages(st);
  if ((!st.gone || !st.gone.length) && !op.length) return;
  const el = document.createElement('div'); el.className = 'gonelist';
  el.innerHTML = '<b>' + (op.length ? (st.gone && st.gone.length ? 'Removed files and pages' : 'Removed pages') : 'Removed files') + '</b>' +
    op.map(([path, p]) => { const f = fileByPath(st, path), n = ((f.marks || {})[p] || []).length;
      return '<div class="gonerow"><span>' + [esc(fileShown(st, f.name)) + ', page ' + (p + 1), f.virtual ? 'your rubric page' : '', n ? n + (n === 1 ? ' mark' : ' marks') : ''].filter(Boolean).join(' · ') + '</span><span style="flex:1"></span><button class="link" style="font-size:13px" data-backpg="' + op.findIndex(x => x[0] === path) + '|' + p + '">Bring back</button></div>'; }).join('') +
    (st.gone || []).map(f => { const r = (batch.removed || {})[f.path] || {}, n = markCount(f);
    return '<div class="gonerow"><span>' + [esc(fileShown(st, f.name)), f.numPages ? f.numPages + (f.numPages === 1 ? ' page' : ' pages') : '', n ? n + (n === 1 ? ' mark' : ' marks') : '', r.t ? (r.by ? (madeFromWord(fileByPath(st, r.by)) ? 'now PDF pages, ' : 'replaced ') : 'removed ') + fmtDay(r.t) : ''].filter(Boolean).join(' · ') + '</span><span style="flex:1"></span><button class="link" style="font-size:13px" data-backfile="' + esc(f.path) + '">Bring back</button></div>'; }).join('');
  $('#paper').appendChild(el);
}
// A short note with one button, like Undo. It stays a little longer than a plain one.
function toastDo(msg, label, fn) {
  const t = $('.toast');
  toast(msg, 6000);
  const b = document.createElement('button'); b.className = 'tact'; b.textContent = label;
  b.onclick = () => { t.hidden = true; t.textContent = ''; fn(); };
  t.append(' ', b);
}
function refound(st) {
  const fs = st.files.filter(f => !tryOfFile(st, f));   // a grade written on an earlier try's paper belongs to that try
  const all = fs.filter(f => f.kind !== 'docx' && fileIn(st, f)).flatMap(f => (f.scan && f.scan.found) || []).concat(fs.flatMap(f => wordFound(f, st)));
  // Doubtful readings wait for her OK and don't count until then, and while one is waiting nothing beside it stands either. The same words she's already said yes to, written twice on a page, are one answer.
  const r = splitReads(st, all), rd = st.grade.reads || {}, ok = r.ok.filter(g => !r.mine.includes(g)).filter((g, n, a) => rd[readKey(g)] !== 1 || a.findIndex(o => readKey(o) === readKey(g)) === n);
  st.foundCount = ok.length; st.doubts = r.ask; st.foundAll = ok;
  st.found = ok.length === 1 && !rivalReads(st).length ? { ...ok[0], found: true } : null;
}

