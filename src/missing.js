/* ---------------- Missing work: who still owes what, with a reminder email for each student ----------------
   A class page's Missing work tab (#/class/<id>/missing). It lists every paper marked Missing (on the marking screen, or typed in
   the gradebook) for the term shown, by student or by assignment. Each reminder is drafted here and opened in the teacher's own mail
   app with a mailto: link, ready for them to read and send. Grading Studio itself sends nothing.
   What is saved: when a student was last reminded about each piece of work, in the class's student details
   (c.info[name].nudge = { <gradebook column key>: time }), and how the email is worded in lib.book.miss = { subj, body, cls: { <class id>: name } }.
   Both travel with the rest of the work: the folder, the take-home file, safety copies. */
const MIS_WORDS = {
  subj: 'Missing work for {class}',
  body: 'Hi {name},\n\nI still don’t have this work from you for {class}:\n\n{list}\n\nPlease hand it in as soon as you can, or come and see me if you need more time.\n\nThank you',
};
let mis = { view: 'stu' };   // 'stu' by student, 'col' by assignment; for this visit only

function misConf() {
  const m = (lib.book && lib.book.miss) || {};
  return { subj: String(m.subj || '').trim() || MIS_WORDS.subj, body: String(m.body || '').trim() ? m.body : MIS_WORDS.body, cls: m.cls || {} };
}
function misSave(part) { bkSave({ miss: { ...((lib.book || {}).miss || {}), ...part } }); }
// What the class is called in an email: what they typed, else the class's own name.
const misClassName = (c, mc) => String(mc.cls[c.id] || '').trim() || c.name;
const misCols = cols => cols.filter(x => x.type !== 'xc');
const misOwes = (col, n) => (col.cells.get(n) || {}).st === 'missing';
// Each student who owes something, in roster order, with what they owe, oldest first.
function misByStu(c, cols) {
  const list = misCols(cols);
  return c.names.map((n, i) => ({ n, i, cols: list.filter(col => misOwes(col, n)) })).filter(x => x.cols.length);
}
// Each assignment someone owes, with who owes it.
function misByCol(c, cols) {
  return misCols(cols).map(col => ({ col, who: c.names.map((n, i) => ({ n, i })).filter(x => misOwes(col, x.n)) })).filter(x => x.who.length);
}
const misNudge = (c, n, col) => ((infoOf(c, n).nudge || {})[col.key]) || 0;
const misEmail = (c, n) => String(infoOf(c, n).email || '').split(/[;,\s]+/).filter(s => /@/.test(s)).join(',');
// How long ago a due date was, in days; 0 for today or later.
function misLate(due) {
  if (!due) return 0;
  const d = new Date(due + 'T12:00:00'), now = new Date(isoDay(Date.now()) + 'T12:00:00');
  return isNaN(d) ? 0 : Math.max(0, Math.round((now - d) / 864e5));
}
const misDue = col => col.due ? 'Due ' + bkDay(col.due) + (misLate(col.due) ? ' · ' + people(misLate(col.due), 'day') + ' ago' : '') : '';
const misLine = col => '- ' + col.name + (col.due ? ' (due ' + bkDay(col.due) + ')' : '');

/* ---------- the email ---------- */
function misFill(t, map) { return String(t).replace(/\{(\w+)\}/g, (m, k) => k in map ? map[k] : m); }
// One student's reminder: to, subject and body, for the work listed.
function misDraft(c, n, cols, mc) {
  mc = mc || misConf();
  const map = { name: rptCall(c, n), class: misClassName(c, mc), list: cols.map(misLine).join('\n'), n: String(cols.length) };
  return { to: misEmail(c, n), bcc: '', subject: misFill(mc.subj, map), body: misFill(mc.body, map) };
}
// One email to everyone who owes one assignment, their addresses hidden from each other (Bcc).
function misGroup(c, col, who, mc) {
  mc = mc || misConf();
  const map = { name: 'everyone', class: misClassName(c, mc), list: misLine(col), n: '1' };
  return { to: '', bcc: who.map(x => misEmail(c, x.n)).filter(Boolean).join(','), subject: misFill(mc.subj, map), body: misFill(mc.body, map) };
}
const misEnc = s => encodeURIComponent(s).replace(/%40/g, '@').replace(/%2C/g, ',');
function misHref(m, noBody) {
  const q = [m.bcc ? 'bcc=' + misEnc(m.bcc) : '', 'subject=' + encodeURIComponent(m.subject), noBody ? '' : 'body=' + encodeURIComponent(m.body.replace(/\r?\n/g, '\r\n'))].filter(Boolean).join('&');
  return 'mailto:' + misEnc(m.to) + '?' + q;
}
const misPlain = m => (m.to ? 'To: ' + m.to.replace(/,/g, ', ') + '\n' : '') + (m.bcc ? 'Bcc: ' + m.bcc.replace(/,/g, ', ') + '\n' : '') + 'Subject: ' + m.subject + '\n\n' + m.body;
// Hands the email to the computer's own mail app. A very long one (some mail apps cut a link short) goes without its body,
// which is put on the clipboard instead, to paste in.
function misOpen(m) {
  let href = misHref(m), cut = false;
  if (href.length > 1900) { href = misHref(m, true); cut = true; navigator.clipboard.writeText(m.body).catch(() => {}); }
  if (window.__gsMailTest) window.__gsMailTest(href);
  else { const a = document.createElement('a'); a.href = href; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  return cut;
}
// Saves that these students were reminded about these columns today. Reminders for work no longer missing anywhere are dropped.
function misMark(c, pairs, t) {
  const all = misCols(bkClassCols(c, bk.cols)), was = [];
  for (const [n, cols] of pairs) {
    const old = infoOf(c, n).nudge || {}, keep = {};
    for (const [k, v] of Object.entries(old)) if (all.some(col => col.key === k && misOwes(col, n))) keep[k] = v;
    for (const col of cols) if (t) keep[col.key] = t; else delete keep[col.key];
    was.push([n, old]);
    setInfo(c, n, { nudge: Object.keys(keep).length ? keep : '' });
  }
  bkSaveLib();
  return () => { for (const [n, old] of was) setInfo(c, n, { nudge: Object.keys(old).length ? old : '' }); bkSaveLib(); if ($('#mis')) bkDraw(); };
}

/* ---------- the page ---------- */
function misItem(c, n, col) {
  const t = misNudge(c, n, col), open = col.dl ? batchHash(col.dl) : classHash(c, 'gradebook');
  return '<li><span class="misw">' + esc(col.name) + '</span>' + (col.type ? bkPill(col.type) : '') + '<span class="muted misdue">' + esc(misDue(col)) + '</span>' +
    (t ? '<span class="schip ok" title="You opened a reminder about this">Reminded ' + esc(bkDay(isoDay(t))) + '</span>' : '') +
    '<span class="sp"></span><a class="link" href="' + open + '">Open</a></li>';
}
function misWhoMail(c, n, i) {
  const e = misEmail(c, n);
  return e ? '<span class="muted misaddr">' + esc(e.replace(/,/g, ', ')) + '</span>' : '<a class="link misnoaddr" href="' + classHash(c, 'students') + '" title="Add emails on the Students tab">No email yet</a>';
}
function misView(c, cols) {
  if (anonOn()) return '<p class="muted bkpad">Names are hidden while anonymous grading is on. Turn it off to see who still owes work.</p>';
  const mc = misConf(), stus = misByStu(c, cols), total = stus.reduce((s, x) => s + x.cols.length, 0);
  const seg = '<div class="pseg" role="group" aria-label="Show">' + [['stu', 'By student'], ['col', 'By assignment']].map(([k, l]) => '<button data-misview="' + k + '" aria-pressed="' + (mis.view === k) + '">' + l + '</button>').join('') + '</div>';
  const head = '<div class="misopts">' + seg + '<label>Class called <input type="text" id="misCls" value="' + esc(misClassName(c, mc)) + '" maxlength="60" title="How the class is named in a reminder"></label></div>' +
    '<p class="muted misnote">Each reminder opens in your own mail app, ready for you to read and send. Grading Studio sends nothing itself.</p>';
  if (!stus.length) return '<div class="bkpad mis" id="mis">' + head + '<div class="misnone"><b>Nobody owes any work' + (bk.term === '*' ? ' this year' : ' in this term') + '.</b><p class="muted">When you mark a paper Missing, on the marking screen or in the gradebook, it shows here.' + (bk.term === '*' || !bkConf().terms.length ? '' : ' Whole year shows every term.') + '</p></div></div>';
  const sum = '<div class="missum" id="misSum">' + people(stus.length, 'student') + ' owe' + (stus.length === 1 ? 's ' : ' ') + people(total, 'piece of work', 'pieces of work') + '</div>';
  let body;
  if (mis.view === 'col') body = misByCol(c, cols).map(({ col, who }) => {
    const sent = who.filter(x => misEmail(c, x.n)).length;
    return '<section class="miscard" data-miscol="' + esc(col.key) + '"><div class="mishead"><h3>' + esc(col.name) + '</h3>' + (col.type ? bkPill(col.type) : '') + '<span class="muted">' + esc(misDue(col)) + '</span><span class="sp"></span>' +
      '<span class="muted">' + people(who.length, 'student') + '</span>' +
      '<button class="btn sm primary" data-misall="' + esc(col.key) + '"' + (sent ? '' : ' disabled') + ' title="One email to all of them, each address hidden from the others (Bcc)">Email all</button></div>' +
      '<ul class="mislist">' + who.map(({ n, i }) => { const t = misNudge(c, n, col);
        return '<li><span class="misw">' + bkName(n, i) + '</span>' + misWhoMail(c, n, i) + (t ? '<span class="schip ok">Reminded ' + esc(bkDay(isoDay(t))) + '</span>' : '') + '<span class="sp"></span><button class="btn sm" data-mismail="' + i + '" data-misonly="' + esc(col.key) + '">Email</button></li>'; }).join('') + '</ul></section>';
  }).join('');
  else body = stus.map(({ n, i, cols: owed }) => '<section class="miscard" data-misstu="' + i + '"><div class="mishead"><h3>' + bkName(n, i) + '</h3>' + misWhoMail(c, n, i) + '<span class="sp"></span>' +
    '<button class="btn sm" data-miscopy="' + i + '" title="The email as text, to paste anywhere">Copy</button><button class="btn sm primary" data-mismail="' + i + '">Email reminder</button></div>' +
    '<ul class="mislist">' + owed.map(col => misItem(c, n, col)).join('') + '</ul></section>').join('');
  return '<div class="bkpad mis" id="mis">' + head + sum + body + '</div>';
}
// The term bar's buttons while this tab is on (bkDraw puts them there).
const misBar = () => '<button class="btn sm" data-miswords>Email wording…</button><button class="btn sm" data-miscopyall title="Every student who owes work, with their email and what they owe, to paste into a spreadsheet">Copy list</button><button class="btn sm" data-miscsv title="A spreadsheet file of who owes what">Download</button>';
const misShown = c => { const all = bkClassCols(c, bk.cols); return bk.term === '*' ? all : all.filter(x => x.termId === bk.term); };
function misTable(c) {
  const rows = [];
  for (const { n, cols } of misByStu(c, misShown(c))) for (const col of cols) { const t = misNudge(c, n, col); rows.push([n, misEmail(c, n).replace(/,/g, ', '), col.name, col.due || '', t ? isoDay(t) : '']); }
  return rows;
}
function misClick(e) {
  if (!$('#mis') && !e.target.closest('[data-miswords],[data-miscopyall],[data-miscsv]')) return;
  if (!e.target.closest('#bkBody')) return;
  const b = e.target.closest('button'), c = bkClass(); if (!b || !c || !bk.cols) return;
  const d = b.dataset, mc = misConf(), cols = misShown(c);
  if (d.misview) { mis.view = d.misview; return bkDraw(); }
  if (d.mismail != null || d.miscopy != null) {
    const n = c.names[+(d.mismail != null ? d.mismail : d.miscopy)]; if (!n) return;
    const owed = misCols(cols).filter(col => misOwes(col, n) && (!d.misonly || col.key === d.misonly)); if (!owed.length) return;
    const m = misDraft(c, n, owed, mc);
    if (d.miscopy != null) return navigator.clipboard.writeText(misPlain(m)).then(() => toast('Copied the email to ' + rptCall(c, n) + '.'), () => toast('Copying didn’t work in this browser.'));
    const cut = misOpen(m), undo = misMark(c, [[n, owed]], Date.now()); bkDraw();
    return toastDo((cut ? 'The email was too long for a link, so its words are on the clipboard: paste them in. ' : 'Your mail app should open with the email ready to send. ') + (m.to ? '' : 'There is no email for ' + rptCall(c, n) + ' yet, so add who it goes to. ') + 'Marked as reminded today.', 'Undo', undo);
  }
  if (d.misall) {
    const x = misByCol(c, cols).find(y => y.col.key === d.misall); if (!x) return;
    const m = misGroup(c, x.col, x.who, mc), cut = misOpen(m), undo = misMark(c, x.who.filter(w => misEmail(c, w.n)).map(w => [w.n, [x.col]]), Date.now()); bkDraw();
    const none = x.who.filter(w => !misEmail(c, w.n)).length;
    return toastDo((cut ? 'The email was too long for a link, so its words are on the clipboard: paste them in. ' : 'Your mail app should open with one email to ' + people(x.who.length - none, 'student') + ' in Bcc. ') + (none ? people(none, 'student') + ' with no email ' + (none === 1 ? 'is' : 'are') + ' left out. ' : '') + 'Marked as reminded today.', 'Undo', undo, 8000);
  }
  if (d.miscopyall != null) {
    const rows = misTable(c); if (!rows.length) return toast('Nobody owes any work here.');
    return navigator.clipboard.writeText([['Student', 'Email', 'Missing work', 'Due', 'Reminded'], ...rows].map(r => tsvLine(r)).join('\n')).then(() => toast('Copied ' + people(rows.length, 'row') + '. Paste them into a spreadsheet.', 6000), () => toast('Copying didn’t work in this browser.'));
  }
  if (d.miscsv != null) { const rows = misTable(c); return saveBlob(c.name + ' missing work.csv', new Blob(['﻿Student,Email,Missing work,Due,Reminded\r\n' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + (rows.length ? '\r\n' : '')], { type: 'text/csv' })); }
  if (d.miswords != null) return misWordsDlg();
}
function misChange(e) {
  const t = e.target, c = bkClass(); if (!c || !t.closest || !t.closest('#mis')) return;
  if (t.id === 'misCls') { const v = t.value.trim(), cls = { ...misConf().cls }; if (v && v !== c.name) cls[c.id] = v; else delete cls[c.id]; misSave({ cls }); }
}
// How every reminder is worded. An empty box goes back to the built-in words.
function misWordsDlg() {
  const mc = misConf();
  openDlg('<div class="bh"><h2>Email wording</h2><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb miswords" id="misWords" data-lc="mail">' +
    '<p class="muted">Every reminder is written from these words. Your mail app adds your signature as usual.</p>' +
    '<p class="muted"><b>Words that are filled in:</b> {name} what the student is called · {class} the class · {list} the missing work, one on a line · {n} how many</p>' +
    '<label><span>Subject</span><input type="text" id="misSubj" maxlength="160" value="' + esc(mc.subj) + '"></label>' +
    '<label><span>Email</span><textarea id="misBody" rows="11">' + esc(mc.body) + '</textarea></label>' +
    '</div><div class="bf"><button class="btn" data-misreset>Use the built-in wording</button><span class="sp" style="flex:1"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-missavew>Save</button></div>', true, 'lg');
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-misreset]')) { $('#misSubj').value = MIS_WORDS.subj; $('#misBody').value = MIS_WORDS.body; return; }
    if (!e.target.closest('[data-missavew]')) return;
    const subj = $('#misSubj').value.trim(), body = $('#misBody').value.replace(/\s+$/, '');
    misSave({ subj: subj && subj !== MIS_WORDS.subj ? subj : '', body: body.trim() && body !== MIS_WORDS.body ? body : '' });
    closeDlg(); if ($('#mis')) bkDraw(); toast('Saved. Every reminder uses the new wording.');
  };
}
$('#vClass').addEventListener('click', misClick);
$('#vClass').addEventListener('change', misChange);
Object.assign(window.__gs, { misDraft, misGroup, misHref, misByStu, MIS_WORDS });
