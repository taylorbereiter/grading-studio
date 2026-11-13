/* ---------------- the sample: opening it, building it once, and leaving it ----------------
   src/samplemode.js keeps the sample apart: while it is open, this page's storage is another set of names, and the teacher's own
   work is out of reach. This file is the little that the grading page adds: the way in and out, the notice in the sidebar and on
   Today, and the one-time build. What the sample holds (the classes, the papers and their marks, the lessons) is made by
   src/sample-data.js, which is not in the page: it is fetched when somebody opens the sample, and a double-click copy carries it squeezed. */
// SAMPLE_API (set by the build: a stamp of sample-data.js) is the builder this page was made with: a sample made by another one is made again.
function sampleOn() { return !!(window.__gsSample && window.__gsSample.on); }
function sampleBuilt() { return sampleOn() && store.get('gs.sampleBuilt', 0) === SAMPLE_API; }
// Into the sample: whatever is open is saved first, then every page at this address starts again on the sample's side.
function sampleEnter() {
  try { if (batch) { commitEditors(); saveNow(true); } } catch (e) { console.error(e); }
  if (!window.__gsSample || !window.__gsSample.enter()) return toast('This browser wouldn’t open the sample. Its storage may be switched off.');
  sampleReload();
}
// And out: the sample is cleared, and the teacher's own work is exactly as it was.
function sampleLeave() {
  if (!sampleOn()) return;
  window.__gsSample.leave();
  sampleReload();
}
function sampleReload() { try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) {} location.reload(); }

/* the builder: fetched from beside the page, or unpacked in a double-click copy */
let sampleDataP = null;
function sampleData() {
  return sampleDataP ||= new Promise((res, rej) => {
    if (window.__gsSampleData) return res(window.__gsSampleData);
    if (SAMPLE_PACKED) { try { const b = atob(SAMPLE_PACKED), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return res(window.__gsSampleData = Object.assign(new Function(fflate.strFromU8(fflate.inflateSync(u)))(), { api: SAMPLE_API })); } catch (e) { return rej(e); } }
    const s = document.createElement('script'); s.src = 'sample.js' + (SAMPLE_STAMP ? '?' + SAMPLE_STAMP : '');
    s.onload = () => window.__gsSampleData ? res(window.__gsSampleData) : rej(new Error('sample.js held nothing')); s.onerror = () => rej(new Error('sample.js could not be fetched'));
    document.head.appendChild(s);
  });
}
function sampleCover(say) {
  let el = $('#sampleCover');
  if (!el) { el = document.createElement('div'); el.id = 'sampleCover'; el.setAttribute('role', 'status'); el.innerHTML = '<div class="smpbox"><div class="smpspin" aria-hidden="true"></div><h2></h2><p></p></div>'; document.body.appendChild(el); }
  el.querySelector('h2').textContent = tr('Getting the sample ready…');
  el.querySelector('p').textContent = tr(say || 'Two made-up classes, their papers and a week of lessons.');
  return el;
}
// Once, the first time the sample opens: everything is made here, in the browser, then the page starts again on the finished sample.
async function sampleBuild() {
  const cover = sampleCover();
  try {
    const D = await sampleData();
    if (!D || D.api !== SAMPLE_API) throw Object.assign(new Error('sample.js is for another version'), { old: true });
    await D.build(sampleKit(say => { cover.querySelector('p').textContent = tr(say); }));
    if (batch) { saveNow(); closeDownload(); }
    await sampleSettle();
    store.set('gs.sampleBuilt', SAMPLE_API);
    sampleReload();
  } catch (e) {
    console.error(e);
    cover.querySelector('.smpspin').hidden = true;
    cover.querySelector('h2').textContent = tr('The sample couldn’t be opened');
    cover.querySelector('p').textContent = tr(e && e.old ? 'This copy of the app is older than the sample. Open Settings, About and updates, and update first.' : 'It needs the internet the first time. Nothing of yours was changed.');
    const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = tr('Go back'); b.onclick = sampleLeave; cover.querySelector('.smpbox').appendChild(b);
  }
}
// Every save the build set going has reached the browser's storage.
async function sampleSettle() {
  for (let i = 0; i < 100 && (saveDue || keepWait); i++) { if (keepWait) { await keepWait.catch(() => {}); keepWait = null; } await new Promise(r => setTimeout(r, 50)); }
  await new Promise(r => setTimeout(r, 200));
}
// One paper of the open assignment kept as a strong example, the way "Use as an example" keeps it: names covered, with or without the marks.
async function sampleExample(st, o) {
  await exReady; await workerReady; await classCommon();
  EXU = { st, i: batch.students.indexOf(st), items: [], kind: 'paper', marks: !!o.marks, score: !!o.score, row: o.row || null, part: null, docs: new Map(), shown: [], tok: 0 };
  try {
    EXU.items = await exuExpand(exItems(st));
    const blobs = [], pages = [], score = EXU.score ? exScoreText(st) : '';
    for (let k = 0; k < EXU.items.length; k++) {
      const it = EXU.items[k], js = await exuDoc(it), v1 = vpRot(it.f, it.p, await js.getPage(it.p + 1), 1), c = (await exuCanvas(k, Math.min(4, 1600 / v1.width))).c;
      if (score && !blobs.length) exScoreOn(c, score);
      blobs.push(await exJpg(c)); pages.push({ w: c.width, h: c.height }); c.width = c.height = 0;
    }
    await exPut({ ...exBase('paper', st), why: o.why || '', row: EXU.row, letter: exNextLetter(batch.id, 'paper'), pages, marks: EXU.marks, score: !!score }, blobs);
  } finally { EXU = null; }
}
// What the builder may use. It is this page's own code, only kept out of the page until it is wanted.
function sampleKit(say) {
  return {
    say, uid, store, isoDay, tr,
    get lib() { return lib; }, saveLib,
    get batch() { return batch; }, get setup() { return setup; }, set setup(v) { setup = v; },
    intake, saveNow, closeDownload, settle: sampleSettle, papersKept: () => Promise.resolve(keepWait).catch(() => {}), quizSet, groupSync, touchGrade, gradeOf, scoreStampText, totalInk,
    planDb, idbP, kdo, seatRoom,
    example: sampleExample, PDFLib, fileByPath, COLORS, HL, CHECK_INK: () => CHECK_INK, QZ_GOLD,
  };
}

/* the notice: in the sidebar on every screen, and a card on Today */
function sampleRailRender() {
  const rail = $('#rail'); if (!rail || !sampleOn()) return;
  let el = $('#railSample');
  if (!el) { el = document.createElement('div'); el.id = 'railSample'; el.className = 'rsample'; rail.insertBefore(el, $('#findBtn')); }
  const h = '<span class="rl"><b>Sample</b>Everything here is made up. Your own work is kept apart.</span><button class="btn sm" data-sampleleave title="Leave the sample. It is cleared, and your own work is as you left it."><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9"/></svg><span class="rl">Leave the sample</span></button>';
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
document.addEventListener('click', e => { if (e.target.closest('[data-sampleleave]')) { e.preventDefault(); sampleLeave(); } });
// Saving to a folder, to Drive or into a file is for a teacher's own work, so in the sample those say why they do nothing.
function sampleStops(what) {
  if (!sampleOn()) return false;
  sayDlg('This is the sample, so ' + what + ' is switched off here. Leave the sample to use it with your own work.');
  return true;
}
if (sampleOn()) {
  sampleRailRender();
  // A sample made by another version's builder is cleared first (the lines in samplemode.js do it as the page starts), then made again.
  if (!sampleBuilt()) { if (store.get('gs.sampleBuilt', null) != null) { window.__gsSample.again(); location.reload(); } else setTimeout(sampleBuild, 0); }
}
Object.assign(window.__gs, { sampleOn, sampleEnter, sampleLeave, sampleBuilt });
