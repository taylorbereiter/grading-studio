// School resources (src/school.js): links, files and notes about the school, and the people a teacher works with. Nothing here is
// about a student. Kept where the current app keeps them, so both apps read one list:
//   gs.school                      { items, order, ot, people?, roles? } (the shape is in src/school.js)
//   grading-studio-school/files    each file's bytes by their SHA-256, made only when the first file is added
// Every change reads the list as stored now (another tab may have changed it a moment ago), changes it, and writes it back as one
// step Undo takes back (services/undo.js).
import { school, schoolFiles } from './index.js';
import { savePref, saveSchoolFile } from './write.js';
import { record } from '../services/undo.js';
import { patch, apply } from '../shared/patch.js';

export const SCH_MAX = 50 * 1024 * 1024, SCH_DAYS = 14;
// The spots for people a school usually has, as the current app names them (src/school.js SCH_ROLES): stored words, so they stay
// as written whatever the app's language; each teacher changes the list for their own school.
export const SCH_ROLES = ['Principal', 'Vice principal', 'Subject group coordinator / department head', 'Curriculum coordinator', 'Dean of academic affairs'];

export function schoolNow() {
  const v = school.json(null) || {};
  const out = { items: Array.isArray(v.items) ? v.items.filter(i => i && i.id) : [], order: Array.isArray(v.order) ? v.order.map(String) : [], ot: v.ot || 0 };
  if (Array.isArray(v.people)) out.people = v.people.filter(p => p && p.id);
  if (v.roles && Array.isArray(v.roles.list)) out.roles = { list: v.roles.list.map(String).filter(Boolean), at: v.roles.at || 0 };
  return out;
}
const put = v => savePref('gs.school', v);
// label: the step's name for Undo. fn changes the list in place.
// Undo takes back only what this step changed, on the list as it is then: people added from My setup or another window since stay (audit H-021).
export function schoolChange(label, fn) {
  const before = schoolNow(), s = schoolNow(); fn(s);
  const r = put(s), after = schoolNow();
  if (JSON.stringify(before) === JSON.stringify(after)) return r;
  const back = patch(after, before), fwd = patch(before, after), redo = ops => { const now = schoolNow(); apply(now, ops); return put(now); };
  record({ label, undo: () => redo(back), redo: () => redo(fwd) });
  return r;
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const live = s => (s || schoolNow()).items.filter(i => !i.gone);
export const kindOf = i => (i.kind === 'file' && i.file ? 'file' : i.kind === 'link' && i.url ? 'link' : 'note');
// What was typed as a web address, tidied, or '' when it isn't one. Only http and https.
export function webAddress(t) {
  let s = String(t || '').trim(); if (!s || /\s/.test(s)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) { if (!/\.[a-z]{2,}/i.test(s)) return ''; s = 'https://' + s; }
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname ? u.href : ''; } catch { return ''; }
}
export const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const norm = n => String(n || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const clsOf = i => (Array.isArray(i.cls) ? i.cls : []).map(String).filter(Boolean);
export const ext = n => { const m = /\.([a-z0-9]{1,6})$/i.exec(n || ''); return m ? m[1].toUpperCase() : ''; };
// The groups in the teacher's order: theirs first, then any others by name, then what has no group ('').
export function groupsOf(s, items) {
  const names = [...new Set(items.map(i => i.group || '').filter(Boolean))], at = n => { const i = s.order.indexOf(n); return i < 0 ? 1e9 : i; };
  names.sort((a, b) => at(a) - at(b) || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return items.some(i => !i.group) ? [...names, ''] : names;
}
export const sorted = list => [...list].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' }));
// The classes a resource can be for: the timetable's courses (two sections of one course are one choice), each once.
export function classChoices(plan) {
  const seen = new Set();
  return ((plan && plan.setup && plan.setup.classes) || []).map(c => String((c && (c.course || c.name)) || '').trim()).filter(n => { const k = norm(n); return k && !seen.has(k) && seen.add(k); });
}
// The classes that have something, in the timetable's order, then any the timetable no longer has.
export function classesUsed(items, choices) {
  const by = new Map(); for (const i of items) for (const n of clsOf(i)) if (!by.has(norm(n))) by.set(norm(n), n);
  const out = choices.filter(n => by.has(norm(n))), have = new Set(out.map(norm));
  for (const [k, n] of by) if (!have.has(k)) out.push(n);
  return out;
}

/* people */
export const people = s => ((s || schoolNow()).people || []).filter(p => !p.gone && p.name);
export const roles = s => { const r = (s || schoolNow()).roles; return r ? r.list : SCH_ROLES; };
export const roleKey = r => String(r || '').toLowerCase().replace(/\s+/g, ' ').trim();
// Loose on purpose: something@somewhere.something.
export const mailOk = t => { t = String(t || '').trim().replace(/^mailto:/i, ''); return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(t) && t.length <= 120 ? t : ''; };

/* the bytes */
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
export const shaOf = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
// A file just chosen: its bytes kept by their hash (once), and the record the list holds for it.
export async function keepFile(f) {
  const data = new Uint8Array(await f.arrayBuffer()), hash = await shaOf(data);
  if (!(await schoolFiles.get(hash).catch(() => null))) await saveSchoolFile(hash, data);
  return { hash, size: data.length, type: f.type || '', name: f.name };
}
export async function fileBytes(hash) { const r = await schoolFiles.get(hash).catch(() => null); return r && r.data ? r.data : null; }
export async function filesHere() { try { return new Set(await schoolFiles.keys()); } catch { return new Set(); } }
