import json,collections,subprocess
subprocess.run(['python3','fetch_now.py'],capture_output=True)
pre={(r['table'],r['owner'],r['idx']):r['e'] for r in json.load(open('snap/live_pre.json'))}
now={(r['table'],r['owner'],r['idx']):r['e'] for r in json.load(open('snap/live_now.json'))}
P={(p['table'],p['owner'],p['idx']):p for p in json.load(open('write_plan.json'))}
st=collections.Counter()
for k,e in now.items():
    p=P.get(k); o=pre[k]
    if e==o: st['unchanged']+=1; continue
    if p and e.get(p['key'])==p['new'] and {x:y for x,y in e.items() if x!=p['key']}=={x:y for x,y in o.items() if x!=p['key']}: st['as-planned']+=1
    else: st['UNEXPECTED']+=1; print(k,o,e)
print(dict(st), 'same keys:',set(pre)==set(now))
done={k for k in P if now[k]==pre[k]}
print('remaining planned', len(done))
