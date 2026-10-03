import json,re,hashlib,os,collections
P=json.load(open('master_plan.json'))
AL='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
md=lambda s:hashlib.md5((s or '').encode()).hexdigest()[:6]
q=lambda s:"'"+s.replace("'","''")+"'"
def seg(old,new):
    # lengths of words of `new` over nospace string
    ws=new.split(' ')
    assert old.replace(' ','')==new.replace(' ',''),(old,new)
    ws=[w for w in ws if w!='']
    return ''.join(AL[len(w)] for w in ws)
B={1:[],2:[],3:[],4:[]}
for p in P:
    for f,v in p['fields'].items():
        cat=v['cat']; t=p['table']; pk=p['owner'][:8]; i=p['idx']
        if f=='id': b=3
        elif f=='romaji': b=2
        elif cat.startswith('missing-reading'): b=1
        else: b=4
        spaceonly = v['old'] is not None and v['old'].replace(' ','')==v['new'].replace(' ','') and max(len(w) for w in v['new'].split(' '))<62
        B[b].append(dict(t=t,pk=pk,i=i,f=f,old=v['old'],new=v['new'],so=spaceonly))
KK={'reading':'r','hiragana':'h','romaji':'o','id':'i'}
os.makedirs('sql',exist_ok=True)
for f in os.listdir('sql'): os.remove('sql/'+f)
def stmt(t,rows,so):
    if so:
        vals=',\n'.join("(%s,%d,%s,%s,%s)"%(q(r['pk']),r['i'],q(KK[r['f']]),q(md(r['old'])),q(seg(r['old'],r['new']))) for r in rows)
        return f"""with v(pk,i,k,g,seg) as (values
{vals}),
n as (
 select t.id, jsonb_agg(case when m.pk is not null and left(md5(coalesce(el->>kk,'')),6)=m.g and tot=length(s)
   then jsonb_set(el, array[kk], to_jsonb(nw)) else el end order by ord) ex
 from public.{t} t
 cross join lateral jsonb_array_elements(t.examples) with ordinality a(el,ord)
 left join v m on left(t.id::text,8)=m.pk and m.i=ord-1
 cross join lateral (select case m.k when 'r' then 'reading' when 'h' then 'hiragana' else 'romaji' end kk) q1
 cross join lateral (select replace(coalesce(el->>kk,''),' ','') s) q2
 cross join lateral (select coalesce(sum(ln),0) tot, string_agg(substr(s,st,ln),' ' order by nn) nw
   from (select nn, ln, (1+coalesce(sum(ln) over (order by nn rows between unbounded preceding and 1 preceding),0))::int st
     from (select nn, position(substr(m.seg,nn,1) in '{AL}')-1 ln
       from generate_series(1,length(coalesce(m.seg,''))) nn) z) y) q3
 where left(t.id::text,8) in (select pk from v)
 group by t.id)
update public.{t} u set examples=n.ex from n where u.id=n.id and u.examples is distinct from n.ex
returning left(u.id::text,8) pk;"""
    vals=',\n'.join("(%s,%d,%s,%s,%s)"%(q(r['pk']),r['i'],q(KK[r['f']]),q(md(r['old'])),q(r['new'])) for r in rows)
    return f"""with v(pk,i,k,g,nw) as (values
{vals}),
n as (
 select t.id, jsonb_agg(case when m.pk is not null and left(md5(coalesce(el->>kk,'')),6)=m.g
   then jsonb_set(el, array[kk], to_jsonb(m.nw), true) else el end order by ord) ex
 from public.{t} t
 cross join lateral jsonb_array_elements(t.examples) with ordinality a(el,ord)
 left join v m on left(t.id::text,8)=m.pk and m.i=ord-1
 cross join lateral (select case m.k when 'r' then 'reading' when 'h' then 'hiragana' when 'o' then 'romaji' else 'id' end kk) q1
 where left(t.id::text,8) in (select pk from v)
 group by t.id)
update public.{t} u set examples=n.ex from n where u.id=n.id and u.examples is distinct from n.ex
returning left(u.id::text,8) pk;"""
man=[]
for b,rows in B.items():
    for t in ('vocabulary','vocabulary_senses','grammar_points'):
        for so in (True,False):
            rs=[r for r in rows if r['t']==t and r['so']==so]
            # uniqueness of (pk,i) within statement
            assert len({(r['pk'],r['i']) for r in rs})==len(rs)
            step=120 if so else 60
            for n0 in range(0,len(rs),step):
                ch=rs[n0:n0+step]; name=f"b{b}_{t}_{'S' if so else 'C'}_{n0//step:02d}.sql"
                open('sql/'+name,'w').write(stmt(t,ch,so)); man.append((b,name,len(ch)))
json.dump(man,open('sql_manifest.json','w'))
print(collections.Counter(b for b,_,_ in man)); print({b:len(r) for b,r in B.items()}); print(len(man), sum(os.path.getsize('sql/'+n) for _,n,_ in man))
