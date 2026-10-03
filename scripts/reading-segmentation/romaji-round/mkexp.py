import json,copy
d=json.load(open('../romaji/snap/live_pre2.json')); P=json.load(open('master_plan.json'))
m={(p['table'],p['owner'],p['idx']):p['fields'] for p in P}
out=[]
for r in d:
    k=(r['table'],r['owner'],r['idx']); r=copy.deepcopy(r)
    for f,v in m.get(k,{}).items(): r['e'][f]=v['new']
    out.append(r)
json.dump(out,open('../romaji/snap/expected_post.json','w'),ensure_ascii=False)
# reading-changed keys for validator exemption (REP)
F=json.load(open('../romaji/final_fix.json'))
have={(a,b,c) for a,b,c,_ in F}
add=[]
for p in P:
    for f,v in p['fields'].items():
        if f in('reading','hiragana') and (p['table'],p['owner'],p['idx']) not in have:
            add.append([p['table'],p['owner'],p['idx'],v['new']])
json.dump(F+add,open('../romaji/final_fix_v2.json','w'),ensure_ascii=False)
print(len(out),len(F),len(add))
