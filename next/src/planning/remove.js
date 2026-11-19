// The planning side's part of Remove from this computer (whole/remove.js), loaded only when she asks for it. Checked as every
// write in planning/write.js is.
import { writeMany, openExisting } from '../shared/idb.js';
import { mayWrite } from '../shared/lock.js';
import { check } from './write.js';
// Remove from this computer (src/takehome.js removeHere, schRemoveAll): the School page's files, and the focus session going on
// (it names the work). Lessons, units and the timetable stay.
export async function dropSchoolFilesAndFocus() {
  check('grading-studio-school');
  const d = await openExisting('grading-studio-school');
  if (d) { const has = d.objectStoreNames.contains('files'); d.close(); if (has) await writeMany('grading-studio-school', ['files'], o => o.files.clear()); }
  for (const k of ['gsp.focusRun', 'gsp.focusQ', 'gsp.focusGo']) { try { mayWrite('localStorage:' + k); localStorage.removeItem(k); } catch (e) { if (e && e.name === 'ReadOnly') throw e; } }
}
