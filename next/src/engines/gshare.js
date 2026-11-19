// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, setup, pages, saveSoon, pdfjsLib, PDFLib, fflate, workerReady, toast, aiSay, store, rowTop, rowHalf, rowLevels, rowsTop, maxPoints, gradeOf, fmtNum, noScore, ibSetup } from './gcore.js';
import { measureCtx, vpRot, viewable, fileByPath, scrub, coverRx, textItems, HL_WORD_RX, STICKERS, isSticker, viewBytes, one, marksMine } from './gdraw.js';
import { canvasJpg } from './gopen.js';
import { scanP, scanAll, shareState, sharePage, shareDocs, classCommon, shareOpts, rowShown, cellOut, statusText, csvCell, nameFreeText } from './gexport.js';

// src/app/export.js
const downloadsP = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
// src/app/export.js
async function saveBlob(name, blob) {
  name = name.replace(/[\\/:*?"<>|]+/g, '-');
  const dl = await downloadsP;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return; }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('One moment, then try again'); return; } }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
// src/app/gradesheet.js
let scanned = false;
// src/app/claude.js
const codeOf = st => shareState().codes[st.key];
// src/app/claude.js
const README_FOR_CLAUDE = (n) => [
  'Grading Studio package for ' + aiSay(),
  '',
  'Assignment: ' + nameFreeText(batch.name).replace(/[\r\n]+/g, ' '),
  'Papers: ' + n + (n === 1 ? ' student' : ' students') + ', each named by a random code (S-XXXX). Names are covered and swapped for [name].',
  'A second paper from the same student is S-XXXX-2, and so on.',
  '',
  'Files',
  '  papers/        one PDF per paper, as pictures, with the teacher\'s marks and comments drawn on',
  '  scores.csv     code, rubric scores, total, percent, status (partial, missing, excused or late), the teacher\'s comment',
  '  comments.json  every typed comment and text mark the teacher left, by code, page and kind',
  '  rubric.json    the rubric rows and grading scale',
  '',
  'How to send feedback back',
  '  Give one block per student that starts with the code on its own line, then the feedback:',
  '',
  '    S-XXXX',
  '    Feedback for this student...',
  '',
  '  Or a CSV with the columns code,feedback. Paste the reply, or drop the file, into',
  '  "Bring back from ' + aiSay() + '" in Grading Studio and each block goes to the right student.',
  '  Only these codes are known to Grading Studio; never guess or ask for names.',
].join('\r\n');
// src/app/claude.js
async function makeSharePackage(onStep) {
  await workerReady;
  if (!scanned || scanP) await scanAll();
  await classCommon();
  const files = {}, rows = [], notes = {};
  const crit = setup.mode === 'rubric' ? setup.criteria : [];
  const jobs = [];
  for (const st of batch.students) shareDocs(st).forEach((d, k) => jobs.push({ st, d, k }));
  const total = jobs.reduce((a, j) => a + j.d.pages.length, 0);
  let done = 0;
  const seen = new Set();
  for (const { st, d, k } of jobs) {
    const rx = coverRx(st), code = codeOf(st);
    const out = await PDFLib.PDFDocument.create();
    out.setTitle(code); out.setAuthor(''); out.setCreator('Grading Studio'); out.setProducer('');
    const js = new Map();
    try {
      for (const [path, p] of d.pages) {
        const f = fileByPath(st, path);
        if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
        // A poster-size page is drawn smaller: a canvas that big can't be turned into a picture.
        const v1 = vpRot(f, p, await js.get(path).getPage(p + 1), 1);
        const r = await sharePage(st, f, js.get(path), p, Math.min(120 / 72, 8000 / Math.max(v1.width * 1.5, v1.height)), rx, shareOpts(st));
        const jpg = await canvasJpg(r.c, 0.85);
        out.addPage([r.W + r.side, r.H]).drawImage(await out.embedJpg(jpg), { x: 0, y: 0, width: r.W + r.side, height: r.H });
        r.c.width = r.c.height = 0;
        const list = (notes[code] = notes[code] || []);
        const pageNo = d.pages.findIndex(x => x[0] === path && x[1] === p) + 1;
        for (const m of marksMine(f.marks[p] || [], f, st).concat((f.kami && f.kami[p] && f.kami[p].notes) || []))
          if (m.text) list.push({ paper: code + (k ? '-' + (k + 1) : ''), page: pageNo, kind: m.t === 'note' ? (m.ro ? 'Kami comment' : 'margin comment') : 'text on page', text: scrub(m.text, rx) });
        onStep && onStep(++done, total);
      }
    } finally { for (const v of js.values()) v.destroy(); }
    files['papers/' + code + (k ? '-' + (k + 1) : '') + '.pdf'] = [await out.save(), { level: 0 }];
    if (!seen.has(st)) {
      seen.add(st);
      const g = gradeOf(st);
      rows.push([code].concat(crit.map((_, i) => fmtNum(rowShown(st, i))), [cellOut(g, 'total'), cellOut(g, 'pct'), statusText(st), scrub(st.grade.comment, rx).replace(/\s*\n\s*/g, ' ')]));
    }
  }
  const head = ['code'].concat(crit, ['total / ' + maxPoints(), 'percent', 'status', 'teacher comment']);
  const enc = s => new TextEncoder().encode(s);
  files['scores.csv'] = enc('﻿' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n'));
  files['comments.json'] = enc(JSON.stringify(notes, null, 1));
  files['rubric.json'] = enc(JSON.stringify({ mode: setup.mode, criteria: crit, levels: setup.mode === 'rubric' ? (rowsTop(setup) ? '0 to ' + rowsTop(setup) + ' per row' : 'rows in order: ' + setup.criteria.map((_, i) => '0 to ' + rowTop(setup, i)).join(', ')) + (rowHalf(setup) ? ', half points allowed from 1 up' : ', whole numbers only') : undefined, outOf: maxPoints(), scale: setup.scale || null }, null, 1));
  files['README.txt'] = enc(README_FOR_CLAUDE(seen.size));
  saveBlob(('For ' + aiSay() + ' - ' + nameFreeText(batch.name) + '.zip'), new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
}
// src/app/claude.js
function parseFeedback(text) {
  const out = new Map(), t = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  try {
    const j = JSON.parse(t);
    const put = (c, v) => { if (c && v != null) out.set(String(c).toUpperCase().trim(), String(typeof v === 'object' ? (v.feedback || v.comment || '') : v).trim()); };
    if (Array.isArray(j)) j.forEach(x => put(x.code, x.feedback != null ? x.feedback : x.comment)); else for (const [c, v] of Object.entries(j)) put(c, v);
    return out;
  } catch {}
  const lines = t.split('\n'), h = lines[0].toLowerCase();
  if (/^\s*"?code"?\s*,/.test(h) && /feedback|comment/.test(h)) {   // CSV
    const rows = [], cell = []; let f = '', inQ = false, row = [];
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (inQ) { if (ch === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (ch === '"') inQ = false; else f += ch; }
      else if (ch === '"') inQ = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else f += ch;
    }
    row.push(f); rows.push(row);
    const hd = rows[0].map(x => x.toLowerCase().trim()), ci = hd.indexOf('code'), fi = hd.findIndex(x => /feedback/.test(x)) >= 0 ? hd.findIndex(x => /feedback/.test(x)) : hd.findIndex(x => /comment/.test(x));
    for (const r of rows.slice(1)) if (r[ci] && r[ci].trim()) out.set(r[ci].trim().toUpperCase(), (r[fi] || '').trim());
    return out;
  }
  const rx = /(?:^|\n)[\s#*>\-]*\**\s*(S-[A-Z0-9]{4})\b\**\s*[:.\-–—)]*\**/gi;   // blocks
  const hits = [...t.matchAll(rx)];
  hits.forEach((m, i) => {
    const s = m.index + m[0].length, e = i + 1 < hits.length ? hits[i + 1].index : t.length;
    const body = t.slice(s, e).replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
    if (body) out.set(m[1].toUpperCase(), (out.has(m[1].toUpperCase()) ? out.get(m[1].toUpperCase()) + '\n\n' : '') + body);
  });
  return out;
}
// src/stamps.js
const PROOF = [
  ['gr', 'Grammar'], ['cap', 'Capitalize'], ['lower', 'Make lowercase'], ['insert', 'Insert'], ['para', 'New paragraph'],
  ['delete', 'Delete'], ['swap', 'Swap order'], ['space', 'Add a space'], ['close', 'Close up'],
  ['sp', 'Spelling'], ['ro', 'Run-on'], ['frag', 'Fragment'],
  ['wc', 'Word choice'], ['awk', 'Awkward'], ['vt', 'Verb tense'], ['unclear', 'Unclear'],
];
// src/stamps.js
const PUNCT = [
  ['period', 'Add a period', 'Period'], ['comma', 'Add a comma', 'Comma'], ['apos', 'Add an apostrophe', 'Apostrophe'], ['quote', 'Add quotation marks', 'Quotes'], ['semi', 'Add a semicolon', 'Semicolon'],
  ['colon', 'Add a colon', 'Colon'], ['qmark', 'Add a question mark', 'Question'], ['excl', 'Add an exclamation mark', 'Exclamation'], ['hyphen', 'Add a hyphen', 'Hyphen'], ['dash', 'Add a dash', 'Dash'],
];
// src/stamps.js
const isProof = k => PROOF.some(p => p[0] === k) || PUNCT.some(p => p[0] === k);
// src/stamps.js
const stampName = k => k === 'crit' ? 'Criterion score' : isProof(k) ? markLabel(k) : ((STICKERS.find(p => p[0] === k)) || [k, k])[1];
// src/stamps.js
const MARK_KEY = 'gs.markKey';
// src/stamps.js
const keySet = () => { const v = store.get(MARK_KEY, null); return v && typeof v === 'object' ? v : {}; };
// src/stamps.js
const markLabel0 = k => ((PROOF.find(p => p[0] === k) || PUNCT.find(p => p[0] === k)) || [k, k])[1];
// src/stamps.js
const markLabel = k => { const v = (keySet().names || {})[k]; return typeof v === 'string' && v.trim() ? v.trim() : markLabel0(k); };
// src/insight.js
const SHARE_ASK = 'The attached ZIP has my students’ papers with the names removed. Please read README.txt first.\n\nFor each student, write short feedback I can check and then paste into my gradebook: what’s working, and one or two things to work on, tied to the rubric in rubric.json and to my marks on the paper. Start each student’s feedback with their code on its own line. Don’t try to work out who anyone is.';
// src/marksout.js
const MARKS_OPTS = [
  ['scores', 'Rubric scores, total, percent and status', 'And what each score means on each row, if you wrote it in Rubric setup.'],
  ['comments', 'Your comments and text on the page', 'The comment box, margin comments, text boxes and Kami comments, by page.'],
  ['stamps', 'Proofreading marks and stickers', 'Each one by name and page, plus a count per student: Spelling ×4, Run-on ×2.'],
  ['words', 'The words you highlighted, circled or commented on', 'Only where the paper has typed text. Names, emails and ID numbers are taken out.'],
  ['ink', 'A count of pen marks and checks', 'Drawings can’t be put into words, so they’re counted per page.'],
];
// src/marksout.js
const MARKS_ASK = 'The attached file has my marks for one assignment: rubric scores, my comments and every mark I made, with each student as a code instead of a name. Please read it all first.\n\nThen help me spot patterns across the class: what most students did well, the mistakes that came up again and again, which rubric rows were hardest and why, and anything in my own marking that looks inconsistent. Refer to students only by their code.';
// src/marksout.js
function marksOpts() { const sh = shareState(); return (sh.marksOpt ||= Object.fromEntries(MARKS_OPTS.map(([k]) => [k, true]))); }
// src/marksout.js
const marksFiles = st => st.files.filter(f => viewable(f) && (Object.values(f.marks || {}).some(l => l && l.length) || (f.kami && Object.values(f.kami).some(k => k && k.notes && k.notes.length))));
// src/marksout.js
const marksOnPage = (f, p) => marksMine((f.marks || {})[p] || [], f).concat((f.kami && f.kami[p] && f.kami[p].notes) || []);
// src/marksout.js
const marksPages = f => [...new Set(Object.keys(f.marks || {}).concat(Object.keys(f.kami || {})))].map(Number).filter(p => marksOnPage(f, p).length).sort((a, b) => a - b);
// src/marksout.js
const marksEmpty = st => !marksFiles(st).length && gradeOf(st).total == null && !noScore(st) && !String(st.grade.comment || '').trim();
// src/marksout.js
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
// src/marksout.js
const QUOTE_MAX = 220;
// src/marksout.js
const NAME_LABEL = /\b((?:full |student(?:'s)? )?name|student|by)\s*:\s*[^\s,;]+(?:\s+[^\s,;:]+)?/giu;
// src/marksout.js
function quoteOf(words, rx) {
  let t = words.map(w => w.s).join(' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/([(])\s+/g, '$1').trim();
  if (!t) return '';
  t = scrub(t, rx).replace(NAME_LABEL, (m, l) => l + ': [name]');
  return t.length > QUOTE_MAX ? t.slice(0, QUOTE_MAX - 1) + '…' : t;
}
// src/marksout.js
const midIn = (w, r, pad = 1) => { const cx = (w.x0 + w.x1) / 2, cy = (w.top + w.bot) / 2; return cx >= r.x - pad && cx <= r.x + r.w + pad && cy >= r.y - pad && cy <= r.y + r.h + pad; };
// src/marksout.js
const markRects = m => m.rects || (m.w != null ? [{ x: Math.min(m.x, m.x + m.w), y: Math.min(m.y, m.y + m.h), w: Math.abs(m.w), h: Math.abs(m.h) }] : []);
// src/marksout.js
const wordsIn = (words, rects) => words.filter(w => rects.some(r => midIn(w, r, Math.min(4, w.fh * 0.3))));
// src/marksout.js
function lineNear(words, x, y, span = 90) {
  let best = null, bd = 1e9;
  for (const w of words) { const d = y < w.top ? w.top - y : y > w.bot ? y - w.bot : 0; if (d < bd) { bd = d; best = w; } }
  if (!best || bd > best.fh * 1.2) return [];
  return words.filter(w => Math.abs(w.y - best.y) < 0.4 * best.fh && w.x1 >= x - span && w.x0 <= x + span);
}
// src/marksout.js
const INK_KINDS = ['Highlight', 'Circle', 'Pen mark', 'Check'];
// src/marksout.js
const tallyOrder = (a, b) => INK_KINDS.includes(a[0]) - INK_KINDS.includes(b[0]) || b[1] - a[1];
// src/marksout.js
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b || a + 's');
// src/marksout.js
const mdq = t => '"' + one(t).replace(/"/g, '\'') + '"';
// src/marksout.js
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
            if (m.k === 'crit') { if (o.comments) lines.push('criterion score sticker: ' + mdq((m.name ? m.name + ' ' : '') + m.text)); continue; }
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
// src/marksout.js
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
// src/marksout.js
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
export { makeSharePackage, parseFeedback, codeOf, marksFileText, makeMarksFile, marksOpts, marksEmpty, SHARE_ASK, MARKS_ASK, shareDocs };
