## Slice C build plan (10 PRs, each green alone)

Not measured: I could not build (read-only), so current chunk sizes and the marking screen's press count are unknown. PR 1 measures both. Paths are relative to the repo root.

**Standing rule for every PR:** `next/src/app/screens/mark.jsx` (561 dense lines, in the route chunk) gets only a menu item or a `PARTS.x()` call. All new UI goes in lazy parts registered in `next/src/app/router.js`. Lines go in `mark/lines.js`, in 8 languages.

**At-rest press budget:** five new presses in total: More (paper header), Next, average button, Full screen, Edit rubric. Everything else goes in the More menu, Setup menu, right-click menu, sheets or Find.

| PR | Rows | Files | Where controls live / parts reused | Browser test |
|---|---|---|---|---|
| 1. Guard, zoom, keys | C-034, C-064, zoom Ctrl +/−/0 (item 9), C-043, C-042, C-063, C-046, C-049; settle C-024, C-030, C-036, C-045 | `mark.jsx`, `mark-tools.jsx`, `mark/touch.js` | % label becomes a Button; swatches and width inside the existing right-click Menu and dock; Next beside Next to score | `mark.test.js`: press count under 25 at 1440 and 390 (copy the counter in `plan.test.js:174`); `mark-keyboard.test.js`: wheel zoom, Cmd 0, Arrow Right, Delete on slider |
| 2. "More for this paper" menu | C-052, C-056, C-057, C-059 (Word too), C-031, C-050, C-044, C-048/C-077, C-074, C-029 | `mark/fileui.jsx`, new lazy `mark/paper-more.jsx` | One Menu on the paper header: Student details (Sheet), Only this student, Use as example, Type notes instead, Export this paper now, Mark key, All keys (Sheet with ShortcutList, over the paper). Edit link by the Score heading; Change the type link in the feedback panel | `mark-files.test.js`: each item pressed and its effect seen |
| 3. Drive on the marking screen | C-055, C-086, C-087, C-088, C-089, C-032, C-051, C-028, C-035 | `mark/fileui.jsx`, `mark/change.js`, `score-more.jsx` | `useDrivePick` via `PARTS.drive` (never a static import); Replace becomes a Menu of sources (computer / Drive / new link); empty state gets the sentence, one primary button and the Add menu | `drive-files.test.js` with `fakedrive.js`: add, replace, paste a video link, partner copies; saved-work proof |
| 4. Rubric at New/Edit assignment | C-003, C-004, C-065 | `mark/setup.jsx` (export a small bring-in part), `class/assignment.jsx` | A "Bring in a rubric" row in the assignment dialog that lazy-loads the setup part; Drive item inside | `mark-setup.test.js`: new assignment, rubric from file and from fake Drive, Use this rubric, before any paper is open |
| 5. Top bar: average, gradebook, full screen | C-037, C-038, C-062, C-073, plus A-125, A-094, A-102, B-050, B-051 | `mark.jsx` (thin), new lazy `mark/fullscreen.js`, `mark/bookbox.jsx` | Progress text becomes one button, "n of N · avg", opening Insights; missing/excused and to-do tag in its text. Gradebook: Setup menu item and Find, a Sheet hosting B's `class/grades.jsx`. Full screen: one IconButton in the zoom toolbar plus a key; left edge shows the list. Bring back: Setup item shown only when something is out | `mark.test.js`: average matches Insights; gradebook sheet opens with the class picker; full screen on and off, edge reveal |
| 6. Readings | C-053, C-078 to C-085, C-039, C-040, C-041 | new lazy `mark/readings.jsx`, `mark/paper.js` hook | Opener in the More menu with count; Dialog; card above the paper with its own small toolbar (only when a reading exists) | new `mark-readings.test.js`: for everyone, for one student, hide, remove, zoom, Drive; saved-work proof both ways |
| 7. Transcripts for all | C-075, C-091, C-092, C-093 | new lazy `mark/transcripts.jsx`, `mark/media.jsx` | Setup menu item (only when recordings exist) and Find; Dialog with Stop | `mark-media.test.js`: make all, again too, stop |
| 8. Insights Percents | C-013 to C-023 (incl. C-017) | new lazy `mark/percents.jsx`, `mark-out.jsx` (one tab) | Third tab; options in one "Who counts" Menu and a row of Segmented | `mark-out.test.js`: dot opens paper, bands, target, what-if, sort, copy, bar tooltips |
| 9. Focus goals | C-005 to C-012, C-009, C-010, C-068 | `focus/start.jsx`, `focus/panel.jsx`, `shell.jsx` (one NavItem) | Goal picker and 5/10/15/25 in the start sheet; Done / Don't carry over in the panel's menu | `focus.test.js` |
| 10. Assistant, shell, leftovers | C-069 to C-072, C-001, C-066, C-090, C-025, C-026, C-027, C-033 | `shell.jsx`, `services/assistant.js`, `mark/word.js`, `mark/share.jsx` | Sidebar link becomes a Menu only when there are several assistants; side window code lazy; Alt S registered in the shell, loading `PARTS.snip` on press | `shell.test.js`, `mark-word.test.js` (Back to original after reload) |

## Keep different on purpose
- C-054 (+ Add at the foot): it sits where the new file lands; the empty state has it at the top.
- C-028 (six direct buttons): one primary plus the Add menu, same six actions, Drive added.
- C-032 (Replace source dialog): a menu of the same sources, one press fewer.
- C-047 (All per row): the Rubric side tab shows every row and stays open; C-046 restores the hover preview.
- C-058 (Arrange pages at the foot), C-060 (Lighting in the zoom toolbar), C-061 (Calculator in Setup, the score panel and =): already one press.
- C-062 (Add late work): same action in Setup; add a Find entry with the old name.
- C-067 (typed notes fold-open): C-031 restores the direct route.
- C-076 (clear with Undo, no confirm): the design rule is that removing is undoable.
- C-077 (the dialog's own Close): the keys list returns as a sheet over the paper, with the standard close.

Everything else in Different is restored. C-002 is on the class gradebook, so it is B's: tell B.

## Budget risks
- **Route chunk (60 KB):** `mark.jsx` statically imports `ui`, `gcore`, `gdraw`, `paper.js` and `touch.js`. PRs 1 and 5 add code there, so move the wheel-zoom and full-screen logic into the already-lazy `mark-tools.jsx` or `fileui.jsx`. Readings, Percents, Transcripts, the gradebook box and the More menu must each be their own part.
- **First load (3 KB room):** PRs 9 and 10 touch `shell.jsx`. The assistant menu's side-window code, Alt S and the Focus item must each be a register call plus a lazy import. Measure before and after; stop and report if it is over.
- **Language files (120 KB each):** Readings and Percents add many lines; the largest language is already at 112 KB.

## Cross-slice overlaps
- **D:** the Drive picker (`drive-button.jsx`, `drive-lazy.js`) is reused, not forked. The New assignment rubric rows (D-901) meet PR 4: C exports the part, and D mounts it if D owns `assignment.jsx` changes.
- **A:** the failed-save bar is A's. A-042 and A-043 (the full screen setting) stay A's, but PR 5 reads `gs.fullSide`. C takes A-125, A-094 and A-102 because they are on the marking screen, and tells A. `shell.jsx` edits in PRs 9 and 10 are small and additive.
- **B:** the gradebook box (B-050, B-051) hosts B's `grades.jsx`; agree its props first. Student details reuses B's People sheet.

### Critical Files for Implementation
- next/src/app/screens/mark.jsx
- next/src/app/mark/fileui.jsx
- next/src/app/router.js
- next/src/app/screens/mark-out.jsx
- next/src/app/drive-button.jsx

## Rows taken from B (11/19)
B-042, B-044..B-054, B-059, B-063 are on the marking screen, so they are C's. Gradebook button links to #/class/<id>/grades.
## From D (11/19)
D-038 (Export this paper now under Next, plus "Exported at…" under the student) = C-050, built in PR 2. D edits screens/mark-out.jsx (Return tab) and adds onTab, rescans/onRescans props to <out.Out> in mark.jsx plus an optional kind for openShare: rebase PR 8 (Percents tab) onto that.
D builds C-055 (Drive in + Add, = D-042) and the refound hook in mark/out.js; also edits fileui.jsx FilesFoot (Move to…, ZIP to a student, Mark late). PR 3 builds on D's fileui changes. C-028, C-035, C-086, C-088 stay C's.
## From A (11/19)
A-001..A-005 (Find commands that exist only while an assignment is open: Bring back, Gradebook, + Add / ⋯ items, Grade sheet / Consistency / Examples, Convert Word to PDF) are C's. Register them from mark.jsx alongside the matching PRs (5, 2, 10).
## From the audit (11/19, rebuild/audit/hooks.md + gaps pass 2)
C rows: H-001..003, H-027 (gs.bank, #253); H-010, H-012, H-025 (data-safety PR next, before the gap PRs); H-031 gradeMarksChanged, H-032 refound (D builds), H-033, H-036, H-038, H-040, H-041, H-044, H-051, H-059, H-060, H-061, H-064, H-065, H-070. Pass 2: C-901 Insights "See this as a table" (PR 8), C-902 Grade sheet "Copy all scores".
## Progress (11/19)
- #253 saved comments (H-001..003, H-027): in CI.
- Data-safety (H-010, H-012, H-025): local commit b42ae897 on branch `safety` (worktree scratchpad/bank), push after #253.
- PR 1: local commit cf3416df on `c-pr1`. Closed C-034, C-064, item 9, C-043, C-042, C-063, C-046, C-049, C-030, C-045; C-036 already there; C-024 kept different (number keys score the row in hand without Tab; Tab keeps one order). Presses at rest 24 (1440) / 17 (390): room for one more at 1440. New engines/gkey.js keeps Settings under its route budget.
## Merge queue to main (coordinator, 11/19 11:38 UTC)
#248 (E1) -> #255 (C) -> #251 (D) -> #258 (B) -> #260 (A). E1 tells C when #248 lands; C tells D (cmsg_015Y7pRN4AuMc3c4F52KN22aSJE8xhYkymzGc3CvVuA98T) when #255 merges. New PRs join the end (C's PR 1+2 stack goes after #260).

## PAUSED 11/19 ~12:00 UTC (Taylor paused all rebuild work to save tokens for grades)
Where slice C stopped:
- #255 (data safety H-010, H-012, H-025, plus test fixes for the Seating and bank-edit races) is open on claude/project-thread-6siygy at 7c73e1bb. Its checks were running and were not watched to the end. In the merge queue it comes after #248. To resume: merge main in (scratchpad/remerge.sh does it, taking main's side for built files and rebuilding), get checks green, merge, then tell D (cmsg_015Y7pRN4AuMc3c4F52KN22aSJE8xhYkymzGc3CvVuA98T) it's their turn.
- Unpushed stack, saved as rebuild/gaps/C-branches/c-stack.bundle (based on origin/main 926b18c era; branches c-pr1..c-pr5, plus backup-c-pr5):
  - c-pr1 cf3416df: zoom and keys.
  - c-pr2 02617c94: More for this paper menu, 3 bugs, presses down to 22.
  - c-pr3 5d66ac41: readings, transcripts for all, grade sheet copy, H-038.
  - c-pr4 424ba068: top bar (average, full screen, gradebook and links), A-001, A-004, H-061.
  - c-pr5 5826c0f0: foot buttons as one stop, focus goals, assistant menu, Alt S, leftovers. Built BEFORE the "first load is full" rule: check that it adds nothing to shell/router/core and move anything that does into lazy parts.
  The rebase onto the language split (#250) was not finished. To resume: `git fetch <bundle> 'refs/heads/*:refs/heads/*'`, rebase onto main, keep the branches' whole <code>.json files, run `node next/tools/lang-areas.js`, add 'top' to lang-load.js AREAS, then run the budget test.
- Ledger rebuild/gaps/C.md: 179 rows; about 60 closed or settled; open rows include Drive (PR 3, after D's fileui), Percents (PR 8, after D's mark-out), and the remaining H rows.
- PR 4 (rubric at New assignment) is covered by D's #251.
