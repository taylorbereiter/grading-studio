// The teacher's AI assistant: its name and where it opens. One place, so no part ever types an assistant's name. Reads gs.words,
// the copy of the teacher's own words both pages of the current app keep (src/app/library.js writes it, src/beside.js reads it).
// Read only. An empty name means none is named: parts then use the generic lines (assistant.generic, assistant.generic_start).
import { json } from '../shared/ls.js';

// The assistants the app knows an address for. Data, not words on screen: a name here is only ever shown because the teacher chose it.
export const KNOWN = [['Gemini', 'https://gemini.google.com/app'], ['Claude', 'https://claude.ai/new'], ['ChatGPT', 'https://chatgpt.com/'], ['Copilot', 'https://copilot.microsoft.com/']];
const usual = name => { const a = KNOWN.find(x => x[0].toLowerCase() === String(name || '').trim().toLowerCase()); return a ? a[1] : ''; };
function clean(v) {
  const s = String(v == null ? '' : v).trim().slice(0, 400); if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
// Words saved before the assistant was asked about say nothing of it; that teacher had the second known assistant's words,
// as the current app's Planner assumes (src/planner/lessons.js plWords).
export function assistant() {
  const w = json('gs.words');
  const o = w && typeof w === 'object' ? w : {};
  const name = String(o.ai == null ? (o.scale12 ? KNOWN[1][0] : '') : o.ai).trim().slice(0, 30);
  return { name, link: name ? clean(o.link) || usual(name) : '', tab: !!o.tab, known: !!usual(name) };
}
