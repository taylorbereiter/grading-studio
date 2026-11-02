/* ---------- slide text the teacher formats herself ---------- */
// One line per paragraph. Leading tabs set the indent (0 to 2). "• " starts a bullet, "1. " (any number) a
// numbered line, anything else is plain. Inside a line: **bold**, *italic*, __underline__; \ keeps a * or _ as is.
// No layout adds bullets or numbers on its own: they are only there if she turned them on.
const RT_LVL = 2, RT_KEYS = ['body', 'body2', 'foot'];
const rtEsc = t => String(t).replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_');
function rtParse(text) {
  const out = String(text || '').replace(/\r/g, '').split('\n').map(raw => {
    const tabs = /^\t*/.exec(raw)[0].length; let t = raw.slice(tabs), kind = 'p';
    if (/^•\s?/.test(t)) { kind = 'b'; t = t.replace(/^•\s?/, ''); }
    else if (/^\d{1,3}[.)] /.test(t)) { kind = 'n'; t = t.replace(/^\d{1,3}[.)] /, ''); }
    return { lvl: Math.min(RT_LVL, tabs), kind, text: t };
  });
  return rtNumber(out);
}
// Numbers count up per level and start again after a line that isn't numbered at that level.
function rtNumber(lines) {
  const cnt = [0, 0, 0];
  for (const x of lines) {
    if (x.kind === 'n') { x.n = ++cnt[x.lvl]; for (let k = x.lvl + 1; k <= RT_LVL; k++) cnt[k] = 0; }
    else for (let k = x.lvl; k <= RT_LVL; k++) cnt[k] = 0;
  }
  return lines;
}
function rtLineText(x) { return '\t'.repeat(x.lvl) + (x.kind === 'b' ? '• ' : x.kind === 'n' ? (x.n || 1) + '. ' : '') + x.text; }
const rtToText = lines => { const a = rtNumber(lines).map(rtLineText); while (a.length && !a[a.length - 1].trim()) a.pop(); return a.join('\n'); };
// The words of a line in pieces: [{ t, b, i, u }]
function rtSegs(text) {
  const out = [], f = { b: 0, i: 0, u: 0 };
  for (const tok of String(text).split(/(\\.|\*\*|__|\*)/)) {
    if (!tok) continue;
    if (tok === '**') f.b ^= 1; else if (tok === '*') f.i ^= 1; else if (tok === '__') f.u ^= 1;
    else { const t = tok[0] === '\\' && tok.length === 2 ? tok[1] : tok; const p = out[out.length - 1]; if (p && p.b === f.b && p.i === f.i && p.u === f.u) p.t += t; else out.push({ t, ...f }); }
  }
  return out;
}
const rtPlain = text => rtSegs(text).map(s => s.t).join('');
function rtInlineHtml(text) { return rtSegs(text).map(s => { let h = esc(s.t); if (s.u) h = '<u>' + h + '</u>'; if (s.i) h = '<i>' + h + '</i>'; if (s.b) h = '<b>' + h + '</b>'; return h; }).join(''); }
function rtLineHtml(x, edit) { return '<div class="rt rt-' + x.kind + ' l' + x.lvl + '"' + (x.kind === 'n' ? ' data-n="' + x.n + '"' : '') + '>' + (rtInlineHtml(x.text) || (edit ? '<br>' : '&nbsp;')) + '</div>'; }
function rtHtml(text, edit) { const ls = rtParse(text); while (!edit && ls.length > 1 && !ls[ls.length - 1].text && ls[ls.length - 1].kind === 'p') ls.pop(); return ls.map(x => rtLineHtml(x, edit)).join(''); }
// Text with the markers taken out, for search, the Claude box and anything else that wants just the words.
const rtStrip = text => rtParse(text).map(x => '\t'.repeat(x.lvl) + (x.kind === 'b' ? '• ' : x.kind === 'n' ? x.n + '. ' : '') + rtPlain(x.text)).join('\n');

// Slides saved before formatting was hers: write out what the layout used to add, so they look the same.
function rtMigrate(s) {
  const list = {};
  if (s.layout === 'content') list.body = 'b';
  if (s.layout === 'agenda' || s.layout === 'objectives') list.body = 'n';
  if (TEACH[s.layout] && s.layout !== 'objectives') for (const b of teachBoxes({ ...s, size: s.size || 28 })) if (b.list && RT_KEYS.includes(b.k)) list[b.k] = b.list === 'num' ? 'n' : 'b';
  for (const k of RT_KEYS) {
    if (typeof s[k] !== 'string' || !s[k]) continue;
    if (s.layout === 'title' && k === 'body') continue;
    let n = 0;
    s[k] = s[k].replace(/\r/g, '').split('\n').filter(t => !(list[k] === 'n' && !t.trim())).map(t => {
      const m = /^(\t| {2,})/.exec(t), lvl = m ? 1 : 0, w = t.replace(/^\s+/, '');
      if (!w) return '';
      return '\t'.repeat(lvl) + (list[k] === 'b' ? '• ' : list[k] === 'n' ? (++n) + '. ' : '') + rtEsc(w);
    }).join('\n');
  }
}

/* ---------- editing a text box ---------- */
// The box becomes editable in place, line by line, with the same look it has on the slide.
function rtEditor(box, value) {
  const el = document.createElement('div');
  el.className = 'ls-rted ' + box.className.replace(/\bls-ed\b/, '');
  el.style.cssText = box.getAttribute('style') || '';
  el.contentEditable = 'true'; el.spellcheck = true;
  el.dataset.k = box.dataset.k;
  el.innerHTML = rtHtml(value || '', true) || rtLineHtml({ lvl: 0, kind: 'p', text: '' }, true);
  el.addEventListener('input', () => { rtTidy(el); rtRenumber(el); rtToolState(); });
  el.addEventListener('keydown', rtKey);
  el.addEventListener('paste', rtPaste);
  return el;
}
function rtRead(el) {
  const lines = [];
  const lineOf = n => {
    const cl = n.classList || { contains: () => false };
    const kind = cl.contains('rt-b') ? 'b' : cl.contains('rt-n') ? 'n' : 'p', lvl = cl.contains('l2') ? 2 : cl.contains('l1') ? 1 : 0;
    return { kind, lvl, text: rtFromNodes(n.nodeType === 1 && !/^(B|I|U|STRONG|EM|SPAN|FONT)$/.test(n.tagName) ? n.childNodes : [n]) };
  };
  for (const n of el.childNodes) {
    if (n.nodeType === 3 && !n.nodeValue.trim()) continue;
    if (n.nodeType === 1 && n.tagName === 'BR') continue;
    lines.push(lineOf(n));
  }
  return rtToText(lines);
}
function rtFromNodes(nodes) {
  const segs = [];
  (function walk(ns, f) {
    for (const n of ns) {
      if (n.nodeType === 3) { if (n.nodeValue) segs.push({ t: n.nodeValue.replace(/\u00a0/g, ' ').replace(/\n/g, ' '), ...f }); continue; }
      if (n.nodeType !== 1 || n.tagName === 'BR') continue;
      const st = n.getAttribute('style') || '';
      walk(n.childNodes, { b: f.b || /^(B|STRONG)$/.test(n.tagName) || /font-weight:\s*(bold|[6-9]00)/.test(st) ? 1 : 0, i: f.i || /^(I|EM)$/.test(n.tagName) || /font-style:\s*italic/.test(st) ? 1 : 0, u: f.u || n.tagName === 'U' || /underline/.test(st) ? 1 : 0 });
    }
  })(nodes, { b: 0, i: 0, u: 0 });
  let out = '', cur = { b: 0, i: 0, u: 0 };
  const close = () => (cur.u ? '__' : '') + (cur.i ? '*' : '') + (cur.b ? '**' : '');
  for (const s of segs) {
    if (s.b !== cur.b || s.i !== cur.i || s.u !== cur.u) { out += close(); cur = s; out += (s.b ? '**' : '') + (s.i ? '*' : '') + (s.u ? '__' : ''); }
    out += rtEsc(s.t);
  }
  return out + close();
}
// Keep every line a line: stray text the browser leaves at the top level goes into a plain line.
function rtTidy(el) {
  let wrap = null;
  for (const n of [...el.childNodes]) {
    const isLine = n.nodeType === 1 && n.classList.contains('rt');
    if (isLine) { wrap = null; continue; }
    if (n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName)) { n.className = 'rt rt-p l0'; wrap = null; continue; }
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'rt rt-p l0'; n.before(wrap); }
    wrap.appendChild(n);
  }
  if (!el.firstChild) el.innerHTML = rtLineHtml({ lvl: 0, kind: 'p', text: '' }, true);
}
function rtRenumber(el) {
  const cnt = [0, 0, 0];
  for (const d of el.querySelectorAll(':scope > .rt')) {
    const lvl = d.classList.contains('l2') ? 2 : d.classList.contains('l1') ? 1 : 0;
    if (d.classList.contains('rt-n')) { d.dataset.n = ++cnt[lvl]; for (let k = lvl + 1; k <= RT_LVL; k++) cnt[k] = 0; }
    else { delete d.dataset.n; for (let k = lvl; k <= RT_LVL; k++) cnt[k] = 0; }
  }
}
const rtActive = () => lEditing && lEditing.rich ? lEditing.ta : null;
function rtCurLines(el) {
  const sel = getSelection(); if (!sel.rangeCount) return [];
  const r = sel.getRangeAt(0), ls = [...el.querySelectorAll(':scope > .rt')];
  const hit = ls.filter(d => r.intersectsNode(d));
  if (hit.length) return hit;
  let n = r.startContainer; while (n && n.parentNode !== el) n = n.parentNode;
  return n && n.classList && n.classList.contains('rt') ? [n] : ls.slice(-1);
}
const rtLvl = d => d.classList.contains('l2') ? 2 : d.classList.contains('l1') ? 1 : 0;
function rtSetKind(d, k) { d.classList.remove('rt-p', 'rt-b', 'rt-n'); d.classList.add('rt-' + k); }
function rtSetLvl(d, v) { d.classList.remove('l0', 'l1', 'l2'); d.classList.add('l' + Math.max(0, Math.min(RT_LVL, v))); }
// The toolbar and keys: bullets, numbers, indent, bold, italic, underline.
function rtDo(cmd) {
  let el = rtActive();
  if (!el) {   // nothing open: start on the slide's main text box, all of it
    const box = document.querySelector('#lsStage .ls-ed[data-k="body"]:not(.ls-sub)') || document.querySelector('#lsStage .ls-ed[data-k="body2"]');
    if (!box) return toast('Click into a text box first');
    startEdit(box); el = rtActive(); if (!el) return;
    const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  el.focus();
  if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') { document.execCommand(cmd); rtToolState(); return; }
  const ls = rtCurLines(el); if (!ls.length) return;
  if (cmd === 'bullets' || cmd === 'numbers') {
    const k = cmd === 'bullets' ? 'b' : 'n', all = ls.every(d => d.classList.contains('rt-' + k));
    for (const d of ls) rtSetKind(d, all ? 'p' : k);
  }
  if (cmd === 'indent') for (const d of ls) rtSetLvl(d, rtLvl(d) + 1);
  if (cmd === 'outdent') for (const d of ls) rtSetLvl(d, rtLvl(d) - 1);
  if (cmd === 'plain') { for (const d of ls) { rtSetKind(d, 'p'); rtSetLvl(d, 0); d.innerHTML = esc(d.textContent) || '<br>'; } }
  rtRenumber(el); rtToolState();
}
function rtKey(e) {
  const el = e.currentTarget;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.shiftKey && (e.key === '8' || e.key === '*')) { e.preventDefault(); return rtDo('bullets'); }
  if (mod && e.shiftKey && (e.key === '7' || e.key === '&')) { e.preventDefault(); return rtDo('numbers'); }
  if (e.key === 'Tab') { e.preventDefault(); return rtDo(e.shiftKey ? 'outdent' : 'indent'); }
  const sel = getSelection(); if (!sel.isCollapsed) return;
  const [d] = rtCurLines(el); if (!d) return;
  const atStart = (() => { const r = sel.getRangeAt(0), p = document.createRange(); p.selectNodeContents(d); p.setEnd(r.startContainer, r.startOffset); return !p.toString().length; })();
  // Enter on an empty bullet ends the list; Backspace at the start of a bullet takes the bullet off first, like PowerPoint.
  if (e.key === 'Enter' && !e.shiftKey && !d.textContent.trim() && !d.classList.contains('rt-p')) { e.preventDefault(); if (rtLvl(d)) rtSetLvl(d, rtLvl(d) - 1); else rtSetKind(d, 'p'); rtRenumber(el); return rtToolState(); }
  if (e.key === 'Backspace' && atStart && (!d.classList.contains('rt-p') || rtLvl(d))) { e.preventDefault(); if (!d.classList.contains('rt-p')) rtSetKind(d, 'p'); else rtSetLvl(d, rtLvl(d) - 1); rtRenumber(el); return rtToolState(); }
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertParagraph'); }
}
function rtPaste(e) {
  const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; if (!t) return;
  e.preventDefault();
  t.replace(/\r/g, '').split('\n').forEach((line, i) => { if (i) document.execCommand('insertParagraph'); if (line) document.execCommand('insertText', false, line); });
}
function rtToolHtml() {
  const B = (c, t, tip, st) => '<button class="btn sm ghost rt-tb" data-rt="' + c + '" title="' + tip + '"' + (st ? ' style="' + st + '"' : '') + '>' + t + '</button>';
  return '<span class="rt-tools" role="toolbar" aria-label="Text">' + B('bold', 'B', 'Bold (Ctrl/⌘ B)', 'font-weight:800') + B('italic', 'I', 'Italic (Ctrl/⌘ I)', 'font-style:italic;font-family:Georgia,serif') + B('underline', 'U', 'Underline (Ctrl/⌘ U)', 'text-decoration:underline') +
    '<span class="rt-sep"></span>' + B('bullets', '• List', 'Bullets on or off (Ctrl/⌘ Shift 8)') + B('numbers', '1. List', 'Numbers on or off (Ctrl/⌘ Shift 7)') + B('outdent', '⇤', 'Move left (Shift Tab)') + B('indent', '⇥', 'Indent (Tab)') + '</span>';
}
function rtToolState() {
  const el = rtActive(), bar = document.querySelector('.rt-tools'); if (!bar) return;
  bar.classList.toggle('live', !!el);
  const ls = el ? rtCurLines(el) : [];
  const on = (c, v) => { const b = bar.querySelector('[data-rt="' + c + '"]'); if (b) b.classList.toggle('on', !!v); };
  on('bullets', ls.length && ls.every(d => d.classList.contains('rt-b')));
  on('numbers', ls.length && ls.every(d => d.classList.contains('rt-n')));
  let st = { b: 0, i: 0, u: 0 };
  if (el) try { st = { b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline') }; } catch { }
  on('bold', st.b); on('italic', st.i); on('underline', st.u);
}
document.addEventListener('selectionchange', () => { if (rtActive()) rtToolState(); });
// Toolbar buttons keep the cursor where it is.
document.addEventListener('mousedown', e => { const b = e.target.closest && e.target.closest('[data-rt]'); if (b) { e.preventDefault(); rtDo(b.dataset.rt); } });

/* ---------- .pptx paragraphs ---------- */
// o: { lvlMar (EMU per indent level), list mar for numbers/bullets, algn, gap (pt), buClr xml, runFn(seg text, flags) }
function rtParasXml(text, o) {
  const ls = rtParse(text);
  while (ls.length > 1 && !ls[ls.length - 1].text && ls[ls.length - 1].kind === 'p') ls.pop();
  return ls.map((x, i) => {
    const base = x.lvl * o.lvlMar, mar = x.kind === 'n' ? o.numMar : o.bulMar;
    let p = '<a:pPr' + (o.algn ? ' algn="' + o.algn + '"' : '') + (x.kind === 'p' ? ' marL="' + base + '" indent="0"' : ' marL="' + (base + mar) + '" indent="-' + mar + '"') + '>';
    p += i && o.gap ? '<a:spcBef><a:spcPts val="' + Math.round(o.gap * 100) + '"/></a:spcBef>' : o.gap != null ? '<a:spcBef><a:spcPts val="0"/></a:spcBef>' : '';
    p += x.kind === 'p' ? '<a:buNone/>' : o.buClr + (x.kind === 'n' ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"' + (x.n > 1 ? ' startAt="' + x.n + '"' : '') + '/>' : '<a:buFont typeface="Arial"/><a:buChar char="•"/>');
    const segs = rtSegs(x.text);
    return '<a:p>' + p + '</a:pPr>' + (segs.length ? segs.map(sg => o.runFn(sg.t, sg)).join('') : '<a:endParaRPr lang="en-US" sz="' + Math.round(o.sz * 100) + '"/>') + '</a:p>';
  }).join('');
}
