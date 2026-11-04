import sys, os, numpy as np, cv2, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib
fonts_dir, lists, out = sys.argv[1], sys.argv[2], sys.argv[3]
train, test = hwlib.font_split(fonts_dir)
print('train fonts', len(train), 'test fonts', len(test))
ts = hwlib.TextSource(os.path.join(lists, 'words.txt'), os.path.join(lists, 'names.txt'), seed=3)
rng = np.random.default_rng(3)
w8 = np.array(hwlib.font_weights(train)); w8 /= w8.sum()
rows = []
prev = None
for i in range(36):
    f = train[rng.choice(len(train), p=w8)]
    t = ts.sample()
    img = hwlib.synth_sample(t, f, rng, prev)
    prev = hwlib.render_ink(ts.word(), f, rng)
    x = hwlib.to_model(img)
    vis = (255 - x * 255).astype(np.uint8)
    vis = vis[:, :600]
    canvas = np.full((40, 1000), 255, np.uint8); canvas[4:36, :vis.shape[1]] = vis
    cv2.putText(canvas, (t + '  |' + os.path.basename(f)[:-4])[:40], (610, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, 0, 1)
    rows.append(canvas)
cv2.imwrite(out, np.vstack(rows))
