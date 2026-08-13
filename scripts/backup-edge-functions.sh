#!/usr/bin/env bash
# =============================================================================
# backup-edge-functions.sh
# Backup all DEPLOYED Supabase Edge Functions from a project into a local folder.
#
# WHY YOU NEED THIS:
#   Edge function code is NOT stored in your database — it lives in Supabase's
#   internal deployment storage. A `pg_dump` of your database never includes it.
#   This script downloads the actual source of every deployed function so you
#   can keep it as a backup or redeploy it elsewhere (e.g. your new project).
#
# REQUIREMENTS
#   - supabase CLI installed  (https://supabase.com/docs/guides/cli)
#   - A Supabase personal access token:
#       Dashboard → Account Settings → Access Tokens → Generate new token
#
# USAGE
#   SUPABASE_ACCESS_TOKEN=... bash scripts/backup-edge-functions.sh \
#       --project-ref rlqaiflvdaldrxgyugwb
#
#   Options:
#     --project-ref <ref>   Project ref (required). It's the <ref> in your
#                           project URL: https://<ref>.supabase.co
#     --token <pat>         Personal access token (optional — otherwise read
#                           from the SUPABASE_ACCESS_TOKEN env var).
#     --out <dir>           Backup destination. Default:
#                           backups/edge-functions/<ref>-<YYYY-MM-DD>
#     --dry-run             List what would be downloaded, download nothing.
#     --help                Show this help.
#
# OUTPUT
#   <out>/supabase/functions/<slug>/index.ts   downloaded source of each function
#   <out>/manifest.json                        function metadata (slugs, versions…)
#
# REDEPLOYING TO A NEW PROJECT LATER
#   supabase functions deploy <slug> --project-ref <new-ref> --use-api
# =============================================================================
set -euo pipefail

# ── defaults ─────────────────────────────────────────────────────────────────
PROJECT_REF=""
TOKEN=""
OUT_DIR=""
DRY_RUN=0

# ── arg parsing ──────────────────────────────────────────────────────────────
show_help() {
  sed -n '2,31p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-ref) PROJECT_REF="${2:-}"; shift 2 ;;
    --token)       TOKEN="${2:-}"; shift 2 ;;
    --out)         OUT_DIR="${2:-}"; shift 2 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    --help|-h)     show_help ;;
    *) echo "Unknown argument: $1" >&2; show_help >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_REF" ]]; then
  echo "Error: --project-ref is required (e.g. --project-ref rlqaiflvdaldrxgyugwb)" >&2
  show_help >&2
  exit 1
fi

if [[ ! "$PROJECT_REF" =~ ^[a-z0-9]{20}$ ]]; then
  echo "Error: '$PROJECT_REF' doesn't look like a Supabase project ref (expects 20 lowercase alphanumeric chars)." >&2
  exit 1
fi

# ── tooling + auth ───────────────────────────────────────────────────────────
if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found. Install it: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

TOKEN="${TOKEN:-${SUPABASE_ACCESS_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "Error: no access token. Set SUPABASE_ACCESS_TOKEN or pass --token." >&2
  echo "       Get one at Dashboard → Account Settings → Access Tokens" >&2
  exit 1
fi
export SUPABASE_ACCESS_TOKEN="$TOKEN"

# ── list deployed functions ──────────────────────────────────────────────────
echo "Listing functions in project '$PROJECT_REF' …"
LIST_JSON="$(supabase functions list --project-ref "$PROJECT_REF" --output-format json 2>&1)"

# Parse JSON (handles both a plain JSON array and stream-json / NDJSON output).
SLUGS="$(printf '%s' "$LIST_JSON" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d));
  process.stdin.on("end", () => {
    const seen = new Set();
    const out = (o) => { if (o && typeof o.slug === "string" && !seen.has(o.slug)) { seen.add(o.slug); console.log(o.slug); } };
    for (const line of s.trim().split(/\n/).filter(Boolean)) {
      try { const v = JSON.parse(line); if (Array.isArray(v)) v.forEach(out); else out(v); } catch { /* skip */ }
    }
  });
')"

if [[ -z "$SLUGS" ]]; then
  echo "No deployed edge functions found for project '$PROJECT_REF'."
  echo "(If you expected some, double-check the project ref and that the functions"
  echo " were actually deployed with: supabase functions deploy <slug>)"
  exit 0
fi

echo "Found function(s):"
printf '  - %s\n' $SLUGS

# ── destination ──────────────────────────────────────────────────────────────
if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="backups/edge-functions/${PROJECT_REF}-$(date +%Y-%m-%d)"
fi
mkdir -p "$OUT_DIR/supabase/functions"

# Minimal config so the CLI treats the backup dir as a Supabase project.
cat > "$OUT_DIR/supabase/config.toml" <<EOF
project_id = "${PROJECT_REF}-backup"
EOF

# Save metadata for provenance.
printf '%s\n' "$LIST_JSON" > "$OUT_DIR/manifest.json"

# ── download ─────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run — nothing downloaded. Manifest saved to $OUT_DIR/manifest.json"
  exit 0
fi

FAILED=0
for slug in $SLUGS; do
  echo "Downloading '$slug' …"
  if ! supabase functions download "$slug" \
      --project-ref "$PROJECT_REF" --use-api --workdir "$OUT_DIR"; then
    echo "  ✗ failed to download '$slug'" >&2
    FAILED=$((FAILED + 1))
  fi
done

echo
echo "Backup complete → $OUT_DIR"
if [[ "$FAILED" -gt 0 ]]; then
  echo "  $FAILED function(s) failed — re-run the script to retry them."
  exit 1
fi
echo
echo "To redeploy to a new project:"
for slug in $SLUGS; do
  echo "  supabase functions deploy $slug --project-ref <new-ref> --use-api"
done
