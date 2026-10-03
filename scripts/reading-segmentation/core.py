import json, re, warnings
warnings.filterwarnings('ignore')
from sudachipy import dictionary, tokenizer
_D = dictionary.Dictionary()
TA = _D.create(tokenizer.Tokenizer.SplitMode.A)
TC = _D.create(tokenizer.Tokenizer.SplitMode.C)
def k2h(s): return ''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c for c in s)
EQG=[set('おを'),set('あわ'),set('えへ'),set('づず'),set('ぢじ'),set('おう'),set('ええい'),set('すそ'),set('ちぢ')]
def eq(a,b):
    if a==b: return True
    if a=='ー' or b=='ー': return True
    return any(a in g and b in g for g in EQG)
def clean_ja(s): return re.sub(r'[\s　]+','',s)
from numkana import num2kana
DIGITS=re.compile(r'^[0-9０-９][0-9０-９,，]*$')
def tokenize(ja):
    out=[]
    pos=0
    for m in TA.tokenize(ja):
        s=m.surface()
        if not s.strip(): continue
        r=k2h(m.reading_form()) if m.reading_form() else s
        if not r or r=='キゴウ': r=s
        p=m.part_of_speech()
        if DIGITS.match(s):
            nk=num2kana(s)
            if nk: r=nk[0]
        out.append(dict(s=s,r=r,pos=p[0],p2=p[1],p3=p[2],p4=p[4],p5=p[5],lemma=m.dictionary_form(),start=pos,end=pos+len(s)))
        pos+=len(s)
    # C-mode spans over char offsets
    cs=[];pos=0
    for m in TC.tokenize(ja):
        s=m.surface()
        cs.append((pos,pos+len(s),m.part_of_speech()[0],m.part_of_speech()[1])); pos+=len(s)
    return out,cs
KANAONLY=re.compile(r'^[ぁ-ゟ゠-ヿー、。！？・「」…（）]+$')
def align(Tt, R, surf=None):
    """Weighted alignment. returns (cost, bounds) where bounds[i] = (cand_list_for_end_of_token_i, exact_i)"""
    T=''.join(Tt); n,m=len(T),len(R); INF=10**9
    kana=[True]*len(Tt) if surf is None else [bool(KANAONLY.match(s)) for s in surf]
    tok_of=[]
    for ti,t in enumerate(Tt): tok_of+=[ti]*len(t)
    w=[3 if kana[tok_of[i]] else 1 for i in range(n)]
    ins=[0]*(n+1)
    for i in range(n+1):
        left=kana[tok_of[i-1]] if i>0 else True
        right=kana[tok_of[i]] if i<n else True
        ins[i]=4 if (left and right) else 1
    D=[[INF]*(m+1) for _ in range(n+1)]; D[0][0]=0
    for i in range(n+1):
        Di=D[i]
        for j in range(m+1):
            d=Di[j]
            if d>=INF: continue
            if i<n and j<m:
                c_=0 if eq(T[i],R[j]) else w[i]
                if d+c_<D[i+1][j+1]: D[i+1][j+1]=d+c_
            if i<n and d+w[i]<D[i+1][j]: D[i+1][j]=d+w[i]
            if j<m and d+ins[i]<Di[j+1]: Di[j+1]=d+ins[i]
    B=[[INF]*(m+1) for _ in range(n+1)]; B[n][m]=0
    for i in range(n,-1,-1):
        for j in range(m,-1,-1):
            if i==n and j==m: continue
            best=INF
            if i<n and j<m:
                c_=0 if eq(T[i],R[j]) else w[i]
                best=min(best,B[i+1][j+1]+c_)
            if i<n: best=min(best,B[i+1][j]+w[i])
            if j<m: best=min(best,B[i][j+1]+ins[i])
            B[i][j]=best
    opt=D[n][m]
    bounds=[];off=0
    for ti,t in enumerate(Tt):
        a=off; b=off+len(t); off=b
        cands=[j for j in range(m+1) if D[b][j]+B[b][j]==opt]
        # exactness of token: can its chars be matched at zero cost for some alignment consistent with cands
        starts=[j for j in range(m+1) if D[a][j]+B[a][j]==opt] if a>0 else [0]
        exact=False
        for js in starts:
            for je in cands:
                if je-js==len(t) and all(eq(t[k],R[js+k]) for k in range(len(t))): exact=True
        bounds.append((cands,exact))
    return opt,bounds

def tokenize_chunks(ja):
    """tokenize the whole space-less text; if authored spaces in ja fall inside a token, fall back to chunk-wise tokenization"""
    chunks=[x for x in re.split(r'[\s　]+',ja.strip()) if x]
    full,fcs=tokenize(clean_ja(ja))
    if len(chunks)<=1: return full,fcs
    cuts=[];base=0
    for ch in chunks[:-1]:
        base+=len(ch); cuts.append(base)
    starts={t['start'] for t in full}|{t['end'] for t in full}
    if all(cu in starts for cu in cuts): return full,fcs
    out=[];cs=[];base=0
    for ch in chunks:
        t,cc=tokenize(ch)
        for x in t:
            x=dict(x); x['start']+=base; x['end']+=base; out.append(x)
        for (s_,e_,p,q) in cc: cs.append((s_+base,e_+base,p,q))
        base+=len(ch)
    return out,cs
