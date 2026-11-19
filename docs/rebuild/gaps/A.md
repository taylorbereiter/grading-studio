> **Paused 2026-11-19 12:00 UTC (Taylor). Stopped at: #260 branch holds Find rows, Home lists, today's classes, To do card, class needs, B-064, A-902/903, A-076, A-061/062, and first-load room (58,475 of 60,000). find-a.test.js 'A-008' failed once in a long local run (passes alone); check before merging. Next: A-077 old sample class card, A-139 welcome language, A-901 phone/folder card, then Go back in time and Settings rows.**

# Slice A ledger: Home, shell, settings, saving, help, first run

Rows from rebuild/audit/gaps.md (A-001 to A-139, A-901 to A-903). Status: open / built (PR pending) / done / kept different (reason) / present after all / handed to another slice.

**Counts:** built (PR pending) 30, handed to C 50, handed to D 5, open 57, partly built (PR pending) 1 (of 143)

Hand-overs (screen-owner rule): marking-screen rows and assignment tabs to slice C; Return tab and after-export toast to slice D.

| ID | Kind | Screen | Control | Status | PR | Test | Note |
|---|---|---|---|---|---|---|---|
| A-003 | missing | Find anything | This paper: Add a file / pasted text / pages from…, ⋯ items | handed to C |  |  |  |
| A-005 | missing | Find anything | Convert Word papers to PDF pages | handed to C |  |  |  |
| A-006 | missing | Find anything | Go to: To do, by week | built (PR pending) |  | next/test/browser/find-a.test.js 'A-006, A-007, A-010' | Find row Go to: To do, by week |
| A-007 | missing | Find anything | Go to: Examples | built (PR pending) |  | next/test/browser/find-a.test.js 'A-006, A-007, A-010' | Find row Go to: Examples (Library > Examples) |
| A-009 | missing | Find anything | Downloads kept but not on a card | built (PR pending) |  | next/test/browser/find-a.test.js 'A-009' | uncarded kept downloads that can open, found by name or 'Kept in this browser' |
| A-013 | missing | Find anything | Open your AI beside Grading Studio | built (PR pending) |  | next/test/browser/find-a.test.js 'A-013' | Open <assistant> beside Grading Studio, a window on the right as the current app |
| A-014 | missing | Grades tab | Student page link beside each name (whoBtn) | handed to C |  |  |  |
| A-015 | missing | Grades tab | School system link (mbLink) in Grades footer | handed to C |  |  |  |
| A-017 | missing | Insights tab | How each row was scored (levels per row chart) | handed to C |  |  |  |
| A-018 | missing | Insights tab | Change since the last summative (chart, click a student) | handed to C |  |  |  |
| A-019 | missing | Insights tab | Same assignment in your other classes | handed to C |  |  |  |
| A-037 | missing | Settings > Go back in time | Look / Close (a dated copy, per-assignment detail) | open |  |  |  |
| A-038 | missing | Settings > Go back in time | Restore this assignment | open |  |  |  |
| A-042 | missing | Settings > Marking | Full screen marking: Hide list / Hide list and tools / Show both | handed to C |  |  |  |
| A-043 | missing | Settings > Marking | Full screen side choice | handed to C |  |  |  |
| A-044 | missing | Settings > My setup | Read it first (prompt dialog with Copy) | open |  |  |  |
| A-045 | missing | Settings > My setup | Choose a file… (setup .json/.txt) | open |  |  |  |
| A-046 | missing | Settings > Saving | Moving card: Take my work with me | open |  |  |  |
| A-050 | missing | Today | To do card: Add a to-do… (adds for today) | built (PR pending) |  | next/test/browser/home-a.test.js 'A-050 A-073' | To do card on Home: Add a to-do… adds a line for today |
| A-051 | missing | Today | Drop new student work anywhere | open |  |  |  |
| A-058 | missing | Today | Earlier work (older, returned, nothing to score) | built (PR pending) |  | next/test/browser/home-a.test.js | Earlier work section on Home |
| A-059 | missing | Today | Show all N / Show only the newest | built (PR pending) |  | next/test/browser/home-a.test.js | Show all N / Show only the newest |
| A-065 | missing | Today | Drop a ZIP/folder/files anywhere on Today | open |  |  |  |
| A-067 | missing | Today > Earlier work | Show all / Show only the newest | built (PR pending) |  | next/test/browser/home-a.test.js | Show all N / Show only the newest on Earlier work |
| A-068 | missing | Today > Needs a look | Papers not kept in this browser: drop the download in again | built (PR pending) |  | next/test/browser/home-a.test.js | Needs a look: papers not kept, drop the download in again |
| A-070 | missing | Today > Needs a look | N papers are partly scored (reopen) | built (PR pending) |  | next/test/browser/home-a.test.js | Needs a look: N papers partly scored, opens the papers |
| A-072 | missing | Today > Teaching today | Row notes: taught to slide N, to-dos for class, attendance line | partly built (PR pending) |  | next/test/browser/home-a.test.js 'A-071 A-072' | Taught to slide N of M / taught is built; the class's to-dos and attendance line are still open |
| A-073 | missing | Today > To do card | N more on your list: See everything | built (PR pending) |  | next/test/browser/home-a.test.js 'A-050 A-073' | N more on your list: See everything |
| A-075 | missing | Today > What the class needs next | See who / Open Insights (weakest rubric row card) | built (PR pending) |  | next/test/browser/home-a.test.js 'A-060 A-075' | Weakest rubric row card with See who / Open Insights |
| A-076 | missing | Today > sample note | Things to try: A marked paper, quiz, gradebook, charts, missing work, seating, this week | built (PR pending) |  | next/test/browser/home-a.test.js 'A-076' | The sample strip lists things to try, each opening its page |
| A-077 | missing | Today > sample note | Old sample class: Set up my own / Open the sample papers / Remove the sample class | open |  |  |  |
| A-087 | missing | any | Save failed bar: Try again | built (PR pending) |  | next/test/browser/save-safe.test.js 'A-087, A-088, A-089' | Red bar on every screen when a save fails or only partly saves; audit H-006, H-007 |
| A-088 | missing | any | Save failed bar: Export what I have | built (PR pending) |  | next/test/browser/save-safe.test.js 'A-087, A-088, A-089' and 'tried again by itself' | Try again, plus retry every 20 s as src/saving.js; audit H-006 |
| A-094 | missing | marking | Show the student list tab (full screen) | handed to C |  |  |  |
| A-095 | missing | marking | Rubric file From Google Drive | handed to C |  |  |  |
| A-097 | missing | marking | Back to normal | handed to C |  |  |  |
| A-098 | missing | marking | Drop files on a student’s name or the paper (adds to that student; many on paper = Bring in) | handed to C |  |  |  |
| A-099 | missing | marking | Transcripts | handed to C |  |  |  |
| A-101 | missing | marking | Drag a file over the strip opens the names | handed to C |  |  |  |
| A-102 | missing | marking | Pointer at left edge in full screen shows list | handed to C |  |  |  |
| A-104 | missing | marking | Ctrl/⌘ + zoom paper in | handed to C |  |  |  |
| A-105 | missing | marking | Ctrl/⌘ − zoom paper out | handed to C |  |  |  |
| A-106 | missing | marking | Ctrl/⌘ 0 zoom back to 100% | handed to C |  |  |  |
| A-113 | missing | marking (only this student) | Other work (this student’s other assignments) | handed to C |  |  |  |
| A-114 | missing | marking (only this student) | Open another of their assignments | handed to C |  |  |  |
| A-119 | missing | marking top bar | School system class link (topMb) | handed to C |  |  |  |
| A-122 | missing | marking top bar | Transcripts (every recording) | handed to C |  |  |  |
| A-125 | missing | marking top bar | Full screen (marking) | handed to C |  |  |  |
| A-127 | missing | moving | Later / Open the new address / Take my work with me | open |  |  |  |
| A-139 | missing | welcome | Language picker | open |  |  |  |
| A-002 | different | Find anything | Gradebook | handed to C |  |  |  |
| A-004 | different | Find anything | This assignment: Mark / Grades / Grade sheet / Insights / Consistency / Examples / Return | handed to C |  |  |  |
| A-008 | different | Find anything | Class pages: gradebook, students, attendance, seating, missing work, charts, report comments, goals | built (PR pending) |  | next/test/browser/find-a.test.js 'A-008' | Find has each class's attendance, seating plan, charts, goals, report comments and missing work, each opening its page (slice B's addresses) |
| A-010 | different | Find anything | Where my work is saved / Learning goals / Go back in time / Updates | built (PR pending) |  | next/test/browser/find-a.test.js 'A-006, A-007, A-010' | Find has Where your work is saved, Learning goals, Go back in time and Updates, each opening its Settings group |
| A-011 | different | Find anything | Dark mode / Light mode (switches) | built (PR pending) |  | next/test/browser/find-a.test.js 'A-011' | Dark mode / Light mode rows switch the look in one press, back to the light look she had |
| A-012 | different | Find anything | Screenshot (S, ⌥S) from any screen | built (PR pending) |  | next/test/browser/find-a.test.js 'A-012' | Screenshot row on every screen but marking (marking keeps S and Alt S) |
| A-016 | different | Grades tab | On the paper chips link to grade sheet (pick one / confirm / differs) | handed to C |  |  |  |
| A-020 | different | Return tab | Ask your AI: Papers with names covered (Check the covers) | handed to D |  |  |  |
| A-021 | different | Return tab | Ask your AI: Marks only (Make the file) | handed to D |  |  |  |
| A-022 | different | Return tab | Ask your AI: Bring back feedback (Paste a reply) | handed to D |  |  |  |
| A-023 | different | Return tab | Rescans: Show | handed to D |  |  |  |
| A-028 | different | Settings > Classes | Class row: Open | open |  |  |  |
| A-029 | different | Settings > Classes | Class row: Name and roster | open |  |  |  |
| A-030 | different | Settings > Classes | Class row: school system link | open |  |  |  |
| A-031 | different | Settings > Classes | From Google Classroom… | open |  |  |  |
| A-032 | different | Settings > Classes | Add a class | open |  |  |  |
| A-033 | different | Settings > Classes | No classes yet | open |  |  |  |
| A-034 | different | Settings > Display | Text size and zoom (dialog) | open |  |  |  |
| A-036 | different | Settings > Go back in time | Choose a folder… (no folder) | open |  |  |  |
| A-039 | different | Settings > Grades | Term setup (terms, weights, extra credit summary) | open |  |  |  |
| A-040 | different | Settings > Grades | Open the rubric bank (with count) | open |  |  |  |
| A-041 | different | Settings > Marking | Word papers: Keep as Word / Convert to PDF pages | open |  |  |  |
| A-047 | different | Settings > Working with AI | Others you switch to (checkboxes) | open |  |  |  |
| A-048 | different | To do > side pane | Add someone… / Someone new… | open |  |  |  |
| A-049 | different | Today | Focus: Goal and timer | open |  |  |  |
| A-052 | different | Today | Choose files… | open |  |  |  |
| A-053 | different | Today | More ways (menu) | open |  |  |  |
| A-054 | different | Today | A folder of papers… | open |  |  |  |
| A-055 | different | Today | A scan of everyone’s papers… | open |  |  |  |
| A-056 | different | Today | Files to match to a roster… | open |  |  |  |
| A-057 | different | Today | From Google Drive… | open |  |  |  |
| A-060 | different | Today | Ready to hand back / Needs a look / What the class needs next (side column) | built (PR pending) |  | next/test/browser/home-a.test.js 'A-060 A-075' | Side column now has To do, Needs you, Needs a look and What the class needs next |
| A-061 | different | Today | Try it with a sample class (footer) | built (PR pending) |  | next/test/browser/home-a.test.js 'A-061 A-062' | Home ends with where work is kept and Try it with a sample class |
| A-062 | different | Today | Try it with a sample class | built (PR pending) |  | next/test/browser/home-a.test.js 'A-061 A-062' | Try it with a sample class on Home opens the sample |
| A-063 | different | Today | Scan of everyone (pickScan) | open |  |  |  |
| A-064 | different | Today | Files or folder | open |  |  |  |
| A-066 | different | Today | Your timetable isn’t here yet + Open the Planner | open |  |  |  |
| A-069 | different | Today > Needs a look | Your work is not backed up / take-home file N days old | built (PR pending) |  | next/test/browser/home-a.test.js | Needs a look: not backed up / take-home file N days old (gs.lastBackup), only when the folder question isn't asking |
| A-071 | different | Today > Teaching today | Each class row: Present / Open / Plan it | built (PR pending) |  | next/test/browser/home-a.test.js 'A-071 A-072' | Each class in today's strip goes to Present (for that class), its lesson, or Plan it; the Present button presents |
| A-074 | different | Today > To mark | Forget (remove papers, marks, scores) | built (PR pending) |  | next/test/browser/home-a.test.js | Forget in each download row's menu (mark, hand back, earlier), asked first |
| A-078 | different | Today header | Google: email · sync state (Sign in again) / Sign out | open |  |  |  |
| A-079 | different | Today header | Sign in with Google | open |  |  |  |
| A-080 | different | Today top | Reconnect / Decide (folder needs a click), shown at top of Today | open |  |  |  |
| A-084 | different | any | Full screen buttons [data-gsfull] | open |  |  |  |
| A-085 | different | any | F full screen (anywhere but text boxes) | open |  |  |  |
| A-091 | different | marking | Display (text size and zoom) | handed to C |  |  |  |
| A-092 | different | marking | Mark key | handed to C |  |  |  |
| A-093 | different | marking | Dark mode | handed to C |  |  |  |
| A-096 | different | marking | Paper zoom slider 50–250% | handed to C |  |  |  |
| A-100 | different | marking | Marks from other apps | handed to C |  |  |  |
| A-116 | different | marking top bar | Class name crumb (back to class) | handed to C |  |  |  |
| A-117 | different | marking top bar | Examples tab (this assignment) | handed to C |  |  |  |
| A-118 | different | marking top bar | Save state / where saved (opens Where box, Reconnect) | handed to C |  |  |  |
| A-120 | different | marking top bar | Roster for this assignment (select) | handed to C |  |  |  |
| A-121 | different | marking top bar | What opened | handed to C |  |  |  |
| A-123 | different | marking top bar | Marks from other apps | handed to C |  |  |  |
| A-124 | different | marking top bar | Unit plan link / + Unit plan link; + school system link | handed to C |  |  |  |
| A-126 | different | marking top bar | Where saved (top bar) opens box / Reconnect | handed to C |  |  |  |
| A-128 | different | phone | Phone tabs: Today / Plans / Scores / To do / More | open |  |  |  |
| A-130 | different | phone > More | Update now / Reload to update / Check | open |  |  |  |
| A-132 | different | sidebar | Focus (timer panel) | open |  |  |  |
| A-133 | different | sidebar | Planner | open |  |  |  |
| A-134 | different | sidebar | Examples | open |  |  |  |
| A-135 | different | sidebar | Saved / Not backed up (opens Where your work is saved) | open |  |  |  |
| A-136 | different | sidebar | Full screen | open |  |  |  |
| A-001 | unsure | Find anything | Bring back from your AI assistant | handed to C |  |  |  |
| A-024 | unsure | School | Add a link / Add files… / From Google Drive… / Add a note | open |  |  |  |
| A-025 | unsure | School | Search your school resources | open |  |  |  |
| A-026 | unsure | School | Show to-dos for a person / new line Talk to <person> | open |  |  |  |
| A-027 | unsure | Settings > About | Reload this tab (another tab updated) | built (PR pending) |  | next/test/browser/save-safe.test.js 'A-027' | Update now saves first, refuses while a save fails, reloads only its own window; others show Reload to update; audit H-008, H-009 |
| A-035 | unsure | Settings > Display | Language could not be fetched, this visit is in English | open |  |  |  |
| A-081 | unsure | after export | Toast: Mark as returned | handed to D |  |  |  |
| A-082 | unsure | any | That’s a take-home file, not papers | open |  |  |  |
| A-083 | unsure | any | Some files your folder lists aren’t in it any more | open |  |  |  |
| A-086 | unsure | any | Another tab entered/left the sample: this one reloads | open |  |  |  |
| A-089 | unsure | any | Leave-page warning while not saved | built (PR pending) |  | next/test/browser/save-safe.test.js 'A-087, A-088, A-089' | Export what I have opens Return for that download |
| A-090 | unsure | any | Daily visit count (no controls) | open |  |  |  |
| A-103 | unsure | marking | A scan into this download (data-scanin) | handed to C |  |  |  |
| A-107 | unsure | marking | Typing into the calculator while open | handed to C |  |  |  |
| A-108 | unsure | marking | Esc closes Lighting / Calculator panel | handed to C |  |  |  |
| A-109 | unsure | marking | Keep this beside (from a file menu) | handed to C |  |  |  |
| A-110 | unsure | marking | Arrow keys resize pane grip | handed to C |  |  |  |
| A-111 | unsure | marking | Edit rubric (no level words yet) | handed to C |  |  |  |
| A-112 | unsure | marking | Talk timer: asked-for length min/max | handed to C |  |  |  |
| A-115 | unsure | marking paper | Touch on paper folds a peeking list | handed to C |  |  |  |
| A-129 | unsure | phone | Esc closes paper view | open |  |  |  |
| A-131 | unsure | phone > Scores | See the paper (phSee) | open |  |  |  |
| A-137 | unsure | split | Leave / Keep sorting | handed to C |  |  |  |
| A-138 | unsure | start | Stop and put my work back (slow update) | open |  |  |  |
| A-901 | missing | Home, first run | No "Sign in with Google / Use on your phone" card and no "Already have a Grading Studio folder? Choose it and your work comes back." line (current Today has both). | open |  |  |  |
| A-902 | different | Home, Needs you | Only the small arrow at the right end of each row opens it; clicking the row's text does nothing (current: the whole row). | built (PR pending) |  | next/test/browser/home-a.test.js 'A-902' | The whole Needs you row opens it; its menu button still opens on its own |
| A-903 | different | Home, class now card | Present opens the lesson page, not the presentation (one more press). | built (PR pending) |  | next/test/browser/home-a.test.js 'A-071 A-072' | Present on the class-now card goes straight to the presentation for that class |
| B-064 | missing | Today > Teaching today | Take attendance / Attendance taken line under each of the day's classes (taken from slice B; current src/attend.js:202) | built (PR pending) |  | next/test/browser/home-a.test.js 'B-064' | Each of today's classes with a roster says Take attendance or Attendance taken with late/absent/excused counts, and opens that class's attendance page |

## Audit hooks (rebuild/audit/hooks.md) for slice A

| Hook | Where it stands |
|---|---|
| H-006 | A-088 |
| H-007 | A-087 |
| H-008 | A-027 |
| H-009 | A-027 |
| H-022 | open (setup rows) |
| H-023 | open (first run) |
| H-024 | open (settings undo) |
| H-026 | open (folder sync) |
| H-034 | open |
| H-043 | open |
| H-045 | open |
| H-046 | open |
| H-049 | open |
| H-050 | open |
| H-056 | open |
| H-057 | open |
| H-068 | open |
| H-069 | open |
