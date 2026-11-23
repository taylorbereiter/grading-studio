// One screen for every destination not built yet: where it is, and that it comes in a later stage. Its words are kept apart from
// the app's own lines (next/lang/building.en.json), since this screen goes away as the screens arrive.
import { h } from 'preact';
import { EmptyState, Button } from '../../ui/index.js';
import { t, addLines } from '../../i18n/t.js';
import LINES from '../../../lang/building.en.json';
import { go } from '../router.js';
import { newHash, goNew } from '../old-routes.js';
import { useEffect } from 'preact/hooks';

addLines(LINES, 'building');
const NAMES = { calendar: 'building.calendar', week: 'building.calendar', todo: 'building.todo', class: 'building.class', lesson: 'building.lesson', mark: 'building.mark', library: 'building.library', school: 'building.school', help: 'building.help' };
export default function Later({ route, classes, embedded }) {
  // An address the router doesn't know may be the previous version's: it goes to the matching new screen (old-routes.js).
  const old = !embedded && !route.known && newHash(location.hash);
  useEffect(() => { if (old) goNew(); }, [old]);
  if (embedded) return <EmptyState icon="spark" title={t('building.title')} text={t('building.text')} />;
  if (old && old !== location.hash) return <div class="loading" aria-busy="true" />;
  const first = route.path.split('/')[0];
  const c = first === 'class' && (classes || []).find(x => (x.id || '-') === route.params.id);
  const title = c ? (c.loose ? t('nav.no_class') : c.name) : route.known && NAMES[first] ? t(NAMES[first]) : t('building.unknown');
  return <div class="page">
    <header class="ph"><h1>{title}</h1></header>
    <EmptyState icon={route.known ? 'spark' : 'warn'} title={route.known ? t('building.title') : t('building.unknown_title')} text={route.known ? t('building.text') : t('building.unknown_text')}
      action={<Button onClick={() => go('home')}>{t('building.home')}</Button>} />
  </div>;
}
