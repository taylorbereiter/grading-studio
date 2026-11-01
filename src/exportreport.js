/* ---------------- export: what couldn't be exported, and why ---------------- */
// toBlob gives nothing for a canvas too big to draw on, so this is the one way a page can fail without an error of its own.
const canvasJpg = (c, q) => new Promise((res, rej) => c.toBlob(b => { if (!b) { const er = new Error('page too big'); er.name = 'PageTooBig'; return rej(er); } b.arrayBuffer().then(x => res(new Uint8Array(x)), rej); }, 'image/jpeg', q));
function exportWhy(er, toFolder) {
  const n = er && er.name, msg = String((er && er.message) || er || '');
  if (n === 'PageTooBig') return 'one of its pages is too big to put your marks on. If you picked Extra sharp, try Standard';
  if (n === 'PasswordException' || /password/i.test(msg)) return 'it’s password-protected';
  if (n === 'QuotaExceededError') return toFolder ? 'there’s no room left on the disk' : 'this computer ran out of room';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'the folder didn’t allow saving it';
  if (n === 'NoModificationAllowedError') return 'the file is open in another program, or the folder is read-only';
  if (n === 'InvalidPDFException' || n === 'MissingPDFException' || /invalid pdf|failed to parse|no pdf header/i.test(msg)) return 'the PDF is damaged';
  return 'something went wrong while making it (' + msg.slice(0, 120) + ')';
}
// Files nothing could be drawn from never reach the plan, since they have no pages to go through. They still get named.
async function unopenable(failed) {
  await workerReady;
  for (const st of batch.students) for (const f of st.files.filter(f => viewable(f) && !f.virtual && !f.numPages)) {
    let why = f.bad || 'it couldn’t be opened';
    try { (await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise).destroy(); } catch (er) { why = exportWhy(er); }
    if (!failed.some(x => x.path === f.path)) failed.push({ path: f.path, st, why });
  }
}
// Stays in the export box until she closes it.
function exportReport(failed) {
  const old = $('#xFails'); if (old) old.remove();
  if (!failed.length) return;
  if (!$('#xStatus')) return sayDlg(failed.length + (failed.length === 1 ? ' file isn’t' : ' files aren’t') + ' in this export. Open Export again to try once more and see which.');   // she closed the box while it ran
  const n = failed.length, anon = anonOn();   // the paper's number, and not the file's name or an error that might quote it
  $('#xStatus').insertAdjacentHTML('afterend', '<div class="xfails" id="xFails" role="alert"><b>' + n + (n === 1 ? ' file isn’t' : ' files aren’t') + ' in this export:</b><ul>' +
    failed.map(x => '<li><b>' + esc(anon && x.st ? shownName(x.st, batch.students.indexOf(x.st)) : x.path) + '</b>: ' + esc(anon ? x.why.replace(/ \(.*$/s, '') : x.why) + '</li>').join('') + '</ul></div>');
}
