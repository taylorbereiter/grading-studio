## The wall by kind of data (stage 2)

Decided in stage 2 (2026-11-17). The new app is one app, so the wall no longer runs between two pages. It runs between two kinds
of data, and next/test/wall.test.js holds every file to it.

**students/** owns what is about students: names and rosters (`gs.lib`), papers, scores, comments, attendance, the Planner's name
picker copy (`gs.rolls`), strong examples, the watch list, and the Focus log `gs.focus` (it holds download names).
**planning/** owns what is not: `gs-lessons`, every `gsp.*` key, and the teacher-wide settings (look and theme, language,
`gs.words`, mail app, class-page links, School resources, the Google sign-in keys, planning time and focus records).
**shared/** and **engines/** hold no data of their own and import neither side.

- students/ may import planning/. planning/ never imports students/, `whole/` or crossings.js.
- A top-level file (the shell, a screen) reaches students/ only through crossings.js, which names each read-only crossing:
  `classListsForPlanning`, `classesForHome`, `countsForHome`, `examplesForPlanning`, `rosterNamesForPresent`, and since stage 3 `todoCountForSidebar` (the sidebar's To do count) and `workForCalendar` (assignment names and due days, and the teacher's own to-dos, for the calendar).
- **whole/** is the work that has to see everything at once: the linked folder, the Drive sync file, and later the year file,
  take-home and the sample. It imports both sides; only main.js and the proof page import it.

`gsp.taughtIn` (after-class notes) **may hold names**: it is the teacher's own words about a class. It stays on the planning side
but is marked `taughtInMayHoldNames` in planning/index.js and is never put into an assistant brief unless the teacher puts it there.

### The 13 rows that were one page writing the other's storage

Each is now a call to the owning side's function (next/src/planning/write.js and next/src/students/write.js), whoever calls it.

| # | Was | Now |
|---|---|---|
| 3 | grading writes kv `bank` | `saveKv('bank', v)` (also tells `gs-bank`) |
| 8 | My setup import writes kv `setup` | `saveKv('setup', v)` |
| 14 | Bring work in writes `lessons` and kv | `saveLesson`, `saveKv` (whole/ calls them when take-home moves, stage 6) |
| 15 | the sample writes `lessons` and kv | the same functions, inside the sample (stage 6; until then the current app builds the sample) |
| 18 | Drive sync writes `lessons` and kv | `saveLesson`, `saveKv` from whole/sync.js (taking in from Drive, stage 6) |
| 22 | Focus adds planning time | `addPlanTime(r, secs)` |
| 29 | the phone saves an after-class note | `saveTaughtNote(key, note)` |
| 30 | Drive sync merges planning time and notes | whole/sync.js with engines/merge.js `planTimeMerge`, `taughtInMerge`, then the planning side's write (stage 6) |
| 32 | New year tells the Planner | `startNewYear(v)` |
| 34 | take-home writes `gsp.*` | the planning side's writes, from whole/ (stage 6) |
| 38 | the Planner writes `gs.theme` | `savePref('gs.theme', v)`; the look is `savePref('gs.look', v)` |
| 41 | the Planner writes `gs.mblinks` | `savePref('gs.mblinks', v)` |
| 49 | the Planner writes the Google token | `setGoogleToken(v)` |

### One save path

A save goes through one function per kind of record, and that function does everything the current app does for the same save:

- `saveWork(id, change)`: stamps (engines/merge.js `stampData`, the current app's own code), the full copy and its row with the
  counts, the quick copy and its list (with the same eviction), the window stamps (`gsc.saved.<id>`), then tells whole/: the
  linked folder's `work.json` and `info.json`, and the Drive sync marked due.
- `saveLibrary(change)`: the library read into the current app's shape first (`migrateLib`), stamped (`stampLib`), then the
  Planner's name picker copy and the teacher's words; whole/ writes `library.json` and `tombstones.json` to the folder.
- `saveSetting(key, value)` for the other grading records that travel; `saveLesson`, `saveKv`, `savePref` and the rest on the
  planning side.
- Undo (students/undo.js) records each the way the current app does: `scoreChange` as gradeSnap/gradeBack, `fieldChange` as
  fieldSnap, `libraryChange` as libTrack (saves joined within a second, up to three seconds), and `libraryForget`.

Every write first checks that this window holds the one writing lock (shared/lock.js), that the saved work's format is the one
this build knows, that no other window has started replacing everything, and that a forgotten download stays forgotten.

`npm run saved-work` proves it: the same change (a comment on a student, a class renamed) made once in the current app's pages
and once through these functions leaves the same records, the same files in a linked folder, and the same Drive sync file. The
only difference allowed is that the current app keeps empty fields as fields holding `undefined` in the full copy, which read,
send and merge the same.

**Lessons and the Planner folder (stage 3).** `saveLesson` writes the lesson's file in a linked Planner folder the way the current
Planner does (planning/folder.js: the same `<M-DD Day - title>.lesson.json` name, the same JSON, pictures in `images/`, the old file
removed when the name changes). When the browser has not been given the folder this session, the lesson is marked `_sync: 1`
and the current Planner writes it the next time it opens, as it already does for its own saves. A saved lesson is announced on
`gs-plan-out` so the grading page starts its Drive sync.

**Not yet.** Sending the sync file to Drive and taking in what comes back, reading a folder changed elsewhere, and the paper and
reading files in the folder come before the switch, in stage 6. Until then the current app does them as soon as it is opened, so nothing is lost.
