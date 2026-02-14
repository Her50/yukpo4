# Script pour corriger et appliquer les migrations directement

$ErrorActionPreference = "Stop"

$region = "eu-west-1"
$dbInstance = "yukpo-db"
$secretId = "yukpo/backend/secrets"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CORRECTION ET APPLICATION MIGRATIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# 1. ANALYSE DU PROBLÈME
# ========================================
Write-Host "1. ANALYSE DU PROBLÈME" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "  Problème identifié:" -ForegroundColor White
Write-Host "    ❌ Migration 0 (0000_create_all_tables.sql) référence 'merchant_storage_locations'" -ForegroundColor Red
Write-Host "    ❌ Mais cette table n'est JAMAIS créée dans la migration 0" -ForegroundColor Red
Write-Host "    ❌ Elle est référencée à la ligne 2881: storage_location_id REFERENCES merchant_storage_locations(id)" -ForegroundColor Red
Write-Host ""

Write-Host "  Pourquoi auto_migrate et 0000_create_all_tables n'appliquent pas automatiquement:" -ForegroundColor White
Write-Host "    1. SQLx exécute les migrations dans l'ordre (0000, 0001, etc.)" -ForegroundColor Gray
Write-Host "    2. La migration 0 essaie de créer product_delivery_config avec une FK vers merchant_storage_locations" -ForegroundColor Gray
Write-Host "    3. PostgreSQL refuse car la table référencée n'existe pas" -ForegroundColor Gray
Write-Host "    4. La migration 0 échoue → Aucune table n'est créée" -ForegroundColor Gray
Write-Host "    5. auto_migrate ne s'exécute que si users et services existent (qui dépendent de la migration 0)" -ForegroundColor Gray
Write-Host "    6. Résultat: Rien ne fonctionne" -ForegroundColor Gray
Write-Host ""

# ========================================
# 2. VÉRIFICATION DE LA BASE DE DONNÉES
# ========================================
Write-Host "2. VÉRIFICATION DE LA BASE DE DONNÉES" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $secret = aws secretsmanager get-secret-value --secret-id $secretId --region $region --query 'SecretString' --output text 2>&1 | ConvertFrom-Json
    
    if ($secret.DATABASE_URL) {
        $dbUrl = $secret.DATABASE_URL
        if ($dbUrl -match "@([^:]+):") {
            $dbHost = $matches[1]
            Write-Host "  Base de données: $dbHost" -ForegroundColor White
            
            if ($dbHost -match "yukpo-db" -or $dbHost -match "cp4oq80ogckg") {
                Write-Host "  ✅ Confirmation: Base yukpo-db du nouveau compte AWS" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️ ATTENTION: Base ne correspond pas à yukpo-db" -ForegroundColor Yellow
            }
        }
    }
} catch {
    Write-Host "  ⚠️ Impossible de vérifier la base de données: $_" -ForegroundColor Yellow
}

Write-Host ""

# ========================================
# 3. CRÉATION DU SCRIPT SQL DE CORRECTION
# ========================================
Write-Host "3. CRÉATION DU SCRIPT SQL DE CORRECTION" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$correctionSql = @"
-- ========================================
-- CORRECTION CRITIQUE: Créer merchant_storage_locations AVANT migration 0
-- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- Problème: Migration 0 référence cette table mais ne la crée pas
-- ========================================

-- ✅ CRITIQUE: Créer merchant_storage_locations EN PREMIER
-- Cette table est référencée dans 0000_create_all_tables.sql ligne 2881
-- mais n'est jamais créée dans cette migration

CREATE TABLE IF NOT EXISTS merchant_storage_locations (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Index pour merchant_storage_locations
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant 
    ON merchant_storage_locations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_active 
    ON merchant_storage_locations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_location 
    ON merchant_storage_locations USING GIST (location);

-- ✅ Maintenant, la migration 0 pourra référencer cette table sans erreur
"@

$correctionSqlPath = "scripts/fix_merchant_storage_locations.sql"
$correctionSql | Out-File -FilePath $correctionSqlPath -Encoding UTF8 -NoNewline

Write-Host "  ✅ Script de correction créé: $correctionSqlPath" -ForegroundColor Green
Write-Host ""

# ========================================
# 4. CRÉATION DU SCRIPT D'APPLICATION COMPLET
# ========================================
Write-Host "4. CRÉATION DU SCRIPT D'APPLICATION COMPLET" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$applyScript = @"
#!/bin/bash
# Script pour corriger et appliquer toutes les migrations

set -e

REGION="$region"
SECRET_ID="$secretId"
DB_INSTANCE="$dbInstance"

echo "========================================"
echo "  CORRECTION ET APPLICATION MIGRATIONS"
echo "========================================"
echo ""

# Récupérer DATABASE_URL depuis Secrets Manager
echo "🔐 Récupération des credentials..."
DATABASE_URL=\$(aws secretsmanager get-secret-value --secret-id "\$SECRET_ID" --region "\$REGION" --query 'SecretString' --output text | jq -r '.DATABASE_URL')

if [ -z "\$DATABASE_URL" ]; then
    echo "❌ ERREUR: Impossible de récupérer DATABASE_URL"
    exit 1
fi

# Extraire les informations de connexion
DB_HOST=\$(echo "\$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=\$(echo "\$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
DB_NAME=\$(echo "\$DATABASE_URL" | sed -n 's#.*/\([^/?]*\).*#\1#p')
DB_USER=\$(echo "\$DATABASE_URL" | sed -n 's#.*://\([^:]*\):.*#\1#p')
DB_PASS=\$(echo "\$DATABASE_URL" | sed -n 's#.*://[^:]*:\([^@]*\)@.*#\1#p')

echo "📊 Base de données: \$DB_NAME sur \$DB_HOST"
echo ""

# Vérifier la connexion
export PGPASSWORD="\$DB_PASS"
echo "🔍 Vérification de la connexion..."
if ! psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ ERREUR: Impossible de se connecter à la base de données"
    exit 1
fi
echo "✅ Connexion réussie"
echo ""

# ÉTAPE 1: Créer merchant_storage_locations AVANT tout
echo "📝 ÉTAPE 1: Création de merchant_storage_locations..."
psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -f scripts/fix_merchant_storage_locations.sql

if [ \$? -eq 0 ]; then
    echo "✅ merchant_storage_locations créée"
else
    echo "⚠️ WARNING: Erreur lors de la création (peut-être existe déjà)"
fi
echo ""

# ÉTAPE 2: Vérifier si la table users existe (pour la FK)
echo "📝 ÉTAPE 2: Vérification de la table users..."
USERS_EXISTS=\$(psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -t -c "
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    );
" | tr -d ' ')

if [ "\$USERS_EXISTS" = "f" ]; then
    echo "⚠️ Table users n'existe pas encore"
    echo "   La FK merchant_id -> users(id) sera créée après la création de users"
    echo "   Pour l'instant, on crée merchant_storage_locations sans FK"
    
    # Recréer sans FK temporairement
    psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "
        DROP TABLE IF EXISTS merchant_storage_locations CASCADE;
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
    "
    
    echo "✅ merchant_storage_locations créée sans FK (sera ajoutée après création de users)"
else
    echo "✅ Table users existe, FK sera créée correctement"
fi
echo ""

# ÉTAPE 3: Appliquer la migration 0 (qui devrait maintenant fonctionner)
echo "📝 ÉTAPE 3: Application de la migration 0..."
cd backend
export DATABASE_URL="\$DATABASE_URL"

# Utiliser sqlx migrate run pour appliquer toutes les migrations
sqlx migrate run

if [ \$? -eq 0 ]; then
    echo "✅ Migrations appliquées avec succès!"
else
    echo "❌ ERREUR: Échec de l'application des migrations"
    echo ""
    echo "🔍 Vérification des tables créées..."
    psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "
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

# ÉTAPE 4: Ajouter la FK si elle n'existe pas
echo "📝 ÉTAPE 4: Vérification de la FK merchant_id -> users(id)..."
psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "
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
echo ""

# ÉTAPE 5: Vérification finale
echo "📝 ÉTAPE 5: Vérification finale..."
TABLES_COUNT=\$(psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
" | tr -d ' ')

echo "✅ Nombre de tables créées: \$TABLES_COUNT"
echo ""

# Vérifier les tables critiques
echo "🔍 Vérification des tables critiques:"
for table in users services deliveries merchant_storage_locations; do
    EXISTS=\$(psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -t -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '\$table'
        );
    " | tr -d ' ')
    
    if [ "\$EXISTS" = "t" ]; then
        echo "  ✅ \$table"
    else
        echo "  ❌ \$table (MANQUANTE)"
    fi
done

echo ""
echo "========================================"
echo "  APPLICATION TERMINÉE"
echo "========================================"
"@

$applyScriptPath = "scripts/apply-migrations-complete.sh"
$applyScript | Out-File -FilePath $applyScriptPath -Encoding UTF8 -NoNewline

Write-Host "  ✅ Script d'application complet créé: $applyScriptPath" -ForegroundColor Green
Write-Host ""

# ========================================
# 5. RÉSUMÉ ET RECOMMANDATIONS
# ========================================
Write-Host "5. RÉSUMÉ ET RECOMMANDATIONS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "  Cause racine identifiée:" -ForegroundColor White
Write-Host "    - merchant_storage_locations n'est jamais créée dans 0000_create_all_tables.sql" -ForegroundColor Gray
Write-Host "    - Mais elle est référencée à la ligne 2881 dans product_delivery_config" -ForegroundColor Gray
Write-Host "    - PostgreSQL refuse la création avec FK vers table inexistante" -ForegroundColor Gray
Write-Host ""

Write-Host "  Solution appliquée:" -ForegroundColor White
Write-Host "    1. Créer merchant_storage_locations AVANT la migration 0" -ForegroundColor Green
Write-Host "    2. Appliquer ensuite la migration 0 normalement" -ForegroundColor Green
Write-Host "    3. Ajouter la FK merchant_id -> users(id) après création de users" -ForegroundColor Green
Write-Host ""

Write-Host "  Fichiers créés:" -ForegroundColor White
Write-Host "    - scripts/fix_merchant_storage_locations.sql" -ForegroundColor Cyan
Write-Host "    - scripts/apply-migrations-complete.sh" -ForegroundColor Cyan
Write-Host ""

Write-Host "  Pour appliquer:" -ForegroundColor White
Write-Host "    bash scripts/apply-migrations-complete.sh" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

