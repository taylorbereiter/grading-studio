/* ---------------- the open student ---------------- */
let pages = [];          // on-screen pages for the open student
let docs = [];           // pdf.js documents for the open student
let docMap = new Map();  // source path -> pdf.js document, for the open student
let openToken = 0;
// One helper thread reads every paper she looks at, and stays for the next one. Starting a new one for each student took most of the wait between papers.
let viewW = null, lastSheet = null;   // lastSheet: the size on screen of the first page last drawn
function viewWorker() {
  try { if (!viewW || viewW.destroyed) viewW = new pdfjsLib.PDFWorker({ name: 'papers' }); return viewW; }
  catch (e) { return undefined; }   // without it each paper gets its own, as before
}
async function openStudent(i, filePath) {
  if (!batch) return;
  commitEditors();
  const moved = cur !== Math.max(0, Math.min(batch.students.length - 1, i));
  cur = Math.max(0, Math.min(batch.students.length - 1, i));
  if (moved || rowOnOf !== batch.students[cur]) rowStart();
  if (moved && repSaw && repAll && cur !== repAt) repSaw();
  selected = null;
  if ($('#lightPanel')) $('#lightPanel').refresh();
  const token = ++openToken;
  for (const d of docs) d.destroy();
  docs = []; pages = []; docMap = new Map();
  renderList(); renderGrade(); saveSoon();
  const st = batch.students[cur];
  const paper = $('#paper');
  // The student's bar: who it is, then Readings, one Add menu, and a menu for the whole paper. What belongs to one file is under that file's own ⋯.
  const nRef = refsFor(st).length;
  paper.innerHTML = '<div class="who"><h2>' + esc(shownName(st, cur)) + '</h2>' + (anonOn() ? '' : whoBtn('data-wi="' + cur + '"', st.key)) + '<span>' + ((anonOn() ? anonPos(cur) : cur) + 1) + ' of ' + batch.students.length + '</span><span class="whosp"></span>' +
    '<button class="btn sm" id="readBtn" title="A reading, prompt or other file shown above the papers: for everyone, or a different one for this student">Readings' + (nRef ? ' <span class="atn">' + nRef + '</span>' : '') + '</button>' +
    kmWrap('<span aria-hidden="true">+</span> Add', 'id="addMenuBtn" class="btn sm" title="Add late or forgotten work to this student. You can also drop files on the paper or on a name."',
      '<button class="mitem" id="addFileBtn">A file…<small>A late or forgotten paper</small></button>' +
      '<button class="mitem" id="pasteTextBtn">Pasted text…<small>Work sent in an email or a message</small></button>' +
      '<button class="mitem" id="addVideoBtn">A video…<small>A link to a recording, and who is in it</small></button>' +
      '<button class="mitem" id="addNotesBtn">A notes page…<small>To write on while you watch or listen</small></button>' +
      '<button class="mitem" id="addScanBtn">From a scan…<small>A stack of pages scanned as one PDF</small></button>') +
    kmWrap('⋯', 'id="whoMore" class="btn sm kdots" aria-label="More for this paper" title="More for this paper"',
      (st.files.some(viewable) || fileSeq(st).length > 1 ? '<button class="mitem" id="arrangeBtn">Arrange pages<small>Combine files, reorder or take pages out</small></button>' : '') +
      (st.files.some(f => !f.virtual && !f.rubric && (viewable(f) || f.kind === 'docx')) ? '<button class="mitem" data-whodo="example">Use as an example<small>A strong paper or part of a page, with names covered</small></button>' : '') +
      '<button class="mitem" data-whodo="light">Lighting<small>Make a pale or too-bright scan easier to read</small></button>' +
      '<button class="mitem" data-whodo="calc">Calculator <kbd>=</kbd></button>', 'right') + '</div>' + groupBand(st);
  paper.scrollTop = 0;
  // A paper that is one file: the sheet stays where the last one was while this one is read, so nothing jumps between students.
  if (lastSheet && st.files.length === 1 && viewable(st.files[0]) && !refsFor(st).length && !refDoc()) paper.insertAdjacentHTML('beforeend', '<div class="pg" id="sheet0" style="width:' + lastSheet.w + 'px;height:' + lastSheet.h + 'px;background:linear-gradient(to right,#fff ' + lastSheet.p + 'px,#F6F7F9 0)"></div>');
  const sheetOff = () => { const g = $('#sheet0'); if (g) g.remove(); };
  if (!st.files.length) {
    paper.insertAdjacentHTML('beforeend', '<div class="nofile"><b>Nothing turned in yet.</b> Add their paper here, or drop the file on the page or on their name. You can still give a score without one.' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm primary" id="gapFile">Add their file…</button><button class="btn sm" id="gapPaste">Paste text…</button><button class="btn sm" id="gapVideo">A video…</button><button class="btn sm" id="gapNotes">A notes page…</button>' + (st.gap || batch.students.some(x => x.files.length) ? '<button class="btn sm" id="gapScan">From a scan…</button>' : '') + '</div></div>');
    $('#gapFile').onclick = () => pickAdd(st);
    $('#gapPaste').onclick = () => openPasteText(st);
    $('#gapVideo').onclick = () => openAddVideo(st);
    $('#gapNotes').onclick = () => openAddNotes(st);
    const gs = $('#gapScan'); if (gs) gs.onclick = () => { scanInto = true; scanFor = null; $('#scanIn').click(); };
  }
  curMedia = null; clipsBtn();
  for (const f of st.files.filter(f => f.kind === 'link')) { paper.insertAdjacentHTML('beforeend', '<div class="fhead"><span style="color:var(--fg)">' + esc(linkTitle(f)) + '</span><span>' + (vidRef(f.data) ? 'Video file' : 'Video link') + '</span>' + tryTag(st, f) + (f.added ? addTag(f) : '') + carryTag(f) + '<span style="flex:1"></span>' + fileMenu(moveLink(f) + removeLink(f)) + '</div>'); paper.appendChild(linkCard(st, f)); }
  for (const f of st.files.filter(f => f.kind === 'media')) { if (f.added || carryTag(f) || tryTag(st, f)) paper.insertAdjacentHTML('beforeend', '<div class="fhead"><span style="color:var(--fg)">' + esc(f.name) + '</span>' + tryTag(st, f) + (f.added ? addTag(f) : '') + carryTag(f) + '<span style="flex:1"></span>' + fileMenu(fileLinks(f)) + '</div>'); paper.appendChild(mediaCard(st, f)); }
  const rd = refDoc();
  if (rd) { const det = document.createElement('details'); det.className = 'refd'; det.open = store.get('gs.rdOpen', true); det.innerHTML = '<summary>Your document: ' + esc(rd.name) + '</summary>'; det.ontoggle = () => store.set('gs.rdOpen', det.open); paper.appendChild(det); docxCard(rd, rd.name).then(c => { c.querySelector('.fhead').remove(); det.appendChild(c); }); }
  for (const r of refsFor(st)) { const hold = document.createElement('div'); paper.appendChild(hold); refCard(r, st).then(c => { if (token === openToken) hold.replaceWith(c); }); }
  $('#readBtn').onclick = () => openReadings();
  await workerReady;
  for (const f of st.files.filter(viewable)) {
    try {
      await impAuto(f);
      if (token !== openToken) return;
      const doc = await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false, worker: viewWorker() }).promise;
      if (token !== openToken) { doc.destroy(); return; }
      docs.push(doc); docMap.set(f.path, doc); f.numPages = doc.numPages;
      gsFlatCheck(f, doc).then(flat => { if (flat && token === openToken) for (const q of pages) if (q.file === f && q.impFirst) impNote(q); });
    } catch (e) {
      pdfBad(f, e);
      sheetOff(); paper.appendChild(otherCard(f));
    }
  }
  if (token !== openToken) return;
  const seq = fileSeq(st), oneFile = seq.length === 1 && !!seq[0].d && !st.files.some(f => f.kind === 'media' || f.kind === 'link');
  if (!oneFile) sheetOff();
  for (const it of seq) {
    if (it.f) {   // a Word, text or other file, as one card
      const f = it.f, c = f.kind === 'docx' ? await wordCard(st, f) : f.kind === 'text' ? textCard(f) : otherCard(f);
      if (token !== openToken) return;
      const fh = c.querySelector('.fhead');
      if (fh && !f.virtual && !f.rubric) {   // Download joins Group work, Move to, Replace and Remove under the file's ⋯
        fh.insertAdjacentHTML('beforeend', tryTag(st, f) + carryTag(f) + fileMenu(moveLink(f) + fileLinks(f)));
        const dl = fh.querySelector('[data-wdl], [data-odl]'); if (dl) { dl.className = 'link'; fh.querySelector('.km').prepend(dl); }
      }
      paper.appendChild(c);
      if (filePath && f.path === filePath) c.scrollIntoView({ block: 'start' });
      continue;
    }
    const d = it.d, di = it.di, on = docIn(st, d), auto = docAuto(st, d), af = d.file && fileByPath(st, d.file);
    const one = af && !af.virtual && d.pages.every(([q]) => q === af.path || (fileByPath(st, q) || {}).virtual);   // her rubric page added on the end doesn't make it two files
    const head = document.createElement('div'); head.className = 'fhead';
    head.innerHTML = '<span style="color:var(--fg)">' + esc(d.name) + '</span><span>' + d.pages.length + (d.pages.length === 1 ? ' page' : ' pages') + '</span>' + tryTag(st, af || fileByPath(st, (d.pages[0] || [])[0])) + (af && af.added ? addTag(af) : '') + carryTag(batch.carry && d.pages.map(([q]) => fileByPath(st, q)).find(f => f && !f.virtual && batch.carry.flags[f.path])) +
      (on ? '' : '<span class="pill warn" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">' + (auto ? 'No marks, left out' : 'Left out') + '</span>') +
      '<span style="flex:1"></span>' + (on ? '' : '<button class="link" style="font-size:13px" data-inout="' + di + '">Bring back</button>') +
      fileMenu((on || auto ? '<button class="link" data-rotdoc="' + di + '" title="Turn every page of this file a quarter turn to the right">⟳ Turn all pages</button>' : '') + (one ? moveLink(af) + replaceLink(af) : '') + (on ? '<button class="link" data-inout="' + di + '" title="Keep this file off the screen and out of what goes back. Bring back undoes it.">Leave out</button>' : '') + (one ? removeLink(af) : ''));
    if (oneFile) whoHead(paper, head); else paper.appendChild(head);
    if (!on && !auto) continue;   // left out on purpose: just the bar
    for (const [path, p] of d.pages) {
      if (token !== openToken) return;
      const f = fileByPath(st, path), doc = docMap.get(path);
      if (!f || !doc || p >= doc.numPages) continue;
      let page;
      try { page = await doc.getPage(p + 1); } catch (e) { if (token !== openToken) return; (f.badPages ||= []).includes(p + 1) || f.badPages.push(p + 1); paper.insertAdjacentHTML('beforeend', '<div class="nofile" style="margin-bottom:12px">Page ' + (p + 1) + ' of <b>' + esc(f.name) + '</b> couldn’t be read. The student may need to turn it in again.</div>'); continue; }   // she moved on, which closes this student's files; or the page is damaged
      if (token !== openToken) return;
      await scanCheck(f, p, page);
      if (token !== openToken) return;
      const vp = vpRot(f, p, page, 1);
      const pg = { file: f, idx: p, page, W: vp.width, H: vp.height, side: sideScreen(vp.width), marks: () => (f.marks[p] ||= []) };
      const wrap = document.createElement('div'); wrap.className = 'pg';
      if (!on) wrap.style.opacity = '.75';
      const c = document.createElement('canvas');
      sheetOff(); wrap.appendChild(c); paper.appendChild(wrap);
      pg.wrap = wrap; pg.canvas = c;
      pages.push(pg);
      lightChip(pg); lightChips(); rotChip(pg, d.pages.length > 1 ? d.pages.findIndex(x => x[0] === path && x[1] === p) + 1 : 0); scanNote(pg);
      if (!pages.some(q => q !== pg && q.file === f)) { pg.impFirst = true; impNote(pg); }
      pg.extra = (f.kami && f.kami[p] && f.kami[p].notes) || [];
      bindPage(pg);
      await renderPage(pg);
      if (filePath && f.path === filePath && p === 0) (d.pages[0][0] === filePath ? head : wrap).scrollIntoView({ block: 'start' });   // from its bar, with Mark late and Remove in view
    }
  }
  sheetOff();
  goneList(st);
  renderTools();
}
// A paper that is one file: the file's name joins the student's bar and its ⋯ joins the paper's, so the page starts a line higher.
function whoHead(paper, head) {
  const who = paper.querySelector('.who'), sp = who && who.querySelector('.whosp'), menu = who && who.querySelector('#whoMore + .km');
  if (!sp || !menu) return paper.appendChild(head);
  const own = head.querySelector('.kmw'), gap = head.querySelector('span[style="flex:1"]');
  if (own) { menu.insertAdjacentHTML('beforeend', '<div class="kmhd">This file</div>'); for (const b of [...own.querySelector('.km').children]) menu.appendChild(b); own.remove(); }
  if (gap) gap.remove();
  head.classList.add('inl');
  who.insertBefore(head, sp);
}
$('#paper').addEventListener('click', e => {
  if (!e.target.closest('#lmenu, [data-lmenu]') && $('#lmenu')) $('#lmenu').remove();
  const lm = e.target.closest('[data-lm]'); if (lm) return lightMenuDo(lm.dataset.lm);
  if (e.target.closest('#lmenu')) return lightOwnClick(e);
  const lc = e.target.closest('.lchip'); if (lc) return lightChipClick(e, pages.find(q => q.chip === lc));
  if (e.target.closest('#arrangeBtn')) return openArrange();
  const rb = e.target.closest('[data-rot]');
  if (rb) { const pg = pages.find(q => q.rchip === rb.parentNode); if (pg) turnPages(pg.file, [pg.idx], +rb.dataset.rot); return; }
  const po = e.target.closest('[data-pgout]'); if (po) { const pg = pages.find(q => q.rchip === po.parentNode); if (pg) takePageOut(batch.students[cur], pg.file.path, pg.idx); return; }
  const bp = e.target.closest('[data-backpg]'); if (bp) { const [i, p] = bp.dataset.backpg.split('|'); const it = outPages(batch.students[cur])[+i]; if (it) bringPageBack(batch.students[cur], it[0], +p); return; }
  const rf = e.target.closest('[data-reflag]'); if (rf) { const pg = pages.find(q => q.rchip === rf.parentNode); if (pg) scanFlag(pg); return; }
  const shf = e.target.closest('[data-shfile]'); if (shf) return openShareFile(batch.students[cur], shf.dataset.shfile);
  if (e.target.closest('#grpBand') && groupClick(e)) return;
  const rd = e.target.closest('[data-rotdoc]');
  if (rd) {
    const st = batch.students[cur], d = layoutOf(st)[+rd.dataset.rotdoc]; if (!d) return;
    const by = new Map(); for (const [path, p] of d.pages) { if (!by.has(path)) by.set(path, []); by.get(path).push(p); }
    (async () => { for (const [path, list] of by) await turnPages(fileByPath(st, path), list, 1); })();
    return;
  }
  const mvf = e.target.closest('[data-mvfile]'); if (mvf) return openMoveFile(batch.students[cur], mvf.dataset.mvfile);
  if (e.target.closest('#addFileBtn')) return pickAdd(batch.students[cur]);
  if (e.target.closest('#pasteTextBtn')) return openPasteText(batch.students[cur]);
  if (e.target.closest('#addVideoBtn')) return openAddVideo(batch.students[cur]);
  if (e.target.closest('#addNotesBtn')) return openAddNotes(batch.students[cur]);
  if (e.target.closest('#addScanBtn')) { scanInto = true; scanFor = null; return $('#scanIn').click(); }
  const wd = e.target.closest('[data-whodo]'); if (wd) return wd.dataset.whodo === 'light' ? openLight() : wd.dataset.whodo === 'example' ? openUseExample(cur) : openCalc();
  const ra = e.target.closest('[data-rmfile]');
  if (ra) {   // two clicks, so a stray click can't throw a file away
    if (!ra.dataset.armed) { ra.dataset.armed = '1'; ra.textContent = 'Click again to remove'; ra.style.color = 'var(--warn)'; setTimeout(() => { if (ra.isConnected) { delete ra.dataset.armed; ra.textContent = 'Remove'; ra.style.color = ''; } }, 4000); return; }
    return removeFile(batch.students[cur], ra.dataset.rmfile);
  }
  const rpl = e.target.closest('[data-rplfile]'); if (rpl) return pickReplace(batch.students[cur], rpl.dataset.rplfile);
  const bk = e.target.closest('[data-backfile]'); if (bk) return bringBack(batch.students[cur], bk.dataset.backfile);
  const io = e.target.closest('[data-inout]');
  if (io) {
    const st = batch.students[cur], d = layoutOf(st)[+io.dataset.inout];
    setDocIn(st, d, !docIn(st, d)); renderList(); openStudent(cur);
  }
});

