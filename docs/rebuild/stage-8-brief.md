# Rebuild, stage 8 ("Close the gaps"): brief for every slice thread

Written by the planning thread ("Redesign Grading Studio as one teaching app") on 2026-11-19.

## Why this stage exists
Taylor tried the new app and found no way to add an assignment. An independent audit then read the current app control by control (2,027 controls, all 140 source files) and compared each with the new app: **261 missing, 253 different, 49 unsure**, and every sample pressed confirmed a gap. The list is `rebuild/audit/gaps.md` in project files, with `pass1-controls.json` beside it. The feature inventory (556 rows) that stages 3 to 6 used as their acceptance list was written from help text and feature names, so it missed create / edit / delete / reorder basics, first-run paths, drop targets, shortcuts and many second-level controls. The inventory is retired as an acceptance list. **`gaps.md` and the audit's control list are the acceptance list now.**

Taylor's rule has not changed: same features, none dropped, nothing half built, a simpler and better-looking interface. The switch (PR #246) stays open and unmerged until this stage is done and verified.

## Read first
- `rebuild/audit/gaps.md` (your section, plus "The ones a teacher meets first" and "Found by pressing"), `rebuild/audit/coverage.md` when it exists, `rebuild/stage-7/audit-notes.md`.
- In the repo: `next/docs/` (parts.md, parts/wall.md, saved-work.md, engines.md, languages.md).
- Approved design: `mockups/one-app/c2-classes/prototype-source.html` and the screenshots beside it.
- Memory: `one-app-overhaul` and the notes it links.

## Slices (one thread each; stay inside yours)
| Slice | Section of gaps.md | Thread |
|---|---|---|
| A | Home, shell, settings, saving, help, first run (50 missing, 65 different, 24 unsure) and the Home and first-run items under "Found by pressing" | new |
| B | Class page, gradebook, students, charts, reports, school (38, 25, 5) and the class-page items under "Found by pressing" | new |
| C | Marking screen, focus, rubrics, assistant (51, 32, 10) | the stage 7 thread |
| D | Bringing work in, video, quizzes, examples, return and export (25, 31, 6) and the New assignment rubric items under "Found by pressing" | new |
| E1 | Planner: the lesson editor and its side panel (rows whose screen is editor, side panel, document, Finished PowerPoint, Materials, Links, Taught, AI, Books, Video, Notebook, Activities) | new |
| E2 | Planner: everything else in that section (week, semester, calendar, units and unit page, timetable, library, Present and the class screen window, search and find, sidebar, arrival, setup file, lesson packs) | new |
| Verify | The audit thread. It builds nothing in this stage. It finishes its second pass (crawling the running app), then re-checks every row a slice closes by pressing it in the built app, and keeps the master count. |

If a row sits between two slices, the slice whose screen it is on takes it and tells the other in one line.

## How to treat each kind of row
- **Missing**: build it. The capability must exist and be reachable in a sensible place in the new design; it need not sit where it sat before. Use the shared parts; do not invent controls.
- **Different**: the default is to restore what the current app could do. A row may be closed as "kept different on purpose" only when the new design covers the same need at least as well, with a one-line reason. Every such row goes in your ledger's "kept different" list, which the planning thread and Taylor review. Losing a capability is never "on purpose".
- **Unsure**: settle it by pressing in both apps, then treat it as one of the above or as "present".
- A keyboard shortcut, drop target, right-click item or Find entry is a control like any other.
- New ideas stay out. If you find something the current app does not do, note it for after the switch.

## Proof per row
A row is closed when a browser test presses the control in the new app and sees its effect, and, where it writes saved work, the current app opens the result unchanged (the saved-work proof). No row is closed by reading code. Tests wait for focus or a change before pressing keys.

## Ledger
Each slice keeps `rebuild/gaps/<slice>.md` and `.json` in project files (not gaps.md itself, which the audit thread owns): every row of your section with done / kept different (reason) / present after all, the PR, and the test that proves it. Finish at 0 open. Do not report done with open rows.

## Working beside five other threads
- All work is in `next/`. The current app, the switch branch and PR #246 are not yours to touch.
- Own your screens' files. For shared files (shell, router, parts, lines), make small additive changes, pull main before each push, and merge often: many small PRs, each green, not one large one.
- New lines go in your area's line file, named, in English and all eight languages (the language test must stay green).
- Budgets are never raised. Route chunks and first load are tight; load anything heavy as a lazy part. If a budget truly cannot be met, stop and tell the planning thread; that is Taylor's decision.
- Save only through the write functions; a teacher's own text gets data-raw; hooks read state again after subscribing.

## Design bar
Closing gaps must not bring back the clutter the redesign removed. Keep each screen under 25 things to press at rest (counted the stage 4 way) by putting second-level controls one step away in menus, sheets and Find. Take pictures in Graphite and Midnight at 1440 and 390 of every screen you change and put them in `rebuild/gaps/pictures/<slice>/`.

## Rules that still apply
Public repo: no personal info, made-up students only; nobody opens Taylor's real papers, names, scores or comments. Drive is tested against the stand-in. Never preview on github.io. Never type an assistant's name into UI text; copied AI text is self-contained and names no folder, path or file on anyone's computer. Nothing hardcoded to Taylor. Branch and PR, `npm run check` and `npm run saved-work` before each merge, merge when checks show no new failures versus main. Opus 5.5 on medium effort builds; consult Fable for the plan at the start and when stuck. Long runs go to GitHub checks.

## Done when
Your ledger reads 0 open and the audit thread has re-pressed your closed rows. Report to the planning thread with counts (done / kept different / present after all), the "kept different" list with reasons, press counts, and anything you could not do within the budgets.

## Update 2026-11-19: row IDs
Every row in gaps.md now has an ID whose letter is its slice (A 139 rows, B 68, C 93, D 62, E1 85, E2 116, counting missing, different and unsure). The same IDs are in `rebuild/audit/pass1-controls.json` (fields "id" and "slice"). "Found by pressing" rows are A-901 to A-903, B-901 and D-901; rows the audit's second pass adds are numbered from 900 in each slice, so re-read your section of gaps.md before you report done. Name every row by its ID in your ledger, PR descriptions and test names, so the audit thread's `rebuild/audit/status.md` can match them.

## Update 2026-11-19: thread ids, and handing rows over
Slices may message each other directly to hand a row to the slice whose screen it is on. Record every hand-over in both ledgers (given to X / taken from X) and tell the audit thread, so no row is dropped between two slices.

| Slice | Thread id |
|---|---|
| A home, settings, saving | cmsg_015Y7pRN4AuMc3c4F52KN22a5y4j2adK1msHnYwwSKTpFu |
| B class page and gradebook | cmsg_015Y7pRN4AuMc3c4F52KN22aMRKebX9Ag89FyCowVwVbgx |
| C marking | cmsg_015Y7pRN4AuMc3c4F52KN22aBXFGs8b38YEdiuvJQTyUty |
| D papers in, video, quizzes, return | cmsg_015Y7pRN4AuMc3c4F52KN22aSJE8xhYkymzGc3CvVuA98T |
| E1 lesson editor | cmsg_015Y7pRN4AuMc3c4F52KN22aYBsLeHkM9oU5NRDNEtYsoX |
| E2 planner calendar, units, present | cmsg_015Y7pRN4AuMc3c4F52KN22aELKND8Vjky6pvjqrhWe1BQ |
| Verify (audit) | cmsg_015Y7pRN4AuMc3c4F52KN22aRGKwZYuo5AqGf3ChSDpGxS |
| Planning | cmsg_015Y7pRN4AuMc3c4F52KN22aYE66z5XtsYt9Ydx6DpSXcu |

Hand-overs so far: A gave C the marking-screen rows A-014 to A-019, A-042, A-043, A-091 to A-126, A-137; A gave D the Return tab rows A-020 to A-023 and the after-export toast A-081. The split-out fixes are PR #247; branch from main once it is merged.

## Update 2026-11-19: room for lines (read before adding any)
Slice E1 measured it: the largest language chunk (zh-Hans) is 117.8 KB of the 125 KB per-file budget, so all slices together have room for roughly 150 new lines, and stage 8 needs far more. No budget is raised. The fix is structural and slice A builds it first, as its own small PR, before anything else:
- Each language is split into per-area files that mirror the English area files (shell, class, paper, plan, and so on) and load with the screen that needs them, the way English lines already do. A teacher then downloads less at once than today, and each file sits far below 125 KB. The per-file budget stays 125 KB; the total for one language stays inside the limit Taylor chose (one language counted).
- The language test, the update check and the service worker's file list follow the split. Switching language loads the files for the open screen and fetches the rest as screens open; offline, a screen whose lines are not yet kept falls back to English for that screen and says nothing alarming.
- Until that PR is merged, other slices build with English lines only in their area's English file and add the eight translations in a follow-up PR per slice once the split is in. Do not block on it.
English lines are bundled into each route chunk, so lines also cost route budget (lesson.jsx 59.5 of 60 KB, lesson-edit 59.6, lesson-tools 59.9). Put new controls in new lazy parts (router.js PARTS) rather than growing a full chunk, and reuse existing lines where the wording truly is the same.

## Update 2026-11-19: hooks and behaviours without a press (rebuild/audit/hooks.md)
The audit's third pass listed 74 rows, H-001 to H-074: hooks the lifted engines expect that the new app never supplies, and things the current app does on open, save, timer, focus or a change from another window. They are part of the acceptance list and each has an owning slice. Order of work in every slice:
1. **Data-loss rows first, before any other row, each as its own small PR merged on green:** H-001 to H-003 saved comments (C, PR #253); H-004 library Undo wipes changes saved since the step (B); H-005 lesson notebook typed in one lesson saved onto another on a quick switch (E1); H-006 to H-009 failed save not retried, no unsaved-work warning on closing, Update now reloading other windows mid-work and not saving first (A). Taylor has been told to use the preview for looking only until these nine are closed and the audit thread has re-pressed them.
2. **The 17 risk rows** (a failed read treated as empty and then saved over; whole-copy undos; welcome overwriting settings; folder sync not re-merging; a stale timetable draft) next. Rule for every write, everywhere: never save a whole record from state that was not read from storage at that moment. Apply the change to what is in storage now (as #253 does for saved comments), and treat a failed read as a failure, never as empty.
3. Then the control rows.
The audit's coverage.md says what its passes did not cover: drag and drop was not performed, keys were not swept in the browser, and video, Google, folder, new-year and two-window states were read from code only. Slices whose screens use those should test them directly; the audit thread will sweep them after re-pressing.

## Update 2026-11-19: first load is full (slice A measured it)
The first load is within about 300 bytes of its 60,000-byte budget on main. No budget is raised. Rules for every slice from now on:
- Add nothing to shell, router, crossings.js or the core lines unless it replaces something of the same size. Anything a screen needs goes in that screen's chunk or a lazy part; lines go in that screen's area file, never core.
- A router entry for a new lazy part is the only allowed addition, and the PR that adds it must show the first-load number before and after.
- Slice A owns making room: moving Home's list code out of crossings.js and anything else in the first load that only one screen uses. If you see first-load code that belongs to your screen, tell slice A rather than moving it yourself.
- Run the budget check locally after pulling main, before every push; a PR that was green yesterday can be over today.
