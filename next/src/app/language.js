// The language. One setting for both versions (gs.lang, written as the current app writes it: removed for English, else the code
// as JSON). The new app has English only until stage 7 brings the other languages as chunks; until then a teacher who chose
// another language sees English here, is told so once on the Language setting, and keeps her choice for the current app.
import { json } from '../shared/ls.js';
import { savePref } from '../planning/write.js';

// The languages the current app has, by code, each in its own name (made by next/build.js from src/lang-*.js).
export const LANGUAGES = [['en', 'English'], ...__GS_LANGS__];   // not-words
export const IN_NEXT = ['en'];
export function savedLanguage() { const v = json('gs.lang'); return LANGUAGES.some(l => l[0] === v) ? v : 'en'; }
export function setLanguage() { document.documentElement.lang = IN_NEXT.includes(savedLanguage()) ? savedLanguage() : 'en'; }
// Returns false when this window may not save.
export function saveLanguage(code) {
  try { savePref('gs.lang', code === 'en' ? undefined : code); } catch { return false; }
  setLanguage(); return true;
}
