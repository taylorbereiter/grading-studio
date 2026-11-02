/* ================= Working on a lesson with Claude =================
   All of this is optional: a lesson can be made by the teacher alone, by Claude alone, or passed back and forth.
   - Each slide can carry "ask" (what the teacher wants on it, for Claude) and "talk" (comments both ways).
   - A lesson's "status" is just a marker: '' (no marker), 'claude' (sent to Claude), 'review' (Claude says it's
     ready for the teacher). Nothing is locked by it.
   - Versions: a copy is kept when it's sent, before Claude's changes come in, and on request.
   - When Claude changes a lesson in the Planner folder, the teacher's copy from just before is kept, and the
     editor offers a side-by-side look with Keep Claude's / Keep mine for each slide. */
const STATUS = { claude: 'With Claude', review: 'Ready for you' };
const MAX_VERSIONS = 30;
const statusChip = l => l.status && STATUS[l.status] ? '<span class="pl-st st-' + l.status + '">' + STATUS[l.status] + '</span>' : '';

/* ---------- versions: kv 'ver:<lesson id>' ---------- */
const snap = l => { const c = JSON.parse(JSON.stringify(l)); delete c._file; delete c._mod; delete c.pending; return c; };
async function versionsOf(l) { return (await kvGet('ver:' + l.id)) || []; }
async function saveVersion(l, label, from) {
  const vs = await versionsOf(l);
  vs.unshift({ at: Date.now(), label, lesson: snap(from || l) });
  await kvSet('ver:' + l.id, vs.slice(0, MAX_VERSIONS));
}
async function versionsDlg(l) {
  const vs = await versionsOf(l);
  openDlg('<div class="bh"><h2>Versions of “' + esc(l.title) + '”</h2><button class="btn sm" data-sv>Save a version now</button></div><div class="bb"><div class="ls-pick">' +
    (vs.length ? vs.map((v, i) => '<div class="ls-row"><div class="ls-card" style="flex:1;cursor:default"><b>' + esc(v.label) + '</b><span>' + new Date(v.at).toLocaleString() + ' · ' + v.lesson.slides.length + ' slides</span></div><button class="btn sm" data-rv="' + i + '">Go back to this</button></div>').join('') : '<p class="muted">No versions yet. One is kept each time you send the lesson to Claude, when Claude’s changes come in, and when you approve it.</p>') +
    '</div></div><div class="bf"><button class="btn" data-x>Close</button></div>');
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (e.target.closest('[data-sv]')) { await saveVersion(l, 'Saved by you'); closeDlg(); return toast('Version saved'); }
    const b = e.target.closest('[data-rv]'); if (!b) return;
    const v = vs[+b.dataset.rv];
    await saveVersion(l, 'Before going back to “' + v.label + '”');
    const back = normLesson({ ...v.lesson, id: l.id, slots: l.slots, created: l.created });
    Object.assign(l, back, { _file: l._file, _mod: l._mod }); delete l.pending;
    closeDlg(); L.cur = Math.min(L.cur, l.slides.length - 1); lessonChanged(false); renderEditor(); toast('Back to “' + v.label + '”. The version you left is saved too.');
  };
}

/* ---------- sending to Claude, approving ---------- */
async function sendToClaude(l) {
  editorCommit();
  await saveVersion(l, 'Sent to Claude');
  l.status = 'claude'; await lPut(l);
  const asks = l.slides.filter(s => s.ask.trim()).length, talks = l.slides.filter(s => s.talk.some(t => t.by === 'you' && !t.done)).length;
  const file = fileBase(l) + '.lesson.json';
  const msg = L.dir && L.dirOk
    ? 'Please work on my lesson "' + l.title + '" in my Planner folder ("' + L.dir.name + '"), file "' + file + '". Read "README - for Claude.md" there first.\n\n' +
      (asks ? asks + ' slide' + (asks === 1 ? ' has' : 's have') + ' an "ask" saying what I want on it. ' : '') + (talks ? talks + ' slide' + (talks === 1 ? ' has' : 's have') + ' comments from me in "talk". ' : '') +
      'Build the lesson out from my outline and those notes. Keep my wording where I wrote it. When you\'re done, reply to my comments in "talk", put a short summary in "claudeNote", and set "status" to "review". Don\'t change "id" or "slots". I\'ll look at your version slide by slide in the Planner.'
    : 'Here is a lesson from my Planner. Each slide may have "What I want here" notes and comments for you. Build it out, keep my wording where I wrote it, and slide text stays 28 to 36 pt.\n\n' + lessonText(l);
  await copyText(msg);
  toast(L.dir && L.dirOk ? 'Copied. Paste it into Claude. Claude’s changes show up here when it saves.' : 'Lesson copied. Paste it into Claude. Link the Planner folder so Claude can save straight back.', 7000);
  renderEditor();
}

/* ---------- Claude's changes, slide by slide ---------- */
const slideKey = s => JSON.stringify({ l: s.layout, t: s.title, b: s.body, z: s.size, n: s.notes, i: s.img && s.img.src.length + ':' + s.img.source, v: s.video && s.video.url + s.video.start });
function changesOf(l) {
  if (!l.pending) return [];
  const before = l.pending.before, out = [];
  for (const s of l.slides) { const o = before.find(x => x.id === s.id); if (!o) out.push({ kind: 'added', now: s }); else if (slideKey(o) !== slideKey(s)) out.push({ kind: 'changed', now: s, was: o }); }
  for (const o of before) if (!l.slides.some(s => s.id === o.id)) out.push({ kind: 'removed', was: o });
  return out;
}
function pendingBar(l) {
  if (!l.pending) return l.claudeNote && l.status === 'review' ? '<div class="pl-claude"><b>Claude’s note</b><span>' + esc(l.claudeNote) + '</span></div>' : '';
  const ch = changesOf(l);
  return '<div class="pl-claude pending"><div><b>Claude changed this lesson</b><span>' + (ch.length ? ch.length + ' slide' + (ch.length === 1 ? '' : 's') + ' changed, added or taken out.' : 'No slides changed.') + (l.claudeNote ? ' “' + esc(l.claudeNote) + '”' : '') + '</span></div>' +
    '<span class="sp"></span>' + (ch.length ? '<button class="btn sm primary" data-a="cmp">Look slide by slide</button>' : '') + '<button class="btn sm" data-a="keepall">Keep all of it</button><button class="btn sm ghost" data-a="undoall">Go back to mine</button></div>';
}
function compareDlg(l) {
  const ch = changesOf(l), pick = ch.map(() => 'claude');
  const mini = s => s ? '<div class="pl-cmini"><div class="ls-slide">' + slideHtml(s, l, false) + '</div></div>' : '<div class="pl-cmini none">Not there</div>';
  const row = (c, i) => '<div class="pl-crow" data-i="' + i + '"><div class="pl-ch">' + (c.kind === 'added' ? 'Claude added a slide' : c.kind === 'removed' ? 'Claude took out a slide' : 'Slide ' + (l.slides.indexOf(c.now) + 1) + ' changed') + '</div>' +
    '<div class="pl-cpair"><label class="pl-side' + (pick[i] === 'mine' ? ' on' : '') + '"><input type="radio" name="c' + i + '" value="mine"' + (pick[i] === 'mine' ? ' checked' : '') + '>' + mini(c.was) + '<span>' + (c.kind === 'added' ? 'Leave it out' : 'Keep mine') + '</span></label>' +
    '<label class="pl-side' + (pick[i] === 'claude' ? ' on' : '') + '"><input type="radio" name="c' + i + '" value="claude"' + (pick[i] === 'claude' ? ' checked' : '') + '>' + mini(c.now) + '<span>' + (c.kind === 'removed' ? 'Take it out' : 'Keep Claude’s') + '</span></label></div>' +
    (c.now && c.now.talk.some(t => t.by === 'claude') ? '<div class="pl-ctalk">' + c.now.talk.filter(t => t.by === 'claude').map(t => '<span>Claude: ' + esc(t.text) + '</span>').join('') + '</div>' : '') + '</div>';
  openDlg('<div class="bh"><h2>Claude’s changes</h2><span class="muted" style="font-size:13px">Yours on the left, Claude’s on the right. Pick one for each.</span></div><div class="bb pl-cmp">' + ch.map(row).join('') + '</div>' +
    '<div class="bf"><button class="btn" data-all="mine">All mine</button><button class="btn" data-all="claude">All Claude’s</button><span class="sp" style="flex:1"></span><button class="btn" data-x>Later</button><button class="btn primary" data-ok>Done</button></div>');
  const box = $('#dlgBox');
  box.onchange = e => { const r = e.target.closest('.pl-crow'); if (!r) return; pick[+r.dataset.i] = e.target.value; for (const s of r.querySelectorAll('.pl-side')) s.classList.toggle('on', s.querySelector('input').checked); };
  box.onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    const all = e.target.closest('[data-all]');
    if (all) { pick.fill(all.dataset.all); for (const r of box.querySelectorAll('.pl-crow')) for (const s of r.querySelectorAll('.pl-side')) { const inp = s.querySelector('input'); inp.checked = inp.value === all.dataset.all; s.classList.toggle('on', inp.checked); } return; }
    if (!e.target.closest('[data-ok]')) return;
    applyPicks(l, ch, pick); closeDlg();
  };
}
function applyPicks(l, ch, pick) {
  ch.forEach((c, i) => {
    if (pick[i] !== 'mine') return;
    if (c.kind === 'added') l.slides = l.slides.filter(s => s !== c.now);
    else if (c.kind === 'changed') { const k = l.slides.indexOf(c.now); l.slides[k] = normSlide({ ...c.was, talk: c.now.talk }); }   // the comments stay either way
    else if (c.kind === 'removed') {   // put it back after the slide that came before it in her version
      const before = l.pending.before, j = before.indexOf(c.was);
      let at = 0; for (let k = j - 1; k >= 0; k--) { const p = l.slides.findIndex(s => s.id === before[k].id); if (p >= 0) { at = p + 1; break; } }
      l.slides.splice(at, 0, normSlide(c.was));
    }
  });
  const mine = pick.filter(p => p === 'mine').length;
  delete l.pending; L.cur = Math.min(L.cur, l.slides.length - 1);
  lessonChanged(false); renderEditor();
  toast(mine ? 'Done. Kept yours on ' + mine + ', Claude’s on ' + (pick.length - mine) + '.' : 'Done. Kept all of Claude’s changes.');
}
async function undoAll(l) {
  const before = l.pending.before, title = l.pending.title;
  await saveVersion(l, 'Claude’s version (you went back to yours)');
  l.slides = before.map(normSlide); if (title) l.title = title; delete l.pending;
  L.cur = Math.min(L.cur, l.slides.length - 1); lessonChanged(false); renderEditor(); toast('Back to your version. Claude’s is under Versions.');
}
// Called by the folder reader when a lesson file changed outside the app.
async function claudeChanged(old, l) {
  if (!old) return;
  if (JSON.stringify(old.slides.map(slideKey)) === JSON.stringify(l.slides.map(slideKey)) && old.title === l.title) { if (old.pending) l.pending = old.pending; return; }
  await saveVersion(old, 'Before Claude’s changes');
  l.pending = old.pending || { at: Date.now(), before: JSON.parse(JSON.stringify(old.slides)), title: old.title };
}

/* ---------- the slide's "for Claude" note and comments ---------- */
function slideTalkHtml(s) {
  return '<div class="pl-ask"><label class="ls-notes">What I want on this slide <span class="muted" style="font-weight:400">(for Claude, not shown on the slide)</span><textarea data-f="ask" rows="2" placeholder="Like: a short video on ethos here, or three examples from Ch 4">' + esc(s.ask) + '</textarea></label><button class="btn sm ghost pl-mic" data-dict="[data-f=&quot;ask&quot;]" title="Say it instead of typing">🎤 Dictate</button>' +
    ctxHtml(s) +
    '<div class="pl-talk">' + s.talk.map((t, i) => '<div class="pl-msg ' + (t.by === 'claude' ? 'cl' : 'me') + (t.done ? ' done' : '') + '"><b>' + (t.by === 'claude' ? 'Claude' : 'You') + '</b><span>' + esc(t.text) + '</span><button class="btn sm ghost" data-talkdone="' + i + '">' + (t.done ? 'Open again' : 'Done') + '</button></div>').join('') +
    '<div class="pl-say"><input class="btn sm" data-f="say" placeholder="Comment on this slide…" aria-label="Comment on this slide"><button class="btn sm" data-a="say">Add</button></div></div></div>';
}
/* ---------- screenshots for context: on the slide's "for Claude" area, not on the slide ---------- */
function ctxHtml(s) {
  const c = s.ctx || [];
  return '<div class="pl-cs"><div class="pl-cs-h"><b>Screenshots</b> <span class="muted">for context, not on the slide. Paste (Ctrl+V or ⌘V) or drop one here.</span>' +
    '<button class="btn sm" data-a="ctxadd">+ Screenshot</button><input type="file" id="ctxIn" accept="image/*" multiple hidden></div>' +
    (c.length ? '<div class="pl-cs-list">' + c.map((x, i) => '<div class="pl-csi"><button class="pl-csi-img" data-ctxview="' + i + '" title="See it bigger"><img src="' + esc(imgSrc(x.src)) + '" alt="' + esc(x.note || 'Screenshot') + '"></button>' +
      '<input class="btn sm" data-f="ctxnote" data-i="' + i + '" value="' + esc(x.note) + '" placeholder="What is it? (like: the task sheet)" aria-label="What this screenshot is">' +
      '<div class="pl-csi-b"><button class="btn sm" data-ctxput="' + i + '" title="Make a picture slide of it after this one">Put on a slide</button><button class="btn sm ghost" data-ctxcopy="' + i + '" title="Copy the picture to paste into Claude">Copy</button><button class="btn sm ghost" data-ctxdel="' + i + '" title="Remove">×</button></div></div>').join('') + '</div>'
      : '') +
    '<p class="muted pl-cs-tip">Crop out student names and faces first.</p></div>';
}
async function addCtxShots(files) {
  const s = L.open.slides[L.cur]; let n = 0;
  for (const f of files) { try { const p = await shrinkPic(f); (s.ctx = s.ctx || []).push({ id: lid(), ...p, note: '' }); n++; } catch { toast('That picture couldn’t be opened'); } }
  if (!n) return;
  lessonChanged(false); renderEditor();
  const ins = document.querySelectorAll('[data-f="ctxnote"]'); if (ins.length) ins[ins.length - 1].focus();
  toast(n === 1 ? 'Screenshot added for context. Say what it is in the box under it.' : n + ' screenshots added for context');
}
function ctxPick() { const i = $('#ctxIn'); if (!i) return; i.onchange = () => { const fs = [...i.files]; i.value = ''; if (fs.length) addCtxShots(fs); }; i.click(); }
async function ctxCopy(x) {
  try {
    const im = new Image(); im.src = x.src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
    const b = await new Promise(r => c.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
    toast('Screenshot copied. Paste it into Claude.');
  } catch { toast('This browser couldn’t copy the picture. Right-click it and choose Copy image.', 6000); }
}
function ctxView(x) {
  openDlg('<div class="bh"><h2>' + esc(x.note || 'Screenshot') + '</h2></div><div class="bb"><img src="' + esc(imgSrc(x.src)) + '" alt="" style="max-width:100%;display:block;margin:0 auto"></div><div class="bf"><button class="btn" data-x>Close</button></div>');
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-x]')) closeDlg(); };
}
function ctxPut(x) {
  const n = normSlide({ layout: 'picture', title: x.note || '', img: { src: x.src, w: x.w, h: x.h, source: '' }, fmt: 2 });
  L.open.slides.splice(L.cur + 1, 0, n); L.cur++; lessonChanged(); renderEditor();
  toast('Made a picture slide of it. The screenshot stays on the slide before as context too.', 5000);
}
function addComment() {
  const i = document.querySelector('[data-f="say"]'), v = i && i.value.trim(); if (!v) return;
  L.open.slides[L.cur].talk.push({ by: 'you', text: v, at: Date.now() }); lessonChanged(false); renderEditor();
  const n = document.querySelector('[data-f="say"]'); if (n) n.focus();
}
async function reviewClick(t) {
  const a = t.dataset.a, l = L.open; if (!l) return false;
  const shots = l.slides[L.cur] && l.slides[L.cur].ctx || [];
  if (a === 'ctxadd') { ctxPick(); return true; }
  if (t.dataset.ctxview != null) { if (shots[+t.dataset.ctxview]) ctxView(shots[+t.dataset.ctxview]); return true; }
  if (t.dataset.ctxcopy != null) { if (shots[+t.dataset.ctxcopy]) await ctxCopy(shots[+t.dataset.ctxcopy]); return true; }
  if (t.dataset.ctxput != null) { if (shots[+t.dataset.ctxput]) { editorCommit(); ctxPut(shots[+t.dataset.ctxput]); } return true; }
  if (t.dataset.ctxdel != null) {
    const s = l.slides[L.cur], i = +t.dataset.ctxdel, gone = shots[i]; if (!gone) return true;
    s.ctx.splice(i, 1); if (!s.ctx.length) delete s.ctx; lessonChanged(false); renderEditor();
    undoToast('Screenshot removed', () => { (s.ctx = s.ctx || []).splice(i, 0, gone); lessonChanged(false); renderEditor(); });
    return true;
  }
  if (t.dataset.talkdone != null) { const m = l.slides[L.cur].talk[+t.dataset.talkdone]; m.done = !m.done; lessonChanged(false); renderEditor(); return true; }
  if (a === 'send') { await sendToClaude(l); return true; }
  if (a === 'versions') { editorCommit(); await versionsDlg(l); return true; }
  if (a === 'cmp') { editorCommit(); compareDlg(l); return true; }
  if (a === 'keepall') { delete l.pending; lessonChanged(false); renderEditor(); toast('Kept all of Claude’s changes. Your version is under Versions.'); return true; }
  if (a === 'undoall') { await undoAll(l); return true; }
  if (a === 'say') { addComment(); return true; }
  return false;
}
