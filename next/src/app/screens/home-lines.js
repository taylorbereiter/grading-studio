// Home's own lines (next/lang/home.en.json). They load with the Home screen, not with every page, so the first load stays small.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/home.en.json';
addLines(LINES);
