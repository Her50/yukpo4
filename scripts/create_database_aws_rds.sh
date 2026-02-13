#!/bin/bash

# 🔧 Script pour créer la base de données 'yukpo' sur AWS RDS
# Usage: ./create_database_aws_rds.sh

set -e

echo "🔧 Création de la base de données 'yukpo' sur AWS RDS..."
echo "=========================================="

# Vérifier que psql est installé
if ! command -v psql &> /dev/null; then
    echo "❌ ERREUR: psql n'est pas installé"
    echo "   Installez-le avec: sudo yum install postgresql15 -y"
    exit 1
fi

# Récupérer DATABASE_URL depuis les variables d'environnement ou les arguments
if [ -z "$DATABASE_URL" ]; then
    if [ -z "$1" ]; then
        echo "❌ ERREUR: DATABASE_URL non définie"
        echo "   Usage: DATABASE_URL='postgresql://user:pass@host:5432/postgres' $0"
        echo "   OU: $0 'postgresql://user:pass@host:5432/postgres'"
        exit 1
    else
        DATABASE_URL="$1"
    fi
fi

# Extraire les composants de DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_NAME="yukpo"

# Construire l'URL pour la base 'postgres' (base par défaut)
ADMIN_DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/postgres"

echo "📊 Informations de connexion:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   User: $DB_USER"
echo "   Database à créer: $DB_NAME"
echo ""

# Vérifier la connectivité
echo "🔍 Vérification de la connectivité..."
if ! PGPASSWORD="$DB_PASS" psql "$ADMIN_DB_URL" -c "SELECT version();" >/dev/null 2>&1; then
    echo "❌ ERREUR: Impossible de se connecter à la base de données"
    echo "   Vérifiez vos identifiants et que l'instance RDS est accessible"
    exit 1
fi
echo "✅ Connexion réussie"

# Vérifier si la base existe déjà
echo "🔍 Vérification de l'existence de la base '$DB_NAME'..."
DB_EXISTS=$(PGPASSWORD="$DB_PASS" psql "$ADMIN_DB_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo "✅ La base '$DB_NAME' existe déjà"
    echo "   Aucune action nécessaire"
    exit 0
fi

# Créer la base de données
echo "🛠️  Création de la base '$DB_NAME'..."
if PGPASSWORD="$DB_PASS" psql "$ADMIN_DB_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\";" 2>&1; then
    echo "✅ Base '$DB_NAME' créée avec succès"
else
    echo "❌ ERREUR: Impossible de créer la base '$DB_NAME'"
    echo "   Vérifiez que l'utilisateur '$DB_USER' a les permissions nécessaires"
    echo "   Note: Sur AWS RDS, seul le superuser peut créer des bases de données"
    echo "   Solution: Utilisez l'utilisateur master ou créez la base via AWS Console"
    exit 1
fi

# Vérifier que la base a bien été créée
echo "🔍 Vérification finale..."
if PGPASSWORD="$DB_PASS" psql "$ADMIN_DB_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q "1"; then
    echo "✅ Base '$DB_NAME' vérifiée et prête à l'emploi"
    echo ""
    echo "📝 Prochaines étapes:"
    echo "   1. Vérifiez que DATABASE_URL pointe vers la base 'yukpo'"
    echo "   2. Redémarrez le backend pour appliquer les migrations"
    echo "   3. Les migrations s'appliqueront automatiquement si ENABLE_AUTO_MIGRATIONS=true"
else
    echo "⚠️  WARNING: La base semble avoir été créée mais la vérification a échoué"
    echo "   Vérifiez manuellement avec: psql \"$ADMIN_DB_URL\" -c \"\\l\""
fi

