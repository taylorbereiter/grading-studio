# Handwritten name finder: experiment tools

This folder holds the experiment behind finding students' names in handwriting on scanned papers. Nothing here is part of the app yet. Grading Studio does not load any of it.

The idea is narrow on purpose. The app never has to read a whole essay. It only has to answer "is this handwritten word one of the 20 to 30 names on this class's roster?" and box the word if it is. A printed "Name:" label is a second clue: whatever is handwritten after it gets boxed, whatever it says. Since version 3 the search also uses what the app already knows: whose paper each scan is. So on each paper it looks hardest for that one student's name, where names are written.

Two ways of doing that were tried and scored on the same tests:

- **A. Hand-set word-shape matcher** (`shape.py`). Nothing is trained. A word picture is cleaned up, its slant taken out and its middle band found. It is then turned into a row of column measurements chosen by hand (ink above, in and below the middle band, the top and bottom outline, stroke directions). That row is compared with each roster name drawn in 12 handwriting fonts, using dynamic time warping.
- **B. A small reader trained from zero** (`model.py`, `train.py`). It is a convolutional network of about 500,000 weights, starting from random numbers, with nobody else's model inside. It reads a 32-pixel-high strip of handwriting into letter chances. A roster name is then matched against those chances (`reader.py`, `spot`), and a word only counts if nothing but gaps or marks surrounds the name. That way "Ava" is not found inside "Java".

`find_names.py` is the page part. It finds the handwritten words on a scan with plain image rules (no learning), reads each one, and boxes the matches, plus anything after a printed "Name" label.

## Version 3 (4 Nov 2026, afternoon): the student's own name

The app knows whose paper each scan is, because every scan in a batch is matched to a student on the roster. So the job that matters is narrower than "find any roster name anywhere": cover this student's own name on this student's paper, plus classmates' names and whatever is written after a printed "Name" label. Version 3 is built and scored for that job. The old any-word test is still reported at the end of this section.

### What changed

- **Known-student search** (`find_names.own_name`). The student's first and last name are looked for where names are written: the first and last lines of the writing, and at least the top 30% and bottom 25% of the page. Neighbouring word boxes are also read together (a name the box finder cut in two), first and last name are scored as a pair side by side or inside one box, and an initial after the first name is read with look-alike letters (I, l, 1). The rest of the page is searched one box at a time with a stricter bar. A match only counts when the reader is sure of its own reading there (`HW_CONF`), which keeps paper texture and table tops from reading as names.
- **Cover finishing** (`metrics_names.polish`, ink outlines from `comps.py`). A cover takes in the strokes it cuts through (only strokes level with it, not a neighbouring line), a name cut in two at the Name line is covered whole, and the pieces on the Name line become one bar. This matters most on black-and-white scans, where words break into dots and dashes.
- **Word finder fixes.** Big names are split only where the ink thins (`HW_VALLEY`), tall names are kept (`HW_TALL`), word-shaped boxes touching the picture edge are kept (`HW_EDGE`), small pictures are judged by letter height (`HW_BIGCC`), and the Name label rule accepts a name written bigger and higher than the label (`HW_LABEL_LINE`).
- **Roster covers** also need the reader to be sure of its reading (`HW_RCONF`), and the class-roster cut-off is picked for a 50-name roster on held-back pages (`pick_roster.py`).
- **First-line guess.** When nothing on the page reads as the name and there is no Name label, a short first line (at most 3 words) at the top of the page is covered for the teacher to check (`HW_FALLBACK`). This is what covers most names written in Chinese characters on lined paper.
- **Reader.** Unchanged from version 2 (`reader1`, `reader.bin`). A further training run started from it with faint ink, uneven light and heavy JPEG added (`INIT`, `AUG2`) read single held-back GNHK words a little better (character error rate 20.4% against 21.7%) but found names no better on the held-back pages (names left in place on photos 83% against 88%, the other sets equal), so it was not used.

### New tests

All handwriting in these tests is real. None of it was used to train the reader.

- `make_name_pages.py`: GNHK test pages. Two words of the page's own writer stand in for the student's first and last name and are moved to where a name goes: after a printed Name label, on the top line, in the top corner, or signed at the end.
- `make_scan_pages.py`: pages built like the ones a teacher scans. Lined notebook paper with an essay (name top left, top right, on a printed Name line, or signed), printed test papers with a Name line and answer lines, and second pages with no name. Every handwritten word of one GNHK page is lifted off its photo, re-toned as pen or pencil, and written again in reading order on the new paper; two of the writer's words stand in for the name. Then a scanner pass: slight tilt, blur, noise and size change, black-and-white copier mode (15% of pages), JPEG, a lid shadow, show-through from the back.
- `eval_inplace.py`: nothing moved at all. On each GNHK test photo, two neighbouring words on the first two lines (or the last two lines) stand in for the name where they were written.
- Practice pages in the 31 held-out fonts (`make_pages.py`) and Chinese names in four held-out Chinese handwriting fonts (`make_pages_zh.py`), fresh sets.

Every rule and cut-off was chosen on held-back pages only (every 13th GNHK training page, never used to train the reader, and font pages made with other seeds). Then `run_final3.sh` scored each fresh test once.

### Results

The student's own name, whole name covered (every word of it at least 70% under covers on real handwriting, half its box on font pages). A wrong cover is a cover that is not over a name. Fresh test pages, each scored once with every rule and cut-off fixed beforehand:

| Test | Pages with a name | Whole name covered | Wrong covers per page |
|---|---|---|---|
| Scan-style pages like a teacher's (`make_scan_pages.py`, GNHK test writers) | 315 | 94.3% | 0.44 |
| of which printed tests with a Name line | 117 | 95.7% | 0.32 |
| of which lined paper essays | 198 | 93.4% | 0.43 |
| Second pages of those essays, no name on them | 27 pages | | 0.96 |
| Real handwriting moved to where names go (`make_name_pages.py`, GNHK test) | 343 | 95.6% | 0.30 |
| Names left where they were written, phone photos (`eval_inplace.py`, GNHK test) | 192 | 83.3% | 0.44 |
| Names in Chinese characters, four held-out fonts (`make_pages_zh.py`) | 100 | 96.0% | 0.12 |
| Practice pages in the 31 held-out fonts (`make_pages.py`) | 195 | 98.5% | 0.20 |

On the scan-style pages the three scan kinds come out alike: grey scans in pen 94.6% (185 pages), in pencil 93.2% (74), black-and-white copier scans 94.6% (56). Classmates' names: 118 of 123 covered on the font pages, but only 55 of 81 on the scan-style pages (a real word of the writer inside the essay standing in for a classmate's name, found by the class-roster search alone). Without the known-student search (class roster and Name label rule only) the same pages give 70.8% (scan-style), 68.5% (moved names), 51.0% (Chinese) and 84.6% (fonts).

The held-back pages used to choose the rules gave higher numbers (scan-style 96.2%, moved names 98.1%, names in place 88.1%), as expected when choices are made on them.

The 18 misses on the scan-style pages were looked at after scoring, without changing anything: in 10 the name was not found at all (mostly essays with the name on the top line and no printed label), in 7 one of the two words was missed, and in 1 the cover was too small. On 4 printed tests the Name label was not picked up.

The any-word test from versions 1 and 2 (any roster word anywhere on a whole page, 25-name roster; cut-offs picked on held-back pages as before), with the version 2 numbers at the same number of wrong covers in brackets:

| Test | Names covered (wrong covers per page) |
|---|---|
| GNHK test, 172 pages | 74.2% (0.25) [64.9% (0.18)], 80.1% (1.04) [74.5% (1.04)] |
| Danish scans, 223 pages | 74.3% (0.06) [66.3% (0.06)], 81.0% (0.27) [78.3% (0.24)] |

That test asks for every listed word anywhere on a phone photo, which is a harder job than the app has. It is not expected to reach 95%.

### Scoring changes, so the numbers compare fairly

- A page where the name did not fit on the paper no longer counts as a miss. This was a bug in version 2 and it lowered the version 2 practice-page numbers.
- One cover over a two-word name counts as right. Before, a cover was checked against each word of the name on its own.
- The GNHK test pages and Danish scans in the any-word test have now been scored three times (twice before version 3).

## Version 2 results (4 Nov 2026, morning, reader trained for 16,000 steps)

How it was scored: each test page gets a made-up roster of 25 names, one of which is a real handwritten word from that page standing in for the student's name. A name counts as covered when covers hide at least half of the word. A wrong cover is a cover on anything that is not a roster name. The cut-off score was chosen on held-back pages only (every 13th GNHK training page) for a target number of wrong covers per page, then used unchanged on the test pages. Each test set was scored once with the final reader.

Real English handwriting, GNHK test split (172 pages, adults' notes photographed with phones), true word boxes given, so only the reading is tested:

| Method | Size | Names covered (wrong covers per page) | Right name ranked first |
|---|---|---|---|
| A. Hand-set word shapes | no weights | 1.5% (0.20), 2.5% (0.87) | 43% |
| B. Reader trained from zero | 0.5 MB | 75.9% (0.23), 79.5% (0.42), 82.3% (0.60), 84.0% (1.08) | 90% |
| Reference only: Microsoft TrOCR small, read as text then compared letter by letter (58 of the pages) | about 250 MB | 62.7% (0.11), 67.2% (0.31), 69.6% (0.75) | 87% |

On the same 58 pages the trained reader covers 76.5% (0.20), 77.9% (0.36) and 80.9% (0.56). TrOCR is not usable here in any case: it is far too big and it was fine-tuned on IAM, which is research-only.

Whole pages, words found by `find_names.py` (nothing given away). A stand-in word counts as covered when at least 70% of its ink is under covers (`metrics_pages.py`, `HW_INK`), because GNHK's word outlines are loose; a word written with punctuation attached ("Bonds:") counts as the word; and covers are narrowed to the matched part of a box, as `find_names.find` does in the app. Cut-offs from the held-back pages for 0.1, 0.25, 0.5 and 1 wrong covers per page:

| Test | Names covered (wrong covers per page) |
|---|---|
| GNHK test, 172 pages | 58.0% (0.06), 64.9% (0.18), 68.8% (0.47), 74.5% (1.04) |
| Danish scans, 223 pages, a language the reader never saw | 59.8% (0.03), 66.3% (0.06), 73.4% (0.15), 78.3% (0.24) |

Practice pages in the 31 held-out fonts (`final200.pkl`, 200 pages, roster of 50 name words), with the Name label rule and the full-name rule (`pair=0.8`, picked on `test200.pkl`):

| Cut-off (from the GNHK held-back pages) | Whole student name covered | With a printed Name label | Top line of lined paper | Corner | Signed at the end | Classmates' names | Wrong covers per page |
|---|---|---|---|---|---|---|---|
| -0.914 | 79.5% | 98.7% | 68.2% | 56.2% | 74.5% | 84.6% | 0.07 |
| -1.174 | 82.0% | 100% | 68.2% | 62.5% | 78.7% | 88.6% | 0.09 |
| -1.462 | 83.0% | 100% | 70.5% | 65.6% | 78.7% | 92.7% | 0.19 |

Chinese names written in Chinese characters (`make_pages_zh.py`, 100 pages, four open Chinese handwriting fonts, the roster holding the student's English name): the reader only knows Latin letters, so these are covered only by the Name label rule. With a printed Name label the name was covered on 93% of pages; on lined paper with no label, on almost none. Pages that also carried lines of Chinese writing had 0.09 to 0.13 wrong covers per page at the -0.914 cut-off and 0.16 to 0.5 at -1.174.

How this version came about. The first scoring run (same reader, `KX` 0.6, no slanted-line search, the old page scoring) gave GNHK 42.6% (0.05), 50.8% (0.11), 57.7% (0.34), 65.1% (1.01); Danish 47.0% (0.02), 58.7% (0.03), 67.3% (0.08), 77.8% (0.18); and on the practice pages a whole name 81.0% at 0.16 wrong covers per page. Then, choosing every change on the held-back GNHK pages and `test200.pkl` only:
- the page scoring was made to judge what the app would do (narrowed covers, punctuation, ink). With the old word finder that alone gives GNHK 55.8% (0.17) and 68.0% (1.09) at the 0.25 and 1.0 cut-offs;
- `find_names.py` joins letters up to 0.9 letter heights apart instead of 0.6 (`HW_KX`) and also removes ruled lines tilted up to 4 degrees (`HW_LINES=2`);
- the Name label rule stops at the next printed label (Class, Date and similar), which took most wrong covers off the worksheet pages.
The test pages were then scored a second time; the numbers above are that second look. `box_quality.py` measures word boxes against GNHK's own outlines without reading anything.

Speed of `hwreader.js` in Node on one core: about 35 ms for a short word, 125 ms for a 128-pixel-wide strip. Reading only the name spots (about 20 to 40 word boxes at the top of a page) takes 1 to 1.5 seconds a paper. The int8 file is 507,749 bytes; against the Python reader it picks the same top letter in every column of the check strip, and the likely letters' log-chances differ by at most 0.2.

Also: the first scoring run picked cut-offs on a coarse grid; `metrics_pages.py pick` now searches the held-back pages exactly.

## Data

None of the data is in the repo. All of it is downloaded into a work folder outside the repo.

| Source | License | Used for |
|---|---|---|
| [GNHK](https://github.com/GoodNotes/GNHK-dataset), GoodNotes Handwriting Kollection (Lee, Chung and Lee, ICDAR 2021), repackaged at `radhakrishnadeshpande/gnhk-pagelevel` on Hugging Face | CC BY 4.0 | Training (train split, minus every 13th page kept back for checking) and testing (test split) |
| [Modern Danish Handwriting](https://huggingface.co/datasets/RA-Data-Science/modern-danish-handwriting), Danish National Archives | CC BY 4.0 | Testing only: scanned pages written by festival volunteers |
| [German handwriting](https://huggingface.co/datasets/fhswf/german_handwriting), FH Südwestfalen (3 of 8 parts) | AFL 3.0 | Training only |
| Google Fonts, the 253 handwriting families with Latin letters | OFL (a few Apache 2.0) | Made-up practice images. 31 families are held back for scoring and never used in training (`hwlib.TEST_FAMILIES`). Four of them (Long Cang, Zhi Mang Xing, Ma Shan Zheng, Liu Jian Mao Cao) also write the Chinese names for the Chinese check |
| Word and name lists from the redaction work (`src/redact-words.txt`, `src/redact-names.txt` on the redaction branch) | SCOWL and Faker terms, see `src/redact-lists-LICENSE.txt` there | Made-up text and made-up rosters |
| [Microsoft TrOCR small, handwritten](https://huggingface.co/microsoft/trocr-small-handwritten) | none stated on the model page | Reference measurement only (`trocr_read.py`), never bundled or used by the method |

No student work is used anywhere, and every roster name in the tests is made up.

## Rerunning

```
python3 -m venv venv && venv/bin/pip install -r requirements.txt
export HW_WORK=/some/folder/outside/the/repo
venv/bin/python -I get_fonts.py $HW_WORK/data/fontmeta/metadata.json $HW_WORK/fonts
venv/bin/python -I prep_gnhk.py <gnhk test parquet> $HW_WORK/data/prep/gnhk_test.pkl      # and the train parquets -> gnhk_train.pkl
venv/bin/python -I prep_lines.py german $HW_WORK/data/prep/german.pkl <parquets>
venv/bin/python -I prep_lines.py danish $HW_WORK/data/prep/danish.pkl <parquet>
venv/bin/python -I gen_synth.py $HW_WORK/fonts $HW_WORK/data/lists 300000 11 $HW_WORK/data/synth/train300k.pkl
venv/bin/python -I gen_synth.py $HW_WORK/fonts $HW_WORK/data/lists 120000 12 $HW_WORK/data/synth/train120k_b.pkl
RUN=reader1 venv/bin/python -I train.py $HW_WORK 16000 3                                   # about 2 hours on 4 CPU cores
venv/bin/python -I eval_words.py b test out.json $HW_WORK/runs/reader1/best.pt              # or "a" for the hand-set matcher
venv/bin/python -I metrics.py val.json test.json norm
venv/bin/python -I make_pages.py 200 101 $HW_WORK/data/pages/test200.pkl
venv/bin/python -I eval_pages.py synth $HW_WORK/data/pages/test200.pkl $HW_WORK/runs/reader1/best.pt out.json
sh run_final.sh $HW_WORK/runs/reader1/best.pt $HW_WORK/runs/final              # every test above, once
venv/bin/python -I make_pages_zh.py 100 404 $HW_WORK/data/pages/zh100.pkl
venv/bin/python -I export.py $HW_WORK/runs/reader1/best.pt reader.bin check.json && node js_check.js reader.bin check.json
# version 3
venv/bin/python -I make_name_pages.py val 72 $HW_WORK/data/pages/names_val4.pkl 4      # held-back pages, for choosing rules
venv/bin/python -I make_name_pages.py test 91 $HW_WORK/data/pages/names_test.pkl 2
venv/bin/python -I make_scan_pages.py val 717 $HW_WORK/data/pages/scan_val.pkl 3
venv/bin/python -I make_scan_pages.py test 919 $HW_WORK/data/pages/scan_test.pkl 2
venv/bin/python -I make_pages.py 200 303 $HW_WORK/data/pages/fresh200.pkl
venv/bin/python -I make_pages_zh.py 60 606 $HW_WORK/data/pages/zh_dev60.pkl
venv/bin/python -I make_pages_zh.py 100 505 $HW_WORK/data/pages/zh_fresh100.pkl
RUN=reader1b INIT=$HW_WORK/runs/reader1/final.pt PEAK=8e-4 AUG2=1 venv/bin/python -I train.py $HW_WORK 16000 2
sh run_final3.sh $HW_WORK/runs/reader1/final.pt $HW_WORK/runs/final3                  # every version 3 test, once
```

`trocr_read.py` and `trocr_score.py` measure the ready-made reference reader on the same words; they are not part of the method.

`reader.bin` is the trained reader from the run above (int8 weights, 0.5 MB), written by `export.py`. It was trained on the CC BY 4.0 and AFL 3.0 data and OFL fonts listed above, so those credits go with it. `hwreader.js` is the reader in plain JavaScript (no libraries). `js_check.js` compares it with the Python reader and times it.
