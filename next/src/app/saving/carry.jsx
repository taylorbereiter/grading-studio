// Carry your work (src/takehome.js openTake, bringFile, bringPreview, removeHere) and the school year (src/newyear.js openNewYear,
// openArchivedYear, yearRender): the take-home file, bringing one in, Remove from this computer, and a new year. The steps are
// whole/'s (takehome.js, newyear.js, remove.js), reached through services/saving.js; anything that replaces what's here has every
// other window stop first (shared/tabs.js finish, over).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Card, Button, Checkbox, Dialog, Sheet, TextInput, Progress, toast } from '../../ui/index.js';
import { t, num, date } from '../../i18n/t.js';
import { useSaving } from '../../services/saving.js';
import { sampleOn } from '../sample.js';
import { finish, over } from '../../shared/tabs.js';
import { Conflicts } from './conflicts.jsx';
import './lines.js';

const size = b => b >= 1048576 ? t('file.mb', { n: num(b / 1048576, { maximumFractionDigits: 1 }) }) : t('file.kb', { n: num(Math.max(1, Math.round(b / 1024))) });
const when = v => date(new Date(v), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const day = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ERR = { notours: 'saving.e_notours', notbackup: 'saving.e_notbackup', pass: 'saving.e_pass', newer: 'saving.e_newer' };
const errSay = e => t((e && ERR[e.code]) || 'saving.e_damaged');
const passOk = (p1, p2) => 8 > p1.length ? t('saving.pass_short') : p2 != null && p1 !== p2 ? t('saving.pass_differ') : '';
const reload = () => setTimeout(() => location.reload(), 700);

function Pass({ twice, p, set, onEnter }) {
  const key = e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } };
  return <>
    <TextInput label={t('saving.pass')} type="password" autocomplete="off" value={p[0]} onInput={v => set(x => [v, x[1]])} onKeyDown={key} data-svp1 autofocus />
    {twice && <TextInput label={t('saving.pass2')} type="password" autocomplete="off" value={p[1]} onInput={v => set(x => [x[0], v])} onKeyDown={key} data-svp2 />}
  </>;
}
// A box that only says how it went.
const Said = ({ title, text, more, btn, onClose }) => <Dialog open title={title} onClose={onClose}
  actions={<Button variant="primary" onClick={onClose} data-ok>{btn || t('saving.done')}</Button>}><p data-svsaid>{text}</p>{more && <p><b>{more}</b></p>}</Dialog>;
const Busy = ({ title, text, n, of, stop }) => <Dialog open title={title} onClose={() => {}}
  actions={stop ? <Button onClick={stop} data-svstopnow>{t('saving.stop')}</Button> : null}><div data-svbusy><Progress value={of ? Math.min(n || 0, of) : null} max={of || 1} text={text} label={text} /></div></Dialog>;

/* Take my work with me */
export function Take({ S, onClose }) {
  const [p, setP] = useState(['', '']), [err, setErr] = useState(''), [lack, setLack] = useState([]), [run, setRun] = useState(null), [end, setEnd] = useState(null), stop = useRef(false);
  useEffect(() => { S.take().then(m => m.papersLacking()).then(setLack, e => console.error(e)); }, []);
  const go = async () => {
    const e = passOk(p[0], p[1]); if (e) return setErr(e);
    const T = await S.take();
    let sink; try { sink = await T.takeSink(t('saving.take_file', { day: day() }) + T.TAKE_EXT, t('saving.take_kind')); }
    catch (er) { if (er && er.name === 'AbortError') return; console.error(er); return setErr(t('saving.take_where')); }
    const total = await T.sizeHere();
    setRun({ n: 0, of: total });
    try {
      const sz = await T.makeTakeHome(sink, p[0], n => setRun({ n, of: total }), () => stop.current);
      const l = await T.papersLacking();
      setEnd({ text: t('saving.take_done', { name: sink.name, size: size(sz) }), more: l.length ? t('saving.take_done_lack', { list: l.join(', ') }) : '' });
    } catch (er) {
      try { await sink.abort(); } catch {}
      if (er && er.name === 'AbortError') return onClose();
      console.error(er); setEnd({ text: t('saving.take_fail'), fail: true });
    } finally { setRun(null); }
  };
  if (end) return <Said title={t('saving.take')} text={end.text} more={end.more} btn={end.fail ? t('saving.close') : ''} onClose={onClose} />;
  if (run) return <Busy title={t('saving.take')} text={run.of ? t('saving.packing_n', { n: size(run.n), of: size(run.of) }) : t('saving.packing')} n={run.n} of={run.of} stop={() => { stop.current = true; }} />;
  return <Dialog open title={t('saving.take')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={go} data-ok>{t('saving.take_go')}</Button></>}>
    <p>{t('saving.take_about')}</p><p class="mute">{t('saving.pass_about')}</p>
    {lack.length > 0 && <p class="sv-warn" data-svlack><span data-raw>{t('saving.take_lack', { list: lack.join(', ') })}</span></p>}
    <Pass twice p={p} set={setP} onEnter={go} />
    {err && <p class="sv-err" role="alert">{err}</p>}
  </Dialog>;
}

/* Bring work in */
function Preview({ P }) {
  const out = [];
  if (P.fresh.length) out.push(<><p><b>{t('saving.b_new', { n: P.fresh.length })}</b></p><ul>{P.fresh.map(r => <li><span data-raw>{r.name}</span> <span class="mute">· {t('saving.b_students', { n: r.n })}{r.size ? ', ' + size(r.size) : ''}</span></li>)}</ul></>);
  const mg = P.merged.filter(r => r.extra || r.come.length || r.setIn.length);
  if (mg.length) out.push(<><p><b>{t('saving.b_changed')}</b></p><ul data-svmerge>{mg.map(r => <li><b data-raw>{r.name}</b>
    {r.come.length > 0 && <div>{t('saving.b_come', { n: r.come.length })}</div>}
    {r.stay.length > 0 && <div class="mute">{t('saving.b_stay', { n: r.stay.length })}</div>}
    {r.extra > 0 && <div>{t('saving.b_extra', { n: r.extra })}</div>}
    {r.setIn.length > 0 && <div>{t('saving.b_set', { n: r.setIn.length })}</div>}</li>)}</ul></>);
  if (P.gone.length) out.push(<><p><b>{t('saving.b_gone')}</b></p><ul>{P.gone.map(r => <li><span data-raw>{r.name}</span> <span class="mute">· {t(r.onA ? 'saving.b_gone_a' : 'saving.b_gone_b')}</span></li>)}</ul></>);
  const also = [P.notes.length && t('saving.b_lib', { n: P.notes.length }), P.also.bank && t('saving.b_bank'), P.also.school && t('saving.b_school'), P.also.other && t('saving.b_other'),
    (P.ex.add + P.ex.change + P.ex.drop) && t('saving.b_ex', { n: P.ex.add + P.ex.change + P.ex.drop }), P.planner.n && (P.planner.empty ? t('saving.b_plan_all') : t('saving.b_plan', { n: P.planner.n }))].filter(Boolean);
  if (also.length) out.push(<ul data-svalso>{also.map(x => <li>{x}</li>)}</ul>);
  if (P.same) out.push(<p class="mute">{t('saving.b_same', { n: P.same })}</p>);
  if (P.room) out.push(<p class="sv-warn" data-svroom>{t('saving.b_room', { need: size(P.need), room: size(P.room) })}</p>);
  return <>{out}</>;
}
function Bring({ S, file, onClose }) {
  const [p, setP] = useState(['', '']), [err, setErr] = useState(''), [step, setStep] = useState(file && /\.zip$/i.test(file.name) ? 'zip' : 'pass'), [prog, setProg] = useState(null);
  const [got, setGot] = useState(null), [P, setPv] = useState(null), [again, setAgain] = useState(false), [end, setEnd] = useState(null);
  const show = async g => { const T = await S.take(); setPv(await T.bringPreview(g.B)); setStep('show'); };
  const open = async () => {
    const T = await S.take();
    setStep('check'); setProg({ n: 0, of: 0 });
    try { const g = step === 'zip' ? await T.readBackupZip(file) : await T.readTakeHome(file, p[0], n => setProg({ n, of: file.size })); setGot(g); await show(g); }
    catch (e) {
      if (!e || !e.code) console.error(e);
      if (e && e.code === 'pass') { setStep('pass'); return setErr(errSay(e)); }
      setEnd({ text: errSay(e) });
    }
  };
  useEffect(() => { if (step === 'zip') open(); }, []);
  const bring = async picked => {
    const T = await S.take();
    setStep('bringing'); setProg({ n: 0, of: 0 });
    try {
      await finish(); over('go');
      const went = await T.bringIn(got.B, got.src, P.shown, picked || {}, (n, of) => setProg({ n, of }));
      if (!went) { over('done'); setAgain(true); return show(got); }
      over('done'); toast(t('saving.reloading')); reload();
    } catch (e) {
      console.error(e); over('done');
      setEnd({ text: e && e.small ? t('saving.b_small') : e && e.name === 'QuotaExceededError' ? t('saving.b_full') : t('saving.b_fail') });
    }
  };
  if (end) return <Said title={t('saving.bring')} text={end.text} btn={t('saving.close')} onClose={onClose} />;
  if (step === 'check' || step === 'zip') return <Busy title={t('saving.bring')} text={prog && prog.of ? t('saving.checking_n', { n: size(prog.n), of: size(prog.of) }) : t('saving.checking')} n={prog && prog.n} of={prog && prog.of} />;
  if (step === 'bringing') return <Busy title={t('saving.bring')} text={t('saving.b_bringing')} n={prog && prog.n} of={prog && prog.of} />;
  if (step === 'asks') return <Conflicts asks={P.asks} title={t('saving.bring')} intro={t('saving.b_asks_intro')} other={t('saving.b_file')} later={t('common.cancel')} onDone={a => a ? bring(a) : onClose()} />;
  if (step === 'show') return <Sheet open wide title={t('saving.bring')} onClose={onClose}
    footer={<><Button onClick={onClose}>{t('common.cancel')}</Button>{!P.nothing && <Button variant="primary" onClick={() => P.asks.length ? setStep('asks') : bring()} data-svbringgo>{t('saving.b_go')}</Button>}</>}>
    <div data-svpreview>
      {got.B.info && got.B.info.t && <p class="mute">{t('saving.b_made', { when: when(got.B.info.t) })}</p>}
      {again && <p class="sv-warn"><b>{t('saving.b_again')}</b></p>}
      {P.nothing ? <p data-svnothing>{t('saving.b_nothing')}</p> : <><Preview P={P} /><p class="mute">{t('saving.b_safe')}</p></>}
    </div></Sheet>;
  return <Dialog open title={t('saving.bring')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={open} data-ok>{t('saving.open_it')}</Button></>}>
    <p><span data-raw>{t('saving.bring_pass', { name: file.name })}</span></p>
    <Pass p={p} set={setP} onEnter={open} />
    {err && <p class="sv-err" role="alert">{err}</p>}
  </Dialog>;
}

/* Remove from this computer */
function Remove({ S, onClose }) {
  const [I, setI] = useState(null), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { S.remove().then(m => m.removeInfo()).then(setI, e => console.error(e)); }, []);
  if (!I) return null;
  const go = async () => {
    if (typed.trim().toUpperCase() !== t('saving.rm_word').toUpperCase()) return;
    setBusy(true);
    try { await finish(); over('go'); await (await S.remove()).removeHere(); over('done'); toast(t('saving.rm_done')); reload(); }
    catch (e) { console.error(e); over('done'); setBusy(false); toast(t('saving.rm_fail'), { ms: 15000 }); }
  };
  const warn = !I.n ? '' : !I.last ? t('saving.rm_never') : I.newer ? t('saving.rm_newer', { n: I.newer, when: when(I.last) }) : t('saving.rm_after', { when: when(I.last) });
  return <Dialog open title={t('saving.rm')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('saving.rm_keep')}</Button><Button variant="primary" disabled={busy || typed.trim().toUpperCase() !== t('saving.rm_word').toUpperCase()} onClick={go} data-ok>{t('saving.rm')}</Button></>}>
    <p>{t('saving.rm_text', { n: I.n })}</p>
    {warn && <p class="sv-warn" data-svrmwarn>{warn}</p>}
    {I.folder && <p><span data-raw>{t('saving.rm_folder', { name: I.folder })}</span></p>}
    <p>{t('saving.rm_plan')}</p>
    <TextInput label={t('saving.rm_type')} autocomplete="off" value={typed} onInput={setTyped} onKeyDown={e => { if (e.key === 'Enter') go(); }} data-svrmtype autofocus />
  </Dialog>;
}

export function CarryCard() {
  const S = useSaving(), [box, setBox] = useState(null), inp = useRef(null);
  if (!S || !S.take) return null;
  const pickFile = e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; if (f) setBox({ k: 'bring', file: f }); };
  const close = () => setBox(null);
  return <Card title={t('saving.c_h')} data-svcarry>
    <p class="mute">{sampleOn() ? t('saving.c_sample') : t('saving.c_about')}</p>
    {!sampleOn() && <div class="row gap wrap">
      <Button variant="primary" onClick={() => setBox({ k: 'take' })} data-svtake>{t('saving.take')}</Button>
      <Button onClick={() => inp.current.click()} data-svbring>{t('saving.bring')}</Button>
      <input type="file" accept=".gswork,.zip" hidden ref={inp} onChange={pickFile} data-svbringin />
      <Button variant="quiet" onClick={() => setBox({ k: 'remove' })} data-svremove>{t('saving.rm')}</Button>
    </div>}
    {box && box.k === 'take' && <Take S={S} onClose={close} />}
    {box && box.k === 'bring' && <Bring S={S} file={box.file} onClose={close} />}
    {box && box.k === 'remove' && <Remove S={S} onClose={close} />}
  </Card>;
}

/* the school year */
function NewYear({ S, I, onClose }) {
  const [o, setO] = useState({ from: I.now, to: I.next, dates: true, planner: I.planner, roster: false }), [p, setP] = useState(['', '']), [err, setErr] = useState('');
  const [run, setRun] = useState(null), [end, setEnd] = useState(null);
  const set = x => setO(v => ({ ...v, ...x }));
  const go = async () => {
    const from = o.from.trim(), to = o.to.trim();
    if (!from || !to) return setErr(t('saving.y_names'));
    if (from === to) return setErr(t('saving.y_same'));
    const e = passOk(p[0], p[1]); if (e) return setErr(e);
    const Yr = await S.year(), oo = { ...o, from, to };
    setRun({ text: t('saving.y_saving', { year: from }) });
    let made;
    try { made = await Yr.yearArchive(from, p[0], t('saving.y_kind'), (s, n, of) => setRun({ text: s === 'check' ? (of ? t('saving.checking_n', { n: size(n), of: size(of) }) : t('saving.checking')) : t('saving.y_saving', { year: from }), n, of })); }
    catch (er) { setRun(null); if (er && er.name === 'AbortError') return; console.error(er); return setEnd({ title: t('saving.y_start'), text: t(er && er.check ? 'saving.y_check_fail' : 'saving.y_fail'), fail: true }); }
    oo.file = made.name;
    setRun({ text: t('saving.y_starting', { year: to }) });
    try { await finish(); over('go'); await Yr.yearStart(oo); over('done'); }
    catch (er) { console.error(er); over('done'); setRun(null); return setEnd({ title: t('saving.y_start'), text: t('saving.y_start_fail', { year: from, file: made.name }), fail: true }); }
    setRun(null);
    setEnd({ title: t('saving.y_started', { year: to }), text: t('saving.y_started_text', { from, file: made.name, size: size(made.size) }), reload: true });
  };
  if (end) return <Said title={end.title} text={end.text} btn={end.fail ? t('saving.close') : ''} onClose={end.reload ? () => location.reload() : onClose} />;
  // the progress stays in the same box: one modal swapped for another while it works is not worth the risk
  return <Sheet open title={t('saving.y_start')} onClose={run ? () => {} : onClose}
    footer={run ? null : <><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={go} data-svyeargo>{t('saving.y_go')}</Button></>}>
    {run ? <div data-svbusy><Progress value={run.of ? Math.min(run.n || 0, run.of) : null} max={run.of || 1} text={run.text} label={run.text} /></div> : <div data-svnewyear>
      <p>{t('saving.y_about')}</p>
      <div class="row gap wrap"><TextInput label={t('saving.y_from')} autocomplete="off" value={o.from} onInput={v => set({ from: v })} data-svyfrom data-raw />
        <TextInput label={t('saving.y_to')} autocomplete="off" value={o.to} onInput={v => set({ to: v })} data-svyto data-raw /></div>
      <h3>{t('saving.y_carry')}</h3>
      <Checkbox label={t('saving.y_cards', { n: I.classes })} checked disabled onChange={() => {}} />
      <span data-svydates><Checkbox label={t('saving.y_dates')} checked={o.dates} onChange={v => set({ dates: v })} /></span>
      {I.planner && <span data-svyplan><Checkbox label={t('saving.y_plan')} checked={o.planner} onChange={v => set({ planner: v })} /></span>}
      <span data-svyroster><Checkbox label={t('saving.y_roster')} checked={o.roster} onChange={v => set({ roster: v })} /></span>
      <p class="mute">{t('saving.y_stays')}{I.downloads ? ' ' + t('saving.y_leave', { n: I.downloads }) : ''}</p>
      <h3>{t('saving.y_protect')}</h3>
      <p class="mute">{t('saving.y_pass_about')}</p>
      <Pass twice p={p} set={setP} onEnter={go} />
      {err && <p class="sv-err" role="alert">{err}</p>}
    </div>}</Sheet>;
}
function OpenYear({ S, I, file, onClose }) {
  const [p, setP] = useState(['', '']), [err, setErr] = useState(''), [run, setRun] = useState(null), [got, setGot] = useState(null), [end, setEnd] = useState(null);
  const open = async () => {
    const Yr = await S.year();
    setRun({ text: t('saving.checking') });
    try { setGot(await Yr.yearOpen(file, p[0], (n, of) => setRun({ text: t('saving.checking_n', { n: size(n), of: size(of) }), n, of }))); setRun(null); }
    catch (e) { setRun(null); if (!e || !e.code) console.error(e); if (e && e.code === 'pass') return setErr(errSay(e)); setEnd({ text: errSay(e) }); }
  };
  const year = got && (got.year || t('saving.y_a_year'));
  const swap = async () => {
    const Yr = await S.year();
    setRun({ text: t('saving.y_saving', { year: I.now }) });
    let made;
    try { made = await Yr.yearArchive(I.now, p[0], t('saving.y_kind'), (s, n, of) => setRun({ text: s === 'check' ? t('saving.checking') : t('saving.y_saving', { year: I.now }), n, of })); }
    catch (er) { setRun(null); if (er && er.name === 'AbortError') return; console.error(er); return setEnd({ text: t(er && er.check ? 'saving.y_check_fail' : 'saving.y_fail') }); }
    setRun({ text: t('saving.y_open_h', { year }) });
    try { await finish(); over('go'); await Yr.yearReplace(got, { name: I.now, at: Date.now(), file: made.name }); over('done'); toast(t('saving.reloading')); reload(); }
    catch (er) { console.error(er); over('done'); setRun(null); setEnd({ text: t('saving.y_open_fail', { now: I.now, file: made.name }) }); }
  };
  const f = S.folder ? S.folder() : null;
  if (end) return <Said title={t('saving.y_open')} text={end.text} btn={t('saving.close')} onClose={onClose} />;
  if (run) return <Busy title={t('saving.y_open')} text={run.text} n={run.n} of={run.of} />;
  if (got) return <Dialog open title={t('saving.y_open_h', { year })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={swap} data-svyopengo>{t('saving.y_open_go', { now: I.now, year })}</Button></>}>
    <p>{t('saving.y_open_text', { n: got.n, when: got.t ? when(got.t) : t('saving.cf_earlier') })}</p>
    <p>{t('saving.y_open_first', { now: I.now })}</p>
    <p class="mute">{t('saving.y_open_plan')}{f && f.state !== 'none' ? ' ' + t('saving.y_open_folder', { name: f.name }) : ''}</p>
  </Dialog>;
  return <Dialog open title={t('saving.y_open')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={open} data-ok>{t('saving.open_it')}</Button></>}>
    <p><span data-raw>{t('saving.bring_pass', { name: file.name })}</span></p>
    <Pass p={p} set={setP} onEnter={open} />
    {err && <p class="sv-err" role="alert">{err}</p>}
  </Dialog>;
}
export function YearCard() {
  const S = useSaving(), [I, setI] = useState(null), [box, setBox] = useState(null), inp = useRef(null);
  useEffect(() => { let live = true; if (S && S.year) S.year().then(m => m.yearInfo()).then(v => live && setI(v), e => console.error(e)); return () => { live = false; }; }, [S]);
  if (!S || !S.year || !I || sampleOn()) return null;
  const pickFile = e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; if (f) setBox({ k: 'open', file: f }); };
  const close = () => setBox(null);
  return <Card title={t('saving.y_h')} data-svyear>
    <p data-svyearline><span data-raw>{t('saving.y_now', { year: I.now })}</span>{!I.named && <span class="mute"> {t('saving.y_guessed')}</span>}</p>
    {I.years.length > 0 && <p class="mute" data-raw>{t('saving.y_archived', { list: I.years.map(y => t('saving.y_in', { year: y.name, file: y.file || '', when: date(new Date(y.at), { month: 'short', day: 'numeric', year: 'numeric' }) })).join('; ') })}</p>}
    <div class="row gap wrap">
      <Button onClick={() => setBox({ k: 'new' })} data-svyearnew>{t('saving.y_start')}</Button>
      <Button variant="quiet" onClick={() => inp.current.click()} data-svyearopen>{t('saving.y_open')}</Button>
      <input type="file" accept=".gswork" hidden ref={inp} onChange={pickFile} data-svyearin />
    </div>
    {box && box.k === 'new' && <NewYear S={S} I={I} onClose={close} />}
    {box && box.k === 'open' && <OpenYear S={S} I={I} file={box.file} onClose={close} />}
  </Card>;
}
