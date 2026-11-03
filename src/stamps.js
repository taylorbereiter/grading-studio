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
const stampName = k => isProof(k) ? markLabel(k) : ((STICKERS.find(p => p[0] === k)) || [k, k])[1];

/* ---------------- the mark key: a page at the end of a returned file saying what each mark on it means ---------------- */
// Each teacher writes the words in More > Mark key; until then these are used. Kept as gs.markKey = { on, names: { k }, means: { k } }.
const MARK_MEAN = {
  gr: 'A grammar mistake here, such as a verb that doesn’t match its subject.',
  cap: 'Make this letter a capital.', lower: 'Make this letter lowercase.',
  insert: 'Something is missing here. Add the word or letter written above it.',
  para: 'Start a new paragraph here.', delete: 'Take this out.', swap: 'Switch the order of these words or letters.',
  space: 'Put a space here.', close: 'Take out the space and join these together.',
  sp: 'This word is spelled wrong.', ro: 'Two sentences run together. Split them, or join them with the right punctuation.',
  frag: 'This isn’t a full sentence. It’s missing a subject or a verb, or the thought isn’t finished.',
  wc: 'A different word would fit better here.', awk: 'This is hard to read. Try saying it out loud and rewording it.',
  vt: 'The verb is in the wrong tense. Keep the tense the same.', unclear: 'I’m not sure what you mean here.',
  period: 'Add a period where the mark points.', comma: 'Add a comma where the mark points.', apos: 'Add an apostrophe here.',
  quote: 'Add quotation marks here.', semi: 'Add a semicolon here.', colon: 'Add a colon here.', qmark: 'Add a question mark here.',
  excl: 'Add an exclamation mark here.', hyphen: 'Add a hyphen here.', dash: 'Add a dash here.',
};
const MARK_KEY = 'gs.markKey';
const KEY_KINDS = PROOF.map(p => p[0]).concat(PUNCT.map(p => p[0]));
const keySet = () => { const v = store.get(MARK_KEY, null); return v && typeof v === 'object' ? v : {}; };
const keyOn = () => keySet().on !== false;
const markLabel0 = k => ((PROOF.find(p => p[0] === k) || PUNCT.find(p => p[0] === k)) || [k, k])[1];
const markLabel = k => { const v = (keySet().names || {})[k]; return typeof v === 'string' && v.trim() ? v.trim() : markLabel0(k); };
const markMean = k => { const m = keySet().means || {}; return typeof m[k] === 'string' ? m[k].trim() : (MARK_MEAN[k] || ''); };
function setKey(change) { const v = { ...keySet() }; change(v); store.set(MARK_KEY, v); }
// The marks a key lists for a set of marks: proofreading and punctuation only, in menu order, each in the ink it was first used in.
function keyRows(marks) {
  const seen = new Map();
  for (const m of marks) if (m && m.t === 'stamp' && isProof(m.k) && !seen.has(m.k)) seen.set(m.k, m.color || '#D92D20');
  return KEY_KINDS.filter(k => seen.has(k)).map(k => ({ k, color: seen.get(k), name: markLabel(k), mean: markMean(k) }));
}
// Draws the key onto pages of W x H points (ctx already scaled to points). Returns how many rows went on this page, from row `from`.
function drawKeyPage(ctx, rows, from, W, H) {
  const M = Math.max(36, Math.round(W * 0.09)), pic = 46, tx = M + pic + 10, tw = W - M - tx, UI = 'Inter, ' + FONT;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1E2024'; ctx.font = '600 17px ' + UI; ctx.fillText(from ? 'Marks on this paper (continued)' : 'Marks on this paper', M, M + 14);
  ctx.fillStyle = '#5C616A'; ctx.font = '12.5px ' + UI; ctx.fillText('What each mark your teacher used means.', M, M + 34);
  const wrap = (t, font) => {
    ctx.font = font; const out = []; let line = '';
    for (const w of t.split(/\s+/).filter(Boolean)) { const tryL = line ? line + ' ' + w : w; if (line && ctx.measureText(tryL).width > tw) { out.push(line); line = w; } else line = tryL; }
    if (line) out.push(line); return out;
  };
  let y = M + 50, n = 0;
  const rule = yy => { ctx.fillStyle = '#E4E6EA'; ctx.fillRect(M, yy, W - 2 * M, 1); };
  rule(y);
  for (let i = from; i < rows.length; i++) {
    const r = rows[i], nm = wrap(r.name, '600 13px ' + UI), mn = r.mean ? wrap(r.mean, '12.5px ' + UI) : [];
    const h = Math.max(pic - 6, 10 + nm.length * 17 + mn.length * 17 + 6);
    if (n && y + h > H - M) break;
    drawStamp(ctx, { t: 'stamp', k: r.k, x: M + pic / 2, y: y + h / 2, size: 20, color: r.color });
    let ty = y + 10 + 12;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1E2024'; ctx.font = '600 13px ' + UI; for (const l of nm) { ctx.fillText(l, tx, ty); ty += 17; }
    ctx.fillStyle = '#3F444C'; ctx.font = '12.5px ' + UI; for (const l of mn) { ctx.fillText(l, tx, ty); ty += 17; }
    y += h; rule(y); n++;
  }
  return n;
}

function openMarkKey(back) {
  const row = k => {
    const s = keySet(), named = typeof (s.names || {})[k] === 'string' && s.names[k].trim(), meant = typeof (s.means || {})[k] === 'string';
    return '<div class="mkrow" data-k="' + k + '"><span class="mkpic"></span>' +
      '<input type="text" maxlength="40" data-n="' + k + '" aria-label="Name for this mark" value="' + esc(markLabel(k)) + '">' +
      '<div><textarea maxlength="300" rows="2" data-m="' + k + '" aria-label="What it means">' + esc(markMean(k)) + '</textarea>' +
      '<button class="link mkusual" data-usual="' + k + '"' + (named || meant ? '' : ' hidden') + '>Back to the usual wording</button></div></div>';
  };
  openDlg('<div class="bh"><h2>Mark key</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb mk">' +
    '<label class="chk"><input type="checkbox" id="mkOn"' + (keyOn() ? ' checked' : '') + '> Add a key to returned papers</label>' +
    '<p class="mkhint">A page at the end of each returned file, listing only the proofreading and punctuation marks used on it, with what they mean. Stickers and check marks are left out. Leave a meaning blank to show just the name.</p>' +
    '<div class="mkgrp">Proofreading marks</div>' + PROOF.map(p => row(p[0])).join('') +
    '<div class="mkgrp">Punctuation</div>' + PUNCT.map(p => row(p[0])).join('') +
    '</div><div class="bf">' + (back ? '<button class="btn" data-back>Back to Export</button>' : '') + '<button class="btn primary" data-close>Done</button></div>', true);
  const box = $('#dlgBox');
  for (const el of box.querySelectorAll('.mkrow')) el.querySelector('.mkpic').append(stampPicture(el.dataset.k, COLORS[inkColor]));
  box.oninput = e => {
    const t = e.target, k = t.dataset.n || t.dataset.m; if (!k) return;
    if (t.dataset.n) setKey(v => { v.names = { ...(v.names || {}) }; if (t.value.trim() && t.value.trim() !== markLabel0(k)) v.names[k] = t.value; else delete v.names[k]; });
    else setKey(v => { v.means = { ...(v.means || {}) }; if (t.value.trim() !== (MARK_MEAN[k] || '')) v.means[k] = t.value; else delete v.means[k]; });
    const s = keySet(); box.querySelector('[data-usual="' + k + '"]').hidden = !(((s.names || {})[k]) || k in (s.means || {}));
  };
  box.onchange = e => { if (e.target.id === 'mkOn') setKey(v => { v.on = e.target.checked; }); };
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-back]')) { closeDlg(); return back(); }
    const u = e.target.closest('[data-usual]');
    if (u) {
      const k = u.dataset.usual;
      setKey(v => { v.names = { ...(v.names || {}) }; v.means = { ...(v.means || {}) }; delete v.names[k]; delete v.means[k]; });
      box.querySelector('[data-n="' + k + '"]').value = markLabel(k); box.querySelector('[data-m="' + k + '"]').value = markMean(k); u.hidden = true;
    }
  };
}
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
function openStampMenu(pg, x, y, cx, cy) {
  closeStampMenu();
  const color = COLORS[inkColor], el = document.createElement('div');
  el.className = 'stampmenu'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'Add a mark');
  const btn = (k, sticker) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = sticker ? 'st-stick' : 'st-proof'; b.dataset.mark = k;
    b.setAttribute('role', 'menuitem'); b.title = stampName(k); b.setAttribute('aria-label', stampName(k));
    b.append(stampPicture(k, color));
    if (!sticker) { const s = document.createElement('span'); s.textContent = stampName(k); b.append(s); }
    return b;
  };
  const head = t => { const h = document.createElement('div'); h.className = 'st-head'; h.textContent = t; return h; };
  const grid = (cls, list, sticker) => { const g = document.createElement('div'); g.className = cls; for (const k of list) g.append(btn(k, sticker)); return g; };
  // The check first: the same one as the Check tool, in her ink color, at the size she last gave a check.
  const tick = document.createElement('button'); tick.type = 'button'; tick.className = 'st-proof st-tick'; tick.dataset.tick = '1'; tick.setAttribute('role', 'menuitem'); tick.title = 'Check mark';
  const tc = document.createElement('canvas'), dpr = window.devicePixelRatio || 1; tc.width = tc.height = Math.round(34 * dpr); tc.style.width = tc.style.height = '34px';
  const tx = tc.getContext('2d'); tx.scale(dpr, dpr); drawCheck(tx, { t: 'check', color, x: 17, y: 18, size: 22 });
  const tl = document.createElement('span'); tl.textContent = 'Check mark'; tick.append(tc, tl); el.append(tick);
  const recent = store.get(RECENT_STAMPS, []).filter(k => isSticker(k) || isProof(k));
  if (recent.length) { el.append(head('Recent')); const g = document.createElement('div'); g.className = 'st-recent'; for (const k of recent) { const b = btn(k, true); b.className = isSticker(k) ? 'st-stick' : 'st-stick st-mini'; g.append(b); } el.append(g); }
  const punct = document.createElement('div'); punct.className = 'st-puncs';
  for (const [k, , short] of PUNCT) {
    const b = btn(k, true); b.className = 'st-punc'; b.firstChild.replaceWith(stampPicture(k, color, true));
    const s = document.createElement('span'); s.textContent = short; b.append(s); punct.append(b);
  }
  el.append(head('Punctuation'), punct);
  el.append(head('Proofreading marks'), grid('st-proofs', PROOF.map(p => p[0]), false));
  el.append(head('Stickers'), grid('st-sticks', STICKERS.filter(s => !BRAINROT.has(s[0])).map(s => s[0]), true));
  el.append(head('Just for fun'), grid('st-sticks', STICKERS.filter(s => BRAINROT.has(s[0])).map(s => s[0]), true));
  const note = document.createElement('button'); note.type = 'button'; note.className = 'st-note'; note.dataset.note = '1'; note.setAttribute('role', 'menuitem'); note.textContent = 'Add a comment here';
  el.append(note);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-mark]');
    if (b) { closeStampMenu(); const m = placeStamp(pg, b.dataset.mark, x, y); selected = { page: pg, mark: m, fresh: true }; redrawAll(); return; }
    if (e.target.closest('[data-tick]')) {
      closeStampMenu();
      const m = { t: 'check', color: COLORS[inkColor], x: r1(x), y: r1(y), size: newCheckSize() };
      snap(pg); pg.marks().push(m); selected = { page: pg, mark: m, fresh: true }; changed(pg); redrawAll(); return;
    }
    if (e.target.closest('[data-note]')) { closeStampMenu(); openNote(pg, { t: 'note', color: COLORS[inkColor], ax: r1(x), ay: r1(y), text: '' }, true); }
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeStampMenu(); pg.canvas.focus && pg.canvas.focus({ preventScroll: true }); return; }
    const items = [...el.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.body.append(el);
  stampMenuEl = el;
  const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  el.style.left = Math.max(8, Math.min(cx, vw - r.width - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(cy, vh - r.height - 8)) + 'px';
  (el.querySelector('button') || el).focus({ preventScroll: true });
}
document.addEventListener('pointerdown', e => { if (stampMenuEl && !stampMenuEl.contains(e.target)) closeStampMenu(); }, true);
window.addEventListener('blur', closeStampMenu);
document.addEventListener('scroll', closeStampMenu, true);
Object.assign(window.__gs, { unpackExport, keyRows, drawKeyPage, openMarkKey, markLabel, markMean, turnMarks, drawStamp, stampBox, placeStamp, openStampMenu, closeStampMenu, stickersReady, STAMP_KINDS: { proof: PROOF.map(p => p[0]), punct: PUNCT.map(p => p[0]), stickers: STICKERS.map(s => s[0]) } });
