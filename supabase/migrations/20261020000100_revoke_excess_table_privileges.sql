-- ENO NIHONGO v2 — cabut hak tabel berlebih (LOCAL, belum diterapkan ke Production).
-- Dasar audit read-only 2026-10-11: RLS aktif di 111/111 tabel public dan TIDAK ada policy
-- INSERT/UPDATE/DELETE untuk anon/public, tetapi hak tabel masih terbuka:
--   TRUNCATE: 36 tabel (authenticated) / 34 tabel (anon). TRUNCATE tidak tunduk pada RLS.
--   TRIGGER/REFERENCES: 38 tabel. INSERT/UPDATE/DELETE untuk anon: 34 tabel.
-- PostgREST tidak pernah memakai TRUNCATE/TRIGGER/REFERENCES, dan anon tidak punya policy tulis,
-- sehingga pencabutan ini tidak mengubah perilaku aplikasi. Hak SELECT/INSERT/UPDATE/DELETE
-- authenticated tetap seperti semula (dibatasi RLS). Fungsi SECURITY DEFINER berjalan sebagai owner.
-- Idempotent; tidak merusak data.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('revoke truncate, references, trigger on table public.%I from anon, authenticated', r.relname);
    execute format('revoke insert, update, delete on table public.%I from anon', r.relname);
  end loop;
end $$;

-- Tabel baru yang dibuat oleh role migration tidak lagi mewarisi hak berlebih itu.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete on tables from anon;
