// The grading engines' "store" and their way into the papers (the current app's get/set over localStorage, src/app/start.js, and
// kdo/kget/idbDo over its databases, src/app/kept.js). Here each goes through whatever the screen hands in with useStore(): the
// students side's own (students/prefs.js), which knows only registered keys, writes only a screen setting with the lock, and only
// reads the databases. Before that they read nothing and write nothing. Engines hold no data of their own (next/docs/parts/wall.md).
let back = { get: (k, d) => d, set: () => false, del: () => {}, kdo: async () => undefined, idbDo: async () => undefined };
export const store = { get: (k, d) => back.get(k, d), set: (k, v) => back.set(k, v), del: k => back.del(k) };
export const kdo = (name, mode, fn) => back.kdo(name, mode, fn);
export const kget = (name, k) => kdo(name, 'readonly', o => o.get(k)).catch(() => null);
export const idbDo = (mode, fn) => back.idbDo(mode, fn);
export function useStore(b) { back = b; }
