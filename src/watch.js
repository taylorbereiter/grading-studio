/* ---------------- strengths and concerns per student: the watch list, whose work an example is, and sending them to the teacher's own assistant (11/16) ---------------- */
// A screenshot can go on the watch list (a misconception, a concern) the way one is saved as a strong example: the same Save box, the same black boxes,
// the same database (examples.js), with watch: 1 on the record. Both kinds carry who: { c, n }, the class and the roster name, so they stay with the
// student after the download is forgotten. Only the teacher sees who: on the student card, on the Examples page and in the Save box.
// Sending to her assistant makes one PDF on this computer, with each student as a random code (S-XXXX) and names in her notes as [name].
// The key (which code is which student) is kept in this browser only, in gs.wlCodes. Nothing goes anywhere until she takes the file there herself.

const wlKey = (c, n) => c + '\n' + n;
// Every saved picture from one student, oldest first. A student renamed on the roster keeps the old name as another spelling (people.js).
function wlOf(cid, name) {
  const other = new Set((infoOf(classById(cid), name).other || []).concat(name));
  return exList.concat(exWatch).filter(r => r.who && r.who.c === cid && other.has(r.who.n)).sort((a, b) => a.t - b.t);
}
// The student is still on that class's roster, so their card can open.
const wlHere = r => { const c = r.who && classById(r.who.c); return !!c && (c.names || []).includes(r.who.n); };
const wlDay = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
// After a save, an edit or a delete: the student card and the Examples page show it.
function wlChanged() {
  if (pcOpen && $('#pcWl')) wlCardFill();
  if (!batch && exPageF.view && routeNow().v === 'examples') exPageRender();
}
function wlRedraw() { exRefreshViews(); wlChanged(); }

// Examples saved before 1.28.30 know only the folder: tie them to the roster student when that download is open.
const wlTied = new Set();
function wlBackfill() {
  if (!batch || wlTied.has(batch.id)) return;
  const id = batch.id;
  wlTied.add(id);
  setTimeout(async () => {
    try { await exReady; } catch {}
    for (const r of exList.concat(exWatch).filter(r => batch && r.work === batch.id && r.from && !r.who)) {
      const st = batch.students.find(s => s.key === r.from.key), who = st && exWho(st);
      if (who) try { await exPut({ ...r, who }); } catch (e) { console.error(e); }
    }
  }, 0);
}

/* the student card: a timeline of what was saved from their work */
let wlCardF = '';
function wlCardFill() {
  const el = $('#pcWl'); if (!el || !pcOpen || !pcOpen.name) return;
  const { cid, name } = pcOpen, all = wlOf(cid, name), good = all.filter(r => !r.watch), bad = all.filter(r => r.watch);
  const list = (wlCardF === 'watch' ? bad : wlCardF === 'good' ? good : all).slice().reverse();
  const tags = {}; for (const r of bad) for (const t of exTags(r)) tags[t] = (tags[t] || 0) + 1;
  const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $('#pcard .pc').classList.toggle('pc-w', all.length > 0);
  if (!all.length) { el.innerHTML = '<h3>Strengths and concerns</h3><div class="muted pc-sm">Nothing saved from their work yet. A screenshot saved as a strong example or added to the watch list shows here, with the date.</div>'; return; }
  const seg = [['', 'All'], ['good', '★ Strong · ' + good.length], ['watch', '⚑ Watch · ' + bad.length]];
  el.innerHTML = '<h3>Strengths and concerns</h3>' +
    '<div class="wlbar"><span class="pseg sm" role="group">' + seg.map(([k, l]) => '<button data-wlcf="' + k + '" aria-pressed="' + (wlCardF === k) + '">' + l + '</button>').join('') + '</span><span class="sp"></span>' +
      '<button class="btn sm" data-wlcopy title="Every date, assignment and note as text, for report comments">Copy notes</button><button class="btn sm primary" data-wlsend>Send to ' + esc(aiSay()) + '</button></div>' +
    (top.length ? '<p class="wltrend">Seen most: ' + top.map(([t, n]) => '<span class="extag">' + esc(t) + (n > 1 ? ' ×' + n : '') + '</span>').join(' ') + '</p>' : '') +
    '<ol class="wltime">' + (list.length ? list.map(r => '<li class="' + (r.watch ? 'w' : 'g') + '" data-exid="' + esc(r.id) + '"><button class="wlth" data-wlopen title="Look closer"><img alt="" data-expic="' + esc(r.id) + '"></button><div><div class="wlhd"><b>' + (r.watch ? '⚑ ' : '★ ') + esc(exLabel(r)) + '</b> · ' + esc(r.title || '') + ' <span class="muted">· ' + wlDay(r.t) + '</span></div>' +
      (r.why ? '<p>' + esc(r.why) + '</p>' : '') + (exTags(r).length ? '<p class="extags">' + exTags(r).map(t => '<span class="extag">' + esc(t) + '</span>').join('') + '</p>' : '') + '</div></li>').join('') : '<li class="muted pc-sm">None of this kind yet.</li>') + '</ol>';
  for (const im of el.querySelectorAll('img[data-expic]')) exUrl(im.dataset.expic, 0).then(u => { if (u && im.isConnected) im.src = u; });
}
function wlCardClick(e) {
  const el = $('#pcWl'); if (!el || !el.contains(e.target) || !pcOpen) return false;
  const f = e.target.closest('[data-wlcf]'); if (f) { wlCardF = f.dataset.wlcf; wlCardFill(); return true; }
  const { cid, name } = pcOpen, all = wlOf(cid, name);
  if (e.target.closest('[data-wlcopy]')) { wlCopyNotes(classById(cid), name, all); return true; }
  if (e.target.closest('[data-wlsend]')) { closeCard(); wlSend(all, { c: cid, n: name }); return true; }
  const o = e.target.closest('[data-wlopen]');
  if (o) { const id = o.closest('[data-exid]').dataset.exid, l = all.slice().reverse(); closeCard(); exShow(l, l.findIndex(r => r.id === id)); return true; }
  return false;
}
function wlCopyNotes(c, name, all) {
  const line = r => '- ' + wlDay(r.t) + ' · ' + (r.title || 'Assignment') + ' · ' + (r.watch ? 'To watch' : 'Strong') + (r.why ? ': ' + r.why : '') + (exTags(r).length ? ' (' + exTags(r).join(', ') + ')' : '');
  const text = name + (c ? ', ' + c.name : '') + '\n' + all.map(line).join('\n') + '\n';
  navigator.clipboard.writeText(text).then(() => toast('Copied ' + people(all.length, 'note')), () => toast('Copying didn’t work here.'));
}

/* the Examples page: Strong examples, Watch list, Whose work */
function wlTabs() {
  if (!exWatch.length && !exList.some(r => r.who) && !exPageF.view) return '';
  const v = [['', 'Strong examples · ' + exList.length], ['watch', 'Watch list · ' + exWatch.length], ['who', 'Whose work']];
  return '<div class="wltabs"><span class="pseg" role="group" aria-label="Show">' + v.map(([k, l]) => '<button data-wlview="' + k + '" aria-pressed="' + (exPageF.view === k) + '">' + l + '</button>').join('') + '</span></div>';
}
// Per class: who the strong examples come from, most first, with what is on their watch list, and who has none yet.
function wlWhoHtml() {
  const all = exList.concat(exWatch), loose = exList.filter(r => !r.who).length;
  const out = lib.classes.filter(c => (c.names || []).length && all.some(r => r.who && r.who.c === c.id)).map(c => {
    const rows = c.names.map(n => { const l = wlOf(c.id, n); return { n, g: l.filter(r => !r.watch).length, w: l.filter(r => r.watch).length, t: l.length ? l[l.length - 1].t : 0 }; });
    const has = rows.filter(r => r.g || r.w).sort((a, b) => b.g - a.g || b.w - a.w || natural(a.n, b.n)), none = rows.filter(r => !r.g).map(r => r.n), most = Math.max(1, ...has.map(r => r.g));
    const sum = has.reduce((a, r) => a + r.g, 0);
    return '<section class="exgroup"><h2 class="exgh">' + esc(c.name) + ' <span class="muted">· ' + people(sum, 'strong example') + ' from ' + people(has.filter(r => r.g).length, 'student') + '</span></h2>' +
      '<table class="wlwho"><thead><tr><th>Student</th><th>Strong examples</th><th>Watch list</th><th>Last saved</th></tr></thead><tbody>' +
      has.map(r => '<tr><td><button class="link" data-wlwho="' + esc(c.id) + '" data-n="' + esc(r.n) + '" data-raw>' + esc(r.n) + '</button></td><td><span class="wlbarg"><i style="width:' + Math.round(r.g / most * 100) + '%"></i></span><b>' + r.g + '</b></td><td>' + (r.w ? '⚑ ' + r.w : '<span class="muted">–</span>') + '</td><td class="muted">' + wlDay(r.t) + '</td></tr>').join('') + '</tbody></table>' +
      (none.length ? '<p class="muted wlnone">No strong example yet from ' + esc(none.join(', ')) + '.</p>' : '') + '</section>';
  }).join('');
  return (out || '<div class="exempty"><p><b>No examples are tied to a student yet.</b></p><p class="muted">From now on, a strong example or a watch-list picture taken on a paper is tied to that student. In the Save box you can also pick whose work it is.</p></div>') +
    (loose ? '<p class="muted wlnone">' + people(loose, 'strong example') + ' aren’t tied to a student (saved before this, or with No one in particular).</p>' : '');
}
function wlPageClick(e, page) {
  const v = e.target.closest('[data-wlview]'); if (v) { exPageF.view = v.dataset.wlview; for (const k of ['cls', 'asg', 'kind', 'row', 'tag']) exPageF[k] = ''; exPageRender(); return true; }
  const w = e.target.closest('[data-wlwho]'); if (w) { personCard(w.dataset.wlwho, w.dataset.n); return true; }
  if (e.target.closest('[data-wlsend]')) { wlSend(page(), null); return true; }
  return false;
}

/* sending to the teacher's own assistant */
function wlCodes(list) {
  const key = store.get('gs.wlCodes', {}) || {}, used = new Set(Object.values(key)), out = new Map();
  for (const r of list) {
    if (!r.who) continue;
    const k = wlKey(r.who.c, r.who.n);
    if (!key[k]) { let c; do { c = 'S-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (used.has(c)); used.add(c); key[k] = c; }
    out.set(k, key[k]);
  }
  store.set('gs.wlCodes', key);
  return out;
}
// Names in her notes become [name]: every student on the rosters these come from, with their other spellings.
function wlScrub(list) {
  const words = new Set();
  for (const id of new Set(list.map(r => r.who ? r.who.c : r.cls).filter(Boolean))) { const c = classById(id); if (!c) continue; for (const n of c.names || []) for (const s of [n, ...(infoOf(c, n).other || [])]) for (const w of String(s).split(/[\s,'’-]+/)) if (w.length > 1) words.add(w); }
  const rx = words.size ? new RegExp('(?<![\\p{L}])(' + [...words].sort((a, b) => b.length - a.length).map(rxEsc).join('|') + ')(?![\\p{L}])', 'giu') : null;
  return s => rx ? String(s || '').replace(rx, '[name]') : String(s || '');
}
function wlAsk(one, code, title) {
  return one ? 'These are pictures from the work of one student, ' + code + ', saved by me, their teacher, over the term. Each is marked Strength (strong work) or Concern (a misconception or something I am watching), with the date, the assignment and my note.\n\n1. What patterns do you see across them, and is anything getting better or worse over time?\n2. Suggest two or three next steps for this student.\n3. Draft a short, warm, professional report comment I can edit.\n\nCall the student ' + code + ' only.'
    : 'These are pictures of students’ work' + (title ? ' on ' + title : '') + ', saved by me, their teacher. Each student is a random code (S-XXXX). Each picture is marked Strength or Concern, with the assignment and my note.\n\n1. Group the concerns into the misconceptions behind them, with the codes that show each.\n2. Suggest how I could reteach the most common ones.\n3. Give one or two lines of feedback for each code.\n\nUse the codes only.';
}
let WLS = null;
// one: { c, n } for one student's card. keep: the ask and ticks, coming back from Black out more.
function wlSend(list, one, keep) {
  list = list.filter(Boolean);
  if (!list.length) return toast('Nothing to send yet.');
  const codes = wlCodes(one ? [{ who: one }].concat(list) : list), scrub = wlScrub(list), title = one ? '' : [...new Set(list.map(r => r.title))].length === 1 ? list[0].title : '';
  const code = r => one ? codes.get(wlKey(one.c, one.n)) : r.who ? codes.get(wlKey(r.who.c, r.who.n)) : 'No student';
  WLS = { list, one, codes, scrub, code, good: keep ? keep.good : !!one || list.every(r => !r.watch), bad: keep ? keep.bad : true };
  const n1 = list.filter(r => r.watch).length, n2 = list.length - n1;
  const key = [...codes.entries()].map(([k, c]) => '<li><b>' + esc(c) + '</b> is <span data-raw>' + esc(k.split('\n')[1]) + '</span></li>').join('');
  openDlg('<div class="bh"><h2>Send to ' + esc(aiSay()) + '</h2><span class="sp"></span><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb wlsend"><p class="muted">One PDF with the pictures and your notes, made on this computer. Each student is a random code, and names in your notes become [name]. The pictures were blacked out when you saved them: look them over and black out more if you need to.</p>' +
      (n1 && n2 ? '<p><label><input type="checkbox" id="wlBad"' + (WLS.bad ? ' checked' : '') + '> Concerns (' + n1 + ')</label> <label><input type="checkbox" id="wlGood"' + (WLS.good ? ' checked' : '') + '> Strengths (' + n2 + ')</label></p>' : '') +
      '<div class="wlstrip" id="wlStrip"></div>' +
      '<h3 class="exh">What to ask</h3><textarea id="wlAsk" rows="7" spellcheck="true">' + esc(keep ? keep.ask : wlAsk(!!one, one ? code(list[0]) : '', title)) + '</textarea>' +
      (key ? '<details class="wlkey"><summary>Which code is which student (only on this computer)</summary><ul>' + key + '</ul></details>' : '') + '</div>' +
    '<div class="bf"><span class="sp"></span><button class="btn" data-wlcopyask>Copy what to ask</button>' + (aiLink() ? '<a class="btn" href="' + esc(aiLink()) + '" target="_blank" rel="noopener">Open ' + esc(aiSay()) + '</a>' : '') + '<button class="btn primary" data-wlpdf>Download the PDF</button></div>');
  const box = $('#dlgBox'); box.classList.add('wlbox');
  dlgGone = () => { WLS = null; };
  wlStrip();
  box.onchange = e => { if (!WLS) return; if (e.target.id === 'wlBad') WLS.bad = e.target.checked; if (e.target.id === 'wlGood') WLS.good = e.target.checked; wlStrip(); };
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-wlcopyask]')) return navigator.clipboard.writeText($('#wlAsk').value).then(() => toast('Copied. Paste it into ' + aiSay() + ' with the PDF.'), () => toast('Copying didn’t work here.'));
    if (e.target.closest('[data-wlpdf]')) return wlPdf();
    const m = e.target.closest('[data-wlmore]');
    if (m) { const r = exById(m.dataset.wlmore), S = WLS, k = { ask: $('#wlAsk').value, good: S.good, bad: S.bad }; if (r) exPic(r.id, 0).then(b => b && exSaveShot(b, { redo: r, paper: false, back: () => wlSend(S.list.map(x => exById(x.id)), S.one, k) }, r.watch)); }
  };
}
const wlPicked = () => WLS ? WLS.list.filter(r => r.watch ? WLS.bad : WLS.good) : [];
function wlStrip() {
  const el = $('#wlStrip'); if (!el || !WLS) return;
  const l = wlPicked();
  el.innerHTML = l.length ? l.map(r => '<figure><img alt="" data-expic="' + esc(r.id) + '"><figcaption><b>' + esc(WLS.code(r)) + '</b> · ' + (r.watch ? 'Concern' : 'Strength') + '' + (r.pages.length === 1 ? '<br><button class="link" data-wlmore="' + esc(r.id) + '">Black out more</button>' : '') + '</figcaption></figure>').join('') : '<p class="muted">Nothing picked.</p>';
  for (const im of el.querySelectorAll('img[data-expic]')) exUrl(im.dataset.expic, 0).then(u => { if (u && im.isConnected) im.src = u; });
  const b = $('#dlgBox [data-wlpdf]'); if (b) b.disabled = !l.length;
}
async function wlPdf() {
  if (!WLS || sampleStops('making a file for your assistant')) return;
  const l = wlPicked(); if (!l.length) return;
  const S = WLS, btn = $('#dlgBox [data-wlpdf]'); if (btn) btn.disabled = true;
  try {
    const pdf = await PDFLib.PDFDocument.create(), F = await pdf.embedFont(PDFLib.StandardFonts.Helvetica), B = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const PW = 612, PH = 792, M = 48, CW = PW - 2 * M, ink = PDFLib.rgb(0.12, 0.13, 0.15), soft = PDFLib.rgb(0.36, 0.38, 0.42);
    pdf.setTitle('Student work'); pdf.setAuthor(''); pdf.setCreator('Grading Studio'); pdf.setProducer('');
    let pg = null, y = 0;
    const page = () => { pg = pdf.addPage([PW, PH]); y = PH - M; }, room = h => { if (!pg || y - h < M) page(); };
    // A line in letters the PDF's own font can't write (Japanese, Korean, Chinese and others) goes in as a picture of the words.
    const wlPict = async (s, size, bold) => {
      const k = 3, c = document.createElement('canvas'), x = c.getContext('2d'), f = (bold ? '600 ' : '') + size * k + 'px Inter, sans-serif', lines = []; x.font = f;
      let line = ''; for (const ch of [...s]) { const t = line + ch; if (line && x.measureText(t).width > CW * k) { lines.push(line); line = ch; } else line = t; } lines.push(line);
      c.width = CW * k; c.height = Math.ceil(lines.length * (size + 5) * k); x.font = f; x.fillStyle = '#1f2125'; x.textBaseline = 'top';
      lines.forEach((l, i) => x.fillText(l, 0, i * (size + 5) * k));
      const img = await pdf.embedPng(await (await canvasPng(c)).arrayBuffer()), h = lines.length * (size + 5);
      room(h); pg.drawImage(img, { x: M, y: y - h, width: CW, height: h }); y -= h;
    };
    const text = async (s, font, size, color) => { let line = ''; const put = () => { room(size + 5); pg.drawText(line, { x: M, y: y - size, size, font, color }); y -= size + 5; };
      for (const p0 of String(s).split('\n')) { const para = exPdfText(p0); if (/[^\x00-\xFF‘’“”–—…]/.test(p0)) { await wlPict(p0, size, font === B); continue; } line = ''; for (const w of para.split(/\s+/).filter(Boolean)) { const t = line ? line + ' ' + w : w; if (line && font.widthOfTextAtSize(t, size) > CW) { put(); line = w; } else line = t; } put(); } };
    await text('What I need', B, 15, ink); await text($('#wlAsk') ? $('#wlAsk').value : wlAsk(!!S.one, '', ''), F, 11, ink); y -= 10;
    for (const r of l) {
      room(120);
      await text(S.code(r) + ' - ' + (r.watch ? 'Concern' : 'Strength') + ' - ' + S.scrub(r.title || 'Assignment') + ' - ' + new Date(r.t).toISOString().slice(0, 10), B, 12, ink);
      if (r.why) await text('Note: ' + S.scrub(r.why), F, 11, ink);
      if (exTags(r).length) await text('Tags: ' + S.scrub(exTags(r).join(', ')), F, 9.5, soft);
      for (let n = 0; n < r.pages.length; n++) {
        const b = await exPic(r.id, n); if (!b) continue;
        const img = await pdf.embedJpg(new Uint8Array(await b.arrayBuffer())), k = Math.min(CW / img.width, (r.kind === 'paper' ? PH - 2 * M : 380) / img.height), w = img.width * k, h = img.height * k;
        room(h + 4); pg.drawImage(img, { x: M, y: y - h, width: w, height: h }); y -= h + 8;
      }
      y -= 14;
    }
    const nm = S.one ? S.code(l[0]) : (l.length === 1 || new Set(l.map(r => r.title)).size === 1) ? S.scrub(l[0].title || 'Watch list') : 'Watch list';
    saveBlob(('For ' + aiTag() + ' - ' + nm + '.pdf').replace(/[\\/:*?"<>|]+/g, '-'), new Blob([await pdf.save()], { type: 'application/pdf' }));
    toast('Downloaded. Give it to ' + aiSay() + ' with what to ask.', 6000);
  } catch (e) { console.error(e); toast('The PDF couldn’t be made: ' + (e.message || e), 6000); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
}

// The new year (newyear.js). With the roster kept, it all carries. Without it, the watch list goes and strong examples are no longer anyone's.
async function wlNewYear(keepRoster) {
  if (keepRoster) return;
  try { await exReady; } catch {}
  for (const r of exWatch.slice()) await exDelete(r.id);
  for (const r of exList.filter(r => r.who)) await exPut({ ...r, who: null });
  store.del('gs.wlCodes');
}

Object.assign(window.__gs, { personCard, exWatch: () => exWatch, wlOf, wlSend, wlPicked, wlNewYear, wlCodes, wlScrub, wlWhoHtml });
