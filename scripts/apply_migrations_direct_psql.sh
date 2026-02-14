#!/bin/bash
# Script pour appliquer les migrations directement avec psql
# Utilise psql pour exécuter les fichiers SQL directement, sans sqlx

set -e

REGION="eu-west-1"
SECRET_ID="yukpo/backend/secrets"

echo "========================================"
echo "  APPLICATION MIGRATIONS DIRECTE (psql)"
echo "========================================"
echo ""

# ========================================
# 1. RÉCUPÉRER DATABASE_URL
# ========================================
echo "1. Récupération de DATABASE_URL depuis Secrets Manager..."
DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --region "$REGION" --query 'SecretString' --output text | jq -r '.DATABASE_URL')

if [ -z "$DATABASE_URL" ]; then
    echo "ERREUR: Impossible de récupérer DATABASE_URL"
    exit 1
fi

echo "OK: DATABASE_URL récupérée"
echo "Base de données: $(echo $DATABASE_URL | sed -n 's#.*@\([^:]*\):.*#\1#p')"
echo ""

# ========================================
# 2. CRÉER MERCHANT_STORAGE_LOCATIONS
# ========================================
echo "2. Création de merchant_storage_locations..."
cat > /tmp/fix_merchant_storage_locations.sql << 'EOF'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'merchant_storage_locations'
    ) THEN
        CREATE TABLE merchant_storage_locations (
            id SERIAL PRIMARY KEY,
            merchant_id INTEGER,
            name TEXT NOT NULL,
            address TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            location GEOGRAPHY(Point, 4326),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            capacity_info JSONB DEFAULT '{}'::jsonb,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant 
            ON merchant_storage_locations(merchant_id);
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_active 
            ON merchant_storage_locations(is_active) WHERE is_active = TRUE;
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_location 
            ON merchant_storage_locations USING GIST (location);
        
        RAISE NOTICE 'OK: Table merchant_storage_locations créée';
    ELSE
        RAISE NOTICE 'INFO: Table merchant_storage_locations existe déjà';
    END IF;
END $$;
EOF

psql "$DATABASE_URL" -f /tmp/fix_merchant_storage_locations.sql

if [ $? -eq 0 ]; then
    echo "OK: merchant_storage_locations créée ou existe déjà"
else
    echo "ATTENTION: Erreur (peut-être existe déjà)"
fi
echo ""

# ========================================
# 3. CLONER LE REPO
# ========================================
echo "3. Préparation du repo..."
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2
echo "OK: Repo cloné"
echo ""

# ========================================
# 4. APPLIQUER LES MIGRATIONS DANS L'ORDRE
# ========================================
echo "4. Application des migrations SQL directement..."
cd yukpomnang2/backend/migrations

# Compter les migrations
TOTAL_MIGRATIONS=$(ls -1 *.sql | wc -l)
echo "Nombre de migrations trouvées: $TOTAL_MIGRATIONS"
echo ""

# Appliquer chaque migration dans l'ordre
CURRENT=0
SUCCESS=0
ERRORS=0

for migration_file in $(ls -1 *.sql | sort); do
    CURRENT=$((CURRENT + 1))
    echo "[$CURRENT/$TOTAL_MIGRATIONS] Application de: $migration_file..."
    
    # Exécuter la migration
    psql "$DATABASE_URL" -f "$migration_file" 2>&1 | tee /tmp/migration_output.log
    
    EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "  OK: $migration_file"
        SUCCESS=$((SUCCESS + 1))
    else
        # Vérifier si l'erreur est "already exists" ou similaire (non bloquant)
        ERROR_OUTPUT=$(cat /tmp/migration_output.log)
        if echo "$ERROR_OUTPUT" | grep -qiE "already exists|existe déjà|duplicate|relation.*already exists"; then
            echo "  INFO: $migration_file - Déjà appliquée"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "  ERREUR: $migration_file"
            echo "  Sortie: $ERROR_OUTPUT"
            ERRORS=$((ERRORS + 1))
        fi
    fi
    echo ""
done

echo "Résumé: $SUCCESS réussie(s), $ERRORS erreur(s)"
echo ""

# ========================================
# 5. VÉRIFICATION FINALE
# ========================================
echo "5. Vérification finale..."
TABLES_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
" | tr -d ' ')

echo "Nombre de tables créées: $TABLES_COUNT"
echo ""

# Vérifier les tables critiques
echo "Vérification des tables critiques:"
CRITICAL_TABLES=("users" "services" "deliveries" "merchant_storage_locations")
ALL_EXIST=true

for table in "${CRITICAL_TABLES[@]}"; do
    EXISTS=$(psql "$DATABASE_URL" -t -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '$table'
        );
    " | tr -d ' ')
    
    if [ "$EXISTS" = "t" ]; then
        echo "  OK: $table"
    else
        echo "  ERREUR: $table (MANQUANTE)"
        ALL_EXIST=false
    fi
done

echo ""

if [ "$ALL_EXIST" = true ]; then
    echo "========================================"
    echo "  APPLICATION RÉUSSIE"
    echo "========================================"
    exit 0
else
    echo "========================================"
    echo "  APPLICATION PARTIELLE"
    echo "========================================"
    echo "Certaines tables critiques sont manquantes."
    exit 1
fi

