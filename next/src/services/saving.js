// Where the screens reach saving and sync (Google Drive, the linked folder, the take-home and year files). Those live in whole/,
// which only main.js may load (next/test/wall.test.js); main.js hands their controls here once they are started, and a screen
// asks for them by name. Before that (or in a test page without them) a screen gets null and shows nothing for them.
import { useEffect, useState } from 'preact/hooks';

let api = null;
const told = new Set();
export function provideSaving(a) { api = a; told.forEach(f => f()); }
export const saving = () => api;
// Draws again when the controls arrive or say something changed (the Google line's state, a sync finished).
export function changedSaving() { told.forEach(f => f()); }
export function useSaving() {
  const [, again] = useState(0);
  useEffect(() => { const f = () => again(n => n + 1); told.add(f); return () => told.delete(f); }, []);
  return api;
}
