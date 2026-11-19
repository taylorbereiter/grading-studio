// Away from the slides, a running class timer is a small box in the corner of the app (src/planner/present.js prFloat): press the
// time to pause or go on (to clear it once time is up), × to stop. It goes when the timer stops, and hides while Present is open.
import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { t } from '../../i18n/t.js';
import { Icon } from '../../ui/index.js';
import * as PT from './ptimer.js';
import './present-lines.js';

function Float({ onGone }) {
  const [tm, setTm] = useState(() => PT.timer());
  useEffect(() => PT.subscribe(x => { setTm(x ? { ...x } : null); if (!x) onGone(); }), []);
  if (!tm || document.querySelector('.present')) return null;
  const txt = tm.done ? t('present.up') : PT.mmss(tm.left);
  return <div class={'prf' + (tm.done ? ' done' : tm.paused ? ' paused' : '')} role="timer">
    <button type="button" class="prf-t num" onClick={PT.press} data-prf="go" aria-label={tm.done ? t('present.up_clear') : t(tm.paused ? 'present.chip_go' : 'present.chip_pause', { time: PT.mmss(tm.left) })}>
      {txt}{tm.paused && !tm.done && <small>{t('present.paused')}</small>}</button>
    <button type="button" class="prf-x" onClick={PT.stop} data-prf="x" aria-label={t('present.stop_timer')} title={t('present.stop_timer')}><Icon name="x" size="xs" /></button>
  </div>;
}
let host = null;
export function showFloat() {
  if (host || !PT.timer()) return;
  host = document.createElement('div'); host.id = 'prFloat'; document.body.appendChild(host);
  const gone = () => { const x = host; host = null; if (x) { render(null, x); x.remove(); } };
  render(h(Float, { onGone: gone }), host);
}
