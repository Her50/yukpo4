#!/bin/bash
# Script pour vérifier l'état des migrations depuis ECS
# Usage: Exécuter dans une tâche ECS avec accès à la base de données

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-yukpomnang}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SSM_DATABASE_URL_PATH="/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"

echo "=================================================================================="
echo "🔍 Vérification de l'état des migrations"
echo "=================================================================================="
echo ""

# Récupérer DATABASE_URL depuis SSM ou utiliser la variable d'environnement
if [ -z "${DATABASE_URL:-}" ]; then
    echo "🔍 Récupération de DATABASE_URL depuis SSM: ${SSM_DATABASE_URL_PATH}"
    DATABASE_URL=$(aws ssm get-parameter \
        --name "${SSM_DATABASE_URL_PATH}" \
        --region "${REGION}" \
        --with-decryption \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ Impossible de récupérer DATABASE_URL depuis SSM"
        exit 1
    fi
else
    echo "✅ DATABASE_URL trouvée dans l'environnement"
fi

export DATABASE_URL

# Vérifier si sqlx-cli est disponible
if ! command -v sqlx &> /dev/null; then
    echo "❌ sqlx-cli non trouvé"
    exit 1
fi

echo "✅ sqlx-cli disponible: $(sqlx --version)"
echo ""

# Aller dans le dossier backend
BACKEND_DIR="/app/backend"
if [ ! -d "$BACKEND_DIR" ]; then
    BACKEND_DIR="backend"
fi

cd "$BACKEND_DIR" 2>/dev/null || {
    echo "❌ Dossier backend introuvable"
    exit 1
}

# Vérifier l'état des migrations
echo "🔍 État des migrations SQLx:"
sqlx migrate info

echo ""
echo "🔍 Vérification des tables manquantes:"
echo ""

# Liste des tables à vérifier
TABLES=(
    "product_creation_queue"
    "deliveries"
    "delivery_matching_queue"
    "delivery_proximity_suggestions"
    "product_orders"
    "global_promo_events"
    "live_flash_sales"
    "social_publication_jobs"
    "video_generation_jobs"
)

# Vérifier chaque table
MISSING_COUNT=0
for table in "${TABLES[@]}"; do
    if psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table')" 2>/dev/null | grep -q t; then
        echo "  ✅ $table"
    else
        echo "  ❌ $table - MANQUANTE"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

echo ""
if [ $MISSING_COUNT -eq 0 ]; then
    echo "✅ Toutes les tables existent!"
else
    echo "⚠️ $MISSING_COUNT table(s) manquante(s)"
    echo ""
    echo "Pour créer les tables manquantes:"
    echo "  1. Exécuter les migrations SQLx: sqlx migrate run"
    echo "  2. Vérifier que ENABLE_AUTO_MIGRATIONS=true dans Secrets Manager"
    echo "  3. Redémarrer l'application ECS pour exécuter les migrations automatiques"
fi

echo ""
echo "=================================================================================="




