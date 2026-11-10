/* ---------------- keeping work in this browser ---------------- */
let saveT, saveDue = false;
function saveSoon() { groupSync(); clearTimeout(saveT); saveSeq++; saveDue = true; saveT = setTimeout(saveNow, 500); const el = $('#saveState'); if (el && batch) el.textContent = 'Saving…'; }
function saveNow(leaving) {
  if (!batch || !tabLive()) return;
  clearTimeout(saveT); saveDue = false;
  if (batch.revs && tabForgot(batch)) return tabLetGo();
  const data = { t: Date.now(), carry: batch.carry, cur, ck: batch.students[cur] && batch.students[cur].key, setup, cls: batch.classId, share: batch.share, drive: batch.drive, light: batch.light, lightOpt: batch.lightOpt, lightPg: batch.lightPg, lightPgL: batch.lightPgL, anon: batch.anon, moved: batch.moved, removed: batch.removed, refSkip: batch.refSkip, quiz: batch.quiz, groups: batch.groups && batch.groups.length ? batch.groups : undefined, returned: batch.returned || undefined, read: (batch.read = paperReads()), s: {} };
  for (const st of batch.students) {
    const f = {};
    for (const fl of st.files.concat(st.gone || [])) if (Object.values(fl.marks).some(a => a.length)) f[fl.path] = fl.marks;   // a removed file keeps its marks for Bring back
    const g = st.grade;
    const hb = {};
    for (const fl of st.files) if (fl.hand) hb[fl.path] = fl.hand;
    const inc = st.inc && Object.keys(st.inc).length ? st.inc : undefined;
    const tr = {}; for (const fl of st.files) if (fl.tr) tr[fl.path] = fl.tr;
    const im = {}, imn = []; for (const fl of st.files) { if (impHas(fl)) im[fl.path] = fl.imp; if (fl.impNo) imn.push(fl.path); }
    const rt = scanOwn(st, 'rot', 'didTurn', rotToSave), sk = scanOwn(st, 'skew', 'didSkew');
    if (Object.keys(im).length || imn.length || Object.keys(rt).length || Object.keys(sk).length || Object.keys(tr).length || Object.keys(hb).length || st.layout || st.forder || inc || Object.keys(f).length || g.rubric.some(v => v != null) || g.points !== '' || g.comment || hasSheet(g) || g.status || g.at)
      data.s[st.key] = { f, g, h: hb, L: st.layout || undefined, Lp: st.layout ? 1 : undefined, o: st.forder || undefined, inc, tr: Object.keys(tr).length ? tr : undefined, r: Object.keys(rt).length ? rt : undefined, sk: Object.keys(sk).length ? sk : undefined, im: Object.keys(im).length ? im : undefined, imn: imn.length ? imn : undefined };
  }
  data.scan = scanSave();
  // Someone with work saved who isn't on the list just now (no paper, and not on the roster here) keeps it: they'd only be off the list until the roster comes.
  const listed = new Set(batch.students.map(st => st.key));
  for (const [k, r] of Object.entries(batch.lastS || {})) if (!listed.has(k)) data.s[k] = r;
  batch.lastS = data.s;
  if (!saveBad.has(batch.id)) batch.wasOk = batch.revs;   // a change whose save failed still has to count as this tab's own, until one works
  const was = batch.wasOk;
  stampWork(batch, data);
  if (tabsBehind(batch)) return saveBehind(batch, data, was, leaving);
  return writeWork(batch, data);
}
function restore() {
  const data = newestWork(store.get(batch.id, null), batch.keptWork);
  if (!data) return;
  if (data.carry) batch.carry = data.carry;
  if (data.setup && data.setup.spot) setup.spot = data.setup.spot;
  batch.moved = data.moved || {};
  // Someone with no folder is only here because of the work on them: a paper that was moved to them, or a score, comment or status. They come back before anything is put on them.
  for (const [path, key] of Object.entries(batch.moved)) {
    if (!batch.students.some(s => s.key === key) && batch.students.some(s => s.files.some(f => f.path === path))) batch.students.push(gapStudent(key));
    moveFileNow(path, key);
  }
  for (const [key, s] of Object.entries(data.s)) if (gradeHasWork(s.g) && !batch.students.some(st => st.key === key)) batch.students.push(gapStudent(key));
  let n = 0;
  for (const st of batch.students) {
    const s = data.s[st.key]; if (!s) continue;
    if (s.o) st.forder = s.o;
    st.grade = { rubric: [], points: '', comment: '', ...s.g };
    for (const fl of st.files) { if (s.f[fl.path]) fl.marks = s.f[fl.path]; if (s.h && s.h[fl.path]) fl.hand = s.h[fl.path]; if (s.tr && s.tr[fl.path]) fl.tr = s.tr[fl.path]; if (s.r && s.r[fl.path]) fl.rot = s.r[fl.path]; if (s.sk && s.sk[fl.path]) fl.skew = s.sk[fl.path]; if (s.im && s.im[fl.path]) fl.imp = s.im[fl.path]; if (s.imn && s.imn.includes(fl.path)) fl.impNo = 1; }
    if (s.L) { st.layout = s.L.map(d => ({ ...d, pages: d.pages.filter(([path]) => st.files.some(f => f.path === path)) })); st.layoutOld = !s.Lp; }
    if (s.inc) st.inc = s.inc;
    n++;
  }
  batch.removed = data.removed || {};
  for (const [path, r] of Object.entries(batch.removed)) { if (r.back) continue; const st = batch.students.find(x => x.files.some(f => f.path === path)); if (st) goneNow(st, fileByPath(st, path)); }
  // A file moved on one computer and marked on the other: the marks follow the file.
  for (const [path, key] of Object.entries(batch.moved)) {
    const st = batch.students.find(x => x.key === key), fl = st && st.files.find(f => f.path === path);
    if (!fl || Object.values(fl.marks).some(a => a.length)) continue;
    for (const [k, r] of Object.entries(data.s)) if (k !== key && r.f && r.f[path]) { fl.marks = r.f[path]; break; }
  }
  scanRestore(data.scan);
  if (data.share) batch.share = data.share;
  if (data.read) batch.read = data.read;
  if (data.light) batch.light = data.light;
  if (data.lightOpt) batch.lightOpt = data.lightOpt;
  if (data.lightPg) batch.lightPg = data.lightPg;
  if (data.lightPgL) batch.lightPgL = data.lightPgL;
  if (data.anon) batch.anon = data.anon;
  if (data.refSkip) batch.refSkip = data.refSkip;
  if (data.quiz) batch.quiz = data.quiz;
  if (data.returned) batch.returned = data.returned;
  batch.groups = data.groups || [];
  groupSync();
  if (data.drive && !batch.drive) batch.drive = data.drive;
  batch.restoredCur = Math.min(data.cur || 0, batch.students.length - 1); batch.restoredKey = data.ck;
  if (n) setTimeout(() => toast('Picked up where you left off (' + n + (n === 1 ? ' student' : ' students') + ' started)'), 300);
}

