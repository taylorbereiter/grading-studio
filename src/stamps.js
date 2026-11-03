/* ---------------- stamps: proofreading marks and stickers, from a right-click on the paper ---------------- */
// A stamp is { t: 'stamp', k, x, y, size } with (x, y) its middle, in page points. A proofreading mark is drawn in its
// color, like the check; a sticker is a picture (rot: its small tilt, in degrees). Both stay upright when a page turns.
const PROOF = [
  ['gr', 'Grammar'], ['cap', 'Capitalize'], ['lower', 'Make lowercase'], ['insert', 'Insert'], ['para', 'New paragraph'],
  ['delete', 'Delete'], ['swap', 'Swap order'], ['space', 'Add a space'], ['close', 'Close up'],
  ['sp', 'Spelling'], ['ro', 'Run-on'], ['frag', 'Fragment'],
  ['wc', 'Word choice'], ['awk', 'Awkward'], ['vt', 'Verb tense'], ['unclear', 'Unclear'],
];
// Quick punctuation: a caret under the line with the mark to add above it, or (for marks that sit up high) the mark in an upside-down caret.
const PUNCT = [
  ['period', 'Add a period', 'Period'], ['comma', 'Add a comma', 'Comma'], ['apos', 'Add an apostrophe', 'Apostrophe'], ['quote', 'Add quotation marks', 'Quotes'], ['semi', 'Add a semicolon', 'Semicolon'],
  ['colon', 'Add a colon', 'Colon'], ['qmark', 'Add a question mark', 'Question'], ['excl', 'Add an exclamation mark', 'Exclamation'], ['hyphen', 'Add a hyphen', 'Hyphen'], ['dash', 'Add a dash', 'Dash'],
];
const PUNCT_SIGN = { comma: [',', 1], apos: ['\u2019', -1], quote: ['\u201C \u201D', -1], semi: [';', 1], colon: [':', 1], qmark: ['?', 1], excl: ['!', 1], hyphen: ['=', 1], dash: ['\u2014', 1] };   // [sign, 1 caret / -1 upside down]
const isProof = k => PROOF.some(p => p[0] === k) || PUNCT.some(p => p[0] === k);
const PROOF_TAG = { gr: 'gr', sp: 'sp', ro: 'RO', frag: 'frag', wc: 'WC', awk: 'awk', vt: 'VT', unclear: '?' };   // the ones written in a circle
const STICKERS = [
  ['star', 'Star', 0.895], ['check', 'Check', 0.86], ['thumbsup', 'Thumbs up', 0.985], ['lightbulb', 'Great idea', 1.02],
  ['evidence', 'Add evidence', 0.97], ['sideeye', 'Look here', 0.535], ['question', 'Unclear', 1.282], ['rocket', 'Big improvement', 0.975],
  ['trophy', 'Top work', 1.036], ['connect', 'Connect your ideas', 1.005], ['pencil', 'Revise this', 0.99], ['fire', 'This is fire', 1.156],
  ['cat', 'Crying thumbs up', 1.005], ['skull', 'Dead (funny)', 1.064], ['frog', 'Cool', 0.98],
];
const BRAINROT = new Set(['cat', 'skull', 'frog']);
const STICKER_SRC = /*@@STICKERS@@*/{};
const stickerImg = {};
const stickersReady = Promise.all(STICKERS.map(([k]) => new Promise(done => {
  if (!STICKER_SRC[k]) { done(); return; }
  const im = new Image(); im.onload = im.onerror = () => done(); im.src = STICKER_SRC[k]; stickerImg[k] = im;
})));
const isSticker = k => STICKERS.some(s => s[0] === k);
const stickerAspect = k => (STICKERS.find(s => s[0] === k) || [0, 0, 1])[2];
const stampName = k => ((PROOF.find(p => p[0] === k) || PUNCT.find(p => p[0] === k) || STICKERS.find(p => p[0] === k)) || [k, k])[1];
// How big a new one is: the size she last gave that kind (each sticker, each mark, the check) in this download.
// A new download starts back at the usual sizes. Kept on this computer, for the dozen most recent downloads.
const MARK_SIZES = 'gs.markSizes', SIZE0 = { proof: 16, sticker: 44 };
const sizeKind = k => isSticker(k) ? 'sticker' : 'proof';
const SIZE_LIMITS = { proof: [8, 80], sticker: [16, 240], check: [8, 120] };
const sizesHere = () => { const all = store.get(MARK_SIZES, {}) || {}; return (batch && all[batch.id]) || {}; };
function lastSize(key, lim, dflt) { const v = +sizesHere()[key]; return v >= lim[0] && v <= lim[1] ? v : dflt; }
const newStampSize = k => lastSize(k, SIZE_LIMITS[sizeKind(k)], SIZE0[sizeKind(k)]);
const newCheckSize = () => lastSize('$check', SIZE_LIMITS.check, 22);
function rememberSizeOf(key, size) {
  if (!batch) return;
  const all = { ...(store.get(MARK_SIZES, {}) || {}) }, mine = { ...(all[batch.id] || {}), [key]: size, at: Date.now() };
  delete all[batch.id];
  const keep = Object.entries(all).filter(([, v]) => v && typeof v === 'object').sort((p, q) => (q[1].at || 0) - (p[1].at || 0)).slice(0, 11);
  store.set(MARK_SIZES, Object.fromEntries([[batch.id, mine], ...keep]));
}
const rememberStampSize = m => rememberSizeOf(m.k, m.size);

// The box around a stamp, before any tilt.
function stampBox(m) {
  const s = m.size || 16, x = m.x, y = m.y;
  if (isSticker(m.k)) { const h = s * stickerAspect(m.k); return { x: x - s / 2, y: y - h / 2, w: s, h }; }
  if (PUNCT_SIGN[m.k]) return { x: x - 0.42 * s, y: y - 0.62 * s, w: 0.84 * s, h: 1.2 * s };
  if (PROOF_TAG[m.k]) { const r = tagRadii(m.k, s); return { x: x - r[0] - 1, y: y - r[1] - 1, w: r[0] * 2 + 2, h: r[1] * 2 + 2 }; }
  const half = { cap: [0.4, 0.3], lower: [0.3, 0.5], insert: [0.35, 0.4], para: [0.4, 0.55], delete: [0.7, 0.5], swap: [0.65, 0.6], space: [0.3, 0.95], close: [0.35, 0.55], period: [0.3, 0.3] }[m.k] || [0.5, 0.5];
  return { x: x - half[0] * s, y: y - half[1] * s, w: half[0] * s * 2, h: half[1] * s * 2 };
}
function tagRadii(k, s) {
  measureCtx.font = '600 ' + (s * 0.62) + 'px ' + FONT;
  const tw = measureCtx.measureText(PROOF_TAG[k]).width;
  return [Math.max(s * 0.5, tw / 2 + s * 0.28), s * 0.5];
}
function drawStamp(ctx, m) {
  const s = m.size || 16, x = m.x, y = m.y;
  if (isSticker(m.k)) {
    const im = stickerImg[m.k];
    if (!im || !im.complete || !im.naturalWidth) return;
    const h = s * stickerAspect(m.k);
    ctx.save(); ctx.translate(x, y); ctx.rotate((m.rot || 0) * Math.PI / 180);
    ctx.shadowColor = 'rgba(15,20,30,0.22)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
    ctx.drawImage(im, -s / 2, -h / 2, s, h);
    ctx.restore();
    return;
  }
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = m.color; ctx.lineWidth = Math.max(1.1, s * 0.085); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (...p) => { ctx.beginPath(); ctx.moveTo(x + p[0] * s, y + p[1] * s); for (let i = 2; i < p.length; i += 2) ctx.lineTo(x + p[i] * s, y + p[i + 1] * s); ctx.stroke(); };
  const text = (t, size, dy) => { ctx.font = '600 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + (dy || 0)); };
  switch (m.k) {
    case 'cap': for (const d of [-0.18, 0, 0.18]) line(-0.35, d, 0.35, d); break;   // three lines under a letter
    case 'lower': line(-0.25, 0.45, 0.25, -0.45); break;
    case 'insert': line(-0.3, 0.35, 0, -0.35, 0.3, 0.35); break;
    case 'para': text('¶', s * 1.15); break;
    case 'delete':
      ctx.beginPath(); ctx.moveTo(x - 0.65 * s, y); ctx.lineTo(x + 0.25 * s, y);
      ctx.bezierCurveTo(x + 0.6 * s, y, x + 0.62 * s, y - 0.45 * s, x + 0.4 * s, y - 0.45 * s);
      ctx.bezierCurveTo(x + 0.2 * s, y - 0.45 * s, x + 0.22 * s, y - 0.1 * s, x + 0.55 * s, y + 0.35 * s); ctx.stroke(); break;
    case 'swap':
      ctx.beginPath(); ctx.moveTo(x - 0.6 * s, y + 0.15 * s);
      ctx.bezierCurveTo(x - 0.55 * s, y - 0.6 * s, x - 0.1 * s, y - 0.5 * s, x, y);
      ctx.bezierCurveTo(x + 0.1 * s, y + 0.5 * s, x + 0.55 * s, y + 0.6 * s, x + 0.6 * s, y - 0.15 * s); ctx.stroke(); break;
    case 'space': line(0, -0.35, 0, 0.9); text('#', s * 0.6, -0.68 * s); break;
    case 'close':
      ctx.beginPath(); ctx.arc(x, y - 0.15 * s, 0.32 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + 0.15 * s, 0.32 * s, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); break;
    case 'period':
      ctx.beginPath(); ctx.arc(x, y, 0.26 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 0.07 * s, 0, Math.PI * 2); ctx.fill(); break;
    default:
      if (PUNCT_SIGN[m.k]) {
        const [sign, way] = PUNCT_SIGN[m.k];
        if (way > 0) { line(-0.3, 0.55, 0, 0.12, 0.3, 0.55); text(sign, s * (sign === '=' ? 0.7 : 0.95), -0.25 * s); }   // the caret, the mark above its point
        else { line(-0.32, -0.45, 0, 0.5, 0.32, -0.45); text(sign, s * (sign.length > 1 ? 0.55 : 0.8), -0.1 * s); }   // the mark sitting inside an upside-down caret
      } else if (PROOF_TAG[m.k]) {
        const [rx, ry] = tagRadii(m.k, s);
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        text(PROOF_TAG[m.k], s * 0.62, s * 0.02);
      }
  }
  ctx.restore();
}

/* ---------------- the right-click menu ---------------- */
const RECENT_STAMPS = 'gs.recentStamps';
function stampPicture(k, color, big) {   // a small picture of a mark for the menu, drawn the same way as on the paper
  const c = document.createElement('canvas'), dpr = window.devicePixelRatio || 1, sz = isSticker(k) ? 40 : 34;
  c.width = c.height = Math.round(sz * dpr); c.style.width = c.style.height = sz + 'px';
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const m = { t: 'stamp', k, x: sz / 2, y: sz / 2, size: isSticker(k) ? sz - 6 : big ? 22 : 16, color };
  if (isSticker(m.k) && stickerAspect(k) > 1) m.size = (sz - 6) / stickerAspect(k);
  drawStamp(ctx, m);
  return c;
}
let stampMenuEl = null;
function closeStampMenu() { if (stampMenuEl) { stampMenuEl.remove(); stampMenuEl = null; } }
function placeStamp(pg, k, x, y) {
  const m = isSticker(k) ? { t: 'stamp', k, x: r1(x), y: r1(y), size: newStampSize(k), rot: Math.round((Math.random() * 10 - 5) * 10) / 10 } : { t: 'stamp', k, x: r1(x), y: r1(y), size: newStampSize(k), color: COLORS[inkColor] };
  const bb = stampBox(m);   // keep it on the page
  m.x = r1(m.x + Math.max(0, -bb.x) - Math.max(0, bb.x + bb.w - pg.W)); m.y = r1(m.y + Math.max(0, -bb.y) - Math.max(0, bb.y + bb.h - pg.H));
  snap(pg); pg.marks().push(m); changed(pg);
  const recent = [k, ...store.get(RECENT_STAMPS, []).filter(r => r !== k && (isSticker(r) || isProof(r)))].slice(0, 6);
  store.set(RECENT_STAMPS, recent);
  return m;
}
// What a right-click on typed text is pointing at: its line and the word's two ends. Nothing on scans or between lines.
function wordUnder(pg, x, y) {
  if (!pg.tl || !pg.tl.length) return null;
  const i = nearestSeg(pg.tl, x, y); if (i < 0) return null;
  const s = pg.tl[i]; if (segFar(s, x, y)[0] > s.fh * 0.5) return null;
  const w = wordAt(s, x); if (!w || x < w[0] - 4 || x > w[1] + 4) return null;
  return { i, s, w };
}
function circleWord(pg, u) {
  const { s, w } = u, px = Math.max(3, s.fh * 0.35), py = s.fh * 0.3;
  const m = { t: 'oval', color: COLORS[inkColor], sw: Math.max(1.2, penW * 0.8), x: r1(w[0] - px), y: r1(s.top - py), w: r1(w[1] - w[0] + px * 2), h: r1(s.bot - s.top + py * 2) };
  snap(pg); pg.marks().push(m); changed(pg); return m;
}
function highlightWord(pg, u, x) {
  const m = setRects({ t: 'hl', color: HL[hlColor] }, snapRects(pg.tl, u.i, x, u.i, x));
  snap(pg); pg.marks().push(m); changed(pg); return m;
}
function textBoxHere(pg, x, y) {
  const m = { t: 'text', color: COLORS[inkColor], x: r1(Math.min(x, pg.W - 106)), y: r1(y - disp.tsize / 2), size: disp.tsize, text: '' };
  m.bw = newTextW(pg, m.x); keepOnPage(m, pg.W, pg.H);
  snap(pg); pg.marks().push(m); editText(pg, m, true);
}

/* ---------------- one go with a tool, from the right-click ---------------- */
// Draw a circle or a highlight once, then the tool she was on (usually Comment) comes back by itself.
// The pen stays until Done or Esc, since a word takes several strokes. Picking any tool herself ends it too.
const toolName = k => (TOOLS.find(t => t[0] === k) || [k, k])[1];
function dropOnce() { once = null; if (onceEl) { onceEl.remove(); onceEl = null; } }
function startOnce(k, cx, cy) {
  const prev = once ? once.prev : tool;
  if (prev === k) { setTool(k); return; }   // already on it: nothing to come back to
  setTool(k); once = { k, prev }; renderTools();
  const el = document.createElement('div'); el.className = 'oncepill'; el.setAttribute('role', 'status');
  el.innerHTML = k === 'pen' ? '<span>Writing with the pen</span><button type="button" data-done>Done</button>'
    : '<span>' + (k === 'oval' ? 'Drag to circle once' : 'Drag to highlight once') + '</span><u>Esc to cancel</u>';
  el.addEventListener('click', e => { if (e.target.closest('[data-done]')) endOnce(); });
  document.body.append(el); onceEl = el;
  const r = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(cx + 14, innerWidth - r.width - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(cy + 18, innerHeight - r.height - 8)) + 'px';
}
function endOnce() { if (!once) return; const p = once.prev; dropOnce(); setTool(p); }

/* ---------------- the menu itself ---------------- */
// Short on purpose: the long lists (punctuation, proofreading marks, stickers) open beside it when she points at them.
const MI = {
  del: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>', edit: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/>',
  punct: '<path d="M8 17.5v.5M16 6c0 3-3 3-3 6"/><path d="M13 17.5v.5"/>', proof: '<path d="M5 18l7-12 7 12"/>',
  stick: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 14c1.5 1.5 4.5 1.5 6 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
};
function openStampMenu(pg, x, y, cx, cy) {
  closeStampMenu();
  const color = COLORS[inkColor], el = document.createElement('div'), u = wordUnder(pg, x, y);
  const hit = hitMark(pg, x, y, 3), on = hit && !hit.ro ? hit : null, back = toolName(once ? once.prev : tool);
  el.className = 'stampmenu'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'Add a mark');
  const item = (attrs, icon, label, opts = {}) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'st-item' + (opts.cls ? ' ' + opts.cls : ''); b.setAttribute('role', 'menuitem');
    for (const [k, v] of Object.entries(attrs)) b.dataset[k] = v;
    if (opts.title) b.title = opts.title;
    if (typeof icon === 'string') b.insertAdjacentHTML('beforeend', svg(icon)); else if (icon) b.append(icon);
    const t = document.createElement('span'); t.className = 'st-lb'; t.textContent = label;
    if (opts.sub) { const sm = document.createElement('small'); sm.textContent = opts.sub; t.append(sm); }
    b.append(t);
    if (attrs.sub) { b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false'); b.insertAdjacentHTML('beforeend', '<span class="st-chev" aria-hidden="true">›</span>'); }
    return b;
  };
  const sep = () => { const d = document.createElement('div'); d.className = 'st-sep'; return d; };
  const btn = (k, sticker) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = sticker ? 'st-stick' : 'st-proof'; b.dataset.mark = k;
    b.setAttribute('role', 'menuitem'); b.title = stampName(k); b.setAttribute('aria-label', stampName(k));
    b.append(stampPicture(k, color));
    if (!sticker) { const s = document.createElement('span'); s.textContent = stampName(k); b.append(s); }
    return b;
  };
  const head = t => { const h = document.createElement('div'); h.className = 'st-head'; h.textContent = t; return h; };
  const grid = (cls, list, sticker) => { const g = document.createElement('div'); g.className = cls; for (const k of list) g.append(btn(k, sticker)); return g; };
  const fly = (name, label, ...kids) => { const f = document.createElement('div'); f.className = 'st-fly'; f.dataset.fly = name; f.setAttribute('role', 'menu'); f.setAttribute('aria-label', label); f.hidden = true; f.append(...kids); return f; };

  // Right-clicked on one of her marks: take it off (or open it) without the eraser.
  if (on) {
    el.append(item({ act: 'del' }, MI.del, 'Delete this mark'));
    if (on.t === 'note' || on.t === 'text') el.append(item({ act: 'edit' }, MI.edit, on.t === 'note' ? 'Edit this comment' : 'Edit this text'));
    el.append(sep());
  }
  el.append(item({ note: '1' }, IC.note, 'Add a comment here', { cls: 'st-pri' }));
  // The check: the same one as the Check tool, in her ink color, at the size she last gave a check.
  const tc = document.createElement('canvas'), dpr = window.devicePixelRatio || 1; tc.width = tc.height = Math.round(22 * dpr); tc.style.width = tc.style.height = '22px';
  const tx = tc.getContext('2d'); tx.scale(dpr, dpr); drawCheck(tx, { t: 'check', color, x: 11, y: 12, size: 16 });
  el.append(item({ tick: '1' }, tc, 'Check mark', { title: 'Check mark' }));
  const recent = store.get(RECENT_STAMPS, []).filter(k => isSticker(k) || isProof(k));
  if (recent.length) {
    const g = document.createElement('div'); g.className = 'st-recent'; g.innerHTML = '<span class="st-rl">Recent</span>';
    for (const k of recent) { const b = btn(k, true); b.className = isSticker(k) ? 'st-stick' : 'st-stick st-mini'; g.append(b); }
    el.append(g);
  }
  el.append(sep());
  // Circle and highlight: on a typed word, that word in one click; anywhere, one drag and then back to her tool.
  const drawOnce = 'Drag once, then back to ' + back;
  if (u) el.append(item({ sub: 'circle' }, IC.oval, 'Circle'));
  else el.append(item({ act: 'oval' }, IC.oval, 'Draw a circle', { title: drawOnce }));
  el.append(item({ sub: 'hl' }, IC.hl, 'Highlight'));
  el.append(item({ act: 'text' }, IC.text, 'Text box here'));
  el.append(item({ act: 'pen' }, IC.pen, 'Write with the pen', { title: 'The pen until you press Done or Esc, then back to ' + back }));
  el.append(sep());
  el.append(item({ sub: 'punct' }, MI.punct, 'Punctuation'), item({ sub: 'proof' }, MI.proof, 'Proofreading marks'), item({ sub: 'stick' }, MI.stick, 'Stickers'));
  el.append(sep());
  const inks = document.createElement('div'); inks.className = 'st-inks'; inks.innerHTML = '<span class="st-rl">Ink</span>';
  for (const [k, v] of Object.entries(COLORS)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'st-sw'; b.dataset.inkPick = k; b.style.background = v; b.title = k; b.setAttribute('aria-label', 'Ink ' + k); b.setAttribute('aria-pressed', k === inkColor); inks.append(b); }
  el.append(inks);

  // The panels beside the menu.
  if (u) el.append(fly('circle', 'Circle', item({ act: 'circleWord' }, IC.oval, 'Circle this word', { sub: 'One click' }), item({ act: 'oval' }, IC.oval, 'Draw a circle', { sub: drawOnce })));
  const hls = document.createElement('div'); hls.className = 'st-hls';
  for (const [k, v] of Object.entries(HL)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'st-sw sq'; b.dataset.hlc = k; b.style.background = v; b.title = k; b.setAttribute('aria-label', 'Highlight ' + k); b.setAttribute('aria-pressed', k === hlColor); hls.append(b); }
  el.append(fly('hl', 'Highlight', ...(u ? [item({ act: 'hlWord' }, IC.hl, 'Highlight this word', { sub: 'One click' })] : []), item({ act: 'hl' }, IC.hl, 'Draw a highlight', { sub: drawOnce }), hls));
  const punct = document.createElement('div'); punct.className = 'st-puncs';
  for (const [k, , short] of PUNCT) {
    const b = btn(k, true); b.className = 'st-punc'; b.firstChild.replaceWith(stampPicture(k, color, true));
    const s = document.createElement('span'); s.textContent = short; b.append(s); punct.append(b);
  }
  el.append(fly('punct', 'Punctuation', head('Punctuation'), punct));
  el.append(fly('proof', 'Proofreading marks', head('Proofreading marks'), grid('st-proofs', PROOF.map(p => p[0]), false)));
  el.append(fly('stick', 'Stickers', head('Stickers'), grid('st-sticks', STICKERS.filter(s => !BRAINROT.has(s[0])).map(s => s[0]), true),
    head('Just for fun'), grid('st-sticks', STICKERS.filter(s => BRAINROT.has(s[0])).map(s => s[0]), true)));

  // Opening a panel: right away on a click or a key; on the pointer, after a moment, so a slanted move toward an open panel doesn't swap it.
  let flyRow = null, flyT = 0;
  const hideFly = () => {
    if (!flyRow) return;
    el.querySelector('[data-fly="' + flyRow.dataset.sub + '"]').hidden = true;
    flyRow.classList.remove('on'); flyRow.setAttribute('aria-expanded', 'false'); flyRow = null;
  };
  const showFly = (row, focus) => {
    clearTimeout(flyT);
    if (flyRow !== row) {
      hideFly();
      const f = el.querySelector('[data-fly="' + row.dataset.sub + '"]'); f.hidden = false;
      const rr = row.getBoundingClientRect(), mr = el.getBoundingClientRect(), fr = f.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
      let left = mr.right + 4; if (left + fr.width > vw - 8) left = mr.left - 4 - fr.width;
      f.style.left = Math.max(8, left) + 'px'; f.style.top = Math.max(8, Math.min(rr.top - 7, vh - fr.height - 8)) + 'px';
      row.classList.add('on'); row.setAttribute('aria-expanded', 'true'); flyRow = row;
    }
    if (focus) { const first = el.querySelector('[data-fly="' + row.dataset.sub + '"] button'); if (first) first.focus({ preventScroll: true }); }
  };
  el.addEventListener('mouseover', e => {
    if (e.target.closest('.st-fly')) { clearTimeout(flyT); return; }
    const row = e.target.closest('button'); if (!row || row === flyRow) { clearTimeout(flyT); return; }
    clearTimeout(flyT);
    flyT = setTimeout(() => { if (!el.isConnected) return; if (row.dataset.sub) showFly(row); else hideFly(); }, flyRow ? 220 : 60);
  });
  el.addEventListener('click', e => {
    const sub = e.target.closest('[data-sub]'); if (sub) { showFly(sub, e.detail === 0); return; }
    const ink = e.target.closest('[data-ink-pick]');
    if (ink) { inkColor = ink.dataset.inkPick; store.set('gs.ink', inkColor); renderTools(); openStampMenu(pg, x, y, cx, cy); return; }   // drawn again, in the new color
    const hc = e.target.closest('[data-hlc]');
    if (hc) { hlColor = hc.dataset.hlc; store.set('gs.hl', hlColor); renderTools(); for (const s of el.querySelectorAll('[data-hlc]')) s.setAttribute('aria-pressed', s === hc); return; }
    const b = e.target.closest('[data-mark]');
    if (b) { closeStampMenu(); const m = placeStamp(pg, b.dataset.mark, x, y); selected = { page: pg, mark: m, fresh: true }; redrawAll(); return; }
    if (e.target.closest('[data-tick]')) {
      closeStampMenu();
      const m = { t: 'check', color: COLORS[inkColor], x: r1(x), y: r1(y), size: newCheckSize() };
      snap(pg); pg.marks().push(m); selected = { page: pg, mark: m, fresh: true }; changed(pg); redrawAll(); return;
    }
    if (e.target.closest('[data-note]')) { closeStampMenu(); openNote(pg, { t: 'note', color: COLORS[inkColor], ax: r1(x), ay: r1(y), text: '' }, true); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    closeStampMenu();
    switch (a.dataset.act) {
      case 'del': { const arr = pg.marks(), i = arr.indexOf(on); if (i >= 0) { snap(pg); arr.splice(i, 1); if (selected && selected.mark === on) selected = null; changed(pg); redrawAll(); } break; }
      case 'edit': editMark(pg, on); break;
      case 'circleWord': { const m = circleWord(pg, u); selected = { page: pg, mark: m, fresh: true }; redrawAll(); break; }
      case 'hlWord': highlightWord(pg, u, x); redrawAll(); break;
      case 'text': textBoxHere(pg, x, y); break;
      case 'oval': case 'hl': case 'pen': startOnce(a.dataset.act, cx, cy); break;
    }
  });
  el.addEventListener('keydown', e => {
    const inFly = document.activeElement && document.activeElement.closest('.st-fly');
    if (e.key === 'Escape' || (e.key === 'ArrowLeft' && inFly)) {
      e.preventDefault(); e.stopPropagation();
      if (inFly && flyRow) { const r = flyRow; hideFly(); r.focus({ preventScroll: true }); return; }
      closeStampMenu(); pg.canvas.focus && pg.canvas.focus({ preventScroll: true }); return;
    }
    if (!inFly && e.key === 'ArrowRight' && document.activeElement.dataset.sub) { e.preventDefault(); showFly(document.activeElement, true); return; }
    const scope = inFly || el, items = [...scope.querySelectorAll('button')].filter(b => !b.closest('.st-fly') === !inFly && !b.closest('[hidden]')), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || (inFly && e.key === 'ArrowRight')) { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp' || (inFly && e.key === 'ArrowLeft')) { e.preventDefault(); items[(i < 0 ? items.length - 1 : i - 1 + items.length) % items.length].focus(); }
  });
  document.body.append(el);
  stampMenuEl = el;
  const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  el.style.left = Math.max(8, Math.min(cx, vw - r.width - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(cy, vh - r.height - 8)) + 'px';
  el.tabIndex = -1; el.focus({ preventScroll: true });   // the arrow keys go from here; no ring around the first line for the mouse
}
document.addEventListener('pointerdown', e => { if (stampMenuEl && !stampMenuEl.contains(e.target)) closeStampMenu(); }, true);
window.addEventListener('blur', closeStampMenu);
document.addEventListener('scroll', closeStampMenu, true);
Object.assign(window.__gs, { turnMarks, drawStamp, stampBox, placeStamp, openStampMenu, closeStampMenu, endOnce, once: () => once && { ...once }, stickersReady, STAMP_KINDS: { proof: PROOF.map(p => p[0]), punct: PUNCT.map(p => p[0]), stickers: STICKERS.map(s => s[0]) } });
