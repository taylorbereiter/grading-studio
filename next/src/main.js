// The new Grading Studio: a placeholder until the screens are built (stage 2 on). It only asks for the lock and says what it got,
// so a window of the new version can be tried beside the current one. It writes nothing.
import { h, render } from 'preact';
import { start, onLockChange, lockState } from './shared/lock.js';
import { t } from './i18n/t.js';
import { applyLook, savedLook } from './services/theme.js';

const SAY = { writer: 'lock.writer', 'writer-no-locks': 'lock.writer', 'read-only': 'lock.read_only', taken: 'lock.taken', asking: 'lock.asking' };
function Page({ state }) {
  return h('main', { class: 'wrap' },
    h('h1', null, t('app.building_title')),
    h('p', null, t('app.building_text')),
    h('p', { class: 'state', 'data-lock': state, role: 'status' }, SAY[state] ? t(SAY[state]) : ''));
}
applyLook(savedLook());
const draw = () => render(h(Page, { state: lockState().state }), document.getElementById('app'));
onLockChange(draw); draw(); start();
