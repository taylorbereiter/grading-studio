// Made-up planning work for the planning screens' checks and pictures: the timetable of test/helpers/steady.js PLAN_SETUP with a
// third section, a week of lessons around the stopped clock (Tuesday 27 October 2026), and two units. gs-lessons is made the way
// the current Planner makes it (src/planner/lessons.js lOpenDb: lessons keyed by their id, and kv). Every class and lesson is made up.
const { PLAN_SETUP } = require('../../../test/helpers/steady.js');

const SETUP = { ...PLAN_SETUP, classes: [...PLAN_SETUP.classes,
  { id: 'A2', name: 'Grade 9 English B', course: 'Grade 9', color: '#7048C0', meets: [{ dow: 1, start: '13:30', end: '15:00' }, { dow: 3, start: '09:00', end: '10:30' }, { dow: 4, start: '13:30', end: '15:00' }] }],
  daysOff: [{ date: '2026-11-11', label: 'Staff training day' }], events: [{ date: '2026-10-29', label: 'Parent evening' }] };
const S = (layout, title, body, more) => ({ layout, title, body: body || '', fmt: 2, size: 28, ...more });
const lesson = (id, title, slots, extra, slides) => ({ id, title, slots, fmt: 2, created: 1792000000000, updated: 1792000000000, note: '', status: '', claudeNote: '',
  slides: slides || [S('title', title), S('agenda', '10/27 Agenda', '1. Warm-up\n2. Read in pairs\n3. Exit ticket'), S('content', 'Warm-up', '• Read the poem once in your head\n• Mark two words you would stress', { notes: 'Two minutes, silent.' }),
    S('discuss', 'Let’s talk', 'Which word carries the poem?', { foot: 'Think · Pair · Share' }), S('exit', 'Exit ticket', 'One word, and why.', { tag: 'On a sticky note' })].map((s, i) => ({ id: id + 's' + i, ...s, notes: s.notes || '', ask: '', talk: [] })),
  ...extra });
const LESSONS = [
  lesson('L1', 'Stressed words in a poem', [{ classId: 'A1', date: '2026-10-26' }, { classId: 'A2', date: '2026-10-26' }], { taught: [{ classId: 'A1', date: '2026-10-26', slide: 5, of: 5, note: '', at: 1792000000000 }], ready: { at: 1792000000000 } }),
  lesson('L2', 'Reading a poem aloud', [{ classId: 'A1', date: '2026-10-27' }], { ready: { at: 1792000000000 } }),
  lesson('L3', 'Sonnets: the turn', [{ classId: 'A1', date: '2026-10-29' }], {}),
  lesson('L4', 'Unreliable narrators', [{ classId: 'B1', date: '2026-10-27' }], { ready: { at: 1792000000000 } }),
  lesson('L5', 'Point of view, again', [{ classId: 'B1', date: '2026-10-28' }], {}),
  lesson('L0', 'What makes a story a story?', [{ classId: 'A1', date: '2026-10-19' }, { classId: 'A2', date: '2026-10-19' }], { taught: [{ classId: 'A1', date: '2026-10-19', slide: 5, of: 5, note: '', at: 1791400000000 }] }),
];
const UNITS = [
  { id: 'U1', course: 'Grade 9', title: 'Unit 1: Stories', start: '2026-08-31', atlas: '', color: '', files: [], updated: 1792000000000, weeks: Array.from({ length: 6 }, (_, i) => ({ focus: ['Plot', 'Setting', 'Character', 'Conflict', 'Theme', 'Writing our own'][i], notes: '', standards: '' })) },
  { id: 'U2', course: 'Grade 9', title: 'Unit 2: Poetry', start: '2026-10-12', atlas: '', color: '', files: [], updated: 1792000000000, weeks: Array.from({ length: 5 }, (_, i) => ({ focus: ['Sound', 'Images', 'Voice', 'Form', 'Our own poems'][i], notes: '', standards: '' })) },
  { id: 'U3', course: 'Grade 10', title: 'Unit 2: Narrators', start: '2026-10-19', atlas: '', color: '', files: [], updated: 1792000000000, weeks: Array.from({ length: 4 }, () => ({ focus: '', notes: '', standards: '' })) },
];

// The bank (kv "bank"): wording and scales only. And one activity of the teacher's own (kv "activities").
const BANK = { rubrics: [{ id: 'R1', name: 'Story analysis', criteria: [{ name: 'Understanding' }, { name: 'Evidence' }, { name: 'Language' }], unit: { id: 'U1', course: 'Grade 9', title: 'Unit 1: Stories' }, at: 1792000000000 }],
  scales: [{ id: 'S1', name: 'School percent scale', scale: { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 }, at: 1792000000000 }], gone: {} };
const ACTS = [{ id: 'my-poem', name: 'Poem relay', what: 'Each table reads one stanza aloud and passes the poem on.', kind: 'read', parts: ['activity'], group: 'Tables', how: ['Hand each table one stanza.', 'Tables read in turn.'], slide: ['Read your stanza together', 'Pass the poem on'], book: 0, tip: '' }];

// Makes gs-lessons in the page as the current Planner would, with this work in it.
async function plantPlan(page, { setup = SETUP, lessons = LESSONS, units = UNITS, bank = BANK, acts = ACTS } = {}) {
  await page.evaluate(async (setup, lessons, units, bank, acts) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons', 1); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction(['lessons', 'kv'], 'readwrite'); for (const l of lessons) tx.objectStore('lessons').put(l); tx.objectStore('kv').put(setup, 'setup'); tx.objectStore('kv').put(units, 'units'); if (bank) tx.objectStore('kv').put(bank, 'bank'); if (acts) tx.objectStore('kv').put(acts, 'activities'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, setup, lessons, units, bank, acts);
}
module.exports = { SETUP, LESSONS, UNITS, BANK, ACTS, plantPlan, lesson };
