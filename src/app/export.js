/* ---------------- export ---------------- */
let xBusy = false;
const xAll = () => !!store.get('gs.xall', false);
const xEdit = () => store.get('gs.xedit', true) !== false;   // "Keep marks editable"   // "Also include files with no marks"
// Word files you edited or scored, any file you added; with "include everything", every file.
// A student's copy of her own Word rubric goes back once she has highlighted or typed in it, and stays out while it's still blank.
const rawOut = f => !viewable(f) && !!f.data && (f.virtual ? f.kind === 'docx' && (!!f.edited || !!(wordScore(f) && f.wscore.total != null)) : xAll() || !!f.edited || !!f.added || !!(wordScore(f) && f.wscore.total != null));
// A PDF standing in for the student's own Word paper (wordpdf.js, or her own Replace with the same name) is still their paper, not a file she added.
function madeFromWord(f) {
  if (!f || !f.added || !batch || !batch.removed || !/\.pdf$/i.test(f.name)) return false;
  return Object.keys(batch.removed).some(k => { const r = batch.removed[k]; if (r.by !== f.path || r.back || !WORD_RX.test(k)) return false; const base = k.slice(k.lastIndexOf('/') + 1).replace(WORD_RX, ''); return f.name === base + '.pdf' || (f.name.startsWith(base + ' (added ') && /^ \(added \d+\)\.pdf$/.test(f.name.slice(base.length))); });
}
const docAdded = (st, d) => d.pages.some(([path]) => { const f = fileByPath(st, path); return !!f && !!f.added && !madeFromWord(f); });
// A file you moved to another student goes back in that student's folder.
const outPath = (st, path) => batch.moved && batch.moved[path] === st.key && path.includes('/') ? st.key + path.slice(path.indexOf('/')) : path;
function exportPlan(keepFolders) {
  const out = [];
  for (const st of batch.students) for (const f of st.files.filter(rawOut)) {
    const fp = outPath(st, f.path), dir = fp.includes('/') ? fp.slice(0, fp.lastIndexOf('/') + 1) : '';
    out.push({ st, f, raw: true, path: (keepFolders ? fp : (dir ? st.key + ' - ' : '') + f.name).replace(/[\\:*?"<>|]+/g, '-') });
  }
  for (const st of batch.students) for (const d of layoutOf(st)) {
    if (xAll() ? !(docIn(st, d) || docAuto(st, d)) : (!docIn(st, d) || !(docMarked(st, d) || docAdded(st, d)))) continue;
    const first = outPath(st, d.pages[0][0]), dir = first.includes('/') ? first.slice(0, first.lastIndexOf('/') + 1) : '';
    let path = dir + d.name.replace(/\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif)$/i, '.pdf');
    if (!/\.pdf$/i.test(path)) path += '.pdf';
    if (!keepFolders) path = (dir ? st.key + ' - ' : '') + path.split('/').pop();
    out.push({ st, d, path: path.replace(/[\\:*?"<>|]+/g, '-') });
  }
  const used = new Set();
  for (const o of out) { let p = o.path, k = 2; while (used.has(p.toLowerCase())) p = o.path.replace(/(\.[^./]+)?$/, ' (' + k++ + ')$1'); used.add(p.toLowerCase()); o.path = p; }
  return out;
}
// Builds one returned file from its pages (possibly from several turned-in files), baking in every mark.
async function flattenDoc(st, d, dpi, edit, key) {
  await workerReady;
  const srcs = new Map();
  const src = async path => {
    if (!srcs.has(path)) {
      const f = fileByPath(st, path);
      const bytes = await viewBytes(f);   // less any marks from other apps that are hers now
      srcs.set(path, { f, js: await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise, lib: await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }) });
    }
    return srcs.get(path);
  };
  const out = await PDFLib.PDFDocument.create();
  out.setCreator('Grading Studio'); out.setProducer('Grading Studio');   // so a flattened file brought back in can say why its marks can't be changed
  try {
    for (const [path, p] of d.pages) {
      const { f, js, lib } = await src(path);
      const marks = (f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []);
      const Lx = lightOpts().exp ? lightForPage(st, f, p) : null;
      // A locked (encrypted) PDF can't be copied page for page; its copies come out blank, so those pages are redrawn instead.
      if (!marks.length && !(f.kami && f.kami[p]) && !Lx && !lib.isEncrypted && !skewOf(f, p)) {
        const [cp] = await out.copyPages(lib, [p]);
        if (rotOf(f, p)) cp.setRotation(PDFLib.degrees((cp.getRotation().angle + rotOf(f, p)) % 360));
        out.addPage(cp); continue;
      }
      const page = await js.getPage(p + 1);
      const vp1 = vpRot(f, p, page, 1), W = vp1.width, H = vp1.height;
      const side = marks.some(m => m.t === 'note') ? sideFor(W) : 0;
      const scale = dpi / 72;
      const c = document.createElement('canvas');
      c.width = Math.ceil((W + side) * scale); c.height = Math.ceil(H * scale);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, scale), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      scanClip(ctx, f, p, W * scale, c.width, c.height);
      if (Lx) lightCanvas(ctx, Math.min(c.width, Math.ceil(W * scale)), c.height, Lx);   // the page only, before her marks
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawMarks(ctx, marks, W, H, side, null);
      const jpg = await canvasJpg(c, 0.88);
      const img = await out.embedJpg(jpg);
      out.addPage([W + side, H]).drawImage(img, { x: 0, y: 0, width: W + side, height: H });
      c.width = c.height = 0; page.cleanup();
    }
    // The mark key: what each proofreading mark on this file means, on its own page(s) after the last one, the last page's size.
    // Reopening an editable export rebuilds from the original pages, so the key never comes back in as a page.
    const rows = key ? keyRows(d.pages.flatMap(([path, p]) => fileByPath(st, path).marks[p] || [])) : [];
    if (rows.length) {
      const [lp, lpn] = d.pages[d.pages.length - 1], { f: lf, js: ljs } = await src(lp), lv = vpRot(lf, lpn, await ljs.getPage(lpn + 1), 1);
      let W = lv.width, H = lv.height;
      if (W < 300 || H < 300 || W > 2000 || H > 2000) { W = 612; H = 792; }
      const scale = dpi / 72;
      for (let from = 0; from < rows.length;) {
        const c = document.createElement('canvas'); c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
        const ctx = c.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
        from += drawKeyPage(ctx, rows, from, W, H);
        out.addPage([W, H]).drawImage(await out.embedJpg(await canvasJpg(c, 0.9)), { x: 0, y: 0, width: W, height: H });
        c.width = c.height = 0;
      }
    }
    if (edit) {   // the original pages and her own marks go along, so bringing the file back in opens it ready to change
      const paths = [...new Set(d.pages.map(([path]) => path))];
      const info = { v: 1, pages: d.pages.map(([path, p]) => { const f = fileByPath(st, path); return [paths.indexOf(path), p, f.marks[p] || [], rotOf(f, p), skewOf(f, p)]; }) };
      for (let k = 0; k < paths.length; k++) await out.attach(await viewBytes(fileByPath(st, paths[k])), 'gs-original-' + (k + 1) + '.pdf', { mimeType: 'application/pdf', description: 'Original pages, for reopening in Grading Studio' });
      await out.attach(new TextEncoder().encode(JSON.stringify(info)), 'grading-studio.json', { mimeType: 'application/json', description: 'Marks, for reopening in Grading Studio' });
    }
  } finally { for (const v of srcs.values()) v.js.destroy(); }
  const bytes = await out.save();
  if (!edit) return bytes;
  const tail = new TextEncoder().encode('\n' + GS_TAIL + '\n'), all = new Uint8Array(bytes.length + tail.length);
  all.set(bytes); all.set(tail, bytes.length); return all;
}
async function openExport() {
  saveNow(); commitEditors(); wordScoresAll();
  if (batch.lineBusy) await batch.lineRun;
  if (!scanned || scanP) {
    tabNext('return');
    const wait = waitDlg('Return marked files', 'Reading the files first…');
    await scanAll();
    if (!wait.isConnected) return;   // she closed it while it read
  }
  let keep = true, dpi = 150;
  const plan = exportPlan(true);
  const nStu = new Set(plan.map(o => o.st)).size, skipped = batch.students.length - nStu;
  const nLeft = batch.students.reduce((a, st) => a + layoutOf(st).filter(d => !docAuto(st, d) && !docIn(st, d)).length, 0);   // left out by her; the check above lists files with no marks
  const nKey = plan.filter(o => o.d && keyRows(o.d.pages.flatMap(([path, p]) => fileByPath(o.st, path).marks[p] || [])).length).length;
  const optsOpen = !!store.get('gs.xopts', false);
  const canDir = !!(window.showDirectoryPicker && window.self === window.top);
  const allBox = '<label class="chk"><input type="checkbox" id="xAll"' + (xAll() ? ' checked' : '') + '> Also send back files with no marks (Word files, other files and unmarked pages)</label>';
  tabNext('return');
  openDlg('<div class="bh"><h2>Return marked files</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb xp"><div class="rtmain">' +
    (plan.length
      ? '<p class="xbig">' + plan.length + (plan.length === 1 ? ' file' : ' files') + ' ready</p>' +
        '<p class="xsub">From ' + nStu + (nStu === 1 ? ' student' : ' students') + ', in their own folders, ready to ' + (sysName() ? 'upload back on ' + esc(sysName()) : 'hand back') + '.' +
          (skipped ? ' ' + skipped + ' ' + (skipped === 1 ? 'student has' : 'students have') + ' nothing marked, so they’re left out.' : '') +
          (nLeft ? ' ' + nLeft + (nLeft === 1 ? ' file you left out isn’t' : ' files you left out aren’t') + ' in it.' : '') + '</p>' +
        exportCheckHtml(exportCheck()) +
        '<button class="btn primary xgo" data-go="zip">Download ZIP</button><div id="rtState">' + returnedHtml() + '</div>' +
        ((canDir || G.email) ? '<p class="xalt">or ' + [canDir ? '<button class="link" data-go="dir">save into a folder…</button>' : '', G.email ? '<button class="link" data-go="drive">save to Google Drive</button>' : ''].filter(Boolean).join(' or ') + '</p>' : '') +
        '<div class="prog" hidden><i></i></div><p class="muted" id="xStatus" style="font-size:13px"></p>' +
        '<details class="xopts" id="xOpts"' + (optsOpen ? ' open' : '') + '><summary>Options: <span id="xOptsSay"></span></summary>' +
          '<label class="chk"><input type="checkbox" id="xKeep" checked> Keep student folders</label>' +
          '<label class="chk"><input type="checkbox" id="xSheet" checked> Add the grade sheet (a crop of each typed grade, in ' + listOrder() + ')</label>' +
          '<label class="chk"><input type="checkbox" id="xEdit"' + (xEdit() ? ' checked' : '') + '> Keep marks editable</label><p class="xhint">Bring a file back in later and change its marks. Files are about twice as big.</p>' +
          '<label class="chk"><input type="checkbox" id="xKey"' + (keyOn() ? ' checked' : '') + '> Add a key to the marks used on each paper</label><p class="xhint">' + (!nKey ? 'No file has proofreading marks yet. ' : nKey === plan.length ? (nKey === 1 ? 'The file gets one. ' : 'All ' + nKey + ' files get one. ') : nKey + ' of the ' + plan.length + ' files ' + (nKey === 1 ? 'gets' : 'get') + ' one. ') + '<button class="link" data-mkey>Change what they mean…</button></p>' +
          allBox +
          '<div class="chk" style="cursor:default">Sharpness <span class="seg" id="xDpi"><button data-dpi="150" aria-pressed="true">Standard</button><button data-dpi="220" aria-pressed="false">Extra sharp</button></span></div>' +
        '</details>' +
        '<p class="xfoot">Your original files don’t change. A file you marked anywhere goes back whole, every page in order. Word rubrics you scored go back as Word files. ' + (xAll() ? 'Files with no marks go too.' : 'Files with no marks stay out.') + ' Comments go in a right-hand margin.</p>'
      : '<p style="margin-top:0">Nothing is marked yet. Mark a paper and it will show up here.</p>' + exportCheckHtml(exportCheck()) + allBox + '<div id="rtState">' + returnedHtml() + '</div>') +
    '</div>' + returnSideHtml() + '</div><div class="bf"><button class="btn" data-close>Close</button></div>', true);
  const box = $('#dlgBox');
  // The Options line says what's on, so she doesn't have to open it to know.
  const optsSay = () => {
    const el = $('#xOptsSay'); if (!el) return;
    const on = [];
    if ($('#xKeep').checked) on.push('student folders');
    if ($('#xSheet').checked) on.push('grade sheet');
    if ($('#xEdit').checked) on.push('marks stay editable');
    if ($('#xKey').checked) on.push('mark key');
    if (xAll()) on.push('files with no marks too');
    if (dpi > 150) on.push('extra sharp');
    el.textContent = on.length ? on.join(', ') : 'none';
  };
  optsSay();
  const xo = $('#xOpts'); if (xo) xo.ontoggle = () => store.set('gs.xopts', xo.open);
  box.onchange = e => { optsSay(); if (e.target.id === 'xEdit') store.set('gs.xedit', e.target.checked); if (e.target.id === 'xKey') setKey(v => { v.on = e.target.checked; }); if (e.target.id === 'xAll') { store.set('gs.xall', e.target.checked); renderTools(); openExport(); } };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const ck = e.target.closest('[data-chk]'); if (ck) { return toPaper(+ck.dataset.chk, ck.dataset.file || undefined); }
    if (e.target.closest('[data-chksheet]')) return openSheet();
    if (returnSideClick(e)) return;
    if (e.target.closest('[data-mkey]')) { if (xBusy) return toast('The last export is still going. It will say when it’s done.'); closeDlg(); return openMarkKey(openExport); }
    const d = e.target.closest('[data-dpi]');
    if (d) { dpi = +d.dataset.dpi; for (const x of $('#xDpi').children) x.setAttribute('aria-pressed', x === d); optsSay(); return; }
    const go = e.target.closest('[data-go]'); if (!go) return;
    if (xBusy) return toast('The last export is still going. It will say when it’s done.');
    keep = $('#xKeep').checked;
    const withSheet = $('#xSheet').checked, editable = $('#xEdit').checked, withKey = $('#xKey').checked;
    // Closing the box doesn't stop the export: it finishes, and the last word comes up on its own.
    const say = (t, last) => { const el = $('#xStatus'); if (el) el.textContent = t; else if (last) toast(t, 6000); };
    let dir = null;
    if (go.dataset.go === 'dir') {
      try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'grading-studio' }); }
      catch (er) { if (er && er.name !== 'AbortError') toast('This browser didn’t allow saving to a folder. Use Download ZIP.'); return; }
    }
    for (const b of box.querySelectorAll('[data-go]')) b.disabled = true;
    const bar = box.querySelector('.prog'); bar.hidden = false;
    xBusy = true;
    const files = {}, failed = [];
    let items = [];
    // One file that can't be made or written is noted for the end, and the rest carry on.
    const putOut = async (path, make, st) => {
      try {
        const bytes = await make();
        if (dir) {
          const parts = path.split('/'); let h = dir;
          for (const part of parts.slice(0, -1)) h = await h.getDirectoryHandle(part, { create: true });
          const w = await (await h.getFileHandle(parts[parts.length - 1], { create: true })).createWritable(); await w.write(bytes); await w.close();
        } else files[path] = [bytes, { level: 0 }];
        return true;
      } catch (er) { console.error(path, er); failed.push({ path, st, why: exportWhy(er, !!dir) }); return false; }
    };
    try {
      // Grades are read and cropped first, from the files as they are now; then everything is flattened.
      say('Reading the grades…');
      await scanAll((n, t) => { bar.firstChild.style.width = (30 * n / t) + '%'; });
      items = exportPlan(keep);
      if (withSheet) {
        const name = ('Grade sheet - ' + batch.name + '.pdf').replace(/[\\/:*?"<>|]+/g, '-');
        await putOut(name, buildSheetPdf);
      }
      let nOut = 0;
      for (let i = 0; i < items.length; i++) {
        say('Baking in marks ' + (i + 1) + ' of ' + items.length + '…');
        bar.firstChild.style.width = (30 + 70 * i / items.length) + '%';
        if (await putOut(items[i].path, () => items[i].raw ? items[i].f.data : flattenDoc(items[i].st, items[i].d, dpi, editable, withKey), items[i].st)) nOut++;
      }
      await unopenable(failed);
      bar.firstChild.style.width = '100%';
      let done = '';
      if (!dir && !Object.keys(files).length) say('Nothing could be exported.', true);
      else if (go.dataset.go === 'drive') {
        const plain = {}; for (const [k, v] of Object.entries(files)) plain[k] = v[0];
        const fname = 'Marked - ' + batch.name;
        await saveToDrive(fname, plain, (n, t) => { say('Saving to Google Drive ' + n + ' of ' + t + '…'); });
        say(done = 'Done. Saved to Google Drive in “' + fname + '”' + (batch.drive && batch.drive.kind === 'folder' ? ', inside the folder you opened.' : batch.drive ? ', next to the ZIP you opened.' : ', in My Drive.'), true);
      } else {
        if (!dir) saveBlob('Marked - ' + batch.name + '.zip', new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
        say(done = 'Done. ' + nOut + (nOut === 1 ? ' file' : ' files') + (dir ? ' saved into “' + dir.name + '”.' : ' in the ZIP.'), true);
      }
      if (nOut && (dir || Object.keys(files).length)) setReturned(nOut, done);
      exportReport(failed);
    } catch (er) {
      console.error(er); say('Something went wrong: ' + (er.message || er), true);
    }
    xBusy = false;
    for (const b of box.querySelectorAll('[data-go]')) b.disabled = false;
  };
}
// Export one student's paper on its own, right after marking it, so their feedback can go out now.
// Same rules as Export marked (a file with any mark goes back whole, scored Word rubrics as Word files) and her saved export options.
function sentWhen(t) {
  const d = new Date(t), now = new Date(), hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + hm;
}
function oneOutHtml(st) {
  if (!st.files.length) return '';
  const nm = anonOn() ? 'this' : esc(st.key) + '’s', g = st.grade;
  return '<div class="oneout"><button class="link" id="oneOutBtn" title="Download just this student’s marked file, ready to upload. Uses the options on the Return tab.">Export ' + nm + ' paper now</button>' +
    '<p class="oneout-say' + (g.sent ? ' ok' : '') + '" id="oneOutSay">' + (g.sent ? '✓ Exported at ' + esc(sentWhen(g.sent)) + '. Export again after any change.' : '') + '</p></div>';
}
async function exportOne(st) {
  if (xBusy) return toast('The last export is still going. It will say when it’s done.');
  const btn = $('#oneOutBtn'), say = t => { const el = $('#oneOutSay'); if (el) { el.className = 'oneout-say'; el.textContent = t; } };
  saveNow(); commitEditors(); wordScoresAll();
  if (batch.lineBusy) await batch.lineRun;
  const b0 = batch, mine = () => exportPlan(false).filter(o => o.st === st);
  let items = mine();
  if (!items.length && (!scanned || scanP)) { say('Reading the paper first…'); await scanAll(); if (batch !== b0) return; items = mine(); }   // a typed grade alone counts as a mark
  const who = anonOn() ? 'this paper' : st.key + '’s paper';
  if (!items.length) { renderGrade(); return toast('Nothing on ' + who + ' is marked yet. Mark it, then export.'); }
  xBusy = true; if (btn) btn.disabled = true;
  const files = {}, failed = [];
  try {
    for (let i = 0; i < items.length; i++) {
      say(items.length > 1 ? 'Baking in marks ' + (i + 1) + ' of ' + items.length + '…' : 'Baking in marks…');
      const o = items[i];
      const base = o.path.split('/').pop(), name = base.includes(st.key) ? base : st.key + ' - ' + base;   // her own download names each file for its student
      try { files[name] = o.raw ? o.f.data : await flattenDoc(st, o.d, 150, xEdit(), keyOn()); }
      catch (er) { console.error(o.path, er); failed.push({ path: o.path, st, why: exportWhy(er, false) }); }
    }
    const names = Object.keys(files);
    if (!names.length) throw new Error('the file couldn’t be made');
    if (names.length === 1) await saveBlob(names[0], new Blob([files[names[0]]], { type: /\.pdf$/i.test(names[0]) ? 'application/pdf' : 'application/octet-stream' }));
    else { const z = {}; for (const n of names) z[n] = [files[n], { level: 0 }]; await saveBlob(st.key + ' - ' + batch.name + '.zip', new Blob([fflate.zipSync(z)], { type: 'application/zip' })); }
    if (batch !== b0) return;
    st.grade.sent = Date.now(); saveSoon();
    toast(names.length === 1 ? 'Saved “' + names[0] + '”.' : 'Saved ' + names.length + ' files for ' + (anonOn() ? 'this student' : st.key) + ' in one ZIP.', 5000);
    if (failed.length) sayDlg(failed.length + (failed.length === 1 ? ' file couldn’t' : ' files couldn’t') + ' be made: ' + failed.map(f => f.path.split('/').pop() + ' (' + f.why + ')').join(', ') + '. The rest downloaded.');
  } catch (er) { console.error(er); toast('Something went wrong: ' + (er.message || er), 6000); }
  finally { xBusy = false; }
  if (batch === b0) { renderList(); if (batch.students[cur] === st) renderGrade(); }
}
// Inside a published claude.ai page, files are offered through its downloads prompt; as a local file, a normal download.
const downloadsP = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
async function saveBlob(name, blob) {
  name = name.replace(/[\\/:*?"<>|]+/g, '-');
  const dl = await downloadsP;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return; }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('One moment, then try again'); return; } }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

