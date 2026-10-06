-- Perbaikan simpan profil: "permission denied for function social_normalize_text" (aditif, idempoten, tanpa data berubah).
--
-- Akar masalah: trigger trg_profiles_official_name (v6) -> profiles_guard_official_name() berjalan SECURITY INVOKER,
-- yaitu sebagai pengguna `authenticated`. Fungsi itu memanggil social_official_lookalike() -> social_normalize_text(),
-- helper internal yang SENGAJA dicabut dari klien (v2: revoke ... from public, anon, authenticated). Setiap role non-staf
-- (student/teacher) yang mengubah display_name karenanya gagal; owner/admin lolos hanya karena `old.role not in
-- ('owner','admin')` menghentikan pemanggilan lebih awal.
--
-- Perbaikan: fungsi trigger penjaga dijalankan sebagai definer (pemilik fungsi) dengan search_path kosong, sehingga rantai
-- helper internal berjalan di konteks pemilik. Tidak ada grant baru ke klien; fungsi trigger itu sendiri dikunci dari
-- public/anon/authenticated (hak EXECUTE tidak diperiksa saat trigger menyala). Aturan anti-peniruan identitas resmi,
-- RLS profiles (hanya baris sendiri), dan sinkron social_profiles (v7) tidak berubah.

create or replace function public.profiles_guard_official_name()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name
     and old.role not in ('owner', 'admin')
     and public.social_official_lookalike(new.display_name) then
    raise exception 'Nama tampilan tidak tersedia.';
  end if;
  return new;
end
$$;
revoke all on function public.profiles_guard_official_name() from public, anon, authenticated;
