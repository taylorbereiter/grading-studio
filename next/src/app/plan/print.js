// Printing a week of lessons and one lesson's plan (src/planner/extras.js printWeek): a plain page in its own window, each day's
// classes with their lessons, slides and materials, the browser's print dialog on top. Nothing is saved.
import { t, date } from '../../i18n/t.js';
import { toast } from '../../ui/index.js';
import { engine } from '../../planning/engine.js';
import { periods, dayOff, eventsOn, lessonsOn, weekDays, at, mins } from './lessons.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clock = s => { const m = mins(s); return m == null ? '' : date(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), { hour: 'numeric', minute: '2-digit' }); };
const plain = s => String(s || '').replace(/\{\/?[a-z]*\}|\*\*|__|\*/g, '');
const CSS = 'body{font:11pt/1.35 Calibri,"Segoe UI",Arial,sans-serif;color:#111;margin:14mm}h1{font-size:18pt;margin:0 0 6pt}h2{font-size:13pt;margin:0 0 4pt;border-bottom:1.5px solid #111;padding-bottom:2pt}section{break-inside:avoid;margin:0 0 10pt}.cls{margin:4pt 0 6pt 8pt}.ch{font-size:11.5pt}.ls{margin:2pt 0 0 10pt}.ls ol{margin:2pt 0;padding-left:16pt}.wk ol{columns:2;column-gap:18pt}.mats,.notes{font-size:10pt;color:#444}.none{color:#666;margin:2pt 0 2pt 8pt}ul.units{margin:0 0 10pt;padding-left:16pt}@page{size:A4;margin:0}';

function open(title, body) {
  const w = window.open('', '_blank');
  if (!w) return toast(t('plan.print_blocked'));
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body>' + body + '</body></html>'); // not-words
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
const slideName = (E, s, i) => plain(s.title) || (E.LAYOUTS[s.layout] || '') || t('plan.slide_n', { n: i + 1 });
const mats = l => (l.files || []).length || (l.links || []).length ? '<div class="mats">' + esc(t('plan.materials')) + ': ' + [...(l.files || []).map(f => f.name), ...(l.links || []).map(x => x.name)].map(esc).join(', ') + '</div>' : '';

export function printWeek(p, mon) {
  const E = engine(p), days = weekDays(p, mon);
  let h = '<h1>' + esc(t('plan.week_of', { day: date(at(mon), { day: 'numeric', month: 'long' }) })) + '</h1>';
  const courses = [...new Set((p.setup.classes || []).map(c => c.course || c.name).filter(Boolean))];
  const us = courses.map(c => { const x = E.unitAt(c, mon); return x ? '<li><b>' + esc(c) + ':</b> ' + esc(x.u.title) + ', ' + esc(t('plan.unit_week', { n: x.n + 1, of: x.u.weeks.length })) + (x.u.weeks[x.n].focus ? ' (' + esc(x.u.weeks[x.n].focus) + ')' : '') + '</li>' : ''; }).join('');
  if (us) h += '<ul class="units">' + us + '</ul>'; // not-words
  for (const d of days) {
    const off = dayOff(p, d), ev = eventsOn(p, d), ms = off ? [] : periods(p, d);
    h += '<section class="wk"><h2>' + esc(date(at(d), { weekday: 'long', day: 'numeric', month: 'short' })) + (off ? ' · ' + esc(off.label || t('plan.day_off')) : '') + ev.map(x => ' · ' + esc(x.label)).join('') + '</h2>';
    if (!ms.length && !off) h += '<p class="none">' + esc(t('plan.no_periods')) + '</p>';
    for (const { c, m } of ms) {
      const ls = lessonsOn(p, c.id, d);
      h += '<div class="cls"><div class="ch"><b>' + esc(c.name) + '</b> ' + esc(t('plan.time_range', { from: clock(m.start), to: clock(m.end) })) + (m.label ? ' · ' + esc(m.label) : '') + '</div>' +
        (ls.length ? ls.map(l => '<div class="ls"><b>' + esc(l.title) + '</b><ol>' + l.slides.map((s, i) => '<li>' + esc(slideName(E, s, i)) + '</li>').join('') + '</ol>' + mats(l) + '</div>').join('') : '<p class="none">' + esc(t('plan.nothing_planned')) + '</p>') + '</div>';
    }
    h += '</section>';
  }
  open(t('plan.week_of', { day: date(at(mon), { day: 'numeric', month: 'short' }) }), h);
}

export function printLesson(p, l) {
  const E = engine(p);
  let h = '<h1>' + esc(l.title || t('plan.untitled')) + '</h1>';
  const when = (l.slots || []).map(s => { const c = (p.setup.classes || []).find(x => x.id === s.classId); return (c ? c.name + ', ' : '') + date(at(s.date), { weekday: 'short', day: 'numeric', month: 'short' }); });
  if (when.length) h += '<p>' + esc(when.join('; ')) + '</p>';
  h += mats(l) + '<ol class="ls">' + l.slides.map((s, i) => '<li><b>' + esc(slideName(E, s, i)) + '</b>' + (s.body ? '<div>' + esc(plain(s.body)).replace(/\n/g, '<br>') + '</div>' : '') + (s.notes ? '<div class="notes">' + esc(s.notes).replace(/\n/g, '<br>') + '</div>' : '') + '</li>').join('') + '</ol>';
  open(l.title || t('plan.untitled'), h);
}
