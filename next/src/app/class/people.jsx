// A class's People tab (design screenshot 5's People): the roster at the left with a box to find a student, and one student's page
// at the right: their average this term, missing work, attendance, how their recent work went, and notes. Everything about a
// student is read from the gradebook's engine (students/book.js) and the class as saved; a change (the roster edited, a student
// moved or taken off, a note) is the current app's own change (lifted parseRosterRows, keepInfo, keepAtt, setInfo), one undo step.
// The address carries the student's place on the roster (#/class/<id>/people/<n>), never a name, as the current app does.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, EmptyState, Dialog, TextInput, Menu, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href, go, PARTS } from '../router.js';
import * as undoList from '../../services/undo.js';
import { useBook, classBook } from './data.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { initials, pct, typeName } from './grades.jsx';
import { AttendSheet, AttStudent, attOn } from './attend.jsx';
import { SeatingSheet } from './seating.jsx';
import './lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);

// The roster box (src/app/screens.js editClass): the class's name and its students one per line, in the order they are pasted; a
// .csv or .txt list read the same way, with any student ID and email kept as that student's details. Saved as one undo step.
export function RosterDialog({ c, onClose }) {
  const [name, setName] = useState(c ? c.name : ''), [names, setNames] = useState(c ? c.names.join('\n') : ''), up = useRef([]), file = useRef(null);
  const [err, setErr] = useState(''), [Gc, setGc] = useState(null);
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
    actions={<><Button onClick={() => onClose(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-roster-save>{t('class.save')}</Button></>}>
    <TextInput label={t('class.class_name')} value={name} onInput={setName} error={err} data-roster-name autofocus={!c} />
    <label class="cp-fld"><span class="lab">{t('class.students_one_per_line')}</span>
      <textarea class="input roster-ta" rows="12" value={names} onInput={e => setNames(e.currentTarget.value)} placeholder={t('class.roster_ph')} data-roster-names /></label>
    <p class="mute small">{t('class.roster_note')}</p>
    <Button size="sm" icon="upload" onClick={() => file.current.click()} data-roster-file>{t('class.upload_list')}</Button>
    <input type="file" ref={file} accept=".csv,.txt,text/csv,text/plain" hidden onChange={read} data-roster-input />
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

export default function People({ classId, sub }) {
  const b = useBook(), [find, setFind] = useState(''), [editing, setEditing] = useState(false), [moving, setMoving] = useState(null), [tool, setTool] = useState(null);
  if (!b) return <div class="loading" aria-busy="true" />;
  const x = classBook(b, classId);
  if (!x) return <EmptyState icon="warn" title={t('class.read_failed')} />;
  const { c } = x;
  const dlg = editing && <RosterDialog c={c} onClose={() => setEditing(false)} />;
  if (!c.names.length) return <><EmptyState icon="people" title={t('class.no_roster')} text={t('class.no_roster_text')} action={<Button variant="primary" icon="plus" onClick={() => setEditing(true)} data-roster-edit>{t('class.add_roster')}</Button>} />{dlg}</>;
  const i = sub && /^\d+$/.test(sub) && +sub >= 1 && +sub <= c.names.length ? +sub - 1 : 0, n = c.names[i];
  const term = x.now, cols = x.cols.filter(k => (term == null ? true : k.termId === term)), grades = c.names.map(m => B.bkGrade(m, cols, x.conf));
  const shown = c.names.map((m, j) => ({ m, j })).filter(r => !find.trim() || r.m.toLowerCase().includes(find.trim().toLowerCase()));
  const remove = async () => {
    await change(t('class.u_remove', { name: n }), l => { const k = classIn(l, c.id); if (!k) return; const was = k.names, wasInfo = k.info; k.names = was.filter(z => z !== n); B.keepInfo(k, was, []); B.keepAtt(k, was, wasInfo); }, true);
    go('class', classId, 'people', Math.min(i + 1, c.names.length - 1) || '');
    toast(t('class.removed', { name: n }), { undo: () => undoList.undo() });
  };
  return <div class="pgrid">
    <div class="card roster" role="navigation" aria-label={t('class.roster')}>
      <div class="rhead"><input class="input" type="search" placeholder={t('class.find_student')} aria-label={t('class.find_student')} value={find} onInput={e => setFind(e.currentTarget.value)} data-roster-find />
        <IconButton icon="edit" label={t('class.edit_roster')} onClick={() => setEditing(true)} data-roster-edit /></div>
      <div class="cp-grp">{t('class.everyone', { n: c.names.length })}</div>
      <ul class="stus">{shown.map(r => <li><a class={'stu' + (r.j === i ? ' on' : '')} href={href('class', classId, 'people', r.j + 1)} aria-current={r.j === i ? 'page' : undefined} data-stu={r.j}>
        <span class="cav" aria-hidden="true" data-raw>{initials(r.m)}</span><span class="nm" data-raw>{r.m}</span><span class="sc num">{grades[r.j].grade != null ? pct(grades[r.j].grade) : ''}</span></a></li>)}</ul>
    </div>
    <Student key={c.id + '|' + n} x={x} n={n} i={i} cols={cols} r={grades[i]} onMove={() => setMoving(n)} onRemove={remove} onTool={setTool} />
    {tool && tool.k === 'att' && <AttendSheet x={x} day={tool.d} onClose={() => setTool(null)} />}
    {tool && tool.k === 'seat' && <SeatingSheet x={x} onClose={() => setTool(null)} />}
    {dlg}
    {moving && <MoveDialog lib={x.lib} c={c} n={moving} onClose={ok => { setMoving(null); if (ok) go('class', classId, 'people'); }} />}
  </div>;
}

// One student's page: what the current app's one-student view and details card say, laid out as the design draws it.
function Student({ x, n, i, cols, r, onMove, onRemove, onTool }) {
  const { c } = x, miss = cols.filter(col => col.type !== 'xc' && (col.cells.get(n) || {}).st === 'missing');
  const days = B.attDays(c), att = days.length ? B.attCount(c, n, days) : null, here = att ? Math.round((att.p + att.l) / days.length * 100) : null;
  const recent = cols.filter(col => col.type !== 'xc').slice(-6).reverse();
  const trend = recent.map(col => col.cells.get(n)).filter(B.bkCounts).map(k => k.pct).reverse();
  const [note, setNote] = useState(B.infoOf(c, n).note || ''), wait = useRef(0);
  useEffect(() => () => clearTimeout(wait.current), []);
  const typeNote = v => { setNote(v); clearTimeout(wait.current); wait.current = setTimeout(() => change(t('class.u_note'), l => { const k = classIn(l, c.id); if (k && k.names.includes(n)) B.setInfo(k, n, { note: v.trim() ? v : '' }); }), 600); };
  return <article class="card cp-sp" aria-labelledby="h-stu" data-student={i}>
    <div class="sp-head"><span class="cav lg" aria-hidden="true" data-raw>{initials(n)}</span>
      <div><h2 id="h-stu" data-raw>{n}</h2><div class="sub"><span data-raw>{c.name}</span>{(B.infoOf(c, n).id || '') && <span data-raw>{B.infoOf(c, n).id}</span>}</div></div>
      <div class="acts"><Button size="sm" icon="seat" onClick={() => onTool({ k: 'seat' })} data-seat-open>{t('class.seat_groups')}</Button>
        {attOn(x.lib) && <Button size="sm" icon="check" onClick={() => onTool({ k: 'att' })} data-att-open>{t('class.attendance')}</Button>}
        <Menu label={t('class.student_menu', { name: n })} trigger={m => <IconButton {...m} icon="dots" label={t('class.student_menu', { name: n })} data-stu-menu />}
        items={[{ label: t('class.move_to'), icon: 'arrow', onSelect: onMove }, { label: t('class.remove'), icon: 'trash', onSelect: onRemove }]} /></div></div>
    <div class="kpis">
      <div class="kpi" data-kpi="avg"><b>{r.grade != null ? pct(r.grade) : '–'}</b><span>{t('class.avg_term')}</span></div>
      <div class="kpi" data-kpi="missing"><b class={miss.length ? 'warn' : ''}>{miss.length}</b><span>{t('class.missing_work')}</span></div>
      <div class="kpi" data-kpi="att"><b>{here != null ? here + '%' : '–'}</b><span>{t('class.attendance')}</span></div>
      <div class="kpi"><Spark v={trend} /><span>{t('class.recent_trend')}</span></div>
    </div>
    <section class="sp-sec" aria-labelledby="h-recent"><h3 id="h-recent">{t('class.recent_work')}</h3>
      {recent.length ? <table class="wl">{recent.map(col => { const cell = col.cells.get(n); return <tr><td data-raw>{col.name}</td><td class="k">{kindOf(col.type)}</td>
        <td class={'s' + (cell && cell.st === 'missing' ? ' warn' : '')}>{!cell ? '–' : cell.st === 'missing' ? t('class.missing') : cell.st === 'excused' ? t('class.excused') : cell.pct != null ? (cell.total != null ? fmtPts(cell) : cell.pct + '%') : cell.fb ? t('class.fb_given') : '–'}</td></tr>; })}</table>
        : <p class="mute">{t('class.no_work_yet')}</p>}
    </section>
    {attOn(x.lib) && <AttStudent c={c} n={n} term={x.now ? x.conf.terms.find(k => k.id === x.now) : null} onDay={d => onTool({ k: 'att', d })} />}
    <section class="sp-sec"><h3><label for="stu-note">{t('class.notes')}</label></h3>
      <textarea id="stu-note" class="input" rows="3" value={note} placeholder={t('class.notes_ph')} onInput={e => typeNote(e.currentTarget.value)} data-stu-note /></section>
  </article>;
}
const kindOf = id => { if (!id) return ''; const k = B.bkCats().find(y => y[0] === id); return typeName(id, k && k[2]); };
const fmtPts = cell => String(Math.round(cell.total * 100) / 100) + ' / ' + String(Math.round(cell.max * 100) / 100);
function Spark({ v }) {
  if (v.length < 2) return <b>–</b>;
  const pts = v.map((p, k) => (6 + k * (188 / (v.length - 1))).toFixed(1) + ',' + (46 - Math.max(0, Math.min(100, p)) * 0.4).toFixed(1)).join(' ');
  return <svg class="spark" viewBox="0 0 200 52" aria-hidden="true"><polyline points={pts} /></svg>;
}
