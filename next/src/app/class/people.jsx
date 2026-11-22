// A class's People tab (design screenshot 5's People): the roster at the left with a box to find a student, and one student's page
// at the right: their average this term, missing work, attendance, how their recent work went, and notes. Everything about a
// student is read from the gradebook's engine (students/book.js) and the class as saved; a change (the roster edited, a student
// moved or taken off, a note) is the current app's own change (lifted parseRosterRows, keepInfo, keepAtt, setInfo), one undo step.
// The address carries the student's place on the roster (#/class/<id>/people/<n>), never a name, as the current app does.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, EmptyState, Dialog, Sheet, TextInput, Segmented, Menu, CopyButton, Mic, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href, go, PARTS } from '../router.js';
import * as undoList from '../../services/undo.js';
import { useBook, classBook } from './data.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { initials, pct, typeName, leftOf } from './grades.jsx';
import { usePart } from '../parts.js';
import { openMail } from './mail.js';
import { copyText } from '../../services/clipboard.js';
import { AttendSheet, AttStudent, attOn } from './attend.jsx';
import { SeatingSheet } from './seating.jsx';
import { GoalsStudent } from './goals.jsx';
import './lines.js';
import { DriveButton } from '../drive-button.jsx';

const uid = () => Math.random().toString(36).slice(2, 10);

// The roster box (src/app/screens.js editClass): the class's name and its students one per line, in the order they are pasted; a
// .csv or .txt list read the same way, with any student ID and email kept as that student's details. Saved as one undo step.
export function RosterDialog({ c, onClose }) {
  const [name, setName] = useState(c ? c.name : ''), [names, setNames] = useState(c ? c.names.join('\n') : ''), up = useRef([]), file = useRef(null);
  const [err, setErr] = useState(''), [Gc, setGc] = useState(null), [sure, setSure] = useState(false), bk = useBook();
  // its place in the sidebar (src/app/screens.js cmove): one up or one down, one undo step each, while the box stays open
  const all = bk && !bk.error ? bk.lib.classes : [], at = c ? all.findIndex(k => String(k.id) === String(c.id)) : -1;
  const place = d => change(t('class.u_order'), l => { const a = l.classes.findIndex(k => String(k.id) === String(c.id)), j = a + d; if (a < 0 || j < 0 || j >= l.classes.length) return; [l.classes[a], l.classes[j]] = [l.classes[j], l.classes[a]]; }, true).catch(e => console.error(e));
  // Delete (src/app/screens.js editClass): asked first; its units and assignments move to No class, and Undo puts it all back
  const del = async () => {
    let moved = false;
    await change(t('class.del_class'), l => {
      const i = l.classes.findIndex(k => String(k.id) === String(c.id)); if (i < 0) return;
      l.loose ||= { id: '', units: [] };
      for (const u of l.classes[i].units) { for (const it of u.items) { it.classId = ''; moved = true; } l.loose.units.push(u); }
      l.classes.splice(i, 1);
    }, true);
    onClose(null);
    go(...(moved ? ['class', '-', 'work'] : ['home']));
    toast(t('class.del_done', { name: c.name }), { undo: () => undoList.undo() });
  };
  if (sure) return <Dialog open title={t('class.del_q', { name: c.name })} onClose={() => setSure(false)}
    actions={<><Button onClick={() => setSure(false)}>{t('common.cancel')}</Button><Button variant="primary" onClick={del} data-class-delok>{t('class.del_ok')}</Button></>}>
    <p>{t('class.del_say')}</p></Dialog>;
  const read = async e => { const f = e.currentTarget.files[0]; if (!f) return; const rows = B.parseRosterRows(await f.text()); up.current = rows; setNames(rows.map(r => r.name).join('\n')); e.currentTarget.value = ''; };
  const save = async () => {
    const nm = name.trim(); if (!nm) { setErr(t('class.name_needed')); return; }
    const pasted = B.parseRosterRows(names), u = up.current;
    const rows = pasted.map(r => { const f = u.find(x => x.name === r.name) || {}; return { ...f, ...r, id: r.id || f.id || '', email: r.email || f.email || '' }; });
    let id = c && c.id;
    await change(c ? t('class.u_roster') : t('class.u_new_class'), l => {
      let k = c ? classIn(l, c.id) : null;
      if (!k) { k = { id: (id = uid()), name: nm, names: [], units: [] }; Object.assign(k, B.classNewWay()); l.classes.push(k); }
      const was = k.names, wasInfo = k.info; k.name = nm; k.names = rows.map(r => r.name); B.keepInfo(k, was, rows); B.keepAtt(k, was, wasInfo);
    }, true);
    onClose(id);
  };
  return <Dialog open title={t(c ? 'class.edit_roster' : 'class.new_class')} onClose={() => onClose(null)}
    actions={<>{c && <Button variant="quiet" onClick={() => setSure(true)} data-class-del>{t('class.del_class')}</Button>}<Button onClick={() => onClose(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-roster-save>{t('class.save')}</Button></>}>
    <TextInput label={t('class.class_name')} value={name} onInput={setName} error={err} data-roster-name autofocus={!c} />
    <label class="cp-fld"><span class="lab">{t('class.students_one_per_line')}</span>
      <textarea class="input roster-ta" rows="12" value={names} onInput={e => setNames(e.currentTarget.value)} placeholder={t('class.roster_ph')} data-roster-names /></label>
    <p class="mute small">{t('class.roster_note')}</p>
    <Button size="sm" icon="upload" onClick={() => file.current.click()} data-roster-file>{t('class.upload_list')}</Button><DriveButton input={file} />
    <input type="file" ref={file} accept=".csv,.txt,text/csv,text/plain" hidden onChange={read} data-roster-input />
    {c && all.length > 1 && <p class="row gap"><Button size="sm" variant="quiet" icon="chu" disabled={at <= 0} onClick={() => place(-1)} data-class-up>{t('class.c_up')}</Button>
      <Button size="sm" variant="quiet" icon="chd" disabled={at < 0 || at >= all.length - 1} onClick={() => place(1)} data-class-down>{t('class.c_down')}</Button></p>}
    {!c && <Button size="sm" icon="school" onClick={() => PARTS.gc().then(m => setGc(() => m.ClassroomSheet))} data-roster-gc>{t('class.gc_open')}</Button>}
    {Gc && <Gc onClose={(id, cols) => { setGc(null); if (id) go('class', id, cols ? 'grades' : 'people'); }} />}
  </Dialog>;
}

// Move a student to another class: off this roster (details and days stay with this class's record, as the current app keeps them
// for a student taken off), onto the end of the other one with their details.
function MoveDialog({ lib, c, n, onClose }) {
  const others = lib.classes.filter(k => k.id !== c.id);
  const move = async to => {
    await change(t('class.u_move', { name: n }), l => {
      const a = classIn(l, c.id), b = classIn(l, to); if (!a || !b || !a.names.includes(n)) return;
      const info = B.infoOf(a, n), was = a.names, wasInfo = a.info; a.names = was.filter(x => x !== n); B.keepInfo(a, was, []); B.keepAtt(a, was, wasInfo);
      if (!b.names.includes(n)) { const wb = b.names; b.names = [...wb, n]; if (Object.keys(info).length) B.setInfo(b, n, info); }
    }, true);
    onClose(true);
    toast(t('class.moved', { name: lib.classes.find(k => k.id === to).name }), { undo: () => undoList.undo() });
  };
  return <Dialog open title={t('class.move_t', { name: n })} onClose={() => onClose(false)} actions={<Button onClick={() => onClose(false)}>{t('common.cancel')}</Button>}>
    {others.length ? <ul class="mvlist">{others.map(k => <li><Button variant="quiet" onClick={() => move(k.id)} data-move-to={k.id}><span data-raw>{k.name}</span></Button></li>)}</ul> : <p class="mute">{t('class.no_other_class')}</p>}
  </Dialog>;
}

export default function People({ classId, sub, more }) {
  const b = useBook(), [find, setFind] = useState(''), [editing, setEditing] = useState(false), [term, setTerm] = useState(null), [moving, setMoving] = useState(null), [tool, setTool] = useState(null), Ps = usePart('sheets', !!(tool && tool.k === 'pss'));
  // Left and Right step to the previous and next student (src/book.js), unless she is typing or a box is open. Listened for here,
  // not on the student's card, which is drawn new for each student, so a key pressed just after a step is never missed.
  const stepRef = useRef(null);
  useEffect(() => { const k = e => {
    if (!stepRef.current || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    const a = document.activeElement; if (a && (a.matches('input,textarea,select,[contenteditable],[role="slider"],[role="radio"],[role="tab"]') || a.closest('[role="radiogroup"],[role="tablist"]'))) return;
    if (document.querySelector('dialog[open], .pop')) return;
    e.preventDefault(); stepRef.current(e.key === 'ArrowLeft' ? -1 : 1);
  }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  stepRef.current = null;
  // the page's own addresses (Find, the tab row, the current app's #/class/<id>/attendance/<day>): people/attendance[/<day>|/all],
  // people/seating, people/sheets open their sheet over the list
  useEffect(() => {
    if (!b || !['attendance', 'seating', 'sheets'].includes(sub)) return;
    setTool(sub === 'attendance' ? { k: 'att', d: more || undefined } : sub === 'seating' ? { k: 'seat' } : { k: 'pss' });
    location.replace(href('class', classId, 'people'));
  }, [b, sub, more]);
  if (!b) return <div class="loading" aria-busy="true" />;
  const x = classBook(b, classId);
  if (!x) return <EmptyState icon="warn" title={t('class.read_failed')} />;
  const { c } = x;
  const dlg = editing && <RosterDialog c={c} onClose={() => setEditing(false)} />;
  if (!c.names.length) return <><EmptyState icon="people" title={t('class.no_roster')} text={t('class.no_roster_text')} action={<span class="row gap"><Button variant="primary" icon="plus" onClick={() => setEditing(true)} data-roster-edit>{t('class.add_roster')}</Button>
    <a class="btn" href={href('class', classId, 'grades')} data-bki-go>{t('class.bki_menu')}</a></span>} />{dlg}</>;
  const i = sub && /^\d+$/.test(sub) && +sub >= 1 && +sub <= c.names.length ? +sub - 1 : 0, n = c.names[i];
  // the student's page for the whole year or any term (src/book.js bk.term on one student), the term now to begin with
  const tabs = B.bkTabs(x.cols), on = term != null && tabs.some(k => k[0] === term) ? term : x.now;
  const cols = on === '*' ? x.cols : x.cols.filter(k => (on == null ? true : k.termId === on)), grades = c.names.map(m => B.bkGrade(m, cols, x.conf));
  const termLabel = ([id, name]) => (id === '*' ? t('class.whole_year') : id === '' ? t(x.conf.terms.length ? 'class.outside_terms' : 'class.this_year') : name);
  const step = d => { const j = i + d; if (j >= 0 && j < c.names.length) go('class', classId, 'people', j + 1); };
  stepRef.current = step;
  const shown = c.names.map((m, j) => ({ m, j })).filter(r => !find.trim() || r.m.toLowerCase().includes(find.trim().toLowerCase()));
  const remove = async () => {
    await change(t('class.u_remove', { name: n }), l => { const k = classIn(l, c.id); if (!k) return; const was = k.names, wasInfo = k.info; k.names = was.filter(z => z !== n); B.keepInfo(k, was, []); B.keepAtt(k, was, wasInfo); }, true);
    go('class', classId, 'people', Math.min(i + 1, c.names.length - 1) || '');
    toast(t('class.removed', { name: n }), { undo: () => undoList.undo() });
  };
  return <div class="pgrid">
    <div class="card roster" role="navigation" aria-label={t('class.roster')}>
      <div class="rhead"><input class="input" type="search" placeholder={t('class.find_student')} aria-label={t('class.find_student')} value={find} onInput={e => setFind(e.currentTarget.value)} data-roster-find />
        <IconButton icon="edit" label={t('class.edit_roster')} onClick={() => setEditing(true)} data-roster-edit />
        <Menu label={t('class.roster_menu')} trigger={m => <IconButton {...m} icon="dots" label={t('class.roster_menu')} data-roster-menu />}
          items={[{ label: t('class.copy_emails'), icon: 'copy', onSelect: () => { const m = c.names.map(k => B.infoOf(c, k).email).filter(Boolean); if (!m.length) return toast(t('class.no_emails')); copyText(m.join('; ')).then(ok => toast(ok ? t('class.copied_emails', { n: m.length }) : t('class.copy_failed'))); } },
            { label: t('class.paste_ids'), sub: t('class.paste_ids_sub'), icon: 'paste', onSelect: () => setTool({ k: 'paste' }) },
            { label: t('class.fill_ids'), sub: t('class.fill_ids_sub'), icon: 'edit', onSelect: () => setTool({ k: 'fill' }) },
            { label: t('class.pss_open_all'), icon: 'file', onSelect: () => setTool({ k: 'pss' }) }]} /></div>
      <div class="cp-grp">{t('class.everyone', { n: c.names.length })}</div>
      <ul class="stus">{shown.map(r => <li><a class={'stu' + (r.j === i ? ' on' : '')} href={href('class', classId, 'people', r.j + 1)} aria-current={r.j === i ? 'page' : undefined} data-stu={r.j}>
        <span class="cav" aria-hidden="true" data-raw>{initials(r.m)}</span><span class="nm" data-raw>{r.m}</span><span class="sc num">{grades[r.j].grade != null ? pct(grades[r.j].grade) : ''}</span></a></li>)}</ul>
    </div>
    <Student key={c.id + '|' + n} x={x} n={n} i={i} cols={cols} r={grades[i]} onMove={() => setMoving(n)} onRemove={remove} onTool={setTool} onStep={step} term={on} whole={on === '*'}
      terms={tabs.length > 1 && <Segmented size="sm" label={t('class.term')} value={on} onChange={setTerm} options={tabs.map(k => ({ value: k[0], label: termLabel(k) }))} />} />
    {tool && tool.k === 'paste' && <PasteIds c={c} onClose={() => setTool(null)} />}
    {tool && tool.k === 'fill' && <FillIds c={c} onClose={() => setTool(null)} />}
    {tool && tool.k === 'att' && <AttendSheet x={x} day={tool.d} onClose={() => setTool(null)} />}
    {tool && tool.k === 'pss' && Ps && <Ps.SheetsSheet x={x} who={tool.n} term={x.now} left={leftOf(c.id)} onClose={() => setTool(null)} />}
    {tool && tool.k === 'seat' && <SeatingSheet x={x} onClose={() => setTool(null)} />}
    {dlg}
    {moving && <MoveDialog lib={x.lib} c={c} n={moving} onClose={ok => { setMoving(null); if (ok) go('class', classId, 'people'); }} />}
  </div>;
}

// One student's page: what the current app's one-student view and details card say, laid out as the design draws it.
function Student({ x, n, i, cols, r, onMove, onRemove, onTool, onStep, term, whole, terms }) {
  const { c } = x, miss = cols.filter(col => col.type !== 'xc' && (col.cells.get(n) || {}).st === 'missing'), Wl = usePart('watch');
  const days = B.attDays(c), att = days.length ? B.attCount(c, n, days) : null, here = att ? Math.round((att.p + att.l) / days.length * 100) : null;
  const recent = cols.filter(col => col.type !== 'xc').slice(-6).reverse();
  const trend = recent.map(col => col.cells.get(n)).filter(B.bkCounts).map(k => k.pct).reverse();
  const [note, setNote] = useState(B.infoOf(c, n).note || ''), wait = useRef(0);
  useEffect(() => () => clearTimeout(wait.current), []);
  const [More, setMore] = useState(null);
  useEffect(() => { let live = true; import('./student-more.jsx').then(m => { if (live) setMore(() => m.StudentMore); }, e => console.error(e)); return () => { live = false; }; }, []);
  // an MYP class: levels and a 1 to 7, never a percent (src/ib.js ibOneView; audit B-905)
  const myp = x.way === 'myp', [Ib, setIb] = useState(null);
  useEffect(() => { if (!myp) return; let live = true; import('./ib.jsx').then(m => { if (live) setIb(() => m.MypStudent); }, e => console.error(e)); return () => { live = false; }; }, [myp]);
  const termName = whole ? t('class.whole_year') : ((x.conf.terms || []).find(k => k.id === term) || {}).name || '';
  const left = leftOf(c.id), labelOf = id => kindOf(id) || t('class.type_none');
  const typeNote = v => { setNote(v); clearTimeout(wait.current); wait.current = setTimeout(() => change(t('class.u_note'), l => { const k = classIn(l, c.id); if (k && k.names.includes(n)) B.setInfo(k, n, { note: v.trim() ? v : '' }); }), 600); };
  return <article class="card cp-sp" aria-labelledby="h-stu" data-student={i}>
    <div class="sp-head"><span class="cav lg" aria-hidden="true" data-raw>{initials(n)}</span>
      <div><h2 id="h-stu" data-raw>{n}</h2><div class="sub"><span data-raw>{c.name}</span>{(B.infoOf(c, n).id || '') && <span data-raw>{B.infoOf(c, n).id}</span>}<span data-stu-pos>{t('class.st_pos', { n: i + 1, of: c.names.length })}</span></div></div>
      <span class="stnav"><IconButton icon="chl" size="sm" label={t('class.st_prev')} disabled={i <= 0} onClick={() => onStep(-1)} data-stu-prev /><IconButton icon="chr" size="sm" label={t('class.st_next')} disabled={i >= c.names.length - 1} onClick={() => onStep(1)} data-stu-next /></span>
      <div class="acts"><Button size="sm" icon="file" onClick={() => onTool({ k: 'pss', n })} data-pss-open>{t('class.pss_open_one')}</Button><Button size="sm" icon="seat" onClick={() => onTool({ k: 'seat' })} data-seat-open>{t('class.seat_groups')}</Button>
        {attOn(x.lib) && <Button size="sm" icon="check" onClick={() => onTool({ k: 'att' })} data-att-open>{t('class.attendance')}</Button>}
        <Menu label={t('class.student_menu', { name: n })} trigger={m => <IconButton {...m} icon="dots" label={t('class.student_menu', { name: n })} data-stu-menu />}
        items={[{ label: t('class.move_to'), icon: 'arrow', onSelect: onMove }, { label: t('class.remove'), icon: 'trash', onSelect: onRemove }]} /></div></div>
    <div class="kpis">
      {!myp && <div class="kpi" data-kpi="avg"><b>{r.grade != null ? pct(r.grade) : '–'}</b><span>{t(whole ? 'class.avg_year' : 'class.avg_term')}</span></div>}
      <div class="kpi" data-kpi="missing"><b class={miss.length ? 'warn' : ''}>{miss.length}</b><span>{t('class.missing_work')}</span></div>
      <div class="kpi" data-kpi="att"><b>{here != null ? here + '%' : '–'}</b><span>{t('class.attendance')}</span></div>
      {!myp && <div class="kpi"><Spark v={trend} /><span>{t('class.recent_trend')}</span></div>}
    </div>
    {terms && <div class="sp-sec stterms" data-stu-terms>{terms}</div>}
    {myp && (Ib ? <Ib c={c} cols={cols} term={term} termName={termName} i={i} /> : <div class="loading" aria-busy="true" />)}
    {!myp && <section class="sp-sec" aria-labelledby="h-recent"><h3 id="h-recent">{t('class.recent_work')}</h3>
      {recent.length ? <table class="wl">{recent.map(col => { const cell = col.cells.get(n); return <tr><td data-raw>{col.name}</td><td class="k">{kindOf(col.type)}</td>
        <td class={'s' + (cell && cell.st === 'missing' ? ' warn' : '')}>{!cell ? '–' : cell.st === 'missing' ? t('class.missing') : cell.st === 'excused' ? t('class.excused') : cell.pct != null ? (cell.total != null ? fmtPts(cell) : cell.pct + '%') : cell.fb ? t('class.fb_given') : '–'}</td></tr>; })}</table>
        : <p class="mute">{t('class.no_work_yet')}</p>}
    </section>}
    <GoalsStudent x={x} cols={cols} n={n} />
    {Wl && <Wl.WatchStudent c={c} n={n} />}
    {attOn(x.lib) && <AttStudent c={c} n={n} term={x.now ? x.conf.terms.find(k => k.id === x.now) : null} onDay={d => onTool({ k: 'att', d })} />}
    <Details c={c} n={n} />
    <section class="sp-sec"><div class="sp-h"><h3><label for="stu-note">{t('class.notes')}</label></h3><span class="grow" /><Mic onText={w => typeNote((note.trim() ? note.replace(/\s*$/, ' ') : '') + w.trim())} />{note.trim() && <CopyButton text={note} data-note-copy />}</div>
      <textarea id="stu-note" class="input" rows="3" value={note} placeholder={t('class.notes_ph')} onInput={e => typeNote(e.currentTarget.value)} data-stu-note /></section>
    {/* the charts load a moment later: last, so nothing above them moves when they come */}
    {More && x.way !== 'myp' && <More c={c} n={n} cols={cols} conf={x.conf} labelOf={labelOf} inn={m => !left.has(m)} whole={whole} />}
  </article>;
}
const kindOf = id => { if (!id) return ''; const k = B.bkCats().find(y => y[0] === id); return typeName(id, k && k[2]); };
const fmtPts = cell => String(Math.round(cell.total * 100) / 100) + ' / ' + String(Math.round(cell.max * 100) / 100);
function Spark({ v }) {
  if (v.length < 2) return <b>–</b>;
  const pts = v.map((p, k) => (6 + k * (188 / (v.length - 1))).toFixed(1) + ',' + (46 - Math.max(0, Math.min(100, p)) * 0.4).toFixed(1)).join(' ');
  return <svg class="spark" viewBox="0 0 200 52" aria-hidden="true"><polyline points={pts} /></svg>;
}

// A student's details (src/people.js details card): student ID, email and last year's level, each copied with one press, the
// email opened in the teacher's mail app. Edited in a small box, saved as one undo step.
function Details({ c, n }) {
  const i = B.infoOf(c, n), [edit, setEdit] = useState(false);
  const copy = v => copyText(v).then(ok => toast(t(ok ? 'class.copied' : 'class.copy_failed')));
  const row = (k, lab, v, more) => v ? <div class="dt"><dt>{lab}</dt><dd><span data-raw>{v}</span><span class="grow" /><Button size="sm" variant="quiet" icon="copy" onClick={() => copy(v)} data-det-copy={k}>{t('class.copy')}</Button>{more}</dd></div> : null;
  const any = i.id || i.email || i.prev;
  return <section class="sp-sec" aria-labelledby="h-det" data-details><div class="sp-h"><h3 id="h-det">{t('class.details')}</h3><Button size="sm" variant="quiet" icon="edit" onClick={() => setEdit(true)} data-det-edit>{t('class.edit')}</Button></div>
    {any ? <dl class="dets">{row('id', t('class.student_id'), i.id)}{row('email', t('class.email'), i.email, <Button size="sm" variant="quiet" icon="mail" onClick={() => openMail('mailto:' + i.email)} data-det-mail>{t('class.email_send')}</Button>)}{row('prev', t('class.last_year'), i.prev)}
      </dl>
      : <p class="mute small">{t('class.no_details')}</p>}
    <Spellings c={c} n={n} other={i.other || []} />
    {edit && <DetailsDialog c={c} n={n} onClose={() => setEdit(false)} />}</section>;
}
// The details on their own in a sheet, for the marking screen's More for this paper (gaps C-052). more: a link under them.
export function DetailsSheet({ c, n, more, onClose }) {
  return <Sheet open title={n} onClose={onClose}><div class="cp-sp" data-pmwho><Details c={c} n={n} />{more}</div></Sheet>;
}
function DetailsDialog({ c, n, onClose }) {
  const i = B.infoOf(c, n), [v, setV] = useState({ id: i.id || '', email: i.email || '', prev: i.prev || '' });
  const save = async () => { await change(t('class.u_details', { name: n }), l => { const k = classIn(l, c.id); if (k && k.names.includes(n)) B.setInfo(k, n, { id: v.id.trim(), email: v.email.trim(), prev: v.prev.trim() }); }, true); onClose(); };
  const f = (k, lab, type) => <TextInput label={lab} type={type || 'text'} value={v[k]} maxLength={120} onInput={val => setV(o => ({ ...o, [k]: val }))} onKeyDown={e => { if (e.key === 'Enter') save(); }} data-det={k} />;
  return <Dialog open title={t('class.details_for', { name: n })} onClose={onClose} actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-det-save>{t('class.save')}</Button></>}>
    {f('id', t('class.student_id'))}{f('email', t('class.email'), 'email')}{f('prev', t('class.last_year_opt'))}</Dialog>;
}

// Other ways the name is written (src/people.js Also called): each removed with its ×, another added; they and the student ID match
// folders and files in a download to this student. One undo step each.
function Spellings({ c, n, other }) {
  const [add, setAdd] = useState(false), [v, setV] = useState('');
  const put = (label, list) => change(t(label, { name: n }), l => { const k = classIn(l, c.id); if (k && k.names.includes(n)) B.setInfo(k, n, { other: list }); }, true).catch(e => console.error(e));
  const ok = async () => { const w = v.trim(); if (!w) return; await put('class.sp_u_add', [...new Set([...other, w])]); setAdd(false); setV(''); };
  return <div class="dt spl" data-spellings><dt>{t('class.also_called')}</dt><dd><span class="splc">{other.map((o, k) => <span class="chip spchip" data-spelling={o}><span data-raw>{o}</span>
    <button type="button" class="spx" aria-label={t('class.sp_remove', { name: o })} title={t('class.sp_remove', { name: o })} onClick={() => put('class.sp_u_remove', other.filter((_, j) => j !== k))} data-sp-drop={k}><Icon name="x" size="xs" /></button></span>)}
    <Button size="sm" variant="quiet" icon="plus" onClick={() => setAdd(true)} data-sp-add>{t('class.sp_add')}</Button></span>
    <small class="mute">{t('class.sp_say')}</small></dd>
    {add && <Dialog open title={t('class.sp_add_t', { name: n })} onClose={() => setAdd(false)}
      actions={<><Button onClick={() => setAdd(false)}>{t('common.cancel')}</Button><Button variant="primary" disabled={!v.trim()} onClick={ok} data-sp-ok>{t('class.sp_add_ok')}</Button></>}>
      <TextInput label={t('class.sp_label')} value={v} maxLength={120} onInput={setV} onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ok(); } }} autofocus data-sp-input /></Dialog>}</div>;
}

// Paste IDs and emails (src/people.js peoplePanel): a class list with names and a student ID or email column, from the school's
// system or a spreadsheet; each row fills in the student with the same name. One undo step.
function PasteIds({ c, onClose }) {
  const [v, setV] = useState('');
  const fill = async () => {
    const rows = B.parseRosterRows(v).filter(r => r.id || r.email), pairs = B.rosterPairs(c.names, rows.map(r => r.name)), miss = []; let n = 0;
    await change(t('class.paste_ids_u'), l => { const k = classIn(l, c.id); if (!k) return; n = 0; miss.length = 0;
      for (const r of rows) { const who = k.names.find(x => pairs.get(x) === r.name); if (!who) { miss.push(r.name); continue; } B.setInfo(k, who, { ...(r.id ? { id: r.id } : {}), ...(r.email ? { email: r.email } : {}) }); n++; } }, true);
    onClose();
    toast(!n ? t('class.paste_ids_none') : miss.length ? t('class.paste_ids_some', { n, names: miss.slice(0, 3).join(', '), more: miss.length > 3 ? t('class.paste_ids_more', { n: miss.length - 3 }) : '' }) : t('class.paste_ids_done', { n }), { ms: 6000 });
  };
  return <Dialog open title={t('class.paste_ids_t')} onClose={onClose}
    actions={<><Button onClick={onClose} data-paste-cancel>{t('common.cancel')}</Button><Button variant="primary" disabled={!v.trim()} onClick={fill} data-paste-fill>{t('class.paste_ids_ok')}</Button></>}>
    <p class="mute small">{t('class.paste_ids_say')}</p>
    <textarea class="input roster-ta" rows="10" value={v} onInput={e => setV(e.currentTarget.value)} placeholder={t('class.paste_ids_ph')} aria-label={t('class.paste_ids_t')} autofocus data-paste-in /></Dialog>;
}

// Fill in details (src/people.js fillPeople): every student in one table, student ID, email and last year's level typed down the
// column; each box saves when she leaves it, one undo step, and Tab goes on to the next.
function FillIds({ c, onClose }) {
  const b = useBook(), k = (b && !b.error && classIn(b.lib, c.id)) || c;
  const save = (n, f, el) => {
    const raw = el.value.trim(), v = f === 'id' ? raw.replace(/\s+/g, '') : raw;
    if (f === 'email' && v && !B.EMAIL_RX.test(v)) { toast(t('class.fill_bad_email')); return; }
    if ((B.infoOf(k, n)[f] || '') === v) return;
    change(t('class.u_details', { name: n }), l => { const x = classIn(l, c.id); if (x && x.names.includes(n)) B.setInfo(x, n, { [f]: v }); }, true).catch(e => console.error(e));
  };
  const box = (n, f, lab, type) => <input class="input" type={type || 'text'} defaultValue={B.infoOf(k, n)[f] || ''} maxLength={120} aria-label={lab + ', ' + n} onChange={e => save(n, f, e.currentTarget)} data-fill={f} data-fill-who={n} />;
  return <Sheet open wide title={t('class.fill_ids_t', { name: c.name })} onClose={onClose} footer={<><span class="grow mute small">{t('class.fill_n', { n: k.names.filter(n => B.infoOf(k, n).id).length, of: k.names.length })}</span><Button variant="primary" onClick={onClose} data-fill-done>{t('class.done')}</Button></>}>
    <p class="mute small">{t('class.fill_say')}</p>
    <table class="filltab" data-filltab><thead><tr><th>#</th><th>{t('class.student')}</th><th>{t('class.student_id')}</th><th>{t('class.email')}</th><th>{t('class.last_year')}</th></tr></thead>
      <tbody>{c.names.map((n, j) => <tr><td class="mute num">{j + 1}</td><td data-raw>{n}</td><td>{box(n, 'id', t('class.student_id'))}</td><td>{box(n, 'email', t('class.email'), 'email')}</td><td>{box(n, 'prev', t('class.last_year'))}</td></tr>)}</tbody></table>
  </Sheet>;
}
