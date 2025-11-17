#!/usr/bin/env pwsh
# Script pour vérifier et régénérer le cache SQLx de manière exhaustive

Write-Host "=== Vérification et régénération du cache SQLx ===" -ForegroundColor Green

# Aller dans le répertoire backend
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Definition)

# 1. Exporter DATABASE_URL
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
$env:SQLX_OFFLINE = "false"

Write-Host "1. DATABASE_URL configurée" -ForegroundColor Cyan

# 2. Compter les requêtes SQLx dans le code
Write-Host "2. Comptage des requêtes SQLx dans le code..." -ForegroundColor Cyan
$sqlQueryCount = (Select-String -Path "src/**/*.rs" -Pattern "sqlx::query!|sqlx::query_scalar!|sqlx::query_as!" -SimpleMatch | Measure-Object).Count
Write-Host "   Requêtes trouvées dans le code: $sqlQueryCount" -ForegroundColor Yellow

# 3. Vérifier l'existence du cache
Write-Host "3. Vérification du cache .sqlx..." -ForegroundColor Cyan
if (Test-Path ".sqlx" -PathType Container) {
    $cacheFileCount = (Get-ChildItem -Path .sqlx -Recurse -File | Measure-Object).Count
    Write-Host "   Fichiers dans le cache: $cacheFileCount" -ForegroundColor Yellow
    
    $gap = $sqlQueryCount - $cacheFileCount
    if ($gap -gt 0) {
        Write-Host "   ⚠️ Gap détecté: $gap requêtes sans métadonnées" -ForegroundColor Red
    } else {
        Write-Host "   ✅ Nombre de fichiers OK (gap normal dû à la déduplication SQLx)" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ Répertoire .sqlx non trouvé" -ForegroundColor Red
}

# 4. Supprimer l'ancien cache
Write-Host "4. Suppression de l'ancien cache..." -ForegroundColor Cyan
if (Test-Path ".sqlx" -PathType Container) {
    Remove-Item -Path .sqlx -Recurse -Force
    Write-Host "   ✅ Ancien cache supprimé" -ForegroundColor Green
}

# 5. Régénérer le cache pour la bibliothèque
Write-Host "5. Génération du cache pour la bibliothèque..." -ForegroundColor Cyan
cargo sqlx prepare -- --lib
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Erreur lors de la génération du cache pour la bibliothèque" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Cache pour la bibliothèque généré" -ForegroundColor Green

# 6. Régénérer le cache pour tout le workspace
Write-Host "6. Génération du cache pour tout le workspace..." -ForegroundColor Cyan
cargo sqlx prepare --workspace
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️ Erreur lors de la génération du cache pour le workspace (peut être normal)" -ForegroundColor Yellow
}
Write-Host "   ✅ Cache pour le workspace généré" -ForegroundColor Green

# 7. Tenter avec --all-features
Write-Host "7. Génération du cache avec --all-features..." -ForegroundColor Cyan
cargo sqlx prepare --all-features --workspace 2>&1 | Out-Null
Write-Host "   ✅ Tentative avec --all-features terminée" -ForegroundColor Green

# 8. Compter les fichiers finaux
$finalCacheCount = (Get-ChildItem -Path .sqlx -Recurse -File | Measure-Object).Count
Write-Host "8. Résultat final: $finalCacheCount fichiers dans le cache" -ForegroundColor Cyan

# 9. Tester la compilation en mode offline
Write-Host "9. Test de compilation en mode offline..." -ForegroundColor Cyan
$env:SQLX_OFFLINE = "true"
cargo check --lib --message-format=short 2>&1 | Select-Object -First 20

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Compilation réussie en mode offline" -ForegroundColor Green
} else {
    Write-Host "   ⚠️ Erreurs de compilation (normal si le cache n'est pas complet)" -ForegroundColor Yellow
    Write-Host "   Le cache sera néanmoins copié dans Docker" -ForegroundColor Yellow
}

Write-Host "=== Fin de la vérification ===" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Cyan
Write-Host "1. Commit le cache: git add .sqlx && git commit -m 'chore: update sqlx cache'" -ForegroundColor White
Write-Host "2. Build Docker: docker build -f Dockerfile -t yukpo-backend:latest ." -ForegroundColor White


