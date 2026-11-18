// What the app works out from the papers kept in this browser, the same way the current app does: where each download stands
// (src/app/screens.js keptState, keptBack), which card it belongs to (src/app/kept.js cardOfKept), whether its papers can be
// opened (src/app/drive.js canOpen), and Today's groups (src/today.js homeGroups) and the sidebar's "left to score"
// (src/shell.js classLeft). Read only; nothing is stored.
import { meta, library } from './index.js';
import { json } from '../shared/ls.js';
import * as K from '../engines/gkept.js';

// The library as saved (gs.lib), with the shape the current app gives it on load: classes with units with items, and the loose holder.
export function readLibrary() {
  const l = library.json(null) || {};
  const cls = (Array.isArray(l.classes) ? l.classes : []).filter(c => c && c.id != null).map(c => ({ ...c, names: Array.isArray(c.names) ? c.names : [], units: (Array.isArray(c.units) ? c.units : []).map(u => ({ ...u, items: Array.isArray(u && u.items) ? u.items : [] })) }));
  const loose = l.loose && typeof l.loose === 'object' ? l.loose : { id: '', units: [] };
  return { classes: cls, loose: { ...loose, id: loose.id || '', units: (Array.isArray(loose.units) ? loose.units : []).map(u => ({ ...u, items: Array.isArray(u && u.items) ? u.items : [] })) }, todo: l.todo || {}, me: l.me && typeof l.me === 'object' ? l.me : {} };
}
export async function readKept() { return new Map((await meta.entries()).map(([k, v]) => [k, v])); }

// Where each download stands, through the lifted engine (engines/gkept.js, from the current app's own functions), handed this
// library and these kept rows.
const on = (lib, kept) => K.useKept(lib, kept);
const findItem = (lib, id) => { for (const c of lib.classes.concat([lib.loose])) for (const u of c.units) { const it = u.items.find(x => x && x.id === id); if (it) return { c, u, it }; } return null; };
export function cardOf(lib, kept, id) { on(lib, kept); return K.cardOfKept(id); }
export function whereOf(lib, kept, id) { const it = cardOf(lib, kept, id), f = it && findItem(lib, it.id); return { it, cls: f && f.c !== lib.loose ? f.c : null }; }
export const backOf = m => K.keptBack(m);
export function stateOf(lib, kept, m) { on(lib, kept); const s = K.keptState(m); return { of: s.of, done: s.done, left: s.left, fm: s.fm }; }
// Its papers are here, or waiting in the teacher's Drive while she is signed in (not in the sample, and not in a frame).
export function canOpen(m) {
  if (!m) return false; if (m.papers) return true;
  const cloud = json('gs.cloudP', null) || {}, email = (() => { try { return localStorage.getItem('gs.gEmail'); } catch { return null; } })();
  const ok = /^https?:$/.test(location.protocol) && window.self === window.top && !(window.__gsSample && window.__gsSample.on);
  return !!cloud[m.id] && !!email && ok;
}
// Today's groups: to mark, ready to hand back, and earlier work.
export function groups(lib, kept) { on(lib, kept); return K.homeGroups(); }
// Papers left to score in a class: its kept downloads; formative work has no score to wait for.
export function classLeft(lib, kept, c) { on(lib, kept); return K.classLeft(c); }
// The sidebar's classes, in the current app's order: every class, then "No class" when it holds anything.
export function sidebarClasses(lib, kept) {
  const out = lib.classes.map(c => ({ id: String(c.id), name: String(c.name || ''), left: classLeft(lib, kept, c), students: c.names.length, linked: c.link || c.linked || null }));
  if (lib.loose.units.some(u => u.items.length)) out.push({ id: '', loose: true, name: '', left: classLeft(lib, kept, lib.loose), students: 0 });
  return out;
}
// The teacher's choices about the app's own to-do lines: kinds switched off, lines hidden (src/todo.js tdData).
export function todoChoices(lib) { const t = lib.todo || {}; return { off: t.off || {}, auto: t.auto || {} }; }
