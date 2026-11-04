# Roster test on real handwriting with the true word boxes.
# For each page, one handwritten word stands in for the student's name; the roster is that word plus 24 made-up names.
# Every handwritten word on the page is then scored against the roster: the stand-in should be found, nothing else should.
# Usage: python -I eval_words.py <method a|b> <split val|test> <out.json> [model.pt] [trials_per_page]
import sys, os, re, json, pickle, random, time, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
method, split, outp = sys.argv[1], sys.argv[2], sys.argv[3]
model_path = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None
per_page = int(sys.argv[5]) if len(sys.argv) > 5 else 3
SPECIAL = ('%SC%', '%NA%', '%math%')
STOP = set('''the and for that this with you your are was were have has had not but all any can our out one two who his her him she they them their there then than what when where which will would could should from into onto upon also just like very more most some such only over under about after before again here these those been being does did done each other same both few many much own off how why too its it's let lets may might must shall yes now new old get got way day use used''' .split())

if split == 'test':
    pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_test.pkl'), 'rb'))
else:
    allp = pickle.load(open(os.path.join(W, 'data/prep/gnhk_train.pkl'), 'rb'))
    pages = allp[::13]            # the same pages train.py kept back
    del allp

allwords = [w.strip() for w in open(os.path.join(W, 'data/lists/words.txt')) if w.strip() and "'" not in w]
common = set(allwords)
words_common = [w for w in allwords if 4 <= len(w) <= 8]
random.Random(3).shuffle(words_common)
pool_rng = random.Random(7)
names = [hwlib.fold(n.strip()) for n in open(os.path.join(W, 'data/lists/names.txt'))]
names = [n for n in names if re.fullmatch(r'[a-z]{3,10}', n) and n not in common]
pool_rng.shuffle(names)
POOL = names[:300]

rng = random.Random(11)
trials = []   # (page index, target, roster)
for pi, p in enumerate(pages):
    hw = [w for w in p['words'] if w['type'] == 'H' and w['crop'] is not None]
    texts = set(hwlib.fold(w['text']) for w in hw)
    cands = sorted(set(hwlib.fold(w['text']) for w in hw if re.fullmatch(r'[A-Za-z]{3,}', w['text']) and hwlib.fold(w['text']) not in STOP))
    rng.shuffle(cands)
    for t in cands[:per_page]:
        others = [n for n in POOL if n not in texts]
        trials.append((pi, t, [t] + rng.sample(others, 24)))
print(len(pages), 'pages', len(trials), 'trials', flush=True)

t0 = time.time()
if method == 'b':
    from reader import Reader, spot, label, LETTER
    R = Reader(model_path, threads=int(os.environ.get("THREADS", "1")))
    page_lp = {}
    def page_scores(pi, roster):
        if pi not in page_lp:
            hw = [w for w in pages[pi]['words'] if w['type'] == 'H' and w['crop'] is not None]
            page_lp[pi] = (hw, R.logprobs([w['crop'] for w in hw]))
        hw, lps = page_lp[pi]
        labs = [label(r) for r in roster]
        M = np.array([[spot(lp, lb, LETTER)[0] for lb in labs] for lp in lps])
        norm = np.array([len(r) for r in roster], np.float64)
        return hw, M, norm
else:
    import shape
    train_fonts, _ = hwlib.font_split(os.path.join(W, 'fonts'))
    pick = ['Caveat', 'Patrick_Hand', 'Architects_Daughter', 'Annie_Use_Your_Telescope', 'Covered_By_Your_Grace', 'Handlee',
            'Neucha', 'Gochi_Hand', 'Short_Stack', 'Waiting_for_the_Sunrise', 'Loved_by_the_King', 'Nanum_Pen_Script']
    fonts = [f for f in train_fonts if os.path.basename(f)[:-4] in pick]
    SM = shape.ShapeMatcher(fonts, words_common[:60])
    feats = {}
    dcache = {}
    def page_scores(pi, roster):
        hw = [w for w in pages[pi]['words'] if w['type'] == 'H' and w['crop'] is not None]
        if pi not in feats:
            fs = [shape.features(w['crop']) for w in hw]
            coh = [SM.cohort_dist(f) if f is not None else 1e9 for f in fs]
            feats[pi] = (fs, coh)
        fs, coh = feats[pi]
        M = np.full((len(hw), len(roster)), -1e9)
        for i, f in enumerate(fs):
            if f is None: continue
            for j, r in enumerate(roster):
                k = (pi, i, r)
                if k not in dcache: dcache[k] = SM.name_dist(f, r)
                M[i, j] = (coh[i] if os.environ.get('SCORE', 'coh') == 'coh' else 0.0) - dcache[k]
            if os.environ.get('SCORE') == 'z':
                v = M[i]; M[i] = (v - v.mean()) / (v.std() + 1e-6)
        return hw, M, np.ones(len(roster))

out = []
for k, (pi, target, roster) in enumerate(trials):
    hw, M, norm = page_scores(pi, roster)
    rows = []
    for i, w in enumerate(hw):
        ft = hwlib.fold(w['text'])
        rows.append(dict(t=int(ft == target), s=[float(v) for v in M[i]], txt=ft))
    out.append(dict(page=pages[pi]['file'], target=target, roster=roster, norm=[float(v) for v in norm], rows=rows))
    if (k + 1) % 50 == 0: print(k + 1, 'trials', '%.0fs' % (time.time() - t0), flush=True)
json.dump(out, open(outp, 'w'))
print('done', '%.0fs' % (time.time() - t0))
