#!/bin/sh
set -euo pipefail

if [ "${RENDER_SERVER:-0}" = "1" ]; then
  PORT="${PORT:-8080}"
  echo "[video-renderer] 🚀 Lancement du serveur RPC (port=${PORT})"
  exec node dist/src/server.js "$@"
else
  JOB_FILE="${JOB_FILE:-/app/samples/sample-job.json}"
  OUTPUT_DIR="${OUTPUT_DIR:-/app/renders/out}"
  EXTRA_ARGS="${RENDER_ARGS:-}"

  if [ ! -f "$JOB_FILE" ]; then
    echo "[video-renderer] ❌ Job file introuvable: $JOB_FILE" >&2
    exit 1
  }

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
fi




