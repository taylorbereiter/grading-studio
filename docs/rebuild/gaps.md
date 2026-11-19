# Gaps: the current app against the new app (switch branch, PR #246)

Written 19 Nov 2026 by the audit thread. Every row is a control the current app has that the new app lacks (**missing**), has in a reduced or moved form (**different**), or that could not be settled from the code (**unsure**). "Where" is the current app's file and line on main (eb478a1). "New" is the closest place in next/src on the switch branch, if any.

Each row has an ID (A-001…): the letter is the stage 8 slice that owns it (E1 = Planner lesson editor and side panel, E2 = the rest of the Planner). Slice ledgers and rebuild/audit/status.md refer to rows by ID. Rows added by the browser crawl are marked pass 2 and numbered from 900.

How it was made and how far it can be trusted: see coverage.md. In short, every one of the current app's 140 source files was read control by control (2,027 controls), each was looked for in the new app's code, and a sample of the missing ones was pressed in the running new app. Every pressed one was confirmed.

## The ones a teacher meets first

These are the gaps most likely to stop a teacher in a normal week. Each is listed again, with its source line, in the tables below.

**Getting papers in**
1. Home has no place to drop papers and no Choose files. Papers come in only on an assignment card in a class, so an assignment must exist first.
2. Papers can't be dropped on a student's name or on the paper while marking. Bring in files and Match files take single files, never a whole folder.
3. No Google Drive anywhere on the marking screen: not in + Add, Replace, the rubric, or Partners and videos.
4. New and Edit assignment have no "Bring in a rubric…" or rubric from Drive. The rubric can be set only after papers are open.

**Marking**
5. No full screen while marking (no button, no setting, F is taken).
6. No Gradebook button or gradebook box on the marking screen; no class average in the top bar.
7. Readings (a file shown above every paper, or for one student) is gone entirely.
8. Transcripts for every recording at once is gone; only one recording at a time.
9. Zoom: no Ctrl/Cmd + − 0, no Ctrl-scroll or trackpad pinch, the % label doesn't reset.
10. YouTube and Vimeo links lose skip ±10 s, speed, "+ Time to comment" and transcript following.
11. The student bar lost Student details, Only this student, "More for this paper" and "Type notes instead". The score panel lost plain Next, Edit rubric and "Export this student's paper now".
12. Focus can't set or change a session goal (N papers, finish the set, own words), and Focus is no longer in the sidebar.

**Grades and return**
13. Insights has no Percents tab (who counts, average or middle, target, bands, what-if, sortable table, copy) and lost three charts.
14. Return has no "things to look at before you return these" check.
15. Class charts lost five charts; the student page is fixed to the current term and lost its assignment strip and charts, and arrow keys between students.
16. Import scores can't build a roster for a class that has none.
17. "Also called" spellings can't be added or removed; "Paste IDs and emails" is gone.

**Planner**
18. No full-text search inside slides, documents and units; the command bar finds lessons by title only.
19. No Semester view, no date jump, no list of all lessons, no "lesson without a class".
20. A lesson can't be given a second class or day, or taken off one.
21. Slide editor: no video link, no dropping or pasting pictures, no dragging thumbnails, no layout picker.
22. Present: the timer is keys only (no presets, pause, own time, sound, big); no agenda ticks, groups, links, blank or full screen buttons; no floating timer after Present.
23. The AI box (gather slides, pages, notes and copy them in one go) is gone everywhere. Beside lost Activities, resizing and PDF drop.
24. Planner setup file save and load is gone, and lesson packs can't be imported.

**Settings and safety**
25. Go back in time is all or nothing: no looking at a dated copy, no "Restore this assignment".
26. No red failed-save bar with Try again and Export what I have.
27. Settings lost the Word papers choice, the Terms card and the classes list.
28. The welcome screen has no language picker.


## Home, shell, settings, saving, help, first run


### Missing (50)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| A-003 | Find anything | This paper: Add a file / pasted text / pages from…, ⋯ items | shell.js:92 |  | + Add and ⋯ menu items are not commands |
| A-005 | Find anything | Convert Word papers to PDF pages | shell.js:108 |  | No command |
| A-006 | Find anything | Go to: To do, by week | shell.js:119 |  | No command for the week view |
| A-007 | Find anything | Go to: Examples | shell.js:122 |  | Library commands cover activities, past, units, rubrics only (shell.jsx:215) |
| A-009 | Find anything | Downloads kept but not on a card | shell.js:135 |  | find-rows lists only carded assignments |
| A-013 | Find anything | Open your AI beside Grading Studio | shell.js:165 |  | No command; sidebar link only |
| A-014 | Grades tab | Student page link beside each name (whoBtn) | app/dialogs.js:235 |  | Grades table has no link to the student’s own page |
| A-015 | Grades tab | School system link (mbLink) in Grades footer | app/dialogs.js:248 |  |  |
| A-017 | Insights tab | How each row was scored (levels per row chart) | tabs.js:124 |  | Only row averages |
| A-018 | Insights tab | Change since the last summative (chart, click a student) | tabs.js:148 |  |  |
| A-019 | Insights tab | Same assignment in your other classes | tabs.js:173 |  |  |
| A-037 | Settings > Go back in time | Look / Close (a dated copy, per-assignment detail) | safe.js:105 |  | Copies list has only Go back for everything |
| A-038 | Settings > Go back in time | Restore this assignment | safe.js:120 |  | Cannot put back one assignment from an earlier day |
| A-042 | Settings > Marking | Full screen marking: Hide list / Hide list and tools / Show both | app.html:703 |  | gs.fullSide only readable via My setup engine; no control, and no full screen while marking at all |
| A-043 | Settings > Marking | Full screen side choice | app/wiring.js:194 |  |  |
| A-044 | Settings > My setup | Read it first (prompt dialog with Copy) | setupin.js:748 |  |  |
| A-045 | Settings > My setup | Choose a file… (setup .json/.txt) | setupin.js:751 |  | Paste only |
| A-046 | Settings > Saving | Moving card: Take my work with me | moving.js:197 |  | No moving-address notice in new app |
| A-050 | Today | To do card: Add a to-do… (adds for today) | app.html:555 |  | Home has no add box; only link to To do |
| A-051 | Today | Drop new student work anywhere | app.html:562 |  | New app has no drop zone on Home; papers come in only on an assignment in a class (class-work.jsx:205) |
| A-058 | Today | Earlier work (older, returned, nothing to score) | app.html:578 |  | Home shows no Earlier work list |
| A-059 | Today | Show all N / Show only the newest | app.html:581 |  |  |
| A-065 | Today | Drop a ZIP/folder/files anywhere on Today | app/wiring.js:47 |  |  |
| A-067 | Today > Earlier work | Show all / Show only the newest | today.js:180 |  |  |
| A-068 | Today > Needs a look | Papers not kept in this browser: drop the download in again | shell.js:60 |  | No such row on Home |
| A-070 | Today > Needs a look | N papers are partly scored (reopen) | shell.js:65 |  | Needs you list has mark rows but no partly-scored reopen row |
| A-072 | Today > Teaching today | Row notes: taught to slide N, to-dos for class, attendance line | today.js:66 |  | No taught-to-slide, class to-do or attendance line on Home |
| A-073 | Today > To do card | N more on your list: See everything | todo.js:349 |  | No To do card on Home |
| A-075 | Today > What the class needs next | See who / Open Insights (weakest rubric row card) | today.js:150 |  | No such card on Home |
| A-076 | Today > sample note | Things to try: A marked paper, quiz, gradebook, charts, missing work, seating, this week | welcome.js:172 |  | Sample strip only says what it is and Leave |
| A-077 | Today > sample note | Old sample class: Set up my own / Open the sample papers / Remove the sample class | welcome.js:175 |  | Legacy sample class card has no counterpart; such a class would need deleting by hand |
| A-087 | any | Save failed bar: Try again | saving.js:58 |  | Marking shows only "Not saved"; no red bar with Try again |
| A-088 | any | Save failed bar: Export what I have | saving.js:58 |  |  |
| A-094 | marking | Show the student list tab (full screen) | app.html:800 |  | No full screen marking |
| A-095 | marking | Rubric file From Google Drive | app/dialogs.js:104 |  | No Drive choice for the rubric file |
| A-097 | marking | Back to normal | app/display.js:123 |  | No reset for display settings |
| A-098 | marking | Drop files on a student’s name or the paper (adds to that student; many on paper = Bring in) | app/wiring.js:70 |  | Only the + Add > file picker and Bring in files |
| A-099 | marking | Transcripts | app/wiring.js:79 |  |  |
| A-101 | marking | Drag a file over the strip opens the names | app/wiring.js:140 |  | No file drop on names |
| A-102 | marking | Pointer at left edge in full screen shows list | app/wiring.js:151 |  | No full screen marking |
| A-104 | marking | Ctrl/⌘ + zoom paper in | app/wiring.js:233 |  | Browser zoom happens instead |
| A-105 | marking | Ctrl/⌘ − zoom paper out | app/wiring.js:234 |  |  |
| A-106 | marking | Ctrl/⌘ 0 zoom back to 100% | app/wiring.js:235 |  |  |
| A-113 | marking (only this student) | Other work (this student’s other assignments) | solo.js:64 |  | Solo bar has only the name and Hold to show everyone |
| A-114 | marking (only this student) | Open another of their assignments | solo.js:80 |  |  |
| A-119 | marking top bar | School system class link (topMb) | app.html:758 |  | Not on the marking screen |
| A-122 | marking top bar | Transcripts (every recording) | app.html:767 |  | Only one recording at a time in the media panel |
| A-125 | marking top bar | Full screen (marking) | app.html:794 |  | No full-screen button on marking screen; F is taken by Feedback and the global F is off on the marking screen (shell.jsx:191) |
| A-127 | moving | Later / Open the new address / Take my work with me | moving.js:209 |  |  |
| A-139 | welcome | Language picker | welcome.js:60 |  | The welcome has no language choice |

### Different (65)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| A-002 | Find anything | Gradebook | app.html:782 | app/screens/class.jsx:23 | No command from the marking screen; class Grades tab |
| A-004 | Find anything | This assignment: Mark / Grades / Grade sheet / Insights / Consistency / Examples / Return | shell.js:94 | app/screens/mark.jsx:505 | Only the four tabs; no Grade sheet, Consistency or Examples rows |
| A-008 | Find anything | Class pages: gradebook, students, attendance, seating, missing work, charts, report comments, goals | shell.js:127 | app/help/find.js:28 | Only work, people, grades, to do pages |
| A-010 | Find anything | Where my work is saved / Learning goals / Go back in time / Updates | shell.js:151 | app/help/find.js:16 | Learning goals has no row |
| A-011 | Find anything | Dark mode / Light mode (switches) | shell.js:155 | app/shell.jsx:199 | Opens Settings > Display |
| A-012 | Find anything | Screenshot (S, ⌥S) from any screen | shell.js:164 | app/screens/mark-tools.jsx:138 | Only on the marking screen |
| A-016 | Grades tab | On the paper chips link to grade sheet (pick one / confirm / differs) | tabs.js:21 | app/screens/mark-out.jsx:73 | Pills shown, not links to the grade sheet |
| A-020 | Return tab | Ask your AI: Papers with names covered (Check the covers) | tabs.js:91 | app/screens/mark.jsx:497 | Not on Return; Setup > Share |
| A-021 | Return tab | Ask your AI: Marks only (Make the file) | tabs.js:92 | app/screens/mark.jsx:497 | Not on Return; Setup > Share |
| A-022 | Return tab | Ask your AI: Bring back feedback (Paste a reply) | tabs.js:93 | app/mark/share.jsx:153 | Not on Return; inside Share |
| A-023 | Return tab | Rescans: Show | tabs.js:94 | app/screens/mark.jsx:545 | Not on Return; flag button on the Mark tab |
| A-028 | Settings > Classes | Class row: Open | settings.js:34 | app/shell.jsx:100 | No class list in Settings |
| A-029 | Settings > Classes | Class row: Name and roster | settings.js:34 | app/screens/class.jsx | Only on each class page |
| A-030 | Settings > Classes | Class row: school system link | settings.js:34 | app/class/classlink.jsx | Only on each class page |
| A-031 | Settings > Classes | From Google Classroom… | settings.js:35 | app/screens/class.jsx | Only from Add a class / command bar |
| A-032 | Settings > Classes | Add a class | settings.js:35 | app/shell.jsx:101 | Sidebar only |
| A-033 | Settings > Classes | No classes yet | settings.js:36 | app/screens/home.jsx:131 |  |
| A-034 | Settings > Display | Text size and zoom (dialog) | app.html:717 | app/screens/settings-more.jsx:220 | Split: app size in Display, text box/fit/Word in Marking; paper zoom slider and Back to normal gone (see app/display.js) |
| A-036 | Settings > Go back in time | Choose a folder… (no folder) | safe.js:94 | app/screens/settings-saving.jsx:121 | History card says link a folder; button is in the Where card above |
| A-039 | Settings > Grades | Term setup (terms, weights, extra credit summary) | settings.js:41 | app/class/bookedit.jsx:98 | Only inside a class Grades tab; Help answer links to Settings > Classes which has no terms card |
| A-040 | Settings > Grades | Open the rubric bank (with count) | settings.js:48 | app/screens/library.jsx:21 | Library > Rubrics; no link or count in Settings |
| A-041 | Settings > Marking | Word papers: Keep as Word / Convert to PDF pages | app.html:697 | app/mark/fileui.jsx:190 | No Settings control; only the From now on checkbox inside a paper’s Convert to PDF box |
| A-047 | Settings > Working with AI | Others you switch to (checkboxes) | welcome.js:205 | app/screens/settings-more.jsx:88 | List saved, but the sidebar link never offers them: no way to switch assistant from the sidebar |
| A-048 | To do > side pane | Add someone… / Someone new… | todo.js:441 | app/screens/todo.jsx:256 | No Someone new… option: a new person cannot be made from a to-do; and the field is hidden when there are no School people yet |
| A-049 | Today | Focus: Goal and timer | app.html:555 | app/screens/home.jsx:70 | Home has a Focus button (opens timer); no link to goal settings on Home |
| A-052 | Today | Choose files… | app.html:567 | app/screens/class-work.jsx:216 | Only from an assignment card on a class Work tab; an assignment must exist first |
| A-053 | Today | More ways (menu) | app.html:568 | app/screens/class-work.jsx:216 | Same options live in each assignment card menu |
| A-054 | Today | A folder of papers… | app.html:569 | app/screens/class-work.jsx:216 | Per assignment only |
| A-055 | Today | A scan of everyone’s papers… | app.html:570 | app/screens/class-work.jsx:177 | Per assignment only |
| A-056 | Today | Files to match to a roster… | app.html:571 | app/screens/class-work.jsx:122 | Per assignment only |
| A-057 | Today | From Google Drive… | app.html:572 | app/screens/class-work.jsx:119 | Per assignment only |
| A-060 | Today | Ready to hand back / Needs a look / What the class needs next (side column) | app.html:584 | app/screens/home.jsx:138 | Hand back rows kept; Needs a look and What the class needs next missing (see today.js, shell.js rows) |
| A-061 | Today | Try it with a sample class (footer) | app.html:586 | app/screens/settings.jsx:57 | Not on Home; in Settings > Display, welcome and command bar |
| A-062 | Today | Try it with a sample class | app/wiring.js:17 | app/screens/settings.jsx:57 | Settings > Display |
| A-063 | Today | Scan of everyone (pickScan) | app/wiring.js:21 | app/screens/class-work.jsx:177 | Per assignment |
| A-064 | Today | Files or folder | app/wiring.js:22 | app/screens/class-work.jsx:122 | Files only per assignment; folder choice unsure |
| A-066 | Today | Your timetable isn’t here yet + Open the Planner | today.js:57 | app/screens/home.jsx:43 | Empty state has no button to open the timetable |
| A-069 | Today > Needs a look | Your work is not backed up / take-home file N days old | shell.js:63 | app/screens/home.jsx:84 | FolderAsk card covers no-folder; no take-home age reminder |
| A-071 | Today > Teaching today | Each class row: Present / Open / Plan it | today.js:65 | app/screens/home.jsx:55 | Buttons only for the class on now; other rows are plain text |
| A-074 | Today > To mark | Forget (remove papers, marks, scores) | today.js:88 | app/class/assignment.jsx:151 | Forget is on the class Work tab card, not on Home |
| A-078 | Today header | Google: email · sync state (Sign in again) / Sign out | app/drive.js:99 | app/screens/settings-saving.jsx:42 | Not on Home header; in Settings > Saving and More (phone) |
| A-079 | Today header | Sign in with Google | app/drive.js:100 | app/screens/settings-saving.jsx:40 | Settings only on a computer; phone Home has its card |
| A-080 | Today top | Reconnect / Decide (folder needs a click), shown at top of Today | folder.js:623 | app/screens/settings-saving.jsx:101 | Only in Settings > Saving; sidebar just says it in amber |
| A-084 | any | Full screen buttons [data-gsfull] | fullscreen.js:38 | app/screens/settings-more.jsx:232 | Only in Settings > Display (and F) |
| A-085 | any | F full screen (anywhere but text boxes) | fullscreen.js:41 | app/shell.jsx:191 | Not on the marking screen or in Present |
| A-091 | marking | Display (text size and zoom) | app.html:787 | app/screens/settings-more.jsx:220 | Only in Settings now |
| A-092 | marking | Mark key | app.html:788 | app/screens/settings-grading.jsx:176 | Only in Settings > Marking |
| A-093 | marking | Dark mode | app.html:790 | app/shell.jsx:199 | Command opens Settings > Display instead of switching |
| A-096 | marking | Paper zoom slider 50–250% | app/display.js:118 | app/screens/mark.jsx:545 | Only + / − buttons on the paper (50–300%); no slider |
| A-100 | marking | Marks from other apps | app/wiring.js:85 | app/mark/fileui.jsx:269 | Only via note on paper |
| A-116 | marking top bar | Class name crumb (back to class) | app.html:749 | app/screens/mark.jsx:519 | Class name shown but not a link; X closes to the class |
| A-117 | marking top bar | Examples tab (this assignment) | app.html:752 | app/screens/library.jsx:21 | No tab on the marking screen; examples are under Library > Examples |
| A-118 | marking top bar | Save state / where saved (opens Where box, Reconnect) | app.html:756 | app/screens/mark.jsx:523 | Status text only, not clickable |
| A-120 | marking top bar | Roster for this assignment (select) | app.html:763 | app/class/assignment.jsx:85 | Not in Setup; class is chosen in Edit assignment on the class page |
| A-121 | marking top bar | What opened | app.html:766 | app/screens/mark.jsx:552 | Moved to the student list (report button) |
| A-123 | marking top bar | Marks from other apps | app.html:772 | app/mark/fileui.jsx:269 | No menu item; only reachable from the note shown on a paper that has such marks |
| A-124 | marking top bar | Unit plan link / + Unit plan link; + school system link | app.html:773 | app/class/assignment.jsx | Unit link can be set on the class page; not reachable from the marking screen |
| A-126 | marking top bar | Where saved (top bar) opens box / Reconnect | folder.js:638 | app/screens/mark.jsx:523 | Not clickable |
| A-128 | phone | Phone tabs: Today / Plans / Scores / To do / More | phone.js:22 | app/shell.jsx:32 | Tabs are Home / To do / Classes / Find / More; Scores and Plans are inside a class or Calendar |
| A-130 | phone > More | Update now / Reload to update / Check | phone.js:381 | app/screens/more.jsx:29 | No Check for updates on phone More |
| A-132 | sidebar | Focus (timer panel) | app.html:527 | app/screens/home.jsx:70 | No Focus item in the sidebar; Focus is a button on Home and a command-bar entry (shell.jsx:196) |
| A-133 | sidebar | Planner | app.html:528 | app/shell.jsx:30 | Planner is no longer a separate page: Calendar and Library in the sidebar replace it |
| A-134 | sidebar | Examples | app.html:529 | app/screens/library.jsx:21 | Moved to Library > Examples; no sidebar entry |
| A-135 | sidebar | Saved / Not backed up (opens Where your work is saved) | app.html:536 | app/shell.jsx:78 | New sidebar line is a status only; clicking it opens nothing (no Where dialog, no Reconnect/Decide action) |
| A-136 | sidebar | Full screen | app.html:538 | app/screens/settings-more.jsx:232 | No sidebar button; only F key and Settings > Display |

### Unsure (24)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| A-001 | Find anything | Bring back from your AI assistant | app.html:781 | app/mark/share.jsx:153 | Bring back area exists inside Share; no separate command. Open Setup > Share to check |
| A-024 | School | Add a link / Add files… / From Google Drive… / Add a note | app.html:635 | app/screens/school.jsx | School screen not in my group; school.jsx exists. Check its add buttons |
| A-025 | School | Search your school resources | app.html:637 | app/screens/school.jsx |  |
| A-026 | School | Show to-dos for a person / new line Talk to <person> | todo.js:647 | app/screens/school.jsx | School screen not in this group |
| A-027 | Settings > About | Reload this tab (another tab updated) | safe.js:202 | app/update.js | Update in another tab and look here |
| A-035 | Settings > Display | Language could not be fetched, this visit is in English | settings.js:83 | app/lang-load.js | Turn off network, pick a language, reopen |
| A-081 | after export | Toast: Mark as returned | tabs.js:77 | app/screens/mark-out.jsx:169 | New says "once the students have it" in the status line; check toast action |
| A-082 | any | That’s a take-home file, not papers | app/open.js:29 | app/mark/open.js | Pick a .gswork file as papers on an assignment |
| A-083 | any | Some files your folder lists aren’t in it any more | folder.js:555 | whole/folder-run.js | Remove a file from the linked folder and reopen |
| A-086 | any | Another tab entered/left the sample: this one reloads | samplemode.js:141 | app/sample.js:7 | Shared samplemode lines run on both versions (not a control) |
| A-089 | any | Leave-page warning while not saved | saving.js:72 | app/mark/windows.js | Make storage full, try to close tab |
| A-090 | any | Daily visit count (no controls) | visits.js:225 |  | Not a control; check whether new app counts visits |
| A-103 | marking | A scan into this download (data-scanin) | app/wiring.js:199 | app/mark/split.jsx | Split into an open download exists per router note; check Bring in files box |
| A-107 | marking | Typing into the calculator while open | app/wiring.js:279 | app/mark/calc.jsx | Open = and type digits |
| A-108 | marking | Esc closes Lighting / Calculator panel | polish.js:123 | app/mark/calc.jsx | Open calculator, press Esc |
| A-109 | marking | Keep this beside (from a file menu) | sidepane.js:100 | app/screens/mark.jsx | Check a file’s menu for Side by side |
| A-110 | marking | Arrow keys resize pane grip | sidepane.js:182 | app/screens/mark.jsx | mark.sp_size exists |
| A-111 | marking | Edit rubric (no level words yet) | sidepane.js:208 | app/screens/mark.jsx:212 | sp_no_words line; check for a button |
| A-112 | marking | Talk timer: asked-for length min/max | sidepane.js:258 | app/mark/typed.jsx:167 | Check timer pane fields |
| A-115 | marking paper | Touch on paper folds a peeking list | touch.js:80 | app/mark/touch.js |  |
| A-129 | phone | Esc closes paper view | phone.js:225 |  |  |
| A-131 | phone > Scores | See the paper (phSee) | phone.js:222 | app/class/phscores.jsx | Check scored paper row on a phone |
| A-137 | split | Leave / Keep sorting | polish.js:86 | app/mark/split.jsx | Close a split part-way |
| A-138 | start | Stop and put my work back (slow update) | migrate.js:231 | main.js | Not found in new app; check whether a slow data update can be stopped |

## Class page, gradebook, students, charts, reports, school


### Missing (38)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| B-001 | Assignments | Rubric section (Bring in a rubric..., From Google Drive) | app/screens.js:375 | app/class/assignment.jsx:8 | File header says rubric is set on marking screen; not in the box |
| B-003 | Assignments | Also due that week hint | gradeplan.js:54 | app/class/assignment.jsx:106 |  |
| B-004 | Assignments > Add papers | Rubric: Bring in a rubric... / From Google Drive (in the Open box) | app/screens.js:335 |  | The Bring in menu has no rubric; rubric only from marking-screen Setup once papers are open |
| B-007 | Class > Assignments | Card shows time spent grading (time tracker) | app/screens.js:160 |  | Not on new assignment rows |
| B-011 | Class > Charts | Chart: Spread on each assignment (lowest-highest, middle half) | book.js:386 |  | Not drawn in new ChartsSheet |
| B-013 | Class > Charts | Chart: Who is moving (biggest rises and drops) | classpage.js:97 |  | Not drawn in new ChartsSheet |
| B-014 | Class > Charts | Chart: Where the class stands, assignment by assignment (stacks) | classpage.js:124 |  | Not drawn in new ChartsSheet |
| B-015 | Class > Charts | Chart: Rubric rows across the summatives | classpage.js:168 |  | Not drawn in new ChartsSheet |
| B-016 | Class > Charts | Chart: Summatives against in-class work (scatter) | classpage.js:195 |  | Not drawn in new ChartsSheet |
| B-017 | Class > Charts (heatmap) | Student name -> student's page | classpage.js:85 |  | New heatmap rows show the name as plain text; no link to the student |
| B-018 | Class > Goals | Student name -> page | goals.js:187 | app/class/goals.jsx:47 | Names in the goals table are plain text |
| B-021 | Class > Gradebook | Entry list (for this column) | book.js:436 | app/class/bookedit.jsx:38 | Column box has no Entry list; openEntry(key) exists but nothing calls it with a column |
| B-023 | Class > Gradebook (no roster) | Import scores... (class with no roster; the file can become the roster) | book.js:251 | app/class/grades.jsx:66 | New empty state only offers Add roster; import that builds the roster from a gradebook file is unreachable for a rosterless class |
| B-025 | Class > Report comments | Grade cut-offs: highest from / good from / middling from | reports.js:241 | app/class/reports.jsx:99 | New Wording box has only the phrase slots, not the three grade cut-offs |
| B-026 | Class > Students | Paste IDs and emails... (fill many students at once) | people.js:184 | app/class/people.jsx:42 | Only via re-uploading the whole roster file; no paste-and-fill into the existing roster |
| B-027 | Class > Students | Cancel / Fill in (paste box) | people.js:186 |  | See Paste IDs and emails |
| B-029 | Class > Students > one student | Term tabs on a student's page (whole year or any term) | book.js:404 | app/class/people.jsx:98 | New student page is fixed to the current term |
| B-031 | Class > Students > one student | By type bars with class average; feedback count | book.js:415 |  | Not on new student page |
| B-032 | Class > Students > one student | Left/Right arrow = previous/next student | book.js:823 |  | No key to step students |
| B-033 | Class > Students > one student | Every assignment strip (scored/missing/late/feedback) | classpage.js:218 |  | New student page shows only the last 6 assignments as a list |
| B-034 | Class > Students > one student | Chart: Against the class (band line) | classpage.js:232 |  | Not on new student page (only a small sparkline) |
| B-035 | Class > Students > one student | Chart: student's rubric rows vs class average | classpage.js:261 |  | Not on new student page |
| B-038 | Class page | Import scores... (no roster yet) | app/screens.js:188 | app/class/grades.jsx:66 | Not reachable: Grades shows only Add roster for a class with no roster |
| B-043 | Gradebook > Import scores | Use another file | bookimport.js:339 | app/class/bookimport.jsx:180 | Close and reopen instead |
| B-044 | Marking > Rubric setup | New goal... (in the goal picker) | goals.js:25 | app/mark/setup.jsx:190 | Picker only lists existing goals and only shows when there are some; no way to make a goal from Rubric setup |
| B-045 | Marking > Rubric setup | Tag rows / Edit goals... link | goals.js:30 | app/mark/setup.jsx:190 | Goals list is edited only in Settings or the Goals sheet |
| B-047 | Marking > group paper | Use group score (undo a partner's own score for one row) | groups.js:66 |  | No "Use group score" reset or the note listing changed rows found in mark/group.jsx |
| B-050 | Marking screen > Gradebook box | Tabs Table / Class charts / One student | book.js:171 |  | The gradebook box opened while grading is gone (see bookBtn) |
| B-051 | Marking screen > Gradebook box | Class picker select | book.js:236 |  | No class switcher; the box is gone |
| B-052 | Marking screen top bar | Gradebook (#bookBtn) | book.js:832 |  | Marking screen has no button to the class gradebook; only closing goes to the class page |
| B-053 | Marking top bar | + Unit plan link / unit plan ↗ | app/screens.js:357 |  | No unit plan link on the new marking screen |
| B-054 | Marking top bar | School system link / add it | app/screens.js:362 |  | No school-system link on the new marking screen (only in the class header) |
| B-057 | Progress sheets | Open Report comments (drafts not looked at) | sheet.js:41 |  | No link from the draft warning to the report comments |
| B-058 | School > people | N to-dos (for this person) -> To do | school.js:183 | app/screens/school.jsx:195 | No to-do count link on a person row |
| B-061 | Student details card | Remove a spelling (Also called x) | people.js:112 | app/class/people.jsx:184 | Also called is listed read-only; no way to remove one |
| B-062 | Student details card | + add (another spelling) | people.js:113 | app/class/people.jsx:184 | No way to add another spelling of a name (used to match folders and files to the student) |
| B-064 | Today (Home / Planner day) | Take attendance / Attendance taken line under each class | attend.js:202 |  | No attendance line under the day's classes in the new app |
| B-067 | address bar | unknown class name toast (noClass) | app/screens.js:69 |  | No message that the class does not exist; just the class list |

### Different (25)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| B-002 | Assignments | Due date + "Also due that week" hint | app/screens.js:380 | app/class/assignment.jsx:106 | Date kept; the hint of what else is due that week is missing |
| B-005 | Class > Assignments | Click a card (opens papers, or the gradebook if scores were typed in, else Add papers) | app/screens.js:156 | app/screens/class-work.jsx:206 | Row itself is not clickable; Open / Bring in buttons only, and a typed-in card has no way to its gradebook column |
| B-006 | Class > Assignments | Typed in pill on card | app/screens.js:156 | app/screens/class-work.jsx:52 | Status says scores typed in, no pill beside the type |
| B-008 | Class > Assignments | Edit (name, type, due, unit, rubric) | app/screens.js:162 | app/screens/class-work.jsx:217 | Edit box has no rubric part and no due-week hint (see below) |
| B-009 | Class > Assignments | Open other papers... (newer download) | app/screens.js:164 | app/screens/class-work.jsx:214 | Again menu offers files, folder, Drive; not scan, match-to-roster or no-papers |
| B-010 | Class > Assignments | Delete unit (asks if it has assignments; Undo) | app/screens.js:172 | app/screens/class-work.jsx:200 | Deletes at once with Undo, no question first |
| B-012 | Class > Charts | Charts tab for the whole year (term = Whole year) | book.js:404 | app/class/grades.jsx:106 | Charts card only shows for a single term, not for Whole year |
| B-019 | Class > Gradebook | i (details card) beside each name | book.js:197 | app/class/grades.jsx:221 | Name links to the student's page where Details are; no pop-up card |
| B-020 | Class > Gradebook | How this is worked out (details) | book.js:314 | app/class/grades.jsx:235 | Only a hover title on the grade; the open-able explanation is gone |
| B-022 | Class > Gradebook | Enter in name/max saves Add scores | book.js:829 | app/class/bookedit.jsx:190 | Enter in the name box saves; Enter in the Out of box does not |
| B-024 | Class > Report comments | Wording... / Copy all / Download spreadsheet / Progress sheets | reports.js:190 | app/class/reports.jsx:62 | Progress sheets button not in the reports bar (it is a card under Grades) |
| B-028 | Class > Students | Inline ID / Email / Last year per row (type down the table) | people.js:219 | app/class/people.jsx:189 | One student at a time through Details > Edit |
| B-030 | Class > Students > one student | Previous student / Next student | book.js:415 | app/class/people.jsx:114 | No prev/next buttons; pick from roster list |
| B-036 | Class > Students > one student (MYP) | Prev/next student, progress sheet | ib.js:298 | app/class/people.jsx:144 | No prev/next (roster list instead) |
| B-037 | Class page | Grading (MYP/DP way) item | app/screens.js:84 | app/class/grades.jsx:81 | Only in Grades > More, so not reachable before a roster exists |
| B-039 | Class page | #/class/<id>/<tab> panel tabs (gradebook, students, attendance, seating, charts, missing, goals, reports) | classpage.js:12 | app/old-routes.js:7 | Nine tabs folded into five; attendance/seating are buttons on a student's page, missing is in To do, charts/goals/reports are cards under Grades |
| B-040 | Class page header | Class tabs row | app/screens.js:179 | app/screens/class.jsx:139 | Five fixed tabs (Course line, Assignments, People, Grades, To do) |
| B-041 | Class setup | Grading (how the class is graded) | ib.js:84 | app/class/grades.jsx:81 | Only under Grades > More |
| B-048 | Marking > retake | Add the retake paper... | grades.js:178 | app/mark/score-more.jsx:35 | No button; message says to add the paper with Add on the marking screen |
| B-055 | New class | Choose the ZIP... (student work) | classroom.js:39 | app/class/classroom.jsx:60 | Steps say to bring the ZIP in on the Assignments tab; no button here |
| B-056 | No class page | No class: drag onto a class in the sidebar, or Edit to pick a class | app/screens.js:193 | app/screens/class-work.jsx:198 | Sidebar drag gone; Move to.../Edit class picker still work |
| B-060 | Sidebar | Drop a card or unit onto a class in the sidebar (moves it to that class) | app/screens.js:233 | app/screens/class-work.jsx:198 | No sidebar drop; Move to... dialog and Move unit to class instead |
| B-065 | address bar | #/class/<id>/attendance/<day> and /all | app/screens.js:13 | app/old-routes.js:19 | Lands on People tab; the day or the look-back view is lost and the attendance sheet is not opened |
| B-066 | address bar | #/a/<id>/<tab> (grades, insights, examples, return; grades/sheet, insights/consistency) | app/screens.js:30 | app/old-routes.js:18 | examples tab and the sheet/consistency sub-views are dropped; lands on the marking screen or its tab |
| B-068 | address bar (from Planner sidebar) | #/class-named/<name> -> that class | app/screens.js:18 | app/old-routes.js:21 | Goes to the class list, not to the named class |

### Unsure (5)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| B-042 | Focus card | Time tracker (this week line) | tracker.js:249 | app/focus/start.jsx:1 | Check the Focus card for the week line with a link to the tracker |
| B-046 | Marking > folder not on roster | This is (pick roster student) + Link | people.js:129 | app/mark/bringin.jsx:151 | Files to match to a roster exists before opening; check the marking screen for linking an unmatched folder name afterwards |
| B-049 | Marking screen | Roster picker for the open download (No roster / class) | app/screens.js:593 |  | No roster picker found on the new marking screen; open a download that has no class and look for a way to pick its roster |
| B-059 | Share / covers check | Word paper name (open it) | names.js:293 | app/mark/share.jsx:61 | Check the share box lists Word papers that show names with a way to open them |
| B-063 | Student details card (while grading) | Only this student | people.js:110 |  | Check the marking screen's student menu for a solo / only-this-student mode |

## Marking screen, focus, rubrics, assistant


### Missing (51)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| C-004 | Edit assignment dialog | From Google Drive... (rubric) | rubricup.js:90 |  | no Drive pick for a rubric anywhere |
| C-005 | Focus card / panel | Change (session goal) | focus.js:557 | app/focus/start.jsx:81 |  |
| C-006 | Focus card / panel, More | Goal for this session: No goal / N papers / Finish the set (or Finish this to-do) | focus.js:312 | app/focus/start.jsx:81 | Goal for this session is shown but cannot be changed: no picker |
| C-007 | Focus card / panel, More | Fewer / more papers for the goal (- +) | focus.js:317 | app/focus/start.jsx:81 |  |
| C-008 | Focus card / panel, More | Goal in your own words (nothing picked) | focus.js:319 | app/focus/start.jsx:81 |  |
| C-011 | Focus panel, running | Don't carry it over (session goal) | focus.js:335 | app/focus/panel.jsx:41 |  |
| C-012 | Focus panel, running | Mark it done / I got it done (session goal) | focus.js:336 | app/focus/panel.jsx:41 | Goal line only shows progress; a to-do or own-words goal cannot be marked reached |
| C-014 | Insights, Percents | dot per paper (open that paper) | rubrics.js:566 |  |  |
| C-015 | Insights, Percents | Who counts (late / left out / partial ... checkboxes) | rubrics.js:655 |  | Percents tab not ported |
| C-016 | Insights, Percents | Middle of the class: Average / Middle score | rubrics.js:656 |  |  |
| C-018 | Insights, Percents | Target: flag papers below N% | rubrics.js:659 |  |  |
| C-019 | Insights, Percents | Bands: Tens / Fives / My own + own cut boxes | rubrics.js:660 |  |  |
| C-020 | Insights, Percents | What if: add N points to everyone (preview) | rubrics.js:661 |  |  |
| C-021 | Insights, Percents | Papers by percent: sort by heading | rubrics.js:678 |  |  |
| C-022 | Insights, Percents | Copy this table | rubrics.js:686 |  |  |
| C-029 | Marking screen, feedback panel | Change the type (formative note) | app/panels.js:218 | app/screens/mark.jsx:304 | New feedback panel has no link to change the assignment type |
| C-031 | Marking screen, file bar | Type notes instead | app/student.js:103 |  | No link on a notes page bar; typed notes are only reached through the side pane (B) |
| C-034 | Marking screen, paper | Ctrl/Cmd + scroll or trackpad pinch zooms at the pointer | app/panels.js:67 | app/screens/mark.jsx:236 | Only touch pinch (touch.js); no wheel handler for Ctrl/Cmd scroll or trackpad pinch |
| C-037 | Marking screen, progress head | Avg (class average, opens Insights) | app/panels.js:146 | app/screens/mark.jsx:524 | Top bar shows n of N marked and a bar, but no class average and no click-through to Insights |
| C-039 | Marking screen, reading card above paper | Hide for this student / Remove | app/readings.js:81 |  |  |
| C-040 | Marking screen, reading card above paper | Reading zoom - / fit / + (3) | app/readings.js:90 |  |  |
| C-041 | Marking screen, reading card above paper | Ctrl/Cmd + wheel zooms the reading | app/readings.js:105 |  |  |
| C-042 | Marking screen, right-click > Highlight panel | Highlight colour swatches in the menu | stamps.js:428 | app/screens/mark-tools.jsx:94 | Right-click menu has no highlight colour swatches; colour must be picked on the toolbar |
| C-043 | Marking screen, right-click menu | Arrow Right opens the panel of the focused row | stamps.js:469 | app/screens/mark-tools.jsx:78 | New menu key handler only has Esc, Up, Down; keyboard users cannot open Punctuation / Proofreading / Stickers panels with Arrow Right (Enter on the row still works via click) |
| C-046 | Marking screen, score panel | point at / focus a score button to preview what it means | rubrics.js:38 | app/screens/mark.jsx:325 | New panel shows the words only for the score already given; no preview while pointing at another score |
| C-049 | Marking screen, score panel foot | Next student (›) beside Next to score | app/panels.js:212 | app/screens/mark.jsx:332 | Scored work shows only Previous and Next to score; a plain Next button is gone (arrow keys still step) |
| C-051 | Marking screen, score panel retakes | Add their file (for the retake) | app/panels.js:313 | app/mark/score-more.jsx:50 | Retake box has no add-file link; use + Add at the foot of the paper |
| C-052 | Marking screen, student bar | Student details (person icon by the name) | app/student.js:31 |  | No student-details button on the new marking screen's paper header; details are only on the class People tab |
| C-053 | Marking screen, student bar | Readings (count badge) | app/student.js:32 |  | Readings (a file shown above every paper, or for one student) has no counterpart: no button, dialog or lines in next/lang |
| C-055 | Marking screen, student bar | From Google Drive... | app/student.js:35 | app/mark/fileui.jsx:121 | Add menu has no Google Drive item |
| C-063 | Marking screen, tool dock (Highlight) | Freehand highlight width (S / M / L, click cycles) | marking.js:271 | app/screens/mark-tools.jsx:37 | No highlight width control in the new tool dock |
| C-064 | Marking screen, zoom pill | Zoom % label = back to 100% (Cmd 0) | app/panels.js:33 | app/screens/mark.jsx:548 | The % in the new zoom toolbar is plain text, not a reset button |
| C-066 | Return tab, Anchor papers card | Check the covers (in the explanation line) | anchors.js:60 | app/screens/mark-out.jsx:149 | The new card shows the same sentence (paper.an_cover_say) but no Check the covers link; teacher must go via Hide names or Share to reach Check the covers |
| C-069 | Sidebar assistant menu | Pick one of several assistants (opens it, makes it current) | beside.js:94 | app/shell.jsx:105 | Settings still keep 'Others you switch to' and say the sidebar lists them, but the sidebar link has no menu |
| C-070 | Sidebar assistant menu | Assistants and their links... | beside.js:94 | app/screens/settings-more.jsx:85 |  |
| C-071 | Sidebar assistant menu | Esc closes, Up/Down move | beside.js:121 |  | no menu |
| C-075 | Top bar Transcripts button (#trAllBtn) | Transcripts (opener, all recordings) | app/readings.js:317 | app/mark/media.jsx:193 | Only a per-recording Make transcript under each player; no make-all dialog |
| C-078 | dialog: Readings | Close / Done | app/readings.js:52 |  | Whole Readings feature not in the new app |
| C-079 | dialog: Readings | Remove (your document) | app/readings.js:55 |  |  |
| C-080 | dialog: Readings | Remove for everyone | app/readings.js:56 |  |  |
| C-081 | dialog: Readings | + Add a file for everyone... | app/readings.js:58 |  |  |
| C-082 | dialog: Readings | From Google Drive... (for everyone) | app/readings.js:58 |  |  |
| C-083 | dialog: Readings | Show <file> (per student) | app/readings.js:60 |  |  |
| C-084 | dialog: Readings | Remove (file only for this student) | app/readings.js:61 |  |  |
| C-085 | dialog: Readings | + Add a file just for <student>... / From Google Drive... (2) | app/readings.js:62 |  |  |
| C-086 | dialog: Replace <file> | From Google Drive... | app/replace.js:66 | app/mark/fileui.jsx:50 | No way to replace a file from Google Drive |
| C-087 | dialog: Replace <video> | A new link (paste) + Use it | app/replace.js:64 | app/mark/fileui.jsx:50 | Replace on a video link opens a file picker; a new video link cannot be pasted in its place |
| C-089 | dialog: Replace this file? | Also for <partners> (same copy on partners) | app/replace.js:110 | app/mark/change.js:6 | change.js says partner copies changing with it is not here yet |
| C-091 | dialog: Transcripts | Make the existing ones again too | app/readings.js:313 |  |  |
| C-092 | dialog: Transcripts | Make transcripts / Stop | app/readings.js:318 |  |  |
| C-093 | dialog: Transcripts | Close | app/readings.js:318 |  |  |

### Different (32)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| C-001 | Anywhere on the grading page | Alt S starts a screenshot anywhere | snip.js:175 | app/screens/mark-tools.jsx:139 | Registered only while the marking screen is open; Alt S does nothing on the class page, gradebook or other grading screens |
| C-002 | Class gradebook, column / popover | Entry list (opener per task column) | mbentry.js:147 | app/class/grades.jsx:84 | Opened from the Grades tab menu (Entry list), not from each task column or its popover |
| C-003 | Edit assignment / Open assignment dialog | Bring in a rubric... | rubricup.js:90 | app/mark/setup.jsx | Not on the class page's assignment dialog any more (assignment.jsx says the rubric is set up on the marking screen); only Rubric setup > Bring in my rubric after opening the papers |
| C-009 | Focus card / panel, More | How long: 5 / 10 / 15 / 25 minutes (plus usual) | focus.js:559 | app/focus/start.jsx:76 | New offers only the teacher's usual lengths (session, lesson, free-period), not 5/10/15/25 |
| C-013 | Insights | Tabs: Summary / Percents / Consistency (3) | rubrics.js:492 | app/screens/mark-out.jsx:84 | New has Overview and Consistency only; the Percents tab is gone |
| C-017 | Insights, Percents | Show the average 83% / 83.3% / 83.33% | rubrics.js:657 | app/screens/settings-more.jsx:154 | Only in Settings now |
| C-025 | Marking screen, Word edit bar | Back to the original | app/word.js:266 | app/mark/word.js:282 | New only works when the original is still in memory (f.orig); old also read it back from the kept store (origBytes), so after a reload the new app says the original isn't kept |
| C-028 | Marking screen, empty paper | Add their file... / From Google Drive... / Paste text... / A video... / A notes page... / From a scan... (6) | app/student.js:53 | app/mark/fileui.jsx:121 | Same actions in the + Add menu except From Google Drive; no direct one-click buttons |
| C-032 | Marking screen, file menu | Replace... (opens source choice) | app/replace.js:7 | app/mark/fileui.jsx:50 | New Replace goes straight to the computer's file picker; no source dialog |
| C-035 | Marking screen, paper area | Nothing turned in yet. Add their paper... | app/student.js:52 | app/screens/mark.jsx:273 | Empty state shows only the title; buttons are the general + Add menu at the foot, without Drive and without the explanatory sentence |
| C-038 | Marking screen, progress head | n of N scored · missing/excused, progress bar, to-do tag | app/panels.js:149 | app/screens/mark.jsx:524 | No 'missing or excused' count in progress (list head shows missing only); no to-do tag for the assignment (tkAsgHtml) |
| C-044 | Marking screen, score panel | Edit rubric / Edit (next to Score heading) | app/panels.js:190 | app/screens/mark.jsx:493 | No link in the score panel; Rubric setup is in the top-bar Setup menu |
| C-047 | Marking screen, score panel (what each score means) | All (see what every score means on this row; stays open) | rubrics.js:22 | app/screens/mark.jsx:210 | Replaced by the Rubric tab of the side pane (B); no per-row All toggle in the score panel |
| C-048 | Marking screen, score panel foot | All keys ? | app/panels.js:201 | app/shell.jsx:192 | No link in the panel; ? key opens Help > Keys page |
| C-050 | Marking screen, score panel foot | Export <name>'s paper now | app/panels.js:213 | app/screens/mark-out.jsx:193 | Not in the score panel; only on the Return tab |
| C-054 | Marking screen, student bar | + Add menu (opener) | app/student.js:33 | app/mark/fileui.jsx:126 | Moved from the student bar at the top to the foot of the paper (under the last page) |
| C-056 | Marking screen, student bar | Only this student (person icon) | app/student.js:40 | app/screens/mark.jsx:499 | No button on the student bar; it is in the top-bar menu and the I key |
| C-057 | Marking screen, student bar | More for this paper (opener) | app/student.js:41 | app/mark/fileui.jsx:64 | No paper-wide menu; items are split between each file's menu, the foot of the paper and the view toolbar |
| C-058 | Marking screen, student bar | Arrange pages | app/student.js:42 | app/mark/fileui.jsx:127 | A button at the foot of the paper, not in a menu at the top |
| C-059 | Marking screen, student bar | Use as an example | app/student.js:43 | app/mark/fileui.jsx:60 | In each file's menu; new app offers it only for viewable (PDF/picture) files, not Word papers |
| C-060 | Marking screen, student bar | Lighting | app/student.js:44 | app/screens/mark.jsx:547 | A sun button in the zoom toolbar |
| C-061 | Marking screen, student bar | Calculator (=) | app/student.js:45 | app/screens/mark.jsx:498 | In the top-bar menu and the score panel, and = key |
| C-062 | Marking screen, student list foot | Add late work | app/anon.js:96 | app/screens/mark.jsx:493 | No button at the foot of the student list; the same action is Setup menu > Bring in files... in the top bar |
| C-065 | Open assignment dialog | Use this rubric | rubricup.js:105 | app/mark/setup.jsx | Only inside Rubric setup on the marking screen |
| C-067 | Side pane > Typed notes tab | Typed notes page (opener: side pane tab) | typednotes.js:197 | app/mark/typed.jsx:181 | Typed notes now sit in a fold-open section (Typed notes) under the comment in the score panel, not as a side-pane tab beside the paper |
| C-068 | Sidebar Focus button (time left while running) | Focus (sidebar, shows time left; folds/unfolds a running session) | focus.js:706 | app/shell.jsx:196 | No Focus item in the sidebar; opened from Today, To do, or Find anything (command). A running session shows its own pill |
| C-072 | Sidebar, every screen | <Assistant name> (open beside the app) | beside.js:78 | app/shell.jsx:105 | New sidebar link is a plain new-tab link: it ignores the teacher's 'In a window on the right' setting (no side window) |
| C-073 | Top bar Bring back button (#backBtn) / tabs | Bring back from <assistant> (opener) | app/claude.js:507 | app/mark/share.jsx:81 | Old app had its own top-bar button (wiring.js #backBtn) and a tab entry; new app reaches Bring back only from step 4 inside Share with your assistant |
| C-074 | Top bar Mark key button / Settings / Export dialog | Mark key (openers: #mkeyBtn, #setMkey, export data-mkey) | stamps.js:134 | app/screens/settings-grading.jsx:127 | Only a card in Settings; no button on the marking screen or the Return/export flow to reach it |
| C-076 | Typed notes bar | Clear this student's notes | typednotes.js:214 | app/mark/typed.jsx:124 | No confirm dialog any more: clears at once with Undo in the toast (on purpose, file header) |
| C-077 | dialog: Keys | Keys dialog Close | app/panels.js:435 | app/screens/keys.jsx | Keys list is a Help page (#/help/keys) instead of a dialog over the paper; version label moved |
| C-088 | dialog: Replace <video> | A video file... / Google Drive... (2) | app/replace.js:65 | app/mark/fileui.jsx:50 | A file can be picked; Drive cannot |

### Unsure (10)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| C-010 | Focus panel, lesson session | Open the lesson | focus.js:573 | app/focus/panel.jsx:33 | Start a lesson session and check the panel links to the lesson |
| C-023 | Insights, Summary | score bars / row bars with tooltips (hover/focus) | rubrics.js:451 | app/screens/mark-out.jsx:108 | Point at a bar in Insights > Overview and check a tooltip with the names shows |
| C-024 | Marking screen | Tab from nowhere goes to the row in hand | app/panels.js:381 | app/screens/mark.jsx:313 | With nothing focused press Tab: check focus lands on the slider of the row in hand (old) rather than the first control on the page |
| C-026 | Marking screen, Word paper | Enter = line break; Ctrl B/I/U blocked | app/word.js:293 | app/mark/word.js | Edit a Word paper and press Enter / Ctrl B: check a line break and no formatting |
| C-027 | Marking screen, Word paper | paste as plain text | app/word.js:296 | app/mark/word.js | Paste formatted text while editing: check it comes in plain |
| C-030 | Marking screen, feedback panel | Next without feedback (N) | app/panels.js:224 | app/screens/mark.jsx:466 | Formative panel foot has only Previous/Next arrows; N key still runs nextUnscored. Check there's a visible button |
| C-033 | Marking screen, page chip | Lighting chip on a page / lighting menu items | app/student.js:151 | app/mark/light.jsx | Open a pale scan with lighting on and look for the per-page chip and its menu |
| C-036 | Marking screen, placing a score sticker | Escape stops placing the score sticker | app/calc.js:158 | app/mark/marking.js:307 | Press Score sticker, then Esc: check that placing stops (mark.stamp_where says Esc stops) |
| C-045 | Marking screen, score panel | Delete / Backspace on a slider clears the row | app/panels.js:353 | app/screens/mark.jsx:313 | Focus a row slider and press Delete: check the row's score clears |
| C-090 | dialog: Share with assistant, Marks only | Left out: N students with no marks yet (warning) | marksout.js:164 | app/mark/share.jsx:84 | Pick Marks only with some unmarked students: check a left-out note shows (the papers side has sh_out) |

## Bringing work in, video, quizzes, examples, return and export


### Missing (25)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| D-002 | Bring in files / Match files to a roster | A whole folder… | app/bringin.js:121 |  | the paper's Bring in files (mark.jsx:492) and Files to match to a roster (class-work.jsx:122) both take only files, never a folder; folder names often carry student names |
| D-006 | Partners and videos / no-papers start | Drive… (per student) | video.js:674 | app/mark/partners.jsx:5 | comment says Drive comes with the Drive part, but there is no Drive button in the new dialog |
| D-007 | Partners and videos / no-papers start | Choose from Drive… (many, matched by name) / Change folder | video.js:749 |  |  |
| D-011 | Quiz boxes | Edit goals… / Tag questions with learning goals… | quiz.js:378 |  | no link from Quiz boxes to make or edit learning goals; the Goal select only appears once goals exist |
| D-012 | Send to assistant | Black out more (per picture) | watch.js:158 | app/class/watch.jsx:108 | no way to cover more on a picture before it goes into the PDF |
| D-013 | Settings, Word papers | Keep as Word / Convert to PDF pages | wordpdf.js:335 |  | not in the new Settings (help/find.js lists "Word papers" but no settings screen sets gs.wordPdf); only the checkbox inside the Convert dialog can change it |
| D-019 | assignment, Examples tab | Show N examples from linked classes / Hide | examples.js:602 |  | no linked-class toggle; Library shows every class, filter by class instead |
| D-026 | example card | Copy picture | examples.js:582 |  | no Copy picture on the card or its menu |
| D-030 | marking screen, Return tab | N things to look at before you return these (Scores not finished / No paper / Scores that disagree / Files with no marks / Grades to confirm; click a name to go there) | app/export.js:228 |  | no pre-return check list in the new Return tab; exportCheck is not ported (not in gexport exports) |
| D-031 | marking screen, Return tab | Grades to confirm name -> opens grade sheet | app/export.js:228 |  | part of the missing pre-return check |
| D-037 | paper Add menu | Partners: find box and tick everyone else in the video | video.js:560 | app/mark/media.jsx:252 | no partners in the Add video dialog; the partners of a video have to be set in Group work or Partners and videos afterwards |
| D-041 | paper view | Enter picks the top match | app/files.js:121 |  | Enter in the find box does nothing special in the new dialog |
| D-042 | paper view, Add / gap student | Add a file from Google Drive (one student) | app/kept.js:212 | app/mark/fileui.jsx:122 | the paper's Add menu offers only files from the computer, pasted text, video, notes page and a scan; no Drive pick for one student (wired from student.js #addDriveBtn/#gapDrive) |
| D-045 | paper view, kept video not in this browser | Choose the video file… (put the kept video back) | video.js:230 | app/mark/media.jsx:118 | new card only says the video isn't here, with no way to choose the file again |
| D-046 | paper view, recording that won't play | Download (appears when a recording can't play, with why and what to do) | intake.js:217 | app/mark/media.jsx:83 | a student recording that won't play shows nothing extra: no reason, no Download button, no "only the sound plays" note |
| D-048 | paper view, under a video | Captions ‹ › (line before / next line) | app/media.js:100 | app/mark/media.jsx:184 | new caption line only follows the player's time; no ‹ › to step lines, so a Google Drive video (no playing position) cannot step captions |
| D-050 | paper view, video link card | ◀◀ 10s / 10s ▶▶ / speed / PiP for YouTube and Vimeo players | video.js:86 | app/mark/media.jsx:92 | new treats every site player (iframe) as not ticking: no skip, speed, +Time or transcript highlight for YouTube/Vimeo; only direct video files get them |
| D-053 | paper ⋯ menu | Drag on a page to cover anything else (handwritten name, score) | examples.js:231 | app/class/exsave.jsx:121 | new dialog only drags in Part mode (to pick the part); extra covers can only be added after saving via Cover part of it |
| D-054 | paper ⋯ menu | Names: "N names covered" count | examples.js:231 |  | the dialog no longer says how many names were found and covered |
| D-056 | paper ⋯ menu | Click a cover to take it off / put it back | examples.js:350 |  | no way to undo a wrong automatic name cover before saving |
| D-057 | screenshot (S) / snip | Drag over anything that shows a name to black it out; click a box to take it off | examples.js:461 | app/class/exsave.jsx:199 | new screenshot dialog shows the picture with no covering at all; names in a screenshot are saved as they are unless covered later with Cover part of it |
| D-058 | screenshot (S) / snip | Tags you have used (chips add a tag) | examples.js:467 | app/class/exsave.jsx:202 | known tags are loaded but not offered as chips in the screenshot dialog (they are in the Add tags dialog) |
| D-059 | screenshot (S) / snip | Enter in why/tags saves | examples.js:483 |  |  |
| D-061 | student card, Strengths and concerns | All / ★ Strong · n / ⚑ Watch · n | watch.js:51 | app/class/watch.jsx:50 | student page lists everything together, no filter |
| D-062 | student card, Strengths and concerns | Seen most: top concern tags | watch.js:53 | app/class/watch.jsx:53 | the "Seen most" tag summary is gone |

### Different (31)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| D-001 | Bring in files / Match files to a roster | Files or a ZIP… | app/bringin.js:121 | app/screens/mark.jsx:492 | no choice dialog; the paper's Bring in files opens the file chooser straight away (ZIPs still opened); the explaining text (late work, scans) is gone |
| D-003 | Examples page, Whose work | Student name opens their card | watch.js:89 | app/class/examples.jsx:220 | names are plain text, not links to the student |
| D-008 | Quick mark toast | See examples (toast) / Undo | examples.js:146 | app/class/exsave.jsx:59 | See examples goes to Library > Examples unfiltered instead of this assignment's examples |
| D-009 | Quick mark, a card | ☆ Example | quiz.js:640 | app/mark/quick.jsx:282 | see examples.js: only the E key, no button on the card |
| D-010 | Quick mark, an answer | ☆ Example / ★ (keep this answer as a strong example) | examples.js:161 | app/mark/quick.jsx:282 | only the E key remains; no visible ☆ Example button on the answer, so a teacher who doesn't know the key can't find it |
| D-017 | What opened | Nothing turned in: "use Bring in files under More, or drop it on their name" | intake.js:309 | app/mark/report.jsx:47 | the hint on how to add their work later is gone |
| D-018 | assignment, Examples tab | Question N has no example yet / No examples yet (how to keep one) | examples.js:592 | app/class/examples.jsx:79 | Library empty state is generic; the per-question "has no example yet, press ☆" card is gone |
| D-020 | assignment, Examples tab (#/a/<id>/examples) | This assignment's Examples (answers by question, papers/parts/shots) | examples.js:595 | app/screens/library.jsx:180 | no Examples tab on the assignment; everything is in Library > Examples with an assignment filter; old #/a/<id>/examples goes to the marking screen |
| D-022 | class Work, an assignment with no papers | Videos and partners (links, files, Drive, drop, partners, one grade/own scores) | video.js:791 | app/class/assignment.jsx:146 | not in the start dialog any more; the new one says videos and partners can be added afterwards on the marking screen |
| D-023 | every Email link (School page, to-do people, Planner note links) | mailto: links open in Gmail / Outlook on the web per setting | mail.js:37 | app/class/mail.js:24 | openMail is only called by the student card (people.jsx:183) and class to-do (todo.jsx:43); the School page (school.jsx:198), the To do screen (todo.jsx:91, 254) and links in lesson notes are plain mailto: links with no catch-all, so they open the computer's mail app even when Gmail/Outlook is chosen |
| D-024 | example card | Whose work name opens the student's card | examples.js:577 | app/class/examples.jsx:113 | name shown but not a link to the student's card |
| D-025 | example card | Add why it's strong (inline) | examples.js:580 | app/class/examples.jsx:101 | only in the ⋯ menu (dialog) now; no inline link on the card |
| D-027 | example card | Delete (click again to delete) | examples.js:632 | app/class/examples.jsx:103 | deletes on the first click, with no second click and no Undo |
| D-028 | home (no assignment) | Match files to a roster with no assignment | app/bringin.js:150 | app/help/find.js:26 | only via an assignment's Bring in papers menu; the command-bar job just goes to the class Work page instead of opening the matcher |
| D-029 | marking screen, Return tab | Leave out the students who got theirs early | app/export.js:218 | app/screens/mark-out.jsx:203 | the list of who got theirs early (first 4 names) and the "theirs go again" hint are gone |
| D-032 | marking screen, Return tab | Options: (summary of what is on), open state remembered | app/export.js:232 | app/screens/mark-out.jsx:217 | summary line saying which options are on is gone; open/closed is no longer remembered |
| D-033 | marking screen, Return tab | Add a key to the marks used on each paper | app/export.js:238 | app/screens/mark-out.jsx:224 | hint with how many files get a key is gone, and so is the "Change what they mean…" link (mark key only in Settings > Grading, settings-grading.jsx:160) |
| D-034 | marking screen, Return tab | Change what they mean… | app/export.js:238 | app/screens/settings-grading.jsx:160 | only reachable from Settings, not from Return |
| D-035 | marking screen, Return tab, after export | "N files aren't in this export" list (stays until closed) | exportreport.js:23 | app/screens/mark-out.jsx:170 | now an 8-second toast instead of a list that stays in the Return box |
| D-036 | paper Add menu | Choose from Drive… / Change folder | video.js:556 | app/mark/media.jsx:276 | Change folder (the Drive video folder) is gone |
| D-038 | paper panel, under Next | Export <name>'s paper now (+ "Exported at" note) | app/export.js:361 | app/screens/mark-out.jsx:239 | moved from under Next in the paper panel to a card on the Return tab; the "Exported at…" line under the student is gone from the paper panel |
| D-039 | paper view | Type a name / Type a paper number | app/files.js:111 | app/mark/fileui.jsx:101 | search matches anywhere in the name (old: word starts); with names hidden the list is not in paper-number order and the box doesn't say "Type a paper number" |
| D-040 | paper view | student row (with N files) | app/files.js:116 | app/mark/fileui.jsx:102 | each row no longer shows how many files that student has |
| D-043 | paper view, Add a file… | A ZIP added to a student is opened; a ZIP with a folder per student goes to Bring in files | app/kept.js:222 | app/mark/change.js:30 | new addFiles keeps the ZIP as one unopenable file; it is not unpacked and not routed to Bring in files |
| D-044 | paper view, a file you added | Mark late (beside "Added by you") | intake.js:352 | app/mark/fileui.jsx:216 | new shows Mark late only on a file flagged new in a newer download, not beside any file she added |
| D-047 | paper view, transcript | Make again (asks first) | app/media.js:140 | app/mark/media.jsx:223 | no "Make the transcript again? The one you have will be replaced" question: the old transcript is replaced straight away (C.trMake, change.js:506) |
| D-049 | paper view, unshowable file card | Download | app/bringin.js:13 | app/mark/files.jsx:19 | Download is there; card drops the "Added by you"/carried tags, the "goes back with the export because you added it" line, and "your marks on it are still saved" for a damaged photo |
| D-051 | paper view, video link card | + Time to comment (where the video is) | video.js:91 | app/mark/media.jsx:99 | only for direct video links; YouTube and Vimeo links lose it |
| D-052 | paper view, video link card | Turn video | video.js:92 | app/mark/media.jsx:105 | new shows Turn only for site players (frame), not for a direct video link |
| D-055 | paper ⋯ menu | Why it's strong (Enter saves) | examples.js:234 | app/class/exsave.jsx:163 | Enter in the box no longer saves |
| D-060 | student card, Strengths and concerns | Nothing saved from their work yet (how to save one) | watch.js:47 | app/class/watch.jsx:48 | the section is hidden when empty, so the teacher isn't told how to start one |

### Unsure (6)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| D-004 | Google's chooser | Tabs: Last folder / My Drive / Shared with me / Shared drives | gpick.js:57 | whole/pick.js:1 | check the new chooser offers the last folder first and shared drives |
| D-005 | Mac app folder pickers | macOS folder chooser (Mac app) | app/bringin.js:96 |  | no gsNative use found in next/src; check whether the Mac app wraps the new app |
| D-014 | Split a scan, Lighting panel | Escape closes the lighting panel | scans.js:532 | app/mark/split.jsx:332 | the split's Escape closes the whole split; open Lighting in a split and press Escape to check |
| D-015 | Split a scan, blank pages view | Escape closes blank-pages view | app/scansplit.js:201 | app/mark/split.jsx:332 | the split's own Escape closes the whole split; open Leave out blank pages and press Escape to check it only closes the blank view |
| D-016 | Today / command bar / needs list | Reopen kept papers (also fetching from Google Drive) | app/kept.js:155 |  | called from screens.js/shell.js, not this file; open an assignment whose papers are only on Drive in the new app to check it fetches them |
| D-021 | beside Add buttons (materials, picture, book PDF, screenshots) | Drive mark button (data-drv): same action, filled from Drive | gpick.js:103 | app/plan/materials.jsx:110 | Planner call sites are another group's; check each Planner Add (book PDF, finished .pptx, notebook picture, review screenshot) has From Google Drive |

## Planner: lessons, calendar, units, present, Beside


### Missing (97)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| E1-002 | document | + AI box (put document in the AI box) | planner/materials.js:112 |  |  |
| E1-003 | document | Side panel (from a document) | planner/materials.js:112 |  | Beside only on lesson page |
| E1-004 | editor | Link (YouTube or any video link) | planner/lessons.js:304 |  | Editor has Video layout but no way to give a video slide its link; only Beside > Video "Put on a slide" makes a new video slide |
| E1-005 | editor | Start at (minutes:seconds) | planner/lessons.js:305 |  |  |
| E1-006 | editor | Take the video off | planner/lessons.js:307 |  |  |
| E1-007 | editor | Use this link / Cancel | planner/lessons.js:307 |  |  |
| E1-009 | editor | × Take it off this class (slot chip) | planner/lessons.js:419 |  | No way to take a lesson off a class/day (except the share switch for partner sections) |
| E1-011 | editor | Saved / Saving… status | planner/lessons.js:421 |  | No save status shown in the lesson editor (sidebar foot only) |
| E1-013 | editor | ▾ Pick another layout (Add a slide with layout gallery) | planner/lessons.js:425 |  | Add slide always adds the usual layout; change layout after with the Layout select |
| E1-015 | editor | Add video link / Change video | planner/lessons.js:431 |  |  |
| E1-016 | editor | Watch (open the video) | planner/lessons.js:431 |  |  |
| E1-018 | editor | This lesson's own unit plan (Atlas) link | planner/lessons.js:469 |  | Lesson-level unit plan link not editable; Beside > Unit opens the unit's link only |
| E1-019 | editor | Save / Cancel | planner/lessons.js:470 |  |  |
| E1-020 | editor | Drag a thumbnail to reorder slides | planner/lessons.js:481 |  | Only up/down buttons |
| E1-025 | editor | Drop a thumbnail on another (reorder) | planner/lessons.js:725 |  |  |
| E1-026 | editor | Drop a picture on the slide or a thumbnail (puts it on that slide; several make a slide each) | planner/lessons.js:749 |  | Picture only by Choose a picture |
| E1-027 | editor | Drop a picture/link from another browser tab (fetch picture; YouTube link makes video slide) | planner/lessons.js:752 |  |  |
| E1-028 | editor | Paste a picture (goes on slide) or a YouTube link (makes video slide) | planner/lessons.js:810 |  |  |
| E1-031 | editor | Warning: that class does not meet that day | planner/lessons.js:906 |  |  |
| E1-035 | editor | Name matches the title slide ✓ / Match the name to the title slide | planner/lessons.js:963 |  | Lesson name and title slide link not shown/toggleable |
| E1-037 | editor | Change / + unit plan link (this lesson) | planner/lessons.js:964 |  |  |
| E1-040 | editor | N min planning badge on a lesson | planner/plantime.js:88 |  | Time tracker shows planning by lesson (Time this week) but nothing on the lesson itself |
| E1-043 | editor | Look slide by slide (AI changes from the folder) | planner/review.js:112 |  | Arrived bar has Back to your version / Reviewed only |
| E1-044 | editor | Per slide: Keep mine / Keep (AI)'s | planner/review.js:118 |  |  |
| E1-045 | editor | All mine / All (AI)'s / Later / Done | planner/review.js:122 |  |  |
| E1-046 | editor | What I want on this slide (for AI, not shown) | planner/review.js:167 |  | s.ask field not editable (kept in data, sent in the brief only if already set) |
| E1-048 | editor | Go to slide / whole lesson | planner/review.js:233 |  |  |
| E1-052 | editor > Finished PowerPoint | Finished deck from Google Drive | planner/finished.js:18 |  |  |
| E1-053 | editor > Finished PowerPoint | Drop a .pptx/.zip on the lesson (finished deck) | planner/finished.js:40 |  |  |
| E1-054 | editor > Links | Edit (link) | planner/links.js:56 |  | Links can be added and removed, not edited |
| E1-055 | editor > Links | Or pick from School resources (search + list) | planner/links.js:78 |  |  |
| E1-056 | editor > Materials | Drag a file chip to the AI box | planner/materials.js:16 |  | No AI box |
| E1-057 | editor > Materials | Edit a copy (.docx into an editable document) | planner/materials.js:17 |  |  |
| E1-063 | side panel | Drag the panel edge to resize | planner/panel.js:27 |  |  |
| E1-065 | side panel | Drop a PDF on the Books tab | planner/panel.js:320 |  | No drop on Beside > Books (only Add a PDF) |
| E1-066 | side panel | Drop a YouTube link on the panel (opens in Video) | planner/panel.js:320 |  |  |
| E1-067 | side panel | Drop a slide thumbnail / chip on the panel (adds to AI box) | planner/panel.js:320 |  |  |
| E1-068 | side panel > AI | AI box chips: × remove | planner/panel.js:209 |  | The AI box (gather slides, pages, video, weeks, notes and copy them in one go) is gone; replaced by comments on the lesson + Work with (AI) |
| E1-069 | side panel > AI | What do you want (AI) to do with these? | planner/panel.js:210 |  |  |
| E1-070 | side panel > AI | 🎤 Dictate (AI box) | planner/panel.js:211 |  |  |
| E1-071 | side panel > AI | Clear (AI box) | planner/panel.js:211 |  |  |
| E1-072 | side panel > AI | Copy for (AI) (AI box) | planner/panel.js:211 |  |  |
| E1-073 | side panel > Activities | Activity row (open/close) | planner/activities.js:196 |  | Beside drawer has no Activities tab |
| E1-074 | side panel > Activities | + Add after the slide I'm on | planner/activities.js:199 |  | Library adds as the last slide only |
| E1-075 | side panel > Activities | Add to a lesson… (from panel) | planner/activities.js:199 |  |  |
| E1-076 | side panel > Activities | Find an activity, or a routine number | planner/activities.js:203 |  |  |
| E1-077 | side panel > Activities | Part / kind chips (panel) | planner/activities.js:204 |  |  |
| E1-079 | side panel > Books | Drag a page or contents line to the AI box | planner/panel.js:93 |  |  |
| E2-001 | Library > Past lessons | File chip on a past lesson (open handout) | planner/library.js:11 |  |  |
| E2-003 | Library > Past lessons | Your past lessons: Import a lesson pack… | planner/library.js:21 | app/screens/library.jsx:139 | New empty state says a lesson shows once its day has gone by; no pack import |
| E2-004 | Library > Past lessons | Groups of past lessons by pack name (l.library) | planner/library.js:24 |  | Lessons from packs or moved by a new school year (yearMoveOn) have no slots and are hidden from Past lessons |
| E2-009 | Plan lessons | Load a setup file… | planner/units.js:156 |  | No setup file load anywhere |
| E2-011 | Plan lessons (all views) | Search lessons… (lessons, slides, documents, units) | planner/units.js:18 | app/shell.jsx | Command bar finds lessons by title only; no full-text search inside slides, documents, units |
| E2-014 | Plan lessons (week) | Go to a date (date picker) | planner/lessons.js:379 |  | No date jump; only prev/next and Today |
| E2-016 | Plan lessons (week) | Load a setup file… | planner/lessons.js:383 |  | No Planner setup file load anywhere (grading setup file is separate) |
| E2-017 | Plan lessons (week) | Make a lesson without a class | planner/lessons.js:383 |  |  |
| E2-019 | Plan lessons (week) | ↓ Download (card: finished deck or made .pptx) | planner/lessons.js:397 |  | No download from a calendar card (only from the lesson) |
| E2-020 | Plan lessons (week) | + New lesson (Not on the timetable) | planner/lessons.js:404 |  |  |
| E2-021 | Plan lessons (week) | All lessons | planner/lessons.js:404 |  | No list of every lesson |
| E2-027 | Plan lessons (week) | Planning pace (median minutes per ready lesson) | planner/plannext.js:57 |  | Not lifted (engines.md) |
| E2-028 | Plan lessons (week) | Focus (make lesson for that gap and focus) | planner/plannext.js:63 |  |  |
| E2-029 | Plan lessons (week) | ▶ Present (today's lesson card) | planner/present.js:85 |  | Calendar card only opens the lesson |
| E2-031 | Present | Timer chip (click to pause / clear) | planner/present.js:182 | app/screens/present.jsx:124 | Clock shows; not clickable |
| E2-037 | Present | Clock (time of day) in the bar | planner/present.js:189 |  |  |
| E2-038 | Present | Agenda item: tick done / go to slide | planner/present.js:248 |  | Agenda panel is a plain list; no ticks, no jump to slide when no agenda |
| E2-040 | Present | Pause / Go on / Restart / Stop | planner/present.js:444 |  |  |
| E2-042 | Present | Own minutes + seconds, Start (Enter) | planner/present.js:446 |  |  |
| E2-043 | Present | Show it big in the middle of the screen | planner/present.js:448 |  |  |
| E2-044 | Present | A sound when the time is up | planner/present.js:449 |  |  |
| E2-046 | Semester | Semester grid: weeks x courses with unit colours, Week N labels | planner/units.js:136 | app/screens/calendar.jsx | Month view shows "Units this month" only; no term-wide grid |
| E2-047 | Semester | Week cell (Open this week) | planner/units.js:140 |  | No term grid to jump from |
| E2-052 | Unit page | Add screenshot from Drive | planner/units.js:201 |  | No Drive picker for unit screenshots |
| E2-053 | Unit page | Replace… (screenshot) | planner/units.js:203 | app/plan/unit-tools.jsx:113 | Only Remove on shots |
| E2-057 | Unit page | Add files from Drive | planner/units.js:223 |  |  |
| E2-058 | Unit page | + AI box (doc) | planner/units.js:225 |  | No AI box in new app |
| E2-064 | Week | No unit this week + Unit (new unit for this course starting this week) | planner/units.js:164 |  | Calendar week has no unit bar |
| E2-065 | Week | Open unit (with week focus and standards shown) | planner/units.js:167 |  | Week focus is on the class Course line, not on the calendar week |
| E2-067 | any | Drop a .gslesson share file anywhere (opens it) | planner/lessons.js:733 |  | Import sheet only; no drop |
| E2-068 | any | Drop a lesson pack .zip (imports past lessons) | planner/lessons.js:735 |  | Lesson packs not supported (Import says "goes in Library, Past lessons" but there is no import there) |
| E2-069 | any | Drop a .lesson.json (import) | planner/lessons.js:753 |  |  |
| E2-071 | any | Lesson pack import (pack.json .zip): lessons, files, unit links | planner/library.js:60 |  |  |
| E2-073 | any planner screen | ＋ Add this (slide/lesson/file/text) to the AI box | planner/extras.js:39 |  | No AI box |
| E2-076 | any planner screen | Floating timer after Present (pause / × stop) | planner/present.js:386 |  | Timer stops when Present closes |
| E2-080 | dialog:All lessons | Find (filter all lessons) | planner/lessons.js:920 |  |  |
| E2-081 | dialog:All lessons | Lesson row (open) | planner/lessons.js:921 |  |  |
| E2-083 | dialog:Search | Search lessons, slides, notes, documents, units | planner/extras.js:127 |  |  |
| E2-084 | dialog:Search | Search hit (opens lesson at slide / document / unit) | planner/extras.js:131 |  |  |
| E2-085 | dialog:Timetable | Save my setup file | planner/lessons.js:1091 |  | No Planner setup file (timetable, template, deck rules, words) to carry to another computer |
| E2-086 | dialog:Timetable | Load a setup file… | planner/lessons.js:1091 |  |  |
| E2-090 | dialog:Timetable | Template from Google Drive | planner/lessons.js:1098 | app/screens/settings-plan.jsx:104 | No Drive button for the template |
| E2-092 | dialog:Where did the class get to? | Class (which slot) | planner/present.js:112 |  |  |
| E2-094 | find | Go to: Semester | planner/rail.js:101 |  | No semester view (every week x course with units); closest: Calendar month "Units this month" and class Course line |
| E2-095 | find | Units (each unit by title) | planner/rail.js:113 |  | No command per unit; units only via Library > Units or class Course line |
| E2-096 | find | Do: Make a new lesson (not on a class) | planner/rail.js:114 |  | No way to make a blank lesson without a class/day (only from an activity, import, or an empty period) |
| E2-102 | find | Search inside lessons for "..." (slides, notes, documents, units) | planner/rail.js:140 |  | Command bar matches lesson titles only; no full-text search of slides/notes/documents/units |
| E2-110 | top bar | Enter in Search lessons box | planner/lessons.js:569 |  |  |
| E2-113 | week | Drop a setup .json on the page (load timetable) | planner/lessons.js:739 |  |  |

### Different (100)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| E1-001 | Library > Activities | Coming up lessons (8) | planner/activities.js:233 | app/screens/library.jsx:98 | Added as the last slide (old: last slide too unless the open lesson) |
| E1-008 | editor | ‹ Back (Week/Semester/Units/Unit/Activities/Past lessons) | planner/lessons.js:417 | app/screens/lesson.jsx:291 | Crumb goes to Calendar only; browser Back works |
| E1-010 | editor | + Class (put this lesson on another class/day) | planner/lessons.js:419 | app/screens/lesson.jsx:189 | Only when the lesson has no class (Put it on the calendar) or partner sections (share switch); cannot add a second arbitrary class/day |
| E1-012 | editor | Present (from this slide) | planner/lessons.js:423 | app/screens/lesson.jsx:302 | From Slides view starts at current slide; from Lesson view resumes where class stopped; Edit view starts at resume point not the edited slide |
| E1-014 | editor | Layout: … ▾ (layout gallery with mini slides) | planner/lessons.js:427 | app/screens/lesson-edit.jsx:217 | Plain Select, no picture previews or groups |
| E1-017 | editor | Click a box on the slide to type in it (direct on-slide editing) | planner/lessons.js:433 | app/screens/lesson-edit.jsx:218 | Text is typed in form fields beside the slide; clicking a box only picks it for size/move |
| E1-021 | editor | Thumbnail comment count badge | planner/lessons.js:481 | app/screens/lesson-edit.jsx:195 | Icon only, no count |
| E1-022 | editor | Biggest size that fits (overflow warning) | planner/lessons.js:498 | app/screens/lesson-edit.jsx:213 | Only as an option in the Text size select, not in the warning |
| E1-023 | editor | Enter adds slide comment / lesson comment | planner/lessons.js:567 | app/plan/talk.jsx:18 | Ctrl+Enter adds; plain Enter is a new line |
| E1-024 | editor | Arrow keys / Page Up / Page Down move between slides | planner/lessons.js:572 | app/screens/lesson-edit.jsx:178 | Alt+Up / Alt+Down in Edit; plain arrows only in Slides view |
| E1-029 | editor | Class select | planner/lessons.js:905 | app/screens/lesson.jsx:192 | PlaceIt only when no slots |
| E1-030 | editor | Date | planner/lessons.js:906 | app/screens/lesson.jsx:193 |  |
| E1-032 | editor | Add / Cancel | planner/lessons.js:907 | app/screens/lesson.jsx:194 |  |
| E1-033 | editor | Copy for (AI) | planner/lessons.js:958 | app/plan/assistant.jsx | Work on it with (AI) sheet: copy the lesson, then bring back a .zip |
| E1-034 | editor | Comments (on lesson and slides) | planner/lessons.js:959 | app/screens/lesson.jsx:162 | No overview of all comments; lesson comments on Lesson view side, slide comments per slide in Edit |
| E1-036 | editor | Open unit plan (Atlas) ↗ | planner/lessons.js:964 | app/screens/lesson-beside.jsx:170 | In Beside > Unit |
| E1-038 | editor | Click picture box on slide to add a picture | planner/looks.js:133 | app/screens/lesson-edit.jsx:46 | Choose a picture button beside |
| E1-039 | editor | Layout tiles grouped, with sample mini slides | planner/looks.js:229 | app/screens/lesson-edit.jsx:217 | Plain select for layout; no gallery; Add slide cannot choose a layout |
| E1-041 | editor | Pages checkboxes (several pages) | planner/plexamples.js:61 | app/plan/example-pick.jsx | One page picked (Which page select); old could put several pages at once, one slide each |
| E1-042 | editor | Put on slides (one slide per page, after this one) | planner/plexamples.js:65 | app/screens/lesson-edit.jsx:47 | Sets the picture of the current picture slide only; no new slides made |
| E1-047 | editor | Comments (n) (all comments dialog) | planner/review.js:226 | app/screens/lesson.jsx:162 | Counts only; no single list across slides |
| E1-049 | editor | Done / Open again | planner/review.js:234 | app/plan/talk.jsx:15 | Per slide in Edit |
| E1-051 | editor | + Alternative version | planner/variants.js:20 | app/plan/lesson-menu.jsx:80 | In lesson menu only |
| E1-058 | editor > Materials | ↓ Download file (document as .docx) | planner/materials.js:18 | app/plan/materials.jsx:96 | No separate download; Open downloads non-PDF/picture files; documents only via the editor's Save as .docx |
| E1-059 | editor > Taught | Add a note / Note where the class got to | planner/present.js:92 | app/screens/lesson.jsx:209 | After class box + Got to select, only for the one current slot |
| E1-060 | editor > Taught | Taught note: Edit | planner/present.js:94 | app/screens/lesson.jsx:209 | Only the current slot's note is editable; other classes' notes not listed |
| E1-061 | editor > Taught | Taught note: Remove | planner/present.js:94 | app/screens/lesson.jsx:81 | Set state back to Draft/Ready removes the slot's taught record; no per-note remove |
| E1-062 | editor/week/unit/document | Side panel (toggle) | planner/panel.js:42 | app/screens/lesson.jsx:293 | Beside only on the lesson page; not on calendar, units, documents |
| E1-064 | side panel | Panel tabs: Books, Activities, Video, Unit, Notebook, AI | planner/panel.js:48 | app/screens/lesson-beside.jsx:44 | Books, Video, Unit, Notebook only; no Activities or AI tabs |
| E1-078 | side panel > Books | + AI box (this page's text) | planner/panel.js:90 | app/screens/lesson-beside.jsx:132 | This page to (AI): added as a lesson comment |
| E1-080 | side panel > Notebook | General notes / ← This lesson / ← This unit (swap) | planner/notebook.js:77 | app/screens/lesson-beside.jsx:216 | Lesson and General only; no unit notebook |
| E1-081 | side panel > Notebook | + AI box (notebook) | planner/notebook.js:84 | app/plan/assistant.jsx | Notebook goes in the assistant message by a checkbox (plan.brief_notebook) |
| E1-082 | side panel > Notebook | Paste a picture / YouTube link into the notebook | planner/notebook.js:91 | app/screens/lesson-beside.jsx:229 | Pictures only; a pasted YouTube link is not turned into a player |
| E1-083 | side panel > Unit | Unit week (focus, standards, notes) for a lesson, unit page, or this week's units when no lesson | planner/panel.js:193 | app/screens/lesson-beside.jsx:165 | Only for the open lesson |
| E1-084 | side panel > Unit | + AI box (unit week) | planner/panel.js:198 | app/screens/lesson-beside.jsx:175 | To (AI) lesson comment |
| E1-085 | side panel > Video | + AI box (video) | planner/panel.js:174 | app/screens/lesson-beside.jsx:155 | To (AI): added as a lesson comment |
| E2-002 | Library > Past lessons | Filter past lessons | planner/library.js:19 | app/screens/library.jsx:134 | Searches title only (old: title, group, file names); adds a class filter |
| E2-005 | Library > Rubrics | Drag a card to another unit / "Not in a unit yet" | planner/bank.js:108 | app/plan/bank-edit.jsx:84 | Move to… dialog in the card menu instead of drag |
| E2-006 | Library > Rubrics | Duplicate | planner/bank.js:196 | app/plan/bank-edit.jsx:83 | In card menu, not in editor |
| E2-008 | Plan lessons | Type in my classes (setup needed) | planner/units.js:156 | app/screens/calendar.jsx | Calendar empty state links to Settings > Timetable |
| E2-010 | Plan lessons (Week/Semester) | Week / Semester view tabs | planner/units.js:15 | app/screens/calendar.jsx | Calendar has By class / By time / Month; no Semester |
| E2-012 | Plan lessons (all views) | More ▾ menu | planner/units.js:19 | app/plan/lesson-menu.jsx | Per-view More menus split between calendar week menu and lesson menu |
| E2-013 | Plan lessons (all views) | Import… (lesson file, lesson pack, or pasted text) | planner/units.js:20 | app/screens/lesson-tools.jsx | Import sheet exists in PlanIt slot menu and lesson menu; refuses .zip lesson packs |
| E2-015 | Plan lessons (week) | Tell the Planner when your classes meet | planner/lessons.js:382 | app/screens/calendar.jsx:191 | Empty state with Set up your timetable link only |
| E2-018 | Plan lessons (week) | Card tags: variant name, Finished ✓, Ready ✓, Taught to slide N, also on other class | planner/lessons.js:396 | app/screens/calendar.jsx:40 | Card shows Draft/Ready/Taught and Not reviewed only; no variant tag, finished tag, "taught to slide N", or "also on" |
| E2-022 | Plan lessons (week) | Not on the timetable: lesson cards | planner/lessons.js:405 | app/screens/class.jsx:101 | Shown on class page Course line side ("Not on the calendar", 8 max); the "+N more" link goes to Past lessons where they are not listed |
| E2-023 | Plan lessons (week) | Next week: N of M lessons planned (dots) | planner/plannext.js:39 | app/screens/class.jsx:36 | Planning pace per class on the Course line; calendar shows "n of m ready" |
| E2-024 | Plan lessons (week) | Pick up where you left off: Continue | planner/plannext.js:53 | app/screens/home.jsx:135 | On Home, not the planning screen |
| E2-025 | Plan lessons (week) | Focus (on the recent lesson) | planner/plannext.js:54 | app/screens/lesson.jsx:301 | Focus on it inside the lesson |
| E2-026 | Plan lessons (week) | Coming up without a lesson (next two weeks) list | planner/plannext.js:57 | app/screens/calendar.jsx:47 | Empty periods show Plan this on the calendar; no two-week list |
| E2-030 | Present | Link rows in Present (lesson + class School links, numbered) | planner/links.js:135 | app/screens/present.jsx:123 | Only the lesson's own links; class School links left out |
| E2-032 | Present | Agenda (A) | planner/present.js:188 | app/screens/present.jsx:84 | Key only, no toolbar button |
| E2-033 | Present | Groups (G) | planner/present.js:188 | app/screens/present.jsx:82 | Key only; group size by number key |
| E2-034 | Present | Links (L) | planner/present.js:188 | app/screens/present.jsx:84 | Key only; lesson links only |
| E2-035 | Present | Blank (B) | planner/present.js:188 | app/screens/present.jsx:83 | Key only |
| E2-036 | Present | Full screen (F) | planner/present.js:188 | app/screens/present.jsx:85 | Key only |
| E2-039 | Present | −1 min / −10 s / +10 s / +1 min | planner/present.js:442 | app/screens/present.jsx:62 | +/- keys add/take a minute only |
| E2-041 | Present | Timer presets 0:30, 1, 2, 3, 5, 10, 15 min | planner/present.js:445 | app/screens/present.jsx:57 | Only keys 1 to 9 start whole minutes; no buttons, no 30 s / 10 / 15 |
| E2-045 | Semester | + New unit | planner/units.js:130 | app/screens/class.jsx:81 | New unit only on the class page Course line |
| E2-048 | Unit page | ‹ Back (Semester / Week / Units) | planner/units.js:192 | app/plan/unit-edit.jsx:48 | Unit is a sheet with Cancel/Save; no autosave, explicit Save |
| E2-049 | Unit page | Starts (list of Mondays with Week N) | planner/units.js:197 | app/plan/unit-edit.jsx:53 | Plain date input, any day; no school-week labels |
| E2-050 | Unit page | Weeks − (warns when last week has writing) | planner/units.js:198 | app/plan/unit-edit.jsx:54 | Removes the last week at once, no warning when it has writing |
| E2-051 | Unit page | Unit plan link (atlas) + Open | planner/units.js:199 | app/plan/unit-edit.jsx:57 | Link field kept; no Open button in the sheet (Beside > Unit opens it) |
| E2-054 | Unit page | Remove (screenshot, click twice) | planner/units.js:203 | app/plan/unit-tools.jsx:113 | Remove icon; check whether a second click or Undo is asked |
| E2-055 | Unit page | Lesson in this week (opens lesson) | planner/units.js:217 | app/screens/class.jsx | Shown on the class Course line weeks, not in the unit |
| E2-056 | Unit page | + New lesson (class/date) | planner/units.js:218 | app/screens/class.jsx | Course line "Plan this" |
| E2-059 | Unit page | Drop files: on shot box = screenshot, elsewhere = unit file | planner/units.js:350 | app/plan/unit-tools.jsx:110 | Drop works only on the screenshot section and keeps images only; no drop for unit files |
| E2-060 | Unit page | Paste screenshot from clipboard | planner/units.js:358 | app/plan/unit-tools.jsx:109 | Paste only when the screenshot section has focus |
| E2-061 | Units | + New unit | planner/units.js:173 | app/screens/class.jsx:81 | Library > Units is read-only |
| E2-062 | Units | No units yet (explains units) | planner/units.js:175 | app/screens/library.jsx:157 | plan.no_units_text; no create button there |
| E2-063 | Units | Unit card (title, weeks, dates) | planner/units.js:180 | app/screens/library.jsx:157 | Library unit row links to the class page, not a unit page |
| E2-066 | any | .themeBtn Dark mode / Light mode | planner/base.js:45 | app/screens/settings.jsx | Six themes in Settings > Display |
| E2-070 | any | Choose a file… (.gslesson, .lesson.json, .zip pack) | planner/lessons.js:1033 | app/screens/lesson-tools.jsx:128 | .zip lesson packs refused |
| E2-072 | any planner screen | 💬 Comment for (AI) on this slide/lesson/selection… | planner/extras.js:39 | app/plan/note-pop.jsx:13 | Lesson page only (not week, unit, document, units, activities) |
| E2-074 | any planner screen | ⧉ Copy this lesson to another day… | planner/extras.js:40 | app/plan/lesson-menu.jsx:78 | Only from the lesson menu |
| E2-075 | any planner screen | Right-click menu (anywhere in the Planner; Shift+right-click for browser menu) | planner/extras.js:83 | app/screens/lesson.jsx:289 | Only on the lesson page, and goes straight to the comment box (no menu) |
| E2-077 | arrival | planner.html#plan/<class>/<day> (open or make that meeting's lesson and start a focus session) | planner/rail.js:196 | app/old-routes.js:32 | Old address lands on Calendar only; no lesson made/opened, no focus started (focus panel itself can start a new lesson) |
| E2-078 | arrival | planner.html#present/<id>/<class> | planner/rail.js:203 | app/old-routes.js:31 | Lands on the lesson Slides view, not presenting |
| E2-079 | class screen window | F in the class screen window (its own full screen) + full screen button | planner/present.js:625 | app/screens/present.jsx:95 | Keys go back to Present (F fullscreens main window); no full-screen button in the pop-out |
| E2-082 | dialog:All lessons | Delete (click twice) | planner/lessons.js:921 | app/plan/lesson-menu.jsx:88 | Delete only from inside a lesson (with Undo) |
| E2-087 | dialog:Timetable | Color (any colour picker) | planner/lessons.js:1093 | app/screens/settings-plan.jsx:61 | 8 fixed swatches instead of a free colour |
| E2-088 | dialog:Timetable | Class page link (optional) | planner/lessons.js:1093 | app/class/classlink.jsx | Not in timetable; set on the class page |
| E2-089 | dialog:Timetable | Dates to show (events, with "to" date range) | planner/lessons.js:1097 | app/screens/settings-plan.jsx:101 | Events have one date only; no "to" end date for multi-day events |
| E2-091 | dialog:Timetable | + Add slide adds (layout) | planner/lessons.js:1103 | app/screens/settings-plan.jsx:110 | List lacks fullpic and picprompt layouts |
| E2-093 | dialog:Where did the class get to? | Not now / Save (asked after presenting on the day) | planner/present.js:115 | app/screens/lesson.jsx:270 | Recorded automatically after 2+ min with an Undo toast; no question; agenda progress not kept |
| E2-097 | find | Do: Import a lesson | planner/rail.js:115 | app/plan/lesson-menu.jsx:83 | Import is in a lesson menu and an empty-period menu, not in the command bar |
| E2-098 | find | Do: Link / Reconnect / Look in the Planner folder | planner/rail.js:117 | app/plan/pfolder.jsx:52 | Only in Settings > Working with AI card, not a command |
| E2-099 | find | Do: Side panel | planner/rail.js:118 | app/screens/lesson.jsx:279 | Beside command exists only while a lesson is open |
| E2-100 | find | Do: Dark mode / Light mode | planner/rail.js:119 | app/shell.jsx:199 | Command opens Settings > Display instead of flipping |
| E2-104 | sidebar | Library (fold open/closed) | planner/planner.html:505 | app/shell.jsx:104 | Library is one sidebar item with tabs; no fold-out sub list |
| E2-105 | sidebar | Units | planner/planner.html:507 | app/screens/library.jsx:157 | Library > Units is a read-only list of units by course; editing a unit is on the class page Course line |
| E2-106 | sidebar | Past lessons | planner/planner.html:508 | app/screens/library.jsx:132 | Library > Past lessons lists lessons whose day has passed; old lesson-pack lessons (l.library) are not shown anywhere |
| E2-107 | sidebar | Timetable / Set up your timetable | planner/planner.html:514 | app/screens/settings-plan.jsx:76 | Moved to Settings > Timetable; no sidebar button (reachable by command bar, Calendar empty state) |
| E2-108 | sidebar | Saved / Not backed up (Planner folder status: link, reconnect, look in folder) | planner/planner.html:516 | app/plan/pfolder.jsx:52 | Sidebar foot shows grading save state; Planner folder link/look is a card in Settings > Working with AI |
| E2-109 | sidebar | Full screen (F) | planner/planner.html:518 | app/shell.jsx:191 | F key and command remain; no sidebar button |
| E2-111 | unit page | Rubrics and scales on a unit: + New rubric/scale, Open the bank | planner/bank.js:143 | app/plan/bank-edit.jsx:125 | UnitBank on the Course line unit side; no Open the bank button |
| E2-112 | unit page | Lessons for this unit (cards with files) | planner/library.js:33 | app/screens/class.jsx:84 | Course line shows each week's lessons by day; l.unit tie not shown |
| E2-114 | week / lesson | Class page link (opens school system) | planner/lessons.js:194 | app/class/classlink.jsx | Not on calendar slots or lesson chips |
| E2-115 | week / lesson | + Class page link (school system) on a class | planner/lessons.js:195 | app/class/classlink.jsx | Only on the class page (grading side); not shown on the week or on lessons |
| E2-116 | week / lesson | Link to class page | planner/lessons.js:196 | app/class/classlink.jsx | On class page; Enter saves, empty removes |

### Unsure (4)

| ID | Screen | Control | Where (current) | New | What differs |
|---|---|---|---|---|---|
| E1-050 | editor | Show done comments | planner/review.js:235 | app/plan/talk.jsx | Done comments stay listed (struck); check |
| E2-007 | Plan lessons | New school year moves last year lessons to Past | planner/units.js:66 |  | Not a control; not found in next |
| E2-101 | find | Do: Full screen / Leave full screen | planner/rail.js:120 | app/shell.jsx:191 | F key registered; check if command bar lists "Full screen" (keys.full) |
| E2-103 | focus panel | Escape folds the focus panel | planner/plfocus.js:284 | app/focus/panel.jsx | Open focus panel and press Esc |

## Found by the browser crawl (pass 2)

| ID | Screen | Control | Where (current) | New | Kind | What differs |
|---|---|---|---|---|---|---|
| C-901 | Insights tab, Score spread | See this as a table | #/a/<id>/insights; src/rubrics.js:456 | app/screens/mark-out.jsx:102 | missing | Current: under the score-spread chart, a fold-out table of each score band with the count and the students' names. New: bars only, with names in a hover title (first 12) and bars that can't be focused, so there's no keyboard or screen-reader way to see who got each score. See C-023, which is still unsure. |
| C-902 | Grades tab, Grade sheet view | Copy all scores | #/a/<id>/grades/sheet; src/app/gradesheet.js:299 (handler :320-321) | app/screens/mark-out.jsx:35-39 | different | The current Grade sheet footer has Copy all scores: one column in list order, total or percent, blank where unsure, after a check on partly scored papers. The new Grade sheet view has only Box each grade by hand, Same spot on every paper and Grade sheet (PDF). To copy, you switch to the Table view (Copy all totals, Copy all percents, Copy as a table). Pass 1 matched this to sheet.jsx:44, which copies a single score you click. |
| B-902 | Class page, tab row | Keep <page> in the tab row / Take <page> out of the tab row | #/class/<id> More ▾; src/app/screens.js:183 | app/screens/class.jsx:23,139; engines/gstp.js:530,654 | missing | Current: the class page's More ▾ menu pins Attendance, Seating, Missing work, Charts, Goals or Report comments into the tab row, and they stay there. New: the tabs are fixed (Course line, Assignments, People, Grades, To do). My setup still reads and writes classTabs and shows 'Kept in the tab row: …' in the setup diff (app/setup/diff.js:151), but the class page ignores it. |

Pass 2 also corrected two pass-1 verdicts: gradesheet.js:299 (Copy all scores) was "same" and is C-902; screens.js:183 (tab row) was "n/a" and is B-902.


### Found while verifying (re-press on main)

| ID | Screen | Control | Kind | What differs |
|---|---|---|---|---|
| B-903 | Class > Assignments | Card text after counts are filled in at load (H-047) | different | The Assignments tab you land on keeps the old card text ("Not started · 4 of 4 left") until you leave and come back. |
| B-904 | School | Ctrl+Z on the School page | different | Ctrl+Z restores the data but the page does not redraw until reload or leaving; the toast Undo does redraw. |
| B-905 | Class > People > one student (MYP class) | Average, recent tasks and criterion levels on an MYP student page | missing | On an MYP class the student page shows "–" for the average and every recent task, and no criterion levels (only in the gradebook level sheet). |
| B-906 | Class > Charts (MYP class) | MYP charts overview | missing | A pinned Charts tab on an MYP class opens the percent charts, empty ("Term average – 0 students"); the current app MYP charts overview is nowhere in the new app. |


## Found by pressing (not in the code pass)

| ID | Screen | What | Kind |
|---|---|---|---|
| A-901 | Home, first run | No "Sign in with Google / Use on your phone" card and no "Already have a Grading Studio folder? Choose it and your work comes back." line (current Today has both). | missing |
| A-902 | Home, Needs you | Only the small arrow at the right end of each row opens it; clicking the row's text does nothing (current: the whole row). | different |
| A-903 | Home, class now card | Present opens the lesson page, not the presentation (one more press). | different |
| B-901 | Class page | No "Class setup" menu. Current: Add roster, Import scores…, Grading, Linked classes…, class link, Move up/down. New: Edit roster holds the name, paste, upload, Drive and Delete class; Grading moved under Grades > More; Import scores is not reachable for a class with no roster. | different |
| D-901 | Class > New assignment | No "Bring in a rubric…" and no rubric "From Google Drive…" in the dialog (same gap as B rows on screens.js 335/375). | missing |
