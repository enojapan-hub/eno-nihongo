import sys,re,json
sys.path.insert(0,'.')
from core import *
from numkana import num2kana
from eno_lex import build as build_eno, COMPOUND_CASE
from conj import expected_verb_stem, expected_adj_stem, group_of, verify_verb, lemma_readings, _rend
ENO=build_eno()
SAHEN_LEMMAS={'する','為る','できる','出来る','致す','いたす','なさる','為さる'}
SAHEN_NOUNS=set(ENO['sahen_nouns'])
KATA=re.compile(r'^[゠-ヿー]+$'); KANJI=re.compile(r'[一-鿿々]'); KANA_ONLY=re.compile(r'^[ぁ-ゟ゠-ヿー、。！？・「」…]+$')
INTERROG={'何','誰','どこ','いつ','どれ','どちら','どっち','いずれ','なに','だれ','なん','いくつ','いくら','幾つ','幾ら'}
CONJ_TE={'て','で','ば','たり','だり','ながら','つつ','ちゃ','じゃ','たって','だって'}
PP_FIRST={'に','へ','と','で','から','まで','より'}
PP_SECOND={'は','も','の'}
SAHEN_FORMS={'する','し','さ','せ','しろ','すれ','できる','でき','いたす','いたし','なさる','なさい'}
HARD_LEX={'ありのまま','有りのまま','しかるべき','然るべき','もうすぐ','もしかしたら','もしかして','もしかすると','若しかしたら','若しかして','なにより','何より','なんと','何と','こういう','そういう','ああいう','どういう','こういった','そういった','ああいった','どういった','ことによると','事によると','ものともせず','ものともしない','ことながら','たりとも','しかしながら','ざんねんながら','残念ながら','然しながら','ならでは','とやら','いえども','さることながら','とともに','もしも','どうしても','すこしずつ','少しずつ','かならずしも','必ずしも','まだしも'}
ADV_LIKE={'ほとんど','たくさん','だいぶ','ずいぶん','すっかり','ぜんぶ','全部','だいたい','大体','大勢','全然','絶対'}
BOUND_V={'込む','合う','続ける','始める','直す','過ぎる','損なう','兼ねる','かねる','込める','換える','替える'}
def is_punct(t): return t['pos'] in ('補助記号','空白')
def covered(cs,a,b): return any(s<=a['start'] and b['end']<=e for s,e,_,_ in cs)
def orth(t): return 'K' if KATA.match(t['s']) else ('J' if KANJI.search(t['s']) else 'h')
def decide(a,b,cs,prev=None):
    """returns (join: bool, hard: bool, rule: str)"""
    ap,bp=a['pos'],b['pos']
    for cs_,ce_,cp_,cp2_ in cs:
        if cs_<=a['start'] and b['end']<=ce_ and cp_ in('副詞','接続詞','連体詞','感動詞','LEX','ENOV','ENOG') and not(ap=='助詞' and a['s'] in('て','で') and bp=='動詞' and cp_ not in('ENOV','ENOG')):
            return True,(cp_ in('ENOV','ENOG') or (cp_=='LEX' and cp2_ in HARD_LEX)),'lexicalized-'+cp_
    if bp=='助詞' and b['s'] in('は','も','の') and any(ce_==a['end'] and cp_=='ENOG' for cs_,ce_,cp_,cp2_ in cs): return True,True,'compound-case+'+b['s']
    if ap=='接頭辞': return True,True,'prefix'
    if b['s']=='ん' and bp in('助詞','助動詞') and (ap in('動詞','形容詞','助動詞') or a['s']=='な') and not (bp=='助動詞' and ap in('動詞','形容詞','助動詞')): return True,False,'n-nominal'
    if a['s']=='ん' and ap in('助詞',) and bp=='助動詞' and (b['p4'].startswith('助動詞-ダ') or b['p4'].startswith('助動詞-デス')): return True,False,'n+cop'
    if bp=='接尾辞': return True,False,('suffix' if b['p2']=='名詞的' or b['p2']=='形状詞的' else 'suffix-verbal')
    if a['p2']=='数詞' and ap=='名詞' and bp=='名詞':
        if b['p2']=='数詞' or (b['p3'] in('助数詞','助数詞可能','副詞可能') and not KATA.match(b['s'])): return True,True,'num-unit'
        if b['p3']=='助数詞' or KATA.match(b['s']): return True,True,'num-kata-unit'
    if a['p3'] in('助数詞','助数詞可能') and bp=='名詞' and b['p2']=='数詞': return False,True,'counter|num'
    if bp=='助動詞':
        lem=b['lemma']
        iscop=b['p4'].startswith('助動詞-ダ') or b['p4'].startswith('助動詞-デス')
        if iscop:
            if ap=='助詞' and a['s']=='の' and b['s']=='で': return True,True,'node'
            if ap=='副詞' and b['s']=='なら' : return True,False,'nazenara'
            if ap in('形状詞',) or (ap=='名詞' and a['p3']=='形状詞可能'):
                if a['s'] in('よう','ふう','みたい') and b['s'] in('な','に'): return False,False,'you-na'
                if b['s'] in('な','に','で'): return False,False,'na-adj-form'
            if ap=='名詞' and b['s'] in('な','に'): return False,False,'na-adj-form'
            if b['s']=='で' and ap in('名詞','代名詞'): return False,False,'cop-de|noun'
            if ap=='名詞' and a['p3']!='形状詞可能' and b['s']=='な' and False: pass
            if a['s']=='だ' and a['lemma']=='だ' and False: pass
            if ap in('名詞','代名詞','形状詞'): return False,True,'cop|noun'
            if ap in('副詞','連体詞','接尾辞','感動詞','接続詞'): return False,False,'cop|adv'
            return False,False,'cop|pred'
        if lem in('べし','らしい','まい') and (ap in('動詞','形容詞','助動詞') or (ap=='接尾辞' and a['p2'] in('形容詞的','動詞的'))): return True,True,'aux-beki-rashii-mai'
        if lem in('べし','らしい','まい'): return False,False,'beki'
        if ap in('動詞','形容詞','助動詞') or (ap=='接尾辞' and a['p2'] in('形容詞的','動詞的')): return True,True,'aux-conj'
        if ap in('名詞','形状詞','代名詞'): return False,False,'aux|noun'
        return False,False,'aux|other'
    if bp=='助詞':
        s=b['s']; p2=b['p2']
        if ap=='副詞' and s in('ずつ','しも'): return True,True,'adv-zutsu'
        if a['s']=='たり' and s=='とも': return True,True,'tari-tomo'
        if s in CONJ_TE and (p2=='接続助詞' or s in('たり','だり','たって','だって')) and (ap in('動詞','形容詞','助動詞') or (ap=='接尾辞' and a['p2'] in('形容詞的','動詞的'))): return True,not(a['s']=='ない' and s=='で'),'conj-te'
        if s=='ながら' and ap in('名詞','形状詞','副詞','接尾辞','代名詞'): return True,True,'nagara-noun'
        if s in PP_SECOND|{'に'} and ap=='助詞' and a['s'] in PP_FIRST and a['p2'] in('格助詞','副助詞') and not(a['s']=='で' and a['p2']=='接続助詞'):
            if (s in PP_SECOND) or (a['s']=='まで' and s=='に'): return True,True,'pp-compound'
        if s in PP_SECOND and ap=='助動詞' and a['s'] in('で','に') and a['lemma']=='だ': return True,True,'pp-compound'
        if s=='か' and a['s'] in INTERROG and ap in('名詞','代名詞'): return True,False,'interrog-ka'
        if s in('ので','のに') and ap=='助動詞' and a['s']=='な': return True,False,'na-node'
        if a['s']=='だ' and ap=='助動詞' and a['p4'].startswith('助動詞-ダ') and s in('から','けど','けれど','けれども','って','が'): return True,False,'da-conj'
        if p2=='終助詞' and ap=='助詞' and a['s'] in('て','で'): return True,False,'te-final'
        if p2=='終助詞' and s=='な' and ap in('動詞','助動詞'): return True,False,'neg-imp-na'
        if p2=='終助詞' and s=='な' and ap in('動詞','助動詞'): return True,False,'neg-imp-na'
        if ap=='助動詞' and p2=='終助詞': return False,False,'final-part'
        if a['s']=='か' and ap=='助詞' and s=='も': return True,False,'ka-mo'
        if p2=='接続助詞' and s in('ても','でも') : return False,False,'temo'
        if a['s'] in('て','で') and a['p2']=='接続助詞' and s in('も',): return False,False,'te|mo'
        return False,True,'particle'
    if bp=='動詞':
        if ap=='形容詞' and a['p5'].startswith('連用') and b['lemma']=='ある': return True,True,'adj-arimasen'
        if ap=='助詞' and a['s'] in('て','で') and a['p2']=='接続助詞': return False,True,'te|aux-verb'
        if ap=='動詞' and a['p5'].startswith('連用'): return True,False,'compound-verb'
        if ap in('形容詞','形状詞') and b['p2']=='非自立可能' and b['lemma'] in('過ぎる','すぎる','続ける','始める','出す','やすい','にくい'): return True,False,'adj-compound'
        if ap=='名詞' and b['lemma'] in SAHEN_LEMMAS and (a['p3'] in('サ変可能','サ変形状詞可能') or a['s'] in SAHEN_NOUNS) and not(prev is not None and prev['pos']=='助詞' and False):
            return True, True,'sahen-unit'
        if ap in('名詞','形容詞','形状詞','副詞') and covered(cs,a,b) and b['p2']!='非自立可能': return True,False,'C-compound-verb'
        if ap in('名詞','動詞') and b['lemma'] in BOUND_V and not(ap=='動詞' and not a['p5'].startswith('連用')): return True,False,'bound-verb'
        if ap=='助詞' : return False,True,'particle|verb'
        return False,False,'verb'
    if bp=='形容詞' and ap=='形容詞' and a['p5'].startswith('連用') and b['lemma'] in('ない','無い') : return True,True,'adj-nai'
    if bp=='形容詞' and ap in('形容詞','接尾辞') and a['p5'].startswith('連用') and b['p2']=='非自立可能' and b['lemma'] in('良い','よい','いい') and False: return True,False,'adj-yoi'
    if bp=='形状詞' and b['s']=='そう' and ap in('動詞','形容詞'): return True,False,'sou'
    if bp=='名詞' and ap=='形状詞' and covered(cs,a,b): return True,False,'na+noun-C'
    if ap=='名詞' and a['s'] in ADV_LIKE and bp in('名詞','動詞','形容詞','形状詞'): return False,False,'adv-like'
    if bp=='名詞' and ap=='名詞' and b['p2']=='数詞' and a['p2']!='数詞': return False,False,'noun|num'
    if bp=='名詞' and ap=='名詞' and a['p3'] in('助数詞可能','助数詞') and prev and prev['p2']=='数詞' and b['p3'] not in('助数詞','助数詞可能') and b['p2']!='数詞': return False,False,'counter|noun'
    if bp=='名詞' and ap=='名詞':
        if a['p3']=='助数詞' and b['p2']=='数詞': return False,True,'counter|num'
        if a['p3']=='副詞可能' and not(b['p3'] in('助数詞','副詞可能')) : return False,False,'time|noun'
        if a['p2']=='固有名詞' and b['p2']!='固有名詞': return True,False,'propn+noun'
        if b['p3']=='助数詞': return True,False,'noun+counter'
        if orth(b)=='h' and b['p3']=='一般' and not covered(cs,a,b): return False,False,'noun|hira-noun'
        if covered(cs,a,b) or orth(a)=='K' and orth(b)=='K': return True,False,'compound-noun'
        return True,False,'compound-noun2'
    if ap=='助詞': return False,True,'particle|next'
    return False,False,'default'
CONJ_NEEDS_COMMA={'それで','それでは','それに','それなら','それでも','だから','ですから','だけど','だって','けれども','ところが','ところで','そこで','すると','それとも','所が','所で'}
SENT_START_ONLY={'所が','所で','それで','それも','これから','あれから','ところが','ところで','だから','だって','だけど','それで','それでは','それでも','それに','それなら','それとも','すると','ですから','けれども','したがって','そして','そうして','それから','こうして','ちなみに','あまりにも'}
ALT={}
LEX=set()
def build_lex():
    import json,os
    if not os.path.exists('vocab_terms.json'): return
    if os.path.exists('lex.json'):
        LEX.update(json.load(open('lex.json'))); return
    for v in json.load(open('vocab_terms.json')):
        t=v['term']
        if not t or re.search(r'[／〜\s（）…]',t): continue
        ts,_=tokenize(clean_ja(t)); ts=[x for x in ts if not is_punct(x)]
        if len(ts)<2: continue
        seen_p=False; ok=True
        for x in ts:
            if x['pos']=='助詞' and x['s'] in('を','が'): ok=False;break
            if seen_p and x['pos'] not in('助詞','助動詞'): ok=False;break
            if x['pos']=='助詞': seen_p=True
        if ok and not any(x['pos']=='動詞' for x in ts[-1:]) : LEX.add(clean_ja(t))
    json.dump(sorted(LEX),open('lex.json','w'),ensure_ascii=False)
def load_alt():
    import json,os
    if os.path.exists('alt.json'): ALT.update(json.load(open('alt.json')))
load_alt()
def best_align(ts,R):
    base=[t['r'] for t in ts]; surf=[t['s'] for t in ts]
    cost,sp=align(base,R,surf)
    amb=lambda sp:sum(1 for i in range(len(sp)-1) if len(sp[i][0])>1)
    if amb(sp)==0: return cost,sp,base
    def alts_of(t):
        out=list(ALT.get(t['s'],[]))
        if DIGITS.match(t['s']): out+=num2kana(t['s'])
        lem=t['lemma']
        if lem and lem!=t['s'] and ALT.get(lem):
            kj=re.match(r'^([^ぁ-ゟ]+)',lem)
            if kj and t['s'].startswith(kj.group(1)):
                tail_l=lem[len(kj.group(1)):]; tail_s=t['s'][len(kj.group(1)):]
                for rd in ALT[lem]:
                    if rd.endswith(tail_l): out.append(rd[:len(rd)-len(tail_l)]+tail_s)
        return list(dict.fromkeys(out))
    idxs=[i for i,t in enumerate(ts) if not KANA_ONLY.match(t['s']) and alts_of(t)]
    import itertools
    opts=[[base[i]]+[a for a in alts_of(ts[i]) if a!=base[i]][:4] for i in idxs]
    best=(cost,amb(sp),sp,base)
    n=0
    for combo in itertools.product(*opts):
        n+=1
        if n>96: break
        tr=list(base)
        for i,a in zip(idxs,combo): tr[i]=a
        c,sp2=align(tr,R,surf)
        key=(c,amb(sp2))
        if key<best[:2]: best=(c,amb(sp2),sp2,tr)
    return best[0],best[2],best[3]

COMPOUND_CASE_SET=set(COMPOUND_CASE)
def eno_spans(ts):
    VS=ENO['voc_surf']; VL=ENO['voc_lemkey']; n=len(ts); out=[]
    for i in range(n):
        for j in range(i+2,min(n,i+7)+1):
            toks=ts[i:j]
            if any(is_punct(x) for x in toks): break
            sur=''.join(x['s'] for x in toks)
            if sur in VS: out.append((toks[0]['start'],toks[-1]['end'],'ENOV',sur))
            last=toks[-1]
            if last['pos'] in('動詞','形容詞'):
                key=''.join(x['s'] for x in toks[:-1])+last['lemma']
                if key in VL: out.append((toks[0]['start'],toks[-1]['end'],'ENOV',key))
    for i in range(n):
        for j in range(i+2,min(n,i+6)+1):
            toks=ts[i:j]
            if any(is_punct(x) for x in toks): break
            sur=''.join(x['s'] for x in toks)
            if sur in COMPOUND_CASE_SET: out.append((toks[0]['start'],toks[-1]['end'],'ENOG',sur))
    return out
def split_compound_tokens(ts):
    out=[]
    for i,t in enumerate(ts):
        if t['s'] in('ては','ても','でも','では') and t['pos']=='助詞' and t['p2']=='接続助詞' and out and out[-1]['pos'] in('動詞','形容詞','助動詞','接尾辞'):
            a=dict(t); b=dict(t)
            a['s']=t['s'][0]; a['r']=t['r'][:1]; a['end']=t['start']+1; a['lemma']=a['s']
            b['s']=t['s'][1]; b['r']=t['r'][1:]; b['start']=t['start']+1; b['p2']='係助詞'; b['lemma']=b['s']
            out+=[a,b]
        else: out.append(t)
    return out
def segment(ja,reading):
    """Candidate segmentation of `reading` from Japanese `ja` (authored spacing of the old reading is ignored)."""
    ts,cs=tokenize_chunks(ja)
    cs=list(cs)
    ts=split_compound_tokens(ts)
    if not LEX: build_lex()
    for i in range(len(ts)):
        for j in range(i+2,min(len(ts),i+7)+1):
            sur=''.join(x['s'] for x in ts[i:j])
            if sur in LEX or sur in CONJ_NEEDS_COMMA:
                if sur in SENT_START_ONLY and i>0 and not is_punct(ts[i-1]): continue
                if sur in CONJ_NEEDS_COMMA and not (i==0 or (is_punct(ts[i-1]) and ts[i-1]['s'] in '。！？')): continue
                if sur in CONJ_NEEDS_COMMA and not (j==len(ts) or ts[j]['s']=='、'): continue
                cs.append((ts[i]['start'],ts[j-1]['end'],'LEX',sur))
    for i in range(len(ts)-2):
        if ts[i]['s']=='と' and ts[i+1]['s'] in('とも','共') and ts[i+2]['s']=='に': cs.append((ts[i]['start'],ts[i+2]['end'],'LEX','とともに'))
    espans=eno_spans(ts); cs+=espans
    R0=re.sub(r'[\s　]+','',reading); R=k2h(R0)
    if not ts: return dict(status='noja')
    cost,sp,_tr=best_align(ts,R)
    n=len(ts)
    KAN=lambda t:bool(KANA_ONLY.match(t['s']))
    final=set(); unsure=[]; bounds=[]
    ends=[]  # token end offsets in R0 when unique
    for i in range(n):
        c_=sp[i][0] if i<n-1 else [len(R0)]
        ends.append(c_[0] if len(c_)==1 else None)
    for i in range(n-1):
        a,b=ts[i],ts[i+1]
        cands=sp[i][0]
        if is_punct(a) or is_punct(b):
            off=cands[0] if len(cands)==1 else max(cands)
            bounds.append((off,None,None,'punct')); continue
        j,hard,rule=decide(a,b,cs,ts[i-1] if i>0 else None)
        rel=True
        if len(cands)==1: off=cands[0]
        else:
            ka,kb=KAN(a),KAN(b)
            if (not ka) and kb: off=max(cands)
            elif ka and (not kb): off=min(cands)
            else: off=cands[0]; rel=False
        bounds.append((off,(j,hard,rule,rel),a,b))
    punct_offs={bd[0] for bd in bounds if bd[1] is None}
    for off,info,a,b in bounds:
        if info is None: continue
        j,hard,rule,rel=info
        if not rel: unsure.append((off,rule)); continue
        if not j: final.add(off)
    final.discard(0); final.discard(len(R0))
    SMALL=set('ゃゅょャュョぁぃぅぇぉァィゥェォ')
    def mora(a_,b_): return sum(1 for ch in R0[a_:b_] if ch not in SMALL and ch not in '、，。．！？…「」『』（）・')
    ALLOWED={'compound-noun','compound-noun2','propn+noun','noun+counter','suffix','na+noun-C','default','noun|hira-noun','num|kata-unit'}
    cand={off for off,info,a,b in bounds if info is not None and info[3] and info[2] in ALLOWED and not(info[1] and info[0])}
    def split(a_,b_):
        if mora(a_,b_)<=9: return
        best=None
        for c_ in cand:
            if a_<c_<b_ and mora(a_,c_)>=3 and mora(c_,b_)>=3:
                m_=max(mora(a_,c_),mora(c_,b_))
                if best is None or m_<best[0]: best=(m_,c_)
        if best is None: return
        final.add(best[1]); split(a_,best[1]); split(best[1],b_)
    edges=sorted(final|punct_offs|{0,len(R0)})
    for x_,y_ in zip(edges,edges[1:]): split(x_,y_)
    out=[]
    for idx,ch in enumerate(R0):
        if idx in final: out.append(' ')
        out.append(ch)
    res=''.join(out)
    # --- conjugation verification (verbs / i-adjectives) on unique token spans
    verbs=[]; prev_end=0
    for i,t in enumerate(ts):
        end=ends[i]
        start=prev_end
        if end is not None: prev_end=end
        if t['pos'] in('動詞','形容詞') and not is_punct(t):
            if end is None or (i>0 and ends[i-1] is None): act=None
            else: act=k2h(R0[start:end])
            if t['pos']=='動詞':
                st,rule,cands=verify_verb(t['lemma'],t['p4'],t['p5'],act); grp=group_of(t['p4'])
            else:
                grp=0; cands=[]; st='unchecked:no-rule'; rule=None
                for lr in lemma_readings(t['lemma']):
                    from conj import expected_adj_stem as _ea
                    pass
                exps=[]
                import conj as _c
                for lr in _c.lemma_readings(t['lemma']):
                    _c._cache[t['lemma']]=lr
                    e,rl=_c.expected_adj_stem(t['lemma'],t['p5'])
                    if e is not None: exps.append(e); rule=rl
                    else: rule=rule if rule!=None else rl
                _c._cache.pop(t['lemma'],None)
                if t['lemma'] in ('良い','いい','好い') and t['p5'] in('終止形-一般','連体形-一般'): exps+=['いい','よい']
                if exps:
                    cands=exps
                    st='unresolved-span' if act is None else ('ok' if any(_rend(act)==_rend(x) for x in exps) else 'mismatch')
                else: st='unchecked:'+str(rule)
            verbs.append(dict(s=t['s'],lemma=t['lemma'],group=grp,p4=t['p4'],p5=t['p5'],expected=cands[0] if cands else None,candidates=cands,actual=act,status=st,rule=rule))
    kanamis=[ts[i]['s'] for i in range(n) if KAN(ts[i]) and not sp[i][1] and not is_punct(ts[i])]
    rules={off:(info[2],info[1],info[0]) for off,info,a,b in bounds if info is not None}
    pairs={off:(a['s'],b['s']) for off,info,a,b in bounds if info is not None}
    punctadj={off for off,info,a,b in bounds if info is None}
    units=[(R0[0:0],k,key) for _,_,k,key in espans]
    return dict(status='ok',result=res,cost=cost,unsure=unsure,rules=rules,final=sorted(final),punctadj=sorted(punctadj),R0=R0,kanamis=kanamis,pairs=pairs,verbs=verbs,units=sorted({(k,key) for _,_,k,key in espans}),tokens=[(t['s'],t['pos'],t['lemma']) for t in ts])
if __name__=='__main__':
    r=segment(sys.argv[1],sys.argv[2]); print(r['result']); print(r['verbs']); print(r['units'])
