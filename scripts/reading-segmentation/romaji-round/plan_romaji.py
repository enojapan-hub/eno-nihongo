import json,re,collections,sys
sys.path.insert(0,'.')
from ralign import align
d=json.load(open('../romaji/snap/live_pre2.json'))
by={(r['owner'][:8],r['idx']):r for r in d}
key=lambda r:(r['table'],r['owner'],r['idx'])
# ---------- Reading source repairs (reading field) ----------
RF={
('0126d120',0):('まっしろなは が','まっしろな は が','noun 歯 stuck to adjective (ja: 真っ白な歯が)'),
('0cd6dbb7',0):('いがいは','いがい は','particle は attached to 以外 (ENO romaji "igai wa")'),
('f90a5185',0):('いぬ はしっぽ','いぬ は しっぽ','particle は stuck to しっぽ (Sudachi mis-token)'),
('f90a5185',1):('いぬ はしっぽ','いぬ は しっぽ','particle は stuck to しっぽ'),
('a7a638ec',0):('おしゃべり はやめに して','おしゃべり は やめ に して','particle は stuck to やめ (やめにして)'),
('df554a87',0):('しごと はやりのこすな よ','しごと は やりのこす な よ','particle は stuck to やりのこす; な = prohibitive'),
('bd6a9242',0):('これ はきゅうです か、ななです か','これ は きゅう です か、なな です か','particle は and copula です stuck (ja: これは「9」ですか、「7」ですか)'),
('39f17a6f',0):('あいだ ではやって','あいだ で はやって','で + はやって (流行る) merged; romaji "de wa yatte" wrong'),
('7fb82666',0):('むかしはなし','むかしばなし','昔話 = むかしばなし (rendaku); romaji already mukashibanashi'),
('59614c4c',2):('かっ と か ない と','かっとかない と','買っとかない = 買っておかない contraction; cut inside verb'),
('01ebb6b8',1):('禁止','きんし','kanji left in reading; romaji kinshi'),
('d2c504c1',0):('に はえどじだい','に えどじだい','ja has no は (古い町並みに江戸時代の…); reading/romaji had a stray は'),
}
# ---------- Romaji content patches ----------
RP={ # (owner8,idx): (old-substring,new-substring) patches ; or ('=', full string)
('1e9a30b6',0):('suutukeesu','suutsukeesu'),
('4491dec1',0):('sodate imasu','sodatete imasu'),
('91dc8243',0):('sodate imasu','sodatete imasu'),
('52f07014',0):('katsuki ga','kakki ga'),
('53232c6c',0):('ikutsumo fushi','ikutsu mo no fushi'),
('590c21a5',0):('enjirimashita','enjimashita'),
('643522ad',0):('tsukarimashita','tsukamarimashita'),
('7809d4bf',0):('ison shisugite','izon shisugite'),
('9dd7cebf',0):('minna ni','mina ni'),
('bef32257',0):('maitsuki matsu','maigetsumatsu'),
('d10270a9',0):('hiite','shiite'),
('d8b56d7a',0):('wakehedateru beki','wakehedate subeki'),
('d8fc7280',0):('Kinkyuji','Kinkyuuji'),
('462ae0aa',0):('sanjuu senchi','sanjussenchi'),
('39f17a6f',0):('de wa yatte','de hayatte'),
('d2c504c1',0):('ni wa Edo','ni Edo'),
('bfb1cc73',1):('=','Dare demo ni tasu ni ikooru yon de aru koto o shitte iru.'),
('8d426f2b',0):('=','Mizu wa zero karorii desu.'),
('57670114',0):('=','Kono zenshuu wa saishuukan ga kakete iru.'),
('31f5a045',0):('=','Kono purasuchikku seihin wa moenai gomi desu.'),
('04194e52',0):('=','Doyoubi ni ryouri kyoushitsu e kayotte imasu.'),
('14bde440',0):('=','Maishuu kono terebi bangumi o mite imasu.'),
('1fd8ba69',0):('=','Konbini de konsaato chiketto o hanbai shite imasu.'),
('25f4e6ce',0):('=','Furui katei denka seihin o shobun shimasu.'),
('5c41fe06',0):('=','Konbini de koukyou ryoukin o haraimashita.'),
('6b84695d',0):('=','Mainichi, nihongo no kaiwa o renshuu shite imasu.'),
('7f1d994c',0):('=','Paatii ruumu wa nikai ni arimasu.'),
('856f89af',0):('=','Denwa bangou o machigaemashita.'),
('a298bda0',0):('=','Kondo issho ni Kyouto e ikimasen ka.'),
('a38bbdb9',0):('=','Michi ga kootte imasu kara, ki o tsukete kudasai.'),
('c34561dd',0):('=','Shourai, umi no chikaku ni ie o tatetai desu.'),
('c96923ed',0):('=','Wareta garasu seihin wa ki o tsukete sutete kudasai.'),
('cd1a1f60',0):('=','Kono zubon no saizu naoshi o onegai shimasu.'),
('cda35ad8',0):('=','Shuugou suru basho o oshiete kudasai.'),
('eafdf6d3',0):('=','Sensei ni denshi meeru o okurimashita.'),
('f408e8db',0):('=','Kono mise dewa, hagaki to kitte o hanbai shite imasu.'),
('5f6867ec',0):('=','Kinou, fushigi na yume o mimashita.'),
('8fe5c173',0):('=','Shuugou suru basho o kakunin shimasu.'),
('90fda1fd',0):('=','Shourai, jibun no kaisha o tsukuritai desu.'),
('0d6e3321',0):('=','Imouto wa rainen hatachi ni narimasu.'),
# conjugation cuts in romaji
('SCAN','shagami mashita'):('shagami mashita','shagamimashita'),
('SCAN','hikiukesase ta'):('hikiukesase ta','hikiukesaseta'),
('SCAN','shite masu'):('hatsu rainichi shite masu','hatsu rainichi shitemasu'),
('SCAN','kizami masu'):('kizami masu','kizamimasu'),
}
reading_cands=[]; romaji_cands=[]; problems=[]
# reading
newread={}
for (o,i),(old,new,why) in RF.items():
    r=by[(o,i)]; e=r['e']; k='reading' if 'reading' in e else 'hiragana'; cur=e[k]
    assert old in cur,(o,i,cur)
    nr=cur.replace(old,new,1)
    assert re.sub(r'\s','',nr)==re.sub(r'\s','',cur) or (o,i) in (('01ebb6b8',1),('d2c504c1',0),('7fb82666',0)),(o,i)
    newread[(o,i)]=nr
    reading_cands.append(dict(table=r['table'],owner=r['owner'],idx=i,key=k,ja=e.get('ja') or e.get('jp'),old=cur,new=nr,why=why))
# romaji patches
ro_new={}
for (o,i),(a,b) in RP.items():
    if o=='SCAN': continue
    r=by[(o,i)]; cur=r['e'].get('romaji') or ''
    if a=='=': nv=b
    else:
        assert a in cur,(o,i,cur,a); nv=cur.replace(a,b,1)
    ro_new[(o,i)]=nv
for r in d:
    e=r['e']; cur=e.get('romaji') or ''
    for (o,i),(a,b) in RP.items():
        if o=='SCAN' and a in cur and (r['owner'][:8],r['idx']) not in ro_new: ro_new[(r['owner'][:8],r['idx'])]=cur.replace(a,b,1)
# spacing insertion for rows with missing boundaries (not already being replaced)
spacing={}
for r in d:
    e=r['e']; rd=e.get('reading') or e.get('hiragana'); ro=e.get('romaji')
    k=(r['owner'][:8],r['idx'])
    if not rd or not ro or k in ro_new: continue
    if k in newread: rd=newread[k]
    ins={}
    ok,rb,bnd,iss,ps=align(rd,ro,ins)
    if ok and ins:
        s=ro
        for off in sorted(ins.values(),reverse=True): s=s[:off]+' '+s[off:]
        assert s.replace(' ','')==ro.replace(' ',''),(k,ro,s)
        spacing[k]=s
print('reading repairs',len(reading_cands),'romaji content/patch',len(ro_new),'spacing',len(spacing))
json.dump(dict(reading=reading_cands,ro_new={'%s|%d'%k:v for k,v in ro_new.items()},spacing={'%s|%d'%k:v for k,v in spacing.items()}),open('plan_romaji.json','w'),ensure_ascii=False,indent=0)
# verification of candidates
bad=0
for k,nv in list(ro_new.items())+list(spacing.items()):
    r=by[k]; e=r['e']; rd=newread.get(k) or e.get('reading') or e.get('hiragana')
    ok,rb,bnd,iss,ps=align(rd,nv)
    miss=bnd-rb
    if not ok or miss:
        bad+=1; print('CAND-FAIL',k,ok,iss[-1:] ,sorted(miss),rd,'|',nv)
print('candidate failures',bad)
import itertools
for k,v in itertools.islice(spacing.items(),12): print(by[k]['e'].get('romaji'),'=>',v)
