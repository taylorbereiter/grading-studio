# Slice B ledger: class page, gradebook, students, charts, reports, school

Thread "Close rebuild gaps B". Rows from rebuild/audit/gaps.md (plus C-002, handed over by slice C). Status: open / done / kept different (reason) / present after all / handed to another slice. Tests are in next/test/browser/class-gaps-b.test.js unless named.

Counts: done 60, handed 19, kept different 2, present after all 1

PAUSED 2026-11-19 (Taylor paused the rebuild). Where it stopped: B-903 to B-906 are on PR #258, branch claude/project-thread-yaat01 at 994ed8a7, all pushed. It is NOT merged. The last CI fixes (the Assignments tab refreshes only its counts; the Phone layout and New assignment tests wait for what they read) pass locally, but their checks were not watched. On resume: merge main in, wait for green, and merge in queue order (after #248, #255, #251; then tell slice A). The four rows say done/#258 but only count once #258 is merged.

| ID | Screen | Control | Status | Plan | PR | Test |
|---|---|---|---|---|---|---|
| B-001 | Assignments | Rubric section (Bring in a rubric..., From Google Drive) | handed to D |  |  |  |
| B-003 | Assignments | Also due that week hint | done | PR3 | #252 | B-005 test |
| B-004 | Assignments > Add papers | Rubric: Bring in a rubric... / From Google Drive (in the Open box) | handed to D |  |  |  |
| B-007 | Class > Assignments | Card shows time spent grading (time tracker) | done | PR3 | #252 | B-005 test |
| B-011 | Class > Charts | Chart: Spread on each assignment (lowest-highest, middle half) | done | PR4 | #252 | class-gaps-b B-011 |
| B-013 | Class > Charts | Chart: Who is moving (biggest rises and drops) | done | PR4 | #252 | class-gaps-b B-011 |
| B-014 | Class > Charts | Chart: Where the class stands, assignment by assignment (stacks) | done | PR4 | #252 | class-gaps-b B-011 |
| B-015 | Class > Charts | Chart: Rubric rows across the summatives | done | PR4 | #252 | class-gaps-b B-011 |
| B-016 | Class > Charts | Chart: Summatives against in-class work (scatter) | done | PR4 | #252 | class-gaps-b B-011 |
| B-017 | Class > Charts (heatmap) | Student name -> student's page | done | PR2 | #252 | class-gaps-b B-017 |
| B-018 | Class > Goals | Student name -> page | done | PR2 | #252 | class-gaps-b B-017 |
| B-021 | Class > Gradebook | Entry list (for this column) | done | PR3 | #252 | class-gaps-b B-020 |
| B-023 | Class > Gradebook (no roster) | Import scores... (class with no roster; the file can become the roster) | done | PR1 | #252 | B-901 test |
| B-025 | Class > Report comments | Grade cut-offs: highest from / good from / middling from | done | PR5 | #252 | class-gaps-b B-024 B-025 B-057 |
| B-026 | Class > Students | Paste IDs and emails... (fill many students at once) | done | PR2 | #252 | class-gaps-b B-026 |
| B-027 | Class > Students | Cancel / Fill in (paste box) | done | PR2 | #252 | class-gaps-b B-026 |
| B-029 | Class > Students > one student | Term tabs on a student's page (whole year or any term) | done | PR2 | #252 | class-gaps-b B-029 |
| B-031 | Class > Students > one student | By type bars with class average; feedback count | done | PR2 | #252 | class-gaps-b B-029 |
| B-032 | Class > Students > one student | Left/Right arrow = previous/next student | done | PR2 | #252 | class-gaps-b B-029 |
| B-033 | Class > Students > one student | Every assignment strip (scored/missing/late/feedback) | done | PR2 | #252 | class-gaps-b B-029 |
| B-034 | Class > Students > one student | Chart: Against the class (band line) | done | PR2 | #252 | class-gaps-b B-029 |
| B-035 | Class > Students > one student | Chart: student's rubric rows vs class average | done | PR2 | #252 | class-gaps-b B-029 |
| B-038 | Class page | Import scores... (no roster yet) | done | PR1 | #252 | B-901 test |
| B-043 | Gradebook > Import scores | Use another file | present after all | PR3 | #252 | class-gaps-b B-020 |
| B-044 | Marking > Rubric setup | New goal... (in the goal picker) | handed to C (marking screen) |  |  |  |
| B-045 | Marking > Rubric setup | Tag rows / Edit goals... link | handed to C (marking screen) |  |  |  |
| B-047 | Marking > group paper | Use group score (undo a partner's own score for one row) | handed to C (marking screen) |  |  |  |
| B-050 | Marking screen > Gradebook box | Tabs Table / Class charts / One student | handed to C (marking screen) |  |  |  |
| B-051 | Marking screen > Gradebook box | Class picker select | handed to C (marking screen) |  |  |  |
| B-052 | Marking screen top bar | Gradebook (#bookBtn) | handed to C (marking screen) |  |  |  |
| B-053 | Marking top bar | + Unit plan link / unit plan ↗ | handed to C (marking screen) |  |  |  |
| B-054 | Marking top bar | School system link / add it | handed to C (marking screen) |  |  |  |
| B-057 | Progress sheets | Open Report comments (drafts not looked at) | done | PR5 | #252 | class-gaps-b B-024 B-025 B-057 |
| B-058 | School > people | N to-dos (for this person) -> To do | done | PR5 | #252 | class-gaps-b B-058 |
| B-061 | Student details card | Remove a spelling (Also called x) | done | PR2 | #252 | class-gaps-b B-026 |
| B-062 | Student details card | + add (another spelling) | done | PR2 | #252 | class-gaps-b B-026 |
| B-064 | Today (Home / Planner day) | Take attendance / Attendance taken line under each class | handed to A (Home) |  |  |  |
| B-067 | address bar | unknown class name toast (noClass) | done | PR1 | #252 | B-067 test |
| B-002 | Assignments | Due date + "Also due that week" hint | done | PR3 | #252 | B-005 test |
| B-005 | Class > Assignments | Click a card (opens papers, or the gradebook if scores were typed in, else Add papers) | done | PR1 | #252 | B-005 test |
| B-006 | Class > Assignments | Typed in pill on card | done | PR1 | #252 | B-005 test |
| B-008 | Class > Assignments | Edit (name, type, due, unit, rubric) | handed to D (rubric part); due part in #252 | PR3 | #252 |  |
| B-009 | Class > Assignments | Open other papers... (newer download) | handed to D |  |  |  |
| B-010 | Class > Assignments | Delete unit (asks if it has assignments; Undo) | done | PR1 | #252 | B-005 test; class-units order test |
| B-012 | Class > Charts | Charts tab for the whole year (term = Whole year) | done | PR4 | #252 | class-gaps-b B-011 |
| B-019 | Class > Gradebook | i (details card) beside each name | kept different (the gradebook name opens the student page, which holds everything the old details card had) | PR2 | #252 | class-gaps-b B-017 |
| B-020 | Class > Gradebook | How this is worked out (details) | done | PR3 | #252 | class-gaps-b B-020 |
| B-022 | Class > Gradebook | Enter in name/max saves Add scores | done | PR3 | #252 | class-gaps-b B-020 |
| B-024 | Class > Report comments | Wording... / Copy all / Download spreadsheet / Progress sheets | done | PR5 | #252 | class-gaps-b B-024 B-025 B-057 |
| B-028 | Class > Students | Inline ID / Email / Last year per row (type down the table) | done | PR2 | #252 | class-gaps-b B-026 |
| B-030 | Class > Students > one student | Previous student / Next student | done | PR2 | #252 | class-gaps-b B-029 |
| B-036 | Class > Students > one student (MYP) | Prev/next student, progress sheet | done | PR2 | #252 | class-gaps-b B-029 |
| B-037 | Class page | Grading (MYP/DP way) item | done | PR1 | #252 | B-901 test |
| B-039 | Class page | #/class/<id>/<tab> panel tabs (gradebook, students, attendance, seating, charts, missing, goals, reports) | done | PR5 | #252 | class-gaps-b B-065 B-039 (people/attendance, people/seating, people/sheets, grades/charts, grades/goals, grades/reports, grades/sheets, todo/missing) |
| B-040 | Class page header | Class tabs row | kept different (five tabs: Course line, Assignments, People, Grades, To do, plus the pages kept in the tab row from Class setup, B-902) | PR5 | #252 | class-gaps-b B-902 |
| B-041 | Class setup | Grading (how the class is graded) | done | PR1 | #252 | B-901 test |
| B-048 | Marking > retake | Add the retake paper... | handed to C (marking screen) |  |  |  |
| B-055 | New class | Choose the ZIP... (student work) | done | PR1 | #252 | B-055 test |
| B-056 | No class page | No class: drag onto a class in the sidebar, or Edit to pick a class | done | PR5 | #252 | class-gaps-b B-056 (No class hint) and B-060 B-056 (sidebar drop) |
| B-060 | Sidebar | Drop a card or unit onto a class in the sidebar (moves it to that class) | done | PR5 | #252 | class-gaps-b B-060 B-056 |
| B-065 | address bar | #/class/<id>/attendance/<day> and /all | done | PR5 | #252 | class-gaps-b B-065 B-039 (people/attendance/<day>, people/attendance/all) |
| B-066 | address bar | #/a/<id>/<tab> (grades, insights, examples, return; grades/sheet, insights/consistency) | done | PR5 | #252 | mark-out B-066 (mark/<id>/grades/sheet, insights/consistency; examples goes to library/examples/a/<id>) |
| B-068 | address bar (from Planner sidebar) | #/class-named/<name> -> that class | done | PR1 | #252 | B-067 test |
| B-042 | Focus card | Time tracker (this week line) | handed to C (marking screen) |  |  |  |
| B-046 | Marking > folder not on roster | This is (pick roster student) + Link | handed to C (marking screen) |  |  |  |
| B-049 | Marking screen | Roster picker for the open download (No roster / class) | handed to C (marking screen) |  |  |  |
| B-059 | Share / covers check | Word paper name (open it) | handed to C (marking screen) |  |  |  |
| B-063 | Student details card (while grading) | Only this student | handed to C (marking screen) |  |  |  |
| B-901 | Class page | No "Class setup" menu. Current: Add roster, Import scores…, Grading, Linked classes…, class link, Move up/down. New: Edit roster holds the name, paste, upload, Drive and Delete class; Grading moved under Grades > More; Import scores is not reachable for a class with no roster. | done | PR1 | #252 | B-901 test |
| C-002 | Class gradebook, column | Entry list per task column (from slice C) | done |  | #252 | class-gaps-b B-020 |
| H-004 | undo (audit hooks) | libraryChange undo puts back the whole library | done |  | #252 | libpatch.test.js; class-gaps-b H-004 |
| H-021 | undo (audit hooks) | School undo puts back a whole gs.school copy | done |  | #252 | libpatch.test.js; class-gaps-b H-021 |
| H-028 | class page dates (audit hooks) | gradebook dates use the browser locale until a paper opens | done |  | #252 | class-gaps-b H-028 |
| H-047 | kept rows (audit hooks) | fb/marked counts not backfilled for old downloads | done |  | #252 | class-gaps-b H-047 |
| H-062 | other window (audit hooks) | class Work tab does not refresh on a library change elsewhere | done |  | #252 | class-gaps-b H-062 |
| H-063 | other window (audit hooks) | gradebook and cards do not refresh on marks saved elsewhere | done |  | #252 | class-gaps-b H-062 H-063 |
| H-066 | report comments (audit hooks) | last half-second of a comment lost on closing the tab | done |  | #252 | class-gaps-b H-066 |
| B-902 | class page, tab row | Keep <page> in the tab row / Take it out | done |  | #252 | class-gaps-b B-902 (Class setup > Pages in the tab row; lib.me.tabs as the current app and My setup use it) |
| B-903 | Class > Assignments | Card text after counts are filled in at load (H-047) | done |  | #258 | class-gaps-b "B-903" |
| B-904 | School | Ctrl+Z on the School page redraws | done |  | #258 | class-gaps-b "H-021 B-904" |
| B-905 | Class > People > one student (MYP) | Average, recent tasks and criterion levels on an MYP student page | done |  | #258 | class-gaps-b "B-905" |
| B-906 | Class > Charts (MYP) | MYP charts overview | done |  | #258 | class-gaps-b "B-906" |
