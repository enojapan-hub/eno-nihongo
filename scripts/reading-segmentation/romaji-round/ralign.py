import re,sys,unicodedata
sys.path.insert(0,'.')
from rom import H,Y,EXT,k2h
PUN='、，。．！？!?…「」『』（）()・：:～~,.;"“”‘’«»―ーー'
SEP=set(" -'’‘"+'.,!?:;"“”«»()…~') 
LONG=set('aiueo')
PART_W={'に','で','と','から','まで','より','には','では','ては','として','について','において','にとって','によって','にかけて','に関して','にかんして','にさいして','にたいして','までに','ならで','ひいて','あるい','それで','もしく','または'[:-1],'また','ひいで','ものの','のでは','ほかには','ほかに','としても','とも'}
def pieces(reading):
    """-> list of (nospace_index, [alts], flags) ; plus reading boundary set (nospace idx)"""
    t=k2h(unicodedata.normalize('NFKC',reading)).strip(); out=[]; bnd=set(); idx=0
    toks=[]  # (text, preceded_by_space)
    for m in re.finditer(r'([ 　]+)|([^ 　]+)',t):
        if m.group(1): toks.append(None); continue
        for u in re.split(r'(?<=[、，。．！？!?…」』）)：:])|(?=[「『（(])',m.group(2)):
            if u: toks.append(u)
    first=True; sp=False; gem=False; gstart=None
    for u in toks:
        if u is None: sp=True; continue
        if sp and not first: bnd.add(idx)
        sp=False; first=False
        core=re.sub(r'[、，。．！？!?…「」『』（）()：:～~・]','',u)
        ul=len(re.sub(r'[、，。．！？!?…」』）)：:～~・]+$','',u))
        j=0
        while j<len(u):
            c=u[j]; d=u[j+1] if j+1<len(u) else ''
            if c in '、，。．！？!?…「」『』（）()：:～~・,.': j+=1; idx+=1; continue
            if c=='っ':
                nxt=u[j+1] if j+1<len(u) else ''
                if nxt=='' or nxt in '、，。．！？!?…」』）)：:':
                    out.append((idx,['','t','tt'],{'gemend':1})); j+=1; idx+=1; continue
                gem=True; gstart=idx; j+=1; idx+=1; continue
            if c=='ー':
                prev=out[-1][1][0][-1] if out and out[-1][1] and out[-1][1][0] else ''
                out.append((idx,[prev] if prev in LONG else [''],{'long':1})); j+=1; idx+=1; continue
            n=1
            if d and c+d in EXT: r=[EXT[c+d]]; n=2
            elif d and d in 'ゃゅょ' and c in Y: r=[Y[c]+{'ゃ':'a','ゅ':'u','ょ':'o'}[d]]; n=2
            elif c in H: r=[H[c]]
            else: r=[c.lower()]
            fl={}
            if c=='は':
                part=(j==ul-1 and (core in ('は',) or core[:-1] in PART_W)) or core in('こんにちは','こんばんは') and j==ul-1
                endp=(j==ul-1 and len(core)>=2)
                if core=='は' or endp: r=['wa','ha']
                else: r=['ha']
                fl['part']=part
            elif c=='へ':
                part=(core=='へ') or (j==0 and core in('への','へは','へも'))
                r=['e'] if part else ['he']; fl['part']=part
            elif c=='を': r=['o','wo']
            elif c=='ん': r=['n','m']
            if c+d=='うぃ': r=['wi','ui']
            if c+d=='てぃ': r=['ti','thi']
            elif c in 'おを' : pass
            if gem:
                r=[x for a in r for x in ((['c'+a,'t'+a] if a.startswith('ch') else [a[0]+a]))]; gem=False; fl['gs']=gstart
            if c=='う' and n==1 and out and out[-1][1] and out[-1][1][0].endswith('o'): r=['u','o','']
            if c=='う' and out and out[-1][1] and out[-1][1][0].endswith('u') and not out[-1][1][0].endswith('ou'): pass
            if c=='お': fl['oc']=1
            out.append((idx,r,fl)); j+=n; idx+=n
    return out,bnd
def align(reading,romaji,ins=None):
    ps,bnd=pieces(reading); R=romaji; low=R.lower(); p=0; rb=set(); issues=[]; used={}
    prev_end=False
    for k,(idx0,alts,fl) in enumerate(ps):
        idx=fl.get('gs',idx0) if fl.get('gs') is not None else idx0
        sp=False; p0=p
        while p<len(R) and (R[p] in SEP or R[p] in ' -'):
            if R[p] in ' -': sp=True
            p+=1
        if sp and k>0: rb.add(idx)
        if ins is not None and idx in bnd and k>0:
            seg=R[p0:p]
            if not (' ' in seg or '-' in seg or re.search(r'[,.!?:;\"“”«»()…]',seg)): ins.setdefault(idx,p0)
        ok=False
        for a in alts:
            if low.startswith(a,p) or low.startswith(a.replace('ō','o'),p): 
                p+=len(a); ok=True
                if a!=alts[0]: issues.append(('variant',idx,alts[0],a))
                break
        if not ok:
            # macron
            if alts and alts[0] and alts[0][-1] in 'ou' and p<len(R) and R[p] in 'ōū': p+=1; ok=True; issues.append(('macron',idx,alts[0],R[p-1]))
            else:
                # particle romanization wrong?
                issues.append(('MISMATCH',idx,alts[0],R[p:p+4])); return False,rb,bnd,issues,ps
    while p<len(R) and R[p] in SEP: p+=1
    if p<len(R): issues.append(('EXTRA',len(ps),'',R[p:p+10])); return False,rb,bnd,issues,ps
    return True,rb,bnd,issues,ps
if __name__=='__main__':
    for r,ro in [('ともだち に しゃしん を みせます。','Tomodachi ni shashin o misemasu.'),('わたし は がっこう へ いきます','Watashi ha gakkou e ikimasu'),('この もんだい を かいけつする さく を','Kono mondai o kaiketsu suru saku o')]:
        ok,rb,b,iss,_=align(r,ro); print(ok,sorted(rb),sorted(b),iss)
