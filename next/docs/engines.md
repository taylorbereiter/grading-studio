# Engines: what is kept, where it lives today, and how to lift it

Stage 0, item 6. No code moves in stage 0. This lists each engine the rebuild keeps, so stages 3 to 5 can lift it out of the old
shared scope into ES modules that both the current app and `next/` can import.

How the current code is put together (build.js): `src/migrate.js` runs first, then everything else runs inside `gsData.boot(...)`
as one shared scope: `src/lang.js`, `helpdata`, `pickshare`, `beside`, `gpick`, then the `src/app/*.js` files in the order of
`src/app/order.json` (start, open, keep, draw, files, student, arrange, paper, panels, dialogs, export, gradesheet, claude, drive,
media, readings, libundo, library, screens, kept, replace, display, anon, calc, lighting, word, wordrubric, scansplit, bringin,
wiring), then about 75 `src/*.js` files. Any top-level name in any file is visible to every other file. The Planner page is built
the same way from `src/planner/*.js` plus a few shared files (`beside`, `pickshare`, `gpick`, `lang`, `helpdata`, `fullscreen`,
`mail`, `lofi`).

Line counts are `wc -l` on 2026-11-17. "Globals" means names an engine reads or writes that are defined in another file.
DOM touch points are marked **core** (the engine needs it to do its job, such as a canvas to draw on) or **UI** (a dialog,
a button, a toast: it moves to the screen layer).

## The shared globals every engine leans on

Most engines reach into the same handful of names. Each one becomes an explicit parameter or an imported module.

| Global | Defined in | What it is |
|---|---|---|
| `batch` | src/app/start.js:193 | The open download: `{ id, name, students: [...], quiz, groups, light, ... }`. Read or written by nearly every grading engine. |
| `cur` | src/app/start.js:194 | Index of the open student in `batch.students`. |
| `setup` | src/app/start.js:89 | The open assignment's rubric/points setup (`setupOver(store.get('gs.setup'))`, then replaced per download). |
| `lib` | src/app/library.js:17 | Classes, units, rosters, gradebook settings (`gs.lib`). Saved by `saveLib()`. |
| `store` | src/app/start.js:41 | `get/set/del` over localStorage with JSON, never throws. |
| `pages`, `docs`, `docMap` | src/app/student.js:2-4 | On-screen page objects, pdf.js documents and path→document map for the open student. |
| `tool`, `selected`, `undoStack`, `inkColor`, `hlColor`, `penW`, `zoom`, `disp`, `bank`, `COLORS` | src/app/start.js:195-229 | Pen state, selection, undo, ink colours, Display settings, saved comments. |
| `saveSoon`, `saveNow`, `restore` | src/app/keep.js | Debounced save of `batch` into one work record; `saveNow` is the work-record serializer. |
| `toast`, `openDlg`, `closeDlg`, `$`, `esc` | wiring.js, dialogs.js, start.js | UI helpers used inside engine code. |
| `keepDb`, `kget`, `kdo`, `idbDo`, `keptMeta`, `paperGet`, `paperPut` | src/app/kept.js | IndexedDB `grading-studio-keep` (papers, work, meta, edits) and `grading-studio-added`. |
| `fileByPath`, `layoutOf`, `docIn`, `rotOf`, `skewOf`, `vpDraw` | src/app/files.js | Where each file and page sits for a student. |
| `rosterNames`, `rosterPairs`, `rosterMatch` | anon.js, screens.js | Roster name matching. |
| `pdfjsLib`, `PDFLib`, `fflate`, `mammoth`, `html2canvas` | inlined by build.js | Third-party libraries as page globals. |
| `tr`, `LANG_LOCALE` | src/lang.js | Translate a drawn string; locale for dates. |
| `window.__gs` | src/app/wiring.js:322 (+ phone, focus, gradeplan, snip) | The test seam: tests call engine functions through it (`__gs.state()` alone is used 1133 times in tests). |

## Paper drawing and ink

- **Files:** src/app/draw.js (224), src/marking.js (435), src/stamps.js (483), src/app/paper.js (508), src/app/student.js (189),
  src/app/arrange.js (289), src/app/files.js (129), src/app/lighting.js (269), src/imported.js (292). About 2,800 lines.
- **Main functions:** `drawMarks`, `layoutNotes`, `wrapText`, `textLayout`, `hitMark`, `bboxOf` (draw.js); `strokePath`, `inkBegin/Move/End`,
  `hlBegin/Move/End`, `snapRects`, `lineAt`, `wordAt`, `strokeHit` (marking.js); `drawStamp`, `placeStamp`, `keyRows`, `stampScore` (stamps.js);
  `pushUndo`, `undo`, `redo`, `turnPages`, `reshape`, `moveMark`, `eraseAt` (paper.js); `openStudent` (student.js); `lightLut`, `lightCanvas`,
  `lightApply` (lighting.js); `impMarks`, `impConvert` (imported.js: Kami/Acrobat annotations into own marks).
- **Globals:** `batch`, `cur`, `pages`, `tool` (48 uses), `selected` (62), `undoStack`, `inkColor`, `hlColor`, `penW`, `COLORS`, `disp`, `zoom`,
  `bank`, `store` (`gs.ink`, `gs.hl`, `gs.penW`, sizes), `saveSoon`, `renderList`, `renderTools`, `toast`. draw.js reads `batch.quiz` inside
  `ansLab` through a `typeof batch` check.
- **DOM:** core: canvas 2D everywhere; `measureCtx = document.createElement('canvas').getContext('2d')` runs at load (draw.js:3);
  pdf.js page render; `viewWorker()` (student.js). UI: `$('#paper')`, `#tools`, pointer handlers, text-box editors (`activeEditor`), about 90
  `getElementById`/`querySelector` calls across the set.
- **Tests:** marking, marks-resize, stamps, mark-key, mark-colors, comment-colors, rightclick-tools, undo, page-lighting, pop-on-top,
  early-marks, touch, imported-marks, paper-first, marking-screen. All browser tests through `window.__gs`.
- **Lift:** split. The drawing half (`drawMarks`, `layoutNotes`, `strokePath`, `drawStamp`, `drawHls`, lighting LUTs) is clean once
  `measureCtx` is created lazily and `ansLab` takes the quiz as an argument; it is shared by screen and export, so it must be one module.
  The input half (paper.js, the begin/move/end handlers, student.js) is tangled: it mutates `batch`, `selected`, `undoStack` and the DOM
  together. Marks are stored as plain objects (`{ t: 'pen', pts, ... }`, `{ t: 'hl', ... }`, `{ t: 'stamp', k, x, y, size }`), which is what
  makes the drawing half liftable.

## Export

- **Files:** src/app/export.js (416), src/feedback.js (166), src/exportreport.js (31), src/marksout.js (204), src/anchors.js (129). About 950 lines.
- **Main functions:** `exportPlan`, `nameOut`, `outStem`, `flattenDoc(st, d, dpi, edit, key, fb, tn)`, `exportOne`, `openExport`, `saveBlob`;
  `fbData`, `fbBlocks`, `fbPages`, `fbAddPages` (the feedback first page); `exportWhy`, `exportReport`, `canvasJpg`; `makeMarksFile`,
  `marksFileText` (Markdown of marks for an assistant).
- **Globals:** `batch` (61), `setup` (20), `pages`, `docs`, `fileByPath`, `layoutOf`, `docIn`, `rotOf`, `skewOf`, `vpDraw`, `gradeOf`, `rowTop`,
  `rosterNames`, `asgName()` (reads `batch.assignment` and `findItem`), `marksMine`, `keyRows`, `viewBytes`, `wordPagesPdf`, `tr` (16:
  drawn text is translated), `store` (`gs.xfb` and others), `saveNow`, `toast`.
- **DOM:** core: an offscreen `<canvas>` per flattened page (export.js:144, :177), `c.toBlob` (`canvasJpg`). UI: `openExport` dialog, `saveBlob`
  makes an `<a download>` and clicks it, or uses the `downloads` capability (`downloadsP`).
- **Tests:** export, export-names, export-report, one-pdf, one-student-export, feedback, feedback-complete, marks-export, anchors,
  fresh-marks, early-marks.
- **Lift:** fairly clean. `flattenDoc` already takes the student and document; it needs `setup`, the page-layout helpers and a canvas
  factory passed in, and `saveBlob` stays in the UI. `exportPlan`/`nameOut` need the roster names and assignment name as arguments.

## Grade maths

- **Files:** src/app/start.js lines 58-190 (scales, points, percents, tries, extra credit), src/grades.js (398), src/book.js (834: gradebook
  maths in lines 60-170), src/ib.js (605), src/rubrics.js (721: levels, stats in `classStats`, `spreadBins`, `pctMean`, `pctMed`),
  src/app/calc.js (172: `calcEval`), src/app/library.js (`gradeWay`, `bandOf`).
- **Main functions:** `rowTop`, `rowSteps`, `setupMax`, `setupOver`, `rowScaleOf`, `pointsWith`, `percentWith`, `percentFor`, `pointsFor`,
  `roundPct`, `gradeOf`, `scoreOf`, `ownGrade`, `tryGrade`, `withTries`, `retakeRule`, `addXc` (start.js); `noScore`, `setStatus`, `csvSafe`,
  `csvCell`, `tsvLine`, `gradesSummary`, `exportCheck`, `readingDoubt` (grades.js); `bkCellOf`, `bkTypedCell`, `bkClassCols`, `bkGrade`,
  `bkTermOf`, `bkMean`, `bkCounts` (book.js); `ibSetup` and the IB boundaries (ib.js); `calcEval` (calc.js).
- **Globals:** `setup` (read by `maxPoints`, `percentFor`, `pointsFor`, `ownGrade`, `ibSetup`), `lib.book.retake` (`retakeRule`),
  `SCALE12`, `SCALE_FIVES`, `RUBRIC_STEPS`; `ownGrade` calls `wordPart` (grades.js) and `quizPart` (quiz.js); `bkLoad` reads `keptMeta`,
  `earlierWork`, `cardOfKept`, `lib.classes`; `bkDay` reads `LANG_LOCALE`.
- **DOM:** none in the maths. book.js, grades.js and rubrics.js also hold their screens (book.js alone has the gradebook box, tabs, cells and
  paste handling), so the files are mixed even though the functions are not.
- **Tests:** grades, scores, average, percents, percent-score, row-scale, retakes, extra-credit, calculator, rubric-rule, rubric-fixes,
  rubrics, book, book-import, categories, ib, insight.
- **Lift:** clean for the functions, by cutting along function lines inside mixed files. The one real seam is the module-level `setup`:
  `percentFor(total)` becomes `percentFor(total, setup)`. The `*With` variants (`percentWith(total, max, scale)`) already take everything.

## Scan split and scan fixes

- **Files:** src/app/scansplit.js (355), src/scans.js (594). About 950 lines.
- **Main functions:** `openSplit(file, assignment, into)`, `splitGuess`, `splitPick`, `splitGive`, `splitIntoNames`, `rasterInto`, `splitGo`
  (scansplit.js); `scanInk`, `scanSharp`, `scanTilt`, `scanSolid`, `scanLevel`, `scanGrain`, `scanUp`, `scanFaintLines`, `scanRead`,
  `scanCheck`, `scanTurn`, `scanStraighten`, `scanLight`, `skewMarks` (scans.js).
- **Globals:** the module state `SP` (scansplit.js:2, `{ name, data, doc, n, thumbs, owner, more, skip, sel, ... }`), `batch` (51), `pages`,
  `lib.classes`, `classById`, `batchClass`, `rosterMatch`, `addFiles`, `saveSoon`, `store` (`gs.spsize`), `workerReady`.
- **DOM:** core: canvases for thumbnails and ink (`splitInk`, `rasterInto`); scans.js lines 7-197 work on grey-level arrays only. UI: the
  split shell (`splitShell`, `#spBig`, drag of pages onto names, keyboard).
- **Tests:** scans, scan-groups, quiz-scan (split pages by code), early-marks, legacy.
- **Lift:** scans.js pixel analysis is clean (pure arrays in, numbers out). The split itself is tangled: the model (`SP`), the page
  rendering and the drag UI share one object. Lift `splitGuess`/`splitPick`/owner bookkeeping and `splitGo`'s PDF writing as a model; leave
  the shell to the new screen.

## Quiz making and reading (Quick mark, Make a quiz)

- **Files:** src/quiz.js (1124), src/quizmake.js (163), src/quizread.js (270). About 1,560 lines.
- **Main functions:** `quizOn`, `quizScore`, `quizSum`, `quizPart`, `qzRect`, `qzCrop`, `qzAns*`, `openQuizBoxes`, `openQuiz`, `qmMark`
  (quiz.js); `qmkNew`, `qmkLayout`, `qmkBoxes`, `qmkPages`, `qmkPrint` (quizmake.js); `qrGrey`, `qrFind`, `qrH` (homography), `qrCode`,
  `qrPageCode`, `qrDecide`, `qrScoreOf`, `qrReadAll`, `qrScanIn` (quizread.js).
- **Globals:** `batch.quiz` (quiz.js says the shape at the top), `batch` (124 uses), `pages`, `fileByPath`, `percentFor`, `COLORS`, `inkColor`,
  `keptMeta`, `saveSoon`, `redrawAll`, `renderList`, `renderGrade`, `toast`, `tr`. quizmake reads `it.quiz.made` on the assignment card in `lib`.
- **DOM:** core: canvas to grey levels (`qrGrey`, `qrPageCode` renders a pdf.js page), crop canvases for answer pictures. UI: the Quick mark
  board (quiz.js `qm*` functions, about 600 lines), printing (`qmkPrint` opens a print window).
- **Tests:** quickmark, quiz-marking, quiz-scan, answer-notes, answer-place, copy-answer, points-colors.
- **Lift:** quizread decoding (`qrFind`, `qrH`, `qrCode`, `qrDecide`, `qrScoreOf`) and quizmake layout are clean. quiz.js scoring
  (`quizScore`, `quizSum`, `quizPart`) is clean given the student and `batch.quiz`. The Quick mark board is tangled UI and is rebuilt.

## Word papers

- **Files:** src/app/word.js (329), src/app/wordrubric.js (265), src/wordnotes.js (299), src/wordpdf.js (337), src/rubricup.js (139). About 1,370 lines.
- **Main functions:** `openWord(bytes)`, `wordBytes(w)`, `renderWord`, `wToggle`, `wSetText`, `wShadeCell`, `keepEdit`, `loadEdits` (word.js);
  `rubricModel`, `rubricScore`, `wordScore`, `wordScoresAll`, `wordTableRead` (wordrubric.js); `wComments`, `wCommentAdd`, `wCommentDrop`,
  `wCommentMap` (wordnotes.js); `wordToPdf`, `wordPagesPdf`, `wordPdfWrite` (wordpdf.js); `ruFromWord`, `ruFromPdf`, `rubricRead` (rubricup.js).
- **Globals:** `setup` (30: the rubric a Word table fills), `batch`, `cur`, `bank`, `store`, `kget`/`idbDo` (the `edits` store), `addFiles`,
  `saveSoon`, `saveLib`, `fflate`, `PDFLib` (34), `html2canvas`, `mammoth` (media.js `docxHtml`).
- **DOM:** core: `DOMParser` for the XML (works in a page, not in a worker); wordpdf draws the rendered Word page in the live document and
  photographs it with `html2canvas` (wordpdf.js:228). UI: `renderWord` builds the document view, `wireWordNotes` the comment margin.
- **Tests:** word-comments, word-pdf, rubric-fixes, final-fixes, reading, scores, video-files (rubric bring-in).
- **Lift:** `openWord`/`wordBytes`/wordnotes XML and wordrubric's table reading are clean (bytes and XML in, bytes out). wordpdf is
  DOM-bound by design (it needs layout) and lifts last, as a function that is given a host element.

## Merge

- **Files:** src/merge.js (948). Its own header: "nothing here touches the page or storage".
- **Main functions:** `mergeWork`, `mergeScan`, `mergeStates`, `mergeFiles`, `mergeEdits`, `mergeLib`, `mergeLs`, `stampData`, `revsOf`,
  `stampLib`, `tabMerge`, `tabDiffers`, `todoMerge`, `typedMerge`, `mergePlan`, `schoolMerge`, `focusMerge`, `planTimeMerge`, `taughtInMerge`,
  `exMergePlan` lives in examples.js, not here.
- **Globals:** none required. Uses `typeof rowsMax === 'function'` as an optional hook (merge.js:127), `Date.now()` as a default for `o.now`.
- **DOM:** none.
- **Tests:** merge, merged, drive-sync (typedMerge, mergePlan), goals (mergeLib), todo (todoMerge). These load the file with
  `vm.runInNewContext` and no browser, so they already prove it runs alone.
- **Lift:** clean. Add `export` lines and keep the file. First to move.

## Migrate (saved-data versions and safety copies)

- **Files:** src/migrate.js (241), src/samplemode.js (79, the sample's storage renaming, runs before it).
- **Main functions:** `gsData.boot`, `snapshot`, `snapshots`, `readCopy`, `putBack`, `putBackData`, `forget`, `version`. `MIGRATIONS` is
  empty today (`DATA_V` is 1): no format step has ever been needed.
- **Globals:** none from the app (it runs first). Reads localStorage `gs.*`, `gs.dataV`, `gsm.try`; IndexedDB `grading-studio-safety`
  and the `STORES` list (keep: work, meta, edits; added: files; examples: ex, pix).
- **DOM:** UI only: `#bootNote` and a "Stop and put my work back" button (migrate.js:223-233).
- **Tests:** migrate, legacy, storage, folder, takehome.
- **Lift:** clean. Already an IIFE returning an object. Move the two DOM lines behind a callback. Note that STORES is not the full list
  of stores (videos, school, folder, models and gs-lessons are not in it); the stage 0 saved-work layer owns the full list.

## Folder saving, saving and the take-home file

- **Files:** src/folder.js (670), src/saving.js (199), src/app/keep.js (93), src/app/kept.js (269), src/takehome.js (588), src/newyear.js (378).
  About 2,200 lines.
- **Main functions:** `folderState`, `folderRun`, `folderKick`, `pushDownload`, `pushLibrary`, `folderSnapshot`, `dailySnapshot`, `folderGoBack`,
  `folderReconcile`, `reconcileNow`, `papersMirror`, `folderPick`, `folderBoot` (folder.js); `writeWork`, `saveResult`, `tabStamp`, `tabLive`,
  `tabsCatchUp`, `tabForgot` (saving.js); `saveSoon`, `saveNow`, `restore` (keep.js); `keepDb`, `paperPut`, `paperGet`, `keepWork`, `loadKept`,
  `addFiles` (kept.js); `takeKey`, `takeWrite(sink, pass, ...)`, `takeOpen(file, pass)`, `takeScan`, `bringPlan`, `bringApply`, `restoreBackup`
  (takehome.js); `nyArchive`, `nyCheck`, `nyRun` (newyear.js).
- **Globals:** `batch` (140), `lib` (33), `store` (55), localStorage directly (43), `gsData` (19), `kdo`, `idbDo`, `keptMeta`, `exTakeFrames`,
  `planLs`, `crypto.subtle`, `fflate`; folder.js keeps its own state in `fld` (`fld.root`, `fld.state`, `fld.work`, `fld.info`).
  `saveNow` in keep.js is the serializer from `batch` to a stored work record, and `writeWork` (saving.js:15) then calls `folderSaved`.
- **DOM:** core: `showDirectoryPicker` and FileSystem handles (folder.js), IndexedDB `grading-studio-folder` (kv, holds the handle).
  UI: Home's folder ask, `renderWhere`, `openWhere`, `openTake`, `showConflicts`, the New year box (about 60 `getElementById`).
- **Tests:** folder, folder-copies, saving, storage, safe, takehome, takehome-big (manual, 600 MB), carry-seams, final-fixes, newyear,
  save-reopen, plus `npm run saved-work`.
- **Lift:** takehome's file format (`takeKey`, `takeWrite`, `takeOpen`, `takeScan`) is clean: it already takes a sink and a file. folder.js is
  medium: the file-system work is separable, but it reads `batch` and `lib` to know what to mirror. keep.js `saveNow`/`restore` is tangled
  with the live `batch`, and the new app needs its own writer that produces the same record (the stage 0 saved-work layer's job).

## Drive (sync and picker)

- **Files:** src/app/drive.js (675), src/gpick.js (110), src/planner/pldrive.js (33). The phone's sync hooks are in src/phone.js.
- **Main functions:** `gToken`, `gRenew`, `gfetch`, `signIn`, `signOut`, `loadGis`, `gRedirect` (sign-in); `syncSoon`, `syncNow`, `syncOnce`,
  `syncRead`, `syncWrite`, `syncDecide`, `syncPull`, `syncLeave` (appdata sync of the library and settings); `dvPut`, `dvGet`, `dvSend`, `dvUp`,
  `dvPull` (papers in Drive for other devices); `planFileRead`, `planFileWrite`, `planSync`, `planApply` (Planner sync); `drivePick`,
  `driveVideos`, `driveBytes`, `openFromDrive`, `saveToDrive`; `gpKinds`, `gpLoadPicker`, `gpPick(token, cid, key, o)`, `gpOn`, `gpDrv`
  (gpick.js); `plToken`, `gpHost` (pldrive.js).
- **Globals:** `G` (token state), `store` (40: `gs.gEmail`, `gs.gcid`, `gs.gVidDir`, cloud lists), `lib`, `libVer`, `bank`, `batch`,
  `kget`, `idbDo`, `paperPut`, `mergeLib` and friends from merge.js, `sampleOn`, `PHONE`, `phMoreRender`, `sessionStorage` (`gs.gTok`,
  `gs.gState`), `location` (redirect sign-in on iPhone), the build constants `'/*@@GCID@@*/'` and `'/*@@GKEY@@*/'`.
- **DOM:** core: Google Identity Services script tag, Google's Picker (loaded by gpick.js), `document.visibilityState`. UI: `renderGoogle`,
  `driveSetup`, sync state in the sidebar.
- **Tests:** drive-sync, drive-everywhere, drive-videos (all with a fake Google server).
- **Lift:** medium. The HTTP and merge parts (`gfetch`, `syncOnce`, `planSync`, `dvPut/dvGet`) can take a token function and storage
  accessors. Sign-in is tied to page load (the redirect token is read from `location.hash` at load, drive.js:17-24) and must run in whichever
  page Google returns to. Note: `GOOGLE_API_KEY` is never filled by build.js; `gpPick` skips a key that still holds `@@`, so it works,
  but the new build should either fill it or drop it.

## Video, readings and transcripts

- **Files:** src/video.js (953), src/app/media.js (232), src/app/readings.js (349). About 1,530 lines.
- **Main functions:** `linkOf`, `linkClean`, `linkBytes`, `linkKey`, `vkDb`, `vkPut`, `vkGet`, `vkSweep`, `vkFolderSync`, `videoAdd`,
  `partnerCopy`, `clipsOf`, `clipFile`, `frameTime`, `notesPdf` (video.js); `mediaCard`, `trParse`, `trLines`, `trSet`, `docxHtml` (media.js);
  `loadRefs`, `addRefs`, `dropRef`, `whisperWorker`, `asrCall`, `decodeAudio`, `planChunks`, `transcribe`, `transcribeFile` (readings.js).
- **Globals:** `batch` (64), `cur`, `openStudent` (13), `addFiles`, `batchIdOf`, `store`, `saveSoon`, `gToken` (Drive videos), `refFiles`
  (readings' module state), `curMedia`, `mammoth`, `PDFLib`, `tr`. IndexedDB `grading-studio-videos` (vk*) and `grading-studio-models`
  (cached speech model).
- **DOM:** core: `<video>` elements, `AudioContext` decoding, a Worker built from `whisperWorker.toString()`. UI: the player dock, clip strip,
  partner box, transcript panel (about 130 DOM calls).
- **Tests:** video, video-files, video-dock, drive-videos, transcripts, reading-zoom, typednotes, sidepane.
- **Lift:** link parsing, the video store and transcript parsing are clean; players and the dock are UI. The speech worker imports
  `@huggingface/transformers@3.8.1` from cdn.jsdelivr.net at run time (readings.js:163): the one remote code dependency the app has,
  which the new app's "no other runtime dependencies" rule and its service worker plan must account for.

## Examples and the watch list

- **Files:** src/examples.js (1013), src/watch.js (212), src/planner/plexamples.js (118).
- **Main functions:** `exDb`, `exPut`, `exById`, `exAll`, `exDelete`, `exPics`, `exCovers`, `exJpg`, `exSaveShot`, `exMergePlan`, `exTakeFrames`,
  `exBringPlan`, `exFolderSync`, `exPdfOf`, `openExamples` (examples.js); `wlOf`, `wlKey`, `wlBackfill`, `wlSend`, `wlPdf`, `wlNewYear`
  (watch.js); `plxDb`, `plxRead`, `plxLoad`, `plxToSlides` (the Planner reading the same database).
- **Globals:** `batch` (54), `pages` (40), `fileByPath`, `layoutOf`, `docIn`, `gradeOf`, `routeNow`, `PDFLib`, `pdfjsLib`, `toast`. IndexedDB
  `grading-studio-examples` (stores `ex`, `pix`; watch-list entries are `ex` records with `watch: 1`).
- **DOM:** core: canvas to paint covers and crop (`exuCanvas`, `exuDraw`, `exuCrop`). UI: the Examples page, the Save box, cover editing.
- **Tests:** examples, example-shots, examples-carry, lesson-examples, watch, scan-groups.
- **Lift:** the store and merge (`exDb`..`exAll`, `exMergePlan`, `exTakeFrames`) are clean; picture making needs a canvas; the pages are UI.
  This is a known wall crossing: the Planner reads `grading-studio-examples` (plexamples.js).

## Names and anonymous grading

- **Files:** src/names.js (313), src/app/anon.js (104), src/app/claude.js (565, the share package for an assistant).
- **Main functions:** `latinRx`, `spelledRx`, `spellings`, `altsRx`, `namesNow`, `coverRx`, `fileRx`, `classRx`, `lookForName`, `findNames`,
  `nameWarnings`, `namesInDoubt` (names.js); `anonOrder`, `anonShuffle`, `rosterNames`, `anonCovers`, `setAnon` (anon.js); `scrub`, `scrubMarks`,
  `makeSharePackage`, `parseFeedback`, `openBringBack` (claude.js).
- **Globals:** `batch`, `docs` (pdf.js documents of the open student, for page text), `pages`, `fileByPath`, `store`, `setup`, `lib` (roster),
  `fflate` (ZIP), `anonOn`, `shownName`.
- **DOM:** core: pdf.js text content and a small canvas for ink checks (`pageInk`). UI: name flags, the share box, the anonymous header.
- **Tests:** names, anon-covers, roster-names, long-names, marks-export, assistant, export-names, insight.
- **Lift:** the matching half of names.js (regex building, alternates, `coverRx`) is clean given the list of names; `findNames`/`lookForName`
  need page text passed in rather than read from `docs`. claude.js is mostly UI around a clean ZIP maker.

## Bringing papers in (open, intake, carry-over, replace)

Not on the brief's list, but it is a clear engine and stage 4 needs it.

- **Files:** src/app/open.js (301), src/intake.js (398), src/carryover.js (250), src/app/bringin.js (192), src/app/replace.js (246).
- **Main functions:** `unzipInto`, `intake`, `srcClassroom`, `srcRead`, `batchIdOf`, `makeFile`, `unpackExport`, `imageToPdf`, `hash`, `walkEntry`
  (open.js); `realType`, `trueKind`, `pictureToPdf`, `heicToPdf`, `checkFile`, `troubleOf`, `openingReport`, `markLate` (intake.js);
  `earlierWork`, `findEarlier`, `carryInto`, `carryScan`, `compareFiles` (carryover.js); `bringIn`, `sortGuess`, `matchToRoster`, `guessAmong`
  (bringin.js); `removeFile`, `bringBack`, `replaceFile`, `replaceDo` (replace.js).
- **Globals:** `batch` (116), `cur`, `setup`, `lib`, `pages`, `kget`, `kdo`, `idbDo`, `paperGet`, `keptMeta`, `saveNow` (12), `pushUndo`, `addFiles`,
  `openStudent`, `fflate`, `pdfjsLib`, `PDFLib`, the HEIC decoder (`heicLoad`, inlined by build.js).
- **DOM:** core: canvas for image to PDF and JPEG turning; drag-and-drop entries (`walkEntry`). UI: the opening report, Replace box.
- **Tests:** intake, carryover, carry-seams, remove-replace, replace-more, rosters, newyear, setupin, save-reopen.
- **Lift:** `realType`, `trueKind`, `unzipInto`, `srcRead` and the carry-over matching are clean; `intake` itself builds `batch` and is tangled.

## Grade sheet (reading grades off papers)

- **Files:** src/app/gradesheet.js (582).
- **Main functions:** `parseGrade(str, strict)`, `scanFile`, `scanAll`, `trimToInk`, `kamiNote`, `foundLabel`, `openSheet`, `buildSheetPdf`.
- **Globals:** `batch`, `setup`, `gradeOf`, `pdfjsLib`, `PDFLib`, `html2canvas`, `store` (`gs.sheetfound`, `gs.sheetall`), module state
  `scanP`, `scanned`, `sheetFound`.
- **DOM:** core: canvases for crops (`trimToInk`). UI: the Grade sheet box.
- **Tests:** reading, grades, crit-stamps, calculator, rosters, scores, word-pdf.
- **Lift:** `parseGrade` and its regexes are clean; `scanFile` needs a pdf.js document passed in.

## Languages (runtime)

- **Files:** src/lang.js (261), src/lang-*.js (eight, 763 to 878 lines each), src/helpdata.js (347, English Help).
- **Main functions:** `langPack`, `unpack85`, `langFill`, `trPiece`, `trWith`, `tr`, `langEl`, the `MutationObserver` over `LANG_ROOTS`.
- **DOM:** core to how it works today: it translates the rendered page. See next/docs/languages.md. The new app does not lift this engine;
  it replaces it with named lines. Only `unpack85` matters while the double-click copy exists.

## Proposed lift order

The plan's stages: 3 Planning, 4 Marking, 5 Class tools, 6 Everything else. Pure maths and formats go first so stage 4 starts with them
ready and tested; the DOM-heavy parts go with the screens that replace them.

**Stage 3 (pure, no DOM; mostly cutting functions out of mixed files):**
1. merge.js whole (already runs in `vm` with no globals).
2. Grade maths: start.js scale/percent/tries/extra-credit functions with `setup` as a parameter; book.js `bkCellOf`, `bkTypedCell`,
   `bkGrade`, `bkTermOf`; grades.js status and CSV helpers; ib.js maths; `calcEval`.
3. migrate.js (`gsData`) with its boot note behind a callback.
4. Formats: takehome.js `takeKey`/`takeWrite`/`takeOpen`/`takeScan`; word.js `openWord`/`wordBytes`; wordnotes.js XML; wordrubric.js
   `rubricModel`/`rubricScore`; quizmake.js layout; marksout.js `marksFileText`; intake.js `realType`/`trueKind`; open.js `unzipInto`/`srcRead`.
5. Image maths: scans.js lines 7-197; quizread.js `qrFind`, `qrH`, `qrCode`, `qrDecide`, `qrScoreOf`; lighting.js `lightLut`.
6. Name matching: names.js regex and alternates; anon.js `anonOrder`/`anonShuffle`.
7. Stores Planning needs: examples read side (`exDb`, `exAll`, the `plx*` reader), gpick.js `gpKinds`/`gpPick` (lesson materials from Drive).

**Stage 4 (browser APIs, no screens: what the marking screen sits on):**
1. Drawing: draw.js, marking.js `strokePath`/hit tests/line snapping, stamps.js `drawStamp`, lighting `lightCanvas`, with a canvas factory
   passed in.
2. Export: `flattenDoc`, feedback.js, exportreport.js, `nameOut`/`exportPlan` with names passed in.
3. The work record: one writer and reader for `batch` records equal to keep.js `saveNow`/`restore` (built on the stage 0 layer), and
   kept.js paper storage.
4. Bringing in: carryover.js matching, intake checks, HEIC/image to PDF.
5. Quiz scoring (`quizScore`, `quizSum`, `quizPart`) and `qrPageCode`/`qrReadAll` with pages passed in.
6. Scan split model and `splitGo`; gradesheet `parseGrade`/`scanFile`.
7. Video store, link parsing, transcript parsing, the speech worker; names.js `findNames` with page text passed in; claude.js package maker.
8. Folder saving and Drive sync hooks (see the note below: needed once the new app writes).

**Stage 5 (DOM-bound engines and what class tools need):**
1. wordpdf.js (needs a host element for layout and html2canvas).
2. book.js loading (`bkLoad`, `bkClassCols`) over the saved-work layer; rubrics.js stats; watch.js.
3. Examples picture making and cover painting (`exCovers`, `exJpg`, `exuDraw`).
4. Whatever input handling from paper.js the new marking screen chose to reuse rather than rewrite.
5. Drive sign-in and the rest of drive.js, takehome.js `bringApply`, newyear.js, unless stage 6 takes them as planned.

**Note that changes the plan:** folder saving (folder.js `folderSaved`, called from saving.js `writeWork`) and Drive sync (`syncSoon`)
run on every save in the current app. If the new app writes lessons in stage 3 or marks in stage 4 without them, those changes are
not mirrored to her folder or her other devices until she opens the old app. Either the new app's writes call the same mirror and
sync from the stage they start writing, or the plan must say that the new app is look-only on a teacher's real work until stage 6.

## Seams to cut

Each of these becomes a parameter, an import, or a callback before its engine can live in a module.

1. `setup` read inside `maxPoints`, `percentFor`, `pointsFor`, `ownGrade`, `scoreOf`, `ibSetup` (start.js, ib.js): pass the setup.
2. `lib.book.retake` read inside `retakeRule` (start.js:136): pass the rule.
3. `batch` and `cur`: every engine function that reads `batch.students[cur]` or `batch.quiz` takes the student or quiz instead
   (draw.js `ansLab`, draw.js:211 `marksMine(..., batch.students[cur])`, quiz.js, export.js `asgName`, scansplit.js `splitIntoNames`).
4. `ownGrade` calling `wordPart` (grades.js) and `quizPart` (quiz.js): pass the two checks or move them into grade maths.
5. `measureCtx` made at load with `document.createElement('canvas')` (draw.js:3): make it lazily, or from `OffscreenCanvas`.
6. `pages`, `docs`, `docMap` (student.js): engines that need page text or pdf.js documents (names.js `lookForName`, gradesheet.js `scanFile`,
   quizread.js) take them as arguments.
7. `store.get/set` with `gs.*` keys inside engines (stamps sizes, `gs.xfb`, `gs.spsize`, `gs.sheetfound`, `gs.ink`): go through the
   saved-work layer's typed accessors.
8. `kget`, `kdo`, `idbDo`, `paperGet`, `paperPut`, `keptMeta` (kept.js): the saved-work layer.
9. `saveSoon`/`saveNow` called from inside engines (grades.js, quiz.js, scans.js, video.js and others): engines return the change, and
   the caller saves.
10. `toast`, `openDlg`, `closeDlg`, `$` inside engine functions: replaced by thrown errors or returned results the screen shows.
11. `tr()` on drawn text (export.js, feedback.js, quiz.js, video.js, typednotes.js and 8 more files, 54 calls): the caller passes a
    `t` function, so drawn text uses named lines too.
12. `pdfjsLib`, `PDFLib`, `fflate`, `mammoth`, `html2canvas` as page globals: imports.
13. `location.hash` and `sessionStorage` read at load in drive.js (redirect sign-in): an explicit `finishSignIn()` the page calls.
14. Module state that is really a model: `SP` (scansplit.js), `refFiles` (readings.js), `fld` (folder.js), `G` (drive.js), `bk` (book.js):
    each becomes an object the module creates and returns, not a top-level `let`.
15. `window.__gs`: the tests' way in. Lifted engines are imported by tests directly; `__gs` stays for the current app until the switch.

## Requirements carried to later stages

- **Stage 6, before the switch: several windows.** The one-writer lock of stage 0 (src/lock.js in the current app, next/src/shared/lock.js in the new one) is an interim. The new app holds the lock "gs-writer" alone, so a second window of the new app, or a window of the current app, cannot write beside it. The teacher runs the installed app and a browser tab together, and the current app lets several windows write at once and merges what they save (src/saving.js: TAB, tabStamp, tabLive, tabMerge, the gsc.saved., gsc.forgot., gsc.over, gsc.finish and gsc.saving. keys; src/folder.js store.set merging gs.lib with mergeLib). Before the switch the new app must speak that same protocol, so several of its windows work as several old windows do now. Once it does, the new app takes the lock in shared mode like the current app, and new plus new no longer blocks.
- **Folder and Drive hooks go with the first stage that writes real work.** Every save in the current app also goes to the linked folder (writeWork calls folderSaved) and starts a Drive sync (syncSoon); a Planner save posts on gs-plan-out so the grading page syncs. If the new app writes lessons (stage 3) or marks (stage 4) without these, the folder and the other devices fall behind until the current app is opened. Lift those hooks in the stage that first writes, or keep the new app from writing real work until stage 6.
