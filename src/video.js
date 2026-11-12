/* ---------------- work with no paper: a video by its link, the partners in it, and a page for notes ---------------- */
// For presentations, speeches and anything else that is watched rather than read.
// A link is kept as a tiny file on the student (a web shortcut, the kind Windows and a Mac make: "Name.url"), so it is saved, carried,
// merged, removed and given to partners exactly like any file. Nothing is fetched: the video stays where it is, and plays only when asked.
// The notes page is a PDF made here, so the pen, typed text, comments, the score and the export all work on it as on a paper.
const LINK_RX = /\.(url|webloc)$/i;
// A web address somebody typed or pasted: http or https only, or ''.
function linkClean(v) {
  v = String(v || '').trim().replace(/&amp;/g, '&'); if (!v || /\s/.test(v)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
// The address inside a shortcut file, or ''.
function linkOf(data) {
  if (!data || !data.length || data.length > 20000) return '';
  let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; }
  const m = /^\s*URL\s*=\s*(\S+)/mi.exec(s) || /<string>\s*([^<\s]+)\s*<\/string>/i.exec(s);
  return m ? linkClean(m[1]) : '';
}
const linkBytes = url => new TextEncoder().encode('[InternetShortcut]\r\nURL=' + url + '\r\n');
const linkHost = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
// How a link can play on the page: the player address the site itself gives for embedding, or the file itself. null: it opens in its own window only.
function linkPlayer(url) {
  let u; try { u = new URL(url); } catch { return null; }
  const h = u.hostname.replace(/^www\./, '').toLowerCase(), p = u.pathname, id = s => (/^[\w-]{6,}$/.test(s || '') ? s : '');
  let m;
  if (h === 'drive.google.com') { const k = id((m = /\/file\/d\/([^/]+)/.exec(p)) ? m[1] : u.searchParams.get('id')); return k ? { frame: 'https://drive.google.com/file/d/' + k + '/preview' } : null; }
  if (h === 'docs.google.com' && (m = /^\/presentation\/d\/([^/]+)/.exec(p)) && id(m[1])) return { frame: 'https://docs.google.com/presentation/d/' + m[1] + '/embed' };
  if (h === 'youtu.be') { const k = id(p.slice(1).split('/')[0]); return k ? { frame: 'https://www.youtube-nocookie.com/embed/' + k } : null; }
  if (h === 'youtube.com' || h === 'm.youtube.com') { const k = id((m = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(p)) ? m[1] : u.searchParams.get('v')); return k ? { frame: 'https://www.youtube-nocookie.com/embed/' + k } : null; }
  if (h === 'vimeo.com' && (m = /^\/(\d+)/.exec(p))) return { frame: 'https://player.vimeo.com/video/' + m[1] };
  if (h === 'loom.com' && (m = /^\/share\/([\w-]+)/.exec(p))) return { frame: 'https://www.loom.com/embed/' + m[1] };
  if (MEDIA_RX.test(p)) return VIDEO_RX.test(p) ? { video: url } : { audio: url };
  return null;
}
const linkTitle = f => f.name.replace(LINK_RX, '').replace(/ \(added \d+\)$/, '');

// The card above the paper. The player stays at the top while the notes page scrolls under it.
function linkCard(st, f) {
  const url = linkOf(f.data), play = linkPlayer(url);
  const el = document.createElement('div'); el.className = 'media vlink';
  el.innerHTML = '<div class="mstick"><div class="mhead"><b>' + esc(linkTitle(f)) + '</b><span class="muted">' + esc(linkHost(url)) + '</span></div><div class="vlslot" hidden></div>' +
    '<div class="mctl">' + (play ? '<button class="btn sm primary" data-vplay aria-pressed="false">▶ Play here</button>' : '') +
    '<button class="btn sm' + (play ? '' : ' primary') + '" data-vopen title="Opens the video in a window of its own, to keep beside this one">Open in its own window</button>' +
    '<button class="btn sm" data-vcopy>Copy link</button></div>' +
    '<p class="muted vlnote">' + (play ? 'Only the link is kept here; the video stays where it is. If it asks you to sign in or won’t play, open it in its own window.' : 'Only the link is kept here. This site can’t play inside the page, so it opens in a window of its own.') + '</p></div>';
  el.onclick = e => {
    if (e.target.closest('[data-vopen]')) { window.open(url, '_blank', 'noopener,noreferrer,popup,width=980,height=640'); return; }
    if (e.target.closest('[data-vcopy]')) { navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => toast('The link couldn’t be copied')); return; }
    const b = e.target.closest('[data-vplay]'); if (!b) return;
    const slot = el.querySelector('.vlslot'), on = slot.hidden;
    slot.hidden = !on; b.setAttribute('aria-pressed', on); b.textContent = on ? 'Close the player' : '▶ Play here';
    if (!on) { slot.innerHTML = ''; return; }
    fill();
  };
  // c: a clip to start at, or nothing for the whole video
  const fill = c => {
    const slot = el.querySelector('.vlslot'), b = el.querySelector('[data-vplay]');
    slot.hidden = false; slot.innerHTML = ''; b.setAttribute('aria-pressed', 'true'); b.textContent = 'Close the player';
    if (play.frame) slot.appendChild(playerFrame(c ? clipFrame(play.frame, c).src : play.frame, linkTitle(f)));
    else { const m = document.createElement(play.video ? 'video' : 'audio'); m.controls = true; m.preload = 'metadata'; m.src = play.video || play.audio; slot.appendChild(m); if (c) clipRun(m, c); }
  };
  clipStrip(el.querySelector('.mstick'), f, () => el.querySelector('.vlslot video, .vlslot audio'), c => (play ? fill(c) : clipShow(c.id)));
  return el;
}

/* ---------- the notes page ---------- */
const NP_W = 595.28, NP_H = 841.89, NP_M = 48, NP_TAIL = '%GradingStudio-notes';
const NP_KINDS = [['lined', 'Lined', 'Ruled lines, with a margin for the time'], ['rubric', 'Rubric rows', 'A box for each row of the rubric'], ['cols', 'Two columns', 'Went well, and to work on'], ['blank', 'Blank', 'Only the title']];
const isNotes = d => !!d && d.length > 64 && new TextDecoder('latin1').decode(d.subarray(d.length - 64)).includes(NP_TAIL);
const notesFileOf = st => st.files.find(f => f.kind === 'pdf' && !f.virtual && isNotes(f.data)) || null;
let npLast = 'lined';
// kind: one of NP_KINDS. title: printed at the top. rows: the rubric's row names, for 'rubric'.
async function notesPdf(kind, title, rows) {
  const { rgb } = PDFLib, doc = await PDFLib.PDFDocument.create();
  title = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Notes';
  doc.setTitle(title);   // no Creator: 'Grading Studio' there means a flattened export (imported.js)
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const can = new Set(font.getCharacterSet()), ink = rgb(0.1, 0.1, 0.12), gray = rgb(0.42, 0.45, 0.5), rule = rgb(0.8, 0.84, 0.9), edge = rgb(0.66, 0.71, 0.79);
  // A label: real text where the PDF's own font can write it, else a small picture of it drawn by the browser (any alphabet).
  const label = async (page, text, x, y, size, o) => {
    o = o || {}; const f = o.bold ? bold : font, col = o.gray ? gray : ink;
    if ([...text].every(ch => can.has(ch.codePointAt(0)))) {
      let t = text; if (o.max) while (t.length > 1 && f.widthOfTextAtSize(t, size) > o.max) t = t.slice(0, -2).trimEnd() + '…';
      const w = f.widthOfTextAtSize(t, size); page.drawText(t, { x: o.right ? x - w : x, y, size, font: f, color: col }); return;
    }
    const S = 3, c = document.createElement('canvas'), g = c.getContext('2d'), face = (o.bold ? 700 : 400) + ' ' + size * S + 'px "Inter", system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Thai", Tahoma, sans-serif';
    g.font = face; const w = Math.min(g.measureText(text).width / S, o.max || 1e4);
    c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.ceil(size * 1.6 * S);
    const g2 = c.getContext('2d'); g2.font = face; g2.fillStyle = o.gray ? '#6B7280' : '#1a1a1f'; g2.textBaseline = 'alphabetic'; g2.fillText(text, 0, size * 1.2 * S);
    const png = await new Promise(r => c.toBlob(r, 'image/png')), img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    page.drawImage(img, { x: o.right ? x - w : x, y: y - size * 0.4, width: w, height: size * 1.6 });
  };
  const line = (page, x1, y1, x2, y2, col, t) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t || 0.7, color: col || rule });
  const R = NP_W - NP_M, top = NP_H - NP_M;
  const start = async () => {
    const page = doc.addPage([NP_W, NP_H]);
    await label(page, title, NP_M, top - 14, 15, { bold: true, max: R - NP_M - 70 });
    await label(page, tr('Notes'), R, top - 13, 9, { gray: true, right: true });
    line(page, NP_M, top - 24, R, top - 24, edge, 0.9);
    return page;
  };
  const ruled = (page, x1, x2, from, to, step) => { for (let y = from; y >= to; y -= step) line(page, x1, y, x2, y); };
  if (kind === 'rubric' && rows && rows.length) {
    const all = rows.map(r => String(r || '').trim() || tr('Row')).concat(rows.length % 5 !== 0 ? [tr('Other notes')] : []);
    for (let i = 0; i < all.length; i += 5) {
      const page = await start(), part = all.slice(i, i + 5), gap = 10, y0 = top - 38, h = Math.min(190, (y0 - NP_M - gap * (part.length - 1)) / part.length);
      for (const [k, name] of part.entries()) {
        const t = y0 - k * (h + gap);
        page.drawRectangle({ x: NP_M, y: t - h, width: R - NP_M, height: h, borderColor: edge, borderWidth: 0.8 });
        await label(page, name, NP_M + 10, t - 17, 10.5, { bold: true, max: R - NP_M - 20 });
        ruled(page, NP_M + 10, R - 10, t - 46, t - h + 12, 24);
      }
    }
  } else if (kind === 'cols') {
    const page = await start(), mid = NP_W / 2;
    await label(page, tr('Went well'), NP_M, top - 44, 10.5, { bold: true });
    await label(page, tr('To work on'), mid + 12, top - 44, 10.5, { bold: true });
    line(page, mid, top - 30, mid, NP_M, edge, 0.8);
    ruled(page, NP_M, mid - 12, top - 78, NP_M, 26); ruled(page, mid + 12, R, top - 78, NP_M, 26);
  } else if (kind === 'blank') {
    await start();
  } else {
    const page = await start(), mx = NP_M + 52;
    await label(page, tr('Time'), NP_M, top - 40, 8, { gray: true });
    line(page, mx, top - 30, mx, NP_M, edge, 0.8);
    ruled(page, NP_M, R, top - 72, NP_M, 26);
  }
  const bytes = await doc.save(), tail = new TextEncoder().encode('\n' + NP_TAIL + ' ' + uid().slice(0, 8).padEnd(8, '0') + '\n'), out = new Uint8Array(bytes.length + tail.length);
  out.set(bytes); out.set(tail, bytes.length); return out;
}
// The little pictures to choose from. rows: the rubric's rows, or none (then Rubric rows can't be picked).
const NP_ART = {
  lined: '<path d="M6 12h36M6 19h36M6 26h36M6 33h36M6 40h36M6 47h36" /><path d="M14 9v43" class="e"/>',
  rubric: '<rect x="6" y="10" width="36" height="12" rx="1.5" class="e"/><rect x="6" y="25" width="36" height="12" rx="1.5" class="e"/><rect x="6" y="40" width="36" height="12" rx="1.5" class="e"/><path d="M9 14h12M9 29h12M9 44h12" class="k"/>',
  cols: '<path d="M24 9v43" class="e"/><path d="M6 12h10M28 12h10" class="k"/><path d="M6 19h14M6 26h14M6 33h14M6 40h14M6 47h14M28 19h14M28 26h14M28 33h14M28 40h14M28 47h14"/>',
  blank: '',
};
function npTiles(sel, rows, none) {
  return '<div class="nptiles" role="group" aria-label="Notes page">' + (none ? '<button class="nptile" data-np="" aria-pressed="' + (!sel) + '"><svg viewBox="0 0 48 60" aria-hidden="true" class="none"><path d="M12 18l24 24M36 18L12 42" class="e"/></svg><b>None</b></button>' : '') +
    NP_KINDS.map(([k, name, about]) => { const off = k === 'rubric' && !(rows && rows.length);
      return '<button class="nptile" data-np="' + k + '" aria-pressed="' + (sel === k) + '"' + (off ? ' disabled title="This assignment has no rubric rows"' : ' title="' + esc(about) + '"') + '><svg viewBox="0 0 48 60" aria-hidden="true"><rect x="1" y="1" width="46" height="58" rx="3" class="pg"/><path d="M6 6h16" class="k"/>' + NP_ART[k] + '</svg><b>' + name + '</b></button>'; }).join('') + '</div>';
}
const npPick = (box, k) => { for (const b of box.querySelectorAll('.nptile')) b.setAttribute('aria-pressed', b.dataset.np === k); };
const npRows = su => (su && su.mode === 'rubric' && Array.isArray(su.criteria) ? su.criteria : []);
const npFileName = s => (String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Notes');

// Adds files to a student and says which ones they became (a name already taken gets a number).
async function addAndFind(st, list) {
  const had = new Set(st.files);
  await addFiles(st, list, true);
  return st.files.filter(f => !had.has(f));
}
const copyFor = (st, f) => ({ path: f.name, file: new File([f.data], f.name), from: st.key });
// A partner's own copy of one of st's files: the one they have, or a new one.
async function partnerCopy(st, f, to) {
  if (f.kind === 'link') { const have = to.files.find(x => x.kind === 'link' && linkOf(x.data) === linkOf(f.data)); if (have) return have; }
  const have = to.files.find(x => x.from === st.key && x.name === f.name); if (have) return have;
  return (await addAndFind(to, [copyFor(st, f)]))[0] || null;
}
// The paper a group's marks are made on, for st: the group's own if it has one, else st's notes page, else the file given.
async function partnersJoin(st, anchor, list, extra) {
  const g0 = groupOf(st), shared = g0 && groupFileOf(g0, st);
  if (shared) anchor = shared;
  for (const to of list) {
    for (const f of extra) if (f !== anchor) await partnerCopy(st, f, to);
    if (groupMates(st).includes(to)) continue;
    let theirs = null;
    if (anchor && anchor.kind !== 'media') theirs = (isNotes(anchor.data) && !anchor.added && notesFileOf(to)) || await partnerCopy(st, anchor, to);
    groupAdd(st, anchor, to, theirs);
  }
}

// The list of students to tick, as in Group work…
function partnerList(st, picked, locked) {
  const anon = anonOn(), others = batch.students.map((s, i) => ({ s, i, label: shownName(s, i) })).filter(x => x.s !== st);
  if (anon) others.sort((a, b) => anonPos(a.i) - anonPos(b.i));
  const draw = () => {
    const q = $('#vdFind').value.toLowerCase().split(/\s+/).filter(Boolean);
    const list = others.filter(x => q.every(w => x.label.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))));
    $('#vdList').innerHTML = list.length ? list.map(x => { const lock = locked.has(x.s), on = lock || picked.has(x.s);
      return '<button class="mvrow vdrow" role="checkbox" aria-checked="' + on + '" data-vdto="' + x.i + '"' + (lock ? ' disabled' : '') + '><span><i aria-hidden="true"></i>' + esc(x.label) + '</span><span class="muted">' + (lock ? 'In the group' : on ? 'Partner' : '') + '</span></button>'; }).join('') : '<p class="muted">No name matches.</p>';
  };
  return { draw, html: '<input class="btn" id="vdFind" placeholder="' + (anon ? 'Type a paper number' : 'Type a name') + '" autocomplete="off" style="width:100%;margin-bottom:8px"><div id="vdList" class="mvlist vdlist"></div>' };
}

/* ---------- Add: A video… ---------- */
const VIDEO_BIG = 120e6;   // about what this browser can keep of one added file
function openAddVideo(st) {
  if (!st) return;
  const who = shownName(st, batch.students.indexOf(st)), rows = npRows(setup), picked = new Set(), locked = new Set(groupMates(st));
  let np = notesFileOf(st) ? '' : (npLast === 'rubric' && !rows.length ? 'lined' : npLast), file = null;
  const pl = partnerList(st, picked, locked);
  openDlg('<div class="bh"><h2>Video for ' + esc(who) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb vdbox"><label class="vdlab" for="vdLink">Link to the video</label><input class="btn" id="vdLink" placeholder="Paste the link: Google Drive, YouTube or anywhere else" autocomplete="off" spellcheck="false">' +
    '<p class="muted vdsay" id="vdSay">Only the link is kept here, so the video stays where it is and nothing slows down. <button class="link" id="vdFile">Use a video file on this computer instead…</button></p>' +
    '<label class="vdlab" for="vdName">Name it</label><input class="btn" id="vdName" value="Presentation video" autocomplete="off">' +
    '<div class="vdlab">Notes page<small>A page to write on while you watch. It is marked, scored and returned like a paper.</small></div>' + npTiles(np, rows, true) +
    '<div class="vdlab">Partners<small>Tick everyone else in the video. They get the link and the notes page, and one set of marks and one grade covers the group.</small></div>' + pl.html + '</div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="vdAdd" disabled>Add to ' + esc(who) + '</button></div>');
  const link = $('#vdLink'), add = $('#vdAdd'), say = $('#vdSay'), say0 = say.innerHTML;
  const ready = () => {
    const v = link.value.trim(), ok = file ? true : !!linkClean(v);
    add.disabled = !ok; link.classList.toggle('bad', !!v && !ok && !file);
    add.textContent = 'Add to ' + who + (picked.size ? ' and ' + picked.size + (picked.size === 1 ? ' partner' : ' partners') : '');
  };
  pl.draw(); link.oninput = ready; $('#vdFind').oninput = pl.draw;
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const t = e.target.closest('.nptile'); if (t && !t.disabled) { np = t.dataset.np; npPick($('#dlgBox'), np); return; }
    const row = e.target.closest('[data-vdto]'); if (row && !row.disabled) { const s = batch.students[+row.dataset.vdto]; if (picked.has(s)) picked.delete(s); else picked.add(s); pl.draw(); ready(); return; }
    if (e.target.closest('#vdFile')) {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,audio/*';
      inp.onchange = () => { file = inp.files[0] || null; if (!file) return; link.value = ''; link.disabled = true; link.placeholder = file.name;
        say.innerHTML = '<b>' + esc(file.name) + '</b> (' + Math.max(1, Math.round(file.size / 1e6)) + ' MB) will be kept in this browser, on ' + esc(who) + '’s paper. Short clips only: for anything long, a link is better. Partners share the notes page and the grade. <button class="link" id="vdUnfile">Use a link instead</button>'; ready(); };
      inp.click(); return;
    }
    if (e.target.closest('#vdUnfile')) { file = null; link.disabled = false; link.placeholder = 'Paste the link: Google Drive, YouTube or anywhere else'; say.innerHTML = say0; ready(); link.focus(); return; }
    if (e.target !== add || add.disabled) return;
    const url = file ? '' : linkClean(link.value), name = npFileName($('#vdName').value || 'Presentation video'), partners = [...picked], kind = np;
    if (file && file.size > VIDEO_BIG && !await askDlg('This video is ' + Math.round(file.size / 1e6) + ' MB. A file that big usually can’t be kept in this browser, so it may be gone the next time you open this assignment.\n\nA link to the video works at any size.', { ok: 'Add the file anyway', cancel: 'Go back' })) return;
    add.disabled = true; add.textContent = 'Adding…';
    closeDlg();
    try { await videoAdd(st, { url, file, name, kind, partners }); } catch (err) { console.error(err); toast('That couldn’t be added: ' + ((err && err.message) || err)); }
  };
  link.focus();
}
// o: { url | file, name, kind: a notes page or '', partners: [students] }
async function videoAdd(st, o) {
  const list = [];
  if (o.file) list.push({ path: o.file.name, file: o.file });
  else list.push({ path: o.name + '.url', file: new File([linkBytes(o.url)], o.name + '.url') });
  if (o.kind) { npLast = o.kind; const n = npFileName(o.name.replace(/\s*video$/i, '') + ' notes') + '.pdf'; list.push({ path: n, file: new File([await notesPdf(o.kind, batch.name, npRows(setup))], n, { type: 'application/pdf' }) }); }
  const made = await addAndFind(st, list), vid = made.find(f => f.kind === 'link' || f.kind === 'media') || made[0], page = made.find(f => f.kind === 'pdf') || notesFileOf(st);
  const all = [...new Set([...groupMates(st), ...(o.partners || [])])];
  if (all.length) await partnersJoin(st, page || vid, all, made.filter(f => f.kind !== 'media'));
  saveSoon(); renderList();
  toast('Added the video to ' + groupNames([st, ...all]));
  await openStudent(batch.students.indexOf(st), vid && vid.path);
  return made;
}

/* ---------- Add: A notes page… ---------- */
function openAddNotes(st) {
  if (!st) return;
  const who = shownName(st, batch.students.indexOf(st)), rows = npRows(setup), mates = groupMates(st), g = groupOf(st), share = mates.length && !(g && groupFileOf(g, st));
  let np = npLast === 'rubric' && !rows.length ? 'lined' : npLast;
  openDlg('<div class="bh"><h2>Notes page for ' + esc(who) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb vdbox"><p class="muted" style="margin:0 0 4px;font-size:14px">A page to write on while you watch or listen: a presentation, a speech, a performance. Write with the pen or type on it, then score and return it like a paper.' + (share ? ' ' + esc(groupNames(mates)) + (mates.length > 1 ? ' get' : ' gets') + ' it too, with the same marks.' : '') + '</p>' +
    npTiles(np, rows, false) + '<label class="vdlab" for="npName">Name it</label><input class="btn" id="npName" value="Notes" autocomplete="off"></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="npAdd">Add to ' + esc(who) + '</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const t = e.target.closest('.nptile'); if (t && !t.disabled) { np = t.dataset.np; npPick($('#dlgBox'), np); return; }
    if (e.target.id !== 'npAdd') return;
    const name = npFileName($('#npName').value) + '.pdf';
    closeDlg(); npLast = np;
    try {
      const made = await addAndFind(st, [{ path: name, file: new File([await notesPdf(np, batch.name, rows)], name, { type: 'application/pdf' }) }]);
      if (share && made[0]) await partnersJoin(st, made[0], mates.slice(), []);
      if (share && made[0]) { const gg = groupOf(st); if (gg) { gg.p[st.key] = made[0].path; for (const m of mates) { const c = m.files.find(x => x.from === st.key && x.name === made[0].name); if (c) gg.p[m.key] = c.path; } groupSync(); } }
      saveSoon(); renderList(); toast('Added a notes page to ' + groupNames(share ? [st, ...mates] : [st]));
      await openStudent(batch.students.indexOf(st), made[0] && made[0].path);
    } catch (err) { console.error(err); toast('That page couldn’t be added: ' + ((err && err.message) || err)); }
  };
}

/* ---------- an assignment with no papers at all: a notes page for everyone on the roster ---------- */
function openStartNotes(it) {
  const f = findItem(it.id), c = f && f.c !== lib.loose ? f.c : null, names = c ? c.names.filter(n => String(n).trim()) : [];
  if (!names.length) return sayDlg('This needs the class’s roster, so there is a page for each student. Add the students to the class first, then come back to this assignment.');
  const rows = npRows(it.setup);
  let np = npLast === 'rubric' && !rows.length ? 'lined' : npLast;
  openDlg('<div class="bh"><h2>“' + esc(it.name) + '” with no papers</h2></div>' +
    '<div class="bb vdbox"><p style="margin:0 0 4px">For presentations, speeches, performances and videos. Each of the ' + names.length + ' students in ' + esc(c.name) + ' gets a notes page to write on while you watch. Mark it, score it and return it like a paper.</p>' +
    '<p class="muted" style="margin:0 0 4px;font-size:14px">Once it is open, <b>+ Add</b> on a student’s page takes a link to their video, and that is where you say who their partners are.</p>' + npTiles(np, rows, false) +
    (rows.length ? '' : '<p class="muted" style="margin:8px 0 0;font-size:13px">Rubric rows can be picked once this assignment has a rubric.</p>') + '</div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="snGo">Make the pages and open</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const t = e.target.closest('.nptile'); if (t && !t.disabled) { np = t.dataset.np; npPick($('#dlgBox'), np); return; }
    if (e.target.id !== 'snGo') return;
    e.target.disabled = true; npLast = np;
    try {
      const bytes = await notesPdf(np, it.name, rows), folder = n => String(n).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').trim();
      const make = k => names.map(n => ({ path: folder(n) + '/' + npFileName(it.name) + ' notes' + (k > 1 ? ' (' + k + ')' : '') + '.pdf', data: bytes.slice() }));
      // a download is known by its names and sizes: a second one of the same name in the same class is given a name of its own, so it starts empty
      let k = 1, list = make(k);
      while (k < 50 && (store.get(batchIdOf(list), null) || keptMeta.has(batchIdOf(list)))) list = make(++k);
      closeDlg();
      await intake(list, it.name, it);
    } catch (err) { console.error(err); closeDlg(); toast('The pages couldn’t be made: ' + ((err && err.message) || err)); }
  };
}
Object.assign(window.__gs, { linkOf, linkClean, linkPlayer, notesPdf, isNotes, videoAdd, openAddVideo, openAddNotes, openStartNotes });

/* ---------------- clips: a part of a video worth showing the class ---------------- */
// batch.clips: [{ id, u: the link | p: the path of a video file, a: where it starts (seconds), b: where it ends (or none), t: what it shows }]
// A clip is only two times and a label, saved with the assignment's work. Nothing is cut or copied: playing it starts the video there.
// A clip on a link belongs to the link, so partners with the same link see the same clips.
// Shown to the class, the screen has the label and the video and never a student's name.
function clipSecs(v) {
  v = String(v == null ? '' : v).trim(); if (!v) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(v)) return NaN;
  return v.split(':').reduce((n, x) => n * 60 + parseFloat(x), 0);
}
const clipSpan = c => fmtTime(c.a) + (c.b != null ? '–' + fmtTime(c.b) : '');
const clipsOf = f => (batch.clips || []).filter(c => (f.kind === 'link' ? c.u && c.u === linkOf(f.data) : c.p === f.path));
function clipFile(c) {
  for (const st of batch.students) for (const f of st.files) if (c.u ? f.kind === 'link' && linkOf(f.data) === c.u : f.path === c.p) return f;
  return null;
}
// A site's player started at the clip. stops: the player itself stops at the end.
function clipFrame(src, c) {
  const a = Math.floor(c.a), b = c.b != null ? Math.ceil(c.b) : null;
  if (/youtube-nocookie\.com\/embed\//.test(src)) return { src: src + '?start=' + a + (b != null ? '&end=' + b : '') + '&autoplay=1', stops: b != null };
  if (/player\.vimeo\.com\//.test(src)) return { src: src + '#t=' + a + 's', stops: false };
  if (/drive\.google\.com\/file\//.test(src) || /loom\.com\/embed\//.test(src)) return { src: src + '?t=' + a, stops: false };
  return { src, stops: false };
}
// Plays a video or sound from the clip's start and stops it at its end.
function clipRun(m, c) {
  const go = () => { try { m.currentTime = c.a; } catch {} m.play().catch(() => {}); };
  if (m.readyState >= 1) go(); else m.addEventListener('loadedmetadata', go, { once: true });
  m.onclipstop && m.removeEventListener('timeupdate', m.onclipstop);
  if (c.b != null) { m.onclipstop = () => { if (m.currentTime >= c.b) { m.pause(); m.removeEventListener('timeupdate', m.onclipstop); m.onclipstop = null; } }; m.addEventListener('timeupdate', m.onclipstop); }
}
// A frame for a site's player, the same wherever one is made.
function playerFrame(src, title) {
  const fr = document.createElement('iframe');
  fr.title = title; fr.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture'; fr.allowFullscreen = true;
  fr.referrerPolicy = 'strict-origin-when-cross-origin'; fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation');
  fr.src = src; return fr;
}
const clipsBtn = () => { const b = $('#clipsBtn'); if (b) b.hidden = !(batch && batch.clips && batch.clips.length); };
// The row of clips under a player. media(): the video or sound on the card, when the page plays it itself. play(c): plays a clip on the card.
function clipStrip(host, f, media, play) {
  const box = document.createElement('div'); box.className = 'clips'; host.appendChild(box);
  let form = false, edit = null;   // edit: the clip whose title and times are being changed
  const draw = () => {
    const list = clipsOf(f), own = !!media();
    box.innerHTML = '<div class="cliprow">' + list.map(c => '<span class="clip"><button data-clipplay="' + c.id + '" title="Play this part">▶ ' + esc(c.t) + ' <small>' + clipSpan(c) + '</small></button>' +
      '<button data-clipshow="' + c.id + '" title="Full screen, with the label and without the student’s name">Show to the class</button><button data-clipedit="' + c.id + '" title="Change this clip’s title or its times">Edit</button><button data-clipdel="' + c.id + '" aria-label="Delete the clip ' + esc(c.t) + '" title="Delete this clip">×</button></span>').join('') +
      (form ? '' : '<button class="btn sm" data-clipnew title="Save a part of this video to show the class later">+ Clip</button>') + '</div>' +
      (form ? '<div class="clipform"><label>From <input class="btn sm" data-ca placeholder="0:00" inputmode="numeric" autocomplete="off" aria-label="Where the clip starts"></label>' + (own ? '<button class="link" data-cnow="a">now</button>' : '') +
        '<label>to <input class="btn sm" data-cb placeholder="end" inputmode="numeric" autocomplete="off" aria-label="Where the clip ends"></label>' + (own ? '<button class="link" data-cnow="b">now</button>' : '') +
        '<input class="btn sm clipname" data-ct placeholder="What it shows, like Strong opening" maxlength="80" autocomplete="off" aria-label="What the clip shows">' +
        '<button class="btn sm primary" data-clipsave>' + (edit ? 'Save changes' : 'Save clip') + '</button><button class="btn sm" data-clipcancel>Cancel</button>' +
        '<small class="muted">' + (own ? 'Press now at the start and at the end, or type the times.' : 'Type the times from the player, like 2:15.') + ' Nothing is cut: a clip is the two times and its label.</small></div>' : '');
  };
  draw();
  box.onclick = e => {
    e.stopPropagation();
    const q = s => box.querySelector(s), by = id => (batch.clips || []).find(c => c.id === id);
    if (e.target.closest('[data-clipnew]')) { form = true; edit = null; draw(); const m = media(); if (m && m.currentTime > 0) q('[data-ca]').value = fmtTime(m.currentTime); q(m && m.currentTime > 0 ? '[data-ct]' : '[data-ca]').focus(); return; }
    if (e.target.closest('[data-clipcancel]')) { form = false; edit = null; draw(); return; }
    const ed = e.target.closest('[data-clipedit]');
    if (ed) { const c = by(ed.dataset.clipedit); if (!c) return; form = true; edit = c; draw(); q('[data-ca]').value = fmtTime(c.a); q('[data-cb]').value = c.b != null ? fmtTime(c.b) : ''; const t = q('[data-ct]'); t.value = c.t; t.focus(); t.select(); return; }
    const now = e.target.closest('[data-cnow]'); if (now) { const m = media(); if (m) q('[data-c' + now.dataset.cnow + ']').value = fmtTime(m.currentTime); return; }
    if (e.target.closest('[data-clipsave]')) {
      const a = clipSecs(q('[data-ca]').value), b = clipSecs(q('[data-cb]').value);
      if (a == null || isNaN(a)) { q('[data-ca]').focus(); return toast('Type where the clip starts, like 2:15'); }
      if (isNaN(b) || (b != null && b <= a)) { q('[data-cb]').focus(); return toast('The end has to be after the start'); }
      if (edit) { edit.a = a; if (b != null) edit.b = b; else delete edit.b; edit.t = q('[data-ct]').value.trim().slice(0, 80) || edit.t; form = false; edit = null; saveSoon(); draw(); return; }
      const n = (batch.clips ||= []).length + 1;
      batch.clips.push({ id: uid(), ...(f.kind === 'link' ? { u: linkOf(f.data) } : { p: f.path }), a, ...(b != null ? { b } : {}), t: q('[data-ct]').value.trim().slice(0, 80) || 'Clip ' + n });
      form = false; saveSoon(); clipsBtn(); draw(); return;
    }
    const d = e.target.closest('[data-clipdel]');
    if (d) { const c = by(d.dataset.clipdel), at = batch.clips.indexOf(c); if (!c) return; batch.clips.splice(at, 1); saveSoon(); clipsBtn(); draw();
      toastDo('Deleted the clip “' + c.t + '”', 'Undo', () => { batch.clips.splice(Math.min(at, batch.clips.length), 0, c); saveSoon(); clipsBtn(); if (box.isConnected) draw(); }); return; }
    const p = e.target.closest('[data-clipplay]'); if (p) { const c = by(p.dataset.clipplay); if (c) play(c); return; }
    const s = e.target.closest('[data-clipshow]'); if (s) clipShow(s.dataset.clipshow);
  };
  box.onkeydown = e => { if (e.key === 'Enter' && e.target.closest('.clipform input')) { e.preventDefault(); box.querySelector('[data-clipsave]').click(); } e.stopPropagation(); };
}

/* ---------- a clip on the screen the class sees ---------- */
let clipStage = null;
function clipShow(id) {
  const list = () => (batch.clips || []).filter(c => clipFile(c));
  let at = Math.max(0, list().findIndex(c => c.id === id));
  clipClose();
  const el = document.createElement('div'); el.id = 'clipStage'; el.className = 'pk clipstage'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'A clip, shown to the class');
  document.body.appendChild(el);
  const draw = () => {
    const all = list(), c = all[at]; if (!c) return clipClose();
    const f = clipFile(c), url = f.kind === 'link' ? linkOf(f.data) : '', pl = url ? linkPlayer(url) : { [VIDEO_RX.test(f.name) ? 'video' : 'audio']: mediaUrl(f) };
    const fr = pl && pl.frame ? clipFrame(pl.frame, c) : null;
    el.innerHTML = '<div class="clipbar"><b>' + esc(c.t) + '</b><span>' + (c.b != null ? fmtTime(c.a) + ' to ' + fmtTime(c.b) : 'from ' + fmtTime(c.a)) + (fr && !fr.stops && c.b != null ? ' · stop it at ' + fmtTime(c.b) : '') + '</span><span class="sp"></span>' +
      (all.length > 1 ? '<button data-cs="prev" aria-label="The clip before"' + (at ? '' : ' disabled') + '>‹</button><span>' + (at + 1) + ' of ' + all.length + '</span><button data-cs="next" aria-label="The next clip"' + (at < all.length - 1 ? '' : ' disabled') + '>›</button>' : '') +
      '<button data-cs="again">Play again</button><button data-cs="full">Full screen</button><button data-cs="close">Close <kbd>Esc</kbd></button></div><div class="clipmain"></div>';
    const main = el.querySelector('.clipmain');
    if (!pl) { main.innerHTML = '<p>This site can’t play inside the page. Close this and use Open in its own window.</p>'; return; }
    if (fr) main.appendChild(playerFrame(fr.src, c.t));
    else { const m = document.createElement(pl.video ? 'video' : 'audio'); m.controls = true; m.playsInline = true; m.src = pl.video || pl.audio; main.appendChild(m); clipRun(m, c); }
  };
  const key = e => {
    if (e.key === 'Escape') clipClose(); else if (e.key === 'ArrowRight' && at < list().length - 1) { at++; draw(); } else if (e.key === 'ArrowLeft' && at > 0) { at--; draw(); } else if (e.target.closest && e.target.closest('#clipStage')) { e.stopPropagation(); return; } else return;
    e.preventDefault(); e.stopPropagation();
  };
  el.onclick = e => {
    const b = e.target.closest('[data-cs]'); if (!b) return;
    const k = b.dataset.cs;
    if (k === 'close') return clipClose();
    if (k === 'full') { try { if (document.fullscreenElement) document.exitFullscreen(); else { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } } catch {} return; }
    if (k === 'prev') at--; if (k === 'next') at++;
    draw();
  };
  document.addEventListener('keydown', key, true);
  clipStage = { el, key };
  draw(); el.focus();
}
function clipClose() {
  if (!clipStage) return;
  document.removeEventListener('keydown', clipStage.key, true);
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
  clipStage.el.remove(); clipStage = null;
}
Object.assign(window.__gs, { clipSecs, clipFrame, clipShow, clipClose, clipsOf });
