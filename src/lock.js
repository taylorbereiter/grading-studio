/* ---------------- one writer: the new version of the app and this one never write at the same time ----------------
   Runs on both pages, straight after the sample's lines (src/samplemode.js), so in the sample the lock has the sample's own name.
   Every page of this version takes the browser lock "gs-writer" in shared mode, so any number of them open together work as they
   always have (they already merge each other's saves, src/saving.js). The new version (next/) takes the same lock alone. While it
   holds it, a page of this version can't get its share: it covers itself with a plain message and takes no input, and it waits.
   When the new version's window closes, the wait ends and this page reloads, so it starts from what is saved and never writes
   over newer work with an old copy. The answer is asked for at once (ifAvailable), never waited out. Only a browser with no lock
   at all, or one that fails, is let through as before. Nothing here reads or writes saved work. */
(function () {
  var L = navigator.locks, NAME = 'gs-writer', blocked = false;
  window.__gsWriter = { state: 'asking' };
  // No Locks API (an old browser): this page is let through as before, and answers the new version when it asks on the channel
  // whether another window is open, so the new version opens read-only beside it.
  var answer = function () { try { var ch = new BroadcastChannel(NAME); ch.onmessage = function (e) { var d = e.data || {}; if (d.ask) ch.postMessage({ here: true, from: 'old' }); }; } catch (e) {} };
  if (!L || typeof L.request !== 'function') { window.__gsWriter.state = 'no-locks'; answer(); return; }
  var hold = function () { window.__gsWriter.state = 'writer'; return new Promise(function () {}); };
  // The message over the whole page. It goes up as soon as there is a body to put it in.
  function cover() {
    if (blocked) return; blocked = true; window.__gsWriter.state = 'blocked';
    var put = function () {
      if (document.getElementById('gsWriterBlock')) return;
      var el = document.createElement('div');
      el.id = 'gsWriterBlock'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.tabIndex = -1;
      el.textContent = 'Grading Studio is open in the new version in another window. Close that window to work here.';
      el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;font:500 18px/1.5 Inter,system-ui,sans-serif;color:#fff;background:rgba(20,24,31,.86)';
      document.body.appendChild(el); try { el.focus(); } catch (e) {}
    };
    if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
    // No typing, clicking or dropping reaches the page underneath.
    var stop = function (e) { if (blocked) { e.stopImmediatePropagation(); e.preventDefault(); } };
    ['keydown', 'keypress', 'keyup', 'pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart', 'dragover', 'drop', 'paste'].forEach(function (t) { window.addEventListener(t, stop, { capture: true, passive: false }); });
    // In line for its share: when the new version lets go, start again from what is saved.
    try { L.request(NAME, { mode: 'shared' }, function () { location.reload(); return new Promise(function () {}); }).catch(function () {}); } catch (e) {}
  }
  try {
    L.request(NAME, { mode: 'shared', ifAvailable: true }, function (lock) { if (!lock) { cover(); return null; } return hold(); })
      .catch(function (e) { if (e && e.name === 'AbortError') cover(); else { window.__gsWriter.state = 'lock-failed'; answer(); } });   // AbortError: the new version took the lock over
  } catch (e) { window.__gsWriter.state = 'lock-failed'; answer(); }
})();
