/* ================= Planner: the side panel =================
   A panel beside whatever the teacher is working on, kept outside #lessons so redrawing a lesson never
   resets it. Tabs:
   - Books: the teacher's own PDFs (a routines book, a textbook), stored in this browser only. Chapters
     from the PDF's own bookmarks, search, and pages that can go to the Claude box.
   - Video: a YouTube link plays here; words search YouTube in a new tab (YouTube doesn't allow its search
     inside other sites).
   - Atlas: the lesson's Atlas link (Atlas needs its own sign-in, so it opens in a tab), the unit's week and
     its Atlas screenshots.
   - Claude: things gathered for Claude (slides, pages, a video, a unit week) plus what the teacher types or
     says, copied in one go to paste into Claude. */
const SP = { open: false, tab: 'books', w: 420, view: 'page', book: null, pdf: null, page: 1, outline: null, find: '', hits: null, texts: {}, video: '', box: { text: '', chips: [] } };
const SP_TABS = { books: 'Books', video: 'Video', atlas: 'Atlas', claude: 'Claude' };
try { const v = JSON.parse(localStorage.getItem('gsp.panel') || '{}'); if (SP_TABS[v.tab]) SP.tab = v.tab; SP.open = !!v.open; if (v.w >= 300 && v.w <= 900) SP.w = v.w; } catch { }
const spKeep = () => { try { localStorage.setItem('gsp.panel', JSON.stringify({ open: SP.open, tab: SP.tab, w: SP.w })); } catch { } };

function panelShell() {
  if ($('#side')) return;
  const d = document.createElement('aside'); d.id = 'side'; d.className = 'pl-side-panel'; d.hidden = true; d.setAttribute('aria-label', 'Side panel');
  document.body.appendChild(d);
  d.addEventListener('click', e => panelClick(e));
  d.addEventListener('input', e => panelInput(e));
  d.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.sf === 'find') { e.preventDefault(); bookFind(e.target.value); } if (e.key === 'Enter' && e.target.dataset.sf === 'vid') { e.preventDefault(); videoGo(e.target.value); } });
  for (const ev of ['dragover', 'drop']) d.addEventListener(ev, e => { if (ev === 'dragover') { e.preventDefault(); return; } panelDrop(e); });
  // the edge drags to make the panel wider or narrower
  d.addEventListener('pointerdown', e => {
    if (!e.target.classList.contains('sp-edge')) return;
    e.preventDefault(); const x0 = e.clientX, w0 = SP.w;
    const mv = ev => { SP.w = Math.max(300, Math.min(900, w0 + (x0 - ev.clientX))); panelSize(); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); spKeep(); if (SP.tab === 'books' && SP.pdf) bookPage(SP.page); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
}
function panelSize() { document.documentElement.style.setProperty('--sidew', SP.w + 'px'); if (typeof fitStage === 'function') fitStage(); }
async function panelToggle(on) {
  panelShell(); SP.open = on == null ? !SP.open : on; spKeep();
  $('#side').hidden = !SP.open; document.body.classList.toggle('has-side', SP.open); panelSize();
  for (const b of document.querySelectorAll('[data-a="panel"]')) b.classList.toggle('on', SP.open);
  if (SP.open) await panelRender();
}
const panelBtn = () => '<button class="btn sm ghost' + (SP.open ? ' on' : '') + '" data-a="panel" title="Books, video, Atlas and the Claude box beside your work">Side panel</button>';

async function panelRender() {
  const d = $('#side'); if (!d || !SP.open) return;
  const n = SP.box.chips.length;
  d.innerHTML = '<div class="sp-edge" title="Drag to resize"></div><div class="sp-head"><nav class="sp-tabs">' + Object.entries(SP_TABS).map(([k, v]) => '<button class="' + (k === SP.tab ? 'on' : '') + '" data-st="' + k + '">' + v + (k === 'claude' && n ? ' <span class="sp-n">' + n + '</span>' : '') + '</button>').join('') +
    '</nav><button class="btn sm ghost" data-sa="close" aria-label="Close the side panel">×</button></div><div class="sp-body" id="spBody"></div>';
  const b = $('#spBody');
  if (SP.tab === 'books') b.innerHTML = await booksHtml();
  if (SP.tab === 'video') b.innerHTML = videoHtml();
  if (SP.tab === 'atlas') b.innerHTML = await atlasHtml();
  if (SP.tab === 'claude') b.innerHTML = boxHtml();
  if (SP.tab === 'books' && SP.pdf) bookPage(SP.page);
}

/* ---------- Books ---------- */
async function booksList() { return (await kvGet('pdfs')) || []; }
let pdfReady = null;
function pdfLib() {   // pdf.js and its worker load only when a book is opened
  if (pdfReady) return pdfReady;
  pdfReady = (async () => {
    const src = $('#pdfWorkerSrc').textContent;
    let url = null;
    try {
      url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const ok = await new Promise(res => {
        let w; try { w = new Worker(URL.createObjectURL(new Blob(['onmessage=e=>postMessage(e.data)'], { type: 'text/javascript' }))); } catch { return res(false); }
        const t = setTimeout(() => { w.terminate(); res(false); }, 2500);
        w.onmessage = () => { clearTimeout(t); w.terminate(); res(true); }; w.onerror = () => { clearTimeout(t); res(false); }; w.postMessage(1);
      });
      if (ok) { pdfjsLib.GlobalWorkerOptions.workerSrc = url; return pdfjsLib; }
    } catch { }
    const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s);
    pdfjsLib.GlobalWorkerOptions.workerSrc = url || 'about:blank';
    return pdfjsLib;
  })();
  return pdfReady;
}
async function booksHtml() {
  const list = await booksList();
  if (!SP.book) return '<div class="sp-pad"><h3>Your books</h3>' + (list.length ? list.map(x => '<div class="sp-book"><button class="sp-link" data-sbook="' + x.id + '">' + esc(x.name) + '</button><span class="muted">' + (x.pages ? x.pages + ' pages' : '') + '</span><button class="btn sm ghost" data-sdel="' + x.id + '" title="Remove from this computer">×</button></div>').join('') : '<p class="muted">Add a PDF you use for planning, like your routines book or a textbook. It stays in this browser on this computer; nothing is uploaded.</p>') +
    '<button class="btn sm" data-sa="addbook">+ Add a PDF…</button><input type="file" id="spPdfIn" accept="application/pdf,.pdf" hidden></div>';
  const bk = list.find(x => x.id === SP.book) || {};
  return '<div class="sp-bar"><button class="btn sm ghost" data-sa="books">‹ Books</button><b class="sp-title">' + esc(bk.name || '') + '</b></div>' +
    '<div class="sp-bar"><input class="btn sm sp-find" data-sf="find" placeholder="Search this book" value="' + esc(SP.find) + '"><button class="btn sm' + (SP.view === 'toc' ? ' on' : ' ghost') + '" data-sa="toc">Contents</button></div>' +
    '<div class="sp-split"><div class="sp-toc" id="spToc"' + (SP.view === 'toc' ? '' : ' hidden') + '>' + tocHtml() + '</div><div class="sp-pageview" id="spPageView"' + (SP.view === 'toc' ? ' hidden' : '') + '><div class="sp-bar"><button class="btn sm ghost" data-sa="prev" aria-label="Previous page">‹</button><span id="spPg">Page ' + SP.page + ' of ' + (SP.pdf ? SP.pdf.numPages : '…') + '</span><button class="btn sm ghost" data-sa="next" aria-label="Next page">›</button><span class="sp"></span><button class="btn sm" data-sa="pagebox" title="Put this page’s text in the Claude box">+ Claude box</button></div><div class="sp-canvas" id="spCanvas" draggable="true"></div></div></div>';
}
function tocHtml() {
  if (SP.hits) return '<div class="muted sp-small">' + SP.hits.length + ' page' + (SP.hits.length === 1 ? '' : 's') + ' with “' + esc(SP.find) + '”</div>' + SP.hits.map(h => '<button class="sp-toci" data-pg="' + h.p + '" draggable="true" data-chip=\'' + esc(JSON.stringify({ kind: 'page', book: SP.book, page: h.p, title: 'p. ' + h.p })) + '\'><b>p. ' + h.p + '</b> ' + esc(h.snip) + '</button>').join('');
  if (!SP.outline) return '<div class="muted sp-small">Reading the contents…</div>';
  if (!SP.outline.length) return '<div class="muted sp-small">This PDF has no chapter list. Use search, or page through it.</div>';
  const item = (o, d) => '<button class="sp-toci" style="padding-left:' + (6 + d * 12) + 'px" data-pg="' + (o.page || '') + '" draggable="true" data-chip=\'' + esc(JSON.stringify({ kind: 'page', book: SP.book, page: o.page, title: o.title })) + '\'>' + esc(o.title) + (o.page ? ' <span class="muted">p. ' + o.page + '</span>' : '') + '</button>' + (o.items || []).map(x => item(x, d + 1)).join('');
  return SP.outline.map(o => item(o, 0)).join('');
}
async function bookOpen(id) {
  const b = await kvGet('pdf:' + id); if (!b) return toast('That PDF isn’t on this computer');
  SP.book = id; SP.page = (await kvGet('pdfpg:' + id)) || 1; SP.outline = null; SP.hits = null; SP.find = ''; SP.texts = {};
  await panelRender();
  try {
    const lib = await pdfLib();
    SP.pdf = await lib.getDocument({ data: new Uint8Array(await b.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (e) { console.warn(e); toast('That PDF couldn’t be opened'); SP.book = null; return panelRender(); }
  const list = await booksList(), x = list.find(y => y.id === id); if (x && !x.pages) { x.pages = SP.pdf.numPages; await kvSet('pdfs', list); }
  await panelRender();
  SP.outline = await outlineOf(SP.pdf); const t = $('#spToc'); if (t) t.innerHTML = tocHtml();
  if (SP.outline.length && !(await kvGet('pdfpg:' + id + ':seen'))) { await kvSet('pdfpg:' + id + ':seen', 1); spShow('toc'); }
}
async function outlineOf(pdf) {
  let o; try { o = await pdf.getOutline(); } catch { o = null; }
  if (!o) return [];
  const walk = async items => Promise.all(items.map(async it => {
    let page = 0;
    try { const dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest; if (dest && dest[0]) page = (await pdf.getPageIndex(dest[0])) + 1; } catch { }
    return { title: String(it.title || '').trim(), page, items: it.items && it.items.length ? await walk(it.items) : [] };
  }));
  return walk(o);
}
// A narrow panel shows the contents or a page, not both; Contents switches.
function spShow(v) {
  SP.view = v; const t = $('#spToc'), pv = $('#spPageView'), b = document.querySelector('[data-sa="toc"]');
  if (t) t.hidden = v !== 'toc'; if (pv) pv.hidden = v === 'toc';
  if (b) { b.classList.toggle('on', v === 'toc'); b.classList.toggle('ghost', v !== 'toc'); }
}
let pageJob = 0;
async function bookPage(n) {
  if (!SP.pdf) return;
  SP.page = Math.max(1, Math.min(SP.pdf.numPages, n)); kvSet('pdfpg:' + SP.book, SP.page);
  const job = ++pageJob, c = $('#spCanvas'), pg = $('#spPg'); if (!c) return;
  spShow('page');
  if (pg) pg.textContent = 'Page ' + SP.page + ' of ' + SP.pdf.numPages;
  const p = await SP.pdf.getPage(SP.page), w = Math.max(200, c.clientWidth - 18), v0 = p.getViewport({ scale: 1 }), k = w / v0.width, dpr = window.devicePixelRatio || 1;
  const v = p.getViewport({ scale: k * dpr }), cv = document.createElement('canvas'); cv.width = v.width; cv.height = v.height; cv.style.width = w + 'px';
  await p.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise;
  if (job !== pageJob) return;
  c.innerHTML = ''; c.appendChild(cv); c.dataset.chip = JSON.stringify({ kind: 'page', book: SP.book, page: SP.page, title: 'p. ' + SP.page });
}
async function pageText(book, n) {
  const key = book + ':' + n; if (SP.texts[key] != null) return SP.texts[key];
  let pdf = SP.pdf;
  if (book !== SP.book) { const b = await kvGet('pdf:' + book); if (!b) return ''; pdf = await (await pdfLib()).getDocument({ data: new Uint8Array(await b.arrayBuffer()), isEvalSupported: false }).promise; }
  const tc = await (await pdf.getPage(n)).getTextContent();
  let t = '', y = null;
  for (const it of tc.items) { const yy = it.transform ? Math.round(it.transform[5]) : y; if (y != null && yy !== y) t += '\n'; else if (t && !/\s$/.test(t)) t += ' '; t += it.str; y = yy; }
  return (SP.texts[key] = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
}
async function bookFind(q) {
  SP.find = q.trim(); if (!SP.pdf) return;
  spShow('toc');
  if (!SP.find) { SP.hits = null; const t = $('#spToc'); if (t) t.innerHTML = tocHtml(); return; }
  const t = $('#spToc'); if (t) t.innerHTML = '<div class="muted sp-small">Searching…</div>';
  const hits = [], ql = SP.find.toLowerCase();
  for (let i = 1; i <= SP.pdf.numPages; i++) {
    const tx = await pageText(SP.book, i), at = tx.toLowerCase().indexOf(ql);
    if (at >= 0) hits.push({ p: i, snip: tx.slice(Math.max(0, at - 30), at + ql.length + 50).replace(/\s+/g, ' ') });
  }
  SP.hits = hits; const t2 = $('#spToc'); if (t2) t2.innerHTML = tocHtml();
}
async function bookAdd(file) {
  if (!file || !/pdf$/i.test(file.type || file.name)) return toast('Pick a PDF');
  const id = lid(), list = await booksList();
  await kvSet('pdf:' + id, file); list.push({ id, name: file.name.replace(/\.pdf$/i, ''), size: file.size, added: Date.now() }); await kvSet('pdfs', list);
  toast('Added “' + file.name + '” to this computer'); bookOpen(id);
}

/* ---------- Video ---------- */
function videoHtml() {
  const id = ytId(SP.video), st = ytStart(SP.video);
  return '<div class="sp-pad"><div class="sp-bar"><input class="btn sm sp-find" data-sf="vid" placeholder="Paste a YouTube link, or type words to search" value="' + esc(SP.video) + '"><button class="btn sm" data-sa="vidgo">Go</button></div>' +
    (id ? '<div class="sp-vid"><iframe src="https://www.youtube-nocookie.com/embed/' + id + (st ? '?start=' + st : '') + '" title="Video" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
      '<div class="sp-bar"><button class="btn sm" data-sa="vidslide">Put on a slide</button><button class="btn sm ghost" data-sa="vidbox">+ Claude box</button><a class="btn sm ghost" href="' + esc(SP.video) + '" target="_blank" rel="noopener">YouTube ↗</a></div>'
      : '<p class="muted">YouTube doesn’t allow its search inside other sites, so words open YouTube’s search in a new tab. Copy a video’s link there and paste it here to watch it beside your lesson.</p>') + '</div>';
}
function videoGo(v) {
  v = v.trim(); if (!v) return;
  if (/^https?:\/\//.test(v)) { SP.video = v; return panelRender(); }
  window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(v), '_blank', 'noopener');
}

/* ---------- Atlas ---------- */
function lessonUnit(l) {
  for (const t of (l && l.slots) || []) { const c = classById(t.classId), hit = c && c.course && unitAt(c.course, ymd(mondayOf(parseYmd(t.date)))); if (hit) return hit; }
  return null;
}
async function atlasHtml() {
  const l = L.open, hits = l ? [lessonUnit(l)].filter(Boolean) : (L.view === 'unit' && L.unit ? [{ u: L.unit, n: -1 }] : courses().map(c => unitAt(c, L.weekOf)).filter(Boolean));
  const a = l && atlasOf(l);
  let h = '<div class="sp-pad">';
  if (a) h += '<a class="btn" href="' + esc(a.url) + '" target="_blank" rel="noopener">Open Atlas ↗</a><p class="muted sp-small">Atlas asks for your school sign-in and can’t be shown inside another page, so it opens in its own tab.</p>';
  if (!hits.length) h += '<p class="muted">' + (l ? 'This lesson isn’t in a unit yet. Units are under the Units tab.' : 'No unit this week.') + '</p>';
  for (const { u, n } of hits) {
    const w = n >= 0 ? u.weeks[n] : null;
    h += '<div class="sp-unit"><b>' + esc(u.title) + '</b>' + (u.atlas && !a ? ' <a href="' + esc(u.atlas) + '" target="_blank" rel="noopener">Atlas ↗</a>' : '') +
      (w ? '<div>Week ' + (n + 1) + ' of ' + u.weeks.length + (w.focus ? ': ' + esc(w.focus) : '') + '</div>' + (w.standards ? '<div class="muted">' + esc(w.standards) + '</div>' : '') + (w.notes ? '<div class="muted">' + esc(w.notes) + '</div>' : '') +
        '<button class="btn sm ghost" data-sa="weekbox" data-u="' + u.id + '" data-n="' + n + '">+ Claude box</button>' : '') + '<div class="sp-shots">';
    for (const f of u.files.filter(f => f.kind === 'atlas')) { const b = await fileBlob(f.id); if (b && /^image\//.test(b.type || f.type)) h += '<button class="sp-shot" data-shot="' + u.id + '|' + f.id + '" title="' + esc(f.name) + '"><img src="' + URL.createObjectURL(b) + '" alt="' + esc(f.name) + '"></button>'; }
    h += '</div></div>';
  }
  return h + '</div>';
}

/* ---------- the Claude box ---------- */
const CHIP_ICON = { slide: '▭', page: '📖', video: '▶', week: '📅', file: '📄' };
function boxHtml() {
  return '<div class="sp-pad sp-box"><p class="muted sp-small">Drag slides, book pages and chapters here, or use the “+ Claude box” buttons. Then say or type what you want, and copy it all for Claude.</p>' +
    '<div class="sp-chips" id="spChips">' + (SP.box.chips.length ? SP.box.chips.map((c, i) => '<span class="sp-chip">' + (CHIP_ICON[c.kind] || '•') + ' ' + esc(c.label) + '<button data-schip="' + i + '" aria-label="Remove">×</button></span>').join('') : '<span class="muted sp-small">Nothing here yet.</span>') + '</div>' +
    '<textarea id="spText" data-sf="boxtext" rows="7" placeholder="What do you want Claude to do with these?">' + esc(SP.box.text) + '</textarea>' +
    '<div class="sp-bar"><button class="btn sm" data-dict="#spText">🎤 Dictate</button><span class="sp"></span><button class="btn sm ghost" data-sa="boxclear">Clear</button><button class="btn sm primary" data-sa="boxcopy">Copy for Claude</button></div></div>';
}
async function boxSave() { await kvSet('cbox', SP.box); }
async function boxAdd(c) {
  if (!c || !c.kind) return;
  if (c.kind === 'page') { const bk = (await booksList()).find(x => x.id === c.book); c.label = (bk ? bk.name + ', ' : '') + (c.title && !/^p\. \d+$/.test(c.title) ? c.title + ' (p. ' + c.page + ')' : 'p. ' + c.page); }
  if (c.kind === 'slide') { const l = L.lessons.find(x => x.id === c.lesson), s = l && l.slides[c.i]; if (!s) return; c.label = (l.title || 'Lesson') + ', slide ' + (c.i + 1) + (s.title ? ': ' + s.title : ''); }
  if (c.kind === 'file') { const o = ownerOf({ t: c.t, id: c.owner }), f = o && (o.files || []).find(x => x.id === c.id); if (!f) return; c.label = f.name; }
  SP.box.chips.push(c); await boxSave();
  if (SP.open && SP.tab === 'claude') panelRender(); else { if (SP.open) panelRender(); toast('Added to the Claude box'); }
}
async function chipText(c) {
  if (c.kind === 'page') { const bk = (await booksList()).find(x => x.id === c.book); const t = await pageText(c.book, c.page).catch(() => ''); return '[' + (bk ? bk.name : 'Book') + ', ' + (c.title && !/^p\. \d+$/.test(c.title) ? c.title + ', ' : '') + 'page ' + c.page + ']\n' + (t || '(no text on this page)'); }
  if (c.kind === 'slide') {
    const l = L.lessons.find(x => x.id === c.lesson), s = l && l.slides[c.i]; if (!s) return '';
    let t = '[Slide ' + (c.i + 1) + ' of "' + l.title + '" (' + LAYOUTS[s.layout] + ')]\n' + (s.title ? 'Title: ' + s.title + '\n' : '') + (s.body ? s.body + '\n' : '');
    for (const k of EXTRA) if (s[k] && k !== 'body') t += k + ': ' + s[k] + '\n';
    return t.trim();
  }
  if (c.kind === 'file') {
    const o = ownerOf({ t: c.t, id: c.owner }), f = o && (o.files || []).find(x => x.id === c.id); if (!f) return '';
    if (f.kind !== 'doc') return '[File: ' + f.name + ']';
    const b = await fileBlob(f.id), d = document.createElement('div'); d.innerHTML = b ? docClean(await b.text()) : '';
    for (const el of d.querySelectorAll('p,h1,h2,li,tr,div')) el.append('\n');
    return '[Document: ' + f.name + ']\n' + d.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }
  if (c.kind === 'video') return '[Video] ' + c.url;
  if (c.kind === 'week') return '[' + c.label + ']' + (c.text ? '\n' + c.text : '');
  return c.label || '';
}
async function boxCopy() {
  const parts = [];
  for (const c of SP.box.chips) parts.push(await chipText(c));
  const t = (SP.box.text.trim() ? SP.box.text.trim() + '\n\n' : '') + parts.join('\n\n');
  if (!t.trim()) return toast('The Claude box is empty');
  await copyText(t); toast('Copied. Paste it into Claude.', 4000);
}

/* ---------- voice typing (Chrome) ---------- */
let dictRec = null;
function dictate(target, btn) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return toast('Voice typing needs Chrome or Edge');
  if (dictRec) { dictRec.stop(); return; }
  const r = new R(); dictRec = r; r.lang = navigator.language || 'en-US'; r.continuous = true; r.interimResults = true;
  const base = target.value, sep = base && !/\s$/.test(base) ? ' ' : '';
  let done = '';
  btn.classList.add('rec'); btn.textContent = '■ Stop';
  r.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) done += t; else interim += t; }
    target.value = base + sep + (done + interim).trim(); target.dispatchEvent(new Event('input', { bubbles: true }));
  };
  r.onerror = e => { if (e.error === 'not-allowed') toast('Allow the microphone for this page to use voice typing'); };
  r.onend = () => { dictRec = null; btn.classList.remove('rec'); btn.textContent = '🎤 Dictate'; target.dispatchEvent(new Event('change', { bubbles: true })); };
  r.start();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-dict]'); if (!b) return; const t = document.querySelector(b.dataset.dict); if (t) { t.focus(); dictate(t, b); } });

/* ---------- events ---------- */
async function panelClick(e) {
  const t = e.target.closest('[data-st],[data-sa],[data-sbook],[data-sdel],[data-pg],[data-schip],[data-shot]'); if (!t) return;
  if (t.dataset.st) { SP.tab = t.dataset.st; spKeep(); return panelRender(); }
  if (t.dataset.sbook) return bookOpen(t.dataset.sbook);
  if (t.dataset.sdel) { const list = (await booksList()).filter(x => x.id !== t.dataset.sdel); await kvSet('pdfs', list); await kvDel('pdf:' + t.dataset.sdel); return panelRender(); }
  if (t.dataset.pg) return t.dataset.pg && bookPage(+t.dataset.pg);
  if (t.dataset.schip != null) { SP.box.chips.splice(+t.dataset.schip, 1); await boxSave(); return panelRender(); }
  if (t.dataset.shot) { const [u, f] = t.dataset.shot.split('|'); const unit = L.units.find(x => x.id === u); return unit && viewFile(unit, f); }
  const a = t.dataset.sa;
  if (a === 'close') return panelToggle(false);
  if (a === 'books') { SP.book = null; SP.pdf = null; return panelRender(); }
  if (a === 'addbook') { const i = $('#spPdfIn'); i.onchange = () => bookAdd(i.files[0]); return i.click(); }
  if (a === 'prev') return bookPage(SP.page - 1);
  if (a === 'next') return bookPage(SP.page + 1);
  if (a === 'toc') { if (SP.view === 'toc' && !SP.hits) return spShow('page'); SP.hits = null; SP.find = ''; const f = document.querySelector('[data-sf="find"]'); if (f) f.value = ''; const tc = $('#spToc'); if (tc) tc.innerHTML = tocHtml(); return spShow('toc'); }
  if (a === 'pagebox') { const o = (SP.outline || []).flatMap(function f(x) { return [x, ...(x.items || []).flatMap(f)]; }).filter(x => x.page && x.page <= SP.page).pop(); return boxAdd({ kind: 'page', book: SP.book, page: SP.page, title: o ? o.title : 'p. ' + SP.page }); }
  if (a === 'vidgo') return videoGo(document.querySelector('[data-sf="vid"]').value);
  if (a === 'vidbox') return boxAdd({ kind: 'video', url: SP.video, label: 'Video: ' + SP.video });
  if (a === 'vidslide') {
    if (!L.open) return toast('Open a lesson first');
    const v = await videoFrom(SP.video), s = normSlide({ layout: 'video', title: v.title || 'Video', video: v });
    L.open.slides.splice(L.cur + 1, 0, s); L.cur++; lessonChanged(false); renderEditor(); return toast('Video slide added');
  }
  if (a === 'weekbox') { const u = L.units.find(x => x.id === t.dataset.u), n = +t.dataset.n, w = u && u.weeks[n]; if (!w) return; return boxAdd({ kind: 'week', label: u.title + ', week ' + (n + 1) + ' of ' + u.weeks.length, text: [w.focus && 'Focus: ' + w.focus, w.standards && 'Standards: ' + w.standards, w.notes && 'Notes: ' + w.notes].filter(Boolean).join('\n') }); }
  if (a === 'boxclear') { SP.box = { text: '', chips: [] }; await boxSave(); return panelRender(); }
  if (a === 'boxcopy') return boxCopy();
}
let boxT;
function panelInput(e) {
  if (e.target.dataset.sf === 'boxtext') { SP.box.text = e.target.value; clearTimeout(boxT); boxT = setTimeout(boxSave, 300); }
}
async function panelDrop(e) {
  e.preventDefault(); e.stopPropagation();
  const dt = e.dataTransfer, chip = dt.getData('text/x-gs-chip'), slide = dt.getData('text/x-slide');
  const files = [...(dt.files || [])], pdf = files.find(f => /pdf$/i.test(f.type || f.name));
  if (pdf && SP.tab === 'books') return bookAdd(pdf);
  if (chip) { SP.tab = 'claude'; spKeep(); return boxAdd(JSON.parse(chip)); }
  if (slide !== '' && L.open) { SP.tab = 'claude'; spKeep(); return boxAdd({ kind: 'slide', lesson: L.open.id, i: +slide }); }
  const u = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim();
  if (/^https?:\/\//.test(u) && ytId(u)) { SP.video = u; SP.tab = 'video'; spKeep(); return panelRender(); }
}
// Anything with data-chip can be dragged to the Claude box.
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-chip]'); if (c) { e.dataTransfer.setData('text/x-gs-chip', c.dataset.chip); e.dataTransfer.effectAllowed = 'copy'; } });
async function panelInit() {
  try { const b = await kvGet('cbox'); if (b && Array.isArray(b.chips)) SP.box = { text: String(b.text || ''), chips: b.chips }; } catch { }
  if (SP.open) await panelToggle(true);
}
// The Atlas tab follows what's open: redraw it when the lesson or view changes.
let spCtx = '';
function panelContext() {
  const k = L.view + '|' + (L.open ? L.open.id : '') + '|' + (L.unit ? L.unit.id : '') + '|' + L.weekOf;
  if (k === spCtx) return; spCtx = k;
  if (SP.open && SP.tab === 'atlas') panelRender();
}
