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
    hk = np.ones((1, max(40, w // 25)), np.uint8)
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
            for part, oy in ((m[:cut], 0), (m[cut:], cut)):
                if part.sum() < 8: continue
                for b in _group(part, hmed, line_h, depth + 1):
                    boxes.append([b[0] + x, b[1] + y + oy, b[2] + x, b[3] + y + oy])
            continue
        if h > 6 * hmed: continue
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
        if b[0] <= 1 or b[1] <= 1 or b[2] >= W - 2 or b[3] >= H - 2: continue
        if pm is not None and not pm[(b[1] + b[3]) // 2, (b[0] + b[2]) // 2]: continue
        out.append(b)
    return out, hmed

def _word_boxes(gray):
    bw = binarize(gray)
    n, lab, st, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    hs = st[1:, cv2.CC_STAT_HEIGHT]; areas = st[1:, cv2.CC_STAT_AREA]
    ok = (areas >= 12) & (hs >= 6) & (hs < gray.shape[0] * 0.2)
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
        nx0 = x0 - pad + int(cw * max(0, s0 - 1) / T); nx1 = x0 - pad + int(cw * min(T, s1 + 2) / T)
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
            covers.append(dict(box=narrow(b, lp, res[j][1], res[j][2], hmed), why='roster', name=roster[j], score=float(sc[j])))
    if spot_rule:
        H = gray.shape[0]
        for r in reads:
            b = r['box']
            if b[1] > 0.3 * H or r['name_label'] < -0.5: continue
            # handwriting to the right of the label, on the same line, until a big gap
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
