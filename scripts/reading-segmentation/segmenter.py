import sys,re,json
sys.path.insert(0,'.')
from core import *
from numkana import num2kana
KATA=re.compile(r'^[゠-ヿー]+$'); KANJI=re.compile(r'[一-鿿々]'); KANA_ONLY=re.compile(r'^[ぁ-ゟ゠-ヿー、。！？・「」…]+$')
INTERROG={'何','誰','どこ','いつ','どれ','どちら','どっち','いずれ','なに','だれ','なん'}
CONJ_TE={'て','で','ば','たり','だり','ながら','つつ','ちゃ','じゃ'}
PP_FIRST={'に','へ','と','で','から','まで','より'}
PP_SECOND={'は','も','の'}
SAHEN_FORMS={'する','し','さ','せ','しろ','すれ','できる','でき','いたす','いたし','なさる','なさい'}
HARD_LEX={'もうすぐ','もしかしたら','もしかして','もしかすると','若しかしたら','若しかして','なにより','何より','なんと','何と','こういう','そういう','ああいう','どういう','こういった','そういった','ああいった','どういった','ことによると','事によると','ものともせず','ものともしない','ことながら','たりとも','しかしながら','ざんねんながら','残念ながら','然しながら','ならでは','とやら','いえども','さることながら','とともに','もしも','どうしても','すこしずつ','少しずつ','かならずしも','必ずしも','まだしも'}
ADV_LIKE={'ほとんど','たくさん','だいぶ','ずいぶん','すっかり','ぜんぶ','全部','だいたい','大体','大勢','全然','絶対'}
BOUND_V={'込む','合う','続ける','始める','直す','過ぎる','損なう','兼ねる','かねる','込める','換える','替える'}
def is_punct(t): return t['pos'] in ('補助記号','空白')
def covered(cs,a,b): return any(s<=a['start'] and b['end']<=e for s,e,_,_ in cs)
def orth(t): return 'K' if KATA.match(t['s']) else ('J' if KANJI.search(t['s']) else 'h')
def decide(a,b,cs,prev=None):
    """returns (join: bool, hard: bool, rule: str)"""
    ap,bp=a['pos'],b['pos']
    for cs_,ce_,cp_,cp2_ in cs:
        if cs_<=a['start'] and b['end']<=ce_ and cp_ in('副詞','接続詞','連体詞','感動詞','LEX') and not(ap=='助詞' and a['s'] in('て','で') and bp=='動詞'):
            return True,(cp_=='LEX' and cp2_ in HARD_LEX),'lexicalized-'+cp_
    if ap=='接頭辞': return True,True,'prefix'
    if b['s']=='ん' and bp in('助詞','助動詞') and (ap in('動詞','形容詞','助動詞') or a['s']=='な') and not (bp=='助動詞' and ap in('動詞','形容詞','助動詞')): return True,False,'n-nominal'
    if a['s']=='ん' and ap in('助詞',) and bp=='助動詞' and (b['p4'].startswith('助動詞-ダ') or b['p4'].startswith('助動詞-デス')): return True,False,'n+cop'
    if bp=='接尾辞': return True,False,'suffix'
    if a['p2']=='数詞' and ap=='名詞' and bp=='名詞':
        if b['p2']=='数詞' or (b['p3'] in('助数詞','助数詞可能','副詞可能') and not KATA.match(b['s'])): return True,True,'num-unit'
        if b['p3']=='助数詞' or KATA.match(b['s']): return False,False,'num|kata-unit'
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
        if lem=='べし' and ap=='動詞' and a['s'] in('す','し','せ'): return True,False,'su-beki'
        if lem in('べし','らしい','まい'): return False,False,'beki'
        if ap in('動詞','形容詞','助動詞') or (ap=='接尾辞' and a['p2'] in('形容詞的','動詞的')): return True,True,'aux-conj'
        if ap in('名詞','形状詞','代名詞'): return False,False,'aux|noun'
        return False,False,'aux|other'
    if bp=='助詞':
        s=b['s']; p2=b['p2']
        if ap=='副詞' and s in('ずつ','しも'): return True,True,'adv-zutsu'
        if a['s']=='たり' and s=='とも': return True,True,'tari-tomo'
        if s in CONJ_TE and (p2=='接続助詞' or s in('たり','だり')) and (ap in('動詞','形容詞','助動詞') or (ap=='接尾辞' and a['p2'] in('形容詞的','動詞的'))): return True,not(a['s']=='ない' and s=='で'),'conj-te'
        if s=='ながら' and ap in('名詞','形状詞','副詞','接尾辞','代名詞'): return True,True,'nagara-noun'
        if s in PP_SECOND|{'に'} and ap=='助詞' and a['s'] in PP_FIRST and a['p2'] in('格助詞','副助詞') and not(a['s']=='で' and a['p2']=='接続助詞'):
            if (s in PP_SECOND) or (a['s']=='まで' and s=='に'): return True,True,'pp-compound'
        if s in PP_SECOND and ap=='助動詞' and a['s']=='で': return True,True,'pp-compound'
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
        if ap=='助詞' and a['s'] in('て','で') and a['p2']=='接続助詞': return False,True,'te|aux-verb'
        if ap=='動詞' and a['p5'].startswith('連用'): return True,False,'compound-verb'
        if ap in('形容詞','形状詞') and b['p2']=='非自立可能' and b['lemma'] in('過ぎる','すぎる','続ける','始める','出す','やすい','にくい'): return True,False,'adj-compound'
        if ap=='名詞' and a['p3']=='サ変可能' and b['lemma'] in('する','できる','致す','いたす','為さる','なさる'):
            return False, False,'sahen'
        if ap in('名詞','形容詞','形状詞','副詞') and covered(cs,a,b) and b['p2']!='非自立可能': return True,False,'C-compound-verb'
        if ap in('名詞','動詞') and b['lemma'] in BOUND_V and not(ap=='動詞' and not a['p5'].startswith('連用')): return True,False,'bound-verb'
        if ap=='助詞' : return False,True,'particle|verb'
        return False,False,'verb'
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
SENT_START_ONLY={'それで','それも','これから','あれから','ところが','ところで','だから','だって','だけど','それで','それでは','それでも','それに','それなら','それとも','すると','ですから','けれども','したがって','そして','そうして','それから','こうして','ちなみに','あまりにも'}
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
def segment(ja,reading):
    """returns dict(status, spaced, info)"""
    ts,cs=tokenize_chunks(ja)
    ja=clean_ja(ja)
    cs=list(cs)
    if not LEX: build_lex()
    for i in range(len(ts)):
        for j in range(i+2,min(len(ts),i+7)+1):
            sur=''.join(x['s'] for x in ts[i:j])
            if sur in LEX:
                if sur in SENT_START_ONLY and i>0 and not is_punct(ts[i-1]): continue
                cs.append((ts[i]['start'],ts[j-1]['end'],'LEX',sur))
    for i in range(len(ts)-2):
        if ts[i]['s']=='と' and ts[i+1]['s'] in('とも','共') and ts[i+2]['s']=='に': cs.append((ts[i]['start'],ts[i+2]['end'],'LEX','とともに'))
    orig=reading
    R0=re.sub(r'[\s　]+','',orig); R=k2h(R0)
    if not ts: return dict(status='noja')
    cost,sp,_tr=best_align(ts,R)
    # authored spaces as offsets in R0
    auth=set();k=0
    for ch in orig.strip():
        if ch in ' 　\t': auth.add(k)
        else: k+=1
    auth.discard(0); auth.discard(len(R0))
    authored_has=bool(auth)
    n=len(ts)
    KAN=lambda t:bool(KANA_ONLY.match(t['s']))
    reliable=None
    # boundary i between token i and i+1, offset sp[i][1]
    final=set(); unsure=[]; hard_edits=0
    bounds=[]
    for i in range(n-1):
        a,b=ts[i],ts[i+1]
        cands=sp[i][0]
        if is_punct(a) or is_punct(b):
            off=cands[0] if len(cands)==1 else (max(cands) if not KAN(a) or True else cands[0])
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
    boundoffs={bd[0] for bd in bounds}
    punct_offs={bd[0] for bd in bounds if bd[1] is None}
    auth_eff={o for o in auth if o not in punct_offs}
    if authored_has and not auth_eff: authored_has=False
    for off,info,a,b in bounds:
        if info is None: continue
        j,hard,rule,rel=info
        if not rel: unsure.append((off,rule)); continue
        has=off in auth
        if hard: want=not j
        elif authored_has: want=has
        else: want=not j
        if want: final.add(off)
    # authored spaces not at a token boundary, and punctuation-adjacent ones are dropped
    for off in auth:
        if off not in boundoffs:
            pass  # mid-token authored space -> removed
    # unsure boundaries: keep authored value if any
    for off,rule in unsure:
        if off in auth: final.add(off)
    final.discard(0); final.discard(len(R0))
    # split over-long unspaced chunks (compound nouns > 9 morae) at the best soft word boundary
    SMALL=set('ゃゅょャュョぁぃぅぇぉァィゥェォ')
    def mora(a_,b_): return sum(1 for ch in R0[a_:b_] if ch not in SMALL and ch not in '、，。．！？…「」『』（）・')
    ALLOWED={'compound-noun','compound-noun2','propn+noun','noun+counter','suffix','na+noun-C','default','noun|hira-noun','num|kata-unit'}
    cand={off for off,info,a,b in bounds if info is not None and info[2] in ALLOWED and not(info[1] and info[0])}
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
    out=[];
    for idx,ch in enumerate(R0):
        if idx in final: out.append(' ')
        out.append(ch)
    res=''.join(out)
    kanamis=[ts[i]['s'] for i in range(n) if KAN(ts[i]) and not sp[i][1] and not is_punct(ts[i])]
    rules={off:(info[2],info[1],info[0]) for off,info,a,b in bounds if info is not None}
    pairs={off:(a['s'],b['s']) for off,info,a,b in bounds if info is not None}
    punctadj={off for off,info,a,b in bounds if info is None}
    return dict(status='ok',result=res,cost=cost,unsure=unsure,mid=[o for o in auth if o not in boundoffs],authored_has=authored_has,rules=rules,auth=sorted(auth),final=sorted(final),punctadj=sorted(punctadj),R0=R0,kanamis=kanamis,pairs=pairs)
if __name__=='__main__':
    print(segment(sys.argv[1],sys.argv[2]))

