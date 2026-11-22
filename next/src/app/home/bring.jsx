// Bringing new student work in from Home (app/home/drop.jsx): what was dropped or picked is opened the way papers brought in on an
// assignment are (mark/open.js bringIn, kept in this browser through the write layer) and the first paper shown. A newer copy of a
// download already worked on asks first, as class-work.jsx does. Loaded only once something is dropped or picked (PARTS.homebring),
// with the marking screen's lines, so Home itself never fetches them.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Dialog, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import '../mark/lines.js';
import '../mark/setup-lines.js';
import '../mark/inout-lines.js';

// job: { got: { list, label }, cls, drive }. onEnd runs once it is opened, or could not be.
export function Bring({ job, onEnd }) {
  const [ask, setAsk] = useState(null);
  useEffect(() => {
    (async () => {
      const { got, cls, drive } = job;
      try {
        const O = await PARTS.bring();
        const carry = x => new Promise(done => setAsk({ e: x, done: v => { setAsk(null); done(v); } }));
        const r = await O.bringIn(got.list, { label: got.label, carry, drive });
        if (r && cls) (await PARTS.bringin()).classAfter(r.batch.id, cls.id);
        if (r && r.changed) toast(t('setup.c_changed_toast', { n: r.changed }), { ms: 7000 });
        if (r) go('mark', r.batch.id);
      } catch (er) { console.error(er); toast(er && er.name === 'NothingIn' ? t(er.take ? 'mark.not_papers' : 'setup.w_nothing') : er && er.name === 'CannotSave' ? t('mark.cannot') : t('setup.w_failed')); }
      finally { onEnd(); }
    })();
  }, []);
  return ask && <Dialog open title={t('setup.c_ask_t')} onClose={() => ask.done(false)}
    actions={<><Button onClick={() => ask.done(false)} data-fresh>{t('setup.c_fresh')}</Button><Button variant="primary" onClick={() => ask.done(true)} data-carry>{t('setup.c_bring')}</Button></>}>
    <p data-raw>{t('setup.c_ask', { name: ask.e.name || t('setup.c_noname') })}</p>
    <p>{ask.e.unchecked ? t('setup.c_ask_unchecked') : t('setup.c_ask_same', { named: ask.e.named, all: ask.e.nOld, n: ask.e.same })}</p>
    <p>{t('setup.c_ask_q')}</p></Dialog>;
}
