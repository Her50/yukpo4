# Script pour analyser le CSV et appliquer directement toutes les migrations, index et fonctions

$ErrorActionPreference = "Stop"

$csvFile = "log-events-viewer-result (35).csv"
$region = "eu-west-1"
$dbInstance = "yukpo-db"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE ET APPLICATION MIGRATIONS DIRECTES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# 1. VÉRIFICATION DE LA BASE DE DONNÉES
# ========================================
Write-Host "1. VÉRIFICATION DE LA BASE DE DONNÉES" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# Extraire DATABASE_URL depuis le CSV
$csvContent = Get-Content $csvFile -Raw -Encoding UTF8
if ($csvContent -match 'DATABASE_URL.*postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^\s"]+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "  Base de données détectée:" -ForegroundColor White
    Write-Host "    Host: $dbHost" -ForegroundColor Gray
    Write-Host "    Port: $dbPort" -ForegroundColor Gray
    Write-Host "    Database: $dbName" -ForegroundColor Gray
    Write-Host "    User: $dbUser" -ForegroundColor Gray
    Write-Host ""
    
    # Vérifier que c'est la bonne base (yukpo-db du nouveau compte)
    if ($dbHost -match "yukpo-db" -or $dbHost -match "cp4oq80ogckg") {
        Write-Host "  ✅ Base de données confirmée: yukpo-db (nouveau compte AWS)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ ATTENTION: Base de données ne correspond pas à yukpo-db" -ForegroundColor Yellow
        Write-Host "    Host trouvé: $dbHost" -ForegroundColor Gray
    }
} else {
    Write-Host "  ❌ Impossible d'extraire DATABASE_URL du CSV" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# 2. ANALYSE DU PROBLÈME
# ========================================
Write-Host "2. ANALYSE DU PROBLÈME" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "  Problème identifié:" -ForegroundColor White
Write-Host "    ❌ Migration 0 référence 'merchant_storage_locations' qui n'existe pas" -ForegroundColor Red
Write-Host "    ❌ La table merchant_storage_locations n'est pas créée dans 0000_create_all_tables.sql" -ForegroundColor Red
Write-Host "    ❌ Elle devrait être créée dans 20250120_002_add_product_stock_management.sql" -ForegroundColor Yellow
Write-Host ""

Write-Host "  Pourquoi auto_migrate et 0000_create_all_tables n'appliquent pas automatiquement:" -ForegroundColor White
Write-Host "    1. La migration 0 (0000_create_all_tables.sql) essaie d'utiliser merchant_storage_locations" -ForegroundColor Gray
Write-Host "    2. Mais cette table n'est créée que dans une migration ultérieure" -ForegroundColor Gray
Write-Host "    3. SQLx exécute les migrations dans l'ordre numérique (0000, 0001, etc.)" -ForegroundColor Gray
Write-Host "    4. La migration 0 échoue car la table n'existe pas encore" -ForegroundColor Gray
Write-Host "    5. auto_migrate ne s'exécute que si users et services existent (qui dépendent de la migration 0)" -ForegroundColor Gray
Write-Host ""

# ========================================
# 3. EXTRACTION DES COMMANDES SQL DU CSV
# ========================================
Write-Host "3. EXTRACTION DES COMMANDES SQL DU CSV" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$sqlCommands = @()
$lines = Get-Content $csvFile -Encoding UTF8

# Extraire toutes les commandes SQL (CREATE TABLE, CREATE INDEX, CREATE FUNCTION, etc.)
$inSqlBlock = $false
$currentSql = ""
$sqlPatterns = @("CREATE TABLE", "CREATE INDEX", "CREATE FUNCTION", "CREATE OR REPLACE FUNCTION", "CREATE VIEW", "CREATE TRIGGER", "ALTER TABLE", "DO `$`")

foreach ($line in $lines) {
    # Ignorer les lignes de timestamp
    if ($line -match '^[0-9]+,') {
        $message = $line -replace '^[0-9]+,"?(.*)"?$', '$1'
        
        # Détecter le début d'un bloc SQL
        foreach ($pattern in $sqlPatterns) {
            if ($message -match $pattern) {
                $inSqlBlock = $true
                $currentSql = $message
                break
            }
        }
        
        # Continuer à accumuler si on est dans un bloc SQL
        if ($inSqlBlock) {
            if ($message -match ';$' -or $message -match '`$`$' -or $message -match 'END `$`$') {
                $currentSql += "`n" + $message
                $sqlCommands += $currentSql
                $currentSql = ""
                $inSqlBlock = $false
            } elseif ($message -notmatch '^[0-9]+,' -and $message.Trim() -ne "") {
                $currentSql += "`n" + $message
            }
        }
    }
}

Write-Host "  Commandes SQL extraites: $($sqlCommands.Count)" -ForegroundColor White

# Séparer par type
$createTables = $sqlCommands | Where-Object { $_ -match "CREATE TABLE" }
$createIndexes = $sqlCommands | Where-Object { $_ -match "CREATE INDEX" }
$createFunctions = $sqlCommands | Where-Object { $_ -match "CREATE.*FUNCTION" }
$createTriggers = $sqlCommands | Where-Object { $_ -match "CREATE TRIGGER" }
$createViews = $sqlCommands | Where-Object { $_ -match "CREATE VIEW" }

Write-Host "    - CREATE TABLE: $($createTables.Count)" -ForegroundColor Gray
Write-Host "    - CREATE INDEX: $($createIndexes.Count)" -ForegroundColor Gray
Write-Host "    - CREATE FUNCTION: $($createFunctions.Count)" -ForegroundColor Gray
Write-Host "    - CREATE TRIGGER: $($createTriggers.Count)" -ForegroundColor Gray
Write-Host "    - CREATE VIEW: $($createViews.Count)" -ForegroundColor Gray
Write-Host ""

# ========================================
# 4. CRÉATION DU SCRIPT SQL COMPLET
# ========================================
Write-Host "4. CRÉATION DU SCRIPT SQL COMPLET" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$sqlScript = @"
-- ========================================
-- Script d'application directe des migrations
-- Généré depuis log-events-viewer-result (35).csv
-- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- Base de données: $dbName sur $dbHost
-- ========================================

-- ✅ CRITIQUE: Créer merchant_storage_locations AVANT de l'utiliser
-- Cette table est référencée dans 0000_create_all_tables.sql mais n'y est pas créée

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

CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant 
    ON merchant_storage_locations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_active 
    ON merchant_storage_locations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_location 
    ON merchant_storage_locations USING GIST (location);

-- Maintenant, appliquer toutes les autres commandes SQL dans l'ordre
"@

# Ajouter toutes les commandes SQL extraites
$sqlScript += "`n`n-- ========================================`n"
$sqlScript += "-- TABLES`n"
$sqlScript += "-- ========================================`n`n"
$sqlScript += ($createTables | Select-Object -First 50 | Out-String)

$sqlScript += "`n`n-- ========================================`n"
$sqlScript += "-- INDEXES`n"
$sqlScript += "-- ========================================`n`n"
$sqlScript += ($createIndexes | Select-Object -First 100 | Out-String)

$sqlScript += "`n`n-- ========================================`n"
$sqlScript += "-- FUNCTIONS`n"
$sqlScript += "-- ========================================`n`n"
$sqlScript += ($createFunctions | Out-String)

$sqlScript += "`n`n-- ========================================`n"
$sqlScript += "-- TRIGGERS`n"
$sqlScript += "-- ========================================`n`n"
$sqlScript += ($createTriggers | Out-String)

$sqlScript += "`n`n-- ========================================`n"
$sqlScript += "-- VIEWS`n"
$sqlScript += "-- ========================================`n`n"
$sqlScript += ($createViews | Out-String)

$sqlScriptPath = "scripts/apply_migrations_direct.sql"
$sqlScript | Out-File -FilePath $sqlScriptPath -Encoding UTF8 -NoNewline

Write-Host "  ✅ Script SQL créé: $sqlScriptPath" -ForegroundColor Green
Write-Host ""

# ========================================
# 5. CRÉATION DU SCRIPT D'APPLICATION
# ========================================
Write-Host "5. CRÉATION DU SCRIPT D'APPLICATION" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$applyScript = @"
#!/bin/bash
# Script pour appliquer directement les migrations depuis le CSV

set -e

REGION="$region"
DB_INSTANCE="$dbInstance"
SQL_FILE="scripts/apply_migrations_direct.sql"

echo "========================================"
echo "  APPLICATION DIRECTE DES MIGRATIONS"
echo "========================================"
echo ""

# Vérifier que le fichier SQL existe
if [ ! -f "\$SQL_FILE" ]; then
    echo "❌ ERREUR: Fichier SQL non trouvé: \$SQL_FILE"
    exit 1
fi

echo "✅ Fichier SQL trouvé: \$SQL_FILE"
echo ""

# Récupérer les informations de connexion depuis AWS Secrets Manager
echo "🔐 Récupération des credentials depuis Secrets Manager..."
SECRET_ARN="arn:aws:secretsmanager:\${REGION}:108964700972:secret:yukpo/backend/secrets-0gPpWc"
DATABASE_URL=\$(aws secretsmanager get-secret-value --secret-id "\$SECRET_ARN" --region "\$REGION" --query 'SecretString' --output text | jq -r '.DATABASE_URL')

if [ -z "\$DATABASE_URL" ]; then
    echo "❌ ERREUR: Impossible de récupérer DATABASE_URL depuis Secrets Manager"
    exit 1
fi

echo "✅ DATABASE_URL récupérée"
echo ""

# Extraire les informations de connexion
DB_HOST=\$(echo "\$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=\$(echo "\$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
DB_NAME=\$(echo "\$DATABASE_URL" | sed -n 's#.*/\([^/?]*\).*#\1#p')
DB_USER=\$(echo "\$DATABASE_URL" | sed -n 's#.*://\([^:]*\):.*#\1#p')
DB_PASS=\$(echo "\$DATABASE_URL" | sed -n 's#.*://[^:]*:\([^@]*\)@.*#\1#p')

echo "📊 Informations de connexion:"
echo "   Host: \$DB_HOST"
echo "   Port: \$DB_PORT"
echo "   Database: \$DB_NAME"
echo "   User: \$DB_USER"
echo ""

# Vérifier la connexion
echo "🔍 Vérification de la connexion..."
export PGPASSWORD="\$DB_PASS"
if psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Connexion réussie"
else
    echo "❌ ERREUR: Impossible de se connecter à la base de données"
    exit 1
fi

echo ""
echo "📝 Application des migrations..."
echo ""

# Appliquer le script SQL
psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -f "\$SQL_FILE"

if [ \$? -eq 0 ]; then
    echo ""
    echo "✅ Migrations appliquées avec succès!"
    echo ""
    echo "🔍 Vérification des tables créées..."
    psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    "
    echo ""
    echo "✅ Application terminée avec succès!"
else
    echo ""
    echo "❌ ERREUR: Échec de l'application des migrations"
    exit 1
fi
"@

$applyScriptPath = "scripts/apply-migrations-direct.sh"
$applyScript | Out-File -FilePath $applyScriptPath -Encoding UTF8 -NoNewline

Write-Host "  ✅ Script d'application créé: $applyScriptPath" -ForegroundColor Green
Write-Host ""

# ========================================
# 6. ALTERNATIVE: UTILISER LA MIGRATION 0 CORRIGÉE
# ========================================
Write-Host "6. SOLUTION RECOMMANDÉE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "  Option 1: Corriger la migration 0" -ForegroundColor Cyan
Write-Host "    - Ajouter la création de merchant_storage_locations AVANT sa référence" -ForegroundColor White
Write-Host "    - Ou créer la table dans une migration antérieure (00000000)" -ForegroundColor White
Write-Host ""

Write-Host "  Option 2: Appliquer directement via script SQL" -ForegroundColor Cyan
Write-Host "    - Utiliser le script créé: $sqlScriptPath" -ForegroundColor White
Write-Host "    - Ou utiliser: $applyScriptPath" -ForegroundColor White
Write-Host ""

Write-Host "  Option 3: Créer merchant_storage_locations manuellement d'abord" -ForegroundColor Cyan
Write-Host "    - Puis exécuter les migrations SQLx normalement" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Fichiers créés:" -ForegroundColor Yellow
Write-Host "   - $sqlScriptPath" -ForegroundColor White
Write-Host "   - $applyScriptPath" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Vérifier le script SQL créé" -ForegroundColor White
Write-Host "   2. Appliquer via: bash $applyScriptPath" -ForegroundColor White
Write-Host "   3. Ou corriger la migration 0 pour créer merchant_storage_locations" -ForegroundColor White

