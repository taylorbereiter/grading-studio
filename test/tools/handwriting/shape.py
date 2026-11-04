# Method A: the hand-set word-shape matcher. Nothing is trained.
# A word picture is cleaned up (slant taken out, the middle band of the letters found), turned into a row of
# hand-picked column measurements (ink above / in / below the middle band, top and bottom outline, stroke
# directions), and compared with each roster name drawn in 16 handwriting fonts, using dynamic time warping.
# The score is how much closer the word is to the name than to everyday words drawn the same way.
import os, math, numpy as np, cv2
from numba import njit
from PIL import Image, ImageDraw
import hwlib

ZA, ZC, ZD = 12, 16, 12          # rows given to ascender zone, middle band, descender zone
NH = ZA + ZC + ZD

def ink_map(gray):
    g = gray.astype(np.float32)
    if g.ndim == 3: g = g.mean(2)
    h, w = g.shape
    s = 64.0 / h
    g = cv2.resize(g, (max(4, int(w * s)), 64), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
    x = 255 - g
    lo, hi = np.percentile(x, 30), np.percentile(x, 99.5)
    x = np.clip((x - lo) / max(hi - lo, 24), 0, 1)
    return x

def clean(bw):
    n, lab, st, _ = cv2.connectedComponentsWithStats(bw.astype(np.uint8), 8)
    h, w = bw.shape
    keep = np.zeros(n, bool)
    big = st[1:, cv2.CC_STAT_AREA].max() if n > 1 else 0
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        if a < max(6, 0.01 * big): continue
        touches = y == 0 or y + hh >= h
        if touches and hh < 0.35 * h and a < 0.15 * big: continue      # bits of the next line
        keep[i] = True
    return keep[lab]

def deslant(bw):
    best, bs = -1, 0.0
    h, w = bw.shape
    ys, xs = np.nonzero(bw)
    if len(xs) == 0: return bw
    for s in np.arange(-0.7, 0.71, 0.1):
        nx = np.round(xs + s * (ys - h / 2)).astype(int)
        nx -= nx.min()
        col = np.bincount(nx, minlength=nx.max() + 1).astype(np.float64)
        v = (col ** 2).sum()
        if v > best: best, bs = v, s
    M = np.array([[1, bs, -bs * h / 2], [0, 1, 0]], np.float32)
    pad = int(abs(bs) * h / 2) + 2
    M[0, 2] += pad
    return cv2.warpAffine(bw.astype(np.uint8), M, (w + 2 * pad, h), flags=cv2.INTER_NEAREST) > 0

def unline(bw):
    """Take out ruled lines and underlines: long thin horizontal runs."""
    h, w = bw.shape
    k = max(15, int(0.45 * min(w, 3 * h)))
    if w <= k: return bw
    lines = cv2.morphologyEx(bw.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, k), np.uint8)) > 0
    thick = cv2.morphologyEx(bw.astype(np.uint8), cv2.MORPH_OPEN, np.ones((max(3, h // 8), 1), np.uint8)) > 0
    return bw & ~(lines & ~thick)

def zones(bw):
    h = bw.shape[0]
    p = bw.sum(1).astype(np.float32)
    if p.max() <= 0: return 0, h
    p = np.convolve(p, np.ones(3) / 3, 'same')
    t = 0.4 * p.max()
    m = int(np.argmax(p))
    a = m
    while a > 0 and p[a - 1] >= t: a -= 1
    b = m
    while b < len(p) - 1 and p[b + 1] >= t: b += 1
    if not (0.22 * h <= b + 1 - a <= 0.75 * h):
        a, b = int(0.3 * h), int(0.75 * h) - 1
    return a, b + 1

def normalise(gray):
    """-> float array NH x W with the middle band at fixed rows, widths in middle-band units, or None."""
    x = ink_map(gray)
    t = max(0.3, min(0.6, cv2.threshold((x * 255).astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0] / 255))
    bw = clean(unline(x > t))
    if bw.sum() < 10: return None
    bw = deslant(bw)
    ys, xs = np.nonzero(bw)
    bw = bw[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    a, b = zones(bw)
    h, w = bw.shape
    core = max(b - a, 3)
    sc = ZC / core
    W = max(4, int(round(w * sc * 0.75)))
    f = bw.astype(np.float32)
    def band(part, rows):
        if part.shape[0] == 0: return np.zeros((rows, W), np.float32)
        return cv2.resize(part, (W, rows), interpolation=cv2.INTER_AREA)
    # ascender/descender zones keep their real height relative to the middle band, capped
    up = f[max(0, a - int(core * 1.2)): a]; dn = f[b: b + int(core * 1.2)]
    upz = np.zeros((ZA, W), np.float32); dnz = np.zeros((ZD, W), np.float32)
    if up.shape[0]:
        r = max(1, min(ZA, int(round(up.shape[0] * sc))))
        upz[ZA - r:] = band(up, r)
    if dn.shape[0]:
        r = max(1, min(ZD, int(round(dn.shape[0] * sc))))
        dnz[:r] = band(dn, r)
    return np.vstack([upz, band(f[a:b], ZC), dnz])

def features(gray):
    n = normalise(gray)
    if n is None: return None
    gx = cv2.Sobel(n, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(n, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy) + 1e-6
    ang = (np.arctan2(gy, gx) + np.pi) % np.pi            # 0..pi
    bins = np.minimum((ang / (np.pi / 4)).astype(int), 3)
    W = n.shape[1]
    F = []
    F.append(n[:ZA].mean(0) * 2); F.append(n[ZA:ZA + ZC].mean(0)); F.append(n[ZA + ZC:].mean(0) * 2)
    ink = n > 0.3
    rows = np.arange(NH)[:, None]
    top = np.where(ink.any(0), np.where(ink, rows, NH).min(0), ZA + ZC / 2) / NH
    bot = np.where(ink.any(0), np.where(ink, rows, -1).max(0), ZA + ZC / 2) / NH
    F.append(top); F.append(bot)
    trans = (np.diff(ink[ZA:ZA + ZC].astype(np.int8), axis=0) == 1).sum(0) / 3.0
    F.append(trans)
    for z0, z1, nb in ((ZA, ZA + ZC, 4), (0, ZA, 2), (ZA + ZC, NH, 2)):
        m = mag[z0:z1]; bb = bins[z0:z1]
        if nb == 4:
            for k in range(4): F.append((m * (bb == k)).sum(0) / (z1 - z0) / 2)
        else:
            F.append((m * ((bb == 0) | (bb == 2))).sum(0) / (z1 - z0) / 2)   # vertical-ish vs horizontal-ish strokes
            F.append((m * ((bb == 1) | (bb == 3))).sum(0) / (z1 - z0) / 2)
    F = np.stack(F, 1).astype(np.float32)
    F = cv2.blur(F, (1, 3))
    return np.ascontiguousarray(F[::2])

@njit(cache=True)
def dtw(a, b, band):
    n, m = a.shape[0], b.shape[0]
    INF = 1e18
    D = np.full((n + 1, m + 1), INF)
    D[0, 0] = 0.0
    r = max(band, abs(n - m) + 2)
    for i in range(1, n + 1):
        c = i * m // n
        lo = max(1, c - r); hi = min(m, c + r)
        for j in range(lo, hi + 1):
            d = 0.0
            for k in range(a.shape[1]):
                d += abs(a[i - 1, k] - b[j - 1, k])
            best = D[i - 1, j - 1]
            if D[i - 1, j] < best: best = D[i - 1, j]
            if D[i, j - 1] < best: best = D[i, j - 1]
            D[i, j] = d + best
    return D[n, m] / (n + m)

def render_clean(text, font_path, size=64):
    f = hwlib.get_font(font_path, size)
    w = int(f.getlength(text)) + 2 * size
    im = Image.new('L', (w, size * 3), 255)
    ImageDraw.Draw(im).text((size // 2, int(size * 1.9)), text, font=f, fill=0, anchor='ls')
    a = np.asarray(im)
    ys, xs = np.nonzero(a < 128)
    if len(xs) == 0: return None
    return a[max(0, ys.min() - 4): ys.max() + 5, max(0, xs.min() - 4): xs.max() + 5]

class ShapeMatcher:
    def __init__(self, fonts, cohort_words, band=6):
        self.fonts = fonts
        self.band = band
        self.cache = {}
        self.cohort = [e for w in cohort_words for e in self.exemplars(w)[:4]]

    def exemplars(self, word):
        e = self.cache.get(word)
        if e is None:
            e = []
            for v in (word.capitalize(), word.upper(), word.lower()):
                for fp in self.fonts:
                    g = render_clean(v, fp)
                    if g is None: continue
                    f = features(g)
                    if f is not None: e.append(f)
            self.cache[word] = e
        return e

    def name_dist(self, q, word):
        best = 1e9
        lq = q.shape[0]
        for e in self.exemplars(word):
            le = e.shape[0]
            if le > 2.2 * lq or lq > 2.2 * le: continue
            d = dtw(q, e, self.band) + 0.15 * abs(math.log(lq / le))
            if d < best: best = d
        return best

    def cohort_dist(self, q, k=8):
        ds = []
        lq = q.shape[0]
        for e in self.cohort:
            le = e.shape[0]
            ds.append(dtw(q, e, self.band) + 0.15 * abs(math.log(lq / le)))
        if not ds: return 1e9
        ds.sort()
        return float(np.mean(ds[:k]))
