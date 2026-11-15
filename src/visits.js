/* ---------------- how many browsers open the app: one bare count a day ----------------
   Only in the pages at the web address (build.js puts this in index.html and planner.html, never in the double-click copies).
   Once a day per browser, a few seconds after the page opens, it adds one to today's count at a free public counter
   (abacus.jasoncameron.dev, no account), and the first time a browser ever does so, one to today's count of new browsers.
   That is all it sends: no name, no setting, nothing about the work or what happens in the app. The counter sees what any
   web request shows (the address it comes from and the browser's name) and keeps only the numbers.
   Never in the sample, on localhost, from tests (navigator.webdriver) or at any address but the app's own (site.json).
   Offline or blocked, it fails quietly and tries again the next time the app opens. gsc.counted is outside gs.*, so no copy
   of a teacher's work carries it. The counts are read at https://abacus.jasoncameron.dev/get/<NS>/day-YYYY-MM-DD and
   .../new-YYYY-MM-DD (days are UTC). */
(function () {
  try {
    var HOME = '/*@@HOME@@*/', NS = 'gradingstudio-app-v1', AT = 'https://abacus.jasoncameron.dev/hit/' + NS + '/';
    if (navigator.webdriver || !HOME.some(function (a) { return a && location.href.indexOf(a) === 0; })) return;
    var L = window.localStorage;
    if (L.getItem('gs.sampleOn') === '1') return;
    var day = new Date().toISOString().slice(0, 10), last = L.getItem('gsc.counted');
    if (last === day || !window.fetch) return;
    var hit = function (k) { return fetch(AT + k, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' }).then(function (r) { if (!r.ok) throw r.status; }); };
    setTimeout(function () {
      hit('day-' + day).then(function () {
        try { L.setItem('gsc.counted', day); } catch (e) {}
        if (last == null) return hit('new-' + day);
      }).catch(function () {});
    }, 5000);
  } catch (e) {}
})();
