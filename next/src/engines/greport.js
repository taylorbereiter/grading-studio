// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, pages, tr, pdfjsLib, fflate, workerReady, noScore } from './gcore.js';
import { viewable, nameWords, rosterMatch, batchClass, anonOn, shownName, SORT_STOP, one } from './gdraw.js';
import { hash, realType } from './gopen.js';

// src/app/media.js
const VIDEO_RX = /\.(mp4|mov|m4v|webm|mkv|3gp)$/i;
// src/app/media.js
const MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', weba: 'audio/webm', aif: 'audio/aiff', aiff: 'audio/aiff', caf: 'audio/x-caf', amr: 'audio/amr' };
// src/app/media.js
const extOf = n => (n.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
// src/app/media.js
const mediaUrl = f => f.url || (f.url = URL.createObjectURL(new Blob([f.data], { type: MIME[extOf(f.name)] || '' })));
// src/app/bringin.js
function sortGuess(path) {
  const c = batchClass(), extra = new Map();
  if (c) for (const [n, s] of rosterMatch(c.names)) extra.set(s, nameWords(n));
  return guessAmong(path, batch.students.map(st => [nameWords(st.key), extra.get(st) || []]));
}
// src/app/bringin.js
function guessAmong(path, people) {
  const fw = new Set(nameWords(path.replace(/\.[^./]+$/, '')).filter(x => !SORT_STOP.has(x)));
  let best = [], bestScore = 0;
  people.forEach((lists, i) => {
    let sc = 0;
    for (const ws0 of lists) {
      const ws = ws0.filter(x => x.length >= 2 || /[^\x00-\x7f]/.test(x) || /^\d+$/.test(x)); if (!ws.length) continue;
      const hit = ws.filter(x => fw.has(x)).length;
      sc = Math.max(sc, hit === ws.length && hit >= 2 ? 100 + hit : hit);
      if (ws.some(x => /^\d{4,}$/.test(x) && fw.has(x))) sc = Math.max(sc, 150);   // a student ID number in the file name
    }
    if (sc > bestScore) { bestScore = sc; best = [i]; } else if (sc === bestScore && sc > 0) best.push(i);
  });
  if (best.length !== 1 || !bestScore) return { i: -1, sure: false };
  return { i: best[0], sure: bestScore >= 2 };
}
// src/carryover.js
const sameBytes = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
// src/intake.js
function textOf(f) {
  const d = f.data;
  if (realType(d) === 'rtf') return rtfText(new TextDecoder('windows-1252').decode(d));
  if (d[0] === 0xff && d[1] === 0xfe) return new TextDecoder('utf-16le').decode(d);
  if (d[0] === 0xfe && d[1] === 0xff) return new TextDecoder('utf-16be').decode(d);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(d); } catch { return new TextDecoder('windows-1252').decode(d); }
}
// src/intake.js
const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'themedata', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl']);
// src/intake.js
function rtfText(s) {
  let out = '', skip = 0, depth = 0, uc = 1, drop = 0;
  const hold = [], rx = /\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\(.)|([{}])|[\r\n]+|([^\\{}\r\n]+)/gs, one = new TextDecoder('windows-1252');
  const add = t => { if (!skip) out += t; };
  for (const m of s.matchAll(rx)) {
    const [, word, num, hex, sym, brace, plain] = m;
    if (brace === '{') { depth++; hold.push(uc); continue; }
    if (brace === '}') { if (skip && depth <= skip) skip = 0; depth--; uc = hold.pop() ?? 1; continue; }
    if (drop && (hex || plain)) {
      if (hex) { drop--; continue; }
      const n = Math.min(drop, plain.length); drop -= n;
      add(plain.slice(n));
      continue;
    }
    drop = 0;
    if (word) {
      if (RTF_SKIP.has(word)) { if (!skip) skip = depth; }
      else if (word === 'par' || word === 'line' || word === 'sect' || word === 'row') add('\n');
      else if (word === 'tab' || word === 'cell') add('\t');
      else if (word === 'uc') uc = +num || 0;
      else if (word === 'u') { add(String.fromCodePoint((+num + 65536) % 65536)); drop = uc; }
      else if (word === 'emdash') add('—'); else if (word === 'endash') add('–'); else if (word === 'bullet') add('•');
      else if (word === 'lquote') add('‘'); else if (word === 'rquote') add('’'); else if (word === 'ldblquote') add('“'); else if (word === 'rdblquote') add('”');
    }
    else if (hex) add(one.decode(Uint8Array.of(parseInt(hex, 16))));
    else if (sym === '*') { if (!skip) skip = depth; }
    else if (sym === '~') add(' ');
    else if (sym === '\\' || sym === '{' || sym === '}') add(sym);
    else if (plain) add(plain);
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// src/intake.js
const dropIt = 'drop the new file on their name';
// src/intake.js
const askAgain = 'Ask the student to turn it in again, as a PDF or Word file.', askLow = 'ask the student to turn it in again, as a PDF or Word file.';
// src/intake.js
function picNext() { return (isMac() ? 'Open it in Preview, choose File, then Export, and save it as a JPEG. Then ' : 'Open it in the Photos app and save a copy as a JPG. Then ') + dropIt + '. Or ask the student for a JPG or PDF.'; }
// src/intake.js
const FILE_WHY = [
  [/^doc$/, 'An older Word file (.doc). A browser can’t read these.', () => 'Download it, open it in Word, save it as .docx or PDF, and ' + dropIt + '. Or ask the student for one.'],
  [/^odt$/, 'An OpenDocument file (.odt), which LibreOffice and Google Docs can make. It can’t be shown here.', () => 'Download it, open it in Word or Google Docs, save it as .docx or PDF, and ' + dropIt + '. Or ask the student for one.'],
  [/^pages$/, 'A Pages file from a Mac or iPad. It can’t be shown here.', () => (isMac() ? 'Download it, open it in Pages, choose File, then Export To, then PDF, and ' + dropIt + '. Or ask' : 'Ask') + ' the student for a PDF or Word file.'],
  [/^(gdoc|gsheet|gslides|gdraw|gform)$/, 'This is only a shortcut to a Google file. There’s no paper inside it.', () => 'Ask the student to download it from Google as a PDF or Word file and turn that in.'],
  [/^(url|webloc|lnk|alias|desktop)$/, 'This is only a shortcut to something somewhere else. There’s no paper inside it.', () => 'Ask the student to turn in the file itself, as a PDF or Word file.'],
  [/^(html?|mhtml?|webarchive)$/, 'A saved web page. It can’t be shown here.', () => 'Download it, open it in Chrome, print it, choose Save as PDF, and ' + dropIt + '.'],
  [/^(heic|heif)$/, 'An iPhone photo that couldn’t be read here.', () => picNext()],
  [/^tiff?$/, 'A TIFF picture. Chrome can’t read these.', () => picNext()],
  [/^(pptx?|key|odp)$/, 'Slides can’t be shown here.', () => 'Download them to open them, or ask the student for a PDF.'],
  [/^(xlsx?|numbers|csv|ods)$/, 'A spreadsheet. It can’t be shown here.', () => 'Download it to open it, or ask the student for a PDF.'],
  [/^(wma|avi|wmv|mpe?g|flv|ra|asf|vob|ts|mts)$/, 'A recording of a kind Chrome can’t play.', () => 'Download it and play it on your computer, or ask the student for an .mp4 or .mp3.'],
  [/^zip$/, 'This ZIP couldn’t be opened. It may be damaged or locked.', () => 'Download it and try opening it on your computer. If it opens, drop the files inside it on their name. If not, ask the student to turn it in again.'],
  [/^(rar|7z|tar|gz|tgz)$/, 'A packed file of a kind a browser can’t unpack.', () => 'Download it, unpack it on your computer, and drop the files inside it on their name. Or ask the student for a PDF.'],
];
// src/intake.js
function wordBad(f) {
  if (f.wordFor === f.data) return f.wordIs;
  const real = realType(f.data);
  let bad = real === 'ole' ? 'locked' : real === 'html' ? 'page' : '';
  if (!bad) { try { if (!fflate.unzipSync(f.data, { filter: x => x.name === 'word/document.xml' })['word/document.xml']) bad = 'damaged'; } catch { bad = 'damaged'; } }
  f.wordFor = f.data; f.wordIs = bad;
  return bad;
}
// src/intake.js
const WEB_PAGE = { why: 'The name says it’s a paper, but inside it’s a web page, often a sign-in page saved by mistake.', next: askAgain };
// src/intake.js
function troubleOf(f) {
  if (f.virtual) return null;
  if (!f.size || !f.data) return { why: 'This file is empty. Nothing came through.', next: askAgain };
  const real = f.kind === 'img' ? '' : realType(f.data);
  if (viewable(f)) {
    if (!f.bad) return null;
    if (real === 'html') return WEB_PAGE;
    if (f.badIs === 'locked') return { why: 'This PDF is locked with a password.', next: 'Ask the student for a copy with no password. If you know the password, open it in Chrome, print it, choose Save as PDF, and ' + dropIt + '.' };
    return { why: 'This PDF is damaged, or it didn’t finish uploading.', next: 'Download it and try opening it on your computer. If it opens, print it to a new PDF and ' + dropIt + '. If not, ' + askLow };
  }
  if (f.kind === 'text' || f.kind === 'link') return null;
  if (f.kind === 'docx') {
    const bad = wordBad(f); if (!bad) return null;
    if (bad === 'page') return WEB_PAGE;
    if (bad === 'locked') return { why: 'This Word file is locked with a password.', next: 'Ask the student for a copy with no password. If you know the password, open it in Word, take the password off, save it, and ' + dropIt + '.' };
    return { why: 'This Word file is damaged, or it didn’t finish uploading.', next: 'Download it and try opening it in Word. If it opens, save a new copy and ' + dropIt + '. If not, ' + askLow };
  }
  if (f.kind === 'media') return f.noPlay ? { why: 'This recording won’t play in this browser. It may be a kind Chrome can’t play, or it may be damaged.', next: 'Download it and play it on your computer, or ask the student for an .mp4 or .mp3.' } : null;
  if (real === 'html' && !/\.html?$/i.test(f.name)) return WEB_PAGE;
  const ext = extOf(f.name);
  if (f.hurt || /^(jpe?g|png|gif|webp|bmp|avif)$/.test(ext)) return { why: 'This picture couldn’t be read. It may be damaged, or it didn’t finish uploading.', next: askAgain.replace('as a PDF or Word file', 'as a JPG or PDF') };
  const hit = FILE_WHY.find(([rx]) => rx.test(ext));
  if (hit) return { why: hit[1], next: hit[2]() };
  return { why: 'This kind of file can’t be shown here.', next: 'Download it to open it on your computer, or ask the student for a PDF or Word file.' };
}
// src/intake.js
const troubleText = tr => tr ? tr.why + ' ' + tr.next : '';
// src/intake.js
function pdfBad(f, e) {
  const locked = !!e && (e.name === 'PasswordException' || /password/i.test(e.message || ''));
  f.badIs = locked ? 'locked' : 'damaged'; f.bad = locked ? 'it’s password-protected' : 'it couldn’t be opened';
}
// src/intake.js
const mediaProbe = f => new Promise(res => {
  const m = document.createElement(VIDEO_RX.test(f.name) ? 'video' : 'audio');
  const done = () => { clearTimeout(t); m.removeAttribute('src'); m.load(); res(); }, t = setTimeout(done, 6000);
  m.preload = 'metadata';
  m.onerror = () => { f.noPlay = true; done(); };
  m.onloadedmetadata = () => { if (VIDEO_RX.test(f.name) && !m.videoWidth) f.noPicture = true; done(); };
  m.src = mediaUrl(f);
});
// src/intake.js
function checkFile(f) { return f.virtual || !f.size ? Promise.resolve() : (f.checked ||= checkFileNow(f)); }
// src/intake.js
async function checkFileNow(f) {
  if (viewable(f)) {
    if (f.bad) return;
    try {
      await workerReady;
      const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
      f.numPages = d.numPages;
      for (let p = 1; p <= d.numPages; p++) { try { (await d.getPage(p)).cleanup(); } catch { (f.badPages ||= []).includes(p) || f.badPages.push(p); } }
      d.destroy();
    } catch (e) { pdfBad(f, e); }
  } else if (f.kind === 'media') await mediaProbe(f);
}
// src/intake.js
async function checkStack(b) {
  for (const st of b.students) {
    for (const f of [...st.files]) {
      if (batch !== b) return;
      await checkFile(f);
    }
  }
}
// src/intake.js
function openingFacts() {
  const anon = anonOn(), x = { ok: 0, total: 0, nStu: 0, cant: [], nothing: [], odd: [], zip: batch.zipBad || null, keys: [] };
  const look = (st, i, note, key, file) => { x.odd.push({ i, name: shownName(st, i), note, file }); x.keys.push('odd|' + key); };
  const c = batchClass(), onRoster = c && c.names.length ? new Set(rosterMatch(c.names).values()) : null;
  batch.students.forEach((st, i) => {
    const real = st.files.filter(f => !f.virtual), name = shownName(st, i);
    if (!real.length) { if (!noScore(st)) { x.nothing.push({ i, name }); x.keys.push('none|' + st.key); } return; }
    x.nStu++;
    if (onRoster && !onRoster.has(st)) look(st, i, 'isn’t on the ' + (c.name || 'class') + ' roster.', 'roster|' + st.key);
    for (const f of real) {
      x.total++;
      const tr = troubleOf(f);
      if (tr) { x.cant.push({ i, name, file: f.path, shown: anon ? '' : f.name, why: tr.why, next: tr.next }); x.keys.push('cant|' + f.path); continue; }
      x.ok++;
      if (f.hurt) look(st, i, (anon ? 'A picture' : f.name) + ' looks damaged or cut off. Your marks are still on it. The student may need to turn it in again.', 'hurt|' + f.path, f.path);
      if (f.badPages) look(st, i, (f.badPages.length === 1 ? 'One page' : f.badPages.length + ' pages') + ' of ' + (anon ? 'a file' : f.name) + ' couldn’t be read: page ' + f.badPages.join(', ') + '. The student may need to turn it in again.', 'pages|' + f.path, f.path);
      if (f.noPicture) look(st, i, (anon ? 'A video' : f.name) + ' plays only as sound here.', 'sound|' + f.path, f.path);
      if (!f.added) {
        const g = sortGuess(f.name);
        if (g.sure && g.i >= 0 && g.i !== i && batch.students[g.i]) look(st, i, (anon ? 'A file' : f.name) + ' has a name that looks like another student’s. If it’s theirs, Move to… on the file sends it over.', 'name|' + f.path, f.path);
      }
    }
  });
  // The very same file from two students. Pictures are made into new pages as they open, so only other files can be compared. A handout most of the class turned in isn't odd.
  const bySize = new Map();
  batch.students.forEach((st, i) => { for (const f of st.files) if (!f.virtual && f.kind !== 'img' && f.kind !== 'link' && f.size && !isNotes(f.data)) { if (!bySize.has(f.size)) bySize.set(f.size, []); bySize.get(f.size).push({ st, i, f }); } });
  for (const list of bySize.values()) {
    const groups = [];
    for (const o of list) { const g = groups.find(q => sameBytes(q[0].f.data, o.f.data)); if (g) g.push(o); else groups.push([o]); }
    for (const g of groups) {
      const who = [...new Map(g.map(o => [o.i, o])).values()];
      if (who.length < 2 || (who.length >= 3 && who.length * 2 > batch.students.length)) continue;
      const a = who[0];
      look(a.st, a.i, 'turned in the very same file as ' + who.slice(1).map(o => shownName(o.st, o.i)).join(', ') + '.', 'same|' + who.map(o => o.f.path).join('|'));
    }
  }
  return x;
}
// src/intake.js
function repHead(x) {
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
  return (x.total ? x.ok + ' of ' + n(x.total, 'file', 'files') + ' opened.' : '') + (x.cant.length || x.zip ? ' ' + (x.cant.length + (x.zip ? x.zip.n : 0)) + ' couldn’t.' : '') +
    (x.nothing.length ? ' ' + n(x.nothing.length, 'student has', 'students have') + ' nothing turned in.' : '') + (x.odd.length ? ' ' + n(x.odd.length, 'thing looks', 'things look') + ' odd.' : '');
}
// src/intake.js
function zipSay(z) {
  const how = isMac() ? 'Double-click it in Finder to unzip it' : 'Right-click it, choose Extract All';
  return (z.names ? (anonOn() ? 'A ZIP' : z.names.join(', ')) + (z.names.length === 1 ? ' couldn’t be opened. It may be damaged or still downloading. ' : ' couldn’t be opened. ') : z.skip + (z.skip === 1 ? ' file in the ZIP is' : ' files in the ZIP are') + ' packed in a way a browser can’t open. ') + how + ', then choose the folder.';
}
// src/polish.js
function isMac() { return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent); }
// src/video.js
const NP_W = 595.28, NP_H = 841.89, NP_M = 48, NP_TAIL = '%GradingStudio-notes';
// src/video.js
const isNotes = d => !!d && d.length > 64 && new TextDecoder('latin1').decode(d.subarray(d.length - 64)).includes(NP_TAIL);
export { openingFacts, checkStack, checkFile, repHead, zipSay, troubleOf, troubleText, hash, textOf };
export { sameBytes };
