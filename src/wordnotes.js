/* ---------------- comments on Word files: real Word comments, kept in the file's own comments part ---------------- */
// A comment is anchored to words, as in Word itself, so the student opens the returned file and sees it in Word's margin.
// Comments already in the file (a classmate's peer review, say) show in the margin too, and can be edited or deleted.
const WCM_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
const WCM_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const wXml = bytes => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
const wXmlBytes = doc => new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(doc.documentElement));
const wXmlBad = doc => doc.getElementsByTagName('parsererror').length > 0;
const wId = el => el.getAttributeNS(W_NS, 'id') ?? el.getAttribute('w:id');
const wPart = t => 'word/' + t.replace(/^\/?word\//, '').replace(/^\.\//, '');

// The file's comments part, read once. null: none yet. false: there is one, but it can't be read, so it's left alone.
function wComments(w) {
  if (w.cdoc !== undefined) return w.cdoc;
  w.cdoc = null; w.cpath = null;
  const rx = w.files['word/_rels/document.xml.rels'];
  const rel = rx && [...wXml(rx).getElementsByTagName('Relationship')].find(r => r.getAttribute('Type') === WCM_REL);
  if (rel) {
    w.cpath = wPart(rel.getAttribute('Target'));
    const b = w.files[w.cpath];
    if (b) { const d = wXml(b); w.cdoc = wXmlBad(d) ? false : d; }
  }
  return w.cdoc;
}
// A file with no comments yet gets an empty comments part, listed where Word looks for it.
function wCommentsMade(w) {
  const have = wComments(w);
  if (have === false) return null;
  if (have) return have;
  w.cdoc = new DOMParser().parseFromString('<w:comments xmlns:w="' + W_NS + '"></w:comments>', 'application/xml');
  if (!w.cpath) {
    w.cpath = 'word/comments.xml';
    const rp = 'word/_rels/document.xml.rels';
    const rd = w.files[rp] ? wXml(w.files[rp]) : new DOMParser().parseFromString('<Relationships xmlns="' + PKG_REL_NS + '"></Relationships>', 'application/xml');
    const ids = new Set([...rd.getElementsByTagName('Relationship')].map(r => r.getAttribute('Id')));
    let n = 1; while (ids.has('rIdGs' + n)) n++;
    const r = rd.createElementNS(PKG_REL_NS, 'Relationship');
    r.setAttribute('Id', 'rIdGs' + n); r.setAttribute('Type', WCM_REL); r.setAttribute('Target', 'comments.xml');
    rd.documentElement.appendChild(r);
    w.files[rp] = wXmlBytes(rd);
  }
  const cp = '[Content_Types].xml';
  if (w.files[cp]) {
    const cd = wXml(w.files[cp]), part = '/' + w.cpath;
    if (!wXmlBad(cd) && ![...cd.getElementsByTagName('Override')].some(o => o.getAttribute('PartName') === part)) {
      const o = cd.createElementNS(CT_NS, 'Override'); o.setAttribute('PartName', part); o.setAttribute('ContentType', WCM_CT);
      cd.documentElement.appendChild(o); w.files[cp] = wXmlBytes(cd);
    }
  }
  wCommentsKeep(w);
  return w.cdoc;
}
const wCommentsKeep = w => { w.files[w.cpath] = wXmlBytes(w.cdoc); };
const wCommentEls = w => wComments(w) ? [...w.cdoc.documentElement.children].filter(c => c.localName === 'comment') : [];
const wCommentText = c => [...c.children].filter(p => p.localName === 'p').map(p => [...p.getElementsByTagNameNS(W_NS, 'r')].map(wRunText).join('')).join('\n').trim();
function wCommentSet(w, c, text) {
  const d = w.cdoc;
  for (const p of [...c.children]) if (p.localName === 'p') c.removeChild(p);
  for (const line of text.split('\n')) {
    const p = d.createElementNS(W_NS, 'w:p'), r = d.createElementNS(W_NS, 'w:r'), t = d.createElementNS(W_NS, 'w:t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = line;
    r.appendChild(t); p.appendChild(r); c.appendChild(p);
  }
}
// The next free comment number, across the comments part and the document.
function wNextId(w) {
  let n = -1;
  for (const c of wCommentEls(w)) n = Math.max(n, +wId(c) || 0);
  for (const k of ['commentRangeStart', 'commentRangeEnd', 'commentReference']) for (const e of w.doc.getElementsByTagNameNS(W_NS, k)) n = Math.max(n, +wId(e) || 0);
  return String(n + 1);
}
const wMarker = (w, kind, id) => { const e = w.doc.createElementNS(W_NS, 'w:' + kind); e.setAttributeNS(W_NS, 'w:id', id); return e; };
const wRefRun = (w, id) => { const r = w.doc.createElementNS(W_NS, 'w:r'); r.appendChild(wMarker(w, 'commentReference', id)); return r; };
// Splits a run (and its span on screen) at a character, so a comment can start or end mid-run. Returns the span from that character on.
function wSplitSpan(w, span, off) {
  const text = span.textContent;
  if (off <= 0) return span;
  if (off >= text.length) return null;
  const r = w.runs[+span.dataset.ri], r2 = r.cloneNode(true);
  for (const c of [...r2.children]) if (c.localName !== 'rPr') r2.removeChild(c);
  wSetText(w, r, text.slice(0, off)); wSetText(w, r2, text.slice(off));
  r.parentNode.insertBefore(r2, r.nextSibling);
  const s2 = span.cloneNode(false); s2.dataset.ri = w.runs.push(r2) - 1; s2.textContent = text.slice(off);
  span.textContent = text.slice(0, off); span.after(s2);
  return s2;
}
// Where each comment is: the runs it covers, its paragraph, and its place in reading order.
function wCommentMap(w) {
  const runs = new Map(), order = [], para = new Map(), open = new Set();
  const seen = (id, node) => { if (!order.includes(id)) order.push(id); if (!para.has(id)) { let p = node; while (p && p.localName !== 'p') p = p.parentNode; if (p) para.set(id, p); } };
  const walk = node => {
    for (const c of node.children) {
      const n = c.localName;
      if (n === 'commentRangeStart') { open.add(wId(c)); seen(wId(c), c); }
      else if (n === 'commentRangeEnd') open.delete(wId(c));
      else if (n === 'r') { if (open.size) runs.set(c, [...open]); const ref = wkid(c, 'commentReference'); if (ref) seen(wId(ref), c); }
      else if (n !== 'rPr' && n !== 'pPr') walk(c);
    }
  };
  walk(w.doc.documentElement);
  for (const c of wCommentEls(w)) if (!order.includes(wId(c))) order.push(wId(c));
  return { runs, order: order.filter(id => wCommentEls(w).some(c => wId(c) === id)), para };
}
// The words a new comment goes on: the words she selected, or the word she clicked. Null when there's no text there.
function wPickWords(w, page, e) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount && !sel.isCollapsed) {
    const rg = sel.getRangeAt(0);
    if (page.contains(rg.commonAncestorContainer)) {
      const spans = [...page.querySelectorAll('[data-ri]')].filter(s => rg.intersectsNode(s) && s.textContent);
      if (spans.length) {
        const offIn = (s, node, off) => { if (!s.contains(node)) return null; const r = document.createRange(); r.setStart(s, 0); r.setEnd(node, off); return r.toString().length; };
        const first = spans[0], last = spans[spans.length - 1];
        const a = offIn(first, rg.startContainer, rg.startOffset) ?? 0, b = offIn(last, rg.endContainer, rg.endOffset) ?? last.textContent.length;
        if (first !== last || b > a) return { first, a, last, b };
      }
    }
  }
  if (!e) return null;
  const cr = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
  const node = cr && cr.startContainer, span = node && (node.nodeType === 3 ? node.parentElement : node).closest('[data-ri]');
  if (span && page.contains(span)) {
    const t = span.textContent, isW = ch => /[\p{L}\p{N}'’\-]/u.test(ch || '');
    let i = cr.startContainer.nodeType === 3 ? Math.min(cr.startOffset, t.length) : 0;
    if (!isW(t[i]) && isW(t[i - 1])) i--;
    if (isW(t[i])) { let a = i, b = i; while (a > 0 && isW(t[a - 1])) a--; while (b < t.length && isW(t[b])) b++; return { first: span, a, last: span, b }; }
  }
  const p = e.target.closest && e.target.closest('p.wp');
  return p && page.contains(p) ? { para: p } : null;
}
// Puts the comment's markers in the document around those words (or at the end of the paragraph), and its words in the comments part.
function wCommentAdd(w, at, text) {
  if (!wCommentsMade(w)) return null;
  const id = wNextId(w);
  if (at.para) {
    const p = w.paras[+at.para.dataset.pi];
    p.appendChild(wMarker(w, 'commentRangeStart', id)); p.appendChild(wMarker(w, 'commentRangeEnd', id)); p.appendChild(wRefRun(w, id));
  } else {
    const s = w.runs[+at.first.dataset.ri], e = w.runs[+at.last.dataset.ri];
    s.parentNode.insertBefore(wMarker(w, 'commentRangeStart', id), s);
    const end = wMarker(w, 'commentRangeEnd', id);
    e.parentNode.insertBefore(end, e.nextSibling);
    e.parentNode.insertBefore(wRefRun(w, id), end.nextSibling);
  }
  const author = store.get('gs.cmAuthor', '') || 'Teacher';
  const c = w.cdoc.createElementNS(W_NS, 'w:comment');
  c.setAttributeNS(W_NS, 'w:id', id); c.setAttributeNS(W_NS, 'w:author', author);
  c.setAttributeNS(W_NS, 'w:date', new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
  c.setAttributeNS(W_NS, 'w:initials', author.split(/\s+/).map(x => x[0] || '').join('').slice(0, 3).toUpperCase());
  wCommentSet(w, c, text);
  w.cdoc.documentElement.appendChild(c);
  wCommentsKeep(w);
  return id;
}
function wCommentDrop(w, id) {
  for (const c of wCommentEls(w)) if (wId(c) === id) c.parentNode.removeChild(c);
  for (const k of ['commentRangeStart', 'commentRangeEnd']) for (const e of [...w.doc.getElementsByTagNameNS(W_NS, k)]) if (wId(e) === id) e.parentNode.removeChild(e);
  for (const e of [...w.doc.getElementsByTagNameNS(W_NS, 'commentReference')]) {
    if (wId(e) !== id) continue;
    const r = e.parentNode;
    if (r.localName === 'r' && [...r.children].every(c => c === e || c.localName === 'rPr')) r.parentNode.removeChild(r); else r.removeChild(e);
  }
  wCommentsKeep(w);
}
// The comments on screen: the words lit, a number after them, and a card in the margin beside them.
function wNotesPaint(w, page, aside) {
  const { runs, order, para } = wCommentMap(w), num = id => order.indexOf(id) + 1, last = new Map();
  for (const b of page.querySelectorAll('.wcref')) b.remove();
  for (const s of page.querySelectorAll('[data-ri]')) {
    const ids = (runs.get(w.runs[+s.dataset.ri]) || []).filter(id => order.includes(id));
    s.classList.toggle('wcm', ids.length > 0);
    if (ids.length) s.dataset.cm = ids.join(' '); else delete s.dataset.cm;
    for (const id of ids) last.set(id, s);
  }
  const anchor = new Map();
  for (const id of order) {
    const b = document.createElement('sup'); b.className = 'wcref'; b.contentEditable = 'false'; b.dataset.cm = id; b.textContent = num(id);
    const s = last.get(id), p = para.get(id), pel = !s && p ? page.querySelector('p.wp[data-pi="' + w.paras.indexOf(p) + '"]') : null;
    if (s) s.after(b); else if (pel) pel.appendChild(b); else continue;
    anchor.set(id, b);
  }
  const cs = new Map(wCommentEls(w).map(c => [wId(c), c]));
  aside.hidden = !order.length;
  aside.innerHTML = order.map(id => { const c = cs.get(id), who = c.getAttributeNS(W_NS, 'author') || c.getAttribute('w:author') || '';
    return '<button type="button" class="wnote" data-cm="' + esc(id) + '"><i>' + num(id) + '</i><span>' + esc(wCommentText(c) || ' ') + (who ? '<small>' + esc(who) + '</small>' : '') + '</span></button>'; }).join('');
  // each card beside its words, pushed down so none overlap
  requestAnimationFrame(() => {
    const top0 = aside.getBoundingClientRect().top; let y = 0;
    for (const card of aside.children) {
      const a = anchor.get(card.dataset.cm), want = a ? a.getBoundingClientRect().top - top0 - 6 : y;
      y = Math.max(y, want); card.style.top = y + 'px'; y += card.offsetHeight + 8;
    }
    aside.style.height = y + 'px';
  });
}
// The comment box, below the words. done(text) on Done (empty text deletes), done(null) on Esc.
function wNotePop(host, near, text, isNew, done) {
  for (const p of host.querySelectorAll('.pop')) p.remove();
  const pop = document.createElement('div'); pop.className = 'pop wpop';
  pop.innerHTML = '<div class="lbl">' + (isNew ? 'New comment' : 'Comment') + '</div><textarea placeholder="Type a comment… Enter to finish, Shift Enter for a new line"></textarea>' +
    '<div class="lbl" data-bank>My saved comments</div><div class="chips"></div>' +
    '<div class="row"><button class="btn sm" data-a="star" title="Keep this comment so you can reuse it">☆ Save for reuse</button><span class="sp"></span>' +
    (isNew ? '' : '<button class="btn sm" data-a="del">Delete</button>') + '<button class="btn sm primary" data-a="ok">Done</button></div>';
  const ta = pop.querySelector('textarea'); ta.value = text || '';
  const chips = () => {
    pop.querySelector('.chips').innerHTML = bank.map((t, i) => '<span class="chip" data-i="' + i + '"><span title="' + esc(t) + '">' + esc(t) + '</span><button data-x="' + i + '" title="Remove from saved comments" aria-label="Remove">×</button></span>').join('');
    pop.querySelector('[data-bank]').hidden = !bank.length;
  };
  chips();
  host.appendChild(pop);
  const H = host.getBoundingClientRect(), N = near.getBoundingClientRect();
  pop.style.left = clamp(N.left - H.left, 0, Math.max(0, H.width - pop.offsetWidth)) + 'px';
  pop.style.top = (N.bottom - H.top + 8) + 'px';
  ta.focus({ preventScroll: true });
  let over = false;
  const close = v => { if (over) return; over = true; pop.remove(); done(v); };
  pop.addEventListener('mousedown', e => e.stopPropagation());
  pop.addEventListener('mouseup', e => e.stopPropagation());
  pop.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(null); }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); close(ta.value.trim()); }   // Enter finishes, Shift Enter is a new line, as on a PDF paper
  });
  pop.addEventListener('click', e => {
    e.stopPropagation();
    const x = e.target.closest('[data-x]');
    if (x) { bank.splice(+x.dataset.x, 1); store.set('gs.bank', bank); chips(); return; }
    const ch = e.target.closest('.chip');
    if (ch) { const t = bank[+ch.dataset.i]; ta.value = ta.value.trim() ? ta.value.trim() + ' ' + t : t; ta.focus(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'star') { const t = ta.value.trim(); if (t && !bank.includes(t)) { bank.unshift(t); store.set('gs.bank', bank); chips(); toast('Saved. It’ll show up under every new comment.'); } }
    if (b.dataset.a === 'ok') close(ta.value.trim());
    if (b.dataset.a === 'del') close('');
  });
  return pop;
}
// Hooks one Word card up: the Comment tool or the Comment button on selected words, a right-click, and clicking a comment to change it.
// flush puts any typing in progress into the document first; save writes the file.
function wireWordNotes(w, el, page, aside, editing, flush, save) {
  if (wComments(w) === false) { const b = el.querySelector('[data-wnote]'); if (b) b.remove(); return; }
  const host = el.querySelector('.wdoc');
  const paint = () => wNotesPaint(w, page, aside);
  paint();
  const open = id => {
    const c = wCommentEls(w).find(x => wId(x) === id); if (!c) return;
    const near = page.querySelector('.wcref[data-cm="' + CSS.escape(id) + '"]') || aside.querySelector('[data-cm="' + CSS.escape(id) + '"]');
    wNotePop(host, near, wCommentText(c), false, async v => {
      if (v == null || v === wCommentText(c)) return;
      if (v) { wCommentSet(w, c, v); wCommentsKeep(w); } else wCommentDrop(w, id);
      paint(); await save();
    });
  };
  const add = at => {
    flush();
    let lit = [];
    if (!at.para) {   // split first (the end, then the start), so the comment covers exactly the words
      const sameSpan = at.first === at.last;
      wSplitSpan(w, at.last, at.b);
      const first = wSplitSpan(w, at.first, at.a) || at.first;
      at = { first, last: sameSpan ? first : at.last };
      const all = [...page.querySelectorAll('[data-ri]')], i = all.indexOf(at.first), j = all.indexOf(at.last);
      lit = all.slice(i, j + 1);
    }
    for (const s of lit) s.classList.add('wpend');
    const near = at.para || at.last;
    window.getSelection().removeAllRanges();
    wNotePop(host, near, '', true, async v => {
      for (const s of lit) s.classList.remove('wpend');
      if (!v) return;
      if (!wCommentAdd(w, at, v)) return toast('This Word file’s comments couldn’t be read, so a new one can’t be added here. Download it to comment in Word.');
      paint(); await save();
    });
  };
  page.addEventListener('mouseup', e => {
    if (e.button !== 0 || editing() || e.target.closest('.wchk')) return;
    const sel = window.getSelection(), picked = sel && !sel.isCollapsed;
    const hit = !picked && e.target.closest('[data-cm]');
    if (hit) return open(hit.dataset.cm.split(' ')[0]);
    if (tool !== 'note' || (!picked && e.target.closest('td.rcell'))) return;
    const at = wPickWords(w, page, e);
    if (at) add(at);
  });
  page.addEventListener('contextmenu', e => {
    if (editing() || e.shiftKey) return;   // while typing, the browser's own menu (spelling) stays
    e.preventDefault();
    const sel = window.getSelection(), hit = sel.isCollapsed && e.target.closest('[data-cm]');
    if (hit) return open(hit.dataset.cm.split(' ')[0]);
    const at = wPickWords(w, page, e);
    if (at) add(at); else toast('Right-click on a word to comment on it');
  });
  aside.addEventListener('click', e => { const c = e.target.closest('[data-cm]'); if (c) open(c.dataset.cm); });
  const btn = el.querySelector('[data-wnote]');
  if (btn) {
    btn.addEventListener('mousedown', e => e.preventDefault());   // keeps her selection
    btn.addEventListener('click', () => { const at = wPickWords(w, page, null); if (at) add(at); else toast('Select the words to comment on, then press Comment. Or pick the Comment tool and click a word.'); });
  }
}
