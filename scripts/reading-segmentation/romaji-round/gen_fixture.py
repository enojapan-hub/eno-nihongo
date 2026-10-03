import json,re,random
random.seed(7)
live={(r['table'],r['owner'],r['idx']):r['e'] for r in json.load(open('../romaji/snap/live_now.json'))}
pre={(r['table'],r['owner'],r['idx']):r['e'] for r in json.load(open('../romaji/snap/live_pre2.json'))}
plan=json.load(open('master_plan.json'))
P={(p['table'],p['owner'],p['idx']):p['fields'] for p in plan}
rd=lambda e:(e.get('reading') or e.get('hiragana') or '')
ja=lambda e:(e.get('ja') or e.get('jp') or '')
out=[]
def add(cat,k,**kw):
    e=live[k]; o=pre[k]
    out.append(dict(category=cat,id=k[1][:8]+'#%d'%k[2],table=k[0],ja=ja(e),reading=rd(e),romaji=e.get('romaji') or '',arti=e.get('id') or '',
        before={f:(o.get(f)) for f in P.get(k,{})} if k in P else None,**kw))
def pick(cat,pred,n,keys=None):
    ks=[k for k in (keys or P) if k in P and pred(k,P[k])]
    random.shuffle(ks)
    for k in ks[:n]: add(cat,k)
cats=lambda f:(lambda k,fs: f in fs and fs[f]['cat'].startswith(c_))
# romaji content repairs (all of them, they are the regression targets)
for k,fs in P.items():
    if 'romaji' in fs and fs['romaji']['cat']=='C/G romaji content' and len(out)<400: add('romaji repair: typo / wrong romanization / contraction / digit',k)
n0=len(out)
pick('romaji repair: spacing only (romaji boundary matches Reading)',lambda k,fs:'romaji' in fs and fs['romaji']['cat']=='B spacing only',14)
pick('missing-reading recovery',lambda k,fs:'reading' in fs and fs['reading']['cat']=='missing-reading recovered',24)
pick('reading source repair: stray space / stuck particle / kanji left',lambda k,fs:any(f in fs and fs[f]['cat']=='J source-corrupt' for f in('reading','hiragana')),12)
pick('reading source repair: lexical word rejoined',lambda k,fs:any(f in fs and fs[f]['cat'].startswith('J source-corrupt (lex') for f in('reading','hiragana')),16)
pick('arti repair: template placeholder removed',lambda k,fs:'id' in fs and fs['id']['cat']=='placeholder/template arti',14)
pick('arti repair: wrong meaning corrected',lambda k,fs:'id' in fs and fs['id']['cat']=='wrong arti (JA mismatch)',2)
pick('arti repair: empty arti filled from Japanese',lambda k,fs:'id' in fs and fs['id']['cat']=='A-empty arti filled',20)
# unchanged-reference rows for linguistic classes
def ref(cat,pred,n,tables=None):
    ks=[k for k,e in live.items() if k not in P and rd(e) and e.get('romaji') and pred(rd(e),e['romaji'],ja(e))]
    random.shuffle(ks)
    for k in ks[:n]: add(cat,k)
ref('particle romanization (は→wa, を→o, へ→e)',lambda r,ro,j:' は ' in r and ' を ' in r and ' へ ' in r and ' wa ' in ro and ' o ' in ro and ' e ' in ro,6)
ref('long vowel (ou/oo/uu/ei)',lambda r,ro,j:('ょう' in r or 'おお' in r or 'ゅう' in r) and re.search(r'ou|oo|uu',ro) and len(r)<30,6)
ref('small tsu (っ) gemination',lambda r,ro,j:'っ' in r and re.search(r'kk|ss|tt|pp|cch',ro) and len(r)<30,6)
ref('katakana loanword (ー long mark)',lambda r,ro,j:re.search(r'[ァ-ヶ]ー',r) and len(r)<32,6)
ref('Group 1/2/3 verb forms (ます/て/ない kept whole)',lambda r,ro,j:re.search(r'(ました|ません|ません|して います|しない)',r) and len(r)<30,6)
ref('punctuation (、 。 ？ ！ attached)',lambda r,ro,j:'、' in r and ('？' in r or '！' in r) and len(r)<40,4)
# grammar sample: arti present, meaning field untouched
gk=[k for k,e in live.items() if k[0]=='grammar_points' and e.get('id') and k not in P]
random.shuffle(gk)
for k in gk[:8]: add('grammar example (Bunpō) four fields intact',k)
for i,x in enumerate(out): x['n']=i
json.dump(out,open('example-repair-round2.json','w'),ensure_ascii=False,indent=1)
import collections
print(len(out)); print(collections.Counter(x['category'] for x in out))
