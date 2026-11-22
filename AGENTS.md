# Notes for AI coding tools

Read this first if you are an AI coding tool (Codex, Jules, Gemini CLI or similar) picking up work on this repo. It covers what the app is, the rules, and where the rebuild stopped.

## What this is

Grading Studio is an in-browser grading tool and lesson Planner for teachers. Everything runs in the browser; a teacher's saved work lives in their browser and their own folders, never on a server. Live copy: https://taylorbereiter.github.io/grading-studio/.

- `README.md`: what the app does. `docs/GUIDE.md`: the full guide. `docs/DEVELOPING.md`: build, tests, preview, saved work. `docs/PLAN.md`: the plan and history.
- `src/`: the current app (grading page and Planner), built by `build.js` into `index.html`, `Grading Studio.html`, `planner.html`, `Planner.html`.
- `next/`: the rebuild, a new one-app design built beside the current app. Its own docs are in `next/docs/` (parts.md, saved-work.md, engines.md, languages.md). Size budgets are in `next/budgets.json`.
- `lang/` and `next/lang/`: the eight languages.
- `test/` and `next/test/`: tests. All students in tests are made up.
- `docs/rebuild/`: the rebuild's open lists and pick-up notes (see below).

## Rules

1. **No student data, ever.** No real student papers, names, scores or comments in code, tests, docs, commits or PRs. Tests use made-up students generated in code.
2. **Public repo: no personal info.** No real names, school email addresses, timetables or a teacher's setup file. Check every push.
3. **Branch and PR.** `main` is protected and needs the **All checks** result from a `pull_request` run (`.github/workflows/checks.yml`; checks take 15 to 30 minutes). Before pushing run `npm run check` and `npm run saved-work` (for `next/`, also `npm run next:check`). Merge only when checks show no new failures compared with `main`.
4. **Never preview on github.io.** Browsers keep saved work per address, so a preview there would open the teacher's real work. Use `npm run preview` (http://localhost:4173).
5. **Never raise a size budget** (route chunks, first load, per-language files). If something cannot fit, stop and ask the owner. Put new UI in lazy parts instead of growing a chunk.
6. **Eight languages.** Every new or reworded line goes into all eight language files; the language test must stay green.
7. **Nothing hardcoded to one teacher.** Timetables, classes, links and names come from each teacher's settings. New per-teacher settings must also be handled by the setup file import/export.
8. **Never write an assistant's name (such as "Claude") into UI text.** Use the helpers (`aiName()`, `aiSay()`, `plAi()` and similar). Text the app copies for an AI must be self-contained and must never name a folder or path on anyone's computer.
9. **Saved browser work must survive every merge.** `npm run saved-work` proves it. A change to what is stored needs a migration and a note in `test/saved-work-changed.txt`. Never save a whole record from state that was not read from storage at that moment, and treat a failed read as a failure, not as empty.
10. **Undo for marking.** Marking changes call `fieldSnap` / `gradeSnap` before they change anything; Library changes go through `libTrack`.
11. **Look.** Light mode by default, the "Calm Desk" look in ocean blue (#1F6FB2), grays #F4F5F7 / #E4E6EA, Inter. Red only for marks.
12. **NEVER merge the switch PR (the new app at the root, the previous version at classic/) without the owner's explicit go.** Green checks are not a go; only the owner's own words are.

## Rebuild status (paused 19 Nov 2026)

The rebuild in `next/` reached stage 8, "Close the gaps". An audit read the current app control by control (2,027 controls) and found **261 missing, 253 different and 49 unsure** compared with the new app, plus 74 hook and behaviour rows (H-001 to H-074). That list is the acceptance list for the switch; the switch stays on hold until every row is closed and re-checked.

Work is split into slices, each with a ledger (status per row, PR, and the test that proves it):

| Slice | Area | Ledger | State at pause |
|---|---|---|---|
| A | Home, shell, settings, saving, help, first run | `docs/rebuild/gaps/A.md` | 57 open; #260 holds more built rows |
| B | Class page, gradebook, students, charts | `docs/rebuild/gaps/B.md` | Done except B-903 to B-906 on #258 |
| C | Marking screen, focus, rubrics, assistant | `docs/rebuild/gaps/C.md`, plan in `C-plan.md` | 75 open; much work on #255 |
| D | Bringing work in, video, quizzes, return, export | `docs/rebuild/gaps/D.md` | Done, on #251 |
| E1 | Planner lesson editor and side panel | `docs/rebuild/gaps/E1.md` | 0 open, on #248 |
| E2 | Planner calendar, units, Present, search | `docs/rebuild/gaps/E2.md` | 3 open (E2-058/072/073 wait on E1's #248); #259 open |

Other files in `docs/rebuild/`:
- `gaps.md`: the full audit list, every row with an ID (letter = slice). Start with "The ones a teacher meets first".
- `hooks.md`: the 74 hook rows. Data-loss rows H-001 to H-009 come first; 8 of 9 were verified on `main`, H-005 waits on #248.
- `stage-8-brief.md`: how each kind of row is closed (proof is a browser test that presses the control, plus the saved-work proof), the design bar (under 25 things to press per screen at rest) and the budget rules.
- `RESUME.md`: where the verification pass stopped and how to run it.

Ledger notes about "threads" refer to the previous AI sessions that did the work; ignore those ids.

## Open PRs and merge order

Merge in this order, one at a time: pull `main` into the next PR, wait for green **All checks**, then merge.

1. **#248** (E1, lesson editor). Closes H-005.
2. **#255** (C, marking).
3. **#251** (D, papers in, video, quizzes, return).
4. **#258** (B, rows B-903 to B-906). Last CI fixes passed locally but were not watched.
5. **#260** (A, Home lists, Find rows, first-load room). `find-a.test.js` "A-008" failed once in a long local run but passes alone; check it before merging.

Also open: **#259** (E2, rows E2-048 and E2-108), checks were running at the pause; merge when green. The switch PR is never merged without the owner's explicit go (rule 12).

More slice C work is saved as a git bundle outside the repo (with the owner), not on any branch here. Ask the owner for it rather than redoing that work.
