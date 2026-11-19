// The assignments for the command bar (src/shell.js findRows "Assignments"): each one in a class's units with a download kept for it,
// with its class and unit, read from the library. Loaded by app/help/find.js through router.js PARTS.asgRows when the bar opens.
import { library } from './index.js';
import { readKept, canOpen } from './counts.js';

export function assignmentRows() {
  const lib = library.json(null) || {}, out = [];
  for (const c of [...(lib.classes || []), lib.loose].filter(Boolean)) for (const u of c.units || []) for (const it of u.items || [])
    if (it.batchId) out.push({ id: String(it.batchId), name: String(it.name || ''), cls: c === lib.loose ? '' : String(c.name || ''), unit: String(u.name || '') });
  return out;
}
// Downloads kept in this browser that no card holds (src/shell.js findRows, "Kept in this browser"), each one that can still open.
export async function keptRows() {
  const lib = library.json(null) || {}, carded = new Set();
  for (const c of [...(lib.classes || []), lib.loose].filter(Boolean)) for (const u of c.units || []) for (const it of u.items || []) if (it.batchId) carded.add(String(it.batchId));
  const out = [];
  for (const [id, m] of await readKept()) if (m && !carded.has(String(id)) && canOpen(m)) out.push({ id: String(id), name: String(m.name || '') });
  return out;
}
