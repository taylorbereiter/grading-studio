// The Planner's timetable read one way for linked classes (src/linked.js lkPlanLoad): each class's name and the course the Planner
// gives it, nothing else. The grading side may read the planning side.
import { setupRecord } from '../planning/index.js';

export async function planCourses() {
  let s = null; try { s = await setupRecord.get(); } catch {}
  return (s && Array.isArray(s.classes) ? s.classes : []).filter(c => c && c.name && c.course).map(c => ({ name: String(c.name), course: String(c.course).trim() }));
}
