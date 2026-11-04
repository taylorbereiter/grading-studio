# Made-up pages for the Chinese check. The student writes their Chinese name by hand (in one of four open Chinese
# handwriting fonts) while the class roster holds their English name, as is common in international schools.
# Answers are English in the held-out Latin fonts, and half the pages also carry a few lines of Chinese writing.
# The reader only knows Latin letters, so this tests two things: does the printed "Name" label rule still cover a
# Chinese name, and do Chinese characters cause wrong covers?
# Usage: python -I make_pages_zh.py <n_pages> <seed> <out.pkl>
import sys, os, re, pickle, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib
from fontTools.ttLib import TTFont

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
n_pages, seed, outp = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
rng = np.random.default_rng(seed); rr = random.Random(seed)
_, latin_fonts = hwlib.font_split(os.path.join(W, 'fonts'))
ZH_FONTS = [os.path.join(W, 'fonts', f + '.ttf') for f in ('Long_Cang', 'Zhi_Mang_Xing', 'Ma_Shan_Zheng', 'Liu_Jian_Mao_Cao')]
SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严武戴莫孔向汤'
GIVEN = '伟芳娜敏静丽强磊军洋勇艳杰娟涛明超秀霞平刚英华玉萍红玲芬燕彬鹏浩宇轩子涵欣怡梓萱雨晨博文嘉思佳一诺俊豪然睿泽瑞昊天皓宸铭逸安琪悦彤妍可馨晴雅婷琳瑶舒晓志鑫宁凯辰航帆阳楠心雪蕾'
COMMON = ('的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起'
          '还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工己话'
          '儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东海口使教西再平真听世气信北少关并内加化由却代产入先山五太水万市眼体别'
          '处总才场师书比住员九笑性通目华报立马命张活难神数件安表原车白应路期叫死常提感金何更反合放做系计或司利受光王果亲界及今京务制解各任至清物台象记'
          '边共风战干接它许八特觉望直服毛林题建南度统色字请交爱让认算论百吃义科怎元社术结六功指思非流每青管夫连远资队跟带花快条院变联言权往展该领传近留'
          '红治决周保达办运半候七必城父强步完革深区即求品士转量空甚众技轻程告江语英基式李油投读写')
cm = {p: set(chr(c) for c in (TTFont(p, lazy=True).getBestCmap() or {})) for p in ZH_FONTS}
need = set(SURNAMES + GIVEN + COMMON)
for p in ZH_FONTS:
    miss = need - cm[p]
    if miss: print(os.path.basename(p), 'lacks', len(miss), 'characters', flush=True)
allwords = [w.strip() for w in open(os.path.join(W, 'data/lists/words.txt')) if w.strip() and "'" not in w]
common = [w for w in allwords if len(w) <= 9]
commonset = set(allwords)
names = [hwlib.fold(n.strip()) for n in open(os.path.join(W, 'data/lists/names.txt'))]
names = [n for n in names if re.fullmatch(r'[a-z]{2,11}', n) and n not in commonset]
rr.shuffle(names)
first_pool, last_pool = names[:4000], names[4000:8000]
PRINT = ImageFont.load_default(size=26)
PRINT_SMALL = ImageFont.load_default(size=22)
PW, PH = 1240, 1754
QUESTIONS = ['1. Explain what the writer means in the first paragraph.', '2. Give two examples from the text.',
             '3. How does the character change by the end?', '4. Describe the method you used.',
             '5. What would you do differently next time?', 'Reflection: what did you learn this week?']

def sentence(k):
    ws = [rr.choice(common) for _ in range(k)]
    ws[0] = ws[0].capitalize()
    return ws

def zh_text(font, n):
    pool = [c for c in COMMON if c in cm[font]]
    return ''.join(rr.choice(pool) for _ in range(n))

def zh_name(font):
    s = [c for c in SURNAMES if c in cm[font]]; g = [c for c in GIVEN if c in cm[font]]
    return rr.choice(s) + ''.join(rr.choice(g) for _ in range(1 if rr.random() < 0.35 else 2))

STYLE = {}

class Page:
    def __init__(self):
        self.ink = np.zeros((PH, PW), np.float32)
        self.printed = Image.new('L', (PW, PH), 0)
        self.pd = ImageDraw.Draw(self.printed)
        self.words = []; self.rules = []

    def put(self, ink, x, base, text, kind):
        h, w = ink.shape
        y = int(base - h * 0.78)
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(PW, x + w), min(PH, y + h)
        if x1 <= x0 or y1 <= y0: return None
        self.ink[y0:y1, x0:x1] = np.maximum(self.ink[y0:y1, x0:x1], ink[y0 - y: y1 - y, x0 - x: x1 - x])
        sub = ink[y0 - y: y1 - y, x0 - x: x1 - x] > 0.25
        yy, xx = np.nonzero(sub)
        if len(xx) == 0: return None
        self.words.append(dict(text=text, box=[int(x0 + xx.min()), int(y0 + yy.min()), int(x0 + xx.max()), int(y0 + yy.max())], kind=kind))

    def write_line(self, words, x, base, font, size, kinds=None, gap=(0.35, 0.8), max_x=PW - 80):
        for i, t in enumerate(words):
            ink = hwlib.render_ink(t, font, rng, size=size, jitter=True, style=STYLE['s'])
            if ink is None: continue
            if x + ink.shape[1] > max_x: return x
            self.put(ink, x, base + int(rng.normal(0, size * 0.04)), t, kinds[i] if kinds else 'body')
            x += ink.shape[1] + int(size * rng.uniform(*gap))
        return x

def make_page(i):
    font = rr.choice(latin_fonts); zf = rr.choice(ZH_FONTS)
    First, Last = rr.choice(first_pool).capitalize(), rr.choice(last_pool).capitalize()     # the roster's English name
    mates = [(rr.choice(first_pool).capitalize(), rr.choice(last_pool).capitalize()) for _ in range(2)]
    size = int(rng.integers(32, 52))
    # Chinese characters about as tall as the writer's capital letters, or a little taller
    cap = ImageFont.truetype(font, 100).getbbox('H'); zb = ImageFont.truetype(zf, 100).getbbox('国')
    zsize = int(size * (cap[3] - cap[1]) / max(1, zb[3] - zb[1]) * rng.uniform(1.0, 1.3))
    STYLE['s'] = hwlib.writer_style(rng, size)
    layout = rr.choice(['worksheet', 'lined'])
    zh_lines = rr.random() < 0.5
    name = zh_name(zf)
    P = Page()
    gap = int(size * rng.uniform(1.25, 1.6))
    def body(y, n_lines, x0=90):
        for k in range(n_lines):
            if zh_lines and rr.random() < 0.3:
                chunks = [zh_text(zf, rr.randint(2, 4)) for _ in range(rr.randint(3, 5))]
                P.write_line(chunks, x0, y, zf, zsize, gap=(0.05, 0.3))
            else:
                ws = sentence(14); kinds = None
                if rr.random() < 0.12:
                    m = rr.choice(mates); j = rr.randrange(2, 8)
                    ws = ws[:j] + [m[0]] + ws[j:]; kinds = ['body'] * j + ['mate'] + ['body'] * (len(ws) - j - 1)
                P.write_line(ws, x0, y, font, size, kinds)
            y += gap
            if y > PH - 3 * gap: break
        return y
    if layout == 'worksheet':
        P.pd.text((80, 70), 'Name:', font=PRINT, fill=255); P.pd.line((160, 98, 640, 98), fill=200, width=2)
        P.pd.text((680, 70), 'Class:', font=PRINT, fill=255); P.pd.line((760, 98, 900, 98), fill=200, width=2)
        P.pd.text((930, 70), 'Date:', font=PRINT, fill=255); P.pd.line((1000, 98, 1170, 98), fill=200, width=2)
        P.write_line([name], 180, 94, zf, zsize, ['own'])
        P.write_line([rr.choice(['11B', '10-2', '9C', '12A', 'Y10'])], 780, 94, font, size)
        P.write_line(['%d/%d' % (rr.randint(1, 28), rr.randint(1, 12))], 1010, 94, font, size)
        y = 190
        for q in rr.sample(QUESTIONS, 3):
            P.pd.text((80, y), q, font=PRINT_SMALL, fill=255); y += 50
            n = rr.randint(2, 4)
            for _ in range(n): P.rules.append(y + gap // 2); y += gap
            body(y - n * gap + gap // 2, n)
            y += 30
    else:
        y0 = int(rng.integers(90, 150)); yy = y0
        while yy < PH - 60: P.rules.append(yy); yy += gap
        P.write_line([name], 90, y0, zf, zsize, ['own'])
        body(y0 + gap, rr.randint(8, 16))
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
    return dict(id=i, font=os.path.basename(zf)[:-4], layout=layout + ('+zh' if zh_lines else ''), page=img, words=P.words,
                student=(First, Last), mates=mates, zh_name=name)

pages = [make_page(i) for i in range(n_pages)]
pickle.dump(pages, open(outp, 'wb'), protocol=4)
print(len(pages), 'pages', 'layouts', {l: sum(p['layout'] == l for p in pages) for l in set(p['layout'] for p in pages)})
