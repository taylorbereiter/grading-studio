// The words and boxes around a student's files on the marking screen (src/app/replace.js, src/app/kept.js pickAdd): a menu on each
// file with Replace… and Remove, the check before a replace (the two files side by side), Add a file…, and Removed files with Bring
// back. What each does is mark/change.js, the current app's own steps. Loaded with it as a part of its own (router.js PARTS.fileui).
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Button, IconButton, Menu, Dialog, TextInput, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import { shownName } from '../../engines/gdraw.js';
import { prefs } from '../../students/prefs.js';
import { Checkbox, Segmented } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import * as C from './change.js';
import './lines.js';

export const wire = C.wire;
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
  const remove = async () => { const n = C.marksOn(st, path), gone = await C.removeFile(st, path); if (gone) toast(t(n ? 'mark.f_removed_marks' : 'mark.f_removed_t', { name: C.shown(st, gone.name), n }), { undo: C.undo }); };
  const replace = () => pickFile(false, async ([file]) => { if (!file) return; setAsk({ kind: 'rpl', file, a: await C.about(st, path, file) }); });
  const doReplace = async () => { const { file } = ask; setAsk(null); setBusy(true); try { const nf = await C.replaceFile(st, path, file); if (nf) toast(t('mark.f_replaced', { name: C.shown(st, f.name) }), { undo: C.undo }); } finally { setBusy(false); } };
  const leave = () => { C.setIn(st, d, false); toast(t('mark.f_left_t', { name: d.name }), { undo: C.undo }); };
  const pages = n => (n ? t('mark.f_pages', { n }) : '');
  const items = [];
  if (d && (on || auto)) items.push({ label: t('mark.f_turn_all'), icon: 'turnr', onSelect: () => C.turnDoc(st, d) });
  if (one) items.push({ label: t('mark.f_move'), icon: 'arrow', onSelect: () => setAsk({ kind: 'mv' }) }, { label: t('mark.f_replace'), icon: 'replace', onSelect: replace });
  if (d && on && mine) items.push({ label: t('mark.f_leave'), icon: 'minus', onSelect: leave });
  if (one) items.push({ label: t('mark.f_remove'), icon: 'trash', onSelect: remove });
  if (!items.length) return null;
  return <span class="mk-fmenu">
    <Menu label={t('mark.f_more', { name })} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('mark.f_more', { name })} disabled={busy} data-fmenu={path} />} items={items} />
    {ask && ask.kind === 'rpl' && <Dialog open title={t('mark.f_rpl_q')} onClose={() => setAsk(null)}
      actions={<><Button onClick={() => setAsk(null)}>{t('mark.cancel')}</Button><Button variant="primary" onClick={doReplace} data-ok>{t('mark.f_replace_do')}</Button></>}>
      <div class="mk-rpl"><div><b data-raw>{ask.a.oldName}</b><small class="mute">{[pages(ask.a.oldPages), ask.a.marks ? t('mark.f_marks', { n: ask.a.marks }) : t('mark.f_no_marks')].filter(Boolean).join(' · ')}</small></div>
        <span class="mute" aria-hidden="true">→</span><div><b data-raw>{ask.a.newName}</b><small class="mute">{[pages(ask.a.newPages), t('mark.f_new')].filter(Boolean).join(' · ')}</small></div></div>
      <p>{ask.a.marks ? t('mark.f_rpl_marks', { n: ask.a.marks }) : t('mark.f_rpl_text')}</p></Dialog>}
    {ask && ask.kind === 'mv' && <MoveTo st={st} path={path} f={f} onClose={() => setAsk(null)} />}
  </span>;
}

// Move to…: pick the student the file belongs to, then, if this student has a score or comment, whether it goes too (openMoveFile).
function MoveTo({ st, path, f, onClose }) {
  const [q, setQ] = useState(''), [qa, setQa] = useState(null);
  const bb = state().batch, a = shownName(st, bb.students.indexOf(st));
  const rows = bb.students.map((s, i) => ({ s, name: shownName(s, i) })).filter(r => r.s !== st && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
  const go = async dst => {
    const b = shownName(dst, bb.students.indexOf(dst));
    const r = await C.moveFile(st, path, dst, (said, n, others) => new Promise(res => setQa({ said, n, others, b, res })));
    setQa(null); onClose();
    if (r.already) return toast(t('mark.f_mv_already', { b }));
    if (!r.name) return;
    toast(r.took ? t('mark.f_moved_with', { name: r.name, b, said: r.took }) : t('mark.f_moved', { name: r.name, b }), { undo: C.undo });
    if (r.kept) toast(t('mark.f_mv_clash', { a, b, said: r.kept }));
  };
  if (qa) {
    const answer = v => { const res = qa.res; setQa({ ...qa, res: null }); if (res) res(v); };
    return <Dialog open title={t('mark.f_move_t', { name: C.shown(st, f.name) })} onClose={() => answer(false)}
      actions={<><Button onClick={() => answer(false)} data-keep>{t('mark.f_mv_keep', { a })}</Button><Button variant="primary" onClick={() => answer(true)} data-take>{t('mark.f_mv_ok', { b: qa.b })}</Button></>}>
      <p data-raw>{t('mark.f_mv_q', { a, b: qa.b, said: qa.said, n: qa.n })}</p>
      {qa.others > 0 && <p data-raw>{t('mark.f_mv_others', { a, n: qa.others })} {t(qa.n > 1 ? 'mark.f_mv_leave_them' : 'mark.f_mv_leave_it', { n: qa.others })}</p>}
    </Dialog>;
  }
  return <Dialog open title={t('mark.f_move_t', { name: C.shown(st, f.name) })} onClose={onClose} actions={<Button onClick={onClose}>{t('mark.cancel')}</Button>}>
    <p class="mute">{t('mark.f_move_text')}</p>
    <TextInput icon="search" label={t('mark.f_find')} value={q} onInput={setQ} />
    <ul class="mk-mvlist">{rows.map(r => <li><Button variant="quiet" onClick={() => go(r.s)} data-mvto={r.s.key}><span data-raw>{r.name}</span></Button></li>)}</ul>
    {!rows.length && <p class="mute">{t('mark.f_none_found')}</p>}
  </Dialog>;
}

// Bring back, on the header of a paper she left out.
export function BackIn({ st, d }) { return <Button size="sm" variant="quiet" onClick={() => C.setIn(st, d, true)} data-inout={d.name}>{t('mark.f_back')}</Button>; }

// Under the paper: Add a file…, and the files taken off this student, each with Bring back.
export function FilesFoot({ st, name }) {
  const [, again] = useState(0), [paste, setPaste] = useState(false), gone = (st.gone || []).filter(g => !g.virtual);
  const add = () => pickFile(true, async files => {
    if (!files.length) return;
    const made = await C.addFiles(st, files.map(file => ({ path: file.name, file })));
    if (made.notKept) toast(t('mark.f_not_kept', { name: made.notKept[0] }));
    if (made.length) toast(t('mark.f_added', { n: made.length, name }));
    again(n => n + 1);
  });
  // Add: a late or forgotten paper, or work sent in a message (the current app's Add menu on the student's bar)
  const items = [{ label: t('mark.f_add'), icon: 'file', onSelect: add }, { label: t('mark.f_paste'), icon: 'paste', onSelect: () => setPaste(true) }];
  return <div class="mk-ffoot">
    <Menu label={t('mark.f_add_for', { name })} trigger={b => <Button {...b} size="sm" icon="plus" data-addmenu>{t('mark.f_add_menu')}</Button>} items={items} />
    {paste && <PasteText st={st} name={name} onClose={() => { setPaste(false); again(n => n + 1); }} />}
    {gone.length > 0 && <details class="mk-gone"><summary>{t('mark.f_gone', { n: gone.length })}</summary>
      <ul>{gone.map(g => <li><span data-raw>{C.shown(st, g.name)}</span><Button size="sm" variant="quiet" onClick={() => { C.bringBack(st, g.path); toast(t('mark.f_back_t', { name: C.shown(st, g.name) })); again(n => n + 1); }} data-back={g.path}>{t('mark.f_back')}</Button></li>)}</ul></details>}
  </div>;
}
// Pasted text (src/pastetext.js openPasteText): work a student sent in an email or a message becomes a page added to them.
function PasteText({ st, name, onClose }) {
  const [title, setTitle] = useState(t('mark.f_paste_default')), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const clean = C.pasteClean(text), words = (clean.match(/\S+/g) || []).length;
  const pic = [...clean].some(ch => ch.codePointAt(0) > 0x24F && !/[\u2000-\u206F\u20AC\u2122]/.test(ch));
  const go = async () => {
    setBusy(true);
    try { const r = await C.pasteAdd(st, title, text); if (r) toast(t('mark.f_added', { n: 1, name })); }
    catch (e) { toast(t('mark.f_paste_fail', { why: (e && e.message) || String(e) })); }
    onClose();
  };
  return <Dialog open title={t('mark.f_paste_t', { name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('mark.cancel')}</Button><Button variant="primary" onClick={go} disabled={!clean || busy} data-ok>{t('mark.f_paste_add', { name })}</Button></>}>
    <p class="mute">{t('mark.f_paste_text')}</p>
    <TextInput label={t('mark.f_paste_name')} value={title} onInput={setTitle} autocomplete="off" data-ptname />
    <textarea class="input mk-pttext" aria-label={t('mark.f_paste_ph')} placeholder={t('mark.f_paste_ph')} value={text} onInput={e => setText(e.currentTarget.value)} data-raw data-pttext />
    {clean && <p class="mute">{t('mark.f_paste_words', { n: words })}{pic ? ' ' + t('mark.f_paste_pic') : ''}</p>}
  </Dialog>;
}
// The tag on a file she added (addTag): Added by you, Replaced …, From Word, with the day.
export function AddTag({ st, f }) {
  const x = C.tagOf(st, f); if (!x) return null;
  const day = date(new Date(x.t), { month: 'short', day: 'numeric' });
  return <span class="pill addtag">{x.word ? t('mark.f_from_word') : x.replaced ? t('mark.f_tag_replaced', { name: x.replaced, d: day }) : t('mark.f_tag_added', { d: day })}</span>;
}

// Convert to PDF pages (src/wordpdf.js openWordPdf): this file, or every Word paper that can go without asking, and From now on.
const WP_MAX = 60;
const pdfAlways = () => !!prefs.get('gs.wordPdf', false);
async function runPdf(list, quiet) {
  if (!list.length) { if (!quiet) toast(t('mark.f_pdf_none')); return; }
  const r = await C.toPdf(list, i => toast(list.length === 1 ? t('mark.f_pdf_making') : t('mark.f_pdf_making_n', { i: i + 1, n: list.length }), { ms: 3000 }));
  if (!r) return toast(t('mark.f_pdf_busy'));
  const not = r.long + r.bad;
  if (r.done) toast(t('mark.f_pdf_done', { n: r.done }), { undo: C.undo });
  if (not) toast(t('mark.f_pdf_not', { n: not, max: WP_MAX }), { ms: 8000 });
}
export function PdfAsk({ st, f, onClose }) {
  const [L, setL] = useState(null), [which, setWhich] = useState('one'), [always, setAlways] = useState(pdfAlways());
  if (C.pdfBusyNow()) { toast(t('mark.f_pdf_busy')); onClose(); return null; }
  if (!L) { C.pdfLists(st, f).then(setL); return null; }
  const go = () => {
    if (always) prefs.set('gs.wordPdf', true); else prefs.del('gs.wordPdf');
    onClose();
    runPdf(which === 'all' ? [{ st, f }].concat(L.free.filter(x => x.f !== f)) : [{ st, f }]);
  };
  return <Dialog open title={t('mark.f_pdf_t')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('mark.cancel')}</Button><Button variant="primary" onClick={go} data-ok>{t('mark.f_pdf_do')}</Button></>}>
    <p>{t('mark.f_pdf_text')}</p>
    {f.edited && <p class="mute">{t('mark.f_pdf_edited')}</p>}
    {L.used && <p class="warn">{t('mark.f_pdf_used')}</p>}
    {L.others > 0 && <div class="mk-pdfwhich"><Segmented label={t('mark.f_pdf_which')} value={which} onChange={setWhich} options={[{ value: 'one', label: t('mark.f_pdf_one') }, { value: 'all', label: t('mark.f_pdf_all', { n: L.others + 1 }) }]} />
      {L.kept > 0 && <small class="mute">{t('mark.f_pdf_kept', { n: L.kept })}</small>}</div>}
    <Checkbox checked={always} onChange={setAlways} label={t('mark.f_pdf_always')} />
  </Dialog>;
}
// As an assignment opens, when she chose that: every Word paper that can go without asking (wordPdfAuto).
export async function pdfAuto() { if (!pdfAlways() || C.pdfBusyNow()) return; const L = await C.pdfLists(); return runPdf(L.free, true); }

// The turn buttons in the top corner of each page, shown when the mouse is over it (rotChip).
export function TurnChip({ pg }) {
  return <span class="rchip"><IconButton icon="turnl" size="sm" label={t('mark.f_turn_l')} onClick={() => C.turnPages(pg.file, [pg.idx], -1)} data-rot="-1" />
    <IconButton icon="turnr" size="sm" label={t('mark.f_turn_r')} onClick={() => C.turnPages(pg.file, [pg.idx], 1)} data-rot="1" /></span>;
}
