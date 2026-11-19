// The lines slice D of stage 8 added (next/lang/inout.en.json): bringing work in and handing it back (the Return tab's check, its
// cards and options), kept apart from setup.en.json so that Settings, which loads those, doesn't carry these too.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/inout.en.json';
addLines(LINES, 'inout');
