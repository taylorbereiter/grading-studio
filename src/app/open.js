/* ---------------- intake ---------------- */
const isPdf = n => /\.pdf$/i.test(n), isImg = n => /\.(png|jpe?g)$/i.test(n);
const junk = p => /(^|\/)(__MACOSX|\.)/.test(p);
// What Windows and Word leave beside a paper. These still count toward knowing the download again, so saved work finds its way back, but they aren't anyone's files.
const houseFile = p => /(^|\/)(Thumbs\.db|ehthumbs\.db|desktop\.ini|~\$[^/]*)$/i.test(p);
// Names in ZIPs made without the "UTF-8" flag (Mac and Windows often skip it) come out garbled, like "JosÃ©";
// read them back as UTF-8 when they are.
function zipName(n) {
  if (!/[\u0080-\u00ff]/.test(n) || /[^\u0000-\u00ff]/.test(n)) return n;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(n, c => c.charCodeAt(0))); } catch { return n; }
}
// Files packed in a way a browser can't unpack (anything but the usual "deflate" or no packing) are skipped and counted.
let zipSkipped = 0;
function unzipInto(data, prefix, raw, depth) {
  const un0 = fflate.unzipSync(data, { filter: f => { if (junk(f.name) || f.name.endsWith('/')) return false; if (f.compression !== 0 && f.compression !== 8) { zipSkipped++; return false; } return true; } });
  const un = {}; for (const [k, v] of Object.entries(un0)) un[zipName(k)] = v;
  const inner = Object.keys(un);
  // Drive and ManageBac often wrap everything in one top folder; drop that layer.
  const tops = new Set(inner.map(p => p.split('/')[0]));
  const strip = tops.size === 1 && inner.every(p => p.includes('/')) && (new Set(inner.map(p => p.split('/')[1])).size > 1 || inner.every(p => p.split('/').length > 2) || prefix);
  for (const p of inner) {
    const q = prefix + (strip ? p.split('/').slice(1).join('/') : p);
    // a ZIP inside the ZIP (for example one per student) opens as that student's folder
    if (/\.zip$/i.test(q) && depth < 2) { try { unzipInto(un[p], q.replace(/\.zip$/i, '') + '/', raw, depth + 1); continue; } catch {} }
    raw.push({ path: q, data: un[p] });
  }
}
async function intake(entries, label, assignment, fromKeep) {   // entries: [{ path, file|data }]
  if (entries.length === 1 && /\.gswork$/i.test(entries[0].path)) return sayDlg('That’s a take-home file, not papers. To bring it in, use Bring work in under Saving and carrying, in Settings.');
  const raw = [], zipProblems = []; zipSkipped = 0;
  for (const e of entries) {
    if (junk(e.path)) continue;
    if (/\.zip$/i.test(e.path)) {
      const data = e.data || new Uint8Array(await e.file.arrayBuffer());
      // A ZIP inside a student's folder (they turned in a ZIP) opens inside that folder, not as new students.
      const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/') + 1) : '';
      if (data.length > 30e6) { toast('Opening the ZIP…', 20000); await new Promise(r => setTimeout(r, 30)); }
      try { unzipInto(data, dir, raw, dir ? 1 : 0); }
      catch (er) { console.error(er); if (dir) raw.push({ path: e.path, data }); else zipProblems.push(e.path.split('/').pop()); continue; }
      if (!label && !dir) label = e.path.split('/').pop().replace(/\.zip$/i, '');
      continue;
    }
    raw.push({ path: e.path, file: e.file, data: e.data });
  }
  const zipBad = zipProblems.length ? { names: zipProblems, n: zipProblems.length } : zipSkipped ? { skip: zipSkipped, n: zipSkipped } : null;   // told in the opening report, or now if that's all there is
  if (!raw.length) { toast(zipBad ? zipSay(zipBad) : 'Nothing found in what you dropped', zipBad ? 9000 : 3000); return; }

  await srcRead(raw);
  await spellLikeSaved(raw);
  const map = groupRaw(raw), keys = [...map.keys()].sort(natural);
  const students = [], keepList = [];
  for (const key of keys) {
    const files = [];
    for (const r of map.get(key).sort((a, b) => natural(a.path, b.path))) {
      const data = r.data || (r.file ? new Uint8Array(await r.file.arrayBuffer()) : null);
      keepList.push({ path: r.path, data });
      if (!houseFile(r.path)) files.push(await makeFile(r.path, data));
    }
    if (!files.length && map.get(key).every(r => houseFile(r.path))) continue;
    students.push({ key, files, grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} });
  }
  if (!students.length) { toast('Nothing found in what you dropped'); return; }
  const id = batchIdOf(raw);
  const paperList = keepList.filter(e => !houseFile(e.path));
  const sameSize = fromKeep ? [] : await changedInPlace(id, paperList).catch(e => { console.error(e); return []; });   // same names and sizes, different bytes
  const earlier = fromKeep || paperList.every(e => isNotes(e.data)) ? null : await findEarlier(id, paperList, assignment).catch(e => { console.error(e); return null; });   // an older copy of this download, already worked on?
  if (earlier && earlier.asg) assignment = earlier.asg;
  if (!assignment && !fromKeep) assignment = cardOfKept(id);   // the same download dropped again still belongs to its card, the same as opening it from the list
  const rub = await rubricAtOpen(assignment, earlier ? earlier.d : newestWork(store.get(id, null), await kget('work', id)), (assignment && assignment.name) || label || 'This download');
  if (!rub) { toast('Nothing was opened. It will ask again when you open it.', 5000); return; }
  batch = { id, name: (assignment && assignment.name) || label || 'Your download', students, assignment: assignment || null, zipBad, seen: lsRaw(savedKey(id)), opened: Date.now() };   // seen: from before the work is read, so a save by another tab from here on is noticed
  if (rub.su) setup = setupOver(rub.su);
  delete setup.spot;   // the grade spot belongs to one download, and restore() brings its own back
  thumbCache.clear();
  askToKeep();
  batch.keptWork = await kget('work', id);   // this browser's fuller copy of the work
  if (earlier) await carryInto(earlier, paperList);   // or the work from the older copy of this download
  else if (!fromKeep && !batch.keptWork && !store.get(id, null)) { const scan = await carryScan(id, paperList).catch(e => { console.error(e); return null; }); if (scan) batch.keptWork = { t: Date.now(), s: {}, scan }; }   // or, with no work to carry, what she said about the same pages
  const saved = newestWork(store.get(id, null), batch.keptWork);
  await applyRubricPage();
  if (earlier) await carryRubric(earlier);
  await loadAdded();
  if (setup.rubricPage) await applyRubricPage(batch.students.filter(st => !st.files.some(f => f.virtual)));   // a late file can be the first thing of theirs it can sit with
  await loadRefs();
  await loadEdits();
  batch.revs = revsOf(revsBase(saved));   // from before anything can change it: a record's lists are shared with her live marks and scores
  batch.lastS = saved && saved.s;
  restore();
  if (sameSize.length) flagInPlace(sameSize);
  await photoTurns();
  if (saved && saved.cls != null) batch.classId = saved.cls;
  rosterSort();
  if (batch.classId && (!saved || saved.cls == null)) Object.assign(batch.revs.ph, partHashes({ cls: batch.classId }));   // the app worked out the class just now, so she hasn't changed it
  if (earlier) carryRoster(earlier);
  if (batch.restoredKey) { const k = batch.students.findIndex(st => st.key === batch.restoredKey); if (k >= 0) batch.restoredCur = k; }
  renderClassSel();
  if (assignment && assignment.goal && !batch.goal && !assignment.batchId) batch.goal = assignment.goal;   // and its learning goal for the whole score
  if (assignment && assignment.quiz && !batch.quiz && !assignment.batchId) { batch.quiz = JSON.parse(JSON.stringify(assignment.quiz)); setTimeout(saveSoon, 0); }   // a card from last year starts with its Quick mark boxes
  if (assignment) { assignment.batchId = id; assignment.opened = Date.now(); if (!assignment.setup || rub.toCard) assignment.setup = { ...setup, spot: undefined }; shareRubric(assignment); saveLib(); }
  keepWait = keepPapers(batch, label, fromKeep ? null : keepList, sameSize.length > 0);
  cur = 0; undoStack = []; selected = null;
  routeTok++; routeOpening = ''; go(batchHash(id), routeNow().v === 'a');   // from another open assignment (or this one's own address after a refresh): no extra step for Back
  setBatchName(); qzForget(); quizBtn();
  $('#trAllBtn').hidden = !CAN_TRANSCRIBE || !students.some(st => st.files.some(f => f.kind === 'media'));
  renderTools(); renderList(); renderTopAtlas(); openStudent(batch.restoredCur || 0);
  scanned = false; scanAll();
  { const t = routeTab; routeTab = null; if (t && t.id === id) go(batchHash(id, t.tab), true); }
  setTimeout(wordScoresAll, 50);
  if (shellReady) setTimeout(wordPdfAuto, 400);   // Word papers as PDF pages, when that's her setting
  if (earlier) carrySay();
  if (rub.said) saveSoon();   // what she chose goes with the work, so it isn't a question next time
  openingReport();
}
// Which rubric a download opens with, decided only here: { su }, with nothing in su meaning the one in use now. The card's, or with no card, what the work was scored with, or for a card with neither, the last one saved.
// If going by the card would change a total or a percent, she's asked, and nothing opens until she says: null is "not now". Row names and what each score means come from the card, with nothing asked.
async function rubricAtOpen(card, work, name) {
  const mine = card && card.setup, own = work && work.setup, ask = async (q, intro) => {
    const ans = await showConflicts([{ key: SET_ASK + 'setup', part: 'setup', id: 'open', name, ...q }], { title: 'Which rubric should this use?', intro, other: '', cancel: 'Not now', noNewest: true });
    return ans && ans['open|' + SET_ASK + 'setup'];
  };
  if (mine && own && rubricsDiffer(mine, own) && workScored(work)) {
    const said = await ask({ a: mine, b: own, la: 'On the assignment card', lb: 'Saved with this download', ta: fieldT({ node: card }, 'setup'), tb: partT(work, 'setup') }, 'The assignment card and this download’s saved work have different rubrics, so their scores would come out differently. Whichever you pick, the card and the download both use it from now on.');
    return said && (said === 'a' ? { su: mine, said } : { su: own, said, toCard: true });
  }
  if (mine || own) return { su: mine || own };
  const last = setupOver(card ? store.get('gs.setup', null) : setup), fit = workScored(work) ? rubricFitting(work, last) : null;
  if (fit) {
    const said = await ask({ a: last, b: fit, la: 'The last rubric you saved', lb: 'One that fits these scores' }, 'This work doesn’t say which rubric its scores were given with, and they don’t fit the last one you saved.');
    return said && { su: said === 'a' ? last : fit, said };
  }
  return { su: card ? last : null };
}
// Work too old to say what rubric it was scored with: a rubric its scores fit, if the one given isn't. Null if it is.
function rubricFitting(work, last) {
  let n = 0, pts = false;
  for (const r of Object.values(work.s || {})) {
    const g = (r && r.g) || {};
    (g.rubric || []).forEach((v, i) => { if (v != null && i >= n) n = i + 1; });
    if (g.points != null && g.points !== '') pts = true;
  }
  if (last.mode === 'points' ? pts || !n : n === last.criteria.length || (!n && !pts)) return null;
  if (!n) return { ...last, mode: 'points' };
  return { ...last, mode: 'rubric', criteria: Array.from({ length: n }, (_, i) => last.criteria[i] || 'Criterion ' + (i + 1)), levels: undefined };
}
// The first save writes a few things old work doesn't have: the time of a Word edit, and a setup with its defaults filled in. Those aren't changes she made.
function revsBase(saved) {
  if (!saved) return saved;
  const w = { ...saved, s: { ...saved.s } };
  if (w.setup) w.setup = setupOver(w.setup);
  for (const st of batch.students) for (const f of st.files) {
    const r = w.s[st.key];
    if (f.edited && !(r && r.v) && !(r && r.e && r.e[f.path])) w.s[st.key] = { ...(r || { f: {}, g: st.grade, h: {} }), e: { ...(r && r.e), [f.path]: f.edited } };
  }
  return w;
}
// One student per top-level folder; loose files are one student each.
function groupRaw(raw) {
  const map = new Map();
  for (const r of raw) {
    if (/^Grade sheet - [^/]*\.pdf$/i.test(r.path)) continue;   // the grade sheet from an earlier export isn't a student
    const key = studentOf(r.path);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}
// Canvas and Moodle hand a class's work back with the student's name inside each file or folder name, not as one folder each:
//   Canvas   doejane_12345_678901_Essay.pdf, doejane_LATE_12345_678901_Notes.pdf   (name, their number, the file's number)
//   Moodle   Jane Doe_12345_assignsubmission_file_/Essay.pdf, or loose: Jane Doe_12345_assignsubmission_file_Essay.pdf
// When every file in a download is named one of those ways, and they name more than one student, each student's files are put together under their name. The files keep
// the paths they came with, so the export hands back the same names. A download already worked on before this was known keeps the
// students it had: srcRead leaves it alone.
const SRC_CANVAS = /^([^_\/A-Z\s]*[^_\/A-Z\s\d][^_\/A-Z\s]*)_(?:LATE_|late_)?(\d{3,})_(\d{3,})_[^\/]+$/, SRC_MOODLE = /^([^\/]+?)_(\d+)_assignsubmission_[a-z]+_(?:\/.+|[^\/]*)$/i;
// Google Classroom names the copy it makes for each student "Jane Doe - Essay template", all in the assignment's one Drive folder. When loose
// files are named that way, with more than one student and the same titles coming up again and again, each student's files are put together
// under their name. A file a student uploaded under its own name has no student in it, and stays as it came.
const SRC_GCLASS = /^([^\/]*[^\/\s\d][^\/]*?) - ([^\/]+?)(?:\.[^.\/]+)?$/;
function srcClassroom(list) {
  const hits = list.map(r => [r, SRC_GCLASS.exec(r.path)]).filter(x => x[1] && !/\d{3,}/.test(x[1][1]) && x[1][1].trim().split(/\s+/).length <= 5);
  const whos = new Set(hits.map(x => nameFold(x[1][1].trim()))), titles = new Set(hits.map(x => nameFold(x[1][2].replace(/\s*\(\d+\)$/, '').trim())));
  if (hits.length < 2 || whos.size < 2 || titles.size * 2 > whos.size) return null;
  return new Map(hits.map(([r, m]) => [r.path, m[1].trim()]));
}
let srcWho = new Map();   // path -> student, for the download being opened or open
const plainStudent = path => { const parts = path.split('/').filter(Boolean); return parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, ''); };
const studentOf = path => srcWho.get(path) || plainStudent(path);
async function srcRead(raw) {
  srcWho = new Map();
  const list = raw.filter(r => !houseFile(r.path) && !/^Grade sheet - [^/]*\.pdf$/i.test(r.path));
  const rx = list.length >= 2 && [SRC_CANVAS, SRC_MOODLE].find(x => list.every(r => x.test(r.path)));
  const gcl = rx ? null : srcClassroom(list);
  if (!rx && !gcl) return;
  const id = batchIdOf(raw);   // as it would have opened before: with work saved that way, it stays that way
  if (store.get(id, null) || keptMeta.has(id) || await kget('work', id)) return;
  if (gcl) { srcWho = gcl; return; }
  const ids = new Map();   // two students whose names read the same are told apart by their number
  for (const r of list) { const m = rx.exec(r.path), n = m[1].trim(); if (!ids.has(n)) ids.set(n, new Set()); ids.get(n).add(m[2]); }
  if (ids.size < 2) return;   // one name for every file is a naming habit (IMG_2026_1110_…), not a class
  const who = new Map();
  for (const r of raw) { const m = rx.exec(r.path); if (m) who.set(r.path, ids.get(m[1].trim()).size > 1 ? m[1].trim() + ' ' + m[2] : m[1].trim()); }
  srcWho = who;
}
// A download is known by its file names and sizes, which is how the same one is found again.
function batchIdOf(raw) {
  const map = groupRaw(raw), size = r => r.data ? r.data.length : r.file ? r.file.size : 0;
  return 'gs.b.' + hash([...map.keys()].sort(natural).map(k => map.get(k).sort((a, b) => natural(a.path, b.path)).map(r => r.path + ':' + size(r)).join('|')).join('/'));
}
// An accented name can be spelled two ways under the hood: Macs often split "é" into "e" and an accent, Windows doesn't.
// Work already saved under either spelling is found and keeps it. Anything new takes the Windows spelling, so both computers agree.
// Two files or folders that differ only in this spelling (one student uploading from both computers) are really two, so that download stays exactly as it came.
async function spellLikeSaved(raw) {
  if (raw.every(r => r.path === r.path.normalize('NFC') && r.path === r.path.normalize('NFD'))) return;
  const one = raw.map(r => ({ ...r, path: r.path.normalize('NFC') }));
  if (new Set(one.map(r => r.path)).size < new Set(raw.map(r => r.path)).size || groupRaw(one).size < groupRaw(raw).size) return;
  for (const form of [null, 'NFC', 'NFD']) {
    const id = batchIdOf(raw.map(r => ({ ...r, path: form ? r.path.normalize(form) : r.path })));
    if (store.get(id, null) || keptMeta.has(id) || await kget('work', id)) { if (form) for (const r of raw) r.path = r.path.normalize(form); return; }
  }
  for (const r of raw) r.path = r.path.normalize('NFC');
}
async function makeFile(path, data) {
  const name = path.split('/').pop();
  const magic = data && data.length > 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;   // "%PDF"
  let kind = trueKind(isPdf(name) || magic ? 'pdf' : isImg(name) || IMG_MORE.test(name) ? 'img' : MEDIA_RX.test(name) ? 'media' : WORD_RX.test(name) ? 'docx' : TEXT_RX.test(name) ? 'text' : LINK_RX.test(name) && linkOf(data) ? 'link' : 'other', name, data);
  let pdf = kind === 'pdf' ? data : null;
  if (kind === 'pdf' && gsExportLike(data)) {   // a file exported from here with its marks kept: back to the original pages and the marks
    const back = await unpackExport(data);
    if (back) return { path, name, kind, data: back.data, size: data.length, marks: back.marks, rot: back.rot, skew: back.skew, noauto: true, pages: null };
  }
  let pic = null;
  if (kind === 'img') { try { pic = await pictureToPdf(data, name); pdf = pic.pdf; if (pic.hurt) kind = 'other'; } catch { kind = 'other'; } }
  return { path, name, kind, data: kind === 'pdf' || kind === 'img' ? pdf : data, size: data ? data.length : 0, marks: {}, pages: null, photoTurn: (pic && pic.turn) || 0, was: !!(pic && pic.was), hurt: !!(pic && pic.hurt) };
}
// An editable export carries its original pages and its marks as attachments, and ends with this line so it's found without opening it.
const GS_TAIL = '%GradingStudio-editable';
const hasGsTail = d => !!d && d.length > 64 && new TextDecoder().decode(d.subarray(d.length - 64)).includes(GS_TAIL);
// A file can lose that last line when it's opened and saved again in another app, or passed through some uploads. Its attached
// files usually stay, and a file attached to a PDF always has "/EmbeddedFile" in plain text, so that's looked for too.
const hasAttached = d => !!d && d.length > 64 && new TextDecoder('latin1').decode(d).includes('/EmbeddedFile');
const gsExportLike = d => hasGsTail(d) || hasAttached(d);
// Marks read from a file could say anything, so only ones that can be drawn come in. One bad mark would stop that student's page drawing.
const markFits = m => !!m && typeof m === 'object' && ['pen', 'hl', 'text', 'check', 'oval', 'note', 'stamp'].includes(m.t) && (m.t !== 'stamp' || (typeof m.k === 'string' && isFinite(m.x) && isFinite(m.y))) && (m.t !== 'pen' || Array.isArray(m.pts)) && (m.t !== 'text' || typeof m.text === 'string') && (m.t !== 'note' || (typeof m.text === 'string' && /^#[0-9a-f]{6}$/i.test(m.color))) && (m.t !== 'hl' || Array.isArray(m.pts) || Array.isArray(m.rects) || m.x != null);
async function unpackExport(data) {
  try {
    await workerReady;
    const js = await pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
    const att = (await js.getAttachments()) || {}; js.destroy();
    const meta = att['grading-studio.json']; if (!meta) return null;
    const info = JSON.parse(new TextDecoder().decode(meta.content)), srcs = [], marks = {}, rot = {}, skew = {};
    info.pages.forEach(([, , m, r, k], i) => { const ok = Array.isArray(m) ? m.filter(markFits) : []; if (ok.length) marks[i] = ok; if (r) rot[i] = r; if (k) skew[i] = k; });
    const orig = k => att['gs-original-' + (k + 1) + '.pdf'].content;
    const one = info.pages.every(([s]) => s === 0) && info.pages.every(([, p], i) => p === i);
    if (one) {   // the whole original in order: kept exactly as it was
      const src = await PDFLib.PDFDocument.load(orig(0), { ignoreEncryption: true, updateMetadata: false });
      if (src.getPageCount() === info.pages.length) return { data: orig(0), marks, rot, skew };
    }
    const out = await PDFLib.PDFDocument.create();
    for (const [s, p] of info.pages) {
      srcs[s] ||= await PDFLib.PDFDocument.load(orig(s), { ignoreEncryption: true, updateMetadata: false });
      const [cp] = await out.copyPages(srcs[s], [p]); out.addPage(cp);
    }
    return { data: await out.save(), marks, rot, skew };
  } catch (e) { console.error(e); return null; }
}
// Pictures other than PNG and JPEG (GIF, WebP, BMP, and HEIC/TIFF where the browser can read them) become a JPEG page.
const IMG_MORE = /\.(gif|webp|bmp|heic|heif|tiff?|avif)$/i, TEXT_RX = /\.(txt|md|rtf)$/i;
async function anyImageToPdf(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0);
  const jpg = await canvasJpg(c, 0.92);
  c.width = c.height = 0;
  return imageToPdf(jpg, 'page.jpg');
}
async function imageToPdf(bytes, name) {
  const doc = await PDFLib.PDFDocument.create();
  const img = /\.png$/i.test(name) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const W = 612, H = Math.round(W * img.height / img.width);
  doc.addPage([W, H]).drawImage(img, { x: 0, y: 0, width: W, height: H });
  return await doc.save();
}
function hash(s) {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ path: prefix + file.name, file });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let b;
    do {
      b = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const ch of b) await walkEntry(ch, prefix + entry.name + '/', out);
    } while (b.length);
  }
}

