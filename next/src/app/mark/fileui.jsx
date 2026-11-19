// The words and boxes around a student's files on the marking screen (src/app/replace.js, src/app/kept.js pickAdd): a menu on each
// file with Replace… and Remove, the check before a replace (the two files side by side), Add a file…, and Removed files with Bring
// back. What each does is mark/change.js, the current app's own steps. Loaded with it as a part of its own (router.js PARTS.fileui).
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, IconButton, Menu, Dialog, TextInput, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import { shownName, anonOn, anonOrder } from '../../engines/gdraw.js';
import { lostPages } from '../../engines/gopen.js';
import { prefs } from '../../students/prefs.js';
import { Checkbox, Segmented } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { useRove } from './rove.js';
import { copyText } from '../../services/clipboard.js';
import { GroupBand, GroupDialog } from './group.jsx';
export { GroupBand };
export { ScoreMore, Anchors } from './score-more.jsx';
export { PastWork } from './past.jsx';
export { IbAsk, IbTotal } from './ib.jsx';
import * as C from './change.js';
import { Arrange } from './arrange.jsx';
export { LightPanel, LightChip } from './light.jsx';
import { viewable, fileSeq } from '../../engines/gdraw.js';
import './lines.js';
import './setup-lines.js';
import './inout-lines.js';

import { PARTS } from '../router.js';
import { useDrivePick } from '../drive-button.jsx';
import { lightApply } from './light.jsx';
import { use } from '../../engines/gcore.js';
import { rotOf, skewOf, lightLive } from '../../engines/gdraw.js';
import { scanAsks } from '../../engines/gfiles.js';

// m: the marking code; open(i): show this student again. Lighting changed by the lifted code (a scan's Fix the lighting) draws
// every page again and saves, as the panel does.
export const takeSplit = () => C.takeSplit();
export const rescanCount = () => C.rescans().length;
export const rescanList = () => C.rescans();
export function wire(m, open) { C.wire(m, open); use({ lightPagesChanged: lightApply }); }
const pickFile = (multiple, done) => { const i = document.createElement('input'); i.type = 'file'; i.multiple = multiple; i.onchange = () => done([...i.files]); i.click(); };

// The ⋯ on a file: Move to…, Replace…, Leave out and Remove, in the current app's order (src/app/student.js). Not on her own rubric
// page or a rubric copy (fileLinks). d: the paper this file is on, when it has a header of its own; a paper made of more than one
// file has only Leave out.
export function FileMenu({ st, path, name, d, on, auto }) {
  const [ask, setAsk] = useState(null), [busy, setBusy] = useState(false);
  const f = st.files.find(x => x.path === path);
  if (!f) return null;
  const mine = !f.virtual && !f.rubric;
  const one = mine && !d || d.pages.every(([q]) => q === path || (st.files.find(x => x.path === q) || {}).virtual);
  // nothing is thrown away and Undo takes it back, so it isn't asked first; the toast says how many marks went with it
  const remove = async () => { const n = C.marksOn(st, path), gone = await C.removeFile(st, path); if (gone) toast(t(n ? 'setup.f_removed_marks' : 'setup.f_removed_t', { name: C.shown(st, gone.name), n }), { undo: C.undo }); };
  const replace = () => pickFile(false, async ([file]) => { if (!file) return; setAsk({ kind: 'rpl', file, a: await C.about(st, path, file) }); });
  const doReplace = async () => { const { file } = ask; setAsk(null); setBusy(true); try { const nf = await C.replaceFile(st, path, file); if (nf) toast(t('setup.f_replaced', { name: C.shown(st, f.name) }), { undo: C.undo }); } finally { setBusy(false); } };
  const leave = () => { C.setIn(st, d, false); toast(t('setup.f_left_t', { name: d.name }), { undo: C.undo }); };
  const pages = n => (n ? t('setup.f_pages', { n }) : '');
  const items = [];
  if (d && (on || auto)) items.push({ label: t('setup.f_turn_all'), icon: 'turnr', onSelect: () => C.turnDoc(st, d) });
  if (one) items.push({ label: t('setup.f_move'), icon: 'arrow', onSelect: () => setAsk({ kind: 'mv' }) }, { label: t('setup.f_replace'), icon: 'replace', onSelect: replace });
  if (d && on && mine) items.push({ label: t('setup.f_leave'), icon: 'minus', onSelect: leave });
  if (one && f.data && !f.virtual) items.push({ label: t('setup.gw_menu'), icon: 'people', onSelect: () => setAsk({ kind: 'grp' }) });
  if (mine && viewable(f)) items.push({ label: t('setup.f_example'), icon: 'spark', onSelect: () => PARTS.exsave().then(m => m.useExample(st)) });   // the whole paper or part of a page (stage 5)
  if (one) items.push({ label: t('setup.f_remove'), icon: 'trash', onSelect: remove });
  if (!items.length) return null;
  return <span class="mk-fmenu">
    <Menu label={t('setup.f_more', { name })} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('setup.f_more', { name })} disabled={busy} data-fmenu={path} />} items={items} />
    {ask && ask.kind === 'grp' && <GroupDialog st={st} path={path} onClose={() => setAsk(null)} />}
    {ask && ask.kind === 'rpl' && <Dialog open title={t('setup.f_rpl_q')} onClose={() => setAsk(null)}
      actions={<><Button onClick={() => setAsk(null)}>{t('setup.cancel')}</Button><Button variant="primary" onClick={doReplace} data-ok>{t('setup.f_replace_do')}</Button></>}>
      <div class="mk-rpl"><div><b data-raw>{ask.a.oldName}</b><small class="mute">{[pages(ask.a.oldPages), ask.a.marks ? t('setup.f_marks', { n: ask.a.marks }) : t('setup.f_no_marks')].filter(Boolean).join(' · ')}</small></div>
        <span class="mute" aria-hidden="true">→</span><div><b data-raw>{ask.a.newName}</b><small class="mute">{[pages(ask.a.newPages), t('setup.f_new')].filter(Boolean).join(' · ')}</small></div></div>
      <p>{ask.a.marks ? t('setup.f_rpl_marks', { n: ask.a.marks }) : t('setup.f_rpl_text')}</p></Dialog>}
    {ask && ask.kind === 'mv' && <MoveTo st={st} path={path} f={f} onClose={() => setAsk(null)} />}
  </span>;
}

// Move to…: pick the student the file belongs to, then, if this student has a score or comment, whether it goes too (openMoveFile).
function MoveTo({ st, path, f, onClose }) {
  const [q, setQ] = useState(''), [qa, setQa] = useState(null);
  const bb = state().batch, a = shownName(st, bb.students.indexOf(st));
  // each word typed starts a word of the name (src/app/files.js openMoveFile, D-039); with names hidden, in paper-number order
  const anon = anonOn(), words = q.toLowerCase().split(/\s+/).filter(Boolean), ord = anon ? anonOrder() : null;
  const rows = bb.students.map((s, i) => ({ s, i, name: shownName(s, i) })).filter(r => r.s !== st && words.every(w => r.name.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))))
    .sort((x, y) => (ord ? ord.indexOf(x.i) - ord.indexOf(y.i) : 0));
  const go = async dst => {
    const b = shownName(dst, bb.students.indexOf(dst));
    const r = await C.moveFile(st, path, dst, (said, n, others) => new Promise(res => setQa({ said, n, others, b, res })));
    setQa(null); onClose();
    if (r.already) return toast(t('setup.f_mv_already', { b }));
    if (!r.name) return;
    toast(r.took ? t('setup.f_moved_with', { name: r.name, b, said: r.took }) : t('setup.f_moved', { name: r.name, b }), { undo: C.undo });
    if (r.kept) toast(t('setup.f_mv_clash', { a, b, said: r.kept }));
  };
  if (qa) {
    const answer = v => { const res = qa.res; setQa(qa => ({ ...qa, res: null })); if (res) res(v); };
    return <Dialog open title={t('setup.f_move_t', { name: C.shown(st, f.name) })} onClose={() => answer(false)}
      actions={<><Button onClick={() => answer(false)} data-keep>{t('setup.f_mv_keep', { a })}</Button><Button variant="primary" onClick={() => answer(true)} data-take>{t('setup.f_mv_ok', { b: qa.b })}</Button></>}>
      <p data-raw>{t('setup.f_mv_q', { a, b: qa.b, said: qa.said, n: qa.n })}</p>
      {qa.others > 0 && <p data-raw>{t('setup.f_mv_others', { a, n: qa.others })} {t(qa.n > 1 ? 'setup.f_mv_leave_them' : 'setup.f_mv_leave_it', { n: qa.others })}</p>}
    </Dialog>;
  }
  return <Dialog open title={t('setup.f_move_t', { name: C.shown(st, f.name) })} onClose={onClose} actions={<Button onClick={onClose}>{t('setup.cancel')}</Button>}>
    <p class="mute">{t('setup.f_move_text')}</p>
    <TextInput icon="search" label={t('setup.f_find')} placeholder={t(anon ? 'inout.mv_num' : 'inout.mv_name')} value={q} onInput={setQ} data-mvfind
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (rows[0]) go(rows[0].s); } }} />
    <ul class="mk-mvlist">{rows.map((r, k) => <li><Button variant="quiet" class={k === 0 && words.length ? 'top' : undefined} onClick={() => go(r.s)} data-mvto={r.s.key}><span data-raw>{r.name}</span> <span class="mute" data-mvn>{t('setup.op_files', { n: r.s.files.length })}</span></Button></li>)}</ul>
    {!rows.length && <p class="mute">{t('setup.f_none_found')}</p>}
  </Dialog>;
}

// Bring back, on the header of a paper she left out.
export function BackIn({ st, d }) { return <Button size="sm" variant="quiet" onClick={() => C.setIn(st, d, true)} data-inout={d.name}>{t('setup.f_back')}</Button>; }

// Under the paper: Add a file…, and the files taken off this student, each with Bring back.
export function FilesFoot({ st, name }) {
  const [, again] = useState(0), [paste, setPaste] = useState(false), [arr, setArr] = useState(false), gone = (st.gone || []).filter(g => !g.virtual), op = C.outPages(st);
  // A ZIP added to a student is opened and its files added; a ZIP with a folder per student goes to Bring in files (src/app/kept.js
  // addFiles, D-043).
  const [bring, setBring] = useState(null);
  const addList = async files => {
    if (!files.length) return;
    let list = files.map(file => ({ path: file.name, file }));
    if (list.some(e => /\.zip$/i.test(e.file.name))) {
      const B = await PARTS.bringin(), out = [];
      for (const e of list) {
        if (!/\.zip$/i.test(e.file.name)) { out.push(e); continue; }
        const got = await B.expand([e.file]), tops = new Set(got.filter(g => g.path.split('/').length > 2).map(g => g.path.split('/')[1]));
        if (tops.size >= 2) return B.bringFiles(got, o => setBring({ B, ...o }));
        out.push(...got);
      }
      list = out;
    }
    const made = await C.addFiles(st, list);
    if (made.notKept) toast(t('setup.f_not_kept', { name: made.notKept[0] }));
    if (made.length) toast(t('setup.f_added', { n: made.length, name }));
    again(n => n + 1);
  };
  const add = () => pickFile(true, addList);
  // From Google Drive, for this student (src/app/kept.js pickAdd with Drive, D-042 and C-055): Google's chooser fills a file input
  const dIn = useRef(null), drive = useDrivePick(dIn);
  // Add: a late or forgotten paper, or work sent in a message (the current app's Add menu on the student's bar)
  const [split, setSplit] = useState(null), [media, setMedia] = useState(null);
  const scan = () => pickFile(false, files => { if (files[0]) PARTS.split().then(S => setSplit({ S, file: files[0] }), e => console.error(e)); });
  const items = [{ label: t('setup.f_add'), icon: 'file', onSelect: add }, { label: t('setup.f_paste'), icon: 'paste', onSelect: () => setPaste(true) },
    { label: t('setup.v_add_menu'), icon: 'play', onSelect: () => PARTS.media().then(S => setMedia({ S, k: 'video' }), e => console.error(e)) },
    { label: t('setup.v_np_menu'), icon: 'note', onSelect: () => PARTS.media().then(S => setMedia({ S, k: 'notes' }), e => console.error(e)) },
    { label: t('setup.s_into'), icon: 'image', onSelect: scan }];
  if (drive) items.splice(1, 0, { label: t('file.from_drive_pick'), icon: 'drive', onSelect: drive });
  return <div class="mk-ffoot">
    <Menu label={t('setup.f_add_for', { name })} trigger={b => <Button {...b} size="sm" icon="plus" data-addmenu>{t('setup.f_add_menu')}</Button>} items={items} />
    {(st.files.some(viewable) || fileSeq(st).length > 1) && <Button size="sm" icon="grip" onClick={() => setArr(true)} title={t('setup.a_open_tip')} data-arrange>{t('setup.a_open')}</Button>}
    <input ref={dIn} type="file" multiple hidden onChange={e => { const fs = [...e.currentTarget.files]; e.currentTarget.value = ''; addList(fs); }} data-adddrive />
    {bring && <bring.B.BringFiles rows={bring.rows} dups={bring.dups} onClose={() => { setBring(null); again(n => n + 1); }} />}
    {paste && <PasteText st={st} name={name} onClose={() => { setPaste(false); again(n => n + 1); }} />}
    {arr && <Arrange st={st} onClose={() => { setArr(false); again(n => n + 1); }} />}
    {media && media.k === 'video' && <media.S.VideoAdd st={st} name={name} onClose={() => { setMedia(null); again(n => n + 1); }} />}
    {media && media.k === 'notes' && <media.S.NotesAdd st={st} name={name} onClose={() => { setMedia(null); again(n => n + 1); }} />}
    {split && <split.S.Split file={split.file} into lib={state().lib} onClose={() => { setSplit(null); again(n => n + 1); }} />}
    {(gone.length > 0 || op.length > 0) && <details class="mk-gone" open={op.length > 0}><summary>{t(op.length ? (gone.length ? 'setup.a_gone_both' : 'setup.a_gone_pages') : 'setup.f_gone', { n: gone.length + op.length })}</summary>
      <ul>{op.map(([path, p]) => { const f = st.files.find(x => x.path === path), n = ((f.marks || {})[p] || []).length;
        return <li><span><span data-raw>{C.shown(st, f.name)}</span>{', ' + [t('setup.a_page_n', { n: p + 1 }), f.virtual ? t('setup.a_your_rubric') : '', n ? t('setup.f_marks', { n }) : ''].filter(Boolean).join(' · ')}</span>
          <Button size="sm" variant="quiet" onClick={() => { C.bringPageBack(st, path, p); toast(t('setup.a_page_back', { name: C.shown(st, f.name), n: p + 1 }), { undo: C.undo }); again(n => n + 1); }} data-backpg={path + '|' + p}>{t('setup.f_back')}</Button></li>; })}{gone.map(g => <li><span data-raw>{C.shown(st, g.name)}</span><Button size="sm" variant="quiet" onClick={() => { C.bringBack(st, g.path); toast(t('setup.f_back_t', { name: C.shown(st, g.name) })); again(n => n + 1); }} data-back={g.path}>{t('setup.f_back')}</Button></li>)}</ul></details>}
  </div>;
}
// Pasted text (src/pastetext.js openPasteText): work a student sent in an email or a message becomes a page added to them.
function PasteText({ st, name, onClose }) {
  const [title, setTitle] = useState(t('setup.f_paste_default')), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const clean = C.pasteClean(text), words = (clean.match(/\S+/g) || []).length;
  const pic = [...clean].some(ch => ch.codePointAt(0) > 0x24F && !/[\u2000-\u206F\u20AC\u2122]/.test(ch));
  const go = async () => {
    setBusy(true);
    try { const r = await C.pasteAdd(st, title, text); if (r) toast(t('setup.f_added', { n: 1, name })); }
    catch (e) { toast(t('setup.f_paste_fail', { why: (e && e.message) || String(e) })); }
    onClose();
  };
  return <Dialog open title={t('setup.f_paste_t', { name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('setup.cancel')}</Button><Button variant="primary" onClick={go} disabled={!clean || busy} data-ok>{t('setup.f_paste_add', { name })}</Button></>}>
    <p class="mute">{t('setup.f_paste_text')}</p>
    <TextInput label={t('setup.f_paste_name')} value={title} onInput={setTitle} autocomplete="off" data-ptname />
    <textarea class="input mk-pttext" aria-label={t('setup.f_paste_ph')} placeholder={t('setup.f_paste_ph')} value={text} onInput={e => setText(e.currentTarget.value)} data-raw data-pttext />
    {clean && <p class="mute">{t('setup.f_paste_words', { n: words })}{pic ? ' ' + t('setup.f_paste_pic') : ''}</p>}
  </Dialog>;
}
// The tag on a file she added (addTag): Added by you, Replaced …, From Word, with the day.
export function AddTag({ st, f }) {
  const x = C.tagOf(st, f); if (!x) return null;
  const day = date(new Date(x.t), { month: 'short', day: 'numeric' });
  const [, again] = useState(0);
  return <><span class="pill addtag">{x.word ? t('setup.f_from_word') : x.replaced ? t('setup.f_tag_replaced', { name: x.replaced, d: day }) : t('setup.f_tag_added', { d: day })}</span>
    {/* Mark late beside any file she added (src/intake.js lateLink, D-044): nothing is taken off */}
    {st.grade.status !== 'late' && <Button size="sm" variant="quiet" onClick={() => { C.markLate([st]); toast(t('setup.c_marked_late')); again(n => n + 1); }} data-marklate>{t('setup.c_mark_late')}</Button>}</>;
}

// Convert to PDF pages (src/wordpdf.js openWordPdf): this file, or every Word paper that can go without asking, and From now on.
const WP_MAX = 60;
const pdfAlways = () => !!prefs.get('gs.wordPdf', false);
async function runPdf(list, quiet) {
  if (!list.length) { if (!quiet) toast(t('setup.f_pdf_none')); return; }
  const r = await C.toPdf(list, i => toast(list.length === 1 ? t('setup.f_pdf_making') : t('setup.f_pdf_making_n', { i: i + 1, n: list.length }), { ms: 3000 }));
  if (!r) return toast(t('setup.f_pdf_busy'));
  const not = r.long + r.bad;
  if (r.done) toast(t('setup.f_pdf_done', { n: r.done }), { undo: C.undo });
  if (not) toast(t('setup.f_pdf_not', { n: not, max: WP_MAX }), { ms: 8000 });
}
export function PdfAsk({ st, f, onClose }) {
  const [L, setL] = useState(null), [which, setWhich] = useState('one'), [always, setAlways] = useState(pdfAlways());
  if (C.pdfBusyNow()) { toast(t('setup.f_pdf_busy')); onClose(); return null; }
  if (!L) { C.pdfLists(st, f).then(setL); return null; }
  const go = () => {
    if (always) prefs.set('gs.wordPdf', true); else prefs.del('gs.wordPdf');
    onClose();
    runPdf(which === 'all' ? [{ st, f }].concat(L.free.filter(x => x.f !== f)) : [{ st, f }]);
  };
  return <Dialog open title={t('setup.f_pdf_t')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('setup.cancel')}</Button><Button variant="primary" onClick={go} data-ok>{t('setup.f_pdf_do')}</Button></>}>
    <p>{t('setup.f_pdf_text')}</p>
    {f.edited && <p class="mute">{t('setup.f_pdf_edited')}</p>}
    {L.used && <p class="warn">{t('setup.f_pdf_used')}</p>}
    {L.others > 0 && <div class="mk-pdfwhich"><Segmented label={t('setup.f_pdf_which')} value={which} onChange={setWhich} options={[{ value: 'one', label: t('setup.f_pdf_one') }, { value: 'all', label: t('setup.f_pdf_all', { n: L.others + 1 }) }]} />
      {L.kept > 0 && <small class="mute">{t('setup.f_pdf_kept', { n: L.kept })}</small>}</div>}
    <Checkbox checked={always} onChange={setAlways} label={t('setup.f_pdf_always')} />
  </Dialog>;
}
// As an assignment opens, when she chose that: every Word paper that can go without asking (wordPdfAuto).
export async function pdfAuto() { if (!pdfAlways() || C.pdfBusyNow()) return; const L = await C.pdfLists(); return runPdf(L.free, true); }

// The turn buttons in the top corner of each page, shown when the mouse is over it (rotChip).
export function TurnChip({ pg }) {
  const re = !!(pg.file.sc && pg.file.sc[pg.idx] && pg.file.sc[pg.idx].re);
  const rv = useRove();
  return <span class="rchip" role="toolbar" aria-label={t('mark.pg_tools', { n: pg.idx + 1 })} {...rv}><IconButton icon="turnl" size="sm" label={t('setup.f_turn_l')} onClick={() => C.turnPages(pg.file, [pg.idx], -1)} data-rot="-1" />
    <IconButton icon="turnr" size="sm" label={t('setup.f_turn_r')} onClick={() => C.turnPages(pg.file, [pg.idx], 1)} data-rot="1" />
    {!pg.file.virtual && <IconButton icon="flag" size="sm" label={t(re ? 'setup.rs_flag_off' : 'setup.rs_flag')} title={t(re ? 'setup.rs_flag_off' : 'setup.rs_flag')} aria-pressed={re ? 'true' : 'false'} class={re ? 'on' : ''}
      onClick={() => toast(t(C.scanFlag(pg) ? 'setup.rs_flagged' : 'setup.rs_unflagged'))} data-pgre />}
    {!pg.out && <IconButton icon="x" size="sm" label={t('setup.a_take_tip')} title={t('setup.a_take_tip')} onClick={() => { const st = state().batch.students[state().cur]; C.takePageOut(st, pg.file.path, pg.idx); toast(t('setup.a_took', { name: C.shown(st, pg.file.name), n: pg.idx + 1 }), { undo: C.undo }); }} data-pgout />}</span>;
}

// A newer copy of a download (src/carryover.js carryTag): the file's flag, Looks fine, the pages its marks no longer have, Mark late.
export function CarryTag({ st, f }) {
  const c = state().batch.carry, flag = c && f && c.flags[f.path]; if (!flag) return null;
  const lost = lostPages(f);
  return <span class="mk-carrytag"><span class="carrytag" title={t(flag === 'new' ? 'setup.c_tip_new' : 'setup.c_tip_changed')}>{t(flag === 'new' ? 'setup.c_tag_new' : 'setup.c_tag_changed')}</span>
    <Button size="sm" variant="quiet" onClick={() => C.carryOk(f.path)} title={t('setup.c_ok_tip')} data-carryok={f.path}>{t('setup.c_ok')}</Button>
    {lost.length > 0 && <small class="warn">{t('setup.c_lost', { n: lost.length, pages: lost.map(p => p + 1).join(', ') })}</small>}
    {flag === 'new' && st.grade.status !== 'late' && <Button size="sm" variant="quiet" onClick={() => { C.markLate([st]); toast(t('setup.c_marked_late')); }} data-marklate>{t('setup.c_mark_late')}</Button>}</span>;
}
// Your work came over (carrySay): what happened, in one box, as the download opens. Short lists are written out, long ones counted;
// while names are hidden it only counts.
export function CarryBox({ onClose }) {
  const bb = state().batch, c = bb.carry; if (!c) return null;
  const changed = bb.students.flatMap(st => st.files.filter(f => c.flags[f.path] === 'changed' && Object.keys(f.marks || {}).length));
  const n = Object.keys((bb.keptWork && bb.keptWork.s) || {}).length, paths = k => Object.keys(c.flags).filter(p => c.flags[p] === k), anon = anonOn();
  const names = (items, key) => anon ? (items.length ? [t(key, { n: items.length })] : []) : items;
  const late = bb.students.filter(st => st.grade.status !== 'late' && st.grade.status !== 'excused' && st.files.some(f => c.flags[f.path] === 'new'));
  const [lateDone, setLateDone] = useState(false);
  const list = (title, items) => items.length > 0 && <><h3>{t(title)}</h3><ul>{items.slice(0, 12).map(x => <li data-raw>{x}</li>)}{items.length > 12 && <li>{t('setup.c_more', { n: items.length - 12 })}</li>}</ul></>;
  const status = st => t(st.grade.status === 'missing' ? 'mark.missing' : 'mark.excused');
  return <Dialog open title={t('setup.c_title')} onClose={onClose} actions={<>{late.length > 0 && !lateDone && <Button onClick={() => { C.markLate(late); toast(t('setup.c_late_t', { n: late.length })); setLateDone(true); }} data-carrylate>{t('setup.c_late', { n: late.length })}</Button>}<Button variant="primary" onClick={onClose} data-ok>{t('setup.ok')}</Button></>}>
    <div class="mk-carry" id="carryBox">
      <p>{t('setup.c_intro', { n, name: c.name || t('setup.c_noname') })}</p>
      {c.unchecked && <p>{t('setup.c_unchecked')}</p>}
      {list('setup.c_l_changed', names(paths('changed'), 'setup.c_n_files'))}
      {list('setup.c_l_lost', names(changed.filter(f => lostPages(f).length).map(f => t('setup.c_page', { name: f.name, pages: lostPages(f).map(p => p + 1).join(', ') })), 'setup.c_n_files'))}
      {list('setup.c_l_new', names(paths('new'), 'setup.c_n_files'))}
      {list('setup.c_l_status', names(bb.students.filter(st => (st.grade.status === 'missing' || st.grade.status === 'excused') && st.files.some(f => c.flags[f.path])).map(st => t('setup.c_marked', { name: st.key, status: status(st) })), 'setup.c_n_students'))}
      {list('setup.c_l_gone', names(c.goneFiles, 'setup.c_n_files').concat(anon ? (c.goneStudents.length ? [t('setup.c_n_whole', { n: c.goneStudents.length })] : []) : c.goneStudents.map(k => t('setup.c_whole', { name: k }))))}
      {list('setup.c_l_layouts', names(c.layouts, 'setup.c_n_students'))}
      {list('setup.c_l_edits', names(c.edits, 'setup.c_n_files'))}
      {c.extrasFailed && <p>{t('setup.c_failed')}</p>}
      <p class="mute">{t('setup.c_foot')}</p>
    </div>
  </Dialog>;
}

// Marks from other apps (src/imported.js impNote): the note above a file's first page. It offers to make the marks hers, says what
// happened after (with Put back), or says why a paper exported from here can't have its marks changed.
export const impAuto = f => C.impAuto(f);
export async function impAutoNow() { const bb = state().batch, st = bb && bb.students[state().cur]; if (!st) return; let any = false; for (const f of st.files) if (await C.impAuto(f)) any = true; if (any) C.impAfter(st.files[0], true); }
export function ImpNote({ pg }) {
  const f = pg.file, [, again] = useState(0), [busy, setBusy] = useState(false), [all, setAll] = useState(false);
  const [flat, setFlat] = useState(f.gsFlat);
  if (f.virtual || f.kind !== 'pdf') return null;
  if (flat === undefined) { const doc = state().docMap.get(f.path); if (doc) C.gsFlat(f, doc).then(v => setFlat(v)); }
  const run = async fn => { setBusy(true); try { await fn(); } catch (e) { console.error(e); toast(t('setup.i_failed')); } finally { setBusy(false); again(n => n + 1); } };
  const make = () => run(async () => { const r = await C.impMake(f); if (!r.n) { C.impNo(f); toast(t(r.locked ? 'setup.i_locked' : 'setup.i_none')); } await C.impAfter(f); });
  const back = () => run(async () => { C.impBack(f); await C.impAfter(f); });
  let body;
  if (f.impNew) body = <><div>{t('setup.i_now', { n: f.impNew.n })}<Button size="sm" variant="quiet" onClick={back} disabled={busy} data-imp="back">{t('setup.i_back')}</Button></div>
    {f.impNew.keep > 0 && <small class="mute">{t('setup.i_kept', { n: f.impNew.keep })}</small>}</>;
  else if (flat) body = <><div>{t('setup.i_flat')}</div><small class="mute">{t('setup.i_flat_how')}</small></>;
  else {
    const n = C.impCount(f); if (!n) return null;
    const others = state().batch.students.flatMap(st => st.files).filter(x => x !== f && C.impCount(x)).length;
    body = <><div>{t('setup.i_has', { n })}<Button size="sm" variant="quiet" onClick={make} disabled={busy} data-imp="make">{t('setup.i_make', { n })}</Button>
      <Button size="sm" variant="quiet" onClick={() => { C.impNo(f); again(k => k + 1); }} data-imp="no">{t('setup.i_not_now')}</Button></div>
      {others > 0 && <small class="mute">{t('setup.i_others', { n: others + 1 })}<Button size="sm" variant="quiet" onClick={() => setAll(true)} data-imp="all">{t('setup.i_all')}</Button></small>}</>;
  }
  return <div class="mk-impnote impnote" role="note">{body}{all && <Imported onClose={() => setAll(false)} />}</div>;
}
// Marks from other apps, for every paper (openImported): what they have, all of it made hers at once, and From now on (gs.impAuto).
const IMP_ROWS = [['pen', 'setup.i_k_pen', 'setup.i_to_pen'], ['note', 'setup.i_k_note', 'setup.i_to_note'], ['hl', 'setup.i_k_hl', 'setup.i_to_hl'], ['text', 'setup.i_k_text', 'setup.i_to_text'], ['oval', 'setup.i_k_oval', 'setup.i_to_oval']];
export function Imported({ onClose }) {
  const [r, setR] = useState(null), [at, setAt] = useState([0, 0]), [auto, setAuto] = useState(!!prefs.get('gs.impAuto', false)), [busy, setBusy] = useState(null), live = useRef(true);
  useEffect(() => { C.impReadAll((i, n) => setAt([i + 1, n]), () => live.current).then(x => x && setR(x)); return () => { live.current = false; }; }, []);
  const close = () => { live.current = false; onClose(); };
  const go = async () => {
    setBusy([0, r.reads.size]);
    const x = await C.impMakeAll(r.reads, (i, n) => setBusy([i, n]));
    close();
    toast(t('setup.i_now', { n: x.n }) + (x.bad ? ' ' + t('setup.i_bad', { n: x.bad }) : ''));
  };
  return <Dialog open title={t('setup.i_title')} onClose={close}
    actions={<><Button onClick={close}>{t('setup.cancel')}</Button><Button variant="primary" onClick={go} disabled={!r || !r.total || !!busy} data-impgo>{busy ? t('setup.i_working', { i: busy[0], n: busy[1] }) : r && r.total ? t('setup.i_make_n', { n: r.total }) : t('setup.i_make_them')}</Button></>}>
    <p>{!r ? t('setup.i_looking', { i: at[0], n: at[1] }) : r.total ? t('setup.i_sum', { n: r.reads.size, marks: t('setup.f_marks', { n: r.total }) }) : t('setup.i_sum_none')}</p>
    {r && r.total > 0 && <table class="mk-imptbl"><tbody>{IMP_ROWS.filter(x => r.kinds[x[0]]).map(x => <tr><td>{t(x[1])}</td><td>{t(x[2], { n: r.kinds[x[0]] })}</td></tr>)}
      {r.keep > 0 && <tr><td>{t('setup.i_k_other')}</td><td>{t('setup.i_stay', { n: r.keep })}</td></tr>}</tbody></table>}
    <Checkbox checked={auto} onChange={v => { setAuto(v); if (v) prefs.set('gs.impAuto', true); else prefs.del('gs.impAuto'); }} label={t('setup.i_auto')} />
    <p class="mute">{t('setup.i_hint')}</p>
  </Dialog>;
}

// The strip above a scanned page (src/scans.js scanNote): what was done, with Put back, or what might be wrong, with a way to fix it,
// and a page waiting on a rescan. It says nothing about who the paper is from. Each choice is mark/change.js scanAct.
export function ScanNote({ pg }) {
  const f = pg.file, p = pg.idx, r = f.sc && f.sc[p]; if (!r) return null;
  const bb = state().batch, st = bb.students[state().cur], off = r.off || {}, lines = [];
  const act = a => () => { if (a === 'rescan') return pickFile(true, async files => { if (!files.length) return; const made = await C.addFiles(st, files.map(file => ({ path: file.name, file }))); if (made.length) toast(t('setup.f_added', { n: made.length, name: shownName(st, state().cur) })); C.reopen(); }); C.scanAct(pg, a); };
  const btn = (a, k) => <Button size="sm" variant="quiet" onClick={act(a)} data-sc={a}>{t(k)}</Button>;
  if (r.re) lines.push(<>{t('setup.rs_note')}{btn('rescan', 'setup.rs_bring')}{btn('unre', 'setup.rs_fine')}</>);
  if (r.w && r.w.length && !anonOn()) lines.push(<span data-raw>{t('setup.rs_group', { names: r.w.join(', ') })}</span>);
  if (!r.typed) {
    const turned = !!r.didTurn && rotOf(f, p) === r.didTurn, straight = !!skewOf(f, p);
    if ((turned || straight) && !off.done) lines.push(<>{t(turned && straight ? 'setup.rs_both' : turned ? 'setup.rs_turned' : 'setup.rs_straight')}{btn('back', 'setup.rs_back')}{btn('done', 'setup.rs_right')}</>);
    if (scanAsks(f, p, r) && !off.turn) lines.push(<>{t(r.turn === 180 ? 'setup.rs_upside' : 'setup.rs_side')}{btn('turn', 'setup.rs_turn')}{btn('noturn', 'setup.rs_fine2')}</>);
    else if (r.side && !r.turn && rotOf(f, p) === (r.rot0 || 0) && !off.turn) lines.push(<>{t('setup.rs_side')}{btn('left', 'setup.rs_left')}{btn('right', 'setup.rs_right_t')}{btn('noturn', 'setup.rs_fine2')}</>);
    if (r.skew && !r.didSkew && !straight && !off.skew) lines.push(<>{t('setup.rs_crooked')}{btn('skew', 'setup.rs_skew')}{btn('noskew', 'setup.rs_fine2')}</>);
    if (r.blank && !off.blank && !(f.marks[p] || []).length) lines.push(<>{t('setup.rs_blank')}{btn('noblank', 'setup.rs_ok')}</>);
    const live = lightLive(st);
    if (r.lit && !live) delete r.lit;   // she switched it off herself
    if (r.lit) lines.push(<>{t('setup.rs_lit')}{btn('unlit', 'setup.rs_back')}{btn('lit', 'setup.rs_right')}</>);
    else if (r.faint && !off.faint && !live) lines.push(<>{t('setup.rs_faint')}{btn('light', 'setup.rs_light')}{btn('nofaint', 'setup.rs_fine2')}</>);
  }
  if (!lines.length) return null;
  return <div class={'mk-scnote' + (r.re ? ' re' : '')} data-scnote={f.path + '|' + p}>{lines.map(l => <div>{l}</div>)}</div>;
}
// Straightened pages can always be put back from the corner, after the strip has gone.
export function Unskew({ pg }) { return skewOf(pg.file, pg.idx) ? <IconButton icon="undo" size="sm" label={t('setup.rs_unskew')} title={t('setup.rs_unskew')} onClick={() => C.scanAct(pg, 'unskew')} data-scun /> : null; }
// Rescans (openRescans): every page flagged as needing a rescan, by student; a name goes to that paper. Copy the list.
export function Rescans({ onClose, onGo }) {
  const bb = state().batch, all = C.rescans(), by = new Map();
  for (const x of all) { if (!by.has(x.i)) by.set(x.i, []); by.get(x.i).push(x); }
  const order = [...by.keys()].sort((a, b) => a - b);
  const line = i => shownName(bb.students[i], i) + ': ' + by.get(i).map(x => t('setup.rs_line', { n: x.p + 1, file: C.shown(x.st, x.f.name) })).join(', ');
  const copy = () => copyText(order.map(line).join('\n')).then(ok => toast(t(ok ? 'setup.rs_copied' : 'copy.failed')));
  return <Dialog open title={all.length ? t('mark.rs_title_n', { n: by.size }) : t('setup.rs_title')} onClose={onClose}
    actions={<>{all.length > 0 && <Button onClick={copy} data-rscopy>{t('setup.rs_copy')}</Button>}<Button onClick={onClose}>{t('setup.s_close')}</Button></>}>
    {all.length ? <><p class="mute">{t('setup.rs_text')}</p>
      <ul class="mk-rslist">{order.map(i => <li><button class="mk-rsrow" onClick={() => { onClose(); onGo(i); }} data-rsgo={i}><span data-raw>{shownName(bb.students[i], i)}</span><span class="mute">{by.get(i).map(x => t('setup.rs_p', { n: x.p + 1 })).join(', ')}</span></button></li>)}</ul></>
      : <p class="mute">{t('setup.rs_none')}</p>}
  </Dialog>;
}
