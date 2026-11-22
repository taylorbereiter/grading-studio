// The sample strip: what it is, and what to try (src/welcome.js SAMPLE_TRY, sampleGo): a marked paper, the quiz, the gradebook, charts, missing work,
// the seating chart and this week's lessons, each opening its page. Loaded only while the sample is open.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import { sampleForShell } from '../../crossings.js';
import { leaveSample } from '../sample.js';
import './lines.js';

const SAY = { paper: 'help.smp_try_paper', quiz: 'help.smp_try_quiz', book: 'help.smp_try_book', charts: 'help.smp_try_charts', missing: 'help.smp_try_missing', seats: 'help.smp_try_seats', plan: 'help.smp_try_plan' };
export function SampleStrip() {
  const [tr, setTr] = useState(null);
  useEffect(() => { sampleForShell().then(setTr, e => console.error(e)); }, []);
  const c = tr && tr.classId, go = [tr && tr.paper && ['paper', href('mark', tr.paper)], tr && tr.quiz && ['quiz', href('mark', tr.quiz)],
    c && ['book', href('class', c, 'grades')], c && ['charts', href('class', c, 'grades', 'charts')], c && ['missing', href('class', c, 'todo', 'missing')],
    c && ['seats', href('class', c, 'people', 'seating')], ['plan', href('week')]].filter(Boolean);
  return <div class="strip sample" role="note"><span><b>{t('sample.title')}</b> {t('sample.text')}
    <span class="sampletry" data-sampletry-row> {t('help.smp_try')} {go.map(([k, to], i) => <Fragment key={k}>{i ? ' · ' : ''}<a href={to} data-sampletry={k}>{t(SAY[k])}</a></Fragment>)}</span></span>
    <button type="button" class="btn sm" onClick={leaveSample}>{t('sample.leave')}</button></div>;
}
