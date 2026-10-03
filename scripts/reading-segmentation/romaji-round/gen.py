import re,unicodedata,sys
sys.path.insert(0,'.')
from rom import H,Y,EXT,k2h
PUNCT_SET='、，。．！？!?…「」『』（）()：:'
COMP={'には':'ni wa','では':'de wa','とは':'to wa','からは':'kara wa','までは':'made wa','へは':'e wa','よりは':'yori wa','にも':'ni mo','へも':'e mo','への':'e no','にの':'ni no','とも':'tomo','こんにちは':'konnichiwa','こんばんは':'konbanwa'}
SINGLE={'は':'wa','へ':'e','を':'o'}
def word(t):
    t=k2h(t); out=[]; i=0; gem=False
    while i<len(t):
        c=t[i]; d=t[i+1] if i+1<len(t) else ''
        if c=='っ': gem=True; i+=1; continue
        if c=='ー':
            m=re.search(r'[aiueo]$',''.join(out)); 
            if m: out.append(m.group())
            i+=1; continue
        if d and c+d in EXT: r=EXT[c+d]; i+=2
        elif d and d in 'ゃゅょ' and c in Y: r=Y[c]+{'ゃ':'a','ゅ':'u','ょ':'o'}[d]; i+=2
        elif c in H: r=H[c]; i+=1
        else: out.append(c); i+=1; gem=False; continue
        if c=='ん' or r=='n':
            nxt=t[i] if i<len(t) else ''
            if nxt and (nxt in 'あいうえおやゆよ' or nxt in 'ぁぃぅぇぉ'): r="n'"
        if gem: r=('c'+r) if r.startswith('ch') else r[0]+r; gem=False
        out.append(r)
    return ''.join(out)
def gen(reading,splits=()):
    toks=[]; k=0
    for m in re.finditer(r'[^ 　'+PUNCT_SET+r']+|['+PUNCT_SET+r']|[ 　]+',reading.strip()):
        t=m.group()
        if t[0] in ' 　': continue
        if t in PUNCT_SET: toks.append(t); k+=1; continue
        # split word at sahen offsets
        cur=''; 
        for ch in t:
            if k in splits and cur: toks.append(cur); cur=''
            cur+=ch; k+=1
        toks.append(cur)
    res=[]
    for t in toks:
        if t in PUNCT_SET:
            p={'、':',','，':',','。':'.','．':'.','！':'!','？':'?','!':'!','?':'?','…':'...','：':':',':':':'}.get(t,'')
            if res and p: res[-1]+=p
            continue
        if t in COMP: res.append(COMP[t])
        elif t in SINGLE: res.append(SINGLE[t])
        else: res.append(word(t))
    s=' '.join(res)
    s=s.replace('  ',' ')
    return s[:1].upper()+s[1:] if s else s
if __name__=='__main__':
    for r in ['どようび に りょうりきょうしつ へ かよって います。','いぬ は しっぽ が ながい。','しゅうごうする ばしょ を かくにんします。','かんい トイレ を せっちします。','ほんじつ は かいぎ の ため まいりました。']:
        print(gen(r))
