with v(pk,i,k,g,seg) as (values
@V@),
n as (
 select t.id, jsonb_agg(case when m.pk is not null and left(md5(el->>kk),6)=m.g and tot=length(s)
   then jsonb_set(el, array[kk], to_jsonb(nw)) else el end order by ord) ex
 from public.@T@ t
 cross join lateral jsonb_array_elements(t.examples) with ordinality a(el,ord)
 left join v m on left(t.id::text,8)=m.pk and m.i=ord-1
 cross join lateral (select case m.k when 'r' then 'reading' else 'hiragana' end kk) q1
 cross join lateral (select replace(el->>kk,' ','') s) q2
 cross join lateral (select coalesce(sum(ln),0) tot, string_agg(substr(s,st::int,ln),' ' order by nn) nw
   from (select nn, ln, 1+coalesce((sum(ln) over (order by nn rows between unbounded preceding and 1 preceding))::int,0) st
     from (select nn, position(substr(m.seg,nn,1) in '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')-1 ln
       from generate_series(1,length(coalesce(m.seg,''))) nn) z) y) q3
 where left(t.id::text,8) in (select pk from v)
 group by t.id),
u as (update public.@T@ t set examples=n.ex from n where t.id=n.id and t.examples is distinct from n.ex returning t.id)
select '@T@' tbl,(select count(*) from u) updated_rows,(select count(*) from v) planned;
