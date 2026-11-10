/* ---------------- lighting: brightness, contrast and darker writing for washed-out scans (view only; the student's file is not changed) ---------------- */
const LIGHT0 = { b: 0, c: 0, d: 0, s: 0, g: 0 };
const lightKey = st => (batch.light && st && batch.light[st.key]) ? st.key : '*';
const lightFor = st => (batch && batch.light && ((st && batch.light[st.key]) || batch.light['*'])) || LIGHT0;
const lightOn = L => !!(L && (L.b || L.c || L.d || L.s || L.g));
// One lookup table per setting: contrast pulls ink away from white paper (white stays white), brightness lifts
// or dims everything, then a curve darkens faint pencil.
function lightLut(L) {
  const t = new Uint8ClampedArray(256), k = 1 + L.c / 100, g = 1 + L.d / 40;
  for (let v = 0; v < 256; v++) { let x = 1 - (1 - v / 255) * k + L.b / 200; x = Math.min(1, Math.max(0, x)); t[v] = Math.round(Math.pow(x, g) * 255); }
  return t;
}
// Lighting switches for the whole download: on/off, her setup rubric left alone unless she says so, used in the export.
const lightOpts = () => ({ on: true, rub: false, exp: true, ...((batch && batch.lightOpt) || {}) });
// Her rubric from Rubric setup.
const isRubricPage = f => !!(f.rubric || f.virtual);
// Pages she switched by hand, by student, file and page, so a choice moves with the page when pages are rearranged.
const lightPgKey = (st, f, p) => st.key + '|' + f.path + '|' + p;
const pageLitDefault = f => lightOpts().rub || !isRubricPage(f);
function pageLit(st, f, p, map) {
  const v = (map || (batch && batch.lightPg) || {})[lightPgKey(st, f, p)];
  return v != null ? v : pageLitDefault(f);
}
function setPageLit(st, f, p, on, map) {
  if (!map) map = batch.lightPg || (batch.lightPg = {});
  const k = lightPgKey(st, f, p);
  if (on === pageLitDefault(f)) delete map[k]; else map[k] = on;
}
// A page's own lighting, set from its ▾ menu, by the same student|path|page key. It stays while the page is switched off,
// so switching the page back on brings it back.
const pageOwnL = (st, f, p) => (batch && batch.lightPgL && batch.lightPgL[lightPgKey(st, f, p)]) || null;
function setPageOwnL(st, f, p, L) {
  const m = batch.lightPgL || (batch.lightPgL = {}), k = lightPgKey(st, f, p);
  if (L) m[k] = { ...LIGHT0, ...L }; else delete m[k];
}
const hasOwnL = st => !!(st && batch && batch.lightPgL && Object.keys(batch.lightPgL).some(k => k.startsWith(st.key + '|')));
const lightLive = st => { const o = lightOpts(); return !!st && o.on && (lightOn(lightFor(st)) || hasOwnL(st)); };
// The setting for one page, or null when lighting doesn't touch it.
function lightForPage(st, f, p) {
  if (!lightLive(st) || f.kind === 'docx' || !pageLit(st, f, p)) return null;
  const L = pageOwnL(st, f, p) || lightFor(st);
  return lightOn(L) ? L : null;
}
function lightCanvas(ctx, w, h, L) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data, t = lightLut(L);
  // Change each pixel's lightness and keep its color, so a slightly yellow scan doesn't turn bright yellow.
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8, sh = t[y] - y; if (L.g) d[i] = d[i + 1] = d[i + 2] = t[y]; else { d[i] += sh; d[i + 1] += sh; d[i + 2] += sh; } }   // black and white: the color goes, for a tinted page or colored paper
  if (L.s) lightSharpen(d, w, h, L.s);
  ctx.putImageData(im, 0, 0);
}
// Sharpen: each pixel's lightness pushed away from its neighbours' average (an unsharp mask), so soft edges of writing get crisp.
function lightSharpen(d, w, h, s) {
  const n = w * h, Y = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n), r = w > 1800 ? 2 : 1, k = s / 100 * 1.6, span = 2 * r + 1;
  for (let i = 0, j = 0; i < n; i++, j += 4) Y[i] = d[j] * .299 + d[j + 1] * .587 + d[j + 2] * .114;
  for (let y = 0; y < h; y++) {   // average across, then down
    const o = y * w;
    for (let x = 0; x < w; x++) { let a = 0; for (let q = -r; q <= r; q++) a += Y[o + Math.min(w - 1, Math.max(0, x + q))]; A[o + x] = a / span; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let q = -r; q <= r; q++) a += A[Math.min(h - 1, Math.max(0, y + q)) * w + x]; B[y * w + x] = a / span; }
  for (let i = 0, j = 0; i < n; i++, j += 4) { const sh = (Y[i] - B[i]) * k; d[j] += sh; d[j + 1] += sh; d[j + 2] += sh; }
}
function lightBmp(pg) {
  const L = lightForPage(batch && batch.students[cur], pg.file, pg.idx);
  if (!L) return pg.bmp;
  const key = L.b + '|' + L.c + '|' + L.d + '|' + (L.s || 0) + '|' + (L.g || 0);
  if (pg.adj && pg.adjSrc === pg.bmp && pg.adjKey === key) return pg.adj;
  const c = pg.adj && pg.adj.width === pg.bmp.width && pg.adj.height === pg.bmp.height ? pg.adj : document.createElement('canvas');
  c.width = pg.bmp.width; c.height = pg.bmp.height;
  const x = c.getContext('2d'); x.drawImage(pg.bmp, 0, 0);
  lightCanvas(x, c.width, c.height, L);
  pg.adj = c; pg.adjSrc = pg.bmp; pg.adjKey = key;
  return c;
}
// Auto: stretch the page so its faintest writing goes near black and the paper goes white.
function lightAuto(pg) {
  const b = pg.bmp, s = Math.min(1, 400 / b.width), c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s);
  const x = c.getContext('2d'); x.drawImage(b, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = new Uint32Array(256); let n = 0;
  for (let i = 0; i < d.length; i += 4) { h[Math.round(d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11)]++; n++; }
  const pct = p => { let a = 0; for (let v = 0; v < 256; v++) { a += h[v]; if (a >= n * p) return v / 255; } return 1; };
  const lo = pct(.002), hi = pct(.5);   // the darkest writing, and the paper
  if (hi - lo < .03) return { b: 0, c: 0, d: 30 };
  const k = Math.max(1, Math.min(5, .9 / (hi - lo))), bb = (1 - hi) * k * 200;
  return { b: Math.round(Math.max(-60, Math.min(60, bb))), c: Math.round((k - 1) * 100), d: 20 };
}
let lightRaf = 0;
function lightApply() { cancelAnimationFrame(lightRaf); lightRaf = requestAnimationFrame(() => { redrawAll(); lightChips(); for (const q of pages) scanNote(q); saveSoon(); }); }
function lightPagesChanged() { lightApply(); const lp = $('#lightPanel'); if (lp) lp.refresh(); }
// A ☀ tag in the corner of each page while lighting is on: click it to switch lighting off or on for that page.
function lightChip(pg) {
  const b = document.createElement('div'); b.className = 'lchip';
  b.innerHTML = '<button data-lpg title="Turn lighting off or on for this page. Shift-click another page’s ☀ to do every page in between.">☀ <span></span></button><button data-lmenu title="More: the rest of the file, the whole file, or the same page on every paper" aria-label="More lighting choices">▾</button>';
  pg.wrap.appendChild(b); pg.chip = b;
}
// Turn buttons in the top corner of each page (they show when the mouse is over the page).
function rotChip(pg, n) {
  const b = document.createElement('div'); b.className = 'rchip';
  b.innerHTML = (n ? '<span>p. ' + n + '</span>' : '') + '<button data-rot="-1" title="Turn this page to the left" aria-label="Turn this page to the left">⟲</button><button data-rot="1" title="Turn this page to the right" aria-label="Turn this page to the right">⟳</button><button data-reflag title="Needs a rescan: flag this page, or take the flag off" aria-label="Flag this page as needing a rescan">⚑</button><button data-pgout title="Take this page out. It waits at the bottom of the paper, with Bring back." aria-label="Take this page out">×</button>';
  pg.wrap.appendChild(b); pg.rchip = b;
}
function lightChips() {
  const st = batch && batch.students[cur], live = lightLive(st);
  for (const pg of pages) {
    if (!pg.chip) continue;
    const ok = live && pg.file.kind !== 'docx', on = ok && pageLit(st, pg.file, pg.idx);
    pg.chip.hidden = !ok; pg.chip.classList.toggle('off', !on);
    pg.chip.querySelector('span').textContent = on ? 'Lighting on' : 'Lighting off';
    const own = ok && !!pageOwnL(st, pg.file, pg.idx);
    pg.chip.classList.toggle('own', own);
    pg.chip.querySelector('[data-lpg]').title = (own ? 'This page has its own lighting (▾ to change it). ' : '') + 'Turn lighting off or on for this page. Shift-click another page’s ☀ to do every page in between.';
  }
}
let lightLast = null;   // the last page she switched, for Shift-click runs
function lightChipClick(e, pg) {
  if (!pg) return;
  if (e.target.closest('[data-lmenu]')) return lightMenu(pg);
  const st = batch.students[cur], want = !pageLit(st, pg.file, pg.idx);
  let run = [pg];
  if (e.shiftKey && lightLast && lightLast !== pg && pages.includes(lightLast)) { const a = pages.indexOf(lightLast), b = pages.indexOf(pg); run = pages.slice(Math.min(a, b), Math.max(a, b) + 1); }
  for (const q of run) setPageLit(st, q.file, q.idx, want);
  lightLast = pg;
  lightPagesChanged();
  if (run.length > 1) toast('Lighting ' + (want ? 'on' : 'off') + ' for ' + run.length + ' pages');
}
function lightMenu(pg) {
  const old = $('#lmenu'); if (old) { old.remove(); if (old._pg === pg) return; }
  const st = batch.students[cur], want = !pageLit(st, pg.file, pg.idx);
  const L = layoutOf(st), di = L.findIndex(d => d.pages.some(([q, p]) => q === pg.file.path && p === pg.idx)), d = L[di];
  const pos = d ? d.pages.findIndex(([q, p]) => q === pg.file.path && p === pg.idx) : -1, back = d ? d.pages.length - 1 - pos : -1;
  const nth = k => k === 0 ? 'last page' : k === 1 ? '2nd-to-last page' : k === 2 ? '3rd-to-last page' : (k + 1) + 'th-to-last page';
  const m = document.createElement('div'); m.id = 'lmenu'; m._pg = pg; m._at = { di, pos, back, want };
  m.innerHTML = '<div class="lmown"></div><div class="lmsep"></div><div class="dl">Turn lighting ' + (want ? 'on' : 'off') + ' for</div><button data-lm="page">Just this page</button>' +
    (d ? '<button data-lm="rest">This page and the rest of this file</button><button data-lm="file">Every page of this file</button>' +
      '<div class="dl">Every paper</div><button data-lm="from">Page ' + (pos + 1) + ' on every paper</button>' + (back !== pos ? '<button data-lm="back">The ' + nth(back) + ' on every paper</button>' : '') : '');
  m._d = d;
  pg.wrap.appendChild(m);
  lightOwnRender(m);
  m.addEventListener('input', lightOwnInput);
  m.addEventListener('change', e => { if (e.target.dataset.lpl) lightOwnRender(m); });   // after the slider is let go, so a drag isn't cut short
}
// The top of the ▾ menu: this page's own lighting, starting from what the page has now.
function lightOwnRender(m) {
  const pg = m._pg, st = batch.students[cur], L = pageOwnL(st, pg.file, pg.idx) || lightFor(st), { pos } = m._at, d = m._d;
  const row = (k, label, min, max) => '<label class="lmsl"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" data-lpl="' + k + '" value="' + (L[k] || 0) + '"><b>' + (L[k] || 0) + '</b></label>';
  m.querySelector('.lmown').innerHTML = '<div class="dl">This page</div>' +
    row('b', 'Brightness', -60, 60) + row('c', 'Contrast', 0, 400) + row('d', 'Darken writing', 0, 100) + row('s', 'Sharpen', 0, 100) +
    '<label class="lmchk"><input type="checkbox" data-lplg' + (L.g ? ' checked' : '') + '> Black and white</label>' +
    '<div class="lmacts"><button class="btn sm primary" data-lpauto>Auto fix this page</button><span style="flex:1"></span>' + (pageOwnL(st, pg.file, pg.idx) ? '<button class="link" data-lpsame>Same as the rest</button>' : '') + '</div>' +
    (d && pageOwnL(st, pg.file, pg.idx) ? '<div class="dl">Use this page’s lighting on</div>' + (pos < d.pages.length - 1 ? '<button data-lpcopy="rest">The rest of this file</button>' : '') + '<button data-lpcopy="from">Page ' + (pos + 1) + ' on every paper</button>' : '');
}
// Its own lighting for this page: the page is switched on too, so she sees what she's setting.
function lightOwnSet(m, L) {
  const pg = m._pg, st = batch.students[cur];
  setPageOwnL(st, pg.file, pg.idx, L);
  if (L && !pageLit(st, pg.file, pg.idx)) setPageLit(st, pg.file, pg.idx, true);
  lightPagesChanged();
}
function lightOwnInput(e) {
  const m = $('#lmenu'); if (!m) return;
  const pg = m._pg, st = batch.students[cur], cur0 = pageOwnL(st, pg.file, pg.idx) || lightFor(st);
  const k = e.target.dataset.lpl;
  if (k) { e.target.nextElementSibling.textContent = e.target.value; lightOwnSet(m, { ...cur0, [k]: +e.target.value }); return; }
  if (e.target.dataset.lplg != null) { lightOwnSet(m, { ...cur0, g: e.target.checked ? 1 : 0 }); lightOwnRender(m); }
}
async function lightOwnClick(e) {
  const m = $('#lmenu'); if (!m) return false;
  const pg = m._pg, st = batch.students[cur];
  if (e.target.closest('[data-lpauto]')) {
    if (!pg.bmp) { toast('This page is still loading'); return true; }
    const was = pageOwnL(st, pg.file, pg.idx) || lightFor(st);
    lightOwnSet(m, { ...lightAuto(pg), s: was.s || 0, g: was.g || 0 }); lightOwnRender(m); return true;
  }
  if (e.target.closest('[data-lpsame]')) { lightOwnSet(m, null); lightOwnRender(m); return true; }
  const cp = e.target.closest('[data-lpcopy]'); if (!cp) return false;
  const L = pageOwnL(st, pg.file, pg.idx), { di, pos } = m._at; m.remove();
  const put = (s, [path, p]) => { const f = fileByPath(s, path); if (!f) return 0; setPageOwnL(s, f, p, L); setPageLit(s, f, p, true); return 1; };
  let n = 0;
  if (cp.dataset.lpcopy === 'rest') { for (const it of layoutOf(st)[di].pages.slice(pos + 1)) n += put(st, it); toast('This page’s lighting on ' + n + ' more ' + (n === 1 ? 'page' : 'pages')); }
  else {
    await ensureCounts();
    for (const s of batch.students) { const ds = layoutOf(s)[di], it = ds && ds.pages[pos]; if (it) n += put(s, it); }
    toast('This page’s lighting on page ' + (pos + 1) + ' of ' + n + (n === 1 ? ' paper' : ' papers'));
  }
  lightPagesChanged();
  return true;
}
// Every student's page count, so "every paper" reaches students not opened yet.
async function ensureCounts() {
  await workerReady;
  for (const s of batch.students) for (const f of s.files) {
    if (!viewable(f) || f.numPages || f.bad) continue;
    try { const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise; f.numPages = d.numPages; d.destroy(); } catch (e) { pdfBad(f, e); }
  }
}
async function lightMenuDo(how) {
  const m = $('#lmenu'); if (!m) return;
  const pg = m._pg, { di, pos, back, want } = m._at, st = batch.students[cur]; m.remove();
  const L = layoutOf(st), d = L[di];
  const setList = (s, list) => { let n = 0; for (const [path, p] of list) { const f = fileByPath(s, path); if (f) { setPageLit(s, f, p, want); n++; } } return n; };
  if (how === 'page' || !d) setPageLit(st, pg.file, pg.idx, want);
  else if (how === 'rest') setList(st, d.pages.slice(pos));
  else if (how === 'file') setList(st, d.pages);
  else {
    await ensureCounts();
    let n = 0;
    for (const s of batch.students) {
      const ds = layoutOf(s)[di]; if (!ds) continue;
      const it = how === 'from' ? ds.pages[pos] : ds.pages[ds.pages.length - 1 - back];
      if (it) n += setList(s, [it]);
    }
    toast('Lighting ' + (want ? 'on' : 'off') + ' for ' + (how === 'from' ? 'page ' + (pos + 1) : 'that page') + ' on ' + n + (n === 1 ? ' paper' : ' papers'));
  }
  lightLast = pg;
  lightPagesChanged();
}

function openLight() {
  const old = $('#lightPanel'); if (old) { old.remove(); return; }
  const p = document.createElement('div'); p.id = 'lightPanel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Lighting'); document.body.appendChild(p);
  let only = lightKey(batch.students[cur]) !== '*';
  const set = L => { batch.light = batch.light || {}; if (only) batch.light[batch.students[cur].key] = L; else { batch.light['*'] = L; } lightApply(); };
  const opt = (k, v) => { batch.lightOpt = { ...lightOpts(), [k]: v }; lightApply(); render(); };
  const render = () => {
    const L = lightFor(batch.students[cur]), o = lightOpts();
    const offs = Object.entries(batch.lightPg || {}).filter(([, v]) => v === false).map(([k]) => k);
    const offAll = offs.length, offHere = offs.filter(k => k.startsWith(batch.students[cur].key + '|')).length;
    const owns = Object.keys(batch.lightPgL || {}), ownAll = owns.length, ownHere = owns.filter(k => k.startsWith(batch.students[cur].key + '|')).length;
    const row = (k, label, min, max) => '<label><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" data-l="' + k + '" value="' + (L[k] || 0) + '"><b>' + (L[k] || 0) + '</b></label>';
    p.innerHTML = '<div class="lph"><b>Lighting</b><span style="flex:1"></span><button class="anonsw" data-lon role="switch" aria-checked="' + o.on + '"><i></i>' + (o.on ? 'On' : 'Off') + '</button><button class="icon" data-lx aria-label="Close" style="margin-left:8px">✕</button></div>' +
      '<div class="lpbody' + (o.on ? '' : ' off') + '">' +
      '<button class="btn sm primary" data-lauto style="width:100%">Auto fix this scan</button>' +
      row('b', 'Brightness', -60, 60) + row('c', 'Contrast', 0, 400) + row('d', 'Darken writing', 0, 100) + row('s', 'Sharpen', 0, 100) +
      '<label class="lprow lpchk"><input type="checkbox" data-lg' + (L.g ? ' checked' : '') + '> Black and white</label>' +
      '<span class="seg" style="width:100%"><button data-lo="0" aria-pressed="' + !only + '" style="flex:1">All students</button><button data-lo="1" aria-pressed="' + only + '" style="flex:1">Only ' + esc(shownName(batch.students[cur], cur)) + '</button></span>' +
      '<div><button class="link" data-lreset>Back to normal</button></div>' +
      '<div class="lpsec"><div class="dl">Pages</div>' +
        '<div class="muted" style="font-size:12px">Click ☀ in a page’s corner to turn lighting off just there. Shift-click another page’s ☀ to do every page in between. ▾ sets lighting for that page alone, and does the rest of a file, a whole file, or the same page on every paper.</div>' +
        '<div style="font-size:13px">Your rubric from Rubric setup</div><span class="seg" style="width:100%"><button data-lrub="0" aria-pressed="' + !o.rub + '" style="flex:1">Leave alone</button><button data-lrub="1" aria-pressed="' + o.rub + '" style="flex:1">Fix it too</button></span>' +
        (offAll ? '<div style="font-size:13px">Turned off by you: ' + offHere + ' on this paper, ' + offAll + ' in all. <button class="link" data-lpgreset>Turn them all back on</button></div>' : '') +
        (ownAll ? '<div style="font-size:13px">Own lighting: ' + ownHere + ' on this paper, ' + ownAll + ' in all. <button class="link" data-lpgown>Make them all the same as the rest</button></div>' : '') + '</div>' +
      '<label class="lprow lpchk"><input type="checkbox" data-lexp' + (o.exp ? ' checked' : '') + '> Use in the export too</label>' +
      '<div class="muted" style="font-size:12px;margin-top:-4px">' + (o.exp ? 'Exported files come out with this lighting. The student’s original file isn’t changed.' : 'Only changes how you see the paper here; the export stays as scanned.') + '</div></div>';
  };
  render();
  p.onchange = e => { if (e.target.dataset.lexp != null) opt('exp', e.target.checked); if (e.target.dataset.lg != null) set({ ...lightFor(batch.students[cur]), g: e.target.checked ? 1 : 0 }); };
  p.oninput = e => { const k = e.target.dataset.l; if (!k) return; const L = { ...lightFor(batch.students[cur]), [k]: +e.target.value }; e.target.nextElementSibling.textContent = e.target.value; set(L); };
  p.onclick = e => {
    if (e.target.closest('[data-lx]')) return p.remove();
    if (e.target.closest('[data-lon]')) return opt('on', !lightOpts().on);
    const rb = e.target.closest('[data-lrub]'); if (rb) return opt('rub', rb.dataset.lrub === '1');
    if (e.target.closest('[data-lpgown]')) { batch.lightPgL = {}; lightApply(); return render(); }
    if (e.target.closest('[data-lpgreset]')) { for (const [k, v] of Object.entries(batch.lightPg || {})) if (v === false) delete batch.lightPg[k]; lightApply(); return render(); }
    if (e.target.closest('[data-lauto]')) { const pg = pages.find(q => q.bmp && q.file.kind !== 'docx'); if (!pg) return toast('No scanned page to fix here'); set({ ...lightAuto(pg), s: lightFor(batch.students[cur]).s || 0, g: lightFor(batch.students[cur]).g || 0 }); return render(); }
    if (e.target.closest('[data-lreset]')) { set({ ...LIGHT0 }); if (only) { delete batch.light[batch.students[cur].key]; only = false; lightApply(); } return render(); }
    const o = e.target.closest('[data-lo]');
    if (o) { const want = o.dataset.lo === '1', stc = batch.students[cur]; if (want && !only) { batch.light = batch.light || {}; batch.light[stc.key] = { ...lightFor(stc) }; } if (!want && only) { delete batch.light[stc.key]; lightApply(); } only = want; return render(); }
  };
  p.refresh = () => { only = lightKey(batch.students[cur]) !== '*'; render(); };
  p.tabIndex = -1; p.focus({ preventScroll: true });   // so Escape closes it
}

