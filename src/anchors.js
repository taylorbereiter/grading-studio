/* ---------------- anchor papers: the high, middle and low paper of a summative (11/11) ---------------- */
// Many schools keep three marked papers from each summative to show the standard: one high, one middle, one low.
// She tags a paper while marking it (High, Mid or Low under the score); each level belongs to one paper, so tagging a second paper High
// moves it. The Return tab lists the three and exports them in one go, each file named for the assignment and its level,
// "Persuasive essay - Summative High.pdf", with names covered the way the Claude ZIP covers them (her own boxes too). Stored on the
// paper's own grade as st.grade.anchor = 'high' | 'mid' | 'low', so it travels with her marks, the folder and the take-home file.
const ANCHORS = [['high', 'High'], ['mid', 'Mid'], ['low', 'Low']];
const anchorCoverOn = () => store.get('gs.anchorCover', true) !== false;
// The assignment's type, and the word for the file names: the teacher's own name for the type (bkCats), or "Summative" for an assignment with no type yet.
function anchorType() { const a = batch && batch.assignment, f = a && findItem(a.id); return ((f && f.it) || a || {}).type || ''; }
function anchorKind() {
  const t = anchorType(), c = t && bkCats().find(x => x[0] === t);
  return c ? c[2] || c[1] : 'Summative';
}
// Tagging shows on summatives, on the teacher's own counted types and on assignments with no type; in-class and formative work doesn't have anchors.
function anchorsHere() { const t = anchorType(); return t !== 'ic' && t !== 'fm' && t !== 'xc'; }
const anchorOf = lv => batch.students.findIndex(s => s.grade.anchor === lv);
const anchorLabel = lv => anchorKind() + ' ' + (ANCHORS.find(a => a[0] === lv) || ['', ''])[1];
function anchorFile(lv, k, n) { return (nameFreeText(batch.name) + ' - ' + anchorLabel(lv) + (n > 1 ? ' (' + (k + 1) + ')' : '') + '.pdf').replace(/[\\/:*?"<>|]+/g, '-'); }

// Under the score: "Anchor paper  High  Mid  Low". Shown only where anchors belong, and only once the paper has something in it.
function anchorHtml(st) {
  if (!anchorsHere() || !st.files.length || noScore(st)) return '';
  const on = st.grade.anchor || '';
  return '<div class="anchrow" id="anchRow"><span class="anchlab" title="The high, middle and low paper your school keeps from a summative. The Return tab exports all three, named and with names covered.">Anchor paper</span>' +
    '<span class="seg anchseg" role="group" aria-label="Anchor paper">' + ANCHORS.map(([k, t]) => {
      const j = anchorOf(k), other = j >= 0 && batch.students[j] !== st;
      return '<button data-anchor="' + k + '" aria-pressed="' + (on === k) + '" title="' + esc(on === k ? 'This is the ' + anchorLabel(k).toLowerCase() + ' paper. Click again to take it off.' : other ? 'Make this the ' + t.toLowerCase() + ' paper instead of ' + (anonOn() ? 'another paper' : batch.students[j].key) : 'Make this the ' + t.toLowerCase() + ' anchor paper') + '">' + t + '</button>';
    }).join('') + '</span></div>';
}
// One level, one paper: tagging this paper takes the level off whichever paper had it.
function setAnchor(st, lv) {
  const was = st.grade.anchor || '';
  if (was === lv) delete st.grade.anchor;
  else {
    for (const s of batch.students) if (s !== st && s.grade.anchor === lv) { delete s.grade.anchor; touchGrade(s); }
    st.grade.anchor = lv;
  }
  touchGrade(st); saveSoon(); renderGrade(); renderList();
  if (st.grade.anchor) toast(anchorLabel(lv) + ' anchor paper. It’s on the Return tab, ready to export.');
}
// The tag in the student list.
const anchorTag = st => st.grade.anchor && ANCHORS.some(a => a[0] === st.grade.anchor) ? '<span class="anch" title="' + esc(anchorLabel(st.grade.anchor)) + ' anchor paper">' + ANCHORS.find(a => a[0] === st.grade.anchor)[1].toLowerCase() + '</span>' : '';

/* ---------- the Return tab's card ---------- */
function anchorCardHtml() {
  if (!anchorsHere() && !batch.students.some(s => s.grade.anchor)) return '';
  const rows = ANCHORS.map(([k, t]) => {
    const j = anchorOf(k), st = j >= 0 ? batch.students[j] : null, g = st && gradeOf(st);
    const sc = g && g.total != null ? fmtNum(g.total) + ' / ' + fmtNum(g.outOf != null ? g.outOf : maxPoints()) + (g.pct != null ? ' · ' + fmtPct(g.pct) : '') : g && g.pct != null ? fmtPct(g.pct) : '';
    return '<li class="anchli' + (st ? '' : ' none') + '"><b>' + t + '</b>' + (st ? '<button class="link" data-chk="' + j + '">' + esc(shownName(st, j)) + '</button><span class="muted">' + esc(sc) + '</span>' : '<span class="muted">Not picked yet</span>') + '</li>';
  }).join('');
  const n = ANCHORS.filter(([k]) => anchorOf(k) >= 0).length;
  return '<section class="rtcard" id="rtAnchors"><h3>Anchor papers</h3>' +
    (n ? '' : '<p class="muted">Pick a high, middle and low paper while you mark: under the score, click High, Mid or Low.</p>') +
    '<ul class="anchlist">' + rows + '</ul>' +
    (n ? '<label class="anchcov"><input type="checkbox" id="anchCover"' + (anchorCoverOn() ? ' checked' : '') + '> Cover student names</label>' +
      '<p class="muted anchsay">Files come out as “' + esc(anchorFile(ANCHORS.find(([k]) => anchorOf(k) >= 0)[0], 0, 1)) + '”' + (n > 1 ? ', ' + n + ' in one ZIP' : '') + '. ' + (anchorCoverOn() ? 'Typed names and your own cover boxes are blacked out. A handwritten name needs a box: <button class="link" data-anchcheck>Check the covers</button>.' : 'Names stay as they are on the paper.') + '</p>' +
      '<button class="btn primary" data-anchout>Export anchor papers</button>' : '') + '</section>';
}
function anchorCardDraw() { const el = $('#rtAnchors'), h = anchorCardHtml(); if (el) { if (h) el.outerHTML = h; else el.remove(); } }
// true when the click was the card's.
function anchorCardClick(e) {
  const cb = e.target.closest('#anchCover');
  if (cb) { store.set('gs.anchorCover', cb.checked); setTimeout(anchorCardDraw); return true; }
  if (e.target.closest('[data-anchout]')) { anchorExport(); return true; }
  if (e.target.closest('[data-anchcheck]')) {
    const first = ANCHORS.map(([k]) => anchorOf(k)).find(j => j >= 0), b0 = batch;
    const at = coverList().findIndex(x => x.st === batch.students[first]);
    checkCovers(Math.max(0, at), () => { if (batch === b0) go(batchHash(batch.id, 'return')); });
    return true;
  }
  return false;
}

/* ---------- export ---------- */
// One PDF per paper the student turned in (most have one). Covered: each page drawn the way the Claude ZIP draws it, her marks with names
// taken out of her own words and black boxes over names, and nothing else in the file (no original pages, no text). Not covered: the same
// file Export marked makes, minus the feedback page and the editable copy.
async function anchorDocPdf(st, d, cover) {
  if (!cover) return flattenDoc(st, d, 150, false, keyOn(), false);
  const rx = coverRx(st), out = await PDFLib.PDFDocument.create(), js = new Map();
  out.setTitle(''); out.setAuthor(''); out.setCreator('Grading Studio'); out.setProducer('');
  try {
    for (const [path, p] of d.pages) {
      const f = fileByPath(st, path);
      if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
      const v1 = vpRot(f, p, await js.get(path).getPage(p + 1), 1);
      const r = await sharePage(st, f, js.get(path), p, Math.min(150 / 72, 8000 / Math.max(v1.width * 1.5, v1.height)), rx, shareOpts(st));
      out.addPage([r.W + r.side, r.H]).drawImage(await out.embedJpg(await canvasJpg(r.c, 0.88)), { x: 0, y: 0, width: r.W + r.side, height: r.H });
      r.c.width = r.c.height = 0;
    }
  } finally { for (const v of js.values()) v.destroy(); }
  return out.save();
}
// Every file of the paper, marked or not (an anchor shows the whole paper), except one she took out of it herself.
const anchorDocs = st => layoutOf(st).filter(d => !(d.out === true || (d.file && st.inc && st.inc[d.file] === false))).map(d => ({ ...d, pages: d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && viewable(f); }) })).filter(d => d.pages.length);
async function anchorExport() {
  if (xBusy) return toast('The last export is still going. It will say when it’s done.');
  const picked = ANCHORS.map(([k]) => ({ k, j: anchorOf(k) })).filter(x => x.j >= 0);
  if (!picked.length) return toast('Pick a high, middle or low paper first');
  saveNow(); commitEditors();
  if (batch.lineBusy) await batch.lineRun;
  const b0 = batch, cover = anchorCoverOn(), files = {}, failed = [];
  xBusy = true;
  const btn = $('[data-anchout]'); if (btn) { btn.disabled = true; btn.textContent = 'Making the files…'; }
  try {
    await workerReady;
    if (cover) await classCommon();
    for (const { k, j } of picked) {
      const st = batch.students[j], docs = anchorDocs(st);
      if (!docs.length) { failed.push(anchorLabel(k) + ' (no pages to export)'); continue; }
      for (let n = 0; n < docs.length; n++) {
        try { files[anchorFile(k, n, docs.length)] = await anchorDocPdf(st, docs[n], cover); }
        catch (er) { console.error(er); failed.push(anchorLabel(k) + ' (' + exportWhy(er, false) + ')'); }
      }
    }
    if (batch !== b0) return;
    const names = Object.keys(files);
    if (!names.length) throw new Error(failed.join(', ') || 'nothing could be made');
    if (names.length === 1) await saveBlob(names[0], new Blob([files[names[0]]], { type: 'application/pdf' }));
    else { const z = {}; for (const nm of names) z[nm] = [files[nm], { level: 0 }]; await saveBlob('Anchor papers - ' + nameFreeText(batch.name) + '.zip', new Blob([fflate.zipSync(z)], { type: 'application/zip' })); }
    toast(names.length === 1 ? 'Saved “' + names[0] + '”.' : 'Saved ' + names.length + ' anchor papers in one ZIP.', 5000);
    if (failed.length) sayDlg('Not exported: ' + failed.join(', ') + '. The rest downloaded.');
  } catch (er) { console.error(er); toast('Something went wrong: ' + (er.message || er), 6000); }
  finally { xBusy = false; if (batch === b0) anchorCardDraw(); }
}
