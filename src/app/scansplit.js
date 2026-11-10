/* ---------------- split a scan: one PDF of everyone's papers (any order), pages dragged onto names on the roster ---------------- */
let SP = null;   // { name, data, doc, n, thumbs[], raw[], ink[], owner[], more{}, skip:Set, sel:Set, re:Set, L, Lp{}, keepL, several, anchor, names[], classId, asg, last, size }
// Group work: owner[i] is the first student a page went to, more[i] anyone else it went to. Each of them gets their own copy.
// With a download open (into), the pages go to students in it, like a makeup scan for students who missed the day.
// Names are the roster's plus anyone in the download the roster doesn't name.
function splitIntoNames(c) {
  const r = c ? c.names.slice() : [], m = rosterMatch(r), used = new Set(m.values());
  return r.concat(batch.students.filter(st => !used.has(st)).map(st => st.key));
}
async function openSplit(file, assignment, into) {
  const data = new Uint8Array(await file.arrayBuffer());
  await workerReady;
  let doc;
  try { doc = await pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise; }
  catch { return toast('Couldn’t open ' + file.name + ' as a PDF'); }
  const c = into ? batchClass() : assignment && assignment.classId ? classById(assignment.classId) : (lib.classes.find(k => k.names.length) || null);
  SP = { name: file.name.replace(/\.pdf$/i, ''), data, doc, n: doc.numPages, thumbs: [], ink: [], sc: {}, rot: {}, skew: {}, owner: Array(doc.numPages).fill(''), more: {}, raw: [], re: new Set(), L: null, Lp: {}, keepL: true, several: false, skip: new Set(), sel: new Set(), anchor: 0,
    names: into ? splitIntoNames(c) : c ? c.names.slice() : [], classId: c ? c.id : '', asg: assignment || null, into: !!into, last: 1, size: +(store.get('gs.spsize', 1)) };
  if (into) splitPick(0, 1);
  if (!into) splitPick(0, splitGuess());
  splitShell(); splitRender();
}
const spClass = () => SP.classId ? classById(SP.classId) : null;
// A first guess at pages per student, so the first pick is a whole paper: page count over roster size when it comes out even.
function splitGuess() {
  const r = SP.names.length;
  if (!r || SP.n < r) return 1;
  return SP.n % r === 0 ? SP.n / r : 1;
}
const spFree = i => !SP.owner[i] && !SP.skip.has(i);
// Select k pages that nobody has yet, starting at page i.
function splitPick(i, k) {
  SP.sel = new Set();
  for (let p = i; p < SP.n && SP.sel.size < k; p++) if (spFree(p)) SP.sel.add(p);
  SP.anchor = SP.sel.size ? Math.min(...SP.sel) : 0;
}
async function splitRender() {
  const me = SP;
  for (let i = 0; i < me.n && SP === me; i++) {
    if (me.thumbs[i]) continue;
    const page = await me.doc.getPage(i + 1);
    await scanSplitLook(me, i, page);
    if (SP !== me) return;
    const vp0 = spView(me, i, page, 1), vp = spView(me, i, page, 520 / vp0.width);
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    try { await page.render({ canvasContext: ctx, viewport: vp, transform: spXf(me, i, vp), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise; } catch {}
    me.ink[i] = splitInk(ctx, cv.width, cv.height);
    me.raw[i] = cv.toDataURL('image/jpeg', .78);
    const L = spLight(me, i); if (L) lightCanvas(ctx, cv.width, cv.height, L);
    me.thumbs[i] = L ? cv.toDataURL('image/jpeg', .78) : me.raw[i];
    if (SP !== me) return;
    const im = document.querySelector('#spPages img[data-th="' + i + '"]'); if (im) im.src = me.thumbs[i];
    const st = $('#spStat'); if (st) st.textContent = i + 1 < me.n ? 'Reading pages… ' + (i + 1) + ' of ' + me.n : '';
  }
  if (SP === me && $('#spStat')) $('#spStat').textContent = scanSplitSays(me);
}
// Share of dark pixels, ignoring a margin where scanners leave edge shadows.
function splitInk(ctx, w, h) {
  const m = Math.round(w * .06), d = ctx.getImageData(m, m, w - 2 * m, h - 2 * m).data; let dark = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] < 400) dark++;
  return dark / (d.length / 16);
}
const spWho = (me, i) => me.owner[i] ? [me.owner[i], ...(me.more[i] || [])] : [];
const spPagesOf = nm => SP.owner.map((o, i) => spWho(SP, i).includes(nm) ? i : -1).filter(i => i >= 0);
const spAll = me => [...new Set(me.owner.flatMap((_, i) => spWho(me, i)))];
// Take one student off a page; the next one on it, if any, becomes its first.
function spTakeOff(i, nm) {
  if (SP.owner[i] === nm) SP.owner[i] = (SP.more[i] || []).shift() || '';
  else if (SP.more[i]) SP.more[i] = SP.more[i].filter(x => x !== nm);
  if (SP.more[i] && !SP.more[i].length) delete SP.more[i];
}
// "1-3, 7" from [0,1,2,6]
function spRange(list) {
  const out = []; let a = null, b = null;
  for (const p of list) { if (a != null && p === b + 1) { b = p; continue; } if (a != null) out.push(a === b ? a + 1 : (a + 1) + '–' + (b + 1)); a = b = p; }
  if (a != null) out.push(a === b ? a + 1 : (a + 1) + '–' + (b + 1));
  return out.join(', ');
}
function splitShell() {
  const c = spClass();
  openDlg('<div class="bh"><h2>Split a scan: ' + esc(SP.name) + '</h2><span class="muted" id="spStat"></span><span class="muted">' + SP.n + ' pages</span></div>' +
    '<div class="spwrap"><div class="spleft">' +
      '<div class="spbar"><span class="seg" id="spSize"><button data-sz="0">S</button><button data-sz="1">M</button><button data-sz="2">L</button></span>' +
        '<button class="btn sm" id="spLight" aria-pressed="false" title="Brightness, contrast, darker writing, sharpen and black and white, for hard-to-read pages">☀ Lighting</button>' +
        '<button class="btn sm" id="spRe" title="Flag the picked pages as needing a rescan. You can still give them to a student.">⚑ Needs rescan</button>' +
        '<button class="btn sm" id="spSev" aria-pressed="false" title="Group work: clicking a name adds that student to the picked pages and keeps the ones already on them">Give to several</button>' +
        '<button class="btn sm" id="spBlank">Leave out blank pages</button><button class="btn sm" id="spSkip">Leave out selected</button><span class="sp"></span><span id="spSelInfo"></span></div>' +
      '<p class="muted sphint">Click a page, then Shift-click another to pick a range (' + modKey() + '-click adds one page). Drag the pages onto a name, click the name, or type it and press Enter. After that, one Shift-click picks from the next page up to the one you click. Double-click a page to see it big. For group work, turn on Give to several and click each name.</p>' +
      '<div id="spPages"></div></div>' +
    '<div class="spright"><div class="spbar"><label>Class <select class="btn" id="spCls"><option value="">No roster</option>' + lib.classes.map(k => '<option value="' + k.id + '"' + (c && c.id === k.id ? ' selected' : '') + '>' + esc(k.name) + ' (' + k.names.length + ')</option>').join('') + '</select></label></div>' +
      '<input class="btn" id="spFind" placeholder="Type a name, Enter to give it the pages" autocomplete="off">' +
      '<div id="spNames"></div><button class="link" id="spAdd" style="margin-top:8px">+ Add a name</button></div></div>' +
    '<div class="bf" style="justify-content:space-between;align-items:center"><span class="muted" id="spFoot" style="font-size:13px"></span>' +
      '<span style="display:flex;gap:8px"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="spGo">' + (SP.into ? 'Add to this download' : 'Open for grading') + '</button></span></div>');
  const box = $('#dlgBox'); box.classList.add('spbox');
  splitDraw();
  box.ondblclick = ev => { const pg = ev.target.closest('.spg'); if (pg) splitZoom(+pg.dataset.spg); };
  box.onclick = async ev => {
    const t = ev.target;
    if (t.closest('#spBlankView')) return;
    if (t.closest('#spLightP')) return spLightClick(ev);
    if (t.closest('#spLight')) return spLightOpen();
    if (t.closest('[data-cancel]')) { SP = null; splitZoomClose(); return closeDlg(); }
    const pg = t.closest('.spg');
    if (pg) {
      const i = +pg.dataset.spg, fx = t.closest('[data-spfix]');
      if (fx) return scanSplitFix(i, fx.dataset.spfix);
      if (t.closest('[data-zoom]')) return splitZoom(i);
      if (t.closest('[data-unpg]')) { SP.owner[i] = ''; delete SP.more[i]; SP.skip.delete(i); return splitDraw(); }
      if (ev.shiftKey) { SP.sel = new Set(); const [a, b] = [Math.min(SP.anchor, i), Math.max(SP.anchor, i)]; for (let p = a; p <= b; p++) if (spFree(p) || a === b) SP.sel.add(p); ev.preventDefault(); }
      else if (ev.metaKey || ev.ctrlKey) { SP.sel.has(i) ? SP.sel.delete(i) : SP.sel.add(i); SP.anchor = i; }
      else { SP.sel = new Set([i]); SP.anchor = i; }
      return splitDrawSel();
    }
    const nr = t.closest('[data-spn]');
    if (nr) {
      if (t.closest('[data-unall]')) { const nm = SP.names[+nr.dataset.spn]; for (let i = 0; i < SP.n; i++) spTakeOff(i, nm); return splitDraw(); }
      return splitGive(SP.names[+nr.dataset.spn]);
    }
    if (t.closest('#spBig')) return splitZoomClose();
    const sz = t.closest('[data-sz]');
    if (sz) { SP.size = +sz.dataset.sz; store.set('gs.spsize', SP.size); return splitDraw(); }
    if (t.id === 'spSev') { SP.several = !SP.several; t.setAttribute('aria-pressed', SP.several); return toast(SP.several ? 'Give to several is on: each name you click is added to the picked pages' : 'Give to several is off'); }
    if (t.id === 'spRe') {
      if (!SP.sel.size) return toast('Pick the pages that need a rescan first');
      const all = [...SP.sel].every(p => SP.re.has(p));
      for (const p of SP.sel) all ? SP.re.delete(p) : SP.re.add(p);
      return splitDraw();
    }
    if (t.id === 'spSkip') { if (!SP.sel.size) return toast('Pick the pages to leave out first'); for (const p of SP.sel) { SP.skip.add(p); SP.owner[p] = ''; delete SP.more[p]; } const last = Math.max(...SP.sel); splitPick(last + 1, SP.last); return splitDraw(); }
    if (t.id === 'spBlank') {
      if (SP.ink.filter(v => v != null).length < SP.n) return toast('Still reading the pages, try again in a moment');
      const blank = SP.ink.map((v, i) => (SP.sc[i] ? SP.sc[i].blank : v < .0015) && !SP.owner[i] && !SP.skip.has(i) ? i : -1).filter(i => i >= 0);
      if (!blank.length) return toast('No blank pages found');
      return splitBlankView(blank);
    }
    if (t.id === 'spAdd') { const nm = (await askTextDlg('Student’s name', '', { ok: 'Add' }) || '').trim(); if (nm && !SP.names.includes(nm)) SP.names.push(nm); return splitDraw(); }
    if (t.id === 'spGo') { const was = t.textContent; return splitGo(t).catch(er => { console.error(er); t.disabled = false; t.textContent = was; toast('A page is too big to turn into a picture. Nothing was opened.'); }); }
  };
  box.onchange = ev => {
    if (ev.target.id !== 'spCls') return;
    SP.classId = ev.target.value; const k = spClass();
    const extra = spAll(SP).filter(nm => !(k ? k.names : []).includes(nm));
    SP.names = SP.into ? splitIntoNames(k) : (k ? k.names.slice() : []);
    SP.names = SP.names.concat(extra.filter(nm => !SP.names.includes(nm)));
    splitDraw();
  };
  const live = { signal: dlgOff.signal };
  box.addEventListener('dragstart', ev => {
    const pg = ev.target.closest && ev.target.closest('.spg'); if (!pg) return;
    const i = +pg.dataset.spg; if (!SP.sel.has(i)) { SP.sel = new Set([i]); SP.anchor = i; splitDraw(); }
    ev.dataTransfer.setData('text/plain', 'pages'); ev.dataTransfer.effectAllowed = 'move';
    const sel = [...SP.sel].sort((a, b) => a - b), gh = document.createElement('div'); gh.className = 'spghost';
    gh.textContent = (sel.length === 1 ? 'Page ' : sel.length + ' pages: ') + spRange(sel); document.body.appendChild(gh);
    ev.dataTransfer.setDragImage(gh, 20, 20); setTimeout(() => gh.remove(), 0);
  }, live);
  box.addEventListener('dragover', ev => { const nr = ev.target.closest && ev.target.closest('[data-spn]'); if (!nr) return; ev.preventDefault(); for (const x of box.querySelectorAll('.spname.over')) if (x !== nr) x.classList.remove('over'); nr.classList.add('over'); }, live);
  box.addEventListener('dragleave', ev => { const nr = ev.target.closest && ev.target.closest('[data-spn]'); if (nr && !nr.contains(ev.relatedTarget)) nr.classList.remove('over'); }, live);
  box.addEventListener('drop', ev => { const nr = ev.target.closest && ev.target.closest('[data-spn]'); if (!nr) return; ev.preventDefault(); nr.classList.remove('over'); splitGive(SP.names[+nr.dataset.spn]); }, live);
  const find = $('#spFind');
  find.oninput = () => splitDrawNames();
  find.onkeydown = ev => {
    if (ev.key !== 'Enter') return; ev.preventDefault();
    const m = splitMatches(); if (m.length) { splitGive(SP.names[m[0]]); find.value = ''; splitDrawNames(); }
  };
}
// One page big enough to read a handwritten name; any click or Esc closes it.
const splitZoom = i => bigPage(SP.doc, i, SP.thumbs[i], SP);
async function bigPage(doc, i, thumb, sp, cov) {
  splitZoomClose();
  if (!doc) return;
  const d = document.createElement('div'); d.id = 'spBig'; d.innerHTML = '<img alt="Page ' + (i + 1) + '" src="' + (thumb || '') + '"><span>Page ' + (i + 1) + ' · click or Esc to close</span>';
  $('#dlgBox').appendChild(d);
  const esc1 = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); splitZoomClose(); } };
  window.addEventListener('keydown', esc1, true); d._esc = esc1;
  const page = await doc.getPage(i + 1), hide = cov && anonOn(), plainVp = scale => hide ? page.getViewport({ scale, rotation: ((page.rotate || 0) + rotOf(cov.f, i) + (cov.turned || 0)) % 360 }) : page.getViewport({ scale });
  const vp0 = sp ? spView(sp, i, page, 1) : plainVp(1), vp = sp ? spView(sp, i, page, 1400 / vp0.width) : plainVp(1400 / vp0.width);
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  try { await page.render({ canvasContext: ctx, viewport: vp, transform: sp ? spXf(sp, i, vp) : hide ? skewXf(cov.f, i, vp) : undefined }).promise; } catch {}
  if (hide) await anonPaint(ctx, cov.st, cov.f, i, page, vp, cov.turned);
  const L = sp && spLight(sp, i); if (L) lightCanvas(ctx, cv.width, cv.height, L);
  if (d.isConnected) d.querySelector('img').src = cv.toDataURL('image/jpeg', .85);
}
function splitZoomClose() { const d = $('#spBig'); if (d) { window.removeEventListener('keydown', d._esc, true); d.remove(); } }
// Leave out blank pages shows her the pages first. Very faint writing can still be called blank, so nothing goes until she has seen each page and pressed the button here.
async function splitBlankView(list) {
  const me = SP, kept = new Set(), v = document.createElement('div'); v.id = 'spBlankView';
  v.innerHTML = '<div class="bh"><h2>Leave out these pages?</h2><span class="muted">They look blank</span></div>' +
    '<div class="bb"><p style="margin-top:0">Check each page before it goes. They’re drawn darker here so faint writing shows up, and the student’s file doesn’t change. If you see any writing, press <b>Keep this page</b>. Click a page to see it big, as it was scanned.</p>' +
    '<div id="spBlankPages">' + list.map(i => '<div class="spbk" data-bk="' + i + '"><img src="' + (me.thumbs[i] || '') + '" alt="Page ' + (i + 1) + '"><div class="spbf"><b>Page ' + (i + 1) + '</b><button class="btn sm" data-bkkeep aria-pressed="false">Keep this page</button></div></div>').join('') + '</div></div>' +
    '<div class="bf"><button class="btn" id="spBlankNo">Keep them all</button><button class="btn primary" id="spBlankGo" disabled>Getting the pages ready…</button></div>';
  $('#dlgBox').appendChild(v);
  let ready = false;
  const go = v.querySelector('#spBlankGo'), left = () => list.filter(i => !kept.has(i));
  const count = () => { if (!ready) return; const n = left().length; go.disabled = !n; go.textContent = 'Leave out ' + n + (n === 1 ? ' page' : ' pages'); };
  const shut = () => { window.removeEventListener('keydown', esc1, true); v.remove(); };
  const esc1 = e => { if (e.key === 'Escape' && !$('#spBig')) { e.preventDefault(); e.stopPropagation(); shut(); } };
  window.addEventListener('keydown', esc1, { capture: true, signal: dlgOff.signal });
  v.onclick = ev => {
    const t = ev.target, card = t.closest('[data-bk]');
    if (t.id === 'spBlankNo') return shut();
    if (t.id === 'spBlankGo') {
      const out = left().filter(i => !me.owner[i]);
      for (const i of out) { me.skip.add(i); me.sel.delete(i); }
      shut(); toast(out.length + ' blank ' + (out.length === 1 ? 'page' : 'pages') + ' left out'); return splitDraw();
    }
    if (!card) return;
    const i = +card.dataset.bk, b = t.closest('[data-bkkeep]');
    if (!b) return t.tagName === 'IMG' && !card.classList.contains('bad') ? splitZoom(i) : undefined;
    const keep = !kept.has(i); keep ? kept.add(i) : kept.delete(i);
    card.classList.toggle('kept', keep); b.setAttribute('aria-pressed', keep); b.textContent = keep ? 'Kept · leave it out after all' : 'Keep this page';
    count();
  };
  v.querySelector('#spBlankNo').focus();
  for (const i of list) {
    const card = v.querySelector('[data-bk="' + i + '"]');
    try {
      const page = await me.doc.getPage(i + 1), vp0 = spView(me, i, page, 1), vp = spView(me, i, page, 900 / vp0.width);
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp, transform: spXf(me, i, vp), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      scanDarken(ctx, cv.width, cv.height);
      card.querySelector('img').src = cv.toDataURL('image/jpeg', .85);
      cv.width = cv.height = 0; page.cleanup();
    } catch (e) {   // a page that can't be drawn can't be checked, so it stays
      console.warn(e); kept.add(i); card.classList.add('kept', 'bad');
      card.querySelector('.spbf').innerHTML = '<b>Page ' + (i + 1) + '</b> <span class="muted">Couldn’t draw this page, so it stays in.</span>';
    }
    if (SP !== me || !v.isConnected) return;
  }
  ready = true; count();
}
function splitMatches() {
  const q = ($('#spFind') && $('#spFind').value || '').toLowerCase().split(/\s+/).filter(Boolean);
  const idx = SP.names.map((_, i) => i);
  if (!q.length) return idx;
  const words = nm => nm.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return idx.filter(i => q.every(w => words(SP.names[i]).some(x => x.startsWith(w))))
    .sort((a, b) => (spPagesOf(SP.names[a]).length ? 1 : 0) - (spPagesOf(SP.names[b]).length ? 1 : 0));
}
function splitGive(nm) {
  if (!nm) return;
  if (!SP.sel.size) return toast('Pick the pages first');
  const list = [...SP.sel].sort((a, b) => a - b);
  if (SP.several) {   // group work: the pages stay picked, so the next name clicked is added too
    for (const p of list) { SP.skip.delete(p); if (!SP.owner[p]) SP.owner[p] = nm; else if (!spWho(SP, p).includes(nm)) (SP.more[p] ||= []).push(nm); }
    return splitDraw();
  }
  for (const p of list) { SP.owner[p] = nm; delete SP.more[p]; SP.skip.delete(p); }
  SP.last = list.length;
  SP.sel = new Set();
  let nx = list[list.length - 1] + 1; while (nx < SP.n && !spFree(nx)) nx++;
  if (nx >= SP.n) { nx = 0; while (nx < SP.n && !spFree(nx)) nx++; }
  SP.anchor = nx < SP.n ? nx : 0;
  splitDraw();
}
function splitDraw() {
  const W = [110, 160, 230][SP.size] || 160;
  for (const b of document.querySelectorAll('#spSize [data-sz]')) b.setAttribute('aria-pressed', +b.dataset.sz === SP.size);
  $('#spPages').style.setProperty('--spw', W + 'px');
  $('#spPages').innerHTML = Array.from({ length: SP.n }, (_, i) => {
    const o = SP.owner[i], sk = SP.skip.has(i);
    return '<div class="spg' + (SP.sel.has(i) ? ' sel' : '') + (o ? ' own' : '') + (sk ? ' skip' : '') + '" data-spg="' + i + '" draggable="true">' +
      '<img data-th="' + i + '" src="' + (SP.thumbs[i] || '') + '" alt="Page ' + (i + 1) + '" draggable="false">' +
      '<span class="sppick"></span><button class="spzoom" data-zoom title="See this page big">⤢</button><button class="spturn" data-spfix="right" title="Turn this page to the right" aria-label="Turn this page to the right">⟳</button><span class="spfl" data-fl="' + i + '">' + scanCard(i) + '</span>' +
      '<div class="spf"><span class="spno">' + (i + 1) + '</span>' +
      (o || sk ? (sk ? '<span class="spown">Left out</span>' : '<span class="spown" title="' + esc(spWho(SP, i).join(', ')) + '">' + esc(o) + (SP.more[i] ? ' +' + SP.more[i].length : '') + '</span>') + '<button data-unpg title="Take this page back">×</button>' : '') + '</div></div>';
  }).join('');
  splitDrawSel();
  splitDrawNames();
}
// Selection only: the page cards stay in place, so a double-click still lands on them.
function splitDrawSel() {
  const sel = [...SP.sel].sort((a, b) => a - b);
  for (const el of document.querySelectorAll('#spPages .spg')) {
    const k = sel.indexOf(+el.dataset.spg); el.classList.toggle('sel', k >= 0);
    el.querySelector('.sppick').textContent = k >= 0 ? (sel.length > 1 ? (k + 1) + ' of ' + sel.length : 'Picked') : '';
  }
  const info = $('#spSelInfo');
  info.textContent = sel.length ? (sel.length === 1 ? 'Page ' : 'Pages ') + spRange(sel) + ' picked' : (spFree(SP.anchor) && SP.owner.some(Boolean) ? 'Next starts at page ' + (SP.anchor + 1) + ': Shift-click its last page' : 'No pages picked');
  info.classList.toggle('on', !!sel.length);
}
function splitDrawNames() {
  const m = splitMatches(), q = $('#spFind').value.trim();
  $('#spNames').innerHTML = (m.length ? m.map((i, k) => {
    const nm = SP.names[i], pg = spPagesOf(nm);
    return '<div class="spname' + (pg.length ? ' has' : '') + (q && k === 0 ? ' top' : '') + '" data-spn="' + i + '"><span class="spck">' + (pg.length ? '✓' : '') + '</span><b>' + esc(nm) + '</b>' +
      (pg.length ? '<span class="muted">p. ' + spRange(pg) + (pg.some(p => SP.more[p]) ? ' · shared' : '') + (pg.some(p => SP.re.has(p)) ? ' · ⚑' : '') + '</span><button class="link" data-unall title="Take these pages back">undo</button>' : '') + '</div>';
  }).join('') : '<p class="muted" style="font-size:13px">' + (SP.names.length ? 'No name matches.' : 'Pick a class above, or add names.') + '</p>');
  const given = SP.owner.filter(Boolean).length, left = SP.n - given - SP.skip.size, who = spAll(SP).length, shared = Object.keys(SP.more).length, re = SP.re.size;
  const none = SP.names.filter(nm => !spPagesOf(nm).length);
  $('#spFoot').innerHTML = who + (who === 1 ? ' student' : ' students') + ' · ' + given + ' of ' + SP.n + ' pages given' +
    (shared ? ' · ' + shared + (shared === 1 ? ' page' : ' pages') + ' shared' : '') + (re ? ' · ' + re + (re === 1 ? ' page needs' : ' pages need') + ' a rescan' : '') +
    (left ? ' · <b style="color:var(--warn)">' + left + (left === 1 ? ' page' : ' pages') + ' not given to anyone yet (left out if you open now)</b>' : '') +
    (none.length && who ? ' · No pages: ' + esc(none.join(', ')) : '');
  $('#spGo').disabled = !who;
}
// One page drawn as a picture into a new PDF, at its own size.
async function rasterInto(out, jsDoc, i, dpi) {
  const page = await jsDoc.getPage(i + 1), vp1 = page.getViewport({ scale: 1 }), k = dpi / 72;
  const c = document.createElement('canvas'); c.width = Math.ceil(vp1.width * k); c.height = Math.ceil(vp1.height * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: k }), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const jpg = await canvasJpg(c, 0.9);
  out.addPage([vp1.width, vp1.height]).drawImage(await out.embedJpg(jpg), { x: 0, y: 0, width: vp1.width, height: vp1.height });
  c.width = c.height = 0; page.cleanup();
}
async function splitGo(btn) {
  btn.disabled = true; btn.textContent = 'Making each student’s paper…';
  const me = SP, src = await PDFLib.PDFDocument.load(me.data, { ignoreEncryption: true, updateMetadata: false });
  const file = ((me.asg && me.asg.name) || me.name).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Scan';
  const entries = [], t0 = Date.now(), all = spAll(me), pagesOf = nm => me.owner.map((_, i) => spWho(me, i).includes(nm) ? i : -1).filter(i => i >= 0);
  // Lighting set for the whole scan is the download's own; set page by page, it goes to each student who got one of those pages.
  const wide = me.keepL && me.L && !Object.keys(me.Lp).length && !me.into;
  for (const [k, nm] of all.entries()) {
    const out = await PDFLib.PDFDocument.create(), mine = pagesOf(nm);
    out.setModificationDate(new Date(t0 + k * 1000));   // group work: two students' copies of the same pages are still two files, each found again by its own bytes (the date is kept to the second)
    if (!src.isEncrypted) { for (const pg of await out.copyPages(src, mine)) out.addPage(pg); }
    else for (const i of mine) await rasterInto(out, me.doc, i, 200);   // a locked PDF copies as blank pages
    const made = await out.save(); scanHint(me, made, mine, nm, me.keepL && !wide);
    entries.push({ path: nm.replace(/[\\/:*?"<>|]+/g, ' ').trim() + '/' + file + '.pdf', data: made });
  }
  SP = null; closeDlg(); me.doc.destroy();
  if (me.into && batch) {   // each student's pages are added to them as a file of their own; someone new to the download is added
    const c = me.classId ? classById(me.classId) : null, m = c ? rosterMatch(c.names) : new Map(), keep = batch.students[cur];
    let first = null;
    for (const e of entries) {
      const nm = e.path.slice(0, e.path.indexOf('/')), owner = all.find(o => o.replace(/[\\/:*?"<>|]+/g, ' ').trim() === nm) || nm;
      let st = batch.students.find(x => x.key === owner) || m.get(owner);
      if (!st) { st = { key: nm, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; batch.students.push(st); }
      await addFiles(st, [{ path: e.path, file: new File([e.data], me.name + '.pdf', { type: 'application/pdf' }) }], true);
      first ||= st;
    }
    scanHintsAll(); if (Object.keys(me.Lp).length || me.L) lightPagesChanged();
    rosterSort(); cur = Math.max(0, batch.students.indexOf(keep));
    setBatchName();
    saveNow(); renderList();
    if (first) openStudent(batch.students.indexOf(first));
    return toast('Added pages for ' + entries.length + (entries.length === 1 ? ' student' : ' students'));
  }
  await intake(entries, me.name, me.asg);
  if (wide && batch) { batch.light = { ...(batch.light || {}), '*': { ...me.L } }; batch.lightOpt = { ...lightOpts(), on: true }; }
  scanHintsAll();
  if (batch && me.keepL && (me.L || Object.keys(me.Lp).length)) lightPagesChanged();
  if (batch) renderList();   // the ⚑ and shared tags
  if (me.classId && batch) { batch.classId = me.classId; renderClassSel(); saveNow(); renderList(); }
}

