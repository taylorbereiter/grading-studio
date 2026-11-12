/* ================= Planner: links on a lesson, and a class's lasting links =================
   A lesson keeps its own links in "links": [{ id, name, url }], beside its materials. They are only addresses: nothing is
   fetched, and each opens in a new tab.
   A class's lasting links (the class site, the textbook, a shared folder) are not kept here. They are School resources on the
   grading page (gs.school, read here and never written) that the teacher marked "For" a class or a course. A lesson shows the
   ones for the classes it is taught to, so they are on every lesson of that class all year without being added again. */
const LK_MAX = 40;
// What was typed as a web address, tidied, or '' when it isn't one. Only http and https.
function lkUrl(t) {
  let s = String(t || '').trim(); if (!s || /\s/.test(s)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) { if (!/\.[a-z]{2,}/i.test(s)) return ''; s = 'https://' + s; }
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname ? u.href : ''; } catch { return ''; }
}
const lkHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// A class's or a course's name as it is compared: letters and digits only, so "English 10" is "english10" on both pages.
const lkNorm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const LK_IC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-.9.9M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l.9-.9"/></svg>';
function normLinks(v) {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(v) ? v : []) {
    const url = x && typeof x === 'object' ? lkUrl(x.url) : ''; if (!url || seen.has(url) || out.length >= LK_MAX) continue;
    seen.add(url); out.push({ id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim().slice(0, 120) || lkHost(url), url });
  }
  return out;
}
// The links kept in School resources, read from where the grading page keeps them. Kept at the top first, then by name.
function lkSchool(other) {
  let v = null; try { v = JSON.parse(localStorage.getItem('gs.school') || 'null'); } catch { }
  const isLink = i => i.kind === 'link' && !!lkUrl(i.url);
  const items = (v && Array.isArray(v.items) ? v.items : []).filter(i => i && i.id && !i.gone && (other ? !isLink(i) : isLink(i)));
  return items.map(i => ({ id: String(i.id), name: String(i.name || lkHost(i.url)), url: other ? '' : lkUrl(i.url), group: String(i.group || ''), note: String(i.note || ''), pin: !!i.pin, cls: (Array.isArray(i.cls) ? i.cls : []).map(String).filter(Boolean) }))
    .sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}
// The lasting links of the classes a lesson is taught to: [{ label, links }], one for each course (or class with no course).
// slot: only that class, as when it is being presented. more: the names of that class's files and notes, which open on the
// grading page (their bytes are kept there).
function lkClassGroups(l, slot) {
  const all = lkSchool().filter(i => i.cls.length), rest = lkSchool(true).filter(i => i.cls.length); if (!all.length && !rest.length) return [];
  const out = [], seen = new Set();
  for (const t of slot ? [slot] : l.slots) {
    const c = classById(t.classId); if (!c) continue;
    const label = c.course || c.name, k = lkNorm(label); if (seen.has(k)) continue; seen.add(k);
    const keys = new Set([lkNorm(c.course), lkNorm(c.name)].filter(Boolean));
    const mine = i => i.cls.some(n => keys.has(lkNorm(n))), links = all.filter(mine), more = rest.filter(mine).map(i => i.name);
    if (links.length || more.length) out.push({ label, links, more });
  }
  return out;
}
const lkAny = (l, slot) => (l.links || []).length > 0 || lkClassGroups(l, slot).some(g => g.links.length);
const lkSchoolA = txt => '<a href="' + esc(gsUrl('#/school')) + '" data-lk="school">' + txt + '</a>';

/* ---------- the box in the lesson, under Materials ---------- */
function linksHtml(l) {
  const own = l.links || [], groups = lkClassGroups(l);
  const row = (x, mine) => '<div class="pl-file pl-link"><span class="pl-ft">' + LK_IC + '</span><a class="pl-fn" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer" title="Opens in a new tab"><b>' + esc(x.name) + '</b><span>' + esc(lkHost(x.url)) + '</span></a>' +
    (mine ? '<button class="btn sm ghost" data-lk="edit" data-id="' + esc(x.id) + '">Edit</button><button class="btn sm ghost" data-lk="rm" data-id="' + esc(x.id) + '" title="Remove" aria-label="Remove ' + esc(x.name) + '">×</button>' : '') + '</div>';
  return '<div class="pl-mats pl-links" id="lsLinks"><div class="pl-mats-h"><h3>Links</h3><span class="muted sp-small">Web pages to open while you plan or teach this lesson.</span><span class="sp"></span><button class="btn sm" data-lk="add">+ Add link</button></div>' +
    (own.length ? '<div class="pl-files">' + own.map(x => row(x, true)).join('') + '</div>' : groups.length ? '' : '<p class="muted sp-small" style="margin:4px 0 0">Nothing yet.</p>') +
    groups.map(g => '<div class="pl-lkh"><b>For ' + esc(g.label) + ', all year</b><span class="sp"></span>' + lkSchoolA('Change in School resources ↗') + '</div>' + (g.links.length ? '<div class="pl-files">' + g.links.map(x => row(x, false)).join('') + '</div>' : '') +
      (g.more.length ? '<p class="muted sp-small pl-lktip">' + (g.links.length ? 'Also for ' : 'For ') + esc(g.label) + ' in School resources: ' + esc(g.more.join(', ')) + '.</p>' : '')).join('') +
    (groups.length ? '' : '<p class="muted sp-small pl-lktip">For a link you use with a class all year, add it in ' + lkSchoolA('School resources') + ' and choose the class. It then shows here on every lesson for that class.</p>') + '</div>';
}
function linksRedraw() { const box = $('#lsLinks'); if (box && L.open) box.outerHTML = linksHtml(L.open); }
function linkSave(l) { if (!l.links.length) delete l.links; lessonChanged(false); linksRedraw(); }
// Add a link, or change one. Adding offers the links already kept in School resources, so nothing is typed twice.
function linkDlg(l, id) {
  const was = id ? (l.links || []).find(x => x.id === id) : null, school = was ? [] : lkSchool();
  let picked = 0, q = '';
  const has = url => (l.links || []).some(x => x.url === url);
  const list = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean), hits = school.filter(i => { const t = [i.name, i.group, i.url, i.note, ...i.cls].join(' ').toLowerCase(); return words.every(w => t.includes(w)); });
    return hits.length ? hits.map(i => '<button class="pl-lkpick" data-pick="' + esc(i.id) + '"' + (has(i.url) ? ' disabled' : '') + '><span class="pl-ft">' + LK_IC + '</span><span class="pl-fn"><b>' + esc(i.name) + '</b><span>' + esc([lkHost(i.url), i.group, ...i.cls].filter(Boolean).join(' · ')) + '</span></span><span class="pl-lkadd">' + (has(i.url) ? 'Added ✓' : '+ Add') + '</span></button>').join('')
      : '<p class="muted sp-small">Nothing in School resources matches “' + esc(q.trim()) + '”.</p>';
  };
  openDlg('<div class="bh"><h2>' + (was ? 'Edit the link' : 'Add a link') + '</h2></div><div class="bb pl-lkdlg">' +
    '<label class="ls-f">Web address<input id="lkU" class="btn" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Paste it from your browser’s address bar" value="' + esc(was ? was.url : '') + '"></label>' +
    '<label class="ls-f"><span>Name <span class="muted">(optional)</span></span><input id="lkN" class="btn" autocomplete="off" placeholder="What you want to call it" value="' + esc(was ? was.name : '') + '"></label>' +
    (school.length ? '<h3>Or pick from School resources</h3>' + (school.length > 6 ? '<input id="lkQ" class="btn" type="search" placeholder="Search your school links" aria-label="Search your school links">' : '') + '<div class="pl-lkpicks" id="lkPicks">' + list() + '</div>' : '') +
    '</div><div class="bf"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>' + (was ? 'Save' : 'Add') + '</button></div>', true);
  const box = $('#dlgBox');
  const save = () => {
    const raw = $('#lkU').value, url = lkUrl(raw), name = $('#lkN').value.trim().slice(0, 120);
    if (!raw.trim() && picked) return closeDlg();
    if (!url) { toast('That doesn’t look like a web address. Paste it from your browser’s address bar.', 5000); return $('#lkU').focus(); }
    l.links = l.links || [];
    if (was) { if (l.links.some(x => x !== was && x.url === url)) return toast('That link is already on this lesson'); was.url = url; was.name = name || lkHost(url); }
    else {
      if (has(url)) return toast('That link is already on this lesson');
      if (l.links.length >= LK_MAX) return toast('A lesson holds up to ' + LK_MAX + ' links');
      l.links.push({ id: lid(), name: name || lkHost(url), url });
    }
    closeDlg(); linkSave(l);
  };
  box.onclick = e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (e.target.closest('[data-ok]')) return save();
    const p = e.target.closest('[data-pick]'), it = p && school.find(i => i.id === p.dataset.pick); if (!it || has(it.url)) return;
    l.links = l.links || [];
    if (l.links.length >= LK_MAX) return toast('A lesson holds up to ' + LK_MAX + ' links');
    l.links.push({ id: lid(), name: it.name, url: it.url }); picked++;
    linkSave(l); $('#lkPicks').innerHTML = list();
    box.querySelector('[data-x]').textContent = 'Done';
  };
  box.oninput = e => { if (e.target.id === 'lkQ') { q = e.target.value; $('#lkPicks').innerHTML = list(); } };
  box.onkeydown = e => { if (e.key === 'Enter' && (e.target.id === 'lkU' || e.target.id === 'lkN')) { e.preventDefault(); save(); } };
}
// A click in the Links box. true: it was one of ours.
function linkClick(t) {
  const b = t.closest('[data-lk]'), l = L.open; if (!b || !l) return false;
  const a = b.dataset.lk, id = b.dataset.id;
  if (a === 'school') return false;   // a plain link to the grading page
  if (a === 'add') linkDlg(l);
  else if (a === 'edit') linkDlg(l, id);
  else if (a === 'rm') {
    const at = (l.links || []).findIndex(x => x.id === id); if (at < 0) return true;
    const was = l.links.splice(at, 1)[0]; linkSave(l);
    undoToast('Removed “' + was.name + '”', () => { l.links = l.links || []; l.links.splice(Math.min(at, l.links.length), 0, was); linkSave(l); });
  }
  return true;
}

/* ---------- while presenting: the lesson's links and the class's, one click away ---------- */
function prLinksAll() {
  const l = PR.l, out = [];
  if ((l.links || []).length) out.push({ label: 'This lesson', links: l.links });
  for (const g of lkClassGroups(l, PR.slot)) if (g.links.length) out.push({ label: g.label, links: g.links });
  return out;
}
function prLinks(open) {
  const m = $('#prLinks'), btn = PR.el.querySelector('[data-p="links"]'); if (!m) return;
  PR.links = !!open; m.hidden = !PR.links;
  if (btn) btn.setAttribute('aria-expanded', String(PR.links));
  if (!PR.links) return prWake();
  const groups = prLinksAll(); let n = 0;
  m.innerHTML = groups.length ? groups.map(g => '<h3>' + esc(g.label) + '</h3>' + g.links.map(x => { n++; return '<button data-url="' + esc(x.url) + '" title="Opens in a new tab">' + (n <= 9 ? '<kbd>' + n + '</kbd>' : '') + '<span class="tx"><b>' + esc(x.name) + '</b><small>' + esc(lkHost(x.url)) + '</small></span></button>'; }).join('')).join('')
    : '<h3>Links</h3><p>No links on this lesson yet. Add them under Links in the lesson.</p>';
}
// Opening one moves to a new tab. The stage stays as it is, to come back to: leaving full screen this way is not finishing.
function prLinkOpen(url) {
  if (!url) return;
  if (document.fullscreenElement) PR.keep = true;
  prLinks(false);
  window.open(url, '_blank', 'noopener,noreferrer');
}
const prLinkAt = n => prLinksAll().flatMap(g => g.links)[n - 1];
