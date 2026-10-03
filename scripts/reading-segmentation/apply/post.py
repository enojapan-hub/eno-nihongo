import json,re,collections
pre={(r['table'],r['owner'],r['idx']):r['e'] for r in json.load(open('snap/live_pre.json'))}
now={(r['table'],r['owner'],r['idx']):r['e'] for r in json.load(open('snap/live_now.json'))}
F={(f['table'],f['owner'],f['idx']):f for f in json.load(open('final2.json'))}
c=collections.Counter()
print('elements pre/now',len(pre),len(now),'same keys',set(pre)==set(now))
bad=collections.defaultdict(list)
for k,e in now.items():
    o=pre[k]
    # non-target fields unchanged
    tk=F[k]['key'] if k in F else None
    for f in set(e)|set(o):
        if f==tk: continue
        if e.get(f)!=o.get(f): c['NONTARGET_FIELD_CHANGED']+=1; bad['nt'].append((k,f))
    for fld in ('ja','jp','romaji','id'):
        if e.get(fld)!=o.get(fld): c['ja/romaji/arti changed']+=1
    if k in F:
        if e[tk]!=F[k]['new']: c['target!=planned']+=1; bad['tp'].append(k)
        if re.sub(r'\s','',e[tk])!=re.sub(r'\s','',o[tk]): c['chars changed']+=1
        c['targets']+=1
    for fld in ('reading','hiragana'):
        x=e.get(fld)
        if not x: continue
        c['checked']+=1
        if '  ' in x or '　' in x or '\t' in x or '\n' in x: c['double-space']+=1; bad['ds'].append((k,x))
        if re.search(r'[、，] ',x) and re.search(r'[、，] ',x): c['space-after-comma']+=1; bad['sac'].append((k,x))
        if re.search(r' [。．！？、，]',x): c['space-before-end-punct']+=1; bad['sbp'].append((k,x))
        if x!=x.strip(): c['lead/trail ws']+=1
        for tok in re.split(r'[ 、，。．！？…]+',x):
            if tok in ('ませんでした','ましょう','れて','られて','ながら'): c['split-conj']+=1
print(dict(c))
for k,v in bad.items(): print(k,len(v),v[:5])
