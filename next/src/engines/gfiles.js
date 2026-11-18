// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, lib, selected, pages, undoStack, redoStack, once, saveSoon, pdfjsLib, PDFLib, workerReady, renderList, renderTools, renderPage, rescanFile, scanNote, lightPagesChanged, activeEditor, store, idbDo, groupBandRefresh, ownGrade, fmtNum, COLORS, HL, set } from './gcore.js';
import { sideScreen, textLayout, rotOf, vpRot, skewOf, skewXf, viewable, draw, madeFromWord, scrub, nameFold, rosterMatch, anonOn, lightFor, lightOn, lightOpts, setPageLit, lightAuto, SORT_STOP, AT_START, ID_RX, latinRx, isLatin, anyRx, wordOk, bounded, alt, runAlts, latinParts, initialAlts, altsRx, namesNow, ownNames, one, AT_END, FILE_SEP } from './gdraw.js';
import { moveFileNow, setRot, setSkew, boxKey, REF_KEY, underId, paperGet, goneNow, hasSheet, gradeHasWork, nfc, sameBytes, pv } from './gopen.js';

// src/app/draw.js
function keepOnPage(m, W, H) {
  if (m.bw) {
    const want = m.bwFull || m.bw, one = textLayout({ ...m, x: 0, bw: want }, 1e6), need = one.lines.length === 1 ? Math.min(m.bw, Math.ceil(one.ink) + 1) : m.bw;
    m.x = r1(clamp(m.x, 0, Math.max(0, W - need - 6)));
    m.bw = r1(Math.min(want, W - m.x - 6));
    if (m.bw < want) m.bwFull = want; else delete m.bwFull;
  } else { delete m.bwFull; m.x = r1(clamp(m.x, 0, W - 30)); }
  m.y = r1(clamp(m.y, 0, Math.max(0, H - textLayout(m, W).h - 2)));
}
// src/app/files.js
const thumbCache = new Map();
// src/app/files.js
function setDocIn(st, d, on) {
  if (st.layout) { const t = st.layout.find(x => x === d || (x.name === d.name && JSON.stringify(x.pages) === JSON.stringify(d.pages))); if (t) t.out = !on; }
  else { st.inc = st.inc || {}; st.inc[d.file] = on; }
  saveSoon();
}
// src/app/paper.js
const stepOf = (file, idx, withRot) => ({ file, idx, before: JSON.stringify(file.marks[idx] || []), rot: withRot ? rotOf(file, idx) : undefined, skew: withRot ? skewOf(file, idx) : 0, cov: withRot ? coverCopy(file, idx) : undefined });
// src/app/paper.js
function pushUndo(u) { if (stepping) return; undoStack.push(u); if (undoStack.length > 200) undoStack.shift(); set.redoStack([]); renderTools(); }
// src/app/paper.js
let stepping = false;   // while a step is being undone or redone, what it calls doesn't add steps of its own
// src/app/paper.js
function turnMarks(marks, W, H, dir) {
  const pt = ([x, y]) => dir > 0 ? [r1(H - y), r1(x)] : [r1(y), r1(W - x)];
  const box = b => { const [ax, ay] = pt([b.x, b.y]), [bx, by] = pt([b.x + b.w, b.y + b.h]); return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) }; };
  for (const m of marks) {
    if (m.t === 'pen') m.pts = m.pts.map(q => keepP(pt(q), q));
    else if (m.t === 'hl' || m.t === 'oval') { Object.assign(m, box(m)); if (m.rects) m.rects = m.rects.map(box); if (m.pts) m.pts = m.pts.map(pt); }
    else if (m.t === 'check' || m.t === 'stamp') [m.x, m.y] = pt([m.x, m.y]);
    else if (m.t === 'note') { delete m.ly; [m.ax, m.ay] = pt([m.ax, m.ay]); if (m.hl) m.hl = box(m.hl); if (m.rects) m.rects = m.rects.map(box); }
    else if (m.t === 'text') {
      const L = textLayout(m, W), [cx, cy] = pt([m.x + L.ink / 2, m.y + L.h / 2]);   // turns about the words, not the empty part of a wide box
      const want = m.bwFull || m.bw;
      if (m.bw) m.bw = Math.min(want, H - 12);
      const L2 = textLayout({ ...m, x: 0 }, H);
      m.x = r1(cx - L2.ink / 2); m.y = r1(cy - L2.h / 2);
      if (m.bw) { m.bw = Math.min(m.bw, Math.max(Math.ceil(L2.ink) + 1, 24, H - m.x - 6)); if (m.bw < want) m.bwFull = want; else delete m.bwFull; }   // near the edge a box gives up its empty part, so the words needn't move
      keepOnPage(m, H, W);
    }
  }
}
// src/app/paper.js
function reshape(pg) {
  const vp = vpRot(pg.file, pg.idx, pg.page, 1);
  pg.W = vp.width; pg.H = vp.height; pg.side = sideScreen(vp.width); pg.covers = null; pg.adj = null; pg.extra = [];
  renderPage(pg); scanNote(pg);
}
// src/app/paper.js
const r1 = v => Math.round(v * 10) / 10;
// src/app/paper.js
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// src/app/paper.js
function commitEditors() { if (activeEditor) { const a = activeEditor; set.activeEditor(null); a.commit(); } }
// src/app/gradesheet.js
const commentText = a => ((a.contentsObj && a.contentsObj.str) || a.contents || '').replace(/\r\n?/g, '\n').trim();
// src/app/gradesheet.js
let scanned = false;
// src/app/library.js
let fresh = store.get('gs.lib', null) == null;   // a browser nobody has used yet: it gets the welcome, and nothing of anyone's
// src/app/replace.js
const markCount = f => Object.values(f.marks || {}).reduce((n, a) => n + a.length, 0);
// src/app/replace.js
const replacedOf = f => { const st = batch && batch.students[cur]; if (!st || !batch.removed) return null; const p = Object.keys(batch.removed).find(k => batch.removed[k].by === f.path && !batch.removed[k].back); return p ? ((st.gone || []).find(g => g.path === p) || { name: p.slice(p.lastIndexOf('/') + 1) }) : null; };
// src/app/replace.js
function outPages(st) {
  if (!st.layout) return [];
  const has = new Set(st.layout.flatMap(d => d.pages.map(([q, p]) => q + '|' + p))), out = [];
  for (const f of st.files) if (viewable(f) && f.numPages) for (let p = 0; p < f.numPages; p++) if (!has.has(f.path + '|' + p)) out.push([f.path, p]);
  return out;
}
// src/app/scansplit.js
function splitIntoNames(c) {
  const r = c ? c.names.slice() : [], m = rosterMatch(r), used = new Set(m.values());
  return r.concat(batch.students.filter(st => !used.has(st)).map(st => st.key));
}
// src/app/scansplit.js
function splitInk(ctx, w, h) {
  const m = Math.round(w * .06), d = ctx.getImageData(m, m, w - 2 * m, h - 2 * m).data; let dark = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] < 400) dark++;
  return dark / (d.length / 16);
}
// src/app/scansplit.js
const spWho = (me, i) => me.owner[i] ? [me.owner[i], ...(me.more[i] || [])] : [];
// src/app/scansplit.js
const spAll = me => [...new Set(me.owner.flatMap((_, i) => spWho(me, i)))];
// src/app/scansplit.js
function spRange(list) {
  const out = []; let a = null, b = null;
  for (const p of list) { if (a != null && p === b + 1) { b = p; continue; } if (a != null) out.push(a === b ? a + 1 : (a + 1) + '–' + (b + 1)); a = b = p; }
  if (a != null) out.push(a === b ? a + 1 : (a + 1) + '–' + (b + 1));
  return out.join(', ');
}
// src/app/bringin.js
const sortTag = r => r.i === -2 ? '<span class="muted">Skipped</span>' : r.i < 0 ? '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Choose</span>'
  : r.set ? '<span class="muted">Chosen by you</span>' : r.sure ? '<span style="color:var(--ok);font-size:13px;font-weight:600">Matched by name</span>' : '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Check</span>';
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
const fileShown = (st, name) => anonOn() && st ? scrub(name, fileRx(st)) : name;
// src/marking.js
const keepP = (n, q) => q.length > 2 ? [n[0], n[1], q[2]] : n;
// src/marking.js
const rectBox = rs => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: r1(Math.max(...rs.map(r => r.x + r.w)) - x), h: r1(Math.max(...rs.map(r => r.y + r.h)) - y) }; };
// src/marking.js
function setRects(m, rects) {
  Object.assign(m, rectBox(rects));
  if (rects.length > 1) m.rects = rects; else delete m.rects;
  return m;
}
// src/grades.js
const STATUS_LABEL = { missing: 'Missing', excused: 'Excused', late: 'Late' };
// src/grades.js
function gradeWords(st) {
  const g = st.grade, own = ownGrade(st).total, out = [];
  if (own != null && !isNaN(own)) out.push('a score of ' + fmtNum(own));
  else if (hasSheet(g)) out.push('a score of ' + g.sheet);
  else if ((g.rubric || []).some(v => v != null) || (g.points != null && g.points !== '')) out.push('a score');
  if (g.comment) out.push('a comment');
  if (g.status) out.push('the status ' + STATUS_LABEL[g.status]);
  return out;
}
// src/grades.js
const wordsJoin = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
// src/intake.js
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
// src/intake.js
const guessNewName = path => { const p = path.split('/').filter(Boolean); return (p.length > 2 ? p[p.length - 2] : p.length > 1 ? p[0] : p[0].replace(/\.[^.]+$/, '')).trim(); };
// src/insight.js
function coverAgain(path, p) { const sh = batch && batch.share; if (sh && sh.checked) delete sh.checked[boxKey(path, p)]; }
// src/insight.js
function coverCopy(f, p) { const sh = batch && batch.share, b = sh && sh.boxes && sh.boxes[boxKey(f.path, p)]; return b ? JSON.stringify(b) : null; }
// src/scans.js
const SCAN_PX = 1000;   // the long side of the picture that's looked at
// src/scans.js
function scanInk(g, w, h) {
  const T = 16, tw = Math.ceil(w / T), th = Math.ceil(h / T), paper = new Float32Array(tw * th);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    let a = 0, n = 0, b = 0, k = 0; const x1 = Math.min(w, (tx + 1) * T), y1 = Math.min(h, (ty + 1) * T);
    for (let y = ty * T; y < y1; y++) for (let x = tx * T, i = y * w + x; x < x1; x++, i++) { a += g[i]; n++; }
    a /= n;
    for (let y = ty * T; y < y1; y++) for (let x = tx * T, i = y * w + x; x < x1; x++, i++) if (g[i] >= a) { b += g[i]; k++; }
    paper[ty * tw + tx] = b / k;
  }
  // The brightest tile nearby, then smoothed: a tile that's all ink doesn't count as dark paper.
  const near = (src, f) => { const o = new Float32Array(tw * th); for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) { let v = 0, n = 0; for (let q = -1; q <= 1; q++) for (let r = -1; r <= 1; r++) { const a = tx + r, b = ty + q; if (a < 0 || b < 0 || a >= tw || b >= th) continue; const s = src[b * tw + a]; if (f === 'max') v = Math.max(v, s); else { v += s; n++; } } o[ty * tw + tx] = f === 'max' ? v : v / n; } return o; };
  const bg = near(near(paper, 'max'), 'avg'), diff = new Uint8Array(w * h), hist = new Uint32Array(256);
  const m = Math.round(.05 * Math.min(w, h));   // scanners leave shadows and holes at the edges
  for (let y = m; y < h - m; y++) for (let x = m, i = y * w + x; x < w - m; x++, i++) { const v = Math.max(0, Math.min(255, Math.round(bg[(y >> 4) * tw + (x >> 4)] - g[i]))); diff[i] = v; hist[v]++; }
  const total = (w - 2 * m) * (h - 2 * m); let c = 0, med = 0; for (; med < 255; med++) { c += hist[med]; if (c >= total / 2) break; }
  const floor = Math.max(13, (med + 1) * 3.2);   // above the speckle
  const keep = (t) => { const out = new Uint8Array(w * h); let n = 0; for (let y = m + 1; y < h - m - 1; y++) for (let x = m + 1, i = y * w + x; x < w - m - 1; x++, i++) { if (diff[i] < t) continue; const e = g[i] + t * .5; if (g[i - 4] < e && g[i + 4] < e && g[i - 4 * w] < e && g[i + 4 * w] < e && !(x < m + 5 || y < m + 5 || x > w - m - 6 || y > h - m - 6)) continue; let k = 0; if (diff[i - 1] >= t) k++; if (diff[i + 1] >= t) k++; if (diff[i - w] >= t) k++; if (diff[i + w] >= t) k++; if (diff[i - w - 1] >= t) k++; if (diff[i - w + 1] >= t) k++; if (diff[i + w - 1] >= t) k++; if (diff[i + w + 1] >= t) k++; if (k >= 2) { out[i] = 1; n++; } } return { mask: out, n }; };
  const first = keep(floor), dh = new Uint32Array(256);
  let solidN = 0; const d6 = floor * 2, far = 6 * w; for (let i = far + 6; i < w * h - far - 6; i++) if (diff[i] >= d6 && diff[i - 6] >= d6 && diff[i + 6] >= d6 && diff[i - far] >= d6 && diff[i + far] >= d6) solidN++;   // too thick to be a pen stroke
  for (let i = 0; i < w * h; i++) if (first.mask[i]) dh[diff[i]]++;
  // How dark the writing is: most of the way down its darkest pixels.
  let contrast = 0, sum = 0; for (let v = 255; v >= 0; v--) { sum += dh[v]; if (sum >= first.n * .1) { contrast = v; break; } }
  const t = Math.max(floor, contrast * .38), { mask, n } = t > floor ? keep(t) : first;
  let pn = 0, pv = 0; for (const v of bg) { pn++; pv += v; }
  return { mask, n, contrast, paper: pv / pn, area: total, margin: m, heavy: solidN / total };
}
// src/scans.js
function scanSharp(xs, ys, n, t, size) {
  const pad = Math.ceil(Math.abs(t) * size) + 2, hist = new Int32Array(size * 2 + 2 * pad);
  for (let i = 0; i < n; i++) hist[(ys[i] + xs[i] * t + pad) | 0]++;
  let e = 0; for (let b = 1; b < hist.length; b++) { const d = hist[b] - hist[b - 1]; e += d * d; }
  return e / (n * n);
}
// src/scans.js
function scanTilt(xs, ys, n, size, lo = -8, hi = 8, fine = false) {
  let best = 0, be = -1; const all = [];
  for (let a = lo; a <= hi + 1e-6; a += .5) { const e = scanSharp(xs, ys, n, Math.tan(a * Math.PI / 180), size); all.push(e); if (e > be) { be = e; best = a; } }
  if (!fine) return { deg: best, e: be, all };
  const mid = best;
  for (let a = mid - .4; a <= mid + .4 + 1e-6; a += .1) { const e = scanSharp(xs, ys, n, Math.tan(a * Math.PI / 180), size); if (e > be) { be = e; best = a; } }
  return { deg: Math.round(best * 10) / 10, e: be, all };
}
// src/scans.js
function scanSolid(u, W, H, least, band = 0) {
  const seen = new Uint8Array(W * H), st = [], near = (x, y, d) => Math.min(x, y, W - 1 - x, H - 1 - y) < d * Math.min(W, H); let all = 0;
  for (let i = 0; i < u.length; i++) {
    if (!u[i] || seen[i]) continue;
    let n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; st.push(i); seen[i] = 1;
    while (st.length) { const a = st.pop(), x = a % W, y = (a - x) / W; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); for (const b of [x > 0 ? a - 1 : -1, x < W - 1 ? a + 1 : -1, a - W, a + W, x > 0 ? a - W - 1 : -1, x < W - 1 ? a - W + 1 : -1, x > 0 ? a + W - 1 : -1, x < W - 1 ? a + W + 1 : -1]) if (b >= 0 && b < u.length && u[b] && !seen[b]) { seen[b] = 1; st.push(b); } }
    const big = Math.max(x1 - x0, y1 - y0) + 1, small = Math.min(x1 - x0, y1 - y0) + 1, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (n >= least && !(big >= 16 && small * 2.5 >= big && near(mx, my, .13)) && !(band && near(mx, my, band))) all += n;
  }
  return all;
}
// src/scans.js
function scanLevel(mask, w, h, deg, q) {   // q: quarter turns to the right
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = w / 2, cy = h / 2, W = q % 2 ? h : w, H = q % 2 ? w : h, u = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0, i = y * w; x < w; x++, i++) {
    if (!mask[i]) continue;
    const dx = x - cx, dy = y - cy, a = dx * c - dy * s, b = dx * s + dy * c;
    let X, Y;
    if (q === 0) { X = a + W / 2; Y = b + H / 2; } else if (q === 1) { X = W / 2 - b; Y = a + H / 2; } else if (q === 2) { X = W / 2 - a; Y = H / 2 - b; } else { X = b + W / 2; Y = H / 2 - a; }
    X = Math.round(X); Y = Math.round(Y);
    if (X >= 0 && Y >= 0 && X < W && Y < H) u[Y * W + X] = 1;
  }
  const longX = W * .2, longY = H * .14, cut = [];
  const runs = (len, wide, at) => { for (let a = 0; a < len; a++) { let st = -1, gap = 0, end = -1; for (let b = 0; b <= wide; b++) { const on = b < wide && (u[at(a, b)] || (a > 0 && u[at(a - 1, b)]) || (a < len - 1 && u[at(a + 1, b)])); if (on) { if (st < 0) st = b; end = b; gap = 0; } else if (st >= 0 && ++gap > 2) { if (end - st >= (wide === W ? longX : longY)) for (let k = st; k <= end; k++) cut.push(at(a, k)); st = -1; } } } };
  runs(H, W, (y, x) => y * W + x); runs(W, H, (x, y) => y * W + x);
  for (const i of cut) for (let q = -2; q <= 2; q++) { const a = i + q * W; if (a >= 0 && a < u.length) u[a] = 0; const x = i % W + q; if (x >= 0 && x < W) u[i + q] = 0; }
  return { u, W, H };
}
// src/scans.js
function scanGrain(u, W, H) {
  const cap = Math.round(Math.max(W, H) * .06);
  const gaps = (len, wide, at) => { let a = 0, b = 0; for (let i = 0; i < len; i++) { let last = -1; for (let k = 0; k < wide; k++) { if (!u[at(i, k)]) continue; const g = k - last - 1; if (last >= 0 && g > 1 && g <= cap) { a += g * g; b += g; } last = k; } } return b ? a / b : 0; };
  return (gaps(W, H, (x, y) => y * W + x) + 1) / (gaps(H, W, (y, x) => y * W + x) + 1);
}
// src/scans.js
function scanUp(u, W, H) {
  const row = new Float32Array(H); let inkN = 0;
  for (let y = 0; y < H; y++) { let a = 0; for (let x = 0, i = y * W; x < W; x++, i++) a += u[i]; row[y] = a; inkN += a; }
  const sorted = Array.from(row).filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length < 8) return { lines: 0, up: 0, side: 0, fill: 0, agree: 0, score: 0, inkN };
  const cutoff = Math.max(2, sorted[Math.floor(sorted.length * .9)] * .04), bands = [];
  for (let y = 0, s = -1; y <= H; y++) { const on = y < H && row[y] >= cutoff; if (on && s < 0) s = y; if (!on && s >= 0) { if (y - s >= 4) bands.push([s, y - 1]); s = -1; } }
  if (!bands.length) return { lines: 0, up: 0, side: 0, fill: 0, agree: 0, score: 0, inkN };
  const hs = bands.map(b => b[1] - b[0] + 1).sort((a, b) => a - b), mh = hs[hs.length >> 1], lines = bands.filter(b => b[1] - b[0] + 1 <= mh * 2.4);
  let upI = 0, dnI = 0, lineI = 0, yes = 0, no = 0, blocky = 0; const ls = [], rs = [], cover = [];
  for (const [a, b] of lines) {
    let M = 0, pk = a; for (let y = a; y <= b; y++) if (row[y] > M) { M = row[y]; pk = y; }
    if (b - a >= 6 && row[a + 2] >= M * .45 && row[b - 2] >= M * .45) blocky++;   // sharp at the top and the bottom: capitals or numbers, with nothing reaching past them
    let t = pk, d = pk; while (t > a && row[t - 1] >= M * .5) t--; while (d < b && row[d + 1] >= M * .5) d++;
    let A = 0, B = 0; for (let y = a; y < t; y++) A += row[y]; for (let y = d + 1; y <= b; y++) B += row[y];
    for (let y = a; y <= b; y++) lineI += row[y];
    upI += A; dnI += B; if (A > B * 1.15) yes++; else if (B > A * 1.15) no++;
    let l = W, r = -1; for (let y = a; y <= b; y++) for (let x = 0, i = y * W; x < W; x++, i++) if (u[i]) { if (x < l) l = x; if (x > r) r = x; }
    if (r >= 0) { ls.push(l); rs.push(r); let on = 0; for (let x = l; x <= r; x++) for (let y = a; y <= b; y++) if (u[y * W + x]) { on++; break; } cover.push(on / (r - l + 1)); }   // how much of its length the line has ink on
  }
  const spread = v => { const q = v.slice().sort((a, b) => a - b); return q.length < 3 ? 0 : q[Math.floor(q.length * .8)] - q[Math.floor(q.length * .2)]; };
  const sl = spread(ls), sr = spread(rs), side = (sr - sl) / (sr + sl + 6);
  const up = (upI - dnI) / (upI + dnI + 1), agree = (yes + no) ? Math.abs(yes - no) / (yes + no) : 0;
  const fill = ((H - 1 - bands[bands.length - 1][1]) - bands[0][0]) / H;
  return { lines: lines.length, up, side, fill, agree, reach: (upI + dnI) / (lineI + 1), blocky: blocky / (lines.length || 1), cover: cover.sort((p, q) => p - q)[cover.length >> 1], score: up + side * .35 + fill * .15, inkN };
}
// src/scans.js
function scanPoints(mask, w, h, total) {
  const step = Math.max(1, Math.ceil(total / 60000)), xs = new Int32Array(Math.ceil(total / step) + 1), ys = new Int32Array(xs.length); let n = 0, k = 0;
  for (let y = 0; y < h; y++) for (let x = 0, i = y * w; x < w; x++, i++) if (mask[i] && k++ % step === 0) { xs[n] = x; ys[n] = y; n++; }
  return { xs, ys, n };
}
// src/scans.js
function scanFaintLines(g, w, h, ink, least) {
  const r = 8, m = ink.margin + r + 1, size = Math.max(w, h), box = new Float32Array(w * h), mask = new Uint8Array(w * h), hist = new Uint32Array(64);
  for (let y = 1; y < h - 1; y++) for (let x = 1, i = y * w + x; x < w - 1; x++, i++) box[i] = (g[i - w - 1] + g[i - w] + g[i - w + 1] + g[i - 1] + g[i] + g[i + 1] + g[i + w - 1] + g[i + w] + g[i + w + 1]) / 9;   // evened out, so speckle drops away
  const dip = i => Math.max(Math.min(box[i - r], box[i + r]), Math.min(box[i - r * w], box[i + r * w])) - box[i];   // darker than the paper on both sides: a slope of shadow never is
  let seen = 0, c = 0, med = 0, total = 0;
  for (let y = m; y < h - m; y += 2) for (let x = m, i = y * w + x; x < w - m; x += 2, i += 2) { hist[Math.max(0, Math.min(63, Math.round(dip(i) * 4)))]++; seen++; }
  for (; med < 63; med++) { c += hist[med]; if (c >= seen / 2) break; }
  const t = Math.max(5, (med / 4 + .5) * 3.2);
  for (let y = m; y < h - m; y++) for (let x = m, i = y * w + x; x < w - m; x++, i++) if (dip(i) >= t) { mask[i] = 1; total++; }
  const enough = least * 10;   // what a page of writing leaves, however faint
  if (total < enough) return false;
  const a = scanPoints(mask, w, h, total), rows = scanTilt(a.xs, a.ys, a.n, size, -8, 8, true), cols = scanTilt(a.ys, a.xs, a.n, size, -8, 8, true), across = rows.e >= cols.e;
  const { u, W, H } = scanLevel(mask, w, h, across ? rows.deg : -cols.deg, across ? 0 : 1), row = new Float32Array(H), tw = Math.ceil(W / 64), th = Math.ceil(H / 64), tile = new Uint16Array(tw * th);
  for (let y = 0; y < H; y++) for (let x = 0, i = y * W; x < W; x++, i++) row[y] += u[i];
  let n = 0, spread = 0;
  for (let y = 0; y < H; y++) {   // A pale ruled line is only a few rows thick and a line of writing is more, so a ruled line is thinned down to what's around it.
    const mid = y < 3 || y >= H - 3 ? 0 : [row[y - 3], row[y - 2], row[y - 1], row[y], row[y + 1], row[y + 2], row[y + 3]].sort((p, q) => p - q)[3], every = row[y] > mid * 2 + 3 ? Math.ceil(row[y] / (mid + 1)) : 1;
    let k = 0; for (let x = 0, i = y * W; x < W; x++, i++) if (u[i]) { if (k++ % every) u[i] = 0; else { n++; tile[(y >> 6) * tw + (x >> 6)]++; } }
  }
  if (n < enough) return false;
  for (const v of tile) if (v >= 8) spread++;
  if (spread < tile.length * .09) return false;   // a crease or two, not lines of writing
  const b = scanPoints(u, W, H, n), lv = scanTilt(b.xs, b.ys, b.n, size);
  return lv.e / lv.all.slice().sort((p, q) => p - q)[lv.all.length >> 1] >= 1.6;   // lines go sharp at their own tilt, and dust looks the same at any tilt
}
// src/scans.js
function scanRead(g, w, h) {
  const ink = scanInk(g, w, h), out = { turn: 0, turnSure: 0, sideways: false, skew: 0, skewSure: 0, blank: false, faint: false, why: {} };
  out.why.contrast = ink.contrast; out.why.heavy = ink.heavy; out.why.paper = ink.paper;
  const least = ink.area * .00025;   // about the ink in a short word
  const nothing = () => { if (scanFaintLines(g, w, h, ink, least)) out.faint = out.soft = true; else out.blank = true; return out; };   // soft: too faint to tell writing from the back of the page showing through, so it stays in
  if (ink.n < least && (ink.contrast < 24 || !scanSolid(ink.mask, w, h, 20, .09))) return nothing();   // nothing, or dust. A lone word or number in from the edge is writing.
  const { xs, ys, n } = scanPoints(ink.mask, w, h, ink.n);
  const size = Math.max(w, h), rows = scanTilt(xs, ys, n, size, -8, 8, true), cols = scanTilt(ys, xs, n, size, -8, 8, true);
  const across = rows.e >= cols.e, ratio = across ? rows.e / cols.e : cols.e / rows.e, tilt = across ? rows : cols;
  const skew = across ? tilt.deg : -tilt.deg;
  const peak = tilt.e / tilt.all.slice().sort((a, b) => a - b)[tilt.all.length >> 1];
  // Both halves of the page have to agree on the tilt.
  const half = (from) => { const X = new Int32Array(n), Y = new Int32Array(n); let c = 0; const mid = (across ? w : h) / 2; for (let i = 0; i < n; i++) { const pos = across ? xs[i] : ys[i]; if (from ? pos >= mid : pos < mid) { X[c] = across ? xs[i] : ys[i]; Y[c] = across ? ys[i] : xs[i]; c++; } } return c > 150 ? scanTilt(X, Y, c, size, tilt.deg - 2, tilt.deg + 2, true).deg : null; };
  const ha = half(false), hb = half(true), gapH = ha == null || hb == null ? 9 : Math.abs(ha - hb);
  const level = scanLevel(ink.mask, w, h, skew, across ? 0 : 1), look = scanUp(level.u, level.W, level.H);
  const grain = scanGrain(level.u, level.W, level.H);
  out.why.grain = grain;
  Object.assign(out.why, { ratio, peak, gapH, across, up: look.up, side: look.side, fill: look.fill, lines: look.lines, agree: look.agree, score: look.score, reach: look.reach, blocky: look.blocky, cover: look.cover, inkN: look.inkN });
  const solid = look.inkN < least * 40 ? scanSolid(level.u, level.W, level.H, 14) : look.inkN;
  out.why.solid = solid;
  // Specks, ruled paper with nothing on it, a shadow or staple at the edge, punch holes, or the back showing through. Very faint ink breaks into dust, so there the amount of it decides:
  // a page of writing has plenty, however faint, and it must never be called blank. Show-through as strong as faint print can't be told from it, so that page is called faint instead.
  const written = (from, band) => from >= least || scanSolid(level.u, level.W, level.H, 20, band) > 0;
  if (ink.contrast < 24 ? look.inkN < least * 10 : ink.contrast < 36 ? scanSolid(level.u, level.W, level.H, 14, .09) < least : !written(solid, .09)) return nothing();
  out.faint = ink.contrast < 75 || ink.paper < 170;
  if (ink.heavy > .03) return out;   // a picture or chart is on the page: its edges aren't lines of writing
  // Straightening
  const flat = Math.abs(skew) < .5;
  if (!flat && Math.abs(skew) <= 7.5) {
    out.skew = skew;
    out.skewSure = peak >= 1.6 && gapH <= .5 && look.lines >= 4 ? 2 : peak >= 1.3 && gapH <= 1.2 && look.lines >= 2 ? 1 : 0;
    if (!out.skewSure) out.skew = 0;
  }
  // Math, code and lists: short lines start level with each other and their characters stack up, so they can look like lines running the other way.
  // The white between them says which way they really run. Then there's no telling which way is up: a page that looks on its side asks, and any other says nothing.
  // So can a grid of numbers, like a page of matrices. Whichever way it's read, its rows and columns are mostly white between the numbers, and a line of writing hardly stops, even in a few lines of it.
  // A page like that which reads as on its side asks only if its white is far wider one way, since a grid can read either way.
  if (grain < 1 || look.cover < .6) { if ((across ? grain < .9 : grain >= 2) && ratio >= 1.6 && look.lines >= 4) { out.sideways = true; out.turnSure = 1; } return out; }
  // Turning. A wrong turn is worse than none, so it takes every sign pointing the same way.
  const both = Math.abs(look.up) <= .92 && look.reach >= .04 && look.blocky < .65;   // letters that reach both ways: all capitals have nothing to go on
  const strong = both && look.lines >= 6 && Math.abs(look.up) >= .14 && look.agree >= .5 && Math.sign(look.up) === Math.sign(look.score) && look.side * look.up >= .02 && Math.abs(look.side) >= .05 && Math.abs(look.score) >= .2;   // the letters and the left edge both have to say so
  const fair = both && look.lines >= 3 && Math.abs(look.score) >= .12 && Math.abs(look.up) >= .06 && look.agree >= .5 && Math.sign(look.up) === Math.sign(look.score) && look.side * look.up >= -.15;
  const base = across ? 0 : 90, way = look.score >= 0 ? base : base + 180;
  if (across && ratio >= 1.6) {
    if (way === 180) { out.turn = 180; out.turnSure = strong ? 2 : fair ? 1 : 0; if (!out.turnSure) out.turn = 0; }
  } else if (!across && ratio >= 1.6) {
    if (strong || fair || ratio >= 2.5) { out.sideways = true; out.turn = way; out.turnSure = strong && ratio >= 2 ? 2 : 1; }
    if (!strong && !fair) out.turn = 0;   // sideways, and either way round could be up
  }
  return out;
}
// src/scans.js
async function scanCover(page) {
  const ol = await page.getOperatorList(), O = pdfjsLib.OPS, V = page.view, mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const pics = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintImageMaskXObject, O.paintImageXObjectRepeat, O.paintImageMaskXObjectRepeat, O.paintSolidColorImageMask]), groups = new Set([O.paintInlineImageXObjectGroup, O.paintImageMaskXObjectGroup]);
  let m = [1, 0, 0, 1, 0, 0], area = 0; const st = [];
  ol.fnArray.forEach((fn, i) => {
    const a = ol.argsArray[i];
    if (fn === O.save) st.push(m);
    else if (fn === O.restore) m = st.pop() || m;
    else if (fn === O.transform) m = mul(m, a);
    else if (fn === O.paintFormXObjectBegin) { st.push(m); if (a && a[0]) m = mul(m, a[0]); }
    else if (fn === O.paintFormXObjectEnd) m = st.pop() || m;
    else if (groups.has(fn)) area += 1e12;
    else if (pics.has(fn)) area += Math.abs(m[0] * m[3] - m[1] * m[2]);
  });
  return Math.min(1, area / ((V[2] - V[0]) * (V[3] - V[1]) || 1));
}
// src/scans.js
async function scanLook(page, rot) {
  const tc = await page.getTextContent(), chars = tc.items.reduce((a, it) => a + (it.str ? it.str.replace(/\s/g, '').length : 0), 0);
  if ((await page.getAnnotations({ intent: 'display' })).length) return { typed: 1 };
  const cover = await scanCover(page);
  if (chars && cover < .6) return { typed: 1 };   // text over a picture covering the page is a scan with its words read by a copier or OCR app, and it's looked at like any scan
  const rotation = ((page.rotate || 0) + rot) % 360, v1 = page.getViewport({ scale: 1, rotation }), vp = page.getViewport({ scale: SCAN_PX / Math.max(v1.width, v1.height), rotation });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const d = ctx.getImageData(0, 0, c.width, c.height).data, g = new Uint8Array(c.width * c.height);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
  const v = scanRead(g, c.width, c.height), rec = {}; c.width = c.height = 0;
  if (v.blank) rec.blank = 1;
  if (cover < .6) return rec;   // drawn, not scanned: only blank counts
  if (rot) rec.rot0 = rot;
  if (v.faint) rec.faint = 1;
  if (v.soft) rec.soft = 1;
  if (v.turnSure) { rec.turn = v.turn; rec.sure = v.turnSure; if (v.sideways) rec.side = 1; }
  if (v.skewSure && chars < 40) { rec.skew = v.skew; rec.skewSure = v.skewSure; }   // words read from the page stay where they were read, so the page isn't straightened out from under them
  return rec;
}
// src/scans.js
function skewMarks(marks, W, H, by) {
  const a = by * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), cx = W / 2, cy = H / 2;
  const pt = ([x, y]) => [r1(cx + (x - cx) * c - (y - cy) * s), r1(cy + (x - cx) * s + (y - cy) * c)];
  const box = b => { const [x, y] = pt([b.x + b.w / 2, b.y + b.h / 2]); return { x: r1(x - b.w / 2), y: r1(y - b.h / 2), w: b.w, h: b.h }; };   // a box stays square to the page and moves with its middle
  for (const m of marks) {
    if (m.t === 'pen') m.pts = m.pts.map(q => keepP(pt(q), q));
    else if (m.t === 'hl' || m.t === 'oval') { Object.assign(m, box(m)); if (m.rects) m.rects = m.rects.map(box); if (m.pts) m.pts = m.pts.map(pt); }
    else if (m.t === 'check' || m.t === 'stamp') [m.x, m.y] = pt([m.x, m.y]);
    else if (m.t === 'note') { [m.ax, m.ay] = pt([m.ax, m.ay]); if (m.hl) m.hl = box(m.hl); if (m.rects) m.rects = m.rects.map(box); }
    else if (m.t === 'text') { const L = textLayout(m, W), [x, y] = pt([m.x + L.ink / 2, m.y + L.h / 2]); m.x = r1(x - L.ink / 2); m.y = r1(y - L.h / 2); keepOnPage(m, W, H); }
  }
}
// src/scans.js
function scanTurn(pg, deg) {
  const f = pg.file, p = pg.idx;
  commitEditors(); pushUndo(stepOf(f, p, true));
  let W = pg.W, H = pg.H;
  for (let k = deg; k > 0; k -= 90) { if (f.marks[p] && f.marks[p].length) turnMarks(f.marks[p], W, H, 1); [W, H] = [H, W]; }
  setRot(f, p, rotOf(f, p) + deg);
  const was = f.sc && f.sc[p]; if (was && was.didTurn && rotOf(f, p) !== was.didTurn) (was.off ||= {}).turn = 1;   // not the app's turn any more: merging another computer's copy mustn't bring it back
  set.selected(null); thumbCache.clear(); reshape(pg); rescanFile(f); saveSoon(); renderList();
}
// src/scans.js
function scanStraighten(pg, to) {
  const f = pg.file, p = pg.idx, by = to - skewOf(f, p);
  commitEditors(); pushUndo(stepOf(f, p, true));
  if (f.marks[p] && f.marks[p].length) skewMarks(f.marks[p], pg.W, pg.H, by);
  coverAgain(f.path, p);
  const boxes = batch.share && batch.share.boxes && batch.share.boxes[boxKey(f.path, p)];
  if (boxes) {
    const a = by * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), W = pg.W, H = pg.H;
    for (const b of boxes) { const x = (b[0] + b[2] / 2 - .5) * W, y = (b[1] + b[3] / 2 - .5) * H; b[0] = (x * c - y * s) / W + .5 - b[2] / 2; b[1] = (x * s + y * c) / H + .5 - b[3] / 2; }
  }
  setSkew(f, p, to);
  const was = f.sc && f.sc[p]; if (was && was.didSkew && to !== was.didSkew) (was.off ||= {}).skew = 1;
  set.selected(null); thumbCache.clear(); reshape(pg); rescanFile(f); saveSoon(); renderList();
}
// src/scans.js
const scanLits = rec => batch.students.flatMap(s => s.files.flatMap(f => Object.values(f.sc || {}))).filter(r => r.lit && r !== rec);
// src/scans.js
function scanLight(pg, rec) {
  const st = batch.students[cur]; if (!pg.bmp) return;
  batch.light ||= {};
  rec.lit = { had: batch.light[st.key] || null, on: lightOpts().on && !scanLits(rec).some(r => !r.lit.on) };   // Lighting was only on because of another student's page: then it was off
  batch.light[st.key] = { ...lightAuto(pg), s: lightFor(st).s || 0 };
  if (!lightOpts().on) batch.lightOpt = { ...lightOpts(), on: true };
  lightPagesChanged();
}
// src/scans.js
function scanLightBack(rec) {
  const st = batch.students[cur];
  if (rec.lit.had) batch.light[st.key] = rec.lit.had; else delete batch.light[st.key];
  if (!rec.lit.on && !scanLits(rec).length) batch.lightOpt = { ...lightOpts(), on: false };   // Lighting goes back off once no other page is using it
  delete rec.lit;
  lightPagesChanged();
}
// src/scans.js
const scanAsks = (f, p, r) => !!r.turn && !r.didTurn && rotOf(f, p) === (r.rot0 || 0);
// src/scans.js
const scanRescans = () => batch ? batch.students.flatMap((st, i) => st.files.flatMap(f => Object.entries(f.sc || {}).filter(([, r]) => r.re).map(([p]) => ({ i, st, f, p: +p })))) : [];
// src/scans.js
const spView = (me, i, page, scale) => page.getViewport({ scale, rotation: ((page.rotate || 0) + (me.rot[i] || 0)) % 360 });
// src/scans.js
const spXf = (me, i, vp) => skewXf({ skew: me.skew }, i, vp);
// src/scans.js
function scanDarken(ctx, w, h) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data, Y = i => (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  const side = Math.max(w, h) / 24, cols = Math.max(1, Math.round(w / side)), rows = Math.max(1, Math.round(h / side)), cw = w / cols, ch = h / rows, n = new Uint32Array(cols * rows * 256), paper = new Float32Array(cols * rows);
  for (let y = 0, i = 0; y < h; y++) { const r = Math.min(rows - 1, Math.floor(y / ch)); for (let x = 0; x < w; x++, i += 4) n[(r * cols + Math.min(cols - 1, Math.floor(x / cw))) * 256 + Y(i)]++; }
  for (let c = 0; c < paper.length; c++) { let seen = 0, tot = 0, v = 0; for (let k = 0; k < 256; k++) tot += n[c * 256 + k]; while (v < 255 && (seen += n[c * 256 + v]) * 2 < tot) v++; paper[c] = v; }
  const near = (t, top) => { const a = Math.max(0, Math.min(top - 1, Math.floor(t - .5))); return [a, Math.min(top, a + 1), t - .5 - a]; };
  const across = Array.from({ length: w }, (_, x) => near((x + .5) / cw, cols - 1));
  for (let y = 0, i = 0; y < h; y++) {
    const [r0, r1, s] = near((y + .5) / ch, rows - 1);
    for (let x = 0; x < w; x++, i += 4) {
      const [c0, c1, t] = across[x], top = paper[r0 * cols + c0] * (1 - t) + paper[r0 * cols + c1] * t, low = paper[r1 * cols + c0] * (1 - t) + paper[r1 * cols + c1] * t;
      const gap = top * (1 - s) + low * s - Y(i); d[i] = d[i + 1] = d[i + 2] = gap <= 2 ? 255 : Math.max(0, 255 - gap * 16);
    }
  }
  ctx.putImageData(im, 0, 0);
}
// src/scans.js
function scanSplitSays(me) {
  const list = Object.entries(me.sc), n = t => list.filter(([i, r]) => t(r, i, r.off || {})).length, say = (k, one, many) => k ? [k + ' ' + (k === 1 ? one : many)] : [];
  return [...say(n((r, i) => r.didTurn && me.rot[i] === r.didTurn), 'page turned', 'pages turned'), ...say(n((r, i) => r.didSkew && me.skew[i]), 'straightened', 'straightened'), ...say(n(r => r.blank), 'looks blank', 'look blank'),
    ...say(n((r, i, off) => (((r.turn && !r.didTurn) || (r.side && !r.turn)) && !me.rot[i] && !off.turn) || (r.skew && !r.didSkew && !me.skew[i] && !off.skew)), 'to check', 'to check'), ...say(n(r => r.faint), 'looks faint', 'look faint')].join(', ');
}
// src/scans.js
const scanHints = new Map();
// src/scans.js
function scanBytes(d) { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return d.length + ':' + (h >>> 0); }
// src/scans.js
function scanHint(me, bytes, list, nm, lit) {
  const pages = {}; list.forEach((i, j) => {
    const rec = me.sc[i] ? JSON.parse(JSON.stringify(me.sc[i])) : null, w = spWho(me, i).filter(x => x !== nm);
    pages[j] = { rec, rot: me.rot[i] || 0, skew: me.skew[i] || 0, re: me.re.has(i), w: w.length ? w : null, L: lit ? spLight(me, i) : null };
  });
  scanHints.set(scanBytes(bytes), pages);
}
// src/scans.js
function scanTakeHint(f, st) {
  if (!scanHints.size || f.sc) return;
  const k = scanBytes(f.data), h = scanHints.get(k); if (!h) return;
  scanHints.delete(k); f.sc = {};
  const lit = Object.values(h).find(x => x.L);
  for (const [p, x] of Object.entries(h)) {
    const rec = x.rec || ((x.re || x.w) && { later: 1 });
    if (rec) { if (x.re) rec.re = 1; if (x.w) rec.w = x.w; f.sc[p] = rec; }
    if (x.rot) setRot(f, p, x.rot); if (x.skew) setSkew(f, p, x.skew);
    if (lit && st && !x.L) setPageLit(st, f, p, false);   // lighting goes where she set it in the split
  }
  if (lit && st) { batch.light ||= {}; batch.light[st.key] ||= { ...lit.L }; batch.lightOpt = { ...lightOpts(), on: true }; }
  scanned = false; saveSoon();
}
// src/scans.js
function scanHintsAll() { if (batch) for (const st of batch.students) for (const f of st.files) if (viewable(f) && !f.virtual) scanTakeHint(f, st); scanHints.clear(); groupBandRefresh(); }
// src/scans.js
const spLight = (me, i) => { const L = me.Lp[i] || me.L; return lightOn(L) ? L : null; };
// src/imported.js
const IMP_ID = /^\d+R\d*$/;
// src/imported.js
const IMP_LINES = new Set(['Ink', 'Line', 'PolyLine', 'Polygon', 'Underline', 'StrikeOut', 'Squiggly']);
// src/imported.js
function impVisible(a) { return !IMP_SKIP.has(a.subtype) && !(a.annotationFlags & 2) && !(a.annotationFlags & 32); }
// src/imported.js
const IMP_SKIP = new Set(['Link', 'Popup', 'Widget']);
// src/imported.js
function impKind(a) {
  if (!IMP_ID.test(String(a.id || ''))) return null;
  if (IMP_LINES.has(a.subtype)) return 'pen';
  if (a.subtype === 'Highlight') return 'hl';
  if (a.subtype === 'Square' || a.subtype === 'Circle') return 'oval';
  if (a.subtype === 'FreeText') return commentText(a) ? 'text' : null;
  if (a.subtype === 'Text') return commentText(a) ? 'note' : null;
  return null;
}
// src/imported.js
function impHex(c, dflt) { return c && c.length >= 3 ? '#' + [0, 1, 2].map(i => Math.round(c[i]).toString(16).padStart(2, '0')).join('') : dflt; }
// src/imported.js
function impMarks(a, vp, xf, line) {
  const P = (x, y) => {
    let [X, Y] = vp.convertToViewportPoint(x, y);
    if (xf) [X, Y] = [xf[0] * X + xf[2] * Y + xf[4], xf[1] * X + xf[3] * Y + xf[5]];
    return [r1(X), r1(Y)];
  };
  const box = pts => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x = Math.min(...xs), y = Math.min(...ys); return { x: r1(x), y: r1(y), w: r1(Math.max(...xs) - x), h: r1(Math.max(...ys) - y) }; };
  const rectBoxOf = rc => box([P(rc[0], rc[1]), P(rc[2], rc[3]), P(rc[0], rc[3]), P(rc[2], rc[1])]);
  const quads = () => (a.quadPoints || []).map(q => box(q.map(o => P(o.x, o.y)))).filter(r => r.w > 0 && r.h > 0);
  const col = impHex(a.color, COLORS.red), w = r1(Math.max(0.6, (a.borderStyle && a.borderStyle.width) || 1)), text = commentText(a);
  const out = [], rb = rectBoxOf(a.rect);
  // a pen mark, shape or highlight can have a comment too: it goes in the margin, pointing at the mark's top right
  const withNote = () => { if (text) out.push({ t: 'note', color: col, ax: r1(Math.min(rb.x + rb.w, vp.width - 2)), ay: r1(rb.y + Math.min(8, rb.h / 2)), text }); };
  switch (a.subtype) {
    case 'Ink':
      for (const L of a.inkLists || []) if (L.length) out.push({ t: 'pen', color: col, w, pts: L.map(o => P(o.x, o.y)) });
      withNote(); break;
    case 'Line': {
      const c = line && line.length === 4 ? line : a.lineCoordinates;
      if (c) out.push({ t: 'pen', color: col, w, pts: [P(c[0], c[1]), P(c[2], c[3])] });
      withNote(); break;
    }
    case 'PolyLine': case 'Polygon': {
      const v = (a.vertices || []).map(o => P(o.x, o.y));
      if (v.length) out.push({ t: 'pen', color: col, w, pts: a.subtype === 'Polygon' ? v.concat([v[0]]) : v });
      withNote(); break;
    }
    case 'Underline': case 'StrikeOut': case 'Squiggly':
      for (const r of quads()) {
        const y = r1(a.subtype === 'StrikeOut' ? r.y + r.h / 2 : r.y + r.h - 0.6), lw = r1(Math.max(1, r.h / 14));
        if (a.subtype !== 'Squiggly') { out.push({ t: 'pen', color: col, w: lw, pts: [[r.x, y], [r1(r.x + r.w), y]] }); continue; }
        const pts = [], step = Math.max(2, r.h / 5);
        for (let x = r.x, k = 0; x <= r.x + r.w; x += step, k++) pts.push([r1(x), r1(y - (k % 2 ? step * 0.6 : 0))]);
        if (pts.length > 1) out.push({ t: 'pen', color: col, w: lw, pts });
      }
      withNote(); break;
    case 'Highlight': {
      const rs = quads(); if (!rs.length) rs.push(rb);
      const hc = impHex(a.color, HL.yellow);
      if (text) {
        const last = rs[rs.length - 1], m = { t: 'note', color: hc, ax: r1(last.x + last.w), ay: r1(last.y + last.h / 2), hl: rectBox(rs), hc, text };
        if (rs.length > 1) m.rects = rs;
        out.push(m);
      } else out.push(setRects({ t: 'hl', color: hc }, rs));
      break;
    }
    case 'Square': case 'Circle':
      out.push({ t: 'oval', color: col, sw: w, x: r1(rb.x + w / 2), y: r1(rb.y + w / 2), w: r1(Math.max(2, rb.w - w)), h: r1(Math.max(2, rb.h - w)) });
      withNote(); break;
    case 'FreeText': {
      const da = a.defaultAppearanceData || {}, size = r1(Math.min(48, Math.max(6, da.fontSize || 12)));
      out.push({ t: 'text', color: impHex(da.fontColor, COLORS.black), x: r1(rb.x + 2), y: r1(rb.y + 2), size, text, bw: r1(Math.max(24, rb.w - 4)) });
      break;
    }
    case 'Text':
      out.push({ t: 'note', color: col, ax: r1(Math.min(rb.x + rb.w / 2, vp.width - 2)), ay: r1(rb.y + rb.h / 2), text });
      break;
  }
  for (const m of out) m.imp = a.id;
  return out;
}
// src/imported.js
async function impRead(f) {
  const res = { pages: {}, n: 0, keep: 0, kinds: {}, locked: false };
  if (f.kind !== 'pdf' || !f.data || f.virtual) return res;
  await workerReady;
  const js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
  let lib = null;
  try {
    for (let p = 0; p < js.numPages; p++) {
      const page = await js.getPage(p + 1);
      const done = new Set((f.imp && f.imp[p]) || []);
      const annots = (await page.getAnnotations({ intent: 'display' })).filter(a => impVisible(a) && !done.has(a.id));
      if (!annots.length) { page.cleanup(); continue; }
      if (!lib) {
        lib = await PDFLib.PDFDocument.load(f.data, { ignoreEncryption: true, updateMetadata: false });
        // a locked file can't be saved again without its marks, so they stay as they are
        if (lib.isEncrypted) { res.locked = true; }
      }
      const vp = vpRot(f, p, page, 1), xf = skewXf(f, p, vp), list = [];
      for (const a of annots) {
        const kind = res.locked ? null : impKind(a);
        if (!kind) { res.keep++; continue; }
        let line = null;
        if (a.subtype === 'Line') { try { const [num, gen] = a.id.split('R'); const d = lib.context.lookup(PDFLib.PDFRef.of(+num, +(gen || 0))); const L = d && d.lookupMaybe(PDFLib.PDFName.of('L'), PDFLib.PDFArray); if (L) line = L.asArray().map(v => v.asNumber()); } catch {} }
        const marks = impMarks(a, vp, xf, line);
        if (!marks.length) { res.keep++; continue; }
        list.push({ id: a.id, kind, marks });
        res.kinds[kind] = (res.kinds[kind] || 0) + 1; res.n++;
      }
      if (list.length) res.pages[p] = list;
      page.cleanup();
    }
  } finally { js.destroy(); }
  return res;
}
// src/imported.js
function impCount(f) { return (f && !f.impNo && f.scan && f.scan.impN) || 0; }
// src/imported.js
async function gsFlatCheck(f, doc) {
  if (f.gsFlat !== undefined) return f.gsFlat;
  f.gsFlat = false;
  if (f.kind !== 'pdf' || f.virtual || f.noauto) return false;
  try { const { info } = await doc.getMetadata(); f.gsFlat = !!info && info.Creator === 'Grading Studio'; } catch {}
  return f.gsFlat;
}
// src/pastetext.js
const PT_W = 595.28, PT_H = 841.89, PT_M = 64, PT_SIZE = 12, PT_LINE = 18;
// src/pastetext.js
function pasteClean(s) {
  return String(s || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[   ]/g, ' ').replace(/[​-‍⁠﻿­]/g, '').replace(/[ \t]+$/gm, '').replace(/^\n+|\s+$/g, '');
}
// src/pastetext.js
const pasteName = s => (String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Emailed work');
// src/pastetext.js
function pasteWrap(text, width, measure, words) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const w of words(para)) {
      if (measure(line + w) <= width) { line += w; continue; }
      if (line.trim()) { out.push(line.replace(/\s+$/, '')); line = ''; }
      let piece = w.replace(/^\s+/, '');
      while (measure(piece) > width) {
        let k = 1; while (k < piece.length && measure(piece.slice(0, k + 1)) <= width) k++;
        out.push(piece.slice(0, k)); piece = piece.slice(k);
      }
      line = piece;
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out;
}
// src/pastetext.js
const spaceWords = para => para.match(/\s*\S+/g) || [];
// src/pastetext.js
const segWords = para => {   // languages written without spaces (Thai) break between words, where the browser knows how
  try { return [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(para)].map(s => s.segment); } catch { return para.match(/\s*\S+/g) || []; }
};
// src/pastetext.js
function pastePages(lines, firstTop) {
  const pages = [[]]; let y = firstTop;
  for (const l of lines) {
    if (y - PT_LINE < PT_M) { pages.push([]); y = PT_H - PT_M; }
    pages[pages.length - 1].push(l); y -= PT_LINE;
  }
  return pages;
}
// src/pastetext.js
async function pasteTextPdf(title, text, when) {
  text = pasteClean(text); title = pasteName(title);
  const doc = await PDFLib.PDFDocument.create();
  doc.setTitle(title);   // no Creator: 'Grading Studio' there means a flattened export (imported.js)
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const sub = 'Pasted from a message on ' + new Date(when || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const can = new Set(font.getCharacterSet()), typed = [...(title + sub + text)].every(ch => ch === '\n' || can.has(ch.codePointAt(0)));
  const width = PT_W - 2 * PT_M, gray = PDFLib.rgb(0.45, 0.45, 0.45), ink = PDFLib.rgb(0.1, 0.1, 0.12);
  if (typed) {
    const lines = pasteWrap(text, width, s => font.widthOfTextAtSize(s, PT_SIZE), spaceWords);
    const titleLines = pasteWrap(title, width, s => bold.widthOfTextAtSize(s, 16), spaceWords);
    let top = PT_H - PT_M - 16 - (titleLines.length - 1) * 21 - 44;
    pastePages(lines, top).forEach((pl, i) => {
      const page = doc.addPage([PT_W, PT_H]);
      let y = PT_H - PT_M - PT_SIZE;
      if (i === 0) {
        y = PT_H - PT_M - 16;
        for (const t of titleLines) { page.drawText(t, { x: PT_M, y, size: 16, font: bold, color: ink }); y -= 21; }
        y += 21 - 16; page.drawText(sub, { x: PT_M, y, size: 9.5, font, color: gray }); y = top;
      }
      for (const l of pl) { if (l) page.drawText(l, { x: PT_M, y, size: PT_SIZE, font, color: ink }); y -= PT_LINE; }
    });
    return { bytes: await doc.save(), typed: true };
  }
  // Pictures of the pages, drawn twice the size for sharp marking
  try { await Promise.all([document.fonts.load('400 24px Inter', text), document.fonts.load('700 32px Inter', title)]); } catch {}
  const S = 2, c = document.createElement('canvas'); c.width = Math.round(PT_W * S); c.height = Math.round(PT_H * S);
  const g = c.getContext('2d'), face = '"Inter", system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Thai", Tahoma, sans-serif';
  const setFont = (px, w) => { g.font = (w || 400) + ' ' + (px * S) + 'px ' + face; };
  setFont(PT_SIZE); const lines = pasteWrap(text, width * S, s => g.measureText(s).width, segWords);
  setFont(16, 700); const titleLines = pasteWrap(title, width * S, s => g.measureText(s).width, segWords);
  const top = PT_H - PT_M - 16 - (titleLines.length - 1) * 21 - 44;
  for (const [i, pl] of pastePages(lines, top).entries()) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.textBaseline = 'alphabetic';
    let y = PT_M + PT_SIZE;
    if (i === 0) {
      y = PT_M + 16; g.fillStyle = '#1a1a1f'; setFont(16, 700);
      for (const t of titleLines) { g.fillText(t, PT_M * S, y * S); y += 21; }
      y += 16 - 21; g.fillStyle = '#737373'; setFont(9.5); g.fillText(sub, PT_M * S, y * S); y = PT_H - top;
    }
    g.fillStyle = '#1a1a1f'; setFont(PT_SIZE);
    for (const l of pl) { if (l) g.fillText(l, PT_M * S, y * S); y += PT_LINE; }
    const png = await new Promise(r => c.toBlob(r, 'image/png'));
    const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    doc.addPage([PT_W, PT_H]).drawImage(img, { x: 0, y: 0, width: PT_W, height: PT_H });
  }
  return { bytes: await doc.save(), typed: false };
}
export { goneNow, markCount, replacedOf, freshRows, guessNewName, fileShown, sortTag, madeFromWord, setDocIn, gradeWords, wordsJoin, moveFileNow, gradeHasWork, pasteTextPdf, pasteClean, pasteName, outPages, impRead, impCount, gsFlatCheck, impKind, scanLook, scanDarken, spView, spXf, scanSplitSays, scanHint, scanHintsAll, scanBytes, spRange, spWho, spAll, spLight, splitIntoNames, rosterMatch, splitInk, scanRescans, scanTurn, scanStraighten, scanLight, scanLightBack, scanAsks };
