# The class-roster cut-off for the app: the lowest score at which roster covers on real handwriting stay within a budget
# of wrong covers per page, with a full class roster (about 50 name words). Picked on held-back pages only.
# Usage: python -I pick_roster.py <budget> <names.json> [more names.json ...]
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from metrics_pages import overlap, area
RCONF = float(os.environ.get('HW_RCONF', '-0.5'))
budget = float(sys.argv[1])
res = [p for f in sys.argv[2:] for p in json.load(open(f))]
def wrong(thr):
    fc = 0
    for p in res:
        names = [g for g in p['gt'] if g['kind'] in ('own', 'mate')]
        for c in p['roster_covers']:
            if c['score'] < thr or c.get('conf', 0) < RCONF: continue
            if sum(overlap(c['box'], g['box']) for g in names) < 0.3 * area(c['box']): fc += 1
    return fc / max(1, len(res))
scores = sorted(set(c['score'] for p in res for c in p['roster_covers']), reverse=True)
lo, hi = 0, len(scores) - 1
while lo < hi:
    mid = (lo + hi + 1) // 2
    if wrong(scores[mid]) <= budget: lo = mid
    else: hi = mid - 1
print('%.4f' % scores[lo], 'wrong covers %.3f/page on %d pages' % (wrong(scores[lo]), len(res)))
