# Draw a page with its true name words (red) and the covers at a threshold (blue = roster match, green = Name label rule).
import sys, os, json, pickle, cv2, numpy as np
pages_p, res_p, idx, thr, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
pages = pickle.load(open(pages_p, 'rb')); res = json.load(open(res_p))
p = pages[idx]; r = res[idx]
im = cv2.cvtColor(p['page'], cv2.COLOR_GRAY2BGR)
for g in r['gt']:
    if g['kind'] != 'body': cv2.rectangle(im, tuple(g['box'][:2]), tuple(g['box'][2:]), (0, 0, 255), 3)
for c in r['covers']:
    if c['score'] >= thr:
        b = c['box']; cv2.rectangle(im, (b[0], b[1]), (b[2], b[3]), (255, 120, 0), 2)
        cv2.putText(im, '%s %.2f' % (c['name'], c['score']), (b[0], b[3] + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
for c in r['spots']:
    b = c['box']; cv2.rectangle(im, (b[0] - 3, b[1] - 3), (b[2] + 3, b[3] + 3), (0, 170, 0), 2)
print(r['layout'], r['font'], [g['text'] for g in r['gt'] if g['kind'] != 'body'], 'roster head', r['roster'][:6])
cv2.imwrite(out, cv2.resize(im, None, fx=0.62, fy=0.62))
