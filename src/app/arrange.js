/* ---------------- arrange pages: combine files, drag pages, take pages out ---------------- */
async function thumbFor(path, p, extra) {
  const f = batch && fileByPath(batch.students[cur], path), r = (rotOf(f, p) + (extra || 0)) % 360, k = path + '|' + p + '|' + r + (skewOf(f, p) ? '|' + skewOf(f, p) : '');
  const anon = anonOn();   // these carry their covers, which can change, so they're drawn each time
  if (!anon && thumbCache.has(k)) return thumbCache.get(k);
  const doc = docMap.get(path); if (!doc) return '';
  const page = await doc.getPage(p + 1), at = sc => page.getViewport({ scale: sc, rotation: ((page.rotate || 0) + r) % 360 });
  const vp = at(180 / at(1).width);
  const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, transform: skewXf(f, p, vp), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  if (anon) await anonPaint(ctx, batch.students[cur], f, p, page, vp, extra);
  const u = c.toDataURL('image/jpeg', 0.7);
  if (!anon) thumbCache.set(k, u);
  return u;
}
function openArrange() {
  const st = batch.students[cur];
  const start = layoutOf(st).map(d => ({ name: d.name, file: d.file, pages: d.pages.map(x => x.slice()), out: docAuto(st, d) ? null : !docIn(st, d) }));
  let L = JSON.parse(JSON.stringify(start)), tray = outPages(st).map(x => x.slice());   // pages taken out before wait here to be dragged back
  const lp = { ...(batch.lightPg || {}) }, lit = lightLive(st);   // page lighting choices, kept on Save
  const nameOf = path => fileShown(st, (fileByPath(st, path) || { name: path }).name);
  let drag = null, sel = new Set(), anchor = null, size = +store.get('gs.arrsize', 1);
  const turns = new Map();   // pages turned here, in quarter turns to the right; done on Save
  const turnKey = ([path, p]) => path + '|' + p;
  const lists = () => L.map(d => d.pages).concat([tray]);
  const listOf = w => w === 'tray' ? tray : L[+w].pages;
  const itemAt = el => listOf(el.dataset.where)[+el.dataset.i];
  const picked = () => lists().flatMap(l => l.filter(it => sel.has(it)));
  const many = st.files.filter(viewable).length > 1;
  // The order of whole files on screen: Word and other files (by 'f:<path>') among the files of pages (the objects in L).
  const seqNow = () => fileSeq(st).map(it => it.f ? 'f:' + it.f.path : L[it.di]);
  let strip = seqNow(), everyone = false;
  const seqDefault = () => { const keep = st.forder; st.forder = null; const v = fileSeq(st).map(it => it.f ? 'f:' + it.f.path : L[it.di]); st.forder = keep; return v; };
  const cardName = id => { const f = fileByPath(st, id.slice(2)); return fileShown(st, f ? f.name : id.slice(2)); };
  const kindOf = id => { const f = fileByPath(st, id.slice(2)); return !f ? '' : f.kind === 'docx' ? 'Word' : f.kind === 'text' ? 'Text' : 'File'; };
  const drawStrip = () => {
    strip = strip.filter(x => typeof x === 'string' || L.includes(x));
    for (const d of L) if (!strip.includes(d)) strip.push(d);
    const el = $('#arrSeq'); if (!el) return;
    el.hidden = !strip.some(x => typeof x === 'string');
    el.innerHTML = '<div class="aseqh"><b>Order of files</b><span class="muted">Word and other files sit among the page files in this order.</span><span class="sp"></span>' +
      '<label class="chk" style="margin:0;font-size:13px"><input type="checkbox" data-sqall' + (everyone ? ' checked' : '') + '> Use this order for every student</label></div>' +
      '<div class="aseqr">' + strip.map((x, k) => '<span class="aseqc' + (typeof x === 'string' ? ' card' : '') + '"><b>' + (k + 1) + '</b> ' + esc(typeof x === 'string' ? cardName(x) : fileShown(st, x.name)) + '<span class="muted">' + (typeof x === 'string' ? kindOf(x) : x.pages.length + (x.pages.length === 1 ? ' page' : ' pages')) + '</span>' +
        '<button data-sq="' + k + ':-1" title="Earlier"' + (k ? '' : ' disabled') + '>←</button><button data-sq="' + k + ':1" title="Later"' + (k < strip.length - 1 ? '' : ' disabled') + '>→</button></span>').join('') + '</div>';
  };
  const render = () => {
    const col = (items, where, head) => '<div class="acol" data-where="' + where + '">' + head +
      '<div class="adrop" data-where="' + where + '">' + items.map(([path, p], i) => {
        const f = fileByPath(st, path), off = lit && f && !pageLit(st, f, p, lp);
        return '<div class="ath" draggable="true" data-where="' + where + '" data-i="' + i + '"><img data-th="' + esc(path) + '|' + p + '" alt=""><div class="cap">' + (where === 'tray' ? '' : '<b>' + (i + 1) + '</b> · ') + 'p. ' + (p + 1) + (many ? ' · ' + esc(nameOf(path)) : '') + '</div>' +
          (off ? '<span class="aoff">☀ off</span>' : '') +
          (where === 'tray' ? '' : '<button class="rm" data-rm="' + where + ':' + i + '" title="Take this page out" aria-label="Take this page out">×</button>') + '</div>';
      }).join('') +
      (items.length ? '' : '<div class="empty">' + (where === 'tray' ? 'Pages you take out land here.' : 'Drag pages here') + '</div>') + '</div></div>';
    $('#arrBody').style.setProperty('--aw', ([90, 130, 190][size] || 130) + 'px');
    $('#arrBody').innerHTML = '<div class="acols">' + L.map((d, di) => col(d.pages, di,
      '<div class="ahead"><input type="text" data-name="' + di + '" value="' + esc(fileShown(st, d.name)) + '" aria-label="File name"' + (anonOn() ? ' readonly title="File names can’t be changed while names are hidden"' : '') + '>' +
      '<label class="chk" style="margin:4px 0 0;font-size:13px"><input type="checkbox" data-in="' + di + '"' + (docIn(st, d) ? ' checked' : '') + '> Send back to the student</label>' +
      (L.length > 1 ? '<button class="link" style="font-size:12px" data-delfile="' + di + '">Remove this file (pages go to the tray)</button>' : '') + '</div>')).join('') +
      col(tray, 'tray', '<div class="ahead"><b>Taken out</b><div class="muted" style="font-size:12px">Drag back to use again</div></div>') + '</div>';
    for (const img of $('#arrBody').querySelectorAll('img[data-th]')) {
      const [path, p] = [img.dataset.th.slice(0, img.dataset.th.lastIndexOf('|')), +img.dataset.th.slice(img.dataset.th.lastIndexOf('|') + 1)];
      thumbFor(path, p, 90 * (turns.get(path + '|' + p) || 0)).then(u => { img.src = u; });
    }
    for (const b of document.querySelectorAll('#arrSize [data-asz]')) b.setAttribute('aria-pressed', +b.dataset.asz === size);
    drawStrip(); drawSel();
  };
  // Selection only, in place, so a double-click still lands on the same page.
  const drawSel = () => {
    for (const el of $('#arrBody').querySelectorAll('.ath')) el.classList.toggle('sel', sel.has(itemAt(el)));
    const n = sel.size;
    $('#arrSelInfo').textContent = n ? n + (n === 1 ? ' page picked' : ' pages picked') : 'No pages picked';
    $('#arrSelInfo').classList.toggle('on', !!n);
    for (const b of document.querySelectorAll('#arrBar [data-mv],#arrBar [data-aout],#arrBar [data-alight],#arrBar [data-aturn]')) b.disabled = !n;
  };
  const move = how => {
    if (!sel.size) return toast('Pick pages first');
    for (const l of lists()) {
      if (how === 'start' || how === 'end') { const a = l.filter(it => sel.has(it)), b = l.filter(it => !sel.has(it)); l.splice(0, l.length, ...(how === 'start' ? a.concat(b) : b.concat(a))); }
      else if (how < 0) { for (let i = 1; i < l.length; i++) if (sel.has(l[i]) && !sel.has(l[i - 1])) [l[i - 1], l[i]] = [l[i], l[i - 1]]; }
      else { for (let i = l.length - 2; i >= 0; i--) if (sel.has(l[i]) && !sel.has(l[i + 1])) [l[i], l[i + 1]] = [l[i + 1], l[i]]; }
    }
    render();
  };
  const turn = () => {
    if (!sel.size) return toast('Pick pages first');
    for (const it of picked()) turns.set(turnKey(it), ((turns.get(turnKey(it)) || 0) + 1) % 4);
    render();
  };
  const takeOut = () => {
    if (!sel.size) return toast('Pick pages first');
    for (const d of L) { const out = d.pages.filter(it => sel.has(it)); d.pages = d.pages.filter(it => !sel.has(it)); tray.push(...out); }
    render();
  };
  openDlg('<div class="bh"><h2>Arrange pages</h2><span class="muted">' + esc(shownName(st, cur)) + '</span><button class="icon" data-cancel aria-label="Close">✕</button></div>' +
    '<div class="arrbar" id="arrBar"><span class="seg" id="arrSize"><button data-asz="0">S</button><button data-asz="1">M</button><button data-asz="2">L</button></span>' +
      '<button class="btn sm" data-mv="start" title="Move the picked pages to the start of their file">⇤ To start</button><button class="btn sm" data-mv="-1" title="Move the picked pages one place earlier (← key)">← Earlier</button>' +
      '<button class="btn sm" data-mv="1" title="Move the picked pages one place later (→ key)">Later →</button><button class="btn sm" data-mv="end" title="Move the picked pages to the end of their file">To end ⇥</button>' +
      '<button class="btn sm" data-aout title="Take the picked pages out (Delete key)">Take out</button>' +
      '<button class="btn sm" data-aturn title="Turn the picked pages a quarter turn to the right (R key)">⟳ Turn</button>' +
      (lit ? '<button class="btn sm" data-alight title="Turn lighting off or on for the picked pages">☀ Lighting on/off</button>' : '') +
      '<span class="sp"></span><span id="arrSelInfo"></span></div>' +
    '<div id="arrSeq" class="aseq" hidden></div>' +
    '<p class="muted sphint" style="margin:8px 18px 0">Click a page to pick it, Shift-click to pick a run, ' + modKey() + '-click to add one. Drag the picked pages, or use the buttons or the ← → keys. Double-click a page to see it big.</p>' +
    '<div class="bb" id="arrBody"></div>' +
    '<div class="bf" style="justify-content:space-between"><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-combine>Combine into one file</button><button class="btn" data-newfile>+ New file</button><button class="btn" data-reset>Back to how it was turned in</button></span>' +
    '<span style="display:flex;gap:8px"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></span></div>');
  const box = $('#dlgBox'); box.classList.add('arrbox');
  render();
  box.tabIndex = -1; box.focus();
  const live = { signal: dlgOff.signal };
  box.addEventListener('dragstart', e => {
    const t = e.target.closest('.ath'); if (!t) return;
    const it = itemAt(t);
    if (!sel.has(it)) { sel = new Set([it]); anchor = it; drawSel(); }
    drag = { item: it };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'page');
    if (sel.size > 1) { const gh = document.createElement('div'); gh.className = 'spghost'; gh.textContent = sel.size + ' pages'; document.body.appendChild(gh); e.dataTransfer.setDragImage(gh, 20, 20); setTimeout(() => gh.remove(), 0); }
    setTimeout(() => { for (const el of box.querySelectorAll('.ath.sel')) el.classList.add('dragging'); }, 0);
  }, live);
  box.addEventListener('dragend', () => { drag = null; for (const x of box.querySelectorAll('.dragging,.ins,.insEnd')) x.classList.remove('dragging', 'ins', 'insEnd'); }, live);
  const dropIndex = (zone, e) => {
    const kids = [...zone.querySelectorAll('.ath')];
    for (let k = 0; k < kids.length; k++) {
      const r = kids[k].getBoundingClientRect();
      if (e.clientY < r.top) return k;
      if (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2) return k;
    }
    return kids.length;
  };
  box.addEventListener('dragover', e => {
    const zone = e.target.closest('.adrop'); if (!zone || !drag) return;
    e.preventDefault();
    for (const x of box.querySelectorAll('.ins,.insEnd')) x.classList.remove('ins', 'insEnd');
    const k = dropIndex(zone, e), kids = zone.querySelectorAll('.ath');
    if (kids[k]) kids[k].classList.add('ins'); else zone.classList.add('insEnd');
  }, live);
  box.addEventListener('drop', e => {
    const zone = e.target.closest('.adrop'); if (!zone || !drag) return;
    e.preventDefault();
    const dst = listOf(zone.dataset.where), k = dropIndex(zone, e), moving = picked();
    // Land in front of the first page at the drop spot that isn't itself moving.
    let before = null; for (let j = k; j < dst.length; j++) if (!sel.has(dst[j])) { before = dst[j]; break; }
    for (const l of lists()) for (let j = l.length - 1; j >= 0; j--) if (sel.has(l[j])) l.splice(j, 1);
    dst.splice(before ? dst.indexOf(before) : dst.length, 0, ...moving);
    drag = null; render();
  }, live);
  box.addEventListener('input', e => { if (e.target.dataset.name != null) L[+e.target.dataset.name].name = e.target.value; }, live);
  box.addEventListener('change', e => { if (e.target.dataset.in != null) L[+e.target.dataset.in].out = !e.target.checked; if (e.target.dataset.sqall != null) everyone = e.target.checked; }, live);
  box.ondblclick = e => { const th = e.target.closest('.ath'); if (th && !e.target.closest('[data-rm]')) { const [path, p] = itemAt(th); bigPage(docMap.get(path), p, thumbCache.get(path + '|' + p), null, { st, f: fileByPath(st, path), turned: 90 * (turns.get(path + '|' + p) || 0) }); } };
  box.onkeydown = e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !sel.size || $('#spBig')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); takeOut(); }
    else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); turn(); }
  };
  box.onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('#spBig')) return splitZoomClose();
    const sq = e.target.closest('[data-sq]');
    if (sq) { const [k, dk] = sq.dataset.sq.split(':').map(Number), j = k + dk; if (j >= 0 && j < strip.length) [strip[k], strip[j]] = [strip[j], strip[k]]; return drawStrip(); }
    const rm = e.target.closest('[data-rm]');
    if (rm) { const [w, i] = rm.dataset.rm.split(':'); tray.push(...listOf(w).splice(+i, 1)); return render(); }
    const th = e.target.closest('.ath');
    if (th) {
      const it = itemAt(th), l = listOf(th.dataset.where);
      if (e.shiftKey && anchor && l.includes(anchor)) { const a = l.indexOf(anchor), b = l.indexOf(it); sel = new Set(l.slice(Math.min(a, b), Math.max(a, b) + 1)); }
      else if (e.metaKey || e.ctrlKey) { sel.has(it) ? sel.delete(it) : sel.add(it); anchor = it; }
      else { sel = new Set([it]); anchor = it; }
      return drawSel();
    }
    if (e.target.closest('.adrop') && !e.target.closest('button,input')) { sel = new Set(); return drawSel(); }
    const sz = e.target.closest('[data-asz]');
    if (sz) { size = +sz.dataset.asz; store.set('gs.arrsize', size); return render(); }
    const mv = e.target.closest('[data-mv]');
    if (mv) return move(/^-?\d+$/.test(mv.dataset.mv) ? +mv.dataset.mv : mv.dataset.mv);
    if (e.target.closest('[data-aout]')) return takeOut();
    if (e.target.closest('[data-aturn]')) return turn();
    if (e.target.closest('[data-alight]')) {
      const its = picked().map(([path, p]) => [fileByPath(st, path), p]).filter(([f]) => f);
      const on = !its.every(([f, p]) => pageLit(st, f, p, lp));
      for (const [f, p] of its) setPageLit(st, f, p, on, lp);
      return render();
    }
    const df = e.target.closest('[data-delfile]');
    if (df) { tray.push(...L[+df.dataset.delfile].pages); L.splice(+df.dataset.delfile, 1); return render(); }
    if (e.target.closest('[data-combine]')) {
      const keep = L.filter(d => !d.out);
      const all = (keep.length ? keep : L).flatMap(d => d.pages);
      const first = (keep.length ? keep : L)[0] || { name: 'Combined.pdf' };
      L = [{ name: first.name, pages: all, out: false }].concat(L.filter(d => keep.length && d.out));
      return render();
    }
    if (e.target.closest('[data-newfile]')) { L.push({ name: 'New file ' + (L.length + 1) + '.pdf', pages: [], out: false }); return render(); }
    if (e.target.closest('[data-reset]')) { L = defaultLayout(st).map(d => ({ ...d, pages: d.pages.map(x => x.slice()), out: null })); tray = []; sel = new Set(); strip = seqDefault(); return render(); }
    if (e.target.closest('[data-save]')) {
      drawStrip();
      const inStrip = strip.filter(x => typeof x !== 'string' && x.pages.length);
      L = inStrip.concat(L.filter(d => !inStrip.includes(d) && d.pages.length));
      const ord = strip.filter(x => typeof x === 'string' || L.includes(x)).map(x => typeof x === 'string' ? x : 'd' + L.indexOf(x));
      L = L.filter(d => d.pages.length).map(d => ({ name: (d.name.trim() || 'File') .replace(/(\.pdf)?$/i, '.pdf'), file: d.file, pages: d.pages, out: d.out }));
      const def = defaultLayout(st);
      const same = L.length === def.length && L.every((d, k) => d.file === def[k].file && d.name === def[k].name && JSON.stringify(d.pages) === JSON.stringify(def[k].pages) && d.out == null);
      st.layout = same ? null : L.map(d => ({ ...d, out: d.out == null ? undefined : d.out }));
      if (st.layout) for (const d of st.layout) if (d.out === undefined) delete d.out;
      const plain = fileSeq({ ...st, forder: null }).map(it => it.id);
      st.forder = JSON.stringify(ord) === JSON.stringify(plain) ? null : ord;
      if (everyone) {   // line the others up the same way, matching files by kind
        const tmpl = fileSeq(st).map(it => seqSig(st, it));
        let n = 0;
        for (const o of batch.students) {
          if (o === st) continue;
          const used = new Set(), sq = fileSeq({ ...o, forder: null });
          const at = it => { const sig = seqSig(o, it); for (let k = 0; k < tmpl.length; k++) if (tmpl[k] === sig && !used.has(k)) { used.add(k); return k; } return tmpl.length; };
          const ranked = sq.map((it, k) => [at(it), k, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2].id);
          o.forder = JSON.stringify(ranked) === JSON.stringify(sq.map(it => it.id)) ? null : ranked; n++;
        }
        toast('Same order for ' + (n + 1) + ' students');
      }
      batch.lightPg = lp;
      const todo = [...turns].filter(([, q]) => q);
      saveSoon(); closeDlg(); renderList();
      (async () => {
        for (const [key, q] of todo) { const i = key.lastIndexOf('|'), f = fileByPath(st, key.slice(0, i)); for (let k = 0; k < q; k++) await turnPages(f, [+key.slice(i + 1)], 1); }
        openStudent(cur);
      })();
      toast('Saved. Export uses this order.');
    }
  };
}

function fitScale(pg) {
  const P = $('#paper'), cs = getComputedStyle(P);   // the tool dock sits in the left padding
  let s = (P.clientWidth - (parseFloat(cs.paddingLeft) || 18) - (parseFloat(cs.paddingRight) || 18) - 4) / (pg.W + pg.side);
  if (disp.fit === 'page') s = Math.min(s, (P.clientHeight - 40) / pg.H);
  s = Math.min(s, 1000 / pg.W);   // on a very wide window the page stops growing at a comfortable reading size; the zoom buttons go past it
  return Math.max(0.3, Math.min(2.2, s)) * zoom;
}
async function renderPage(pg) {
  const s = fitScale(pg), dpr = window.devicePixelRatio || 1, job = pg.job = (pg.job || 0) + 1;
  pg.s = s;
  // The page takes its new size at once, so a stroke started now lands where it's drawn. The old picture stands in until the new one is ready.
  const c = pg.canvas;
  c.width = Math.ceil((pg.W + pg.side) * s * dpr); c.height = Math.ceil(pg.H * s * dpr);
  c.style.width = (pg.W + pg.side) * s + 'px'; c.style.height = pg.H * s + 'px';
  if (pg === pages[0]) $('#paper').style.setProperty('--pgw', c.style.width);   // the bar above lines up with the page
  if (pg.rchip) pg.rchip.style.left = pg.W * s + 'px';
  if (anonOn() && !pg.covers) pg.bmp = null;   // nothing shows until its name covers are ready
  if (pg === pages[0]) lastSheet = { w: (pg.W + pg.side) * s, h: pg.H * s, p: pg.W * s };
  if (!pg.bmp) { const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#F6F7F9'; x.fillRect(Math.round(pg.W * s * dpr), 0, c.width, c.height); }   // a white sheet at once; the words follow
  draw(pg);
  const vp = vpRot(pg.file, pg.idx, pg.page, s * dpr);
  const bmp = document.createElement('canvas');
  bmp.width = Math.ceil(vp.width); bmp.height = Math.ceil(vp.height);
  const bctx = bmp.getContext('2d'); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, bmp.width, bmp.height);
  try { await pg.page.render({ canvasContext: bctx, viewport: vp, transform: skewXf(pg.file, pg.idx, vp), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; }
  if (job !== pg.job) return;   // a newer size or turn came along while this one was drawing
  loadLines(pg);
  if (anonOn() && !pg.covers) pg.covers = await anonCovers(batch.students[cur], pg);
  if (job !== pg.job) return;
  pg.bmp = bmp;
  draw(pg);
}
// part: just this box of the page (in points) is drawn again, which keeps a pen stroke quick on a large page.
function draw(pg, live, part) {
  if (!pg.bmp) return;
  const c = pg.canvas, ctx = c.getContext('2d'), k = c.width / (pg.W + pg.side);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (part) { const x = Math.floor(part.x * k), y = Math.floor(part.y * k); ctx.save(); ctx.beginPath(); ctx.rect(x, y, Math.ceil((part.x + part.w) * k) - x, Math.ceil((part.y + part.h) * k) - y); ctx.clip(); }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  const src = lightBmp(pg);
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, pg.W * k, pg.H * k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const anon = anonOn() && batch.students[cur];
  if (anon && pg.covers) { ctx.fillStyle = '#111'; for (const r of pg.covers) ctx.fillRect(r.x, r.y, r.w, r.h); }
  const marks = pg.marks().concat(anon ? scrubMarks(pg.extra || [], anonRx(anon)) : pg.extra || [], live || [], pg.pending ? [pg.pending] : []);
  pg.boxes = drawMarks(ctx, marks, pg.W, pg.H, pg.side, { sel: selected && selected.page === pg && selected.mark !== pg.editing ? selected.mark : null, editing: pg.editing, s: pg.s, line: pg.lineOn || null });
  if (pg.ghost) { const b = pg.ghost; ctx.save(); ctx.strokeStyle = '#1F6FB2'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore(); }
  if (part) ctx.restore();
}
function redrawAll() { for (const pg of pages) draw(pg); }
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => pages.forEach(renderPage), 150); });

