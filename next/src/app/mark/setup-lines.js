// The lines of the marking screen's occasional parts (next/lang/setup.en.json): Rubric setup, the ⋯ under the score, typed notes and
// the Timer, group work, the file tools, scans, video and Word papers, Grades, Insights and Return, and bringing papers in. They load
// with those parts, not with the marking screen, which keeps only the lines it draws first (next/lang/mark.en.json).
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/setup.en.json';
addLines(LINES, 'setup');
