// Setup > Partners and videos… (src/video.js openPartners, pvList), loaded as a part of its own (router.js PARTS.partners): everyone
// in one list, each with the video they have, a link to paste or a video file to choose, and + Partners to pick who works with them.
// A group with no video shares the first one's paper and marks; One grade or Their own scores (the notes shared either way). Video
// files dropped on the list go to the student named in each file name. Save makes every group at once, one undo step
// (mark/change.js partnersApply). Choosing videos from Drive comes with the Drive part.
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Button, Dialog, Segmented, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import { shownName, anonOn, anonOrder, nameWords } from '../../engines/gdraw.js';
import * as V from '../../engines/gmedia.js';
import { groupMates } from '../../engines/ggroup.js';
import { guessAmong } from '../../engines/greport.js';
import { wordsJoin } from '../../engines/gfiles.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './setup-lines.js';

// what a student already has: their video link's title (and where it's from), or their video file's name (pvHas)
const hasOf = st => { const f = st.files.find(x => x.kind === 'link') || st.files.find(x => x.kind === 'media'); return f ? (f.kind === 'link' ? V.linkTitle(f) + (V.vidRef(f.data) ? '' : ' · ' + V.linkHost(V.linkOf(f.data))) : f.name) : ''; };

// The list's state, as the current app keeps it (pvList): vid k -> { url } or { file }, grp k -> a Set shared by a new group.
function listOf(rows) {
  const vid = new Map(), grp = new Map(), got = v => !!v && !!(v.url || v.file);
  const R = k => rows.find(r => r.k === k), mine = k => grp.get(k) || new Set([k]), old = k => new Set([k, ...((R(k) || {}).mates || [])]);
  const team = k => { const s = new Set(); for (const x of mine(k)) for (const y of old(x)) s.add(y); for (const x of [...s]) for (const y of mine(x)) s.add(y); return [...s].sort((a, b) => rows.findIndex(r => r.k === a) - rows.findIndex(r => r.k === b)); };
  const leadOf = k => { const tm = team(k); return tm.find(x => R(x) && R(x).has) || tm.find(x => got(vid.get(x))) || tm[0]; };
  const tog = (k, o) => {
    const g = mine(k);
    if (g.has(o)) { g.delete(o); grp.delete(o); if (g.size === 1) for (const x of g) grp.delete(x); }
    else { const og = grp.get(o); if (og) { og.delete(o); if (og.size === 1) for (const x of og) grp.delete(x); } g.add(o); for (const x of g) grp.set(x, g); const v = vid.get(o); if (v && !vid.get(k)) { vid.set(k, v); vid.delete(o); } }
  };
  const out = () => {
    const done = new Set(), list = [];
    for (const r of rows) {
      if (done.has(r.k)) continue;
      const tm = team(r.k); tm.forEach(x => done.add(x));
      const lead = leadOf(r.k), v = R(lead).has ? null : (tm.map(x => vid.get(x)).find(x => x && (x.file || V.linkClean(x.url || ''))) || null);
      const fresh = tm.filter(x => !old(lead).has(x));
      if (!v && !fresh.length) continue;
      list.push({ k: [lead, ...tm.filter(x => x !== lead)], url: v && !v.file ? V.linkClean(v.url) : '', file: (v && v.file) || null });
    }
    return list;
  };
  const bad = () => rows.some(r => { const v = vid.get(r.k); return v && v.url && v.url.trim() && !V.linkClean(v.url); });
  return { vid, R, old, team, leadOf, tog, out, bad, got };
}

export function Partners({ onClose }) {
  const b = state().batch;
  const rows = useRef(null);
  if (!rows.current) {
    const list = b.students.map((st, i) => ({ st, i })).filter(x => x.st.files.length || !x.st.gap);
    if (anonOn()) { const o = anonOrder(); list.sort((a, c) => o.indexOf(a.i) - o.indexOf(c.i)); }
    const rs = list.map(({ st, i }) => ({ k: st.key, label: shownName(st, i), has: hasOf(st), mates: groupMates(st).map(s => s.key) }));
    rows.current = { rs, L: listOf(rs) };
  }
  const { rs, L } = rows.current, label = k => (L.R(k) || {}).label || k;
  const [, again] = useState(0), [open, setOpen] = useState(null), [own, setOwn] = useState('0'), [busy, setBusy] = useState(false);
  const re = () => again(n => n + 1);
  const pickFile = k => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*,audio/*'; i.onchange = () => { const f = i.files[0]; if (!f) return; L.vid.set(k, { file: f }); re(); }; i.click(); };
  const drop = files => {
    const people = rs.map(r => [nameWords(r.label)]), miss = [];
    for (const f of files) { if (!V.MEDIA_RX.test(f.name)) { miss.push(f.name); continue; } const g = guessAmong(f.name, people); if (g.i === -1 || rs[g.i].has) { miss.push(f.name); continue; } L.vid.set(L.leadOf(rs[g.i].k), { file: f }); }
    re();
    if (miss.length) toast(t('setup.pv_miss', { n: miss.length, names: wordsJoin(miss.slice(0, 4)) + (miss.length > 4 ? '…' : '') }), { ms: 8000 });
  };
  const groups = L.out(), can = groups.length > 0 && !L.bad() && !busy;
  const save = async () => {
    setBusy(true);
    try { const n = await C.partnersApply(groups, own === '1'); onClose(); toast(t('setup.pv_saved', { n })); C.reopen(); }
    catch (e) { console.error(e); setBusy(false); toast(t('setup.v_fail', { why: (e && e.message) || String(e) })); }
  };
  return <Dialog open title={t('setup.pv_title')} onClose={onClose}
    actions={<><Button onClick={onClose} data-pvcancel>{t('setup.cancel')}</Button><Button variant="primary" disabled={!can} onClick={save} data-pvgo>{busy ? t('setup.pv_saving') : t('setup.pv_save')}</Button></>}>
    <div class="mk-pv" data-pv onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); drop([...e.dataTransfer.files]); }}>
      <p class="mute">{t('setup.pv_about')}</p>
      <div class="pv-own"><Segmented label={t('setup.pv_get')} value={own} onChange={setOwn} options={[{ value: '0', label: t('setup.pv_one') }, { value: '1', label: t('setup.pv_own') }]} /><span class="mute">{t('setup.pv_own_say')}</span></div>
      <div class="pv-list">{rs.map((r, i) => {
        const tm = L.team(r.k), lead = L.leadOf(r.k), v = L.vid.get(r.k) || {}, others = tm.filter(x => x !== r.k);
        let what;
        if (lead !== r.k && (L.R(lead).has || L.got(L.vid.get(lead)))) what = <span class="mute">{t('setup.pv_same')} <b data-raw>{label(lead)}</b></span>;
        else if (r.has) what = <span class="pv-has" data-raw title={r.has}>{r.has}</span>;
        else if (v.file) what = <span class="pv-file"><b data-raw>{v.file.name}</b> <span data-raw>{v.file.size ? V.fmtSize(v.file.size) : ''}</span><Button size="sm" variant="quiet" onClick={() => { L.vid.delete(r.k); re(); }} data-pvunfile={i}>{t('setup.pv_unfile')}</Button></span>;
        else what = <><input class={'input pv-link' + (v.url && !V.linkClean(v.url) ? ' bad' : '')} value={v.url || ''} placeholder={t('setup.pv_link_ph')} aria-label={t('setup.pv_link', { name: r.label })} autocomplete="off" spellcheck={false}
          onInput={e => { L.vid.set(r.k, { url: e.currentTarget.value }); re(); }} data-pvlink={i} />
          <Button size="sm" onClick={() => pickFile(r.k)} title={t('setup.pv_file_tip')} data-pvfile={i}>{t('setup.pv_file')}</Button></>;
        return <div class={'pv-row' + (open === r.k ? ' on' : '')} data-pvrow={r.k}>
          <span class="pv-name" data-raw>{r.label}</span><span class="pv-vid">{what}</span>
          <Button size="sm" icon={others.length ? undefined : 'plus'} aria-expanded={open === r.k ? 'true' : 'false'} onClick={() => setOpen(open === r.k ? null : r.k)} data-pvp={i}>{others.length ? <><span>{t('setup.pv_with')}</span> <span data-raw>{others.map(label).join(', ')}</span></> : t('setup.pv_partners')}</Button>
          {open === r.k && <div class="pv-pick" role="group" aria-label={t('setup.pv_pick', { name: r.label })}>{rs.filter(x => x.k !== r.k).map(x => { const lock = L.old(r.k).has(x.k), on = lock || tm.includes(x.k);
            return <button type="button" class="chip" aria-pressed={on ? 'true' : 'false'} disabled={lock} title={lock ? t('setup.pv_locked') : undefined} onClick={() => { L.tog(r.k, x.k); re(); }} data-pvto={x.k} data-raw>{x.label}</button>; })}
            <Button size="sm" variant="quiet" onClick={() => setOpen(null)} data-pvdone>{t('setup.pv_done')}</Button></div>}
        </div>; })}</div>
    </div>
  </Dialog>;
}
