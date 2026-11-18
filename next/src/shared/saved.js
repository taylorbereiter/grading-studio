// Every save through the layer says so here: { kind, id, side }. whole/ listens (the folder copy, the Drive sync, the other
// windows), so neither side has to import it. kind: 'work' (one download's marks and scores), 'library', 'setting' (a grading
// key that travels: gs.setup, gs.bank…), 'lesson', 'plan' (a gs-lessons kv record), 'pref' (a teacher-wide setting).
const told = new Set();
export function onSaved(f) { told.add(f); return () => told.delete(f); }
export function saved(e) { for (const f of told) { try { f(e); } catch (err) { console.error(err); } } }
