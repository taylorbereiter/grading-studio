/* ================= Planner: the small helpers it needs =================
   The Planner is its own page with its own code. None of Grading Studio's grading code is in it,
   and it never opens the grading database or the grading folder. These are its own copies of the few
   helpers it shares in spirit with the grading app. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hash(s) {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
let toastT;
function toast(msg, ms) {
  const t = $('.toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; t.textContent = ''; }, ms || 3000);
}
let dlgBack = null;
function openDlg(html, narrow) {
  const box = $('#dlgBox');
  if ($('#dlg').hidden) dlgBack = document.activeElement;
  box.onclick = box.onchange = box.oninput = box.onkeydown = null;
  box.className = 'box' + (narrow ? ' narrow' : '');
  box.innerHTML = html; $('#dlg').hidden = false;
  const f = box.querySelector('input:not([type=hidden]),textarea,select,button.primary'); (f || box).focus();
}
function closeDlg() {
  const box = $('#dlgBox'); box.onclick = box.onchange = box.oninput = box.onkeydown = null;
  $('#dlg').hidden = true; box.innerHTML = '';
  if (dlgBack && dlgBack.focus) try { dlgBack.focus(); } catch { }
  dlgBack = null;
}
$('#dlg').addEventListener('pointerdown', e => { if (e.target.id === 'dlg') closeDlg(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#dlg').hidden) { e.preventDefault(); closeDlg(); } }, true);
async function saveBlob(name, blob) {
  name = name.replace(/[\\/:*?"<>|]+/g, '-');
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
// Light by default; the button flips it, and the choice is shared with Grading Studio.
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('gs.theme', JSON.stringify(t)); } catch { }
  for (const b of document.querySelectorAll('.themeBtn')) b.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
}
document.addEventListener('click', e => { if (e.target.closest('.themeBtn')) setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); });
