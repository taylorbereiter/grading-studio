/* ---------------- A QR code, made here: nothing is fetched and no outside service sees the address ----------------
   Byte mode, error correction level M, sizes 1 to 6 (up to about 100 letters, plenty for a web address). qrMatrix(text) gives rows of
   true (dark) and false, or null if the text is too long; qrSvg(text) draws it. The steps are the ones in the QR standard (ISO 18004). */
const QR_M = [null, [16, 1, 10], [28, 1, 16], [44, 1, 26], [32, 2, 18], [43, 2, 24], [27, 4, 16]];   // data codewords per block, blocks, error codewords per block
const QR_ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1; while (ver <= 6 && QR_M[ver][0] * QR_M[ver][1] < bytes.length + 2) ver++;
  if (ver > 6) return null;
  const [per, blocks, ecn] = QR_M[ver], cap = per * blocks;
  // the data: mode 0100, the length, the bytes, an end, then the padding the standard asks for
  const bits = [], put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(bytes.length, 8); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  for (let p = 0; data.length < cap; p++) data.push(p % 2 ? 0x11 : 0xEC);
  // Reed-Solomon error correction over GF(256)
  const EXP = [], LOG = []; for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ (x & 128 ? 0x11D : 0); }
  const mul = (a, b) => a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0;
  let gen = [1]; for (let i = 0; i < ecn; i++) { const g = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { g[j] ^= c; g[j + 1] ^= mul(c, EXP[i]); }); gen = g; }
  const dataB = [], ecB = [];
  for (let b = 0; b < blocks; b++) {
    const d = data.slice(b * per, (b + 1) * per), r = d.concat(new Array(ecn).fill(0));
    for (let i = 0; i < d.length; i++) { const f = r[i]; if (f) gen.forEach((c, j) => { r[i + j] ^= mul(c, f); }); }
    dataB.push(d); ecB.push(r.slice(d.length));
  }
  const words = []; for (let i = 0; i < per; i++) for (const d of dataB) words.push(d[i]); for (let i = 0; i < ecn; i++) for (const e of ecB) words.push(e[i]);
  // the grid: finders, timing, alignment, the dark module, then the data in two-column zigzags
  const n = ver * 4 + 17, m = [...Array(n)].map(() => new Array(n).fill(null)), fixed = (r, c, v) => { if (r >= 0 && r < n && c >= 0 && c < n) m[r][c] = v; };
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) fixed(r0 + r, c0 + c, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)));
  for (let i = 8; i < n - 8; i++) { fixed(6, i, i % 2 === 0); fixed(i, 6, i % 2 === 0); }
  for (const r of QR_ALIGN[ver]) for (const c of QR_ALIGN[ver]) if (m[r][c] === null) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) fixed(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  fixed(n - 8, 8, true);
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) m[8][i] = false; if (m[i][8] === null) m[i][8] = false; }   // kept for the format bits
  for (let i = 0; i < 8; i++) { m[8][n - 1 - i] = false; m[n - 1 - i][8] = false; }
  m[n - 8][8] = true;
  const free = m.map(row => row.map(v => v === null));
  const stream = []; for (const w of words) for (let i = 7; i >= 0; i--) stream.push((w >>> i) & 1);
  let k = 0;
  for (let c = n - 1, up = true; c > 0; c -= 2, up = !up) {
    if (c === 6) c--;
    for (let i = 0; i < n; i++) { const r = up ? n - 1 - i : i; for (const cc of [c, c - 1]) if (free[r][cc]) m[r][cc] = !!stream[k++]; }
  }
  // the mask that leaves the fewest look-alike patterns, and the format bits that name it
  const MASKS = [(r, c) => (r + c) % 2 === 0, r => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0, (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];
  const withMask = mk => {
    const g = m.map((row, r) => row.map((v, c) => free[r][c] && MASKS[mk](r, c) ? !v : v));
    let f = (0 << 3) | mk, e = f << 10; for (let i = 14; i >= 10; i--) if ((e >>> i) & 1) e ^= 0x537 << (i - 10);
    const fmt = ((f << 10) | e) ^ 0x5412, bit = i => !!((fmt >>> i) & 1);
    for (let i = 0; i <= 5; i++) g[8][i] = bit(14 - i);
    g[8][7] = bit(8); g[8][8] = bit(7); g[7][8] = bit(6);
    for (let i = 9; i <= 14; i++) g[14 - i][8] = bit(14 - i);
    for (let i = 0; i <= 6; i++) g[n - 1 - i][8] = bit(14 - i);
    for (let i = 0; i <= 7; i++) g[8][n - 8 + i] = bit(7 - i);
    return g;
  };
  const score = g => {
    let s = 0, dark = 0;
    for (let a = 0; a < 2; a++) for (let i = 0; i < n; i++) { let run = 1; for (let j = 1; j < n; j++) { const v = a ? g[j][i] : g[i][j], p = a ? g[j - 1][i] : g[i][j - 1]; if (v === p) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) s += 3;
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = pat.slice().reverse();
    for (let a = 0; a < 2; a++) for (let i = 0; i < n; i++) for (let j = 0; j <= n - 11; j++) for (const p of [pat, rev]) if (p.every((b, x) => (a ? g[j + x][i] : g[i][j + x]) === !!b)) s += 40;
    for (const row of g) for (const v of row) if (v) dark++;
    return s + Math.floor(Math.abs(dark * 20 / (n * n) - 10)) * 10;
  };
  let best = null, bestS = Infinity;
  for (let mk = 0; mk < 8; mk++) { const g = withMask(mk), s = score(g); if (s < bestS) { best = g; bestS = s; } }
  return best;
}
// Black squares on white with a quiet border, sharp at any size.
function qrSvg(text, label) {
  const g = qrMatrix(text); if (!g) return '';
  const n = g.length, q = 4; let d = '';
  g.forEach((row, r) => row.forEach((v, c) => { if (v) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z'; }));
  return '<svg class="qr" viewBox="0 0 ' + (n + 2 * q) + ' ' + (n + 2 * q) + '" role="img" aria-label="' + esc(label || text) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#FFFFFF"/><path d="' + d + '" fill="#000000"/></svg>';
}
