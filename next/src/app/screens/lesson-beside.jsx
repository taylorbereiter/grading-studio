// The Beside drawer (design: Lesson > Beside): what the current Planner's side panel holds (src/planner/panel.js, notebook.js),
// on the right of the lesson page, loaded when first opened (router.js PARTS.beside).
//   Books       the teacher's own PDFs, kept in this browser (kv "pdfs", "pdf:<id>", "pdfpg:<id>"): pages, the PDF's own contents,
//               search, and a page's words sent to the assistant as a comment on the lesson
//   Video       a YouTube link plays here (youtube-nocookie); words search YouTube in a new tab, as YouTube allows no search inside
//               other sites; a video can go on a new slide or to the assistant
//   Curriculum  the unit the lesson is in: its week, standards and notes, the unit plan link (opens in its own tab, as it needs its own
//               sign-in) and the unit's screenshots of the unit plan
//   Notebook    the lesson's own notes (lesson.notebook) or the general page (kv "nb:general"): bold, italic, underline, lists, links,
//               pictures, YouTube players, dictation; saved as you type
// Planning material only. A comment for the assistant is kept on the lesson, so it goes with the lesson's message.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, IconButton, Icon, Tabs, TextInput } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { savePanel } from '../../planning/panel.js';
import { stpPanelRecord, stpPanelWidth } from '../../engines/gpanel.js';
import { words } from '../../planning/index.js';
import { assistant } from '../../services/assistant.js';
import { engine } from '../../planning/engine.js';
import * as T from '../../engines/plantools.js';
import { lessonBlob } from '../../planning/plan.js';
import { saveFailed } from '../plan/save.js';
import '../plan/lines.js';
import '../plan/tool-lines.js';
import '../plan/les-lines.js';
import '../plan/rev-lines.js';
import { usePart } from '../parts.js';
import { boxAdd, CHIP_TYPE } from '../plan/cbox.js';

const TABS = ['books', 'acts', 'video', 'unit', 'notes', 'box'];
const { ytId, ytStart } = T;
// The name of the teacher's unit plan tool, when they gave one (Settings > Classes and terms); otherwise the plain word.
export const unitTool = () => { const w = words.json(null); return (w && typeof w.unit === 'string' && w.unit.trim()) || ''; };
const aiName = () => assistant().name || t('assistant.generic');

// The classic Planner keeps this width alongside its open tab and other panel choices.
const fitW = w => Math.round(Math.max(300, Math.min(w, Math.min(900, innerWidth - 360))));
const putW = w => { try { if (w) document.documentElement.style.setProperty('--bw', w + 'px'); else document.documentElement.style.removeProperty('--bw'); } catch { } };
function Grip() {
  useEffect(() => {
    try { const w = stpPanelWidth(); if (w != null) putW(fitW(w)); } catch { }
    return () => putW(0);
  }, []);
  const keep = width => {
    putW(width);
    try { savePanel({ ...stpPanelRecord(), w: width }); } catch (e) { saveFailed(e); }
  };
  const down = e => {
    if (e.button !== 0) return; e.preventDefault(); const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const move = ev => putW(fitW(innerWidth - 8 - ev.clientX));
    const up = ev => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); const w = fitW(innerWidth - 8 - ev.clientX); keep(w); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  };
  const key = e => { const cur = document.querySelector('aside.beside').getBoundingClientRect().width, k = e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0; if (!k) return; e.preventDefault(); const w = fitW(cur + k); keep(w); };
  return <div class="bgrip" role="separator" aria-orientation="vertical" aria-label={t('les.beside_width')} tabIndex={-1} onPointerDown={down} onKeyDown={key} data-grip />;
}

export default function Beside({ p, l, u, week, save, onClose, onSlide }) {
  const [tab, setTab] = useState(() => { try { const v = sessionStorage.getItem('gsn.beside'); return TABS.includes(v) ? v : 'books'; } catch { return 'books'; } });
  const pick = v => { setTab(v); try { sessionStorage.setItem('gsn.beside', v); } catch { } };
  const bookPart = usePart('besideBooks', tab === 'books');
  const tool = unitTool(), B2 = usePart('beside2', tab === 'acts'), Bx = usePart('box', tab === 'box'), Nb = usePart('nb', tab === 'notes'), [pdfIn, setPdfIn] = useState(null), [vidIn, setVidIn] = useState('');
  // A PDF dropped on the drawer goes to Books, a YouTube link to Video (src/planner/panel.js spDrop).
  const over = e => { const d = e.dataTransfer; if (d && [...d.types].some(x => x === 'Files' || x === 'text/uri-list' || x === 'text/plain')) { e.preventDefault(); e.stopPropagation(); } };
  const drop = e => {
    const d = e.dataTransfer; if (!d) return;
    const f = [...(d.files || [])].find(x => /\.pdf$/i.test(x.name) || x.type === 'application/pdf');
    if (f) { e.preventDefault(); e.stopPropagation(); pick('books'); setPdfIn(f); return; }
    // A slide dragged from the editor, or a chip (a file in Materials, a book page), goes in the assistant box.
    const sl = d.getData('text/x-slide'), chip = d.getData(CHIP_TYPE);
    if (chip || (sl !== '' && l && l.slides[+sl])) { e.preventDefault(); e.stopPropagation(); pick('box');
      return boxAdd(chip ? JSON.parse(chip) : { kind: 'slide', lesson: l.id, i: +sl, label: (l.title || 'Lesson') + ', slide ' + (+sl + 1) + (l.slides[+sl].title ? ': ' + l.slides[+sl].title : '') }); } // not-words
    const u = (d.getData('text/uri-list') || d.getData('text/plain') || '').split(/\s+/)[0];
    if (u && ytId(u)) { e.preventDefault(); e.stopPropagation(); pick('video'); setVidIn(u); }
  };
  return <aside class="beside" aria-label={t('tool.beside')} onDragOver={over} onDrop={drop}>
    <Grip />
    <div class="bhead"><Tabs label={t('tool.beside')} value={tab} onChange={pick} tabs={[{ id: 'books', label: t('tool.books') }, { id: 'acts', label: t('plan.lib_activities') }, { id: 'video', label: t('tool.video') }, { id: 'unit', label: tool || t('tool.curriculum') }, { id: 'notes', label: t('tool.notebook') }, { id: 'box', label: assistant().name || t('les.box_tab') }]} />
      <IconButton icon="x" label={t('common.close')} onClick={onClose} data-focus="beside-close" /></div>
    <div class="bbody">
      {tab === 'books' && bookPart && <bookPart.Books assistantName={aiName()} incoming={pdfIn} onTaken={() => setPdfIn(null)} />}
      {tab === 'acts' && B2 && <B2.Acts p={p} l={l} onSlide={onSlide} />}
      {tab === 'video' && <Video p={p} l={l} save={save} onSlide={onSlide} incoming={vidIn} onTaken={() => setVidIn('')} />}
      {tab === 'unit' && <Unit p={p} l={l} u={u} week={week} tool={tool} />}
      {tab === 'notes' && Nb && <Nb.Notebook key={l ? 'lesson' : u ? 'u' + u.id : 'g'} p={p} l={l} u={u} save={save} />}
      {tab === 'box' && Bx && <Bx.Box p={p} T={T} E={engine(p)} />}
    </div>
  </aside>;
}

/* ---------- Video ---------- */
function Video({ p, l, save, onSlide, incoming, onTaken }) {
  const [v, setV] = useState(''), [url, setUrl] = useState('');
  useEffect(() => { if (incoming) { setV(incoming); setUrl(incoming); onTaken(); } }, [incoming]);
  const goTo = () => { const s = v.trim(); if (!s) return; if (/^https?:\/\//.test(s)) setUrl(s); else window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(s), '_blank', 'noopener'); };
  const id = ytId(url), st = ytStart(url);
  return <div class="video">
    <div class="row"><TextInput label={t('tool.video_find')} value={v} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') goTo(); }} data-focus="video-find" /><Button size="sm" onClick={goTo} data-focus="video-go">{t('tool.go')}</Button></div>
    {id ? <><div class="vidbox"><iframe src={'https://www.youtube-nocookie.com/embed/' + id + (st ? '?start=' + st : '')} title={t('tool.video')} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
      <div class="row"><Button size="sm" icon="slides" onClick={async () => { const x = await T.videoFrom(url); onSlide && onSlide(engine(p).normSlide({ layout: 'video', title: x.title || t('tool.video'), video: x, fmt: 2 })); }} data-focus="video-slide">{t('tool.put_on_slide')}</Button>
        <Button size="sm" icon="assist" onClick={() => boxAdd({ kind: 'video', url, label: 'Video: ' + url })} data-focus="video-to-box">{t('les.to_box', { name: aiName() })}</Button><a class="btn sm quiet" href={url} target="_blank" rel="noopener">{t('tool.on_youtube')}<Icon name="arrow" size="xs" /></a></div></> // not-words
      : url ? <p class="mute">{t('tool.not_youtube')}</p> : <p class="mute">{t('tool.video_help')}</p>}
  </div>;
}

/* ---------- Curriculum: the unit the lesson is in ---------- */
function Shot({ f }) {
  const [u, setU] = useState('');
  useEffect(() => { let url = ''; lessonBlob(f.id).then(b => { if (b && /^image\//.test(b.type || f.type)) { url = URL.createObjectURL(b); setU(url); } }); return () => url && URL.revokeObjectURL(url); }, [f.id]);
  return u ? <a class="shot" href={u} target="_blank" rel="noopener"><img src={u} alt={f.name} data-raw /></a> : null;
}
// The lesson's unit; on a unit's page that unit (its week now, when it is running); elsewhere each course's unit in the week shown
// (src/planner/panel.js atlasHtml).
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function Unit({ p, l, u, week, tool }) {
  const E = engine(p), mon = ymd(E.mondayOf(week ? new Date(week + 'T12:00:00') : new Date()));
  const hits = l ? [T.lessonUnit(l)].filter(Boolean) : u ? [(x => x && x.u.id === u.id ? x : { u, n: -1 })(E.unitAt(u.course, mon))]
    : [...new Set((p.units || []).map(x => x && x.course).filter(Boolean))].map(c => E.unitAt(c, mon)).filter(Boolean);
  if (!hits.length) return <p class="mute">{l ? t('tool.no_unit') : t('rev.no_unit_week')}</p>;
  return <div class="unitside">{hits.map(({ u: un, n }) => { const w = n >= 0 ? un.weeks[n] : null;
    return <section data-unitside={un.id}><h3 class="sub" data-raw>{un.title}</h3>
      {un.atlas && <><a class="btn sm" href={un.atlas} target="_blank" rel="noopener">{tool ? t('tool.open_named', { name: tool }) : t('tool.open_unit_plan')}<Icon name="arrow" size="xs" /></a><p class="mute small">{t('tool.unit_tab')}</p></>}
      {w && <div class="wk"><b>{t('tool.week_of_n', { n: n + 1, of: un.weeks.length })}</b>{w.focus && <p data-raw>{w.focus}</p>}{w.standards && <p class="mute" data-raw>{w.standards}</p>}{w.notes && <p class="mute" data-raw>{w.notes}</p>}
        <Button size="sm" icon="assist" onClick={() => boxAdd({ kind: 'week', label: un.title + ', week ' + (n + 1) + ' of ' + un.weeks.length, unit: un.title, n: n + 1, of: un.weeks.length, text: [w.focus && 'Focus: ' + w.focus, w.standards && 'Standards: ' + w.standards, w.notes && 'Notes: ' + w.notes].filter(Boolean).join('\n') })} data-focus="week-to-box">{t('les.to_box', { name: aiName() })}</Button></div>} {/* not-words */}
      <div class="shots">{(un.files || []).filter(f => f.kind === 'atlas').map(f => <Shot f={f} />)}</div></section>; })}
  </div>;
}
