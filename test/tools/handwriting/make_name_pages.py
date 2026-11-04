# Real-handwriting name pages. GNHK has no student names, so two real words from a page stand in for the student's
# first and last name, written by that same writer. They are lifted off the page (their old spot is painted over
# with paper) and put where a name goes: after a printed "Name:" label, on the top line, in the top corner, or signed
# at the end. The rest of the page stays as it was photographed.
# Usage: python -I make_name_pages.py <val|test> <seed> <out.pkl> [layouts_per_page]
import sys, os, re, pickle, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib, find_names

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
split, seed, outp = sys.argv[1], int(sys.argv[2]), sys.argv[3]
per = int(sys.argv[4]) if len(sys.argv) > 4 else 2
pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_test.pkl' if split == 'test' else 'data/prep/gnhk_train.pkl'), 'rb'))
if split != 'test': pages = pages[::13]
rr = random.Random(seed); rng = np.random.default_rng(seed)
STOP = set('the and for that this with you your are was were have has had not but all any can our out one two who his her him she they them their there then than what when where which will would could should from into onto upon also just like very more most some such only over under about after before again here these those been being does did done each other same both few many much own off how why too its let lets may might must shall yes now new old get got way day use used'.split())
LAYOUTS = ['label', 'plain', 'corner', 'signed']

def lift(page, q, paper):
    """Cut a word out along its outline: (picture with paper outside the outline, mask, top-left corner)."""
    H, Wd = page.shape
    x0, y0 = max(0, int(q[:, 0].min()) - 4), max(0, int(q[:, 1].min()) - 4)
    x1, y1 = min(Wd, int(q[:, 0].max()) + 5), min(H, int(q[:, 1].max()) + 5)
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.fillPoly(m, [(q - [x0, y0]).astype(np.int32)], 1)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    c = page[y0:y1, x0:x1].astype(np.float32)
    # its own paper, shadows and all, brought to the band's paper: divide by the local paper brightness
    k = max(9, (y1 - y0) // 3) | 1
    bg = cv2.GaussianBlur(cv2.dilate(c, np.ones((k, k), np.uint8)), (0, 0), k / 3)
    c = np.clip(c / np.maximum(bg, 1) * paper, 0, 255)
    c[m == 0] = paper
    return c, m, (x0, y0)

def make(p, layout, words):
    page = p['page']
    paper = float(np.percentile(page, 90))
    cuts = []
    hole = np.zeros(page.shape, np.uint8)
    for w in words:
        q = np.array(w['quad'], np.float32) * p['scale']
        c, m, (x0, y0) = lift(page, q, paper)
        cuts.append((c, m))
        hole[y0:y0 + m.shape[0], x0:x0 + m.shape[1]] |= m
    # fill the old spots from the paper around them
    body = cv2.inpaint(page, cv2.dilate(hole, np.ones((5, 5), np.uint8)), 7, cv2.INPAINT_TELEA).astype(np.float32)
    hmax = max(c.shape[0] for c, m in cuts)
    gap = int(0.35 * hmax)
    band_h = int(hmax * rr.uniform(2.0, 2.8))
    H, Wd = page.shape
    band = np.full((band_h, Wd), paper, np.float32) + rng.normal(0, 2, (band_h, Wd))
    total_w = sum(c.shape[1] for c, m in cuts) + gap * (len(cuts) - 1)
    base = int(band_h * 0.72)
    printed = []
    if layout == 'label':
        size = max(14, int(hmax * 0.55))
        F = ImageFont.load_default(size=size)
        im = Image.fromarray(np.zeros((band_h, Wd), np.uint8)); d = ImageDraw.Draw(im)
        lx = int(Wd * rr.uniform(0.04, 0.08))
        d.text((lx, base), 'Name:', font=F, fill=255, anchor='ls')
        x = lx + int(d.textlength('Name:', font=F)) + int(size * 0.6)
        d.line((x - 4, base + 4, min(Wd - 20, x + total_w + int(size * 3)), base + 4), fill=200, width=2)
        if rr.random() < 0.6:
            cx = min(Wd - int(size * 9), x + total_w + int(size * 4))
            if cx > x + total_w:
                d.text((cx, base), rr.choice(['Class:', 'Date:', 'Period:']), font=F, fill=255, anchor='ls')
        pr = np.asarray(im, np.float32) / 255
        band = band * (1 - pr) + 30 * pr
        start = x
    elif layout == 'plain':
        start = int(Wd * rr.uniform(0.04, 0.1))
    elif layout == 'corner':
        start = max(10, Wd - total_w - int(Wd * rr.uniform(0.04, 0.1)))
    else:   # signed: the band goes under the page
        start = max(10, Wd - total_w - int(Wd * rr.uniform(0.05, 0.2)))
    # a name always fits on the paper: write it smaller if it would run off the edge, give up if far too long
    avail = Wd - 15 - start
    if total_w > avail:
        f = avail / total_w
        if f < 0.6: return None
        cuts = [(cv2.resize(c, (max(1, int(c.shape[1] * f)), max(1, int(c.shape[0] * f))), interpolation=cv2.INTER_AREA),
                 cv2.resize(m, (max(1, int(m.shape[1] * f)), max(1, int(m.shape[0] * f))), interpolation=cv2.INTER_NEAREST)) for c, m in cuts]
        gap = int(gap * f)
    boxes, masks = [], []
    x = start
    for c, m in cuts:
        h, w = c.shape
        y = base - int(h * 0.8) + int(rng.normal(0, 2))
        y = max(0, min(band_h - h, y)); w2 = min(w, Wd - x)
        if w2 <= 0: return None
        band[y:y + h, x:x + w2] = np.minimum(band[y:y + h, x:x + w2], c[:, :w2])
        boxes.append([x, y, x + w2 - 1, y + h - 1]); masks.append((m[:, :w2], x, y))
        x += w + gap
    if layout == 'signed':
        out = np.vstack([body, band]); off = H
    else:
        out = np.vstack([band, body]); off = 0
    out = np.clip(out, 0, 255).astype(np.uint8)
    bw = find_names.binarize(out)
    gt = []
    for (m, mx, my), b, w in zip(masks, boxes, words):
        yy = my + off
        sub = bw[yy:yy + m.shape[0], mx:mx + m.shape[1]] & (m > 0)
        ys, xs = np.nonzero(sub)
        k = max(1, len(xs) // 400)
        gt.append(dict(text=hwlib.fold(w['text']), box=[b[0], b[1] + off, b[2], b[3] + off], kind='own',
                       ink=[[int(a + mx), int(c + yy)] for a, c in zip(xs[::k], ys[::k])]))
    return out, gt

out = []
for p in pages:
    hw = [w for w in p['words'] if w['type'] == 'H']
    count = {}
    for w in hw: count[hwlib.fold(w['text'])] = count.get(hwlib.fold(w['text']), 0) + 1
    good = [w for w in hw if re.fullmatch(r'[A-Za-z]{3,12}', w['text']) and hwlib.fold(w['text']) not in STOP and count[hwlib.fold(w['text'])] == 1]
    if len(good) < 2: continue
    for layout in rr.sample(LAYOUTS, per):
        words = rr.sample(good, 2)
        r = make(p, layout, words)
        if r is None: continue
        img, gt = r
        if any(len(g['ink']) < 10 for g in gt): continue
        out.append(dict(id=len(out), page_file=p['file'], layout=layout, page=img, words=gt,
                        student=(words[0]['text'], words[1]['text']), mates=[], font='gnhk'))
pickle.dump(out, open(outp, 'wb'), protocol=4)
print(len(out), 'pages', {l: sum(o['layout'] == l for o in out) for l in LAYOUTS})
