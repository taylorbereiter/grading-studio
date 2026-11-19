// The language. One setting for both versions (gs.lang, written as the current app writes it: removed for English, else the code
// as JSON). Each language has every line (next/lang/<code>/<area>.json; next/test/lines.test.js checks), the current app's own wording
// where it had one (next/tools/lang-convert.js) and new wording for the rest.
import { json } from '../shared/ls.js';
import { useLanguage, addLines } from '../i18n/t.js';
import { savePref } from '../planning/write.js';

// The languages the current app has, by code, each in its own name (made by next/build.js from src/lang-*.js).
export const LANGUAGES = [['en', 'English'], ...JSON.parse(__GS_LANGS_JSON__)];   // not-words
export function savedLanguage() { const v = json('gs.lang'); return LANGUAGES.some(l => l[0] === v) ? v : 'en'; }
export function setLanguage() { document.documentElement.lang = savedLanguage(); }
// Before anything is drawn: the chosen language's core lines and those of every lines file already loaded (app/lang-load.js).
export async function loadLanguage() {
  const c = savedLanguage();
  if (c !== 'en') { try { const L = await import('./lang-load.js'); useLanguage(c, await L.area(c, 'core')); addLines.load(a => L.area(c, a)); await addLines.ready(); } catch (e) { console.error(e); } }
  setLanguage();
}
// Returns false when this window may not save.
export function saveLanguage(code) {
  try { savePref('gs.lang', code === 'en' ? undefined : code); } catch { return false; }
  setLanguage(); setTimeout(() => location.reload(), 300); return true;   // the page starts again in the language
}
