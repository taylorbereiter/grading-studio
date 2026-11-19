// The words the lifted engines draw themselves (next/lang/engine.en.json): the feedback page in a returned paper, a notes page, Quick
// mark's answer pictures and step words, a printed quiz, the typed notes' bar, "Paper 3" while names are hidden. The engines keep the
// current app's English and pass each line through tr(s) (src/lang.js tr there; next/build.js wraps the ones that weren't). Here tr
// finds the line by its English: the whole line, else a line with parameters ("returned {date}"), else each part between " · ", as
// src/lang.js trWith does. A piece no line knows stays as it is, so a name or a title she typed is never touched.
// Importing this hands tr (and the language's locale for dates) to the engines' state; it loads with the marking screens, not with
// the first page.
import { addLines, t, getLocale } from '../i18n/t.js';
import { use } from '../engines/gcore.js';
import LINES from '../../lang/engine.en.json';
addLines(LINES);

const EXACT = new Map(), PATTERNS = [];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [key, v] of Object.entries(LINES)) {
  for (const [form, en] of typeof v === 'string' ? [[null, v]] : Object.entries(v)) {
    const names = [...en.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    if (!names.length) { if (!EXACT.has(en)) EXACT.set(en, { key, form }); continue; }
    // a parameter never holds " · ", so a line joined from several parts is read part by part
    const rx = new RegExp('^' + en.split(/\{\w+\}/).map(esc).join('((?:(?! · ).)+?)') + '$');
    PATTERNS.push({ key, form, names, rx, fixed: en.replace(/\{\w+\}/g, '').length });
  }
}
// the line with the most words of its own first: "Page {n} of {of}" before "{score} of {top}"
PATTERNS.sort((a, b) => b.fixed - a.fixed);
// a plural line's form picks its number when the English has none ("Comment on your paper" is one)
const nOf = form => (form === 'one' ? 1 : 2);

function piece(s) {
  const e = EXACT.get(s);
  if (e) return t(e.key, e.form ? { n: nOf(e.form) } : undefined);
  for (const p of PATTERNS) {
    const m = p.rx.exec(s); if (!m) continue;
    const params = {}; p.names.forEach((k, i) => { params[k] = m[i + 1]; });
    if (p.form && params.n == null) params.n = nOf(p.form);
    return t(p.key, params);
  }
  return null;
}
export function engineTr(s) {
  if (typeof s !== 'string') return s;
  const k = s.trim(); if (!k) return s;
  let hit = piece(k);
  if (hit == null && k.includes(' · ')) {
    const parts = k.split(' · '), out = parts.map(x => { const h = piece(x.trim()); return h == null ? x : h; });
    if (out.some((x, i) => x !== parts[i])) hit = out.join(' · ');
  }
  return hit == null ? s : s.replace(k, () => hit);
}
// English keeps the browser's own way of writing a date, as the current app does (LANG_LOCALE undefined).
use({ tr: engineTr, LANG_LOCALE: getLocale() === 'en' ? undefined : getLocale() });
