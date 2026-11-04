# Fold batch-norm into the convolutions and write the reader's weights as one small file for the browser:
# int8 per output channel with a float scale, packed little-endian. Also writes a JSON check sample.
# Usage: python -I export.py <model.pt> <out.bin> <check.json>
import sys, os, json, struct, numpy as np, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib
from model import Net

def fold(conv, bn):
    w = conv.weight.detach().numpy().astype(np.float64)
    b = conv.bias.detach().numpy().astype(np.float64) if conv.bias is not None else np.zeros(w.shape[0])
    if bn is not None:
        g = bn.weight.detach().numpy(); be = bn.bias.detach().numpy()
        m = bn.running_mean.numpy(); v = bn.running_var.numpy()
        s = g / np.sqrt(v + bn.eps)
        w = w * s.reshape(-1, *([1] * (w.ndim - 1)))
        b = (b - m) * s + be
    return w.astype(np.float32), b.astype(np.float32)

def layers(net):
    L = []
    body = list(net.body)
    for m in body:
        if isinstance(m, torch.nn.Sequential):
            w, b = fold(m[0], m[1]); L.append(('c2', w, b))
        else:
            k = m.kernel_size if isinstance(m.kernel_size, tuple) else (m.kernel_size, m.kernel_size)
            L.append(('pool', k))
    w, b = fold(net.proj[0], net.proj[1]); L.append(('c1', w, b, 1, False))
    for r in net.seq:
        w, b = fold(r.conv, r.bn); L.append(('c1', w, b, r.conv.dilation[0], True))
    w = net.out.weight.detach().numpy(); b = net.out.bias.detach().numpy(); L.append(('out', w.astype(np.float32), b.astype(np.float32)))
    return L

def q8(w):
    o = w.shape[0]
    flat = w.reshape(o, -1)
    sc = np.abs(flat).max(1) / 127.0 + 1e-12
    q = np.clip(np.round(flat / sc[:, None]), -127, 127).astype(np.int8)
    return q, sc.astype(np.float32)

if __name__ == '__main__':
    src, outp, checkp = sys.argv[1:4]
    net = Net(hwlib.C); net.load_state_dict(torch.load(src, map_location='cpu', weights_only=False)['net']); net.eval()
    L = layers(net)
    blob = bytearray(); meta = []
    for l in L:
        if l[0] == 'pool':
            meta.append(dict(t='pool', k=list(l[1]))); continue
        w, b = l[1], l[2]
        q, sc = q8(w)
        meta.append(dict(t=l[0], shape=list(w.shape), off=len(blob), dil=(l[3] if l[0] == 'c1' else 1), res=(l[4] if l[0] == 'c1' else False)))
        blob += q.tobytes(); blob += sc.tobytes(); blob += b.astype(np.float32).tobytes()
        while len(blob) % 4: blob += b'\0'
    head = json.dumps(dict(syms=hwlib.SYMS, H=hwlib.H, layers=meta)).encode()
    with open(outp, 'wb') as f:
        f.write(struct.pack('<I', len(head))); f.write(head); f.write(bytes(blob))
    # check sample: a made-up word picture and the reader's output in PyTorch, for the JS port to match
    rng = np.random.default_rng(0)
    x = np.clip(rng.random((hwlib.H, 96)) ** 6 * 1.5, 0, 1).astype(np.float32)
    with torch.no_grad():
        lp = net(torch.from_numpy(x)[None, None]).log_softmax(-1)[0].numpy()
    json.dump(dict(x=x.flatten().tolist(), w=96, lp=lp.flatten().tolist(), T=lp.shape[0]), open(checkp, 'w'))
    print('wrote', outp, os.path.getsize(outp), 'bytes;', len(L), 'layers')
