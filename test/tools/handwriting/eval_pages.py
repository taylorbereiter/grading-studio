# Whole-page test: find the words on the page automatically, read them, box roster names. Nothing is given away:
# the word boxes come from the page finder, not from the dataset.
# Usage: python -I eval_pages.py <synth|gnhk|danish> <pages.pkl or split> <model.pt> <out.json>
import sys, os, re, json, pickle, random, time
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib, find_names
from reader import Reader, spot, spot_any, label, LETTER

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kind, src, model_path, outp = sys.argv[1:5]
R = Reader(model_path, threads=int(os.environ.get("THREADS", "1")))
allwords = [w.strip() for w in open(os.path.join(W, 'data/lists/words.txt')) if w.strip() and "'" not in w]
common = set(allwords)
names = [hwlib.fold(n.strip()) for n in open(os.path.join(W, 'data/lists/names.txt'))]
names = [n for n in names if re.fullmatch(r'[a-z]{3,10}', n) and n not in common]
random.Random(7).shuffle(names)
POOL = names[:300]
STOP = set('''the and for that this with you your are was were have has had not but all any can our out one two who his her him she they them their there then than what when where which will would could should from into onto upon also just like very more most some such only over under about after before again here these those been being does did done each other same both few many much own off how why too its let lets may might must shall yes now new old get got way day use used''' .split())
rng = random.Random(11)

def overlap(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1]); x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    return max(0, x1 - x0 + 1) * max(0, y1 - y0 + 1)
def area(a): return max(1, (a[2] - a[0] + 1) * (a[3] - a[1] + 1))

def score_boxes(gray, roster):
    """All candidate covers with their scores (threshold applied later), plus the 'Name:' label rule covers."""
    covers, reads = find_names.find(gray, roster, R, thr=-1e9, spot_rule=True)
    roster_c = [c for c in covers if c['why'] == 'roster']
    spot_c = [c for c in covers if c['why'] == 'name spot']
    return roster_c, spot_c, reads

out = []
t0 = time.time()
if kind == 'synth':
    pages = pickle.load(open(src, 'rb'))
    first_pool = names[300:2300]; last_pool = names[2300:4300]
    for p in pages:
        F, L = hwlib.fold(p['student'][0]), hwlib.fold(p['student'][1])
        roster = [F, L] + [hwlib.fold(x) for m in p['mates'] for x in m]
        others = []
        while len(others) < 44:
            others += [rng.choice(first_pool), rng.choice(last_pool)]
        roster += others
        rc, sc, reads = score_boxes(p['page'], roster)
        gt = [dict(text=hwlib.fold(w['text']), box=w['box'], kind=w['kind']) for w in p['words']]
        pairs = [(i, i + 1) for i in range(0, len(roster), 2)]
        out.append(dict(id=p['id'], layout=p['layout'], font=p['font'], roster=roster, pairs=pairs, gt=gt, covers=rc, spots=sc,
                        reads=[dict(box=r['box'], scores=r['scores']) for r in reads]))
        if len(out) % 20 == 0: print(len(out), 'pages %.0fs' % (time.time() - t0), flush=True)
elif kind == 'gnhk':
    if src == 'test':
        pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_test.pkl'), 'rb'))
    else:
        pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_train.pkl'), 'rb'))[::13]
    for p in pages:
        hw = [w for w in p['words'] if w['type'] == 'H']
        texts = set(hwlib.fold(w['text']) for w in hw)
        cands = sorted(set(hwlib.fold(w['text']) for w in hw if re.fullmatch(r'[A-Za-z]{3,}', w['text']) and hwlib.fold(w['text']) not in STOP))
        rng.shuffle(cands)
        if not cands: continue
        boxes, hmed = find_names.word_boxes(p['page'])
        if not boxes: continue
        lps = R.logprobs([find_names.crop(p['page'], b, hmed) for b in boxes])
        bw = find_names.binarize(p['page'])
        gtb = []
        for w in p['words']:
            q = np.array(w['quad'], np.float32) * p['scale']
            t = re.sub(r'^[^a-z0-9]+|[^a-z0-9]+$', '', hwlib.fold(w['text']))
            g = dict(text=t, box=[int(q[:, 0].min()), int(q[:, 1].min()), int(q[:, 0].max()), int(q[:, 1].max())])
            if t in cands[:3]:
                m = np.zeros(bw.shape, np.uint8); cv2.fillPoly(m, [q.astype(np.int32)], 1)
                ys, xs = np.nonzero(bw & (m > 0))
                k = max(1, len(xs) // 400)
                g['ink'] = [[int(x), int(y)] for x, y in zip(xs[::k], ys[::k])]
            gtb.append(g)
        for target in cands[:3]:
            roster = [target] + rng.sample([n for n in POOL if n not in texts], 24)
            labs = [label(r) for r in roster]
            cov = []
            for b, lp in zip(boxes, lps):
                res = [spot_any(lp, lb) for lb in labs]
                s = [r[0] / max(1, len(lb)) for r, lb in zip(res, labs)]
                j = int(np.argmax(s))
                seg = lp[max(0, res[j][1]):max(res[j][1] + 1, res[j][2] + 1)]
                cov.append(dict(box=find_names.narrow(b, lp, res[j][1], res[j][2], hmed), name=roster[j], score=float(s[j]),
                                conf=round(float(seg.max(-1).mean()) if len(seg) else -9.0, 3)))
            out.append(dict(page=p['file'], target=target, roster=roster, gt=[g for g in gtb if g['text'] == target], allgt=len(gtb), covers=cov))
        if len(out) % 30 < 3: print(len(out), 'trials %.0fs' % (time.time() - t0), flush=True)
else:   # danish scans: no word boxes, so a hit is a cover for the stand-in inside a line that has that word
    pages = pickle.load(open(os.path.join(W, 'data/prep/danish.pkl'), 'rb'))
    for p in pages:
        words = [hwlib.fold(w) for l in p['lines'] for w in re.findall(r"[^\s.,;:!?()\"'-]+", l['text'])]
        texts = set(words)
        cands = sorted(set(w for w in words if re.fullmatch(r'[a-z]{3,}', w) and w not in STOP))
        rng.shuffle(cands)
        if not cands: continue
        boxes, hmed = find_names.word_boxes(p['page'])
        if not boxes: continue
        lps = R.logprobs([find_names.crop(p['page'], b, hmed) for b in boxes])
        for target in cands[:3]:
            roster = [target] + rng.sample([n for n in POOL if n not in texts], 24)
            labs = [label(r) for r in roster]
            lines_with = [l['box'] for l in p['lines'] if target in [hwlib.fold(w) for w in re.findall(r"[^\s.,;:!?()\"'-]+", l['text'])]]
            cov = []
            for b, lp in zip(boxes, lps):
                res = [spot_any(lp, lb) for lb in labs]
                s = [r[0] / max(1, len(lb)) for r, lb in zip(res, labs)]
                j = int(np.argmax(s))
                seg = lp[max(0, res[j][1]):max(res[j][1] + 1, res[j][2] + 1)]
                cov.append(dict(box=find_names.narrow(b, lp, res[j][1], res[j][2], hmed), name=roster[j], score=float(s[j]),
                                conf=round(float(seg.max(-1).mean()) if len(seg) else -9.0, 3)))
            n_inst = sum(1 for l in p['lines'] for w in re.findall(r"[^\s.,;:!?()\"'-]+", l['text']) if hwlib.fold(w) == target)
            out.append(dict(page=p['file'], target=target, roster=roster, lines=lines_with, n_inst=n_inst, covers=cov))
        if len(out) % 30 < 3: print(len(out), 'trials %.0fs' % (time.time() - t0), flush=True)
json.dump(out, open(outp, 'w'), default=lambda o: o.item() if hasattr(o, 'item') else str(o))
print('done', len(out), '%.0fs' % (time.time() - t0))
