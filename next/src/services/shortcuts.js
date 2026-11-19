// Every keyboard shortcut in one list. A screen registers its own; the shortcut list in Help is made from the same list, so it
// can never fall behind. keys: 'mod+k' (Ctrl, or Cmd on a Mac), 'shift+?', 'j', 'arrowright'… label: the key of a line in en.json.
// group: the key of the heading it is listed under. A shortcut is not run while typing in a box unless inInputs is set.
const all = new Map(), told = new Set();
export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
export function register(s) {
  if (!s.id || !s.keys || !s.label || !s.run) throw new Error('A shortcut needs id, keys, label and run');
  all.set(s.id, { group: 'keys.group_general', ...s, keys: [].concat(s.keys).map(norm) });
  told.forEach(f => f()); return () => { all.delete(s.id); told.forEach(f => f()); };
}
// Every shortcut as registered, for the command bar (app/help/find.js lists the ones that can run now).
export const shortcuts = () => [...all.values()];
export function onShortcutsChange(f) { told.add(f); return () => told.delete(f); }
function norm(k) { const p = String(k).toLowerCase().split('+'), key = p.pop(); return [...['mod', 'ctrl', 'alt', 'shift'].filter(m => p.includes(m)), key].join('+'); }
export function comboOf(e) {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  const mods = []; if (e.metaKey || (e.ctrlKey && !isMac())) mods.push('mod'); else if (e.ctrlKey) mods.push('ctrl');
  if (e.altKey) mods.push('alt'); if (e.shiftKey && k.length > 1) mods.push('shift');
  return [...mods, k].join('+');
}
const typing = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
export function handle(e) {
  if (e.defaultPrevented || e.isComposing) return false;
  const c = comboOf(e);
  for (const s of all.values()) {
    if (!s.keys.includes(c)) continue;
    if (typing(e.target) && !s.inInputs) continue;
    if (s.when && !s.when()) continue;
    e.preventDefault(); s.run(e); return true;
  }
  return false;
}
let on = false;
export function start() { if (!on) { on = true; window.addEventListener('keydown', handle); } }
// The list for Help: [{ group, items: [{ id, label, keys: [['Ctrl','K']] }] }], keys as the pieces to draw, already for this computer.
const NAMES = { mod: () => (isMac() ? '⌘' : 'Ctrl'), ctrl: () => 'Ctrl', alt: () => (isMac() ? '⌥' : 'Alt'), shift: () => '⇧', arrowright: () => '→', arrowleft: () => '←', arrowup: () => '↑', arrowdown: () => '↓', escape: () => 'Esc', enter: () => '↵', ' ': () => '␣' };   // not-words
export const pieces = combo => combo.split('+').map(p => (NAMES[p] ? NAMES[p]() : p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)));
export function list() {
  const g = new Map();
  for (const s of all.values()) { if (s.hidden) continue; if (!g.has(s.group)) g.set(s.group, []); g.get(s.group).push({ id: s.id, label: s.label, keys: s.keys.map(pieces) }); }
  return [...g].map(([group, items]) => ({ group, items }));
}
