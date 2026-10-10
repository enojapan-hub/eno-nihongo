-- ENO NIHONGO v2 — Pusat Bantuan: pengguna melihat status laporannya sendiri (LOCAL, belum diterapkan).
-- content_reports sengaja TANPA hak/policy klien (dikunci oleh tes social-core-v7). Karena itu
-- pembacaan dilakukan lewat RPC baca-sendiri, bukan policy SELECT.
-- Yang dikembalikan hanya laporan bantuan milik pemanggil (bukan laporan sosial/chat atau laporan
-- tentang pengguna lain), dengan kolom terbatas. resolution_note, assigned_to, dan priority
-- (catatan internal staf) TIDAK dikembalikan.
create or replace function public.get_my_reports(p_limit integer default 20)
returns table (id uuid, category text, subject text, status text, created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $function$
  select r.id, r.category, r.subject, r.status, r.created_at, r.updated_at
  from public.content_reports r
  where r.reporter_id = (select auth.uid())
    and r.chat_category is null
    and r.target_user_id is null
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$function$;

revoke all on function public.get_my_reports(integer) from public, anon;
grant execute on function public.get_my_reports(integer) to authenticated;
