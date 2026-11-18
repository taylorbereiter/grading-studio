// Bringing a class over from Google Classroom (src/classroom.js) with two downloads and no sign-in: the grades file ("Download all
// grades as CSV") gives the roster, each assignment and every score; the class is made (or students added to one already here) and
// the scores then go through Import a gradebook, so the teacher sees them before anything is saved. The work to mark comes as the
// assignment's Drive folder, downloaded as a ZIP and brought in from the class's Assignments tab. Read in this browser; nothing is sent.
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Sheet, Button, Select, TextInput } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine as B, change, classIn } from '../../students/book.js';
import * as G from '../../engines/gbki.js';
import { use as coreUse, state as coreState } from '../../engines/gcore.js';
import { PARTS } from '../router.js';
import { useBook, handoff } from './data.js';
import './lines.js';
import { DriveButton } from '../drive-button.jsx';

const uid = () => Math.random().toString(36).slice(2, 10);

export function ClassroomSheet({ onClose }) {
  const b = useBook(), file = useRef(null);
  const [d, setD] = useState(null), [to, setTo] = useState(''), [name, setName] = useState(''), [err, setErr] = useState(''), [nameErr, setNameErr] = useState('');
  const classes = b && !b.error ? b.lib.classes : [];
  const read = async f => {
    if (!f) return;
    let rows = null;
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      if (buf[0] === 0xd0 && buf[1] === 0xcf) return setErr(t('class.bki_xls_old'));
      if (buf[0] === 0x50 && buf[1] === 0x4b) { if (!coreState().fflate) coreUse({ fflate: await PARTS.zip() }); rows = G.bkiXlsx(buf); }
      else rows = G.bkiParse(new TextDecoder().decode(buf));
    } catch { return setErr(t('class.bki_unread')); }
    const r = G.gcRead(rows);
    if (!r) return setErr(t('class.gc_none'));
    // a class already here with the same name, or most of the same students, is the likely home for it
    const guess = G.gcNameOf(f.name), keys = r.students.map(s => s.name);
    const hit = classes.find(c => guess && G.normName(c.name) === G.normName(guess)) || classes.find(c => c.names.length && B.rosterPairs(c.names, keys).size >= Math.max(2, keys.length / 2));
    setErr(''); setD({ ...r, file: f.name }); setTo(hit ? hit.id : ''); setName(guess);
  };
  const c = to ? classes.find(k => k.id === to) : null;
  const fresh = k => { const took = new Set(B.rosterPairs(k.names, d.students.map(s => s.name)).values()); return d.students.filter(s => !took.has(s.name)); };
  const add = d ? (c ? fresh(c) : d.students) : [];
  const save = async () => {
    if (!c && !name.trim()) return setNameErr(t('class.name_needed'));
    let id = c && c.id;
    await change(t(c ? 'class.u_roster' : 'class.u_new_class'), l => {
      let k = c ? classIn(l, c.id) : null;
      if (!k) { k = { id: (id = uid()), name: name.trim(), names: [], units: [] }; Object.assign(k, B.classNewWay()); l.classes.push(k); }
      const was = k.names.slice(), more = fresh(k);
      k.names = k.names.concat(more.map(s => s.name));
      // an email in the file is kept as that student's details, the same as one pasted with a roster
      const by = new Map([...B.rosterPairs(k.names, d.students.map(s => s.name))].map(([n, f]) => [f, n]));
      B.keepInfo(k, was, d.students.filter(s => s.email && by.has(s.name)).map(s => ({ name: by.get(s.name), email: s.email })));
    }, true);
    if (d.cols) { handoff.rows = d.rows; handoff.cls = id; }
    onClose(id, !!d.cols);
  };
  const go = !d ? '' : c ? (d.cols ? t('class.gc_check') : add.length ? t('class.gc_add_n', { n: add.length }) : t('class.done')) : d.cols ? t('class.gc_make_check') : t('class.gc_make');
  return <Sheet open wide title={t('class.gc_title')} onClose={() => onClose(null)}
    footer={<><span class="grow" /><Button onClick={() => onClose(null)}>{t('common.cancel')}</Button><Button variant="primary" disabled={!d} onClick={save} data-gc-go>{go || t('class.gc_make')}</Button></>}>
    <div class="cp-gc" data-gc>
      <p class="mute small">{t('class.gc_say')}</p>
      <section class="cp-gccard"><span class="n" aria-hidden="true">1</span><div><h3>{t('class.gc_1')}</h3>
        <ol class="small"><li>{t('class.gc_1a')}</li><li>{t('class.gc_1b')}</li><li>{t('class.gc_1c')}</li></ol>
        <div class="cp-bkidrop"><Button variant="primary" icon="upload" onClick={() => file.current.click()} data-gc-file>{t('class.gc_choose')}</Button><DriveButton input={file} /><span class="mute small" data-raw={d ? '' : undefined}>{d ? d.file : t('class.gc_kinds')}</span>
          <input ref={file} type="file" hidden accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => { read(e.currentTarget.files[0]); e.currentTarget.value = ''; }} data-gc-input /></div>
        {err && <p class="cp-err" role="alert">{err}</p>}
        {d && <div class="cp-gcfound" data-gc-found>
          <p>{t('class.gc_found', { n: d.students.length })} {d.cols ? t('class.gc_found_cols', { n: d.cols }) : t('class.gc_roster_only')}</p>
          <div class="cp-addgrid"><Select label={t('class.gc_put')} value={to} onChange={setTo} options={[{ value: '', label: t('class.gc_new_class') }].concat(classes.map(k => ({ value: k.id, label: k.name })))} data-gc-to />
            {!c && <TextInput label={t('class.class_name')} value={name} onInput={v => { setName(v); setNameErr(''); }} error={nameErr} placeholder={t('class.gc_name_ph')} data-gc-name />}</div>
          <p class="mute small">{c ? (add.length ? t('class.gc_will_add', { n: add.length }) + ' ' + add.map(s => s.name).join(', ') : t('class.gc_all_there')) : t('class.gc_order')}{d.cols ? ' ' + t('class.gc_next') : ''}</p></div>}
      </div></section>
      <section class="cp-gccard"><span class="n" aria-hidden="true">2</span><div><h3>{t('class.gc_2')}</h3>
        <ol class="small"><li>{t('class.gc_2a')}</li><li>{t('class.gc_2b')}</li><li>{t('class.gc_2c')}</li></ol>
        <p class="mute small">{t('class.gc_2_note')}</p></div></section>
      <p class="mute small">{t('class.gc_back')}</p>
    </div>
  </Sheet>;
}
