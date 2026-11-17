// Every name the current app keeps saved work under, and which side of the wall it is on.
//
// side   students  the grading side: papers, marks, scores, rosters, and anything made from them
//        planning  the Planner side: lessons, units, the bank, the timetable, Planner settings. No student data may be stored here
//        shared    neither: how the screen looks, the device, the sign-in, and the notes windows leave each other
// kind   work      the teacher's work: it must survive every change, and backups carry it
//        pref      a setting or a remembered choice
//        coord     a note one window leaves another (src/saving.js), or a step under way. Never carried anywhere
//        cache     kept only to save time; losing it loses nothing
//        legacy    written by older versions only. Read, never written
// A name that ends in "." is a prefix: the rest is an id made at run time.
// next/test/keys.test.js fails when the current app's source names a key or a database that is not here, and the saved-work
// proof fails when a browser holds one that is not here. next/docs/saved-work.md is made from this list (npm run next:docs).

export const LOCAL = [
  // the grading side's work
  ['gs.b.', 'students', 'work', 'json', 'quick copy of one download’s marks and scores (the full copy is grading-studio-keep/work)'],
  ['gs.batches', 'students', 'work', 'json', 'which downloads have a quick copy here, with the time of each'],
  ['gs.lib', 'students', 'work', 'json', 'classes, rosters, units, assignments, scores, to-dos: the library'],
  ['gs.setup', 'students', 'work', 'json', 'the grading setup: rubric rows, scale, criteria'],
  ['gs.setupUndo', 'students', 'work', 'json', 'the settings as they were before the last setup import'],
  ['gs.bank', 'students', 'work', 'json', 'the comment bank'],
  ['gs.rubrics', 'students', 'work', 'json', 'saved rubrics'],
  ['gs.rubricsGone', 'students', 'work', 'json', 'rubrics deleted, so a merge does not bring them back'],
  ['gs.tomb', 'students', 'work', 'json', 'things deleted, so a merge or sync does not bring them back'],
  ['gs.rd.', 'students', 'work', 'json', 'readings (grades read off papers) for one download'],
  ['gs.rp.', 'students', 'work', 'text', 'a rubric page picture, base64'],
  ['gs.dataV', 'students', 'work', 'json', 'the saved-data format version (src/migrate.js)'],
  ['gs.carryNo', 'students', 'work', 'json', 'downloads whose marks should not be carried to a newer copy'],
  ['gs.histSame', 'students', 'work', 'json', 'student history: names marked as the same person'],
  ['gs.rolls', 'students', 'work', 'json', 'the name picker’s rolls (holds student names)'],
  ['gs.wlCodes', 'students', 'work', 'json', 'the watch list’s private codes for students'],
  ['gs.focus', 'students', 'work', 'json', 'the work timer’s log of marking sessions'],
  ['gs.lastBackup', 'students', 'work', 'json', 'when the last take-home file or backup was made'],
  ['gs.sheetfound', 'students', 'work', 'json', 'a gradebook sheet column found for a class'],
  ['gs.snipMarks', 'students', 'pref', 'json', 'snip tool: keep marks in the picture'],
  ['gs.syncT', 'students', 'legacy', 'json', 'old sync times per key (before 1.27)'],
  // the Planner side's work and settings
  ['gs.school', 'planning', 'work', 'json', 'the school: calendar, links, documents list'],
  ['gs.mblinks', 'planning', 'work', 'json', 'ManageBac links per class'],
  ['gsp.taughtIn', 'planning', 'work', 'json', 'which lesson was taught in which period'],
  ['gsp.planTime', 'planning', 'work', 'json', 'time spent planning, per day'],
  ['gsp.timeCount', 'planning', 'pref', 'json', 'whether Planner time counts'],
  ['gsp.newYear', 'planning', 'work', 'json', 'a new school year under way in the Planner'],
  ['gsp.focusGo', 'planning', 'pref', 'json', 'the Planner focus timer: what to start'],
  ['gsp.focusQ', 'planning', 'pref', 'json', 'the Planner focus timer: the queue'],
  ['gsp.focusRun', 'planning', 'coord', 'json', 'the Planner focus timer: a session running'],
  ['gsp.panel', 'planning', 'pref', 'json', 'the Planner side panel'],
  ['gsp.presentBig', 'planning', 'pref', 'json', 'Present: text size'],
  ['gsp.presentOwn', 'planning', 'pref', 'json', 'Present: own window'],
  ['gsp.presentSound', 'planning', 'pref', 'json', 'Present: timer sound'],
  ['gsp.presentTimer', 'planning', 'pref', 'json', 'Present: timer length'],
  ['gsp.railLib', 'planning', 'pref', 'json', 'the Planner sidebar’s Library group open'],
  ['gsp.view', 'planning', 'pref', 'json', 'the Planner’s last view'],
  // used by both, holding no student data
  ['gs.words', 'shared', 'work', 'json', 'the teacher’s own words: assistant names and links, terms'],
  ['gs.theme', 'shared', 'pref', 'json', 'light or dark (kept apart from the sample on purpose)'],
  ['gs.lang', 'shared', 'pref', 'json', 'the language (kept apart from the sample on purpose)'],
  ['gs.gEmail', 'shared', 'pref', 'text', 'the Google account signed in'],
  ['gs.gcid', 'shared', 'pref', 'text', 'a Google Client ID of the teacher’s own'],
  ['gs.gAuto', 'shared', 'pref', 'json', 'Google sign-in: renew by itself'],
  ['gs.gPaperDir', 'shared', 'pref', 'json', 'Drive folder papers come from'],
  ['gs.gVidDir', 'shared', 'pref', 'json', 'Drive folder videos come from'],
  ['gs.cloudP', 'shared', 'coord', 'json', 'Drive sync: what is waiting to go up'],
  ['gs.syncAt', 'shared', 'coord', 'json', 'Drive sync: when it last ran'],
  ['gs.planBig', 'shared', 'pref', 'json', 'Today: lesson plans shown large'],
  ['gs.planCopy', 'shared', 'cache', 'json', 'Today: a copy of the week’s plans for the phone'],
  ['gs.planSeen', 'shared', 'pref', 'json', 'Today: plans seen'],
  ['gs.phone', 'shared', 'pref', 'json', 'phone layout chosen'],
  ['gs.phCls', 'shared', 'pref', 'json', 'phone: last class'],
  ['gs.mailApp', 'shared', 'pref', 'json', 'which mail app the email buttons open'],
  ['gs.sampleOn', 'shared', 'coord', 'text', 'the sample is open (src/samplemode.js)'],
  ['gs.sampleLeft', 'shared', 'coord', 'text', 'the sample was left and is being cleared'],
  ['gs.sampleBuilt', 'shared', 'coord', 'text', 'the sample has been filled in'],
  // grading screens' settings and remembered choices
  ...[
    'gs.anchorCover', 'gs.arrsize', 'gs.asrHave', 'gs.avgDp', 'gs.bkOnly', 'gs.calchist', 'gs.calcpos', 'gs.checkInk', 'gs.cmAuthor', 'gs.disp',
    'gs.exCopied', 'gs.focusRun', 'gs.fullSide', 'gs.histOpen', 'gs.hl', 'gs.hlMode', 'gs.hlW', 'gs.impAuto', 'gs.ink', 'gs.listOpen', 'gs.listPts',
    'gs.markKey', 'gs.markSizes', 'gs.nameFind', 'gs.openSeen', 'gs.panels', 'gs.pctView', 'gs.penSeen', 'gs.penW', 'gs.press', 'gs.ptsInk',
    'gs.qmCopySeen', 'gs.qmNoteAs', 'gs.qmSize', 'gs.qmWords', 'gs.rate', 'gs.rdOpen', 'gs.recentStamps', 'gs.refH.', 'gs.refOpen.', 'gs.refZoom.',
    'gs.sheetall', 'gs.solo', 'gs.sp', 'gs.spsize', 'gs.tdBy', 'gs.tnTime', 'gs.touch', 'gs.trCap', 'gs.vidH', 'gs.wordPdf', 'gs.xall', 'gs.xcU',
    'gs.xearly', 'gs.xedit', 'gs.xfb', 'gs.xnames', 'gs.xone', 'gs.xopts', 'gs.zoom',
  ].map(k => [k, 'students', 'pref', 'json', 'a grading screen setting']),
  // notes between windows, and steps under way
  ['gsc.saved.', 'shared', 'coord', 'text', 'which window saved this download last (src/saving.js)'],
  ['gsc.forgot.', 'shared', 'coord', 'text', 'when this download was last forgotten here'],
  ['gsc.saving.', 'shared', 'coord', 'text', 'a window still saving before another replaces everything'],
  ['gsc.over', 'shared', 'coord', 'text', 'one window is replacing everything; the others stop writing'],
  ['gsc.finish', 'shared', 'coord', 'text', 'the others are asked to save what is half typed'],
  ['gsc.win', 'shared', 'coord', 'text', 'after a put-back, this browser’s copy wins a folder merge'],
  ['gsc.dev', 'shared', 'coord', 'text', 'this browser’s own id, for merges'],
  ['gsc.folderLater', 'shared', 'pref', 'text', 'the folder reminder put off'],
  ['gsc.moveSeen', 'shared', 'pref', 'text', 'the address-move notice seen'],
  ['gsc.bankUnit', 'shared', 'pref', 'text', 'the rubric bank’s last unit'],
  ['gsc.counted', 'shared', 'coord', 'text', 'this browser was counted today (src/visits.js)'],
  ['gsm.try', 'shared', 'coord', 'text', 'a data-format update under way (src/migrate.js)'],
];

// sessionStorage: gone when the window closes. Listed so nothing new is written under a name these already use.
export const SESSION = [
  ['gs.gTok', 'shared', 'coord', 'json', 'the Google sign-in token'],
  ['gs.gState', 'shared', 'coord', 'json', 'the Google sign-in step under way'],
  ['gs.gQuiet', 'shared', 'coord', 'json', 'Google sign-in: renew without asking'],
  ['gs.goHome', 'shared', 'coord', 'json', 'open Home after the reload'],
  ['gs.pickedUp', 'students', 'coord', 'json', 'a download picked up after the reload'],
];

// IndexedDB. version: the one the current app opens it at. The layer never opens at a version, never makes a database or a store,
// so the current app's own upgrade code always runs first (next/src/shared/idb.js).
// key: how records are keyed. inline: the key is a field of the record (keyPath).
export const DATABASES = {
  'grading-studio-keep': { version: 2, side: 'students', by: 'src/app/kept.js keepDb', stores: {
    papers: { key: 'download id, or "id|i|n" for the pieces of a big one', what: 'the files as opened: bytes' },
    work: { key: 'download id (gs.b.<hash>)', what: 'the full copy of marks and scores' },
    meta: { key: 'download id', what: 'a small summary per download for the list' },
    edits: { key: '"id|path"', what: 'Word papers edited in the app: { data, orig, t }' },
  } },
  'grading-studio-added': { version: 1, side: 'students', by: 'src/app/kept.js addDb', stores: {
    files: { key: '"download id|student key|path"', what: 'late or forgotten files added to a submission' },
  } },
  'grading-studio-examples': { version: 1, side: 'students', by: 'src/examples.js exDb, src/watch.js', stores: {
    ex: { key: 'record id ("watch:1" is the watch list)', what: 'strong examples taken from papers; the watch list' },
    pix: { key: '"id|n"', what: 'the examples’ pictures' },
  } },
  'grading-studio-videos': { version: 1, side: 'students', by: 'src/video.js', stores: {
    v: { key: 'video id', what: 'student videos downloaded for offline: { id, name, type, size, at, blob }' },
  } },
  'grading-studio-safety': { version: 1, side: 'students', by: 'src/migrate.js', stores: {
    meta: { key: 'copy id', what: 'safety copies made before a data-format update' },
    data: { key: '"id" and "id|n" slices', what: 'what each safety copy holds (student work)' },
  } },
  'grading-studio-school': { version: 1, side: 'planning', by: 'src/school.js', stores: {
    files: { key: 'content hash', what: 'school documents: { data }' },
  } },
  'gs-lessons': { version: 1, side: 'planning', by: 'src/planner/lessons.js lDb', stores: {
    lessons: { key: 'inline: id', what: 'one record per lesson' },
    kv: { key: 'setup, units, bank, bankFiles, activities, words, deflook, cbox, dir, pdfs, profMod, yearsDone, syncGoneFiles, nb:<id>, file:<id>, pdf:<id>, pdfpg:<id>, ver:<lesson id> …', what: 'everything else the Planner keeps' },
  } },
  'grading-studio-folder': { version: 1, side: 'shared', by: 'src/folder.js', stores: {
    kv: { key: '"dir"', what: 'the linked folder’s handle' },
  } },
  'grading-studio-models': { version: 1, side: 'shared', by: 'src/app/readings.js (a worker)', stores: {
    files: { key: 'model file url', what: 'speech and handwriting model files: a cache' },
  } },
};

// CacheStorage the app uses for work-like things (the service worker's own caches, gs-app-1 and so on, are the pages, not work).
export const CACHES = [
  ['gs-lesson-pictures', 'planning', 'cache', 'slide pictures kept for the phone (src/phone.js)'],
];

// The entry for a localStorage or sessionStorage key, or null.
export function entryFor(key, list = LOCAL) {
  let best = null;
  for (const e of list) if (e[0] === key || (e[0].endsWith('.') && key.startsWith(e[0]) && (!best || e[0].length > best[0].length))) { if (e[0] === key) return e; best = e; }
  return best;
}
export const toEntry = e => e && { name: e[0], side: e[1], kind: e[2], format: e[3], what: e[4] };
