/* ---------------- a new school year: this year to one protected file, then the same classes with empty class lists ---------------- */
// Start a new year (Settings, Saving and carrying):
//   1. Everything from this year goes into a take-home file (src/takehome.js), with the Planner's records added as 'plan' frames.
//   2. The file is read back and checked, every chunk of it, against what is here. Nothing is cleared unless it passes.
//   3. Every download is forgotten the usual way (forgetKept), so the folder and other tabs follow. The library keeps its
//      classes, units and assignment cards; anything about a student goes. A card keeps its rubric and its Quick mark boxes
//      (card.quiz), and a new download opened on it starts with them. Dates move on a year. lib.year names the year.
//   4. The Planner moves itself on the next time it opens (gsp.newYear, read in src/planner/units.js): units and the
//      semester a year later, this year's lessons into Past lessons under the old year's name.
// What counts as "about a student" is worked out from the saved data, not from a list of today's fields: any value with a
// roster name as a key, or a roster name as the whole of a string. So data added later (attendance, seating...) goes too.
// Open an archived year: the same file brought back in place of what's here, after this year has been saved the same way.
const NY_EXT = TAKE_EXT;
const nyClone = o => JSON.parse(JSON.stringify(o));
function nyPad(n) { return String(n).padStart(2, '0'); }
// "2025–26" for a year that starts in 2025.
function nyLabel(y) { return y + '–' + nyPad((y + 1) % 100); }   // function declarations: Settings draws the year before this file has run
function nyGuess() {
  if (lib.year && typeof lib.year === 'string') return lib.year;
  const starts = ((lib.book && lib.book.terms) || []).map(t => t.start).filter(s => /^\d{4}-\d\d-\d\d$/.test(s || '')).sort();
  const d = starts.length ? new Date(starts[0] + 'T12:00:00') : new Date();
  return nyLabel(d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);
}
// The year after a name like "2025–26" or "2025-2026"; anything else is left for her to type.
function nyNext(name) {
  const m = /^(\d{4})\s*[–-]\s*(\d{2}|\d{4})$/.exec(String(name).trim());
  if (m) return nyLabel(+m[1] + 1);
  const y = /^(\d{4})$/.exec(String(name).trim()); return y ? String(+y[1] + 1) : '';
}
// A date a year on. 29 February becomes the 28th.
function nyDay(s) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); if (!m) return s;
  const y = +m[1] + 1, d = m[2] === '02' && m[3] === '29' ? '28' : m[3];
  return y + '-' + m[2] + '-' + d;
}
const nySafeName = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
const nyFileName = year => 'Grading Studio ' + (nySafeName(year) || 'year') + NY_EXT;

/* what is about a student */
function nyNames(l) {
  const s = new Set();
  for (const c of (l && l.classes) || []) {
    for (const n of c.names || []) if (n) s.add(n);
    for (const [n, i] of Object.entries(c.info || {})) { s.add(n); for (const o of (i && i.other) || []) if (o) s.add(o); }
  }
  return s;
}
function nyAbout(v, names, depth = 0) {
  if (v == null || depth > 20 || !names.size) return false;
  if (typeof v === 'string') return names.has(v.trim());
  if (typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some(x => nyAbout(x, names, depth + 1));
  for (const [k, x] of Object.entries(v)) if (names.has(k) || nyAbout(x, names, depth + 1)) return true;
  return false;
}
// Drops each field that's about a student, apart from the ones named in keep.
const nyStrip = (o, names, keep) => { for (const k of Object.keys(o)) if (!keep.includes(k) && nyAbout(o[k], names)) delete o[k]; return o; };

// Kept on a class but belonging to one year, so they never carry, even when a day has no student in it: attendance (attend.js),
// the levels set for each student of an MYP class and the grades predicted in a DP class (ib.js). How the class is graded, its criteria and its boundaries carry.
const NY_YEAR_ONLY = ['att', 'lv', 'pred'];
/* the new year's library */
// o: { roster: keep the class lists, dates: move dates on a year, from, to: the two years' names, file }. works: { download id: work }.
function nyLib(old, works, o) {
  const L = nyClone(old), names = nyNames(old);
  L.classes ||= []; L.loose ||= { id: '', units: [] };
  const card = it => {
    const w = it.batchId ? works[it.batchId] : null, n = { ...it };
    delete n.batchId; delete n.opened;
    if (n.typed && typeof n.typed === 'object') n.typed = { max: n.typed.max == null ? null : n.typed.max, ...(n.typed.lv ? { lv: true } : {}), s: {} };
    if (!n.setup && w && w.setup) { n.setup = { ...w.setup }; delete n.setup.spot; delete n.setup.rubricPage; }
    if (!n.quiz && w && w.quiz && Array.isArray(w.quiz.qs) && w.quiz.qs.length) { const q = nyClone(w.quiz); delete q.shift; delete q.spot; n.quiz = q; }
    if (!n.goal && w && typeof w.goal === 'string' && w.goal) n.goal = w.goal;   // a learning goal for the whole score (goals.js)
    if (o.dates && n.due) n.due = nyDay(n.due);
    return nyStrip(n, names, ['id', 'name', 'setup', 'quiz', 'typed', 'classId', 'goal', 'crit']);
  };
  for (const c of L.classes) {
    if (!o.roster) { c.names = []; delete c.info; }
    for (const k of NY_YEAR_ONLY) delete c[k];
    // The seating chart's room carries, with every desk empty, unless the class keeps its students (seating.js).
    if (!o.roster && c.seats && c.seats.desks && typeof c.seats.desks === 'object') c.seats = { ...c.seats, desks: Object.fromEntries(Object.keys(c.seats.desks).map(k => [k, ''])), pins: [] };
    nyStrip(c, names, ['id', 'name', 'units', 'way', 'ib', ...(o.roster ? ['names', 'info', 'seats'] : [])]);
  }
  for (const h of L.classes.concat([L.loose])) for (const u of h.units || []) { nyStrip(u, names, ['id', 'name', 'items']); u.items = (u.items || []).map(card); }
  if (L.book && typeof L.book === 'object') {
    delete L.book.dl;   // type and date of downloads with no card: those downloads are in the file now
    if (o.dates) L.book.terms = (L.book.terms || []).map(t => ({ ...t, start: nyDay(t.start), end: nyDay(t.end) }));
    nyStrip(L.book, names, ['terms', 'cats', 'w']);   // her terms, her own types and their weights carry, whatever they are called
  }
  // The to-do list (todo.js): what is still to do carries. A line about a student (or that says a student's name) does not, unless the
  // class lists are kept; what was done, and what was said about the app's own lines for this year's work, stays behind in the file.
  if (L.todo && typeof L.todo === 'object') {
    const low = [...names].map(n => n.toLowerCase()), says = i => { const t = (String(i.x || '') + ' ' + String(i.note || '')).toLowerCase(); return low.some(n => t.includes(n)); };
    L.todo = { items: (Array.isArray(L.todo.items) ? L.todo.items : []).filter(i => i && !i.gone && !i.done && (o.roster || !(i.who || says(i)))), off: { ...(L.todo.off || {}) }, offT: L.todo.offT || 0, auto: {} };
  }
  nyStrip(L, names, ['classes', 'loose', 'me', 'book', 'gone', 'years', 'todo']);
  L.year = o.to;
  L.years = [...(Array.isArray(old.years) ? old.years : []), { name: o.from, at: Date.now(), file: o.file }];
  return L;
}

/* the Planner's records, for the file */
async function nyPlanFrames(frame) {
  const db = await planDb(false); if (!db) return 0;
  let n = 0;
  try {
    for (const name of ['lessons', 'kv']) {
      if (!db.objectStoreNames.contains(name)) continue;
      let last, first = true;
      for (;;) {   // one record at a time: a Planner can hold big PDFs
        const got = await new Promise((res, rej) => {
          const q = db.transaction(name).objectStore(name).openCursor(first ? undefined : IDBKeyRange.lowerBound(last, true));
          q.onsuccess = () => res(q.result ? { k: q.result.key, v: q.result.value } : null); q.onerror = () => rej(q.error);
        });
        if (!got) break;
        last = got.k; first = false;
        const v = got.v;
        if (typeof FileSystemHandle !== 'undefined' && v instanceof FileSystemHandle) continue;   // the Planner folder's link belongs to this computer
        if (v instanceof Blob) { await frame({ k: 'plan', s: name, key: got.k, blob: v.type || '', fname: v.name || '' }, new Uint8Array(await v.arrayBuffer())); n++; continue; }
        let j; try { j = JSON.parse(JSON.stringify(v === undefined ? null : v)); } catch { continue; }
        await frame({ k: 'plan', s: name, key: got.k, v: j }); n++;
      }
    }
  } finally { db.close(); }
  return n;
}
const nyHasPlanner = async () => { const db = await planDb(false); if (!db) return false; try { const q = db.transaction('lessons').objectStore('lessons').count(); return (await idbP(q)) > 0 || (await idbP(db.transaction('kv').objectStore('kv').count())) > 0; } catch { return false; } finally { db.close(); } };

/* writing the file, and reading it back */
// Straight to the disk where the browser allows it, and read back from there. Otherwise the file is put together here,
// checked, and only then handed to the browser as a download.
async function nySink(name) {
  try {
    const fh = takeSinkFor || (window.showSaveFilePicker ? await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Grading Studio year', accept: { 'application/octet-stream': [NY_EXT] } }] }) : null);
    if (fh) { const w = await fh.createWritable(); return { name: fh.name, write: b => w.write(b), close: () => w.close(), abort: () => w.abort(), file: () => fh.getFile(), save: async () => {} }; }
  } catch (e) { if (e && e.name === 'AbortError') throw e; console.error(e); }
  const parts = []; let blob = null;
  return { name, write: async b => { parts.push(new Blob([b])); }, close: async () => { blob = new Blob(parts, { type: 'application/octet-stream' }); }, abort: async () => {}, file: async () => blob, save: () => saveBlob(name, blob) };
}
// What has to be in the file: every download, the papers this browser keeps, the library, and as many Planner records as went in.
async function nyExpect() {
  const A = await localState();
  return { ids: [...new Set([...Object.keys(A.meta), ...Object.keys(A.work)])].sort(), papers: [...keptMeta.entries()].filter(([, m]) => m && m.papers).map(([id]) => id), lib: localStorage.getItem('gs.lib') || '' };
}
async function nyCheck(file, pass, want, onp) {
  const rd = await takeOpen(file, pass), B = await takeScan(rd, onp);
  const ids = [...new Set([...Object.keys(B.meta), ...Object.keys(B.work)])].sort();
  const ok = JSON.stringify(ids) === JSON.stringify(want.ids) && want.papers.every(id => B.papers[id]) && (B.ls['gs.lib'] || '') === want.lib && (B.plan || []).length === want.plan;
  return ok ? { rd, B } : null;
}
// Makes the year's file and checks it. Returns { name, size } or throws (AbortError: she closed the save box).
async function nyArchive(year, pass, say) {
  await keepWait;
  if (batch) { commitEditors(); await saveNow(); }
  const sink = await nySink(nyFileName(year));
  const want = await nyExpect();
  let total = 0; for (const m of keptMeta.values()) total += m.size || 0;
  say('Saving ' + year + ' to a file…', 0, total);
  try {
    const size = await takeWrite(sink, pass, n => say('Saving ' + year + ' to a file… ' + fmtSize(n) + (total ? ' of about ' + fmtSize(total) : ''), n, total), null,
      { info: { kind: 'year', year }, onPlan: n => { want.plan = n; } });
    const file = await sink.file();
    say('Checking the file…', 0, file.size);
    const got = await nyCheck(file, pass, want, n => say('Checking the file… ' + fmtSize(Math.min(n, file.size)) + ' of ' + fmtSize(file.size), n, file.size));
    if (!got) throw Object.assign(new Error('The file did not match'), { check: true });
    await sink.save();
    store.set('gs.lastBackup', Date.now());
    return { name: sink.name, size };
  } catch (e) { try { await sink.abort(); } catch {} throw e; }
}

/* the new year */
async function nyStart(o) {
  const A = await localState(), ids = [...new Set([...Object.keys(A.meta), ...Object.keys(A.work), ...keptMeta.keys()])];
  const next = nyLib(lib, A.work, o), names = nyNames(lib);
  batch = null;
  try { await gsData.snapshot('Before starting ' + o.to, gsData.version()); } catch (e) { console.error(e); }
  if (fld.state === 'ok' || fld.state === 'decide') { try { await folderSnapshot('Before starting ' + o.to); } catch (e) { console.error(e); } }
  for (const id of ids) await forgetKept(id);
  const left = [...keptMeta.keys()];
  if (left.length) throw new Error(left.length + ' downloads could not be cleared');
  // Anything else kept with her work that's about a student (keyed by name). Settings, the comment bank and saved rubrics stay.
  for (const [k, v] of Object.entries(carryLs())) {
    if (k === 'gs.lib' || k === 'gs.school') continue;   // the school's links, files and notes aren't about a student, whatever they're called
    let x; try { x = JSON.parse(v); } catch { continue; }
    if (nyAbout(x, names)) localStorage.removeItem(k);
  }
  lib = migrateLib(next); saveLib();
  if (o.planner) try { localStorage.setItem('gsp.newYear', JSON.stringify({ id: Date.now().toString(36), from: o.from, dates: !!o.dates })); } catch {}
  renderLib(); railRender(); renderNeeds();
}

/* the box */
function nyBox(body, foot) {
  openDlg('<div class="bh"><h2>Start a new school year</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="nyBox">' + body + '</div><div class="bf">' + foot + '</div>', true);
  return $('#dlgBox');
}
async function openNewYear() {
  if (batch) { commitEditors(); await saveNow(); }
  const from = nyGuess(), to = nyNext(from), planner = await nyHasPlanner();
  const nDl = keptMeta.size, nCls = lib.classes.length;
  const box = nyBox(
    '<p style="margin-top:0">Your classes carry on into a fresh year with empty class lists. First, everything from this year goes into one protected file, and the file is checked before anything here is cleared.</p>' +
    '<div class="nyrow"><label class="tkf">The year you are closing<input id="nyFrom" autocomplete="off" value="' + esc(from) + '"></label><label class="tkf">The new year<input id="nyTo" autocomplete="off" value="' + esc(to) + '"></label></div>' +
    '<h3 class="nyh">What carries over</h3>' +
    '<label class="nyck"><input type="checkbox" checked disabled> <span><b>' + nCls + (nCls === 1 ? ' class' : ' classes') + ', with their units and assignment cards</b><small>Each card keeps its rubric and its Quick mark boxes. No papers, scores or comments.</small></span></label>' +
    '<label class="nyck"><input type="checkbox" id="nyDates" checked> <span><b>Due dates and term dates, a year later</b><small>Change any of them afterwards in Term setup or on the card.</small></span></label>' +
    (planner ? '<label class="nyck"><input type="checkbox" id="nyPlan" checked> <span><b>Planner units and the semester, a year later</b><small>This year’s lessons move to Past lessons, under “' + '<span id="nyFromSay">' + esc(from) + '</span>' + '”, ready to reuse.</small></span></label>' : '') +
    '<label class="nyck"><input type="checkbox" id="nyRoster"> <span><b>Class lists</b><small>Only for classes that keep the same students. Left empty otherwise.</small></span></label>' +
    '<p class="muted" style="font-size:14px;margin:10px 0 0">Your settings, grading scale, saved rubrics and comment bank stay as they are. ' + (nDl ? nDl + (nDl === 1 ? ' set of papers goes' : ' sets of papers go') + ' into the file and leave this browser.' : '') + '</p>' +
    '<h3 class="nyh">Protect the file</h3>' +
    '<p class="muted" style="font-size:14px;margin:0 0 8px">Choose a passphrase of a few words. Nobody can open the file without it, you included, so write it down somewhere safe.</p>' +
    passFields() + '<label class="tkf">Again, to be sure<input type="password" id="takeP2" autocomplete="off"></label><p class="tkerr" id="takeErr" role="alert" hidden></p>',
    '<button class="btn" data-close>Cancel</button><button class="btn primary" id="nyGo">Save the file and start the new year</button>');
  box.oninput = e => { if (e.target.id === 'nyFrom') { const s = $('#nyFromSay'); if (s) s.textContent = e.target.value.trim(); } };
  box.onkeydown = e => { if (e.key === 'Enter' && /^takeP[12]$/.test(e.target.id)) { e.preventDefault(); $('#nyGo').click(); } };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('#nyGo')) return;
    const err = t => { const el = $('#takeErr'); el.textContent = t; el.hidden = false; };
    const o = { from: $('#nyFrom').value.trim(), to: $('#nyTo').value.trim(), dates: $('#nyDates').checked, planner: !!($('#nyPlan') && $('#nyPlan').checked), roster: $('#nyRoster').checked };
    const p1 = $('#takeP1').value, p2 = $('#takeP2').value;
    if (!o.from || !o.to) return err('Give both years a name, like 2025–26 and 2026–27.');
    if (o.from === o.to) return err('The new year needs a different name from the one you are closing.');
    if (p1.length < 8) return err('Please use at least 8 characters for the passphrase. A few ordinary words work well.');
    if (p1 !== p2) return err('Those two passphrases don’t match.');
    nyRun(o, p1);
  };
  $('#nyTo').focus();
}
function nyProgress(box) {
  box.querySelector('.bb').innerHTML = '<p style="margin-top:0" id="takeMsg">Getting ready…</p><progress id="takeBar" style="width:100%"></progress>';
  box.querySelector('.bf').innerHTML = '';
  return (t, n, of) => { const m = $('#takeMsg'), b = $('#takeBar'); if (m) m.textContent = t; if (b && of) { b.max = of; b.value = Math.min(n, of); } };
}
function nyEnd(title, html, btn) {
  openDlg('<div class="bh"><h2>' + title + '</h2></div><div class="bb"><div id="nyDone">' + html + '</div></div><div class="bf"><button class="btn primary" data-close>' + (btn || 'Done') + '</button></div>', true);
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) closeDlg(); };
}
const nyFailSay = er => er && er.check ? 'The file didn’t read back the same as your work here, so it can’t be trusted. Nothing here was cleared. Please try again, somewhere with more room.'
  : 'The file didn’t finish, so nothing here was cleared. ' + (er && er.name === 'QuotaExceededError' ? 'There isn’t enough room on that disk. ' : '') + 'Please try again, somewhere with more room.';
async function nyRun(o, pass) {
  const say = nyProgress($('#dlgBox'));
  o.file = nyFileName(o.from);
  let made;
  try { made = await nyArchive(o.from, pass, say); o.file = made.name; }
  catch (er) {
    if (er && er.name === 'AbortError') return closeDlg();
    console.error(er);
    return nyEnd('Start a new school year', '<p style="margin-top:0">' + nyFailSay(er) + '</p>', 'Close');
  }
  say('Starting ' + o.to + '…');
  try { await tabsFinish(); tabsOver('go'); await nyStart(o); }
  catch (er) {
    console.error(er);
    tabsOver('done');
    return nyEnd('Start a new school year', '<p style="margin-top:0">The new year didn’t finish setting up. Everything from ' + esc(o.from) + ' is safe in <b>' + esc(made.name) + '</b>, and a safety copy was made first: Put back is under Go back in time if anything looks wrong.</p>', 'Close');
  }
  tabsOver('done');
  if (routeNow().v !== 'home' && routeNow().v !== 'settings') go('#/', true);
  yearRender();
  nyEnd(esc(o.to) + ' has started',
    '<p style="margin-top:0">Your classes, units and assignment cards are ready' + (o.roster ? '' : ', with empty class lists. Paste each class’s students on its <b>Students</b> tab') + '.' + (o.planner ? ' The Planner moves to the new year the next time you open it.' : '') + '</p>' +
    '<p>Everything from ' + esc(o.from) + ' is in <b>' + esc(made.name) + '</b> (' + fmtSize(made.size) + '), checked. Keep it somewhere safe with its passphrase. <b>Open an archived year</b> in Settings brings it back.</p>');
}

/* opening an archived year */
async function openArchivedYear(file) {
  const ask = msg => {
    openDlg('<div class="bh"><h2>Open an archived year</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="takeBox"><p style="margin-top:0">Type the passphrase for <b>' + esc(file.name) + '</b>. The whole file is checked before anything here changes.</p>' + passFields() + '<p class="tkerr" id="takeErr" role="alert"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p></div><div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" id="takeGo">Open it</button></div>', true);
    const box = $('#dlgBox');
    const go1 = async () => {
      const pass = $('#takeP1').value, say = nyProgress(box);
      let B, rd;
      try {
        rd = await takeOpen(file, pass);
        say('Checking the file…', 0, rd.plainLen);
        B = await takeScan(rd, n => say('Checking the file… ' + fmtSize(Math.min(n, rd.plainLen)) + ' of ' + fmtSize(rd.plainLen), n, rd.plainLen));
        if (B.info.dataV > gsData.DATA_V) throw new TakeError('newer');
      } catch (e) {
        if (!(e instanceof TakeError)) console.error(e);
        const code = e instanceof TakeError ? e.code : 'damaged';
        if (code === 'pass') return ask(TAKE_SAY.pass);
        closeDlg(); return sayDlg(TAKE_SAY[code] || TAKE_SAY.damaged);
      }
      nyConfirm(B, rd, pass, file.name);
    };
    box.onclick = e => { if (e.target.closest('[data-close]')) return closeDlg(); if (e.target.closest('#takeGo')) go1(); };
    box.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'takeP1') { e.preventDefault(); go1(); } };
    $('#takeP1').focus();
  };
  ask();
}
function nyConfirm(B, rd, pass, fname) {
  const old = B.info.year || 'the year in ' + fname, now = nyGuess(), n = Object.keys(B.meta).length || B.info.downloads || 0, linked = fld.state !== 'none';
  openDlg('<div class="bh"><h2>Open ' + esc(old) + '</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="nyBox">' +
    '<p style="margin-top:0">The file holds ' + n + (n === 1 ? ' set of papers' : ' sets of papers') + ', with its classes, class lists, marks and scores, made ' + esc(whenOf(B.info.t)) + '.</p>' +
    '<p>Opening it puts that year in place of what is here now. First, <b>' + esc(now) + '</b> is saved to its own file with the same passphrase, and checked, so you can switch back the same way.</p>' +
    '<p class="muted" style="font-size:14px">The Planner is not changed: last year’s lessons are already in Past lessons.' + (linked ? ' This browser stops saving to the folder “' + esc(fld.name) + '”, which keeps the current year. Choose a different folder for the old year if you want one.' : '') + '</p></div>' +
    '<div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" id="nyOpenGo">Save ' + esc(now) + ' and open ' + esc(old) + '</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('#nyOpenGo')) return;
    const say = nyProgress($('#dlgBox'));
    let made;
    try { made = await nyArchive(now, pass, say); }
    catch (er) {
      if (er && er.name === 'AbortError') return closeDlg();
      console.error(er);
      return nyEnd('Open ' + esc(old), '<p style="margin-top:0">' + nyFailSay(er).replace('cleared', 'changed') + '</p>', 'Close');
    }
    say('Opening ' + old + '…');
    try { await nyReplace(B, rd, { name: now, at: Date.now(), file: made.name }); }
    catch (er) {
      console.error(er);
      tabsOver('done');
      return nyEnd('Open ' + esc(old), '<p style="margin-top:0">That didn’t finish. ' + esc(now) + ' is safe in <b>' + esc(made.name) + '</b>, and a safety copy was made first: Put back is under Go back in time. Reload before doing anything else.</p>', 'Close');
    }
    tabsOver('done');
    toast(old + ' is open. Reloading…');
    setTimeout(reloadHome, 900);
  };
}
// Puts the file's grading work in place of this browser's. The year that was here is already in its own checked file.
async function nyReplace(B, rd, was) {
  await keepWait;
  await tabsFinish(); tabsOver('go');
  batch = null; clearTimeout(saveT); saveBad.clear();
  const schWas = localStorage.getItem('gs.school');   // the school resources belong to the school, not to one year: what is here stays
  try { await gsData.snapshot('Before opening ' + (B.info.year || 'an archived year'), gsData.version()); } catch (e) { console.error(e); }
  if (fld.state !== 'none') await folderUnlink();
  const years = Array.isArray(lib.years) ? lib.years : [];
  for (const n of ['papers', 'work', 'meta', 'edits']) await kdo(n, 'readwrite', o => o.clear());
  await idbDo('readwrite', o => o.clear());
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && (k.startsWith('gsc.saved.') || k.startsWith('gsc.forgot.') || k.startsWith('gs.') && !LS_LOOKS.test(k))) localStorage.removeItem(k); }
  for (const [k, v] of Object.entries(B.ls || {})) if (k !== 'gs.dataV' && !lsPut(k, v)) throw browserFull();
  // The archived library keeps the list of every year's file, the one just made included.
  try {
    const l = JSON.parse(localStorage.getItem('gs.lib') || 'null');
    if (l) { const seen = new Set(), all = [...(Array.isArray(l.years) ? l.years : []), ...years, was].filter(y => y && y.name && !seen.has(y.name + '|' + y.file) && seen.add(y.name + '|' + y.file)); if (!l.year && B.info.year) l.year = B.info.year; l.years = all.filter(y => y.name !== l.year); if (!lsPut('gs.lib', JSON.stringify(l))) throw browserFull(); }
  } catch (e) { if (e && e.small) throw e; console.error(e); }
  store.set('gs.tomb', B.tomb || {});
  const src = takeSource(rd, B);
  if (schWas) {
    const rd2 = t => { try { return JSON.parse(t); } catch { return null; } };
    if (!lsPut('gs.school', JSON.stringify(schoolMerge(rd2((B.ls || {})['gs.school']), rd2(schWas)).out))) throw browserFull();
  }
  await schBring(src, B);
  try { await exTake((await exBringPlan(B)).list, src.exPics); } catch (e) { console.error(e); }   // examples, like the school resources, belong to every year: those here stay, and the year's own come back beside them
  for (const id of new Set([...Object.keys(B.meta), ...Object.keys(B.work), ...Object.keys(B.papers)])) {
    const rec = await src.papers(id);
    if (rec) await paperPut(id, rec);
    for (const k of Object.keys((B.added && B.added[id]) || {})) { const r = await src.added(id, k); if (r) await idbDo('readwrite', o => o.put(r, id + '|' + k)); }
    for (const p of Object.keys((B.edits && B.edits[id]) || {})) { const r = await src.edit(id, p); if (r) await kdo('edits', 'readwrite', o => o.put(r, id + '|' + p)); }
    if (B.work[id]) await kdo('work', 'readwrite', o => o.put(B.work[id], id));
    const m = B.meta[id] || { id, name: (rec && rec.label) || 'A download', n: 0, t: (B.work[id] && B.work[id].t) || Date.now() };
    await kdo('meta', 'readwrite', o => o.put({ ...m, papers: !!rec, ...(rec ? { size: rec.entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) } : {}) }, id));
  }
  vkSweep();   // video files no student of that year names
  const v = B.info && B.info.dataV;
  if (!v) store.del('gs.dataV'); else if (v < gsData.version()) store.set('gs.dataV', v);
}

/* the card in Settings */
function yearRender() {
  const el = $('#yearLine'); if (!el) return;
  const ys = Array.isArray(lib.years) ? lib.years : [];
  el.innerHTML = 'This year: <b>' + esc(nyGuess()) + '</b>' + (lib.year ? '' : ' <span class="muted">(from your term dates)</span>') + '.' +
    (ys.length ? ' Archived: ' + ys.map(y => esc(y.name) + ' <span class="muted">in ' + esc(y.file || 'a file') + ', ' + esc(new Date(y.at).toLocaleDateString(LANG_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' })) + '</span>').join('; ') + '.' : '');
}
$('#yearBtn').onclick = openNewYear;
$('#yearOpenBtn').onclick = () => $('#yearIn').click();
$('#yearIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openArchivedYear(f); };
Object.assign(window.__gs, { nyLib, nyAbout, nyDay, nyNext, nyGuess, openNewYear, openArchivedYear, yearRender });
