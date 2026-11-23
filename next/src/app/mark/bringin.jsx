// Many files at once, each sorted to a student by the name in its file or folder name (src/app/bringin.js), loaded as a part of
// its own (router.js PARTS.bringin):
// - Bring in files…, in the paper's Add menu: files go into the open download, each to the student picked (Matched by name, Check,
//   Choose, Chosen by you, Skipped), someone new added with New student…, a Late tick beside anyone to mark late (nothing taken off),
//   and files already here left out (lifted freshRows). Each file is added as Add a file… adds one (mark/change.js addFiles).
// - Files to match to a roster…, in an assignment's Bring in papers menu on the class page: outside files matched to a class's
//   roster and opened as a new download, one folder per student (the current app's matchToRoster).
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Dialog, TextInput, toast } from '../../ui/index.js';
import { state, use } from '../../engines/gcore.js';
import { shownName, anonOn, anonOrder } from '../../engines/gdraw.js';
import * as E from '../../engines/gopen.js';
import { freshRows, guessNewName } from '../../engines/gfiles.js';
import { sortGuess, guessAmong, nameWords, troubleOf } from '../../engines/greport.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './lines.js';
import './setup-lines.js';
import './inout-lines.js';
import { PARTS } from '../router.js';

const nfc = s => String(s).normalize('NFC');
// Picked files as [{ path, file }], keeping folder names (they often hold the student's name) and opening ZIPs (expandPicked).
export async function expand(files) {
  const out = [];
  for (const f of files) {
    const path = f.webkitRelativePath || f.name;
    if (E.junk(path)) continue;
    if (/\.zip$/i.test(f.name)) {
      const raw = [];
      try { E.unzipInto(new Uint8Array(await f.arrayBuffer()), '', raw, 0); } catch { continue; }
      for (const r of raw) if (r.data && !E.junk(r.path)) out.push({ path: f.name.replace(/\.zip$/i, '') + '/' + r.path, file: new File([r.data], r.path.split('/').pop()) });
      continue;
    }
    out.push({ path, file: f });
  }
  return out;
}

// The Mac app chooses folders through macOS itself; files come back with their folder path, like the web picker's (src/app/bringin.js
// nativeFolder, D-005). Only where the Mac app puts window.gsNative.
async function nativeFolder() {
  const N = window.gsNative, p = await N.pickFolder(); if (!p) return null;
  toast(t('inout.bf_opening', { name: p.name }));
  const r = await N.readFolder(); if (!r) return null;
  if (r.error) { toast(r.error === 'perm' ? t('inout.bf_mac_perm') : t('inout.bf_folder_no', { why: r.error }), { ms: 8000 }); return null; }
  if (!r.files.length) { toast(t('inout.bf_folder_empty', { name: r.name }), { ms: 6000 }); return null; }
  return r.files.map(f => { const file = new File([f.data], f.rel.split('/').pop(), { lastModified: f.mtime }); Object.defineProperty(file, 'webkitRelativePath', { value: r.name + '/' + f.rel }); return file; });
}
// Files (or a ZIP) or a whole folder, picked and opened into [{ path, file }] (src/app/bringin.js pickMany). Nothing picked: [] never comes.
export function pickMany(folder) {
  if (folder && window.gsNative) return nativeFolder().then(fs => (fs ? expand(fs) : new Promise(() => {})), e => { toast(t('inout.bf_folder_no', { why: e.message || e }), { ms: 8000 }); return new Promise(() => {}); });
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
    if (folder) inp.webkitdirectory = true;
    inp.onchange = async () => res(await expand([...inp.files]));
    inp.click();
  });
}
// Files or folder? (src/app/bringin.js askFilesOrFolder, D-001, D-002): what the files are for, then the two ways to pick them.
// kind 'bring': Bring in files on the marking screen; 'match': files to match to a roster.
// Bring in files also has A scan to split… (src/app/wiring.js data-scanin, A-103): the scan's pages go onto names and are added here.
export function FilesOrFolder({ kind, onPick, onClose }) {
  const [sp, setSp] = useState(null);
  const pick = folder => { onClose(); pickMany(folder).then(list => (list.length ? onPick(list) : toast(t('setup.bf_nothing')))); };
  const scan = () => { const i = document.createElement('input'); i.type = 'file'; i.onchange = () => { const f = i.files[0]; if (f) PARTS.split().then(S => setSp({ S, f }), e => console.error(e)); }; i.click(); };
  if (sp) return <sp.S.Split file={sp.f} into lib={state().lib} onClose={onClose} />;
  return <Dialog open title={t(kind === 'match' ? 'inout.mr_title' : 'inout.bf_title')} onClose={onClose}
    actions={<>{kind === 'bring' && <Button variant="quiet" onClick={scan} data-scanin>{t('setup.s_into')}</Button>}<Button onClick={onClose}>{t('setup.bf_cancel')}</Button><Button onClick={() => pick(false)} data-pf>{t('setup.w_files')}</Button><Button variant="primary" onClick={() => pick(true)} data-pd>{t('inout.bf_whole')}</Button></>}>
    <div data-fof={kind}>{kind === 'match' ? <p>{t('inout.mr_text')}</p> : <><p>{t('inout.bf_text')}</p><p><b>{t('inout.bf_late_h')}</b> {t('inout.bf_late')}</p><p><b>{t('inout.bf_scan_h')}</b> {t('inout.bf_scan')}</p></>}</div>
  </Dialog>;
}

// What she reads beside a row: Skipped, Choose, Chosen by you, Matched by name or Check (sortTag).
function Tag({ r }) {
  if (r.i === -2) return <span class="mute">{t('setup.bf_t_skip')}</span>;
  if (r.newKey) return null;
  if (r.i === -1) return <span class="bf-tag warn">{t('setup.bf_t_choose')}</span>;
  if (r.set) return <span class="mute">{t('setup.bf_t_set')}</span>;
  return r.sure ? <span class="bf-tag ok">{t('setup.bf_t_sure')}</span> : <span class="bf-tag warn">{t('setup.bf_t_check')}</span>;
}
// What she should know beside a file before adding it (rowNote).
function Note({ r }) {
  const b = state().batch, st = r.i >= 0 ? b.students[r.i] : null;
  if (!st) return r.newKey ? <div class="mute bf-note" data-raw>{t('setup.bf_new_tag', { name: r.newKey })}</div> : null;
  const name = nfc(r.e.file.name), out = [];
  if (st.files.some(f => !f.virtual && nfc(f.name) === name)) out.push(t('setup.bf_both'));
  if (st.grade.status === 'missing') out.push(t('setup.bf_now_missing'));
  if (st.grade.status === 'excused') out.push(t('setup.bf_now_excused'));
  return out.length ? <div class="mute bf-note">{out.join(' ')}</div> : null;
}

// Bring in files into the open download. list: [{ path, file }].
export async function bringFiles(list, show) {
  list = list.filter(e => e.file && !E.junk(e.path) && !E.houseFile(e.path));
  if (!list.length) return toast(t('setup.bf_nothing'));
  const { fresh, dups } = await freshRows(list.map(e => ({ e, ...sortGuess(e.path) })));
  if (!fresh.length) return toast(t('setup.bf_none'));
  show({ rows: fresh, dups });
}
export function BringFiles({ rows: rows0, dups, onClose }) {
  const [rows, setRows] = useState(rows0), [ask, setAsk] = useState(null), [busy, setBusy] = useState(false);
  const b = state().batch, order = anonOn() ? anonOrder() : b.students.map((_, k) => k);
  const set = (k, part) => setRows(rs => rs.map((r, j) => (j === k ? { ...r, ...part } : r)));
  const n = rows.filter(r => r.i >= 0 || r.newKey).length, allLate = rows.length > 0 && rows.every(r => r.late);
  const pick = (k, v) => {
    if (v === '-3') return setAsk({ k, name: guessNewName(rows[k].e.path) });   // someone who isn't in this download yet
    set(k, { i: +v, newKey: '', sure: true, set: true });
  };
  const go = async () => {
    if (!n) return toast(t('setup.bf_pick_one'));
    setBusy(true);
    const groups = new Map(), late = new Set(), keep = b.students[state().cur];
    let made = false;
    for (const r of rows) {
      let st = r.i >= 0 ? b.students[r.i] : null;
      if (r.newKey) { st = b.students.find(x => x.key === r.newKey); if (!st) { st = { key: r.newKey, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; b.students.push(st); made = true; } }
      if (!st) continue;
      if (!groups.has(st)) groups.set(st, []);
      groups.get(st).push(r.e);
      if (r.late) late.add(st);
    }
    onClose();
    let last = keep;
    const added = [];
    try {
      for (const [st, fl] of groups) { added.push(...await C.addFiles(st, fl)); last = st; }
      if (late.size) C.markLate([...late]);
      if (made) { E.rosterSort(); use({ cur: Math.max(0, b.students.indexOf(keep)) }); C.changed(); }
    } catch (e) { console.error(e); toast(t('mark.cannot')); }
    const files = t('setup.bf_nf', { n: added.length }), students = t('setup.bf_ns', { n: groups.size });
    toast(late.size ? t('setup.bf_done_late', { files, students, n: late.size }) : t('setup.bf_done', { files, students }), { ms: 7000 });
    const bad = added.filter(f => troubleOf(f)).length;
    if (bad) toast(t('setup.bf_bad', { n: bad }), { ms: 9000 });
    C.reopen(b.students.indexOf(groups.has(keep) ? keep : last));
  };
  const newOk = () => {
    const nk = String(ask.name || '').replace(/[\\/]+/g, ' ').trim();
    if (nk) set(ask.k, { i: -1, newKey: nk, sure: true, set: true });
    setAsk(null);
  };
  return <Dialog open title={t('setup.bf_title')} onClose={onClose}
    actions={<><Button onClick={onClose} data-bfcancel>{t('setup.bf_cancel')}</Button><Button variant="primary" disabled={busy} onClick={go} data-bfgo>{t('setup.bf_go', { n })}</Button></>}>
    <div class="mk-bf" data-bf>
      <p class="mute">{t('setup.bf_sub', { n: rows.length })}</p>
      <p class="mute">{t('setup.bf_about')}{dups ? ' ' + t('setup.bf_dups', { n: dups }) : ''}</p>
      <table class="bf-t"><thead><tr><th>{t('setup.bf_file')}</th><th>{t('setup.bf_to')}</th><th />
        <th><label class="bf-late"><input type="checkbox" checked={allLate} aria-label={t('setup.bf_late_all')} onChange={e => { const v = e.currentTarget.checked; setRows(rs => rs.map(r => ({ ...r, late: v }))); }} data-bflateall /> {t('setup.bf_late')}</label></th></tr></thead>
        <tbody>{rows.map((r, k) => <tr data-bfrow={k}>
          <td class="bf-path" data-raw>{r.e.path}</td>
          <td>{ask && ask.k === k
            ? <span class="bf-new"><TextInput label={t('setup.bf_new_name')} value={ask.name} onInput={v => setAsk(ask => ({ ...ask, name: v }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newOk(); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAsk(null); } }} data-raw data-bfnewname autofocus />
              <Button size="sm" onClick={newOk} data-bfnewok>{t('setup.bf_new_ok')}</Button></span>
            : <span class="selwrap"><select class="input" aria-label={t('setup.bf_to_for', { file: r.e.file.name })} value={r.newKey ? '-3' : String(r.i)} onChange={e => pick(k, e.currentTarget.value)} data-bfto={k}>
              <option value="-1">{t('setup.bf_choose')}</option>
              {order.map(i => <option value={String(i)}>{anonOn() ? '' : (i + 1) + '. '}{shownName(b.students[i], i)}</option>)}
              <option value="-3">{r.newKey || t('setup.bf_new')}</option><option value="-2">{t('setup.bf_skip')}</option></select></span>}</td>
          <td data-bftag={k}><Tag r={r} /><Note r={r} /></td>
          <td><input type="checkbox" checked={!!r.late} aria-label={t('setup.bf_late_one', { file: r.e.file.name })} onChange={e => set(k, { late: e.currentTarget.checked })} data-bflate={k} /></td>
        </tr>)}</tbody></table>
    </div>
  </Dialog>;
}

// The class the matched files belong to, given to the download when it opens (as the split gives it: change.js takeSplit).
export const classAfter = (id, cls) => C.afterSplit({ id, cls });
// The videos and partners picked for an assignment with no papers, made once its pages open (StartNotes, D-022).
export const partnersAfter = (id, pv) => C.afterSplit({ id, pv });

// Files to match to a roster: outside files with no download, matched to a class's names and opened as a new download.
// lib: the library; classId: the class to start with; onGo(entries, cls): opens them (each path "Name/file").
export function MatchRoster({ list, lib, classId, onGo, onClose }) {
  const first = lib.classes.find(k => String(k.id) === String(classId)) || lib.classes.find(k => k.names.length) || lib.classes[0] || null;
  const guess = c => list.map(e => ({ e, ...guessAmong(e.path, (c ? c.names : []).map(n => [nameWords(n)])) }));
  const [c, setC] = useState(first), [rows, setRows] = useState(() => guess(first));
  const names = c ? c.names : [];
  const n = rows.filter(r => r.i >= 0).length, who = new Set(rows.filter(r => r.i >= 0).map(r => r.i)).size;
  const missing = names.filter((_, k) => !rows.some(r => r.i === k));
  const go = () => {
    const used = new Set(), entries = [];
    for (const r of rows) if (r.i >= 0) {
      const base = names[r.i].replace(/[\\/:*?"<>|]+/g, ' ').trim() + '/' + r.e.path.split('/').pop();
      let p = base, k = 2; while (used.has(p.toLowerCase())) p = base.replace(/(\.[^./]+)?$/, ' (' + k++ + ')$1');
      used.add(p.toLowerCase()); entries.push({ path: p, file: r.e.file });
    }
    onClose(); onGo(entries, c);
  };
  return <Dialog open title={t('setup.mr_title')} onClose={onClose}
    actions={<><Button onClick={onClose} data-mrcancel>{t('setup.bf_cancel')}</Button><Button variant="primary" disabled={!n} onClick={go} data-mrgo>{t('setup.mr_go', { files: t('setup.bf_nf', { n }), students: t('setup.bf_ns', { n: who }) })}</Button></>}>
    <div class="mk-bf" data-mr>
      <p class="mute">{t('setup.mr_sub', { n: list.length })}</p>
      <div class="bf-cls"><label>{t('setup.mr_class')} <span class="selwrap"><select class="input" value={c ? String(c.id) : ''} onChange={e => { const k = lib.classes.find(x => String(x.id) === e.currentTarget.value) || null; setC(k); setRows(guess(k)); }} data-mrcls>
        {lib.classes.map(k => <option value={String(k.id)}>{t('setup.mr_class_opt', { name: k.name, n: k.names.length })}</option>)}</select></span></label>
        <span class="mute">{t('setup.mr_about')}</span></div>
      {names.length ? <table class="bf-t"><thead><tr><th>{t('setup.bf_file')}</th><th>{t('setup.mr_student')}</th><th /></tr></thead>
        <tbody>{rows.map((r, k) => <tr data-mrrow={k}><td class="bf-path" data-raw>{r.e.path}</td>
          <td><span class="selwrap"><select class="input" aria-label={t('setup.bf_to_for', { file: r.e.file.name })} value={String(r.i)} onChange={e => { const v = +e.currentTarget.value; setRows(rs => rs.map((x, j) => (j === k ? { ...x, i: v, sure: true, set: true } : x))); }} data-mrto={k}>
            <option value="-1">{t('setup.bf_choose')}</option>{names.map((nm, i) => <option value={String(i)}>{nm}</option>)}<option value="-2">{t('setup.bf_skip')}</option></select></span></td>
          <td><Tag r={r} /></td></tr>)}</tbody></table>
        : <p data-mrnone>{t('setup.mr_no_roster')}</p>}
      {missing.length > 0 && names.length > 0 && <p class="mute" data-raw data-mrmissing>{t('setup.mr_no_file', { names: missing.join(', ') })}</p>}
    </div>
  </Dialog>;
}
