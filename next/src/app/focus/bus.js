// The focus timer from anywhere (src/focus.js): the session runner with its panel (run.js) loads a moment after the first screen is
// drawn, or at once when something starts a session or opens the panel. Screens that show the timer hear of each change here.
// Tiny on purpose: the shell imports it, so it is in the first load; the runner and its engine are not.
import { PARTS } from '../router.js';

const told = new Set();
let run = null;
export const onFocus = f => { told.add(f); return () => told.delete(f); };
export const focusChanged = () => told.forEach(f => { try { f(); } catch (e) { console.error(e); } });
export const runner = () => (run ||= PARTS.focus().then(m => { m.boot(); return m; }));
// key: 'mark:<download>', 'td:<to-do>', 'les:<lesson>' or '' (the timer only); len in minutes; one: 1 or 3 papers, else 0.
export const startFocus = (key, len, one) => runner().then(m => m.start(key, len, one));
export const openFocus = () => runner().then(m => m.open());
