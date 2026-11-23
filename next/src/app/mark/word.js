// A Word paper on the marking screen (src/app/word.js wordCard, src/wordnotes.js wireWordNotes, src/app/wordrubric.js wireRubric):
// the file drawn as a page from its own XML, typed in, table cells shaded, boxes ticked, real Word comments added in the margin,
// and, on her own rubric (or a table she says to score with), a click on a score box gives the score. Everything that reads or
// changes the file is the current app's code (engines/gword.js); this file is the card around it. The file's new bytes are kept
// through students/write.js keepEdit, and a score goes through the marking code (mark/marking.js wordGrade), one undo step each.
// Loaded as a part of its own (router.js PARTS.word) the first time a Word paper opens.
import * as W from '../../engines/gword.js';
import { state, maxPoints, fmtNum, kget } from '../../engines/gcore.js';
import { t } from '../../i18n/t.js';
import { toast, copyButton } from '../../ui/index.js';
import { PARTS } from '../router.js';
import { keepBank, loadBank } from './editors.js';
import './lines.js';
import './setup-lines.js';
import './paper-lines.js';
import { micFor } from './dictate.js';

const el = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const button = (cls, attrs, text) => { const b = el('button', cls, { type: 'button', ...attrs }); if (text != null) b.textContent = text; return b; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EDIT_OFF = '~edit|';
const COLOR_LINE = { '#FFF59D': 'mark.c_yellow', '#C8E6C9': 'mark.c_green', '#BBDEFB': 'mark.c_blue', '#F8BBD0': 'mark.c_pink', '': 'setup.wd_nocolor' };
const saves = new Set();   // Word edits waiting out their short pause (the marking code's saveNowDone writes them first)

// One Word file. M: the marking code once its tools are there (until then the card shows the file and changes nothing).
// Returns { el, close }.
export function wordCard(st, f, M, { readOnly = false } = {}) {
  const b0 = state().batch, disp = state().disp || {};
  const root = el('div', 'docx'); root.wordF = f;
  // her Word text size and line spacing (gs.disp dfs, dlh: src/app/display.js), 15 px and Normal until she changes them
  root.style.setProperty('--dfs', (+disp.dfs || 15) + 'px'); root.style.setProperty('--dlh', +disp.dlh || 1.45);
  const head = el('div', 'fhead');
  const nm = el('span', 'nm', { 'data-raw': '' }); nm.textContent = f.name;
  const kind = el('span', 'mute'); kind.textContent = t(/\.(docm|dotm)$/i.test(f.name) ? 'setup.wd_macros' : 'setup.wd_file');
  head.append(nm, kind);
  if (f.rubric) { const p = el('span', 'pill'); p.textContent = t('setup.wd_rubric'); head.append(p); }
  const editedPill = el('span', 'pill', { 'data-wedited': '' }); editedPill.textContent = t('setup.wd_edited'); editedPill.hidden = !f.edited; head.append(editedPill);
  head.append(el('span', 'grow'));
  const can = !readOnly && !!M;
  const bNote = can ? button('btn sm', { 'data-wnote': '', title: t('setup.wd_comment_tip') }, t('setup.wd_comment')) : null;
  const bEdit = can ? button('btn sm', { 'data-wedit': '' }, t('setup.wd_edit')) : null;
  const bPdf = can && !f.virtual && !f.rubric && !f.from && f.data ? button('btn sm', { 'data-wpdf': '', title: t('setup.wd_pdf_tip') }, t('setup.wd_pdf')) : null;
  const bDl = button('btn sm ghost', { 'data-wdl': '' }, t('setup.wd_download'));
  // Copy text: the paper's words as plain lines (table cells apart by tabs), to paste into an assistant or a document
  const bCopy = copyButton(() => page.innerText, { cls: 'btn sm ghost' }); bCopy.dataset.wcopy = '';
  head.append(...[bNote, bEdit, bPdf, bCopy, bDl].filter(Boolean));
  const bar = el('div', 'wbar', { role: 'toolbar', 'aria-label': t('setup.wd_editing') }); bar.hidden = true;
  const wdoc = el('div', 'wdoc'), page = el('div', 'dpage'), aside = el('aside', 'wnotes', { 'aria-label': t('setup.wd_comments') }); aside.hidden = true;
  wdoc.append(page, aside);
  root.append(head, bar, wdoc);

  let w = null;
  try { w = W.openWord(f.data); w.pRuns = []; W.renderWord(w, page); }
  catch (e) {
    console.error(e);
    const p = el('p'); p.textContent = t('setup.wd_cannot'); page.replaceChildren(p);
    for (const x of [bNote, bEdit]) if (x) x.remove();
  }
  if (w) w.pRuns = w.paras.map((_, i) => [...page.querySelectorAll('p[data-pi="' + i + '"] [data-ri]')].map(s => w.runs[+s.dataset.ri]));
  for (const a of page.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }

  let editing = false, cell = null, saveT = null, gone = false;
  const dirty = new Set();
  const flush = () => { for (const p of dirty) if (p.isConnected) W.wApplyPara(w, p); dirty.clear(); };
  // the file's bytes written from its XML, kept in this browser, and the score it gives read again
  // A save under way stays in the marking screen's flush list (as wait) until its write is done, so saving before a reload or for
  // leaving waits for it: taken off as it began, a reload in that moment showed the paper without the words just typed (CI, PR #267).
  const saveNow = async () => {
    clearTimeout(saveT); saveT = null; saves.delete(saveNow); if (M) M.flushers.delete(saveNow);
    if (!w) return;
    let end; const writing = new Promise(r => { end = r; }), wait = () => writing;
    saves.add(wait); if (M) M.flushers.add(wait);
    try {
      flush();
      if (!f.orig) f.orig = f.data;
      f.data = W.wordBytes(w); f.edited = Date.now(); f.size2 = f.data.length;
      W.wordScore(f);
      editedPill.hidden = false;
      try { const Wr = await PARTS.write(); await Wr.keepEdit(b0.id, f.path, { data: f.data, orig: f.orig, t: f.edited }); M && M.changedNow(); }
      catch (e) { console.error(e); toast(t('setup.wd_not_kept')); }
    } finally { saves.delete(wait); if (M) M.flushers.delete(wait); end(); }
  };
  const soon = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 700); saves.add(saveNow); if (M) M.flushers.add(saveNow); };

  const drawBar = () => {
    const hint = el('span'); hint.textContent = t('setup.wd_bar');
    const sws = W.CELL_COLORS.map(([c]) => { const s = button('sw', { 'data-cell': c, title: t(COLOR_LINE[c] || 'setup.wd_nocolor'), 'aria-label': t('setup.wd_shade', { c: t(COLOR_LINE[c] || 'setup.wd_nocolor') }), style: 'background:' + (c || '#fff') }); if (!c) s.textContent = '⦸'; return s; });
    bar.replaceChildren(hint, ...sws);
    if (f.orig || f.edited) { bar.append(el('span', 'grow'), button('link', { 'data-wreset': '' }, t('setup.wd_original'))); }
    if (w && w.macros) { const m = el('div', 'mute wfull'); m.textContent = t('setup.wd_macros_note'); bar.append(m); }
  };
  const setEditing = on => {
    editing = on;
    page.classList.toggle('editing', on);
    for (const p of page.querySelectorAll('p.wp')) p.contentEditable = on ? 'true' : 'false';
    if (bEdit) { bEdit.textContent = t(on ? 'setup.wd_done' : 'setup.wd_edit'); bEdit.setAttribute('aria-pressed', on); }
    bar.hidden = !on; if (on) drawBar();
    if (!on && (dirty.size || saveT)) saveNow();
  };

  /* her own rubric: a click on a score box highlights it, two neighbouring boxes are the half point between them */
  let rub = null;
  const wireRubric = () => {
    const m = W.rubricModel(page); if (!m) return;
    const su = () => state().setup;
    for (const c of m.cells) { c.td.classList.add('rcell'); c.td.title = t('setup.wd_box_tip'); }
    const info = el('div', 'rinfo', { role: 'status' });
    root.insertBefore(info, wdoc);
    const show = s => {
      info.replaceChildren();
      const tot = el('b'); tot.textContent = s.total == null ? '–' : fmtNum(s.total); info.append(tot, ' / ' + m.max);
      if (s.pct != null) { const p = el('b', 'pc'); p.textContent = fmtNum(s.pct) + '%'; info.append(' ', p); }
      const per = el('span', 'mute', { 'data-raw': '' }); per.textContent = m.crits.map((c, i) => (c.length > 24 ? c.slice(0, 24) + '…' : c) + ' ' + (s.per[i] == null ? '–' : fmtNum(s.per[i]))).join(' · ');
      info.append(per);
      if (!s.done) { const n = el('span', 'mute'); n.textContent = t('setup.wd_each'); info.append(n); }
      if (su().mode === 'rubric' && m.max !== maxPoints()) { const n = el('span', 'warn wfull'); n.textContent = t('setup.wd_max_differs', { a: m.max, b: maxPoints() }); info.append(n); }
    };
    let last = W.rubricScore(m);
    const push = (s, write) => {
      show(s);
      if (W.tryOfFile(st, f)) { last = s; return; }   // a rubric from an earlier try keeps its score with that try
      const was = last; last = s;
      if (M) M.wordGrade(st, () => {
        if (s.total == null) W.wordScoreGone(st, was); else W.rubricToGrade(st, s, m.max, m.crits.length);
        if (write && s.total != null && W.ownGrade(st).total != null) { const was = st.grade.status; W.liftStatus(st); if ((was === 'missing' || was === 'excused') && !st.grade.status) toast(t(was === 'missing' ? 'paper.gs_lift_missing' : 'paper.gs_lift_excused')); }
      });
      if (write && W.fillTotalBlank(w, page, m, s)) soon();
    };
    const classSetup = async (outOf, scale) => {
      const s = state().setup;
      if (scale) s.scale = scale;
      if (outOf) { s.outOf = outOf; }
      if (M) await M.keepSetup();
    };
    if (f.virtual && W.scaleDiffers(m.scale)) classSetup(null, m.scale);   // the scale printed on her rubric page wins
    show(last);
    if (f.virtual && last.total != null && !W.hasOwnScore(st)) {   // her rubric page, already highlighted, brings its score in
      if (su().mode === 'points' && +su().outOf !== m.max) classSetup(m.max);
      push(last, false);
    }
    if (f.edited && W.wordLineHers(st, last) && W.fillTotalBlank(w, page, m, last, true)) soon();
    // A table in a student's file changes nothing for the class unless she says so, asked once each time the file opens.
    let asked = !!f.virtual;
    const ask = () => new Promise(done => {
      if (asked || su().mode !== 'points') return done();
      asked = true;
      const outOf = +su().outOf !== m.max, scale = W.scaleDiffers(m.scale);
      if (!outOf && !scale) return done();
      const box = el('div', 'rinfo rask', { role: 'group' }), q = el('span'), yes = button('btn sm primary', { 'data-wyes': '' }, t('setup.wd_class_yes')), no = button('btn sm', { 'data-wno': '' }, t('setup.wd_class_no'));
      q.textContent = outOf ? t(scale ? 'setup.wd_class_both' : 'setup.wd_class_outof', { a: m.max, b: su().outOf }) : t('setup.wd_class_scale');
      box.append(q, el('span', 'grow'), no, yes); root.insertBefore(box, wdoc); yes.focus();
      const end = async ok => { box.remove(); if (ok) await classSetup(outOf ? m.max : null, scale ? m.scale : null); done(); };
      yes.onclick = () => end(true); no.onclick = () => end(false);
    });
    page.addEventListener('click', async e => {
      if (editing) return;   // while editing, clicks place the cursor; the color buttons shade
      const td = e.target.closest('td.rcell'); if (!td || !M) return;
      const c = m.cells.find(x => x.td === td), same = m.cells.filter(x => x.crit === c.crit && x !== c && W.isShaded(x.td));
      const set = (x, on) => { W.wShadeCell(w, w.cells[+x.td.dataset.ci], on ? W.RUB_HL : ''); x.td.style.background = on ? W.RUB_HL : ''; };
      if (W.isShaded(td)) set(c, false);
      else { const keepOne = same.length === 1 && Math.abs(same[0].val - c.val) === 1; for (const x of same) if (!keepOne) set(x, false); set(c, true); }
      await ask();
      push(W.rubricScore(m), true); soon();
    });
    rub = { push: () => push(W.rubricScore(m), true) };
  };
  if (w && can) {
    W.wordScore(f);
    if (f.wscore || !f.wtab) wireRubric();
    else {
      const off = el('div', 'rinfo roff'), s = el('span', 'mute'); s.textContent = t('setup.wd_table');
      const on = button('link', { 'data-wtabon': '' }, t('setup.wd_score_with'));
      off.append(s, on); root.insertBefore(off, wdoc);
      // for this assignment, until the page closes: every student's table is read again as a rubric (the current app's wordTabOn)
      on.onclick = () => { const b = state().batch; W.wordTabOn.add(b.id); for (const x of b.students) for (const g of x.files) if (g.kind === 'docx') g.wsOf = null; off.remove(); W.wordScore(f); wireRubric(); };
    }
  }

  /* comments: real Word comments, in the margin beside their words */
  const paint = () => W.wNotesPaint(w, page, aside);
  const pop = (near, text, isNew, done) => {
    for (const p of wdoc.querySelectorAll('.pop')) p.remove();
    const box = el('div', 'pop wpop', { role: 'dialog', 'aria-label': t(isNew ? 'mark.new_comment' : 'mark.comment') });
    const lbl = el('div', 'lbl'); lbl.textContent = t(isNew ? 'mark.new_comment' : 'mark.comment');
    const ta = el('textarea', '', { placeholder: t('mark.comment_ph'), 'aria-label': t('mark.comment'), 'data-raw': '' }); ta.value = text || '';
    const bankL = el('div', 'lbl'); bankL.textContent = t('mark.saved_comments');
    const chips = el('div', 'chips'), foot = el('div', 'row');
    foot.append(button('btn', { 'data-a': 'star', title: t('mark.save_reuse_tip') }, t('mark.save_reuse')), micFor(ta), el('span', 'sp'));
    if (!isNew) foot.append(button('btn', { 'data-a': 'del' }, t('mark.delete')));
    foot.append(button('btn primary', { 'data-a': 'ok' }, t('mark.done')));
    loadBank(); const bank = () => state().bank || [];
    const drawChips = () => { chips.replaceChildren(...bank().map((txt, i) => { const c = el('span', 'chip', { 'data-i': i }), s = el('span', '', { title: txt, 'data-raw': '' }); s.textContent = txt; c.append(s, button('', { 'data-x': i, title: t('mark.bank_remove'), 'aria-label': t('mark.bank_remove') }, '×')); return c; })); bankL.hidden = !bank().length; };
    drawChips();
    box.append(lbl, ta, bankL, chips, foot);
    wdoc.appendChild(box);
    const H = wdoc.getBoundingClientRect(), N = near.getBoundingClientRect();
    box.style.left = clamp(N.left - H.left, 0, Math.max(0, H.width - box.offsetWidth)) + 'px';
    box.style.top = (N.bottom - H.top + 8) + 'px';
    ta.focus({ preventScroll: true });
    let over = false;
    const close = v => { if (over) return; over = true; box.remove(); done(v); };
    box.addEventListener('mousedown', e => e.stopPropagation());
    box.addEventListener('mouseup', e => e.stopPropagation());
    box.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); close(ta.value.trim()); }
    });
    box.addEventListener('click', e => {
      e.stopPropagation();
      const x = e.target.closest('[data-x]');
      if (x) { const gone = bank()[+x.dataset.x]; keepBank(t('mark.bank_remove'), l => l.filter(c => c !== gone), drawChips); return; }
      const ch = e.target.closest('.chip');
      if (ch) { const txt = bank()[+ch.dataset.i]; ta.value = ta.value.trim() ? ta.value.trim() + ' ' + txt : txt; ta.focus(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'star') { const txt = ta.value.trim(); if (txt && !bank().includes(txt)) keepBank(t('mark.save_reuse'), l => (l.includes(txt) ? l : [txt, ...l]), () => { drawChips(); toast(t('mark.bank_saved')); }); }
      if (a.dataset.a === 'ok') close(ta.value.trim());
      if (a.dataset.a === 'del') close('');
    });
  };
  const openComment = id => {
    const c = W.wCommentEls(w).find(x => W.wId(x) === id); if (!c) return;
    const near = page.querySelector('.wcref[data-cm="' + CSS.escape(id) + '"]') || aside.querySelector('[data-cm="' + CSS.escape(id) + '"]');
    pop(near, W.wCommentText(c), false, async v => {
      if (v == null || v === W.wCommentText(c)) return;
      if (v) { W.wCommentSet(w, c, v); W.wCommentsKeep(w); } else W.wCommentDrop(w, id);
      paint(); await saveNow();
    });
  };
  const addComment = at => {
    flush();
    let lit = [];
    if (!at.para) {   // split first (the end, then the start), so the comment covers exactly the words
      const sameSpan = at.first === at.last;
      W.wSplitSpan(w, at.last, at.b);
      const first = W.wSplitSpan(w, at.first, at.a) || at.first;
      at = { first, last: sameSpan ? first : at.last };
      const all = [...page.querySelectorAll('[data-ri]')], i = all.indexOf(at.first), j = all.indexOf(at.last);
      lit = all.slice(i, j + 1);
    }
    for (const s of lit) s.classList.add('wpend');
    const near = at.para || at.last;
    window.getSelection().removeAllRanges();
    pop(near, '', true, async v => {
      for (const s of lit) s.classList.remove('wpend');
      if (!v) return;
      if (!W.wCommentAdd(w, at, v)) return toast(t('setup.wd_no_comments'));
      paint(); await saveNow();
    });
  };
  if (w && can) {
    if (W.wComments(w) === false) { if (bNote) bNote.remove(); }
    else {
      paint();
      page.addEventListener('mouseup', e => {
        if (e.button !== 0 || editing || e.target.closest('.wchk')) return;
        const sel = window.getSelection(), picked = sel && !sel.isCollapsed;
        const hit = !picked && e.target.closest('[data-cm]');
        if (hit) return openComment(hit.dataset.cm.split(' ')[0]);
        if (state().tool !== 'note' || (!picked && e.target.closest('td.rcell'))) return;
        const at = W.wPickWords(w, page, e);
        if (at) addComment(at);
      });
      page.addEventListener('contextmenu', e => {
        if (editing || e.shiftKey) return;   // while typing, the browser's own menu (spelling) stays
        e.preventDefault();
        const sel = window.getSelection(), hit = sel.isCollapsed && e.target.closest('[data-cm]');
        if (hit) return openComment(hit.dataset.cm.split(' ')[0]);
        const at = W.wPickWords(w, page, e);
        if (at) addComment(at); else toast(t('setup.wd_right_click'));
      });
      aside.addEventListener('click', e => { const c = e.target.closest('[data-cm]'); if (c) openComment(c.dataset.cm); });
      bNote.addEventListener('mousedown', e => e.preventDefault());   // keeps her selection
      bNote.addEventListener('click', () => { const at = W.wPickWords(w, page, null); if (at) addComment(at); else toast(t('setup.wd_select')); });
    }
  }

  /* the buttons, typing and boxes */
  root.addEventListener('click', async e => {
    if (e.target.closest('[data-wdl]')) {
      if (saveT || dirty.size) await saveNow();
      const { saveFile } = await PARTS.outEngine(); return saveFile(f.name, new Blob([f.data]));
    }
    if (e.target.closest('[data-wedit]')) return setEditing(!editing);
    // Convert to PDF: asked on the marking screen (mark/fileui.jsx PdfAsk), after what she typed is saved
    if (e.target.closest('[data-wpdf]')) { if (editing) setEditing(false); if (saveT || dirty.size) await saveNow(); return root.dispatchEvent(new CustomEvent('wordpdf', { bubbles: true })); }
    if (e.target.closest('[data-wreset]')) {
      if (saveT) await saveNow();
      // the original as kept in this browser when this copy has none (an edit made in another window, src/app/word.js origBytes)
      const orig = f.orig || await kget('edits', state().batch.id + '|' + f.path).then(r => r && r.orig, () => null); if (!orig) return toast(t('setup.wd_no_orig'));
      const was = W.wordScore(f), b = state().batch;
      f.data = orig; f.orig = null; f.edited = 0;
      try { const Wr = await PARTS.write(); await Wr.dropEdit(b.id, f.path); } catch (er) { console.error(er); }
      b.goneNow = { ...(b.goneNow || (b.revs || {}).gone || {}), [EDIT_OFF + f.path]: Date.now() };   // noteGone: a copy elsewhere doesn't bring the edit back
      if (M) M.wordGrade(st, () => W.wordScoreGone(st, was));
      W.wordScore(f);
      toast(t('setup.wd_back'));
      return root.dispatchEvent(new CustomEvent('wordreopen', { bubbles: true }));
    }
    const k = e.target.closest('.wchk');
    if (k && w) { if (!editing) return toast(t('setup.wd_edit_first')); const on = W.wToggle(w, w.boxes[+k.dataset.ki]); k.textContent = on ? '☒' : '☐'; k.setAttribute('aria-pressed', on); soon(); return; }
    const sw = e.target.closest('[data-cell]');
    if (sw && w) { if (!cell) return toast(t('setup.wd_cell_first')); W.wShadeCell(w, w.cells[+cell.dataset.ci], sw.dataset.cell); cell.style.background = sw.dataset.cell || ''; if (rub) rub.push(); soon(); return; }
    const td = e.target.closest('td[data-ci]');
    if (td && editing) { if (cell) cell.classList.remove('wsel'); cell = td; td.classList.add('wsel'); }
  });
  page.addEventListener('input', e => { const p = e.target.closest('p.wp'); if (p) { dirty.add(p); soon(); } });
  page.addEventListener('keydown', e => {
    if (!editing) return;
    e.stopPropagation();   // typing here never sets off the app's shortcut keys
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
    if ((e.metaKey || e.ctrlKey) && /^[biu]$/i.test(e.key)) e.preventDefault();   // formatting stays as it is in the file
  });
  page.addEventListener('paste', e => { if (!editing) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n')); });
  page.addEventListener('focusout', () => { if (dirty.size) saveNow(); });
  return { el: root, close: async () => { if (gone) return; gone = true; if (saveT || dirty.size) await saveNow(); saves.delete(saveNow); } };
}

// Every student's Word rubrics without opening them (src/app/wordrubric.js wordScoresAll): a rubric already highlighted gives the
// score, as opening it would; her own rubric page brings its grading scale and Out of to the class. Run before Grades, the grade
// sheet and Return read the papers, as the current app runs it. Each score is one undo step through the marking code.
export async function scoresAll(M) {
  const s = state(), b = s.batch; if (!b || !M) return;
  let outOf = null, scale = null;
  for (const st of b.students) for (const f of st.files) W.wordScore(f);
  for (const st of b.students) for (const f of st.files) {
    const sc = W.wordScore(f); if (!sc || sc.total == null) continue;
    if (f.virtual) {   // her own rubric page, so the assignment follows it
      if (W.scaleDiffers(sc.scale)) scale = sc.scale;
      if (!W.hasOwnScore(st) && s.setup.mode === 'points' && +s.setup.outOf !== sc.max) outOf = sc.max;
    } else if ((st.grade.reads || {})[W.readKey(W.wordTableRead(f))] !== 1) continue;   // a table in a student's file waits for her OK
    if (scale || outOf) { if (scale) s.setup.scale = scale; if (outOf) s.setup.outOf = outOf; await M.keepSetup(); scale = outOf = null; }
    if (!W.hasOwnScore(st) && !W.tryOfFile(st, f)) M.wordGrade(st, () => W.rubricToGrade(st, sc, sc.max, sc.nCrit));
  }
  await linesFollow(M);
}
// The Total line in every Word file she has scored follows the grading scale, as the panel does (wordLinesFollow), once for each
// setup that changes a percent, so the file that goes back agrees with the gradebook.
async function linesFollow(M) {
  const b = state().batch, sig = W.rubricKey(state().setup);
  if (!b || b.lineSig === sig) return;
  b.lineSig = sig;
  await M.saveNowDone();
  const Wr = await PARTS.write();
  for (const st of b.students) for (const f of st.files) {
    if (state().batch !== b) return;
    if (f.kind !== 'docx' || !f.edited) continue;
    const w = W.openWord(f.data), page = el('div', 'dpage'); w.pRuns = []; W.renderWord(w, page);
    w.pRuns = w.paras.map((_, i) => [...page.querySelectorAll('p[data-pi="' + i + '"] [data-ri]')].map(s => w.runs[+s.dataset.ri]));
    const m = W.rubricModel(page), sc = m && W.rubricScore(m);
    if (!m || !W.wordLineHers(st, sc) || !W.fillTotalBlank(w, page, m, sc, true)) continue;
    if (!f.orig) f.orig = f.data;
    f.data = W.wordBytes(w); f.edited = Date.now(); f.size2 = f.data.length;
    W.wordScore(f);
    await Wr.keepEdit(b.id, f.path, { data: f.data, orig: f.orig, t: f.edited });
  }
}
