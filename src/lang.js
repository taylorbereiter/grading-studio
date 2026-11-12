/* ---------------- languages (Stage 6): the app in a language other than English ----------------
   Built into both pages, after the language files (src/lang-*.js) and before everything else.
   The app is written in English. A language is one file: the English words and sentences it knows, each with its own, the answers
   on the Help page, and how it writes a date. Nothing else in the app knows which language is on. What is drawn inside the parts of
   the page listed in LANG_ROOTS is read as it lands and put into the language, a piece at a time: a whole line, or each part of a line
   that is joined with " · ". A piece the file doesn't know stays as it is, so a class's name, a student's and an assignment's are
   left alone, and a screen that hasn't been translated yet is simply still in English.
   The choice is one setting in this browser (gs.lang), read by both pages. English adds nothing and runs none of this.
   To add a language: copy src/lang-es.js (Spanish) or src/lang-zh.js (Traditional Chinese), translate it, and name it in LANGS in build.js. test/lang.test.js lists what a
   file still leaves in English on the screens it covers. */
// Where a language comes from. A page at the web address fetched the chosen one before this ran (lang/<code>.js, which leaves it in
// window.__gsLangs; build.js says how). A double-click copy carries every language squeezed (LANG_PACKED) and unpacks the one asked for.
// LANG_NAMES lists every language by its code, with its own name for itself.
const LANG_OPEN = {};
function langPack(k) {
  if (!Object.prototype.hasOwnProperty.call(LANG_NAMES, k)) return null;
  if (window.__gsLangs && window.__gsLangs[k]) return window.__gsLangs[k];
  if (!Object.prototype.hasOwnProperty.call(LANG_PACKED, k)) return null;
  if (!LANG_OPEN[k]) { try { const b = atob(LANG_PACKED[k]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); LANG_OPEN[k] = new Function(fflate.strFromU8(fflate.inflateSync(u)))(); } catch (e) { console.error(e); return null; } }
  return LANG_OPEN[k];
}
// Fetches a language that isn't here yet. The app itself never needs this (the page fetched the chosen one as it opened); the tests do.
const langLoad = k => langPack(k) || !Object.prototype.hasOwnProperty.call(LANG_NAMES, k) ? Promise.resolve(!!langPack(k)) : new Promise(done => {
  const s = document.createElement('script'); s.src = 'lang/' + k + '.js' + (window.gsLangV && window.gsLangV[k] ? '?' + window.gsLangV[k] : ''); s.onload = () => done(!!langPack(k)); s.onerror = () => done(false); document.head.appendChild(s);
});
// The language she chose. If its file could not be fetched (no internet, and never used on this computer), this visit is in English
// and the choice stays, so it comes back by itself.
const LANG_WANT = (() => { try { const v = JSON.parse(localStorage.getItem('gs.lang')); return typeof v === 'string' && Object.prototype.hasOwnProperty.call(LANG_NAMES, v) ? v : 'en'; } catch { return 'en'; } })();
const LANG_PACK = LANG_WANT === 'en' ? null : langPack(LANG_WANT);
const LANG = LANG_PACK ? LANG_WANT : 'en';
// For dates: the browser's own way of writing them in English, the language's way otherwise.
const LANG_LOCALE = LANG_PACK ? LANG_PACK.locale : undefined;
// The lines with a number or a name in them that every language answers from its own "fill" list, so the English is matched once, here.
// In a fill, {1} {2} are the parts found in the English, {t1} is that part put into the language when it is known, and a pair is
// one / many by the first number. A line made of several sentences is put together from its pieces (the functions).
const langCap = s => s.charAt(0).toUpperCase() + s.slice(1);
function langFill(t, m, P) {
  const s = Array.isArray(t) ? t[+m[1] === 1 ? 0 : 1] : t;
  return s.replace(/\{(t?)(\d)\}/g, (x, w, i) => { const v = m[+i] == null ? '' : m[+i]; if (!w) return v; const h = trPiece(v, P); return h != null ? h : (trPiece(langCap(v), P) || v); });
}
const LANG_ATT = { present: 'attp', late: 'attl', 'absent, reason unknown': 'atta', excused: 'atte' };
const LANG_FILLS = [
  // the Gradebook tab
  ['sdet', /^Student details for (.+)$/], ['cnt', /^Count (.+) in the class average$/], ['wout', /^without (\d+) students? ·$/],
  ['nograde', /^Nothing graded for (.+) in this term yet\. Grade a download for it, or use \+ Add scores for work you did before\.$/],
  ['noroster', /^The gradebook lists the students on a class’s roster\. Add a roster to (.+) on its class page first\.$/],
  ['untyped1', /^“(.+)” has no type yet, so it doesn’t count toward a term grade\.$/], ['untypedN', /^(\d+) assignments have no type yet, so they don’t count toward a term grade\.$/],
  ['given', /^(\d+) given$/], ['bydate', /^By the date \((.+)\)$/], ['typedfor', /^Typed-in scores for (.+)$/], ['addfor', /^Add scores for (.+)$/],
  ['xcfor', /^Extra credit for (.+)$/], ['scfor', /^Score for (.+)$/], ['ofxc', /^(\d+) of (\d+) given extra credit$/], ['ofdone', /^(\d+) of (\d+) complete$/], ['ofent', /^(\d+) of (\d+) entered$/],
  ['xcI', /^Each point adds one percentage point to the (.+), which then counts by its weight\. Leave a student blank for none\. It doesn’t change any assignment’s score\.$/],
  ['xcon', /^\+([\d.,]+)% on the term grade$/], ['xconi', /^\+([\d.,]+) on the (.+)$/], ['avg', /^([^·.:]{1,40}) average$/], ['scout', /^Score out of ([\d.,]+)$/],
  ['notros', /^Not on the roster, so left out: (.+)\. Type their scores in by hand\.$/],
  ['how', /^Students are in your roster order\. (?:Each type’s average counts every assignment of that type the same; the (term grade|grade) weights them by your Term setup\. )?Missing and Excused never count against a student\. Point at a (term grade|grade) to see how it’s worked out(, extra credit included)?\.( Scores you typed in can be changed here; a graded download’s scores change in that download\.)?$/,
    (m, F) => [F.how1, m[1] ? (m[1] === 'grade' ? F.how2g : F.how2t) : '', F.how3, (m[2] === 'grade' ? F.how4g : F.how4t).replace('{xc}', m[3] ? F.howxc : ''), m[4] ? F.how5 : ''].filter(Boolean).join(F.sp)],
  // the Students tab
  ['pasteS', /^Paste a class list with names and a student ID or email column \(from (.+) or a spreadsheet\)\. Each row fills in the student with the same name\.$/],
  ['withid', /^(\d+) with an ID$/], ['idfor', /^Student ID for (.+)$/], ['emfor', /^Email for (.+)$/], ['lyfor', /^Last year’s level for (.+)$/],
  // the Attendance tab
  ['notefor', /^Note for (.+)$/], ['att', /^(\d+) (present|late|absent, reason unknown|excused)$/, (m, F, P) => langFill(F[LANG_ATT[m[2]]], m, P)],
  ['cap', /^(Each press is saved as you make it\.|Everyone starts as present\. Press Late or Absent for anyone who isn’t, or “Everyone is here” if they all are\.) Absent starts as “reason unknown”; press “Absent, excused” once you know the absence is excused\. With a name in focus, P, L, A and E set it and move to the next student\.$/,
    (m, F) => (m[1].startsWith('Each') ? F.capA : F.capB) + F.sp + F.capR],
  ['noatt', /^No attendance saved in (.+)\.$/], ['openday', /^Open (?!in )(.*\d.*)$/],
  ['taken', /^(\d+) days? taken(?: in (.+))?\. Click a date to open or change that day, or a name for that student’s page\. “Here” counts everyone present or late\.$/,
    (m, F, P) => langFill(m[2] ? F.takenin : F.taken, m, P) + F.sp + F.takenR],
  ['unk', /^(\d+) absences? still ha(?:s|ve) no reason\.$/], ['andmore', /^and (\d+) more\. Open the day and press “Absent, excused” when you hear why\.$/],
  // the Missing work tab
  ['owes', /^(\d+) students? owes? (\d+) pieces? of work$/, (m, F, P) => langFill(F.owesA, m, P) + F.sp + langFill(F.owesB, [0, m[2]], P)],
  ['reminded', /^Reminded (.+)$/], ['ago', /^(\d+) days? ago$/],
  // the Seating tab
  ['pick', /^Pick the closest one\. There is a desk for each of the (\d+) students, and any desk can be moved or taken away afterwards\.$/],
  ['seated', /^(\d+) of (\d+) seated$/], ['needed', /^(\d+) more desks? needed$/], ['desk', /^Desk, (.+)\. Click to take it away$/],
];
// One piece of English in a language, or null when the language doesn't know it. A word that means two things ("Late" for a paper
// and for a student) has its second meaning under the name of the part of the screen it is on (data-lc), as "att|Late".
function trPiece(k, P, ctx) {
  if (ctx && Object.prototype.hasOwnProperty.call(P.words, ctx + '|' + k)) return P.words[ctx + '|' + k];
  if (Object.prototype.hasOwnProperty.call(P.words, k)) return P.words[k];
  // On a named part of the screen the shared lines come first, so "1 late" there is a student and not a paper.
  const fills = () => { if (P.fill) for (const [key, re, fn] of LANG_FILLS) { const m = re.exec(k); if (!m) continue; const hit = fn ? fn(m, P.fill, P) : P.fill[key] != null ? langFill(P.fill[key], m, P) : null; if (hit != null) return hit; } return null; };
  if (ctx) { const hit = fills(); if (hit != null) return hit; }
  for (const [re, to] of P.rules) { const m = re.exec(k); if (!m) continue; const hit = typeof to === 'function' ? to(m) : k.replace(re, to); if (hit != null) return hit; }
  return ctx ? null : fills();
}
// A line of English in a language: the whole line if it is known, else each part between " · " that is. The space around it is kept.
function trWith(s, P, ctx) {
  const k = s.trim(); if (!k) return s;
  let hit = trPiece(k, P, ctx);
  if (hit == null && k.includes(' · ')) { const parts = k.split(' · '), out = parts.map(p => { const h = trPiece(p.trim(), P, ctx); return h == null ? p : h; }); if (out.some((p, i) => p !== parts[i])) hit = out.join(' · '); }
  return hit == null ? s : s.replace(k, () => hit);
}
// For words that are drawn rather than put on the page, like the feedback page in a returned paper.
const tr = (s, ctx) => LANG_PACK && typeof s === 'string' ? trWith(s, LANG_PACK, ctx) : s;
// The parts of the page that are put into the language, and what inside them is never touched (what a teacher typed).
const LANG_ROOTS = '#rail, #vHome, #vHelp, #welcome, #findDlg, #setLang, #vSettings, #vClass .clshead, #vClass .ctabs, #vClass .ctools, #vClass .board, #classHint, ' + ['gradebook', 'students', 'attendance', 'seating', 'missing'].map(t => '#classPanel[data-tab="' + t + '"]').join(', ');
const LANG_RAW = 'script, style, textarea, [contenteditable], [data-raw], .kname, #railClasses .rl, .wllang, .tbn, .trow:not(.none) b, .hlpa p:not(.hlpgo), .hlpa ol, kbd, .rbrand, .wlbrand, #homeDate, .aiWord, .updnotes, #vSettings .nt b, #meSys option:not([value]), #meAi option:not([value]), #wlSys option:not([value]), #vClass .clshead h1, #vClass .uhead .nm, #vClass .card .t, #classPanel .bklink, #classPanel .bkpop > b, #bkaRows td:first-child, #bkaUnit option:not([value=""]), #peopleTbl td.nm a, .attname, #attDate, .attunk a, .misw, .mishead h3, .misaddr, .seat span, .seatchip, #seatSel b';
const LANG_ATTRS = ['title', 'aria-label', 'placeholder'];
const langCtx = el => { const c = el.closest('[data-lc]'); return c ? c.dataset.lc : ''; };
const langText = n => { const p = n.parentElement; if (!p || p.closest(LANG_RAW)) return; const v = tr(n.nodeValue, langCtx(p)); if (v !== n.nodeValue) n.nodeValue = v; };
// What she types in a box is hers; the grey words in it before she types are the app's.
const langRawEl = el => { const r = el.closest(LANG_RAW); return !!r && !(r === el && el.tagName === 'TEXTAREA' && !el.parentElement.closest(LANG_RAW)); };
const langAttrs = el => { if (langRawEl(el)) return; for (const a of LANG_ATTRS) if (el.hasAttribute(a)) { const was = el.getAttribute(a), v = tr(was, langCtx(el)); if (v !== was) el.setAttribute(a, v); } };
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
const langPick = id => '<select id="' + id + '" class="btn sm wllang" aria-label="Language">' + [['en', 'English'], ...Object.entries(LANG_NAMES)].map(([k, n]) => '<option value="' + k + '"' + (k === LANG_WANT ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
document.addEventListener('change', e => {
  const el = e.target; if (!el || (el.id !== 'setLangPick' && el.id !== 'wlLang')) return;
  try { if (el.value === 'en') localStorage.removeItem('gs.lang'); else localStorage.setItem('gs.lang', JSON.stringify(el.value)); } catch {}
  location.reload();
});
// For the tests and for whoever writes a language file: every piece on the covered parts of the screen as it is now that the language doesn't know.
// Run it with the app in English.
window.__gsLang = { lang: LANG, want: LANG_WANT, packs: Object.keys(LANG_NAMES), load: langLoad, tr: (s, k) => trWith(s, langPack(k)), missing(k) {
  const P = langPack(k), out = new Set(), see = (s, el) => { const t = (s || '').trim(), c = langCtx(el); if (!t || !/[A-Za-z]{2}/.test(t)) return; if (trPiece(t, P, c) != null) return; for (const p of t.split(' · ')) { const q = p.trim(); if (q && /[A-Za-z]{2}/.test(q) && trPiece(q, P, c) == null) out.add(q); } };
  for (const r of document.querySelectorAll(LANG_ROOTS)) {
    if (!r.checkVisibility()) continue;
    for (const x of [r, ...r.querySelectorAll('[title], [aria-label], [placeholder]')]) if (!langRawEl(x)) for (const a of LANG_ATTRS) see(x.getAttribute(a), x);
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) if (n.parentElement && !n.parentElement.closest(LANG_RAW) && !n.parentElement.closest('#hlpList') && (n.parentElement.closest('select') || n.parentElement).checkVisibility()) see(n.nodeValue, n.parentElement);   // the Help answers are the language file's own (help), not looked up
  }
  return [...out];
} };
