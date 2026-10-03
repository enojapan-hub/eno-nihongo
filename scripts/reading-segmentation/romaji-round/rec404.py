import json,re,sys,collections
sys.path.insert(0,'.')
from core import tokenize,clean_ja
from seg2 import segment
d=json.load(open('snap/live_pre2.json'))
M=json.load(open('../ex/meta.json')); V={v['id']:v for v in M['vocab']}; S={s['id']:s for s in M['senses']}
KAT=re.compile(r'^[ァ-ヶー・]+$'); HIR=re.compile(r'^[ぁ-ゟー]+$')
PUN=set('、。！？…「」『』（）・：，．')
def gen_reading(ja):
    ts,_=tokenize(clean_ja(ja)); out=[]; flags=[]
    for t in ts:
        s=t['s']
        if s in PUN or re.fullmatch(r'[、。！？…「」『』（）・：，．!?,.]+',s): out.append(s)
        elif KAT.match(s): out.append(s)
        elif HIR.match(s): out.append(s)
        else:
            out.append(t['r'])
            if re.search(r'[0-9０-９]',s): flags.append('digit:'+s)
            if re.search(r'[A-Za-zＡ-Ｚａ-ｚ]',s): flags.append('latin:'+s)
            if not re.fullmatch(r'[ぁ-ゟー]+',t['r']): flags.append('nonkana:'+t['r'])
    return ''.join(out),flags
rows=[]
for r in d:
    e=r['e']
    if r['table']!='vocabulary_senses' or (e.get('reading') or e.get('hiragana')): continue
    ja=(e.get('ja') or e.get('jp')).strip()
    rd,fl=gen_reading(ja)
    try:
        s=segment(ja,rd); st=s['status']; res=s['result'] if st=='ok' else None; verbs=s['verbs'] if st=='ok' else []
    except Exception as ex: st='err:'+str(ex)[:40]; res=None; verbs=[]
    sv=S[r['owner']]; v=V.get(sv['vocabulary_id'],{})
    rows.append(dict(owner=r['owner'],idx=r['idx'],ja=ja,en=e.get('en'),idm=e.get('id'),raw=rd,spaced=res,status=st,flags=fl,term=v.get('term'),trm=v.get('reading'),conj=[x for x in verbs if x['status']!='ok']))
json.dump(rows,open('../ex/rec404.json','w'),ensure_ascii=False)
c=collections.Counter(r['status'] for r in rows); print(c, sum(1 for r in rows if r['flags']),sum(1 for r in rows if r['conj']))
