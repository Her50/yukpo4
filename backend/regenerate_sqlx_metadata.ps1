# Script PowerShell pour régénérer les métadonnées SQLx
# Nécessite une connexion à la base de données

Write-Host "=== Régénération des métadonnées SQLx ===" -ForegroundColor Cyan

# Configuration de la base de données Render
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "✅ DATABASE_URL configuré" -ForegroundColor Green

# Désactiver le mode offline temporairement
$env:SQLX_OFFLINE = "false"

Write-Host "`n1. Vérification de sqlx-cli..." -ForegroundColor Yellow
# Vérifier si sqlx-cli est installé
$sqlxInstalled = Get-Command sqlx -ErrorAction SilentlyContinue
if (-not $sqlxInstalled) {
    Write-Host "   Installation de sqlx-cli..." -ForegroundColor Yellow
    cargo install sqlx-cli --no-default-features --features postgres
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'installation de sqlx-cli" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ sqlx-cli déjà installé" -ForegroundColor Green
}

Write-Host "`n2. Application des migrations..." -ForegroundColor Yellow
sqlx migrate run
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Migrations appliquées" -ForegroundColor Green

Write-Host "`n3. Génération des métadonnées SQLx..." -ForegroundColor Yellow
cargo sqlx prepare --workspace
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Métadonnées générées avec succès" -ForegroundColor Green
    Write-Host "📁 Fichiers créés dans .sqlx/" -ForegroundColor Cyan
    
    # Compter les fichiers
    if (Test-Path ".sqlx") {
        $count = (Get-ChildItem -Path ".sqlx" -Filter "*.json" -Recurse | Measure-Object).Count
        Write-Host "📊 Nombre de fichiers de métadonnées: $count" -ForegroundColor Cyan
    }
    
    Write-Host "`n✅ Régénération terminée avec succès" -ForegroundColor Green
    Write-Host "💡 N'oubliez pas de commiter les fichiers .sqlx/" -ForegroundColor Yellow
} else {
    Write-Host "❌ Erreur lors de la génération des métadonnées" -ForegroundColor Red
    exit 1
}

# Réactiver le mode offline
$env:SQLX_OFFLINE = "true"
Write-Host "`n✅ SQLX_OFFLINE réactivé" -ForegroundColor Green

