# Pre-generate made-up training images from the TRAINING fonts only.
# Usage: python -I gen_synth.py <fonts_dir> <lists_dir> <n> <seed> <out.pkl> [test]
import sys, os, time, pickle, numpy as np, cv2
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib
from fontTools.ttLib import TTFont

def cmap_of(p):
    try: return set(chr(c) for c in (TTFont(p, lazy=True).getBestCmap() or {}))
    except Exception: return set()

def work(args):
    cv2.setNumThreads(1)
    fonts_dir, lists, n, seed, use_test = args
    train, test = hwlib.font_split(fonts_dir)
    fonts = test if use_test else train
    cm = [cmap_of(p) for p in fonts]
    w8 = np.array(hwlib.font_weights(fonts)); w8 /= w8.sum()
    ts = hwlib.TextSource(os.path.join(lists, 'words.txt'), os.path.join(lists, 'names.txt'), seed=seed)
    rng = np.random.default_rng(seed)
    out = []; prev = None
    while len(out) < n:
        t = ts.sample()
        fi = rng.choice(len(fonts), p=w8)
        if any(ch not in cm[fi] for ch in t if ch != ' '): continue
        try:
            img = hwlib.synth_sample(t, fonts[fi], rng, prev)
            if rng.random() < 0.5: prev = hwlib.render_ink(ts.word(), fonts[fi], rng)
        except Exception as e:
            continue
        if img is None: continue
        x = hwlib.to_model(img)
        out.append((np.round(x * 255).astype(np.uint8), t, os.path.basename(fonts[fi])[:-4]))
    return out

if __name__ == '__main__':
    fonts_dir, lists, n, seed, outp = sys.argv[1:6]
    use_test = len(sys.argv) > 6 and sys.argv[6] == 'test'
    n = int(n); seed = int(seed); k = 4
    t0 = time.time()
    with Pool(k) as pool:
        parts = pool.map(work, [(fonts_dir, lists, (n + k - 1) // k, seed * 100 + i, use_test) for i in range(k)])
    data = [x for p in parts for x in p][:n]
    pickle.dump(data, open(outp, 'wb'), protocol=4)
    ws = [d[0].shape[1] for d in data]
    print('made', len(data), 'in %.0fs' % (time.time() - t0), 'mean width', int(np.mean(ws)), 'max', max(ws))
