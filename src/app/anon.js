/* ---------------- anonymous grading: papers as Paper 1, 2, 3… in a random order, names covered; scores still go to the right student ---------------- */
const anonOn = () => !!(batch && batch.anon && batch.anon.on);
// The shuffled order, as student indexes. Students added later go in at random places.
function anonOrder() {
  const A = batch.anon || (batch.anon = { on: false, order: [] }), keys = batch.students.map(st => st.key), have = new Set(keys);
  A.order = A.order.filter(k => have.has(k));
  for (const k of keys) if (!A.order.includes(k)) A.order.splice(Math.floor(Math.random() * (A.order.length + 1)), 0, k);
  const at = new Map(keys.map((k, i) => [k, i]));
  return A.order.map(k => at.get(k));
}
function anonShuffle() {
  const k = batch.students.map(st => st.key);
  for (let i = k.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [k[i], k[j]] = [k[j], k[i]]; }
  batch.anon = { ...(batch.anon || {}), order: k };
}
const anonPos = i => anonOrder().indexOf(i);
const shownName = (st, i) => anonOn() ? 'Paper ' + (anonPos(i) + 1) : st.key;
// The student list shows the name as it is on her roster, not the longer one from the file or folder.
// Student -> roster name, for the students matched to the batch's roster. Papers no roster name matches keep their file name.
function rosterNames() {
  const c = batchClass(), out = new Map();
  if (c && c.names.length) for (const [n, st] of rosterMatch(c.names)) out.set(st, n);
  return out;
}
// Next or previous student in the order on screen.
function stepStudent(d) {
  const o = navOrder(), p = o.indexOf(cur) + d;   // the list as it shows: her order, and only the papers the filter lets through
  if (p >= 0 && p < o.length) openStudent(o[p]);
}
const anonRx = st => coverRx(st);
// Black boxes (page points) over typed names, Kami boxes with names, and the boxes she drew in Check the covers.
async function anonCovers(st, pg) {
  try { const vp = vpRot(pg.file, pg.idx, pg.page, 1); return keptCovers(await autoCovers(pg.page, vp, anonRx(st), skewXf(pg.file, pg.idx, vp)), pg.file.path, pg.idx, pg.W, pg.H).concat(ownCovers(pg.file.path, pg.idx, pg.W, pg.H)); }
  catch { return ownCovers(pg.file.path, pg.idx, pg.W, pg.H); }
}
// The same covers on a small or big picture of a page, drawn at vp. turned: a turn she hasn't saved yet.
async function anonPaint(ctx, st, f, p, page, vp, turned) {
  let cs = [];
  try { cs = keptCovers(await autoCovers(page, vp, anonRx(st), skewXf(f, p, vp)), f.path, p, vp.width, vp.height); } catch (er) { console.error(er); }
  ctx.fillStyle = '#111';
  for (const r of cs) ctx.fillRect(r.x, r.y, r.w, r.h);
  for (let b of shareState().boxes[boxKey(f.path, p)] || []) {
    for (let n = turned || 0; n > 0; n -= 90) b = [1 - b[1] - b[3], b[0], b[3], b[2]];
    ctx.fillRect(b[0] * vp.width, b[1] * vp.height, b[2] * vp.width, b[3] * vp.height);
  }
}
// File names, Word and text files: names in headings are swapped for [name], and any line of a document that has a
// name is blacked out on screen (the file itself isn't changed).
function anonScrub() {
  if (!anonOn()) return;
  const st = batch.students[cur], rx = anonRx(st), rf = fileRx(st);
  for (const el of document.querySelectorAll('#paper .fhead > span:first-child, #paper .refd > summary, #paper .nofile b, #paper .mhead b')) {
    rf.lastIndex = 0; if (rf.test(el.textContent)) el.textContent = scrub(el.textContent, rf);
  }
  for (const el of document.querySelectorAll('#paper .dpage p, #paper .dpage td, #paper .dpage li, #paper .dpage')) {
    if (el.classList.contains('anonhide') || (el.classList.contains('dpage') && el.querySelector('p,td,li'))) continue;
    rx.lastIndex = 0; if (rx.test(el.textContent)) el.classList.add('anonhide');
  }
  for (const el of document.querySelectorAll('#paper .docx')) if (el.wordF && el.querySelector('.fhead') && !el.querySelector('.anonnote') && wordNoName(st, el.wordF)) el.querySelector('.fhead').insertAdjacentHTML('afterend', '<p class="muted anonnote" style="margin:6px 0;font-size:13px">This student’s name wasn’t found in this file, so a nickname or initials could still show here.</p>');
}
let anonT = 0;
new MutationObserver(() => { if (anonOn()) { clearTimeout(anonT); anonT = setTimeout(anonScrub, 30); } }).observe($('#paper'), { childList: true, subtree: true });
function setAnon(on) {
  if (on && !(batch.anon && batch.anon.order && batch.anon.order.length)) anonShuffle();
  batch.anon.on = on; saveNow();
  openStudent(on ? anonOrder()[0] : cur);
  toast(on ? 'Anonymous: papers in a random order, names covered' : 'Names are back');
}
function openAnon() {
  if (anonOn()) return setAnon(false);
  const seen = batch.anon && batch.anon.order && batch.anon.order.length;
  openDlg('<div class="bh"><h2>Anonymous grading</h2><button class="icon" data-cancel aria-label="Close">✕</button></div><div class="bb">' +
    '<p style="margin-top:0">Papers show up as <b>Paper 1, Paper 2…</b> in a random order, with names covered. Every mark and score still goes to the right student, and you can switch back any time.</p>' +
    '<ol style="margin:0 0 12px;padding-left:20px;line-height:1.6">' +
    '<li><b>Get everything in order first:</b> late files, split scans, your rubric.</li>' +
    '<li><b>Cover the names.</b> Typed names (from the folder names' + (batchClass() ? ' and your roster' : '') + ') are covered on their own. For handwritten names, check the covers: drag a box over the name once, then use it on every paper. <span id="anCover">' + esc(coverLine()) + '</span>' + nameWarnings() + '<div id="nameFlags" data-before="before you start" style="margin-top:8px">' + nameFlagsHtml('before you start') + '</div></li>' +
    '<li><b>Start.</b> ' + (seen ? 'It keeps the same random order as last time, or you can shuffle a new one.' : 'The order is shuffled once and kept, so you can stop and come back.') + '</li></ol>' +
    '<p class="muted" style="font-size:13px;margin:0">The Grades tab, the grade sheet and returned files still use names, since that’s where you copy grades out.</p></div>' +
    '<div class="bf"><button class="btn" data-check style="margin-right:auto">Check the covers…</button>' + (seen ? '<button class="btn" data-shuf>Shuffle a new order and start</button>' : '') + '<button class="btn primary" data-go>Start anonymous grading</button></div>', true);
  ensureCounts().then(() => { const el = $('#anCover'); if (el) el.textContent = coverLine(); findNames(); });
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const cc = e.target.closest('[data-cc]'); if (cc) return checkCovers(+cc.dataset.cc, openAnon);
    const wp = e.target.closest('[data-wp]'); if (wp) { return toPaper(+wp.dataset.wp); }
    if (e.target.closest('[data-check]')) return ensureCounts().then(() => checkCovers(coverFirst(), openAnon));
    if (e.target.closest('[data-shuf]')) { anonShuffle(); closeDlg(); return setAnon(true); }
    if (e.target.closest('[data-go]')) { closeDlg(); return setAnon(true); }
  };
}
function renderAnonHead() {
  const on = anonOn();
  $('#sideHd').innerHTML = '<span>' + (on ? 'Papers, shuffled' : 'Students') + (on ? '' : batchClass() && batchClass().names.length ? ' <i style="font-style:normal;font-weight:500;text-transform:none;letter-spacing:0">· roster order</i>' : ' <i style="font-style:normal;font-weight:500;text-transform:none;letter-spacing:0">· folder order</i>') + '</span>' +
    (on ? '<button class="btn sm" id="anonShuf" title="Put the papers in a new random order">⤮ Shuffle</button>' : '');
  $('#sideFoot').innerHTML = '<button class="btn sm" id="lateBtn" title="Late work, or many files at once. Each goes to its student by the name in the file name.">Add late work</button>' +
    '<button class="anonsw" id="anonSw" role="switch" aria-checked="' + on + '" title="Grade without names, in a random order">Hide names<i></i></button>';
}
for (const id of ['#sideHd', '#sideFoot']) $(id).addEventListener('click', e => {
  if (e.target.closest('#anonSw')) openAnon();
  if (e.target.closest('#anonShuf')) { anonShuffle(); saveNow(); openStudent(anonOrder()[0]); toast('Shuffled: a new random order'); }
  if (e.target.closest('#lateBtn')) $('#bringBtn').click();
});

