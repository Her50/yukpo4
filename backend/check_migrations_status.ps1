# Script pour vérifier l'état des migrations dans la base Render
$DATABASE_URL = "postgresql://user:password@host:port/database"

Write-Host "=== Vérification de l'état des migrations ===" -ForegroundColor Cyan

# 1. Lister toutes les migrations locales
Write-Host "`n📁 Migrations locales:" -ForegroundColor Yellow
$localMigrations = Get-ChildItem -Path "migrations" -Filter "*.sql" | Sort-Object Name
Write-Host "Total: $($localMigrations.Count) migrations" -ForegroundColor Green
$localMigrations | ForEach-Object { Write-Host "  - $($_.Name)" }

# 2. Vérifier l'état dans la base de données
Write-Host "`n🔍 Vérification de l'état dans la base Render..." -ForegroundColor Yellow

# Installer psql si nécessaire (utiliser pg_isready pour test de connexion d'abord)
$psqlCheck = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCheck) {
    Write-Host "❌ psql non trouvé. Installation via PostgreSQL nécessaire." -ForegroundColor Red
    Write-Host "   Alternativement, utilisez sqlx-cli: cargo install sqlx-cli --no-default-features --features postgres" -ForegroundColor Yellow
    exit 1
}

# Vérifier la connexion
Write-Host "`n🔌 Test de connexion..." -ForegroundColor Cyan
$testConnection = & psql "$DATABASE_URL" -c "SELECT 1;" -t 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Impossible de se connecter à la base de données" -ForegroundColor Red
    Write-Host $testConnection
    exit 1
}
Write-Host "✅ Connexion réussie" -ForegroundColor Green

# Vérifier si la table _sqlx_migrations existe
Write-Host "`n📊 Vérification de la table _sqlx_migrations..." -ForegroundColor Cyan
$migrationsTableExists = & psql "$DATABASE_URL" -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_sqlx_migrations');" -t 2>&1 | Out-String
if ($migrationsTableExists -match "t") {
    Write-Host "✅ Table _sqlx_migrations existe" -ForegroundColor Green
    
    # Récupérer les migrations appliquées
    Write-Host "`n📋 Migrations appliquées en base:" -ForegroundColor Yellow
    $appliedMigrations = & psql "$DATABASE_URL" -c "SELECT version, description, installed_on, success FROM _sqlx_migrations ORDER BY version;" 2>&1
    
    if ($appliedMigrations -match "version") {
        Write-Host $appliedMigrations
    }
    else {
        Write-Host "  Aucune migration appliquée via SQLx" -ForegroundColor Yellow
    }
    
    # Compter les migrations appliquées
    $appliedCount = & psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM _sqlx_migrations WHERE success = true;" -t 2>&1 | Out-String
    $appliedCount = ($appliedCount -replace '\s', '').Trim()
    Write-Host "`nTotal migrations appliquées (succès): $appliedCount" -ForegroundColor Cyan
    
}
else {
    Write-Host "❌ Table _sqlx_migrations n'existe pas" -ForegroundColor Red
    Write-Host "   Les migrations SQLx n'ont jamais été exécutées via sqlx migrate run" -ForegroundColor Yellow
}

# 3. Vérifier le cache .sqlx
Write-Host "`n📦 Vérification du cache SQLx..." -ForegroundColor Cyan
if (Test-Path ".sqlx") {
    $sqlxFiles = Get-ChildItem -Path ".sqlx" -Recurse -File
    Write-Host "✅ Dossier .sqlx trouvé ($($sqlxFiles.Count) fichiers)" -ForegroundColor Green
}
else {
    Write-Host "❌ Dossier .sqlx non trouvé" -ForegroundColor Red
    Write-Host "   Exécuter: cargo sqlx prepare --workspace" -ForegroundColor Yellow
}

# 4. Vérifier sqlx-data.json
Write-Host "`n📄 Vérification de sqlx-data.json..." -ForegroundColor Cyan
if (Test-Path "sqlx-data.json") {
    Write-Host "✅ sqlx-data.json trouvé" -ForegroundColor Green
}
else {
    Write-Host "⚠️  sqlx-data.json non trouvé (optionnel, remplacé par .sqlx)" -ForegroundColor Yellow
}

# 5. Résumé
Write-Host "`n=== RÉSUMÉ ===" -ForegroundColor Cyan
Write-Host "Migrations locales: $($localMigrations.Count)" -ForegroundColor White
if ($migrationsTableExists -match "t" -and $appliedCount) {
    Write-Host "Migrations appliquées: $appliedCount" -ForegroundColor White
    
    if ([int]$appliedCount -lt $localMigrations.Count) {
        Write-Host "`n⚠️  ATTENTION: Des migrations locales ne sont pas appliquées en base!" -ForegroundColor Yellow
        Write-Host "   Exécuter: sqlx migrate run --database-url `"$DATABASE_URL`"" -ForegroundColor Yellow
    }
    else {
        Write-Host "✅ Toutes les migrations semblent appliquées" -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️  Migrations SQLx non vérifiées ou non appliquées" -ForegroundColor Yellow
}

Write-Host "`n=== FIN ===" -ForegroundColor Cyan

