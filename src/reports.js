/* ---------------- Report comments: a draft for each student, from her own scores and comments (Stage 6) ----------------
   A class page's Report comments tab (#/class/<id>/reports). The draft is put together here, in the browser, from the
   gradebook's own numbers and from sentences she can rewrite: no AI writes it and nothing is sent anywhere.
   What is saved: each student's comment for a term, in the class's student details (c.info[name].rep[term] = { text, done,
   v, t }), with what the student is called and the pronoun to use (c.info[name].call, .pro). How she likes them written
   (length, the grade in or out, a character limit, the subject's name for each class, her own sentences) is in lib.book.rep.
   Both travel with the rest of her work: the folder, the take-home file, safety copies. */
const RPT_LEN = [['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']];
// The sentences a draft is built from. Each kind has a few ways of saying it, so a class of comments doesn't read as one comment thirty times.
// {name} what the student is called · {they} {them} {their} the pronoun · {is} {has} "is/has" or "are/have" · {s} the s on a verb ("{they} work{s}")
// {in} " in <subject>", or nothing · {grade} the term grade · {row} a rubric row · {work} an assignment · {n} {list} missing work · {words} the next level's words
const RPT_WORDS = {
  openHigh: ['{name} has had an excellent term{in}.', '{name} has worked to a very high standard{in} this term.', 'This has been a very strong term{in} for {name}.'],
  openGood: ['{name} has had a good term{in}.', '{name} has made solid progress{in} this term.', 'This has been a positive term{in} for {name}.'],
  openMid: ['{name} has had a mixed term{in}.', '{name} has shown what {they} can do at times{in} this term.', 'This has been an uneven term{in} for {name}.'],
  openLow: ['{name} has found this term{in} difficult.', 'This has been a challenging term{in} for {name}.'],
  openNone: ['{name} has not yet finished enough work{in} this term for a grade.'],
  grade: ['{Their} term grade is {grade}.'],
  strong: ['{Their} strongest area is {row}.', '{They} {is} at {their} best in {row}.', '{row} has been a real strength.'],
  best: ['{Their} best piece of work was {work}.', '{work} showed what {they} can do.'],
  up: ['{Their} recent work shows clear improvement.', '{They} {has} improved steadily over the term.'],
  down: ['{Their} most recent scores have been lower than earlier in the term.', 'Recent work has not matched what {they} did earlier in the term.'],
  next: ['The next step is to work on {row}.', '{They} should now focus on {row}.', 'More attention to {row} will lift {their} work.'],
  level: ['To move up in {row}, the aim is: {words}.'],
  missing1: ['{They} still {has} one piece of work to hand in: {list}.'],
  missing: ['{They} still {has} {n} pieces of work to hand in: {list}.'],
  closeHigh: ['Well done, {name}.', '{They} should be proud of this term.'],
  closeGood: ['With the same effort next term, {they} can go further.', 'Keep it up, {name}.'],
  closeMid: ['Steady effort on this next term will make a real difference.', 'A consistent routine next term will help {them} show {their} best work more often.'],
  closeLow: ['Regular practice, and asking for help early, will make a difference next term.', 'I would like {name} to ask for help as soon as something is unclear.'],
};
const RPT_SLOTS = [['openHigh', 'Opening, for the highest grades'], ['openGood', 'Opening, for good grades'], ['openMid', 'Opening, for middling grades'], ['openLow', 'Opening, for the lowest grades'], ['openNone', 'Opening, when there is no grade yet'],
  ['grade', 'The grade'], ['strong', 'Strongest rubric row'], ['best', 'Best piece of work'], ['up', 'Scores going up'], ['down', 'Scores going down'], ['next', 'Rubric row to work on'], ['level', 'What the next level asks for'],
  ['missing1', 'One piece of work missing'], ['missing', 'Several pieces missing'], ['closeHigh', 'Closing, for the highest grades'], ['closeGood', 'Closing, for good grades'], ['closeMid', 'Closing, for middling grades'], ['closeLow', 'Closing, for the lowest grades']];
const RPT_PRO = { they: ['they', 'them', 'their', 'are', 'have', ''], she: ['she', 'her', 'her', 'is', 'has', 's'], he: ['he', 'him', 'his', 'is', 'has', 's'] };
const RPT_PROS = [['they', 'they / their'], ['she', 'she / her'], ['he', 'he / his'], ['name', 'No pronoun: use the name']];
let rpt = { stu: 0, saveT: 0, dirty: null };

function rptConf() {
  const r = (lib.book && lib.book.rep) || {}, cut = Array.isArray(r.cut) && r.cut.length === 3 && r.cut.every(v => isFinite(+v)) ? r.cut.map(Number) : [85, 70, 55];
  return { len: RPT_LEN.some(x => x[0] === r.len) ? r.len : 'medium', grade: !!r.grade, limit: +r.limit > 0 ? Math.round(+r.limit) : 0, cut, words: r.words || {}, subj: r.subj || {} };
}
function rptSave(part) { bkSave({ rep: { ...((lib.book || {}).rep || {}), ...part } }); }
// The term a comment is for: the term's own id, 'year' for the whole year, 'all' when she has no terms.
const rptTerm = () => bk.term === '*' ? 'year' : bk.term || 'all';
// What the student is called in a comment: what she typed, else the first name. "Stone, Ava" and "Ava Stone" are both Ava.
function rptCall(c, n) {
  const own = (infoOf(c, n).call || '').trim(); if (own) return own;
  const t = String(n), part = /,/.test(t) ? t.split(',').slice(1).join(' ') : t;
  return (part.trim().split(/\s+/)[0] || t).trim();
}
const rptPro = (c, n) => { const p = infoOf(c, n).pro; return RPT_PROS.some(x => x[0] === p) ? p : 'they'; };
const rptEntry = (c, n) => ((infoOf(c, n).rep || {})[rptTerm()]) || {};
function rptPut(c, n, patch, term) {
  const key = term || rptTerm(), rep = { ...(infoOf(c, n).rep || {}) }, e = { ...(rep[key] || {}), ...patch };
  for (const k of Object.keys(e)) if (e[k] == null || e[k] === false || e[k] === 0) delete e[k];
  if (Object.keys(e).some(k => k !== 't')) rep[key] = e; else delete rep[key];
  setInfo(c, n, { rep: Object.keys(rep).length ? rep : '' });
  bkSaveLib();
}

/* ---------- what the gradebook knows about one student this term ---------- */
const rptPairs = new WeakMap();
function rptSaid(c, cols, n) {
  const said = [];
  for (const col of cols) {
    if (!col.d || !col.d.s) continue;
    let pairs = rptPairs.get(col); if (!pairs) rptPairs.set(col, pairs = rosterPairs(c.names, Object.keys({ ...col.d.s, ...col.d.read })));
    const k = pairs.get(n), t = k && col.d.s[k] && col.d.s[k].g ? String(col.d.s[k].g.comment || '').trim() : '';
    if (t) said.push({ work: col.name, text: t });
  }
  return said;
}
// term: the period the comment is for, when it isn't the one the gradebook is on (a progress sheet, sheet.js).
function rptFacts(c, cols, conf, n, term) {
  // an MYP class has levels and a 1 to 7, never a percent (ib.js)
  if (classWay(c) === 'myp') return ibRptFacts(c, cols, n, term, rptSaid(c, cols, n));
  const g = bkGrade(n, cols, conf), scored = bkScored(cols).map(col => ({ col, cell: col.cells.get(n) })).filter(x => bkCounts(x.cell));
  const rows = new Map(), T = chRowTop(scored.map(x => x.col));   // rows on different scales are put on the one most of them use
  for (const { col, cell } of scored) for (const [nm, v0, t] of cell.rows || []) {
    const v = (t || ROW_TOP) !== T && v0 != null ? +v0 * T / (t || ROW_TOP) : v0;
    const name = chRowName(nm), k = name.toLowerCase(); if (!k || v == null || isNaN(+v)) continue;
    if (!rows.has(k)) rows.set(k, { name, v: [] });
    const e = rows.get(k); e.v.push(+v); e.col = col; e.raw = nm;
  }
  const avg = [...rows.values()].map(e => ({ ...e, avg: bkMean(e.v) })).sort((a, b) => b.avg - a.avg);
  // A strongest and a weakest row only when they really differ: a quarter of a point across the term.
  const apart = avg.length >= 2 && avg[0].avg - avg[avg.length - 1].avg >= 0.25 * T / ROW_TOP, strong = apart ? avg[0] : null, weak = apart ? avg[avg.length - 1] : null;
  let words = '';
  if (weak && weak.col.d) {   // her own words for the level above where the student is now, from the newest rubric with that row
    const s = weak.col.d.setup || {}, i = (s.criteria || []).findIndex(x => chRowName(x).toLowerCase() === weak.name.toLowerCase());
    if (i >= 0) words = String(levelIn(s, i, Math.min(rowTop(s, i), Math.floor(weak.avg * rowTop(s, i) / T + 1e-9) + 1)) || '').trim().replace(/[.。]+$/, '');
  }
  const v = scored.map(x => x.cell.pct), move = v.length >= 4 ? bkMean(v.slice(-3)) - bkMean(v.slice(0, -3)) : 0;
  const missing = cols.filter(x => x.type !== 'xc' && (x.cells.get(n) || {}).st === 'missing').map(x => x.name);
  const best = scored.length >= 2 ? scored.reduce((a, b) => b.cell.pct > a.cell.pct ? b : a) : null;
  const said = rptSaid(c, cols, n);
  return { grade: g.grade, soFar: g.soFar, strong, weak, words, move, missing, best: best && best.cell.pct >= 70 ? best.col.name : '', said, scored: scored.length };
}

/* ---------- the draft ---------- */
const rptHash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
const rptList = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
function rptFill(t, c, n, f, rc) {
  const call = rptCall(c, n), pro = rptPro(c, n), P = RPT_PRO[pro] || [call, call, call + '’s', 'is', 'has', 's'], subj = (rc.subj[c.id] || '').trim();
  const map = { name: call, they: P[0], them: P[1], their: P[2], is: P[3], has: P[4], s: P[5], in: subj ? ' in ' + subj : '', subject: subj, grade: f.gradeText != null ? f.gradeText : f.grade != null ? roundPct(f.grade) + '%' : '',
    row: '', work: f.best, n: String(f.missing.length), list: rptList(f.missing), words: f.words };
  const out = t.replace(/\{(\w+)\}/g, (m, k) => {
    const low = k[0].toLowerCase() + k.slice(1); if (!(low in map)) return m;
    const v = String(map[low]); return k !== low && v ? v[0].toUpperCase() + v.slice(1) : v;
  });
  return out.replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim().replace(/^./, ch => ch.toUpperCase());
}
// v: which way of saying each sentence. "Draft again" moves it on by one, so the same facts come out in other words.
function rptDraft(c, n, f, rc, v) {
  const band = f.band ? f.band : f.grade == null ? 'None' : f.grade >= rc.cut[0] ? 'High' : f.grade >= rc.cut[1] ? 'Good' : f.grade >= rc.cut[2] ? 'Mid' : 'Low';
  const say = (k, row) => { const own = (rc.words[k] || []).filter(Boolean), list = own.length ? own : RPT_WORDS[k]; return rptFill(list[(rptHash(n + k) + (v || 0)) % list.length].replace(/\{row\}/g, row || ''), c, n, f, rc); };
  const long = rc.len === 'long', short = rc.len === 'short', out = [say('open' + band)];
  if (rc.grade && f.grade != null) out.push(say('grade'));
  if (!short && f.strong) out.push(say('strong', f.strong.name));
  if (long && f.best) out.push(say('best'));
  if (!short && Math.abs(f.move) >= 5) out.push(say(f.move > 0 ? 'up' : 'down'));
  if (f.weak) out.push(say('next', f.weak.name));
  if (long && f.weak && f.words) out.push(say('level', f.weak.name));
  if (f.missing.length) out.push(say(f.missing.length === 1 ? 'missing1' : 'missing'));
  if (!short && band !== 'None') out.push(say('close' + band));
  return out.join(' ');
}
// What a student's box holds: what she typed if she has, else the draft.
function rptText(c, cols, conf, n, rc) { const e = rptEntry(c, n); return e.text != null ? e.text : rptDraft(c, n, rptFacts(c, cols, conf, n), rc, e.v); }
const rptState = e => e.done ? ['ok', 'Done'] : e.text != null ? ['on', 'Edited'] : ['', 'Draft'];

/* ---------- the page ---------- */
function rptFactChips(f) {
  const one = v => fmtNum(Math.round(v * 10) / 10), out = [];
  out.push('<span class="schip">' + (f.chip ? esc(f.chip) : f.grade != null ? 'Grade ' + pctAvgText(f.grade) + (f.soFar ? ' so far' : '') : 'No grade yet') + '</span>');
  if (f.strong) out.push('<span class="schip">Strongest: ' + esc(f.strong.name) + ' ' + one(f.strong.avg) + '</span>');
  if (f.weak) out.push('<span class="schip">To work on: ' + esc(f.weak.name) + ' ' + one(f.weak.avg) + '</span>');
  if (Math.abs(f.move) >= 5) out.push('<span class="schip">Last three scores ' + (f.move > 0 ? 'up ' : 'down ') + Math.abs(Math.round(f.move)) + '</span>');
  if (f.missing.length) out.push('<span class="schip warn">Missing ' + f.missing.length + '</span>');
  if (!f.scored) out.push('<span class="schip">Nothing scored in this term yet</span>');
  return out.join('');
}
function rptCount(text, rc) {
  const n = [...text].length;
  return rc.limit ? '<span class="' + (n > rc.limit ? 'rptover' : '') + '">' + n + ' of ' + rc.limit + ' characters' + (n > rc.limit ? ', ' + (n - rc.limit) + ' over' : '') + '</span>' : n + ' characters';
}
function rptView(c, cols, conf) {
  const rc = rptConf(), names = c.names;
  rpt.stu = Math.max(0, Math.min(names.length - 1, rpt.stu));
  const n = names[rpt.stu], f = rptFacts(c, cols, conf, n), e = rptEntry(c, n), text = e.text != null ? e.text : rptDraft(c, n, f, rc, e.v), done = names.filter(x => rptEntry(c, x).done).length;
  const seg = '<div class="pseg" role="group" aria-label="Length">' + RPT_LEN.map(([k, l]) => '<button data-rptlen="' + k + '" aria-pressed="' + (rc.len === k) + '">' + l + '</button>').join('') + '</div>';
  const list = names.map((x, i) => { const s = rptState(rptEntry(c, x)); return '<button class="rptrow' + (i === rpt.stu ? ' on' : '') + '" data-rptstu="' + i + '"' + (i === rpt.stu ? ' aria-current="true"' : '') + '><span class="rptnum">' + (i + 1) + '</span><span class="rptnm" data-raw>' + esc(bkWho(x, i)) + '</span><span class="schip ' + s[0] + '">' + s[1] + '</span></button>'; }).join('');
  const said = f.said.length ? '<section class="rptsaid"><h3 class="ovh3">What you wrote on their papers</h3>' + f.said.map((s, i) => '<div class="rptq"><div data-raw><b>' + esc(s.work) + '</b><p>' + esc(s.text) + '</p></div><button class="btn sm" data-rptadd="' + i + '" title="Add this to the end of the comment">Add</button></div>').join('') + '</section>' : '';
  return '<div class="bkpad rpt" id="rpt">' +
    '<div class="rptopts"><label>Subject <input type="text" id="rptSubj" value="' + esc(rc.subj[c.id] || '') + '" placeholder="e.g. English" maxlength="60" title="How the subject is named in a comment. Leave it empty to leave the subject out."></label>' +
      '<span class="rptlab">Length ' + seg + '</span><label class="rptck"><input type="checkbox" id="rptGrade"' + (rc.grade ? ' checked' : '') + '> Say the grade</label>' +
      '<label>Limit <input type="number" id="rptLimit" min="0" step="50" value="' + (rc.limit || '') + '" placeholder="none" title="The most characters your report system takes. Leave it empty for no limit."> characters</label>' +
      '</div>' +
    '<p class="muted rptnote">Each draft is put together on this computer from your own scores and comments. No AI writes it, and nothing is sent anywhere. Change any of it: it is your comment.</p>' +
    '<div class="rptgrid"><nav class="rptlist" aria-label="Students"><div class="rptdone" id="rptDone">' + done + ' of ' + names.length + ' done</div>' + list + '</nav>' +
    '<section class="rptone"><div class="rpthead"><h3 id="rptName" data-raw>' + esc(bkWho(n, rpt.stu)) + '</h3><span class="muted">' + (rpt.stu + 1) + ' of ' + names.length + '</span><span class="sp"></span>' +
      '<label>Called <input type="text" id="rptCall" value="' + esc(rptCall(c, n)) + '" maxlength="40" title="The name used in the comment"></label>' +
      '<label>Pronoun <select id="rptPro" class="btn sm">' + RPT_PROS.map(([k, l]) => '<option value="' + k + '"' + (rptPro(c, n) === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label></div>' +
      '<div class="rptfacts" id="rptFacts">' + rptFactChips(f) + '</div>' +
      '<textarea id="rptText" rows="7" aria-label="' + esc('Report comment for ' + bkWho(n, rpt.stu)) + '" spellcheck="true">' + esc(text) + '</textarea>' +
      '<div class="rptfoot"><span class="muted" id="rptCount">' + rptCount(text, rc) + '</span><span class="sp"></span><button class="btn sm" data-rptagain title="The same facts in other words">Draft again</button><button class="btn sm" data-rptcopy>Copy</button>' +
      (e.done ? '<button class="btn sm" data-rptundone>Not done yet</button><button class="btn primary" data-rptnext>Next student</button>' : '<button class="btn primary" data-rptdoit>Done, next student</button>') + '</div>' + said +
    '</section></div></div>';
}
// What she has typed is kept as she types, without drawing the page again under her.
// rpt.dirty holds the words not yet saved, with whose they are, so they are kept even when the page has moved on by then.
function rptKeep(now) {
  clearTimeout(rpt.saveT);
  const go = () => { const d = rpt.dirty; if (!d) return; rpt.dirty = null; if (!lib.classes.includes(d.c) || !d.c.names.includes(d.n)) return; rptPut(d.c, d.n, { text: d.text, t: Date.now() }, d.term); if ($('#rpt') && bkClass() === d.c) rptMarks(d.c); };
  if (now) go(); else rpt.saveT = setTimeout(go, 400);
}
function rptTyped(ta) { const c = bkClass(); rpt.dirty = { c, n: c.names[rpt.stu], term: rptTerm(), text: ta.value }; }
// The list's chips and the count, brought up to date in place.
function rptMarks(c) {
  for (const b of document.querySelectorAll('#rpt [data-rptstu]')) { const s = rptState(rptEntry(c, c.names[+b.dataset.rptstu])), chip = b.querySelector('.schip'); chip.className = 'schip ' + s[0]; chip.textContent = s[1]; }
  const d = $('#rptDone'); if (d) d.textContent = c.names.filter(x => rptEntry(c, x).done).length + ' of ' + c.names.length + ' done';
}
function rptGo(i) { rptKeep(true); rpt.stu = i; bkDraw(); const ta = $('#rptText'); if (ta) ta.focus({ preventScroll: true }); const on = $('#rpt .rptrow.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
function rptAll(c) {
  const conf = ibConf(c, bkConf()), all = bkClassCols(c, bk.cols), cols = bk.term === '*' ? all : all.filter(x => x.termId === bk.term), rc = rptConf();
  return c.names.map(n => [n, rptText(c, cols, conf, n, rc)]);
}
// The term bar's buttons while this tab is on (bkDraw puts them there).
const rptBar = () => '<button class="btn sm" data-rptwords>Wording…</button><button class="btn sm" data-rptcopyall title="Every student’s name and comment, to paste into a spreadsheet or your report system">Copy all</button><button class="btn sm" data-rptcsv title="A spreadsheet file with every student’s name and comment">Download</button><button class="btn sm" data-pssall title="One page per student, with this comment, to print for parent meetings">Progress sheets</button>';
function rptClick(e) {
  if (!$('#rpt') || !e.target.closest('#bkBody')) return;
  const b = e.target.closest('button'), c = bkClass(); if (!b || !c) return;
  const d = b.dataset, n = c.names[rpt.stu], ta = $('#rptText');
  if (d.rptstu != null) return rptGo(+d.rptstu);
  if (d.rptlen) { rptKeep(true); rptSave({ len: d.rptlen }); return bkDraw(); }
  if (d.rptagain != null) {
    const was = rptEntry(c, n), wasText = ta.value;
    rpt.dirty = null; rptPut(c, n, { text: null, done: false, v: ((was.v || 0) + 1) % 60, t: Date.now() }); bkDraw();
    return toastDo(was.text != null ? 'Drafted again. What you had typed is gone.' : 'Drafted again.', 'Undo', () => { rptPut(c, n, { text: was.text != null ? wasText : null, done: was.done, v: was.v || null }); bkDraw(); });
  }
  if (d.rptcopy != null) return navigator.clipboard.writeText(ta.value).then(() => toast('Copied.'), () => toast('Copying didn’t work in this browser.'));
  if (d.rptdoit != null || d.rptnext != null) {
    if (d.rptdoit != null) { rpt.dirty = null; rptPut(c, n, { text: ta.value, done: true, t: Date.now() }); }
    const left = c.names.map((x, i) => i).filter(i => !rptEntry(c, c.names[i]).done), next = left.find(i => i > rpt.stu);
    if (!left.length) { bkDraw(); return toast('Every comment is done. Copy all puts them on the clipboard.', 6000); }
    return rptGo(next != null ? next : d.rptnext != null && rpt.stu < c.names.length - 1 ? rpt.stu + 1 : left[0]);
  }
  if (d.rptundone != null) { rptPut(c, n, { done: false }); return bkDraw(); }
  if (d.rptadd != null) {
    const conf = ibConf(c, bkConf()), all = bkClassCols(c, bk.cols), cols = bk.term === '*' ? all : all.filter(x => x.termId === bk.term), s = rptFacts(c, cols, conf, n).said[+d.rptadd]; if (!s) return;
    ta.value = (ta.value.trim() ? ta.value.trim() + ' ' : '') + s.text; rptTyped(ta); rptKeep(true); $('#rptCount').innerHTML = rptCount(ta.value, rptConf()); return ta.focus();
  }
  if (d.rptcopyall != null) { rptKeep(true); return navigator.clipboard.writeText(rptAll(c).map(r => tsvLine(r)).join('\n')).then(() => toast('Copied ' + people(c.names.length, 'comment') + ', each with its student’s name. Paste them into a spreadsheet.', 6000), () => toast('Copying didn’t work in this browser.')); }
  if (d.rptcsv != null) { rptKeep(true); return saveBlob(c.name + ' report comments.csv', new Blob(['﻿Student,Comment\r\n' + rptAll(c).map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' })); }
  if (d.rptwords != null) { rptKeep(true); return rptWordsDlg(); }
}
function rptInput(e) {
  const t = e.target, c = bkClass(); if (!c || !t.closest || !t.closest('#rpt')) return;
  if (t.id === 'rptText') { rptTyped(t); $('#rptCount').innerHTML = rptCount(t.value, rptConf()); rptKeep(); }
}
function rptChange(e) {
  const t = e.target, c = bkClass(); if (!c || !t.closest || !t.closest('#rpt')) return;
  const n = c.names[rpt.stu];
  if (t.id === 'rptText') return rptKeep(true);
  rptKeep(true);
  if (t.id === 'rptSubj') rptSave({ subj: { ...rptConf().subj, [c.id]: t.value.trim() } });
  else if (t.id === 'rptGrade') rptSave({ grade: t.checked });
  else if (t.id === 'rptLimit') rptSave({ limit: Math.max(0, Math.round(+t.value || 0)) });
  else if (t.id === 'rptCall') { const v = t.value.trim(); setInfo(c, n, { call: v && v !== rptCall({ info: {} }, n) ? v : '' }); bkSaveLib(); }
  else if (t.id === 'rptPro') { setInfo(c, n, { pro: t.value === 'they' ? '' : t.value }); bkSaveLib(); }
  else return;
  bkDraw();
}
// Her own sentences: one way of saying it on each line. An empty box goes back to the built-in ones.
function rptWordsDlg() {
  const rc = rptConf();
  openDlg('<div class="bh"><h2>Wording</h2><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb rptwords" id="rptWords">' +
    '<p class="muted">A draft is built from these sentences. Write each one your way, one on a line. With several lines, students get different ones.</p>' +
    '<p class="muted rptkeys"><b>Words that are filled in:</b> {name} · {they} {them} {their} · {is} {has} · {s} for the verb, as in “{they} work{s}” · {in} for “in English” · {grade} · {row} · {work} · {n} · {list} · {words}. A capital, as in {They}, starts a sentence.</p>' +
    '<div class="rptcuts"><b>Grades:</b> <label>highest from <input type="number" data-rptcut="0" min="0" max="100" value="' + rc.cut[0] + '">%</label><label>good from <input type="number" data-rptcut="1" min="0" max="100" value="' + rc.cut[1] + '">%</label><label>middling from <input type="number" data-rptcut="2" min="0" max="100" value="' + rc.cut[2] + '">%</label></div>' +
    RPT_SLOTS.map(([k, l]) => '<label class="rptslot"><span>' + l + '</span><textarea data-rptslot="' + k + '" rows="' + Math.max(2, ((rc.words[k] || []).length || RPT_WORDS[k].length)) + '">' + esc(((rc.words[k] || []).length ? rc.words[k] : RPT_WORDS[k]).join('\n')) + '</textarea></label>').join('') +
    '</div><div class="bf"><button class="btn" data-rptreset>Use the built-in wording</button><span class="sp" style="flex:1"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-rptsavew>Save</button></div>', true, 'lg');
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-rptreset]')) { for (const t of document.querySelectorAll('[data-rptslot]')) t.value = RPT_WORDS[t.dataset.rptslot].join('\n'); return; }
    if (!e.target.closest('[data-rptsavew]')) return;
    const words = {}; for (const t of document.querySelectorAll('[data-rptslot]')) { const lines = t.value.split('\n').map(s => s.trim()).filter(Boolean); if (lines.length && lines.join('\n') !== RPT_WORDS[t.dataset.rptslot].join('\n')) words[t.dataset.rptslot] = lines; }
    const cut = [...document.querySelectorAll('[data-rptcut]')].map(i => Math.max(0, Math.min(100, +i.value || 0))).sort((a, b) => b - a);
    rptSave({ words, cut }); closeDlg(); if ($('#rpt')) bkDraw(); toast('Saved. Drafts you have not changed use the new wording.');
  };
}
$('#vClass').addEventListener('click', rptClick);
$('#vClass').addEventListener('input', rptInput);
$('#vClass').addEventListener('change', rptChange);
// Leaving the page, or the tab closing, keeps the last words typed.
window.addEventListener('pagehide', () => rptKeep(true));
Object.assign(window.__gs, { rptDraft, rptFacts, rptConf, RPT_WORDS });
