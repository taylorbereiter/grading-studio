// The lines of Insights' Percents and the summary's charts (next/lang/pct.en.json, mark/percents.jsx): kept apart from paper.en.json
// and setup.en.json so that Grades, Insights and Return, which load those, don't carry these too.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/pct.en.json';
addLines(LINES, 'pct');
