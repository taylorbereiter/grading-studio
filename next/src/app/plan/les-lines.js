// The lesson screen's later parts' own lines (next/lang/lesson.en.json): the editor's second part, the lesson's side parts and
// Beside's additions from stage 8. They load with those parts only, so the full lesson chunks stay inside the route budget.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/lesson.en.json';
addLines(LINES, 'lesson');
