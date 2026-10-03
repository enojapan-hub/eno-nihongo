import re
H={'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so','た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho','ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro','わ':'wa','ゐ':'i','ゑ':'e','を':'o','ん':'n',
'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do','ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ゔ':'vu',
'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o'}
Y={'き':'ky','ぎ':'gy','し':'sh','じ':'j','ち':'ch','ぢ':'j','に':'ny','ひ':'hy','び':'by','ぴ':'py','み':'my','り':'ry'}
EXT={'ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo','てぃ':'ti','でぃ':'di','でゅ':'dyu','とぅ':'tu','どぅ':'du','うぃ':'wi','うぇ':'we','うぉ':'wo','ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo','しぇ':'she','じぇ':'je','ちぇ':'che','つぁ':'tsa','つぃ':'tsi','つぇ':'tse','つぉ':'tso','くぁ':'kwa','ぐぁ':'gwa','いぇ':'ye','すぃ':'si','ずぃ':'zi','ふゅ':'fyu'}
PUNCT={'、':',','，':',','。':'.','．':'.','！':'!','？':'?','!':'!','?':'?','…':'...','「':'"','」':'"','『':'"','』':'"','（':'(','）':')','・':' ','：':':','～':'~','ー':'', '　':' '}
def k2h(s): return re.sub(r'[ァ-ヶ]',lambda m:chr(ord(m.group())-0x60),s)
PARTICLE_TOKENS={'は':'wa','へ':'e','を':'o','には':'ni wa','では':'de wa','とは':'to wa','からは':'kara wa','までは':'made wa','へは':'e wa','よりは':'yori wa','にも':'ni mo','へも':'e mo','でも':'demo','とは':'to wa','こんにちは':'konnichiwa','こんばんは':'konbanwa'}
def word(t):
    """kana word -> romaji (no particle logic)"""
    t=k2h(t); out=[]; i=0; gem=False
    while i<len(t):
        c=t[i]; d=t[i+1] if i+1<len(t) else ''
        if c=='っ': gem=True; i+=1; continue
        if c=='ー':
            if out:
                m=re.search(r'[aiueo]$',out[-1]); 
                if m: out.append(m.group())
            i+=1; continue
        if c in PUNCT: out.append(PUNCT[c]); i+=1; continue
        if d and c+d in EXT: r=EXT[c+d]; i+=2
        elif d and d in 'ゃゅょ' and c in Y: r=Y[c]+{'ゃ':'a','ゅ':'u','ょ':'o'}[d]; i+=2
        elif c in H: r=H[c]; i+=1
        else: out.append(c); i+=1; continue
        if gem:
            r=('t'+r) if r.startswith('ch') else r[0]+r; gem=False
        out.append(r)
    s=''.join(out)
    # ん before vowel/y : keep n (ENO check later)
    return s
def sentence(reading):
    toks=re.split(r'(?<=[、。！？，])|\s+',reading.strip())
    toks=[x for x in re.split(r'\s+',reading.strip()) if x]
    res=[]
    for t in toks:
        # split trailing/leading punctuation
        m=re.match(r'^([「『（(]*)(.*?)([、。！？，…」』）)]*)$',t)
        pre,core,post=m.groups()
        if core in PARTICLE_TOKENS: r=PARTICLE_TOKENS[core]
        else: r=word(core)
        res.append(pre.translate(str.maketrans({'「':'"','『':'"','（':'(','(':'('}))+r+''.join(PUNCT.get(p,p) for p in post))
    s=' '.join(res)
    s=re.sub(r' ([,.!?])',r'\1',s)
    return s
def key(s):  # relaxed comparison key
    s=s.lower(); s=re.sub(r"[^a-z0-9]","",s)
    return s
def relaxed(s):
    s=key(s)
    s=s.replace('tch','cch')
    s=re.sub(r'(?<![aiueo])m(?=[bmp])','n',s)
    s=s.replace('m','n') if False else s
    for a,b in (('ou','o'),('oo','o'),('uu','u'),('aa','a'),('ii','i'),('ee','e'),('ei','e'),('ō','o')): s=s.replace(a,b)
    return s
if __name__=='__main__':
    print(sentence('ともだち に しゃしん を みせます。'),sentence('わたし は がっこう へ いきます'))
