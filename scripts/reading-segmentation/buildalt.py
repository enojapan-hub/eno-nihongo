import json,sys,collections,re
sys.path.insert(0,'.')
import segmenter
from segmenter import *
V=json.load(open('vocab_terms.json'))
alt=collections.defaultdict(collections.Counter)
for v in V:
    t=v['term']; r=k2h(v['reading'] or '')
    if t and r and not KANA_ONLY.match(t): alt[t][re.sub(r'\s','',r)]+=10
O=json.load(open('all.json'))
def rdk(e): return e.get('reading') or e.get('hiragana') or ''
def jaf(e): return (e.get('ja') or e.get('jp') or '').strip()
for r in O:
    e=r['e'];x=rdk(e);j=jaf(e)
    if not x or not j: continue
    ts,cs=tokenize_chunks(j); R=k2h(re.sub(r'[\s　]+','',x))
    cost,sp=align([t['r'] for t in ts],R,[t['s'] for t in ts])
    prev=0
    for i,t in enumerate(ts):
        cands=sp[i][0]
        if len(cands)!=1: prev=None; continue
        end=cands[0]
        if prev is not None and not KANA_ONLY.match(t['s']) and end>prev:
            alt[t['s']][R[prev:end]]+=1
        prev=end
out={}
for s,c in alt.items():
    out[s]=[r for r,n in c.most_common(4)]
json.dump(out,open('alt.json','w'),ensure_ascii=False)
print(len(out), out.get('明日'), out.get('今日'), out.get('何'), out.get('一'))
