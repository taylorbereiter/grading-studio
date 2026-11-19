// The Settings page's own lines (next/lang/settings.en.json), the ones only that page shows. They load with it, not with every
// page, so the first load stays small.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/settings.en.json';
addLines(LINES, 'settings');
