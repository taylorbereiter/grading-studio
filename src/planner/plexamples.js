/* ================= Planner: strong examples from the saved bank, put in a lesson =================
   Grading keeps strong examples in their own database, grading-studio-examples (src/examples.js): pictures with every cover painted
   in and the score left off unless the teacher kept it. This is the one thing of grading's the Planner reads, and only to read:
   - it never makes that database (a browser that has never kept an example has none, and opening it here must not make one);
   - it keeps only what names an example the way grading does (assignment name, Example A, Question 3), never whose it was;
   - the connection is closed after each read, so grading can still change the database later.
   An example goes on a slide as an ordinary picture (one slide a page), or into Materials as a JPEG a page. From then on it is the
   lesson's own picture, so it goes wherever the lesson goes (the .pptx, the .zip, a shared lesson, the Planner folder). */
const PLX_DB = 'grading-studio-examples';
const PLX = { list: [] };
function plxDb() {
  return new Promise(res => {
    let r; try { r = indexedDB.open(PLX_DB); } catch { return res(null); }
    r.onupgradeneeded = () => { try { r.transaction.abort(); } catch { } };   // it wasn't there: aborting leaves no database behind
    r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('ex') || !db.objectStoreNames.contains('pix')) { db.close(); return res(null); } res(db); };
    r.onerror = () => res(null); r.onblocked = () => res(null);
  });
}
async function plxRead(fn) {
  try {
    if (indexedDB.databases && !(await indexedDB.databases()).some(d => d.name === PLX_DB)) return null;
    const db = await plxDb(); if (!db) return null;
    try { return await new Promise((res, rej) => { const tx = db.transaction(['ex', 'pix'], 'readonly'), q = fn(tx); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); }); }
    finally { db.close(); }
  } catch (e) { console.warn(e); return null; }
}
// How grading names an example (exLabel in src/examples.js): never after the student.
const plxLabel = r => r.kind === 'answer' ? 'Question ' + (r.q || '?') : r.kind === 'paper' ? 'Example ' + (r.letter || 'A') : r.kind === 'shot' ? 'Screenshot ' + (r.letter || '1') : 'Part of a page';
const plxKinds = { answer: 1, paper: 1, part: 1, shot: 1 };
async function plxLoad() {
  const all = await plxRead(tx => tx.objectStore('ex').getAll());
  // Only these fields come over: from (whose it was), work and the class stay in grading.
  // never the watch list (watch: 1, src/watch.js): those are concerns, kept for the teacher only
  PLX.list = (all || []).filter(r => r && !r.gone && !r.watch && plxKinds[r.kind] && Array.isArray(r.pages) && r.pages.length).map(r => ({
    id: String(r.id), t: +r.t || 0, kind: r.kind, title: String(r.title || 'Assignment'), letter: String(r.letter || ''), q: r.q && r.q.lab ? String(r.q.lab) : '',
    why: String(r.why || ''), tags: Array.isArray(r.tags) ? r.tags.map(String) : [], pages: r.pages.length })).sort((a, b) => b.t - a.t);
  return PLX.list;
}
const plxPic = (id, n) => plxRead(tx => tx.objectStore('pix').get(id + '|' + n));
plxLoad();
// Examples kept in the grading tab while this one was open show up when the teacher comes back.
document.addEventListener('visibilitychange', () => { if (!document.hidden) plxLoad(); });
const plxHas = () => PLX.list.length > 0;

// The chooser. to: 'slide' (from Add a slide) or 'mats' (from Materials). Both actions are always there; the one asked for is blue.
async function plxPick(to) {
  const l = L.open; if (!l) return;
  await plxLoad();
  if (!PLX.list.length) return toast('No strong examples yet. Keep one while marking (Use as an example), then come back.', 6000);
  const S = { id: '', pages: new Set(), q: '' }, urls = [];
  const groups = () => {
    const q = S.q.trim().toLowerCase(), hit = r => !q || [r.title, plxLabel(r), r.why, ...r.tags].some(x => x.toLowerCase().includes(q));
    const by = new Map(); for (const r of PLX.list.filter(hit)) { if (!by.has(r.title)) by.set(r.title, []); by.get(r.title).push(r); }
    return [...by];
  };
  const card = r => '<button class="plx-card' + (S.id === r.id ? ' on' : '') + '" data-plx="' + esc(r.id) + '" aria-pressed="' + (S.id === r.id) + '"><span class="plx-th"><img alt="" data-plxpic="' + esc(r.id) + '"></span>' +
    '<b>' + esc(plxLabel(r)) + '</b><span class="muted">' + (r.pages > 1 ? r.pages + ' pages' : '') + (r.why ? (r.pages > 1 ? ' · ' : '') + esc(r.why) : '') + '</span>' +
    (r.tags.length ? '<span class="plx-tags">' + r.tags.map(t => '<i>' + esc(t) + '</i>').join('') + '</span>' : '') + '</button>';
  const list = () => { const g = groups(); return g.length ? g.map(([t, rs]) => '<h3 class="pl-h3">' + esc(t) + '</h3><div class="plx-grid">' + rs.map(card).join('') + '</div>').join('') : '<p class="muted">No example matches that.</p>'; };
  const pagesHtml = () => { const r = PLX.list.find(x => x.id === S.id); if (!r || r.pages < 2) return '';
    return '<div class="plx-pages"><span>Pages:</span>' + Array.from({ length: r.pages }, (_, n) => '<label><input type="checkbox" data-plxpg="' + n + '"' + (S.pages.has(n) ? ' checked' : '') + '> ' + (n + 1) + '</label>').join('') + '</div>'; };
  const ok = () => { const r = PLX.list.find(x => x.id === S.id); return !!r && (r.pages < 2 || S.pages.size > 0); };
  openDlg('<div class="bh"><h2>Strong examples</h2><input type="search" id="plxF" class="btn sm" placeholder="Find" aria-label="Find an example"></div>' +
    '<div class="bb"><p class="muted" style="margin-top:0">Saved while marking, with names covered. Once in this lesson, a picture goes with it in downloads and shares.</p><div id="plxL">' + list() + '</div><div id="plxP"></div></div>' +
    '<div class="bf"><button class="btn" data-x>Cancel</button><span class="sp" style="flex:1"></span><button class="btn' + (to === 'mats' ? ' primary' : '') + '" data-plxgo="mats" disabled>Add to materials</button><button class="btn' + (to === 'mats' ? '' : ' primary') + '" data-plxgo="slide" disabled>Put on slides</button></div>');
  const box = $('#dlgBox');
  const thumbs = async () => { for (const im of box.querySelectorAll('img[data-plxpic]:not([src])')) { const b = await plxPic(im.dataset.plxpic, 0); if (b && im.isConnected) { const u = URL.createObjectURL(b); urls.push(u); im.src = u; } } };
  const sync = () => { $('#plxP').innerHTML = pagesHtml(); for (const b of box.querySelectorAll('[data-plxgo]')) b.disabled = !ok(); for (const c of box.querySelectorAll('[data-plx]')) { c.classList.toggle('on', c.dataset.plx === S.id); c.setAttribute('aria-pressed', c.dataset.plx === S.id); } };
  const done = () => { closeDlg(); setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 1000); };
  thumbs();
  box.oninput = e => { if (e.target.id !== 'plxF') return; S.q = e.target.value; $('#plxL').innerHTML = list(); thumbs(); };
  box.onchange = e => { const p = e.target.dataset.plxpg; if (p == null) return; if (e.target.checked) S.pages.add(+p); else S.pages.delete(+p); sync(); };
  box.onclick = async e => {
    if (e.target.closest('[data-x]')) return done();
    const c = e.target.closest('[data-plx]');
    if (c) { if (S.id !== c.dataset.plx) { S.id = c.dataset.plx; const r = PLX.list.find(x => x.id === S.id); S.pages = new Set(Array.from({ length: r.pages }, (_, n) => n)); } return sync(); }
    const g = e.target.closest('[data-plxgo]'); if (!g || g.disabled || !ok()) return;
    const r = PLX.list.find(x => x.id === S.id), pages = r.pages < 2 ? [0] : [...S.pages].sort((a, b) => a - b);
    for (const b of box.querySelectorAll('[data-plxgo]')) b.disabled = true;
    g.textContent = 'Adding…';
    const blobs = []; for (const n of pages) { const b = await plxPic(r.id, n); if (!b) { done(); return toast('That example’s picture is missing. Open it in grading and try again.', 6000); } blobs.push(b); }
    done();
    return g.dataset.plxgo === 'mats' ? plxToMats(l, r, pages, blobs) : plxToSlides(l, r, pages, blobs);
  };
}
// One slide a page, after this one: a whole paper fills the slide (Full picture), an answer or part sits under a title.
// The current slide's own picture is never replaced. All of it is one step for Undo.
async function plxToSlides(l, r, pages, blobs) {
  const made = [];
  try { for (const b of blobs) made.push(await shrinkPic(b)); } catch { return toast('That example’s picture couldn’t be opened'); }
  if (L.open !== l) return;
  editorCommit();
  const many = pages.length > 1 || r.pages > 1;
  made.forEach((p, i) => {
    const source = r.title + ' · ' + plxLabel(r) + (many ? ', page ' + (pages[i] + 1) : '');
    const s = normSlide({ layout: r.kind === 'paper' ? 'fullpic' : 'picture', title: 'Strong example' + (r.kind === 'paper' ? ': ' + plxLabel(r) : ''), size: 28, fmt: 2 });
    s.img = { ...p, source };
    l.slides.splice(L.cur + 1, 0, s); L.cur++;
  });
  lessonChanged(); renderEditor();
  toast(made.length === 1 ? 'Strong example added on a new slide' : 'Strong example added, one page on each of ' + made.length + ' slides');
}
// Into Materials, a JPEG a page, named the way grading names its downloads (never after the student).
async function plxToMats(l, r, pages, blobs) {
  const ref = { t: 'lesson', id: l.id }, o = ownerOf(ref); if (!o) return;
  o.files = o.files || [];
  const ids = [], base = (r.title + ' - ' + plxLabel(r)).replace(/[\\/:*?"<>|]+/g, '-');
  for (const [i, b] of blobs.entries()) {
    const id = lid(); await kvSet('file:' + id, b); ids.push(id);
    o.files.push({ id, name: uniqueName(o, base + (pages.length > 1 || r.pages > 1 ? ' p' + (pages[i] + 1) : '') + '.jpg'), kind: 'other', type: 'image/jpeg', size: b.size, added: Date.now() });
  }
  await ownerSave(ref, o); renderLessons();
  undoToast(ids.length === 1 ? 'Added to Materials' : 'Added ' + ids.length + ' pages to Materials', async () => {
    const x = ownerOf(ref); if (!x) return;
    x.files = (x.files || []).filter(f => !ids.includes(f.id)); for (const id of ids) await kvDel('file:' + id);
    await ownerSave(ref, x); renderLessons(); toast('Taken out');
  });
}
