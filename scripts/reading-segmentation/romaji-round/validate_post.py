import json,re,sys,collections
sys.path.insert(0,'.')
from ralign import align
snap=sys.argv[1]
d=json.load(open(snap))
HOLD={'142383f2','d6733540','f83202ab'}   # intentional （が）（に）（を） usage annotations (pre-existing)
CONJ={'masu','mashita','masen','mashou','mase','nai','nakatta','ta','te','de','reru','rareru','seru','saseru','tai','nakereba','nagara'}
TYPO={('1e9a30b6',0):'suutukeesu',('4491dec1',0):'sodate imasu',('91dc8243',0):'sodate imasu',('52f07014',0):'katsuki ga',('590c21a5',0):'enjirimashita',('643522ad',0):'tsukarimashita',('7809d4bf',0):'ison shisugite',('9dd7cebf',0):'minna ni',('bef32257',0):'maitsuki matsu',('d10270a9',0):'hiite',('d8b56d7a',0):'wakehedateru beki',('d8fc7280',0):'Kinkyuji',('462ae0aa',0):'sanjuu senchi',('39f17a6f',0):'de wa yatte',('d2c504c1',0):'ni wa Edo'}
KNOWN_UNRESOLVED={'5506b37f','4d04bd1c'}
rd=lambda e:(e.get('reading') or e.get('hiragana') or '').strip()
ja=lambda e:(e.get('ja') or e.get('jp') or '').strip()
C=collections.Counter(); L=collections.defaultdict(list)
for r in d:
    e=r['e']; k=(r['table'],r['owner'][:8],r['idx']); R=rd(e); ro=(e.get('romaji') or '').strip(); a=(e.get('id') or '').strip()
    C['total']+=1
    if R: C['reading']+=1
    if ro: C['romaji']+=1
    if a: C['arti']+=1
    if not R: L['reading-missing'].append(k)
    if not ro: L['romaji-missing'].append(k)
    if not a: L['arti-missing'].append(k)
    if r['owner'][:8] in HOLD: C['hold-annotation-skipped']+=1
    elif R and ro:
        ok,rb,bnd,iss,ps=align(R,ro)
        if not ok: L['reading-romaji-mismatch' + ('(known source quirk)' if r['owner'][:8] in KNOWN_UNRESOLVED else '')].append((k,R,ro,iss[-1:]))
        else:
            pass
            miss=bnd-rb
            if miss: L['invalid-spacing(romaji lacks reading boundary)'].append((k,sorted(miss),R,ro))
            RT={'masu':'ます','mashita':'ました','masen':'ません','mashou':'ましょう','mase':'ませ'}
            units=[u.strip('、，。！？!?…「」『』（）() ') for u in re.split(r'[ 　]+',R)]
            for t,kana in RT.items():
                nr=len([x for x in re.findall(r"[A-Za-z']+",ro.lower()) if x==t]); nu=units.count(kana)
                if nr>nu: L['conjugation-split(romaji token without reading unit)'].append((k,t,R,ro)); break
    if ro:
        jj=ja(e)
        if any(t.lower() in ('ha','wo','he') for t in re.findall(r"[A-Za-z']+",ro)) and any(c in jj for c in 'はをへ') and not re.search(r'[歯葉派刃母羽覇]',jj): L['invalid-particle-romanization'].append((k,ro))
        t=TYPO.get((r['owner'][:8],r['idx']))
        if t and re.search(r'(?<![A-Za-z])'+re.escape(t),ro): L['known-typo'].append((k,t,ro))
        if re.search(r'[0-9０-９]',ro) and not re.search(r'[0-9０-９]',R): L['digit-in-romaji'].append((k,ro))
        if re.search(r'[ぁ-んァ-ヶ一-龥]',ro): L['mixed-script-romaji'].append((k,ro))
        if ro[-1].isalpha() and ja(e) and re.search(r'[。！？]$',ja(e)): L['romaji-no-final-punct(truncation?)'].append((k,ro))
    if a:
        if a.startswith('Contoh penggunaan'): L['arti-placeholder'].append((k,a))
        if re.search(r'\b(the|is|are|was|were|you|did)\b',a) and not re.search(r'\b(yang|dan|di|ke)\b',a): L['arti-non-indonesian'].append((k,a))
for k in ('6f797513','0a729f65'):
    pass
print(dict(C))
for k,v in sorted(L.items()): print(len(v),k)
json.dump({k:[str(x) for x in v] for k,v in L.items()},open(sys.argv[2] if len(sys.argv)>2 else 'val_out.json','w'),ensure_ascii=False)
