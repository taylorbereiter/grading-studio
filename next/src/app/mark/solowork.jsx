// Only this student's Other work (src/solo.js soloBar, soloRows; src/people.js classWork, workRows, workHead): every download of this
// class, oldest first, with this student's own score and nobody else's, read from saved work only. One that has their paper opens
// with a click, still only them (gs.solo moves to it). Not while names are hidden, and only for a name on the class roster. A lazy
// part, loaded by the bar (router.js PARTS.solowork).
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button } from '../../ui/index.js';
import { state, fmtNum, fmtPct } from '../../engines/gcore.js';
import { anonOn, batchClass } from '../../engines/gdraw.js';
import { findItem } from '../../engines/gopen.js';
import { earlierWork, hasWork, pastClass, rosterPairs, pastScore, workTime } from '../../engines/ginsight.js';
import { prefs } from '../../students/prefs.js';
import { go } from '../router.js';
import { t } from '../../i18n/t.js';
import './lines.js';
import './paper-lines.js';
import '../class/lines.js';

const ST = { missing: 'paper.pw_st_missing', excused: 'paper.pw_st_excused', late: 'paper.pw_st_late' };
// the roster name of the student on screen, in the download's class
function who(st) {
  const s = state(), b = s.batch, c = b ? batchClass() : null;
  if (!c || !c.names.length || anonOn()) return null;
  const pairs = rosterPairs(c.names, b.students.map(x => x.key)), n = c.names.find(x => pairs.get(x) === st.key);
  return n ? { c, n } : null;
}
// classWork: one row for each assignment of the class, the open one with what is on screen now
async function rowsOf(c, name) {
  const s = state(), b = s.batch, all = await earlierWork('', d => hasWork(d) || !!(d && d.read)), seen = new Set(), rows = [];
  for (const [id, d] of all) {
    const m = s.keptMeta.get(id) || {};
    if (m.newer && s.keptMeta.has(m.newer)) continue;
    if (pastClass(d, m) !== c.id) continue;
    const f = m.asg && findItem(m.asg), label = (f && f.it.name) || m.name || (b && b.id === id ? b.name : t('mark.sw_dl')), one = m.asg || label;
    if (seen.has(one)) continue; seen.add(one);
    const k = rosterPairs(c.names, Object.keys({ ...d.s, ...d.read })).get(name);
    const g = k ? { ...((d.s[k] || {}).g || {}), ...(d.read && d.read[k] ? { read: d.read[k] } : {}) } : null;
    rows.push({ name: label, t: workTime(d) || d.t || 0, p: g ? pastScore(d.setup, g) : null, id, k: k && d.s[k] ? k : null });
  }
  const st = b && b.students[s.cur], here = rows.find(r => r.id === b.id);
  if (st) {
    const g = st.grade || {}, any = g.status || (g.points != null && g.points !== '') || (g.rubric || []).some(v => v != null);
    const live = { name: b.name || '', t: here ? here.t : Infinity, p: any ? pastScore(s.setup, g) : null, id: b.id, k: st.key };
    if (here) Object.assign(here, live); else rows.push(live);
  }
  return rows.sort((a, b2) => a.t - b2.t);
}
const right = p => !p ? <span class="stag">{t('mark.sw_nothing')}</span>
  : p.status ? <span class="stag">{t(ST[p.status] || 'paper.pw_st_late')}</span>
  : p.total != null ? <span><b>{fmtNum(p.total)} / {fmtNum(p.max)}</b>{p.pct != null ? ' · ' + fmtPct(p.pct) : ''}{p.partial && <span class="stag"> {t('paper.pw_partial')}</span>}</span>
  : p.pct != null ? <b>{fmtPct(p.pct)}</b> : <span class="mute">{t('mark.sw_unscored')}</span>;

export function OtherWork({ st }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState(null), [bad, setBad] = useState(false), me = st && who(st);
  useEffect(() => { if (!open || !me) return; let live = true; setRows(null); setBad(false);
    rowsOf(me.c, me.n).then(r => { if (live) setRows(r); }, e => { console.error(e); if (live) setBad(true); });
    return () => { live = false; }; }, [open, st && st.key]);
  if (!me) return null;
  const b = state().batch, done = (rows || []).filter(r => r.p).length, pc = (rows || []).map(r => r.p).filter(p => p && p.pct != null && !p.partial && !p.status).map(p => p.pct);
  const head = [t('paper.pw_in', { cls: me.c.name })].concat(rows && rows.length ? [t('mark.sw_in', { done, n: rows.length })] : [], pc.length ? [t('mark.sw_avg', { pct: fmtPct(pc.reduce((a, x) => a + x, 0) / pc.length) })] : []).join(' · ');
  const open1 = r => { setOpen(false); if (r.id === b.id) return; prefs.set('gs.solo', { id: r.id, key: r.k }); go('mark', r.id); };
  return <span class="mk-solow">
    <Button size="sm" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(o => !o)} data-solother>{t('mark.sw_btn')}</Button>
    {open && <div class="mk-swbox" role="region" aria-label={t('mark.sw_btn')} data-solowork>
      <h3 data-raw>{head}</h3>
      {bad ? <p class="mute">{t('class.read_failed')}</p> : !rows ? <p class="mute">{t('mark.sw_looking')}</p> : !rows.length ? <p class="mute">{t('mark.sw_none')}</p>
        : rows.map(r => { const body = <><span class="nm" data-raw>{r.name}</span>{right(r.p)}</>;
          return r.id && r.k ? <button type="button" class={'mk-swrow' + (r.id === b.id ? ' on' : '')} aria-current={r.id === b.id ? 'true' : undefined} onClick={() => open1(r)} data-solog={r.id}>{body}</button> : <div class="mk-swrow">{body}</div>; })}
    </div>}
  </span>;
}
