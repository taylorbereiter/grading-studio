# The page part: find the handwritten words on a scanned page (no learning, plain image rules),
# read each one with the reader, and box the ones that match a roster name. Also the "name spot" rule:
# handwriting right after a printed "Name" label is boxed whatever it says.
import os, numpy as np, cv2
import hwlib
from reader import spot, spot_any, label, LETTER

def binarize(gray):
    g = cv2.GaussianBlur(gray, (3, 3), 0)
    bw = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 41, 12) > 0
    # ruled lines, underlines and box edges: long thin runs
    h, w = bw.shape
    u8 = bw.astype(np.uint8)
    hk = np.ones((1, max(40, w // LINELEN)), np.uint8)
    hl = cv2.morphologyEx(u8, cv2.MORPH_OPEN, hk)
    if LINES >= 2:
        # ruled lines on photos are often a few degrees off level: straighten at a few angles and look again
        for ang in (-4, -2, 2, 4):
            M = cv2.getRotationMatrix2D((w / 2, h / 2), ang, 1.0)
            r = cv2.warpAffine(u8, M, (w, h), flags=cv2.INTER_NEAREST)
            o = cv2.morphologyEx(r, cv2.MORPH_OPEN, hk)
            if o.any():
                hl |= cv2.warpAffine(o, cv2.invertAffineTransform(M), (w, h), flags=cv2.INTER_NEAREST) & u8
    vl = cv2.morphologyEx(u8, cv2.MORPH_OPEN, np.ones((max(40, h // 25), 1), np.uint8))
    thick = cv2.morphologyEx(u8, cv2.MORPH_OPEN, np.ones((5, 1), np.uint8))
    lines = (hl > 0) & ~(thick > 0) | (vl > 0)
    return bw & ~lines

LINES = int(os.environ.get('HW_LINES', '2'))
MAXH = float(os.environ.get('HW_MAXH', '99'))    # drop boxes taller than this many letter heights (drawings)
MASK = os.environ.get('HW_MASK', '0') == '1'      # crop margins filled with paper instead of the neighbours' ink
OTHER_LABELS = ['class', 'date', 'period', 'form', 'teacher', 'grade', 'subject', 'block', 'group', 'section', 'score', 'mark', 'marks', 'total']
KX = float(os.environ.get('HW_KX', '0.9'))    # how far apart letters can be and still join into one box, in letter heights
KY = float(os.environ.get('HW_KY', '0.15'))
NARROW_PAD = int(os.environ.get('HW_NPAD', '1'))  # reader columns kept either side of a matched name when narrowing a cover
TALL = float(os.environ.get('HW_TALL', '9'))        # boxes taller than this many letter heights are drawings, not words
BIGCC = os.environ.get('HW_BIGCC', '1') == '1'      # on small pictures, judge 'too tall' by the letters as well as the page
LINELEN = int(os.environ.get('HW_LINELEN', '25'))   # a ruled line is at least 1/LINELEN of the page wide
LABEL_LINE = os.environ.get('HW_LABEL_LINE', '1') == '1'   # Name-label rule: a name written bigger and higher still counts as on the line
EDGE = os.environ.get('HW_EDGE', '1') == '1'        # keep word-shaped boxes that touch the picture's edge (tightly cropped scans)
VALLEY = float(os.environ.get('HW_VALLEY', '0.35'))  # split a tall box only where its ink thins to this share of the lines either side

def _group(clean, hmed, line_h, depth=0):
    """Word boxes inside a binary region; a box taller than about two lines is split at its emptiest row."""
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, int(KX * hmed)), max(1, int(KY * hmed))))
    blobs = cv2.morphologyEx(clean.astype(np.uint8), cv2.MORPH_CLOSE, k)
    blobs = cv2.dilate(blobs, np.ones((1, 3), np.uint8))
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(blobs, 8)
    boxes = []
    for i in range(1, n2):
        x, y, w, h, a = st2[i]
        if h < 0.35 * hmed or w < 0.3 * hmed: continue
        m = (lab2[y:y + h, x:x + w] == i) & clean[y:y + h, x:x + w]
        ys, xs = np.nonzero(m)
        if len(xs) < 8: continue
        m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; x += xs.min(); y += ys.min(); h, w = m.shape
        if line_h and h > 1.8 * line_h and depth < 4:
            prof = np.convolve(m.sum(1).astype(np.float32), np.ones(5) / 5, 'same')
            lo, hi = int(0.3 * h), int(0.7 * h)
            cut = lo + int(np.argmin(prof[lo:hi])) if hi > lo else h // 2
            # only where the ink thins out between two lines: a name written bigger than the rest has no such gap
            if VALLEY > 0 and prof[cut] > VALLEY * min(prof[:cut].max(initial=0), prof[cut:].max(initial=0)):
                if h <= TALL * hmed: boxes.append([int(x), int(y), int(x + w - 1), int(y + h - 1)])
                continue
            for part, oy in ((m[:cut], 0), (m[cut:], cut)):
                if part.sum() < 8: continue
                for b in _group(part, hmed, line_h, depth + 1):
                    boxes.append([b[0] + x, b[1] + y + oy, b[2] + x, b[3] + y + oy])
            continue
        if h > TALL * hmed: continue
        boxes.append([int(x), int(y), int(x + w - 1), int(y + h - 1)])
    return boxes

def paper_mask(gray):
    """For a photo of a page on a table: the page itself. None when the picture is all page, as with a scan."""
    f = 0.25
    small = cv2.resize(gray, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    blur = cv2.GaussianBlur(small, (0, 0), 4)
    _, m = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    frac = (m > 0).mean()
    if frac > 0.9 or frac < 0.25: return None
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2: return None
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    mask = (lab == big).astype(np.uint8)
    k = max(3, int(0.03 * min(mask.shape)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    # fill holes (writing, folds) inside the page
    inv = (1 - mask).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n2):
        x, y, w, h, a = st2[i]
        if x > 0 and y > 0 and x + w < mask.shape[1] and y + h < mask.shape[0]: mask[lab2 == i] = 1
    mask = cv2.erode(mask, np.ones((3, 3), np.uint8))
    return cv2.resize(mask, (gray.shape[1], gray.shape[0]), interpolation=cv2.INTER_NEAREST) > 0

def word_boxes(gray):
    """Return list of word boxes [x0, y0, x1, y1] and the typical letter height."""
    pm = paper_mask(gray) if os.environ.get("PAPER", "0") == "1" else None   # off: it cut real writing on unevenly lit photos (held-back pages)
    boxes, hmed = _word_boxes(gray)
    H, W = gray.shape
    out = []
    for b in boxes:
        w, h = b[2] - b[0] + 1, b[3] - b[1] + 1
        if h > 4 * w or w > 30 * h: continue
        if h > MAXH * hmed: continue
        if b[0] <= 1 or b[1] <= 1 or b[2] >= W - 2 or b[3] >= H - 2:
            # at the picture's edge: page borders and shadows, unless it is shaped like a word (a tightly cropped scan)
            if not (EDGE and h <= 3 * hmed and w >= 0.5 * hmed): continue
        if pm is not None and not pm[(b[1] + b[3]) // 2, (b[0] + b[2]) // 2]: continue
        out.append(b)
    return out, hmed

def _word_boxes(gray):
    bw = binarize(gray)
    n, lab, st, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    hs = st[1:, cv2.CC_STAT_HEIGHT]; areas = st[1:, cv2.CC_STAT_AREA]
    big = gray.shape[0] * 0.2
    if BIGCC:
        # on a small or tightly cropped picture two joined lines can be a fifth of the page: judge by the letters too
        pre = (areas >= 12) & (hs >= 8) & (hs < big)
        if pre.sum(): big = max(big, TALL * float(np.median(hs[pre])))
    ok = (areas >= 12) & (hs >= 6) & (hs < big)
    if ok.sum() < 3: return [], 20.0
    hmed = float(np.median(hs[ok & (hs >= 8)])) if (ok & (hs >= 8)).sum() else 20.0
    keep = np.zeros(n, bool); keep[1:] = ok & (areas >= max(12, 0.02 * hmed * hmed))
    clean = keep[lab]
    first = _group(clean, hmed, None)
    hts = [b[3] - b[1] + 1 for b in first if b[2] - b[0] + 1 >= hmed]
    line_h = float(np.median(hts)) if hts else 2 * hmed
    boxes = _group(clean, hmed, line_h)
    return [[int(v) for v in b] for b in boxes], hmed

def crop(gray, b, hmed):
    x0, y0, x1, y1 = b
    py = int(0.25 * hmed); px = int(0.2 * hmed)
    H, W = gray.shape
    if MASK:
        inner = gray[y0:y1 + 1, x0:x1 + 1]
        out = np.full((y1 - y0 + 1 + 2 * py, x1 - x0 + 1 + 2 * px), np.uint8(np.percentile(inner, 90)), np.uint8)
        out[py:py + inner.shape[0], px:px + inner.shape[1]] = inner
        return out
    return gray[max(0, y0 - py): min(H, y1 + py + 1), max(0, x0 - px): min(W, x1 + px + 1)]

def narrow(b, lp, s0, s1, hmed):
    """Cover only the matched part (reader columns s0 to s1) when the box holds more than one word."""
    T = lp.shape[0]
    x0, y0, x1, y1 = b
    if T > 4 and (s0 > 1 or s1 < T - 2):
        pad = int(0.2 * hmed)
        cw = (x1 - x0 + 1) + 2 * pad
        nx0 = x0 - pad + int(cw * max(0, s0 - NARROW_PAD) / T); nx1 = x0 - pad + int(cw * min(T, s1 + 1 + NARROW_PAD) / T)
        return [max(x0, nx0), y0, min(x1, nx1), y1]
    return list(b)

def same_line(a, b, hmed):
    ca, cb = (a[1] + a[3]) / 2, (b[1] + b[3]) / 2
    return abs(ca - cb) < 0.7 * hmed

def find(gray, roster, R, thr, spot_rule=True, lp_cache=None):
    """roster: list of name words. Returns list of covers dict(box, why, name, score) plus the word boxes and reads."""
    boxes, hmed = word_boxes(gray)
    if not boxes: return [], []
    if lp_cache is not None and 'lps' in lp_cache:
        lps = lp_cache['lps']
    else:
        lps = R.logprobs([crop(gray, b, hmed) for b in boxes])
        if lp_cache is not None: lp_cache['lps'] = lps
    labs = [label(r) for r in roster]
    names_lab = label('name')
    other_labs = [label(w) for w in OTHER_LABELS]
    covers, reads = [], []
    for b, lp in zip(boxes, lps):
        res = [spot_any(lp, lb) for lb in labs]
        sc = [r[0] / max(1, len(lb)) for r, lb in zip(res, labs)]
        j = int(np.argmax(sc)) if sc else -1
        reads.append(dict(box=b, best=roster[j] if j >= 0 else '', score=sc[j] if j >= 0 else -99, scores=[round(float(v), 4) for v in sc],
                          name_label=spot(lp, names_lab, LETTER)[0] / 4,
                          other_label=max(spot(lp, ol, LETTER)[0] / len(ol) for ol in other_labs)))
        if j >= 0 and sc[j] >= thr:
            seg = lp[max(0, res[j][1]):max(res[j][1] + 1, res[j][2] + 1)]
            covers.append(dict(box=narrow(b, lp, res[j][1], res[j][2], hmed), why='roster', name=roster[j], score=float(sc[j]),
                               conf=float(seg.max(-1).mean()) if len(seg) else -9.0))
    if spot_rule:
        H = gray.shape[0]
        for r in reads:
            b = r['box']
            if b[1] > 0.3 * H or r['name_label'] < -0.5: continue
            # handwriting to the right of the label, on the same line, until a big gap
            if LABEL_LINE:   # a name is often written bigger than the printed label and sits higher on the line
                right = sorted([q for q in reads if q is not r and q['box'][0] > b[2] and
                                _beside(b, q['box'], max(b[3] - b[1] + 1, q['box'][3] - q['box'][1] + 1))], key=lambda q: q['box'][0])
            else:
                right = sorted([q for q in reads if q is not r and q['box'][0] > b[2] and same_line(q['box'], b, hmed)], key=lambda q: q['box'][0])
            x = b[2]
            for q in right:
                if q['box'][0] - x > 4 * hmed: break
                if q['name_label'] > -0.5 or q['other_label'] > -0.5: break   # the next printed label on the line
                covers.append(dict(box=q['box'], why='name spot', name='', score=0.0))
                x = q['box'][2]
    return covers, reads

def pair_covers(reads, pairs, roster, thr, relax, hmed_guess=None):
    """Full names: once one part of a student's name is found, the word just beside it is checked for the other part
    with a lower bar. pairs: list of (first_index, last_index) into the roster."""
    idx = {}
    for a, b in pairs: idx.setdefault(a, []).append((b, 'right')); idx.setdefault(b, []).append((a, 'left'))
    found = []
    for i, r in enumerate(reads):
        for j, s in enumerate(r['scores']):
            if s < thr or j not in idx: continue
            b = r['box']; h = b[3] - b[1] + 1
            for k, side in idx[j]:
                for q in reads:
                    if q is r: continue
                    c = q['box']
                    if abs((c[1] + c[3]) / 2 - (b[1] + b[3]) / 2) > 0.6 * h: continue
                    gap = c[0] - b[2] if side == 'right' else b[0] - c[2]
                    if gap < -0.2 * h or gap > 2.5 * h: continue
                    if q['scores'][k] >= thr - relax: found.append(dict(box=c, why='pair', name=roster[k], score=q['scores'][k]))
    return found

def _line_height(boxes, hmed):
    hts = [b[3] - b[1] + 1 for b in boxes if b[2] - b[0] + 1 >= hmed]
    return float(np.median(hts)) if hts else 2 * hmed

def _beside(a, b, lh):
    """Same line: centres close, or the boxes share a good part of their height (lines in photos slope and curve)."""
    if abs((a[1] + a[3]) / 2 - (b[1] + b[3]) / 2) <= 0.6 * lh: return True
    ov = min(a[3], b[3]) - max(a[1], b[1]) + 1
    return ov >= 0.4 * min(a[3] - a[1] + 1, b[3] - b[1] + 1)

def _union(bs):
    return [min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)]

def grow_ink(bw, b, lh):
    """Widen a cover to the whole strokes it cuts through (a descender, the top of a capital), within reach."""
    H, W = bw.shape
    ry, rx = int(0.6 * lh), int(0.3 * lh)
    X0, Y0, X1, Y1 = max(0, b[0] - rx), max(0, b[1] - ry), min(W - 1, b[2] + rx), min(H - 1, b[3] + ry)
    reg = bw[Y0:Y1 + 1, X0:X1 + 1].astype(np.uint8)
    if not reg.any(): return list(b)
    n, lab, st, _ = cv2.connectedComponentsWithStats(reg, 8)
    inner = lab[b[1] - Y0:b[3] - Y0 + 1, b[0] - X0:b[2] - X0 + 1]
    ids = set(np.unique(inner).tolist()) - {0}
    out = list(b)
    for i in ids:
        x, y, w, h, a = st[i]
        if a < 4: continue
        out = [min(out[0], X0 + x), min(out[1], Y0 + y), max(out[2], X0 + x + w - 1), max(out[3], Y0 + y + h - 1)]
    return out

def own_name(gray, boxes, lps, hmed, parts, R, top_lines=2.5, end_lines=2.0, zone_frac=0.12, page_top=0.3, page_end=0.75,
             loose=-5.0, grow=True, bw=None, outside=True):
    """The paper's own student. The app knows whose paper it is, so it looks for that student's name parts (say
    ['maria', 'garcia']) where names are written: the first lines and the last lines of the writing. Small pieces
    stacked on a word (a descender, a dot, a slice cut off by a ruled line) are read with it, neighbouring boxes are
    read together in case a word was cut apart, and first + last name side by side are scored together.
    The rest of the page is searched too, one box at a time, for a stricter bar (the z flag is 0 there).
    Returns dict(full=[(score, conf, [boxes], z)], part=[[(score, conf, box, z)] per part]) best first; conf is how sure
    the reader was of its own reading there (low on table tops and paper texture). The caller applies the cut-offs."""
    out = dict(full=[], part=[[] for _ in parts])
    if not boxes or not parts: return out
    lh = _line_height(boxes, hmed)
    y_first = min(b[1] for b in boxes); y_last = max(b[3] for b in boxes)
    top = y_first + max(top_lines * lh, zone_frac * (y_last - y_first))
    end = y_last - max(end_lines * lh, zone_frac * (y_last - y_first))
    H = gray.shape[0]
    top = max(top, page_top * H); end = min(end, page_end * H)
    zone = [i for i, b in enumerate(boxes) if (b[1] + b[3]) / 2 <= top or (b[1] + b[3]) / 2 >= end]
    rest = [i for i in range(len(boxes)) if i not in set(zone)] if outside else []
    if not zone and not rest: return out
    labs = [label(p) for p in parts]
    # units: a zone box with the small pieces stacked on it
    order = sorted(zone, key=lambda i: -(boxes[i][2] - boxes[i][0] + 1) * (boxes[i][3] - boxes[i][1] + 1))
    owner = {}
    for i in order:
        if i in owner: continue
        owner[i] = i
        b = boxes[i]
        for j in zone:
            if j in owner: continue
            c = boxes[j]
            if c[3] - c[1] + 1 > 0.8 * lh or (c[2] - c[0] + 1) > (b[2] - b[0] + 1): continue
            inside = max(0, min(b[2], c[2]) - max(b[0], c[0]) + 1) / max(1, c[2] - c[0] + 1)
            if inside >= 0.7 and max(c[1] - b[3], b[1] - c[3]) < 0.4 * lh: owner[j] = i
    units = {}
    for j, i in owner.items(): units.setdefault(i, []).append(j)
    units = [tuple(sorted(m)) for m in units.values()]
    ubox = {m: _union([boxes[j] for j in m]) for m in units}
    def right_neighbour(m):
        b = ubox[m]; best = None
        for u in units:
            c = ubox[u]
            if u == m or c[0] <= b[0]: continue
            if not _beside(b, c, lh): continue
            gap = c[0] - b[2]
            if gap < -0.3 * lh or gap > 1.2 * lh: continue
            if best is None or c[0] < ubox[best][0]: best = u
        return best
    spans = [m for m in units]
    for m in units:
        n = right_neighbour(m)
        if n is None: continue
        spans.append(m + n)
        k = right_neighbour(n)
        if k is not None: spans.append(m + n + k)
    sbox = {s: _union([boxes[j] for j in s]) for s in spans}
    # read: single boxes are already read; the rest only if some piece of them looks a little like a name part
    def quick(i): return max(spot_any(lps[i], lb)[0] / len(lb) for lb in labs)
    qs = {i: quick(i) for i in zone}
    slp = {}
    need = []
    for s in spans:
        if len(s) == 1: slp[s] = lps[s[0]]
        elif max(qs[j] for j in s) >= loose: need.append(s)
    if need:
        for s, lp in zip(need, R.logprobs([crop(gray, sbox[s], hmed) for s in need])): slp[s] = lp
    if grow and bw is None: bw = binarize(gray)
    def grown(b):
        if not grow: return b
        b = list(b)
        for c in boxes:
            if c[3] - c[1] + 1 > 0.8 * lh: continue
            inside = max(0, min(b[2], c[2]) - max(b[0], c[0]) + 1) / max(1, c[2] - c[0] + 1)
            if inside >= 0.7 and max(c[1] - b[3], b[1] - c[3]) < 0.4 * lh: b = _union([b, c])
        return grow_ink(bw, b, lh)
    def conf(lp, s0, s1):
        seg = lp[max(0, s0):max(s0 + 1, s1 + 1)]
        return float(seg.max(-1).mean()) if len(seg) else -9.0
    for i in rest: slp[(i,)] = lps[i]; sbox[(i,)] = boxes[i]
    inz = set(zone)
    cands = []
    for s, lp in slp.items():
        z = int(s[0] in inz)
        row = []
        for k, lb in enumerate(labs):
            r = spot_any(lp, lb)
            sc = r[0] / max(1, len(lb))
            nb = narrow(sbox[s], lp, r[1], r[2], hmed)
            row.append((sc, conf(lp, r[1], r[2]), grown(nb) if (z or sc > loose) else nb, z))
            out['part'][k].append(row[-1])
        cands.append((s, sbox[s], lp, row))
    for k in range(len(parts)): out['part'][k].sort(key=lambda t: -t[0])
    for k in range(len(parts) - 1):
        n0, n1 = len(labs[k]), len(labs[k + 1])
        # first then last, side by side, scored together
        for sa, ba, _, ra in cands:
            for sb, bb, _, rb in cands:
                if set(sa) & set(sb): continue
                if not _beside(ba, bb, lh): continue
                gap = bb[0] - ba[2]
                if gap < -0.3 * lh or gap > 2.5 * lh: continue
                sc = (n0 * ra[k][0] + n1 * rb[k + 1][0]) / (n0 + n1)
                out['full'].append((sc, min(ra[k][1], rb[k + 1][1]), [ra[k][2], rb[k + 1][2]], min(ra[k][3], rb[k + 1][3])))
        # both in one picture (written close together)
        both = [label(parts[k] + ' ' + parts[k + 1]), label(parts[k] + parts[k + 1])]
        for s, b, lp, _ in cands:
            r = max((spot_any(lp, lb) for lb in both), key=lambda t: t[0])
            nb = narrow(b, lp, r[1], r[2], hmed)
            out['full'].append((r[0] / (n0 + n1), conf(lp, r[1], r[2]), [grown(nb)], int(s[0] in inz)))
    # an initial for the last name ("Maria G."): the bit right after a first-name candidate, in the same box or the next
    out['initial'] = []
    if len(parts) >= 2:
        # a capital I and a small l are the same stroke, and so on: an initial may read as its look-alike
        alike = {'i': 'il1', 'l': 'li1', 'o': 'o0', 's': 's5', 'z': 'z2', 'b': 'b6', 'g': 'g9', 'q': 'q9'}
        ilabs = [label(ch) for ch in alike.get(parts[-1][0], parts[-1][0]) if hwlib.IDX.get(ch)]
        firsts = sorted([(row[0][0], s, b, lp) for s, b, lp, row in cands if row[0][3]], key=lambda t: -t[0])[:3]
        pics, where = [], []
        for sc0, s, b, lp in firsts:
            r = spot_any(lp, labs[0])
            nb = narrow(b, lp, r[1], r[2], hmed)
            if b[2] - nb[2] > 0.3 * lh:          # the box goes on after the first name
                rb = [nb[2] + 1, b[1], min(b[2], nb[2] + int(2 * lh)), b[3]]
            else:
                nxt = [u for u in units if ubox[u][0] > b[2] and abs((ubox[u][1] + ubox[u][3]) / 2 - (b[1] + b[3]) / 2) <= 0.6 * lh
                       and ubox[u][0] - b[2] <= 1.5 * lh]
                if not nxt: continue
                rb = list(ubox[min(nxt, key=lambda u: ubox[u][0])])
                rb[2] = min(rb[2], rb[0] + int(2 * lh))     # an initial is short: only the start of a longer box
            pics.append(crop(gray, rb, hmed)); where.append((sc0, rb))
        if pics:
            for (sc0, rb), lp in zip(where, R.logprobs(pics)):
                r = max((spot_any(lp, il) for il in ilabs), key=lambda t: t[0])
                out['initial'].append((sc0, r[0], conf(lp, r[1], r[2]), grown(rb)))
    out['full'].sort(key=lambda t: -t[0])
    out['full'] = [f for f in out['full'] if f[3]][:8] + [f for f in out['full'] if not f[3]][:4]
    for k in range(len(parts)):
        out['part'][k].sort(key=lambda t: -t[0])
        out['part'][k] = [t for t in out['part'][k] if t[3]][:5] + [t for t in out['part'][k] if not t[3]][:3]
    return out
