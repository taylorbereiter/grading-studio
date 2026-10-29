# Grading Studio

> A small personal grading tool made by a teacher for her own classes. It stores nothing online; all files stay in your browser. Not maintained for public use.

Open a ManageBac download, mark each paper, score it, read off the grades in folder order, and export the marked files back into the same student folders.

**Open it:** https://taylorbereiter.github.io/grading-studio/ (GitHub Pages, serves `index.html`), or double-click `Grading Studio.html` to run it offline. Student files stay in your browser and never go to a server or to Claude.

## How to use
1. Download the submissions from ManageBac. Drop the ZIP (or the unzipped folder) onto the page.
2. Students are listed in folder order. Mark with Pen, Highlight, Text, Comment (a box in the margin with a line to the spot), Check, and Eraser. Use ← → to move between students.
3. Score with the rubric on the right: 4 to 1 per row, half points included. 3 rows = out of 12 with your grading scale (10.5 = 93%). **Rubric setup** renames rows or switches to plain points.
4. **Grades list**: every student in folder order with row scores, total, percent and your ManageBac comment. Click any cell to copy it.
5. **Grade sheet**: for papers you marked here or in Kami, it finds a grade you typed (like "9.5 = 88%", "9.5/12 = 88%" or "10/12") and shows a cropped picture of it per file, with the folder and file name on each row. Click a picture to open that exact file. If a file has two or more grades on it, all of them are shown and flagged "check"; nothing is picked for you. Grades written by hand? Use **Pick the spot by hand** and drag a box where the grade goes; that spot is cropped on every paper.
6. **Export marked**: reads and crops the grades first, then flattens every marked file (your marks here and any Kami marks) into a ZIP with the same student folders, plus the grade sheet PDF. Files with no marks are left out. Your original files are never changed.

7. **Arrange pages** combines a student's files and drags pages into order; extra papers with no marks are left out by default (Bring back restores them).
8. **Share with Claude**: makes a ZIP with no names. Each student gets a random code (S-XXXX); the key stays in your browser. Every page becomes a picture, typed names and long ID numbers are covered in black, names in your comments become [name]. **Check the covers** walks paper by paper so you can box handwriting it missed ("Use my last box on every paper" for a fixed name spot). The ZIP holds papers/S-XXXX.pdf, scores.csv, comments.json, rubric.json and a README telling Claude how to answer.
9. **Bring back from Claude**: paste Claude's reply (blocks starting with a code) or drop its CSV/ZIP. It shows code, student and feedback for you to read, then puts each one in that student's comment box. PDFs named by code can be downloaded sorted into student folders.

## Handy extras
- **Turn a page**: point at a page and use ⟲ ⟳ in its top corner, or **⟳ Turn all pages** above a file. In Arrange pages, pick pages and press R (or ⟳ Turn). Your marks turn with the page, the turn is kept, and the export comes out turned.
- **Undo and redo**: ⌘Z and ⇧⌘Z (or ⌘Y), also on the toolbar.
- **Zoom**: pinch or ⌘-scroll on the paper, ⌘+ / ⌘− / ⌘0, or click the percent to go back to 100%.
- **Picked marks** (Select tool): arrow keys nudge (Shift for bigger steps), ⌘C / ⌘V copies a mark to the page you're looking at (even another student's), ⌘D duplicates, Delete removes, Esc lets go.
- **Everyone on the roster**: with a class picked, every roster student is in the list, even with nothing turned in yet (marked "no paper"). Click their name for **Add their file…** or **From a scan…**.
- **A makeup scan**: with a download open, **Bring in files → A scan to split…** splits another scan into it. Drag pages onto names like the first split; students already in the download get the pages as an extra file, and roster students who weren't in it yet are added in roster order.
- **Change marks after exporting**: with **Keep marks editable** ticked (the default), each exported PDF also carries the original pages and your marks. Open the exported ZIP or folder like any download, or add one exported file to a student, and the marks come back as marks you can move, change or delete. The files are about twice as big. Marks baked in by an older export can't be taken apart.
- **Straight lines**: hold Shift while drawing with the pen.
- **Find a student**: type in the box above the list, or press /.
- **All keys**: press ? for the full list.
- The top bar shows "Saved" once your marks are kept, and the start screen reminds you when your last backup is more than a week old.

## Audio, video and Word files
- Recordings (mp3, m4a, wav, mp4, mov, webm…) play at the top of each student with 10s skips, 1× to 2× speed, and **+ Time to comment** (adds [2:15] to the ManageBac comment). Keys: Space play/pause, J/L back/ahead 5s.
- **Make transcript** runs speech-to-text in your browser (Whisper, same as the Interview Transcriber; a one-time engine download). Words light up as it plays; click a word to jump there. Transcripts are kept with your marks. Not in the claude.ai preview copy.
- Word files (.docx) show as readable pages. Old .doc files can't be read in a browser.
- **Keep a Word doc beside every paper** (under the comment box): your rubric/notes doc shows at the top of every student in that download.

## Google sign-in (hosted copy only)
- **Open from Google Drive**: pick the download folder (one folder per student) or the ZIP; Google Docs come down as PDFs.
- **Export → Save to Google Drive**: a "Marked - …" folder with the student folders, inside the folder you opened (or My Drive).
- **Sync**: units, assignments, rosters, setup, saved comments and each download's marks and scores are kept in a hidden app file in your own Drive, newest copy wins, so every computer matches.
- Needs a Google Client ID (Web application, origin = the address where you host it) built in as GCID: `GCID=… npm run build`.

## Classes, units and rosters
- The start screen is organized by class. Each class has its roster and its own units, and each unit holds its assignments. Drag an assignment to another unit or class, drag a unit's name to move it, and use ↑ ↓ to reorder classes. Each unit has a "+ Link to Atlas" spot under its name for that unit's Atlas page, and while grading an assignment the top bar shows "Atlas ↗" (or "+ Atlas link") for its unit.
- Students always appear in the order of the class roster you pasted. Anyone the roster doesn't name goes at the end, in folder order. With no class picked, the class whose roster matches the most folders is used. Changing the roster in the top bar re-sorts the list (and moves the assignment to that class).

## Good to know
- Classes 12EL-1, 12EL-2 and 11EL-2 are there from the start; add the student names when you want roster order.
- Your marks, scores and comments are kept in this browser (localStorage), per download, and in your own Drive when signed in. Drop the same download in again to pick up where you left off.
- Saved comments ("Save for reuse" in a comment) are kept in this browser too.
- Word files can't be opened here; they're listed so you can still give a score.

Rebuild: `npm install && npm run build` (pdfjs-dist 3.11.174, pdf-lib 1.17.1, fflate 0.8.2, mammoth 1.11.0, html2canvas 1.4.1) builds `Grading Studio.html` from src/app.html + src/app.js.
