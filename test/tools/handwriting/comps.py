# The ink blobs on each page, for finishing covers (metrics_names.py, HW_COMPS): the cleaned-up ink is thickened a
# little so that a word broken into dots and dashes (a black-and-white scan, pencil) becomes one blob, and each blob's
# outline is kept. No reading is done here.
# Usage: python -I comps.py <pages.pkl | gnhk:val | gnhk:test> <out.json>
import sys, os, json, pickle
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import find_names

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, outp = sys.argv[1:3]
THICK = float(os.environ.get('HW_THICK', '0.12'))    # thickening, in line heights

def blobs(gray):
    boxes, hmed = find_names.word_boxes(gray)
    if not boxes: return dict(lh=0, comps=[])
    lh = find_names._line_height(boxes, hmed)
    bw = find_names.binarize(gray).astype(np.uint8)
    r = max(1, int(round(THICK * lh)))
    big = cv2.dilate(bw, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(big, 8)
    comps = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 4 * r * r: continue
        comps.append([int(x + r), int(y + r), int(x + w - 1 - r), int(y + h - 1 - r)])   # back to the ink's own outline
    return dict(lh=round(float(lh), 2), comps=comps)

out = {}
if src.startswith('gnhk:'):
    split = src.split(':')[1]
    pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_test.pkl' if split == 'test' else 'data/prep/gnhk_train.pkl'), 'rb'))
    if split != 'test': pages = pages[::13]
    for p in pages: out[p['file']] = blobs(p['page'])
else:
    for p in pickle.load(open(src, 'rb')): out[str(p['id'])] = blobs(p['page'])
json.dump(out, open(outp, 'w'))
print(len(out), 'pages')
