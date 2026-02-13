#!/bin/bash
# Script pour créer la base de données 'yukpo' via AWS CloudShell
# Usage: Copiez-collez ce script dans CloudShell

set -e

echo "🚀 Création de la base de données 'yukpo' sur AWS RDS..."
echo "=========================================="
echo ""

# Configuration
RDS_ENDPOINT="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
RDS_USERNAME="yukpo_admin"
RDS_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
DATABASE_NAME="yukpo"

# Installer PostgreSQL client si nécessaire
if ! command -v psql &> /dev/null; then
    echo "📦 Installation de PostgreSQL client..."
    sudo yum install postgresql15 -y
fi

# Définir le mot de passe
export PGPASSWORD="$RDS_PASSWORD"

# Construire l'URL de connexion
ADMIN_DB_URL="postgresql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/postgres"

echo "📊 Informations de connexion:"
echo "   Host: $RDS_ENDPOINT"
echo "   Port: 5432"
echo "   User: $RDS_USERNAME"
echo "   Database à créer: $DATABASE_NAME"
echo ""

# Vérifier la connectivité
echo "🔍 Vérification de la connectivité..."
if psql -h "$RDS_ENDPOINT" -U "$RDS_USERNAME" -d postgres -c "SELECT version();" >/dev/null 2>&1; then
    echo "✅ Connexion réussie"
else
    echo "❌ ERREUR: Impossible de se connecter à la base de données"
    echo "   Vérifiez que l'instance RDS est accessible depuis CloudShell"
    exit 1
fi

# Vérifier si la base existe déjà
echo "🔍 Vérification de l'existence de la base '$DATABASE_NAME'..."
DB_EXISTS=$(psql -h "$RDS_ENDPOINT" -U "$RDS_USERNAME" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DATABASE_NAME}'" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo "✅ La base '$DATABASE_NAME' existe déjà"
    echo "   Aucune action nécessaire"
    exit 0
fi

# Créer la base de données
echo "🛠️  Création de la base '$DATABASE_NAME'..."
if psql -h "$RDS_ENDPOINT" -U "$RDS_USERNAME" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DATABASE_NAME}\";" 2>&1; then
    echo "✅ Base '$DATABASE_NAME' créée avec succès"
else
    echo "❌ ERREUR: Impossible de créer la base '$DATABASE_NAME'"
    echo "   L'utilisateur '$RDS_USERNAME' n'a peut-être pas les permissions nécessaires"
    echo "   Note: Sur AWS RDS, seul le superuser peut créer des bases de données"
    exit 1
fi

# Vérifier que la base a bien été créée
echo "🔍 Vérification finale..."
DB_EXISTS_AFTER=$(psql -h "$RDS_ENDPOINT" -U "$RDS_USERNAME" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DATABASE_NAME}'" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [ "$DB_EXISTS_AFTER" = "1" ]; then
    echo "✅ Base '$DATABASE_NAME' vérifiée et prête à l'emploi"
    echo ""
    echo "📝 Prochaines étapes:"
    echo "   1. Vérifiez que DATABASE_URL dans AWS Secrets Manager pointe vers la base '$DATABASE_NAME'"
    echo "   2. Redémarrez le backend ECS pour appliquer les migrations"
    echo "   3. Les migrations s'appliqueront automatiquement si ENABLE_AUTO_MIGRATIONS=true"
    echo ""
    echo "   Format DATABASE_URL attendu:"
    echo "   postgresql://${RDS_USERNAME}:<password>@${RDS_ENDPOINT}:5432/${DATABASE_NAME}"
else
    echo "⚠️  WARNING: La base semble avoir été créée mais la vérification a échoué"
    echo "   Vérifiez manuellement avec: psql -h $RDS_ENDPOINT -U $RDS_USERNAME -d postgres -c '\l'"
fi

