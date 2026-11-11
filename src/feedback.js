/* ---------------- the feedback page: the first page of a returned paper ----------------
   What the student reads first: the score, each rubric row with the level given and what that level means, the teacher's
   comment, and every comment written on the paper with the page it is on. It is drawn when the paper is exported, from
   what is already saved. Nothing new is stored but the choice to add it (gs.xfb), and bringing an editable export back
   in rebuilds from the original pages, so the feedback page never comes back as a page of the paper. */
const fbOn = () => store.get('gs.xfb', true) !== false;
const FB_INK = '#1E2024', FB_INK2 = '#3F444C', FB_MUTED = '#5C616A', FB_LINE = '#E4E6EA', FB_BLUE = '#1F6FB2', FB_SOFT = '#E6F0F8';

// What the page says for this student and this file, or null when there is nothing to say (no score, no comment, no comment on the paper).
function fbData(st, d) {
  // A retake: each paper carries its own try's score, rows and comment. The newer one also says what counts when that isn't its own score.
  const tries = st.grade.tries || [], tn = tries.length ? tryOfFile(st, fileByPath(st, (d.pages[0] || [])[0])) : 0, old = tn ? tries[tn - 1] : null, cnt = tries.length && !old ? gradeOf(st) : null;
  const g = old ? { total: old.total, pct: old.pct, outOf: old.max, status: old.late ? 'late' : '' } : tries.length ? tryGrade(st) : gradeOf(st), rub = setup.mode === 'rubric', c = batchClass();
  if (cnt && !g.status && st.grade.status === 'late') g.status = 'late';
  const rubricOf = old ? old.rubric || [] : st.grade.rubric;
  const rows = rub ? setup.criteria.map((name, i) => { const v = rubricOf[i]; return v == null ? null : { name, v, text: ((setup.levels && setup.levels[i] && setup.levels[i][Math.floor(v)]) || '').trim() }; }).filter(Boolean) : [];
  const notes = [];
  d.pages.forEach(([path, p], k) => {
    const f = fileByPath(st, path); if (!f) return;
    const all = (f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []).filter(m => m.t === 'note' && (m.text || '').trim());
    const numbered = all.filter(n => n.hl).sort((a, b) => a.ay - b.ay || a.ax - b.ax);   // the numbers the page itself shows
    for (const n of [...all].sort((a, b) => a.ay - b.ay || a.ax - b.ax)) notes.push({ n: numbered.indexOf(n) + 1, text: n.text.trim(), color: n.color, page: k });
  });
  const comment = ((old ? old.comment : st.grade.comment) || '').trim(), scored = g.total != null && !g.partial;
  const trySay = old ? tr(tryName(tn)) : cnt ? tr('Retake') + (cnt.tryNow && cnt.pct !== g.pct ? ' · ' + tr('counts as') + ' ' + fmtPct(cnt.pct) : '') : '';
  if (!scored && !rows.length && !comment && !notes.length) return null;
  const rn = rosterNames(), who = rn.get(st) || st.key;   // the paper goes back to its student, so it carries their name even while she marks with names hidden
  return { title: (batch.assignment && batch.assignment.name) || batch.name, sub: [who, c && c.name, tr('returned ' + fmtDay(Date.now()))].filter(Boolean).join(' · '),
    total: scored ? g.total : null, max: g.outOf != null ? g.outOf : maxPoints(), pct: scored ? g.pct : null, status: [g.status ? tr(STATUS_LABEL[g.status]) : '', trySay].filter(Boolean).join(' · '), rows, comment, notes };
}

// Lays the page out as blocks, each with a height and a way to draw itself at a y. off is how many feedback pages come before the paper.
function fbBlocks(ctx, data, W, M, off) {
  const UI = 'Inter, ' + FONT, cw = W - 2 * M, out = [];
  const wrap = (t, font, w) => {
    ctx.font = font; const lines = [];
    for (const para of String(t).split(/\n/)) {
      let line = '';
      for (let word of para.split(/\s+/).filter(Boolean)) {
        while (ctx.measureText(word).width > w) { let k = word.length - 1; while (k > 1 && ctx.measureText(word.slice(0, k)).width > w) k--; if (line) { lines.push(line); line = ''; } lines.push(word.slice(0, k)); word = word.slice(k); }   // a word longer than the line
        const t2 = line ? line + ' ' + word : word;
        if (line && ctx.measureText(t2).width > w) { lines.push(line); line = word; } else line = t2;
      }
      lines.push(line);
    }
    while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
    return lines;
  };
  const text = (lines, font, color, x, y, lh) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh)); };
  const cap = t => out.push({ h: 34, draw: y => { ctx.font = '600 8.5px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; try { ctx.letterSpacing = '0.9px'; } catch { } ctx.fillText(t.toUpperCase(), M, y + 26); try { ctx.letterSpacing = '0px'; } catch { } } });

  // the assignment, whose paper it is, and the score
  const big = data.total != null ? fmtNum(data.total) : '', of = data.total != null && data.max ? ' / ' + fmtNum(data.max) : '';
  ctx.font = '700 28px ' + UI; const bw = ctx.measureText(big).width; ctx.font = '13px ' + UI; const ow = ctx.measureText(of).width;
  const sw = big ? Math.max(bw + ow, 64) + 18 : data.status ? 110 : 0;
  const tl = wrap(data.title, '700 19px ' + UI, cw - sw), sl = wrap(data.sub, '11.5px ' + UI, cw - sw);
  const hh = Math.max(tl.length * 24 + sl.length * 16 + 6, big ? 56 : 0) + 14;
  out.push({ h: hh + 4, draw: y => {
    text(tl, '700 19px ' + UI, FB_INK, M, y + 20, 24);
    text(sl, '11.5px ' + UI, FB_MUTED, M, y + 20 + (tl.length - 1) * 24 + 20, 16);
    ctx.textAlign = 'right';
    if (big) {
      ctx.font = '13px ' + UI; ctx.fillStyle = FB_MUTED; ctx.fillText(of, M + cw, y + 24);
      ctx.font = '700 28px ' + UI; ctx.fillStyle = FB_INK; ctx.fillText(big, M + cw - ow, y + 24);
      if (data.pct != null) { ctx.font = '700 14px ' + UI; ctx.fillStyle = FB_BLUE; ctx.fillText(data.pct + '%', M + cw, y + 44); }
      if (data.status) { ctx.font = '11px ' + UI; ctx.fillStyle = FB_MUTED; ctx.fillText(data.status, M + cw, y + (data.pct != null ? 59 : 44)); }
    } else if (data.status) { ctx.font = '600 13px ' + UI; ctx.fillStyle = FB_MUTED; ctx.fillText(data.status, M + cw, y + 20); }
    ctx.textAlign = 'left'; ctx.fillStyle = FB_INK; ctx.fillRect(M, y + hh - 1, cw, 1.2);
  } });

  // each rubric row: its name, the level given as words and as a bar, and what that level means
  if (data.rows.length) {
    cap(tr('How it was scored'));
    const nameW = Math.min(132, Math.round(cw * 0.25)), barW = 96, tx = M + nameW + barW + 14, tw = cw - nameW - barW - 14, any = data.rows.some(r => r.text);
    out.push({ h: 1, draw: y => { ctx.fillStyle = FB_LINE; ctx.fillRect(M, y, cw, 1); } });
    for (const r of data.rows) {
      const nl = wrap(r.name, '600 12.5px ' + UI, (any ? nameW : cw - barW - 14) - 10), dl = r.text ? wrap(r.text, '11.5px ' + UI, tw) : [];
      const h = Math.max(nl.length * 16, dl.length * 16, 30) + 18, bx = any ? M + nameW : M + cw - barW;
      out.push({ h, draw: y => {
        text(nl, '600 12.5px ' + UI, FB_INK, M, y + 21, 16);
        text([tr(fmtNum(r.v) + ' of 4')], '600 12px ' + UI, FB_BLUE, bx, y + 21, 16);
        for (let k = 0; k < 4; k++) {   // four segments; a half point fills half of one
          const x = bx + k * 23, fill = Math.max(0, Math.min(1, r.v - k));
          ctx.fillStyle = FB_LINE; ctx.fillRect(x, y + 28, 20, 3.5);
          if (fill) { ctx.fillStyle = FB_BLUE; ctx.fillRect(x, y + 28, 20 * fill, 3.5); }
        }
        text(dl, '11.5px ' + UI, FB_INK2, tx, y + 21, 16);
        ctx.fillStyle = FB_LINE; ctx.fillRect(M, y + h - 1, cw, 1);
      } });
    }
  }

  // her comment to the student
  if (data.comment) {
    cap(tr('From your teacher'));
    const cl = wrap(data.comment, '12.5px ' + UI, cw - 28);
    // one block a line, so a long comment runs on to the next page where the page ends
    cl.forEach((line, i) => {
      const first = !i, last = i === cl.length - 1, h = 19 + (first ? 11 : 0) + (last ? 11 : 0);
      out.push({ h, draw: y => {
        ctx.fillStyle = FB_SOFT; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(M, y, cw, h + (last ? 0 : 0.5), [first ? 6 : 0, first ? 6 : 0, last ? 6 : 0, last ? 6 : 0]); else ctx.rect(M, y, cw, h);
        ctx.fill();
        text([line], '12.5px ' + UI, FB_INK, M + 14, y + (first ? 11 : 0) + 14, 19);
      } });
    });
  }

  // every comment written on the paper, with its number there and its page in this file
  if (data.notes.length) {
    cap(tr(data.notes.length === 1 ? 'Comment on your paper' : 'Comments on your paper'));
    for (const n of data.notes) {
      const nl = wrap(n.text, '12px ' + UI, cw - 26 - 44), h = nl.length * 17 + 9, page = tr('p. ' + (n.page + 1 + off));
      const [r, g, b] = rgb(n.color || '#C8321F'), col = 'rgb(' + Math.round(r * 0.8) + ',' + Math.round(g * 0.8) + ',' + Math.round(b * 0.8) + ')';
      out.push({ h, draw: y => {
        if (n.n) {
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(M + 7, y + 11, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 ' + (n.n > 9 ? 7.5 : 8.5) + 'px ' + UI; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n.n), M + 7, y + 11.4);
        } else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(M + 7, y + 11, 2.6, 0, Math.PI * 2); ctx.fill(); }
        text(nl, '12px ' + UI, FB_INK, M + 26, y + 15, 17);
        ctx.font = '11px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'right'; ctx.fillText(page, M + cw, y + 15); ctx.textAlign = 'left';
      } });
    }
  }
  return out;
}

// The blocks cut into pages. A caption never ends a page: it goes over with what it names.
function fbPages(blocks, top, bottom) {
  const pages = [[]]; let y = top;
  blocks.forEach((b, i) => {
    const next = blocks[i + 1], need = b.h + (b.h === 34 && next ? next.h : 0);
    if (pages[pages.length - 1].length && y + need > bottom) { pages.push([]); y = top; }
    pages[pages.length - 1].push(b); y += b.h;
  });
  return pages;
}

// Adds the feedback page(s) to a PDF being made, the size of the paper's first page when that is an ordinary sheet.
// Returns how many pages it added.
async function fbAddPages(out, data, W, H, dpi) {
  if (!(W >= 400 && H >= 500 && W <= 1300 && H <= 1300) || W > H) { W = 612; H = 792; }
  const M = Math.max(44, Math.round(W * 0.095)), top = M, bottom = H - M - 22, UI = 'Inter, ' + FONT, scale = dpi / 72;
  const probe = document.createElement('canvas').getContext('2d');
  // The page numbers beside the comments count the feedback pages, so lay out until the count settles (it almost always is one page).
  let n = 1, pages;
  for (let pass = 0; pass < 3; pass++) { pages = fbPages(fbBlocks(probe, data, W, M, n), top, bottom); if (pages.length === n) break; n = pages.length; }
  for (let i = 0; i < pages.length; i++) {
    const c = document.createElement('canvas'); c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
    const ctx = c.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    // the same blocks, measured again on this canvas so they draw on it
    const mine = fbPages(fbBlocks(ctx, data, W, M, pages.length), top, bottom)[i] || [];
    let y = top; for (const b of mine) { b.draw(y); y += b.h; }
    ctx.font = '10px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(tr(i === pages.length - 1 ? 'Your marked paper starts on the next page.' : 'Your feedback continues on the next page.'), M, H - M + 6);
    out.addPage([W, H]).drawImage(await out.embedJpg(await canvasJpg(c, 0.92)), { x: 0, y: 0, width: W, height: H });
    c.width = c.height = 0;
  }
  return pages.length;
}
// For the tests: what the page would say for student i's first file.
Object.assign(window.__gs, { fbData: i => { const st = batch.students[i], d = layoutOf(st)[0]; return d ? fbData(st, d) : null; } });
