// The planning screens' own lines (next/lang/plan.en.json). They load with the planning screens, not with every page, so the
// shared parts stay small. Every planning file imports this before it draws; the shell keeps the few plan lines it needs in en.json.
import { addLines } from '../../i18n/t.js';
import LINES from '../../../lang/plan.en.json';
addLines(LINES, 'plan');
