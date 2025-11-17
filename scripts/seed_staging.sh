#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

DATABASE_URL="${STAGING_DATABASE_URL:-${DATABASE_URL:-}}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[seed-staging] ❌ Variable STAGING_DATABASE_URL manquante."
  echo "Définissez STAGING_DATABASE_URL ou passez DATABASE_URL en argument."
  exit 1
fi

echo "[seed-staging] ▶️ Déploiement des seeds QA sur ${DATABASE_URL%%\?*}"

SEED_FILES=(
  "backend/scripts/seed_delivery_staging.sql"
)

for file in "${SEED_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[seed-staging] ⚠️ Fichier introuvable : $file"
    continue
  fi

  echo "[seed-staging] → Exécution de $file"
  PGPASSWORD="${PGPASSWORD:-${DATABASE_PASSWORD:-}}" psql "$DATABASE_URL" -f "$file"
done

echo "[seed-staging] ✅ Seeds appliqués avec succès."

