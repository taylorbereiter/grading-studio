// The teacher's mail app (src/mail.js gs.mailApp): Gmail unless she chose Outlook on the web or the computer's own app. It is a
// Planner-side setting (shared/keys.js), so the grading side reads and saves it here, through the Planner's own savePref.
import { mailApp } from '../planning/index.js';
import { savePref } from '../planning/write.js';

export const MAIL_APPS = ['gmail', 'outlook', 'app'];
export function mailGet() { try { const v = mailApp.json('gmail'); return MAIL_APPS.includes(v) ? v : 'gmail'; } catch { return 'gmail'; } }
export function mailSet(v) { savePref('gs.mailApp', v === 'gmail' || !MAIL_APPS.includes(v) ? undefined : v); }
