// Transcripts, from Setup when the download has recordings (src/app/readings.js openTranscripts): every recording's transcript made in
// this browser, one after another, by the same speech engine as one video's Make transcript (mark/media.jsx). Each is kept as soon as
// it is made, so Stop (or closing the tab) keeps the ones already done; the work goes on while the box is closed and she grades.
// Partners share one kept video, so it is made once and each of them gets it (mark/change.js trSet). A lazy part, loaded through
// More for this paper's part.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Checkbox, Dialog, Progress, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import * as V from '../../engines/gmedia.js';
import { videos } from '../../students/index.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import './read-lines.js';

// The run while it goes: { stop, pct, msg }. Kept here, so the box shows it again when she opens it during a run.
let run = null, lastMsg = '';
const subs = new Set();
const tell = () => subs.forEach(f => f());
// the tests stand in for the speech engine here (as mark/media.jsx does), so it is never downloaded
if (typeof window !== 'undefined') window.__media = { ...(window.__media || {}), asrStandIn: V.asrStandIn };

// Every recording in the download, a partners' video once
function recordings() {
  const seen = new Set();
  return state().batch.students.flatMap((st, i) => st.files.filter(V.trMakeable).map(f => ({ st, i, f })))
    .filter(x => { if (x.f.kind !== 'link') return true; const k = V.linkKey(x.f); if (seen.has(k)) return false; seen.add(k); return true; });
}
// The recording itself: a file on the paper, or a video kept in this browser (a Drive video not downloaded is left for its own card)
async function bytesOf(f) {
  if (f.kind !== 'link') return f.data;
  const id = V.keptId(f); if (!id) throw new Error('not a video file');
  const r = await videos.get(id).catch(() => null);
  if (!r || !r.blob) throw new Error('not in this browser');
  return new Uint8Array(await r.blob.arrayBuffer());
}
async function makeAll(todo) {
  run = { stop: false, pct: 0, msg: '', now: null }; tell();
  let lock = null; try { lock = await navigator.wakeLock.request('screen'); } catch { lock = null; }
  const say = m => { run.msg = m; tell(); };
  let done = 0, failed = 0;
  for (let k = 0; k < todo.length && !run.stop; k++) {
    const { i, f } = todo[k];
    run.pct = k / todo.length; tell();
    const me = run.now = { on: false };
    try {
      if (await C.trMake(f, await bytesOf(f), m => say(t('rd.tr_at', { n: i + 1, k: k + 1, of: todo.length, file: f.name, what: m })), me)) done++;
    } catch (e) { if (!me.on) { failed++; console.error(e); } }
  }
  try { if (lock) lock.release(); } catch { /* gone already */ }
  const stopped = run.stop;
  run = null;
  lastMsg = (stopped ? t('rd.tr_stopped', { n: done }) : t('rd.tr_done', { n: done })) + (failed ? ' ' + t('rd.tr_failed', { n: failed }) : '');
  toast(lastMsg); tell();
}
function stopNow() { if (!run) return; run.stop = true; if (run.now) run.now.on = true; V.asrStop(); tell(); }

export function Transcripts({ onClose }) {
  const [, tick] = useState(0), [redo, setRedo] = useState(false);
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  const all = recordings(), have = all.filter(x => x.f.tr).length;
  const go = () => {
    if (run) return stopNow();
    const todo = all.filter(x => redo || !x.f.tr);
    if (!todo.length) return toast(t('rd.tr_all_have'));
    lastMsg = '';
    makeAll(todo).catch(e => console.error(e));
  };
  return <Dialog open title={t('rd.tr_title')} onClose={onClose}
    actions={<><Button onClick={onClose} data-trclose>{t('rd.tr_close')}</Button><Button variant="primary" onClick={go} data-trall>{run ? (run.stop ? t('rd.tr_stopping') : t('rd.tr_stop')) : t('rd.tr_make')}</Button></>}>
    <div class="mk-trall" data-trbox>
      <p><b>{t('rd.tr_count', { n: all.length })}</b>{have ? ' ' + t('rd.tr_have', { n: have }) : ''}</p>
      {have > 0 && !run && <Checkbox label={t('rd.tr_redo')} checked={redo} onChange={setRedo} />}
      <p class="mute">{t('rd.tr_about')}</p>
      {run && <Progress value={run.pct} label={t('rd.tr_title')} />}
      <p role="status" data-trallmsg>{run ? run.msg : lastMsg}</p>
    </div>
  </Dialog>;
}
