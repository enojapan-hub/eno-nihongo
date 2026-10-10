#!/usr/bin/env bash
# Tes migration 20261020000000 pada Postgres LOKAL sementara (bukan Production).
# Prasyarat: server Postgres berjalan, contoh: PGHOST=/tmp PGPORT=54329 PGUSER=postgres.
# Membuat database t_old (meniru Production) dan t_new (setelah migration), lalu mengadu keduanya.
set -euo pipefail
cd "$(dirname "$0")"; M=../../migrations/20261020000000_v2_integrity_hardening.sql; M2=../../migrations/20261020000100_revoke_excess_table_privileges.sql; M3=../../migrations/20261020000200_my_reports_rpc.sql
P="psql -q -v ON_ERROR_STOP=1"
psql -q -d postgres -c "create role anon nologin" -c "create role authenticated nologin" 2>/dev/null || true
for db in t_old t_new; do $P -d postgres -c "drop database if exists $db" -c "create database $db"; $P -d $db -f schema.sql -f legacy.sql; done
python3 - "$M" > /tmp/old8.sql <<'PY'
import sys
m=open(sys.argv[1]).read(); s=m.index('create or replace function public.record_learning_activity'); e=m.index('$function$;',s)+11
f=m[s:e].replace("set search_path = pg_catalog, public, auth","set search_path to 'pg_catalog,public,auth'")
print('\n'.join(l for l in f.split('\n') if 'pg_advisory_xact_lock' not in l))
PY
$P -d t_old -f /tmp/old8.sql; $P -d t_new -f /tmp/old8.sql -f "$M"; $P -d t_new -f "$M"   # kedua: uji idempotensi
$P -d t_new -c "create table public.extra_t(id int)" -c "grant all on public.extra_t to anon, authenticated"
$P -d t_new -f "$M2" && $P -d t_new -f "$M2"   # migration 2 + idempotensi
G=$(psql -Atd t_new -c "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')")
A=$(psql -Atd t_new -c "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE')")
D=$(psql -Atd t_new -c "select count(*) from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')")
echo "migration2: excess_grants=$G anon_writes=$A authenticated_dml=$D"
[ "$G" = 0 ] && [ "$A" = 0 ] && [ "$D" -gt 0 ] || { echo "GAGAL: pencabutan hak tidak sesuai"; exit 1; }
$P -d t_new -f "$M3" && $P -d t_new -f "$M3"   # migration 3 + idempotensi
UA=11111111-1111-1111-1111-111111111111; UB=33333333-3333-3333-3333-333333333333
$P -d t_new -c "insert into content_reports(reporter_id,subject,status,resolution_note) values('$UA','A1','open','catatan staf'),('$UA','A2','resolved','catatan staf')" \
  -c "insert into content_reports(reporter_id,subject,chat_category) values('$UA','A-sosial','spam')" \
  -c "insert into content_reports(reporter_id,subject,target_user_id) values('$UA','A-laporkan-user','$UB')" \
  -c "insert into content_reports(reporter_id,subject) values('$UB','B1')"
as() { psql -Atd t_new -c "set role authenticated" -c "select set_config('app.uid','$1',false)" -c "$2" | tail -n +3; }
CA=$(as $UA "select count(*) from get_my_reports()"); CB=$(as $UB "select count(*) from get_my_reports()")
L0=$(as $UA "select count(*) from get_my_reports(0)"); LX=$(as $UA "select count(*) from get_my_reports(100000)")
DIRECT=$(psql -Atd t_new -c "set role authenticated" -c "select count(*) from content_reports" 2>&1 | grep -c "permission denied" || true)
ANON=$(psql -Atd t_new -c "set role anon" -c "select count(*) from get_my_reports()" 2>&1 | grep -c "permission denied" || true)
NOUID=$(psql -Atd t_new -c "set role authenticated" -c "select count(*) from get_my_reports()" | tail -n +2)
echo "migration3: A=$CA(harap 2) B=$CB(harap 1) limit0=$L0(harap 1) limitBesar=$LX(<=50) direct_denied=$DIRECT anon_denied=$ANON tanpa_uid=$NOUID(harap 0)"
[ "$CA" = 2 ] && [ "$CB" = 1 ] && [ "$L0" = 1 ] && [ "$LX" -le 50 ] && [ "$DIRECT" = 1 ] && [ "$ANON" = 1 ] && [ "$NOUID" = 0 ] || { echo "GAGAL: get_my_reports"; exit 1; }
for db in t_old t_new; do
  $P -d $db -c "grant execute on all functions in schema public to authenticated; insert into profiles values('11111111-1111-1111-1111-111111111111','T',null,'N5','id'); insert into kanji select ('00000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid,true from generate_series(1,200) g"
  pgbench -n -c 20 -j 20 -t 100 -f race.pgb "$db" >/dev/null
  echo "$db total_xp=$(psql -Atd $db -c 'select total_xp from user_stats') expected=$((5*$(psql -Atd $db -c "select count(distinct metadata->>'content_id') from learning_activity")))"
done   # harapan: t_old > expected (race), t_new == expected
N=$(psql -Atd t_new -c "select total_xp from user_stats"); E=$((5*$(psql -Atd t_new -c "select count(distinct metadata->>'content_id') from learning_activity")))
[ "$N" = "$E" ] || { echo "GAGAL: race XP belum teratasi di t_new"; exit 1; }
echo "LULUS: migration, idempotensi, pencabutan hak, anti-race XP, dan get_my_reports"
