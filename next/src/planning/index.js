// The Planner side's saved work: lessons, units, the bank, the timetable and the Planner's settings. Nothing here may import
// students/ (next/test/wall.test.js). What planning needs from the grading side comes through crossings.js, read-only.
import { idbStore, localKey } from '../shared/records.js';
const P = 'planning';

export const lessons = idbStore(P, 'gs-lessons', 'lessons');   // keyed by each lesson's own id: put(lesson)
export const kv = idbStore(P, 'gs-lessons', 'kv');
// The kv records by name.
const kvKey = k => ({ get: () => kv.get(k), put: v => kv.put(v, k) });
export const units = kvKey('units');
export const bank = kvKey('bank');
export const bankFiles = kvKey('bankFiles');
export const activities = kvKey('activities');
export const plannerWords = kvKey('words');
export const lessonLook = kvKey('deflook');
// setup is the timetable and the classes (no student names). The grading page writes it too: a crossing (next/docs/saved-work.md).
export const setupRecord = kvKey('setup');
export const schoolFiles = idbStore(P, 'grading-studio-school', 'files');

export const school = localKey(P, 'gs.school');
export const manageBacLinks = localKey(P, 'gs.mblinks');
export const taughtIn = localKey(P, 'gsp.taughtIn');
export const planTime = localKey(P, 'gsp.planTime');
export const newYear = localKey(P, 'gsp.newYear');
