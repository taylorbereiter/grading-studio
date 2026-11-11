/* ---------------- paper scans: turned, crooked, blank and faint pages ---------------- */
// There's no reading of words here, only what the ink looks like. Sure of it: the fix is made and the page says so, with Put back.
// Not so sure: the page asks. Blank and faint pages only ever ask. Pages with typed text or Kami notes are left alone, but a scan with its words read by OCR is still a scan.
const SCAN_PX = 1000;   // the long side of the picture that's looked at

// Which pixels are ink: darker than the paper around them, so a shadow across the page doesn't count.
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
// How crisp the lines of ink are at each small tilt. Lines of writing go sharp at their own tilt.
function scanSharp(xs, ys, n, t, size) {
  const pad = Math.ceil(Math.abs(t) * size) + 2, hist = new Int32Array(size * 2 + 2 * pad);
  for (let i = 0; i < n; i++) hist[(ys[i] + xs[i] * t + pad) | 0]++;
  let e = 0; for (let b = 1; b < hist.length; b++) { const d = hist[b] - hist[b - 1]; e += d * d; }
  return e / (n * n);
}
function scanTilt(xs, ys, n, size, lo = -8, hi = 8, fine = false) {
  let best = 0, be = -1; const all = [];
  for (let a = lo; a <= hi + 1e-6; a += .5) { const e = scanSharp(xs, ys, n, Math.tan(a * Math.PI / 180), size); all.push(e); if (e > be) { be = e; best = a; } }
  if (!fine) return { deg: best, e: be, all };
  const mid = best;
  for (let a = mid - .4; a <= mid + .4 + 1e-6; a += .1) { const e = scanSharp(xs, ys, n, Math.tan(a * Math.PI / 180), size); if (e > be) { be = e; best = a; } }
  return { deg: Math.round(best * 10) / 10, e: be, all };
}
// How many pixels of ink are in pieces big enough to be writing, not dust. A big round piece near an edge is a punch hole. band: also leave out whatever sits that close to an edge.
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
// The ink with its lines of writing level. Long ruled lines, table lines and streaks are taken out, since they say nothing about which way is up.
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
// Which way the writing runs, whatever the letters line up into: the white between lines is wider than the white along a line. Above 1 it agrees with the lines as they lie in u.
function scanGrain(u, W, H) {
  const cap = Math.round(Math.max(W, H) * .06);
  const gaps = (len, wide, at) => { let a = 0, b = 0; for (let i = 0; i < len; i++) { let last = -1; for (let k = 0; k < wide; k++) { if (!u[at(i, k)]) continue; const g = k - last - 1; if (last >= 0 && g > 1 && g <= cap) { a += g * g; b += g; } last = k; } } return b ? a / b : 0; };
  return (gaps(W, H, (x, y) => y * W + x) + 1) / (gaps(H, W, (y, x) => y * W + x) + 1);
}
// Which way up, from level ink. Above 0 it's the right way up, below 0 it's the other way up.
// Letters reach up more than they hang down, lines start even at the left and end uneven at the right, and a page fills from the top.
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
// Up to 60000 pixels of ink, spread evenly.
function scanPoints(mask, w, h, total) {
  const step = Math.max(1, Math.ceil(total / 60000)), xs = new Int32Array(Math.ceil(total / step) + 1), ys = new Int32Array(xs.length); let n = 0, k = 0;
  for (let y = 0; y < h; y++) for (let x = 0, i = y * w; x < w; x++, i++) if (mask[i] && k++ % step === 0) { xs[n] = x; ys[n] = y; n++; }
  return { xs, ys, n };
}
// A second look before a page is called blank. Very faint writing breaks into dust too fine for the rules below, but it still lies in lines across the page, and dust, paper grain and a shadow don't.
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
// The look at one page: g is its lightness, w by h pixels. turn and skew are the fix (degrees clockwise), and sure says how much to trust it: 2 fix it, 1 ask, 0 say nothing.
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

/* ---------------- looking at a page ---------------- */
// How much of the page is covered by pictures: a scan is one big picture, sometimes in strips.
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
// The verdict on one page as it's turned now. typed: real text or Kami notes, so it's not ours to touch, and it isn't kept.
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
// May this page be changed without asking? Not if she's already done something to it.
function scanFree(f, p) {
  const boxes = batch && batch.share && batch.share.boxes && batch.share.boxes[boxKey(f.path, p)];
  return !f.noauto && !f.photoTurn && !(f.marks[p] || []).length && !rotOf(f, p) && !skewOf(f, p) && !(boxes && boxes.length) && !(f.hand && f.hand.page === p);
}
// Looks once at each page she opens, before it's drawn. A page already looked at, here or in the split, keeps what was decided.
async function scanCheck(f, p, page) {
  if (f.virtual) return;
  scanTakeHint(f, batch.students[cur]); groupBandRefresh();
  if (!f.sc) f.sc = {};
  if (f.sc[p] && !f.sc[p].later) return;
  let rec;
  try { rec = await scanLook(page, rotOf(f, p)); } catch (e) { return; }   // she moved on, which closes this student's files
  const was = f.sc[p]; if (was) { delete was.later; Object.assign(rec, was); }   // a rescan flag or group work set before the page was looked at
  f.sc[p] = rec;
  if (rec.typed) return;
  if (scanFree(f, p)) {
    let did = false;
    if (rec.sure === 2 && rec.turn) { setRot(f, p, rec.turn); rec.didTurn = rec.turn; did = true; }
    if (rec.skewSure === 2) { setSkew(f, p, rec.skew); rec.didSkew = rec.skew; did = true; coverAgain(f.path, p); }
    if (did) { scanned = false; thumbCache.clear(); if (f.hand || setup.spot) rescanFile(f); }
  }
  saveSoon();
}
// A name's cover: the level box around its corners, on the page as it's drawn, so a straightened page doesn't slide out from under it.
function coverRound(pts, xf) {
  const q = xf ? pts.map(p => pdfjsLib.Util.applyTransform(p, xf)) : pts, xs = q.map(p => p[0]), ys = q.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
// The side margin stays clean of a straightened page's corners, as it is on screen.
function scanClip(ctx, f, p, w, cw, ch) { if (skewOf(f, p) && cw > w) { ctx.fillStyle = '#fff'; ctx.fillRect(w, 0, cw - w, ch); } }

/* ---------------- what gets saved ---------------- */
// A fix the app made on a page she hasn't touched is kept apart from her work, so it doesn't make a student count as started.
// Marked pages keep theirs with the marks (s.r, s.sk), where carry-over and backups look for them.
const scanMine = (f, did, p, v) => { const r = f.sc && f.sc[p]; return !(r && r[did] === v && !(f.marks[p] || []).length); };
function scanOwn(st, part, did, pick) {
  const out = {};
  for (const f of st.files) { const all = pick ? pick(f) : f[part]; if (all) { const o = {}; for (const [p, v] of Object.entries(all)) if (scanMine(f, did, p, v)) o[p] = v; if (Object.keys(o).length) out[f.path] = o; } }
  return out;
}
function scanSave() {
  const out = {}; let any = false;
  for (const st of batch.students) for (const f of st.files) {
    if (!f.sc) continue;
    const rec = {}, at = {};
    for (const [p, r] of Object.entries(f.sc)) {
      if (r.typed && !r.re && !r.w) continue;
      rec[p] = r;
      const o = {};
      if (r.didTurn && rotOf(f, p) === r.didTurn && !scanMine(f, 'didTurn', p, r.didTurn)) o.r = r.didTurn;
      if (r.didSkew && skewOf(f, p) === r.didSkew && !scanMine(f, 'didSkew', p, r.didSkew)) o.k = r.didSkew;
      if (o.r || o.k) at[p] = o;
    }
    if (Object.keys(rec).length) { out[f.path] = { rec, at }; any = true; }
  }
  return any ? out : undefined;
}
function scanRestore(saved) {
  if (!saved) return;
  for (const st of batch.students) for (const f of st.files) {
    const s = saved[f.path]; if (!s) continue;
    f.sc = { ...s.rec };
    // A fix the app made never overrides her: a page with her marks or a turn of her own stays as she left it, whichever computer the fix came from.
    for (const [p, o] of Object.entries(s.at || {})) { const hers = (f.marks[p] || []).length; if (o.r && !hers && !rotOf(f, p)) setRot(f, p, o.r); if (o.k && !hers && !skewOf(f, p)) setSkew(f, p, o.k); }
  }
}

/* ---------------- fixing a page she's looking at ---------------- */
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
function scanTurn(pg, deg) {
  const f = pg.file, p = pg.idx;
  commitEditors(); pushUndo(stepOf(f, p, true));
  let W = pg.W, H = pg.H;
  for (let k = deg; k > 0; k -= 90) { if (f.marks[p] && f.marks[p].length) turnMarks(f.marks[p], W, H, 1); [W, H] = [H, W]; }
  setRot(f, p, rotOf(f, p) + deg);
  const was = f.sc && f.sc[p]; if (was && was.didTurn && rotOf(f, p) !== was.didTurn) (was.off ||= {}).turn = 1;   // not the app's turn any more: merging another computer's copy mustn't bring it back
  selected = null; thumbCache.clear(); reshape(pg); rescanFile(f); saveSoon(); renderList();
}
// to: the page's new small turn, 0 for as scanned. Her marks and any covers she boxed go along, so they stay on the same words.
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
  selected = null; thumbCache.clear(); reshape(pg); rescanFile(f); saveSoon(); renderList();
}
// Every page but this one with lighting it switched on and could still put back.
const scanLits = rec => batch.students.flatMap(s => s.files.flatMap(f => Object.values(f.sc || {}))).filter(r => r.lit && r !== rec);
function scanLight(pg, rec) {
  const st = batch.students[cur]; if (!pg.bmp) return;
  batch.light ||= {};
  rec.lit = { had: batch.light[st.key] || null, on: lightOpts().on && !scanLits(rec).some(r => !r.lit.on) };   // Lighting was only on because of another student's page: then it was off
  batch.light[st.key] = { ...lightAuto(pg), s: lightFor(st).s || 0 };
  if (!lightOpts().on) batch.lightOpt = { ...lightOpts(), on: true };
  lightPagesChanged();
}
function scanLightBack(rec) {
  const st = batch.students[cur];
  if (rec.lit.had) batch.light[st.key] = rec.lit.had; else delete batch.light[st.key];
  if (!rec.lit.on && !scanLits(rec).length) batch.lightOpt = { ...lightOpts(), on: false };   // Lighting goes back off once no other page is using it
  delete rec.lit;
  lightPagesChanged();
}
const scanAsks = (f, p, r) => !!r.turn && !r.didTurn && rotOf(f, p) === (r.rot0 || 0);
// The strip above a page: what was done with Put back, or what might be wrong with a way to fix it. It says nothing about who the paper is from.
function scanNote(pg) {
  if (pg.snote) { pg.snote.remove(); pg.snote = null; }
  const f = pg.file, p = pg.idx, r = f.sc && f.sc[p];
  // Straightened pages can always be put back from the corner, after the strip has gone.
  const was = pg.rchip && pg.rchip.querySelector('[data-scun]'); if (was) was.remove();
  if (pg.rchip && skewOf(f, p)) pg.rchip.insertAdjacentHTML('beforeend', '<button data-scun title="Put this page back as it was scanned" aria-label="Put this page back as it was scanned">⟂</button>');
  if (!r) return;
  const off = r.off || {}, lines = [], btn = (a, t) => '<button class="link" data-sc="' + a + '">' + t + '</button>';
  if (r.re) lines.push('⚑ This page needs a rescan. You can still mark and score it.' + btn('rescan', 'Bring in the rescan…') + btn('unre', 'It’s fine now'));
  if (r.w && r.w.length && !anonOn()) lines.push('Group work: this page also went to ' + esc(r.w.join(', ')) + '. Your marks here stay on this copy.');
  if (r.typed) return scanNoteOut(pg, lines, r.re);
  const turned = !!r.didTurn && rotOf(f, p) === r.didTurn, straight = !!skewOf(f, p);
  if ((turned || straight) && !off.done) lines.push((turned && straight ? 'Turned and straightened this page.' : turned ? 'Turned this page so it reads the right way up.' : 'Straightened this page.') + btn('back', 'Put back') + btn('done', 'Looks right'));
  if (scanAsks(f, p, r) && !off.turn) lines.push((r.turn === 180 ? 'This page may be upside down.' : 'This page may be on its side.') + btn('turn', 'Turn it') + btn('noturn', 'It’s fine'));
  else if (r.side && !r.turn && rotOf(f, p) === (r.rot0 || 0) && !off.turn) lines.push('This page may be on its side.' + btn('left', 'Turn left') + btn('right', 'Turn right') + btn('noturn', 'It’s fine'));
  if (r.skew && !r.didSkew && !straight && !off.skew) lines.push('This page looks crooked.' + btn('skew', 'Straighten') + btn('noskew', 'It’s fine'));
  if (r.blank && !off.blank && !(f.marks[p] || []).length) lines.push('This page looks blank. Arrange pages can take it out.' + btn('noblank', 'OK'));
  const live = lightLive(batch.students[cur]);
  if (r.lit && !live) delete r.lit;   // she switched it off herself
  if (r.lit) lines.push('Lighting is on for this student.' + btn('unlit', 'Put back') + btn('lit', 'Looks right'));
  else if (r.faint && !off.faint && !live) lines.push('This page looks faint.' + btn('light', 'Fix the lighting') + btn('nofaint', 'It’s fine'));
  scanNoteOut(pg, lines, r.re);
}
function scanNoteOut(pg, lines, re) {
  if (!lines.length) return;
  const el = document.createElement('div'); el.className = 'scnote' + (re ? ' re' : ''); el.innerHTML = lines.map(t => '<div>' + t + '</div>').join('');
  pg.wrap.before(el); pg.snote = el;
}
// ⚑ in a page's corner: flag it for a rescan, or take the flag off.
function scanFlag(pg) {
  const f = pg.file; if (f.virtual) return;
  const r = (f.sc ||= {})[pg.idx] ||= { later: 1 };
  if (r.re) delete r.re; else r.re = 1;
  toast(r.re ? 'Flagged for a rescan. The Return tab lists everyone waiting.' : 'Rescan flag taken off');
  saveSoon(); scanNote(pg); renderList();
}
// Every page waiting on a rescan: [{ i, st, f, p }], in list order.
const scanRescans = () => batch ? batch.students.flatMap((st, i) => st.files.flatMap(f => Object.entries(f.sc || {}).filter(([, r]) => r.re).map(([p]) => ({ i, st, f, p: +p })))) : [];
function openRescans() {
  const all = scanRescans(), by = new Map();
  for (const x of all) { if (!by.has(x.i)) by.set(x.i, []); by.get(x.i).push(x); }
  const order = [...by.keys()].sort((a, b) => anonOn() ? anonPos(a) - anonPos(b) : a - b);
  const line = i => shownName(batch.students[i], i) + ': ' + by.get(i).map(x => 'page ' + (x.p + 1) + ' of ' + fileShown(x.st, x.f.name)).join(', ');
  openDlg('<div class="bh"><h2>Rescans' + (all.length ? ' (' + by.size + ')' : '') + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb">' + (all.length ? '<p class="muted" style="margin:0 0 10px;font-size:14px">Pages you flagged as needing a rescan. Click a name to go to that paper. When the rescan comes in, add it to the student or split it in with Bring in files, then press It’s fine now on the old page.</p>' +
      order.map(i => '<button class="mvrow" data-rsgo="' + i + '">' + esc(shownName(batch.students[i], i)) + '<span class="muted">' + by.get(i).map(x => 'p. ' + (x.p + 1)).join(', ') + '</span></button>').join('')
      : '<p class="muted" style="margin:0">No pages are waiting on a rescan. Flag one with ⚑ Needs rescan in the split, or ⚑ in a page’s corner.</p>') + '</div>' +
    '<div class="bf">' + (all.length ? '<button class="btn" data-rscopy style="margin-right:auto">Copy the list</button>' : '') + '<button class="btn" data-cancel>Close</button></div>', true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-rscopy]')) return copy(order.map(line).join('\n'), 'Copied the list');
    const g = e.target.closest('[data-rsgo]'); if (g) { toPaper(+g.dataset.rsgo); }
  };
}
$('#paper').addEventListener('click', e => {
  const un = e.target.closest('[data-scun]');
  if (un) { const pg = pages.find(q => q.rchip === un.parentNode); if (pg) { const r = pg.file.sc && pg.file.sc[pg.idx]; if (r) (r.off ||= {}).skew = 1; scanStraighten(pg, 0); } return; }
  const b = e.target.closest('[data-sc]'); if (!b) return;
  const pg = pages.find(q => q.snote && q.snote.contains(b)); if (!pg) return;
  const f = pg.file, p = pg.idx, r = f.sc[p], off = r.off ||= {}, a = b.dataset.sc;
  if (a === 'back') { if (r.didTurn && rotOf(f, p) === r.didTurn) { off.turn = 1; scanTurn(pg, (360 - r.didTurn) % 360); } if (skewOf(f, p)) { off.skew = 1; scanStraighten(pg, 0); } }
  else if (a === 'done') off.done = 1;
  else if (a === 'turn') scanTurn(pg, r.turn);
  else if (a === 'left') scanTurn(pg, 270);
  else if (a === 'right') scanTurn(pg, 90);
  else if (a === 'skew') scanStraighten(pg, r.skew);
  else if (a === 'light') scanLight(pg, r);
  else if (a === 'unlit') { off.faint = 1; scanLightBack(r); }
  else if (a === 'unre') { delete r.re; renderList(); }
  else if (a === 'rescan') { pickAdd(batch.students[cur]); return; }
  else if (a === 'lit') { delete r.lit; off.faint = 1; for (const o of scanLits(r)) o.lit.on = true; }   // she wants Lighting on now, whichever page goes back
  else off[a.slice(2)] = 1;   // noturn, noskew, noblank, nofaint
  saveSoon();
  for (const q of pages) if (q.file === f || a === 'light' || a === 'unlit') scanNote(q);
});

/* ---------------- in the split ---------------- */
const spView = (me, i, page, scale) => page.getViewport({ scale, rotation: ((page.rotate || 0) + (me.rot[i] || 0)) % 360 });
const spXf = (me, i, vp) => skewXf({ skew: me.skew }, i, vp);
async function scanSplitLook(me, i, page) {
  if (me.sc[i]) return;
  let rec;
  try { rec = await scanLook(page, 0); } catch (e) { rec = { typed: 1 }; }
  me.sc[i] = rec;
  if (rec.sure === 2 && rec.turn) { me.rot[i] = rec.turn; rec.didTurn = rec.turn; }
  if (rec.skewSure === 2) { me.skew[i] = rec.skew; rec.didSkew = rec.skew; }
  const el = SP === me && document.querySelector('#spPages [data-fl="' + i + '"]'); if (el) el.innerHTML = scanCard(i);
}
// The tags on one page in the split: what was done, with a way back, or what to look at.
function scanCard(i) {
  const r = SP.sc[i], out = [];
  if (SP.re.has(i)) out.push('<button class="spre" data-spfix="unre" title="Take the rescan flag off">⚑ Needs rescan</button>');
  if (spLight(SP, i)) out.push('<span title="Lighting is on for this page. The scan itself isn’t changed.">☀ Lighting</span>');
  if (!r) return out.join('');
  const off = r.off || {}, turned = !!r.didTurn && SP.rot[i] === r.didTurn, straight = !!SP.skew[i];
  if (turned || straight) out.push('<button data-spfix="back" title="Put this page back as it was scanned">' + (turned && straight ? 'Turned, straightened' : turned ? 'Turned' : 'Straightened') + ' · put back</button>');
  if (r.turn && !r.didTurn && !SP.rot[i] && !off.turn) out.push('<button data-spfix="turn">' + (r.turn === 180 ? 'Upside down?' : 'On its side?') + ' Turn it</button>');
  else if (r.side && !r.turn && !SP.rot[i] && !off.turn) out.push('<button data-spfix="right">On its side? Turn it</button>');
  if (r.skew && !r.didSkew && !straight && !off.skew) out.push('<button data-spfix="skew">Crooked? Straighten</button>');
  if (r.blank) out.push('<span title="Leave out blank pages shows you these first, and you can bring any of them back">Looks blank</span>');
  if (r.faint) out.push('<span title="' + (r.soft ? 'Very faint: it may be writing, or the back of the page showing through. Leave out blank pages keeps it, so have a look and leave it out yourself if nothing’s there' : 'Once it’s open for grading, the page offers to fix the lighting') + '">Faint</span>');
  return out.join('');
}
// For checking a page that may be blank: the paper stays white and anything darker than it is pushed much darker, so writing too faint to see on screen shows up. Only the picture changes.
// A scan can be lit unevenly, so the paper's tone is taken patch by patch (the middle tone of each, since writing doesn't fill a patch) and blended across the page. That way a shadow stays white, with the writing in it still showing.
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
function scanSplitFix(i, how) {
  if (how === 'unre') { SP.re.delete(i); return splitDraw(); }
  const r = SP.sc[i] || (SP.sc[i] = { typed: 1 }), off = r.off ||= {};
  if (how === 'back') { if (r.didTurn && SP.rot[i] === r.didTurn) { delete SP.rot[i]; off.turn = 1; } if (SP.skew[i]) { delete SP.skew[i]; off.skew = 1; } }
  else if (how === 'turn') { SP.rot[i] = r.turn; r.didTurn = r.turn; }   // shows the same tag as a page turned by itself, with its way back
  else if (how === 'skew') SP.skew[i] = r.skew;
  else if (how === 'right') { const v = ((SP.rot[i] || 0) + 90) % 360; if (v) { SP.rot[i] = v; r.didTurn = v; } else delete SP.rot[i]; off.turn = 1; }
  SP.thumbs[i] = ''; splitDraw(); splitRender();
}
function scanSplitSays(me) {
  const list = Object.entries(me.sc), n = t => list.filter(([i, r]) => t(r, i, r.off || {})).length, say = (k, one, many) => k ? [k + ' ' + (k === 1 ? one : many)] : [];
  return [...say(n((r, i) => r.didTurn && me.rot[i] === r.didTurn), 'page turned', 'pages turned'), ...say(n((r, i) => r.didSkew && me.skew[i]), 'straightened', 'straightened'), ...say(n(r => r.blank), 'looks blank', 'look blank'),
    ...say(n((r, i, off) => (((r.turn && !r.didTurn) || (r.side && !r.turn)) && !me.rot[i] && !off.turn) || (r.skew && !r.didSkew && !me.skew[i] && !off.skew)), 'to check', 'to check'), ...say(n(r => r.faint), 'looks faint', 'look faint')].join(', ');
}
// What was decided in the split goes along with each student's new file, which is found again by its bytes when it opens.
const scanHints = new Map();
function scanBytes(d) { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return d.length + ':' + (h >>> 0); }
// Each student's copy has its own record, so group work's copies don't share a Put back or a flag. w: who else got the page; L: its lighting from the split.
function scanHint(me, bytes, list, nm, lit) {
  const pages = {}; list.forEach((i, j) => {
    const rec = me.sc[i] ? JSON.parse(JSON.stringify(me.sc[i])) : null, w = spWho(me, i).filter(x => x !== nm);
    pages[j] = { rec, rot: me.rot[i] || 0, skew: me.skew[i] || 0, re: me.re.has(i), w: w.length ? w : null, L: lit ? spLight(me, i) : null };
  });
  scanHints.set(scanBytes(bytes), pages);
}
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
function scanHintsAll() { if (batch) for (const st of batch.students) for (const f of st.files) if (viewable(f) && !f.virtual) scanTakeHint(f, st); scanHints.clear(); groupBandRefresh(); }

/* ---------------- lighting in the split: only how the pages look there and in the big view ---------------- */
const spLight = (me, i) => { const L = me.Lp[i] || me.L; return lightOn(L) ? L : null; };
function spLightOpen() {
  const old = $('#spLightP'); if (old) return spLightClose();
  const v = document.createElement('div'); v.id = 'spLightP'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Lighting for this scan');
  const box = $('#dlgBox'), b = $('#spLight'), r = b.getBoundingClientRect(), o = box.getBoundingClientRect();
  v.style.left = Math.max(8, r.left - o.left) + 'px'; v.style.top = (r.bottom - o.top + 6) + 'px';
  box.appendChild(v); b.setAttribute('aria-pressed', 'true');
  SP.Lsel ??= SP.sel.size ? 'sel' : 'all';
  const esc1 = e => { if (e.key === 'Escape' && !$('#spBig')) { e.preventDefault(); e.stopPropagation(); spLightClose(); } };
  window.addEventListener('keydown', esc1, { capture: true, signal: dlgOff.signal }); v._esc = esc1;
  v.oninput = e => { const k = e.target.dataset.spl; if (!k) return; e.target.nextElementSibling.textContent = e.target.value; spLightSet({ ...spLightNow(), [k]: +e.target.value }); };
  v.onchange = e => { if (e.target.dataset.splg != null) spLightSet({ ...spLightNow(), g: e.target.checked ? 1 : 0 }); if (e.target.dataset.splkeep != null) SP.keepL = e.target.checked; };
  spLightDraw();
}
function spLightClose() { const v = $('#spLightP'); if (!v) return; window.removeEventListener('keydown', v._esc, true); v.remove(); const b = $('#spLight'); if (b) b.setAttribute('aria-pressed', 'false'); }
// The setting the sliders show: the whole scan's, or the first picked page's.
function spLightNow() {
  if (SP.Lsel === 'sel') { const p = [...SP.sel].sort((a, b) => a - b)[0]; return { ...LIGHT0, ...((p != null && SP.Lp[p]) || SP.L || {}) }; }
  return { ...LIGHT0, ...(SP.L || {}) };
}
function spLightDraw() {
  const v = $('#spLightP'); if (!v) return;
  const L = spLightNow(), n = SP.sel.size;
  const row = (k, label, min, max) => '<label><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" data-spl="' + k + '" value="' + (L[k] || 0) + '"><b>' + (L[k] || 0) + '</b></label>';
  v.innerHTML = '<div class="lph"><b>Lighting</b><span style="flex:1"></span><button class="btn sm" data-splauto>Auto fix</button><button class="icon" data-splx aria-label="Close" style="margin-left:6px">✕</button></div>' +
    '<span class="seg" style="width:100%"><button data-spls="all" aria-pressed="' + (SP.Lsel === 'all') + '" style="flex:1">Whole scan</button><button data-spls="sel" aria-pressed="' + (SP.Lsel === 'sel') + '" style="flex:1"' + (n ? '' : ' disabled') + '>Picked pages' + (n ? ' (' + n + ')' : '') + '</button></span>' +
    row('b', 'Brightness', -60, 60) + row('c', 'Contrast', 0, 400) + row('d', 'Darken writing', 0, 100) + row('s', 'Sharpen', 0, 100) +
    '<label class="lpchk"><input type="checkbox" data-splg' + (L.g ? ' checked' : '') + '> Black and white</label>' +
    '<div class="muted" style="font-size:12px">Changes how the pages look here and in the big view. The scan itself isn’t changed.</div>' +
    '<label class="lpchk"><input type="checkbox" data-splkeep' + (SP.keepL ? ' checked' : '') + '> Keep it for grading: students who get these pages open with the same lighting</label>' +
    '<div><button class="link" data-splreset>Back to normal</button></div>';
}
function spLightSet(L) {
  const on = lightOn(L) ? L : null, list = [];
  if (SP.Lsel === 'sel' && SP.sel.size) for (const p of SP.sel) { if (on) SP.Lp[p] = on; else delete SP.Lp[p]; list.push(p); }
  else { SP.L = on; for (let i = 0; i < SP.n; i++) if (!SP.Lp[i]) list.push(i); }
  spRelight(list);
}
function spLightClick(ev) {
  const t = ev.target;
  if (t.closest('[data-splx]')) return spLightClose();
  const sc = t.closest('[data-spls]'); if (sc && !sc.disabled) { SP.Lsel = sc.dataset.spls; return spLightDraw(); }
  if (t.closest('[data-splreset]')) { if (SP.Lsel === 'sel') spLightSet(LIGHT0); else { const all = [...Array(SP.n).keys()]; SP.L = null; SP.Lp = {}; spRelight(all); } return spLightDraw(); }
  if (t.closest('[data-splauto]')) {
    const p = SP.Lsel === 'sel' && SP.sel.size ? Math.min(...SP.sel) : SP.raw.findIndex(Boolean);
    if (p < 0 || !SP.raw[p]) return toast('Still reading the pages, try again in a moment');
    const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); const L = spLightNow(); spLightSet({ ...L, ...lightAuto({ bmp: c }) }); spLightDraw(); }; im.src = SP.raw[p];
  }
}
// Redraws the thumbnails from the page as it was read, a few at a time, so the sliders stay quick.
let spLitRun = 0;
function spRelight(list) {
  const me = SP, run = ++spLitRun;
  clearTimeout(me.litT); me.litT = setTimeout(async () => {
    for (const i of list) {
      if (SP !== me || run !== spLitRun) return;
      if (!me.raw[i]) continue;
      const L = spLight(me, i);
      if (L) {
        const im = new Image(); im.src = me.raw[i]; await im.decode().catch(() => {});
        if (SP !== me || run !== spLitRun) return;
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); lightCanvas(x, c.width, c.height, L);
        me.thumbs[i] = c.toDataURL('image/jpeg', .78); c.width = c.height = 0;
      } else me.thumbs[i] = me.raw[i];
      const el = document.querySelector('#spPages img[data-th="' + i + '"]'); if (el) el.src = me.thumbs[i];
      const fl = document.querySelector('#spPages [data-fl="' + i + '"]'); if (fl) fl.innerHTML = scanCard(i);
    }
  }, 120);
}
Object.assign(window.__gs, { spLight, scanRescans, lightCanvas, scanRead, scanLook, skewOf, setSkew, scanStraighten, scanTurn, scanNote, skewMarks, scanDarken });
