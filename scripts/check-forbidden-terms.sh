#!/usr/bin/env bash
# Fails the build if any forbidden legacy term is found anywhere in the repo (case-insensitive).
# Add new legacy terms to the FORBIDDEN_TERMS array below.
#
# Usage:
#   bash scripts/check-forbidden-terms.sh [paths...] [options]
#
# Options:
#   -v, --verbose       Show matches with file:line context (default: only file names on error)
#   -i, --show-ignored  List files/dirs that were ignored by the scan
#   -h, --help          Show this help message
set -euo pipefail

FORBIDDEN_TERMS=(
  "smartimporter"
  "mappingvalidationpanel"
  "skygeo"
  "skygeo360"
  "topovision"
)

VERBOSE=0
SHOW_IGNORED=0
SEARCH_PATHS=()

print_help() {
  sed -n '2,12p' "$0"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -v|--verbose)      VERBOSE=1 ;;
    -i|--show-ignored) SHOW_IGNORED=1 ;;
    -h|--help)         print_help; exit 0 ;;
    --)                shift; SEARCH_PATHS+=("$@"); break ;;
    -*)                echo "Unknown option: $1" >&2; print_help; exit 2 ;;
    *)                 SEARCH_PATHS+=("$1") ;;
  esac
  shift
done
[ ${#SEARCH_PATHS[@]} -eq 0 ] && SEARCH_PATHS=(".")

FOUND=0

# Respect .gitignore + complementary ignore files (when present).
IGNORE_FILE_FLAGS=()
for ignore_file in .npmignore .dockerignore .eslintignore .prettierignore; do
  [ -f "$ignore_file" ] && IGNORE_FILE_FLAGS+=("--ignore-file=$ignore_file")
done

BASE_FLAGS=(
  --hidden
  --no-require-git
  "${IGNORE_FILE_FLAGS[@]}"
)

# Explicit excludes (complement to ignore files).
EXCLUDE_GLOBS=(
  # Dependencies & package managers
  "--glob=!node_modules/**"
  "--glob=!bun.lockb"
  "--glob=!package-lock.json"
  "--glob=!yarn.lock"
  "--glob=!pnpm-lock.yaml"
  "--glob=!*.lock"

  # Build artifacts
  "--glob=!dist/**"
  "--glob=!build/**"
  "--glob=!coverage/**"
  "--glob=!*.tsbuildinfo"

  # IDE / editor configs
  "--glob=!.vscode/**"
  "--glob=!.idea/**"

  # Git & CI
  "--glob=!.git/**"
  "--glob=!.github/**"

  # Generated / static assets
  "--glob=!public/**"
  "--glob=!*.svg"
  "--glob=!*.png"
  "--glob=!*.jpg"
  "--glob=!*.jpeg"
  "--glob=!*.gif"
  "--glob=!*.ico"
  "--glob=!*.woff*"
  "--glob=!*.ttf"
  "--glob=!*.eot"

  # Documentation that may reference legacy names intentionally
  "--glob=!*.md"
  "--glob=!README*"
  "--glob=!REFACTORING*"
  "--glob=!CHANGELOG*"
  "--glob=!LICENSE*"

  # Environment & logs
  "--glob=!*.env*"
  "--glob=!*.log"
  "--glob=!*.log.*"

  # Tooling meta
  "--glob=!.lovable/**"
  "--glob=!scripts/check-forbidden-terms.sh"
)

RG_FLAGS=("${BASE_FLAGS[@]}" "${EXCLUDE_GLOBS[@]}")

if [ "$SHOW_IGNORED" -eq 1 ]; then
  echo "── Ignored files/dirs (skipped by the scan) ──"
  # rg --debug emits lines like:  "ignoring ./path: Ignore(...)"  on stderr.
  # We extract the path + the matching rule (gitignore/glob) for readability.
  IGNORED=$(rg --files --debug "${RG_FLAGS[@]}" "${SEARCH_PATHS[@]}" 2>&1 1>/dev/null \
    | grep -oE "ignoring [^:]+:.*(Gitignore|Override|Globs?)" \
    | sed -E 's/ignoring (.+):.*(Gitignore|Override|Globs?).*/  \1   [\2]/' \
    | sort -u || true)

  if [ -n "$IGNORED" ]; then
    echo "$IGNORED"
  else
    echo "  (none reported for the given paths)"
  fi
  echo "──────────────────────────────────────────────"
  echo
fi


for term in "${FORBIDDEN_TERMS[@]}"; do
  MATCHES=$(rg -in "${RG_FLAGS[@]}" "$term" "${SEARCH_PATHS[@]}" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "::error::Forbidden legacy term '$term' (case-insensitive) found"
    if [ "$VERBOSE" -eq 1 ]; then
      echo "$MATCHES"
    else
      echo "$MATCHES" | awk -F: '{print "  " $1 ":" $2}'
    fi
    FOUND=1
  fi
done

if [ "$FOUND" -ne 0 ]; then
  exit 1
fi

echo "✅ No forbidden legacy terms found."
