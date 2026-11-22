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
| A-005 | closed: Find offers Convert to PDF pages while the assignment has Word papers; it opens the one on screen (else the first) and asks | mark-word.test.js "A-005" | 837531ef |
| A-091 | kept different: the current app's Display box is split by where each choice belongs: app text size in Settings > Display, new text boxes, paper fit and Word size and spacing in Settings > Marking, the paper's zoom on the marking toolbar; no extra press on the marking screen | settings-grading.test.js "mark colours…", "A-097" | 758b794d |
| A-092 | closed: Mark key is in More for this paper (and Settings > Marking), the same card | mark-files.test.js (C-074 Mark key from More for this paper) | 758b794d |
| A-093 | kept different: Dark mode / Light mode is in Find on every screen, the marking screen too, not a More menu button, so the screen stays under 25 presses | mark-keyboard.test.js "A-093" | 758b794d |
| A-096 | kept different: the paper's zoom is the toolbar's − / percent / + (percent back to 100%), Ctrl + − 0, Ctrl and the wheel or a pinch, 50–300%, instead of a 50–250% slider in a box | mark-keyboard.test.js "C-034", "C-064" | 758b794d |
| A-097 | closed: Back to normal in Settings > Marking's paper and text card: text boxes, fit, Word size and spacing, the paper zoom and the app text size as they start, the crop kept | settings-grading.test.js "A-097" | 758b794d |
| A-104 | closed: Ctrl/⌘ + zooms the paper in by 10% | mark-keyboard.test.js "gaps item 9 (C-064)" | 758b794d |
| A-105 | closed: Ctrl/⌘ − zooms the paper out by 10% | mark-keyboard.test.js "gaps item 9 (C-064)" | 758b794d |
| A-106 | closed: Ctrl/⌘ 0 goes back to 100% | mark-keyboard.test.js "gaps item 9 (C-064)" | 758b794d |
| A-095 | closed: Rubric setup's own rubric has From Google Drive beside Bring in a rubric; the file picked comes in as one from the computer does | drive-files.test.js "A-095" (fake Drive) | 087e838a |
| A-099 | closed: Transcripts for every recording is in the Setup menu (the current app's More > This assignment) and in Find, only when there are recordings | mark-readings.test.js "C-075 C-091 C-092 C-093" | 087e838a |
| A-122 | closed: the same Transcripts box (every recording), see A-099 | mark-readings.test.js "C-075 C-091 C-092 C-093" | 087e838a |
| A-100 | closed: Marks from other apps for every paper opens from Find whenever the assignment has PDF papers, as well as from the note above a paper that has some | mark-files.test.js "A-100 A-123" | 087e838a |
| A-123 | closed: the same Marks from other apps box, see A-100 | mark-files.test.js "A-100 A-123" | 087e838a |
| A-103 | closed: Setup > Bring in files has A scan to split… beside its two ways to pick; the pages split onto names are added here | mark-scan.test.js "A-103" | 179e2f84 |
| A-107 | closed: with the calculator open, numbers and signs type into it after a click on the paper | mark.test.js (the calculator part), mark-keyboard.test.js "A-107 A-108" | d95b410f |
| A-108 | closed: Escape closes the calculator from anywhere; Lighting now also closes with Escape when the keyboard is on nothing, no mark picked and no box open (src/polish.js) | mark-keyboard.test.js "A-107 A-108" | d95b410f |
| A-109 | closed: Show beside heads a file's ⋯ when the file can go in the side pane, and puts it there | mark.test.js "A-109" | d95b410f |
| A-110 | closed: already done before this branch: the side pane's edge takes the arrow keys (4% a press) | mark.test.js "the side pane…" | d95b410f |
| A-111 | closed: the rubric in the side pane with nothing written for its scores now links to Rubric setup, as the current app's does; Edit rubric stays by the Score heading (C-044) | mark.test.js "A-109 A-111" | 3212a41c |
| A-112 | closed: already done before this branch: the Timer's asked-for length, at least and at most (setup.talk), and Shorter / Within / Longer; now proved for at most too | mark-notes.test.js "typed notes…" | 3212a41c |
| A-113 | closed: Only this student has Other work: every download of the class, oldest first, with their own score, read from saved work only (a failed read says so) | mark.test.js "A-113 A-114" | 3212a41c |
| A-114 | closed: a row in Other work that has their paper opens it, still only them | mark.test.js "A-113 A-114" | 3212a41c |
| A-115 | closed: a finger or a pencil on the paper folds the list that came out over it in full screen (a mouse press does not) | mark-top.test.js "A-125 A-094 A-102 A-115" | 56cba364 |
| A-116 | kept different: the class name stays as words in the top bar; going back to the class is the × (Close marking goes to the class page), Setup > Gradebook and Find | mark-top.test.js "A-116 A-118 A-121 A-126" | 56cba364 |
| A-117 | kept different: the Examples tab shows once the assignment has examples (with their count); before that Find's Examples opens Library > Examples, so the bar has no empty tab | mark-top.test.js "C-037 … C-062" (Examples in Find) | 56cba364 |
| A-118 | kept different: the top bar says this download's own state (Saving, Saved, Can't save); where her work is kept and Reconnect are Find's Where your work is saved, in Settings > Saving | mark-top.test.js "A-116 A-118 A-121 A-126" | 56cba364 |
| A-119 | kept different: the class's page in the school's system is in Setup (open it, or link it), not on the top bar, so the screen stays under 25 presses | mark-top.test.js "C-037 … C-062" | 56cba364 |
| A-121 | closed: What opened is in Setup (as in the current app's This assignment menu), and in the list's menu and Find | mark-top.test.js "A-116 A-118 A-121 A-126" | 56cba364 |
| A-126 | kept different: see A-118 | mark-top.test.js "A-116 A-118 A-121 A-126" | 56cba364 |
| B-044 | closed: each goal picker in Rubric setup ends with New goal…, which opens her list with a new line ready and picks the goal made | mark-setup.test.js "B-044 B-045", "learning goals in Rubric setup…" | (this commit) |
| B-045 | closed: with no goals yet, Rubric setup has one quiet link, Tag rows (or this score) with learning goals…; with some, Edit goals… | mark-setup.test.js "B-044 B-045" | (this commit) |
