// The Planner folder (src/planner/lessons.js folderLink, folderReconnect, folderRead; design: Settings > Working with AI, "Planner
// folder"): a folder of its own on this computer where the teacher's assistant reads and changes her lessons, units, activities,
// rubrics and timetable. Linked, given permission again and looked in from its card; read by itself when the app opens and when
// she comes back to the window (not while she is typing). What the assistant added or changed comes in through
// planning/folder-read.js and shows as arrived and not reviewed (Arrived below) until she marks it Ready.
// Loaded through router.js PARTS.pfolder, so Settings and the lesson page carry none of it until it is wanted.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Card, Button, Icon, Sheet, toast } from '../../ui/index.js';
import { Slide } from './slide.jsx';
import { t } from '../../i18n/t.js';
import { assistant } from '../../services/assistant.js';
import { plannerFolder } from '../../planning/folder.js';
import { holdsGrading, linkPlannerFolder, writePlannerFolderAll } from '../../planning/folder-more.js';
import { readPlannerFolder } from '../../planning/folder-read.js';
export { recoverLessonFileConflict } from '../../planning/folder-read.js';
import { saveVersion } from '../../planning/write.js';
import { loadPlan } from '../../planning/plan.js';
import { engine } from '../../planning/engine.js';
import { saveFailed } from './save.js';
import '../screens/prefs-lines.js';
import './rev-lines.js';
import './lines.js';

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

async function populateLinkedFolder() {
  const result = await readPlannerFolder();
  if (!result || result.failed) { toast(t('prefs.pf_read_failed')); return false; }
  return writePlannerFolderAll(await loadPlan(true));
}

async function link() {
  if (inSample()) return toast(t('prefs.pf_sample'), { ms: 7000 });
  let h;
  try { h = await window.showDirectoryPicker({ id: 'gs-lessons', mode: 'readwrite', startIn: 'documents' }); }
  catch (e) { if (e && e.name !== 'AbortError') toast(t('prefs.pf_failed')); return false; }
  try {
    if (await holdsGrading(h)) { toast(t('prefs.pf_grading'), { ms: 8000 }); return false; }
    await linkPlannerFolder(h);
    if (!await populateLinkedFolder()) return false;
    toast(t('prefs.pf_linked', { name: h.name }));
    watchPlannerFolder();
    return true;
  } catch (e) { console.error(e); saveFailed(e); return false; }
}
async function permit() {
  const f = await plannerFolder(); if (!f) return false;
  let p = 'denied'; try { p = await f.dir.requestPermission({ mode: 'readwrite' }); } catch {}
  if (p !== 'granted') return false;
  try { return await populateLinkedFolder(); } catch (e) { console.error(e); saveFailed(e); return false; }
}

// The command bar's Planner folder command (plan/find.js addFolderCommand).
export const folderDo = how => (how === 'link' ? link() : how === 'permit' ? permit() : lookNow(false));

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
  const [cmp, setCmp] = useState(false), ch = changesOf(l);
  return <div class="aimark" role="status" data-arrived>
    <Icon name="assist" size="sm" /><span>{l.pending ? t('prefs.pf_changed', { name }) : t('prefs.pf_arrived')}</span>
    <span class="mute">{t('prefs.pf_read_through')}</span><span class="grow" />
    {ch.length > 0 && <Button size="sm" variant="primary" onClick={() => setCmp(true)} data-arrived-look>{t('rev.look_each')}</Button>}
    {l.pending && Array.isArray(l.pending.before) && <Button size="sm" variant="quiet" onClick={back} data-arrived-back>{t('prefs.pf_back')}</Button>}
    <Button size="sm" onClick={keep} data-arrived-keep>{t('prefs.pf_reviewed')}</Button>
    {cmp && <Compare p={p} l={l} ch={ch} name={name} save={save} onClose={() => setCmp(false)} />}
  </div>;
}

// The assistant's changes, slide by slide (src/planner/review.js changesOf, compareDlg, applyPicks): theirs picked on each to start;
// Keep mine puts her slide back (its comments stay either way), leaves an added one out or puts a taken-out one back after the slide
// that came before it in her version. Later closes and keeps the mark; Done keeps the picks and clears it.
const slideKey = s => JSON.stringify({ l: s.layout, t: s.title, b: s.body, z: s.size, n: s.notes, i: s.img && s.img.src.length + ':' + s.img.source, v: s.video && s.video.url + s.video.start });
export function changesOf(l) {
  if (!l.pending || !Array.isArray(l.pending.before)) return [];
  const before = l.pending.before, out = [];
  l.slides.forEach((s, at) => { const o = before.find(x => x.id === s.id); if (!o) out.push({ kind: 'added', now: s, at }); else if (slideKey(o) !== slideKey(s)) out.push({ kind: 'changed', now: s, was: o, at }); });
  for (const o of before) if (!l.slides.some(s => s.id === o.id)) out.push({ kind: 'removed', was: o });
  return out;
}
function Compare({ p, l, ch, name, save, onClose }) {
  const [pick, setPick] = useState(() => ch.map(() => 'ai'));
  const set = (i, v) => setPick(pick.map((x, j) => j === i ? v : x));
  const done = async () => {
    const E = engine(p), n = JSON.parse(JSON.stringify(l));
    ch.forEach((c, i) => {
      if (pick[i] !== 'mine') return;
      if (c.kind === 'added') n.slides = n.slides.filter(s => s.id !== c.now.id);
      else if (c.kind === 'changed') { const k = n.slides.findIndex(s => s.id === c.now.id); n.slides[k] = E.normSlide({ ...c.was, talk: c.now.talk }); }
      else { const before = l.pending.before, j = before.findIndex(s => s.id === c.was.id); let at = 0;
        for (let k = j - 1; k >= 0; k--) { const q = n.slides.findIndex(s => s.id === before[k].id); if (q >= 0) { at = q + 1; break; } }
        n.slides.splice(at, 0, E.normSlide(c.was)); }
    });
    delete n.pending; if (n.status === 'review') n.status = '';
    const mine = pick.filter(x => x === 'mine').length;
    if (await save(n)) { toast(mine ? t('rev.cmp_kept', { mine, ai: pick.length - mine, name }) : t('rev.cmp_all', { name })); onClose(); }
  };
  const side = (c, i, v, s, label) => <label class={'cside' + (pick[i] === v ? ' on' : '')}><input type="radio" name={'c' + i} checked={pick[i] === v} onChange={() => set(i, v)} data-cpick={i + ':' + v} />
    {s ? <Slide slide={s} lesson={l} width={240} /> : <div class="cnone">{t('rev.cmp_none')}</div>}<span>{label}</span></label>;
  return <Sheet open wide title={t('rev.cmp_title', { name })} icon={<Icon name="assist" />} onClose={onClose}
    footer={<><Button onClick={() => setPick(ch.map(() => 'mine'))} data-call="mine">{t('rev.cmp_all_mine')}</Button><Button onClick={() => setPick(ch.map(() => 'ai'))} data-call="ai">{t('rev.cmp_all_ai', { name })}</Button>
      <span class="grow" /><Button variant="quiet" onClick={onClose} data-clater>{t('rev.cmp_later')}</Button><Button variant="primary" onClick={done} data-cmpdone>{t('rev.c_done')}</Button></>}>
    <p class="mute">{t('rev.cmp_about', { name })}</p>
    <div class="cmp">{ch.map((c, i) => <section class="crow" data-crow={i}>
      <h3 class="sub">{c.kind === 'added' ? t('rev.cmp_added', { name }) : c.kind === 'removed' ? t('rev.cmp_removed', { name }) : t('rev.cmp_changed', { n: c.at + 1 })}</h3>
      <div class="cpair">{side(c, i, 'mine', c.was, c.kind === 'added' ? t('rev.cmp_leave') : t('rev.cmp_mine'))}{side(c, i, 'ai', c.now, c.kind === 'removed' ? t('rev.cmp_out') : t('rev.cmp_theirs', { name }))}</div>
      {c.now && (c.now.talk || []).some(x => x.by === 'claude') && <p class="mute">{c.now.talk.filter(x => x.by === 'claude').map(x => <span data-raw>{name}: {x.text} </span>)}</p>}
    </section>)}</div>
  </Sheet>;
}
