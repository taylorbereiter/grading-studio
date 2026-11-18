// The sync is due: a save through the layer marks it (src/app/drive.js syncSoon). Kept apart from sync.js, which builds the file
// and loads only when one is sent.
let due = false;
const told = new Set();
export const syncDue = () => due;
export function markSyncDue() { if (!due) { due = true; told.forEach(f => f(true)); } }
export function onSyncDue(f) { told.add(f); return () => told.delete(f); }
