// Help, Keyboard shortcuts: made from the one list every shortcut is registered in (services/shortcuts.js), so it can't fall behind.
import { h } from 'preact';
import { ShortcutList } from '../../ui/index.js';
import { t } from '../../i18n/t.js';

export default function Keys() {
  return <div class="page narrow">
    <header class="ph"><h1>{t('keys.title')}</h1><p>{t('keys.about')}</p></header>
    <ShortcutList />
  </div>;
}
