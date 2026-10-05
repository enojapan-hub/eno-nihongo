-- Social badges: status publik minimal (Verified / Sensei / Diamond) untuk identitas sosial.
-- Additive: satu fungsi baru, tidak mengubah tabel/RPC/RLS yang ada. Tidak ada role/premium baru.
--   verified = profiles.role = 'owner'   (akun resmi)
--   sensei   = profiles.role = 'teacher' (Guru)
--   diamond  = membership berbayar AKTIF, aturan yang sama dengan get_my_membership/_membership_snapshot:
--              plan='lifetime' atau (plan='premium' dan (premium_until null atau > now()))
--              Akses gratis karena peran staf TIDAK dihitung sebagai Premium.
-- Hanya tiga boolean yang keluar; role mentah/izin/plan/tanggal tidak pernah diekspos.
create or replace function public.social_badges(p_users uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_users is null or cardinality(p_users) = 0 then return '{}'::jsonb; end if;
  if cardinality(p_users) > 100 then raise exception 'too_many_users'; end if;
  select coalesce(jsonb_object_agg(b.id::text, jsonb_build_object(
           'verified', b.verified, 'sensei', b.sensei, 'diamond', b.diamond)), '{}'::jsonb)
    into v_result
    from (
      select p.id,
             p.role = 'owner' as verified,
             p.role = 'teacher' as sensei,
             (p.plan = 'lifetime' or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))) as diamond
        from public.profiles p
       where p.id = any (p_users)
    ) b
   where b.verified or b.sensei or b.diamond;
  return v_result;
end;
$$;

revoke all on function public.social_badges(uuid[]) from public, anon;
grant execute on function public.social_badges(uuid[]) to authenticated;
