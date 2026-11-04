# Made-up scanned student pages for scoring, written in the HELD-OUT fonts only.
# Each page has a made-up student's name in one of the usual spots (Name: line on a worksheet, top line of lined paper,
# top corner, or signed at the end), handwritten answers, and sometimes a classmate's name in the writing.
# Usage: python -I make_pages.py <n_pages> <seed> <out.pkl>
import sys, os, re, pickle, math, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib
from fontTools.ttLib import TTFont

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
n_pages, seed, outp = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
rng = np.random.default_rng(seed); rr = random.Random(seed)
_, test_fonts = hwlib.font_split(os.path.join(W, 'fonts'))
cmaps = {p: set(chr(c) for c in (TTFont(p, lazy=True).getBestCmap() or {})) for p in test_fonts}
allwords = [w.strip() for w in open(os.path.join(W, 'data/lists/words.txt')) if w.strip() and "'" not in w]
common = [w for w in allwords if len(w) <= 9]
commonset = set(allwords)
names = [hwlib.fold(n.strip()) for n in open(os.path.join(W, 'data/lists/names.txt'))]
names = [n for n in names if re.fullmatch(r'[a-z]{2,11}', n) and n not in commonset]
rr.shuffle(names)
first_pool, last_pool = names[:4000], names[4000:8000]
PRINT = ImageFont.load_default(size=26)
PRINT_SMALL = ImageFont.load_default(size=22)
PW, PH = 1240, 1754      # A4 at 150 dpi
QUESTIONS = ['1. Explain what the writer means in the first paragraph.', '2. Give two examples from the text.',
             '3. How does the character change by the end?', '4. Describe the method you used.',
             '5. What would you do differently next time?', 'Reflection: what did you learn this week?']

def sentence(k):
    ws = [rr.choice(common) for _ in range(k)]
    ws[0] = ws[0].capitalize()
    return ws

STYLE = {}
def hand_word(text, font, size):
    return hwlib.render_ink(text, font, rng, size=size, jitter=True, style=STYLE['s'])

class Page:
    def __init__(self):
        self.ink = np.zeros((PH, PW), np.float32)       # handwriting ink
        self.printed = Image.new('L', (PW, PH), 0)      # printed ink
        self.pd = ImageDraw.Draw(self.printed)
        self.words = []                                  # dict(text, box, kind)
        self.rules = []

    def put(self, ink, x, base, text, kind):
        h, w = ink.shape
        ys = np.nonzero(ink.max(1) > 0.2)[0]
        # put the word so that its lower ink edge (roughly the baseline, ignoring descenders) sits on `base`
        y = int(base - h * 0.78)
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(PW, x + w), min(PH, y + h)
        if x1 <= x0 or y1 <= y0: return None
        self.ink[y0:y1, x0:x1] = np.maximum(self.ink[y0:y1, x0:x1], ink[y0 - y: y1 - y, x0 - x: x1 - x])
        sub = ink[y0 - y: y1 - y, x0 - x: x1 - x] > 0.25
        yy, xx = np.nonzero(sub)
        if len(xx) == 0: return None
        box = [int(x0 + xx.min()), int(y0 + yy.min()), int(x0 + xx.max()), int(y0 + yy.max())]
        self.words.append(dict(text=text, box=box, kind=kind))
        return box

    def write_line(self, words, x, base, font, size, kinds=None, max_x=PW - 80):
        for i, t in enumerate(words):
            ink = hand_word(t, font, size)
            if ink is None: continue
            if x + ink.shape[1] > max_x: return x, False
            self.put(ink, x, base + int(rng.normal(0, size * 0.04)), t, (kinds[i] if kinds else 'body'))
            x += ink.shape[1] + int(size * rng.uniform(0.35, 0.8))
        return x, True

def make_page(i):
    font = rr.choice(test_fonts)
    first = rr.choice(first_pool); last = rr.choice(last_pool)
    First, Last = first.capitalize(), last.capitalize()
    if rr.random() < 0.15: First, Last = First.upper(), Last.upper()
    mates = [(rr.choice(first_pool).capitalize(), rr.choice(last_pool).capitalize()) for _ in range(2)]
    size = int(rng.integers(32, 52))           # font size in pixels at 150 dpi
    STYLE['s'] = hwlib.writer_style(rng, size)
    layout = rr.choice(['worksheet', 'worksheet', 'lined', 'corner', 'signed'])
    P = Page()
    gap = int(size * rng.uniform(1.25, 1.6))
    def name_words():
        u = rr.random()
        if u < 0.65: return [First, Last]
        if u < 0.85: return [First]
        return [First, Last[0] + '.']
    own = name_words()
    if layout == 'worksheet':
        P.pd.text((80, 70), 'Name:', font=PRINT, fill=255); P.pd.line((160, 98, 640, 98), fill=200, width=2)
        P.pd.text((680, 70), 'Class:', font=PRINT, fill=255); P.pd.line((760, 98, 900, 98), fill=200, width=2)
        P.pd.text((930, 70), 'Date:', font=PRINT, fill=255); P.pd.line((1000, 98, 1170, 98), fill=200, width=2)
        P.write_line(own, 180, 94, font, size, ['own'] * len(own))
        P.write_line([rr.choice(['11B', '10-2', '9C', '12A', 'Y10'])], 780, 94, font, size)
        P.write_line(['%d/%d' % (rr.randint(1, 28), rr.randint(1, 12))], 1010, 94, font, size)
        y = 190
        for q in rr.sample(QUESTIONS, 3):
            P.pd.text((80, y), q, font=PRINT_SMALL, fill=255); y += 50
            for _ in range(rr.randint(2, 4)):
                P.rules.append(y + gap // 2); y += gap
                P.write_line(sentence(14), 90, y - gap // 2, font, size)
            y += 30
    else:
        lined = layout == 'lined' or rr.random() < 0.5
        y0 = int(rng.integers(90, 150))
        if lined:
            yy = y0
            while yy < PH - 60: P.rules.append(yy); yy += gap
        y = y0
        if layout in ('lined', 'signed'):
            if layout == 'lined':
                bits = own + ([rr.choice(['11B', '10-2', '9C'])] if rr.random() < 0.4 else [])
                P.write_line(bits, 90, y, font, size, ['own'] * len(own) + ['body'] * (len(bits) - len(own)))
                y += gap
            title = sentence(rr.randint(2, 4))
            P.write_line([t.capitalize() for t in title], 300, y, font, size); y += gap
        else:   # corner
            P.write_line(own, PW - 120 - int(size * 3.2 * len(own)), y, font, size, ['own'] * len(own)); y += gap
            P.write_line(['%d/%d/%d' % (rr.randint(1, 28), rr.randint(1, 12), 2025)], PW - 400, y, font, size); y += gap
        lines = rr.randint(8, 16)
        for k in range(lines):
            ws = sentence(14)
            kinds = None
            if rr.random() < 0.12:   # a classmate's name in the writing
                m = rr.choice(mates)
                j = rr.randrange(2, 8)
                ws = ws[:j] + [m[0]] + ws[j:]
                kinds = ['body'] * j + ['mate'] + ['body'] * (len(ws) - j - 1)
            P.write_line(ws, 90 + (int(size * 1.5) if k == 0 else 0), y, font, size, kinds)
            y += gap
            if y > PH - 3 * gap: break
        if layout == 'signed':
            sig = own if rr.random() < 0.6 else [First]
            words = (['-'] if rr.random() < 0.3 else []) + sig
            kinds = ['body'] * (len(words) - len(sig)) + ['own'] * len(sig)
            P.write_line(words, max(90, PW - 160 - int(size * 3 * len(sig))), min(PH - 60, y + gap // 2), font, size, kinds)
    # paper
    bg = rng.uniform(205, 250)
    img = np.full((PH, PW), bg, np.float32)
    img += np.linspace(0, 1, PW, dtype=np.float32)[None, :] * rng.normal(0, 12) + np.linspace(0, 1, PH, dtype=np.float32)[:, None] * rng.normal(0, 12)
    for r in P.rules: img[r - 1:r + 1, 40:PW - 40] = bg - rng.uniform(30, 70)
    pr = np.asarray(P.printed, np.float32) / 255
    img = img * (1 - pr) + 30 * pr
    inkv = rng.uniform(15, 60) if rng.random() < 0.7 else rng.uniform(70, 130)
    a = P.ink * rng.uniform(0.8, 1.0)
    img = img * (1 - a) + inkv * a
    img += rng.normal(0, rng.uniform(2, 7), img.shape)
    if rng.random() < 0.6: img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.4, 1.0))
    img = np.clip(img, 0, 255).astype(np.uint8)
    ang = rng.normal(0, 0.6)
    M = cv2.getRotationMatrix2D((PW / 2, PH / 2), ang, 1.0)
    img = cv2.warpAffine(img, M, (PW, PH), borderValue=int(bg))
    for w in P.words:
        x0, y0, x1, y1 = w['box']
        pts = np.array([[x0, y0, 1], [x1, y0, 1], [x0, y1, 1], [x1, y1, 1]], np.float32) @ M.T
        w['box'] = [int(pts[:, 0].min()), int(pts[:, 1].min()), int(pts[:, 0].max()), int(pts[:, 1].max())]
    if rng.random() < 0.4:
        img = cv2.imdecode(cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, int(rng.integers(40, 85))])[1], cv2.IMREAD_GRAYSCALE)
    roster_first = [First] + [m[0] for m in mates]
    return dict(id=i, font=os.path.basename(font)[:-4], layout=layout, page=img, words=P.words,
                student=(First, Last), mates=mates)

pages = [make_page(i) for i in range(n_pages)]
pickle.dump(pages, open(outp, 'wb'), protocol=4)
print(len(pages), 'pages', sum(len(p['words']) for p in pages), 'words', 'layouts', {l: sum(p['layout'] == l for p in pages) for l in set(p['layout'] for p in pages)})
