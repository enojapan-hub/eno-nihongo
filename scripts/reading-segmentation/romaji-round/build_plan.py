import json,re,sys,copy,collections
sys.path.insert(0,'.')
from ralign import align
import joins
P=json.load(open('plan_romaji.json'))
d=json.load(open('../romaji/snap/live_pre2.json'))
K=lambda r:(r['table'],r['owner'],r['idx'])
by={K(r):r for r in d}
by8={}
for r in d: by8.setdefault((r['owner'][:8],r['idx']),[]).append(r)
def rd_key(e): return 'reading' if 'reading' in e else ('hiragana' if 'hiragana' in e else 'reading')
ns=lambda s:re.sub(r'\s','',s)
chg=collections.defaultdict(dict)   # key -> {field:(old,new,cat,reason,src,conf)}
def put(k,f,old,new,cat,why,src,conf):
    assert f not in chg[k],(k,f)
    chg[k][f]=dict(old=old,new=new,cat=cat,why=why,src=src,conf=conf)
# ---- Batch 4: source reading repairs (RF) + lexical joins
_r=[r for r in d if r['owner'][:8]=='dea414ca' and r['idx']==1][0]
P['reading'].append(dict(table=_r['table'],owner=_r['owner'],idx=1,key='reading',ja=_r['e']['ja'],old=_r['e']['reading'],new=_r['e']['reading'].replace('あっ と いう','あっと いう'),why='stray space inside あっと (アッという間に); ENO romaji "atto iu ma ni"'))
newread={}
for c in P['reading']:
    k=(c['table'],c['owner'],c['idx']); newread[k]=c['new']
    put(k,c['key'],c['old'],c['new'],'J source-corrupt',c['why'],'ENO romaji word boundaries + Japanese + lexicon','high')
for r in d:
    e=r['e']; f=rd_key(e); cur=e.get(f)
    if not cur: continue
    k=K(r)
    base=newread.get(k,cur)
    nw,used=joins.apply(base)
    if nw!=base:
        assert ns(nw)==ns(base),(k,base,nw)
        if k in newread:
            chg[k][f]['new']=nw; newread[k]=nw
        else:
            newread[k]=nw
            put(k,f,cur,nw,'J source-corrupt (lexical word split)','one lexical word/compound split by spaces; rejoined','ENO romaji word boundaries (joined) + lexicon','high')
# ---- Batch 2: romaji
ro_new={}
for kk,v in P['ro_new'].items():
    o,i=kk.split('|'); (r,)=by8[(o,int(i))]; ro_new[K(r)]=v
for k,nv in ro_new.items():
    e=by[k]['e']; old=e.get('romaji')
    cat='I empty' if not old else 'C/G romaji content'
    put(k,'romaji',old,nv,cat,'romaji typo/wrong romanization/contraction split/digit-mixed','Reading + Japanese (aligner) + Hepburn-wapuro ENO style','high')
spacing={}
for r in d:
    e=r['e']; k=K(r); rd=newread.get(k) or e.get('reading') or e.get('hiragana'); ro=e.get('romaji')
    if not rd or not ro or k in ro_new: continue
    ins={}
    ok,rb,bnd,iss,ps=align(rd,ro,ins)
    if ok and ins:
        s=ro
        for off in sorted(ins.values(),reverse=True): s=s[:off]+' '+s[off:]
        assert s.replace(' ','')==ro.replace(' ','')
        put(k,'romaji',ro,s,'B spacing only','romaji word boundary missing vs Reading','Reading boundaries (aligner)','high')
        spacing[k]=s
# ---- Batch 1: missing Reading (+romaji, arti)
rec=json.load(open('rec404_final.json')); arti=json.load(open('arti404.json'))
from gen import gen
FO={('89f4ec5b',1):'ごじ はん に へいさします。',('b0b93ef9',0):'しちじ ごろ に ね。',('b0b93ef9',1):'にじ はんごろ でた。',('7cf2b001',0):'まいにち ごこ ずつ おぼえます。',('b8259061',1):'かれ は じきに はら を たてる。'}
unres=[]
for n,x in enumerate(rec):
    if (x['owner'][:8],x['idx']) in FO: x['final']=FO[(x['owner'][:8],x['idx'])]; x['romaji']=gen(x['final'])
    k=('vocabulary_senses',x['owner'],x['idx']); e=by[k]['e']
    assert not rd_key(e) in e
    if x.get('final'):
        put(k,'reading',None,x['final'],'missing-reading recovered','Reading recovered from Japanese (Sudachi+ENO lexicon/conj) + manual review; segmented by final ENO rules','Japanese + ENO vocab term/reading + Sudachi + manual review','high' if not x['flags'] else 'medium')
        put(k,'romaji',e.get('romaji'),x['romaji'],'missing-reading recovered','romaji generated from recovered Reading in ENO style','gen(Reading)','high')
    else: unres.append(k)
    if str(n) in arti:
        assert not (e.get('id') or '').strip()
        put(k,'id',None,arti[str(n)],'A-empty arti filled','arti translated from Japanese; en field cross-check','Japanese (primary) + existing en','medium-high')
# romaji rejoin: where the Reading was rejoined (lexical word) and the romaji still split it
RJ=[('ni juppun','nijuppun'),('nido to','nidoto'),('metta ni','mettani'),('Sukunaku tomo','Sukunakutomo'),('nan te','nante'),('tsukare gimi','tsukaregimi'),('iwazu mogana','iwazumogana')]
RJROWS={('52e367ce',0),('8abf12bd',0),('a77abdc1',0),('251a03b1',1),('3ec40359',0),('39d1e99a',1),('3dc58eb8',0),('47b7d6e4',0),('53b38bbb',0),('53b38bbb',1),('53b38bbb',2),('8f07af5d',1),('b7b6d92a',0),('df0e5567',0),('ecf06f02',0)}
for kk in RJROWS:
    (r,)=by8[kk]; k=K(r); cur=chg[k]['romaji']['new'] if 'romaji' in chg.get(k,{}) else r['e']['romaji']
    new=cur
    for a,b in RJ: new=new.replace(a,b)
    assert new!=cur,(kk,cur)
    if 'romaji' in chg.get(k,{}): chg[k]['romaji']['new']=new
    else: put(k,'romaji',r['e']['romaji'],new,'B spacing only (romaji rejoined to match joined Reading word)','romaji split a lexical word the Reading keeps whole','Reading word boundaries (aligner) + lexicon','high')
# proper-noun capitalisation for recovered rows (live ENO style: Nihon/Toukyou/Kyouto capitalised)
CAP={('63d1ab68',1):('nihonjin','Nihonjin'),('62a31c4f',0):('toukyou','Toukyou'),('64a712c1',1):('furansugo','Furansugo'),('7171796e',1):('nihon o','Nihon o'),('7b31d712',1):('kyouto','Kyouto'),('8bc4a5dc',0):('kirisutokyou','Kirisutokyou'),('9ffa006e',1):('kyuriifujin','Kyuriifujin')}
for k,c in chg.items():
    kk=(k[1][:8],k[2])
    if kk in CAP and 'romaji' in c and c['romaji']['cat']=='missing-reading recovered':
        a,b=CAP[kk]; assert a in c['romaji']['new'],kk; c['romaji']['new']=c['romaji']['new'].replace(a,b,1)
# ---- Batch 3: arti repairs
ART={
('0a729f65',0):'Kebenaran, fakta.',('0fd0f9a0',0):'Menggantungkan.',('142383f2',0):'Berangkat (bus).',('1964e177',0):'Tiba.',
('203d7c69',0):'Ada, pergi, datang (bentuk hormat dari います, いきます, きます).',('2eb18c3b',0):'Memanggil.',
('6d0601d6',0):'Bertanya, mendengar, mengunjungi (bentuk merendah dari ききます, いきます).',('8f44b0b3',0):'Bertengkar.',
('906613fb',0):'Membubuhi.',('b5b45727',1):'Terlambat.',('d6733540',0):'Menghadiri.',('ef58892c',0):'Memakai, menggunakan.',
('f83202ab',0):'Mengirim (telegram).',('ffbdfbab',0):'Meninggal.',
('26d0c885',0):'Misalnya, untuk menerima paket kurir, hanko tidak diperlukan.',
('78da75c8',0):'Adik laki-laki saya lahir pada tahun shio harimau yang sama dengan kakek kami, jadi selisih usia mereka bukan dua belas tahun.',
('db46736d',0):'Saya memperhatikan pola makan agar gizinya seimbang.',
('6f797513',0):'Saya membeli 2 kok bulu tangkis di toko perlengkapan olahraga.',
}
for (o,i),nv in ART.items():
    (r,)=by8[(o,i)]; old=r['e'].get('id')
    cat='placeholder/template arti' if (old or '').startswith('Contoh penggunaan') else ('wrong arti (negation lost / double negation / other sentence)' if (o,i) in (('26d0c885',0),('78da75c8',0),('db46736d',0)) else 'wrong arti (JA mismatch)')
    put(K(r),'id',old,nv,cat,'template prefix removed / meaning corrected from Japanese','Japanese sentence + ENO entry gloss','high')
A6={('27d5e3fd',0):'Apa itu penangkal petir?',('71e2edc4',0):'Apa itu penangkal petir?',('c7bda101',0):'Ini hari Sabtu.',('d501fdd8',1):'Ini hari Sabtu.',('dbd0fd3f',0):'Itu benar-benar pasti.',('e153a83b',0):'Apakah kamu memakai sarung tangan?'}
for (o,i),nv in A6.items():
    (r,)=by8[(o,i)]; assert not (r['e'].get('id') or '').strip()
    put(K(r),'id',None,nv,'A-empty arti filled','arti empty; translated from Japanese (en field cross-check)','Japanese (primary) + existing en','high')
json.dump([dict(table=k[0],owner=k[1],idx=k[2],ja=by[k]['e'].get('ja') or by[k]['e'].get('jp'),fields=v) for k,v in chg.items()],open('master_plan.json','w'),ensure_ascii=False)
print('elements changed',len(chg))
print(collections.Counter((f,v['cat']) for c in chg.values() for f,v in c.items()))
print('unresolved reading',unres)
# self-validation: final state alignment
bad=0
for k,c in chg.items():
    e=copy.deepcopy(by[k]['e'])
    for f,v in c.items(): e[f]=v['new']
    rd=e.get('reading') or e.get('hiragana'); ro=e.get('romaji')
    if rd and ro:
        ok,rb,bnd,iss,ps=align(rd,ro)
        if not ok or bnd-rb: bad+=1; print('FAIL',k[1][:8],k[2],ok,iss[-1:],rd,'|',ro)
    if rd and ns(rd)!=ns(by[k]['e'].get('reading') or by[k]['e'].get('hiragana') or rd) and 'reading' in c and c['reading']['old'] is not None and c['reading']['cat'].startswith('J')==False: print('??',k)
print('selfcheck failures',bad)
