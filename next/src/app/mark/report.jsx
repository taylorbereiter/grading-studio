// What opened (src/intake.js openingReport and openRep): after papers open, a line says what opened, what didn't, who has nothing
// and anything odd, once for each new thing (what she has seen is kept as hashes under gs.openSeen, so no file names stay behind);
// See the list opens the whole report, each name a way to that student. The facts and their words are the current app's
// (engines/greport.js); loaded as a part of its own (router.js PARTS.report), with the engine, so it isn't part of the marking screen's own load.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, IconButton, Dialog } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { state } from '../../engines/gcore.js';
import * as R from '../../engines/greport.js';
import { prefs } from '../../students/prefs.js';
import { libs } from './paper.js';
import './lines.js';
import './setup-lines.js';
import './inout-lines.js';

// null when the papers have changed meanwhile (another download brought in)
async function facts() { const b = state().batch; if (!b) return null; await libs(); await R.checkStack(b); return state().batch === b ? R.openingFacts() : null; }
const keysOf = x => x.keys.concat(x.zip ? ['zip'] : []).map(R.hash);
function sawAll(id, keys) { const all = prefs.get('gs.openSeen', {}) || {}; all[id] = [...new Set((all[id] || []).concat(keys))]; prefs.set('gs.openSeen', all); }

// The line under the top bar after papers open; nothing when there's nothing new.
export function OpenedBar({ onList }) {
  const [x, setX] = useState(null);
  useEffect(() => { const b = state().batch; let live = true;
    facts().then(f => { if (!f || !live || state().batch !== b) return; const seen = (prefs.get('gs.openSeen', {}) || {})[b.id] || []; if (keysOf(f).some(k => !seen.includes(k))) setX(f); }, e => console.error(e));
    return () => { live = false; }; }, []);
  if (!x) return null;
  const saw = () => { sawAll(state().batch.id, keysOf(x)); setX(null); };
  return <div class="mk-opened" role="status"><span class="grow">{R.repHead(x)}</span>
    <Button size="sm" onClick={() => { saw(); onList(); }} data-rep>{t('setup.op_list')}</Button>
    <IconButton icon="x" label={t('setup.op_close')} onClick={saw} data-repx /></div>;
}

// The whole report.
export function OpenedList({ onClose, onGo }) {
  const [x, setX] = useState(null);
  useEffect(() => { let live = true; facts().then(f => { if (live && f) { setX(f); sawAll(state().batch.id, keysOf(f)); } }, e => console.error(e)); return () => { live = false; }; }, []);
  const go = o => <button type="button" class="link" data-repgo={o.i} onClick={() => { onClose(); onGo(o.i); }} data-raw>{o.name}</button>;
  const good = x && !x.cant.length && !x.zip && !x.nothing.length && !x.odd.length;
  const whys = x ? [...new Set(x.cant.map(o => o.why))] : [];
  return <Dialog open title={t('mark.op_title')} onClose={onClose} actions={<Button variant="primary" onClick={onClose}>{t('setup.ok')}</Button>}>
    {!x ? <p class="mute" aria-busy="true">{t('setup.op_checking')}</p> : <div class="mk-oplist" id="openRepBox">
      <p class={'xchk' + (good ? ' ok' : '')}>{good ? (x.total ? t('setup.op_all', { files: t('setup.op_files', { n: x.total }), students: t('setup.op_students', { n: x.nStu }) }) : t('setup.op_none')) : R.repHead(x) + ' ' + t('setup.op_click')}</p>
      {(x.cant.length > 0 || x.zip) && <details open data-group="cant"><summary>{t('setup.op_cant', { n: x.cant.length + (x.zip ? x.zip.n : 0) })}</summary>
        {x.zip && <p>{R.zipSay(x.zip)}</p>}
        {whys.map(w => { const of = x.cant.filter(o => o.why === w); return <><p>{w} {of[0].next}</p><ul>{of.map(o => <li>{go(o)} {o.shown && <span class="mute" data-raw>{o.shown}</span>}</li>)}</ul></>; })}</details>}
      {x.nothing.length > 0 && <details open data-group="nothing"><summary>{t('setup.op_nothing', { n: x.nothing.length })}</summary><ul>{x.nothing.map(o => <li>{go(o)}</li>)}</ul><p class="mute" data-oplater>{t('inout.op_later', { bring: t('mark.bf_menu').replace(/…$/, ''), setup: t('mark.setup'), add: '+ ' + t('setup.f_add_menu') })}</p></details>}
      {x.odd.length > 0 && <details open data-group="odd"><summary>{t('setup.op_odd', { n: x.odd.length })}</summary><ul>{x.odd.map(o => <li>{go(o)} {o.note}</li>)}</ul></details>}
    </div>}
  </Dialog>;
}
