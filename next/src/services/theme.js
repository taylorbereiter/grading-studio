// The teacher's theme (look). Saved as gs.look through the planning side's write (planning/write.js savePref, which asks the lock first). With nothing saved
// yet, a teacher who chose dark in the current app (gs.theme) gets Midnight and everyone else Graphite; that is only read, never
// written back. The current app's gs.theme is left alone. Never follows the computer's light or dark setting.
import { json } from '../shared/ls.js';
import { savePref } from '../planning/write.js';
import { LOOKS, DEFAULT_LOOK } from '../ui/looks.js';

const listeners = new Set();
export const looks = () => LOOKS.slice();
export function savedLook() {
  const v = json('gs.look');
  if (LOOKS.includes(v)) return v;
  return json('gs.theme') === 'dark' ? 'midnight' : DEFAULT_LOOK;
}
export const currentLook = () => document.documentElement.dataset.look || savedLook();
// Show a theme in this window without saving it (the gallery's preview, or a window that may not save).
export function applyLook(look) {
  if (!LOOKS.includes(look)) look = DEFAULT_LOOK;
  document.documentElement.dataset.look = look;
  listeners.forEach(f => f(look));
  return look;
}
// Save the teacher's choice and show it. Returns false when this window may not save (another window has the lock): the theme is
// still shown here for now, and the caller tells the teacher it was not kept.
export function saveLook(look) {
  applyLook(look);
  try { savePref('gs.look', look); return true; } catch { return false; }
}
export function onLook(f) { listeners.add(f); return () => listeners.delete(f); }
