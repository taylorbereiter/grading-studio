// A lesson (design screenshots 3, 3b, 13): Lesson, Slides and Edit views of one deck. Lesson reads like a plan: what the class will
// do today, the agenda, each slide with its notes, and beside it the class, the day, the sections that share it, the comments for
// the assistant and the files. Slides shows one slide large, arrow keys between them, with Present (the whole screen) one press away.
// Edit is the editor (lesson/edit.jsx). Every slide is drawn by the current Planner's own code (plan/slide.jsx).
//
// Draft / Ready / Taught are the lesson's own fields as the current Planner keeps them: ready is { at }, and taught adds the class's
// place to "taught" (src/planner/plfocus.js pfReady, src/planner/present.js). Every change saves through planning/write.js.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Segmented, Button, IconButton, Icon, EmptyState, Switch, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go } from '../router.js';
import { usePlan } from '../plan.js';
import { toneOf } from '../colors.js';
import { assistant } from '../../services/assistant.js';
import { register } from '../../services/shortcuts.js';
import { addCommand } from '../../services/commands.js';
import { engine } from '../../planning/engine.js';
import { saveLesson } from '../../planning/write.js';
import { Slide } from '../plan/slide.jsx';
import { stateOf, classOf, today, at, mins, lessonsOn } from '../plan/lessons.js';
import { saveFailed } from './calendar.jsx';
import { Present } from '../plan/present.jsx';

const VIEWS = ['lesson', 'slides', 'edit'];
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
    if (!l || !got || got.updated !== l.updated && Date.now() - mine.current > 1500) setL(got);
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
  return <div class="lv">
    {obj && lines(obj.body).length > 0 && <section class="lsec" aria-labelledby="h-obj"><h2 id="h-obj" class="t3" data-raw>{obj.title || t('plan.today_you_will')}</h2>
      <ul class="obj">{lines(obj.body).map(x => <li data-raw>{plain(x)}</li>)}</ul></section>}
    {ag && lines(ag.body).length > 0 && <section class="lsec" aria-labelledby="h-ag"><h2 id="h-ag" class="t3">{t('plan.agenda')} {per && per.m && <small class="mute" data-raw>{t('plan.time_range', { from: clock(per.m.start), to: clock(per.m.end) })}</small>}</h2>
      <ol class="agenda">{lines(ag.body).map(x => <li data-raw>{plain(x)}</li>)}</ol></section>}
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

function Side({ p, l, slot, per, onSave, onDownload }) {
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
    {per && <section><h2 class="sub">{t('plan.class')}</h2><p><span class="dot" style={{ '--cc': toneOf(per.c.color) }} /><b data-raw>{per.c.name}</b></p></section>}
    {slot && <section><h2 class="sub">{t('plan.when')}</h2><p data-raw>{date(at(slot.date), { weekday: 'short', day: 'numeric', month: 'short' })}</p>{per && per.m && <p class="mute" data-raw>{per.m.label ? per.m.label + ', ' : ''}{clock(per.m.start)}</p>}</section>}
    {(shared.length > 0 || partners.length > 0) && <section><h2 class="sub">{t('plan.shared')}</h2>
      {shared.map(x => { const c = classOf(p, x.classId); return <p class="mute"><span class="dot" style={{ '--cc': c ? toneOf(c.color) : 'var(--g500)' }} /><span data-raw>{c ? c.name : ''}, {date(at(x.date), { weekday: 'short', day: 'numeric', month: 'short' })}</span></p>; })}
      {(partners.length > 0 || shared.length > 0) && <Switch label={shared.length ? t('plan.shared_on') : t('plan.also_give', { names: partners.map(x => (classOf(p, x.classId) || {}).name || '').join(', ') })} checked={shared.length > 0} onChange={share} />}
    </section>}
    <section><h2 class="sub">{t('plan.comments_for', { name: ai.name || t('assistant.generic') })}</h2>
      <p class="mute">{t('plan.n_lesson_comments', { n: (l.talk || []).length })} · {t('plan.n_slide_comments', { n: talk })}</p></section>
    <div class="acts"><Button icon="download" onClick={onDownload}>{t('plan.download_slides')}</Button></div>
  </aside>;
}

export default function LessonPage({ route }) {
  const p = usePlan();
  const [l, save] = useLesson(p, route.params.id);
  const [cur, setCur] = useState(0), [presenting, setPresenting] = useState(false);
  const view = VIEWS.includes(route.params.view) ? route.params.view : 'lesson';
  const setView = v => go('lesson', route.params.id, v === 'lesson' ? '' : v);
  useEffect(() => {
    if (!l) return;
    const n = l.slides.length, step = d => setCur(c => Math.max(0, Math.min(n - 1, c + d)));
    const offs = [
      register({ id: 'slide-next', keys: ['arrowright', 'pagedown'], label: 'plan.next_slide', when: () => view === 'slides' && !presenting, run: () => step(1) }),
      register({ id: 'slide-prev', keys: ['arrowleft', 'pageup'], label: 'plan.prev_slide', when: () => view === 'slides' && !presenting, run: () => step(-1) }),
      register({ id: 'present', keys: 'f5', label: 'plan.present', run: () => setPresenting(true) }),
      addCommand({ id: 'lesson-present', label: () => t('plan.present_this'), group: t('cmd.group_do'), icon: 'play', run: () => setPresenting(true) }),
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
    </header>
    {per && slot && <p class="mute when"><span class="dot" style={{ '--cc': toneOf(per.c.color) }} /><span data-raw>{per.c.name}</span> <span data-raw>{date(at(slot.date), { weekday: 'short', day: 'numeric', month: 'short' })}{per.m ? ', ' + (per.m.label ? per.m.label + ', ' : '') + clock(per.m.start) : ''}</span></p>}
    <h1 class="lt" data-raw>{l.title || t('plan.untitled')}</h1>
    <div class="lbar"><StateSeg l={l} slot={slot} onSave={save} /><span class="mute">{t('plan.n_slides', { n })}</span><span class="grow" />
      <Button variant="primary" icon="play" onClick={() => setPresenting(true)} data-focus="present">{t('plan.present')}</Button></div>
    <div class={'lgrid' + (view === 'edit' ? ' edit' : '')}>
      <div class="lmain">
        {view === 'lesson' && <LessonView p={p} l={l} slot={slot} per={per} onOpenSlide={i => { setCur(i); setView('slides'); }} />}
        {view === 'slides' && <SlidesView p={p} l={l} cur={Math.min(cur, n - 1)} setCur={setCur} onPresent={() => setPresenting(true)} />}
        {view === 'edit' && <EmptyState icon="edit" title={t('plan.edit_soon')} />}
      </div>
      {view !== 'edit' && <Side p={p} l={l} slot={slot} per={per} onSave={save} onDownload={() => download(p, l)} />}
    </div>
    {presenting && <Present p={p} l={l} start={view === 'slides' ? cur : 0} onClose={i => { setPresenting(false); if (typeof i === 'number') setCur(i); }} />}
  </div>;
}
