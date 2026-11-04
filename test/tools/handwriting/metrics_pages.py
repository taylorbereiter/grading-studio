# Numbers for the whole-page tests at a given threshold.
# Usage: python -I metrics_pages.py <kind> <result.json> <thr> [spots]
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from collections import defaultdict

def overlap(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1]); x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    return max(0, x1 - x0 + 1) * max(0, y1 - y0 + 1)
def area(a): return max(1, (a[2] - a[0] + 1) * (a[3] - a[1] + 1))
def covered(g, cs): return sum(overlap(g, c['box']) for c in cs) >= 0.5 * area(g)

INK = float(os.environ.get('HW_INK', '0.7'))
def ink_covered(pts, cs):
    # GNHK's word outlines are loose, so judge on the word's own ink: at least INK of it under covers
    if not cs: return False
    p = np.array(pts); inside = np.zeros(len(p), bool)
    for c in cs:
        b = c['box']; inside |= (p[:, 0] >= b[0]) & (p[:, 0] <= b[2]) & (p[:, 1] >= b[1]) & (p[:, 1] <= b[3])
    return inside.mean() >= INK

RCONF = float(os.environ.get('HW_RCONF', '-0.5'))   # how sure the reader must be of its own reading under a roster cover

def gnhk(res, thr):
    hit = tot = fc = 0
    for t in res:
        cs = [c for c in t['covers'] if c['score'] >= thr and c.get('conf', 0) >= RCONF]
        for g in t['gt']:
            tot += 1
            hit += ink_covered(g['ink'], cs) if len(g.get('ink', [])) >= 10 else covered(g['box'], cs)
        for c in cs:
            if all(overlap(c['box'], g['box']) < 0.3 * area(c['box']) for g in t['gt']): fc += 1
    return hit / max(tot, 1), fc / max(len(res), 1), len(res), tot

def danish(res, thr):
    hit = tot = fc = 0
    for t in res:
        cs = [c for c in t['covers'] if c['score'] >= thr and c.get('conf', 0) >= RCONF]
        def inside(c, L):
            cx, cy = (c['box'][0] + c['box'][2]) / 2, (c['box'][1] + c['box'][3]) / 2
            return L[0] <= cx <= L[2] and L[1] <= cy <= L[3]
        good = [c for c in cs if c['name'] == t['target'] and any(inside(c, L) for L in t['lines'])]
        lines_hit = sum(1 for L in t['lines'] if any(inside(c, L) for c in good))
        tot += t['n_inst']; hit += min(lines_hit, t['n_inst'])
        fc += len(cs) - len(good)
    return hit / max(tot, 1), fc / max(len(res), 1), len(res), tot

def synth(res, thr, use_spots, relax=None):
    import find_names
    own_w = own_wc = pages_full = mates = mates_c = fc = 0
    by = defaultdict(lambda: [0, 0, 0])
    for p in res:
        cs = [c for c in p['covers'] if c['score'] >= thr] + (p['spots'] if use_spots else [])
        if relax is not None:
            cs += find_names.pair_covers(p['reads'], p['pairs'], p['roster'], thr, relax)
        own = [g for g in p['gt'] if g['kind'] == 'own']
        mt = [g for g in p['gt'] if g['kind'] == 'mate']
        oc = [covered(g['box'], cs) for g in own]
        own_w += len(own); own_wc += sum(oc)
        full = bool(own) and all(oc)
        pages_full += full
        mates += len(mt); mates_c += sum(covered(g['box'], cs) for g in mt)
        names = own + mt
        f = sum(1 for c in cs if all(overlap(c['box'], g['box']) < 0.3 * area(c['box']) for g in names))
        fc += f
        b = by[p['layout']]; b[0] += 1; b[1] += full; b[2] += f
    n = len(res)
    return dict(pages=n, own_words=own_wc / max(own_w, 1), whole_name=pages_full / max(n, 1), mates=mates_c / max(mates, 1), mates_n=mates,
                false_per_page=fc / max(n, 1), by_layout={k: (v[0], round(v[1] / v[0], 3), round(v[2] / v[0], 2)) for k, v in by.items()})

def pick(res, kind, fc_target):
    # lowest threshold with wrong covers per page <= target. Wrong covers only grow as the threshold drops,
    # so a binary search over every score that occurs finds it exactly.
    f = gnhk if kind == 'gnhk' else danish
    scores = sorted(set(c['score'] for t in res for c in t['covers']), reverse=True)
    lo, hi = 0, len(scores) - 1          # scores[lo] passes (or nothing does), find the last index that passes
    if f(res, scores[0])[1] > fc_target: return scores[0] + 1e-6
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if f(res, scores[mid])[1] <= fc_target: lo = mid
        else: hi = mid - 1
    return scores[lo]

if __name__ == '__main__':
    kind, path = sys.argv[1], sys.argv[2]
    res = json.load(open(path))
    if sys.argv[3].startswith('pick'):
        fc = float(sys.argv[3][4:])
        thr = pick(res, kind, fc)
        print('threshold for <= %.2f wrong covers/page: %.4f' % (fc, thr))
    else:
        thr = float(sys.argv[3])
    if kind == 'synth':
        opts = sys.argv[4:]
        relax = next((float(o[5:]) for o in opts if o.startswith('pair=')), None)
        print(json.dumps(synth(res, thr, 'spots' in opts, relax), indent=1))
    else:
        h, f, n, tot = (gnhk if kind == 'gnhk' else danish)(res, thr)
        print('%s at %.4f: covered %.1f%% of %d stand-in words, %.2f wrong covers per page (%d trials)' % (kind, thr, 100 * h, tot, f, n))
