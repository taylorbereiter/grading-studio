# Extract word crops, line crops and downscaled pages from GNHK parquet files.
# Usage: python -I prep_gnhk.py <parquet...> <out.pkl>
import sys, json, io, pickle, numpy as np, cv2, pyarrow.parquet as pq
from multiprocessing import Pool
CROP_H = 48          # stored crop height (model input is resized later)
PAGE_WORD_H = 50     # target median word height for stored pages (like a 150 dpi scan)

def warp_quad(gray, pts, h):
    pts = np.array(pts, np.float32)
    wt = np.linalg.norm(pts[1]-pts[0]); wb = np.linalg.norm(pts[2]-pts[3])
    hl = np.linalg.norm(pts[3]-pts[0]); hr = np.linalg.norm(pts[2]-pts[1])
    W, H = max(wt, wb), max(hl, hr)
    if H < 4 or W < 2: return None
    # pad the quad a little vertically/horizontally so ascenders/descenders survive
    c = pts.mean(0)
    pad = 0.06
    pts2 = c + (pts - c) * np.array([1 + pad * H / max(W, 1) * 2, 1 + pad], np.float32)
    w = max(4, int(round(W / H * h)))
    dst = np.array([[0, 0], [w-1, 0], [w-1, h-1], [0, h-1]], np.float32)
    M = cv2.getPerspectiveTransform(pts2.astype(np.float32), dst)
    return cv2.warpPerspective(gray, M, (w, h), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)

def quad(p): return [[p['x0'], p['y0']], [p['x1'], p['y1']], [p['x2'], p['y2']], [p['x3'], p['y3']]]

def do_page(row):
    img = cv2.imdecode(np.frombuffer(row['image']['bytes'], np.uint8), cv2.IMREAD_GRAYSCALE)
    ann = json.loads(row['annotations'])
    words = []
    for k, a in enumerate(ann):
        q = quad(a['polygon'])
        crop = warp_quad(img, q, CROP_H)
        words.append(dict(i=k, text=a['text'], type=a['type'], line=a['line_idx'], quad=q, crop=crop))
    # lines: group handwritten words by line_idx, order by x of centre
    lines = []
    by = {}
    for w in words:
        if w['type'] == 'H': by.setdefault(w['line'], []).append(w)
    for li, ws in by.items():
        ws.sort(key=lambda w: np.mean([p[0] for p in w['quad']]))
        pts = np.array([p for w in ws for p in w['quad']], np.float32)
        rect = cv2.minAreaRect(pts)
        box = cv2.boxPoints(rect)
        # order box points: top-left, top-right, bottom-right, bottom-left (by angle of text direction)
        first = np.array(ws[0]['quad'], np.float32); last = np.array(ws[-1]['quad'], np.float32)
        d = last.mean(0) - first.mean(0)
        if np.linalg.norm(d) < 1: d = first[1] - first[0]
        d = d / (np.linalg.norm(d) + 1e-6); n = np.array([-d[1], d[0]])
        proj = box @ d; projn = box @ n
        o = sorted(range(4), key=lambda i: (projn[i] > np.median(projn), proj[i]))
        tl, tr = o[0], o[1]; bl, br = o[2], o[3]
        q = [box[tl].tolist(), box[tr].tolist(), box[br].tolist(), box[bl].tolist()]
        crop = warp_quad(img, q, CROP_H)
        lines.append(dict(line=li, text=' '.join(w['text'] for w in ws), words=[w['i'] for w in ws], crop=crop))
    # downscaled page
    hs = [np.linalg.norm(np.array(w['quad'][3]) - np.array(w['quad'][0])) for w in words if w['type'] == 'H']
    s = PAGE_WORD_H / (np.median(hs) if hs else 100.0)
    s = min(1.0, s)
    page = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    return dict(file=row['filename'], scale=s, page=page, words=words, lines=lines)

if __name__ == '__main__':
    *ins, out = sys.argv[1:]
    rows = []
    for p in ins:
        t = pq.read_table(p, columns=['image', 'filename', 'annotations'])
        rows += t.to_pylist()
    with Pool(4) as pool:
        pages = pool.map(do_page, rows, chunksize=4)
    pickle.dump(pages, open(out, 'wb'), protocol=4)
    nw = sum(len(p['words']) for p in pages); nl = sum(len(p['lines']) for p in pages)
    print(out, len(pages), 'pages', nw, 'words', nl, 'lines')
