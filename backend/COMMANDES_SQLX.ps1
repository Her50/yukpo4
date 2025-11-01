# Script PowerShell pour générer les métadonnées SQLx après ajout de nouvelles requêtes

$ErrorActionPreference = "Stop"

Write-Host "🔍 Vérification de l'environnement..." -ForegroundColor Cyan

# Vérifier que DATABASE_URL est configuré
if (-not (Test-Path .env)) {
    Write-Host "❌ Fichier .env introuvable" -ForegroundColor Red
    Write-Host "📝 Créez un fichier .env avec DATABASE_URL=postgresql://user:password@localhost:5432/yukpomnang" -ForegroundColor Yellow
    exit 1
}

$envContent = Get-Content .env
if ($envContent -notmatch "DATABASE_URL") {
    Write-Host "❌ DATABASE_URL n'est pas configuré dans .env" -ForegroundColor Red
    Write-Host "📝 Ajoutez DATABASE_URL=postgresql://user:password@localhost:5432/yukpomnang" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL configuré" -ForegroundColor Green

Write-Host ""
Write-Host "📦 Étape 1/3 : Application des migrations..." -ForegroundColor Cyan
sqlx migrate run

Write-Host ""
Write-Host "🔨 Étape 2/3 : Génération des métadonnées SQLx..." -ForegroundColor Cyan
cargo sqlx prepare --workspace

Write-Host ""
Write-Host "📊 Étape 3/3 : Vérification..." -ForegroundColor Cyan
$metadataCount = (Get-ChildItem -Path ".sqlx" -Filter "query-*.json" -File | Measure-Object).Count
Write-Host "✅ $metadataCount fichiers metadata générés" -ForegroundColor Green

Write-Host ""
Write-Host "🎯 Prochaines étapes :" -ForegroundColor Yellow
Write-Host "1. Commit les métadonnées :" -ForegroundColor White
Write-Host "   git add .sqlx/" -ForegroundColor Gray
Write-Host "   git commit -m 'Add SQLx metadata for new queries'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Tester la compilation offline :" -ForegroundColor White
Write-Host "   `$env:SQLX_OFFLINE=`"true`"" -ForegroundColor Gray
Write-Host "   cargo build" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ Génération terminée !" -ForegroundColor Green

