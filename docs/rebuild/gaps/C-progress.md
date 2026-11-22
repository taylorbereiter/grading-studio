# Slice C: the open rows, closed on branch c-rows

Running ledger for the 75 rows the slice C ledger (`rebuild/gaps/C.md` in project files) had open at the start of this branch.
Each closed row names the browser test that presses the control in the new app and sees its effect; where it writes saved work, the
same test opens the result in the current app. Commits are on the local branch `c-rows` (from `c-stack`).

| Row | Status | Test | Commit |
|---|---|---|---|
| (room) | Quick mark's lines moved to their own area (`quick`, `qk.*`): route mark-out 59,926 -> 56,251 | lines.test.js, mark-quick.test.js | 90e4bb37 |
| C-028 | kept different: one primary (Add their file…) plus the Add menu beside it, the same six ways in, Drive added (C-plan) | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | 01c383ba |
| C-032 | closed: Replace… asks where the new file comes from (this computer, Google Drive, drop) when Drive can be used or for a video, as the current app does | drive-files.test.js "C-032 C-086 C-087 C-088 C-089"; mark-files.test.js "a file added, replaced…" | 01c383ba |
| C-035 | closed: the sentence under Nothing turned in yet, and Add their file… | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | 01c383ba |
| C-051 | closed: Add the retake paper… in the retake box until the retake has its own paper | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | 01c383ba |
| B-048 | closed (same control as C-051) | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | 01c383ba |
| C-086 | closed: Replace from Google Drive (fake Drive) | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | 01c383ba |
| C-087 | closed: a new link, Next | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | 01c383ba |
| C-088 | closed: a video file (kept where the current app keeps videos), Google Drive | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | 01c383ba |
| C-089 | closed: Also for the partners with the same video, ticked; a group's shared paper changes for everyone; one Undo puts all back | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | 01c383ba |
| A-098 | closed: files dropped on a name go to that student, on the paper to the student on screen, several on the paper to Bring in files | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | 01c383ba |
| A-101 | closed: a file dragged over the folded list opens its names | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | 01c383ba |
| C-013 | closed: Insights has Summary / Percents / Consistency (Percents hidden for an IB setup, as in the current app) | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-014 | closed: a dot for each paper on the percent line; pressing it opens that paper | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-015 | closed: Who counts menu (late, left out, partial, each with its count), kept for the class in gs.pctView, read by the current app | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-016 | closed: Middle of the class: Average / Middle score | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-017 | closed (restored): Show the average 83% / 83.3% / 83.33% in Percents, the one gs.avgDp setting | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-018 | closed: Target, papers below it flagged in the strip, the tile and the table; the current app's target read back | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-019 | closed: Bands Tens / Fives / My own with the cut boxes; a box left empty drops that band | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-020 | closed: What if adds points to everyone as a preview only; no score changes | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-021 | closed: Papers by percent sorts by each heading, in the current app's order | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-022 | closed: Copy this table | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-023 | closed: score bars and row bars carry a tip for pointing and the keyboard (value, what, who) | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| C-901 | closed: See this as a table under Score spread | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| A-017 | closed: How each row was scored, each row counted by level | mark-out.test.js "C-013 … A-017: Insights > Percents" | 52a44e21 |
| A-018 | closed: Change since the last summative, each student's two percents biggest rise first, a row opens that paper | mark-out.test.js "A-018 A-019" | b8dd5318 |
| A-019 | closed: The same assignment in your other classes (linked by group), lowest to highest, middle half, middle and average | mark-out.test.js "A-018 A-019" | b8dd5318 |
| A-014 | closed: Student details beside each roster name and each name with nothing turned in, opening the class People card (a folder not on the roster has none: the current app's link-a-folder card is not in the new app) | mark-out.test.js "A-014 A-015 A-016" | 00f08709 |
| A-015 | closed: the class's school system link in the Grades footer, named as the teacher named the system | mark-out.test.js "A-014 A-015 A-016" | 00f08709 |
| A-016 | closed (restored): each chip on the paper column (pick one, confirm, differs) opens the grade sheet, and the to-check line has Grade sheet | mark-out.test.js "A-014 A-015 A-016" | 00f08709 |
| H-031 | closed: gradeMarksChanged wired (change.js marksChanged): a grade typed on the paper is read off it 250 ms later, a reading from a mark taken back goes at once | mark.test.js "H-031" | 7dadda0b |
| H-033 | closed: Picked up where you left off (n started), once per window visit (sessionStorage gs.pickedUp, as the current app), only on the marking screen | mark.test.js "H-033 H-036 H-060" | 7dadda0b |
| H-036 | closed: the engines' toast hook says loadEdits' older-rubric note in the screen's words (mark.hl_lost); other engine notes stay quiet as before | mark.test.js "H-033 H-036 H-060" | 7dadda0b |
| H-040 | closed: an undone setting step is named for what came back (lighting, Rubric setup, Marked as returned…), as swapStep's toast | mark-out.test.js "a paper returned from the new app…" | 7dadda0b |
| H-041 | closed: Grade on their own already said '<name> is graded on their own now'; Mark and grade together now names the partners ('Marked and graded once with …'), names joined in the language | mark-group.test.js "group work…", "H-041" | 7dadda0b |
| H-044 | closed: already done before this branch (editors.js storage listener reloads gcore bank); now proved with a second tab | mark-setup.test.js "H-065 H-044" | 7dadda0b |
| H-060 | closed: the right-click menu closes on window blur (scroll already closed it) | mark.test.js "H-033 H-036 H-060" | 7dadda0b |
| H-065 | closed: an open Rubric setup listens on the gs-bank channel and reads the bank again | mark-setup.test.js "H-065 H-044" | 7dadda0b |
