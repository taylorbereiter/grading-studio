# Grading Studio: plan to make it professional grade

Written 2026-10-31, from a read of the code, a test run with the sample papers, and Taylor's answers.

**Where this stands (2026-11-01):** all seven phases are built. What wasn't, or what only you can judge, is noted under each phase, and every problem I know of is under [What's still open](#whats-still-open) at the end. The work sits uncommitted in the project folder, so nothing has reached the live link.

## What "professional" means here

In order of importance:

1. **It never lets you down.** Work isn't lost, grades aren't wrong, exports finish, and it warns you before anything goes bad.
2. **Marking and sorting feel easy.** Those are the two biggest pain points today.
3. **It looks polished.** Refine the Calm Desk look, and stay open to a redesign if a mockup beats it.
4. **It has smarter tools you'd really use.** Class overview, consistency check and student history.
5. **Your work lives on your work laptop and is easy to carry.** One protected file moves everything to your home computer and back, with no cloud service involved.

## Ground rules

- **Keep the same address.** Browsers tie saved work to the address, so moving off the GitHub Pages link would strand everything saved there.
- **Improve it in steps, with no rewrite.** The app stays usable between phases, and existing saved work keeps opening.
- **Keep it one file.** The double-click offline copy stays. The code behind it can be split up gradually.
- **Use made-up student data only in tests and in this repo.** The repo is public.
- **Claude stays manual.** Nothing leaves the app unless you carry it out.
- **Stay browser-based, in Chrome.** No installer to get past school laptop rules, and the same link works on both computers.
- **No cloud sync.** The laptop is home base, and a file you carry replaces syncing through Google Drive.

## Phase 0: Safety net (small)

Do this first, because everything later changes code you rely on.

- Add automated tests for grade math, reading grades off papers, saving and reopening, and exporting, using made-up papers.
- Run those tests in a real browser, on both Mac and Windows behaviors where they differ.
- Pushing to `main` currently updates the live app immediately. Add a preview copy, so a change gets tried before it reaches the link you grade from.
- Show a version number in the app.
- Save an automatic snapshot before any change to how saved work is stored.

**Done when:** a bad change gets caught before it reaches your grading link.

**Built.** All of it. The tests have only run on this Windows computer. Mac behavior, such as key names, is imitated in Chrome, not run on a real Mac.

## Phase 1: Never lets you down (medium)

Each of these comes from the audit.

| Problem today | What changes |
|---|---|
| With 1 of 3 rubric rows scored, the Grades list shows "4, 64%" with no warning, and Copy all totals would include it. | Partial scores are clearly marked, and copying warns you first. |
| "✓ Saved" appears before the save happens, and a failed save can go unnoticed. | "Saved" appears only after the save succeeds. A failure gives a warning you can't miss. |
| A download with one new or changed file starts blank. The marks are still under the old copy, but nothing says so. | The app recognizes it as the same assignment and carries marks over per student. Anything changed is flagged. |
| One bad file stops the whole export, and the error doesn't name it. | Export finishes the rest and lists exactly which files failed and why. |
| A comment like "Due 10/12" or "page 3/12" can be read as a grade. | Readings that look doubtful are flagged for you to confirm, and don't count as grades on their own. |
| Rubric rows have no 0, and "missing" isn't a real state. | Add 0, plus **missing**, **excused** and **late**, all kept separate from "not scored yet". |
| Nothing checks the class before you finish. | Add a pre-export check: unfinished scores, students with no paper, grades that disagree with the paper, and unmarked files. |

**Done when:** the checks above are covered by tests, and you can trust the Grades list without double-checking it.

**Built.** All seven rows. The grade reading also went further than this table: a second grade anywhere on a paper now always asks. Known gaps are under What's still open.

## Phase 2: Local saves and the take-home file (medium to large)

### Automatic saving to a folder on your laptop

- You pick one folder once. After that, every save goes to both the browser and the folder, with no save button to remember.
- The folder holds the student papers, marks, scores, comments, rosters and rubrics, plus dated snapshots to go back to.
- Choose "Allow on every visit" when Chrome asks, so it [doesn't need asking each time](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api). This needs testing on your school laptop.
- The top bar says plainly where work is saved. If the folder can't be reached, you see that right away, and it catches up once the folder is back.

### Keeping the most recent work

- When the browser and folder differ, the newest version wins **per student**, not per download. Newer work on one student can't erase work on another.
- A cleared score counts as a real change, and a forgotten download stays forgotten instead of coming back.
- Newest isn't always best, so the snapshots let you undo a merge that went wrong.
- If the same student changed in both places since they last matched, the app shows you both instead of choosing silently.

### The take-home file

- **Take my work with me** makes one passphrase-protected file with everything: student files, marks, scores, comments, rosters, rubrics, readings and Word edits.
- **Bring work in** on the other computer shows what will change, then merges it per student. The trip back to the laptop works the same way.
- This replaces today's backup, which is an unprotected ZIP. Restoring it can overwrite newer work saved in the browser's main store, and it replaces your rosters and settings outright.
- A forgotten passphrase only loses that copy, because the originals stay on the laptop.
- It has to cope with a full year of papers without freezing the tab, so this gets tested at realistic sizes.
- **Remove from this computer** clears student work from the home computer when you're finished.

**Done when:** you can clear the browser and get everything back from the folder, and work done at home returns to the laptop with nothing lost.

**Built.** The folder link, per-student merging, the take-home file, Bring work in and Remove from this computer. Over 600 MB of made-up papers went through a take-home file and back in a test. **Not checked:** the folder link and "Allow on every visit" on your school laptop, which only you can try, and a merge of real work between your two computers.

## Phase 3: Polish (medium)

- Show mockups first: refined Calm Desk as the main option, plus one redesign to compare. You pick.
- Cut the top bar from 14 controls on two rows to the few you use constantly. The rest move into tidy groups.
- Rebuild dark mode properly. Today the whole-number rubric buttons and most tool labels are nearly invisible, and the progress bar looks full at 0 of 5.
- Show ⌘ on Mac and Ctrl on Windows. The keys already work on both; only the labels are wrong.
- Replace browser pop-ups with the app's own dialogs, and make keyboard use inside dialogs consistent.
- Build the font into the app, so it looks the same offline and doesn't contact Google on load.
- Tidy the start screen so today's work comes first.
- Fix outdated lines in the README. It still says Word files can't be opened in one place.

**Done when:** every screen looks like one product in light and dark, on both computers.

**Built.** The one-row top bar, dark mode, Mac and Windows key names, the app's own dialogs, the built-in font, the tidier start screen and the README lines. **Not decided:** the redesign to compare is at `docs/mockups/redesign.html`, but nothing records you choosing between the two, so the app is the refined Calm Desk for now. **Not checked:** how it looks on your Mac.

## Phase 4: Marking (medium)

- **Pen:** capture every point of a fast stroke, which the browser allows but the app doesn't use yet. Then tune smoothing for mouse and trackpad, so handwriting looks less jagged.
- **Highlighter:** today it only drags a rectangle, so it can miss or overrun lines. It will snap to lines of typed text, with a freehand option for scans and handwriting.
- **Text boxes and comments:** make placing, resizing and moving take fewer steps, with clear handles, sensible default sizes and less re-selecting.

**Done when:** you've marked a real stack on your Mac and on Windows and the fiddly moments are gone. This phase needs your feedback, because feel can't be judged from tests.

**Built.** Every point of a fast stroke, snapping highlights with a freehand option, and easier text boxes and comments. **Not checked:** the feel on a real stack, on your Mac and on Windows.

## Phase 5: Sorting submissions (medium to large)

- **Paper scans:** automatically turn sideways or upside-down pages, straighten crooked ones, flag blank pages, and suggest Lighting for faint ones.
- **Late work:** add a clear way to bring late papers into a stack you've started, building on the carry-over from Phase 1.
- **Mixed files:** test and fix phone photos (including iPhone HEIC), Word files, Google Docs exports and recordings. Anything that can't open gets a plain explanation and a next step.
- **Opening report:** after a download opens, show one summary: what opened, what didn't, who has nothing, and anything that looks odd.

**Done when:** a messy real-world stack opens with no surprises and tells you what needs attention.

**Built.** Scans, late work, mixed files and the opening report. **Not checked:** your real stacks. Everything so far has been made-up scans and files.

## Phase 6: Smarter tools (large)

Built in this order, because each one uses the one before it. All of it stays in your own browser.

1. **Rubric library:** show what each score means on each row while you grade, and save rubrics to reuse.
2. **Class overview:** score spread, which rubric rows the class struggled with, and who's missing or unfinished.
3. **Student history:** a student's past scores and your earlier comments beside their new paper. This needs students matched reliably across assignments, using your rosters.
4. **Consistency check:** papers with the same score side by side, and whether you graded harder or softer as you went.

Also smooth the manual Claude steps, and show clearly which papers have had their name covers checked.

**Done when:** you open these during a real grading cycle without being reminded.

**Built.** All four tools, smoother Claude steps, and a clear record of which papers have had their covers checked, plus a look at every paper for a name that wasn't found. **Not checked:** whether you reach for them in a real grading cycle.

## Not in this plan

- Sending papers to Claude from inside the app.
- New Google Drive work, including sync. The existing Drive code stays dormant, since the live copy has no Google key built in.
- Automatic entry into ManageBac, which wasn't a pain point. The copy tools stay.
- iPad or stylus work, since you grade on Mac and Windows.
- Weighted rubrics, other level counts and IB or MYP bands.
- Changes to Lessons, beyond keeping it working and matching the new look.

## What's still open

No problem I rated serious is still open, apart from the limits and questions below, which include one judgment call: replacing a rubric across two computers now warns instead of asking.

### Smaller problems

- **Replacing a Word rubric under a new name on one computer hides highlights made on the other.** Nothing asks when it happens. The score stays and the highlighted copy is still stored, but no file shows it, so the app now says so when that download opens: "A highlighted copy of an older rubric is kept for 1 student". Check those scores against the new rubric. A replacement with the same file name is fine.
- **A student with no paper loses their shaded Word rubric when the download is reopened.** The score stays, but the copy doesn't, so the highlights can't be seen or returned.
- **The printed grade sheet says "Nothing turned in"** for a student whose paper is only unmarked. The screen says "Only unmarked files, left out". No score is wrong.
- **A card with a rubric and very old scores that don't fit it** doesn't ask. It only shows up with storage edited by hand, since every save writes the rubric.
- **A pen mark on the old build's stray "reading" row is erased** after upgrading, with no warning. The row holds no student's paper or score, and its comment stays.
- **A boxed grade stands** even when a second grade sits outside the box, since only the box is read.
- **Letter grades aren't read**, so "Revised: B+" beside "Grade: 8/12" leaves 8 standing with no question. "Rewrite on 10/12" reads as a date and does the same.
- **An everyday last name in small letters counts as finding the name**: Ben Hall with "down the hall", or Harper Quinn with "Harper Lee". If the real name on that paper is handwritten or a nickname, it stays uncovered with no "Name not found", though the paper still shows as not checked yet.
- **A page with only a name in the top margin is called blank.** Nothing goes without you seeing it first, in Leave out blank pages.
- **Names in comments**: a Russian name with a changed ending, or a one-character Chinese given name on its own, stays as typed in comments going to Claude.
- **Some words get covered that shouldn't**, though no name leaks: with a classmate علي, the words عليهما and عليّ, and with a classmate Mỹ Cát, "my cat".

### Limits I left as they are

- Word papers can't be boxed in Check the covers. They're listed with a warning before anonymous grading, and saving one as a PDF is the way to cover a name.
- A name that's exactly an everyday word and is the student's only name isn't covered alone on classmates' papers. It's covered on their own paper and after "Name:".
- The everyday-word list for other alphabets is short and hand-picked. Names that are also words, like 지혜 or أمل, are left off, so those still get covered on classmates' papers.
- Non-Latin names of three or more letters can match the start of a longer word that isn't on the list. Longer Russian-style endings need this.
- Lao gets the "another alphabet" safety net but not the Thai fix for stacked marks.

### Questions for you

- **Name not found on scans.** Papers with no typed name will all be marked, so the list can be long for a class of scans. Does it feel useful or noisy?
- **"It has no names in it."** Any class with a non-Latin name now gets the general "another alphabet" warning, and Share holds this line back until every paper is checked. That's stricter than before. Is that right for you?
- **The everyday-word list.** A native reader should look over the Arabic and Hebrew words in `PLAIN_OTHER` in `src/names.js`, since a word on it isn't covered alone on classmates' papers.
- **Lý and Vũ in small letters.** "ly" and "vu" now stay as typed on other students' papers, while "Ly" and "LY" are covered. That's the trade for not covering "cat" for Cát.
- **Replacing a rubric with no scores.** A row added on one computer with no scores anywhere is replaced by the card's rubric without a question, and the preview says so. Is that what you want?
- **The rubric question.** Do the title "Which rubric should this use?", the sides "On the assignment card" and "Saved with this download", and the Not now button read right? If all three copies differ, you see only the two download copies, and the card takes whichever you pick.
- **Old backups** with changes on both sides now ask instead of keeping the later one, so bringing one in may show a few new questions.
- **Part-marks now ask.** "Thesis 3/4" beside "Total 10/12" stops 10 standing until you pick, one click. Part-marks out of another total could be let through if that gets annoying on rubric-style papers.
- **A student's own text beside your mark asks too**, like an essay containing "Grade: 11/12 = 95%". So does the same grade written twice. Your mark doesn't count until you press Use it once.
- **Work you've already saved**: a student with a sure grade, a doubtful reading beside it and no score of your own will show "?" next time it opens. Your own scores and answers aren't touched.
- **Darkened pictures of blank pages.** Do they read well on your scans? Under a heavy scanner shadow the shadow goes near black, so writing inside it needs the big as-scanned view, one click away.

### Can't be checked from here

- Your school laptop, your Mac, and how marking feels.
- Your real scans, your real tablet files (the ink test used a generated PDF, not one from a tablet app), and Thai PDFs from programs other than Chrome.
- Two tabs open while one takes a rubric row out: the fix covers two computers and a linked folder, and a stale tab could still shift scores. That's from reading the code, not a test.
- Taking a row out through a linked folder: it uses the same merge, and only the merge tests and the take-home flow have run it.
- The live GitHub Pages link: the test runs use localhost and file://.

## What I need from you

- **During Phase 2: a quick test on your laptop.** Check that Chrome lets the app link a folder and keep access.
- **During Phases 4 and 5: real-use feedback.** Your real papers stay on your computer and never go in this repo.
