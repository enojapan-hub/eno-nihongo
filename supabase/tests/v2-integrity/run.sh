#!/usr/bin/env bash
# Tes migration 20261020000000 pada Postgres LOKAL sementara (bukan Production).
# Prasyarat: server Postgres berjalan, contoh: PGHOST=/tmp PGPORT=54329 PGUSER=postgres.
# Membuat database t_old (meniru Production) dan t_new (setelah migration), lalu mengadu keduanya.
set -euo pipefail
cd "$(dirname "$0")"; M=../../migrations/20261020000000_v2_integrity_hardening.sql
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
for db in t_old t_new; do
  $P -d $db -c "grant execute on all functions in schema public to authenticated; insert into profiles values('11111111-1111-1111-1111-111111111111','T',null,'N5','id'); insert into kanji select ('00000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid,true from generate_series(1,200) g"
  pgbench -n -c 20 -j 20 -t 100 -f race.pgb "$db" >/dev/null
  echo "$db total_xp=$(psql -Atd $db -c 'select total_xp from user_stats') expected=$((5*$(psql -Atd $db -c "select count(distinct metadata->>'content_id') from learning_activity")))"
done   # harapan: t_old > expected (race), t_new == expected
