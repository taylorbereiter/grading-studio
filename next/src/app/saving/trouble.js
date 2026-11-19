// Work that didn't save (src/saving.js saveBad, saveBar, saveRetry): the marking screen tells this file after each save of a
// download's work. While anything is here the red bar shows on every screen (saving/bar.jsx, loaded only then), saving is tried
// again every 20 seconds and by Try again, and leaving the page asks first. And what must be saved before this window reloads
// (an update): the screens register a flush, and nothing reloads while work isn't saved.
const bad = new Map(), told = new Set(), flushes = new Set();
const RETRY = 20000;
let timer = null, wasBad = false;
const tell = () => told.forEach(f => { try { f(); } catch (e) { console.error(e); } });
// id: the download; retry(): saves it again (resolves when tried); quick: whether the small quick copy at least has it.
export function saveFailed(id, retry, quick) { bad.set(id, { retry, quick: !!quick }); wasBad = true; plan(); tell(); }
export function saveWorked(id) { if (!bad.delete(id)) return; if (!bad.size) { clearTimeout(timer); timer = null; } tell(); }
export const troubles = () => [...bad.entries()].map(([id, v]) => ({ id, quick: v.quick }));
export const onTrouble = f => { told.add(f); return () => told.delete(f); };
// Was there trouble that is over now (for "Saved. Your work is safe again.")? Asked once.
export const recovered = () => { if (bad.size || !wasBad) return false; wasBad = false; return true; };
function plan() { clearTimeout(timer); timer = bad.size ? setTimeout(retryAll, RETRY) : null; }
export async function retryAll() { for (const [, v] of [...bad]) { try { await v.retry(); } catch (e) { console.error(e); } } if (bad.size) plan(); }
// A screen's "save what is waiting now": run before this window reloads.
export const addFlush = f => { flushes.add(f); return () => flushes.delete(f); };
// Saves everything waiting; true when nothing is left unsaved, so the window may reload.
export async function saveBeforeReload() { for (const f of [...flushes]) { try { await f(); } catch (e) { console.error(e); } } return !bad.size; }
if (typeof window !== 'undefined') window.addEventListener('beforeunload', e => { if (bad.size) { e.preventDefault(); e.returnValue = ''; } });
