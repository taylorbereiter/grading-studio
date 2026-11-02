/* ================= Planner: alternative versions of a lesson =================
   A variant is its own lesson, made as a copy of the one you're on (slides, notes, comments, materials and
   finished deck), with "variantOf" (the first lesson's id) and "variant" (its name, like "Shorter Friday").
   The lessons of one family show as tabs above the slides, so you can switch between them. Each one has its
   own classes and dates, history and finished PowerPoint. Different from Versions, which is one lesson's history. */
const famId = l => l.variantOf || l.id;
const varName = l => l.variant || (l.variantOf ? 'Alternative' : 'Original');
function variantsOf(l) {
  const f = famId(l);
  return L.lessons.filter(x => x.id === f || x.variantOf === f).sort((a, b) => (a.id === f ? -1 : b.id === f ? 1 : a.created - b.created));
}
function variantBar(l) {
  const vs = variantsOf(l);
  return '<div class="pl-var"><span class="muted">' + (vs.length > 1 ? 'Versions of this lesson:' : 'This lesson:') + '</span>' +
    vs.map(v => v.id === l.id
      ? '<span class="pl-vt on">' + esc(varName(v)) + '<button class="pl-vr" data-a="varname" title="Rename this version" aria-label="Rename">✎</button></span>'
      : '<button class="pl-vt" data-var="' + v.id + '" title="' + esc(v.slots.length ? v.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ') : 'Not on a class') + '">' + esc(varName(v)) + '</button>').join('') +
    '<button class="btn sm ghost" data-a="varnew" title="Copy this lesson as a starting point for a revised or alternative version">+ Alternative version</button></div>';
}
function varNameDlg(title, val, hint, extra, onOk) {
  openDlg('<div class="bh"><h2>' + title + '</h2></div><div class="bb"><label class="ls-f">Name<input id="varN" class="btn" style="justify-content:flex-start;cursor:text" value="' + esc(val) + '" placeholder="' + esc(hint) + '"></label>' + (extra || '') + '</div>' +
    '<div class="bf"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>OK</button></div>', true);
  const ok = () => { const v = $('#varN').value.trim().slice(0, 60); if (!v) return $('#varN').focus(); const same = $('#varSame') && $('#varSame').checked; closeDlg(); onOk(v, same); };
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-x]')) return closeDlg(); if (e.target.closest('[data-ok]')) ok(); };
  $('#dlgBox').onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'varN') { e.preventDefault(); ok(); } };
  const i = $('#varN'); i.focus(); if (val) i.select();
}
// A new version, copied from the lesson you're on.
async function makeVariant(l, name, sameSlots) {
  editorCommit();
  const n = await copyLesson(l, null, l.title);
  n.variantOf = famId(l); n.variant = name; if (sameSlots) n.slots = l.slots.map(s => ({ ...s }));
  // its own copy of the finished decks, so removing one never touches the other
  for (const k of ['final', 'finals']) delete n[k];
  const cp = async f => { const b = await fileBlob(f.id); if (!b) return null; const id = lid(); await kvSet('file:' + id, b); return { ...f, id }; };
  if (l.final) { n.final = await cp(l.final); if (n.final) n.final.sig = finSig(n); else delete n.final; }
  const older = []; for (const f of l.finals || []) { const c = await cp(f); if (c) older.push(c); } if (older.length) n.finals = older;
  await lPut(n);
  if (!l.variantOf && !l.variant) { l.variant = 'Original'; await lPut(l); }
  L.open = n; L.cur = Math.min(L.cur, n.slides.length - 1); renderEditor();
  toast('Made “' + name + '” from “' + varName(l) + '”. Switch between them above the slides.', 6000);
}
async function variantsClick(t) {
  const l = L.open; if (!l) return false;
  if (t.dataset.var) { editorCommit(); clearTimeout(lSaveT); await lPut(l); const v = L.lessons.find(x => x.id === t.dataset.var); if (v) { const i = L.cur; L.open = v; L.cur = Math.min(i, v.slides.length - 1); renderEditor(); } return true; }
  const a = t.dataset.a;
  if (a === 'varnew') {
    varNameDlg('New version of “' + esc(l.title) + '”', '', 'Like: Shorter Friday version, or Alt activity',
      '<p class="muted" style="margin:6px 0 0">It starts as a copy of “' + esc(varName(l)) + '”: slides, notes, comments, materials and the finished PowerPoint. Change it without touching this one.</p>' +
      (l.slots.length ? '<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="varSame"> Also put it on ' + esc(l.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ')) + '</label>' : ''),
      (v, same) => makeVariant(l, v, same));
    return true;
  }
  if (a === 'varname') { varNameDlg('Rename this version', varName(l), 'Like: Shorter Friday version', '', async v => { l.variant = v; await lPut(l); renderEditor(); }); return true; }
  return false;
}
