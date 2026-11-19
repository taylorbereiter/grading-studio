// Searching inside the Planner's work (src/planner/extras.js findAll, findDlg; rail.js "Search inside lessons for …"): lesson titles,
// every slide's words and notes, a lesson's notebook, its documents and files, and the units with their weeks and files. Opened
// from the command bar as Library > Search (router.js PARTS.search). A hit opens the lesson at that slide, its document, the
// unit on its Course line, or the file. Only planning work is searched, never a student's.
import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Icon, TextInput, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { go, href } from '../router.js';
import { lessonBlob } from '../../planning/plan.js';
import { classOf, at } from './lessons.js';
import './cal-lines.js';
import './lines.js';

const norm = s => String(s || '').toLowerCase();
// rich text marks (src/planner/rich.js) out, so a bold word is found as a word
const plain = s => String(s || '').replace(/\\(.)|\*\*|__|\*|\{(?:red|orange|green|blue|purple|gray|\/)\}/g, '$1');
const EXTRA = ['tag', 'foot', 'h1', 'h2', 'body2', 'cite', 'word', 'pos'];
const html2text = s => { const tp = document.createElement('template'); tp.innerHTML = String(s || ''); return tp.content.textContent.replace(/\s+/g, ' '); };
function snip(text, q) {
  const i = norm(text).indexOf(q); if (i < 0) return '';
  let a = Math.max(0, i - 40); if (a) { const sp = text.indexOf(' ', a); a = sp >= 0 && sp < i ? sp + 1 : a; }
  return (a ? '…' : '') + text.slice(a, i + q.length + 60).replace(/\s+/g, ' ');
}
export async function findAll(p, q0) {
  const q = norm(q0).trim(); if (q.length < 2) return [];
  const out = [], docs = new Map();
  for (const l of p.lessons || []) {
    const slots = l.slots || [], title = l.title || t('plan.untitled');
    const where = slots.length ? slots.map(s => ((classOf(p, s.classId) || {}).name || '') + ' ' + date(at(s.date), { day: 'numeric', month: 'short' })).join(', ') : t('cal.search_no_class');
    if (norm(l.title).includes(q)) out.push({ kind: 'lesson', id: l.id, title, where, snip: '' });
    (l.slides || []).forEach((s, i) => {
      const tx = [s.title, plain(s.body), plain(s.body2), s.notes, s.ask, ...EXTRA.map(k => s[k])].filter(Boolean).join(' · ');
      if (norm(tx).includes(q)) out.push({ kind: 'slide', id: l.id, i, title: t('cal.search_slide', { title, n: i + 1 }), where, snip: snip(tx, q) });
    });
    if (l.notebook) { const tx = html2text(l.notebook); if (norm(tx).includes(q)) out.push({ kind: 'lesson', id: l.id, title: t('cal.search_nb', { title }), where, snip: snip(tx, q) }); }
    for (const f of l.files || []) {
      let tx = f.name || '';
      if (f.kind === 'doc') { if (!docs.has(f.id)) docs.set(f.id, await lessonBlob(f.id).then(b => b && b.text ? b.text() : '', () => '')); tx += ' · ' + html2text(docs.get(f.id)); }
      if (norm(tx).includes(q)) out.push({ kind: 'file', id: l.id, fid: f.id, doc: f.kind === 'doc', name: f.name, of: 'lesson', title: f.name, where: t('cal.search_in', { title }), snip: f.kind === 'doc' ? snip(tx, q) : '' });
    }
  }
  for (const u of p.units || []) {
    const tx = [u.title, u.course, ...(u.weeks || []).map(w => [w.focus, w.notes].filter(Boolean).join(' '))].filter(Boolean).join(' · ');
    if (norm(tx).includes(q)) out.push({ kind: 'unit', id: u.id, title: u.title || '', where: u.course || t('plan.units'), snip: snip(tx, q) });
    for (const f of u.files || []) if (norm(f.name).includes(q)) out.push({ kind: 'file', id: u.id, fid: f.id, name: f.name, of: 'unit', title: f.name, where: t('cal.search_in', { title: u.title || '' }), snip: '' });
  }
  return out;
}
async function openBlob(fid, name) {
  const b = await lessonBlob(fid); if (!b) return toast(t('cal.file_missing'));
  const pdf = /pdf/.test(b.type || '') || /\.pdf$/i.test(name || ''), url = URL.createObjectURL(pdf ? new Blob([b], { type: 'application/pdf' }) : b);
  if (pdf || /^image\//.test(b.type || '')) window.open(url, '_blank', 'noopener');
  else { const a = document.createElement('a'); a.href = url; a.download = name || ''; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
const keep = v => { try { sessionStorage.setItem('gsn.at', JSON.stringify(v)); } catch { } };
export function openHit(r) {
  if (r.kind === 'unit') return go('library', 'units', r.id);
  if (r.kind === 'slide') { keep({ id: r.id, slide: r.i }); return go('lesson', r.id, 'slides'); }
  if (r.kind === 'file' && r.doc) { keep({ id: r.id, doc: r.fid }); return go('lesson', r.id); }
  if (r.kind === 'file') { go(...(r.of === 'unit' ? ['library', 'units', r.id] : ['lesson', r.id])); return openBlob(r.fid, r.name); }
  go('lesson', r.id);
}
const ICON = { lesson: 'slides', slide: 'slides', file: 'file', unit: 'cal' };
const MAX = 80;

export function Search({ p, q: q0 }) {
  const [q, setQ] = useState(q0), [hits, setHits] = useState(null), tm = useRef(0);
  const run = async v => { const rs = await findAll(p, v); setHits(rs); history.replaceState(null, '', href('library', 'search', v.trim())); };
  useEffect(() => { run(q); }, [p]);
  useEffect(() => () => clearTimeout(tm.current), []);
  const qq = q.trim();
  return <section class="lsearch" aria-labelledby="h-search">
    <h2 id="h-search">{t('cal.search')}</h2>
    <TextInput label={t('cal.search_label')} icon="search" type="search" value={q} autoFocus onInput={v => { setQ(v); clearTimeout(tm.current); tm.current = setTimeout(() => run(v), 150); }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tm.current); run(e.currentTarget.value); } }} data-search />
    <div role="status" class="mute">{qq.length < 2 ? t('cal.search_two') : hits && !hits.length ? t('cal.search_none', { q: qq }) : hits ? t('cal.search_n', { n: hits.length }) : ''}</div>
    {qq.length >= 2 && hits && hits.length > 0 && <ul class="hits">{hits.slice(0, MAX).map(r => <li><button type="button" class="hit" onClick={() => openHit(r)} data-hit={r.kind}>
      <Icon name={ICON[r.kind]} /><span class="ht"><b data-raw>{r.title}</b><span class="mute" data-raw>{r.where}</span>{r.snip && <span class="sn" data-raw>{r.snip}</span>}</span></button></li>)}</ul>}
    {hits && hits.length > MAX && <p class="mute">{t('cal.search_first', { n: MAX })}</p>}
  </section>;
}
