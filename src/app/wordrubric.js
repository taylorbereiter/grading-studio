/* ---------------- scoring on her own Word rubric (what her rubric macros do) ---------------- */
// Click a score box to highlight it; two neighbouring boxes in one criterion = the half point between them.
// The highlighted boxes are added up, the percent comes from the grading scale in the rubric (or Rubric setup),
// halves round up (92.5 → 93), and the score goes into Grading Studio and into the rubric's own Total blank.
const RUB_HL = '#FFF59D';
const cellNum = td => { const m = /(\d+(?:\.\d+)?)/.exec(td.textContent || ''); return m ? +m[1] : null; };
const isShaded = td => { const b = (td.style.backgroundColor || '').replace(/\s/g, ''); return !!b && b !== 'rgb(255,255,255)' && b !== 'transparent' && b !== 'white'; };
// Level headings that read as a scale: short, one number each, and either counting down (4 3 2 1) or each one named (Score 4, Level 3).
// "Paragraph 1, Paragraph 2" and a numbered list (1 2 3) are a student's own table.
const LEVEL_WORD = /(?<![\p{L}])(?:score|level|band|marks?|points?|pts)(?![\p{L}])/iu;
function levelsSure(tds) {
  const txt = tds.map(td => (td.textContent || '').replace(/\s+/g, ' ').trim()), v = tds.map(cellNum);
  if (tds.length < 2 || txt.some(t => t.length > 30 || (t.match(/\d+(?:\.\d+)?/g) || []).length !== 1)) return false;
  return txt.every(t => LEVEL_WORD.test(t)) || (v.every((x, i) => !i || x <= v[i - 1]) && v[0] > v[v.length - 1]);
}
// Assignments where she chose to score with a table in a student's file, until the page is closed.
const wordTabOn = new Set();
// Whether the table found in this file counts as a rubric at all: for a click to score, for its shaded boxes to be offered as a grade, for the Grade sheet
// and the export. Her own rubric always does. A table in a student's file does when it reads as a rubric, when she has said to score with tables in this
// assignment, or when it has already given this student's score. A numbered table in an essay is just the student's table.
function wordTableCounts(f, m) {
  if (f.virtual || f.rubric || m.sure || (batch && wordTabOn.has(batch.id))) return true;
  const st = batch && batch.students.find(x => x.files.includes(f) || (x.gone || []).includes(f)), s = st && rubricScore(m);
  if (!s || s.total == null) return false;
  return (st.grade.reads || {})['w|' + wordTableSays(s.per, m.crits)] === 1 || (!!f.edited && ownGrade(st).total === s.total);
}
function rubricModel(page) {
  let best = null, scale = null;
  for (const t of page.querySelectorAll('table.wt')) {
    if (t.parentElement.closest('table.wt')) continue;
    const rows = [...t.rows].map(r => [...r.cells]);
    if (rows.length < 2) continue;
    // a grading scale table: "12 | 100%", "11 | 95%" …
    const sc = {}; let ns = 0;
    for (const r of rows) if (r.length >= 2) { const a = cellNum(r[0]), b = cellNum(r[1]); if (a != null && b != null && /%/.test(r[1].textContent + r[0].textContent + (rows[0][1] ? rows[0][1].textContent : '')) && b >= 30 && b <= 100) { sc[a] = b; ns++; } }
    if (ns >= 4) { scale = sc; continue; }
    const lvl = v => v != null && v >= 0 && v <= 6;
    // levels down the side (Score 4 / Score 3 … rows, criteria across the top)
    const side = rows.slice(1).map(r => cellNum(r[0]));
    if (side.filter(lvl).length >= 2 && rows[0].length >= 2) {
      const cells = [];
      rows.slice(1).forEach((r, k) => { if (!lvl(side[k])) return; r.slice(1).forEach((td, c) => cells.push({ td, crit: c, val: side[k] })); });
      const crits = rows[0].slice(1).map(td => td.textContent.trim() || 'Criterion');
      const m = { cells, crits, levels: [...new Set(side.filter(lvl))], sure: levelsSure(rows.slice(1).filter((r, k) => lvl(side[k])).map(r => r[0])) };
      if (!best || cells.length > best.cells.length) best = m;
      continue;
    }
    // levels across the top (4 | 3 | 2 | 1 columns, criteria down the side)
    const top = rows[0].map((td, c) => c ? cellNum(td) : null);
    if (top.filter(lvl).length >= 2) {
      const cells = [];
      rows.slice(1).forEach((r, k) => r.forEach((td, c) => { if (c && lvl(top[c])) cells.push({ td, crit: k, val: top[c] }); }));
      const m = { cells, crits: rows.slice(1).map(r => r[0] ? r[0].textContent.trim() : 'Criterion'), levels: [...new Set(top.filter(lvl))], sure: levelsSure(rows[0].filter((td, c) => lvl(top[c]))) };
      if (!best || cells.length > best.cells.length) best = m;
    }
  }
  if (best) { best.scale = scale; best.max = best.crits.length * Math.max(...best.levels); }
  return best;
}
// Worked out each time it's asked for, since Rubric setup can change after the file was read.
const wordPct = (total, max, scale) => total == null ? null : percentWith(total, max, scale || (maxPoints() === max ? setup.scale : null));
function rubricScore(m) {
  const per = m.crits.map((_, i) => { const v = m.cells.filter(c => c.crit === i && isShaded(c.td)).map(c => c.val); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  const done = per.filter(v => v != null);
  const total = done.length ? Math.round(done.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  return { per, total, done: done.length === per.length, pct: wordPct(total, m.max, m.scale) };
}
// Writes the total (and percent) into the rubric's own blank, like "Total: ____ / 12 = ____%", when there is exactly one. True if that changed it.
// filled: only a line that already has a percent in it, which is one that should follow the grading scale. A blank line waits for a click.
function fillTotalBlank(w, page, m, s, filled) {
  const re = new RegExp('(^|[^\\d])([_\\s.\\d]*)\\/\\s*' + m.max + '(?!\\d)');
  const spots = [...page.querySelectorAll('p.wp')].filter(p => !m.cells.some(c => c.td.contains(p)) && re.test(p.textContent) && /score|total|grade|points/i.test((p.closest('td') || p).textContent));
  if (spots.length !== 1) return false;
  const p = spots[0], was = p.textContent;
  if (filled && (s.total == null || !/\d\s*%/.test(was))) return false;
  const sp = [...p.querySelectorAll('[data-ri]')].find(x => re.test(x.textContent)) ;
  if (!sp) return false;
  sp.textContent = sp.textContent.replace(re, (all, a, blank) => a + (blank && /\S/.test(blank) && !/[_\d]/.test(blank) ? blank : ' ') + (s.total == null ? '____' : fmtNum(s.total)) + ' /' + (all.match(/\/(\s*)/)[1] || ' ') + m.max);
  const pc = [...p.querySelectorAll('[data-ri]')].find(x => /[_\d.]*\s*%/.test(x.textContent) && x !== sp) || (/%/.test(sp.textContent) ? sp : null);
  if (pc) pc.textContent = pc.textContent.replace(/([=:]?\s*)[_\d.]*\s*%/, (a, pre) => (pre || '') + (s.pct == null ? '____' : fmtNum(s.pct)) + '%');
  if (p.textContent === was) return false;
  wApplyPara(w, p);
  return true;
}
// The Total line in every Word file she's scored follows the grading scale, as the panel does, so the file that goes back agrees with the gradebook. Goes through them once for each setup that changes a percent.
function wordLinesFollow() {
  if (!batch) return;
  const sig = rubricKey(setup);
  if (batch.lineSig === sig) return;
  const b = batch; b.lineSig = sig; b.lineBusy = true;
  b.lineRun = wordLinesNow(b).catch(e => console.error(e)).finally(() => { b.lineBusy = false; });
}
// Only a file whose score is this student's, since a table in a student's own file isn't her score until she says so.
const wordLineHers = (st, s) => s.total != null && ownGrade(st).total === s.total;
async function wordLinesNow(b) {
  await Promise.all([...wordSaves].map(s => s()));
  let n = 0;
  for (const st of b.students) for (const f of st.files) {
    if (batch !== b) return;
    if (f.kind !== 'docx' || !f.edited) continue;
    const card = [...document.querySelectorAll('.docx')].find(el => el.wordF === f);
    if (card) { if (card.wordLine) card.wordLine(); continue; }   // on screen, and it writes its own; one still opening does it when it's ready
    const w = openWord(f.data), page = document.createElement('div'); page.className = 'dpage'; w.pRuns = []; renderWord(w, page);
    w.pRuns = w.paras.map((_, i) => [...page.querySelectorAll('p[data-pi="' + i + '"] > [data-ri], p[data-pi="' + i + '"] [data-ri]')].map(s => w.runs[+s.dataset.ri]));
    const m = rubricModel(page), s = m && rubricScore(m);
    if (!m || !wordLineHers(st, s) || !fillTotalBlank(w, page, m, s, true)) continue;
    if (!f.orig) f.orig = f.data;
    f.data = wordBytes(w); f.edited = Date.now(); f.size2 = f.data.length;
    wordScore(f);
    await keepEdit(st, f);
    refound(st); n++;
  }
  if (n && batch === b) renderList();
}
// The score panel follows the rubric.
// Out of a different total on a points setup, it stays out of the panel: the whole class's Out of only changes for her own rubric page, or when she says so.
function rubricToGrade(st, s, max, nCrit) {
  if (setup.mode === 'points') { if (+setup.outOf === max) setWordPoints(st, s); }
  else if (setup.criteria.length === nCrit) { const was = st.grade.rubric; st.grade.rubric = s.per.map(v => v == null ? null : v); s.per.forEach((v, k) => { if ((was[k] ?? null) !== (v ?? null)) touchGrade(st, k); }); }
  else setWordPoints(st, s);
}
// A Word rubric stopped giving a score. What it put in the score panel goes too; a score she gave herself stays.
function wordScoreGone(st, was) {
  if (!was || was.total == null) return;
  const g = st.grade;
  if (setup.mode === 'rubric' && setup.criteria.length === was.per.length) { was.per.forEach((v, k) => { if (v != null && g.rubric[k] === v) { g.rubric[k] = null; touchGrade(st, k); } }); return; }
  if (String(g.points) === String(was.total)) { g.points = ''; touchGrade(st); }
}
function setClassOutOf(max) {
  setup.outOf = max; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined }); if (batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; saveLib(); }
  batch.students.forEach(refound);
  wordLinesFollow();
}
function setClassScale(scale) {
  setup.scale = scale; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined }); if (batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; saveLib(); }
  wordLinesFollow();
}
const scaleDiffers = scale => !!scale && setup.mode === 'points' && JSON.stringify(scale) !== JSON.stringify(setup.scale);
// A Word rubric's score without opening it: the boxes already highlighted, read the same way as on screen.
function wordScore(f) {
  if (f.kind !== 'docx' || !f.data) return null;
  if (f.wsOf === f.data) return f.wscore;
  let s = null;
  try {
    const w = openWord(f.data), page = document.createElement('div'); page.className = 'dpage'; w.pRuns = []; renderWord(w, page);
    const m = rubricModel(page);
    f.wtab = !!m;   // a table that could be a rubric, whether or not it counts as one
    if (m && wordTableCounts(f, m)) s = { ...rubricScore(m), max: m.max, nCrit: m.crits.length, crits: m.crits, scale: m.scale, get pct() { return wordPct(this.total, this.max, this.scale); } };
    f.wtyped = wordTyped(page, m);
    f.wtext = [...page.querySelectorAll('p')].map(p => p.textContent).join('\n') || page.textContent; f.wpic = !!page.querySelector('img');
  } catch (e) { console.error(e); f.wtyped = []; f.wtext = null; }
  f.wsOf = f.data; f.wscore = s;
  return s;
}
// Grades typed in a Word file, like "10/12 = 85%" or "9.5/12". Rubric tables and grading-scale tables are skipped.
function wordTyped(page, m) {
  const rub = m && m.cells.length ? m.cells[0].td.closest('table.wt') : null, out = [];
  const skip = new Set(rub ? [rub] : []);
  for (const t of page.querySelectorAll('table.wt')) if ([...t.querySelectorAll('td')].filter(td => { const g = parseGrade(td.textContent, false); return g && g.rank >= 1; }).length >= 3) skip.add(t);
  for (const p of page.querySelectorAll('p')) {
    const t = p.closest('table.wt'); if (t && [...skip].some(k => k.contains(t))) continue;
    const text = p.textContent.replace(/\s+/g, ' ').trim(); if (!text) continue;
    const g = parseGrade(text, false); if (!g || g.rank < 2) continue;
    // written out as a grade: worked out to a percent ("10/12 = 85%"), or with the word for it right against the number ("Total: 11/12", "10/12 points")
    const asGrade = (g.rank === 3 && !(g.loose && !g.eq && g.outOf == null)) || (g.at != null && (GRADE_BEFORE.test(text.slice(0, g.at)) || GRADE_AFTER.test(text.slice(g.at + g.len))));
    out.push({ rank: g.rank, loose: g.loose, eq: g.eq, several: g.several, counts: g.counts, score: g.score, outOf: g.outOf, pct: g.pct, text: text.length > 80 ? text.slice(0, 80) + '…' : text, word: true, asGrade });
  }
  return out;
}
// Shaded boxes in a Word table, as a reading for her to confirm. It could be her rubric or a student's own table, and only she can tell.
const wordTableSays = (per, crits) => { const t = 'Shaded boxes in a table: ' + per.map(v => v == null ? '–' : fmtNum(v)).join(', ') + ' (' + crits.join(', ') + ')'; return t.length > 140 ? t.slice(0, 140) + '…' : t; };
function wordTableRead(f) {
  const w = f.wscore;
  return { rank: 3, score: w.total, outOf: w.max, pct: w.pct, table: true, word: true, text: wordTableSays(w.per, w.crits) };
}
// What a Word file adds to the grade sheet: highlighted boxes, otherwise a grade typed in it. A student wrote all of that, so all of it waits for her.
// Her own Word rubric page isn't a student's: its boxes score it directly (wordScoresAll), and only what she has typed into her copy counts.
// A number a student typed in an essay is a date or a count far more often than a grade ("10/12", "3/4 of the village"), so in their own file only one
// written out as a grade is offered. One she has already said yes to stays (st: whose file it is).
const wordFound = (f, st) => {
  if (f.kind !== 'docx' || f.wsOf !== f.data) return [];
  if (f.wscore && f.wscore.total != null) return f.virtual ? [] : [wordTableRead(f)];
  if (f.virtual) return f.edited ? f.wtyped || [] : [];
  const rd = (st && st.grade && st.grade.reads) || {};
  return (f.wtyped || []).filter(g => g.asGrade || rd[readKey(g)] === 1).map(g => ({ ...g, theirs: true }));
};
// Every student's Word rubrics: a rubric already highlighted gives the score, like opening it would.
function wordScoresOf(st) { for (const f of st.files) wordScore(f); }
function wordScoresAll() {
  if (!batch) return;
  let n = 0;
  let asks = 0;
  for (const st of batch.students) { wordScoresOf(st); if (st.files.some(f => wordFound(f, st).length)) { refound(st); asks++; } }
  for (const st of batch.students) for (const f of st.files) {
    const s = wordScore(f); if (!s || s.total == null) continue;
    if (f.virtual) {   // her own rubric page, so the assignment follows it
      if (scaleDiffers(s.scale)) setClassScale(s.scale);
      if (!hasOwnScore(st) && setup.mode === 'points' && +setup.outOf !== s.max) setClassOutOf(s.max);
    } else if ((st.grade.reads || {})[readKey(wordTableRead(f))] !== 1) continue;   // a table in a student's file waits for her OK
    if (!hasOwnScore(st)) { rubricToGrade(st, s, s.max, s.nCrit); n++; }
  }
  if (n) { saveSoon(); renderList(); renderGrade(); }
  else if (asks) renderList();
  wordLinesFollow();
}
function wireRubric(st, f, w, page, el, soon) {
  const m = rubricModel(page); if (!m) return;
  for (const c of m.cells) { c.td.classList.add('rcell'); c.td.title = 'Click to highlight this score (two neighbouring boxes = half point)'; }
  const info = document.createElement('div'); info.className = 'rinfo'; el.insertBefore(info, page.closest('.wdoc') || page);
  const show = s => {
    info.innerHTML = '<b>' + (s.total == null ? '–' : fmtNum(s.total)) + '</b> / ' + m.max + (s.pct != null ? ' <b style="color:var(--accent)">' + fmtNum(s.pct) + '%</b>' : '') +
      '<span class="muted">' + m.crits.map((c, i) => esc(c.length > 24 ? c.slice(0, 24) + '…' : c) + ' ' + (s.per[i] == null ? '–' : fmtNum(s.per[i]))).join(' · ') + '</span>' +
      (s.done ? '' : '<span class="muted">Click a score box in each criterion</span>') +
      (setup.mode === 'rubric' && m.max !== maxPoints() ? '<span class="sc-warn" style="width:100%">This rubric is out of ' + m.max + ', but Rubric setup is out of ' + maxPoints() + ', so the score panel won’t match it. To score from this rubric, choose Just the total in Rubric setup.</span>' : '');
  };
  const push = (s, write) => {
    show(s);
    if (s.total == null) wordScoreGone(st, last); else rubricToGrade(st, s, m.max, m.crits.length);
    last = s;
    if (write && s.total != null && ownGrade(st).total != null) liftStatus(st);
    if (write && fillTotalBlank(w, page, m, s)) soon();
    saveSoon(); renderList(); if (st === batch.students[cur]) renderGrade();
  };
  if (f.virtual && scaleDiffers(m.scale)) setClassScale(m.scale);   // the scale printed on her rubric page wins
  const s0 = rubricScore(m); show(s0);
  let last = s0;   // what this rubric last gave, to take back if it stops giving a score
  el.wordPush = () => push(rubricScore(m), true);
  el.wordShow = () => show(rubricScore(m));
  el.wordLine = () => { const s = rubricScore(m); if (wordLineHers(st, s) && fillTotalBlank(w, page, m, s, true)) soon(); };
  if (f.virtual && s0.total != null && !hasOwnScore(st)) {   // her rubric page, already highlighted, brings its score in
    if (setup.mode === 'points' && +setup.outOf !== m.max) setClassOutOf(m.max);
    push(s0, false);
  }
  if (f.edited) el.wordLine();
  // A table in a student's file changes nothing for the class unless she says so. Asked once each time the file is opened.
  let asked = !!f.virtual;
  const askClass = async () => {
    if (asked || setup.mode !== 'points') return;
    asked = true;
    const outOf = +setup.outOf !== m.max, scale = scaleDiffers(m.scale);
    if (!outOf && !scale) return;
    const what = outOf ? 'This table adds up to ' + m.max + ', but this assignment is out of ' + setup.outOf + '.\n\nMake the whole class out of ' + m.max + (scale ? ', and use the grading scale in this file' : '') + '?' : 'This file prints its own grading scale, and it isn’t the one this assignment uses.\n\nUse it for the whole class?';
    if (!await askDlg(what, { ok: 'Yes, the whole class', cancel: 'No, leave it' })) return;
    if (scale) setClassScale(m.scale);
    if (outOf) setClassOutOf(m.max);
    renderGrade();
  };
  page.addEventListener('click', async e => {
    if (page.classList.contains('editing')) return;   // while editing, clicks place the cursor; use the color buttons
    const td = e.target.closest('td.rcell'); if (!td) return;
    const c = m.cells.find(x => x.td === td), same = m.cells.filter(x => x.crit === c.crit && x !== c && isShaded(x.td));
    const set = (x, on) => { wShadeCell(w, w.cells[+x.td.dataset.ci], on ? RUB_HL : ''); x.td.style.background = on ? RUB_HL : ''; };
    if (isShaded(td)) set(c, false);
    else {
      // a neighbour already picked makes the half point; anything else in this criterion is replaced
      const keep = same.length === 1 && Math.abs(same[0].val - c.val) === 1;
      for (const x of same) if (!keep) set(x, false);
      set(c, true);
    }
    await askClass();
    push(rubricScore(m), true); soon();
  });
}

