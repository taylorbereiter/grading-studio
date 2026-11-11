/* ================= Pick a name, make groups: one screen the class can read =================
   Built into both pages. On the grading page it opens from a class's Seating tab; in the Planner it opens while a lesson
   is presented (P for a name, G for groups).
   The Planner never opens grading's work. So that it can call on a student, the grading page keeps each class's roster
   in one small record of its own (gs.rolls: [[class name, [names]], …]) in this browser. The Planner reads it here and
   only shows it: a name is never put in a lesson, the Planner's own storage or the Planner folder.
   Nothing here is saved. Who has had a turn and who is away today are remembered until the page is closed. */
const PK = { on: false, fast: false, mem: new Map() };
const PK_ROLLS = 'gs.rolls';
const pkNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// A roster line as it is said: "Okafor, Ada" is "Ada Okafor".
const pkNice = n => { const s = String(n || '').trim(), m = /^([^,]+),\s*(.+)$/.exec(s); return m ? m[2].trim() + ' ' + m[1].trim() : s; };
// For a desk: first names, with the first letter of the last name wherever two students share one.
function pkShort(names) {
  const parts = names.map(n => pkNice(n).split(/\s+/).filter(Boolean)), first = parts.map(p => p[0] || '?'), count = new Map();
  for (const f of first) count.set(f.toLowerCase(), (count.get(f.toLowerCase()) || 0) + 1);
  return parts.map((p, i) => count.get(first[i].toLowerCase()) > 1 && p.length > 1 ? first[i] + ' ' + [...p[p.length - 1]][0].toUpperCase() + '.' : first[i]);
}
function pkShuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// How many groups: by 'size' (groups of n, and nobody left alone or far short: 25 in pairs is eleven pairs and a three) or by 'count' (n groups).
function pkCount(len, by, n) {
  if (len < 1) return 0;
  if (by === 'count') return Math.max(1, Math.min(len, n));
  const up = Math.ceil(len / n), least = Math.floor(len / up);
  return least >= Math.max(2, n - 1) || up === 1 ? up : Math.max(1, Math.floor(len / n));
}
// The names dealt into groups as evenly as they go.
function pkGroups(names, by, n) {
  const k = pkCount(names.length, by, n), out = Array.from({ length: k }, () => []);
  pkShuffle(names).forEach((nm, i) => out[i % k].push(nm));
  return out;
}
// Every class's roster, as the grading page last left it.
function pkRolls() {
  try {
    const v = JSON.parse(localStorage.getItem(PK_ROLLS) || '[]');
    return (Array.isArray(v) ? v : []).filter(r => Array.isArray(r) && typeof r[0] === 'string' && Array.isArray(r[1]) && r[1].length).map(r => ({ name: r[0], names: r[1].map(String) }));
  } catch { return []; }
}
const pkEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// What is remembered for a class until the page is closed: who is away, who has had a turn, the groups as last dealt.
function pkMem(cls) {
  const k = pkNorm(cls.name) + '|' + cls.names.length;
  if (!PK.mem.has(k)) PK.mem.set(k, { away: new Set(), bag: [], turns: 0, last: '', by: 'size', n: 4, groups: null });
  return PK.mem.get(k);
}
const pkHere = () => { const m = pkMem(PK.cls); return PK.cls.names.filter(n => !m.away.has(n)); };

/* o: { host, classes: [{ name, names }], at, mode: 'pick' | 'groups', full: offer full screen, onClose } */
function pkOpen(o) {
  if (PK.on || !o.classes.length) return;
  Object.assign(PK, { on: true, o, cls: o.classes[Math.max(0, o.at || 0)] || o.classes[0], mode: o.mode === 'groups' ? 'groups' : 'pick', who: false, back: document.activeElement, spin: 0 });
  const el = PK.el = document.createElement('div');
  el.id = 'pkStage'; el.className = 'pk'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<div class="pk-main" id="pkMain"></div><aside class="pk-who" id="pkWho" aria-label="Who is here" hidden></aside><div class="pk-bar" id="pkBar" role="toolbar"></div><div class="pk-say" id="pkSay" aria-live="polite"></div>';
  o.host.appendChild(el);
  el.addEventListener('click', pkClick);
  el.addEventListener('change', e => { if (e.target.id === 'pkClass') { PK.cls = PK.o.classes[+e.target.value] || PK.cls; PK.who = false; pkRun(true); } });
  if (!o.keys) document.addEventListener('keydown', pkKeyOwn, true);
  pkRun(true); el.focus();
}
function pkClose() {
  if (!PK.on) return;
  const { el, back, o } = PK;
  PK.on = false; clearInterval(PK.spin); PK.el = null;
  document.removeEventListener('keydown', pkKeyOwn, true);
  try { if (document.fullscreenElement === el) document.exitFullscreen(); } catch { }
  el.remove();
  if (o.onClose) o.onClose(); else if (back && back.isConnected && back.focus) try { back.focus({ preventScroll: true }); } catch { }
}
// fresh: a new name, or new groups. Otherwise only what is on screen is drawn again.
function pkRun(fresh) {
  const m = pkMem(PK.cls), here = pkHere();
  PK.el.setAttribute('aria-label', PK.mode === 'pick' ? 'Pick a name' : 'Groups');
  if (PK.mode === 'pick') { if (fresh) pkNext(); else pkName(m.last, true); }
  else { if (fresh || !m.groups) m.groups = pkGroups(here, m.by, m.n); pkDrawGroups(); }
  pkBar(); pkWho();
}
// The next name: nobody twice until everyone here has had a turn.
function pkNext() {
  const m = pkMem(PK.cls), here = pkHere();
  clearInterval(PK.spin);
  if (!here.length) { m.last = ''; return pkName('', true); }
  m.bag = m.bag.filter(n => here.includes(n));
  let again = false;
  if (!m.bag.length) { m.bag = pkShuffle(here); again = m.turns > 0; m.turns = 0; if (m.bag.length > 1 && m.bag[m.bag.length - 1] === m.last) m.bag.reverse(); }
  const name = m.bag.pop(); m.last = name; m.turns++; PK.again = again;
  const still = PK.fast || here.length < 2 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (still) return pkName(name, true);
  // a moment of names going by, then the one
  let ticks = 0;
  pkName(here[Math.floor(Math.random() * here.length)], false);
  PK.spin = setInterval(() => { if (!PK.on) return clearInterval(PK.spin); if (++ticks >= 9) { clearInterval(PK.spin); return pkName(name, true); } pkName(here[Math.floor(Math.random() * here.length)], false); }, 70);
}
function pkName(name, done) {
  const m = pkMem(PK.cls), here = pkHere(), nice = pkNice(name), main = PK.el.querySelector('#pkMain');
  const sub = !here.length ? 'Nobody is marked as here. “Who’s here” puts students back.' : !done ? '' : (PK.again ? 'Everyone has had a turn. Starting again. ' : '') + m.turns + ' of ' + here.length + ' picked';
  main.className = 'pk-main pick';
  main.innerHTML = '<div class="pk-cls">' + pkEsc(PK.cls.name) + '</div><div class="pk-name' + (done ? ' done' : '') + '" id="pkName" style="font-size:min(15vh,' + (150 / Math.max(6, [...nice].length)).toFixed(1) + 'vw)">' + pkEsc(nice || '–') + '</div><div class="pk-sub" id="pkSub">' + pkEsc(sub) + '</div>';
  if (done) PK.el.querySelector('#pkSay').textContent = nice ? nice : 'Nobody to pick';
}
function pkDrawGroups() {
  const m = pkMem(PK.cls), g = m.groups || [], main = PK.el.querySelector('#pkMain');
  const rows = Math.max(1, Math.round(Math.sqrt(g.length / 1.6))), cols = Math.max(1, Math.ceil(g.length / rows)), most = Math.max(1, ...g.map(x => x.length));
  // as big as fits: by the height of the screen for the lines, by its width for the longest name
  const long = Math.max(8, ...g.flat().map(n => [...pkNice(n)].length)), fs = Math.max(1.5, Math.min(4.6, 70 / (rows * (most + 1.9)) / 1.3)), fw = Math.max(.8, (90 / cols - 3) / (long * .6));
  main.className = 'pk-main groups';
  main.innerHTML = '<div class="pk-cls">' + pkEsc(PK.cls.name) + '</div>' + (g.length
    ? '<div class="pk-groups" id="pkGroups" style="--cols:' + cols + ';--fs:min(' + fs.toFixed(2) + 'vh,' + fw.toFixed(2) + 'vw)">' + g.map((x, i) => '<section class="pk-g"><h3>Group ' + (i + 1) + '</h3>' + x.map(n => '<div>' + pkEsc(pkNice(n)) + '</div>').join('') + '</section>').join('') + '</div>'
    : '<div class="pk-sub">Nobody is marked as here. “Who’s here” puts students back.</div>');
  PK.el.querySelector('#pkSay').textContent = g.length + (g.length === 1 ? ' group' : ' groups');
}
function pkBar() {
  const m = pkMem(PK.cls), o = PK.o, pick = PK.mode === 'pick', away = m.away.size;
  const b = (k, label, key, more) => '<button data-pk="' + k + '" title="' + label + (key ? ' (' + key + ')' : '') + '"' + (more || '') + '>' + label + '</button>';
  PK.el.querySelector('#pkBar').innerHTML =
    (o.classes.length > 1 ? '<select id="pkClass" aria-label="Class">' + o.classes.map((c, i) => '<option value="' + i + '"' + (c === PK.cls ? ' selected' : '') + '>' + pkEsc(c.name) + '</option>').join('') + '</select><span class="pk-sep"></span>' : '') +
    b('pick', 'Pick a name', 'P', ' aria-pressed="' + pick + '"') + b('groups', 'Groups', 'G', ' aria-pressed="' + !pick + '"') + '<span class="pk-sep"></span>' +
    (pick ? b('again', 'Pick again', 'Space', ' class="pk-go"') + b('reset', 'Start over', '')
      : '<span class="pk-seg" role="group" aria-label="How to group"><button data-pkby="size" aria-pressed="' + (m.by === 'size') + '">Groups of</button><button data-pkby="count" aria-pressed="' + (m.by === 'count') + '">Number of groups</button></span>' +
        '<span class="pk-seg" role="group" aria-label="' + (m.by === 'size' ? 'Students in a group' : 'Groups') + '">' + [2, 3, 4, 5, 6, 7, 8].map(n => '<button data-pkn="' + n + '" aria-pressed="' + (m.n === n) + '">' + n + '</button>').join('') + '</span>' +
        b('again', 'Shuffle again', 'Space', ' class="pk-go"') + b('copy', 'Copy', '')) +
    '<span class="pk-sep"></span>' + b('who', 'Who’s here' + (away ? ' · ' + away + ' away' : ''), 'W', ' aria-pressed="' + PK.who + '"') +
    (o.full ? b('full', 'Full screen', 'F') : '') + '<button data-pk="close" class="pk-end" title="Close (Esc)">Close</button>';
}
function pkWho() {
  const w = PK.el.querySelector('#pkWho'); w.hidden = !PK.who; if (!PK.who) return;
  const m = pkMem(PK.cls);
  w.innerHTML = '<h2>Who’s here</h2><p>Click anyone who is away today. They are left out of picks and groups until this page is closed.</p><div class="pk-wl">' +
    PK.cls.names.map((n, i) => '<button data-pkw="' + i + '" aria-pressed="' + !m.away.has(n) + '">' + pkEsc(pkNice(n)) + '</button>').join('') + '</div>';
}
function pkDo(k) {
  const m = pkMem(PK.cls);
  if (k === 'close') return pkClose();
  if (k === 'pick') { const was = PK.mode; PK.mode = 'pick'; return pkRun(was === 'pick' || !m.last); }
  if (k === 'groups') { const was = PK.mode; PK.mode = 'groups'; return pkRun(was === 'groups'); }
  if (k === 'again') return pkRun(true);
  if (k === 'reset') { m.bag = []; m.turns = 0; m.last = ''; return pkRun(true); }
  if (k === 'who') { PK.who = !PK.who; pkBar(); return pkWho(); }
  if (k === 'full') { try { if (document.fullscreenElement) document.exitFullscreen(); else PK.el.requestFullscreen(); } catch { } return; }
  if (k === 'copy') {
    const text = (m.groups || []).map((g, i) => 'Group ' + (i + 1) + ': ' + g.map(pkNice).join(', ')).join('\n');
    const said = ok => { const s = PK.el && PK.el.querySelector('[data-pk="copy"]'); if (s) { s.textContent = ok ? 'Copied' : 'Could not copy'; setTimeout(() => { if (s.isConnected) s.textContent = 'Copy'; }, 1600); } };
    try { navigator.clipboard.writeText(text).then(() => said(true), () => said(false)); } catch { said(false); }
  }
}
function pkClick(e) {
  const t = e.target, m = pkMem(PK.cls);
  if (e.detail && t.closest('#pkBar button')) PK.el.focus();   // a button pressed with the mouse gives the keys back, so Space still picks again
  const w = t.closest('[data-pkw]');
  if (w) { const n = PK.cls.names[+w.dataset.pkw]; if (m.away.has(n)) m.away.delete(n); else m.away.add(n); m.groups = null; w.setAttribute('aria-pressed', String(!m.away.has(n))); pkBar(); if (PK.mode === 'groups') pkRun(true); return; }
  const by = t.closest('[data-pkby]'); if (by) { m.by = by.dataset.pkby; return pkRun(true); }
  const n = t.closest('[data-pkn]'); if (n) { m.n = +n.dataset.pkn; return pkRun(true); }
  const b = t.closest('[data-pk]'); if (b) return pkDo(b.dataset.pk);
}
// The keys while this is open. True when the key was taken.
function pkKey(e) {
  if (!PK.on || e.metaKey || e.ctrlKey || e.altKey) return false;
  const k = e.key, c = k.toLowerCase(), m = pkMem(PK.cls);
  if (k === 'Tab') return false;
  if (e.target && e.target.id === 'pkClass' && k !== 'Escape') return false;
  if ((k === ' ' || k === 'Enter') && e.target && e.target.closest && e.target.closest('#pkStage button')) return false;   // the button in hand does its own thing
  e.preventDefault();
  if (k === 'Escape') { if (PK.who) pkDo('who'); else pkClose(); return true; }
  if (k === ' ' || k === 'Enter') pkDo('again');
  else if (c === 'p') pkDo('pick');
  else if (c === 'g') pkDo('groups');
  else if (c === 'w') pkDo('who');
  else if (c === 'f' && PK.o.full) pkDo('full');
  else if (PK.mode === 'groups' && /^[2-8]$/.test(k)) { m.n = +k; pkRun(true); }
  return true;
}
function pkKeyOwn(e) { if (!PK.on) return; e.stopPropagation(); pkKey(e); }
window.__pick = { PK, open: pkOpen, close: pkClose, groups: pkGroups, count: pkCount, short: pkShort, nice: pkNice, rolls: pkRolls };
