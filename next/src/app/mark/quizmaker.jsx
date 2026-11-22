// Make a quiz (src/quizmake.js openQuizMaker), loaded as a part of its own (router.js PARTS.quizmaker) from an assignment's menu on
// the class page: questions typed in (multiple choice, true or false, pick all that apply, short answer), each with its points and
// right answer, shown as the printed pages beside them, questions and bubbles or the answer sheet only, with the answers shown or
// not. Save keeps the quiz on the assignment, with its Quick mark boxes measured from the pages (engines/gqmake.js qmkBoxes), as one
// undo step (students/undo.js libraryChange). Print opens every student's copy with their name, then the blank copies, in a print
// window, which can also save it as a PDF. Scanned copies come back through Bring in papers > A scan, where the code on each page
// sends it to its student, and the bubbles are read when the papers open (mark/quizread.jsx).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Segmented, Checkbox, toast, useModal, HeldInput } from '../../ui/index.js';
import { fmtNum } from '../../engines/gcore.js';
import * as K from '../../engines/gqmake.js';
import { libraryChange } from '../../students/undo.js';
import { t, useLanguage } from '../../i18n/t.js';
import { lines } from '../lang-load.js';
import './lines.js';
import './paper-lines.js';
import '../engine-lines.js';   // the engines' own words (a printed quiz) in the language

const J = v => JSON.parse(JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2, 10);
const TYPES = () => [['mc', t('paper.qf_mc')], ['tf', t('paper.qf_tf')], ['ms', t('paper.qf_ms')], ['sa', t('paper.qf_sa')]];
// The printed page's own look, as the current app adds it once: paper stays black on white whatever the theme.
function pageCss() { if (document.getElementById('qfPageCss')) return; const s = document.createElement('style'); s.id = 'qfPageCss'; s.textContent = K.QMK_CSS + '.qfprobe{position:absolute;left:-9999px;top:0;visibility:hidden}'; document.head.appendChild(s); }
const itemIn = (l, id) => { for (const c of [...l.classes, l.loose]) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };

// The language a quiz's pages are laid out and printed in. Its words are in the pages, so another language moves the bubbles: once
// copies are printed (m.lay), the quiz keeps the language they were printed in (m.lang), so printing again, or saving it from a
// screen in another language, leaves the bubbles where the printed copies have them and the scan still reads them. A quiz printed
// before m.lang was kept was printed in English: the current app's printed quiz is always English (src/quizmake.js).
// The language on screen is the page's (app/language.js setLanguage, at the start).
const onScreen = () => document.documentElement.lang || 'en';
const printedIn = m => (m.lay != null ? m.lang || 'en' : onScreen());
// Runs fn (it draws or measures pages, synchronously) with the engines' words in the quiz's language; lang is from langFor.
const inLang = (lang, fn) => { if (!lang) return fn(); useLanguage(lang.code, lang.lines); try { return fn(); } finally { useLanguage(lang.now, lang.was); } };
async function langFor(m) {
  const now = onScreen(), code = printedIn(m);
  if (code === now) return null;
  const [was, l] = await Promise.all([lines(now), lines(code)]);
  return { code, lines: l, now, was };
}
// Every student's copy with their name, in roster order, then the blank copies (qmkPrint).
export function printQuiz(it, m, names, lang) {
  const all = inLang(lang, () => [...names, ...Array(m.blank || 0).fill('')].flatMap((n, k) => K.qmkPages(m, it.name, n, n ? k + 1 : 0)));
  const w = window.open('', '_blank'); if (!w) return toast(t('paper.qf_blocked'));
  const fonts = [...document.styleSheets].map(s => { try { return [...s.cssRules].filter(r => r instanceof CSSFontFaceRule).map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
  const title = String(it.name).replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;'));
  const tag = n => '<' + n + '>';
  w.document.write('<!doctype html>' + tag('title') + title + tag('/title') + tag('style') + fonts + K.QMK_CSS + '@page{size:letter;margin:0}body{margin:0;font-family:Inter,Arial,sans-serif}.qfpage{break-after:page;box-shadow:none}</style>' + all.join(''));
  w.document.close(); w.document.fonts.ready.then(() => setTimeout(() => w.print(), 200));
}

function QCard({ q, i, on, sheet, n, onPick, set, re }) {
  const L = K.qmkLetters(q);
  return <div class={'qfc' + (on ? ' on' : '')} onFocusIn={onPick} data-qfc={i}>
    <div class="qfch"><b>{i + 1}</b><select class="input sm" value={q.t} aria-label={t('paper.qf_kind')} onChange={e => set(i, e.currentTarget.value)} data-qt>{TYPES().map(([k, l]) => <option value={k}>{l}</option>)}</select>
      <label class="qfpts"><span>{t('paper.qf_pts')}</span><HeldInput class="input sm" type="number" min="0.5" step="0.5" value={String(q.pts)} onChange={e => { q.pts = Math.max(0.5, +e.currentTarget.value || 1); re(); }} data-qp /></label>
      <IconButton icon="chu" size="sm" label={t('paper.qf_up')} disabled={!i} onClick={() => set(i, 'up')} data-qup />
      <IconButton icon="x" size="sm" label={t('paper.qf_del')} disabled={n === 1} onClick={() => set(i, 'del')} data-qdel /></div>
    <textarea class="input" rows={2} value={q.text} placeholder={sheet ? t('paper.qf_text_ph_sheet') : t('paper.qf_text_ph')} aria-label={t('paper.qf_text', { n: i + 1 })} onInput={e => { q.text = e.currentTarget.value; re(); }} data-qx data-raw />
    {q.t === 'sa' ? <p class="mute">{t('paper.qf_sa_say', { n: fmtNum(+q.pts || 1) })}</p>
      : <div class="qfopts">{q.opts.map((o, k) => { const l = L[k], is = (q.key || '').includes(l);
        return <div class="qfo"><button type="button" class={'qfkey' + (is ? ' on' : '')} aria-pressed={is ? 'true' : 'false'} title={is ? t('paper.qf_is_key') : t('paper.qf_make_key')} onClick={() => { q.key = q.t === 'ms' ? (q.key.includes(l) ? q.key.replace(l, '') : (q.key + l).split('').sort().join('')) : l; re(); }} data-qk={l}>{l}</button>
          {q.t === 'tf' ? <span>{k ? t('paper.qf_false') : t('paper.qf_true')}</span>
            : <><input class="input sm" value={o} placeholder={t('paper.qf_choice', { l })} aria-label={t('paper.qf_choice', { l })} onInput={e => { q.opts[k] = e.currentTarget.value; re(); }} data-qo={k} data-raw />
              {q.opts.length > 2 && <IconButton icon="x" size="sm" label={t('paper.qf_choice_del', { l })} onClick={() => { q.opts.splice(k, 1); q.key = q.key.split('').filter(x => x !== l).map(x => (K.QMK_L.indexOf(x) > k ? K.QMK_L[K.QMK_L.indexOf(x) - 1] : x)).join(''); re(); }} data-qod={k} />}</>}</div>; })}
        {q.t !== 'tf' && q.opts.length < 8 && <button type="button" class="link" onClick={() => { q.opts.push(''); re(); }} data-qadd>{t('paper.qf_add_choice')}</button>}
        <p class={q.key ? 'mute' : 'qfwarn'}>{q.key ? (q.t === 'ms' ? t('paper.qf_keys', { list: q.key.split('').join(', ') }) : t('paper.qf_key', { k: q.t === 'tf' ? (q.key === 'T' ? t('paper.qf_true') : t('paper.qf_false')) : q.key })) : t('paper.qf_no_key')}</p></div>}
  </div>;
}

// it: the assignment (its card in the library); names: the class roster, in order.
export function QuizMaker({ it, names, onClose }) {
  pageCss();
  const M = useRef(null);
  if (!M.current) M.current = J((it.quiz && it.quiz.made) || { id: 1 + Math.floor(Math.random() * 250), items: [K.qmkNew('mc'), K.qmkNew('mc'), K.qmkNew('tf'), K.qmkNew('sa')], sheet: 0, blank: 2 });
  const m = M.current;
  // the starting questions' words are the app's own, in the language it is in
  if (!it.quiz) for (const q of m.items) if (q.t === 'tf') q.opts = [t('paper.qf_true'), t('paper.qf_false')];
  const [sel, setSel] = useState(0), [show, setShow] = useState(false), [, again] = useState(0), [busy, setBusy] = useState(false);
  const re = () => again(n => n + 1);
  const p = useModal(true, onClose), ed = useRef();
  // the quiz's language, when it is not the screen's (printedIn): the preview shows the pages as they print
  const L = useRef(null);
  if (!L.current) L.current = langFor(m).catch(e => { console.error(e); return null; });
  const [lang, setLang] = useState(null);
  useEffect(() => { L.current.then(setLang); }, []);
  const set = (i, what) => {
    if (what === 'up') { [m.items[i - 1], m.items[i]] = [m.items[i], m.items[i - 1]]; setSel(i - 1); }
    else if (what === 'del') { m.items.splice(i, 1); setSel(s => Math.min(s, m.items.length - 1)); }
    else { const n = K.qmkNew(what), o = m.items[i]; n.text = o.text; n.pts = o.pts; if (n.t === 'tf') n.opts = [t('paper.qf_true'), t('paper.qf_false')]; if (n.opts.length && o.opts.length > 2 && what !== 'tf') n.opts = o.opts; m.items[i] = n; }
    re();
  };
  const add = k => { const n = K.qmkNew(k); if (k === 'tf') n.opts = [t('paper.qf_true'), t('paper.qf_false')]; m.items.push(n); setSel(m.items.length - 1); re();
    setTimeout(() => { const c = ed.current && ed.current.querySelector('[data-qfc="' + (m.items.length - 1) + '"] textarea'); if (c) { c.scrollIntoView({ block: 'nearest' }); c.focus(); } }, 0); };
  const pages = inLang(lang, () => K.qmkPages({ ...m, show }, it.name, names[0] || t('paper.qf_name')));
  const auto = m.items.filter(q => q.t !== 'sa').length, sa = m.items.length - auto;
  const save = async print => {
    m.blank = Math.max(0, Math.min(40, +m.blank || 0));
    for (const q of m.items) q.id ||= 'mq' + uid();
    if (print) m.names = names.slice();   // who each printed copy is for, by its number in the code, whatever the roster becomes
    const lang = await L.current;
    const Q = inLang(lang, () => K.qmkBoxes(m, it.name, it.quiz)), moved = m.lay != null && m.ver !== (m.pv || 0);
    if (print) { m.lang = printedIn(m); m.pv = m.ver; m.lay = JSON.stringify(Q.qs.map(q => [q.n, q.auto.b])); }
    const quiz = { ...Q, made: J(m) };
    setBusy(true);
    try { await libraryChange(t('paper.qf_step'), l => { const f = itemIn(l, it.id); if (f) f.it.quiz = J(quiz); }, true); }
    catch (e) { console.error(e); setBusy(false); return toast(t('mark.cannot')); }
    if (print) printQuiz(it, m, names, lang);
    onClose();
    toast(moved ? t('paper.qf_saved_moved') : t('paper.qf_saved'));
  };
  return <dialog class="dlg mk-qf" aria-labelledby="qfT" {...p} data-qf>
    <header><h2 id="qfT">{t(it.quiz && it.quiz.made ? 'paper.qf_title_edit' : 'paper.qf_title')}</h2><span class="mute" data-raw>{it.name}</span></header>
    <div class="body qfwrap">
      <div class="qfed" ref={ed}>{m.items.map((q, i) => <QCard key={q.id} q={q} i={i} n={m.items.length} on={i === sel} sheet={!!m.sheet} onPick={() => { if (sel !== i) setSel(i); }} set={set} re={re} />)}
        <div class="qfadd"><span class="mute">{t('paper.qf_add')}</span>{TYPES().map(([k, l]) => <Button size="sm" icon="plus" onClick={() => add(k)} data-qnew={k}>{l}</Button>)}</div></div>
      <div class="qfprev"><div class="qfpbar"><Segmented size="sm" label={t('paper.qf_print_as')} value={String(m.sheet || 0)} onChange={v => { m.sheet = +v; re(); }} options={[{ value: '0', label: t('paper.qf_both') }, { value: '1', label: t('paper.qf_sheet') }]} />
        <Checkbox checked={show} onChange={setShow} label={t('paper.qf_show')} /></div>
        <div class="qfpages" data-qfpages data-raw>{pages.map((x, k) => <div class="qfscale" dangerouslySetInnerHTML={{ __html: x.replace('data-i="' + sel + '"', 'data-i="' + sel + '" data-on') }} />)}</div></div>
    </div>
    <footer><span class="mute grow" data-qfsum>{t('paper.qf_sum', { n: m.items.length, pts: fmtNum(K.qmkPts(m)), pages: pages.length, auto, sa })}</span>
      <label class="qfblank"><span>{t('paper.qf_blank')}</span><input class="input sm" type="number" min="0" max="40" value={String(m.blank || 0)} onInput={e => { m.blank = +e.currentTarget.value || 0; }} data-qfblank /></label>
      <Button onClick={onClose} data-qfcancel>{t('paper.qf_cancel')}</Button><Button disabled={busy} onClick={() => save(false)} data-qfsave>{t('paper.qf_save')}</Button>
      <Button variant="primary" disabled={busy} onClick={() => save(true)} data-qfprint>{t('paper.qf_print', { n: names.length })}</Button></footer>
  </dialog>;
}
