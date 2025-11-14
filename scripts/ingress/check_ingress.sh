#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

ENV_FILE="${REPO_ROOT}/.env.livekit"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

LIVEKIT_HOST="${LIVEKIT_HOST:?LIVEKIT_HOST is required}"

ssh "root@${LIVEKIT_HOST}" <<'EOF'
set -euo pipefail
echo "=== docker ps (livekit stack) ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep livekit
echo
echo "=== livekit-ingress health ==="
docker logs --tail=20 livekit-ingress
echo
echo "=== livekit-redis info ==="
docker logs --tail=20 livekit-redis || true
EOF

