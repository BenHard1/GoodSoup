#!/usr/bin/env bash
# Recrée une base PostgreSQL nue + l'imitation Supabase, puis applique toutes les migrations.
# Usage : LOCAL_PG_URL=postgresql://postgres@127.0.0.1:54329 scripts/local-db-reset.sh
set -euo pipefail
BASE_URL="${LOCAL_PG_URL:-postgresql://postgres@127.0.0.1:54329}"
psql "$BASE_URL/postgres" -q -v ON_ERROR_STOP=1 -c "drop database if exists goodsoup_test with (force)" -c "create database goodsoup_test"
psql "$BASE_URL/goodsoup_test" -q -v ON_ERROR_STOP=1 -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then
  execute 'create role anon nologin noinherit'; execute 'create role authenticated nologin noinherit';
  execute 'create role service_role nologin noinherit bypassrls'; end if; end \$\$;"
sed '/^create role /d; /^grant anon, authenticated, service_role to postgres;/d' tests/db/local-shim.sql \
  | psql "$BASE_URL/goodsoup_test" -q -v ON_ERROR_STOP=1
psql "$BASE_URL/goodsoup_test" -q -c "grant anon, authenticated, service_role to postgres" 2>/dev/null || true
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql "$BASE_URL/goodsoup_test" -q -v ON_ERROR_STOP=1 -f "$f"
done
if [ -f supabase/seed.sql ]; then psql "$BASE_URL/goodsoup_test" -q -v ON_ERROR_STOP=1 -f supabase/seed.sql; fi
echo "Base locale prête : $BASE_URL/goodsoup_test"
