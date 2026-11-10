/* ---------------- saving: "Saved" only once the writes have worked, and a warning she can't miss when they don't ---------------- */
// Every save goes to two places. IndexedDB holds the full copy; localStorage holds a quick copy, which can fill up (it's about 5 MB for everything).
// ✓ Saved           both worked
// ✓ Saved (1 copy)  only the full copy worked. Her work is safe, and the out-of-date quick copy is dropped so it can't be read back. She's told once.
// ⚠ Partly saved    only the quick copy worked. The red bar stays up until a save reaches the full copy again.
// ⚠ Not saved       neither worked. The same bar, and leaving the page asks first.
// While the bar is up, saving is tried again every SAVE_RETRY ms, and by the Try again button.
const SAVE_WAIT = 20000, SAVE_RETRY = 20000;   // a write that hasn't finished after SAVE_WAIT counts as failed
const saveBad = new Map();   // download id: { b, data, ls }, the latest work that didn't get saved
let saveSeq = 0, saveRetryT = null, oneCopyTold = false;

// Whichever copy of a download's work was saved last. On a tie (or from before dates were kept) the quick copy, as it always was.
const newestWork = (a, b) => !a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a;

async function writeWork(b, data) {
  if (!tabLive()) return;
  const seq = ++saveSeq;
  saveLabel(b, 'Saving…', '');
  const kept = keepWork(b, data);
  const idx = store.get('gs.batches', {}); idx[b.id] = data.t;
  let ok = store.set(b.id, data);
  b.seen = tabStamp(b.id, data.t);   // after the quick copy, so whoever hears this finds it there
  // Older quick copies are let go only when the full copy of that download is there too, so nothing is ever only in one place that gets cleared.
  if (keepOk) {
    const inKeep = k => keptMeta.has(k), order = Object.entries(idx).sort((p, q) => q[1] - p[1]).map(([k]) => k);
    for (const k of order.slice(12)) if (inKeep(k)) { store.del(k); delete idx[k]; }
    while (!ok && order.length > 1) { const k = order.pop(); if (k === b.id || !inKeep(k)) continue; store.del(k); delete idx[k]; ok = store.set(b.id, data); }
  }
  store.set('gs.batches', idx);
  let t; const full = await Promise.race([kept, new Promise(r => { t = setTimeout(() => r(false), SAVE_WAIT); })]); clearTimeout(t);
  if (full && !ok) store.del(b.id);   // the quick copy is out of date now, and mustn't be read back as her work
  if ((lsRaw(savedKey(b.id)) || '').startsWith(TAB + ':')) b.seen = tabStamp(b.id, data.t + ':full');   // and once more now the full copy is there too. If another tab has saved since, its stamp stays.
  folderSaved(b, data);
  if (seq === saveSeq || b !== batch) saveResult(b, data, ok, full);   // a newer save of this one will report for itself
}
function saveResult(b, data, ls, full) {
  if (full) saveBad.delete(b.id); else saveBad.set(b.id, { b, data, ls });
  if (full) saveLabel(b, ls ? '✓ Saved' : '✓ Saved (1 copy)', '', ls ? '' : 'The full copy is kept. This browser’s quick copy is full, which does no harm.');
  else saveLabel(b, ls ? '⚠ Partly saved' : '⚠ Not saved', ls ? 'warn' : 'bad');
  if (full && !ls && !oneCopyTold) { oneCopyTold = true; toast('Your work is saved, but this browser’s room for its quick copy is full. Linking a folder, in Settings, is a good idea.', 8000); }
  saveBar();
}
function saveLabel(b, text, cls, tip) {
  const el = $('#saveState'); if (!el || b !== batch) return;
  el.textContent = text; el.className = 'savest' + (cls ? ' ' + cls : '');
  el.title = tip || 'Your marks and scores are kept in this browser as you go';
}
// The red bar, on every screen, for as long as any work isn't fully saved.
function saveBar() {
  let el = $('#saveWarn');
  if (!saveBad.size) {
    clearTimeout(saveRetryT); saveRetryT = null;
    if (el) { el.remove(); document.body.style.removeProperty('--savebar'); toast('Saved. Your work is safe again.'); }
    return;
  }
  if (!el) {
    el = document.createElement('div'); el.id = 'saveWarn'; el.className = 'savewarn'; el.setAttribute('role', 'alert');
    el.innerHTML = '<span></span><button class="btn sm" data-saveretry>Try again</button><button class="btn sm" data-savehelp>Export what I have</button>';
    el.onclick = e => { if (e.target.closest('[data-saveretry]')) saveRetry(); else if (e.target.closest('[data-savehelp]')) { if (batch) openExport(); else toast('Open that download, then use Export marked'); } };
    document.body.appendChild(el);
    new ResizeObserver(() => { if (el.isConnected) document.body.style.setProperty('--savebar', el.offsetHeight + 'px'); }).observe(el);   // keeps its own strip, so nothing she needs sits under it
  }
  const lost = [...saveBad.values()].some(x => !x.ls);
  el.querySelector('span').textContent = (lost ? 'Your latest marks and scores are NOT saved. ' : 'Your latest marks and scores are only partly saved, in this browser’s small quick copy. ') + 'The browser wouldn’t store them, often because the computer is out of space. Keep this tab open, free up some space, and press Try again.';
  clearTimeout(saveRetryT); saveRetryT = setTimeout(saveRetry, SAVE_RETRY);
}
// A download still open is saved as it is now; one she's closed is saved as she left it.
async function saveRetry() {
  for (const { b, data } of [...saveBad.values()]) { if (b === batch) await saveNow(); else await writeWork(b, data); }
}
function saveTrouble() { return [...saveBad.keys()]; }
window.addEventListener('beforeunload', e => { if (saveBad.size) { e.preventDefault(); e.returnValue = ''; } });

/* room in the small store */
// Quick copies fill it, and one whose full copy is safely kept can always go, oldest first, so anything else that needs room gets it from them.
function freeQuick() {
  if (!keepOk) return false;
  const idx = store.get('gs.batches', {}), safe = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), m = k && k.startsWith('gs.b.') && keptMeta.get(k); if (m && !saveBad.has(k) && (m.t || 0) >= (idx[k] || 0)) safe.push(k); }
  if (!safe.length) return false;
  const k = safe.sort((a, b) => (idx[a] || 0) - (idx[b] || 0))[0];
  localStorage.removeItem(k);
  if (k in idx) { delete idx[k]; try { localStorage.setItem('gs.batches', JSON.stringify(idx)); } catch {} }
  return true;
}
function lsPut(k, v) { for (;;) { try { localStorage.setItem(k, v); return true; } catch { if (!freeQuick()) return false; } } }
const lsRaw = k => { try { return localStorage.getItem(k); } catch { return null; } };

/* more than one tab */
// Tabs share storage but not memory, so a tab left open holds an old copy of everything. They tell each other through localStorage, which works from file:// too.
// Each tab also looks again just before it writes, because a tab asleep in the background hears nothing until it wakes. Both keys are outside gs.*, so no copy of her work carries them.
// gsc.saved.<id>  which tab saved this download last. A tab that finds another's stamp only writes the students it changed itself (tabMerge), until it's reopened, which happens when she comes back to it.
// gsc.forgot.<id> when this download was last forgotten in this browser.
// gsc.over        changes when one tab replaces everything: Remove from this computer, Put back, Bring work in. Other tabs stop writing at once, and reload when it's done.
// gsc.finish      changes just before that (not for Remove, where it would all go anyway). Other tabs save what's half typed or waiting to save, so it's counted in, and show gsc.saving.<tab> until it's there.
const TAB = crypto.getRandomValues(new Uint32Array(1))[0].toString(36), savedKey = id => 'gsc.saved.' + id;
const tabStamp = (id, t) => { const v = TAB + ':' + t; return lsPut(savedKey(id), v) ? v : lsRaw(savedKey(id)); };   // what's really there, so a stamp that didn't fit isn't taken for another tab's
let overSeen = lsRaw('gsc.over'), overTok = '', tabStopped = false, keptNewsT = null;
function tabLive() {
  if (tabStopped) return false;
  const v = lsRaw('gsc.over');
  if (v === overSeen) return true;
  tabStopped = true; clearTimeout(saveT); clearTimeout(saveRetryT); saveBad.clear();
  if (/:done$/.test(v || '')) { reloadHome(); return false; }
  const el = document.createElement('div');
  el.id = 'tabOver'; el.setAttribute('role', 'alert'); el.textContent = 'Your saved work is being changed in another tab. This tab will reload by itself when that’s done.';
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;font-size:18px;color:#fff;background:rgba(0,0,0,.72)';
  document.body.appendChild(el);
  setTimeout(reloadHome, 60000);   // that tab may never finish
  return false;
}
// This tab is about to replace everything, so the others get a moment to finish first: long enough to hear, and then as long as any of them says it's still saving.
const TAB_HEAR = 800, savingKey = 'gsc.saving.';
async function tabsFinish() {
  const others = () => Object.keys(localStorage).filter(k => k.startsWith(savingKey));
  lsPut('gsc.finish', Date.now().toString(36) + TAB);
  await new Promise(r => setTimeout(r, TAB_HEAR));
  for (const end = Date.now() + SAVE_WAIT; others().length && Date.now() < end;) await new Promise(r => setTimeout(r, 50));
  for (const k of others()) localStorage.removeItem(k);   // a tab closed partway through mustn't hold up the next time
}
// Another tab asked. Only when there's something to save: a save with nothing new in it would look like news to that tab.
async function tabFinishUp() {
  if (!batch) return;
  try { commitEditors(); } catch (e) { console.error(e); }
  if (!saveDue && !saveBad.has(batch.id)) return;
  lsPut(savingKey + TAB, '1');
  try { await saveNow(); } finally { try { localStorage.removeItem(savingKey + TAB); } catch {} }
}
// This tab is about to replace everything ('go'), or has finished ('done').
function tabsOver(phase) {
  if (phase === 'go') overTok = Date.now().toString(36) + TAB;
  const v = overTok + ':' + phase;
  lsPut('gsc.over', v); overSeen = v;
}
const tabsBehind = b => b.behind || (s => !!s && s !== b.seen)(lsRaw(savedKey(b.id)));
// A save from a tab that's behind. Going away there's no time to read the full copy, and with nothing to go on, what's stored is better left alone.
async function saveBehind(b, data, was, leaving) {
  const stamp = lsRaw(savedKey(b.id));
  let other = newestWork(store.get(b.id, null), b.other);
  if (!leaving) other = newestWork(other, await kget('work', b.id));
  if (!tabLive()) return;
  if (!other) { if (leaving) return; return writeWork(b, data); }
  if (!b.behind && !tabDiffers(was, other)) { b.seen = stamp; return writeWork(b, data); }   // it saved nothing new
  b.behind = true; b.other = other;
  const m = tabMerge(data, was, other);
  if (m.changed) return writeWork(b, m.data);
  if (!leaving) { saveLabel(b, '✓ Saved', ''); saveBar(); }
}
// Hearing that another tab saved this download. Opening one can save it with nothing new in it, which is no reason to disturb anything.
async function tabsLook(b) {
  const stamp = lsRaw(savedKey(b.id)), other = newestWork(store.get(b.id, null), await kget('work', b.id));
  if (batch !== b || !other) return;
  b.other = other;
  if (tabDiffers(b.revs, other)) b.behind = true;
  else if (!b.behind) b.seen = stamp;
}
// She's come back to this tab: the newest work comes in, on the student she was on.
async function tabsCatchUp() {
  const b = batch;
  if (!b || !b.revs || b.catching || $('#app').hidden || !tabLive()) return;
  if (tabsBehind(b) && !b.behind) await tabsLook(b);
  if (batch !== b || !b.behind || !$('#dlg').hidden) return;
  b.catching = true;
  try {
    commitEditors(); await saveNow();
    if (batch !== b) return;
    if (!(keptMeta.get(b.id) || {}).papers) {
      if (!b.toldBehind) { b.toldBehind = true; toast('Another tab changed this download. What you do here won’t overwrite that, but drop the download in again to see it.', 9000); }
      return;
    }
    const key = b.students[cur] && b.students[cur].key;
    await reopenKept(b.id, b.assignment);
    if (batch && batch !== b) {
      const i = batch.students.findIndex(st => st.key === key);
      if (i >= 0 && i !== cur) openStudent(i);
      toast('Newer work from another tab came in, so this download has been reopened.', 6000);
    }
  } finally { b.catching = false; }
}
// Forgotten in another tab after this one opened it: it stays forgotten. A tombstone from another computer isn't this: that one she's asked about.
const forgotKey = id => 'gsc.forgot.' + id;
const tabForgot = b => +lsRaw(forgotKey(b.id)) > (b.opened || 0);
function tabLetGo() { closeDownload(); toast('That download was forgotten in another tab, so it’s closed here too.', 6000); }
window.addEventListener('storage', e => {
  if (e.storageArea && e.storageArea !== localStorage) return;
  if (e.key === 'gsc.over') { if (!tabLive() && /:done$/.test(e.newValue || '')) reloadHome(); return; }
  if (!e.key || !tabLive()) return;
  if (e.key === 'gsc.finish') tabFinishUp();
  else if (e.key === 'gs.bank') bank = store.get('gs.bank', bank);
  else if (e.key === 'gs.lib') libNews();
  else if (e.key.startsWith('gsc.forgot.')) { if (batch && batch.revs && tabForgot(batch)) tabLetGo(); }
  else if (e.key.startsWith('gsc.saved.')) {
    clearTimeout(keptNewsT); keptNewsT = setTimeout(loadKept, 1000);
    const b = batch;
    if (b && b.revs && e.key === savedKey(b.id) && e.newValue !== b.seen) tabsLook(b);
  }
});
window.addEventListener('focus', tabsCatchUp);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tabsCatchUp(); });
