// The editor's own lines (next/lang/edit.en.json: looks, text boxes, the text tools, editing tips), loaded with the editor.
// Every file that uses an edit.* line imports this.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/edit.en.json';
addLines(LINES, 'edit');
