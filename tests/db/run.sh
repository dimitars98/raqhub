#!/usr/bin/env bash
# ============================================================================
# Runs the database tests: builds the RaqHub database from scratch on a
# plain Postgres (16+), then runs every tests/db/*.test.sql file on its own
# fresh copy.
#
#   bash tests/db/run.sh
#
# It connects with the usual PG* settings (PGHOST, PGPORT, PGUSER,
# PGPASSWORD); the user must be a superuser. In CI (GitHub Actions) a
# Postgres is started for it: see .github/workflows/ci.yml.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.."

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
BASE=raqhub_test_base
FAILED=0
PASSED=0

run() { "${PSQL[@]}" "$@"; }

echo "Building the database..."
run -d postgres -c "drop database if exists $BASE" -c "create database $BASE" >/dev/null 2>&1 || exit 1

load() {
  local file=$1
  # pg_cron and pg_net only exist on Supabase (setup/supabase.sql fakes pg_cron).
  if ! sed -E 's/create extension if not exists (pg_cron|pg_net)[^;]*;//I' "$file" \
      | run -d "$BASE" -f - >/tmp/raqhub-load.log 2>&1; then
    echo "FAILED to load $file:"
    grep -iE "error|line" /tmp/raqhub-load.log | head -5
    exit 1
  fi
}

load tests/db/setup/supabase.sql
load supabase/schema.sql
load tests/db/setup/dashboard.sql
for f in $(ls supabase/migrations/*.sql | LC_ALL=C sort); do
  load "$f"
done
load tests/db/helpers.sql
load tests/db/seed.sql
echo "Built: schema, $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migrations, seed data."
echo

for test in $(ls tests/db/*.test.sql | LC_ALL=C sort); do
  name=$(basename "$test" .test.sql)
  db="raqhub_test_$name"
  run -d postgres -c "drop database if exists $db" -c "create database $db template $BASE" >/dev/null 2>&1
  out=$(run -d "$db" -f "$test" 2>&1)
  status=$?
  oks=$(grep -c "NOTICE:  ok - " <<<"$out")
  if [ $status -eq 0 ]; then
    echo "✓ $name ($oks checks)"
    PASSED=$((PASSED + oks))
  else
    echo "✗ $name — failed after $oks checks:"
    # The failing check (or the SQL error), with its file and line.
    grep -E "ERROR|DETAIL|HINT|CONTEXT" <<<"$out" | sed -E 's/^psql:[^:]*:([0-9]+): /line \1: /; s/^/    /' | head -6
    FAILED=$((FAILED + 1))
  fi
  run -d postgres -c "drop database if exists $db" >/dev/null 2>&1
done

run -d postgres -c "drop database if exists $BASE" >/dev/null 2>&1
echo
if [ $FAILED -gt 0 ]; then
  echo "$FAILED test file(s) failed."
  exit 1
fi
echo "All database tests passed ($PASSED checks)."
