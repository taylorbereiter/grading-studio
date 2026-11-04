# Train the small handwriting reader from zero (random start, no borrowed weights).
# Usage: python -I train.py <workdir> <steps> [threads]
import sys, os, time, json, math, pickle, random
import numpy as np, cv2, torch, torch.nn as nn, torch.nn.functional as F
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib
from model import Net

work, steps = sys.argv[1], int(sys.argv[2])
threads = int(sys.argv[3]) if len(sys.argv) > 3 else 3
torch.set_num_threads(threads)
torch.manual_seed(0); random.seed(0); np.random.seed(0)
D = os.path.join(work, 'data')
OUT = os.path.join(work, 'runs', os.environ.get('RUN', 'reader'))
os.makedirs(OUT, exist_ok=True)
log = open(os.path.join(OUT, 'log.txt'), 'a')
def say(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); log.write(s + '\n'); log.flush()

SPECIAL = ('%SC%', '%NA%', '%math%')
def clean_line(t):
    for s in SPECIAL: t = t.replace(s, '~')
    return t

def ok_ratio(crop, text):
    if crop is None or not text: return False
    h, w = crop.shape
    r = (w / h) / max(1, len(text))
    return 0.12 < r < 3.5

# ------------------------------------------------------------------ data
gn = pickle.load(open(os.path.join(D, 'prep', 'gnhk_train.pkl'), 'rb'))
val_pages = set(p['file'] for p in gn[::13])           # every 13th training page is kept back for checking
gn_words, gn_lines, val_words = [], [], []
for p in gn:
    for w in p['words']:
        if w['type'] != 'H' or any(s in w['text'] for s in SPECIAL) or not ok_ratio(w['crop'], w['text']): continue
        (val_words if p['file'] in val_pages else gn_words).append((w['crop'], w['text']))
    if p['file'] in val_pages: continue
    for l in p['lines']:
        if l['crop'] is None or len(l['words']) < 2 or not ok_ratio(l['crop'], l['text']): continue
        gn_lines.append((l['crop'], clean_line(l['text'])))
del gn
de = pickle.load(open(os.path.join(D, 'prep', 'german.pkl'), 'rb'))
de_lines = [(x['crop'], x['text']) for x in de if ok_ratio(x['crop'], x['text'])]
del de
syn = []
for f in os.environ.get('SYN', 'train300k.pkl,train120k_b.pkl').split(','):
    syn += pickle.load(open(os.path.join(D, 'synth', f), 'rb'))
syn_narrow = [(x, t) for x, t, f in syn if x.shape[1] <= 320]
syn_wide = [(x, t) for x, t, f in syn if 320 < x.shape[1] <= hwlib.MAXW]
del syn
say('gnhk words', len(gn_words), 'lines', len(gn_lines), '| val words', len(val_words), '| german lines', len(de_lines), '| synth narrow', len(syn_narrow), 'wide', len(syn_wide))

def aug_real(crop, rng):
    h, w = crop.shape
    img = crop.astype(np.float32)
    # trim or pad top/bottom a little, shear and rotate a little
    t = int(rng.uniform(-0.06, 0.08) * h); b = int(rng.uniform(-0.06, 0.08) * h)
    if t > 0: img = img[t:]
    elif t < 0: img = np.pad(img, ((-t, 0), (0, 0)), mode='edge')
    if b > 0: img = img[:img.shape[0] - b]
    elif b < 0: img = np.pad(img, ((0, -b), (0, 0)), mode='edge')
    h, w = img.shape
    sh = rng.normal(0, 0.12); rot = rng.normal(0, 1.2) * math.pi / 180; sx = rng.uniform(0.85, 1.15)
    M = np.array([[sx * math.cos(rot), -math.sin(rot) + sh, 0], [math.sin(rot), math.cos(rot), 0]], np.float32)
    cs = np.array([[0, 0, 1], [w, 0, 1], [0, h, 1], [w, h, 1]], np.float32) @ M.T
    mn, mx = cs.min(0), cs.max(0); M[:, 2] -= mn
    img = cv2.warpAffine(img, M, (int(mx[0] - mn[0]) + 1, int(mx[1] - mn[1]) + 1), borderMode=cv2.BORDER_REPLICATE)
    if rng.random() < 0.3: img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.4, 1.3))
    if rng.random() < 0.3: img = img + rng.normal(0, rng.uniform(2, 10), img.shape)
    img = np.clip(img, 0, 255).astype(np.uint8)
    if rng.random() < 0.05:
        img = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 31, 10)
    return hwlib.to_model(img)

def squeeze_jitter(x, rng, cap):
    h, w = x.shape
    f = rng.uniform(0.85, 1.15)
    nw = int(round(w * f))
    if nw > cap: nw = cap
    if nw != w: x = cv2.resize(x, (max(4, nw), h), interpolation=cv2.INTER_AREA)
    return x

def need_w(lab):
    reps = sum(1 for a, b in zip(lab, lab[1:]) if a == b)
    return 4 * (len(lab) + reps + 1)

def make_batch(kind, rng):
    xs, labs = [], []
    if kind == 'narrow':
        B, cap = 64, 320
        src = [('s', 34), ('g', 30)]
    else:
        B, cap = 16, hwlib.MAXW
        src = [('s', 5), ('l', 7), ('d', 4)]
    for code, n in src:
        for _ in range(n):
            if code == 's':
                pool = syn_narrow if kind == 'narrow' else syn_wide
                a, t = pool[rng.integers(len(pool))]
                x = a.astype(np.float32) / 255.0
                if rng.random() < 0.3: x = np.clip(x * rng.uniform(0.6, 1.1) + rng.normal(0, 0.03, x.shape), 0, 1)
            else:
                pool = gn_words if code == 'g' else gn_lines if code == 'l' else de_lines
                a, t = pool[rng.integers(len(pool))]
                x = aug_real(a, rng)
            lab = hwlib.encode(t)
            if not lab: continue
            x = squeeze_jitter(x, rng, cap)
            if x.shape[1] < need_w(lab):
                if need_w(lab) > cap: continue
                x = cv2.resize(x, (need_w(lab), hwlib.H), interpolation=cv2.INTER_LINEAR)
            xs.append(x); labs.append(lab)
    W = max(x.shape[1] for x in xs); W = (W + 3) // 4 * 4
    arr = np.zeros((len(xs), 1, hwlib.H, W), np.float32)
    for i, x in enumerate(xs): arr[i, 0, :, :x.shape[1]] = x
    il = torch.tensor([x.shape[1] // 4 for x in xs], dtype=torch.long)
    tl = torch.tensor([len(l) for l in labs], dtype=torch.long)
    tg = torch.tensor([c for l in labs for c in l], dtype=torch.long)
    return torch.from_numpy(arr), il, tg, tl

def greedy(logp, n):
    best = logp[:n].argmax(-1).tolist()
    out, prev = [], 0
    for b in best:
        if b != prev and b != 0: out.append(b)
        prev = b
    return out

def lev(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)]

vrng = np.random.default_rng(5)
val_set = [val_words[i] for i in vrng.choice(len(val_words), min(900, len(val_words)), replace=False)]
val_x = [hwlib.to_model(c) for c, t in val_set]
def evaluate(net):
    net.eval(); errs = tot = right = 0
    with torch.no_grad():
        for i in range(0, len(val_x), 64):
            xs = val_x[i:i + 64]
            W = max(x.shape[1] for x in xs); W = (W + 3) // 4 * 4
            arr = np.zeros((len(xs), 1, hwlib.H, W), np.float32)
            for k, x in enumerate(xs): arr[k, 0, :, :x.shape[1]] = x
            lp = net(torch.from_numpy(arr)).log_softmax(-1)   # B,T,C
            for k, x in enumerate(xs):
                pred = greedy(lp[k], x.shape[1] // 4)
                lab = hwlib.encode(val_set[i + k][1])
                e = lev(pred, lab); errs += e; tot += len(lab); right += (e == 0)
    net.train()
    return errs / max(tot, 1), right / len(val_x)

net = Net(hwlib.C)
say('parameters', sum(p.numel() for p in net.parameters()))
opt = torch.optim.AdamW(net.parameters(), lr=2e-3, weight_decay=1e-4)
warm = 800
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / warm) * (0.5 * (1 + math.cos(math.pi * min(1.0, s / steps)))) * 0.97 + 0.03)
ctc = nn.CTCLoss(blank=0, zero_infinity=True)
rng = np.random.default_rng(1)
start = 0
ck = os.path.join(OUT, 'last.pt')
if os.path.exists(ck):
    s = torch.load(ck, weights_only=False)
    net.load_state_dict(s['net']); opt.load_state_dict(s['opt']); sched.load_state_dict(s['sched']); start = s['step']
    say('resumed at', start)
best = 9.0
t0 = time.time(); run_loss = 0.0
for step in range(start, steps):
    kind = 'narrow' if rng.random() < 0.72 else 'wide'
    x, il, tg, tl = make_batch(kind, rng)
    lp = net(x).log_softmax(-1).transpose(0, 1)   # T,B,C
    loss = ctc(lp, tg, il, tl)
    opt.zero_grad(); loss.backward()
    nn.utils.clip_grad_norm_(net.parameters(), 5.0)
    opt.step(); sched.step()
    run_loss = 0.98 * run_loss + 0.02 * loss.item() if step > start else loss.item()
    if (step + 1) % 200 == 0:
        say('step', step + 1, 'loss %.3f' % run_loss, 'lr %.2e' % sched.get_last_lr()[0], '%.2fs/step' % ((time.time() - t0) / (step + 1 - start)))
    if (step + 1) % 2000 == 0 or step + 1 == steps:
        cer, wacc = evaluate(net)
        say('  val CER %.3f  word acc %.3f' % (cer, wacc))
        torch.save({'net': net.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'step': step + 1}, ck)
        if cer < best:
            best = cer; torch.save({'net': net.state_dict(), 'step': step + 1, 'cer': cer}, os.path.join(OUT, 'best.pt'))
say('done; best val CER %.3f' % best)
