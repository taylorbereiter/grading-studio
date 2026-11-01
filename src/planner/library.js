/* ---------- past lessons: the library, a unit's lessons, and lesson packs ---------- */
// A lesson with `library` set is a past lesson (from an old deck, say). It lives in the Library instead of
// the week's "Not on the timetable" list. `unit` ties a lesson to one of your units.

let libQ = '';
const libGroups = () => [...new Set(L.lessons.filter(l => l.library).map(l => l.library))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const MAT_ICON = f => fileIcon(f);
function libCard(l) {
  const files = l.files || [];
  return '<div class="pl-lib-card"><button class="ls-card" data-open="' + l.id + '"><b>' + esc(l.title) + '</b><span>' + l.slides.length + ' slide' + (l.slides.length === 1 ? '' : 's') +
    (l.slots.length ? ' · ' + esc(l.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ')) : '') + '</span></button>' +
    (files.length ? '<div class="pl-lib-files">' + files.slice(0, 6).map(f => '<button class="pl-lib-f" data-libf="' + l.id + '|' + f.id + '" title="Open ' + esc(f.name) + '"><span class="pl-ft">' + MAT_ICON(f) + '</span>' + esc(f.name.replace(/\.[^.]+$/, '')) + '</button>').join('') + (files.length > 6 ? '<span class="muted sp-small">+' + (files.length - 6) + ' more</span>' : '') + '</div>' : '') + '</div>';
}
function renderLibrary() {
  const q = libQ.trim().toLowerCase();
  const match = l => !q || (l.title + ' ' + l.library + ' ' + (l.files || []).map(f => f.name).join(' ')).toLowerCase().includes(q);
  let h = topBar('library', '<input type="search" class="btn sm pl-libq" data-libq placeholder="Filter past lessons" value="' + esc(libQ) + '" aria-label="Filter past lessons">') + '<div class="pl-lib">';
  const gs = libGroups();
  if (!gs.length) h += '<div class="ls-empty"><h2>Your past lessons</h2><p>Old decks and their handouts show up here once you import a lesson pack (a .zip made for the Planner). Each deck becomes a lesson you can edit, with the original PowerPoint and PDF one click away.</p><div class="row"><button class="btn primary" data-a="import">Import a lesson pack…</button></div></div>';
  for (const g of gs) {
    const ls = L.lessons.filter(l => l.library === g && match(l)).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
    if (!ls.length) continue;
    h += '<section class="pl-card"><div class="lhead"><h2>' + esc(g) + '</h2><span class="muted">' + ls.length + ' lesson' + (ls.length === 1 ? '' : 's') + '</span></div><div class="pl-lib-grid">' + ls.map(libCard).join('') + '</div></section>';
  }
  if (gs.length && q && !L.lessons.some(l => l.library && match(l))) h += '<p class="muted" style="padding:0 6px">Nothing matches “' + esc(libQ) + '”.</p>';
  $('#lessons').innerHTML = h + '</div>';
}
// On a unit page: the lessons tied to it, newest first, with their files.
function unitLessonsSection(u) {
  const ls = L.lessons.filter(l => l.unit === u.id).sort((a, b) => ((b.slots[0] || {}).date || '').localeCompare((a.slots[0] || {}).date || '') || a.title.localeCompare(b.title, undefined, { numeric: true }));
  if (!ls.length) return '';
  return '<section class="pl-card"><div class="lhead"><h2>Lessons for this unit</h2><span class="muted">' + ls.length + '</span></div><div class="pl-lib-grid">' + ls.map(libCard).join('') + '</div></section>';
}
async function libraryClick(e) {
  const f = e.target.closest('[data-libf]'); if (!f) return false;
  const [lid_, fid] = f.dataset.libf.split('|'); await matOpen({ t: 'lesson', id: lid_ }, fid); return true;
}
function libraryInput(e) {
  if (e.target.dataset.libq == null) return false;
  libQ = e.target.value; const pos = e.target.selectionStart; renderLibrary();
  const i = document.querySelector('[data-libq]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); }
  return true;
}

/* ---------- lesson packs ---------- */
// A .zip with pack.json and the files it names. pack.json:
// { kind: 'grading-studio-lesson-pack', version: 1, name, lessons: [ lesson + files: [{ name, path, type }] ],
//   units: [ { id, atlas, files: [{ name, path, type, kind }] } ] }
// Lessons already here (same id) are left as they are, so a pack can be loaded again safely.
const unzipAsync = (u8, filter) => new Promise((res, rej) => fflate.unzip(u8, { filter }, (e, d) => e ? rej(e) : res(d)));
async function packImport(file) {
  toast('Opening ' + file.name + '…', 60000);
  let z;
  try { z = await unzipAsync(new Uint8Array(await file.arrayBuffer()), f => f.name === 'pack.json'); } catch { return toast('That .zip couldn’t be opened'); }
  let p; try { p = JSON.parse(fflate.strFromU8(z['pack.json'])); } catch { return toast('That .zip isn’t a lesson pack'); }
  if (!p || p.kind !== 'grading-studio-lesson-pack') return toast('That .zip isn’t a lesson pack');
  const lessons = (Array.isArray(p.lessons) ? p.lessons : []).filter(x => x && Array.isArray(x.slides) && !L.lessons.some(l => l.id === x.id));
  const units = (Array.isArray(p.units) ? p.units : []).filter(x => x && L.units.some(u => u.id === x.id));
  const want = new Set();
  for (const x of lessons) for (const f of x.files || []) if (f && f.path) want.add(f.path);
  for (const x of units) for (const f of x.files || []) if (f && f.path) want.add(f.path);
  toast('Unpacking ' + want.size + ' files…', 60000);
  try { z = await unzipAsync(new Uint8Array(await file.arrayBuffer()), f => want.has(f.name)); } catch { return toast('That .zip couldn’t be opened'); }
  const store = async f => { const d = z[f.path]; if (!d || d.length > MAX_FILE) return null; const id = lid(); const b = new Blob([d], { type: f.type || '' }); await kvSet('file:' + id, b); return { id, b }; };
  let nl = 0, nf = 0, na = 0;
  for (const x of lessons) {
    const files = [];
    for (const f of x.files || []) { const s = await store(f); if (s) { files.push({ id: s.id, name: String(f.name || 'File'), kind: 'other', type: s.b.type, size: s.b.size, added: Date.now() }); nf++; } }
    const l = normLesson({ ...x, files }); l.slides.forEach(s => { if (s.img && !imgSrc(s.img.src)) delete s.img; });
    L.lessons.push(l); await lPut(l); nl++;
  }
  for (const x of units) {
    const u = L.units.find(v => v.id === x.id); let ch = false;
    if (!u.atlas && /^https?:\/\//.test(x.atlas || '')) { u.atlas = String(x.atlas); ch = true; na++; }
    for (const f of x.files || []) {
      if (u.files.some(g => g.name === f.name)) continue;
      const s = await store(f); if (!s) continue;
      u.files.push({ id: s.id, name: uniqueName(u, String(f.name || 'File')), kind: ['atlas', 'summative', 'other'].includes(f.kind) ? f.kind : 'other', type: s.b.type, size: s.b.size, added: Date.now() }); ch = true; nf++;
    }
    if (ch) await unitPut(u, true);
  }
  const skipped = (p.lessons || []).length - lessons.length;
  toast((p.name ? p.name + ': ' : '') + (nl ? nl + ' lesson' + (nl === 1 ? '' : 's') : 'no new lessons') + (nf ? ', ' + nf + ' files' : '') + (na ? ', ' + na + ' Atlas link' + (na === 1 ? '' : 's') : '') + (skipped > 0 ? ' (' + skipped + ' already here)' : ''), 6000);
  if (nl && L.view !== 'edit') { L.view = 'library'; }
  renderLessons();
}
