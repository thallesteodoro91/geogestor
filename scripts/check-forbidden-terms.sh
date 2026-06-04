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
#   -s, --schema[=PATH]   Export the JSON Schema for the report. Default path:
#                         forbidden-terms-report.schema.json. Use "-" for stdout.
#       --validate        Validate the generated JSON report against the schema
#                         before returning the exit code (requires --json).
#                         Exits with code 3 if validation fails.
#   -h, --help            Show this help message
set -euo pipefail

# Stable report schema version — bump on breaking JSON changes.
REPORT_VERSION="1.0.0"
REPORT_SCHEMA="https://geogestor.lovable.app/schemas/forbidden-terms-report/v1"
SCHEMA_FILE="$(cd "$(dirname "$0")" && pwd)/forbidden-terms-report.schema.json"

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
SCHEMA_OUT=""
VALIDATE=0
SEARCH_PATHS=()

print_help() { sed -n '2,19p' "$0"; }

while [ $# -gt 0 ]; do
  case "$1" in
    -v|--verbose)      VERBOSE=1 ;;
    -i|--show-ignored) SHOW_IGNORED=1 ;;
    -j|--json)         JSON_OUT="forbidden-terms-report.json" ;;
    --json=*)          JSON_OUT="${1#--json=}" ;;
    -j=*)              JSON_OUT="${1#-j=}" ;;
    -s|--schema)       SCHEMA_OUT="forbidden-terms-report.schema.json" ;;
    --schema=*)        SCHEMA_OUT="${1#--schema=}" ;;
    -s=*)              SCHEMA_OUT="${1#-s=}" ;;
    --validate)        VALIDATE=1 ;;
    -h|--help)         print_help; exit 0 ;;
    --)                shift; SEARCH_PATHS+=("$@"); break ;;
    -*)                echo "Unknown option: $1" >&2; print_help; exit 2 ;;
    *)                 SEARCH_PATHS+=("$1") ;;
  esac
  shift
done
[ ${#SEARCH_PATHS[@]} -eq 0 ] && SEARCH_PATHS=(".")

# Handle --schema early so it works standalone (no scan required).
if [ -n "$SCHEMA_OUT" ]; then
  if [ ! -f "$SCHEMA_FILE" ]; then
    echo "Schema file not found: $SCHEMA_FILE" >&2
    exit 2
  fi
  if [ "$SCHEMA_OUT" = "-" ]; then
    cat "$SCHEMA_FILE"
  else
    cp "$SCHEMA_FILE" "$SCHEMA_OUT"
    echo "📐 JSON Schema written to: $SCHEMA_OUT"
  fi
fi

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
    REPORT_VERSION="$REPORT_VERSION" \
    REPORT_SCHEMA="$REPORT_SCHEMA" \
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
    "$schema": os.environ.get("REPORT_SCHEMA", ""),
    "report_version": os.environ.get("REPORT_VERSION", ""),
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

# Optional: validate the generated report against the JSON Schema.
if [ "$VALIDATE" -eq 1 ]; then
  if [ -z "$JSON_OUT" ]; then
    echo "❌ --validate requires --json (no report was generated)" >&2
    exit 2
  fi
  if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Schema file not found: $SCHEMA_FILE" >&2
    exit 2
  fi

  VALIDATION_INPUT=""
  if [ "$JSON_OUT" = "-" ]; then
    VALIDATION_INPUT="$REPORT"
  else
    VALIDATION_INPUT=$(cat "$JSON_OUT")
  fi

  VALIDATION_OUTPUT=$(
    REPORT_JSON="$VALIDATION_INPUT" \
    SCHEMA_PATH="$SCHEMA_FILE" \
    python3 - <<'PY' 2>&1
import json, os, sys

try:
    from jsonschema import Draft202012Validator
except ImportError:
    print("jsonschema package not installed (pip install jsonschema)", file=sys.stderr)
    sys.exit(2)

try:
    schema = json.load(open(os.environ["SCHEMA_PATH"]))
    report = json.loads(os.environ["REPORT_JSON"])
except Exception as e:
    print(f"validator error: {e}", file=sys.stderr)
    sys.exit(2)

validator = Draft202012Validator(schema)
errors = list(validator.iter_errors(report))

if not errors:
    print("ok")
    sys.exit(0)

# Build human-readable summary to stderr
lines = []
lines.append(f"Schema validation failed: {len(errors)} error(s) found in the report.")
lines.append("")
for idx, err in enumerate(errors, start=1):
    path = "/".join(str(p) for p in err.absolute_path) or "<root>"
    lines.append(f"  [{idx}] Field: {path}")
    lines.append(f"      Message: {err.message}")
    if err.validator is not None:
        lines.append(f"      Constraint: {err.validator}")
    if err.validator_value is not None:
        lines.append(f"      Expected:  {err.validator_value}")
    if err.instance is not None and not isinstance(err.instance, (dict, list)):
        lines.append(f"      Received:  {json.dumps(err.instance, ensure_ascii=False)}")
    lines.append("")

print("\n".join(lines), file=sys.stderr)
sys.exit(1)
PY
  )
  VALIDATION_STATUS=$?

  if [ "$VALIDATION_STATUS" -eq 0 ]; then
    echo "✅ JSON report is valid against schema v${REPORT_VERSION}."
  elif [ "$VALIDATION_STATUS" -eq 1 ]; then
    # Errors already printed to stderr by Python block above
    exit 3
  else
    echo "❌ Validator error:" >&2
    echo "$VALIDATION_OUTPUT" >&2
    exit 2
  fi
fi

if [ "$FOUND" -ne 0 ]; then
  exit 1
fi

echo "✅ No forbidden legacy terms found."
