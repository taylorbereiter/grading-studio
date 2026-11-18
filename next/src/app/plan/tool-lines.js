// The lines of the planning tools that load on their own (the editor, Present, the lesson's tools and the Beside drawer:
// next/lang/tools.en.json), so the lesson page itself stays small. Every file that uses a tool.* line imports this.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/tools.en.json';
addLines(LINES);
