// Books in the Beside drawer. Its PDF tools load when the teacher opens a book.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, TextInput, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import { addBook, removeBook, restoreBook, saveBookPages } from '../../planning/books.js';
import { savePlannerKv } from '../../planning/write.js';
import { plannerKv } from '../../planning/plan.js';
import { saveFailed } from '../plan/save.js';
import { boxAdd, CHIP_TYPE } from '../plan/cbox.js';
import { DriveButton } from '../drive-button.jsx';
import '../plan/lines.js';
import '../plan/les-lines.js';
import '../plan/tool-lines.js';

let lib = null;
const pdfLib = () => lib || (lib = PARTS.pdf().then(m => m.pdfjs()));
export function Books({ assistantName, incoming, onTaken }) {
  const [list, setList] = useState(null), [open, setOpen] = useState(null);
  const read = () => plannerKv('pdfs').then(v => setList(Array.isArray(v) ? v : []));
  useEffect(() => { read(); }, []);
  useEffect(() => { if (incoming) { onTaken(); add(incoming); } }, [incoming]);
  const add = async f => {
    if (!f) return; if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return toast(t('tool.pdf_only'));
    try { await addBook(f); await read(); } catch (e) { saveFailed(e); }
  };
  const remove = async x => {
    try {
      const removed = await removeBook(x.id);
      await read();
      if (removed) toast(t('tool.book_removed', { name: removed.book.name }), { undo: async () => {
        try { await restoreBook(removed); await read(); } catch (e) { saveFailed(e); }
      } });
    } catch (e) { saveFailed(e); }
  };
  if (open) return <Book book={open} assistantName={assistantName} onBack={() => { setOpen(null); read(); }} />;
  return <div class="books">
    <h3 class="sub">{t('tool.your_books')}</h3>
    {list && !list.length && <p class="mute">{t('tool.no_books')}</p>}
    <ul class="mlist">{(list || []).map(x => <li><button type="button" class="link mopen" onClick={() => setOpen(x)} data-book={x.id}><Icon name="file" size="sm" /><span data-raw>{x.name}</span></button>
      {x.pages > 0 && <small class="mute">{t('tool.n_pages', { n: x.pages })}</small>}<IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(x)} /></li>)}</ul>
    <label class="btn sm"><Icon name="upload" />{t('tool.add_pdf')}<input type="file" class="vh" accept="application/pdf,.pdf" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; add(f); }} data-addpdf /></label><DriveButton />
    <p class="mute small">{t('tool.books_here')}</p>
  </div>;
}
function Book({ book, assistantName, onBack }) {
  const [pdf, setPdf] = useState(null), [page, setPage] = useState(1), [outline, setOutline] = useState(null), [view, setView] = useState('page'), [q, setQ] = useState(''), [hits, setHits] = useState(null);
  const canvas = useRef(), texts = useRef({}), wrap = useRef();
  useEffect(() => {
    let on = true;
    (async () => {
      const b = await plannerKv('pdf:' + book.id); if (!b) { toast(t('tool.book_missing')); return onBack(); }
      try {
        const L = await pdfLib(), doc = await L.getDocument({ data: new Uint8Array(await b.arrayBuffer()), isEvalSupported: false }).promise; if (!on) return;
        setPdf(doc); const last = +(await plannerKv('pdfpg:' + book.id)) || 1; setPage(Math.min(Math.max(1, last), doc.numPages));
        if (!book.pages) await saveBookPages(book.id, doc.numPages).catch(saveFailed);
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
        <IconButton icon="chr" label={t('tool.next_page')} disabled={!pdf || page >= pdf.numPages} onClick={() => go(page + 1)} /><span class="grow" /><Button size="sm" icon="assist" onClick={toAssistant} data-focus="page-to-ai">{t('les.to_box', { name: assistantName })}</Button></div>
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
