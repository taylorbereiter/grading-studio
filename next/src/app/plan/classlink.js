// A class's page in the school's system, as the Planner reads it (src/planner/lessons.js mbOf): the class's own link in the
// timetable, else the one remembered for its name in gs.mblinks (which the grading side writes too).
import { manageBacLinks } from '../../planning/index.js';
const MB_NORM = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const mbUrl = v => { v = String(v || '').trim(); if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) v = 'https://' + v; return /^https?:\/\/[^\s"<>]+$/i.test(v) ? v : ''; };
export const linkKey = MB_NORM;
export function linkOf(c) { if (!c) return ''; let m = {}; try { m = manageBacLinks.json(null) || {}; } catch {} return mbUrl(c.mb) || mbUrl(m[MB_NORM(c.name)]) || ''; }
