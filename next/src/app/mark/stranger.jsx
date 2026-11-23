// Student details for a folder that isn't on the roster (src/people.js renderStranger, linkFolder): the folder's name, the roster
// student it looks like, This is (the names not yet matched first, then the ones already matched) and Link. Linking saves the
// folder's name as another spelling of that student (one undo step in the library, as Also called on the class page is), and the
// open download sorts by the roster again with the same student on screen. Loaded from More for this paper (router.js PARTS.stranger); the paper opens again as bringin.jsx does after sorting.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Sheet, toast } from '../../ui/index.js';
import { state, use } from '../../engines/gcore.js';
import { batchClass, rosterMatch } from '../../engines/gdraw.js';
import { rosterSort } from '../../engines/gopen.js';
import { nameFit, nameNear } from '../../engines/ginsight.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { library } from '../../students/index.js';
import * as C from './change.js';
import { t } from '../../i18n/t.js';
import './lines.js';
import './top-lines.js';
import '../class/lines.js';

export function StrangerSheet({ st, onClose }) {
  const c = batchClass(), folder = st.key, matched = c && c.names.length ? rosterMatch(c.names) : new Map();
  const free = c ? c.names.filter(n => !matched.has(n)) : [], fit = n => nameFit(n, folder) * 2 + nameNear(n, folder);
  const near = [...free].sort((a, b) => fit(b) - fit(a)), guess = near.find(n => nameFit(n, folder) || nameNear(n, folder)), rest = c ? c.names.filter(n => !free.includes(n)) : [];
  const [to, setTo] = useState(guess || near[0] || rest[0] || ''), [busy, setBusy] = useState(false);
  const link = async () => {
    const n = to; if (!n || !c) return;
    setBusy(true);
    try {
      await change(t('class.sp_u_add', { name: n }), l => { const k = classIn(l, c.id); if (k && k.names.includes(n)) B.setInfo(k, n, { other: [...new Set([...((B.infoOf(k, n) || {}).other || []), folder])] }); }, true);
      // the marking's own copy of the class takes the new spelling, and the download sorts by the roster again
      const l = library.json(null), lc = l && (l.classes || []).find(k => String(k.id) === String(c.id));
      if (lc) { if (lc.info) c.info = lc.info; else delete c.info; }
      const s = state(), keep = s.batch.students[s.cur];
      rosterSort(); const i = Math.max(0, state().batch.students.indexOf(keep)); use({ cur: i });
      C.changed(); C.reopen(i);
      toast(t('top.st_linked', { folder, name: n }));
      onClose();
    } catch (e) { console.error(e); toast(t('mark.not_saved')); setBusy(false); }
  };
  return <Sheet open title={folder} onClose={onClose}><div class="cp-sp" data-pmstranger>
    <p class="mute">{c ? t('top.st_not_on', { cls: c.name }) : t('top.st_no_roster')}</p>
    {c && c.names.length ? <>
      {guess && <p data-stguess><span data-raw>{t('top.st_looks', { name: guess })}</span></p>}
      <p class="row gap"><label class="row gap"><span>{t('top.st_is')}</span>
        <select class="input" value={to} onChange={e => setTo(e.currentTarget.value)} data-raw data-stpick>
          {near.map(n => <option value={n}>{n}</option>)}
          {rest.length > 0 && <optgroup label={t('top.st_matched')}>{rest.map(n => <option value={n}>{n}</option>)}</optgroup>}
        </select></label>
        <Button variant="primary" size="sm" disabled={busy || !to} onClick={link} data-stlink>{t('top.st_link')}</Button></p>
      <p class="mute small" data-raw>{t('top.st_saves', { folder })}</p></>
      : <p class="mute">{c ? t('top.st_add', { cls: c.name }) : t('top.st_none')}</p>}
  </div></Sheet>;
}
