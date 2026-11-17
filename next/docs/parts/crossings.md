## Where the two pages touch each other's storage today

Found by reading the code on 2026-11-17 (1.28.72). This changes how the wall is drawn in stage 2: the grading page and the Planner are not separate writers today. Ownership used here: `gs-lessons` and `gsp.*` belong to the Planner; everything else belongs to grading. Line numbers drift; the function names are the anchor.

### A. The grading page and the Planner's storage

`gs-lessons` (stores `lessons`, keyPath `id`, and `kv`). Every grading caller opens it with `planDb(make)` in src/rubrics.js, which only makes the database when `make` is true.

| # | R/W | Store / key | Where | Why |
|---|---|---|---|---|
| 1 | open, makes it when asked | `gs-lessons` | src/rubrics.js `planDb(make)` | the one opener for every grading caller below |
| 2 | R | kv `bank`, `units` | src/rubrics.js `bankRead` | rubric setup shows the bank by the Planner's units |
| 3 | R+W | kv `bank` | src/rubrics.js `bankWrite` | saves rubrics and scales into the bank (also pushes `gs.rubrics` not in it yet) |
| 4 | R | kv `setup` | src/linked.js `lkPlanLoad` | offers to link classes sharing a course |
| 5 | R | kv `setup` | src/school.js `schClsLoad` | class choices for School resources |
| 6 | R | kv `bank` | src/settings.js `setBankCount` | count of saved rubrics and scales |
| 7 | R | kv `setup` | src/setupin.js `stpPlanGet` | reads the timetable for My setup |
| 8 | W | kv `setup` (put or delete) | src/setupin.js `stpPlanPut` | My setup import writes classes, meeting times, colours, class links, semester, days off, events |
| 9 | R | kv `setup`, `lessons` | src/today.js `planRead` | Today's timetable and lessons, planning pace, Focus lesson list |
| 10 | R | `lessons` one | src/phone.js `phLessonRender` | the phone shows a lesson |
| 11 | R | every `lessons` and `kv` record (Blobs too; handles skipped) | src/newyear.js `nyPlanFrames` (from takehome.js `takeWrite`) | the year file and the take-home file carry the whole Planner |
| 12 | R | counts | src/newyear.js `nyHasPlanner` | whether New year offers the Planner |
| 13 | R | keys, kv `units` | src/takehome.js `planBringPlan` | which Planner records in a file are missing here |
| 14 | W | `lessons` and any kv key from a file | src/takehome.js `planTake` | Bring work in restores Planner records (all if the Planner is empty, else only missing ones) |
| 15 | W | `lessons`, kv `setup`, `units`, `words` | src/sample-data.js `SAMPLE.planner` | builds the sample week (sample-gs-lessons) |
| 16 | R | kv `setup` | src/app/drive.js `syncPlan` | the timetable goes up in the Drive sync file |
| 17 | R | `lessons`, kv `setup units bank activities words deflook` | src/app/drive.js `planHere` (via `planSync`) | two-way Drive sync of the Planner |
| 18 | W | `lessons` put/delete, kv `PLAN_KEYS`, kv `syncGoneFiles` | src/app/drive.js `planApply` | writes what arrived from Drive; on a phone, light copies |
| 19 | delete | `sample-gs-lessons` only | src/samplemode.js `wipe` | leaving the sample |

`gsp.*` localStorage:

| # | R/W | Key | Where | Why |
|---|---|---|---|---|
| 20 | R/W/remove | `gsp.focusRun` | src/focus.js `fcRun`, `fcPut`, `fcRunSet` | the Focus session, shared with the Planner's timer |
| 21 | R | `gsp.planTime` | src/focus.js `fcLesStart` | today's planning sessions |
| 22 | R+W | `gsp.planTime` | src/focus.js `fcPlanAdd` | a lesson session's time counts as planning |
| 23 | listen | `gsp.focusRun`, `gsp.focusQ` | src/focus.js storage listener | follows the Planner's session |
| 24 | R + remove | `gsp.focusQ` | src/focus.js `fcDrain` | sessions ended in the Planner go into `gs.focus` |
| 25 | R + remove | `gsp.focusGo` | src/focus.js (top level) | "Next paper" pressed in the Planner |
| 26 | W | `gsp.timeCount` | src/tracker.js `tkShare` | copies the time and Focus settings for the Planner |
| 27 | R | `gsp.planTime` | src/tracker.js `tkPlan` | the Time page shows planning time |
| 28 | R | `gsp.taughtIn` | src/phone.js `phTinGet` | the phone's After class notes |
| 29 | W | `gsp.taughtIn` | src/phone.js `[data-phasave]` handler | saves an After class note |
| 30 | R+W | `gsp.planTime`, `gsp.taughtIn` | src/app/drive.js `syncOnce` | merges what came from Drive |
| 31 | R | `gsp.planTime`, `gsp.taughtIn` | src/app/drive.js `syncOnce` | sends them up |
| 32 | W | `gsp.newYear` | src/newyear.js `nyStart` | tells the Planner to move to the new year |
| 33 | R | all `gsp.*` but a few | src/takehome.js `planLs` | the take-home file carries the Planner's settings |
| 34 | W | `gsp.*` from a file | src/takehome.js `planTake` | restores them where missing |
| 35 | remove | `gsp.focusRun`, `focusQ`, `focusGo` | src/takehome.js `removeHere` | Remove from this computer |
| 36 | remove | `sample:gsp.*` | src/samplemode.js `wipe` | leaving the sample |

### B. The Planner and the grading page's storage

| # | R/W | Store / key | Where | Why |
|---|---|---|---|---|
| 37 | R | `gs.theme` | src/planner/planner.html inline script | theme before paint |
| 38 | W | `gs.theme` | src/planner/base.js `setTheme` | the shared theme button |
| 39 | R | `gs.words` | src/planner/lessons.js `plWords` | school system, unit plan and assistant names |
| 40 | R | `gs.mblinks` | src/planner/lessons.js `mbMap` | class-page links by class name |
| 41 | W | `gs.mblinks` | src/planner/lessons.js `mbRemember` | shares class-page links with grading |
| 42 | R | `gs.school` | src/planner/links.js `lkSchool` | School resources in lessons |
| 43 | R | `grading-studio-examples` (never made) | src/planner/plexamples.js `plxDb`, `plxRead` | strong examples, read only |
| 44 | R | `grading-studio-examples/ex` | src/planner/plexamples.js `plxLoad` | the list (keeps only title, letter, why, tags, pages; drops watch records) |
| 45 | R | `grading-studio-examples/pix` | src/planner/plexamples.js `plxPic` | example pictures, put into slides or Materials |
| 46 | R | `gs.gcid` | src/planner/pldrive.js `plGcid` | Google Client ID for the Drive chooser |
| 47 | R | sessionStorage `gs.gTok` | src/planner/pldrive.js `plTok` | reuses grading's token in the same tab |
| 48 | R | `gs.gEmail` | src/planner/pldrive.js `plToken`, `gpHost` | sign-in hint; whether to show Drive |
| 49 | W | sessionStorage `gs.gTok` | src/planner/pldrive.js `plToken` | the Planner's own token, under grading's key |
| 50 | remove | sessionStorage `gs.gTok` | src/planner/pldrive.js `plGet` | on a 401 |
| 51 | R | `gs.words` | src/beside.js `besideWho` | the assistant link |
| 52 | listen | `gs.words` | src/beside.js storage listener | repaints when grading changes it |
| 53 | R | `gs.rolls` | src/pickshare.js `pkRolls` from src/planner/present.js `prPick` | pick a name and groups while presenting |
| 54 | R | `gs.lang` | src/lang.js | the page language |
| 55 | W (no trigger in the Planner) | `gs.lang` | src/lang.js change handler | code present, no Planner element fires it |
| 56 | R | `gs.mailApp` | src/mail.js `mailGet` | where mail links open |
| 57 | R | `gs.phone` | src/mail.js `mailPhone` | phone layout |
| 58 | R | `gs.gEmail` | src/mail.js `mailWeb` | Gmail for the signed-in account |
| 59 | W (not called in the Planner) | `gs.mailApp` | src/mail.js `mailAppSet` | code present only |
| 60 | R | `gs.sampleOn`, `gs.sampleLeft`, `sample:gs.sampleBuilt` | src/samplemode.js | sample mode |
| 61 | remove/delete | every `sample:` key and `sample-` database | src/samplemode.js `wipe` | the Planner can clear grading's sample databases |
| 62 | listen | `gs.sampleOn` | src/samplemode.js | reload when the sample opens or closes elsewhere |
| 63 | rename | every storage, channel and lock name | src/samplemode.js | the sample's own names |

The Planner never touches `gs.lib`, `gs.focus`, `gs.b.*`, `gsc.*`, `gs-lesson-pictures` or the databases `grading-studio-keep`, `-added`, `-school`, `-videos`, `-folder`, `-models`, `-safety` (apart from the sample copies).

### C. Keys both pages write

| Key | Grading writes | Planner writes |
|---|---|---|
| `gs.theme` | src/app/start.js theme button | src/planner/base.js `setTheme` |
| `gs.mblinks` | src/app/screens.js `mbRemember`; src/setupin.js undo and restore | src/planner/lessons.js `mbRemember` |
| sessionStorage `gs.gTok` | src/app/drive.js | src/planner/pldrive.js |
| `gsp.focusRun` | src/focus.js `fcPut` | src/planner/plfocus.js |
| `gsp.planTime` | src/focus.js `fcPlanAdd`; src/app/drive.js `syncOnce` | src/planner/plfocus.js `pfPlanAdd`; src/planner/plantime.js |
| `gsp.taughtIn` | src/phone.js; src/app/drive.js | src/planner/present.js `taughtFoldNow` |
| `gsp.*` in bulk | src/takehome.js `planTake`, `removeHere` | its own |
| `gs-lessons` kv `bank` | src/rubrics.js `bankWrite`; src/app/drive.js `planApply` | src/planner/bank.js `bankUpdate` |
| `gs-lessons` kv `setup` | src/setupin.js `stpPlanPut`; drive.js `planApply`; takehome.js `planTake`; sample-data.js | src/planner/lessons.js |

Written by one page and read by the other: `gs.words`, `gs.rolls`, `gs.school`, `gsp.timeCount` and `gsp.newYear` only by grading; `gsp.focusQ` and `gsp.focusGo` only by the Planner. New year (`nyReplace`) and Remove from this computer (`removeHere`) clear every `gs.*` key outside `LS_LOOKS`, which includes `gs.words`, `gs.rolls`, `gs.mblinks`, `gs.lang`, `gs.mailApp` and `gs.gEmail` that the Planner reads.

### D. BroadcastChannels

| Channel | Posted by | Heard by | Meaning |
|---|---|---|---|
| `gs-bank` | src/rubrics.js `bankWrite`; src/planner/bank.js `bankUpdate` | both | the bank changed |
| `gs-plan-in` | src/app/drive.js `planApply`; src/takehome.js `planTake` | src/planner/base.js `planIn` (reloads, or waits while typing) | Planner records changed from outside |
| `gs-plan-out` | src/planner/lessons.js `planOut` | src/app/drive.js `syncSoon` | the Planner saved: sync to Drive |
| `gs-lofi` | src/focus.js | src/focus.js | grading tab to grading tab (music) |

### E. Student data that reaches the Planner side

| Path | What | Where it ends up |
|---|---|---|
| `gs.rolls` via `pkRolls` | every student name per class | shown while presenting; who is away is kept in memory only |
| `grading-studio-examples/ex` | the whole record is read (student key, roster name, marks, score, watch records), then cut to title, letter, why, tags, pages | only the cut fields stay in memory |
| `grading-studio-examples/pix` | pictures of student work, with covers painted in and the score left off unless the teacher kept it | copied into lessons (`gs-lessons` lessons, kv `file:<id>`), then into .pptx/.zip, shared lessons, the Planner folder, Drive sync and take-home/year files |
| `gsp.taughtIn` | a free-text teacher note (up to 300 characters) | folded into `lesson.taught[].note` in `gs-lessons` |
| `gsp.focusRun` | the name of the work being timed: a download's name, a to-do's text, or a lesson title | shown in the Planner's Focus panel |
| kv `setup` | class names, course, colour, times, class link, calendar; no student names | |
| attendance | nothing found on the Planner side | |

For the wall in stage 2: the example pictures (E, row 3) are the one place student work is stored on the planning side today, by the teacher's choice. `gs.rolls` is the one place roster names are read there. Both become named crossings (next/src/crossings.js `examplesForPlanning`, `rosterNamesForPresent`); whether a picture copied into a lesson may stay in planning storage is a decision for the planning thread.
