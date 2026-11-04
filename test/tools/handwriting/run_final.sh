#!/bin/sh
# One scoring pass of a finished reader on the untouched test sets. Thresholds are picked on the held-back
# GNHK pages (val) only, then applied unchanged to the tests.
# Usage: sh run_final.sh <model.pt> <out folder>      (HW_WORK must point at the work folder)
set -e
M=$1; O=$2; C=$(dirname "$0"); PY=${PY:-python3}
mkdir -p "$O"
export THREADS=${THREADS:-4}

# 1. True word boxes (GNHK): is the stand-in word found among all handwritten words on its page?
$PY -I "$C/eval_words.py" b val "$O/words_val.json" "$M"
$PY -I "$C/eval_words.py" b test "$O/words_test.json" "$M"
$PY -I "$C/metrics.py" "$O/words_val.json" "$O/words_test.json" norm | tee "$O/words.txt"

# 2. Whole pages: word boxes found by find_names.py, nothing given away.
$PY -I "$C/eval_pages.py" gnhk val "$M" "$O/pages_gnhk_val.json"
$PY -I "$C/eval_pages.py" gnhk test "$M" "$O/pages_gnhk_test.json"
$PY -I "$C/eval_pages.py" danish - "$M" "$O/pages_danish.json"
$PY -I "$C/eval_pages.py" synth "$HW_WORK/data/pages/test200.pkl" "$M" "$O/pages_test200.json"
$PY -I "$C/eval_pages.py" synth "$HW_WORK/data/pages/final200.pkl" "$M" "$O/pages_final200.json"
echo done
