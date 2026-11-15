/* ---------------- School resources: links, files and notes about the school, on a page of their own (#/school) ---------------- */
// The handbook, the calendar, the bell schedule, the portals a teacher signs in to, forms, who to call: whatever gets looked up again
// and again. Nothing here is about a student, and nothing is fetched: a link is only an address that opens in a new tab.
// Where it is kept:
//   gs.school (localStorage)        the list: { items, order, ot }. It travels with the teacher’s work like a roster does: the folder's
//                                   library.json, every dated snapshot, the take-home file. Two copies are joined an item at a time
//                                   (schoolMerge in merge.js): the one changed later is kept.
//   grading-studio-school/files     the bytes of each file, by their SHA-256. Made only when the first file is added. In the folder
//                                   they sit in files/ beside the papers, and in a take-home file as frames of their own.
// An item: { id, at, kind: 'link' | 'file' | 'note', name, group, note, pin, url, file: { hash, size, type, name }, cls: [names] }.
// cls: the classes or courses it is for, by name ("English 10"). None: it is for the whole school. A link for a class shows on
// every lesson for that class in the Planner (planner/links.js reads this list; it never writes it).
// people: [{ id, at, role, name, email, note }] the people at the school a teacher works with: the principal, a coordinator, the
// head of department. Each is a spot on the page for a role (roles), filled in or left empty; to-dos can name them (todo.js, `ppl`).
// A deleted one stays as { id, at, gone: 1 }. roles: { list: [role names], at } the spots shown, when the teacher changed them;
// until then SCH_ROLES. Nothing about a person here is about a student: students are on the class lists.
// A deleted one stays as { id, at, gone: 1, file }, so it is deleted on the other computer too, and its bytes are kept for
// SCH_DAYS days: long enough for Undo, and for Go back in time to bring it back whole.
const SCH_KEY = 'gs.school', SCH_MAX = 50 * 1024 * 1024, SCH_DAYS = 14;
const SCH_IDEAS = ['Handbook and policies', 'Calendar and schedules', 'Portals', 'Forms', 'People and rooms'];
// The spots for people a school usually has. Each teacher changes the list for their own school (Change the spots…).
const SCH_ROLES = ['Principal', 'Vice principal', 'Subject group coordinator / department head', 'Curriculum coordinator', 'Dean of academic affairs'];
const SCH_IC = {
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-.9.9M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l.9-.9"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12.5h5M10 16h5"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10l-4 4H5zM15 19v-4h4M8.5 9.5h7M8.5 12.5h4"/></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/></svg>',
};
let schQ = '', schHave = new Set(), schDbP = null, schBusy = false, schAgain = '', schFor = '', schClasses = [], schClsAt = 0;

/* the list */
function schNow() {
  const v = store.get(SCH_KEY, null) || {};
  const out = { items: Array.isArray(v.items) ? v.items.filter(i => i && i.id) : [], order: Array.isArray(v.order) ? v.order.map(String) : [], ot: v.ot || 0 };
  if (Array.isArray(v.people)) out.people = v.people.filter(p => p && p.id);
  if (v.roles && Array.isArray(v.roles.list)) out.roles = { list: v.roles.list.map(String).filter(Boolean), at: v.roles.at || 0 };
  return out;
}
// Every change reads the list as it is stored now, so a change made in another tab a moment ago is never written over.
function schChange(fn) {
  const s = schNow(); fn(s);
  if (!store.set(SCH_KEY, s)) toast('This browser is out of room to keep that.');
  schRender();
}
const schLive = s => (s || schNow()).items.filter(i => !i.gone);
const schItem = id => schNow().items.find(i => i.id === id && !i.gone) || null;
const schKindOf = i => i.kind === 'file' && i.file ? 'file' : i.kind === 'link' && i.url ? 'link' : 'note';
// What was typed as a web address, tidied, or '' when it isn't one. Only http and https: nothing that could run on this page.
function schUrl(t) {
  let s = String(t || '').trim(); if (!s || /\s/.test(s)) return '';
  const bare = !/^[a-z][a-z0-9+.-]*:/i.test(s);
  if (bare) { if (!/\.[a-z]{2,}/i.test(s)) return ''; s = 'https://' + s; }
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname ? u.href : ''; } catch { return ''; }
}
const schHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
/* by class */
// A class's or a course's name as it is compared: letters and digits only, the way the Planner compares them.
const schNorm = n => String(n || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const schCls = i => (Array.isArray(i.cls) ? i.cls : []).map(String).filter(Boolean);
// The classes a resource can be for: the courses on the Planner's timetable (two sections of one course are one choice) and its
// classes that name no course. With no timetable, the classes here. Read from the Planner one way, like Today's timetable.
async function schClsLoad() {
  if (Date.now() - schClsAt < 4000) return; schClsAt = Date.now();
  let setup = null;
  try { const db = await planDb(false); if (db) { try { setup = await idbP(db.transaction('kv').objectStore('kv').get('setup')); } catch {} db.close(); } } catch {}
  let names = (setup && Array.isArray(setup.classes) ? setup.classes : []).map(c => String((c && (c.course || c.name)) || '').trim()).filter(Boolean);
  if (!names.length) names = lib.classes.map(c => c.name);
  const seen = new Set(), out = names.filter(n => { const k = schNorm(n); return k && !seen.has(k) && seen.add(k); });
  if (out.join('\n') !== schClasses.join('\n')) { schClasses = out; schRender(); }
}
// The classes that have something, in the timetable's order, then any the timetable no longer has.
function schClsUsed(items) {
  const by = new Map(); for (const i of items) for (const n of schCls(i)) if (!by.has(schNorm(n))) by.set(schNorm(n), n);
  const out = schClasses.filter(n => by.has(schNorm(n))), have = new Set(out.map(schNorm));
  for (const [k, n] of by) if (!have.has(k)) out.push(n);
  return out;
}
// The class the page is showing now, as the start of a new item's "For".
const schForNames = () => schFor ? schClsUsed(schLive()).filter(n => schNorm(n) === schFor) : [];
const schExt = n => { const m = /\.([a-z0-9]{1,6})$/i.exec(n || ''); return m ? m[1].toUpperCase() : 'File'; };
// The groups in the order the teacher keeps them: theirs first, then any others by name, then what has no group.
function schGroups(s, items) {
  const names = [...new Set(items.map(i => i.group || '').filter(Boolean))], at = n => { const i = s.order.indexOf(n); return i < 0 ? 1e9 : i; };
  names.sort((a, b) => at(a) - at(b) || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return items.some(i => !i.group) ? [...names, ''] : names;
}
const schSort = list => [...list].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' }));
// The hashes a list still needs: its files, and for SCH_DAYS the files of what was deleted. v: the list, or its stored text.
function schHashes(v, now) {
  let s = v; if (typeof v === 'string') { try { s = JSON.parse(v); } catch { s = null; } }
  const out = new Set(), t = now || Date.now();
  for (const i of (s && Array.isArray(s.items) ? s.items : [])) if (i && i.file && i.file.hash && (!i.gone || t - (i.at || 0) < SCH_DAYS * 864e5)) out.add(i.file.hash);
  return out;
}
// The files of what is on the list now, each once.
function schRefs() { const seen = new Set(), out = []; for (const i of schLive()) if (i.file && i.file.hash && !seen.has(i.file.hash)) { seen.add(i.file.hash); out.push(i.file); } return out; }

/* the bytes */
const schDb = () => schDbP ||= new Promise((res, rej) => { const r = indexedDB.open('grading-studio-school', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function schDo(mode, fn) { const db = await schDb(); return new Promise((res, rej) => { const tx = db.transaction('files', mode), q = fn(tx.objectStore('files')); tx.oncomplete = () => res(q && q.result); tx.onerror = tx.onabort = () => rej(tx.error); }); }
async function schPut(hash, data) { await schDo('readwrite', o => o.put({ data }, hash)); schHave.add(hash); }
async function schBytes(hash) { if (!schHave.has(hash)) return null; const r = await schDo('readonly', o => o.get(hash)).catch(() => null); return r && r.data ? r.data : null; }
// Which files this browser holds. The store is opened only if the list names a file, so a teacher who keeps only links never gets one.
const schReady = (async () => {
  if (!schHashes(schNow()).size) return;
  try {
    for (const k of (await schDo('readonly', o => o.getAllKeys())) || []) schHave.add(k);
    // bytes nothing names any more (deleted over SCH_DAYS ago) are let go
    const need = schHashes(schNow());
    if (tabLive()) for (const k of [...schHave]) if (!need.has(k)) { await schDo('readwrite', o => o.delete(k)); schHave.delete(k); }
  } catch (e) { console.error(e); }
})();
// Remove from this computer: the files go with everything else.
async function schRemoveAll() {
  try { if (schDbP) (await schDbP).close(); } catch {}
  schDbP = null; schHave.clear();
  await new Promise(res => { const r = indexedDB.deleteDatabase('grading-studio-school'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
}

/* the folder, and the take-home file */
// Each file on the list is in the browser and in the folder's files/: whichever has it gives it to the other. Called after the
// library is written (folder.js), so the list in the folder and the bytes beside it arrive together.
async function schFolderSync() {
  await schReady;
  const refs = schRefs(); if (!refs.length || !fld.root) return;
  const dir = await fld.root.getDirectoryHandle('files', { create: true });
  let came = false;
  for (const f of refs) {
    let there = false;
    try { there = (await (await dir.getFileHandle(f.hash + '.dat')).getFile()).size === f.size; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
    if (schHave.has(f.hash)) { if (!there) { const b = await schBytes(f.hash); if (b) await putBlob(b); } }
    else if (there) { try { await schPut(f.hash, await getBlob(f)); came = true; } catch (e) { if (!e.damaged) throw e; } }
  }
  if (came) schRender();
}
// A take-home file being brought in: the bytes this browser hasn't got. src.school(hash) reads one from the file.
async function schBring(src, B) {
  if (!src.school) return;
  await schReady;
  for (const h of Object.keys(B.school || {})) if (!schHave.has(h)) { const b = await src.school(h); if (b) await schPut(h, b); }
}

/* opening one */
// A PDF, a picture or plain text opens in a new tab. Anything else is handed over as a download, since a page made from it would
// run as part of this app.
const SCH_SHOW = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/;
async function schOpenFile(it, save) {
  await schReady;
  const b = await schBytes(it.file.hash);
  if (!b) return toast('“' + it.name + '” isn’t on this computer yet. Link your folder, or use Replace the file in its menu.', 7000);
  const type = it.file.type || '', blob = new Blob([b], { type: type || 'application/octet-stream' });
  if (save || !SCH_SHOW.test(type)) return saveBlob(it.file.name || it.name, blob);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
function schOpen(id) {
  const it = schItem(id); if (!it) return;
  const k = schKindOf(it);
  if (k === 'link') window.open(it.url, '_blank', 'noopener,noreferrer');
  else if (k === 'file') schOpenFile(it);
  else { if (routeNow().v !== 'school') go('#/school'); schForm({ item: it }); }
}

/* people: who is who at the school, as spots for roles */
const schPeople = s => ((s || schNow()).people || []).filter(p => !p.gone && p.name);
const schPerson = id => schPeople().find(p => p.id === id) || null;
const schRoles = s => { const r = (s || schNow()).roles; return r ? r.list : SCH_ROLES; };
const schRoleKey = r => String(r || '').toLowerCase().replace(/\s+/g, ' ').trim();
// Loose on purpose: something@somewhere.something, so a typo is caught and nothing else is refused.
const schMail = t => { t = String(t || '').trim().replace(/^mailto:/i, ''); return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(t) && t.length <= 120 ? t : ''; };
// A mailto: address, with the subject filled in when there is one.
const schMailto = (p, subject) => 'mailto:' + encodeURIComponent(p.email).replace(/%40/g, '@') + (subject ? '?subject=' + encodeURIComponent(subject) : '');
const schWho = p => p.name + (p.role ? ' · ' + p.role : '');
function schPeopleHtml(s) {
  const ppl = schPeople(s), roles = schRoles(s), seen = new Set();
  const nTodo = id => typeof tdItems === 'function' ? tdItems().filter(it => !it.done && Array.isArray(it.ppl) && it.ppl.includes(id)).length : 0;
  const one = p => {
    const n = nTodo(p.id), menu = '<button class="mitem" data-schpdo="edit">Edit…</button>' + (p.email ? '<button class="mitem" data-schpdo="copy">Copy the email address</button>' : '') + '<button class="mitem" data-schpdo="todo">Add a to-do for them…</button><button class="mitem" data-schpdo="del">Delete</button>';
    return '<div class="schprow" data-schp="' + esc(p.id) + '"><span class="schrole">' + esc(p.role || 'No role') + '</span><button class="schpname" data-schpdo="edit"><b>' + esc(p.name) + '</b>' + (p.note ? '<span class="schsub">' + esc(p.note) + '</span>' : '') + '</button>' +
      (n ? '<a class="schptd" href="#/todo" data-schptd="' + esc(p.id) + '">' + n + (n === 1 ? ' to-do' : ' to-dos') + '</a>' : '') +
      (p.email ? '<a class="icon schpmail" href="' + esc(schMailto(p)) + '" title="Email ' + esc(p.email) + '" aria-label="Email ' + esc(p.name) + '">' + SCH_IC.mail + '</a>' : '') +
      kmWrap('⋯', 'class="icon kdots" aria-label="More for ' + esc(p.name) + '" title="More"', menu, 'right') + '</div>';
  };
  let rows = '';
  for (const r of roles) {
    const k = schRoleKey(r), here = ppl.filter(p => schRoleKey(p.role) === k); seen.add(k);
    rows += here.length ? here.map(one).join('') : '<div class="schprow empty"><span class="schrole">' + esc(r) + '</span><button class="schpadd" data-schpadd="' + esc(r) + '">Add a name</button></div>';
  }
  rows += ppl.filter(p => !seen.has(schRoleKey(p.role))).map(one).join('');
  return '<section class="schsec schppl"><div class="schhead"><h2>People</h2><span class="schn">' + ppl.length + '</span><span class="sp"></span>' +
    '<button class="btn sm ghost" data-schroles>Change the spots…</button><button class="btn sm" data-schpadd="">Add someone</button></div>' +
    '<div class="schcard">' + (rows || '<p class="muted schpnone">No spots yet. Add someone, or Change the spots to list the roles at your school.</p>') + '</div>' +
    '<p class="muted schsay">Optional. Fill in only the people you work with. A to-do can name them, and the email button starts a message.</p></section>';
}
// Add or change a person. o: { person } to change one, { role } for an empty spot. done(person) runs after it is saved.
function schPersonForm(o, done) {
  o = o || {};
  const p = o.person || null, s = schNow(), roles = [...new Set([...schRoles(s), ...schPeople(s).map(x => x.role).filter(Boolean)])];
  openDlg('<div class="bh"><h2>' + (p ? 'Edit “' + esc(p.name) + '”' : o.role ? esc(o.role) : 'Add someone') + '</h2></div><div class="bb schform">' +
    '<div class="field"><label for="schPRole">Role</label><input type="text" id="schPRole" list="schPRoles" autocomplete="off" maxlength="80" value="' + esc(p ? p.role || '' : o.role || '') + '" placeholder="Pick one or type your school’s own"><datalist id="schPRoles">' + roles.map(r => '<option value="' + esc(r) + '">').join('') + '</datalist></div>' +
    '<div class="field"><label for="schPName">Name</label><input type="text" id="schPName" autocomplete="off" maxlength="80" value="' + esc(p ? p.name : '') + '" placeholder="As you would write it, like Ms. Okafor"></div>' +
    '<div class="field"><label for="schPMail">Email <span class="muted">(optional)</span></label><input type="email" id="schPMail" autocomplete="off" spellcheck="false" maxlength="120" value="' + esc(p ? p.email || '' : '') + '"></div>' +
    '<div class="field"><label for="schPNote">Note <span class="muted">(optional)</span></label><input type="text" id="schPNote" autocomplete="off" maxlength="200" value="' + esc(p ? p.note || '' : '') + '" placeholder="Room, extension, what to ask them about"></div>' +
    '<p class="tkerr" id="schErr" role="alert" hidden></p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>' + (p ? 'Save' : 'Add') + '</button></div>', true);
  const box = $('#dlgBox'), err = (t, sel) => { const el = $('#schErr'); el.textContent = t; el.hidden = false; $(sel).focus(); };
  const save = () => {
    const role = $('#schPRole').value.replace(/\s+/g, ' ').trim().slice(0, 80), name = $('#schPName').value.replace(/\s+/g, ' ').trim().slice(0, 80), raw = $('#schPMail').value.trim(), note = $('#schPNote').value.trim().slice(0, 200);
    if (!name) return err('Write their name first.', '#schPName');
    const email = raw ? schMail(raw) : ''; if (raw && !email) return err('That doesn’t look like an email address.', '#schPMail');
    const got = { role, name, email, note, at: Date.now() };
    for (const k of ['email', 'note', 'role']) if (!got[k]) delete got[k];
    let me = null;
    closeDlg();
    schChange(s => { s.people = s.people || []; const x = p && s.people.find(q => q.id === p.id); if (x) { for (const k of ['role', 'email', 'note']) delete x[k]; Object.assign(x, got); me = x; } else s.people.push(me = { id: 'sp' + uid(), ...got }); });
    if (typeof todoRender === 'function') todoRender();
    if (done && me) done(me);
  };
  box.onclick = e => { if (e.target.closest('[data-cancel]')) return closeDlg(); if (e.target.closest('[data-ok]')) save(); };
  box.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } };
  const first = $(o.role || p ? '#schPName' : '#schPRole'); first.focus(); first.select();
}
function schPersonDelete(id) {
  const was = schPerson(id); if (!was) return;
  schChange(s => { const i = (s.people || []).findIndex(x => x.id === id); if (i >= 0) s.people[i] = { id, at: Date.now(), gone: 1 }; });
  if (typeof todoRender === 'function') todoRender();
  toastDo('Deleted “' + was.name + '”. To-dos that named them keep their words.', 'Undo', () => { schChange(s => { const i = (s.people || []).findIndex(x => x.id === id); if (i >= 0) s.people[i] = { ...was, at: Date.now() }; }); if (typeof todoRender === 'function') todoRender(); });
}
// The spots: one role a line, in the order to show them. Empty brings back the usual ones.
function schRolesEdit() {
  openDlg('<div class="bh"><h2>Spots for people</h2></div><div class="bb schform">' +
    '<div class="field"><label for="schRolesIn">One role a line, in the order to show them</label><textarea id="schRolesIn" rows="8" spellcheck="false">' + esc(schRoles().join('\n')) + '</textarea></div>' +
    '<p class="muted schsay">Use your school’s own words, like MYP coordinator or Head of year. Someone already filled in keeps their spot even when their role is not on the list. Leave it empty for the usual ones.</p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  const box = $('#dlgBox');
  box.onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const list = [...new Set($('#schRolesIn').value.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean))].slice(0, 30);
    closeDlg();
    schChange(s => { s.roles = { list: list.length ? list : SCH_ROLES.slice(), at: Date.now() }; });
  };
  $('#schRolesIn').focus();
}

/* the page */
function schRowHtml(it) {
  const k = schKindOf(it), here = k !== 'file' || schHave.has(it.file.hash);
  const cls = schCls(it), sub = [k === 'link' ? schHost(it.url) : k === 'file' ? schExt(it.file.name) + ' · ' + fmtSize(it.file.size) + (here ? '' : ' · not on this computer yet') : '', cls.length ? 'For ' + cls.join(', ') : ''].filter(Boolean).join(' · ');
  const body = '<span class="schic ' + k + '">' + SCH_IC[k] + '</span><span class="schtx"><b>' + esc(it.name) + '</b>' + (sub ? '<span class="schsub">' + esc(sub) + '</span>' : '') + (it.note ? '<span class="schnote">' + esc(it.note) + '</span>' : '') + '</span>';
  const open = k === 'link' ? '<a class="schopen" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer" title="Opens in a new tab">' + body + '</a>'
    : '<button class="schopen" data-schopen title="' + (k === 'file' ? 'Open the file' : 'Edit this note') + '">' + body + '</button>';
  const menu = '<button class="mitem" data-schdo="edit">Edit…</button>' +
    (k === 'link' ? '<button class="mitem" data-schdo="copy">Copy the link</button>' : '') +
    (k === 'file' ? '<button class="mitem" data-schdo="save">Download</button><button class="mitem" data-schdo="again">Replace the file…</button>' : '') +
    '<button class="mitem" data-schdo="del">Delete</button>';
  return '<div class="schrow" data-sch="' + esc(it.id) + '">' + open +
    '<button class="icon schpin" data-schpin aria-pressed="' + !!it.pin + '" title="' + (it.pin ? 'Kept at the top. Click to stop' : 'Keep at the top') + '" aria-label="' + (it.pin ? 'Stop keeping ' : 'Keep ') + esc(it.name) + ' at the top">' + SCH_IC.star + '</button>' +
    kmWrap('⋯', 'class="icon kdots" aria-label="More for ' + esc(it.name) + '" title="More"', menu, 'right') + '</div>';
}
function schRender() {
  if (!shellReady) return;
  const r = routeNow(); if (r.v !== 'school' || batch) return;
  const s = schNow(), all = schLive(s), words = schQ.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = i => { const t = [i.name, i.group, i.note, i.url, i.file && i.file.name, ...schCls(i)].filter(Boolean).join(' ').toLowerCase(); return words.every(w => t.includes(w)); };
  schClsLoad();
  const used = schClsUsed(all); if (schFor && !used.some(n => schNorm(n) === schFor)) schFor = '';
  const mine = schFor ? all.filter(i => schCls(i).some(n => schNorm(n) === schFor)) : all;
  const items = words.length ? mine.filter(hit) : mine, groups = schGroups(s, items), named = groups.filter(Boolean);
  $('#schFind').hidden = all.length < 6 && !schQ;
  let h = schQ.trim() ? '' : schPeopleHtml(s);
  if (!all.length) {
    h += '<div class="schnone"><h2>Keep what you look up again and again in one place</h2>' +
      '<p>The staff handbook, the school calendar, the bell schedule, the portals you sign in to, forms, who to call about what. Add a link when the school keeps it online, a file when you only have the file, or a short note of your own.</p>' +
      '<p class="muted">Everything here stays on this computer with the rest of your work. Drop files anywhere on this page, or paste a web address.</p></div>';
  } else {
    // by class: everything, or only what is for one class
    if (used.length) h += '<div class="schfor" role="group" aria-label="Show">' + [['', 'Everything'], ...used.map(n => [schNorm(n), n])].map(([k, n]) => '<button class="schforb" data-schfor="' + esc(k) + '" aria-pressed="' + (k === schFor) + '">' + esc(n) + '</button>').join('') + '</div>';
    if (!items.length) h += '<p class="muted schnohit">Nothing here matches “' + esc(schQ.trim()) + '”.</p>';
  }
  if (all.length && items.length) {
    const pins = words.length ? [] : schSort(mine.filter(i => i.pin));
    if (pins.length) h += '<div class="schpins" aria-label="Kept at the top">' + pins.map(i => { const k = schKindOf(i), inner = '<span class="schic ' + k + '">' + SCH_IC[k] + '</span><span>' + esc(i.name) + '</span>'; return k === 'link' ? '<a class="schchip" href="' + esc(i.url) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>' : '<button class="schchip" data-schchip="' + esc(i.id) + '">' + inner + '</button>'; }).join('') + '</div>';
    for (const g of groups) {
      const list = schSort(items.filter(i => (i.group || '') === g)), gi = named.indexOf(g);
      const menu = g ? kmWrap('⋯', 'class="icon kdots" aria-label="More for the group ' + esc(g) + '" title="More"',
        '<button class="mitem" data-schg="rename">Rename the group…</button>' + (gi > 0 ? '<button class="mitem" data-schg="up">Move up</button>' : '') + (gi < named.length - 1 ? '<button class="mitem" data-schg="down">Move down</button>' : ''), 'right') : '';
      h += '<section class="schsec" data-schgroup="' + esc(g) + '">' + (g || named.length ? '<div class="schhead"><h2>' + esc(g || 'Other') + '</h2><span class="schn">' + list.length + '</span><span class="sp"></span>' + menu + '</div>' : '') +
        '<div class="schcard">' + list.map(schRowHtml).join('') + '</div></section>';
    }
    const files = schRefs(), size = files.reduce((a, f) => a + (f.size || 0), 0), w = whereSay();
    h += '<p class="muted schfoot">' + all.length + (all.length === 1 ? ' thing' : ' things') + ' kept here' + (files.length ? ', ' + files.length + (files.length === 1 ? ' file' : ' files') + ' (' + fmtSize(size) + ')' : '') + '. ' + esc(w.safe ? w.text : 'Only in this browser, like the rest of your work, until you choose a folder') + '.</p>';
  }
  const box = $('#schList'); if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
}

/* adding and changing */
// One box for all three kinds. o: { kind } for a new one, { item } to change one, { files } for files just chosen or dropped, { url } for a pasted address.
function schForm(o) {
  const it = o.item || null, kind = it ? schKindOf(it) : o.files ? 'file' : o.kind, files = o.files || [], s = schNow();
  const groups = [...new Set([...schGroups(s, schLive(s)).filter(Boolean), ...SCH_IDEAS])];
  const title = it ? 'Edit “' + it.name + '”' : kind === 'link' ? 'Add a link' : kind === 'note' ? 'Add a note' : files.length === 1 ? 'Add a file' : 'Add ' + files.length + ' files';
  const one = it || files.length <= 1;
  // the classes it can be for: the timetable's, and any it is already for
  const on = new Set((it ? schCls(it) : o.cls || []).map(schNorm)), clsAll = [...schClasses, ...(it ? schCls(it) : []).filter(n => !schClasses.some(c => schNorm(c) === schNorm(n)))];
  openDlg('<div class="bh"><h2>' + esc(title) + '</h2></div><div class="bb schform">' +
    (kind === 'link' ? '<div class="field"><label for="schUrl">Web address</label><input type="text" id="schUrl" inputmode="url" autocomplete="off" spellcheck="false" value="' + esc(it ? it.url : o.url || '') + '" placeholder="Paste it from your browser’s address bar"></div>' : '') +
    (one ? '<div class="field"><label for="schName">Name</label><input type="text" id="schName" autocomplete="off" value="' + esc(it ? it.name : files[0] ? files[0].name.replace(/\.[^.]+$/, '') : '') + '" placeholder="' + (kind === 'link' ? 'e.g. Staff handbook' : kind === 'note' ? 'e.g. Who to call' : '') + '"></div>'
      : '<div class="field"><label>Files</label><ul class="schfiles">' + files.map(f => '<li>' + esc(f.name) + ' <span class="muted">' + fmtSize(f.size) + '</span></li>').join('') + '</ul></div>') +
    '<div class="field"><label for="schGroup">Group <span class="muted">(optional)</span></label><input type="text" id="schGroup" list="schGroups" autocomplete="off" value="' + esc(it ? it.group || '' : o.group || '') + '" placeholder="Pick one or type a new one"><datalist id="schGroups">' + groups.map(g => '<option value="' + esc(g) + '">').join('') + '</datalist></div>' +
    '<div class="field"><label for="schNote">' + (kind === 'note' ? 'Note' : 'Note <span class="muted">(optional)</span>') + '</label><textarea id="schNote" rows="' + (kind === 'note' ? 6 : 2) + '" placeholder="' + (kind === 'note' ? 'Room numbers, phone extensions, how something is done here' : 'What it is for, or where to look in it') + '">' + esc(it ? it.note || '' : '') + '</textarea></div>' +
    (clsAll.length ? '<div class="field"><label id="schClsL">For a class <span class="muted">(optional)</span></label><div class="schcls" role="group" aria-labelledby="schClsL">' + clsAll.map(n => '<label class="ctag"><input type="checkbox" data-schcls value="' + esc(n) + '"' + (on.has(schNorm(n)) ? ' checked' : '') + '>' + esc(n) + '</label>').join('') + '</div>' +
      '<p class="muted schsay">' + (kind === 'link' ? 'A link for a class shows on every lesson for that class in the Planner, all year.' : 'Leave them empty when it is for the whole school.') + '</p></div>' : '') +
    (kind === 'file' && !it ? '<p class="muted schsay">A copy of ' + (files.length === 1 ? 'the file' : 'each file') + ' is kept with your work. If the school keeps it online, a link stays up to date by itself.</p>' : '') +
    '<p class="tkerr" id="schErr" role="alert" hidden></p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>' + (it ? 'Save' : 'Add') + '</button></div>', true);
  const box = $('#dlgBox'), err = (t, sel) => { const el = $('#schErr'); el.textContent = t; el.hidden = false; if (sel) $(sel).focus(); };
  const save = async () => {
    const name = one ? $('#schName').value.trim() : '', group = $('#schGroup').value.trim().slice(0, 60), note = $('#schNote').value.trim(), now = Date.now();
    const cls = [...box.querySelectorAll('[data-schcls]:checked')].map(c => c.value), forIt = cls.length ? { cls } : {};
    let url = '';
    if (kind === 'link') { url = schUrl($('#schUrl').value); if (!url) return err('That doesn’t look like a web address. Paste it from your browser’s address bar.', '#schUrl'); }
    if (kind === 'note' && !note) return err('Write the note first.', '#schNote');
    const named = name || (kind === 'link' ? schHost(url) : kind === 'note' ? note.split('\n')[0].slice(0, 60) : '');
    if (it) { closeDlg(); return schChange(s => { const x = s.items.find(i => i.id === it.id); if (x) { Object.assign(x, { name: named || x.name, group, note, at: now }, kind === 'link' ? { url } : {}, forIt); if (!cls.length) delete x.cls; } }); }
    if (kind !== 'file') { closeDlg(); return schChange(s => { s.items.push({ id: uid(), at: now, kind, name: named, group, note, ...(kind === 'link' ? { url } : {}), ...forIt }); }); }
    box.querySelector('[data-ok]').disabled = true;
    const got = await schTake(files);
    closeDlg();
    if (!got.length) return;
    schChange(s => { for (const { f, file } of got) s.items.push({ id: uid(), at: Date.now(), kind: 'file', name: files.length === 1 && named ? named : f.name.replace(/\.[^.]+$/, '') || f.name, group, note, file, ...forIt }); });
    toast(got.length === 1 ? 'Added.' : 'Added ' + got.length + ' files.');
  };
  box.onclick = e => { if (e.target.closest('[data-cancel]')) return closeDlg(); if (e.target.closest('[data-ok]')) save(); };
  box.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); } };
  const first = $(kind === 'link' && !(it || o.url) ? '#schUrl' : one ? '#schName' : '#schGroup'); first.focus(); if (first.select) first.select();
}
// Files just chosen: too big ones are said and left out, the rest are read and their bytes kept. Gives [{ f, file }] for the list.
async function schTake(files) {
  await schReady;
  const big = files.filter(f => f.size > SCH_MAX), ok = files.filter(f => f.size <= SCH_MAX && f.size > 0), got = [];
  try {
    for (const f of ok) {
      const data = new Uint8Array(await f.arrayBuffer()), hash = await shaOf(data);
      if (!schHave.has(hash)) await schPut(hash, data);
      got.push({ f, file: { hash, size: data.length, type: f.type || '', name: f.name } });
    }
  } catch (e) { console.error(e); toast(e && e.name === 'QuotaExceededError' ? 'This browser is out of room, so that file wasn’t added.' : 'That file couldn’t be read, so it wasn’t added.', 6000); }
  if (big.length) sayDlg((big.length === 1 ? '“' + big[0].name + '” is' : big.length + ' of those files are') + ' larger than ' + fmtSize(SCH_MAX) + ', so ' + (big.length === 1 ? 'it wasn’t' : 'they weren’t') + ' added. For a file that size, add a link to where the school keeps it.');
  return got;
}
function schPick(files) {
  const list = [...files].filter(f => f && f.name); if (!list.length) return;
  if (!schAgain) return schForm({ files: list, cls: schForNames() });
  const id = schAgain; schAgain = '';   // Replace the file: the same item, new bytes
  return schTake(list.slice(0, 1)).then(got => { if (!got.length) return; schChange(s => { const x = s.items.find(i => i.id === id && !i.gone); if (x) { x.file = got[0].file; x.at = Date.now(); } }); toast('Replaced.'); });
}
function schDelete(id) {
  const was = schItem(id); if (!was) return;
  schChange(s => { const i = s.items.findIndex(x => x.id === id); if (i >= 0) s.items[i] = { id, at: Date.now(), gone: 1, ...(was.file ? { file: { hash: was.file.hash, size: was.file.size } } : {}) }; });
  toastDo('Deleted “' + was.name + '”.', 'Undo', () => schChange(s => { const i = s.items.findIndex(x => x.id === id); if (i >= 0) s.items[i] = { ...was, at: Date.now() }; }));
}
async function schGroupDo(g, what) {
  if (what === 'rename') {
    const v = await askTextDlg('A new name for the group “' + g + '”', g, { ok: 'Rename' }), to = v == null ? '' : v.trim().slice(0, 60);
    if (!to || to === g) return;
    return schChange(s => { const now = Date.now(); for (const i of s.items) if (!i.gone && i.group === g) { i.group = to; i.at = now; } const at = s.order.indexOf(g); if (at >= 0) { s.order[at] = to; s.ot = now; } });
  }
  schChange(s => {
    const names = schGroups(s, schLive(s)).filter(Boolean), i = names.indexOf(g), j = i + (what === 'up' ? -1 : 1);
    if (i < 0 || j < 0 || j >= names.length) return;
    [names[i], names[j]] = [names[j], names[i]]; s.order = names; s.ot = Date.now();
  });
}
$('#vSchool').addEventListener('click', e => {
  const add = e.target.closest('[data-schadd]');
  if (add) { if (add.dataset.schadd === 'file') { schAgain = ''; return $('#schIn').click(); } return schClsLoad().then(() => schForm({ kind: add.dataset.schadd, cls: schForNames() })); }
  const padd = e.target.closest('[data-schpadd]'); if (padd) return schPersonForm({ role: padd.dataset.schpadd });
  if (e.target.closest('[data-schroles]')) return schRolesEdit();
  const ptd = e.target.closest('[data-schptd]'); if (ptd) { e.preventDefault(); return todoShowPerson(ptd.dataset.schptd); }
  const prow = e.target.closest('[data-schp]'), pdo = e.target.closest('[data-schpdo]');
  if (prow && pdo) {
    const p = schPerson(prow.dataset.schp); if (!p) return;
    const what = pdo.dataset.schpdo;
    if (what === 'edit') return schPersonForm({ person: p });
    if (what === 'del') return schPersonDelete(p.id);
    if (what === 'todo') return todoForPerson(p.id);
    if (what === 'copy') return navigator.clipboard.writeText(p.email).then(() => toast('Email address copied.'), () => toast('The address couldn’t be copied here.'));
    return;
  }
  const fb = e.target.closest('[data-schfor]'); if (fb) { schFor = fb.dataset.schfor; return schRender(); }
  const chip = e.target.closest('[data-schchip]'); if (chip) return schOpen(chip.dataset.schchip);
  const gdo = e.target.closest('[data-schg]'); if (gdo) return schGroupDo(gdo.closest('[data-schgroup]').dataset.schgroup, gdo.dataset.schg);
  const row = e.target.closest('[data-sch]'); if (!row) return;
  const id = row.dataset.sch, it = schItem(id); if (!it) return;
  if (e.target.closest('[data-schopen]')) return schOpen(id);
  if (e.target.closest('[data-schpin]')) return schChange(s => { const x = s.items.find(i => i.id === id); if (x) { if (x.pin) delete x.pin; else x.pin = 1; x.at = Date.now(); } });
  const b = e.target.closest('[data-schdo]'); if (!b) return;
  const what = b.dataset.schdo;
  if (what === 'edit') schForm({ item: it });
  else if (what === 'del') schDelete(id);
  else if (what === 'save') schOpenFile(it, true);
  else if (what === 'again') { schAgain = id; $('#schIn').click(); }
  else if (what === 'copy') navigator.clipboard.writeText(it.url).then(() => toast('Link copied.'), () => toast('The link couldn’t be copied here. Open it and copy its address.'));
});
$('#schIn').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; schPick(fs); };
$('#schQ').addEventListener('input', e => { schQ = e.target.value; schRender(); });
$('#schQ').addEventListener('keydown', e => { if (e.key === 'Escape' && schQ) { e.preventDefault(); e.target.value = ''; schQ = ''; schRender(); } });
// On this page a dropped file is a school file, not student work, and a dropped or pasted web address is a new link. These run
// before the page-wide drop that opens student work (wiring.js), and stop it.
const schOn = () => !batch && shellReady && routeNow().v === 'school' && $('#dlg').hidden && !$('#findDlg') && !$('#askDlg');
const schDragHas = e => !!e.dataTransfer && [...(e.dataTransfer.types || [])].some(t => t === 'Files' || t === 'text/uri-list');
for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, e => { if (!schOn() || !schDragHas(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; $('#vSchool').classList.add('over'); }, true);
document.addEventListener('dragleave', e => { if (!e.relatedTarget) $('#vSchool').classList.remove('over'); }, true);
document.addEventListener('drop', e => {
  $('#vSchool').classList.remove('over');
  if (!schOn() || !schDragHas(e)) return;
  e.preventDefault(); e.stopPropagation();
  if (e.dataTransfer.files.length) { schAgain = ''; return schPick(e.dataTransfer.files); }
  const u = schUrl((e.dataTransfer.getData('text/uri-list') || '').split(/\r?\n/).find(l => l && !l.startsWith('#')));
  if (u) schForm({ kind: 'link', url: u, cls: schForNames() });
}, true);
document.addEventListener('paste', e => {
  if (!schOn() || e.target.closest('input, textarea, [contenteditable]')) return;
  const fs = [...((e.clipboardData && e.clipboardData.files) || [])];
  if (fs.length) { e.preventDefault(); schAgain = ''; return schPick(fs); }
  const u = schUrl((e.clipboardData && e.clipboardData.getData('text/plain')) || '');
  if (u) { e.preventDefault(); schForm({ kind: 'link', url: u, cls: schForNames() }); }
});
// Another tab changed the list.
window.addEventListener('storage', e => { if (e.key === SCH_KEY && (!e.storageArea || e.storageArea === localStorage)) schRender(); });
schReady.then(() => { schClsLoad(); schRender(); });

/* Find anything: every resource by its name */
const SCH_KIND_SAY = { link: 'Link', file: 'File', note: 'Note' };
const schFindRows = () => [...schPeople().map(p => ({ group: 'School resources', label: p.name, sub: [p.role, p.email].filter(Boolean).join(' · ') || 'Person', key: '', words: [p.role, p.email, p.note].filter(Boolean).join(' '), run: () => { go('#/school'); schPersonForm({ person: p }); } })), ...schSort(schLive()).map(i => { const k = schKindOf(i); return { group: 'School resources', label: i.name, sub: SCH_KIND_SAY[k] + (i.group ? ' · ' + i.group : k === 'link' ? ' · ' + schHost(i.url) : '') + (schCls(i).length ? ' · For ' + schCls(i).join(', ') : ''), key: '', words: [i.url, i.note, i.file && i.file.name, ...schCls(i)].filter(Boolean).join(' '), run: () => schOpen(i.id) }; })];
Object.assign(window.__gs, { schNow, schPeople, schMail, schMailto, SCH_ROLES, schHashes, schUrl, schoolMerge, schHave: async () => { await schReady; return [...schHave].sort(); } });
