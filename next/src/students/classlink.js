// A class's link to its page in the school's system (src/app/screens.js mbOf), on its own so a screen can read it without the
// gradebook (students/book.js re-exports it): kept on the class (c.mb) and, by the class's name, in gs.mblinks, which the Planner
// reads too. Read: the class's own, else the one remembered for its name.
import { manageBacLinks } from '../planning/index.js';

export const MB_NORM = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const linkUrl = v => { v = String(v || '').trim(); if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) v = 'https://' + v; return /^https?:\/\/[^\s"<>]+$/i.test(v) ? v : ''; };
export function classLink(c) { if (!c) return ''; const m = manageBacLinks.json(null) || {}; return linkUrl(c.mb) || linkUrl(m[MB_NORM(c.name)]) || ''; }
