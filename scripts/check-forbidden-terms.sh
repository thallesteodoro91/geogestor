#!/usr/bin/env bash
# Fails the build if any forbidden legacy term is found anywhere in the repo (case-insensitive).
# Add new legacy terms to the FORBIDDEN_TERMS array below.
set -euo pipefail

FORBIDDEN_TERMS=(
  "smartimporter"
  "mappingvalidationpanel"
  "skygeo"
  "skygeo360"
  "topovision"
)

SEARCH_PATHS=("${@:-.}")
FOUND=0

# Exclude common non-source directories and generated files
EXCLUDE_GLOBS=(
  "--glob=!node_modules/**"
  "--glob=!dist/**"
  "--glob=!build/**"
  "--glob=!.git/**"
  "--glob=!.lovable/**"
  "--glob=!coverage/**"
  "--glob=!*.lock"
  "--glob=!package-lock.json"
  "--glob=!yarn.lock"
  "--glob=!pnpm-lock.yaml"
  "--glob=!bun.lockb"
  "--glob=!*.svg"
  "--glob=!public/**"
)

for term in "${FORBIDDEN_TERMS[@]}"; do
  if rg -il "${EXCLUDE_GLOBS[@]}" "$term" "${SEARCH_PATHS[@]}" 2>/dev/null | grep -q .; then
    echo "::error::Forbidden legacy term '$term' (case-insensitive) found"
    rg -in "${EXCLUDE_GLOBS[@]}" "$term" "${SEARCH_PATHS[@]}" || true
    FOUND=1
  fi
done

if [ "$FOUND" -ne 0 ]; then
  exit 1
fi

echo "✅ No forbidden legacy terms found."
