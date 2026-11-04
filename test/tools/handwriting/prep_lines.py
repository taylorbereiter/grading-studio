# German lines (training) and Danish pages (test only) -> pickles of crops at height 48.
import sys, re, pickle, numpy as np, cv2, pyarrow.parquet as pq
import xml.etree.ElementTree as ET
CROP_H = 48
def fit(im):
    h, w = im.shape
    return cv2.resize(im, (max(4, int(round(w * CROP_H / h))), CROP_H), interpolation=cv2.INTER_AREA if h > CROP_H else cv2.INTER_CUBIC)
kind, out, *ins = sys.argv[1:]
res = []
if kind == 'german':
    for p in ins:
        for r in pq.read_table(p).to_pylist():
            im = cv2.imdecode(np.frombuffer(r['image']['bytes'], np.uint8), cv2.IMREAD_GRAYSCALE)
            if im is None or im.shape[0] < 12: continue
            res.append(dict(text=r['text'], crop=fit(im)))
else:
    ns = {'p': 'http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15'}
    for r in pq.read_table(ins[0]).to_pylist():
        im = cv2.imdecode(np.frombuffer(r['image']['bytes'], np.uint8), cv2.IMREAD_GRAYSCALE)
        root = ET.fromstring(r['page'].encode('utf-8'))
        lines = []
        for tl in root.iter('{%s}TextLine' % ns['p']):
            pts = np.array([[int(v) for v in q.split(',')] for q in tl.find('p:Coords', ns).get('points').split()], np.int32)
            u = tl.find('p:TextEquiv/p:Unicode', ns)
            text = (u.text or '') if u is not None else ''
            x0, y0 = pts.min(0); x1, y1 = pts.max(0)
            crop = im[max(0, y0):y1 + 1, max(0, x0):x1 + 1]
            if crop.size == 0 or not text.strip(): continue
            lines.append(dict(text=text, box=[int(x0), int(y0), int(x1), int(y1)], poly=pts.tolist(), crop=fit(crop)))
        res.append(dict(file='%d_%d' % (r['doc_id'], r['sequence']), doc=r['doc_id'], page=im, lines=lines))
pickle.dump(res, open(out, 'wb'), protocol=4)
print(kind, len(res), 'items', sum(len(x.get('lines', [1])) for x in res), 'lines')
