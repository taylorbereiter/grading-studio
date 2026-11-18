// Several windows at once, by the current app's own protocol (src/saving.js, "more than one tab"), so windows of the new app and
// of the current app, in any mix, keep each other's work. Windows share storage but not memory: each tells the others what it did
// through localStorage keys outside gs.* (so no copy of the work carries them), and looks again just before it writes.
//   gsc.saved.<id>   which window saved this download last: "<window>:<time>", then "<window>:<time>:full" once the full copy is in.
//                    A window that finds another's stamp merges (students/write.js saveWork with a holder) instead of writing over it.
//   gsc.forgot.<id>  when this download was last forgotten in this browser: a window that has it open closes it.
//   gsc.over         changes when one window replaces everything (Remove, Put back, Bring work in): the others stop writing at once,
//                    cover themselves, and reload when it ends ":done" (or after a minute).
//   gsc.finish       changes just before that: the others save what is half typed or waiting, saying gsc.saving.<window> until done.
//   gsc.dev          this browser's own id, for the merge stamps.
// What a window does when it hears one of these is the screen's: it registers with on(). No DOM is used here.
import { text } from './ls.js';

export const TAB = (() => { try { return crypto.getRandomValues(new Uint32Array(1))[0].toString(36); } catch { return Math.random().toString(36).slice(2, 8); } })();
const raw = k => text(k);
const put = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };   // window notes: never refused, never counted as work
const SAVE_WAIT = 20000, HEAR = 800, SAVING = 'gsc.saving.';

let overSeen = raw('gsc.over'), overTok = '', halted = false;
const heard = { stopped: new Set(), finish: new Set(), forgot: new Set(), saved: new Set(), library: new Set(), planning: new Set() };
const fire = (k, ...a) => { for (const f of heard[k]) try { f(...a); } catch (e) { console.error(e); } };
// f is called when another window does that: 'stopped' (this one must stop), 'finish' (save what is waiting; may return a
// promise), 'forgot' (id), 'saved' (id, stamp), 'library' (gs.lib or gs.bank changed), 'planning' (a gsp.* or Planner key changed).
export function on(kind, f) { heard[kind].add(f); return () => heard[kind].delete(f); }

// false once another window has started replacing everything: from then on this window writes nothing (src/saving.js tabLive).
export function live() {
  if (halted) return false;
  const v = raw('gsc.over');
  if (v === overSeen) return true;
  halted = true;
  fire('stopped');
  if (/:done$/.test(v || '')) reload(); else setTimeout(reload, 60000);   // that window may never finish
  return false;
}
export const stopped = () => !live();
export const onStopped = f => on('stopped', f);
let reload = () => { try { location.reload(); } catch {} };
export const onReload = f => { reload = f; };   // for tests

export function stamp(id, t) { const v = TAB + ':' + t; return put('gsc.saved.' + id, v) ? v : raw('gsc.saved.' + id); }
export const savedStamp = id => raw('gsc.saved.' + id);
// This browser's id (src/folder.js devId): made the first time it is needed.
export function devId() {
  let d = raw('gsc.dev');
  if (!d) { d = 'd' + crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 12); put('gsc.dev', d); }
  return d;
}
// Forgetting a download (src/app/kept.js forgetKept): the other windows close it.
export const forget = id => put('gsc.forgot.' + id, String(Date.now()));
export const forgotSince = (id, opened) => +(raw('gsc.forgot.' + id) || 0) > (opened || 0);

// This window is about to replace everything, so the others get a moment to finish first: long enough to hear, and then as long
// as any of them says it is still saving (src/saving.js tabsFinish).
export async function finish() {
  const others = () => Object.keys(localStorage).filter(k => k.startsWith(SAVING));
  put('gsc.finish', Date.now().toString(36) + TAB);
  await new Promise(r => setTimeout(r, HEAR));
  for (const end = Date.now() + SAVE_WAIT; others().length && Date.now() < end;) await new Promise(r => setTimeout(r, 50));
  for (const k of others()) localStorage.removeItem(k);   // a window closed partway through mustn't hold up the next time
}
// This window is about to replace everything ('go'), or has finished ('done') (src/saving.js tabsOver).
export function over(phase) {
  if (phase === 'go') overTok = Date.now().toString(36) + TAB;
  const v = overTok + ':' + phase;
  put('gsc.over', v); overSeen = v;
}
// Another window asked this one to finish: everything that is waiting is saved, saying so while it is.
async function finishUp() {
  if (!heard.finish.size) return;
  put(SAVING + TAB, '1');
  try { await Promise.all([...heard.finish].map(f => Promise.resolve().then(f).catch(e => console.error(e)))); }
  finally { try { localStorage.removeItem(SAVING + TAB); } catch {} }
}
if (typeof window !== 'undefined') window.addEventListener('storage', e => {
  if (e.storageArea && e.storageArea !== localStorage) return;
  const k = e.key;
  if (k === 'gsc.over') { if (!live() && /:done$/.test(e.newValue || '')) reload(); return; }
  if (!k || !live()) return;
  if (k === 'gsc.finish') finishUp();
  else if (k === 'gs.lib' || k === 'gs.bank' || k === 'gs.setup') fire('library', k);
  else if (k.startsWith('gsc.forgot.')) fire('forgot', k.slice(11));
  else if (k.startsWith('gsc.saved.')) fire('saved', k.slice(10), e.newValue);
  else if (k.startsWith('gsp.') || k === 'gs.school' || k === 'gs.rolls' || k === 'gs.words') fire('planning', k);
});
