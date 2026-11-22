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
