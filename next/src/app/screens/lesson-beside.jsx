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
import { Mic } from '../../ui/services.jsx';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { words } from '../../planning/index.js';
import { assistant } from '../../services/assistant.js';
import { engine } from '../../planning/engine.js';
import * as T from '../../engines/plantools.js';
import { savePlannerKv, dropPlannerKv } from '../../planning/write.js';
import { plannerKv, lessonBlob } from '../../planning/plan.js';
import { saveFailed } from '../plan/save.js';
import '../plan/lines.js';
import '../plan/tool-lines.js';

const copy = x => JSON.parse(JSON.stringify(x));
const TABS = ['books', 'video', 'unit', 'notes'];
const esc = s => String(s).replace(/[&"><]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const { ytId, ytStart } = T;
// The name of the teacher's unit plan tool, when they gave one (Settings > Classes and terms); otherwise the plain word.
export const unitTool = () => { const w = words.json(null); return (w && typeof w.unit === 'string' && w.unit.trim()) || ''; };
// A comment for the assistant on the whole lesson (src/planner/panel.js boxAdd, kept with the lesson as review.js keeps "talk").
const tell = (l, save, text) => { const n = copy(l); n.talk = [...(n.talk || []), { by: 'you', text, at: Date.now() }]; save(n); toast(t('tool.told', { name: aiName() })); };
const aiName = () => assistant().name || t('assistant.generic');

export default function Beside({ p, l, save, onClose, onSlide }) {
  const [tab, setTab] = useState(() => { try { const v = sessionStorage.getItem('gsn.beside'); return TABS.includes(v) ? v : 'books'; } catch { return 'books'; } });
  const pick = v => { setTab(v); try { sessionStorage.setItem('gsn.beside', v); } catch { } };
  const tool = unitTool();
  return <aside class="beside" aria-label={t('tool.beside')}>
    <div class="bhead"><Tabs label={t('tool.beside')} value={tab} onChange={pick} tabs={[{ id: 'books', label: t('tool.books') }, { id: 'video', label: t('tool.video') }, { id: 'unit', label: tool || t('tool.curriculum') }, { id: 'notes', label: t('tool.notebook') }]} />
      <IconButton icon="x" label={t('common.close')} onClick={onClose} data-focus="beside-close" /></div>
    <div class="bbody">
      {tab === 'books' && <Books l={l} save={save} />}
      {tab === 'video' && <Video p={p} l={l} save={save} onSlide={onSlide} />}
      {tab === 'unit' && <Unit p={p} l={l} save={save} tool={tool} />}
      {tab === 'notes' && <Notebook p={p} l={l} save={save} />}
    </div>
  </aside>;
}

/* ---------- Books ---------- */
let lib = null;
const pdfLib = () => lib || (lib = PARTS.pdf().then(m => m.pdfjs()));
function Books({ l, save }) {
  const [list, setList] = useState(null), [open, setOpen] = useState(null);
  const read = () => plannerKv('pdfs').then(v => setList(Array.isArray(v) ? v : []));
  useEffect(() => { read(); }, []);
  const add = async f => {
    if (!f) return; if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return toast(t('tool.pdf_only'));
    try { const id = Math.random().toString(36).slice(2, 10), cur = (await plannerKv('pdfs')) || []; await savePlannerKv('pdf:' + id, f); await savePlannerKv('pdfs', [...cur, { id, name: f.name.replace(/\.pdf$/i, ''), pages: 0 }]); read(); }
    catch (e) { saveFailed(e); }
  };
  const remove = async x => {
    const b = await plannerKv('pdf:' + x.id), cur = (await plannerKv('pdfs')) || [];
    try { await savePlannerKv('pdfs', cur.filter(y => y.id !== x.id)); await dropPlannerKv('pdf:' + x.id); read(); } catch (e) { return saveFailed(e); }
    toast(t('tool.book_removed', { name: x.name }), { undo: async () => { if (b) await savePlannerKv('pdf:' + x.id, b); await savePlannerKv('pdfs', [...((await plannerKv('pdfs')) || []), x]); read(); } });
  };
  if (open) return <Book book={open} l={l} save={save} onBack={() => { setOpen(null); read(); }} />;
  return <div class="books">
    <h3 class="sub">{t('tool.your_books')}</h3>
    {list && !list.length && <p class="mute">{t('tool.no_books')}</p>}
    <ul class="mlist">{(list || []).map(x => <li><button type="button" class="link mopen" onClick={() => setOpen(x)} data-book={x.id}><Icon name="file" size="sm" /><span data-raw>{x.name}</span></button>
      {x.pages > 0 && <small class="mute">{t('tool.n_pages', { n: x.pages })}</small>}<IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(x)} /></li>)}</ul>
    <label class="btn sm"><Icon name="upload" />{t('tool.add_pdf')}<input type="file" class="vh" accept="application/pdf,.pdf" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; add(f); }} data-addpdf /></label>
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
        if (!book.pages) { const cur = (await plannerKv('pdfs')) || [], x = cur.find(y => y.id === book.id); if (x) { x.pages = doc.numPages; await savePlannerKv('pdfs', cur).catch(() => {}); } }
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
  const toAssistant = async () => { const s = await textOf(page).catch(() => ''); tell(l, save, '[' + book.name + ', page ' + page + ']\n' + (s || '')); }; // not-words
  const go = n => { setPage(Math.max(1, Math.min(pdf ? pdf.numPages : 1, n))); setView('page'); };
  const Item = ({ o, d }) => <><button type="button" class="toci" style={{ paddingLeft: 6 + d * 12 + 'px' }} disabled={!o.page} onClick={() => go(o.page)}><span data-raw>{o.title}</span>{o.page > 0 && <small class="mute">{t('tool.page_short', { n: o.page })}</small>}</button>{o.items.map(x => <Item o={x} d={d + 1} />)}</>;
  return <div class="book" ref={wrap}>
    <div class="row"><Button size="sm" variant="quiet" icon="back" onClick={onBack}>{t('tool.books')}</Button><b class="grow" data-raw>{book.name}</b></div>
    <div class="row"><TextInput label={t('tool.search_book')} icon="search" value={q} onInput={setQ} onKeyDown={e => { if (e.key === 'Enter') find(); }} data-focus="book-find" />
      <Button size="sm" state={view === 'toc' ? 'on' : undefined} onClick={() => setView(view === 'toc' ? 'page' : 'toc')} data-focus="book-toc">{t('tool.contents')}</Button></div>
    {view === 'toc' ? <div class="toc">
      {hits === '…' ? <p class="mute">{t('tool.searching')}</p> : hits ? <><p class="mute">{t('tool.n_hits', { n: hits.length, q })}</p>{hits.map(x => <button type="button" class="toci" onClick={() => go(x.p)}><small class="mute">{t('tool.page_short', { n: x.p })}</small> <span data-raw>{x.snip}</span></button>)}</>
        : !outline ? <p class="mute">{t('tool.reading_contents')}</p> : !outline.length ? <p class="mute">{t('tool.no_contents')}</p> : outline.map(o => <Item o={o} d={0} />)}
    </div> : <div class="pageview">
      <div class="row"><IconButton icon="chl" label={t('plan.prev_slide')} disabled={page <= 1} onClick={() => go(page - 1)} /><span class="num">{t('tool.page_of', { n: page, of: pdf ? pdf.numPages : '…' })}</span>
        <IconButton icon="chr" label={t('tool.next_page')} disabled={!pdf || page >= pdf.numPages} onClick={() => go(page + 1)} /><span class="grow" /><Button size="sm" icon="assist" onClick={toAssistant} data-focus="page-to-ai">{t('tool.page_to_ai', { name: aiName() })}</Button></div>
      <canvas ref={canvas} class="pdfpage" aria-label={t('tool.page_of', { n: page, of: pdf ? pdf.numPages : '…' })} />
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
function Video({ p, l, save, onSlide }) {
  const [v, setV] = useState(''), [url, setUrl] = useState('');
  const goTo = () => { const s = v.trim(); if (!s) return; if (/^https?:\/\//.test(s)) setUrl(s); else window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(s), '_blank', 'noopener'); };
  const id = ytId(url), st = ytStart(url);
  return <div class="video">
    <div class="row"><TextInput label={t('tool.video_find')} value={v} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') goTo(); }} data-focus="video-find" /><Button size="sm" onClick={goTo} data-focus="video-go">{t('tool.go')}</Button></div>
    {id ? <><div class="vidbox"><iframe src={'https://www.youtube-nocookie.com/embed/' + id + (st ? '?start=' + st : '')} title={t('tool.video')} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
      <div class="row"><Button size="sm" icon="slides" onClick={async () => { const x = await T.videoFrom(url); onSlide && onSlide(engine(p).normSlide({ layout: 'video', title: x.title || t('tool.video'), video: x, fmt: 2 })); }} data-focus="video-slide">{t('tool.put_on_slide')}</Button>
        <Button size="sm" icon="assist" onClick={() => tell(l, save, '[Video: ' + url + ']')}>{t('tool.to_ai', { name: aiName() })}</Button><a class="btn sm quiet" href={url} target="_blank" rel="noopener">{t('tool.on_youtube')}<Icon name="arrow" size="xs" /></a></div></> // not-words
      : url ? <p class="mute">{t('tool.not_youtube')}</p> : <p class="mute">{t('tool.video_help')}</p>}
  </div>;
}

/* ---------- Curriculum: the unit the lesson is in ---------- */
function Shot({ f }) {
  const [u, setU] = useState('');
  useEffect(() => { let url = ''; lessonBlob(f.id).then(b => { if (b && /^image\//.test(b.type || f.type)) { url = URL.createObjectURL(b); setU(url); } }); return () => url && URL.revokeObjectURL(url); }, [f.id]);
  return u ? <a class="shot" href={u} target="_blank" rel="noopener"><img src={u} alt={f.name} data-raw /></a> : null;
}
function Unit({ p, l, save, tool }) {
  engine(p);
  const hit = T.lessonUnit(l);
  if (!hit) return <p class="mute">{t('tool.no_unit')}</p>;
  const { u, n } = hit, w = u.weeks[n];
  return <div class="unitside">
    <h3 class="sub" data-raw>{u.title}</h3>
    {u.atlas && <><a class="btn sm" href={u.atlas} target="_blank" rel="noopener">{tool ? t('tool.open_named', { name: tool }) : t('tool.open_unit_plan')}<Icon name="arrow" size="xs" /></a><p class="mute small">{t('tool.unit_tab')}</p></>}
    {w && <div class="wk"><b>{t('tool.week_of_n', { n: n + 1, of: u.weeks.length })}</b>{w.focus && <p data-raw>{w.focus}</p>}{w.standards && <p class="mute" data-raw>{w.standards}</p>}{w.notes && <p class="mute" data-raw>{w.notes}</p>}
      <Button size="sm" icon="assist" onClick={() => tell(l, save, '[' + u.title + ', week ' + (n + 1) + ']\n' + [w.focus, w.standards, w.notes].filter(Boolean).join('\n'))}>{t('tool.to_ai', { name: aiName() })}</Button></div>} {/* not-words */}
    <div class="shots">{(u.files || []).filter(f => f.kind === 'atlas').map(f => <Shot f={f} />)}</div>
  </div>;
}

/* ---------- Notebook ---------- */
function Notebook({ p, l, save }) {
  const [general, setGeneral] = useState(false), [state, setState] = useState(''), [ask, setAsk] = useState(null), [askV, setAskV] = useState('');
  const pg = useRef(), timer = useRef(0), range = useRef(null), lRef = useRef(l); lRef.current = l;
  const players = el => { for (const v of el.querySelectorAll('.nb-vid')) if (v.getAttribute('contenteditable') !== 'false') { v.contentEditable = 'false'; v.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(v.dataset.yt) + (v.dataset.t ? '?start=' + esc(v.dataset.t) : '') + '" title="' + esc(t('tool.video')) + '" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'; } };
  useEffect(() => {
    let on = true;
    (async () => { const html = general ? String((await plannerKv('nb:general')) || '') : lRef.current.notebook || ''; if (on && pg.current) { pg.current.innerHTML = T.nbClean(html); players(pg.current); } })();
    return () => { on = false; if (timer.current) { clearTimeout(timer.current); flush(general); } };
  }, [general, l.id]);
  const stored = el => { const c = el.cloneNode(true); for (const v of c.querySelectorAll('.nb-vid')) { v.removeAttribute('contenteditable'); v.innerHTML = ''; } return T.nbClean(c.innerHTML); };
  const flush = async gen => {
    timer.current = 0; if (!pg.current) return;
    const html = stored(pg.current), empty = !T.nbText(html).trim() && !/<img|nb-vid/.test(html);
    try {
      if (gen) await savePlannerKv('nb:general', empty ? '' : html);
      else { const n = copy(lRef.current); if (empty) delete n.notebook; else n.notebook = html; if ((n.notebook || '') !== (lRef.current.notebook || '')) await save(n); }
      setState('saved');
    } catch (e) { saveFailed(e); }
  };
  const changed = () => { setState('saving'); clearTimeout(timer.current); timer.current = setTimeout(() => flush(general), 500); };
  const sel = () => { const s = getSelection(), el = pg.current; return el && s.rangeCount && el.contains(s.getRangeAt(0).commonAncestorContainer) ? s.getRangeAt(0).cloneRange() : null; };
  const focus = () => { const el = pg.current; el.focus(); const s = getSelection(); s.removeAllRanges(); if (range.current && el.contains(range.current.commonAncestorContainer)) s.addRange(range.current); else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.addRange(r); } };
  const cmd = c => { if (document.activeElement !== pg.current) focus(); document.execCommand({ ul: 'insertUnorderedList', ol: 'insertOrderedList' }[c] || c); changed(); };
  const insert = html => { focus(); document.execCommand('insertHTML', false, html); players(pg.current); range.current = sel(); changed(); };
  const addUrl = () => {
    let u = askV.trim(); if (/^www\./i.test(u)) u = 'https://' + u; setAsk(null); setAskV('');
    if (!/^(https?:\/\/|mailto:)\S+$/i.test(u)) return toast(t('plan.link_bad'));
    if (ask === 'video' && ytId(u)) return insert('<div class="nb-vid" data-yt="' + ytId(u) + '"' + (ytStart(u) ? ' data-t="' + ytStart(u) + '"' : '') + '></div><p><br></p>');
    if (ask === 'video') toast(t('tool.not_youtube'));
    const r = range.current; if (r && !r.collapsed) { focus(); document.execCommand('createLink', false, u); for (const a of pg.current.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener'; } return changed(); }
    insert('<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>&nbsp;');
  };
  const pic = async f => { if (!f || !/^image\//.test(f.type)) return; try { const x = await T.shrinkPic(f); insert('<img src="' + x.src + '" alt="">'); } catch { toast(t('tool.pic_unread')); } };
  const B = (c, line, cls) => <button type="button" class={'btn sm quiet nb-' + c + (cls ? ' ' + cls : '')} onMouseDown={e => { e.preventDefault(); cmd(c); }} data-nb={c}>{t(line)}</button>;
  return <div class="nb">
    <div class="row"><b class="grow">{general ? t('tool.nb_general') : t('tool.nb_lesson')}</b><Button size="sm" variant="quiet" onClick={() => { if (timer.current) { clearTimeout(timer.current); flush(general); } setGeneral(!general); }} data-focus="nb-swap">{general ? t('tool.nb_lesson') : t('tool.nb_general')}</Button></div>
    <div class="doctools" role="toolbar" aria-label={t('tool.notebook')}>
      {B('bold', 'tool.doc_b', 'dt-bold')}{B('italic', 'tool.doc_i', 'dt-italic')}{B('underline', 'tool.doc_u', 'dt-underline')}{B('ul', 'tool.doc_ul')}{B('ol', 'tool.doc_ol')}
      <button type="button" class="btn sm quiet" onMouseDown={e => { e.preventDefault(); range.current = sel(); setAsk('link'); }}>{t('tool.nb_link')}</button>
      <label class="btn sm quiet">{t('tool.nb_pic')}<input type="file" class="vh" accept="image/*" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; pic(f); }} /></label>
      <button type="button" class="btn sm quiet" onMouseDown={e => { e.preventDefault(); range.current = sel(); setAsk('video'); }}>{t('tool.nb_video')}</button>
      <Mic onText={w => { focus(); document.execCommand('insertText', false, (w.match(/^\s/) ? '' : ' ') + w); range.current = sel(); changed(); }} />
    </div>
    {ask && <div class="row"><TextInput label={ask === 'video' ? t('tool.nb_paste_video') : t('tool.nb_paste_link')} value={askV} onInput={setAskV} onKeyDown={e => { if (e.key === 'Enter') addUrl(); if (e.key === 'Escape') setAsk(null); }} data-focus="nb-ask" autoFocus />
      <Button size="sm" variant="primary" onClick={addUrl}>{t('tool.add')}</Button><IconButton icon="x" size="sm" label={t('common.cancel')} onClick={() => setAsk(null)} /></div>}
    <div class="nbpage" ref={pg} contentEditable="true" spellcheck={true} role="textbox" aria-multiline="true" aria-label={general ? t('tool.nb_general') : t('tool.nb_lesson')} data-raw data-nbpage onInput={changed}
      onBlur={() => { range.current = sel() || range.current; }}
      onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && /^[biu]$/i.test(e.key)) { e.preventDefault(); cmd({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); } }}
      onPaste={e => { const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); range.current = sel(); pic(f); } }}
      onDrop={e => { const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); e.stopPropagation(); pic(f); } }}
      onClick={e => { const a = e.target.closest && e.target.closest('a[href]'); if (a) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); } }} />
    <small class="mute" role="status">{state === 'saving' ? t('tool.saving') : state === 'saved' ? t('tool.saved') : general ? t('tool.nb_kept_here') : t('tool.nb_kept_lesson')}</small>
  </div>;
}
