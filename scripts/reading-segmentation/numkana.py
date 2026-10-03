import re
D={'0':['れい','ぜろ'],'1':['いち','いっ','ひと'],'2':['に','ふた'],'3':['さん','み'],'4':['よん','し','よ','よっ'],'5':['ご','いつ'],'6':['ろく','ろっ','む'],'7':['なな','しち'],'8':['はち','はっ','や'],'9':['きゅう','く','ここの']}
def fw(s): return ''.join(chr(ord(c)-0xFEE0) if '０'<=c<='９' else c for c in s)
def num2kana(s):
    s=fw(s).replace(',','')
    if not re.fullmatch(r'\d{1,8}',s): return []
    n=int(s)
    if n==0: return ['れい','ぜろ']
    res=['']
    def add(lst):
        nonlocal res
        res=list({a+b for a in res for b in lst})[:40]
    digs=str(n).zfill(8)
    groups=[(digs[:4],'まん'),(digs[4:],'')]
    for g,unit in groups:
        v=int(g)
        if v==0: continue
        if unit=='まん' and v==1: add(['いちまん'] ); continue
        th,h,t,o=[int(c) for c in g]
        if th: add({1:['せん'],3:['さんぜん','さんせん'],8:['はっせん','はちせん']}.get(th,[D[str(th)][0]+'せん']))
        if h: add({1:['ひゃく','ひゃっ'],3:['さんびゃく','さんびゃっ'],6:['ろっぴゃく','ろっぴゃっ','ろくひゃく'],8:['はっぴゃく','はっぴゃっ','はちひゃく']}.get(h,[D[str(h)][0]+'ひゃく',D[str(h)][0]+'ひゃっ']))
        if t: add(([''] if t==1 else [D[str(t)][0]])  and ([('じゅう' if t==1 else D[str(t)][0]+'じゅう'),('じゅっ' if t==1 else D[str(t)][0]+'じゅっ')]))
        if o: add(D[str(o)])
        if unit: add([unit])
    return sorted(res)
if __name__=='__main__':
    for x in ['30','８０','2','90','600','1200','４０','25','100']: print(x,num2kana(x))
