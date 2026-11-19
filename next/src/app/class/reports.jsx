// Report comments (src/reports.js): a draft for each student from the gradebook's own numbers and the teacher's own sentences, put
// together in this browser by the lifted rptFacts and rptDraft. No AI writes it and nothing is sent. Each comment is kept for the
// term in the student's details (c.info[name].rep[term]), what the student is called and the pronoun beside it, and how she likes
// them written in lib.book.rep, all saved as the current app saves them. A sheet from under the gradebook.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { leavingReady } from '../../students/write.js';
import { Sheet, Dialog, Button, Segmented, TextInput, Checkbox, Select, Mic, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import * as undoList from '../../services/undo.js';
import { copyText } from '../../services/clipboard.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { fmtNum } from '../../engines/gcore.js';
import { pct } from './grades.jsx';
import './lines.js';

const LEN = { short: 'class.rp_short', medium: 'class.rp_medium', long: 'class.rp_long' };
const PRO = { they: 'class.rp_they', she: 'class.rp_she', he: 'class.rp_he', name: 'class.rp_name_only' };
const SLOT = { openHigh: 'class.rp_s_openhigh', openGood: 'class.rp_s_opengood', openMid: 'class.rp_s_openmid', openLow: 'class.rp_s_openlow', openNone: 'class.rp_s_opennone', grade: 'class.rp_s_grade', strong: 'class.rp_s_strong', best: 'class.rp_s_best', up: 'class.rp_s_up', down: 'class.rp_s_down', next: 'class.rp_s_next', level: 'class.rp_s_level', missing1: 'class.rp_s_missing1', missing: 'class.rp_s_missing', closeHigh: 'class.rp_s_closehigh', closeGood: 'class.rp_s_closegood', closeMid: 'class.rp_s_closemid', closeLow: 'class.rp_s_closelow' };
const csv = rows => rows.map(r => r.map(v => { const s = B.csvSafe(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
const save = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })); a.download = name.replace(/[\\/:*?"<>|]+/g, ' '); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const stateOf = e => (e.done ? ['ok', 'class.rp_done'] : e.text != null ? ['on', 'class.rp_edited'] : ['', 'class.rp_draft']);
// The engine reads the class, the term and the library it is handed.
const use = (x, term) => { B.bookUse({ lib: x.lib }); B.bkUse({ cls: x.c.id, term: term === '*' ? '*' : term }); };
const putRep = (c, n, patch, term) => change(t('class.u_report'), l => { const k = classIn(l, c.id); if (!k || !k.names.includes(n)) return; B.bkUse({ cls: c.id, term }); B.rptPut(k, n, patch); });
const conf = l => { const r = { ...((l.book || {}).rep || {}) }; return r; };
const putConf = part => change(t('class.u_report_opts'), l => { l.book = { ...(l.book || {}), rep: { ...conf(l), ...part } }; }, true);

export function ReportsSheet({ x, cols, term, onClose }) {
  const { c } = x, [stu, setStu] = useState(0), [words, setWords] = useState(false), [text, setText] = useState(null), wait = useRef(0), box = useRef(null);
  use(x, term);
  const rc = B.rptConf(), i = Math.max(0, Math.min(c.names.length - 1, stu)), n = c.names[i];
  const f = B.rptFacts(c, cols, x.conf, n), e = B.rptEntry(c, n), shown = text != null ? text : e.text != null ? e.text : B.rptDraft(c, n, f, rc, e.v);
  const done = c.names.filter(k => B.rptEntry(c, k).done).length;
  const flush = () => { clearTimeout(wait.current); if (text != null && text !== (e.text != null ? e.text : null)) { const v = text; putRep(c, n, { text: v, t: Date.now() }, term); } };
  // what was typed in the last moment is kept when the sheet closes or the tab is closed (src/reports.js pagehide rptKeep, audit H-066)
  const keep = useRef(null); keep.current = flush;
  useEffect(() => { const k = () => keep.current(), v = () => { if (document.visibilityState === 'hidden') k(); };
    leavingReady(); addEventListener('pagehide', k); document.addEventListener('visibilitychange', v);
    return () => { removeEventListener('pagehide', k); document.removeEventListener('visibilitychange', v); k(); }; }, []);
  const go = k => { flush(); setText(null); setStu(k); setTimeout(() => { const ta = box.current && box.current.querySelector('[data-rp-text]'); if (ta) ta.focus({ preventScroll: true }); }); };
  const typed = v => { setText(v); clearTimeout(wait.current); wait.current = setTimeout(() => putRep(c, n, { text: v, t: Date.now() }, term), 400); };
  const again = () => { const wasTyped = e.text != null; clearTimeout(wait.current); setText(null); putRep(c, n, { text: null, done: false, v: ((e.v || 0) + 1) % 60, t: Date.now() }, term).then(() => toast(t(wasTyped ? 'class.rp_again_lost' : 'class.rp_again'), { undo: () => undoList.undo() })); };
  const finish = async next => {
    clearTimeout(wait.current);
    if (!next) await putRep(c, n, { text: shown, done: true, t: Date.now() }, term);
    use(x, term);
    const left = c.names.map((k, j) => j).filter(j => j !== i || next ? !B.rptEntry(c, c.names[j]).done : false), after = left.find(j => j > i);
    if (!left.length && !next) { setText(null); toast(t('class.rp_all_done')); return; }
    go(after != null ? after : next && i < c.names.length - 1 ? i + 1 : left[0] != null ? left[0] : i);
  };
  const all = () => { flush(); use(x, term); return c.names.map(k => [k, B.rptText(c, cols, x.conf, k, B.rptConf())]); };
  const count = s => { const k = [...s].length; return rc.limit ? <span class={k > rc.limit ? 'over' : ''}>{t('class.rp_count_of', { n: k, of: rc.limit })}{k > rc.limit ? ' · ' + t('class.rp_over', { n: k - rc.limit }) : ''}</span> : t('class.rp_count', { n: k }); };
  const one = v => fmtNum(Math.round(v * 10) / 10);
  const chips = [f.chip ? f.chip : f.grade != null ? t(f.soFar ? 'class.rp_grade_so_far' : 'class.rp_grade', { g: pct(f.grade) }) : t('class.rp_no_grade')];
  if (f.strong) chips.push(t('class.rp_strongest', { row: f.strong.name, v: one(f.strong.avg) }));
  if (f.weak) chips.push(t('class.rp_work_on', { row: f.weak.name, v: one(f.weak.avg) }));
  if (Math.abs(f.move) >= 5) chips.push(t(f.move > 0 ? 'class.rp_up' : 'class.rp_down', { n: Math.abs(Math.round(f.move)) }));
  if (!f.scored) chips.push(t('class.rp_nothing'));
  return <Sheet open wide title={t('class.rp_title')} onClose={() => { flush(); onClose(); }}>
    <div class="cp-rpt" ref={box} data-reports>
      <div class="rptopts">
        <TextInput label={t('class.rp_subject')} value={(rc.subj || {})[c.id] || ''} placeholder={t('class.rp_subject_ph')} maxLength={60} onChange={ev => putConf({ subj: { ...rc.subj, [c.id]: ev.currentTarget.value.trim() } })} data-rp-subj />
        <div class="fld"><span class="lab">{t('class.rp_length')}</span><Segmented label={t('class.rp_length')} value={rc.len} onChange={v => putConf({ len: v })} options={B.RPT_LEN.map(([k]) => ({ value: k, label: t(LEN[k]) }))} /></div>
        <Checkbox label={t('class.rp_say_grade')} checked={rc.grade} onChange={v => putConf({ grade: v })} />
        <TextInput label={t('class.rp_limit')} type="number" min="0" step="50" value={rc.limit || ''} placeholder={t('class.rp_none')} onChange={ev => putConf({ limit: Math.max(0, Math.round(+ev.currentTarget.value || 0)) })} data-rp-limit />
        <span class="grow" /><Button size="sm" onClick={() => setWords(true)} data-rp-words>{t('class.rp_wording')}</Button>
        <Button size="sm" icon="copy" onClick={() => { const r = all(); copyText(r.map(k => k.map(v => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')).then(ok => toast(ok ? t('class.rp_copied_all', { n: r.length }) : t('class.copy_failed'))); }} data-rp-copyall>{t('class.rp_copy_all')}</Button>
        <Button size="sm" icon="download" onClick={() => save(t('class.rp_file', { name: c.name }) + '.csv', csv([[t('class.student'), t('class.rp_comment')], ...all()]) + '\r\n')} data-rp-csv>{t('class.mis_download')}</Button>
      </div>
      <p class="mute small">{t('class.rp_say')}</p>
      <div class="rptgrid">
        <nav class="rptlist" aria-label={t('class.rp_students')}><div class="mute small" data-rp-donecount>{t('class.rp_n_done', { n: done, of: c.names.length })}</div>
          {c.names.map((k, j) => { const s = stateOf(B.rptEntry(c, k)); return <button type="button" class={'rptrow' + (j === i ? ' on' : '')} aria-current={j === i ? 'true' : undefined} onClick={() => go(j)} data-rp-stu={j}>
            <span class="mute num">{j + 1}</span><span class="nm" data-raw>{k}</span><span class={'tag ' + s[0]}>{t(s[1])}</span></button>; })}</nav>
        <section class="rptone">
          <div class="rpthead"><h3 data-raw data-rp-name>{n}</h3><span class="mute small">{t('class.rp_n_of', { n: i + 1, of: c.names.length })}</span><span class="grow" />
            <TextInput label={t('class.rp_called')} value={B.rptCall(c, n)} maxLength={40} onChange={ev => { const v = ev.currentTarget.value.trim(); change(t('class.u_report'), l => { const k = classIn(l, c.id); if (k) B.setInfo(k, n, { call: v && v !== B.rptCall({ info: {} }, n) ? v : '' }); }, true); }} data-rp-call />
            <Select label={t('class.rp_pronoun')} value={B.rptPro(c, n)} onChange={v => change(t('class.u_report'), l => { const k = classIn(l, c.id); if (k) B.setInfo(k, n, { pro: v === 'they' ? '' : v }); }, true)} options={B.RPT_PROS.map(([k]) => ({ value: k, label: t(PRO[k]) }))} data-rp-pro /></div>
          <div class="rptfacts">{chips.map(s => <span class="tag">{s}</span>)}{f.missing.length > 0 && <span class="tag warn">{t('class.rp_missing', { n: f.missing.length })}</span>}</div>
          <textarea class="input" rows="7" value={shown} aria-label={t('class.rp_for', { name: n })} spellcheck onInput={ev => typed(ev.currentTarget.value)} onBlur={flush} data-rp-text data-raw />
          <div class="rptfoot"><span class="mute small" data-rp-count>{count(shown)}</span><span class="grow" /><Mic onText={w => typed((shown.trim() ? shown.replace(/\s*$/, ' ') : '') + w.trim())} />
            <Button size="sm" onClick={again} title={t('class.rp_again_say')} data-rp-again>{t('class.rp_draft_again')}</Button>
            <Button size="sm" icon="copy" onClick={() => copyText(shown).then(ok => toast(t(ok ? 'class.rp_copied' : 'class.copy_failed')))} data-rp-copy>{t('class.rp_copy')}</Button>
            {e.done ? <><Button size="sm" onClick={() => putRep(c, n, { done: false }, term)} data-rp-undone>{t('class.rp_not_done')}</Button><Button variant="primary" onClick={() => finish(true)} data-rp-next>{t('class.rp_next')}</Button></>
              : <Button variant="primary" onClick={() => finish(false)} data-rp-done>{t('class.rp_done_next')}</Button>}</div>
          {f.said.length > 0 && <section class="rptsaid"><h4>{t('class.rp_said')}</h4>{f.said.map(s => <div class="rptq"><div data-raw><b>{s.work}</b><p>{s.text}</p></div>
            <Button size="sm" onClick={() => { const v = (shown.trim() ? shown.trim() + ' ' : '') + s.text; setText(v); putRep(c, n, { text: v, t: Date.now() }, term); }} title={t('class.rp_add_say')}>{t('class.td_add')}</Button></div>)}</section>}
        </section>
      </div>
    </div>
    {words && <Words rc={rc} onClose={() => setWords(false)} />}
  </Sheet>;
}

// Her own sentences, one way of saying it on each line (src/reports.js rptWordsDlg). An empty box goes back to the built-in ones.
function Words({ rc, onClose }) {
  const [v, setV] = useState(() => Object.fromEntries(B.RPT_SLOTS.map(([k]) => [k, ((rc.words[k] || []).filter(Boolean).length ? rc.words[k] : B.RPT_WORDS[k]).join('\n')])));
  const go = async () => {
    const out = {};
    for (const [k] of B.RPT_SLOTS) { const lines = v[k].split('\n').map(s => s.trim()).filter(Boolean); if (lines.length && lines.join('\n') !== B.RPT_WORDS[k].join('\n')) out[k] = lines; }
    await putConf({ words: out }); onClose(); toast(t('class.rp_words_saved'));
  };
  return <Dialog open title={t('class.rp_wording_t')} onClose={onClose} actions={<><Button onClick={() => setV(Object.fromEntries(B.RPT_SLOTS.map(([k]) => [k, B.RPT_WORDS[k].join('\n')])))}>{t('class.mis_builtin')}</Button><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={go} data-rp-words-save>{t('class.save')}</Button></>}>
    <p class="mute small">{t('class.rp_words_say')}</p><p class="mute small">{t('class.rp_fills')}</p>
    <div class="rpwords">{B.RPT_SLOTS.map(([k]) => <label class="cp-fld"><span class="lab">{t(SLOT[k])}</span><textarea class="input" rows="3" value={v[k]} onInput={ev => { const x = ev.currentTarget.value; setV(o => ({ ...o, [k]: x })); }} data-rp-slot={k} /></label>)}</div>
  </Dialog>;
}
