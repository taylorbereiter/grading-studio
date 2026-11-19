// The previous version's addresses, for bookmarks, the browser's history and the installed app's: each lands on the matching screen
// of the new app. Never in the first load: the "not built" screen (screens/later.jsx) loads it for an address the router does not
// know, and the class and Settings screens for a tab or group of the previous version's that the router takes as theirs.
// The previous version's routes are in src/app/screens.js (routeOf) and src/phone.js; the Planner's own (planner.html#week…) are
// sent here by the root's planner.html. No saved work is read: an address names a class, an assignment or a lesson by its id, the
// same id in both versions.
const e = encodeURIComponent;
// The class page's tabs then, and the new tab each one's work is on now (a student's own page keeps its place on the roster).
const CLASS_TAB = { gradebook: 'grades', students: 'people', attendance: 'people', seating: 'people', missing: 'todo', charts: 'grades', goals: 'grades', reports: 'grades' };
// Settings, a page per subject then (SET_SECS), and the new group with the same settings. Keys moved to Help.
const SETTINGS = { history: 'settings/saving', setup: 'settings/classes', terms: 'settings/classes', claude: 'settings/ai', keys: 'help/keys' };
// The address (location.hash) as the new app's, or null when it was never one of the previous version's either.
export function newHash(hash) {
  let p; try { p = decodeURIComponent(String(hash || '').replace(/^#\/?/, '')).replace(/\/+$/, '').split('?')[0].split('/'); } catch { return null; }
  const [a, b, c, d] = p, to = s => '#/' + s;
  if (/(^|&)(access_token|error)=/.test(a)) return to('home');   // Google's sign-in coming back is never a screen (whole/google.js reads it first)
  switch (a) {
    // the previous version's #/a/<id> leaves out the download's gs.b., which the new app's #/mark/<id> keeps
    case 'a': return b ? to('mark/' + e(/^gs\.b\./.test(b) ? b : 'gs.b.' + b) + (['grades', 'insights', 'return'].includes(c) ? '/' + c : '')) : to('home');
    case 'class': { if (!b) return to('classes'); const t = c in CLASS_TAB ? CLASS_TAB[c] : c; return to('class/' + e(b) + (t ? '/' + t + (c === 'students' && /^\d+$/.test(d || '') ? '/' + d : '') : '')); }
    case 'class-named': return to('classes');
    case 'settings': return to(SETTINGS[b] || 'settings' + (b ? '/' + e(b) : ''));
    case 'examples': return to('library/examples');
    case 'plans': return to(b ? 'lesson/' + e(b) : 'calendar');   // the phone's plans: a lesson by its id
    case 'scores': return to(b ? 'class/' + e(b) + '/grades' : 'classes');   // the phone's scores for a class
    case 'att': return to(b ? 'class/' + e(b) + '/people' : 'classes');   // the phone's attendance for a class
    // The Planner's own, should one arrive at the root without planner.html.
    case 'rubrics': return to('library/rubrics');
    case 'timetable': return to('settings/timetable');
    case 'present': return b ? to('lesson/' + e(b) + '/slides') : to('calendar');
    case 'plan': return to('calendar');
  }
  return null;
}
// Sends the page to the new address in place of the old one (location.replace, so Back does not return to it). True when it did.
export function goNew() {
  const to = newHash(location.hash);
  if (!to || to === location.hash) return false;
  location.replace(to);
  return true;
}
