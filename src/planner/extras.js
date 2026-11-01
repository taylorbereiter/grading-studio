/* ---------- right-click for Claude, search, copy a lesson, print a week ---------- */

// What a right-click is on, as something the Claude box can hold.
function ctxTarget(el) {
  const sel = getSelection(), selT = sel && !sel.isCollapsed && $('#lessons').contains(sel.anchorNode) ? sel.toString().trim() : '';
  const where = ctxWhere();
  if (selT) return { kind: 'quote', label: where, text: selT.slice(0, 4000) };
  const th = el.closest('.ls-th[data-go]');
  if (th && L.open) return { kind: 'slide', lesson: L.open.id, i: +th.dataset.go };
  if (el.closest('#lsStage') && L.open) return { kind: 'slide', lesson: L.open.id, i: L.cur };
  const card = el.closest('[data-open]');
  if (card) { const l = L.lessons.find(x => x.id === card.dataset.open); if (l) return { kind: 'lesson', lesson: l.id }; }
  const ch = el.closest('[data-chip]');
  if (ch) { try { return JSON.parse(ch.dataset.chip); } catch { } }
  const blk = el.closest('#docPage > *, .ls-slot, .pl-wu, .pl-week, .pl-card, .ls-day, .pl-file, label, p, li, td') || el;
  const t = (blk.innerText || blk.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  return t ? { kind: 'quote', label: where, text: t.slice(0, 1500) } : { kind: 'quote', label: where, text: '' };
}
function ctxWhere() {
  if (L.view === 'doc' && L.doc) { const o = ownerOf(L.doc.ref), f = o && o.files.find(x => x.id === L.doc.id); return 'Document “' + (f ? f.name : 'document') + '”'; }
  if (L.view === 'edit' && L.open) return 'Lesson “' + L.open.title + '”';
  if (L.view === 'unit' && L.unit) return 'Unit “' + L.unit.title + '”';
  if (L.view === 'week') return 'Week of ' + shortDate(L.weekOf);
  return { semester: 'Semester plan', units: 'Units', activities: 'Activity bank', bank: 'Rubrics' }[L.view] || 'Planner';
}
let ctxEl = null;
function ctxClose() { if (ctxEl) { ctxEl.remove(); ctxEl = null; } }
function ctxPlace(box, x, y) {
  document.body.appendChild(box);
  const r = box.getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  box.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
}
function ctxOpen(e) {
  ctxClose();
  const c = ctxTarget(e.target), x = e.clientX, y = e.clientY;
  const what = c.kind === 'slide' ? 'this slide' : c.kind === 'lesson' ? 'this lesson' : c.kind === 'file' ? 'this file' : c.kind === 'quote' && getSelection().toString().trim() ? 'the selected text' : 'this';
  const box = document.createElement('div'); box.className = 'pl-ctx'; box.setAttribute('role', 'menu');
  box.innerHTML = '<button role="menuitem" data-cx="note">💬 Comment for Claude on ' + what + '…</button><button role="menuitem" data-cx="add">＋ Add ' + what + ' to the Claude box</button>' +
    (c.kind === 'lesson' || (c.kind === 'slide' && L.view === 'edit') ? '<button role="menuitem" data-cx="copy">⧉ Copy ' + (c.kind === 'lesson' ? 'this lesson' : 'the lesson') + ' to another day…</button>' : '') +
    '<span class="pl-ctx-hint">Shift + right-click for the usual menu</span>';
  ctxEl = box; ctxPlace(box, x, y);
  box.querySelector('button').focus();
  box.onclick = async ev => {
    const b = ev.target.closest('[data-cx]'); if (!b) return;
    const a = b.dataset.cx; ctxClose();
    if (a === 'add') return boxAdd(c);
    if (a === 'copy') return copyLessonDlg(L.lessons.find(l => l.id === (c.lesson || (L.open && L.open.id))));
    noteOpen(c, x, y);
  };
}
function noteOpen(c, x, y) {
  ctxClose();
  const box = document.createElement('div'); box.className = 'pl-ctx pl-note';
  box.innerHTML = '<b>Comment for Claude</b><span class="muted sp-small">' + esc(chipLabelNow(c)) + '</span><textarea id="plNoteT" rows="4" placeholder="What should Claude change or think about here?"></textarea>' +
    '<div class="sp-bar"><button class="btn sm" data-dict="#plNoteT">🎤 Dictate</button><span class="sp"></span><button class="btn sm ghost" data-nx>Cancel</button><button class="btn sm primary" data-nok>Add to Claude box</button></div>';
  ctxEl = box; ctxPlace(box, x, y);
  const t = box.querySelector('textarea'); t.focus();
  const ok = async () => { const v = t.value.trim(); if (!v) return t.focus(); ctxClose(); await boxAdd({ kind: 'note', about: c, text: v }); };
  t.onkeydown = ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ok(); } };
  box.onclick = ev => { if (ev.target.closest('[data-nx]')) ctxClose(); else if (ev.target.closest('[data-nok]')) ok(); };
}
// A short name for a chip before it is in the box (the box names pages and slides itself).
function chipLabelNow(c) {
  if (c.kind === 'slide') { const l = L.lessons.find(x => x.id === c.lesson), s = l && l.slides[c.i]; return (l ? l.title : 'Lesson') + ', slide ' + (c.i + 1) + (s && s.title ? ': ' + s.title : ''); }
  if (c.kind === 'lesson') { const l = L.lessons.find(x => x.id === c.lesson); return l ? l.title : 'Lesson'; }
  if (c.kind === 'file') { const o = ownerOf({ t: c.t, id: c.owner }), f = o && (o.files || []).find(x => x.id === c.id); return f ? f.name : 'File'; }
  if (c.kind === 'quote') return c.label + (c.text ? ': “' + c.text.replace(/\s+/g, ' ').slice(0, 70) + (c.text.length > 70 ? '…' : '') + '”' : '');
  if (c.kind === 'page') return 'p. ' + c.page;
  return c.label || c.kind;
}
document.addEventListener('contextmenu', e => {
  const lessons = $('#lessons');
  if (e.shiftKey || !lessons || lessons.hidden || !lessons.contains(e.target)) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;   // keep spelling suggestions in text boxes
  e.preventDefault(); ctxOpen(e);
});
document.addEventListener('mousedown', e => { if (ctxEl && !ctxEl.contains(e.target)) ctxClose(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ctxEl) { ctxClose(); e.stopPropagation(); } }, true);
window.addEventListener('scroll', () => { if (ctxEl && !ctxEl.classList.contains('pl-note')) ctxClose(); }, true);

/* ---------- search everything ---------- */
const findNorm = s => String(s || '').toLowerCase();
function findSnip(t, q) {
  const i = findNorm(t).indexOf(q); if (i < 0) return '';
  let a = Math.max(0, i - 40); if (a) { const sp = t.indexOf(' ', a); a = sp >= 0 && sp < i ? sp + 1 : a; }
  const s = t.slice(a, i + q.length + 60).replace(/\s+/g, ' ');
  return (a ? '…' : '') + s;
}
async function findAll(q) {
  q = findNorm(q).trim(); if (q.length < 2) return [];
  const out = [];
  for (const l of L.lessons) {
    const when = l.slots.length ? l.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ') : 'Not on a class';
    if (findNorm(l.title).includes(q)) out.push({ kind: 'lesson', id: l.id, i: 0, title: l.title, where: when, snip: '' });
    l.slides.forEach((s, i) => {
      const t = [s.title, s.body, s.body2, s.notes, s.ask, ...EXTRA.map(k => s[k])].filter(Boolean).join(' · ');
      if (findNorm(t).includes(q)) out.push({ kind: 'slide', id: l.id, i, title: l.title + ', slide ' + (i + 1), where: when, snip: findSnip(t, q) });
    });
    for (const f of l.files || []) {
      let t = f.name;
      if (f.kind === 'doc') { const b = await fileBlob(f.id); if (b) { const tp = document.createElement('template'); tp.innerHTML = docClean(await b.text()); t += ' · ' + tp.content.textContent; } }
      if (findNorm(t).includes(q)) out.push({ kind: 'file', id: l.id, fid: f.id, t: 'lesson', title: f.name, where: 'In “' + l.title + '”', snip: findSnip(t, q) });
    }
  }
  for (const u of L.units) {
    const t = [u.title, u.course, ...(u.weeks || []).map(w => w.focus)].filter(Boolean).join(' · ');
    if (findNorm(t).includes(q)) out.push({ kind: 'unit', id: u.id, title: u.title, where: u.course || 'Unit', snip: findSnip(t, q) });
    for (const f of u.files || []) if (findNorm(f.name).includes(q)) out.push({ kind: 'file', id: u.id, fid: f.id, t: 'unit', title: f.name, where: 'In “' + u.title + '”', snip: '' });
  }
  return out;
}
const FIND_ICON = { lesson: '📘', slide: '▭', file: '📄', unit: '🗂' };
async function findDlg(q0) {
  openDlg('<div class="bh"><h2>Search</h2><input type="search" id="fdQ" class="btn sm pl-find-in" placeholder="Lessons, slides, notes, documents, units" value="' + esc(q0 || '') + '"></div><div class="bb"><div class="ls-pick" id="fdL"></div></div><div class="bf"><button class="btn" data-x>Close</button></div>', true);
  let tm = 0;
  const run = async () => {
    const q = $('#fdQ').value, rs = await findAll(q), box = $('#fdL'); if (!box) return;
    box.innerHTML = q.trim().length < 2 ? '<p class="muted">Type at least two letters.</p>' : rs.length ? rs.slice(0, 80).map((r, n) => '<button class="ls-card pl-hit" data-fd="' + n + '"><b>' + FIND_ICON[r.kind] + ' ' + esc(r.title) + '</b><span>' + esc(r.where) + '</span>' + (r.snip ? '<span class="pl-snip">' + esc(r.snip) + '</span>' : '') + '</button>').join('') + (rs.length > 80 ? '<p class="muted">Showing the first 80.</p>' : '') : '<p class="muted">Nothing found for “' + esc(q.trim()) + '”.</p>';
    box._rs = rs;
  };
  $('#fdQ').oninput = () => { clearTimeout(tm); tm = setTimeout(run, 150); };
  $('#fdQ').focus(); run();
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    const b = e.target.closest('[data-fd]'); if (!b) return;
    const r = $('#fdL')._rs[+b.dataset.fd]; closeDlg();
    if (r.kind === 'unit') return openUnit(L.units.find(u => u.id === r.id));
    if (r.kind === 'file') {
      if (r.t === 'unit') openUnit(L.units.find(u => u.id === r.id)); else openLesson(L.lessons.find(l => l.id === r.id));
      return matOpen({ t: r.t, id: r.id }, r.fid);
    }
    openLesson(L.lessons.find(l => l.id === r.id)); goSlide(r.i);
  };
}

/* ---------- copy a lesson to another class or day ---------- */
function copyLessonDlg(l) {
  if (!l) return;
  const cls = (L.setup && L.setup.classes) || [], s0 = l.slots[0];
  openDlg('<div class="bh"><h2>Copy “' + esc(l.title) + '”</h2></div><div class="bb">' +
    (cls.length ? '<label class="ls-f">Class <select id="cpC" class="btn"><option value="">No class</option>' + cls.map(c => '<option value="' + esc(c.id) + '"' + (s0 && s0.classId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>' +
      '<label class="ls-f">Date <input type="date" id="cpD" class="btn" value="' + (s0 ? s0.date : ymd(new Date())) + '"></label>' : '') +
    '<label class="ls-f">Name <input id="cpT" class="btn" value="' + esc(l.title) + '"></label>' +
    '<p class="muted" style="font-size:13px">The copy gets its own slides, notes and materials, so changing one won’t change the other.</p></div>' +
    '<div class="bf"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Make the copy</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const c = $('#cpC') ? $('#cpC').value : '', d = $('#cpD') ? $('#cpD').value : '';
    const n = await copyLesson(l, c && d ? { classId: c, date: d } : null, $('#cpT').value.trim() || l.title);
    closeDlg(); editorCommit(); openLesson(n); toast('Copied' + (c && d ? ' to ' + className(c) + ' · ' + shortDate(d) : ''));
  };
}
async function copyLesson(l, slot, title) {
  const j = JSON.parse(JSON.stringify(l)); delete j._file; delete j._mod; delete j.pending;
  j.id = lid(); j.title = title || l.title; j.slots = slot ? [slot] : []; j.created = j.updated = Date.now(); j.status = ''; j.claudeNote = '';
  j.slides = j.slides.map(s => ({ ...s, id: lid() }));
  j.files = [];
  for (const f of l.files || []) { const b = await fileBlob(f.id); if (!b) continue; const id = lid(); await kvSet('file:' + id, b); j.files.push({ ...f, id, added: Date.now() }); }
  const n = normLesson(j); L.lessons.push(n); await lPut(n); return n;
}

/* ---------- print a week ---------- */
function printWeek() {
  const mon = parseYmd(L.weekOf), days = [0, 1, 2, 3, 4].map(i => ymd(addDays(mon, i)));
  const P = s => esc(s);
  let h = '<h1>Week of ' + LMONTHS[mon.getMonth()] + ' ' + mon.getDate() + '</h1>';
  const units = courses().map(c => { const at = unitAt(c.course, L.weekOf); return at ? '<li><b>' + P(c.course) + ':</b> ' + P(at.u.title) + ', week ' + (at.n + 1) + ' of ' + at.u.weeks.length + (at.u.weeks[at.n].focus ? ' (' + P(at.u.weeks[at.n].focus) + ')' : '') + '</li>' : ''; }).join('');
  if (units) h += '<ul class="units">' + units + '</ul>';
  for (const d of days) {
    const off = dayOff(d), ev = eventsOn(d), ms = meetingsOn(d);
    h += '<section><h2>' + LDAYS[parseYmd(d).getDay()] + ' ' + (parseYmd(d).getMonth() + 1) + '/' + parseYmd(d).getDate() + (off ? ' · ' + P(off.label || 'No school') : '') + ev.map(x => ' · ' + P(x.label)).join('') + '</h2>';
    if (!ms.length && !off) h += '<p class="none">No classes</p>';
    for (const { c, m } of ms) {
      const ls = lessonsAt(c.id, d);
      h += '<div class="cls"><div class="ch"><b>' + P(c.name) + '</b> ' + hm(m.start) + '–' + hm(m.end) + (m.label ? ' · ' + P(m.label) : '') + '</div>' +
        (ls.length ? ls.map(l => '<div class="ls"><b>' + P(l.title) + '</b><ol>' + l.slides.map(s => '<li>' + P(s.title || LAYOUTS[s.layout]) + '</li>').join('') + '</ol>' + ((l.files || []).length ? '<div class="mats">Materials: ' + l.files.map(f => P(f.name)).join(', ') + '</div>' : '') + '</div>').join('') : '<p class="none">No lesson yet</p>') + '</div>';
    }
    h += '</section>';
  }
  const css = 'body{font:11pt/1.35 Calibri,"Segoe UI",Arial,sans-serif;color:#111;margin:14mm}h1{font-size:18pt;margin:0 0 6pt}h2{font-size:13pt;margin:0 0 4pt;border-bottom:1.5px solid #111;padding-bottom:2pt}section{break-inside:avoid;margin:0 0 10pt}.cls{margin:4pt 0 6pt 8pt}.ch{font-size:11.5pt}.ls{margin:2pt 0 0 10pt}.ls ol{margin:2pt 0;padding-left:16pt;columns:2;column-gap:18pt}.mats{font-size:10pt;color:#444}.none{color:#666;margin:2pt 0 2pt 8pt}ul.units{margin:0 0 10pt;padding-left:16pt}@page{size:A4;margin:0}';
  const w = window.open('', '_blank');
  if (!w) return toast('Your browser blocked the print window. Allow pop-ups for this page.');
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Week of ' + shortDate(L.weekOf) + '</title><style>' + css + '</style></head><body>' + h + '</body></html>');
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
