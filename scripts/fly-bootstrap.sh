#!/usr/bin/env bash
# Bootstrap complet de la migration backend Yukpo : GCP → Fly.io
# Usage : ./scripts/fly-bootstrap.sh [--dry-run]
#
# Prérequis :
#   - flyctl installé + authentifié (fly auth login)
#   - gcloud authentifié sur le projet GCP source
#   - Les fichiers env_plain.txt et env_secrets.txt à la racine du repo
#   - PSQL client local pour le pg_restore final
#
# Étapes (séquentielles) :
#   1. Créer org Fly dédiée + app + Postgres + Redis
#   2. Importer les 113 env vars non-secrètes (depuis env_plain.txt)
#   3. Lister les 56 secrets à fournir manuellement (depuis Secret Manager GCP)
#   4. Dump Postgres GCP → restore Fly Postgres
#   5. Premier deploy + smoke test

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ORG="yukpo-mvp"          # nouvelle org Fly dédiée (free tier remis à zéro)
APP="yukpo-fly-backend"
PG_APP="yukpo-fly-postgres"
REDIS_APP="yukpo-fly-redis"
REGION="cdg"             # Paris

run() {
  if $DRY_RUN; then
    echo "[DRY-RUN] $*"
  else
    echo "▶ $*"
    eval "$@"
  fi
}

step() {
  echo
  echo "═══════════════════════════════════════════════════════════"
  echo "  $1"
  echo "═══════════════════════════════════════════════════════════"
}

# ─── 1. Org + apps Fly ────────────────────────────────────────────
step "1️⃣  Création org Fly + apps + Postgres + Redis"

run "flyctl orgs list | grep -q '$ORG' || flyctl orgs create '$ORG'"
run "flyctl apps list -o '$ORG' | grep -q '$APP' || flyctl apps create '$APP' -o '$ORG'"

# Postgres dédié (free tier : 1 GB shared-cpu-1x, 3 GB disk)
run "flyctl postgres create \
  --name '$PG_APP' \
  --org '$ORG' \
  --region '$REGION' \
  --vm-size shared-cpu-1x \
  --initial-cluster-size 1 \
  --volume-size 3 || echo 'Postgres déjà créé'"

# Attache la DB à l'app (génère DATABASE_URL automatiquement)
run "flyctl postgres attach '$PG_APP' --app '$APP'"

# Redis (Upstash via Fly, free tier : 100 MB, 1k cmd/sec)
run "flyctl redis create \
  --name '$REDIS_APP' \
  --org '$ORG' \
  --region '$REGION' \
  --plan free \
  --no-replicas || echo 'Redis déjà créé'"

# ─── 2. Import des env vars non-secrètes ──────────────────────────
step "2️⃣  Import des 113 env vars non-secrètes (depuis env_plain.txt)"

if [[ ! -f "$REPO_ROOT/env_plain.txt" ]]; then
  echo "❌ env_plain.txt introuvable à la racine"
  exit 1
fi

# Format attendu : KEY<TAB>VALUE par ligne
SECRETS_BATCH=""
while IFS=$'\t' read -r key value; do
  [[ -z "$key" || "$key" == "#"* ]] && continue
  # Skip les vars qu'on override explicitement dans fly.toml
  case "$key" in
    PORT|HOST|RUST_LOG|APP_ENV|CLOUD_RUN|GPU_ENABLED|YUKPO_*|DB_POOL_*|ENABLE_AUTO_MIGRATIONS) continue ;;
  esac
  # Échappement basique des valeurs
  SECRETS_BATCH+="$key='$value' "
done < "$REPO_ROOT/env_plain.txt"

run "flyctl secrets set --app '$APP' --stage $SECRETS_BATCH"

# ─── 3. Liste des 56 secrets à fournir manuellement ───────────────
step "3️⃣  Secrets à fournir manuellement"

cat <<EOF

⚠️  Les 56 secrets sensibles ne sont pas dans env_plain.txt (par sécurité).
Tu dois les fournir au choix :

  OPTION A — Si billing GCP réactivé temporairement :
    ./scripts/fly-import-gcp-secrets.sh

  OPTION B — Manuellement depuis console GCP Secret Manager :
    https://console.cloud.google.com/security/secret-manager?project=yukpo-project
    Pour chaque secret listé dans env_secrets.txt, copier la valeur puis :
      flyctl secrets set --app $APP NOM=valeur

  OPTION C — Régénérer ceux qui peuvent l'être :
    JWT_SECRET → openssl rand -base64 64
    AWS S3 keys → garder identiques (mêmes buckets)
    OPENAI_API_KEY etc. → garder identiques (même provider)

Liste des 56 secrets (cf. env_secrets.txt) :
EOF
cut -f1 "$REPO_ROOT/env_secrets.txt" | head -56

echo
read -rp "✅  Une fois les secrets posés, presse [Entrée] pour continuer le dump DB…"

# ─── 4. Dump Postgres GCP → Fly ───────────────────────────────────
step "4️⃣  Dump Postgres GCP → Fly Postgres"

DUMP_FILE="/tmp/yukpo-gcp-dump-$(date +%s).sql"

# 4a. Export depuis Cloud SQL (nécessite billing actif)
echo "📤 Export Cloud SQL → bucket GCS…"
run "gcloud sql export sql yukpo-postgres gs://yukpo-backups/migration-fly.sql \
  --database=yukpo_db || echo 'Export échoué — billing GCP désactivé ?'"

# 4b. Téléchargement local
echo "⬇️  Téléchargement local…"
run "gsutil cp gs://yukpo-backups/migration-fly.sql '$DUMP_FILE'"

# 4c. Connexion Fly Postgres + restore
echo "📥 Restore vers Fly Postgres…"
PG_URI=$(flyctl postgres connect --app "$PG_APP" --uri 2>/dev/null || echo "")
if [[ -z "$PG_URI" ]]; then
  echo "⚠️  Récupère manuellement la URI : flyctl postgres connect --app $PG_APP"
  exit 1
fi

run "psql '$PG_URI' < '$DUMP_FILE'"

# ─── 5. Premier deploy ────────────────────────────────────────────
step "5️⃣  Premier deploy backend Fly"

run "cd '$REPO_ROOT/backend' && flyctl deploy --app '$APP' --remote-only --wait-timeout 300"

# Smoke test
echo
echo "🔍 Smoke test health endpoint…"
sleep 10
HEALTH_URL="https://${APP}.fly.dev/health"
if curl -sf "$HEALTH_URL"; then
  echo "✅ Backend Fly opérationnel !"
  echo
  echo "🌐 URL backend : https://${APP}.fly.dev"
  echo
  echo "▶ Étape suivante : modifier les VITE_API_BASE_URL dans Netlify pour les 3 sites"
  echo "  pharmacie / restaurant / bourse → pointer sur https://${APP}.fly.dev"
else
  echo "❌ Health check échoué — voir les logs : flyctl logs --app $APP"
fi
