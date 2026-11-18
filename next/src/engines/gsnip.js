// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, pdfjsLib, toast, store } from './gcore.js';
import { measureCtx, drawMarks, vpRot, skewOf, skewXf, vpDraw, scrubMarks, nameFold, anonRx, lightForPage, lightCanvas, SORT_STOP, AT_START, ID_RX, latinRx, isLatin, anyRx, rawWords, wordOk, bounded, alt, runAlts, latinParts, initialAlts, altsRx, namesNow, ownNames, one, marksMine, AT_END, FILE_SEP } from './gdraw.js';

// src/app/paper.js
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// src/app/export.js
const downloadsP = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
// src/app/export.js
async function saveBlob(name, blob) {
  name = name.replace(/[\\/:*?"<>|]+/g, '-');
  const dl = await downloadsP;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return; }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('One moment, then try again'); return; } }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
// src/app/gradesheet.js
const annText = (a, lines) => {   // lines: keep its line breaks, for reading a grade
  const sq = t => lines ? String(t || '').replace(/\r\n?/g, '\n').trim() : String(t || '').replace(/\s+/g, ' ').trim();
  const c = sq((a.contentsObj && a.contentsObj.str) || a.contents) || sq(a.richText && a.richText.str), t = sq(Array.isArray(a.textContent) ? a.textContent.join(' ') : '');
  return !t || t === c ? c : !c ? t : c + ' ' + t;
};
// src/app/gradesheet.js
const SKIP_TYPES = new Set(['Link', 'Popup', 'Widget']);
// src/app/claude.js
const CODE_ABC = 'ACDEFGHJKMNPQRTUVWXY34679';
// src/app/claude.js
function shareState() {
  if (!batch.share) batch.share = { codes: {}, boxes: {} };
  const sh = batch.share, used = new Set([...Object.values(sh.codes), ...Object.keys(sh.also || {})]);
  for (const st of batch.students) if (!sh.codes[st.key]) {
    let c; do { c = 'S-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (used.has(c));
    used.add(c); sh.codes[st.key] = c;
  }
  return sh;
}
// src/app/claude.js
const RIGHT_TO_LEFT = /[\p{Script=Arabic}\p{Script=Hebrew}]/u, RTL_STRETCH = /[\p{Script=Arabic}\p{Script=Hebrew}](?:[^\p{L}\p{N}]*[\p{Script=Arabic}\p{Script=Hebrew}])*/gu;
// src/app/claude.js
function acrossItem(it, a, b, x, W) {
  if (!RIGHT_TO_LEFT.test(it.str)) return [x(a), x(b)];
  const back = it.dir === 'rtl', sides = [];
  const stretch = (s, e, rtl) => {
    if (Math.max(a, s) >= Math.min(b, e)) return;
    for (const k of [Math.max(a, s), Math.min(b, e)]) { const along = rtl === back ? x(k) : x(s) + x(e) - x(k); sides.push(back ? W - along : along); }
  };
  let at = 0;
  for (const m of it.str.matchAll(RTL_STRETCH)) { stretch(at, m.index, false); stretch(m.index, m.index + m[0].length, true); at = m.index + m[0].length; }
  stretch(at, it.str.length, false);
  return [Math.min(...sides), Math.max(...sides)];
}
// src/app/claude.js
const textWidth = (s, font) => { measureCtx.font = '100px ' + font; return measureCtx.measureText(s).width; };
// src/app/claude.js
const NAME_SIGN = /(?<![\p{L}\p{N}])(?:(?:student|full|first|last|family|your|given)[’']?s?\s+)?(?:name|nom|nombre)(?:\s*\(s\))?\s*(?:[:：]|_{2,}|\.{3,})|(?:姓名|名字|名前|이름|ชื่อ)\s*[:：_]/giu;
// src/app/claude.js
const NEXT_SIGN = /(?<![\p{L}\p{N}])(?:date|class|period|block|teacher|grade|section|subject|form|homeroom|due|score|mark|total|id|number|no\.|group|level|日期|班级|班級|学号|날짜|반)\s*[:：]/iu;
// src/app/claude.js
function labelCovers(items, cover) {
  const out = [], lines = [];
  // Items on one line: the same way up, and their baselines within half a letter of each other.
  for (const it of items) {
    const t = it.transform, fh = Math.hypot(t[2], t[3]) || 10, len = Math.hypot(t[0], t[1]) || 1, ux = t[0] / len, uy = t[1] / len;
    const off = -t[4] * uy + t[5] * ux, along = t[4] * ux + t[5] * uy;
    let ln = lines.find(l => Math.abs(l.ux - ux) < .05 && Math.abs(l.uy - uy) < .05 && Math.abs(l.off - off) < fh * .5);
    if (!ln) lines.push(ln = { ux, uy, off, list: [] });
    ln.list.push({ it, along });
  }
  for (const ln of lines) {
    const row = ln.list.sort((a, b) => a.along - b.along).map(x => x.it);
    let text = ''; const from = [];
    for (const it of row) { if (text) { text += '  '; from.push(null, null); } for (let i = 0; i < it.str.length; i++) { text += it.str[i]; from.push([it, i]); } }
    NAME_SIGN.lastIndex = 0;
    for (let m; (m = NAME_SIGN.exec(text));) {
      let s = m.index + m[0].length - (/[_.]$/.test(m[0]) ? (m[0].match(/[_.]+$/) || [''])[0].length : 0);
      const rest = text.slice(s), stop = rest.search(NEXT_SIGN), next = rest.slice(1).search(NAME_SIGN);
      let e = s + Math.min(...[stop, next < 0 ? -1 : next + 1, rest.length].filter(v => v >= 0));
      while (s < e && /\s/.test(text[s])) s++;
      while (e > s && /\s/.test(text[e - 1])) e--;
      const said = text.slice(s, e), blank = /^[\s_.\-–—]*$/.test(said);
      if (s >= e || (!blank && (rawWords(said).length > 5 || said.length > 60))) continue;
      const piece = new Map();
      for (let k = s; k < e; k++) { const f = from[k]; if (!f) continue; const p = piece.get(f[0]); piece.set(f[0], p ? [p[0], f[1] + 1] : [f[1], f[1] + 1]); }
      for (const [it, [a, b]] of piece) { cover(it, a, b - a, blank || /_{2,}/.test(it.str.slice(a, b))); out.push([it, a, b]); }
    }
  }
  return out;
}
// src/app/claude.js
async function autoCovers(page, vp, rx, xf, opts) {
  const out = [];
  if (!rx || !nameFindOn()) return out;
  const tc = await page.getTextContent();
  const cover = (it, from, n, tall) => {
    const tx = pdfjsLib.Util.transform(vp.transform, it.transform), fh = Math.hypot(tx[2], tx[3]) || 10, run = Math.hypot(tx[0], tx[1]) || 1;
    const W = it.width * vp.scale, L = it.str.length || 1, at = (a, b) => [tx[4] + tx[0] / run * a + tx[2] / fh * b, tx[5] + tx[1] / run * a + tx[3] / fh * b];
    // Letters aren't all as wide, so where a word sits is its share of the measured line, not a count of letters.
    const font = ((tc.styles || {})[it.fontName] || {}).fontFamily || 'sans-serif', whole = textWidth(it.str, font), x = k => whole ? W * textWidth(it.str.slice(0, k), font) / whole : W * k / L;
    const pad = W / L + 2, [left, right] = acrossItem(it, from, from + n, x, W), a0 = left - pad, a1 = right + pad, up = fh * (tall ? 2.4 : 1.05) + 2, dn = -fh * (tall ? .7 : .4) - 2;
    out.push(coverRound([at(a0, up), at(a1, up), at(a1, dn), at(a0, dn)], xf));
  };
  const hits = text => { const list = []; rx.lastIndex = 0; let m; while ((m = rx.exec(text))) { if (m[0].length) list.push([m.index, m[0].length]); else rx.lastIndex++; } return list; };
  const items = tc.items.filter(it => it.str), done = new Map();
  const signed = opts ? labelCovers(items, cover) : [];
  // Whether a hit counts as a name here. Without opts, every hit does.
  const keep = (t, it, a) => {
    if (!opts || signed.some(([i, s, e]) => i === it && a >= s && a < e) || /[@\d]/.test(t) || rawWords(t).length > 1) return true;
    const w = nameFold(t), own = opts.own.has(w), small = isLatin(t) && t === t.toLowerCase();
    if (small && !own && opts.parts.has(w)) return false;
    return !opts.common.has(w) || (own && !small);
  };
  // Reads these items as one text and covers each name where it sits, piece by piece. A letter stored in a special form, like ⼩ for 小 or a shaped Arabic letter, is read as the plain one.
  const coverIn = list => {
    let text = ''; const from = [];
    for (const it of list) { let i = 0; for (const c of it.str) { const plain = thaiPlain(c).normalize('NFKC'); text += plain; for (let k = 0; k < plain.length; k++) from.push([it, i, i + c.length]); i += c.length; } }
    for (const [start, len] of hits(text)) {
      if (!keep(text.slice(start, start + len), from[start][0], from[start][1])) continue;
      const piece = new Map();
      for (const [it, a, b] of from.slice(start, start + len)) { const p = piece.get(it); piece.set(it, p ? [Math.min(p[0], a), Math.max(p[1], b)] : [a, b]); }
      for (const [it, [a, b]] of piece) { const seen = done.get(it) || new Set(), key = a + '-' + b; done.set(it, seen); if (!seen.has(key)) { seen.add(key); cover(it, a, b - a); } }
    }
  };
  for (const it of items) coverIn([it]);
  // A name can come in pieces on one line, as when a letter like ễ comes from another font: read neighbours together.
  const nextTo = (a, b) => {
    const [p, q] = [a.transform, b.transform], fh = Math.hypot(p[2], p[3]) || 10, len = Math.hypot(p[0], p[1]) || 1, ux = p[0] / len, uy = p[1] / len;
    if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > fh * .5) return false;
    const dx = q[4] - p[4], dy = q[5] - p[5], along = dx * ux + dy * uy, off = -dx * uy + dy * ux;
    return Math.abs(off) < fh * .3 && Math.abs(along - a.width) < fh * .25;
  };
  for (let i = 0; i < items.length;) {
    let j = i + 1; while (j < items.length && nextTo(items[j - 1], items[j])) j++;
    if (j - i > 1) {
      const run = items.slice(i, j);
      coverIn(run);
      // Arabic and Hebrew letters can come one by one in the order they sit on the line, which is backwards.
      if (run.some(it => RIGHT_TO_LEFT.test(it.str))) coverIn([...run].reverse());
    }
    i = j;
  }
  for (const a of await page.getAnnotations()) {
    rx.lastIndex = 0;
    // A form box is drawn on the page with what's typed in it, so a name there counts too.
    const says = a.subtype === 'Widget' ? [a.fieldValue].flat().filter(v => typeof v === 'string').join(' ') : SKIP_TYPES.has(a.subtype) ? '' : annText(a) || '';
    if (rx.test(says)) {
      const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
      const L = Math.min(x1, x2) - 2, T = Math.min(y1, y2) - 2, R = Math.max(x1, x2) + 2, B = Math.max(y1, y2) + 2;
      out.push(coverRound([[L, T], [R, T], [R, B], [L, B]], xf));
    }
  }
  return out;
}
// src/app/claude.js
const boxKey = (path, p) => path + '|' + p;
// src/app/claude.js
function ownCovers(path, p, W, H) { return (shareState().boxes[boxKey(path, p)] || []).map(b => ({ x: b[0] * W, y: b[1] * H, w: b[2] * W, h: b[3] * H, own: true })); }
// src/app/claude.js
const offList = (path, p) => (shareState().off ||= {})[boxKey(path, p)] || [];
// src/app/claude.js
const sameSpot = (r, b, W, H) => {
  const x0 = Math.max(r.x, b[0] * W), y0 = Math.max(r.y, b[1] * H), x1 = Math.min(r.x + r.w, (b[0] + b[2]) * W), y1 = Math.min(r.y + r.h, (b[1] + b[3]) * H);
  const both = Math.max(0, x1 - x0) * Math.max(0, y1 - y0), a = r.w * r.h, c = b[2] * W * b[3] * H;
  return both > 0 && both / (a + c - both) >= 0.5;
};
// src/app/claude.js
function keptCovers(cs, path, p, W, H) {
  const off = offList(path, p), gone = [];
  if (!off.length) return Object.assign(cs, { gone });
  const kept = cs.filter(r => { const out = off.some(b => sameSpot(r, b, W, H)); if (out) gone.push(r); return !out; });
  return Object.assign(kept, { gone });
}
// src/app/anon.js
async function anonCovers(st, pg) {
  try { const vp = vpRot(pg.file, pg.idx, pg.page, 1); return keptCovers(await autoCovers(pg.page, vp, anonRx(st), skewXf(pg.file, pg.idx, vp)), pg.file.path, pg.idx, pg.W, pg.H).concat(ownCovers(pg.file.path, pg.idx, pg.W, pg.H)); }
  catch { return ownCovers(pg.file.path, pg.idx, pg.W, pg.H); }
}
// src/names.js
const THAI_PUA = '\u0E10\u0E34\u0E35\u0E36\u0E37\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E0D\u0E31\u0E4D\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E38\u0E39\u0E3A';
// src/names.js
const thaiPlain = s => /[\uF700-\uF71A]/.test(s) ? s.replace(/[\uF700-\uF71A]/g, c => THAI_PUA[c.charCodeAt(0) - 0xF700]) : s;
// src/names.js
function fileAlts(parts) {
  const out = [], L = latinParts(parts);
  for (const p of parts) if (wordOk(p)) {
    const w = nameFold(p), latin = isLatin(p);
    out.push(alt(w.length, latin && w.length >= 3 && !SORT_STOP.has(w) ? anyRx(p) : bounded(p, anyRx(p))));
    if (latin && w.length < 3) out.push(alt(w.length, '(?<!\\p{Lu})' + latinRx(w, true) + '(?!\\p{Ll})'));   // MyEssay, EssayMy
  }
  for (const a of L) for (const b of L) if (a !== b && nameFold(b).length >= 2) out.push(alt(nameFold(b).length + 2, AT_START + latinRx(nameFold(b)) + FILE_SEP + latinRx(nameFold(a)[0]) + AT_END));
  if (L.length >= 2) out.push(alt(2, AT_START + L.map(p => latinRx(nameFold(p)[0])).join('') + AT_END));
  return out;
}
// src/names.js
function fileRx(st) {
  const N = namesNow(); let rx = N.file.get(st.key);
  if (!rx) N.file.set(st.key, rx = new RegExp([ID_RX, altsRx(ownNames(st).map(p => [...runAlts(p), ...initialAlts(p), ...fileAlts(p)])), N.classSrc].filter(Boolean).join('|'), 'gu'));
  return rx;
}
// src/names.js
const nameFindOn = () => !!store.get('gs.nameFind', false);
// src/scans.js
function coverRound(pts, xf) {
  const q = xf ? pts.map(p => pdfjsLib.Util.applyTransform(p, xf)) : pts, xs = q.map(p => p[0]), ys = q.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
// src/scans.js
function scanClip(ctx, f, p, w, cw, ch) { if (skewOf(f, p) && cw > w) { ctx.fillStyle = '#fff'; ctx.fillRect(w, 0, cw - w, ch); } }
// src/snip.js
async function copyPicture(blobP, name) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') throw new Error('no clipboard');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
    return 'copied';
  } catch (e) { /* saved as a file below */ }
  let blob = null;
  try { blob = await blobP; } catch { return 'none'; }
  if (!blob) return 'none';
  await saveBlob(name, blob);
  return 'saved';
}
// src/snip.js
const canvasPng = c => new Promise((res, rej) => c.toBlob(b => { c.width = c.height = 0; b ? res(b) : rej(new Error('no picture')); }, 'image/png'));
// src/snip.js
const snipRect = (a, e) => {
  const x = clamp(Math.min(a.x, e.clientX), 0, innerWidth), y = clamp(Math.min(a.y, e.clientY), 0, innerHeight);
  return { x, y, w: clamp(Math.max(a.x, e.clientX), 0, innerWidth) - x, h: clamp(Math.max(a.y, e.clientY), 0, innerHeight) - y };
};
// src/snip.js
async function snipPage(pg, k, marks) {
  const st = batch.students[cur], f = pg.file, p = pg.idx, page = pg.page, W = pg.W, H = pg.H, side = pg.side, rx = anonRx(st);
  const c = document.createElement('canvas'); c.width = Math.ceil((W + side) * k); c.height = Math.ceil(H * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#F6F7F9'; ctx.fillRect(Math.round(W * k), 0, c.width, c.height);
  await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const L = lightForPage(st, f, p); if (L) lightCanvas(ctx, Math.ceil(W * k), c.height, L);
  scanClip(ctx, f, p, W * k, Math.ceil(W * k), c.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (marks) drawMarks(ctx, scrubMarks(marksMine(pg.marks(), pg.file).concat(pg.extra || []), rx), W, H, side, null);
  ctx.fillStyle = '#111';
  for (const r of await anonCovers(st, pg)) ctx.fillRect(r.x, r.y, r.w, r.h);   // after the marks, so a mark can't show a name either
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}
export { snipPage, snipRect, copyPicture, canvasPng, nameFindOn, fileRx };
