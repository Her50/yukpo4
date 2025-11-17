#!/usr/bin/env bash
# Simple health-check helper for Yukpo LiveKit/SRS stack
# Usage:
#   LIVEKIT_SSH_HOST=root@46.224.14.85 scripts/livekit-health-check.sh

set -euo pipefail

LIVEKIT_HEALTH_URL="${LIVEKIT_HEALTH_URL:-https://livekit.46.224.14.85.sslip.io/}"
LIVEKIT_COMPOSE_BIN="${LIVEKIT_COMPOSE_BIN:-/usr/local/bin/docker-compose}"
SSH_HOST="${LIVEKIT_SSH_HOST:-}"

echo "🔍 Vérification santé LiveKit (${LIVEKIT_HEALTH_URL})"

http_code="$(curl -sS -o /dev/null -w "%{http_code}" "${LIVEKIT_HEALTH_URL}")"
if [[ "${http_code}" == "200" ]] || [[ "${http_code}" == "204" ]]; then
  echo "✅ LiveKit répond (HTTP ${http_code})"
else
  echo "❌ LiveKit ne répond pas correctement (HTTP ${http_code})"
  exit 1
fi

if [[ -z "${SSH_HOST}" ]]; then
  cat <<'EOF'
ℹ️  Définissez LIVEKIT_SSH_HOST pour vérifier l'état des conteneurs :
    LIVEKIT_SSH_HOST=root@46.224.14.85 scripts/livekit-health-check.sh
EOF
  exit 0
fi

echo
echo "🔍 Vérification des conteneurs via ${SSH_HOST}"
ssh -o BatchMode=yes "${SSH_HOST}" "${LIVEKIT_COMPOSE_BIN} ps" || {
  echo "❌ Impossible de vérifier les conteneurs via SSH"
  exit 1
}

echo
echo "✅ Vérifications terminées."







