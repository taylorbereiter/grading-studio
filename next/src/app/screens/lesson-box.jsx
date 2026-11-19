// The assistant box (src/planner/panel.js boxHtml, chipText, boxCopy), a part of its own (router.js PARTS box) loaded when the Beside
// drawer's box tab opens: its chips, what she wants done with them (typed or said), and one copy of it all, ready to paste into her
// assistant. The box itself is kv "cbox" (plan/cbox.js).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, toast } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t } from '../../i18n/t.js';
import { kv } from '../../planning/index.js';
import { lessonBlob } from '../../planning/plan.js';
import { PARTS as LAZY } from '../router.js';
import { assistant } from '../../services/assistant.js';
import { copyText } from '../../services/clipboard.js';
import { readBox, changeBox, takeChips, onBox } from '../plan/cbox.js';
import { saveFailed } from '../plan/save.js';
import '../plan/les-lines.js';
import '../plan/tool-lines.js';

/* ---------- the assistant box ---------- */
const aiName = () => assistant().name || t('assistant.generic');
const EXTRA = ['tag', 'foot', 'h1', 'h2', 'body2', 'cite', 'word', 'pos'];
const CHIP_ICON = { notebook: 'note', slide: 'slides', page: 'book', video: 'play', week: 'cal', file: 'file', lesson: 'slides', quote: 'text', note: 'comment' };
// The chip's name in her language, from what it points at; the stored English label when the new app can't name it.
function chipName(p, c) {
  const L = (p && p.lessons) || [];
  if (c.kind === 'slide') { const l = L.find(x => x.id === c.lesson), sl = l && l.slides[c.i]; if (!sl) return c.label || ''; return t('les.chip_slide', { lesson: l.title || '', n: c.i + 1 }) + (sl.title ? ': ' + sl.title : ''); }
  if (c.kind === 'page') return t('les.chip_page', { book: c.bookName || (c.label || '').split(', ')[0], n: c.page });
  if (c.kind === 'video') return t('les.chip_video', { url: c.url });
  if (c.kind === 'week' && c.unit) return t('les.chip_week', { unit: c.unit, n: c.n, of: c.of });
  if (c.kind === 'notebook') { const o = c.t === 'lesson' ? L.find(x => x.id === c.id) : c.t === 'unit' ? ((p && p.units) || []).find(x => x.id === c.id) : null; return t('les.chip_nb', { name: o ? o.title : t('tool.nb_general') }); }
  return c.label || '';
}
async function pageText(book, page) {
  const b = await kv.get('pdf:' + book); if (!b) return '';
  const L = await (await LAZY.pdf()).pdfjs(), doc = await L.getDocument({ data: new Uint8Array(await b.arrayBuffer()), isEvalSupported: false }).promise;
  const tc = await (await doc.getPage(page)).getTextContent(); let s = '', y = null;
  for (const it of tc.items) { const yy = it.transform ? Math.round(it.transform[5]) : y; if (y != null && yy !== y) s += '\n'; else if (s && !/\s$/.test(s)) s += ' '; s += it.str; y = yy; }
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// What each chip says to the assistant (panel.js chipText), in the current Planner's words: this is the message she pastes, not
// the app's screen, so it reads the same from either app. // not-words
export async function chipText(p, c, T, E) {
  const L = p.lessons || [];
  if (c.kind === 'page') { const books = (await kv.get('pdfs').catch(() => null)) || [], bk = books.find(x => x.id === c.book); const tx = c.text != null ? c.text : await pageText(c.book, c.page).catch(() => '');
    return '[' + (bk ? bk.name : 'Book') + ', ' + (c.title && !/^p\. \d+$/.test(c.title) ? c.title + ', ' : '') + 'page ' + c.page + ']\n' + (tx || '(no text on this page)'); } // not-words
  if (c.kind === 'slide') { const l = L.find(x => x.id === c.lesson), s = l && l.slides[c.i]; if (!s) return '';
    let tx = '[Slide ' + (c.i + 1) + ' of "' + l.title + '" (' + (E.LAYOUTS[s.layout] || s.layout) + ')]\n' + (s.title ? 'Title: ' + s.title + '\n' : '') + (s.body ? s.body + '\n' : ''); // not-words
    for (const k of EXTRA) if (s[k] && k !== 'body') tx += k + ': ' + s[k] + '\n';
    return tx.trim(); }
  if (c.kind === 'file') {
    const o = c.t === 'unit' ? (p.units || []).find(x => x.id === c.owner) : L.find(x => x.id === c.owner), f = o && (o.files || []).find(x => x.id === c.id); if (!f) return '';
    if (f.kind !== 'doc') return '[File: ' + f.name + ']'; // not-words
    const b = await lessonBlob(f.id), d = document.createElement('div'); d.innerHTML = b ? T.docClean(await b.text()) : '';
    for (const el of d.querySelectorAll('p,h1,h2,li,tr,div')) el.append('\n');
    return '[Document: ' + f.name + ']\n' + d.textContent.replace(/\n{3,}/g, '\n\n').trim(); } // not-words
  if (c.kind === 'video') return '[Video] ' + c.url; // not-words
  if (c.kind === 'lesson') { const l = L.find(x => x.id === c.lesson); return l ? '[Lesson]\n' + E.lessonText(l).trim() : ''; } // not-words
  if (c.kind === 'quote' || c.kind === 'week') return '[' + c.label + ']' + (c.text ? '\n' + c.text : '');
  if (c.kind === 'note') return 'My comment: ' + c.text + '\nOn: ' + ((c.about && await chipText(p, c.about, T, E)) || c.label); // not-words
  if (c.kind === 'notebook') { const o = c.t === 'lesson' ? L.find(x => x.id === c.id) : c.t === 'unit' ? (p.units || []).find(x => x.id === c.id) : null;
    const html = c.t === 'general' ? await kv.get('nb:general').catch(() => '') : o && o.notebook; return '[My notebook: ' + (o ? o.title : 'General notes') + ']\n' + (T.nbText(html || '') || '(empty)'); } // not-words
  return c.label || '';
}
// T and E: the Planner's tools and engine, from the drawer, which has them already (so this part needn't carry them).
export function Box({ p, T, E }) {
  const [b, setB] = useState(null), [draft, setDraft] = useState(null);
  const pending = useRef(null), timer = useRef(0);
  const text = draft ?? b?.text ?? '';
  const flush = () => {
    clearTimeout(timer.current);
    const edit = pending.current;
    if (!edit) return Promise.resolve(true);
    if (!edit.saving) edit.saving = changeBox(box => {
      if (box.text !== edit.base && box.text !== edit.value) throw new Error('The assistant box text changed in storage');
      return { ...box, text: edit.value };
    }).then(() => {
      if (pending.current === edit) { pending.current = null; setDraft(null); }
      return true;
    }, e => { edit.saving = null; saveFailed(e); return false; });
    return edit.saving;
  };
  useEffect(() => {
    let initial = true;
    const stop = onBox(box => { initial = false; setB(box); });
    readBox().then(box => { if (initial) setB(box); }, e => { if (initial) saveFailed(e); });
    return () => { initial = false; stop(); flush(); };
  }, []);
  const say = value => {
    const prior = pending.current;
    const base = prior ? (prior.saving ? prior.value : prior.base) : b.text;
    setDraft(value); pending.current = { base, value };
    clearTimeout(timer.current); timer.current = setTimeout(flush, 400);
  };
  const remove = chip => changeBox(box => ({ ...box, chips: takeChips(box.chips, [chip]).rest })).catch(saveFailed);
  const clear = async () => {
    if (!await flush()) return;
    try {
      let removed, clearedText;
      await changeBox(box => {
        const selection = takeChips(box.chips, b.chips);
        removed = selection.removed;
        clearedText = box.text === text ? box.text : '';
        return { ...box, chips: selection.rest, text: clearedText ? '' : box.text };
      });
      toast(t('les.box_cleared'), { undo: () => changeBox(box => ({
        ...box, text: box.text || clearedText, chips: [...removed, ...box.chips],
      })).catch(saveFailed) });
    } catch (e) { saveFailed(e); }
  };
  const copy = async () => {
    const parts = []; for (const c of b.chips) parts.push(await chipText(p, c, T, E).catch(() => c.label || ''));
    const all = (text.trim() ? text.trim() + '\n\n' : '') + parts.filter(Boolean).join('\n\n');
    if (!all.trim()) return toast(t('les.box_empty', { name: aiName() }));
    toast(await copyText(all) ? t('les.box_copied', { name: aiName() }) : t('copy.failed'), { ms: 4000 });
  };
  if (!b) return <p class="mute" aria-busy="true" />;
  return <div class="cbox">
    <p class="mute small">{t('les.box_about', { name: aiName() })}</p>
    <ul class="chiplist" aria-label={t('les.box_things')}>{b.chips.length ? b.chips.map((c, i) => <li class="bchip"><Icon name={CHIP_ICON[c.kind] || 'dash'} size="xs" /><span data-raw>{chipName(p, c)}</span>
      <IconButton icon="x" size="sm" label={t('common.remove')} onClick={() => remove(c)} data-chip-x={i} /></li>) : <li class="mute small">{t('les.box_none')}</li>}</ul>
    <TextBox label={t('les.box_ask', { name: aiName() })} value={text} onInput={say} onBlur={flush} rows={6} data-focus="box-text" />
    <div class="row"><span class="grow" /><Button size="sm" variant="quiet" onClick={clear} data-focus="box-clear">{t('les.box_clear')}</Button>
      <Button size="sm" variant="primary" icon="copy" onClick={copy} data-focus="box-copy">{t('les.box_copy', { name: aiName() })}</Button></div>
  </div>;
}
