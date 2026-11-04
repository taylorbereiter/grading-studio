#!/bin/sh
# Version 3 scoring: the known-student search. Every cut-off is picked on held-back pages first, then each fresh test is
# scored once with those cut-offs unchanged.
# Usage: sh run_final3.sh <model.pt> <out folder>      (HW_WORK must point at the work folder)
set -e
M=$1; O=$2; C=$(dirname "$0"); PY=${PY:-python3}; D="$HW_WORK/data/pages"
mkdir -p "$O"
export THREADS=${THREADS:-4}

# 1. Cut-offs from held-back pages only (GNHK training pages kept out of training, every 13th).
$PY -I "$C/eval_names.py" "$D/names_val4.pkl" "$M" "$O/dev_names_val4.json"
R=$($PY -I "$C/pick_roster.py" 0.25 "$O/dev_names_val4.json" | cut -d' ' -f1)
echo "class roster cut-off (<= 0.25 wrong covers a page, 50-word roster): $R" | tee "$O/cutoffs.txt"
$PY -I "$C/eval_pages.py" gnhk val "$M" "$O/dev_pages_gnhk_val.json"
G1=$($PY -I "$C/metrics_pages.py" gnhk "$O/dev_pages_gnhk_val.json" pick0.25 | head -1 | awk '{print $NF}')
G2=$($PY -I "$C/metrics_pages.py" gnhk "$O/dev_pages_gnhk_val.json" pick1.0 | head -1 | awk '{print $NF}')
echo "any-word test cut-offs (25-word roster): $G1 (<= 0.25 wrong a page), $G2 (<= 1.0)" | tee -a "$O/cutoffs.txt"

# 2. Fresh tests, each scored once.
$PY -I "$C/eval_names.py" "$D/names_test.pkl" "$M" "$O/names_test.json"
$PY -I "$C/eval_names.py" "$D/fresh200.pkl" "$M" "$O/fresh200.json"
$PY -I "$C/eval_names.py" "$D/zh_fresh100.pkl" "$M" "$O/zh_fresh100.json"
$PY -I "$C/eval_names.py" "$D/scan_test.pkl" "$M" "$O/scan_test.json"
$PY -I "$C/eval_inplace.py" test "$M" "$O/inplace_test.json"
# ink blobs for finishing the covers (whole words, whole strokes, one bar on the Name line)
for t in names_test scan_test fresh200 zh_fresh100; do $PY -I "$C/comps.py" "$D/$t.pkl" "$O/comps_$t.json"; done
$PY -I "$C/comps.py" gnhk:test "$O/comps_inplace_test.json"
for t in names_test scan_test fresh200 zh_fresh100 inplace_test; do
  echo "== $t" | tee -a "$O/results.txt"
  HW_COMPS="$O/comps_$t.json" $PY -I "$C/metrics_names.py" "$O/$t.json" "$R" final | grep -E "pages|roster|FINAL" | tee -a "$O/results.txt"
done

# 3. The general any-word search on whole pages (these GNHK test pages and Danish scans were scored before: 3rd use).
$PY -I "$C/eval_pages.py" gnhk test "$M" "$O/pages_gnhk_test.json"
$PY -I "$C/eval_pages.py" danish - "$M" "$O/pages_danish.json"
for k in gnhk danish; do
  f="$O/pages_${k}_test.json"; [ "$k" = danish ] && f="$O/pages_danish.json"
  echo "== any word, $k" | tee -a "$O/results.txt"
  $PY -I "$C/metrics_pages.py" $k "$f" "$G1" | tee -a "$O/results.txt"
  $PY -I "$C/metrics_pages.py" $k "$f" "$G2" | tee -a "$O/results.txt"
done
echo done
