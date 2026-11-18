// A lesson (design screenshots 3, 3b, 13): Lesson, Slides and Edit views of one deck. Lesson reads like a plan: what the class will
// do today, the agenda, each slide with its notes, and beside it the class, the day, the sections that share it, the comments for
// the assistant and the files. Slides shows one slide large, arrow keys between them, with Present (the whole screen) one press away.
// Edit is the editor (lesson/edit.jsx). Every slide is drawn by the current Planner's own code (plan/slide.jsx).
//
// Draft / Ready / Taught are the lesson's own fields as the current Planner keeps them: ready is { at }, and taught adds the class's
// place to "taught" (src/planner/plfocus.js pfReady, src/planner/present.js). Every change saves through planning/write.js.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Segmented, Button, IconButton, Icon, EmptyState, Switch, Select, TextInput, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go } from '../router.js';
import { usePlan } from '../plan.js';
import { toneOf } from '../colors.js';
import { assistant } from '../../services/assistant.js';
import { register } from '../../services/shortcuts.js';
import { addCommand } from '../../services/commands.js';
import { engine } from '../../planning/engine.js';
import { saveLesson, saveTaughtNote } from '../../planning/write.js';
import { taughtIn } from '../../planning/index.js';
import { Slide } from '../plan/slide.jsx';
import { stateOf, classOf, today, at, mins, lessonsOn } from '../plan/lessons.js';
import { saveFailed } from '../plan/save.js';
import { Talk } from '../plan/talk.jsx';
import { PARTS } from '../router.js';
import { Materials } from '../plan/materials.jsx';
import { LessonMenu } from '../plan/lesson-menu.jsx';
import { AssistantSheet } from '../plan/assistant.jsx';
import { TextBox } from '../../ui/services.jsx';
import '../plan/lines.js';

const VIEWS = ['lesson', 'slides', 'edit'];
// The editor, Present and the lesson's tools come in their own files when first wanted (router.js PARTS).
const got = {};
export function usePart(name, want = true) {
  const [, bump] = useState(0);
  useEffect(() => { if (want && !got[name]) PARTS[name]().then(m => { got[name] = m; bump(n => n + 1); }, e => { console.error(e); toast(t('app.chunk_failed')); }); }, [name, want]);
  return got[name] || null;
}
const clock = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? date(new Date(2000, 0, 1, +m[1], +m[2]), { hour: 'numeric', minute: '2-digit' }) : ''; };
const lines = body => String(body || '').split('\n').map(x => x.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
// Plain words of a slide line, without the Planner's **bold** and {red} marks.
const plain = s => String(s || '').replace(/\{\w+\}|\{\/\}|\*\*|__|\*/g, '').replace(/\\([*_{])/g, '$1');

// The slot this lesson is about: the next one from today, or the last one taught.
export function slotOf(p, l) {
  const s = [...(l.slots || [])].sort((a, b) => a.date.localeCompare(b.date)), now = today();
  return s.find(x => x.date >= now) || s[s.length - 1] || null;
}
export function periodOf(p, slot) {
  if (!slot) return null;
  const c = classOf(p, slot.classId); if (!c) return null;
  const dow = at(slot.date).getDay(), m = (c.meets || []).find(x => +x.dow === dow) || null;
  return { c, m };
}

// The lesson by its id, kept as she changes it here; read again when another window saves it.
export function useLesson(p, id) {
  const [l, setL] = useState(null), mine = useRef(0);
  useEffect(() => {
    if (!p) return;
    const got = p.lessons.find(x => x.id === id) || null;
    if (!l || !got || got.id !== l.id || got.updated !== l.updated && Date.now() - mine.current > 1500) setL(got);
  }, [p, id]);
  const save = useCallback(async next => {
    setL(next); mine.current = Date.now();
    try { const s = await saveLesson(next); setL(cur => (cur && cur.id === s.id ? { ...cur, updated: s.updated, _file: s._file, _mod: s._mod, _sync: s._sync } : cur)); return s; }
    catch (e) { saveFailed(e); return null; }
  }, []);
  return [l, save];
}

function StateSeg({ l, slot, onSave }) {
  const s = slot ? stateOf(l, slot.classId, slot.date) : (l.ready ? 'ready' : 'draft');
  const pick = v => {
    if (v === s) return;
    const n = JSON.parse(JSON.stringify(l));
    if (v === 'ready') { n.ready = { at: Date.now() }; if (slot) n.taught = (n.taught || []).filter(x => !(x.classId === slot.classId && x.date === slot.date)); }
    else if (v === 'draft') { delete n.ready; if (slot) n.taught = (n.taught || []).filter(x => !(x.classId === slot.classId && x.date === slot.date)); }
    else if (v === 'taught' && slot) { const of = n.slides.length; n.taught = [...(n.taught || []).filter(x => !(x.classId === slot.classId && x.date === slot.date)), { classId: slot.classId, date: slot.date, slide: of, of, note: '', at: Date.now() }]; }
    if (n.taught && !n.taught.length) delete n.taught;
    onSave(n);
  };
  return <Segmented label={t('plan.lesson_state')} value={s} onChange={pick}
    options={[{ value: 'draft', label: t('plan.draft') }, { value: 'ready', label: t('plan.ready') }, { value: 'taught', label: t('plan.taught'), disabled: !slot }]} />;
}

function download(p, l) {
  try {
    const E = engine(p), blob = new Blob([E.buildPptx(l)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = E.fileBase(l) + '.pptx'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) { console.error(e); toast(t('plan.pptx_failed')); }
}

function LessonView({ p, l, slot, per, onOpenSlide }) {
  const obj = l.slides.find(s => s.layout === 'objectives'), ag = l.slides.find((s, i) => i > 0 && s.layout === 'agenda');
  const rest = l.slides.map((s, i) => ({ s, i })).filter(x => x.s.layout !== 'title' && x.s !== ag);
  // Last time you taught it: the latest class it was taught to, where that class got to, and the note kept then.
  const last = [...(l.taught || [])].filter(x => x && x.date && x.date <= today()).sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0)).pop();
  return <div class="lv">
    {obj && lines(obj.body).length > 0 && <section class="lsec" aria-labelledby="h-obj"><h2 id="h-obj" class="t3" data-raw>{obj.title || t('plan.today_you_will')}</h2>
      <ul class="obj">{lines(obj.body).map(x => <li data-raw>{plain(x)}</li>)}</ul></section>}
    {ag && lines(ag.body).length > 0 && <section class="lsec" aria-labelledby="h-ag"><h2 id="h-ag" class="t3">{t('plan.agenda')} {per && per.m && <small class="mute" data-raw>{t('plan.time_range', { from: clock(per.m.start), to: clock(per.m.end) })}</small>}</h2>
      <ol class="agenda">{lines(ag.body).map(x => <li data-raw>{plain(x)}</li>)}</ol></section>}
    {last && <section class="lsec last" aria-labelledby="h-last"><h2 id="h-last" class="t3">{t('plan.last_time')}</h2>
      <p><span data-raw>{(classOf(p, last.classId) || {}).name || ''}</span> · <span data-raw>{date(at(last.date), { weekday: 'short', day: 'numeric', month: 'short' })}</span> · {last.slide >= last.of ? t('plan.got_to_end') : t('plan.got_to_n', { n: last.slide, of: last.of })}</p>
      {last.note && <p class="mute" data-raw>{last.note}</p>}</section>}
    <section class="lsec" aria-labelledby="h-steps"><h2 id="h-steps" class="t3">{t('plan.slides_n', { n: l.slides.length })}</h2>
      <ol class="steps">{rest.map(({ s, i }) => <li class="step">
        <div class="stx"><h3 data-raw>{plain(s.title) || t('plan.slide_n', { n: i + 1 })}</h3>
          {s.notes && <p class="notes" data-raw>{s.notes}</p>}
          {!s.notes && s.body && <p class="mute body" data-raw>{lines(s.body).slice(0, 3).map(plain).join(' · ')}</p>}</div>
        <button type="button" class="thumb" onClick={() => onOpenSlide(i)} aria-label={t('plan.open_slide', { n: i + 1 })}>
          <Slide slide={s} lesson={l} plan={p} width={300} />
          {(s.talk || []).length > 0 && <span class="talkn"><Icon name="comment" size="xs" />{s.talk.length}</span>}
        </button>
      </li>)}</ol>
    </section>
  </div>;
}

function SlidesView({ p, l, cur, setCur, onPresent }) {
  const s = l.slides[cur] || l.slides[0];
  return <div class="sv">
    <div class="stage"><Slide slide={s} lesson={l} plan={p} width={960} fill label={t('plan.slide_of', { n: cur + 1, of: l.slides.length })} /></div>
    <div class="svbar"><IconButton icon="chl" label={t('plan.prev_slide')} onClick={() => setCur(Math.max(0, cur - 1))} disabled={cur === 0} kbd="←" />
      <span class="num">{t('plan.slide_of', { n: cur + 1, of: l.slides.length })}</span>
      <IconButton icon="chr" label={t('plan.next_slide')} onClick={() => setCur(Math.min(l.slides.length - 1, cur + 1))} disabled={cur >= l.slides.length - 1} kbd="→" />
      <span class="grow" /><Button icon="play" onClick={onPresent}>{t('plan.present')}</Button></div>
    {s.notes && <p class="notes"><Icon name="note" size="sm" /><span data-raw>{s.notes}</span></p>}
    <ol class="strip" aria-label={t('plan.all_slides')}>{l.slides.map((x, i) => <li><button type="button" class={i === cur ? 'on' : ''} aria-current={i === cur ? 'true' : undefined} onClick={() => setCur(i)} aria-label={t('plan.slide_n', { n: i + 1 })}>
      <Slide slide={x} lesson={l} plan={p} width={150} /></button></li>)}</ol>
  </div>;
}

function Side({ p, l, slot, per, onSave, onDownload, onAssistant }) {
  const ai = assistant(), E = engine(p);
  const shared = (l.slots || []).filter(x => !slot || x.classId !== slot.classId || x.date !== slot.date);
  const partners = slot ? E.partnerSlots(slot.classId, slot.date) : [];
  const talk = (l.slides || []).reduce((n, s) => n + (s.talk || []).length, 0);
  const share = async on => {
    const n = JSON.parse(JSON.stringify(l));
    if (on) n.slots = [...n.slots, ...partners.filter(x => !n.slots.some(y => y.classId === x.classId && y.date === x.date))];
    else n.slots = n.slots.filter(x => x.classId === slot.classId && x.date === slot.date);
    onSave(n);
  };
  return <aside class="lside">
    {!(l.slots || []).length && <PlaceIt p={p} l={l} onSave={onSave} />}
    {per && <section><h2 class="sub">{t('plan.class')}</h2><p><span class="dot" style={{ '--cc': toneOf(per.c.color) }} /><b data-raw>{per.c.name}</b></p></section>}
    {slot && <section><h2 class="sub">{t('plan.when')}</h2><p data-raw>{date(at(slot.date), { weekday: 'short', day: 'numeric', month: 'short' })}</p>{per && per.m && <p class="mute" data-raw>{per.m.label ? per.m.label + ', ' : ''}{clock(per.m.start)}</p>}</section>}
    {(shared.length > 0 || partners.length > 0) && <section><h2 class="sub">{t('plan.shared')}</h2>
      {shared.map(x => { const c = classOf(p, x.classId); return <p class="mute"><span class="dot" style={{ '--cc': c ? toneOf(c.color) : 'var(--g500)' }} /><span data-raw>{c ? c.name : ''}, {date(at(x.date), { weekday: 'short', day: 'numeric', month: 'short' })}</span></p>; })}
      {(partners.length > 0 || shared.length > 0) && <Switch label={shared.length ? t('plan.shared_on') : t('plan.also_give', { names: partners.map(x => (classOf(p, x.classId) || {}).name || '').join(', ') })} checked={shared.length > 0} onChange={share} />}
    </section>}
    <Materials p={p} l={l} onSave={onSave} />
    {slot && slot.date <= today() && <AfterClass l={l} slot={slot} onSave={onSave} />}
    <section><h2 class="sub">{t('plan.comments_for', { name: ai.name || t('assistant.generic') })}</h2>
      <p class="mute">{t('plan.n_lesson_comments', { n: (l.talk || []).length })} · {t('plan.n_slide_comments', { n: talk })}</p>
      <Talk talk={l.talk || []} ai={ai.name || t('assistant.generic')} label={t('plan.comments_for', { name: ai.name || t('assistant.generic') })} onChange={v => { const n = JSON.parse(JSON.stringify(l)); if (v.length) n.talk = v; else delete n.talk; onSave(n); }} /></section>
    <div class="acts"><Button icon="assist" onClick={onAssistant} data-focus="assistant">{t('plan.work_with', { name: ai.name || t('assistant.generic') })}</Button><Button icon="download" onClick={onDownload}>{t('plan.download_slides')}</Button></div>
  </aside>;
}

// A lesson on no class and no day (kept without a date, or brought back from Past lessons) goes on the calendar from here.
function PlaceIt({ p, l, onSave }) {
  const cls = (p.setup && p.setup.classes) || [], [c, setC] = useState(cls[0] ? cls[0].id : ''), [d, setD] = useState(today());
  if (!cls.length) return null;
  return <section class="placeit"><h2 class="sub">{t('plan.not_on_calendar')}</h2>
    <Select label={t('plan.class')} value={c} options={cls.map(x => ({ value: x.id, label: x.name }))} onChange={setC} data-raw />
    <TextInput label={t('plan.date')} type="date" value={d} onInput={setD} />
    <Button size="sm" variant="primary" onClick={() => { if (!c || !/^\d{4}-\d\d-\d\d$/.test(d)) return; const n = JSON.parse(JSON.stringify(l)); n.slots = [{ classId: c, date: d }]; onSave(n); }} data-focus="place-it">{t('plan.put_on_calendar')}</Button></section>;
}

// What happened in class, kept on the class's place in "taught" as the current Planner's After class note keeps it
// (src/planner/present.js taughtDlg). Writing one for a class not yet marked taught marks it taught at the last slide.
// On a phone the lesson is never written, as today (src/phone.js phAfter): the note waits in gsp.taughtIn and the Planner on the
// computer puts it on the lesson (present.js taughtFold). Whichever is newer is shown.
const onPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches;
export function AfterClass({ l, slot, onSave }) {
  const had = (l.taught || []).find(x => x.classId === slot.classId && x.date === slot.date), key = l.id + '|' + slot.classId + '|' + slot.date;
  const waiting = () => { const T = taughtIn.json(null), it = T && T.items && T.items[key]; return it && +it.t > ((had && had.at) || 0) ? it : null; };
  const shown = () => { const w = waiting(); return w ? w.x || '' : had ? had.note || '' : ''; };
  const [v, setV] = useState(shown);
  useEffect(() => { setV(shown()); }, [l.id, slot.classId, slot.date, had && had.at]);
  const keep = () => {
    if (shown() === v.trim()) return;
    const of = l.slides.length;
    if (onPhone()) { try { saveTaughtNote(key, { slide: had ? had.slide : of, of, x: v.replace(/\s+/g, ' ').trim().slice(0, 300), t: Date.now() }); toast(t('plan.note_waits')); } catch (e) { saveFailed(e); } return; }
    const n = JSON.parse(JSON.stringify(l));
    const t0 = had ? { ...had, note: v.trim(), at: Date.now() } : { classId: slot.classId, date: slot.date, slide: of, of, note: v.trim(), at: Date.now() };
    n.taught = [...(n.taught || []).filter(x => !(x.classId === slot.classId && x.date === slot.date)), t0];
    onSave(n);
  };
  // Where the class got to, set by hand: Present records it on its own after two minutes, and this changes it or sets it.
  const reached = v2 => {
    const of = l.slides.length, sl = Math.max(1, Math.min(of, +v2 || of));
    if (onPhone()) { try { saveTaughtNote(key, { slide: sl, of, x: shown(), t: Date.now() }); toast(t('plan.note_waits')); } catch (e) { saveFailed(e); } return; }
    const n = JSON.parse(JSON.stringify(l));
    const t0 = had ? { ...had, slide: sl, of, at: Date.now() } : { classId: slot.classId, date: slot.date, slide: sl, of, note: v.trim(), at: Date.now() };
    n.taught = [...(n.taught || []).filter(x => !(x.classId === slot.classId && x.date === slot.date)), t0];
    onSave(n);
  };
  const of = l.slides.length;
  return <section class="after"><TextBox label={t('plan.after_class')} hint={t('plan.after_class_hint')} value={v} onInput={setV} onBlur={keep} rows={3} />
    <Select label={t('plan.got_to_label')} value={had ? String(Math.min(had.slide, of)) : ''} data-focus="got-to"
      options={[...(had ? [] : [{ value: '', label: t('plan.got_to_none') }]), ...l.slides.map((x, i) => ({ value: String(i + 1), label: i + 1 === of ? t('plan.got_to_last', { n: i + 1 }) : t('plan.slide_n', { n: i + 1 }) }))]}
      onChange={reached} /></section>;
}

// Where Present begins from the lesson: the slide this class stopped on last time, if it stopped partway (src/planner/present.js
// prResume). And where the class got to, kept on its place in "taught" once a lesson for today has been presented for two minutes
// or more (present.js presentEnd asks then); the teacher's note stays, and the toast takes it back.
function resumeAt(l, slot) {
  const ts = (l.taught || []).filter(x => !slot || x.classId === slot.classId), x = ts[ts.length - 1];
  return x && x.slide < l.slides.length && x.slide < x.of ? x.slide - 1 : 0;
}
function gotTo(l, slot, far, secs, save) {
  if (!slot || slot.date !== today() || !(secs >= 120) || typeof far !== 'number') return;
  const n = JSON.parse(JSON.stringify(l)), had = (n.taught || []).find(x => x.classId === slot.classId && x.date === slot.date);
  const t0 = { ...(had || { classId: slot.classId, date: slot.date, note: '' }), slide: far + 1, of: l.slides.length, at: Date.now() };
  n.taught = [...(n.taught || []).filter(x => x !== had), t0];
  save(n);
  toast(t('plan.got_to', { n: far + 1, of: l.slides.length }), { undo: () => { const b = JSON.parse(JSON.stringify(n)); b.taught = l.taught ? JSON.parse(JSON.stringify(l.taught)) : undefined; if (!b.taught) delete b.taught; save(b); } });
}

export default function LessonPage({ route }) {
  const p = usePlan();
  const [l, save] = useLesson(p, route.params.id);
  const [cur, setCur] = useState(0), [presenting, setPresenting] = useState(false), [asking, setAsking] = useState(false);
  const view = VIEWS.includes(route.params.view) ? route.params.view : 'lesson';
  const setView = v => go('lesson', route.params.id, v === 'lesson' ? '' : v);
  // Present is fetched with the page, so F5 shows it at once; the editor when the Edit view opens.
  const PresentMod = usePart('present'), EditMod = usePart('edit', view === 'edit');
  useEffect(() => {
    if (!l) return;
    const n = l.slides.length, step = d => setCur(c => Math.max(0, Math.min(n - 1, c + d)));
    const offs = [
      register({ id: 'slide-next', keys: ['arrowright', 'pagedown'], label: 'plan.next_slide', when: () => view === 'slides' && !presenting, run: () => step(1) }),
      register({ id: 'slide-prev', keys: ['arrowleft', 'pageup'], label: 'plan.prev_slide', when: () => view === 'slides' && !presenting, run: () => step(-1) }),
      register({ id: 'present', keys: 'f5', label: 'plan.present', run: () => setPresenting(true) }),
      addCommand({ id: 'lesson-present', label: () => t('plan.present_this'), group: t('cmd.group_do'), icon: 'play', run: () => setPresenting(true) }),
      addCommand({ id: 'lesson-assistant', label: () => t('plan.work_with', { name: assistant().name || t('assistant.generic') }), group: t('cmd.group_do'), icon: 'assist', run: () => setAsking(true) }),
      addCommand({ id: 'lesson-download', label: () => t('plan.download_slides'), group: t('cmd.group_do'), icon: 'download', run: () => download(p, l) }),
    ];
    return () => offs.forEach(f => f());
  }, [l && l.id, l && l.slides.length, view, presenting]);
  if (!p) return <div class="page"><div class="loading" aria-busy="true" /></div>;
  if (!l) return <div class="page"><header class="ph"><h1>{t('plan.lesson')}</h1></header><EmptyState icon="warn" title={t('plan.lesson_gone')} action={<a class="btn" href={href('calendar')}>{t('nav.calendar')}</a>} /></div>;
  const slot = slotOf(p, l), per = periodOf(p, slot);
  const n = l.slides.length;
  return <div class="page lessonpage" data-view={view}>
    <header class="lh">
      <div class="crumbs">{per && <a class="link" href={href('calendar')}><Icon name="back" size="sm" /><span class="dot" style={{ '--cc': toneOf(per.c.color) }} /><span data-raw>{per.c.name}</span></a>}</div>
      <Segmented label={t('plan.lesson_view')} value={view} onChange={setView} options={[{ value: 'lesson', label: t('plan.lesson') }, { value: 'slides', label: t('plan.slides') }, { value: 'edit', label: t('common.edit') }]} />
      <LessonMenu p={p} l={l} save={save} />
    </header>
    {per && slot && <p class="mute when"><span class="dot" style={{ '--cc': toneOf(per.c.color) }} /><span data-raw>{per.c.name}</span> <span data-raw>{date(at(slot.date), { weekday: 'short', day: 'numeric', month: 'short' })}{per.m ? ', ' + (per.m.label ? per.m.label + ', ' : '') + clock(per.m.start) : ''}</span></p>}
    <h1 class="lt" data-raw>{l.title || t('plan.untitled')}</h1>
    <div class="lbar"><StateSeg l={l} slot={slot} onSave={save} /><span class="mute">{t('plan.n_slides', { n })}</span><span class="grow" />
      <Button variant="primary" icon="play" onClick={() => setPresenting(true)} data-focus="present">{t('plan.present')}</Button></div>
    <div class={'lgrid' + (view === 'edit' ? ' edit' : '')}>
      <div class="lmain">
        {view === 'lesson' && <LessonView p={p} l={l} slot={slot} per={per} onOpenSlide={i => { setCur(i); setView('slides'); }} />}
        {view === 'slides' && <SlidesView p={p} l={l} cur={Math.min(cur, n - 1)} setCur={setCur} onPresent={() => setPresenting(true)} />}
        {view === 'edit' && (EditMod ? <EditMod.default key={l.id} p={p} l={l} cur={cur} setCur={setCur} save={save} ai={assistant().name || t('assistant.generic')} /> : <div class="loading" aria-busy="true" />)}
      </div>
      {view !== 'edit' && <Side p={p} l={l} slot={slot} per={per} onSave={save} onDownload={() => download(p, l)} onAssistant={() => setAsking(true)} />}
    </div>
    <AssistantSheet p={p} l={l} open={asking} onClose={() => setAsking(false)} save={save} />
    {presenting && PresentMod && <PresentMod.Present p={p} l={l} className={per ? per.c.name : ''} start={view === 'slides' ? cur : resumeAt(l, slot)} onClose={(i, far, secs) => { setPresenting(false); if (typeof i === 'number') setCur(i); gotTo(l, slot, far, secs, save); }} />}
  </div>;
}
