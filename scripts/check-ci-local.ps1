# Script PowerShell pour vérifier localement avec les mêmes flags que le CI
# Usage: .\scripts\check-ci-local.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔍 Vérification locale avec les mêmes flags que le CI..." -ForegroundColor Cyan
Write-Host ""

Set-Location backend

# Vérification formatage
Write-Host "📝 1/4 Vérification formatage (cargo fmt --check)..." -ForegroundColor Yellow
try {
    cargo fmt -- --check
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Formatage incorrect. Exécutez: cargo fmt" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Formatage OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la vérification formatage: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Vérification clippy strict (comme le CI)
Write-Host "🔍 2/4 Vérification clippy strict (--all-targets -- -D warnings)..." -ForegroundColor Yellow
try {
    cargo clippy --all-targets -- -D warnings
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreurs clippy détectées" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Clippy OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la vérification clippy: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Vérification build release
Write-Host "🔨 3/4 Vérification build release (--release --locked)..." -ForegroundColor Yellow
try {
    cargo build --release --locked
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreurs de build détectées" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Build OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du build: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Vérification sqlx (si base accessible)
Write-Host "📊 4/4 Vérification sqlx..." -ForegroundColor Yellow
if (Test-Path "sqlx-data.json") {
    Write-Host "✅ sqlx-data.json trouvé" -ForegroundColor Green
} elseif (Test-Path ".sqlx") {
    Write-Host "✅ Répertoire .sqlx trouvé" -ForegroundColor Green
} else {
    Write-Host "⚠️  Aucun fichier sqlx préparé trouvé (sqlx-data.json ou .sqlx/)" -ForegroundColor Yellow
    Write-Host "   Pour générer: cargo sqlx prepare -- --lib (avec DATABASE_URL configuré)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "✅ Toutes les vérifications CI passent localement !" -ForegroundColor Green
Write-Host "🎉 Vous pouvez push en toute sécurité" -ForegroundColor Green

Set-Location ..

