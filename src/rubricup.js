/* ---------------- bring in a rubric for any assignment: its rows read from the file where they can be, and a copy for every student ---------------- */
// A Word rubric's table is read the same way scoring on a Word rubric reads it (rubricModel). A PDF made from a document is read from its words and
// where they sit on the page: a row of level numbers (4 3 2 1) heads the columns, and what is left of them names the rows. A picture or a scan has no
// words to read, so it can only be the copy to mark on. Nothing is sent anywhere.
const RU_NUM = /^(?:(?:level|score|band|points?|pts|marks?)\s*)?(\d{1,2})(?:\s*(?:pts?|points?|marks?))?$/i;
const ruTidy = t => String(t || '').replace(/\s+/g, ' ').trim();
// The words in a level's box, without the level number the box starts with.
const ruCell = (t, v) => ruTidy(t).replace(new RegExp('^(?:(?:level|score|band)\\s*)?' + v + '(?:\\s*(?:pts?|points?|marks?))?\\s*[:.)–-]?\\s*', 'i'), '').slice(0, 600);
function ruFromWord(bytes) {
  const w = openWord(bytes), page = document.createElement('div'); page.className = 'dpage'; w.pRuns = []; renderWord(w, page);
  const m = rubricModel(page); if (!m || m.crits.length < 1 || m.levels.length < 2) return null;
  const rows = m.crits.slice(0, 10).map((name, i) => {
    const levels = {};
    for (const c of m.cells) if (c.crit === i) { const t = ruCell(c.td.textContent, c.val); if (t) levels[c.val] = t; }
    return { name: ruTidy(name).slice(0, 80) || 'Criterion ' + (i + 1), levels };
  });
  return { rows, top: Math.max(...m.levels) };
}
async function ruFromPdf(bytes) {
  await workerReady;
  const d = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  let tc; try { tc = await (await d.getPage(1)).getTextContent(); } finally { d.destroy(); }
  const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || 10 }));
  if (items.length < 6) return null;
  const lines = [];
  for (const it of items.sort((a, b) => b.y - a.y)) { const l = lines.find(L => Math.abs(L.y - it.y) <= 3); if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] }); }
  // the heading: two or more level numbers on one line, counting down or up, none above 10
  let head = null;
  for (const l of lines) {
    const nums = l.items.map(it => { const m = RU_NUM.exec(it.s); return m ? { v: +m[1], c: it.x + it.w / 2 } : null; }).filter(Boolean).sort((a, b) => a.c - b.c);
    if (nums.length < 2 || nums.some(n => n.v > 10) || new Set(nums.map(n => n.v)).size !== nums.length) continue;
    const down = nums.every((n, k) => !k || n.v < nums[k - 1].v), up = nums.every((n, k) => !k || n.v > nums[k - 1].v);
    if (down || up) { head = { y: l.y, cols: nums }; break; }
  }
  if (!head) return null;
  const cols = head.cols, gap = (cols[cols.length - 1].c - cols[0].c) / Math.max(1, cols.length - 1), edge = cols[0].c - gap / 2;
  const below = items.filter(it => it.y < head.y - 2), lh = below.length ? below.map(i => i.h).sort((a, b) => a - b)[below.length >> 1] : 10;
  const left = below.filter(it => it.x + Math.min(it.w, gap) / 2 < edge).sort((a, b) => b.y - a.y);
  if (!left.length) return null;
  // a row starts where words come back on the left after a gap
  const tops = [];
  let last = null;
  for (const it of left) { if (last == null || last - it.y > lh * 2.1) tops.push({ y: it.y, words: [] }); tops[tops.length - 1].words.push(it.s); last = it.y; }
  if (tops.length > 10) return null;
  const rows = tops.map((t, k) => {
    const hi = t.y + lh * 0.8, lo = k + 1 < tops.length ? tops[k + 1].y + lh * 0.8 : -1e9, levels = {};
    for (const c of cols) {
      const words = below.filter(it => it.y <= hi && it.y > lo && it.x + it.w / 2 >= edge && Math.abs(it.x + it.w / 2 - c.c) === Math.min(...cols.map(q => Math.abs(it.x + it.w / 2 - q.c)))).sort((a, b) => b.y - a.y || a.x - b.x).map(it => it.s);
      const txt = ruTidy(words.join(' ')).slice(0, 600); if (txt) levels[c.v] = txt;
    }
    return { name: ruTidy(t.words.join(' ')).slice(0, 80), levels };
  }).filter(r => r.name && Object.keys(r.levels).length);
  if (!rows.length) return null;
  return { rows, top: Math.max(...cols.map(c => c.v)) };
}
// file: a File. Gives { name, word, page: bytes of the copy to mark on (a PDF, or the Word file), rows: [{ name, levels }], top } or throws.
async function rubricRead(file) {
  const bytes = new Uint8Array(await file.arrayBuffer()), name = file.name;
  if (WORD_RX.test(name)) { let got = null; try { got = ruFromWord(bytes); } catch (e) { console.error(e); } if (!got) openWord(bytes); return { name, word: true, page: bytes, rows: got ? got.rows : [], top: got ? got.top : 0 }; }
  if (isImg(name) || IMG_MORE.test(name)) {
    if (isImg(name) && !await picReads(bytes)) throw new Error('damaged');
    return { name, word: false, page: isImg(name) ? await imageToPdf(bytes, name) : await anyImageToPdf(bytes), rows: [], top: 0 };
  }
  await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  let got = null; try { got = await ruFromPdf(bytes); } catch (e) { console.error(e); }
  return { name, word: false, page: bytes, rows: got ? got.rows : [], top: got ? got.top : 0 };
}
// A setup with the rubric's rows in it.
function rubricRowsInto(d, r) {
  d.mode = 'rubric'; d.criteria = r.rows.map(x => x.name);
  const lv = r.rows.map(x => x.levels || {}); if (lv.some(o => Object.keys(o).length)) d.levels = lv; else delete d.levels;
  for (const k of ['tops', 'top', 'ib']) delete d[k];
  if (r.top && r.top !== ROW_TOP && topOk(r.top)) d.top = r.top;
  return d;
}
// Keeps the copy to mark on (as Rubric setup does) and returns { id, name }, or null when it is too big for this browser.
function rubricKeep(r) {
  const id = uid(); let bin = ''; for (let i = 0; i < r.page.length; i += 0x8000) bin += String.fromCharCode.apply(null, r.page.subarray(i, i + 0x8000));
  return store.set('gs.rp.' + id, btoa(bin)) ? { id, name: r.name } : null;
}
// What an assignment's rubric is, in a few words. What the teacher wrote stays as written in every language.
function rubricSays(su) {
  if (!su) return '<span>Not set yet</span>';
  return (su.mode === 'rubric' ? '<span>Rubric rows:</span> <span data-raw>' + esc(su.criteria.join(' · ')) + '</span>' : '<span>Just the total, out of</span> <span data-raw>' + esc(fmtNum(+su.outOf || 0)) + '</span>') +
    (su.rubricPage ? '<br><span>A copy for every student:</span> <span data-raw>' + esc(su.rubricPage.name || 'Rubric page.pdf') + '</span>' : '');
}
// The part of a box that brings in a rubric. o.now: a Use it button puts it on the card straight away (else the box's own Save does, with ruPut).
function ruHtml(su, o) {
  return '<div class="field rubup" id="rubUp"><label>Rubric</label><span class="rusays" id="ruSays">' + rubricSays(su) + '</span>' +
    '<span class="rurow"><button type="button" class="btn sm" id="ruPick">Bring in a rubric…</button><span class="muted">Word, PDF or a picture. Rows are read from a table where they can be.</span></span><div id="ruGot"' + (o && o.now ? ' data-now' : '') + ' hidden></div></div>';
}
// Wires it up. Returns { got(): what was read and picked, or null }.
function ruWire(box, it, onUse) {
  let got = null;
  const show = () => {
    const g = $('#ruGot'); if (!g) return;
    if (!got) { g.hidden = true; return; }
    const r = got.r, n = r.rows.length;
    g.hidden = false;
    g.innerHTML = '<p class="rufile"><b data-raw>' + esc(r.name) + '</b></p>' +
      (n ? '<p class="rufile">Rows found in it:</p><ol class="rurows">' + r.rows.map(x => '<li><b data-raw>' + esc(x.name) + '</b>' + (Object.keys(x.levels).length ? '<span class="muted" data-raw>' + esc(Object.entries(x.levels).sort((a, b) => b[0] - a[0]).map(([v, t]) => v + ': ' + t).join(' · ').slice(0, 160)) + '</span>' : '') + '</li>').join('') + '</ol>' +
        '<label class="chk"><input type="checkbox" id="ruRows"' + (got.rows ? ' checked' : '') + '> Score with these rows</label>'
        : '<p class="muted runo">No rubric table could be read from this file, so its rows aren’t filled in. You can type them in Rubric setup.</p>') +
      '<label class="chk"><input type="checkbox" id="ruCopy"' + (got.copy ? ' checked' : '') + '> Give every student a copy to mark on</label>' +
      (g.hasAttribute('data-now') ? '<div><button type="button" class="btn sm primary" id="ruUse">Use this rubric</button></div>' : '');
  };
  const live = { signal: dlgOff.signal };
  box.addEventListener('change', e => { if (!got) return; if (e.target.id === 'ruRows') got.rows = e.target.checked; if (e.target.id === 'ruCopy') got.copy = e.target.checked; }, live);
  box.addEventListener('click', async e => {
    if (e.target.closest('#ruUse')) { if (!got || (!got.rows && !got.copy)) return toast('Tick what to do with it first'); const ok = ruPut(it, got); if (ok) { $('#ruSays').innerHTML = rubricSays(it.setup); got = null; show(); if (onUse) onUse(); } return; }
    if (!e.target.closest('#ruPick')) return;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx,.docm,.pdf,.png,.jpg,.jpeg,.heic,.heif,.webp,image/*,application/pdf';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { const r = await rubricRead(f); got = { r, rows: !!r.rows.length, copy: !r.rows.length }; show(); }
      catch (err) { console.error(err); toast('That file couldn’t be opened as a Word file, PDF or picture'); }
    };
    inp.click();
  }, live);
  return { got: () => got };
}
// Puts what was picked on the assignment's card (and on the open assignment, through Rubric setup, so scores already given are asked about there).
function ruPut(it, got) {
  if (!got || (!got.rows && !got.copy)) return true;
  const r = got.r, live = batch && batch.assignment === it;
  const d = JSON.parse(JSON.stringify(live ? setup : setupOver(it.setup || store.get('gs.setup', null))));
  if (got.rows) rubricRowsInto(d, r);
  if (live) { openSetup({ draft: d, page: got.copy ? { bytes: r.page, name: r.name } : undefined }); return false; }
  if (got.copy) {
    const k = rubricKeep(r); if (!k) { toast('That rubric file is too big to keep. Try a smaller PDF or a screenshot.'); return false; }
    if (d.rubricPage) store.del('gs.rp.' + d.rubricPage.id);
    d.rubricPage = k; d.rubricPos = r.word ? 'start' : 'end';
  }
  delete d.spot; it.setup = d; shareRubric(it); saveLib();
  toast('The rubric is set for “' + it.name + '”');
  return true;
}
Object.assign(window.__gs, { rubricRead, rubricRowsInto, ruFromPdf });
