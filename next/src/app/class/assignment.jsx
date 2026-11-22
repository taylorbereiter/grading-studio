// An assignment card made, changed or deleted from the class's Assignments tab (src/app/screens.js editAssignment), and the card's
// less common tools, loaded as a part of their own (router.js PARTS.asg) only when one is opened:
// - New assignment: its name, the classes it goes in (linked classes ticked, src/linked.js lkSibs), the unit (by name, made in a
//   ticked class that has none of that name), its type (the teacher's gradebook types, gbook bkCats) and due date. Each ticked class
//   gets its own card; the copies share a group id. One undo step.
// - Edit assignment: the same, with one class; the card keeps its id, so its papers and scores stay with it, and a move to another
//   class or unit is the one Move to makes. Linked copies take the new name, type and date when asked (src/linked.js lkAlsoDo).
//   Delete is at once, with Undo. Both have Rubric (D-901, B-001, B-008; class/rubricin.jsx, a part of its own): a rubric brought in
//   from a file or Google Drive goes on the card on Save, and to the linked copies when they take the change.
// - Bring in a rubric… from the card's Bring in menu (B-004): the same part on its own, used at once.
// - No papers: presentations or videos (src/video.js openStartNotes): a notes page for every student on the roster, opened for
//   marking like papers, with Videos and partners (D-022) when there are videos.
// - Forget these papers (src/app/kept.js forgetKept): the download leaves this browser and any synced copy; asked first.
// - A unit's link to its unit plan (src/app/screens.js askAtlas), and a unit moved to another class.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Checkbox, Dialog, TextInput, Select, Segmented, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import * as B from '../../engines/gbook.js';
import { libraryChange } from '../../students/undo.js';
import * as undoList from '../../services/undo.js';
import { PARTS } from '../router.js';
import { saving } from '../../services/saving.js';
import '../mark/setup-lines.js';
import './lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const holders = l => [...l.classes, l.loose];
const holderOf = (l, id) => (id === '-' || id === '' || id == null ? l.loose : l.classes.find(x => String(x.id) === String(id)));
const itemIn = (l, id) => { for (const c of holders(l)) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
const unitIn = (l, id) => { for (const c of holders(l)) { const u = c.units.find(x => x.id === id); if (u) return { c, u }; } return null; };
const on = l => { B.bookUse({ lib: l }); return l; };
const lc = (label, fn) => libraryChange(label, l => fn(on(l)), true).catch(e => { console.error(e); toast(t('mark.cannot')); return false; });
const nameOf = (l, c) => (c === l.loose ? t('setup.u_noclass') : c.name);
const DEF = { ic: 'class.type_ic', sum: 'class.type_sum', fm: 'class.type_fm', xc: 'class.type_xc' };
const typeLabel = ([id, , s]) => (DEF[id] && (!s || B.bkIsDef(id)) ? t(DEF[id]) : s);
// "A, B and C" the way the current app joins class names
const joinNames = a => (a.length > 1 ? t('class.as_and', { list: a.slice(0, -1).join(', '), last: a[a.length - 1] }) : a.join(''));

// The timer's log, read once a visit (students/focus.js focusRead): time spent grading each card and what is due each week.
let F = null;
export async function timing() { F ||= await import('../../students/focus.js'); await F.focusRead(); return F.engine; }
// A card's time (src/tracker.js tkAsgHtml): so far, a paper's time, and how long the papers left will take at her pace.
export function asgTime(E, id) {
  const x = E.tkAsg(id); if (!x) return '';
  const per = x.p ? Math.max(1, Math.round(x.s / 60 / x.p)) : 0, left = E.gpLeft(id), bits = [];
  if (x.s >= 60) bits.push(t('class.tk_so_far', { time: E.tkDur(x.s) }));
  if (x.s >= 60 && per) bits.push(t('class.tk_per', { n: per }));
  if (left >= 60) bits.push(t('class.tk_left', { time: E.tkDur(left) }));
  if (left >= 60 && x.p < 3) bits.push(t('class.tk_from', { n: x.p }));
  return bits.join(' · ');
}
// Under the due date (src/gradeplan.js gpDueHint): what else is due that week, so a week that piles up is seen in time.
function DueWeek({ due, except }) {
  const [E, setE] = useState(null);
  useEffect(() => { timing().then(setE, e => console.error(e)); }, []);
  if (!/^\d{4}-\d\d-\d\d$/.test(due || '')) return null;
  if (!E) return <p class="mute small asgweek" aria-hidden="true" />;   // its room kept while the timer's log is read, so the buttons below don't move
  const mon = E.fcMon(due), sum = E.gpSum(E.gpDue(mon, E.gpAdd(mon, 6), except));
  return <p class="mute small asgweek" data-asg-week>{!sum.n ? t('class.due_none') : t('class.due_also', { n: sum.n, what: sum.s >= 60 ? t('class.due_about', { time: E.tkDur(sum.s) }) : t('class.due_papers', { n: sum.p }) })}</p>;
}

// New (it null: in classId, in unitId when there is one) or Edit (it: the card). onClose(true) once saved or deleted.
export function AssignmentDialog({ lib: lib0, it: it0, classId, unitId, onClose }) {
  // the card as it was when the box opened: a save while it's open (Delete, before the box shuts) leaves it in place
  const lib = on(lib0), [f] = useState(() => (it0 ? itemIn(lib, it0.id) : null));
  const start = f || unitIn(lib, unitId) || { c: holderOf(lib, classId) || lib.classes[0] || lib.loose, u: null };
  const sibs = start.c === lib.loose ? [] : B.lkSibs(start.c);
  const [name, setName] = useState(f ? f.it.name : ''), [err, setErr] = useState('');
  const [ticked, setTicked] = useState(() => holders(lib).filter(c => c === start.c || sibs.includes(c)));
  const [cls, setCls] = useState(String(start.c.id)), [type, setType] = useState(f ? f.it.type || '' : ''), [due, setDue] = useState(f ? f.it.due || '' : '');
  const [unit, setUnit] = useState(f ? f.u.id : start.u ? start.u.name : ''), [also, setAlso] = useState(true), [sure, setSure] = useState(false);
  const twins = f ? B.lkTwins(f.it) : [];
  const [R, setR] = useState(null), [rub, setRub] = useState(null);
  useEffect(() => { PARTS.rubricin().then(setR, e => console.error(e)); }, []);
  const cats = B.bkCats();
  // New: unit names from every ticked class; Edit: the chosen class's units
  const one = f ? holderOf(lib, cls) || lib.loose : null;
  const unitOpts = f ? one.units.map(u => ({ value: u.id, label: u.name })) : [...new Set(ticked.flatMap(c => c.units.map(u => u.name)))].map(n => ({ value: n, label: n }));
  const uVal = unitOpts.some(o => o.value === unit) ? unit : unitOpts.length ? unitOpts[0].value : '';
  const opts = unitOpts.length ? unitOpts : [{ value: '', label: t('class.as_unit_new') }];
  const un = uVal || t('class.as_unit1'), made = f ? [] : ticked.filter(c => !c.units.some(u => u.name === un)).map(c => nameOf(lib, c));
  const tick = (c, v) => setTicked(a => (v ? holders(lib).filter(x => x === c || a.includes(x)) : a.filter(x => x !== c)));
  const setKind = a => { if (type) a.type = type; else delete a.type; if (due) a.due = due; else delete a.due; };
  const save = async () => {
    const nm = name.trim(); if (!nm) { setErr(t('class.as_need_name')); return; }
    if (!f) {
      const ids = ticked.map(c => String(c.id)); if (!ids.length) return;
      const group = ids.length > 1 ? uid() : undefined, first = uid();
      const ok = await lc(t('class.as_new'), l => ids.forEach((id, k) => {
        const c = holderOf(l, id); if (!c) return;
        let to = c.units.find(u => u.name === un);
        if (!to) c.units.push(to = { id: uid(), name: un, items: [] });
        const a = { id: k ? uid() : first, name: nm, classId: c.id };
        if (group) a.group = group;
        setKind(a); to.items.push(a);
      }));
      if (ok === false) return;
      if (rub) await R.putRubric(first, rub, false);
      onClose(true);
      if (ids.length > 1) toast(t('class.as_added', { names: joinNames(ticked.map(c => nameOf(lib, c))) }));
      return;
    }
    const ok = await lc(t('class.as_edit'), l => {
      const g = itemIn(l, f.it.id), c = holderOf(l, cls); if (!g || !c) return;
      const was = { name: g.it.name, type: g.it.type, due: g.it.due };
      let to = c.units.find(u => u.id === uVal);
      if (!to) c.units.push(to = { id: uid(), name: t('class.as_unit1'), items: [] });
      g.it.name = nm; setKind(g.it);
      if (also && twins.length) for (const { it: x } of B.lkTwins(g.it)) for (const k of ['name', 'type', 'due']) if (g.it[k] !== was[k]) { if (g.it[k] == null) delete x[k]; else x[k] = g.it[k]; }
      // the move Move to makes: off its unit, onto the end of the other, and it takes that class
      if (g.u !== to) { g.u.items.splice(g.u.items.indexOf(g.it), 1); to.items.push(g.it); }
      g.it.classId = c.id;
    });
    if (ok === false) return;
    if (rub) await R.putRubric(f.it.id, rub, also && twins.length > 0);
    onClose(true);
  };
  const del = async () => {
    const ok = await lc(t('class.as_delete'), l => { const g = itemIn(l, f.it.id); if (g) g.u.items.splice(g.u.items.indexOf(g.it), 1); });
    if (ok === false) return;
    onClose(true);
    toast(t('setup.u_gone', { name: f.it.name }), { undo: () => undoList.undo() });
  };
  if (sure) return <Dialog open title={t('class.as_del_q', { name: f.it.name })} onClose={() => setSure(false)}
    actions={<><Button onClick={() => setSure(false)}>{t('setup.u_cancel')}</Button><Button variant="primary" onClick={del} data-asg-delok>{t('class.as_delete')}</Button></>}>
    <p>{t('class.as_del_say')}</p></Dialog>;
  return <Dialog open title={t(f ? 'class.as_edit' : 'class.as_new')} onClose={() => onClose(false)}
    actions={<>{f && <Button variant="quiet" onClick={() => setSure(true)} data-asg-del>{t('class.as_delete')}</Button>}
      <Button onClick={() => onClose(false)}>{t('setup.u_cancel')}</Button>
      <Button variant="primary" disabled={!f && !ticked.length} onClick={save} data-asg-ok>{!f && ticked.length > 1 ? t('class.as_add_n', { n: ticked.length }) : t('class.as_save')}</Button></>}>
    <div class="asgdlg" data-asg-dlg>
      <TextInput label={t('class.as_name')} value={name} onInput={v => { setName(v); setErr(''); }} error={err} placeholder={t('class.as_ph')} autofocus data-asg-name
        onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } }} />
      {f ? <Select label={t('class.as_class')} value={cls} onChange={v => setCls(v)} data-asg-class
        options={lib.classes.map(c => ({ value: String(c.id), label: c.name })).concat({ value: String(lib.loose.id), label: t('setup.u_noclass') })} />
        : <fieldset class="cp-fld" data-asg-classes><legend class="lab">{t('class.as_classes')}</legend>
          <div class="asgcls" style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>{holders(lib).map(c => <span data-asg-cls={String(c.id)}><Checkbox label={nameOf(lib, c)} checked={ticked.includes(c)} onChange={v => tick(c, v)} /></span>)}</div>
          {sibs.length > 0 && <p class="mute small">{t('class.as_linked')}</p>}</fieldset>}
      <Select label={t('class.as_unit')} value={uVal} onChange={setUnit} options={opts} data-asg-unit />
      {!f && ticked.length > 1 && made.length > 0 && made.length < ticked.length && <p class="mute small" data-asg-made>{t('class.as_made', { names: joinNames(made), unit: un, n: made.length })}</p>}
      <div class="cp-fld"><span class="lab">{t('class.as_type')}</span>
        <Segmented size="sm" label={t('class.as_type')} value={type} onChange={v => setType(v === type ? '' : v)} options={cats.map(k => ({ value: k[0], label: typeLabel(k) })).concat({ value: '', label: t('class.type_none') })} /></div>
      <TextInput type="date" label={t('class.as_due')} value={due} onInput={setDue} data-asg-due />
      <DueWeek due={due} except={f ? f.it.id : null} />
      {R && <R.RubricField su={f ? f.it.setup || null : null} onGot={setRub} />}
      {twins.length > 0 && <span data-asg-also><Checkbox label={t('class.lk_also_do', { names: joinNames(twins.map(x => nameOf(lib, x.c))) })} checked={also} onChange={setAlso} /></span>}
    </div>
  </Dialog>;
}

// No papers: a notes page for every student on the roster (src/video.js openStartNotes), brought in as the assignment's papers.
// bring(entries) is the class page's own way papers come in. Rubric rows are the assignment's when it has a rubric.
const KINDS = [['lined', 'setup.v_np_lined', 'setup.v_np_lined_tip'], ['rubric', 'setup.v_np_rubric', 'setup.v_np_rubric_tip'], ['cols', 'setup.v_np_cols', 'setup.v_np_cols_tip'], ['blank', 'setup.v_np_blank', 'setup.v_np_blank_tip']];
let npLast = 'lined';
const folder = n => String(n).replace(/[\\/:*?"<>|\u0000-\u001F]+/g, '-').trim();
export function StartNotes({ lib, it, bring, onClose }) {
  const f = itemIn(lib, it.id), c = f && f.c !== lib.loose ? f.c : null, names = c ? c.names.filter(n => String(n).trim()) : [];
  const [V, setV] = useState(null), [kind, setKind] = useState(npLast), [busy, setBusy] = useState(false);
  // Videos and partners (D-022): a part of its own, loaded with the box
  const [P, setP] = useState(null), [pv, setPv] = useState(null);
  useEffect(() => { if (names.length) { import('../../engines/gmedia.js').then(setV, e => console.error(e)); PARTS.partners().then(setP, e => console.error(e)); } }, []);
  if (!names.length) return <Dialog open title={t('class.sn_t', { name: it.name })} onClose={onClose} actions={<Button onClick={onClose}>{t('setup.u_cancel')}</Button>}><p>{t('class.sn_roster')}</p></Dialog>;
  const rows = V ? V.npRows(it.setup) : [], k = kind === 'rubric' && !rows.length ? 'lined' : kind;
  const go = async () => {
    setBusy(true); npLast = k;
    try {
      const [PDFLib, G] = await Promise.all([PARTS.pdflib(), import('../../engines/gcore.js')]); G.use({ PDFLib });
      const bytes = await V.notesPdf(k, it.name, rows), file = V.npFileName(it.name) + ' notes.pdf';
      const list = names.map(n => ({ path: folder(n) + '/' + file, file: new File([bytes.slice()], file, { type: 'application/pdf' }) }));
      onClose(); bring(list, pv && pv.groups.length ? { groups: pv.groups, own: pv.own } : null);
    } catch (e) { console.error(e); toast(t('class.sn_fail', { why: (e && e.message) || String(e) })); onClose(); }
  };
  return <Dialog open title={t('class.sn_t', { name: it.name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('setup.u_cancel')}</Button><Button variant="primary" onClick={go} disabled={busy || !V || !!(pv && pv.bad)} data-sngo>{t('class.sn_go')}</Button></>}>
    <p data-raw>{t('class.sn_text', { n: names.length, cls: c.name })}</p>
    <div class="nptiles" role="radiogroup" aria-label={t('setup.v_np_kind')}>{KINDS.map(([id, label, tip]) => { const off = id === 'rubric' && !rows.length;
      return <button type="button" class="nptile" role="radio" aria-checked={k === id ? 'true' : 'false'} disabled={off} title={t(off ? 'setup.v_np_norows' : tip)} onClick={() => setKind(id)} data-np={id}>
        <span class={'npart ' + id} aria-hidden="true" /><b>{t(label)}</b></button>; })}</div>
    {P ? <P.StartPv names={names} keyOf={folder} onChange={setPv} /> : <p class="mute small">{t('class.sn_later')}</p>}
  </Dialog>;
}

// Forget these papers (src/app/kept.js forgetKept, src/folder.js noteForgotten), in the current app's order. First the download
// comes out of every safety copy (whole/safety.js forget through services/saving.js, src/migrate.js gsData.forget), so Put back can't bring its work back; if
// that fails nothing is forgotten and she can try again. Then its tombstone, so a synced copy or a linked folder lets it go too, and
// everything of it in this browser. The card stays. The papers come back the way they do in the current app: bringing the download
// in again (mark/open.js bringIn, students/write.js bringBack), with no marks or scores. Asked first, and the box says so.
export function Forget({ it, id, onClose }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const S = saving(); if (!S || !S.safetyForget) throw new Error('No safety copies here yet'); await S.safetyForget(id); }
    catch (e) { console.error(e); toast(t('class.fg_failed')); onClose(false); return; }
    try {
      const [W, S, M, P] = await Promise.all([PARTS.write(), import('../../students/index.js'), import('../../engines/merge.js'), import('../../students/prefs.js')]);
      const tb = S.deleted.json({}) || {}, now = Date.now();
      if (!tb[id]) { const w = await S.newestWork(id); tb[id] = { t: now, name: it.name || '', v: M.vJoin(M.workVec(w), { ['!' + id + ':' + now]: 1 }) }; W.takeTombs(tb, 'local'); }
      await W.dropDownload(id, 'local');
      const seen = P.prefs.get('gs.openSeen', {}) || {}; if (seen[id]) { delete seen[id]; P.prefs.set('gs.openSeen', seen); }
      toast(t('class.fg_done', { name: it.name }));
    } catch (e) { console.error(e); toast(t('class.fg_failed')); }
    onClose(true);
  };
  return <Dialog open title={t('class.fg_t', { name: it.name })} onClose={() => onClose(false)}
    actions={<><Button onClick={() => onClose(false)}>{t('setup.u_cancel')}</Button><Button variant="primary" disabled={busy} onClick={go} data-fgok>{t('class.fg_ok')}</Button></>}>
    <p>{t('class.fg_text')}</p><p>{t('class.fg_back')}</p></Dialog>;
}

// A unit's link to its unit plan in the school's curriculum tool (src/app/screens.js askAtlas): a web link; empty takes it off.
export function UnitLink({ u, tool, onClose }) {
  const [v, setV] = useState(u.atlas || ''), [err, setErr] = useState('');
  const save = async () => {
    let x = v.trim();
    if (x && !/^https?:\/\//i.test(x)) x = 'https://' + x;
    if (x && !/^https?:\/\/[^\s]+$/i.test(x)) { setErr(t('class.ul_bad')); return; }
    await lc(t('class.ul_step'), l => { const g = unitIn(l, u.id); if (!g) return; if (x) g.u.atlas = x; else delete g.u.atlas; });
    onClose(true);
  };
  return <Dialog open title={t('class.ul_t', { name: u.name })} onClose={() => onClose(false)}
    actions={<><Button onClick={() => onClose(false)}>{t('setup.u_cancel')}</Button><Button variant="primary" onClick={save} data-ulok>{t('class.as_save')}</Button></>}>
    <TextInput type="url" label={tool ? t('class.ul_label_n', { name: tool }) : t('class.ul_label')} hint={t('class.ul_hint')} value={v} onInput={x => { setV(x); setErr(''); }} error={err} autofocus data-ulink
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
  </Dialog>;
}

// A unit moved to another class (src/app/screens.js, a unit dragged onto a class): at the end of that class's units, its cards
// taking that class.
export function UnitTo({ lib, u, onClose }) {
  const here = unitIn(lib, u.id), all = holders(lib).filter(c => !here || c !== here.c);
  const move = async c => {
    const id = String(c.id);
    const ok = await lc(t('setup.u_move'), l => { const g = unitIn(l, u.id), d = holderOf(l, id); if (!g || !d || g.c === d) return; g.c.units.splice(g.c.units.indexOf(g.u), 1); d.units.push(g.u); for (const it of g.u.items) it.classId = d.id; });
    onClose(true);
    if (ok !== false) toast(t('setup.u_moved', { name: nameOf(lib, c) }), { undo: () => undoList.undo() });
  };
  return <Dialog open title={t('setup.u_move_t', { name: u.name })} onClose={() => onClose(false)} actions={<Button onClick={() => onClose(false)}>{t('setup.u_cancel')}</Button>}>
    <ul class="mk-mvlist">{all.map(c => <li><Button variant="quiet" onClick={() => move(c)} data-unitto={String(c.id)}><span data-raw={c === lib.loose ? undefined : ''}>{nameOf(lib, c)}</span></Button></li>)}</ul>
  </Dialog>;
}

// No papers: just type the scores (src/book.js bkTypeOnly): the assignment's own empty column in the class gradebook, out of its
// total (a rubric assignment's column takes percents), opened for typing. An MYP class goes to its gradebook as it is. Needs a
// class with a roster. Returns what the gradebook's address ends with, or null.
export async function typeOnly(lib, it) {
  const f = itemIn(on(lib), it.id), c = f && f.c !== lib.loose ? f.c : null;
  if (!c || !c.names.length) { toast(t('class.to_roster')); return null; }
  if (B.classWay(c) === 'myp') return '';
  if (!it.typed && !it.batchId) {
    const [G, S] = await Promise.all([import('../../engines/gcore.js'), import('../../students/index.js')]);
    const su = G.setupOver(it.setup || S.gradingSetup.json(null)), m = su.mode === 'rubric' ? 0 : G.setupMax(su);
    const ok = await lc(t('class.to_step'), l => { const g = itemIn(l, it.id); if (g && !g.it.typed) g.it.typed = { max: m > 0 ? m : null, s: {} }; });
    if (ok === false) return null;
  }
  return 'type-' + it.id;
}
