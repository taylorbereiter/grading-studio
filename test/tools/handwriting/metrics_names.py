# The student's own name on their own paper, scored the way the app would work: it knows whose paper it is, so on top
# of the roster search it looks for THAT student's first and last name where names are written (the first lines and
# the last lines of the writing) with a lower bar, and covers the word right beside a found part too.
# Usage: python -I metrics_names.py <names.json> <roster_thr> [own_thr] [options]
#   options: sweep  (try several own_thr), top=<lines> end=<lines>, pair=<relax>, nolabel, noown
import sys, os, json, numpy as np
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from metrics_pages import overlap, area, covered, ink_covered
CONF = float(os.environ.get('HW_CONF', '-1.0'))
T_INIT = float(os.environ.get('HW_INIT', '-1.0'))
FALLBACK = int(os.environ.get('HW_FALLBACK', '3'))   # cover a first line of at most this many boxes when the name is not found
RCONF_N = float(os.environ.get('HW_RCONF', '-0.5'))
CONF_REL = float(os.environ['HW_CONF_REL']) if os.environ.get('HW_CONF_REL') else None

def line_height(boxes, hmed):
    hts = [b[3] - b[1] + 1 for b in boxes if b[2] - b[0] + 1 >= hmed]
    return float(np.median(hts)) if hts else 2 * hmed

def zones(p, top_lines, end_lines):
    """Indexes of word boxes in the first lines and in the last lines of the writing."""
    boxes = [r['box'] for r in p['reads']]
    if not boxes: return set()
    lh = line_height(boxes, p['hmed'])
    y_first = min(b[1] for b in boxes); y_last = max(b[3] for b in boxes)
    z = set()
    for i, b in enumerate(boxes):
        cy = (b[1] + b[3]) / 2
        if cy <= y_first + top_lines * lh or cy >= y_last - end_lines * lh: z.add(i)
    return z

def own_covers(p, own_thr, top_lines=2.5, end_lines=2.0, pair_relax=1.0, short_pair=True):
    """Covers for the paper's own student: the best box for each name part inside the name zones, if it clears own_thr,
    then the word just beside it when it reads like the other part (with a lower bar) or is short (an initial)."""
    reads, own = p['reads'], p['own']
    if not reads: return []
    z = zones(p, top_lines, end_lines)
    lh = line_height([r['box'] for r in reads], p['hmed'])
    out = []
    found = {}
    for part in (0, 1):
        best = max(z, key=lambda i: own[i][part][0], default=None)
        if best is not None and own[best][part][0] >= own_thr:
            found[part] = best
            out.append(dict(box=own[best][part][1], why='own', score=own[best][part][0]))
    # the other part right beside a found part
    for part, i in list(found.items()):
        other = 1 - part
        b = reads[i]['box']
        side = 'right' if part == 0 else 'left'
        cands = []
        for j, q in enumerate(reads):
            if j == i: continue
            c = q['box']
            if abs((c[1] + c[3]) / 2 - (b[1] + b[3]) / 2) > 0.6 * lh: continue
            gap = c[0] - b[2] if side == 'right' else b[0] - c[2]
            if gap < -0.2 * lh or gap > 2.0 * lh: continue
            cands.append((gap, j))
        if not cands: continue
        gap, j = min(cands)
        c = reads[j]['box']
        short = (c[2] - c[0] + 1) <= 1.2 * lh
        if own[j][other][0] >= own_thr - pair_relax or (short_pair and part == 0 and short):
            out.append(dict(box=own[j][other][1] if own[j][other][0] >= own_thr - pair_relax else c, why='own pair', score=0.0))
    return out

BESIDE = int(os.environ.get('HW_BESIDE', '2'))          # a found name part on a line of at most this many words takes its neighbours
BESIDE_MIN = float(os.environ.get('HW_BESIDE_MIN', '-1.0'))
OUT_FULL = float(os.environ.get('HW_OUT_FULL', '-1.0'))    # bars for the rest of the page (outside the name spots)
OUT_PART = float(os.environ.get('HW_OUT_PART', '99'))

def own2_covers(p, t_full, t_part, t_more=-0.8, initial=True):
    """Covers from find_names.own_name: the first + last name pair when it clears t_full, and each part's best spot
    when it clears t_part; then a short word (an initial) right after the first name."""
    o = p['own2']; out = []
    def zf(t): return t[3] if len(t) > 3 else 1
    floor = CONF if CONF_REL is None else p.get('page_conf', 0.0) + CONF_REL   # how sure the reader must be, maybe against the page
    full = [f for f in o['full'] if f[1] >= floor and f[0] >= (t_full if zf(f) else OUT_FULL)]
    full.sort(key=lambda f: -f[0])
    taken = []
    for n, f in enumerate(full):   # the best pair; another one too if it is very sure (header and signature)
        s, c, bs = f[:3]
        if n > 0 and s < t_more: break
        if any(overlap(b, t) > 0 for b in bs for t in taken): continue
        out += [dict(box=b, why='own', score=s) for b in bs]; taken += bs
    for k, lst in enumerate(o['part']):
        lst = sorted([t for t in lst if t[1] >= floor and t[0] >= (t_part if zf(t) else OUT_PART)], key=lambda t: -t[0])
        if lst: out.append(dict(box=lst[0][2], why='own', score=lst[0][0]))
    if BESIDE and out:
        # a name part found on a short line (a name line: at most BESIDE words): the words right beside it go with it
        boxes = [r['box'] for r in p['reads']]
        lh = line_height(boxes, p['hmed']) if boxes else 0
        for c in [c for c in out if c['why'] == 'own' and c['score'] >= BESIDE_MIN]:
            b = c['box']; cy = (b[1] + b[3]) / 2
            line = [q for q in boxes if abs((q[1] + q[3]) / 2 - cy) <= 0.6 * lh and q[3] - q[1] + 1 >= 0.4 * lh]
            if len(line) > BESIDE: continue
            reach = [b[0], b[2]]
            changed = True
            while changed:
                changed = False
                for q in line:
                    if overlap(q, b) > 0 or any(q == x['box'] for x in out): continue
                    gap = max(q[0] - reach[1], reach[0] - q[2])
                    if gap <= 1.5 * lh:
                        out.append(dict(box=q, why='own beside', score=0.0)); reach = [min(reach[0], q[0]), max(reach[1], q[2])]; changed = True
    if initial and 'initial' in o:
        # the initial after a first name that was covered: it must read as the last name's first letter
        firsts = [c['box'] for c in out]
        for f, s, c, b in o['initial']:
            if s >= T_INIT and c >= floor and any(overlap(b, x) == 0 and abs(b[0] - x[2]) < 3 * (b[3] - b[1] + 1) for x in firsts) and f >= t_part:
                out.append(dict(box=b, why='own initial', score=s))
    if FALLBACK and not out and not p['spots']:
        # the name was not read anywhere (another script, or too messy): a short first line of writing at the top of
        # the page is very likely the name, so cover it and let the teacher check it in the review
        boxes = [r['box'] for r in p['reads']]
        if boxes:
            lh = line_height(boxes, p['hmed'])
            big = [b for b in boxes if b[3] - b[1] + 1 >= 0.5 * lh and b[2] - b[0] + 1 >= 0.5 * lh and not any(overlap(b, s['box']) > 0 for s in p['spots'])]
            if big:
                t = min(big, key=lambda b: b[1])
                line = [b for b in big if abs((b[1] + b[3]) / 2 - (t[1] + t[3]) / 2) <= 0.6 * lh]
                if len(line) <= FALLBACK and (t[1] + t[3]) / 2 <= 0.3 * p['H']:
                    out += [dict(box=b, why='first line', score=0.0) for b in line]
    uniq = []
    for c in out:
        if not any(c['box'] == u['box'] for u in uniq): uniq.append(c)
    return uniq

COMPS = json.load(open(os.environ['HW_COMPS'])) if os.environ.get('HW_COMPS') else None   # ink blobs from comps.py
SNAP = float(os.environ.get('HW_SNAP', '1.0'))   # a cover inside a word box takes the rest of the box when the rest is shorter than this (line heights)
GROW = os.environ.get('HW_GROW', '1') == '1'     # covers widen to the ink blobs they cut through, within reach
JOIN = float(os.environ.get('HW_JOIN', '1.0'))
STACK = float(os.environ.get('HW_STACK', '0.3'))  # Name-line covers take a word piece stacked right above or below them (gap in line heights)   # covers on the Name line this close together (line heights) become one

def polish(p, cs):
    """Finish the covers the way the app would draw them: whole words, whole strokes, one bar on the Name line."""
    if COMPS is None or not cs: return cs
    info = COMPS.get(p['page_file'] if 'page_file' in p else str(p['id']))
    if not info or not info['lh']: return cs
    lh, comps = info['lh'], info['comps']
    boxes = [r['box'] for r in p['reads']]
    out = []
    for c in cs:
        b = list(c['box'])
        if SNAP > 0:
            for wb in boxes:
                if b[0] >= wb[0] - 2 and b[2] <= wb[2] + 2 and overlap(b, wb) >= 0.8 * area(b):
                    if b[0] - wb[0] < SNAP * lh: b[0] = min(b[0], wb[0])
                    if wb[2] - b[2] < SNAP * lh: b[2] = max(b[2], wb[2])
                    b[1] = min(b[1], wb[1]); b[3] = max(b[3], wb[3])
                    break
        if STACK > 0 and c.get('why') == 'name spot':
            # a name written big over the Name line can be cut in two at the line: take the piece stacked on it
            for wb in boxes:
                ox = min(b[2], wb[2]) - max(b[0], wb[0]) + 1
                gap = max(b[1] - wb[3], wb[1] - b[3])
                if ox >= 0.7 * (wb[2] - wb[0] + 1) and -0.2 * lh <= gap <= STACK * lh:
                    b = [min(b[0], wb[0]), min(b[1], wb[1]), max(b[2], wb[2]), max(b[3], wb[3])]
        if GROW:
            R = [b[0] - 0.3 * lh, b[1] - 0.6 * lh, b[2] + 0.3 * lh, b[3] + 0.6 * lh]
            nb = list(b)
            for q in comps:
                if q[2] < b[0] or q[0] > b[2] or q[3] < b[1] or q[1] > b[3]: continue
                # mostly level with the cover: its own strokes, not a neighbouring line dipping into it
                if min(q[3], b[3]) - max(q[1], b[1]) + 1 < 0.5 * min(q[3] - q[1] + 1, b[3] - b[1] + 1): continue
                nb = [min(nb[0], max(q[0], R[0])), min(nb[1], max(q[1], R[1])), max(nb[2], min(q[2], R[2])), max(nb[3], min(q[3], R[3]))]
            b = [int(v) for v in nb]
        out.append(dict(c, box=b))
    if JOIN > 0:
        spots = sorted([c for c in out if c.get('why') == 'name spot'], key=lambda c: c['box'][0])
        rest = [c for c in out if c.get('why') != 'name spot']
        joined = []
        for c in spots:
            b = c['box']
            for j in joined:
                a = j['box']
                if abs((a[1] + a[3]) / 2 - (b[1] + b[3]) / 2) <= 0.6 * lh and b[0] - a[2] <= JOIN * lh:
                    j['box'] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]; break
            else:
                joined.append(dict(c, box=list(b)))
        out = rest + joined
    return out

def score(res, roster_thr, own_thr, use_label=True, use_own=True, own2=None, **kw):
    by = defaultdict(lambda: [0, 0, 0, 0])
    pages_full = fc = own_w = own_wc = 0
    mates = [0, 0]
    misses = []
    for p in res:
        cs = [c for c in p['roster_covers'] if c['score'] >= roster_thr and c.get('conf', 0) >= RCONF_N]
        if use_label: cs = cs + [dict(c, why='name spot') for c in p['spots']]
        if use_own: cs = cs + (own2_covers(p, *own2) if own2 else own_covers(p, own_thr, **kw))
        cs = polish(p, cs)
        own = [g for g in p['gt'] if g['kind'] == 'own']
        names = [g for g in p['gt'] if g['kind'] in ('own', 'mate')]
        for g in p['gt']:
            if g['kind'] == 'mate': mates[0] += 1; mates[1] += covered(g['box'], cs)
        oc = [ink_covered(g['ink'], cs) if g.get('ink') and len(g['ink']) >= 10 else covered(g['box'], cs) for g in own]
        full = all(oc)
        own_w += len(own); own_wc += sum(oc)
        f = sum(1 for c in cs if sum(overlap(c['box'], g['box']) for g in names) < 0.3 * area(c['box']))   # one cover over a two-word name is right
        fc += f
        b = by[p['layout']]; b[2] += f; b[3] += 1
        if own:     # a page where the name did not fit on the paper has nothing to find: not counted for the name
            pages_full += full; b[0] += 1; b[1] += full
            if not full: misses.append(p['id'])
    n = len(res); named = sum(v[0] for v in by.values())
    return dict(whole=pages_full / max(named, 1), words=own_wc / max(own_w, 1), wrong=fc / max(n, 1), n=n, named=named, mates=mates,
                by={k: (v[0], round(v[1] / max(v[0], 1), 3), round(v[2] / v[3], 2)) for k, v in sorted(by.items())}, misses=misses)

if __name__ == '__main__':
    path, roster_thr = sys.argv[1], float(sys.argv[2])
    rest = sys.argv[3:]
    own_thr = float(rest[0]) if rest and not rest[0].isalpha() and '=' not in rest[0] else -1.5
    opts = dict(o.split('=') for o in rest if '=' in o)
    kw = dict(top_lines=float(opts.get('top', 2.5)), end_lines=float(opts.get('end', 2.0)), pair_relax=float(opts.get('pair', 1.0)))
    res = json.load(open(path))
    base = score(res, roster_thr, own_thr, use_own=False, use_label='nolabel' not in rest)
    print('%d pages, %d with the name on them' % (base['n'], base['named']))
    print('roster + label rule only: whole name %.1f%%, words %.1f%%, wrong covers %.2f/page  %s' % (100 * base['whole'], 100 * base['words'], base['wrong'], base['by']))
    thrs = [-0.5, -1.0, -1.5, -2.0, -2.5, -3.0, -4.0, -5.0] if 'sweep' in rest else [own_thr]
    for t in (thrs if res and 'own' in res[0] else []):
        r = score(res, roster_thr, t, use_label='nolabel' not in rest, use_own='noown' not in rest, **kw)
        print('own %.2f: whole name %.1f%%, words %.1f%%, wrong covers %.2f/page  %s' % (t, 100 * r['whole'], 100 * r['words'], r['wrong'], r['by']))
    if 'final' in rest:
        # the rule as decided on the held-back pages: own name pair -2.0, one part -1.5, a second sure pair -0.8
        r = score(res, roster_thr, 0, use_label=True, own2=(-2.0, -1.5, -0.8))
        print('FINAL: whole name %.1f%% (%d pages with a name), name words %.1f%%, wrong covers %.2f/page, classmates %d/%d  %s'
              % (100 * r['whole'], r['named'], 100 * r['words'], r['wrong'], r['mates'][1], r['mates'][0], r['by']))
        if 'misses' in rest: print('missed pages', r['misses'])
    elif 'misses' in rest: print('missed pages', r['misses'])
    if 'own2' in rest and res and 'own2' in res[0]:
        TM = [float(x) for x in opts.get('more', '-0.8').split(',')]
        TF = [float(x) for x in opts.get('full', '-1.0,-1.5,-2.0,-2.5,-3.0').split(',')]
        TP = [float(x) for x in opts.get('part', '-0.5,-1.0,-1.5,-2.0,99').split(',')]
        for tm in TM:
            for tf in TF:
                for tp in TP:
                    r = score(res, roster_thr, 0, use_label='nolabel' not in rest, own2=(tf, tp, tm))
                    print('own2 more %.1f full %.1f part %s: whole name %.1f%%, words %.1f%%, wrong covers %.2f/page, classmates %d/%d  %s' % (tm, tf, tp if tp != 99 else 'off', 100 * r['whole'], 100 * r['words'], r['wrong'], r['mates'][1], r['mates'][0], r['by']))
