#!/usr/bin/env bash
# Chạy migration + pgTAP trên Postgres thuần (không cần Docker).
# Dùng: DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db-local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${DATABASE_URL:-postgres://postgres@localhost:5432/postgres}"
DB="trao_test_$$"
psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -qc "drop database if exists $DB" >/dev/null' EXIT
URL="${ADMIN_URL%/*}/$DB"
PSQL=(psql "$URL" -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/local-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done
"${PSQL[@]}" -c "create extension if not exists pgtap with schema extensions" >/dev/null
status=0
for t in "$ROOT"/supabase/tests/database/*.test.sql; do
  echo "# $(basename "$t")"
  out="$(PGOPTIONS='--search_path=public,extensions' psql "$URL" -X -q -t -A -v ON_ERROR_STOP=1 -f "$t" 2>&1)" || status=1
  echo "$out"
  grep -qE '^not ok|^# Looks like|ERROR' <<<"$out" && status=1
done
exit $status
