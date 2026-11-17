// The new Grading Studio. The theme is already on (next/index.html sets it before anything is drawn); this asks for the writing
// lock, draws the shell, and looks for updates. While the sample is open but not made yet, it has the current app make it first.
import { h, render } from 'preact';
import { start } from './shared/lock.js';
import { applyLook, savedLook } from './services/theme.js';
import { Shell } from './app/shell.jsx';
import { sampleReady, buildSample, restartApp, leaveSample } from './app/sample.js';
import { startUpdates } from './app/update.js';
import { startWhole } from './whole/index.js';
import { t, setMode } from './i18n/t.js';
import { setLanguage } from './app/language.js';

// ?keys=1 shows every line as its key, so a check can find words that did not come through t() (next/test/browser/shell.test.js).
if (/[?&]keys=1(&|$)/.test(location.search)) setMode('keys');
applyLook(savedLook());
setLanguage();
const root = document.getElementById('app');
if (sampleReady()) { startWhole(); render(h(Shell), root); start(); startUpdates(); }
else {
  render(h('main', { class: 'wrap', role: 'status' }, h('h1', null, t('sample.making')), h('p', null, t('sample.making_text'))), root);
  buildSample().then(restartApp, () => render(h('main', { class: 'wrap', role: 'alert' }, h('h1', null, t('sample.failed')), h('p', null, t('sample.failed_text')),
    h('button', { class: 'btn pri', type: 'button', onClick: leaveSample }, t('sample.leave'))), root));
}
