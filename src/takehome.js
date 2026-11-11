/* ---------------- the take-home file: everything for grading in one passphrase-protected file ---------------- */
// The file, in order:
//   "GSWORK1\n", the header's length (4 bytes), the header as JSON: { v, kdf: { name, hash, iter, salt }, cipher, chunk, np }
//   a short check block, which tells a wrong passphrase apart from a damaged file
//   chunks of AES-256-GCM, each chunk bytes of plain data and a 16-byte tag, the last one shorter or equal.
// A chunk's nonce is np (7 random bytes), its number (4 bytes) and 1 if it's the last, and the hash of everything up to the check block is authenticated with each one.
// So a changed byte, a changed header, chunks swapped or cut off, all fail. The key comes from the passphrase with a salt that's new for each file.
// Inside, frames: 4 bytes of JSON length, the JSON, then { n } bytes. Frames with no bytes come first (info, ls, tomb, dl), then the papers, late files, readings and Word edits, and last { k: 'end' }.
// Nothing is ever all in memory. Records are read one at a time, chunks go straight to the disk, and reading back slices the file.
const TAKE_MAGIC = 'GSWORK1\n', TAKE_ITER = 1000000, TAKE_CHUNK = 4 * 1024 * 1024, TAKE_EXT = '.gswork';
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = t => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
class TakeError extends Error { constructor(code) { super(code); this.code = code; } }
async function takeKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const takeNonce = (np, i, flag) => { const n = new Uint8Array(12); n.set(np); new DataView(n.buffer).setUint32(7, i); n[11] = flag; return n; };
const CHECK_I = 0xffffffff;

/* writing */
// sink: { write(bytes), close(), abort() }. onp(bytes so far).
// more (a new year's archive): { info: more fields for the info frame, extra: async frame => more frames before the end }.
async function takeWrite(sink, pass, onp, stop, more) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), np = crypto.getRandomValues(new Uint8Array(7));
  const hdr = te.encode(JSON.stringify({ v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iter: TAKE_ITER, salt: b64(salt) }, cipher: 'AES-256-GCM', chunk: TAKE_CHUNK, np: b64(np) }));
  const head = new Uint8Array(TAKE_MAGIC.length + 4 + hdr.length);
  head.set(te.encode(TAKE_MAGIC)); new DataView(head.buffer).setUint32(TAKE_MAGIC.length, hdr.length); head.set(hdr, TAKE_MAGIC.length + 4);
  const key = await takeKey(pass, salt, TAKE_ITER), ad = await crypto.subtle.digest('SHA-256', head);
  await sink.write(head);
  await sink.write(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: takeNonce(np, CHECK_I, 2), additionalData: ad }, key, new Uint8Array(16))));
  const buf = new Uint8Array(TAKE_CHUNK);
  let fill = 0, idx = 0, total = 0;
  const seal = async last => {
    if (stop && stop()) throw new DOMException('Stopped', 'AbortError');
    await sink.write(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: takeNonce(np, idx++, last ? 1 : 0), additionalData: ad }, key, buf.subarray(0, fill))));
    total += fill; fill = 0; if (onp) onp(total);
  };
  const push = async u => {
    for (let at = 0; at < u.length;) {
      if (fill === TAKE_CHUNK) await seal(false);
      const n = Math.min(u.length - at, TAKE_CHUNK - fill);
      buf.set(u.subarray(at, at + n), fill); fill += n; at += n;
    }
  };
  const frame = async (o, bytes) => {
    const j = te.encode(JSON.stringify(bytes ? { ...o, n: bytes.length } : o)), len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, j.length);
    await push(len); await push(j); if (bytes) await push(bytes);
  };
  await keepWait;   // a big download may still be going in
  const A = await localState();
  const metas = Object.keys(A.meta), ids = [...new Set([...metas, ...Object.keys(A.work)])];
  await frame({ k: 'info', app: 'Grading Studio', kind: 'take-home', t: Date.now(), from: location.host || 'an offline copy', ver: gsData.APP_VERSION, dataV: gsData.version(), downloads: ids.length, ...((more && more.info) || {}) });
  await frame({ k: 'ls', ls: carryLs() });
  await frame({ k: 'tomb', tomb: A.tomb });
  for (const id of ids) await frame({ k: 'dl', id, work: A.work[id] || null, meta: A.meta[id] || null });
  for (const id of await paperHeads()) {   // one file's bytes at a time, however big the download
    const rec = await kdo('papers', 'readonly', o => o.get(id)), es = (rec && rec.entries) || [];
    for (let i = 0; i < es.length; i++) { const data = await keptBytes(id, i, es[i]); if (data) await frame({ k: 'paper', id, label: rec.label || '', path: es[i].path }, data); else await frame({ k: 'paper', id, label: rec.label || '', path: es[i].path, none: true }); }
  }
  await eachRec(addDb, 'files', async (k, rec) => { const { data, ...r } = rec, i = k.indexOf('|'); await frame({ k: 'added', id: k.slice(0, i), lk: k.slice(i + 1), rec: r }, data); });
  await eachRec(keepDb, 'edits', async (k, rec) => {
    const i = k.indexOf('|'), orig = rec.orig || new Uint8Array(0), both = new Uint8Array(rec.data.length + orig.length);
    both.set(rec.data); both.set(orig, rec.data.length);
    await frame({ k: 'edit', id: k.slice(0, i), path: k.slice(i + 1), t: rec.t || 1, nd: rec.data.length, hasOrig: !!rec.orig }, both);
  });
  await schReady;   // the files of the school resources (school.js)
  for (const f of schRefs()) { const data = await schBytes(f.hash); if (data) await frame({ k: 'school', hash: f.hash }, data); }
  if (more && more.extra) await more.extra(frame);
  await frame({ k: 'end' });
  await seal(true);
  await sink.close();
  return total;
}
// Straight to the disk where the browser allows it. Otherwise chunks wait as small Blobs, which the browser keeps out of the tab's memory, until the download starts.
let takeSinkFor = null;   // tests hand in a file handle here: the save dialog can't be driven
async function takeSink(name) {
  // A school's policy can block the save dialog. Only her saying no stops here: otherwise it comes as a plain download, which still works.
  try {
    const fh = takeSinkFor || (window.showSaveFilePicker ? await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Grading Studio take-home file', accept: { 'application/octet-stream': [TAKE_EXT] } }] }) : null);
    if (fh) { const w = await fh.createWritable(); return { name: fh.name, write: b => w.write(b), close: () => w.close(), abort: () => w.abort() }; }
  } catch (e) { if (e && e.name === 'AbortError') throw e; console.error(e); }
  const parts = [];
  return { name, write: async b => { parts.push(new Blob([b])); }, close: () => saveBlob(name, new Blob(parts, { type: 'application/octet-stream' })), abort: async () => {} };
}

/* reading */
// Checks the passphrase and gets ready to read. Throws TakeError: notours, newer, pass.
async function takeOpen(file, pass) {
  const start = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (td.decode(start.subarray(0, TAKE_MAGIC.length)) !== TAKE_MAGIC) throw new TakeError('notours');
  const len = new DataView(start.buffer).getUint32(TAKE_MAGIC.length), hs = TAKE_MAGIC.length + 4 + len;
  if (hs + 32 > start.length) throw new TakeError('damaged');
  let h; try { h = JSON.parse(td.decode(start.subarray(TAKE_MAGIC.length + 4, hs))); } catch { throw new TakeError('damaged'); }
  if (h.v !== 1) throw new TakeError(h.v > 1 ? 'newer' : 'damaged');
  const iter = h.kdf && h.kdf.iter, chunk = h.chunk;
  if (!(iter >= 100000 && iter <= 20000000) || !(chunk >= 4096 && chunk <= 64 * 1024 * 1024) || h.kdf.name !== 'PBKDF2' || h.cipher !== 'AES-256-GCM') throw new TakeError('damaged');
  let salt, np; try { salt = unb64(h.kdf.salt); np = unb64(h.np); } catch { throw new TakeError('damaged'); }
  if (np.length !== 7) throw new TakeError('damaged');
  const key = await takeKey(pass, salt, iter), ad = await crypto.subtle.digest('SHA-256', start.subarray(0, hs));
  try { await crypto.subtle.decrypt({ name: 'AES-GCM', iv: takeNonce(np, CHECK_I, 2), additionalData: ad }, key, start.subarray(hs, hs + 32)); }
  catch { throw new TakeError('pass'); }
  const body = hs + 32, tagged = chunk + 16, bodyLen = file.size - body, nChunks = Math.ceil(bodyLen / tagged), lastLen = bodyLen - (nChunks - 1) * tagged;
  if (nChunks < 1 || lastLen < 16) throw new TakeError('damaged');
  const plainLen = (nChunks - 1) * chunk + lastLen - 16;
  let held = -1, heldBytes = null;
  const chunkAt = async i => {
    if (i === held) return heldBytes;
    const s = body + i * tagged, last = i === nChunks - 1, ct = await file.slice(s, Math.min(s + tagged, file.size)).arrayBuffer();
    let p; try { p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: takeNonce(np, i, last ? 1 : 0), additionalData: ad }, key, ct); }
    catch { throw new TakeError('damaged'); }
    held = i; heldBytes = new Uint8Array(p);
    return heldBytes;
  };
  const read = async (off, n) => {
    if (off + n > plainLen) throw new TakeError('damaged');
    const out = new Uint8Array(n);
    for (let at = 0; at < n;) {
      const i = Math.floor((off + at) / chunk), c = await chunkAt(i), from = off + at - i * chunk, m = Math.min(n - at, c.length - from);
      out.set(c.subarray(from, from + m), at); at += m;
    }
    return out;
  };
  return { read, chunkAt, chunk, plainLen };
}
// Goes through the whole file first, so a damaged or changed one fails before anything is touched, and collects all but the bytes.
async function takeScan(rd, onp) {
  const B = { work: {}, meta: {}, tomb: {}, added: {}, edits: {}, papers: {}, addedAt: {}, editAt: {}, school: {}, ls: {}, lib: null, info: null, need: 0 };
  let pos = 0, seen = -1, ended = false;
  const skipTo = async end => { const stop = Math.ceil(end / rd.chunk); for (let i = seen + 1; i < stop; i++) { await rd.chunkAt(i); seen = i; if (onp) onp((i + 1) * rd.chunk); } };
  try {
    while (!ended) {
      if (pos + 4 > rd.plainLen) throw new TakeError('damaged');
      const len = new DataView((await rd.read(pos, 4)).buffer).getUint32(0);
      const f = JSON.parse(td.decode(await rd.read(pos + 4, len)));
      pos += 4 + len;
      seen = Math.max(seen, Math.floor((pos - 1) / rd.chunk));
      const n = f.n || 0;
      if (f.k === 'info') B.info = f;
      else if (f.k === 'ls') { B.ls = f.ls || {}; try { B.lib = JSON.parse(B.ls['gs.lib']); } catch {} }
      else if (f.k === 'tomb') B.tomb = f.tomb || {};
      else if (f.k === 'dl') { if (f.work) B.work[f.id] = f.work; if (f.meta) B.meta[f.id] = f.meta; }
      else if (f.k === 'paper') { const p = B.papers[f.id] ||= { label: f.label, entries: [], size: 0 }; p.entries.push({ path: f.path, off: pos, n, none: f.none }); p.size += n; }
      else if (f.k === 'added') { (B.addedAt[f.id] ||= {})[f.lk] = { rec: f.rec, off: pos, n }; (B.added[f.id] ||= {})[f.lk] = f.rec.added || 0; }
      else if (f.k === 'edit') { (B.editAt[f.id] ||= {})[f.path] = { t: f.t, off: pos, n, nd: f.nd, hasOrig: f.hasOrig }; (B.edits[f.id] ||= {})[f.path] = f.t; }
      else if (f.k === 'school') B.school[f.hash] = { off: pos, n };
      else if (f.k === 'plan') (B.plan ||= []).push({ f, off: pos, n });   // the Planner's records, in a year's archive
      else if (f.k === 'end') ended = true;
      await skipTo(pos + n);
      pos += n;
    }
  } catch (e) { if (e instanceof TakeError) throw e; console.error(e); throw new TakeError('damaged'); }
  if (pos !== rd.plainLen || !B.info || B.info.app !== 'Grading Studio') throw new TakeError('damaged');
  return B;
}
const takeSource = (rd, B) => ({
  async papers(id) {
    const p = B.papers[id]; if (!p) return null;
    const entries = [];
    for (const e of p.entries) entries.push({ path: e.path, data: e.none ? null : await rd.read(e.off, e.n) });
    return { id, label: p.label, entries };
  },
  async added(id, k) { const a = B.addedAt[id] && B.addedAt[id][k]; return a ? { ...a.rec, data: await rd.read(a.off, a.n) } : null; },
  async edit(id, p) {
    const e = B.editAt[id] && B.editAt[id][p]; if (!e) return null;
    const both = await rd.read(e.off, e.n);
    return { t: e.t, data: both.slice(0, e.nd), orig: e.hasOrig ? both.slice(e.nd) : null };
  },
  async school(hash) { const s = B.school && B.school[hash]; return s ? rd.read(s.off, s.n) : null; },
});
const TAKE_SAY = {
  notours: 'That isn’t a Grading Studio take-home file.',
  pass: 'That passphrase doesn’t open this file. Check it and try again. If you’re sure of it, the file may be damaged. Nothing here has changed.',
  damaged: 'This file is damaged, or it’s been changed since it was made, so it can’t be trusted. Nothing here has changed. Make a new one if you can.',
  newer: 'This file was made by a newer copy of Grading Studio. Nothing here has changed. Reload this page to get the newest copy, then try again.',
};

/* Take my work with me */
const passFields = () => '<label class="tkf">Passphrase<input type="password" id="takeP1" autocomplete="off"></label>';
// Downloads this browser has work for, but not the papers. The file can't carry what isn't here, and she needs to know before she's at the other computer.
const papersLacking = () => [...keptMeta.values()].filter(m => !m.papers).map(m => m.name || 'A download');
function openTake() {
  if (batch) saveNow();
  openDlg('<div class="bh"><h2>Take my work with me</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="takeBox">' +
    '<p style="margin-top:0">Makes one protected file with everything you need to grade on another computer: student files, marks, scores, comments, rosters, rubrics, readings, Word edits and added files. Planner work stays here.</p>' +
    '<p class="muted" style="font-size:14px">Choose a passphrase of a few words. If you forget it, nobody can open this file, you included, but your work here isn’t affected. Keep the file somewhere private all the same.</p>' +
    passFields() + '<label class="tkf">Again, to be sure<input type="password" id="takeP2" autocomplete="off"></label><p class="tkerr" id="takeErr" role="alert" hidden></p></div>' +
    '<div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" id="takeGo">Make the file</button></div>', true);
  const box = $('#dlgBox');
  Promise.resolve(keepWait).then(() => {   // a big download may still be going in
    const names = papersLacking(), at = box.querySelector('#takeErr');
    if (names.length && at) at.insertAdjacentHTML('beforebegin', '<p class="tkerr" id="takeLack">No papers for: ' + esc(names.join(', ')) + '. This browser isn’t keeping them, so only the marks and scores will be in the file. To take the papers too, drop each of those downloads in here first.</p>');
  });
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('#takeGo')) return;
    const p1 = $('#takeP1').value, p2 = $('#takeP2').value, err = t => { const el = $('#takeErr'); el.textContent = t; el.hidden = false; };
    if (p1.length < 8) return err('Please use at least 8 characters. A few ordinary words work well.');
    if (p1 !== p2) return err('Those two don’t match.');
    const now = new Date(), day = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'), name = 'Grading Studio work ' + day + TAKE_EXT;
    let sink;
    try { sink = await takeSink(name); }
    catch (er) { if (er && er.name === 'AbortError') return; console.error(er); return err('That file couldn’t be written there. Try another place.'); }
    let stopped = false;
    box.querySelector('.bb').innerHTML = '<p style="margin-top:0" id="takeMsg">Packing your work…</p><progress id="takeBar" style="width:100%"></progress>';
    box.querySelector('.bf').innerHTML = '<button class="btn" id="takeStop">Stop</button>';
    $('#takeStop').onclick = () => { stopped = true; };
    let total = 0; for (const m of keptMeta.values()) total += m.size || 0;
    try {
      const size = await takeWrite(sink, p1, n => { const b = $('#takeBar'), m = $('#takeMsg'); if (b && total) { b.max = total; b.value = Math.min(n, total); } if (m) m.textContent = 'Packing your work… ' + fmtSize(n) + (total ? ' of about ' + fmtSize(total) : ''); }, () => stopped);
      store.set('gs.lastBackup', Date.now()); renderBackup();
      const lacking = papersLacking();
      end('Done: <b>' + esc(sink.name) + '</b> (' + fmtSize(size) + '). Open Grading Studio on the other computer and use <b>Bring work in</b>. The same goes for the trip back.' + (lacking.length ? '<br><br><b>Its papers aren’t in the file for: ' + esc(lacking.join(', ')) + '.</b> Only the marks and scores went. You’ll need those downloads on the other computer.' : ''), 'Done');
    } catch (er) {
      try { await sink.abort(); } catch {}
      if (er && er.name === 'AbortError') return closeDlg();
      console.error(er);
      end('The file didn’t finish, so it isn’t usable. ' + (er && er.name === 'QuotaExceededError' ? 'There isn’t enough room on that disk. ' : '') + 'Your work here is fine. Please try again, somewhere with more room.', 'Close');
    }
  };
  box.onkeydown = e => { if (e.key === 'Enter' && /^takeP[12]$/.test(e.target.id)) { e.preventDefault(); $('#takeGo').click(); } };
  // Escape can close the box while it's still packing, so the end opens one of its own.
  const end = (html, btn) => {
    openDlg('<div class="bh"><h2>Take my work with me</h2></div><div class="bb"><p style="margin-top:0" id="takeDone">' + html + '</p></div><div class="bf"><button class="btn primary" data-close>' + btn + '</button></div>', true);
    $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) closeDlg(); };
  };
  $('#takeP1').focus();
}

/* Bring work in */
function bringFile(file) {
  if (/\.zip$/i.test(file.name)) return restoreBackup(file);
  const ask = msg => {
    openDlg('<div class="bh"><h2>Bring work in</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="takeBox"><p style="margin-top:0">Type the passphrase for <b>' + esc(file.name) + '</b>. The whole file is checked before anything here changes.</p>' + passFields() + '<p class="tkerr" id="takeErr" role="alert"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p></div><div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" id="takeGo">Open it</button></div>', true);
    const box = $('#dlgBox');
    const go = async () => {
      const pass = $('#takeP1').value;
      box.querySelector('.bb').innerHTML = '<p style="margin-top:0" id="takeMsg">Checking the file…</p><progress id="takeBar" style="width:100%"></progress>';
      box.querySelector('.bf').innerHTML = '';
      let B, rd;
      try {
        rd = await takeOpen(file, pass);
        B = await takeScan(rd, n => { const b = $('#takeBar'), m = $('#takeMsg'); if (b) { b.max = rd.plainLen; b.value = Math.min(n, rd.plainLen); } if (m) m.textContent = 'Checking the file… ' + fmtSize(Math.min(n, rd.plainLen)) + ' of ' + fmtSize(rd.plainLen); });
        if (B.info.dataV > gsData.DATA_V) throw new TakeError('newer');
      } catch (e) {
        if (!(e instanceof TakeError)) console.error(e);
        const code = e instanceof TakeError ? e.code : 'damaged';
        if (code === 'pass') return ask(TAKE_SAY.pass);
        closeDlg(); return sayDlg(TAKE_SAY[code] || TAKE_SAY.damaged);
      }
      await bringPreview(B, takeSource(rd, B), 'this file', 'Made ' + new Date(B.info.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' on ' + (B.info.from || 'another computer'));
    };
    box.onclick = e => { if (e.target.closest('[data-close]')) return closeDlg(); if (e.target.closest('#takeGo')) go(); };
    box.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'takeP1') { e.preventDefault(); go(); } };
    $('#takeP1').focus();
  };
  ask();
}
const whenOf = t => t ? new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'an earlier time';
// One side of a student who changed in both places.
function sideHtml(r, t, anon, crit) {
  if (!r) return '<div class="muted">Nothing here</div>';
  const g = r.g || {}, out = ['<div class="muted">Changed ' + esc(whenOf(t)) + '</div>'], rows = g.rubric || [];
  if (rows.some(v => v != null)) out.push('<div>Rubric: ' + (crit ? crit.map((c, i) => esc(c) + ': ' + (rows[i] == null ? '–' : esc(rows[i]))) : rows.map(v => v == null ? '–' : esc(v))).join(', ') + '</div>');
  if (g.points != null && g.points !== '') out.push('<div>Points: ' + esc(g.points) + '</div>');
  if (g.sheet != null && g.sheet !== '') out.push('<div>Grade sheet: ' + esc(g.sheet) + '</div>');
  if (g.status) out.push('<div>Marked ' + esc(g.status) + '</div>');
  if (g.comment) out.push('<div class="cfc">“' + esc(g.comment) + '”</div>');
  for (const [p, pages] of Object.entries(r.f || {})) {
    const n = Object.values(pages).reduce((a, x) => a + x.length, 0), ft = r.ft && r.ft[p];
    out.push('<div>' + (anon ? 'A file' : esc(p.split('/').pop())) + ': ' + n + (n === 1 ? ' mark' : ' marks') + (ft ? ' <span class="muted">(' + esc(whenOf(ft)) + ')</span>' : '') + '</div>');
  }
  if (out.length === 1) out.push('<div class="muted">No score, comment or marks</div>');
  return out.join('');
}
const PART_SAY = { setup: 'Rubric setup', cls: 'Class', share: 'Cover boxes and Claude codes', drive: 'Google Drive link', light: 'Lighting', lightOpt: 'Lighting', lightPg: 'Lighting', lightPgL: 'Lighting', anon: 'Anonymous grading', moved: 'Moved files', removed: 'Removed and replaced files', refSkip: 'Which readings each student sees', quiz: 'Quick mark boxes', groups: 'Group work', returned: 'Returned to students', carry: 'Flags on new and changed files', scan: 'Your answers about scanned pages' };
const partNames = list => [...new Set(list.map(k => PART_SAY[k] || k))].join(', ');
const scaleSay = su => !rubricsDiffer(su, { ...su, scale: null }) ? 'No scale: percent is the plain share of points' : !rubricsDiffer(su, { ...su, scale: SCALE12 }) ? 'The usual grading scale' : 'A grading scale of its own';
// One side of a setting that changed in both places.
function partSide(part, v, other, t, anon) {
  const out = t == null ? [] : ['<div class="muted">Changed ' + esc(whenOf(t)) + '</div>'];
  if (part === 'setup') {
    const c = (v && v.criteria) || [];
    if (!v) out.push('<div>Nothing set up</div>');
    else if (v.mode === 'points') out.push('<div>Points, out of ' + esc(v.outOf) + '</div>');
    else out.push('<div>Rubric with ' + c.length + (c.length === 1 ? ' row' : ' rows') + ', out of ' + rowsMax(v) + '</div><div class="muted">' + esc(c.join(', ')) + '</div>');
    if (v && other && scaleSay(v) !== scaleSay(other)) out.push('<div class="muted">' + scaleSay(v) + '</div>');
    if (v && v.rubricPage && v.rubricPage.name) out.push('<div class="muted">Rubric page: ' + esc(v.rubricPage.name) + '</div>');
  } else if (part === 'cls') { const c = (lib.classes || []).find(x => x.id === v); out.push('<div>' + (c ? esc(c.name) : 'No class') + '</div>'); }
  else if (part === 'anon') out.push('<div>' + (v && v.on ? 'On' : 'Off') + '</div>');
  else for (const [p, k] of Object.entries(v || {})) if (other && other[p] != null && other[p] !== k) out.push('<div>' + (anon ? 'A file goes to one student' : esc(p.split('/').pop()) + ' goes to ' + esc(k)) + '</div>');
  return out.join('');
}
// The questions, as a block of radio buttons. Nothing's chosen until she chooses it.
function conflictsHtml(asks, other) {
  return asks.map((a, i) => {
    if (a.gone) return '<div class="cfrow" data-cf="' + i + '"><h3>' + esc(a.name) + '</h3><p>This download was forgotten, but one copy has work on it from after that.</p><label class="chk"><input type="radio" name="cf' + i + '" value="gone"> Leave it forgotten</label><label class="chk"><input type="radio" name="cf' + i + '" value="back"> Bring it back</label></div>';
    return '<div class="cfrow" data-cf="' + i + '"><h3>' + esc(a.part ? PART_SAY[a.part] : a.anon ? 'A student (anonymous grading is on)' : a.key) + ' <span class="muted">· ' + esc(a.name) + '</span></h3>' + (a.part === 'setup' ? '<p class="muted" style="font-size:14px;margin:0 0 6px">Scores stay saved either way. Totals and percents follow the one you pick.</p>' : a.ca ? '<p class="muted cfrows" style="font-size:14px;margin:0 0 6px">These two copies don’t have the same rubric rows, so each shows its own. ' + (a.off ? 'A score on a row with no match by name in the rows you keep comes in blank, for you to score again.' : 'The one you pick goes onto the rows you keep, row by row.') + '</p>' : '') + '<div class="cfcols">' +
      '<label class="cfside"><span><input type="radio" name="cf' + i + '" value="a"> <b>' + esc(a.la || 'On this computer') + '</b></span>' + (a.part ? partSide(a.part, a.a, a.b, a.ta, a.anon) : sideHtml(a.a, a.ta, a.anon, a.ca)) + '</label>' +
      '<label class="cfside"><span><input type="radio" name="cf' + i + '" value="b"> <b>' + esc(a.lb || other) + '</b></span>' + (a.part ? partSide(a.part, a.b, a.a, a.tb, a.anon) : sideHtml(a.b, a.tb, a.anon, a.cb)) + '</label></div></div>';
  }).join('');
}
function conflictAnswers(asks, root) {
  const ans = {}; let all = true;
  asks.forEach((a, i) => {
    const on = root.querySelector('input[name="cf' + i + '"]:checked');
    if (!on) { all = false; return; }
    ans[a.gone ? '!' + a.id : a.id + '|' + a.key] = on.value;
  });
  return all ? ans : null;
}
// The computers' clocks may not agree, so this only fills in the choice: she can still look before she confirms.
function conflictsNewest(asks, root) {
  asks.forEach((a, i) => { const v = a.gone ? 'gone' : a.tb > a.ta ? 'b' : 'a', el = root.querySelector('input[name="cf' + i + '"][value="' + v + '"]'); if (el) el.checked = true; });
}
function showConflicts(asks, { title, intro, other, cancel, noNewest }) {
  return new Promise(done => {
    openDlg('<div class="bh"><h2>' + esc(title) + '</h2></div><div class="bb" id="cfBox"><p style="margin-top:0">' + esc(intro) + '</p>' + conflictsHtml(asks, other) + '</div>' +
      '<div class="bf"><button class="btn" data-cflater>' + esc(cancel) + '</button>' + (noNewest ? '' : '<button class="btn" data-cfnew>Pick the newest for each</button>') + '<button class="btn primary" data-cfok>Use what I picked</button></div>');
    const box = $('#dlgBox');
    dlgGone = () => done(null);   // Esc or a click outside is a not now as well
    box.onclick = e => {
      if (e.target.closest('[data-cflater]')) { closeDlg(); return done(null); }
      if (e.target.closest('[data-cfnew]')) return conflictsNewest(asks, box);
      if (e.target.closest('[data-cfok]')) {
        const ans = conflictAnswers(asks, box);
        if (!ans) return toast('Please choose a version for each one first.');
        done(ans); closeDlg();
      }
    };
  });
}
function noteLine(n) {
  const nm = esc(n.name || '');
  if (n.kind === 'newClass') return 'New class: ' + nm + (n.n ? ' with ' + n.n + (n.n === 1 ? ' name' : ' names') : '');
  if (n.kind === 'newUnit') return 'New unit: ' + nm;
  if (n.kind === 'newItem') return 'New assignment: ' + nm;
  if (n.kind === 'gone') return 'Removed on the other side: ' + nm;
  if (n.kind === 'both') return (n.rubric ? 'Rubric for ' : '') + nm + ': changed in both places, so the later one is kept';
  if (n.kind === 'roster') return 'Roster for ' + nm + (n.both ? ', changed in both places: keeps everyone, adding ' : ': ') + (n.both ? esc(n.add.join(', ')) : [n.add.length ? 'adds ' + esc(n.add.join(', ')) : '', n.drop.length ? 'takes off ' + esc(n.drop.join(', ')) : ''].filter(Boolean).join(', and '));
  return 'Changed: ' + nm;
}
function bringNames(row, pick) {
  const list = row.rows.filter(r => r.pick === pick);
  return row.anon ? list.length + (list.length === 1 ? ' student' : ' students') : list.map(r => r.key).join(', ');
}
// How merging the file in looks right now. It's read from storage every time, because other tabs go on saving, and while a box is open this tab's own copy of the library waits.
const libHere = () => { const had = store.get('gs.lib', null); return had ? migrateLib(had) : lib; };
async function bringPlan(B) {
  const A = await localState(), dev = devId(), now = Date.now(), work = {};
  await addedDates(A, B);
  const libm = mergeLib(libHere(), B.lib, { dev, now });
  for (const w of Object.values(A.work)) if (libm.mapA[w.cls]) w.cls = libm.mapA[w.cls];
  for (const [id, w] of Object.entries(B.work)) work[id] = libm.mapB[w.cls] ? { ...w, cls: libm.mapB[w.cls] } : w;
  const Bm = { ...B, work }, plan = mergeStates(A, Bm, { dev, now, linked: libLinked(libm.lib, libm.cards) });
  return { A, B: Bm, libm, plan, dev, now, lsSet: mergeLs(carryLs(), B.ls, k => Object.keys(plan.tomb).some(id => k.includes(id))) };
}
// A question and the copy here she'd be answering it about. If either's new, she hasn't really answered it.
const askSig = a => a.gone ? '!' + a.id + '|' + (a.work && a.work.t) : a.id + '|' + a.key + '|' + recHash(a.a);
// What will change, then her say-so. Nothing has been touched up to here.
async function bringPreview(B, src, label, sub, again) {
  const { plan, libm, lsSet } = await bringPlan(B), rows = plan.rows, lines = [], asks = [...plan.asks, ...libm.asks], shown = new Set(asks.map(askSig));
  const nw = rows.filter(r => r.kind === 'new'), mg = rows.filter(r => r.kind === 'merge'), gn = rows.filter(r => r.kind === 'gone');
  const li = t => '<li>' + t + '</li>';
  if (nw.length) lines.push('<p><b>' + nw.length + ' new ' + (nw.length === 1 ? 'download' : 'downloads') + '</b></p><ul>' + nw.map(r => li(esc(r.name) + ' <span class="muted">· ' + (r.meta && r.meta.n || Object.keys((r.work && r.work.s) || {}).length) + ' ' + ((r.meta && r.meta.n || Object.keys((r.work && r.work.s) || {}).length) === 1 ? 'student' : 'students') + (r.work ? ', ' + r.meta.scored + ' scored' : '') + (B.papers && B.papers[r.id] ? ', ' + fmtSize(B.papers[r.id].size) : '') + '</span>')).join('') + '</ul>');
  if (mg.length) lines.push('<p><b>Changes to downloads you have here</b></p><ul id="bringMerge">' + mg.map(r => {
    const inn = r.rows.filter(x => x.pick === 'b'), stay = r.rows.filter(x => x.pick === 'a'), dated = r.rows.filter(x => x.by === 'date').length, pooled = r.setBoth.filter(x => x.pooled).map(x => x.k), later = r.setBoth.filter(x => !x.pooled).map(x => x.k);
    return '<li><b>' + esc(r.name) + '</b>' + (r.extra ? '<div>' + r.extra + (r.extra === 1 ? ' file changes' : ' files change') + ': late files, readings or Word edits</div>' : '') + (inn.length ? '<div>' + inn.length + (inn.length === 1 ? ' student comes' : ' students come') + ' in from ' + label + ': ' + esc(bringNames(r, 'b')) + '</div>' : '') +
      (stay.length ? '<div class="muted">' + stay.length + (stay.length === 1 ? ' student stays' : ' students stay') + ' the same here, because this copy is newer: ' + esc(bringNames(r, 'a')) + '</div>' : '') +
      (r.lined && r.lined.length ? '<div class="bringLined">The two copies don’t have the same rubric rows, so each score goes to its own row by the row’s name: ' + (r.anon ? r.lined.length + (r.lined.length === 1 ? ' student' : ' students') : esc(r.lined.join(', '))) + '</div>' : '') +
      (dated ? '<div class="muted">' + dated + (dated === 1 ? ' of these has' : ' of these have') + ' no history to go by, so the date decided.</div>' : '') +
      (r.setIn.length ? '<div>Comes in from ' + label + ': ' + esc(partNames(r.setIn)) + '</div>' : '') +
      (pooled.length ? '<div class="muted">Changed in both places, so both are kept: ' + esc(partNames(pooled)) + '</div>' : '') +
      (later.length ? '<div class="muted">Changed in both places, so the later one is kept: ' + esc(partNames(later)) + '</div>' : '') + '</li>';
  }).join('') + '</ul>');
  if (gn.length) lines.push('<p><b>Forgotten</b></p><ul>' + gn.map(r => li(esc(r.name) + (r.onA ? ' was forgotten on the other computer, so it’s removed here too' : ' stays forgotten'))).join('') + '</ul>');
  if (libm.notes.length) lines.push('<p><b>Classes, units and rosters</b></p><ul id="bringLib">' + libm.notes.map(n => li(noteLine(n))).join('') + '</ul>');
  const off = rows.filter(r => r.cardOff);
  if (off.length) lines.push('<p id="bringCardOff">The rubric saved with ' + off.map(r => '<b>' + esc(r.name) + '</b>').join(', ') + ' doesn’t match ' + (off.length === 1 ? 'its assignment card' : 'their assignment cards') + '. Bringing this in doesn’t settle that, so you’ll be asked which one to use when you open ' + (off.length === 1 ? 'it' : 'them') + '.</p>');
  const lsReal = Object.keys(lsSet).filter(k => k !== 'gs.rubricsGone' && /^gs\.(bank|setup|rubrics|school|rp\.|rd\.)/.test(k));
  if (lsReal.length) lines.push('<p><b>Also</b></p><ul>' + (lsSet['gs.bank'] ? li('Saved comments from the other computer are added to yours') : '') + (lsSet['gs.school'] ? li('School resources added or changed on the other computer') : '') + (lsReal.some(k => k !== 'gs.bank' && k !== 'gs.school') ? li('Rubrics or settings you don’t have here yet') : '') + '</ul>');
  // Things only ever being kept as they are here, or looks like a pen color, aren't reason to ask.
  const nothing = !nw.length && !gn.some(r => r.onA) && !libm.notes.length && !lsReal.length && !asks.length && !mg.some(r => r.extra || r.setIn.length || r.rows.some(x => x.pick === 'b'));
  const sameN = rows.filter(r => r.kind === 'same' || r.kind === 'onlyA').length;
  const need = rows.filter(r => r.kind === 'new').reduce((a, r) => a + ((B.papers && B.papers[r.id] && B.papers[r.id].size) || 0), 0);
  let room = '';
  try { const q = await navigator.storage.estimate(); if (need && q.quota - q.usage < need * 1.1) room = '<p class="tkerr" id="bringRoom">This browser may not have room: it needs about ' + fmtSize(need) + ' and has about ' + fmtSize(q.quota - q.usage) + '.</p>'; } catch {}
  openDlg('<div class="bh"><h2>Bring work in</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="bringBox"><p class="muted" style="margin-top:0;font-size:14px">' + esc(sub) + '</p>' +
    (again ? '<p id="bringAgain"><b>Work changed in another tab while this was open, so there’s something new to choose below. Nothing has been brought in yet.</b></p>' : '') +
    (nothing ? '<p id="bringNone">Nothing to bring in: what’s here already has everything in ' + label + '.</p>' + lines.join('') : lines.join('') +
      (sameN ? '<p class="muted" style="font-size:14px">' + sameN + (sameN === 1 ? ' download has' : ' downloads have') + ' nothing to bring in.</p>' : '') +
      (asks.length ? '<h3 style="margin:16px 0 6px">' + (asks.every(a => a.notBoth) ? 'These don’t match' : 'Changed in both places') + ': which one do you want?</h3>' + conflictsHtml(asks, label === 'this file' ? 'In the file' : 'In the backup') : '') +
      room + '<p class="muted" style="font-size:14px">A safety copy of how things are now is made first, so you can undo this under Saving and carrying.</p>') + '</div>' +
    '<div class="bf"><button class="btn" data-close>Cancel</button>' + (asks.length ? '<button class="btn" data-cfnew>Pick the newest for each</button>' : '') + (nothing ? '' : '<button class="btn primary" id="bringGo">Bring it in</button>') + '</div>');
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-cfnew]')) return conflictsNewest(asks, box);
    if (!e.target.closest('#bringGo')) return;
    const picked = conflictAnswers(asks, box);
    if (!picked) return toast('Please choose a version for each one first.');
    const answers = {};
    for (const a of asks) { if (a.gone) answers['!' + a.id] = picked['!' + a.id]; else (answers[a.id] ||= {})[a.key] = picked[a.id + '|' + a.key]; }
    box.querySelector('.bb').innerHTML = '<p style="margin-top:0" id="takeMsg">Bringing your work in…</p><progress id="takeBar" style="width:100%"></progress>';
    box.querySelector('.bf').innerHTML = '';
    try { await tabsFinish(); tabsOver('go'); const went = await bringApply(B, src, shown, answers); tabsOver('done'); if (!went) return bringPreview(B, src, label, sub, true); }
    catch (er) {
      console.error(er); closeDlg(); tabsOver('done');
      return sayDlg(er && er.small ? 'This browser’s small store for rosters and settings is full, and nothing more in it can safely go, so that didn’t finish. Your marks and scores here weren’t replaced.' : er && er.name === 'QuotaExceededError' ? 'This browser ran out of room, so that didn’t finish. Your marks and scores here weren’t replaced. Free up some disk space and try again.' : 'That didn’t finish. Your work is safe, and a safety copy was made first: Put back is under Saving and carrying if anything looks wrong.');
    }
    toast('Brought in. Reloading…');
    setTimeout(reloadHome, 700);
  };
}
// Other tabs have stopped by now, so this is the last word on what's here, and whatever they saved during the preview gets merged like the rest.
// Says false, having changed nothing, if that leaves a question she hasn't seen.
async function bringApply(B0, src, shown, answers) {
  if (batch) { commitEditors(); await saveNow(); }
  const { A, B, libm: open, lsSet, plan: openPlan, dev, now } = await bringPlan(B0);
  if ([...openPlan.asks, ...open.asks].some(a => !shown.has(askSig(a)))) return false;
  const libm = open.asks.length ? mergeLib(libHere(), B.lib, { dev, now, answers }) : open;   // she's answered about a card's rubric
  const plan = mergeStates(A, B, { answers, dev, now, linked: libLinked(libm.lib, libm.cards) });
  libFollow(libm, plan.rows, dev, now);
  batch = null;
  await gsData.snapshot('Before bringing work in', gsData.version());
  if (fld.state === 'ok' || fld.state === 'decide') { try { await folderSnapshot('Before bringing work in'); } catch (e) { console.error(e); } }
  let done = 0;
  const added = [];
  try {   // bytes first: if there's no room for them, her marks and scores haven't changed yet
    for (const r of plan.rows) {
      const b = $('#takeBar'); if (b) { b.max = plan.rows.length; b.value = done++; }
      if (r.kind === 'gone' || r.kind === 'askGone' || r.kind === 'onlyA' || (r.ma && r.ma.papers)) continue;
      const rec = await src.papers(r.id); if (!rec) continue;
      await paperPut(r.id, rec); added.push(r.id);
      r.meta = { ...r.meta, papers: true, size: rec.entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) }; r.ma = { ...(r.ma || {}), papers: true };
    }
    for (const r of plan.rows) {
      if (r.files) for (const k of r.files.fromB) { const rec = await src.added(r.id, k); if (rec) await idbDo('readwrite', o => o.put(rec, r.id + '|' + k)); }
      if (r.edits) for (const p of r.edits.fromB) { const rec = await src.edit(r.id, p); if (rec) await kdo('edits', 'readwrite', o => o.put(rec, r.id + '|' + p)); }
    }
    await schBring(src, B);
    // Rosters next, with no marks or scores changed yet. A score with no paper hangs on its roster, so if that doesn't fit she's told, and nothing goes on without it.
    if (libm.toA) { lib = migrateLib(libm.lib); if (!setLibFrom(lib)) throw browserFull(); }
    for (const [k, v] of Object.entries(lsSet)) if (!lsPut(k, v)) throw browserFull();
  } catch (e) {
    for (const id of added) await paperDrop(id).catch(() => {});
    throw e;
  }
  const none = { papers: async () => null, added: async () => null, edit: async () => null };
  for (const r of plan.rows) {
    if (r.kind !== 'gone' && r.kind !== 'askGone' && r.ma && r.ma.papers) r.meta = { ...r.meta, papers: true };
    if (r.files) r.files.fromB = []; if (r.edits) r.edits.fromB = [];
    await applyRow(r, none);
  }
  store.set('gs.tomb', plan.tomb);
  // Work from an older format updates itself on the reload, and every step is safe to run twice.
  const v = B.info && B.info.dataV;
  if (!v) store.del('gs.dataV'); else if (v < gsData.version()) store.set('gs.dataV', v);
  return true;
}

/* old backup ZIPs */
// They carry on restoring, through the same preview and merge, so a restore no longer overwrites newer work or replaces rosters.
async function restoreBackup(file) {
  let z, data;
  try { z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer())); data = JSON.parse(td.decode(z['backup.json'])); } catch { return toast('That isn’t a Grading Studio backup'); }
  if (!data || !data.info || data.info.app !== 'Grading Studio') return toast('That isn’t a Grading Studio backup');
  const unpack = v => {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.__bin === 'number') return z['bin/' + v.__bin] || new Uint8Array(0);
    if (Array.isArray(v)) return v.map(unpack);
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = unpack(x); return o; }
    return v;
  };
  if ((data.info.dataV || 0) > gsData.DATA_V) return sayDlg(TAKE_SAY.newer);
  const keep = data.keep || {}, recs = d => d ? unpack(d) : { k: [], v: [] }, B = { work: {}, meta: {}, tomb: {}, added: {}, edits: {}, ls: {}, lib: null, papers: {}, info: { dataV: (data.info.dataV) || (data.ls && data.ls['gs.dataV'] ? +data.ls['gs.dataV'] : 0) } };
  const papers = recs(keep.papers), metas = recs(keep.meta), works = recs(keep.work), edits = recs(keep.edits), added = recs(data.added);
  for (const [k, v] of Object.entries(data.ls || {})) {
    if (k.startsWith('gs.b.')) { try { B.work[k] = JSON.parse(v); } catch {} }
    else if (!LS_LOCAL.test(k)) B.ls[k] = v;
  }
  try { B.lib = JSON.parse(B.ls['gs.lib']); if (B.lib) migrateLib(B.lib); } catch {}
  works.k.forEach((k, i) => { B.work[k] = newestWork(B.work[k], works.v[i]); });
  metas.k.forEach((k, i) => { B.meta[k] = metas.v[i]; });
  const paperOf = new Map(), addOf = new Map(), editOf = new Map();
  papers.k.forEach((k, i) => { paperOf.set(k, papers.v[i]); B.papers[k] = { size: (papers.v[i].entries || []).reduce((a, e) => a + (e.data ? e.data.length : 0), 0) }; });
  added.k.forEach((k, i) => { const j = k.indexOf('|'), id = k.slice(0, j), lk = k.slice(j + 1); addOf.set(k, added.v[i]); (B.added[id] ||= {})[lk] = added.v[i].added || 0; });
  edits.k.forEach((k, i) => { const j = k.indexOf('|'), id = k.slice(0, j), p = k.slice(j + 1); editOf.set(k, edits.v[i]); (B.edits[id] ||= {})[p] = edits.v[i].t || 1; });
  const src = { papers: async id => paperOf.get(id) || null, added: async (id, k) => addOf.get(id + '|' + k) || null, edit: async (id, p) => editOf.get(id + '|' + p) || null };
  await bringPreview(B, src, 'this backup', 'An old backup from ' + new Date(data.info.t).toLocaleString() + ' with ' + (data.info.downloads || Object.keys(B.work).length) + ((data.info.downloads || 0) === 1 ? ' download' : ' downloads') + '. Its work is merged per student: anything newer here stays.');
}

/* Remove from this computer */
const LS_LOOKS = /^gs\.(theme|ink|hl|penW|disp|zoom|panels|rate|arrsize|spsize|sheetall|xall|xedit|rdOpen|calcpos|calchist|gcid|dataV)$/;
async function removeHere() {
  const last = store.get('gs.lastBackup', 0), list = [...keptMeta.values()], newer = list.filter(m => (m.t || 0) > last), linked = fld.state !== 'none';
  const folderLine = linked ? '\n\nYour linked folder “' + fld.name + '” isn’t touched: its files stay where they are, and this browser stops saving to it. To delete them, delete that folder yourself.' : '';
  const warn = !list.length ? '' : !last ? '\n\nYou haven’t made a take-home file from this browser, so anything done here may not be anywhere else.'
    : newer.length ? '\n\n' + newer.length + (newer.length === 1 ? ' download has' : ' downloads have') + ' changes since your last take-home file (' + whenOf(last) + '). Those changes aren’t in that file.' : '\n\nYour last take-home file was made ' + whenOf(last) + ', after your last change.';
  const typed = await askTextDlg('This removes all student work from this browser: ' + list.length + (list.length === 1 ? ' download' : ' downloads') + ' with their papers, marks, scores and comments, plus rosters, units, rubrics, late files, readings, Word edits, school resources and safety copies.' + warn + folderLine + '\n\nPlanner work isn’t touched. This can’t be undone.\n\nType REMOVE to go ahead.', '', { ok: 'Remove from this computer', cancel: 'Keep it', danger: true });
  if (typed == null) return;
  if (typed.trim().toUpperCase() !== 'REMOVE') return sayDlg('That didn’t say REMOVE, so nothing was removed.');
  await keepWait;   // papers still going in would land after the clearing
  tabsOver('go');   // no other tab writes from here on
  if (linked) await folderUnlink();
  batch = null;
  clearTimeout(saveT); saveBad.clear();
  try {
    for (const n of ['papers', 'work', 'meta', 'edits']) await kdo(n, 'readwrite', o => o.clear());
    await idbDo('readwrite', o => o.clear());
    await new Promise(res => { const r = indexedDB.deleteDatabase('grading-studio-safety'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    await schRemoveAll();
  } catch (e) { console.error(e); tabsOver('done'); return sayDlg('Not everything could be removed. Close any other Grading Studio tabs and try again.'); }
  for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && (k.startsWith('gsc.saved.') || k.startsWith('gsc.forgot.') || k.startsWith('gs.') && !LS_LOOKS.test(k))) localStorage.removeItem(k); }
  try { localStorage.removeItem('gsc.win'); } catch {}
  tabsOver('done');
  toast('Removed from this computer. Reloading…');
  setTimeout(reloadHome, 700);
}
$('#takeBtn').onclick = openTake;
$('#removeBtn').onclick = removeHere;
Object.assign(window.__gs, { saveLib, reloadKept: loadKept, applyRubricPage, folderTroubleTest: folderTrouble, bank: () => bank, takeWrite, takeOpen, takeScan, bringFile, openTake, removeHere, takeUse: h => { takeSinkFor = h; }, carryLs, localState });
