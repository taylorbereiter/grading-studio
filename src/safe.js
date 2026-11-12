/* ---------------- safe by default: the folder ask on Home, going back in time, and updates she controls (stage 2) ---------------- */
// Nothing here changes how work is stored. The folder, its dated copies and the browser's safety copies are folder.js and migrate.js;
// this file puts them in front of her: asked for at the start, shown as days to go back to, and one assignment restored on its own.

/* the ask: where should a copy of your work be kept? */
// On Home, first thing, for as long as no folder is chosen. "Not now" puts it away for a week; the sidebar goes on saying "Not backed up".
// gsc.folderLater is outside gs.*, so it belongs to this browser and no copy of her work carries it.
const ASK_LATER = 7 * 864e5;
const IC_FOLDER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
function safeAskShown() {
  if (fld.state !== 'none' || !fld.booted) return false;
  let later = 0; try { later = +localStorage.getItem('gsc.folderLater') || 0; } catch {}
  if (Date.now() - later < ASK_LATER) return false;
  return canPickFolder() || keptMeta.size > 0;   // a browser that can't save to a folder has nothing to be asked until there is work to lose
}
function safeAskRender() {
  const el = $('#safeAsk'); if (!el || !shellReady) return;
  const h = !safeAskShown() ? '' : '<span class="saic">' + IC_FOLDER + '</span><div class="satx">' + (canPickFolder()
    ? '<h2>Choose where your work is kept</h2><p>Right now your marking lives only in this browser, and clearing the browser’s data would erase it. Choose a folder on this computer once. Every save then goes there too, with a copy of each day to go back to. Nothing is uploaded.</p>' +
      '<p class="sarow"><button class="btn primary" data-wlink>Choose a folder…</button><button class="link" data-asklater>Not now</button><span class="muted">Already have a Grading Studio folder? Choose it and your work comes back.</span></p>'
    : '<h2>Your work is not backed up</h2><p>It lives only in this browser, and clearing the browser’s data would erase it. This browser can’t save to a folder by itself: Chrome or Edge on a computer can. Here, make a take-home file when you finish marking.</p>' +
      '<p class="sarow"><button class="btn primary" data-asktake>Make a take-home file</button><button class="link" data-asklater>Not now</button></p>') + '</div>';
  el.hidden = !h;
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
$('#safeAsk').addEventListener('click', e => {
  if (e.target.closest('[data-asklater]')) { try { localStorage.setItem('gsc.folderLater', String(Date.now())); } catch {} safeAskRender(); renderNeeds(); toast('The sidebar keeps saying “Not backed up” until a folder is chosen. Click it any time.', 6000); }
  else if (e.target.closest('[data-asktake]')) { go('#/settings'); $('#takeBtn').click(); }
});

/* going back in time */
// A "moment" is one dated copy: a snapshot in the folder (every day she works, and before anything risky), or one of the browser's few safety copies.
// Neither holds papers, which never change. Looking at one reads it and compares each assignment in it with how that assignment is now.
const gbk = { list: null, open: '', detail: null, busy: false, err: '' };
const gbWhen = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const gbDay = t => { const d = new Date(t), n = new Date(), days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); };
const gbFolderOn = () => !!fld.root && (fld.state === 'ok' || fld.state === 'saving' || fld.state === 'decide');
const gbWhy = m => m.why === 'daily' ? 'Start of the day' : m.why.replace(/\.$/, '');
async function gbLoad() {
  const out = [];
  if (gbFolderOn()) { try { for (const s of await snapList()) out.push({ key: 'f:' + s.name, src: 'f', name: s.name, t: s.t, why: s.why }); } catch (e) { console.error(e); } }
  try { for (const s of await gsData.snapshots()) out.push({ key: 'b:' + s.id, src: 'b', id: s.id, t: s.t, why: s.why + (s.state && s.state !== 'done' ? ', which didn’t finish' : '') }); } catch (e) { console.error(e); }
  gbk.list = out.sort((a, b) => b.t - a.t);
  if (gbk.open && !gbk.list.some(m => m.key === gbk.open)) { gbk.open = ''; gbk.detail = null; }
  gbRender();
}
function gbOpen() { gbk.open = ''; gbk.detail = null; gbk.err = ''; gbRender(); gbLoad(); }
// What one moment holds: each download's work, and its Word edits ({ path: { t, data(), orig() } }, the bytes read only if they are wanted).
async function gbRead(m) {
  if (m.src === 'f') {
    const s = await gzRead(await fld.root.getDirectoryHandle('snapshots'), m.name), edits = {};
    for (const [id, list] of Object.entries(s.edits || {})) { edits[id] = {}; for (const [p, r] of Object.entries(list)) edits[id][p] = { t: r.t || 1, data: () => getBlob(r.data), orig: async () => r.orig ? getBlob(r.orig) : null }; }
    return { work: s.work || {}, edits };
  }
  const rec = await gsData.readCopy(m.id), work = {}, edits = {};
  if (!rec) throw new Error('That safety copy is gone');
  const w = rec.stores['grading-studio-keep/work'] || { k: [], v: [] }, ed = rec.stores['grading-studio-keep/edits'] || { k: [], v: [] };
  w.k.forEach((id, i) => { work[id] = w.v[i]; });
  for (const [k, v] of Object.entries(rec.ls || {})) if (k.startsWith('gs.b.')) { let d = null; try { d = JSON.parse(v); } catch {} if (d) work[k] = newestWork(work[k], d); }
  ed.k.forEach((k, i) => { const at = String(k).indexOf('|'), r = ed.v[i]; (edits[k.slice(0, at)] ||= {})[k.slice(at + 1)] = { t: r.t || 1, data: async () => r.data, orig: async () => r.orig || null }; });
  return { work, edits };
}
const gbNow = async id => newestWork(store.get(id, null), await kget('work', id));
const gbName = id => { for (const c of holders()) for (const u of c.units) for (const it of u.items) if (it.batchId === id) return it.name; return (keptMeta.get(id) || {}).name || 'An assignment'; };
// How many students' work differs between two copies, and whether a setting of the assignment (its rubric, say) does.
function gbDiff(then, now) {
  const a = revsOf(then), b = revsOf(now || { s: {} });
  let n = 0; for (const k of new Set([...Object.keys(a.s), ...Object.keys(b.s)])) if (((a.s[k] || {}).h || '') !== ((b.s[k] || {}).h || '')) n++;
  return { students: n, set: a.set !== b.set };
}
async function gbLook(key, again) {
  if (gbk.busy && !again) return;
  if (gbk.open === key) { gbk.open = ''; gbk.detail = null; return gbRender(); }
  const m = (gbk.list || []).find(x => x.key === key); if (!m) return;
  gbk.open = key; gbk.detail = null; gbk.err = ''; gbRender();
  try {
    const got = await gbRead(m), rows = [];
    for (const [id, then] of Object.entries(got.work)) {
      const meta = keptMeta.get(id); if (!meta || !then) continue;   // forgotten since, or never in this browser: nothing here to restore it onto
      const now = await gbNow(id), d = gbDiff(then, now), ct = workCounts(then), cn = now ? workCounts(now) : { scored: 0 };
      rows.push({ id, name: gbName(id), then, d, scoredThen: ct.scored, scoredNow: cn.scored, of: Math.max(0, (meta.n || 0) - (meta.off || 0)), t: meta.t || 0 });
    }
    if (gbk.open !== key) return;
    gbk.detail = { m, got, rows: rows.sort((a, b) => (b.d.students || b.d.set ? 1 : 0) - (a.d.students || a.d.set ? 1 : 0) || b.t - a.t) };
  } catch (e) { console.error(e); if (gbk.open === key) gbk.err = e && e.damaged ? 'A file this copy needs is damaged in your folder, so it can’t be opened.' : 'That copy couldn’t be read. If your folder is on a drive that was unplugged, plug it in and try again.'; }
  gbRender();
}
function gbRender() {
  const el = $('#setHistory'); if (!el || el.hidden) return;
  const linked = fld.state !== 'none', on = gbFolderOn(), list = gbk.list;
  let h = '<div class="lhead"><h2>Go back in time</h2><span class="muted">One assignment, or everything, as it was on an earlier day.</span></div>';
  if (!linked) h += '<p class="setp">A copy of each day you work is kept in the folder you choose, so there is always an earlier day to go back to. No folder is chosen yet, so those copies have not started.</p>' +
    (canPickFolder() ? '<p class="setp"><button class="btn sm primary" data-wlink>Choose a folder…</button></p>' : '<p class="muted setp">Saving to a folder needs Chrome or Edge on a computer.</p>');
  else if (!on) h += '<p class="setp">Your “' + esc(fld.name) + '” folder can’t be reached right now, so its dated copies can’t be shown. <button class="btn sm" data-wact>Reconnect</button></p>';
  else h += '<p class="muted setp">Your “' + esc(fld.name) + '” folder keeps a copy from each day you work, and one before anything that changes a lot at once. Restoring makes a copy of how things are now first, so it can always be undone. Papers are never changed.</p>';
  if (list === null) h += '<p class="muted setp">Looking for earlier copies…</p>';
  else if (!list.length) h += (on ? '<p class="muted setp">No earlier copies yet. The first is made the next time you save.</p>' : '');
  else {
    let day = '';
    for (const m of list.slice(0, 60)) {
      const d = gbDay(m.t), open = gbk.open === m.key;
      if (d !== day) { if (day) h += '</div>'; day = d; h += '<h3 class="gbday">' + esc(d) + '</h3><div class="setrows">'; }
      h += '<div class="setrow gbrow' + (open ? ' on' : '') + '"><span class="nt"><b>' + esc(new Date(m.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })) + '</b><span class="ns">' + esc(gbWhy(m)) + (m.src === 'b' ? ' · kept in this browser' : '') + '</span></span>' +
        '<button class="btn sm" data-hlook="' + esc(m.key) + '" aria-expanded="' + open + '">' + (open ? 'Close' : 'Look') + '</button></div>';
      if (open) h += '<div class="gbdetail">' + gbDetail() + '</div>';
    }
    if (day) h += '</div>';
  }
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
function gbDetail() {
  if (gbk.err) return '<p class="setp warn">' + esc(gbk.err) + '</p>';
  const d = gbk.detail; if (!d) return '<p class="muted setp">Reading this copy…</p>';
  const when = gbWhen(d.m.t), cnt = (n, of) => of ? n + ' of ' + of + ' scored' : n + ' scored';
  const rows = d.rows.map((r, i) => {
    const same = !r.d.students && !r.d.set;
    return '<div class="setrow"><span class="nt"><b>' + esc(r.name) + '</b><span class="ns">' + (same ? 'The same then as now' : 'Then ' + cnt(r.scoredThen, r.of) + ', now ' + cnt(r.scoredNow, r.of) + ' · ' +
      (r.d.students ? r.d.students + (r.d.students === 1 ? ' student’s work differs' : ' students’ work differs') : 'its setup differs')) + '</span></span>' +
      (same ? '' : '<button class="btn sm" data-hone="' + i + '"' + (gbk.busy ? ' disabled' : '') + '>Restore this assignment</button>') + '</div>';
  }).join('');
  return (d.rows.length ? '<p class="muted setp">How each assignment stood at ' + esc(when) + ':</p><div class="setrows">' + rows + '</div>' : '<p class="muted setp">None of the assignments in this browser now were in this copy.</p>') +
    '<p class="setp gball">To take rosters, units and settings back as well: <button class="link" data-hall>Restore everything from this copy…</button></p>';
}
// One download's work put in place of what is there, as a change made now on this computer: stamped to come after everything the other copies
// have seen, so the folder and another tab take it and never undo it. want's own stamps are from then and are dropped.
async function gbPut(id, want, edits) {
  const cur = await gbNow(id), data = JSON.parse(JSON.stringify(want));
  for (const k of ['sv', 'sat', 'pv']) delete data[k];
  for (const r of Object.values(data.s || {})) { delete r.v; delete r.at; delete r.ft; }
  data.s ||= {}; data.t = Date.now();
  stampData(revsOf(cur || { s: {} }), data, devId(), data.t);
  // A Word paper she typed in is kept as its own bytes: they go back with the work that goes with them.
  const range = IDBKeyRange.bound(id + '|', id + '|￿'), had = {};
  if (edits) {
    const keys = (await kdo('edits', 'readonly', o => o.getAllKeys(range))) || [];
    for (const k of keys) had[k.slice(id.length + 1)] = await kget('edits', k);
    for (const [p, r] of Object.entries(edits)) if (!had[p] || (had[p].t || 1) !== r.t) { const rec = { t: r.t, data: await r.data(), orig: await r.orig() }; await kdo('edits', 'readwrite', o => o.put(rec, id + '|' + p)); }
    for (const p of Object.keys(had)) if (!edits[p]) await kdo('edits', 'readwrite', o => o.delete(id + '|' + p));
  }
  await kdo('work', 'readwrite', o => o.put(data, id));
  store.del(id); { const idx = store.get('gs.batches', {}); if (id in idx) { delete idx[id]; store.set('gs.batches', idx); } }   // the quick copy is out of date now
  tabStamp(id, data.t);   // another tab with this one open is told, and keeps only what it changes from here on
  const m = metaFor(keptMeta.get(id), null, data, id); await kdo('meta', 'readwrite', o => o.put(m, id)); keptMeta.set(id, m);
  if (fld.state !== 'none') { const i = fld.info.get(id); if (i && edits) for (const p of Object.keys(i.edits || {})) delete i.edits[p]; fld.work.set(id, data); folderKick(); }
  railRender(); renderNeeds();
  return { cur, had: Object.fromEntries(Object.entries(had).map(([p, r]) => [p, { t: r.t || 1, data: async () => r.data, orig: async () => r.orig || null }])) };
}
async function gbRestoreOne(i) {
  const d = gbk.detail, r = d && d.rows[i]; if (!r || gbk.busy) return;
  gbk.busy = true; gbRender();
  try {
    // How things are now, kept first: in the folder when there is one, otherwise as one of this browser's safety copies.
    if (gbFolderOn()) await folderSnapshot('Before restoring an assignment');
    else await gsData.snapshot('Before restoring an assignment to an earlier day', gsData.version());
    const was = await gbPut(r.id, r.then, d.got.edits[r.id] || {});
    const key = gbk.open; gbk.detail = null; gbk.open = '';
    await gbLoad(); await gbLook(key, true);
    toastDo('“' + r.name + '” is back to how it was at ' + gbWhen(d.m.t) + '.', 'Undo', async () => {
      try { if (was.cur) await gbPut(r.id, was.cur, was.had); toast('Undone. “' + r.name + '” is as it was before.'); const k = gbk.open; gbk.open = ''; await gbLoad(); if (k) gbLook(k, true); }
      catch (e) { console.error(e); toast('That couldn’t be undone here. The copy made just before restoring is on this page.', 9000); }
    });
  } catch (e) { console.error(e); toast(e && e.name === 'QuotaExceededError' ? 'This computer is out of room, so nothing was restored.' : 'That didn’t finish, so nothing was restored.', 8000); }
  finally { gbk.busy = false; gbRender(); }
}
// Everything from a safety copy kept in this browser. (wiring.js lists the same copies under Saving and carrying.)
async function putBackAsk(id) {
  if (!await askDlg('Put back this safety copy?\n\nYour marks, scores, comments, late files, readings, units, rosters and settings in this browser go back to how they were then. The papers from each download stay. A safety copy of how things are now is made first, so this can be undone.', { ok: 'Put back' })) return;
  try { batch = null; await tabsFinish(); tabsOver('go'); await gsData.putBack(id); carryAfterPutBack(); tabsOver('done'); toast('Put back. Reloading…'); setTimeout(reloadHome, 700); }
  catch (er) { console.error(er); tabsOver('done'); toast('That didn’t finish, so some of your work may have gone back and some not. Reload, then use Put back on the newest safety copy (“Before putting back”) to return to how things were.', 15000); }
}
$('#setHistory').addEventListener('click', e => {
  const l = e.target.closest('[data-hlook]'); if (l) return gbLook(l.dataset.hlook);
  const o = e.target.closest('[data-hone]'); if (o) return gbRestoreOne(+o.dataset.hone);
  if (e.target.closest('[data-hall]') && gbk.detail) { const m = gbk.detail.m; return m.src === 'f' ? folderGoBackAsk(m.name, gbWhen(m.t)) : putBackAsk(m.id); }
});

/* updates she controls, and installing as an app */
// sw.js (the service worker) keeps a copy of the pages on this computer, so the app opens with no internet and stays on the version she has.
// A newer version is fetched quietly and waits. It takes over only when she says so, or, if she chose that, the next time the app is opened:
// never while a paper is on screen. Nothing here reads or writes her work; the pages are kept in the browser's cache, which is separate.
// Only at a real web address: the double-click copy and the localhost preview have no worker and update the way they always did.
const WHATS_NEW = '/*@@WHATSNEW@@*/';
const upd = { on: false, st: null, mine: '', checking: false, said: '', install: null, installed: false, err: '' };
const updCan = () => 'serviceWorker' in navigator && (location.protocol === 'https:' || /[?&]sw=1(&|$)/.test(location.search)) && !/Grading Studio\.html$/i.test(decodeURIComponent(location.pathname));
const updSend = async msg => { const reg = await navigator.serviceWorker.ready; if (reg.active) reg.active.postMessage(msg); };
const updStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches; } catch { return false; } };
const updNext = () => upd.st && upd.st.next && upd.st.current && upd.st.next.build !== upd.st.current.build ? upd.st.next : null;
// Another tab took the update: this one is still the old pages until it is reloaded.
const updStale = () => !!(upd.st && upd.st.current && upd.mine && upd.st.current.build !== upd.mine);
function updRender() {
  if (!shellReady) return;
  const next = updNext(), stale = updStale(), rail = $('#railUpdate');
  rail.hidden = !(next || stale);
  rail.title = next ? 'A newer version is ready. It waits until you say so.' : 'This tab is still on the older version. Reload it when you’re ready.';
  rail.querySelector('.rl').textContent = next ? 'Update ready' : 'Reload to update';
  const el = $('#setAbout'), box = $('#setInstall'); if (!el || el.hidden) return;
  const notes = v => (WHATS_NEW[v] || []).map(n => '<li>' + esc(n) + '</li>').join('');
  let h = '<div class="lhead"><h2 data-raw>Grading Studio ' + esc(gsData.APP_VERSION) + '</h2><span class="muted">' + (upd.on ? 'Kept on this computer, so it opens with no internet.' : '') + '</span></div>';
  if (!upd.on) h += '<p class="setp">' + (location.protocol === 'file:' ? 'This is a copy saved on this computer. It stays on this version until you download a newer copy.' : 'This copy gets the newest version each time the page is loaded.') + '</p>';
  else if (stale) h += '<p class="setp"><b>Another tab has updated.</b> This tab is still on the older version. <button class="btn sm primary" data-updreload>Reload this tab</button></p>';
  else if (next) h += '<div class="updbox"><p class="setp"><b>' + (next.version !== gsData.APP_VERSION ? 'Version ' + esc(next.version) + ' is ready.' : 'An update is ready.') + '</b> It waits here until you say so, so nothing changes while you are marking.</p>' +
    ((next.notes || []).length ? '<ul class="updnotes">' + next.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') +
    '<p class="setp"><button class="btn sm primary" data-updnow>Update now</button> <span class="muted">Your work is saved first. The page reloads once.</span></p></div>';
  else h += '<p class="setp">' + (upd.err ? esc(upd.err) : upd.checking ? 'Checking…' : upd.said || 'You have the newest version.') + ' <button class="btn sm" data-updcheck' + (upd.checking ? ' disabled' : '') + '>Check for updates</button></p>';
  if (upd.on) {
    const auto = upd.st && upd.st.mode === 'auto';
    h += '<fieldset class="updmode"><legend>When a newer version comes out</legend>' +
      '<label><input type="radio" name="updMode" value="ask"' + (auto ? '' : ' checked') + '> <span><b>Ask me first</b><span class="ns">The sidebar says “Update ready”, and nothing changes until you click Update now.</span></span></label>' +
      '<label><input type="radio" name="updMode" value="auto"' + (auto ? ' checked' : '') + '> <span><b>Update by itself the next time I open Grading Studio</b><span class="ns">Never while it is open, so never in the middle of marking.</span></span></label></fieldset>';
  }
  if (notes(gsData.APP_VERSION)) h += '<h3 class="gbday">New in this version</h3><ul class="updnotes">' + notes(gsData.APP_VERSION) + '</ul>';
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  let b = '<div class="lhead"><h2>Install as an app</h2><span class="muted">Its own window and its own icon. No installer, nothing for school IT to approve.</span>' + (upd.install ? '<span class="sp"></span><button class="btn sm primary" data-updinstall>Install</button>' : '') + '</div>';
  b += upd.installed || updStandalone() ? '<p class="setp">Installed. Your work is the same in the app and at this address in the browser: they are the same place.</p>'
    : upd.install ? '<p class="setp">Your saved work stays exactly where it is. The app and this page in Chrome are the same place, so you can use either.</p>'
    : !upd.on ? '<p class="setp">Installing works from the web address in Chrome or Edge, not from a copy saved on this computer.</p>'
    : '<p class="setp">In Chrome or Edge, open the browser’s menu (⋮) and choose <b>Cast, save and share</b>, then <b>Install page as app</b>. In Safari on a Mac, choose <b>File</b>, then <b>Add to Dock</b>. Your saved work stays where it is.</p>';
  box.hidden = el.hidden;
  if (box.dataset.h !== b) { box.dataset.h = b; box.innerHTML = b; }
}
async function updApply() {
  // Her work first: what is half typed is committed and saved, and an update never goes ahead over work that isn't safely stored.
  try { if (batch) { commitEditors(); await saveNow(); } } catch (e) { console.error(e); }
  if (saveBad.size) return toast('Your latest work isn’t saved yet, so the update is waiting. See the red bar.', 7000);
  upd.applying = true; updSend({ type: 'gs-apply' });
}
$('#setAbout').addEventListener('click', e => {
  if (e.target.closest('[data-updnow]')) return updApply();
  if (e.target.closest('[data-updreload]')) return location.reload();
  if (e.target.closest('[data-updcheck]')) { upd.checking = true; upd.err = ''; upd.said = ''; updRender(); updSend({ type: 'gs-check' }); }
});
$('#setAbout').addEventListener('change', e => { if (e.target.name === 'updMode') updSend({ type: 'gs-mode', mode: e.target.value === 'auto' ? 'auto' : 'ask' }); });
$('#setInstall').addEventListener('click', async e => {
  if (!e.target.closest('[data-updinstall]') || !upd.install) return;
  const p = upd.install; upd.install = null;
  try { p.prompt(); const r = await p.userChoice; if (r && r.outcome === 'accepted') upd.installed = true; } catch (er) { console.error(er); }
  updRender();
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); upd.install = e; updRender(); });
window.addEventListener('appinstalled', () => { upd.install = null; upd.installed = true; updRender(); });
if (updCan()) {
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data; if (!d || d.type !== 'gs-state') return;
    upd.st = d.state;
    if (!upd.mine && d.state.current) upd.mine = d.state.current.build;
    if (d.checked) { upd.checking = false; upd.err = d.checked === 'offline' ? 'Couldn’t check just now. Is this computer online?' : ''; upd.said = d.checked === 'ok' && !updNext() ? 'You have the newest version. Checked just now.' : ''; }
    if (d.applied && upd.applying) return location.reload();
    updRender();
  });
  navigator.serviceWorker.register('sw.js').then(() => { upd.on = true; updRender(); return updSend({ type: 'gs-state' }); }).catch(e => console.error(e));
}
Object.assign(window.__gs, { safeAskShown, gbLoad, gbLook, gbPut, gbState: () => gbk, updState: () => upd });
