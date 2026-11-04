# Check glyph coverage and render contact sheets of every handwriting font.
import sys, os, json, glob, numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
font_dir, out_prefix = sys.argv[1], sys.argv[2]
need = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
paths = sorted(glob.glob(os.path.join(font_dir, '*.ttf')))
info = {}
for p in paths:
    name = os.path.basename(p)[:-4]
    try:
        f = TTFont(p, lazy=True); cmap = f.getBestCmap() or {}
        miss = [c for c in need if ord(c) not in cmap]
        info[name] = dict(missing=''.join(sorted(miss)))
    except Exception as e:
        info[name] = dict(error=str(e)[:60])
json.dump(info, open(out_prefix + '_coverage.json', 'w'), indent=0)
ok = [p for p in paths if not info[os.path.basename(p)[:-4]].get('missing') and 'error' not in info[os.path.basename(p)[:-4]]]
print(len(paths), 'fonts;', len(ok), 'cover a-z A-Z 0-9')
sample = 'Name: Mateo Ramirez  quick 1234'
per = 48
for s in range(0, len(paths), per):
    chunk = paths[s:s+per]
    sheet = Image.new('L', (1700, 64 * ((len(chunk) + 1) // 2)), 255)
    d = ImageDraw.Draw(sheet)
    for i, p in enumerate(chunk):
        x = (i % 2) * 850; y = (i // 2) * 64
        name = os.path.basename(p)[:-4]
        try:
            f = ImageFont.truetype(p, 34)
            d.text((x + 230, y + 10), sample, font=f, fill=0)
        except Exception as e:
            d.text((x + 230, y + 20), 'ERR', fill=0)
        tag = ('#%d ' % (s + i)) + name[:22] + (' !' + info[name].get('missing', '')[:8] if info[name].get('missing') else '')
        d.text((x + 4, y + 24), tag, fill=0, font=ImageFont.load_default(size=15))
    sheet.save('%s_%02d.png' % (out_prefix, s // per))
