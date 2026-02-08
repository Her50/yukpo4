#!/bin/bash
# Script pour exécuter les migrations directement depuis une tâche ECS
# Usage: Exécuter dans une tâche ECS avec accès à la base de données

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-yukpomnang}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SSM_DATABASE_URL_PATH="/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"

echo "=================================================================================="
echo "🔄 Exécution des migrations depuis ECS"
echo "=================================================================================="
echo ""

# Récupérer DATABASE_URL depuis SSM
echo "🔍 Récupération de DATABASE_URL depuis SSM: ${SSM_DATABASE_URL_PATH}"
DATABASE_URL=$(aws ssm get-parameter \
    --name "${SSM_DATABASE_URL_PATH}" \
    --region "${REGION}" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Impossible de récupérer DATABASE_URL depuis SSM"
    exit 1
fi

echo "✅ DATABASE_URL récupérée"
echo ""

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
cd /app/backend || cd backend || {
    echo "❌ Dossier backend introuvable"
    exit 1
}

# Vérifier l'état des migrations
echo "🔍 Vérification de l'état des migrations..."
sqlx migrate info
echo ""

# Exécuter les migrations
echo "🚀 Exécution des migrations..."
sqlx migrate run

echo ""
echo "=================================================================================="
echo "✅ Migrations exécutées avec succès"
echo "=================================================================================="








