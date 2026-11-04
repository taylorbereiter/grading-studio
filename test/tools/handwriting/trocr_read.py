# Reference only, never shipped: read the GNHK word crops with a large ready-made reader (Microsoft TrOCR small,
# about 62M weights) so our small reader can be compared against it on the same words.
# Usage: python -I trocr_read.py <val|test> <every_kth_page> <model_dir> <out.json>
import sys, os, json, pickle, time
import numpy as np, torch
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
split, k, mdir, outp = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
torch.set_num_threads(int(os.environ.get('THREADS', '1')))
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
proc = TrOCRProcessor.from_pretrained(mdir)
model = VisionEncoderDecoderModel.from_pretrained(mdir).eval()

if split == 'test':
    pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_test.pkl'), 'rb'))
else:
    pages = pickle.load(open(os.path.join(W, 'data/prep/gnhk_train.pkl'), 'rb'))[::13]
pages = pages[::k]
def stretch(c):
    # dark ink on white paper, as this reader expects; on held-back words this lifted its exact reads from 49% to 55%
    lo, hi = np.percentile(c, 1), np.percentile(c, 95)
    return (np.clip((c.astype(np.float32) - lo) / max(1, hi - lo), 0, 1) * 255).astype(np.uint8)

out = {}
if os.path.exists(outp): out = json.load(open(outp))
t0 = time.time(); n = 0
for p in pages:
    if p['file'] in out: continue
    hw = [w for w in p['words'] if w['type'] == 'H' and w['crop'] is not None]
    texts = []
    for i in range(0, len(hw), 16):
        ims = [Image.fromarray(stretch(w['crop'])).convert('RGB') for w in hw[i:i + 16]]
        px = proc(images=ims, return_tensors='pt').pixel_values
        with torch.no_grad():
            ids = model.generate(px, max_new_tokens=20, num_beams=1, do_sample=False)
        texts += proc.batch_decode(ids, skip_special_tokens=True)
    out[p['file']] = texts
    n += len(hw)
    json.dump(out, open(outp, 'w'))
    print(len(out), 'pages', n, 'words %.0fs' % (time.time() - t0), flush=True)
print('done', len(out), 'pages %.0fs' % (time.time() - t0))
