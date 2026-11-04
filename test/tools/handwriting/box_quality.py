# How well the page part boxes words, against GNHK's own word boxes. No reading involved.
# good = the word has a box of its own (clean) or sits inside a box with its neighbours on the same line (wide);
# bad = the word is cut, joined with another line, partly boxed or missed.
# Usage: python -I box_quality.py <train|val> [n_pages]
import sys, os, re, pickle
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import find_names
cv2.setNumThreads(1)
W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
allp = pickle.load(open(os.path.join(W, 'data/prep/gnhk_train.pkl'), 'rb'))
which = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else 100
pages = allp[::13] if which == 'val' else [p for i, p in enumerate(allp) if i % 13][::4][:n]
def ov(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1]); x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    return max(0, x1 - x0 + 1) * max(0, y1 - y0 + 1)
def ar(a): return max(1, (a[2] - a[0] + 1) * (a[3] - a[1] + 1))
cnt = dict(clean=0, wide=0, tall=0, split=0, partial=0, missed=0); nb = 0
for p in pages:
    boxes, h = find_names.word_boxes(p['page']); nb += len(boxes)
    for w in p['words']:
        if w['type'] != 'H' or not re.fullmatch(r'[A-Za-z]{3,}', w['text']): continue
        q = np.array(w['quad'], np.float32) * p['scale']
        g = [int(q[:, 0].min()), int(q[:, 1].min()), int(q[:, 0].max()), int(q[:, 1].max())]
        hits = [(ov(g, b), b) for b in boxes if ov(g, b) > 0.1 * ar(g)]
        if not hits: cnt['missed'] += 1; continue
        o, b = max(hits, key=lambda t: t[0])
        iou = o / (ar(g) + ar(b) - o)
        if iou >= 0.5: cnt['clean'] += 1
        elif o >= 0.7 * ar(g):
            cnt['tall' if (b[3] - b[1]) > 1.6 * (g[3] - g[1]) else 'wide'] += 1
        elif o < 0.5 * ar(g) and sum(t[0] for t in hits) >= 0.6 * ar(g): cnt['split'] += 1
        else: cnt['partial'] += 1
tot = sum(cnt.values())
print('KX=%s KY=%s' % (os.environ.get('HW_KX', '0.6'), os.environ.get('HW_KY', '0.15')), '%d pages, %d words, %.0f boxes/page:' % (len(pages), tot, nb / len(pages)),
      ' '.join('%s %.1f%%' % (k, 100 * v / tot) for k, v in cnt.items()), '| good %.1f%%' % (100 * (cnt['clean'] + cnt['wide']) / tot))
