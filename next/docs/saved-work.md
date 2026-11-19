# Saved work: every store and key, and the layer over them

This file is made by `npm run next:docs` from next/src/shared/keys.js; edit that file and next/docs/parts/, not this one.

The new app (next/) reads and writes the current app's saved work where it already is, in the format it already has. Nothing
moves and nothing is converted: a teacher can go back and forth between the two versions, and the saved-work check proves it
(test/tools/saved-work.js, below).

## The layer

| Module | What it is |
|---|---|
| next/src/shared/keys.js | the registry: every key and database below, with its side of the wall |
| next/src/shared/idb.js | IndexedDB without harm: opens with no version and aborts any upgrade, so a database that isn't there stays not there (making it would stop the current app making its stores); never holds a connection; values pass through untouched |
| next/src/shared/ls.js | localStorage as text, and as JSON the way the current app writes it |
| next/src/shared/lock.js | one writer (below). Every write in idb.js and ls.js asks it first and refuses with ReadOnly |
| next/src/shared/records.js | builds typed accessors, each checked against the registry and its side |
| next/src/students/index.js | the grading side's typed accessors: work, papers, meta, edits, quick copies, added files, examples, videos, the library, rubrics… |
| next/src/planning/index.js | the Planner side's: lessons, kv records, school files, school links, taught-in notes, planning time |
| next/src/shared/device.js | the teacher's own words, the linked folder's handle, cached model files |
| next/src/crossings.js | the only module holding both sides: named, read-only functions for what planning needs from grading |
| next/src/shared/dump.js, next/src/proof.js | reading everything through the registry, and the proof's test page |

No module in the layer touches the page (no DOM). The sample: every page of the new app starts with the current app's sample lines
(src/samplemode.js, put in by next/build.js), so while the sample is open the layer reads and writes the sample's own names, as the
current app does.

**Rules for writing through the layer.** Values are stored as given; a JSON key is written with JSON.stringify as the current app
does. A save of a download's work is more than one record in the current app (src/saving.js writeWork: grading-studio-keep/work,
its meta row, the quick copy gs.b.<id>, gs.batches, and the gsc.saved.<id> stamp other windows watch), and it also goes to the
linked folder and starts a Drive sync. Stage 0 gives the records; the whole save, with the folder and Drive, comes with the stage
that first writes marks (next/docs/engines.md).

## One writer

The browser lock `gs-writer` (Web Locks). Every page of the current app takes a share of it (src/lock.js, run straight after the
sample lines on both pages), so any number of them work side by side as before. The new app takes it alone.

- Asked at once (ifAvailable), never waited out. Granted means this window writes. Only a browser with no Locks API, or one where
  asking throws, is let through: the current app as before, the new app after asking on a BroadcastChannel.
- A current-app page that can't get its share (the new app has the lock) is covered with a plain message, "Grading Studio is open
  in the new version in another window. Close that window to work here.", and takes no input. It stays in line, and when the new
  app's window closes it reloads, so it starts again from what is saved.
- A new-app window that can't get the lock opens read-only: every write refuses, and the page says why. It stays in line and is
  told when it becomes the writer; it must read everything again before writing.
- takeOver() takes the lock from the windows that have it; the current app's pages are then covered at once.
- In the sample the lock has the sample's own name (src/samplemode.js renames locks), so the sample and real work never block each other.
- Interim: before the switch the new app speaks the current app's multi-window protocol instead (next/docs/engines.md).
- Checked by test/lock.test.js.

## The proof

`npm run saved-work` (test/tools/saved-work.js), on every pull request, now also:

1. opens the layer in an empty browser: it reads nothing and makes no database, and every store and work key has a typed accessor;
2. has main's pages make work (a class, a term of scores, an assignment from a ZIP, marks, scores, a comment, a late file, a
   timetable and a lesson), then reads every record through the layer: each must be the same as the browser holds, every name
   must be in the registry, and reading must change nothing;
3. writes every record back through the typed accessors: every record must be the same afterwards, and main's pages must then
   show and keep exactly what they do from an untouched copy;
4. changes a lesson's title and a student's comment through the layer, and main's pages must show both;
5. reads the old-format work in test/fixtures/legacy-v1 through the layer, record for record.

The current app's own legs (web address and double-clicked copy, main against this build and back) are unchanged.

## localStorage

### The grading side (students)

| Key | Side | Kind | Format | What it holds | Named in (src/) |
|---|---|---|---|---|---|
| `gs.b.<id>` | students | work | json | quick copy of one download’s marks and scores (the full copy is grading-studio-keep/work) | app/open.js, app/screens.js, carryover.js, folder.js, migrate.js, safe.js, saving.js, takehome.js |
| `gs.batches` | students | work | json | which downloads have a quick copy here, with the time of each | app/kept.js, folder.js, migrate.js, safe.js, saving.js |
| `gs.lib` | students | work | json | classes, rosters, units, assignments, scores, to-dos: the library | app/drive.js, app/library.js, folder.js, merge.js, newyear.js, saving.js, takehome.js |
| `gs.setup` | students | work | json | the grading setup: rubric rows, scale, criteria | app/dialogs.js, app/drive.js, app/gradesheet.js, app/library.js, app/open.js, app/start.js, app/wordrubric.js, folder.js, ib.js, quiz.js, rubricup.js, setupin.js, sidepane.js, welcome.js |
| `gs.setupUndo` | students | work | json | the settings as they were before the last setup import | setupin.js |
| `gs.bank` | students | work | json | the comment bank | app/drive.js, app/paper.js, app/start.js, folder.js, markscreen.js, merge.js, saving.js, setupin.js, takehome.js, wordnotes.js |
| `gs.rubrics` | students | work | json | saved rubrics | merge.js, rubrics.js, setupin.js |
| `gs.rubricsGone` | students | work | json | rubrics deleted, so a merge does not bring them back | merge.js, rubrics.js, setupin.js, takehome.js |
| `gs.tomb` | students | work | json | things deleted, so a merge or sync does not bring them back | app/drive.js, folder.js, newyear.js, takehome.js |
| `gs.rd.<id>` | students | work | json | readings (grades read off papers) for one download | app/kept.js, app/media.js, carryover.js, merge.js |
| `gs.rp.<id>` | students | work | text | a rubric page picture, base64 | app/dialogs.js, rubricup.js |
| `gs.dataV` | students | work | json | the saved-data format version (src/migrate.js) | migrate.js, newyear.js, takehome.js |
| `gs.carryNo` | students | work | json | downloads whose marks should not be carried to a newer copy | carryover.js |
| `gs.histSame` | students | work | json | student history: names marked as the same person | insight.js, merge.js |
| `gs.rolls` | students | work | json | the name picker’s rolls (holds student names) | pickshare.js |
| `gs.wlCodes` | students | work | json | the watch list’s private codes for students | watch.js |
| `gs.focus` | students | work | json | the work timer’s log of marking sessions | app/drive.js, focus.js, merge.js |
| `gs.lastBackup` | students | work | json | when the last take-home file or backup was made | app/wiring.js, newyear.js, shell.js, takehome.js |
| `gs.sheetfound` | students | pref | json | grade sheet: also show grades found on the papers | app/gradesheet.js, setupin.js |
| `gs.snipMarks` | students | pref | json | snip tool: keep marks in the picture | snip.js |
| `gs.syncT` | students | legacy | json | old sync times per key (before 1.27) | (no longer in the source) |
| `gs.anchorCover` | students | pref | json | a grading screen setting | anchors.js, setupin.js |
| `gs.arrsize` | students | pref | json | a grading screen setting | app/arrange.js |
| `gs.asrHave` | students | pref | json | a grading screen setting | app/media.js, app/readings.js |
| `gs.avgDp` | students | pref | json | a grading screen setting | rubrics.js |
| `gs.bkOnly` | students | pref | json | a grading screen setting | book.js |
| `gs.calchist` | students | pref | json | a grading screen setting | app/calc.js |
| `gs.calcpos` | students | pref | json | a grading screen setting | app/calc.js |
| `gs.checkInk` | students | pref | json | a grading screen setting | app/start.js |
| `gs.cmAuthor` | students | pref | json | a grading screen setting | wordnotes.js |
| `gs.disp` | students | pref | json | a grading screen setting | app/display.js, app/gradesheet.js, app/paper.js, app/start.js, marking.js |
| `gs.enterNext` | students | pref | json | a grading screen setting | (no longer in the source) |
| `gs.exCopied` | students | pref | json | a grading screen setting | examples.js |
| `gs.focusRun` | students | pref | json | a grading screen setting | focus.js |
| `gs.fullSide` | students | pref | json | a grading screen setting | app/wiring.js |
| `gs.histOpen` | students | pref | json | a grading screen setting | insight.js |
| `gs.hl` | students | pref | json | a grading screen setting | app/panels.js, app/start.js, stamps.js |
| `gs.hlMode` | students | pref | json | a grading screen setting | marking.js |
| `gs.hlW` | students | pref | json | a grading screen setting | marking.js |
| `gs.impAuto` | students | pref | json | a grading screen setting | imported.js |
| `gs.ink` | students | pref | json | a grading screen setting | app/panels.js, app/start.js, quiz.js, settings.js, stamps.js |
| `gs.listOpen` | students | pref | json | a grading screen setting | app/wiring.js |
| `gs.listPts` | students | pref | json | a grading screen setting | app/panels.js |
| `gs.markKey` | students | pref | json | a grading screen setting | stamps.js |
| `gs.markSizes` | students | pref | json | a grading screen setting | stamps.js |
| `gs.nameFind` | students | pref | json | a grading screen setting | names.js, setupin.js |
| `gs.openSeen` | students | pref | json | a grading screen setting | app/kept.js, intake.js |
| `gs.panels` | students | pref | json | a grading screen setting | app/wiring.js |
| `gs.pctView` | students | pref | json | a grading screen setting | rubrics.js |
| `gs.penSeen` | students | pref | json | a grading screen setting | touch.js |
| `gs.penW` | students | pref | json | a grading screen setting | app/panels.js, app/start.js |
| `gs.press` | students | pref | json | a grading screen setting | marking.js, touch.js |
| `gs.ptsInk` | students | pref | json | a grading screen setting | app/start.js |
| `gs.qmCopySeen` | students | pref | json | a grading screen setting | quiz.js |
| `gs.qmNoteAs` | students | pref | json | a grading screen setting | quiz.js |
| `gs.qmSize` | students | pref | json | a grading screen setting | quiz.js |
| `gs.qmWords` | students | pref | json | a grading screen setting | quiz.js |
| `gs.rate` | students | pref | json | a grading screen setting | app/media.js, video.js |
| `gs.rdOpen` | students | pref | json | a grading screen setting | app/student.js |
| `gs.recentStamps` | students | pref | json | a grading screen setting | stamps.js |
| `gs.refH.<id>` | students | pref | json | a grading screen setting | app/readings.js |
| `gs.refOpen.<id>` | students | pref | json | a grading screen setting | app/readings.js |
| `gs.refZoom.<id>` | students | pref | json | a grading screen setting | app/readings.js |
| `gs.sheetall` | students | pref | json | a grading screen setting | app/gradesheet.js |
| `gs.solo` | students | pref | json | a grading screen setting | solo.js |
| `gs.sp` | students | pref | json | a grading screen setting | sidepane.js |
| `gs.spsize` | students | pref | json | a grading screen setting | app/scansplit.js |
| `gs.tdBy` | students | pref | json | a grading screen setting | todo.js |
| `gs.tnTime` | students | pref | json | a grading screen setting | typednotes.js |
| `gs.touch` | students | pref | json | a grading screen setting | touch.js |
| `gs.trCap` | students | pref | json | a grading screen setting | app/media.js |
| `gs.vidH` | students | pref | json | a grading screen setting | sidepane.js, video.js |
| `gs.wordPdf` | students | pref | json | a grading screen setting | wordpdf.js |
| `gs.xall` | students | pref | json | a grading screen setting | app/export.js |
| `gs.xcU` | students | pref | json | a grading screen setting | grades.js |
| `gs.xearly` | students | pref | json | a grading screen setting | app/export.js |
| `gs.xedit` | students | pref | json | a grading screen setting | app/export.js |
| `gs.xfb` | students | pref | json | a grading screen setting | app/export.js, feedback.js |
| `gs.xnames` | students | pref | json | a grading screen setting | app/export.js, setupin.js |
| `gs.xone` | students | pref | json | a grading screen setting | app/export.js, setupin.js |
| `gs.xopts` | students | pref | json | a grading screen setting | app/export.js |
| `gs.zoom` | students | pref | json | a grading screen setting | app/display.js, app/panels.js, app/start.js |

### The Planner side (planning)

| Key | Side | Kind | Format | What it holds | Named in (src/) |
|---|---|---|---|---|---|
| `gs.school` | planning | work | json | the school: calendar, links, documents list | folder.js, merge.js, newyear.js, planner/links.js, school.js, takehome.js |
| `gs.mblinks` | planning | work | json | ManageBac links per class | app/screens.js, planner/lessons.js |
| `gsp.taughtIn` | planning | work | json | which lesson was taught in which period | app/drive.js, phone.js, planner/present.js |
| `gsp.planTime` | planning | work | json | time spent planning, per day | app/drive.js, focus.js, planner/plantime.js, planner/plfocus.js, tracker.js |
| `gsp.timeCount` | planning | pref | json | whether Planner time counts | planner/plantime.js, planner/plfocus.js, tracker.js |
| `gsp.newYear` | planning | work | json | a new school year under way in the Planner | newyear.js, planner/units.js |
| `gsp.focusGo` | planning | pref | json | the Planner focus timer: what to start | focus.js, planner/plfocus.js, takehome.js |
| `gsp.focusQ` | planning | pref | json | the Planner focus timer: the queue | focus.js, planner/plfocus.js, takehome.js |
| `gsp.focusRun` | planning | coord | json | the Planner focus timer: a session running | focus.js, planner/plfocus.js, takehome.js |
| `gsp.panel` | planning | pref | json | the Planner side panel | planner/panel.js, setupin.js |
| `gsp.presentBig` | planning | pref | json | Present: text size | planner/present.js |
| `gsp.presentOwn` | planning | pref | json | Present: own window | planner/present.js |
| `gsp.presentSound` | planning | pref | json | Present: timer sound | planner/present.js |
| `gsp.presentTimer` | planning | pref | json | Present: timer length | planner/present.js |
| `gsp.railLib` | planning | pref | json | the Planner sidebar’s Library group open | planner/plannext.js |
| `gsp.view` | planning | pref | json | the Planner’s last view | planner/lessons.js |
| `gs.words` | planning | work | json | the teacher’s own words: assistant names and links, terms | app/library.js, beside.js, planner/lessons.js |
| `gs.theme` | planning | pref | json | light or dark (kept apart from the sample on purpose) | app.html, app/start.js, planner/base.js, planner/planner.html, samplemode.js |
| `gs.look` | planning | pref | json | the new app’s theme: graphite, porcelain, ocean, ink, plum or midnight (written by the new app only) | (no longer in the source) |
| `gs.lang` | planning | pref | json | the language (kept apart from the sample on purpose) | lang.js, samplemode.js |
| `gs.gEmail` | planning | pref | text | the Google account signed in | app/drive.js, mail.js, planner/pldrive.js |
| `gs.gcid` | planning | pref | text | a Google Client ID of the teacher’s own | app/drive.js, planner/pldrive.js |
| `gs.gAuto` | planning | pref | json | Google sign-in: renew by itself | app/drive.js |
| `gs.gPaperDir` | planning | pref | json | Drive folder papers come from | app/drive.js |
| `gs.gVidDir` | planning | pref | json | Drive folder videos come from | app/drive.js |
| `gs.planBig` | planning | pref | json | Today: lesson plans shown large | app/drive.js, phone.js, today.js |
| `gs.planCopy` | planning | cache | json | Today: a copy of the week’s plans for the phone | app/drive.js, today.js |
| `gs.planSeen` | planning | pref | json | Today: plans seen | app/drive.js |
| `gs.mailApp` | planning | pref | json | which mail app the email buttons open | mail.js |

### Neither side (shared)

| Key | Side | Kind | Format | What it holds | Named in (src/) |
|---|---|---|---|---|---|
| `gs.cloudP` | shared | coord | json | Drive sync: what is waiting to go up | app/drive.js |
| `gs.syncAt` | shared | coord | json | Drive sync: when it last ran | app/drive.js |
| `gs.phone` | shared | pref | json | phone layout chosen | mail.js, phone.js |
| `gs.phCls` | shared | pref | json | phone: last class | phone.js |
| `gs.sampleOn` | shared | coord | text | the sample is open (src/samplemode.js) | samplemode.js, visits.js |
| `gs.sampleLeft` | shared | coord | text | the sample was left and is being cleared | samplemode.js |
| `gs.sampleBuilt` | shared | coord | text | the sample has been filled in | sample.js, samplemode.js |
| `gsc.saved.<id>` | shared | coord | text | which window saved this download last (src/saving.js) | newyear.js, saving.js, takehome.js |
| `gsc.forgot.<id>` | shared | coord | text | when this download was last forgotten here | newyear.js, saving.js, takehome.js |
| `gsc.saving.<id>` | shared | coord | text | a window still saving before another replaces everything | saving.js |
| `gsc.over` | shared | coord | text | one window is replacing everything; the others stop writing | saving.js |
| `gsc.finish` | shared | coord | text | the others are asked to save what is half typed | saving.js |
| `gsc.win` | shared | coord | text | after a put-back, this browser’s copy wins a folder merge | folder.js, takehome.js |
| `gsc.dev` | shared | coord | text | this browser’s own id, for merges | folder.js |
| `gsc.folderLater` | shared | pref | text | the folder reminder put off | safe.js |
| `gsc.moveSeen` | shared | pref | text | the address-move notice seen | moving.js |
| `gsc.bankUnit` | shared | pref | text | the rubric bank’s last unit | rubrics.js |
| `gsc.counted` | shared | coord | text | this browser was counted today (src/visits.js) | visits.js |
| `gsm.try` | shared | coord | text | a data-format update under way (src/migrate.js) | migrate.js |

### sessionStorage

| Key | Side | Kind | Format | What it holds | Named in (src/) |
|---|---|---|---|---|---|
| `gs.gTok` | planning | coord | json | the Google sign-in token | app/drive.js, planner/pldrive.js |
| `gs.gState` | shared | coord | json | the Google sign-in step under way | app/drive.js |
| `gs.gQuiet` | shared | coord | json | Google sign-in: renew without asking | app/drive.js |
| `gs.goHome` | shared | coord | json | open Home after the reload | app/screens.js |
| `gs.pickedUp` | students | coord | json | a download picked up after the reload | app/keep.js |

## IndexedDB

| Database | Version | Side | Opened by | Store | Keyed by | What it holds |
|---|---|---|---|---|---|---|
| `grading-studio-keep` | 2 | students | src/app/kept.js keepDb | `papers` | download id, or "id|i|n" for the pieces of a big one | the files as opened: bytes |
| `grading-studio-keep` | 2 | students | src/app/kept.js keepDb | `work` | download id (gs.b.<hash>) | the full copy of marks and scores |
| `grading-studio-keep` | 2 | students | src/app/kept.js keepDb | `meta` | download id | a small summary per download for the list |
| `grading-studio-keep` | 2 | students | src/app/kept.js keepDb | `edits` | "id|path" | Word papers edited in the app: { data, orig, t } |
| `grading-studio-added` | 1 | students | src/app/kept.js addDb | `files` | "download id|student key|path" | late or forgotten files added to a submission |
| `grading-studio-examples` | 1 | students | src/examples.js exDb, src/watch.js | `ex` | record id ("watch:1" is the watch list) | strong examples taken from papers; the watch list |
| `grading-studio-examples` | 1 | students | src/examples.js exDb, src/watch.js | `pix` | "id|n" | the examples’ pictures |
| `grading-studio-videos` | 1 | students | src/video.js | `v` | video id | student videos downloaded for offline: { id, name, type, size, at, blob } |
| `grading-studio-safety` | 1 | students | src/migrate.js | `meta` | copy id | safety copies made before a data-format update |
| `grading-studio-safety` | 1 | students | src/migrate.js | `data` | "id" and "id|n" slices | what each safety copy holds (student work) |
| `grading-studio-school` | 1 | planning | src/school.js | `files` | content hash | school documents: { data } |
| `gs-lessons` | 1 | planning | src/planner/lessons.js lDb | `lessons` | inline: id | one record per lesson |
| `gs-lessons` | 1 | planning | src/planner/lessons.js lDb | `kv` | setup, units, bank, bankFiles, activities, words, deflook, cbox, dir, pdfs, profMod, yearsDone, syncGoneFiles, nb:<id>, file:<id>, pdf:<id>, pdfpg:<id>, ver:<lesson id> … | everything else the Planner keeps |
| `grading-studio-folder` | 1 | shared | src/folder.js | `kv` | "dir" | the linked folder’s handle |
| `grading-studio-models` | 1 | shared | src/app/readings.js (a worker) | `files` | model file url | speech and handwriting model files: a cache |

## CacheStorage

| Cache | Side | Kind | What it holds |
|---|---|---|---|
| `gs-lesson-pictures` | planning | cache | slide pictures kept for the phone (src/phone.js) |

The service worker's caches (`gs-app-1`, `gs-next-1`, `gs-kept-1`) hold the pages, not work: see next/docs/sw.md.

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
  `classListsForPlanning`, `classesForHome`, `countsForHome`, `examplesForPlanning`, `rosterNamesForPresent`, and since stage 3 `todoCountForSidebar` (the sidebar's To do count) `workForCalendar` (assignment names and due days, and the teacher's own to-dos, for the calendar), and since stage 8 `todoCountsForSchool` (how many open to-dos name each School person: ids and counts only).
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
`gs-plan-out` so the grading page starts its Drive sync. Saving the timetable (`saveKv('setup')`) also writes `timetable.json` there (the setup without the slide template), and
saving the teacher's own activities (`saveKv('activities')`) writes `activities.json`, both as the current Planner writes them.
Without permission this session they are left for the current Planner, which writes both on its next save of them.

**Not yet.** Sending the sync file to Drive and taking in what comes back, reading a folder changed elsewhere, and the paper and
reading files in the folder come before the switch, in stage 6. Until then the current app does them as soon as it is opened, so nothing is lost.

**Strong examples on slides, by reference (stage 3).** In the current Planner a strong example put on a slide is copied into the
lesson as an ordinary picture (src/planner/plexamples.js), so it travels wherever the lesson goes. In the new app the picture stays
in `grading-studio-examples` and the slide keeps only which example it is:

    slide.img = { src: "gsex:<example id>|<page, from 0>", w, h, source: "" }

The new app draws it from the examples database each time (crossings.js `examplePictureForSlide`; app/plan/examples.js). Everywhere
the lesson leaves this browser, only the reference goes: the lesson's file in the Planner folder (the reference as text, no file
in `images/`), the message for the assistant (`[Picture]`, and the picture is not counted among those to attach), the .pptx (the
slide without its picture), Drive sync and a shared lesson. The current Planner draws such a slide with an empty picture
(`imgSrc` gives '' for it), writes the reference on unchanged, and drops it when it reads a shared lesson file. Lessons that already
hold a copied picture are left as they are. `examplesForPlanning` hands over only what names an example the way grading does
(assignment, Example A, Question 3), never whose it was, and never the watch list.
