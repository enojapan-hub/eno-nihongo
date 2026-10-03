import json,hashlib,string
A=string.digits+string.ascii_lowercase+string.ascii_uppercase
f=json.load(open('final2.json'))
plan=[];rows={}
for c in f:
    s=c['old'].replace(' ','')
    assert c['new'].replace(' ','')==s
    segs=c['new'].split(' '); assert all(segs)
    seg=''.join(A[len(x)] for x in segs)
    g=hashlib.md5(c['old'].encode()).hexdigest()[:6]
    k='r' if c['key']=='reading' else 'h'
    rows.setdefault(c['table'],[]).append(f"('{c['owner'][:8]}',{c['idx']},'{k}','{g}','{seg}')")
    plan.append({k2:c[k2] for k2 in('table','owner','idx','key','ja','old','new','vocab_units','verbs','category')}|{'path':f"examples[{c['idx']}].{c['key']}",'guard_md5_6':g,'nonspace_diff':0})
json.dump(plan,open('write_plan.json','w'),ensure_ascii=False)
B=400;n=0
tmpl=open('tmpl.sql').read()
for t,r in rows.items():
    for i in range(0,len(r),B):
        open(f'w_{t}_{i//B:03d}.sql','w').write(tmpl.replace('@T@',t).replace('@V@',',\n'.join(r[i:i+B])));n+=1
print(n,{t:len(r) for t,r in rows.items()})
