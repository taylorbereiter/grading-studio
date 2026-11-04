# The student's own name on their own paper, the job the app actually has: it knows whose paper it is and has the
# class roster. Reads every word box once and keeps all the scores, so metrics_names.py can try rules and cut-offs.
# Works on font pages (make_pages.py, make_pages_zh.py) and real-handwriting name pages (make_name_pages.py).
# Usage: python -I eval_names.py <pages.pkl> <model.pt> <out.json>
import sys, os, re, json, pickle, random, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib, find_names
from reader import Reader, spot_any, label

W = os.environ.get('HW_WORK') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, model_path, outp = sys.argv[1:4]
R = Reader(model_path, threads=int(os.environ.get('THREADS', '1')))
allwords = set(w.strip() for w in open(os.path.join(W, 'data/lists/words.txt')) if w.strip())
names = [hwlib.fold(n.strip()) for n in open(os.path.join(W, 'data/lists/names.txt'))]
names = [n for n in names if re.fullmatch(r'[a-z]{3,10}', n) and n not in allwords]
random.Random(7).shuffle(names)
first_pool, last_pool = names[300:2300], names[2300:4300]
rng = random.Random(11)
pages = pickle.load(open(src, 'rb'))
out = []; t0 = time.time()
for p in pages:
    F = re.sub(r'[^a-z]', '', hwlib.fold(p['student'][0])); L = re.sub(r'[^a-z]', '', hwlib.fold(p['student'][1]))
    roster = [F, L] + [hwlib.fold(x) for m in p['mates'] for x in m]
    while len(roster) < 50: roster += [rng.choice(first_pool), rng.choice(last_pool)]
    gray = p['page']
    cache = {}
    covers, reads = find_names.find(gray, roster, R, thr=-1e9, spot_rule=True, lp_cache=cache)
    boxes, hmed = find_names.word_boxes(gray)
    lps = cache['lps']
    own = []
    for b, lp in zip(boxes, lps):
        row = []
        for part in (F, L):
            lab = label(part)
            r = spot_any(lp, lab)
            row.append([round(r[0] / max(1, len(lab)), 4), find_names.narrow(b, lp, r[1], r[2], hmed)])
        own.append(row)
    o2 = find_names.own_name(gray, boxes, lps, hmed, [F, L], R, bw=find_names.binarize(gray))
    own2 = dict(full=[[round(float(s), 4), round(c, 3), [list(map(int, b)) for b in bs], z] for s, c, bs, z in o2['full']],
                part=[[[round(float(s), 4), round(c, 3), list(map(int, b)), z] for s, c, b, z in lst] for lst in o2['part']],
                initial=[[round(float(f), 4), round(float(s), 4), round(c, 3), list(map(int, b))] for f, s, c, b in o2.get('initial', [])])
    page_conf = float(np.median([lp.max(-1).mean() for lp in lps])) if lps else 0.0
    out.append(dict(id=p['id'], layout=p['layout'], H=int(gray.shape[0]), hmed=float(hmed), roster=roster, own2=own2, page_conf=round(page_conf, 3),
                    gt=[dict(text=g['text'], box=g['box'], kind=g['kind'], ink=g.get('ink')) for g in p['words'] if g['kind'] in ('own', 'mate')],
                    roster_covers=[dict(box=c['box'], name=c['name'], score=round(c['score'], 4), conf=round(c.get('conf', 0.0), 3)) for c in covers if c['why'] == 'roster'],
                    spots=[dict(box=c['box']) for c in covers if c['why'] == 'name spot'],
                    reads=[dict(box=r['box'], scores=r['scores']) for r in reads], own=own))
    if len(out) % 25 == 0: print(len(out), 'pages %.0fs' % (time.time() - t0), flush=True)
json.dump(out, open(outp, 'w'), default=lambda o: o.item() if hasattr(o, 'item') else str(o))
print('done', len(out), '%.0fs' % (time.time() - t0))
