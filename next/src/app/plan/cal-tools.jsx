// The Calendar's tools that are used now and then, loaded when first wanted (router.js PARTS.cal), doing what the current Planner
// does with them:
//   UseLesson   an empty period filled with a lesson already made (src/planner/lessons.js pickLessonFor): last year's lesson for
//               this class first, as a copy of its own; any other lesson goes on this period as well, as the current Planner does
//   FromLibrary an empty period started from a Library activity (src/planner/activities.js "Start a new lesson with it")
//   WeekAssist  the week's empty periods planned with the teacher's assistant: one self-contained message (it never names a folder,
//               path or file on anyone's computer), and one .zip back with week.json and each lesson as its own file, also given
//               as separate files; each lesson looked at, then kept on its period
// Planning material only: nothing here reads a student's work.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Sheet, Button, Icon, TextInput, Checkbox, toast } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t, date } from '../../i18n/t.js';
import { go } from '../router.js';
import { engine } from '../../planning/engine.js';
import { nameKey } from '../../planning/plan.js';
import { saveLesson, saveLessonFile } from '../../planning/write.js';
import { periods, lessonsOn, weekDays, at, classOf, newLesson } from './lessons.js';
import { ACTIVITIES, actSlide } from '../../engines/activities.js';
import { assistant } from '../../services/assistant.js';
import { saveFailed } from './save.js';
import { Slide } from './slide.jsx';
import './lines.js';
import './more-lines.js';
import { DriveButton } from '../drive-button.jsx';

const copy = x => JSON.parse(JSON.stringify(x));
const day = d => date(at(d), { weekday: 'short', month: 'short', day: 'numeric' });
const aiName = () => assistant().name || t('assistant.generic');
const dayGap = (a, b) => Math.round((at(a) - at(b)) / 864e5);

// A lesson made into one of this period's own: a copy with its pictures and materials' places kept, new ids, no taught record.
async function copyOnto(p, l, classId, d) {
  const E = engine(p), j = copy(l);
  for (const k of ['_file', '_mod', '_sync', 'pending', 'taught', 'ready', 'final', 'finals', 'variantOf', 'variant']) delete j[k];
  j.id = E.lid(); j.slots = [{ classId, date: d }, ...E.partnerSlots(classId, d)]; j.created = j.updated = Date.now(); j.status = ''; j.claudeNote = '';
  j.slides = j.slides.map(s => ({ ...s, id: E.lid() }));
  j.files = (l.files || []).filter(f => String(f.id).startsWith('gsex:') || f.kind === 'doc').map(f => ({ ...f }));
  return saveLesson(E.normLesson(j));
}

/* ---------- a lesson I have ---------- */
export function UseLesson({ p, c, d, onClose }) {
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false), s = q.trim().toLowerCase();
  const key = nameKey(c.name), mine = x => { const k = classOf(p, x.classId); return String(x.classId) === String(c.id) || (k && (nameKey(k.name) === key || (c.course && k.course === c.course))); };
  const all = (p.lessons || []).filter(l => l && !l.library && (!s || String(l.title || '').toLowerCase().includes(s)) && !(l.slots || []).some(x => String(x.classId) === String(c.id) && x.date === d));
  // Last year's: taught to this class (or one of the same name or course) about a year before this day.
  const lastYear = all.map(l => ({ l, g: Math.min(...(l.slots || []).filter(mine).map(x => Math.abs(dayGap(d, x.date) - 364)), Infinity) })).filter(r => r.g <= 45).sort((a, b) => a.g - b.g).map(r => r.l); // not-words
  const loose = all.filter(l => !(l.slots || []).length && !lastYear.includes(l));
  const rest = all.filter(l => !lastYear.includes(l) && !loose.includes(l)).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 40);
  const where = l => (l.slots || []).length ? l.slots.map(x => ((classOf(p, x.classId) || {}).name || '') + ' ' + day(x.date)).join(', ') : t('more.not_on_class');
  const pick = async (l, asCopy) => {
    if (busy) return; setBusy(true);
    try {
      let n;
      if (asCopy) n = await copyOnto(p, l, c.id, d);
      else { n = copy(l); delete n._file; delete n._mod; n.slots = [...(n.slots || []), { classId: c.id, date: d }]; n = await saveLesson(n); }
      toast(asCopy ? t('more.used_copy', { title: l.title || t('plan.untitled') }) : t('more.used_on', { title: l.title || t('plan.untitled') })); onClose(); go('lesson', n.id);
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  const Rows = ({ list, asCopy }) => <ul class="list">{list.map(l => <li><button type="button" class="lrow" disabled={busy} onClick={() => pick(l, asCopy)} data-use={l.id}>
    <span class="lead"><Icon name="slides" /></span><span class="main"><b data-raw>{l.title || t('plan.untitled')}</b><small data-raw>{where(l)}</small></span>
    <span class="end mute">{asCopy ? t('more.as_copy') : t('plan.n_slides', { n: (l.slides || []).length })}</span></button></li>)}</ul>;
  return <Sheet open title={t('more.use_on', { name: c.name, day: day(d) })} icon={<Icon name="slides" />} onClose={onClose}>
    <TextInput label={t('plan.find_lesson')} icon="search" type="search" value={q} onInput={setQ} data-focus="use-find" />
    {lastYear.length > 0 && <><h3 class="sub">{t('more.last_year')}</h3><p class="mute small">{t('more.last_year_help')}</p><Rows list={lastYear} asCopy /></>}
    {loose.length > 0 && <><h3 class="sub">{t('more.loose_lessons')}</h3><Rows list={loose} /></>}
    {rest.length > 0 && <><h3 class="sub">{t('more.other_lessons')}</h3><p class="mute small">{t('more.other_help')}</p><Rows list={rest} /></>}
    {!lastYear.length && !loose.length && !rest.length && <p class="mute">{t('more.no_lessons_found')}</p>}
  </Sheet>;
}

/* ---------- from the Library ---------- */
export function FromLibrary({ p, c, d, onClose }) {
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false), s = q.trim().toLowerCase();
  const acts = [...((p && p.activities) || []).filter(a => a && a.name), ...ACTIVITIES].filter(a => !s || (a.name + ' ' + (a.what || '')).toLowerCase().includes(s)).slice(0, 60);
  const pick = async a => {
    if (busy) return; setBusy(true);
    try {
      const l = await newLesson(p, c.id, d), n = copy(l); n.title = a.name; n.slides[0].title = a.name;
      n.slides = n.slides.filter(x => x.layout === 'title' || x.layout === 'agenda'); n.slides.push(actSlide(a));
      await saveLesson(n); toast(t('more.started_with', { name: a.name })); onClose(); go('lesson', n.id, 'edit');
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  return <Sheet open title={t('more.from_library_on', { name: c.name, day: day(d) })} icon={<Icon name="spark" />} onClose={onClose}>
    <p class="mute">{t('more.from_library_help')}</p>
    <TextInput label={t('plan.find_activity')} icon="search" type="search" value={q} onInput={setQ} data-focus="lib-find" />
    <ul class="list">{acts.map(a => <li><button type="button" class="lrow" disabled={busy} onClick={() => pick(a)} data-act={a.id}><span class="lead"><Icon name="spark" /></span>
      <span class="main"><b data-raw>{a.name}</b>{a.what && <small data-raw>{a.what}</small>}</span></button></li>)}</ul>
  </Sheet>;
}

/* ---------- plan the week with the assistant ---------- */
// The week's periods, each with its lesson or none.
const weekRows = (p, mon) => weekDays(p, mon).flatMap(d => periods(p, d).map(({ c, m }) => ({ key: c.id + '|' + d, c, m, d, has: lessonsOn(p, c.id, d) })));
// What the class did last: the latest lesson taught to it before the week, with where it got to and what was noted.
function lastFor(p, c, mon) {
  let best = null;
  for (const l of p.lessons || []) for (const x of l.taught || []) if (x && String(x.classId) === String(c.id) && x.date < mon && (!best || x.date > best.x.date)) best = { l, x };
  return best;
}
const fileFor = r => (r.d + ' ' + r.c.name).replace(/[^\w\- ]+/g, '').replace(/\s+/g, ' ').trim() + '.json';
export async function weekBrief(p, mon, rows, extra) {
  const E = engine(p), slideSpec = E.lessonZipAsk().split('\n').filter(x => /^ {2}(\{|Any slide)/.test(x)).join('\n');
  let ctx = '';
  for (const r of rows) {
    const stub = E.normLesson({ title: '', slots: [{ classId: r.c.id, date: r.d }], slides: [] });
    const c2 = (await E.lessonContext(stub)).split(/\n(?=## )/).filter(x => !x.trim().startsWith('## Activities')).join('\n').trim();
    const last = lastFor(p, r.c, mon);
    ctx += '\n### ' + r.c.name + ', ' + date(at(r.d), { weekday: 'long', month: 'long', day: 'numeric' }) + ' (file: ' + fileFor(r) + ')\n' + c2.replace(/^## /gm, '#### ') + '\n' +
      (last ? 'Last lesson taught to this class: "' + (last.l.title || '') + '"' + (last.x.of ? ', got to slide ' + (last.x.slide || 0) + ' of ' + last.x.of : '') + (last.x.note ? '. My note: ' + last.x.note : '') + '\n' : '');
  }
  const acts = (p.activities || []).filter(a => a && a.name).slice(0, 25);
  return 'Here is my week from my Planner. Everything you need is in this message. Don\'t look for, open or ask for any folder or file on my computer.\n\n' +
    'Plan one lesson for each class period listed below. Follow on from what each class did last and from its unit. Slide 1 of each lesson is the title slide' + (E.deckAgenda() ? ' and slide 2 the agenda' : '') + ', and slide text stays ' + E.deckSizeSay() + ' pt; keep my simple bullet style.\n\n' +
    'When you are done, give me ONE downloadable .zip file. In it:\n' +
    '- week.json: { "kind": "grading-studio-week-zip", "lessons": [ { "class": "<class name exactly as below>", "date": "YYYY-MM-DD", "file": "<that lesson\'s file name>" } ] }\n' + // not-words
    '- one file per lesson, named as given below, each: { "kind": "grading-studio-lesson-zip", "lesson": { "title": "…", "slides": [ … ] }, "materials": ["<each handout file name>"] }. Each slide is one of:\n' + slideSpec + '\n' +
    '- any handouts the lessons need (.docx, .pdf and so on).\n' +
    'Also give me each lesson file and every handout as its own downloadable file, so I can open or use one without the .zip.\n' +
    'Put nothing about any student in any of them. Then tell me in a few lines what you planned. I will upload the .zip on the week in my Planner.\n\n' +
    '## The periods to plan\n' + ctx +
    (acts.length ? '\n## Activities I like to use (use one where it fits)\n' + acts.map(a => '- ' + a.name + (a.what ? ': ' + a.what : '')).join('\n') + '\n' : '') +
    (extra && extra.trim() ? '\n## Anything else from me\n' + extra.trim() + '\n' : '');
}
// The reply read: the .zip (week.json and its lesson files), or lesson files on their own. Each: { r (the period), lesson, files }.
export async function readWeek(p, mon, files) {
  const E = engine(p), fflate = await import('fflate'), rows = weekRows(p, mon), got = [], loose = {};
  const take = (name, json, bag) => {
    let j; try { j = JSON.parse(json); } catch { return; }
    const les = j && (j.lesson || (Array.isArray(j.slides) ? j : null)); if (!les || !Array.isArray(les.slides) || !les.slides.length) return;
    let r = null;
    if (j.class && j.date) r = rows.find(x => x.d === j.date && nameKey(x.c.name) === nameKey(j.class));
    if (!r) r = rows.find(x => fileFor(x).toLowerCase() === E.baseName(name).toLowerCase());
    if (!r) return;
    const mats = (Array.isArray(j.materials) ? j.materials : []).map(m => Object.keys(bag).find(n => E.baseName(n).toLowerCase() === E.baseName(m).toLowerCase())).filter(Boolean);
    got.push({ r, lesson: { title: String(les.title || '').slice(0, 200), slides: les.slides.map(s => E.normSlide(s)) }, files: mats.map(n => ({ name: E.baseName(n), bytes: bag[n] })) });
  };
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const z = fflate.unzipSync(new Uint8Array(await f.arrayBuffer())), names = Object.keys(z).filter(n => !n.endsWith('/') && !E.ZIP_SKIP(n) && z[n].length);
      const wf = names.find(n => E.baseName(n).toLowerCase() === 'week.json'); let list = [];
      if (wf) { try { list = (JSON.parse(fflate.strFromU8(z[wf])) || {}).lessons || []; } catch { } }
      for (const e of Array.isArray(list) ? list : []) {
        const n = names.find(x => E.baseName(x).toLowerCase() === E.baseName(String(e.file || '')).toLowerCase()); if (!n) continue;
        let j; try { j = JSON.parse(fflate.strFromU8(z[n])); } catch { continue; }
        take(n, JSON.stringify({ ...j, class: j.class || e.class, date: j.date || e.date }), z);
      }
      for (const n of names) if (/\.json$/i.test(n) && n !== wf && !got.some(g => fileFor(g.r).toLowerCase() === E.baseName(n).toLowerCase())) take(n, fflate.strFromU8(z[n]), z);
    } else if (/\.json$/i.test(f.name)) take(f.name, await f.text(), loose);
  }
  const seen = new Set();
  return got.filter(g => !seen.has(g.r.key) && seen.add(g.r.key));
}

export function WeekAssist({ p, mon, onClose }) {
  const E = engine(p), name = aiName(), ai = assistant(), rows = weekRows(p, mon);
  const [pick, setPick] = useState(() => Object.fromEntries(rows.map(r => [r.key, !r.has.length]))), [extra, setExtra] = useState('');
  const [got, setGot] = useState(null), [keep, setKeep] = useState({}), [busy, setBusy] = useState(false), [over, setOver] = useState(false);
  const chosen = rows.filter(r => pick[r.key]);
  const doCopy = async () => {
    if (!chosen.length) return toast(t('more.week_pick_one'));
    try { await navigator.clipboard.writeText(await weekBrief(p, mon, chosen, extra)); toast(t('more.week_copied', { n: chosen.length, name })); }
    catch (e) { console.error(e); toast(t('plan.copy_failed')); }
  };
  const take = async fs => {
    fs = [...(fs || [])]; if (!fs.length) return; setBusy(true);
    try { const g = await readWeek(p, mon, fs); if (!g.length) toast(t('more.week_none_back')); else { setGot(g); setKeep(Object.fromEntries(g.map(x => [x.r.key, !x.r.has.length]))); } }
    catch (e) { console.error(e); toast(t('plan.zip_bad')); } finally { setBusy(false); }
  };
  const keepAll = async () => {
    setBusy(true); let n = 0;
    try {
      for (const g of got) {
        if (!keep[g.r.key]) continue;
        const l = E.normLesson({ title: g.lesson.title || t('plan.new_lesson'), slots: [{ classId: g.r.c.id, date: g.r.d }, ...E.partnerSlots(g.r.c.id, g.r.d)], slides: g.lesson.slides });
        l.files = [];
        for (const f of g.files) { const id = E.lid(), b = new Blob([f.bytes], { type: E.mimeOf(f.name) }); await saveLessonFile(b, id); l.files.push({ id, name: f.name, kind: 'other', type: b.type, size: b.size, added: Date.now() }); }
        await saveLesson(l); n++;
      }
      toast(t('more.week_kept', { n })); onClose();
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  const label = r => r.c.name + ' · ' + day(r.d);
  return <Sheet open wide title={t('more.week_with', { name })} icon={<Icon name="assist" />} onClose={onClose}
    footer={got ? <><Button variant="quiet" onClick={() => setGot(null)}>{t('common.cancel')}</Button><Button variant="primary" disabled={busy || !got.some(g => keep[g.r.key])} onClick={keepAll} data-focus="week-keep">{t('more.week_keep', { n: got.filter(g => keep[g.r.key]).length })}</Button></> : null}>
    {!got ? <div class="asst"><ol class="asteps">
      <li><b>{t('more.week_which')}</b>
        {rows.length ? <fieldset class="ticks wkticks"><legend class="lab">{t('more.week_periods')}</legend>{rows.map(r => <Checkbox label={label(r) + (r.has.length ? ' · ' + t('more.week_has', { title: r.has[0].title || t('plan.untitled') }) : '')} checked={!!pick[r.key]} onChange={v => setPick({ ...pick, [r.key]: v })} data-raw />)}</fieldset>
          : <p class="mute">{t('more.week_no_periods')}</p>}</li>
      <li><b>{t('plan.step_copy')}</b><p class="mute">{t('more.week_copy_text', { name })}</p>
        <TextBox label={t('plan.anything_to_add')} hint={t('plan.anything_hint', { name })} value={extra} onInput={setExtra} rows={3} data-focus="week-extra" />
        <div class="row"><Button variant="primary" icon="copy" disabled={!chosen.length} onClick={doCopy} data-focus="week-copy">{t('plan.copy_brief')}</Button>
          {ai.link && <a class="btn" href={ai.link} target="_blank" rel="noopener">{t('plan.open_name', { name })}<Icon name="arrow" size="xs" /></a>}</div></li>
      <li><b>{t('plan.step_zip')}</b><p class="mute">{t('more.week_zip_text', { name })}</p>
        <label class={'drop' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}>
          <Icon name="upload" /><span>{busy ? t('plan.reading') : t('more.week_drop')}</span>
          <input type="file" multiple accept=".zip,.json,application/zip,application/json" class="vh" onChange={e => { const f = [...e.currentTarget.files]; e.currentTarget.value = ''; take(f); }} data-weekzip /></label><DriveButton /></li>
      <li><b>{t('plan.step_review')}</b><p class="mute">{t('more.week_review_text')}</p></li>
    </ol></div>
      : <div class="asst"><p>{t('more.week_got', { n: got.length })}</p>
        <ol class="review">{got.map(g => <li class="ch">
          <Checkbox checked={!!keep[g.r.key]} onChange={v => setKeep({ ...keep, [g.r.key]: v })} label={label(g.r) + ': ' + (g.lesson.title || t('plan.untitled')) + ' · ' + t('plan.n_slides', { n: g.lesson.slides.length })} data-raw />
          {g.r.has.length > 0 && <p class="mute small">{t('more.week_also', { title: g.r.has[0].title || t('plan.untitled') })}</p>}
          {g.files.length > 0 && <p class="mute small">{t('plan.n_files_in', { n: g.files.length })} <span data-raw>{g.files.map(f => f.name).join(', ')}</span></p>}
          <div class="pair">{g.lesson.slides.slice(0, 3).map(s => <Slide slide={s} lesson={{ ...g.lesson, slots: [{ classId: g.r.c.id, date: g.r.d }] }} plan={p} width={180} />)}</div></li>)}</ol></div>}
  </Sheet>;
}
