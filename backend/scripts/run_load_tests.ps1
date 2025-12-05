# ✅ Script PowerShell pour exécuter les tests de charge covoiturage
# Usage: .\scripts\run_load_tests.ps1

Write-Host "🚀 Démarrage tests de charge covoiturage..." -ForegroundColor Cyan

# Vérifier variables d'environnement
if (-not $env:TEST_DATABASE_URL) {
    Write-Host "⚠️  TEST_DATABASE_URL non défini, utilisation valeur par défaut" -ForegroundColor Yellow
    $env:TEST_DATABASE_URL = "postgresql://test:test@localhost:5432/yukpomnang_test"
}

if (-not $env:TEST_REDIS_URL) {
    Write-Host "⚠️  TEST_REDIS_URL non défini, utilisation valeur par défaut" -ForegroundColor Yellow
    $env:TEST_REDIS_URL = "redis://localhost:6379/1"
}

Write-Host "📊 Configuration:" -ForegroundColor Green
Write-Host "   - Database: $env:TEST_DATABASE_URL"
Write-Host "   - Redis: $env:TEST_REDIS_URL"
Write-Host ""

# Tests unitaires
Write-Host "🧪 Exécution tests unitaires..." -ForegroundColor Cyan
cargo test --test covoiturage_endpoints_test -- --ignored --nocapture

# Tests de charge
Write-Host ""
Write-Host "⚡ Exécution tests de charge..." -ForegroundColor Cyan
cargo test --test covoiturage_load_tests --release -- --ignored --nocapture

Write-Host ""
Write-Host "✅ Tests terminés!" -ForegroundColor Green

