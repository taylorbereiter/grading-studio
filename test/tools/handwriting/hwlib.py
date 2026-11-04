# Shared pieces for the handwriting name finder experiment:
# the alphabet, image normalisation, made-up text, font rendering with "messy" augmentation.
import os, re, json, random, unicodedata, math, glob
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

H = 32                      # model input height
MAXW = 640                  # widest input the model sees in training

# Case-folded alphabet. Index 0 is the CTC blank.
SYMS = " abcdefghijklmnopqrstuvwxyz0123456789.,'\"-:;!?()/&@#%+=*~"
BLANK = 0
C = len(SYMS) + 1
IDX = {ch: i + 1 for i, ch in enumerate(SYMS)}
OTHER = IDX['~']

def fold(s):
    """Lower-case, strip accents, map look-alike quotes and dashes."""
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('–', '-').replace('—', '-')
    s = s.replace('ß', 'ss').replace('æ', 'ae').replace('Æ', 'AE').replace('ø', 'o').replace('Ø', 'O').replace('ı', 'i').replace('ł', 'l').replace('Ł', 'L').replace('đ', 'd').replace('Đ', 'D')
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower()

def encode(text):
    t = fold(text)
    t = re.sub(r'\s+', ' ', t).strip()
    return [IDX.get(ch, OTHER) for ch in t]

def decode(ids):
    return ''.join(SYMS[i - 1] for i in ids if i > 0)

def to_model(gray, h=H):
    """Grey uint8 crop (dark ink on light paper) -> float32 [h, w] with ink near 1, paper near 0."""
    g = gray.astype(np.float32)
    if g.ndim == 3: g = g.mean(2)
    hh, ww = g.shape
    w = max(4, int(round(ww * h / max(hh, 1))))
    w = min(w, MAXW * 2)
    g = cv2.resize(g, (w, h), interpolation=cv2.INTER_AREA if hh > h else cv2.INTER_LINEAR)
    x = 255.0 - g
    lo = np.percentile(x, 20); hi = np.percentile(x, 99.5)
    x = (x - lo) / max(hi - lo, 24.0)
    return np.clip(x, 0, 1).astype(np.float32)

# ---------------------------------------------------------------- made-up text
class TextSource:
    def __init__(self, words_path, names_path, seed=None):
        self.rng = random.Random(seed)
        self.words = [w.strip() for w in open(words_path, encoding='utf-8') if w.strip() and "'" not in w]
        self.common = [w for w in self.words if len(w) <= 8]
        names = [fold(n.strip()) for n in open(names_path, encoding='utf-8') if n.strip()]
        self.names = [n for n in names if re.fullmatch(r"[a-z][a-z'\-]*", n) and len(n) >= 2]
        self.syl_on = ['', 'b', 'ch', 'd', 'f', 'g', 'h', 'j', 'k', 'kh', 'l', 'm', 'n', 'ng', 'p', 'ph', 'r', 's', 'sh', 't', 'th', 'v', 'w', 'y', 'z', 'br', 'tr', 'kr', 'st', 'zh', 'x', 'q']
        self.syl_v = ['a', 'e', 'i', 'o', 'u', 'aa', 'ai', 'ao', 'ia', 'ie', 'ou', 'ee', 'oo', 'ya', 'ua', 'ei']
        self.syl_end = ['', '', '', 'n', 'ng', 'm', 'r', 's', 't', 'k', 'l', 'h', 'rn', 'nt', 'p']

    def pseudo_name(self):
        r = self.rng
        s = ''.join(r.choice(self.syl_on) + r.choice(self.syl_v) + r.choice(self.syl_end) for _ in range(r.choice([1, 2, 2, 3, 3, 4])))
        return s[:14] or 'ana'

    def case(self, w, p_cap=0.3, p_up=0.08):
        u = self.rng.random()
        if u < p_up: return w.upper()
        if u < p_up + p_cap: return w[:1].upper() + w[1:]
        return w

    def name(self):
        r = self.rng
        n = r.choice(self.names) if r.random() < 0.8 else self.pseudo_name()
        if '-' in n and r.random() < 0.5: n = n.replace('-', ' ')
        return self.case(n, p_cap=0.8, p_up=0.12)

    def word(self):
        r = self.rng
        w = r.choice(self.common) if r.random() < 0.6 else r.choice(self.words)
        w = self.case(w)
        if r.random() < 0.12: w += r.choice(list('.,;:!?'))
        return w

    def number(self):
        r = self.rng
        k = r.randrange(9)
        if k == 0: return '%d/%d/%s' % (r.randint(1, 31), r.randint(1, 12), r.choice(['24', '25', '2024', '2025', '2026']))
        if k == 1: return '%s/%d' % (r.choice(['10', '9.5', '11', '7', '12', '8.5', '15', '20']), r.choice([12, 15, 20, 10, 24]))
        if k == 2: return '%d%%' % r.randint(40, 100)
        if k == 3: return 'p. %d' % r.randint(1, 300)
        if k == 4: return '%d%s-%d' % (r.randint(6, 13), r.choice(['A', 'B', 'C', 'EL', 'MA', 'SC', '']), r.randint(1, 4))
        if k == 5: return 'Q%d' % r.randint(1, 20)
        if k == 6: return str(r.randint(0, 99999))
        if k == 7: return '(%s)' % r.choice(['a', 'b', 'c', 'i', 'ii', 'iii', '1', '2', '3'])
        return '#%d' % r.randint(1, 40)

    def sample(self):
        r = self.rng; u = r.random()
        if u < 0.30: return self.word()
        if u < 0.58: return self.name()
        if u < 0.66: return self.number()
        if u < 0.72: return self.pseudo_name().capitalize()
        # short phrase
        n = r.choice([2, 2, 3, 3, 4, 5])
        parts = []
        if r.random() < 0.15: parts.append(r.choice(['Name:', 'Name', 'NAME:', 'name:', 'By', 'by', 'From:', 'Student:', 'Signed']))
        for _ in range(n):
            v = r.random()
            parts.append(self.name() if v < 0.35 else self.number() if v < 0.42 else self.word())
        return ' '.join(parts)

# ---------------------------------------------------------------- fonts
ORNATE = set('''Aguafina_Script Alex_Brush Allison Allura Are_You_Serious Arizonia Babylonica Ballet Beau_Rivage Berkshire_Swash
Bilbo_Swash_Caps Birthstone_Bounce Bonbon Bonheur_Royale Butterfly_Kids Carattere Cherish Corinthia Dr_Sugiyama Ephesis Estonia
Explora Festive Fleur_De_Leah Grey_Qo Gwendolyn Herr_Von_Muellerhoff Imperial_Script Ingrid_Darling Inspiration Island_Moments
Italianno Kapakana League_Script Lavishly_Yours Love_Light Lovers_Quarrel Luxurious_Script Mea_Culpa Meddon Meie_Script Meow_Script
Miss_Fajardose Monsieur_La_Doulaise Mr_De_Haviland Mrs_Saint_Delafield Ms_Madi My_Soul Neonderthaw Ole Passions_Conflict Petemoss
Petit_Formal_Script Pinyon_Script Princess_Sofia Puppies_Play Qwitcher_Grypen Rouge_Script Ruge_Boogie Ruthie Sassy_Frass Send_Flowers
Splash Tangerine Twinkle_Star Updock Vujahday_Script Waterfall Whisper WindSong Great_Vibes Parisienne Sacramento Hurricane Comforter
Comforter_Brush Licorice Moon_Dance MonteCarlo Style_Script Water_Brush Clicker_Script Fuggles Romanesco Kolker_Brush Lugrasimo
Lumanosimo Yuji_Hentaigana_Akari Yuji_Hentaigana_Akebono Amatic_SC Delius_Unicase Patrick_Hand_SC'''.split())
SKIP = {'Edu_AU_VIC_WA_NT_Arrows', 'Edu_AU_VIC_WA_NT_Dots', 'Edu_AU_VIC_WA_NT_Guides', 'Betania_Patmos_GDL', 'Betania_Patmos_In_GDL'}
# Whole families held out for scoring. None of these is ever used in training.
TEST_FAMILIES = ['Edu_', 'Indie_Flower', 'Gloria_Hallelujah', 'Shadows_Into_Light', 'Reenie_Beanie', 'Nothing_You_Could_Do',
                 'Homemade_Apple', 'Cedarville_Cursive', 'La_Belle_Aurore', 'Dawning_of_a_New_Day', 'Kalam', 'Sue_Ellen_Francisco',
                 'Coming_Soon', 'Schoolbell', 'Over_the_Rainbow', 'Zeyada', 'Mali', 'Just_Me_Again_Down_Here']

def font_split(font_dir):
    paths = sorted(glob.glob(os.path.join(font_dir, '*.ttf')))
    train, test = [], []
    for p in paths:
        n = os.path.basename(p)[:-4]
        if n in SKIP: continue
        (test if any(n.startswith(f) for f in TEST_FAMILIES) else train).append(p)
    return train, test

def font_weights(paths):
    return [0.35 if os.path.basename(p)[:-4] in ORNATE else 1.0 for p in paths]

_font_cache = {}
def get_font(path, size):
    k = (path, size)
    f = _font_cache.get(k)
    if f is None:
        if len(_font_cache) > 4000: _font_cache.clear()
        f = _font_cache[k] = ImageFont.truetype(path, size)
    return f

# ---------------------------------------------------------------- rendering
def _elastic(img, rng, amp, sigma):
    h, w = img.shape
    dx = cv2.GaussianBlur((rng.random((h, w)).astype(np.float32) * 2 - 1), (0, 0), sigma)
    dy = cv2.GaussianBlur((rng.random((h, w)).astype(np.float32) * 2 - 1), (0, 0), sigma)
    m = max(np.abs(dx).max(), np.abs(dy).max(), 1e-6)
    dx *= amp / m; dy *= amp / m
    xs, ys = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    return cv2.remap(img, xs + dx, ys + dy, cv2.INTER_LINEAR, borderValue=0)

def writer_style(rng, size):
    return dict(sw=int(rng.choice([0, 0, 0, 1, 1, 2])) if size > 44 else int(rng.choice([0, 0, 1])),
                sh=rng.normal(0, 0.18), sx=rng.uniform(0.85, 1.15), sy=rng.uniform(0.85, 1.12),
                jit=rng.random() < 0.55, el=rng.random() < 0.6, thin=rng.random())

def render_ink(text, font_path, rng, size=None, jitter=True, style=None):
    """Return float32 ink map (0 paper .. 1 ink) of text in the font, with per-letter wobble, slant and warping."""
    size = size or int(rng.integers(40, 72))
    st = style or writer_style(rng, size)
    font = get_font(font_path, size)
    pad = size
    est_w = int(font.getlength(text) * 1.4) + 2 * pad + 10
    canvas = Image.new('L', (max(est_w, 40), size * 3), 0)
    d = ImageDraw.Draw(canvas)
    sw = st['sw']
    if jitter and st['jit']:
        x = pad
        base = size
        for ch in text:
            dy = rng.normal(0, size * 0.035)
            d.text((x, base + dy), ch, font=font, fill=255, anchor='ls', stroke_width=sw, stroke_fill=255)
            adv = font.getlength(ch)
            x += adv * rng.uniform(0.9, 1.12) + (rng.normal(0, size * 0.05) if ch != ' ' else rng.uniform(0, size * 0.5))
    else:
        d.text((pad, size), text, font=font, fill=255, anchor='ls', stroke_width=sw, stroke_fill=255)
    a = np.asarray(canvas, np.float32) / 255.0
    ys, xs = np.nonzero(a > 0.05)
    if len(xs) == 0: return None
    a = a[max(0, ys.min() - 4): ys.max() + 5, max(0, xs.min() - 4): xs.max() + 5]
    h, w = a.shape
    # slant, small rotation, squash
    if style is None:
        sh, sx, sy = st['sh'], st['sx'], st['sy']
    else:
        sh = st['sh'] + rng.normal(0, 0.03); sx = st['sx'] * rng.uniform(0.97, 1.03); sy = st['sy'] * rng.uniform(0.97, 1.03)
    rot = rng.normal(0, 1.5) * math.pi / 180
    M = np.array([[sx * math.cos(rot), -math.sin(rot) + sh, 0], [math.sin(rot), sy * math.cos(rot), 0]], np.float32)
    corners = np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], np.float32) @ M.T
    mn = corners.min(0); mx = corners.max(0)
    M[:, 2] -= mn
    a = cv2.warpAffine(a, M, (int(mx[0] - mn[0]) + 2, int(mx[1] - mn[1]) + 2), flags=cv2.INTER_LINEAR, borderValue=0)
    if st['el']:
        a = _elastic(a, rng, amp=rng.uniform(0.6, 2.2) * size / 40, sigma=rng.uniform(4, 9) * size / 40)
    k = st['thin'] if style is not None else rng.random()
    if k < 0.15: a = cv2.erode(a, np.ones((2, 2), np.uint8))
    elif k < 0.3: a = cv2.dilate(a, np.ones((2, 2), np.uint8))
    return np.clip(a, 0, 1)

def paper(ink, rng, ruled=None):
    """Put an ink map on paper: pen or pencil colour, uneven paper, maybe ruled lines, then blur/noise/jpeg. Returns uint8 grey."""
    h, w = ink.shape
    bg = rng.uniform(175, 252)
    paper_img = np.full((h, w), bg, np.float32)
    if rng.random() < 0.5:   # lighting gradient
        gx = np.linspace(0, 1, w, dtype=np.float32)[None, :] * rng.normal(0, 25)
        gy = np.linspace(0, 1, h, dtype=np.float32)[:, None] * rng.normal(0, 25)
        paper_img += gx + gy
    if ruled is None: ruled = rng.random() < 0.3
    if ruled:
        lv = bg - rng.uniform(25, 80)
        gap = rng.uniform(0.45, 0.9) * h
        y = rng.uniform(0.55, 0.95) * h
        while y > 0:
            yy = int(y); paper_img[max(0, yy - 1): yy + 1, :] = lv
            y -= gap
    inkv = rng.uniform(10, 70) if rng.random() < 0.75 else rng.uniform(70, 140)   # pen or pencil
    a = ink * rng.uniform(0.75, 1.0)
    img = paper_img * (1 - a) + inkv * a
    img += rng.normal(0, rng.uniform(1, 9), img.shape)
    if rng.random() < 0.5:
        img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.3, 1.2))
    img = np.clip(img, 0, 255).astype(np.uint8)
    if rng.random() < 0.35:
        q = int(rng.integers(25, 90))
        img = cv2.imdecode(cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, q])[1], cv2.IMREAD_GRAYSCALE)
    if rng.random() < 0.1:   # black and white scan
        t = int(np.clip((bg + inkv) / 2 + rng.normal(0, 10), 60, 220))
        img = np.where(img < t, 0, 255).astype(np.uint8)
    return img

def neighbours(ink, rng, other_ink):
    """Bits of the lines above and below poking into the crop, as on a real page."""
    h, w = ink.shape
    out = ink.copy()
    for where in ('top', 'bottom'):
        if rng.random() < 0.25 and other_ink is not None:
            o = other_ink
            oh, ow = o.shape
            take = int(h * rng.uniform(0.08, 0.25))
            if oh <= take: continue
            piece = o[oh - take:, :] if where == 'top' else o[:take, :]
            x0 = int(rng.integers(-ow // 2, max(1, w - ow // 2)))
            xa, xb = max(0, x0), min(w, x0 + ow)
            if xb <= xa: continue
            seg = piece[:, xa - x0: xb - x0]
            if where == 'top': out[:take, xa:xb] = np.maximum(out[:take, xa:xb], seg)
            else: out[h - take:, xa:xb] = np.maximum(out[h - take:, xa:xb], seg)
    return out

def synth_sample(text, font_path, rng, other_ink=None):
    ink = render_ink(text, font_path, rng)
    if ink is None: return None
    h, w = ink.shape
    # padding like a word box drawn by a person or a line finder
    pt, pb = int(rng.uniform(0.0, 0.25) * h), int(rng.uniform(0.0, 0.25) * h)
    pl, pr = int(rng.uniform(0, 0.4) * h), int(rng.uniform(0, 0.4) * h)
    ink = np.pad(ink, ((pt, pb), (pl, pr)))
    ink = neighbours(ink, rng, other_ink)
    return paper(ink, rng)
