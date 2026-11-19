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
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, Tabs, TextInput, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { words, kv } from '../../planning/index.js';
import { assistant } from '../../services/assistant.js';
import { engine } from '../../planning/engine.js';
import * as T from '../../engines/plantools.js';
import { savePlannerKv, dropPlannerKv } from '../../planning/write.js';
import { plannerKv, lessonBlob } from '../../planning/plan.js';
import { saveFailed } from '../plan/save.js';
import '../plan/lines.js';
import '../plan/tool-lines.js';
import '../plan/les-lines.js';
import '../plan/rev-lines.js';
import { DriveButton } from '../drive-button.jsx';
import { usePart } from '../parts.js';
import { boxAdd, CHIP_TYPE } from '../plan/cbox.js';

const TABS = ['books', 'acts', 'video', 'unit', 'notes', 'box'];
const { ytId, ytStart } = T;
// The name of the teacher's unit plan tool, when they gave one (Settings > Classes and terms); otherwise the plain word.
export const unitTool = () => { const w = words.json(null); return (w && typeof w.unit === 'string' && w.unit.trim()) || ''; };
const aiName = () => assistant().name || t('assistant.generic');

// The drawer's width, dragged at its edge (src/planner/panel.js spResize), kept for this browser (gsn.besideW) and shared with the
// page's own room through --bw.
const W_KEY = 'gsn.besideW', fitW = w => Math.round(Math.max(320, Math.min(w, Math.min(900, innerWidth - 360))));
const putW = w => { try { if (w) document.documentElement.style.setProperty('--bw', w + 'px'); else document.documentElement.style.removeProperty('--bw'); } catch { } };
function Grip() {
  useEffect(() => { let w = 0; try { w = +localStorage.getItem(W_KEY) || 0; } catch { } if (w) putW(fitW(w)); return () => putW(0); }, []);
  const down = e => {
    if (e.button !== 0) return; e.preventDefault(); const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const move = ev => putW(fitW(innerWidth - 8 - ev.clientX));
    const up = ev => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); const w = fitW(innerWidth - 8 - ev.clientX); putW(w); try { localStorage.setItem(W_KEY, String(w)); } catch { } };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  };
  const key = e => { const cur = document.querySelector('aside.beside').getBoundingClientRect().width, k = e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0; if (!k) return; e.preventDefault(); const w = fitW(cur + k); putW(w); try { localStorage.setItem(W_KEY, String(w)); } catch { } };
  return <div class="bgrip" role="separator" aria-orientation="vertical" aria-label={t('les.beside_width')} tabIndex={-1} onPointerDown={down} onKeyDown={key} data-grip />;
}

export default function Beside({ p, l, u, week, save, onClose, onSlide }) {
  const [tab, setTab] = useState(() => { try { const v = sessionStorage.getItem('gsn.beside'); return TABS.includes(v) ? v : 'books'; } catch { return 'books'; } });
  const pick = v => { setTab(v); try { sessionStorage.setItem('gsn.beside', v); } catch { } };
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
      {tab === 'books' && <Books l={l} save={save} incoming={pdfIn} onTaken={() => setPdfIn(null)} />}
      {tab === 'acts' && B2 && <B2.Acts p={p} l={l} onSlide={onSlide} />}
      {tab === 'video' && <Video p={p} l={l} save={save} onSlide={onSlide} incoming={vidIn} onTaken={() => setVidIn('')} />}
      {tab === 'unit' && <Unit p={p} l={l} u={u} week={week} tool={tool} />}
      {tab === 'notes' && Nb && <Nb.Notebook key={l ? 'lesson' : u ? 'u' + u.id : 'g'} p={p} l={l} u={u} save={save} />}
      {tab === 'box' && Bx && <Bx.Box p={p} T={T} E={engine(p)} />}
    </div>
  </aside>;
}

/* ---------- Books ---------- */
let lib = null;
const pdfLib = () => lib || (lib = PARTS.pdf().then(m => m.pdfjs()));
function Books({ l, save, incoming, onTaken }) {
  const [list, setList] = useState(null), [open, setOpen] = useState(null);
  const read = () => plannerKv('pdfs').then(v => setList(Array.isArray(v) ? v : []));
  useEffect(() => { read(); }, []);
  useEffect(() => { if (incoming) { onTaken(); add(incoming); } }, [incoming]);
  const add = async f => {
    if (!f) return; if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return toast(t('tool.pdf_only'));
    try { const id = Math.random().toString(36).slice(2, 10), cur = (await kv.get('pdfs')) || []; await savePlannerKv('pdf:' + id, f); await savePlannerKv('pdfs', [...cur, { id, name: f.name.replace(/\.pdf$/i, ''), pages: 0 }]); read(); }
    catch (e) { saveFailed(e); }
  };
  const remove = async x => {
    let b, cur;
    try { b = await kv.get('pdf:' + x.id); cur = (await kv.get('pdfs')) || []; await savePlannerKv('pdfs', cur.filter(y => y.id !== x.id)); await dropPlannerKv('pdf:' + x.id); read(); } catch (e) { return saveFailed(e); }
    toast(t('tool.book_removed', { name: x.name }), { undo: async () => { try { if (b) await savePlannerKv('pdf:' + x.id, b); await savePlannerKv('pdfs', [...((await kv.get('pdfs')) || []), x]); read(); } catch (e) { saveFailed(e); } } });
  };
  if (open) return <Book book={open} l={l} save={save} onBack={() => { setOpen(null); read(); }} />;
  return <div class="books">
    <h3 class="sub">{t('tool.your_books')}</h3>
    {list && !list.length && <p class="mute">{t('tool.no_books')}</p>}
    <ul class="mlist">{(list || []).map(x => <li><button type="button" class="link mopen" onClick={() => setOpen(x)} data-book={x.id}><Icon name="file" size="sm" /><span data-raw>{x.name}</span></button>
      {x.pages > 0 && <small class="mute">{t('tool.n_pages', { n: x.pages })}</small>}<IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(x)} /></li>)}</ul>
    <label class="btn sm"><Icon name="upload" />{t('tool.add_pdf')}<input type="file" class="vh" accept="application/pdf,.pdf" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; add(f); }} data-addpdf /></label><DriveButton />
    <p class="mute small">{t('tool.books_here')}</p>
  </div>;
}
function Book({ book, l, save, onBack }) {
  const [pdf, setPdf] = useState(null), [page, setPage] = useState(1), [outline, setOutline] = useState(null), [view, setView] = useState('page'), [q, setQ] = useState(''), [hits, setHits] = useState(null);
  const canvas = useRef(), texts = useRef({}), wrap = useRef();
  useEffect(() => {
    let on = true;
    (async () => {
      const b = await plannerKv('pdf:' + book.id); if (!b) { toast(t('tool.book_missing')); return onBack(); }
      try {
        const L = await pdfLib(), doc = await L.getDocument({ data: new Uint8Array(await b.arrayBuffer()), isEvalSupported: false }).promise; if (!on) return;
        setPdf(doc); const last = +(await plannerKv('pdfpg:' + book.id)) || 1; setPage(Math.min(Math.max(1, last), doc.numPages));
        if (!book.pages) { const cur = (await kv.get('pdfs').catch(() => null)) || [], x = cur.find(y => y.id === book.id); if (x) { x.pages = doc.numPages; await savePlannerKv('pdfs', cur).catch(() => {}); } }
        setOutline(await outlineOf(doc));
      } catch (e) { console.warn(e); toast(t('tool.book_unread')); onBack(); }
    })();
    return () => { on = false; };
  }, [book.id]);
  // The page drawn as wide as the drawer.
  useEffect(() => {
    if (!pdf || !canvas.current || view !== 'page') return;
    let task = null, on = true;
    pdf.getPage(page).then(pg => {
      if (!on) return;
      const w = (wrap.current && wrap.current.clientWidth) || 380, v1 = pg.getViewport({ scale: 1 }), k = w / v1.width, ratio = window.devicePixelRatio || 1, vp = pg.getViewport({ scale: k * ratio });
      const c = canvas.current; c.width = vp.width; c.height = vp.height; c.style.width = Math.round(vp.width / ratio) + 'px';
      task = pg.render({ canvasContext: c.getContext('2d'), viewport: vp }); task.promise.catch(() => {});
    });
    savePlannerKv('pdfpg:' + book.id, page).catch(() => {});
    return () => { on = false; if (task) task.cancel(); };
  }, [pdf, page, view]);
  const textOf = async n => { if (texts.current[n] != null) return texts.current[n]; const tc = await (await pdf.getPage(n)).getTextContent(); let s = '', y = null;
    for (const it of tc.items) { const yy = it.transform ? Math.round(it.transform[5]) : y; if (y != null && yy !== y) s += '\n'; else if (s && !/\s$/.test(s)) s += ' '; s += it.str; y = yy; }
    return (texts.current[n] = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()); };
  const find = async () => {
    const ql = q.trim().toLowerCase(); if (!ql || !pdf) { setHits(null); return; }
    setView('toc'); setHits('…'); const out = [];
    for (let i = 1; i <= pdf.numPages; i++) { const s = await textOf(i), k = s.toLowerCase().indexOf(ql); if (k >= 0) out.push({ p: i, snip: s.slice(Math.max(0, k - 30), k + ql.length + 50).replace(/\s+/g, ' ') }); }
    setHits(out);
  };
  // This page into the assistant box (panel.js pagebox), named after the contents line it falls under.
  const chipOf = (n, title) => ({ kind: 'page', book: book.id, page: n, title: title || 'p. ' + n, bookName: book.name, label: book.name + ', ' + (title ? title + ' (p. ' + n + ')' : 'p. ' + n) }); // not-words
  const under = n => { const all = (outline || []).flatMap(function f(x) { return [x, ...(x.items || []).flatMap(f)]; }).filter(x => x.page && x.page <= n); return all.length ? all[all.length - 1].title : ''; };
  const toAssistant = async () => { const s = await textOf(page).catch(() => ''); boxAdd({ ...chipOf(page, under(page)), text: s }); };
  const drag = (n, title) => e => { e.dataTransfer.setData(CHIP_TYPE, JSON.stringify(chipOf(n, title))); e.dataTransfer.effectAllowed = 'copy'; };
  const go = n => { setPage(Math.max(1, Math.min(pdf ? pdf.numPages : 1, n))); setView('page'); };
  const Item = ({ o, d }) => <><button type="button" class="toci" style={{ paddingLeft: 6 + d * 12 + 'px' }} disabled={!o.page} onClick={() => go(o.page)} draggable={!!o.page} onDragStart={o.page ? drag(o.page, o.title) : undefined}><span data-raw>{o.title}</span>{o.page > 0 && <small class="mute">{t('tool.page_short', { n: o.page })}</small>}</button>{o.items.map(x => <Item o={x} d={d + 1} />)}</>;
  return <div class="book" ref={wrap}>
    <div class="row"><Button size="sm" variant="quiet" icon="back" onClick={onBack}>{t('tool.books')}</Button><b class="grow" data-raw>{book.name}</b></div>
    <div class="row"><TextInput label={t('tool.search_book')} icon="search" value={q} onInput={setQ} onKeyDown={e => { if (e.key === 'Enter') find(); }} data-focus="book-find" />
      <Button size="sm" state={view === 'toc' ? 'on' : undefined} onClick={() => setView(view === 'toc' ? 'page' : 'toc')} data-focus="book-toc">{t('tool.contents')}</Button></div>
    {view === 'toc' ? <div class="toc">
      {hits === '…' ? <p class="mute">{t('tool.searching')}</p> : hits ? <><p class="mute">{t('tool.n_hits', { n: hits.length, q })}</p>{hits.map(x => <button type="button" class="toci" onClick={() => go(x.p)}><small class="mute">{t('tool.page_short', { n: x.p })}</small> <span data-raw>{x.snip}</span></button>)}</>
        : !outline ? <p class="mute">{t('tool.reading_contents')}</p> : !outline.length ? <p class="mute">{t('tool.no_contents')}</p> : outline.map(o => <Item o={o} d={0} />)}
    </div> : <div class="pageview">
      <div class="row"><IconButton icon="chl" label={t('plan.prev_slide')} disabled={page <= 1} onClick={() => go(page - 1)} /><span class="num">{t('tool.page_of', { n: page, of: pdf ? pdf.numPages : '…' })}</span>
        <IconButton icon="chr" label={t('tool.next_page')} disabled={!pdf || page >= pdf.numPages} onClick={() => go(page + 1)} /><span class="grow" /><Button size="sm" icon="assist" onClick={toAssistant} data-focus="page-to-ai">{t('les.to_box', { name: aiName() })}</Button></div>
      <canvas ref={canvas} draggable onDragStart={drag(page, under(page))} class="pdfpage" aria-label={t('tool.page_of', { n: page, of: pdf ? pdf.numPages : '…' })} />
    </div>}
  </div>;
}
async function outlineOf(pdf) {
  let o; try { o = await pdf.getOutline(); } catch { o = null; }
  if (!o) return [];
  const walk = items => Promise.all(items.map(async it => { let page = 0;
    try { const dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest; if (dest && dest[0]) page = (await pdf.getPageIndex(dest[0])) + 1; } catch { }
    return { title: String(it.title || '').trim(), page, items: it.items && it.items.length ? await walk(it.items) : [] }; }));
  return walk(o);
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
