/* ---------------- a newer copy of a download: her work carries over, per student and per file ---------------- */
// A download is known by its file names and sizes, so one new or changed file makes it look brand new. When a download
// with no work of its own opens, earlier work is looked through for an older copy of it. The work is copied in under the new
// download's id, and the older copy is never written to, so it opens just as it was. What's different is kept with the work:
// carry: { from, name, t, flags: { path: 'changed' | 'new' }, goneFiles, goneStudents, layouts, edits, unchecked }, which older saved work simply doesn't have.
const nfc = s => String(s).normalize('NFC');
const sameBytes = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const hasWork = d => !!d && !!d.s && Object.keys(d.s).length > 0;
const studentOf = path => { const parts = path.split('/').filter(Boolean); return parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, ''); };
// Is this the rubric page she gives every student, as this saved work named it? It isn't one of the download's files.
const rubricNamed = (d, path) => { const rp = d.setup && d.setup.rubricPage, base = path.split('/').pop(); return base === RUBRIC_NAME || (!!rp && !!rp.name && base === rp.name.replace(/[\\/]+/g, '-')); };

// Every download with saved work, newest copy of each, newest first.
async function earlierWork(id, keep = hasWork) {
  const all = new Map();
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.b.') && k !== id) all.set(k, store.get(k, null)); }
  try {
    const keys = await kdo('work', 'readonly', o => o.getAllKeys()) || [], vals = await kdo('work', 'readonly', o => o.getAll()) || [];
    keys.forEach((k, i) => { if (k !== id) all.set(k, newestWork(all.get(k), vals[i])); });
  } catch (e) { console.error(e); }
  return [...all].filter(([, d]) => keep(d)).sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
}
// The same names and sizes as a download already kept, so the same id, but some bytes differ. Her work stays as it is, the new bytes replace the kept ones, and those files are flagged.
async function changedInPlace(id, list) {
  const rec = await paperGet(id); if (!rec || !rec.entries) return [];
  const old = new Map(rec.entries.map(e => [nfc(e.path), e]));
  return list.filter(e => { const o = old.get(nfc(e.path)); return o && o.data && e.data && !sameBytes(o.data, e.data); }).map(e => e.path);
}
function flagInPlace(paths) {
  batch.carry ||= { from: null, name: '', t: Date.now(), flags: {}, goneFiles: [], goneStudents: [], layouts: [], edits: [], unchecked: false };
  for (const p of paths) batch.carry.flags[p] = 'changed';
  toast((paths.length === 1 ? 'One file is' : paths.length + ' files are') + ' different from the copy you opened before. Look for the ! in the list of students.', 7000);
  saveSoon();
}
// Old files against new ones. A file is the same one by its path, or by being the very same bytes under a new name in that student's folder.
function compareFiles(oldList, newList) {
  const byPath = new Map(newList.map(e => [nfc(e.path), e])), map = {}, flags = {}, used = new Set(), goneFiles = [];
  let same = 0, named = 0;
  const left = [];
  for (const o of oldList) {
    const n = byPath.get(nfc(o.path));
    if (!n) { left.push(o); continue; }
    used.add(n); map[o.path] = n.path; named++;
    if (sameBytes(o.data, n.data)) same++; else flags[n.path] = 'changed';
  }
  for (const o of left) {
    const n = newList.find(e => !used.has(e) && nfc(studentOf(e.path)) === nfc(studentOf(o.path)) && sameBytes(o.data, e.data));
    if (n) { used.add(n); map[o.path] = n.path; same++; } else goneFiles.push(o.path);
  }
  for (const n of newList) if (!used.has(n)) flags[n.path] = 'new';
  return { map, flags, goneFiles, same, named, nOld: oldList.length, nNew: newList.length };
}
// Papers aren't always kept (older saved work, or no room). Then only the names on her marks can be compared.
function compareNames(d, newList) {
  const byPath = new Map(newList.map(e => [nfc(e.path), e])), map = {}, goneFiles = [];
  let named = 0;
  for (const s of Object.values(d.s)) for (const part of [s.f, s.h, s.tr, s.r, s.sk]) for (const path of Object.keys(part || {})) {
    if (path in map || goneFiles.includes(path)) continue;
    const n = byPath.get(nfc(path));
    if (n) { map[path] = n.path; named++; } else if (!rubricNamed(d, path)) goneFiles.push(path);
  }
  return { map, flags: {}, goneFiles, same: 0, named, nOld: named + goneFiles.length, nNew: newList.length, unchecked: true };
}
// How sure: 2 is the same download, 1 is worth asking about, 0 is something else.
function matchLevel(c, linked) {
  const small = Math.max(1, Math.min(c.nOld, c.nNew));
  if (linked) return 2;
  if (c.unchecked) return c.named > 0 && c.named * 2 >= c.nOld ? 1 : 0;
  if (c.same * 2 >= small) return 2;
  return c.same || c.named * 2 >= small ? 1 : 0;
}
async function findEarlier(id, list, assignment) {
  if (hasWork(store.get(id, null)) || hasWork(await kget('work', id))) return null;   // it has work of its own: nothing to carry. A record with nothing in it is only from having opened it.
  if (list.some(e => hasGsTail(e.data))) return null;   // an exported file brings its own marks back
  const newKeys = new Set(list.map(e => nfc(studentOf(e.path)))), said = store.get('gs.carryNo', {})[id] || [];
  // Any student in common is enough to look closer, since scores can sit on roster students who have no paper in either copy. The files decide.
  const near = (await earlierWork(id)).filter(([k, d]) => !said.includes(k) && Object.keys(d.s).some(x => newKeys.has(nfc(x)))).sort(([a], [b]) => (assignment && assignment.batchId === b ? 1 : 0) - (assignment && assignment.batchId === a ? 1 : 0)).slice(0, 12);
  if (!near.length) return null;
  let best = null;
  for (const [k, d] of near) {
    const rec = await paperGet(k), m = keptMeta.get(k) || {}, linked = !!assignment && assignment.batchId === k;
    const c = rec && rec.entries ? compareFiles(rec.entries.filter(e => e.data && !houseFile(e.path)), list) : compareNames(d, list);
    const lvl = matchLevel(c, linked), score = lvl * 10 + c.same / Math.max(1, c.nOld + c.nNew);
    if (lvl && (!best || score > best.score)) best = { from: k, d, c, m, lvl, score, linked };
    if (linked) break;
  }
  if (!best) return null;
  if (best.lvl < 2 && !await askDlg(askText(best), { ok: 'Bring them over', cancel: 'Start fresh' })) {
    const no = store.get('gs.carryNo', {}); (no[id] ||= []).push(best.from); store.set('gs.carryNo', no);
    return null;
  }
  const f = best.m.asg && !assignment ? findItem(best.m.asg) : null;
  if (f) best.asg = f.it;
  return best;
}
function askText(e) {
  const name = e.m.name || 'A download you’ve worked on';
  return '“' + name + '”, which you’ve already worked on, may be an older copy of this download.\n\n' + (e.c.unchecked ? 'The student and file names match, but the older papers aren’t kept here to compare.' : e.c.named + ' of ' + e.c.nOld + ' files have the same names, and ' + e.c.same + (e.c.same === 1 ? ' is' : ' are') + ' exactly the same.') +
    '\n\nIs this a newer copy of the same assignment?\n\nBring them over copies your marks and scores into this one. Start fresh leaves this one empty. The older copy stays either way.';
}
// Paths in one of her per-file lists, moved to the new download's names.
// Her name covers and page lighting are kept by 'path|page' and 'student|path|page'. A file renamed in the newer download takes them along.
const mapBoxes = (o, map) => { if (!o) return o; const out = {}; for (const [k, v] of Object.entries(o)) { const at = k.lastIndexOf('|'), p = k.slice(0, at); out[(map[p] || p) + k.slice(at)] = v; } return out; };
const mapLit = (o, map) => { if (!o) return o; const out = {}; for (const [k, v] of Object.entries(o)) { const a = k.indexOf('|'), b = k.lastIndexOf('|'), p = k.slice(a + 1, b); out[k.slice(0, a + 1) + (map[p] || p) + k.slice(b)] = v; } return out; };
const mapPaths = (o, map) => { if (!o) return o; const out = {}; for (const [p, v] of Object.entries(o)) if (map[p]) out[map[p]] = v; return out; };
async function carryInto(e, list) {
  const { c, d, from } = e, keyOf = new Map(list.map(x => [nfc(studentOf(x.path)), studentOf(x.path)]));
  // Files she added herself aren't in the papers, and they come along (carryExtras), so their marks do too.
  const added = await idbDo('readonly', o => o.getAll(underId(from))).then(r => (r || []).filter(x => x.bid === from && x.key !== REF_KEY), () => []);
  for (const r of added) { c.map[r.path] ||= r.path; c.goneFiles = c.goneFiles.filter(p => p !== r.path); if (!keyOf.has(nfc(r.key))) keyOf.set(nfc(r.key), r.key); }
  const carry = { from, name: e.m.name || '', t: Date.now(), flags: c.flags, goneFiles: c.goneFiles, goneStudents: [], layouts: [], edits: [], unchecked: !!c.unchecked };
  const touched = st => Object.keys(c.flags).some(p => nfc(studentOf(p)) === nfc(st));
  // Someone with no folder of their own who was given a paper here comes over with it.
  for (const [p, k] of Object.entries(d.moved || {})) if (c.map[p] && !keyOf.has(nfc(k))) keyOf.set(nfc(k), k);
  const s = {};
  for (const [key, o] of Object.entries(d.s)) {
    const nk = keyOf.get(nfc(key));
    if (!nk) { carry.goneStudents.push(key); continue; }
    const x = { ...o, f: mapPaths(o.f, c.map) || {}, h: mapPaths(o.h, c.map), tr: mapPaths(o.tr, c.map), r: mapPaths(o.r, c.map), sk: mapPaths(o.sk, c.map), inc: mapPaths(o.inc, c.map) };
    // A hand-made page order can't know about pages that came or went, so a student whose files changed goes back to the plain order. Marks stay on their pages.
    if (o.L || o.o) {
      if (touched(key)) { delete x.L; delete x.o; if (o.L) carry.layouts.push(nk); }
      else {
        if (o.L) x.L = o.L.map(l => ({ ...l, file: l.file && (c.map[l.file] || l.file), pages: l.pages.map(([p, n]) => [c.map[p] || p, n]) }));
        if (o.o) x.o = o.o.map(i => i.startsWith('f:') && c.map[i.slice(2)] ? 'f:' + c.map[i.slice(2)] : i);
      }
    }
    s[nk] = x;
  }
  const moved = d.moved ? Object.fromEntries(Object.entries(d.moved).filter(([p]) => c.map[p]).map(([p, k]) => [c.map[p], keyOf.get(nfc(k)) || k])) : undefined;
  const share = d.share && { ...d.share, boxes: mapBoxes(d.share.boxes, c.map), checked: mapBoxes(d.share.checked, c.map) };
  // What she said about a page holds on the very same page, and a changed or new file's pages get their own look.
  const scan = c.unchecked || !d.scan ? undefined : mapPaths(d.scan, Object.fromEntries(Object.entries(c.map).filter(([, to]) => !c.flags[to])));
  batch.keptWork = { ...d, t: Date.now(), s, moved, carry, scan, share, lightPg: mapLit(d.lightPg, c.map) };
  batch.carry = carry;
  await carryExtras(from, carry);
  // The list of downloads says which one is the older copy.
  const m = keptMeta.get(from);
  if (m) { m.newer = batch.id; try { await kdo('meta', 'readwrite', o => o.put(m, from)); } catch (er) { console.error(er); } }
}
// No older copy with marks or scores to bring over, but she may have answered about the very same page in one: the same file, byte for byte. Nothing else comes, and nothing's said.
async function carryScan(id, list) {
  const said = d => !!d.scan && Object.values(d.scan).some(x => Object.values(x.rec || {}).some(r => r.off));
  for (const [k, d] of (await earlierWork(id, said)).slice(0, 12)) {
    const rec = await paperGet(k); if (!rec || !rec.entries) continue;
    const was = new Map(rec.entries.map(e => [nfc(e.path), e])), scan = {};
    for (const e of list) { const o = was.get(nfc(e.path)); if (o && d.scan[o.path] && sameBytes(o.data, e.data)) scan[e.path] = d.scan[o.path]; }
    if (Object.keys(scan).length) return scan;
  }
  return null;
}
// Files that sit beside the work under the download's id: late files and readings. Copied, never moved.
async function carryExtras(from, carry) {
  const id = batch.id, old = store.get('gs.rd.' + from, null);
  if (old) store.set('gs.rd.' + id, old);
  try {
    const recs = ((await idbDo('readonly', o => o.getAll(underId(from)))) || []).filter(r => r.bid === from);
    if (recs.length) await idbDo('readwrite', o => { for (const r of recs) o.put({ ...r, bid: id }, id + '|' + r.key + '|' + r.path); });
  } catch (er) { console.error(er); carry.extrasFailed = true; }
}
// The rubric page isn't in the download: each student is given it as the download opens. Once they have it, her marks and Word fill-ins
// on it follow them there, unless it's a different rubric now. Other Word edits come along here too, since they all sit together.
async function carryRubric({ c, d, from }) {
  const carry = batch.carry, id = batch.id, was = d.setup && d.setup.rubricPage, now = setup.rubricPage, sameRubric = !was || !now || was.id === now.id;
  const isRub = p => !c.map[p] && !c.goneFiles.includes(p) && rubricNamed(d, p);
  const stOf = key => batch.students.find(x => nfc(x.key) === nfc(key));
  const pageOf = key => { const st = stOf(key), f = sameRubric && st && st.files.find(f => f.virtual); return f ? f.path : null; };
  const left = new Set();
  for (const [key, o] of Object.entries(d.s)) {
    const to = pageOf(key), x = to && batch.keptWork.s[stOf(key).key];
    for (const part of ['f', 'h', 'tr', 'r', 'sk', 'inc']) for (const p of Object.keys(o[part] || {})) {
      if (c.map[p]) continue;
      if (x && isRub(p)) (x[part] ||= {})[to] = o[part][p];
      else if (!c.goneFiles.includes(p)) left.add(p);   // whatever couldn't come over gets named
    }
    if (!x) continue;
    if (x.L) x.L = x.L.map(l => ({ ...l, pages: l.pages.map(([p, n]) => [isRub(p) ? to : p, n]) }));
    if (x.o) x.o = x.o.map(i => i.startsWith('f:') && isRub(i.slice(2)) ? 'f:' + to : i);
  }
  try {
    const range = IDBKeyRange.bound(from + '|', from + '|￿');
    const keys = await kdo('edits', 'readonly', o => o.getAllKeys(range)) || [], vals = await kdo('edits', 'readonly', o => o.getAll(range)) || [];
    const put = [];
    keys.forEach((k, i) => {
      const path = k.slice(from.length + 1), to = isRub(path) ? pageOf((d.moved && d.moved[path]) || studentOf(path)) : c.map[path];
      if (to && !c.flags[to]) put.push([id + '|' + to, vals[i]]);   // edits on a file that has since changed would hide the new one
      else carry.edits.push(path);
    });
    if (put.length) await kdo('edits', 'readwrite', o => { for (const [k, v] of put) o.put(v, k); });
  } catch (er) { console.error(er); carry.extrasFailed = true; }
  carry.goneFiles.push(...left);
}
// Someone on the roster stays on the list even with no paper in this download, so their score stays with them. Marks on a paper stay with the older copy, and the paper is listed.
function carryRoster({ d }) {
  const carry = batch.carry;
  carry.goneStudents = carry.goneStudents.filter(key => {
    const st = rosterMatch([key]).get(key);
    if (!st || !st.gap || st.files.length) return true;
    st.grade = { ...st.grade, ...d.s[key].g };
    batch.keptWork.s[st.key] = { f: {}, g: st.grade, h: {} };
    return false;
  });
}
// Marks kept on pages a changed file no longer has. They stay saved, in this copy and the older one. Nothing can show them, so they get said.
const lostPages = f => f && f.numPages ? Object.keys(f.marks).map(Number).filter(p => p >= f.numPages && f.marks[p].length) : [];
const lostWords = f => { const l = lostPages(f); return (l.length === 1 ? 'A mark on page ' + (l[0] + 1) + ' has' : 'Marks on pages ' + l.map(p => p + 1).join(', ') + ' have') + ' no page in this file now.'; };
const carryLabel = (flag) => flag === 'new' ? 'New in this download' : 'Changed in this download';
function carryTag(f) {
  const flag = f && batch.carry && batch.carry.flags[f.path]; if (!flag) return '';
  return '<span class="carrytag" title="' + (flag === 'new' ? 'This file wasn’t in the older copy of this download.' : 'This file is different from the one in the older copy. Your marks came over: check they still sit in the right places.') + '">' + carryLabel(flag) + '</span><button class="link" style="font-size:13px" data-carryok="' + esc(f.path) + '" title="Take this flag off">Looks fine</button>' + (lostPages(f).length ? '<span style="font-size:13px;color:var(--warn)">' + lostWords(f) + ' The older copy still has them.</span>' : '') + (flag === 'new' ? lateLink(f) : '');
}
function carryPill(st) {
  if (!batch.carry) return '';
  const n = st.files.filter(f => batch.carry.flags[f.path]).length;
  return n ? '<span class="add" title="' + n + (n === 1 ? ' file is' : ' files are') + ' new or changed since the older copy">!</span>' : '';
}
$('#paper').addEventListener('click', e => {
  const b = e.target.closest('[data-carryok]'); if (!b || !batch || !batch.carry) return;
  delete batch.carry.flags[b.dataset.carryok];
  const tag = b.previousElementSibling; if (tag && tag.classList.contains('carrytag')) tag.remove();
  b.remove(); saveSoon(); renderList();
});
// What happened, in one box, when the download opens. Short lists are written out; long ones are counted. It opens by itself, so during anonymous grading it only counts.
async function carrySay() {
  const c = batch.carry; if (!c) return;
  const changed = batch.students.flatMap(st => st.files.filter(f => c.flags[f.path] === 'changed' && Object.keys(f.marks).length));
  for (const f of changed) await checkFile(f);
  if (batch.carry !== c) return;
  const n = Object.keys(batch.keptWork.s).length, paths = k => Object.keys(c.flags).filter(p => c.flags[p] === k);
  const anon = anonOn(), count = (items, what) => items.length ? [items.length + ' ' + what + (items.length === 1 ? '' : 's')] : [], names = (items, what) => anon ? count(items, what) : items;
  const list = (title, items) => items.length ? '<p style="margin:10px 0 2px"><b>' + title + '</b></p><ul style="margin:0;padding-left:18px">' + items.slice(0, 12).map(x => '<li style="overflow-wrap:anywhere">' + esc(x) + '</li>').join('') + (items.length > 12 ? '<li>and ' + (items.length - 12) + ' more</li>' : '') + '</ul>' : '';
  openDlg('<div class="bh"><h2>Your work came over</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="carryBox">' +
    '<p style="margin-top:0">This looks like a newer copy of <b>' + esc(c.name || 'a download you worked on') + '</b>. Marks and scores for <b>' + n + (n === 1 ? ' student' : ' students') + '</b> came over. The older copy hasn’t changed: it’s still on the start screen.</p>' +
    (c.unchecked ? '<p>The older papers aren’t kept in this browser, so which files changed couldn’t be checked. Have a look through them.</p>' : '') +
    list('Changed, so check your marks still sit in the right places:', names(paths('changed'), 'file')) +
    list('These have marks on pages they no longer have. The older copy still has them:', names(changed.filter(f => lostPages(f).length).map(f => f.name + ', page ' + lostPages(f).map(p => p + 1).join(', ')), 'file')) +
    list('New in this download:', names(paths('new'), 'file')) +
    list('Marked missing or excused, and has a new or changed file here. Check that still holds:', names(batch.students.filter(st => (st.grade.status === 'missing' || st.grade.status === 'excused') && st.files.some(f => c.flags[f.path])).map(st => st.key + ' (marked ' + st.grade.status + ')'), 'student')) +
    list('Not in this download (your work on them stays in the older copy):', names(c.goneFiles, 'file').concat(anon ? count(c.goneStudents, 'whole student') : c.goneStudents.map(k => k + ' (the whole student)'))) +
    list('Pages back in their plain order, because these students’ files changed:', names(c.layouts, 'student')) +
    list('Word edits left in the older copy, because the file changed or isn’t in this download:', names(c.edits, 'file')) +
    (c.extrasFailed ? '<p>Some late files, readings or Word edits couldn’t be copied over. They’re still in the older copy.</p>' : '') +
    '<p class="muted" style="margin-bottom:0;font-size:13px">Changed and new files are flagged at the top of the file and with ! in the list of students.</p></div><div class="bf">' + carryLateBtn() + '<button class="btn primary" data-close>OK</button></div>', true);
  $('#dlgBox').onclick = e => { const l = e.target.closest('[data-carrylate]'); if (l) carryLateDo(l); if (e.target.closest('[data-close]')) closeDlg(); };
}
