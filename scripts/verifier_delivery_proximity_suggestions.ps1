# Script pour vérifier et corriger la structure de delivery_proximity_suggestions

$ErrorActionPreference = "Stop"

$REGION = "eu-west-1"
$SECRET_ID = "yukpo/backend/secrets"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔍 Vérification de la structure de delivery_proximity_suggestions" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# 1. Récupérer DATABASE_URL depuis Secrets Manager
Write-Host "📥 Récupération de DATABASE_URL depuis Secrets Manager..." -ForegroundColor Yellow
try {
    $secretValue = aws secretsmanager get-secret-value `
        --secret-id $SECRET_ID `
        --region $REGION `
        --query 'SecretString' `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Erreur lors de la récupération du secret"
    }
    
    $secretJson = $secretValue | ConvertFrom-Json
    $DATABASE_URL = $secretJson.DATABASE_URL
    
    Write-Host "✅ DATABASE_URL récupéré" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la récupération de DATABASE_URL: $_" -ForegroundColor Red
    exit 1
}

# 2. Vérifier la structure de la table
Write-Host ""
Write-Host "🔍 Vérification de la structure de la table..." -ForegroundColor Yellow

$checkTableSql = @"
-- Vérifier si la table existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'delivery_proximity_suggestions'
        ) THEN 'EXISTS'
        ELSE 'NOT_EXISTS'
    END as table_status;
"@

$checkTableSql | Out-File -FilePath "check_table.sql" -Encoding UTF8
$tableStatus = psql "$DATABASE_URL" -f "check_table.sql" -t -A 2>&1
Remove-Item "check_table.sql" -ErrorAction SilentlyContinue

if ($tableStatus -match "NOT_EXISTS") {
    Write-Host "❌ La table delivery_proximity_suggestions n'existe pas" -ForegroundColor Red
    Write-Host "   Action requise: Créer la table avec la migration" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ La table delivery_proximity_suggestions existe" -ForegroundColor Green

# 3. Lister les colonnes
Write-Host ""
Write-Host "📋 Colonnes de la table:" -ForegroundColor Yellow

$listColumnsSql = @"
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'delivery_proximity_suggestions'
ORDER BY ordinal_position;
"@

$listColumnsSql | Out-File -FilePath "list_columns.sql" -Encoding UTF8
psql "$DATABASE_URL" -f "list_columns.sql" 2>&1
Remove-Item "list_columns.sql" -ErrorAction SilentlyContinue

# 4. Vérifier si suggested_status existe
Write-Host ""
Write-Host "🔍 Vérification de la colonne suggested_status..." -ForegroundColor Yellow

$checkColumnSql = @"
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'delivery_proximity_suggestions'
            AND column_name = 'suggested_status'
        ) THEN 'EXISTS'
        ELSE 'NOT_EXISTS'
    END as column_status;
"@

$checkColumnSql | Out-File -FilePath "check_column.sql" -Encoding UTF8
$columnStatus = psql "$DATABASE_URL" -f "check_column.sql" -t -A 2>&1
Remove-Item "check_column.sql" -ErrorAction SilentlyContinue

if ($columnStatus -match "NOT_EXISTS") {
    Write-Host "❌ La colonne suggested_status n'existe pas" -ForegroundColor Red
    Write-Host "   Ajout de la colonne..." -ForegroundColor Yellow
    
    $addColumnSql = @"
ALTER TABLE delivery_proximity_suggestions
ADD COLUMN suggested_status TEXT NOT NULL DEFAULT 'arrival_pickup';
"@
    
    $addColumnSql | Out-File -FilePath "add_column.sql" -Encoding UTF8
    $result = psql "$DATABASE_URL" -f "add_column.sql" 2>&1
    Remove-Item "add_column.sql" -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Colonne suggested_status ajoutée avec succès" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'ajout de la colonne: $result" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ La colonne suggested_status existe déjà" -ForegroundColor Green
}

# 5. Vérification finale
Write-Host ""
Write-Host "✅ Vérification terminée" -ForegroundColor Green
Write-Host ""

