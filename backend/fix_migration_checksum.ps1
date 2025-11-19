# Script pour corriger le checksum de la migration 0
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "=== Correction du checksum de la migration 0 ===" -ForegroundColor Cyan

# Calculer le nouveau checksum de la migration 0
Write-Host "`n📄 Calcul du nouveau checksum..." -ForegroundColor Yellow
$migrationFile = "migrations\0000_create_all_tables.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier migration 0 non trouvé: $migrationFile" -ForegroundColor Red
    exit 1
}

$content = Get-Content $migrationFile -Raw -Encoding UTF8
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($content))
$checksum = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()
$checksumBytes = [System.Text.Encoding]::UTF8.GetBytes($checksum)

Write-Host "Nouveau checksum: $checksum" -ForegroundColor Green

# Mettre à jour le checksum dans la base
Write-Host "`n🔧 Mise à jour du checksum dans _sqlx_migrations..." -ForegroundColor Yellow

$updateQuery = @"
UPDATE _sqlx_migrations 
SET checksum = decode('$checksum', 'hex')
WHERE version = 0;
"@

$env:DATABASE_URL = $DATABASE_URL
$result = & psql "$DATABASE_URL" -c $updateQuery 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Checksum mis à jour avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la mise à jour du checksum" -ForegroundColor Red
    Write-Host $result
    exit 1
}

# Vérifier
Write-Host "`n🔍 Vérification..." -ForegroundColor Cyan
$checkQuery = "SELECT version, encode(checksum, 'hex') as checksum_hex FROM _sqlx_migrations WHERE version = 0;"
& psql "$DATABASE_URL" -c $checkQuery

Write-Host "`n=== FIN ===" -ForegroundColor Cyan

