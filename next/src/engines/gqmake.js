// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, pages, tr, fmtNum } from './gcore.js';
import { one } from './gdraw.js';
import { pv } from './gopen.js';
import { r1, me } from './gmark.js';
import { esc, num } from './gexport.js';
import { uid } from './gmedia.js';
import { qzSteps, quizPages, qzPage } from './gquiz.js';

// src/merge.js
const normName = s => String(s || '').replace(/\s+/g, '').toLowerCase();
// src/quizmake.js
const QMK_T = { mc: 'Multiple choice', tf: 'True or false', ms: 'Pick all that apply', sa: 'Short answer' };
// src/quizmake.js
const QMK_L = 'ABCDEFGH';
// src/quizmake.js
const qmkNew = t => ({ id: 'mq' + uid(), ...qmkNew0(t) });
// src/quizmake.js
const qmkNew0 = t => t === 'tf' ? { t, text: '', opts: ['True', 'False'], key: '', pts: 1 } : t === 'sa' ? { t, text: '', opts: [], key: '', pts: 2, lines: 3 } : { t, text: '', opts: ['', '', '', ''], key: '', pts: 1 };
// src/quizmake.js
const qmkPts = m => m.items.reduce((a, q) => a + (+q.pts || 0), 0);
// src/quizmake.js
const qmkLetters = q => q.t === 'tf' ? ['T', 'F'] : q.t === 'sa' ? qzSteps(+q.pts || 1).map(fmtNum) : q.opts.map((_, k) => QMK_L[k]);
// src/quizmake.js
const QMK_CSS = '.qfpage,.qfpage *{box-sizing:border-box}.qfpage :where(ol,ul,li,p,div,span,b,i){margin:0;padding:0;letter-spacing:normal;text-transform:none}.qfpage{position:relative;width:816px;height:1056px;background:#fff;color:#111;font:14px/1.4 Inter,Arial,sans-serif;box-sizing:border-box;padding:96px 76px 64px;box-shadow:0 1px 3px rgba(0,0,0,.18);overflow:hidden}.qfreg{position:absolute;width:19px;height:19px;background:#000}.qfreg.tl{left:53px;top:53px}.qfreg.tr{right:53px;top:53px}.qfreg.bl{left:53px;bottom:53px}.qfreg.br{right:53px;bottom:53px}.qfcode{position:absolute;top:56px;left:50%;transform:translateX(-50%);display:flex;gap:4px}.qfcode i{width:12px;height:12px;border:1px solid #000;box-sizing:border-box}.qfcode i.on{background:#000}.qfhead{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;border-bottom:2px solid #111;padding-bottom:8px}.qfhead.sm{font-size:12px;color:#444;border-bottom-width:1px;padding-bottom:4px}.qftitle{font-size:22px;font-weight:700}.qfsub{font-size:12px;color:#555}.qfname{display:flex;gap:8px;align-items:baseline;min-width:260px}.qfname span{font-size:12px;color:#555}.qfname b{flex:1;border-bottom:1px solid #111;font-size:16px;padding:0 4px 2px;min-height:22px}.qfhow{font-size:11.5px;color:#444;margin:8px 0 4px}.qfbody{display:flex;flex-direction:column;gap:10px;margin-top:10px}.qfq{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:start;padding:6px 6px;border-radius:6px}.qfq.sheet{grid-template-columns:26px auto;padding:2px 6px}.qfq.on{background:#EAF2FA}.qfn{font-weight:700;font-size:15px;padding-top:4px}.qftx{padding-top:4px}.qfops{list-style:none;margin:4px 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:13px}.qfops b{font-weight:600;margin-right:4px}.qfhint{font-size:11.5px;color:#555;font-style:italic;margin-top:2px}.qflines{display:flex;flex-direction:column;gap:0;margin-top:4px}.qflines span{height:26px;border-bottom:1px solid #999}.qfbs{display:flex;gap:8px;align-items:center;padding:2px 0}.qfbs.sa{border:1px dashed #888;border-radius:6px;padding:4px 8px}.qffor{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.06em;margin-right:2px}.qfb{width:26px;height:26px;border:1.5px solid #222;border-radius:50%;display:grid;place-items:center;font:600 11px Inter,Arial,sans-serif;font-style:normal;color:#444;box-sizing:border-box}.qfb.key{background:#1E8A4C;border-color:#1E8A4C;color:#fff}.qfb.f{background:radial-gradient(circle at 45% 40%,#333 0 55%,#4a4a4a 75%,transparent 82%);color:transparent}.qfb.faint{background:radial-gradient(circle at 50% 50%,#c9c9c9 0 60%,transparent 80%);color:#888}.qfb.x{background:linear-gradient(45deg,transparent 44%,#333 45% 55%,transparent 56%),linear-gradient(-45deg,transparent 44%,#333 45% 55%,transparent 56%)}.qffoot{position:absolute;bottom:58px;left:0;right:0;text-align:center;font-size:11px;color:#666}.qfq.sheet .qfbs{justify-self:start}.qfname b{white-space:nowrap;overflow:hidden;text-overflow:clip}';
// src/quizmake.js
function qmkBits(id, who, pg, ver = 0) {
  const b = [], put = (v, n) => { for (let k = n - 1; k >= 0; k--) b.push((v >> k) & 1); };
  put(id, 8); put(who, 8); put(pg, 3); put(ver % 4, 2); put((id + who + pg + ver % 4) % 31, 5);
  return [1, 0, ...b];
}
// src/quizmake.js
function qmkQ(q, i, m) {
  const L = qmkLetters(q), on = k => q.t === 'sa' ? false : (q.key || '').includes(L[k]);
  const bub = L.map((l, k) => '<i class="qfb' + (m.show && on(k) ? ' key' : '') + (m.fill && m.fill[i] && m.fill[i][k] ? ' ' + m.fill[i][k] : '') + '">' + l + '</i>').join('');
  const words = m.sheet ? '' : '<div class="qftx">' + esc(q.text || (q.t === 'sa' ? 'Your question' : 'Your question')) +
    (q.t === 'mc' || q.t === 'ms' ? '<ol class="qfops">' + q.opts.map((o, k) => '<li><b>' + QMK_L[k] + '</b> ' + esc(o || '…') + '</li>').join('') + '</ol>' : '') +
    (q.t === 'ms' ? '<div class="qfhint">Fill every answer that applies.</div>' : '') +
    (q.t === 'sa' ? '<div class="qflines">' + '<span></span>'.repeat(q.lines || 3) + '</div>' : '') + '</div>';
  return '<div class="qfq' + (m.sheet ? ' sheet' : '') + '" data-i="' + i + '"><span class="qfn">' + (i + 1) + '</span>' + words +
    '<div class="qfbs' + (q.t === 'sa' ? ' sa' : '') + '">' + (q.t === 'sa' ? '<span class="qffor">Teacher</span>' : '') + bub + '</div></div>';
}
// src/quizmake.js
function qmkPageHtml(m, title, name, pg, of, qs, from, who = 0) {
  const bits = qmkBits(m.id || 1, who, pg, m.ver || 0).map(b => '<i' + (b ? ' class="on"' : '') + '></i>').join('');
  return '<div class="qfpage"><i class="qfreg tl"></i><i class="qfreg tr"></i><i class="qfreg bl"></i><i class="qfreg br"></i><div class="qfcode">' + bits + '</div>' +
    (pg === 0 ? '<div class="qfhead"><div><div class="qftitle" data-raw>' + esc(title) + '</div><div class="qfsub">' + m.items.length + ' questions · ' + fmtNum(qmkPts(m)) + ' points</div></div>' +
      '<div class="qfname"><span>Name</span><b data-raw>' + esc(name || '') + '</b></div></div>' +
      '<p class="qfhow">Fill each bubble completely with a dark pencil or pen. To change an answer, erase it fully or cross it out and fill the new one.</p>'
      : '<div class="qfhead sm"><span data-raw>' + esc(title) + '</span><span data-raw>' + esc(name || '') + '</span></div>') +
    '<div class="qfbody">' + qs.map((q, k) => qmkQ(q, from + k, m)).join('') + '</div><div class="qffoot">Page ' + (pg + 1) + ' of ' + of + '</div></div>';
}
// src/quizmake.js
function qmkPages(m, title, name, who = 0) {
  const probe = document.createElement('div'); probe.className = 'qfprobe'; document.body.appendChild(probe);
  probe.innerHTML = qmkPageHtml(m, title, name, 0, 1, m.items, 0);
  const body = probe.querySelector('.qfbody'), room0 = 1056 - 64 - body.offsetTop, room = room0 + (body.offsetTop - 120);
  const hs = [...body.children].map(e => e.offsetHeight + 10);
  probe.remove();
  const pages = []; let cur = [], used = 0, at = 0;
  hs.forEach((h, i) => { const lim = pages.length ? room : room0; if (cur.length && used + h > lim) { pages.push([at, cur]); at = i; cur = []; used = 0; } cur.push(m.items[i]); used += h; });
  pages.push([at, cur]);
  return pages.map(([from, qs], pg) => qmkPageHtml(m, title, name, pg, pages.length, qs, from, who));
}
// src/quizmake.js
function qmkLayout(m, title) {
  const probe = document.createElement('div'); probe.className = 'qfprobe'; document.body.appendChild(probe);
  probe.innerHTML = qmkPages(m, title, 'Name').join('');
  const out = [], R = v => Math.round(v * 10000) / 10000;
  [...probe.querySelectorAll('.qfpage')].forEach((pg, n) => {
    const P = pg.getBoundingClientRect(), sx = v => R((v - P.left) / P.width), sy = v => R((v - P.top) / P.height);
    for (const el of pg.querySelectorAll('.qfq')) {
      const r = el.getBoundingClientRect(), bs = [...el.querySelectorAll('.qfb')].map(b => b.getBoundingClientRect());
      out[+el.dataset.i] = { n, x: sx(r.left), y: sy(r.top), w: R(r.width / P.width), h: R(r.height / P.height), b: bs.map(b => [sx(b.left + b.width / 2), sy(b.top + b.height / 2)]), r: R(bs[0].width / 2 / P.width) };
    }
  });
  probe.remove();
  return out;
}
// src/quizmake.js
function qmkBoxes(m, title, was) {
  const L = qmkLayout(m, title), Q = JSON.parse(JSON.stringify(was || {}));
  // Copies already printed keep their bubbles where they were: a change that moves any gives the next printing a new number,
  // and pages from the old one are left for her to mark.
  const lay = JSON.stringify(L.map(a => [a.n, a.b]));
  m.ver = m.lay == null || m.lay === lay ? m.pv || 0 : (m.pv || 0) + 1;
  const old = new Map((Q.qs || []).map(q => [q.id, q]));
  Q.qs = m.items.map((it, i) => {
    const o = old.get(it.id) || {}, at = L[i], letters = qmkLetters(it);
    const key = it.t === 'sa' ? (o.key || '') : it.t === 'ms' ? it.key.split('').join(', ') : it.t === 'tf' ? (it.key === 'T' ? 'True' : it.key === 'F' ? 'False' : '') : it.key ? it.key + ': ' + (it.opts[letters.indexOf(it.key)] || '') : '';
    const q = { ...o, id: it.id, lab: String(i + 1), n: at.n, x: at.x, y: at.y, w: at.w, h: at.h, pts: +it.pts || 1, key: key.replace(/: $/, ''), kind: it.t === 'sa' ? 'scale' : 'rw', how: o.how || 'cx', auto: { t: it.t, b: at.b, r: at.r, key: it.t === 'sa' ? '' : it.key || '' } };
    if (o.n !== at.n || Math.abs((o.x || 0) - at.x) > .002 || Math.abs((o.y || 0) - at.y) > .002) { delete q.mx; delete q.my; delete q.nx; delete q.ny; }
    return q;
  });
  Q.how ||= 'cx'; Q.side ||= 'right'; Q.ans ||= 'miss'; Q.at ||= 'right'; Q.shift ||= {};
  return Q;
}
// src/quizread.js
const QR_REG = [[62.5, 62.5], [753.5, 62.5], [753.5, 993.5], [62.5, 993.5]];   // the squares' centres: top left, top right, bottom right, bottom left
// src/quizread.js
function qrGrey(c) {
  const W = c.width, H = c.height, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, g = new Uint8Array(W * H), hist = new Uint32Array(256);
  for (let i = 0; i < W * H; i++) { const v = (d[4 * i] * 77 + d[4 * i + 1] * 150 + d[4 * i + 2] * 29) >> 8; g[i] = v; hist[v]++; }
  let k = 0, P = 255; for (let v = 0; v < 256; v++) { k += hist[v]; if (k >= W * H * .9) { P = v; break; } }   // the paper: lighter than nearly everything
  return { g, W, H, P: Math.max(P, 60) };
}
// src/quizread.js
function qrFind(im) {
  const { g, W, H, P } = im, cut = Math.min(140, P * .6), I = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += g[y * W + x] < cut ? 1 : 0; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
  const sum = (x0, y0, x1, y1) => { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1); return x1 <= x0 || y1 <= y0 ? 0 : I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]; };
  const s = Math.min(W, H) / 816, a = 19 * s, reach = Math.round(.2 * Math.min(W, H));
  const corner = (cx, cy) => {
    let best = null;
    for (const k of [.88, 1, 1.12]) {
      const b = Math.max(4, Math.round(a * k)), m = Math.max(2, Math.round(b / 3)), ringA = (b + 2 * m) ** 2 - b * b;
      const xs = cx ? W - reach : 0, ys = cy ? H - reach : 0;
      for (let y = ys; y + b <= ys + reach; y++) for (let x = xs; x + b <= xs + reach; x++) {
        const inn = sum(x, y, x + b, y + b); if (inn < b * b * .8) continue;
        const ring = sum(x - m, y - m, x + b + m, y + b + m) - inn; if (ring > ringA * .2) continue;
        const score = inn / (b * b) - 2 * ring / ringA;
        if (!best || score > best.score) best = { score, x, y, b };
      }
    }
    if (!best) return null;
    let n = 0, sx = 0, sy = 0; const { x, y, b } = best;
    for (let v = Math.max(0, y - 3); v < Math.min(H, y + b + 3); v++) for (let u = Math.max(0, x - 3); u < Math.min(W, x + b + 3); u++) if (g[v * W + u] < cut) { n++; sx += u; sy += v; }
    return n ? [sx / n + .5, sy / n + .5] : null;
  };
  const p = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)], miss = p.filter(x => !x).length;
  if (miss > 1) return null;
  if (miss === 1) { const k = p.findIndex(x => !x), A = p[(k + 3) % 4], B = p[(k + 1) % 4], C = p[(k + 2) % 4]; p[k] = [A[0] + B[0] - C[0], A[1] + B[1] - C[1]]; }
  const d = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]), top = d(p[0], p[1]), bot = d(p[3], p[2]), lef = d(p[0], p[3]), rig = d(p[1], p[2]);
  if (Math.abs(top - bot) > .04 * top || Math.abs(lef - rig) > .04 * lef) return null;
  const ar = top / lef, want = 691 / 931;
  if (Math.abs(ar - want) > .06 * want && Math.abs(ar - 1 / want) > .06 / want) return null;
  return { p, weak: miss === 1 };
}
// src/quizread.js
function qrH(src, dst) {
  const A = [];
  for (let k = 0; k < 4; k++) { const [x, y] = src[k], [u, v] = dst[k]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]); }
  for (let c = 0; c < 8; c++) {
    let r = c; for (let i = c + 1; i < 8; i++) if (Math.abs(A[i][c]) > Math.abs(A[r][c])) r = i;
    [A[c], A[r]] = [A[r], A[c]]; const pv = A[c][c]; if (Math.abs(pv) < 1e-12) return null;
    for (let j = c; j < 9; j++) A[c][j] /= pv;
    for (let i = 0; i < 8; i++) if (i !== c && A[i][c]) { const f = A[i][c]; for (let j = c; j < 9; j++) A[i][j] -= f * A[c][j]; }
  }
  const h = A.map(r => r[8]);
  return (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}
// src/quizread.js
function qrMean(im, x, y, r) {
  const { g, W, H } = im; let n = 0, t = 0, r2 = r * r;
  for (let v = Math.max(0, Math.floor(y - r)); v <= Math.min(H - 1, Math.ceil(y + r)); v++) for (let u = Math.max(0, Math.floor(x - r)); u <= Math.min(W - 1, Math.ceil(x + r)); u++) if ((u - x) ** 2 + (v - y) ** 2 <= r2) { n++; t += g[v * W + u]; }
  return n ? t / n : 255;
}
// src/quizread.js
function qrRing(im, x, y, r0, r1) {
  const { g, W, H, P } = im, cut = P * .6; let n = 0, k = 0;
  for (let v = Math.max(0, Math.floor(y - r1)); v <= Math.min(H - 1, Math.ceil(y + r1)); v++) for (let u = Math.max(0, Math.floor(x - r1)); u <= Math.min(W - 1, Math.ceil(x + r1)); u++) { const d2 = (u - x) ** 2 + (v - y) ** 2; if (d2 < r0 * r0 || d2 > r1 * r1) continue; n++; if (g[v * W + u] < cut) k++; }
  return n ? k / n : 0;
}
// src/quizread.js
function qrCode(im, found) {
  for (const t of [0, 2, 1, 3]) {
    const dst = [0, 1, 2, 3].map(k => found.p[(k + t) % 4]), map = qrH(QR_REG, dst); if (!map) continue;
    const a = map(...QR_REG[0]), b = map(...QR_REG[1]), s = Math.hypot(a[0] - b[0], a[1] - b[1]) / 691;
    const cell = k => qrMean(im, ...map(192 + 16 * k, 62), 3 * s), B = cell(0), Wt = cell(1);
    if (Wt - B < 40) continue;
    const bits = []; for (let k = 2; k < 28; k++) bits.push(cell(k) < (B + Wt) / 2 ? 1 : 0);
    const num = (i, n) => bits.slice(i, i + n).reduce((v, x) => v * 2 + x, 0);
    const id = num(0, 8), who = num(8, 8), pg = num(16, 3), ver = num(19, 2), chk = num(21, 5);
    if ((id + who + pg + ver) % 31 === chk) return { id, who, pg, ver, map, s, turn: t };
  }
  return null;
}
// src/quizread.js
async function qrPageCode(page, wide = 900) {
  const v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: wide / Math.min(v1.width, v1.height) });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const im = qrGrey(c), f = qrFind(im), code = f && qrCode(im, f);
  c.width = c.height = 0;
  return code;
}
// src/quizread.js
async function qrSplitPage(me, i, page) {
  const made = (me.asg && me.asg.quiz && me.asg.quiz.made) || (me.into && batch && batch.quiz && batch.quiz.made); if (!made || !made.names) return;
  let code = null; try { code = await qrPageCode(page); } catch { }
  if (!code || code.id !== made.id) return;
  (me.qpg ||= {})[i] = code.pg;
  me.qnew ||= 0;
  if (code.turn === 2) { me.rot[i] = 180; if (me.sc[i]) me.sc[i].didTurn = 180; } else if (!code.turn && me.sc[i] && me.sc[i].didTurn) { delete me.rot[i]; me.sc[i].didTurn = 0; }   // the code says which way is up; a page on its side is left to the usual turning
  const nm = code.who ? made.names[code.who - 1] : '';
  if (nm && !me.owner[i] && !me.skip.has(i)) {
    const own = me.names.find(x => x === nm) || me.names.find(x => normName(x) === normName(nm));
    if (own) { me.owner[i] = own; me.qnew++; }
  }
}
// src/quizread.js
function qrSplitSays(me) {
  if (!me.qpg) return '';
  const got = Object.keys(me.qpg).length, who = new Set(Object.keys(me.qpg).map(i => me.owner[i]).filter(Boolean)).size, left = Object.keys(me.qpg).filter(i => !me.owner[i]).length;
  return got + (got === 1 ? ' page' : ' pages') + ' of this quiz: ' + who + (who === 1 ? ' student' : ' students') + ' found by the code' + (left ? ', ' + left + (left === 1 ? ' page needs a name' : ' pages need a name') : '');
}
// src/quizread.js
async function qrStudent(st, Q, made) {
  const out = { b: [], pages: 0, old: 0 };
  const pages = quizPages(st);
  for (let n = 0; n < pages.length; n++) {
    let r; try { r = await qzPage(st, n, 1224); } catch { r = null; }
    if (!r) continue;
    const im = qrGrey(r.c), f = qrFind(im), code = f && qrCode(im, f);
    r.c.width = r.c.height = 0;
    if (!code || code.id !== made.id) continue;
    if (code.ver !== (made.ver || 0) % 4) { out.old++; continue; }
    out.pages++;
    // how far this scan sits from the printed page, so Quick mark's pictures of each question line up
    const [cx, cy] = code.map(408, 528), dx = Math.round((cx / im.W - .5) * 1e4) / 1e4, dy = Math.round((cy / im.H - .5) * 1e4) / 1e4;
    if (!code.turn && (Math.abs(dx) > .003 || Math.abs(dy) > .003)) ((Q.shift ||= {})[st.key] ||= {})[n] = [dx, dy];
    for (const q of Q.qs) {
      if (!q.auto || q.n !== code.pg) continue;
      const r0 = 13 * code.s;
      q.auto.b.forEach(([x, y], k) => {
        const [u, v] = code.map(x * 816, y * 1056);
        out.b.push({ q, k, d: (im.P - qrMean(im, u, v, r0 * .62)) / im.P, spill: qrRing(im, u, v, r0 * 1.2, r0 * 1.55) });
      });
    }
  }
  return out;
}
// src/quizread.js
function qrDecide(bs) {
  if (!bs.length) return [];
  const ds = bs.map(b => b.d).sort((a, b) => a - b), base = ds[Math.floor(ds.length * .25)], top = Math.max(ds[ds.length - 1], base + .35);
  // filled; middling (not sure); faint (a light mark or an erasure: it only matters where nothing else is marked); blank
  for (const b of bs) { b.n = (b.d - base) / (top - base); b.on = b.n >= .6 && b.d - base >= .18; b.mid = !b.on && b.n > .3; b.faint = !b.on && !b.mid && b.d - base >= .05; }
  const byQ = new Map(); for (const b of bs) { if (!byQ.has(b.q)) byQ.set(b.q, []); byQ.get(b.q).push(b); }
  const out = [];
  for (const [q, list] of byQ) {
    const L = qzAutoLetters(q), F = list.filter(b => b.on && b.spill <= .06), X = list.filter(b => b.on && b.spill > .06), U = list.filter(b => b.mid), Wk = list.filter(b => b.faint);
    const s = list.slice().sort((a, b) => b.d - a.d), lead = s[0].d - (s[1] ? s[1].d : base) >= .04 ? L[s[0].k] : '';
    const pts = +q.pts || 1, none = !F.length && !X.length && !U.length;
    if (q.auto.t === 'sa') {   // her score bubbles
      if (none && !Wk.length) continue;
      if (F.length === 1 && !X.length && !U.length) { out.push({ q, ans: L[F[0].k], v: qzSteps(pts)[F[0].k] }); continue; }
      out.push({ q, why: 'Score unclear', guess: lead }); continue;
    }
    if (none) { if (Wk.length) out.push({ q, why: 'Very light', guess: Wk.length === 1 ? L[Wk[0].k] : lead }); else out.push({ q, ans: '', v: 0, blank: 1 }); continue; }
    if (q.auto.t === 'ms') {
      if (U.length || X.length) { out.push({ q, why: 'Not clear', guess: F.map(b => L[b.k]).join('') }); continue; }
      const ans = F.map(b => L[b.k]).join(''); out.push({ q, ans, v: qrScoreOf(q, ans) }); continue;
    }
    if (F.length === 1 && !X.length && !U.length) { out.push({ q, ans: L[F[0].k], v: qrScoreOf(q, L[F[0].k]) }); continue; }
    if (F.length === 1) { out.push({ q, why: 'Another bubble marked', guess: L[F[0].k] }); continue; }
    out.push({ q, why: F.length + X.length > 1 ? 'Two bubbles filled' : 'Not clear', guess: F.length + X.length > 1 ? '' : lead });
  }
  return out;
}
// src/quizread.js
const qzAutoLetters = q => q.auto.t === 'tf' ? ['T', 'F'] : q.auto.t === 'sa' ? qzSteps(+q.pts || 1).map(fmtNum) : q.auto.b.map((_, k) => QMK_L[k]);
// src/quizread.js
function qrScoreOf(q, ans) {
  if (q.auto.t === 'sa') { const k = qzAutoLetters(q).indexOf(ans); return k < 0 ? null : qzSteps(+q.pts || 1)[k]; }
  const key = q.auto.key || ''; if (!key) return null;
  return ans === key ? +q.pts || 1 : 0;
}
export { QMK_T, QMK_L, qmkNew, qmkNew0, qmkPts, qmkLetters, QMK_CSS, qmkBits, qmkQ, qmkPageHtml, qmkPages, qmkLayout, qmkBoxes, QR_REG, qrGrey, qrFind, qrH, qrMean, qrRing, qrCode, qrPageCode, qrSplitPage, qrSplitSays, qrStudent, qrDecide, qzAutoLetters, qrScoreOf };
