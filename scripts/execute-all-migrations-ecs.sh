#!/bin/bash
# Script pour exécuter TOUTES les migrations SQLx depuis une tâche ECS
# Ce script doit être exécuté dans une tâche ECS avec accès à la base de données
# Usage: Copier ce script dans le conteneur ECS et l'exécuter

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-yukpomnang}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SSM_DATABASE_URL_PATH="/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"

echo "=================================================================================="
echo "🔄 Exécution de TOUTES les migrations SQLx depuis ECS"
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
        echo "⚠️ Vérifiez que DATABASE_URL est définie dans l'environnement"
        exit 1
    fi
else
    echo "✅ DATABASE_URL trouvée dans l'environnement"
fi

# Exporter DATABASE_URL pour sqlx-cli
export DATABASE_URL

# Vérifier si sqlx-cli est disponible
if ! command -v sqlx &> /dev/null; then
    echo "❌ sqlx-cli non trouvé. Installation..."
    cargo install sqlx-cli --version 0.8.6 --locked --no-default-features --features postgres
fi

echo "✅ sqlx-cli disponible: $(sqlx --version)"
echo ""

# Aller dans le dossier backend
BACKEND_DIR="/app/backend"
if [ ! -d "$BACKEND_DIR" ]; then
    BACKEND_DIR="backend"
fi

if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Dossier backend introuvable (cherché dans /app/backend et ./backend)"
    exit 1
fi

cd "$BACKEND_DIR"
echo "📁 Dossier migrations: $(pwd)/migrations"
echo "📊 Nombre de fichiers de migration: $(find migrations -name '*.sql' | wc -l)"
echo ""

# Vérifier l'état des migrations
echo "🔍 Vérification de l'état des migrations..."
echo "ℹ️ SQLx vérifie la table _sqlx_migrations pour éviter les doublons"
sqlx migrate info || {
    echo "⚠️ Erreur lors de la vérification (peut être normal si la table n'existe pas encore)"
}
echo ""

# Exécuter les migrations SQLx standard
echo "🚀 Exécution des migrations SQLx standard..."
echo "ℹ️ SQLx est idempotent : les migrations déjà appliquées seront ignorées"
sqlx migrate run

echo ""
echo "=================================================================================="
echo "✅ Migrations SQLx standard exécutées avec succès"
echo "=================================================================================="
echo ""
echo "📝 Note: Les migrations automatiques (auto_migrate.rs) seront exécutées"
echo "   au prochain redémarrage de l'application si ENABLE_AUTO_MIGRATIONS=true"
echo ""


