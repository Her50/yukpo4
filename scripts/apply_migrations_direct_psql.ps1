# Script PowerShell pour appliquer les migrations directement avec psql
# Utilise psql pour exécuter les fichiers SQL directement, sans sqlx

param(
    [string]$Region = "eu-west-1",
    [string]$SecretId = "yukpo/backend/secrets"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION MIGRATIONS DIRECTE (psql)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# 1. RÉCUPÉRER DATABASE_URL
# ========================================
Write-Host "1. Récupération de DATABASE_URL depuis Secrets Manager..." -ForegroundColor Yellow

try {
    $secret = aws secretsmanager get-secret-value --secret-id $SecretId --region $Region --query 'SecretString' --output text 2>&1 | ConvertFrom-Json
    
    if ($secret.DATABASE_URL) {
        $databaseUrl = $secret.DATABASE_URL
        Write-Host "  OK: DATABASE_URL récupérée" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR: DATABASE_URL non trouvée dans le secret" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ERREUR: Impossible de récupérer DATABASE_URL: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# 2. CRÉER MERCHANT_STORAGE_LOCATIONS
# ========================================
Write-Host "2. Création de merchant_storage_locations..." -ForegroundColor Yellow

$fixSql = @"
DO `$`$
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
END `$`$;
"@

$fixSqlPath = "scripts/temp_fix_merchant_storage_locations.sql"
$fixSql | Out-File -FilePath $fixSqlPath -Encoding UTF8 -NoNewline

Write-Host "  Exécution du script SQL..." -ForegroundColor Gray
$result = & psql $databaseUrl -f $fixSqlPath 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: merchant_storage_locations créée ou existe déjà" -ForegroundColor Green
} else {
    Write-Host "  ATTENTION: Erreur (peut-être existe déjà)" -ForegroundColor Yellow
    Write-Host "  Sortie: $result" -ForegroundColor Gray
}

Write-Host ""

# ========================================
# 3. APPLIQUER LES MIGRATIONS SQL DIRECTEMENT
# ========================================
Write-Host "3. Application des migrations SQL directement..." -ForegroundColor Yellow

$migrationsDir = "backend/migrations"
if (-not (Test-Path $migrationsDir)) {
    Write-Host "  ERREUR: Dossier migrations non trouvé: $migrationsDir" -ForegroundColor Red
    exit 1
}

# Lister les fichiers de migration dans l'ordre
$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

Write-Host "  Nombre de migrations trouvées: $($migrationFiles.Count)" -ForegroundColor Gray
Write-Host ""

# Appliquer chaque migration dans l'ordre
$successCount = 0
$errorCount = 0

foreach ($migrationFile in $migrationFiles) {
    Write-Host "  Application de: $($migrationFile.Name)..." -ForegroundColor Gray
    
    $result = & psql $databaseUrl -f $migrationFile.FullName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    OK: $($migrationFile.Name)" -ForegroundColor Green
        $successCount++
    } else {
        # Vérifier si l'erreur est "already exists" ou similaire (non bloquant)
        $errorOutput = $result -join " "
        if ($errorOutput -match "already exists|existe déjà|duplicate|relation.*already exists") {
            Write-Host "    INFO: $($migrationFile.Name) - Déjà appliquée" -ForegroundColor Yellow
            $successCount++
        } else {
            Write-Host "    ERREUR: $($migrationFile.Name)" -ForegroundColor Red
            Write-Host "    Sortie: $($result -join ' ')" -ForegroundColor Gray
            $errorCount++
        }
    }
}

Write-Host ""
Write-Host "  Résumé: $successCount réussie(s), $errorCount erreur(s)" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

# ========================================
# 4. VÉRIFICATION FINALE
# ========================================
Write-Host "4. Vérification finale..." -ForegroundColor Yellow

$tablesQuery = @"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
"@

$tables = & psql $databaseUrl -t -c $tablesQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Tables créées:" -ForegroundColor Green
    $tables | Where-Object { $_.Trim() -ne "" } | ForEach-Object {
        Write-Host "    - $($_.Trim())" -ForegroundColor Gray
    }
    
    # Vérifier les tables critiques
    Write-Host ""
    Write-Host "  Vérification des tables critiques:" -ForegroundColor Cyan
    $criticalTables = @("users", "services", "deliveries", "merchant_storage_locations")
    
    foreach ($table in $criticalTables) {
        $exists = $tables -match $table
        if ($exists) {
            Write-Host "    OK: $table" -ForegroundColor Green
        } else {
            Write-Host "    ERREUR: $table (MANQUANTE)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  ERREUR: Impossible de vérifier les tables" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  APPLICATION TERMINÉE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Nettoyer
Remove-Item -Path $fixSqlPath -ErrorAction SilentlyContinue

