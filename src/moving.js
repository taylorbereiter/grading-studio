/* ---------------- this address is moving: a notice, and the way across ---------------- */
// Saved work belongs to the address it was made at, so a new address opens empty. site.json (beside package.json) names where this
// copy lives ("address") and, while a move is on, where it is going ("movingTo"); build.js puts both here. Only the copy at the
// address being left says anything. The take-home file carries everything, the Planner included, and Bring work in takes it in.
let MOVE = '/*@@SITE@@*/';
const moveOrigin = t => { try { const u = new URL(t); return /^https?:$/.test(u.protocol) ? u.origin : ''; } catch { return ''; } };
function movingTo() {
  const from = moveOrigin(MOVE && MOVE.address), to = moveOrigin(MOVE && MOVE.movingTo);
  return to && from && from !== to && location.origin === from ? MOVE.movingTo : '';
}
const moveDay = () => new Date().toDateString();
function moveCard() {
  const old = $('#setMoving'); if (old) old.remove();
  const to = movingTo(); if (!to) return;
  const el = document.createElement('section');
  el.className = 'lib setsec'; el.id = 'setMoving'; el.dataset.sec = 'saving'; el.hidden = $('#setSaving').hidden;
  el.innerHTML = '<div class="lhead"><h2>Grading Studio is moving to a new address</h2><span class="sp"></span><button class="btn sm primary" data-movetake>Take my work with me</button></div>' + moveSteps(to);
  el.onclick = e => { if (e.target.closest('[data-movetake]')) openTake(); };
  $('#setSaving').before(el);
}
const moveSteps = to => '<p class="setp" style="margin-top:0">The new address is <a href="' + esc(to) + '" target="_blank" rel="noopener"><b>' + esc(to) + '</b></a>. Work saved in this browser stays at this address. It does not move by itself.</p>' +
  '<ol class="setp" style="padding-left:20px"><li>Press <b>Take my work with me</b> and save the file. It holds your grading work and your Planner.</li><li>Open the new address.</li><li>There, in Settings, <b>Saving and carrying</b>, press <b>Bring work in</b> and choose the file.</li></ol>' +
  '<p class="muted setp">Please do this soon: this address will stop working. A linked folder can be linked again at the new address too.</p>';
// Once a day, to someone with work here, until they have moved.
function moveAsk() {
  const to = movingTo(); if (!to || !$('#dlg').hidden || !$('#welcome').hidden) return;
  try { if (localStorage.getItem('gsc.moveSeen') === moveDay()) return; localStorage.setItem('gsc.moveSeen', moveDay()); } catch {}
  openDlg('<div class="bh"><h2>Grading Studio is moving to a new address</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="moveBox">' + moveSteps(to) + '</div>' +
    '<div class="bf"><button class="btn" data-close>Later</button><a class="btn" href="' + esc(to) + '" target="_blank" rel="noopener">Open the new address</a><button class="btn primary" data-movetake>Take my work with me</button></div>', true);
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) return closeDlg(); if (e.target.closest('[data-movetake]')) { closeDlg(); go('#/settings'); openTake(); } };
}
moveCard();
Promise.resolve(keptFirst).then(() => setTimeout(() => { if (keptMeta.size || ((lib && lib.classes) || []).length) moveAsk(); }, 1200));
Object.assign(window.__gs, { movingTo, moveTest: to => { MOVE = { address: location.href, movingTo: to }; try { localStorage.removeItem('gsc.moveSeen'); } catch {} moveCard(); moveAsk(); } });
