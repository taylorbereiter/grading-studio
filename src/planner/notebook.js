/* ---------- the notebook: thoughts for a lesson, jotted as you go ----------
   One page per lesson (kept on the lesson as "notebook"), one per unit, and a general page for everything
   else. Text with bold, italic, underline and lists, plus links, YouTube videos that play right in the
   note, and pictures (pasted, dropped or picked). Saved as you type. Stored as cleaned HTML; a video is kept
   as <div class="nb-vid" data-yt="ID" data-t="seconds"></div> and gets its player when shown. */
const NB = { general: null, t: 0, range: null, ask: '' };
// Which page the notebook shows: the open lesson's, else the open unit's, else the general one.
// SP.nbGeneral switches to the general page while a lesson is open.
function nbRef() {
  if (L.open && !SP.nbGeneral) return { t: 'lesson', o: L.open, name: L.open.title || 'This lesson' };
  if (!L.open && L.view === 'unit' && L.unit && !SP.nbGeneral) return { t: 'unit', o: L.unit, name: L.unit.title || 'This unit' };
  return { t: 'general', o: null, name: 'General notes' };
}
async function nbGet(ref) {
  if (ref.t !== 'general') return ref.o.notebook || '';
  if (NB.general == null) NB.general = String((await kvGet('nb:general')) || '');
  return NB.general;
}
async function nbPut(ref, html) {
  const empty = !nbText(html).trim() && !/<img|nb-vid/.test(html);
  if (ref.t === 'general') { NB.general = empty ? '' : html; return kvSet('nb:general', NB.general); }
  // the lesson or unit as it is now (Claude's changes may have come in since the page opened)
  const o = (ref.t === 'lesson' ? L.lessons : L.units).find(x => x.id === ref.o.id) || ref.o;
  if (empty) delete o.notebook; else o.notebook = html;
  if (ref.t === 'lesson') return lPut(o);
  return unitPut(o, true);
}

// Keeps text, simple formatting, lists, safe links, pictures and video markers. Nothing pasted can run.
const NB_OK = /^(P|BR|B|STRONG|I|EM|U|UL|OL|LI|DIV|H3|A|IMG|BLOCKQUOTE)$/;
function nbClean(html) {
  const tp = document.createElement('template'); tp.innerHTML = String(html || '').replace(/<(script|style|object|embed)[\s\S]*?<\/\1>/gi, '');
  (function walk(n) {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      if (c.tagName === 'DIV' && c.classList.contains('nb-vid')) {
        const id = String(c.dataset.yt || ''), t = Math.max(0, Math.round(+c.dataset.t || 0));
        if (!/^[\w-]{11}$/.test(id)) { c.remove(); continue; }
        const v = document.createElement('div'); v.className = 'nb-vid'; v.dataset.yt = id; if (t) v.dataset.t = t; c.replaceWith(v); continue;
      }
      if (!NB_OK.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); continue; }
      const keep = {};
      if (c.tagName === 'A' && /^(https?:|mailto:)/i.test(c.getAttribute('href') || '')) keep.href = c.getAttribute('href');
      if (c.tagName === 'IMG') { const s = c.getAttribute('src') || ''; if (/^data:image\/(png|jpeg|gif|webp);base64,[\w+/=]+$/.test(s) || /^https:\/\//.test(s)) keep.src = s; else { c.remove(); continue; } }
      for (const at of [...c.attributes]) c.removeAttribute(at.name);
      for (const [k, v] of Object.entries(keep)) c.setAttribute(k, v);
      if (c.tagName === 'A') { if (!keep.href) { walk(c); c.replaceWith(...c.childNodes); continue; } c.target = '_blank'; c.rel = 'noopener'; }
      walk(c);
    }
  })(tp.content);
  return tp.innerHTML;
}
// Words only, with link addresses, for search, the Claude box and the lesson text.
function nbText(html) {
  const d = document.createElement('div'); d.innerHTML = nbClean(html);
  for (const a of d.querySelectorAll('a')) if (a.textContent.trim() !== a.href && a.href) a.append(' (' + a.getAttribute('href') + ')');
  for (const v of d.querySelectorAll('.nb-vid')) v.textContent = '[Video: https://www.youtube.com/watch?v=' + v.dataset.yt + (v.dataset.t ? '&t=' + v.dataset.t + 's' : '') + ']';
  for (const i of d.querySelectorAll('img')) i.replaceWith('[Picture]');
  for (const li of d.querySelectorAll('li')) li.prepend('• ');
  for (const el of d.querySelectorAll('p,div,ul,ol,h3,blockquote')) el.before('\n');
  for (const el of d.querySelectorAll('p,div,li,h3,br,blockquote')) el.append('\n');
  return d.textContent.replace(/[ \t\u00a0]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
const nbPlayer = v => { v.contentEditable = 'false'; v.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + v.dataset.yt + (v.dataset.t ? '?start=' + v.dataset.t : '') + '" title="Video" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>'; };
function nbStored(el) {   // the page as it is saved: players back to markers
  const c = el.cloneNode(true);
  for (const v of c.querySelectorAll('.nb-vid')) { v.removeAttribute('contenteditable'); v.innerHTML = ''; }
  return nbClean(c.innerHTML);
}

async function notebookHtml() {
  const ref = nbRef(), html = await nbGet(ref);
  const B = (c, t, tip, st) => '<button class="btn sm ghost nb-tb" data-nb="' + c + '" title="' + tip + '"' + (st ? ' style="' + st + '"' : '') + '>' + t + '</button>';
  const other = L.open || (L.view === 'unit' && L.unit);
  return '<div class="sp-pad nb">' +
    '<div class="nb-head"><b>' + esc(ref.name) + '</b>' + (other ? '<button class="btn sm ghost" data-sa="nbswap">' + (SP.nbGeneral ? '← ' + esc(L.open ? 'This lesson' : 'This unit') : 'General notes') + '</button>' : '') + '<span class="sp"></span><span class="muted sp-small" id="nbSaved"></span></div>' +
    '<div class="nb-tools" role="toolbar" aria-label="Notebook">' + B('bold', 'B', 'Bold (Ctrl/⌘ B)', 'font-weight:800') + B('italic', 'I', 'Italic (Ctrl/⌘ I)', 'font-style:italic;font-family:Georgia,serif') + B('underline', 'U', 'Underline (Ctrl/⌘ U)', 'text-decoration:underline') +
    B('ul', '• List', 'Bullets') + B('ol', '1. List', 'Numbers') + '<span class="rt-sep"></span>' + B('link', '🔗 Link', 'Add a link') + B('pic', '🖼 Picture', 'Add a picture (you can also paste or drop one)') + B('video', '▶ Video', 'Add a YouTube video that plays here') +
    '<button class="btn sm ghost nb-tb" data-dict="#nbPage" title="Say it instead of typing">🎤</button></div>' +
    '<div class="nb-ask" id="nbAsk" hidden><input class="btn sm" id="nbAskIn"><button class="btn sm primary" data-nb="askok">Add</button><button class="btn sm ghost" data-nb="askx" aria-label="Cancel">×</button></div>' +
    '<div class="nb-page" id="nbPage" contenteditable="true" spellcheck="true" data-ph="Thoughts for this lesson as they come: what to try, what to change, links, videos, pictures…">' + nbClean(html) + '</div>' +
    '<input type="file" id="nbPicIn" accept="image/*" hidden>' +
    '<div class="sp-bar"><span class="muted sp-small">Saved as you type' + (ref.t === 'lesson' ? ', with this lesson' : ref.t === 'unit' ? ', with this unit' : ' on this computer') + '.</span><span class="sp"></span><button class="btn sm ghost" data-sa="nbbox">+ Claude box</button></div></div>';
}
function notebookWire() {
  const el = $('#nbPage'); if (!el) return;
  const ref = nbRef(); el._ref = ref;
  for (const v of el.querySelectorAll('.nb-vid')) nbPlayer(v);
  el.addEventListener('input', () => nbChanged(el));
  el.addEventListener('paste', nbPaste);
  el.addEventListener('drop', nbDrop);
  el.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
  el.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (a) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); } });
  el.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && /^[biu]$/i.test(e.key)) { e.preventDefault(); nbCmd({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); } });
  el.addEventListener('blur', () => { NB.range = nbSel(el); });
}
function nbChanged(el) {
  el = el || $('#nbPage'); if (!el) return;
  const s = $('#nbSaved'); if (s) s.textContent = 'Saving…';
  clearTimeout(NB.t); NB.t = setTimeout(() => nbFlush(el), 500);
}
async function nbFlush(el) {
  el = el || $('#nbPage'); clearTimeout(NB.t); if (!el || !el._ref) return;
  await nbPut(el._ref, nbStored(el));
  const s = $('#nbSaved'); if (s) s.textContent = '✓ Saved';
}
const nbSel = el => { const s = getSelection(); return s.rangeCount && el.contains(s.getRangeAt(0).commonAncestorContainer) ? s.getRangeAt(0).cloneRange() : null; };
function nbFocus() {   // back to where the cursor was, or the end of the page
  const el = $('#nbPage'); el.focus();
  const s = getSelection(); s.removeAllRanges();
  if (NB.range && el.contains(NB.range.commonAncestorContainer)) s.addRange(NB.range);
  else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.addRange(r); }
  return el;
}
function nbInsert(html) {
  const el = nbFocus();
  document.execCommand('insertHTML', false, html);
  for (const v of el.querySelectorAll('.nb-vid:not([contenteditable])')) nbPlayer(v);
  NB.range = nbSel(el); nbChanged(el);
}
function nbCmd(c) {
  const el = $('#nbPage'); if (!el) return;
  if (document.activeElement !== el) nbFocus();
  document.execCommand({ ul: 'insertUnorderedList', ol: 'insertOrderedList' }[c] || c);
  nbChanged(el);
}
const nbLinkHtml = (u, text) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(text || u) + '</a>&nbsp;';
const nbVidHtml = u => '<div class="nb-vid" data-yt="' + ytId(u) + '"' + (ytStart(u) ? ' data-t="' + ytStart(u) + '"' : '') + '></div><p><br></p>';
function nbUrl(u) { u = String(u || '').trim(); if (!u) return ''; if (/^www\./i.test(u)) u = 'https://' + u; return /^(https?:\/\/|mailto:)\S+$/i.test(u) ? u : ''; }
// Adds a link or a video from an address: YouTube addresses become a player.
function nbAddUrl(u, kind) {
  u = nbUrl(u); if (!u) return toast('That isn’t a web address');
  if (kind !== 'link' && ytId(u)) return nbInsert(nbVidHtml(u));
  if (kind === 'video') toast('Only YouTube videos play here, so that went in as a link');
  const el = $('#nbPage'), r = NB.range, txt = r && !r.collapsed && el.contains(r.commonAncestorContainer) ? r.toString() : '';
  if (txt) { nbFocus(); document.execCommand('createLink', false, u); for (const a of el.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener'; } NB.range = nbSel(el); return nbChanged(el); }
  nbInsert(nbLinkHtml(u));
}
function nbAsk(kind) {
  const el = $('#nbPage'); NB.range = nbSel(el) || NB.range; NB.ask = kind;
  const box = $('#nbAsk'), i = $('#nbAskIn'); box.hidden = false;
  i.placeholder = kind === 'video' ? 'Paste a YouTube link' : 'Paste or type a web address'; i.value = ''; i.focus();
}
async function nbPic(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = url; });
    const k = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight));   // keeps a lesson light
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    const png = /png|gif|webp/.test(file.type) && c.width * c.height < 6e5;
    nbInsert('<img src="' + c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85) + '" alt=""><p><br></p>');
  } catch { toast('That picture couldn’t be opened'); }
  finally { URL.revokeObjectURL(url); }
}
function nbPaste(e) {
  e.stopPropagation();
  const dt = e.clipboardData; if (!dt) return;
  const img = [...dt.files || []].find(f => /^image\//.test(f.type)); if (img) { e.preventDefault(); NB.range = nbSel($('#nbPage')); return nbPic(img); }
  const t = (dt.getData('text/plain') || '').trim();
  if (nbUrl(t) && !/\s/.test(t)) { e.preventDefault(); NB.range = nbSel($('#nbPage')); return nbAddUrl(t); }
  const h = dt.getData('text/html');
  e.preventDefault(); NB.range = nbSel($('#nbPage'));
  nbInsert(h ? nbClean(h) : esc(dt.getData('text/plain') || '').replace(/\n/g, '<br>'));
}
function nbDrop(e) {
  e.preventDefault(); e.stopPropagation();
  const dt = e.dataTransfer, el = $('#nbPage');
  const r = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY); if (r && el.contains(r.startContainer)) NB.range = r;
  const img = [...dt.files || []].find(f => /^image\//.test(f.type)); if (img) return nbPic(img);
  const u = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').split('\n')[0].trim();
  if (nbUrl(u)) return nbAddUrl(u);
  const t = dt.getData('text/plain'); if (t) nbInsert(esc(t).replace(/\n/g, '<br>'));
}
// Notebook clicks come through the panel's own click handler first.
function notebookClick(e) {
  const t = e.target.closest('[data-nb]'); if (!t) return false;
  const c = t.dataset.nb;
  if (/^(bold|italic|underline|ul|ol)$/.test(c)) nbCmd(c);
  else if (c === 'link' || c === 'video') nbAsk(c);
  else if (c === 'pic') { NB.range = nbSel($('#nbPage')) || NB.range; const i = $('#nbPicIn'); i.onchange = () => { const f = i.files[0]; i.value = ''; if (f) nbPic(f); }; i.click(); }
  else if (c === 'askok') { const v = $('#nbAskIn').value; $('#nbAsk').hidden = true; nbAddUrl(v, NB.ask); }
  else if (c === 'askx') $('#nbAsk').hidden = true;
  return true;
}
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.nb-tools [data-nb]')) e.preventDefault(); });   // keeps the cursor in the page
document.addEventListener('keydown', e => {
  if (e.target.id !== 'nbAskIn') return;
  if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value; $('#nbAsk').hidden = true; nbAddUrl(v, NB.ask); }
  if (e.key === 'Escape') { $('#nbAsk').hidden = true; $('#nbPage').focus(); }
});
