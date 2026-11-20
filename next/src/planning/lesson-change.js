import { changePlannerRecord } from './change.js';
import { finishLessonSave, finishKvSave } from './write.js';

// onCommitted runs after the local transaction completes, before the linked folder is checked.
export async function changeLesson(id, edit, onCommitted) {
  const lesson = await changePlannerRecord('lessons', id, current => {
    if (!current) return;
    const next = edit(current);
    if (next) next.updated = Math.max(Date.now(), (current.updated || 0) + 1);
    return next;
  });
  if (lesson) {
    onCommitted?.();
    await finishLessonSave(lesson, true);
  }
  return lesson;
}

export async function changeNotebookUnits(edit) {
  let before;
  const units = await changePlannerRecord('kv', 'units', current => {
    if (!Array.isArray(current)) return;
    before = current;
    return edit(current);
  });
  if (!units) return;
  await finishKvSave('units', units, before, true);
}
