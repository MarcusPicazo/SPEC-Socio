#!/usr/bin/env bash
# Runs the SQL tests in supabase/tests/*.test.sql against a throwaway
# database on a LOCAL Postgres (never a real Supabase project): creates the
# database, applies supabase/tests/stubs.sql, every migration in order, then
# each test file. Usage:
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres scripts/test-sql.sh
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
set -euo pipefail
cd "$(dirname "$0")/.."

db="socio_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT

run() { psql -v ON_ERROR_STOP=1 -q -X -d "$db" -f "$1" >/dev/null; }

run supabase/tests/stubs.sql
# pg_cron, pg_net and Vault aren't installable on a plain Postgres; the
# stubs already provide the names the migrations use, so skip only those
# three `create extension` lines.
for migration in supabase/migrations/*.sql; do
  sed -E '/^create extension if not exists (pg_cron|pg_net|supabase_vault);/d' "$migration" \
    | psql -v ON_ERROR_STOP=1 -q -X -d "$db" >/dev/null
done
for test in supabase/tests/*.test.sql; do
  psql -v ON_ERROR_STOP=1 -q -X -d "$db" -f "$test"
done
