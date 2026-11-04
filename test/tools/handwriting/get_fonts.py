# Download Google Fonts handwriting families (Latin subset) as TTF, regular weight.
import json, re, sys, os, urllib.request, urllib.parse, concurrent.futures as cf
meta_path, out_dir = sys.argv[1], sys.argv[2]
raw = open(meta_path).read(); raw = raw[raw.index('{'):]
fams = [f for f in json.loads(raw)['familyMetadataList']
        if f.get('category') == 'Handwriting' and 'latin' in f.get('subsets', [])]
os.makedirs(out_dir, exist_ok=True)
def get(f):
    fam = f['family']
    safe = re.sub(r'[^A-Za-z0-9]+', '_', fam)
    dst = os.path.join(out_dir, safe + '.ttf')
    if os.path.exists(dst): return fam, 'have'
    try:
        css = urllib.request.urlopen('https://fonts.googleapis.com/css2?family=' + urllib.parse.quote(fam), timeout=30).read().decode()
        urls = re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)', css)
        if not urls: return fam, 'no-ttf'
        data = urllib.request.urlopen(urls[0], timeout=60).read()
        open(dst, 'wb').write(data)
        return fam, len(data)
    except Exception as e:
        return fam, 'ERR ' + str(e)[:80]
with cf.ThreadPoolExecutor(12) as ex:
    res = list(ex.map(get, fams))
bad = [r for r in res if isinstance(r[1], str) and r[1] != 'have']
print(len(res), 'families;', len(bad), 'problems'); [print(' ', b) for b in bad[:20]]
json.dump({re.sub(r'[^A-Za-z0-9]+', '_', f['family']): {'family': f['family'], 'designers': f.get('designers'), 'popularity': f.get('popularity'), 'classifications': f.get('classifications')} for f in fams}, open(os.path.join(out_dir, '_families.json'), 'w'), indent=1)
