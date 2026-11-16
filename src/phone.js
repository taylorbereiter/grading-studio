/* ---------------- On a phone: what's left, quick scores, to-dos and the focus timer, nothing that needs the papers ----------------
   Grading Studio added to an iPhone's Home Screen (or opened in a phone's browser) shows a narrow version of the same app, with the
   same saved work. Papers stay on the computer: here the teacher sees what is left to score, types scores in for a whole class one
   student under another, ticks off to-dos and runs the focus timer. ?phone=1 in the address turns it on anywhere (to try it on a
   computer), ?phone=0 turns it off on a phone. */
var PHONE = (() => {   // var: the address is read (routeOf) before this file runs
  try {
    const q = new URLSearchParams(location.search).get('phone');
    if (q === '1' || q === '0') localStorage.setItem('gs.phone', q);
    const k = localStorage.getItem('gs.phone');
    if (k === '1' || k === '0') return k === '1';
  } catch {}
  // a phone's screen, not a narrow window on a computer
  return Math.min(screen.width, screen.height) < 600 && matchMedia('(pointer: coarse)').matches;
})();
if (PHONE) {
  document.documentElement.classList.add('gsphone');
  const nav = document.createElement('nav');
  nav.className = 'phnav'; nav.id = 'phNav'; nav.setAttribute('aria-label', 'Main');
  const ic = d => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  nav.innerHTML = [['#/', 'Today', 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8'],
    ['#/scores', 'Scores', 'M4 5h16M4 12h16M4 19h10M17 17l2 2 3-4'], ['#/todo', 'To do', 'M5 12l4 4 10-10']]
    .map(([h, l, d]) => '<a href="' + h + '" data-phnav="' + h + '">' + ic(d) + '<span>' + l + '</span></a>').join('');
  document.body.appendChild(nav);
}
function phNavRender() {
  if (!PHONE) return;
  const v = routeNow().v, on = v === 'scores' ? '#/scores' : v === 'todo' ? '#/todo' : '#/';
  for (const a of document.querySelectorAll('[data-phnav]')) { const me = a.dataset.phnav === on; a.classList.toggle('on', me); if (me) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
}
window.addEventListener('hashchange', phNavRender);

/* Scores: a class, then one of its assignments, then every student with a box for the score. Saved the same way as typing in the
   Gradebook (bkParse, bkPut), so the Gradebook, term grades and the sidebar's counts on the computer read them as typed in there. */
const ph = { cols: null, ver: -1, busy: null, lib: null, later: false };
async function phCols() {
  if (ph.cols && ph.ver === libVer && ph.lib === lib) return ph.cols;
  if (!ph.busy) { const at = lib; ph.busy = bkLoad().then(c => { ph.cols = c; ph.ver = libVer; ph.lib = at; ph.busy = null; return c; }); }
  return ph.busy;
}
const phHash = (c, key) => '#/scores' + (c ? '/' + encodeURIComponent(c.id) + (key ? '/' + encodeURIComponent(key) : '') : '');
// How far along a column is: students with a score, Missing or Excused, out of the roster.
function phCount(c, col) { let n = 0; for (const nm of c.names) { const x = col.cells.get(nm); if (x && (x.pct != null || x.st === 'missing' || x.st === 'excused' || x.xc || x.fb)) n++; } return n; }
async function phScoresRender(r) {
  const box = $('#phScores'); if (!box) return;
  const classes = lib.classes.filter(c => c.names.length);
  if (!classes.length) { box.innerHTML = '<p class="muted">Add a class with its roster on your computer first. It shows here once your work is synced.</p>'; return; }
  const c = classById(r.cls) || classById(store.get('gs.phCls', '')) || classes[0];
  store.set('gs.phCls', c.id);
  const chips = '<div class="phchips" role="group" aria-label="Class">' + classes.map(k => '<a class="phchip' + (k === c ? ' on' : '') + '" href="' + phHash(k) + '"' + (k === c ? ' aria-current="true"' : '') + '><i style="background:' + esc(classColor(k)) + '"></i><span data-raw>' + esc(k.name) + '</span></a>').join('') + '</div>';
  if (!ph.cols) box.innerHTML = chips + '<p class="muted">Looking through your saved work…</p>';
  const cols = bkClassCols(c, await phCols());
  if (!$('#phScores') || routeNow().v !== 'scores') return;
  const col = r.key && cols.find(x => x.key === r.key);
  if (col) return phOneRender(box, c, col);
  // newest first; the ones still waiting for scores at the top
  const rows = cols.slice().reverse().map(x => ({ x, n: phCount(c, x) })).sort((a, b) => (a.n >= c.names.length) - (b.n >= c.names.length));
  const fresh = c.units.flatMap(u => u.items).filter(it => !cols.some(x => x.it === it) && it.type !== 'fm' && !it.done);
  box.innerHTML = chips + '<h2 class="tcap">Assignments</h2><div class="tcard phlist">' +
    (rows.length ? rows.map(({ x, n }) => '<a class="phitem" href="' + phHash(c, x.key) + '"><span class="phn"><b data-raw>' + esc(x.name) + '</b><small>' + esc([x.due ? 'due ' + bkDay(x.due) : '', x.d ? 'papers on your computer' : '', bkLabel(x.type, true)].filter(Boolean).join(' · ')) + '</small></span>' +
      '<span class="phc' + (n >= c.names.length ? ' done' : '') + '">' + (n >= c.names.length ? '✓' : n + ' / ' + c.names.length) + '</span></a>').join('') : '<p class="muted phpad">No scores in this class yet.</p>') + '</div>' +
    (fresh.length ? '<h2 class="tcap">Start typing scores for</h2><div class="tcard phlist">' + fresh.slice(-8).reverse().map(it => '<button class="phitem" data-phnew="' + esc(it.id) + '"><span class="phn"><b data-raw>' + esc(it.name) + '</b><small>' + esc(it.due ? 'due ' + bkDay(it.due) : 'no scores yet') + '</small></span><span class="phc">+</span></button>').join('') + '</div>' : '');
}
function phOneRender(box, c, col) {
  const max = col.typed && col.typed.max, s = (col.typed && col.typed.s) || {}, fm = col.type === 'fm' && !(col.typed && col.typed.lv);
  const see = !!col.dl && canOpen(keptMeta.get(col.dl));   // the papers are kept here, or waiting in her Drive
  const row = (n, i) => {
    const cell = col.cells.get(n), paper = col.d && cell && !cell.typed, r = s[n] || {};
    const val = paper ? (cell.total != null ? fmtNum(cell.total) + (cell.max ? ' / ' + fmtNum(cell.max) : '') : cell.pct != null ? cell.pct + '%' : cell.st || '') : bkCellVal(r, col);
    const st = (paper ? cell.st : r.st) || '';
    return '<div class="phstu' + (st ? ' st-' + st : '') + '"><span class="phname" data-raw>' + esc(bkWho(n, i)) + '</span>' +
      (fm && !paper ? '<button class="phfb" data-phfb="' + esc(n) + '" aria-pressed="' + !!r.fb + '">' + (r.fb ? '✓ Feedback complete' : 'Feedback complete?') + '</button>' : paper ? '<span class="phpaper" title="Scored on the paper, on your computer">' + esc(val) + '</span>' + (see ? '<button class="icon phsee" data-phsee="' + esc(n) + '" aria-label="' + esc('See the paper for ' + bkWho(n, i)) + '">' + PH_EYE + '</button>' : '') :
        '<input class="phin" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="' + esc(st === 'missing' || st === 'excused' ? '' : val) + '" placeholder="' + (st === 'missing' ? 'Missing' : st === 'excused' ? 'Excused' : '–') + '" data-phn="' + esc(n) + '" aria-label="' + esc('Score for ' + bkWho(n, i)) + '">' +
        kmWrap('⋯', 'class="icon phmore" aria-label="' + esc('More for ' + bkWho(n, i)) + '"', '<button class="mitem" data-phst="missing" data-phn="' + esc(n) + '">Missing</button><button class="mitem" data-phst="excused" data-phn="' + esc(n) + '">Excused</button><button class="mitem" data-phst="" data-phn="' + esc(n) + '">Clear</button>', 'right')) + '</div>';
  };
  box.innerHTML = '<div class="phtop"><a class="btn sm" href="' + phHash(c) + '">← <span data-raw>' + esc(c.name) + '</span></a></div>' +
    '<h2 class="phtitle" data-raw>' + esc(col.name) + '</h2><p class="muted phsub" id="phSub">' + esc([max ? 'Out of ' + fmtNum(+max) : '', '<n> of ' + c.names.length + ' done', fm ? 'Tap a student when their feedback is complete' : 'Saved as you type'].filter(Boolean).join(' · ')).replace('&lt;n&gt;', '<b id="phDone">' + phCount(c, col) + '</b>') + '</p>' +
    (col.d ? '<p class="muted phsub">Students with a scored paper show its score. Type one in for anyone without a paper.</p>' : '') +
    '<div class="tcard phstus" data-phcol="' + esc(col.key) + '">' + c.names.map(row).join('') + '</div>';
}
// A score typed in: kept when the box is left, and Next (Enter) goes to the student below.
function phPut(colKey, n, text, st) {
  const col = ph.cols && ph.cols.find(x => x.key === colKey); if (!col) return false;
  // a sync may have brought in a whole new library since the list was drawn: write into today's copy of the assignment, not the old one
  if (ph.lib !== lib && col.it) { const f = findItem(col.it.id); if (!f) return false; col.it = f.it; col.typed = f.it.typed || null; }
  if (!col.typed && col.d) col.typed = { max: bkColMax(col), s: {} };
  const r = ((col.typed || {}).s || {})[n] || {};
  const rec = st != null ? (st ? { v: null, st } : null) : bkParse(text, r, col);
  if (rec === undefined) { toast('That isn’t a score, so it was left as it was.'); return false; }
  if (!col.typed) col.typed = { max: null, s: {} };
  bkPut(col, n, rec); bkSaveLib(); ph.ver = libVer;
  return true;
}
document.addEventListener('change', e => {
  const i = e.target.closest && e.target.closest('.phin'); if (!i) return;
  const key = i.closest('[data-phcol]').dataset.phcol;
  if (phPut(key, i.dataset.phn, i.value)) phDone();
});
// After a sync brought in changes: draw Scores again, but not under the teacher's thumb. While a box has the keyboard it waits for them to leave the list.
function phSynced() {
  if (routeNow().v !== 'scores') return;
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.phstus')) { ph.later = true; return; }
  ph.cols = null; ph.later = false; phScoresRender(routeNow());
}
document.addEventListener('focusout', () => setTimeout(() => {
  if (ph.later && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('.phstus'))) phSynced();
}, 0));
// The count at the top, without drawing the list again (that would take the keyboard away from the next student).
function phDone() {
  ph.ver = -1;
  const el = $('#phDone'); if (!el) return;
  el.textContent = [...document.querySelectorAll('.phstu')].filter(x => x.querySelector('.phpaper') || (x.querySelector('.phin') && (x.querySelector('.phin').value.trim() || x.matches('.st-missing,.st-excused'))) || x.querySelector('.phfb[aria-pressed="true"]')).length;
}
document.addEventListener('keydown', e => {
  const i = e.target.closest && e.target.closest('.phin'); if (!i || e.key !== 'Enter') return;
  e.preventDefault(); const all = [...document.querySelectorAll('.phin')], nx = all[all.indexOf(i) + 1];
  if (nx) nx.focus(); else i.blur();
});
document.addEventListener('click', e => {
  const s = e.target.closest('[data-phst]');
  if (s) { const key = s.closest('[data-phcol]').dataset.phcol; if (phPut(key, s.dataset.phn, '', s.dataset.phst)) { ph.cols = null; phScoresRender(routeNow()); } return; }
  const fb = e.target.closest('[data-phfb]');
  if (fb) { const key = fb.closest('[data-phcol]').dataset.phcol, col = ph.cols.find(x => x.key === key), r = ((col.typed || {}).s || {})[fb.dataset.phfb] || {}; if (!col.typed) col.typed = { max: null, s: {} }; bkPut(col, fb.dataset.phfb, { ...r, v: null, fb: !r.fb }); bkSaveLib(); const on = !r.fb; fb.setAttribute('aria-pressed', on); fb.textContent = on ? '✓ Feedback complete' : 'Feedback complete?'; phDone(); return; }
  const nw = e.target.closest('[data-phnew]');
  if (nw) {
    const f = findItem(nw.dataset.phnew); if (!f) return;
    askTextDlg('Out of how many points? Leave it empty to type percents.', '', { ok: 'Start' }).then(v => {
      if (v == null) return;
      const max = parseFloat(String(v).replace(',', '.'));
      f.it.typed = { max: max > 0 ? max : null, s: {} }; saveLib(); ph.cols = null;
      go(phHash(classById(f.c.id) || f.c, f.it.id));
    });
  }
});
/* One student's paper, to look at (no marking here): from this browser if it keeps the papers, else just that student's files from her Drive. */
const PH_EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
async function phSee(col, c, n) {
  const d = col.d || {}, key = rosterPairs(c.names, Object.keys({ ...(d.s || {}), ...(d.read || {}) })).get(n) || n, cell = col.cells.get(n) || {};
  const box = document.createElement('div'); box.className = 'phview'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Paper for ' + n);
  const score = cell.total != null ? fmtNum(cell.total) + (cell.max ? ' / ' + fmtNum(cell.max) : '') : cell.pct != null ? cell.pct + '%' : '';
  box.innerHTML = '<header class="phvhead"><button class="btn sm" data-phvclose>Close</button><b data-raw>' + esc(n) + '</b><span class="phc">' + esc(score) + '</span></header><div class="phvbody"><p class="muted phpad">Getting the paper…</p></div>';
  document.body.appendChild(box);
  const body = box.querySelector('.phvbody');
  try {
    const m = keptMeta.get(col.dl), rec = m && m.papers ? await paperGet(col.dl) : null;
    const files = rec ? rec.entries.filter(e => e.data && (e.path.split('/')[0] === key || e.path.replace(/\.[^.]+$/, '') === key)) : await dvPullOne(col.dl, key);
    if (!box.isConnected) return;
    body.innerHTML = files.length ? '' : '<p class="muted phpad">No paper for this student in this download.</p>';
    for (const f of files) {
      const ext = (f.path.match(/\.([^.\/]+)$/) || [, ''])[1].toLowerCase();
      if (ext === 'pdf') {
        const doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p), w = body.clientWidth || 360, vp0 = page.getViewport({ scale: 1 }), k = w / vp0.width * Math.min(2, devicePixelRatio || 1), vp = page.getViewport({ scale: k });
          const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.className = 'phvpage'; cv.setAttribute('aria-label', 'Page ' + p);
          await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          if (!box.isConnected) return; body.appendChild(cv);
        }
      } else if (/^(png|jpe?g|gif|webp|heic)$/.test(ext)) {
        const img = document.createElement('img'); img.className = 'phvpage'; img.alt = f.path; img.src = URL.createObjectURL(new Blob([f.data])); body.appendChild(img);
      } else body.insertAdjacentHTML('beforeend', '<p class="muted phpad">' + esc(f.path.split('/').pop()) + ' opens on your computer.</p>');
    }
    body.insertAdjacentHTML('beforeend', '<p class="muted phpad">Your marks on the paper show on your computer.</p>');
  } catch (e) { if (box.isConnected) body.innerHTML = '<p class="muted phpad">' + esc(e.message || 'The paper couldn’t be fetched.') + '</p>'; }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-phsee]');
  if (b) { const key = b.closest('[data-phcol]').dataset.phcol, col = ph.cols && ph.cols.find(x => x.key === key), c = classById(store.get('gs.phCls', '')); if (col && c) phSee(bkClassCols(c, [col])[0], c, b.dataset.phsee); return; }
  if (e.target.closest('[data-phvclose]')) e.target.closest('.phview').remove();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const v = document.querySelector('.phview'); if (v) v.remove(); } });
/* Use on your phone: a QR code for this page's own address (src/qr.js, made here), and the steps to put it on a phone's Home Screen and sign in. */
function phoneHowTo() {
  const url = location.origin + location.pathname.replace(/index\.html$/, ''), qr = qrSvg(url, 'QR code for Grading Studio');
  openDlg('<div class="bh"><h2>Use on your phone</h2></div><div class="bb phhow">' +
    (qr ? '<div class="phqr">' + qr + '</div>' : '') + '<p class="phurl" data-raw>' + esc(url) + '</p>' +
    '<ol class="phsteps">' +
    '<li>Point your phone’s camera at the code and tap the link, or type the address above.</li>' +
    '<li>On an iPhone: in Safari, tap Share, then Add to Home Screen.</li>' +
    '<li>On Android: in Chrome, tap the ⋮ menu, then Add to Home screen or Install app.</li>' +
    '<li>Open Grading Studio from your Home Screen and tap Sign in with Google. Use the same Google account as on this computer.</li>' +
    '</ol>' +
    '<p class="muted">If Google says it hasn’t verified the app, tap Advanced, then Go to Grading Studio. The sign-in key was made for your copy rather than reviewed by Google, and the app can only use its own hidden folder in your Drive.</p>' +
    '<p class="muted">Your classes, scores and to-dos then stay the same on both. You can type scores and look at papers on the phone; marking stays on the computer.</p>' +
    '</div><div class="bf"><button class="btn primary" data-cancel>Done</button></div>', true);
}
window.__gs = Object.assign(window.__gs || {}, { saveLib: () => saveLib(), gIn: () => gToken(true), syncNow: () => syncNow(), phone: () => PHONE, dvUp: async () => { while (DV.up) await DV.up; DV.up = dvUp().finally(() => { DV.up = null; }); return DV.up; }, dvPull: id => dvPull(id), phoneHowTo: () => phoneHowTo(), canOpen: id => canOpen(keptMeta.get(id)) });
