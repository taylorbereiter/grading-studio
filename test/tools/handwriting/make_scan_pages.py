# Scan-style test pages with real handwriting, built like the pages a teacher scans: lined notebook paper with an
# essay, and printed test papers with a "Name" line and answer lines. The handwriting is real. Every handwritten word
# of one GNHK page is lifted off its photo (shading flattened, ink re-toned as pen or pencil) and written again in
# reading order on the new paper. Two of that writer's words stand in for the student's first and last name and go
# where the page puts a name. Some pages are a second page of an essay, with no name on them. Then a scanner pass:
# slight tilt, blur, noise and size change, sometimes black-and-white copier mode, JPEG, a lid shadow, show-through.
# Usage: python -I make_scan_pages.py <val|test> <seed> <out.pkl> [layouts_per_page]
import sys, os, re, glob, pickle, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib, find_names

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
split, seed, outp = sys.argv[1], int(sys.argv[2]), sys.argv[3]
per = int(sys.argv[4]) if len(sys.argv) > 4 else 2
pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_test.pkl' if split == 'test' else 'data/prep/gnhk_train.pkl'), 'rb'))
if split != 'test': pages = pages[::13]      # GNHK training pages kept out of the reader's training
rr = random.Random(seed); rng = np.random.default_rng(seed)
STOP = set('the and for that this with you your are was were have has had not but all any can our out one two who his her him she they them their there then than what when where which will would could should from into onto upon also just like very more most some such only over under about after before again here these those been being does did done each other same both few many much own off how why too its let lets may might must shall yes now new old get got way day use used'.split())
PW, PH = 1240, 1754            # A4 at 150 dpi
LAYOUTS = {'essay_top': 3, 'essay_corner': 2, 'notebook_label': 1, 'test_label': 3, 'test_right': 1, 'signed': 1, 'cont': 1}
FD = '/usr/share/fonts/truetype/'
FACES = [(FD + 'crosextra/Carlito-Regular.ttf', FD + 'crosextra/Carlito-Bold.ttf'),
         (FD + 'crosextra/Caladea-Regular.ttf', FD + 'crosextra/Caladea-Bold.ttf'),
         (FD + 'liberation/LiberationSans-Regular.ttf', FD + 'liberation/LiberationSans-Bold.ttf'),
         (FD + 'liberation/LiberationSerif-Regular.ttf', FD + 'liberation/LiberationSerif-Bold.ttf'),
         (FD + 'dejavu/DejaVuSans.ttf', FD + 'dejavu/DejaVuSans-Bold.ttf')]
TITLES = ['Unit 3 Test', 'Chapter 5 Quiz', 'Reading Check', 'Short Answer Assessment', 'Vocabulary Quiz', 'Lab Report',
          'Midterm Review', 'History Test: Causes of WWI', 'Biology Quiz 4', 'Poetry Response', 'English 10 Final Exam']
HEADERS = [['Name:', 'Date:', 'Period:'], ['Name', 'Class'], ['NAME:', 'DATE:'], ['Student Name:'], ['Name:', 'Block:'],
           ['Name:', 'Teacher:', 'Date:']]
QUESTIONS = ['1. Explain what the writer means in the first paragraph.', '2. Give two examples from the text to support your answer.',
             '3. How does the main character change by the end of the story?', '4. Describe the method you used in the experiment.',
             '5. What would you do differently next time? Explain.', '6. Name two causes of the war and explain one of them.',
             '7. Summarize the article in your own words.', '8. Why did the author choose this title?',
             '9. Compare the two poems. How are they alike?', '10. What evidence supports the claim? Use the data table.',
             '11. In complete sentences, describe the setting.', '12. What is the main idea of the passage?']
INSTR = ['Answer each question in complete sentences.', 'Read each question carefully. Show your work.',
         'Use evidence from the text in every answer.', 'Write clearly. You have 40 minutes.']

def lift_ink(page, q):
    """A word cut out along its outline as ink strength (0 paper .. 1 darkest stroke), with its outline mask."""
    H, Wd = page.shape
    x0, y0 = max(0, int(q[:, 0].min()) - 4), max(0, int(q[:, 1].min()) - 4)
    x1, y1 = min(Wd, int(q[:, 0].max()) + 5), min(H, int(q[:, 1].max()) + 5)
    if x1 - x0 < 6 or y1 - y0 < 6: return None
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.fillPoly(m, [(q - [x0, y0]).astype(np.int32)], 1)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    c = page[y0:y1, x0:x1].astype(np.float32)
    k = max(9, (y1 - y0) // 3) | 1
    bg = cv2.GaussianBlur(cv2.dilate(c, np.ones((k, k), np.uint8)), (0, 0), k / 3)
    a = 1 - np.clip(c / np.maximum(bg, 1), 0, 1)
    a[m == 0] = 0
    top = np.percentile(a[m > 0], 99.5)
    if top < 0.12: return None
    a = np.clip((a / top - 0.18) / 0.82, 0, 1)
    return a.astype(np.float32), m

class Sheet:
    def __init__(self):
        self.ink = np.zeros((PH, PW), np.float32)
        self.lab = np.zeros((PH, PW), np.int16)
        self.printed = Image.new('L', (PW, PH), 0)
        self.pd = ImageDraw.Draw(self.printed)
        self.rules = []       # (y, x0, x1, kind)  kind: 'blue' notebook rule, 'print' printed answer line
        self.margin = None
        self.holes = False
        self.gt = []

    def put(self, wd, x, base):
        """Write one word with its baseline on `base`. Returns its right edge, or None when it does not fit."""
        a, m = wd['a'], wd['m']
        h, w = a.shape
        y = int(base - wd['yb'] + rng.normal(0, 1.5))
        if x < 5 or y < 5 or x + w > PW - 5 or y + h > PH - 5: return None
        self.ink[y:y + h, x:x + w] = np.maximum(self.ink[y:y + h, x:x + w], a)
        if wd.get('kind'):
            gid = len(self.gt) + 1
            self.lab[y:y + h, x:x + w][m > 0] = gid
            self.gt.append(dict(text=hwlib.fold(wd['text']), kind=wd['kind'], id=gid))
        return x + w

    def flow(self, words, x0, x1, bases, gap, indent=0):
        """Write words in order on the baselines, wrapping at x1. Returns (baselines used, words written)."""
        i = k = 0; x = x0 + indent
        while i < len(words) and k < len(bases):
            wd = words[i]
            if x + wd['a'].shape[1] > x1:
                if x <= x0 + indent: i += 1; continue      # wider than the whole line
                k += 1; x = x0; continue
            r = self.put(wd, x, bases[k])
            i += 1
            if r is not None: x = r + int(gap * rr.uniform(0.75, 1.3))
        return min(k + 1, len(bases)), i

    def text(self, xy, s, font, anchor='ls'):
        self.pd.text(xy, s, font=font, fill=255, anchor=anchor)
        return self.pd.textlength(s, font=font)

def scaled(wd, f):
    a, m = wd['a0'], wd['m0']
    h, w = a.shape
    nh, nw = max(4, int(round(h * f))), max(4, int(round(w * f)))
    a = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA if f < 1 else cv2.INTER_LINEAR)
    m = cv2.resize(m, (nw, nh), interpolation=cv2.INTER_NEAREST)
    ys = np.nonzero(a > 0.3)[0]
    yb = float(np.percentile(ys, 85)) + 0.03 * nh if len(ys) else 0.8 * nh
    return dict(wd, a=a, m=m, yb=yb, f=f)

def fit(name, avail, gap):
    """Write the name smaller when it would run off the paper (as a student would); None when far too long."""
    tw = sum(wd['a'].shape[1] for wd in name) + int(gap) * (len(name) - 1)
    if tw <= avail: return name
    f = avail / tw
    if f < 0.6: return None
    return [dict(scaled(wd, wd['f'] * f), kind=wd['kind']) for wd in name]

def name_width(name, gap):
    return sum(wd['a'].shape[1] for wd in name) + int(gap) * (len(name) - 1)

def write_name(S, name, x, base, gap):
    for wd in name:
        r = S.put(wd, x, base)
        if r is None: return False
        x = r + int(gap)
    return True

def header_label(S, x, base, labels, font, size, line_w):
    """Printed labels with lines to write on. Returns [(label, x_start_of_line, x_end_of_line)]."""
    out = []
    for j, t in enumerate(labels):
        tw = S.text((x, base), t, font)
        lx0 = x + int(tw) + int(size * 0.3)
        lw = line_w[j]
        S.pd.line((lx0, base + 4, lx0 + lw, base + 4), fill=255, width=2)
        out.append((t, lx0, lx0 + lw))
        x = lx0 + lw + int(size * 1.2)
    return out

def make(p, layout):
    page = p['page']
    hw = [w for w in p['words'] if w['type'] == 'H' and not w['text'].startswith('%')]
    if len(hw) < 6: return None
    count = {}
    for w in hw: count[hwlib.fold(w['text'])] = count.get(hwlib.fold(w['text']), 0) + 1
    good = [w for w in hw if re.fullmatch(r'[A-Za-z]{3,12}', w['text']) and hwlib.fold(w['text']) not in STOP and count[hwlib.fold(w['text'])] == 1]
    if len(good) < 2: return None
    first, last = rr.sample(good, 2)
    mate = None
    if rr.random() < 0.25:
        rest = [w for w in good if w is not first and w is not last]
        if rest: mate = rr.choice(rest)
    # reading order: lines top to bottom, words left to right
    by = {}
    for w in hw: by.setdefault(w['line'], []).append(w)
    lines = sorted(by.values(), key=lambda ws: np.mean([np.mean(np.array(w['quad'])[:, 1]) for w in ws]))
    seq = [w for ws in lines for w in sorted(ws, key=lambda w: np.mean(np.array(w['quad'])[:, 0]))]
    lifted = {}
    for w in seq:
        q = np.array(w['quad'], np.float32) * p['scale']
        r = lift_ink(page, q)
        if r is not None:
            lifted[w['i']] = dict(text=w['text'], a0=r[0], m0=r[1], qh=float(q[:, 1].max() - q[:, 1].min()))
    if first['i'] not in lifted or last['i'] not in lifted: return None
    qh = float(np.median([v['qh'] for v in lifted.values()]))
    test = layout.startswith('test')
    g = int(rr.uniform(46, 60)) if test else int(rr.choice([42, 51]) * rr.uniform(0.97, 1.03))
    f = g * rr.uniform(0.85, 1.1) / max(qh, 8)
    W_ = {k: scaled(v, f) for k, v in lifted.items()}
    for k in W_: W_[k]['kind'] = None
    name = [dict(W_[first['i']], kind='own'), dict(W_[last['i']], kind='own')]
    if rr.random() < 0.15: name = name[:1]            # first name only
    if layout == 'cont': name = []
    body = []
    for w in seq:
        if w is first or w is last or w['i'] not in W_: continue
        body.append(dict(W_[w['i']], kind='mate' if w is mate else None))
    # a few short words of the writer for the date / period spots (taken off the end of the writing)
    shorts = [k for k in range(len(body)) if len(body[k]['text']) <= 6 and body[k]['kind'] is None][-3:]
    extra = [body[k] for k in shorts]
    body = [b for k, b in enumerate(body) if k not in shorts]
    gap = g * rr.uniform(0.3, 0.6)
    S = Sheet()
    S.student = (first['text'], last['text'])
    reg, bold = rr.choice(FACES)
    if not test:
        top = int(rr.uniform(150, 215)); S.margin = int(rr.uniform(140, 190)); S.holes = rr.random() < 0.4
        bases = list(range(top, PH - 45, g))
        S.rules = [(y, 0, PW, 'blue') for y in bases]
        x0 = S.margin + int(rr.uniform(8, 25)); x1 = PW - int(rr.uniform(40, 90))
        k = 0      # next free baseline
        if layout in ('essay_top', 'essay_corner', 'notebook_label'):
            above = rr.random() < 0.5 and top - g > 60     # in the space above the first rule, or on it
            nb = top - int(g * rr.uniform(0.85, 1.1)) if above else bases[0]
            last_y = nb
            if layout == 'essay_top':
                nx = int(rr.uniform(45, S.margin + 30))
                name = fit(name, PW - 300 - nx, gap)
                if name is None or not write_name(S, name, nx, nb, gap): return None
                if extra and rr.random() < 0.6:
                    wd = extra.pop(0); S.put(wd, PW - int(rr.uniform(120, 260)) - wd['a'].shape[1], nb)
            elif layout == 'essay_corner':
                rm = int(rr.uniform(40, 110))
                name = fit(name, PW - rm - S.margin - 40, gap)
                if name is None or not write_name(S, name, PW - rm - name_width(name, gap), nb, gap): return None
                for _ in range(rr.choice([0, 1, 1, 2])):
                    if not extra: break
                    last_y += g; wd = extra.pop(0); S.put(wd, PW - rm - wd['a'].shape[1], last_y)
            else:
                size = int(rr.uniform(22, 28)); F = ImageFont.truetype(reg, size)
                spots = header_label(S, int(rr.uniform(60, 120)), nb, rr.choice([['Name', 'Date'], ['Name:', 'Date:', 'Period:'], ['Name', 'Class', 'Date']]),
                                     F, size, [int(rr.uniform(420, 560)), int(rr.uniform(150, 220)), int(rr.uniform(110, 160))])
                xe = spots[0][1] + int(rr.uniform(10, 40))
                nxt = spots[1][1] - int(size * 2.5) if len(spots) > 1 else PW - 20
                name = fit(name, nxt - xe, gap)
                if name is None or not write_name(S, name, xe, nb - 2, gap): return None
                for t, lx0, lx1 in spots[1:]:
                    if extra and rr.random() < 0.7: wd = extra.pop(0); S.put(wd, lx0 + 8, nb - 2)
            k = sum(1 for b in bases if b <= last_y + g // 2)
            if rr.random() < 0.5 and k + 1 < len(bases):        # a title on the next line
                tl = body[:rr.randint(1, 3)]; body = body[len(tl):]
                S.flow(tl, max(x0, (PW - name_width(tl, gap)) // 2), x1, [bases[k]], gap); k += 1
        used, n = S.flow(body, x0, x1, bases[k:len(bases) - (2 if layout == 'signed' else 0)], gap, indent=int(g * rr.uniform(0.5, 1.5)))
        k += used
        if layout == 'signed':
            rm = int(rr.uniform(60, 220))
            name = fit(name, PW - rm - x0, gap)
            if name is None or k >= len(bases): return None
            yb = bases[min(len(bases) - 1, k + rr.choice([0, 1]))]
            if not write_name(S, name, PW - rm - name_width(name, gap), yb, gap): return None
    else:
        size = int(rr.uniform(22, 27)); F = ImageFont.truetype(reg, size); FB = ImageFont.truetype(bold, int(size * rr.uniform(1.35, 1.7)))
        if layout == 'test_label':
            ty = int(rr.uniform(70, 100))
            S.text((PW // 2, ty), rr.choice(TITLES), FB, anchor='ms')
            hb = ty + int(rr.uniform(70, 100))
            labels = rr.choice(HEADERS)
            widths = [int(rr.uniform(420, 560))] + [int(rr.uniform(130, 220)) for _ in labels[1:]]
            spots = header_label(S, int(rr.uniform(60, 100)), hb, labels, F, size, widths)
        else:
            ty = int(rr.uniform(70, 100))
            S.text((int(rr.uniform(60, 100)), ty), rr.choice(TITLES), FB)
            labels = rr.choice([['Name:'], ['Name'], ['NAME:']])
            spots = header_label(S, int(rr.uniform(640, 720)), ty, labels, F, size, [int(rr.uniform(380, 440))])
            hb = ty
            if rr.random() < 0.7:
                spots += header_label(S, int(rr.uniform(640, 720)), ty + int(size * 2.2), [rr.choice(['Date:', 'Class:', 'Period:'])], F, size, [int(rr.uniform(200, 300))])
                hb = ty + int(size * 2.2)
        xe = spots[0][1] + int(rr.uniform(10, 40))
        nxt = spots[1][1] - int(size * 4) if layout == 'test_label' and len(spots) > 1 else PW - 20
        name = fit(name, nxt - xe, gap)
        if name is None or not write_name(S, name, xe, (hb if layout == 'test_label' else ty) - 2, gap): return None
        for t, lx0, lx1 in spots[1:]:
            if extra and rr.random() < 0.7: wd = extra.pop(0); S.put(wd, lx0 + 8, (hb if layout == 'test_label' else ty + int(size * 2.2)) - 2)
        y = hb + int(rr.uniform(55, 80))
        if rr.random() < 0.6:
            S.text((int(rr.uniform(60, 100)), y), rr.choice(INSTR), ImageFont.truetype(reg, int(size * 0.9))); y += int(size * 2.2)
        qx = int(rr.uniform(60, 100))
        ruled = rr.random() < 0.6
        for qtext in rr.sample(QUESTIONS, len(QUESTIONS)):
            if y > PH - 200: break
            S.text((qx, y), qtext, F); y += int(g * 1.25)
            nl = rr.randint(2, 5)
            bases = [y + j * g for j in range(nl) if y + j * g < PH - 80]
            if ruled: S.rules += [(b, qx + 10, PW - 70, 'print') for b in bases]
            if body:
                used, n = S.flow(body, qx + 15, PW - 80, bases, gap)
                body = body[n:]
            y += nl * g + int(size * 1.0)
        if rr.random() < 0.5: S.text((PW // 2, PH - 40), 'Page 1 of 2', ImageFont.truetype(reg, int(size * 0.8)), anchor='ms')
    if layout != 'cont' and not any(g_['kind'] == 'own' for g_ in S.gt): return None
    return S

def scan(S):
    paper = rr.uniform(232, 252)
    img = np.full((PH, PW), paper, np.float32)
    low = cv2.resize(rng.normal(0, 1.2, (PH // 64 + 1, PW // 64 + 1)).astype(np.float32), (PW, PH), interpolation=cv2.INTER_CUBIC)
    img += low
    rule_d = rr.uniform(30, 70); print_d = rr.uniform(90, 170); rule_t = rr.choice([1, 1, 2])
    for y, x0, x1, kind in S.rules:
        img[y:y + rule_t, x0:x1] -= rule_d if kind == 'blue' else print_d
    if S.margin:
        img[:, S.margin:S.margin + 2] -= rr.uniform(40, 80)
    if S.holes:
        dark = rr.random() < 0.5
        for fy in (0.13, 0.5, 0.87):
            c = (int(rr.uniform(38, 55)), int(PH * fy)); r = int(rr.uniform(15, 20))
            if dark: cv2.circle(img, c, r, rr.uniform(30, 80), -1)
            else: cv2.circle(img, c, r, paper - rr.uniform(40, 90), 2)
    pr = np.asarray(S.printed, np.float32) / 255
    pv = rr.uniform(15, 60)
    img = img * (1 - pr) + pv * pr
    pencil = rr.random() < 0.3
    inkv = rr.uniform(70, 130) if pencil else rr.uniform(15, 70)
    asc = rr.uniform(0.55, 0.85) if pencil else rr.uniform(0.85, 1.0)
    a = S.ink * asc
    ink_eff = paper * (1 - asc) + inkv * asc      # the darkest stroke
    if rr.random() < 0.15:     # writing from the back of the sheet showing through
        st = cv2.GaussianBlur(cv2.flip(S.ink, 1), (0, 0), 2) * rr.uniform(0.05, 0.12)
        img = img * (1 - st) + inkv * st
    img = img * (1 - a) + inkv * a
    if rr.random() < 0.2:      # the scanner lid's shadow along one edge
        wdt = int(rr.uniform(8, 40)); v = rr.uniform(40, 140); side = rr.choice('tblr')
        ramp = np.linspace(1, 0, wdt, dtype=np.float32)[:, None]
        if side == 't': img[:wdt] = img[:wdt] * (1 - ramp) + v * ramp
        elif side == 'b': img[-wdt:] = img[-wdt:] * (1 - ramp[::-1]) + v * ramp[::-1]
        elif side == 'l': img[:, :wdt] = img[:, :wdt] * (1 - ramp.T) + v * ramp.T
        else: img[:, -wdt:] = img[:, -wdt:] * (1 - ramp.T[:, ::-1]) + v * ramp.T[:, ::-1]
    img = cv2.GaussianBlur(img, (0, 0), rr.uniform(0.3, 0.9))
    ang = float(np.clip(rng.normal(0, 0.7), -2, 2))
    M = cv2.getRotationMatrix2D((PW / 2, PH / 2), ang, 1.0); M[:, 2] += rng.normal(0, 5, 2)
    img = cv2.warpAffine(img, M, (PW, PH), flags=cv2.INTER_LINEAR, borderValue=paper)
    lab = cv2.warpAffine(S.lab, M, (PW, PH), flags=cv2.INTER_NEAREST, borderValue=0)
    sc = rr.uniform(0.85, 1.25)
    size = (int(PW * sc), int(PH * sc))
    img = cv2.resize(img, size, interpolation=cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR)
    lab = cv2.resize(lab, size, interpolation=cv2.INTER_NEAREST)
    img += rng.normal(0, rr.uniform(1, 4), img.shape)
    mode = 'gray'
    if rr.random() < 0.15:     # black-and-white copier scan, its exposure set so that the writing stays readable
        img = np.where(img < paper - rr.uniform(0.2, 0.45) * (paper - ink_eff), 0, 255).astype(np.float32); mode = 'bw'
    img = np.clip(img, 0, 255).astype(np.uint8)
    if mode == 'gray' and rr.random() < 0.5:
        img = cv2.imdecode(cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, int(rr.uniform(45, 90))])[1], cv2.IMREAD_GRAYSCALE)
    return img, lab, dict(pencil=pencil, mode=mode, scale=round(sc, 2), angle=round(ang, 2))

def pick_layouts(n):
    names, ws = list(LAYOUTS), list(LAYOUTS.values())
    out = []
    while len(out) < n and names:
        c = rr.choices(names, ws)[0]; j = names.index(c)
        out.append(c); names.pop(j); ws.pop(j)
    return out

out = []
for p in pages:
    for layout in pick_layouts(per):
        S = make(p, layout)
        if S is None: continue
        img, lab, info = scan(S)
        bw = find_names.binarize(img)
        words = []
        ok = True
        for g_ in S.gt:
            reg = lab == g_['id']
            ys, xs = np.nonzero(reg)
            iy, ix = np.nonzero(bw & reg)
            if len(xs) == 0 or len(ix) < 10: ok = False; break
            k = max(1, len(ix) // 400)
            words.append(dict(text=g_['text'], kind=g_['kind'], box=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                              ink=[[int(x), int(y)] for x, y in zip(ix[::k], iy[::k])]))
        if not ok: continue
        # the student's name as the app knows it: both parts, even where only the first name was written
        out.append(dict(id=len(out), page_file=p['file'], layout=layout, page=img, words=words, scan=info, font='gnhk-scan',
                        student=S.student,
                        mates=[(w['text'],) for w in words if w['kind'] == 'mate']))
pickle.dump(out, open(outp, 'wb'), protocol=4)
print(len(out), 'pages', {l: sum(o['layout'] == l for o in out) for l in LAYOUTS},
      'bw', sum(o['scan']['mode'] == 'bw' for o in out), 'pencil', sum(o['scan']['pencil'] for o in out))
