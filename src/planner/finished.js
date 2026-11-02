/* ================= Planner: the finished PowerPoint =================
   A lesson can keep one finished .pptx (the deck as it will be taught), in "final": { id, name, size, at, sig }.
   The bytes are in kv 'file:<id>', like materials. Uploading one:
   - keeps the lesson as it was under Versions first ("Before the finished PowerPoint"),
   - reads the deck's slides (titles, text, bullets, speaker notes, pictures) into the Planner's slides,
   - moves the finished file it replaces to "finals" (older finished decks, newest first).
   Download .pptx then gives the finished file itself while the slides are unchanged since the upload. */
const finSig = l => hash(JSON.stringify(l.slides.map(slideKey)));
const finFresh = l => !!(l.final && l.final.sig === finSig(l));
const finSize = n => n / 1048576 >= 1 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const finWhen = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function finishedHtml(l) {
  const f = l.final, old = l.finals || [];
  return '<div class="pl-fin" id="plFin"><div class="pl-fin-h"><h3>Finished PowerPoint</h3><span class="muted sp-small">' +
    (f ? 'The deck you’ll teach from. Uploading a new one replaces it; the old one is kept below.' : 'Upload the deck when it’s done. Its slides replace the ones here, and this version is kept under Versions.') +
    '</span><span class="sp"></span><button class="btn sm' + (f ? ' ghost' : ' primary') + '" data-a="finup">' + (f ? 'Upload a newer one…' : 'Upload finished .pptx…') + '</button><input type="file" id="finIn" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden></div>' +
    (f ? '<div class="pl-files"><div class="pl-file"><span class="pl-ft">PPT</span><span class="pl-fn"><b>' + esc(f.name) + '</b><span>' + finSize(f.size) + ' · uploaded ' + finWhen(f.at) + (finFresh(l) ? '' : ' · slides changed here since') + '</span></span>' +
      '<button class="btn sm" data-a="findl" data-id="' + f.id + '">Download</button></div></div>' : '') +
    (old.length ? '<details class="pl-fin-old"><summary>Older finished decks (' + old.length + ')</summary><div class="pl-files">' + old.map(o => '<div class="pl-file"><span class="pl-ft">PPT</span><span class="pl-fn"><b>' + esc(o.name) + '</b><span>' + finSize(o.size) + ' · uploaded ' + finWhen(o.at) + '</span></span>' +
      '<button class="btn sm ghost" data-a="findl" data-id="' + o.id + '">Download</button><button class="btn sm ghost" data-a="finback" data-id="' + o.id + '" title="Make this the finished deck again, and its slides the lesson’s slides">Use this one again</button></div>').join('') + '</div></details>' : '') +
    '</div>';
}
function finPick() { const i = $('#finIn'); if (!i) return; i.onchange = () => { const f = i.files[0]; i.value = ''; if (f) finUpload(L.open, f); }; i.click(); }

// Puts a finished deck on the lesson. file: a File or Blob with a name; keepId: reuse stored bytes (going back to an older one).
async function finUpload(l, file, keepId) {
  if (!/\.pptx$/i.test(file.name || '')) return toast('That isn’t a .pptx file');
  if (file.size > MAX_FILE) return toast('That file is too big (over 40 MB)');
  let slides;
  try { slides = await pptxToSlides(new Uint8Array(await file.arrayBuffer())); } catch (e) { console.warn(e); return toast('That PowerPoint couldn’t be read'); }
  if (!slides.length) return toast('No slides found in that PowerPoint');
  editorCommit();
  await saveVersion(l, l.final ? 'Before “' + file.name + '” (finished deck)' : 'Before the finished PowerPoint');
  const id = keepId || lid(); if (!keepId) await kvSet('file:' + id, file);
  const finals = (l.finals || []).filter(o => o.id !== id);
  if (l.final && l.final.id !== id) finals.unshift(l.final);
  // Comments and notes for Claude stay with the slide they were on, matched by position.
  slides.forEach((s, i) => { const was = l.slides[i]; if (was) { s.ask = was.ask; s.talk = was.talk; if (was.ctx) s.ctx = was.ctx; } });
  l.slides = slides.map(s => normSlide({ ...s, fmt: 2 }));
  l.finals = finals;
  l.final = { id, name: file.name, size: file.size, at: Date.now(), sig: finSig(l) };
  L.cur = 0; await lPut(l); lessonChanged(false); renderEditor();
  toast('Finished deck saved: ' + slides.length + ' slides. The lesson before it is under Versions.', 6000);
}
async function finBack(l, id) {
  const o = (l.finals || []).find(x => x.id === id), b = o && await fileBlob(id); if (!b) return toast('That file is missing');
  return finUpload(l, new File([b], o.name, { type: b.type }), id);
}
async function finDownload(id, name) { const b = await fileBlob(id); if (!b) return toast('That file is missing'); saveBlob(name, b); }
// Download .pptx: the finished file while it still matches the slides; otherwise ask which.
async function finOrMake(l) {
  if (!l.final) return downloadPptx(l);
  if (finFresh(l)) return finDownload(l.final.id, l.final.name);
  openDlg('<div class="bh"><h2>Which PowerPoint?</h2></div><div class="bb"><p style="margin-top:0">You changed slides here after uploading “' + esc(l.final.name) + '”.</p></div>' +
    '<div class="bf"><button class="btn" data-x>Cancel</button><button class="btn" data-fin>The finished file</button><button class="btn primary" data-make>Make one from these slides</button></div>', true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (e.target.closest('[data-fin]')) { closeDlg(); return finDownload(l.final.id, l.final.name); }
    if (e.target.closest('[data-make]')) { closeDlg(); downloadPptx(l); }
  };
}
async function finishedClick(t) {
  const a = t.dataset.a, l = L.open; if (!l) return false;
  if (a === 'finup') { finPick(); return true; }
  if (a === 'findl') { const f = [l.final, ...(l.finals || [])].find(x => x && x.id === t.dataset.id); if (f) await finDownload(f.id, f.name); return true; }
  if (a === 'finback') { await finBack(l, t.dataset.id); return true; }
  return false;
}
async function finishedDrop(e) {
  const box = e.target.closest && e.target.closest('#plFin'), f = [...(e.dataTransfer.files || [])].find(x => /\.pptx$/i.test(x.name));
  if (!box || !f || !L.open) return false;
  await finUpload(L.open, f); return true;
}

/* ---------- reading a .pptx into Planner slides ---------- */
const PX = { a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' };
const xmlOf = (z, p) => z[p] ? new DOMParser().parseFromString(new TextDecoder().decode(z[p]), 'application/xml') : null;
const kids = (el, ns, name) => el ? [...el.getElementsByTagNameNS(ns, name)] : [];
const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
function relsOf(z, part) {
  const i = part.lastIndexOf('/'), x = xmlOf(z, part.slice(0, i) + '/_rels/' + part.slice(i + 1) + '.rels'), m = {};
  if (x) for (const r of x.getElementsByTagName('Relationship')) {
    const t = r.getAttribute('Target'); if (r.getAttribute('TargetMode') === 'External') continue;
    m[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', path: pathJoin(part.slice(0, i), t) };
  }
  return m;
}
function pathJoin(dir, t) {
  if (t.startsWith('/')) return t.slice(1);
  const out = dir.split('/');
  for (const s of t.split('/')) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
}
// Our colors, plus PowerPoint's standard ones, by hex.
const RT_HEX = () => ({ FF0000: 'red', C00000: 'red', FFC000: 'orange', ED7D31: 'orange', '00B050': 'green', '70AD47': 'green', '0070C0': 'blue', '0000FF': 'blue', '00B0F0': 'blue', '4472C4': 'blue', '7030A0': 'purple', '808080': 'gray', '7F7F7F': 'gray',
  ...Object.fromEntries(Object.entries(RT_COLORS).map(([k, v]) => [v.replace('#', '').toUpperCase(), k])) });
// One paragraph of a shape as a Planner text line: "• " / "1. " / tabs for level, **b** *i* __u__ {color}.
function paraLine(p, bulleted, hexes) {
  const pPr = kid(p, PX.a, 'pPr');
  // Level: PowerPoint's own "lvl", or (as the Planner writes it) the left margin less the hanging indent, half an inch a level.
  const marL = pPr && pPr.getAttribute('marL'), base = marL != null ? +marL + Math.min(0, +pPr.getAttribute('indent') || 0) : 0;
  const lvl = Math.min(2, +(pPr && pPr.getAttribute('lvl')) || Math.round(base / 457200));
  let t = '';
  for (const n of p.childNodes) {
    if (n.localName === 'br') { t += ' '; continue; }
    if (n.localName !== 'r' && n.localName !== 'fld') continue;
    let x = (kid(n, PX.a, 't') || {}).textContent || ''; if (!x) continue;
    x = x.replace(/([*_{\\])/g, '\\$1');
    const rPr = kid(n, PX.a, 'rPr');
    if (rPr && x.trim()) {
      const clr = kid(kid(rPr, PX.a, 'solidFill'), PX.a, 'srgbClr'), c = clr && hexes[(clr.getAttribute('val') || '').toUpperCase()];
      if (rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none') x = '__' + x + '__';
      if (rPr.getAttribute('i') === '1') x = '*' + x + '*';
      if (rPr.getAttribute('b') === '1') x = '**' + x + '**';
      if (c) x = '{' + c + '}' + x + '{/}';
    }
    t += x;
  }
  t = t.replace(/(?<!\\)\*\*\*\*/g, '');
  if (!t.trim()) return null;
  const none = pPr && kid(pPr, PX.a, 'buNone'), num = pPr && kid(pPr, PX.a, 'buAutoNum'), ch = pPr && kid(pPr, PX.a, 'buChar');
  const mark = none ? '' : num ? (+num.getAttribute('startAt') || 1) + '. ' : (ch || bulleted) ? '• ' : '';
  return '\t'.repeat(lvl) + mark + t.trim();
}
function shapeText(sp, bulleted, hexes) {
  const tb = kid(sp, PX.p, 'txBody'); if (!tb) return [];
  return kids(tb, PX.a, 'p').map(p => paraLine(p, bulleted, hexes)).filter(x => x != null);
}
// Numbers count on per level; a smaller point under a number doesn't restart it. "startAt" wins.
function numberLines(lines) {
  const n = [0, 0, 0];
  return lines.map(x => {
    const d = /^\t*/.exec(x)[0].length, m = /^(\t*)(\d+)\. /.exec(x);
    for (let k = d + 1; k < 3; k++) n[k] = 0;
    if (!m) { n[d] = 0; return x; }
    n[d] = +m[2] > 1 ? +m[2] : n[d] + 1;
    return m[1] + n[d] + '. ' + x.slice(m[0].length);
  });
}
async function mediaPic(z, path) {
  const u8 = z[path]; if (!u8) return null;
  const type = /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : /\.gif$/i.test(path) ? 'image/gif' : '';
  if (!type) return null;   // emf/wmf and the like can't be shown in a browser
  try { return await shrinkPic(new Blob([u8], { type })); } catch { return null; }
}
async function pptxToSlides(u8) {
  const z = fflate.unzipSync(u8), hexes = RT_HEX();
  const pres = xmlOf(z, 'ppt/presentation.xml'); if (!pres) throw new Error('not a pptx');
  const prels = relsOf(z, 'ppt/presentation.xml');
  const order = kids(pres, PX.p, 'sldId').map(s => prels[s.getAttributeNS(PX.r, 'id')]).filter(Boolean).map(r => r.path);
  const out = [];
  for (const [i, part] of order.entries()) {
    const x = xmlOf(z, part); if (!x) continue;
    const rels = relsOf(z, part);
    let title = '', body = [], sizes = [], ctr = false, pic = null;
    for (const sp of kids(x, PX.p, 'sp')) {
      const ph = kid(kid(sp, PX.p, 'nvPr'), PX.p, 'ph'), type = ph ? ph.getAttribute('type') || 'body' : '';
      if (/^(sldNum|dt|ftr)$/.test(type)) continue;
      for (const r of kids(sp, PX.a, 'rPr')) if (+r.getAttribute('sz')) sizes.push(+r.getAttribute('sz') / 100);
      if (type === 'title' || type === 'ctrTitle') { ctr = ctr || type === 'ctrTitle'; title = title || shapeText(sp, false, hexes).map(t => t.replace(/^[•\t ]+|^\d+\. /g, '')).join(' '); continue; }
      body.push(...shapeText(sp, type === 'body' || type === 'obj' || (ph && !type), hexes));
    }
    for (const p of kids(x, PX.p, 'pic')) {
      if (pic) break;
      const bl = kid(p, PX.a, 'blip'), rid = bl && bl.getAttributeNS(PX.r, 'embed');
      if (rid && rels[rid]) pic = await mediaPic(z, rels[rid].path);
    }
    let notes = '';
    const nr = Object.values(rels).find(r => /notesSlide$/.test(r.type));
    const nx = nr && xmlOf(z, nr.path);
    if (nx) for (const sp of kids(nx, PX.p, 'sp')) {
      const ph = kid(kid(sp, PX.p, 'nvPr'), PX.p, 'ph'); if (!ph || (ph.getAttribute('type') && ph.getAttribute('type') !== 'body')) continue;
      notes = kids(sp, PX.a, 'p').map(p => kids(p, PX.a, 't').map(t => t.textContent).join('')).join('\n').trim();
    }
    const big = sizes.filter(s => s >= 20), size = big.length ? SIZES.reduce((a, b) => Math.abs(b - Math.min(...big)) < Math.abs(a - Math.min(...big)) ? b : a) : 28;
    title = title.replace(/[\u200b\ufeff]/g, '').trim();
    const s = { title, body: numberLines(body).join('\n'), notes, size };
    if (ctr || (i === 0 && !pic && body.length <= 2)) { s.layout = 'title'; s.body = body.join('\n').replace(/^[•\t ]+|^\d+\. /gm, ''); }
    else if (pic && body.length) { s.layout = 'picprompt'; s.img = { ...pic, source: '' }; }
    else if (pic) { s.layout = 'picture'; s.img = { ...pic, source: '' }; }
    else s.layout = /\bagenda\b/i.test(title) ? 'agenda' : 'content';
    out.push(s);
  }
  return out;
}
