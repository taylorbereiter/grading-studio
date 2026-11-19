// Named lines (next/docs/languages.md). Every line the new app shows comes from t('area.name', params); no part types English.
// next/lang/en.json is the English and the list of every line. A line is a string with {name} parameters, or a plural object
// keyed by Intl.PluralRules categories ({ one, other }) picked by params.n. Another language comes as its own chunk
// (next/lang/<code>.json, made from the current app's by next/tools/lang-convert.js) before anything is drawn; a line it lacks shows in English.
// A teacher's own words (names, titles) are only ever parameters, so they are never translated.
import EN from '../../lang/en.json';

let lines = EN, locale = 'en', mode = '', TR = {};
// The chosen language's lines (app/language.js loadLanguage); '@locale' is the locale its dates and numbers are written in.
export function useLanguage(code, more) { TR = more || {}; locale = TR['@locale'] || code; }
// Keys mode: every line shows as ⟦key⟧, so a check can find any words on screen that did not come through t().
export function setMode(m) { mode = m === 'keys' ? 'keys' : ''; }
export const getLocale = () => locale;
// Lines for one page only (the gallery's own, next/lang/gallery.en.json), so they never ship with the app.
export function addLines(more) { lines = { ...lines, ...more }; Object.assign(EXTRA, more); }
const EXTRA = {};
const fill = (s, p) => s.replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? String(p[k]) : m));
export function t(key, params) {
  if (mode === 'keys') return '⟦' + key + '⟧';
  let v = TR[key] ?? lines[key]; if (v == null) v = EN[key] ?? EXTRA[key];
  if (v == null) { console.error('No line ' + key); return key; }
  if (typeof v === 'object') {
    const n = params && params.n != null ? +params.n : 0;
    v = v[new Intl.PluralRules(locale).select(n)] || v.other;
  }
  return fill(v, params);
}
// Numbers and dates written the way the language writes them.
export const num = (n, o) => new Intl.NumberFormat(locale, o).format(n);
export const date = (d, o) => new Intl.DateTimeFormat(locale, o).format(d);
export const dateRange = (a, b, o) => new Intl.DateTimeFormat(locale, o).formatRange(a, b);
