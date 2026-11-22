# Slice A: progress on the rows still open (branch a-rows)

Rows from docs/rebuild/gaps.md that the slice A ledger (rebuild/gaps/A.md in project files) lists as open or partly built on the
integration branch (6eb2bad0). Status: done (browser test presses it), kept different (reason), open (why not yet).

| Row | Status | Test | Commit |
|---|---|---|---|
| Task 0 | test bug fixed (the library was read in a window whose copy of localStorage had not caught up) | next/test/browser/two-windows.test.js 'the library beside the current app' | see log |
| A-077 | done | next/test/browser/home-first.test.js 'A-077' (both) | group 1 |
| A-139 | done | next/test/browser/home-first.test.js 'A-139' | group 1 |
| A-901 | done | next/test/browser/home-first.test.js 'A-901 A-078 A-079' | group 1 |
| A-078 | done | next/test/browser/home-first.test.js 'A-901 A-078 A-079' | group 1 |
| A-079 | done | next/test/browser/home-first.test.js 'A-901 A-078 A-079' | group 1 |
| A-072 | done (the class's to-dos; taught and attendance were built before) | next/test/browser/home-first.test.js 'A-072' | group 1 |
| A-036 | done | next/test/browser/goback.test.js 'A-036 A-037' | group 2 |
| A-037 | done (folder copies and safety copies both have Look / Close; Go back / Put back moved inside, as in the current app) | next/test/browser/goback.test.js (both) | group 2 |
| A-038 | done (a copy of now is kept first; Undo on the toast) | next/test/browser/goback.test.js 'A-037 A-038' | group 2 |
| A-044 | done (Read it first shows the prompt in a box with Copy; the prompt is the engine's own, naming no folder) | next/test/browser/setup-move.test.js 'A-044 A-045' | group 3 |
| A-045 | done (Choose a file… reads a .json or .txt into the box and checks it at once; over 400 KB says too long) | next/test/browser/setup-move.test.js 'A-044 A-045' | group 3 |
| A-046 | done (site.json movingTo reaches the new app as __GS_MOVE__; the card at the top of Settings > Saving, only at the address being left) | next/test/browser/setup-move.test.js 'A-046 A-127', 'A-046: nothing is said…' | group 3 |
| A-127 | done (the once-a-day box with Later, Open the new address, Take my work with me, only for a browser with work) | next/test/browser/setup-move.test.js 'A-046 A-127' | group 3 |
| A-051 | done (files, a folder or a ZIP dropped anywhere on Home open as a new download through mark/open.js bringIn, as on an assignment; Home says where they go while dragged over) | next/test/browser/home-first.test.js 'A-051 A-065' | group 4 |
| A-065 | done (same drop; a single folder is the download and names it, as src/app/wiring.js does) | next/test/browser/home-first.test.js 'A-051 A-065' | group 4 |
| A-028 | done (each class's name opens its page) | next/test/browser/settings-a.test.js 'A-028 to A-033' | group 5 |
| A-029 | done (Name and roster in the row's menu: the class page's roster box) | settings-a.test.js 'A-028 to A-033' | group 5 |
| A-030 | done (the row says whether the link is saved; Add / Change the link in its menu: the class page's box) | settings-a.test.js 'A-028 to A-033' | group 5 |
| A-031 | done (From Google Classroom… opens the class page's sheet) | settings-a.test.js 'A-028 to A-033' | group 5 |
| A-032 | done (Add a class: the sidebar's own page) | settings-a.test.js 'A-028 to A-033' | group 5 |
| A-033 | done (No classes yet, with what a class is for) | settings-a.test.js 'A-028 to A-033' | group 5 |
| A-034 | kept different: the app's text size is in Settings > Display and the paper's text box, fit and Word size in Settings > Marking; the paper zoom slider belongs on the marking screen (A-096, slice C) | none | group 5 |
| A-035 | done (a language chunk that couldn't be fetched sets a flag; Display says so, in English, as src/settings.js does) | settings-a.test.js 'A-035' | group 5 |
| A-039 | done (Terms and weights in Settings > Grading: terms and dates, each type's weight, empty types, extra credit, the 100% cap; Term setup is the gradebook's sheet) | settings-a.test.js 'A-039 A-040' | group 5 |
| A-040 | done (how many rubrics and scales the bank holds; Open the rubric bank goes to Library > Rubrics) | settings-a.test.js 'A-039 A-040' | group 5 |
| A-041 | present after all (Settings > Marking > Word papers: Keep as Word / Make PDF pages, built in slice D, gs.wordPdf) | next/test/browser/settings-more.test.js | — |
| A-047 | done (Find has Switch to <name> for each assistant she keeps listed; it becomes the one in use, with its own link, and opens beside, as the sidebar list does today; the sidebar itself is first load, so the list lives in Find) | next/test/browser/settings-a.test.js 'A-047' | group 6 |
| A-048 | done (a to-do's People field is always there and ends with Someone new…: the School page's own person form, then the person is on the to-do) | settings-a.test.js 'A-048' | group 6 |
| A-049 | present after all (Home's Focus shows today against the goal and opens the timer, whose goal links to Settings > Focus) | existing focus tests | — |
| A-052 | done (Bring in papers on Home: Files or a ZIP…, as on an assignment, with none yet) | next/test/browser/home-first.test.js 'A-052 to A-057, A-063, A-064' | group 6 |
| A-053 | done (the Bring in papers menu holds the other ways) | same | group 6 |
| A-054 | done (A folder…; one folder is the download and names it) | same | group 6 |
| A-055 | done (A scan to split…: the split screen picks the class) | same | group 6 |
| A-056 | done (Files to match to a roster…: files or a whole folder, then matched) | same | group 6 |
| A-057 | done (From Google Drive, where Google's chooser can be used; shown, the press is the drive tests' own driveFill) | same | group 6 |
| A-063 | done (as A-055) | same | group 6 |
| A-064 | done (files or a folder, as A-052 and A-054) | same | group 6 |
| A-066 | done (no timetable: Home's empty card has Set up your timetable, to Settings > Timetable, where the new app keeps it) | home-first.test.js 'A-066' | group 6 |
| A-080 | done (a folder that needs a press, Reconnect or Decide, is said at the top of Home; the words and the Decide box are Settings > Saving's) | next/test/browser/folder.test.js 'A-080' | group 7 |
| A-082 | done (a take-home file picked or dropped as papers says what it is and where it goes) | next/test/browser/home-first.test.js 'A-082' | group 7 |
| A-083 | present after all (whole/folder-run.js says it, saving.f_lost, as a long note rather than a box) | none new: the seeds hold no papers to lose | — |
| A-084 | kept different: full screen is one press in Find (the F shortcut's row), F, and Settings > Display; the sidebar is first load, which is full | e2-commands.test.js (Find's Full screen) | — |
| A-085 | kept different: on the marking screen F is marking's (feedback on formative work; full screen marking is slice C's A-042), and Present has its own full screen | — | — |
| A-086 | present after all (src/samplemode.js runs first in the new app too and follows another tab) | home-first.test.js 'A-086' | group 7 |
| A-090 | kept different: the daily count runs from the pages at the web address; the new app joins it with the switch of the root page (PR #246), which this slice must not touch | — | — |
| A-024 | present after all (School's Add: Link, File, From Google Drive, Note) | next/test/browser/school.test.js 'School: a link, a note and a file…' | — |
| A-025 | present after all (School's search box once there are six things) | school.test.js 'the search box…' | — |
| A-026 | present after all (a person's to-dos from their row; Add a to-do for them opens To do on their lines, and what she types names them) | school.test.js 'A-026' | group 7 |
| A-128 | kept different: the phone's tabs are Home, To do, Classes, Find and More; plans and scores are a class away (the new app's design) | shell.test.js | — |
| A-129 | open: goes with A-131 | — | — |
| A-130 | present after all (More on a phone has the update control: Update now, Reload, Check) | next/test/browser/shell.test.js | — |
| A-131 | open: See the paper on a phone's Scores needs the kept-paper reader (engines/gopen.js paperGet) and a PDF view sized for a phone, a part of its own; not reached in this pass | — | — |
| A-132 | kept different: Focus is on Home's header and in Find, and a running session shows on every screen; the sidebar is first load | — | — |
| A-133 | kept different: the Planner is Calendar in the sidebar | — | — |
| A-134 | kept different: Examples is Library > Examples, and a Find row | find-a.test.js | — |
| A-135 | kept different: the sidebar's saved line says Not backed up in amber; Home's folder card, Needs a look and Find's Where your work is saved open the place to fix it (the sidebar is first load) | — | — |
| A-136 | kept different: as A-084 | — | — |
| A-138 | kept different: the new app never changes the saved-work format (it will not write a newer or older one and leaves the move to the current app), so there is no slow update to stop | — | — |
