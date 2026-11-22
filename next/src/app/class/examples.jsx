// Strong examples and the watch list (src/examples.js, src/watch.js): every example from every class, with no names on the
// pictures, as Library > Examples. Records and pictures are the current app's own (grading-studio-examples: ex, pix), read as
// they are and written only through students/write.js keepExample and dropExample, one record and its pictures at a time.
// Whose work it was (who, from) is shown to the teacher only, never on a picture, a sheet or Show to the class.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Segmented, Select, Button, IconButton, Menu, Dialog, TextInput, EmptyState, Icon, CopyButton, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { PARTS, href } from '../router.js';
import { usePart } from '../parts.js';
import { exampleRecords, examplePictures, library } from '../../students/index.js';
import { prefs } from '../../students/prefs.js';
import { keepExample, dropExample } from '../../students/write.js';
import { onSaved } from '../../shared/saved.js';
import { openWork } from '../openwork.js';
import './lines.js';

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
export const exTags = r => (Array.isArray(r && r.tags) ? r.tags : []);
// Comma-separated words, tidied: a tag used before keeps its first spelling (src/examples.js exTagsOf), at most 8 of 30 letters.
export function tagsOf(text, all) {
  const known = new Map(all.map(x => [x.toLowerCase(), x])), out = [];
  for (let w of String(text || '').split(/[,;\n]/)) { w = w.replace(/\s+/g, ' ').trim().slice(0, 30); if (!w) continue; w = known.get(w.toLowerCase()) || w; if (!out.some(x => x.toLowerCase() === w.toLowerCase())) out.push(w); }
  return out.slice(0, 8);
}
// Never named after the student (exLabel).
export const exLabel = r => (r.kind === 'answer' ? t('class.ex_question', { q: (r.q && r.q.lab) || '?' }) : r.kind === 'paper' ? t('class.ex_example', { l: r.letter || 'A' })
  : r.kind === 'shot' ? t(r.watch ? 'class.ex_watch_n' : 'class.ex_shot_n', { n: r.letter || '1' }) : t('class.ex_part'));
export const exAsgKey = r => r.asg || (r.work ? 'w:' + r.work : 'loose:' + (r.cls || '-'));
const KIND_ORDER = { answer: 0, paper: 1, part: 2, shot: 3 };
const pageSort = list => list.slice().sort((a, b) => (KIND_ORDER[a.kind] ?? 4) - (KIND_ORDER[b.kind] ?? 4) || (a.kind === 'answer' ? natural(a.q && a.q.lab, b.q && b.q.lab) : 0) || a.t - b.t);
const groupsOf = list => { const g = new Map(); for (const r of list) { const k = exAsgKey(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); } return [...g.values()].map(pageSort).sort((a, b) => Math.max(...b.map(r => r.t)) - Math.max(...a.map(r => r.t))); };
const KINDS = [['answer', 'class.ex_k_answer'], ['paper', 'class.ex_k_paper'], ['part', 'class.ex_k_part'], ['shot', 'class.ex_k_shot']];

// Pictures as object URLs, made once per page and let go when the page goes.
const urls = new Map();
export const picUrl = (id, n = 0) => { const k = id + '|' + n; if (!urls.has(k)) urls.set(k, examplePictures.get(k).then(b => (b instanceof Blob ? URL.createObjectURL(b) : null), () => null)); return urls.get(k); };
const dropUrls = id => { for (const [k, u] of urls) if (k.startsWith(id + '|')) { u.then(x => x && URL.revokeObjectURL(x)); urls.delete(k); } };
function Pic({ id, n = 0, alt = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { let live = true; picUrl(id, n).then(u => live && setSrc(u)); return () => { live = false; }; }, [id, n]);
  return src ? <img src={src} alt={alt} /> : <span class="exph" aria-hidden="true" />;
}

// Every record, read again after any example is saved here or in another window.
export function useExamples() {
  const [all, setAll] = useState(null);
  useEffect(() => { let live = true; const read = () => exampleRecords().then(l => live && setAll(l), e => { console.error(e); live && setAll([]); }); read();
    const off = onSaved(e => { if (e.kind === 'example') { dropUrls(e.id); read(); } }); return () => { live = false; off(); }; }, []);
  return all;
}
const failed = e => { console.error(e); toast(e && e.name === 'NotThere' ? t('class.ex_no_db') : t('class.ex_failed')); };
export const putExample = (r, blobs) => keepExample(r, blobs).catch(e => { failed(e); throw e; });

export default function Examples({ view: start, work }) {
  const all = useExamples(), [view, setView] = useState(start || 'ex'), [f, setF] = useState({ cls: '', asg: '', kind: '', row: '', tag: '', q: '' });
  const [edit, setEdit] = useState(null), [show, setShow] = useState(null), [cover, setCover] = useState(null);
  // shown for one assignment: the examples made from that download's papers
  useEffect(() => { if (!all || !work) return; const r = all.find(x => !x.gone && !x.watch && String(x.work || '').replace(/^gs\.b\./, '') === String(work).replace(/^gs\.b\./, '')); if (r) setF(f => ({ ...f, cls: r.cls || '-', asg: exAsgKey(r) })); }, [!all, work]);
  if (!all) return <div class="loading" aria-busy="true" />;
  const live = all.filter(r => !r.gone && Array.isArray(r.pages)), lib = library.json(null) || {}, classes = lib.classes || [];
  const cname = id => { const c = id && classes.find(k => String(k.id) === String(id)); return c ? c.name : id ? t('class.ex_class_gone') : t('class.ex_no_class'); };
  const W = view === 'watch', src = live.filter(r => (W ? r.watch : !r.watch));
  const allTags = [...new Set(src.flatMap(exTags))].sort(natural);
  const q = f.q.trim().toLowerCase();
  const list = src.filter(r => (!f.cls || (r.cls || '-') === f.cls) && (!f.asg || exAsgKey(r) === f.asg) && (!f.kind || r.kind === f.kind) && (!f.row || r.row === f.row) && (!f.tag || exTags(r).includes(f.tag))
    && (!q || [r.title, r.why, r.row, exLabel(r), ...exTags(r)].some(x => String(x || '').toLowerCase().includes(q))));
  const groups = groupsOf(list), flat = groups.flat(), filtered = Object.values(f).some(v => String(v).trim());
  const uniq = pairs => [...new Map(pairs).entries()].sort((a, b) => natural(a[1], b[1]));
  const clsOpts = uniq(src.map(r => [r.cls || '-', cname(r.cls)])), asgOpts = uniq(src.filter(r => !f.cls || (r.cls || '-') === f.cls).map(r => [exAsgKey(r), r.title || t('class.ex_asg')]));
  const set = (k, v) => setF(f => ({ ...f, [k]: v, ...(k === 'cls' ? { asg: '' } : {}) }));
  const sel = (k, opts, any) => <Select label={any} value={f[k]} onChange={v => set(k, v)} options={[{ value: '', label: any }, ...opts.map(([v, l]) => ({ value: v, label: l }))]} data-exf={k} />;
  const act = { show: r => setShow({ list: flat, at: Math.max(0, flat.findIndex(x => x.id === r.id)) }), edit: (r, k) => setEdit({ r, k }), cover: r => setCover(r), tag: v => setF(f => ({ ...f, tag: v })) };
  return <div class="cp-ex" data-examples>
    <div class="exhead"><Segmented label={t('class.ex_view')} value={view} onChange={v => { setView(v); setF({ cls: '', asg: '', kind: '', row: '', tag: '', q: '' }); }}
      options={[{ value: 'ex', label: t('class.ex_strong') }, { value: 'watch', label: t('class.ex_watchlist') }, { value: 'who', label: t('class.ex_whose') }]} />
      <p class="mute small">{t(W ? 'class.ex_watch_say' : view === 'who' ? 'class.ex_who_say' : 'class.ex_say')}</p></div>
    {view === 'who' ? <Whose live={live.filter(r => !r.watch)} watch={live.filter(r => r.watch)} cname={cname} />
      : !src.length ? <EmptyState icon={W ? 'flag' : 'spark'} title={t(W ? 'class.ex_watch_none' : 'class.ex_none')} text={t(W ? 'class.ex_watch_none_say' : 'class.ex_none_say')} />
      : <>
        <div class="exbar">{sel('cls', clsOpts, t('class.ex_every_class'))}{sel('asg', asgOpts, t('class.ex_every_asg'))}
          {!W && sel('kind', KINDS.filter(([k]) => src.some(r => r.kind === k)).map(([k, l]) => [k, t(l)]), t('class.ex_every_kind'))}
          {!W && src.some(r => r.row) && sel('row', [...new Set(src.map(r => r.row).filter(Boolean))].sort(natural).map(x => [x, x]), t('class.ex_every_row'))}
          {allTags.length > 0 && sel('tag', allTags.map(x => [x, x]), t('class.ex_every_tag'))}
          <input class="input exfind" type="search" placeholder={t('class.ex_search')} aria-label={t('class.ex_search')} value={f.q} onInput={e => set('q', e.currentTarget.value)} data-exfind />
          {filtered && <Button size="sm" variant="quiet" onClick={() => setF({ cls: '', asg: '', kind: '', row: '', tag: '', q: '' })} data-exclear>{t('class.ex_clear')}</Button>}
        </div><div class="exbar exacts"><span class="mute num" data-excount>{t(W ? 'class.ex_n_watch' : 'class.ex_n', { n: list.length })}</span><span class="grow" />
          {list.length > 0 && !W && <Button size="sm" icon="download" onClick={() => sheet(flat, new Set(flat.map(exAsgKey)).size > 1 ? t('class.ex_strong') : null)} data-exsheet>{t('class.ex_sheet')}</Button>}
          {list.length > 0 && !W && <Button size="sm" variant="primary" icon="play" onClick={() => setShow({ list: flat, at: 0 })} data-exshow>{t('class.ex_show')}</Button>}
          {list.length > 0 && W && <Send list={list} />}</div>
        {!list.length && <p class="mute">{t('class.ex_none_match')}</p>}
        {groups.map(g => <section class="exgroup"><h3><span data-raw>{g[0].title || t('class.ex_asg')}</span> <span class="mute">· <span data-raw>{cname(g[0].cls)}</span> · {date(new Date(Math.max(...g.map(r => r.t))), { month: 'short', year: 'numeric' })}</span></h3>
          <div class="exgrid">{g.map(r => <Card key={r.id} r={r} act={act} />)}</div></section>)}
      </>}
    {edit && <EditDialog r={edit.r} k={edit.k} allTags={allTags} onClose={() => setEdit(null)} />}
    {cover && <CoverDialog r={cover} onClose={() => setCover(null)} />}
    {show && <Show list={show.list} at={show.at} onClose={() => setShow(null)} />}
  </div>;
}

// Whose work it is, as a link to the student's card when the class and the name are still here (src/watch.js wlHere).
function WhoLink({ c, n }) {
  const cl = ((library.json(null) || {}).classes || []).find(k => String(k.id) === String(c)), i = cl ? cl.names.indexOf(n) : -1;
  return i >= 0 ? <a class="link" href={href('class', cl.id, 'people', i + 1)} data-exwhoc data-raw>{n}</a> : <span data-raw>{n}</span>;
}
// Copy picture (exCopy): the first picture as a PNG; the first time, what a picture pasted into a lesson does.
const canCopy = () => !!(navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined');
const pngOf = async r => { const b = await examplePictures.get(r.id + '|0'), im = await createImageBitmap(b), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return new Promise((res, rej) => c.toBlob(x => (x ? res(x) : rej(new Error('no picture'))), 'image/png')); };
async function copyPic(r) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngOf(r) })]);
    if (prefs.get('gs.exCopied', false)) toast(t('class.mb_copied')); else { prefs.set('gs.exCopied', true); toast(t('class.ex_copied_first')); }
  } catch (e) { console.error(e); toast(t('class.ex_copy_bad')); }
}
// Delete at once, with Undo bringing it back with its pictures.
async function del(r) {
  const W = !!r.watch;
  try {
    const pics = []; for (let n = 0; n < r.pages.length; n++) pics.push(await examplePictures.get(r.id + '|' + n));
    await dropExample(r);
    toast(t(W ? 'class.ex_deleted_w' : 'class.ex_deleted'), pics.every(b => b instanceof Blob) ? { undo: () => keepExample({ ...r }, pics).catch(failed) } : {});
  } catch (e) { failed(e); }
}
function Card({ r, act, from }) {
  const W = !!r.watch, chip = r.kind === 'answer' && r.q && r.q.v != null ? t('class.ex_of', { v: r.q.v, of: r.q.pts }) : r.kind === 'paper' ? t('class.ex_pages', { n: r.pages.length }) : '';
  const items = [...(W ? [] : [{ label: t('class.ex_show'), icon: 'play', onSelect: () => act.show(r) }]),
    { label: t(r.why ? (W ? 'class.ex_note_change' : 'class.ex_why_change') : (W ? 'class.ex_note_add' : 'class.ex_why_add')), icon: 'edit', onSelect: () => act.edit(r, 'why') },
    { label: t(exTags(r).length ? 'class.ex_tags_change' : 'class.ex_tags_add'), icon: 'flag', onSelect: () => act.edit(r, 'tags') },
    { label: t('class.ex_cover'), icon: 'eraser', onSelect: () => act.cover(r) },
    ...(!W && (r.kind === 'paper' || r.kind === 'part') && r.from && r.work && r.work === openWork() ? [{ label: t('class.es_again'), icon: 'redo', onSelect: () => PARTS.exsave().then(m => { const st = m.redoTarget(r); if (st) m.useExample(st, r); else toast(t('class.es_not_open')); }) }] : []),
    { label: t('class.ex_download'), icon: 'download', onSelect: () => download(r) },
    { label: t('class.ex_delete'), icon: 'trash', onSelect: () => del(r) }];
  return <div class={'excard ' + r.kind + (W ? ' exw' : '')} data-exid={r.id}>
    <button type="button" class="exthumb" onClick={() => act.show(r)} aria-label={t('class.ex_show_one', { name: exLabel(r) })} data-exopen><Pic id={r.id} alt={exLabel(r)} /></button>
    <div class="exct"><Icon name={W ? 'flag' : 'spark'} size="xs" /><b>{exLabel(r)}</b>{r.row ? <span class="tag" data-raw>{r.row}</span> : chip ? <span class="tag">{chip}</span> : null}
      <span class="grow" /><Menu label={t('class.ex_more')} trigger={m => <IconButton {...m} icon="dots" size="sm" label={t('class.ex_more')} data-exmenu />} items={items} /></div>
    {from && <p class="exfrom mute small" data-exfrom><Icon name="link" size="xs" />{t('class.ax_from')} <b data-raw>{from}</b></p>}
    {r.why ? <p class="exwhy" data-raw>{r.why}</p> : <p class="exwhy"><button type="button" class="link" onClick={() => act.edit(r, 'why')} data-exwhyadd>{t(W ? 'class.ex_note_add' : 'class.ex_why_add')}</button></p>}
    {exTags(r).length > 0 && <p class="extags">{exTags(r).map(x => <button type="button" class="chip" onClick={() => act.tag(x)} data-extag={x} data-raw>{x}</button>)}</p>}
    {r.kind !== 'paper' && canCopy() && <div class="exacts"><Button size="sm" icon="copy" onClick={() => copyPic(r)} data-excopy>{t('class.ex_copy')}</Button></div>}
    {(r.who || r.from) && <p class="exwho mute small"><Icon name="eye" size="xs" />{t('class.ex_only_you')} {r.who ? <WhoLink c={r.who.c} n={r.who.n} /> : <span data-raw>{r.from.key}</span>}</p>}
  </div>;
}

// This assignment's Examples (src/examples.js openExamples; D-018, D-019, D-020): the Examples tab of an open assignment. Answers by
// question in the quiz's order, with the questions that have none yet; then whole papers, parts of pages and screenshots; and the
// same assignment's examples in linked classes, shown only when asked. twins: the ids of its copies in linked classes.
const AX_ORDER = { paper: 0, part: 1, shot: 2 };
export function AsgExamples({ batch, twins = [], label }) {
  const all = useExamples(), [lk, setLk] = useState(false), [edit, setEdit] = useState(null), [show, setShow] = useState(null), [cover, setCover] = useState(null);
  if (!all) return <div class="loading" aria-busy="true" />;
  const live = all.filter(r => !r.gone && Array.isArray(r.pages) && !r.watch), classes = (library.json(null) || {}).classes || [];
  const cname = id => { const c = id && classes.find(k => String(k.id) === String(id)); return c ? c.name : t('class.ex_class_gone'); };
  const qs = (batch.quiz && batch.quiz.qs) || [], qAt = r => { const k = qs.findIndex(q => r.q && q.id === r.q.id); return k < 0 ? 999 : k; };
  const sorted = l => [...l.filter(r => r.kind === 'answer').sort((a, b) => qAt(a) - qAt(b) || natural(a.q && a.q.lab, b.q && b.q.lab) || a.t - b.t), ...l.filter(r => r.kind !== 'answer').sort((a, b) => (AX_ORDER[a.kind] ?? 3) - (AX_ORDER[b.kind] ?? 3) || a.t - b.t)];
  const mine = sorted(live.filter(r => r.work === batch.id)), tw = sorted(live.filter(r => r.work !== batch.id && r.asg && twins.includes(r.asg)));
  const ans = mine.filter(r => r.kind === 'answer'), rest = mine.filter(r => r.kind !== 'answer');
  const none = qs.map((q, i) => ({ q, i })).filter(x => !ans.some(r => r.q && r.q.id === x.q.id)).map(x => label(x.q, x.i));
  const shown = mine.concat(lk ? tw : []);
  const allTags = [...new Set(live.flatMap(exTags))].sort(natural);
  const act = { show: r => setShow({ list: shown, at: Math.max(0, shown.findIndex(x => x.id === r.id)) }), edit: (r, k) => setEdit({ r, k }), cover: r => setCover(r), tag: () => {} };
  return <div class="cp-ex asgex" data-asgex>
    <div class="exbar exacts"><p class="mute small">{t('class.ax_say')}</p><span class="grow" />
      {shown.length > 0 && <Button size="sm" icon="download" onClick={() => sheet(shown, batch.name)} data-exsheet>{t('class.ex_sheet')}</Button>}
      {shown.length > 0 && <Button size="sm" variant="primary" icon="play" onClick={() => setShow({ list: shown, at: 0 })} data-exshow>{t('class.ex_show')}</Button>}</div>
    {!mine.length && !tw.length && <EmptyState icon="spark" title={t('class.ex_none')} text={t('class.ax_none_say')} />}
    {(ans.length > 0 || (none.length > 0 && mine.length + tw.length > 0)) && <section class="exgroup"><h3>{t('class.ax_answers')}</h3><div class="exgrid">{ans.map(r => <Card key={r.id} r={r} act={act} />)}
      {none.length > 0 && <div class="excard exnone" data-exnone><p>{t('class.ax_q_none', { n: none.length, list: none.length > 1 ? t('class.as_and', { list: none.slice(0, -1).join(', '), last: none[none.length - 1] }) : none[0] })}</p></div>}</div></section>}
    {rest.length > 0 && <section class="exgroup"><h3>{t(rest.some(r => r.kind === 'shot') ? 'class.ax_rest_shots' : 'class.ax_rest')}</h3><div class="exgrid">{rest.map(r => <Card key={r.id} r={r} act={act} />)}</div></section>}
    {tw.length > 0 && <section class="exgroup" data-exlinked><h3><Icon name="link" size="xs" /> {t('class.ax_linked')} {lk && <button type="button" class="link" onClick={() => setLk(false)} data-exlk>{t('class.ax_hide')}</button>}</h3>
      {!lk ? <Button onClick={() => setLk(true)} data-exlk>{t('class.ax_show_lk', { n: tw.length, names: [...new Set(tw.map(r => cname(r.cls)))].join(', ') })}</Button>
        : <><p class="mute small">{t('class.ax_lk_say')}</p><div class="exgrid">{tw.map(r => <Card key={r.id} r={r} act={act} from={cname(r.cls)} />)}</div></>}</section>}
    {edit && <EditDialog r={edit.r} k={edit.k} allTags={allTags} onClose={() => setEdit(null)} />}
    {cover && <CoverDialog r={cover} onClose={() => setCover(null)} />}
    {show && <Show list={show.list} at={show.at} onClose={() => setShow(null)} />}
  </div>;
}

// Why it's strong (a note on a watch-list one) and its tags, in a small box.
function EditDialog({ r, k, allTags, onClose }) {
  const [v, setV] = useState(k === 'why' ? r.why || '' : exTags(r).join(', '));
  const save = async () => { const patch = k === 'why' ? { why: v.trim().slice(0, 300) } : { tags: tagsOf(v, allTags) }; try { await putExample({ ...r, ...patch }); onClose(); } catch {} };
  return <Dialog open title={t(k === 'why' ? (r.watch ? 'class.ex_note_t' : 'class.ex_why_t') : 'class.ex_tags_t', { name: exLabel(r) })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-exedit-save>{t('class.save')}</Button></>}>
    <TextInput label={t(k === 'why' ? (r.watch ? 'class.ex_note_l' : 'class.ex_why_l') : 'class.ex_tags_l')} value={v} maxLength={k === 'why' ? 300 : 200} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') save(); }} data-exedit autoFocus />
    {k === 'tags' && allTags.length > 0 && <p class="extags">{allTags.map(x => <button type="button" class="chip" onClick={() => setV(tagsOf((v ? v + ', ' : '') + x, allTags).join(', '))} data-raw>{x}</button>)}</p>}
  </Dialog>;
}

const jpg = c => new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.86));
// Black boxes on a saved example (exCoverEdit): drag to cover, click a box to take it off; saving paints them in for good.
export function CoverDialog({ r, onClose }) {
  const [ims, setIms] = useState(null), [boxes, setBoxes] = useState([]), [busy, setBusy] = useState(false), cv = useRef([]);
  useEffect(() => { (async () => { const out = []; for (let n = 0; n < r.pages.length; n++) { const b = await examplePictures.get(r.id + '|' + n); if (!(b instanceof Blob)) { toast(t('class.ex_pics_bad')); onClose(); return; } out.push(await createImageBitmap(b)); } setIms(out); setBoxes(out.map(() => [])); })().catch(e => { console.error(e); onClose(); }); }, []);
  const paint = (c, k, w) => { const im = ims[k], s = w / im.width; c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); x.fillStyle = '#111'; for (const q of boxes[k]) x.fillRect(Math.floor(q.x * c.width), Math.floor(q.y * c.height), Math.ceil(q.w * c.width) + 1, Math.ceil(q.h * c.height) + 1); };
  useEffect(() => { if (ims) ims.forEach((_, k) => cv.current[k] && paint(cv.current[k], k, Math.min(ims[k].width, 1400))); });
  const bind = k => { let d = null; return {
    onPointerDown: e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); d = { r: e.currentTarget.getBoundingClientRect(), x0: e.clientX, y0: e.clientY }; },
    onPointerUp: e => { if (!d) return; const g = d; d = null; const fx = v => Math.max(0, Math.min(1, (v - g.r.left) / (g.r.width || 1))), fy = v => Math.max(0, Math.min(1, (v - g.r.top) / (g.r.height || 1)));
      const L = boxes[k].slice();
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) { const x = fx(e.clientX), y = fy(e.clientY), hit = L.map((q, i) => ({ q, i })).filter(({ q }) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h).sort((a, b) => a.q.w * a.q.h - b.q.w * b.q.h)[0]; if (!hit) return; L.splice(hit.i, 1); }
      else { const x = fx(Math.min(g.x0, e.clientX)), y = fy(Math.min(g.y0, e.clientY)), w = fx(Math.max(g.x0, e.clientX)) - x, hh = fy(Math.max(g.y0, e.clientY)) - y; if (w < 0.004 || hh < 0.004) return; L.push({ x, y, w, h: hh }); }
      setBoxes(boxes.map((b, j) => (j === k ? L : b))); } }; };
  const n = boxes.flat().length;
  const save = async () => { setBusy(true); try { const out = [], pages = []; for (let k = 0; k < ims.length; k++) { const c = document.createElement('canvas'); paint(c, k, ims[k].width); out.push(await jpg(c)); pages.push({ w: c.width, h: c.height }); } await putExample({ ...r, pages }, out); toast(t('class.ex_covered')); onClose(); } catch { setBusy(false); } };
  return <Dialog open wide title={t('class.ex_cover_t', { name: exLabel(r) })} onClose={onClose}
    actions={<><span class="mute small">{t('class.ex_cover_gone')}</span><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={!n || busy} onClick={save} data-excover-save>{t('class.save')}</Button></>}>
    <p class="mute small" data-excover-say>{n ? t('class.ex_n_covered', { n }) + ' ' : ''}{t('class.ex_cover_say')}</p>
    {!ims ? <div class="loading" aria-busy="true" /> : <div class="excov">{ims.map((_, k) => <canvas ref={el => (cv.current[k] = el)} {...bind(k)} data-excv={k} />)}</div>}
  </Dialog>;
}

// Full screen, one example at a time, large (exShow). Left and right or Page Up and Page Down move, + and - zoom, N the note,
// Esc closes; nothing underneath answers a key while the class is looking. No names anywhere.
export function Show({ list, at: start, onClose }) {
  const [at, setAt] = useState(start || 0), [zoom, setZoom] = useState(1), [note, setNote] = useState(true), box = useRef(null), st = useRef();
  st.current = { at, n: list.length };
  useEffect(() => {
    const key = e => { const stop = () => { e.preventDefault(); e.stopPropagation(); };
      const k = e.key, s = st.current;
      if (k === 'Escape') { stop(); onClose(); } else if (k === 'ArrowRight' || k === 'PageDown') { stop(); setAt(Math.min(s.n - 1, s.at + 1)); } else if (k === 'ArrowLeft' || k === 'PageUp') { stop(); setAt(Math.max(0, s.at - 1)); }
      else if (k === '+' || k === '=') { stop(); setZoom(z => Math.min(2.5, z + 0.25)); } else if (k === '-' || k === '_' || k === '−') { stop(); setZoom(z => Math.max(0.5, z - 0.25)); } else if (k === 'n' || k === 'N') { stop(); setNote(v => !v); } else stop(); };
    document.addEventListener('keydown', key, true);
    const el = box.current; if (el) { el.focus(); try { const p = el.requestFullscreen && el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch {} }
    return () => { document.removeEventListener('keydown', key, true); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);
  const r = list[at]; if (!r) return null;
  const why = r.why && note ? <p class={'exsnote' + (r.kind === 'paper' ? ' top' : '')}><Icon name={r.watch ? 'flag' : 'spark'} size="xs" /><span data-raw>{r.why}</span></p> : null;
  return <div class="exshow" ref={box} tabIndex={-1} role="dialog" aria-label={t('class.ex_show')} data-exshow-on>
    <div class="exshd"><h2>{exLabel(r)}</h2><span class="tag">{t(r.watch ? 'class.ex_watchlist' : r.kind === 'answer' ? 'class.ex_b_answer' : r.kind === 'paper' ? 'class.ex_b_paper' : 'class.ex_b_work')}</span><span class="grow" />
      {r.why && <button type="button" class="link" onClick={() => setNote(!note)}>{t(note ? 'class.ex_note_hide' : 'class.ex_note_show')}</button>}<button type="button" class="link" onClick={onClose} data-exshow-x>{t('class.ex_esc')}</button></div>
    <div class="exsbody">{r.kind === 'paper' && why}<div class={'exspics ' + r.kind} style={{ '--exz': zoom }} data-exz={zoom}>{r.pages.map((_, n) => <Pic id={r.id} n={n} />)}</div>{r.kind !== 'paper' && why}</div>
    <div class="exsft"><IconButton icon="chl" label={t('class.ex_prev')} disabled={!at} onClick={() => setAt(at - 1)} /><span data-exshow-at>{t('class.rp_n_of', { n: at + 1, of: list.length })}</span>
      <IconButton icon="chr" label={t('class.ex_next')} disabled={at >= list.length - 1} onClick={() => setAt(at + 1)} /><span class="grow" /><span class="mute">{t('class.ex_show_keys')}</span></div>
  </div>;
}

const saveBlob = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, '-'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const fileName = (r, ext) => (r.title || t('class.ex_asg')) + ' - ' + (r.kind === 'part' ? t('class.ex_part_l', { l: r.letter || 'A' }) : exLabel(r)) + '.' + ext;
const pdfText = s => String(s || '').replace(/[‘’]/g, '\'').replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
async function download(r) {
  try {
    if (r.kind === 'paper') { const P = await PARTS.pdflib(), pdf = await P.PDFDocument.create(); pdf.setCreator('Grading Studio'); pdf.setProducer(''); pdf.setAuthor('');
      for (let n = 0; n < r.pages.length; n++) { const b = await examplePictures.get(r.id + '|' + n); if (!b) continue; const im = await pdf.embedJpg(new Uint8Array(await b.arrayBuffer())), W = 612, H = W * im.height / im.width; pdf.addPage([W, H]).drawImage(im, { x: 0, y: 0, width: W, height: H }); }
      saveBlob(fileName(r, 'pdf'), new Blob([await pdf.save()], { type: 'application/pdf' })); }
    else { const b = await examplePictures.get(r.id + '|0'); if (b) saveBlob(fileName(r, 'jpg'), b); }
  } catch (e) { failed(e); }
}
// One PDF of the examples shown: each heading, its pictures, the tags and why, for printing or posting (exSheet).
async function sheet(list, name) {
  if (!list.length) return;
  toast(t('class.ex_sheet_making'));
  try {
    const P = await PARTS.pdflib(), pdf = await P.PDFDocument.create(), F = await pdf.embedFont(P.StandardFonts.Helvetica), Bd = await pdf.embedFont(P.StandardFonts.HelveticaBold);
    const title = pdfText(name || list[0].title || t('class.ex_asg')), PW = 612, PH = 792, M = 48, CW = PW - 2 * M, ink = P.rgb(0.12, 0.13, 0.15), soft = P.rgb(0.36, 0.38, 0.42), blue = P.rgb(0.1, 0.4, 0.66);
    pdf.setTitle(title); pdf.setAuthor(''); pdf.setCreator('Grading Studio'); pdf.setProducer('');
    let pg = null, y = 0; const page = () => { pg = pdf.addPage([PW, PH]); y = PH - M; }, room = hh => { if (!pg || y - hh < M) page(); };
    const wrap = (s, font, size, w) => { const out = []; let line = ''; for (const word of s.split(/\s+/).filter(Boolean)) { const x = line ? line + ' ' + word : word; if (font.widthOfTextAtSize(x, size) > w && line) { out.push(line); line = word; } else line = x; } if (line) out.push(line); return out; };
    page(); pg.drawText(title, { x: M, y: y - 20, size: 20, font: Bd, color: ink }); y -= 30; pg.drawText(pdfText(t('class.ex_sheet_sub')), { x: M, y: y - 12, size: 11, font: F, color: soft }); y -= 34;
    let lastQ = null;
    for (const r of list) {
      if (r.kind !== 'answer' || lastQ !== (r.q && r.q.id)) { if (r.kind === 'paper' && y < PH - M - 80) page(); room(40); pg.drawText(pdfText(exLabel(r)) + (r.row ? '   ' + pdfText(r.row) : ''), { x: M, y: y - 14, size: 14, font: Bd, color: ink }); y -= 24; lastQ = r.kind === 'answer' ? r.q && r.q.id : null; }
      for (let n = 0; n < r.pages.length; n++) { const b = await examplePictures.get(r.id + '|' + n); if (!b) continue; const im = await pdf.embedJpg(new Uint8Array(await b.arrayBuffer())), maxH = r.kind === 'paper' ? PH - 2 * M - 30 : 300, k = Math.min(CW / im.width, maxH / im.height), w = im.width * k, hh = im.height * k;
        room(hh + 8); pg.drawImage(im, { x: M, y: y - hh, width: w, height: hh }); pg.drawRectangle({ x: M, y: y - hh, width: w, height: hh, borderColor: P.rgb(0.85, 0.86, 0.88), borderWidth: 0.6 }); y -= hh + 8; }
      if (exTags(r).length) { room(14); pg.drawText(pdfText(exTags(r).join(', ')), { x: M, y: y - 10, size: 9.5, font: F, color: soft }); y -= 14; }
      if (r.why) for (const line of wrap('* ' + pdfText(r.why), F, 11, CW)) { room(16); pg.drawText(line, { x: M, y: y - 11, size: 11, font: F, color: blue }); y -= 15; }
      y -= 14;
    }
    saveBlob(title + ' - ' + t('class.ex_sheet_file') + '.pdf', new Blob([await pdf.save()], { type: 'application/pdf' }));
  } catch (e) { failed(e); }
}

// Whose work the strong examples are, class by class (src/watch.js wlWhoHtml): who the teacher goes to most, and who has none yet.
function Whose({ live, watch, cname }) {
  const lib = library.json(null) || {}, by = new Map();
  for (const r of live) if (r.who && r.who.c) { const k = String(r.who.c); if (!by.has(k)) by.set(k, new Map()); const m = by.get(k); m.set(r.who.n, (m.get(r.who.n) || 0) + 1); }
  const cls = (lib.classes || []).filter(c => by.has(String(c.id)) || watch.some(r => r.who && String(r.who.c) === String(c.id)));
  if (!cls.length) return <EmptyState icon="people" title={t('class.ex_who_none')} text={t('class.ex_who_none_say')} />;
  return <div class="exwhoall" data-exwho>{cls.map(c => { const m = by.get(String(c.id)) || new Map(), rows = c.names.map(n => ({ n, k: m.get(n) || 0, w: watch.filter(r => r.who && String(r.who.c) === String(c.id) && r.who.n === n).length })).sort((a, b) => b.k - a.k || natural(a.n, b.n));
    const none = rows.filter(x => !x.k).length;
    return <section class="exgroup"><h3 data-raw>{c.name}</h3><p class="mute small">{t('class.ex_who_none_n', { n: none, of: c.names.length })}</p>
      <table class="cp-tab exwhot"><thead><tr><th>{t('class.student')}</th><th class="num">{t('class.ex_strong')}</th><th class="num">{t('class.ex_watchlist')}</th></tr></thead>
        <tbody>{rows.map(x => <tr><td><a class="link" href={href('class', c.id, 'people', c.names.indexOf(x.n) + 1)} data-raw>{x.n}</a></td><td class="num">{x.k || '–'}</td><td class="num">{x.w || '–'}</td></tr>)}</tbody></table></section>; })}</div>;
}

// Send to an assistant (src/watch.js wlSend): the box is the watch list's part (watch.jsx), loaded when pressed.
function Send({ list }) {
  const [on, setOn] = useState(false), W = usePart('watch', on);
  return <><Button size="sm" variant="primary" icon="assist" onClick={() => setOn(true)} data-wlsend>{t('class.wl_send')}</Button>{on && W && <W.WatchSend list={list} onClose={() => setOn(false)} />}</>;
}
