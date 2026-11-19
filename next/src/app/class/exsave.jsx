// Strong examples and the watch list from the marking screen (src/examples.js): E on a Quick mark answer keeps it at once (a second E
// takes it back), Use as an example on a paper's ⋯ keeps the whole paper or part of a page with or without the marks and the score,
// Make again from the paper on a saved one, and a screenshot saved as a strong example or to the watch list. Pictures are cut by the
// lifted engine (engines/gex.js) with every name cover painted in; records go through students/write.js keepExample, in the current
// app's own form. Loaded on its own (router.js PARTS.exsave) so the marking screen carries only the hooks.
import { h, Fragment, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Segmented, Switch, Select, TextInput, Dialog, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { state, pdfjsLib, workerReady, quizMarks } from '../../engines/gcore.js';
import { batchClass, viewBytes, vpRot } from '../../engines/gdraw.js';
import { sharePage, shareOpts, classCommon, wordPagesPdf, nameFreeText, shareState, sameSpot } from '../../engines/gexport.js';
import { boxKey } from '../../engines/gopen.js';
import { quizLabel } from '../../engines/gquiz.js';
import * as X from '../../engines/gex.js';
import { exampleRecords } from '../../students/index.js';
import { keepExample, dropExample } from '../../students/write.js';
import { go } from '../router.js';
import { tagsOf, exTags } from './examples.jsx';
import './lines.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R4 = v => Math.round(v * 10000) / 10000;
const failed = e => { console.error(e); toast(e && e.name === 'NotThere' ? t('class.ex_no_db') : t('class.ex_failed')); };
// The record every example from this download starts from (src/examples.js exBase).
function base(kind, st) {
  const { batch } = state();
  return { id: uid() + uid(), t: Date.now(), kind, work: batch.id, asg: (batch.assignment && batch.assignment.id) || null, cls: (batchClass() || {}).id || null,
    title: X.exTitleNow(), q: null, row: null, why: '', letter: null, pages: [], marks: false, score: false, from: st ? X.exFrom(st) : null, who: st ? X.exWho(st) : null };
}
const nextLetter = (list, work, kind) => LETTERS[Math.min(25, Math.max(-1, ...list.filter(r => r.work === work && r.kind === kind).map(r => LETTERS.indexOf(r.letter))) + 1)];
const seeExamples = () => go('library', 'examples');
// Covers that touch or sit side by side on a line are one name to her (src/examples.js exGroups): Cara and Sample are one name.
function groups(cs) {
  const gap = (p, q, k, w) => Math.max(p[k] - q[k] - q[w], q[k] - p[k] - p[w]), near = (a, b) => 8 >= gap(a, b, 'x', 'w') && 2 >= gap(a, b, 'y', 'h'), seen = new Set(); let n = 0;
  for (let i = 0; i < cs.length; i++) { if (seen.has(i)) continue; n++; const todo = [i]; seen.add(i); while (todo.length) { const a = cs[todo.pop()]; cs.forEach((b, j) => { if (!seen.has(j) && near(a, b)) { seen.add(j); todo.push(j); } }); } }
  return n;
}
// A drag on a picture (rect: the picture's box on screen): fractions of it, and whether it moved more than a click.
const dragOf = (d, e) => { const fx = v => clamp((v - d.r.left) / (d.r.width || 1), 0, 1), fy = v => clamp((v - d.r.top) / (d.r.height || 1), 0, 1); const ax = fx(Math.min(d.x, e.clientX)), bx = fx(Math.max(d.x, e.clientX)), ay = fy(Math.min(d.y, e.clientY)), by = fy(Math.max(d.y, e.clientY)); return { k: d.k, x: R4(ax), y: R4(ay), w: R4(Math.max(0.01, bx - ax)), h: R4(Math.max(0.01, by - ay)), moved: Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 5 }; };

// A dialog of this part, shown over whatever screen asked for it.
function mount(make) {
  const host = document.createElement('div'); document.body.appendChild(host);
  const close = () => { render(null, host); host.remove(); };
  render(make(close), host);
  return close;
}

/* E on a Quick mark answer: kept at once with Undo; pressed again, taken back */
let busy = false;
export async function keepAnswer(st, q, qi) {
  const { batch } = state(); if (!batch || !st || !q || busy) return;
  busy = true;
  try {
    const all = await exampleRecords();
    const had = all.find(r => !r.watch && r.kind === 'answer' && r.work === batch.id && r.q && r.q.id === q.id && r.from && r.from.key === st.key);
    if (had) { await dropExample(had); return toast(t('class.es_taken_off')); }
    const pic = await X.exAnswerPic(st, q);
    if (!pic) return toast(t('class.es_no_page'));
    const v = quizMarks(st)[q.id];
    const rec = { ...base('answer', st), q: { id: q.id, lab: quizLabel(q, qi), pts: +q.pts || 1, v: v == null ? null : v }, pages: [pic.size] };
    await keepExample(rec, [pic.blob]);
    toast(t('class.es_kept_q', { q: rec.q.lab }), { action: { label: t('class.es_see'), run: seeExamples }, undo: () => dropExample(rec).catch(failed) });
  } catch (e) { failed(e); }
  finally { busy = false; }
}

/* Use as an example: the whole paper or part of a page */
export function useExample(st, redo) { return mount(close => <UseExample st={st} redo={redo} onClose={close} />); }
// Make again from the paper, from Library > Examples: only while that download is open here, and the student is in it.
export function redoTarget(r) {
  const { batch } = state();
  if (!batch || r.watch || r.kind === 'answer' || r.kind === 'shot' || r.work !== batch.id || !r.from) return null;
  return batch.students.find(s => s.key === r.from.key) || null;
}

async function expand(items, docs) {
  const out = [];
  for (const it of items) {
    if (!it.word) { out.push(it); continue; }
    try {
      const bytes = await wordPagesPdf(it.word), path = it.word.path + '#pdf', doc = pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
      docs.set(path, doc);
      const f = { path, name: it.word.name, kind: 'docx', marks: {}, wordOf: it.word };
      for (let p = 0; p < (await doc).numPages; p++) out.push({ f, p, path });
    } catch (e) { console.error(e); }
  }
  return out;
}
const docOf = (it, docs) => { if (!docs.has(it.path)) docs.set(it.path, (async () => pdfjsLib.getDocument({ data: (await viewBytes(it.f)).slice(), isEvalSupported: false }).promise)()); return docs.get(it.path); };
const pageAt = (st, it, docs, scale, look) => docOf(it, docs).then(js => sharePage(st, it.f, js, it.p, scale, X.coverRx(st), shareOpts(st), { bare: !look.marks, light: true, noScore: !look.score }));

// The whole paper kept as an example with nothing on screen, the way Use as an example keeps it (src/sample.js sampleExample): for the
// sample builder. o: { marks, score, why, row }.
export async function examplePaper(st, o = {}) {
  await workerReady; await classCommon();
  const docs = new Map(), items = await expand(X.exItems(st), docs), look = { marks: !!o.marks, score: !!o.score };
  const list = items.map((_, k) => k), sc = X.exScoreTop({ ...look, kind: 'paper', items, st }, list), blobs = [], pages = [];
  for (const k of list) {
    const it = items[k], js = await docOf(it, docs), v1 = vpRot(it.f, it.p, await js.getPage(it.p + 1), 1);
    const c = (await pageAt(st, it, docs, Math.min(4, 1600 / v1.width), look)).c;
    if (sc && !blobs.length) X.exScoreOn(c, sc);
    blobs.push(await X.exJpg(c)); pages.push({ w: c.width, h: c.height }); c.width = c.height = 0;
  }
  const { batch } = state();
  await keepExample({ ...base('paper', st), why: o.why || '', row: o.row || null, letter: nextLetter(await exampleRecords(), batch.id, 'paper'), pages, marks: look.marks, score: look.score && !!(X.exScoreText(st) || X.exScoreMarks(st)) }, blobs);
}
function UseExample({ st, redo, onClose }) {
  const { setup } = state(), R = redo || null;
  const [items, setItems] = useState(null), [kind, setKind] = useState(R ? R.kind : 'paper'), [marks, setMarks] = useState(R ? !!R.marks : false), [score, setScore] = useState(R ? !!R.score : false);
  const [why, setWhy] = useState(R ? R.why || '' : ''), [row, setRow] = useState(R ? R.row || '' : ''), [part, setPart] = useState(null), [saving, setSaving] = useState(false), [err, setErr] = useState('');
  const docs = useRef(new Map()), wrap = useRef(null), drag = useRef(null), [box, setBox] = useState(null), shown = useRef([]), [cv, setCv] = useState(0), [named, setNamed] = useState(null);
  const canScore = !!(X.exScoreText(st) || X.exScoreMarks(st));
  const rows = setup && setup.mode === 'rubric' ? (setup.criteria || []).filter(c => String(c || '').trim() && !/^Criterion \d+$/.test(c)) : [];
  useEffect(() => { let live = true; (async () => { try { await workerReady; await classCommon(); const l = await expand(X.exItems(st), docs.current); if (live) setItems(l); } catch (e) { console.error(e); if (live) setErr(String(e.message || e)); } })();
    return () => { live = false; for (const d of docs.current.values()) d.then(x => x.destroy(), () => {}); }; }, []);
  // the pages, drawn again when a switch changes
  useEffect(() => {
    if (!items || !wrap.current) return; let live = true;
    (async () => { const cells = wrap.current.querySelectorAll('[data-espg]');
      for (let k = 0; k < items.length && live; k++) {
        const cell = cells[k]; if (!cell) continue;
        const sc = Math.min(3, Math.max(240, cell.clientWidth || 360) * 1.25 / 612) * (window.devicePixelRatio || 1);
        const r = await pageAt(st, items[k], docs.current, sc, { marks, score });
        if (!live) { r.c.width = 0; return; }
        if (k === 0) X.exScoreOn(r.c, X.exScoreTop({ score, marks, kind, items, st }, kind === 'part' ? [0] : items.map((_, j) => j)));
        // where a cover she took off was: a dashed outline, so she can put it back
        if (r.gone.length) { const g = r.c.getContext('2d'); g.save(); g.setTransform(sc, 0, 0, sc, 0, 0); g.strokeStyle = '#1F6FB2'; g.lineWidth = 1.5 / sc; g.setLineDash([5 / sc, 3 / sc]); for (const q of r.gone) g.strokeRect(q.x, q.y, q.w, q.h); g.restore(); }
        shown.current[k] = { W: r.W, H: r.H, side: r.side, covers: r.covers, gone: r.gone };
        const old = cell.querySelector('canvas'); if (old) { old.replaceWith(r.c); old.width = 0; } else cell.prepend(r.c);
      }
      if (live) setNamed(shown.current.reduce((a, x) => a + (x ? groups(x.covers) : 0), 0)); })().catch(console.error);
    return () => { live = false; };
  }, [items, marks, score, kind, cv]);
  // a cover drawn by hand goes with the paper's other covers (shareState boxes), so it is there in Check the covers too; a click on a
  // cover takes it off, and on the dashed outline of one taken off puts it back (src/examples.js exuBind, exuToggle)
  const covered = () => { state().saveSoon(); setCv(v => v + 1); };
  const addCover = (k, b) => {
    const s = shown.current[k], it = items[k]; if (!s) return;
    const TW = s.W + s.side, x0 = Math.min(b.x * TW, s.W) / s.W, x1 = Math.min((b.x + b.w) * TW, s.W) / s.W; if (x1 - x0 < 0.002) return;
    const sh = shareState(); (sh.boxes[boxKey(it.f.path, it.p)] ||= []).push([R4(x0), b.y, R4(x1 - x0), b.h]); covered();
  };
  const toggle = (k, fx, fy) => {
    const s = shown.current[k], it = items[k]; if (!s) return;
    const x = fx * (s.W + s.side), y = fy * s.H, key = boxKey(it.f.path, it.p), sh = shareState();
    const inside = q => x >= q.x - 2 && x <= q.x + q.w + 2 && y >= q.y - 2 && y <= q.y + q.h + 2;
    const hit = s.covers.filter(inside).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (hit && hit.own) { const own = sh.boxes[key] || [], at = own.findIndex(b => Math.abs(b[0] * s.W - hit.x) < 1 && Math.abs(b[1] * s.H - hit.y) < 1); if (at >= 0) own.splice(at, 1); if (!own.length) delete sh.boxes[key]; }
    else if (hit) (sh.off ||= {})[key] = [...(sh.off[key] || []), [hit.x / s.W, hit.y / s.H, hit.w / s.W, hit.h / s.H].map(R4)];
    else { const g = s.gone.find(inside); if (!g) return; const off = (sh.off || {})[key] || [], at = off.findIndex(b => sameSpot(g, b, s.W, s.H)); if (at >= 0) off.splice(at, 1); if (!off.length && sh.off) delete sh.off[key]; }
    covered();
  };
  const down = (e, k) => { const c = e.currentTarget.querySelector('canvas'); if (e.button !== 0 || !c) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { k, r: c.getBoundingClientRect(), x: e.clientX, y: e.clientY }; };
  const move = e => { const d = drag.current; if (d) { const b = dragOf(d, e); setBox(b.moved ? b : null); } };
  const up = e => {
    const d = drag.current; if (!d) return; drag.current = null; const b = dragOf(d, e); setBox(null);
    if (!b.moved) return toggle(b.k, (e.clientX - d.r.left) / (d.r.width || 1), (e.clientY - d.r.top) / (d.r.height || 1));
    if (kind === 'part') { if (b.w > 0.02 && b.h > 0.02) setPart(b); } else addCover(b.k, b);
  };
  const save = async () => {
    if (!items || !items.length || saving) return;
    if (kind === 'part' && !part) return toast(t('class.es_drag_part'));
    setSaving(true);
    try {
      const list = kind === 'paper' ? items.map((_, k) => k) : [part.k], blobs = [], pages = [], sc = X.exScoreTop({ score, marks, kind, items, st }, list);
      for (const k of list) {
        const it = items[k], js = await docOf(it, docs.current), v1 = vpRot(it.f, it.p, await js.getPage(it.p + 1), 1);
        const r = await pageAt(st, it, docs.current, Math.min(4, (kind === 'part' ? 2400 : 1600) / v1.width), { marks, score });
        let c = r.c;
        if (kind === 'part') { const sx = Math.round(part.x * c.width), sy = Math.round(part.y * c.height), sw = Math.max(1, Math.round(part.w * c.width)), sh = Math.max(1, Math.round(part.h * c.height)); const o = document.createElement('canvas'); o.width = sw; o.height = sh; o.getContext('2d').drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh); c.width = 0; c = o; }
        if (sc && !blobs.length) X.exScoreOn(c, sc);
        blobs.push(await X.exJpg(c)); pages.push({ w: c.width, h: c.height }); c.width = c.height = 0;
      }
      const all = await exampleRecords(), same = R && R.kind === kind, { batch } = state();
      const rec = { ...base(kind, st), ...(same ? { id: R.id, t: R.t, letter: R.letter } : { letter: nextLetter(all, batch.id, kind) }), ...(R && R.tags ? { tags: R.tags } : {}),
        why: why.trim().slice(0, 160), row: row || null, pages, marks, score: score && canScore };
      await keepExample(rec, blobs);
      if (R && !same) await dropExample(R);   // made again as the other kind: the new one takes its place
      onClose();
      toast(R ? t('class.es_made_again') : kind === 'paper' ? t('class.es_saved_paper', { l: rec.letter }) : t('class.es_saved_part'), R ? {} : { action: { label: t('class.es_see'), run: seeExamples } });
    } catch (e) { setSaving(false); failed(e); }
  };
  return <Dialog open title={t(R ? 'class.es_again_t' : 'class.es_use_t')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} disabled={saving || !items || !items.length || (kind === 'part' && !part)} data-essave>{t(saving ? 'class.es_saving' : 'class.es_save')}</Button></>}>
    <div class="esuse" data-esuse>
      <div class="espv" ref={wrap}>{err ? <p class="mute">{t('class.es_cant_draw')}</p> : !items ? <p class="mute">{t('class.es_getting')}</p> : !items.length ? <p class="mute">{t('class.es_no_pages')}</p>
        : items.map((_, k) => <div class={'espg' + (kind === 'part' ? ' part' : '')} data-espg={k} onPointerDown={e => down(e, k)} onPointerMove={move} onPointerUp={up}>
          {(box && box.k === k ? box : part && part.k === k && kind === 'part' ? part : null) && (b => <div class={kind === 'part' || b !== box ? 'escrop' : 'escrop cover'} style={{ left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' }} />)(box && box.k === k ? box : part)}
          <span class="mute small">{t('class.rp_n_of', { n: k + 1, of: items.length })}</span></div>)}</div>
      <aside class="esside">
        <Segmented label={t('class.es_what')} value={kind} onChange={v => { setKind(v); setPart(null); }} options={[{ value: 'paper', label: t('class.es_whole') }, { value: 'part', label: t('class.es_part') }]} />
        <p class="mute small" data-esnames>{named != null && <b>{t('class.es_n_covered', { n: named })} </b>}{t(kind === 'part' ? 'class.es_part_say' : 'class.es_cover_say')}</p>
        <span data-essw="marks"><Switch label={t('class.es_marks')} checked={marks} onChange={setMarks} /></span>
        {canScore && <span data-essw="score"><Switch label={t('class.es_score')} checked={score} onChange={setScore} /></span>}
        <TextInput label={t('class.ex_why_l')} value={why} maxLength={160} onInput={setWhy} onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } }} data-eswhy />
        {rows.length > 0 && <Select label={t('class.es_row')} value={row} onChange={setRow} options={[{ value: '', label: t('class.es_no_row') }, ...rows.map(c => ({ value: c, label: c }))]} />}
      </aside>
    </div>
  </Dialog>;
}

/* a screenshot kept as a strong example or on the watch list (src/examples.js exSaveShot) */
// where: { st } on a paper, or nothing (any other screen: the teacher picks the class)
export function saveShot(blob, watch, st) { return mount(close => <ShotSave blob={blob} watch={watch} st={st} onClose={close} />); }
function ShotSave({ blob, watch, st, onClose }) {
  const { batch, lib } = state(), onWork = !!(batch && st);
  const classes = ((lib && lib.classes) || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const [cls, setCls] = useState(onWork ? (batchClass() || {}).id || '' : ''), [why, setWhy] = useState(''), [tags, setTags] = useState(''), [who, setWho] = useState(''), [known, setKnown] = useState([]), [busy, setBusy] = useState(false);
  // what she blacks out by hand (src/examples.js exsBind): fractions of the picture, painted in for good when it is kept
  const [im, setIm] = useState(null), [covers, setCovers] = useState([]), [box, setBox] = useState(null), cvs = useRef(null), drag = useRef(null);
  useEffect(() => { let bm = null; createImageBitmap(blob).then(b => { bm = b; setIm(b); }, e => console.error(e)); exampleRecords().then(l => setKnown([...new Set(l.filter(r => !!r.watch === !!watch).flatMap(exTags))].sort())).catch(() => {}); return () => { try { bm && bm.close(); } catch {} }; }, []);
  const paint = (c, W) => { const k = W / im.width; c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); g.fillStyle = '#111'; for (const r of covers) g.fillRect(Math.floor(r.x * c.width), Math.floor(r.y * c.height), Math.ceil(r.w * c.width) + 1, Math.ceil(r.h * c.height) + 1); };
  useEffect(() => { if (im && cvs.current) paint(cvs.current, Math.min(im.width, 1800)); }, [im, covers]);
  const down = e => { if (e.button !== 0 || !cvs.current) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { k: 0, r: cvs.current.getBoundingClientRect(), x: e.clientX, y: e.clientY }; };
  const move = e => { const d = drag.current; if (d) { const b = dragOf(d, e); setBox(b.moved ? b : null); } };
  const up = e => {
    const d = drag.current; if (!d) return; drag.current = null; const b = dragOf(d, e); setBox(null);
    if (b.moved) return setCovers(cs => [...cs, { x: b.x, y: b.y, w: b.w, h: b.h }]);
    const x = (e.clientX - d.r.left) / (d.r.width || 1), y = (e.clientY - d.r.top) / (d.r.height || 1);
    setCovers(cs => { const i = cs.map((r, j) => [r, j]).filter(([r]) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h).sort((a, z) => a[0].w * a[0].h - z[0].w * z[0].h)[0]; return i ? cs.filter((_, j) => j !== i[1]) : cs; });
  };
  const enter = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } };
  const c = classes.find(x => String(x.id) === String(cls)), mine = onWork ? X.exWho(st) : null;
  const save = async () => {
    if (busy) return; setBusy(true);
    try {
      if (!im) { setBusy(false); return; }
      const cv = document.createElement('canvas'); paint(cv, Math.min(im.width, 2400));
      const size = { w: cv.width, h: cv.height }, jpg = await X.exJpg(cv); cv.width = cv.height = 0;
      const all = await exampleRecords(), w = onWork ? { work: batch.id, asg: (batch.assignment && batch.assignment.id) || null, title: X.exTitleNow() } : { work: null, asg: null, title: nameFreeText(t('class.es_shots')) };
      const key = w.asg || (w.work ? 'w:' + w.work : 'loose:' + (cls || '-'));
      const n = 1 + Math.max(0, ...all.filter(r => !!r.watch === !!watch && r.kind === 'shot' && (r.asg || (r.work ? 'w:' + r.work : 'loose:' + (r.cls || '-'))) === key).map(r => parseInt(r.letter, 10) || 0));
      const rec = { id: uid() + uid(), t: Date.now(), kind: 'shot', ...w, cls: cls || null, q: null, row: null, why: why.trim().slice(0, 160), tags: tagsOf(tags, known), letter: String(n), pages: [size], marks: true, score: false,
        from: onWork ? X.exFrom(st) : null, who: mine || (who && cls ? { c: cls, n: who } : null), ...(watch ? { watch: 1 } : {}) };
      await keepExample(rec, [jpg]);
      onClose();
      toast(t(watch ? 'class.es_shot_watch' : 'class.es_shot_ex'), { action: { label: t('class.es_see'), run: () => go('library', 'examples', watch ? 'watch' : '') } });
    } catch (e) { setBusy(false); failed(e); }
  };
  return <Dialog open title={t(watch ? 'class.es_shot_wt' : 'class.es_shot_et')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} disabled={busy} data-esshot-save>{t('class.save')}</Button></>}>
    <div class="esuse" data-esshot>
      <div class="espv one"><div class="espg" onPointerDown={down} onPointerMove={move} onPointerUp={up} data-esshotpv><canvas ref={cvs} />
        {box && <div class="escrop cover" style={{ left: box.x * 100 + '%', top: box.y * 100 + '%', width: box.w * 100 + '%', height: box.h * 100 + '%' }} />}</div></div>
      <aside class="esside">
        <p class="mute small" data-esshotn>{covers.length > 0 && <b>{t('class.es_shot_n', { n: covers.length })} </b>}{onWork && t('class.es_shot_paper') + ' '}{t('class.es_shot_say')}</p>
        <TextInput label={t(watch ? 'class.ex_note_l' : 'class.ex_why_l')} value={why} maxLength={160} onInput={setWhy} onKeyDown={enter} data-eswhy />
        <TextInput label={t('class.ex_tags_l')} value={tags} maxLength={200} onInput={setTags} onKeyDown={enter} data-estags />
        {known.length > 0 && <div class="estags" role="group" aria-label={t('class.es_tags_used')}>{known.slice(0, 12).map(k => <button type="button" class="chip" onClick={() => setTags(tagsOf(tags + ',' + k, known).join(', '))} data-esaddtag={k}>{k}</button>)}</div>}
        {!onWork && <Select label={t('class.es_kept_with')} value={cls} onChange={v => { setCls(v); setWho(''); }} options={[{ value: '', label: t('class.es_no_class') }, ...classes.map(x => ({ value: String(x.id), label: x.name }))]} data-escls />}
        {mine ? <p class="mute small">{t('class.es_whose_is', { name: mine.n })}</p>
          : c && <Select label={t('class.es_whose')} value={who} onChange={setWho} options={[{ value: '', label: t('class.es_nobody') }, ...c.names.map(n => ({ value: n, label: n }))]} data-eswho />}
        <p class="mute small">{t('class.ex_only_you_say')}</p>
      </aside>
    </div>
  </Dialog>;
}
