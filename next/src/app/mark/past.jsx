// Past work beside this one (src/insight.js histPanel), under the score on the marking screen: the student's scores and comments
// from other downloads, matched through the class roster (lifted histLoad, histFind, pastScore). A name that might be them stays
// hidden until she says Same student or Not them (gs.histSame, saved through students/write.js), and either can be taken back.
// Hidden while names are hidden. Loaded with the file tools (mark/fileui.jsx).
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button } from '../../ui/index.js';
import { state, fmtNum, fmtPct } from '../../engines/gcore.js';
import { anonOn, batchClass } from '../../engines/gdraw.js';
import { histLoad, histFind, pastScore } from '../../engines/ginsight.js';
import { prefs } from '../../students/prefs.js';
import { saveSetting } from '../../students/write.js';
import { t, date } from '../../i18n/t.js';
import './paper-lines.js';

const ST = { missing: () => t('paper.pw_st_missing'), excused: () => t('paper.pw_st_excused'), late: () => t('paper.pw_st_late') };
const clsName = id => { const c = (state().lib.classes || []).find(k => k.id === id); return c ? c.name : ''; };

function Row({ d, k, you, say }) {
  const g = d.s[k], p = pastScore(d.setup, g), here = batchClass(), other = here && d.cls !== here.id && clsName(d.cls);
  return <div class="pw-row" data-pwrow={d.id}>
    <div class="pw-hd"><b data-raw title={d.name}>{d.name}</b><span class="mute">{d.t ? date(new Date(d.t), { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span></div>
    <div data-pwscore>{p.total != null ? <><b>{fmtNum(p.total)}</b> / {p.max}{p.pct != null ? ' · ' + fmtPct(p.pct) : ''}</> : p.pct != null ? <b>{fmtPct(p.pct)}</b> : p.status ? null : <span class="mute">{t('paper.pw_noscore')}</span>}
      {p.paper && <span class="stag">{t('paper.pw_on_paper')}</span>}{p.partial && <span class="stag">{t('paper.pw_partial')}</span>}{p.status && ST[p.status] && <span class="stag">{ST[p.status]()}</span>}</div>
    {p.rows.length > 0 && <div class="mute pw-sm" data-raw>{p.rows.map(([c, v]) => c + ' ' + fmtNum(v)).join(' · ')}</div>}
    {!!(g.comment || '').trim() && <div class="pw-cm" data-raw>{g.comment.trim()}</div>}
    {other && <div class="mute pw-sm" data-raw>{t('paper.pw_in', { cls: other })}</div>}
    {you && <div class="mute pw-sm"><span data-raw>{t('paper.pw_you', { name: k })}</span> <Button size="sm" variant="quiet" onClick={() => say(you, null)} data-pwback>{t('paper.pw_undo')}</Button></div>}
  </div>;
}

export function PastWork({ st }) {
  const [, again] = useState(0), [open, setOpen] = useState(() => !!prefs.get('gs.histOpen', false));
  const b = state().batch, all = b && !anonOn() ? histLoad() : null;
  // the earlier work is read once per download, in the background
  useEffect(() => { if (!all || all.list) return; let n = 0; const id = setInterval(() => { if (all.list || ++n > 60) { clearInterval(id); again(x => x + 1); } }, 250); return () => clearInterval(id); }, [all, all && all.list]);
  if (!all || !all.list || !all.list.length) return null;
  const say = (hk, v) => { const said = { ...prefs.get('gs.histSame', {}) }; if (v == null) delete said[hk]; else said[hk] = v; saveSetting('gs.histSame', said); again(x => x + 1); };
  const r = histFind(st, all.list), c = r.me.c, nAsk = r.ask.size, last = r.sure[0] && pastScore(r.sure[0].d.setup, r.sure[0].d.s[r.sure[0].k]);
  const note = r.me.onRoster ? '' : c ? t('paper.pw_note_name', { cls: c.name }) : t('paper.pw_note_noroster');
  if (!r.sure.length && !nAsk && !r.no.size && !note) return null;
  const head = r.sure.length ? (last && last.pct != null ? t('paper.pw_n_last', { n: r.sure.length, pct: fmtPct(last.pct) }) : t('paper.pw_n', { n: r.sure.length })) : t('paper.pw_none');
  return <details class="mk-pw" open={open} onToggle={e => { const o = e.currentTarget.open; if (o !== open) { setOpen(o); prefs.set('gs.histOpen', o); } }} data-pw>
    <summary data-pwsum>{t('paper.pw_title')} <span class="mute">{head}</span>{nAsk > 0 && <span class="stag">{t('paper.pw_check', { n: nAsk })}</span>}</summary>
    {note && <p class="mute pw-sm" data-raw>{note}</p>}
    {r.sure.map(x => <Row {...x} say={say} />)}
    {[...r.ask.values()].map(a => { const other = clsName(a.d.cls);
      return <div class="pw-ask" data-pwask={a.x}><div><b data-raw>{t('paper.pw_quoted', { name: a.x })}</b> <span data-raw>{t('paper.pw_where', { where: a.n > 1 ? t('paper.pw_where_n', { n: a.n }) : a.d.name })}</span> {a.same ? t('paper.pw_why_close') : other ? <span data-raw>{t('paper.pw_why_other', { cls: other })}</span> : t('paper.pw_why_none')} {t('paper.pw_hidden')}</div>
        <span class="pw-btns"><Button size="sm" onClick={() => say(a.hk, 1)} data-pwsame>{t('paper.pw_same')}</Button><Button size="sm" onClick={() => say(a.hk, 0)} data-pwnot>{t('paper.pw_not')}</Button></span></div>; })}
    {[...r.no.values()].map(a => <div class="mute pw-sm"><span data-raw>{t('paper.pw_no', { name: a.x })}</span> <Button size="sm" variant="quiet" onClick={() => say(a.hk, null)} data-pwagain>{t('paper.pw_again')}</Button></div>)}
  </details>;
}
