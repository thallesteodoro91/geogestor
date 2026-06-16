#!/usr/bin/env bash
# Validates Supabase migrations:
#  1. Filename matches `YYYYMMDDHHMMSS_<slug>.sql` (TODAS as migrations)
#  2. CREATE TABLE public.<x> + GRANT + ENABLE RLS no mesmo arquivo —
#     ENFORÇADO apenas em migrations cujo timestamp seja >= MIGRATION_GRANT_SINCE
#     (default 20260616000000). Migrations legadas só geram aviso.
set -euo pipefail

DIR="supabase/migrations"
SINCE="${MIGRATION_GRANT_SINCE:-20260616000000}"

if [[ ! -d "$DIR" ]]; then
  echo "::warning::No migrations directory found at $DIR"
  exit 0
fi

fail=0
shopt -s nullglob
for f in "$DIR"/*.sql; do
  base=$(basename "$f")
  ts="${base:0:14}"

  # 1. Filename pattern (sempre)
  if [[ ! "$base" =~ ^[0-9]{14}_[A-Za-z0-9._-]+\.sql$ ]]; then
    echo "::error file=$f::Filename '$base' does not match YYYYMMDDHHMMSS_<slug>.sql"
    fail=1
  fi

  # 2. CREATE TABLE → GRANT / RLS (apenas para arquivos novos)
  enforce_grant=1
  if [[ "$ts" < "$SINCE" ]]; then
    enforce_grant=0
  fi

  tables=$(grep -iEo 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?public\.[a-zA-Z0-9_]+' "$f" \
            | sed -E 's/.*public\.//I' | sort -u || true)

  for t in $tables; do
    if ! grep -iqE "grant[[:space:]]+.*on[[:space:]]+(table[[:space:]]+)?public\.$t\b" "$f"; then
      if [[ $enforce_grant -eq 1 ]]; then
        echo "::error file=$f::Table public.$t criada sem GRANT no mesmo arquivo"
        fail=1
      fi
    fi
    if ! grep -iqE "alter[[:space:]]+table[[:space:]]+public\.$t[[:space:]]+enable[[:space:]]+row[[:space:]]+level[[:space:]]+security" "$f"; then
      if [[ $enforce_grant -eq 1 ]]; then
        echo "::warning file=$f::Table public.$t sem ENABLE ROW LEVEL SECURITY no mesmo arquivo"
      fi
    fi
  done
done

if [[ $fail -ne 0 ]]; then
  echo "::error::Migration validation failed"
  exit 1
fi
echo "✅ Migrations validadas ($(ls "$DIR"/*.sql 2>/dev/null | wc -l) arquivos)"
