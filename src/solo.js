/* ---------------- Only this student: when a student comes to the desk, the screen shows them and nobody else ---------------- */
// gs.solo = { id: the download, key: the student's folder name }. Only a flag in this browser: nothing of her work changes.
// While it's on, <html> has the class "solo": the student list, the tabs, the sidebar and anything with other names steps
// aside (end of src/markscreen.css), and openStudent, applyRoute, Find anything and toasts stay with this student.
// It stays through a reload. It ends only by holding "Hold to show everyone" for a moment and a half, so a click can't end it.
// var and function, not let and const: toast, openStudent and applyRoute can ask before this file has run (a boot note, say).
var soloTry = '', soloUndo = null, soloOpen = false, soloHoldT = 0;
function soloNow() { const s = store.get('gs.solo', null); return s && s.id && s.key != null ? s : null; }
function soloOn() { return !!soloNow(); }
// The student's place in the open download, or -1 while another one is open (on the way to theirs).
function soloIdx() {
  const s = soloNow(); if (!s || !batch || batch.id !== s.id) return -1;
  return batch.students.findIndex(st => st.key === s.key);
}
function soloStart(i) {
  if (!batch || PHONE || !batch.students[i]) return;
  commitEditors(); saveNow();
  if (dlgPage) dlgShut();
  if (typeof closeCard === 'function') closeCard();
  store.set('gs.solo', { id: batch.id, key: batch.students[i].key });
  soloTry = ''; soloOpen = false;
  // Ctrl Z in here takes back only what was done in here: an earlier step could open, or change, someone else.
  if (!soloUndo) { soloUndo = undoStack; undoStack = []; redoStack = []; }
  document.documentElement.classList.add('solo');
  if (location.hash !== batchHash(batch.id)) go(batchHash(batch.id), true);
  if (cur !== i) openStudent(i); else { renderList(); renderGrade(); }
  soloBar();
}
function soloEnd(quiet) {
  store.del('gs.solo'); soloTry = ''; soloOpen = false; soloHintOff();
  document.documentElement.classList.remove('solo');
  if (soloUndo) { undoStack = soloUndo.concat(undoStack).slice(-200); redoStack = []; soloUndo = null; }
  $('#soloBar').hidden = true;
  if (batch) { renderList(); renderGrade(); renderTools(); }
  if (!quiet) applyRoute();
}
// applyRoute asks first: true when it took care of the address itself.
function soloRoute(r) {
  const s = soloNow(); if (!s) return false;
  // Another download is open now: she dropped papers in or opened one herself, which a student at the desk doesn't do.
  // Sending her back would close what she just brought in (11/23: stuck after bringing in some students' work), so it ends here.
  if (r.v === 'a' && batch && batch.id === r.id && r.id !== s.id) { soloEnd(true); return false; }
  // Their student isn't in the open download any more: nobody to show, so it ends instead of leaving her on a paper she can't leave.
  if (batch && batch.id === s.id && soloIdx() < 0) { soloEnd(true); return false; }
  if (r.v === 'a' && r.id === s.id && !r.tab) {
    if (!(batch && batch.id === s.id)) {
      if (soloTry === s.id && routeOpening !== s.id) { soloStuck(); return true; }   // tried, and the papers didn't open: never fall back to Home
      soloTry = s.id;
    }
    return false;
  }
  if (soloTry === s.id && routeOpening !== s.id && !(batch && batch.id === s.id)) { soloStuck(); return true; }
  go(batchHash(s.id), true); soloHint(); return true;
}
// Their papers can't open in this browser: a dead end with no way out, so it ends and she is back on Home. Saved work is untouched.
function soloStuck() {
  soloEnd(true); go('#/', true);
  toast('The papers for that student aren’t kept in this browser, so Only this student ended.', 6000);
}
// A word in the bar when she tries to leave (a short press, or another screen asked for): how to get out.
let soloHintT = 0;
function soloHint() {
  const h = $('#soloHint'); if (!h) return;
  h.hidden = false; $('#soloBar').classList.add('nudge');
  clearTimeout(soloHintT); soloHintT = setTimeout(soloHintOff, 5000);
}
function soloHintOff() { clearTimeout(soloHintT); const h = $('#soloHint'); if (h) h.hidden = true; const b = $('#soloBar'); if (b) b.classList.remove('nudge'); }
// The bar across the top: who this is, their other work in this class, and the way out.
function soloBar() {
  const s = soloNow(), el = $('#soloBar'); if (!el) return;
  if (!s) { el.hidden = true; return; }
  const i = soloIdx(), st = i >= 0 ? batch.students[i] : null;
  const p = st && !anonOn() ? personOf(st) : null, other = !!(p && p.c && p.name);
  el.hidden = false; el.dataset.b = st ? batch.id : '';
  document.documentElement.classList.add('solo');   // the bar and the hiding of everyone else always go together
  el.innerHTML = '<span class="solo-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-5.8 7-5.8s6.2 2 7 5.8"/></svg></span>' +
    '<b class="solo-t">Only this student</b><span class="solo-n">' + (st ? esc(shownName(st, i)) : '') + '</span>' + (st ? '<span class="muted solo-a">' + esc(batch.name || '') + '</span>' : '') + '<span class="sp"></span>' +
    (other ? '<button class="btn sm" id="soloOther" aria-expanded="' + soloOpen + '" aria-controls="soloWork">Other work</button>' : '') +
    '<span class="solo-hint" id="soloHint" hidden>Keep holding for 2 seconds to show everyone</span>' +
    '<button class="btn sm solo-x" id="soloExit"><span class="solo-fill" aria-hidden="true"></span><span class="solo-xl">Hold to show everyone</span></button>' +
    (other && soloOpen ? '<div class="solo-work" id="soloWork"><h3 id="soloWorkH">' + workHead(p.c, []) + '</h3><div id="soloRows"><div class="muted pc-sm">Looking through saved work…</div></div></div>' : '');
  if (other && soloOpen) soloRows(p);
}
// Every assignment of this class with this student's own score, and nobody else's. A click opens that one, still only them.
async function soloRows(p) {
  const rows = await classWork(p.c, p.name).catch(e => { console.error(e); return []; });
  const box = $('#soloRows'); if (!box || !soloOn()) return;
  // the one open now, even before anything on it is marked
  const i = soloIdx(), st = i >= 0 ? batch.students[i] : null;
  if (st && !rows.some(r => r.id === batch.id)) { const g = st.grade || {}, any = g.status || g.points != null && g.points !== '' || (g.rubric || []).some(v => v != null); rows.push({ name: batch.name || '', t: Infinity, p: any ? pastScore(setup, g) : null, none: !st.files.length, id: batch.id, k: st.key }); }
  $('#soloWorkH').innerHTML = workHead(p.c, rows);
  if (!rows.length) { box.innerHTML = workRows(rows); return; }
  box.innerHTML = rows.map((r, n) => {
    const here = batch && r.id === batch.id, html = workRows([r]);
    return r.id && r.k ? '<button class="solo-row' + (here ? ' on' : '') + '" data-solog="' + n + '"' + (here ? ' aria-current="true"' : '') + '>' + html + '</button>' : '<div class="solo-row">' + html + '</div>';
  }).join('');
  box.onclick = e => { const b = e.target.closest('[data-solog]'); if (!b) return; const r = rows[+b.dataset.solog]; soloGo(r.id, r.k); };
}
function soloGo(id, key) {
  if (!soloOn()) return;
  if (batch && batch.id === id) { soloOpen = false; return soloBar(); }
  commitEditors(); saveNow();
  store.set('gs.solo', { id, key }); soloTry = ''; soloOpen = false;
  soloUndo = [];   // a new download starts its own steps
  go(batchHash(id), true);
  soloBar();
}
// Holding the button: a pointer held down, or Space or Enter held, for 1.5 s. Letting go sooner does nothing.
function soloHold(on) {
  const b = $('#soloExit'); if (!b) return;
  if (!on && soloHoldT) soloHint();   // let go too soon
  clearTimeout(soloHoldT); soloHoldT = 0; b.classList.toggle('holding', on);
  if (on) soloHoldT = setTimeout(() => { soloHoldT = 0; b.classList.remove('holding'); soloEnd(); }, 1500);
}
(() => {
  const bar = document.createElement('div');
  bar.id = 'soloBar'; bar.className = 'solobar'; bar.hidden = true; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Only this student');
  $('#shell').before(bar);
  bar.addEventListener('click', e => { if (e.target.closest('#soloOther')) { soloOpen = !soloOpen; soloBar(); } });
  bar.addEventListener('pointerdown', e => { if (e.target.closest('#soloExit') && e.button === 0) { e.preventDefault(); soloHold(true); } });
  for (const t of ['pointerup', 'pointercancel']) document.addEventListener(t, () => { if (soloHoldT) soloHold(false); });
  bar.addEventListener('pointerout', e => { if (e.target.closest('#soloExit') && !e.target.closest('#soloExit').contains(e.relatedTarget)) soloHold(false); });
  bar.addEventListener('keydown', e => { if (e.target.closest('#soloExit') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) soloHold(true); } });
  bar.addEventListener('keyup', e => { if (e.target.closest('#soloExit') && (e.key === ' ' || e.key === 'Enter')) soloHold(false); });
  bar.addEventListener('contextmenu', e => e.preventDefault());
  // Ended in another window of the app: end here too, or this one would keep sending her back.
  window.addEventListener('storage', e => { if (e.key === 'gs.solo' && !e.newValue && document.documentElement.classList.contains('solo')) soloEnd(); });
  // After a reload: straight back to their paper, before Home is ever drawn.
  const s = soloNow();
  if (s && !PHONE) {
    document.documentElement.classList.add('solo');
    soloUndo = [];
    if (location.hash !== batchHash(s.id)) { try { history.replaceState(null, '', batchHash(s.id)); } catch {} }
    soloBar();
  } else if (s) store.del('gs.solo');
})();
Object.assign(window.__gs, { toast, soloStart, soloEnd, soloNow });
