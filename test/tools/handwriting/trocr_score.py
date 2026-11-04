# Reference only: turn the large reader's text reads into roster scores in the same format eval_words.py writes,
# reusing the exact trials (stand-in word + 24 made-up names) of an earlier eval_words.py result.
# Score for a name = minus the letter edit distance between the read and the name (metrics.py 'norm' divides by length).
# Usage: python -I trocr_score.py <template eval_words.json> <trocr reads.json> <out.json>
#        python -I trocr_score.py subset <eval_words.json> <trocr reads.json> <out.json>   (same pages, our own scores)
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hwlib

def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]

if sys.argv[1] == 'subset':
    tpl, reads, outp = json.load(open(sys.argv[2])), json.load(open(sys.argv[3])), sys.argv[4]
    out = [t for t in tpl if t['page'] in reads]
else:
    tpl, reads, outp = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), sys.argv[3]
    out = []
    for t in tpl:
        if t['page'] not in reads: continue
        texts = reads[t['page']]
        assert len(texts) == len(t['rows']), (t['page'], len(texts), len(t['rows']))
        rows = []
        for r, tx in zip(t['rows'], texts):
            g = re.sub(r'[^a-z]', '', hwlib.fold(tx))
            rows.append(dict(t=r['t'], txt=r['txt'], s=[-float(lev(g, n)) for n in t['roster']]))
        out.append(dict(page=t['page'], target=t['target'], roster=t['roster'], norm=[float(len(n)) for n in t['roster']], rows=rows))
json.dump(out, open(outp, 'w'))
print(len(out), 'trials on', len(set(t['page'] for t in out)), 'pages')
