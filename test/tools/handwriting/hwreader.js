// The handwriting reader in plain JavaScript (no libraries), for the browser or Node.
// load(arrayBuffer) -> reader; reader.read(Float32Array ink, width) -> {T, C, lp: Float32Array T*C log-probabilities}
'use strict';
function load(buf) {
  const dv = new DataView(buf);
  const hl = dv.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const base = 4 + hl;
  const layers = head.layers.map(l => {
    if (l.t === 'pool') return l;
    const O = l.shape[0], n = l.shape.slice(1).reduce((a, b) => a * b, 1);
    const q = new Int8Array(buf, base + l.off, O * n);
    const sOff = base + l.off + O * n;
    const sc = new Float32Array(buf.slice(sOff, sOff + 4 * O));
    const b = new Float32Array(buf.slice(sOff + 4 * O, sOff + 8 * O));
    const w = new Float32Array(O * n);
    for (let o = 0; o < O; o++) for (let i = 0; i < n; i++) w[o * n + i] = q[o * n + i] * sc[o];
    return { ...l, w, b, O, n };
  });
  return { syms: head.syms, H: head.H, C: head.syms.length + 1, read: (x, W) => forward(layers, x, head.H, W) };
}
function conv2d(inp, C, H, W, w, b, O) {
  const out = new Float32Array(O * H * W), HW = H * W;
  for (let o = 0; o < O; o++) {
    const ob = o * HW;
    out.fill(b[o], ob, ob + HW);
    for (let c = 0; c < C; c++) {
      const wb = (o * C + c) * 9, ib = c * HW;
      for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) {
        const wv = w[wb + ky * 3 + kx]; if (wv === 0) continue;
        const dy = ky - 1, dx = kx - 1;
        const y0 = dy < 0 ? 1 : 0, y1 = dy > 0 ? H - 1 : H, x0 = dx < 0 ? 1 : 0, x1 = dx > 0 ? W - 1 : W;
        for (let y = y0; y < y1; y++) {
          const d = ob + y * W, s = ib + (y + dy) * W + dx;
          for (let xx = x0; xx < x1; xx++) out[d + xx] += wv * inp[s + xx];
        }
      }
    }
    for (let i = ob; i < ob + HW; i++) if (out[i] < 0) out[i] = 0;
  }
  return out;
}
function pool(inp, C, H, W, kh, kw) {
  const h = Math.floor(H / kh), w = Math.floor(W / kw), out = new Float32Array(C * h * w);
  for (let c = 0; c < C; c++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = -Infinity;
    for (let a = 0; a < kh; a++) for (let b2 = 0; b2 < kw; b2++) { const v = inp[(c * H + y * kh + a) * W + x * kw + b2]; if (v > m) m = v; }
    out[(c * h + y) * w + x] = m;
  }
  return [out, h, w];
}
function conv1d(inp, C, T, w, b, O, dil, res) {
  const out = new Float32Array(O * T);
  for (let o = 0; o < O; o++) {
    const ob = o * T; out.fill(b[o], ob, ob + T);
    for (let c = 0; c < C; c++) {
      const ib = c * T, wb = (o * C + c) * 3;
      for (let k = 0; k < 3; k++) {
        const wv = w[wb + k], sh = (k - 1) * dil;
        const t0 = Math.max(0, -sh), t1 = Math.min(T, T - sh);
        for (let t = t0; t < t1; t++) out[ob + t] += wv * inp[ib + t + sh];
      }
    }
    for (let t = ob; t < ob + T; t++) { let v = out[t] < 0 ? 0 : out[t]; out[t] = res ? v + inp[t] : v; }
  }
  return out;
}
function forward(layers, x, H, W) {
  let a = x, C = 1, h = H, w = W;
  for (const l of layers) {
    if (l.t === 'c2') { a = conv2d(a, C, h, w, l.w, l.b, l.O); C = l.O; }
    else if (l.t === 'pool') { [a, h, w] = pool(a, C, h, w, l.k[0], l.k[1]); }
    else if (l.t === 'c1') {
      if (h !== 1) {   // fold height into channels: channel index = c * h + row
        const T = w, n = new Float32Array(C * h * T);
        for (let c = 0; c < C; c++) for (let r = 0; r < h; r++) n.set(a.subarray((c * h + r) * T, (c * h + r + 1) * T), (c * h + r) * T);
        a = n; C = C * h; h = 1;
      }
      a = conv1d(a, C, w, l.w, l.b, l.O, l.dil, l.res); C = l.O;
    } else if (l.t === 'out') {
      const T = w, K = l.O, lp = new Float32Array(T * K);
      for (let t = 0; t < T; t++) {
        let m = -Infinity;
        for (let k = 0; k < K; k++) {
          let s = l.b[k]; const wb = k * C;
          for (let c = 0; c < C; c++) s += l.w[wb + c] * a[c * T + t];
          lp[t * K + k] = s; if (s > m) m = s;
        }
        let z = 0; for (let k = 0; k < K; k++) z += Math.exp(lp[t * K + k] - m);
        const lz = m + Math.log(z);
        for (let k = 0; k < K; k++) lp[t * K + k] -= lz;
      }
      return { T, C: K, lp };
    }
  }
}
if (typeof module !== 'undefined') module.exports = { load };
