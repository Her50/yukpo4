#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

ENV_FILE="${REPO_ROOT}/.env.livekit"
PAYLOAD_TEMPLATE="${SCRIPT_DIR}/create_ingress.json"
OUTPUT_JSON="${SCRIPT_DIR}/create_ingress_response.json"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

LIVEKIT_HTTP="${LIVEKIT_HTTP:-http://127.0.0.1:7880}"
LIVEKIT_WS="${LIVEKIT_WS:-ws://127.0.0.1:7880}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:?LIVEKIT_API_KEY is required}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET is required}"
LIVEKIT_INGRESS_NAME="${LIVEKIT_INGRESS_NAME:-ops-ingress}"
LIVEKIT_INGRESS_ROOM="${LIVEKIT_INGRESS_ROOM:-ops-room}"

if ! command -v jq >/dev/null; then
  echo "jq is required (sudo apt install jq)" >&2
  exit 1
fi

if ! command -v envsubst >/dev/null; then
  echo "envsubst is required (sudo apt install gettext-base)" >&2
  exit 1
fi

TOKEN="$("${REPO_ROOT}/scripts/livekit_jwt.py" \
  --api-key "${LIVEKIT_API_KEY}" \
  --api-secret "${LIVEKIT_API_SECRET}" \
  --identity "ingress-cli" \
  --ttl 120)"

TMP_PAYLOAD="$(mktemp)"
trap 'rm -f "${TMP_PAYLOAD}"' EXIT

envsubst < "${PAYLOAD_TEMPLATE}" > "${TMP_PAYLOAD}"

curl -sS "${LIVEKIT_HTTP}/twirp/livekit.Ingress/CreateIngress" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @"${TMP_PAYLOAD}" \
  | tee "${OUTPUT_JSON}" \
  | jq .

echo
echo "Ingress response saved to ${OUTPUT_JSON}"

