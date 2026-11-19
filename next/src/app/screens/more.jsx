// On a phone: More (everything the bottom tabs leave out: the update control, Google sign-in and Sync now as Settings > Saving and
// sync has them, src/phone.js phMoreRender), and Classes (the class list).
import { h } from 'preact';
import { ListRow, ClassDot, Icon } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import { UpdateLine } from '../shell.jsx';
import { usePlan } from '../plan.js';
import { classTone } from '../colors.js';
import { assistant } from '../../services/assistant.js';
import { usePart } from '../parts.js';

const ROWS = [['calendar', 'cal', 'nav.calendar'], ['library', 'library', 'nav.library'], ['school', 'school', 'nav.school'], ['settings', 'settings', 'nav.settings'], ['help', 'help', 'nav.help']];
export function ClassList({ classes }) {
  const plan = usePlan();
  if (classes && !classes.length) return <p class="mute">{t('home.no_classes')}</p>;
  return <ul class="list">{(classes || []).map((c, i) => <li><ListRow lead={<ClassDot color={classTone(plan, c.name, c.loose ? -1 : i)} />} title={c.loose ? t('nav.no_class') : <span data-raw>{c.name}</span>}
    sub={c.left ? t('nav.left', { n: c.left }) : null} href={href('class', c.id || '-')} end={<Icon name="chr" />} /></li>)}</ul>;
}
export default function More({ route, classes }) {
  if (route.path === 'classes') return <div class="page narrow"><header class="ph"><h1>{t('nav.classes')}</h1></header><ClassList classes={classes} /></div>;
  const ai = assistant(), Sv = usePart('setsave');
  return <div class="page narrow">
    <header class="ph"><h1>{t('nav.more')}</h1></header>
    <section class="card pad"><h2 class="h3">{t('update.title')}</h2><UpdateLine big /></section>
    {Sv && <div data-moregoogle><Sv.GoogleCard /></div>}
    <ul class="list">
      {ROWS.map(([id, icon, line]) => <li><ListRow icon={icon} title={t(line)} href={href(id)} end={<Icon name="chr" />} /></li>)}
      {ai.link && <li><ListRow icon="assist" title={ai.name ? t('assistant.open_named', { name: ai.name }) : t('assistant.open_generic')} href={ai.link} end={<Icon name="arrow" />} /></li>}
    </ul>
  </div>;
}
