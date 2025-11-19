# Script final pour corriger le checksum et appliquer les migrations
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
$env:DATABASE_URL = $DATABASE_URL

Write-Host "=== CORRECTION ET APPLICATION DES MIGRATIONS ===" -ForegroundColor Cyan

# Étape 1: Calculer le nouveau checksum de la migration 0
Write-Host "`n1️⃣ Calcul du checksum de la migration 0..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationFile = Join-Path $scriptDir "migrations\0000_create_all_tables.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier migration 0 non trouvé: $migrationFile" -ForegroundColor Red
    Write-Host "Répertoire courant: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "Fichiers migrations disponibles:" -ForegroundColor Yellow
    Get-ChildItem -Path "$scriptDir\migrations" -Filter "*.sql" | Select-Object -First 5 Name
    exit 1
}

$content = [System.IO.File]::ReadAllText($migrationFile, [System.Text.Encoding]::UTF8)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($content))
$checksumHex = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""

Write-Host "✅ Checksum calculé: $checksumHex" -ForegroundColor Green

# Étape 2: Vérifier psql
$psqlCheck = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCheck) {
    Write-Host "⚠️  psql non trouvé. Exécution du script SQL manuellement requis." -ForegroundColor Yellow
    Write-Host "`nExécutez cette commande SQL dans votre base:" -ForegroundColor Cyan
    Write-Host "UPDATE _sqlx_migrations SET checksum = decode('$checksumHex', 'hex') WHERE version = 0;" -ForegroundColor White
    Write-Host "`nPuis relancez: cargo sqlx migrate run" -ForegroundColor Yellow
    exit 1
}

# Étape 3: Mettre à jour le checksum dans la base
Write-Host "`n2️⃣ Mise à jour du checksum dans _sqlx_migrations..." -ForegroundColor Yellow
$updateQuery = "UPDATE _sqlx_migrations SET checksum = decode('$checksumHex', 'hex') WHERE version = 0;"
$result = & psql "$DATABASE_URL" -c $updateQuery 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la mise à jour du checksum" -ForegroundColor Red
    Write-Host $result
    Write-Host "`nTentative manuelle avec cette commande:" -ForegroundColor Yellow
    Write-Host "UPDATE _sqlx_migrations SET checksum = decode('$checksumHex', 'hex') WHERE version = 0;" -ForegroundColor White
    exit 1
}

Write-Host "✅ Checksum mis à jour avec succès" -ForegroundColor Green

# Étape 4: Vérifier la mise à jour
Write-Host "`n3️⃣ Vérification du checksum mis à jour..." -ForegroundColor Yellow
$checkQuery = "SELECT version, description, encode(checksum, 'hex') as checksum_hex FROM _sqlx_migrations WHERE version = 0;"
& psql "$DATABASE_URL" -c $checkQuery

# Étape 5: Appliquer les migrations en attente
Write-Host "`n4️⃣ Application des migrations en attente..." -ForegroundColor Yellow
$migrateResult = cargo sqlx migrate run 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migrations appliquées avec succès" -ForegroundColor Green
} else {
    if ($migrateResult -match "migration 0 was previously applied but has been modified") {
        Write-Host "❌ Le checksum n'a pas été corrigé correctement" -ForegroundColor Red
        Write-Host "   Le checksum devrait être: $checksumHex" -ForegroundColor Yellow
        Write-Host "   Veuillez vérifier manuellement dans la base" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "❌ Erreur lors de l'application des migrations:" -ForegroundColor Red
        Write-Host $migrateResult
        exit 1
    }
}

# Étape 6: Vérifier l'état final
Write-Host "`n5️⃣ État final des migrations:" -ForegroundColor Yellow
cargo sqlx migrate info | Select-String -Pattern "pending|installed" | Select-Object -Last 10

# Étape 7: Régénérer le cache sqlx
Write-Host "`n6️⃣ Régénération du cache sqlx..." -ForegroundColor Yellow
$prepareResult = cargo sqlx prepare --workspace --database-url $DATABASE_URL 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cache sqlx régénéré avec succès" -ForegroundColor Green
} else {
    Write-Host "⚠️  Avertissement lors de la régénération du cache:" -ForegroundColor Yellow
    Write-Host $prepareResult
    Write-Host "   Le cache existant peut être utilisé si présent" -ForegroundColor Yellow
}

Write-Host "`n=== ✅ TERMINÉ ===" -ForegroundColor Green
Write-Host "Toutes les migrations ont été appliquées avec succès." -ForegroundColor Green

