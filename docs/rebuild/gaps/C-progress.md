# Slice C: the open rows, closed on branch c-rows

Running ledger for the 75 rows the slice C ledger (`rebuild/gaps/C.md` in project files) had open at the start of this branch.
Each closed row names the browser test that presses the control in the new app and sees its effect; where it writes saved work, the
same test opens the result in the current app. Commits are on the local branch `c-rows` (from `c-stack`).

| Row | Status | Test | Commit |
|---|---|---|---|
| (room) | Quick mark's lines moved to their own area (`quick`, `qk.*`): route mark-out 59,926 -> 56,251 | lines.test.js, mark-quick.test.js | 90e4bb37 |
| C-028 | kept different: one primary (Add their file…) plus the Add menu beside it, the same six ways in, Drive added (C-plan) | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | PR3 |
| C-032 | closed: Replace… asks where the new file comes from (this computer, Google Drive, drop) when Drive can be used or for a video, as the current app does | drive-files.test.js "C-032 C-086 C-087 C-088 C-089"; mark-files.test.js "a file added, replaced…" | PR3 |
| C-035 | closed: the sentence under Nothing turned in yet, and Add their file… | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | PR3 |
| C-051 | closed: Add the retake paper… in the retake box until the retake has its own paper | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | PR3 |
| B-048 | closed (same control as C-051) | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | PR3 |
| C-086 | closed: Replace from Google Drive (fake Drive) | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | PR3 |
| C-087 | closed: a new link, Next | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | PR3 |
| C-088 | closed: a video file (kept where the current app keeps videos), Google Drive | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | PR3 |
| C-089 | closed: Also for the partners with the same video, ticked; a group's shared paper changes for everyone; one Undo puts all back | drive-files.test.js "C-032 C-086 C-087 C-088 C-089" | PR3 |
| A-098 | closed: files dropped on a name go to that student, on the paper to the student on screen, several on the paper to Bring in files | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | PR3 |
| A-101 | closed: a file dragged over the folded list opens its names | mark-files.test.js "C-035 C-028 C-051 B-048 A-098 A-101" | PR3 |
