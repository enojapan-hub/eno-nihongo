create or replace function public.get_admin_overview()
returns jsonb language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare v_role text; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
 return jsonb_build_object(
  'users',(select count(*) from public.profiles),
  'free_users',(select count(*) from public.profiles where coalesce(plan,'free')='free'),
  'premium_users',(select count(*) from public.profiles where plan='premium' and (premium_until is null or premium_until>now())),
  'lifetime_users',(select count(*) from public.profiles where plan='lifetime'),
  'kanji',(select count(*) from public.kanji where is_published=true),
  'vocabulary',(select count(*) from public.vocabulary where is_published=true),
  'grammar',(select count(*) from public.grammar_points where is_published=true),
  'reading',(select count(*) from public.reading_passages where is_published=true),
  'listening',(select count(*) from public.listening_items where is_published=true)
 );
end $$;
revoke all on function public.get_admin_overview() from public,anon;
grant execute on function public.get_admin_overview() to authenticated;
