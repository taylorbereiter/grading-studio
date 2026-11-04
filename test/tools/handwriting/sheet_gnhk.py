import sys, pickle, numpy as np, cv2, random
pages = pickle.load(open(sys.argv[1], 'rb')); out = sys.argv[2]
random.seed(1)
rows = []
ws = [w for p in pages for w in p['words'] if w['type'] == 'H' and w['crop'] is not None]
for w in random.sample(ws, 40):
    c = w['crop']; c = cv2.resize(c, (min(400, c.shape[1]), 48))
    canvas = np.full((60, 640), 255, np.uint8); canvas[6:54, :c.shape[1]] = c
    cv2.putText(canvas, w['text'][:20], (420, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.8, 0, 2)
    rows.append(canvas)
ls = [l for p in pages for l in p['lines'] if l['crop'] is not None]
for l in random.sample(ls, 8):
    c = l['crop']; c = cv2.resize(c, (min(1280, c.shape[1]), 48))
    canvas = np.full((84, 1280), 255, np.uint8); canvas[4:52, :c.shape[1]] = c
    cv2.putText(canvas, l['text'][:80], (5, 76), cv2.FONT_HERSHEY_SIMPLEX, 0.7, 0, 2)
    rows.append(canvas)
grid_words = np.vstack([np.hstack(rows[i:i+2]) for i in range(0, 40, 2)])
grid_lines = np.vstack(rows[40:])
cv2.imwrite(out, np.vstack([grid_words, grid_lines]))
