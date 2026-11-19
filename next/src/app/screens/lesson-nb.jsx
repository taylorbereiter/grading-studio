// The Beside drawer's notebook (src/planner/notebook.js), loaded when its tab is first opened (router.js PARTS.nb): one page per
// lesson (lesson.notebook), one per unit (unit.notebook, saved with the units) and a general page (kv "nb:general"). The open
// lesson's page, else the unit's, else the general one; General notes swaps to the general page and back. Bold, italic, underline,
// lists, links, pictures, YouTube players, dictation; saved as you type, only to the page that was read.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, TextInput, toast } from '../../ui/index.js';
import { Mic } from '../../ui/services.jsx';
import { t } from '../../i18n/t.js';
import { kv } from '../../planning/index.js';
import { assistant } from '../../services/assistant.js';
import * as T from '../../engines/plantools.js';
import { savePlannerKv, saveLesson, saveKv } from '../../planning/write.js';
import { saveFailed } from '../plan/save.js';
import '../plan/lines.js';
import '../plan/tool-lines.js';
import '../plan/les-lines.js';
import '../plan/rev-lines.js';
import { DriveButton } from '../drive-button.jsx';
import { boxAdd } from '../plan/cbox.js';

const copy = x => JSON.parse(JSON.stringify(x));
const esc = s => String(s).replace(/[&"><]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const { ytId, ytStart } = T;
const aiName = () => assistant().name || t('assistant.generic');
/* ---------- Notebook ---------- */
const nbChip = (general, l, u) => general ? { kind: 'notebook', t: 'general', id: '', label: 'Notebook: General notes' } : l ? { kind: 'notebook', t: 'lesson', id: l.id, label: 'Notebook: ' + l.title } : { kind: 'notebook', t: 'unit', id: u.id, label: 'Notebook: ' + u.title }; // not-words
// A unit's page, read from the units as stored (a read that fails is never saved over) and saved back into them.
const unitsNow = async () => { const v = await kv.get('units'); if (!Array.isArray(v)) throw new Error('units unread'); return v; };
export function Notebook({ p, l, u, save }) {
  const own = !!(l || u), [general, setGeneral] = useState(!own), [state, setState] = useState(''), [ask, setAsk] = useState(null), [askV, setAskV] = useState('');
  const pg = useRef(), timer = useRef(0), range = useRef(null), lRef = useRef(l), byId = useRef({}), ready = useRef(false), [, redraw] = useState(0); lRef.current = l; if (l) byId.current[l.id] = l;
  const players = el => { for (const v of el.querySelectorAll('.nb-vid')) if (v.getAttribute('contenteditable') !== 'false') { v.contentEditable = 'false'; v.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(v.dataset.yt) + (v.dataset.t ? '?start=' + esc(v.dataset.t) : '') + '" title="' + esc(t('tool.video')) + '" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'; } };
  useEffect(() => {
    // The page read here is the only one this page's typing is saved to: the lesson open now, or the general page once its read
    // has worked (a failed read never saves over it). Until then the page can't be typed in.
    let on = true; const id = l ? l.id : ''; ready.current = false; redraw(n => n + 1);
    (async () => {
      let html; try { html = general ? String((await kv.get('nb:general')) || '') : l ? lRef.current.notebook || '' : ((await unitsNow()).find(x => x && x.id === u.id) || {}).notebook || ''; } catch (e) { if (on) toast(t('tool.nb_unread')); return; }
      if (on && pg.current) { pg.current.innerHTML = T.nbClean(html); players(pg.current); ready.current = true; redraw(n => n + 1); }
    })();
    return () => { on = false; if (timer.current) { clearTimeout(timer.current); flush(general, id); } ready.current = false; };
  }, [general, l ? l.id : u ? u.id : '']);
  const stored = el => { const c = el.cloneNode(true); for (const v of c.querySelectorAll('.nb-vid')) { v.removeAttribute('contenteditable'); v.innerHTML = ''; } return T.nbClean(c.innerHTML); };
  const flush = async (gen, id = lRef.current ? lRef.current.id : "") => {
    timer.current = 0; if (!pg.current || !ready.current) return;
    const html = stored(pg.current), empty = !T.nbText(html).trim() && !/<img|nb-vid/.test(html);
    try {
      if (gen) await savePlannerKv('nb:general', empty ? '' : html);
      else if (!l) {
        const list = await unitsNow(), i = list.findIndex(x => x && x.id === u.id); if (i < 0) return;
        const n = { ...list[i] }; if (empty) delete n.notebook; else n.notebook = html;
        if ((n.notebook || '') !== (list[i].notebook || '')) { list[i] = n; await saveKv('units', list); }
      } else {
        // After she has gone to another lesson, the words go to the lesson they were typed in, not the one on screen.
        const was = byId.current[id], here = id === lRef.current.id; if (!was) return;
        const n = copy(was); if (empty) delete n.notebook; else n.notebook = html;
        if ((n.notebook || '') !== (was.notebook || '')) { if (here) await save(n); else { const st = await saveLesson(n); byId.current[id] = st; } }
      }
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
    <div class="row"><b class="grow">{general ? t('tool.nb_general') : l ? t('tool.nb_lesson') : t('rev.nb_unit')}</b>{own && <Button size="sm" variant="quiet" onClick={() => { if (timer.current) { clearTimeout(timer.current); flush(general); } setGeneral(!general); }} data-focus="nb-swap">{!general ? t('tool.nb_general') : l ? t('tool.nb_lesson') : t('rev.nb_unit')}</Button>}
      <Button size="sm" variant="quiet" icon="assist" onClick={async () => { if (timer.current) { clearTimeout(timer.current); await flush(general); } boxAdd(nbChip(general, l, u)); }} data-focus="nb-to-box">{t('les.to_box', { name: aiName() })}</Button></div>
    <div class="doctools" role="toolbar" aria-label={t('tool.notebook')}>
      {B('bold', 'tool.doc_b', 'dt-bold')}{B('italic', 'tool.doc_i', 'dt-italic')}{B('underline', 'tool.doc_u', 'dt-underline')}{B('ul', 'tool.doc_ul')}{B('ol', 'tool.doc_ol')}
      <button type="button" class="btn sm quiet" onMouseDown={e => { e.preventDefault(); range.current = sel(); setAsk('link'); }}>{t('tool.nb_link')}</button>
      <label class="btn sm quiet">{t('tool.nb_pic')}<input type="file" class="vh" accept="image/*" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; pic(f); }} /></label><DriveButton small />
      <button type="button" class="btn sm quiet" onMouseDown={e => { e.preventDefault(); range.current = sel(); setAsk('video'); }}>{t('tool.nb_video')}</button>
      <Mic onText={w => { focus(); document.execCommand('insertText', false, (w.match(/^\s/) ? '' : ' ') + w); range.current = sel(); changed(); }} />
    </div>
    {ask && <div class="row"><TextInput label={ask === 'video' ? t('tool.nb_paste_video') : t('tool.nb_paste_link')} value={askV} onInput={setAskV} onKeyDown={e => { if (e.key === 'Enter') addUrl(); if (e.key === 'Escape') setAsk(null); }} data-focus="nb-ask" autoFocus />
      <Button size="sm" variant="primary" onClick={addUrl}>{t('tool.add')}</Button><IconButton icon="x" size="sm" label={t('common.cancel')} onClick={() => setAsk(null)} /></div>}
    <div class="nbpage" ref={pg} contentEditable={ready.current ? "true" : "false"} aria-busy={ready.current ? undefined : "true"} spellcheck={true} role="textbox" aria-multiline="true" aria-label={general ? t('tool.nb_general') : l ? t('tool.nb_lesson') : t('rev.nb_unit')} data-raw data-nbpage onInput={changed}
      onBlur={() => { range.current = sel() || range.current; }}
      onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && /^[biu]$/i.test(e.key)) { e.preventDefault(); cmd({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); } }}
      onPaste={e => { const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); range.current = sel(); return pic(f); }
        const u = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').trim(); if (/^https?:\/\/\S+$/.test(u) && ytId(u)) { e.preventDefault(); range.current = sel(); insert('<div class="nb-vid" data-yt="' + ytId(u) + '"' + (ytStart(u) ? ' data-t="' + ytStart(u) + '"' : '') + '></div><p><br></p>'); } }}
      onDrop={e => { const f = [...((e.dataTransfer && e.dataTransfer.files) || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); e.stopPropagation(); pic(f); } }}
      onClick={e => { const a = e.target.closest && e.target.closest('a[href]'); if (a) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); } }} />
    <small class="mute" role="status">{state === 'saving' ? t('tool.saving') : state === 'saved' ? t('tool.saved') : general ? t('tool.nb_kept_here') : l ? t('tool.nb_kept_lesson') : t('rev.nb_kept_unit')}</small>
  </div>;
}
