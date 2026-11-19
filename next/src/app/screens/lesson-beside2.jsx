// The Beside drawer's second part (router.js PARTS beside2), loaded when one of its tabs opens, so the drawer stays inside the route
// budget. Activities: the activity bank (src/planner/panel.js activities tab), with Add after the slide I'm on for the open lesson.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import '../plan/les-lines.js';
import { ActList, UseActivity } from '../plan/acts.jsx';
import { actSlide } from '../../engines/activities.js';

export function Acts({ p, l, onSlide }) {
  const [use, setUse] = useState(null);
  return <div class="acts">
    <ActList p={p} onUse={setUse} row={a => l && onSlide ? { extra: <Button size="sm" variant="primary" icon="plus" onClick={() => onSlide(actSlide(a))} data-act-after>{t('les.act_after')}</Button> } : {}} />
    {use && <UseActivity p={p} a={use} onClose={() => setUse(null)} />}
  </div>;
}
