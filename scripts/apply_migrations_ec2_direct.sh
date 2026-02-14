#!/bin/bash
# Script bash simple pour appliquer les migrations via EC2
# À exécuter directement sur l'instance EC2

set -e

REGION="eu-west-1"
SECRET_ID="yukpo/backend/secrets"

echo "========================================"
echo "  APPLICATION MIGRATIONS VIA EC2"
echo "========================================"
echo ""

# Récupérer DATABASE_URL depuis Secrets Manager
echo "1. Récupération de DATABASE_URL depuis Secrets Manager..."
DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$REGION" --query 'SecretString' --output text | jq -r '.DATABASE_URL')

if [ -z "$DATABASE_URL" ]; then
    echo "ERREUR: Impossible de récupérer DATABASE_URL"
    exit 1
fi

echo "OK: DATABASE_URL récupérée"
echo ""

# Créer merchant_storage_locations
echo "2. Création de merchant_storage_locations..."
psql "$DATABASE_URL" -f scripts/fix_merchant_storage_locations.sql || echo "ATTENTION: Erreur (peut-être existe déjà)"
echo ""

# Installer sqlx si nécessaire
echo "3. Vérification de sqlx..."
if ! command -v sqlx &> /dev/null; then
    echo "Installation de sqlx-cli..."
    if command -v cargo &> /dev/null; then
        cargo install sqlx-cli --no-default-features --features postgres
    else
        echo "ERREUR: cargo non disponible"
        exit 1
    fi
fi
echo "OK: sqlx disponible"
echo ""

# Cloner ou mettre à jour le repo
echo "4. Préparation du repo..."
if [ ! -d "/tmp/yukpomnang2" ]; then
    cd /tmp
    git clone https://github.com/Her50/yukpo4.git yukpomnang2 || echo "ATTENTION: Erreur clonage"
else
    cd /tmp/yukpomnang2
    git pull || echo "ATTENTION: Erreur pull"
fi
echo ""

# Appliquer les migrations
echo "5. Application des migrations SQLx..."
cd /tmp/yukpomnang2/backend
export DATABASE_URL="$DATABASE_URL"
sqlx migrate run

if [ $? -eq 0 ]; then
    echo "OK: Migrations appliquées avec succès!"
else
    echo "ERREUR: Échec de l'application des migrations"
    exit 1
fi
echo ""

# Vérification finale
echo "6. Vérification finale..."
TABLES_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
" | tr -d ' ')

echo "Nombre de tables créées: $TABLES_COUNT"
echo ""

echo "========================================"
echo "  APPLICATION TERMINÉE"
echo "========================================"

