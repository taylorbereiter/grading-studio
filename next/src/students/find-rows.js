// The assignments for the command bar (src/shell.js findRows "Assignments"): each one in a class's units with a download kept for it,
// with its class and unit, read from the library. Loaded by app/help/find.js through router.js PARTS.asgRows when the bar opens.
import { library } from './index.js';

export function assignmentRows() {
  const lib = library.json(null) || {}, out = [];
  for (const c of [...(lib.classes || []), lib.loose].filter(Boolean)) for (const u of c.units || []) for (const it of u.items || [])
    if (it.batchId) out.push({ id: String(it.batchId), name: String(it.name || ''), cls: c === lib.loose ? '' : String(c.name || ''), unit: String(u.name || '') });
  return out;
}
