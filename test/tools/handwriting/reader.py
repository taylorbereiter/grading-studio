# Method B helpers: run the trained reader on word or line pictures, and score roster names against what it saw.
import numpy as np, torch
from numba import njit
import hwlib
from model import Net

LETTER = np.zeros(hwlib.C, np.bool_)
for ch, i in hwlib.IDX.items():
    if 'a' <= ch <= 'z': LETTER[i] = True

class Reader:
    def __init__(self, path, threads=2):
        torch.set_num_threads(threads)
        s = torch.load(path, map_location='cpu', weights_only=False)
        self.net = Net(hwlib.C); self.net.load_state_dict(s['net']); self.net.eval()

    def logprobs(self, grays, batch=48):
        """list of grey crops -> list of [T, C] float32 log-probabilities."""
        xs = [hwlib.to_model(g) for g in grays]
        out = [None] * len(xs)
        order = sorted(range(len(xs)), key=lambda i: xs[i].shape[1])
        with torch.no_grad():
            for k in range(0, len(order), batch):
                ids = order[k:k + batch]
                W = max(max(xs[i].shape[1] for i in ids), 16); W = (W + 3) // 4 * 4
                arr = np.zeros((len(ids), 1, hwlib.H, W), np.float32)
                for j, i in enumerate(ids): arr[j, 0, :, :xs[i].shape[1]] = xs[i]
                lp = self.net(torch.from_numpy(arr)).log_softmax(-1).numpy()
                for j, i in enumerate(ids): out[i] = np.ascontiguousarray(lp[j, :max(1, xs[i].shape[1] // 4)])
        return out

def greedy_text(lp):
    best = lp.argmax(-1)
    out, prev = [], 0
    for b in best:
        if b != prev and b != 0: out.append(int(b))
        prev = b
    return hwlib.decode(out)

@njit(cache=True)
def spot(lp, lab, letter):
    """Best alignment of the name `lab` inside this picture, with only non-letters (gaps, marks) allowed around it.
    Returns (score <= 0 relative to the reader's own best reading, start frame, end frame)."""
    T, C = lp.shape
    n = lab.shape[0]
    S = 2 * n + 1
    NEG = -1e9
    y = np.empty((T, C))
    nl = np.empty(T)
    for t in range(T):
        m = lp[t, 0]
        for c in range(C):
            if lp[t, c] > m: m = lp[t, c]
        b = NEG
        for c in range(C):
            y[t, c] = lp[t, c] - m
            if not letter[c] and y[t, c] > b: b = y[t, c]
        nl[t] = b
    ext = np.zeros(S, np.int64)
    for j in range(S):
        ext[j] = 0 if j % 2 == 0 else lab[j // 2]
    prev = np.full(S, NEG); cur = np.full(S, NEG)
    st_prev = np.zeros(S, np.int64); st_cur = np.zeros(S, np.int64)
    pre = 0.0          # filler before the name, up to t-1
    post = NEG; post_start = 0; post_end = 0
    best_end = 0
    for t in range(T):
        for j in range(S):
            c = ext[j]
            v = prev[j]; s0 = st_prev[j]
            if j >= 1 and prev[j - 1] > v: v = prev[j - 1]; s0 = st_prev[j - 1]
            if j >= 2 and c != 0 and ext[j - 2] != c and prev[j - 2] > v: v = prev[j - 2]; s0 = st_prev[j - 2]
            if j <= 1 and pre > v: v = pre; s0 = t
            cur[j] = v + y[t, c]; st_cur[j] = s0
        # post filler: either continue or leave the name at t-1
        e = prev[S - 1]; es = st_prev[S - 1]
        if prev[S - 2] > e: e = prev[S - 2]; es = st_prev[S - 2]
        if e > post:
            post = e; post_start = es; post_end = t - 1
        post = post + nl[t]
        pre = pre + nl[t]
        for j in range(S):
            prev[j] = cur[j]; st_prev[j] = st_cur[j]
    e = prev[S - 1]; es = st_prev[S - 1]
    if prev[S - 2] > e: e = prev[S - 2]; es = st_prev[S - 2]
    if e >= post:
        return e, es, T - 1
    return post, post_start, post_end

def label(s):
    return np.array(hwlib.encode(s), np.int64)

SPACE = hwlib.IDX[' ']
def spot_any(lp, lab):
    """Like spot, but if the reader saw several words in the picture (a space between them), the name may be any one of them."""
    best = spot(lp, lab, LETTER)
    am = lp.argmax(-1)
    cuts = np.nonzero(am == SPACE)[0].tolist()
    if cuts:
        a = 0
        for c in cuts + [len(am)]:
            if c - a >= 2:
                r = spot(lp[a:c], lab, LETTER)
                if r[0] > best[0]: best = (r[0], r[1] + a, r[2] + a)
            a = c + 1
    return best
