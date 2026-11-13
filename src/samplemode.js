/* ---------------- the sample: a made-up school week, kept apart from everything real ----------------
   Runs first on both pages, before anything reads saved work. While the sample is open (gs.sampleOn in the browser's real storage),
   every page at this address keeps its work under other names: each localStorage and sessionStorage key gets "sample:" in front,
   and each database "sample-". The rest of the app never knows. So nothing of the sample can sit beside a teacher's own classes,
   go into their folder, a take-home file or a new year, and leaving the sample is only taking the switch away and clearing
   what was kept under those names. A teacher with real work can open the sample and come back to find that work untouched.
   Two things are shared with the real side on purpose, since they are about the screen and not about work: the theme and the language.
   What fills the sample is in src/sample-data.js, fetched only when the sample is opened (src/sample.js builds it). */
(function () {
  var REAL = window.localStorage, KEY = 'gs.sampleOn', LEFT = 'gs.sampleLeft', PRE = 'sample:', DBPRE = 'sample-';
  var SHARED = { 'gs.theme': 1, 'gs.lang': 1 };
  // Every database either page makes. A test reads the source and fails if one is missing here.
  var DBS = ['grading-studio-keep', 'grading-studio-added', 'grading-studio-folder', 'grading-studio-examples', 'grading-studio-safety', 'grading-studio-models', 'grading-studio-school', 'grading-studio-videos', 'gs-lessons'];
  var on = false; try { on = REAL.getItem(KEY) === '1'; } catch (e) {}
  var F = window.IDBFactory && IDBFactory.prototype, open0 = F && F.open, del0 = F && F.deleteDatabase, list0 = F && F.databases;
  // What the sample kept, cleared. Deleting a database waits for any page that still has it open, and an open asked for after
  // this waits behind it, so a sample opened straight after always starts from nothing.
  function wipe() {
    try { var ks = []; for (var i = 0; i < REAL.length; i++) { var k = REAL.key(i); if (k && k.indexOf(PRE) === 0) ks.push(k); } ks.forEach(function (k) { REAL.removeItem(k); }); } catch (e) {}
    try { var s = window.sessionStorage, ss = []; for (var j = 0; j < s.length; j++) { var q = s.key(j); if (q && q.indexOf(PRE) === 0) ss.push(q); } ss.forEach(function (q) { s.removeItem(q); }); } catch (e) {}
    if (!del0) return;
    var left = DBS.length, done = function () { if (!--left) try { REAL.removeItem(LEFT); } catch (e) {} };
    DBS.forEach(function (n) { try { var r = del0.call(indexedDB, DBPRE + n); r.onsuccess = r.onerror = done; } catch (e) { done(); } });
    if (list0) try { list0.call(indexedDB).then(function (l) { l.forEach(function (d) { if (d.name && d.name.indexOf(DBPRE) === 0 && DBS.indexOf(d.name.slice(DBPRE.length)) < 0) del0.call(indexedDB, d.name); }); }, function () {}); } catch (e) {}
  }
  function enter() { try { REAL.setItem(LEFT, '1'); wipe(); REAL.setItem(KEY, '1'); } catch (e) { return false; } return true; }
  function leave() { try { REAL.removeItem(KEY); REAL.setItem(LEFT, '1'); } catch (e) {} }
  // Another tab opened or left the sample: this one follows, so no page is ever on the other side without saying so.
  window.addEventListener('storage', function (e) { if (e.storageArea === REAL && e.key === KEY && (e.newValue === '1') !== on) location.reload(); });
  window.__gsSample = { on: on, enter: enter, leave: leave, wipe: wipe, dbs: DBS.slice(), again: function () { try { REAL.removeItem(PRE + 'gs.sampleBuilt'); } catch (e) {} } };
  if (!on) { try { if (REAL.getItem(LEFT)) wipe(); } catch (e) {} return; }
  // A sample that was never finished (the tab closed while it was being made) starts again from nothing.
  try { if (REAL.getItem(PRE + 'gs.sampleBuilt') == null) wipe(); else window.__gsSample.built = true; } catch (e) {}

  /* from here on, the sample is open: every name this page stores under is changed on its way in and out */
  function area(real) {
    var keys = function () { var o = []; for (var i = 0; i < real.length; i++) { var k = real.key(i); if (k == null) continue; if (k.indexOf(PRE) === 0) o.push(k.slice(PRE.length)); else if (SHARED[k]) o.push(k); } return o; };
    var name = function (k) { k = String(k); return SHARED[k] ? k : PRE + k; };
    var api = {
      getItem: function (k) { return real.getItem(name(k)); },
      setItem: function (k, v) { real.setItem(name(k), v); },
      removeItem: function (k) { real.removeItem(name(k)); },
      clear: function () { keys().forEach(function (k) { if (!SHARED[k]) real.removeItem(PRE + k); }); },
      key: function (i) { var k = keys()[i]; return k == null ? null : k; },
    };
    return new Proxy({}, {
      get: function (t, p) { if (p === 'length') return keys().length; if (typeof p !== 'string') return undefined; if (api[p]) return api[p]; var v = real.getItem(name(p)); return v == null ? undefined : v; },
      set: function (t, p, v) { real.setItem(name(p), String(v)); return true; },
      deleteProperty: function (t, p) { real.removeItem(name(p)); return true; },
      has: function (t, p) { return typeof p === 'string' && (p in api || p === 'length' || real.getItem(name(p)) != null); },
      ownKeys: function () { return keys(); },
      getOwnPropertyDescriptor: function (t, p) { var v = typeof p === 'string' ? real.getItem(name(p)) : null; return v == null ? undefined : { value: v, writable: true, enumerable: true, configurable: true }; },
    });
  }
  var LS = area(REAL);
  Object.defineProperty(window, 'localStorage', { get: function () { return LS; }, configurable: true });
  try { var SS = area(window.sessionStorage); Object.defineProperty(window, 'sessionStorage', { get: function () { return SS; }, configurable: true }); } catch (e) {}
  if (F) {
    F.open = function (n) { var a = [].slice.call(arguments); a[0] = DBPRE + n; return open0.apply(this, a); };
    F.deleteDatabase = function (n) { var a = [].slice.call(arguments); a[0] = DBPRE + n; return del0.apply(this, a); };
    if (list0) F.databases = function () { return list0.call(this).then(function (l) { return l.filter(function (d) { return d.name && d.name.indexOf(DBPRE) === 0; }).map(function (d) { return { name: d.name.slice(DBPRE.length), version: d.version }; }); }); };
  }
  if (window.BroadcastChannel) { var BC = window.BroadcastChannel; window.BroadcastChannel = function (n) { return new BC(PRE + n); }; window.BroadcastChannel.prototype = BC.prototype; }
  if (navigator.locks && window.LockManager) { var rq = LockManager.prototype.request; LockManager.prototype.request = function (n) { var a = [].slice.call(arguments); a[0] = PRE + n; return rq.apply(this, a); }; }
  // A change another sample tab saved arrives under its real name: pages are told about it by the name they know, and never about real work.
  var add0 = window.addEventListener, rm0 = window.removeEventListener, wraps = new Map();
  window.addEventListener = function (type, fn, opt) {
    if (type !== 'storage' || typeof fn !== 'function') return add0.call(this, type, fn, opt);
    var w = wraps.get(fn);
    if (!w) wraps.set(fn, w = function (e) {
      if (e.storageArea !== REAL) return;
      var k = e.key; if (k != null) { if (SHARED[k]) {} else if (k.indexOf(PRE) === 0) k = k.slice(PRE.length); else return; }
      fn.call(this, { type: 'storage', key: k, oldValue: e.oldValue, newValue: e.newValue, url: e.url, storageArea: LS, target: e.target });
    });
    return add0.call(this, type, w, opt);
  };
  window.removeEventListener = function (type, fn, opt) { return rm0.call(this, type, type === 'storage' && wraps.get(fn) || fn, opt); };
  document.documentElement.classList.add('gs-sample');
})();
