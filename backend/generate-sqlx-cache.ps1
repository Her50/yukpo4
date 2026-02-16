# Script pour générer le cache SQLx
# Usage: .\generate-sqlx-cache.ps1

Write-Host "🔧 Génération du cache SQLx" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Désactiver SQLX_OFFLINE pour permettre la génération
$env:SQLX_OFFLINE = "false"

# Demander la DATABASE_URL si elle n'est pas définie
if (-not $env:DATABASE_URL) {
    Write-Host "⚠️  DATABASE_URL non définie" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Format attendu:" -ForegroundColor Cyan
    Write-Host "  postgresql://USER:PASSWORD@HOST:PORT/yukpo_postgres?sslmode=require" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Exemple GCP Cloud SQL (IP publique):" -ForegroundColor Cyan
    Write-Host "  postgresql://yukpo_user:PASSWORD@34.79.199.41:5432/yukpo_postgres?sslmode=require" -ForegroundColor Gray
    Write-Host ""
    
    $dbUrl = Read-Host "Entrez la DATABASE_URL"
    if ($dbUrl) {
        $env:DATABASE_URL = $dbUrl
    } else {
        Write-Host "❌ DATABASE_URL requise" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ DATABASE_URL configurée" -ForegroundColor Green
Write-Host "   Base de données: yukpo_postgres" -ForegroundColor Gray
Write-Host ""

# Vérifier la connexion
Write-Host "🔍 Test de connexion à la base de données..." -ForegroundColor Cyan
try {
    $testResult = cargo sqlx database create 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion réussie" -ForegroundColor Green
    } else {
        Write-Host "⚠️  La base existe peut-être déjà (c'est normal)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Erreur de connexion (peut être ignorée si la base existe)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Génération du cache SQLx..." -ForegroundColor Cyan
Write-Host "   Cela peut prendre quelques minutes..." -ForegroundColor Gray
Write-Host ""

# Générer le cache
cargo sqlx prepare --workspace -- --lib

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Cache SQLx généré avec succès!" -ForegroundColor Green
    
    # Compter les fichiers générés
    if (Test-Path ".sqlx") {
        $fileCount = (Get-ChildItem -Path ".sqlx" -Recurse -File | Measure-Object).Count
        Write-Host "   Fichiers générés: $fileCount" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "📋 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Vérifier que .sqlx/ contient des fichiers" -ForegroundColor White
    Write-Host "   2. Commiter le cache: git add .sqlx/" -ForegroundColor White
    Write-Host "   3. Le build Docker devrait maintenant fonctionner" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de la génération du cache" -ForegroundColor Red
    Write-Host "   Vérifiez:" -ForegroundColor Yellow
    Write-Host "   - La DATABASE_URL est correcte" -ForegroundColor Yellow
    Write-Host "   - La base de données est accessible" -ForegroundColor Yellow
    Write-Host "   - Les migrations sont appliquées" -ForegroundColor Yellow
    exit 1
}

