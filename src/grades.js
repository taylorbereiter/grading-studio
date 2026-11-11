/* ---------------- scores: statuses, when a score last changed, partial scores, doubtful readings, the pre-export check, safe CSV ---------------- */
// st.grade.status: '' (none), 'missing', 'excused' or 'late'. Missing and excused have no number; late keeps its score. No penalty is ever worked out.
const STATUS_LABEL = { missing: 'Missing', excused: 'Excused', late: 'Late' };
function noScore(st) { const s = st.grade.status; return s === 'missing' || s === 'excused'; }
const hasSheet = g => g.sheet != null && g.sheet !== '';
// Anything she has put on this student besides files: a score, a comment or a status.
const gradeHasWork = g => !!g && ((g.rubric || []).some(v => v != null) || (g.points != null && g.points !== '') || hasSheet(g) || !!g.comment || !!g.status || !!g.fb || !!+g.xc);
// A score she gave this student, here or typed on the Grade sheet. A highlighted Word rubric doesn't write over it.
const hasOwnScore = st => ownGrade(st).total != null || hasSheet(st.grade);
// The same, in words: 'a score of 10', 'a comment'…
function gradeWords(st) {
  const g = st.grade, own = ownGrade(st).total, out = [];
  if (own != null && !isNaN(own)) out.push('a score of ' + fmtNum(own));
  else if (hasSheet(g)) out.push('a score of ' + g.sheet);
  else if ((g.rubric || []).some(v => v != null) || (g.points != null && g.points !== '')) out.push('a score');
  if (g.comment) out.push('a comment');
  if (g.status) out.push('the status ' + STATUS_LABEL[g.status]);
  return out;
}
const wordsJoin = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
// When this student's score, comment or status last changed, and each rubric row's own time.
function touchGrade(st, rowIndex) {
  const g = st.grade, t = Date.now();
  if (rowIndex !== 'points' && g.at && g.points !== '' && g.points != null && !(g.atR && g.atR.points)) (g.atR ||= {}).points = g.at;   // a points score from before these times were kept: when it last changed is the last we know of
  g.at = t;
  if (rowIndex != null) (g.atR ||= {})[rowIndex] = t;
}
// She gave a real score, so a student marked missing or excused isn't any more.
function liftStatus(st) {
  if (!noScore(st)) return;
  const was = st.grade.status;
  st.grade.status = ''; touchGrade(st);
  toast('No longer marked ' + was);
}
function scoreTouched(st, rowIndex) {
  touchGrade(st, rowIndex != null ? rowIndex : 'points');
  if (st.found !== undefined) refound(st);   // a table is only quiet while her score matches it
  const g = st.grade, has = rowIndex != null ? g.rubric[rowIndex] != null : g.points !== '' || hasSheet(g);
  if (has) liftStatus(st);
}
function setStatus(st, s) {
  st.grade.status = (st.grade.status || '') === s ? '' : s;
  touchGrade(st); saveSoon(); renderGrade(); renderList();
}
// Missing, Excused, Late, and a ⋯ for what is used now and then: leaving this paper out of the average, and the calculator.
function statusHtml(st, plain) {
  const on = st.grade.status || '', out = !!st.grade.outAvg;
  return '<div id="gstat"><div class="gstat"><span class="seg" role="group" aria-label="Mark as">' + Object.keys(STATUS_LABEL).map(k => '<button data-status="' + k + '" aria-pressed="' + (on === k) + '">' + STATUS_LABEL[k] + '</button>').join('') + '</span>' +
    (plain ? '' : kmWrap('⋯', 'class="btn sm kdots" id="gMore" aria-label="More for this score" title="More for this score"',
      (noScore(st) ? '' : '<button class="outsw" id="outAvg" role="switch" aria-checked="' + out + '"><i></i><span><b>Leave out of the average</b><small>The score stays and still copies. It doesn’t count in the average or on the Insights tab.</small></span></button>') +
      (noScore(st) ? '' : '<button class="mitem" data-gxc>Extra credit points</button>') +
      '<button class="mitem" data-gcalc>Calculator <kbd>=</kbd></button>', 'right')) + '</div>' +
    (out && !noScore(st) && !plain ? '<p class="outnote">Left out of the average. <button class="link" data-outoff>Count it again</button></p>' : '') + (plain ? '' : xcHtml(st)) + '</div>';
}
/* ---------------- extra credit on one paper ---------------- */
// st.grade.xc: points on top of the score (half points, like any score), or with st.grade.xcU 'pct' percentage points on its percent. It shows as its own line under the score so it's never mistaken
// for what the paper earned; gradeOf adds it in (start.js addXc). xcOpen: the paper whose box is open before it has any extra credit.
let xcOpen = null, xcUnit = store.get('gs.xcU', 'pts') === 'pct' ? 'pct' : 'pts';   // the last unit picked, on this computer, for the next paper
// Points or %: the number stays, what it means changes.
function xcUnitSet(st, u) {
  xcUnit = u; store.set('gs.xcU', u);
  if (st.grade.xc) { if (u === 'pct') st.grade.xcU = 'pct'; else delete st.grade.xcU; touchGrade(st); saveSoon(); renderList(); }
  renderGrade();
}
function xcHtml(st) {
  const v = +st.grade.xc || 0;
  if (noScore(st) || (!v && xcOpen !== st)) return '';
  const u = st.grade.xc ? (st.grade.xcU === 'pct' ? 'pct' : 'pts') : xcUnit;
  return '<p class="xcnote" id="xcNote"><label>Extra credit <input type="number" id="xcIn" step="0.5" min="0" value="' + (v ? fmtNum(v) : '') + '" aria-label="Extra credit ' + (u === 'pct' ? 'percent' : 'points') + '"></label><span class="pseg sm" role="group" aria-label="Extra credit in">' + [['pts', 'points'], ['pct', '%']].map(([k, l]) => '<button data-xcu="' + k + '" aria-pressed="' + (u === k) + '">' + l + '</button>').join('') + '</span><span class="sp"></span><button class="link" data-xcoff>Remove</button></p>';
}
function xcStart(st) {
  xcOpen = st; const gs = $('#gstat'); if (gs) gs.outerHTML = statusHtml(st);
  const i = $('#xcIn'); if (i) { i.focus(); i.select(); }
}
function xcSet(st, raw, redraw) {
  const v = raw === '' || raw == null || isNaN(+raw) ? 0 : Math.max(0, Math.round(+raw * 2) / 2);
  if ((+st.grade.xc || 0) === v) { if (redraw) { if (!v) xcOpen = null; renderGrade(); } return; }
  if (v) { if (!(+st.grade.xc > 0)) { if (xcUnit === 'pct') st.grade.xcU = 'pct'; else delete st.grade.xcU; } st.grade.xc = v; }   // a new one takes the unit showing
  else { delete st.grade.xc; delete st.grade.xcU; if (redraw) xcOpen = null; }
  touchGrade(st); saveSoon(); renderList();
  if (redraw) renderGrade(); else { const t = $('#grade .total'); if (t) t.innerHTML = totalHtml(st); }
}
// Left out of the average: for a one-off case, a placeholder 0, or a paper graded somewhere else. Nothing about the score changes.
function setOutAvg(st) {
  if (st.grade.outAvg) delete st.grade.outAvg; else st.grade.outAvg = true;
  touchGrade(st); saveSoon(); renderGrade(); renderList();
}

/* ---------------- partial scores ---------------- */
// The Word rubric behind a points score, when it isn't fully highlighted yet.
function wordPart(st, total) {
  return (st.files || []).map(f => f.kind === 'docx' && f.wsOf === f.data ? f.wscore : null).find(w => w && !w.done && w.total === total) || null;
}
function setWordPoints(st, s) {
  const v = String(s.total);
  if (String(st.grade.points) !== v) touchGrade(st, 'points');
  st.grade.points = v;
}
function partNote(st) {
  if (setup.mode !== 'rubric' && quizPart(st)) return quizCount(st) + ' of ' + batch.quiz.qs.length + ' questions marked in Quick mark';
  const w = setup.mode === 'rubric' ? null : wordPart(st, +st.grade.points);
  const per = w ? w.per : setup.criteria.map((_, i) => st.grade.rubric[i]);
  return per.filter(v => v != null).length + ' of ' + per.length + ' rows scored';
}
// Rubric rows of a student marked missing or excused aren't shown or sent anywhere; they come back if the mark comes off.
const rowShown = (st, i) => noScore(st) ? null : st.grade.rubric[i];
// The total, with what it's out of when that isn't this assignment's: a confirmed 10/15 must not paste as a 10 out of 12.
const totalText = g => fmtNum(g.total) + (g.outOf != null ? ' out of ' + fmtNum(g.outOf) : '');
// k: 'total', 'pct', or 'any' for the total or else the percent. What a bulk copy puts in the student's place.
function scoreText(g, k) {
  if (g.status === 'missing' || g.status === 'excused') return STATUS_LABEL[g.status];
  const v = k === 'pct' ? g.pct : k === 'total' ? g.total : g.total != null ? g.total : g.pct;
  return (k === 'any' && g.total == null ? fmtPct(v) : k === 'pct' || g.total == null ? fmtNum(v) : totalText(g)) + (g.partial && v != null ? ' (partial)' : '');
}
// The same in a table, where the Status column says missing or excused and the number stays blank.
const cellOut = (g, k) => g.total == null && g.pct == null ? '' : scoreText(g, k);
// A single click in the Grades list copies the plain value, ready to paste.
const cellCopy = (g, k) => g.status === 'missing' || g.status === 'excused' ? (k === 'total' ? STATUS_LABEL[g.status] : '') : k === 'pct' ? fmtNum(g.pct) : totalText(g);
function statusText(st) {
  const g = gradeOf(st), out = [];
  if (g.status) out.push(STATUS_LABEL[g.status]);
  if (g.out) out.push('Left out of the average');
  if (g.partial) out.push('Partial: ' + partNote(st));
  return out.join(', ');
}
function statusPills(g) {
  return (g.status ? ' <span class="stag">' + STATUS_LABEL[g.status].toLowerCase() + '</span>' : '') + (g.out ? ' <span class="stag out">left out</span>' : '') + (g.partial ? ' <span class="stag">partial</span>' : '');
}
function gradesSummary() {
  const all = batch.students, on = all.filter(s => !noScore(s)), nOff = all.length - on.length, nPart = on.filter(s => gradeOf(s).partial).length;
  return on.filter(s => gradeOf(s).done).length + ' of ' + on.length + ' scored' + (nPart ? ' · ' + nPart + ' partial' : '') + (nOff ? ' · ' + nOff + ' missing or excused' : '');
}
// Every warning before a copy asks here.
const gradesAsk = text => askDlg(text, { ok: 'Copy anyway', cancel: 'Don’t copy' });
// Before copying a whole list: true to go ahead.
async function okPartial(sts) {
  const part = sts.filter(st => gradeOf(st).partial);
  if (!part.length) return true;
  const names = part.slice(0, 8).map(st => shownName(st, batch.students.indexOf(st))).join(', ') + (part.length > 8 ? ' and ' + (part.length - 8) + ' more' : '');
  return gradesAsk((part.length === 1 ? '1 student has' : part.length + ' students have') + ' only part of the rubric scored: ' + names + '.\n\nThose totals aren’t final. They’ll say “(partial)” in what you copy.\n\nCopy anyway?');
}
async function okCellPartial(i, val) {
  const st = batch.students[i];
  return gradesAsk(shownName(st, i) + ': ' + partNote(st) + ', so ' + val + ' isn’t final.\n\nCopy it anyway?');
}

/* ---------------- safe spreadsheets ---------------- */
// A cell starting with = + - or @ runs as a formula when the file is opened in a spreadsheet, so a name or comment could do damage.
// A leading apostrophe makes it plain text. Numbers like 9.5 never need it.
function csvSafe(v) {
  const t = String(v);
  return /^[\s 　]*[=+\-@＝＋－＠]/.test(t) || /^[\t\r\n]/.test(t) ? "'" + t : t;
}
function csvCell(v) {
  const t = csvSafe(v);
  return /[",;\n\r\t]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
const tsvLine = cells => cells.map(c => csvSafe(c).replace(/[\t\r\n]+/g, ' ')).join('\t');

/* ---------------- doubtful readings of a grade on the paper ---------------- */
// These only ever work when the word sits right against the number on the same line, or is a label alone on the line above it. A sentence or a line that ends first says nothing about it.
// Words right before a number that say it's a date, a page or a question: "Due 10/12", "page 3/12". Words that could as easily end a comment ("best part 10/12") aren't here: those get asked about.
const NOT_A_GRADE = /(?:(?:^|[^\p{L}])(?:(?:due|dates?|dated|by|on|until|till|before|after|since|from|mon|tues?|wed|thu|thur|thurs|fri|sat|sun|pages?|questions?|turned in|handed in|submitted|posted)[ \t]*[:\-–—]?|(?:pgs?|pp?|ques|qu?)\.?)[ \t]*#?|#)[ \t]*$/iu;
// Words that say it is the grade: "Total 11/12", "Your grade: 10/12", "10/12 points".
const GRADE_BEFORE = /(?:^|[^\p{L}])(?:total|grade|score|scored|final|points|pts?|marks?|result|overall|rubric)(?:[ \t]+(?:is|was|of))?[ \t]*[:=\-–—(]?[ \t]*$/iu;
const GRADE_ABOVE = /(?:^|\n)[ \t]*(?:(?:your|final|total|overall)[ \t]+)?(?:total|grade|score|final|points|pts?|marks?|result|overall|rubric)[ \t]*[:=\-–—(]?[ \t]*\n[ \t]*$/iu;
const GRADE_AFTER = /^[ \t:\-–—]*(?:total|points?|pts?|marks?|overall)[ \t]*(?:[^\p{L}\d \t]|$)/iu;
// Words right after a number that say it counts something else: "3/12 sources cited", "90% of the class", "5/12 correct". A short list on purpose: "10/12 shows growth" or "10/12 thanks" could be another grade, and a question she didn't need costs less than a grade she never saw. So words that read as a verb here ("10/12 quotes the text", "10/12 right now") get asked about too.
const COUNTS_AFTER = /^[ \t]*(?:of\b|(?:correct|right|wrong|sources|quotes|quotations|citations|references|sentences|paragraphs|pages|words|lines|questions|problems|items|answers|responses|errors|mistakes|examples|students|people|parts|sections|criteria|requirements|tasks|steps|claims|details|ideas|reasons|arguments)\b(?![ \t]*(?:\?|(?:now|the|an?|your|more|well)\b)))/iu;
// Words right before a number that say it's another go at the grade: "Rewrite 10/12", "Revised: 10/15". It's never a count or a part, whatever follows it.
const REDONE_BEFORE = /(?:^|[^\p{L}])(?:re-?writes?|re-?written|revised|revisions?|re-?do(?:ne)?|re-?submi\p{L}+|drafts?|now|new|updated)[ \t]*[:=\-–—(]?[ \t]*$/iu;
// no: never a grade. loose: other words sit around it, so it may not be one. eq: worked out to a percent, so it's a grade unless date or page words sit right against it; then it's only asked about.
function gradeContext(before, after, text) {
  const eq = /=|→|->/.test(text);
  if (NOT_A_GRADE.test(before)) return { no: !eq, loose: true, eq: false };
  return { no: false, eq, loose: /[\p{L}\d]/u.test(before + after) && !GRADE_BEFORE.test(before) && !GRADE_ABOVE.test(before) && !GRADE_AFTER.test(after) };
}
// A number with no slash or percent looks like a grade only with a label against it ("Revised: 10", "Score 10", "Rewrite 10 points") or points right after it ("10 points"). Most numbers in a comment are neither.
const TAKEN_TO_BEFORE = /(?:→|->|(?:^|[^\p{L}])(?:revised|raised|changed|moved)[ \t]+to)[ \t]*$/iu;
const WORD_MAY_FOLLOW = /(?:[:=\-–—(]|(?:^|[^\p{L}])(?:re-?writes?|re-?written|revised|re-?do(?:ne)?|re-?submi\p{L}+|updated|score|scored))[ \t]*$/iu;   // "Revised: 10 shows growth", but not "Grade 10 English" or "Draft 2 looks better"
const DOCKED_BEFORE = /(?:[-−+]|(?:^|[^\p{L}])(?:lost|lose|loses|losing|minus|plus|missing|deduct\p{L}*|takes?|took|taking|another|extra|bonus|worth|each|per|more|less)[ \t]+)$/iu;   // "Lost 2 points", "-2 pts"
const PART_BEFORE = /(?:^|[.!?;,\n])[ \t]*\p{L}+[ \t]*[:\-–—]?[ \t]*$/u;   // "Thesis 3 points", "Evidence: 4 pts"
function labelledNumber(before, after) {
  if (!GRADE_BEFORE.test(before) && !GRADE_ABOVE.test(before) && !REDONE_BEFORE.test(before) && !TAKEN_TO_BEFORE.test(before)) return GRADE_AFTER.test(after) && !DOCKED_BEFORE.test(before) && !PART_BEFORE.test(before);
  return !COUNTS_AFTER.test(after) && (!/^[ \t]*\p{L}/u.test(after) || GRADE_AFTER.test(after) || WORD_MAY_FOLLOW.test(before));
}
// Why a reading needs her OK, in plain words. Empty when it can stand on its own.
function readingDoubt(g) {
  if (g.rank == null) return '';   // a Word rubric's own highlighted score
  const max = maxPoints();
  if (g.several) return 'This comment has more than one grade in it, so check this is the one you want.';
  if (g.score != null && g.outOf != null && g.score > g.outOf) return 'The score is more than it’s out of.';
  if (g.pct != null && g.pct > 110) return 'That percent is over 100.';
  if (g.outOf != null && g.outOf !== max) return 'It’s out of ' + fmtNum(g.outOf) + ', but this assignment is out of ' + max + '.';
  if (g.score != null && max && g.score > max) return 'That’s more than the ' + max + ' points this assignment is out of.';
  if (g.table) return 'These are shaded boxes in a Word table. Use it if this is your rubric. It may be the student’s own table.';
  if (g.theirs) return g.word ? 'It’s typed in the student’s Word file, so they may have typed it themselves.' : 'It’s part of the page’s own text, so the student may have typed it. A flattened Kami grade looks the same.';
  if (g.boxed) return '';   // she drew the box around it
  if (g.rank === 0.5 && g.score < max / 2) return 'A number on its own, this small, may not be the total.';
  if (g.loose && !g.eq) return 'It’s inside a longer comment, so it may not be the grade.';
  return '';
}
// Her answer lives in st.grade.reads: 1 use it, 0 not a grade. Keyed by page and words, so a changed comment is asked about again.
const readKey = g => (g.page != null ? g.page : 'w') + '|' + g.text;
// Two or more things on a paper that look like grades, anywhere on it: she has to say, and none of them stands until she does. Something plainly counted ("3/12 sources cited") doesn't look like one.
const rivalReads = st => (st.doubts || []).filter(g => !g.counts);
const readsCount = st => (st.foundAll || []).length + rivalReads(st).length;
const manyReads = st => readsCount(st) > 1;
function splitReads(st, list) {
  const rd = st.grade.reads || {}, out = { ok: [], ask: [], no: [], yes: [], mine: [] };
  for (const g of list) {
    const a = rd[readKey(g)];
    if (g.table && a == null && ownGrade(st).total === g.score) { out.ok.push(g); out.mine.push(g); }   // she scored this table already, by its boxes or from an older copy of the app: nothing to ask, and her score is what counts
    else if (a === 0) out.no.push(g);
    else if (a === 1) { out.ok.push(g); if (readingDoubt(g)) out.yes.push(g); }
    else if (readingDoubt(g)) out.ask.push(g);
    else out.ok.push(g);
  }
  return out;
}
function setReading(st, key, v) {
  const rd = (st.grade.reads ||= {}), was = rd[key];
  const table = st.files.flatMap(f => wordFound(f, st)).find(g => g.table && readKey(g) === key);
  if (v === '') delete rd[key]; else rd[key] = +v;
  if (v === '1') for (const g of [...(st.foundAll || []), ...rivalReads(st)]) if (readKey(g) !== key) rd[readKey(g)] = 0;   // she's picked this one, so the others on the paper aren't the grade
  if (table && was === 1 && v !== '1' && ownGrade(st).total === table.score) { if (setup.mode === 'rubric') st.grade.rubric = []; else st.grade.points = ''; }   // Undo takes back what Use it brought in
  if (table && v === '1') wordScoresAll();   // Use it brings the rows in, when they fit this assignment
  refound(st);
  touchGrade(st);
  if (v === '1') liftStatus(st);
  saveSoon(); renderList();
  if (st === batch.students[cur]) renderGrade();
}
// The buttons beside a doubtful reading on the Grade sheet, and a way back from either answer.
function readsHtml(i, r) {
  const btn = (g, v, t, cls) => '<button class="' + cls + '" data-rd="' + v + '" data-rdi="' + i + '" data-rdk="' + esc(readKey(g)) + '">' + t + '</button>';
  const many = manyReads(batch.students[i]), pick = many ? r.ok.filter(g => !r.mine.includes(g)) : [];   // with more than one on the paper, every one of them gets asked about
  return pick.concat(r.ask).map(g => '<div class="rd-ask"><span class="stag">Is this the grade?</span><b>' + esc(foundLabel(g)) + '</b>' + (g.text ? '<div class="muted">From “' + esc(g.text) + '”</div>' : '') + '<div>' + esc(many && !g.counts ? 'This paper has more than one grade on it, so tell me which one to use.' : readingDoubt(g)) + '</div>' + btn(g, 1, 'Use it', 'btn sm') + btn(g, 0, 'Not a grade', 'btn sm') + '</div>').join('') +
    r.yes.filter(g => !pick.includes(g)).map(g => '<div class="rd-no">You said “' + esc(foundLabel(g)) + '” is the grade. ' + btn(g, '', 'Undo', 'link') + '</div>').join('') +
    r.no.map(g => '<div class="rd-no">You said “' + esc(foundLabel(g)) + '” isn’t a grade. ' + btn(g, '', 'Undo', 'link') + '</div>').join('');
}

/* ---------------- the check before exporting ---------------- */
// A file with no marks at all, that she hasn't chosen to leave out. Recordings and other files can't be marked.
function unmarkedFile(st, f) {
  if (f.virtual) return false;
  if (viewable(f)) {
    if (fileMarked(f)) return false;
    return !layoutOf(st).some(d => !docAuto(st, d) && !docIn(st, d) && d.pages.some(([path]) => path === f.path));
  }
  if (f.kind !== 'docx' || f.edited || f.hand) return false;
  const w = wordScore(f);
  return !(w && w.total != null) && !wordFound(f, st).length;
}
// Her score against what the paper says, or the Word rubric's highlighted score. Empty when they agree or there's nothing to compare.
function disagreeNote(st) {
  const own = ownGrade(st);
  if (own.total == null || own.partial) return '';
  const ps = paperScore(st);
  const many = manyReads(st) ? [...new Set([...(st.foundAll || []), ...rivalReads(st)].filter(g => g.score != null).map(g => g.score))] : [];
  if (many.length && !many.some(v => Math.abs(v - own.total) <= 0.001)) return 'Your score is ' + fmtNum(own.total) + ', the paper says ' + many.map(fmtNum).join(' and ');
  if (ps != null && Math.abs(ps - own.total) > 0.001) return 'Your score is ' + fmtNum(own.total) + ', the paper says ' + fmtNum(ps);
  if (ps == null && st.found && st.found.found && st.found.pct != null && own.pct != null && Math.abs(st.found.pct - own.pct) > 1) return 'Your score is ' + fmtPct(own.pct) + ', the paper says ' + fmtPct(st.found.pct);
  const ws = st.files.map(wordScore).filter(w => w && w.total != null);
  if (ws.length === 1 && Math.abs(ws[0].total - own.total) > 0.001) return 'Your score is ' + fmtNum(own.total) + ', the Word rubric says ' + fmtNum(ws[0].total);
  return '';
}
function exportCheck() {
  const c = { unfinished: [], noPaper: [], disagree: [], unmarked: [], doubts: [] };
  batch.students.forEach((st, i) => {
    if (noScore(st)) return;   // she's already said what's going on with this student
    const g = gradeOf(st), name = shownName(st, i);
    if (!g.done) c.unfinished.push({ i, name, note: g.partial ? 'Partial: ' + partNote(st) : 'Not scored yet' });
    if (!st.files.length) c.noPaper.push({ i, name });
    const d = disagreeNote(st); if (d) c.disagree.push({ i, name, note: d });
    for (const f of st.files) if (unmarkedFile(st, f)) c.unmarked.push({ i, name, note: f.bad ? (anonOn() ? '' : f.name + ': ') + 'it couldn’t be opened, so it won’t be in the export' : anonOn() ? '' : f.name, file: f.path });
    if (g.total != null || g.pct != null) return;   // her own score, or one clear reading, already stands
    if (manyReads(st)) { c.doubts.push({ i, name, note: readsCount(st) + ' grades found on the paper' }); return; }
    for (const r of st.doubts || []) c.doubts.push({ i, name, note: 'Is “' + foundLabel(r) + '” the grade?' });
  });
  return c;
}
function exportCheckHtml(c) {
  const groups = [['Scores not finished', c.unfinished], ['No paper', c.noPaper], ['Scores that disagree with the paper', c.disagree], ['Files with no marks', c.unmarked], ['Grades to confirm', c.doubts, true]].filter(x => x[1].length);
  if (!groups.length) return '<div class="xchk ok" id="xCheck">✓ All clear: everyone is scored, scores match the papers, and every file is marked.</div>';
  const item = (o, sheet) => '<li><button class="link" ' + (sheet && !anonOn() ? 'data-chksheet' : 'data-chk="' + o.i + '"' + (o.file ? ' data-file="' + esc(o.file) + '"' : '')) + '>' + esc(o.name) + '</button>' + (o.note ? ' <span class="muted">' + esc(o.note) + '</span>' : '') + '</li>';
  const n = groups.reduce((a, g) => a + g[1].length, 0);
  // One line until she opens it; the export button stays right under it.
  return '<details class="xchk" id="xCheck"><summary><span><b>' + n + (n === 1 ? ' thing' : ' things') + ' to look at before you return these</b> <span class="muted">(you can still download)</span></span><span class="xshow">Show</span></summary>' +
    '<p class="muted" style="margin:6px 0 0">Click a name to go there.</p>' +
    groups.map(([t, list, sheet]) => '<div class="xgrp" data-group="' + esc(t) + '"><div class="xgt">' + esc(t) + ' (' + list.length + ')</div><ul>' + list.map(o => item(o, sheet)).join('') + '</ul></div>').join('') + '</details>';
}

Object.assign(window.__gs, { touchGrade, setStatus, noScore, setReading, splitReads, readingDoubt, readKey, refound, exportCheck, csvCell, csvSafe, tableHead, tableRow, scoreText, openExport, openGrades, openSheet, rubricToGrade, addStamp, openShare, openBringBack, moveFile });
