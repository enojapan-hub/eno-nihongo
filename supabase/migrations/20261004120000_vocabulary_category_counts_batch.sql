-- Hitungan semua kategori kosakata dalam SATU panggilan.
-- Sebelumnya halaman Materi memanggil get_vocabulary_count_by_category sekali per kategori (38x),
-- dan setiap panggilan menghitung ulang get_vocabulary_lexical_rows(level). Fungsi ini aditif:
-- get_vocabulary_count_by_category tetap ada dan hasilnya identik per slug.
create or replace function public.get_vocabulary_category_counts(p_level public.jlpt_level)
returns table (category_slug text, item_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.canonical_slug, c.slug) as category_slug, count(distinct r.id) as item_count
  from public.get_vocabulary_lexical_rows(p_level) r
  join public.vocabulary_category_links l on l.vocabulary_id = r.origin_id
  join public.vocabulary_categories c on c.id = l.category_id
  where c.is_active
  group by 1
$$;

revoke all on function public.get_vocabulary_category_counts(public.jlpt_level) from public, anon;
grant execute on function public.get_vocabulary_category_counts(public.jlpt_level) to authenticated, service_role;
