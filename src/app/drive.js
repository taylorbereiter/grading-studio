/* ---------------- Google sign-in: open from Drive, save to Drive, keep work the same on every computer ---------------- */
// Everything happens between this browser and Taylor's own Google account. The sign-in is never stored or sent anywhere else.
const GOOGLE_CLIENT_ID = '/*@@GCID@@*/';
const gcid = () => (/apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID) ? GOOGLE_CLIENT_ID : '') || store.get('gs.gcid', '');
// Keeping two devices the same needs only Grading Studio's own hidden folder in her Drive (drive.appdata: it can't see her other files).
// Opening papers and videos from Drive and saving to it need only drive.file: the app can open just the files she picks in Google's own
// chooser and the ones it makes, nothing else (not even the rest of the folder the chooser opens in). It never asks for the whole Drive.
const SYNC_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const PICK_SCOPE = 'https://www.googleapis.com/auth/drive.file ' + SYNC_SCOPE;
// A key for Google's chooser, only if the chooser asks for one (site.json googleApiKey). Not a secret: it is locked to this site's address.
const GOOGLE_API_KEY = '/*@@GKEY@@*/';
const G = { token: null, exp: 0, scope: '', client: null, cscope: '', email: store.get('gs.gEmail', ''), waiters: [] };
// A home-screen app on an iPhone can't use Google's pop-up window, so it goes to Google's page and comes back with the key in the address.
// The same on any iPhone or iPad browser (Safari, Chrome): there the pop-up is left as a blank page after Continue and never comes back.
const G_REDIRECT = navigator.standalone === true || /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const gBack = () => location.origin + location.pathname.replace(/index\.html$/, '');
{
  // Back from Google's page: the key is taken out of the address before anything reads it
  const h = new URLSearchParams(location.hash.replace(/^#/, '')), want = (() => { try { return sessionStorage.getItem('gs.gState'); } catch { return null; } })();
  if ((h.get('access_token') || h.get('error')) && h.get('state')) {
    if (want && h.get('state') === want && h.get('access_token')) { G.token = h.get('access_token'); G.exp = Date.now() + (+h.get('expires_in') || 3600) * 1000; G.scope = h.get('scope') || SYNC_SCOPE; try { sessionStorage.setItem('gs.gTok', JSON.stringify({ t: G.token, exp: G.exp, scope: G.scope })); } catch {} }
    try { sessionStorage.removeItem('gs.gState'); history.replaceState(null, '', location.pathname + location.search); } catch {}
  } else try { const k = JSON.parse(sessionStorage.getItem('gs.gTok')); if (k && k.exp > Date.now()) { G.token = k.t; G.exp = k.exp; G.scope = k.scope || ''; } } catch {}
}
function gRedirect(scope, quiet) {
  const st = crypto.getRandomValues(new Uint32Array(2)).join('');
  try { sessionStorage.setItem('gs.gState', st); } catch {}
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: gcid(), redirect_uri: gBack(), response_type: 'token', scope, include_granted_scopes: 'true', state: st, ...(G.email ? { login_hint: G.email } : {}), ...(quiet ? { prompt: 'none' } : {}) });
}
let gisP = null;
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisP || (gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gisP = null; rej(new Error('Couldn’t reach Google. Check the internet connection.')); }; document.head.appendChild(s); }));
}
// Gets a fresh token; silent when she's already signed in to Google in this browser. full: 'pick' for the files she picks or the app
// makes (drive.file), else only the app's own hidden folder.
const gHas = scope => scope.split(' ').every(x => G.scope.split(' ').includes(x));
async function gToken(interactive, full) {
  const scope = full ? PICK_SCOPE : SYNC_SCOPE;
  if (G.token && Date.now() < G.exp - 60000 && gHas(scope)) return G.token;
  if (!gcid()) throw new Error('setup');
  // Google's key lasts an hour, and getting a new one in a browser opens Google's little window, even for a moment. That never happens by
  // itself: the sync waits, the Google line says so, and a press there (or anything else that asks for Google) gets the new key.
  if (!interactive) throw new Error('Sign in again to sync');
  if (G_REDIRECT) { gRedirect(scope); throw new Error('Sign in again to sync'); }
  await loadGis();
  if (!G.client || G.cscope !== scope) {
    G.cscope = scope;
    G.client = google.accounts.oauth2.initTokenClient({
      client_id: gcid(), scope, hint: G.email || undefined, include_granted_scopes: true,
      callback: r => { const w = G.waiters.splice(0); if (r.error) w.forEach(x => x.rej(new Error(r.error))); else { G.token = r.access_token; G.exp = Date.now() + (r.expires_in || 3600) * 1000; G.scope = r.scope || scope; w.forEach(x => x.res(G.token)); } },
      error_callback: e => { const w = G.waiters.splice(0); w.forEach(x => x.rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in was closed' : 'Sign-in didn’t finish'))); },
    });
  }
  return new Promise((res, rej) => { G.waiters.push({ res, rej }); G.client.requestAccessToken({ prompt: interactive && !G.email ? 'consent' : '' }); });
}
// Every call but the sync's own (gsync) is for files she picked or the app made (drive.file).
async function gfetch(url, opt = {}, interactive, sync, again) {
  const t = await gToken(interactive, sync === true ? false : 'pick');
  const r = await fetch(url.startsWith('http') ? url : 'https://www.googleapis.com/drive/v3/' + url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401 && !again) { G.token = null; G.exp = 0; try { sessionStorage.removeItem('gs.gTok'); } catch {} return gfetch(url, opt, interactive, sync, true); }
  if (!r.ok) { const e = new Error('Google Drive said ' + r.status + ': ' + ((await r.text()).match(/"message":\s*"([^"]+)/) || [, ''])[1]); e.status = r.status; throw e; }
  return r;
}
const gjson = (u, o, i) => gfetch(u, o, i).then(r => r.json());
const gsync = (u, o, i) => gfetch(u, o, i, true);
const FOLDER = 'application/vnd.google-apps.folder';
async function signIn() {
  if (sampleStops('Google Drive')) return;
  if (!gcid()) return driveSetup();
  try {
    await gToken(true);
    const me = await (await gsync('about?fields=user(emailAddress)')).json();
    G.email = me.user.emailAddress; store.set('gs.gEmail', G.email);
    renderGoogle(); toast('Signed in as ' + G.email);
    syncNow();
  } catch (e) { toast(e.message || 'Sign-in didn’t finish'); }
}
function signOut() {
  if (G.token && window.google) try { google.accounts.oauth2.revoke(G.token); } catch {}
  G.token = null; G.scope = ''; G.email = ''; store.del('gs.gEmail'); try { sessionStorage.removeItem('gs.gTok'); } catch {} renderGoogle(); toast('Signed out of Google');
}
// Google sign-in only works on the hosted copy (not a downloaded file or a preview frame).
const GOK = /^https?:$/.test(location.protocol) && window.self === window.top;
function renderGoogle() {
  for (const el of document.querySelectorAll('.gAcct, #pickDrive')) el.hidden = !GOK || !gcid();   // no key built in: nothing to sign in to
  if (!GOK || !gcid()) return;
  for (const el of document.querySelectorAll('.gAcct')) el.innerHTML = G.email
    ? '<span class="muted" style="font-size:13px">Google: ' + esc(G.email) + ' · ' + (syncPaused() ? '<button class="link" data-gin id="syncState">' + syncState + '</button>' : '<span id="syncState">' + (syncState || 'synced') + '</span>') + '</span> <button class="link" data-gout>Sign out</button>'
    : '<button class="btn sm" data-gin>Sign in with Google</button>';
  if (!PHONE) for (const el of document.querySelectorAll('.gAcct')) el.insertAdjacentHTML('beforeend', ' <button class="btn sm" data-gphone>Use on your phone</button>');
  for (const b of document.querySelectorAll('.needG')) b.hidden = !G.email;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-gin]')) signIn();
  if (e.target.closest('[data-gout]')) signOut();
  if (e.target.closest('[data-gphone]')) phoneHowTo();
});
// Only shown if the page was built without its Google key.
function driveSetup() {
  openDlg('<div class="bh"><h2>Connect Google</h2></div><div class="bb"><p style="margin-top:0">This copy of Grading Studio doesn’t have its Google key yet. Paste the Client ID here (it ends in apps.googleusercontent.com).</p>' +
    '<div class="field"><input type="text" id="gcidIn" placeholder="1234-abc.apps.googleusercontent.com" style="width:100%"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-ok]')) { const v = $('#gcidIn').value.trim(); if (!/apps\.googleusercontent\.com$/.test(v)) return toast('That doesn’t look like a Client ID'); store.set('gs.gcid', v); G.client = null; closeDlg(); signIn(); }
  };
}

// Open from Drive: Google's chooser, so the app gets only the papers she picks (drive.file), never a look at the rest of her Drive.
// Picking a folder wouldn't hand over what is in it, so she picks the ZIP, or the papers themselves (many at once).
const paperMimes = () => ['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'application/zip', 'application/x-zip-compressed', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-word.document.macroEnabled.12', 'application/vnd.google-apps.document', 'application/vnd.google-apps.presentation', 'application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.drawing'].concat(VID_MIMES);
async function openFromDrive(assignment) {
  let picked;
  // it opens first in the folder she last took papers from (gs.gPaperDir: just where the chooser opens, it hands over nothing in it)
  const dir = store.get('gs.gPaperDir', null);
  try { picked = await drivePick({ multi: true, mimes: paperMimes(), title: 'Choose the ZIP, or the papers', ...(dir ? { parent: dir, parentName: 'Last folder' } : {}) }); } catch (e) { console.error(e); return sayDlg(e.message); }
  if (!picked.length) return;
  if (picked[0].parent) store.set('gs.gPaperDir', picked[0].parent);
  openDlg('<div class="bh"><h2>Open from Google Drive</h2></div><div class="bb"><div class="prog"><i></i></div><p class="muted" id="dvStatus" style="font-size:13px"></p></div>');
  const bar = $('#dlgBox .prog');
  try {
    const out = []; let n = 0;
    for (const f of picked) {
      const gdoc = /^application\/vnd\.google-apps\./.test(f.mime);
      const r = await gfetch(gdoc ? 'files/' + encodeURIComponent(f.id) + '/export?mimeType=application/pdf' : 'files/' + encodeURIComponent(f.id) + '?alt=media&supportsAllDrives=true');
      out.push({ path: f.name + (gdoc ? '.pdf' : ''), data: new Uint8Array(await r.arrayBuffer()) });
      bar.firstChild.style.width = (100 * ++n / picked.length) + '%'; $('#dvStatus').textContent = 'Downloading ' + n + ' of ' + picked.length + ' files…';
    }
    closeDlg();
    const zip = picked.length === 1 && /\.zip$/i.test(picked[0].name);
    await intake(out, zip ? picked[0].name.replace(/\.zip$/i, '') : (assignment && assignment.name) || 'Papers from Drive', assignment || null);
    if (batch) { batch.drive = { id: picked[0].id, name: picked[0].name, kind: zip ? 'zip' : 'files' }; saveSoon(); }
  } catch (e) { console.error(e); $('#dvStatus').textContent = e.message; $('#dlgBox .bb').insertAdjacentHTML('afterend', '<div class="bf"><button class="btn" data-close>Close</button></div>'); $('#dlgBox').onclick = ev => { if (ev.target.closest('[data-close]')) closeDlg(); }; }
}
// Saves the export into a new folder in Drive: next to the download she opened from Drive, or in My Drive.
async function saveToDrive(name, files, onStep) {
  let parent = 'root';
  if (batch.drive) { try { const j = await gjson('files/' + batch.drive.id + '?fields=parents&supportsAllDrives=true'); parent = batch.drive.kind === 'folder' ? batch.drive.id : (j.parents && j.parents[0]) || 'root'; } catch {} }
  const mk = async (nm, par) => (await gjson('files?supportsAllDrives=true&fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nm, mimeType: FOLDER, parents: [par] }) })).id;
  // The app may write only in folders it made or she picked (drive.file): if the folder next to the opened file isn't one, My Drive.
  let top; try { top = await mk(name, parent); } catch (e) { if (parent === 'root' || ![403, 404].includes(e.status)) throw e; parent = 'root'; top = await mk(name, parent); }
  saveToDrive.where = parent === 'root' ? 'root' : 'next';
  const dirs = new Map([['', top]]);
  const dirOf = async d => { if (dirs.has(d)) return dirs.get(d); const i = d.lastIndexOf('/'), up = await dirOf(i < 0 ? '' : d.slice(0, i)); const id = await mk(d.slice(i + 1), up); dirs.set(d, id); return id; };
  const list = Object.entries(files); let n = 0;
  for (const [path, bytes] of list) {
    const i = path.lastIndexOf('/'), par = await dirOf(i < 0 ? '' : path.slice(0, i));
    const meta = new Blob([JSON.stringify({ name: path.slice(i + 1), parents: [par] })], { type: 'application/json' });
    const fd = new FormData(); fd.append('metadata', meta); fd.append('file', new Blob([bytes], { type: /\.pdf$/i.test(path) ? 'application/pdf' : 'application/octet-stream' }));
    await gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', { method: 'POST', body: fd });
    onStep && onStep(++n, list.length);
  }
  return top;
}


/* Sync: the same work on every device she signs in on (a phone and a computer), through one hidden file in her own Drive.
   It carries what folder.js carries to a folder, without the papers: classes, units, rosters, typed scores and to-dos (gs.lib), each
   download's marks and scores and its row in the list, and the settings that travel (carryLs). Each side is merged the way a folder
   or a take-home file is (merge.js), student by student and field by field, so a score typed on the phone and a comment written on
   the computer both stay. Nothing goes anywhere but her browser and her Drive. */
const SYNC_NAME = 'grading-studio-sync.json';
let syncState = '', syncT = null, syncBusy = null, syncAgain = false, syncFile = null;
const SYNC_RX = /^gs\.(lib|setup|bank|rubrics|school|b\..+|rp\..+|rd\..+)$/;
{
  const raw = store.set.bind(store);
  store.set = (k, v) => { const ok = raw(k, v); if (ok && SYNC_RX.test(k)) syncSoon(); return ok; };
}
function syncPaused() { return /sign in again/.test(syncState || ''); }
function setSyncState(s) { const was = syncPaused(); syncState = s; if (syncPaused() !== was) return renderGoogle(); const el = document.getElementById('syncState'); if (el) el.textContent = s; }
function syncSoon() { if (!G.email || sampleOn()) return; clearTimeout(syncT); setSyncState('saving…'); syncT = setTimeout(syncNow, 15000); }
// The file and its version, so two devices saving at once can't write over each other. Drive counts every change to a file (version):
// the count is read with the file, and read again just before writing. If another device saved in between, this one merges again first.
const syncVer = async () => String((await (await gsync('files/' + syncFile.id + '?fields=id,version')).json()).version || '');
async function syncRead() {
  if (!syncFile) { const f = (await (await gsync("files?spaces=appDataFolder&fields=files(id)&q=" + encodeURIComponent("name='" + SYNC_NAME + "' and trashed=false"))).json()).files[0]; syncFile = f ? { id: f.id } : null; }
  if (!syncFile) return null;
  syncFile.ver = await syncVer();
  const r = await gsync('files/' + syncFile.id + '?alt=media');
  try { return await r.json(); } catch { return null; }
}
async function syncWrite(body) {
  if (syncFile) {
    if (syncFile.ver && await syncVer() !== syncFile.ver) { const e = new Error('changed on another device'); e.status = 412; throw e; }
    return gsync('https://www.googleapis.com/upload/drive/v3/files/' + syncFile.id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  }
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify({ name: SYNC_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
  fd.append('file', new Blob([body], { type: 'application/json' }));
  syncFile = { id: (await (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id };
}
// Where a folder would ask her (the same student, or a card's rubric, changed on two devices since they last matched), sync can't wait for
// an answer on every device: the copy changed later is kept, the same choice on both sides, so they agree and stop asking. A download
// forgotten on one device and worked on since on another comes back.
function syncDecide(asks) {
  const out = {};
  for (const q of asks) {
    if (q.gone) { out['!' + q.id] = 'back'; continue; }
    const ta = q.ta || 0, tb = q.tb || 0, side = ta !== tb ? (tb > ta ? 'b' : 'a') : hashOf(q.b) > hashOf(q.a) ? 'b' : 'a';
    (out[q.id] ||= {})[q.key] = side;
  }
  return out;
}
function syncNow() {
  if (!G.email || sampleOn()) return Promise.resolve();
  if (syncBusy) { syncAgain = true; return syncBusy; }
  clearTimeout(syncT);
  syncBusy = (async () => {
    for (let tries = 1; ; tries++) {
      try { await syncOnce(); return; } catch (e) {
        // the other device saved first: merge again with what it saved, a little later each time, and stop after a few tries
        if (e && e.status === 412 && tries < 5) { await new Promise(r => setTimeout(r, 500 * 2 ** tries + Math.random() * 500)); continue; }
        console.warn(e); setSyncState(/sign in/i.test(e && e.message) ? 'sign in again to sync' : 'not synced'); return;
      }
    }
  })().finally(() => { syncBusy = null; if (syncAgain) { syncAgain = false; syncNow(); } });
  return syncBusy;
}
// The Planner's timetable (classes, their times, the term and days off), for Today on a device that has no Planner of its own. Lessons stay put.
async function syncPlan() {
  const db = await planDb(false); if (!db) return null;
  let su = null; try { su = await idbP(db.transaction('kv').objectStore('kv').get('setup')); } catch {} db.close();
  if (!su || !Array.isArray(su.classes) || !su.classes.length) return null;
  return { classes: su.classes.map(c => ({ id: c.id, name: c.name, color: c.color, meets: c.meets })), semStart: su.semStart || '', semEnd: su.semEnd || '', daysOff: su.daysOff || [] };
}
async function syncOnce() {
  setSyncState('syncing…');
  if (batch) await saveNow();
  const got = await syncRead(), B = got && got.app === 'Grading Studio sync' ? { work: got.work || {}, meta: got.meta || {}, tomb: got.tomb || {}, added: dvAdded(got.files), edits: {}, lib: got.lib, ls: got.ls || {} } : null;
  const A = await localState(), dev = devId(), now = Date.now();
  let rows = [], tomb = A.tomb;
  if (B) {
    B.edits = A.edits;   // Word edits stay on the computer they were made on: the file carries none, and that mustn't read as "taken off"
    await addedDates(A, B);   // a late file's own date, where the other side took one off under the same name
    const v0 = libVer;
    let libm = mergeLib(libHere(), B.lib, { dev, now });
    if (libm.asks.length) libm = mergeLib(libHere(), B.lib, { dev, now, answers: syncDecide(libm.asks) });
    for (const w of Object.values(A.work)) if (libm.mapA[w.cls]) w.cls = libm.mapA[w.cls];
    for (const w of Object.values(B.work)) if (libm.mapB[w.cls]) w.cls = libm.mapB[w.cls];
    let plan = mergeStates(A, B, { dev, now, linked: libLinked(libm.lib, libm.cards) });
    if (plan.asks.length) plan = mergeStates(A, B, { dev, now, linked: libLinked(libm.lib, libm.cards), answers: syncDecide(plan.asks) });
    libFollow(libm, plan.rows, dev, now);
    rows = plan.rows; tomb = plan.tomb;
    // The download open on screen keeps what's there; it takes what came in the next time round, once it's closed.
    const open = batch && batch.id, came = rows.filter(r => r.kind === 'new' || r.kind === 'gone' && r.onA || r.toA || (r.meta && JSON.stringify(r.meta) !== JSON.stringify(r.ma)));
    for (const row of came) if (row.id !== open && row.kind !== 'askGone') await applyRow(row, dvSource(got.files || {}));
    // a score saved while the rows above were being written: merge it in again, so the copy taken before doesn't write over it
    if (libVer !== v0) { libm.lib = mergeLib(libHere(), libm.lib, { dev, now }).lib; libm.toA = true; }
    if (libm.toA) { lib = migrateLib(libm.lib); libUndoForget(); if (!setLibFrom(lib)) throw browserFull(); if (batch && batch.assignment) { const f = findItem(batch.assignment.id); if (f) batch.assignment = f.it; } }
    store.set('gs.tomb', tomb);
    if (got.plan && JSON.stringify(got.plan) !== JSON.stringify(store.get('gs.planCopy', null))) { store.set('gs.planCopy', got.plan); if (typeof planRefresh === 'function') planRefresh(); }
    for (const [k, v] of Object.entries(mergeLs(carryLs(), B.ls, k => Object.keys(tomb).some(id => k.includes(id))))) lsPut(k, v);
    if (came.length || libm.toA) { bank = store.get('gs.bank', bank); if (!batch) { const su = store.get('gs.setup', null); if (su) setup = setupOver(su); } await loadKept(); renderLib(); if (typeof homeRender === 'function') homeRender(); if (PHONE) phSynced(); if (wl.on && lib.classes.length) { wlClose(); go('#/'); } }
    if (open && rows.some(r => r.id === open && r.toA)) syncAgain = false;   // nothing to push for it until it is closed and merged
  }
  // What goes up: the merged copy. Papers go up apart (dvUp below) and are named in files. A row's own "papers" says where they are kept, so it stays on each device.
  const out = { app: 'Grading Studio sync', v: 1, t: now, lib: libHere(), work: {}, meta: {}, tomb, ls: carryLs() };
  const ids = new Set([...Object.keys(A.work), ...Object.keys(A.meta), ...rows.map(r => r.id)]);
  for (const id of ids) {
    if (tomb[id]) continue;
    const row = rows.find(r => r.id === id), w = row ? row.work : A.work[id], m = row ? row.meta : A.meta[id];
    if (w) out.work[id] = w;
    if (m) { const { papers, size, ...rest } = m; out.meta[id] = rest; }
  }
  delete out.ls['gs.lib'];
  out.plan = (await syncPlan()) || (got && got.plan) || null;   // a device with no Planner passes on the one it was given
  out.planT = await planSync(got && got.planT);   // the Planner, in a file of its own (below)
  out.files = dvFiles(got && got.files, tomb);
  const body = JSON.stringify(out);
  if (!got || body !== JSON.stringify({ ...got, t: now })) await syncWrite(body);
  store.set('gs.syncAt', now);
  dvCloud(out.files);
  setSyncState('synced');
  dvUpSoon();
}
window.addEventListener('focus', () => { if (G.email) syncNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && G.email) syncNow(); });
// Signed in last time: reconnect quietly when the page opens. On an iPhone's home screen that's a quick trip to Google and back, once an hour at most.
if (GOK && G.email && gcid() && !sampleOn()) setTimeout(() => {
  if (G_REDIRECT && !(G.token && Date.now() < G.exp - 60000)) {
    // offline, Google's page wouldn't load and a home-screen app has no back button: stay here and sync next time
    if (navigator.onLine === false) return setSyncState('offline: syncs when you are back online');
    let last = 0; try { last = +sessionStorage.getItem('gs.gQuiet') || 0; } catch {}
    if (Date.now() - last > 50 * 60000) { try { sessionStorage.setItem('gs.gQuiet', String(Date.now())); } catch {} return gRedirect(SYNC_SCOPE, true); }
    return setSyncState('sign in again to sync');
  }
  gToken(false).then(() => { renderGoogle(); syncNow(); }).catch(() => setSyncState('sign in again to sync'));
}, 400);
// Back from signing in on Google's page (an iPhone home-screen app), with no email kept yet: finish signing in.
if (GOK && G_REDIRECT && G.token && !G.email) setTimeout(() => gsync('about?fields=user(emailAddress)').then(r => r.json()).then(me => { G.email = me.user.emailAddress; store.set('gs.gEmail', G.email); renderGoogle(); toast('Signed in as ' + G.email); syncNow(); }).catch(e => toast(e.message)), 400);

/* Papers through Drive: each file once, named by what's in it (as a linked folder keeps them, folder.js), in the same hidden folder.
   A computer sends up the papers it keeps, in the background, after the marks; the sync file lists each download's files once they
   are all there. Another device fetches a download's papers the first time she opens it there (reopenKept), and a phone fetches one
   student's at a time (phone.js). Late files come with the marks. */
const DV = { names: null, files: store.get('gs.cloudP', null) || {}, up: null, full: false };
// Papers she can open here: kept in this browser, or waiting in her Drive.
function canOpen(m) { return !!m && (!!m.papers || (!!DV.files[m.id] && !!G.email && GOK && !sampleOn())); }
function dvCloud(files) { DV.files = Object.fromEntries(Object.entries(files || {}).filter(([, f]) => f && f.papers)); store.set('gs.cloudP', DV.files); }
const dvAdded = files => Object.fromEntries(Object.entries(files || {}).map(([id, f]) => [id, Object.fromEntries(Object.entries(f.added || {}).map(([k, r]) => [k, r.added || 0]))]));
// What the sync file lists: what was there, what this device has sent up since, nothing for a forgotten download.
function dvFiles(was, tomb) { const o = { ...(was || {}), ...(DV.sent || {}) }; for (const id of Object.keys(o)) if (tomb[id]) delete o[id]; return o; }
async function dvNames() {
  if (DV.names) return DV.names;
  const m = new Map(); let page = '';
  do {
    const j = await (await gsync("files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)&q=" + encodeURIComponent("name contains '.dat' and trashed=false") + (page ? '&pageToken=' + page : ''))).json();
    for (const f of j.files || []) m.set(f.name, f.id); page = j.nextPageToken;
  } while (page);
  return (DV.names = m);
}
async function dvPut(bytes) {
  const hash = await shaOf(bytes), name = hash + '.dat', names = await dvNames();
  if (names.has(name)) return { hash, size: bytes.length };
  const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
  let id;
  if (bytes.length <= 4e6) {
    const fd = new FormData(); fd.append('metadata', new Blob([meta], { type: 'application/json' })); fd.append('file', new Blob([bytes]));
    id = (await (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id;
  } else {
    const at = (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Length': String(bytes.length) }, body: meta })).headers.get('Location');
    id = (await (await gsync(at + '&fields=id', { method: 'PUT', body: new Blob([bytes]) })).json()).id;
  }
  names.set(name, id);
  return { hash, size: bytes.length };
}
async function dvGet(ref) {
  let id = (await dvNames()).get(ref.hash + '.dat');
  if (!id) { DV.names = null; id = (await dvNames()).get(ref.hash + '.dat'); }
  if (!id) throw new Error('A paper isn’t in your Google Drive any more. Open it on the computer that has it, and it goes up again.');
  const bytes = new Uint8Array(await (await gsync('files/' + id + '?alt=media')).arrayBuffer());
  if (bytes.length !== ref.size || await shaOf(bytes) !== ref.hash) throw new Error('A paper came down from Google Drive damaged. Try again.');
  return bytes;
}
// One download's papers and late files, sent up; its line in the sync file once every file is there.
async function dvSend(id) {
  const rec = await kget('papers', id); if (!rec || !rec.entries) return null;
  const papers = [];
  for (let i = 0; i < rec.entries.length; i++) { const data = await keptBytes(id, i, rec.entries[i]); papers.push({ path: rec.entries[i].path, ...(data ? await dvPut(data) : {}) }); }
  const added = {}, range = IDBKeyRange.bound(id + '|', id + '|￿');
  for (const k of ((await idbDo('readonly', o => o.getAllKeys(range))) || []).map(k => k.slice(id.length + 1))) { const r = await idbDo('readonly', o => o.get(id + '|' + k)); if (r) { const { data, ...x } = r; added[k] = { ...x, ...await dvPut(data) }; } }
  return { label: rec.label || '', papers, added };
}
function dvUpSoon() { if (!DV.up && !DV.full && !PHONE) DV.up = dvUp().finally(() => { DV.up = null; }); }
async function dvUp() {
  let sent = 0;
  for (const m of [...keptMeta.values()].sort((a, b) => b.t - a.t)) {
    if (!m.papers || !G.email) continue;
    const have = DV.files[m.id], added = await idbDo('readonly', o => o.getAllKeys(IDBKeyRange.bound(m.id + '|', m.id + '|￿'))) || [];
    if (have && added.every(k => have.added && k.slice(m.id.length + 1) in have.added)) continue;
    try {
      setSyncState('sending papers…');
      const f = await dvSend(m.id); if (!f) continue;
      (DV.sent ||= {})[m.id] = f; DV.files[m.id] = f; sent++;
    } catch (e) {
      if (/storageQuotaExceeded|quota/i.test(e && e.message)) { DV.full = true; setSyncState('marks synced; your Google Drive is full, so papers stay here'); return; }
      console.warn(e); setSyncState('marks synced; papers not sent yet'); return;
    }
  }
  if (sent) { store.set('gs.cloudP', DV.files); await syncNow(); DV.sent = null; } else if (!syncBusy) setSyncState('synced');
}
// Late files come with the marks; papers wait until she opens them (dvPull).
const dvSource = files => ({
  papers: async () => null, edit: async () => null,
  async added(id, k) { const r = files[id] && files[id].added && files[id].added[k]; if (!r) return null; const { hash, size, ...x } = r; return { ...x, data: await dvGet({ hash, size }) }; },
});
// A download's papers from her Drive, kept in this browser from then on.
async function dvPull(id, onStep) {
  const f = DV.files[id]; if (!f) return null;
  const entries = []; let n = 0;
  for (const e of f.papers) { entries.push({ path: e.path, data: e.hash ? await dvGet(e) : null }); onStep && onStep(++n, f.papers.length); }
  const rec = { id, label: f.label || '', entries };
  await paperPut(id, rec);
  const m = { ...(keptMeta.get(id) || await kget('meta', id) || { id }), papers: true, size: entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) };
  await kdo('meta', 'readwrite', o => o.put(m, id)); keptMeta.set(id, m);
  return rec;
}
// One student's files only, for a quick look on a phone. Not kept.
async function dvPullOne(id, key) {
  const f = DV.files[id]; if (!f) return [];
  const mine = f.papers.filter(e => e.hash && e.path.split('/')[0] === key);
  const out = []; for (const e of mine) out.push({ path: e.path, data: await dvGet(e) });
  return out;
}
/* ---------- videos from Drive: Google's own chooser, and only what she picks ---------- */
// Picking a folder lets the app know only where the folder is, not what is in it, so the folder is just where the chooser opens.
// gs.gVidDir = { id, name }: kept in this browser, like the Google account.
const driveCan = () => GOK && !!gcid();
const VID_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/x-matroska', 'video/3gpp', 'video/ogg'];   // the kinds a browser can play here
let gpP = null;
function loadPicker() {
  if (window.google && google.picker) return Promise.resolve();
  return gpP || (gpP = new Promise((res, rej) => {
    const fail = () => { gpP = null; rej(new Error('Couldn’t reach Google. Check the internet connection.')); };
    const go = () => gapi.load('picker', { callback: res, onerror: fail });
    if (window.gapi && gapi.load) return go();
    const s = document.createElement('script'); s.src = 'https://apis.google.com/js/api.js'; s.async = true; s.onload = go; s.onerror = fail; document.head.appendChild(s);
  }));
}
// o: { folder: true to pick the videos folder; else videos, opening in o.parent; multi }. Gives [{ id, name, size, mime }], or [] if she closes it.
async function drivePick(o = {}) {
  if (sampleStops('Google Drive')) return [];
  if (!gcid()) { driveSetup(); return []; }
  const t = await gToken(true, 'pick'); await loadPicker();
  if (!G.email) gsync('about?fields=user(emailAddress)').then(r => r.json()).then(me => { G.email = me.user.emailAddress; store.set('gs.gEmail', G.email); renderGoogle(); syncNow(); }).catch(() => {});
  const P = google.picker;
  return new Promise(res => {
    // Tabs: her chosen folder first (if any), then My Drive from the top, Shared with me, and shared drives. Each one can be opened folder by folder.
    const mk = (label, set) => {
      const v = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(true).setMode(P.DocsViewMode.LIST);
      // Choosing the folder still lists the videos inside, so a folder of videos doesn't look empty; picking one of them chooses its folder.
      if (o.folder) v.setSelectFolderEnabled(true); v.setMimeTypes((o.mimes || VID_MIMES).concat(FOLDER).join(','));
      if (v.setLabel) v.setLabel(label);
      set(v); return v;
    };
    const views = [];
    if (o.parent && !o.folder) views.push(mk(o.parentName || 'Videos folder', v => v.setParent(o.parent)));
    views.push(mk('My Drive', v => v.setParent('root')));
    views.push(mk('Shared with me', v => v.setOwnedByMe && v.setOwnedByMe(false)));
    views.push(mk('Shared drives', v => v.setEnableDrives && v.setEnableDrives(true)));
    const b = new P.PickerBuilder().setOAuthToken(t).setAppId(gcid().split('-')[0]).setOrigin(location.origin);
    views.forEach(v => b.addView(v));
    b
      .enableFeature(P.Feature.SUPPORT_DRIVES).setTitle(o.title || (o.folder ? 'Click your videos folder once (or any video in it), then Select' : 'Choose ' + (o.multi ? 'videos' : 'a video')))
      .setCallback(d => {
        if (d[P.Response.ACTION] === P.Action.PICKED) res((d[P.Response.DOCUMENTS] || []).map(x => o.folder && x.mimeType !== FOLDER ? (x.parentId ? { id: x.parentId, name: 'Folder with ' + x.name, mimeType: FOLDER } : null) : x).filter(x => x && (o.folder || x.mimeType !== FOLDER)).map(x => ({ id: x.id, name: x.name, size: +x.sizeBytes || 0, mime: x.mimeType || '', ...(x.parentId ? { parent: x.parentId } : {}) })));
        else if (d[P.Response.ACTION] === P.Action.CANCEL) res([]);
      });
    if (GOOGLE_API_KEY && !/@@/.test(GOOGLE_API_KEY)) b.setDeveloperKey(GOOGLE_API_KEY);
    if (o.multi) b.enableFeature(P.Feature.MULTISELECT_ENABLED);
    b.build().setVisible(true);
  });
}
const vidDir = () => store.get('gs.gVidDir', null);
async function pickVidDir() { const [d] = await drivePick({ folder: true }); if (d) store.set('gs.gVidDir', { id: d.id, name: d.name }); return d || null; }
// Videos she picks, opening in her videos folder (asking for the folder first, once).
async function driveVideos(multi) {
  let dir = vidDir(); if (!dir) { dir = await pickVidDir(); if (!dir) return []; }
  return drivePick({ parent: dir.id, parentName: dir.name, multi });
}
// Signed in for the chooser's files right now, so a video can come down without asking anything.
const drivePickReady = () => !!G.token && Date.now() < G.exp - 60000 && gHas(PICK_SCOPE);
// One picked video's bytes, a piece at a time. onStep(got, total). interactive: only after a press (it may open Google's sign-in).
async function driveBytes(id, onStep, interactive) {
  const r = await gfetch('files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', {}, interactive, 'pick');
  const total = +r.headers.get('content-length') || 0, rd = r.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (onStep) onStep(got, total); }
  return new Blob(parts, { type: r.headers.get('content-type') || '' });
}

/* ---------- playing a Drive video straight from Drive ---------- */
// The video isn't copied: the player asks this site for gs-drive/<id>, and the offline copy's service worker (src/sw.js) asks Drive for just the
// part being watched, signed with her token. It works where that service worker runs this page (the web app, not the double-click copy).
let dsOn = false, dsAsk = null;
function driveStreamOk() {
  const sw = navigator.serviceWorker;
  if (!sw || !sw.controller) return Promise.resolve(false);
  if (dsOn) return Promise.resolve(true);
  if (dsAsk) return dsAsk;
  return dsAsk = new Promise(res => {
    const ch = new MessageChannel(), done = v => { clearTimeout(to); dsAsk = null; dsOn = v; res(v); }, to = setTimeout(() => done(false), 1500);
    ch.port1.onmessage = e => done(!!(e.data && e.data.drive));
    try { sw.controller.postMessage({ type: 'gs-drive-ok' }, [ch.port2]); } catch { done(false); }
  });
}
const driveStreamUrl = id => 'gs-drive/' + encodeURIComponent(id);
// The service worker asks for her token when it has none (it forgets it whenever the browser rests it). Never opens a sign-in window.
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => {
  const d = e.data || {}, p = e.ports && e.ports[0];
  if (d.type !== 'gs-drive-token' || !p) return;
  if (d.fresh) { G.token = null; G.exp = 0; try { sessionStorage.removeItem('gs.gTok'); } catch {} }
  (gcid() && gHas(PICK_SCOPE) ? gToken(false, 'pick') : Promise.reject(new Error('sign-in'))).then(t => p.postMessage({ token: t, exp: G.exp }), () => p.postMessage({ token: null }));
});

/* The Planner through Drive: lessons, units, the timetable, the comment bank, activities and words, both ways, in a second hidden file
   (grading-studio-plan.json). The Planner keeps its own store (gs-lessons, src/planner/lessons.js); this page reads and writes it, so the
   Planner needs no sign-in of its own. What changed here since the last sync is found by comparing with what was seen then (gs.planSeen):
   a key whose value is different gets the time now, a lesson that was there and isn't was deleted here. Each lesson goes by its own time
   (updated), each key by its time; a deletion stays in gone. A store that can't be read, or comes back empty when it had lessons (an
   iPhone clears a site's storage after weeks unused), never counts as deleting anything: Drive fills it again. */
const PLAN_NAME = 'grading-studio-plan.json', PLAN_KEYS = ['setup', 'units', 'bank', 'activities', 'words', 'deflook'], PLAN_BIG = 2e6;
let planFile = null;
const planVer = async () => String((await (await gsync('files/' + planFile.id + '?fields=id,version')).json()).version || '');
async function planFileRead() {
  if (!planFile) { const f = (await (await gsync("files?spaces=appDataFolder&orderBy=createdTime&fields=files(id)&q=" + encodeURIComponent("name='" + PLAN_NAME + "' and trashed=false"))).json()).files[0]; planFile = f ? { id: f.id } : null; }
  if (!planFile) return null;
  planFile.ver = await planVer();
  try { return await (await gsync('files/' + planFile.id + '?alt=media')).json(); } catch { return null; }
}
async function planFileWrite(body) {
  if (planFile) {
    if (await planVer() !== planFile.ver) { const e = new Error('changed on another device'); e.status = 412; throw e; }
    await gsync('https://www.googleapis.com/upload/drive/v3/files/' + planFile.id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  } else {
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify({ name: PLAN_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
    fd.append('file', new Blob([body], { type: 'application/json' }));
    planFile = { id: (await (await gsync('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id };
  }
  planFile.ver = await planVer();
}
// Units carry where each is kept in this computer's Planner folder (_file, _mod): that stays here.
const planOutV = (k, v) => k === 'units' && Array.isArray(v) ? v.map(u => { if (!u || typeof u !== 'object') return u; const { _file, _mod, ...x } = u; return x; }) : v;
// What this device's Planner holds, with a time on everything that changed since the last sync. null: the store couldn't be read.
async function planHere() {
  let seen = store.get('gs.planSeen', null) || { keys: {}, ids: [], gone: {}, t: {} };
  const db = await planDb(false);
  let lessons = [], kv = {};
  if (db) {
    try {
      const t = db.transaction(['lessons', 'kv']);
      lessons = (await idbP(t.objectStore('lessons').getAll())) || [];
      for (const k of PLAN_KEYS) { const v = await idbP(t.objectStore('kv').get(k)); if (v !== undefined) kv[k] = planOutV(k, v); }
    } catch { db.close(); return null; }
    db.close();
  }
  // nothing here, though there were lessons at the last sync: the store was cleared, not every lesson deleted
  if (!lessons.length && !Object.keys(kv).length && (seen.ids || []).length) seen = { keys: {}, ids: [], gone: { ...(seen.gone || {}) }, t: {} };
  const A = { lessons: {}, kv: {}, gone: { ...(seen.gone || {}) } }, ids = new Set(), big = new Set();
  for (const l of lessons) {
    if (!l || !l.id) continue;
    const { _file, _mod, _sync, ...x } = l; ids.add(x.id);
    if (JSON.stringify(x).length > PLAN_BIG) { big.add(x.id); continue; }   // a lesson full of pictures stays on its own device for now
    A.lessons[x.id] = x;
  }
  const lost = [];
  for (const id of seen.ids || []) if (!ids.has(id) && !A.gone['l:' + id]) lost.push(id);   // deleted here since the last sync (timed once the time is known)
  for (const [k, v] of Object.entries(kv)) { const h = shaLite(JSON.stringify(v)); A.kv[k] = { v, t: seen.keys[k] === h ? (seen.t[k] || 0) : seen.at ? -1 : null }; }   // -1: changed here; null: never synced from here
  const mine = !seen.at ? !!(lessons.length || Object.keys(kv).length) : lost.length > 0 || Object.values(A.kv).some(x => x.t === -1) || [...ids].some(id => !(seen.ids || []).includes(id)) || Object.values(A.lessons).some(l => (l.updated || 0) > (seen.at || 0));
  return { A, seen, big, lost, mine };
}
const shaLite = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); };
async function planSync(remoteT) {
  if (sampleOn()) return remoteT;
  const here = await planHere(); if (!here) return remoteT;
  const { A, seen, big, lost, mine } = here;
  if (!mine && remoteT && remoteT === seen.planT) return remoteT;   // nothing new on either side
  const now = Date.now(), B = (await planFileRead()) || { lessons: {}, kv: {}, gone: {} };
  for (const id of lost) A.gone['l:' + id] = now;
  // a key changed here goes in now; on this device's first sync, what is already in Drive comes first
  for (const [k, x] of Object.entries(A.kv)) if (x.t === -1) x.t = now; else if (x.t === null) x.t = B.kv && B.kv[k] ? 0 : now;
  for (const id of big) { delete A.gone['l:' + id]; if (B.lessons && B.lessons[id]) A.lessons[id] = B.lessons[id]; }   // the copy in Drive stays as it was
  const M = mergePlan(A, B);
  await planApply(A, M, big);
  const body = JSON.stringify(M), t = shaLite(body);
  // what this device now holds is what was merged, before it goes up: if sending fails, the next sync finds nothing changed here and tries again
  const was = { keys: Object.fromEntries(Object.entries(M.kv).map(([k, x]) => [k, shaLite(JSON.stringify(x.v))])), t: Object.fromEntries(Object.entries(M.kv).map(([k, x]) => [k, x.t])), ids: [...new Set([...Object.keys(M.lessons), ...big])], gone: M.gone, at: now };
  store.set('gs.planSeen', { ...was, planT: null });
  if (JSON.stringify(B) !== body) await planFileWrite(body);
  store.set('gs.planSeen', { ...was, planT: t });
  return t;
}
// Into this device's Planner: what came from the other side. A lesson or key the Planner saved again while the merge was on its way stays
// as she left it (it goes up next time). Lessons kept in the Planner folder: a changed one is written to its file again, a deleted one's
// file is taken away (src/planner/lessons.js, planFolderCatchUp), or the folder would bring it back. A Planner open in another tab picks
// it all up (gs-plan-in, src/planner/base.js).
async function planApply(A, M, big) {
  const put = Object.values(M.lessons).filter(l => !big.has(l.id) && JSON.stringify(A.lessons[l.id]) !== JSON.stringify(l));
  const del = Object.keys(M.gone).filter(k => k.startsWith('l:')).map(k => k.slice(2)).filter(id => A.lessons[id] && !big.has(id));
  const keys = Object.entries(M.kv).filter(([k, x]) => !A.kv[k] || JSON.stringify(A.kv[k].v) !== JSON.stringify(x.v));
  if (!put.length && !del.length && !keys.length) return;
  const db = await planDb(true); if (!db) return;
  try {
    await new Promise((res, rej) => {
      const t = db.transaction(['lessons', 'kv'], 'readwrite'), ls = t.objectStore('lessons'), kv = t.objectStore('kv'), goneFiles = [];
      const same = (was, id) => (was ? was.updated || 0 : null) === (A.lessons[id] ? A.lessons[id].updated || 0 : null);
      for (const l of put) { const r = ls.get(l.id); r.onsuccess = () => { const was = r.result; if (!same(was, l.id)) return; ls.put(was && was._file ? { ...l, _file: was._file, _mod: was._mod, _sync: 1 } : l); }; }
      for (const id of del) { const r = ls.get(id); r.onsuccess = () => { const was = r.result; if (!was || !same(was, id)) return; if (was._file) goneFiles.push(was._file); ls.delete(id); }; }
      for (const [k, x] of keys) {
        const r = kv.get(k);
        r.onsuccess = () => {
          const was = r.result; if (JSON.stringify(planOutV(k, was)) !== JSON.stringify(A.kv[k] ? A.kv[k].v : undefined)) return;
          let v = x.v;
          if (k === 'units' && Array.isArray(v) && Array.isArray(was)) v = v.map(u => { const o = was.find(w => w && u && w.id === u.id); return o && o._file ? { ...u, _file: o._file, _mod: o._mod } : u; });
          kv.put(v, k);
        };
      }
      // after the reads above: the files of lessons deleted here by the sync, for the Planner to take out of its folder
      const g = kv.get('syncGoneFiles');
      const last = ls.count(); last.onsuccess = () => { if (goneFiles.length) kv.put([...new Set([...(g.result || []), ...goneFiles])], 'syncGoneFiles'); };   // asked last, so it answers after every read above
      t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error);
    });
  } finally { db.close(); }
  try { const ch = new BroadcastChannel('gs-plan-in'); ch.postMessage('sync'); ch.close(); } catch {}
  if (typeof planRefresh === 'function') planRefresh();
}
// The Planner in another tab saved something: sync soon, the same as a save here.
try { new BroadcastChannel('gs-plan-out').onmessage = () => syncSoon(); } catch {}
