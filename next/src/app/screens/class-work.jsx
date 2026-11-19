// A class's assignments (the current app's class page, Assignments: src/app/screens.js renderLib), loaded as a part of their own
// (router.js PARTS.work): each unit's cards with where their papers stand, the same words as Home, and the way to their papers:
// Open when they are kept in this browser, or Bring in papers, which reads them the way the current app reads a download dropped
// on it (mark/open.js bringIn), keeps them, links the card to them and opens them for marking. Units are added, renamed and deleted
// here, and an assignment moves to another unit or class (src/app/screens.js addunit, urename, udel, its drag and drop), each one
// undo step (students/undo.js libraryChange); a deleted unit comes back with Undo, with no question first. Cards and units change
// order with Move up and Move down or by dragging. New assignment (at the top and at each unit's end), Edit assignment, No papers,
// Forget these papers and a unit's plan link open the boxes in class/assignment.jsx. Its lines are in next/lang/mark.en.json
// (mark.cw_*), which this screen loads anyway, so the screen stays inside its size budget.
import * as tabs from '../../shared/tabs.js';
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, EmptyState, Menu, Dialog, TextInput, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go, PARTS } from '../router.js';
import { usePart } from '../parts.js';
import { readLibrary, readKept, stateOf, backOf, canOpen } from '../../students/counts.js';
import { libraryChange } from '../../students/undo.js';
import * as undoList from '../../services/undo.js';
import { onSaved } from '../../shared/saved.js';
import '../mark/lines.js';
import '../mark/setup-lines.js';
import { useSaving } from '../../services/saving.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const lc = (label, fn) => libraryChange(t(label), fn, true).catch(e => { console.error(e); toast(t('mark.cannot')); });
const holderOf = (l, id) => (id === '-' || id === '' ? l.loose : l.classes.find(x => String(x.id) === String(id)));
// The same change on the library as saved (it's read fresh there): a unit or a card found by its id.
const unitIn = (l, id) => { for (const c of [...l.classes, l.loose]) { const u = c.units.find(x => x.id === id); if (u) return { c, u }; } return null; };
const itemIn = (l, id) => { for (const c of [...l.classes, l.loose]) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };

// A unit's name: a new one, or a new name for one there is.
function NameUnit({ was, onDone }) {
  const [v, setV] = useState(was.name);
  const ok = () => { if (v.trim()) onDone(v.trim()); };
  return <Dialog open title={t(was.id ? 'setup.u_rename_t' : 'setup.u_add_t')} onClose={() => onDone(null)}
    actions={<><Button onClick={() => onDone(null)}>{t('setup.u_cancel')}</Button><Button variant="primary" disabled={!v.trim()} onClick={ok} data-uok>{t(was.id ? 'setup.u_rename' : 'setup.u_add')}</Button></>}>
    <TextInput label={t('setup.u_name')} value={v} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } }} data-uname autofocus />
  </Dialog>;
}
// Move to…: every unit of every class, and No class; the card goes to the end of the one picked and takes that class.
function MoveTo({ lib, it, onDone }) {
  const here = itemIn(lib, it.id), all = [...lib.classes.map(c => ({ c, name: c.name })), { c: lib.loose, name: t('setup.u_noclass') }];
  return <Dialog open title={t('setup.u_move_t', { name: it.name })} onClose={() => onDone(null)} actions={<Button onClick={() => onDone(null)}>{t('setup.u_cancel')}</Button>}>
    {all.filter(x => x.c.units.length).map(x => <div class="wmove"><h4 class="t6" data-raw>{x.name}</h4>
      <ul class="mk-mvlist">{x.c.units.map(u => <li><Button variant="quiet" disabled={here && here.u.id === u.id} onClick={() => onDone(u.id)} data-moveto={u.id}><span data-raw>{u.name}</span></Button></li>)}</ul></div>)}
  </Dialog>;
}

const KIND = { sum: 'setup.k_sum', ic: 'setup.k_ic', fm: 'setup.k_fm', xc: 'setup.k_xc' };
// Where the papers stand, in the words the current app uses on its class page and Home (keptState).
function standing(lib, kept, it) {
  const m = it.batchId ? kept.get(it.batchId) : null;
  if (!m) return { key: it.typed ? 'setup.s_typed' : 'setup.s_none', cls: '' };
  const s = stateOf(lib, kept, m), back = !!backOf(m), began = s.done || (!s.fm && m.partial);
  if (!s.of) return { key: 'setup.s_none', cls: '', m };
  if (!s.left) return { key: back ? 'setup.s_returned' : 'setup.s_ready', cls: back ? 'ret' : 'ok', m, s };
  return { key: began ? (s.fm ? 'setup.s_feedback' : 'setup.s_scoring') : 'setup.s_started_not', cls: began ? 'on' : '', m, s };
}
// A row's details (the current app's card: keptSay, the early-returned chip and its Open): how many are scored, partial, missing or
// excused, who got theirs early, when the papers came in and went back, and the way to each marking step.
const day = ms => date(new Date(ms), { day: 'numeric', month: 'short' });
function Details({ it, st }) {
  const m = st.m, s = st.s, open = m && canOpen(m), back = m && backOf(m);
  if (!m) return <div class="wdet" data-wdet={it.id}><p class="mute">{t(st.key)}</p></div>;
  const bits = s && s.of ? [t(s.fm ? 'setup.w_fb' : 'setup.w_scored', { done: s.done, of: s.of })] : [];
  if (s && !s.fm && m.partial) bits.push(t('setup.w_partial', { n: m.partial }));
  if (m.off) bits.push(t('setup.w_off', { n: m.off }));
  const early = s && m.sent && !back ? Math.min(s.of, m.sent) : 0;
  return <div class="wdet" data-wdet={it.id}>
    {!!bits.length && <p data-wsay>{bits.join(' · ')}</p>}
    {s && s.of > 0 && <span class="wbar" role="img" aria-label={bits[0]}><i style={{ width: Math.round(s.done / s.of * 100) + '%' }} /></span>}
    <p class="mute">{[m.t && t('setup.w_brought', { d: day(m.t) }), back ? t('setup.w_back_on', { d: day(back) }) : early ? t('setup.w_early_n', { n: early }) : '', !open && t('setup.w_kept_not')].filter(Boolean).join(' · ')}</p>
    {open && <div class="wgo">{[['mark', t('setup.w_open')], ['grades', t('setup.w_grades')], ['insights', t('setup.w_insights')], ['return', t('setup.w_return')]].map(([k, l]) => <a class="btn sm" href={href('mark', m.id, k === 'mark' ? null : k)} data-wgo={k}>{l}</a>)}</div>}
  </div>;
}
// Files from a picker or a drop: each with the path it had (a folder keeps its folders, as the current app reads them).
const entriesOf = files => [...files].map(f => ({ path: f.webkitRelativePath || f.name, file: f }));

// A card or a unit dragged within the tab: its own kind of drag, so dropped papers still come in as papers.
const CARD = 'application/x-gs-card', UNIT = 'application/x-gs-unit';
const dragging = (e, k) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes(k);

export default function ClassWork({ classId, sub }) {
  const [lib, setLib] = useState(null), [kept, setKept] = useState(null), [busy, setBusy] = useState(null);
  const files = useRef(null), folder = useRef(null), scan = useRef(null), want = useRef(null), fromDrive = useRef(null), [ask, setAsk] = useState(null), [split, setSplit] = useState(null);
  const [name, setName] = useState(null), [move, setMove] = useState(null);
  const [shown, setShown] = useState(() => new Set());
  // the assignment's own boxes (class/assignment.jsx): New and Edit, No papers, Forget, a unit's link and its move to another class
  const [box, setBox] = useState(null);
  const open = (kind, o) => PARTS.asg().then(A => setBox({ A, kind, ...o }), e => console.error(e));
  const shut = () => { setBox(null); load(); };
  // #/class/<id>/work/new (Find's New assignment): the New box, and the address back to the tab
  useEffect(() => { if (sub === 'new') { open('asg', { unitId: null }); location.replace(href('class', classId, 'work')); } }, [sub, classId]);
  const L = usePart('linked', true);   // linked classes (class/linked.jsx)
  const flip = id => setShown(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [tm, setTm] = useState(null);
  const counts = () => { readKept().then(setKept); PARTS.asg().then(A => A.timing().then(E => setTm({ A, E }))).catch(e => console.error(e)); };
  const load = () => { setLib(readLibrary()); counts(); };
  useEffect(load, [classId]);
  useEffect(() => onSaved(e => { if (e.kind === 'library') setLib(readLibrary()); else if (e.side === 'students' && (e.kind === 'papers' || e.kind === 'work')) counts(); }), []);   // counts filled in at load (H-047, B-903)
  // another window changed the library or saved marks in a download (src/folder.js libNews, src/saving.js; audit H-062, H-063)
  useEffect(() => { const offs = [tabs.on('library', k => { if (k === 'gs.lib') setLib(readLibrary()); }), tabs.on('saved', () => counts())]; return () => offs.forEach(f => f()); }, []);
  // A card or a unit dragged onto a class in the sidebar (src/app/screens.js railDragTarget): a card goes to that class's unit of the
  // same name (made if it isn't there), a unit to the end of that class. One undo step. Only this tab's own drags count.
  useEffect(() => {
    const D = document, ev = ['dragover', 'drop', 'dragend'], clear = k => D.querySelectorAll('[data-shell-nav] .over').forEach(n => n !== k && n.classList.remove('over'));
    const at = e => { const a = e.target.closest && e.target.closest('[data-shell-nav] .sclasses a[href^="#/class/"]'), id = a && decodeURIComponent(a.hash.split('/')[2]);
      return a && (dragging(e, CARD) || dragging(e, UNIT)) && id !== 'new' && id !== String(classId) ? { a, id } : null; };
    const on = e => {
      const x = e.type !== 'dragend' && at(e); clear(x && e.type === 'dragover' && x.a); if (!x) return;
      e.preventDefault(); e.stopPropagation();
      if (e.type === 'dragover') return x.a.classList.add('over');
      const card = dragging(e, CARD) && e.dataTransfer.getData(CARD), unit = e.dataTransfer.getData(UNIT);
      let where = '';
      lc('setup.u_move', l => {
        const to = holderOf(l, x.id), f = card ? itemIn(l, card) : unitIn(l, unit); if (!to || !f || f.c === to) return;
        if (card) { let u = to.units.find(k => k.name === f.u.name); if (!u) to.units.push(u = { id: uid(), name: f.u.name, items: [] }); f.u.items.splice(f.u.items.indexOf(f.it), 1); u.items.push(f.it); f.it.classId = to.id; }
        else { f.c.units.splice(f.c.units.indexOf(f.u), 1); to.units.push(f.u); for (const k of f.u.items) k.classId = to.id; }
        where = to === l.loose ? t('setup.u_noclass') : to.name;
      }).then(() => where && toast(t('setup.u_moved', { name: where }), { undo: () => undoList.undo() }));
    };
    ev.forEach(k => D.addEventListener(k, on, true)); return () => ev.forEach(k => D.removeEventListener(k, on, true));
  }, [classId]);
  if (!lib || !kept) return <div class="loading" aria-busy="true" />;
  const c = classId === '-' ? lib.loose : lib.classes.find(x => String(x.id) === String(classId));
  if (!c) return <EmptyState icon="inbox" title={t('setup.w_none')} />;
  // list: picked or dropped files, or entries made already (matched to a roster: each path "Name/file", and the class they matched)
  const bring = async (it, list, cls) => {
    if (!list.length || busy) return;
    setBusy(it.id);
    try {
      const O = await PARTS.bring();
      // a newer copy of a download she has worked on: asked whether her marks and scores come over, when it isn't plainly the same one
      const carry = e => new Promise(done => setAsk({ e, done: v => { setAsk(null); done(v); } }));
      const drive = fromDrive.current; fromDrive.current = null;
      const r = await O.bringIn(list[0] && list[0].file ? list : entriesOf(list), { assignment: it, label: it.name, carry, drive });
      if (r && cls) (await PARTS.bringin()).classAfter(r.batch.id, cls.id);
      if (r && r.changed) toast(t('setup.c_changed_toast', { n: r.changed }), { ms: 7000 });
      if (r) go('mark', r.batch.id);
    } catch (e) { console.error(e); toast(e && e.name === 'NothingIn' ? t('setup.w_nothing') : e && e.name === 'CannotSave' ? t('mark.cannot') : t('setup.w_failed')); }
    finally { setBusy(null); load(); }
  };
  const pick = (it, el) => { want.current = it; fromDrive.current = null; el.current.value = ''; el.current.click(); };
  // From Google Drive (src/app/drive.js openFromDrive): the papers picked in Google's chooser come in as files from the computer do
  const S = useSaving(), driveItem = it => (S && S.google().pickNow ? [{ label: t('file.from_drive_pick'), icon: 'drive', onSelect: () => { want.current = it; S.driveFill(files.current, { title: t('drive.pick_many'), picked: p => { fromDrive.current = p[0] && { id: p[0].id, name: p[0].name, kind: p.length === 1 && /\.zip$/i.test(p[0].name) ? 'zip' : 'files' }; } }).catch(e => { console.error(e); toast(t('drive.failed')); }); } }] : []);
  // Files to match to a roster (mark/bringin.jsx MatchRoster): picked, matched to a class's names, then opened as above
  const [match, setMatch] = useState(null);
  const matchFor = it => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true;
    i.onchange = async () => { const B = await PARTS.bringin(), list = await B.expand([...i.files]); if (!list.length) return toast(t('setup.bf_nothing')); setMatch({ B, it, list }); }; i.click(); };
  const units = c.units;
  const named = async v => {
    const was = name; setName(null); if (!v) return;
    if (was.id) await lc('setup.u_rename', l => { const f = unitIn(l, was.id); if (f) f.u.name = v; });
    else await lc('setup.u_add', l => { const h = holderOf(l, classId); if (h) h.units.push({ id: uid(), name: v, items: [] }); });
  };
  // Delete unit (src/app/screens.js udel): asked first when it holds assignments; an empty one goes at once. Undo either way.
  const [sure, setSure] = useState(null);
  const drop = async u => {
    const n = u.items.length; setSure(null);
    await lc('setup.u_del', l => { const f = unitIn(l, u.id); if (f) f.c.units.splice(f.c.units.indexOf(f.u), 1); });
    toast(n ? t('setup.u_gone_n', { name: u.name, n }) : t('setup.u_gone', { name: u.name }), { undo: () => undoList.undo() });
  };
  const moved = async to => {
    const it = move; setMove(null); if (!to) return;
    let where = '';
    await lc('setup.u_move', l => { const f = itemIn(l, it.id), d = unitIn(l, to); if (!f || !d || f.u === d.u) return; f.u.items.splice(f.u.items.indexOf(f.it), 1); d.u.items.push(f.it); f.it.classId = d.c.id; where = d.u.name; });
    if (where) toast(t('setup.u_moved', { name: where }), { undo: () => undoList.undo() });
  };
  const more = it => ({ label: t('setup.u_move'), icon: 'arrow', onSelect: () => setMove(it) });
  // Edit, and the keyboard's way to change the order (the current app's drag and drop): a card up or down in its unit, a unit up or
  // down in the class. Each one undo step.
  const edit = it => ({ label: t('mark.cw_as_edit_menu'), sub: t('mark.cw_as_edit_sub'), icon: 'edit', onSelect: () => open('asg', { it }) });
  const step = (list, id, d) => { const i = list.findIndex(x => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= list.length) return false; [list[i], list[j]] = [list[j], list[i]]; return true; };
  const order = fn => lc('mark.cw_o_step', fn);
  const itemSteps = (it, u) => { const i = u.items.indexOf(it); return [{ label: t('mark.cw_o_up'), icon: 'chu', disabled: i <= 0, onSelect: () => order(l => { const f = itemIn(l, it.id); if (f) step(f.u.items, it.id, -1); }) },
    { label: t('mark.cw_o_down'), icon: 'chd', disabled: i >= u.items.length - 1, onSelect: () => order(l => { const f = itemIn(l, it.id); if (f) step(f.u.items, it.id, 1); }) }]; };
  // a card dropped on a card goes before it; on a unit, at its end. It takes that unit's class.
  const dropCard = (id, unitId, before) => { if (id === before) return; order(l => { const f = itemIn(l, id), d = unitIn(l, unitId); if (!f || !d) return; f.u.items.splice(f.u.items.indexOf(f.it), 1); const at = before ? d.u.items.findIndex(x => x.id === before) : -1; d.u.items.splice(at < 0 ? d.u.items.length : at, 0, f.it); f.it.classId = d.c.id; }); };
  const dropUnit = (id, before) => { if (id === before) return; order(l => { const f = unitIn(l, id), d = unitIn(l, before); if (!f || !d) return; f.c.units.splice(f.c.units.indexOf(f.u), 1); d.c.units.splice(d.c.units.indexOf(d.u), 0, f.u); if (f.c !== d.c) for (const x of f.u.items) x.classId = d.c.id; }); };
  const tool = String((lib.me || {}).unit || '').trim();
  // No papers: a notes page for each student; or only typed scores, in the gradebook
  const noPapers = it => [{ label: t('mark.cw_sn_menu'), icon: 'play', onSelect: () => open('notes', { it }) },
    ...(it.batchId ? [] : [{ label: t('mark.cw_to_menu'), icon: 'edit', onSelect: () => PARTS.asg().then(A => A.typeOnly(lib, it)).then(r => { if (r != null) go('class', classId, 'grades', r || null); }, e => console.error(e)) }])];
  const forget = (it, m) => ({ label: t('mark.cw_fg_menu'), icon: 'trash', onSelect: () => open('forget', { it, id: m.id }) });
  const links = it => (L ? L.linkItems(lib, classId, it) : []);
  // Make a quiz… (mark/quizmaker.jsx): questions with bubbles, printed with each student's name and scored from the scan
  const [qmk, setQmk] = useState(null);
  const quiz = it => ({ label: t(it.quiz && it.quiz.made ? 'setup.qf_edit' : 'setup.qf_make'), icon: 'check', onSelect: () => PARTS.quizmaker().then(Q => setQmk({ Q, it }), e => console.error(e)) });
  const quizScan = it => (it.quiz && it.quiz.made ? [{ label: t('setup.qf_scan'), icon: 'image', onSelect: () => pick(it, scan) }] : []);
  return <section class="classwork" aria-labelledby="h-work">
    <h2 id="h-work" class="sr">{t('setup.w_title')}</h2>
    {L && <L.LinkedHead lib={lib} classId={classId} />}
    {c === lib.loose && c.units.some(u => u.items.length) && <p class="mute" data-loose-say>{t('mark.cw_loose_say')}</p>}
    {match && <match.B.MatchRoster list={match.list} lib={lib} classId={classId} onClose={() => setMatch(null)} onGo={(entries, cls) => bring(match.it, entries, cls)} />}
    {ask && <Dialog open title={t('setup.c_ask_t')} onClose={() => ask.done(false)}
      actions={<><Button onClick={() => ask.done(false)} data-fresh>{t('setup.c_fresh')}</Button><Button variant="primary" onClick={() => ask.done(true)} data-carry>{t('setup.c_bring')}</Button></>}>
      <p data-raw>{t('setup.c_ask', { name: ask.e.name || t('setup.c_noname') })}</p>
      <p>{ask.e.unchecked ? t('setup.c_ask_unchecked') : t('setup.c_ask_same', { named: ask.e.named, all: ask.e.nOld, n: ask.e.same })}</p>
      <p>{t('setup.c_ask_q')}</p></Dialog>}
    <input ref={files} type="file" multiple hidden accept=".zip,.pdf,.docx,.docm,.doc,.png,.jpg,.jpeg,.heic,.heif,.gif,.webp,.mp4,.mov,.m4v,.webm,.mp3,.m4a,.wav,.txt,.md"
      onChange={e => bring(want.current, e.currentTarget.files)} data-bring="files" />
    <input ref={folder} type="file" multiple hidden webkitdirectory="" onChange={e => bring(want.current, e.currentTarget.files)} data-bring="folder" />
    {/* a scan of everyone's papers, split page by page onto names (mark/split.jsx) */}
    <input ref={scan} type="file" hidden accept=".pdf,application/pdf" data-bring="scan"
      onChange={e => { const f = e.currentTarget.files[0], it = want.current; if (f) PARTS.split().then(S => setSplit({ S, f, it }), er => console.error(er)); }} />
    {name && <NameUnit was={name} onDone={named} />}
    {sure && <Dialog open title={t('mark.cw_ud_q', { name: sure.name })} onClose={() => setSure(null)}
      actions={<><Button onClick={() => setSure(null)}>{t('setup.u_cancel')}</Button><Button variant="primary" onClick={() => drop(sure)} data-udel-ok>{t('setup.u_del')}</Button></>}>
      <p>{t('mark.cw_ud_say', { n: sure.items.length })}</p></Dialog>}
    {move && <MoveTo lib={lib} it={move} onDone={moved} />}
    {box && box.kind === 'asg' && <box.A.AssignmentDialog lib={lib} it={box.it} classId={classId} unitId={box.unitId} onClose={shut} />}
    {box && box.kind === 'notes' && <box.A.StartNotes lib={lib} it={box.it} bring={list => bring(box.it, list)} onClose={() => setBox(null)} />}
    {box && box.kind === 'forget' && <box.A.Forget it={box.it} id={box.id} onClose={shut} />}
    {box && box.kind === 'ulink' && <box.A.UnitLink u={box.u} tool={tool} onClose={shut} />}
    {box && box.kind === 'unitto' && <box.A.UnitTo lib={lib} u={box.u} onClose={shut} />}
    <div class="row gap"><Button size="sm" variant="primary" icon="plus" onClick={() => open('asg', { unitId: null })} data-newasg>{t('mark.cw_as_new')}</Button></div>
    {qmk && <qmk.Q.QuizMaker it={qmk.it} names={((lib.classes.find(k => String(k.id) === String(qmk.it.classId)) || {}).names || []).slice()} onClose={() => { setQmk(null); load(); }} />}
    {split && <split.S.Split file={split.f} asg={split.it} lib={lib} onClose={() => { setSplit(null); load(); }} />}
    {!units.length ? <EmptyState icon="inbox" title={t('setup.w_none')} />
      : units.map((u, ui) => <div class="wunit" data-unit={u.id}
        onDragOver={e => { if (dragging(e, CARD) || dragging(e, UNIT)) e.preventDefault(); }}
        onDrop={e => { if (dragging(e, UNIT)) { e.preventDefault(); dropUnit(e.dataTransfer.getData(UNIT), u.id); } else if (dragging(e, CARD)) { e.preventDefault(); dropCard(e.dataTransfer.getData(CARD), u.id, null); } }}>
        <div class="whead"><h3 class="t5" data-raw draggable="true" onDragStart={e => { e.dataTransfer.setData(UNIT, u.id); e.dataTransfer.effectAllowed = 'move'; }}>{u.name}</h3>
        {u.atlas && <a class="link small" href={u.atlas} target="_blank" rel="noopener noreferrer" data-uatlas={u.id}>{tool ? t('mark.cw_ul_open_n', { name: tool }) : t('mark.cw_ul_open')} ↗</a>}
        <Menu label={t('setup.u_more', { name: u.name })} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('setup.u_more', { name: u.name })} data-umenu={u.id} />}
          items={[{ label: t('setup.u_rename'), icon: 'edit', onSelect: () => setName(u) },
            { label: t('mark.cw_o_up'), icon: 'chu', disabled: ui === 0, onSelect: () => order(l => { const f = unitIn(l, u.id); if (f) step(f.c.units, u.id, -1); }) },
            { label: t('mark.cw_o_down'), icon: 'chd', disabled: ui === units.length - 1, onSelect: () => order(l => { const f = unitIn(l, u.id); if (f) step(f.c.units, u.id, 1); }) },
            { label: t('mark.cw_uc_move'), icon: 'arrow', onSelect: () => open('unitto', { u }) },
            { label: u.atlas ? (tool ? t('mark.cw_ul_change_n', { name: tool }) : t('mark.cw_ul_change')) : tool ? t('mark.cw_ul_add_n', { name: tool }) : t('mark.cw_ul_add'), icon: 'link', onSelect: () => open('ulink', { u }) },
            { label: t('setup.u_del'), icon: 'trash', onSelect: () => (u.items.length ? setSure(u) : drop(u)) }]} /></div>
        {!u.items.length && <p class="mute wempty">{t('setup.u_empty')}</p>}
        {!!u.items.length && <ul class="wlist">{u.items.map(it => { const st = standing(lib, kept, it), open = st.m && canOpen(st.m);
          return <li class="wrow" data-item={it.id} draggable="true" onDragStart={e => { if (e.target.closest && e.target.closest('a,button')) return; e.dataTransfer.setData(CARD, it.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={e => { if (dragging(e, UNIT)) return; e.preventDefault(); e.currentTarget.classList.add('over'); }} onDragLeave={e => e.currentTarget.classList.remove('over')}
            onDrop={e => { if (dragging(e, UNIT)) return; e.currentTarget.classList.remove('over'); e.preventDefault(); e.stopPropagation(); if (dragging(e, CARD)) dropCard(e.dataTransfer.getData(CARD), u.id, it.id); else bring(it, e.dataTransfer.files); }}>
            <div class="wn"><span class="wnm"><IconButton icon={shown.has(it.id) ? 'chd' : 'chr'} size="sm" label={t('setup.w_more', { name: it.name })} aria-expanded={shown.has(it.id) ? 'true' : 'false'} onClick={() => flip(it.id)} data-wmore={it.id} />{open ? <a class="wname" href={href('mark', st.m.id)} data-wname={it.id}><b data-raw>{it.name}</b></a>
                : it.typed && !it.batchId ? <a class="wname" href={href('class', classId, 'grades', 'type-' + it.id)} data-wname={it.id}><b data-raw>{it.name}</b></a>
                : <button type="button" class="wname" onClick={e => { const b = e.currentTarget.closest('.wrow').querySelector('[data-bring-for]'); if (b) b.click(); }} data-wname={it.id}><b data-raw>{it.name}</b></button>}
              {it.typed && it.type !== 'xc' && <span class="tag" data-wtyped>{t('mark.cw_typed')}</span>}</span>{L && <L.AlsoIn lib={lib} it={it} />}
              <small class="mute">{[KIND[it.type] && t(KIND[it.type]), it.due && t('setup.w_due', { d: date(new Date(it.due + 'T12:00'), { day: 'numeric', month: 'short' }) }), tm && tm.A.asgTime(tm.E, it.id)].filter(Boolean).join(' · ')}</small></div>
            <span class={'wst ' + st.cls}>{t(st.key)}{st.s && st.s.left ? ' · ' + t('home.left_of', { left: st.s.left, of: st.s.of }) : ''}
              {/* some got theirs early, one at a time */}
              {st.s && st.m.sent > 0 && st.m.sent < st.s.of && !backOf(st.m) && <span class="wearly" title={t('setup.w_early_tip')} data-wearly>{t('setup.w_early', { sent: st.m.sent, of: st.s.of })}</span>}</span>
            {open ? <span class="wopen"><a class="btn sm" href={href('mark', st.m.id)}>{t('setup.w_open')}</a>
              {/* a newer copy of the papers: her work comes over (mark/carry.js) */}
              <Menu label={t('setup.w_again')} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('setup.w_again')} disabled={busy === it.id} data-again-for={it.id} />}
                items={[{ label: t('setup.w_again_files'), icon: 'file', onSelect: () => pick(it, files) }, { label: t('setup.w_again_folder'), icon: 'folder', onSelect: () => pick(it, folder) }, ...driveItem(it), edit(it), quiz(it), more(it), ...itemSteps(it, u), ...links(it), forget(it, st.m)]} /></span>
              : <span class="wopen"><Menu label={t('setup.w_bring')} trigger={b => <Button {...b} size="sm" icon="upload" disabled={busy === it.id} data-bring-for={it.id}>{t('setup.w_bring')}</Button>}
                items={[{ label: t('setup.w_files'), icon: 'file', onSelect: () => pick(it, files) }, { label: t('setup.w_folder'), icon: 'folder', onSelect: () => pick(it, folder) }, ...driveItem(it), { label: t('setup.w_scan'), icon: 'image', onSelect: () => pick(it, scan) }, { label: t('setup.mr_menu'), icon: 'people', onSelect: () => matchFor(it) }, ...noPapers(it)]} />
              <Menu label={t('setup.u_item_more', { name: it.name })} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('setup.u_item_more', { name: it.name })} data-more-for={it.id} />} items={[edit(it), quiz(it), ...quizScan(it), more(it), ...itemSteps(it, u), ...links(it)]} /></span>}
            {shown.has(it.id) && <Details it={it} st={st} />}
          </li>; })}</ul>}
        <div><Button size="sm" variant="quiet" icon="plus" onClick={() => open('asg', { unitId: u.id })} aria-label={t('mark.cw_as_plus_in', { name: u.name })} data-additem={u.id}>{t('mark.cw_as_plus')}</Button></div></div>)}
    {classId !== '-' && <div><Button size="sm" icon="plus" onClick={() => setName({ name: t('setup.u_new', { n: units.length + 1 }) })} data-addunit>{t('setup.u_add')}</Button></div>}
    <p class="mute hint">{t('setup.w_drop')}</p>
  </section>;
}
