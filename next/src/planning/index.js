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
// The focus timer's own: the session going on (shared with the current app's pages and its Planner), sessions that ended in the
// Planner, "Next paper" pressed there, and the settings the Planner reads for counting time.
export const focusRun = localKey(P, 'gsp.focusRun');
export const focusQueue = localKey(P, 'gsp.focusQ');
export const focusGo = localKey(P, 'gsp.focusGo');
export const timeCount = localKey(P, 'gsp.timeCount');
export const newYear = localKey(P, 'gsp.newYear');

// Teacher-wide settings with no student content (stage 2 put them on this side, whichever page writes them).
export const words = localKey(P, 'gs.words');   // the teacher's own words: assistant name and link, terms
export const look = localKey(P, 'gs.look');
export const theme = localKey(P, 'gs.theme');
export const language = localKey(P, 'gs.lang');
export const mailApp = localKey(P, 'gs.mailApp');
export const planCopy = localKey(P, 'gs.planCopy');   // the timetable sent along with the rest of the work, for a phone
export const googleEmail = localKey(P, 'gs.gEmail');
export const googleClientId = localKey(P, 'gs.gcid');
export const googleAuto = localKey(P, 'gs.gAuto');
export const drivePaperDir = localKey(P, 'gs.gPaperDir');
export const driveVideoDir = localKey(P, 'gs.gVidDir');
export const planSeen = localKey(P, 'gs.planSeen');
export const planBig = localKey(P, 'gs.planBig');
// After-class notes (gsp.taughtIn) are free text: a teacher may put a student's name in one. They stay where they are, but they
// MAY HOLD NAMES, so nothing sends them to an assistant unless the teacher puts them in herself.
export const taughtInMayHoldNames = true;
