// A lesson (design screenshots 3, 3b, 13): Lesson, Slides and Edit views of one deck. Lesson reads like a plan: what the class will
// do today, the agenda, each slide with its notes, and beside it the class, the day, the sections that share it, the comments for
// the assistant and the files. Slides shows one slide large, arrow keys between them, with Present (the whole screen) one press away.
// Edit is the editor (lesson/edit.jsx). Every slide is drawn by the current Planner's own code (plan/slide.jsx).
//
// Draft / Ready / Taught are the lesson's own fields as the current Planner keeps them: ready is { at }, and taught adds the class's
// place to "taught" (src/planner/plfocus.js pfReady, src/planner/present.js). Every change saves through planning/write.js.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Segmented, Button, IconButton, Icon, EmptyState, Switch, Select, Menu, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go, from } from '../router.js';
import { usePlan } from '../plan.js';
import { toneOf } from '../colors.js';
import { assistant } from '../../services/assistant.js';
import { register } from '../../services/shortcuts.js';
import { addCommand } from '../../services/commands.js';
import { engine } from '../../planning/engine.js';
import { saveLesson, saveTaughtNote } from '../../planning/write.js';
import { taughtIn } from '../../planning/index.js';
import { Slide } from '../plan/slide.jsx';
import { stateOf, arrived, classOf, today, at, mins, lessonsOn } from '../plan/lessons.js';
import { saveFailed } from '../plan/save.js';
import { Talk } from '../plan/talk.jsx';
import { PARTS } from '../router.js';
import { Materials } from '../plan/materials.jsx';
import { LessonMenu } from '../plan/lesson-menu.jsx';
import { AssistantSheet } from '../plan/assistant.jsx';
import { TextBox } from '../../ui/services.jsx';
import '../plan/lines.js';
import { usePart } from '../parts.js';
import { startFocus } from '../focus/bus.js';

const VIEWS = ['lesson', 'slides', 'edit'];
// The editor, Present and the lesson's tools come in their own files when first wanted (router.js PARTS).
export { usePart };
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
    if (v === 'ready') { n.ready = { at: Date.now() }; delete n.pending; if (n.status === 'review') n.status = ''; if (slot) n.taught = (n.taught || []).filter(x => !(x.classId === slot.classId && x.date === slot.date)); }
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

function LessonView({ p, l, slot, per, onOpenSlide, onStep }) {
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
        <div class="stx"><div class="sth"><h3 data-raw>{plain(s.title) || t('plan.slide_n', { n: i + 1 })}</h3>
          <Menu label={t('plan.step_menu', { n: i + 1 })} items={[{ id: 'edit', label: t('common.edit'), icon: 'pen', onSelect: () => onStep('edit', i) }, { id: 'dup', label: t('plan.duplicate'), icon: 'copy', onSelect: () => onStep('dup', i) },
            { id: 'ask', label: t('plan.redo_with', { name: assistant().name || t('assistant.generic') }), icon: 'assist', onSelect: () => onStep('ask', i) }, { id: 'del', label: t('common.remove'), icon: 'trash', disabled: l.slides.length < 2, onSelect: () => onStep('del', i) }]}
            trigger={q => <IconButton icon="dots" size="sm" label={t('plan.step_menu', { n: i + 1 })} {...q} data-step={i} />} /></div>
          {s.notes && <p class="notes" data-raw>{s.notes}</p>}
          {!s.notes && s.body && <p class="mute body" data-raw>{lines(s.body).slice(0, 3).map(plain).join(' · ')}</p>}</div>
        <button type="button" class="thumb" onClick={() => onOpenSlide(i)} aria-label={t('plan.open_slide', { n: i + 1 })} data-slide-i={i}>
          <Slide slide={s} lesson={l} plan={p} width={300} />
          {(s.talk || []).length > 0 && <span class="talkn"><Icon name="comment" size="xs" />{s.talk.length}</span>}
        </button>
      </li>)}</ol>
    </section>
  </div>;
}

function SlidesView({ p, l, cur, setCur, onAsk, onTool, Tools, save }) {
  const s = l.slides[cur] || l.slides[0];
  return <div class="sv">
    <div class="stage"><Slide slide={s} lesson={l} plan={p} width={960} fill label={t('plan.slide_of', { n: cur + 1, of: l.slides.length })} /></div>
    <div class="svbar"><IconButton icon="chl" label={t('plan.prev_slide')} onClick={() => setCur(Math.max(0, cur - 1))} disabled={cur === 0} kbd="←" />
      <span class="num">{t('plan.slide_of', { n: cur + 1, of: l.slides.length })}</span>
      <IconButton icon="chr" label={t('plan.next_slide')} onClick={() => setCur(Math.min(l.slides.length - 1, cur + 1))} disabled={cur >= l.slides.length - 1} kbd="→" />
      <span class="grow" /><Button icon="assist" onClick={() => onAsk(cur)} data-focus="redo-slide">{t('plan.redo_with', { name: assistant().name || t('assistant.generic') })}</Button>
      <Menu label={t('plan.slides_menu')} items={[{ id: 'final', label: t('plan.finished_pptx'), icon: 'slides', onSelect: () => onTool('finished') }, { id: 'zip', label: t('plan.download_all'), icon: 'download', onSelect: () => onTool('zip') }]}
        trigger={q => <IconButton icon="dots" label={t('plan.slides_menu')} {...q} data-focus="slides-menu" />} /></div>
    {s.notes && <p class="notes"><Icon name="note" size="sm" /><span data-raw>{s.notes}</span></p>}
    {Tools && <Tools.Shots p={p} l={l} i={cur} save={save} setCur={setCur} />}
    <ol class="strip" aria-label={t('plan.all_slides')}>{l.slides.map((x, i) => <li><button type="button" class={i === cur ? 'on' : ''} aria-current={i === cur ? 'true' : undefined} onClick={() => setCur(i)} aria-label={t('plan.slide_n', { n: i + 1 })} data-slide-i={i}>
      <Slide slide={x} lesson={l} plan={p} width={150} /></button></li>)}</ol>
  </div>;
}

function Side({ p, l, slot, per, onSave, onDownload, onAssistant, onTool, Sd }) {
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
    {Sd && <Sd.Classes p={p} l={l} />}
    {(shared.length > 0 || partners.length > 0) && <section>
      {(partners.length > 0 || shared.length > 0) && <Switch label={shared.length ? t('plan.shared_on') : t('plan.also_give', { names: partners.map(x => (classOf(p, x.classId) || {}).name || '').join(', ') })} checked={shared.length > 0} onChange={share} />}
    </section>}
    <Materials p={p} l={l} slot={slot} onSave={onSave} onTool={onTool} />
    {slot && slot.date <= today() && <AfterClass l={l} slot={slot} onSave={onSave} />}
    <section><h2 class="sub">{t('plan.comments_for', { name: ai.name || t('assistant.generic') })}</h2>
      <p class="mute">{t('plan.n_lesson_comments', { n: (l.talk || []).length })} · {t('plan.n_slide_comments', { n: talk })}</p>
      <Talk talk={l.talk || []} ai={ai.name || t('assistant.generic')} label={t('plan.comments_for', { name: ai.name || t('assistant.generic') })} onChange={v => { const n = JSON.parse(JSON.stringify(l)); if (v.length) n.talk = v; else delete n.talk; onSave(n); }} /></section>
    <div class="acts"><Button icon="assist" onClick={onAssistant} data-focus="assistant">{t('plan.work_with', { name: ai.name || t('assistant.generic') })}</Button><Button icon="download" onClick={onDownload}>{t('plan.download_slides')}</Button></div>
  </aside>;
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
  const [cur, setCur] = useState(0), [presenting, setPresenting] = useState(false), [asking, setAsking] = useState(false), [redo, setRedo] = useState(null);
  const [tool, setTool] = useState(null), [beside, setBeside] = useState(false), [note, setNote] = useState(null);
  const view = VIEWS.includes(route.params.view) ? route.params.view : 'lesson';
  const setView = v => go('lesson', route.params.id, v === 'lesson' ? '' : v);
  // Present is fetched with the page, so F5 shows it at once; the lesson's tools too; the editor when the Edit view opens; Beside when opened.
  const PresentMod = usePart('present'), Tools = usePart('tools'), EditMod = usePart('edit', view === 'edit'), Side2 = usePart('beside', beside), Pf = usePart('pfolder', arrived(l)), Sd = usePart('side2');
  const ask = i => { setRedo(typeof i === 'number' ? i : null); setAsking(true); };
  // Planned from the Calendar "with your assistant": the assistant sheet opens on arrival, once.
  useEffect(() => { try { if (l && sessionStorage.getItem('gsn.ask') === l.id) { sessionStorage.removeItem('gsn.ask'); ask(); } } catch { } }, [l && l.id]);
  const dl = () => (l.final && Tools ? (Tools.finFresh(l) ? Tools.downloadFinal(l) : setTool({ name: 'which' })) : download(p, l));
  // A tool from a menu: the ones that are only a download run at once, the others open their sheet.
  const onTool = (name, arg) => {
    if (!Tools) return;
    if (name === 'share') return Tools.shareSave(p, l);
    if (name === 'zip') return Tools.downloadAll(p, l);
    if (name === 'beside') return setBeside(b => !b);
    if (name === 'newdoc') return Tools.newDoc(p, l, save).then(id => setTool({ name: 'doc', arg: id }), saveFailed);
    setTool({ name, arg });
  };
  // A slide made elsewhere (a video from Beside) goes after the one she is on.
  const addSlide = sl => { const n = JSON.parse(JSON.stringify(l)), at2 = Math.min(cur, n.slides.length - 1) + 1; n.slides.splice(at2, 0, sl); save(n); setCur(at2); toast(t('plan.slide_added')); };
  const onStep = (what, i) => {
    if (what === 'edit') { setCur(i); return setView('edit'); }
    if (what === 'ask') return ask(i);
    const n = JSON.parse(JSON.stringify(l)), E = engine(p);
    if (what === 'dup') { n.slides.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(l.slides[i])), id: E.lid(), talk: [] }); save(n); return toast(t('plan.slide_duplicated')); }
    if (what === 'del' && n.slides.length > 1) { n.slides.splice(i, 1); save(n); toast(t('plan.slide_removed'), { undo: () => save(JSON.parse(JSON.stringify(l))) }); }
  };
  // Right-click on the lesson page: a comment for the assistant on that slide, or on the lesson with the words selected or clicked
  // (src/planner/extras.js ctxOpen, noteOpen). Shift + right-click, or in a text box, keeps the browser's own menu.
  const onContext = e => {
    if (!Tools || e.shiftKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || (e.target.closest && e.target.closest('.beside'))) return;
    e.preventDefault();
    const th = e.target.closest('[data-slide-i]'), sel = getSelection(), quote = sel && !sel.isCollapsed ? sel.toString().trim() : '';
    const i = th ? +th.dataset.slideI : e.target.closest('.stage,.ed-stage') ? cur : null;
    setNote({ x: e.clientX, y: e.clientY, i: quote ? null : i, quote: quote || (i == null ? ((e.target.closest('p,li,h2,h3,td,section') || e.target).innerText || '').trim().slice(0, 1500) : '') });
  };
  useEffect(() => {
    if (!l) return;
    const n = l.slides.length, step = d => setCur(c => Math.max(0, Math.min(n - 1, c + d)));
    const offs = [
      register({ id: 'slide-next', keys: ['arrowright', 'pagedown'], label: 'plan.next_slide', when: () => view === 'slides' && !presenting, run: () => step(1) }),
      register({ id: 'slide-prev', keys: ['arrowleft', 'pageup'], label: 'plan.prev_slide', when: () => view === 'slides' && !presenting, run: () => step(-1) }),
      register({ id: 'present', keys: 'f5', label: 'plan.present', run: () => setPresenting(true) }),
      addCommand({ id: 'lesson-present', label: () => t('plan.present_this'), group: t('cmd.group_do'), icon: 'play', run: () => setPresenting(true) }),
      addCommand({ id: 'lesson-assistant', label: () => t('plan.work_with', { name: assistant().name || t('assistant.generic') }), group: t('cmd.group_do'), icon: 'assist', run: () => ask() }),
      addCommand({ id: 'lesson-download', label: () => t('plan.download_slides'), group: t('cmd.group_do'), icon: 'download', run: dl }),
      addCommand({ id: 'lesson-beside', label: () => t('plan.beside'), group: t('cmd.group_do'), icon: 'book', run: () => setBeside(b => !b) }),
    ];
    return () => offs.forEach(f => f());
  }, [l && l.id, l && l.slides.length, l && l.final && l.final.id, view, presenting, !!Tools]);
  if (!p) return <div class="page"><div class="loading" aria-busy="true" /></div>;
  if (!l) return <div class="page"><header class="ph"><h1>{t('plan.lesson')}</h1></header><EmptyState icon="warn" title={t('plan.lesson_gone')} action={<a class="btn" href={href('calendar')}>{t('nav.calendar')}</a>} /></div>;
  const slot = slotOf(p, l), per = periodOf(p, slot);
  const n = l.slides.length;
  return <div class={'page lessonpage' + (beside ? ' with-beside' : '')} data-view={view} onContextMenu={onContext}>
    <header class="lh">
      <div class="crumbs"><a class="link" href={from && !/^lesson\//.test(from) ? '#/' + from : href('calendar')} data-focus="lesson-back"><Icon name="back" size="sm" />{per ? <><span class="dot" style={{ '--cc': toneOf(per.c.color) }} /><span data-raw>{per.c.name}</span></> : t('nav.calendar')}</a></div>
      <Segmented label={t('plan.lesson_view')} value={view} onChange={setView} options={[{ value: 'lesson', label: t('plan.lesson') }, { value: 'slides', label: t('plan.slides') }, { value: 'edit', label: t('common.edit') }]} />
      <IconButton icon="book" label={t('plan.beside')} state={beside ? 'on' : undefined} aria-pressed={String(beside)} onClick={() => setBeside(!beside)} data-focus="beside" />
      <LessonMenu p={p} l={l} save={save} onTool={onTool} extra={Sd ? Sd.slotItems(p, l, save) : []} />
    </header>
    {per && slot && <p class="mute when"><span class="dot" style={{ '--cc': toneOf(per.c.color) }} /><span data-raw>{per.c.name}</span> <span data-raw>{date(at(slot.date), { weekday: 'short', day: 'numeric', month: 'short' })}{per.m ? ', ' + (per.m.label ? per.m.label + ', ' : '') + clock(per.m.start) : ''}</span></p>}
    <h1 class="lt" data-raw>{l.title || t('plan.untitled')}</h1>
    {Tools && <Tools.VariantBar p={p} l={l} save={save} />}
    {Pf && arrived(l) && <Pf.Arrived p={p} l={l} save={save} />}
    <div class="lbar"><StateSeg l={l} slot={slot} onSave={save} /><span class="mute">{t('plan.n_slides', { n })}</span><span class="grow" />
      {!l.ready && <Button icon="timer" onClick={() => startFocus('les:' + l.id)} data-focus="lesson-focus">{t('plan.focus_lesson')}</Button>}
      <Button variant="primary" icon="play" onClick={() => setPresenting(true)} data-focus="present">{t('plan.present')}</Button></div>
    <div class={'lgrid' + (view === 'edit' ? ' edit' : '')}>
      <div class="lmain">
        {view === 'lesson' && <LessonView p={p} l={l} slot={slot} per={per} onOpenSlide={i => { setCur(i); setView('slides'); }} onStep={onStep} />}
        {view === 'slides' && <SlidesView p={p} l={l} cur={Math.min(cur, n - 1)} setCur={setCur} onAsk={ask} onTool={onTool} Tools={Tools} save={save} />}
        {view === 'edit' && (EditMod ? <EditMod.default key={l.id} p={p} l={l} cur={cur} setCur={setCur} save={save} ai={assistant().name || t('assistant.generic')} onAsk={ask} /> : <div class="loading" aria-busy="true" />)}
      </div>
      {view !== 'edit' && <Side Sd={Sd} p={p} l={l} slot={slot} per={per} onSave={save} onDownload={dl} onAssistant={() => ask()} onTool={onTool} />}
    </div>
    {Sd && <Sd.SlotSheet p={p} l={l} save={save} />}
    {beside && Side2 && <Side2.default p={p} l={l} save={save} onClose={() => setBeside(false)} onSlide={addSlide} />}
    <AssistantSheet key={asking ? 'a' + redo : 'x'} p={p} l={l} open={asking} slide={redo} onClose={() => { setAsking(false); setRedo(null); }} save={save} />
    {Tools && tool && <Tools.default name={tool.name} arg={tool.arg} p={p} l={l} slot={slot} save={save} onClose={() => setTool(null)} />}
    {Tools && note && <Tools.NotePop p={p} l={l} at={note} save={save} onClose={() => setNote(null)} />}
    {presenting && PresentMod && <PresentMod.Present p={p} l={l} className={per ? per.c.name : ''} start={view !== 'lesson' ? cur : resumeAt(l, slot)} onClose={(i, far, secs) => { setPresenting(false); if (typeof i === 'number') setCur(i); gotTo(l, slot, far, secs, save); }} />}
  </div>;
}
