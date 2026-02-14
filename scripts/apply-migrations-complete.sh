#!/bin/bash
# Script pour corriger et appliquer toutes les migrations

set -e

REGION="eu-west-1"
SECRET_ID="yukpo/backend/secrets"
DB_INSTANCE="yukpo-db"

echo "========================================"
echo "  CORRECTION ET APPLICATION MIGRATIONS"
echo "========================================"
echo ""

# Récupérer DATABASE_URL depuis Secrets Manager
echo "🔐 Récupération des credentials..."
DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$REGION" --query 'SecretString' --output text | jq -r '.DATABASE_URL')

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: Impossible de récupérer DATABASE_URL"
    exit 1
fi

# Extraire les informations de connexion
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's#.*/\([^/?]*\).*#\1#p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's#.*://\([^:]*\):.*#\1#p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's#.*://[^:]*:\([^@]*\)@.*#\1#p')

echo "📊 Base de données: $DB_NAME sur $DB_HOST"
echo ""

# Vérifier que c'est la bonne base (yukpo-db du nouveau compte)
if [[ "$DB_HOST" == *"yukpo-db"* ]] || [[ "$DB_HOST" == *"cp4oq80ogckg"* ]]; then
    echo "✅ Confirmation: Base yukpo-db du nouveau compte AWS"
else
    echo "⚠️ ATTENTION: Base ne correspond pas à yukpo-db"
    echo "   Host trouvé: $DB_HOST"
    read -p "Continuer quand même? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Vérifier la connexion
export PGPASSWORD="$DB_PASS"
echo "🔍 Vérification de la connexion..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ ERREUR: Impossible de se connecter à la base de données"
    exit 1
fi
echo "✅ Connexion réussie"
echo ""

# ÉTAPE 1: Créer merchant_storage_locations AVANT tout
echo "📝 ÉTAPE 1: Création de merchant_storage_locations..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/fix_merchant_storage_locations.sql

if [ $? -eq 0 ]; then
    echo "✅ merchant_storage_locations créée ou existe déjà"
else
    echo "⚠️ WARNING: Erreur lors de la création (peut-être existe déjà)"
fi
echo ""

# ÉTAPE 2: Vérifier si la table users existe (pour la FK)
echo "📝 ÉTAPE 2: Vérification de la table users..."
USERS_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    );
" | tr -d ' ')

if [ "$USERS_EXISTS" = "f" ]; then
    echo "⚠️ Table users n'existe pas encore"
    echo "   La FK merchant_id -> users(id) sera ajoutée après la création de users"
    echo "   merchant_storage_locations a été créée sans FK (sera ajoutée après)"
else
    echo "✅ Table users existe, vérification de la FK..."
    # Ajouter la FK si elle n'existe pas
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'merchant_storage_locations_merchant_id_fkey'
                AND table_name = 'merchant_storage_locations'
            ) THEN
                ALTER TABLE merchant_storage_locations 
                ADD CONSTRAINT merchant_storage_locations_merchant_id_fkey 
                FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE;
                RAISE NOTICE '✅ FK ajoutée';
            ELSE
                RAISE NOTICE '✅ FK existe déjà';
            END IF;
        END \$\$;
    "
fi
echo ""

# ÉTAPE 3: Appliquer la migration 0 (qui devrait maintenant fonctionner)
echo "📝 ÉTAPE 3: Application de la migration 0..."
cd backend
export DATABASE_URL="$DATABASE_URL"

# Vérifier que sqlx est disponible
if ! command -v sqlx &> /dev/null; then
    echo "❌ ERREUR: sqlx n'est pas installé"
    echo "   Installez avec: cargo install sqlx-cli"
    exit 1
fi

# Utiliser sqlx migrate run pour appliquer toutes les migrations
echo "   Exécution de: sqlx migrate run"
sqlx migrate run

if [ $? -eq 0 ]; then
    echo "✅ Migrations appliquées avec succès!"
else
    echo "❌ ERREUR: Échec de l'application des migrations"
    echo ""
    echo "🔍 Vérification des tables créées..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
        LIMIT 20;
    "
    exit 1
fi
echo ""

# ÉTAPE 4: Ajouter la FK si elle n'existe pas (au cas où users a été créé après)
echo "📝 ÉTAPE 4: Vérification finale de la FK merchant_id -> users(id)..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    DO \$\$
    BEGIN
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'merchant_storage_locations_merchant_id_fkey'
                AND table_name = 'merchant_storage_locations'
            ) THEN
                ALTER TABLE merchant_storage_locations 
                ADD CONSTRAINT merchant_storage_locations_merchant_id_fkey 
                FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE;
                RAISE NOTICE '✅ FK ajoutée';
            ELSE
                RAISE NOTICE '✅ FK existe déjà';
            END IF;
        ELSE
            RAISE NOTICE '⚠️ Table users n''existe toujours pas';
        END IF;
    END \$\$;
"
echo ""

# ÉTAPE 5: Vérification finale
echo "📝 ÉTAPE 5: Vérification finale..."
TABLES_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
" | tr -d ' ')

echo "✅ Nombre de tables créées: $TABLES_COUNT"
echo ""

# Vérifier les tables critiques
echo "🔍 Vérification des tables critiques:"
CRITICAL_TABLES=("users" "services" "deliveries" "merchant_storage_locations")
ALL_EXIST=true

for table in "${CRITICAL_TABLES[@]}"; do
    EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '$table'
        );
    " | tr -d ' ')
    
    if [ "$EXISTS" = "t" ]; then
        echo "  ✅ $table"
    else
        echo "  ❌ $table (MANQUANTE)"
        ALL_EXIST=false
    fi
done

echo ""

# Vérifier les migrations appliquées
echo "🔍 Vérification des migrations appliquées:"
MIGRATIONS_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM _sqlx_migrations;
" | tr -d ' ')

echo "✅ Migrations enregistrées: $MIGRATIONS_COUNT"
echo ""

if [ "$ALL_EXIST" = true ]; then
    echo "========================================"
    echo "  ✅ APPLICATION RÉUSSIE"
    echo "========================================"
    echo ""
    echo "🚀 Prochaines étapes:"
    echo "   1. Redémarrer le service ECS:"
    echo "      aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region $REGION"
    echo ""
    echo "   2. Vérifier les logs:"
    echo "      aws logs tail /ecs/yukpo-backend --follow --region $REGION"
    echo ""
    exit 0
else
    echo "========================================"
    echo "  ⚠️ APPLICATION PARTIELLE"
    echo "========================================"
    echo ""
    echo "Certaines tables critiques sont manquantes."
    echo "Vérifiez les logs ci-dessus pour plus de détails."
    echo ""
    exit 1
fi

