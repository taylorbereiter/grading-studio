// The language. One setting for both versions (gs.lang, written as the current app writes it: removed for English, else the code
// as JSON). Each language's lines are the current app's own wording, converted (next/tools/lang-convert.js); a line the current
// app has no wording for shows in English (next/lang/english-only.json lists them for stage 7).
import { json } from '../shared/ls.js';
import { useLanguage } from '../i18n/t.js';
import { savePref } from '../planning/write.js';

// The languages the current app has, by code, each in its own name (made by next/build.js from src/lang-*.js).
export const LANGUAGES = [['en', 'English'], ...__GS_LANGS__];   // not-words
export function savedLanguage() { const v = json('gs.lang'); return LANGUAGES.some(l => l[0] === v) ? v : 'en'; }
export function setLanguage() { document.documentElement.lang = savedLanguage(); }
// Before anything is drawn: the chosen language's lines, each language its own chunk (app/lang-load.js).
export async function loadLanguage() {
  const c = savedLanguage();
  if (c !== 'en') { try { useLanguage(c, await import('./lang-load.js').then(m => m.lines(c))); } catch (e) { console.error(e); } }
  setLanguage();
}
// Returns false when this window may not save.
export function saveLanguage(code) {
  try { savePref('gs.lang', code === 'en' ? undefined : code); } catch { return false; }
  setLanguage(); setTimeout(() => location.reload(), 300); return true;   // the page starts again in the language
}
