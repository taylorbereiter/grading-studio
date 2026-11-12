/* ---------------- bringing files in: what a file really is, why one won't open and what to do next, late work, the opening report ---------------- */
// What the first bytes say a file is, whatever its name says. '' when they don't say.
function realType(d) {
  if (!d || !d.length) return 'empty';
  const at = (i, s) => { for (let k = 0; k < s.length; k++) if (d[i + k] !== s.charCodeAt(k)) return false; return true; };
  if (at(0, '%PDF')) return 'pdf';
  if (d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff) return 'jpeg';
  if (at(0, '\x89PNG')) return 'png';
  if (at(0, 'GIF8')) return 'gif';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'webp';
  if (at(0, 'BM')) return 'bmp';
  if (at(0, 'II*\0') || at(0, 'MM\0*')) return 'tiff';
  if (at(4, 'ftyp')) { const b = String.fromCharCode(d[8], d[9], d[10], d[11]); return /^(hei[cxms]|hev[cxms]|mif1|msf1)$/.test(b) ? 'heic' : /^avi[fs]$/.test(b) ? 'avif' : ''; }
  if (at(0, 'PK\x03\x04')) return 'zip';
  if (at(0, '\xd0\xcf\x11\xe0')) return 'ole';   // an old Office file, or a new one locked with a password
  if (at(0, '{\\rtf')) return 'rtf';
  if (/^(\xef\xbb\xbf)?\s*<(!doctype html|html)/i.test(String.fromCharCode(...d.subarray(0, 40)))) return 'html';
  return '';
}
const textBytes = d => { if (!d) return false; for (let i = 0; i < Math.min(d.length, 512); i++) if (d[i] < 9 || (d[i] > 13 && d[i] < 27)) return false; return true; };
// A name can be wrong: a picture is a picture and a Word file is a Word file whatever they're called. kind is what the name alone says.
function trueKind(kind, name, data) {
  if (kind === 'text' && textBytes(data)) return kind;   // notes that happen to begin "BMW" or "GIF89a is": a real picture has bytes no text file has
  const real = realType(data);
  if (/^(jpeg|png|gif|webp|bmp|heic|avif)$/.test(real)) return 'img';
  if (real === 'rtf' && /\.(doc|rtf|txt)$/i.test(name)) return 'text';
  if (real === 'zip' && /\.doc$/i.test(name)) { try { if (fflate.unzipSync(data, { filter: x => x.name === 'word/document.xml' })['word/document.xml']) return 'docx'; } catch {} }
  return kind;
}
// Whether Chrome can read the whole picture. The PDF maker reads only the top of a JPEG, and a cut-off PNG can freeze it, so a damaged one is caught here first.
const picReads = d => createImageBitmap(new Blob([d])).then(b => { b.close(); return true; }, () => false);
// A picture as a one-page PDF, or hurt: it's damaged. turn: how far a phone says its JPEG should be turned, kept apart from the bytes (see photoTurns). was: this picture never opened before.
async function pictureToPdf(data, name) {
  const real = realType(data), named = isImg(name), more = IMG_MORE.test(name);
  if (!more && (real === 'jpeg' || real === 'png') && !await picReads(data)) return { hurt: true };
  if (!more && (real === 'jpeg' || real === 'png')) return { pdf: await imageToPdf(data, real === 'png' ? 'page.png' : 'page.jpg'), turn: real === 'jpeg' ? jpegTurn(data) : 0, was: !(named && (real === 'png') === /\.png$/i.test(name)) };
  if (named && !/^(heic|gif|webp|bmp|avif)$/.test(real)) return { pdf: await imageToPdf(data, name) };   // bytes it doesn't know: stops here, as a damaged picture
  if (real === 'heic') { try { return { pdf: await anyImageToPdf(data) }; } catch {} return { pdf: await heicToPdf(data), was: true }; }
  return { pdf: await anyImageToPdf(data), was: !more };
}
// The turn a JPEG's EXIF asks for, clockwise. A mirrored photo (front camera, rare) gets its turn and stays mirrored.
function jpegTurn(b) {
  try {
    for (let i = 2; i + 4 < b.length && b[i] === 0xff;) {
      const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
      if (m === 0xda || m === 0xd9) return 0;
      if (m === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {   // "Exif"
        const t = i + 10, le = b[t] === 0x49, u16 = o => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1], u32 = o => le ? u16(o) + u16(o + 2) * 65536 : u16(o) * 65536 + u16(o + 2);
        const ifd = t + u32(t + 4), n = u16(ifd);
        for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (u16(e) === 0x112) return { 3: 180, 4: 180, 5: 270, 6: 90, 7: 90, 8: 270 }[u16(e + 8)] || 0; }
        return 0;
      }
      i += 2 + len;
    }
  } catch {}
  return 0;
}
// Old saved work on a sideways photo has marks and name covers placed on it as it looked then, so only a photo with no work on it starts turned. The turn is an ordinary
// f.rot, so marks, export and everything else already follow it. Until she has marked it the turn isn't saved: nothing about it needs keeping, and it isn't work.
const photoHasWork = f => Object.values(f.marks).some(a => a.length) || !!f.hand || !!batch.share?.boxes?.[boxKey(f.path, 0)]?.length;
async function photoTurns() {
  for (const st of batch.students) for (const f of st.files) {
    // A damaged JPEG she marked before that was noticed stays a page, as she marked it. The opening report still says. A damaged PNG can freeze the PDF maker, so it stays a file, and her marks stay saved.
    if (f.hurt && photoHasWork(f) && realType(f.data) === 'jpeg') { try { f.data = await imageToPdf(f.data, realType(f.data) === 'png' ? 'page.png' : 'page.jpg'); f.kind = 'img'; } catch {} }
    if (f.photoTurn && !f.rot && !photoHasWork(f)) f.rot = { 0: f.photoTurn };
    // A picture that only now opens (an iPhone photo, one with the wrong name) isn't in a page order she made before it could. A saved order newer than that (Lp) left it out on purpose.
    if (f.was && st.layoutOld && !st.layout.some(d => d.pages.some(([q]) => q === f.path))) st.layout.push({ name: f.name, file: f.path, pages: [[f.path, 0]] });
  }
}
function rotToSave(f) {
  const r = f.rot && Object.keys(f.rot).length ? f.rot : null;
  if (!f.photoTurn) return r;
  if (!r) return { 0: 0 };   // she turned it back to how the camera left it, or it's old work drawn on it that way
  return r[0] === f.photoTurn && !photoHasWork(f) ? null : r;
}
// iPhone photos. Chrome can't read them, so the decoder (libheif, in its own script block) comes to life the first time it's needed, and nothing is fetched.
let heicLib = null, heicDec = null;
const heicThere = () => { const s = $('#heicSrc'); return !!heicLib || (!!s && s.textContent.length > 1000); };
function heicLoad() {
  if (heicLib) return heicLib;
  if (!heicThere()) throw new Error('no decoder in this copy');
  const all = fflate.inflateSync(Uint8Array.from(atob($('#heicSrc').textContent), c => c.charCodeAt(0))), n = new DataView(all.buffer, all.byteOffset).getUint32(0, true);
  let bin = ''; for (let i = 4; i < 4 + n; i += 32768) bin += String.fromCharCode(...all.subarray(i, Math.min(i + 32768, 4 + n)));
  const s = document.createElement('script');
  s.textContent = new TextDecoder().decode(all.subarray(4 + n)).replace('@@WASM@@', () => btoa(bin));
  document.head.appendChild(s); s.remove();
  heicLib = window.libheif();
  $('#heicSrc').textContent = '';
  return heicLib;
}
async function heicToPdf(bytes) {
  toast('Reading an iPhone photo…', 4000);
  await new Promise(r => setTimeout(r, 0));
  const lib = heicLoad(), imgs = (heicDec ||= new lib.HeifDecoder()).decode(bytes);   // the next decode frees this one's memory
  if (!imgs || !imgs.length) throw new Error('no picture in it');
  const im = imgs[0], W = im.get_width(), H = im.get_height(), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d'), out = ctx.createImageData(W, H);
  await new Promise((res, rej) => im.display(out, d => d ? res() : rej(new Error('couldn’t read the picture'))));
  ctx.putImageData(out, 0, 0);
  for (const x of imgs) x.free();
  const jpg = await canvasJpg(c, 0.92);
  c.width = c.height = 0;
  return imageToPdf(jpg, 'page.jpg');
}

/* ---------------- text files ---------------- */
// Windows Notepad's UTF-16 and old Windows text both come out readable.
function textOf(f) {
  const d = f.data;
  if (realType(d) === 'rtf') return rtfText(new TextDecoder('windows-1252').decode(d));
  if (d[0] === 0xff && d[1] === 0xfe) return new TextDecoder('utf-16le').decode(d);
  if (d[0] === 0xfe && d[1] === 0xff) return new TextDecoder('utf-16be').decode(d);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(d); } catch { return new TextDecoder('windows-1252').decode(d); }
}
// Just the words of an RTF file, as Google Docs and Word write them: font tables and the like aren't words.
const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'themedata', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl']);
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

/* ---------------- why a file won't open, and what to do next ---------------- */
// Neither sentence names the file or the student, so both are safe to show during anonymous grading.
const dropIt = 'drop the new file on their name';
const askAgain = 'Ask the student to turn it in again, as a PDF or Word file.', askLow = 'ask the student to turn it in again, as a PDF or Word file.';
function picNext() { return (isMac() ? 'Open it in Preview, choose File, then Export, and save it as a JPEG. Then ' : 'Open it in the Photos app and save a copy as a JPG. Then ') + dropIt + '. Or ask the student for a JPG or PDF.'; }
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
function wordBad(f) {
  if (f.wordFor === f.data) return f.wordIs;
  const real = realType(f.data);
  let bad = real === 'ole' ? 'locked' : real === 'html' ? 'page' : '';
  if (!bad) { try { if (!fflate.unzipSync(f.data, { filter: x => x.name === 'word/document.xml' })['word/document.xml']) bad = 'damaged'; } catch { bad = 'damaged'; } }
  f.wordFor = f.data; f.wordIs = bad;
  return bad;
}
const WEB_PAGE = { why: 'The name says it’s a paper, but inside it’s a web page, often a sign-in page saved by mistake.', next: askAgain };
// Plain words for a file that won't open: { why, next }, or null when it's fine.
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
const troubleText = tr => tr ? tr.why + ' ' + tr.next : '';
function pdfBad(f, e) {
  const locked = !!e && (e.name === 'PasswordException' || /password/i.test(e.message || ''));
  f.badIs = locked ? 'locked' : 'damaged'; f.bad = locked ? 'it’s password-protected' : 'it couldn’t be opened';
}
// A recording: says so right on its card when it won't play, or plays only as sound.
function mediaWatch(el, m, f) {
  const say = t => { const p = el.querySelector('.trstat'); if (p) p.textContent = t; };
  m.onerror = () => {
    f.noPlay = true; say(troubleText(troubleOf(f)));
    if (el.querySelector('[data-mdl]')) return;
    el.querySelector('.mctl').insertAdjacentHTML('afterbegin', '<button class="btn sm" data-mdl>Download</button>');
    el.querySelector('[data-mdl]').onclick = () => saveBlob(f.name, new Blob([f.data]));
  };
  m.onloadedmetadata = () => { if (VIDEO_RX.test(f.name) && !m.videoWidth) { f.noPicture = true; say(NO_PICTURE); } };
}
const NO_PICTURE = 'Only the sound of this video plays in this browser. A video from an iPhone may need its picture opened on your computer: download it, or ask the student for an .mp4.';
const mediaProbe = f => new Promise(res => {
  const m = document.createElement(VIDEO_RX.test(f.name) ? 'video' : 'audio');
  const done = () => { clearTimeout(t); m.removeAttribute('src'); m.load(); res(); }, t = setTimeout(done, 6000);
  m.preload = 'metadata';
  m.onerror = () => { f.noPlay = true; done(); };
  m.onloadedmetadata = () => { if (VIDEO_RX.test(f.name) && !m.videoWidth) f.noPicture = true; done(); };
  m.src = mediaUrl(f);
});
// Tries one file, once: a PDF's every page, a recording's first bytes. Word files and the rest can be told without this. Whoever asks while it's going waits for the same answer.
function checkFile(f) { return f.virtual || !f.size ? Promise.resolve() : (f.checked ||= checkFileNow(f)); }
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
async function checkStack(b) {
  for (const st of b.students) {
    for (const f of [...st.files]) {
      if (batch !== b) return;
      await checkFile(f);
    }
  }
}

/* ---------------- the opening report: one summary of what opened, what didn't, who has nothing, and anything odd ---------------- */
// Everything goes by shownName, and no file name or error text goes in during anonymous grading.
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
function repHead(x) {
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
  return (x.total ? x.ok + ' of ' + n(x.total, 'file', 'files') + ' opened.' : '') + (x.cant.length || x.zip ? ' ' + (x.cant.length + (x.zip ? x.zip.n : 0)) + ' couldn’t.' : '') +
    (x.nothing.length ? ' ' + n(x.nothing.length, 'student has', 'students have') + ' nothing turned in.' : '') + (x.odd.length ? ' ' + n(x.odd.length, 'thing looks', 'things look') + ' odd.' : '');
}
function repHtml(x) {
  const go = o => '<button class="link" data-repgo="' + o.i + '"' + (o.file ? ' data-file="' + esc(o.file) + '"' : '') + '>' + esc(o.name) + '</button>';
  const sect = (title, n, body) => '<details data-group="' + esc(title) + '" open><summary>' + esc(title) + ' (' + n + ')</summary>' + body + '</details>';
  const whys = [...new Set(x.cant.map(o => o.why))];
  const cant = whys.map(w => { const of = x.cant.filter(o => o.why === w); return '<p style="margin:8px 0 2px">' + esc(w) + ' ' + esc(of[0].next) + '</p><ul>' + of.map(o => '<li>' + go(o) + (o.shown ? ' <span class="muted" style="overflow-wrap:anywhere">' + esc(o.shown) + '</span>' : '') + '</li>').join('') + '</ul>'; }).join('');
  const zip = x.zip ? '<p style="margin:8px 0 2px">' + esc(zipSay(x.zip)) + '</p>' : '';
  const good = !x.cant.length && !x.zip && !x.nothing.length && !x.odd.length;
  return '<div class="bh"><h2>What opened</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="openRepBox">' +
    '<div class="xchk' + (good ? ' ok' : '') + '" style="margin-bottom:0">' + (good ? (x.total ? 'Everything opened: ' + x.total + (x.total === 1 ? ' file' : ' files') + ' for ' + x.nStu + (x.nStu === 1 ? ' student' : ' students') + '. Nothing looks odd.' : 'No files here yet.') : esc(repHead(x)) + ' Click a name to go there.') +
    (x.cant.length || x.zip ? sect('Couldn’t open', x.cant.length + (x.zip ? x.zip.n : 0), zip + cant) : '') +
    (x.nothing.length ? sect('Nothing turned in', x.nothing.length, '<ul>' + x.nothing.map(o => '<li>' + go(o) + '</li>').join('') + '</ul><p class="muted" style="margin:6px 0 0;font-size:13px">When their work comes in, use Bring in files under More, or drop it on their name.</p>') : '') +
    (x.odd.length ? sect('Looks odd', x.odd.length, '<ul>' + x.odd.map(o => '<li>' + go(o) + ' ' + esc(o.note) + '</li>').join('') + '</ul>') : '') +
    '</div></div><div class="bf"><button class="btn primary" data-close>OK</button></div>';
}
function zipSay(z) {
  const how = isMac() ? 'Double-click it in Finder to unzip it' : 'Right-click it, choose Extract All';
  return (z.names ? (anonOn() ? 'A ZIP' : z.names.join(', ')) + (z.names.length === 1 ? ' couldn’t be opened. It may be damaged or still downloading. ' : ' couldn’t be opened. ') : z.skip + (z.skip === 1 ? ' file in the ZIP is' : ' files in the ZIP are') + ' packed in a way a browser can’t open. ') + how + ', then choose the folder.';
}
async function openRep() {
  const wait = waitDlg('What opened', 'Checking the files…');
  await checkStack(batch);
  if (!wait.isConnected) return;   // she closed it while it checked
  const x = openingFacts();
  openDlg(repHtml(x), true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const g = e.target.closest('[data-repgo]'); if (!g) return;
    toPaper(+g.dataset.repgo, g.dataset.file);
  };
}
// Runs by itself after a download opens, and says something only if there's something new to say. What she's seen is kept as hashes, so no file names stay behind if she forgets the download.
let repAt = 0, repAll = false;   // the student she was on when the bar came up, and whether every file opened: then going to another student counts as having seen it
let repSaw = null;   // reading the report by way of More counts as seeing it, the same as the bar's own buttons
async function openingReport() {
  repSaw = null;
  const b = batch, bar = $('#openRep'), show = on => { bar.hidden = !on; bar.style.display = on ? 'flex' : ''; };
  show(false);
  try { await checkStack(b); } catch (e) { console.error(e); return; }
  if (batch !== b) return;
  const x = openingFacts(), keys = x.keys.concat(x.zip ? ['zip'] : []).map(hash), seen = store.get('gs.openSeen', {})[b.id] || [];
  if (!keys.some(k => !seen.includes(k))) return;
  const saw = () => { const all = store.get('gs.openSeen', {}); all[b.id] = [...new Set(seen.concat(keys))]; store.set('gs.openSeen', all); show(false); repSaw = null; };
  bar.innerHTML = '<span style="flex:1">' + esc(repHead(x)) + '</span><button class="btn sm" data-rep>See the list</button><button class="icon" data-repx aria-label="Close this message" title="Close this message">✕</button>';
  show(true);
  repSaw = saw; repAt = cur; repAll = !x.cant.length && !x.zip;
  bar.querySelector('[data-rep]').onclick = () => { saw(); openRep(); };
  bar.querySelector('[data-repx]').onclick = saw;
}
$('#openRepBtn').onclick = () => { if (repSaw) repSaw(); openRep(); };

/* ---------------- late work ---------------- */
// Marked late only when she asks: a tick when bringing files in, a link on the file, or the box after a newer download.
function markLate(st) { if (st.grade.status !== 'late') setStatus(st, 'late'); }
const lateLink = f => { const st = batch && batch.students[cur]; return st && st.files.includes(f) && st.grade.status !== 'late' ? '<button class="link" style="font-size:13px;margin-left:8px" data-marklate title="Marks this student late. Nothing is taken off.">Mark late</button>' : ''; };
$('#paper').addEventListener('click', e => {
  if (!e.target.closest('[data-marklate]')) return;
  markLate(batch.students[cur]);
  for (const b of $('#paper').querySelectorAll('[data-marklate]')) b.remove();
  toast('Marked late. Mark as, on the right, takes it off.');
});
// A whole new download can go through Bring in files: what's already here is left out, so only the late papers are left to place.
async function freshRows(rows) {
  const here = batch.students.flatMap(st => st.files.filter(f => f.kind !== 'img' && !f.virtual && f.data).map(f => ({ path: f.path, data: f.data })));
  try { const rec = await paperGet(batch.id); if (rec && rec.entries) here.push(...rec.entries.filter(e => e.data)); } catch {}
  try { here.push(...((await idbDo('readonly', o => o.getAll(underId(batch.id)))) || []).filter(r => r.bid === batch.id && r.key !== REF_KEY && r.data)); } catch {}
  const sizes = new Set(here.map(x => x.data.length)), fresh = [];
  let dups = 0;
  for (const r of rows) {
    let same = false;
    if (sizes.has(r.e.file.size)) {
      const bytes = new Uint8Array(await r.e.file.arrayBuffer());
      same = here.some(x => sameBytes(x.data, bytes) && (r.i < 0 || !batch.students[r.i] || batch.students[r.i].files.some(f => nfc(f.path) === nfc(x.path))));
    }
    if (same) dups++; else fresh.push(r);
  }
  return { fresh, dups };
}
// What she should know beside a file before adding it.
function rowNote(r) {
  const st = r.i >= 0 ? batch.students[r.i] : null; if (!st) return r.newKey ? '<div class="muted" style="font-size:13px">New: ' + esc(r.newKey) + '</div>' : '';
  const name = nfc(r.e.file.name), out = [];
  if (st.files.some(f => !f.virtual && nfc(f.name) === name)) out.push('They have a different file with this name. Both stay.');
  if (st.grade.status === 'missing' || st.grade.status === 'excused') out.push('Now marked ' + st.grade.status + '.');
  return out.length ? '<div class="muted" style="font-size:13px">' + out.join(' ') + '</div>' : '';
}
const guessNewName = path => { const p = path.split('/').filter(Boolean); return (p.length > 2 ? p[p.length - 2] : p.length > 1 ? p[0] : p[0].replace(/\.[^.]+$/, '')).trim(); };
// After Bring in files: the count, who's now late, and plain words for anything that came in but won't open.
async function bringInDone(sts, t0, nLate) {
  const added = sts.flatMap(st => st.files.filter(f => f.added >= t0).map(f => ({ st, f })));
  for (const a of added) await checkFile(a.f);
  toast('Added ' + added.length + (added.length === 1 ? ' file' : ' files') + ' to ' + sts.length + (sts.length === 1 ? ' student' : ' students') + (nLate ? '. ' + nLate + ' marked late.' : ''));
  const bad = added.map(a => ({ ...a, tr: troubleOf(a.f) })).filter(a => a.tr);
  if (bad.length) sayDlg((bad.length === 1 ? 'One file came in but can’t be opened here.' : bad.length + ' files came in but can’t be opened here.') + '\n\n' + bad.map(a => (anonOn() ? shownName(a.st, batch.students.indexOf(a.st)) : a.f.name) + ': ' + troubleText(a.tr)).join('\n\n'));
}
// The box after a newer download offers to mark whoever has new files late. It only offers.
const carryLateList = () => batch.carry ? batch.students.filter(st => st.grade.status !== 'late' && st.grade.status !== 'excused' && st.files.some(f => batch.carry.flags[f.path] === 'new')) : [];
function carryLateBtn() { const n = carryLateList().length; return n ? '<button class="btn" data-carrylate style="margin-right:auto" title="Marks them late. Nothing is taken off.">Mark ' + n + (n === 1 ? ' student' : ' students') + ' with new files late</button>' : ''; }
function carryLateDo(b) { const n = carryLateList(); n.forEach(markLate); b.remove(); toast('Marked ' + n.length + (n.length === 1 ? ' student' : ' students') + ' late'); }

Object.assign(window.__gs, { realType, jpegTurn, textOf, rtfText, troubleOf, checkFile, checkStack, openingFacts, openingReport, openRep, markLate, makeFile });
