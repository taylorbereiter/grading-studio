/* ---------------- share with Claude: papers by code, names covered; bring Claude's feedback back ---------------- */
// The code key (which code is which student) lives only in this browser, with the rest of this download's work.
const CODE_ABC = 'ACDEFGHJKMNPQRTUVWXY34679';
function shareState() {
  if (!batch.share) batch.share = { codes: {}, boxes: {} };
  const sh = batch.share, used = new Set([...Object.values(sh.codes), ...Object.keys(sh.also || {})]);
  for (const st of batch.students) if (!sh.codes[st.key]) {
    let c; do { c = 'S-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (used.has(c));
    used.add(c); sh.codes[st.key] = c;
  }
  return sh;
}
const codeOf = st => shareState().codes[st.key];
const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scrub = (text, rx) => rx ? String(text || '').replace(rx, '[name]') : String(text || '');
const RIGHT_TO_LEFT = /[\p{Script=Arabic}\p{Script=Hebrew}]/u, RTL_STRETCH = /[\p{Script=Arabic}\p{Script=Hebrew}](?:[^\p{L}\p{N}]*[\p{Script=Arabic}\p{Script=Hebrew}])*/gu;
// How far from an item's left edge letters a to b sit. x(k) is how wide its first k letters are. pdf.js gives Hebrew and Arabic in reading order, so those letters run leftwards, and a stretch of the other direction inside them runs its own way.
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
// Covers (in page points) for one page: every name word in the page text, any Kami box whose text names them, plus her own boxes.
// Each box lies along its words, however the page or the text is turned. xf: the page's straightening, if it has one.
const textWidth = (s, font) => { measureCtx.font = '100px ' + font; return measureCtx.measureText(s).width; };
// What's written after a Name label on its line, up to the next label (Date:, Class:…): the student's name, however it's spelled, or the blank they write it on.
// A long run of words after it is a sentence (Name three causes…), so it's left alone. Returns [item, from, to] for what it covered.
const NAME_SIGN = /(?<![\p{L}\p{N}])(?:(?:student|full|first|last|family|your|given)[’']?s?\s+)?(?:name|nom|nombre)(?:\s*\(s\))?\s*(?:[:：]|_{2,}|\.{3,})|(?:姓名|名字|名前|이름|ชื่อ)\s*[:：_]/giu;
const NEXT_SIGN = /(?<![\p{L}\p{N}])(?:date|class|period|block|teacher|grade|section|subject|form|homeroom|due|score|mark|total|id|number|no\.|group|level|日期|班级|班級|学号|날짜|반)\s*[:：]/iu;
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
// opts, for the check and the ZIP: { common, own, parts } from shareOpts. With it, what comes right after a Name label is always covered, and a lone word that's
// only a classmate's name by its letters (typed small, or on many papers of the class, like a word from the task) isn't.
async function autoCovers(page, vp, rx, xf, opts) {
  const out = [];
  if (!rx) return out;
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
const boxKey = (path, p) => path + '|' + p;
function ownCovers(path, p, W, H) { return (shareState().boxes[boxKey(path, p)] || []).map(b => ({ x: b[0] * W, y: b[1] * H, w: b[2] * W, h: b[3] * H, own: true })); }
// Automatic covers she took off in Check the covers, kept as fractions of the page. A cover found again in about the same place stays off.
const offList = (path, p) => (shareState().off ||= {})[boxKey(path, p)] || [];
const sameSpot = (r, b, W, H) => {
  const x0 = Math.max(r.x, b[0] * W), y0 = Math.max(r.y, b[1] * H), x1 = Math.min(r.x + r.w, (b[0] + b[2]) * W), y1 = Math.min(r.y + r.h, (b[1] + b[3]) * H);
  const both = Math.max(0, x1 - x0) * Math.max(0, y1 - y0), a = r.w * r.h, c = b[2] * W * b[3] * H;
  return both > 0 && both / (a + c - both) >= 0.5;
};
// The automatic covers for a page, without the ones she took off. gone: where those were, so the check can show them.
function keptCovers(cs, path, p, W, H) {
  const off = offList(path, p), gone = [];
  if (!off.length) return Object.assign(cs, { gone });
  const kept = cs.filter(r => { const out = off.some(b => sameSpot(r, b, W, H)); if (out) gone.push(r); return !out; });
  return Object.assign(kept, { gone });
}
const scrubMarks = (marks, rx) => marks.map(m => m.text != null ? { ...m, text: scrub(m.text, rx) } : m);
// Renders one page the way Claude will see it: her marks (names scrubbed from her text) and black covers.
// look, for a strong example: { bare: leave her marks off, light: with the page's lighting }.
async function sharePage(st, f, js, p, scale, rx, opts, look) {
  const page = await js.getPage(p + 1);
  const vp = vpRot(f, p, page, 1), W = vp.width, H = vp.height;
  const marks = look && look.bare ? [] : scrubMarks((f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []), rx);
  const side = marks.some(m => m.t === 'note') ? sideFor(W) : 0;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + side) * scale); c.height = Math.ceil(H * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, scale), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  if (look && look.light) { const L = lightForPage(st, f, p); if (L) lightCanvas(ctx, Math.ceil(W * scale), c.height, L); }
  scanClip(ctx, f, p, W * scale, c.width, c.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawMarks(ctx, marks, W, H, side, null);
  const auto = keptCovers(await autoCovers(page, vp, rx, skewXf(f, p, vp), opts), f.path, p, W, H), covers = auto.concat(ownCovers(f.path, p, W, H));
  ctx.fillStyle = '#111';
  for (const r of covers) ctx.fillRect(r.x, r.y, r.w, r.h);
  page.cleanup();
  return { c, W, H, side, covers, gone: auto.gone };
}
const shareDocs = st => layoutOf(st).filter(d => docIn(st, d)).map(d => ({ ...d, pages: d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && !f.virtual && viewable(f); }) })).filter(d => d.pages.length);

function openShare() {
  saveNow(); commitEditors(); shareState(); saveSoon();
  openDlg('<div class="bh"><h2>Share with Claude</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<div class="shkind" role="group" aria-label="What to give Claude"><button data-kind="papers" aria-pressed="true">Papers and marks<small>A ZIP of every page as a picture, names covered</small></button><button data-kind="marks" aria-pressed="false">Marks only<small>One file: scores, rubric, comments and every mark</small></button></div>' +
    '<div id="shPapers"><p style="margin-top:0">This makes a ZIP you can give to Claude with <b>no names in it</b><span id="shPromise">' + esc(namePromise()) + '</span>. <span id="shWho"></span> The list of who is who stays only in this browser.</p>' +
    '<details class="cclist" style="margin:0 0 12px"><summary>What goes in it</summary><ul style="list-style:disc;margin:6px 0 0;padding-left:20px;line-height:1.55;max-height:none">' +
    '<li>Every page becomes a picture, so no hidden text or file details go with it.</li>' +
    '<li>Names are covered in black wherever they’re typed on the page' + (batchClass() ? ' (folder names and your roster names)' : ' (from the folder names)') + ', and in any Kami box that has a name.</li>' +
    '<li>Email addresses and long ID numbers typed on the page are covered too.</li>' +
    '<li>Your scores, rubric and comments go too, with names swapped for [name].</li>' +
    '<li><b>Only PDFs and pictures go in.</b> A Word file stays out until it’s PDF pages: Convert to PDF on the Word paper’s bar makes them.</li></ul></details>' +
    '<div id="shSteps"></div>' +
    '<div class="prog" hidden><i></i></div><p class="muted" id="shStatus" style="font-size:13px;margin:0"></p></div><div id="shMarks" hidden></div></div>' +
    '<div class="bf"><button class="btn" data-check>Check the covers</button><button class="btn primary" data-make>Download ZIP for Claude</button><button class="btn primary" data-marksdl hidden>Download marks file</button></div>', true);
  const box = $('#dlgBox');
  shareSteps();
  if (shareState().kind === 'marks') shareKind('marks');
  ensureCounts().then(() => { if ($('#shSteps')) shareSteps(); findNames(); });
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (marksClick(e)) return;
    if (shareStepClick(e)) return;
    if (e.target.closest('[data-check]')) return ensureCounts().then(() => checkCovers(coverFirst()));
    if (e.target.closest('[data-make]')) {
      for (const b of box.querySelectorAll('.bf .btn')) b.disabled = true;
      const bar = box.querySelector('.prog'); bar.hidden = false;
      try { await makeSharePackage((n, t) => { bar.firstChild.style.width = (100 * n / t) + '%'; $('#shStatus').textContent = 'Covering names and making pictures ' + n + ' of ' + t + '…'; }); $('#shStatus').textContent = 'Done. Give the ZIP to Claude, then use Bring back from Claude with what it sends.'; shareMade(); }
      catch (er) { console.error(er); $('#shStatus').textContent = 'Something went wrong: ' + (er.message || er); }
      for (const b of box.querySelectorAll('.bf .btn')) b.disabled = false;
    }
  };
}

// Paper by paper: every page with its covers; drag to add a cover, click one of yours to remove it.
async function checkCovers(start, onDone) {
  await ensureCounts();
  await classCommon();
  const list = coverList();
  if (!list.length) return toast('No papers to share');
  let pos = Math.min(start || 0, list.length - 1), token = 0, last = null, drawn = 0;
  let find = '', only = 'all', undo = [];
  openDlg('<div class="bh"><h2 id="ccTitle">Check the covers</h2><span class="ccstate" id="ccState"></span><button class="link ccstate" id="ccUndo" hidden>Mark not checked</button><span class="ccstate stag" id="ccFlag" hidden></span><span class="muted" id="ccCount"></span><button class="icon" data-done aria-label="Done">✕</button></div>' +
    '<div class="ccmid"><aside class="ccside" aria-label="Papers"><div class="cchead"><b id="ccProg"></b><div class="ccbar"><i id="ccBar"></i></div>' +
    '<input type="search" class="ccfind" id="ccFind" placeholder="Find a student" aria-label="Find a student" autocomplete="off">' +
    '<span class="seg ccseg"><button data-ccf="all"></button><button data-ccf="todo"></button><button data-ccf="flag"></button></span></div>' +
    '<ul class="ccrows" id="ccRows"></ul><div class="ccalldone" id="ccAllDone" hidden>✓ Every paper is checked.</div></aside>' +
    '<div class="bb" id="ccBody"></div></div>' +
    '<div class="bf" style="justify-content:space-between"><span class="muted" style="font-size:13px;align-self:center;max-width:46%">Drag a box over a name it missed. Click any black box that isn’t a name to take it off, and click a dashed one to put it back. ' + keyLabel('⌘Z') + ' takes back the last change.</span><span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn" data-every hidden>Use my last box on every paper</button><button class="btn" data-back>◀ Back</button><button class="btn primary" data-next>Next ▶</button></span></div>');
  const box = $('#dlgBox');
  box.classList.add('ccbox');
  const finish = () => { if (eachKeys) document.removeEventListener('keydown', eachKeys, true); eachKeys = null; saveSoon(); (onDone || openShare)(); };
  const go = d => { pos += d; if (pos >= list.length) { toast('That was the last paper'); return finish(); } pos = Math.max(0, pos); show(); };
  // She says this one looks right, once she's seen it all. Then on to the next paper not checked yet.
  const looked = () => {
    if (drawn !== token) return toast('Still drawing this paper');
    coverMark(list[pos].st, list[pos].d, true);
    const n = list.findIndex((x, i) => i > pos && !coverOk(x.st, x.d));
    if (n >= 0) { pos = n; return show(); }
    toast(list.every(x => coverOk(x.st, x.d)) ? 'Every paper is checked' : 'That was the last paper');
    finish();
  };
  // What the name search says about this paper, until she's checked it.
  const showFlag = () => { const el = $('#ccFlag'); if (!el) return; const { st, d } = list[pos]; el.textContent = coverOk(st, d) ? '' : nameFlag(st, d); el.hidden = !el.textContent; };
  findNames().then(() => { showFlag(); rows(); });
  // Whether this paper is checked, said in the header.
  function head() {
    const { st, d } = list[pos], ok = coverOk(st, d);
    $('#ccState').textContent = ok ? '✓ Checked' : 'Not checked yet';
    $('#ccState').className = ok ? 'ccstate' : 'ccstate stag';
    $('#ccUndo').hidden = !ok;
    showFlag();
  }
  // Her own boxes on a paper.
  const boxCount = d => d.pages.reduce((n, [path, p]) => n + ((shareState().boxes[boxKey(path, p)] || []).length), 0);
  const codeLine = x => codeOf(x.st) + (x.k ? '-' + (x.k + 1) : '');
  // The papers that show in the list, with what she typed and the Not checked filter.
  const flagOf = x => coverOk(x.st, x.d) ? '' : nameFlag(x.st, x.d).replace(/, check this one$/, '');
  const shown = () => {
    const q = find.trim().toLowerCase();
    return list.map((x, i) => i).filter(i => (only === 'all' || (only === 'todo' ? !coverOk(list[i].st, list[i].d) : !!flagOf(list[i]))) && (!q || (coverName(list[i].st, list[i].k) + ' ' + codeLine(list[i])).toLowerCase().includes(q)));
  };
  // Every paper on the side: ticked once she's said the covers look right, and a click opens it.
  function rows() {
    const ul = $('#ccRows'); if (!ul) return;
    const ok = list.map(x => coverOk(x.st, x.d)), n = ok.filter(Boolean).length, left = list.length - n;
    $('#ccProg').textContent = n + ' of ' + list.length + ' checked';
    $('#ccBar').style.width = (100 * n / list.length) + '%';
    const say = list.map(flagOf), nf = say.filter(Boolean).length;
    if (only === 'flag' && !nf) only = 'all';
    const seg = { all: 'All ' + list.length, todo: 'Not checked ' + left, flag: 'Flagged ' + nf };
    for (const b of box.querySelectorAll('[data-ccf]')) { b.textContent = seg[b.dataset.ccf]; b.setAttribute('aria-pressed', b.dataset.ccf === only); b.hidden = b.dataset.ccf === 'flag' && !nf; }
    $('#ccAllDone').hidden = !!left;
    const vis = shown();
    ul.innerHTML = vis.map(i => {
      const x = list[i], nb = boxCount(x.d);
      return '<li><button data-ccgo="' + i + '"' + (i === pos ? ' aria-current="true"' : '') + '><span class="ccic' + (ok[i] ? ' done' : say[i] ? ' flag' : '') + '" aria-hidden="true">' + (ok[i] ? '✓' : say[i] ? '!' : '') + '</span>' +
        '<span class="ccnm">' + esc(coverName(x.st, x.k)) + (nb ? '<span class="ccpill">' + nb + (nb === 1 ? ' box' : ' boxes') + '</span>' : '') + (say[i] ? '<small>' + esc(say[i]) + '</small>' : '') +
        '<span class="sr">' + (ok[i] ? ', checked' : ', not checked yet') + '</span></span><span class="cccode">' + esc(codeLine(x)) + '</span></button></li>';
    }).join('') || '<li class="ccnone">' + (find.trim() ? 'No one matches “' + esc(find.trim()) + '”.' : only === 'todo' ? 'Every paper is checked.' : 'Nothing to show.') + '</li>';
    const cur = ul.querySelector('[aria-current="true"]'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  async function show() {
    const my = ++token, { st, d, k } = list[pos], rx = coverRx(st);
    $('#ccTitle').textContent = coverName(st, 0) + ' → ' + codeOf(st) + (k ? '-' + (k + 1) : '');
    head(); rows();
    $('#ccCount').textContent = 'paper ' + (pos + 1) + ' of ' + list.length;
    box.querySelector('[data-back]').disabled = pos === 0;
    box.querySelector('[data-next]').textContent = pos === list.length - 1 ? 'Covers look right, done' : 'Covers look right ▶';
    const body = $('#ccBody'); body.innerHTML = ''; body.scrollTop = 0;
    const js = new Map();
    try {
      for (const [path, p] of d.pages) {
        if (my !== token) break;
        const f = fileByPath(st, path);
        if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
        const avail = body.clientWidth - 40, dpr = window.devicePixelRatio || 1;
        const pg0 = await js.get(path).getPage(p + 1), v1 = vpRot(f, p, pg0, 1);
        const kk = Math.min(1.6, avail / (v1.width * 1.4));
        const r = await sharePage(st, f, js.get(path), p, kk * dpr, rx, shareOpts(st));
        if (my !== token) break;
        const c = r.c;
        Object.assign(c.style, { width: (r.W + r.side) * kk + 'px', height: r.H * kk + 'px', display: 'block', margin: '0 auto 14px', background: '#fff', boxShadow: 'var(--shadow)', cursor: 'crosshair', touchAction: 'none' });
        const ctx = c.getContext('2d');
        // Where a cover she took off was: a dashed outline, so she can see it and put it back.
        if (r.gone.length) { ctx.save(); ctx.setTransform(kk * dpr, 0, 0, kk * dpr, 0, 0); ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 1.5 / kk; ctx.setLineDash([5 / kk, 3 / kk]); for (const g of r.gone) ctx.strokeRect(g.x, g.y, g.w, g.h); ctx.restore(); }
        const base = ctx.getImageData(0, 0, c.width, c.height);
        const inside = (x, y, q) => x >= q.x - 2 && x <= q.x + q.w + 2 && y >= q.y - 2 && y <= q.y + q.h + 2;
        const autoAt = (x, y) => r.covers.filter(q => !q.own && inside(x, y, q)).sort((a, b) => a.w * a.h - b.w * b.h)[0];
        const goneAt = (x, y) => r.gone.find(q => inside(x, y, q));
        const fracOf = q => [q.x / r.W, q.y / r.H, q.w / r.W, q.h / r.H].map(v => Math.round(v * 10000) / 10000);
        const own = () => shareState().boxes[boxKey(path, p)] || (shareState().boxes[boxKey(path, p)] = []);
        const fr = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) / kk, (e.clientY - b.top) / kk]; };
        let d0 = null, sel = null;
        const paint = () => { ctx.putImageData(base, 0, 0); if (sel) { ctx.save(); ctx.setTransform(kk * dpr, 0, 0, kk * dpr, 0, 0); ctx.fillStyle = 'rgba(17,17,17,.75)'; ctx.fillRect(sel.x, sel.y, sel.w, sel.h); ctx.restore(); } };
        c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); d0 = fr(e); sel = null; };
        c.onpointermove = e => { if (!d0) { const [x, y] = fr(e), b = own().some(q => x >= q[0] * r.W && x <= (q[0] + q[2]) * r.W && y >= q[1] * r.H && y <= (q[1] + q[3]) * r.H) || autoAt(x, y) || goneAt(x, y); c.style.cursor = b ? 'pointer' : 'crosshair'; return; } const [x, y] = fr(e); sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint(); };
        c.onpointerup = e => {
          if (!d0) return; const start = d0; d0 = null;
          if (!sel || sel.w < 4 || sel.h < 3) {
            sel = null; paint();
            const [x, y] = start, arr = own(), hit = arr.findIndex(b => x >= b[0] * r.W && x <= (b[0] + b[2]) * r.W && y >= b[1] * r.H && y <= (b[1] + b[3]) * r.H);
            if (hit >= 0) { arr.splice(hit, 1); coverMark(st, d, false); show(); return; }
            // One the name search put on: it comes off here, in the ZIP and while grading anonymously.
            const offs = (shareState().off ||= {}), k = boxKey(path, p), a = autoAt(x, y);
            if (a) { const b = fracOf(a); (offs[k] ||= []).push(b); undo.push({ k, b, i: pos, off: 'took' }); coverMark(st, d, false); saveSoon(); toast('Cover taken off. ' + keyLabel('⌘Z') + ' puts it back.'); return show(); }
            const g = goneAt(x, y);
            if (g) { const list = offs[k] || [], at = list.findIndex(b => sameSpot(g, b, r.W, r.H)); if (at >= 0) { const [b] = list.splice(at, 1); if (!list.length) delete offs[k]; undo.push({ k, b, i: pos, off: 'gave' }); } coverMark(st, d, false); saveSoon(); return show(); }
            return;
          }
          const fx = v => Math.round(v * 10000) / 10000;
          const b = [fx(clamp(sel.x / r.W, 0, 1)), fx(clamp(sel.y / r.H, 0, 1)), fx(Math.min(sel.w / r.W, 1)), fx(Math.min(sel.h / r.H, 1))];
          own().push(b); undo.push({ k: boxKey(path, p), b, i: pos }); last = { b, first: d.pages[0][0] === path && d.pages[0][1] === p, p }; coverMark(st, d, false);
          box.querySelector('[data-every]').hidden = false;
          show();
        };
        c._cover = { covers: r.covers, gone: r.gone, kk };
        body.appendChild(c);
        if (pg0) pg0.cleanup();
      }
      if (my === token) drawn = my;
    } finally { for (const v of js.values()) v.destroy(); }
  }
  // Up and down go through the list as it's shown, filtered or not.
  const step = dd => { const vis = shown(); if (!vis.length) return; const at = vis.indexOf(pos); const to = at < 0 ? vis.find(i => dd > 0 ? i > pos : i < pos) : vis[at + dd]; if (to == null || to === pos) return; pos = to; show(); };
  $('#ccFind').oninput = e => { find = e.target.value; rows(); };
  box.onclick = e => {
    if (e.target.closest('[data-done]')) return finish();
    const g = e.target.closest('[data-ccgo]'); if (g) { pos = +g.dataset.ccgo; return show(); }
    const f = e.target.closest('[data-ccf]'); if (f) { only = f.dataset.ccf; return rows(); }
    if (e.target.closest('#ccUndo')) { coverMark(list[pos].st, list[pos].d, false); head(); return rows(); }
    if (e.target.closest('[data-back]')) return go(-1);
    if (e.target.closest('[data-next]')) return looked();
    if (e.target.closest('[data-every]') && last) {
      // Same spot on every paper: the first page of each paper (or the same page number when the box wasn't on a first page).
      let n = 0;
      for (const { d } of list) {
        const at = last.first ? d.pages[0] : d.pages.find(([, p]) => p === last.p);
        if (!at) continue;
        const arr = shareState().boxes[boxKey(at[0], at[1])] || (shareState().boxes[boxKey(at[0], at[1])] = []);
        if (!arr.some(b => b.join() === last.b.join())) { arr.push(last.b.slice()); n++; coverAgain(at[0], at[1]); }
      }
      saveSoon(); toast('Added that cover to ' + n + ' more ' + (n === 1 ? 'paper' : 'papers')); show();
    }
  };
  if (eachKeys) document.removeEventListener('keydown', eachKeys, true);
  eachKeys = e => {
    const typing = e.target.id === 'ccFind';
    if (e.key === 'Escape' && typing && find) { e.preventDefault(); e.stopPropagation(); e.target.value = find = ''; rows(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (typing && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const vis = shown(); if (vis.length) { pos = vis[0]; show(); } }
    else if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    else if (!typing && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      // Takes back the last box she drew here.
      e.preventDefault(); e.stopPropagation();
      const u = undo.pop(); if (!u) return toast('Nothing to take back');
      const offs = (shareState().off ||= {});
      if (u.off === 'took') { const list = offs[u.k] || [], at = list.lastIndexOf(u.b); if (at >= 0) list.splice(at, 1); if (!list.length) delete offs[u.k]; }
      else if (u.off === 'gave') (offs[u.k] ||= []).push(u.b);
      else { const arr = shareState().boxes[u.k] || [], at = arr.lastIndexOf(u.b); if (at >= 0) arr.splice(at, 1); }
      coverMark(list[u.i].st, list[u.i].d, false); saveSoon();
      pos = u.i; show();
    }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); step(e.key === 'ArrowUp' ? -1 : 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
    else if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); e.stopPropagation(); looked(); }
  };
  document.addEventListener('keydown', eachKeys, true);
  show();
}

const README_FOR_CLAUDE = (n) => [
  'Grading Studio package for Claude',
  '',
  'Assignment: ' + nameFreeText(batch.name).replace(/[\r\n]+/g, ' '),
  'Papers: ' + n + (n === 1 ? ' student' : ' students') + ', each named by a random code (S-XXXX). Names are covered and swapped for [name].',
  'A second paper from the same student is S-XXXX-2, and so on.',
  '',
  'Files',
  '  papers/        one PDF per paper, as pictures, with the teacher\'s marks and comments drawn on',
  '  scores.csv     code, rubric scores, total, percent, status (partial, missing, excused or late), the teacher\'s comment',
  '  comments.json  every typed comment and text mark the teacher left, by code, page and kind',
  '  rubric.json    the rubric rows and grading scale',
  '',
  'How to send feedback back',
  '  Give one block per student that starts with the code on its own line, then the feedback:',
  '',
  '    S-XXXX',
  '    Feedback for this student...',
  '',
  '  Or a CSV with the columns code,feedback. Paste the reply, or drop the file, into',
  '  "Bring back from Claude" in Grading Studio and each block goes to the right student.',
  '  Only these codes are known to Grading Studio; never guess or ask for names.',
].join('\r\n');

async function makeSharePackage(onStep) {
  await workerReady;
  if (!scanned || scanP) await scanAll();
  await classCommon();
  const files = {}, rows = [], notes = {};
  const crit = setup.mode === 'rubric' ? setup.criteria : [];
  const jobs = [];
  for (const st of batch.students) shareDocs(st).forEach((d, k) => jobs.push({ st, d, k }));
  const total = jobs.reduce((a, j) => a + j.d.pages.length, 0);
  let done = 0;
  const seen = new Set();
  for (const { st, d, k } of jobs) {
    const rx = coverRx(st), code = codeOf(st);
    const out = await PDFLib.PDFDocument.create();
    out.setTitle(code); out.setAuthor(''); out.setCreator('Grading Studio'); out.setProducer('');
    const js = new Map();
    try {
      for (const [path, p] of d.pages) {
        const f = fileByPath(st, path);
        if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
        // A poster-size page is drawn smaller: a canvas that big can't be turned into a picture.
        const v1 = vpRot(f, p, await js.get(path).getPage(p + 1), 1);
        const r = await sharePage(st, f, js.get(path), p, Math.min(120 / 72, 8000 / Math.max(v1.width * 1.5, v1.height)), rx, shareOpts(st));
        const jpg = await canvasJpg(r.c, 0.85);
        out.addPage([r.W + r.side, r.H]).drawImage(await out.embedJpg(jpg), { x: 0, y: 0, width: r.W + r.side, height: r.H });
        r.c.width = r.c.height = 0;
        const list = (notes[code] = notes[code] || []);
        const pageNo = d.pages.findIndex(x => x[0] === path && x[1] === p) + 1;
        for (const m of (f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []))
          if (m.text) list.push({ paper: code + (k ? '-' + (k + 1) : ''), page: pageNo, kind: m.t === 'note' ? (m.ro ? 'Kami comment' : 'margin comment') : 'text on page', text: scrub(m.text, rx) });
        onStep && onStep(++done, total);
      }
    } finally { for (const v of js.values()) v.destroy(); }
    files['papers/' + code + (k ? '-' + (k + 1) : '') + '.pdf'] = [await out.save(), { level: 0 }];
    if (!seen.has(st)) {
      seen.add(st);
      const g = gradeOf(st);
      rows.push([code].concat(crit.map((_, i) => fmtNum(rowShown(st, i))), [cellOut(g, 'total'), cellOut(g, 'pct'), statusText(st), scrub(st.grade.comment, rx).replace(/\s*\n\s*/g, ' ')]));
    }
  }
  const head = ['code'].concat(crit, ['total / ' + maxPoints(), 'percent', 'status', 'teacher comment']);
  const enc = s => new TextEncoder().encode(s);
  files['scores.csv'] = enc('﻿' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n'));
  files['comments.json'] = enc(JSON.stringify(notes, null, 1));
  files['rubric.json'] = enc(JSON.stringify({ mode: setup.mode, criteria: crit, levels: setup.mode === 'rubric' ? (rowsTop(setup) ? '0 to ' + rowsTop(setup) + ' per row' : 'rows in order: ' + setup.criteria.map((_, i) => '0 to ' + rowTop(setup, i)).join(', ')) + (rowHalf(setup) ? ', half points allowed from 1 up' : ', whole numbers only') : undefined, outOf: maxPoints(), scale: setup.scale || null }, null, 1));
  files['README.txt'] = enc(README_FOR_CLAUDE(seen.size));
  saveBlob(('For Claude - ' + nameFreeText(batch.name) + '.zip'), new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
}

// Claude's reply: blocks that start with a code, a code,feedback CSV, JSON, or a ZIP with those and/or papers named by code.
function parseFeedback(text) {
  const out = new Map(), t = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  try {
    const j = JSON.parse(t);
    const put = (c, v) => { if (c && v != null) out.set(String(c).toUpperCase().trim(), String(typeof v === 'object' ? (v.feedback || v.comment || '') : v).trim()); };
    if (Array.isArray(j)) j.forEach(x => put(x.code, x.feedback != null ? x.feedback : x.comment)); else for (const [c, v] of Object.entries(j)) put(c, v);
    return out;
  } catch {}
  const lines = t.split('\n'), h = lines[0].toLowerCase();
  if (/^\s*"?code"?\s*,/.test(h) && /feedback|comment/.test(h)) {   // CSV
    const rows = [], cell = []; let f = '', inQ = false, row = [];
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (inQ) { if (ch === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (ch === '"') inQ = false; else f += ch; }
      else if (ch === '"') inQ = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else f += ch;
    }
    row.push(f); rows.push(row);
    const hd = rows[0].map(x => x.toLowerCase().trim()), ci = hd.indexOf('code'), fi = hd.findIndex(x => /feedback/.test(x)) >= 0 ? hd.findIndex(x => /feedback/.test(x)) : hd.findIndex(x => /comment/.test(x));
    for (const r of rows.slice(1)) if (r[ci] && r[ci].trim()) out.set(r[ci].trim().toUpperCase(), (r[fi] || '').trim());
    return out;
  }
  const rx = /(?:^|\n)[\s#*>\-]*\**\s*(S-[A-Z0-9]{4})\b\**\s*[:.\-–—)]*\**/gi;   // blocks
  const hits = [...t.matchAll(rx)];
  hits.forEach((m, i) => {
    const s = m.index + m[0].length, e = i + 1 < hits.length ? hits[i + 1].index : t.length;
    const body = t.slice(s, e).replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
    if (body) out.set(m[1].toUpperCase(), (out.has(m[1].toUpperCase()) ? out.get(m[1].toUpperCase()) + '\n\n' : '') + body);
  });
  return out;
}
function openBringBack() {
  shareState();
  const byCode = new Map(batch.students.map(st => [codeOf(st), st]));
  for (const [c, k] of Object.entries(shareState().also || {})) { const st = batch.students.find(s => s.key === k); if (st && !byCode.has(c)) byCode.set(c, st); }   // made on another computer: its ZIP can still come back
  let fb = new Map(), papers = [];
  openDlg('<div class="bh"><h2>Bring back from Claude</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<p style="margin-top:0">Paste Claude’s reply here, or drop the file it gave you (CSV, text or ZIP). Each code is matched to its student in this browser.</p>' +
    '<textarea id="bbText" rows="7" style="width:100%;font:inherit;font-size:14px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink)" placeholder="S-7QK4&#10;Your thesis is clear…&#10;&#10;S-M3TD&#10;…"></textarea>' +
    '<div style="display:flex;gap:8px;margin:8px 0 12px"><button class="btn sm" data-file>Open a file…</button><button class="btn sm" data-read>Match to students</button><input type="file" id="bbFile" accept=".csv,.txt,.json,.md,.zip" hidden></div>' +
    '<div id="bbOut"></div></div>' +
    '<div class="bf"><label class="chk" style="margin:0 auto 0 0"><input type="checkbox" id="bbAdd" checked> Add below what’s already in the comment box (untick to replace it)</label><button class="btn" data-papers hidden>Download papers in student folders</button><button class="btn primary" data-apply disabled>Put in comment boxes</button></div>');
  const box = $('#dlgBox');
  const show = () => {
    const rows = [...fb].map(([c, v]) => { const st = byCode.get(c); return '<tr><td class="n" style="white-space:nowrap">' + esc(c) + '</td><td class="nm" style="cursor:default">' + (st ? esc(shownName(st, batch.students.indexOf(st))) : '<span style="color:var(--warn)">not in this download</span>') + '</td><td class="cm" style="white-space:pre-wrap">' + esc(v) + '</td></tr>'; }).join('');
    const nOk = [...fb.keys()].filter(c => byCode.has(c)).length, nP = papers.filter(p => byCode.has(p.code)).length, nSent = new Set((shareState().sent || []).map(c => byCode.get(c)).filter(Boolean)).size;
    $('#bbOut').innerHTML = bringBackNotes(fb, byCode) + (fb.size ? '<p style="margin:0 0 8px"><b>' + nOk + ' of ' + (nSent || batch.students.length) + '</b> students matched.' + (fb.size > nOk ? ' <span style="color:var(--warn)">' + (fb.size - nOk) + ' code' + (fb.size - nOk === 1 ? ' doesn’t' : 's don’t') + ' belong to this download.</span>' : '') + ' Read it over before you put it in.</p><table class="gl"><thead><tr><th>Code</th><th>Student</th><th>Feedback</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
      (papers.length ? '<p class="muted" style="font-size:14px">' + nP + ' paper' + (nP === 1 ? '' : 's') + ' named by code can be sorted back into student folders.</p>' : '') +
      (!fb.size && !papers.length ? '<p class="muted" style="font-size:14px">No codes found yet. Each block should start with a code like S-7QK4.</p>' : '');
    box.querySelector('[data-apply]').disabled = !nOk;
    box.querySelector('[data-papers]').hidden = !nP;
  };
  const readText = s => { fb = parseFeedback(s); show(); };
  const takeFile = async file => {
    const data = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name)) {
      let z; try { z = fflate.unzipSync(data); } catch { return toast('Couldn’t open that ZIP'); }
      papers = []; let txt = '';
      for (const [p, b] of Object.entries(z)) {
        if (junk(p)) continue;
        const m = p.split('/').pop().match(/^(S-[A-Z0-9]{4})(?:-(\d+))?.*\.pdf$/i);
        if (m) papers.push({ code: m[1].toUpperCase(), n: +(m[2] || 1), name: p.split('/').pop(), data: b });
        else if (/\.(csv|txt|json|md)$/i.test(p) && !/readme/i.test(p)) txt += '\n' + new TextDecoder().decode(b);
      }
      $('#bbText').value = txt.trim(); readText(txt);
    } else { const s = new TextDecoder().decode(data); $('#bbText').value = s; readText(s); }
  };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-file]')) return $('#bbFile').click();
    if (e.target.closest('[data-read]')) return readText($('#bbText').value);
    if (e.target.closest('[data-apply]')) {
      const add = $('#bbAdd').checked; let n = 0;
      for (const [c, v] of fb) { const st = byCode.get(c); if (!st || !v || (add && ('\n\n' + st.grade.comment.trim() + '\n\n').includes('\n\n' + v.trim() + '\n\n'))) continue; st.grade.comment = add && st.grade.comment.trim() ? st.grade.comment.replace(/\s+$/, '') + '\n\n' + v : v; touchGrade(st); n++; }
      saveNow(); renderList(); renderGrade();
      toast('Put feedback in ' + n + (n === 1 ? ' comment box' : ' comment boxes') + '. It’s on the Grades tab too.');
      closeDlg();
    }
    if (e.target.closest('[data-papers]')) {
      const files = {};
      for (const p of papers) {
        const st = byCode.get(p.code); if (!st) continue;
        const real = st.files.find(f => !f.virtual && viewable(f)) || st.files[0];
        const dir = real && real.path.includes('/') ? real.path.slice(0, real.path.lastIndexOf('/') + 1) : st.key + '/';
        files[(dir + 'Feedback' + (p.n > 1 ? ' ' + p.n : '') + '.pdf').replace(/[\\:*?"<>|]+/g, '-')] = [p.data, { level: 0 }];
      }
      saveBlob('From Claude - ' + batch.name + '.zip', new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
    }
  };
  $('#bbFile').onchange = e => { const f = e.target.files[0]; if (f) takeFile(f); e.target.value = ''; };
  $('#bbText').addEventListener('input', () => { clearTimeout(box._t); box._t = setTimeout(() => readText($('#bbText').value), 400); });
  const bb = box.querySelector('.bb');
  bb.addEventListener('dragover', e => e.preventDefault());
  bb.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) takeFile(f); });
}

