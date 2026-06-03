#!/usr/bin/env bash
# Fails the build if any forbidden legacy term is found in src/ (case-insensitive).
# Add new legacy terms to the FORBIDDEN_TERMS array below.
set -euo pipefail

FORBIDDEN_TERMS=(
  "smartimporter"
  "mappingvalidationpanel"
  "skygeo"
  "skygeo360"
  "topovision"
)

SEARCH_PATH="${1:-src/}"
FOUND=0

for term in "${FORBIDDEN_TERMS[@]}"; do
  if rg -il "$term" "$SEARCH_PATH" --type ts --type tsx 2>/dev/null | grep -q .; then
    echo "::error::Forbidden legacy term '$term' (case-insensitive) found in $SEARCH_PATH"
    rg -in "$term" "$SEARCH_PATH" --type ts --type tsx || true
    FOUND=1
  fi
done

if [ "$FOUND" -ne 0 ]; then
  exit 1
fi

echo "✅ No forbidden legacy terms found."
