/* ---------------- units, assignments and rosters (kept in this browser only) ---------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const fresh = store.get('gs.lib', null) == null;
// Each class holds its roster and its own units; each unit holds assignment cards. Assignments with no class sit in
// lib.loose. (Before 10/29 units were shared by every class; migrateLib moves each card into its class's unit of the same name.)
function migrateLib(l) {
  l.classes ||= []; for (const c of l.classes) { c.units ||= []; c.names ||= []; }
  l.loose ||= { id: '', units: [] };
  for (const u of l.units || []) for (const it of u.items || []) {
    const c = l.classes.find(k => k.id === it.classId) || l.loose;
    let cu = c.units.find(x => x.name === u.name); if (!cu) c.units.push(cu = { id: uid(), name: u.name, items: [] });
    cu.items.push(it);
  }
  l.units = [];
  return l;
}
let lib = migrateLib(store.get('gs.lib', null) || { classes: [] });
// Taylor's 2026-27 classes are there from the start (empty until she adds a roster); added once, so deleting one sticks.
if (!lib.seed2627) {
  for (const n of ['12EL-1', '12EL-2', '11EL-2']) if (!lib.classes.some(c => c.name.replace(/\s+/g, '').toLowerCase() === n.toLowerCase())) lib.classes.push({ id: uid(), name: n, names: [], units: [] });
  lib.seed2627 = true; store.set('gs.lib', lib);
  // A brand-new browser's starter list never wins over units and rosters already synced from another computer.
  if (fresh) { const t = syncTimes(); t['gs.lib'] = 1; try { localStorage.setItem('gs.syncT', JSON.stringify(t)); } catch {} }
}
function saveLib() { libVer++; if (!store.set('gs.lib', lib)) toast('This browser is out of room to keep your units and rosters.'); }
const holders = () => lib.classes.concat([lib.loose]);
const holderById = id => id ? lib.classes.find(c => c.id === id) || null : lib.loose;
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
const findUnit = id => { for (const c of holders()) { const u = c.units.find(x => x.id === id); if (u) return { c, u }; } return null; };
const classById = id => lib.classes.find(c => c.id === id);
// The same words as the Grades list's own summary.
const keptMore = m => (m.partial ? ' · ' + m.partial + ' partial' : '') + (m.off ? ' · ' + m.off + ' missing or excused' : '');
function batchSummary(it) {
  if (!it.batchId) return 'No download opened yet';
  const data = store.get(it.batchId, null);
  const d = new Date(it.opened || (data && data.t) || Date.now());
  let n = 0;
  if (data) for (const k in data.s) { const g = data.s[k].g; if (g && (g.rubric.some(v => v != null) || g.points !== '')) n++; }
  const m = keptMeta.get(it.batchId);
  if (m) return 'Last worked on ' + fmtDay(m.t) + ' · ' + (m.scored || 0) + ' of ' + (m.n - (m.off || 0)) + ' scored' + keptMore(m) + (m.papers ? '' : ' · drop the same ZIP to keep going');
  return 'Opened ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (data ? ' · ' + n + ' scored' : '') + ' · drop the same ZIP to keep going';
}
