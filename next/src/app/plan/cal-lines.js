// The Calendar's own lines (next/lang/calendar.en.json): a lesson card's tags and menu, the class page link, the week's units and
// the date jump. They load with the Calendar and its tools, not with the lesson page.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/calendar.en.json';
addLines(LINES, 'calendar');
