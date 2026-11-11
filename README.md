# Grading Studio

Mark student papers, score them, plan lessons and hand work back, in your browser. Student work never leaves your computer: there is no account, no server and nothing to install.

**Open it:** https://taylorbereiter.github.io/grading-studio/ in Chrome or Edge. Or download `Grading Studio.html` and double-click it to run it with no internet at all.

## What it does

- **Mark** PDFs, Word files, photos and scans with a pen, highlighter, text, margin comments, check marks and proofreading marks.
- **Score** with rubric rows (0 to 4, half points too), plain points or a percent. Letter grades or IB 1 to 7 can be worked out from the percent, with boundaries you set.
- **See the class**: a Grades list to copy from, a gradebook with terms and weights, and charts for each class and each student.
- **Hand work back**: one click makes the marked files, in the same student folders they came in.
- **Plan and teach**: the Planner keeps units, lessons and slides beside your timetable. Present a lesson full screen, with its agenda and a timer for the class, and note where the class got to. Lessons also download as PowerPoint files.

## Start in five minutes

1. Open the link. A new browser asks three questions: what you teach, how you grade, and where your work should be kept. Every answer can be changed later in Settings.
2. Or click **Look around with a sample class first**. It makes a class of six made-up students with papers to mark, score and export. **Remove the sample class** on Today takes it away again.
3. Download a class's submissions from your school's system and drop the ZIP on Today. A folder, loose files, or one scan of the whole class's papers work too.
4. Mark and score. **Enter** goes to the next paper. The **Grades** tab lists every score to copy, and **Return** exports the marked files.

## Where papers can come from

| From | What to drop on Today |
|---|---|
| ManageBac | The ZIP of submissions, or the unzipped folder: one folder per student. |
| Google Classroom | The assignment's Drive folder, downloaded: one file per student. |
| Canvas | "Download submissions": the app groups each student's files by the name Canvas puts at the start of each file name. |
| Moodle | "Download all submissions", as folders or as loose files: either way each student's files are put together. |
| Microsoft Teams, Schoology, anything else | A ZIP or folder with one folder (or one file) per student. |
| Paper | One scan of the whole stack: **Split a scan of everyone's papers** deals the pages out to students. |
| Email | **+ Add → Pasted text** turns text a student sent you into a page to mark. |

With a class roster pasted in, students are listed in your roster's order and matched to their files by name.

## Your students' privacy

- Papers, names, marks, scores and comments are kept in your browser and, if you choose one, a folder on your own computer. Nothing is uploaded.
- Opening the app contacts only the address it is served from, to ask which version is newest. Nothing about you or your work is sent.
- Working with Claude is optional and manual. **Share with Claude** makes a file with student names covered and a random code for each student; the key to the codes stays in your browser.

## Keeping your work safe

The sidebar says **Not backed up** until you choose a folder. Once you do, every save also goes to that folder, with a copy of each day that **Go back in time** (in Settings) can restore. A **take-home file**, protected by a passphrase, carries everything to another computer and back. Installed as an app (Settings, About and updates), Grading Studio opens with no internet, and a new version waits until you click **Update now**.

## More

- **Help** in the app's sidebar has short answers to common questions, and **Find anything** lists them too.
- **Report comments** (a tab on each class's page) drafts a comment for every student from the gradebook, the rubric scores and the comments written on their papers. The drafts are made in the browser from a bank of sentences the teacher can reword; nothing about a student is sent anywhere.
- **Tablet and pencil**: on a touch screen a pencil draws (with pressure), a finger moves the page, two fingers zoom and a resting palm is ignored (src/touch.js). Tested with the browser's synthetic pen and touch input; a real tablet is still the proof.
- **Languages**: the app is written in English and can be shown in another language. Spanish is the first (Settings, Display, App language), covering the sidebar, Today, the welcome, Find anything, Help and the feedback page in a returned paper. A language is one file, `src/lang-es.js`: English lines with their translation, rules for lines with a number or a name in them, and the Help answers. `src/lang.js` reads what is drawn on the covered parts of the page and puts it into the language; a line the file doesn't know stays in English, and names a teacher typed are never touched. To add a language, copy `src/lang-es.js`, translate it, and name it in `LANG_PACKS` (src/lang.js) and in build.js; `test/lang.test.js` lists what a file still leaves in English.
- **[The full guide](docs/GUIDE.md)**: every screen, tool and shortcut, and the Planner.
- **Settings** in the app holds your classes and rosters, where students hand in work, how you usually grade, terms and weights, the timetable and the display.
- Nothing about any teacher, school or timetable is built in. A test opens a brand-new browser and fails if a class, a grading scale or a school system's name appears that nobody typed.

## License

MIT. Use it, change it and share it, free of charge; see [LICENSE](LICENSE). The libraries built into the pages keep their own licenses.

## Rebuild, test and preview

`npm install` once, then:

- **`npm run build`** also writes `sw.js` (from src/sw.js), `version.json` (the version, what’s new from src/whatsnew.json, and a hash of each page) and `manifest.webmanifest`, which let the web address be installed and kept offline. The icons in `icons/` are drawn by `node test/tools/make-icons.js`. For a new version, set it in package.json and add its lines to src/whatsnew.json.
- **`npm run build`** builds `index.html` and `Grading Studio.html` from src/app.html, src/tokens.css and src/parts.css (the colours, text sizes, spaces and corners, and the parts both pages share), src/polish.css, src/fonts, src/migrate.js, src/app/ (the app itself, one file per screen or job, joined in the order src/app/order.json lists), src/names.js, src/marking.js, src/grades.js, src/saving.js, src/carryover.js, src/exportreport.js, src/rubrics.js, src/rubrics.css, src/intake.js, src/polish.js, src/insight.js, src/insight.css, src/scans.js (with src/scans.css), src/merge.js, src/folder.js, src/takehome.js, src/quiz.js, src/imported.js, src/marksout.js and src/pastetext.js (pdfjs-dist 3.11.174, pdf-lib 1.17.1, fflate 0.8.2, mammoth 1.11.0, html2canvas 1.4.1, libheif-js 1.23.5). Lines that are only a comment stay in src/ but don't ship, which keeps the file under its size limit. It also builds `planner.html` and `Planner.html` from src/planner/ only (planner.html, base.js, review.js, lessons.js, looks.js, activities.js, present.js, rail.js, units.js, with fflate and the Inter font), plus src/present.css, the look of a lesson being presented. Two files go into both pages: src/rail.css, the look of the sidebar and Find anything (each page draws them with its own code), and src/helpdata.js, the answers on the Help page (src/help.js and src/help.css draw it on the grading page).
- **`npm run check`** builds, then runs every test, which takes about a quarter of an hour. Run this before pushing, because a push to `main` changes the live link right away.
- **`npm test`** runs the tests on the last build, four files at a time. A file that fails is run once more on its own, and is listed apart if it passes then (a slow moment on a busy computer). The full output of each file is kept in out/test-logs. `npm test -- nav marking` runs only the files with those words in their names. The tests use `node:test` and drive the Chrome already installed on this computer (Windows, Mac or Linux; set `CHROME_PATH` if it's somewhere unusual) with a throwaway profile. Nothing is downloaded, your real Chrome profile isn't touched, and the test browser can't reach the internet. All the papers are made-up and generated in code.
- **`npm run screens`** takes a picture of every screen at three sizes (1024, 1366 and 1920 wide), in light and in dark, and compares each with the same screen as `main` has it. It fails when a screen looks different and the change doesn't say so: a change that means to alter a screen names it in `test/screens-changed.txt`. The pictures, and old, new and the difference side by side, go to out/screens.
- **`npm run saved-work`** makes work with `main`'s pages (papers, marks, scores, a class, a lesson), then opens it with this build at the same address, as the website and as the double-clicked copy. It fails if anything saved is changed or missing afterwards, or if `main`'s pages can no longer read it. A change that means to alter what is stored says so in `test/saved-work-changed.txt`, and needs a step in `MIGRATIONS`.
- **`npm run speed`** measures the pen (pointer move to ink), going to the next student, opening 30 papers and opening the app, and prints each beside its target. It fails only when one is several times slower than today.
- **On GitHub**, every pull request and every change to `main` runs all of these (`.github/workflows/checks.yml`). The one result to require on `main` is **All checks**.
- **`GS_BIG=1 node --test test/takehome-big.test.js`** sends over 600 MB of made-up papers through a take-home file and back, checking the tab keeps responding. It takes minutes and about 2 GB of disk, so `npm test` skips it.
- **`npm run preview`** builds, then serves the app at http://localhost:4173, so you can try a change in a real browser before it reaches your grading link. Press Ctrl+C to stop.

**Why the preview isn't on github.io.** Browsers keep saved work per address, and every page under `taylorbereiter.github.io` is the same address, even in another folder or repo. A preview there would open your real saved student work, and a bad change could damage it. `localhost:4173` is a different address, so it starts empty and keeps its own saved work. Use the sample papers or made-up files there, and your real work stays on the real link.

**Version number.** Set it in `package.json`, and nowhere else. It shows at the bottom of Today and Settings, and in the Keys list (press ?).

**Changing how work is saved.** Add a step to `MIGRATIONS` in src/migrate.js; the rules are at the top of that file. Before any step runs, the app keeps a safety copy of marks, scores, comments, units, rosters and settings in this browser (the last three copies; papers aren't copied, since they never change). If a step fails, everything goes back as it was, and it tries again on the next load with a fresh copy in place of the last one. If the tab closes partway, it starts again and keeps the copy it made first. If a step is still going after 30 seconds, a button offers to stop it and put everything back; a stopped update waits until the version number goes up or a new step is added, so raise the version when you fix it.

Safety copies are listed under Saving and carrying, in Settings, each saying what it was made before, with a **Put back** button. Putting one back removes marks, scores, late files and readings added since, and a safety copy made first lets you undo it. The papers from each download stay, so a download opened since stays listed with no marks. **Forget** also removes that download from every safety copy, so Put back can't bring it back.

**Old-format saved work.** `test/fixtures/legacy-v1/` holds what the app wrote before saved-data versions existed, made by `test/tools/capture-legacy.js` from that old build. Leave those files alone: they're how the tests prove old work still opens.
