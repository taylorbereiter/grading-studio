// The new Grading Studio. The theme is already on (next/index.html sets it before anything is drawn); this asks for the writing
// lock, draws the shell, and looks for updates. While the sample is open but not made yet, it makes it first (whole/sample-build.js).
import { h, render } from 'preact';
import { start } from './shared/lock.js';
import { applyLook, savedLook } from './services/theme.js';
import { applySize } from './services/size.js';
import { Shell } from './app/shell.jsx';
import { PARTS } from './app/router.js';
import { sampleReady, buildSample, restartApp, leaveSample } from './app/sample.js';
import { startUpdates } from './app/update.js';
import { startWhole } from './whole/index.js';
import { t, setMode } from './i18n/t.js';
import { loadLanguage } from './app/language.js';

// ?keys=1 shows every line as its key, so a check can find words that did not come through t() (next/test/browser/shell.test.js).
if (/[?&]keys=1(&|$)/.test(location.search)) setMode('keys');
applyLook(savedLook()); applySize();
// A browser nobody has used yet (no library at all, as the current app's src/app/library.js fresh) is asked three questions (app/screens/welcome.jsx).
const fresh = (() => { try { return localStorage.getItem('gs.lib') == null && !localStorage.getItem('gs.gEmail'); } catch { return false; } })();
loadLanguage().then(() => {
  const root = document.getElementById('app');
  if (fresh && sampleReady() && !(window.__gsSample && window.__gsSample.on) && /^#?\/?(home)?$/.test(location.hash)) PARTS.welcome().then(m => m.welcome(), e => console.error(e));
  // A linked Planner folder is read when the app opens and whenever she comes back to the window (app/plan/pfolder.jsx).
  if (sampleReady()) { startWhole(); render(h(Shell), root); start().then(() => import('./app/plan/pfolder.jsx')).then(m => m.watchPlannerFolder(), e => console.error(e)); startUpdates();
    // A class timer still running from Present (here or in the current Planner) comes back in the corner after a refresh.
    try { if (localStorage.getItem('gsp.presentTimer')) PARTS.ptimer().then(m => m.showFloat(), e => console.error(e)); } catch {}
  }
  else {
    render(h('main', { class: 'wrap', role: 'status' }, h('h1', null, t('sample.making')), h('p', null, t('sample.making_text'))), root);
    buildSample(() => import('./whole/sample-build.js')).then(restartApp, () => render(h('main', { class: 'wrap', role: 'alert' }, h('h1', null, t('sample.failed')), h('p', null, t('sample.failed_text')),
      h('button', { class: 'btn pri', type: 'button', onClick: leaveSample }, t('sample.leave'))), root));
  }
});
