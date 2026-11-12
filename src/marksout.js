/* ---------------- Marks only: one Markdown file of scores, comments and every mark, by code, for Claude to spot patterns ---------------- */
// No papers go, so there are no covers to check. Students get the same codes as the ZIP, so Bring back from Claude works with either.
// Names in her text become [name], like the ZIP. Words quoted from a paper come only from its typed text, with names, emails and ID numbers taken out.
const MARKS_OPTS = [
  ['scores', 'Rubric scores, total, percent and status', 'And what each score means on each row, if you wrote it in Rubric setup.'],
  ['comments', 'Your comments and text on the page', 'The comment box, margin comments, text boxes and Kami comments, by page.'],
  ['stamps', 'Proofreading marks and stickers', 'Each one by name and page, plus a count per student: Spelling ×4, Run-on ×2.'],
  ['words', 'The words you highlighted, circled or commented on', 'Only where the paper has typed text. Names, emails and ID numbers are taken out.'],
  ['ink', 'A count of pen marks and checks', 'Drawings can’t be put into words, so they’re counted per page.'],
];
const MARKS_ASK = 'The attached file has my marks for one assignment: rubric scores, my comments and every mark I made, with each student as a code instead of a name. Please read it all first.\n\nThen help me spot patterns across the class: what most students did well, the mistakes that came up again and again, which rubric rows were hardest and why, and anything in my own marking that looks inconsistent. Refer to students only by their code.';
function marksOpts() { const sh = shareState(); return (sh.marksOpt ||= Object.fromEntries(MARKS_OPTS.map(([k]) => [k, true]))); }
const marksFiles = st => st.files.filter(f => viewable(f) && (Object.values(f.marks || {}).some(l => l && l.length) || (f.kami && Object.values(f.kami).some(k => k && k.notes && k.notes.length))));
const marksOnPage = (f, p) => ((f.marks || {})[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []);
const marksPages = f => [...new Set(Object.keys(f.marks || {}).concat(Object.keys(f.kami || {})))].map(Number).filter(p => marksOnPage(f, p).length).sort((a, b) => a - b);
// What the file says about a student who has nothing in it: no marks, no score, no comment.
const marksEmpty = st => !marksFiles(st).length && gradeOf(st).total == null && !noScore(st) && !String(st.grade.comment || '').trim();
// Typed words on a page, each with its box, in page points the way the marks are kept.
async function pageWords(js, f, p) {
  const page = await js.getPage(p + 1), vp = vpRot(f, p, page, 1), out = [];
  for (const it of textItems(await page.getTextContent(), vp)) {
    measureCtx.font = '20px ' + it.font;
    const k = it.w / (measureCtx.measureText(it.str).width || 1);
    for (const w of it.str.matchAll(HL_WORD_RX)) {
      const x0 = it.x + measureCtx.measureText(it.str.slice(0, w.index)).width * k, x1 = it.x + measureCtx.measureText(it.str.slice(0, w.index + w[0].length)).width * k;
      out.push({ s: w[0], x0, x1, top: it.y - 0.82 * it.fh, bot: it.y + 0.24 * it.fh, y: it.y, fh: it.fh });
    }
  }
  page.cleanup();
  return out.sort((a, b) => Math.abs(a.y - b.y) < 0.4 * Math.min(a.fh, b.fh) ? a.x0 - b.x0 : a.y - b.y);
}
const QUOTE_MAX = 220;
// A label like "Name:" says what follows is a name, whatever it is.
const NAME_LABEL = /\b((?:full |student(?:'s)? )?name|student|by)\s*:\s*[^\s,;]+(?:\s+[^\s,;:]+)?/giu;
function quoteOf(words, rx) {
  let t = words.map(w => w.s).join(' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/([(])\s+/g, '$1').trim();
  if (!t) return '';
  t = scrub(t, rx).replace(NAME_LABEL, (m, l) => l + ': [name]');
  return t.length > QUOTE_MAX ? t.slice(0, QUOTE_MAX - 1) + '…' : t;
}
const midIn = (w, r, pad = 1) => { const cx = (w.x0 + w.x1) / 2, cy = (w.top + w.bot) / 2; return cx >= r.x - pad && cx <= r.x + r.w + pad && cy >= r.y - pad && cy <= r.y + r.h + pad; };
const markRects = m => m.rects || (m.w != null ? [{ x: Math.min(m.x, m.x + m.w), y: Math.min(m.y, m.y + m.h), w: Math.abs(m.w), h: Math.abs(m.h) }] : []);
const wordsIn = (words, rects) => words.filter(w => rects.some(r => midIn(w, r, Math.min(4, w.fh * 0.3))));
// The typed line nearest a spot: for a comment's pin or a proofreading mark. Only words near it across, so a long line doesn't all come along.
function lineNear(words, x, y, span = 90) {
  let best = null, bd = 1e9;
  for (const w of words) { const d = y < w.top ? w.top - y : y > w.bot ? y - w.bot : 0; if (d < bd) { bd = d; best = w; } }
  if (!best || bd > best.fh * 1.2) return [];
  return words.filter(w => Math.abs(w.y - best.y) < 0.4 * best.fh && w.x1 >= x - span && w.x0 <= x + span);
}
// Proofreading marks and stickers first, most used first, then the drawn marks.
const INK_KINDS = ['Highlight', 'Circle', 'Pen mark', 'Check'];
const tallyOrder = (a, b) => INK_KINDS.includes(a[0]) - INK_KINDS.includes(b[0]) || b[1] - a[1];
const one = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b || a + 's');
const mdq = t => '"' + one(t).replace(/"/g, '\'') + '"';

// Everything about one student, in the order it's written.
async function marksOf(st, o) {
  const rx = coverRx(st), pages = [], tally = new Map(), count = (k, n = 1) => tally.set(k, (tally.get(k) || 0) + n);
  const files = marksFiles(st);
  for (const [fi, f] of files.entries()) {
    let js = null;
    try {
      const need = o.words && marksPages(f).some(p => marksOnPage(f, p).some(m => ['hl', 'oval', 'note', 'stamp'].includes(m.t)));
      if (need) js = await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise;
      for (const p of marksPages(f)) {
        const words = js ? await pageWords(js, f, p).catch(() => []) : [], lines = [], ink = { pen: 0, check: 0, hl: 0, oval: 0 };
        const on = q => q ? ' on: ' + mdq(q) : '';
        // Down the page, the way she'd read it.
        const at = m => m.t === 'note' ? m.ay : m.rects ? m.rects[0].y : m.y || 0;
        for (const m of marksOnPage(f, p).slice().sort((a, b) => at(a) - at(b))) {
          if (m.t === 'note' && o.comments && one(m.text)) lines.push((m.ro ? 'Kami comment: ' : 'margin comment: ') + mdq(scrub(m.text, rx)) + (o.words ? on(quoteOf(m.hl ? wordsIn(words, m.hl.rects || m.rects || markRects(m.hl)) : lineNear(words, m.ax, m.ay), rx)) : ''));
          else if (m.t === 'text' && o.comments && one(m.text)) lines.push('text on page: ' + mdq(scrub(m.text, rx)));
          else if (m.t === 'stamp') {
            const name = stampName(m.k);
            if (m.k === 'score') { if (o.comments) lines.push('score sticker: ' + mdq(m.text)); continue; }
            count(name);
            if (o.stamps) lines.push(isSticker(m.k) ? 'sticker: ' + name : name + (o.words ? on(quoteOf(lineNear(words, m.x, m.y, 60), rx)) : ''));
          } else if (m.t === 'hl') { ink.hl++; count('Highlight'); if (o.words) { const q = quoteOf(wordsIn(words, markRects(m)), rx); if (q) lines.push('highlighted: ' + mdq(q)); } }
          else if (m.t === 'oval') { ink.oval++; count('Circle'); if (o.words) { const q = quoteOf(wordsIn(words, markRects(m)), rx); if (q) lines.push('circled: ' + mdq(q)); } }
          else if (m.t === 'pen') { ink.pen++; count('Pen mark'); }
          else if (m.t === 'check') { ink.check++; count('Check'); }
        }
        if (o.ink) { const parts = [ink.pen && plural(ink.pen, 'pen mark'), ink.check && plural(ink.check, 'check'), ink.hl && !o.words && plural(ink.hl, 'highlight'), ink.oval && !o.words && plural(ink.oval, 'circle')].filter(Boolean); if (parts.length) lines.push(parts.join(', ')); }
        if (lines.length) pages.push({ label: (files.length > 1 ? 'File ' + (fi + 1) + ', page ' : 'Page ') + (p + 1), lines });
      }
    } finally { if (js) js.destroy(); }
  }
  return { pages, tally };
}

async function marksFileText(onStep) {
  const o = marksOpts(), crit = setup.mode === 'rubric' ? setup.criteria : [], out = [], all = new Map(), byStudent = [];
  const rubric = setup.mode === 'rubric';
  const who = batch.students.filter(st => !marksEmpty(st)), empty = batch.students.filter(marksEmpty);
  let n = 0;
  for (const st of who) {
    const r = await marksOf(st, o);
    for (const [k, v] of r.tally) all.set(k, (all.get(k) || 0) + v);
    byStudent.push({ st, ...r });
    onStep && onStep(++n, who.length);
  }
  out.push('# Marks for ' + aiSay() + ': ' + one(nameFreeText(batch.name)), '');
  out.push(plural(who.length, 'student') + ', each named by a random code (S-XXXX). Names in the teacher’s text became [name].');
  out.push(rubric ? 'Rubric: ' + plural(crit.length, 'row') + ', scored ' + (rowsTop(setup) ? '0 to ' + rowsTop(setup) : setup.criteria.map((_, i) => '0 to ' + rowTop(setup, i)).join(', ')) + (rowHalf(setup) ? ' (half points allowed from 1 up)' : ' (whole numbers only)') + ', out of ' + maxPoints() + '.' : 'Scored in points, out of ' + maxPoints() + '.');
  if (o.scores && rubric) {
    const lv = crit.map((c, i) => { const w = rowLevels(setup, i).map(v => { const t = (setup.levels && setup.levels[i] && setup.levels[i][v]) || ''; return t ? '  - ' + v + ': ' + one(nameFreeText(t)) : ''; }).filter(Boolean); return w.length ? ['- ' + one(nameFreeText(c)), ...w].join('\n') : ''; }).filter(Boolean);
    if (lv.length) out.push('', '## What each score means', ...lv);
  }
  out.push('', '## Class at a glance');
  if (o.scores) {
    const sc = who.map(gradeOf).filter(g => g.total != null && !g.partial && !g.out && g.outOf == null);
    if (ibSetup()) out.push('This is an IB MYP task: each row is a criterion and its score is a level from 0 to 8. Levels are not added up or averaged, so ignore the total column, and there is no percent.');   // ib.js
    else if (sc.length) out.push('Average ' + fmtNum(sc.reduce((a, g) => a + g.total, 0) / sc.length) + ' / ' + maxPoints() + ' (' + Math.round(sc.reduce((a, g) => a + (g.pct || 0), 0) / sc.length) + '%), from ' + plural(sc.length, 'finished score') + '.');
    if (rubric && crit.length) {
      const avg = crit.map((c, i) => { const v = who.map(st => rowShown(st, i)).filter(x => x != null); return v.length ? [c, v.reduce((a, b) => a + b, 0) / v.length] : null; }).filter(Boolean);
      if (avg.length) out.push('Row averages: ' + avg.map(([c, v]) => one(nameFreeText(c)) + ' ' + fmtNum(Math.round(v * 10) / 10)).join(', ') + '.');
    }
  }
  const top = [...all].filter(([k]) => INK_KINDS.includes(k) ? o.ink : o.stamps).sort(tallyOrder);
  if (top.length) out.push('Marks across the class: ' + top.map(([k, v]) => k + ' ' + v).join(', ') + '.');
  if (empty.length) out.push('Not in this file: ' + plural(empty.length, 'student') + ' with no marks, score or comment yet.');
  if (o.scores) {
    out.push('', '## Scores', '', '| code | ' + crit.map(c => one(nameFreeText(c)).replace(/\|/g, '/')).concat(['total / ' + maxPoints(), 'percent', 'status']).join(' | ') + ' |', '|' + ' --- |'.repeat(crit.length + 4));
    for (const { st } of byStudent) { const g = gradeOf(st); out.push('| ' + [codeOf(st)].concat(crit.map((_, i) => fmtNum(rowShown(st, i))), [cellOut(g, 'total'), cellOut(g, 'pct'), statusText(st)]).map(c => String(c).replace(/\|/g, '/')).join(' | ') + ' |'); }
  }
  for (const { st, pages, tally } of byStudent) {
    const rx = coverRx(st), g = gradeOf(st);
    out.push('', '## ' + codeOf(st));
    if (o.scores) {
      if (rubric && crit.length && !noScore(st)) out.push('Scores: ' + crit.map((c, i) => one(nameFreeText(c)) + ' ' + (rowShown(st, i) == null ? '(not scored)' : fmtNum(rowShown(st, i)))).join(', '));
      const s = statusText(st);
      if (ibSetup()) { if (s) out.push(s); } else
      out.push(g.total != null || g.pct != null ? 'Total ' + cellOut(g, 'total') + ' / ' + maxPoints() + ', ' + cellOut(g, 'pct') + '%' + (s ? ', ' + s : '') : s || 'Not scored yet');
    }
    if (o.comments && one(st.grade.comment)) out.push('Comment: ' + one(scrub(st.grade.comment, rx)));
    for (const pg of pages) out.push(pg.label, ...pg.lines.map(l => '- ' + l));
    const t = [...tally].filter(([k]) => INK_KINDS.includes(k) ? o.ink : o.stamps).sort(tallyOrder);
    if (t.length) out.push('Marks: ' + t.map(([k, v]) => k + ' ' + v).join(', '));
    if (!pages.length && !noScore(st) && !(o.comments && one(st.grade.comment))) out.push('No marks on the paper.');
  }
  return { text: out.join('\n') + '\n', codes: byStudent.map(x => codeOf(x.st)), empty: empty.length };
}

async function makeMarksFile(onStep) {
  await workerReady;
  if (!scanned || scanP) await scanAll();   // a grade typed on the paper counts as a score
  const r = await marksFileText(onStep);
  saveBlob('Marks for ' + aiSay() + ' - ' + one(nameFreeText(batch.name)).replace(/[\\/:*?"<>|]/g, '-') + '.md', new Blob([r.text], { type: 'text/markdown' }));
  const sh = shareState();
  sh.marksMade = Date.now(); sh.sent = [...new Set((sh.sent || []).concat(r.codes))];
  saveSoon();
  return r;
}

// The Marks only side of Share with Claude.
function marksPane() {
  const o = marksOpts(), sh = shareState(), who = batch.students.filter(st => !marksEmpty(st)), empty = batch.students.length - who.length;
  const ex = who[0] || batch.students[0];
  return '<p style="margin-top:0">One file for spotting patterns across the class, with <b>no names in it</b>. ' + (ex ? plural(who.length, 'student gets', 'students get') + ' a random code, like <b>' + esc(codeOf(ex)) + '</b>, the same one as in the ZIP. ' : '') + 'Names in your comments become [name]. The list of who is who stays only in this browser. No papers go, so there are no covers to check.</p>' +
    MARKS_OPTS.map(([k, t, s]) => '<label class="mkopt"><input type="checkbox" data-mkopt="' + k + '"' + (o[k] ? ' checked' : '') + '><span>' + t + '<small>' + s + '</small></span></label>').join('') +
    (empty ? '<div class="bbmiss" id="mkOut" style="margin:10px 0 12px">Left out: ' + plural(empty, 'student') + ' with no marks, score or comment yet. The file says how many.</div>' : '') +
    '<ol class="shsteps" style="margin-top:12px"><li><b>Download the marks file.</b> <span id="mkMade">' + (sh.marksMade ? 'Made ' + esc(whenLabel(sh.marksMade)) + '.' : 'It stays on your computer until you give it to ' + aiSay() + '.') + '</span></li>' +
    '<li><b>Give it to ' + aiSay() + ',</b> with this message. Change it however you like.<textarea id="mkAsk" rows="4" aria-label="What to say to ' + aiSay() + '"></textarea><div class="shrow"><button class="btn sm" data-mkcopy>Copy the message</button>' + (aiLink() ? '<button class="btn sm" data-shopen>Open ' + aiSay() + ' ↗</button>' : '') + '</div></li>' +
    '<li><b>Bring the reply back,</b> if ' + aiSay() + ' wrote feedback for students. <button class="btn sm" data-shback>Bring back from ' + aiSay() + '</button></li></ol>' +
    '<div class="prog" id="mkProg" hidden><i></i></div><p class="muted" id="mkStatus" style="font-size:13px;margin:0"></p>';
}
function marksPaneWire() {
  const sh = shareState(), ask = $('#mkAsk');
  if (!ask) return;
  ask.value = sh.marksAsk != null ? sh.marksAsk : MARKS_ASK;
  ask.oninput = e => { sh.marksAsk = e.target.value; saveSoon(); };
  for (const b of $('#shMarks').querySelectorAll('[data-mkopt]')) b.onchange = e => { marksOpts()[e.target.dataset.mkopt] = e.target.checked; saveSoon(); };
}
// Papers and marks, or Marks only. She gets the one she used last.
function shareKind(k) {
  const sh = shareState(), box = $('#dlgBox'), marks = k === 'marks';
  sh.kind = k;
  for (const b of box.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === k));
  $('#shPapers').hidden = marks; $('#shMarks').hidden = !marks;
  box.querySelector('[data-check]').hidden = marks; box.querySelector('[data-make]').hidden = marks; box.querySelector('[data-marksdl]').hidden = !marks;
  if (marks) { $('#shMarks').innerHTML = marksPane(); marksPaneWire(); }
  saveSoon();
}
// Answers right away, so Open Claude and the rest still run inside her click. Making the file goes on by itself.
function marksClick(e) {
  const k = e.target.closest('[data-kind]');
  if (k) { shareKind(k.dataset.kind); return true; }
  if (e.target.closest('[data-mkcopy]')) { copy(nameFreeText($('#mkAsk').value), 'Copied. Paste it into ' + aiSay() + ' along with the marks file.'); return true; }
  if (e.target.closest('[data-marksdl]')) { marksDownload(e.target.closest('[data-marksdl]')); return true; }
  return false;
}
async function marksDownload(btn) {
  const bar = $('#mkProg'); btn.disabled = true; bar.hidden = false;
  try {
    const r = await makeMarksFile((n, t) => { bar.firstChild.style.width = (100 * n / t) + '%'; $('#mkStatus').textContent = 'Reading the marks ' + n + ' of ' + t + '…'; });
    $('#mkStatus').textContent = 'Done: ' + plural(r.codes.length, 'student') + '. Give the file to ' + aiSay() + ' with the message.';
    $('#mkMade').textContent = 'Made ' + whenLabel(shareState().marksMade) + '.';
  } catch (er) { console.error(er); $('#mkStatus').textContent = 'Something went wrong: ' + (er.message || er); }
  bar.hidden = true; btn.disabled = false;
}
Object.assign(window.__gs, { marksFileText, makeMarksFile, MARKS_ASK, shareKind });
