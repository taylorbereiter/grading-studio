// The saved-work proof's page (next/proof.html). Not part of the app: test/tools/saved-work.js opens it to read every record
// through the layer and to write every record back through the typed accessors. It may import both sides, like crossings.js.
import * as students from './students/index.js';
import * as planning from './planning/index.js';
import * as device from './shared/device.js';
import { DATABASES, LOCAL, entryFor } from './shared/keys.js';
import { dumpRaw } from './shared/dump.js';
import * as ls from './shared/ls.js';
import { start, stop, lockState, takeOver } from './shared/lock.js';
import * as crossings from './crossings.js';
import * as studentWrites from './students/write.js';
import * as planningWrites from './planning/write.js';
import * as studentUndo from './students/undo.js';
import * as undo from './services/undo.js';
import * as whole from './whole/index.js';
import { carryLs, LS_LOCAL } from './whole/folder.js';

// Every typed accessor, found by what it names.
const all = [students, planning, device].flatMap(m => Object.values(m)).filter(a => a && typeof a === 'object');
const storeAcc = (db, s) => all.find(a => a.db === db && a.store === s);
const keyAcc = k => all.find(a => a.key === k) || (() => { const f = all.find(a => a.prefix && k.startsWith(a.prefix)); return f && { setJson: v => f.setJson(k.slice(f.prefix.length), v), setText: v => f.setText(k.slice(f.prefix.length), v), json: () => f.json(k.slice(f.prefix.length)) }; })();

// Puts every record back as it was read, through the typed accessors. The teacher's work (kind "work") must have one; settings and
// window notes go through plain localStorage. JSON values are parsed and written again, as the current app does, so a value that
// would not come back as the same text shows up in the proof.
async function rewriteAll() {
  const missing = [], d = await dumpRaw();
  for (const [k, text] of Object.entries(d.ls)) {
    const e = entryFor(k, LOCAL); if (!e) continue;
    const acc = keyAcc(k);
    if (!acc) { if (e[2] === 'work') missing.push('localStorage:' + k); ls.setText(k, text); continue; }
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = undefined; }
    if (e[3] === 'json' && parsed !== undefined) acc.setJson(parsed); else acc.setText(text);
  }
  for (const [path, v] of Object.entries(d.idb)) {
    const [db, s] = path.split('/'), key = path.slice(db.length + s.length + 2);
    const acc = storeAcc(db, s); if (!acc) { missing.push(db + '/' + s); continue; }
    const real = (await acc.keys()).find(x => (typeof x === 'string' ? x : JSON.stringify(x)) === key);
    await acc.put(v, real);
  }
  return { missing: [...new Set(missing)], records: Object.keys(d.ls).length + Object.keys(d.idb).length };
}
// Every database in the registry and every store in it has a typed accessor.
const coverage = () => Object.entries(DATABASES).flatMap(([db, x]) => Object.keys(x.stores).filter(s => !storeAcc(db, s)).map(s => db + '/' + s))
  .concat(LOCAL.filter(e => e[2] === 'work' && !keyAcc(e[0].endsWith('.') ? e[0] + 'x' : e[0])).map(e => 'localStorage:' + e[0]));

whole.startWhole();
window.__next = { dumpRaw, rewriteAll, coverage, start, stop, lockState, takeOver, students, planning, crossings, write: { ...studentWrites, ...planningWrites }, studentUndo, undo, whole, carryLs, LS_LOCAL: LS_LOCAL.source };
