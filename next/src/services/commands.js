// The command bar's list (Ctrl/Cmd+K). Screens add their own commands and take them away when they close.
// { id, label: a translated line, group: a translated heading, icon, keys: 'mod+…' shown beside it, run, when }
const all = new Map(), told = new Set();
export function addCommand(c) { all.set(c.id, c); told.forEach(f => f()); return () => { all.delete(c.id); told.forEach(f => f()); }; }
export function onCommandsChange(f) { told.add(f); return () => told.delete(f); }
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Every word typed must start a word of the label (or of its extra words); labels that start with the first word come first.
export function findCommands(q) {
  const words = fold(q).split(/\s+/).filter(Boolean), out = [];
  for (const c of all.values()) {
    if (c.when && !c.when()) continue;
    const label = typeof c.label === 'function' ? c.label() : c.label, hay = fold(label + ' ' + (c.also || '')), starts = hay.split(/[\s/,.-]+/);
    if (!words.every(w => starts.some(s => s.startsWith(w)) || hay.includes(w))) continue;
    out.push({ ...c, label, score: words.length && fold(label).startsWith(words[0]) ? 0 : 1 });
  }
  return out.sort((a, b) => a.score - b.score || String(a.group).localeCompare(String(b.group)));
}
let opener = null;
export const setCommandOpener = f => { opener = f; };
export const openCommandBar = () => opener && opener();
// Commands too many to load with the page (every Help answer): each loader runs once, the first time the bar opens.
const loaders = [];
export const loadWhenOpened = f => { loaders.push(f); };
export function commandsOpened() { while (loaders.length) { try { loaders.shift()(); } catch (e) { console.error(e); } } }
