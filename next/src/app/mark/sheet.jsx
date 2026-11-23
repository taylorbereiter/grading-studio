// The Grade sheet on the Grades tab (src/app/gradesheet.js openSheet, renderSheet, pickEach, pickSpot): one row for each paper, with
// the picture of where the grade is on it and what that reads as. A score she gave in the app is the student's score and always
// counts; a grade read off a paper is offered for a student with no score yet, or beside hers with "Also show grades found on the
// papers". A doubtful reading asks Use it or Not a grade, with a way back. Box each grade by hand goes paper by paper (left and right
// arrows, Esc finishes); Same spot on every paper crops one spot from each. The rows and the pictures are the lifted engine's
// (engines/gexport.js sheetRows, scanAll), so the downloaded PDF has the same rows. Loaded on its own (router.js PARTS.sheet).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Checkbox, Dialog, Progress, Segmented, toast } from '../../ui/index.js';
import { copyText } from '../../services/clipboard.js';
import { t } from '../../i18n/t.js';
import { state, use, gradeOf, maxPoints, fmtNum, noScore, ownGrade, refound, pdfjsLib } from '../../engines/gcore.js';
import { shownName, viewable, layoutOf, vpRot, skewXf, drawMarks, marksMine } from '../../engines/gdraw.js';
import * as K from '../../engines/gmark.js';
import * as W from '../../engines/gword.js';
import { prefs } from '../../students/prefs.js';
import { PARTS } from '../router.js';
import * as C from './change.js';
import './paper-lines.js';
import './setup-lines.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r4 = v => Math.round(v * 10000) / 10000;
async function copy(text, say) {
  toast(await copyText(text) ? say : t('copy.failed'));
}

// A Missing or Excused paper that now has a grade is neither any more (src/grades.js liftStatus), and says so
export function liftSay(st) {
  const was = st.grade.status;
  W.liftStatus(st);
  if ((was === 'missing' || was === 'excused') && !st.grade.status) toast(t(was === 'missing' ? 'paper.gs_lift_missing' : 'paper.gs_lift_excused'));
}
// What she says about a grade read off a paper (src/grades.js setReading): 1 use it, 0 not a grade, '' asks again. Picking one says
// the others on the paper aren't the grade. One undo step.
async function setReading(E, st, key, v) {
  const M = E.marking(), X = E.X, su = state().setup;
  const table = st.files.flatMap(f => W.wordFound(f, st)).find(g => g.table && X.readKey(g) === key);
  M.wordGrade(st, () => {
    const rd = (st.grade.reads ||= {}), was = rd[key];
    if (v === '') delete rd[key]; else rd[key] = +v;
    if (v === '1') for (const g of [...(st.foundAll || []), ...X.rivalReads(st)]) if (X.readKey(g) !== key) rd[X.readKey(g)] = 0;
    if (table && was === 1 && v !== '1' && ownGrade(st).total === table.score) { if (su.mode === 'rubric') st.grade.rubric = []; else st.grade.points = ''; }
    refound(st); K.touchGrade(st);
    if (v === '1') liftSay(st);
  });
  if (table && v === '1') await (await PARTS.word()).scoresAll(M);   // Use it brings the rows in, when they fit this assignment
}

function Big({ v, of, pct }) {
  return <><button type="button" class="big-sc" title={t('paper.gs_copy_tip')} onClick={() => copy(fmtNum(v), t('paper.gs_copied', { v: fmtNum(v) }))} data-copy={fmtNum(v)}>{fmtNum(v)}{of ? <small>/ {fmtNum(of)}</small> : null}</button>
    {pct != null && <div class="mute gs-pct">= {fmtNum(pct)}%</div>}</>;
}
// Her score, on the student's first row.
function AppScore({ E, st }) {
  if (noScore(st)) return <div class="big-sc">{E.X.STATUS_LABEL[st.grade.status]}</div>;
  const g = gradeOf(st), max = g.outOf != null ? g.outOf : maxPoints();
  return <><Big v={g.total} of={max} pct={g.pct} /><div class="mute gs-sm">{t(g.partial ? 'paper.gs_yours_part' : g.tries ? 'paper.gs_yours_try' : 'paper.gs_yours')}</div></>;
}
// What the paper says beside her score, when she asks for it.
function FoundBeside({ E, st, list, found }) {
  if (!found || noScore(st) || !list.length) return null;
  const g = gradeOf(st), own = list.filter(r => !r.stamp);
  if (!own.length) return null;
  const off = own.some(r => r.score != null ? Math.abs(r.score - g.total) > 0.001 : r.pct != null && g.pct != null && Math.abs(r.pct - g.pct) > 1);
  return <><div class="mute gs-sm">{t('paper.gs_found', { list: own.map(r => E.X.foundLabel(r)).join(', ') })}</div>{off && <span class="gs-warn">{t('paper.gs_else')}</span>}</>;
}
// Is this the grade? Use it, Not a grade; and the answers she gave, each with Undo.
function Reads({ E, st, r, onSay }) {
  const X = E.X, many = X.manyReads(st), pick = many ? r.ok.filter(g => !r.mine.includes(g)) : [];
  const say = (g, v) => onSay(st, X.readKey(g), v);
  return <>{pick.concat(r.ask).map(g => <div class="rd-ask"><span class="stag">{t('paper.gs_is_it')}</span><b>{X.foundLabel(g)}</b>
      {g.text && <div class="mute" data-raw>{t('paper.gs_from', { text: g.text })}</div>}
      <div>{many && !g.counts ? t('paper.gs_many') : X.readingDoubt(g)}</div>
      <Button size="sm" onClick={() => say(g, '1')} data-rd="1">{t('paper.gs_use')}</Button> <Button size="sm" onClick={() => say(g, '0')} data-rd="0">{t('paper.gs_not')}</Button></div>)}
    {r.yes.filter(g => !pick.includes(g)).map(g => <div class="rd-no">{t('paper.gs_said_yes', { v: X.foundLabel(g) })} <button type="button" class="link" onClick={() => say(g, '')} data-rd="">{t('paper.gs_undo')}</button></div>)}
    {r.no.map(g => <div class="rd-no">{t('paper.gs_said_no', { v: X.foundLabel(g) })} <button type="button" class="link" onClick={() => say(g, '')} data-rd="">{t('paper.gs_undo')}</button></div>)}</>;
}
function Typed({ E, st, i }) {
  return <><input class="input sc-in" type="text" inputmode="decimal" value={st.grade.sheet ?? ''} placeholder={t('paper.gs_score')} aria-label={t('paper.gs_type_tip')} data-typed={i}
    onInput={e => { const v = e.currentTarget.value.trim().replace(',', '.'); E.marking().wordGrade(st, () => { st.grade.sheet = v; K.scoreTouched(st); }); }} />
    <div class="mute gs-sm">{t('paper.gs_type')}</div></>;
}

export function Sheet({ E, onOpen }) {
  const [busy, setBusy] = useState(0.001), [, tick] = useState(0), [each, setEach] = useState(null), [spot, setSpot] = useState(false), [cpAsk, setCpAsk] = useState(null);
  const again = () => tick(n => n + 1);
  const scan = async () => { setBusy(0.001); await E.readPapers((n, of) => setBusy(of ? Math.max(0.001, n / of) : 0.001)); setBusy(0); again(); };
  useEffect(() => { scan(); }, []);
  const X = E.X, s = state(), b = s.batch, su = s.setup, now = X.sheetNow();
  const flag = (k, pref, v) => { X.sheetSet({ [k]: v }); if (pref) { if (v) prefs.set(pref, true); else prefs.del(pref); } again(); };
  const onSay = async (st, key, v) => { await setReading(E, st, key, v); again(); };
  // Copy all scores (gradesheet.js data-cp): one a line in the list's order, blank where unsure; partly scored totals are asked first (okPartial)
  const copyAll = sure => {
    const part = b.students.filter(st => gradeOf(st).partial);
    if (part.length && !sure) return setCpAsk(part);
    setCpAsk(null);
    copy(b.students.map(st => X.scoreText(gradeOf(st), 'any')).join('\n'), t('paper.gs_cp_done', { n: b.students.length }));
  };
  if (busy) return <div class="mk-sheet"><p class="mute">{t('paper.gs_looking')}</p><Progress value={busy} label={t('paper.gs_looking')} /></div>;
  const rows = X.sheetRows();
  const nOut = b.students.reduce((a, st) => a + st.files.filter(f => viewable(f) && !X.fileIn(st, f)).length, 0);
  const asked = st => !X.appScored(st) || now.found;
  const nApp = b.students.filter(X.appScored).length, nOne = b.students.filter(st => !X.appScored(st) && st.found).length;
  const nMany = b.students.filter(st => asked(st) && X.manyReads(st)).length, nAsk = b.students.reduce((a, st) => a + (asked(st) && st.doubts && !X.manyReads(st) ? st.doubts.length : 0), 0);
  const spotted = !!su.spot || b.students.some(st => st.files.some(f => f.hand));
  const trim = !!(s.disp || {}).trim;
  const setTrim = v => { const d = { ...(s.disp || {}), trim: v }; use({ disp: d }); prefs.set('gs.disp', d); X.sheetSet({}); b.students.forEach(st => st.files.forEach(f => { f.scan = undefined; })); scan(); };
  const leave = (st, f, on) => { for (const d of layoutOf(st)) if (d.pages.some(([q]) => q === f.path)) C.setIn(st, d, on); refound(st); again(); };
  const fmCount = () => t('paper.gs_fb', { n: b.students.filter(st => !noScore(st) && st.grade.fb).length, of: b.students.filter(st => !noScore(st)).length });
  const sub = [su.spot ? t('paper.gs_spot_on') : '', K.fmNow() ? fmCount() : t('paper.gs_scored', { n: nApp, of: b.students.length }), nOne ? t('paper.gs_read_n', { n: nOne }) : '', nMany ? t('paper.gs_check_n', { n: nMany }) : '', nAsk ? t('paper.gs_confirm_n', { n: nAsk }) : ''].filter(Boolean).join(' · ');
  return <div class="mk-sheet" data-sheet>
    <p class="mute" data-sheetsub>{sub}</p>
    <p class="mute">{t('paper.gs_help')}</p>
    <div class="gs-opts">
      <Checkbox label={t('paper.gs_also')} checked={now.found} onChange={v => flag('found', 'gs.sheetfound', v)} />
      <Checkbox label={t('paper.gs_all')} checked={now.all} onChange={v => flag('all', 'gs.sheetall', v)} />
      {spotted && <Checkbox label={t('paper.gs_trim')} checked={trim} onChange={setTrim} />}
    </div>
    {nOut > 0 && <p class="gs-note">{t('paper.gs_out', { n: nOut })} <button type="button" class="link" onClick={() => flag('out', null, !now.out)} data-showout>{t(now.out ? 'paper.gs_out_hide' : 'paper.gs_out_show')}</button></p>}
    <div class="tbl"><table class="gl gs-tbl"><thead><tr><th>#</th><th>{t('paper.gs_where')}</th><th>{t('paper.gs_paper')}</th><th>{t('paper.gs_read')}</th></tr></thead><tbody>
      {rows.map(({ st, i, f, out, none, word, nograde, first }, at) => {
        const app = X.appScored(st), lead = rows.findIndex(r => r.st === st && !r.out) === at;
        const appCell = lead ? <AppScore E={E} st={st} /> : <span class="mute gs-sm">{t('paper.gs_above')}</span>;
        const where = <><div class="gs-who" data-raw>{shownName(st, i)}</div>{f && <div class="mute gs-sm gs-path" data-raw>{f.name}</div>}</>;
        const rebox = ff => <button type="button" class="link gs-sm" onClick={() => setEach(i + '|' + ff.path)} data-rebox={i + '|' + ff.path}>{t(ff.hand ? 'paper.gs_reboxed' : 'paper.gs_box')}</button>;
        const pic = g => <div class="gs-pic"><img src={g.img} alt="" title={t('paper.gs_open')} onClick={() => onOpen(i)} data-open={i} />
          <div class="mute gs-sm" data-raw={g.text && g.from === 'note' ? '' : undefined}>{g.text && g.from === 'note' ? t('paper.gs_typed_p', { text: g.text, p: g.page + 1 }) : t('paper.gs_page', { p: g.page + 1 })}</div></div>;
        if (!f) return <tr><td class="n">{i + 1}</td><td>{where}</td><td class="mute">{none ? t('paper.gs_nothing') : nograde ? <>{t('paper.gs_no_grade')} {rebox(first)}</> : t('paper.gs_only_out')}</td><td>{app ? appCell : null}</td></tr>;
        if (out) return <tr class="gs-outrow"><td class="n">{i + 1}</td><td>{where}</td><td class="mute">{t('paper.gs_left')} <button type="button" class="link" onClick={() => leave(st, f, true)} data-bring>{t('paper.gs_bring')}</button></td><td /></tr>;
        if (word) {
          const w = f.wscore, tyAll = W.wordFound(f, st), rdw = X.splitReads(st, tyAll), ty = rdw.ok, hs = X.appShots(st, f, (f.hand && f.scan && f.scan.shots) || []), hf = (f.hand && f.scan && f.scan.found) || [];
          const reads = app ? <>{appCell}{lead && <FoundBeside E={E} st={st} list={tyAll.concat(hf)} found={now.found} />}</>
            : w && w.total != null && (f.virtual || ty.length) ? <Big v={w.total} of={w.max} pct={w.pct} />
            : ty.length ? (X.manyReads(st) ? <span class="pill warn">{t('paper.gs_many_n', { n: X.readsCount(st) })}</span> : ty.map(g => <Big v={g.score != null ? g.score : g.pct} of={g.score != null ? g.outOf : null} pct={g.score != null ? g.pct : null} />))
            : hf.length === 1 ? <Big v={hf[0].score != null ? hf[0].score : hf[0].pct} of={hf[0].outOf} pct={hf[0].score != null ? hf[0].pct : null} />
            : hs.length ? <Typed E={E} st={st} i={i} />
            : rdw.ask.length ? null : <span class="mute">{t('paper.gs_none_yet')}</span>;
          return <tr><td class="n">{i + 1}</td><td>{where}</td><td>{hs.map(pic)}<button type="button" class="link" onClick={() => onOpen(i)}>{t(w ? 'paper.gs_word_rubric' : 'paper.gs_word')}</button>
            {w && <div class="mute gs-sm" data-raw>{w.crits.map((c, k) => (c.length > 28 ? c.slice(0, 28) + '…' : c) + ' ' + (w.per[k] == null ? '–' : fmtNum(w.per[k]))).join(' · ')}</div>}
            {w && w.total != null && !w.done && <div class="mute gs-sm">{t('paper.gs_not_all')}</div>}
            {tyAll.filter(g => !g.table).map(g => <div class="mute gs-sm" data-raw>{t('paper.gs_typed', { text: g.text })}</div>)}
            <div>{rebox(f)}</div></td>
            <td class="gs-r">{reads}<Reads E={E} st={st} r={app && !now.found ? X.quietReads(rdw) : rdw} onSay={onSay} /></td></tr>;
        }
        const sc = f.scan || { found: [], shots: [] }, rdf = X.splitReads(st, sc.found), okF = rdf.ok, many = (!app || now.found) && X.manyReads(st), shots = X.appShots(st, f, sc.shots);
        const why = f.hand ? t('paper.gs_boxed') : app && !sc.err ? t('paper.gs_no_stamp') : sc.err ? t('paper.gs_cant') : sc.seen && sc.seen.length ? t('paper.gs_seen', { text: sc.seen.join('” · “') }) : sc.nAnnots ? t('paper.gs_flat') : t('paper.gs_blank');
        let reads = null;
        if (app) reads = <>{appCell}{lead && <FoundBeside E={E} st={st} list={sc.found} found={now.found} />}</>;
        else if (okF.length === 1 && !many) { const g0 = okF[0]; reads = g0.score != null ? <Big v={g0.score} of={g0.outOf} pct={g0.pct} /> : <Big v={g0.pct} />; }
        else if (okF.length && !many) reads = okF.map(g => <div><button type="button" class="link" onClick={() => copy(fmtNum(g.score != null ? g.score : g.pct), t('paper.gs_copied', { v: X.foundLabel(g) }))}>{X.foundLabel(g)}</button></div>);
        else if (!okF.length && sc.shots.length && !rdf.ask.length) reads = <Typed E={E} st={st} i={i} />;
        const own = ownGrade(st), ps = okF.length === 1 ? okF[0].score : okF.length ? null : X.paperScore(st);
        const yours = !app && own.total != null && ps != null && Math.abs(own.total - ps) > 0.001;
        return <tr><td class="n">{i + 1}</td><td>{where}</td>
          <td class={many ? 'gs-many' : ''}>{shots.length ? shots.map(pic) : <span class="mute gs-sm" data-raw>{why}</span>}
            <div class="gs-acts">{rebox(f)}<button type="button" class="link gs-sm mute" onClick={() => leave(st, f, false)} data-leave>{t('paper.gs_leave')}</button></div></td>
          <td class="gs-r">{many && <span class="pill warn">{t('paper.gs_many_n', { n: X.readsCount(st) })}</span>}{reads}
            {yours && <span class="gs-warn">{t('paper.gs_yours_is', { v: fmtNum(own.total) + (own.partial ? ' ' + t('paper.gs_partial') : '') })}</span>}
            <Reads E={E} st={st} r={app && !now.found ? X.quietReads(rdf) : rdf} onSay={onSay} /></td></tr>;
      })}</tbody></table></div>
    <footer class="of">
      <Button onClick={() => setEach('')} data-each>{t('paper.gs_each')}</Button>
      <Button onClick={() => setSpot(true)} data-spot>{t(su.spot ? 'paper.gs_spot_change' : 'paper.gs_spot')}</Button>
      <Button onClick={() => copyAll(false)} data-cpall>{t('paper.gs_cp')}</Button>
      {su.spot && <Button onClick={async () => { delete su.spot; await E.marking().keepSetup(); b.students.forEach(st => st.files.forEach(f => { f.scan = undefined; })); scan(); }} data-spotoff>{t('paper.gs_spot_off')}</Button>}
    </footer>
    {cpAsk && <Dialog open title={t('paper.gs_cp')} onClose={() => setCpAsk(null)}
      actions={<><Button onClick={() => setCpAsk(null)}>{t('setup.cancel')}</Button><Button variant="primary" onClick={() => copyAll(true)} data-cpanyway>{t('paper.gs_cp_anyway')}</Button></>}>
      <p data-cpask>{t('paper.gs_cp_ask', { n: cpAsk.length, names: cpAsk.slice(0, 8).map(st => shownName(st, b.students.indexOf(st))).join(', ') + (cpAsk.length > 8 ? ' ' + t('paper.gs_cp_more', { n: cpAsk.length - 8 }) : '') })}</p></Dialog>}
    {each != null && <BoxEach E={E} start={each || null} onDone={() => { setEach(null); scan(); }} />}
    {spot && <PickSpot E={E} onDone={used => { setSpot(false); if (used) { b.students.forEach(st => st.files.forEach(f => { f.scan = undefined; })); scan(); } }} />}
  </div>;
}

// One page of a file drawn into a canvas at k points a pixel, with her marks (not comments), for boxing a spot on it.
async function drawPage(doc, f, p, k) {
  const page = await doc.getPage(p + 1), dpr = window.devicePixelRatio || 1, v1 = vpRot(f, p, page, 1), vp = vpRot(f, p, page, k * dpr);
  const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  Object.assign(c.style, { width: v1.width * k + 'px', height: v1.height * k + 'px' });
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, transform: skewXf(f, p, vp), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const mk = marksMine((f.marks || {})[p] || [], f).filter(m => m.t !== 'note');
  if (mk.length) { ctx.save(); ctx.scale(k * dpr, k * dpr); drawMarks(ctx, mk, v1.width, v1.height, 0, null); ctx.restore(); }
  page.cleanup();
  return { c, v1 };
}
// A Word paper is made into pages to box on, as Convert to PDF makes them (mark/change.js toPdf): the Word part and html2canvas first.
async function wordReady() { await PARTS.word(); await (await PARTS.outEngine()).wordTools(); }
// A box dragged on a canvas, as fractions of it. onBox(sel) when let go; paint(sel) shows one.
function boxer(c, onBox) {
  const ctx = c.getContext('2d'), base = ctx.getImageData(0, 0, c.width, c.height), dpr = window.devicePixelRatio || 1;
  const paint = sel => {
    ctx.putImageData(base, 0, 0); if (!sel) return;
    ctx.fillStyle = 'rgba(31,111,178,.14)'; ctx.fillRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
    ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
  };
  let d0 = null, sel = null;
  const rel = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); d0 = rel(e); sel = null; };
  c.onpointermove = e => { if (!d0) return; const [x, y] = rel(e); sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint(sel); };
  c.onpointerup = () => { if (!d0) return; d0 = null; onBox(sel, paint); };
  return paint;
}

// Box each grade by hand: one paper at a time; a box around the grade saves it and goes to the next. Left and right arrows go back
// and on, Esc finishes.
function BoxEach({ E, start, onDone }) {
  const b = state().batch, X = E.X, list = useRef(null), body = useRef(null), [pos, setPos] = useState(-1), [msg, setMsg] = useState('');
  if (!list.current) list.current = X.sheetRows(true).filter(r => r.f && (viewable(r.f) || r.f.kind === 'docx'));
  const L = list.current;
  useEffect(() => {
    if (!L.length) { toast(t('paper.gs_none_to_box')); onDone(); return; }
    setPos(start != null ? Math.max(0, L.findIndex(r => r.i + '|' + r.f.path === start)) : Math.max(0, L.findIndex(r => !r.f.hand)));
  }, []);
  const go = d => setPos(p => { const n = p + d; if (n >= L.length) { toast(t('paper.gs_last')); setTimeout(onDone); return p; } return Math.max(0, n); });
  useEffect(() => {
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
    };
    addEventListener('keydown', key, true); return () => removeEventListener('keydown', key, true);
  }, []);
  useEffect(() => {
    if (pos < 0 || !body.current) return;
    let live = true; const { f } = L[pos], host = body.current; host.replaceChildren(); host.scrollTop = 0; setMsg(f.kind === 'docx' && f.wpdfOf !== f.data ? t('paper.gs_word_wait') : '');
    (async () => {
      let doc;
      try { if (f.kind === 'docx') await wordReady(); doc = await pdfjsLib.getDocument({ data: (await X.paperBytes(f)).slice(), isEvalSupported: false }).promise; }
      catch (e) { console.error(e); if (live) setMsg(t('paper.gs_cant_open')); return; }
      if (!live) { doc.destroy(); return; }
      setMsg('');
      const avail = host.clientWidth - 40;
      for (let p = 0; p < doc.numPages && live; p++) {
        const pg0 = await doc.getPage(p + 1), v = vpRot(f, p, pg0, 1);
        const k = f.kind === 'docx' ? Math.min(1.5, avail / v.width) : Math.min(1.8, avail / v.width, Math.max(host.clientHeight - 50, 480) / v.height);
        const { c } = await drawPage(doc, f, p, k); if (!live) break;
        c.dataset.boxpage = p;
        const paint = boxer(c, (sel, paint) => {
          if (!sel || sel.w < 0.015 || sel.h < 0.008) { paint(f.hand && f.hand.page === p ? f.hand : null); return; }
          f.hand = { page: p, x: r4(sel.x), y: r4(sel.y), w: r4(sel.w), h: r4(sel.h) }; f.scan = undefined; E.marking().changedNow();
          paint(sel); setTimeout(() => { if (live) go(1); }, 250);
        });
        if (f.hand && f.hand.page === p) paint(f.hand);
        host.appendChild(c);
      }
      doc.destroy();
    })();
    return () => { live = false; };
  }, [pos]);
  const r = L[pos];
  return <Dialog open title={r ? shownName(r.st, r.i) : t('paper.gs_box_title')} onClose={onDone}
    actions={<><span class="mute gs-sm grow">{t('paper.gs_box_help')}</span><Button disabled={pos <= 0} onClick={() => go(-1)} data-back>{t('paper.gs_back')}</Button><Button onClick={() => go(1)} data-skip>{t('paper.gs_skip')}</Button><Button variant="primary" onClick={onDone} data-done>{t('paper.gs_done')}</Button></>}>
    <div class="mk-bx">{r && <p class="mute gs-sm" data-raw>{t('paper.gs_box_count', { n: r.i + 1, of: b.students.length, p: pos + 1, pof: L.length })} · {r.f.name}{r.f.hand ? ' · ' + t('paper.gs_box_again') : ''}</p>}
      {msg && <p class="mute">{msg}</p>}<div ref={body} class="bxpages" /></div>
  </Dialog>;
}

// Same spot on every paper: a box on the first or last page of the first paper, cropped from every paper.
function PickSpot({ E, onDone }) {
  const su = state().setup, b = state().batch, st = b.students.find(x => x.files.some(f => viewable(f))), f = st && st.files.find(x => viewable(x));
  const [which, setWhich] = useState((su.spot && su.spot.page) || 'first'), [sel, setSel] = useState(null), host = useRef(null);
  useEffect(() => { if (!f) { toast(t('paper.gs_none_to_pick')); onDone(false); } }, []);
  useEffect(() => {
    if (!f || !host.current) return; let live = true; setSel(null);
    (async () => {
      const doc = await pdfjsLib.getDocument({ data: (await E.X.paperBytes(f)).slice(), isEvalSupported: false }).promise;
      const pn = which === 'last' ? doc.numPages - 1 : 0, pg0 = await doc.getPage(pn + 1), k = Math.min(1.4, 640 / vpRot(f, pn, pg0, 1).width);
      const { c } = await drawPage(doc, f, pn, k); doc.destroy(); if (!live) return;
      c.dataset.spotpage = '';
      boxer(c, (s, paint) => { const ok = s && s.w >= 0.02 && s.h >= 0.01 ? s : null; paint(ok); setSel(ok); });
      host.current.replaceChildren(c);
    })().catch(e => console.error(e));
    return () => { live = false; };
  }, [which]);
  const keep = async () => { su.spot = { page: which, ...sel }; await E.marking().keepSetup(); onDone(true); };
  return <Dialog open title={t('paper.gs_spot_title')} onClose={() => onDone(false)}
    actions={<><Button onClick={() => onDone(false)}>{t('paper.gs_cancel')}</Button><Button variant="primary" disabled={!sel} onClick={keep} data-spotuse>{t('paper.gs_spot_use')}</Button></>}>
    <div class="mk-bx"><p>{t('paper.gs_spot_help')}</p>
      <Segmented label={t('paper.gs_spot_page')} size="sm" value={which} onChange={setWhich} options={[{ value: 'first', label: t('paper.gs_first') }, { value: 'last', label: t('paper.gs_lastp') }]} />
      <div ref={host} class="bxpages" /></div>
  </Dialog>;
}
