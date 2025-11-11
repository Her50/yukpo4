#!/bin/sh
set -euo pipefail

JOB_FILE="${JOB_FILE:-/app/samples/sample-job.json}"
OUTPUT_DIR="${OUTPUT_DIR:-/app/renders/out}"
EXTRA_ARGS="${RENDER_ARGS:-}"

if [ ! -f "$JOB_FILE" ]; then
  echo "[video-renderer] ❌ Job file introuvable: $JOB_FILE" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "[video-renderer] 🚀 Lancement rendu"
echo "  • Job:      $JOB_FILE"
echo "  • Output:   $OUTPUT_DIR"
echo "  • Args:     ${EXTRA_ARGS} $*"

exec node dist/src/cli/render-worker.js \
  --job "$JOB_FILE" \
  --out-dir "$OUTPUT_DIR" \
  $EXTRA_ARGS \
  "$@"

