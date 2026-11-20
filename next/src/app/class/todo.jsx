// A class's To do tab: the teacher's own to-dos for this class (lib.todo.items with this class, src/todo.js), and missing work
// (src/missing.js): every paper marked Missing in the term shown, by student or by assignment, each reminder drafted by the lifted
// misDraft and misGroup and opened in her own mail app ready to send. Grading Studio sends nothing. When a student was reminded is
// kept in their details (c.info[name].nudge) and the wording in lib.book.miss, both saved as the current app saves them.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Segmented, EmptyState, Dialog, TextInput, Checkbox, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href, replaceHere, routeInteracted } from '../router.js';
import * as undoList from '../../services/undo.js';
import { copyText } from '../../services/clipboard.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { useBook, classBook } from './data.js';
import { openMail } from './mail.js';
import { typeName } from './grades.jsx';
import './lines.js';

const keep = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem('gsn.book.' + k)); sessionStorage.setItem('gsn.book.' + k, JSON.stringify(v)); } catch {} return null; };
const uid = () => Math.random().toString(36).slice(2, 10);
const late = due => { if (!due) return 0; const d = new Date(due + 'T12:00:00'), now = new Date(B.isoDay(Date.now()) + 'T12:00:00'); return isNaN(d) ? 0 : Math.max(0, Math.round((now - d) / 864e5)); };
const dueSay = col => (col.due ? t('class.mis_due', { day: B.bkDay(col.due) }) + (late(col.due) ? ' · ' + t('class.mis_days_ago', { n: late(col.due) }) : '') : '');
const csv = rows => rows.map(r => r.map(v => { const s = B.csvSafe(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
const save = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })); a.download = name.replace(/[\\/:*?"<>|]+/g, ' '); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const pill = id => { const k = B.bkCats().find(y => y[0] === id); return <span class="tag">{typeName(id, k && k[2])}</span>; };
const owes = (col, n) => (col.cells.get(n) || {}).st === 'missing';

// Saves that these students were reminded about these columns (src/missing.js misMark): reminders for work no longer missing go.
function mark(c, all, pairs, when) {
  return change(t('class.u_reminded'), l => {
    const k = classIn(l, c.id); if (!k) return;
    for (const [n, cols] of pairs) {
      const old = B.infoOf(k, n).nudge || {}, kept = {};
      for (const [key, v] of Object.entries(old)) if (all.some(col => col.key === key && owes(col, n))) kept[key] = v;
      for (const col of cols) kept[col.key] = when;
      B.setInfo(k, n, { nudge: Object.keys(kept).length ? kept : '' });
    }
  }, true);
}
// Opens the email; a very long one goes without its body, which is put on the clipboard to paste in. True when it was cut.
function send(m) {
  let link = B.misHref(m), cut = false;
  if (link.length > 1900) { link = B.misHref(m, true); cut = true; copyText(m.body); }
  openMail(link); return cut;
}

export default function ClassTodo({ classId, sub }) {
  const b = useBook(), [term, setTerm] = useState(() => keep('term:' + classId)), [view, setView] = useState(() => keep('misview') || 'stu'), [words, setWords] = useState(false);
  // Open the section unless the teacher has already moved elsewhere while the gradebook loaded.
  useEffect(() => {
    if (!b || sub !== 'missing') return;
    const section = document.querySelector('[data-mis]');
    if (section && !routeInteracted()) {
      section.scrollIntoView({ block: 'start' });
      section.querySelector('h2').focus({ preventScroll: true });
    }
    replaceHere(href('class', classId, 'todo'));
  }, [b, sub, classId]);
  if (!b) return <div class="loading" aria-busy="true" />;
  const x = classBook(b, classId);
  if (!x) return <EmptyState icon="warn" title={t('class.read_failed')} />;
  const { c, conf, lib } = x, tabs = B.bkTabs(x.cols), on = term != null && tabs.some(tb => tb[0] === term) ? term : x.now;
  const cols = B.misCols(on === '*' ? x.cols : x.cols.filter(k => k.termId === on)), all = B.misCols(x.cols);
  const choose = v => { setTerm(v); keep('term:' + classId, v); };
  const termLabel = ([id, name]) => (id === '*' ? t('class.whole_year') : id === '' ? t(conf.terms.length ? 'class.outside_terms' : 'class.this_year') : name);
  B.bookUse({ lib }); const mc = B.misConf();
  const stus = B.misByStu(c, cols), total = stus.reduce((s, k) => s + k.cols.length, 0);
  const mail = (n, owed) => { const m = B.misDraft(c, n, owed, mc), cut = send(m); mark(c, all, [[n, owed]], Date.now());
    toast((cut ? t('class.mis_cut') : t('class.mis_opened')) + ' ' + (m.to ? '' : t('class.mis_no_to', { name: B.rptCall(c, n) }) + ' ') + t('class.mis_marked'), { undo: () => undoList.undo() }); };
  const mailAll = (col, who) => { const m = B.misGroup(c, col, who, mc), cut = send(m), none = who.filter(w => !B.misEmail(c, w.n)).length;
    mark(c, all, who.filter(w => B.misEmail(c, w.n)).map(w => [w.n, [col]]), Date.now());
    toast((cut ? t('class.mis_cut') : t('class.mis_opened_bcc', { n: who.length - none })) + ' ' + (none ? t('class.mis_left_out', { n: none }) + ' ' : '') + t('class.mis_marked'), { undo: () => undoList.undo() }); };
  const rows = () => { const out = []; for (const { n, cols: owed } of stus) for (const col of owed) { const tm = B.misNudge(c, n, col); out.push([n, B.misEmail(c, n).replace(/,/g, ', '), col.name, col.due || '', tm ? B.isoDay(tm) : '']); } return out; };
  const head = [t('class.att_student'), t('class.mis_email'), t('class.mis_work'), t('class.mis_due_h'), t('class.mis_reminded_h')];
  const called = v => change(t('class.u_mis_words'), l => { const cls = { ...((l.book && l.book.miss && l.book.miss.cls) || {}) }; const s = v.trim(); if (s && s !== c.name) cls[c.id] = s; else delete cls[c.id]; l.book = { ...(l.book || {}), miss: { ...((l.book || {}).miss || {}), cls } }; });
  const who = (n, i) => { const e = B.misEmail(c, n); return e ? <span class="mute small" data-raw>{e.replace(/,/g, ', ')}</span> : <a class="link small" href={href('class', classId, 'people', i + 1)}>{t('class.mis_no_email')}</a>; };
  const sent = tm => tm ? <span class="tag ok">{t('class.mis_reminded', { day: B.bkDay(B.isoDay(tm)) })}</span> : null;
  return <div class="ctodo" data-class-todo>
    <Todos c={c} lib={lib} />
    <section class="card mis" aria-labelledby="h-mis" data-mis>
      <div class="lhead"><h2 id="h-mis" tabIndex={-1}>{t('class.mis_title')}</h2><span class="end">
        <Button size="sm" onClick={() => setWords(true)} data-mis-words>{t('class.mis_wording')}</Button>
        <Button size="sm" icon="copy" disabled={!stus.length} onClick={() => copyText([head, ...rows()].map(r => r.join('\t')).join('\n')).then(ok => toast(ok ? t('class.mis_copied', { n: rows().length }) : t('class.copy_failed')))} data-mis-copy>{t('class.mis_copy')}</Button>
        <Button size="sm" icon="download" disabled={!stus.length} onClick={() => save(t('class.mis_file', { name: c.name }) + '.csv', csv([head, ...rows()]) + '\r\n')} data-mis-csv>{t('class.mis_download')}</Button></span></div>
      <div class="misopts">
        {tabs.length > 1 && <Segmented label={t('class.term')} value={on} onChange={choose} options={tabs.map(tb => ({ value: tb[0], label: termLabel(tb) }))} />}
        <Segmented label={t('class.mis_show')} value={view} onChange={v => { setView(v); keep('misview', v); }} options={[{ value: 'stu', label: t('class.mis_by_stu') }, { value: 'col', label: t('class.mis_by_col') }]} />
        <TextInput label={t('class.mis_called')} value={B.misClassName(c, mc)} onChange={e => called(e.currentTarget.value)} maxLength={60} data-mis-called />
      </div>
      <p class="mute small">{t('class.mis_say')}</p>
      {!stus.length ? <div class="misnone" data-mis-none><b>{on === '*' ? t('class.mis_none_year') : t('class.mis_none_term')}</b><p class="mute small">{t('class.mis_none_say')}</p></div> : <>
        <p class="missum" data-mis-sum>{t('class.mis_sum', { n: stus.length, work: t('class.mis_pieces', { n: total }) })}</p>
        {view === 'col' ? B.misByCol(c, cols).map(({ col, who: list }) => <section class="miscard" data-mis-col={col.key}>
          <div class="mishead"><h3 data-raw>{col.name}</h3>{col.type && pill(col.type)}<span class="mute small">{dueSay(col)}</span><span class="grow" /><span class="mute small">{t('class.mis_n_students', { n: list.length })}</span>
            <Button size="sm" variant="primary" disabled={!list.some(w => B.misEmail(c, w.n))} onClick={() => mailAll(col, list)} title={t('class.mis_all_say')} data-mis-all={col.key}>{t('class.mis_all')}</Button></div>
          <ul class="mislist">{list.map(({ n, i }) => <li><span class="misw" data-raw>{n}</span>{who(n, i)}{sent(B.misNudge(c, n, col))}<span class="grow" /><Button size="sm" onClick={() => mail(n, [col])} data-mis-mail={i}>{t('class.mis_email_one')}</Button></li>)}</ul>
        </section>)
        : stus.map(({ n, i, cols: owed }) => <section class="miscard" data-mis-stu={i}>
          <div class="mishead"><h3 data-raw>{n}</h3>{who(n, i)}<span class="grow" />
            <Button size="sm" icon="copy" onClick={() => copyText(B.misPlain(B.misDraft(c, n, owed, mc))).then(ok => toast(ok ? t('class.mis_copied_one', { name: B.rptCall(c, n) }) : t('class.copy_failed')))} data-mis-copy-one={i}>{t('class.mis_copy_one')}</Button>
            <Button size="sm" variant="primary" icon="mail" onClick={() => mail(n, owed)} data-mis-mail={i}>{t('class.mis_remind')}</Button></div>
          <ul class="mislist">{owed.map(col => <li><span class="misw" data-raw>{col.name}</span>{col.type && pill(col.type)}<span class="mute small">{dueSay(col)}</span>{sent(B.misNudge(c, n, col))}<span class="grow" />
            <a class="link" href={col.dl ? href('mark', col.dl) : href('class', classId, 'grades')}>{t('class.mis_open')}</a></li>)}</ul>
        </section>)}
      </>}
    </section>
    {words && <Words mc={mc} onClose={() => setWords(false)} />}
  </div>;
}

// How every reminder is worded (src/missing.js misWordsDlg). An empty box goes back to the built-in words.
function Words({ mc, onClose }) {
  const [subj, setSubj] = useState(mc.subj), [body, setBody] = useState(mc.body);
  const go = async () => {
    const s = subj.trim(), bd = body.replace(/\s+$/, '');
    await change(t('class.u_mis_words'), l => { l.book = { ...(l.book || {}), miss: { ...((l.book || {}).miss || {}), subj: s && s !== B.MIS_WORDS.subj ? s : '', body: bd.trim() && bd !== B.MIS_WORDS.body ? bd : '' } }; }, true);
    onClose(); toast(t('class.mis_words_saved'));
  };
  return <Dialog open title={t('class.mis_wording_t')} onClose={onClose} actions={<><Button onClick={() => { setSubj(B.MIS_WORDS.subj); setBody(B.MIS_WORDS.body); }} data-mis-reset>{t('class.mis_builtin')}</Button><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={go} data-mis-save>{t('class.save')}</Button></>}>
    <p class="mute small">{t('class.mis_words_say')}</p><p class="mute small">{t('class.mis_fills')}</p>
    <TextInput label={t('class.mis_subject')} value={subj} onInput={setSubj} maxLength={160} data-mis-subj />
    <label class="cp-fld"><span class="lab">{t('class.mis_body')}</span><textarea class="input" rows="11" value={body} onInput={e => setBody(e.currentTarget.value)} data-mis-body /></label>
  </Dialog>;
}

// The teacher's own to-dos for this class (src/todo.js lib.todo.items with c: this class): add one, tick it done.
function Todos({ c, lib }) {
  const [text, setText] = useState('');
  const items = ((lib.todo && Array.isArray(lib.todo.items)) ? lib.todo.items : []).filter(it => it && it.id && !it.gone && String(it.c) === String(c.id));
  const open = items.filter(it => !it.done).sort((a, b) => (a.d || '9') < (b.d || '9') ? -1 : (a.d || '9') > (b.d || '9') ? 1 : (a.made || 0) - (b.made || 0)), done = items.filter(it => it.done).sort((a, b) => b.done - a.done).slice(0, 5);
  const put = (label, fn) => change(label, l => { l.todo = { ...(l.todo || {}) }; l.todo.items = Array.isArray(l.todo.items) ? l.todo.items.slice() : []; fn(l.todo.items); }, true);
  const add = e => { e.preventDefault(); const x = text.trim(); if (!x) return; const now = Date.now(); put(t('class.u_todo'), list => list.push({ id: uid(), x, d: '', c: c.id, made: now, t: now })); setText(''); };
  const tick = it => put(t('class.u_todo'), list => { const k = list.findIndex(y => y && y.id === it.id); if (k < 0) return; const y = { ...list[k], t: Date.now() }; if (y.done) delete y.done; else y.done = Date.now(); list[k] = y; });
  return <section class="card ctd" aria-labelledby="h-ctd" data-ctd>
    <div class="lhead"><h2 id="h-ctd">{t('class.td_title')}</h2><span class="mute">{t('class.td_n', { n: open.length })}</span></div>
    <ul class="ctdlist">{open.map(it => <li data-ctd-item={it.id}><Checkbox checked={false} onChange={() => tick(it)} label={<span data-raw>{it.x}</span>} />{it.d && <span class="mute small">{B.bkDay(it.d)}</span>}</li>)}
      {done.map(it => <li class="done" data-ctd-item={it.id}><Checkbox checked onChange={() => tick(it)} label={<span data-raw>{it.x}</span>} /></li>)}</ul>
    {!items.length && <p class="mute small">{t('class.td_none')}</p>}
    <form class="ctdadd" onSubmit={add}><input class="input" value={text} onInput={e => setText(e.currentTarget.value)} placeholder={t('class.td_add_ph')} aria-label={t('class.td_add')} maxLength={300} data-ctd-new /><Button type="submit" size="sm" icon="plus" disabled={!text.trim()}>{t('class.td_add')}</Button></form>
  </section>;
}
