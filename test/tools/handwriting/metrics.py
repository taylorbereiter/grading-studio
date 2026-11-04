# Turn an eval_words.py result into the numbers that matter:
# how many stand-in names get covered, and how many other words get covered by mistake, per page.
# Usage: python -I metrics.py <val.json> [test.json] [norm]
import sys, json, numpy as np

def load(p, norm):
    tr = json.load(open(p))
    T, D, ident, pages = [], [], [], len(tr)
    for t in tr:
        n = np.array(t['norm']) if norm else np.ones(len(t['roster']))
        for r in t['rows']:
            s = np.array(r['s']) / n
            m = float(s.max())
            if r['t']:
                T.append(m); ident.append(int(np.argmax(s)) == 0)
            elif r['txt'] not in t['roster']:
                D.append(m)
    return np.array(T), np.array(D), np.array(ident), pages

def at(T, D, pages, thr):
    return (T >= thr).mean(), (D >= thr).sum() / pages

def pick(D, pages, fc):
    # lowest threshold whose false covers per page stay at or under fc
    s = np.sort(D)[::-1]
    k = int(np.floor(fc * pages))
    return s[k] + 1e-9 if k < len(s) else -1e9

if __name__ == '__main__':
    vp = sys.argv[1]; tp = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != '-' else None
    norm = len(sys.argv) > 3 and sys.argv[3] == 'norm'
    Tv, Dv, Iv, pv = load(vp, norm)
    print('val: %d trials, %d stand-in words, %d other words; right name ranked first %.1f%%' % (pv, len(Tv), len(Dv), 100 * Iv.mean()))
    rows = []
    for fc in (0.05, 0.1, 0.25, 0.5, 1.0):
        thr = pick(Dv, pv, fc)
        h, f = at(Tv, Dv, pv, thr)
        line = '  mistakes/page <= %.2f: threshold %.3f -> val covered %.1f%% (%.2f mistakes/page)' % (fc, thr, 100 * h, f)
        if tp:
            Tt, Dt, It, pt = load(tp, norm)
            h2, f2 = at(Tt, Dt, pt, thr)
            line += ' | test covered %.1f%% (%.2f mistakes/page)' % (100 * h2, f2)
        print(line)
    if tp:
        Tt, Dt, It, pt = load(tp, norm)
        print('test: %d trials, %d stand-in words, %d other words; right name ranked first %.1f%%' % (pt, len(Tt), len(Dt), 100 * It.mean()))
