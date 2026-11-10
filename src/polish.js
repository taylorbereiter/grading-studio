/* ---------------- polish: key labels, the app's own pop-ups, keyboard use in dialogs, the More menu ---------------- */
// app.js calls these while it loads, before the code below has run, so they keep no state of their own.
function isMac() { return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent); }
function modKey() { return isMac() ? '⌘' : 'Ctrl'; }
// Labels are written the Mac way (⌘Z, ⇧⌘Z, ⌘-scroll); this turns them into this computer's.
function keyLabel(s) {
  if (isMac()) return s;
  return s.replace(/⇧⌘/g, 'Ctrl+Shift+').replace(/⌘([+−])/g, 'Ctrl $1').replace(/⌘(?=-)/g, 'Ctrl').replace(/⌘/g, 'Ctrl+');
}

const FOCUSABLE = 'a[href],button,input,select,textarea,summary,audio[controls],video[controls],[tabindex]:not([tabindex="-1"])';
// Tab stays inside box: past either end it comes around, and from outside it comes back in.
function trapTab(e, box) {
  const list = [...box.querySelectorAll(FOCUSABLE)].filter(x => !x.disabled && x.checkVisibility());
  const i = list.indexOf(document.activeElement), last = list.length - 1;
  if (!list.length) { e.preventDefault(); box.focus(); }
  else if (i < 0) { e.preventDefault(); list[e.shiftKey ? last : 0].focus(); }
  else if (e.shiftKey && i === 0) { e.preventDefault(); list[last].focus(); }
  else if (!e.shiftKey && i === last) { e.preventDefault(); list[0].focus(); }
}

/* askDlg, sayDlg and askTextDlg sit on a layer of their own, so they can open over a dialog that's already up. One at a time. */
let askQ = Promise.resolve();
function askLayer(text, o, value) {
  const run = () => new Promise(done => {
    const back = document.activeElement, el = document.createElement('div');
    el.className = 'dlg askdlg'; el.id = 'askDlg';
    el.innerHTML = '<div class="box narrow" role="alertdialog" aria-modal="true" aria-labelledby="askText" tabindex="-1"><div class="bb"><p id="askText"></p>' +
      (value == null ? '' : '<input type="text" id="askIn" autocomplete="off" aria-labelledby="askText">') + '</div><div class="bf">' +
      (o.cancel === false ? '' : '<button class="btn" data-no></button>') + '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-ok></button></div></div>';
    const box = el.firstChild, inp = el.querySelector('#askIn'), no = el.querySelector('[data-no]'), ok = el.querySelector('[data-ok]');
    el.querySelector('#askText').textContent = text;
    ok.textContent = o.ok || 'OK';
    if (no) no.textContent = o.cancel || 'Cancel';
    if (inp) inp.value = value;
    const finish = yes => {
      document.removeEventListener('keydown', keys, true);
      const typed = inp ? inp.value : null;
      el.remove();
      if (back && back.isConnected) back.focus({ preventScroll: true });
      done({ yes, typed });
    };
    const keys = e => {
      e.stopPropagation();   // nothing behind gets a key while this is up; typing and pressing its buttons still work
      if (e.key === 'Tab') trapTab(e, box);
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); finish(true); }
    };
    ok.onclick = () => finish(true);
    if (no) no.onclick = () => finish(false);
    el.addEventListener('pointerdown', e => { if (e.target === el) finish(false); });
    document.addEventListener('keydown', keys, true);
    document.body.appendChild(el);
    // A risky question starts on the safe answer, so a stray Enter can't delete anything.
    if (inp) { inp.focus(); inp.select(); } else (o.danger && no ? no : ok).focus();
  });
  const p = askQ.then(run);
  askQ = p;
  return p;
}
// await askDlg(text, { ok, cancel, danger }): true for OK; false for Cancel, Escape or a click outside.
function askDlg(text, o) { return askLayer(text, o || {}).then(r => r.yes); }
// await sayDlg(text): shows a message and waits for it to be closed.
function sayDlg(text, o) { return askLayer(text, { cancel: false, ...o }).then(() => {}); }
// await askTextDlg(label, value, { ok, cancel }): what was typed, or null if cancelled.
function askTextDlg(label, value, o) { return askLayer(label, o || {}, value == null ? '' : String(value)).then(r => r.yes ? r.typed : null); }

/* The big dialog: says what it is, starts with the keyboard inside it, keeps Tab inside, and hands focus back when it closes. */
let dlgBack = null;   // openDlg can't run before this line: nothing opens a dialog while the app loads
function dlgShown() {
  const box = $('#dlgBox'), h = box.querySelector('h2');
  if (h) { h.id ||= 'dlgTitle'; box.setAttribute('aria-labelledby', h.id); } else box.removeAttribute('aria-labelledby');   // some dialogs look their title up by its own id
  const a = document.activeElement;
  if (!dlgBack && a && a !== document.body && !box.contains(a)) dlgBack = a;
  setMore(false);
  box.scrollTop = 0; box.focus({ preventScroll: true });
}
function dlgFocusBack() {
  const b = dlgBack; dlgBack = null;
  if (!b || !b.isConnected) return;
  (b.closest('#moreMenu') ? $('#moreBtn') : b).focus({ preventScroll: true });
}
document.addEventListener('keydown', e => { if (e.key === 'Tab' && !$('#dlg').hidden && !dlgPage && !$('#askDlg')) trapTab(e, $('#dlgBox')); }, true);
// Leaving a split part way loses the sorting, so it asks. Its Cancel button clears the split.
async function splitLeave() {
  if (await askDlg('Leave this split? The pages you’ve sorted so far won’t be kept.', { ok: 'Leave', cancel: 'Keep sorting', danger: true })) { const c = $('#dlgBox [data-cancel]'); if (c) c.click(); }
}

/* The More menu in the top bar. Escape closes it, ↑ ↓ move through it, and a click anywhere else closes it. */
function setMore(open) {
  const m = $('#moreMenu'); if (m.hidden === !open) return;
  m.hidden = !open; $('#moreBtn').setAttribute('aria-expanded', String(open));
  if (open) moreItems().find(x => x.tagName !== 'SELECT').focus({ preventScroll: true });
}
const moreItems = () => [...$('#moreMenu').querySelectorAll(FOCUSABLE)].filter(x => !x.disabled && x.checkVisibility());
$('#moreBtn').onclick = () => setMore($('#moreMenu').hidden);
$('#keysBtn').onclick = openKeys;
document.addEventListener('click', e => {
  if ($('#moreMenu').hidden || e.target.closest('#moreBtn') || e.target.closest('.mrow')) return;
  setMore(false);
});
// A press on the paper only closes the menu. It mustn't also mark the paper underneath.
document.addEventListener('pointerdown', e => {
  if ($('#moreMenu').hidden || !e.target.closest('#paper')) return;
  e.preventDefault(); e.stopPropagation(); setMore(false);
}, true);
// Tabbing out of the menu closes it, so keys are never held back from whatever has the keyboard next.
$('#moreMenu').addEventListener('focusout', e => { if (e.relatedTarget && !e.relatedTarget.closest('#moreMenu,#moreBtn')) setMore(false); });
document.addEventListener('keydown', e => {
  if ($('#moreMenu').hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMore(false); $('#moreBtn').focus(); return; }
  if (document.activeElement !== $('#classSel')) e.stopPropagation();   // nothing behind the menu gets a key; its buttons still press, and the browser's own keys still work. The app already leaves keys on the roster alone.
  if (e.altKey) return;   // Alt+↓ opens the roster's list; Alt+← is the browser's Back
  // Changing the roster moves the assignment to that class, so it only changes from its open list (a click or Space), never from a stray arrow or letter.
  if (document.activeElement === $('#classSel') && e.key !== 'Tab' && e.key !== ' ' && !/^Arrow/.test(e.key) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); e.stopPropagation(); return; }
  if (!/^Arrow/.test(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
  const list = moreItems(), i = list.indexOf(document.activeElement), n = list.length;
  list[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
}, true);

// The floating Lighting and Calculator panels close with Escape when the keyboard is in them, or when nothing else would take the Escape.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const a = document.activeElement, free = (!a || a === document.body) && !selected && $('#dlg').hidden && !$('#askDlg');
  const p = (a && a.closest && a.closest('#lightPanel,#calcPanel')) || (free && $('#lightPanel,#calcPanel'));
  if (p) { e.preventDefault(); e.stopPropagation(); p.remove(); }
}, true);
// A box that says it's working, for the wait before a dialog can open, so keys and clicks don't land on the paper meanwhile. Returns its title, which is gone once she closes it.
function waitDlg(title, say) {
  openDlg('<div class="bh"><h2>' + esc(title) + '</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb"><p class="muted" style="margin:0">' + esc(say) + '</p></div>', true);
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) closeDlg(); };
  return $('#dlgBox h2');
}

/* The start screen: the five newest downloads, with the rest a click away. */
function keptTidy(n) {
  const b = $('#keptAll'), all = $('#kept').classList.contains('all');
  b.hidden = n <= 5;
  b.textContent = all ? 'Show only the newest' : 'Show all ' + n + ' downloads';
}
$('#keptAll').onclick = () => { $('#kept').classList.toggle('all'); keptTidy($('#kept').children.length); };

Object.assign(window.__gs, { isMac, modKey, keyLabel, askDlg, sayDlg, askTextDlg, renderKept, openArrange });
