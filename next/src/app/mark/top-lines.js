// The lines of the marking screen's top bar and full screen (next/lang/top.en.json, mark/topbar.jsx): kept apart from mark.en.json so
// that the marking screen's other pages (Grades, Insights, Return) don't carry them.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/top.en.json';
addLines(LINES, 'top');
