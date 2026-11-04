# Handwritten name finder: experiment tools

This folder holds the experiment behind finding students' names in handwriting on scanned papers. Nothing here is part of the app yet. Grading Studio does not load any of it.

The idea is narrow on purpose. The app never has to read a whole essay. It only has to answer "is this handwritten word one of the 20 to 30 names on this class's roster?" and box the word if it is. A printed "Name:" label is a second clue: whatever is handwritten after it gets boxed, whatever it says.

Two ways of doing that were tried and scored on the same tests:

- **A. Hand-set word-shape matcher** (`shape.py`). Nothing is trained. A word picture is cleaned up, its slant taken out and its middle band found. It is then turned into a row of column measurements chosen by hand (ink above, in and below the middle band, the top and bottom outline, stroke directions). That row is compared with each roster name drawn in 12 handwriting fonts, using dynamic time warping.
- **B. A small reader trained from zero** (`model.py`, `train.py`). It is a convolutional network of about 500,000 weights, starting from random numbers, with nobody else's model inside. It reads a 32-pixel-high strip of handwriting into letter chances. A roster name is then matched against those chances (`reader.py`, `spot`), and a word only counts if nothing but gaps or marks surrounds the name. That way "Ava" is not found inside "Java".

`find_names.py` is the page part. It finds the handwritten words on a scan with plain image rules (no learning), reads each one, and boxes the matches, plus anything after a printed "Name" label.

## Results (4 Nov 2026, reader trained for 16,000 steps)

How it was scored: each test page gets a made-up roster of 25 names, one of which is a real handwritten word from that page standing in for the student's name. A name counts as covered when covers hide at least half of the word. A wrong cover is a cover on anything that is not a roster name. The cut-off score was chosen on held-back pages only (every 13th GNHK training page) for a target number of wrong covers per page, then used unchanged on the test pages. Each test set was scored once with the final reader.

Real English handwriting, GNHK test split (172 pages, adults' notes photographed with phones), true word boxes given, so only the reading is tested:

| Method | Size | Names covered (wrong covers per page) | Right name ranked first |
|---|---|---|---|
| A. Hand-set word shapes | no weights | 1.5% (0.20), 2.5% (0.87) | 43% |
| B. Reader trained from zero | 0.5 MB | 75.9% (0.23), 79.5% (0.42), 82.3% (0.60), 84.0% (1.08) | 90% |
| Reference only: Microsoft TrOCR small, read as text then compared letter by letter (58 of the pages) | about 250 MB | 62.7% (0.11), 67.2% (0.31), 69.6% (0.75) | 87% |

On the same 58 pages the trained reader covers 76.5% (0.20), 77.9% (0.36) and 80.9% (0.56). TrOCR is not usable here in any case: it is far too big and it was fine-tuned on IAM, which is research-only.

Whole pages, words found by `find_names.py` (nothing given away):

| Test | Names covered (wrong covers per page) |
|---|---|
| GNHK test, 172 pages | 42.6% (0.05), 50.8% (0.11), 57.7% (0.34), 65.1% (1.01) |
| Danish scans, 223 pages, a language the reader never saw | 47.0% (0.02), 58.7% (0.03), 67.3% (0.08), 77.8% (0.18) |

The gap between the two tables is the word finder: on the held-back pages only 66% of words get a clean box of their own (14% are merged with a neighbour, 5% split, 3% missed, the rest only partly boxed).

Practice pages in the 31 held-out fonts (`final200.pkl`, 200 pages, roster of 50 name words), with the Name label rule and the full-name rule (`pair=0.8`, picked on `test200.pkl`):

| Cut-off (from the GNHK held-back pages) | Whole student name covered | With a printed Name label | Top line of lined paper | Corner | Signed at the end | Classmates' names | Wrong covers per page |
|---|---|---|---|---|---|---|---|
| -0.709 | 77.0% | 96.1% | 63.6% | 56.2% | 72.3% | 75.6% | 0.13 |
| -1.025 | 81.0% | 97.4% | 65.9% | 62.5% | 80.9% | 80.5% | 0.16 |
| -1.429 | 83.5% | 100% | 68.2% | 65.6% | 83.0% | 87.8% | 0.30 |

Chinese names written in Chinese characters (`make_pages_zh.py`, 100 pages, four open Chinese handwriting fonts, the roster holding the student's English name): the reader only knows Latin letters, so these are covered only by the Name label rule. With a printed Name label the name was covered on 91% of pages; on lined paper with no label, on none. Pages that also carried lines of Chinese writing had 0 to 0.14 wrong covers per page at the -0.709 cut-off and 0.10 to 0.45 at -1.025.

Speed of `hwreader.js` in Node on one core: about 35 ms for a short word, 125 ms for a 128-pixel-wide strip. Reading only the name spots (about 20 to 40 word boxes at the top of a page) takes 1 to 1.5 seconds a paper. The int8 file is 507,749 bytes; against the Python reader it picks the same top letter in every column of the check strip, and the likely letters' log-chances differ by at most 0.2.

Note: the first scoring run picked cut-offs on a coarse grid; `metrics_pages.py pick` was then changed to an exact search on the held-back pages, and the tests were read again at the new cut-offs.

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
```

`trocr_read.py` and `trocr_score.py` measure the ready-made reference reader on the same words; they are not part of the method.

`reader.bin` is the trained reader from the run above (int8 weights, 0.5 MB), written by `export.py`. It was trained on the CC BY 4.0 and AFL 3.0 data and OFL fonts listed above, so those credits go with it. `hwreader.js` is the reader in plain JavaScript (no libraries). `js_check.js` compares it with the Python reader and times it.
