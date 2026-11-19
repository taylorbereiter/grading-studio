// localStorage the way the new app may touch the current app's keys. Text goes in and out exactly as the current app wrote it;
// json() and setJson() read and write it the way the current app does (JSON.parse, JSON.stringify), so a value read and written
// back is the same text. While the sample is open, the page's sample lines (src/samplemode.js, put in front of every page of the
// new app too) give every key its sample name, as they do for the current app. No DOM is used here.
import { mayWrite } from './lock.js';

export const textStrict = k => localStorage.getItem(k);
export const text = k => { try { return textStrict(k); } catch { return null; } };
export function json(k, fallback = null) {
  const t = text(k); if (t == null) return fallback;
  try { return JSON.parse(t); } catch { return fallback; }
}
export function setText(k, v) {
  mayWrite('localStorage:' + k);
  localStorage.setItem(k, v);   // a full store throws: the caller decides, as the current app's lsPut does
}
export const setJson = (k, v) => setText(k, JSON.stringify(v));
export function remove(k) { mayWrite('localStorage:' + k); localStorage.removeItem(k); }
export function allKeys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k != null) out.push(k); } } catch {} return out.sort(); }
export const keysStarting = pre => allKeys().filter(k => k.startsWith(pre));
