import json,re,sys,collections
sys.path.insert(0,'.')
from overrides import OV
N=json.load(open('seg2_out.json'))
A=json.load(open('all.json'))
norm=lambda s:re.sub(r'[\s　]','',s).replace('，','、')
def apply_spacing(old,spaced):
    R0=re.sub(r'[\s　]','',old)
    assert norm(spaced)==norm(R0),(old,spaced)
    out=[];k=0
    for ch in spaced:
        if ch==' ': out.append(' ')
        else: out.append(R0[k]);k+=1
    return ''.join(out)
def spaces(t):
    k=0;S=set()
    for ch in t.strip():
        if ch in ' 　': S.add(k)
        else: k+=1
    return S
# source-corrupt (D) set
D={}
for r in N:
    if r.get('status')!='ok': continue
    key=(r['table'],r['owner'],r['idx'])
    x=r['old']
    if re.search(r'[（）]',x) and not re.search(r'[（）]',r['ja']): D[key]='annotation-contamination'
    elif re.search(r'[0-9０-９]',x): D[key]='raw-number-in-reading'
    elif r['ja'] in ('こんな所出よう！','二十日日本にいます。'): D[key]='ja-reading-mismatch (source typo in ja)'
HARD_J={'aux-conj','conj-te','prefix','adj-nai','adj-arimasen','aux-beki-rashii-mai','pp-compound','node','nagara-noun','tari-tomo','adv-zutsu','num-unit','num-kata-unit'}
cands=[];stat=collections.Counter();cls=collections.Counter();rulecount=collections.Counter()
single=multi=0
for r in N:
    if r.get('status')!='ok': continue
    key=(r['table'],r['owner'],r['idx'])
    new=r['new']
    if r['ja'] in OV: new=apply_spacing(r['old'],OV[r['ja']])
    assert norm(new)==norm(re.sub(r'[\s　]','',r['old'])),r['old']
    if ' ' in new.strip(): multi+=1
    else: single+=1
    # old vs new classification
    olds=spaces(r['old']); news=spaces(new)
    if r['old']==new: c='A'
    elif not olds: c='C-unsegmented'
    else:
        wrong=False
        for off in olds-news:
            rule=r['rules'].get(str(off),('?',))[0]
            if (off not in map(int,r['rules'])) and off not in r['punctadj']: wrong=True  # inside a token
            if rule in HARD_J or rule.startswith('lexicalized-ENO'): wrong=True
        c='C-invalid-split' if wrong else 'B'
    for off,v in r['rules'].items(): rulecount[v[0]]+=1
    cls[c]+=1
    if key in D: stat['excluded-D']+=1; continue
    if new==r['old']: continue
    # character difference other than whitespace
    assert re.sub(r'[\s　]','',new)==re.sub(r'[\s　]','',r['old'])
    cands.append(dict(table=r['table'],owner=r['owner'],idx=r['idx'],key=r['key'],ja=r['ja'],old=r['old'],new=new,
        vocab_units=[u[1] for u in r['units']],
        verbs=[dict(lemma=v['lemma'],group=v['group'],form=v['p5'],status=v['status'],rule=v['rule']) for v in r['verbs']],
        category=c,manual=(r['ja'] in OV),char_diff=0))
json.dump(cands,open('final2.json','w'),ensure_ascii=False)
json.dump({'%s|%s|%s'%k:v for k,v in D.items()},open('source_corrupt.json','w'),ensure_ascii=False,indent=1)
print('candidates',len(cands),dict(cls),dict(stat),'single',single,'multi',multi)
print(collections.Counter((c['table'],c['key']) for c in cands))
print(rulecount.most_common(40))
