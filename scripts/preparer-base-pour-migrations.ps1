# Script pour préparer la base de données avant les migrations
# Date: 2026-02-15
# Objectif: Créer les tables de base nécessaires avant d'exécuter les migrations SQLx

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = "TempPassword123!"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PREPARATION BASE POUR MIGRATIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
}

# Recuperer l'IP publique Cloud SQL
$publicIp = gcloud sql instances describe $InstanceName --format="get(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0 -or -not $publicIp) {
    Write-Host "[ERREUR] Impossible de recuperer l'IP publique" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] IP publique: $publicIp" -ForegroundColor Cyan
Write-Host ""

# Configurer PGPASSWORD
$env:PGPASSWORD = $Password

# Script SQL pour creer les tables de base
$prepSql = @"
-- Creer la table _sqlx_migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum BYTEA NOT NULL,
    execution_time BIGINT NOT NULL
);

-- Creer la table users (minimale) si elle n'existe pas
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Creer la table services (minimale) si elle n'existe pas
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Creer la table products si elle n'existe pas
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    numero_bus VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT 'Tables de base creees avec succes' AS status;
"@

# Ecrire le script SQL dans un fichier temporaire
$tempSqlFile = "temp_prepare_base.sql"
$prepSql | Out-File -FilePath $tempSqlFile -Encoding UTF8

Write-Host "[ETAPE 1/2] Creation des tables de base..." -ForegroundColor Yellow

# Executer le script SQL
$output = psql -h $publicIp -U $User -d $DatabaseName -f $tempSqlFile 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "[OK] Tables de base creees avec succes" -ForegroundColor Green
    $output | Select-Object -Last 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "[ATTENTION] Code de sortie: $exitCode" -ForegroundColor Yellow
    $output | Select-Object -Last 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
}

# Nettoyer
Remove-Item $tempSqlFile -ErrorAction SilentlyContinue
$env:PGPASSWORD = $null

Write-Host ""
Write-Host "[ETAPE 2/2] Verification..." -ForegroundColor Yellow

# Verifier que les tables existent
$checkSql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'services', 'products', '_sqlx_migrations') ORDER BY table_name;"
$checkOutput = psql -h $publicIp -U $User -d $DatabaseName -c $checkSql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Tables verifiees:" -ForegroundColor Green
    $checkOutput | Select-Object -Skip 2 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "[ATTENTION] Impossible de verifier les tables" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[OK] Preparation terminee!" -ForegroundColor Green
Write-Host ""


