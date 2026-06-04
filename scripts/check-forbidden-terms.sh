#!/usr/bin/env bash
# Fails the build if any forbidden legacy term is found anywhere in the repo (case-insensitive).
# Add new legacy terms to the FORBIDDEN_TERMS array below.
#
# Usage:
#   bash scripts/check-forbidden-terms.sh [paths...] [options]
#
# Options:
#   -v, --verbose         Show matches with file:line content (default: only file:line)
#   -i, --show-ignored    List files/dirs ignored by the scan
#   -j, --json[=PATH]     Export a JSON report (ignored + matches). Default path:
#                         forbidden-terms-report.json. Use "-" to write to stdout.
#   -h, --help            Show this help message
set -euo pipefail

# Stable report schema version — bump on breaking JSON changes.
REPORT_VERSION="1.0.0"
REPORT_SCHEMA="https://geogestor.lovable.app/schemas/forbidden-terms-report/v1"

FORBIDDEN_TERMS=(
  "smartimporter"
  "mappingvalidationpanel"
  "skygeo"
  "skygeo360"
  "topovision"
)

VERBOSE=0
SHOW_IGNORED=0
JSON_OUT=""
SEARCH_PATHS=()

print_help() { sed -n '2,13p' "$0"; }

while [ $# -gt 0 ]; do
  case "$1" in
    -v|--verbose)      VERBOSE=1 ;;
    -i|--show-ignored) SHOW_IGNORED=1 ;;
    -j|--json)         JSON_OUT="forbidden-terms-report.json" ;;
    --json=*)          JSON_OUT="${1#--json=}" ;;
    -j=*)              JSON_OUT="${1#-j=}" ;;
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

BASE_FLAGS=(--hidden --no-require-git "${IGNORE_FILE_FLAGS[@]}")

EXCLUDE_GLOBS=(
  # Dependencies & package managers
  "--glob=!node_modules/**" "--glob=!bun.lockb" "--glob=!package-lock.json"
  "--glob=!yarn.lock" "--glob=!pnpm-lock.yaml" "--glob=!*.lock"
  # Build artifacts
  "--glob=!dist/**" "--glob=!build/**" "--glob=!coverage/**" "--glob=!*.tsbuildinfo"
  # IDE / editor configs
  "--glob=!.vscode/**" "--glob=!.idea/**"
  # Git & CI
  "--glob=!.git/**" "--glob=!.github/**"
  # Generated / static assets
  "--glob=!public/**" "--glob=!*.svg" "--glob=!*.png" "--glob=!*.jpg" "--glob=!*.jpeg"
  "--glob=!*.gif" "--glob=!*.ico" "--glob=!*.woff*" "--glob=!*.ttf" "--glob=!*.eot"
  # Documentation
  "--glob=!*.md" "--glob=!README*" "--glob=!REFACTORING*" "--glob=!CHANGELOG*" "--glob=!LICENSE*"
  # Environment & logs
  "--glob=!*.env*" "--glob=!*.log" "--glob=!*.log.*"
  # Tooling meta
  "--glob=!.lovable/**" "--glob=!scripts/check-forbidden-terms.sh"
)

RG_FLAGS=("${BASE_FLAGS[@]}" "${EXCLUDE_GLOBS[@]}")

# Collect ignored paths once (used by --show-ignored and --json).
collect_ignored() {
  rg --files --debug "${RG_FLAGS[@]}" "${SEARCH_PATHS[@]}" 2>&1 1>/dev/null \
    | grep -oE "ignoring [^:]+:.*(Gitignore|Override|Globs?)" \
    | sed -E 's/ignoring (.+):.*(Gitignore|Override|Globs?).*/\1\t\2/' \
    | sort -u || true
}

IGNORED_TSV=""
if [ "$SHOW_IGNORED" -eq 1 ] || [ -n "$JSON_OUT" ]; then
  IGNORED_TSV=$(collect_ignored)
fi

if [ "$SHOW_IGNORED" -eq 1 ]; then
  echo "── Ignored files/dirs (skipped by the scan) ──"
  if [ -n "$IGNORED_TSV" ]; then
    echo "$IGNORED_TSV" | awk -F'\t' '{printf "  %s   [%s]\n", $1, $2}'
  else
    echo "  (none reported for the given paths)"
  fi
  echo "──────────────────────────────────────────────"
  echo
fi

# Collect matches (TSV: term \t file:line:content) for both console + JSON.
ALL_MATCHES_TSV=""
for term in "${FORBIDDEN_TERMS[@]}"; do
  MATCHES=$(rg -in "${RG_FLAGS[@]}" "$term" "${SEARCH_PATHS[@]}" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "::error::Forbidden legacy term '$term' (case-insensitive) found"
    if [ "$VERBOSE" -eq 1 ]; then
      echo "$MATCHES"
    else
      echo "$MATCHES" | awk -F: '{print "  " $1 ":" $2}'
    fi
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      ALL_MATCHES_TSV+="${term}"$'\t'"${line}"$'\n'
    done <<< "$MATCHES"
    FOUND=1
  fi
done

# Emit JSON report if requested.
if [ -n "$JSON_OUT" ]; then
  TERMS_JOINED=$(IFS=,; echo "${FORBIDDEN_TERMS[*]}")
  PATHS_JOINED=$(IFS=,; echo "${SEARCH_PATHS[*]}")
  REPORT=$(
    IGNORED_TSV="$IGNORED_TSV" \
    MATCHES_TSV="$ALL_MATCHES_TSV" \
    TERMS="$TERMS_JOINED" \
    PATHS="$PATHS_JOINED" \
    FOUND="$FOUND" \
    python3 - <<'PY'
import json, os
from datetime import datetime, timezone

ignored = []
for raw in (os.environ.get("IGNORED_TSV") or "").splitlines():
    if not raw.strip(): continue
    parts = raw.split("\t")
    ignored.append({"path": parts[0], "rule": parts[1] if len(parts) > 1 else ""})

matches = []
for raw in (os.environ.get("MATCHES_TSV") or "").splitlines():
    if not raw.strip(): continue
    parts = raw.split("\t", 1)
    if len(parts) < 2: continue
    term, rest = parts
    bits = rest.split(":", 2)
    if len(bits) < 3: continue
    file_, lineno, content = bits
    try: lineno = int(lineno)
    except ValueError: pass
    matches.append({"term": term, "file": file_, "line": lineno, "content": content})

by_term = {}
for m in matches:
    by_term[m["term"]] = by_term.get(m["term"], 0) + 1

report = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "search_paths": [p for p in (os.environ.get("PATHS") or "").split(",") if p],
    "forbidden_terms": [t for t in (os.environ.get("TERMS") or "").split(",") if t],
    "exit_code": 1 if os.environ.get("FOUND") == "1" else 0,
    "summary": {
        "total_matches": len(matches),
        "matches_by_term": by_term,
        "ignored_count": len(ignored),
    },
    "ignored": ignored,
    "matches": matches,
}
print(json.dumps(report, indent=2, ensure_ascii=False))
PY
  )

  if [ "$JSON_OUT" = "-" ]; then
    echo "$REPORT"
  else
    echo "$REPORT" > "$JSON_OUT"
    echo "📝 JSON report written to: $JSON_OUT"
  fi
fi

if [ "$FOUND" -ne 0 ]; then
  exit 1
fi

echo "✅ No forbidden legacy terms found."
