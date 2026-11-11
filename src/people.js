/* ---------------- student details: ID, email, other spellings and a note for each roster student ---------------- */
// Kept on the class beside its roster, as c.info: { roster name: { id, email, other: [names], note } }. It lives in lib, so it
// stays in this browser, goes in her own Drive sync and merges like the roster does. It never goes in the Claude package.
// The card opens from the ⓘ beside a name: the student list, the paper's heading, the Grades list, the gradebook and a class's Students tab.
const classOfNames = names => (names && lib.classes.find(k => k.names === names)) || null;   // rosterMatch and rosterPairs are handed c.names itself
const infoOf = (c, n) => (c && c.info && c.info[n]) || {};
const infoSig = c => c && c.info ? JSON.stringify(c.info) : '';
const idDigits = v => String(v || '').replace(/\D/g, '');
const wordKey = s => nameWords(s).sort().join(' ');
// The roster names a folder or saved name belongs to by her saved details: one of their other spellings, or their student ID (4 digits or more) inside it.
function infoHits(c, key) {
  if (!c || !c.info || !key) return [];
  const kw = wordKey(key), nums = String(key).match(/\d{4,}/g) || [];
  return c.names.filter(n => {
    const i = c.info[n]; if (!i) return false;
    if ((i.other || []).some(o => o === key || (kw && wordKey(o) === kw))) return true;
    const d = idDigits(i.id); return d.length >= 4 && nums.includes(d);
  });
}
const blankInfo = i => !i || (!i.id && !i.email && !(i.other || []).length && !(i.note || '').trim() && !i.call && !i.pro && !i.rep && !i.nudge);   // call, pro, rep: report comments (reports.js); nudge: reminders (missing.js)
function setInfo(c, n, patch) {
  c.info ||= {};
  const i = { ...c.info[n], ...patch };
  for (const k of Object.keys(i)) if (i[k] === '' || (Array.isArray(i[k]) && !i[k].length)) delete i[k];
  if (blankInfo(i)) delete c.info[n]; else c.info[n] = i;
  if (!Object.keys(c.info).length) delete c.info;
}
// After the roster is edited: IDs and emails pasted with it fill in, and a renamed student keeps their details (found by the same ID),
// with the old name saved as another spelling. Details of a student taken off the roster are dropped with them.
function keepInfo(c, was, rows) {
  const old = c.info || {}, next = {};
  for (const n of c.names) if (old[n]) next[n] = old[n];
  for (const r of rows) if (r.id || r.email) next[r.name] = { ...next[r.name], ...(r.id ? { id: r.id } : {}), ...(r.email ? { email: r.email } : {}) };
  for (const n of (was || []).filter(n => !c.names.includes(n) && old[n])) {
    const d = idDigits(old[n].id), to = d && c.names.find(m => idDigits((next[m] || {}).id) === d);
    if (!to) continue;
    const o = old[n], t = next[to] || {};
    next[to] = { ...o, ...t, other: [...new Set([...(o.other || []), ...(t.other || []), n])] };
  }
  c.info = next;
  if (!Object.keys(next).length) delete c.info;
}
const initials = n => { const w = String(n).replace(/[,_]/g, ' ').split(/\s+/).filter(x => /\p{L}/u.test(x)); const p = /,/.test(n) ? [w[1], w[0]] : [w[0], w[w.length - 1]]; return p.filter(Boolean).map(x => x[0].toUpperCase()).join('').slice(0, 2) || '?'; };
const whoBtn = (attrs, label) => '<span class="whob" role="button" tabindex="0" ' + attrs + ' title="Student details" aria-label="Student details for ' + esc(label) + '"></span>';

// For a student in the open download: their class and roster name, or just the folder name if the roster doesn't know them.
function personOf(st) {
  const c = batchClass();
  if (!c) return { c: null, name: null, folder: st.key };
  if (st.gap && c.names.includes(st.key)) return { c, name: st.key };
  const n = (namesNow().roster.get(st.key) || [])[0];
  return n ? { c, name: n, folder: st.key } : { c, name: null, folder: st.key };
}
const cardForStudent = i => { if (anonOn()) return; const p = personOf(batch.students[i]); personCard(p.c && p.c.id, p.name, p.folder); };

// Every saved download of this class, newest copy of each assignment, with this student's score or "nothing turned in".
async function classWork(c, name) {
  if (batch) saveNow();
  const all = await earlierWork('', d => hasWork(d) || !!(d && d.read)).catch(() => []);
  const seen = new Set(), rows = [];
  for (const [id, d] of all) {
    const m = keptMeta.get(id) || {};
    if (m.newer && keptMeta.has(m.newer)) continue;
    if (pastClass(d, m) !== c.id) continue;
    const f = m.asg && findItem(m.asg), label = (f && f.it.name) || m.name || (batch && batch.id === id ? batch.name : 'A download'), one = m.asg || label;
    if (seen.has(one)) continue; seen.add(one);
    const k = rosterPairs(c.names, Object.keys({ ...d.s, ...d.read })).get(name);
    const g = k ? { ...((d.s[k] || {}).g || {}), ...(d.read && d.read[k] ? { read: d.read[k] } : {}) } : null;
    rows.push({ name: label, t: workTime(d) || d.t || 0, p: g ? pastScore(d.setup, g) : null, none: !k || !!(d.s[k] && d.s[k].gap) });
  }
  return rows.sort((a, b) => a.t - b.t);
}
function workRows(rows) {
  if (!rows.length) return '<div class="muted pc-sm">No downloads for this class yet.</div>';
  return rows.map(r => {
    const p = r.p, right = !p ? '<span class="stag">nothing turned in</span>'
      : p.status ? '<span class="stag">' + STATUS_LABEL[p.status].toLowerCase() + '</span>'
      : p.total != null ? '<span><b>' + fmtNum(p.total) + ' / ' + fmtNum(p.max) + '</b>' + (p.pct != null ? ' · ' + fmtPct(p.pct) : '') + (p.partial ? ' <span class="stag">partial</span>' : '') + '</span>'
      : p.pct != null ? '<b>' + fmtPct(p.pct) + '</b>' : '<span class="muted">not scored yet</span>';
    return '<div class="pc-a"><span class="pc-an" title="' + esc(r.name) + '">' + esc(r.name) + '</span>' + right + '</div>';
  }).join('');
}
function workHead(c, rows) {
  const done = rows.filter(r => r.p).length, pc = rows.map(r => r.p).filter(p => p && p.pct != null && !p.partial && !p.status).map(p => p.pct);
  return 'In ' + esc(c.name) + (rows.length ? ' · ' + done + ' of ' + rows.length + ' turned in' + (pc.length ? ' · average ' + fmtPct(pc.reduce((a, b) => a + b, 0) / pc.length) : '') : '');
}

let pcOpen = null;
function closeCard() { const el = $('#pcard'); if (el) el.remove(); const back = pcOpen && pcOpen.back; pcOpen = null; if (back && back.isConnected) back.focus(); }
// cid: the class. name: the roster name, or null for a folder the roster doesn't know (folder: its name).
function personCard(cid, name, folder) {
  const c = cid ? classById(cid) : null, back = document.activeElement;
  closeCard(); pcOpen = { cid, name, folder, back };
  const el = document.createElement('div'); el.id = 'pcard'; el.className = 'pc-back';
  document.body.appendChild(el);
  renderCard();
  const f = el.querySelector('.pc-x'); if (f) f.focus();
}
function renderCard() {
  const el = $('#pcard'); if (!el || !pcOpen) return;
  const { cid, name, folder } = pcOpen, c = cid ? classById(cid) : null;
  if (!name) return renderStranger(el, c, folder);
  const i = infoOf(c, name), pos = c.names.indexOf(name);
  const field = (k, label, ph, type) => '<label class="pc-f"><span class="pc-k">' + label + '</span><input class="pc-in" type="' + (type || 'text') + '" data-pf="' + k + '" value="' + esc(i[k] || '') + '" placeholder="' + ph + '" autocomplete="off" spellcheck="false">' +
    '<span class="pc-acts">' + (i[k] && k !== 'prev' ? '<button class="link" data-pcopy="' + k + '">Copy</button>' + (k === 'email' ? '<a class="link" href="mailto:' + esc(i.email) + '">Email</a>' : '') : '') + '</span></label>';
  el.innerHTML = '<div class="pc" role="dialog" aria-modal="true" aria-label="Student details"><div class="pc-hd"><div class="pc-av">' + esc(initials(name)) + '</div><div class="pc-tt"><h2>' + esc(name) + '</h2>' +
    '<div class="muted pc-sm">' + esc(c.name) + ' · ' + (pos + 1) + ' of ' + c.names.length + ' on the roster' + (folder && folder !== name ? ' · folder “' + esc(folder) + '”' : '') + '</div></div><button class="icon pc-x" aria-label="Close">✕</button></div>' +
    '<div class="pc-bd">' + field('id', 'Student ID', 'Add their student ID') + field('email', 'Email', 'Add their email', 'email') + field('prev', 'Last year', 'Their level last year (optional)') +
    '<div class="pc-f"><span class="pc-k">Also called</span><span class="pc-chips">' + (i.other || []).map((o, k) => '<span class="pc-chip">' + esc(o) + '<button data-pdrop="' + k + '" aria-label="Remove ' + esc(o) + '" title="Remove this spelling">×</button></span>').join('') +
    '<button class="pc-chip pc-add" data-padd>+ add</button></span><span></span></div>' +
    '<label class="pc-f pc-top"><span class="pc-k">Note</span><textarea class="pc-in" data-pf="note" rows="2" placeholder="Anything you want to remember">' + esc(i.note || '') + '</textarea><span></span></label></div>' +
    '<div class="pc-sec"><h3 id="pcWorkH">' + workHead(c, []) + '</h3><div id="pcWork"><div class="muted pc-sm">Looking through saved work…</div></div></div>' +
    '<div class="pc-ft muted">Kept in this browser with the roster. Other spellings and the student ID match folders to this student.</div></div>';
  const me = pcOpen;
  classWork(c, name).then(rows => { if (pcOpen !== me || !$('#pcWork')) return; $('#pcWorkH').innerHTML = workHead(c, rows); $('#pcWork').innerHTML = workRows(rows); }).catch(e => console.error(e));
}
function renderStranger(el, c, folder) {
  const free = c ? c.names.filter(n => !(batch && rosterMatch(c.names).has(n))) : [];
  const near = c ? [...free].sort((a, b) => (nameFit(b, folder) * 2 + nameNear(b, folder)) - (nameFit(a, folder) * 2 + nameNear(a, folder))) : [];
  const guess = near.find(n => nameFit(n, folder) || nameNear(n, folder));
  const rest = c ? c.names.filter(n => !free.includes(n)) : [];
  el.innerHTML = '<div class="pc" role="dialog" aria-modal="true" aria-label="Student details"><div class="pc-hd"><div class="pc-av pc-q">?</div><div class="pc-tt"><h2>' + esc(folder) + '</h2>' +
    '<div class="muted pc-sm">' + (c ? 'Folder name · not on the ' + esc(c.name) + ' roster' : 'Folder name · no roster picked for this download') + '</div></div><button class="icon pc-x" aria-label="Close">✕</button></div>' +
    (c && c.names.length ? (guess ? '<div class="pc-note">This looks like ' + esc(guess) + '.</div>' : '') +
      '<div class="pc-bd"><label class="pc-f"><span class="pc-k">This is</span><select id="pcLink">' + near.map(n => '<option' + (n === guess ? ' selected' : '') + '>' + esc(n) + '</option>').join('') +
      (rest.length ? '<optgroup label="Already matched">' + rest.map(n => '<option>' + esc(n) + '</option>').join('') + '</optgroup>' : '') + '</select><button class="btn sm primary" data-plink>Link</button></label></div>' +
      '<div class="pc-ft muted">Linking saves “' + esc(folder) + '” as another spelling of that student, so later downloads with this name go to them by themselves.</div>'
      : '<div class="pc-ft muted">' + (c ? 'Add students to the ' + esc(c.name) + ' roster to link this folder to one of them.' : 'Pick a roster under Setup to link this folder to a student.') + '</div>') + '</div>';
}
// Linking a folder: its name becomes another spelling of that roster student, and the open download re-sorts.
function linkFolder(c, name, folder) {
  setInfo(c, name, { other: [...new Set([...(infoOf(c, name).other || []), folder])] });
  saveLib();
  if (batch && batchClass() === c) { const st = batch.students[cur]; rosterSort(); cur = Math.max(0, batch.students.indexOf(st)); setBatchName(); renderList(); saveSoon(); }
  toast('“' + folder + '” is now linked to ' + name);
}
document.addEventListener('click', async e => {
  const el = $('#pcard'); if (!el || !pcOpen) return;
  if (e.target === el || e.target.closest('.pc-x')) return closeCard();
  const c = classById(pcOpen.cid), n = pcOpen.name;
  const cp = e.target.closest('[data-pcopy]'); if (cp) return copy(infoOf(c, n)[cp.dataset.pcopy] || '', 'Copied');
  const dr = e.target.closest('[data-pdrop]');
  if (dr) { const o = [...(infoOf(c, n).other || [])]; o.splice(+dr.dataset.pdrop, 1); setInfo(c, n, { other: o }); saveLib(); afterInfo(c); return renderCard(); }
  if (e.target.closest('[data-padd]')) {
    const v = await askTextDlg('Another way ' + n + '’s name is written (in a download, a folder' + (sysName() ? ' or ' + sysName() : '') + ')', '', { ok: 'Add' });
    if (v && v.trim()) { setInfo(c, n, { other: [...new Set([...(infoOf(c, n).other || []), v.trim()])] }); saveLib(); afterInfo(c); }
    return renderCard();
  }
  if (e.target.closest('[data-plink]')) { const to = $('#pcLink').value; linkFolder(c, to, pcOpen.folder); pcOpen.name = to; return renderCard(); }
}, true);
document.addEventListener('change', e => {
  const f = e.target.closest && e.target.closest('#pcard [data-pf]'); if (!f || !pcOpen) return;
  const c = classById(pcOpen.cid), v = f.value.trim();
  if (f.dataset.pf === 'email' && v && !EMAIL_RX.test(v)) { toast('That doesn’t look like an email address'); return; }
  setInfo(c, pcOpen.name, { [f.dataset.pf]: f.dataset.pf === 'id' ? v.replace(/\s+/g, '') : v }); saveLib(); afterInfo(c);
  const acts = f.parentElement.querySelector('.pc-acts');
  if (acts) acts.innerHTML = v && f.dataset.pf !== 'prev' ? '<button class="link" data-pcopy="' + f.dataset.pf + '">Copy</button>' + (f.dataset.pf === 'email' ? '<a class="link" href="mailto:' + esc(v) + '">Email</a>' : '') : '';
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#pcard')) { e.stopPropagation(); e.preventDefault(); closeCard(); } }, true);
// A saved spelling or ID can change who a folder belongs to: the open download re-sorts.
function afterInfo(c) {
  if (batch && batchClass() === c) { const st = batch.students[cur]; rosterSort(); cur = Math.max(0, batch.students.indexOf(st)); setBatchName(); renderList(); saveSoon(); }
  if ($('#peopleTbl')) fillPeople(c);
}
// The ⓘ beside a name, wherever it is. Keyboard: Enter or Space.
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.whob'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  if (b.dataset.wi != null) return cardForStudent(+b.dataset.wi);
  if (b.dataset.wc) return personCard(b.dataset.wc, b.dataset.wn);
}, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('whob')) { e.preventDefault(); e.target.click(); } }, true);

// A class's students, with their ID and email to type or paste in: the Students tab of a class page (classpage.js puts it there).
// A name goes to that student's own page of grades and charts; the ⓘ beside it opens their details.
let peopleQuiet = false;
function peoplePanel(el, c) {
  el.innerHTML = '<div class="pplbar"><span class="muted" id="peopleSum"></span><span class="sp"></span><button class="btn sm" data-ppaste>Paste IDs and emails…</button><button class="btn sm" data-pmail>Copy all emails</button></div>' +
    '<div id="peoplePaste" hidden><p class="muted" style="margin:0 0 6px;font-size:13.5px">Paste a class list with names and a student ID or email column (from ' + (sysName() ? esc(sysName()) + ' or ' : '') + 'a spreadsheet). Each row fills in the student with the same name.</p><textarea class="big" id="peopleIn" placeholder="Name, student ID, email"></textarea>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="btn sm" data-pcancel>Cancel</button><button class="btn sm primary" data-pfill>Fill in</button></div></div><div id="peopleTbl"></div>' +
    '<p class="muted pplcap">Click a name for that student’s grades and charts. The ⓘ opens their details, with other spellings and a note.</p>';
  fillPeople(c);
  el.onclick = e => {
    if (e.target.closest('[data-ppaste]')) { $('#peoplePaste').hidden = false; return $('#peopleIn').focus(); }
    if (e.target.closest('[data-pcancel]')) { $('#peoplePaste').hidden = true; return; }
    if (e.target.closest('[data-pmail]')) { const m = c.names.map(n => infoOf(c, n).email).filter(Boolean); return m.length ? copy(m.join('; '), 'Copied ' + m.length + (m.length === 1 ? ' email' : ' emails')) : toast('No emails yet'); }
    if (e.target.closest('[data-pfill]')) {
      const rows = parseRosterRows($('#peopleIn').value).filter(r => r.id || r.email), pairs = rosterPairs(c.names, rows.map(r => r.name));
      let n = 0; const miss = [];
      for (const r of rows) { const who = c.names.find(x => pairs.get(x) === r.name); if (!who) { miss.push(r.name); continue; } setInfo(c, who, { ...(r.id ? { id: r.id } : {}), ...(r.email ? { email: r.email } : {}) }); n++; }
      saveLib(); afterInfo(c); $('#peoplePaste').hidden = true; $('#peopleIn').value = '';
      toast(n ? 'Filled in ' + n + (n === 1 ? ' student' : ' students') + (miss.length ? '. Not on the roster: ' + miss.slice(0, 3).join(', ') + (miss.length > 3 ? ' and ' + (miss.length - 3) + ' more' : '') : '') : 'No names matched the roster', 6000);
    }
  };
  el.onchange = e => {
    const f = e.target.closest('[data-pp]'); if (!f) return;
    const n = c.names[+f.dataset.pi], v = f.value.trim();
    if (f.dataset.pp === 'email' && v && !EMAIL_RX.test(v)) { toast('That doesn’t look like an email address'); return; }
    setInfo(c, n, { [f.dataset.pp]: f.dataset.pp === 'id' ? v.replace(/\s+/g, '') : v }); saveLib();
    peopleQuiet = true; try { afterInfo(c); } finally { peopleQuiet = false; }   // the row she's typing in stays as it is, so Tab goes on to the next box
    peopleSum(c);
  };
}
function peopleSum(c) {
  const el = $('#peopleSum'); if (!el) return;
  el.textContent = c.names.length + (c.names.length === 1 ? ' student' : ' students') + ' · ' + c.names.filter(n => infoOf(c, n).id).length + ' with an ID';
}
function fillPeople(c) {
  const t = $('#peopleTbl'); if (!t || peopleQuiet) return;
  peopleSum(c);
  t.innerHTML = c.names.length ? '<table class="gl ppl"><thead><tr><th>#</th><th>Name</th><th class="pg" id="peopleGh">Grade</th><th>Student ID</th><th>Email</th><th>Last year</th><th>Also called</th></tr></thead><tbody>' + c.names.map((n, k) => { const i = infoOf(c, n);
    return '<tr><td class="n">' + (k + 1) + '</td><td class="nm"><a class="link" href="' + classHash(c, 'students', k) + '">' + esc(n) + '</a>' + whoBtn('data-wc="' + esc(c.id) + '" data-wn="' + esc(n) + '"', n) + '</td><td class="pg" data-pg="' + k + '"></td>' +
      '<td><input class="pc-in" data-pp="id" data-pi="' + k + '" value="' + esc(i.id || '') + '" placeholder="Student ID" aria-label="Student ID for ' + esc(n) + '"></td>' +
      '<td><input class="pc-in" type="email" data-pp="email" data-pi="' + k + '" value="' + esc(i.email || '') + '" placeholder="Email" aria-label="Email for ' + esc(n) + '"></td>' +
      '<td><input class="pc-in" data-pp="prev" data-pi="' + k + '" value="' + esc(i.prev || '') + '" placeholder="Optional" aria-label="Last year’s level for ' + esc(n) + '"></td>' +
      '<td class="muted">' + ((i.other || []).length || '–') + '</td></tr>'; }).join('') + '</tbody></table>'
    : '<p class="muted">No students on this roster yet. Use Edit roster to add them.</p>';
  peopleGrades(c);
}
// Each student's grade for the term that's on now, by the gradebook's own sums, once the saved work has been read.
function peopleGrades(c) {
  const t = $('#peopleTbl'); if (!t || bk.host !== 'page' || !bk.cols) return;
  const conf = bkConf(), term = conf.terms.length ? bkTermNow(conf.terms) : '', cols = bkClassCols(c, bk.cols).filter(x => x.termId === term), tn = conf.terms.find(x => x.id === term);
  const h = $('#peopleGh'); if (h) h.textContent = tn ? tn.name || 'Term' : 'Grade';
  for (const td of t.querySelectorAll('td[data-pg]')) { const r = bkGrade(c.names[+td.dataset.pg], cols, conf); td.textContent = r.grade != null ? pctAvgText(r.grade) : '–'; }
}

// Class overview: this assignment's average by the level each student was in last year, if she's filled any in. Optional, so it's only there when there's something to show.
function levelHtml(s) {
  if (anonOn() || s.meanPct == null) return '';
  const c = batchClass(); if (!c || !c.info) return '';
  const groups = new Map();
  for (const x of s.counted) {
    if (x.pct == null) continue;
    const p = personOf(batch.students[x.i]), lv = (p.name ? infoOf(c, p.name).prev || '' : '').trim();
    if (!groups.has(lv)) groups.set(lv, []);
    groups.get(lv).push(x);
  }
  const named = [...groups.keys()].filter(Boolean).sort(natural);
  if (!named.length) return '';
  const row = (label, xs) => { const v = xs.map(x => x.pct); return '<tr><td>' + label + '</td><td class="c">' + xs.length + '</td><td class="c"><b>' + fmtPct(v.reduce((a, b) => a + b, 0) / v.length) + '</b></td><td class="c">' + fmtPct(Math.min(...v)) + ' – ' + fmtPct(Math.max(...v)) + '</td></tr>'; };
  return '<section id="ovLevels"><h3 class="ovh3">By last year’s level</h3><table class="gl ovlv"><thead><tr><th>Last year</th><th>Papers</th><th>Average</th><th>Range</th></tr></thead><tbody>' +
    named.map(k => row(esc(k), groups.get(k))).join('') + (groups.has('') ? row('<span class="muted">Not filled in</span>', groups.get('')) : '') + '</tbody></table>' +
    '<p class="muted ovcap2">From the Last year field on each student’s details (the ⓘ beside a name). Finished scores only.</p></section>';
}
