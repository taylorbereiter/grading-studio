// The lines of a video from Google Drive on the marking screen (next/lang/video.en.json): kept apart from setup.en.json so that
// Settings, which loads those, doesn't carry these too.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/video.en.json';
addLines(LINES, 'video');
