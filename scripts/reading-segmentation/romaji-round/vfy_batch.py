import json,sys,copy,collections
upto=int(sys.argv[1])
pre=json.load(open('../romaji/snap/live_pre2.json')); now=json.load(open('../romaji/snap/live_now.json')); P=json.load(open('master_plan.json'))
def batch(f,cat):
    return 3 if f=='id' else 2 if f=='romaji' else 1 if cat.startswith('missing-reading') else 4
m={(p['table'],p['owner'],p['idx']):p['fields'] for p in P}
K=lambda r:(r['table'],r['owner'],r['idx'])
exp={}
for r in pre:
    e=copy.deepcopy(r['e'])
    for f,v in m.get(K(r),{}).items():
        if batch(f,v['cat'])<=upto: e[f]=v['new']
    exp[K(r)]=e
nk={K(r):r['e'] for r in now}
print('same key set',set(exp)==set(nk),len(nk))
bad=collections.Counter(); applied=0; ex=[]
for k,e in exp.items():
    if nk.get(k)!=e:
        bad[k[0]]+=1
        if len(ex)<5: ex.append((k,{f:(nk[k].get(f),e.get(f)) for f in set(e)|set(nk[k]) if nk[k].get(f)!=e.get(f)}))
print('mismatch vs expected after batch',upto,':',sum(bad.values()),dict(bad)); print(ex)
# changed elements count vs pre
pk={K(r):r['e'] for r in pre}; ch=sum(1 for k in nk if nk[k]!=pk[k]); print('elements changed vs pre-write:',ch)
