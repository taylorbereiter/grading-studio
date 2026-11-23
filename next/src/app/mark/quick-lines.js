// The lines of Quick mark, its boxes, a quiz made here and reading its scan (next/lang/quick.en.json): kept apart from
// paper.en.json so that Grades, Insights and Return, which load those, don't carry these too.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/quick.en.json';
addLines(LINES, 'quick');
