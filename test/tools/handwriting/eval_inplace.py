# The known-student search on real handwriting left exactly where it was written: no pasting. On each GNHK page, two
# neighbouring words on one of the first two lines stand in for a first + last name ("top"), and two on one of the last
# two lines for a signed name ("end"). The search is told those two words, as the app would be told the student's name,
# and must cover both (70% of their ink) without covering other writing. Scored with metrics_names.py.
# Usage: python -I eval_inplace.py <val|test> <model.pt> <out.json>
import sys, os, re, json, pickle, random, time
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib, find_names
from reader import Reader

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
split, model_path, outp = sys.argv[1:4]
R = Reader(model_path, threads=int(os.environ.get('THREADS', '1')))
pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_test.pkl' if split == 'test' else 'data/prep/gnhk_train.pkl'), 'rb'))
if split != 'test': pages = pages[::13]
STOP = set('the and for that this with you your are was were have has had not but all any can our out one two who his her him she they them their there then than what when where which will would could should from into onto upon also just like very more most some such only over under about after before again here these those been being does did done each other same both few many much own off how why too its let lets may might must shall yes now new old get got way day use used'.split())

def ok(w, count):
    return w['type'] == 'H' and re.fullmatch(r'[A-Za-z]{3,12}', w['text']) and count[hwlib.fold(w['text'])] == 1

out = []; t0 = time.time()
for p in pages:
    gray = p['page']
    count = {}
    for w in p['words']: count[hwlib.fold(w['text'])] = count.get(hwlib.fold(w['text']), 0) + 1
    words = {w['i']: w for w in p['words']}
    # lines from top to bottom by the middle of their words
    lines = []
    for L in p['lines']:
        ws = [words[i] for i in L['words']]
        cy = np.mean([np.mean(np.array(w['quad'])[:, 1]) for w in ws])
        lines.append((cy, ws))
    lines.sort(key=lambda t: t[0])
    trials = []
    for where, cand in (('top', lines[:2]), ('end', lines[-2:][::-1])):
        for cy, ws in cand:
            pair = next(((a, b) for a, b in zip(ws, ws[1:]) if ok(a, count) and ok(b, count)), None)
            if pair: trials.append((where, pair)); break
    if not trials: continue
    boxes, hmed = find_names.word_boxes(gray)
    if not boxes: continue
    lps = R.logprobs([find_names.crop(gray, b, hmed) for b in boxes])
    bw = find_names.binarize(gray)
    for where, (a, b) in trials:
        gt = []
        for w in (a, b):
            q = np.array(w['quad'], np.float32) * p['scale']
            m = np.zeros(bw.shape, np.uint8); cv2.fillPoly(m, [q.astype(np.int32)], 1)
            ys, xs = np.nonzero(bw & (m > 0))
            k = max(1, len(xs) // 400)
            gt.append(dict(text=hwlib.fold(w['text']), kind='own', box=[int(q[:, 0].min()), int(q[:, 1].min()), int(q[:, 0].max()), int(q[:, 1].max())],
                           ink=[[int(x), int(y)] for x, y in zip(xs[::k], ys[::k])]))
        if any(len(g['ink']) < 10 for g in gt): continue
        parts = [g['text'] for g in gt]
        o2 = find_names.own_name(gray, boxes, lps, hmed, parts, R, bw=bw)
        own2 = dict(full=[[round(float(s), 4), round(c, 3), [list(map(int, x)) for x in bs], z] for s, c, bs, z in o2['full']],
                    part=[[[round(float(s), 4), round(c, 3), list(map(int, x)), z] for s, c, x, z in lst] for lst in o2['part']],
                    initial=[])
        out.append(dict(id=len(out), page_file=p['file'], layout=where, H=int(gray.shape[0]), hmed=float(hmed), roster=parts, gt=gt, page_conf=round(float(np.median([lp.max(-1).mean() for lp in lps])), 3),
                        roster_covers=[], spots=[], reads=[dict(box=x) for x in boxes], own2=own2))
    if len(out) % 20 == 0: print(len(out), 'trials %.0fs' % (time.time() - t0), flush=True)
json.dump(out, open(outp, 'w'))
print('done', len(out), 'trials on', len(pages), 'pages %.0fs' % (time.time() - t0))
