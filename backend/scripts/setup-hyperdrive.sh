#!/usr/bin/env bash
# setup-hyperdrive.sh — Configure Cloudflare Hyperdrive devant Postgres pour Bourse du Livre
#
# Pourquoi : Fly Postgres single-node plafonne à ~95 connexions client.
# Avec 25 VM × DB_POOL_SIZE=60 = 1500 connexions demandées → DB sature.
#
# Hyperdrive = pool de connexions PostgreSQL géré par Cloudflare, déployé en edge :
#   - Multiplexe N connexions client (côté backend) sur M connexions DB (~30-50)
#   - Cache de requêtes optionnel (réduit la charge DB en lecture)
#   - Latence réduite : edge proche du backend Fly
#   - Pas d'AWS, 100% Cloudflare + Fly
#
# Pré-requis :
#   - Fly app `yukpo-fly-backend` déployée
#   - Compte Cloudflare avec MCP `mcp__claude_ai_Cloudflare_Developer_Platform`
#     OU `wrangler` CLI installé (npm i -g wrangler)
#   - DATABASE_URL actuelle accessible publiquement (sslmode=require)

set -euo pipefail

APP_NAME="${APP_NAME:-yukpo-fly-backend}"
HYPERDRIVE_NAME="${HYPERDRIVE_NAME:-yukpo-bourse-pg}"

echo "=== 1. Récupération de DATABASE_URL depuis Fly secrets ==="
DB_URL=$(fly secrets list -a "$APP_NAME" --json | jq -r '.[] | select(.name=="DATABASE_URL") | .value' 2>/dev/null || echo "")
if [ -z "$DB_URL" ]; then
  echo "❌ DATABASE_URL non trouvée dans Fly secrets. Exporter manuellement :"
  echo "   export DB_URL='postgres://user:pass@host:5432/db?sslmode=require'"
  : "${DB_URL:?DB_URL requis}"
fi

echo "=== 2. Création du Hyperdrive Cloudflare ==="
echo "   Name: $HYPERDRIVE_NAME"
echo "   Origin: ${DB_URL%%@*}@****"
echo
echo "   Via wrangler (à exécuter manuellement avec ton compte Cloudflare) :"
echo
cat <<EOF
wrangler hyperdrive create $HYPERDRIVE_NAME \\
  --connection-string="$DB_URL" \\
  --max-age=60 \\
  --swr=60 \\
  --caching-disabled=false
EOF
echo
echo "   Ou via le MCP Cloudflare (dans Claude Code) :"
echo "   - mcp__claude_ai_Cloudflare_Developer_Platform__hyperdrive_config_edit"
echo
echo "=== 3. Une fois le Hyperdrive créé, récupérer le connection string Hyperdrive ==="
echo "   wrangler hyperdrive list  → copier le 'connection_string'"
echo "   Format: postgres://USER:PASS@HYPERDRIVE_HOST:PORT/db?sslmode=require"
echo
echo "=== 4. Mettre à jour Fly secret DATABASE_URL ==="
cat <<'EOF'
fly secrets set DATABASE_URL="$HYPERDRIVE_CONNECTION_STRING" -a yukpo-fly-backend
EOF
echo
echo "=== 5. Conserver l'URL directe pour les opérations longues (background jobs) ==="
echo "   Hyperdrive a un timeout de query. Pour REFRESH MATERIALIZED VIEW, etc.,"
echo "   garder une connexion directe via DATABASE_URL_LONG_OPS :"
cat <<'EOF'
fly secrets set DATABASE_URL_LONG_OPS="$DIRECT_DB_URL" -a yukpo-fly-backend
EOF
echo
echo "=== 6. Vérification post-déploiement ==="
echo "   fly logs -a $APP_NAME | grep 'Connexion PostgreSQL'"
echo "   Tu dois voir : '✅ Connexion PostgreSQL établie (pool: max=60, ...)'"
echo
echo "=== ALTERNATIVE — Sans Hyperdrive : Fly Managed Postgres + pgBouncer ==="
cat <<'EOF'
# Si tu préfères tout en interne Fly (sans Cloudflare) :
fly postgres create --name yukpo-pg-prod \
  --region cdg \
  --vm-size shared-cpu-2x \
  --volume-size 20

# Puis activer pgBouncer (déjà inclus dans Fly Postgres) :
# Connection string : postgres://USER:PASS@yukpo-pg-prod.flycast:5432/db
# Pour pooler : postgres://USER:PASS@yukpo-pg-prod.flycast:5432/db?application_name=yukpo&prefer_simple_protocol=true
EOF
