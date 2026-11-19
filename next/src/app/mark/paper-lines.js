// The lines of the marking screen's tools that load on their own when asked for (next/lang/paper.en.json): the calculator and the
// screenshot. They are kept apart from setup.en.json so that Settings, which loads those, doesn't carry these too.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/paper.en.json';
addLines(LINES, 'paper');
