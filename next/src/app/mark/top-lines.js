// The lines of the marking screen's top bar and full screen (next/lang/top.en.json, mark/topbar.jsx), and a few of its later parts' (the
// Marks only warning in mark/share.jsx): kept apart from mark.en.json and paper.en.json so that Grades, Insights and Return don't carry them.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/top.en.json';
addLines(LINES, 'top');
