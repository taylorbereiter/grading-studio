// The Planner folder (src/planner/lessons.js folderLink, folderReconnect, folderRead; design: Settings > Working with AI, "Planner
// folder"): a folder of its own on this computer where the teacher's assistant reads and changes her lessons, units, activities,
// rubrics and timetable. Linked, given permission again and looked in from its card; read by itself when the app opens and when
// she comes back to the window (not while she is typing). What the assistant added or changed comes in through
// planning/folder-read.js and shows as arrived and not reviewed (Arrived below) until she marks it Ready.
// Loaded through router.js PARTS.pfolder, so Settings and the lesson page carry none of it until it is wanted.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Button, Icon, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { assistant } from '../../services/assistant.js';
import { plannerFolder } from '../../planning/folder.js';
import { holdsGrading, linkPlannerFolder, writePlannerFolderAll } from '../../planning/folder-more.js';
import { readPlannerFolder } from '../../planning/folder-read.js';
import { saveVersion } from '../../planning/write.js';
import { loadPlan } from '../../planning/plan.js';
import { engine } from '../../planning/engine.js';
import { saveFailed } from './save.js';
import '../screens/prefs-lines.js';

const inSample = () => !!(window.__gsSample && window.__gsSample.on);
const can = () => 'showDirectoryPicker' in window;

// What came in, said once: "2 new, 1 updated from the Planner folder".
function said(r, quiet) {
  if (!r) return;
  if (r.failed) { if (!quiet) toast(t('prefs.pf_read_failed')); return; }
  if (r.added && r.changed) toast(t('prefs.pf_came_both', { a: r.added, c: r.changed }));
  else if (r.added) toast(t('prefs.pf_came_new', { n: r.added }));
  else if (r.changed) toast(t('prefs.pf_came_changed', { n: r.changed }));
  else if (!quiet) toast(t('prefs.pf_nothing'));
}
export const lookNow = quiet => readPlannerFolder().then(r => said(r, quiet), e => { console.error(e); if (!quiet) toast(t('prefs.pf_read_failed')); });

let watching = false;
export function watchPlannerFolder() {
  if (watching) return; watching = true;
  const typing = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  lookNow(true);
  window.addEventListener('focus', () => { if (!typing()) lookNow(true); });
}

async function link() {
  if (inSample()) return toast(t('prefs.pf_sample'), { ms: 7000 });
  let h;
  try { h = await window.showDirectoryPicker({ id: 'gs-lessons', mode: 'readwrite', startIn: 'documents' }); }
  catch (e) { if (e && e.name !== 'AbortError') toast(t('prefs.pf_failed')); return false; }
  try {
    if (await holdsGrading(h)) { toast(t('prefs.pf_grading'), { ms: 8000 }); return false; }
    await linkPlannerFolder(h);
    await writePlannerFolderAll(await loadPlan(true));
    toast(t('prefs.pf_linked', { name: h.name }));
    watchPlannerFolder();
    return true;
  } catch (e) { console.error(e); saveFailed(e); return false; }
}
async function permit() {
  const f = await plannerFolder(); if (!f) return false;
  let p = 'denied'; try { p = await f.dir.requestPermission({ mode: 'readwrite' }); } catch {}
  if (p !== 'granted') return false;
  try { await lookNow(true); await writePlannerFolderAll(await loadPlan(true)); return true; } catch (e) { console.error(e); saveFailed(e); return false; }
}

// Settings > Working with AI: the Planner folder's card.
export function FolderCard() {
  const [f, setF] = useState(undefined), [busy, setBusy] = useState(false);
  const again = () => plannerFolder().then(setF, () => setF(null));
  useEffect(() => { again(); }, []);
  const run = fn => async () => { setBusy(true); try { await fn(); } finally { setBusy(false); again(); } };
  if (f === undefined) return null;
  const state = !f ? t('prefs.pf_none') : f.ok ? t('prefs.pf_linked_state') : t('prefs.pf_ask');
  return <Card title={t('prefs.pf_h')} data-pfolder>
    <p class="mute">{t('prefs.pf_about', { name: assistant().name || t('assistant.generic') })}</p>
    {!can() ? <p class="hint">{t('prefs.pf_no_api')}</p> : <>
      <p data-pfstate={!f ? 'none' : f.ok ? 'ok' : 'ask'}><Icon name={f && f.ok ? 'check' : 'folder'} size="sm" /> {state}{f && <> <b data-raw>{f.dir.name}</b></>}</p>
      <div class="row gap">
        {f && !f.ok && <Button size="sm" variant="primary" disabled={busy} onClick={run(permit)} data-pfpermit>{t('prefs.pf_permit')}</Button>}
        {f && f.ok && <Button size="sm" disabled={busy} onClick={run(() => lookNow(false))} data-pflook>{t('prefs.pf_look')}</Button>}
        <Button size="sm" variant={f ? 'quiet' : 'primary'} disabled={busy} onClick={run(link)} data-pflink>{f ? t('prefs.pf_change') : t('prefs.pf_link')}</Button>
      </div></>}
  </Card>;
}

// A lesson the assistant made or changed in the folder (pending, or status review): marked arrived and not reviewed, with Back to
// your version for a changed one (src/planner/review.js pendingBack). Marking it Ready (lesson.jsx) clears the mark.
export function Arrived({ p, l, save }) {
  const name = assistant().name || t('assistant.generic');
  const back = async () => {
    try {
      const E = engine(p), before = l.pending.before, title = l.pending.title;
      await saveVersion(l, t('prefs.pf_their_version', { name }), E.snap, E.MAX_VERSIONS);
      const n = JSON.parse(JSON.stringify(l)); n.slides = before.map(E.normSlide); if (title) n.title = title; delete n.pending; if (n.status === 'review') n.status = '';
      if (await save(n)) toast(t('prefs.pf_back_done', { name }));
    } catch (e) { saveFailed(e); }
  };
  const keep = () => { const n = JSON.parse(JSON.stringify(l)); delete n.pending; if (n.status === 'review') n.status = ''; save(n); };
  return <div class="aimark" role="status" data-arrived>
    <Icon name="assist" size="sm" /><span>{l.pending ? t('prefs.pf_changed', { name }) : t('prefs.pf_arrived')}</span>
    <span class="mute">{t('prefs.pf_read_through')}</span><span class="grow" />
    {l.pending && Array.isArray(l.pending.before) && <Button size="sm" variant="quiet" onClick={back} data-arrived-back>{t('prefs.pf_back')}</Button>}
    <Button size="sm" onClick={keep} data-arrived-keep>{t('prefs.pf_reviewed')}</Button>
  </div>;
}
