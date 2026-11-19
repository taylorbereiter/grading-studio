// Each language's lines (made from the current app's src/lang-*.js by next/tools/lang-convert.js), loaded only for a teacher who
// chose that language, one file per area (next/lang/<code>/<area>.json, each its own chunk) with the screens that use it.
// English when one can't be fetched, as the current app does for that visit.
export const area = (c, a) => import(`../../lang/${c}/${a}.json`).then(m => m.default, () => ({}));
// The areas, the same as the English files' (next/lang/<area>.en.json, en.json is core; next/test/lines.test.js holds the two the same).
export const AREAS = ['building', 'calendar', 'class', 'edit', 'core', 'engine', 'focus', 'help', 'home', 'lesson', 'mark', 'more', 'paper', 'plan', 'prefs', 'present', 'review', 'saving', 'school', 'settings', 'setup', 'todo', 'tools', 'video'];
// Every area of a language at once (a quiz printed in another language, app/mark/quizmaker.jsx).
export const lines = async c => (c === 'en' ? {} : Object.assign({}, ...await Promise.all(AREAS.map(a => area(c, a)))));
