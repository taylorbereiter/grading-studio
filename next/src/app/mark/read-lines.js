// The lines of Readings and Transcripts (next/lang/reading.en.json, mark/readings.jsx and mark/transcripts.jsx): kept apart from
// paper.en.json so that Grades, Insights and Return, which load those, don't carry these too.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/reading.en.json';
addLines(LINES, 'reading');
