/* ---------------- languages (Stage 6): the app in a language other than English ----------------
   Built into both pages, after the language files (src/lang-*.js) and before everything else.
   The app is written in English. A language is one file: the English words and sentences it knows, each with its own, the answers
   on the Help page, and how it writes a date. Nothing else in the app knows which language is on. What is drawn inside the parts of
   the page listed in LANG_ROOTS is read as it lands and put into the language, a piece at a time: a whole line, or each part of a line
   that is joined with " · ". A piece the file doesn't know stays as it is, so a class's name, a student's and an assignment's are
   left alone, and a screen that hasn't been translated yet is simply still in English.
   The choice is one setting in this browser (gs.lang), read by both pages. English adds nothing and runs none of this.
   To add a language: copy src/lang-es.js, translate it, name it in LANG_PACKS below and in build.js. test/lang.test.js lists what a
   file still leaves in English on the screens it covers. */
const LANG_PACKS = { es: LANG_ES };
const LANG = (() => { try { const v = JSON.parse(localStorage.getItem('gs.lang')); return typeof v === 'string' && Object.prototype.hasOwnProperty.call(LANG_PACKS, v) ? v : 'en'; } catch { return 'en'; } })();
const LANG_PACK = LANG_PACKS[LANG] || null;
// For dates: the browser's own way of writing them in English, the language's way otherwise.
const LANG_LOCALE = LANG_PACK ? LANG_PACK.locale : undefined;
// One piece of English in a language, or null when the language doesn't know it.
function trPiece(k, P) {
  if (Object.prototype.hasOwnProperty.call(P.words, k)) return P.words[k];
  for (const [re, to] of P.rules) { const m = re.exec(k); if (!m) continue; const hit = typeof to === 'function' ? to(m) : k.replace(re, to); if (hit != null) return hit; }
  return null;
}
// A line of English in a language: the whole line if it is known, else each part between " · " that is. The space around it is kept.
function trWith(s, P) {
  const k = s.trim(); if (!k) return s;
  let hit = trPiece(k, P);
  if (hit == null && k.includes(' · ')) { const parts = k.split(' · '), out = parts.map(p => { const h = trPiece(p.trim(), P); return h == null ? p : h; }); if (out.some((p, i) => p !== parts[i])) hit = out.join(' · '); }
  return hit == null ? s : s.replace(k, () => hit);
}
// For words that are drawn rather than put on the page, like the feedback page in a returned paper.
const tr = s => LANG_PACK && typeof s === 'string' ? trWith(s, LANG_PACK) : s;
// The parts of the page that are put into the language, and what inside them is never touched (what a teacher typed).
const LANG_ROOTS = '#rail, #vHome, #vHelp, #welcome, #findDlg, #setLang';
const LANG_RAW = 'script, style, textarea, [contenteditable], [data-raw], .kname, #railClasses .rl, .wllang, .tbn, .trow:not(.none) b, .hlpa p:not(.hlpgo), .hlpa ol, kbd, .rbrand, .wlbrand, #homeDate';
const LANG_ATTRS = ['title', 'aria-label', 'placeholder'];
const langText = n => { const p = n.parentElement; if (!p || p.closest(LANG_RAW)) return; const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; };
const langAttrs = el => { if (el.closest(LANG_RAW)) return; for (const a of LANG_ATTRS) if (el.hasAttribute(a)) { const was = el.getAttribute(a), v = tr(was); if (v !== was) el.setAttribute(a, v); } };
function langEl(el) {
  langAttrs(el); for (const x of el.querySelectorAll('[title], [aria-label], [placeholder]')) langAttrs(x);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) langText(n);
}
const langIn = n => { const el = n.nodeType === 1 ? n : n.parentElement; return !!el && !!el.closest(LANG_ROOTS); };
if (LANG_PACK) {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll(LANG_ROOTS)) langEl(el);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') { if (langIn(m.target)) langText(m.target); }
      else if (m.type === 'attributes') { if (langIn(m.target)) langAttrs(m.target); }
      else for (const n of m.addedNodes) {
        if (n.nodeType === 3) { if (langIn(n)) langText(n); }
        else if (n.nodeType === 1) { if (langIn(n)) langEl(n); else for (const r of n.querySelectorAll(LANG_ROOTS)) langEl(r); }
      }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: LANG_ATTRS });
}
// The language picker, in Settings and on the welcome: choosing one keeps it and draws the page again in it.
const langPick = id => '<select id="' + id + '" class="btn sm wllang" aria-label="Language">' + [['en', 'English'], ...Object.entries(LANG_PACKS).map(([k, p]) => [k, p.name])].map(([k, n]) => '<option value="' + k + '"' + (k === LANG ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
document.addEventListener('change', e => {
  const el = e.target; if (!el || (el.id !== 'setLangPick' && el.id !== 'wlLang')) return;
  try { if (el.value === 'en') localStorage.removeItem('gs.lang'); else localStorage.setItem('gs.lang', JSON.stringify(el.value)); } catch {}
  location.reload();
});
// For the tests and for whoever writes a language file: every piece on the covered parts of the screen as it is now that the language doesn't know.
// Run it with the app in English.
window.__gsLang = { lang: LANG, packs: Object.keys(LANG_PACKS), tr: (s, k) => trWith(s, LANG_PACKS[k]), missing(k) {
  const P = LANG_PACKS[k], out = new Set(), see = s => { const t = (s || '').trim(); if (!t || !/[A-Za-z]{2}/.test(t)) return; if (trPiece(t, P) != null) return; for (const p of t.split(' · ')) { const q = p.trim(); if (q && /[A-Za-z]{2}/.test(q) && trPiece(q, P) == null) out.add(q); } };
  for (const r of document.querySelectorAll(LANG_ROOTS)) {
    if (!r.checkVisibility()) continue;
    for (const x of [r, ...r.querySelectorAll('[title], [aria-label], [placeholder]')]) if (!x.closest(LANG_RAW)) for (const a of LANG_ATTRS) see(x.getAttribute(a));
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) if (n.parentElement && !n.parentElement.closest(LANG_RAW) && !n.parentElement.closest('#hlpList') && n.parentElement.checkVisibility()) see(n.nodeValue);   // the Help answers are the language file's own (help), not looked up
  }
  return [...out];
} };
