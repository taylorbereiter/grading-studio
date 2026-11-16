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
  if (!quiet) pushUndo(actStep(() => bringBack(st, path, { L: L0, o: o0 }), () => removeFile(st, path, true), 'removed ' + nm));
  if (!quiet) toastDo('Removed ' + nm, 'Undo', () => bringBack(st, path, { L: L0, o: o0 }));
}
// After undo or redo: the student it happened to, on screen.
function toStudent(st, path) { const i = batch.students.indexOf(st); renderList(); if (i >= 0) openStudent(i, path); }
async function bringBack(st, path, was) {
  const f = (st.gone || []).find(g => g.path === path); if (!f) return;
  if (!stepping) pushUndo(actStep(() => removeFile(st, path, true), () => bringBack(st, path), 'brought back ' + fileShown(st, f.name)));
  st.gone.splice(st.gone.indexOf(f), 1); st.files.push(f);
  if (was && was.L !== undefined) { st.layout = was.L; st.forder = was.o; }
  else if (st.layout && viewable(f) && f.numPages) st.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
  if (batch.removed && batch.removed[path]) batch.removed[path] = { back: Date.now() };
  refound(st); wordScoresAll(); saveNow(); renderList(); openStudent(cur, path);
  toast('Brought back ' + fileShown(st, f.name));
}
// Replace… : a file from this computer goes straight to the check below. With Google Drive set up, or for a video link, she first picks where the new one comes from.
function pickReplace(st, path) {
  const old = fileByPath(st, path); if (!old) return;
  if (old.kind === 'link' || driveCan()) return openReplace(st, path);
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.onchange = () => { if (inp.files[0]) askReplace(st, path, inp.files[0]); };
  inp.click();
}
// The same file on other students, which changes with this one: partners sharing a video link, or the copies of a group's paper. [[student, their file]]
function sameCopies(st, f) {
  const g = groupOf(st), mates = groupMates(st);
  if (f.kind === 'link') { const k = linkKey(f); return mates.map(s => [s, s.files.find(x => x.kind === 'link' && linkKey(x) === k)]).filter(([, x]) => x); }
  if (g && g.p && g.p[st.key] === f.path) return mates.map(s => [s, groupFileOf(g, s)]).filter(([, x]) => x);
  return [];
}
const groupPaperOf = (st, f) => { const g = groupOf(st); return !!(g && g.p && g.p[st.key] === f.path); };
function openReplace(st, path) {
  const old = fileByPath(st, path); if (!old) return;
  const link = old.kind === 'link', nm = link ? linkTitle(old) : fileShown(st, old.name);
  const go = file => file && askReplace(st, path, file);
  const named = bytes => new File([bytes], linkTitle(old) + '.url');
  openDlg('<div class="bh"><h2>Replace ' + esc(nm) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb vdbox">' + (link
      ? '<label class="vdlab" for="rpLink">A new link</label><div style="display:flex;gap:8px"><input class="btn" id="rpLink" placeholder="' + VID_HINT + '" aria-label="New link" autocomplete="off" spellcheck="false" style="flex:1"><button class="btn primary" id="rpLinkGo" disabled>Next</button></div>' +
        '<div class="vdlab">Or</div><div class="vdfile"><button class="btn" data-rpsrc="vfile">A video file…</button>' + (driveCan() ? '<button class="btn" data-rpsrc="vdrive">Google Drive…</button>' : '') + '</div>'
      : '<div class="vdfile"><button class="btn" data-rpsrc="file">From this computer…</button>' + (driveCan() ? '<button class="btn" data-rpsrc="drive">From Google Drive…</button>' : '') + '<span class="muted" style="font-size:13px">or drop the new file here</span></div>') +
    '<p class="muted vdsay">' + (link ? 'Partners with the same video get the new one too, unless you say not on the next step.' : 'You check the two files side by side before anything changes.') + '</p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button></div>', true);
  const box = $('#dlgBox'), inp = $('#rpLink');
  if (inp) { inp.oninput = () => { const ok = !!linkClean(inp.value.trim()); $('#rpLinkGo').disabled = !ok; inp.classList.toggle('bad', !!inp.value.trim() && !ok); }; inp.onkeydown = e => { if (e.key === 'Enter' && !$('#rpLinkGo').disabled) $('#rpLinkGo').click(); }; inp.focus(); }
  box.ondragover = e => { if (!link) e.preventDefault(); };
  box.ondrop = e => { if (link) return; e.preventDefault(); go(e.dataTransfer.files[0]); };
  box.onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.id === 'rpLinkGo') return go(named(linkBytes(linkClean(inp.value.trim()))));
    const b = e.target.closest('[data-rpsrc]'); if (!b) return;
    const k = b.dataset.rpsrc;
    try {
      if (k === 'file') { const i = document.createElement('input'); i.type = 'file'; i.onchange = () => go(i.files[0]); i.click(); return; }
      if (k === 'vfile') { const f = await vidPick(); if (!f) return; if (!MEDIA_RX.test(f.name) && !/^(video|audio)\//.test(f.type)) return toast('That isn’t a video or sound file'); return go(named(vidBytes(await vkPut(f), f.name, f.size))); }
      if (k === 'vdrive') { const [d] = await driveVideos(false); return d && go(named(drvBytes(d))); }
      if (k === 'drive') {
        const [d] = await drivePick({ mimes: paperMimes(), title: 'Choose the new file' }); if (!d) return;
        const gdoc = /^application\/vnd\.google-apps\./.test(d.mime);
        b.disabled = true; b.textContent = 'Getting it from Drive…';
        const r = await gfetch(gdoc ? 'files/' + encodeURIComponent(d.id) + '/export?mimeType=application/pdf' : 'files/' + encodeURIComponent(d.id) + '?alt=media&supportsAllDrives=true', {}, true, 'pick');
        return go(new File([await r.arrayBuffer()], d.name + (gdoc ? '.pdf' : ''), { type: gdoc ? 'application/pdf' : d.mime }));
      }
    } catch (err) { console.error(err); sayDlg(link ? drvSay(err) : (err && err.message) || String(err)); }
  };
}
async function askReplace(st, path, file) {
  const old = fileByPath(st, path); if (!old) return;
  const n = markCount(old), pg = k => k ? k + (k === 1 ? ' page' : ' pages') : '', link = old.kind === 'link' && LINK_RX.test(file.name);
  let np = 0;
  if (/\.pdf$/i.test(file.name)) try { await workerReady; const d = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; np = d.numPages; d.destroy(); } catch {}
  const short = u => u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) + (u.length > 56 ? '…' : '');   // the address itself, so two links on the same site can be told apart
  const about = b => vidRef(b) ? 'video file' : drvRef(b) ? 'from Google Drive' : short(linkOf(b)) || 'new';
  const said = async () => link ? about(new Uint8Array(await file.arrayBuffer())) : [pg(np), 'new'].filter(Boolean).join(' · ');
  const oldSaid = link ? about(old.data) : [pg(old.numPages), n ? n + (n === 1 ? ' mark' : ' marks') : 'no marks'].filter(Boolean).join(' · ');
  const copies = sameCopies(st, old), grp = groupPaperOf(st, old), who = groupNames(copies.map(c => c[0]));
  const card = (name, said) => '<div style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px;min-width:0"><b style="overflow-wrap:anywhere">' + esc(name) + '</b><div class="muted">' + said + '</div></div>';
  const shown = link ? linkTitle(old) : fileShown(st, old.name);
  openDlg('<div class="bh"><h2>Replace this ' + (link ? 'video' : 'file') + '?</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:0 0 12px">' +
      card(shown, oldSaid) + '<span class="muted">→</span>' + card(link ? shown : file.name, await said()) + '</div>' +
    '<p style="margin:0">' + (link ? 'The new video takes the old one’s place. The score and the notes stay as they are. The old link waits under Removed files, so you can bring it back.'
      : 'The new file takes the old one’s place on the paper and in the export. The score stays as it is. ' + (n ? 'Marks can’t move onto different pages, so the old file keeps its ' + n + (n === 1 ? ' mark' : ' marks') + '. It waits under Removed files, so you can bring it back.' : 'The old file waits under Removed files, so you can bring it back.')) + '</p>' +
    (copies.length ? (grp ? '<p class="muted" style="margin:10px 0 0;font-size:13px">' + esc(who) + (copies.length === 1 ? ' shares' : ' share') + ' this paper, so theirs changes too.</p>'
      : '<label style="display:flex;gap:8px;align-items:center;margin:10px 0 0;font-size:14px"><input type="checkbox" id="rpAlso" checked> Also for ' + esc(who) + '</label>') : '') + '</div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Replace</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const also = grp || !!($('#rpAlso') && $('#rpAlso').checked);
    closeDlg();
    await replaceDo(st, path, file, also);
  };
}
// Everything a replace changes, for undo and redo: each student's files and layout, the removed list, groups and clips.
const rplJ = v => v == null ? null : JSON.parse(JSON.stringify(v));
function rplSnap(sts, paths) {
  return { s: sts.map(s => [s, { files: s.files.slice(), gone: (s.gone || []).slice(), layout: rplJ(s.layout), forder: s.forder ? s.forder.slice() : null, inc: rplJ(s.inc), tries: ((s.grade && s.grade.tries) || []).map(t => (t.files || []).slice()) }]),
    rm: Object.fromEntries(paths.map(p => [p, rplJ((batch.removed || {})[p])])), g: JSON.stringify(batch.groups || null), c: JSON.stringify(batch.clips || null) };
}
function rplPut(sn, made) {
  for (const [s, o] of sn.s) {
    s.files = o.files.slice(); s.gone = o.gone.slice(); s.layout = rplJ(o.layout);
    if (o.forder) s.forder = o.forder.slice(); else delete s.forder;
    if (o.inc) s.inc = rplJ(o.inc); else delete s.inc;
    ((s.grade && s.grade.tries) || []).forEach((t, i) => { if (o.tries[i]) t.files = o.tries[i].slice(); });
  }
  batch.removed ||= {};
  for (const [p, r] of Object.entries(sn.rm)) if (r) batch.removed[p] = r; else delete batch.removed[p];
  const g = JSON.parse(sn.g), c = JSON.parse(sn.c);
  if (g) batch.groups = g; else delete batch.groups;
  if (c) batch.clips = c; else delete batch.clips;
  // undone: the new file waits under Removed files (it is kept, so it mustn't come back by itself when the download opens again)
  if (made) for (const [s, x] of made) if (!s.files.includes(x) && !s.gone.includes(x)) { s.gone.push(x); batch.removed[x.path] = { t: Date.now() }; }
  for (const [s] of sn.s) refound(s);
  groupSync(); wordScoresAll(); saveNow(); renderList();
}
// One replace, with its partners' copies when also is set. The score is on the student, so it stays. Undo puts every file back as it was.
async function replaceDo(st, path, file, also) {
  const old = fileByPath(st, path); if (!old) return;
  await Promise.all([...wordSaves].map(s => s()));
  const copies = also ? sameCopies(st, old) : [], oldKey = old.kind === 'link' ? linkKey(old) : '';
  const sts = [st, ...copies.map(c => c[0])], was = [[st, path], ...copies.map(([s, f]) => [s, f.path])];
  const before = rplSnap(sts, was.map(w => w[1])), made = [];
  for (const [s, p] of was) { const x = await replaceFile(s, p, s === st ? file : new File([file], file.name, { type: file.type }), true); if (x) made.push([s, x, p]); }
  if (!made.length) return;
  const nf = made[0][1], g = groupOf(st);
  if (g && g.p) for (const [s, x, p] of made) if (g.p[s.key] === p) g.p[s.key] = x.path;   // the group's paper is now the new one, for everyone
  if (batch.clips) {
    const left = oldKey && batch.students.some(s => s.files.some(f => f.kind === 'link' && linkKey(f) === oldKey));
    for (const c of batch.clips) { if (oldKey && !left && c.u === oldKey && nf.kind === 'link') c.u = linkKey(nf); if (c.p === path) c.p = nf.path; }
  }
  groupSync(); saveNow();
  const after = rplSnap(sts, was.map(w => w[1]).concat(made.map(m => m[1].path))), nm = old.kind === 'link' ? linkTitle(old) : fileShown(st, old.name);
  const show = p => { const i = batch.students.indexOf(st); if (i >= 0) openStudent(i, p); };
  const step = actStep(() => { rplPut(before, made); show(path); }, () => { rplPut(after); show(nf.path); }, 'replaced ' + nm);
  pushUndo(step);
  openStudent(cur, nf.path);
  toastDo('Replaced ' + nm + (made.length > 1 ? ' for ' + groupNames(made.map(m => m[0])) : ''), 'Undo', () => { const i = undoStack.indexOf(step); if (i >= 0) undoStack.splice(i, 1); rplPut(before, made); show(path); });
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
  for (const t of (st.grade && st.grade.tries) || []) if ((t.files || []).includes(path)) t.files.push(nf.path);   // an earlier try's paper stays that try's
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
  fieldSnap(st, ['layout'], () => { saveNow(); toStudent(st, path); }, 'page taken out');
  st.layout = L0.map(d => ({ ...d, pages: d.pages.filter(([q, n]) => !(q === path && n === p)) })).filter(d => d.pages.length);
  const f = fileByPath(st, path);
  saveNow(); renderList(); openStudent(cur);
  toastDo('Took out ' + fileShown(st, (f || { name: path }).name) + ', page ' + (p + 1), 'Undo', () => { st.layout = was; saveNow(); renderList(); openStudent(cur, path); });
}
// Back where it was: among the same file's pages in page order, or as a file of its own if none of them are left.
function bringPageBack(st, path, p) {
  const f = fileByPath(st, path); if (!f || !st.layout) return;
  fieldSnap(st, ['layout'], () => { saveNow(); toStudent(st, path); }, 'page brought back');
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

